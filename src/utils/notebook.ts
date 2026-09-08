import dayjs from 'dayjs';
import * as api from '@/api/api';
import { setCustomDNAttr, setCustomWeeklyAttr, setCustomMonthlyAttr, setCustomYearlyAttr } from '@/api/daily-note';
import {
  weeklyEnabled,
  weeklyPath,
  weeklyTemplatePath,
  monthlyEnabled,
  monthlyPath,
  monthlyTemplatePath,
  yearlyEnabled,
  yearlyPath,
  yearlyTemplatePath,
  weekStart,
  effectiveWeekRule,
  autoCreateWeekly,
  autoCreateWeeklyForced,
} from '@/hooks/useSiYuan';
import { getCalendarWeekNum, getWeekInfo, getWeekIsoKey } from '@/utils/weekNum';

function isPathInTemplatesDir(filePath: string, templatesDir: string): boolean {
  const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
  const candidate = normalize(String(filePath || ''));
  const root = normalize(templatesDir);
  return candidate === root || candidate.startsWith(`${root}/`);
}

function getTemplateRelativePath(filePath: string): string | undefined {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)templates\/(.+)$/i);
  return match?.[1];
}

async function getTemplatesDir(): Promise<string> {
  const system = await api.request('/api/system/getConf');
  let dataDir = String(system?.conf?.system?.dataDir || '').replace(/[\\/]+$/, '');

  // The web frontend deliberately omits dataDir from getConf. Derive it from
  // the workspace path so the template API still receives an absolute path.
  if (!dataDir) {
    const workspace = await api.request('/api/system/getWorkspaceInfo');
    const workspaceDir = String(workspace?.workspaceDir || '').replace(/[\\/]+$/, '');
    dataDir = workspaceDir ? `${workspaceDir}/data` : '';
  }

  return dataDir ? `${dataDir}/templates` : '';
}

export class CusNotebook implements Notebook, NotebookConf {
  private weeklyCreationLocks = new Map<string, Promise<string>>();
  private monthlyCreationLocks = new Map<string, Promise<string>>();
  private yearlyCreationLocks = new Map<string, Promise<string>>();

  constructor(
    public id: NotebookId,
    public name: string,
    public dailyNoteSavePath: string,
    public dailyNoteTemplatePath: string,
  ) {}

