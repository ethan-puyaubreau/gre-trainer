import { flaggedChoices, numericChoices, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num, ordinal, plain } from '../../../engine/tex';
import type { Choice, GeometryFigure, QCChoice, QCQuestion, TableFigure, Template } from '../../../engine/types';
import { fTex, medianByRank, medianF, normalCdf, normalPercent, QC_WORDS, sortAsc } from './util';

const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);

/* =============================================================================================
 * 1. Summaries of a distribution: frequency table (median, mean) or density curve (NE)
 * =========================================================================================== */

type FreqMode = 'median' | 'mean' | 'density';

interface FreqParams {
  mode: FreqMode;
  values: number[];
  counts: number[];
  /** density: probabilities in hundredths for the unit intervals, and the asked interval [a, b]. */
  probs: number[];
  a: number;
  b: number;
}

const FREQ_CTX = [
  { title: 'NUMBER OF BOOKS READ LAST SUMMER', value: 'Number of Books', count: 'Number of Students', who: 'students', what: 'number of books read', lo: 0 },
  { title: 'NUMBER OF CHILDREN PER HOUSEHOLD', value: 'Number of Children', count: 'Number of Households', who: 'households', what: 'number of children per household', lo: 0 },
  { title: 'QUIZ SCORES', value: 'Score', count: 'Number of Students', who: 'students', what: 'quiz score', lo: 5 },
  { title: 'DAYS ABSENT LAST MONTH', value: 'Days Absent', count: 'Number of Employees', who: 'employees', what: 'number of days absent', lo: 0 },
];

/** Bell-free density figure over [0, 5] with the probability of each unit interval written in it. */
function densityFigure(probs: number[]): GeometryFigure {
  const peak = Math.max(...probs);
  // heights grow with the probabilities but stay tall enough to hold a label
  const hs = probs.map((p) => 1.05 + (p / peak) * 1.6);
  // control points at the interval midpoints, smoothed with a cosine interpolation
  const ctrl: [number, number][] = [[0, hs[0] * 0.75], ...hs.map((h, i) => [i + 0.5, h] as [number, number]), [5, hs[4] * 0.75]];
  const pts: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [x0, y0] = ctrl[i];
    const [x1, y1] = ctrl[i + 1];
    for (let t = 0; t < 1; t += 0.1) {
      const s = (1 - Math.cos(Math.PI * t)) / 2;
      pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * s]);
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  const yAt = (x: number) => {
    for (let i = 0; i < pts.length - 1; i++) if (pts[i][0] <= x && x <= pts[i + 1][0]) return pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * (x - pts[i][0])) / (pts[i + 1][0] - pts[i][0] || 1);
    return 0;
  };
  const points: Record<string, [number, number]> = { O: [0, 0], E: [5, 0], L0: [0, ctrl[0][1]], L5: [5, ctrl[ctrl.length - 1][1]] };
  const segments: GeometryFigure['segments'] = [
    { from: 'O', to: 'E' },
    { from: 'O', to: 'L0' },
    { from: 'E', to: 'L5' },
  ];
  for (let i = 1; i <= 4; i++) {
    points[`B${i}`] = [i, 0];
    points[`T${i}`] = [i, yAt(i)];
    segments.push({ from: `B${i}`, to: `T${i}` });
  }
  const labels: GeometryFigure['labels'] = [];
  for (let i = 0; i <= 5; i++) labels.push({ at: [i, -0.32], text: `$${i}$` });
  probs.forEach((p, i) => labels.push({ at: [i + 0.5, Math.min(Math.min(yAt(i + 0.2), yAt(i + 0.8)) * 0.5, 1.1)], text: `$${fTex(new Frac(p, 100))}$` }));
  return { kind: 'geometry', points, hideLabels: Object.keys(points), segments, curves: [{ pts }], labels };
}

