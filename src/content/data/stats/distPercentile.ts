import { Frac, frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { num, ordinal } from '../../../engine/tex';
import { NORMAL_CTX, normalFigure } from './distributions';
import { normalPercent } from './util';

// Numeric entry on a normal distribution: two known values (a mean or percentiles) fix the center and
// the spread, and a third percentile is asked.
export const distPercentileTraps: Record<string, Trap> = {
  'stat-pct-gap-one-sd': {
    label: 'Took the gap between the two values as one standard deviation',
    fix: 'The gap covers the difference of the two $z$-values, not always 1. Divide the gap by that difference to get one standard deviation.',
  },
  'stat-pct-mirror': {
    label: 'Moved the right distance in the wrong direction',
    fix: 'Percentiles below 50 lie below the mean and those above 50 lie above it. Subtract below the mean, add above it.',
  },
  'stat-pct-skip-mean': {
    label: 'Added standard deviations to a given value as if it were the mean',
    fix: 'Find the mean first. A given percentile is already $z$ standard deviations from the mean, so count only the remaining steps.',
  },
};

/** Percentile (from the figure) of each whole z on the tick marks. */
const PCT: Record<number, number> = { [-2]: 2, [-1]: 16, 0: 50, 1: 84, 2: 98 };

interface PctParams {
  mu: number;
  sigma: number;
  z1: number;
  z2: number;
  z3: number;
}

const percentileValue: Template<PctParams> = {
  id: 'data.distributions.percentile-value',
  skill: 'data.distributions',
  format: 'ne',
  style: 'normal distribution: from two known values (mean or percentiles) find the value at another percentile',
  generate(rng, d) {
    const ctx = rng.pick(NORMAL_CTX);
    for (;;) {
      const sigma = rng.int(ctx.sd[0], ctx.sd[1]);
      const mu = rng.int(ctx.mu[0] / 5, ctx.mu[1] / 5) * 5;
      const zs = [-2, -1, 0, 1, 2];
      let z1: number;
      let z2: number;
      let z3: number;
      if (d === 1) {
        z1 = 0; // the mean is given
        z2 = rng.pick([-2, -1, 1, 2]);
        z3 = rng.pick(zs.filter((z) => z !== 0 && z !== z2));
      } else {
        const pairs = d === 2 ? [[-1, 1], [-2, 2], [1, -1], [2, -2], [-1, 1]] : [[1, 2], [-2, -1], [-1, 2], [-2, 1], [2, -1], [1, -2], [-1, 0], [0, 1]];
        [z1, z2] = rng.pick(pairs);
        z3 = rng.pick(zs.filter((z) => z !== z1 && z !== z2));
        if (d === 2 && z3 === 0 && rng.chance(0.5)) continue;
      }
      if (mu - 2 * sigma <= 0) continue;
      const val = (z: number) => mu + z * sigma;
      const answer = val(z3);
      const gap = val(z2) - val(z1);
      const dz = z2 - z1;
      const sigmaWrong = Math.abs(gap);
      const muWrong = val(z1) - z1 * sigmaWrong;
      const traps: { value: Frac; trap: string }[] = [];
      const add = (v: number, trap: string) => {
        if (v > 0 && v !== answer && !traps.some((t) => t.value.eq(v))) traps.push({ value: frac(v), trap });
      };
      add(muWrong + z3 * sigmaWrong, 'stat-pct-gap-one-sd');
      add(mu - z3 * sigma, 'stat-pct-mirror');
      add(val(z1) + z3 * sigma, 'stat-pct-skip-mean');
      // the explanation cites the first trap that is distinct from the answer
      const cite = traps[0];
      if (!cite) continue;
      const lin = (base: number, z: number) => `${num(base)} ${z > 0 ? '+' : '-'} ${Math.abs(z) === 1 ? '' : `${Math.abs(z)} \\times `}${num(sigma)}`;
      const known = (z: number, v: number) => (z === 0 && d === 1 ? `The mean is $${num(v)}$ ${ctx.unit}` : `The ${ordinal(PCT[z])} percentile is $${num(v)}$ ${ctx.unit}`);
      const second = `the ${ordinal(PCT[z2])} percentile is $${num(val(z2))}$ ${ctx.unit}`;
      const intro = `The figure shows a normal distribution with mean 0 and standard deviation 1, with the approximate percent of the distribution in each of the six regions.`;
      const first = known(z1, val(z1));
      const askName = z3 === 0 ? 'median' : `${ordinal(PCT[z3])} percentile`;
      const stem = `${intro}\n\nThe ${ctx.noun} of ${ctx.who} in a large group are approximately normally distributed. ${first}, and ${second}. What is the ${askName} of the ${ctx.noun}?`;
      const steps = [
        `Adding the regions of the figure from the left gives the percent below each tick mark: $-2$: 2%, $-1$: 2 + 14 = 16%, $0$: 16 + 34 = 50%, $1$: 50 + 34 = 84%, $2$: 84 + 14 = 98%. So the ${z1 === 0 && d === 1 ? 'mean' : `${ordinal(PCT[z1])} percentile`} is at $z = ${z1}$ and the ${ordinal(PCT[z2])} percentile is at $z = ${z2}$.`,
        `The values are $${num(Math.abs(gap))}$ apart and ${Math.abs(dz)} standard deviation${Math.abs(dz) === 1 ? '' : 's'} apart, so one standard deviation is $${num(Math.abs(gap))} \\div ${Math.abs(dz)} = ${num(sigma)}$ ${ctx.unit}.${z1 === 0 ? '' : ` The mean is $${lin(val(z1), -z1)} = ${num(mu)}$.`}`,
        `The ${askName} is at $z = ${z3}$: $${lin(mu, z3)} = ${num(answer)}$.`,
      ];
      const trapText =
        cite.trap === 'stat-pct-gap-one-sd'
          ? `Trap: taking the gap of $${num(sigmaWrong)}$ as one standard deviation puts the mean at $${num(muWrong)}$ and gives $${num(cite.value.n)}$, but the gap spans ${Math.abs(dz)} of them.`
          : cite.trap === 'stat-pct-mirror'
            ? `Trap: stepping the wrong way from the mean gives $${num(cite.value.n)}$; the ${askName} is ${z3 < 0 ? 'below' : 'above'} the mean.`
            : `Trap: adding to ${z1 === 0 ? 'the' : 'the given'} value as if it were the mean gives $${num(cite.value.n)}$.`;
      return {
        params: { mu, sigma, z1, z2, z3 },
        q: {
          format: 'ne',
          figure: normalFigure(),
          stem,
          answer: frac(answer),
          suffix: ctx.unit,
          traps,
          explanation: `${steps.join('\n\n')}\n\n${trapText}\n\nTwo known points fix the mean and the standard deviation; then every percentile is the mean plus $z$ standard deviations.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    // Every stated percentile must be near the matching tick mark of the distribution.
    const v = (z: number) => p.mu + z * p.sigma;
    for (const z of [p.z1, p.z2, p.z3]) {
      const pct = normalPercent(p.mu, p.sigma, -Infinity, v(z));
      if (Math.abs(pct - PCT[z]) > 0.5) return `percentile of z=${z} is ${pct}`;
    }
    // Re-solve the two known values for the mean and the standard deviation by search.
    const a = v(p.z1);
    const b = v(p.z2);
    for (let s = 1; s <= 400; s++)
      for (let m = 1; m <= 2000; m++)
        if (m + p.z1 * s === a && m + p.z2 * s === b) {
          const expected = m + p.z3 * s;
          return q.answer.eq(frac(expected)) ? null : `expected ${expected}, keyed ${q.answer.toString()}`;
        }
    return 'no solution found';
  },
};

export const distPercentileTemplates: Template<any>[] = [percentileValue];
