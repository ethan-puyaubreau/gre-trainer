import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { num, plain, usd } from '../../../engine/tex';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { expectMCM, expectMCS, expectNE, expectQC, extremeIndex, F, pickWeighted, qcEnd, swapQC } from './util';

/* ================================================================== 1. Operations that keep a fraction equal (MCM) */

type OpKind = 'add' | 'sub' | 'mul' | 'div' | 'mulNeg' | 'square' | 'cube' | 'divFrac' | 'mulDec' | 'selfAdd' | 'addFrac' | 'recip';

interface OpDef {
  always: boolean;
  text: (k: number) => string;
  /** Apply the operation to one part (numerator or denominator). null = undefined. */
  apply: (x: Frac, k: number) => Frac | null;
  /** TeX of the operation applied to a part given as TeX. */
  tex: (x: string, k: number) => string;
}

const OPS: Record<OpKind, OpDef> = {
  add: { always: false, text: (k) => `Adding $${k}$`, apply: (x, k) => x.add(k), tex: (x, k) => `${x} + ${k}` },
  sub: { always: false, text: (k) => `Subtracting $${k}$`, apply: (x, k) => x.sub(k), tex: (x, k) => `${x} - ${k}` },
  mul: { always: true, text: (k) => `Multiplying by $${k}$`, apply: (x, k) => x.mul(k), tex: (x, k) => `${x} \\cdot ${k}` },
  div: { always: true, text: (k) => `Dividing by $${k}$`, apply: (x, k) => x.div(k), tex: (x, k) => `${x} \\div ${k}` },
  mulNeg: { always: true, text: (k) => `Multiplying by $-${k}$`, apply: (x, k) => x.mul(-k), tex: (x, k) => `${x} \\cdot (-${k})` },
  square: { always: false, text: () => 'Squaring', apply: (x) => x.pow(2), tex: (x) => `${x}^2` },
  cube: { always: false, text: () => 'Cubing', apply: (x) => x.pow(3), tex: (x) => `${x}^3` },
  divFrac: {
    always: true,
    text: (k) => `Dividing by $\\frac{1}{${k}}$`,
    apply: (x, k) => x.div(F(1, k)),
    tex: (x, k) => `${x} \\div \\frac{1}{${k}}`,
  },
  mulDec: { always: true, text: (k) => `Multiplying by $0.${k}$`, apply: (x, k) => x.mul(F(k, 10)), tex: (x, k) => `${x} \\cdot 0.${k}` },
  selfAdd: { always: true, text: () => 'Adding each one to itself', apply: (x) => x.add(x), tex: (x) => `${x} + ${x}` },
  addFrac: {
    always: false,
    text: (k) => `Adding $\\frac{1}{${k}}$`,
    apply: (x, k) => x.add(F(1, k)),
    tex: (x, k) => `${x} + \\frac{1}{${k}}`,
  },
  recip: {
    always: false,
    text: () => 'Replacing each one with its reciprocal',
    apply: (x) => (x.n === 0 ? null : x.inv()),
    tex: (x) => `\\frac{1}{${x}}`,
  },
};

const OP_POOL: Record<Difficulty, OpKind[]> = {
  1: ['add', 'sub', 'mul', 'div', 'square'],
  2: ['add', 'sub', 'mul', 'div', 'mulNeg', 'square', 'addFrac', 'recip'],
  3: ['add', 'sub', 'mul', 'div', 'mulNeg', 'square', 'cube', 'divFrac', 'mulDec', 'selfAdd', 'addFrac', 'recip'],
};

interface EqOpsParams {
  mode: 'general' | 'specific';
  p: number;
  q: number;
  ops: { kind: OpKind; k: number }[];
}

const SPECIFIC_FRACS: [number, number][] = [
  [3, 7],
  [4, 9],
  [5, 8],
  [2, 7],
  [5, 6],
  [7, 10],
  [3, 8],
  [4, 5],
  [5, 9],
];

