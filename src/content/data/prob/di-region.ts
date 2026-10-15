// Data interpretation family: a circle graph of a worldwide total by region + a bar graph of the
// countries of one region, whose total is given (DA-35). The worldwide total is not given: it
// has to be derived from the region's total and its percent.

import { flaggedChoices } from '../../../engine/build';
import { frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { BarChartFigure, Difficulty, PieChartFigure, QuestionBody, Template } from '../../../engine/types';
import { mcmCheck, mcsCheck, nearestIndex, trapChoicesOrPad } from './util';

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
    const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: Math.round(x), trap, why });
    const traps = rng.shuffle([
      mk((shown / D.T) * 100, 'prob-wrong-event', (s) => `${s}% is the part covered by the four countries shown, the opposite of what is asked`),
      mk((rest / D.W) * 100, 'prob-di-wrong-total', (s) => `dividing by the worldwide total gives ${s}%, but the question is about ${D.focus}`),
      mk(rest, 'prob-count-as-percent', (s) => `${s} is the number of millions left over, not a percent`),
      mk((rest / shown) * 100, 'prob-percent-wrong-base', (s) => `dividing by the four countries shown gives ${s}%, but the base is the ${D.focus} total`),
      mk(D.pcts[0], 'prob-di-wrong-total', (s) => `${s}% is the share of ${D.focus} in the circle graph, not the share of the countries not shown`),
      mk(100 - D.pcts[0], 'prob-di-wrong-total', (s) => `${s}% is the share of the other regions in the circle graph`),
      mk((Math.max(...D.values) / D.T) * 100, 'prob-di-lumped-category', (s) => `${s}% is the share of the largest country shown, not of the countries not shown`),
      mk((rest / D.W) * 100 * (D.pcts[0] / 100) * 4, 'prob-di-wrong-total', (s) => `taking the share of the countries not shown inside the ${D.pcts[0]}% of the circle graph gives ${s}%`),
      mk((rest / (D.W - D.T)) * 100, 'prob-di-wrong-total', (s) => `dividing by everyone outside ${D.focus} gives ${s}%, but the base is the ${D.focus} total`),
      mk((Math.min(...D.values) / D.T) * 100, 'prob-di-lumped-category', (s) => `${s}% is the share of the smallest country shown, not of the countries not shown`),
      mk((rest / D.T) * 50, 'prob-half-count', (s) => `halving the share gives ${s}%`),
    ]).filter((t) => t.value >= 1 && t.value <= 99);
    const built = trapChoicesOrPad(rng, r, traps, { step: 5, minGap: 3, min: 1, max: 99, pad: true, ends: true, format: (v) => `${v}%` });
    if (!built) throw new Error('region-other-percent: no choices');
    const cite = rng.pick(built.used.length ? built.used : traps);
    return {
      params: { values: built.values },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `Approximately what percent of the ${D.who} in ${D.focus} were in countries other than the four shown in the bar graph?`,
        choices: built.choices,
        answer: built.answer,
        explanation: `The four countries shown account for $${D.values.join(' + ')} = ${shown}$ million of the ${D.T} million ${D.who} in ${D.focus}. The rest: $${D.T} - ${shown} = ${rest}$ million, which is $\\frac{${rest}}{${D.T}} \\approx ${num(Math.round(exact * 10) / 10)}$%, about ${r}%.

Check: ${r}% of ${D.T} million is about ${num(Math.round((r * D.T) / 10) / 10)} million, near the ${rest} million left.

Trap: ${cite.why(String(cite.value))}.

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
    const v = D.values;
    const sortedDesc = v.slice().sort((x, y) => y - x);
    const maxV = sortedDesc[0];
    const minV = sortedDesc[3];
    const shown = v.reduce((s, x) => s + x, 0);
    for (let tries = 0; ; tries++) {
      const ask: RangeParams['ask'] = d === 1 ? 'range' : rng.pick(['range', 'difference'] as const);
      let a = v.indexOf(maxV);
      let b = v.indexOf(minV);
      let correct: number;
      let stem: string;
      let explanation: string;
      let check: string;
      const traps: { value: number; trap: string; why: (s: string) => string }[] = [];
      const T = (value: number, trap: string, why: (s: string) => string) => traps.push({ value, trap, why });
      if (ask === 'range') {
        correct = maxV - minV;
        stem = `What is the range of the numbers of ${D.who} in the four countries shown in the bar graph?`;
        T(maxV, 'prob-di-range', (s) => `${s} million is the greatest value, not the range`);
        T(maxV - sortedDesc[1], 'prob-di-range', (s) => `subtracting the second greatest instead of the least gives ${s} million`);
        T(maxV - sortedDesc[2], 'prob-di-range', (s) => `subtracting the third greatest instead of the least gives ${s} million`);
        T(maxV + minV, 'prob-di-range', (s) => `adding the greatest and the least gives ${s} million instead of subtracting`);
        T(shown, 'prob-wrong-event', (s) => `${s} million is the total of the four countries, not their range`);
        T(D.T, 'prob-di-wrong-column', (s) => `${s} million is the total of ${D.focus} given in the title, not a range`);
        T(minV, 'prob-di-range', (s) => `${s} million is the least value, not the range`);
        T(sortedDesc[1] - sortedDesc[2], 'prob-di-range', (s) => `subtracting two values in the middle gives ${s} million`);
        T(sortedDesc[2] - minV, 'prob-di-range', (s) => `subtracting the least from the third greatest gives ${s} million`);
        T(sortedDesc[1] - minV, 'prob-di-range', (s) => `using the second greatest instead of the greatest gives ${s} million`);
        explanation = `Range = greatest $-$ least: ${D.countries[a]} has the most (${mil(maxV)}) and ${D.countries[b]} the fewest (${mil(minV)}), so the range is $${maxV} - ${minV} = ${correct}$ million.`;
        check = `the range cannot exceed the greatest value, ${maxV}, and $${maxV} - ${minV} = ${correct}$ does not.`;
      } else {
        [a, b] = rng.sample([0, 1, 2, 3], 2);
        if (v[a] < v[b]) [a, b] = [b, a];
        correct = v[a] - v[b];
        stem = `In 2023, how many more ${D.who} were there in ${D.countries[a]} than in ${D.countries[b]}?`;
        T(v[a] + v[b], 'prob-wrong-event', (s) => `adding the two bars gives ${s} million instead of subtracting`);
        T(v[a], 'prob-di-wrong-column', (s) => `${s} million is the ${D.countries[a]} bar alone`);
        T(v[b], 'prob-di-wrong-column', (s) => `${s} million is the ${D.countries[b]} bar alone`);
        for (const x of [0, 1, 2, 3]) {
          if (x === a || x === b) continue;
          T(Math.abs(v[a] - v[x]), 'prob-di-wrong-column', (s) => `reading ${D.countries[x]} instead of ${D.countries[b]} gives ${s} million`);
          T(Math.abs(v[x] - v[b]), 'prob-di-wrong-column', (s) => `reading ${D.countries[x]} instead of ${D.countries[a]} gives ${s} million`);
        }
        explanation = `Read the two bars: ${D.countries[a]}, ${mil(v[a])}; ${D.countries[b]}, ${mil(v[b])}. Difference: $${v[a]} - ${v[b]} = ${correct}$ million.`;
        check = `$${v[b]} + ${correct} = ${v[a]}$.`;
      }
      const built = trapChoicesOrPad(rng, correct, traps.filter((t) => t.value >= 1), { step: 2, minGap: 1, min: 1, pad: tries >= 40, format: mil });
      if (!built) continue;
      const cite = rng.pick(built.used.length ? built.used : traps);
      return {
        params: { ask, a, b },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem,
          choices: built.choices,
          answer: built.answer,
          explanation: `${explanation}

Check: ${check}

Trap: ${cite.why(String(cite.value))}.

${ask === 'range' ? 'The range is the difference between the greatest and the least value.' : '"How many more" is a difference, not a sum.'}`,
        },
      };
    }
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
    const fallback = (() => {
      const c = D.values.indexOf(Math.min(...D.values));
      return { c, r: 1, ratio: (D.W * D.pcts[1]) / 100 / D.values[c] };
    })();
    for (let tries = 0; ; tries++) {
      const { c, r, ratio } = pairs.length ? rng.pick(pairs) : fallback;
      const st = stepOf(ratio);
      const R = Math.max(st, Math.round(ratio / st) * st);
      const regionCount = (D.W * D.pcts[r]) / 100;
      const g = (v: number) => Math.round(v / st) * st;
      const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: g(x), trap, why });
      const traps = rng.shuffle([
        mk(D.pcts[r] / D.values[c], 'prob-percent-not-count', (s) => `dividing the percent ${D.pcts[r]} by ${D.values[c]} gives ${s}, but ${D.pcts[r]} is a percent, not a number of ${D.who}`),
        mk((D.T * D.pcts[r]) / 100 / D.values[c], 'prob-di-wrong-total', (s) => `taking ${D.pcts[r]}% of the ${D.focus} total gives ${s}, but the percent is of the worldwide total`),
        ...[0, 1, 2, 3]
          .filter((k) => k !== c)
          .map((k) => mk(regionCount / D.values[k], 'prob-di-wrong-column', (s) => `comparing with ${D.countries[k]} instead of ${D.countries[c]} gives ${s}`)),
        ...[1, 2, 3]
          .filter((k) => k !== r)
          .map((k) => mk(((D.W * D.pcts[k]) / 100) / D.values[c], 'prob-di-wrong-column', (s) => `using ${D.regions[k]} instead of ${D.regions[r]} gives ${s}`)),
        mk((D.W * D.pcts[0]) / 100 / D.values[c], 'prob-di-wrong-column', (s) => `using ${D.focus} itself gives ${s}`),
        mk(D.W / D.values[c], 'prob-di-wrong-column', (s) => `dividing the worldwide total by ${D.countries[c]} gives ${s}`),
        mk(D.values[c] / regionCount, 'prob-di-inverted', (s) => `dividing the country by the region gives ${s}, the reverse ratio`),
      ]).filter((t) => t.value >= (st > 1 ? st : 1));
      const built = trapChoicesOrPad(rng, R, traps, { step: st, minGap: st, min: st > 1 ? st : 1, pad: tries >= 60, ends: true, format: (v) => `${v}` });
      if (!built) continue;
      const cite = rng.pick(built.used.length ? built.used : traps);
      return {
        params: { c, r, values: built.values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `In 2023, the number of ${D.who} of ${D.org} in ${D.regions[r]} was approximately how many times the number of ${D.who} in ${D.countries[c]}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `First find the worldwide total: ${D.focus} had ${D.T} million ${D.who}, which is ${D.pcts[0]}% of the total, so the total was $\\frac{${D.T}}{${frac(D.pcts[0], 100).toNumber()}} = ${D.W}$ million. ${D.regions[r]} had ${D.pcts[r]}% of that: $${frac(D.pcts[r], 100).toNumber()} \\times ${D.W} = ${num(regionCount)}$ million.

${D.countries[c]} had ${D.values[c]} million, so the ratio is $\\frac{${num(regionCount)}}{${D.values[c]}} ${Number.isInteger(ratio) ? '=' : '\\approx'} ${num(Math.round(ratio * 100) / 100)}$${ratio === R ? '' : `, closest to ${R}`}.

Check: $${R} \\times ${D.values[c]} = ${num(R * D.values[c])}$ million, near the ${num(regionCount)} million of ${D.regions[r]}.

Trap: ${cite.why(String(cite.value))}.

A percent in a circle graph is a percent of the whole circle: derive the whole first.`,
        },
      };
    }
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
      ...(share > fn / fd ? {} : { trap: 'prob-di-fraction-of-total' }),
      why: `$${D.values[a]} + ${D.values[b]} = ${D.values[a] + D.values[b]}$ million, and ${fname} of ${D.T} million is $${num(Math.round((D.T * fn * 100) / fd) / 100)}$ million, so the statement is ${share > fn / fd ? 'true' : 'false'}.`,
    });
    // Worldwide total.
    const over = rng.chance(0.5);
    const x = over ? D.W - rng.pick([20, 40, 50]) : D.W + rng.pick([20, 40, 50]);
    items.push({
      s: { kind: 'world-over', x },
      text: `${D.org} had more than ${x} million ${D.who} worldwide in 2023.`,
      truth: D.W > x,
      ...(D.W > x ? {} : { trap: 'prob-di-wrong-total' }),
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
