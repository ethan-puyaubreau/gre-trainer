// Data interpretation family: a bar graph of yearly revenue (in billions) + a table of units sold
// by category written partly in billions and partly in millions (DA-34). Mixed units are the trap.

import { flaggedChoices, valuedChoices } from '../../../engine/build';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { BarChartFigure, Choice, Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { commas, mcmCheck, nearestIndex, spacedChoices } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.revenue-mixed-units';

const CATS = ['Cola', 'Lemonade', 'Iced tea', 'Sparkling water', 'Sports drinks', 'Juice', 'Coffee drinks', 'Energy drinks'];

interface MixedData {
  years: number[];
  revenue: number[];
  cats: string[];
  /** Units sold in millions. */
  units: number[];
  /** Total of all categories (listed and not listed), in millions (a multiple of 100). */
  total: number;
  figure: [BarChartFigure, TableFigure];
}

const kind = (c: string) => c.toLowerCase().replace(/ drinks$/, ' drink');
const unitText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} billion` : `${num(m).replace('{,}', ',')} million`);
const parseUnits = (s: string) => (s.includes('billion') ? Number(s.replace(/[^0-9.]/g, '')) * 1000 : Number(s.replace(/[^0-9.]/g, '')));

function makeMixedData(rng: Rng, d: Difficulty): MixedData {
  void d;
  for (;;) {
    const y0 = rng.int(2016, 2020);
    const years = [0, 1, 2, 3].map((k) => y0 + k);
    const revenue = [rng.int(4, 10) / 2];
    for (let k = 1; k < 4; k++) revenue.push(revenue[k - 1] + rng.int(1, 3) / 2);
    const cats = rng.sample(CATS, 6);
    const big = rng.sample([0, 1, 2, 3, 4, 5], 2);
    const units = cats.map((_, k) => (big.includes(k) ? rng.int(11, 32) * 100 : rng.int(4, 90) * 10));
    const listed = units.reduce((s, v) => s + v, 0);
    const rest0 = rng.int(400, 1400);
    const total = Math.ceil((listed + rest0) / 100) * 100;
    const rest = total - listed;
    const smaller = units.filter((u) => u < rest).length;
    if (smaller < 1 || smaller > 3) continue;
    if (units.some((u) => Math.abs(u - rest) < 40)) continue;
    // a billions entry whose number alone (e.g. "1.4") would look smaller than the rest: always true
    const bar: BarChartFigure = {
      kind: 'bar',
      title: `ANNUAL REVENUE OF BEVERAGE COMPANY M, ${years[0]} TO ${years[3]}`,
      categories: years.map(String),
      series: [{ name: 'Revenue', values: revenue }],
      yLabel: 'Billions of dollars',
      yMin: 0,
      yMax: Math.ceil(Math.max(...revenue) + 1),
      yStep: 1,
    };
    const table: TableFigure = {
      kind: 'table',
      title: `CONTAINERS SOLD BY COMPANY M IN ${years[3]}, BY CATEGORY`,
      headers: ['Category', 'Number of containers sold'],
      rows: [...cats.map((c, k) => [c, unitText(units[k])]), ['Total, all categories', unitText(total)]],
      note: '1 billion = 1,000 million. The total includes categories not listed in the table.',
    };
    return { years, revenue, cats, units, total, figure: [bar, table] };
  }
}

function readMixed(q: QuestionBody) {
  const [bar, table] = q.figure as [BarChartFigure, TableFigure];
  const rows = table.rows.map((r) => parseUnits(r[1]));
  return { revenue: bar.series[0].values, units: rows.slice(0, -1), total: rows[rows.length - 1] };
}

/* ------------------------------------------------------------------ M1. How many times (MCS, powers of ten) */

interface TimesParams {
  a: number;
  b: number;
  values: number[];
}

const timesMixed: Template<TimesParams> = {
  id: 'data.interpretation.mixed-times',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'ratio of two table entries written in different units (billions vs millions)',
  generate(rng, d) {
    const D = makeMixedData(rng, d);
    const bigs = D.units.map((u, k) => (u >= 1000 ? k : -1)).filter((k) => k >= 0);
    const smalls = D.units.map((u, k) => (u < 1000 ? k : -1)).filter((k) => k >= 0);
    const a = rng.pick(bigs);
    const b = rng.pick(smalls);
    const ratio = D.units[a] / D.units[b];
    // Round to 1 significant digit (2 if it starts with 1) and offer neighbors by powers of ten.
    const mag = 10 ** Math.floor(Math.log10(ratio));
    const lead = ratio / mag < 1.5 ? Math.round((ratio / mag) * 10) / 10 : Math.round(ratio / mag);
    const R = lead * mag;
    const first = -rng.int(0, 4);
    const powers = [0, 1, 2, 3, 4].map((k) => first + k);
    const values = powers.map((p) => Number((R * 10 ** p).toPrecision(3)));
    const fmt = (v: number) => (v >= 1 ? num(Math.round(v * 100) / 100) : String(Number(v.toPrecision(2))));
    const choices: Choice[] = values.map((v, k) => ({ text: `$${fmt(v)}$`, ...(powers[k] === -3 ? { trap: 'prob-di-thousands' } : {}) }));
    return {
      params: { a, b, values },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `In ${D.years[3]}, the number of ${kind(D.cats[a])} containers sold by Company M was approximately how many times the number of ${kind(D.cats[b])} containers sold?`,
        choices,
        answer: powers.indexOf(0),
        explanation: `Put both in millions: ${unitText(D.units[a])} = ${num(D.units[a])} million, and ${unitText(D.units[b])}. Ratio: $\\frac{${num(D.units[a])}}{${num(D.units[b])}} \\approx ${num(Math.round(ratio * 100) / 100)}$, closest to $${fmt(R)}$.