const equivalentOps: Template<EqOpsParams> = {
  id: 'arith.fractions.equivalent-ops',
  skill: 'arith.fractions',
  format: 'mcm',
  style: 'which operations on both parts keep a fraction equal',
  generate(rng, d) {
    const mode: EqOpsParams['mode'] = d === 1 ? 'specific' : 'general';
    const [p, q] = mode === 'specific' ? rng.pick(SPECIFIC_FRACS) : [2, 5];
    const n = d === 1 ? 3 : d === 2 ? 4 : 5;
    let kinds: OpKind[];
    do kinds = rng.sample(OP_POOL[d], n);
    while (
      kinds.every((k) => OPS[k].always) ||
      kinds.every((k) => !OPS[k].always) ||
      (kinds.length === 3 && ['add', 'mul', 'div'].every((k) => kinds.includes(k as OpKind))) // the published trio
    );
    const ops = kinds.map((kind) => {
      let k = 1;
      if (kind === 'add' || kind === 'sub') k = rng.int(1, 3);
      else if (kind === 'mul' || kind === 'div' || kind === 'mulNeg') k = rng.int(2, 9);
      else if (kind === 'divFrac' || kind === 'addFrac') k = rng.int(2, 5);
      else if (kind === 'mulDec') k = rng.pick([2, 4, 5]);
      return { kind, k };
    });
    const { choices, answer } = flaggedChoices(
      ops.map(({ kind, k }) => ({
        text: OPS[kind].text(k),
        correct: OPS[kind].always,
        ...(OPS[kind].always ? {} : { trap: 'num-same-operation-both' }),
      })),
    );
    const f = F(p, q).toTex();
    const lines = ops.map(({ kind, k }) => {
      const def = OPS[kind];
      const top = def.apply(F(p), k)!;
      const bottom = def.apply(F(q), k)!;
      const res = top.div(bottom);
      const ok = res.eq(F(p, q));
      const intParts = top.isInt() && bottom.isInt();
      const alreadyReduced = intParts && bottom.n > 0 && gcd(top.n, bottom.n) === 1;
      const raw = intParts && !alreadyReduced ? `\\dfrac{${top.toTex()}}{${bottom.toTex()}}` : res.toTex();
      const tail = ok ? (raw === f ? '' : ` = ${f}`) : raw === res.toTex() ? ` \\ne ${f}` : ` = ${res.toTex()} \\ne ${f}`;
      return `- ${def.text(k)}: $\\dfrac{${def.tex(String(p), k)}}{${def.tex(String(q), k)}} = ${raw}${tail}$ ${ok ? '✓' : '✗'}`;
    });
    const hasAdd = kinds.some((k) => k === 'add' || k === 'addFrac' || k === 'sub');
    const stem =
      mode === 'specific'
        ? `Each operation below is performed on both the numerator and the denominator of the fraction $${f}$. Which of the operations give a fraction equal to $${f}$?`
        : `A fraction has a nonzero numerator and a nonzero denominator. Each operation below is performed on both its numerator and its denominator. Which of the operations give a fraction equal to the original fraction, no matter what the fraction is?`;
    const intro =
      mode === 'specific'
        ? `Multiplying or dividing the numerator and the denominator by the same nonzero number multiplies the fraction by a form of 1, so its value does not change. Other operations change it. Check each one on $${f}$:`
        : `Multiplying or dividing the numerator and the denominator by the same nonzero number multiplies the fraction by a form of 1 (such as $\\frac{3}{3}$), so the value never changes. For the other operations one counterexample is enough. Test them on $${f}$:`;
    return {
      params: { mode, p, q, ops },
      q: {
        format: 'mcm',
        stem,
        instruction: 'Indicate all such operations.',
        choices,
        answer,
        explanation: `${intro}
${lines.join('\n')}

${
          hasAdd
            ? 'Adding (or subtracting) the same number to both parts is the classic trap: it changes the value unless the fraction equals 1.'
            : 'Powers and reciprocals change the value too: only multiplying or dividing by the same nonzero number is safe.'
        }`,
      },
    };
  },
  check(q, { mode, p, q: den, ops }) {
    // Brute force: apply each operation to many fractions (or the given one) and compare values.
    const samples: [number, number][] = [];
    if (mode === 'specific') samples.push([p, den]);
    else for (const a of [-3, -1, 1, 2, 3, 5, 7]) for (const b of [-4, -2, 1, 3, 4, 6, 9]) samples.push([a, b]);
    const expected = ops.flatMap(({ kind, k }, i) => {
      const def = OPS[kind];
      const always = samples.every(([a, b]) => {
        const top = def.apply(F(a), k);
        const bottom = def.apply(F(b), k);
        if (!top || !bottom || bottom.n === 0) return false;
        return top.div(bottom).eq(F(a, b));
      });
      return always ? [i] : [];
    });
    return expectMCM(q, expected);
  },
};

