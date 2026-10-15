import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { close, trapChoices } from './util';

/* Value of a symmetric expression from a given sum (or difference) and product, without solving (MCS). */

type Variant = 'sumsq' | 'diffsq' | 'sqdiff' | 'recipsq' | 'scaled' | 'cube' | 'recipcube';

interface P {
  variant: Variant;
  /** the given numbers: sumsq/sqdiff/cube [s, p]; diffsq [d, p]; recipsq/recipcube [k]; scaled [a, b, s, p] */
  g: number[];
  ans: number;
  values: number[];
}

const NAMES = [['x', 'y'], ['a', 'b'], ['m', 'n'], ['u', 'v'], ['p', 'q']];
const DIFFS = { 1: ['sumsq', 'diffsq', 'sumsq'], 2: ['sumsq', 'diffsq', 'sqdiff', 'recipsq', 'sqdiff'], 3: ['scaled', 'cube', 'recipcube', 'scaled', 'cube'] } as const;

const sq = (z: number) => z * z;
const par = (z: number) => `(${num(z)})`;
const pw = (z: number) => (z < 0 ? par(z) : num(z));

interface Item {
  value: number;
  trap: string;
  why: string;
}

const pairOf = (rng: Parameters<Template<P>['generate']>[0], d: number): [number, number] => {
  for (;;) {
    const x = rng.int(1, 9) * (d === 1 ? 1 : rng.sign());
    const y = rng.int(1, 9) * (d === 1 ? 1 : rng.sign());
    if (x !== y && x !== -y) return [x, y];
  }
};

