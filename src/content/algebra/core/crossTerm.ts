import type { QCChoice, Template, Trap } from '../../../engine/types';
import { N, V, add, mul, pow, qcEnd, qcSamples, randomReals, texEx, type Ex } from './util';

/* Compare a squared sum with a sum of squares: the cross term is the whole difference, so only its sign matters (QC). */

type Kind = 'shift' | 'cross' | 'twin' | 'amgm';
/** What a condition says about the sign of the product xy (about x alone for 'shift'). */
type Rel = '+' | '-' | '0' | '?';

interface Cond {
  id: string;
  info: (X: string, Y: string, k: number) => string;
  rel: Rel;
  /** One sentence on what the condition says about the sign of the cross factor. */
  why: (X: string, Y: string) => string;
  ok: (x: number, y: number, k: number) => boolean;
}

const ints = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y);

const COND: Record<string, Cond> = {
  pos: { id: 'pos', info: (X, Y) => `$${X}${Y} > 0$`, rel: '+', why: (X, Y) => `$${X}${Y} > 0$`, ok: (x, y) => x * y > 0 },
  neg: { id: 'neg', info: (X, Y) => `$${X}${Y} < 0$`, rel: '-', why: (X, Y) => `$${X}${Y} < 0$`, ok: (x, y) => x * y < 0 },
  split: { id: 'split', info: (X, Y) => `$${X} > 0$ and $${Y} < 0$`, rel: '-', why: (X, Y) => `$${X} > 0$ and $${Y} < 0$ give $${X}${Y} < 0$`, ok: (x, y) => x > 0 && y < 0 },
  both: { id: 'both', info: (X, Y) => `$${X}$ and $${Y}$ are both positive`, rel: '+', why: (X, Y) => `positive $${X}$ and $${Y}$ give $${X}${Y} > 0$`, ok: (x, y) => x > 0 && y > 0 },
  ints: { id: 'ints', info: (X, Y) => `$${X}$ and $${Y}$ are nonzero integers`, rel: '?', why: (X, Y) => `nonzero integers $${X}$ and $${Y}$ can have the same sign or opposite signs`, ok: (x, y) => ints(x, y) && x !== 0 && y !== 0 },
  zero: { id: 'zero', info: (X, Y) => `$${X}${Y} = 0$`, rel: '0', why: (X, Y) => `$${X}${Y} = 0$`, ok: (x, y) => x * y === 0 },
  nonneg: { id: 'nonneg', info: (X, Y) => `$${X}${Y} \\ge 0$`, rel: '?', why: (X, Y) => `$${X}${Y}$ may be positive or may be 0`, ok: (x, y) => x * y >= 0 },
  odd3: { id: 'odd3', info: (X, Y) => `$${X}^{3}${Y} > 0$`, rel: '+', why: (X, Y) => `$${X}^{3}$ has the sign of $${X}$, so $${X}^{3}${Y} > 0$ means $${X}$ and $${Y}$ have the same sign: $${X}${Y} > 0$`, ok: (x, y) => x ** 3 * y > 0 },
  odd3b: { id: 'odd3b', info: (X, Y) => `$${X}${Y}^{3} < 0$`, rel: '-', why: (X, Y) => `$${Y}^{3}$ has the sign of $${Y}$, so $${X}${Y}^{3} < 0$ means opposite signs: $${X}${Y} < 0$`, ok: (x, y) => x * y ** 3 < 0 },
  sq1: { id: 'sq1', info: (X, Y) => `$${X}^{2}${Y} > 0$`, rel: '?', why: (X, Y) => `$${X}^{2}$ is positive, so only $${Y} > 0$ is forced; $${X}$ can have either sign, so $${X}${Y}$ can be positive or negative`, ok: (x, y) => x * x * y > 0 },
  sq2: { id: 'sq2', info: (X, Y) => `$${X}${Y}^{2} < 0$`, rel: '?', why: (X, Y) => `$${Y}^{2}$ is positive, so only $${X} < 0$ is forced; $${Y}$ can have either sign, so $${X}${Y}$ can be positive or negative`, ok: (x, y) => x * y * y < 0 },
  // one variable ('shift')
  xpos: { id: 'xpos', info: (X) => `$${X} > 0$`, rel: '+', why: (X) => `$${X} > 0$`, ok: (x) => x > 0 },
  xneg: { id: 'xneg', info: (X) => `$${X} < 0$`, rel: '-', why: (X) => `$${X} < 0$`, ok: (x) => x < 0 },
  xnz: { id: 'xnz', info: (X) => `$${X} \\ne 0$`, rel: '?', why: (X) => `$${X}$ may be positive or negative`, ok: (x) => x !== 0 },
  xint: { id: 'xint', info: (X) => `$${X}$ is an integer`, rel: '?', why: (X) => `an integer $${X}$ may be positive, negative or 0`, ok: (x) => Number.isInteger(x) },
  // amgm: A - B = (x - ky)^2
  ne: { id: 'ne', info: (X, Y, k) => `$${X} \\ne ${k === 1 ? '' : k}${Y}$`, rel: '+', why: () => '', ok: (x, y, k) => x !== k * y },
  eq: { id: 'eq', info: (X, Y, k) => `$${X} = ${k === 1 ? '' : k}${Y}$`, rel: '0', why: () => '', ok: (x, y, k) => x === k * y },
  aint: { id: 'aint', info: (X, Y) => `$${X}$ and $${Y}$ are integers`, rel: '?', why: () => '', ok: (x, y) => ints(x, y) },
  par: {
    id: 'par',
    info: (X, Y, k) => (k % 2 === 0 ? `$${X}$ is an odd integer and $${Y}$ is an integer` : `$${X}$ is an even integer and $${Y}$ is an odd integer`),
    rel: '+',
    why: () => '',
    ok: (x, y, k) => ints(x, y) && (k % 2 === 0 ? Math.abs(x) % 2 === 1 : Math.abs(x) % 2 === 0 && Math.abs(y) % 2 === 1),
  },
};

