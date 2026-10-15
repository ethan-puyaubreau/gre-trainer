import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import type { Difficulty, Format, Skill, Template } from '../src/engine/types';
import {
  applyAttempt,
  DAY,
  isOnPace,
  newSkillState,
  requirementsFor,
  stylesForMastered,
  type AttemptInput,
  type SkillState,
} from '../src/mastery/model';
import { nextPick, scheduleRepair, type SchedulerInput } from '../src/mastery/scheduler';

const T0 = new Date(2026, 9, 10, 9, 0).getTime();
const H = 60 * 60 * 1000;
const tpl = (id: string, format: Format, skill = 's') => ({ id, skill, format, style: id }) as unknown as Template<any>;

// A 4-style skill: 3 styles needed, 2 formats, numeric entry required since it has one.
const TPLS = [tpl('t1', 'mcs'), tpl('t2', 'qc'), tpl('t3', 'ne'), tpl('t4', 'mcs')];
const REQ = requirementsFor(TPLS);
const FMT: Record<string, Format> = Object.fromEntries(TPLS.map((t) => [t.id, t.format]));

const ans = (templateId: string, at: number, over: Partial<AttemptInput> = {}): AttemptInput => ({
  templateId,
  format: FMT[templateId],
  difficulty: 2,
  correct: true,
  timeMs: 60_000,
  at,
  hintLevel: 0,
  ...over,
});
const miss = (templateId: string, at = T0 + H) => ans(templateId, at, { correct: false });

/** A Proficient state holding these credits, the first one at `firstCreditAt`. */
const proficient = (styles: Record<string, Difficulty>, firstCreditAt = T0): SkillState => ({
  ...newSkillState(),
  level: 3,
  styles,
  styleFormats: Object.fromEntries(Object.keys(styles).map((id) => [id, FMT[id]])),
  formats: [...new Set(Object.keys(styles).map((id) => FMT[id]))],
  firstCreditAt,
});

describe('mastery requirements', () => {
  it('needs two thirds of the styles, between 3 and 6', () => {
    expect([1, 4, 5, 7, 9, 29].map(stylesForMastered)).toEqual([3, 3, 4, 5, 6, 6]);
  });

  it('reads the style count and the formats from the templates', () => {
    expect(REQ).toEqual({ styles: 4, formats: ['mcs', 'qc', 'ne'] });
  });

  it('gives 1.5x the pace at difficulty 3 and always passes timed sections', () => {
    expect(isOnPace(105_000, 2, 105)).toBe(true);
    expect(isOnPace(105_001, 2, 105)).toBe(false);
    expect(isOnPace(157_500, 3, 105)).toBe(true);
    expect(isOnPace(157_501, 3, 105)).toBe(false);
    expect(isOnPace(400_000, 1, 105, true)).toBe(true);
  });
});

