import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { num, plain } from '../../../engine/tex';
import { decOrFrac, expectQC, F, pickWeighted, qcEnd, swapQC } from './util';

export const rateAverageSpeedTraps: Record<string, Trap> = {
  'rate-mean-of-speeds': {
    label: 'Averaged the speeds instead of dividing total distance by total time',
    fix: 'Average speed is total distance divided by total time. A trip spends more time at the slower speed, so the average of two speeds over equal distances is below their mean: $40$ and $60$ give $48$, not $50$.',
  },
};

type Mode = 'mean' | 'hit' | 'threshold' | 'equal-time' | 'unknown' | 'three' | 'weighted';

interface ASParams {
  mode: Mode;
  v: number[];
  /** distances of the two legs (weighted mode) */
  dist: number[];
  /** number compared with the average speed */
  value: Frac;
  swap: boolean;
}

const CTX = [
  { who: 'A car', go: 'drives from city P to city Q', back: 'returns along the same route', unit: 'miles per hour', len: 'miles' },
  {
    who: 'A cyclist',
    go: 'rides from the base of a hill to the summit',
    back: 'rides back down the same road',
    unit: 'kilometers per hour',
    len: 'kilometers',
  },
  { who: 'A delivery truck', go: 'drives from the depot to a store', back: 'returns to the depot by the same road', unit: 'miles per hour', len: 'miles' },
];

const T = (f: Frac) => `$${decOrFrac(f)}$`;
const gcd2 = (a: number, b: number): number => (b === 0 ? a : gcd2(b, a % b));
const lcm = (a: number, b: number) => (a / gcd2(a, b)) * b;
/** distance-weighted average speed of legs, as an exact Frac */
const avgOf = (v: number[], d: number[]): Frac => F(d.reduce((a, x) => a + x, 0)).div(d.reduce((a, x, i) => a.add(F(x, v[i])), F(0)));
const mean = (v: number[]): Frac =>
  F(
    v.reduce((a, x) => a + x, 0),
    v.length,
  );

