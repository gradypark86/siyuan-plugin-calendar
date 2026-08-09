import dayjs from 'dayjs';
import * as api from '@/api/api';
import { setCustomDNAttr } from '@/api/daily-note';
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
} from '@/hooks/useSiYuan';
import { getCalendarWeekNum } from '@/utils/weekNum';

export class CusNotebook implements Notebook, NotebookConf {
  private weeklyCreationLocks = new Map<string, Promise<string>>();

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
    if (dailyNoteTemplatePath) {
      const system = await api.request('/api/system/getConf');
      dailyNoteTemplatePath = system.conf.system.dataDir + '/templates' + dailyNoteTemplatePath;
    }
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
    const [dailyNote] = await this.searchDailyNote(`hpath = '${hPath}'`);
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    // 当前日期已有日记却无文档属性，设置后返回日记
    if (dailyNote) {
      const { id } = dailyNote;
      setCustomDNAttr(id, date); //为新建的日记添加自定义属性
      return { id, dateStr };
    }
    // 当前日期无日记，创建日记
    const docID = await api.createDocWithMd(this.id, hPath, '');
    // 根据模板渲染日记
    await this.applyTemplate(docID, this.dailyNoteTemplatePath);
    setCustomDNAttr(docID, date); //为新建的日记添加自定义属性
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

    // Relative path => resolve under workspace/data/templates
    if (!tplPath.includes(':') && !tplPath.startsWith('\\\\')) {
      const system = await api.request('/api/system/getConf');
      const dataDir = system?.conf?.system?.dataDir;
      if (!dataDir) return '';
      if (!tplPath.startsWith('/') && !tplPath.startsWith('\\')) {
        tplPath = '/' + tplPath;
      }
      tplPath = dataDir + '/templates' + tplPath;
    }
    return tplPath;
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

  async getWeeklySavePath(date: Date, weekNum: number) {
    const pathPattern = String(weeklyPath.value || '').trim();
    if (!pathPattern) {
      throw new Error('weeklyPath is required when weekly notes are enabled');
    }
    return this.renderPathPattern(pathPattern, date, {
      weekly: weekNum,
      month: dayjs(date).format('MM'),
      monthly: dayjs(date).format('YYYY-MM'),
      year: dayjs(date).format('YYYY'),
      yearly: dayjs(date).format('YYYY'),
    });
  }

  async getExistWeeklyNote(date: Date, weekNum: number): Promise<string | undefined> {
    const hPath = await this.getWeeklySavePath(date, weekNum);
    return this.getDocIdByHPath(hPath);
  }

  async createWeeklyNote(date: Date, weekNum: number): Promise<string> {
    const hPath = await this.getWeeklySavePath(date, weekNum);
    const inFlight = this.weeklyCreationLocks.get(hPath);
    if (inFlight) {
      return inFlight;
    }

    const operation = this.createWeeklyNoteOnce(hPath);
    this.weeklyCreationLocks.set(hPath, operation);
    try {
      return await operation;
    } finally {
      if (this.weeklyCreationLocks.get(hPath) === operation) {
        this.weeklyCreationLocks.delete(hPath);
      }
    }
  }

  private async createWeeklyNoteOnce(hPath: string): Promise<string> {
    const existingId = await this.getDocIdByHPath(hPath);
    if (existingId) {
      await this.applyTemplateIfDocEmpty(existingId, weeklyTemplatePath.value);
      return existingId;
    }

    const docID = await api.createDocWithMd(this.id, hPath, '');
    await this.applyTemplate(docID, weeklyTemplatePath.value);
    return docID;
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
    const existingId = await this.getExistMonthlyNote(date);
    if (existingId) {
      await this.applyTemplateIfDocEmpty(existingId, monthlyTemplatePath.value);
      return existingId;
    }

    const docID = await api.createDocWithMd(this.id, hPath, '');
    await this.applyTemplate(docID, monthlyTemplatePath.value);
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
    const existingId = await this.getExistYearlyNote(date);
    if (existingId) {
      await this.applyTemplateIfDocEmpty(existingId, yearlyTemplatePath.value);
      return existingId;
    }

    const docID = await api.createDocWithMd(this.id, hPath, '');
    await this.applyTemplate(docID, yearlyTemplatePath.value);
    return docID;
  }

  async ensurePeriodNotes(date: Date, weekNum?: number, includeWeekly = true): Promise<void> {
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
    if (includeWeekly && weeklyEnabled.value && String(weeklyPath.value || '').trim()) {
      const num =
        weekNum != null && Number.isFinite(Number(weekNum))
          ? Number(weekNum)
          : getCalendarWeekNum(date, Number(weekStart.value));
      await this.createWeeklyNote(date, num);
    }
  }
}
