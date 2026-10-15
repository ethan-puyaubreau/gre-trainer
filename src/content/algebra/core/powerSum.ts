import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

/* A sum of powers with the unknown in the exponents: factor out the smallest power, solve for the power, then for x (NE). */

type Variant = 'two' | 'equal' | 'three' | 'coef' | 'mixed' | 'negshift';

/** c * B^(a x + b) */
interface PTerm {
  c: number;
  B: number;
  a: number;
  b: number;
}

interface P {
  terms: PTerm[];
  R: number;
  x: number;
  g: number;
}

const ORDER = { 1: ['two', 'two', 'equal'], 2: ['three', 'coef', 'equal', 'three', 'coef'], 3: ['mixed', 'negshift', 'mixed', 'coef'] } as const;

/** k such that g^k = v, for a positive integer v; null when v is not a power of g. */
function logInt(g: number, v: Frac): number | null {
  if (!v.isInt() || v.n < 1) return null;
  let k = 0;
  let p = 1;
  while (p < v.n && k < 60) {
    p *= g;
    k++;
  }
  return p === v.n ? k : null;
}

const termTex = (t: PTerm, first: boolean): string => {
  const ex = lin([[t.a, 'x'], [t.b, '']]);
  const pw = t.b === 0 && t.a === 1 ? `${t.B}^{x}` : `${t.B}^{${ex}}`;
  const mag = Math.abs(t.c);
  const body = mag === 1 ? pw : `${mag} \\cdot ${pw}`;
  return first ? (t.c < 0 ? `-${body}` : body) : `${t.c < 0 ? ' - ' : ' + '}${body}`;
};

