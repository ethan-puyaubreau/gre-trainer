import { flaggedChoices, letter } from '../../../engine/build';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { intExcept, SPECIAL } from './util';

// "Must be true" select-all questions for alg.qc-algebra, with their traps.
export const mustTraps: Record<string, Trap> = {
  'alg-must-one-example': {
    label: 'Tested one example and decided the statement "must" be true',
    fix: '"Must be true" has to hold for EVERY allowed pair. One example that works proves nothing; look for a pair that breaks the statement.',
  },
  'alg-must-square-order': {
    label: 'Assumed squaring or absolute value keeps the order of two numbers',
    fix: 'Order can flip when numbers are negative: $-1 > -3$, but $(-1)^2 = 1 < 9 = (-3)^2$. Compare distances from zero, not signed values.',
  },
};

interface Stmt {
  t: string;
  f: (x: number, y: number) => boolean;
  sq?: boolean;
}

interface Family {
  premise: string;
  fact: string;
  ok: (x: number, y: number) => boolean;
  stmts: Stmt[];
  /** values of x and y worth trying for the premise */
  xs: number[];
  ys: number[];
}

const GRID = [-50, -10, -5, -3, -2.5, -2, -1.5, -1, -0.5, -0.25, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 5, 10, 50];

function family(id: 'opposite' | 'negatives' | 'bounds' | 'squares' | 'fraction', X: string, Y: string, a: number, b: number): Family {
  switch (id) {
    case 'opposite':
      return {
        premise: `${X}${Y} < 0$ and $${X} > ${Y}`,
        fact: `A negative product means $${X}$ and $${Y}$ have opposite signs, and $${X} > ${Y}$ then puts the positive one in $${X}$: $${X} > 0 > ${Y}$.`,
        ok: (x, y) => x * y < 0 && x > y,
        xs: GRID,
        ys: GRID,
        stmts: [
          { t: `${X} > 0`, f: (x) => x > 0 },
          { t: `${Y} < 0`, f: (_x, y) => y < 0 },
          { t: `${X} + ${Y} > 0`, f: (x, y) => x + y > 0 },
          { t: `${X} - ${Y} > 0`, f: (x, y) => x - y > 0 },
          { t: `${X}^2 > ${Y}^2`, f: (x, y) => x * x > y * y, sq: true },
          { t: `\\dfrac{${X}}{${Y}} < 0`, f: (x, y) => x / y < 0 },
          { t: `${X}^3 > ${Y}^3`, f: (x, y) => x ** 3 > y ** 3 },
          { t: `|${X}| > |${Y}|`, f: (x, y) => Math.abs(x) > Math.abs(y), sq: true },
          { t: `${X}${Y}^2 > 0`, f: (x, y) => x * y * y > 0 },
          { t: `${X} + ${Y} < 0`, f: (x, y) => x + y < 0 },
        ],
      };
    case 'negatives':
      return {
        premise: `${X} < ${Y} < 0`,
        fact: `Both numbers are negative and $${X}$ is the one farther from zero, so $|${X}| > |${Y}|$.`,
        ok: (x, y) => x < y && y < 0,
        xs: GRID,
        ys: GRID,
        stmts: [
          { t: `${X}${Y} > 0`, f: (x, y) => x * y > 0 },
          { t: `${X} + ${Y} < 0`, f: (x, y) => x + y < 0 },
          { t: `${X}^2 > ${Y}^2`, f: (x, y) => x * x > y * y },
          { t: `\\dfrac{${X}}{${Y}} > 1`, f: (x, y) => x / y > 1 },
          { t: `\\dfrac{1}{${X}} > \\dfrac{1}{${Y}}`, f: (x, y) => 1 / x > 1 / y },
          { t: `${X}^2 < ${Y}^2`, f: (x, y) => x * x < y * y, sq: true },
          { t: `\\dfrac{${Y}}{${X}} > 1`, f: (x, y) => y / x > 1 },
          { t: `\\dfrac{1}{${X}} < \\dfrac{1}{${Y}}`, f: (x, y) => 1 / x < 1 / y },
          { t: `${X}${Y} < ${Y}^2`, f: (x, y) => x * y < y * y },
          { t: `|${X}| < |${Y}|`, f: (x, y) => Math.abs(x) < Math.abs(y), sq: true },
        ],
      };
    case 'bounds':
      return {
        premise: `${X} > ${num(a)}$ and $${Y} < ${num(b)}`,
        fact: `Only the bounds are known: $${X}$ is above $${num(a)}$ and $${Y}$ is below $${num(b)}$, so $-${Y}$ is above $${num(-b)}$. Add inequalities that point the same way; products and sums of mixed bounds are not fixed.`,
        ok: (x, y) => x > a && y < b,
        xs: [a + 0.25, a + 0.5, a + 1, a + 2, a + 5, a + 10, a + 50],
        ys: [b - 0.25, b - 0.5, b - 1, b - 2, b - 5, b - 10, b - 50],
        stmts: [
          { t: `${X} - ${Y} > ${num(a - b)}`, f: (x, y) => x - y > a - b },
          { t: `${Y} - ${X} < ${num(b - a)}`, f: (x, y) => y - x < b - a },
          { t: `2${X} - 2${Y} > ${num(2 * (a - b))}`, f: (x, y) => 2 * x - 2 * y > 2 * (a - b) },
          { t: `${X} - ${Y} > ${num(a - b - 1)}`, f: (x, y) => x - y > a - b - 1 },
          { t: `${X} > ${Y}`, f: (x, y) => x > y },
          { t: `${X} + ${Y} > ${num(a + b)}`, f: (x, y) => x + y > a + b },
          { t: `${X} + ${Y} < ${num(a + b)}`, f: (x, y) => x + y < a + b },
          { t: `${X}${Y} < ${num(a * b)}`, f: (x, y) => x * y < a * b },
          { t: `${X} - ${Y} > ${num(a - b + 1)}`, f: (x, y) => x - y > a - b + 1 },
        ],
      };
    case 'squares':
      return {
        premise: `${X}^2 > ${Y}^2$ and $${X}${Y} > 0`,
        fact: `A positive product means $${X}$ and $${Y}$ have the same sign, and $${X}^2 > ${Y}^2$ means $|${X}| > |${Y}|$. They can both be positive or both negative.`,
        ok: (x, y) => x * x > y * y && x * y > 0,
        xs: GRID,
        ys: GRID,
        stmts: [
          { t: `|${X}| > |${Y}|`, f: (x, y) => Math.abs(x) > Math.abs(y) },
          { t: `\\dfrac{${X}}{${Y}} > 1`, f: (x, y) => x / y > 1 },
          { t: `${X}(${X} - ${Y}) > 0`, f: (x, y) => x * (x - y) > 0 },
          { t: `\\dfrac{${Y}}{${X}} < 1`, f: (x, y) => y / x < 1 },
          { t: `${X} + ${Y} \\neq 0`, f: (x, y) => x + y !== 0 },
          { t: `\\dfrac{${Y}}{${X}} > 0`, f: (x, y) => y / x > 0 },
          { t: `${X} > ${Y}`, f: (x, y) => x > y, sq: true },
          { t: `${X} > 0`, f: (x) => x > 0 },
          { t: `${X} + ${Y} > 0`, f: (x, y) => x + y > 0 },
          { t: `${X} - ${Y} > 0`, f: (x, y) => x - y > 0 },
        ],
      };
    case 'fraction':
      return {
        premise: `0 < ${X} < 1`,
        fact: `$${X}$ is a proper positive fraction: multiplying by it shrinks a positive number, and its reciprocal is greater than 1.`,
        ok: (x) => x > 0 && x < 1,
        xs: [0.05, 0.1, 0.25, 0.5, 0.64, 0.75, 0.9, 0.99],
        ys: [1],
        stmts: [
          { t: `${X}^2 < ${X}`, f: (x) => x * x < x },
          { t: `${X}^3 < ${X}^2`, f: (x) => x ** 3 < x * x },
          { t: `\\dfrac{1}{${X}} > 1`, f: (x) => 1 / x > 1 },
          { t: `\\sqrt{${X}} > ${X}`, f: (x) => Math.sqrt(x) > x },
          { t: `${X}(1 - ${X}) > 0`, f: (x) => x * (1 - x) > 0 },
          { t: `\\dfrac{1}{${X}} > ${X}`, f: (x) => 1 / x > x },
          { t: `${X}^2 > ${X}`, f: (x) => x * x > x },
          { t: `\\dfrac{1}{${X}} < ${X}`, f: (x) => 1 / x < x },
          { t: `${X}^3 > ${X}^2`, f: (x) => x ** 3 > x * x },
          { t: `\\sqrt{${X}} < ${X}`, f: (x) => Math.sqrt(x) < x },
          { t: `${X}^2 > \\dfrac{1}{4}`, f: (x) => x * x > 0.25 },
        ],
      };
  }
}

