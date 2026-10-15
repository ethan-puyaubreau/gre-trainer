// Study habit: today's count against the daily goal, the day streak and what comes back tomorrow. Days are local days.

import { dayKey, type SkillState } from './model';

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