const freqTable: Template<FreqParams> = {
  id: 'data.distributions.freq-table',
  skill: 'data.distributions',
  format: 'ne',
  style: 'median or mean from a frequency table; probability from a density curve',
  generate(rng, d) {
    const mode: FreqMode = rng.pick(d === 1 ? ['median', 'median', 'density'] : d === 2 ? ['median', 'mean', 'density'] : ['mean', 'median', 'density']);
    const none = { values: [] as number[], counts: [] as number[], probs: [] as number[], a: 0, b: 0 };

    if (mode === 'density') {
      for (;;) {
        // probabilities in hundredths, summing to 100, unimodal-ish
        const raw = [rng.int(4, 14), rng.int(12, 30), rng.int(18, 36), rng.int(10, 26), rng.int(3, 12)];
        if (rng.chance(0.5)) raw.reverse();
        const s = raw.reduce((x, y) => x + y, 0);
        const probs = raw.map((v) => Math.round((v * 100) / s));
        probs[2] += 100 - probs.reduce((x, y) => x + y, 0);
        if (probs.some((p) => p < 2) || new Set(probs).size < 4) continue;
        const kind = rng.pick(d === 1 ? ['between', 'greater'] : ['between', 'greater', 'less']);
        let a: number;
        let b: number;
        if (kind === 'between') {
          a = rng.int(0, 3);
          b = rng.int(a + 2, 5);
          if (a === 0 && b === 5) continue;
        } else if (kind === 'greater') {
          a = rng.int(1, 3);
          b = 5;
        } else {
          a = 0;
          b = rng.int(2, 4);
        }
        const inside = probs.slice(a, b).reduce((x, y) => x + y, 0);
        const answer = new Frac(inside, 100);
        const extra = a > 0 ? inside + probs[a - 1] : b < 5 ? inside + probs[b] : inside;
        const traps = [
          { value: new Frac(100 - inside, 100), trap: 'stat-interval-complement' },
          { value: new Frac(extra, 100), trap: 'stat-interval-extra' },
        ].filter((t) => !t.value.eq(answer));
        const ask = kind === 'between' ? `$${a} < X < ${b}$` : kind === 'greater' ? `$X > ${a}$` : `$X < ${b}$`;
        return {
          params: { mode, ...none, probs, a, b },
          q: {
            format: 'ne',
            figure: densityFigure(probs),
            stem: `The figure shows the probability distribution of a continuous random variable $X$ that takes values from 0 to 5. The probability that $X$ falls in each of the five intervals is shown in the region above that interval. What is the probability that ${ask}?`,
            answer,
            traps,
            explanation: `For a continuous random variable, the probability that $X$ lies in an interval is the area of the region above it, so add the probabilities of the intervals from ${a} to ${b}: $${probs
              .slice(a, b)
              .map((p) => fTex(new Frac(p, 100)))
              .join(' + ')} = ${fTex(answer)}$.

Check: all five probabilities add up to $1$, so the answer is also $1$ minus the probabilities outside the interval.`,
          },
        };
      }
    }

    const ctx = rng.pick(FREQ_CTX);
    for (;;) {
      const k = d === 1 ? rng.int(4, 5) : rng.int(5, 6);
      const values = Array.from({ length: k }, (_, i) => ctx.lo + i);
      const counts = values.map(() => rng.int(1, d === 3 ? 18 : 12));
      const N = counts.reduce((x, y) => x + y, 0);
      const list: number[] = [];
      values.forEach((v, i) => {
        for (let j = 0; j < counts[i]; j++) list.push(v);
      });
      const table: TableFigure = {
        kind: 'table',
        title: ctx.title,
        headers: [ctx.value, ctx.count],
        rows: [...values.map((v, i) => [`$${v}$`, `$${counts[i]}$`]), ['Total', `$${N}$`]],
      };
      if (mode === 'median') {
        const med = medianF(list);
        const freqMed = medianF(counts);
        const distinctMed = medianF(values);
        if (med.eq(distinctMed) && rng.chance(0.7)) continue;
        const traps = [
          { value: freqMed, trap: 'stat-freq-as-data' },
          { value: distinctMed, trap: 'stat-freq-ignored' },
        ].filter((t) => !t.value.eq(med));
        const pos = N % 2 ? `the ${ordinal((N + 1) / 2)} value` : `the average of the ${ordinal(N / 2)} and ${ordinal(N / 2 + 1)} values`;
        let cum = 0;
        const cumText = values
          .map((v, i) => {
            cum += counts[i];
            return `${v}: ${cum}`;
          })
          .join(', ');
        return {
          params: { mode, ...none, values, counts },
          q: {
            format: 'ne',
            figure: table,
            stem: `The table shows the distribution of the ${ctx.what} for ${N} ${ctx.who}. What is the median ${ctx.what} for the ${N} ${ctx.who}?`,
            answer: med,
            traps,
            explanation: `With ${N} values in order, the median is ${pos}. Running totals of the counts (value: number of ${ctx.who} at or below it) are ${cumText}.

So the median is $${fTex(med)}$.

The median is not the median of the counts ($${fTex(freqMed)}$) or of the ${k} listed values ($${fTex(distinctMed)}$): each value counts as many times as its frequency.`,
          },
        };
      }
      // mean
      const total = list.reduce((x, y) => x + y, 0);
      const mean = new Frac(total, N);
      if (!mean.isTerminating() || !mean.mul(100).isInt()) continue;
      const unweighted = new Frac(values.reduce((x, y) => x + y, 0), k);
      const countsOver = new Frac(N, k);
      if (unweighted.eq(mean)) continue;
      return {
        params: { mode, ...none, values, counts },
        q: {
          format: 'ne',
          figure: table,
          stem: `The table shows the distribution of the ${ctx.what} for ${N} ${ctx.who}. What is the average (arithmetic mean) ${ctx.what} for the ${N} ${ctx.who}?`,
          answer: mean,
          traps: [
            { value: unweighted, trap: 'stat-freq-ignored' },
            { value: countsOver, trap: 'stat-freq-as-data' },
          ].filter((t) => !t.value.eq(mean)),
          explanation: `Multiply each value by its frequency and add: $${values.map((v, i) => `${v}(${counts[i]})`).join(' + ')} = ${num(total)}$. Divide by the number of ${ctx.who}, ${N}: $${num(total)} \\div ${N} = ${fTex(mean)}$.

Averaging the ${k} listed values ($${fTex(unweighted)}$) ignores how many ${ctx.who} have each value.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    if (p.mode === 'density') {
      // 1 minus the probabilities outside [a, b]
      const outside = p.probs.filter((_, i) => i < p.a || i >= p.b).reduce((x, y) => x + y, 0);
      const total = p.probs.reduce((x, y) => x + y, 0);
      if (total !== 100) return 'probabilities do not sum to 1';
      return q.answer.eq(new Frac(100 - outside, 100)) ? null : `expected ${(100 - outside) / 100}`;
    }
    const list: number[] = [];
    p.values.forEach((v, i) => {
      for (let j = 0; j < p.counts[i]; j++) list.push(v);
    });
    const expected = p.mode === 'median' ? medianByRank(list) : new Frac(list.reduce((x, y) => x + y, 0), list.length);
    return q.answer.eq(expected) ? null : `expected ${expected}`;
  },
};

/* =============================================================================================
 * 2. Range bounds from a grouped frequency table (QC), book DA-07
 * =========================================================================================== */

type RBMode = 'top-k' | 'least-range' | 'all-range';

interface RBParams {
  mode: RBMode;
  start: number;
  width: number;
  counts: number[];
  k: number;
  numB: number;
  side: 'A' | 'B';
}

const RB_CTX = [
  { title: 'AGES OF THE MEMBERS OF A CLUB', head: 'Age (years)', count: 'Number of Members', who: 'members', what: 'ages', sup: 'oldest', topk: (k: number) => `The range of the ages of the ${k} oldest members`, widths: [10], starts: [10, 20] },
  { title: 'LENGTHS OF FISH CAUGHT', head: 'Length (centimeters)', count: 'Number of Fish', who: 'fish', what: 'lengths', sup: 'longest', topk: (k: number) => `The range of the lengths of the ${k} longest fish`, widths: [5, 10], starts: [10, 20, 30] },
  { title: 'SCORES ON A TEST', head: 'Score', count: 'Number of Students', who: 'students', what: 'scores', sup: 'highest', topk: (k: number) => `The range of the ${k} highest scores`, widths: [10], starts: [40, 50] },
];

/** Every value is an integer; class i holds start + i*width ... start + i*width + width - 1. */
const classLo = (p: { start: number; width: number }, i: number) => p.start + i * p.width;
const classHi = (p: { start: number; width: number }, i: number) => p.start + i * p.width + p.width - 1;

const rangeBounds: Template<RBParams> = {
  id: 'data.distributions.range-bounds',
  skill: 'data.distributions',
  format: 'qc',
  style: 'least and greatest possible range from a grouped frequency table',
  generate(rng, d) {
    const ctx = rng.pick(RB_CTX);
    const width = rng.pick(ctx.widths);
    const start = rng.pick(ctx.starts);
    const mode: RBMode = rng.pick(d === 1 ? ['least-range', 'all-range', 'top-k'] : d === 2 ? ['top-k', 'top-k', 'least-range', 'all-range'] : ['top-k', 'top-k', 'all-range', 'least-range']);
    for (;;) {
      const counts = Array.from({ length: 5 }, () => rng.int(1, 12));
      if (d > 1 && rng.chance(0.4)) counts[rng.pick([0, 4])] = 0;
      const nonEmpty = counts.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
      const top = nonEmpty[nonEmpty.length - 1];
      const bottom = nonEmpty[0];
      const P = { start, width };
      let lo: number; // least possible value of Quantity A (the statistic)
      let hi: number; // greatest possible value
      let k = 0;
      let label: string;
      let why: string;
      if (mode === 'top-k') {
        const next = nonEmpty[nonEmpty.length - 2];
        if (counts[next] < 2) continue;
        k = counts[top] + rng.int(1, Math.min(counts[next] - 1, 4));
        lo = classLo(P, top) - classHi(P, next);
        hi = classHi(P, top) - classLo(P, next);
        label = ctx.topk(k);
        why = `The ${k} ${ctx.sup} values are the ${counts[top]} in the ${classLo(P, top)}–${classHi(P, top)} group and the ${k - counts[top]} greatest in the ${classLo(P, next)}–${classHi(P, next)} group. Their range is as small as $${classLo(P, top)} - ${classHi(P, next)} = ${lo}$ (values bunched at the boundary between the groups) and as large as $${classHi(P, top)} - ${classLo(P, next)} = ${hi}$ (values at the far ends of the groups).`;
      } else {
        lo = top === bottom ? 0 : classLo(P, top) - classHi(P, bottom);
        hi = classHi(P, top) - classLo(P, bottom);
        label = mode === 'least-range' ? `The least possible range of the ${ctx.what} of all the ${ctx.who}` : `The range of the ${ctx.what} of all the ${ctx.who}`;
        why = `The least value is in the ${classLo(P, bottom)}–${classHi(P, bottom)} group and the greatest is in the ${classLo(P, top)}–${classHi(P, top)} group. The range is at least $${classLo(P, top)} - ${classHi(P, bottom)} = ${lo}$ and at most $${classHi(P, top)} - ${classLo(P, bottom)} = ${hi}$.`;
      }
      let numB: number;
      let ansA: QCChoice;
      if (mode === 'least-range') {
        const r = rng.next();
        numB = r < 0.35 ? lo : r < 0.7 ? lo - rng.int(1, 5) : lo + rng.int(1, 5);
        // tempting value: difference of class labels (e.g. 50 - 20)
        ansA = qcFromSamples([[lo, numB]]);
        why += ` So the least possible range is $${lo}$.`;
      } else {
        const r = rng.next();
        if (r < 0.42) numB = rng.int(lo, hi);
        else if (r < 0.75) numB = lo - rng.int(1, 4);
        else numB = hi + rng.int(1, 4);
        ansA = numB < lo ? 'A' : numB > hi ? 'B' : 'D';
      }
      if (numB < 0) continue;
      const side: 'A' | 'B' = rng.chance(0.6) ? 'A' : 'B';
      const ans = side === 'A' ? ansA : flip(ansA);
      const tr: Partial<Record<QCChoice, string>> = {};
      if (ans === 'D') {
        // the midpoint-of-classes estimate
        const mid = mode === 'top-k' ? (lo + hi) / 2 : (lo + hi) / 2;
        const slip = qcFromSamples([side === 'A' ? [mid, numB] : [numB, mid]]);
        if (slip !== 'D') tr[slip] = 'stat-class-midpoints';
      } else tr.D = 'stat-grouped-unknown';
      if (tr[ans]) delete tr[ans];
      const table: TableFigure = {
        kind: 'table',
        title: ctx.title,
        headers: [ctx.head, ctx.count],
        rows: [...counts.map((c, i) => [`$${classLo(P, i)}$–$${classHi(P, i)}$`, `$${c}$`]), ['Total', `$${counts.reduce((x, y) => x + y, 0)}$`]],
      };
      return {
        params: { mode, start, width, counts, k, numB, side },
        q: {
          format: 'qc',
          figure: table,
          info: `The table shows the distribution of the ${ctx.what}, all whole numbers, of ${counts.reduce((x, y) => x + y, 0)} ${ctx.who}.`,
          quantityA: side === 'A' ? label : `$${numB}$`,
          quantityB: side === 'A' ? `$${numB}$` : label,
          answer: ans,
          traps: Object.keys(tr).length ? (tr as QCQuestion['traps']) : undefined,
          explanation: `Only the groups are known, not the exact values. ${why}${
            mode === 'least-range'
              ? ''
              : ansA === 'D'
                ? ` Since $${numB}$ is within these bounds, the range could be less than, equal to, or greater than $${numB}$.`
                : ` Every possible range is ${ansA === 'A' ? 'greater' : 'less'} than $${numB}$.`
          } So ${QC_WORDS[ans]}. (${ans})`,
        },
      };
    }
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    // Build many data sets consistent with the table and evaluate Quantity A on each.
    const build = (pick: (i: number, j: number) => number) => {
      const xs: number[] = [];
      p.counts.forEach((c, i) => {
        for (let j = 0; j < c; j++) xs.push(pick(i, j));
      });
      return xs;
    };
    const nonEmpty = p.counts.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
    const top = nonEmpty[nonEmpty.length - 1];
    const configs: ((i: number, j: number) => number)[] = [
      (i) => classLo(p, i),
      (i) => classHi(p, i),
      (i) => (i === top ? classLo(p, i) : classHi(p, i)), // squeezed toward the top boundary
      (i) => (i === top ? classHi(p, i) : classLo(p, i)), // spread
      (i) => (i === nonEmpty[0] ? classHi(p, i) : classLo(p, i)), // squeezed toward the bottom
    ];
    for (let r = 0; r < 60; r++) configs.push((i) => classLo(p, i) + rng.int(0, p.width - 1));
    const stat = (xs: number[]) => {
      const s = sortAsc(xs);
      if (p.mode === 'top-k') {
        const topK = s.slice(s.length - p.k);
        return topK[topK.length - 1] - topK[0];
      }
      return s[s.length - 1] - s[0];
    };
    const values = configs.map((f) => stat(build(f)));
    const aVals = p.mode === 'least-range' ? [Math.min(...values)] : values;
    const expected = qcFromSamples(aVals.map((v) => (p.side === 'A' ? [v, p.numB] : [p.numB, v]) as [number, number]));
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* =============================================================================================
 * 3. Values within k standard deviations of the mean (MCM), book DA-23
 * =========================================================================================== */

interface WithinParams {
  m: number;
  s: number;
  /** k in tenths (15 = 1.5). */
  k10: number;
  kind: 'within' | 'beyond';
  values: number[];
}

const withinSD: Template<WithinParams> = {
  id: 'data.distributions.within-sd',
  skill: 'data.distributions',
  format: 'mcm',
  style: 'which values lie within k standard deviations of the mean',
  generate(rng, d) {
    const k10 = rng.pick(d === 1 ? [10, 20] : d === 2 ? [10, 15, 20] : [15, 20, 25]);
    const kind: WithinParams['kind'] = d === 3 && rng.chance(0.4) ? 'beyond' : 'within';
    for (;;) {
      const s = rng.int(2, d === 1 ? 8 : 15) * (k10 % 10 ? 2 : 1);
      const m = rng.int(20, 120);
      const half = (k10 * s) / 10;
      const lo = m - half;
      const hi = m + half;
      if (!Number.isInteger(lo) || lo < 0) continue;
      const cands = new Set<number>([
        lo - rng.int(1, 3),
        lo + rng.int(0, 2),
        m + rng.int(-Math.floor(half / 2), Math.floor(half / 2)),
        hi - rng.int(0, 2),
        hi + rng.int(1, 3),
        rng.chance(0.5) ? m - half - s : m + half + s,
        rng.chance(0.5) ? m + Math.round(half / 2) + 1 : m - Math.round(half / 2) - 1,
        m + s,
      ]);
      const vals = [...cands].filter((v) => v >= 0);
      if (vals.length < 6) continue;
      const values = sortAsc(rng.sample(vals, 6));
      const isIn = (v: number) => Math.abs(v - m) * 10 <= k10 * s;
      const correct = (v: number) => (kind === 'within' ? isIn(v) : !isIn(v));
      const nCorrect = values.filter(correct).length;
      if (nCorrect < 1 || nCorrect > 5) continue;
      const kTex = fTex(new Frac(k10, 10));
      const items: (Choice & { correct: boolean })[] = values.map((v) => {
        let trap: string | undefined;
        if (!correct(v)) {
          const nearEdge = Math.abs(Math.abs(v - m) - half) <= 3;
          if (kind === 'within') trap = nearEdge ? 'stat-sd-interval-edge' : 'stat-sd-units';
          else if (nearEdge) trap = 'stat-sd-interval-edge';
        }
        return { text: `$${num(v)}$`, correct: correct(v), ...(trap ? { trap } : {}) };
      });
      const { choices, answer } = flaggedChoices(items);
      return {
        params: { m, s, k10, kind, values },
        q: {
          format: 'mcm',
          stem: `A distribution of values has a mean of $${m}$ and a standard deviation of $${s}$. Which of the following values are ${kind === 'within' ? `within $${kTex}$` : `more than $${kTex}$`} standard deviation${k10 === 10 ? '' : 's'} ${kind === 'within' ? 'of' : 'away from'} the mean?`,
          instruction: 'Indicate all such values.',
          choices,
          answer,
          explanation: `$${kTex}$ standard deviation${k10 === 10 ? ' is' : 's are'} $${kTex} \\times ${s} = ${num(half)}$. The values within that distance of the mean are those from $${m} - ${num(half)} = ${num(lo)}$ to $${m} + ${num(half)} = ${num(hi)}$, inclusive.

${kind === 'within' ? `So the values in the interval from $${num(lo)}$ to $${num(hi)}$ are the answers` : `So the answers are the values less than $${num(lo)}$ or greater than $${num(hi)}$`}: ${
            values.filter(correct).map((v) => `$${num(v)}$`).join(', ')
          }. Remember that the interval extends $${num(half)}$ on both sides of the mean.`,
        },
      };
    }
  },
  check(q, { m, s, k10, kind, values }) {
    if (q.format !== 'mcm') return 'wrong format';
    // Standardize each value and compare its z-score with k.
    const expected = values.flatMap((v, i) => {
      const z = Math.abs((v - m) / s);
      const within = z <= k10 / 10 + 1e-12;
      return (kind === 'within' ? within : !within) ? [i] : [];
    });
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/* =============================================================================================
 * 4. Standard units: mean and SD from values given in SD units; relative standing (MCS), book DA-17
 * =========================================================================================== */

interface UnitsParams {
  mode: 'mean' | 'sd' | 'compare';
  v1: number;
  z1: number;
  v2: number;
  z2: number;
  /** compare mode: [score, mean, sd] per person. */
  people: [number, number, number][];
  options: number[];
}

/** Coefficient in TeX, with 1 omitted: 1 -> '', 1.5 -> '1.5'. */
const coef = (z: number) => (z === 1 ? '' : fTex(frac(Math.round(z * 10)).div(10)));

const NAMES = ['Ana', 'Ben', 'Carla', 'Dev', 'Elena', 'Femi', 'Gus', 'Hana'];

const sdUnits: Template<UnitsParams> = {
  id: 'data.distributions.sd-units',
  skill: 'data.distributions',
  format: 'mcs',
  style: 'standard deviation units: find the mean or SD, or compare relative standing',
  generate(rng, d) {
    const mode: UnitsParams['mode'] = rng.pick(d === 1 ? ['compare', 'mean'] : d === 2 ? ['mean', 'sd', 'compare'] : ['mean', 'sd', 'mean']);
    const none = { v1: 0, z1: 0, v2: 0, z2: 0, people: [] as [number, number, number][], options: [] as number[] };
    if (mode === 'compare') {
      for (;;) {
        const people = Array.from({ length: 5 }, () => {
          const sd = rng.int(2, 12) * (rng.chance(0.5) ? 1 : 5);
          const mean = rng.int(10, 80) * 5;
          const z = rng.int(-4, 12) / 4;
          return [mean + z * sd, mean, sd] as [number, number, number];
        });
        if (people.some(([x]) => !Number.isInteger(x) || x <= 0)) continue;
        const zs = people.map(([x, mu, sd]) => (x - mu) / sd);
        const best = Math.max(...zs);
        if (zs.filter((z) => Math.abs(z - best) < 1e-9).length > 1) continue;
        const raw = people.map(([x, mu]) => x - mu);
        const iRaw = raw.indexOf(Math.max(...raw));
        const iBest = zs.indexOf(best);
        if (iRaw === iBest && rng.chance(0.8)) continue;
        const names = rng.sample(NAMES, 5);
        const tableRows = people.map(([x, mu, sd], i) => [names[i], `$${num(x)}$`, `$${num(mu)}$`, `$${num(sd)}$`]);
        const choices: Choice[] = names.map((nm, i) => ({ text: nm, ...(i === iRaw && i !== iBest ? { trap: 'stat-raw-distance' } : {}) }));
        return {
          params: { ...none, mode, people },
          q: {
            format: 'mcs',
            figure: { kind: 'table', title: 'TEST RESULTS', headers: ['Student', 'Score', 'Test Mean', 'Test Standard Deviation'], rows: tableRows },
            stem: `Five students each took a different test. The table shows each student's score, together with the mean and the standard deviation of all the scores on that student's test. Relative to the other people who took the same test, which student's score was the greatest number of standard deviations above the mean?`,
            choices,
            answer: iBest,
            explanation: `Convert each score to standard units: (score − mean) ÷ standard deviation.
${people.map(([x, mu, sd], i) => `- ${names[i]}: $(${num(x)} - ${num(mu)}) \\div ${num(sd)} = ${fTex(new Frac(x - mu, sd))}$`).join('\n')}

${names[iBest]} is the greatest number of standard deviations above the mean. ${iRaw !== iBest ? `${names[iRaw]} has the largest raw difference from the mean, but that test has a larger spread.` : ''}`,
          },
        };
      }
    }
    for (;;) {
      // v1 is z1 SDs below the mean, v2 is z2 SDs above it. SD and mean with one decimal place.
      const z1 = rng.pick(d === 1 ? [1, 2] : [1, 1.5, 2, 2.5, 3]);
      const z2 = rng.pick(d === 1 ? [1, 2, 3] : [0.5, 1, 1.5, 2, 3]);
      if (d > 1 && Number.isInteger(z1) && Number.isInteger(z2) && rng.chance(0.6)) continue;
      const s10 = rng.int(d === 1 ? 2 : 11, d === 1 ? 9 : 90) * (d === 1 ? 10 : 1); // SD in tenths
      const mu10 = d === 1 ? 10 * rng.int(20, 90) : rng.int(100, 900);
      const v1t = mu10 - z1 * s10;
      const v2t = mu10 + z2 * s10;
      if (!Number.isInteger(v1t) || !Number.isInteger(v2t) || v1t <= 0) continue;
      const v1 = v1t / 10;
      const v2 = v2t / 10;
      if (d > 1 && (Number.isInteger(v1) === false || Number.isInteger(v2) === false) && rng.chance(0.7)) continue;
      const target10 = mode === 'mean' ? mu10 : s10;
      const step = d === 1 ? 10 : 1; // choices step by 1 (easy) or by 0.1
      const start = target10 - step * rng.int(0, 4);
      const options = [0, 1, 2, 3, 4].map((i) => start + i * step);
      const mid10 = (v1t + v2t) / 2;
      const wrongS = (v2t - v1t) / Math.abs(z2 - z1 || 1);
      const trapFor = (o: number): string | undefined => {
        if (o === target10) return undefined;
        if (mode === 'mean' && Math.abs(o - mid10) < 0.5) return 'stat-sd-midpoint';
        if (mode === 'sd' && Math.abs(o - wrongS) < 0.5) return 'stat-sd-z-subtract';
        return undefined;
      };
      const choices = options.map((o) => ({ text: `$${num(o / 10)}$`, ...(trapFor(o) ? { trap: trapFor(o)! } : {}) }));
      if (options.some((o) => o <= 0)) continue;
      const zt = (z: number) => `${fTex(frac(z * 10).div(10))} standard deviation${z === 1 ? '' : 's'}`;
      return {
        params: { ...none, mode, v1, z1, v2, z2, options },
        q: {
          format: 'mcs',
          stem: `In a certain distribution, the value $${num(v1)}$ is ${zt(z1)} below the mean and the value $${num(v2)}$ is ${zt(z2)} above the mean. What is the ${mode === 'mean' ? 'mean' : 'standard deviation'} of the distribution?`,
          choices,
          answer: options.indexOf(target10),
          explanation: `Let $m$ be the mean and $s$ the standard deviation. Then $${num(v1)} = m - ${coef(z1)}s$ and $${num(v2)} = m + ${coef(z2)}s$.

Subtracting, $${num(v2)} - ${num(v1)} = ${fTex(frac((z1 + z2) * 10).div(10))}s$, so $s = \\dfrac{${num((v2t - v1t) / 10)}}{${fTex(frac((z1 + z2) * 10).div(10))}} = ${num(s10 / 10)}$. ${
            mode === 'mean' ? `Then $m = ${num(v1)} + ${z1 === 1 ? num(s10 / 10) : `${coef(z1)}(${num(s10 / 10)})`} = ${num(mu10 / 10)}$.` : ''
          }

The two values are ${fTex(frac((z1 + z2) * 10).div(10))} standard deviations apart (add the units, because they are on opposite sides of the mean). ${
            mode === 'mean' && z1 !== z2 ? `The mean is not halfway between them (that would be $${num(mid10 / 10)}$), because they are different distances from the mean.` : ''
          }`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    if (p.mode === 'compare') {
      // Percentile under a normal model is monotone in the z-score: pick the greatest percentile.
      const pct = p.people.map(([x, mu, sd]) => normalCdf((x - mu) / sd));
      const best = pct.indexOf(Math.max(...pct));
      return best === q.answer ? null : `expected ${best}`;
    }
    // Scan candidate means on a fine grid: the SD implied by each value must agree.
    let bestMu = 0;
    let bestErr = Infinity;
    for (let mu = p.v1; mu <= p.v2; mu += 0.01) {
      const sA = (mu - p.v1) / p.z1;
      const sB = (p.v2 - mu) / p.z2;
      if (Math.abs(sA - sB) < bestErr) {
        bestErr = Math.abs(sA - sB);
        bestMu = mu;
      }
    }
    const target = p.mode === 'mean' ? bestMu : (bestMu - p.v1) / p.z1;
    let best = 0;
    p.options.forEach((o, i) => {
      if (Math.abs(o / 10 - target) < Math.abs(p.options[best] / 10 - target)) best = i;
    });
    return best === q.answer ? null : `expected ${p.options[best] / 10}`;
  },
};

/* =============================================================================================
 * 5. The normal distribution: percents between values, counts, estimating the SD (MCS), DA-25
 * =========================================================================================== */

const REGIONS = [2, 14, 34, 34, 14, 2]; // percents for z in (-inf,-2), (-2,-1), (-1,0), (0,1), (1,2), (2,inf)
const Z_EDGES = [-Infinity, -2, -1, 0, 1, 2, Infinity];

/** Percent between two z boundaries from the figure's region percents. */
function regionPercent(z1: number, z2: number): number {
  const i1 = Z_EDGES.indexOf(z1);
  const i2 = Z_EDGES.indexOf(z2);
  return REGIONS.slice(i1, i2).reduce((s, v) => s + v, 0);
}

/** The standard normal curve with the six region percents. */
function normalFigure(): GeometryFigure {
  const H = 3.2;
  const f = (z: number) => H * Math.exp((-z * z) / 2);
  const pts: [number, number][] = [];
  for (let z = -3.4; z <= 3.4001; z += 0.1) pts.push([z, f(z)]);
  const points: Record<string, [number, number]> = { L: [-3.6, 0], R: [3.6, 0] };
  const segments: GeometryFigure['segments'] = [{ from: 'L', to: 'R' }];
  for (const z of [-2, -1, 0, 1, 2]) {
    points[`B${z + 2}`] = [z, 0];
    points[`T${z + 2}`] = [z, f(z)];
    segments.push({ from: `B${z + 2}`, to: `T${z + 2}`, dashed: z !== 0 });
  }
  const labels: GeometryFigure['labels'] = [];
  for (const z of [-2, -1, 0, 1, 2]) labels.push({ at: [z, -0.35], text: `$${z}$` });
  const where: [number, number][] = [
    [-2.8, 0.5],
    [-1.47, 0.36],
    [-0.5, 1.2],
    [0.5, 1.2],
    [1.5, 0.36],
    [2.8, 0.5],
  ];
  REGIONS.forEach((r, i) => labels.push({ at: where[i], text: `${r}%` }));
  return { kind: 'geometry', points, hideLabels: Object.keys(points), segments, curves: [{ pts }], labels };
}

const NORMAL_CTX = [
  { what: 'the heights of the adult men in a certain city', unit: 'centimeters', mu: [165, 185], sd: [5, 9], who: 'men', noun: 'heights' },
  { what: 'the weights of the apples harvested at an orchard', unit: 'grams', mu: [140, 220], sd: [8, 20], who: 'apples', noun: 'weights' },
  { what: 'the scores on a national examination', unit: 'points', mu: [450, 550], sd: [40, 100], who: 'test takers', noun: 'scores' },
  { what: 'the lifetimes of the light bulbs made by a factory', unit: 'hours', mu: [800, 1200], sd: [50, 150], who: 'light bulbs', noun: 'lifetimes' },
];

interface NormalParams {
  mode: 'percent' | 'count' | 'estimate-sd';
  mu: number;
  sigma: number;
  /** z bounds (may be +-Infinity) for percent / count. */
  z1: number;
  z2: number;
  N: number;
  /** estimate-sd: the value and its stated percentile. */
  v: number;
  pct: number;
  options: number[];
}

const normalDist: Template<NormalParams> = {
  id: 'data.distributions.normal',
  skill: 'data.distributions',
  format: 'mcs',
  style: 'normal distribution: percents, counts and the SD from the standard normal figure',
  generate(rng, d) {
    const mode: NormalParams['mode'] = rng.pick(d === 1 ? ['percent', 'percent', 'count'] : d === 2 ? ['percent', 'count', 'estimate-sd'] : ['estimate-sd', 'count', 'percent']);
    const ctx = rng.pick(NORMAL_CTX);
    const mu = rng.int(ctx.mu[0] / 5, ctx.mu[1] / 5) * 5;
    const sigma = rng.int(ctx.sd[0], ctx.sd[1]);
    const intro = `The figure shows a normal distribution with mean 0 and standard deviation 1, with the approximate percent of the distribution in each of the six regions.`;
    const none = { z1: 0, z2: 0, N: 0, v: 0, pct: 0, options: [] as number[] };

    if (mode === 'estimate-sd') {
      for (;;) {
        const z = rng.pick([-2, -1, 1, 2]);
        const pct = Math.round(normalCdfFromRegions(z));
        const step = rng.pick(sigma >= 40 ? [10, 20] : [2, 5]);
        const s = step * rng.int(2, 6);
        const v = mu + z * s;
        if (v <= 0) continue;
        const startK = rng.int(Math.max(1, s / step - 4), s / step);
        const options = [0, 1, 2, 3, 4].map((i) => (startK + i) * step);
        if (!options.includes(s)) continue;
        // Misjudging the number of standard deviations: 2 instead of 1 gives s/2, 1 instead of 2 gives 2s.
        const slipS = Math.abs(z) === 2 ? 2 * s : s / 2;
        const trapFor = (o: number) => (o !== s && o === slipS ? 'stat-normal-sd-count' : undefined);
        const choices = options.map((o) => ({ text: `$${num(o)}$`, ...(trapFor(o) ? { trap: trapFor(o)! } : {}) }));
        return {
          params: { ...none, mode, mu, sigma: s, v, pct, options },
          q: {
            format: 'mcs',
            figure: normalFigure(),
            stem: `${intro}

The ${ctx.noun} of ${ctx.who} in a large group are approximately normally distributed with a mean of $${num(mu)}$ ${ctx.unit}. A ${ctx.noun.replace(/s$/, '')} of $${num(v)}$ ${ctx.unit} is at approximately the ${ordinal(pct)} percentile of the distribution. Of the following, which is the best estimate of the standard deviation of the distribution, in ${ctx.unit}?`,
            choices,
            answer: options.indexOf(s),
            explanation: `From the figure, the percent of the distribution below each tick mark is: $-2$: 2%, $-1$: 16%, $0$: 50%, $1$: 84%, $2$: 98%. So the ${ordinal(pct)} percentile is about ${Math.abs(z)} standard deviation${Math.abs(z) === 1 ? '' : 's'} ${z < 0 ? 'below' : 'above'} the mean.

So $${num(v)}$ is about ${Math.abs(z) === 1 ? 'one standard deviation' : 'two standard deviations'} ${z < 0 ? 'below' : 'above'} $${num(mu)}$: ${Math.abs(z) === 1 ? `$s \\approx ${num(Math.abs(v - mu))}$` : `$2s \\approx ${num(Math.abs(v - mu))}$, so $s \\approx ${num(s)}$`}.`,
          },
        };
      }
    }

    // percent or count between two values
    for (;;) {
      const edges = [-Infinity, -2, -1, 0, 1, 2, Infinity];
      let i1 = rng.int(0, 5);
      let i2 = rng.int(i1 + 1, 6);
      if (i1 === 0 && i2 === 6) continue;
      if (d === 1 && (i1 === 0 || i2 === 6) && rng.chance(0.5)) continue;
      const z1 = edges[i1];
      const z2 = edges[i2];
      const pct = regionPercent(z1, z2);
      const valueAt = (z: number) => mu + z * sigma;
      const ask =
        z1 === -Infinity ? `less than $${num(valueAt(z2))}$ ${ctx.unit}` : z2 === Infinity ? `greater than $${num(valueAt(z1))}$ ${ctx.unit}` : `between $${num(valueAt(z1))}$ and $${num(valueAt(z2))}$ ${ctx.unit}`;
      // traps: two-sided percents used for one side; complement
      const oneSided = (z1 === 0 || z2 === 0) && Number.isFinite(z1) && Number.isFinite(z2) ? 2 * pct : null;
      const set = [2, 14, 16, 34, 48, 50, 68, 82, 84, 96, 98];
      const trapList: { value: number; trap: string }[] = [];
      if (oneSided !== null && oneSided < 100) trapList.push({ value: oneSided, trap: 'stat-normal-one-side' });
      if (100 - pct !== pct) trapList.push({ value: 100 - pct, trap: 'stat-normal-complement' });
      if (mode === 'count') {
        const N = rng.pick([500, 1000, 2000, 5000, 10000]);
        const ans = (pct * N) / 100;
        const { choices, answer } = numericChoices(rng, {
          correct: ans,
          traps: trapList.map((t) => ({ value: (t.value * N) / 100, trap: t.trap })).concat([{ value: pct, trap: 'stat-normal-percent-only' }]),
          fillers: rng.shuffle(set.filter((p) => p !== pct)).map((p) => (p * N) / 100),
          format: (v) => `$${fTex(v)}$`,
        });
        return {
          params: { ...none, mode, mu, sigma, z1, z2, N, options: choices.map((c) => Number(c.text.replace(/[${}]/g, '').replace(/,/g, ''))) },
          q: {
            format: 'mcs',
            figure: normalFigure(),
            stem: `${intro}

The ${ctx.noun} of ${plain(N)} ${ctx.who} are approximately normally distributed with a mean of $${num(mu)}$ ${ctx.unit} and a standard deviation of $${num(sigma)}$ ${ctx.unit}. Approximately how many of the ${ctx.who} have ${ctx.noun.replace(/s$/, '')}s ${ask}?`,
            choices,
            answer,
            explanation: `${explainBounds(mu, sigma, z1, z2)} From the figure, the part ${regionWords(z1, z2)} holds about ${pct}% of the distribution.

$${pct}\\%$ of $${num(N)}$ is $${num(ans)}$.`,
          },
        };
      }
      const { choices, answer } = numericChoices(rng, {
        correct: pct,
        traps: trapList,
        fillers: rng.shuffle(set.filter((p) => p !== pct)),
        format: (v) => `$${v.toNumber()}\\%$`,
      });
      return {
        params: { ...none, mode, mu, sigma, z1, z2, options: choices.map((c) => Number(c.text.replace(/[$\\%]/g, ''))) },
        q: {
          format: 'mcs',
          figure: normalFigure(),
          stem: `${intro}

The ${ctx.noun} of ${ctx.who} in a large group are approximately normally distributed with a mean of $${num(mu)}$ ${ctx.unit} and a standard deviation of $${num(sigma)}$ ${ctx.unit}. Approximately what percent of the ${ctx.who} have ${ctx.noun.replace(/s$/, '')}s ${ask}?`,
          choices,
          answer,
          explanation: `${explainBounds(mu, sigma, z1, z2)} So the question asks for the part of the figure ${regionWords(z1, z2)}. Add the percents of those regions: $${REGIONS.slice(Z_EDGES.indexOf(z1), Z_EDGES.indexOf(z2))
            .map((r) => `${r}\\%`)
            .join(' + ')} = ${pct}\\%$.${oneSided !== null ? ` (The familiar ${2 * pct}% is for both sides of the mean together.)` : ''}`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // Numerical integration of the normal density, independent of the figure's rounded percents.
    if (p.mode === 'estimate-sd') {
      // For each candidate SD, compute the percentile of v; pick the candidate closest to the stated one.
      let best = 0;
      let bestErr = Infinity;
      p.options.forEach((s, i) => {
        const err = Math.abs(100 * normalCdf((p.v - p.mu) / s) - p.pct);
        if (err < bestErr) {
          bestErr = err;
          best = i;
        }
      });
      return best === q.answer ? null : `expected ${p.options[best]}`;
    }
    const lo = p.z1 === -Infinity ? -Infinity : p.mu + p.z1 * p.sigma;
    const hi = p.z2 === Infinity ? Infinity : p.mu + p.z2 * p.sigma;
    const truePct = normalPercent(p.mu, p.sigma, lo, hi);
    const target = p.mode === 'count' ? (truePct * p.N) / 100 : truePct;
    let best = 0;
    p.options.forEach((o, i) => {
      if (Math.abs(o - target) < Math.abs(p.options[best] - target)) best = i;
    });
    return best === q.answer ? null : `expected ${p.options[best]} (true ${target})`;
  },
};

/** "to the left of 1", "between -1 and 2"... (TeX). */
function regionWords(z1: number, z2: number): string {
  if (z1 === -Infinity) return `to the left of $${z2}$`;
  if (z2 === Infinity) return `to the right of $${z1}$`;
  return `between $${z1}$ and $${z2}$`;
}

/** Percent below z from the figure's region percents (z in -2..2). */
function normalCdfFromRegions(z: number): number {
  return regionPercent(-Infinity, z);
}

function explainBounds(mu: number, sigma: number, z1: number, z2: number): string {
  const desc = (z: number) =>
    z === 0 ? `$${num(mu)}$ is the mean` : `$${num(mu + z * sigma)}$ is ${Math.abs(z)} standard deviation${Math.abs(z) === 1 ? '' : 's'} ${z < 0 ? 'below' : 'above'} the mean ($${num(mu)} ${z < 0 ? '-' : '+'} ${Math.abs(z) === 1 ? '' : `${Math.abs(z)} \\times `}${num(sigma)}$)`;
  const parts = [z1, z2].filter((z) => Number.isFinite(z)).map(desc);
  return `In standard units, ${parts.join(' and ')}.`;
}

export const distributionTemplates = [freqTable, rangeBounds, withinSD, sdUnits, normalDist];
