import { describe, expect, it } from 'vitest';
import { DAY, newSkillState, type SkillState } from '../src/mastery/model';
import { dropWeakFlags, migrateProgress, migrateStyleCredits } from '../src/store/migrate';
import { initialData, useProgress, type ProgressData } from '../src/store/progress';

describe('progress migration', () => {
  it('starts from zero: no skill is pre-flagged', () => {
    expect(initialData().skills).toEqual({});
  });

  it('removes unanswered flagged skills and keeps the answered ones without the flag', () => {
    const data = initialData();
    data.skills = {
      'arith.primes': { ...newSkillState(), level: 1, flagged: true } as never,
      'arith.roots': { ...newSkillState(), level: 2, attempts: 3, correct: 2, flagged: true } as never,
      'alg.linear': { ...newSkillState(), level: 3, attempts: 5 },
    };
    const out = dropWeakFlags(data).skills;
    expect(Object.keys(out).sort()).toEqual(['alg.linear', 'arith.roots']);
    expect(out['arith.roots']).toEqual({ ...newSkillState(), level: 2, attempts: 3, correct: 2 });
  });
});

describe('v2 -> v3: credits by difficulty and format', () => {
  const T = new Date(2026, 9, 10, 9, 0).getTime();
  const NE = 'arith.ratios.change-ne';
  const MCS = 'arith.ratios.combine-mcs';
  /** A skill as version 2 saved it. */
  const v2 = (over: object = {}) => ({
    level: 3,
    attempts: 9,
    correct: 7,
    styles: [NE, MCS, 'gone.template'],
    days: ['2026-10-09', '2026-10-10'],
    difficulty: 2,
    streak: 1,
    lastAt: T,
    reviewStage: 0,
    timeMs: 1000,
    ...over,
  });
  const withSkills = (skills: object) => ({ ...initialData(), skills }) as unknown as ProgressData;

  it('turns the style list into difficulty-2 credits with their formats', () => {
    const out = migrateStyleCredits(withSkills({ a: v2({ level: 4, dueAt: T + 3 * DAY }) })).skills.a;
    expect(out).toEqual({
      level: 4,
      attempts: 9,
      correct: 7,
      styles: { [NE]: 2, [MCS]: 2 },
      styleFormats: { [NE]: 'ne', [MCS]: 'mcs' },
      formats: ['ne', 'mcs'],
      firstCreditAt: T - DAY,
      recent: [],
      provisional: true,
      difficulty: 2,
      streak: 1,
      lastAt: T,
      dueAt: T + 3 * DAY,
      reviewStage: 0,
      timeMs: 1000,
    });
    expect('days' in out).toBe(false);
  });

  it('starts the retention clock at the last answer when the credits are from a single day', () => {
    const { b, c } = migrateStyleCredits(withSkills({ b: v2({ styles: [MCS], days: ['2026-10-10'] }), c: v2({ level: 1, styles: [], days: [] }) })).skills;
    expect(b.firstCreditAt).toBe(T);
    expect(b.provisional).toBeUndefined();
    expect(c.styles).toEqual({});
    expect(c.firstCreditAt).toBeUndefined(); // nothing credited, nothing to time
  });

  it('leaves skills already in the new shape alone', () => {
    const st: SkillState = { ...newSkillState(), level: 2, styles: { [NE]: 3 }, styleFormats: { [NE]: 'ne' }, formats: ['ne'], recent: [true] };
    expect(migrateStyleCredits(withSkills({ x: st })).skills.x).toEqual(st);
  });

  it('chains the version 1 and 2 migrations when loading saved progress', () => {
    const v1 = migrateProgress(withSkills({ a: { ...v2(), flagged: true }, b: { ...v2(), attempts: 0, flagged: true } }), 1);
    expect(Object.keys(v1.skills)).toEqual(['a']);
    expect(v1.skills.a.styles).toEqual({ [NE]: 2, [MCS]: 2 });
    expect(migrateProgress(withSkills({ a: v2() }), 2).skills.a.formats).toEqual(['ne', 'mcs']);
    expect(() => migrateProgress(withSkills({ a: null, b: 5 }), 2)).not.toThrow();
  });

  it('migrates an imported export in the old shape', () => {
    useProgress.getState().importData(withSkills({ a: v2() }));
    expect(useProgress.getState().skills.a.styles).toEqual({ [NE]: 2, [MCS]: 2 });
    expect(useProgress.getState().skills.a.recent).toEqual([]);
  });
});