  static async build({ id, name }: Notebook) {
    const { conf } = await api.getNotebookConf(id);
    let { dailyNoteSavePath, dailyNoteTemplatePath } = conf;
    dailyNoteSavePath = dailyNoteSavePath.replace(/\{\{(.*?)\}\}/g, match =>
      match.replace(/\bnow\b(?=(?:(?:[^"]*"){2})*[^"]*$)/g, `(toDate "2006-01-02" "[[dateSlot]]")`)
    );
    return new CusNotebook(id, name, dailyNoteSavePath, dailyNoteTemplatePath);
  }

  getSavePath(date: Date) {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const path = this.dailyNoteSavePath.replaceAll('[[dateSlot]]', dateStr);
    return api.renderSprig(path);
  }

  async searchDailyNote(condition: string) {
    return api.sql(`SELECT * FROM blocks WHERE type='d' AND box = '${this.id}' AND ${condition}`);
  }

  async getExistDailyNote(date: Date): Promise<DailyNote[]> {
    const month = dayjs(date).format('YYYYMM');
    const condition = `id IN (SELECT block_id FROM attributes AS a WHERE a.name like 'custom-dailynote-${month}__') `;
    const dailyNotes = await this.searchDailyNote(condition);
    const result: DailyNote[] = [];
    if (!dailyNotes?.length) {
      return result;
    }
    for (const { id, ial } of dailyNotes) {
      const match = ial?.match(/custom-dailynote-(\d{8})/);
      if (match) {
        const dateStr = dayjs(match[1]).format('YYYY-MM-DD');
        result.push({ id, dateStr });
      }
    }
    return result;
  }

  async createDailyNote(date: Date): Promise<DailyNote> {
    const hPath = await this.getSavePath(date);
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const existingId = await this.getDocIdByHPath(hPath);
    // 当前日期已有日记却无文档属性，设置后返回日记
    if (existingId) {
      const id = existingId;
      try {
        await setCustomDNAttr(id, date); //为新建的日记添加自定义属性
      } catch (e) {
        // attribute writing is best-effort
      }
      return { id, dateStr };
    }
    // 当前日期无日记，创建日记
    const docID = await api.createDocWithMd(this.id, hPath, '');
    // 根据模板渲染日记
    await this.applyTemplate(docID, this.dailyNoteTemplatePath);
    try {
      await setCustomDNAttr(docID, date); //为新建的日记添加自定义属性
    } catch (e) {
      // attribute writing is best-effort
    }
    return { id: docID, dateStr };
  }

  private async renderPathPattern(pathPattern: string, date: Date, variables: Record<string, string | number> = {}) {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    let pattern = pathPattern;

    for (const [key, value] of Object.entries(variables)) {
      const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      pattern = pattern.replace(reg, String(value));
    }

    pattern = pattern.replace(/\{\{(.*?)\}\}/g, match =>
      match.replace(/\bnow\b(?=(?:(?:[^"]*"){2})*[^"]*$)/g, `(toDate "2006-01-02" "${dateStr}")`)
    );
    return api.renderSprig(pattern);
  }

  private async getDocIdByHPath(hPath: string): Promise<string | undefined> {
    const safeHPath = hPath.replace(/'/g, "''");
    const results = await api.sql(`SELECT id FROM blocks WHERE type='d' AND box = '${this.id}' AND hpath = '${safeHPath}'`);
    if (results && results.length > 0) {
      return results[0].id;
    }
    return undefined;
  }

  private async resolveTemplatePath(templatePath: string): Promise<string> {
    let tplPath = (templatePath || '').trim();
    if (!tplPath) return '';

    const templatesDir = await getTemplatesDir();
    if (!templatesDir) return '';

    // Keep absolute paths (including Android paths) that are already inside
    // the workspace templates directory. A leading slash alone is not enough:
    // SiYuan also uses "/foo.md" for a path relative to data/templates.
    if (isPathInTemplatesDir(tplPath, templatesDir) || /^[A-Za-z]:[\\/]/.test(tplPath) || tplPath.startsWith('\\\\')) {
      const relativePath = getTemplateRelativePath(tplPath);
      if (relativePath && !isPathInTemplatesDir(tplPath, templatesDir)) {
        return `${templatesDir}/${relativePath}`;
      }
      return tplPath;
    }

    const relativePath = getTemplateRelativePath(tplPath);
    if (relativePath) {
      return `${templatesDir}/${relativePath}`;
    }

    if (!tplPath.startsWith('/') && !tplPath.startsWith('\\')) {
      tplPath = '/' + tplPath;
    }
    return templatesDir + tplPath;
  }

  private async applyTemplate(docID: string, templatePath: string): Promise<void> {
    const tplPath = await this.resolveTemplatePath(templatePath);
    if (!tplPath) return;

    const res = await api.render(docID, tplPath);
    if (res && res.content) {
      await api.prependBlock('dom', res.content, docID);
    }
  }

  /**
   * If the note already exists and is still empty, apply template once.
   * This helps when users configure/change template after the periodic note doc was created.
   */
  private async applyTemplateIfDocEmpty(docID: string, templatePath: string): Promise<void> {
    const tplPath = await this.resolveTemplatePath(templatePath);
    if (!tplPath) return;

    // Robust emptiness check:
    // only inspect blocks that belong to this document root (root_id = docID),
    // so child documents won't affect template backfill decision.
    let hasVisibleContent = false;
    try {
      const rows = await api.sql(
        `SELECT type, content, markdown FROM blocks WHERE root_id = '${docID}' AND type != 'd'`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        hasVisibleContent = rows.some((b: any) => {
          const raw = typeof b?.markdown === 'string' ? b.markdown : (typeof b?.content === 'string' ? b.content : '');
          const text = raw.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').trim();
          return text.length > 0;
        });
      }
    } catch (e) {
      // Last fallback: exported markdown of current document
      const exported = await api.exportMdContent(docID);
      const content = typeof exported?.content === 'string' ? exported.content : '';
      hasVisibleContent = content.trim().length > 0;
    }

    if (hasVisibleContent) {
      return;
    }

    const res = await api.render(docID, tplPath);
    if (res && res.content) {
      await api.prependBlock('dom', res.content, docID);
    }
  }

  /**
   * Representative day of the week row containing `date` (weekStart + 3, i.e.
   * the Thursday when the week starts on Monday). Used for weekly paths so the
   * {{now | date "2006"}} year matches the ISO year of the week.
   */
  private getWeeklyRepDay(date: Date): Date {
    const start = ((Number(weekStart.value) % 7) + 7) % 7;
    const d = dayjs(date);
    const daysFromStart = (d.day() - start + 7) % 7;
    return d.subtract(daysFromStart, 'day').add(3, 'day').toDate();
  }

  /**
   * Canonical weekly path under the active numbering rule, rendered with the
   * week's representative day (Thursday for Monday-start weeks).
   */
  private async getWeeklyCanonicalPath(date: Date): Promise<string> {
    const pathPattern = String(weeklyPath.value || '').trim();
    if (!pathPattern) {
      throw new Error('weeklyPath is required when weekly notes are enabled');
    }
    const repDay = this.getWeeklyRepDay(date);
    const info = getWeekInfo(repDay, effectiveWeekRule.value, Number(weekStart.value));
    return this.renderPathPattern(pathPattern, repDay, {
      weekly: info.week,
      month: dayjs(repDay).format('MM'),
      monthly: dayjs(repDay).format('YYYY-MM'),
      year: info.year,
      yearly: info.year,
    });
  }

  /**
   * Paths old versions could have produced for the week containing `date`.
   * Old builds always used the calendar-week numbering and rendered with the
   * triggering date (the daily-note date on auto-create, or the row's middle
   * day when clicking). A 7-day week covers at most two calendar (year, month)
   * bases, so there are at most two legacy paths.
   */
  private async getWeeklyLegacyPaths(date: Date): Promise<string[]> {
    const pathPattern = String(weeklyPath.value || '').trim();
    if (!pathPattern) return [];

    const start = ((Number(weekStart.value) % 7) + 7) % 7;
    const d = dayjs(date);
    const weekStartDay = d.subtract((d.day() - start + 7) % 7, 'day');

    const bases: Array<{ rep: Date; weekly: number }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const day = weekStartDay.add(i, 'day');
      const key = day.format('YYYY-MM');
      if (seen.has(key)) continue;
      seen.add(key);
      bases.push({ rep: day.toDate(), weekly: getCalendarWeekNum(day.toDate(), start) });
    }

    const paths: string[] = [];
    for (const base of bases) {
      paths.push(
        await this.renderPathPattern(pathPattern, base.rep, {
          weekly: base.weekly,
          month: dayjs(base.rep).format('MM'),
          monthly: dayjs(base.rep).format('YYYY-MM'),
          year: dayjs(base.rep).year(),
          yearly: dayjs(base.rep).year(),
        })
      );
    }
    return paths;
  }

  /** Ordered candidate paths for the week containing `date`: canonical first, then legacy. */
  private async getWeeklyCandidates(date: Date): Promise<string[]> {
    const seen = new Set<string>();
    const candidates: string[] = [];
    const push = (p: string) => {
      if (p && !seen.has(p)) {
        seen.add(p);
        candidates.push(p);
      }
    };
    try {
      push(await this.getWeeklyCanonicalPath(date));
    } catch (e) {
      // path may be empty/disabled; legacy candidates still apply
    }
    for (const p of await this.getWeeklyLegacyPaths(date)) {
      push(p);
    }
    return candidates;
  }

  async getWeeklySavePath(date: Date): Promise<string> {
    return this.getWeeklyCanonicalPath(date);
  }

  async getExistWeeklyNote(date: Date, backfill = true): Promise<string | undefined> {
    // Attribute identity is rule-independent and survives path edits. Check it first.
    const attrId = await this.getDocIdByWeeklyAttr(getWeekIsoKey(date, Number(weekStart.value)));
    if (attrId) return attrId;

    // Fallback to path-based lookup (canonical + legacy) for notes created before attributes were added.
    for (const p of await this.getWeeklyCandidates(date)) {
      const found = await this.getDocIdByHPath(p);
      if (found) {
        // Backfill attribute for old notes found via path so future lookups are faster.
        if (backfill) {
          await this.setWeeklyNoteAttr(found, date);
        }
        return found;
      }
    }
    return undefined;
  }

  async createWeeklyNote(date: Date): Promise<string> {
    const hPath = await this.getWeeklyCanonicalPath(date);
    const inFlight = this.weeklyCreationLocks.get(hPath);
    if (inFlight) {
      return inFlight;
    }

    const operation = this.createWeeklyNoteOnce(hPath, date);
    this.weeklyCreationLocks.set(hPath, operation);
    try {
      return await operation;
    } finally {
      if (this.weeklyCreationLocks.get(hPath) === operation) {
        this.weeklyCreationLocks.delete(hPath);
      }
    }
  }

  private async getDocIdByWeeklyAttr(weekKey: string): Promise<string | undefined> {
    const attrName = `custom-calendar-weekly-${weekKey}`;
    const results = await api.sql(
      `SELECT id FROM blocks WHERE type='d' AND box = '${this.id}' AND id IN (SELECT block_id FROM attributes WHERE name = '${attrName}')`
    );
    if (results && results.length > 0) {
      return results[0].id;
    }
    return undefined;
  }

  /**
   * Batch lookup of weekly notes by attribute for a given month range.
   * Returns a map of weekKey -> docId for all weeks found.
   */
  async getExistWeeklyNotesByKeys(weekKeys: string[]): Promise<Map<string, string>> {
    if (weekKeys.length === 0) return new Map();
    const attrNames = weekKeys.map(k => `custom-calendar-weekly-${k}`);
    const attrList = attrNames.map(n => `'${n}'`).join(',');
    const results = await api.sql(
      `SELECT b.id, a.name FROM blocks b
       INNER JOIN attributes a ON b.id = a.block_id
       WHERE b.type='d' AND b.box='${this.id}' AND a.name IN (${attrList})`
    );
    const map = new Map<string, string>();
    if (results && results.length > 0) {
      for (const row of results) {
        const match = row.name?.match(/^custom-calendar-weekly-(.+)$/);
        if (match && row.id) {
          map.set(match[1], row.id);
        }
      }
    }
    return map;
  }

  private async setWeeklyNoteAttr(docID: string, date: Date): Promise<void> {
    try {
      await setCustomWeeklyAttr(docID, getWeekIsoKey(date, Number(weekStart.value)));
    } catch (e) {
      // attribute writing is best-effort
    }
  }

  private async createWeeklyNoteOnce(hPath: string, date: Date): Promise<string> {
    // Attribute is the source of truth. If a doc with this week's attribute exists
    // (even under a different path), reuse it instead of creating a duplicate.
    const weekKey = getWeekIsoKey(date, Number(weekStart.value));
    const attrId = await this.getDocIdByWeeklyAttr(weekKey);
    if (attrId) {
      await this.applyTemplateIfDocEmpty(attrId, weeklyTemplatePath.value);
      return attrId;
    }

    // No doc with the attribute exists. Check if a doc exists at the current canonical path.
    const existingId = await this.getDocIdByHPath(hPath);
    if (existingId) {
      // Doc exists at the current path but has no attribute. Check if it already has
      // a DIFFERENT weekly attribute (e.g. user manually moved it or changed config).
      const attrs = await api.getBlockAttrs(existingId);
      const hasOtherWeekly = Object.keys(attrs).some(k => k.startsWith('custom-calendar-weekly-') && k !== `custom-calendar-weekly-${weekKey}`);
      if (hasOtherWeekly) {
        // This doc belongs to a different week. Create a new doc for this week.
        const newId = await api.createDocWithMd(this.id, hPath, '');
        await this.applyTemplate(newId, weeklyTemplatePath.value);
        await this.setWeeklyNoteAttr(newId, date);
        return newId;
      }
      // Doc has no weekly attribute or has the correct one. Backfill template and attribute.
      await this.applyTemplateIfDocEmpty(existingId, weeklyTemplatePath.value);
      await this.setWeeklyNoteAttr(existingId, date);
      return existingId;
    }

    // Check legacy paths (old naming conventions) before creating a new doc.
    for (const p of await this.getWeeklyLegacyPaths(date)) {
      if (p === hPath) continue; // already checked above
      const legacyId = await this.getDocIdByHPath(p);
      if (legacyId) {
        await this.applyTemplateIfDocEmpty(legacyId, weeklyTemplatePath.value);
        await this.setWeeklyNoteAttr(legacyId, date);
        return legacyId;
      }
    }

    // No existing doc found. Create a new one at the canonical path.
    const docID = await api.createDocWithMd(this.id, hPath, '');
    await this.applyTemplate(docID, weeklyTemplatePath.value);
    await this.setWeeklyNoteAttr(docID, date);
    return docID;
  }

  private async hasWeeklyPathOverlap(date: Date): Promise<boolean> {
    if (!weeklyEnabled.value || !String(weeklyPath.value || '').trim()) return false;
    try {
      const [dailyPath, weeklyNotePath] = await Promise.all([this.getSavePath(date), this.getWeeklyCanonicalPath(date)]);
      const normalize = (value: string) => `/${String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}`;
      const daily = normalize(dailyPath);
      const weekly = normalize(weeklyNotePath);
      return daily === weekly || daily.startsWith(`${weekly}/`);
    } catch (e) {
      return false;
    }
  }

  async refreshWeeklyPathOverlap(date: Date): Promise<boolean> {
    autoCreateWeeklyForced.value = await this.hasWeeklyPathOverlap(date);
    if (autoCreateWeeklyForced.value) {
      autoCreateWeekly.value = true;
    }
    return autoCreateWeeklyForced.value;
  }

  async getMonthlySavePath(date: Date) {
    const pathPattern = String(monthlyPath.value || '').trim();
    if (!pathPattern) {
      throw new Error('monthlyPath is required when monthly notes are enabled');
    }
    return this.renderPathPattern(pathPattern, date, {
      month: dayjs(date).format('MM'),
      monthly: dayjs(date).format('YYYY-MM'),
      year: dayjs(date).format('YYYY'),
      yearly: dayjs(date).format('YYYY'),
    });
  }

  async getExistMonthlyNote(date: Date): Promise<string | undefined> {
    const hPath = await this.getMonthlySavePath(date);
    return this.getDocIdByHPath(hPath);
  }

  async createMonthlyNote(date: Date): Promise<string> {
    const hPath = await this.getMonthlySavePath(date);
    const inFlight = this.monthlyCreationLocks.get(hPath);
    if (inFlight) {
      return inFlight;
    }

    const operation = this.createMonthlyNoteOnce(hPath, date);
    this.monthlyCreationLocks.set(hPath, operation);
    try {
      return await operation;
    } finally {
      if (this.monthlyCreationLocks.get(hPath) === operation) {
        this.monthlyCreationLocks.delete(hPath);
      }
    }
  }

  private async createMonthlyNoteOnce(hPath: string, date: Date): Promise<string> {
    // Attribute is the source of truth. If a doc with this month's attribute exists, reuse it.
    const monthKey = dayjs(date).format('YYYYMM');
    const attrName = `custom-calendar-monthly-${monthKey}`;
    const results = await api.sql(
      `SELECT id FROM blocks WHERE type='d' AND box = '${this.id}' AND id IN (SELECT block_id FROM attributes WHERE name = '${attrName}')`
    );
    if (results && results.length > 0) {
      const attrId = results[0].id;
      await this.applyTemplateIfDocEmpty(attrId, monthlyTemplatePath.value);
      return attrId;
    }

    // No doc with the attribute exists. Check if a doc exists at the current path.
    const existingId = await this.getDocIdByHPath(hPath);
    if (existingId) {
      const attrs = await api.getBlockAttrs(existingId);
      const hasOtherMonthly = Object.keys(attrs).some(k => k.startsWith('custom-calendar-monthly-') && k !== attrName);
      if (hasOtherMonthly) {
        // This doc belongs to a different month. Create a new doc for this month.
        const newId = await api.createDocWithMd(this.id, hPath, '');
        await this.applyTemplate(newId, monthlyTemplatePath.value);
        await setCustomMonthlyAttr(newId, monthKey);
        return newId;
      }
      await this.applyTemplateIfDocEmpty(existingId, monthlyTemplatePath.value);
      await setCustomMonthlyAttr(existingId, monthKey);
      return existingId;
    }

    const docID = await api.createDocWithMd(this.id, hPath, '');
    await this.applyTemplate(docID, monthlyTemplatePath.value);
    await setCustomMonthlyAttr(docID, monthKey);
    return docID;
  }

  async getYearlySavePath(date: Date) {
    const pathPattern = String(yearlyPath.value || '').trim();
    if (!pathPattern) {
      throw new Error('yearlyPath is required when yearly notes are enabled');
    }
    return this.renderPathPattern(pathPattern, date, {
      year: dayjs(date).format('YYYY'),
      yearly: dayjs(date).format('YYYY'),
    });
  }

  async getExistYearlyNote(date: Date): Promise<string | undefined> {
    const hPath = await this.getYearlySavePath(date);
    return this.getDocIdByHPath(hPath);
  }

  async createYearlyNote(date: Date): Promise<string> {
    const hPath = await this.getYearlySavePath(date);
    const inFlight = this.yearlyCreationLocks.get(hPath);
    if (inFlight) {
      return inFlight;
    }

    const operation = this.createYearlyNoteOnce(hPath, date);
    this.yearlyCreationLocks.set(hPath, operation);
    try {
      return await operation;
    } finally {
      if (this.yearlyCreationLocks.get(hPath) === operation) {
        this.yearlyCreationLocks.delete(hPath);
      }
    }
  }

  private async createYearlyNoteOnce(hPath: string, date: Date): Promise<string> {
    // Attribute is the source of truth. If a doc with this year's attribute exists, reuse it.
    const yearKey = dayjs(date).format('YYYY');
    const attrName = `custom-calendar-yearly-${yearKey}`;
    const results = await api.sql(
      `SELECT id FROM blocks WHERE type='d' AND box = '${this.id}' AND id IN (SELECT block_id FROM attributes WHERE name = '${attrName}')`
    );
    if (results && results.length > 0) {
      const attrId = results[0].id;
      await this.applyTemplateIfDocEmpty(attrId, yearlyTemplatePath.value);
      return attrId;
    }

    // No doc with the attribute exists. Check if a doc exists at the current path.
    const existingId = await this.getDocIdByHPath(hPath);
    if (existingId) {
      const attrs = await api.getBlockAttrs(existingId);
      const hasOtherYearly = Object.keys(attrs).some(k => k.startsWith('custom-calendar-yearly-') && k !== attrName);
      if (hasOtherYearly) {
        // This doc belongs to a different year. Create a new doc for this year.
        const newId = await api.createDocWithMd(this.id, hPath, '');
        await this.applyTemplate(newId, yearlyTemplatePath.value);
        await setCustomYearlyAttr(newId, yearKey);
        return newId;
      }
      await this.applyTemplateIfDocEmpty(existingId, yearlyTemplatePath.value);
      await setCustomYearlyAttr(existingId, yearKey);
      return existingId;
    }

    const docID = await api.createDocWithMd(this.id, hPath, '');
    await this.applyTemplate(docID, yearlyTemplatePath.value);
    await setCustomYearlyAttr(docID, yearKey);
    return docID;
  }

  async ensurePeriodNotes(date: Date, includeWeekly = true): Promise<void> {
    // Create yearly/monthly first so their paths can safely be parents of daily paths
    // (e.g. yearly: /daily note/{{now | date "2006"}}, monthly: /daily note/{{now | date "2006/01"}}/...)
    if (yearlyEnabled.value) {
      await this.createYearlyNote(date);
    }
    if (monthlyEnabled.value) {
      await this.createMonthlyNote(date);
    }
    // Weekly may sit on an ancestor of the daily path. Creating a daily note can
    // auto-create that parent as an empty shell without the weekly template.
    // Ensure weekly here (create or backfill template if empty) so path overlap
    // does not permanently skip weekly template rendering.
    await this.refreshWeeklyPathOverlap(date);
    if ((includeWeekly || autoCreateWeeklyForced.value) && weeklyEnabled.value && String(weeklyPath.value || '').trim()) {
      await this.createWeeklyNote(date);
    }
  }

  /**
   * Scan all documents in the notebook and backfill missing periodic note attributes.
   * Only processes documents whose hpath matches the configured path patterns.
   * Returns counts of { weekly, monthly, yearly } notes backfilled.
   */
  async backfillPeriodicNoteAttrs(): Promise<{ weekly: number; monthly: number; yearly: number }> {
    const counts = { weekly: 0, monthly: 0, yearly: 0 };

    // Attribute writes are handled by SiYuan's transaction layer. Flush it
    // before taking the snapshot below; otherwise a second immediate run can
    // query the stale attributes index and count the same notes again.
    try {
      await api.request('/api/sqlite/flushTransaction');
    } catch (e) {
      // Continue if this endpoint is unavailable; the normal SQL query remains
      // the best available fallback on older SiYuan versions.
    }

    // One JOIN query fetches every doc together with its periodic-note
    // attributes, so no per-document getBlockAttrs round-trips are needed.
    const rows = await api.sql(
      `SELECT b.id, b.hpath, a.name AS attr_name, a.value AS attr_value FROM blocks b
       LEFT JOIN attributes a ON b.id = a.block_id
       WHERE b.type='d' AND b.box='${this.id}' AND (a.name LIKE 'custom-calendar-%' OR a.name IS NULL)
       ORDER BY b.hpath`
    );
    if (!rows || rows.length === 0) return counts;

    const docAttrs = new Map<string, { hpath: string; attrs: Record<string, string> }>();
    for (const raw of rows) {
      const row = raw as any;
      const id = String(row.id);
      if (!docAttrs.has(id)) {
        docAttrs.set(id, { hpath: String(row.hpath || ''), attrs: {} });
      }
      if (row.attr_name) {
        docAttrs.get(id)!.attrs[String(row.attr_name)] = String(row.attr_value ?? '');
      }
    }

    const weeklyPattern = String(weeklyPath.value || '').trim();
    const monthlyPattern = String(monthlyPath.value || '').trim();
    const yearlyPattern = String(yearlyPath.value || '').trim();

    // Extract base directories (the static prefix before template variables)
    const weeklyBase = this.extractBaseDir(weeklyPattern);
    const monthlyBase = this.extractBaseDir(monthlyPattern);
    const yearlyBase = this.extractBaseDir(yearlyPattern);

    // Collect all existing period keys to avoid creating duplicates.
    const existingWeeklyKeys = new Set<string>();
    const existingMonthlyKeys = new Set<string>();
    const existingYearlyKeys = new Set<string>();
    for (const { attrs } of docAttrs.values()) {
      for (const key of Object.keys(attrs)) {
        if (key.startsWith('custom-calendar-weekly-')) {
          existingWeeklyKeys.add(key.slice('custom-calendar-weekly-'.length));
        } else if (key.startsWith('custom-calendar-monthly-')) {
          existingMonthlyKeys.add(key.slice('custom-calendar-monthly-'.length));
        } else if (key.startsWith('custom-calendar-yearly-')) {
          existingYearlyKeys.add(key.slice('custom-calendar-yearly-'.length));
        }
      }
    }

    const activeRule = effectiveWeekRule.value;

    // The initial SQL snapshot can lag behind an attribute write. For each
    // path hit, verify the exact target attribute through the block-attribute
    // API before deciding whether this run should count a backfill.
    const hasExactAttr = async (docID: string, attrName: string): Promise<boolean> => {
      try {
        const attrs = await api.getBlockAttrs(docID);
        return Object.prototype.hasOwnProperty.call(attrs || {}, attrName);
      } catch (e) {
        // Preserve the previous best-effort behavior when the API is unavailable.
        return false;
      }
    };

    // First try the same date-to-path lookup used by the calendar itself. This
    // is more reliable than extracting values from arbitrary filenames and
    // covers notes created since the plugin was first published. Start from the
    // complete week containing 2025-01-01 so the boundary week is included,
    // and continue through the complete current week.
    if (weeklyPattern) {
      const startDay = ((Number(weekStart.value) % 7) + 7) % 7;
      const firstDate = dayjs('2025-01-01');
      const daysToSubtract = (firstDate.day() - startDay + 7) % 7;
      let cursor = firstDate.subtract(daysToSubtract, 'day').startOf('day');
      const today = dayjs().startOf('day');
      const daysToAdd = (startDay + 6 - today.day() + 7) % 7;
      const lastDate = today.add(daysToAdd, 'day');

      while (cursor.valueOf() <= lastDate.valueOf()) {
        // Any date in the row is sufficient; use its representative day to
        // make the intended weekly identity explicit.
        const repDay = cursor.add(3, 'day');
        const weekKey = getWeekIsoKey(repDay.toDate(), startDay);

        if (!existingWeeklyKeys.has(weekKey)) {
          try {
            // getExistWeeklyNote checks attributes first, then canonical and
            // legacy paths. A path hit also performs best-effort backfilling.
            // Disable getExistWeeklyNote's automatic backfill here so the
            // count reflects whether this invocation actually added the attr.
            const docID = await this.getExistWeeklyNote(repDay.toDate(), false);
            if (docID && !existingWeeklyKeys.has(weekKey)) {
              const attrName = `custom-calendar-weekly-${weekKey}`;
              if (await hasExactAttr(docID, attrName)) {
                existingWeeklyKeys.add(weekKey);
              } else {
                // Ensure the write is completed before recording the key/count.
                await setCustomWeeklyAttr(docID, weekKey);
                existingWeeklyKeys.add(weekKey);
                counts.weekly++;
              }
            }
          } catch (e) {
            // Continue with the regex fallback if an individual path lookup or
            // attribute write fails.
            console.warn('[backfillAttrs] weekly path lookup failed', repDay.format('YYYY-MM-DD'), e);
          }
        }

        cursor = cursor.add(7, 'day');
      }
    }

    // Apply the same path-first strategy to monthly notes. Iterate from
    // 2025-01 through the current month so ordinary configured paths are
    // resolved by the exact renderer rather than inferred from filenames.
    if (monthlyPattern) {
      let cursor = dayjs('2025-01-01').startOf('month');
      const lastMonth = dayjs().startOf('month');
      while (cursor.valueOf() <= lastMonth.valueOf()) {
        const monthKey = cursor.format('YYYYMM');
        if (!existingMonthlyKeys.has(monthKey)) {
          try {
            const hPath = await this.getMonthlySavePath(cursor.toDate());
            const docID = await this.getDocIdByHPath(hPath);
            if (docID && !existingMonthlyKeys.has(monthKey)) {
              const attrName = `custom-calendar-monthly-${monthKey}`;
              if (await hasExactAttr(docID, attrName)) {
                existingMonthlyKeys.add(monthKey);
              } else {
                await setCustomMonthlyAttr(docID, monthKey);
                existingMonthlyKeys.add(monthKey);
                counts.monthly++;
              }
            }
          } catch (e) {
            console.warn('[backfillAttrs] monthly path lookup failed', monthKey, e);
          }
        }
        cursor = cursor.add(1, 'month');
      }
    }

    // Apply the same path-first strategy to yearly notes. Iterate from 2025
    // through the current year, then let the regex fallback handle older or
    // otherwise unusual paths.
    if (yearlyPattern) {
      let cursor = dayjs('2025-01-01').startOf('year');
      const lastYear = dayjs().startOf('year');
      while (cursor.valueOf() <= lastYear.valueOf()) {
        const yearKey = cursor.format('YYYY');
        if (!existingYearlyKeys.has(yearKey)) {
          try {
            const hPath = await this.getYearlySavePath(cursor.toDate());
            const docID = await this.getDocIdByHPath(hPath);
            if (docID && !existingYearlyKeys.has(yearKey)) {
              const attrName = `custom-calendar-yearly-${yearKey}`;
              if (await hasExactAttr(docID, attrName)) {
                existingYearlyKeys.add(yearKey);
              } else {
                await setCustomYearlyAttr(docID, yearKey);
                existingYearlyKeys.add(yearKey);
                counts.yearly++;
              }
            }
          } catch (e) {
            console.warn('[backfillAttrs] yearly path lookup failed', yearKey, e);
          }
        }
        cursor = cursor.add(1, 'year');
      }
    }

    // Backfill docs that match the path pattern and don't conflict with existing periods.
    for (const [id, { hpath, attrs }] of docAttrs.entries()) {
      if (!hpath) continue;

      const hasWeekly = Object.keys(attrs).some(k => k.startsWith('custom-calendar-weekly-'));
      const hasMonthly = Object.keys(attrs).some(k => k.startsWith('custom-calendar-monthly-'));
      const hasYearly = Object.keys(attrs).some(k => k.startsWith('custom-calendar-yearly-'));

      // Try to match against weekly pattern
      if (!hasWeekly && weeklyPattern) {
        // If weeklyBase is null, the path is fully dynamic - use regex-based detection
        const pathMatches = weeklyBase === null || hpath.startsWith(weeklyBase);
        if (pathMatches) {
          const weekKey = this.extractWeekKeyFromPath(hpath, activeRule);
          if (weekKey && !existingWeeklyKeys.has(weekKey)) {
            await setCustomWeeklyAttr(id, weekKey);
            existingWeeklyKeys.add(weekKey); // prevent duplicates within this run
            counts.weekly++;
          }
        }
      }

      // Monthly pattern
      if (!hasMonthly && monthlyPattern) {
        const pathMatches = monthlyBase === null || hpath.startsWith(monthlyBase);
        if (pathMatches) {
          const monthKey = this.extractMonthKeyFromPath(hpath);
          if (monthKey && !existingMonthlyKeys.has(monthKey)) {
            await setCustomMonthlyAttr(id, monthKey);
            existingMonthlyKeys.add(monthKey);
            counts.monthly++;
          }
        }
      }

      // Yearly pattern
      if (!hasYearly && yearlyPattern) {
        const pathMatches = yearlyBase === null || hpath.startsWith(yearlyBase);
        if (pathMatches) {
          const yearKey = this.extractYearKeyFromPath(hpath);
          if (yearKey && !existingYearlyKeys.has(yearKey)) {
            await setCustomYearlyAttr(id, yearKey);
            existingYearlyKeys.add(yearKey);
            counts.yearly++;
          }
        }
      }
    }

    try {
      // Make the newly written attributes visible to a subsequent immediate
      // invocation as well as to the calendar's next SQL refresh.
      await api.request('/api/sqlite/flushTransaction');
    } catch (e) {
      // Best effort only; attribute writes have already completed individually.
    }
    return counts;
  }

  /**
   * Extract the base directory from a path pattern by removing template variables.
   * E.g. "/Daily Notes/{{now | date "2006/01"}}/{{now | date "2006"}}-W{{weekly}}"
   *      -> "/Daily Notes"
   * If the pattern starts with a template variable (fully dynamic), returns null
   * to signal that path filtering should be skipped.
   */
  private extractBaseDir(pattern: string): string | null {
    if (!pattern) return null;
    // Find the first template variable {{...}} and return everything before it
    const match = pattern.match(/^([^{]*)/);
    if (match && match[1] && match[1].trim()) {
      // Normalize: remove surrounding slashes; if only a bare "/" remains there
      // is no real static prefix (e.g. "/{{ ... }}" fully dynamic paths).
      const cleaned = match[1].trim().replace(/^\/+|\/+$/g, '');
      if (!cleaned) return null;
      return '/' + cleaned;
    }
    // Pattern starts with {{ or is fully dynamic - no static prefix
    return null;
  }

  private extractWeekKeyFromPath(hpath: string, rule: 'calendar' | 'iso'): string | null {
    // Method 1: YYYY-W## format. Only trust the number as an ISO week key when the
    // ISO rule is active. Under the calendar rule the number in the path is a
    // calendar week number which cannot be reliably mapped to an ISO key from the
    // path alone (e.g. the cross-year week renders as /2026-W1 but its ISO key is
    // 202653). Such notes are still backfilled correctly when opened via the
    // path fallback in getExistWeeklyNote.
    if (rule === 'iso') {
      const weekMatch = hpath.match(/(\d{4})-w(\d{1,2})/i);
      if (weekMatch) {
        const year = weekMatch[1];
        const week = weekMatch[2].padStart(2, '0');
        return `${year}${week}`;
      }
    }

    // Method 2: Extract from date range format like /2026/202608/0810-0816
    // Pattern: YYYY/YYYYMM/MMDD-MMDD (path contains an explicit start date, so the
    // ISO key can be derived unambiguously regardless of the numbering rule).
    const rangeMatch = hpath.match(/\/(\d{4})\/\d{6}\/(\d{2})(\d{2})-(\d{2})(\d{2})/);
    if (rangeMatch) {
      const year = parseInt(rangeMatch[1], 10);
      const startMonth = parseInt(rangeMatch[2], 10);
      const startDay = parseInt(rangeMatch[3], 10);
      // Use the start date of the range to compute the week
      try {
        const date = new Date(year, startMonth - 1, startDay);
        if (!isNaN(date.getTime())) {
          return getWeekIsoKey(date, Number(weekStart.value));
        }
      } catch (e) {
        // invalid date, skip
      }
    }

    return null;
  }

  private extractMonthKeyFromPath(hpath: string): string | null {
    // Extract YYYYMM from paths like /Daily Notes/2026-12 or /2026/12
    const match = hpath.match(/(\d{4})[-\/](\d{2})(?![-\/]\d)/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
    return null;
  }

  private extractYearKeyFromPath(hpath: string): string | null {
    // Extract YYYY from paths like /Daily Notes/2026 (but not /2026/12 or /2026-12-01)
    const match = hpath.match(/\/(\d{4})$/);
    if (match) {
      return match[1];
    }
    return null;
  }
}
