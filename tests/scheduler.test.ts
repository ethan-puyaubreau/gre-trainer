import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from '../src/engine/rng';
import type { Format, Skill, Template } from '../src/engine/types';
import { DAY, newSkillState, type Level, type SkillState } from '../src/mastery/model';
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

describe('scheduler basics', () => {
  it('brings a missed skill back in a different style after a few questions', () => {
    const rem = scheduleRepair(createRng(1), 's2', 's2.a', 10);
    expect(rem.dueSeq).toBeGreaterThanOrEqual(12);
    expect(rem.dueSeq).toBeLessThanOrEqual(14);
    for (let i = 0; i < 50; i++) {
      const pick = nextPick(createRng(i), { ...base, remediation: [rem], seq: rem.dueSeq }, SMART)!;
      expect(pick.reason).toBe('repair');
      expect(pick.skillId).toBe('s2');
      expect(pick.templateId).not.toBe('s2.a');
    }
    const early = nextPick(createRng(3), { ...base, remediation: [rem], seq: rem.dueSeq - 1 }, SMART)!;
    expect(early.reason).not.toBe('repair');
  });

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
