import { Frac } from '../../../engine/frac';
import { num, plain } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { close, expectMCS, F, numChoices, spreadFillers } from './util';

export const percentChainTraps: Record<string, Trap> = {
  'sp-wrong-group': {
    label: 'Found a group that is not the one asked for',
    fix: 'Reread the last line of the question. "Enrolled but not studying Japanese" is the first group minus the second, not the second group itself.',
  },
  'sp-complement-of-total': {
    label: 'Subtracted from the whole population instead of from the group',
    fix: '"Not in the second group" is asked inside the first group, so subtract from the first group, not from the total.',
  },
};

interface Ctx {
  open: (n: number) => string;
  unit: string;
  g1: string;
  n1: string;
  g2: string;
  n2: string;
  n3: string;
  g3: string;
}

const CONTEXTS: Ctx[] = [
  {
    open: (n) => `A school has ${plain(n)} students.`,
    unit: 'students',
    g1: 'are enrolled in a language course',
    n1: 'students enrolled in a language course',
    g2: 'study Japanese',
    n2: 'students enrolled in a language course who study Japanese',
    g3: 'take the advanced exam',
    n3: 'students enrolled in a language course who study Japanese and take the advanced exam',
  },
  {
    open: (n) => `A company has ${plain(n)} employees.`,
    unit: 'employees',
    g1: 'work in the sales division',
    n1: 'employees in the sales division',
    g2: 'work remotely',
    n2: 'employees in the sales division who work remotely',
    g3: 'earn a bonus',
    n3: 'employees in the sales division who work remotely and earn a bonus',
  },
  {
    open: (n) => `A survey asked ${plain(n)} people about how they travel.`,
    unit: 'people surveyed',
    g1: 'own a bicycle',
    n1: 'people who own a bicycle',
    g2: 'ride it to work',
    n2: 'people who own a bicycle and ride it to work',
    g3: 'ride it in winter',
    n3: 'people who own a bicycle, ride it to work, and ride it in winter',
  },
  {
    open: (n) => `A library has ${plain(n)} books.`,
    unit: 'books',
    g1: 'are novels',
    n1: 'novels',
    g2: 'have a leather cover',
    n2: 'novels that have a leather cover',
    g3: 'are over 400 pages long',
    n3: 'novels that have a leather cover and are over 400 pages long',
  },
];

type Kind = 'count' | 'not' | 'deep';

interface Params {
  kind: Kind;
  total: number;
  ps: number[];
  values: Frac[];
}

const TOTALS = [400, 800, 1200, 1600, 2000, 2400, 3200, 4000, 6000, 8000];
const PCTS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75];