interface P {
  kind: Kind;
  names: [string, string];
  /** shift: signed constant c; cross/twin: [p, q]; amgm: k. */
  c: number;
  p: number;
  q: number;
  k: number;
  cond: string;
  swap: boolean;
}

const NAMES: [string, string][] = [['x', 'y'], ['a', 'b'], ['m', 'n'], ['s', 't'], ['p', 'q']];
const SHIFT_NAMES = ['x', 't', 'n', 'm', 's', 'a'];

function exprs(P: P): { A: Ex; B: Ex } {
  const [X, Y] = P.names;
  let A: Ex;
  let B: Ex;
  if (P.kind === 'shift') {
    A = pow(add(V(X), N(P.c)), 2);
    B = add(pow(V(X), 2), N(P.c * P.c));
  } else if (P.kind === 'amgm') {
    A = pow(add(V(X), P.k === 1 ? V(Y) : mul(N(P.k), V(Y))), 2);
    B = mul(N(4 * P.k), V(X), V(Y));
  } else {
    const px = P.p === 1 ? V(X) : mul(N(P.p), V(X));
    A = pow(add(px, mul(N(P.q), V(Y))), 2);
    B = P.kind === 'cross' ? add(mul(N(P.p * P.p), pow(V(X), 2)), mul(N(P.q * P.q), pow(V(Y), 2))) : pow(add(px, mul(N(-P.q), V(Y))), 2);
  }
  return P.swap ? { A: B, B: A } : { A, B };
}

