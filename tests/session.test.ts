import { describe, expect, it } from 'vitest';
import { Frac } from '../src/engine/frac';
import type { QuestionBody } from '../src/engine/types';
import { dodgedTraps } from '../src/mastery/session';

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
