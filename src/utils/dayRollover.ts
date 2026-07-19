import dayjs, { type Dayjs } from 'dayjs';
import { dayRolloverHour, dayRolloverMinute } from '@/hooks/useSiYuan';

/**
 * Normalize day-rollover hour to integer 0-23.
 * Invalid values fall back to 0 (midnight).
 */
export function normalizeDayRolloverHour(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const hour = Math.trunc(n);
  if (hour < 0 || hour > 23) return 0;
  return hour;
}

/**
 * Normalize day-rollover minute to integer 0-59.
 * Invalid values fall back to 0.
 */
export function normalizeDayRolloverMinute(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const minute = Math.trunc(n);
  if (minute < 0 || minute > 59) return 0;
  return minute;
}

/**
 * Whether a raw hour input is valid (integer 0-23).
 */
export function isValidDayRolloverHour(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return false;
  return n >= 0 && n <= 23;
}

/**
 * Whether a raw minute input is valid (integer 0-59).
 */
export function isValidDayRolloverMinute(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return false;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return false;
  return n >= 0 && n <= 59;
}

/**
 * Return the "effective now" used for daily-note day boundaries.
 * If the current local time is earlier than dayRolloverHour:dayRolloverMinute,
 * treat it as still the previous day.
 *
 * Example: rollover = 02:30, now = 2026-07-19 01:45 → effective date is 2026-07-18.
 */
export function getEffectiveNow(base: Date | Dayjs | number = new Date()): Dayjs {
  const now = dayjs(base);
  const hour = normalizeDayRolloverHour(dayRolloverHour.value);
  const minute = normalizeDayRolloverMinute(dayRolloverMinute.value);
  const rolloverMinutes = hour * 60 + minute;
  if (rolloverMinutes <= 0) {
    return now;
  }
  const currentMinutes = now.hour() * 60 + now.minute();
  if (currentMinutes < rolloverMinutes) {
    return now.subtract(1, 'day');
  }
  return now;
}

/**
 * Effective "today" as a native Date (local calendar date of getEffectiveNow).
 */
export function getEffectiveToday(base: Date | Dayjs | number = new Date()): Date {
  return getEffectiveNow(base).startOf('day').toDate();
}
