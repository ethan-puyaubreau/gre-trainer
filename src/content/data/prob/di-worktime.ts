// Data interpretation family: a paired bar graph (two years) of the minutes of work needed to buy
// food items, read to scale, with a table of units and a footnote defining the measure (DA-31).
// Every question is built so that misreading any bar by 1 minute does not change the answer.

import type { Rng } from '../../../engine/rng';
import { num, usd } from '../../../engine/tex';
import type { BarChartFigure, Choice, Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { nearestIndex } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.work-time-bars';

interface Item {
  name: string;
  unit: string;
  units: string;
  pound: boolean;
}

const ITEMS: Item[] = [
  { name: 'Bread', unit: 'loaf', units: 'loaves', pound: false },
  { name: 'Milk', unit: 'half-gallon', units: 'half-gallons', pound: false },
  { name: 'Eggs', unit: 'dozen', units: 'dozen', pound: false },
  { name: 'Coffee', unit: 'pound', units: 'pounds', pound: true },
  { name: 'Butter', unit: 'pound', units: 'pounds', pound: true },
  { name: 'Cheese', unit: 'pound', units: 'pounds', pound: true },
  { name: 'Apples', unit: 'pound', units: 'pounds', pound: true },
];

interface WorkData {
  years: [number, number];
  items: Item[];
  /** minutes[year][item] */
  minutes: [number[], number[]];
  figure: [BarChartFigure, TableFigure];
}

function makeWorkData(rng: Rng, d: Difficulty): WorkData {
  void d;
  const y1 = rng.pick([1980, 1985, 1990, 1995]);
  const years: [number, number] = [y1, y1 + rng.pick([25, 30])];
  for (;;) {
    const items = rng.sample(ITEMS, 5);
    if (!items.some((it) => it.pound)) continue;
    const m1 = items.map(() => rng.int(8, 44));
    const m2 = m1.map((m) => Math.max(3, Math.round(m * (0.45 + rng.next() * 0.5))));
    if (new Set(m1).size < 5 || new Set(m2).size < 5) continue;
    if (m1.some((m, k) => m - m2[k] < 3)) continue;
    const bar: BarChartFigure = {
      kind: 'bar',
      title: `MINUTES OF WORK NEEDED TO BUY SELECTED FOOD ITEMS, ${years[0]} AND ${years[1]}`,
      categories: items.map((it) => it.name),
      series: [
        { name: `${years[0]}`, values: m1 },
        { name: `${years[1]}`, values: m2 },
      ],
      yLabel: 'Minutes of work',
      yMin: 0,
      yMax: 50,
      yStep: 5,
    };
    const table: TableFigure = {
      kind: 'table',
      headers: ['Item', 'Quantity'],
      rows: items.map((it) => [it.name, `1 ${it.unit}`]),
      note: 'Minutes of work needed to buy an item = (price of the item ÷ average hourly wage) × 60, using the price and the wage of the same year.',
    };
    return { years, items, minutes: [m1, m2], figure: [bar, table] };
  }
}

/** "3 loaves of bread", "2 dozen eggs". */
const qty = (it: Item, k: number) => `${k} ${k === 1 ? it.unit : it.units}${it.unit === 'dozen' ? '' : ' of'} ${it.name.toLowerCase()}`;

function readMinutes(q: QuestionBody): [number[], number[]] {
  const bar = (q.figure as [BarChartFigure, TableFigure])[0];
  return [bar.series[0].values, bar.series[1].values];
}

/** True when the nearest choice stays the same if each bar used is misread by up to 1 minute. */
function robust(choices: number[], f: (m: [number[], number[]]) => number, base: [number[], number[]], used: [0 | 1, number][]): boolean {
  const want = nearestIndex(choices, f(base));
  if (want < 0) return false;
  const deltas = used.map(() => [-1, 0, 1]);
  const combos = deltas.reduce<number[][]>((acc, ds) => acc.flatMap((a) => ds.map((x) => [...a, x])), [[]]);
  for (const c of combos) {
    const m: [number[], number[]] = [base[0].slice(), base[1].slice()];
    used.forEach(([y, i], k) => (m[y][i] += c[k]));
    const v = f(m);
    const idx = nearestIndex(choices, v);
    if (idx !== want) return false;
    // also require a clear margin
    const sorted = choices.map((x) => Math.abs(x - v)).sort((a, b) => a - b);
    if (sorted[1] - sorted[0] < 1e-6) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ D1. Which purchase took longest (MCS) */

interface LongestParams {
  year: 0 | 1;
  mults: number[];
}

const longest: Template<LongestParams> = {
  id: 'data.interpretation.worktime-longest',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'compare quantities read from a paired bar graph after scaling each bar',
  generate(rng, d) {
    const D = makeWorkData(rng, d);
    const year: 0 | 1 = rng.chance(0.5) ? 0 : 1;
    const m = D.minutes[year];
    let mults: number[] = [];
    for (let t = 0; t < 400; t++) {
      mults = D.items.map(() => rng.int(1, d === 1 ? 3 : 5));
      const prods = m.map((x, k) => x * mults[k]);
      const w = prods.indexOf(Math.max(...prods));
      // Robust to misreading: the winner stays ahead even with every bar off by 1 minute.
      const safe = prods.every((p, k) => k === w || prods[w] - mults[w] > p + mults[k]);
      const tallest = m.indexOf(Math.max(...m));
      if (safe && tallest !== w) break;
      if (t > 300 && safe) break;
    }
    const prods = m.map((x, k) => x * mults[k]);
    const w = prods.indexOf(Math.max(...prods));
    const tallest = m.indexOf(Math.max(...m));
    const phrase = (k: number) => qty(D.items[k], mults[k]);
    const choices: Choice[] = D.items.map((_, k) => ({ text: phrase(k).replace(/^./, (c) => c.toUpperCase()), ...(k === tallest && k !== w ? { trap: 'prob-di-per-unit' } : {}) }));
    const lines = D.items.map((_, k) => `- ${phrase(k)}: $${mults[k]} \\times ${m[k]} = ${prods[k]}$ minutes`).join('\n');
    return {
      params: { year, mults },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `In ${D.years[year]}, which of the following took the greatest number of minutes of work to buy?`,
        choices,
        answer: w,
        explanation: `Read the ${D.years[year]} bars and multiply each by the quantity:

${lines}

The greatest is ${phrase(w)}.${tallest !== w ? ` The tallest bar (${D.items[tallest].name.toLowerCase()}) is for a single ${D.items[tallest].unit}; the quantities change the comparison.` : ''}`,
      },
    };
  },
  check(q, { year, mults }) {
    const m = readMinutes(q)[year];
    const prods = m.map((x, k) => x * mults[k]);
    const w = prods.indexOf(Math.max(...prods));
    return q.format === 'mcs' && q.answer === w ? null : `expected ${w}`;
  },
};

/* ------------------------------------------------------------------ D2. Price from the wage (MCS) */

interface PriceParams {
  year: 0 | 1;
  i: number;
  wage: number;
  values: number[];
}

const priceFromWage: Template<PriceParams> = {
  id: 'data.interpretation.worktime-price',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'invert a footnote definition to find a price (closest to)',
  generate(rng, d) {
    const D = makeWorkData(rng, d);
    for (let t = 0; ; t++) {
      const year: 0 | 1 = rng.chance(0.5) ? 0 : 1;
      const i = rng.int(0, 4);
      const wage = year === 0 ? rng.pick([6, 8, 9, 10, 12]) : rng.pick([15, 18, 20, 24, 30]);
      const mins = D.minutes[year][i];
      const price = (mins / 60) * wage;
      const step = price < 4 ? 0.5 : price < 10 ? 1 : 2;
      const R = Math.round(price / step) * step;
      const vals = new Set<number>([R]);
      const other = (D.minutes[1 - year][i] / 60) * wage;
      const trapV = Math.round(other / step) * step;
      if (trapV > 0) vals.add(trapV);
      for (const k of rng.shuffle([1, -1, 2, -2, 3, 4])) if (vals.size < 5 && R + k * step > 0) vals.add(R + k * step);
      const values = [...vals].sort((a, b) => a - b);
      const f = (m: [number[], number[]]) => (m[year][i] / 60) * wage;
      if ((values.length < 5 && t < 1000) || (!robust(values, f, D.minutes, [[year, i]]) && t < 300)) continue;
      const choices: Choice[] = values.map((v) => ({ text: usd(v, 2), ...(v === trapV && v !== R ? { trap: 'prob-di-wrong-column' } : {}) }));
      const it = D.items[i];
      return {
        params: { year, i, wage, values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `If the average hourly wage in ${D.years[year]} was ${usd(wage, 2)}, which of the following is closest to the price of ${qty(it, 1)} in ${D.years[year]}?`,
          choices,
          answer: values.indexOf(R),
          explanation: `From the footnote, price = $\\frac{\\text{minutes}}{60} \\times \\text{wage}$. The ${D.years[year]} bar for ${it.name.toLowerCase()} is at about ${mins} minutes, so the price was about $\\frac{${mins}}{60} \\times ${num(wage)} \\approx ${usd(Math.round(price * 100) / 100, 2)}$, closest to ${usd(R, 2)}.

Reading the ${D.years[1 - year]} bar instead gives about ${usd(Math.round(other * 100) / 100, 2)}.`,
        },
      };
    }
  },
  check(q, { year, i, wage, values }) {
    const price = (readMinutes(q)[year][i] / 60) * wage;
    const idx = nearestIndex(values, price);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ D3. Hours for a quantity in other units (MCS) */

interface ConvParams {
  i: number;
  kg: number;
  values: number[];
}

const conversion: Template<ConvParams> = {
  id: 'data.interpretation.worktime-conversion',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'hours of work for a quantity given in another unit (conversion supplied)',
  generate(rng, d) {
    const D = makeWorkData(rng, d);
    const pounds = D.items.map((it, k) => (it.pound ? k : -1)).filter((k) => k >= 0);
    for (let t = 0; ; t++) {
      const i = rng.pick(pounds);
      const kg = rng.pick([5, 10, 15, 20]);
      const mins = D.minutes[1][i];
      const h = (mins * kg * 2.2) / 60;
      const step = h < 5 ? 0.5 : h < 12 ? 1 : 2;
      const R = Math.round(h / step) * step;
      const vals = new Set<number>([R]);
      const noConv = Math.round((mins * kg) / 60 / step) * step;
      const divConv = Math.round((mins * kg) / 2.2 / 60 / step) * step;
      if (noConv > 0) vals.add(noConv);
      if (divConv > 0) vals.add(divConv);
      for (const k of rng.shuffle([1, -1, 2, 3, -2, 4])) if (vals.size < 5 && R + k * step > 0) vals.add(R + k * step);
      const values = [...vals].sort((a, b) => a - b);
      const f = (m: [number[], number[]]) => (m[1][i] * kg * 2.2) / 60;
      if ((values.length < 5 && t < 1000) || (!robust(values, f, D.minutes, [[1, i]]) && t < 300)) continue;
      const it = D.items[i];
      const fmt = (v: number) => `${num(v)}`;
      const choices: Choice[] = values.map((v) => ({
        text: fmt(v),
        ...(v !== R && (v === noConv || v === divConv) ? { trap: 'prob-di-unit-conversion' } : {}),
      }));
      return {
        params: { i, kg, values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `In ${D.years[1]}, approximately how many hours of work were needed to buy ${kg} kilograms of ${it.name.toLowerCase()}? (1 kilogram is approximately 2.2 pounds.)`,
          choices,
          answer: values.indexOf(R),
          explanation: `${kg} kilograms is about $${kg} \\times 2.2 = ${num(kg * 2.2)}$ pounds. In ${D.years[1]}, 1 pound took about ${mins} minutes, so ${num(kg * 2.2)} pounds took about $${num(kg * 2.2)} \\times ${mins} = ${num(Math.round(kg * 2.2 * mins * 10) / 10)}$ minutes, which is $\\frac{${num(Math.round(kg * 2.2 * mins * 10) / 10)}}{60} \\approx ${num(Math.round(h * 10) / 10)}$ hours, closest to ${num(R)}.

Skipping the conversion (treating kilograms as pounds) gives about ${num(Math.round(((mins * kg) / 60) * 10) / 10)} hours.`,
        },
      };
    }
  },
  check(q, { i, kg, values }) {
    const h = (readMinutes(q)[1][i] * kg * 2.2) / 60;
    const idx = nearestIndex(values, h);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ D4. How many more units for fixed hours (MCS) */

interface MoreParams {
  i: number;
  hours: number;
  values: number[];
}

const moreUnits: Template<MoreParams> = {
  id: 'data.interpretation.worktime-more-units',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'difference of two quotients: how many more units the same work buys',
  generate(rng, d) {
    const D = makeWorkData(rng, d);
    for (let t = 0; ; t++) {
      const i = rng.int(0, 4);
      const hours = rng.pick([4, 6, 8, 10, 20, 40]);
      const [a, b] = [D.minutes[0][i], D.minutes[1][i]];
      const diff = (hours * 60) / b - (hours * 60) / a;
      const step = diff < 6 ? 1 : diff < 20 ? 2 : diff < 60 ? 5 : 10;
      const R = Math.round(diff / step) * step;
      const vals = new Set<number>([R]);
      const wrong = Math.round((hours * 60) / (a - b) / step) * step;
      if (wrong > 0) vals.add(wrong);
      for (const k of rng.shuffle([1, -1, 2, -2, 3, 4])) if (vals.size < 5 && R + k * step > 0) vals.add(R + k * step);
      const values = [...vals].sort((x, y) => x - y);
      const f = (m: [number[], number[]]) => (hours * 60) / m[1][i] - (hours * 60) / m[0][i];
      if (((R <= 0 || values.length < 5) && t < 1000) || (!robust(values, f, D.minutes, [[0, i], [1, i]]) && t < 300)) continue;
      const it = D.items[i];
      const choices: Choice[] = values.map((v) => ({ text: `${num(v)}`, ...(v === wrong && v !== R ? { trap: 'prob-di-difference-of-quotients' } : {}) }));
      const q1 = (hours * 60) / a;
      const q2 = (hours * 60) / b;
      return {
        params: { i, hours, values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `With ${hours} hours of work, approximately how many more ${it.units}${it.unit === 'dozen' ? '' : ' of'} ${it.name.toLowerCase()} could be bought in ${D.years[1]} than in ${D.years[0]}?`,
          choices,
          answer: values.indexOf(R),
          explanation: `${hours} hours is ${hours * 60} minutes. In ${D.years[0]}, 1 ${it.unit} took about ${a} minutes, so $\\frac{${hours * 60}}{${a}} \\approx ${num(Math.round(q1 * 10) / 10)}$ ${it.units}; in ${D.years[1]}, about ${b} minutes, so $\\frac{${hours * 60}}{${b}} \\approx ${num(Math.round(q2 * 10) / 10)}$. Difference: about ${num(Math.round(diff * 10) / 10)}, closest to ${num(R)}.

Dividing ${hours * 60} by the difference of the bars ($${a} - ${b}$) is not the same as subtracting the two quotients.`,
        },
      };
    }
  },
  check(q, { i, hours, values }) {
    const [m1, m2] = readMinutes(q);
    const diff = (hours * 60) / m2[i] - (hours * 60) / m1[i];
    const idx = nearestIndex(values, diff);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

export const workTemplates: Template<any>[] = [longest, priceFromWage, conversion, moreUnits];
