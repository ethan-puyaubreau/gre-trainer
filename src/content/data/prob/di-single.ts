// Stand-alone data interpretation questions (not part of a set): a table with units in thousands
// (DA-03, DA-20) and a circle graph with a category removed or added (DA-12).

import { numericChoices } from '../../../engine/build';
import { frac, Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { PieChartFigure, TableFigure, Template } from '../../../engine/types';
import { mcsCheck, neCheckNum, roundFrac } from './util';

const SKILL = 'data.interpretation';

/* ------------------------------------------------------------------ X1. Table in thousands (NE) */

interface UnitsParams {
  kind: 'per-item' | 'actual-vs-projected' | 'sold-share' | 'top-cities';
  col: number;
  top: number;
  N: number;
}

const AUCTION = [
  { TITLE: 'ART AUCTION RESULTS', cols: ['Paintings', 'Sculptures'], sing: ['painting', 'sculpture'] },
  { TITLE: 'USED-EQUIPMENT AUCTION RESULTS', cols: ['Tractors', 'Trailers'], sing: ['tractor', 'trailer'] },
];
const CITIES = ['Alton', 'Brixby', 'Corwin', 'Dunmore', 'Eastvale', 'Fairhaven', 'Glenrock'];

const tableUnits: Template<UnitsParams> = {
  id: 'data.interpretation.table-units',
  skill: SKILL,
  format: 'ne',
  style: 'read a table whose entries are in thousands',
  generate(rng, d) {
    const kind: UnitsParams['kind'] = d === 1 ? rng.pick(['per-item', 'top-cities'] as const) : d === 2 ? rng.pick(['per-item', 'sold-share', 'top-cities'] as const) : rng.pick(['actual-vs-projected', 'top-cities', 'per-item'] as const);
    if (kind === 'top-cities') {
      // Five largest cities, populations in thousands; the country total is in the stem.
      const names = rng.sample(CITIES, 5);
      const pops = [rng.int(900, 2400)];
      for (let k = 1; k < 5; k++) pops.push(rng.int(Math.round(pops[k - 1] * 0.45), Math.round(pops[k - 1] * 0.9)));
      const top = d === 1 ? 2 : 3;
      let N = 0;
      let answer: Frac | null = null;
      for (let t = 0; t < 200 && !answer; t++) {
        N = rng.int(60, 400) * 100000;
        const v = frac(100 * 1000 * pops.slice(0, top).reduce((s, x) => s + x, 0), N);
        answer = v.toNumber() >= 2 ? roundFrac(v, 0) : null;
      }
      const sumTop = pops.slice(0, top).reduce((s, x) => s + x, 0);
      const sumAll = pops.reduce((s, x) => s + x, 0);
      const table: TableFigure = {
        kind: 'table',
        title: 'FIVE LARGEST CITIES OF COUNTRY X',
        headers: ['City', 'Population (in thousands)'],
        rows: names.map((n, k) => [n, num(pops[k]).replace('{,}', ',')]),
      };
      const traps: { value: Frac; trap: string }[] = [];
      const all = roundFrac(frac(100 * 1000 * sumAll, N), 0);
      if (all) traps.push({ value: all, trap: 'prob-di-wrong-column' });
      return {
        params: { kind, col: 0, top, N },
        q: {
          format: 'ne',
          figure: table,
          stem: `The population of Country X is ${N.toLocaleString('en-US')}. The combined population of the ${top} largest cities in the table was what percent of the population of Country X?\n\nGive your answer to the nearest whole percent.`,
          answer: answer!,
          suffix: '%',
          traps: traps.filter((t) => !t.value.eq(answer!)),
          explanation: `The table is in thousands: the ${top} largest cities have $${pops.slice(0, top).map((x) => num(x)).join(' + ')} = ${num(sumTop)}$ thousand, that is ${num(sumTop * 1000)} people. As a percent of ${num(N)}: $\\frac{${num(sumTop * 1000)}}{${num(N)}} \\times 100 \\approx ${num(Math.round((sumTop * 100000) / N * 10) / 10)}$, which rounds to ${num(answer!)}%.

Without the factor 1,000 you would get a percent close to 0; and only the ${top} largest cities count, not all five.`,
        },
      };
    }
    const ctx = rng.pick(AUCTION);
    let offered: number[];
    let sold: number[];
    let priceK: number[];
    let actual: number[];
    let projected: number[];
    // Avoid percents that end in exactly .5 (ambiguous rounding).
    const tie = (a: number, b: number) => roundFrac(frac(100 * a, b), 0) === null;
    do {
      offered = ctx.cols.map(() => rng.int(12, 60));
      sold = offered.map((o) => rng.int(Math.round(o * 0.4), o - 2));
      priceK = ctx.cols.map(() => rng.int(2, 18)); // thousands of dollars per item sold
      actual = sold.map((x, k) => x * priceK[k]);
      projected = actual.map((a) => Math.round((a * rng.int(105, 140)) / 100));
    } while ([0, 1].some((k) => tie(sold[k], offered[k]) || tie(actual[k], projected[k]) || tie(offered[k] - sold[k], offered[k])));
    const col = rng.int(0, 1);
    const table: TableFigure = {
      kind: 'table',
      title: ctx.TITLE,
      headers: ['', ...ctx.cols],
      rows: [
        ['Number offered', ...offered.map(String)],
        ['Number sold', ...sold.map(String)],
        ['Projected sales for all items offered (in thousands)', ...projected.map((v) => `\\$${num(v).replace('{,}', ',')}`)],
        ['Actual sales (in thousands)', ...actual.map((v) => `\\$${num(v).replace('{,}', ',')}`)],
      ],
    };
    const thing = ctx.sing[col];
    let stem: string;
    let answer: Frac;
    const traps: { value: Frac; trap: string }[] = [];
    let explanation: string;
    let prefix: string | undefined;
    let suffix: string | undefined;
    if (kind === 'per-item') {
      answer = frac(priceK[col] * 1000);
      prefix = '\\$';
      stem = `For the ${ctx.cols[col].toLowerCase()} that were sold, what was the average (arithmetic mean) sale price per ${thing}?`;
      traps.push({ value: frac(priceK[col]), trap: 'prob-di-thousands' });
      traps.push({ value: frac(actual[col] * 1000, offered[col]), trap: 'prob-di-wrong-column' });
      traps.push({ value: frac(projected[col] * 1000, sold[col]), trap: 'prob-di-wrong-column' });
      explanation = `Actual sales for ${ctx.cols[col].toLowerCase()}: \\$${num(actual[col])} thousand $= ${num(actual[col] * 1000)}$ dollars, for ${sold[col]} ${ctx.cols[col].toLowerCase()} sold. Average: $\\frac{${num(actual[col] * 1000)}}{${sold[col]}} = ${num(answer)}$.

Forgetting "(in thousands)" gives ${priceK[col]}; dividing by the number offered or using the projected sales answers a different question.`;
    } else if (kind === 'sold-share') {
      const v = frac(100 * sold[col], offered[col]);
      answer = roundFrac(v, 0) ?? v;
      suffix = '%';
      stem = `What percent of the ${ctx.cols[col].toLowerCase()} offered were sold?\n\nGive your answer to the nearest whole percent.`;
      traps.push({ value: roundFrac(frac(100 * (offered[col] - sold[col]), offered[col]), 0) ?? frac(0), trap: 'prob-wrong-event' });
      explanation = `$\\frac{${sold[col]}}{${offered[col]}} \\times 100 \\approx ${num(Math.round(v.toNumber() * 10) / 10)}$, which rounds to ${num(answer)}%.`;
    } else {
      const v = frac(100 * actual[col], projected[col]);
      answer = roundFrac(v, 0) ?? v;
      suffix = '%';
      stem = `For the ${ctx.cols[col].toLowerCase()}, the actual sales were what percent of the projected sales?\n\nGive your answer to the nearest whole percent.`;
      traps.push({ value: roundFrac(frac(100 * projected[col], actual[col]), 0) ?? frac(0), trap: 'prob-percent-wrong-base' });
      traps.push({ value: roundFrac(frac(100 * (projected[col] - actual[col]), projected[col]), 0) ?? frac(0), trap: 'prob-wrong-event' });
      explanation = `Both rows are in thousands, so the units cancel: $\\frac{${num(actual[col])}}{${num(projected[col])}} \\times 100 \\approx ${num(Math.round(v.toNumber() * 10) / 10)}$, which rounds to ${num(answer)}%.

$\\frac{${num(projected[col])}}{${num(actual[col])}}$ uses the wrong base.`;
    }
    return {
      params: { kind, col, top: 0, N: 0 },
      q: {
        format: 'ne',
        figure: table,
        stem,
        answer,
        ...(prefix ? { prefix } : {}),
        ...(suffix ? { suffix } : {}),
        traps: traps.filter((t) => t.value.sign() > 0 && !t.value.eq(answer)),
        explanation,
      },
    };
  },
  check(q, { kind, col, top, N }) {
    const t = q.figure as TableFigure;
    const val = (row: number) => Number(t.rows[row][col + 1].replace(/[^0-9]/g, ''));
    if (kind === 'top-cities') {
      const pops = t.rows.map((r) => Number(r[1].replace(/[^0-9]/g, '')) * 1000);
      return neCheckNum(q, Math.round((pops.slice(0, top).reduce((s, x) => s + x, 0) / N) * 100), 1e-9);
    }
    if (kind === 'per-item') return neCheckNum(q, (val(3) * 1000) / val(1), 1e-9);
    if (kind === 'sold-share') return neCheckNum(q, Math.round((val(1) / val(0)) * 100), 1e-9);
    return neCheckNum(q, Math.round((val(3) / val(2)) * 100), 1e-9);
  },
};

/* ------------------------------------------------------------------ X2. Circle graph: remove or add a category (MCS) */

interface PieParams {
  pcts: number[];
  removed: number;
  target: number;
  total: number;
  added: number;
}

const PIE_CTX = [
  { TITLE: 'BOOKS IN A LIBRARY COLLECTION, BY TYPE', labels: ['Fiction', 'Nonfiction', 'Reference'], items: 'books', of: (l: string) => `${l.toLowerCase()} books` },
  { TITLE: 'VEHICLES IN A COMPANY FLEET, BY TYPE', labels: ['Cars', 'Vans', 'Trucks'], items: 'vehicles', of: (l: string) => l.toLowerCase() },
  { TITLE: 'TREES IN A CITY PARK, BY KIND', labels: ['Oak', 'Maple', 'Pine'], items: 'trees', of: (l: string) => `${l.toLowerCase()} trees` },
];

const pieRemove: Template<PieParams> = {
  id: 'data.interpretation.pie-remove',
  skill: SKILL,
  format: 'mcs',
  style: 'circle graph: fraction of what remains after removing (or adding) a category',
  generate(rng, d) {
    const ctx = rng.pick(PIE_CTX);
    let pcts: number[];
    do {
      const a = rng.int(5, 12) * 5;
      const b = rng.int(3, 20 - a / 5 - 2) * 5;
      pcts = [a, b, 100 - a - b];
    } while (pcts.some((p) => p < 10) || new Set(pcts).size < 3);
    const removed = rng.int(0, 2);
    const target = rng.pick([0, 1, 2].filter((k) => k !== removed));
    const other = 3 - removed - target;
    const pie: PieChartFigure = { kind: 'pie', title: ctx.TITLE, slices: ctx.labels.map((l, k) => ({ label: l, value: pcts[k] })) };
    let correct: Frac;
    let stem: string;
    let explanation: string;
    const traps: { value: Frac; trap: string }[] = [];
    let total = 0;
    let added = 0;
    if (d === 3 && rng.chance(0.6)) {
      // Add a known number of items of one kind to a known total.
      total = rng.pick([200, 400, 500, 600, 800]);
      added = rng.pick([50, 100, 200]);
      const cnt = (pcts[target] * total) / 100;
      correct = frac(cnt + added, total + added);
      stem = `The circle graph shows the distribution of the ${total} ${ctx.items} by type. If ${added} more ${ctx.of(ctx.labels[target])} are added and nothing else changes, what fraction of all the ${ctx.items} will be ${ctx.of(ctx.labels[target])}?`;
      traps.push({ value: frac(cnt + added, total), trap: 'prob-stale-total' }, { value: frac(pcts[target], 100), trap: 'prob-di-wrong-total' });
      explanation = `${ctx.labels[target]}: ${pcts[target]}% of ${total} is ${num(cnt)}. After adding ${added}: $${num(cnt)} + ${added} = ${num(cnt + added)}$ out of $${total} + ${added} = ${total + added}$, so the fraction is $\\frac{${num(cnt + added)}}{${total + added}} = ${correct.toTex()}$.

The total grows too: dividing by ${total} forgets the ${added} new ${ctx.items}.`;
    } else {
      correct = frac(pcts[target], 100 - pcts[removed]);
      stem = `The circle graph shows the distribution of a collection of ${ctx.items} by type. If all the ${ctx.of(ctx.labels[removed])} are removed from the collection, what fraction of the remaining ${ctx.items} will be ${ctx.of(ctx.labels[target])}?`;
      traps.push(
        { value: frac(pcts[target], 100), trap: 'prob-di-wrong-total' },
        { value: frac(pcts[target], pcts[other]), trap: 'prob-wrong-denominator' },
        { value: frac(pcts[other], 100 - pcts[removed]), trap: 'prob-wrong-event' },
      );
      explanation = `Think of 100 ${ctx.items}. Removing the ${pcts[removed]} ${ctx.of(ctx.labels[removed])} leaves ${100 - pcts[removed]}, of which ${pcts[target]} are ${ctx.of(ctx.labels[target])}: $\\frac{${pcts[target]}}{${100 - pcts[removed]}} = ${correct.toTex()}$.

$\\frac{${pcts[target]}}{100}$ is the fraction before the removal; the remaining collection is the new whole.`;
    }
    const fillers = [frac(1, 2), frac(1, 3), frac(2, 3), frac(1, 4), frac(3, 4), frac(2, 5), frac(3, 5)];
    const { choices, answer } = numericChoices(rng, {
      correct,
      traps: traps.filter((t) => t.value.lt(1) && t.value.sign() > 0),
      fillers: rng.shuffle(fillers),
      format: (v) => `$${v.toTex()}$`,
    });
    return { params: { pcts, removed, target, total, added }, q: { format: 'mcs', figure: pie, stem, choices, answer, explanation } };
  },
  check(q, { removed, target, total, added }) {
    const pcts = (q.figure as PieChartFigure).slices.map((s) => s.value);
    // Build an actual collection of 100 (or `total`) items and count after the change.
    const base = total || 100;
    const items: number[] = [];
    pcts.forEach((p, k) => {
      for (let i = 0; i < (p * base) / 100; i++) items.push(k);
    });
    const after = added ? [...items, ...Array(added).fill(target)] : items.filter((k) => k !== removed);
    const f = frac(after.filter((k) => k === target).length, after.length);
    return mcsCheck(q, `$${f.toTex()}$`);
  },
};

export const singleDITemplates: Template<any>[] = [tableUnits, pieRemove];

