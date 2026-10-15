// Study habit: today's count against the daily goal, the day streak and what comes back tomorrow. Days are local days.

import { DAY, dayKey, type SkillState } from './model';

export const DEFAULT_DAILY_GOAL = 20;
export const MIN_DAILY_GOAL = 1;
export const MAX_DAILY_GOAL = 200;

/** Local midnight `days` after the day of `at` (built from the calendar fields, so a clock change cannot shift it). */
function dayStart(at: number, days = 0): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Answers given on the local day of `now`. */
export function todayCount(history: { at: number }[], now: number): number {
  const today = dayKey(now);
  return history.filter((h) => dayKey(h.at) === today).length;
}

/**
 * Consecutive local days, up to today, with at least `minPerDay` answers. A today still short of that does not
 * break a streak that ended yesterday. ponytail: counts only what the capped history holds (the last 4000 answers).
 */
export function dayStreak(history: { at: number }[], now: number, minPerDay = 1): number {
  const min = Math.max(1, minPerDay);
  const perDay = new Map<string, number>();
  for (const h of history) perDay.set(dayKey(h.at), (perDay.get(dayKey(h.at)) ?? 0) + 1);
  const met = (offset: number) => (perDay.get(dayKey(dayStart(now, offset))) ?? 0) >= min;
  let offset = met(0) ? 0 : -1;
  let n = 0;
  for (; met(offset); offset--) n++;
  return n;
}

/** Skills that will be due by the end of tomorrow, those already due included. */
export function tomorrowDue(states: Record<string, SkillState>, now: number): number {
  const end = dayStart(now, 2);
  return Object.values(states).filter((s) => s.dueAt !== undefined && s.dueAt < end).length;
}

/** A date as the date input writes it (YYYY-MM-DD), as a local date; null if it is not a real day. */
function parseDay(s: unknown): Date | null {
  const m = typeof s === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = new Date(y, mo - 1, d);
  return day.getFullYear() === y && day.getMonth() === mo - 1 && day.getDate() === d ? day : null;
}

export const isExamDate = (s: unknown): s is string => parseDay(s) !== null;

/** Whole local days from today to `examDate` (0 on the day itself); null if the date is not valid or already past. */
export function daysUntil(examDate: string, now: number): number | null {
  const day = parseDay(examDate);
  if (!day) return null;
  const n = Math.round((day.getTime() - dayStart(now)) / DAY); // rounded: a clock change makes a day 23 or 25 h
  return n < 0 ? null : n;
}
