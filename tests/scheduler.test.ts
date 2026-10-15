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

describe('introducing new skills', () => {
  const fresh = (n: number) => ({ ...base, skills: skills.slice(0, n) });

  it('asks the first question of a new skill at difficulty 1, whatever the scope', () => {
    for (const scope of [SMART, { kind: 'skill', skillId: 's1' }, { kind: 'unit', area: 'arithmetic', unit: 'U' }] as const) {
      const pick = nextPick(createRng(4), fresh(3), scope)!;
      expect(pick.difficulty).toBe(1);
    }
    const second = nextPick(createRng(4), { ...fresh(3), states: { s1: at(2, { attempts: 1, difficulty: 2 }) } }, { kind: 'skill', skillId: 's1' })!;
    expect(second.difficulty).toBe(2); // from the second question on, the skill's own difficulty
  });

  it('serves a second question right after the first, even with a review due', () => {
    const states = { s1: at(2, { attempts: 1 }), s2: at(4, { dueAt: T0 - DAY }) };
    for (let i = 0; i < 50; i++) {
      const pick = nextPick(createRng(i), { ...fresh(3), states, lastSkill: 's1' }, SMART)!;
      expect(pick).toMatchObject({ skillId: 's1', reason: 'new' });
    }
  });

  it('serves a third question on a coin flip, never a fourth', () => {
    const states = { s1: at(2, { attempts: 2 }) };
    const input = { ...fresh(3), states, lastSkill: 's1' };
    expect(nextPick(constRng(0.4), input, SMART)).toMatchObject({ skillId: 's1', reason: 'new' });
    expect(nextPick(constRng(0.6), input, SMART)!.skillId).not.toBe('s1');
    const third = { ...input, states: { s1: at(2, { attempts: 3 }) } };
    expect(picks(50, third).some((p) => p.skillId === 's1')).toBe(false);
  });

  it('only continues the skill just answered', () => {
    const states = { s1: at(2, { attempts: 1 }) }; // started in an earlier run, not the last question
    expect(picks(60, { ...fresh(3), states }).some((p) => p.skillId !== 's1')).toBe(true);
    expect(picks(60, { ...fresh(3), states, lastSkill: 's2' }).some((p) => p.skillId !== 's1')).toBe(true);
  });

  it('plays out as runs of 2 or 3 questions on each new skill', () => {
    const lengths = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      const reqs = new Map(skills.map((s) => [s.id, requirementsFor(templatesBySkill.get(s.id)!)]));
      let states: Record<string, SkillState> = {};
      let last: string | undefined;
      const seen: string[] = [];
      for (let i = 0; i < 6; i++) {
        const pick = nextPick(rng, { ...fresh(4), states, lastSkill: last, now: T0 + i * 1000, seq: i }, SMART)!;
        const prev = states[pick.skillId] ?? newSkillState();
        states = {
          ...states,
          [pick.skillId]: applyAttempt(
            prev,
            { templateId: pick.templateId, format: 'mcs', difficulty: pick.difficulty, correct: true, timeMs: 60_000, at: T0 + i * 1000, hintLevel: 0 },
            reqs.get(pick.skillId)!,
          ).state,
        };
        last = pick.skillId;
        seen.push(pick.skillId);
      }
      const run = seen.findIndex((id) => id !== seen[0]);
      lengths.add(run);
      expect(run).toBeGreaterThanOrEqual(2);
      expect(run).toBeLessThanOrEqual(3);
    }
    expect([...lengths].sort()).toEqual([2, 3]);
  });

  it('starts no new skill while 4 skills are Attempted or Familiar', () => {
    const states = { s1: at(1), s2: at(1), s3: at(2), s4: at(2), s5: at(4) }; // s6 and s7 are not started
    const crowded = { ...base, states };
    const served = picks(300, crowded);
    expect(served.some((p) => p.reason === 'new' || p.skillId === 's6' || p.skillId === 's7')).toBe(false);
    // With only 3 of them, a new skill gets in.
    const room = { ...base, states: { ...states, s4: at(3) } };
    expect(picks(300, room).some((p) => p.reason === 'new' && p.skillId === 's6')).toBe(true);
  });

  it('still starts a new skill when nothing else can be served in the scope', () => {
    const algebra = skills.map((s) => (s.id === 's6' ? { ...s, area: 'algebra' as const } : s));
    const states = { s1: at(1), s2: at(1), s3: at(2), s4: at(2) };
    const pick = nextPick(createRng(1), { ...base, skills: algebra, states }, { kind: 'smart', areas: ['algebra'] })!;
    expect(pick).toMatchObject({ skillId: 's6', reason: 'new', difficulty: 1 });
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
