import { Frac, frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { intExcept } from './util';

export const linearParameterTraps: Record<string, Trap> = {
  'alg-lin-param-skip-shift': {
    label: 'Substituted into the parenthesis but used $x$ alone as the multiplier of $k$',
    fix: 'The whole factor $(x + q)$ multiplies $k$: after substituting, use $s + q$, not $s$.',
  },
  'alg-lin-param-answered-x': {
    label: 'Gave the given solution instead of the unknown constant',
    fix: 'Re-read the question: the value of $x$ is given, and $k$ is what you solve for.',
  },
  'alg-lin-param-constant': {
    label: 'Looked at the constant terms instead of matching the coefficients of $x$',
    fix: 'An equation $ax + b = cx + d$ has no solution (or infinitely many) exactly when $a = c$. The constants then decide which, but they do not give $k$.',
  },
  'alg-lin-param-partial-slope': {
    label: 'Matched only part of the $x$ coefficient',
    fix: 'Expand first, then add ALL the $x$ terms on each side before comparing them.',
  },
};

interface Params {
  kind: 'given' | 'none' | 'none-both' | 'many-both';
  /** given: [u, v, q, r, s]. none: [a, p, b, c, r]. both: [c, u, m]. */
  k: number[];
}

/** Sum of signed pieces, no doubled signs: [-3, "x"] and [4, ""] -> "-3x + 4". */
const join = (parts: [number, string][]) => {
  let out = '';
  for (const [c, body] of parts) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const text = body === '' ? `${abs}` : abs === 1 && !body.startsWith('(') ? body : `${abs}${body}`;
    out += out === '' ? (c < 0 ? '-' : '') + text : ` ${c < 0 ? '-' : '+'} ${text}`;
  }
  return out || '0';
};
const shift = (p: number) => `(x ${p < 0 ? '-' : '+'} ${Math.abs(p)})`;

/** Left minus right at x for a given k, from the parameters (used by check). */
function f(kind: Params['kind'], k: number[], x: number, kk: number): number {
  if (kind === 'given') {
    const [u, v, q, r] = k;
    return u * x + v - (kk * (x + q) + r);
  }
  if (kind === 'none') {
    const [a, p, b, c, r] = k;
    return a * (x + p) + b * x + c - (kk * x + r);
  }
  const [c, u, m] = k;
  return kk * x + c - (u * x + m * kk);
}