const percentChainMCS: Template<Params> = {
  id: 'arith.successive-percent.percent-of-percent-mcs',
  skill: 'arith.successive-percent',
  format: 'mcs',
  style: 'a percent of a percent of a group: count the final subgroup (or the part left out)',
  generate(rng, d) {
    for (;;) {
      const kind: Kind = d === 1 ? 'count' : d === 2 ? 'not' : 'deep';
      const ctx = rng.pick(CONTEXTS);
      const total = rng.pick(TOTALS);
      const ps = Array.from({ length: kind === 'deep' ? 3 : 2 }, () => rng.pick(PCTS));
      if (kind !== 'count' && ps[0] === ps[1]) continue;
      const xs: Frac[] = [F(total)];
      for (const p of ps) xs.push(xs[xs.length - 1].mul(p).div(100));
      if (xs.some((x) => !x.isInt() || x.sign() <= 0)) continue;
      const [, x1, x2] = xs;
      const x3 = xs[3];
      const answerV = kind === 'count' ? x2 : kind === 'not' ? x1.sub(x2) : x3;
      if (answerV.sign() <= 0) continue;
      const traps: { value: Frac; trap: string }[] =
        kind === 'count'
          ? [
              { value: x1, trap: 'num-stopped-early' },
              { value: F(total).mul(ps[1]).div(100), trap: 'num-second-on-original' },
              { value: F(total).mul(ps[0] + ps[1]).div(100), trap: 'num-add-percents' },
            ]
          : kind === 'not'
            ? [
                { value: x2, trap: 'sp-wrong-group' },
                { value: F(total).sub(x2), trap: 'sp-complement-of-total' },
                { value: F(total).mul(100 - ps[1]).div(100), trap: 'num-second-on-original' },
                { value: x1, trap: 'num-stopped-early' },
              ]
            : [
                { value: x2, trap: 'num-stopped-early' },
                { value: F(total).mul(ps[2]).div(100), trap: 'num-second-on-original' },
                { value: x1.mul(ps[2]).div(100), trap: 'num-second-on-original' },
                { value: F(total).mul(ps[0] + ps[1] + ps[2]).div(100), trap: 'num-add-percents' },
              ];
      const fmt = (v: Frac) => `$${num(v.toNumber())}$`;
      const tr = traps.filter((t) => t.value.isInt() && t.value.sign() > 0 && !t.value.eq(answerV));
      const pool = [F(total), x1, x2, ...(x3 ? [x3] : []), answerV.mul(2), answerV.div(2)].filter((x) => x.isInt() && x.sign() > 0);
      const { choices, answer, values } = numChoices(rng, {
        correct: answerV,
        traps: tr,
        fillers: spreadFillers(
          rng,
          answerV,
          tr.map((t) => t.value),
          pool.filter((x) => x.lt(answerV)),
          pool.filter((x) => x.gt(answerV)),
        ),
        format: fmt,
        order: 'shuffled',
      });
      const sentences = [`${ps[0]}% of the ${ctx.unit} ${ctx.g1}.`, `${ps[1]}% of the ${ctx.n1} ${ctx.g2}.`, ...(kind === 'deep' ? [`${ps[2]}% of the ${ctx.n2} ${ctx.g3}.`] : [])];
      const ask =
        kind === 'count' ? `How many ${ctx.n2} are there?` : kind === 'not' ? `How many ${ctx.n1} do not ${ctx.g2}?` : `How many ${ctx.n3} are there?`;
      const steps = xs
        .slice(0, ps.length + 1)
        .map((x, i) => (i === 0 ? `${num(total)}` : `${num(xs[i - 1].toNumber())} \\times ${ps[i - 1] / 100} = ${num(x.toNumber())}`))
        .slice(1);
      const shown = tr.filter((t) => values.some((v) => v.eq(t.value)));
      const note = (t: { value: Frac; trap: string }) =>
        t.trap === 'num-stopped-early'
          ? `${fmt(t.value)} stops before the last percent`
          : t.trap === 'num-second-on-original'
            ? `${fmt(t.value)} takes the later percent of the wrong starting group`
            : t.trap === 'num-add-percents'
              ? `${fmt(t.value)} adds the percents, but each one applies to a smaller group`
              : t.trap === 'sp-wrong-group'
                ? `${fmt(t.value)} is the second group itself, not the part left out`
                : `${fmt(t.value)} subtracts from the whole instead of from the first group`;
      return {
        params: { kind, total, ps, values },
        q: {
          format: 'mcs',
          stem: `${ctx.open(total)} ${sentences.join(' ')} ${ask}`,
          choices,
          answer,
          explanation: `Each percent is taken of the group named just before it, so go down one group at a time.

${steps.map((s) => `- $${s}$`).join('\n')}${
            kind === 'not' ? `\n- $${num(x1.toNumber())} - ${num(x2.toNumber())} = ${num(answerV.toNumber())}$, the part of the first group left out.` : ''
          }

The answer is ${num(answerV.toNumber())}.${shown.length ? ` Trap: ${shown.slice(0, 2).map(note).join('; ')}.` : ''} A percent of a percent is a product of the fractions, applied to the group in front of it.`,
        },
      };
    }
  },
  check(q, { kind, total, ps, values }) {
    let count = total;
    const levels = [count];
    for (const p of ps) {
      count = (count * p) / 100;
      levels.push(count);
    }
    const expected = kind === 'count' ? levels[2] : kind === 'not' ? levels[1] - levels[2] : levels[3];
    const hits = values.flatMap((x, i) => (close(x.toNumber(), expected) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

export const percentChainTemplates: Template<any>[] = [percentChainMCS];
