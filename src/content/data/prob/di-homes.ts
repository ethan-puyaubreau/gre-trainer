// Data interpretation family: a table of yearly counts + a line graph of the yearly mean and
// median prices (DA-32). Totals come from mean × count; the median cannot give totals.

import { flaggedChoices } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num, usd } from '../../../engine/tex';
import type { Difficulty, LineChartFigure, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { mcmCheck, mcsCheck, nearestIndex, trapChoicesOrPad, trapOnlyChoices } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.homes-mean-median';

interface HomesCtx {
  place: string;
  items: string;
  item: string;
  TITLE_N: string;
  TITLE_P: string;
  price: string;
}

const CTXS: HomesCtx[] = [
  { place: 'City X', items: 'homes', item: 'home', TITLE_N: 'NUMBER OF HOMES SOLD IN CITY X', TITLE_P: 'SALE PRICES OF HOMES SOLD IN CITY X', price: 'sale price' },
  { place: 'Dealership D', items: 'cars', item: 'car', TITLE_N: 'NUMBER OF CARS SOLD AT DEALERSHIP D', TITLE_P: 'SALE PRICES OF CARS SOLD AT DEALERSHIP D', price: 'sale price' },
];

interface HomesData {
  ctx: HomesCtx;
  years: number[];
  counts: number[];
  /** In thousands of dollars. */
  means: number[];
  medians: number[];
  /** Pairs (i < j) good for each question type. */
  combinePairs: [number, number][];
  offsetPairs: [number, number][];
  medianPairs: [number, number][];
  figure: [TableFigure, LineChartFigure];
}

const choicesStep = (exact: number, alt: number, step: number) => {
  const b = Math.round(exact / step);
  const off = Math.abs(exact / step - b);
  return off < 0.35 && Math.round(alt / step) !== b;
};

function makeHomesData(rng: Rng, d: Difficulty): HomesData {
  void d;
  const ci = rng.int(0, CTXS.length - 1);
  const ctx = CTXS[ci];
  const cars = ci === 1;
  for (;;) {
    const y0 = rng.int(2014, 2019);
    const years = [0, 1, 2, 3, 4].map((k) => y0 + k);
    const counts = years.map(() => rng.int(cars ? 30 : 12, cars ? 90 : 48) * 10);
    const means: number[] = [rng.int(cars ? 28 : 24, cars ? 40 : 34) * (cars ? 1 : 10)];
    const stepU = cars ? 1 : 10;
    for (let k = 1; k < 5; k++) means.push(means[k - 1] + rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]) * stepU);
    const medians = means.map((m) => m - rng.int(1, 5) * stepU);
    if (Math.min(...medians) <= (cars ? 15 : 150)) continue;
    if (new Set(counts).size < 5) continue;
    const combinePairs: [number, number][] = [];
    const offsetPairs: [number, number][] = [];
    const medianPairs: [number, number][] = [];
    const step = cars ? 1 : 10;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const w = (counts[i] * means[i] + counts[j] * means[j]) / (counts[i] + counts[j]);
        const u = (means[i] + means[j]) / 2;
        if (Math.abs(w - u) >= 0.8 * step && choicesStep(w, u, step) && Math.abs(Math.round(w / step) - Math.round(u / step)) <= 3) combinePairs.push([i, j]);
        const ti = counts[i] * means[i];
        const tj = counts[j] * means[j];
        if ((means[i] - means[j]) * (ti - tj) < 0) offsetPairs.push([i, j]);
        const pc = ((medians[j] - medians[i]) / medians[i]) * 100;
        const frac = Math.abs(pc - Math.round(pc));
        if (Math.abs(pc) >= 6 && frac < 0.3) medianPairs.push([i, j]);
      }
    if (!combinePairs.length || !offsetPairs.length || !medianPairs.length) continue;
    const lo = Math.min(...medians);
    const hi = Math.max(...means);
    const gs = cars ? 2 : 20;
    const yMin = Math.floor((lo - gs) / gs) * gs;
    const yMax = Math.ceil((hi + gs) / gs) * gs;
    const table: TableFigure = {
      kind: 'table',
      title: ctx.TITLE_N,
      headers: ['Year', `Number of ${ctx.items} sold`],
      rows: years.map((y, k) => [`${y}`, num(counts[k]).replace('{,}', ',')]),
    };
    const line: LineChartFigure = {
      kind: 'line',
      title: `MEAN AND MEDIAN ${ctx.TITLE_P}`,
      categories: years.map(String),
      series: [
        { name: 'Mean', values: means },
        { name: 'Median', values: medians },
      ],
      yLabel: 'Thousands of dollars',
      yMin,
      yMax,
      yStep: gs,
    };
    return { ctx, years, counts, means, medians, combinePairs, offsetPairs, medianPairs, figure: [table, line] };
  }
}