Dividing ${(D.units[a] / 1000).toFixed(1)} by ${num(D.units[b])} without converting billions to millions gives a number about 1,000 times too small.`,
      },
    };
  },
  check(q, { a, b, values }) {
    const { units } = readMixed(q);
    const ratio = units[a] / units[b];
    // nearest in the ratio sense (choices are powers of ten apart)
    const idx = nearestIndex(values.map((v) => Math.log10(v)), Math.log10(ratio));
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ M2. Interval of possible revenues (MCS) */

interface IntervalParams {
  c: number;
  p: number;
  lo: number;
  hi: number;
}

const intervalRevenue: Template<IntervalParams> = {
  id: 'data.interpretation.mixed-interval',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'range of possible totals from a percent of a count and a price range',
  generate(rng, d) {
    const D = makeMixedData(rng, d);
    const smalls = D.units.map((u, k) => (u < 1000 && u >= 100 ? k : -1)).filter((k) => k >= 0);
    const c = rng.pick(smalls.length ? smalls : [D.units.indexOf(Math.min(...D.units))]);
    const p = rng.pick([10, 20, 25, 40, 50]);
    const [lo, hi] = rng.pick([
      [0.5, 1],
      [0.5, 1.5],
      [1, 2],
      [1, 1.5],
      [1.5, 2.5],
    ]);
    const n = (D.units[c] * p) / 100; // millions of containers
    const L = n * lo;
    const H = n * hi;
    // Exact displays only: billions or millions with at most 2 decimals, otherwise whole dollars.
    const exact2 = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
    const money = (m: number) =>
      m >= 1000 && exact2(m / 1000)
        ? `\\$${commas(m / 1000)} billion`
        : m >= 1 && exact2(m)
          ? `\\$${commas(m)} million`
          : `\\$${commas(Math.round(m * 1e6))}`;
    const iv = (a: number, b: number) => `From ${money(a)} to ${money(b)}`;
    const cand: { a: number; b: number; trap?: string }[] = [
      { a: L, b: H },
      { a: D.units[c] * lo, b: D.units[c] * hi, trap: 'prob-missed-factor' },
      { a: L / 10, b: H / 10, trap: 'prob-percent-decimal' },
      { a: L * 10, b: H * 10, trap: 'prob-percent-decimal' },
      { a: L, b: D.units[c] * hi, trap: 'prob-missed-factor' },
      { a: L / 1000, b: H / 1000, trap: 'prob-di-thousands' },
      { a: L / 2, b: H / 2 },
      { a: L * 100, b: H * 100 },
      { a: L / 100, b: H / 100 },
    ];
    // Order the intervals by their lower end (then upper end); the answer's position is uniform.
    const vc = valuedChoices(
      rng,
      { text: iv(L, H), value: L + H * 1e-7 },
      cand.slice(1).map((x) => ({ text: iv(x.a, x.b), value: x.a + x.b * 1e-7, ...(x.trap ? { trap: x.trap } : {}) })),
    );
    const choices: Choice[] = vc.choices;
    return {
      params: { c, p, lo, hi },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `In ${D.years[3]}, ${p} percent of the ${kind(D.cats[c])} containers sold by Company M were sold at prices from \\$${lo.toFixed(2)} to \\$${hi.toFixed(2)} per container. Which of the following gives all possible values of the total revenue from the sale of those containers?`,
        choices,
        answer: vc.answer,
        explanation: `${p}% of ${unitText(D.units[c])} is $${num(n)}$ million containers. At the lowest price: $${num(n)} \\times ${lo} = ${num(L)}$ million dollars; at the highest: $${num(n)} \\times ${hi} = ${num(H)}$ million dollars. So the revenue was ${iv(L, H).toLowerCase()}.

