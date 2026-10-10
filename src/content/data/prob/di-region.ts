// Data interpretation family: a circle graph of a worldwide total by region + a bar graph of the
// countries of one region, whose total is given (DA-35). The worldwide total is not given: it
// has to be derived from the region's total and its percent.

import { flaggedChoices } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { BarChartFigure, Difficulty, PieChartFigure, QuestionBody, Template } from '../../../engine/types';
import { mcmCheck, mcsCheck, nearestIndex, spacedChoices } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.region-pie-bar';

const FOCUS: Record<string, string[]> = {
  Europe: ['Germany', 'France', 'Italy', 'Spain', 'Poland', 'Sweden'],
  Asia: ['Japan', 'India', 'Korea', 'Vietnam', 'Thailand', 'Malaysia'],
};
const OTHERS = ['North America', 'Latin America', 'Africa'];
const CTXS = [
  { org: 'Company Z', who: 'customers', WHO: 'CUSTOMERS', TITLE: 'CUSTOMERS OF COMPANY Z, BY REGION' },
  { org: 'App Q', who: 'registered users', WHO: 'REGISTERED USERS', TITLE: 'REGISTERED USERS OF APP Q, BY REGION' },
];

interface RegionData {
  org: string;
  who: string;
  focus: string;
  /** Pie: [focus, other1, other2, 'Other regions'] percents. */
  regions: string[];
  pcts: number[];
  /** Worldwide total and focus total, in millions. */
  W: number;
  T: number;
  countries: string[];
  values: number[];
  figure: [PieChartFigure, BarChartFigure];
}

function makeRegionData(rng: Rng, d: Difficulty): RegionData {
  void d;
  const ctx = CTXS[rng.int(0, CTXS.length - 1)];
  const focus = rng.pick(Object.keys(FOCUS));
  const others = rng.sample(OTHERS, 2);
  for (;;) {
    const W = rng.pick([200, 300, 400, 500, 600, 800]);
    const big = rng.chance(0.5);
    const pF = rng.int(15, 35);
    const p1 = big ? rng.int(51, 62) : rng.int(20, 45);
    if (100 - pF - p1 < 15) continue;
    const p2 = rng.int(8, 100 - pF - p1 - 5);
    const p3 = 100 - pF - p1 - p2;
    if (p3 < 5) continue;
    const pcts = [pF, p1, p2, p3];
    if (new Set(pcts).size < 4) continue;
    const T = (W * pF) / 100;
    if (!Number.isInteger(T) || T < 30) continue;
    // Four countries with integer values; the rest of the region is at least 10% of T.
    const rest = rng.int(Math.ceil(T * 0.12), Math.floor(T * 0.3));
    const shown = T - rest;
    const values: number[] = [];
    let left = shown;
    for (let k = 0; k < 3; k++) {
      const v = rng.int(Math.max(2, Math.round(left * 0.15)), Math.round(left * 0.45));
      values.push(v);
      left -= v;
    }
    values.push(left);
    if (values.some((v) => v < 2) || new Set(values).size < 4 || Math.max(...values) > 0.6 * T) continue;
    const countries = rng.sample(FOCUS[focus], 4);
    const regions = [focus, ...others, 'Other regions'];
    const pie: PieChartFigure = {
      kind: 'pie',
      title: `${ctx.TITLE}, 2023`,
      slices: regions.map((r, k) => ({ label: r, value: pcts[k] })),
    };
    const maxV = Math.max(...values);
    const yStep = maxV <= 20 ? 5 : maxV <= 50 ? 10 : maxV <= 100 ? 20 : 50;
    const bar: BarChartFigure = {
      kind: 'bar',
      title: `${ctx.WHO} IN ${focus.toUpperCase()}, BY COUNTRY, 2023 (TOTAL FOR ${focus.toUpperCase()}: ${T} MILLION)`,
      categories: countries,
      series: [{ name: ctx.who, values }],
      yLabel: `Millions of ${ctx.who}`,
      yMin: 0,
      yMax: Math.ceil((maxV + yStep / 2) / yStep) * yStep,
      yStep,
      showValues: true,
    };
    return { org: ctx.org, who: ctx.who, focus, regions, pcts, W, T, countries, values, figure: [pie, bar] };
  }
}

function readRegion(q: QuestionBody) {
  const [pie, bar] = q.figure as [PieChartFigure, BarChartFigure];
  const T = Number((bar.title ?? '').match(/: (\d+) MILLION/)![1]);
  return { pcts: pie.slices.map((s) => s.value), values: bar.series[0].values, T };
}

const mil = (v: number) => `${num(v)} million`;

