import { numericChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num, usd } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { fTex } from './util';

export const weightedPercentTraps: Record<string, Trap> = {
  'stat-pct-unweighted': {
    label: 'Averaged the group averages without using the percents',
    fix: 'Each group counts in proportion to its share. Multiply each average by its percent, add, and divide by 100.',
  },
  'stat-pct-largest-group': {
    label: 'Took the average of the largest group',
    fix: 'The largest group pulls the overall average toward its own, but the other groups still move it.',
  },
  'stat-pct-midrange': {
    label: 'Took the midpoint of the highest and lowest averages',
    fix: 'The midpoint is right only when two groups are equal in size. Weight every group by its percent.',
  },
  'stat-pct-remainder-ignored': {
    label: 'Left out the group that was described as the rest',
    fix: 'Percents add to 100. Find the share of the remaining group by subtraction and include it.',
  },
  'stat-pct-fraction-of-whole': {
    label: 'Took a fraction of the rest as a fraction of everyone',
    fix: '"Of the other employees" means the fraction applies to the rest, so multiply it by the remaining percent.',
  },
};

interface Params {
  mode: 'all' | 'rest' | 'chain';
  money: boolean;
  shares: number[];
  avgs: number[];
  /** for the chain mode: percent of everyone in the first group and the fraction of the rest in the second */
  first: number;
  f: [number, number];
}

const CTX = [
  {
    who: 'employees',
    names: ['Sales', 'Support', 'Engineering'],
    place: (g: string) => `work in ${g}`,
    ask: 'the average annual salary of all the employees',
    each: (v: string, g: string) => `${v} in ${g}`,
    measure: 'annual salary',
    money: true,
    unit: 1000,
    lo: 32,
    hi: 96,
  },
  {
    who: 'students',
    names: ['Section A', 'Section B', 'Section C'],
    place: (g: string) => `are in ${g}`,
    ask: 'the average score of all the students',
    each: (v: string, g: string) => `${v} in ${g}`,
    measure: 'score',
    money: false,
    unit: 1,
    lo: 52,
    hi: 98,
  },
  {
    who: 'orders',
    names: ['small', 'medium', 'large'],
    place: (g: string) => `are ${g} orders`,
    ask: 'the average value of all the orders',
    each: (v: string, g: string) => `${v} for ${g} orders`,
    measure: 'value',
    money: true,
    unit: 1,
    lo: 8,
    hi: 90,
  },
];

const FRACS: [number, number][] = [
  [1, 4],
  [1, 3],
  [1, 2],
  [2, 3],
  [3, 4],
];