function readData(q: QuestionBody) {
  const [t, l] = q.figure as [TableFigure, LineChartFigure];
  return {
    counts: t.rows.map((r) => Number(r[1].replace(/[^0-9]/g, ''))),
    means: l.series[0].values,
    medians: l.series[1].values,
  };
}

const money = (thousands: number) => usd(Math.round(thousands * 1000));
const parseMoney = (s: string) => Number(s.replace(/[^0-9.]/g, ''));

/* ------------------------------------------------------------------ B1. Combined mean of two years (MCS) */

interface CombineParams {
  i: number;
  j: number;
  step: number;
}

const combinedMean: Template<CombineParams> = {
  id: 'data.interpretation.homes-combined-mean',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'combined average of two years from counts and means (closest to)',
  generate(rng, d) {
    const D = makeHomesData(rng, d);
    const cars = D.ctx.items === 'cars';
    const step = cars ? 1 : 10;
    const { counts: n, means: m, medians: md, years: y } = D;
    for (let tries = 0; ; tries++) {
      const [i, j] = rng.pick(D.combinePairs);
      const w = (n[i] * m[i] + n[j] * m[j]) / (n[i] + n[j]);
      const u = (m[i] + m[j]) / 2;
      const g = (x: number) => Math.round(x / step) * step;
      const cb = g(w);
      const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: g(x), trap, why });
      const allYears = n.reduce((s, c, k) => s + c * m[k], 0) / n.reduce((s, c) => s + c, 0);
      const traps = rng.shuffle([
        mk(u, 'prob-di-average-of-averages', (s) => `the plain average of the two means, ${s}, ignores that ${n[i] > n[j] ? y[i] : y[j]} had more ${D.ctx.items}`),
        mk(m[i], 'prob-di-wrong-column', (s) => `${s} is the mean of ${y[i]} alone`),
        mk(m[j], 'prob-di-wrong-column', (s) => `${s} is the mean of ${y[j]} alone`),
        mk((n[j] * m[i] + n[i] * m[j]) / (n[i] + n[j]), 'prob-di-weights-swapped', (s) => `giving each year the other year's count as its weight gives ${s}`),
        mk((n[i] * md[i] + n[j] * md[j]) / (n[i] + n[j]), 'prob-di-wrong-column', (s) => `using the median line instead of the mean line gives ${s}`),
        ...[0, 1, 2, 3, 4]
          .filter((k) => k !== i && k !== j)
          .map((k) => mk(m[k], 'prob-di-wrong-column', (s) => `${s} is the mean of ${y[k]}, a year that was not asked about`)),
        mk(m[i] + m[j], 'prob-di-wrong-divisor', (s) => `adding the two means gives ${s}, which is twice too large: an average divides`),
        mk((md[i] + md[j]) / 2, 'prob-di-wrong-column', (s) => `averaging the two medians gives ${s}, but the question is about the mean`),
        mk(allYears, 'prob-di-wrong-column', (s) => `using all five years instead of the two asked about gives ${s}`),
      ]).filter((t) => t.value >= step);
      const built = trapChoicesOrPad(rng, cb, traps, { step, minGap: step, min: step, pad: tries >= 40, format: money });
      if (!built) continue;
      const cite = rng.pick(built.used.length ? built.used : traps);
      const ti = n[i] * m[i];
      const tj = n[j] * m[j];
      const k = (v: number) => num(v);
      return {
        params: { i, j, step },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `The average (arithmetic mean) ${D.ctx.price} of all the ${D.ctx.items} sold ${cars ? 'at' : 'in'} ${D.ctx.place} in ${y[i]} and ${y[j]} combined was closest to which of the following?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `A year's total is its mean times its number of ${D.ctx.items} (in thousands of dollars): ${y[i]}: $${k(n[i])} \\times ${k(m[i])} = ${k(ti)}$; ${y[j]}: $${k(n[j])} \\times ${k(m[j])} = ${k(tj)}$.

Combined mean: $\\frac{${k(ti)} + ${k(tj)}}{${k(n[i])} + ${k(n[j])}} = \\frac{${k(ti + tj)}}{${k(n[i] + n[j])}} \\approx ${k(Math.round(w * 10) / 10)}$ thousand dollars, closest to ${money(cb)}.

Check: the combined mean lies between ${money(Math.min(m[i], m[j]))} and ${money(Math.max(m[i], m[j]))}, nearer the mean of ${n[i] > n[j] ? y[i] : y[j]}, which had more ${D.ctx.items}.

Trap: ${cite.why(money(cite.value))}.

Weight each mean by its count: total of all prices over the number of ${D.ctx.items}.`,
        },
      };
    }
  },
  check(q, { i, j }) {
    const { counts: n, means: m } = readData(q);
    const w = ((n[i] * m[i] + n[j] * m[j]) / (n[i] + n[j])) * 1000;
    if (q.format !== 'mcs') return 'format';
    const idx = nearestIndex(q.choices.map((c) => parseMoney(c.text)), w);
    return idx === q.answer ? null : `expected choice ${idx} for ${w}`;
  },
};

/* ------------------------------------------------------------------ B2. Percent change of the median (MCS) */

interface MedianParams {
  i: number;
  j: number;
  values: number[];
}

const medianChange: Template<MedianParams> = {
  id: 'data.interpretation.homes-median-change',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'approximate percent change of a value read from a line graph',
  generate(rng, d) {
    const D = makeHomesData(rng, d);
    const { medians: md, means: mn, years: y } = D;
    for (let tries = 0; ; tries++) {
      const [i, j] = rng.pick(D.medianPairs);
      const pc = ((md[j] - md[i]) / md[i]) * 100;
      const up = pc > 0;
      const r = Math.round(Math.abs(pc));
      const wrongBase = Math.abs(((md[j] - md[i]) / md[j]) * 100);
      const meanBased = Math.abs(((mn[j] - mn[i]) / mn[i]) * 100);
      const other = (k: number) => (k >= 0 && k <= 4 && k !== i ? Math.abs(((md[j] - md[k]) / md[k]) * 100) : NaN);
      const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: Math.round(x), trap, why });
      const traps = rng.shuffle([
        mk(wrongBase, 'prob-percent-wrong-base', (s) => `dividing by the ${y[j]} value instead of the ${y[i]} value gives ${s}%`),
        mk(meanBased, 'prob-di-wrong-column', (s) => `reading the mean line instead of the median line gives ${s}%`),
        mk(Math.abs(md[j] - md[i]), 'prob-count-as-percent', (s) => `${s} is the change in thousands of dollars, not a percent`),
        mk((md[j] / md[i]) * 100, 'prob-percent-ratio-as-change', (s) => `${s}% is the ${y[j]} median as a percent of the ${y[i]} median, not the change`),
        mk(other(i - 1), 'prob-di-wrong-column', (s) => `starting from ${y[i - 1]} instead of ${y[i]} gives ${s}%`),
        mk(other(i + 1), 'prob-di-wrong-column', (s) => `starting from ${y[i + 1]} instead of ${y[i]} gives ${s}%`),
        ...[0, 1, 2, 3, 4]
          .filter((k) => k !== i && k !== j)
          .map((k) => mk(Math.abs(((md[k] - md[i]) / md[i]) * 100), 'prob-di-wrong-column', (s) => `ending at ${y[k]} instead of ${y[j]} gives ${s}%`)),
        mk(Math.abs(((md[j] - md[i]) / (md[i] + md[j])) * 200), 'prob-percent-wrong-base', (s) => `dividing by the average of the two medians gives ${s}%`),
      ]).filter((t) => Number.isFinite(t.value) && t.value >= 1);
      const built = trapChoicesOrPad(rng, r, traps, { step: 4, minGap: 2, min: 1, pad: tries >= 40, format: (v) => `${v}%` });
      if (!built) continue;
      const cite = rng.pick(built.used.length ? built.used : traps);
      return {
        params: { i, j, values: built.values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `Approximately what was the percent ${up ? 'increase' : 'decrease'} in the median ${D.ctx.price} of the ${D.ctx.items} sold from ${y[i]} to ${y[j]}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Read the median line (not the mean line): ${num(md[i])} thousand dollars in ${y[i]} and ${num(md[j])} thousand dollars in ${y[j]}. Percent ${up ? 'increase' : 'decrease'}: $\\frac{${num(Math.abs(md[j] - md[i]))}}{${num(md[i])}} \\times 100 \\approx ${num(Math.round(Math.abs(pc) * 10) / 10)}$, about ${r}%.

Check: ${r}% of ${num(md[i])} is about ${num(Math.round((r * md[i]) / 10) / 10)}, close to the change of ${num(Math.abs(md[j] - md[i]))} thousand.

Trap: ${cite.why(String(cite.value))}.

A percent change divides the change by the starting value.`,
        },
      };
    }
  },
  check(q, { i, j, values }) {
    const { medians: md } = readData(q);
    const pc = Math.abs(((md[j] - md[i]) / md[i]) * 100);
    const idx = nearestIndex(values, pc);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ B3. Totals: must be true (MCM) */

type TotStmt =
  | { kind: 'total-vs'; i: number; j: number }
  | { kind: 'median-total'; i: number; j: number }
  | { kind: 'total-over'; i: number; thr: number }
  | { kind: 'half-above-median'; i: number }
  | { kind: 'max-over'; i: number; thr: number };

interface TotalsParams {
  stmts: TotStmt[];
}

/** Least possible maximum of n values with the given mean and median (all values as equal as allowed). */
function leastMax(n: number, mean: number, median: number): number {
  // The lower half and the middle value(s) are at most the median: put them at the median; the rest share the excess.
  const low = Math.floor(n / 2) + 1;
  const rest = n - low;
  return (n * mean - low * median) / rest;
}

const totalsMust: Template<TotalsParams> = {
  id: 'data.interpretation.homes-totals-must',
  skill: SKILL,
  set: SET,
  format: 'mcm',
  style: 'which statements about totals must be true (mean × count, not the median)',
  generate(rng, d) {
    const D = makeHomesData(rng, d);
    const { counts: n, means: m, medians: md, years: y, ctx } = D;
    const items: { s: TotStmt; text: string; truth: boolean; trap?: string; why: string }[] = [];
    const total = (k: number) => n[k] * m[k];
    const mil = (thousands: number) => `\\$${(thousands / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million`;
    // 1. A higher mean offset by a lower count.
    const [oi, oj] = rng.pick(D.offsetPairs);
    const [hiMean, loMean] = m[oi] > m[oj] ? [oi, oj] : [oj, oi];
    items.push({
      s: { kind: 'total-vs', i: hiMean, j: loMean },
      text: `The total of the ${ctx.price}s of all the ${ctx.items} sold in ${y[hiMean]} was greater than the total for ${y[loMean]}.`,
      truth: false,
      trap: 'prob-di-mean-not-total',
      why: `Total = mean × number: ${y[hiMean]}: $${num(m[hiMean])} \\times ${num(n[hiMean])} = ${num(total(hiMean))}$ thousand; ${y[loMean]}: $${num(m[loMean])} \\times ${num(n[loMean])} = ${num(total(loMean))}$ thousand. The higher mean is outweighed by the smaller number of ${ctx.items}.`,
    });
    // 2. Totals over a threshold (computed).
    const k2 = rng.int(0, 4);
    const t2 = total(k2);
    const over = rng.chance(0.5);
    const thr = (Math.round((t2 * (over ? 0.9 : 1.1)) / 500) * 500) / 1;
    items.push({
      s: { kind: 'total-over', i: k2, thr },
      text: `The total of the ${ctx.price}s of all the ${ctx.items} sold in ${y[k2]} was more than ${mil(thr)}.`,
      truth: t2 > thr,
      ...(t2 > thr ? {} : { trap: 'prob-di-thousands' }),
      why: `$${num(n[k2])} \\times ${num(m[k2])}$ thousand dollars $= ${mil(t2)}$, which is ${t2 > thr ? 'more' : 'less'} than ${mil(thr)}.`,
    });
    // 3. Median definition (true).
    const k3 = rng.int(0, 4);
    items.push({
      s: { kind: 'half-above-median', i: k3 },
      text: `At least half of the ${ctx.items} sold in ${y[k3]} sold for ${money(md[k3])} or more.`,
      truth: true,
      why: `${money(md[k3])} is the median for ${y[k3]}, and at least half of the values in a list are greater than or equal to the median.`,
    });
    // 4. Cannot be known: the most expensive item.
    const k4 = rng.int(0, 4);
    const lm = leastMax(n[k4], m[k4], md[k4]);
    const thr4 = Math.ceil((lm + 5) / 10) * 10;
    items.push({
      s: { kind: 'max-over', i: k4, thr: thr4 },
      text: `The most expensive ${ctx.item} sold in ${y[k4]} sold for more than ${money(thr4)}.`,
      truth: false,
      trap: 'prob-di-median-total',
      why: `The mean and median do not tell how high the top price was: for example, the ${ctx.items} above the median could all have sold for about ${money(Math.round(lm))}.`,
    });
    // 5. Comparing totals by the medians.
    const medPairs: [number, number][] = [];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (a !== b && md[a] > md[b] && total(a) < total(b)) medPairs.push([a, b]);
    if (medPairs.length) {
      const [a, b] = rng.pick(medPairs);
      items.push({
        s: { kind: 'median-total', i: a, j: b },
        text: `Since the median ${ctx.price} was greater in ${y[a]} than in ${y[b]}, the total of the ${ctx.price}s was also greater in ${y[a]} than in ${y[b]}.`,
        truth: false,
        trap: 'prob-di-median-total',
        why: `Totals come from mean × number, not from medians: ${y[a]}: $${num(total(a))}$ thousand, ${y[b]}: $${num(total(b))}$ thousand.`,
      });
    }
    const nPick = d === 3 ? 4 : 3;
    const trues = items.filter((c) => c.truth);
    const falses = items.filter((c) => !c.truth);
    const t = rng.int(Math.max(1, nPick - falses.length), Math.min(trues.length, nPick - 1));
    const chosen = rng.shuffle([...rng.sample(trues, t), ...rng.sample(falses, nPick - t)]);
    const { choices, answer } = flaggedChoices(chosen.map((c) => ({ text: c.text, correct: c.truth, ...(c.trap && !c.truth ? { trap: c.trap } : {}) })));
    return {
      params: { stmts: chosen.map((c) => c.s) },
      q: {
        format: 'mcm',
        figure: D.figure,
        stem: 'Which of the following statements must be true, according to the data?',
        instruction: 'Indicate all such statements.',
        choices,
        answer,
        explanation: `A year's total is its mean times its number of ${ctx.items}; the median tells only where the middle value is.\n\n${chosen.map((c, k) => `- ${String.fromCharCode(65 + k)}: ${c.truth ? 'true' : 'not necessarily true'}. ${c.why}`).join('\n')}`,
      },
    };
  },
  check(q, { stmts }, rng) {
    const { counts: n, means: m, medians: md } = readData(q);
    // Build explicit price lists consistent with each year's count, mean and median, in two very
    // different ways, and keep a statement only if it holds for both lists.
    const lists = (k: number): number[][] => {
      const N = n[k];
      const low = Math.floor(N / 2) + 1;
      const even = [...Array(low).fill(md[k]), ...Array(N - low).fill((N * m[k] - low * md[k]) / (N - low))];
      // Skewed: values below the median, the middle values at the median, one very high value.
      const skewed = Array.from({ length: Math.ceil(N / 2) - 1 }, () => md[k] * (0.6 + 0.39 * rng.next()));
      while (skewed.length < N - 1) skewed.push(md[k]);
      skewed.push(N * m[k] - skewed.reduce((s, v) => s + v, 0));
      // Both lists are built in increasing order; verify that, then read the median directly.
      const med = (t: number[]) => {
        for (let x = 1; x < t.length; x++) if (t[x] < t[x - 1] - 1e-9) return NaN;
        return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2;
      };
      if (Math.abs(med(even) - md[k]) > 1e-9 || Math.abs(med(skewed) - md[k]) > 1e-9) throw new Error('bad construction');
      return [even, skewed];
    };
    const totalOf = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
    const used = new Set(stmts.flatMap((s) => ('j' in s ? [s.i, s.j] : [s.i])));
    const byYear = [0, 1, 2, 3, 4].map((k) => (used.has(k) ? lists(k) : [[], []]));
    const truth = stmts.map((s) => {
      const hold = (li: number[][]) => {
        switch (s.kind) {
          case 'total-vs':
          case 'median-total':
            return totalOf(li[s.i]) > totalOf(li[s.j]) + 1e-6;
          case 'total-over':
            return totalOf(li[s.i]) > s.thr + 1e-6;
          case 'half-above-median':
            return li[s.i].filter((v) => v >= md[s.i] - 1e-9).length * 2 >= li[s.i].length;
          case 'max-over':
            return li[s.i].reduce((mx, v) => (v > mx ? v : mx), -Infinity) > s.thr + 1e-9;
        }
      };
      return hold(byYear.map((l) => l[0])) && hold(byYear.map((l) => l[1]));
    });
    return mcmCheck(q, truth);
  },
};