const powerSumNE: Template<P> = {
  id: 'alg.exponent-equations.sum-of-powers-ne',
  skill: 'alg.exponent-equations',
  format: 'ne',
  style: 'a sum of powers of one base with x in the exponents',
  generate(rng, d) {
    for (;;) {
      const variant = rng.pick(ORDER[d]) as Variant;
      const g = rng.pick(d === 1 ? [2, 2, 3, 5] : [2, 2, 3, 5]);
      const x = rng.int(2, g === 2 ? 8 : g === 3 ? 5 : 3);
      const T = (c: number, s: number): PTerm => ({ c, B: g, a: 1, b: s });
      let terms: PTerm[];
      if (variant === 'two') {
        terms = [T(1, 0), T(rng.chance(0.65) ? 1 : -1, rng.int(1, g === 2 ? 4 : 3))];
        if (terms[1].c > 0 && rng.chance(0.5)) terms.reverse();
      } else if (variant === 'equal') {
        const k = rng.int(0, 2);
        terms = Array.from({ length: g }, () => T(1, k));
      } else if (variant === 'three') {
        const sh = rng.pick([[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]);
        const sg = rng.chance(0.4) ? [1, -1, 1] : [1, 1, 1];
        terms = rng.shuffle(sh.map((s, i) => T(sg[i], s)));
      } else if (variant === 'coef') {
        terms = [T(rng.int(2, 6), 0), T(rng.chance(0.7) ? 1 : -1, rng.int(1, 3))];
        if (d === 3) terms.push(T(rng.int(2, 4), -1));
        terms = rng.shuffle(terms);
      } else if (variant === 'mixed') {
        // powers of g^2 written with different bases: (g^2)^(x + s) or g^(2x + s)
        const sq = g * g;
        const make = (): PTerm => (rng.chance(0.5) ? { c: rng.int(1, 3), B: sq, a: 1, b: rng.int(0, 2) } : { c: rng.int(1, 3), B: g, a: 2, b: rng.int(0, 3) });
        terms = [make(), make()];
        if (terms[0].B === terms[1].B && terms[0].b === terms[1].b) continue;
      } else {
        terms = [T(rng.int(1, 3), 1), T(rng.int(1, 3), -1)];
        if (rng.chance(0.5)) terms.push(T(rng.int(1, 2), 0));
        terms = rng.shuffle(terms);
      }
      const first = terms.findIndex((t) => t.c > 0);
      terms = [terms[first], ...terms.filter((_, i) => i !== first)];
      // everything is a multiple of g^(m x)
      const m = variant === 'mixed' ? 2 : 1;
      const eOf = (t: PTerm) => Math.round(Math.log(t.B) / Math.log(g));
      if (terms.some((t) => eOf(t) * t.a !== m)) continue;
      const shift = (t: PTerm) => eOf(t) * t.b;
      const weight = (t: PTerm) => new Frac(t.c).mul(new Frac(g).pow(shift(t)));
      const K = terms.reduce((s, t) => s.add(weight(t)), new Frac(0));
      if (K.n <= 0) continue;
      const power = new Frac(g).pow(m * x);
      const Rf = K.mul(power);
      if (!Rf.isInt() || Rf.n > 200000) continue;
      const R = Rf.n;
      // named wrong answers
      const traps: { value: Frac; trap: string; why: string }[] = [
        { value: power, trap: 'alg-solved-for-power', why: `stopping at the value of the power $${g}^{${m === 2 ? '2x' : 'x'}}$ instead of finding $x$` },
      ];
      if (variant === 'equal') {
        const k = terms[0].b;
        const wrong = new Frac(x + k + 1, g).sub(k);
        traps.push({ value: wrong, trap: 'alg-power-sum', why: `reading ${g} equal powers $${g}^{x${k ? ` + ${k}` : ''}}$ as one power with ${g} times the exponent` });
      } else if (m === 1) {
        const free = terms.reduce((s, t) => s + t.c, 0);
        const fixed = terms.filter((t) => t.b !== 0).reduce((s, t) => s.add(weight(t)), new Frac(0));
        if (free > 0) {
          const lg = logInt(g, new Frac(R).sub(fixed).div(free));
          if (lg !== null) traps.push({ value: new Frac(lg), trap: 'alg-exponent-add-as-sum', why: `reading each $${g}^{x + k}$ as $${g}^{x} + ${g}^{k}$` });
        }
      }
      const seen = new Set<string>([String(x)]);
      const keep = traps.filter((t) => {
        const key = t.value.toString();
        if (seen.has(key) || !t.value.isTerminating()) return false;
        seen.add(key);
        return true;
      });
      const lhs = terms.map((t, i) => termTex(t, i === 0)).join('');
      const unit = `${g}^{${m === 2 ? '2x' : 'x'}}`;
      const inner = terms.map((t, i) => `${i === 0 ? '' : t.c < 0 ? ' - ' : ' + '}${Math.abs(t.c) === 1 ? '' : `${Math.abs(t.c)} \\cdot `}${num(new Frac(g).pow(shift(t)))}`).join('');
      const conv =
        variant === 'mixed'
          ? `Write every term with base ${g}: ${[...new Set(terms.filter((t) => t.B !== g).map((t) => `$${t.B}^{${lin([[t.a, 'x'], [t.b, '']])}} = ${g}^{${lin([[2 * t.a, 'x'], [2 * t.b, '']])}}$`))].join(', ')}. Now every term is a multiple of $${unit}$, so factor it out.`
          : `Every term is a multiple of the same power, so factor that power out instead of trying to add the terms.`;
      const checkVals = terms.map((t) => new Frac(t.c).mul(new Frac(t.B).pow(t.a * x + t.b)));
      const checkTex = checkVals.map((v, i) => (i === 0 ? num(v) : v.n < 0 ? ` - ${num(v.neg())}` : ` + ${num(v)}`)).join('');
      const cited = keep[0];
      return {
        params: { terms, R, x, g },
        q: {
          format: 'ne',
          stem: `If $${lhs} = ${num(R)}$, what is the value of $x$?`,
          prefix: '$x =$',
          answer: new Frac(x),
          traps: keep.map((t) => ({ value: t.value, trap: t.trap })),
          explanation: `${conv}

$${unit}(${inner}) = ${num(R)}$, so $${num(K)} \\cdot ${unit} = ${num(R)}$ and $${unit} = ${num(power)} = ${g}^{${m * x}}$. Equal powers of ${g} have equal exponents, so ${m === 2 ? `$2x = ${m * x}$ and ` : ''}$x = ${x}$.

Check: at $x = ${x}$ the terms are $${checkTex}$, which add up to $${num(R)}$.${cited ? `\n\nTrap: $${cited.value.toTex()}$ comes from ${cited.why}.` : ''}

Rule: factor out the smallest power; never split $${g}^{x + k}$ into a sum.`,
        },
      };
    }
  },
  check(q, { terms, R, x }) {
    if (q.format !== 'ne') return 'wrong format';
    const val = (t: number) => terms.reduce((s, tm) => s + tm.c * Math.pow(tm.B, tm.a * t + tm.b), 0);
    const hits: number[] = [];
    for (let t = -20; t <= 40; t++) if (Math.abs(val(t) - R) <= 1e-9 * Math.max(1, R)) hits.push(t);
    if (hits.length !== 1) return `integer solutions: ${hits.join(',')}`;
    if (!q.answer.eq(new Frac(hits[0]))) return `brute force finds ${hits[0]}`;
    return hits[0] === x ? null : 'param mismatch';
  },
};

export const powerSumTemplate = powerSumNE;
export const powerSumTraps: Record<string, Trap> = {
  'alg-solved-for-power': {
    label: 'Answered with the value of the power instead of the exponent',
    fix: 'After finding $2^{x} = 16$, the question still asks for $x$: $16 = 2^{4}$, so $x = 4$.',
  },
};
