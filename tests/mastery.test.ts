import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import type { Skill, Template } from '../src/engine/types';
import { applyAttempt, DAY, newSkillState, type SkillState } from '../src/mastery/model';
import { nextPick, scheduleRepair, type SchedulerInput } from '../src/mastery/scheduler';

const T0 = new Date(2026, 9, 10, 9, 0).getTime();
const clean = (templateId: string, at: number) => ({ templateId, correct: true, timeMs: 60_000, hinted: false, at });

describe('mastery model', () => {
  it('walks Familiar -> Proficient -> Mastered with 3 styles on 2 days', () => {
    let s = newSkillState();
    s = applyAttempt(s, clean('t1', T0)).state;
    expect(s.level).toBe(2);
    s = applyAttempt(s, clean('t2', T0 + 1000)).state;
    expect(s.level).toBe(3);
    s = applyAttempt(s, clean('t3', T0 + 2000)).state;
    expect(s.level).toBe(3); // all on one day: not mastered yet
    s = applyAttempt(s, clean('t1', T0 + DAY)).state;
    expect(s.level).toBe(4);
    expect(s.dueAt).toBe(T0 + DAY + 3 * DAY);
  });

  it('does not credit slow or hinted answers beyond Familiar', () => {
    let s = newSkillState();
    s = applyAttempt(s, { templateId: 't1', correct: true, timeMs: 200_000, hinted: false, at: T0 }).state;
    expect(s.level).toBe(2);
    s = applyAttempt(s, { templateId: 't2', correct: true, timeMs: 30_000, hinted: true, at: T0 }).state;
    expect(s.level).toBe(2);
    expect(s.styles).toEqual([]);
  });

  it('drops a level, resets credit and lowers difficulty on a miss', () => {
    let s: SkillState = { ...newSkillState(), level: 3, styles: ['a', 'b'], days: ['x'], difficulty: 3 };
    s = applyAttempt(s, { templateId: 'a', correct: false, timeMs: 1000, hinted: false, at: T0 }).state;
    expect(s.level).toBe(2);
    expect(s.styles).toEqual([]);
    expect(s.difficulty).toBe(2);
    expect(s.dueAt).toBe(T0 + DAY);
  });

  it('moves mastered skills along the review schedule', () => {
    let s: SkillState = { ...newSkillState(), level: 4, dueAt: T0, reviewStage: 0 };
    s = applyAttempt(s, clean('a', T0 + 10)).state;
    expect(s.level).toBe(4);
    expect(s.reviewStage).toBe(1);
    expect(s.dueAt).toBe(T0 + 10 + 7 * DAY);
    s = applyAttempt(s, { templateId: 'a', correct: false, timeMs: 1000, hinted: false, at: T0 + 20 }).state;
    expect(s.level).toBe(3);
  });

  it('counts every correct answer of a timed section as on pace', () => {
    const s = applyAttempt(newSkillState(), { templateId: 'a', correct: true, timeMs: 400_000, hinted: false, at: T0, timedSection: true });
    expect(s.clean).toBe(true);
  });
});

describe('scheduler', () => {
  const skill = (id: string): Skill => ({ id, area: 'arithmetic', unit: 'U', name: id, summary: '', strategy: '' });
  const tpl = (id: string, sk: string) => ({ id, skill: sk, format: 'mcs', style: id }) as unknown as Template<any>;
  const skills = [skill('s1'), skill('s2'), skill('s3')];
  const templatesBySkill = new Map(skills.map((s) => [s.id, ['a', 'b', 'c'].map((x) => tpl(`${s.id}.${x}`, s.id))]));
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
    const states = { s1: { ...newSkillState(), level: 2 as const, styles: ['s1.a', 's1.b'] } };
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