/* ------------------------------------------------------------------ B4. A tax on all sales (MCS, powers of ten) */

interface TaxParams {
  k: number;
  rate: number;
}

const taxOnSales: Template<TaxParams> = {
  id: 'data.interpretation.homes-tax',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'a percent of the total sales of one year (choices differ by powers of ten)',
  generate(rng, d) {
    const D = makeHomesData(rng, d);
    for (let tries = 0; tries < 2000; tries++) {
      const k = rng.int(0, 4);
      const rate = rng.pick([1, 2, 3, 4, 5]);
      const { counts: n, means: m, years: y, ctx } = D;
      const totalDollars = n[k] * m[k] * 1000;
      const tax = (totalDollars * rate) / 100;
      const cash = (v: number) => (Number.isInteger(v) ? usd(v) : usd(Math.round(v * 100) / 100, 2));
      const mk = (value: number, trap: string, why: (s: string) => string) => ({ value: frac(Math.round(value * 100), 100), trap, why });
      const traps = rng.shuffle([
        mk(tax / 1000, 'prob-di-thousands', (s) => `forgetting that the graph is in thousands gives ${s}`),
        mk(tax * 1000, 'prob-di-thousands', (s) => `converting thousands to dollars twice gives ${s}`),
        mk(tax * 10, 'prob-percent-decimal', (s) => `using ${rate}% as 0.${rate} instead of 0.0${rate} gives ${s}`),
        mk(tax * 100, 'prob-percent-decimal', (s) => `using ${rate} instead of 0.0${rate} as the rate gives ${s}`),
        mk(tax / 10, 'prob-percent-decimal', (s) => `using ${rate}% as 0.00${rate} gives ${s}`),
        mk(tax / 100, 'prob-percent-decimal', (s) => `using ${rate}% as 0.000${rate} gives ${s}`),
        mk(totalDollars, 'prob-di-forgot-rate', (s) => `${s} is the total sales, before taking ${rate} percent of them`),
        mk(tax / n[k], 'prob-di-forgot-count', (s) => `${s} is the tax on one ${ctx.item} at the mean price, not on all ${n[k]} of them`),
      ]).filter((t) => t.value.gte(1));
      const built = trapOnlyChoices(rng, tax, traps, (x) => cash(x.toNumber()));
      if (!built) continue;
      const cite = rng.pick(built.used);
      return {
        params: { k, rate },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `In ${y[k]}, a tax of ${rate} percent was charged on the ${ctx.price} of each ${ctx.item} sold ${ctx.items === 'cars' ? 'at' : 'in'} ${ctx.place}. What was the total amount of tax charged on the ${ctx.items} sold in ${y[k]}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Total of the ${ctx.price}s in ${y[k]} = mean × number $= ${num(m[k] * 1000)} \\times ${num(n[k])} = ${num(totalDollars)}$ dollars (the graph is in thousands of dollars). The tax is ${rate}% of that: $${num(totalDollars)} \\times 0.0${rate} = ${num(tax)}$.

Check: 1% of ${usd(totalDollars)} is ${usd(totalDollars / 100)}, so ${rate}% is ${rate} times that.

Trap: ${cite.why(cash(cite.value.toNumber()))}.

A tax on every sale is the rate times the total of the prices: mean times number, in dollars.`,
        },
      };
    }
    throw new Error('homes-tax: no choices');
  },
  check(q, { k, rate }) {
    const { counts: n, means: m } = readData(q);
    const tax = n[k] * m[k] * 1000 * (rate / 100);
    return mcsCheck(q, usd(Math.round(tax)));
  },
};

export const homesTemplates: Template<any>[] = [combinedMean, medianChange, totalsMust, taxOnSales];
