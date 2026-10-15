import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { term } from '../../../engine/text';
import { num, usd } from '../../../engine/tex';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { trapOnlyChoices } from '../prob/util';
import { fTex, QC_WORDS } from './util';

const rel = (a: Frac | number, b: Frac | number): QCChoice => qcFromSamples([[a, b]]);
const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);
const timesWord = (k: number) => (k === 2 ? 'twice' : k === 3 ? 'three times' : k === 4 ? 'four times' : `${k} times`);

/* =============================================================================================
 * Contexts for two groups
 * =========================================================================================== */

interface GroupCtx {
  /** Names of the two groups. */
  g: [string, string];
  /** "employees", "students"... */
  members: string;
  /** "Each employee of Company R works in either Division X or Division Y." */
  intro: string;
  /** "salary", "score"... */
  measure: string;
  /** "the average salary of all the employees of Company R" */
  overall: string;
  /** Unit step and value range for the averages. */
  unit: number;
  lo: number;
  hi: number;
  money: boolean;
}

const GROUP_CTX: GroupCtx[] = [
  {
    g: ['Division X', 'Division Y'],
    members: 'employees',
    intro: 'Each employee of Company R works in either Division X or Division Y.',
    measure: 'salary',
    overall: 'the average salary of all the employees of Company R',
    unit: 1000,
    lo: 30000,
    hi: 96000,
    money: true,
  },
  {
    g: ['Section P', 'Section Q'],
    members: 'students',
    intro: 'Each student who took a certain test is in either Section P or Section Q.',
    measure: 'score',
    overall: 'the average score of all the students who took the test',
    unit: 1,
    lo: 55,
    hi: 98,
    money: false,
  },
  {
    g: ['the morning shift', 'the evening shift'],
    members: 'workers',
    intro: 'Each worker at a factory works on either the morning shift or the evening shift.',
    measure: 'hourly wage',
    overall: 'the average hourly wage of all the workers at the factory',
    unit: 1,
    lo: 15,
    hi: 48,
    money: true,
  },
];

const valueText = (ctx: GroupCtx, v: number) => (ctx.money ? usd(v) : `$${num(v)}$`);

/* =============================================================================================
 * 1. Which overall averages are possible (MCM), book DA-02
 * =========================================================================================== */

interface CouldParams {
  /** Average of the larger group (named first) and of the smaller group. */
  aBig: number;
  aSmall: number;
  k: number;
  strict: boolean;
  values: number[];
}