describe('mastery model', () => {
  it('masters a 4-style skill with 3 styles, 2 formats including numeric entry, one hard credit and 18 h', () => {
    let s = newSkillState();
    const step = (a: AttemptInput) => (s = applyAttempt(s, a, REQ).state);
    step(ans('t1', T0));
    expect(s.level).toBe(2);
    step(ans('t2', T0 + 60_000));
    expect(s.level).toBe(3);
    expect(s.dueAt).toBe(T0 + 60_000 + 20 * H); // comes back tomorrow for the retention check
    step(ans('t4', T0 + 120_000, { difficulty: 3 }));
    expect(s.level).toBe(3); // 3 styles, 2 formats, a hard credit, but no numeric entry yet
    step(ans('t3', T0 + 180_000));
    expect(s.level).toBe(3); // everything but the 18 h
    step(ans('t3', T0 + 18 * H));
    expect(s.level).toBe(4);
    expect(s.provisional).toBe(true);
    expect(s.dueAt).toBe(T0 + 18 * H + 3 * DAY);
  });

  it.each([
    ['too few styles', { t1: 3 }, 't3'],
    ['no numeric entry', { t1: 3, t2: 2 }, 't4'],
    ['no hard credit', { t1: 2, t2: 2 }, 't3'],
  ] as const)('stays Proficient with %s', (_, styles, last) => {
    expect(applyAttempt(proficient(styles), ans(last, T0 + 18 * H), REQ).state.level).toBe(3);
  });

  it('stays Proficient until 18 h after the first credit', () => {
    const st = proficient({ t1: 3, t2: 2 });
    expect(applyAttempt(st, ans('t3', T0 + 18 * H - 1), REQ).state.level).toBe(3);
    expect(applyAttempt(st, ans('t3', T0 + 18 * H), REQ).state.level).toBe(4);
  });

  it('needs 2 formats, and a production format only when the skill has one', () => {
    const req = requirementsFor([tpl('a1', 'mcs'), tpl('a2', 'mcs'), tpl('a3', 'mcs'), tpl('a4', 'qc')]);
    const st: SkillState = {
      ...newSkillState(),
      level: 3,
      styles: { a1: 3, a2: 2 },
      styleFormats: { a1: 'mcs', a2: 'mcs' },
      formats: ['mcs'],
      firstCreditAt: T0,
    };
    expect(applyAttempt(st, ans('a3', T0 + 18 * H, { format: 'mcs' }), req).state.level).toBe(3);
    expect(applyAttempt(st, ans('a4', T0 + 18 * H, { format: 'qc' }), req).state.level).toBe(4);
  });

  it('credits slow answers but promotes to Mastered only on pace (1.5x at difficulty 3)', () => {
    let s = applyAttempt(newSkillState(), ans('t1', T0, { timeMs: 300_000 }), REQ).state;
    expect(s.styles).toEqual({ t1: 2 });
    s = applyAttempt(s, ans('t2', T0 + 1, { timeMs: 300_000 }), REQ).state;
    expect(s.level).toBe(3); // pace does not gate Proficient
    const ready = proficient({ t1: 3, t2: 2 });
    const slow = applyAttempt(ready, ans('t3', T0 + 18 * H, { timeMs: 106_000 }), REQ);
    expect(slow.state.level).toBe(3);
    expect(slow.state.styles.t3).toBe(2);
    expect(slow.clean).toBe(false);
    expect(applyAttempt(ready, ans('t3', T0 + 18 * H, { difficulty: 3, timeMs: 150_000 }), REQ).state.level).toBe(4);
  });

  it('never credits difficulty 1 and keeps the highest difficulty per style', () => {
    let s = applyAttempt(newSkillState(), ans('t1', T0, { difficulty: 1 }), REQ).state;
    expect(s.level).toBe(2);
    expect(s.styles).toEqual({});
    expect(s.firstCreditAt).toBeUndefined();
    s = applyAttempt(s, ans('t1', T0 + 1, { difficulty: 3 }), REQ).state;
    s = applyAttempt(s, ans('t1', T0 + 2, { difficulty: 2 }), REQ).state;
    expect(s.styles).toEqual({ t1: 3 });
    expect(s.formats).toEqual(['mcs']);
    expect(s.firstCreditAt).toBe(T0 + 1);
  });

  it('cancels the credit only for the full strategy card', () => {
    expect(applyAttempt(newSkillState(), ans('t1', T0, { hintLevel: 3 }), REQ).state.styles).toEqual({});
    expect(applyAttempt(newSkillState(), ans('t1', T0, { hintLevel: 2 }), REQ).state.styles).toEqual({ t1: 2 });
  });

  it('removes only the missed credit on a single miss', () => {
    const st: SkillState = { ...proficient({ t1: 3, t2: 2, t4: 2 }), difficulty: 3, streak: 4, recent: [true, true, true] };
    const s = applyAttempt(st, miss('t2'), REQ).state;
    expect(s.level).toBe(3);
    expect(s.styles).toEqual({ t1: 3, t4: 2 });
    expect(s.styleFormats).toEqual({ t1: 'mcs', t4: 'mcs' });
    expect(s.formats).toEqual(['mcs']);
    expect(s.firstCreditAt).toBeUndefined();
    expect(s.streak).toBe(0);
    expect(s.difficulty).toBe(2);
    expect(s.dueAt).toBe(T0 + H + DAY);
  });

  it('drops Proficient below 2 credits to Familiar, and Mastered to Proficient', () => {
    expect(applyAttempt(proficient({ t1: 3, t2: 2 }), miss('t1'), REQ).state.level).toBe(2);
    const m = applyAttempt({ ...proficient({ t1: 3, t2: 2, t3: 2 }), level: 4, provisional: true }, miss('t1'), REQ).state;
    expect(m.level).toBe(3);
    expect(m.provisional).toBeFalsy();
    expect(m.styles).toEqual({ t2: 2, t3: 2 });
  });

  it('resets every credit on two misses within the last 6 answers', () => {
    const st: SkillState = { ...proficient({ t1: 3, t2: 2, t4: 2 }), recent: [true, false, true, true, true] };
    const s = applyAttempt(st, miss('t1'), REQ).state;
    expect(s.styles).toEqual({});
    expect(s.formats).toEqual([]);
    expect(s.level).toBe(2);
    expect(s.recent).toEqual([]); // the window starts over
    // A miss 6 answers back has left the window: only the missed credit goes.
    const s2 = applyAttempt({ ...st, recent: [false, true, true, true, true, true] }, miss('t1'), REQ).state;
    expect(s2.styles).toEqual({ t2: 2, t4: 2 });
    expect(s2.recent).toEqual([true, true, true, true, true, false]);
    expect(applyAttempt({ ...newSkillState(), level: 2, recent: [false] }, miss('t1'), REQ).state.level).toBe(1);
  });

  it('costs one window at most one level drop: three misses in a row take Mastered to Familiar, not Attempted', () => {
    const mastered: SkillState = { ...proficient({ t1: 3, t2: 2, t3: 2 }), level: 4, recent: [true, true, true, true, true, true] };
    const levels: number[] = [];
    let s = mastered;
    for (const id of ['t1', 't2', 't3', 't4']) {
      s = applyAttempt(s, miss(id), REQ).state;
      levels.push(s.level);
    }
    // 1st miss: Mastered -> Proficient. 2nd: two misses in the window, credits wiped, -1 level and a fresh window.
    // 3rd: one miss in the new window, no further drop. 4th: the new window now holds two misses.
    expect(levels).toEqual([3, 2, 2, 1]);
  });

  it('keeps the last 6 results', () => {
    let s = newSkillState();
    for (let i = 0; i < 8; i++) s = applyAttempt(s, ans('t1', T0 + i, { correct: i !== 4 }), REQ).state;
    expect(s.recent).toEqual([true, true, false, true, true, true]);
  });

  it('confirms a provisional Mastered with a clean on-pace answer once the review is due', () => {
    const st: SkillState = { ...proficient({ t1: 3, t2: 2, t3: 2 }), level: 4, provisional: true, dueAt: T0 + 3 * DAY };
    expect(applyAttempt(st, ans('t1', T0 + DAY), REQ).state.provisional).toBe(true);
    expect(applyAttempt(st, ans('t1', T0 + 3 * DAY, { timeMs: 200_000 }), REQ).state.provisional).toBe(true);
    const ok = applyAttempt(st, ans('t1', T0 + 3 * DAY), REQ).state;
    expect(ok.level).toBe(4);
    expect(ok.provisional).toBeFalsy();
    expect(ok.reviewStage).toBe(1);
    expect(ok.dueAt).toBe(T0 + 10 * DAY);
    expect(applyAttempt(ok, miss('t1', T0 + 4 * DAY), REQ).state.level).toBe(3);
  });

  it('clears the come-back date of a skill in progress once it is answered correctly', () => {
    const st: SkillState = { ...newSkillState(), level: 2, dueAt: T0 };
    expect(applyAttempt(st, ans('t1', T0 - 1), REQ).state.dueAt).toBe(T0);
    expect(applyAttempt(st, ans('t1', T0), REQ).state.dueAt).toBeUndefined();
  });

  it('counts every correct answer of a timed section as on pace', () => {
    const o = applyAttempt(newSkillState(), ans('t1', T0, { timeMs: 400_000, timedSection: true }), REQ);
    expect(o.clean).toBe(true);
  });
});

