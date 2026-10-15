import { describe, expect, it } from 'vitest';
import { decodeSegment } from '../src/router';
import { dropWeakFlags } from '../src/store/migrate';
import { DAY, newSkillState, type SkillState } from '../src/mastery/model';
import type { Remediation } from '../src/mastery/scheduler';
import { exportProgress, initialData, isProgressData, MAX_ATTEMPT_MS, useProgress } from '../src/store/progress';

describe('router', () => {
  it('keeps a malformed escape instead of throwing', () => {
    expect(decodeSegment('50%')).toBe('50%');
    expect(decodeSegment('a%20b')).toBe('a b');
  });
});

describe('import validation', () => {
  const entry = { qid: 'x#1#1', skillId: 's', templateId: 't', correct: true, timeMs: 5, at: 1, mode: 'practice', traps: [], hinted: false };

  it('rejects a history entry that would crash the dashboard', () => {
    expect(isProgressData({ version: 1, skills: {}, history: [{ qid: 'x#1#1' }], remediation: [] })).toBe(false);
  });

  it('rejects null skills and a non-array sections', () => {
    expect(isProgressData({ ...initialData(), skills: null })).toBe(false);
    expect(isProgressData({ ...initialData(), sections: {} })).toBe(false);
    expect(isProgressData(null)).toBe(false);
  });

  it('accepts a valid export', () => {
    expect(isProgressData(JSON.parse(JSON.stringify(initialData())))).toBe(true);
    expect(isProgressData({ ...initialData(), history: [entry] })).toBe(true);
  });

  it('dropWeakFlags never throws on bad input', () => {
    expect(() => dropWeakFlags({ ...initialData(), skills: null } as never)).not.toThrow();
    expect(dropWeakFlags({ ...initialData(), skills: { a: 5 } } as never).skills).toEqual({});
  });
});

describe('recordAttempt', () => {
  it('caps a recorded time at 10 minutes', () => {
    useProgress.setState(initialData());
    const question = { id: 'arith.x#1#1', templateId: 'arith.x', skillId: 'arith.s' } as never;
    const base = { question, correct: true, hintLevel: 0 as const, traps: [] as string[], mode: 'practice' as const };
    useProgress.getState().recordAttempt({ ...base, timeMs: 5 * 60 * 60 * 1000 });
    useProgress.getState().recordAttempt({ ...base, timeMs: 30_000 });
    expect(useProgress.getState().history.map((h) => h.timeMs)).toEqual([MAX_ATTEMPT_MS, 30_000]);
  });
});

