import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Figure, Template, Trap } from '../../../engine/types';
import { listTex, popSD } from './util';

export const spreadSdByHandTraps: Record<string, Trap> = {
  'stat-sd-variance-for-sd': {
    label: 'Gave the variance when the standard deviation was asked',
    fix: 'The variance is the average of the squared deviations. The standard deviation is its square root, and it has the units of the data.',
  },
  'stat-sd-mad': {
    label: 'Averaged the deviations without squaring them',
    fix: 'The standard deviation squares every deviation first, so large deviations count more. The average of the absolute deviations is a different measure and is smaller.',
  },
};

interface Params {
  values: number[];
  counts: number[];
}

const CTX = [
  { lead: (n: number) => `A quality inspector measured the lengths of ${n} bolts, in centimeters:`, ask: 'lengths', unit: 'centimeters' },
  { lead: (n: number) => `The ages of ${n} members of a chess club, in years, are`, ask: 'ages', unit: 'years' },
  { lead: (n: number) => `A runner's times over ${n} training runs, in minutes, were`, ask: 'times', unit: 'minutes' },
  { lead: (n: number) => `The number of orders a shop received on each of ${n} days was`, ask: 'numbers of orders', unit: 'orders' },
];

/** Exact standard deviation when the variance is a perfect square, else null. */
function exactSd(values: number[], counts: number[]): { mean: number; sd: number; variance: number; sumSq: number; n: number } | null {
  const n = counts.reduce((s, c) => s + c, 0);
  const total = values.reduce((s, v, i) => s + v * counts[i], 0);
  if (total % n) return null;
  const mean = total / n;
  const sumSq = values.reduce((s, v, i) => s + counts[i] * (v - mean) ** 2, 0);
  if (sumSq % n) return null;
  const variance = sumSq / n;
  const sd = Math.round(Math.sqrt(variance));
  return sd > 1 && sd * sd === variance ? { mean, sd, variance, sumSq, n } : null;
}

const sdByHand: Template<Params> = {
  id: 'data.spread.sd-by-hand',
  skill: 'data.spread',
  format: 'ne',
  style: 'standard deviation of a short list or a frequency table, computed from the deviations',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    for (;;) {
      let values: number[];
      let counts: number[];
      if (d < 3) {
        const n = d === 1 ? rng.int(4, 5) : rng.int(6, 8);
        const m = rng.int(12, 60);
        const devs = Array.from({ length: n - 1 }, () => rng.int(-8, 8));
        const last = -devs.reduce((s, x) => s + x, 0);
        if (Math.abs(last) > 10) continue;
        const list = [...devs, last].map((x) => m + x).sort((a, b) => a - b);
        if (new Set(list).size < 3) continue;
        values = list;
        counts = list.map(() => 1);
      } else {
        const k = rng.int(3, 5);
        const m = rng.int(15, 60);
        values = rng.sample(Array.from({ length: 19 }, (_, i) => m + i - 9), k).sort((a, b) => a - b);
        counts = values.map(() => rng.int(1, 4));
        if (counts.reduce((s, c) => s + c, 0) < 9 || counts.reduce((s, c) => s + c, 0) > 14) continue;
      }
      const r = exactSd(values, counts);
      if (!r) continue;
      const { mean, sd, variance, n } = r;
      const mad = new Frac(values.reduce((s, v, i) => s + counts[i] * Math.abs(v - mean), 0), n);
      const traps = [
        { value: frac(variance), trap: 'stat-sd-variance-for-sd' },
        { value: mad, trap: 'stat-sd-mad' },
      ].filter((t) => !t.value.eq(sd) && t.value.mul(100).isInt());
      if (!traps.some((t) => t.trap === 'stat-sd-variance-for-sd')) continue;
      let stem: string;
      let figure: Figure | undefined;
      if (d < 3) {
        stem = `${ctx.lead(n)} $${listTex(values)}$.

What is the standard deviation of the ${ctx.ask}?`;
      } else {
        stem = `The table shows how many times each value occurs in a data set of ${n} values.

What is the standard deviation of the data set?`;
        figure = {
          kind: 'table',
          title: 'DATA SET',
          headers: ['Value', 'Frequency'],
          rows: values.map((v, i) => [`$${num(v)}$`, `$${counts[i]}$`]),
        };
      }
      const devsTxt = values.map((v) => (v - mean === 0 ? '0' : v - mean > 0 ? `${v - mean}` : `-${mean - v}`));
      const sqTxt = values.map((v, i) => (counts[i] === 1 ? `${(v - mean) ** 2}` : `${counts[i]}(${(v - mean) ** 2})`));
      const meanLine =
        d < 3
          ? `The mean is $${num(values.reduce((s, v) => s + v, 0))} \\div ${n} = ${mean}$.`
          : `The mean is $${num(values.reduce((s, v, i) => s + v * counts[i], 0))} \\div ${n} = ${mean}$ (each value weighted by its frequency).`;
      return {
        params: { values, counts },
        q: {
          format: 'ne',
          stem,
          ...(figure ? { figure } : {}),
          ...(d < 3 ? { suffix: ctx.unit } : {}),
          answer: frac(sd),
          traps,
          explanation: `Standard deviation: the square root of the average squared distance from the mean.

${meanLine} The deviations are $${devsTxt.join(',\\ ')}$, and their squares add up to ${'$' + sqTxt.join(' + ') + ' = ' + r.sumSq + '$'}. Dividing by ${n} gives the variance $${variance}$, and its square root is $${sd}$.

Check: $${sd} \\times ${sd} = ${variance}$.

Trap: stopping at the variance gives $${variance}$, which is the squared standard deviation, not the standard deviation.

Rule: deviations, square, average, square root, in that order.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const all: number[] = [];
    p.values.forEach((v, i) => {
      for (let j = 0; j < p.counts[i]; j++) all.push(v);
    });
    const sd = popSD(all);
    return Math.abs(sd - q.answer.toNumber()) < 1e-9 ? null : `expected ${sd}`;
  },
};

export const spreadSdByHandTemplates: Template<any>[] = [sdByHand];