Forgetting to take ${p}% of the containers gives revenues ${num(100 / p)} times too large.`,
      },
    };
  },
  check(q, { c, p, lo, hi }) {
    const { units } = readMixed(q);
    const n = units[c] * (p / 100);
    if (q.format !== 'mcs') return 'format';
    // Parse each interval back to millions and find the matching one.
    const parse = (s: string) =>
      [...s.matchAll(/\\\$([0-9.,]+)( million| billion)?/g)].map((m) => Number(m[1].replace(/,/g, '')) * (m[2] === ' billion' ? 1000 : m[2] === ' million' ? 1 : 1e-6));
    const idx = q.choices.findIndex((ch) => {
      const [a, b] = parse(ch.text);
      return Math.abs(a - n * lo) < 1e-6 && Math.abs(b - n * hi) < 1e-6;
    });
    return idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ M3. Percent increase on the bar graph (MCS) */

interface GrowthParams {
  from: number;
  to: number;
  values: number[];
}

const revenueGrowth: Template<GrowthParams> = {
  id: 'data.interpretation.mixed-growth',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'approximate percent increase read from a bar graph',
  generate(rng, d) {
    const D = makeMixedData(rng, d);
    const [from, to] = d === 1 ? [0, 3] : rng.pick([
      [0, 3],
      [0, 2],
      [1, 3],
    ] as [number, number][]);
    const r = D.revenue;
    const exact = ((r[to] - r[from]) / r[from]) * 100;
    const step = 10;
    const R = Math.round(exact / 5) * 5;
    const g = (x: number) => Math.round(x / 5) * 5;
    const sc = spacedChoices(
      rng,
      R,
      [
        { v: g(((r[to] - r[from]) / r[to]) * 100), trap: 'prob-percent-wrong-base' },
        { v: g((r[to] / r[from]) * 100), trap: 'prob-percent-ratio-as-change' },
      ],
      { step, min: 5, format: (v) => `${v}%` },
    );
    return {
      params: { from, to, values: sc.values },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `Approximately what was the percent increase in Company M's annual revenue from ${D.years[from]} to ${D.years[to]}?`,
        choices: sc.choices,
        answer: sc.answer,
        explanation: `Read the bars: about \\$${r[from]} billion in ${D.years[from]} and \\$${r[to]} billion in ${D.years[to]}. Increase: $\\frac{${r[to]} - ${r[from]}}{${r[from]}} \\times 100 \\approx ${Math.round(exact)}$%, closest to ${R}%.

Dividing by the ${D.years[to]} value uses the wrong base.`,
      },
    };
  },
  check(q, { from, to, values }) {
    const { revenue } = readMixed(q);
    const idx = nearestIndex(values, ((revenue[to] - revenue[from]) / revenue[from]) * 100);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ M4. Categories smaller than the unlisted ones (MCM) */

const smallerThanRest: Template<Record<string, never>> = {
  id: 'data.interpretation.mixed-select',
  skill: SKILL,
  set: SET,
  format: 'mcm',
  style: 'select every category below a derived amount (total minus listed, mixed units)',
  generate(rng, d) {
    const D = makeMixedData(rng, d);
    void rng;
    const listed = D.units.reduce((s, v) => s + v, 0);
    const rest = D.total - listed;
    const { choices, answer } = flaggedChoices(
      D.cats.map((c, k) => ({ text: c, correct: D.units[k] < rest, ...(D.units[k] >= 1000 ? { trap: 'prob-di-thousands' } : {}) })),
    );
    const parts = D.units.map((u) => num(u)).join(' + ');
    return {
      params: {},
      q: {
        format: 'mcm',
        figure: D.figure,
        stem: `Which of the following categories had fewer containers sold in ${D.years[3]} than all the categories not listed in the table combined?`,
        instruction: 'Indicate all such categories.',
        choices,
        answer,
        explanation: `Convert everything to millions. Listed categories: $${parts} = ${num(listed)}$ million. Total: ${unitText(D.total)} = ${num(D.total)} million. Not listed: $${num(D.total)} - ${num(listed)} = ${num(rest)}$ million.

The categories with fewer than ${num(rest)} million containers are ${D.cats.filter((_, k) => D.units[k] < rest).join(', ')}. An entry such as ${unitText(Math.max(...D.units))} is ${num(Math.max(...D.units))} million, far more.`,
      },
    };
  },
  check(q) {
    const { units, total } = readMixed(q);
    const rest = total - units.reduce((s, v) => s + v, 0);
    return mcmCheck(q, units.map((u) => u < rest));
  },
};

export const mixedTemplates: Template<any>[] = [timesMixed, intervalRevenue, revenueGrowth, smallerThanRest];