const sumProductMCS: Template<P> = {
  id: 'alg.expressions.sum-product-mcs',
  skill: 'alg.expressions',
  format: 'mcs',
  style: 'value of an expression from a given sum or difference and product',
  generate(rng, d) {
    for (;;) {
      const variant = rng.pick(DIFFS[d]) as Variant;
      const [X, Y] = rng.pick(NAMES);
      let g: number[];
      let stem: string;
      let method: string;
      let check: string;
      let ans: number;
      let items: Item[];
      let values: number[] = [];
      if (variant === 'sumsq' || variant === 'sqdiff' || variant === 'cube') {
        const [x, y] = pairOf(rng, variant === 'cube' || d === 3 ? 2 : d);
        const s = x + y;
        const p = x * y;
        g = [s, p];
        values = [x, y];
        const given = `$${X} + ${Y} = ${num(s)}$ and $${X}${Y} = ${num(p)}$`;
        if (variant === 'sumsq') {
          ans = sq(x) + sq(y);
          stem = `If ${given}, what is the value of $${X}^{2} + ${Y}^{2}$?`;
          method = `The question asks for $${X}^{2} + ${Y}^{2}$, and the given sum and product are the pieces of a square. Square the sum: $(${X} + ${Y})^{2} = ${X}^{2} + 2${X}${Y} + ${Y}^{2}$. So $${X}^{2} + ${Y}^{2} = (${X} + ${Y})^{2} - 2${X}${Y} = ${pw(s)}^{2} - 2${par(p)} = ${num(ans)}$.`;
          items = [
            { value: sq(s), trap: 'alg-sq-no-cross-term', why: `forgetting the middle term $2${X}${Y}$` },
            { value: sq(s) - p, trap: 'alg-middle-term-half', why: `using $${X}${Y}$ instead of $2${X}${Y}$ as the middle term` },
            { value: sq(s) + 2 * p, trap: 'alg-square-middle-sign', why: `adding the middle term instead of subtracting it` },
            { value: sq(s) - 4 * p, trap: 'alg-sq-diff-not-sum', why: `finding $(${X} - ${Y})^{2}$ instead` },
          ];
        } else if (variant === 'sqdiff') {
          ans = sq(x - y);
          stem = `If ${given}, what is the value of $(${X} - ${Y})^{2}$?`;
          method = `Compare $(${X} - ${Y})^{2}$ with the square of the sum: $(${X} - ${Y})^{2} = (${X} + ${Y})^{2} - 4${X}${Y}$, because $(${X} + ${Y})^{2}$ has the middle term $+2${X}${Y}$ and $(${X} - ${Y})^{2}$ has $-2${X}${Y}$, a gap of $4${X}${Y}$. So the value is $${pw(s)}^{2} - 4${par(p)} = ${num(ans)}$.`;
          items = [
            { value: sq(s) - 2 * p, trap: 'alg-sq-diff-not-sum', why: `finding $${X}^{2} + ${Y}^{2}$ instead` },
            { value: sq(s) + 4 * p, trap: 'alg-square-middle-sign', why: `adding the gap instead of subtracting it` },
            { value: sq(s) - p, trap: 'alg-middle-term-half', why: `taking the middle term as $${X}${Y}$` },
            { value: sq(s), trap: 'alg-sq-no-cross-term', why: `forgetting the middle terms` },
          ];
        } else {
          ans = x ** 3 + y ** 3;
          stem = `If ${given}, what is the value of $${X}^{3} + ${Y}^{3}$?`;
          method = `Cube the sum: $(${X} + ${Y})^{3} = ${X}^{3} + 3${X}${Y}(${X} + ${Y}) + ${Y}^{3}$. So $${X}^{3} + ${Y}^{3} = (${X} + ${Y})^{3} - 3${X}${Y}(${X} + ${Y}) = ${pw(s)}^{3} - 3${par(p)}${par(s)} = ${num(ans)}$.`;
          items = [
            { value: s ** 3, trap: 'alg-cube-no-cross-term', why: `leaving out the middle terms of the cube` },
            { value: s ** 3 - 3 * p, trap: 'alg-cube-cross-no-sum', why: `subtracting $3${X}${Y}$ but not multiplying it by $${X} + ${Y}$` },
            { value: s ** 3 - 2 * p * s, trap: 'alg-cube-coefficient', why: `using 2 instead of 3 in front of $${X}${Y}(${X} + ${Y})$` },
            { value: s ** 3 + 3 * p * s, trap: 'alg-cube-cross-sign', why: `adding the middle terms instead of subtracting them` },
          ];
        }
        check = `Check with $${X} = ${num(x)}$ and $${Y} = ${num(y)}$: they satisfy both equations and the expression is $${num(ans)}$.`;
      } else if (variant === 'diffsq') {
        const [x, y] = pairOf(rng, d);
        const dd = x - y;
        const p = x * y;
        g = [dd, p];
        values = [x, y];
        ans = sq(x) + sq(y);
        stem = `If $${X} - ${Y} = ${num(dd)}$ and $${X}${Y} = ${num(p)}$, what is the value of $${X}^{2} + ${Y}^{2}$?`;
        method = `Square the difference: $(${X} - ${Y})^{2} = ${X}^{2} - 2${X}${Y} + ${Y}^{2}$. So $${X}^{2} + ${Y}^{2} = (${X} - ${Y})^{2} + 2${X}${Y} = ${pw(dd)}^{2} + 2${par(p)} = ${num(ans)}$.`;
        items = [
          { value: sq(dd), trap: 'alg-sq-no-cross-term', why: `forgetting the middle term` },
          { value: sq(dd) - 2 * p, trap: 'alg-square-middle-sign', why: `subtracting the middle term instead of adding it back` },
          { value: sq(dd) + p, trap: 'alg-middle-term-half', why: `adding $${X}${Y}$ instead of $2${X}${Y}$` },
          { value: sq(dd) + 4 * p, trap: 'alg-sq-diff-not-sum', why: `finding $(${X} + ${Y})^{2}$ instead` },
        ];
        check = `Check with $${X} = ${num(x)}$ and $${Y} = ${num(y)}$: they satisfy both equations and the expression is $${num(ans)}$.`;
      } else if (variant === 'scaled') {
        const a = rng.int(2, 4);
        const b = rng.int(1, 3);
        const [x, y] = pairOf(rng, 2);
        const s = a * x + b * y;
        const p = x * y;
        if (s === 0) continue;
        g = [a, b, s, p];
        values = [x, y];
        ans = sq(a * x) + sq(b * y);
        const lead = (c: number, v: string) => (c === 1 ? v : `${c}${v}`);
        stem = `If $${lead(a, X)} + ${lead(b, Y)} = ${num(s)}$ and $${X}${Y} = ${num(p)}$, what is the value of $${a === 1 ? '' : a * a}${X}^{2} + ${b === 1 ? '' : b * b}${Y}^{2}$?`;
        method = `Square the given sum: $(${lead(a, X)} + ${lead(b, Y)})^{2} = ${a * a === 1 ? '' : a * a}${X}^{2} + ${2 * a * b}${X}${Y} + ${b * b === 1 ? '' : b * b}${Y}^{2}$. The middle term is $2 \\cdot ${lead(a, X)} \\cdot ${lead(b, Y)} = ${2 * a * b}${X}${Y}$, so the value is $${pw(s)}^{2} - ${2 * a * b}${par(p)} = ${num(ans)}$.`;
        items = [
          { value: sq(s), trap: 'alg-sq-no-cross-term', why: `forgetting the middle term` },
          { value: sq(s) - a * b * p, trap: 'alg-middle-term-half', why: `halving the middle term` },
          { value: sq(s) - 2 * p, trap: 'alg-coefficient-in-cross-term', why: `taking the middle term as $2${X}${Y}$ and ignoring the coefficients ${a} and ${b}` },
          { value: sq(s) + 2 * a * b * p, trap: 'alg-square-middle-sign', why: `adding the middle term instead of subtracting it` },
        ];
        check = `Check with $${X} = ${num(x)}$ and $${Y} = ${num(y)}$: they satisfy both equations and the expression is $${num(ans)}$.`;
      } else {
        const k = rng.int(3, 9) * rng.sign();
        g = [k];
        const cubic = variant === 'recipcube';
        ans = cubic ? k ** 3 - 3 * k : sq(k) - 2;
        const [Z] = rng.pick([['x'], ['t'], ['n']]);
        stem = `If $${Z} + \\dfrac{1}{${Z}} = ${num(k)}$, what is the value of $${Z}^{${cubic ? 3 : 2}} + \\dfrac{1}{${Z}^{${cubic ? 3 : 2}}}$?`;
        if (cubic) {
          method = `Cube the given sum: $\\left(${Z} + \\frac{1}{${Z}}\\right)^{3} = ${Z}^{3} + 3\\left(${Z} + \\frac{1}{${Z}}\\right) + \\frac{1}{${Z}^{3}}$, because the middle terms are $3${Z}^{2} \\cdot \\frac{1}{${Z}}$ and $3${Z} \\cdot \\frac{1}{${Z}^{2}}$. So the value is $${pw(k)}^{3} - 3${par(k)} = ${num(ans)}$.`;
          items = [
            { value: k ** 3, trap: 'alg-cube-no-cross-term', why: `leaving out the middle terms of the cube` },
            { value: k ** 3 - 3, trap: 'alg-cube-cross-no-sum', why: `subtracting 3 but not $3 \\cdot ${par(k)}$` },
            { value: k ** 3 - 2 * k, trap: 'alg-cube-coefficient', why: `using 2 instead of 3 for the middle terms` },
            { value: k ** 3 + 3 * k, trap: 'alg-cube-cross-sign', why: `adding the middle terms instead of subtracting them` },
          ];
          check = `Check the identity at $${Z} = 2$: $\\left(2 + \\frac{1}{2}\\right)^{3} - 3 \\cdot \\frac{5}{2} = \\frac{65}{8}$ and $2^{3} + \\frac{1}{2^{3}} = \\frac{65}{8}$.`;
        } else {
          method = `Square the given sum: $\\left(${Z} + \\frac{1}{${Z}}\\right)^{2} = ${Z}^{2} + 2 \\cdot ${Z} \\cdot \\frac{1}{${Z}} + \\frac{1}{${Z}^{2}} = ${Z}^{2} + 2 + \\frac{1}{${Z}^{2}}$. The middle term is 2, so the value is $${pw(k)}^{2} - 2 = ${num(ans)}$.`;
          items = [
            { value: sq(k), trap: 'alg-sq-no-cross-term', why: `forgetting the middle term 2` },
            { value: sq(k) + 2, trap: 'alg-square-middle-sign', why: `adding the middle term instead of subtracting it` },
            { value: sq(k) - 1, trap: 'alg-middle-term-half', why: `using 1 instead of 2 for the middle term` },
            { value: sq(k) - 4, trap: 'alg-sq-diff-not-sum', why: `finding $\\left(${Z} - \\frac{1}{${Z}}\\right)^{2}$ instead` },
          ];
          check = `Check the identity at $${Z} = 2$: $\\left(2 + \\frac{1}{2}\\right)^{2} - 2 = \\frac{17}{4}$ and $2^{2} + \\frac{1}{2^{2}} = \\frac{17}{4}$.`;
        }
      }
      const r = trapChoices(rng, ans, items, (v) => `$${num(v)}$`);
      if (!r) continue;
      const cited = r.kept[0];
      const known = values.length === 2 ? ` For the numbers above the true value is $${num(ans)}$.` : '';
      // sorted order piles the key in the middle slots, so shuffle
      const order = rng.shuffle(r.choices.map((_, i) => i));
      return {
        params: { variant, g, ans, values },
        q: {
          format: 'mcs',
          stem,
          choices: order.map((i) => r.choices[i]),
          answer: order.indexOf(r.answer),
          explanation: `Do not solve for the variables: build the expression asked for out of the combination you are given.

${method}

${check}

Trap: $${num(cited.value)}$ comes from ${cited.why}.${known}

Rule: square or cube the given combination, then correct for the middle terms.`,
        },
      };
    }
  },
  check(q, { variant, g, ans }) {
    if (q.format !== 'mcs') return 'wrong format';
    // Solve for the unknowns numerically and evaluate the asked expression at every solution.
    const sols: [number, number][] = [];
    const quad = (A: number, B: number, C: number) => {
      const disc = B * B - 4 * A * C;
      if (disc < 0) return [];
      return [(-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)];
    };
    let f: (x: number, y: number) => number;
    if (variant === 'sumsq' || variant === 'sqdiff' || variant === 'cube') {
      for (const x of quad(1, -g[0], g[1])) sols.push([x, g[0] - x]);
      f = variant === 'sumsq' ? (x, y) => x * x + y * y : variant === 'sqdiff' ? (x, y) => (x - y) ** 2 : (x, y) => x ** 3 + y ** 3;
    } else if (variant === 'diffsq') {
      // x - y = d and xy = p  ->  x(x - d) = p
      for (const x of quad(1, -g[0], -g[1])) sols.push([x, x - g[0]]);
      f = (x, y) => x * x + y * y;
    } else if (variant === 'scaled') {
      const [a, b, s, p] = g;
      for (const x of quad(a, -s, b * p)) sols.push([x, (s - a * x) / b]);
      f = (x, y) => (a * x) ** 2 + (b * y) ** 2;
    } else {
      for (const x of quad(1, -g[0], 1)) sols.push([x, 1 / x]);
      f = variant === 'recipsq' ? (x, y) => x * x + y * y : (x, y) => x ** 3 + y ** 3;
    }
    if (!sols.length) return 'no real solution';
    for (const [x, y] of sols) if (!close(f(x, y), ans, 1e-9)) return `expression is ${f(x, y)} at a solution, key says ${ans}`;
    const shown = q.choices[q.answer].text.replace(/[$,\s]|\{,\}/g, '');
    return Number(shown) === ans ? null : `answer choice ${shown} != ${ans}`;
  },
};