const averageSpeed: Template<ASParams> = {
  id: 'arith.rates.average-speed-qc',
  skill: 'arith.rates',
  format: 'qc',
  style: 'average speed is total distance over total time, not the mean of the speeds',
  generate(rng, diff) {
    const ctx = rng.pick(CTX);
    const mode = pickWeighted<Mode>(
      rng,
      diff === 1
        ? [
            ['mean', 4],
            ['equal-time', 2],
            ['unknown', 2],
          ]
        : diff === 2
          ? [
              ['mean', 1.5],
              ['hit', 2],
              ['threshold', 3],
              ['equal-time', 1.5],
              ['unknown', 2],
            ]
          : [
              ['three', 4],
              ['weighted', 4],
              ['unknown', 2],
            ],
    );
    const swap = rng.chance(0.45);
    for (;;) {
      const v1 = rng.int(4, 18) * 5;
      const v2 = v1 + rng.pick([-1, 1]) * rng.int(2, 6) * 5;
      const v3 = rng.int(4, 18) * 5;
      if (v2 < 15 || v2 > 100 || Math.max(v1, v2) > 2.5 * Math.min(v1, v2)) continue;
      const v = mode === 'three' ? [v1, v2, v3] : [v1, v2];
      if (mode === 'three' && (new Set(v).size < 3 || Math.max(...v) > 2.5 * Math.min(...v))) continue;
      let dist: number[] = [];
      let value: Frac = mean(v);
      let rel: QCChoice;
      let info: string;
      let why: string;
      if (mode === 'equal-time') {
        info = `${ctx.who} makes a trip. For the first half of the travel time its speed is ${v1} ${ctx.unit}, and for the second half of the time its speed is ${v2} ${ctx.unit}.`;
        rel = 'C';
        why = `Take 2 hours: ${v1} for 1 hour and ${v2} for 1 hour cover ${v1} + ${v2} = ${v1 + v2} ${ctx.len} in 2 hours, so the average speed is $\\frac{${v1 + v2}}{2} = ${decOrFrac(value)}$. When the TIMES are equal, the average speed is the mean of the speeds.`;
      } else if (mode === 'unknown') {
        info = `${ctx.who} makes a one-way trip, driving part of the distance at ${v1} ${ctx.unit} and the rest at ${v2} ${ctx.unit}. Both parts have positive length, and nothing says they are equal.`;
        rel = 'D';
        const lo = Math.min(v1, v2);
        const hi = Math.max(v1, v2);
        why = `The average speed lies between ${lo} and ${hi}, but where depends on how the distance is split. Half the distance at each speed gives $\\frac{2 \\cdot ${v1} \\cdot ${v2}}{${v1} + ${v2}} = ${decOrFrac(avgOf(v, [1, 1]))}$, below the mean ${T(value)}. Almost all of the distance at ${hi} gives an average close to ${hi}, above ${T(value)}. The two cases disagree.`;
      } else if (mode === 'weighted') {
        const g = rng.pick([20, 30, 40, 60]);
        dist = [g * rng.int(1, 5), g * rng.int(1, 5)];
        if (dist[0] === dist[1]) continue;
        const avg = avgOf(v, dist);
        if (avg.eq(value)) continue;
        rel = avg.gt(value) ? 'A' : 'B';
        info = `${ctx.who} drives ${dist[0]} ${ctx.len} at ${v1} ${ctx.unit} and then ${dist[1]} ${ctx.len} at ${v2} ${ctx.unit}.`;
        why = `The total distance is ${dist[0]} + ${dist[1]} = ${dist[0] + dist[1]} ${ctx.len}. The time is $\\frac{${dist[0]}}{${v1}} + \\frac{${dist[1]}}{${v2}} = ${decOrFrac(F(dist[0], v1).add(F(dist[1], v2)))}$ hours. The average speed is ${T(avg)}${avg.isTerminating() ? '' : ` (about ${avg.toNumber().toFixed(2)})`}, ${avg.gt(value) ? 'above' : 'below'} the mean of the speeds ${T(value)}, because more time is spent at the ${avg.gt(value) ? 'faster' : 'slower'} speed ($\\frac{${dist[0]}}{${v1}}$ hours at ${v1} versus $\\frac{${dist[1]}}{${v2}}$ hours at ${v2}).`;
      } else {
        // equal one-way distances
        const D = v.reduce(lcm, 1);
        if (D > 720) continue;
        const avg = avgOf(
          v,
          v.map(() => D),
        );
        const hours = v.reduce((a, x) => a.add(F(D, x)), F(0));
        const dist2 = D * v.length;
        if (mode === 'hit') {
          if (!avg.isInt()) continue;
          value = avg;
        } else if (mode === 'threshold' || mode === 'three') {
          // an integer strictly between the average and the mean of the speeds
          const first = Math.floor(avg.toNumber()) + 1;
          const last = Math.ceil(value.toNumber()) - 1;
          if (first > last) continue;
          value = F(rng.int(first, last));
        }
        rel = avg.lt(value) ? 'B' : avg.gt(value) ? 'A' : 'C';
        const lead =
          v.length === 2
            ? `${ctx.who} ${ctx.go} at ${v1} ${ctx.unit} and ${ctx.back} at ${v2} ${ctx.unit}.`
            : `${ctx.who} makes a trip in three legs of equal length, traveling at ${v1}, ${v2}, and ${v3} ${ctx.unit} on the legs.`;
        info = lead;
        const dTxt = v.length === 2 ? 'one-way distance' : 'length of each leg';
        why = `Use a convenient ${dTxt}, ${plain(D)} ${ctx.len}. The times are ${v.map((x) => `$\\frac{${D}}{${x}} = ${D / x}$`).join(', ')} hours, ${T(hours)} in all, for ${plain(dist2)} ${ctx.len}. So the average speed is $\\frac{${num(dist2)}}{${num(hours)}}${gcd2(dist2, hours.n) > 1 || !hours.isInt() ? ` = ${decOrFrac(avg)}` : ''}$, ${rel === 'B' ? 'below' : rel === 'A' ? 'above' : 'equal to'} ${T(value)}. The mean of the speeds, ${T(mean(v))}, is higher than the average speed because more time is spent at the slower speeds.`;
      }
      const answer = swap ? swapQC(rel) : rel;
      // the mistake: taking the mean of the speeds for the average speed
      const naiveRel: QCChoice = mode === 'mean' || mode === 'weighted' ? 'C' : mean(v).gt(value) ? 'A' : mean(v).lt(value) ? 'B' : 'C';
      const naiveAns = swap ? swapQC(naiveRel) : naiveRel;
      const traps = mode === 'equal-time' || mode === 'unknown' || naiveAns === answer ? undefined : { [naiveAns]: 'rate-mean-of-speeds' };
      const A = `The average speed for the ${mode === 'mean' || mode === 'hit' || mode === 'threshold' ? 'round trip' : 'whole trip'}`;
      const qb = `$${decOrFrac(value)}$ ${ctx.unit}`;
      return {
        params: { mode, v, dist, value, swap },
        q: {
          format: 'qc',
          info,
          quantityA: swap ? qb : A,
          quantityB: swap ? A : qb,
          answer,
          ...(traps ? { traps } : {}),
          explanation: `Recognize: average speed is total distance divided by total time, over ${mode === 'weighted' ? 'both legs' : mode === 'three' ? 'the three legs' : 'the whole trip'}.

${why}

${qcEnd(answer)} Never average speeds when the distances (or times) are not simply equal.`,
        },
      };
    }
  },
  check(q, { mode, v, dist, value, swap }) {
    let samples: [Frac, Frac][] = [];
    if (mode === 'equal-time') {
      for (const T of [2, 4, 10])
        samples.push([
          F(
            v.reduce((a, x) => a + (x * T) / v.length, 0),
            T,
          ),
          value,
        ]);
    } else if (mode === 'unknown') {
      for (let k = 1; k < 20; k++) {
        // a share k/20 of the distance at the first speed
        const time = F(k, 20 * v[0]).add(F(20 - k, 20 * v[1]));
        samples.push([F(1).div(time), value]);
      }
    } else if (mode === 'weighted') {
      samples.push([avgOf(v, dist), value]);
    } else {
      // simulate: legs of length 1..3 times the lcm, speeds as given
      for (const k of [1, 2, 3]) {
        const D = v.reduce(lcm, 1) * k;
        let time = F(0);
        for (const s of v) time = time.add(F(D, s));
        samples.push([F(D * v.length).div(time), value]);
      }
    }
    if (swap) samples = samples.map(([a, b]) => [b, a]);
    return expectQC(q, qcFromSamples(samples));
  },
};

export const rateAverageSpeedTemplates: Template<any>[] = [averageSpeed];