describe('repair queue', () => {
  const question = { id: 'arith.x#1#1', templateId: 'arith.x', skillId: 'arith.s', format: 'ne', difficulty: 2 } as never;
  const other = { id: 'arith.y#1#1', templateId: 'arith.y', skillId: 'arith.t', format: 'ne', difficulty: 2 } as never;
  const answer = (correct: boolean, repair?: Remediation, q = question) =>
    useProgress.getState().recordAttempt({ question: q, correct, timeMs: 5000, hintLevel: 0, traps: [], mode: 'practice', repair });
  const queue = () => useProgress.getState().remediation;
  const stage1: Remediation = { skillId: 'arith.s', missedTemplate: 'arith.x', dueSeq: 2, stage: 1 };
  const stage2: Remediation = { skillId: 'arith.s', missedTemplate: 'arith.x', dueSeq: 0, stage: 2 };
  // A skill that was missed: it has a come-back date (a day after the miss) unless it was reviewed since.
  const missed = (dueAt: number | undefined): Record<string, SkillState> => ({ 'arith.s': { ...newSkillState(), level: 1, attempts: 1, dueAt } });

  it('keeps a first comeback that is not due yet when the skill is answered again', () => {
    useProgress.setState({ ...initialData(), remediation: [stage1] });
    answer(true);
    answer(true); // seq is now 2 = dueSeq: the comeback is due, not served
    expect(queue()).toEqual([stage1]);
  });

  it('serving a first comeback right schedules the next-day comeback on the same missed template', () => {
    useProgress.setState({ ...initialData(), seq: 4, skills: missed(Date.now() + DAY), remediation: [{ ...stage1, dueSeq: 4 }] });
    answer(true, { ...stage1, dueSeq: 4 });
    expect(queue()).toEqual([{ skillId: 'arith.s', missedTemplate: 'arith.x', dueSeq: 5, stage: 2 }]);
  });

  it('schedules no next-day comeback when the answer cleared the come-back date', () => {
    // Reviewed after the date: the skill is no longer due, so a stage 2 entry would never be served.
    useProgress.setState({ ...initialData(), seq: 4, skills: missed(Date.now() - 1000), remediation: [{ ...stage1, dueSeq: 4 }] });
    answer(true, { ...stage1, dueSeq: 4 });
    expect(useProgress.getState().skills['arith.s'].dueAt).toBeUndefined();
    expect(queue()).toEqual([]);
  });

  it('adds nothing when the served entry is no longer in the queue', () => {
    // A stale pick or a second tab already served it.
    useProgress.setState({ ...initialData(), seq: 4, skills: missed(Date.now() + DAY), remediation: [] });
    answer(true, { ...stage1, dueSeq: 4 });
    expect(queue()).toEqual([]);
    const other = { ...stage1, dueSeq: 9 };
    useProgress.setState({ remediation: [other] });
    answer(true, { ...stage1, dueSeq: 4 });
    expect(queue()).toEqual([other]);
  });

  it('missing a comeback restarts the chain with one fresh first comeback', () => {
    useProgress.setState({ ...initialData(), seq: 4, remediation: [{ ...stage1, dueSeq: 4 }, stage2] });
    answer(false, { ...stage1, dueSeq: 4 });
    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({ skillId: 'arith.s', missedTemplate: 'arith.x', stage: 1 });
    expect(queue()[0].dueSeq).toBeGreaterThanOrEqual(7);
  });

  it('serving the next-day comeback ends the chain, and a stage 2 entry waits through other answers', () => {
    useProgress.setState({ ...initialData(), remediation: [stage2] });
    answer(true); // an answer to the skill that did not come from the entry
    answer(true, undefined, other);
    expect(queue()).toEqual([stage2]);
    answer(true, stage2);
    expect(queue()).toEqual([]);
  });

  it('serves one entry at a time and leaves other skills alone', () => {
    const t: Remediation = { skillId: 'arith.t', missedTemplate: 'arith.y', dueSeq: 1, stage: 1 };
    useProgress.setState({ ...initialData(), seq: 3, skills: missed(Date.now() + DAY), remediation: [stage1, t] });
    answer(true, stage1);
    expect(queue().map((r) => [r.skillId, r.stage])).toEqual([
      ['arith.t', 1],
      ['arith.s', 2],
    ]);
  });

  it('counts an entry saved before stages existed as a first comeback', () => {
    const old = { skillId: 'arith.s', missedTemplate: 'arith.x', dueSeq: 1 } as Remediation;
    useProgress.setState({ ...initialData(), seq: 1, skills: missed(Date.now() + DAY), remediation: [old] });
    answer(true, old);
    expect(queue()).toMatchObject([{ skillId: 'arith.s', stage: 2 }]);
  });
});

describe('lessons seen', () => {
  it('records a skill once, exports it and takes it back on import', () => {
    useProgress.setState(initialData());
    useProgress.getState().markLessonSeen('arith.fractions');
    useProgress.getState().markLessonSeen('arith.fractions');
    expect(useProgress.getState().lessonsSeen).toEqual(['arith.fractions']);
    const exported = JSON.parse(exportProgress());
    expect(exported.lessonsSeen).toEqual(['arith.fractions']);
    useProgress.getState().reset();
    expect(useProgress.getState().lessonsSeen).toEqual([]);
    useProgress.getState().importData(exported);
    expect(useProgress.getState().lessonsSeen).toEqual(['arith.fractions']);
  });

  it('accepts an export without the field, and rejects one that is not a list of ids', () => {
    const { lessonsSeen, ...old } = initialData();
    expect(lessonsSeen).toEqual([]);
    expect(isProgressData(old)).toBe(true);
    useProgress.getState().importData(old);
    expect(useProgress.getState().lessonsSeen).toEqual([]);
    expect(isProgressData({ ...old, lessonsSeen: 'arith.fractions' })).toBe(false);
    expect(isProgressData({ ...old, lessonsSeen: [1] })).toBe(false);
  });

  it('keeps the lessons setting through an import', () => {
    useProgress.getState().importData({ ...initialData(), settings: { ...initialData().settings, lessons: false } });
    expect(useProgress.getState().settings.lessons).toBe(false);
  });
});