/** Numeric values (A, B) before the optional swap of the two quantities. */
function values(P: P, x: number, y: number): [number, number] {
  if (P.kind === 'shift') return [(x + P.c) ** 2, x * x + P.c * P.c];
  if (P.kind === 'amgm') return [(x + P.k * y) ** 2, 4 * P.k * x * y];
  if (P.kind === 'cross') return [(P.p * x + P.q * y) ** 2, P.p * P.p * x * x + P.q * P.q * y * y];
  return [(P.p * x + P.q * y) ** 2, (P.p * x - P.q * y) ** 2];
}

/** Coefficient of the cross factor in (first quantity - second quantity), before the swap. */
const coefOf = (P: P) => (P.kind === 'shift' ? 2 * P.c : P.kind === 'cross' ? 2 * P.p * P.q : 4 * P.p * P.q);

const WORD: Record<QCChoice, string> = { A: 'Quantity A is greater', B: 'Quantity B is greater', C: 'the quantities are equal', D: '' };
const flip = (a: QCChoice): QCChoice => (a === 'A' ? 'B' : a === 'B' ? 'A' : a);

const POOL = {
  1: { kinds: ['shift'] as Kind[], conds: ['xpos', 'xneg', 'xpos', 'xneg', 'xnz', 'xint'] },
  2: { kinds: ['cross', 'cross', 'amgm'] as Kind[], conds: { cross: ['pos', 'neg', 'split', 'both', 'ints', 'zero', 'nonneg', 'pos', 'neg'], amgm: ['ne', 'ne', 'eq', 'aint'] } },
  3: { kinds: ['cross', 'twin', 'twin', 'amgm'] as Kind[], conds: { cross: ['odd3', 'odd3b', 'sq1', 'sq2', 'nonneg'], twin: ['odd3', 'odd3b', 'sq1', 'sq2', 'pos', 'neg', 'ints'], amgm: ['par', 'par', 'aint'] } },
};

