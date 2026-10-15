import { Frac } from '../../../engine/frac';
import { num, plain, usd } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { close, dec, expectMCS, F, numChoices, spreadFillers, usdM } from './util';

export const compoundGrowthTraps: Record<string, Trap> = {
  'sp-extra-period': {
    label: 'Counted one period too many',
    fix: 'Three years of growth means three multiplications, one for each year. The starting amount is at time 0 and is not a period.',
  },
  'sp-simple-not-compound': {
    label: 'Added the same amount every period',
    fix: 'A percent change is taken on the amount at the START of each period, and that amount keeps changing. Growing 10% a year for 3 years multiplies by $1.1^3 = 1.331$, not by $1 + 3(0.1) = 1.3$.',
  },
};

const mult = (p: number) => F(1).add(F(p).div(100));

interface Phase {
  p: number;
  n: number;
}

interface Params {
  phases: Phase[];
  start: number;
  values: Frac[];
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const word = (p: number) => (p > 0 ? 'increases' : 'decreases');

const compoundMCS: Template<Params> = {
  id: 'arith.successive-percent.compound-mcs',
  skill: 'arith.successive-percent',
  format: 'mcs',
  style: 'the same percent change repeated every year (compound growth or decay)',
  generate(rng, d) {
    for (;;) {
      const money = rng.chance(0.5);
      let phases: Phase[];
      if (d === 1) phases = [{ p: rng.pick([1, -1]) * rng.pick([10, 20, 25, 30, 50]), n: 2 }];
      else if (d === 2) phases = [{ p: rng.pick([1, -1]) * rng.pick([10, 20, 25, 40, 50]), n: 3 }];
      else {
        phases = [
          { p: rng.pick([10, 20, 25, 50]), n: rng.int(2, 3) },
          { p: -rng.pick([10, 20, 25, 50]), n: 2 },
        ];
        if (rng.chance(0.5)) phases.reverse();
      }
      const start = money ? 1000 * rng.int(2, 40) : 10000 * rng.int(1, 30);
      const ms = phases.flatMap((ph) => Array.from({ length: ph.n }, () => mult(ph.p)));
      const fin = ms.reduce((v, m) => v.mul(m), F(start));
      if (!fin.mul(100).isInt() || (!money && !fin.isInt())) continue;
      const totalMult = fin.div(start);
      const traps: { value: Frac; trap: string }[] = [];
      if (phases.length === 1) {
        const { p, n } = phases[0];
        const lin = F(start).mul(F(1).add(F(p * n).div(100)));
        if (lin.sign() > 0) traps.push({ value: lin, trap: 'sp-simple-not-compound' });
        traps.push({ value: F(start).mul(mult(p).pow(n - 1)), trap: 'num-stopped-early' });
        traps.push({ value: F(start).mul(mult(-p).pow(n)), trap: 'num-change-direction' });
        traps.push({ value: F(start).mul(mult(p).pow(n + 1)), trap: 'sp-extra-period' });
      } else {
        const net = phases.reduce((s, ph) => s + ph.p * ph.n, 0);
        traps.push({ value: F(start).mul(F(1).add(F(net).div(100))), trap: 'num-add-percents' });
        const last = phases[1];
        traps.push({ value: ms.slice(0, -1).reduce((v, m) => v.mul(m), F(start)), trap: 'num-stopped-early' });
        traps.push({ value: F(start).mul(F(1).add(F(phases[0].p * phases[0].n).div(100))).mul(F(1).add(F(last.p * last.n).div(100))), trap: 'sp-simple-not-compound' });
      }
      const fmt = (v: Frac) => (money ? `$${usdM(v, !v.isInt())}$` : `$${num(v.toNumber())}$`);
      const pool = [F(start), ms[0].mul(start), fin.mul(2), fin.div(2), mult(-phases[0].p).mul(start)].filter((x) => x.sign() > 0 && x.mul(100).isInt() && (money || x.isInt()));
      const { choices, answer, values } = numChoices(rng, {
        correct: fin,
        traps: traps.filter((t) => t.value.mul(100).isInt() && (money || t.value.isInt())),
        fillers: spreadFillers(
          rng,
          fin,
          traps.map((t) => t.value),
          pool.filter((x) => x.lt(fin)),
          pool.filter((x) => x.gt(fin)),
        ),
        format: fmt,
        order: 'shuffled',
      });
      const startText = money ? `An investment is worth ${usd(start)} today.` : `A town has a population of ${plain(start)}.`;
      const what = money ? 'its value' : 'the population';
      const years = (n: number) => (n === 1 ? 'year' : `${n} years`);
      const stem =
        phases.length === 1
          ? `${startText} ${cap(what)} ${word(phases[0].p)} by ${Math.abs(phases[0].p)}% each year for the next ${phases[0].n} years, each change being a percent of the ${money ? 'value' : 'population'} at the start of that year. What is ${money ? 'the value' : 'the population'} at the end of the ${phases[0].n} years?`
          : `${startText} For the next ${phases[0].n} years, ${what} ${word(phases[0].p)} by ${Math.abs(phases[0].p)}% each year, and for the ${years(phases[1].n)} after that it ${word(phases[1].p)} by ${Math.abs(phases[1].p)}% each year. What is ${money ? 'the value' : 'the population'} at the end?`;
      const shown = (t: { value: Frac }) => values.some((x) => x.eq(t.value)) && !t.value.eq(fin);
      const bits = traps
        .filter(shown)
        .slice(0, 2)
        .map((t) =>
          t.trap === 'sp-simple-not-compound'
            ? `${fmt(t.value)} ${phases.length === 1 ? 'adds the same amount each period' : 'adds the same amount each year within each stretch'}, but each change is taken on the new amount`
            : t.trap === 'num-stopped-early'
              ? `${fmt(t.value)} leaves out the last period`
              : t.trap === 'num-add-percents'
                ? `${fmt(t.value)} adds the percents, but each change is taken on the new amount`
                : t.trap === 'sp-extra-period'
                  ? `${fmt(t.value)} counts one year too many`
                  : `${fmt(t.value)} runs the changes in the wrong direction`,
        );
      const chain = phases.map((ph) => `${dec(mult(ph.p))}^{${ph.n}}`).join(' \\times ');
      const powers = phases.map((ph) => dec(mult(ph.p).pow(ph.n))).join(' \\times ');
      const startTex = money ? usdM(F(start)) : num(start);
      return {
        params: { phases, start, values },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `A percent change repeated each year multiplies by the same factor each year, so the factor is raised to the number of years.

$${startTex} \\times ${chain} = ${startTex} \\times ${powers} = ${money ? usdM(fin, !fin.isInt()) : num(fin.toNumber())}$ (the total factor is $${dec(totalMult)}$).

Check: ${fin.gt(start) ? 'the result is above' : 'the result is below'} the start, which fits ${phases.length === 1 ? (phases[0].p > 0 ? 'growth' : 'decay') : 'the growth and the decay together'}.${bits.length ? `\n\nTrap: ${bits.join('; ')}.` : ''}`,
        },
      };
    }
  },
  check(q, { phases, start, values }) {
    let v = start;
    for (const ph of phases) for (let i = 0; i < ph.n; i++) v += (v * ph.p) / 100;
    const hits = values.flatMap((x, i) => (close(x.toNumber(), v) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

export const compoundGrowthTemplates: Template<any>[] = [compoundMCS];
