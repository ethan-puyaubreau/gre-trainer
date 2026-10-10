import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import { gcd, lcm, mod, range } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { QC_WORDS, expectMcm, expectMcsBy, expectNe, expectQc, listAnd, spreadChoices } from './util';

/* ------------------------------------------------------------------ 1. Remainder given: what must divide n (MCS) */

interface MustDivideParams {
  d: number;
  r: number;
  /** The question asks about n + s (s = 0: about n itself). */
  s: number;
  values: number[];
}

const mustDivide: Template<MustDivideParams> = {
  id: 'arith.divisibility.must-divide',
  skill: 'arith.divisibility',
  format: 'mcs',
  style: 'remainder given: which number must divide n',
  generate(rng, diff) {
    const G = diff === 1 ? [4, 5, 6, 7, 8, 9] : diff === 2 ? [5, 6, 7, 8, 9, 12] : [6, 7, 8, 9, 12];
    const [dMin, dMax] = diff === 1 ? [12, 50] : diff === 2 ? [20, 99] : [30, 99];
    for (;;) {
      const g = rng.pick(G);
      const a = rng.int(Math.ceil(dMin / g), Math.floor(dMax / g));
      if (a < 2) continue;
      const b = rng.int(1, a - 1);
      if (gcd(a, b) !== 1) continue;
      const d = g * a;
      const target = g * b; // r + s
      const s = diff === 3 ? rng.int(1, 9) : 0;
      const r = target - s;
      if (r < 2 || r >= d) continue;
      if (s > 0 && gcd(d, r) % g === 0) continue; // the shift must matter
      const divs = (x: number) => range(2, 20).filter((v) => x % v === 0);
      const remOnly = divs(target).filter((v) => d % v !== 0);
      const divOnly = divs(d).filter((v) => target % v !== 0);
      if (!remOnly.length || !divOnly.length) continue;
      const fillers = rng.shuffle(range(2, 20).filter((v) => d % v !== 0 && target % v !== 0));
      if (fillers.length < 3) continue;
      const pool = [
        ...rng.sample(remOnly, Math.min(2, remOnly.length)).map((v) => ({ v, trap: 'int-divides-remainder-only' })),
        ...rng.sample(divOnly, Math.min(2, divOnly.length)).map((v) => ({ v, trap: 'int-divides-divisor-only' })),
        ...fillers.map((v) => ({ v })),
      ];
      let built: ReturnType<typeof spreadChoices>;
      try {
        built = spreadChoices(rng, g, pool);
      } catch {
        continue;
      }
      const { choices, answer } = built;
      const ro = Number((choices.find((c) => c.trap === 'int-divides-remainder-only') ?? { text: `$${remOnly[0]}$` }).text.slice(1, -1));
      const dOnly = Number((choices.find((c) => c.trap === 'int-divides-divisor-only') ?? { text: `$${divOnly[0]}$` }).text.slice(1, -1));
      const values = choices.map((c) => Number(c.text.slice(1, -1)));

      // Counterexamples for the wrong choices, from the smallest values of n.
      const nOf = (k: number) => d * k + r + s;
      const wrong = values.filter((v) => v !== g);
      const byK = new Map<number, number[]>();
      for (const v of wrong) {
        let k = 0;
        while (nOf(k) % v === 0) k++;
        byK.set(k, [...(byK.get(k) ?? []), v]);
      }
      const subject = s ? `n + ${s}` : 'n';
      const ks = [...byK.keys()].sort((x, y) => x - y);
      const counter = ks
        .map((k) => `${listAnd(byK.get(k)!.map(String))} ${byK.get(k)!.length > 1 ? 'do' : 'does'} not divide $${nOf(k)}$`)
        .join('; ');
      const kList = ks.map((k) => `$k = ${k}$ gives $${subject} = ${nOf(k)}$`).join(' and ');
      const setup = s
        ? `Write $n = ${d}k + ${r}$ for some integer $k \\ge 0$. Then $n + ${s} = ${d}k + ${target} = ${g}(${d / g}k + ${target / g})$, so ${g} divides $n + ${s}$ for every possible $n$.`
        : `Write $n = ${d}k + ${r}$ for some integer $k \\ge 0$. Both terms are multiples of ${g}: $n = ${g}(${d / g}k + ${r / g})$, so ${g} divides every possible $n$.`;
      return {
        params: { d, r, s, values },
        q: {
          format: 'mcs',
          stem: `The positive integer $n$ leaves a remainder of ${r} when it is divided by ${d}. Which of the following must be a factor of $${subject}$?`,
          choices,
          answer,
          explanation: `${setup}

The other choices fail for some $n$: ${kList}, and ${counter}.

A divisor of ${s ? `$${r} + ${s} = ${target}$` : `the remainder ${r}`} alone (such as ${ro}) or of ${d} alone (such as ${dOnly}) is not enough: it has to divide both, so it has to divide their greatest common divisor, ${g}.`,
        },
      };
    }
  },
  check(q, { d, r, s, values }) {
    const ns = range(0, 200).map((k) => d * k + r + s);
    return expectMcsBy(q, (i) => ns.every((n) => n % values[i] === 0));
  },
};

