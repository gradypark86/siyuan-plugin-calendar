import dayjs, { type Dayjs, type ConfigType } from 'dayjs';

/**
 * Calendar week number used by this plugin (same algorithm as Calendar.vue).
 * Uses the last day of the week that contains `date`, based on weekStart
 * (0 = Sunday … 6 = Saturday), then ceil(dayOfYear / 7).
 */
export function getCalendarWeekNum(
  date: ConfigType,
  weekStart: number = 1
): number {
  const d = dayjs(date);
  const start = ((Number(weekStart) % 7) + 7) % 7;

  // Align to the start of the week containing `date`, then take the week end.
  const dayOfWeek = d.day(); // 0-6 Sun-Sat
  const daysFromStart = (dayOfWeek - start + 7) % 7;
  const weekStartDate = d.subtract(daysFromStart, 'day').startOf('day');
  const weekEndDay: Dayjs = weekStartDate.add(6, 'day');

  const yearStart = weekEndDay.startOf('year');
  const dayOfYear = weekEndDay.diff(yearStart, 'day') + 1;
  return Math.ceil(dayOfYear / 7);
}

export type WeekRule = 'calendar' | 'iso';

/**
 * ISO 8601 week number. The week containing `date` belongs to the year of its
 * Thursday; week 1 is the week containing the first Thursday (i.e. Jan 4).
 * Returns the ISO year together with the week so callers can use the correct
 * year (e.g. in note paths) for boundary weeks around New Year.
 */
export function getIsoWeekNum(date: ConfigType): { year: number; week: number } {
  const d = dayjs(date);
  // Monday of the week containing `date`.
  const monday = d.subtract((d.day() + 6) % 7, 'day');
  const thursday = monday.add(3, 'day');
  const year = thursday.year();
  const jan4 = dayjs(`${year}-01-04`);
  const firstWeekStart = jan4.subtract((jan4.day() + 6) % 7, 'day');
  const week = Math.floor(thursday.diff(firstWeekStart, 'day') / 7) + 1;
  return { year, week };
}

/**
 * Week number under the active rule.
 * - 'calendar': year = calendar year of `date`, week = getCalendarWeekNum.
 * - 'iso': ISO 8601 year + week of the week containing `date`.
 */
export function getWeekInfo(
  date: ConfigType,
  rule: WeekRule,
  weekStart: number = 1
): { year: number; week: number } {
  const d = dayjs(date);
  if (rule === 'iso') {
    return getIsoWeekNum(d);
  }
  return { year: d.year(), week: getCalendarWeekNum(d, weekStart) };
}

/**
 * Stable identity "YYYYWW" of the week row containing `date`, taken from the
 * ISO week of the row's representative day (weekStart + 3, e.g. the Thursday
 * when the week starts on Monday). Rule-independent, so weekly-note attributes
 * keep the same key even if the display numbering rule changes.
 */
export function getWeekIsoKey(date: ConfigType, weekStart: number = 1): string {
  const d = dayjs(date);
  const start = ((Number(weekStart) % 7) + 7) % 7;
  const daysFromStart = (d.day() - start + 7) % 7;
  const rep = d.subtract(daysFromStart, 'day').add(3, 'day');
  const iso = getIsoWeekNum(rep);
  return `${iso.year}${String(iso.week).padStart(2, '0')}`;
}
