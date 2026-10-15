// Data interpretation family: a table of counts (categories × seasons) (DA-36): parts of cells,
// least spread by eye, closest mean of a row, percent increase between two columns.

import { frac, Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Choice, Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { nearestIndex, neCheckNum, roundFrac, trapChoicesOrPad, trapOnlyChoices } from './util';

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
    // the fraction question needs three rows per season whose count splits into whole parts (halves ... fifths)
    const splits = (s: number) => cells.filter((r) => r[s] >= 8 && [2, 3, 4, 5].some((b) => r[s] % b === 0)).length;
    if (splits(1) < 3 || splits(2) < 3) continue;
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
    const vals = FR_CHOICES.map(([a, b]) => a / b);
    const ftext = ([a, b]: [number, number]) => `$\\frac{${a}}{${b}}$`;
    const nearestFr = (x: number) => nearestIndex(vals, x);
    for (let t = 0; ; t++) {
      const season = rng.pick([1, 2]);
      const rowsUsed = rng.sample([0, 1, 2, 3, 4, 5].filter((k) => D.cells[k][season] >= 8), 3);
      if (rowsUsed.length < 3) continue;
      const opts = rowsUsed.map((k) => ([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [2, 5], [3, 5], [1, 5]] as [number, number][]).filter(([, b]) => D.cells[k][season] % b === 0));
      if (opts.some((o) => !o.length)) continue; // every part must be a whole number of items, and never a part like 1/1
      const parts = opts.map((o) => rng.pick(o));
      const amounts = rowsUsed.map((k, j) => frac(D.cells[k][season] * parts[j][0], parts[j][1]));
      const total = rowsUsed.reduce((s, k) => s + D.cells[k][season], 0);
      const share = amounts.reduce((s, a) => s.add(a), frac(0)).div(total);
      const idx = nearestFr(share.toNumber());
      if (idx < 0) continue;
      const dists = vals.map((v) => Math.abs(v - share.toNumber())).sort((a, b) => a - b);
      if (dists[1] - dists[0] < 0.03 && t < 300) continue;
      // Each wrong choice is the fraction nearest to the result of one mistake.
      const nums = parts.map(([a, b]) => a / b);
      const other = season === 1 ? 2 : 1;
      const otherTotal = rowsUsed.reduce((s, k) => s + D.cells[k][other], 0);
      const otherShare = rowsUsed.reduce((s, k, j) => s + (D.cells[k][other] * parts[j][0]) / parts[j][1], 0) / otherTotal;
      const allTotal = D.cells.reduce((s, r) => s + r[season], 0);
      const mk = (x: number, trap: string, why: (s: string) => string) => {
        const k = nearestFr(x);
        return k < 0 ? null : { k, value: frac(FR_CHOICES[k][0], FR_CHOICES[k][1]), trap, why };
      };
      const traps = rng.shuffle(
        [
          mk(nums.reduce((s, x) => s + x, 0) / 3, 'prob-di-average-of-averages', (s) => `averaging the three fractions gives ${s}, but the ${D.ctx.unit} are not split evenly among the three ${D.ctx.group}`),
          ...nums.map((x, j) => mk(x, 'prob-di-one-fraction', (s) => `${s} is only the fraction taken from ${D.rows[rowsUsed[j]]}: the other two ${D.ctx.group} count too`)),
          mk(Math.max(...nums), 'prob-di-one-fraction', (s) => `the greatest of the three fractions is ${s}, but the other two ${D.ctx.group} matter too`),
          mk(Math.min(...nums), 'prob-di-one-fraction', (s) => `the least of the three fractions is ${s}, but the other two ${D.ctx.group} matter too`),
          mk(otherShare, 'prob-di-wrong-column', (s) => `using the ${SEASONS[other].toLowerCase()} totals instead gives ${s}`),
          mk(amounts.reduce((s, a) => s.add(a), frac(0)).toNumber() / allTotal, 'prob-di-wrong-total', (s) => `dividing by the total of all six ${D.ctx.group} gives ${s}, but the total is for the three ${D.ctx.group} named`),
          mk(1 - share.toNumber(), 'prob-wrong-event', (s) => `${s} is the fraction that did not happen in that month`),
        ].filter((x): x is NonNullable<typeof x> => x !== null && x.k !== idx),
      );
      // last resort: the estimate rounded to a neighbouring fraction
      const neighbours = [1, -1, 2, -2, 3, -3]
        .filter((o) => idx + o >= 0 && idx + o < FR_CHOICES.length)
        .map((o) => mk(vals[idx + o], 'prob-di-rounding', (s) => `${s} is a neighbouring fraction: the estimate was rounded the wrong way`))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const seenK = new Set<number>();
      const uniq = [...traps, ...neighbours].filter((x) => (seenK.has(x.k) ? false : (seenK.add(x.k), true)));
      const built = trapOnlyChoices(rng, frac(FR_CHOICES[idx][0], FR_CHOICES[idx][1]), uniq, (v) => ftext([v.n, v.d]), 5, 0, 'ends');
      if (!built) {
        if (t < 400) continue;
        throw new Error('season-fraction: no choices');
      }
      const cite = rng.pick(built.used);
      const values = built.values.map((v) => [v.n, v.d] as [number, number]);
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
          choices: built.choices,
          answer: built.answer,
          explanation: `In ${month}: ${rowsUsed.map((k, j) => `$\\frac{${parts[j][0]}}{${parts[j][1]}} \\times ${D.cells[k][season]} = ${num(amounts[j])}$`).join(', ')}; together $${num(amounts.reduce((s, a) => s.add(a), frac(0)))}$. The ${season0} total for the three is $${rowsUsed.map((k) => D.cells[k][season]).join(' + ')} = ${total}$. The fraction is about $${(share.toNumber()).toFixed(2)}$, closest to $\\frac{${FR_CHOICES[idx][0]}}{${FR_CHOICES[idx][1]}}$.

Check: $\\frac{${FR_CHOICES[idx][0]}}{${FR_CHOICES[idx][1]}} \\times ${total} \\approx ${num(Math.round((vals[idx] * total) * 10) / 10)}$, near ${num(amounts.reduce((s, a) => s.add(a), frac(0)))}.

Trap: ${cite.why(ftext([cite.value.n, cite.value.d]))}.

Add the amounts first, then divide by the combined total of the same three ${D.ctx.group}.`,
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
    // four tempting rows, each from one wrong rule; a rule that finds a row already taken takes its next best row
    const rest = [0, 1, 2, 3, 4, 5].filter((k) => k !== D.flat);
    const taken = new Set<number>();
    const lures: { k: number; trap: string; why: string }[] = [];
    const lure = (order: number[], trap: string, why: (k: number) => string) => {
      const k = order.find((x) => !taken.has(x))!;
      taken.add(k);
      lures.push({ k, trap, why: why(k) });
    };
    const byMean = [...rest].sort((a, b) => means[a] - means[b]);
    const cellsOf = (k: number) => D.cells[k].join(', ');
    lure(byMean, 'prob-di-sd-size', (k) => `${D.rows[k]} (${cellsOf(k)}) has the smallest numbers, but small numbers can still be far from their own mean`);
    lure([...byMean].reverse(), 'prob-di-sd-size', (k) => `${D.rows[k]} (${cellsOf(k)}) has the greatest numbers, but large numbers can still be far from their own mean`);
    lure([...rest].sort((a, b) => Math.abs(D.cells[a][0] - D.cells[a][3]) - Math.abs(D.cells[b][0] - D.cells[b][3])), 'prob-di-sd-two-values', (k) => `${D.rows[k]} (${cellsOf(k)}) looks steady if only winter and fall are compared, but spring and summer differ a lot from them`);
    lure([...rest].sort((a, b) => Math.abs(D.cells[a][1] - D.cells[a][2]) - Math.abs(D.cells[b][1] - D.cells[b][2])), 'prob-di-sd-two-values', (k) => `${D.rows[k]} (${cellsOf(k)}) looks steady if only spring and summer are compared, but winter and fall differ a lot from them`);
    const rowsShown = [D.flat, ...lures.map((l) => l.k)].sort((a, b) => a - b);
    const cite = rng.pick(lures);
    const choices: Choice[] = rowsShown.map((k) => ({ text: D.rows[k], ...(k === D.flat ? {} : { trap: lures.find((l) => l.k === k)!.trap }) }));
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

Check: ${D.rows[D.flat]} differs from its mean by at most ${Math.ceil(Math.max(...f) - Math.min(...f))} in any season; every other row has a much wider range.

Trap: ${cite.why}.

Judge spread by how far the numbers are from their mean, all four of them.`,
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
      const sum = r.reduce((s, v) => s + v, 0);
      const nonzero = r.filter((v) => v > 0);
      const sortedR = [...r].sort((a, b) => a - b);
      const median = (sortedR[1] + sortedR[2]) / 2;
      const mk = (x: number, trap: string, why: (s: string) => string) => ({ value: g(x), trap, why });
      const traps = rng.shuffle([
        ...(nonzero.length < 4 ? [mk(sum / nonzero.length, 'prob-di-wrong-divisor', (s) => `dividing by the ${nonzero.length} nonzero seasons gives ${s}, but the seasons with 0 count too`)] : []),
        mk(sum / 3, 'prob-di-wrong-divisor', (s) => `dividing by 3 seasons gives ${s}, but there are 4`),
        mk(sum, 'prob-di-no-divide', (s) => `${s} is the total of the four seasons, not their average`),
        mk(median, 'stat-mean-is-median', (s) => `the middle of the four numbers is ${s}, but the mean uses every number`),
        mk(Math.max(...r), 'prob-di-range', (s) => `${s} is the greatest season, not the average`),
        mk((r[1] + r[2]) / 2, 'prob-di-wrong-column', (s) => `averaging only spring and summer gives ${s}`),
        mk((r[0] + r[3]) / 2, 'prob-di-wrong-column', (s) => `averaging only winter and fall gives ${s}`),
        ...[0, 1, 2, 3, 4, 5]
          .filter((k) => k !== row)
          .map((k) => mk(D.cells[k].reduce((a, b) => a + b, 0) / 4, 'prob-di-wrong-column', (s) => `reading the ${D.rows[k]} row instead gives ${s}`)),
      ]).filter((x) => x.value >= step);
      const built = trapChoicesOrPad(rng, R, traps, { step, minGap: step, min: step, pad: t >= 60, format: (v) => `${v}` });
      if (!built) continue;
      const cite = rng.pick(built.used.length ? built.used : traps);
      return {
        params: { row, values: built.values },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `The average (arithmetic mean) number of ${D.ctx.of(D.rows[row])} per season was closest to which of the following?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Add the four seasons and divide by 4: $\\frac{${r.join(' + ')}}{4} = \\frac{${sum}}{4} = ${num(mean)}$, closest to ${R}.${
            r.includes(0) ? ` The seasons with 0 still count: divide by 4, not by ${nonzero.length}.` : ''
          }

Check: four seasons at ${R} each make ${R * 4}, near the actual total of ${sum}.

Trap: ${cite.why(String(cite.value))}.

An average divides the total by the number of values, zeros included.`,
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
    const wrongOf = (c: { row: number; from: number; to: number }) => {
      const a0 = D.cells[c.row][c.from];
      const b0 = D.cells[c.row][c.to];
      return [roundFrac(frac(100 * (b0 - a0), b0), 0), frac(b0 - a0), roundFrac(frac(100 * b0, a0), 0)];
    };
    // a mistake that gives the answer is not a mistake: prefer rows where all of them differ
    const okCands = cands.filter((c) => !wrongOf(c).some((w) => w && w.eq(roundFrac(c.v, 0)!)));
    const { row, from, to, v } = rng.pick(okCands.length ? okCands : cands);
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