/* ================================================================== 2. Same change to numerator and denominator (QC) */

type SCMode = 'numeric' | 'add-pos' | 'add-nonneg' | 'factor' | 'sub';

interface SCParams {
  mode: SCMode;
  p: number;
  q: number;
  k: number;
  swap: boolean;
}

function coprimePair(rng: Rng, lo: number, hi: number, less: boolean): [number, number] {
  for (;;) {
    const a = rng.int(lo, hi);
    const b = rng.int(lo, hi);
    if (a === b || gcd(a, b) !== 1) continue;
    const [s, l] = a < b ? [a, b] : [b, a];
    return less ? [s, l] : [l, s];
  }
}

const sameChangeQC: Template<SCParams> = {
  id: 'arith.fractions.same-change-qc',
  skill: 'arith.fractions',
  format: 'qc',
  style: 'same number added to numerator and denominator',
  generate(rng, d) {
    const weights: Record<Difficulty, [SCMode, number][]> = {
      1: [
        ['numeric', 4],
        ['add-pos', 3],
        ['add-nonneg', 1.5],
        ['factor', 1.5],
      ],
      2: [
        ['numeric', 1],
        ['add-pos', 3.5],
        ['add-nonneg', 2.5],
        ['factor', 1.5],
        ['sub', 1.5],
      ],
      3: [
        ['add-pos', 2],
        ['add-nonneg', 2.5],
        ['factor', 2],
        ['sub', 3.5],
      ],
    };
    const mode = pickWeighted(rng, weights[d]);
    const less = mode === 'sub' ? true : rng.chance(0.6);
    const [p, q] = mode === 'numeric' ? coprimePair(rng, 11, 60, less) : coprimePair(rng, 2, 12, less);
    const k = mode === 'numeric' ? rng.int(1, 9) : 0;
    const swap = rng.chance(0.5);
    const f = F(p, q).toTex();
    const x = 'x';
    let changed: string;
    let info: string | undefined;
    // Relation of the changed fraction to the original (changed vs original).
    let rel: QCChoice;
    let trapRel: QCChoice | null = null;
    let trapId = 'num-add-same-to-fraction';
    let why: string;
    if (mode === 'numeric') {
      changed = `\\frac{${p + k}}{${q + k}}`;
      rel = p < q ? 'A' : 'B';
      trapRel = 'C';
      why = `$${changed}$ is $${f}$ with ${k} added to both parts. Cross-multiply: $${p + k} \\cdot ${q} = ${num((p + k) * q)}$ and $${p} \\cdot ${q + k} = ${num(p * (q + k))}$, so $${changed}$ is the ${
        rel === 'A' ? 'greater' : 'smaller'
      } fraction. Adding the same positive number to both parts moves a fraction toward 1: ${p < q ? 'a fraction less than 1 grows' : 'a fraction greater than 1 shrinks'}.`;
    } else if (mode === 'add-pos' || mode === 'add-nonneg') {
      changed = `\\frac{${p} + ${x}}{${q} + ${x}}`;
      info = mode === 'add-pos' ? `$${x} > 0$` : `$${x} \\ge 0$`;
      const strictRel: QCChoice = p < q ? 'A' : 'B';
      const crossing = `Both denominators are positive, so cross-multiply: compare $(${p} + x) \\cdot ${q} = ${p * q} + ${q}x$ with $${p}(${q} + x) = ${p * q} + ${p}x$, that is, $${q}x$ with $${p}x$.`;
      if (mode === 'add-pos') {
        rel = strictRel;
        trapRel = 'C';
        why = `${crossing} Since $x > 0$ and $${q} ${q > p ? '>' : '<'} ${p}$, $${q}x ${q > p ? '>' : '<'} ${p}x$, so $${changed}$ is ${rel === 'A' ? 'greater' : 'smaller'} than $${f}$. Adding a positive number to both parts moves the fraction toward 1.`;
      } else {
        rel = 'D';
        trapRel = strictRel;
        trapId = 'num-boundary-value';
        why = `${crossing} If $x = 0$ they are equal. If $x > 0$, $${q}x ${q > p ? '>' : '<'} ${p}x$, so they differ: for $x = 1$, $\\frac{${p + 1}}{${q + 1}} \\ne ${f}$. The condition $x \\ge 0$ allows both cases.`;
      }
    } else if (mode === 'factor') {
      changed = `\\frac{${p} + ${p}x}{${q} + ${q}x}`;
      info = `$${x} > 0$`;
      rel = 'C';
      trapRel = p < q ? 'A' : 'B';
      trapId = 'num-hidden-factor';
      why = `Factor: $${changed} = \\frac{${p}(1 + x)}{${q}(1 + x)} = ${f}$, since $1 + x \\ne 0$. The numerator and the denominator were multiplied by the same number $1 + x$, not increased by the same amount.`;
    } else {
      changed = `\\frac{${p} - ${x}}{${q} - ${x}}`;
      info = `$0 < ${x} < ${p}$`;
      rel = 'B';
      trapRel = 'C';
      why = `Both denominators are positive ($x < ${p} < ${q}$), so cross-multiply: compare $(${p} - x) \\cdot ${q} = ${p * q} - ${q}x$ with $${p}(${q} - x) = ${p * q} - ${p}x$. Since $x > 0$ and $${q} > ${p}$, $-${q}x < -${p}x$: $${changed}$ is smaller than $${f}$. Subtracting the same positive number from both parts moves a fraction less than 1 away from 1.`;
    }
    const answer = swap ? swapQC(rel) : rel;
    const trapAns = trapRel && trapRel !== rel ? (swap ? swapQC(trapRel) : trapRel) : null;
    const traps: QCQuestion['traps'] = trapAns ? { [trapAns]: trapId } : undefined;
    const A = swap ? `$${f}$` : `$${changed}$`;
    const B = swap ? `$${changed}$` : `$${f}$`;
    return {
      params: { mode, p, q, k, swap },
      q: {
        format: 'qc',
        ...(info ? { info } : {}),
        quantityA: A,
        quantityB: B,
        answer,
        traps,
        explanation: `${why}

${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, p, q: den, k, swap }) {
    // Sample the allowed values of x exactly and let qcFromSamples decide.
    const xs: Frac[] = [];
    if (mode === 'numeric') xs.push(F(k));
    else if (mode === 'sub') for (let i = 1; i < 40; i++) xs.push(F(p * i, 40));
    else {
      for (const v of [F(1, 1000), F(1, 7), F(1, 2), F(1), F(3), F(10), F(1000)]) xs.push(v);
      if (mode === 'add-nonneg') xs.push(F(0));
    }
    const value = (x: Frac): Frac => {
      if (mode === 'numeric' || mode === 'add-pos' || mode === 'add-nonneg') return x.add(p).div(x.add(den));
      if (mode === 'factor') return x.mul(p).add(p).div(x.mul(den).add(den));
      return F(p).sub(x).div(F(den).sub(x));
    };
    const orig = F(p, den);
    const expected = qcFromSamples(xs.map((x) => (swap ? [orig, value(x)] : [value(x), orig]) as [Frac, Frac]));
    return expectQC(q, expected);
  },
};

/* ================================================================== 3. Compare fractions (MCS) */

interface CmpParams {
  mode: 'greatest' | 'least' | 'between';
  fracs: [number, number][];
  lo?: [number, number];
  hi?: [number, number];
}

function reducedFracs(maxQ: number, lo: number, hi: number): [number, number][] {
  const out: [number, number][] = [];
  for (let q = 3; q <= maxQ; q++) for (let p = 1; p < 2 * q; p++) if (gcd(p, q) === 1 && p / q > lo && p / q < hi) out.push([p, q]);
  return out;
}

const approx = (p: number, q: number) => {
  const f = F(p, q);
  if (f.isTerminating() && (f.toDecimalString().split('.')[1] ?? '').length <= 3) return `= ${f.toDecimalString()}`;
  return `\\approx ${(p / q).toFixed(3)}`;
};

const compareFractions: Template<CmpParams> = {
  id: 'arith.fractions.compare-mcs',
  skill: 'arith.fractions',
  format: 'mcs',
  style: 'greatest, least, or between two fractions',
  generate(rng, d) {
    const mode: CmpParams['mode'] = d === 1 ? rng.pick(['greatest', 'least'] as const) : rng.chance(d === 2 ? 0.45 : 0.6) ? 'between' : rng.pick(['greatest', 'least'] as const);
    const maxQ = d === 1 ? 12 : d === 2 ? 16 : 20;
    const width = d === 1 ? 0.22 : d === 2 ? 0.12 : 0.07;
    if (mode !== 'between') {
      for (;;) {
        const center = rng.int(30, 85) / 100;
        const pool = reducedFracs(maxQ, center - width / 2, center + width / 2).filter(([p, q]) => p < q);
        if (pool.length < 5) continue;
        const fracs = rng.sample(pool, 5);
        const vals = fracs.map(([p, q]) => p / q);
        const target = extremeIndex(vals, mode === 'greatest' ? 'max' : 'min');
        if (target < 0) continue;
        // Trap: extreme numerator (largest for "greatest", smallest for "least") must not be the answer.
        const nums = fracs.map(([p]) => p);
        const trapIdx = extremeIndex(nums, mode === 'greatest' ? 'max' : 'min');
        if (trapIdx === target || (trapIdx < 0 && d > 1)) continue;
        const order = fracs.map((f, i) => ({ f, i })).sort((a, b) => a.f[1] - b.f[1] || a.f[0] - b.f[0]);
        const sorted = order.map((o) => o.f);
        const answer = order.findIndex((o) => o.i === target);
        const trapPos = order.findIndex((o) => o.i === trapIdx);
        const choices = sorted.map(([p, q], i) => ({ text: `$${F(p, q).toTex()}$`, ...(i === trapPos ? { trap: 'num-compare-parts' } : {}) }));
        const [ap, aq] = sorted[answer];
        const lines = sorted.map(([p, q]) => `$${F(p, q).toTex()} ${approx(p, q)}$`).join(', ');
        const [tp, tq] = trapPos >= 0 ? sorted[trapPos] : [0, 0];
        return {
          params: { mode, fracs: sorted },
          q: {
            format: 'mcs',
            stem: `Which of the following fractions is ${mode}?`,
            choices,
            answer,
            explanation: `Convert each fraction to a decimal (or cross-multiply in pairs): ${lines}.

The ${mode} is $${F(ap, aq).toTex()}$.${
              trapPos >= 0
                ? `\n\n$${F(tp, tq).toTex()}$ has the ${mode === 'greatest' ? 'largest' : 'smallest'} numerator, but its denominator is ${mode === 'greatest' ? 'large' : 'small'} too: compare values, not numerators.`
                : ''
            }`,
          },
        };
      }
    }
    // between
    for (;;) {
      const pool = reducedFracs(d === 2 ? 12 : 15, 0.2, 0.9).filter(([p, q]) => p < q);
      const [a, b] = rng.sample(pool, 2);
      const [lo, hi] = a[0] / a[1] < b[0] / b[1] ? [a, b] : [b, a];
      const gap = hi[0] / hi[1] - lo[0] / lo[1];
      if (gap < 0.02 || gap > (d === 2 ? 0.12 : 0.07)) continue;
      const near = reducedFracs(maxQ, lo[0] / lo[1] - 2.5 * gap, hi[0] / hi[1] + 2.5 * gap).filter(
        ([p, q]) => !(p === lo[0] && q === lo[1]) && !(p === hi[0] && q === hi[1]),
      );
      const inside = near.filter(([p, q]) => F(p, q).gt(F(...lo)) && F(p, q).lt(F(...hi)));
      const outside = near.filter(([p, q]) => F(p, q).lt(F(...lo)) || F(p, q).gt(F(...hi)));
      if (!inside.length || outside.length < 4) continue;
      const good = rng.pick(inside);
      // A wrong choice whose numerator and denominator each lie between the given ones (parts trap).
      const between = (x: number, u: number, v: number) => x > Math.min(u, v) && x < Math.max(u, v);
      const partsTrap = outside.filter(([p, q]) => between(p, lo[0], hi[0]) || between(q, lo[1], hi[1]));
      // Uniform rank for the answer: `rank` wrong choices below the interval, the rest above it.
      const rank = rng.int(0, 4);
      const lower = rng.shuffle(outside.filter(([p, q]) => F(p, q).lt(F(...lo))));
      const upper = rng.shuffle(outside.filter(([p, q]) => F(p, q).gt(F(...hi))));
      if (lower.length < rank || upper.length < 4 - rank) continue;
      const trapPick = partsTrap.filter(([p, q]) => (F(p, q).lt(F(...lo)) ? rank > 0 : rank < 4));
      const wrong: [number, number][] = trapPick.length ? [rng.pick(trapPick)] : [];
      const firstLow = wrong.length && F(...wrong[0]).lt(F(...lo)) ? 1 : 0;
      const firstHigh = wrong.length - firstLow;
      const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
      wrong.push(...lower.filter((f) => !wrong.some((w) => same(w, f))).slice(0, rank - firstLow));
      wrong.push(...upper.filter((f) => !wrong.some((w) => same(w, f))).slice(0, 4 - rank - firstHigh));
      if (wrong.length < 4) continue;
      const all = [{ f: good, ok: true, trap: false }, ...wrong.map((f, i) => ({ f, ok: false, trap: i === 0 && trapPick.length > 0 }))].sort(
        (x, y) => x.f[0] / x.f[1] - y.f[0] / y.f[1],
      );
      const choices = all.map((c) => ({ text: `$${F(...c.f).toTex()}$`, ...(c.trap ? { trap: 'num-compare-parts' } : {}) }));
      const answer = all.findIndex((c) => c.ok);
      const L = F(...lo).toTex();
      const H = F(...hi).toTex();
      return {
        params: { mode, fracs: all.map((c) => c.f), lo, hi },
        q: {
          format: 'mcs',
          stem: `Which of the following numbers is between $${L}$ and $${H}$?`,
          choices,
          answer,
          explanation: `Write everything as decimals: $${L} ${approx(...lo)}$ and $${H} ${approx(...hi)}$. The choices are ${all
            .map((c) => `$${F(...c.f).toTex()} ${approx(...c.f)}$`)
            .join(', ')}.

Only $${F(...good).toTex()}$ lies strictly between them.${
            trapPick.length
              ? ` Having a numerator or a denominator between those of the two fractions proves nothing: compare the values.`
              : ''
          }`,
        },
      };
    }
  },
  check(q, { mode, fracs, lo, hi }) {
    const vals = fracs.map(([p, q2]) => p / q2);
    if (mode === 'greatest') return expectMCS(q, extremeIndex(vals, 'max'));
    if (mode === 'least') return expectMCS(q, extremeIndex(vals, 'min'));
    const a = lo![0] / lo![1];
    const b = hi![0] / hi![1];
    const hits = vals.flatMap((v, i) => (v > a + 1e-12 && v < b - 1e-12 ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 4. Fraction of the remainder (NE) */

interface RemParams {
  ctx: number;
  fracs: [number, number][];
  ask: 'left' | 'second' | 'total';
  amount: number;
}

interface RemContext {
  whole: string;
  steps: string[]; // phrases with {f}, first is a fraction of the whole, the rest of the remainder
  leftQ: string;
  secondQ: string;
  unit: 'usd' | string; // 'usd' or a noun (plural)
  totalQ: string;
  leftFact: (amt: string) => string;
}

const REM_CONTEXTS: RemContext[] = [
  {
    whole: 'monthly income',
    steps: ['Dana spent {f} of her monthly income on rent', '{f} of the remaining amount on food', '{f} of what was left after that on transportation'],
    leftQ: 'What fraction of her monthly income did she have left after these expenses?',
    secondQ: 'What fraction of her monthly income did she spend on food?',
    unit: 'usd',
    totalQ: 'What was her monthly income, in dollars?',
    leftFact: (a) => `After these expenses she had ${a} left.`,
  },
  {
    whole: 'tank',
    steps: ['A tank was full of water. On Monday, {f} of the water was used', 'on Tuesday, {f} of the water that remained was used', 'on Wednesday, {f} of what was still left was used'],
    leftQ: 'What fraction of the original amount of water was still in the tank after that?',
    secondQ: 'What fraction of the original amount of water was used on Tuesday?',
    unit: 'liters',
    totalQ: 'How many liters of water did the full tank hold?',
    leftFact: (a) => `At the end, ${a} liters of water were left in the tank.`,
  },
  {
    whole: 'book',
    steps: ['Lee read {f} of the pages of a book on Saturday', '{f} of the remaining pages on Sunday', '{f} of the pages still unread on Monday'],
    leftQ: 'What fraction of the pages of the book did Lee still have to read?',
    secondQ: 'What fraction of all the pages of the book did Lee read on Sunday?',
    unit: 'pages',
    totalQ: 'How many pages does the book have?',
    leftFact: (a) => `Lee still had ${a} pages left to read.`,
  },
  {
    whole: 'budget',
    steps: ['A club spent {f} of its annual budget on travel', '{f} of the rest on equipment', '{f} of what remained after that on printing'],
    leftQ: 'What fraction of the annual budget was not spent on these items?',
    secondQ: 'What fraction of the annual budget was spent on equipment?',
    unit: 'usd',
    totalQ: 'What was the annual budget, in dollars?',
    leftFact: (a) => `After these purchases, ${a} of the budget was left.`,
  },
];

const REM_FRACS: [number, number][] = [
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [2, 5],
  [3, 8],
  [2, 3],
  [3, 4],
  [1, 6],
  [3, 10],
  [3, 5],
  [1, 8],
];

function joinSteps(parts: string[]): string {
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}.`;
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
}

const remainingFraction: Template<RemParams> = {
  id: 'arith.fractions.remaining-fraction',
  skill: 'arith.fractions',
  format: 'ne',
  style: 'fraction of the remainder, step by step',
  generate(rng, d) {
    const ctxIdx = rng.int(0, REM_CONTEXTS.length - 1);
    const ctx = REM_CONTEXTS[ctxIdx];
    const nSteps = d === 1 ? 2 : d === 2 ? rng.pick([2, 3]) : 2;
    let fracs: [number, number][];
    do fracs = rng.sample(REM_FRACS, nSteps);
    while (fracs.reduce((s, [a, b]) => s + a / b, 0) >= 0.95 && d === 1);
    const ask: RemParams['ask'] = d === 3 ? 'total' : d === 2 && nSteps === 2 && rng.chance(0.4) ? 'second' : 'left';
    const keep = fracs.map(([a, b]) => F(b - a, b));
    const left = keep.reduce((s, x) => s.mul(x), F(1));
    let amount = 0;
    let answer: Frac;
    let trapVal: Frac | null = null;
    const sumFr = fracs.reduce((s, [a, b]) => s.add(F(a, b)), F(0));
    if (ask === 'left') {
      answer = left;
      if (F(1).sub(sumFr).sign() > 0) trapVal = F(1).sub(sumFr);
    } else if (ask === 'second') {
      answer = F(...fracs[1]).mul(keep[0]);
      trapVal = F(...fracs[1]);
    } else {
      // Choose a realistic total that makes the remaining amount a whole number.
      const [lo, hi, step] = ctx.unit === 'usd' ? [1200, 6000, 100] : ctx.unit === 'pages' ? [120, 600, 1] : [60, 600, 10];
      const totals: number[] = [];
      for (let t = left.d; t <= hi; t += left.d) if (t >= lo && t % step === 0) totals.push(t);
      if (!totals.length) for (let t = left.d; t <= hi * 2; t += left.d) if (t >= lo) totals.push(t);
      const total = rng.pick(totals);
      amount = left.mul(total).toNumber();
      answer = F(total);
      const naive = F(1).sub(sumFr);
      if (naive.sign() > 0) {
        const t = F(amount).div(naive);
        if (t.isTerminating()) trapVal = t;
      }
    }
    const phrases = fracs.map(([a, b], i) => ctx.steps[i].replace('{f}', `$${F(a, b).toTex()}$`));
    const fmtAmt = (x: number) => (ctx.unit === 'usd' ? usd(x) : plain(x));
    const stem = `${joinSteps(phrases)}${ask === 'total' ? ` ${ctx.leftFact(fmtAmt(amount))}` : ''} ${ask === 'left' ? ctx.leftQ : ask === 'second' ? ctx.secondQ : ctx.totalQ}`;
    const chain = keep.map((x) => x.toTex()).join(' \\cdot ');
    const keepText = fracs
      .map(([a, b], i) => `${i === 0 ? 'After the first step' : 'after the next one'}, $1 - ${F(a, b).toTex()} = ${keep[i].toTex()}$ of ${i === 0 ? 'the whole' : 'that amount'} is left`)
      .join('; ');
    let explanation: string;
    if (ask === 'left') {
      explanation = `Each fraction after the first is a fraction of what remains, so multiply the parts that are left. ${keepText}.

Fraction left: $${chain} = ${left.toTex()}$.${
        trapVal ? `\n\nSubtracting every fraction from the whole, $1 - ${fracs.map(([a, b]) => F(a, b).toTex()).join(' - ')} = ${trapVal.toTex()}$, wrongly treats each fraction as a fraction of the whole.` : ''
      }`;
    } else if (ask === 'second') {
      explanation = `After the first step, $1 - ${F(...fracs[0]).toTex()} = ${keep[0].toTex()}$ of the whole remains. The second step takes $${F(...fracs[1]).toTex()}$ of that: $${F(...fracs[1]).toTex()} \\cdot ${keep[0].toTex()} = ${answer.toTex()}$ of the whole.

The answer is not $${F(...fracs[1]).toTex()}$: that is a fraction of the remainder, not of the whole.`;
    } else {
      explanation = `The fraction left is $${chain} = ${left.toTex()}$ of the whole. So $${left.toTex()}$ of the total is ${fmtAmt(amount)}, and the total is $${num(amount)} \\div ${left.toTex()} = ${num(answer.toNumber())}$.

Using $1 - ${fracs.map(([a, b]) => F(a, b).toTex()).join(' - ')}$ as the fraction left treats the second fraction as a fraction of the whole instead of the remainder.`;
    }
    const fractionBoxes = ask !== 'total';
    return {
      params: { ctx: ctxIdx, fracs, ask, amount },
      q: {
        format: 'ne',
        stem,
        answer,
        ...(fractionBoxes ? { fractionBoxes: true } : {}),
        ...(ask === 'total' ? (ctx.unit === 'usd' ? { prefix: '\\$' } : { suffix: ctx.unit }) : {}),
        traps: trapVal && !trapVal.eq(answer) ? [{ value: trapVal, trap: 'num-fraction-of-whole' }] : [],
        explanation,
      },
    };
  },
  check(q, { fracs, ask, amount }) {
    // Simulation with a concrete whole: remove each fraction of what is currently left.
    const run = (total: number) => {
      let rest = total;
      const used: number[] = [];
      for (const [a, b] of fracs) {
        const u = (rest * a) / b;
        used.push(u);
        rest -= u;
      }
      return { rest, used };
    };
    if (ask === 'total') {
      if (q.format !== 'ne') return 'wrong format';
      const { rest } = run(q.answer.toNumber());
      return Math.abs(rest - amount) < 1e-6 ? null : `total ${q.answer} leaves ${rest}, not ${amount}`;
    }
    const W = 7_207_200; // divisible by every denominator used
    const { rest, used } = run(W);
    return expectNE(q, ask === 'left' ? rest / W : used[1] / W, 1e-9);
  },
};

export const fractionTemplates = [equivalentOps, sameChangeQC, compareFractions, remainingFraction];
