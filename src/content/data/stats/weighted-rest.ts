import { Frac, frac } from '../../../engine/frac';
import { num, usd } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { fTex } from './util';

export const weightedRestTraps: Record<string, Trap> = {
  'stat-rest-mirror': {
    label: 'Assumed the rest is as far on the other side of the overall average',
    fix: 'The distances to the overall average are balanced by the group sizes, not mirrored. Use totals: overall total minus the removed total.',
  },
  'stat-rest-divide-by-all': {
    label: 'Divided the remaining total by the whole count',
    fix: 'The remaining total belongs to the remaining members only, so divide by their number.',
  },
  'stat-rest-subtract-avg': {
    label: 'Subtracted the average of the removed group instead of its total',
    fix: 'Subtract the removed total (their average × their number) from the overall total.',
  },
  'stat-rest-one-group': {
    label: 'Removed only one of the two groups',
    fix: 'Take both removed totals out of the overall total, and both counts out of the overall count.',
  },
  'stat-rest-gap-unscaled': {
    label: 'Took the gap to the overall average without weighting it by the group sizes',
    fix: 'The removed members are k of them, each d above the overall average, so they hold k × d of surplus that the others must make up between them.',
  },
  'stat-rest-surplus-total': {
    label: 'Subtracted the surplus from the average without dividing by the remaining count',
    fix: 'The surplus k × d is spread over the remaining members, so divide it by their number.',
  },
};

type Mode = 'one' | 'percent' | 'sub' | 'two' | 'relative';

interface Params {
  mode: Mode;
  N: number;
  A: Frac;
  k1: number;
  B1: number;
  k2: number;
  B2: number;
  dd: number;
  /** average of the remaining members (the answer, except in 'sub' mode where it is given) */
  R: number;
}

const CTX = [
  {
    members: 'students',
    noun: 'score',
    top: (k: number) => `The ${k} highest scores`,
    low: (k: number) => `the ${k} lowest scores`,
    stemAvg: (N: number, A: string) => `The average (arithmetic mean) score of ${N} students on a test was ${A}.`,
    val: (x: number) => `${x}`,
    amt: (x: number) => `${x} points`,
    pre: undefined as string | undefined,
    suf: 'points' as string | undefined,
    unit: 1,
    lo: 48,
    hi: 96,
  },
  {
    members: 'employees',
    noun: 'salary',
    top: (k: number) => `The ${k} highest salaries`,
    low: (k: number) => `the ${k} lowest salaries`,
    stemAvg: (N: number, A: string) => `The average (arithmetic mean) annual salary of ${N} employees of a company is ${A}.`,
    val: (x: number) => usd(x),
    amt: (x: number) => usd(x),
    pre: '\\$' as string | undefined,
    suf: undefined as string | undefined,
    unit: 1000,
    lo: 34,
    hi: 98,
  },
  {
    members: 'parcels',
    noun: 'weight',
    top: (k: number) => `The ${k} heaviest parcels`,
    low: (k: number) => `the ${k} lightest parcels`,
    stemAvg: (N: number, A: string) => `The average (arithmetic mean) weight of ${N} parcels is ${A} kilograms.`,
    val: (x: number) => `${x}`,
    amt: (x: number) => `${x} kilograms`,
    pre: undefined as string | undefined,
    suf: 'kilograms' as string | undefined,
    unit: 1,
    lo: 6,
    hi: 48,
  },
];

