import { gcd } from '../../../engine/math';
import { textChoices } from '../../../engine/build';
import { poly } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { expectMcsBy, sieve } from './util';

export const primeExpressionTraps: Record<string, Trap> = {
  'int-prime-one-prime-only': {
    label: 'Tested one prime and generalized',
    fix: '"Must be divisible" means for EVERY prime greater than 3. An expression can work at $p = 5$ and fail at $p = 7$: test two primes from different classes ($5$ and $7$), or use $p^2 \\equiv 1$.',
  },
  'int-prime-weaker-claim': {
    label: 'Chose an expression divisible by a smaller number only',
    fix: 'Divisible by 12 does not mean divisible by 24. Rewrite the expression as a multiple of $p^2 - 1$ plus a constant and check that the constant is a multiple of the full number asked for.',
  },
};

interface Expr {
  a: number;
  c: number; // linear coefficient
  b: number;
  x: number; // 0 for a p^2 + c p + b, otherwise the factored form (p - x)(p + x)
}
const val = (e: Expr, p: number) => (e.x ? (p - e.x) * (p + e.x) : e.a * p * p + e.c * p + e.b);
const tex = (e: Expr) => (e.x ? `(p - ${e.x})(p + ${e.x})` : poly([e.a, e.c, e.b], 'p'));
const md = (v: number, m: number) => ((v % m) + m) % m;
const RES = [1, 5, 7, 11, 13, 17, 19, 23];

/** Residues of the expression over the classes of primes greater than 3 (every modulus used divides 24). */
const residues = (e: Expr, m: number) => new Set(RES.map((r) => md(val(e, r + 24), m)));

interface P {
  m: number;
  exprs: Expr[];
  key: number;
}

const MODS: Record<number, number[]> = { 1: [4, 6], 2: [8, 12, 8, 12], 3: [24, 24, 12] };

const primeExpression: Template<P> = {
  id: 'arith.primes.must-divide-expression',
  skill: 'arith.primes',
  format: 'mcs',
  style: 'which expression in a prime p greater than 3 must be divisible by m (p^2 = 1 mod 24)',
  generate(rng, diff) {
    for (;;) {
      const m = rng.pick(MODS[diff]);
      const xs = Array.from({ length: 25 }, (_, i) => i + 1).filter((x) => md(1 - x * x, m) === 0);
      let key: Expr;
      if (rng.chance(0.5) && xs.length) key = { a: 1, c: 0, b: 0, x: rng.pick(xs) };
      else {
        const a = rng.int(1, 4);
        const b = rng.int(-40, 40);
        if (!b || md(a + b, m)) continue;
        key = { a, c: 0, b, x: 0 };
      }
      const wrong: { e: Expr; trap: string }[] = [];
      for (let t = 0; t < 60 && wrong.length < 4; t++) {
        const e: Expr = rng.chance(0.3) ? { a: 1, c: 0, b: 0, x: rng.int(2, 25) } : { a: rng.int(1, 4), c: rng.chance(0.4) ? 0 : rng.int(-6, 6), b: rng.int(-40, 40), x: 0 };
        if (!e.x && !e.b) continue;
        if (tex(e) === tex(key) || wrong.some((w) => tex(w.e) === tex(e))) continue;
        const R = residues(e, m);
        let trap: string | null = null;
        if (R.size === 1 && !R.has(0) && gcd([...R][0], m) > 1) trap = 'int-prime-weaker-claim';
        else if (R.size > 1 && R.has(0) && (md(val(e, 5), m) === 0 || md(val(e, 7), m) === 0)) trap = 'int-prime-one-prime-only';
        if (trap) wrong.push({ e, trap });
      }
      if (wrong.length < 4) continue;
      const mix = new Set(wrong.map((w) => w.trap));
      if (diff === 3 && mix.size < 2) continue;
      const { choices, answer } = textChoices(
        rng,
        `$${tex(key)}$`,
        wrong.map((w) => ({ text: `$${tex(w.e)}$`, trap: w.trap })),
      );
      const cite = wrong[0];
      const PR = [5, 7, 11, 13, 17, 19, 23, 29];
      const ok = PR.find((p) => md(val(cite.e, p), m) === 0) ?? 5;
      const bad = PR.find((p) => md(val(cite.e, p), m) !== 0)!;
      const trapLine =
        cite.trap === 'int-prime-weaker-claim'
          ? `$${tex(cite.e)}$ is tempting, but at $p = ${bad}$ it equals $${val(cite.e, bad)}$, which leaves remainder ${md(val(cite.e, bad), m)} on division by ${m}.`
          : `$${tex(cite.e)}$ passes at $p = ${ok}$, where it equals $${val(cite.e, ok)}$, but at $p = ${bad}$ it equals $${val(cite.e, bad)}$, not a multiple of ${m}.`;
      const kp = PR.find((p) => val(key, p) > 0)!;
      const why = key.x
        ? `$(p - ${key.x})(p + ${key.x}) = p^2 - ${key.x * key.x} = (p^2 - 1) - ${key.x * key.x - 1}$, and ${key.x * key.x - 1} is a multiple of ${m}`
        : `$${tex(key)} = ${key.a === 1 ? '' : key.a}(p^2 - 1) ${key.a + key.b < 0 ? '-' : '+'} ${Math.abs(key.a + key.b)}$, and ${Math.abs(key.a + key.b)} is a multiple of ${m}`;
      return {
        params: { m, exprs: [key, ...wrong.map((w) => w.e)], key: 0 },
        q: {
          format: 'mcs',
          stem: `If $p$ is a prime number greater than 3, which of the following must be divisible by ${m}?`,
          choices,
          answer,
          explanation: `A prime above 3 is odd and not a multiple of 3, so $p - 1$ and $p + 1$ are consecutive even numbers (one is a multiple of 4) and one of them is a multiple of 3. So $p^2 - 1$ is a multiple of 24${m === 24 ? '' : `, hence of ${m}`}.

Rewrite the key: ${why}.

Check: at $p = ${kp}$ the value is $${val(key, kp)} = ${m} \\cdot ${val(key, kp) / m}$.

Trap: ${trapLine}

Rule: reduce to $p^2 - 1$ plus a constant, then test the constant.`,
        },
      };
    }
  },
  check(q, { m, exprs, key }) {
    const S = sieve(1000);
    const primes: number[] = [];
    for (let p = 5; p <= 1000; p++) if (S[p]) primes.push(p);
    const text = (e: Expr) => `$${tex(e)}$`;
    return expectMcsBy(q, (i) => {
      const t = q.format === 'mcs' ? q.choices[i].text : '';
      const e = exprs.find((x) => text(x) === t)!;
      return primes.every((p) => val(e, p) % m === 0);
    }) ?? (q.format === 'mcs' && q.choices[q.answer].text === text(exprs[key]) ? null : 'key mismatch');
  },
};

export const primeExpressionTemplates: Template<any>[] = [primeExpression];