const linearParameterNE: Template<Params> = {
  id: 'alg.linear-equations.parameter-ne',
  skill: 'alg.linear-equations',
  format: 'ne',
  style: 'find the constant that makes an equation have a given solution or none',
  generate(rng, d) {
    for (;;) {
      const kind: Params['kind'] =
        d === 1 ? rng.pick(['given', 'none']) : d === 2 ? rng.pick(['given', 'none', 'none']) : rng.pick(['none-both', 'many-both', 'none-both']);
      let stem: string;
      let explanation: string;
      let answer: number;
      let k: number[];
      const traps: { value: Frac; trap: string; why: string }[] = [];
      let note = '';
      if (kind === 'given') {
        const kk = intExcept(rng, -9, 9, 0, 1, -1);
        const s = intExcept(rng, -8, 8, 0, 1, -1, kk);
        const q = d === 1 ? 0 : intExcept(rng, -6, 6, 0, -s);
        const u = intExcept(rng, 2, 9);
        const v = intExcept(rng, -12, 12, 0);
        const r = u * s + v - kk * (s + q);
        if (r === 0 && d > 1) continue;
        k = [u, v, q, r, s];
        answer = kk;
        const lhs = join([[u, 'x'], [v, '']]);
        const rhs = q === 0 ? join([[1, 'kx'], [r, '']]) : join([[1, `k${shift(q)}`], [r, '']]);
        stem = `In the equation $${lhs} = ${rhs}$, $k$ is a constant. If $x = ${num(s)}$ is a solution of the equation, what is the value of $k$?`;
        const L = u * s + v;
        const mult = s + q;
        if (Math.abs(mult) === 1) continue;
        explanation = `A solution makes the equation true, so substitute $x = ${num(s)}$ and solve for $k$, which is the only unknown left.

The left side is $${u}(${num(s)}) ${v < 0 ? '-' : '+'} ${Math.abs(v)} = ${num(L)}$. The right side is $k(${num(mult)})${r === 0 ? '' : ` ${r < 0 ? '-' : '+'} ${Math.abs(r)}`}$. So $${lin([[mult, 'k']])} = ${num(L - r)}$ and $k = ${num(kk)}$.

Check: $${num(kk)}(${num(mult)})${r === 0 ? '' : ` ${r < 0 ? '-' : '+'} ${Math.abs(r)}`} = ${num(L)}$, the left side.

Trap: @@TRAP@@

Rule: a given solution turns the equation into a one-unknown equation in the constant.`;
        if (q !== 0) traps.push({ value: new Frac(L - r, s), trap: 'alg-lin-param-skip-shift', why: `Multiplying $k$ by $${num(s)}$ alone, without the shift, gives $${new Frac(L - r, s).toTex()}$; the multiplier is $${num(mult)}$, the whole value of $(x ${q < 0 ? '-' : '+'} ${Math.abs(q)})$.` });
        traps.push({ value: new Frac(L + r, mult), trap: 'alg-sign-slip', why: `Moving $${num(r)}$ to the left with the wrong sign gives $${new Frac(L + r, mult).toTex()}$, and then the two sides no longer agree.` });
        traps.push({ value: new Frac(-L - r, mult), trap: 'alg-sign-slip', why: `A sign error on the left side gives $${new Frac(-L - r, mult).toTex()}$.` });
        traps.push({ value: frac(s), trap: 'alg-lin-param-answered-x', why: `$${num(s)}$ is the value of $x$ you were given, not of $k$.` });
        note = traps[0].why;
        explanation = explanation.replace('@@TRAP@@', note);
      } else if (kind === 'none') {
        const a = intExcept(rng, 2, 7);
        const hard = d >= 2;
        const p = hard ? intExcept(rng, -6, 6, 0) : 0;
        const b = hard ? intExcept(rng, -4, 6, 0) : 0;
        if (hard && a + b === 0) continue;
        const c = intExcept(rng, -9, 9, 0);
        const r = rng.int(-9, 9);
        if (a * p + c === r) continue;
        k = [a, p, b, c, r];
        answer = a + b;
        const lhs = hard ? join([[1, `${a}${shift(p)}`], [b, 'x'], [c, '']]) : join([[a, 'x'], [c, '']]);
        stem = `For exactly one value of $k$, the equation $${lhs} = ${join([[1, 'kx'], [r, '']])}$ has no solution. What is that value of $k$?`;
        explanation = `${hard ? `Expand first: the left side is $${join([[a + b, 'x'], [a * p + c, '']])}$. ` : ''}An equation $mx + n = kx + r$ has no solution when the $x$ terms cancel but the constants differ: $m = k$ and $n \\ne r$. Here $m = ${a + b}$ and the constants are $${num(a * p + c)}$ and $${num(r)}$, which differ. So the equation reads $${join([[a + b, 'x'], [a * p + c, '']])} = ${join([[1, 'kx'], [r, '']])}$ and fails for every $x$ only if $k = ${num(a + b)}$.

Check: with $k = ${num(a + b)}$ subtracting $${lin([[a + b, 'x']])}$ from both sides leaves $${num(a * p + c)} = ${num(r)}$, which is false. Any other $k$ gives $x = \\frac{${num(r - a * p - c)}}{${num(a + b)} - k}$.

Trap: ${hard ? `counting only $${lin([[a, 'x']])}$ and forgetting the extra $${lin([[b, 'x']])}$ gives $k = ${a}$, which leaves a solution` : `copying the other constant, $k = ${num(r)}$, mixes up a constant with the coefficient of $x$`}.

Rule: no solution means the coefficients of $x$ match and the constants do not.`;
        if (hard) traps.push({ value: frac(a), trap: 'alg-lin-param-partial-slope', why: '' });
        traps.push({ value: frac(r), trap: 'alg-lin-param-constant', why: '' });
        traps.push({ value: frac(-(a + b)), trap: 'alg-sign-slip', why: '' });
      } else {
        const u = intExcept(rng, 2, 8);
        const m = intExcept(rng, -6, 6, 0, 1);
        const c = kind === 'many-both' ? m * u : m * u + intExcept(rng, -5, 5, 0);
        if (c === 0) continue;
        k = [c, u, m];
        answer = u;
        const lhs = join([[1, 'kx'], [c, '']]);
        const rhs = join([[u, 'x'], [m, 'k']]);
        const many = kind === 'many-both';
        stem = `For exactly one value of $k$, the equation $${lhs} = ${rhs}$ has ${many ? 'infinitely many solutions' : 'no solution'}. What is that value of $k$?`;
        explanation = `Collect the terms with $x$ on one side and the rest on the other: $(${join([[1, 'k'], [-u, '']])})x = ${join([[m, 'k'], [-c, '']])}$.

If $k \\ne ${u}$, divide by $${join([[1, 'k'], [-u, '']])}$ and there is exactly one solution. The special value is $k = ${u}$, where the left side becomes $0 \\cdot x = 0$ and the right side becomes $${num(m * u - c)}$. ${
          many ? `That is $0 = 0$, true for every $x$: infinitely many solutions.` : `That is $0 = ${num(m * u - c)}$, never true: no solution.`
        }

Check: at $k = ${u}$ the equation is $${join([[u, 'x'], [c, '']])} = ${join([[u, 'x'], [m * u, '']])}$, so it comes down to $${num(c)} = ${num(m * u)}$.

Trap: ${many ? `calling $k = ${u}$ "no solution" without checking the constants: here they match ($${num(c)} = ${num(m * u)}$), so every $x$ works` : `setting the right side to 0 alone, $${join([[m, 'k'], [-c, '']])} = 0$, gives $k = ${new Frac(c, m).toTex()}$, which leaves a solution`}.

Rule: when the coefficient of $x$ vanishes, the constants decide between no solution and infinitely many.`;
        if (!many) traps.push({ value: new Frac(c, m), trap: 'alg-lin-param-constant', why: '' });
        traps.push({ value: frac(-u), trap: 'alg-sign-slip', why: '' });
        traps.push({ value: frac(m), trap: 'alg-lin-param-constant', why: '' });
      }
      const wrong = traps.filter((t) => !t.value.eq(answer));
      return {
        params: { kind, k: k! },
        q: { format: 'ne', stem, answer: frac(answer), prefix: '$k =$', traps: wrong.map(({ value, trap }) => ({ value, trap })), explanation },
      };
    }
  },
  check(q, { kind, k }) {
    if (q.format !== 'ne') return 'wrong format';
    const hits: number[] = [];
    for (let kk = -80; kk <= 80; kk++) {
      if (kind === 'given') {
        if (f(kind, k, k[4], kk) === 0) hits.push(kk);
      } else {
        const f0 = f(kind, k, 0, kk);
        const f1 = f(kind, k, 1, kk);
        const f5 = f(kind, k, 5, kk);
        const flat = f1 === f0 && f5 === f0;
        if (flat && (kind === 'many-both' ? f0 === 0 : f0 !== 0)) hits.push(kk);
      }
    }
    if (hits.length !== 1) return `${hits.length} values of k work`;
    return q.answer.eq(hits[0]) ? null : `expected ${hits[0]}`;
  },
};

export const linearParameterTemplates = [linearParameterNE];
