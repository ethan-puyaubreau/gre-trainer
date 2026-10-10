import { describe, expect, it } from 'vitest';
import { Frac } from '../src/engine/frac';
import type { QuestionBody } from '../src/engine/types';
import type { Level } from '../src/mastery/model';
import { dodgedTraps, summarize, type SessionOutcome } from '../src/mastery/session';

const explanation = '';
const mcs: QuestionBody = {
  format: 'mcs',
  stem: 's',
  explanation,
  answer: 1,
  choices: [{ text: 'a', trap: 'tA' }, { text: 'b' }, { text: 'c', trap: 'tC' }, { text: 'd' }, { text: 'e', trap: 'tA' }],
};
const mcm: QuestionBody = {
  format: 'mcm',
  stem: 's',
  instruction: 'i',
  explanation,
  answer: [0, 2],
  choices: [{ text: 'a' }, { text: 'b', trap: 'tB' }, { text: 'c' }, { text: 'd', trap: 'tD' }],
};
const qc: QuestionBody = { format: 'qc', quantityA: 'a', quantityB: 'b', explanation, answer: 'B', traps: { A: 'tA', C: 'tC' } };
const ne: QuestionBody = { format: 'ne', stem: 's', explanation, answer: new Frac(2, 1), traps: [{ value: new Frac(3, 1), trap: 'tN' }] };

describe('dodgedTraps', () => {
  it('lists the traps of the wrong choices left alone, once each', () => {
    expect(dodgedTraps(mcs, { format: 'mcs', choice: 1 })).toEqual(['tA', 'tC']);
    expect(dodgedTraps(qc, { format: 'qc', choice: 'B' })).toEqual(['tA', 'tC']);
  });

  it('is empty for a wrong answer, whatever the trap hit', () => {
    expect(dodgedTraps(mcs, { format: 'mcs', choice: 0 })).toEqual([]);
    expect(dodgedTraps(qc, { format: 'qc', choice: 'A' })).toEqual([]);
    expect(dodgedTraps(mcs, undefined)).toEqual([]);
  });

  it('is empty for numeric entry', () => {
    expect(dodgedTraps(ne, { format: 'ne', value: '2' })).toEqual([]);
  });

  it('needs the exact set on multiple choice', () => {
    expect(dodgedTraps(mcm, { format: 'mcm', choices: [0, 2] })).toEqual(['tB', 'tD']);
    expect(dodgedTraps(mcm, { format: 'mcm', choices: [0] })).toEqual([]);
    expect(dodgedTraps(mcm, { format: 'mcm', choices: [0, 1, 2] })).toEqual([]);
  });

  it('is empty when the question has no traps', () => {
    expect(dodgedTraps({ ...qc, traps: undefined }, { format: 'qc', choice: 'B' })).toEqual([]);
  });
});

describe('summarize', () => {
  const o = (skillId: string, from: Level, to: Level, correct: boolean, dodged = 0): SessionOutcome => ({ skillId, from, to, correct, dodged });

  it('counts answers, accuracy and dodged traps', () => {
    const s = summarize([o('a', 0, 2, true, 2), o('a', 2, 2, true), o('b', 3, 2, false), o('c', 1, 1, false)]);
    expect(s).toMatchObject({ answered: 4, correct: 2, accuracy: 50, dodged: 2 });
  });

  it('reports the net level change per skill, in order of first appearance', () => {
    const s = summarize([o('a', 0, 2, true), o('b', 3, 2, false), o('a', 2, 3, true), o('b', 2, 3, true), o('c', 2, 3, true), o('c', 3, 2, false)]);
    expect(s.up).toEqual([{ skillId: 'a', from: 0, to: 3 }]);
    expect(s.down).toEqual([]); // b went 3 -> 2 -> 3 and c 2 -> 3 -> 2: no net move
  });

  it('puts level drops in `down`', () => {
    const s = summarize([o('a', 4, 3, false), o('b', 2, 3, true)]);
    expect(s.down).toEqual([{ skillId: 'a', from: 4, to: 3 }]);
    expect(s.up).toEqual([{ skillId: 'b', from: 2, to: 3 }]);
  });

  it('handles an empty session', () => {
    expect(summarize([])).toEqual({ answered: 0, correct: 0, accuracy: 0, up: [], down: [], dodged: 0 });
  });

  it('rounds accuracy to a whole percent', () => {
    expect(summarize([o('a', 2, 2, true), o('a', 2, 2, false), o('a', 2, 2, false)]).accuracy).toBe(33);
  });
});