const couldBe: Template<CouldParams> = {
  id: 'data.weighted.could-be',
  skill: 'data.weighted',
  format: 'mcm',
  style: 'which overall averages are possible when one group is more than k times as large',
  generate(rng, d) {
    const ctx = rng.pick(GROUP_CTX);
    const k = d === 1 ? rng.pick([1, 2]) : d === 2 ? rng.pick([2, 3]) : rng.pick([2, 3, 4]);
    const strict = k === 1 || d < 3 ? true : rng.chance(0.5);
    for (;;) {
      const T = rng.pick(k >= 3 ? [8, 9] : [6, 7, 8, 9]);
      const step = ctx.unit * rng.pick(ctx.unit === 1000 ? [1, 2, 3, 4, 5] : ctx.money ? [1, 2] : [1, 2, 3]);
      const gap = T * step;
      const lowAvg = ctx.unit * rng.int(Math.ceil(ctx.lo / ctx.unit), Math.floor((ctx.hi - gap) / ctx.unit));
      if (lowAvg + gap > ctx.hi || lowAvg < ctx.lo) continue;
      const bigIsLow = rng.chance(0.6);
      const aBig = bigIsLow ? lowAvg : lowAvg + gap;
      const aSmall = bigIsLow ? lowAvg + gap : lowAvg;
      const dir = Math.sign(aSmall - aBig);
      // choice j sits j steps from the larger group's average, toward the other average
      const js = Array.from({ length: T - 1 }, (_, i) => i + 1);
      const ok = (j: number) => (strict ? j * (k + 1) < T : j * (k + 1) <= T);
      if (!js.some(ok) || js.every(ok)) continue;
      const items = js
        .map((j) => ({ j, v: aBig + dir * j * step }))
        .sort((x, y) => x.v - y.v)
        .map(({ j, v }) => {
          let trap: string | undefined;
          if (!ok(j)) {
            if (j * (k + 1) === T) trap = 'stat-weighted-bound';
            else if (2 * j === T) trap = 'stat-weighted-midpoint';
            else if (2 * j > T) trap = 'stat-weighted-wrong-side';
          }
          return { text: valueText(ctx, v), correct: ok(j), ...(trap ? { trap } : {}), v };
        });
      const { choices, answer } = flaggedChoices(items.map(({ v: _v, ...c }) => c));
      const bound = new Frac(k * aBig + aSmall, k + 1);
      const relation = k === 1 ? 'more' : `${strict ? 'more than' : 'at least'} ${timesWord(k)} as many`;
      const relSentence =
        k === 1 ? `${cap(ctx.g[0])} has more ${ctx.members} than ${ctx.g[1]}.` : `${cap(ctx.g[0])} has ${relation} ${ctx.members} as ${ctx.g[1]}.`;
      const boundTex = bound.isInt() ? num(bound.n) : `${bound.toTex()} \\approx ${num(Math.round(bound.toNumber() * 10) / 10)}`;
      const boundText = bound.isTerminating() ? valueText(ctx, bound.toNumber()) : `about ${valueText(ctx, Math.round(bound.toNumber() * 10) / 10)}`;
      const correctTexts = items.filter((it) => it.correct).map((it) => it.text);
      return {
        params: { aBig, aSmall, k, strict, values: items.map((it) => it.v) },
        q: {
          format: 'mcm',
          stem: `${ctx.intro} ${relSentence} The average (arithmetic mean) ${ctx.measure} of the ${ctx.members} in ${ctx.g[0]} is ${valueText(ctx, aBig)}, and the average ${ctx.measure} of the ${ctx.members} in ${ctx.g[1]} is ${valueText(ctx, aSmall)}. Which of the following could be ${ctx.overall}?`,
          instruction: `Indicate all such ${ctx.money ? 'amounts' : 'values'}.`,
          choices,
          answer,
          explanation: `The overall average is a weighted average: it lies between ${valueText(ctx, Math.min(aBig, aSmall))} and ${valueText(ctx, Math.max(aBig, aSmall))}, closer to the average of the larger group, ${ctx.g[0]}.

If ${ctx.g[0]} had exactly ${k === 1 ? 'as many' : `${timesWord(k)} as many`} ${ctx.members} as ${ctx.g[1]}, the overall average would be $\\dfrac{${k === 1 ? '' : `${k} \\times `}${num(aBig)} + ${num(aSmall)}}{${k + 1}} = ${boundTex}$. Since ${ctx.g[0]} has ${relation} ${ctx.members}${k === 1 ? ` than ${ctx.g[1]}` : ''}, the overall average is even closer to ${valueText(ctx, aBig)}: it is between ${aBig < aSmall ? `${valueText(ctx, aBig)} and ${boundText}` : `${boundText} and ${valueText(ctx, aBig)}`}${
            strict ? ', not including either value' : `, and it can equal ${boundText} (exactly ${timesWord(k)} as many)`
          }.

So the possible choices are ${andList(correctTexts)}. The midpoint of the two averages would require equal group sizes${
            k === 1 ? '' : `, and values beyond ${boundText} would require fewer than ${timesWord(k)} as many ${ctx.members} in ${ctx.g[0]}`
          }.`,
        },
      };
    }
  },
  check(q, { aBig, aSmall, k, strict, values }) {
    if (q.format !== 'mcm') return 'wrong format';
    // Brute force over group sizes: is there nBig > k nSmall (or >=) giving exactly this average?
    const possible = (c: number) => {
      for (let nS = 1; nS <= 20; nS++)
        for (let nB = 1; nB <= 120; nB++) {
          if (strict ? !(nB > k * nS) : !(nB >= k * nS)) continue;
          if (nB * (c - aBig) + nS * (c - aSmall) === 0) return true;
        }
      return false;
    };
    const expected = values.flatMap((v, i) => (possible(v) ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/** "a", "a and b", "a, b, and c". */
function andList(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* =============================================================================================
 * 2. Average of grouped data (NE), book DA-04
 * =========================================================================================== */

type GroupedMode = 'text' | 'table' | 'more';

interface GroupedParams {
  mode: GroupedMode;
  counts: number[];
  /** Values per group; table mode: tenths of a rating (e.g. 32 = 3.2). */
  values: number[];
  /** more: the target average and the value of each new member. */
  target: number;
  extraValue: number;
}

const DONATION_CTX = [
  { who: 'guests at a fund-raising dinner', verb: 'donated', each: 'donation per guest', money: true, unitWord: '' },
  { who: 'people who bought tickets to a concert', verb: 'paid', each: 'price paid per ticket buyer', money: true, unitWord: '' },
  { who: 'volunteers at a food bank last month', verb: 'worked', each: 'number of hours worked per volunteer', money: false, unitWord: 'hours' },
];

const SURVEY_GROUPS = [
  ['Students', 'Teachers', 'Parents'],
  ['First-time visitors', 'Returning visitors', 'Members'],
  ['Morning customers', 'Afternoon customers', 'Evening customers'],
];

const groupedNE: Template<GroupedParams> = {
  id: 'data.weighted.grouped-ne',
  skill: 'data.weighted',
  format: 'ne',
  style: 'average of grouped data: weight each value by its count',
  generate(rng, d) {
    const mode: GroupedMode = d === 1 ? 'text' : d === 2 ? rng.pick(['text', 'table']) : rng.pick(['table', 'more', 'more']);

    if (mode === 'table') {
      for (;;) {
        const names = rng.pick(SURVEY_GROUPS);
        const counts = names.map(() => rng.int(2, 30) * (d === 3 ? 5 : 2));
        const values = names.map(() => rng.int(18, 48)); // tenths
        const N = counts.reduce((s, c) => s + c, 0);
        const exact = new Frac(counts.reduce((s, c, i) => s + c * values[i], 0), 10 * N);
        const x10 = exact.toNumber() * 10;
        if (Math.abs(x10 - Math.floor(x10) - 0.5) < 0.08 || exact.mul(10).isInt()) continue;
        const rounded = new Frac(Math.round(x10), 10);
        const unweighted = new Frac(Math.round(values.reduce((s, v) => s + v, 0) / 3), 10);
        if (unweighted.eq(rounded)) continue;
        const traps = [{ value: unweighted, trap: 'stat-unweighted-mean' }];
        const sumTex = counts.map((c, i) => `${c}(${(values[i] / 10).toFixed(1)})`).join(' + ');
        return {
          params: { mode, counts, values, target: 0, extraValue: 0 },
          q: {
            format: 'ne',
            figure: {
              kind: 'table',
              title: 'SURVEY RESULTS BY GROUP',
              headers: ['Group', 'Number of People', 'Average Rating'],
              rows: names.map((nm, i) => [nm, `$${counts[i]}$`, `$${(values[i] / 10).toFixed(1)}$`]),
            },
            stem: `In a survey, each person rated a service on a scale from 1 to 5. The table shows the number of people in each of three groups and the average (arithmetic mean) rating given by each group. What is the average rating given by all the people in the survey?

Give your answer to the nearest 0.1.`,
            answer: rounded,
            traps,
            explanation: `Weight each group's average by its number of people. The total of all the ratings is $${sumTex} = ${fTex(new Frac(counts.reduce((s, c, i) => s + c * values[i], 0), 10))}$, and there are $${counts.join(' + ')} = ${N}$ people.

The overall average is $${fTex(new Frac(counts.reduce((s, c, i) => s + c * values[i], 0), 10))} \\div ${N} \\approx ${exact.toNumber().toFixed(3)}$, which is $${fTex(rounded)}$ to the nearest 0.1.

Averaging the three group averages (about $${unweighted.toNumber().toFixed(1)}$) ignores that the groups have different sizes.`,
          },
        };
      }
    }

    const ctx = rng.pick(DONATION_CTX);
    const nG = d === 1 ? rng.pick([2, 3]) : 3;
    for (;;) {
      const counts = Array.from({ length: nG }, () => rng.int(3, d === 1 ? 20 : 40));
      const values = ctx.money ? Array.from({ length: nG }, () => rng.int(2, 30) * 5) : Array.from({ length: nG }, () => rng.int(2, 25));
      if (new Set(values).size < nG || new Set(counts).size < nG) continue;
      const N = counts.reduce((s, c) => s + c, 0);
      const total = counts.reduce((s, c, i) => s + c * values[i], 0);
      const avg = new Frac(total, N);
      const lines = counts.map((c, i) => `${c} ${c === 1 ? ctx.who.split(' ')[0].replace(/s$/, '') : ctx.who.split(' ')[0]} ${ctx.verb} ${ctx.money ? usd(values[i]) : `${values[i]} hours`} each`);
      const listing = lines.length === 2 ? lines.join(' and ') : `${lines.slice(0, -1).join(', ')}, and ${lines[lines.length - 1]}`;
      const fmt = (v: Frac | number) => (ctx.money ? usd(v instanceof Frac ? v.toNumber() : v, v instanceof Frac && !v.isInt() ? 2 : undefined) : `$${v instanceof Frac ? fTex(v) : num(v)}$`);

      if (mode === 'more') {
        // How many more members at the top value raise the average to a target?
        const top = Math.max(...values);
        const extra = rng.int(2, 20);
        const target = new Frac(total + extra * top, N + extra);
        if (!target.isInt() || top - target.n < 2) continue; // each newcomer must add more than 1 above the target
        const shortfall = target.mul(N).sub(total);
        const wrong = shortfall.div(top);
        if (wrong.eq(extra)) continue;
        const traps = [{ value: wrong, trap: 'stat-shortfall-divided' }];
        return {
          params: { mode, counts, values, target: target.n, extraValue: top },
          q: {
            format: 'ne',
            stem: `Of the ${ctx.who}, ${listing}. How many additional ${ctx.who.split(' ')[0]}, each of whom ${ctx.verb} ${ctx.money ? usd(top) : `${top} hours`}, would be needed to raise the average (arithmetic mean) ${ctx.each} to ${fmt(target)}?`,
            answer: frac(extra),
            traps,
            explanation: `At present the total is $${num(total)}$ for $${N}$ ${ctx.who.split(' ')[0]}. With $n$ more at $${num(top)}$ each, the average is $\\dfrac{${num(total)} + ${num(top)}n}{${N} + n}$.

Set it equal to $${fTex(target)}$: $${num(total)} + ${num(top)}n = ${fTex(target)}(${N} + n)$, so $${term(top - target.n, 'n')} = ${num(target.n * N - total)}$ and $n = ${extra}$.

Each newcomer adds only $${num(top)} - ${fTex(target)} = ${num(top - target.n)}$ above the target average, so divide the shortfall $${num(target.n * N - total)}$ by $${num(top - target.n)}$, not by $${num(top)}$.`,
          },
        };
      }

      if (!avg.mul(100).isInt()) continue;
      const unweighted = new Frac(values.reduce((s, v) => s + v, 0), nG);
      const byGroups = new Frac(total, nG);
      if (unweighted.eq(avg) || byGroups.eq(avg)) continue;
      const traps = [
        { value: unweighted, trap: 'stat-unweighted-mean' },
        { value: byGroups, trap: 'stat-divided-by-groups' },
      ];
      return {
        params: { mode, counts, values, target: 0, extraValue: 0 },
        q: {
          format: 'ne',
          stem: `Of the ${ctx.who}, ${listing}. What was the average (arithmetic mean) ${ctx.each}?`,
          answer: avg,
          prefix: ctx.money ? '\\$' : undefined,
          suffix: ctx.money ? undefined : 'hours',
          traps,
          explanation: `Find the total and divide by the number of ${ctx.who.split(' ')[0]}. Total: $${counts.map((c, i) => `${c}(${num(values[i])})`).join(' + ')} = ${num(total)}$. Number: $${counts.join(' + ')} = ${N}$.

Average: $${num(total)} \\div ${N} = ${fTex(avg)}$${ctx.money ? ' dollars' : ' hours'}.

The plain average of the ${nG} amounts, $${fTex(unweighted)}$, would be right only if the groups were the same size.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    // Expand the groups into one explicit list of values.
    const list: number[] = [];
    p.counts.forEach((c, i) => {
      for (let j = 0; j < c; j++) list.push(p.values[i]);
    });
    if (p.mode === 'more') {
      // Add members one at a time until the average reaches the target.
      let s = list.reduce((a, b) => a + b, 0);
      let n = list.length;
      for (let added = 1; added <= 1000; added++) {
        s += p.extraValue;
        n += 1;
        if (s === p.target * n) return q.answer.eq(added) ? null : `expected ${added}`;
        if (s > p.target * n) break;
      }
      return 'target never reached exactly';
    }
    let s = 0;
    for (const v of list) s += v;
    if (p.mode === 'table') {
      // ratings are stored in tenths; round the exact mean to the nearest tenth
      const mean = s / (10 * list.length);
      const r = Math.round(mean * 10) / 10;
      return Math.abs(q.answer.toNumber() - r) < 1e-9 ? null : `expected ${r}`;
    }
    return q.answer.eq(new Frac(s, list.length)) ? null : `expected ${s}/${list.length}`;
  },
};

/* =============================================================================================
 * 3. Group size or share from the averages (MCS)
 * =========================================================================================== */

type SizeCtx = 'class' | 'mixture' | 'fraction';

interface SizeParams {
  ctx: SizeCtx;
  /** Which count is asked for: the unknown group, or the whole (class or mixture). */
  ask: 'part' | 'total';
  nA: number;
  a: number;
  b: number;
  c: number;
}

const groupSize: Template<SizeParams> = {
  id: 'data.weighted.group-size',
  skill: 'data.weighted',
  format: 'mcs',
  style: 'find a group size or share from the group averages and the overall average',
  generate(rng, d) {
    const ctx: SizeCtx = d === 1 ? 'class' : d === 2 ? rng.pick(['class', 'mixture']) : rng.pick(['fraction', 'mixture', 'fraction']);
    for (;;) {
      // (c - a) : (b - c) = p : q, so nB / nA = p / q
      const p = rng.int(1, 4);
      const q = rng.int(1, 4);
      if (p === q || gcd(p, q) !== 1) continue;
      const unit = ctx === 'mixture' ? rng.pick([1, 2]) : rng.int(1, 4);
      const a = ctx === 'mixture' ? rng.int(2, 6) : rng.int(55, 80);
      const c = a + p * unit;
      const b = c + q * unit;
      if (ctx !== 'mixture' && b > 99) continue;
      const mk = (value: Frac | number, trap: string, why: (v: string) => string) => ({ value, trap, why });
      if (ctx === 'fraction') {
        // share of group A = q / (p + q)
        const share = new Frac(q, p + q);
        const dfrac = (f: Frac) => `$${f.toTex({ dfrac: true })}$`;
        const traps = [
          mk(new Frac(p, p + q), 'stat-weighted-inverted', (v) => `taking the ratio the other way round gives $${v}$, but the group whose average is closer to the overall average is the larger one`),
          mk(new Frac(1, 2), 'stat-weighted-midpoint', (v) => `$${v}$ would need equal group sizes, and the overall average is not halfway between the two averages`),
          mk(new Frac(Math.min(p, q), Math.max(p, q)), 'stat-ratio-as-fraction', (v) => `reading a ratio as a fraction gives $${v}$, but a share is a part over the whole, $${q}$ over $${p + q}$`),
          mk(new Frac(1, p + q), 'stat-ratio-one-part', (v) => `taking one part out of $${p + q}$ gives $${v}$, but sales has $${q}$ of the $${p + q}$ parts`),
        ];
        const built = trapOnlyChoices(rng, share, traps, (v) => dfrac(v));
        if (!built) continue;
        const cite = rng.pick(built.used);
        const sal = (v: number) => usd(v * 1000);
        return {
          params: { ctx, ask: 'part', nA: 0, a, b, c },
          q: {
            format: 'mcs',
            stem: `Each employee of a company works in either the sales department or the service department. The average (arithmetic mean) annual salary is ${sal(a)} for the employees in sales and ${sal(b)} for the employees in service. If the average annual salary of all the employees is ${sal(c)}, what fraction of the employees work in sales?`,
            choices: built.choices,
            answer: built.answer,
            explanation: `The overall average lies between the two group averages, closer to the larger group's.

It is ${sal(c - a)} above the sales average and ${sal(b - c)} below the service average, so the group sizes are in the inverse ratio: sales : service $= ${num(b - c)} : ${num(c - a)}${b - c === q ? '' : ` = ${q} : ${p}`}$. Sales is therefore $\\frac{${q}}{${q} + ${p}} = ${share.toTex()}$ of the employees.

Check: $${share.toTex()}(${num(a)}) + ${new Frac(p, p + q).toTex()}(${num(b)}) = ${num(c)}$ (in thousands).

Trap: ${cite.why(Frac.of(cite.value).toTex())}.

The distances to the overall average are inversely proportional to the group sizes.`,
          },
        };
      }

      const nA = q * rng.int(2, 8) * (ctx === 'mixture' ? 1 : p);
      if (nA > 60) continue;
      const nB = (nA * p) / q;
      const ask: SizeParams['ask'] = d === 1 ? 'part' : rng.chance(0.5) ? 'part' : 'total';
      const cls = ctx === 'class';
      const cand = (x: Frac) => (x.isInt() && x.n > 0 ? [x.n] : []);
      const [invA] = cand(new Frac(nA * q, p));
      const [gap] = cand(new Frac(nA * p, p + q));
      const noDivide = `multiplying by $${c - a}$ and never dividing by $${b - c}$`;
      const traps =
        ask === 'part'
          ? [
              ...(invA ? [mk(invA, 'stat-weighted-inverted', (v) => `flipping the ratio gives $${v}$, but the group whose average is closer to the overall average is the larger one`)] : []),
              mk(nA, 'stat-weighted-midpoint', (v) => `assuming two equal groups gives $${v}$, but the overall average is not halfway between ${cls ? `$${a}$ and $${b}$` : `${usd(a)} and ${usd(b)}`}`),
              mk(nA + nB, 'stat-answered-total', (v) => `$${v}$ is the ${cls ? 'class' : 'mixture'} total, but the question asks for ${cls ? 'the back rows' : 'the cashews'} only`),
              mk(nA * (c - a), 'stat-weighted-no-divide', (v) => `${noDivide} gives $${v}$`),
              ...(gap ? [mk(gap, 'stat-weighted-whole-gap', (v) => `dividing by the whole gap $${b - a}$ between the averages gives $${v}$, but the sizes are in the ratio of the two distances to the overall average`)] : []),
            ]
          : [
              mk(nB, 'stat-answered-part', (v) => `$${v}$ is ${cls ? 'the back rows' : 'the cashews'} alone, but the question asks for the ${cls ? 'whole class' : 'whole mixture'}`),
              mk(nA, 'stat-answered-part', (v) => `$${v}$ is ${cls ? 'the front rows' : 'the peanuts'}, which the problem already gives`),
              mk(2 * nA, 'stat-weighted-midpoint', (v) => `assuming two equal groups gives $${v}$, but the overall average is not halfway between ${cls ? `$${a}$ and $${b}$` : `${usd(a)} and ${usd(b)}`}`),
              ...(invA ? [mk(nA + invA, 'stat-weighted-inverted', (v) => `flipping the ratio gives $${v}$, but the group whose average is closer to the overall average is the larger one`)] : []),
              ...(rng.chance(0.4) ? [mk(nA + nA * (c - a), 'stat-weighted-no-divide', (v: string) => `${noDivide} makes the second group $${nA * (c - a)}$ and the total $${v}$`)] : []),
            ];
      const built = trapOnlyChoices(rng, ask === 'part' ? nB : nA + nB, traps, (v) => `$${fTex(v)}$`);
      if (!built) continue;
      const cite = rng.pick(built.used);
      const times = b - c === 1 ? num(c - a) : `\\frac{${num(c - a)}}{${num(b - c)}}`;
      return {
        params: { ctx, ask, nA, a, b, c },
        q: {
          format: 'mcs',
          stem: cls
            ? `In a class, the ${nA} students who sit in the front rows had an average (arithmetic mean) score of $${a}$ on a test, and the students who sit in the back rows had an average score of $${b}$. If the average score of the entire class was $${c}$, how many students ${ask === 'part' ? 'sit in the back rows' : 'are in the class'}?`
            : `A grocer mixes ${nA} pounds of peanuts that cost ${usd(a)} per pound with some cashews that cost ${usd(b)} per pound. The mixture costs ${usd(c)} per pound. How many pounds ${ask === 'part' ? 'of cashews are in the mixture' : 'does the mixture weigh'}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `A mix of two groups: the overall ${cls ? 'average' : 'price'} sits closer to the average of the larger group.

It is ${cls ? `$${c - a}$` : usd(c - a)} above ${cls ? `$${a}$` : usd(a)} and ${cls ? `$${b - c}$` : usd(b - c)} below ${cls ? `$${b}$` : usd(b)}, so the sizes are in the inverse ratio: ${cls ? 'front' : 'peanuts'} : ${cls ? 'back' : 'cashews'} $= ${num(b - c)} : ${num(c - a)}$. Then ${cls ? 'the back rows have' : 'the cashews weigh'} $${nA} \\times ${times} = ${nB}$${ask === 'part' ? '' : `, and the ${cls ? 'class' : 'mixture'} has $${nA} + ${nB} = ${nA + nB}$`}.

Check: $${num(a)}(${nA}) + ${num(b)}(${nB}) = ${num(a * nA + b * nB)} = ${num(c)}(${nA + nB})$.

Trap: ${cite.why(num(cite.value))}.

In a mix, the distances to the overall average are inversely proportional to the group sizes.`,
        },
      };
    }
  },
  check(q, { ctx, ask, nA, a, b, c }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (ctx === 'fraction') {
      // Search small group sizes giving exactly the overall average.
      for (let x = 1; x <= 40; x++)
        for (let y = 1; y <= 40; y++)
          if (a * x + b * y === c * (x + y)) {
            const f = new Frac(x, x + y);
            return q.choices[q.answer].text === `$${f.toTex({ dfrac: true })}$` ? null : `expected ${f}`;
          }
      return 'no sizes found';
    }
    for (let n = 1; n <= 2000; n++)
      if (a * nA + b * n === c * (nA + n)) {
        const expected = ask === 'part' ? n : nA + n;
        return q.choices[q.answer].text === `$${num(expected)}$` ? null : `expected ${expected}`;
      }
    return 'no size found';
  },
};

/* =============================================================================================
 * 4. Overall average versus the midpoint or another value (QC)
 * =========================================================================================== */

type OvMode = 'larger' | 'unknown' | 'equal' | 'numbers' | 'bound';

interface OvParams {
  mode: OvMode;
  side: 'A' | 'B';
  a: number;
  b: number;
  /** numbers: sizes; bound: ratio k with strict flag. */
  nA: number;
  nB: number;
  k: number;
  strict: boolean;
  /** The number in the other quantity. */
  other: Frac;
}

const OV_MODES: Record<Difficulty, OvMode[]> = {
  1: ['larger', 'larger', 'equal', 'numbers', 'unknown'],
  2: ['larger', 'unknown', 'equal', 'numbers', 'bound', 'numbers'],
  3: ['bound', 'bound', 'unknown', 'numbers', 'numbers', 'larger'],
};

const overallQC: Template<OvParams> = {
  id: 'data.weighted.overall-qc',
  skill: 'data.weighted',
  format: 'qc',
  style: 'overall average of two groups versus the midpoint',
  generate(rng, d) {
    const mode = rng.pick(OV_MODES[d]);
    const side: 'A' | 'B' = rng.chance(0.5) ? 'A' : 'B';
    const a = rng.int(62, 88);
    let b: number;
    let k = 0;
    const strict = rng.chance(0.5);
    if (mode === 'bound') {
      k = rng.pick([2, 3]);
      b = a + rng.sign() * (k + 1) * rng.int(2, 4);
    } else {
      do b = rng.int(58, 94);
      while (Math.abs(a - b) < 4 || (a + b) % 2);
    }
    const mid = new Frac(a + b, 2);
    const qOverall = 'The average score of all the students in the two classes';
    const intro = `Class A and Class B took the same test. The average (arithmetic mean) score of the students in Class A was $${a}$, and the average score of the students in Class B was $${b}$.`;
    let nA = 0;
    let nB = 0;
    let info: string;
    let ansA: QCChoice; // the overall average (as Quantity A) versus the other number
    let other: Frac = mid;
    let why: string;
    let trapsA: Partial<Record<QCChoice, string>> = {};
    if (mode === 'larger') {
      const aBigger = rng.chance(0.5);
      nA = aBigger ? 2 : 1;
      nB = aBigger ? 1 : 2;
      info = `${intro} Class ${aBigger ? 'A' : 'B'} has more students than Class ${aBigger ? 'B' : 'A'}.`;
      const bigAvg = aBigger ? a : b;
      ansA = rel(bigAvg, mid);
      why = `With more students in Class ${aBigger ? 'A' : 'B'}, the overall average is closer to $${bigAvg}$ than to the other class average, so it is on the same side of the midpoint $${fTex(mid)}$ as $${bigAvg}$: ${bigAvg > mid.toNumber() ? 'greater' : 'less'} than $${fTex(mid)}$.`;
      trapsA = { C: 'stat-weighted-midpoint' };
    } else if (mode === 'unknown') {
      info = intro;
      ansA = 'D';
      why = `The overall average equals the midpoint $${fTex(mid)}$ only when the classes are the same size. The sizes are not given: with more students in Class A the overall average is closer to $${a}$, and with more in Class B it is closer to $${b}$.`;
      trapsA = { C: 'stat-weighted-midpoint' };
    } else if (mode === 'equal') {
      const n = rng.int(12, 35);
      nA = n;
      nB = n;
      info = `${intro} Each class has ${n} students.`;
      ansA = 'C';
      why = `With equal class sizes, the overall average is the plain average of the two class averages: $\\dfrac{${a} + ${b}}{2} = ${fTex(mid)}$.`;
      trapsA = { D: 'stat-need-each-value' };
    } else if (mode === 'numbers') {
      nA = rng.int(8, 32);
      do nB = rng.int(8, 32);
      while (nB === nA);
      const overall = new Frac(nA * a + nB * b, nA + nB);
      const target = rng.pick(['A', 'B', 'C'] as QCChoice[]);
      // Compared with the midpoint, only the larger class matters; otherwise the exact average is needed.
      if (rng.chance(d === 1 ? 0.5 : d === 2 ? 0.4 : 0.3)) other = mid;
      else if (target === 'C' && overall.isTerminating() && overall.mul(100).isInt()) other = overall;
      else if (target === 'B') other = frac(Math.floor(overall.toNumber()) + 1);
      else other = frac(overall.isInt() ? overall.n - 1 : Math.floor(overall.toNumber()));
      info = `${intro} There are ${nA} students in Class A and ${nB} students in Class B.`;
      ansA = rel(overall, other);
      why = `The overall average is the total of all the scores divided by the number of students: $\\dfrac{${nA}(${a}) + ${nB}(${b})}{${nA + nB}} = \\dfrac{${num(nA * a + nB * b)}}{${nA + nB}}${
        overall.isTerminating() ? ` = ${fTex(overall)}` : ` \\approx ${num(Math.round(overall.toNumber() * 100) / 100)}`
      }$. Compare it with $${fTex(other)}$.`;
      const naive = rel(mid, other);
      if (other.eq(mid)) {
        const bigAvg = nA > nB ? a : b;
        why = `Compare with the midpoint $${fTex(mid)}$ of the two class averages. Class ${nA > nB ? 'A' : 'B'} has more students, so the overall average is closer to $${bigAvg}$ than to the other class average: ${bigAvg > mid.toNumber() ? 'greater' : 'less'} than $${fTex(mid)}$, with no arithmetic needed.

Check: $\\dfrac{${nA}(${a}) + ${nB}(${b})}{${nA + nB}} = \\dfrac{${num(nA * a + nB * b)}}{${nA + nB}} \\approx ${num(Math.round(overall.toNumber() * 100) / 100)}$.

Trap: the midpoint $${fTex(mid)}$ is the overall average only when the classes have equal sizes, and ${nA} is not ${nB}.`;
        trapsA = { C: 'stat-weighted-midpoint' };
      } else if (naive !== ansA) trapsA = { [naive]: 'stat-unweighted-mean' };
    } else {
      const bound = new Frac(k * a + b, k + 1);
      other = bound;
      info = `${intro} Class A has ${strict ? 'more than' : 'at least'} ${timesWord(k)} as many students as Class B.`;
      const towardA: QCChoice = a < b ? 'B' : 'A';
      ansA = strict ? towardA : 'D';
      why = `If Class A had exactly ${timesWord(k)} as many students as Class B, the overall average would be $\\dfrac{${k}(${a}) + ${b}}{${k + 1}} = ${fTex(bound)}$. ${
        strict
          ? `With more than ${timesWord(k)} as many, the overall average is pulled even closer to $${a}$, so it is ${a < b ? 'less' : 'greater'} than $${fTex(bound)}$.`
          : `With at least ${timesWord(k)} as many, the overall average is either exactly $${fTex(bound)}$ or closer to $${a}$ than that.`
      }`;
      trapsA = strict ? { C: 'stat-weighted-bound' } : { [towardA]: 'stat-weighted-bound' };
    }
    const ans = side === 'A' ? ansA : flip(ansA);
    const traps: Partial<Record<QCChoice, string>> = {};
    for (const [key, v] of Object.entries(trapsA)) {
      const k2 = side === 'A' ? (key as QCChoice) : flip(key as QCChoice);
      if (k2 !== ans) traps[k2] = v;
    }
    const otherText = `$${fTex(other)}$`;
    return {
      params: { mode, side, a, b, nA, nB, k, strict, other },
      q: {
        format: 'qc',
        info,
        quantityA: side === 'A' ? qOverall : otherText,
        quantityB: side === 'A' ? otherText : qOverall,
        answer: ans,
        traps: Object.keys(traps).length ? (traps as QCQuestion['traps']) : undefined,
        explanation: `${why} So ${QC_WORDS[ans]}. (${ans})`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    // Sample class sizes allowed by the information and compute the overall average exactly.
    const sizes: [number, number][] = [];
    switch (p.mode) {
      case 'larger':
        for (let i = 0; i < 200; i++) {
          const small = rng.int(1, 40);
          const big = small + rng.int(1, 40);
          sizes.push(p.nA > p.nB ? [big, small] : [small, big]);
        }
        break;
      case 'unknown':
        for (let i = 0; i < 200; i++) sizes.push([rng.int(1, 60), rng.int(1, 60)]);
        sizes.push([1, 50], [50, 1]);
        break;
      case 'equal':
      case 'numbers':
        sizes.push([p.nA, p.nB]);
        break;
      case 'bound':
        for (let nB = 1; nB <= 30; nB++) for (let nA = 1; nA <= 150; nA++) if (p.strict ? nA > p.k * nB : nA >= p.k * nB) sizes.push([nA, nB]);
        break;
    }
    const samples = sizes.map(([x, y]) => {
      const overall = new Frac(x * p.a + y * p.b, x + y);
      return (p.side === 'A' ? [overall, p.other] : [p.other, overall]) as [Frac, Frac];
    });
    const expected = qcFromSamples(samples);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const weightedTemplates = [couldBe, groupedNE, groupSize, overallQC];