/* ------------------------------------------------------------------ 2. Remainder of a related number (NE) */

type TransformKind = 'mod-factor' | 'multiple' | 'shift' | 'square' | 'linear-factor' | 'product';

interface TransformParams {
  kind: TransformKind;
  d: number;
  r: number;
  /** multiplier / shift / second remainder, depending on kind */
  c: number;
  m: number;
  /** modulus of the question */
  e: number;
}

const transformValue = (p: TransformParams, n: number, n2: number): number => {
  switch (p.kind) {
    case 'mod-factor':
      return n;
    case 'multiple':
      return p.c * n;
    case 'shift':
      return n + p.c;
    case 'square':
      return n * n;
    case 'linear-factor':
      return p.c * n + p.m;
    case 'product':
      return n * n2;
  }
};

const remainderTransform: Template<TransformParams> = {
  id: 'arith.divisibility.remainder-transform',
  skill: 'arith.divisibility',
  format: 'ne',
  style: 'remainder of a related number (2n, n + c, n², a factor of the divisor)',
  generate(rng, diff) {
    const kinds: TransformKind[] =
      diff === 1 ? ['mod-factor', 'multiple', 'shift'] : diff === 2 ? ['multiple', 'shift', 'square', 'mod-factor'] : ['linear-factor', 'product', 'square'];
    const kind = rng.pick(kinds);
    let p: TransformParams;
    let raw: number; // the value a student gets before reducing
    for (;;) {
      const d = rng.int(diff === 1 ? 5 : 6, diff === 1 ? 9 : 15);
      const r = rng.int(2, d - 1);
      if (kind === 'mod-factor' || kind === 'linear-factor') {
        const facs = range(3, d - 1).filter((x) => d % x === 0);
        if (!facs.length) continue;
        const e = rng.pick(facs);
        const c = kind === 'linear-factor' ? rng.int(2, 5) : 1;
        const m = kind === 'linear-factor' ? rng.int(1, 9) : 0;
        p = { kind, d: kind === 'linear-factor' ? d * rng.int(2, 4) : d * (diff === 1 ? 1 : rng.int(1, 3)), r, c, m, e };
        if (p.r >= p.d) continue;
        raw = c * r + m;
        if (raw < e) continue;
      } else if (kind === 'multiple') {
        const c = rng.int(2, 5);
        p = { kind, d, r, c, m: 0, e: d };
        raw = c * r;
        if (raw < d) continue;
      } else if (kind === 'shift') {
        const c = rng.int(3, 2 * d);
        p = { kind, d, r, c, m: 0, e: d };
        raw = r + c;
        if (raw < d) continue;
      } else if (kind === 'square') {
        p = { kind, d, r, c: 0, m: 0, e: d };
        raw = r * r;
        if (raw < d) continue;
      } else {
        const r2 = rng.int(2, d - 1);
        p = { kind, d, r, c: r2, m: 0, e: d };
        raw = r * r2;
        if (raw < d) continue;
      }
      if (mod(raw, p.e) === 0 && rng.chance(0.7)) continue; // remainder 0 only sometimes
      break;
    }
    const { d, r, c, m, e } = p;
    const answer = mod(raw, e);
    const expr: Record<TransformKind, string> = {
      'mod-factor': 'n',
      multiple: `${c}n`,
      shift: `n + ${c}`,
      square: 'n^2',
      'linear-factor': `${c}n + ${m}`,
      product: 'xy',
    };
    const stem =
      kind === 'product'
        ? `When the positive integer $x$ is divided by ${d}, the remainder is ${r}. When the positive integer $y$ is divided by ${d}, the remainder is ${c}. What is the remainder when $xy$ is divided by ${d}?`
        : `When the positive integer $n$ is divided by ${d}, the remainder is ${r}. What is the remainder when $${expr[kind]}$ is divided by ${e}?`;
    const red = `$${raw} = ${e} \\cdot ${Math.floor(raw / e)} + ${answer}$`;
    let explanation: string;
    switch (kind) {
      case 'mod-factor':
        explanation = `Write $n = ${d}k + ${r}$. Since ${e} divides ${d}, the part $${d}k$ is a multiple of ${e}, so $n$ leaves the same remainder as ${r} when divided by ${e}: ${red}. The remainder is ${answer}.

Quick check with $n = ${r}$ and $n = ${d + r}$: both leave remainder ${answer} when divided by ${e}. The answer is not ${r}: a remainder must be less than ${e}.`;
        break;
      case 'multiple':
        explanation = `Write $n = ${d}k + ${r}$. Then $${c}n = ${c * d}k + ${raw}$, and $${c * d}k$ is a multiple of ${d}, so $${c}n$ leaves the same remainder as ${raw}: ${red}. The remainder is ${answer}.

Quick check with the smallest case $n = ${r}$: $${c}n = ${raw}$. Do not stop at ${raw}: it is larger than ${d}, so it is not a remainder.`;
        break;
      case 'shift':
        explanation = `Write $n = ${d}k + ${r}$. Then $n + ${c} = ${d}k + ${raw}$, which leaves the same remainder as ${raw}: ${red}. The remainder is ${answer}.

Quick check with $n = ${r}$: $n + ${c} = ${raw}$. Reduce ${raw}; a remainder must be less than ${d}.`;
        break;
      case 'square':
        explanation = `Write $n = ${d}k + ${r}$. Then $n^2 = ${d}^2k^2 + 2 \\cdot ${d} \\cdot ${r}k + ${raw}$, and every term except ${raw} is a multiple of ${d}. So $n^2$ leaves the same remainder as $${r}^2 = ${raw}$: ${red}. The remainder is ${answer}.

Quick check with $n = ${r + d}$: $${r + d}^2 = ${(r + d) ** 2} = ${d} \\cdot ${Math.floor((r + d) ** 2 / d)} + ${answer}$.`;
        break;
      case 'linear-factor':
        explanation = `Write $n = ${d}k + ${r}$. Since ${e} divides ${d}, $n$ leaves the same remainder as ${r} when divided by ${e}, and $${c}n + ${m}$ leaves the same remainder as $${c} \\cdot ${r} + ${m} = ${raw}$: ${red}. The remainder is ${answer}.

Quick check with $n = ${r}$: $${c} \\cdot ${r} + ${m} = ${raw}$. Remember to reduce: a remainder must be less than ${e}.`;
        break;
      case 'product':
        explanation = `Write $x = ${d}a + ${r}$ and $y = ${d}b + ${c}$. When you expand $xy$, every term except $${r} \\cdot ${c} = ${raw}$ contains a factor ${d}. So $xy$ leaves the same remainder as ${raw}: ${red}. The remainder is ${answer}.

Quick check with $x = ${r}$, $y = ${c}$: $xy = ${raw}$. Do not stop at ${raw}, which is larger than ${d}.`;
        break;
    }
    return {
      params: p,
      q: {
        format: 'ne',
        stem,
        answer: frac(answer),
        traps: [{ value: frac(raw), trap: 'int-remainder-not-reduced' }],
        explanation,
      },
    };
  },
  check(q, p) {
    // Brute force: many actual values of n (and y), compute the expression and its remainder.
    const seen = new Set<number>();
    for (let k = 0; k < 40; k++) {
      for (let j = 0; j < (p.kind === 'product' ? 6 : 1); j++) {
        const n = p.d * k + p.r;
        const n2 = p.d * j + p.c;
        seen.add(transformValue(p, n, n2) % p.e);
      }
    }
    if (seen.size !== 1) return `remainder not constant: ${[...seen]}`;
    return expectNe(q, [...seen][0]);
  },
};