/* ------------------------------------------------------------------ C1. Percent of the region outside the shown countries (MCS) */

interface OtherParams {
  values: number[];
}

const otherPercent: Template<OtherParams> = {
  id: 'data.interpretation.region-other-percent',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'percent of a total not covered by the bars shown',
  generate(rng, d) {
    const D = makeRegionData(rng, d);
    const shown = D.values.reduce((s, v) => s + v, 0);
    const rest = D.T - shown;
    const exact = (rest / D.T) * 100;
    const r = Math.round(exact);
    const { choices, answer, values } = spacedChoices(
      rng,
      r,
      [
        { v: Math.round((shown / D.T) * 100), trap: 'prob-wrong-event' },
        { v: Math.round((rest / D.W) * 100), trap: 'prob-di-wrong-total' },
        { v: rest, trap: 'prob-count-as-percent' },
      ],
      { step: 5, minGap: 3, min: 1, max: 99, format: (v) => `${v}%` },
    );
    return {
      params: { values },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `Approximately what percent of the ${D.who} in ${D.focus} were in countries other than the four shown in the bar graph?`,
        choices,
        answer,
        explanation: `The four countries shown account for $${D.values.join(' + ')} = ${shown}$ million of the ${D.T} million ${D.who} in ${D.focus}. The rest: $${D.T} - ${shown} = ${rest}$ million, which is $\\frac{${rest}}{${D.T}} \\approx ${num(Math.round(exact * 10) / 10)}$%, about ${r}%.

The base is the ${D.focus} total (${D.T} million), not the worldwide total.`,
      },
    };
  },
  check(q, { values }) {
    const { values: bars, T } = readRegion(q);
    const exact = ((T - bars.reduce((s, v) => s + v, 0)) / T) * 100;
    const idx = nearestIndex(values, exact);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ C2. Range of the bars (MCS) */

interface RangeParams {
  ask: 'range' | 'difference';
  a: number;
  b: number;
}

const barRange: Template<RangeParams> = {
  id: 'data.interpretation.region-range',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'range of the values in a bar graph, or the difference of two bars',
  generate(rng, d) {
    const D = makeRegionData(rng, d);
    const ask: RangeParams['ask'] = d === 1 ? 'range' : rng.pick(['range', 'difference'] as const);
    const v = D.values;
    const maxV = Math.max(...v);
    const minV = Math.min(...v);
    let a = v.indexOf(maxV);
    let b = v.indexOf(minV);
    let correct: number;
    const traps: { v: number; trap: string }[] = [];
    let stem: string;
    let explanation: string;
    if (ask === 'range') {
      correct = maxV - minV;
      stem = `What is the range of the numbers of ${D.who} in the four countries shown in the bar graph?`;
      traps.push({ v: maxV, trap: 'prob-di-range' }, { v: maxV - v.slice().sort((x, y) => y - x)[1], trap: 'prob-di-range' });
      explanation = `Range = greatest $-$ least: ${D.countries[a]} has the most (${mil(maxV)}) and ${D.countries[b]} the fewest (${mil(minV)}), so the range is $${maxV} - ${minV} = ${correct}$ million.`;
    } else {
      [a, b] = rng.sample([0, 1, 2, 3], 2);
      if (v[a] < v[b]) [a, b] = [b, a];
      correct = v[a] - v[b];
      stem = `In 2023, how many more ${D.who} were there in ${D.countries[a]} than in ${D.countries[b]}?`;
      traps.push({ v: v[a] + v[b], trap: 'prob-wrong-event' }, { v: v[a], trap: 'prob-di-wrong-column' });
      explanation = `Read the two bars: ${D.countries[a]}, ${mil(v[a])}; ${D.countries[b]}, ${mil(v[b])}. Difference: $${v[a]} - ${v[b]} = ${correct}$ million.`;
    }
    const { choices, answer } = spacedChoices(rng, correct, traps, { step: 2, minGap: 1, min: 1, format: mil });
    return {
      params: { ask, a, b },
      q: { format: 'mcs', figure: D.figure, stem, choices, answer, explanation },
    };
  },
  check(q, { ask, a, b }) {
    const { values } = readRegion(q);
    const expected = ask === 'range' ? Math.max(...values) - Math.min(...values) : values[a] - values[b];
    return mcsCheck(q, mil(expected));
  },
};

/* ------------------------------------------------------------------ C3. How many times (MCS) */

interface TimesParams {
  c: number;
  r: number;
  values: number[];
}

const howManyTimes: Template<TimesParams> = {
  id: 'data.interpretation.region-times',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'a region from the circle graph (via the derived worldwide total) compared with one bar',
  generate(rng, d) {
    const D = makeRegionData(rng, d);
    // Pick a country and another region whose ratio sits close to a multiple of the choice step.
    const stepOf = (x: number) => (x < 6 ? 1 : x < 15 ? 2 : x < 40 ? 5 : 10);
    const pairs: { c: number; r: number; ratio: number }[] = [];
    for (let c = 0; c < 4; c++)
      for (let r = 1; r < 3; r++) {
        const ratio = (D.W * D.pcts[r]) / 100 / D.values[c];
        const st = stepOf(ratio);
        if (ratio >= 1.7 && Math.abs(ratio / st - Math.round(ratio / st)) < 0.3) pairs.push({ c, r, ratio });
      }
    const pick = pairs.length ? rng.pick(pairs) : (() => {
      const c = D.values.indexOf(Math.min(...D.values));
      return { c, r: 1, ratio: (D.W * D.pcts[1]) / 100 / D.values[c] };
    })();
    const { c, r, ratio } = pick;
    const st = stepOf(ratio);
    const R = Math.max(st, Math.round(ratio / st) * st);
    const regionCount = (D.W * D.pcts[r]) / 100;
    const g = (v: number) => Math.round(v / st) * st;
    const { choices, answer, values } = spacedChoices(
      rng,
      R,
      [
        { v: g(D.pcts[r] / D.values[c]), trap: 'prob-percent-not-count' },
        { v: g((D.T * D.pcts[r]) / 100 / D.values[c]), trap: 'prob-di-wrong-total' },
      ],
      { step: st, min: st > 1 ? st : 1, format: (v) => `${v}` },
    );
    return {
      params: { c, r, values },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `In 2023, the number of ${D.who} of ${D.org} in ${D.regions[r]} was approximately how many times the number of ${D.who} in ${D.countries[c]}?`,
        choices,
        answer,
        explanation: `First find the worldwide total: ${D.focus} had ${D.T} million ${D.who}, which is ${D.pcts[0]}% of the total, so the total was $\\frac{${D.T}}{${frac(D.pcts[0], 100).toNumber()}} = ${D.W}$ million. ${D.regions[r]} had ${D.pcts[r]}% of that: $${frac(D.pcts[r], 100).toNumber()} \\times ${D.W} = ${num(regionCount)}$ million.

${D.countries[c]} had ${D.values[c]} million, so the ratio is $\\frac{${num(regionCount)}}{${D.values[c]}} ${Number.isInteger(ratio) ? '=' : '\\approx'} ${num(Math.round(ratio * 100) / 100)}$${ratio === R ? '' : `, closest to ${R}`}.

Applying ${D.pcts[r]}% to the ${D.focus} total (${D.T} million) instead of the worldwide total is the trap.`,
      },
    };
  },
  check(q, { c, r, values }) {
    const { pcts, values: bars, T } = readRegion(q);
    const W = T / (pcts[0] / 100);
    const ratio = (W * (pcts[r] / 100)) / bars[c];
    const idx = nearestIndex(values, ratio);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ C4. Must be true (MCM) */

type RegStmt =
  | { kind: 'majority'; r: number }
  | { kind: 'lumped'; k: number }
  | { kind: 'pair-share'; a: number; b: number; num: number; den: number }
  | { kind: 'world-over'; x: number };

interface RegMustParams {
  stmts: RegStmt[];
}

const FRACS: [number, number, string][] = [
  [1, 3, 'one-third'],
  [1, 2, 'one-half'],
  [2, 5, 'two-fifths'],
  [1, 4, 'one-fourth'],
  [3, 5, 'three-fifths'],
];

const regionMust: Template<RegMustParams> = {
  id: 'data.interpretation.region-must',
  skill: SKILL,
  set: SET,
  format: 'mcm',
  style: 'which statements must be true (majority, a lumped category, parts of a total)',
  generate(rng, d) {
    const D = makeRegionData(rng, d);
    const items: { s: RegStmt; text: string; truth: boolean; trap?: string; why: string }[] = [];
    // Majority sector.
    const top = D.pcts.indexOf(Math.max(...D.pcts));
    const restPct = 100 - D.pcts[top];
    items.push({
      s: { kind: 'majority', r: top },
      text: `${D.org} had more ${D.who} in ${D.regions[top]} than in all the other regions combined.`,
      truth: D.pcts[top] > 50,
      ...(D.pcts[top] > 50 ? {} : { trap: 'prob-di-largest-not-majority' }),
      why: `${D.regions[top]} is ${D.pcts[top]}% of the total and the others are ${restPct}% combined${D.pcts[top] > 50 ? ', so it has more.' : ', so it does not.'}`,
    });
    // Lumped category: individual countries are unknown.
    const shown = D.values.reduce((s, v) => s + v, 0);
    const rest = D.T - shown;
    const k = Math.max(1, Math.floor(rest / 2));
    items.push({
      s: { kind: 'lumped', k },
      text: `At least one country in ${D.focus} other than the four shown had more than ${k} million ${D.who}.`,
      truth: false,
      trap: 'prob-di-lumped-category',
      why: `The ${rest} million ${D.who} in the other countries of ${D.focus} could be spread over many countries with fewer than ${k} million each; the graphs do not say.`,
    });
    // Two bars vs a fraction of the region total.
    const [a, b] = rng.sample([0, 1, 2, 3], 2);
    const share = (D.values[a] + D.values[b]) / D.T;
    const fr = FRACS.filter(([n, dd]) => Math.abs(share - n / dd) > 0.04);
    const [fn, fd, fname] = rng.pick(fr.length ? fr : FRACS);
    items.push({
      s: { kind: 'pair-share', a, b, num: fn, den: fd },
      text: `${D.countries[a]} and ${D.countries[b]} together accounted for more than ${fname} of the ${D.who} in ${D.focus}.`,
      truth: share > fn / fd,
      why: `$${D.values[a]} + ${D.values[b]} = ${D.values[a] + D.values[b]}$ million, and ${fname} of ${D.T} million is $${num(Math.round((D.T * fn * 100) / fd) / 100)}$ million, so the statement is ${share > fn / fd ? 'true' : 'false'}.`,
    });
    // Worldwide total.
    const over = rng.chance(0.5);
    const x = over ? D.W - rng.pick([20, 40, 50]) : D.W + rng.pick([20, 40, 50]);
    items.push({
      s: { kind: 'world-over', x },
      text: `${D.org} had more than ${x} million ${D.who} worldwide in 2023.`,
      truth: D.W > x,
      why: `${D.focus}'s ${D.T} million is ${D.pcts[0]}% of the total, so the total is $${D.T} \\div ${frac(D.pcts[0], 100).toNumber()} = ${D.W}$ million, which is ${D.W > x ? 'more' : 'less'} than ${x} million.`,
    });
    const n = d === 3 ? 4 : 3;
    const trues = items.filter((c) => c.truth);
    const falses = items.filter((c) => !c.truth);
    if (!trues.length) {
      // make the worldwide statement true
      const w = items[3];
      w.s = { kind: 'world-over', x: D.W - 50 };
      w.text = `${D.org} had more than ${D.W - 50} million ${D.who} worldwide in 2023.`;
      w.truth = true;
      w.why = `${D.focus}'s ${D.T} million is ${D.pcts[0]}% of the total, so the total is $${D.T} \\div ${frac(D.pcts[0], 100).toNumber()} = ${D.W}$ million, which is more than ${D.W - 50} million.`;
    }
    const T2 = items.filter((c) => c.truth);
    const F2 = items.filter((c) => !c.truth);
    void trues;
    void falses;
    const t = rng.int(Math.max(1, n - F2.length), Math.min(T2.length, n - 1));
    const chosen = rng.shuffle([...rng.sample(T2, t), ...rng.sample(F2, n - t)]);
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
        explanation: chosen.map((c, i) => `- ${String.fromCharCode(65 + i)}: ${c.truth ? 'true' : 'not necessarily true'}. ${c.why}`).join('\n'),
      },
    };
  },
  check(q, { stmts }, rng) {
    const { pcts, values, T } = readRegion(q);
    const W = T / (pcts[0] / 100);
    const rest = T - values.reduce((s, v) => s + v, 0);
    const truth = stmts.map((s) => {
      switch (s.kind) {
        case 'majority':
          return pcts[s.r] > 100 - pcts[s.r];
        case 'lumped': {
          // Split the rest among many countries in random ways: the claim must hold for every split.
          for (let t = 0; t < 50; t++) {
            const parts = Math.max(1, Math.ceil(rest / Math.max(1, s.k)) + rng.int(0, 3));
            const each = rest / parts;
            if (!(each > s.k)) return false;
          }
          return true;
        }
        case 'pair-share':
          return (values[s.a] + values[s.b]) * s.den > T * s.num;
        case 'world-over':
          return W > s.x + 1e-9;
      }
    });
    return mcmCheck(q, truth);
  },
};

export const regionTemplates: Template<any>[] = [otherPercent, barRange, howManyTimes, regionMust];
