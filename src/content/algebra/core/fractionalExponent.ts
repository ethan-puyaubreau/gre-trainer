import { Frac } from '../../../engine/frac';
import { num, sqrt } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { close, trapChoices } from './util';

/* Evaluate powers with fractional and negative exponents (MCS). */

interface Factor {
  bn: number;
  bd: number;
  /** exponent p/q in lowest terms, q >= 2, p may be negative */
  p: number;
  q: number;
  decimal: boolean;
}

interface P {
  factors: Factor[];
  ans: number[];
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const iroot = (n: number, k: number): number | null => {
  const r = Math.round(Math.pow(n, 1 / k));
  for (const c of [r - 1, r, r + 1]) if (c > 0 && c ** k === n) return c;
  return null;
};
/** Exact k-th root of a positive fraction, or null. */
function root(x: Frac, k: number): Frac | null {
  const a = iroot(x.n, k);
  const b = iroot(x.d, k);
  return a && b ? new Frac(a, b) : null;
}
const base = (f: Factor) => new Frac(f.bn, f.bd);
/** B^(e) for a rational exponent e = n/d, exact or null. */
function exactPow(B: Frac, n: number, d: number): Frac | null {
  const r = root(B, d);
  return r ? r.pow(n) : null;
}

const baseTex = (f: Factor) => (f.bd === 1 ? num(f.bn) : `\\left(\\dfrac{${num(f.bn)}}{${num(f.bd)}}\\right)`);
const expTex = (f: Factor) => (f.decimal ? new Frac(f.p, f.q).toDecimalString() : new Frac(f.p, f.q).toTex());
const factorTex = (f: Factor) => `${baseTex(f)}^{${expTex(f)}}`;
const bareTex = (x: Frac) => x.toTex();

interface Mut {
  trap: string;
  why: string;
  /** only offered when some exponent is negative */
  neg?: boolean;
  val: (f: Factor) => Frac | null;
}

const MUTS: Mut[] = [
  { trap: 'alg-neg-exponent-negative', why: 'treating a negative exponent as a negative number', neg: true, val: (f) => (f.p < 0 ? exactPow(base(f), -f.p, f.q)?.neg() ?? null : value(f)) },
  { trap: 'alg-neg-exponent-ignored', why: 'ignoring the minus sign of the exponent', neg: true, val: (f) => exactPow(base(f), Math.abs(f.p), f.q) },
  { trap: 'alg-fraction-exponent-multiply', why: 'multiplying the base by the exponent', val: (f) => base(f).mul(new Frac(f.p, f.q)) },
  { trap: 'alg-fraction-exponent-drop-numerator', why: 'taking the root but forgetting the numerator of the exponent', val: (f) => exactPow(base(f), f.p < 0 ? -1 : 1, f.q) },
  { trap: 'alg-fraction-exponent-drop-root', why: 'using only the numerator of the exponent and skipping the root', val: (f) => base(f).pow(f.p) },
  { trap: 'alg-fraction-exponent-inverted', why: 'turning the exponent upside down', val: (f) => exactPow(base(f), f.p < 0 ? -f.q : f.q, Math.abs(f.p)) },
  {
    trap: 'alg-fraction-exponent-multiply-root',
    why: 'multiplying the root by the numerator instead of raising it to that power',
    val: (f) => {
      const r = root(base(f), f.q);
      return r ? (f.p < 0 ? r.mul(-f.p).inv() : r.mul(f.p)) : null;
    },
  },
];

function value(f: Factor): Frac {
  return exactPow(base(f), f.p, f.q)!;
}

const BASES: Record<number, number[]> = { 2: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 3: [2, 3, 4, 5, 6, 7, 8], 4: [2, 3, 4, 5], 5: [2, 3], 6: [2] };

function makeFactor(rng: Parameters<Template<P>['generate']>[0], d: number, neg: boolean, fracBase: boolean, qs: number[]): Factor {
  const q = rng.pick(qs);
  let p: number;
  do p = rng.int(1, q === 2 ? 5 : 4);
  while (gcd(p, q) !== 1);
  const c = rng.pick(BASES[q]);
  let bn = c ** q;
  let bd = 1;
  if (fracBase) {
    let c2: number;
    do c2 = rng.pick(BASES[q].filter((x) => x <= 5));
    while (gcd(c, c2) !== 1);
    bd = c2 ** q;
    if (bd > 1296 || bn > 1296) { bn = 2 ** q; bd = 3 ** q; }
  }
  const decimal = d < 3 && !fracBase && (q === 2 || q === 4) && rng.chance(0.3);
  return { bn, bd, p: neg ? -p : p, q, decimal };
}

const fractionalExponentMCS: Template<P> = {
  id: 'alg.exponent-equations.fractional-exponent-mcs',
  skill: 'alg.exponent-equations',
  format: 'mcs',
  style: 'evaluate powers with fractional and negative exponents',
  generate(rng, d) {
    for (;;) {
      let factors: Factor[];
      if (d === 1) factors = [makeFactor(rng, d, false, false, [2, 2, 3, 3, 4, 5])];
      else if (d === 2) {
        const kind = rng.pick(['neg-int', 'neg-frac', 'two', 'neg-int']);
        if (kind === 'neg-int') factors = [makeFactor(rng, d, true, false, [2, 3, 4])];
        else if (kind === 'neg-frac') factors = [makeFactor(rng, d, rng.chance(0.7), true, [2, 3])];
        else factors = [makeFactor(rng, d, false, false, [2, 3, 4]), makeFactor(rng, d, rng.chance(0.5), false, [2, 3, 4])];
      } else {
        const n = rng.pick([2, 2, 3]);
        factors = Array.from({ length: n }, (_, i) => makeFactor(rng, d, i === 0 ? true : rng.chance(0.5), rng.chance(0.3), [2, 3, 4]));
      }
      const keys = factors.map((f) => `${f.bn}/${f.bd}`);
      if (new Set(keys).size !== keys.length) continue;
      let vals: Frac[];
      let ans: Frac;
      try {
        vals = factors.map(value);
        ans = vals.reduce((a, b) => a.mul(b), new Frac(1));
      } catch {
        continue; // exact arithmetic overflows: not a friendly question
      }
      if (ans.n === 0 || ans.eq(1) || Math.abs(ans.toNumber()) > 5000 || ans.d > 64 || ans.n > (d === 3 ? 1000 : 5000)) continue;
      // the wrong values: apply one mistake to every factor
      const items = MUTS.flatMap((m) => {
        try {
          return mutated(m);
        } catch {
          return []; // the mistaken value overflows exact arithmetic: not a plausible choice
        }
      });
      function mutated(m: Mut) {
        const vs = factors.map(m.val);
        if (vs.some((v) => v === null)) return [];
        if (m.neg && !factors.some((f) => f.p < 0)) return [];
        const v = vs.reduce((a, b) => a!.mul(b!), new Frac(1))!;
        if (Math.abs(v.n) > 5e6 || v.d > 1e5) return [];
        return [{ value: v, trap: m.trap, why: m.why }];
      }
      const r = trapChoices(rng, ans, items, (v) => `$${num(v)}$`);
      if (!r) continue;
      const order = rng.shuffle(r.choices.map((_, i) => i));
      const cited = r.kept[0];
      const wrap = (x: Frac) => (x.d === 1 ? bareTex(x) : `\\left(${bareTex(x)}\\right)`);
      const powOf = (x: Frac, k: number) => (k === 1 ? bareTex(x) : `${wrap(x)}^{${k}}`);
      const lines = factors.map((f) => {
        const B = base(f);
        const val = bareTex(value(f));
        if (f.p > 0) {
          const rt = root(B, f.q)!;
          return f.p === 1 ? `$${factorTex(f)} = ${sqrt(bareTex(B), f.q)} = ${val}$` : `$${factorTex(f)} = \\left(${sqrt(bareTex(B), f.q)}\\right)^{${f.p}} = ${powOf(rt, f.p)} = ${val}$`;
        }
        const inv = B.inv();
        const rt = root(inv, f.q)!;
        const step = `${wrap(inv)}^{${new Frac(-f.p, f.q).toTex()}}`;
        return f.p === -1 ? `$${factorTex(f)} = ${step} = ${val}$` : `$${factorTex(f)} = ${step} = ${powOf(rt, -f.p)} = ${val}$`;
      });
      const f0 = factors[0];
      const b0 = f0.p > 0 ? base(f0) : base(f0).inv();
      const check = `Check the root: $${powOf(root(b0, f0.q)!, f0.q)} = ${bareTex(b0)}$.`;
      const expr = factors.map(factorTex).join(' \\cdot ');
      const single = factors.length === 1 && factors[0].bd === 1 && !factors[0].decimal;
      const pick = rng.int(0, single ? 3 : 1);
      const nm = rng.pick(['x', 'n', 'm', 't']);
      const stem =
        pick === 0
          ? `What is the value of $${expr}$?`
          : pick === 1
            ? `Which of the following is equal to $${expr}$?`
            : `If $${nm} = ${num(factors[0].bn)}$, what is the value of $${nm}^{${expTex(factors[0])}}$?`;
      return {
        params: { factors, ans: [ans.n, ans.d] },
        q: {
          format: 'mcs',
          stem,
          choices: order.map((i) => r.choices[i]),
          answer: order.indexOf(r.answer),
          explanation: `In $b^{p/q}$ the denominator is a root and the numerator a power; a negative exponent means the reciprocal. Take the root first, because it keeps the numbers small.

${lines.join('\n\n')}

${factors.length > 1 ? `Multiply the results: $${vals.map(wrap).join(' \\cdot ')} = ${bareTex(ans)}$.\n\n` : ''}${check}

Trap: $${num(cited.value)}$ comes from ${cited.why}.

Rule: $b^{p/q}$ is the $q$-th root of $b$ raised to the power $p$, and $b^{-e}$ is $1$ over $b^{e}$.`,
        },
      };
    }
  },
  check(q, { factors, ans }) {
    if (q.format !== 'mcs') return 'wrong format';
    const val = factors.reduce((a, f) => a * Math.pow(f.bn / f.bd, f.p / f.q), 1);
    if (!close(val, ans[0] / ans[1], 1e-9)) return `float value ${val} != ${ans[0]}/${ans[1]}`;
    const want = `$${num(new Frac(ans[0], ans[1]))}$`;
    return q.choices[q.answer].text === want ? null : `answer choice is ${q.choices[q.answer].text}, expected ${want}`;
  },
};

export const fractionalExponentTemplate = fractionalExponentMCS;
export const fractionalExponentTraps: Record<string, Trap> = {
  'alg-neg-exponent-negative': {
    label: 'A negative exponent makes the number negative',
    fix: 'A negative exponent means the reciprocal: $8^{-1} = \\frac{1}{8}$, a positive number.',
  },
  'alg-neg-exponent-ignored': {
    label: 'Dropped the minus sign of the exponent',
    fix: '$b^{-e}$ is $\\frac{1}{b^{e}}$, not $b^{e}$: $4^{-2} = \\frac{1}{16}$.',
  },
  'alg-fraction-exponent-multiply': {
    label: '$b^{p/q} = b \\cdot \\frac{p}{q}$',
    fix: 'An exponent says how many times to multiply, not what to multiply by: $27^{2/3} = (\\sqrt[3]{27})^2 = 9$, not $27 \\cdot \\frac{2}{3}$.',
  },
  'alg-fraction-exponent-drop-numerator': {
    label: 'Forgot the numerator of a fractional exponent',
    fix: 'In $b^{p/q}$ take the $q$-th root AND raise to the power $p$: $8^{2/3} = 2^2 = 4$, not $2$.',
  },
  'alg-fraction-exponent-drop-root': {
    label: 'Ignored the root in a fractional exponent',
    fix: 'The denominator of the exponent is a root: $16^{3/4}$ means $(\\sqrt[4]{16})^3 = 8$, not $16^3$.',
  },
  'alg-fraction-exponent-inverted': {
    label: 'Turned the fractional exponent upside down',
    fix: 'The denominator of the exponent is the root index and the numerator is the power: $8^{2/3}$ takes a cube root, not a square root.',
  },
  'alg-fraction-exponent-multiply-root': {
    label: 'Multiplied the root by the numerator instead of raising it',
    fix: 'After taking the root, raise it to the power $p$: $27^{2/3} = 3^2 = 9$, not $3 \\cdot 2 = 6$.',
  },
};
