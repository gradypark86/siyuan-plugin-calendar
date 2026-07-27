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
