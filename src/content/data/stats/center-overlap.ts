import { Frac, frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { numericChoices } from '../../../engine/build';
import { fTex } from './util';

export const centerOverlapTraps: Record<string, Trap> = {
  'stat-overlap-mean-of-means': {
    label: 'Averaged the two group averages',
    fix: 'The groups overlap, so the shared members weigh differently. Turn each average into a total (average × count) and work with totals.',
  },
  'stat-overlap-double-count': {
    label: 'Added the two group totals without removing the shared members',
    fix: 'Shared members sit in both totals. Subtract their total once, then divide by the number of different members.',
  },
  'stat-overlap-avg-not-total': {
    label: 'Subtracted the average of the shared members instead of their total',
    fix: 'Subtract (shared average × number shared), because the totals count every shared member.',
  },
  'stat-overlap-divide-2k': {
    label: 'Divided by the sum of the two group sizes',
    fix: 'Shared members count once among the different members. Divide by 2k minus the number shared.',
  },
  'stat-overlap-added': {
    label: 'Added the shared total instead of subtracting it',
    fix: 'The shared members are already counted twice. Take one copy away, do not add a third.',
  },
  'stat-overlap-answered-all': {
    label: 'Found the average of all the members when the others were asked',
    fix: 'Re-read what is asked. Subtract the shared total once more, and divide by the count without the shared members.',
  },
  'stat-overlap-removed-once': {
    label: 'Took the shared total out of the sum only once',
    fix: 'The shared members were counted twice in the two totals, so removing them from the sum takes two copies away.',
  },
  'stat-overlap-divide-n': {
    label: 'Divided by the full count after removing members',
    fix: 'If members leave the total, they leave the count too.',
  },
  'stat-overlap-removed-twice': {
    label: 'Took the shared total out twice but divided by the full count',
    fix: 'If the shared days are taken out of the sum they must also leave the count, or they must stay in both.',
  },
  'stat-overlap-divide-extra': {
    label: 'Divided by more days than there are',
    fix: 'Count the different days: 2k minus the shared days.',
  },
  'stat-overlap-divide-fewer': {
    label: 'Divided by the number of days without the shared ones after keeping them in the sum',
    fix: 'The sum and the count must describe the same days.',
  },
  'stat-overlap-divide-k': {
    label: 'Divided by the size of one group',
    fix: 'Count the members that are left: two groups of k, minus the shared members counted twice, minus the shared members once more.',
  },
};

interface Params {
  n: number;
  k: number;
  o: number;
  a: number;
  b: number;
  c: number;
  ask: 'all' | 'outside';
}

const CTX = [
  { intro: (n: number) => `A bakery sold loaves of bread on each of ${n} consecutive days.`, unit: 'loaves' },
  { intro: (n: number) => `A museum counted its visitors on each of ${n} consecutive days.`, unit: 'visitors' },
  { intro: (n: number) => `A courier company delivered parcels on each of ${n} consecutive days.`, unit: 'parcels' },
];

const overlapMcs: Template<Params> = {
  id: 'data.center.overlap-groups',
  skill: 'data.center',
  format: 'mcs',
  style: 'average of the whole when two overlapping groups have known averages',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    for (;;) {
      const o = d === 1 ? 1 : d === 2 ? rng.int(1, 2) : rng.int(2, 3);
      const k = rng.int(d === 1 ? 3 : o + 2, d === 1 ? 5 : 7);
      const n = 2 * k - o;
      const ask: Params['ask'] = d === 3 && rng.chance(0.7) ? 'outside' : d === 2 && rng.chance(0.3) ? 'outside' : 'all';
      const a = rng.int(20, 90);
      const b = rng.int(20, 90);
      const c = rng.int(15, 95);
      if (a === b || c === a || c === b) continue;
      const tot = k * a + k * b - o * c;
      const outsideSum = k * a + k * b - 2 * o * c;
      const outN = n - o;
      if (ask === 'outside' && outsideSum <= 0) continue;
      const right = ask === 'all' ? new Frac(tot, n) : new Frac(outsideSum, outN);
      if (!right.isTerminating() || right.lt(10)) continue;
      const cand =
        ask === 'all'
          ? [
              { value: new Frac(a + b, 2), trap: 'stat-overlap-mean-of-means' },
              { value: new Frac(k * a + k * b, n), trap: 'stat-overlap-double-count' },
              { value: new Frac(k * a + k * b - c, n), trap: 'stat-overlap-avg-not-total' },
              { value: new Frac(tot, 2 * k), trap: 'stat-overlap-divide-2k' },
              { value: new Frac(k * a + k * b + o * c, n), trap: 'stat-overlap-added' },
              { value: new Frac(outsideSum, n), trap: 'stat-overlap-removed-twice' },
              { value: new Frac(tot, n + o), trap: 'stat-overlap-divide-extra' },
              { value: new Frac(tot, outN), trap: 'stat-overlap-divide-fewer' },
            ]
          : [
              { value: new Frac(tot, n), trap: 'stat-overlap-answered-all' },
              { value: new Frac(tot - o * c, outN), trap: 'stat-overlap-removed-once' },
              { value: new Frac(a + b, 2), trap: 'stat-overlap-mean-of-means' },
              { value: new Frac(outsideSum, n), trap: 'stat-overlap-divide-n' },
              { value: new Frac(outsideSum, k), trap: 'stat-overlap-divide-k' },
              { value: new Frac(outsideSum, 2 * k), trap: 'stat-overlap-divide-2k' },
              { value: new Frac(tot, outN), trap: 'stat-overlap-divide-fewer' },
            ];
      const ch = numericChoices(rng, { correct: right, traps: cand, step: Math.max(2, Math.round(right.toNumber() / 7)), format: (v) => `$${fTex(v)}$` });
      if (ch.choices.filter((c) => c.trap).length < 3) continue;
      const first = n - k + 1; // first shared day
      const shared = o === 1 ? `day ${k}` : `days ${first} through ${k}`;
      const unit = ctx.unit;
      const stemOverlap = o === 1 ? `On ${shared}, ${c} ${unit} were counted.` : `The average per day over ${shared} was ${c} ${unit}.`;
      const question =
        ask === 'all'
          ? `What was the average (arithmetic mean) number of ${unit} per day over all ${n} days?`
          : `What was the average (arithmetic mean) number of ${unit} per day over the days other than ${shared}?`;
      const sharedTot = o * c;
      const days = o === 1 ? 'day' : 'days';
      const trapText: Record<string, string> = {
        'stat-overlap-mean-of-means': `Averaging $${a}$ and $${b}$ gives $${fTex(new Frac(a + b, 2))}$, but the groups overlap, so this ignores how many days each total covers.`,
        'stat-overlap-double-count': `Adding the two totals and dividing by ${n} gives $${fTex(new Frac(k * a + k * b, n))}$, which counts the shared ${days} twice.`,
        'stat-overlap-avg-not-total': `Taking away only $${c}$ gives $${fTex(new Frac(k * a + k * b - c, n))}$, yet the shared days total $${sharedTot}$.`,
        'stat-overlap-divide-2k': `Dividing by ${2 * k} gives $${fTex(new Frac(ask === 'all' ? tot : outsideSum, 2 * k))}$, but ${ask === 'all' ? `there are only ${n} different days` : `${2 * k} counts the shared ${days} twice`}.`,
        'stat-overlap-added': `Adding the shared total gives $${fTex(new Frac(k * a + k * b + o * c, n))}$, which counts it a third time.`,
        'stat-overlap-answered-all': `The average over all ${n} days gives $${fTex(new Frac(tot, n))}$, but the question leaves the shared ${days} out.`,
        'stat-overlap-removed-once': `Removing the shared total once gives $${fTex(new Frac(tot - o * c, outN))}$, but it sits in the sum twice.`,
        'stat-overlap-divide-n': `Dividing by ${n} gives $${fTex(new Frac(outsideSum, n))}$, but ${o} ${days} left the count too.`,
        'stat-overlap-removed-twice': `Taking the shared total out twice and dividing by ${n} gives $${fTex(new Frac(outsideSum, n))}$, but the sum then covers fewer days.`,
        'stat-overlap-divide-extra': `Dividing by ${n + o} gives $${fTex(new Frac(tot, n + o))}$, but there are only ${n} different days.`,
        'stat-overlap-divide-fewer': `Dividing the sum of all ${n} days by ${outN} gives $${fTex(new Frac(tot, outN))}$, which mixes two different sets of days.`,
        'stat-overlap-divide-k': `Dividing by ${k} gives $${fTex(new Frac(outsideSum, k))}$, which is the wrong count.`,
      };
      const used = rng.pick(ch.choices.filter((c) => c.trap)).trap!;
      const steps =
        ask === 'all'
          ? `The first ${k} days total $${k} \\times ${a} = ${k * a}$ and the last ${k} days total $${k} \\times ${b} = ${k * b}$. The shared ${days} ${o === 1 ? 'is' : 'are'} in both totals and add up to $${o} \\times ${c} = ${sharedTot}$, so take that away once: $${k * a} + ${k * b} - ${sharedTot} = ${tot}$ for ${n} days. The average is $${tot} \\div ${n} = ${fTex(right)}$.`
          : `The first ${k} days total $${k * a}$ and the last ${k} days total $${k * b}$. The shared ${days} (total $${sharedTot}$) ${o === 1 ? 'is' : 'are'} in both, so the sum over all ${n} days is $${k * a} + ${k * b} - ${sharedTot} = ${tot}$. Remove the shared ${days} once more: $${tot} - ${sharedTot} = ${outsideSum}$ over $${outN}$ days, an average of $${fTex(right)}$.`;
      return {
        params: { n, k, o, a, b, c, ask },
        q: {
          format: 'mcs',
          stem: `${ctx.intro(n)} The average (arithmetic mean) number of ${unit} per day was ${a} over the first ${k} days and ${b} over the last ${k} days. ${stemOverlap}

${question}`,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `Groups that overlap: work with totals, because average times count is a total.

${steps}

Check: ${ask === 'all' ? `$${k * a} + ${k * b}$ exceeds $${tot}$ by exactly the shared total.` : `first days only, shared days and last days only add back to $${tot}$.`}

Trap: ${trapText[used]}

Rule: totals add, averages do not; a member in two groups is subtracted once.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // build an explicit list that fits the three facts, then average it
    const only = p.k - p.o;
    const left = new Frac(p.k * p.a - p.o * p.c, only);
    const right = new Frac(p.k * p.b - p.o * p.c, only);
    const days: Frac[] = [];
    for (let i = 0; i < only; i++) days.push(left);
    for (let i = 0; i < p.o; i++) days.push(frac(p.c));
    for (let i = 0; i < only; i++) days.push(right);
    const sum = (xs: Frac[]) => xs.reduce((s, x) => s.add(x), frac(0));
    if (days.length !== p.n) return 'list length';
    if (!sum(days.slice(0, p.k)).div(p.k).eq(p.a) || !sum(days.slice(days.length - p.k)).div(p.k).eq(p.b)) return 'list does not fit';
    const expected = p.ask === 'all' ? sum(days).div(p.n) : sum([...days.slice(0, only), ...days.slice(days.length - only)]).div(2 * only);
    const keyed = q.choices[q.answer].text;
    return keyed === `$${fTex(expected)}$` ? null : `expected ${fTex(expected)}, keyed ${keyed}`;
  },
};

export const centerOverlapTemplates: Template<any>[] = [overlapMcs];
