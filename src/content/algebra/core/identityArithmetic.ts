import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

/* Big-number arithmetic that collapses with an algebraic identity (NE). */

type Variant = 'diffsq' | 'sqsum' | 'sqdiff' | 'factorsum' | 'conj' | 'cubes' | 'symquot' | 'resid';

interface P {
  variant: Variant;
  n: number[];
}

interface Trap0 {
  value: number;
  trap: string;
  why: string;
}

const pow2 = (z: number) => `${num(z)}^{2}`;
const DIFFS = {
  1: ['diffsq', 'sqsum', 'factorsum', 'diffsq'],
  2: ['diffsq', 'conj', 'sqdiff', 'factorsum', 'conj'],
  3: ['cubes', 'symquot', 'resid', 'cubes'],
} as const;

/** The expression as a student would write it, and its value by brute-force arithmetic. */
function direct(v: Variant, n: number[]): number {
  switch (v) {
    case 'diffsq':
      return n[0] * n[0] - n[1] * n[1];
    case 'sqsum':
      return n[0] * n[0] + 2 * n[0] * n[1] + n[1] * n[1];
    case 'sqdiff':
      return n[0] * n[0] - 2 * n[0] * n[1] + n[1] * n[1];
    case 'factorsum':
      return n[3] === 1 ? n[0] * n[1] + n[0] * n[2] : n[0] * n[1] - n[0] * n[2];
    case 'conj':
      return (n[0] - n[1]) * (n[0] + n[1]);
    case 'cubes':
      return (n[0] ** 3 - n[1] ** 3) / (n[0] - n[1]);
    case 'symquot':
      return ((n[0] + n[1]) ** 2 - (n[0] - n[1]) ** 2) / n[0];
    case 'resid':
      return n[2] * n[2] - n[0] * n[0] - n[1] * n[1];
  }
}

