import { Frac, frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import type { TableFigure, Template, Trap } from '../../../engine/types';
import { trapOnlyChoices } from '../prob/util';
import { fTex } from './util';

// Select-one questions on a grouped frequency table: percent of the data below, above or between
// class boundaries, and the least or greatest possible percent when the cut-off is inside a class.
export const distCumulativeTraps: Record<string, Trap> = {
  'stat-cum-single-class': {
    label: 'Gave the percent of a single class instead of adding the classes',
    fix: 'A question about "less than", "at least" or "from ... to ..." covers every class on that side of the boundary. Add their counts, then divide by the total.',
  },
  'stat-cum-complement': {
    label: 'Gave the percent on the other side of the boundary',
    fix: 'The two sides of a boundary add to 100%. Decide which side the question asks about before adding.',
  },
  'stat-cum-boundary-class': {
    label: 'Included the neighbouring class on the wrong side of the boundary',
    fix: 'For whole numbers, "less than 30" stops at 29, the top of the class before, and "at least 30" starts at 30. Put the boundary between two classes and keep each class on its own side.',
  },
  'stat-cum-class-short': {
    label: 'Left out the class next to the boundary',
    fix: 'List every class on the asked side, from the end of the table up to the boundary, and add all of them.',
  },
  'stat-cum-ends-only': {
    label: 'Added only the two classes that hold the end values',
    fix: '"From L to U" includes the classes in between as well. Add every class from the first to the last.',
  },
  'stat-cum-prorate': {
    label: 'Split a class in proportion to the cut-off',
    fix: 'A table of classes does not say where the values sit inside a class. Take the two extreme placements to find the least and greatest possible counts.',
  },
  'stat-cum-wrong-extreme': {
    label: 'Gave the least possible percent when the greatest was asked (or the reverse)',
    fix: 'The greatest possible puts every value of the cut-off class on the asked side; the least puts none there.',
  },
};

interface Ctx {
  pop: string;
  measure: string;
  unit: string;
  title: string;
  head: string;
  count: string;
  starts: number[];
  widths: number[];
}

const CTX: Ctx[] = [
  { pop: 'employees', measure: 'commute time', unit: 'minutes', title: 'COMMUTE TIMES', head: 'Commute Time (minutes)', count: 'Number of Employees', starts: [0, 10], widths: [10, 15] },
  { pop: 'students', measure: 'quiz score', unit: 'points', title: 'QUIZ SCORES', head: 'Score (points)', count: 'Number of Students', starts: [20, 40, 50], widths: [10, 5] },
  { pop: 'households', measure: 'weekly grocery bill', unit: 'dollars', title: 'WEEKLY GROCERY BILLS', head: 'Bill (dollars)', count: 'Number of Households', starts: [40, 60, 100], widths: [20, 10] },
  { pop: 'runners', measure: 'finishing time', unit: 'minutes', title: 'RACE FINISHING TIMES', head: 'Time (minutes)', count: 'Number of Runners', starts: [20, 25, 30], widths: [5, 10] },
];

type Kind = 'below' | 'atleast' | 'between' | 'most' | 'least';

interface CumParams {
  kind: Kind;
  counts: number[];
  start: number;
  width: number;
  /** below/atleast: index of the class that starts at the boundary. between: first and last class. */
  i: number;
  j: number;
  /** most/least: the cut-off value (inside class i). */
  t: number;
}

const lo = (p: { start: number; width: number }, k: number) => p.start + k * p.width;
const hi = (p: { start: number; width: number }, k: number) => lo(p, k) + p.width - 1;
const pct = (c: number, N: number) => frac(c * 100, N);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Counts of five classes that add to N, each at least 1. */
function composition(rng: Rng, N: number): number[] {
  for (;;) {
    const cuts = new Set<number>();
    while (cuts.size < 4) cuts.add(rng.int(1, N - 1));
    const c = [0, ...[...cuts].sort((a, b) => a - b), N];
    const counts = c.slice(1).map((x, k) => x - c[k]);
    if (Math.max(...counts) <= N * 0.45 && Math.min(...counts) >= Math.max(2, Math.round(N / 20))) return counts;
  }
}

const cumulative: Template<CumParams> = {
  id: 'data.distributions.cumulative-percent',
  skill: 'data.distributions',
  format: 'mcs',
  style: 'percent below, above or between class boundaries of a grouped table; least and greatest possible percent',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    for (;;) {
      const N = rng.pick([20, 25, 50, 100]);
      const counts = composition(rng, N);
      const start = rng.pick(ctx.starts);
      const width = rng.pick(ctx.widths);
      const P = { start, width };
      const kind: Kind = rng.pick(d === 1 ? ['below', 'atleast', 'below'] : d === 2 ? ['between', 'between', 'atleast', 'below'] : ['most', 'least', 'most', 'least']);
      let i = 0;
      let j = 0;
      let t = 0;
      let ask: string;
      let right: Frac;
      let why: string;
      const label = (k: number) => `${lo(P, k)}–${hi(P, k)}`;
      const traps: { value: Frac; trap: string; must?: boolean; cite?: string }[] = [];
      const pc = (k: number) => pct(counts[k], N);
      if (kind === 'below' || kind === 'atleast') {
        i = d === 1 ? rng.int(2, 3) : rng.int(1, 4);
        const L = lo(P, i);
        const idx = kind === 'below' ? counts.map((_, k) => k).filter((k) => k < i) : counts.map((_, k) => k).filter((k) => k >= i);
        right = pct(sum(idx.map((k) => counts[k])), N);
        ask = `${kind === 'below' ? 'less than' : 'of at least'} $${L}$ ${ctx.unit}`;
        const near = kind === 'below' ? i - 1 : i;
        const extra = kind === 'below' ? i : i - 1;
        traps.push(
          { value: pc(near), trap: 'stat-cum-single-class', must: true },
          { value: frac(100).sub(right), trap: 'stat-cum-complement' },
          { value: right.add(pc(extra)), trap: 'stat-cum-boundary-class' },
          { value: right.sub(pc(near)), trap: 'stat-cum-class-short' },
        );
        why = `${kind === 'below' ? 'Less than' : 'At least'} $${L}$ means the classes ${idx.map(label).join(', ')}: $${idx.map((k) => counts[k]).join(' + ')} = ${sum(idx.map((k) => counts[k]))}$ of the $${N}$ ${ctx.pop}, which is $${fTex(right)}\\%$.`;
        traps[0].cite = `the single class ${label(near)} gives $${fTex(pc(near))}\\%$`;
      } else if (kind === 'between') {
        i = rng.int(0, 2);
        j = rng.int(i + 1, 4);
        if (i === 0 && j === 4) continue;
        const idx = counts.map((_, k) => k).filter((k) => k >= i && k <= j);
        right = pct(sum(idx.map((k) => counts[k])), N);
        ask = `from $${lo(P, i)}$ to $${hi(P, j)}$ ${ctx.unit}, inclusive`;
        traps.push(
          { value: pc(i).add(pc(j)), trap: 'stat-cum-ends-only', must: true },
          { value: frac(100).sub(right), trap: 'stat-cum-complement' },
          { value: right.sub(pc(j)), trap: 'stat-cum-class-short' },
          { value: right.sub(pc(i)), trap: 'stat-cum-class-short' },
          ...(j < 4 ? [{ value: right.add(pc(j + 1)), trap: 'stat-cum-boundary-class' }] : []),
          ...(i > 0 ? [{ value: right.add(pc(i - 1)), trap: 'stat-cum-boundary-class' }] : []),
        );
        why = `From $${lo(P, i)}$ to $${hi(P, j)}$ inclusive covers the classes ${idx.map(label).join(', ')}: $${idx.map((k) => counts[k]).join(' + ')} = ${sum(idx.map((k) => counts[k]))}$ of the $${N}$ ${ctx.pop}, which is $${fTex(right)}\\%$.`;
        traps[0].cite = `the two end classes ${label(i)} and ${label(j)} alone give $${fTex(traps[0].value)}\\%$`;
      } else {
        i = rng.int(1, 3);
        const r = rng.int(1, width - 2);
        if (width < 3) continue;
        t = lo(P, i) + r;
        const above = sum(counts.slice(i + 1));
        const most = pct(above + counts[i], N);
        const least = pct(above, N);
        right = kind === 'most' ? most : least;
        ask = `greater than $${t}$ ${ctx.unit}`;
        const prorated = pct(above, N).add(pc(i).mul(new Frac(hi(P, i) - t, width)));
        traps.push(
          { value: prorated, trap: 'stat-cum-prorate', must: true },
          { value: kind === 'most' ? least : most, trap: 'stat-cum-wrong-extreme' },
          { value: frac(100).sub(right), trap: 'stat-cum-complement' },
          { value: pc(i), trap: 'stat-cum-single-class' },
        );
        why =
          kind === 'most'
            ? `The ${counts[i]} ${ctx.pop} in the class ${label(i)} could all be above $${t}$, since the class reaches $${hi(P, i)}$. Greatest possible: $${above} + ${counts[i]} = ${above + counts[i]}$ of $${N}$, which is $${fTex(right)}\\%$.`
            : `The ${counts[i]} ${ctx.pop} in the class ${label(i)} could all be at or below $${t}$, since the class starts at $${lo(P, i)}$. Least possible: only the classes above it count, $${above}$ of $${N}$, which is $${fTex(right)}\\%$.`;
        traps[0].cite = `splitting the class in proportion gives $${fTex(prorated)}\\%$, but the table does not say where the values lie inside the class`;
      }
      const cited = traps[0];
      const built = trapOnlyChoices(rng, right, traps.filter((x) => x.value.gt(0)), (v) => `$${fTex(v)}\\%$`, 5, 0);
      if (!built) continue;
      const rightText = built.choices[built.answer].text;
      const choices = rng.shuffle(built.choices);
      const first = built.used.find((u) => u.must);
      if (!first) continue;
      const table: TableFigure = {
        kind: 'table',
        title: ctx.title,
        headers: [ctx.head, ctx.count],
        rows: [...counts.map((c, k) => [`$${lo(P, k)}$–$${hi(P, k)}$`, `$${c}$`]), ['Total', `$${N}$`]],
      };
      const lead = kind === 'most' || kind === 'least' ? `What is the ${kind === 'most' ? 'greatest' : 'least'} possible percent of the ${ctx.pop} with a ${ctx.measure} ${ask}?` : `What percent of the ${ctx.pop} had a ${ctx.measure} ${ask}?`;
      const check =
        kind === 'most' || kind === 'least'
          ? `Check: the greatest and the least possible differ by the whole class, $${fTex(pc(i))}\\%$.`
          : `Check: the classes left out hold the other $${fTex(frac(100).sub(right))}\\%$, and the two parts make $100\\%$.`;
      const recog =
        kind === 'most' || kind === 'least'
          ? `The cut-off $${t}$ falls inside the class ${label(i)}, so the table does not settle how many of its values are above it. Take the extreme placements.`
          : 'The values are whole numbers grouped in classes, so a boundary sits between two classes: add whole classes.';
      return {
        params: { kind, counts, start, width, i, j, t },
        q: {
          format: 'mcs',
          figure: table,
          stem: `The table shows the distribution of the ${ctx.measure}, in whole ${ctx.unit}, of ${N} ${ctx.pop}.\n\n${lead}`,
          choices,
          answer: choices.findIndex((c) => c.text === rightText),
          explanation: `${recog}\n\n${why}\n\n${check}\n\nTrap: ${cited.cite}.\n\n${kind === 'most' || kind === 'least' ? 'When a cut-off falls inside a class, test the two extreme placements.' : 'Add every class on the asked side, nothing more.'}`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    const N = sum(p.counts);
    // expand the table into explicit values: every class places its values at one chosen position
    const expand = (place: (k: number) => number) => p.counts.flatMap((c, k) => Array.from({ length: c }, () => place(k)));
    const share = (xs: number[], pred: (x: number) => boolean) => (xs.filter(pred).length * 100) / N;
    let expected: number;
    if (p.kind === 'below') {
      const xs = expand((k) => lo(p, k));
      expected = share(xs, (x) => x < lo(p, p.i));
    } else if (p.kind === 'atleast') {
      expected = share(expand((k) => hi(p, k)), (x) => x >= lo(p, p.i));
    } else if (p.kind === 'between') {
      expected = share(expand((k) => lo(p, k) + (k % p.width)), (x) => x >= lo(p, p.i) && x <= hi(p, p.j));
    } else {
      // most: every value of the class as high as allowed; least: as low as allowed
      const xs = expand((k) => (p.kind === 'most' ? hi(p, k) : lo(p, k)));
      expected = share(xs, (x) => x > p.t);
    }
    const text = q.choices[q.answer]?.text.replace(/[$\\%]/g, '');
    return Math.abs(Number(text) - expected) < 1e-9 ? null : `expected ${expected}, keyed ${text}`;
  },
};

export const distCumulativeTemplates: Template<any>[] = [cumulative];
