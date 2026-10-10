// Data interpretation family: a table of counts (categories × seasons) (DA-36): parts of cells,
// least spread by eye, closest mean of a row, percent increase between two columns.

import { frac, Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Choice, Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { valuedChoices } from '../../../engine/build';
import { nearestIndex, neCheckNum, roundFrac, spacedChoices } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.season-table';
const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];

const CTXS = [
  {
    TITLE: 'NUMBER OF BIRDS COUNTED AT A WETLAND, BY SPECIES AND SEASON',
    rowHead: 'Species',
    group: 'species',
    rows: ['Heron', 'Egret', 'Mallard', 'Osprey', 'Plover', 'Kingfisher', 'Sandpiper'],
    unit: 'birds',
    of: (r: string) => `${r.toLowerCase()}s`,
    cell: (r: string, season: string) => `the ${season} count of ${r.toLowerCase()}s`,
    happened: (month: string) => `were counted in ${month}`,
    inMonth: (month: string) => `The number of these birds counted in ${month}`,
    total: (season: string) => `the total ${season} count for these three species`,
  },
  {
    TITLE: 'NUMBER OF GUIDED TOURS AT SIX PARKS, BY SEASON',
    rowHead: 'Park',
    group: 'parks',
    rows: ['Alder', 'Birch', 'Cedar', 'Dogwood', 'Elm', 'Fir', 'Gum'],
    unit: 'tours',
    of: (r: string) => `tours at ${r} Park`,
    cell: (r: string, season: string) => `the ${season} tours at ${r} Park`,
    happened: (month: string) => `took place in ${month}`,
    inMonth: (month: string) => `The number of these tours that took place in ${month}`,
    total: (season: string) => `the total number of ${season} tours at these three parks`,
  },
];

interface SeasonData {
  ctx: (typeof CTXS)[number];
  rows: string[];
  cells: number[][];
  /** Index of the row with the clearly least standard deviation. */
  flat: number;
  figure: TableFigure;
}

const sd = (xs: number[]) => {
  const m = xs.reduce((s, v) => s + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length);
};

function makeSeasonData(rng: Rng, d: Difficulty): SeasonData {
  void d;
  const ctx = CTXS[rng.int(0, CTXS.length - 1)];
  const nRows = 6;
  for (;;) {
    const rows = rng.sample(ctx.rows, nRows);
    const cells: number[][] = [];
    const flat = rng.int(0, nRows - 1);
    const zeroRow = rng.pick([0, 1, 2, 3, 4, 5].filter((k) => k !== flat));
    for (let k = 0; k < nRows; k++) {
      if (k === flat) {
        const base = rng.int(30, 80);
        cells.push(SEASONS.map(() => base + rng.int(-3, 3)));
      } else if (k === zeroRow) {
        cells.push(SEASONS.map((_, s) => (s === 0 || s === 3 ? 0 : rng.int(40, 110))));
      } else {
        const base = rng.int(15, 90);
        cells.push(SEASONS.map(() => Math.max(4, base + rng.int(-30, 40))));
      }
    }
    const sds = cells.map(sd);
    const sorted = [...sds].sort((a, b) => a - b);
    if (sds[flat] !== sorted[0] || sorted[1] < 3 * sorted[0] + 3) continue;
    // A smaller-valued row that is not the flattest (a natural distractor).
    const means = cells.map((r) => r.reduce((s, v) => s + v, 0) / 4);
    if (means.indexOf(Math.min(...means)) === flat) continue;
    const figure: TableFigure = {
      kind: 'table',
      title: ctx.TITLE,
      headers: [ctx.rowHead, ...SEASONS],
      rows: rows.map((r, k) => [r, ...cells[k].map(String)]),
    };
    return { ctx, rows, cells, flat, figure };
  }
}

function readCells(q: QuestionBody): number[][] {
  return (q.figure as TableFigure).rows.map((r) => r.slice(1).map(Number));
}

