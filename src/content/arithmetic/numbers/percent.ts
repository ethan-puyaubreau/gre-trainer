import { flaggedChoices, qcCompare } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num, plain, usd } from '../../../engine/tex';
import type { Choice, Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import {
  close,
  dec,
  expectMCM,
  expectMCS,
  expectNE,
  expectQC,
  F,
  numChoices,
  pct,
  pickWeighted,
  qcEnd,
  qcFromFloatSamples,
  plainNum,
  spreadFillers,
  swapQC,
} from './util';

/** "20%" in plain text (no math needed for nonnegative numbers). */
const P = (x: number | Frac) => `${x instanceof Frac ? (x.isInt() ? x.n : x.toDecimalString()) : x}%`;

/* ================================================================== 1. Percent changes of unknown bases (QC) */

type RedMode = 'unknown' | 'relation' | 'given' | 'after';

interface RedParams {
  mode: RedMode;
  ctx: number;
  p: number;
  q: number;
  k: Frac;
  P1: number;
  P2: number;
}

interface RedCtx {
  x: string;
  y: string;
  /** "the lamp's original price" */
  ox: string;
  oy: string;
  /** Sentence describing the two changes. */
  changes: (p: number, q: number) => string;
  qty: (who: string) => string;
  relation: (k: Frac) => string;
  given: (a: number, b: number) => string;
  after: string;
  up: boolean;
}

const kText = (k: Frac) => (k.eq(2) ? 'twice' : k.eq(3) ? 'three times' : k.eq(F(1, 2)) ? 'half' : `${dec(k)} times`);

const RED_CTX: RedCtx[] = [
  {
    x: 'lamp',
    y: 'rug',
    ox: "the lamp's original price",
    oy: "the rug's original price",
    changes: (p, q) => `A store lowered the price of a lamp by ${P(p)} and the price of a rug by ${P(q)}.`,
    qty: (w) => `The number of dollars by which the price of the ${w} was lowered`,
    relation: (k) => `Before the change, the lamp cost ${kText(k)} as much as the rug.`,
    given: (a, b) => `Before the change, the lamp cost ${usd(a)} and the rug cost ${usd(b)}.`,
    after: 'After the change, the lamp and the rug cost the same amount.',
    up: false,
  },
  {
    x: 'jacket',
    y: 'sweater',
    ox: "the jacket's price before the sale",
    oy: "the sweater's price before the sale",
    changes: (p, q) => `During a sale, the price of a jacket was reduced by ${P(p)} and the price of a sweater was reduced by ${P(q)}.`,
    qty: (w) => `The dollar amount of the reduction in the price of the ${w}`,
    relation: (k) => `Before the sale, the jacket's price was ${kText(k)} the sweater's price.`,
    given: (a, b) => `Before the sale, the jacket cost ${usd(a)} and the sweater cost ${usd(b)}.`,
    after: 'During the sale, the jacket and the sweater had the same price.',
    up: false,
  },
  {
    x: 'Ana',
    y: 'Ben',
    ox: "Ana's salary last year",
    oy: "Ben's salary last year",
    changes: (p, q) => `This year Ana's salary increased by ${P(p)} and Ben's salary increased by ${P(q)}.`,
    qty: (w) => `The dollar amount of the increase in ${w}'s salary`,
    relation: (k) => `Last year Ana's salary was ${kText(k)} Ben's salary.`,
    given: (a, b) => `Last year Ana's salary was ${usd(a)} and Ben's salary was ${usd(b)}.`,
    after: "After the increases, Ana's salary and Ben's salary are equal.",
    up: true,
  },
  {
    x: 'Store P',
    y: 'Store Q',
    ox: "Store P's revenue in May",
    oy: "Store Q's revenue in May",
    changes: (p, q) => `From May to June, the monthly revenue of Store P rose by ${P(p)} and the monthly revenue of Store Q rose by ${P(q)}.`,
    qty: (w) => `The increase, in dollars, in the monthly revenue of ${w}`,
    relation: (k) => `In May, the revenue of Store P was ${kText(k)} the revenue of Store Q.`,
    given: (a, b) => `In May, the revenue of Store P was ${usd(a)} and the revenue of Store Q was ${usd(b)}.`,
    after: 'In June, the two stores had the same revenue.',
    up: true,
  },
];

const reductionQC: Template<RedParams> = {
  id: 'arith.percent.reduction-qc',
  skill: 'arith.percent',
  format: 'qc',
  style: 'dollar changes from percent changes of different bases',
  generate(rng, d) {
    const weights: Record<Difficulty, [RedMode, number][]> = {
      1: [
        ['given', 3.5],
        ['unknown', 3],
        ['relation', 3.5],
      ],
      2: [
        ['unknown', 3],
        ['relation', 5],
        ['after', 2],
      ],
      3: [
        ['unknown', 2.5],
        ['relation', 3.5],
        ['after', 4],
      ],
    };
    const mode = pickWeighted(rng, weights[d]);
    const ctx = rng.int(0, RED_CTX.length - 1);
    const C = RED_CTX[ctx];
    let p = 5 * rng.int(1, 8);
    let q = 5 * rng.int(1, 8);
    let k = F(1);
    let P1 = 0;
    let P2 = 0;
    const salary = C.up && ctx === 2;
    if (mode === 'relation') {
      k = rng.pick([F(2), F(3), F(1, 2)]);
      if (rng.chance(0.3)) {
        // exactly equal dollar changes
        const base = k.lt(1) ? 5 * rng.int(2, 8) : 5 * rng.int(1, 4);
        p = base;
        q = k.mul(base).toNumber();
        if (!Number.isInteger(q) || q > 60) q = 2 * p;
      }
    } else if (mode === 'given') {
      const unit = salary ? 1000 : C.up ? 1000 : 10;
      P1 = unit * rng.int(salary ? 30 : 4, salary ? 90 : 30);
      P2 = unit * rng.int(salary ? 30 : 4, salary ? 90 : 30);
      if (rng.chance(0.3)) {
        // make the dollar changes equal: p * P1 = q * P2
        const g = P1 / unit;
        const h = P2 / unit;
        for (const pp of [5, 10, 15, 20, 25, 30, 40])
          for (const qq of [5, 10, 15, 20, 25, 30, 40])
            if (pp !== qq && pp * g === qq * h) {
              p = pp;
              q = qq;
            }
      }
    }
    if ((mode === 'unknown' || mode === 'after') && p === q && rng.chance(mode === 'after' ? 0.8 : 0.6)) q = p + 5;
    // Exact dollar changes are (p/100) X and (q/100) Y.
    let rel: QCChoice;
    if (mode === 'unknown') rel = 'D';
    else if (mode === 'relation') rel = qcCompare(k.mul(p), q);
    else if (mode === 'given') rel = qcCompare(p * P1, q * P2);
    else rel = qcCompare(p, q);
    const naive = qcCompare(p, q);
    const traps: QCQuestion['traps'] = naive !== rel && mode !== 'after' ? { [naive]: 'num-percent-unknown-base' } : undefined;
    const info = `${C.changes(p, q)}${mode === 'relation' ? ` ${C.relation(k)}` : mode === 'given' ? ` ${C.given(P1, P2)}` : mode === 'after' ? ` ${C.after}` : ''}`;
    let why: string;
    const X = C.x;
    const Y = C.y;
    if (mode === 'unknown') {
      const [a1, b1] = p > q ? [100, 1000] : [1000, 100];
      why = `A ${P(p)} change of an amount $X$ is $${dec(F(p, 100))}X$ dollars, so the dollar changes depend on the original amounts, which are not given. If both original amounts were ${usd(100)}, the changes would be ${usd(p)} and ${usd(q)}. If ${C.ox} were ${usd(a1)} and ${C.oy} were ${usd(b1)}, they would be ${usd((p * a1) / 100)} and ${usd((q * b1) / 100)}.${
        p !== q ? ` The larger percent does not guarantee the larger dollar change.` : ''
      }`;
    } else if (mode === 'relation') {
      why = `Let $y$ be ${C.oy}; then ${C.ox} was $${k.eq(F(1, 2)) ? '\\frac{1}{2}' : k.toTex()}y$. The changes are $${pct(p)}$ of $${k.eq(F(1, 2)) ? '\\frac{1}{2}' : k.toTex()}y$, which is $${dec(k.mul(p).div(100))}y$, and $${pct(q)}$ of $y$, which is $${dec(F(q, 100))}y$. Since $y > 0$, compare $${dec(k.mul(p).div(100))}$ with $${dec(F(q, 100))}$.`;
    } else if (mode === 'given') {
      why = `Quantity A: $${pct(p)}$ of ${usd(P1)} is ${usd((p * P1) / 100)}. Quantity B: $${pct(q)}$ of ${usd(P2)} is ${usd((q * P2) / 100)}.`;
    } else {
      const f = (r: number) => (C.up ? F(r, 100 + r) : F(r, 100 - r));
      why = `Let $c$ be the common amount after the changes. Then ${C.ox} was $\\frac{c}{${dec(F(C.up ? 100 + p : 100 - p, 100))}}$, so that change was $\\frac{${dec(F(p, 100))}c}{${dec(
        F(C.up ? 100 + p : 100 - p, 100),
      )}} = ${f(p).toTex()}c$. For ${C.oy.split("'s")[0]}, the change was $\\frac{${dec(F(q, 100))}c}{${dec(F(C.up ? 100 + q : 100 - q, 100))}} = ${f(q).toTex()}c$. ${
        p === q ? 'These are equal.' : `Since $${f(p).toTex()} ${f(p).gt(f(q)) ? '>' : '<'} ${f(q).toTex()}$, the ${p > q ? 'first' : 'second'} change is larger.`
      } Here the information IS enough: equal final amounts tie the two bases together.`;
    }
    return {
      params: { mode, ctx, p, q, k, P1, P2 },
      q: {
        format: 'qc',
        info,
        quantityA: C.qty(X),
        quantityB: C.qty(Y),
        answer: rel,
        traps,
        explanation: `${why}

${qcEnd(rel)}`,
      },
    };
  },
  check(q, { mode, ctx, p, q: qq, k, P1, P2 }) {
    const up = RED_CTX[ctx].up;
    // Sample many possible original amounts consistent with the information.
    const bases = [1, 7, 50, 99, 100, 250, 1000, 3333, 40000];
    const samples: [number, number][] = [];
    if (mode === 'given') samples.push([(p * P1) / 100, (qq * P2) / 100]);
    else
      for (const y of bases) {
        if (mode === 'unknown') for (const x of bases) samples.push([(p * x) / 100, (qq * y) / 100]);
        else if (mode === 'relation') samples.push([(p * k.toNumber() * y) / 100, (qq * y) / 100]);
        else {
          // after: x * (1 +- p) = y * (1 +- q)
          const x = (y * (up ? 1 + qq / 100 : 1 - qq / 100)) / (up ? 1 + p / 100 : 1 - p / 100);
          samples.push([(p * x) / 100, (qq * y) / 100]);
        }
      }
    return expectQC(q, qcFromFloatSamples(samples, 1e-9));
  },
};

/* ================================================================== 2. Percent of, swapped percents, greater vs less (QC) */

type POMode = 'estimate' | 'swap' | 'greater-less' | 'chain';

interface POParams {
  mode: POMode;
  p: number;
  n: number;
  m: Frac;
  dir: 'greater' | 'less';
  swap: boolean;
}

const percentOfQC: Template<POParams> = {
  id: 'arith.percent.percent-of-qc',
  skill: 'arith.percent',
  format: 'qc',
  style: 'percent of a number; percent greater vs percent less',
  generate(rng, d) {
    const mode = pickWeighted<POMode>(
      rng,
      d === 1
        ? [
            ['estimate', 5],
            ['swap', 2],
            ['greater-less', 1],
          ]
        : d === 2
          ? [
              ['estimate', 3],
              ['swap', 1.5],
              ['greater-less', 3],
              ['chain', 1],
            ]
          : [
              ['estimate', 1.5],
              ['swap', 1],
              ['greater-less', 3],
              ['chain', 3],
            ],
    );
    const swap = rng.chance(0.4);
    if (mode === 'estimate') {
      const p = rng.pick([12, 15, 18, 24, 35, 45, 48, 52, 55, 65, 76, 85]);
      const n = rng.pick([120, 160, 240, 250, 360, 480, 520, 640, 750, 1200, 1600]);
      const V = F(p * n, 100);
      const kase = pickWeighted(rng, [
        ['C', 2.5],
        ['bench', 3],
        ['near', 4],
      ] as ['C' | 'bench' | 'near', number][]);
      let m: Frac;
      if (kase === 'C') m = V;
      else if (kase === 'bench') {
        const bench = p >= 40 && p <= 60 ? F(n, 2) : p < 30 ? F(n, 4) : F(3 * n, 4);
        m = bench.eq(V) ? V.add(1) : bench;
      } else {
        const step = V.gt(100) ? rng.int(1, 4) : 1;
        m = F(Math.round(V.toNumber())).add(rng.chance(0.5) ? step : -step);
        if (m.eq(V)) m = m.add(1);
      }
      const rel = qcCompare(V, m);
      const answer = swap ? swapQC(rel) : rel;
      const qb = `$${dec(m)}$`;
      const bench = kase === 'bench' ? ` (Quick check: $${pct(p)}$ is ${p > 50 || (p > 25 && p < 30) || p > 75 ? 'more' : 'less'} than $${pct(p >= 40 && p <= 60 ? 50 : p < 30 ? 25 : 75)}$, and $${pct(p >= 40 && p <= 60 ? 50 : p < 30 ? 25 : 75)}$ of ${plain(n)} is ${dec(m)}.)` : '';
      return {
        params: { mode, p, n, m, dir: 'greater', swap },
        q: {
          format: 'qc',
          quantityA: swap ? qb : `$${pct(p)}$ of ${plain(n)}`,
          quantityB: swap ? `$${pct(p)}$ of ${plain(n)}` : qb,
          answer,
          explanation: `$${pct(p)}$ of ${plain(n)} is $${dec(F(p, 100))} \\times ${num(n)} = ${dec(V)}$.${bench}

Compare $${dec(V)}$ with $${dec(m)}$. ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'swap') {
      const [p, n] = rng.sample([4, 5, 8, 12, 15, 16, 20, 25, 30, 40, 45, 50, 60, 64, 75, 80], 2);
      const qa = `$${pct(p)}$ of $${n}$`;
      const qb = `$${pct(n)}$ of $${p}$`;
      return {
        params: { mode, p, n, m: F(0), dir: 'greater', swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer: 'C',
          explanation: `$${pct(p)}$ of $${n}$ is $\\frac{${p}}{100} \\cdot ${n} = \\frac{${p} \\cdot ${n}}{100}$, and $${pct(n)}$ of $${p}$ is $\\frac{${n}}{100} \\cdot ${p} = \\frac{${n} \\cdot ${p}}{100}$: the same product. Both equal $${dec(F(p * n, 100))}$.

Swapping the percent and the number never changes the result. ${qcEnd('C')}`,
        },
      };
    }
    if (mode === 'greater-less') {
      const dir = rng.pick(['greater', 'less'] as const);
      const p = rng.pick([10, 20, 25, 40, 50, 60, 75]);
      // x is p% greater than y  ->  y is p/(100+p) less than x;  x is p% less than y -> y is p/(100-p) greater than x
      const k = dir === 'greater' ? F(100 * p, 100 + p) : F(100 * p, 100 - p);
      const rel: QCChoice = dir === 'greater' ? 'B' : 'A';
      const answer = swap ? swapQC(rel) : rel;
      const other = dir === 'greater' ? 'less' : 'greater';
      const qa = `The percent by which $y$ is ${other} than $x$`;
      const qb = `$${pct(p)}$`;
      const ratio = dir === 'greater' ? F(100 + p, 100) : F(100 - p, 100);
      return {
        params: { mode, p, n: 0, m: k, dir, swap },
        q: {
          format: 'qc',
          info: `$x$ and $y$ are positive numbers, and $x$ is $${pct(p)}$ ${dir} than $y$.`,
          quantityA: swap ? qb : qa,
          quantityB: swap ? qa : qb,
          answer,
          traps: { C: 'num-percent-greater-less' },
          explanation: `Take $y = 100$. Then $x = ${dec(ratio.mul(100))}$. The difference is ${p}, and "$y$ is ___ percent ${other} than $x$" compares that difference with $x$: $\\frac{${p}}{${dec(ratio.mul(100))}} = ${k.isTerminating() ? dec(k.div(100)) : `${(k.toNumber() / 100).toFixed(4)}\\ldots`}$, that is, ${k.isTerminating() ? `$${pct(k)}$` : `about $${k.toNumber().toFixed(1)}\\%$`}.

${dir === 'greater' ? 'The base for "less than $x$" is the larger number $x$, so the percent is smaller' : 'The base for "greater than $x$" is the smaller number $x$, so the percent is larger'} than $${pct(p)}$. ${qcEnd(answer)}`,
        },
      };
    }
    // chain: x is p% of y, y is n% of z; compare x with r% of z
    const p = rng.pick([20, 25, 40, 50, 60, 75, 80, 120, 150]);
    const n = rng.pick([20, 30, 40, 50, 60, 80, 200]);
    const r = F(p * n, 100);
    const kase = rng.pick(['C', 'C', 'add', 'near'] as const);
    const m = kase === 'C' ? r : kase === 'add' ? F(p + n > 100 ? p + n - 100 : p + n) : r.add(rng.chance(0.5) ? 2 : -2);
    const finalM = m.eq(r) && kase !== 'C' ? r.add(5) : m;
    const rel = qcCompare(r, finalM);
    const answer = swap ? swapQC(rel) : rel;
    const qa = '$x$';
    const qb = `$${pct(finalM)}$ of $z$`;
    return {
      params: { mode, p, n, m: finalM, dir: 'greater', swap },
      q: {
        format: 'qc',
        info: `$z > 0$, $x$ is $${pct(p)}$ of $y$, and $y$ is $${pct(n)}$ of $z$.`,
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        explanation: `$x = ${dec(F(p, 100))}y$ and $y = ${dec(F(n, 100))}z$, so $x = ${dec(F(p, 100))} \\times ${dec(F(n, 100))}z = ${dec(r.div(100))}z$, which is $${pct(r)}$ of $z$. Percents of percents multiply; they do not add.

Since $z > 0$, compare $${pct(r)}$ with $${pct(finalM)}$. ${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, p, n, m, dir, swap }) {
    let samples: [number, number][];
    if (mode === 'estimate') samples = [[(p / 100) * n, m.toNumber()]];
    else if (mode === 'swap') samples = [[(p / 100) * n, (n / 100) * p]];
    else if (mode === 'greater-less')
      samples = [3, 10, 77, 1000].map((y) => {
        const x = dir === 'greater' ? y * (1 + p / 100) : y * (1 - p / 100);
        const k = dir === 'greater' ? ((x - y) / x) * 100 : ((y - x) / x) * 100;
        return [k, p] as [number, number];
      });
    else
      samples = [1, 13, 500].map((z) => {
        const y = (n / 100) * z;
        const x = (p / 100) * y;
        return [x, (m.toNumber() / 100) * z] as [number, number];
      });
    if (swap) samples = samples.map(([a, b]) => [b, a]);
    return expectQC(q, qcFromFloatSamples(samples, 1e-9));
  },
};

/* ================================================================== 3. Total in terms of s (MCS) */

type ExMode = 'tax' | 'discount' | 'tip' | 'commission' | 'original';

interface LinChoice {
  a: Frac;
  b: Frac;
  text: string;
  trap?: string;
}

interface ExParams {
  mode: ExMode;
  p: number;
  base: number;
  lin: { a: Frac; b: Frac }[];
}

const expressionMCS: Template<ExParams> = {
  id: 'arith.percent.expression-mcs',
  skill: 'arith.percent',
  format: 'mcs',
  style: 'percent increase or decrease written in terms of s',
  generate(rng, d) {
    const modes: ExMode[] = d === 1 ? ['tax', 'discount', 'tip'] : d === 2 ? ['tax', 'discount', 'tip', 'commission'] : ['commission', 'original', 'discount', 'tax'];
    const mode = rng.pick(modes);
    const p = mode === 'original' ? rng.pick([20, 50, 60, 75, 80]) : mode === 'tax' ? rng.pick([4, 5, 6, 7, 9]) : mode === 'tip' ? rng.pick([15, 18, 20]) : mode === 'commission' ? rng.pick([3, 4, 5, 6, 8]) : rng.pick([10, 15, 20, 25, 30, 35]);
    const t = F(p, 100);
    const base = mode === 'commission' ? rng.pick([300, 400, 500, 600, 750]) : 0;
    const coef = (a: Frac) => (a.eq(1) ? 's' : `${dec(a)}s`);
    const L = (a: Frac, b: Frac, trap?: string, text?: string): LinChoice => ({
      a,
      b,
      text: text ?? (b.sign() === 0 ? `$${coef(a)}$` : a.eq(1) ? `$s ${b.sign() > 0 ? '+' : '-'} ${dec(b.abs())}$` : `$${coef(a)} + ${dec(b)}$`),
      ...(trap ? { trap } : {}),
    });
    let correct: LinChoice;
    let wrong: LinChoice[];
    let stem: string;
    let expl: string;
    if (mode === 'tax' || mode === 'tip') {
      correct = L(F(1).add(t), F(0));
      wrong = [L(t, F(0), 'num-change-only'), L(F(1), t, 'num-percent-as-number'), L(F(1), F(p), 'num-percent-as-number'), L(F(p), F(0), 'num-decimal-shift'), L(F(1).add(t.mul(10)), F(0), 'num-decimal-shift')];
      stem =
        mode === 'tax'
          ? `Which of the following represents the total amount, in dollars, that a customer pays for an item with a price of $s$ dollars when a ${P(p)} sales tax is added to the price?`
          : `A diner adds a ${P(p)} tip to a restaurant bill of $s$ dollars. Which of the following represents the total amount, in dollars, that the diner pays?`;
      expl = `The ${mode === 'tax' ? 'tax' : 'tip'} is ${P(p)} of $s$, that is, $${dec(t)}s$. The total is the price plus the ${mode === 'tax' ? 'tax' : 'tip'}: $s + ${dec(t)}s = ${dec(F(1).add(t))}s$.

$${dec(t)}s$ is only the ${mode === 'tax' ? 'tax' : 'tip'}, and $s + ${dec(t)}$ adds a fixed amount instead of a percent of $s$.`;
    } else if (mode === 'discount') {
      correct = L(F(1).sub(t), F(0));
      wrong = [L(t, F(0), 'num-change-only'), L(F(1), t.neg(), 'num-percent-as-number'), L(F(1).add(t), F(0)), L(F(1), F(-p), 'num-percent-as-number'), L(F(1).sub(t.div(10)), F(0), 'num-decimal-shift')];
      stem = `The regular price of a coat is $s$ dollars. Which of the following represents the price, in dollars, of the coat after a ${P(p)} discount?`;
      expl = `The discount is $${dec(t)}s$, so the new price is $s - ${dec(t)}s = ${dec(F(1).sub(t))}s$.

$${dec(t)}s$ is the amount saved, not the new price.`;
    } else if (mode === 'commission') {
      correct = L(t, F(base), undefined, `$${base} + ${dec(t)}s$`);
      wrong = [
        L(F(p), F(base), 'num-decimal-shift', `$${base} + ${p}s$`),
        L(t, t.mul(base), 'num-percent-as-number', `$${dec(t)}(${base} + s)$`),
        L(F(1).add(t), F(base), 'num-change-only', `$${base} + ${dec(F(1).add(t))}s$`),
        L(F(1), F(base).add(t), 'num-percent-as-number', `$${dec(F(base).add(t))} + s$`),
        L(F(1), F(base + p), 'num-percent-as-number', `$${base + p} + s$`),
      ];
      stem = `A salesperson's weekly pay is ${usd(base)} plus ${P(p)} of the salesperson's total sales for the week. If the salesperson's sales for one week were $s$ dollars, which of the following represents the salesperson's pay, in dollars, for that week?`;
      expl = `The commission is ${P(p)} of $s$, that is, $${dec(t)}s$. Add the fixed ${usd(base)}: $${base} + ${dec(t)}s$.

Writing ${p}s treats ${P(p)} as ${p}, and $${dec(t)}(${base} + s)$ takes the percent of the fixed pay as well.`;
    } else {
      const k = F(100, 100 - p);
      correct = L(k, F(0));
      wrong = [
        L(F(1).add(t), F(0), 'num-reverse-percent'),
        L(F(1).sub(t), F(0), 'num-reverse-percent'),
        L(F(1), t, 'num-percent-as-number'),
        L(F(1), F(p), 'num-percent-as-number'),
        L(t, F(0), 'num-change-only'),
      ];
      stem = `After a ${P(p)} discount, the sale price of a chair is $s$ dollars. Which of the following represents the price, in dollars, of the chair before the discount?`;
      expl = `If the original price is $x$, the sale price is $${dec(F(1).sub(t))}x = s$, so $x = \\frac{s}{${dec(F(1).sub(t))}} = ${dec(k)}s$.

Adding ${P(p)} back gives $${dec(F(1).add(t))}s$, which is too small: the ${P(p)} was taken on the original price $x$, not on $s$. Check: $${dec(F(1).sub(t))} \\times ${dec(k)}s = s$.`;
    }
    // keep 4 distinct wrong choices
    const all: LinChoice[] = [correct];
    for (const w of rng.shuffle(wrong)) {
      if (all.length >= 5) break;
      if (all.some((c) => (c.a.eq(w.a) && c.b.eq(w.b)) || c.text === w.text)) continue;
      all.push(w);
    }
    // GRE-like order: forms with a constant first, then pure multiples of s by increasing coefficient.
    const ordered = [...all].sort((x, y) => (x.b.sign() !== 0 ? 0 : 1) - (y.b.sign() !== 0 ? 0 : 1) || x.a.cmp(y.a) || x.b.cmp(y.b));
    const choices: Choice[] = ordered.map((c) => ({ text: c.text, ...(c.trap ? { trap: c.trap } : {}) }));
    return {
      params: { mode, p, base, lin: ordered.map(({ a, b }) => ({ a, b })) },
      q: {
        format: 'mcs',
        stem,
        choices,
        answer: ordered.indexOf(correct),
        explanation: expl,
      },
    };
  },
  check(q, { mode, p, base, lin }) {
    // Simulate the situation for a few prices and keep the choices that always match.
    const ok = lin.map(({ a, b }) =>
      [40, 125, 980].every((s) => {
        const v = a.toNumber() * s + b.toNumber();
        if (mode === 'tax' || mode === 'tip') return close(v, s + (s * p) / 100);
        if (mode === 'discount') return close(v, s - (s * p) / 100);
        if (mode === 'commission') return close(v, base + (s * p) / 100);
        return close(v - (v * p) / 100, s); // original price: discounting it must give s
      }),
    );
    const hits = ok.flatMap((x, i) => (x ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 4. Profit percent / percent change, rounded (NE) */

type PCMode = 'profit' | 'increase' | 'decrease';

interface PCParams {
  mode: PCMode;
  c: number;
  s: number;
}

const PC_ITEMS = ['used bicycle', 'painting', 'set of tools', 'guitar', 'rug', 'lamp'];

const profitNE: Template<PCParams> = {
  id: 'arith.percent.profit-ne',
  skill: 'arith.percent',
  format: 'ne',
  style: 'profit or percent change on the right base, rounded',
  generate(rng, d) {
    const mode: PCMode = d === 1 ? rng.pick(['profit', 'increase'] as const) : rng.pick(['profit', 'increase', 'decrease'] as const);
    for (;;) {
      const c = d === 1 ? 5 * rng.int(3, 30) : rng.int(12, 480);
      const ratio = mode === 'decrease' ? rng.int(55, 95) / 100 : rng.int(105, 180) / 100;
      const s = Math.round(c * ratio);
      if (s === c || (c === 15 && s === 20)) continue;
      const change = Math.abs(s - c);
      const exact = F(100 * change, c);
      // nearest whole percent, avoiding exact halves
      const twice = exact.mul(2);
      if (twice.isInt() && !exact.isInt()) continue;
      if (d > 1 && exact.isInt()) continue;
      const ans = Math.floor(exact.toNumber() + 0.5);
      const wrongBase = Math.floor((100 * change) / s + 0.5);
      const asDecimal = F(Math.floor((change / c) * 100 + 0.5), 100);
      const item = rng.pick(PC_ITEMS);
      const traps: { value: Frac; trap: string }[] = [];
      if (wrongBase !== ans) traps.push({ value: F(wrongBase), trap: 'num-percent-wrong-base' });
      if (!asDecimal.eq(ans)) traps.push({ value: asDecimal, trap: 'num-percent-as-decimal' });
      const stem =
        mode === 'profit'
          ? `A dealer bought a ${item} for ${usd(c)} and later sold it for ${usd(s)}. The dealer's profit was what percent of the dealer's cost? Give your answer to the nearest whole percent.`
          : mode === 'increase'
            ? `The price of a ${item} increased from ${usd(c)} to ${usd(s)}. By what percent did the price increase? Give your answer to the nearest whole percent.`
            : `The price of a ${item} decreased from ${usd(c)} to ${usd(s)}. By what percent did the price decrease? Give your answer to the nearest whole percent.`;
      const word = mode === 'profit' ? 'profit' : mode === 'increase' ? 'increase' : 'decrease';
      return {
        params: { mode, c, s },
        q: {
          format: 'ne',
          stem,
          answer: F(ans),
          suffix: '%',
          traps,
          explanation: `The ${word} is ${usd(Math.max(s, c))} − ${usd(Math.min(s, c))} = ${usd(change)}. Compare it with the ${mode === 'profit' ? 'cost' : 'original price'}, ${usd(c)}: $\\frac{${change}}{${c}} \\approx ${(change / c).toFixed(4)}$, which is about $${(exact.toNumber()).toFixed(2)}\\%$. To the nearest whole percent: ${ans}.

Dividing by ${usd(s)} instead (the ${mode === 'profit' ? 'selling price' : 'new price'}) uses the wrong base${wrongBase !== ans ? ` and gives ${wrongBase}` : ''}. Enter ${ans}, not ${dec(asDecimal)}: the % sign is already after the box.`,
        },
      };
    }
  },
  check(q, { mode, c, s }) {
    const v = (mode === 'decrease' ? (c - s) / c : (s - c) / c) * 100;
    return expectNE(q, Math.round(v));
  },
};

/* ================================================================== 5. Which expressions equal p% of N (MCM) */

interface EqForm {
  kind: 'pct' | 'times';
  a: Frac;
  b: Frac;
}

interface EqParams {
  p: number;
  n: number;
  forms: EqForm[];
}

const percentEquivalent: Template<EqParams> = {
  id: 'arith.percent.equivalent-mcm',
  skill: 'arith.percent',
  format: 'mcm',
  style: 'equivalent ways to write a percent of a number',
  generate(rng, d) {
    for (;;) {
      const p = rng.pick([12, 15, 18, 24, 25, 30, 35, 40, 45, 60, 75]);
      const n = rng.pick([40, 60, 80, 120, 150, 200, 240, 250, 300, 400, 500, 600, 800]);
      const V = F(p * n, 100);
      const pF = F(p);
      const nF = F(n);
      const trueForms: EqForm[] = [{ kind: 'pct', a: nF, b: pF }];
      if (n % 2 === 0) trueForms.push({ kind: 'pct', a: pF.mul(2), b: nF.div(2) });
      if (p % 2 === 0) trueForms.push({ kind: 'pct', a: pF.div(2), b: nF.mul(2) });
      if (n % 10 === 0) trueForms.push({ kind: 'pct', a: pF.mul(10), b: nF.div(10) });
      trueForms.push({ kind: 'times', a: pF.div(100), b: nF });
      if (V.isInt() && V.toNumber() < 100) trueForms.push({ kind: 'pct', a: V, b: F(100) });
      const falseForms: (EqForm & { trap: string })[] = [
        { kind: 'pct', a: pF.mul(2), b: nF.mul(2), trap: 'num-percent-scaling' },
        { kind: 'pct', a: pF.div(2), b: nF.div(2), trap: 'num-percent-scaling' },
        { kind: 'pct', a: pF.mul(10), b: nF.mul(10), trap: 'num-percent-scaling' },
        { kind: 'times', a: pF.div(10), b: nF, trap: 'num-decimal-shift' },
        { kind: 'times', a: pF.div(1000), b: nF, trap: 'num-decimal-shift' },
        { kind: 'pct', a: pF.div(10), b: nF.mul(100), trap: 'num-decimal-shift' },
      ];
      const nChoices = d === 1 ? 4 : d === 2 ? 5 : 6;
      const nTrue = rng.int(Math.max(1, nChoices - falseForms.length), Math.min(trueForms.length, nChoices - 1));
      const tPick = rng.sample(trueForms, nTrue);
      const fPick = rng.sample(falseForms, nChoices - nTrue);
      const items = rng.shuffle([...tPick.map((f) => ({ f, ok: true })), ...fPick.map((f) => ({ f, ok: false }))]);
      const tex = (f: EqForm) => (f.kind === 'pct' ? `$${pct(f.a)}$ of $${dec(f.b)}$` : `$${dec(f.a)} \\times ${dec(f.b)}$`);
      const texts = items.map((it) => tex(it.f));
      if (new Set(texts).size < texts.length || texts.some((t) => t.length > 60)) continue;
      if (texts.some((t) => t.includes('$0.0001') || t.includes('{,}000{,}'))) continue;
      const { choices, answer } = flaggedChoices(
        items.map((it) => ({ text: tex(it.f), correct: it.ok, ...('trap' in it.f ? { trap: (it.f as { trap: string }).trap } : {}) })),
      );
      const val = (f: EqForm) => (f.kind === 'pct' ? f.a.mul(f.b).div(100) : f.a.mul(f.b));
      const lines = items.map((it) => {
        const v = val(it.f);
        return `- ${tex(it.f)} $= ${dec(v)}$ ${it.ok ? '✓' : '✗'}`;
      });
      return {
        params: { p, n, forms: items.map((it) => ({ kind: it.f.kind, a: it.f.a, b: it.f.b })) },
        q: {
          format: 'mcm',
          stem: `Which of the following are equal to $${pct(p)}$ of $${dec(nF)}$?`,
          instruction: 'Indicate all such expressions.',
          choices,
          answer,
          explanation: `$${pct(p)}$ of $${dec(nF)}$ is $${dec(F(p, 100))} \\times ${dec(nF)} = ${dec(V)}$. Since $a\\%$ of $b$ is $\\frac{ab}{100}$, you can swap the two numbers, or multiply one by any factor and divide the other by the same factor:
${lines.join('\n')}

Scaling both numbers the same way (both doubled, both halved) changes the result.`,
        },
      };
    }
  },
  check(q, { p, n, forms }) {
    const target = (p / 100) * n;
    const expected = forms.flatMap((f, i) => {
      const v = f.kind === 'pct' ? (f.a.toNumber() / 100) * f.b.toNumber() : f.a.toNumber() * f.b.toNumber();
      return close(v, target) ? [i] : [];
    });
    return expectMCM(q, expected);
  },
};

/* ================================================================== 6. Percent change of a percentage (MCS) */

interface RCParams {
  p1: Frac;
  p2: Frac;
  values: Frac[];
}

const RC_CTX = [
  { who: 'households in a town', again: 'households in the town', what: 'had solar panels', group: 'households with solar panels' },
  { who: 'employees of a company', again: "company's employees", what: 'worked from home', group: 'employees working from home' },
  { who: 'students at a college', again: "college's students", what: 'commuted by bicycle', group: 'students commuting by bicycle' },
  { who: 'customers of a bank', again: "bank's customers", what: "used the bank's mobile app", group: 'customers using the app' },
  { who: 'trees in a park', again: 'trees in the park', what: 'were oaks', group: 'oak trees' },
];

const rateChangeMCS: Template<RCParams> = {
  id: 'arith.percent.rate-change-mcs',
  skill: 'arith.percent',
  format: 'mcs',
  style: 'percent change of a percentage (not percentage points)',
  generate(rng, d) {
    const up = d === 1 ? true : rng.chance(0.6);
    const ctx = rng.pick(RC_CTX);
    let p1: Frac;
    let p2: Frac;
    for (;;) {
      p1 = F(rng.pick(d === 3 ? [4, 5, 6, 8, 12, 15, 16, 20, 24, 25, 30, 40] : [2, 3, 4, 5, 6, 8, 10, 12, 15, 20]));
      const r = up ? rng.pick(d === 1 ? [F(2), F(3), F(4)] : [F(3, 2), F(2), F(5, 2), F(3), F(4), F(5, 4)]) : rng.pick([F(1, 2), F(3, 4), F(1, 4), F(4, 5), F(3, 5), F(2, 5)]);
      p2 = p1.mul(r);
      if (p2.isInt() && p2.lt(90) && !p2.eq(p1)) break;
    }
    const change = p2.sub(p1).mul(100).div(p1);
    const correct = change.abs();
    const points = p2.sub(p1).abs();
    const ratio = p2.mul(100).div(p1);
    const newBase = p2.sub(p1).abs().mul(100).div(p2);
    const optional = [
      { value: ratio, trap: 'num-ratio-as-change' },
      { value: newBase, trap: 'num-percent-wrong-base' },
    ];
    const rcTraps = [{ value: points, trap: 'num-percentage-points' }, ...(rng.chance(0.4) ? optional : [rng.pick(optional)])];
    const steps = [F(10), F(20), F(25), F(50), F(75), F(100)];
    const { choices, answer, values } = numChoices(rng, {
      correct,
      traps: rcTraps,
      fillers: spreadFillers(
        rng,
        correct,
        rcTraps.map((t) => t.value),
        steps.map((x) => correct.sub(x)).filter((x) => x.sign() > 0),
        steps.map((x) => correct.add(x)),
      ),
      format: (v) => `$${pct(v)}$`,
    });
    const y1 = 2019 + rng.int(0, 2);
    const y2 = y1 + rng.int(2, 4);
    return {
      params: { p1, p2, values },
      q: {
        format: 'mcs',
        stem: `In ${y1}, ${P(p1)} of the ${ctx.who} ${ctx.what}. In ${y2}, ${P(p2)} of the ${ctx.again} ${ctx.what}. By what percent did the percentage of ${ctx.group} ${up ? 'increase' : 'decrease'} from ${y1} to ${y2}?`,
        choices,
        answer,
        explanation: `Percent change = $\\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100$, with the old value ${P(p1)} as the base: $\\frac{${dec(p2)} - ${dec(p1)}}{${dec(p1)}} \\times 100 = ${change.isInt() ? change.toNumber() : dec(change)}$, ${up ? 'an increase' : 'a decrease'} of $${pct(correct)}$.

The change of ${dec(points)} is in percentage points, not percent. ${up ? `And ${P(p2)} is $${pct(ratio)}$ OF ${P(p1)}, which is not the same as $${pct(correct)}$ MORE than it.` : `Dividing by the new value ${P(p2)} uses the wrong base.`}`,
      },
    };
  },
  check(q, { p1, p2, values }) {
    // Simulate with an actual population of 10,000.
    const N = 10000;
    const c1 = (N * p1.toNumber()) / 100;
    const c2 = (N * p2.toNumber()) / 100;
    const v = Math.abs((c2 / N - c1 / N) / (c1 / N)) * 100;
    const hits = values.flatMap((x, i) => (close(x.toNumber(), v) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 7. Overall percent from group percents (MCS) */

interface WParams {
  shares: Frac[];
  rates: number[];
  values: Frac[];
}

interface WCtx {
  noun: string;
  intro: (n: number) => string;
  /** "were size small" */
  be: string[];
  /** "the small shirts" */
  of: string[];
  rest: string;
  did: (list: string) => string;
  ask: string;
}

const W_CTX: WCtx[] = [
  {
    noun: 'shirts',
    intro: (n) => `A store received a shipment of shirts in ${n === 2 ? 'two' : 'three'} sizes.`,
    be: ['were size small', 'were size medium', 'were size large'],
    of: ['the small shirts', 'the medium shirts', 'the large shirts'],
    rest: 'the rest were divided equally between the other two sizes',
    did: (list) => `By the end of the month, ${list} had been sold.`,
    ask: 'What percent of all the shirts in the shipment had been sold by the end of the month?',
  },
  {
    noun: 'employees',
    intro: (n) => `Every employee of a company works in exactly one of ${n === 2 ? 'two' : 'three'} departments.`,
    be: ['work in sales', 'work in research', 'work in operations'],
    of: ['the employees in sales', 'the employees in research', 'the employees in operations'],
    rest: 'the rest are divided equally between the other two departments',
    did: (list) => `Last year, ${list} completed a training course.`,
    ask: 'What percent of all the employees completed the training course last year?',
  },
  {
    noun: 'respondents',
    intro: (n) => `The people who answered a survey were divided into ${n === 2 ? 'two' : 'three'} age groups.`,
    be: ['were under 30', 'were 30 to 50 years old', 'were over 50'],
    of: ['the respondents under 30', 'the respondents 30 to 50 years old', 'the respondents over 50'],
    rest: 'the rest were divided equally between the other two age groups',
    did: (list) => `In all, ${list} said that they read the news every day.`,
    ask: 'What percent of all the respondents said that they read the news every day?',
  },
];

const SHARES: Frac[][] = [
  [F(1, 2), F(1, 4), F(1, 4)],
  [F(2, 5), F(2, 5), F(1, 5)],
  [F(1, 2), F(3, 10), F(1, 5)],
  [F(3, 5), F(1, 5), F(1, 5)],
  [F(1, 4), F(1, 4), F(1, 2)],
  [F(1, 5), F(3, 10), F(1, 2)],
];

function shareText(f: Frac): string {
  const m: Record<string, string> = { '1/2': 'one half', '1/4': 'one fourth', '1/5': 'one fifth', '2/5': 'two fifths', '3/5': 'three fifths', '3/10': 'three tenths' };
  return m[f.toString()] ?? f.toString();
}

const weightedMCS: Template<WParams> = {
  id: 'arith.percent.weighted-mcs',
  skill: 'arith.percent',
  format: 'mcs',
  style: 'overall percent from the percents of groups of different sizes',
  generate(rng, d) {
    const ctx = rng.pick(W_CTX);
    for (;;) {
      const shares = d === 1 ? rng.pick([[F(3, 4), F(1, 4)], [F(2, 5), F(3, 5)], [F(1, 4), F(3, 4)]]) : rng.pick(SHARES);
      const rates = shares.map(() => 10 * rng.int(2, 9));
      const overall = shares.reduce((s, w, i) => s.add(w.mul(rates[i])), F(0));
      const mean = F(rates.reduce((s, r) => s + r, 0), rates.length);
      if (!overall.isInt() || !mean.isInt() || overall.eq(mean) || new Set(rates).size < rates.length) continue;
      const biggest = shares.reduce((bi, w, i) => (w.gt(shares[bi]) ? i : bi), 0);
      const { choices, answer, values } = numChoices(rng, {
        correct: overall,
        traps: [{ value: mean, trap: 'num-unweighted-mean' }],
        fillers: spreadFillers(
          rng,
          overall,
          [mean],
          [F(rates[biggest]), ...[5, 10, 15, 20].map((x) => overall.sub(x))].filter((x) => x.sign() > 0),
          [F(rates[biggest]), ...[5, 10, 15, 20].map((x) => overall.add(x))].filter((x) => x.lt(100)),
        ),
        format: (v) => `$${pct(v)}$`,
      });
      let split: string;
      if (shares.length === 2) split = `${shareText(shares[0])} of the ${ctx.noun} ${ctx.be[0]}, and the rest ${ctx.be[1]}.`;
      else if (shares[1].eq(shares[2]) && d > 1 && rng.chance(0.6)) split = `${shareText(shares[0])} of the ${ctx.noun} ${ctx.be[0]}, and ${ctx.rest}.`;
      else split = `Of the ${ctx.noun}, ${P(shares[0].mul(100))} ${ctx.be[0]}, ${P(shares[1].mul(100))} ${ctx.be[1]}, and ${P(shares[2].mul(100))} ${ctx.be[2]}.`;
      split = split.charAt(0).toUpperCase() + split.slice(1);
      const rateText = shares.map((_, i) => `${P(rates[i])} of ${ctx.of[i]}`);
      const rateSentence = rateText.length === 2 ? `${rateText[0]} and ${rateText[1]}` : `${rateText[0]}, ${rateText[1]}, and ${rateText[2]}`;
      const terms = shares.map((w, i) => `${dec(w)}(${rates[i]})`).join(' + ');
      const N0 = shares.length === 2 ? 20 : 100;
      return {
        params: { shares, rates, values },
        q: {
          format: 'mcs',
          stem: `${ctx.intro(shares.length)} ${split} ${ctx.did(rateSentence)} ${ctx.ask}`,
          choices,
          answer,
          explanation: `Weight each group's percent by its share of the whole: $${terms} = ${overall.toNumber()}$, so ${P(overall)} of all the ${ctx.noun}.

For example, out of ${N0} ${ctx.noun}: $${shares.map((w, i) => `${w.mul(N0).toNumber()} \\times ${dec(F(rates[i], 100))}`).join(' + ')} = ${overall.mul(N0).div(100).toNumber()}$, which is ${P(overall)} of ${N0}.

The plain average of the percents, ${P(mean.isInt() ? mean.toNumber() : Number(mean.toNumber().toFixed(1)))}, ignores that the groups have different sizes.`,
        },
      };
    }
  },
  check(q, { shares, rates, values }) {
    // Simulate a concrete group of 1,000 people / items.
    const N = 1000;
    let yes = 0;
    shares.forEach((w, i) => {
      const size = w.toNumber() * N;
      yes += (size * rates[i]) / 100;
    });
    const v = (yes / N) * 100;
    const hits = values.flatMap((x, i) => (close(x.toNumber(), v) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 8. Reverse percents, chains, equalized changes (NE) */

type RvMode = 'reverse' | 'chain' | 'equalize';

interface RvParams {
  mode: RvMode;
  p: number;
  q: number;
  n: number;
  up: boolean;
}

const reverseNE: Template<RvParams> = {
  id: 'arith.percent.reverse-ne',
  skill: 'arith.percent',
  format: 'ne',
  style: 'find the original amount; percent of a percent; equalized changes',
  generate(rng, d) {
    const mode: RvMode = d === 1 ? rng.pick(['reverse', 'chain'] as const) : d === 2 ? rng.pick(['reverse', 'chain', 'equalize'] as const) : rng.pick(['equalize', 'equalize', 'reverse'] as const);
    if (mode === 'reverse') {
      const up = rng.chance(0.5);
      const p = rng.pick(up ? [5, 8, 10, 12, 15, 20, 25, 40] : [5, 10, 15, 20, 25, 30, 40]);
      const mult = F(up ? 100 + p : 100 - p, 100);
      // original must make the new value a whole number
      let orig: number;
      do orig = (d === 3 ? 100 : 10) * rng.int(d === 3 ? 20 : 12, d === 3 ? 90 : 95);
      while (!mult.mul(orig).isInt());
      const now = mult.mul(orig).toNumber();
      const naive = F(now).mul(F(up ? 100 - p : 100 + p, 100));
      const thing = rng.pick([
        { s: 'the population of a town', again: 'the population of the town', unit: 'people', money: false },
        { s: 'the number of visitors to a museum', again: 'the number of visitors', unit: 'visitors', money: false },
        d === 3
          ? { s: 'the price of a used car', again: 'the price of the car', unit: '', money: true }
          : { s: 'the price of a printer', again: 'the price of the printer', unit: '', money: true },
      ]);
      const verb = up ? 'increased' : 'decreased';
      return {
        params: { mode, p, q: 0, n: now, up },
        q: {
          format: 'ne',
          stem: `After ${thing.s} ${verb} by ${P(p)}, it was ${thing.money ? usd(now) : plain(now)}. What was ${thing.again} before the ${up ? 'increase' : 'decrease'}?`,
          answer: F(orig),
          ...(thing.money ? { prefix: '\\$' } : { suffix: thing.unit }),
          traps: naive.eq(orig) ? [] : [{ value: naive, trap: 'num-reverse-percent' }],
          explanation: `If the original amount is $x$, then $${dec(mult)}x = ${num(now)}$, so $x = \\frac{${num(now)}}{${dec(mult)}} = ${num(orig)}$.

${up ? 'Taking' : 'Adding'} ${P(p)} ${up ? 'off' : 'back to'} ${plain(now)} gives ${plainNum(naive)}, which is wrong: the ${P(p)} was computed on the original amount, not on ${plain(now)}.`,
        },
      };
    }
    if (mode === 'chain') {
      const p = rng.pick([20, 25, 30, 40, 50, 60, 75, 80, 150]);
      const q = rng.pick([10, 20, 25, 40, 50, 60, 120]);
      const ans = F(p * q, 100);
      return {
        params: { mode, p, q, n: 0, up: true },
        q: {
          format: 'ne',
          stem: `If $x$ is ${P(p)} of $y$ and $y$ is ${P(q)} of $z$, where $z \\ne 0$, then $x$ is what percent of $z$?`,
          answer: ans,
          suffix: '%',
          traps: [
            { value: F(p + q), trap: 'num-add-percents' },
            { value: F(p * q), trap: 'num-decimal-shift' },
          ].filter((t) => !t.value.eq(ans)),
          explanation: `$x = ${dec(F(p, 100))}y$ and $y = ${dec(F(q, 100))}z$, so $x = ${dec(F(p, 100))} \\times ${dec(F(q, 100))}z = ${dec(ans.div(100))}z$. That is ${P(ans)} of $z$.

Percents of percents multiply: adding them (${p + q}) or forgetting to divide by 100 (${plain(p * q)}) are the usual slips.`,
        },
      };
    }
    // equalize: A's amount rose p%, B's fell q%, then equal. B's original was what percent greater than A's? (nearest 0.1)
    for (;;) {
      const p = 5 * rng.int(1, 6);
      const q = 5 * rng.int(1, 6);
      const ratio = F(100 + p, 100 - q); // B0 / A0
      const exact = ratio.sub(1).mul(100);
      const tenths = exact.mul(10);
      if (tenths.isInt()) continue; // want rounding to matter
      if (tenths.mul(2).isInt()) continue; // avoid exact ties
      if (p === 10 && q === 5) continue; // the published example uses these numbers
      const ans = F(Math.floor(tenths.toNumber() + 0.5), 10);
      const names = rng.pick([
        ['Jalen', 'Rosa'],
        ['Mei', 'Omar'],
        ['Ines', 'Theo'],
      ]);
      const reverse = F(Math.floor(F(1).sub(ratio.inv()).mul(1000).toNumber() + 0.5), 10);
      return {
        params: { mode, p, q, n: 0, up: true },
        q: {
          format: 'ne',
          stem: `${names[0]}'s salary increased by ${P(p)}, and ${names[1]}'s salary decreased by ${P(q)}. After these changes, the two salaries were equal. ${names[1]}'s salary before the changes was what percent greater than ${names[0]}'s salary before the changes? Give your answer to the nearest 0.1 percent.`,
          answer: ans,
          suffix: '%',
          traps: [
            { value: F(p + q), trap: 'num-add-percents' },
            { value: reverse, trap: 'num-percent-greater-less' },
          ].filter((t) => !t.value.eq(ans)),
          explanation: `Let ${names[0]}'s original salary be $a$ and ${names[1]}'s be $b$. Then $${dec(F(100 + p, 100))}a = ${dec(F(100 - q, 100))}b$, so $\\frac{b}{a} = \\frac{${dec(F(100 + p, 100))}}{${dec(F(100 - q, 100))}} \\approx ${ratio.toNumber().toFixed(4)}$.

So $b$ is about ${(exact.toNumber()).toFixed(3)}% greater than $a$, which rounds to ${dec(ans)}. Adding the percents (${p + q}) is wrong because the two changes are taken on different bases.`,
        },
      };
    }
  },
  check(q, { mode, p, q: qq, n, up }) {
    if (q.format !== 'ne') return 'wrong format';
    if (mode === 'reverse') {
      // forward check: applying the change to the answer must give the stated amount
      const x = q.answer.toNumber();
      const after = up ? x + (x * p) / 100 : x - (x * p) / 100;
      return close(after, n) ? null : `${x} changes to ${after}, not ${n}`;
    }
    if (mode === 'chain') {
      const z = 1000;
      const y = (qq / 100) * z;
      const x = (p / 100) * y;
      return expectNE(q, (x / z) * 100);
    }
    // equalize: pick a = 1000, solve b numerically by bisection on the final equality.
    const a = 1000;
    const target = a * (1 + p / 100);
    let lo = 0;
    let hi = 100000;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (mid * (1 - qq / 100) < target) lo = mid;
      else hi = mid;
    }
    const v = ((lo - a) / a) * 100;
    return expectNE(q, Math.round(v * 10) / 10);
  },
};

export const percentTemplates = [reductionQC, percentOfQC, expressionMCS, profitNE, percentEquivalent, rateChangeMCS, weightedMCS, reverseNE];