/* ------------------------------------------------------------------ 3. Units digit of an expression in an unknown n (QC) */

interface OnesParams {
  a: number;
  b: number;
  c: number;
  e: number;
  op: '+' | '-';
  k: number;
}

const onesDigitQC: Template<OnesParams> = {
  id: 'arith.divisibility.ones-digit-qc',
  skill: 'arith.divisibility',
  format: 'qc',
  style: 'units digit of a linear expression in an unknown n',
  generate(rng, diff) {
    const op: '+' | '-' = diff === 3 && rng.chance(0.6) ? '-' : '+';
    const roll = rng.next();
    const kind = roll < 0.55 ? 'const' : roll < 0.8 ? 'half' : 'full';
    for (;;) {
      let s: number;
      if (kind === 'const') s = op === '+' ? rng.pick([10, 20]) : rng.pick([10, 20]);
      else if (kind === 'half') s = rng.pick([5, 15, 25]);
      else s = rng.pick(diff === 1 ? [7, 9, 11, 13] : [4, 6, 7, 8, 9, 11, 12, 13, 14, 16]);
      let a: number;
      let c: number;
      if (op === '+') {
        a = rng.int(2, Math.min(19, s - 2));
        c = s - a;
      } else {
        c = rng.int(2, 9);
        a = c + s;
      }
      if (a < 2 || c < 2 || a === c || a > 30) continue;
      let b = rng.int(1, 9);
      let e = rng.int(1, 9);
      if (op === '-' && b < e) [b, e] = [e, b];
      const t = op === '+' ? b + e : b - e;
      const digits = [...new Set(range(1, 10).map((n) => mod(s * n + t, 10)))].sort((x, y) => x - y);
      // Choose the comparison digit k.
      let k: number;
      if (kind === 'const') {
        const u = digits[0];
        const rel = rng.pick(['A', 'B', 'C'] as QCChoice[]);
        if (rel === 'C') k = u;
        else if (rel === 'A') {
          if (u === 0) continue;
          k = rng.int(Math.max(0, u - 4), u - 1);
        } else {
          if (u === 9) continue;
          k = rng.int(u + 1, Math.min(9, u + 4));
        }
      } else if (kind === 'half') {
        const [lo, hi] = digits;
        const opts: (() => number)[] = [() => rng.int(lo + 1, hi - 1)];
        if (lo > 0) opts.push(() => rng.int(0, lo - 1));
        if (hi < 9) opts.push(() => rng.int(hi + 1, 9));
        k = rng.pick(opts)();
      } else {
        k = rng.int(digits[1], digits[digits.length - 2]);
      }
      const rels = new Set(digits.map((dg) => qcCompare(dg, k)));
      const answer: QCChoice = rels.size === 1 ? [...rels][0] : 'D';
      const at1 = qcCompare(mod(s + t, 10), k);
      const traps: QCQuestion['traps'] = at1 !== answer ? { [at1]: 'tested-one-value' } : undefined;

      const xTex = `${a}n + ${b}`;
      const yTex = `${c}n + ${e}`;
      const combo = op === '+' ? 'x + y' : 'x - y';
      const sumTex = t === 0 ? `${s}n` : `${s}n + ${t}`;
      const valueAt = (n: number) => s * n + t;
      let body: string;
      if (kind === 'const') {
        body = `$${combo} = ${sumTex}$. Since $${s}n$ always ends in 0, $${combo}$ always ends in ${digits[0]}, whatever $n$ is.

Compare ${digits[0]} with ${k}: ${QC_WORDS[answer]}. (${answer})`;
      } else if (kind === 'half') {
        const [d1, d2] = [mod(s + t, 10), mod(2 * s + t, 10)];
        body = `$${combo} = ${sumTex}$. The units digit of $${s}n$ is 5 when $n$ is odd and 0 when $n$ is even, so the units digit of $${combo}$ is ${d1} for odd $n$ (e.g. $n = 1$: ${valueAt(1)}) and ${d2} for even $n$ (e.g. $n = 2$: ${valueAt(2)}).

${
          answer === 'D'
            ? `${Math.min(d1, d2)} is less than ${k} but ${Math.max(d1, d2)} is greater, so the relationship cannot be determined. (D)`
            : `Both ${d1} and ${d2} are ${answer === 'A' ? 'greater' : 'less'} than ${k}, so ${QC_WORDS[answer]}. (${answer})`
        }`;
      } else {
        // two values of n on different sides of k
        const ns = range(1, 10);
        const n1 = ns.find((n) => qcCompare(mod(valueAt(n), 10), k) !== qcCompare(mod(valueAt(1), 10), k))!;
        body = `$${combo} = ${sumTex}$. Try a few values: $n = 1$ gives ${valueAt(1)} (units digit ${mod(valueAt(1), 10)}), and $n = ${n1}$ gives ${valueAt(n1)} (units digit ${mod(
          valueAt(n1),
          10,
        )}). One is ${qcCompare(mod(valueAt(1), 10), k) === 'A' ? 'greater than' : qcCompare(mod(valueAt(1), 10), k) === 'B' ? 'less than' : 'equal to'} ${k} and the other is ${
          qcCompare(mod(valueAt(n1), 10), k) === 'A' ? 'greater than' : qcCompare(mod(valueAt(n1), 10), k) === 'B' ? 'less than' : 'equal to'
        } ${k}, so the relationship cannot be determined. (D)`;
      }
      const trapLine =
        traps && answer === 'D'
          ? `\n\nTesting only $n = 1$ suggests a fixed answer; with an unknown $n$, always try a second value.`
          : '';
      return {
        params: { a, b, c, e, op, k },
        q: {
          format: 'qc',
          info: `$n$ is a positive integer, $x = ${xTex}$, and $y = ${yTex}$.`,
          quantityA: `The units digit of $${combo}$`,
          quantityB: `$${k}$`,
          answer,
          traps,
          explanation: body + trapLine,
        },
      };
    }
  },
  check(q, { a, b, c, e, op, k }) {
    const samples = range(1, 120).map((n): [number, number] => {
      const x = a * n + b;
      const y = c * n + e;
      const v = op === '+' ? x + y : x - y;
      return [Number(String(v).slice(-1)), k];
    });
    return expectQc(q, qcFromSamples(samples));
  },
};

