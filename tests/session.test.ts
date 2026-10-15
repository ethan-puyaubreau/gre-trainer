import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/content/lessons';
import { Frac } from '../src/engine/frac';
import { parseRich } from '../src/engine/rich';
import type { QuestionBody } from '../src/engine/types';
import type { Level } from '../src/mastery/model';
import { dodgedTraps, earnsReward, hintText, paceJudged, summarize, type RewardInput, type SessionOutcome } from '../src/mastery/session';

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

describe('hintText', () => {
  const strategy = 'Write the equation first.\n\n- Test $k = 0$.\n- Plug in $n = 1, 2$.';
  const example = { problem: 'Find $n$.', steps: ['Write $n = 4k$ because 4 divides it.', 'Test $k = 1$.'], answer: '$n = 4$' };
  const workedExample = '**Worked example**\n\nFind $n$.\n\n- Write $n = 4k$ because 4 divides it.\n- Test $k = 1$.\n\n**Answer:** $n = 4$';

  it('shows nothing before the first hint', () => {
    expect(hintText(strategy, 0)).toBe('');
    expect(hintText(strategy, 0, example)).toBe('');
  });

  it('starts with the first line only', () => {
    expect(hintText(strategy, 1)).toBe('Write the equation first.');
  });

  it('shows the bullets alone at the second step', () => {
    expect(hintText(strategy, 2)).toBe('- Test $k = 0$.\n- Plug in $n = 1, 2$.');
  });

  it('keeps the first two steps free of the worked example', () => {
    expect(hintText(strategy, 1, example)).toBe(hintText(strategy, 1));
    expect(hintText(strategy, 2, example)).toBe(hintText(strategy, 2));
  });

  it('adds the worked example before the whole card at the third step', () => {
    expect(hintText(strategy, 3, example)).toBe(`${workedExample}\n\n**Strategy card**\n\n${strategy}`);
  });

  it('shows the whole card alone at the third step when the skill has no example', () => {
    expect(hintText(strategy, 3)).toBe(strategy);
  });

  it('leaves any other paragraph for the last step', () => {
    const long = 'Idea.\n\n- one\n- two\n\nA closing remark.';
    expect(hintText(long, 2)).toBe('- one\n- two');
    expect(hintText(long, 3)).toBe(long);
  });

  it('falls back to the first line when the card has no bullets', () => {
    expect(hintText('Just a line.', 1)).toBe('Just a line.');
    expect(hintText('Just a line.', 2)).toBe('Just a line.');
    expect(hintText('Just a line.', 3)).toBe('Just a line.');
  });

  it('turns every lesson of the app into rich text with the steps and the card bullets', () => {
    for (const [id, lesson] of Object.entries(LESSONS)) {
      const blocks = parseRich(hintText('Idea.\n\n- one', 3, lesson.example));
      expect(blocks.filter((b) => b.type === 'ul'), id).toHaveLength(2);
    }
  });
});

describe('paceJudged', () => {
  it('judges speed from Proficient on', () => {
    expect(([0, 1, 2, 3, 4] as Level[]).map(paceJudged)).toEqual([false, false, false, true, true]);
  });
});

describe('earnsReward', () => {
  // A Proficient skill, medium question, 105 s pace: the strictest case.
  const base: RewardInput = { correct: true, hintLevel: 0, difficulty: 2, timeMs: 60_000, paceSec: 105, level: 3 };
  const earns = (patch: Partial<RewardInput>) => earnsReward({ ...base, ...patch });

  it('rewards a correct, unhinted, on-pace answer', () => {
    expect(earns({})).toBe(true);
  });

  it('never rewards a wrong answer', () => {
    expect(earns({ correct: false })).toBe(false);
  });

  it('allows the first-line hint only', () => {
    expect([0, 1, 2, 3].map((hintLevel) => earns({ hintLevel: hintLevel as RewardInput['hintLevel'] }))).toEqual([true, true, false, false]);
  });

  it('does not reward difficulty 1, which credits nothing', () => {
    expect(earns({ difficulty: 1 })).toBe(false);
    expect(earns({ difficulty: 3 })).toBe(true);
  });

  it('judges pace from Proficient on, at the pace limit', () => {
    expect(earns({ timeMs: 105_000 })).toBe(true);
    expect(earns({ timeMs: 105_001 })).toBe(false);
    expect(earns({ timeMs: 105_001, level: 4 })).toBe(false);
  });

  it('gives hard questions 1.5x the time', () => {
    expect(earns({ difficulty: 3, timeMs: 157_500 })).toBe(true);
    expect(earns({ difficulty: 3, timeMs: 157_501 })).toBe(false);
  });

  it('ignores pace below Proficient', () => {
    expect(earns({ timeMs: 600_000, level: 2 })).toBe(true);
    expect(earns({ timeMs: 600_000, level: 0 })).toBe(true);
  });
});