const identityArithmeticNE: Template<P> = {
  id: 'alg.expressions.identity-arithmetic-ne',
  skill: 'alg.expressions',
  format: 'ne',
  style: 'big-number arithmetic that an identity makes short',
  generate(rng, d) {
    const variant = rng.pick(DIFFS[d]) as Variant;
    let n: number[];
    let stem: string;
    let ans: number;
    let traps: Trap0[];
    let body: string;
    let check: string;
    if (variant === 'diffsq') {
      const k = rng.int(2, d === 1 ? 6 : 9);
      const b = d === 1 ? rng.int(21, 90) : rng.int(101, 480);
      const a = b + k;
      n = [a, b];
      ans = k * (a + b);
      stem = `What is the value of $${pow2(a)} - ${pow2(b)}$?`;
      body = `Squaring two large numbers is slow, so factor: a difference of squares is $x^{2} - y^{2} = (x - y)(x + y)$. Here $(${num(a)} - ${num(b)})(${num(a)} + ${num(b)}) = ${num(k)} \\cdot ${num(a + b)} = ${num(ans)}$.`;
      check = `Check: $${pow2(a)} = ${num(a * a)}$ and $${pow2(b)} = ${num(b * b)}$, and they differ by $${num(ans)}$.`;
      traps = [
        { value: k * k, trap: 'alg-diffsq-as-square-of-diff', why: `computing $(x - y)^{2}$ instead` },
        { value: a + b, trap: 'alg-diffsq-dropped-factor', why: `forgetting the factor $x - y$` },
      ];
    } else if (variant === 'sqsum' || variant === 'sqdiff') {
      const plus = variant === 'sqsum';
      const S = plus ? rng.pick([50, 100, 100, 200, 500]) : rng.pick([10, 20, 30, 40, 50]);
      let a: number;
      let b: number;
      if (plus) {
        a = rng.int(11, S - 11);
        b = S - a;
      } else {
        b = rng.int(d === 1 ? 11 : 31, d === 1 ? 70 : 480);
        a = b + S;
      }
      n = [a, b];
      ans = S * S;
      stem = `What is the value of $${pow2(a)} ${plus ? '+' : '-'} 2 \\cdot ${num(a)} \\cdot ${num(b)} + ${pow2(b)}$?`;
      body = `The three terms have the shape $x^{2} ${plus ? '+' : '-'} 2xy + y^{2}$, which is $(x ${plus ? '+' : '-'} y)^{2}$. So the value is $(${num(a)} ${plus ? '+' : '-'} ${num(b)})^{2} = ${num(S)}^{2} = ${num(ans)}$.`;
      check = `Check with a smaller pair of the same shape: $${pow2(7)} ${plus ? '+' : '-'} 2 \\cdot 7 \\cdot 3 + ${pow2(3)} = ${plus ? 100 : 16} = ${plus ? '10' : '4'}^{2}$.`;
      traps = [
        { value: a * a + b * b, trap: 'alg-sq-no-cross-term', why: `dropping the middle term` },
        { value: plus ? a * a + a * b + b * b : S, trap: plus ? 'alg-middle-term-half' : 'alg-forgot-square', why: plus ? `using $xy$ instead of $2xy$ as the middle term` : `stopping at $x - y$ without squaring it` },
      ];
    } else if (variant === 'factorsum') {
      const plus = rng.chance(0.6);
      const S = plus ? rng.pick([50, 100, 100, 200]) : rng.pick([10, 20, 30, 40]);
      const c = rng.int(d === 1 ? 12 : 31, d === 1 ? 49 : 98);
      let b: number;
      let a: number;
      if (plus) {
        a = rng.int(11, S - 11);
        b = S - a;
      } else {
        b = rng.int(11, 60);
        a = b + S;
      }
      n = [c, a, b, plus ? 1 : -1];
      ans = c * S;
      stem = `What is the value of $${num(c)} \\cdot ${num(a)} ${plus ? '+' : '-'} ${num(c)} \\cdot ${num(b)}$?`;
      body = `Both terms contain the factor ${num(c)}, so pull it out: $${num(c)}(${num(a)} ${plus ? '+' : '-'} ${num(b)}) = ${num(c)} \\cdot ${num(S)} = ${num(ans)}$.`;
      check = `Check by multiplying out: $${num(c * a)} ${plus ? '+' : '-'} ${num(c * b)} = ${num(ans)}$.`;
      traps = [
        { value: plus ? c * a + b : c * a - b, trap: 'alg-distribute-partial', why: `multiplying ${num(c)} into the first number only` },
        { value: S, trap: 'alg-dropped-factor', why: `forgetting the common factor ${num(c)}` },
      ];
    } else if (variant === 'conj') {
      const m = rng.pick(d === 2 ? [50, 60, 70, 80, 90, 100, 200, 300] : [10, 20, 30, 40, 50]);
      const k = rng.int(2, d === 2 ? 9 : 5);
      n = [m, k];
      ans = m * m - k * k;
      stem = `What is the value of $${num(m - k)} \\cdot ${num(m + k)}$?`;
      body = `The two factors sit the same distance $${k}$ on either side of ${num(m)}: $${num(m - k)} = ${num(m)} - ${k}$ and $${num(m + k)} = ${num(m)} + ${k}$. So the product is a difference of squares, $(x - y)(x + y) = x^{2} - y^{2}$, which is $${pow2(m)} - ${pow2(k)} = ${num(m * m)} - ${k * k} = ${num(ans)}$.`;
      check = `Check the last digit: the units digits multiply to ${((m - k) % 10) * ((m + k) % 10)}, which ends in ${ans % 10}, the last digit of $${num(ans)}$.`;
      traps = [
        { value: m * m, trap: 'alg-product-near-square', why: `squaring the middle number only` },
        { value: m * m - k, trap: 'alg-diffsq-linear-k', why: `subtracting $${k}$ instead of $${k * k}$` },
      ];
    } else if (variant === 'cubes') {
      const k = rng.int(2, 5);
      const b = rng.int(4, 40);
      const a = b + k;
      n = [a, b];
      ans = a * a + a * b + b * b;
      stem = `What is the value of $\\dfrac{${num(a)}^{3} - ${num(b)}^{3}}{${k}}$?`;
      body = `The numerator is a difference of cubes and the denominator is $${num(a)} - ${num(b)}$, so use $x^{3} - y^{3} = (x - y)(x^{2} + xy + y^{2})$. The factor $${k}$ cancels, leaving $${pow2(a)} + ${num(a)} \\cdot ${num(b)} + ${pow2(b)} = ${num(a * a)} + ${num(a * b)} + ${num(b * b)} = ${num(ans)}$.`;
      check = `Check: $${num(a)}^{3} - ${num(b)}^{3} = ${num(a ** 3)} - ${num(b ** 3)} = ${num(a ** 3 - b ** 3)}$, and $${num(a ** 3 - b ** 3)} \\div ${k} = ${num(ans)}$.`;
      traps = [
        { value: a * a + b * b, trap: 'alg-cube-diff-missing-middle', why: `using $x^{2} + y^{2}$ as the second factor` },
        { value: a * a - a * b + b * b, trap: 'alg-cube-diff-wrong-sign', why: `using $x^{2} - xy + y^{2}$, the factor of a sum of cubes` },
        { value: k * k, trap: 'alg-cube-diff-as-cube-of-diff', why: `computing $(x - y)^{2}$ instead` },
      ];
    } else if (variant === 'symquot') {
      const m = rng.int(101, 499);
      const k = rng.int(2, 9);
      n = [m, k];
      ans = 4 * k;
      stem = `What is the value of $\\dfrac{${pow2(m + k)} - ${pow2(m - k)}}{${num(m)}}$?`;
      body = `The two squares are centered on ${num(m)}: $${num(m + k)} = ${num(m)} + ${k}$ and $${num(m - k)} = ${num(m)} - ${k}$. In $(m + k)^{2} - (m - k)^{2}$ the squares and the constants cancel and only the cross terms are left: $2mk - (-2mk) = 4mk$. So the quotient is $\\frac{4 \\cdot ${num(m)} \\cdot ${k}}{${num(m)}} = ${num(ans)}$.`;
      check = `Check: $${num(m + k)}^{2} - ${num(m - k)}^{2} = ${num((m + k) ** 2 - (m - k) ** 2)} = ${num(ans)} \\cdot ${num(m)}$.`;
      traps = [
        { value: 2 * k, trap: 'alg-middle-term-half', why: `counting the cross terms once instead of twice` },
        { value: 2 * k * k, trap: 'alg-symquot-square-k', why: `keeping only $k^{2}$ terms` },
      ];
    } else {
      const a = rng.int(11, 60);
      let b: number;
      do b = rng.int(11, 60);
      while (b === a);
      const c = a + b;
      n = [a, b, c];
      ans = 2 * a * b;
      stem = `What is the value of $${pow2(c)} - ${pow2(a)} - ${pow2(b)}$?`;
      body = `Notice that $${num(c)} = ${num(a)} + ${num(b)}$. Then $${pow2(c)} = (${num(a)} + ${num(b)})^{2} = ${pow2(a)} + 2 \\cdot ${num(a)} \\cdot ${num(b)} + ${pow2(b)}$, so subtracting the two squares leaves only the middle term: $2 \\cdot ${num(a)} \\cdot ${num(b)} = ${num(ans)}$.`;
      check = `Check with a small case: $${pow2(5)} - ${pow2(2)} - ${pow2(3)} = 25 - 4 - 9 = 12 = 2 \\cdot 2 \\cdot 3$.`;
      traps = [
        { value: 0, trap: 'alg-sq-no-cross-term', why: `treating $(x + y)^{2}$ as $x^{2} + y^{2}$` },
        { value: a * b, trap: 'alg-middle-term-half', why: `using $xy$ instead of $2xy$ as the middle term` },
      ];
    }
    const seen = new Set<number>([ans]);
    const keep = traps.filter((t) => (seen.has(t.value) ? false : (seen.add(t.value), true)));
    const cited = keep[0];
    return {
      params: { variant, n },
      q: {
        format: 'ne',
        stem,
        answer: Frac.of(ans),
        traps: keep.map((t) => ({ value: Frac.of(t.value), trap: t.trap })),
        explanation: `${d === 3 ? 'Look for the identity hidden in the numbers before calculating.' : 'Big numbers hide a pattern: look for an identity before calculating.'}

${body}

${check}${cited ? `\n\nTrap: $${num(cited.value)}$ comes from ${cited.why}, which changes the expression.` : ''}

Rule: recognize $x^{2} \\pm y^{2}$, $x^{2} \\pm 2xy + y^{2}$ or a common factor, and use the identity instead of multiplying.`,
      },
    };
  },
  check(q, { variant, n }) {
    if (q.format !== 'ne') return 'wrong format';
    const v = direct(variant, n);
    return q.answer.eq(Frac.of(v)) ? null : `brute force gives ${v}`;
  },
};

