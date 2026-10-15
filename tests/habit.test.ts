import { describe, expect, it } from 'vitest';
import { dayStreak, todayCount, tomorrowDue } from '../src/mastery/habit';
import { newSkillState, type SkillState } from '../src/mastery/model';

/** Local time: month is 1-based. */
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const NOW = at(2026, 10, 15, 14);
/** One answer at noon, `ago` days before NOW. */
const day = (ago: number, n = 1) => Array.from({ length: n }, () => ({ at: at(2026, 10, 15 - ago) }));

describe('todayCount', () => {
  it('counts the local day only, from midnight to the last minute', () => {
    const h = [{ at: at(2026, 10, 14, 23, 59) }, { at: at(2026, 10, 15, 0, 0) }, { at: at(2026, 10, 15, 23, 59) }, { at: at(2026, 10, 16, 0, 0) }];
    expect(todayCount(h, NOW)).toBe(2);
    expect(todayCount([], NOW)).toBe(0);
  });
});

describe('dayStreak', () => {
  it('is 0 with no answers and 1 with today only', () => {
    expect(dayStreak([], NOW)).toBe(0);
    expect(dayStreak(day(0), NOW)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(dayStreak([...day(0), ...day(1, 3), ...day(2)], NOW)).toBe(3);
  });

  it('keeps a streak that ended yesterday while today is still empty', () => {
    expect(dayStreak([...day(1), ...day(2)], NOW)).toBe(2);
  });

  it('is broken by a missed day, and 0 once yesterday is missed too', () => {
    expect(dayStreak([...day(0), ...day(2), ...day(3)], NOW)).toBe(1);
    expect(dayStreak([...day(2), ...day(3)], NOW)).toBe(0);
  });

  it('counts only the days that reach minPerDay, and today short of it does not break the streak', () => {
    const h = [...day(0, 1), ...day(1, 3), ...day(2, 2), ...day(3, 1)];
    expect(dayStreak(h, NOW, 2)).toBe(2);
    expect(dayStreak(h, NOW, 1)).toBe(4);
    expect(dayStreak([...day(0, 2), ...day(1, 1)], NOW, 2)).toBe(1);
  });

  it('treats a minimum below 1 as 1 instead of looping', () => {
    expect(dayStreak([], NOW, 0)).toBe(0);
    expect(dayStreak(day(0), NOW, -3)).toBe(1);
  });

  it('crosses a month and a year end', () => {
    const mar = at(2026, 3, 2);
    expect(dayStreak([{ at: mar }, { at: at(2026, 3, 1) }, { at: at(2026, 2, 28) }], mar)).toBe(3);
    const jan = at(2027, 1, 1, 9);
    expect(dayStreak([{ at: jan }, { at: at(2026, 12, 31, 23, 59) }, { at: at(2026, 12, 30) }], jan)).toBe(3);
  });

  it('splits days at local midnight', () => {
    expect(dayStreak([{ at: at(2026, 10, 14, 23, 59) }, { at: at(2026, 10, 15, 0, 1) }], NOW)).toBe(2);
  });
});

describe('tomorrowDue', () => {
  const due = (dueAt?: number): SkillState => ({ ...newSkillState(), dueAt });

  it('counts what is already due and what falls before the end of tomorrow', () => {
    const states = {
      none: due(),
      overdue: due(at(2026, 10, 1)),
      later: due(at(2026, 10, 15, 22)),
      tomorrowLate: due(at(2026, 10, 16, 23, 59)),
      dayAfter: due(at(2026, 10, 17, 0, 0)),
      far: due(at(2026, 12, 1)),
    };
    expect(tomorrowDue(states, NOW)).toBe(3);
    expect(tomorrowDue({}, NOW)).toBe(0);
  });
});