describe('scheduler', () => {
  const skill = (id: string): Skill => ({ id, area: 'arithmetic', unit: 'U', name: id, summary: '', strategy: '' });
  const skills = [skill('s1'), skill('s2'), skill('s3')];
  const templatesBySkill = new Map(skills.map((s) => [s.id, ['a', 'b', 'c'].map((x) => tpl(`${s.id}.${x}`, 'mcs', s.id))]));
  const base: SchedulerInput = { skills, templatesBySkill, states: {}, remediation: [], seq: 0, now: T0, recentTemplates: [] };

  it('brings a missed skill back in a different style after a few questions', () => {
    const rng = createRng(1);
    const rem = scheduleRepair(rng, 's2', 's2.a', 10);
    expect(rem.dueSeq).toBeGreaterThanOrEqual(12);
    expect(rem.dueSeq).toBeLessThanOrEqual(14);
    for (let i = 0; i < 50; i++) {
      const pick = nextPick(createRng(i), { ...base, remediation: [rem], seq: rem.dueSeq }, { kind: 'smart' })!;
      expect(pick.reason).toBe('repair');
      expect(pick.skillId).toBe('s2');
      expect(pick.templateId).not.toBe('s2.a');
    }
    const early = nextPick(createRng(3), { ...base, remediation: [rem], seq: rem.dueSeq - 1 }, { kind: 'smart' })!;
    expect(early.reason).not.toBe('repair');
  });

  it('prefers styles that are not credited yet', () => {
    const states = { s1: { ...newSkillState(), level: 2 as const, styles: { 's1.a': 2 as const, 's1.b': 3 as const } } };
    for (let i = 0; i < 20; i++) {
      const pick = nextPick(createRng(i), { ...base, states }, { kind: 'skill', skillId: 's1' })!;
      expect(pick.templateId).toBe('s1.c');
    }
  });

  it('serves due reviews in review mode', () => {
    const states = { s3: { ...newSkillState(), level: 4 as const, dueAt: T0 - 1 } };
    const pick = nextPick(createRng(5), { ...base, states }, { kind: 'review' })!;
    expect(pick.skillId).toBe('s3');
  });
});
