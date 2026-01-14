import dayjs from 'dayjs';
import * as api from '@/api/api';
import { setCustomDNAttr } from '@/api/daily-note';
import { weeklyPath, weeklyTemplatePath } from '@/hooks/useSiYuan';

export class CusNotebook implements Notebook, NotebookConf {
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

  async getExistDailyNote(date: Date): Promise<DailyNote[] | undefined> {
    const month = dayjs(date).format('YYYYMM');
    const condition = `id IN (SELECT block_id FROM attributes AS a WHERE a.name like 'custom-dailynote-${month}__') `;
    const dailyNotes = await this.searchDailyNote(condition);
    if (!dailyNotes.length) {
      return;
    }
    const result = [];
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
    if (this.dailyNoteTemplatePath.length) {
      const res = await api.render(docID, this.dailyNoteTemplatePath);
      if (res && res.content) {
        await api.prependBlock('dom', res.content, docID);
      }
    }
    setCustomDNAttr(docID, date); //为新建的日记添加自定义属性
    return { id: docID, dateStr };
  }

  async getWeeklySavePath(date: Date, weekNum: number) {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    let pathPattern = weeklyPath.value || '/Daily Notes/Weekly/{{now "2006-01-02"}}';
    
    // Replace {{weekly}} first
    pathPattern = pathPattern.replace(/\{\{weekly\}\}/g, weekNum.toString());

    // Replace now with toDate for the representative date
    pathPattern = pathPattern.replace(/\{\{(.*?)\}\}/g, match =>
      match.replace(/\bnow\b(?=(?:(?:[^"]*"){2})*[^"]*$)/g, `(toDate "2006-01-02" "${dateStr}")`)
    );
    return api.renderSprig(pathPattern);
  }

  async getExistWeeklyNote(date: Date, weekNum: number): Promise<string | undefined> {
    const hPath = await this.getWeeklySavePath(date, weekNum);
    const results = await api.sql(`SELECT id FROM blocks WHERE type='d' AND box = '${this.id}' AND hpath = '${hPath}'`);
    if (results && results.length > 0) {
      return results[0].id;
    }
    return undefined;
  }

  async createWeeklyNote(date: Date, weekNum: number): Promise<string> {
    const hPath = await this.getWeeklySavePath(date, weekNum);
    const existingId = await this.getExistWeeklyNote(date, weekNum);
    if (existingId) return existingId;

    const docID = await api.createDocWithMd(this.id, hPath, '');
    if (weeklyTemplatePath.value) {
      const system = await api.request('/api/system/getConf');
      let tplPath = weeklyTemplatePath.value;
      // Handle relative path to templates directory
      if (!tplPath.includes(':') && !tplPath.startsWith('\\\\')) {
        const dataDir = system.conf.system.dataDir;
        if (!tplPath.startsWith('/') && !tplPath.startsWith('\\')) {
          tplPath = '/' + tplPath;
        }
        tplPath = dataDir + '/templates' + tplPath;
      }
      
      const res = await api.render(docID, tplPath);
      if (res && res.content) {
        await api.prependBlock('dom', res.content, docID);
      }
    }
    return docID;
  }
}
