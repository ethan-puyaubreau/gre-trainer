// Data interpretation family: a two-column money table over seven decades (DA-33): average
// increase per year over the span, one column as a percent of the other, and "for how many rows".

import type { Rng } from '../../../engine/rng';
import { num, usd } from '../../../engine/tex';
import { plural } from '../../../engine/text';
import type { Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { mcsCheck, nearestIndex, trapOnlyChoices } from './util';

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
  unit: 'year' | 'decade';
  from: number;
  to: number;
  values: number[];
}

const perYear: Template<PerYearParams> = {
  id: 'data.interpretation.decades-per-year',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'average increase per year (or per decade) over a span of decades (closest to)',
  generate(rng, d) {
    const D = makeDecadeData(rng, d);
    for (let tries = 0; ; tries++) {
      const col: 'a' | 'b' = rng.chance(0.5) ? 'a' : 'b';
      const [from, to] = d === 1 ? [0, 6] : rng.pick([
        [0, 6],
        [1, 6],
        [0, 5],
        [2, 6],
      ] as [number, number][]);
      const unit: 'year' | 'decade' = d === 1 ? 'year' : rng.chance(0.5) ? 'decade' : 'year';
      const per = unit === 'year' ? 1 : 10; // years in one unit
      const v = D[col];
      const other = D[col === 'a' ? 'b' : 'a'];
      const span = D.years[to] - D.years[from];
      const avg = (vals: number[], f: number, t: number) => ((vals[t] - vals[f]) / (D.years[t] - D.years[f])) * per;
      const exact = avg(v, from, to);
      const step = exact < 400 ? 25 : exact < 1500 ? 100 : 500;
      const R = Math.round(exact / step) * step;
      const clear = Math.abs(exact / step - Math.round(exact / step)) <= 0.4; // the exact value is clearly nearest to one choice
      if (!clear && tries < 80) continue;
      const g = (x: number) => Math.round(x / step) * step;
      const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: g(x), trap, why });
      const rise = v[to] - v[from];
      const other10 = unit === 'year' ? rise / (to - from) : rise / span;
      const traps = rng.shuffle([
        mk(other10, 'prob-di-wrong-divisor', (s) => (unit === 'year' ? `dividing by the ${to - from} decades gives ${s}, which is per decade, not per year` : `dividing by the ${span} years gives ${s}, which is per year, not per decade`)),
        mk(rise / (to - from + 1), 'prob-di-wrong-divisor', (s) => `dividing by the ${to - from + 1} rows gives ${s}, which counts one row too many`),
        mk(rise, 'prob-di-no-divide', (s) => `${s} is the whole increase, not the increase per ${unit}`),
        mk(((v[to] - v[to - 1]) / 10) * per, 'prob-di-one-interval', (s) => `using only the last decade gives ${s}, not the average over the whole span`),
        mk(((v[from + 1] - v[from]) / 10) * per, 'prob-di-one-interval', (s) => `using only the first decade gives ${s}, not the average over the whole span`),
        mk(avg(other, from, to), 'prob-di-wrong-column', (s) => `using the other column gives ${s}`),
        ...[
          [from, to - 1],
          [from, to + 1],
          [from - 1, to],
          [from + 1, to],
        ]
          .filter(([f, t]) => f >= 0 && t <= 6 && t > f)
          .map(([f, t]) => mk(avg(v, f, t), 'prob-di-wrong-column', (s) => `reading the rows ${D.years[f]} and ${D.years[t]} instead gives ${s}`)),
        mk(rise / (span + 10) * per, 'prob-di-wrong-divisor', (s) => `counting one decade too many in the divisor gives ${s}`),
        mk((v[to] / span) * per, 'prob-di-no-subtract', (s) => `dividing the final value by the years gives ${s}, without taking away the starting value`),
        mk(rise / (D.years[6] - D.years[0]) * per, 'prob-di-wrong-divisor', (s) => `dividing by the ${D.years[6] - D.years[0]} years of the whole table gives ${s}, but the question covers ${span} years`),
      ]).filter((t) => t.value >= step);
      const built = trapOnlyChoices(rng, R, traps, (x) => usd(x.n), 5, clear ? step : 2 * step);
      if (!built) continue;
      const cite = rng.pick(built.used);
      const name = col === 'a' ? D.ctx.a : D.ctx.b;
      const units = span / per;
      return {
        params: { col, from, to, unit, values: built.values.map((x) => x.toNumber()) },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `From ${D.years[from]} to ${D.years[to]}, the ${name} increased by approximately how much per ${unit}, on average?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Total increase: $${num(v[to])} - ${num(v[from])} = ${num(rise)}$ dollars over $${D.years[to]} - ${D.years[from]} = ${span}$ years, that is ${units} ${unit}${units === 1 ? '' : 's'}. So about $\\frac{${num(rise)}}{${units}} \\approx ${num(Math.round(exact))}$ dollars per ${unit}, closest to ${usd(R)}.

Check: ${units} ${unit}${units === 1 ? '' : 's'} at ${usd(R)} each add about ${usd(R * units)}, near the actual ${usd(rise)}.

Trap: ${cite.why(usd(cite.value))}.

The rows are ${to - from} decades apart: divide the total change by the number of ${unit}s it took.`,
        },
      };
    }
  },
  check(q, { col, from, to, unit, values }) {
    const t = readTable(q);
    const v = t[col];
    const idx = nearestIndex(values, ((v[to] - v[from]) / (t.years[to] - t.years[from])) * (unit === 'year' ? 1 : 10));
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
      const a = D.a[row];
      const b = D.b[row];
      const near = (k: number) => Math.round((D.a[k] / D.b[k]) * 100);
      const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: Math.round(x), trap, why });
      const traps = rng.shuffle([
        mk((b / a) * 100, 'prob-percent-wrong-base', (s) => `dividing the ${D.ctx.b} by the ${D.ctx.a} gives ${s}%, the reverse question`),
        mk(((b - a) / b) * 100, 'prob-wrong-event', (s) => `${s}% is the part of the ${D.ctx.b} that is not the ${D.ctx.a}`),
        mk((a / (a + b)) * 100, 'prob-percent-wrong-base', (s) => `dividing by the two entries added together gives ${s}%, but the base is the ${D.ctx.b}`),
        mk(near(Math.max(0, row - 1)), 'prob-di-wrong-column', (s) => `reading the row before gives ${s}%`),
        mk(near(Math.min(6, row + 1)), 'prob-di-wrong-column', (s) => `reading the row after gives ${s}%`),
        mk(near(Math.max(0, row - 2)), 'prob-di-wrong-column', (s) => `reading the row two before gives ${s}%`),
        mk(near(Math.min(6, row + 2)), 'prob-di-wrong-column', (s) => `reading the row two after gives ${s}%`),
        mk(R / 10, 'prob-percent-decimal', (s) => `${s}% puts the decimal point one place off`),
        mk(R * 10, 'prob-percent-decimal', (s) => `${s}% puts the decimal point one place off`),
      ]).filter((x) => x.value >= 1);
      const built = trapOnlyChoices(rng, R, traps, (x) => `${x.n}%`, 5, 4);
      if (!built) continue;
      const cite = rng.pick(built.used);
      return {
        params: { row, values: built.values.map((x) => x.toNumber()) },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `In ${D.years[row]}, the ${D.ctx.a} was approximately what percent of the ${D.ctx.b}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `$\\frac{${num(a)}}{${num(b)}} \\times 100 \\approx ${num(Math.round(exact * 10) / 10)}$, so about ${R}%.

Check: ${R}% of ${usd(b)} is about ${usd(Math.round((R * b) / 100))}, near ${usd(a)}.

Trap: ${cite.why(String(cite.value))}.

The base is the ${D.ctx.b} (the "of" quantity): divide by it.`,
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
    const rows = D.a.length;
    const below = (n: number, dd: number) => D.a.filter((x, k) => x * dd < n * D.b[k]).length;
    const count = below(n0, d0);
    const mk = (value: number, trap: string, why: (v: string) => string) => ({ value, trap, why });
    const specific = rng.shuffle([
      mk(rows - count, 'prob-wrong-event', (v) => `${v} counts the rows where the ${D.ctx.a} is not less, the other direction`),
      ...(house
        ? [
            mk(below(1, 1), 'prob-ignored-restriction', (v) => `comparing with the whole ${D.ctx.b} instead of one fifth of it gives ${v}`),
            mk(below(1, 4), 'prob-di-wrong-fraction', (v) => `using one fourth instead of one fifth gives ${v}`),
            mk(below(1, 3), 'prob-di-wrong-fraction', (v) => `using one third instead of one fifth gives ${v}`),
            mk(below(1, 10), 'prob-di-wrong-fraction', (v) => `using one tenth instead of one fifth gives ${v}`),
          ]
        : [
            mk(below(1, 2), 'prob-di-wrong-fraction', (v) => `comparing with half the ${D.ctx.b} gives ${v}`),
            mk(below(2, 1), 'prob-di-wrong-fraction', (v) => `comparing with twice the ${D.ctx.b} gives ${v}`),
            mk(below(3, 4), 'prob-di-wrong-fraction', (v) => `comparing with three fourths of the ${D.ctx.b} gives ${v}`),
          ]),
    ]);
    // a miscount of the rows is the last resort, so that the choices are always named
    const generic = Array.from({ length: rows + 1 }, (_, n) => mk(n, 'prob-di-miscount', (v) => `${v} comes from a miscount: only ${plural(count, 'row')} qualify`));
    const built = trapOnlyChoices(rng, count, [...specific, ...generic], (v) => `$${v.n}$`, 5, 0, true);
    if (!built) throw new Error('decades-how-many: no choices');
    const cite = rng.pick(built.used);
    const frText = house ? '$\\frac{1}{5}$ of' : '';
    const lines = D.years.map((y, k) => `- ${y}: $${num(D.a[k])}$ vs ${house ? `$\\frac{${num(D.b[k])}}{5} = ${num(D.b[k] / 5)}$` : `$${num(D.b[k])}$`} (${D.a[k] * d0 < n0 * D.b[k] ? 'less' : 'not less'})`).join('\n');
    return {
      params: { num: n0, den: d0 },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `For how many of the years shown in the table was the ${D.ctx.a} less than ${frText ? `${frText} ` : ''}the ${D.ctx.b}?`,
        choices: built.choices,
        answer: built.answer,
        explanation: `${house ? 'Divide each home price by 5 (or multiply each income by 5) and compare:' : 'Compare the two columns row by row:'}

${lines}

So the answer is $${count}$.

Trap: ${cite.why(`$${cite.value}$`)}.

Test every row against the stated condition, then count the rows that pass.`,
      },
    };
  },
  check(q, { num: n0, den: d0 }) {
    const t = readTable(q);
    const count = t.a.filter((x, k) => x * d0 < n0 * t.b[k]).length;
    return mcsCheck(q, `$${count}$`);
  },
};

export const decadeTemplates: Template<any>[] = [perYear, percentOfOther, howManyRows];
