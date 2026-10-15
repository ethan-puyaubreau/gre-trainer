import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

export const exponentsFractionalTraps: Record<string, Trap> = {
  'int-exponent-fraction-divides': {
    label: 'Divided the power by the root index',
    fix: 'In $a^{m/q}$ the denominator $q$ is the INDEX of a root, not a divisor: $a^{m/q} = (\\sqrt[q]{a})^m$. For example $8^{2/3} = 2^2 = 4$, not $64 \\div 3$.',
  },
  'int-root-times-exponent': {
    label: 'Multiplied the root by the exponent numerator',
    fix: 'The numerator is a POWER of the root: $(\\sqrt[3]{8})^2 = 2^2 = 4$, not $2 \\cdot 2$ from multiplying by 2. Raise, do not multiply.',
  },
  'int-negative-fractional-sign': {
    label: 'Made the result negative',
    fix: 'A negative exponent means a reciprocal, never a negative number: $8^{-2/3} = \\frac{1}{4}$, not $-4$.',
  },
  'int-negative-fractional-ignored': {
    label: 'Ignored the negative sign of the exponent',
    fix: 'A negative exponent flips the base: $a^{-k} = \\frac{1}{a^k}$. Evaluate the positive power, then take the reciprocal.',
  },
};

interface Params {
  top: number;
  bottom: number; // 1 when the base is a whole number
  m: number;
  q: number;
  neg: boolean;
}

const pw = (b: number, e: number) => (e === 1 ? `${b}` : `${b}^{${e}}`);
const rt = (q: number, v: number) => (q === 2 ? `\\sqrt{${num(v)}}` : `\\sqrt[${q}]{${num(v)}}`);
const expTex = (m: number, q: number, neg: boolean) => `${neg ? '-' : ''}\\frac{${m}}{${q}}`;

const fractional: Template<Params> = {
  id: 'arith.exponents.fractional-ne',
  skill: 'arith.exponents',
  format: 'ne',
  style: 'value of a fractional exponent, negative or on a fraction',
  generate(rng, d) {
    const q = rng.pick(d === 3 ? [2, 3] : [2, 3, 4]);
    const m = rng.int(1, d === 3 ? 3 : 5);
    if (gcd(m, q) !== 1) return fractional.generate(rng, d);
    const frame = rng.pick(['What is the value of', 'What is the numerical value of', 'What number is equal to']);
    if (d < 3) {
      const r = rng.int(2, q === 2 ? 9 : q === 3 ? 6 : 5);
      const B = r ** q;
      const neg = d === 2;
      if (r ** m > 1000) return fractional.generate(rng, d);
      const pos = frac(r ** m);
      const answer = neg ? pos.inv() : pos;
      const traps: { value: Frac; trap: string }[] = [];
      if (neg) {
        traps.push({ value: pos.neg().inv(), trap: 'int-negative-fractional-sign' }, { value: pos, trap: 'int-negative-fractional-ignored' });
      } else {
        if (B ** m < 1e6) traps.push({ value: frac(B ** m, q), trap: 'int-exponent-fraction-divides' });
        if (r * m !== r ** m) traps.push({ value: frac(r * m), trap: 'int-root-times-exponent' });
      }
      return {
        params: { top: B, bottom: 1, m, q, neg },
        q: {
          format: 'ne',
          stem: `${frame} $${num(B)}^{${expTex(m, q, neg)}}$?`,
          answer,
          fractionBoxes: neg,
          traps: traps.filter((t) => !t.value.eq(answer)),
          explanation: `A fractional exponent is a root and a power: $a^{m/q} = (\\sqrt[q]{a})^m$, with $q$ the index of the root.

Here $${rt(q, B)} = ${r}$ because $${r}^{${q}} = ${num(B)}$. So $${num(B)}^{${m}/${q}} = ${pw(r, m)}${r ** m === r ? '' : ` = ${num(r ** m)}`}$${
            neg ? `. The negative sign of the exponent takes the reciprocal: $${num(B)}^{-${m}/${q}} = \\frac{1}{${num(r ** m)}}$` : ''
          }.

Check: $${r}^{${q}} = ${num(B)}$, so ${r} is the right root${neg ? ', and a reciprocal of a positive number stays positive' : `, and $${pw(r, m)}$ is a power of it`}.

Trap: ${neg ? 'a negative exponent never makes the number negative' : 'the denominator of the exponent is not a divisor'}.

Rule: the denominator is the root, the numerator is the power${neg ? ', and a negative sign means a reciprocal' : ''}.`,
        },
      };
    }
    // d3: fraction base with a negative fractional exponent
    const r = rng.int(2, 7);
    const s = rng.int(2, 7);
    if (r === s || gcd(r, s) !== 1) return fractional.generate(rng, d);
    const top = r ** q;
    const bottom = s ** q;
    const answer = new Frac(s ** m, r ** m);
    return {
      params: { top, bottom, m, q, neg: true },
      q: {
        format: 'ne',
        stem: `${frame} $\\left(\\frac{${num(top)}}{${num(bottom)}}\\right)^{-\\frac{${m}}{${q}}}$?`,
        answer,
        fractionBoxes: true,
        traps: [
          { value: new Frac(r ** m, s ** m), trap: 'int-negative-fractional-ignored' },
          { value: answer.neg(), trap: 'int-negative-fractional-sign' },
        ],
        explanation: `A negative exponent flips the fraction, and the fractional part takes a root and a power.

The expression becomes $\\left(\\frac{${num(bottom)}}{${num(top)}}\\right)^{${m}/${q}}$. The ${q === 2 ? 'square' : 'cube'} root of each part is $${rt(q, bottom)} = ${s}$ and $${rt(q, top)} = ${r}$, so the value is $${m === 1 ? `\\frac{${s}}{${r}}` : `\\left(\\frac{${s}}{${r}}\\right)^{${m}} = \\frac{${num(s ** m)}}{${num(r ** m)}}`}$.

Check: $${s}^{${q}} = ${num(bottom)}$ and $${r}^{${q}} = ${num(top)}$.

Trap: leaving the fraction unflipped gives the reciprocal, $\\frac{${num(r ** m)}}{${num(s ** m)}}$.

Rule: flip for a negative exponent, take the root, then raise to the power.`,
      },
    };
  },
  check(q, { top, bottom, m, q: idx, neg }) {
    if (q.format !== 'ne') return 'wrong format';
    const v = Math.pow(top / bottom, (neg ? -m : m) / idx);
    const got = q.answer.toNumber();
    return Math.abs(got - v) <= 1e-9 * Math.max(1, Math.abs(v)) ? null : `expected ${v}, got ${got}`;
  },
};

export const exponentsFractionalTemplates = [fractional];