export const sumProductTemplate = sumProductMCS;
export const sumProductTraps: Record<string, Trap> = {
  'alg-sq-diff-not-sum': {
    label: 'Found $(x - y)^2$ when $x^2 + y^2$ was asked (or the reverse)',
    fix: '$x^2 + y^2 = (x + y)^2 - 2xy$ but $(x - y)^2 = (x + y)^2 - 4xy$. Read which expression the question asks for before substituting.',
  },
  'alg-coefficient-in-cross-term': {
    label: 'Ignored the coefficients in the middle term',
    fix: 'In $(3x + y)^2$ the middle term is $2 \\cdot 3x \\cdot y = 6xy$, not $2xy$: multiply the coefficients in.',
  },
  'alg-cube-no-cross-term': {
    label: '$(a + b)^3 = a^3 + b^3$',
    fix: 'A cube has middle terms: $(a + b)^3 = a^3 + 3ab(a + b) + b^3$.',
  },
  'alg-cube-cross-no-sum': {
    label: 'Forgot the factor $(a + b)$ in the middle terms of a cube',
    fix: 'The middle terms are $3a^2b + 3ab^2 = 3ab(a + b)$: multiply $3ab$ by the sum.',
  },
  'alg-cube-coefficient': {
    label: 'Used 2 instead of 3 as the middle coefficient of a cube',
    fix: 'The coefficients of $(a + b)^3$ are 1, 3, 3, 1 (not 1, 2, 2, 1).',
  },
  'alg-cube-cross-sign': {
    label: 'Added the middle terms when solving for $a^3 + b^3$',
    fix: 'Since $(a + b)^3 = a^3 + b^3 + 3ab(a + b)$, the sum of cubes is $(a + b)^3 - 3ab(a + b)$: subtract the middle terms.',
  },
};