const restNE: Template<Params> = {
  id: 'data.weighted.rest-average',
  skill: 'data.weighted',
  format: 'ne',
  style: 'average of the remaining members after a subgroup is taken out of the whole',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    const mode: Mode = d === 1 ? 'one' : d === 2 ? rng.pick(['percent', 'sub', 'one']) : rng.pick(['two', 'relative', 'two']);
    const clean = (traps: { value: Frac; trap: string }[], answer: Frac) => {
      const seen = new Set<string>();
      return traps.filter((t) => t.value.gt(0) && !t.value.eq(answer) && t.value.mul(100).isInt() && !seen.has(t.value.toString()) && !!seen.add(t.value.toString()));
    };
    for (;;) {
      const N = mode === 'percent' ? 20 * rng.int(1, 4) + 20 : rng.int(d === 1 ? 10 : 12, d === 3 ? 60 : 40);
      let k1: number;
      if (mode === 'percent') {
        k1 = (N * rng.pick([10, 20, 25, 40])) / 100;
        if (!Number.isInteger(k1)) continue;
      } else k1 = rng.int(3, Math.floor(N / 2) - 1);
      const k2 = mode === 'two' ? rng.int(3, Math.floor(N / 3)) : 0;
      const rest = N - k1 - k2;
      if (rest < 4) continue;
      const B1 = rng.int(ctx.lo, ctx.hi) * ctx.unit;
      const B2 = rng.int(ctx.lo, ctx.hi) * ctx.unit;
      const R = rng.int(ctx.lo, ctx.hi) * ctx.unit;
      if (mode !== 'sub' && B1 <= R) continue; // "highest" members average above the rest
      if (mode === 'two' && B2 >= R) continue;
      let A: Frac;
      let dd = 0;

      if (mode === 'relative') {
        dd = rng.int(3, 12) * ctx.unit;
        A = frac(rng.int(ctx.lo + 10, ctx.hi - 10) * ctx.unit);
        const answer = A.sub(new Frac(k1 * dd, N - k1));
        if (!answer.mul(10).isInt() || answer.lte(0)) continue;
        const gap = new Frac(k1 * dd, N - k1);
        const traps = clean(
          [
            { value: A.sub(dd), trap: 'stat-rest-gap-unscaled' },
            { value: A.sub(new Frac(k1 * dd, N)), trap: 'stat-rest-divide-by-all' },
            { value: A.sub(k1 * dd), trap: 'stat-rest-surplus-total' },
          ],
          answer,
        );
        const cited = traps.find((t) => t.trap === 'stat-rest-gap-unscaled');
        if (!cited) continue;
        return {
          params: { mode, N, A, k1, B1, k2, B2, dd, R: answer.toNumber() },
          q: {
            format: 'ne',
            stem: `${ctx.stemAvg(N, ctx.val(A.toNumber()))} ${ctx.top(k1)} average ${ctx.amt(dd)} above the average of all ${N}. What is the average ${ctx.noun} of the other ${N - k1} ${ctx.members}?`,
            ...(ctx.pre ? { prefix: ctx.pre } : {}),
            ...(ctx.suf ? { suffix: ctx.suf } : {}),
            answer,
            traps,
            explanation: `Deviations from the overall average add up to zero, so what the top group holds above the average, the others hold below it.

The top ${k1} sit $${k1} \\times ${num(dd)} = ${num(k1 * dd)}$ above the overall average in total. The other ${N - k1} sit that far below in total, so each is $${num(k1 * dd)} \\div ${N - k1} = ${fTex(gap)}$ below on average. The average of the others is $${fTex(A)} - ${fTex(gap)} = ${fTex(answer)}$.

Check: $${k1}(${fTex(A.add(dd))}) + ${N - k1}(${fTex(answer)})$ equals $${N} \\times ${fTex(A)}$.

Trap: subtracting only $${num(dd)}$ gives $${fTex(cited.value)}$, which ignores that ${k1} values sit above and ${N - k1} below.

Rule: the surplus of one part is balanced by the deficit of the rest, weighted by the sizes.`,
          },
        };
      }

      A = new Frac(k1 * B1 + k2 * B2 + rest * R, N);
      if (!A.mul(10).isInt() || A.eq(R) || A.eq(B1)) continue;
      const total = frac(N).mul(A);
      const topTxt = ctx.top(k1);
      let answer: Frac;
      let traps: { value: Frac; trap: string }[];
      let stem: string;
      let steps: string;
      let trapOf: (v: Frac) => string;
      let citeId: string;
      if (mode === 'sub') {
        answer = frac(B1);
        traps = [
          { value: A.mul(2).sub(R), trap: 'stat-rest-mirror' },
          { value: total.sub(frac((N - k1) * R)).div(N), trap: 'stat-rest-divide-by-all' },
          { value: total.sub(frac(R)).div(k1), trap: 'stat-rest-subtract-avg' },
        ];
        citeId = 'stat-rest-mirror';
        stem = `${ctx.stemAvg(N, ctx.val(A.toNumber()))} The average ${ctx.noun} of ${N - k1} of them is ${ctx.amt(R)}. What is the average ${ctx.noun} of the other ${k1} ${ctx.members}?`;
        steps = `The total of all ${N} is $${N} \\times ${fTex(A)} = ${fTex(total)}$. The ${N - k1} others hold $${N - k1} \\times ${num(R)} = ${num((N - k1) * R)}$, so the other ${k1} hold $${fTex(total)} - ${num((N - k1) * R)} = ${num(k1 * B1)}$, an average of $${num(k1 * B1)} \\div ${k1} = ${num(B1)}$.`;
        trapOf = (v) => `reflecting ${num(R)} about the overall average gives $${fTex(v)}$, but groups of different sizes balance unequally.`;
      } else if (mode === 'two') {
        answer = frac(R);
        traps = [
          { value: total.sub(frac(k1 * B1)).div(N - k1), trap: 'stat-rest-one-group' },
          { value: total.sub(frac(k1 * B1 + k2 * B2)).div(N), trap: 'stat-rest-divide-by-all' },
          { value: total.sub(frac(B1 + B2)).div(rest), trap: 'stat-rest-subtract-avg' },
        ];
        citeId = 'stat-rest-one-group';
        stem = `${ctx.stemAvg(N, ctx.val(A.toNumber()))} ${topTxt} average ${ctx.amt(B1)}, and ${ctx.low(k2)} average ${ctx.amt(B2)}. What is the average ${ctx.noun} of the remaining ${rest} ${ctx.members}?`;
        steps = `The total of all ${N} is $${N} \\times ${fTex(A)} = ${fTex(total)}$. The two groups hold $${k1} \\times ${num(B1)} = ${num(k1 * B1)}$ and $${k2} \\times ${num(B2)} = ${num(k2 * B2)}$, so the remaining ${rest} hold $${fTex(total)} - ${num(k1 * B1)} - ${num(k2 * B2)} = ${num(rest * R)}$, an average of $${num(rest * R)} \\div ${rest} = ${num(R)}$.`;
        trapOf = (v) => `removing only the top group gives $${fTex(v)}$, which still includes the ${k2} lowest.`;
      } else {
        answer = frac(R);
        traps = [
          { value: A.mul(2).sub(B1), trap: 'stat-rest-mirror' },
          { value: total.sub(frac(k1 * B1)).div(N), trap: 'stat-rest-divide-by-all' },
          { value: total.sub(frac(B1)).div(N - k1), trap: 'stat-rest-subtract-avg' },
        ];
        citeId = 'stat-rest-divide-by-all';
        const share = mode === 'percent' ? ` (${Math.round((k1 * 100) / N)}% of them)` : '';
        stem = `${ctx.stemAvg(N, ctx.val(A.toNumber()))} ${topTxt}${share} average ${ctx.amt(B1)}. What is the average ${ctx.noun} of the other ${N - k1} ${ctx.members}?`;
        steps = `The total of all ${N} is $${N} \\times ${fTex(A)} = ${fTex(total)}$. The top ${k1} hold $${k1} \\times ${num(B1)} = ${num(k1 * B1)}$, leaving $${fTex(total)} - ${num(k1 * B1)} = ${num((N - k1) * R)}$ for ${N - k1} ${ctx.members}, an average of $${num((N - k1) * R)} \\div ${N - k1} = ${num(R)}$.`;
        trapOf = (v) => `dividing the remaining total by ${N} gives $${fTex(v)}$, but only ${N - k1} ${ctx.members} remain.`;
      }
      const kept = clean(traps, answer);
      const cited = kept.find((t) => t.trap === citeId);
      if (!cited) continue;
      return {
        params: { mode, N, A, k1, B1, k2, B2, dd, R },
        q: {
          format: 'ne',
          stem,
          ...(ctx.pre ? { prefix: ctx.pre } : {}),
          ...(ctx.suf ? { suffix: ctx.suf } : {}),
          answer,
          traps: kept,
          explanation: `Averages hide totals, so turn each average into a total, then take the known part out of the whole.

${steps}

Check: the parts add back to $${fTex(total)}$, the total of all ${N}.

Trap: ${trapOf(cited.value).replace(/^./, (c) => c.toUpperCase())}

Rule: total = average × count; subtract totals, never averages, and divide by the count that matches.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    // forward substitution: rebuild the whole list from the keyed answer and recompute the overall average
    const key = q.answer;
    const repeat = (n: number, x: Frac) => Array.from({ length: n }, () => x);
    let parts: Frac[];
    if (p.mode === 'relative') parts = [...repeat(p.k1, p.A.add(p.dd)), ...repeat(p.N - p.k1, key)];
    else if (p.mode === 'sub') parts = [...repeat(p.k1, key), ...repeat(p.N - p.k1, frac(p.R))];
    else parts = [...repeat(p.k1, frac(p.B1)), ...repeat(p.k2, frac(p.B2)), ...repeat(p.N - p.k1 - p.k2, key)];
    const mean = parts.reduce((s, x) => s.add(x), frac(0)).div(p.N);
    return mean.eq(p.A) ? null : `rebuilt average ${mean}, expected ${p.A}`;
  },
};

export const weightedRestTemplates: Template<any>[] = [restNE];
