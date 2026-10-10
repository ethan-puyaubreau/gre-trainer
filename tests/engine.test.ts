import { describe, expect, it } from 'vitest';
import { evaluate, formatCalc } from '../src/engine/calc';
import { Frac, frac, parseDecimal } from '../src/engine/frac';
import { grade } from '../src/engine/grade';
import { parseRich } from '../src/engine/rich';
import type { NEQuestion } from '../src/engine/types';

const ne = (answer: Frac, fractionBoxes = false): NEQuestion => ({
  format: 'ne',
  stem: 'x',
  answer,
  fractionBoxes,
  explanation: 'explanation text here',
});

describe('Frac', () => {
  it('normalizes and compares exactly', () => {
    expect(frac(2, 4).eq(frac(1, 2))).toBe(true);
    expect(frac(1, -3).toString()).toBe('-1/3');
    expect(frac(1, 10).add(frac(2, 10)).eq(frac(3, 10))).toBe(true);
    expect(frac(918, 1000).toDecimalString()).toBe('0.918');
    expect(frac(-5, 2).toDecimalString()).toBe('-2.5');
    expect(frac(1, 3).isTerminating()).toBe(false);
  });

  it('parses GRE numeric entry input', () => {
    expect(parseDecimal('2.50')?.eq(frac(5, 2))).toBe(true);
    expect(parseDecimal('1,200')?.eq(1200)).toBe(true);
    expect(parseDecimal('-.5')?.eq(frac(-1, 2))).toBe(true);
    expect(parseDecimal('−3')?.eq(-3)).toBe(true); // unicode minus
    expect(parseDecimal('3/4')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});

describe('grading numeric entry', () => {
  it('accepts equivalent decimal forms', () => {
    const q = ne(frac(5, 2));
    expect(grade(q, { format: 'ne', value: '2.5' }).correct).toBe(true);
    expect(grade(q, { format: 'ne', value: '2.50' }).correct).toBe(true);
    expect(grade(q, { format: 'ne', value: '2.6' }).correct).toBe(false);
  });

  it('accepts unreduced fractions and flags invalid boxes', () => {
    const q = ne(frac(1, 4), true);
    expect(grade(q, { format: 'ne', num: '20', den: '80' }).correct).toBe(true);
    expect(grade(q, { format: 'ne', num: '1', den: '4' }).correct).toBe(true);
    expect(grade(q, { format: 'ne', num: '0.5', den: '2' }).invalid).toBe(true);
    expect(grade(q, { format: 'ne', num: '1', den: '0' }).invalid).toBe(true);
  });

  it('reports traps on numeric entry', () => {
    const q: NEQuestion = { ...ne(frac(7)), traps: [{ value: frac(6), trap: 'cycle-count-terms' }] };
    expect(grade(q, { format: 'ne', value: '6' }).traps).toEqual(['cycle-count-terms']);
  });

  it('requires the exact set for select-all questions', () => {
    const q = {
      format: 'mcm' as const,
      stem: 's',
      instruction: 'i',
      choices: [{ text: 'a' }, { text: 'b', trap: 't' }, { text: 'c' }],
      answer: [0, 2],
      explanation: 'explanation text here',
    };
    expect(grade(q, { format: 'mcm', choices: [2, 0] }).correct).toBe(true);
    expect(grade(q, { format: 'mcm', choices: [0] }).correct).toBe(false);
    expect(grade(q, { format: 'mcm', choices: [0, 1, 2] }).traps).toEqual(['t']);
  });
});

describe('calculator', () => {
  it('follows the order of operations', () => {
    expect(evaluate([1, '+', 2, '*', 4])).toBe(9);
    expect(evaluate(['(', 1, '+', 2, ')', '*', 4])).toBe(12);
    expect(evaluate([10, '-', 4, '-', 3])).toBe(3);
    expect(evaluate([8, '/', 2, '/', 2])).toBe(2);
  });

  it('formats like an 8-digit display', () => {
    expect(formatCalc(2 / 3)).toBe('0.6666667');
    expect(formatCalc(123456789)).toBe('Error');
    expect(formatCalc(1e-9)).toBe('0');
    expect(formatCalc(12.5)).toBe('12.5');
  });
});

describe('rich text', () => {
  it('keeps escaped dollars as text and splits math', () => {
    const [p] = parseRich('It costs \\$18 and $x^2$ more.');
    expect(p.type).toBe('p');
    if (p.type === 'p') {
      expect(p.segments.map((s) => s.type)).toEqual(['text', 'math', 'text']);
      expect(p.segments[0].value).toBe('It costs $18 and ');
    }
  });

  it('parses bullets and display math', () => {
    const blocks = parseRich('Intro\n- one\n- two\n\n$$a = b$$');
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul', 'display']);
  });

  it('rejects unbalanced math', () => {
    expect(() => parseRich('costs $18 total')).toThrow();
  });
});