/* ------------------------------------------------------------------ E1. Fraction of a combined total (MCS) */

interface PartParams {
  season: number;
  rowsUsed: number[];
  parts: [number, number][];
  values: [number, number][];
}

const FR_CHOICES: [number, number][] = [
  [1, 5],
  [1, 4],
  [1, 3],
  [2, 5],
  [1, 2],
  [3, 5],
  [2, 3],
  [3, 4],
];

const fractionOfTotal: Template<PartParams> = {
  id: 'data.interpretation.season-fraction',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'fractions of several cells as a fraction of their combined total',
  generate(rng, d) {
    const D = makeSeasonData(rng, d);
    for (let t = 0; ; t++) {
      const season = rng.pick([1, 2]);
      const rowsUsed = rng.sample([0, 1, 2, 3, 4, 5].filter((k) => D.cells[k][season] >= 8), 3);
      if (rowsUsed.length < 3) continue;
      const opts = rowsUsed.map((k) => ([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [2, 5], [3, 5], [1, 5]] as [number, number][]).filter(([, b]) => D.cells[k][season] % b === 0));
      if (opts.some((o) => !o.length) && t < 2000) continue;
      const parts = opts.map((o) => (o.length ? rng.pick(o) : ([1, 1] as [number, number])));
      const amounts = rowsUsed.map((k, j) => frac(D.cells[k][season] * parts[j][0], parts[j][1]));
      const total = rowsUsed.reduce((s, k) => s + D.cells[k][season], 0);
      const share = amounts.reduce((s, a) => s.add(a), frac(0)).div(total);
      const vals = FR_CHOICES.map(([a, b]) => a / b);
      const idx = nearestIndex(vals, share.toNumber());
      if (idx < 0) continue;
      const dists = vals.map((v) => Math.abs(v - share.toNumber())).sort((a, b) => a - b);
      if (dists[1] - dists[0] < 0.03 && t < 300) continue;
      const avgParts = parts.reduce((s, [a, b]) => s + a / b, 0) / 3;
      const trapIdx = nearestIndex(vals, avgParts);
      // The answer at a uniform random position; the averaged-fractions trap first, then the nearest fractions.
      const ftext = ([a, b]: [number, number]) => `$\\frac{${a}}{${b}}$`;
      const others = FR_CHOICES.map((fr, k) => ({ fr, k }))
        .filter(({ k }) => k !== idx)
        .sort((x, y) => (x.k === trapIdx ? -1 : y.k === trapIdx ? 1 : Math.abs(x.k - idx) - Math.abs(y.k - idx)));
      const vc = valuedChoices(
        rng,
        { text: ftext(FR_CHOICES[idx]), value: vals[idx] },
        others.map(({ fr, k }) => ({ text: ftext(fr), value: vals[k], ...(k === trapIdx ? { trap: 'prob-di-average-of-averages' } : {}) })),
      );
      const choices: Choice[] = vc.choices;
      const values = vc.choices.map((c) => FR_CHOICES.find((fr) => ftext(fr) === c.text)!);
      const season0 = SEASONS[season].toLowerCase();
      const month = season === 1 ? 'April' : 'July';
      const partText = rowsUsed.map((k, j) => `$\\frac{${parts[j][0]}}{${parts[j][1]}}$ of ${D.ctx.cell(D.rows[k], season0)}`);
      const listText = `${partText.slice(0, 2).join(', ')}, and ${partText[2]}`;
      return {
        params: { season, rowsUsed, parts, values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `Suppose that ${listText} ${D.ctx.happened(month)}. ${D.ctx.inMonth(month)} was approximately what fraction of ${D.ctx.total(season0)}?`,
          choices,
          answer: vc.answer,
          explanation: `In ${month}: ${rowsUsed.map((k, j) => `$\\frac{${parts[j][0]}}{${parts[j][1]}} \\times ${D.cells[k][season]} = ${num(amounts[j])}$`).join(', ')}; together $${num(amounts.reduce((s, a) => s.add(a), frac(0)))}$. The ${season0} total for the three is $${rowsUsed.map((k) => D.cells[k][season]).join(' + ')} = ${total}$. The fraction is about $${(share.toNumber()).toFixed(2)}$, closest to $\\frac{${FR_CHOICES[idx][0]}}{${FR_CHOICES[idx][1]}}$.

Averaging the three fractions ignores that the ${D.ctx.unit} are not split evenly among the three ${D.ctx.group}.`,
        },
      };
    }
  },
  check(q, { season, rowsUsed, parts, values }) {
    const cells = readCells(q);
    const inPart = rowsUsed.reduce((s, k, j) => s + (cells[k][season] * parts[j][0]) / parts[j][1], 0);
    const total = rowsUsed.reduce((s, k) => s + cells[k][season], 0);
    const idx = nearestIndex(values.map(([a, b]) => a / b), inPart / total);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ E2. Least standard deviation (MCS) */

interface SdParams {
  rowsShown: number[];
}

const leastSpread: Template<SdParams> = {
  id: 'data.interpretation.season-least-sd',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'which row has the least standard deviation (judge spread by eye)',
  generate(rng, d) {
    const D = makeSeasonData(rng, d);
    const means = D.cells.map((r) => r.reduce((s, v) => s + v, 0) / 4);
    const smallest = means.indexOf(Math.min(...means));
    const others = [0, 1, 2, 3, 4, 5].filter((k) => k !== D.flat && k !== smallest);
    const rowsShown = [D.flat, smallest, ...rng.sample(others, 3)].sort((a, b) => a - b);
    const choices: Choice[] = rowsShown.map((k) => ({ text: D.rows[k], ...(k === smallest ? { trap: 'prob-di-sd-size' } : {}) }));
    const f = D.cells[D.flat];
    return {
      params: { rowsShown },
      q: {
        format: 'mcs',
        figure: D.figure,
        stem: `For which of the following ${D.ctx.group} is the standard deviation of the four seasonal numbers the least?`,
        choices,
        answer: rowsShown.indexOf(D.flat),
        explanation: `Standard deviation measures how spread out the numbers are around their mean, not how large they are. The ${D.rows[D.flat]} row (${f.join(', ')}) stays within a few units of its mean in every season, while each of the other rows varies a lot. So ${D.rows[D.flat]} has the least standard deviation; no computation is needed.

${D.rows[smallest]} has the smallest numbers, but they are spread out more.`,
      },
    };
  },
  check(q, { rowsShown }) {
    const cells = readCells(q);
    const sds = rowsShown.map((k) => sd(cells[k]));
    const best = sds.indexOf(Math.min(...sds));
    return q.format === 'mcs' && q.answer === best ? null : `expected ${best}`;
  },
};

/* ------------------------------------------------------------------ E3. Mean of a row (MCS, closest to) */

interface MeanParams {
  row: number;
  values: number[];
}

const rowMean: Template<MeanParams> = {
  id: 'data.interpretation.season-mean',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'average of a row of a table (closest to)',
  generate(rng, d) {
    const D = makeSeasonData(rng, d);
    for (let t = 0; ; t++) {
      const row = rng.int(0, 5);
      const r = D.cells[row];
      const mean = r.reduce((s, v) => s + v, 0) / 4;
      const step = 5;
      const R = Math.round(mean / step) * step;
      if (Math.abs(mean - R) > 1.5 && t < 100) continue;
      const g = (v: number) => Math.round(v / step) * step;
      const nonzero = r.filter((v) => v > 0);
      const trapC: { v: number; trap?: string }[] = [];
      if (nonzero.length < 4) trapC.push({ v: g(nonzero.reduce((s, v) => s + v, 0) / nonzero.length), trap: 'prob-di-wrong-divisor' });
      trapC.push({ v: g(r.reduce((s, v) => s + v, 0) / 3), trap: 'prob-di-wrong-divisor' });
      const { choices, answer, values } = spacedChoices(rng, R, trapC, { step, min: step, format: (v) => `${v}` });
      const sum = r.reduce((s, v) => s + v, 0);
      return {
        params: { row, values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `The average (arithmetic mean) number of ${D.ctx.of(D.rows[row])} per season was closest to which of the following?`,
          choices,
          answer,
          explanation: `Add the four seasons and divide by 4: $\\frac{${r.join(' + ')}}{4} = \\frac{${sum}}{4} = ${num(mean)}$, closest to ${R}.${
            r.includes(0) ? ` The seasons with 0 still count: divide by 4, not by ${nonzero.length}.` : ''
          }`,
        },
      };
    }
  },
  check(q, { row, values }) {
    const r = readCells(q)[row];
    const idx = nearestIndex(values, r.reduce((s, v) => s + v, 0) / r.length);
    return q.format === 'mcs' && idx === q.answer ? null : `expected ${idx}`;
  },
};

/* ------------------------------------------------------------------ E4. Percent increase between two columns (NE) */

interface IncParams {
  row: number;
  from: number;
  to: number;
}

const percentIncrease: Template<IncParams> = {
  id: 'data.interpretation.season-percent-increase',
  skill: SKILL,
  set: SET,
  format: 'ne',
  style: 'percent increase between two cells, to the nearest whole percent',
  generate(rng, d) {
    const D = makeSeasonData(rng, d);
    const cands: { row: number; from: number; to: number; v: Frac }[] = [];
    for (let row = 0; row < 6; row++)
      for (let from = 0; from < 3; from++)
        for (let to = from + 1; to < 4; to++) {
        if (d < 3 && to !== from + 1) continue;
        const a = D.cells[row][from];
        const b = D.cells[row][to];
        if (a > 0 && b > a) {
          const v = frac(100 * (b - a), a);
          if (roundFrac(v, 0)) cands.push({ row, from, to, v });
        }
        }
    const { row, from, to, v } = rng.pick(cands);
    const answer = roundFrac(v, 0)!;
    const a = D.cells[row][from];
    const b = D.cells[row][to];
    const traps: { value: Frac; trap: string }[] = [];
    const wrongBase = roundFrac(frac(100 * (b - a), b), 0);
    if (wrongBase) traps.push({ value: wrongBase, trap: 'prob-percent-wrong-base' });
    traps.push({ value: frac(b - a), trap: 'prob-count-as-percent' });
    const ratio = roundFrac(frac(100 * b, a), 0);
    if (ratio) traps.push({ value: ratio, trap: 'prob-percent-ratio-as-change' });
    return {
      params: { row, from, to },
      q: {
        format: 'ne',
        figure: D.figure,
        stem: `For ${D.ctx.rowHead === 'Species' ? `the ${D.rows[row].toLowerCase()}s` : `${D.rows[row]} Park`}, what was the percent increase from ${SEASONS[from].toLowerCase()} to ${SEASONS[to].toLowerCase()}?\n\nGive your answer to the nearest whole percent.`,
        answer,
        suffix: '%',
        traps: traps.filter((t) => !t.value.eq(answer)),
        explanation: `Percent increase = $\\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100 = \\frac{${b} - ${a}}{${a}} \\times 100 \\approx ${num(Math.round(v.toNumber() * 10) / 10)}$, which rounds to ${num(answer)}%.

Dividing by ${b} (the new value) uses the wrong base, and $\\frac{${b}}{${a}} \\times 100$ is the new value as a percent of the old one, not the increase.`,
      },
    };
  },
  check(q, { row, from, to }) {
    const r = readCells(q)[row];
    return neCheckNum(q, Math.round(((r[to] - r[from]) / r[from]) * 100), 1e-9);
  },
};

export const seasonTemplates: Template<any>[] = [fractionOfTotal, leastSpread, rowMean, percentIncrease];