type FamilyId = Parameters<typeof family>[0];

interface MustParams {
  fam: FamilyId;
  names: [string, string];
  a: number;
  b: number;
  /** indices into the family's statements, in choice order */
  picks: number[];
}

const NAMES: [string, string][] = [
  ['x', 'y'],
  ['a', 'b'],
  ['m', 'n'],
  ['p', 'q'],
  ['u', 'v'],
];

const mustBeTrueMCM: Template<MustParams> = {
  id: 'alg.qc-algebra.must-be-true-mcm',
  skill: 'alg.qc-algebra',
  format: 'mcm',
  style: 'which statements must be true under a condition on two numbers',
  generate(rng, d) {
    for (;;) {
      const names = rng.pick(NAMES);
      const fam: FamilyId = rng.pick(d === 1 ? (['opposite', 'negatives'] as const) : d === 2 ? (['negatives', 'bounds'] as const) : (['bounds', 'squares', 'fraction'] as const));
      let a = 0;
      let b = 0;
      if (fam === 'bounds') {
        a = intExcept(rng, d === 2 ? -6 : -12, d === 2 ? 6 : 12, 0);
        b = intExcept(rng, d === 2 ? -6 : -12, d === 2 ? 6 : 12, 0, a);
      }
      const F = family(fam, names[0], names[1], a, b);
      const pts: [number, number][] = [];
      for (const x of F.xs) for (const y of F.ys) if (F.ok(x, y)) pts.push([x, y]);
      if (!pts.length) continue;
      const truth = F.stmts.map((s) => pts.every(([x, y]) => s.f(x, y)));
      const goodIdx = F.stmts.flatMap((_s, i) => (truth[i] ? [i] : []));
      const badIdx = F.stmts.flatMap((_s, i) => (truth[i] ? [] : [i]));
      const total = d === 1 ? 4 : d === 2 ? 5 : 6;
      const nGood = d === 1 ? rng.int(1, 2) : d === 2 ? rng.int(2, 3) : rng.int(2, 4);
      const nBad = total - nGood;
      if (goodIdx.length < nGood || badIdx.length < nBad) continue;
      const picks = rng.shuffle([...rng.sample(goodIdx, nGood), ...rng.sample(badIdx, nBad)]);
      const items = picks.map((i) => ({ i, ok: truth[i], s: F.stmts[i] }));
      const { choices, answer } = flaggedChoices(
        items.map((it) => ({ text: `$${it.s.t}$`, correct: it.ok, ...(it.ok ? {} : { trap: it.s.sq ? 'alg-must-square-order' : 'alg-must-one-example' }) })),
      );
      const simple = [...pts].sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - Math.abs(q[0]) - Math.abs(q[1]));
      const lines = items.map((it, k) => {
        if (it.ok) return `- ${letter(k)}: true for every allowed pair, as the condition shows.`;
        const [x, y] = simple.find(([px, py]) => !it.s.f(px, py))!;
        return `- ${letter(k)}: fails for $${names[0]} = ${num(x)}$${fam === 'fraction' ? '' : ` and $${names[1]} = ${num(y)}$`}, which satisfy the condition.`;
      });
      const wi = items.findIndex((it) => !it.ok);
      const trapLine = items[wi].s.sq
        ? `choice ${letter(wi)} is tempting because squares and absolute values seem to keep the order, but negative numbers reverse it.`
        : `choice ${letter(wi)} holds for some allowed pairs, so it looks right, but one allowed pair breaks it.`;
      const explanation = `"Must be true" means true for every pair that satisfies the condition, so read the condition first. ${F.fact}

Check each statement against that. A statement is rejected as soon as one allowed pair breaks it:
${lines.join('\n')}

Trap: ${trapLine}

Rule: to show a statement must be true, argue from the condition; to show it need not be, find one allowed pair that breaks it.`;
      return {
        params: { fam, names, a, b, picks },
        q: {
          format: 'mcm',
          stem: `If $${F.premise}$, which of the following must be true?`,
          instruction: 'Indicate all such statements.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { fam, names, a, b, picks }, rng) {
    if (q.format !== 'mcm') return 'wrong format';
    const F = family(fam, names[0], names[1], a, b);
    // Independent evidence: special values plus random reals that satisfy the condition.
    const xs: number[] = [...SPECIAL];
    const ys: number[] = [...SPECIAL];
    for (let i = 0; i < 120; i++) {
      const scale = rng.pick([0.5, 1, 5, 30]);
      xs.push((rng.next() * 2 - 1) * scale + (fam === 'bounds' ? a : 0));
      ys.push((rng.next() * 2 - 1) * scale + (fam === 'bounds' ? b : 0));
    }
    if (fam === 'bounds') {
      for (const k of [0.01, 0.3, 4, 100]) {
        xs.push(a + k);
        ys.push(b - k);
      }
    }
    if (fam === 'fraction') for (let i = 1; i < 100; i++) xs.push(i / 100);
    const pts: [number, number][] = [];
    for (const x of xs) for (const y of fam === 'fraction' ? [1] : ys) if (F.ok(x, y)) pts.push([x, y]);
    if (pts.length < 10) return 'too few allowed samples';
    const expected = picks.flatMap((idx, k) => (pts.every(([x, y]) => F.stmts[idx].f(x, y)) ? [k] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(expected)}, keyed ${JSON.stringify(q.answer)}`;
  },
};

export const mustTemplates: Template<any>[] = [mustBeTrueMCM];