/* ------------------------------------------------------------------ 4. Which values could be n, given remainders (MCM) */

interface CouldBeParams {
  conds: [number, number][];
  values: number[];
}

const PAIRS_COPRIME: [number, number][] = [
  [3, 4],
  [4, 5],
  [3, 5],
  [5, 6],
  [4, 7],
  [3, 7],
  [5, 7],
  [6, 7],
  [5, 8],
  [7, 8],
];
const PAIRS_SHARED: [number, number][] = [
  [4, 6],
  [6, 8],
  [6, 9],
  [6, 10],
  [8, 12],
  [9, 12],
  [10, 15],
  [10, 12],
];

function pickDistinct(rng: Rng, pool: number[], k: number, taken: Set<number>): number[] {
  const out: number[] = [];
  for (const v of rng.shuffle(pool)) {
    if (out.length === k) break;
    if (!taken.has(v)) {
      out.push(v);
      taken.add(v);
    }
  }
  return out;
}

const couldBeN: Template<CouldBeParams> = {
  id: 'arith.divisibility.could-be-n',
  skill: 'arith.divisibility',
  format: 'mcm',
  style: 'which values could be n, given its remainders',
  generate(rng, diff) {
    for (;;) {
      const conds: [number, number][] = [];
      if (diff === 1) {
        const dv = rng.int(5, 9);
        conds.push([dv, rng.int(1, dv - 1)]);
      } else {
        const [d1, d2] = rng.shuffle(rng.pick(diff === 2 ? PAIRS_COPRIME : PAIRS_SHARED));
        const n0 = rng.int(1, lcm(d1, d2) - 1);
        conds.push([d1, n0 % d1], [d2, n0 % d2]);
        if (conds.some(([, r]) => r === 0)) continue;
        if (conds[0][1] === conds[1][1] && rng.chance(0.75)) continue;
      }
      const ok = (n: number) => conds.every(([dv, r]) => n % dv === r);
      const okCount = (n: number) => conds.filter(([dv, r]) => n % dv === r).length;
      const lo = 10;
      const hi = diff === 1 ? 99 : 150;
      const pool = range(lo, hi);
      const good = pool.filter(ok);
      const half = conds.length > 1 ? pool.filter((n) => okCount(n) === 1) : [];
      const none = pool.filter((n) => okCount(n) === 0 && conds.some(([dv, r]) => Math.abs((n % dv) - r) === 1));
      const nChoices = diff === 1 ? 5 : 6;
      const nGood = rng.int(1, diff === 1 ? 2 : 3);
      const nHalf = conds.length > 1 ? Math.min(nChoices - nGood - 1, rng.int(2, 3)) : 0;
      const taken = new Set<number>();
      const g = pickDistinct(rng, good, nGood, taken);
      const h = pickDistinct(rng, half, nHalf, taken);
      const z = pickDistinct(rng, none, nChoices - g.length - h.length, taken);
      if (g.length !== nGood || h.length !== nHalf || g.length + h.length + z.length !== nChoices) continue;
      const items = [...g.map((v) => ({ v, correct: true })), ...h.map((v) => ({ v, correct: false, trap: 'int-one-condition-only' })), ...z.map((v) => ({ v, correct: false }))].sort(
        (x, y) => x.v - y.v,
      );
      const { choices, answer } = flaggedChoices(
        items.map((it) => ({ text: `$${it.v}$`, correct: it.correct, ...('trap' in it ? { trap: it.trap } : {}) })) as (Choice & { correct: boolean })[],
      );
      const values = items.map((it) => it.v);
      const condText = conds.map(([dv, r], i) => `${i === 0 ? 'When' : 'when'} $n$ is divided by ${dv}, the remainder is ${r}`).join(', and ');
      const L = conds.reduce((acc, [dv]) => lcm(acc, dv), 1);
      const first = range(1, 200).filter(ok).slice(0, 4);
      const pattern =
        conds.length === 1
          ? `The possible values are $n = ${conds[0][0]}k + ${conds[0][1]}$: ${first.join(', ')}, and so on, going up by ${conds[0][0]}.`
          : `List the numbers that leave remainder ${conds[0][1]} when divided by ${conds[0][0]} (${range(0, 5)
              .map((k) => conds[0][0] * k + conds[0][1])
              .join(', ')}, ...) and keep those that leave remainder ${conds[1][1]} when divided by ${conds[1][0]}. The first is ${first[0]}, and the solutions repeat every lcm$(${conds[0][0]}, ${conds[1][0]}) = ${L}$: ${first.join(', ')}, ...${
              diff === 3 ? ` (not every ${conds[0][0] * conds[1][0]}: ${conds[0][0]} and ${conds[1][0]} share a factor).` : ''
            }`;
      const lines = items
        .map((it) => {
          const parts = conds.map(([dv, r]) => {
            const q0 = Math.floor(it.v / dv);
            const rr = it.v % dv;
            return `$${it.v} = ${dv} \\cdot ${q0} + ${rr}$${rr === r ? '' : ` (not ${r})`}`;
          });
          return `- ${it.v}: ${parts.join(', ')} ${it.correct ? '✓' : '✗'}`;
        })
        .join('\n');
      const trapLine = h.length
        ? `\n\nSome choices satisfy only one of the two conditions; a value of $n$ must satisfy both.`
        : '';
      return {
        params: { conds, values },
        q: {
          format: 'mcm',
          stem: `${condText}. Which of the following could be the value of $n$?`.replace(/^When \$n\$/, 'When the positive integer $n$'),
          instruction: 'Indicate all such values.',
          choices,
          answer,
          explanation: `${pattern}

Check each choice:
${lines}${trapLine}`,
        },
      };
    }
  },
  check(q, { conds, values }) {
    const expected = values.flatMap((v, i) => (conds.every(([dv, r]) => (v - r) % dv === 0) ? [i] : []));
    return expectMcm(q, expected);
  },
};


