import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../src/engine/rng';
import type { Difficulty, Format, Skill, Template } from '../src/engine/types';
import { applyAttempt, DAY, newSkillState, requirementsFor, type Level, type SkillState } from '../src/mastery/model';
import { nextPick, scheduleRepair, type Pick, type SchedulerInput } from '../src/mastery/scheduler';

const T0 = new Date(2026, 9, 10, 9, 0).getTime();
const tpl = (id: string, format: Format, skill: string) => ({ id, skill, format, style: id }) as unknown as Template<any>;
const skill = (id: string): Skill => ({ id, area: 'arithmetic', unit: 'U', name: id, summary: '', strategy: '' });

const IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
const skills = IDS.map(skill);
const templatesBySkill = new Map(skills.map((s) => [s.id, ['a', 'b', 'c'].map((x) => tpl(`${s.id}.${x}`, 'mcs', s.id))]));
const base: SchedulerInput = { skills, templatesBySkill, states: {}, remediation: [], seq: 0, now: T0, recentTemplates: [] };
const SMART = { kind: 'smart' } as const;

/** A skill state at this level that has been answered a few times (so it is not new). */
const at = (level: Level, over: Partial<SkillState> = {}): SkillState => ({ ...newSkillState(), level, attempts: level ? 5 : 0, ...over });

/** A rng that answers v to everything: next() = v, chance(p) is v < p, pick takes the element at v. */
const constRng = (v: number): Rng => ({
  next: () => v,
  int: (min, max) => min + Math.floor(v * (max - min + 1)),
  pick: (items) => items[Math.floor(v * items.length)],
  shuffle: (items) => items.slice(),
  sample: (items, k) => items.slice(0, k),
  chance: (p) => v < p,
  sign: () => (v < 0.5 ? -1 : 1),
});

const picks = (n: number, input: SchedulerInput, scope: Parameters<typeof nextPick>[2] = SMART): Pick[] =>
  Array.from({ length: n }, (_, i) => nextPick(createRng(i + 1), input, scope)!);

describe('serving due reviews first', () => {
  // Two reviews are due, s1 three days late and s2 one hour late; s3 is not started and nothing is in progress.
  const states = { s1: at(4, { dueAt: T0 - 3 * DAY }), s2: at(4, { dueAt: T0 - 3_600_000 }), s3: at(0) };
  const input = { ...base, skills: skills.slice(0, 3), states };

  it('serves the most overdue review when the 60% roll succeeds', () => {
    for (const v of [0, 0.3, 0.59]) {
      const pick = nextPick(constRng(v), input, SMART)!;
      expect([pick.skillId, pick.reason]).toEqual(['s1', 'review']);
    }
  });

  it('falls back to the interleaved buckets when the roll fails', () => {
    // 0.7 lands in the "in progress first" band, which is empty here: the review bucket answers, at random
    // (second element), instead of the most overdue one.
    expect(nextPick(constRng(0.7), input, SMART)).toMatchObject({ skillId: 's2', reason: 'review' });
    expect(nextPick(constRng(0.99), input, SMART)).toMatchObject({ skillId: 's3', reason: 'new' }); // the "new first" band
  });

  it('leads with the due review on at least 60% of the questions, but not on all of them', () => {
    const served = picks(400, input);
    const s1 = served.filter((p) => p.skillId === 's1').length;
    expect(s1).toBeGreaterThanOrEqual(0.6 * 400);
    expect(served.some((p) => p.skillId === 's2')).toBe(true);
    expect(served.some((p) => p.skillId === 's3')).toBe(true);
  });

  it('does nothing special when no skill is due', () => {
    const none = { ...input, states: { s1: at(2), s2: at(2, { dueAt: T0 + DAY }), s3: at(0) } };
    expect(nextPick(constRng(0.5), none, SMART)).toMatchObject({ reason: 'practice' });
    expect(picks(100, none).some((p) => p.reason === 'review')).toBe(false);
  });

  it('puts the due review behind the skill just answered', () => {
    const last = { ...input, lastSkill: 's1' };
    expect(nextPick(constRng(0.5), last, SMART)).toMatchObject({ skillId: 's2', reason: 'review' });
  });

  it('keeps a due skill below Mastered in the same rule (a come-back the next day)', () => {
    const next = { ...input, states: { ...states, s1: at(3, { dueAt: T0 - 5 * DAY }) } };
    expect(nextPick(constRng(0.5), next, SMART)).toMatchObject({ skillId: 's1', reason: 'review' });
  });
});