const crossTermQC: Template<P> = {
  id: 'alg.expressions.cross-term-qc',
  skill: 'alg.expressions',
  format: 'qc',
  style: 'compare a squared sum with a sum of squares: the sign of the cross term',
  generate(rng, d) {
    const pool = POOL[d];
    const kind = rng.pick(pool.kinds);
    const condIds = d === 1 ? (pool as typeof POOL[1]).conds : ((pool as typeof POOL[2]).conds as Record<string, string[]>)[kind];
    const cond = rng.pick(condIds);
    const names = kind === 'shift' ? ([rng.pick(SHIFT_NAMES), ''] as [string, string]) : rng.pick(NAMES);
    const P: P = {
      kind,
      names: rng.chance(0.5) && kind !== 'shift' ? [names[1], names[0]] : names,
      c: kind === 'shift' ? rng.int(2, 9) * rng.sign() : 0,
      p: kind === 'cross' || kind === 'twin' ? rng.int(1, d === 3 ? 4 : 3) : 1,
      q: kind === 'cross' || kind === 'twin' ? rng.int(1, 4) * rng.sign() : 1,
      k: kind === 'amgm' ? (d === 2 ? rng.int(1, 3) : rng.int(2, 6)) : 1,
      cond,
      swap: rng.chance(0.5),
    };
    if (kind === 'twin' && P.p === 1 && Math.abs(P.q) === 1) P.p = 2;
    const [X, Y] = P.names;
    const cd = COND[cond];
    const one = kind === 'shift';
    const coef = coefOf(P);
    // answer before the swap of the two quantities
    let ans: QCChoice;
    if (kind === 'amgm') ans = cd.rel === '+' ? 'A' : cd.rel === '0' ? 'C' : 'D';
    else ans = cd.rel === '0' ? 'C' : cd.rel === '?' ? 'D' : (cd.rel === '+') === coef > 0 ? 'A' : 'B';
    const { A, B } = exprs(P);
    // two admissible cases that disagree (for D)
    let dText = '';
    if (ans === 'D') {
      const grid: [number, number][] = [];
      for (const r of [1, 2, 3, 4, 5, 6, 0])
        for (let x = -r; x <= r; x++)
          for (let y = -r; y <= r; y++) if (Math.max(Math.abs(x), Math.abs(y)) === r) grid.push([x, y]);
      const seen: { rel: QCChoice; txt: string }[] = [];
      for (const [x, y] of grid) {
        if (!cd.ok(x, y, P.k) || (one && y !== 0)) continue;
        const [a, b] = values(P, x, y);
        let rel: QCChoice = a === b ? 'C' : a > b ? 'A' : 'B';
        if (P.swap) rel = flip(rel);
        if (seen.some((s) => s.rel === rel)) continue;
        const [qa, qb] = P.swap ? [b, a] : [a, b];
        seen.push({ rel, txt: `${one ? `$${X} = ${x}$` : `$${X} = ${x}$ and $${Y} = ${y}$`} gives $${qa}$ and $${qb}$, so ${WORD[rel]}` });
        if (seen.length === 2) break;
      }
      dText = `Two allowed cases disagree: ${seen[0].txt}; but ${seen[1].txt}.`;
    }
    const cross = (c: number) => texEx(mul(N(c), V(X), ...(one ? [] : [V(Y)])));
    const px = P.p === 1 ? V(X) : mul(N(P.p), V(X));
    const sq1 = kind === 'shift' ? pow(add(V(X), N(P.c)), 2) : kind === 'amgm' ? pow(add(V(X), P.k === 1 ? V(Y) : mul(N(P.k), V(Y))), 2) : pow(add(px, mul(N(P.q), V(Y))), 2);
    const sq2 = kind === 'twin' ? pow(add(px, mul(N(-P.q), V(Y))), 2) : kind === 'shift' ? add(pow(V(X), 2), N(P.c * P.c)) : kind === 'amgm' ? mul(N(4 * P.k), V(X), V(Y)) : exprs({ ...P, swap: false }).B;
    const diff = kind === 'amgm' ? `(${X} - ${P.k === 1 ? '' : P.k}${Y})^{2}` : cross(coef);
    let body: string;
    if (kind === 'shift') {
      body = `Expand the square: $${texEx(sq1)}$ becomes $${texEx(add(pow(V(X), 2), mul(N(2 * P.c), V(X)), N(P.c * P.c)))}$. Compared with $${texEx(sq2)}$, the only extra piece is the cross term $${cross(coef)}$.`;
    } else if (kind === 'cross') {
      body = `Expand the square: $${texEx(sq1)} = ${texEx(add(mul(N(P.p * P.p), pow(V(X), 2)), mul(N(2 * P.p * P.q), V(X), V(Y)), mul(N(P.q * P.q), pow(V(Y), 2))))}$. Compared with the sum of squares, the only extra piece is the cross term $${cross(coef)}$.`;
    } else if (kind === 'twin') {
      body = `The two squares have the same $${X}^{2}$ and $${Y}^{2}$ terms. Their cross terms are $${cross(coef / 2)}$ in the first and $${cross(-coef / 2)}$ in the second, so the difference is $${cross(coef)}$.`;
    } else {
      body = `Subtract: $${texEx(sq1)} - ${texEx(sq2)} = ${texEx(add(pow(V(X), 2), mul(N(-2 * P.k), V(X), V(Y)), mul(N(P.k * P.k), pow(V(Y), 2))))} = ${diff}$, a square. It is never negative, and it is 0 only when $${X} = ${P.k === 1 ? '' : P.k}${Y}$.`;
    }
    const sub = kind === 'cross' || kind === 'shift' ? `the square minus the other quantity` : `the first quantity minus the second`;
    let tail: string;
    if (kind === 'amgm') {
      tail =
        cd.rel === '+'
          ? `Here the condition rules out the zero case${cd.id === 'par' ? ` (${P.k % 2 === 0 ? `$${P.k}${Y}$ is even while $${X}$ is odd` : `$${P.k}${Y}$ is odd while $${X}$ is even`})` : ''}, so the difference is positive and the square $${texEx(sq1)}$ is the greater.`
          : cd.rel === '0'
            ? `Here the zero case is given, so the two quantities are equal.`
            : `Integers allow $${X} = ${P.k === 1 ? '' : P.k}${Y}$ (equal quantities) and other values (different quantities).`;
    } else {
      tail = `From the condition: ${cd.why(X, Y)}. ${
        cd.rel === '0'
          ? `So the cross term is 0 and the quantities are equal.`
          : cd.rel === '?'
            ? `That does not fix the sign of the cross term.`
            : `The multiplier is $${coef}$, so the cross term is ${(cd.rel === '+') === coef > 0 ? 'positive' : 'negative'} and ${sub} is ${(cd.rel === '+') === coef > 0 ? 'positive' : 'negative'}.`
      }`;
    }
    const traps: Partial<Record<QCChoice, string>> = {};
    const real: QCChoice = P.swap ? flip(ans) : ans;
    if (ans === 'D') {
      const tempt: QCChoice = kind === 'amgm' ? 'A' : coef > 0 ? 'A' : 'B';
      traps[P.swap ? flip(tempt) : tempt] = kind === 'amgm' ? 'alg-sq-equality-case' : 'alg-assumed-positive';
    } else traps.D = 'alg-qc-variable-d';
    if (real !== 'C') traps.C = 'alg-sq-no-cross-term';
    return {
      params: P,
      q: {
        format: 'qc',
        info: cd.info(X, Y, P.k),
        quantityA: `$${texEx(A)}$`,
        quantityB: `$${texEx(B)}$`,
        answer: real,
        traps,
        explanation: `${body}

${tail}${ans === 'D' ? ` ${dText}` : ''} ${qcEnd(real)}

Rule: when a quantity is a square, expand it; the leftover term decides the comparison.`,
      },
    };
  },
  check(q, P, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const cd = COND[P.cond];
    const one = P.kind === 'shift';
    const pairs: [number, number][] = [];
    for (let x = -12; x <= 12; x++) for (let y = -12; y <= 12; y++) pairs.push([x, y]);
    for (let y = -12; y <= 12; y++) pairs.push([P.k * y, y]);
    const r = randomReals(rng, 120);
    for (let i = 0; i + 1 < r.length; i += 2) pairs.push([r[i], r[i + 1]]);
    for (let i = 0; i < 40; i++) pairs.push([r[i], rng.int(-5, 5)], [rng.int(-5, 5), r[i + 40]]);
    const ok = pairs.filter(([x, y]) => cd.ok(x, y, P.k));
    const xs = one ? [...new Set(ok.map(([x]) => x))].map((x) => [x, 0] as [number, number]) : ok;
    if (!xs.length) return 'no admissible sample';
    const samples = xs.map(([x, y]) => {
      const [a, b] = values(P, x, y);
      return (P.swap ? [b, a] : [a, b]) as [number, number];
    });
    const exp = qcSamples(samples);
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const crossTermTemplate = crossTermQC;
export const crossTermTraps: Record<string, Trap> = {
  'alg-sq-no-cross-term': {
    label: '$(a + b)^2 = a^2 + b^2$',
    fix: 'A square has a middle term: $(a + b)^2 = a^2 + 2ab + b^2$. The two quantities differ by exactly that term, so its sign decides the comparison.',
  },
  'alg-assumed-positive': {
    label: 'Assumed the variables are positive',
    fix: 'Read what the condition allows. If a negative value (or a value with the opposite sign) is allowed, try it: the sign of the cross term decides which quantity is greater.',
  },
  'alg-sq-equality-case': {
    label: 'Forgot that a square can be 0',
    fix: '$(x - ky)^2 \\ge 0$ but it equals 0 when $x = ky$. If the condition allows that case, the quantities can be equal as well as unequal.',
  },
};