const percentMcs: Template<Params> = {
  id: 'data.weighted.percent-shares',
  skill: 'data.weighted',
  format: 'mcs',
  style: 'overall average from percent shares, including a share left as the rest',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    const mode: Params['mode'] = d === 1 ? 'all' : d === 2 ? 'rest' : 'chain';
    for (;;) {
      let shares: number[];
      let first = 0;
      let f: [number, number] = [0, 1];
      if (mode === 'chain') {
        f = rng.pick(FRACS);
        first = 5 * rng.int(2, 12);
        const rest = 100 - first;
        const second = (rest * f[0]) / f[1];
        if (!Number.isInteger(second) || second < 5 || rest - second < 5) continue;
        shares = [first, second, rest - second];
      } else {
        const a = 5 * rng.int(2, 12);
        const b = 5 * rng.int(2, 12);
        if (a + b > 90) continue;
        shares = [a, b, 100 - a - b];
      }
      if (new Set(shares).size < 3 && d > 1) continue;
      const avgs = Array.from({ length: 3 }, () => rng.int(ctx.lo, ctx.hi) * ctx.unit);
      if (new Set(avgs).size < 3) continue;
      const right = shares.reduce((s, p, i) => s.add(frac(p * avgs[i])), frac(0)).div(100);
      if (!right.isTerminating()) continue;
      const simple = new Frac(avgs.reduce((s, x) => s + x, 0), 3);
      if (!simple.mul(100).isInt()) continue;
      const biggest = shares.indexOf(Math.max(...shares));
      const cand: { value: Frac; trap: string }[] = [
        { value: simple, trap: 'stat-pct-unweighted' },
        { value: frac(avgs[biggest]), trap: 'stat-pct-largest-group' },
        { value: new Frac(Math.max(...avgs) + Math.min(...avgs), 2), trap: 'stat-pct-midrange' },
      ];
      if (mode !== 'all')
        cand.push({
          value: new Frac(shares[0] * avgs[0] + shares[1] * avgs[1], shares[0] + shares[1]),
          trap: 'stat-pct-remainder-ignored',
        });
      if (mode === 'chain') {
        const wrong2 = (100 * f[0]) / f[1];
        if (Number.isInteger(wrong2) && wrong2 + first < 100)
          cand.push({
            value: new Frac(first * avgs[0] + wrong2 * avgs[1] + (100 - first - wrong2) * avgs[2], 100),
            trap: 'stat-pct-fraction-of-whole',
          });
      }
      cand.splice(0, cand.length, ...cand.filter((c) => c.value.mul(100).isInt()));
      const fmt = (v: Frac) => (ctx.money ? usd(v.toNumber(), v.isInt() ? undefined : 2) : `$${fTex(v)}$`);
      const ch = numericChoices(rng, { correct: right, traps: cand, format: fmt, step: ctx.unit === 1000 ? 1000 * Math.max(1, Math.round(right.toNumber() / 12000)) : Math.max(2, Math.round(right.toNumber() / 12)) });
      if (ch.choices.filter((c) => c.trap).length < 3) continue;

      const val = (x: number) => (ctx.money ? usd(x) : String(x));
      const [g0, g1, g2] = ctx.names;
      const sentence =
        mode === 'all'
          ? `${shares[0]}% of the ${ctx.who} ${ctx.place(g0)}, ${shares[1]}% ${ctx.place(g1)}, and ${shares[2]}% ${ctx.place(g2)}.`
          : mode === 'rest'
            ? `${shares[0]}% of the ${ctx.who} ${ctx.place(g0)} and ${shares[1]}% ${ctx.place(g1)}; the rest ${ctx.place(g2)}.`
            : `${first}% of the ${ctx.who} ${ctx.place(g0)}. Of the other ${ctx.who}, ${f[0] === 1 ? `1/${f[1]}` : `${f[0]}/${f[1]}`} ${ctx.place(g1)} and the rest ${ctx.place(g2)}.`;
      const avgSentence = `The average (arithmetic mean) ${ctx.measure} is ${ctx.each(val(avgs[0]), g0)}, ${ctx.each(val(avgs[1]), g1)}, and ${ctx.each(val(avgs[2]), g2)}.`;
      const terms = shares.map((p, i) => `${p}(${ctx.money ? num(avgs[i]) : avgs[i]})`).join(' + ');
      const total = shares.reduce((s, p, i) => s + p * avgs[i], 0);
      const used = rng.pick(ch.choices.filter((c) => c.trap)).trap!;
      const trapV = (id: string) => cand.find((c) => c.trap === id)?.value ?? frac(0);
      const trapText: Record<string, string> = {
        'stat-pct-unweighted': `Averaging the three averages gives $${fTex(simple)}$, but the groups are not the same size.`,
        'stat-pct-largest-group': `The largest group alone gives $${fTex(frac(avgs[biggest]))}$, but the other groups still count.`,
        'stat-pct-midrange': `The midpoint of the highest and lowest averages gives $${fTex(trapV('stat-pct-midrange'))}$, which treats two groups as equal in size.`,
        'stat-pct-remainder-ignored': mode === 'all' ? '' : `Leaving out the last group gives $${fTex(trapV('stat-pct-remainder-ignored'))}$, yet it holds ${shares[2]}% of the ${ctx.who}.`,
        'stat-pct-fraction-of-whole': mode === 'chain' ? `Taking the fraction of everyone gives $${fTex(trapV('stat-pct-fraction-of-whole'))}$, but it applies to the other ${100 - first}% only.` : '',
      };
      const setup =
        mode === 'all'
          ? `Think of 100 ${ctx.who}: ${shares[0]}, ${shares[1]} and ${shares[2]} in the three groups.`
          : mode === 'rest'
            ? `Think of 100 ${ctx.who}. The last group is what is left: $100 - ${shares[0]} - ${shares[1]} = ${shares[2]}$.`
            : `Think of 100 ${ctx.who}. The other ${100 - first} include $${f[0]}/${f[1]} \\times ${100 - first} = ${shares[1]}$ in ${g1}, which leaves $${100 - first} - ${shares[1]} = ${shares[2]}$ in ${g2}.`;
      return {
        params: { mode, money: ctx.money, shares, avgs, first, f },
        q: {
          format: 'mcs',
          stem: `${sentence[0].toUpperCase()}${sentence.slice(1)} ${avgSentence}

What is ${ctx.ask}?`,
          choices: ch.choices,
          answer: ch.answer,
          explanation: `Percents are weights: each group's average counts in proportion to its share.

${setup} The total is $${terms} = ${num(total)}$, and the average is $${num(total)} \\div 100 = ${fTex(right)}$.

Check: the result lies between the lowest and the highest average, nearer the groups with the larger shares.

Trap: ${trapText[used]}

Rule: weights must add to 100%; find any missing share by subtraction, then take the weighted sum over 100.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // expand a population of 1000 individuals and average them
    const shares = p.mode === 'chain' ? [p.first, ((100 - p.first) * p.f[0]) / p.f[1], 0] : p.shares.slice();
    if (p.mode === 'chain') shares[2] = 100 - shares[0] - shares[1];
    const people: number[] = [];
    shares.forEach((s, i) => {
      for (let j = 0; j < s * 10; j++) people.push(p.avgs[i]);
    });
    if (people.length !== 1000) return 'population size';
    const expected = new Frac(people.reduce((s, x) => s + x, 0), people.length);
    const keyed = q.choices[q.answer].text;
    const shown = p.money ? usd(expected.toNumber(), expected.isInt() ? undefined : 2) : `$${fTex(expected)}$`;
    return keyed === shown ? null : `expected ${shown}, keyed ${keyed}`;
  },
};

export const weightedPercentTemplates: Template<any>[] = [percentMcs];
