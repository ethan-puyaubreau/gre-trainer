import { textChoices } from '../../../engine/build';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

export const exponentsFactorSumTraps: Record<string, Trap> = {
  'int-divide-first-term-only': {
    label: 'Divided only the first term by the denominator',
    fix: 'A denominator divides the WHOLE numerator: $\\frac{a + b}{c} = \\frac{a}{c} + \\frac{b}{c}$. Factor the common power out of both terms instead.',
  },
  'int-sum-of-powers-merged': {
    label: '$B^{x} + B^{y} = B^{x + y}$',
    fix: 'Powers multiply, they do not add: $2^{3} + 2^{2} = 12$, not $2^{5} = 32$. To add them, factor the smaller power: $2^{2}(2 + 1)$.',
  },
  'int-dropped-factor-one': {
    label: 'Lost the second term when factoring',
    fix: 'Factoring $B^{y}$ from $B^{x} + B^{y}$ leaves $B^{y}(B^{x - y} + 1)$. The second term becomes $1$, it does not vanish.',
  },
  'int-common-power-dropped': {
    label: 'Forgot the common power outside the bracket',
    fix: 'After factoring $B^{y}$ it stays as a factor: $\\frac{B^{y}(\\ldots)}{B^{z}} = B^{y - z}(\\ldots)$. Multiply it back in.',
  },
  'int-coefficient-dropped': {
    label: 'Lost the coefficient of the second term',
    fix: 'Factoring $B^{y}$ from $a B^{x} + c B^{y}$ leaves $a B^{x - y} + c$. The coefficient $c$ stays.',
  },
};

interface Params {
  B: number;
  x: number;
  y: number;
  z: number;
  a: number;
  c: number;
  sign: 1 | -1;
  values: number[];
  answer: number;
}

const pw = (B: number, k: number) => (k === 1 ? `${B}` : `${B}^{${k}}`);
const term = (coef: number, B: number, k: number) => `${coef === 1 ? '' : coef}${coef === 1 ? '' : '\\cdot '}${pw(B, k)}`;

const factorSum: Template<Params> = {
  id: 'arith.exponents.factor-sum-mcs',
  skill: 'arith.exponents',
  format: 'mcs',
  style: 'sum or difference of powers over a power: factor out the common power',
  generate(rng, d) {
    const B = rng.pick(d === 1 ? [2, 3, 5] : [2, 3, 5]);
    const gap = d === 1 ? rng.int(1, 2) : d === 2 ? rng.int(3, 4) : rng.int(1, 3);
    const yMax = B === 2 ? 9 : B === 3 ? 6 : 4;
    const y = rng.int(3, yMax);
    const z = rng.int(1, y - 1);
    const x = y + gap;
    const sign = rng.sign();
    const a = d === 3 ? rng.int(2, 5) : 1;
    const c = d === 3 ? rng.int(2, 5) : 1;
    if (d === 3 && (a === c || a === B || c === B)) return factorSum.generate(rng, d);
    const inner = a * B ** gap + sign * c;
    const value = B ** (y - z) * inner;
    if (inner <= 1 || value > 200000) return factorSum.generate(rng, d);
    const pool: { v: number; trap: string }[] = [
      { v: a * B ** (x - z) + sign * c * B ** y, trap: 'int-divide-first-term-only' },
      { v: B ** (y - z) * a * B ** gap, trap: 'int-dropped-factor-one' },
      { v: a * B ** gap + sign * c, trap: 'int-common-power-dropped' },
    ];
    if (d < 3) pool.push({ v: sign > 0 ? B ** (x + y - z) : B ** (x - y - z), trap: 'int-sum-of-powers-merged' });
    if (d === 3) pool.push({ v: B ** (y - z) * (a * B ** gap + sign), trap: 'int-coefficient-dropped' });
    const seen = new Set<number>([value]);
    const wrong = rng.shuffle(pool).filter((w) => w.v >= 2 && w.v <= 1e7 && Number.isInteger(w.v) && !seen.has(w.v) && (seen.add(w.v), true));
    if (wrong.length < 4) return factorSum.generate(rng, d);
    const picked = wrong.slice(0, 4);
    const { choices, answer } = textChoices(
      rng,
      `$${num(value)}$`,
      picked.map((w) => ({ text: `$${num(w.v)}$`, trap: w.trap })),
    );
    const values = choices.map((c) => [value, ...picked.map((w) => w.v)].find((v) => `$${num(v)}$` === c.text)!);
    const op = sign > 0 ? '+' : '-';
    const top = sign > 0 && rng.chance(0.5) ? `${term(c, B, y)} + ${term(a, B, x)}` : `${term(a, B, x)} ${op} ${term(c, B, y)}`;
    const frame = rng.pick(['What is the value of', 'What is the value of the expression']);
    const numerator = a * B ** x + sign * c * B ** y;
    const slipText: Record<string, string> = {
      'int-divide-first-term-only': 'dividing only the first term by the denominator',
      'int-sum-of-powers-merged': 'merging the two powers into one',
      'int-dropped-factor-one': 'losing the second term when factoring',
      'int-common-power-dropped': 'dropping the common power',
      'int-coefficient-dropped': 'losing the coefficient of the second term',
    };
    return {
      params: { B, x, y, z, a, c, sign, values, answer },
      q: {
        format: 'mcs',
        stem: `${frame} $\\frac{${top}}{${pw(B, z)}}$?`,
        choices,
        answer,
        explanation: `Both terms contain $${pw(B, y)}$, so factor the smaller power out of the numerator rather than computing each power.

$\\frac{${pw(B, y)}\\left(${a === 1 ? '' : `${a}\\cdot `}${pw(B, gap)} ${op} ${c}\\right)}{${pw(B, z)}} = ${pw(B, y - z)}\\cdot ${inner}${pw(B, y - z) === num(B ** (y - z)) ? '' : ` = ${num(B ** (y - z))}\\cdot ${inner}`} = ${num(value)}$.

Check: $${num(value)} \\cdot ${num(B ** z)} = ${num(numerator)}$, the value of the numerator.

Trap: ${slipText[picked[0].trap]} gives $${num(picked[0].v)}$.

Rule: factor the smallest power out of a sum or difference of powers, then cancel what the denominator shares with it.`,
      },
    };
  },
  check(q, { B, x, y, z, a, c, sign, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    const N = BigInt(a) * BigInt(B) ** BigInt(x) + BigInt(sign) * BigInt(c) * BigInt(B) ** BigInt(y);
    const D = BigInt(B) ** BigInt(z);
    const hits = values.map((v, i) => [i, BigInt(v) * D === N] as const).filter(([, ok]) => ok);
    if (hits.length !== 1) return `${hits.length} choices equal the quotient`;
    return hits[0][0] === q.answer ? null : `answer should be ${hits[0][0]}`;
  },
};

export const exponentsFactorSumTemplates = [factorSum];