/* ------------------------------------------------------------------ 5. Remainder of a power of 10 plus a constant (QC) */

interface PowRemParams {
  d: number;
  /** exponent, or 0 when k is unknown */
  k: number;
  kInfo: 'given' | 'even' | 'any';
  c: number;
  sign: 1 | -1;
  bv: number;
}

/** Remainder of 10^k by pattern (generate): 9 and 3 -> 1; 11 -> 1 or 10 by parity; 4 (k >= 2), 8 (k >= 3) -> 0. */
function tenPowRem(d: number, k: number): number {
  if (d === 9 || d === 3) return 1;
  if (d === 11) return k % 2 === 0 ? 1 : 10;
  return 0;
}

const powerRemainderQC: Template<PowRemParams> = {
  id: 'arith.divisibility.power-remainder-qc',
  skill: 'arith.divisibility',
  format: 'qc',
  style: 'remainder of 10^k plus or minus a constant',
  generate(rng, diff) {
    for (;;) {
      const d = rng.pick(diff === 1 ? [9, 3, 4] : diff === 2 ? [9, 11, 4, 8] : [11, 11, 9, 8]);
      const kInfo: PowRemParams['kInfo'] = d === 11 && diff >= 2 ? rng.pick(['given', 'even', 'any'] as const) : 'given';
      const k = kInfo === 'given' ? rng.int(d === 8 ? 6 : 10, 40) : 0;
      const sign: 1 | -1 = diff >= 2 && d !== 4 && d !== 8 && rng.chance(0.35) ? -1 : 1;
      const c = sign < 0 ? rng.int(1, d === 11 ? 9 : d - 1) : rng.int(1, diff === 1 ? 8 : 20);
      const ks = kInfo === 'given' ? [k] : kInfo === 'even' ? [2, 4] : [1, 2];
      const rems = [...new Set(ks.map((kk) => mod(tenPowRem(d, kk) + sign * c, d)))];
      const raw = tenPowRem(d, ks[0]) + sign * c; // before reducing
      let bv: number;
      const roll = rng.next();
      if (rems.length === 2) {
        const [lo, hi] = [Math.min(...rems), Math.max(...rems)];
        bv = roll < 0.6 ? rng.int(lo, hi) : roll < 0.8 ? lo - rng.int(1, 2) : hi + rng.int(1, 2);
        if (bv < 0) continue;
      } else {
        const r = rems[0];
        bv = roll < 0.35 ? r : roll < 0.7 ? r + rng.int(1, 2) : r - rng.int(1, 2);
        if (bv < 0) continue;
      }
      const rels = new Set(rems.map((r) => qcCompare(r, bv)));
      const answer: QCChoice = rels.size === 1 ? [...rels][0] : 'D';
      const traps: QCQuestion['traps'] = {};
      if (answer !== 'D') traps.D = 'int-huge-number';
      if (rems.length === 1 && raw !== rems[0] && raw >= 0) {
        const t = qcCompare(raw, bv);
        if (t !== answer) traps[t] = 'int-remainder-not-reduced';
      }
      if (rems.length === 2) {
        const t = qcCompare(rems[ks[1] % 2 === 0 ? 1 : 0] ?? rems[0], bv);
        if (t !== answer && !traps[t]) traps[t] = 'tested-one-value';
      }
      const op = sign > 0 ? '+' : '-';
      const kTex = kInfo === 'given' ? `${k}` : 'k';
      const info =
        kInfo === 'given'
          ? `$m = 10^{${k}} ${op} ${c}$, and $r$ is the remainder when $m$ is divided by ${d}.`
          : `$k$ is ${kInfo === 'even' ? 'an even positive integer' : 'a positive integer'}, $m = 10^{k} ${op} ${c}$, and $r$ is the remainder when $m$ is divided by ${d}.`;
      let why: string;
      if (d === 9 || d === 3)
        why = `$10^{${kTex}} = 99\\ldots9 + 1$, and a number made of nines is divisible by ${d}. So $10^{${kTex}}$ leaves remainder 1 when divided by ${d}`;
      else if (d === 11)
        why = `$100 = 99 + 1$ and 99 is divisible by 11, so every even power of 10 (a power of 100) leaves remainder 1 when divided by 11, while odd powers ($10 \\cdot 100^j$) leave remainder 10`;
      else why = `$10^{${kTex}}$ ends in at least ${d === 4 ? 'two' : 'three'} zeros, so it is a multiple of ${d === 4 ? '100, hence of 4' : '1,000, hence of 8'}: remainder 0`;
      const remLine = (kk: number) => {
        const t0 = tenPowRem(d, kk);
        const val = t0 + sign * c;
        if (val < 0) return `$${t0} - ${c} = ${val}$; adding ${d} gives the remainder $${val + d}$`;
        return `$${t0} ${op} ${c} = ${val}$${val === mod(val, d) ? '' : `, which leaves remainder ${mod(val, d)}`}`;
      };
      let body: string;
      if (rems.length === 1) {
        body = `Then $m$ leaves the same remainder as ${remLine(ks[0])}: $r = ${rems[0]}$. Compare with ${bv}: ${QC_WORDS[answer]}. (${answer})`;
      } else {
        const [ev, od] = [mod(1 + sign * c, d), mod(10 + sign * c, d)];
        body = `If $k$ is even, $r$ comes from ${remLine(2)}, so $r = ${ev}$; if $k$ is odd, from ${remLine(1)}, so $r = ${od}$.

${answer === 'D' ? `Since ${ev} and ${od} compare differently with ${bv}, the relationship cannot be determined. (D)` : `Both values are ${answer === 'A' ? 'greater' : 'less'} than ${bv}, so ${QC_WORDS[answer]}. (${answer})`}`;
      }
      return {
        params: { d, k, kInfo, c, sign, bv },
        q: {
          format: 'qc',
          info,
          quantityA: '$r$',
          quantityB: `$${bv}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `${why}. ${body}${answer !== 'D' ? `\n\n$m$ is far too large to compute, but its remainder follows the pattern of the powers of 10.` : ''}`,
        },
      };
    }
  },
  check(q, { d, k, kInfo, c, sign, bv }) {
    const ks = kInfo === 'given' ? [k] : kInfo === 'even' ? [2, 4, 6, 8, 10, 12] : range(1, 12);
    const samples = ks.map((kk): [number, number] => {
      const m = 10n ** BigInt(kk) + BigInt(sign * c);
      return [Number(m % BigInt(d)), bv];
    });
    return expectQc(q, qcFromSamples(samples));
  },
};

export const divisibilityTemplates: Template<any>[] = [mustDivide, remainderTransform, onesDigitQC, couldBeN, powerRemainderQC];
