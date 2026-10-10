// Data interpretation family: a two-column money table over seven decades (DA-33): average
// increase per year over the span, one column as a percent of the other, and "for how many rows".

import type { Rng } from '../../../engine/rng';
import { num, usd } from '../../../engine/tex';
import type { Choice, Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { nearestIndex, WORDS } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.decades-table';

const CTXS = [
  { TITLE: 'AVERAGE HOUSEHOLD INCOME AND AVERAGE HOME PRICE IN REGION R (in constant 2020 dollars)', a: 'average household income', b: 'average home price', A: 'Average household income', B: 'Average home price' },
  { TITLE: 'AVERAGE TEACHER SALARY AND AVERAGE NEW-CAR PRICE IN COUNTRY C (in constant 2020 dollars)', a: 'average teacher salary', b: 'average price of a new car', A: 'Average teacher salary', B: 'Average new-car price' },
];

interface DecadeData {
  ctx: (typeof CTXS)[number];
  years: number[];
  a: number[];
  b: number[];
  figure: TableFigure;
}

function makeDecadeData(rng: Rng, d: Difficulty): DecadeData {
  void d;
  const ci = rng.int(0, CTXS.length - 1);
  const ctx = CTXS[ci];
  const y0 = rng.pick([1950, 1960]);
  const years = Array.from({ length: 7 }, (_, k) => y0 + 10 * k);
  for (;;) {
    const a = [rng.int(26, 40) * 1000];
    for (let k = 1; k < 7; k++) a.push(a[k - 1] + rng.int(2, 8) * 1000);
    // Ratio a/b starts near 1/3 (income-to-price) and drifts down past 1/5.
    // Ratio a/b drifts down and crosses the threshold (1/5 for income/price, 1 for salary/car price).
    let r = ci === 0 ? 0.26 + rng.next() * 0.1 : 1.15 + rng.next() * 0.2;
    const b: number[] = [];
    for (let k = 0; k < 7; k++) {
      b.push(Math.round(a[k] / r / 1000) * 1000);
      r *= 0.86 + rng.next() * 0.08;
    }
    const ratios = a.map((x, k) => x / b[k]);
    const thr = ci === 0 ? 1 / 5 : 1;
    const count = ratios.filter((x) => x < thr).length;
    if (count < 1 || count > 5) continue;
    if (ratios.some((x) => Math.abs(x / thr - 1) < 0.05)) continue;
    if (b.some((x, k) => k > 0 && x <= b[k - 1])) continue;
    const money = (x: number) => usd(x);
    const figure: TableFigure = {
      kind: 'table',
      title: ctx.TITLE,
      headers: ['Year', ctx.A, ctx.B],
      rows: years.map((y, k) => [`${y}`, money(a[k]), money(b[k])]),
    };
    return { ctx, years, a, b, figure };
  }
}

function readTable(q: QuestionBody) {
  const t = q.figure as TableFigure;
  const v = (s: string) => Number(s.replace(/[^0-9]/g, ''));
  return { years: t.rows.map((r) => v(r[0])), a: t.rows.map((r) => v(r[1])), b: t.rows.map((r) => v(r[2])) };
}

/* ------------------------------------------------------------------ F1. Average increase per year (MCS) */

interface PerYearParams {
  col: 'a' | 'b';
  from: number;
  to: number;
  values: number[];
}

const perYear: Template<PerYearParams> = {
  id: 'data.interpretation.decades-per-year',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'average increase per year over a span of decades (closest to)',
  generate(rng, d) {
    const D = makeDecadeData(rng, d);
    const col: 'a' | 'b' = rng.chance(0.5) ? 'a' : 'b';
    const [from, to] = d === 1 ? [0, 6] : rng.pick([
      [0, 6],
      [1, 6],
      [0, 5],
      [2, 6],
    ] as [number, number][]);
    const v = D[col];
    const span = D.years[to] - D.years[from];
    const exact = (v[to] - v[from]) / span;
    const step = exact < 400 ? 25 : exact < 1500 ? 100 : 500;
    const R = Math.round(exact / step) * step;
    const items: { v: number; trap?: string }[] = [{ v: R }];
    const add = (x: number, trap?: string) => {
      const g = Math.round(x / step) * step;
      if (g > 0 && items.every((it) => Math.abs(it.v - g) >= 2 * step)) items.push({ v: g, ...(trap ? { trap } : {}) });
    };
    add((v[to] - v[from]) / (to - from), 'prob-di-wrong-divisor');
    add((v[to] - v[from]) / (to - from + 1), 'prob-di-wrong-divisor');
    for (const k of rng.shuffle([2, -2, 4, -4, 6, 8])) if (items.length < 5) add(R + k * step);
    const sorted = items.slice(0, 5).sort((x, y) => x.v - y.v);
    const name = col === 'a' ? D.ctx.a : D.ctx.b;
    return {
      params: { col, from, to, values: sorted.map((it) => it.v) },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `From ${D.years[from]} to ${D.years[to]}, the ${name} increased by approximately how much per year, on average?`,
        choices: sorted.map((it) => ({ text: usd(it.v), ...(it.trap ? { trap: it.trap } : {}) })),
        answer: sorted.findIndex((it) => it.v === R),
        explanation: `Total increase: $${num(v[to])} - ${num(v[from])} = ${num(v[to] - v[from])}$ dollars over $${D.years[to]} - ${D.years[from]} = ${span}$ years, so about $\\frac{${num(v[to] - v[from])}}{${span}} \\approx ${num(Math.round(exact))}$ dollars per year, closest to ${usd(R)}.

The rows are ${to - from} decades apart, not ${to - from} years: dividing by the number of intervals (or of rows) gives the increase per decade.`,
      },
    };
  },
  check(q, { col, from, to, values }) {
    const t = readTable(q);
    const v = t[col];
    const idx = nearestIndex(values, (v[to] - v[from]) / (t.years[to] - t.years[from]));
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ F2. One column as a percent of the other (MCS) */

interface PctParams {
  row: number;
  values: number[];
}

const percentOfOther: Template<PctParams> = {
  id: 'data.interpretation.decades-percent',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'one entry of a row as a percent of the other (approximately)',
  generate(rng, d) {
    const D = makeDecadeData(rng, d);
    for (let t = 0; ; t++) {
      const row = rng.int(0, 6);
      const exact = (D.a[row] / D.b[row]) * 100;
      const R = Math.round(exact);
      if (Math.abs(exact - R) > 0.3 && t < 50) continue;
      const items: { v: number; trap?: string }[] = [{ v: R }];
      const add = (x: number, trap?: string) => {
        const g = Math.round(x);
        if (g > 0 && items.every((it) => Math.abs(it.v - g) >= 4)) items.push({ v: g, ...(trap ? { trap } : {}) });
      };
      add((D.b[row] / D.a[row]) * 100, 'prob-percent-wrong-base');
      add(((D.b[row] - D.a[row]) / D.b[row]) * 100, 'prob-wrong-event');
      for (const k of rng.shuffle([5, -5, 10, -10, 15])) if (items.length < 5) add(R + k);
      const sorted = items.slice(0, 5).sort((x, y) => x.v - y.v);
      return {
        params: { row, values: sorted.map((it) => it.v) },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `In ${D.years[row]}, the ${D.ctx.a} was approximately what percent of the ${D.ctx.b}?`,
          choices: sorted.map((it): Choice => ({ text: `${it.v}%`, ...(it.trap ? { trap: it.trap } : {}) })),
          answer: sorted.findIndex((it) => it.v === R),
          explanation: `$\\frac{${num(D.a[row])}}{${num(D.b[row])}} \\times 100 \\approx ${num(Math.round(exact * 10) / 10)}$, so about ${R}%.

The base is the ${D.ctx.b} (the "of" quantity); $\\frac{${num(D.b[row])}}{${num(D.a[row])}}$ answers the reverse question.`,
        },
      };
    }
  },
  check(q, { row, values }) {
    const t = readTable(q);
    const idx = nearestIndex(values, (t.a[row] / t.b[row]) * 100);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ F3. For how many rows (MCS) */

interface HowManyParams {
  /** threshold fraction num/den: count rows with a < (num/den) * b */
  num: number;
  den: number;
}

const howManyRows: Template<HowManyParams> = {
  id: 'data.interpretation.decades-how-many',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'for how many rows is one column less than a fraction of the other',
  generate(rng, d) {
    const D = makeDecadeData(rng, d);
    const house = D.ctx.a.startsWith('average household');
    const [n0, d0] = house ? [1, 5] : [1, 1];
    const count = D.a.filter((x, k) => x * d0 < n0 * D.b[k]).length;
    const words = WORDS.slice(1, 6).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    const frText = house ? '$\\frac{1}{5}$ of' : '';
    const lines = D.years.map((y, k) => `- ${y}: $${num(D.a[k])}$ vs ${house ? `$\\frac{${num(D.b[k])}}{5} = ${num(D.b[k] / 5)}$` : `$${num(D.b[k])}$`} (${D.a[k] * d0 < n0 * D.b[k] ? 'less' : 'not less'})`).join('\n');
    return {
      params: { num: n0, den: d0 },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `For how many of the years shown in the table was the ${D.ctx.a} less than ${frText ? `${frText} ` : ''}the ${D.ctx.b}?`,
        choices: words.map((w) => ({ text: w })),
        answer: count - 1,
        explanation: `${house ? 'Divide each home price by 5 (or multiply each income by 5) and compare:' : 'Compare the two columns row by row:'}

${lines}

So the answer is ${words[count - 1].toLowerCase()}.${house ? ' A quick estimate is enough for rows far from the boundary: 5 × income versus price.' : ''}`,
      },
    };
  },
  check(q, { num: n0, den: d0 }) {
    const t = readTable(q);
    const count = t.a.filter((x, k) => x * d0 < n0 * t.b[k]).length;
    return q.format === 'mcs' && q.answer === count - 1 ? null : `expected ${count}`;
  },
};

export const decadeTemplates: Template<any>[] = [perYear, percentOfOther, howManyRows];