export const identityArithmeticTemplate = identityArithmeticNE;
export const identityArithmeticTraps: Record<string, Trap> = {
  'alg-diffsq-as-square-of-diff': {
    label: '$x^2 - y^2 = (x - y)^2$',
    fix: 'A difference of squares factors as $(x - y)(x + y)$. Test: $5^2 - 3^2 = 16$, while $(5 - 3)^2 = 4$.',
  },
  'alg-diffsq-dropped-factor': {
    label: 'Kept only one factor of a difference of squares',
    fix: '$x^2 - y^2 = (x - y)(x + y)$: multiply both factors, do not stop at the sum.',
  },
  'alg-forgot-square': {
    label: 'Took the root of the perfect square but not the square',
    fix: '$x^2 - 2xy + y^2 = (x - y)^2$: after finding $x - y$, square it.',
  },
  'alg-product-near-square': {
    label: 'Used the middle number squared as the product',
    fix: 'Two numbers on either side of $m$ multiply to $m^2 - k^2$, not $m^2$: $49 \\cdot 51 = 50^2 - 1 = 2{,}499$.',
  },
  'alg-diffsq-linear-k': {
    label: 'Subtracted $k$ instead of $k^2$',
    fix: '$(m - k)(m + k) = m^2 - k^2$: the offset is squared. $48 \\cdot 52 = 50^2 - 2^2 = 2{,}496$.',
  },
  'alg-cube-diff-missing-middle': {
    label: '$x^3 - y^3 = (x - y)(x^2 + y^2)$',
    fix: 'The second factor has a middle term: $x^3 - y^3 = (x - y)(x^2 + xy + y^2)$.',
  },
  'alg-cube-diff-wrong-sign': {
    label: 'Used $x^2 - xy + y^2$ for a difference of cubes',
    fix: 'That factor belongs to the SUM of cubes: $x^3 + y^3 = (x + y)(x^2 - xy + y^2)$. For the difference, $x^3 - y^3 = (x - y)(x^2 + xy + y^2)$.',
  },
  'alg-cube-diff-as-cube-of-diff': {
    label: '$x^3 - y^3 = (x - y)^3$',
    fix: '$(x - y)^3$ has middle terms $-3x^2y + 3xy^2$; the difference of cubes factors as $(x - y)(x^2 + xy + y^2)$.',
  },
  'alg-symquot-square-k': {
    label: 'Kept only the squared constants',
    fix: 'In $(m + k)^2 - (m - k)^2$ the $m^2$ and $k^2$ terms cancel; only the cross terms $2mk$ and $2mk$ survive.',
  },
};