describe('bringing a missed skill back', () => {
  /** The state of s2 right after a miss on s2.a at this difficulty, as the model leaves it. */
  const missedAt = (difficulty: Difficulty): SkillState =>
    applyAttempt(
      at(2, { difficulty, styles: { 's2.a': 2 } }),
      { templateId: 's2.a', format: 'mcs', difficulty, correct: false, timeMs: 60_000, at: T0, hintLevel: 0 },
      requirementsFor(templatesBySkill.get('s2')!),
    ).state;

  it('schedules stage 1 two to four questions out, and stage 2 right away', () => {
    for (let i = 0; i < 30; i++) {
      const r = scheduleRepair(createRng(i), 's2', 's2.a', 10);
      expect(r).toMatchObject({ skillId: 's2', missedTemplate: 's2.a', stage: 1 });
      expect(r.dueSeq).toBeGreaterThanOrEqual(12);
      expect(r.dueSeq).toBeLessThanOrEqual(14);
    }
    expect(scheduleRepair(createRng(1), 's2', 's2.a', 10, 2)).toEqual({ skillId: 's2', missedTemplate: 's2.a', dueSeq: 10, stage: 2 });
  });

  it('stage 1 serves the missed template again, once enough questions have passed', () => {
    const rem = scheduleRepair(createRng(1), 's2', 's2.a', 10);
    const states = { s2: missedAt(2) };
    for (let i = 0; i < 50; i++) {
      const pick = nextPick(createRng(i), { ...base, states, remediation: [rem], seq: rem.dueSeq }, SMART)!;
      expect(pick).toMatchObject({ skillId: 's2', templateId: 's2.a', reason: 'repair', remediation: rem });
    }
    const early = nextPick(createRng(3), { ...base, states, remediation: [rem], seq: rem.dueSeq - 1 }, SMART)!;
    expect(early.reason).not.toBe('repair');
  });

  it('stage 1 comes back one difficulty below the missed question, never below 1', () => {
    const rem = scheduleRepair(createRng(1), 's2', 's2.a', 0);
    const difficultyAfter = (missed: Difficulty) =>
      nextPick(createRng(1), { ...base, states: { s2: missedAt(missed) }, remediation: [rem], seq: rem.dueSeq }, SMART)!.difficulty;
    expect([3, 2, 1].map((d) => difficultyAfter(d as Difficulty))).toEqual([2, 1, 1]);
  });

  it('stage 1 falls back to another style when the missed template is gone', () => {
    const rem = scheduleRepair(createRng(1), 's2', 's2.gone', 0);
    const pick = nextPick(createRng(1), { ...base, remediation: [rem], seq: rem.dueSeq }, SMART)!;
    expect(pick).toMatchObject({ skillId: 's2', reason: 'repair' });
    expect(pick.templateId).toMatch(/^s2\./);
  });

  it('treats an entry saved before stages existed as stage 1', () => {
    const old = { skillId: 's2', missedTemplate: 's2.b', dueSeq: 4 } as Parameters<typeof nextPick>[1]['remediation'][number];
    expect(nextPick(createRng(1), { ...base, remediation: [old], seq: 4 }, SMART)).toMatchObject({ templateId: 's2.b', reason: 'repair' });
  });

  it('stage 2 waits for the skill to be due the next day, then changes style', () => {
    const states = { s2: missedAt(3) }; // dueAt = T0 + 1 day
    expect(states.s2.dueAt).toBe(T0 + DAY);
    const rem = scheduleRepair(createRng(1), 's2', 's2.a', 10, 2);
    const input = { ...base, states, remediation: [rem], seq: 0 }; // dueSeq plays no part
    for (let i = 0; i < 30; i++) {
      expect(nextPick(createRng(i), { ...input, now: T0 + DAY - 1 }, SMART)!.reason).not.toBe('repair');
      const pick = nextPick(createRng(i), { ...input, now: T0 + DAY }, SMART)!;
      expect(pick).toMatchObject({ skillId: 's2', reason: 'repair', difficulty: 2, remediation: rem });
      expect(pick.templateId).not.toBe('s2.a');
    }
  });

  it('serves the earlier entry first and ignores skills outside the scope', () => {
    const a = { skillId: 's1', missedTemplate: 's1.a', dueSeq: 6, stage: 1 as const };
    const b = { skillId: 's2', missedTemplate: 's2.a', dueSeq: 5, stage: 1 as const };
    expect(nextPick(createRng(1), { ...base, remediation: [a, b], seq: 6 }, SMART)).toMatchObject({ skillId: 's2' });
    // A comeback for a skill the session is not practicing waits.
    const mixed = { ...base, skills: [skill('s1'), { ...skill('s2'), area: 'algebra' as const }], remediation: [b], seq: 6 };
    const pick = nextPick(createRng(1), mixed, { kind: 'smart', areas: ['arithmetic'] })!;
    expect(pick).toMatchObject({ skillId: 's1' });
    expect(pick.reason).not.toBe('repair');
  });
});

describe('scheduler basics', () => {
  it('prefers styles that are not credited yet', () => {
    const states = { s1: at(2, { styles: { 's1.a': 2, 's1.b': 3 } }) };
    for (let i = 0; i < 20; i++) {
      const pick = nextPick(createRng(i), { ...base, states }, { kind: 'skill', skillId: 's1' })!;
      expect(pick.templateId).toBe('s1.c');
    }
  });

  it('serves due reviews in review mode', () => {
    const states = { s3: at(4, { dueAt: T0 - 1 }) };
    const pick = nextPick(createRng(5), { ...base, states }, { kind: 'review' })!;
    expect(pick.skillId).toBe('s3');
  });
});
