import { qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { fTex } from './util';

export const weightedSpeedTraps: Record<string, Trap> = {
  'stat-speed-arith-mean': {
    label: 'Took the average speed to be the average of the two speeds',
    fix: 'Average speed is total distance divided by total time. Equal distances take more time at the slower speed, so the average speed is below the plain average of the speeds.',
  },
  'stat-speed-need-distance': {
    label: 'Said the relationship cannot be determined because a distance was not given',
    fix: 'Look for what the unknown cannot change: an average of two speeds always lies between them, whatever the weights are.',
  },
};

type Mode = 'equal-dist' | 'equal-time' | 'hm' | 'between';

interface Params {
  mode: Mode;
  u: number;
  v: number;
  L: number;
  t: number;
  side: 'A' | 'B';
}

/** "= 36" for a terminating value, "pprox 57.39" otherwise. */
const eq = (x: Frac) => (x.isTerminating() ? `= ${fTex(x)}` : `\\approx ${x.toNumber().toFixed(2)}`);

const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);

const VEHICLES = [
  { who: 'A delivery van', unit: 'miles per hour' },
  { who: 'A cyclist', unit: 'kilometers per hour' },
  { who: 'A commuter train', unit: 'miles per hour' },
  { who: 'A runner', unit: 'kilometers per hour' },
];

/** Average speed from total distance over total time, with exact arithmetic. */
const avgSpeed = (legs: { dist: Frac; speed: number }[]): Frac =>
  legs.reduce((s, l) => s.add(l.dist), frac(0)).div(legs.reduce((s, l) => s.add(l.dist.div(l.speed)), frac(0)));

const avgSpeedQC: Template<Params> = {
  id: 'data.weighted.average-speed-qc',
  skill: 'data.weighted',
  format: 'qc',
  style: 'average speed over equal distances, equal times, or an unknown split: weights decide',
  generate(rng, d) {
    const veh = rng.pick(VEHICLES);
    const side: 'A' | 'B' = rng.chance(0.5) ? 'A' : 'B';
    const mode: Mode =
      d === 1
        ? rng.pick(['equal-dist', 'equal-dist', 'equal-time', 'between'])
        : d === 2
          ? rng.pick(['equal-dist', 'equal-time', 'hm', 'between', 'between'])
          : rng.pick(['hm', 'hm', 'between', 'between', 'equal-dist']);
    for (;;) {
      const u = rng.int(4, 16) * 5;
      const v = rng.int(4, 16) * 5;
      if (u === v) continue;
      const lo = Math.min(u, v);
      const hi = Math.max(u, v);
      const L = rng.int(3, 12) * 10;
      const arith = new Frac(u + v, 2);
      const harm = new Frac(2 * u * v, u + v);

      if (mode === 'equal-dist') {
        const info = `${veh.who} makes a round trip over the same road, traveling at ${u} ${veh.unit} one way and at ${v} ${veh.unit} on the return.`;
        const qa = 'The average speed for the whole round trip, in the same unit';
        const qb = `$${fTex(arith)}$`;
        const ansA: QCChoice = 'B'; // harmonic mean is below the arithmetic mean
        const ans = side === 'A' ? ansA : flip(ansA);
        return {
          params: { mode, u, v, L: 0, t: 0, side },
          q: {
            format: 'qc',
            info,
            quantityA: side === 'A' ? qa : qb,
            quantityB: side === 'A' ? qb : qa,
            answer: ans,
            traps: { C: 'stat-speed-arith-mean' } as QCQuestion['traps'],
            explanation: `Average speed is total distance divided by total time, and both legs cover the same distance.

Take each leg to be $${u * v}$ long. The legs take $${u * v} \\div ${u} = ${v}$ and $${u * v} \\div ${v} = ${u}$ hours, so the round trip covers $${2 * u * v}$ in $${u + v}$ hours: $${2 * u * v} \\div ${u + v} ${eq(harm)}$.

Check: any other leg length gives the same ratio.

Trap: averaging the two speeds gives $${fTex(arith)}$, but more time is spent at the slower speed, which pulls the average below that.

Rule: equal distances weight the speeds by time, so the slower speed counts more. The average of the speeds is the answer only when the times are equal.`,
          },
        };
      }

      if (mode === 'equal-time') {
        const hours = rng.pick([2, 3, 4]);
        const info = `${veh.who} travels at ${u} ${veh.unit} for the first ${hours} hours of a trip and at ${v} ${veh.unit} for the next ${hours} hours.`;
        const qa = 'The average speed for the whole trip, in the same unit';
        const qb = `$${fTex(arith)}$`;
        return {
          params: { mode, u, v, L: hours, t: 0, side },
          q: {
            format: 'qc',
            info,
            quantityA: side === 'A' ? qa : qb,
            quantityB: side === 'A' ? qb : qa,
            answer: 'C',
            traps: { D: 'stat-speed-need-distance' } as QCQuestion['traps'],
            explanation: `Average speed is total distance divided by total time. Here the times are equal, so each speed gets the same weight.

The distances are $${u} \\times ${hours} = ${u * hours}$ and $${v} \\times ${hours} = ${v * hours}$, total $${(u + v) * hours}$, in $${2 * hours}$ hours: $${(u + v) * hours} \\div ${2 * hours} = ${fTex(arith)}$.

Check: with any other equal time the hours cancel.

Trap: not being given the distance does not make the relationship undeterminable, because equal times fix the weights.

Rule: equal times give the plain average of the speeds; equal distances do not.`,
          },
        };
      }

      if (mode === 'hm') {
        if ((2 * u * v) % (u + v) !== 0) continue;
        const h = harm.n;
        const bVal = rng.pick([frac(h), frac(h), arith, frac(h - rng.int(1, 3)), frac(h + rng.int(1, 2))]);
        const sameDist = rng.chance(0.5);
        const info = sameDist
          ? `${veh.who} covers a route in two equal halves, at ${u} ${veh.unit} on the first half and at ${v} ${veh.unit} on the second half.`
          : `${veh.who} makes a round trip over the same road, traveling at ${u} ${veh.unit} one way and at ${v} ${veh.unit} on the return.`;
        const qa = 'The average speed for the whole trip, in the same unit';
        const qb = `$${fTex(bVal)}$`;
        const ansA: QCChoice = harm.gt(bVal) ? 'A' : harm.lt(bVal) ? 'B' : 'C';
        const ans = side === 'A' ? ansA : flip(ansA);
        const trap: QCQuestion['traps'] = bVal.eq(arith) ? ({ [ans === 'C' ? 'D' : 'C']: 'stat-speed-arith-mean' } as QCQuestion['traps']) : undefined;
        return {
          params: { mode, u, v, L: 0, t: bVal.toNumber(), side },
          q: {
            format: 'qc',
            info,
            quantityA: side === 'A' ? qa : qb,
            quantityB: side === 'A' ? qb : qa,
            answer: ans,
            ...(trap ? { traps: trap } : {}),
            explanation: `Both halves cover the same distance, so the average speed is total distance over total time, with the slower half taking longer.

Take each half to be $${u * v}$ long: the times are $${v}$ and $${u}$ hours, so the average is $${2 * u * v} \\div ${u + v} = ${h}$.

Check: this is below the plain average $${fTex(arith)}$, as it must be.

Trap: the plain average, $${fTex(arith)}$, ignores that more time is spent at the slower speed, so it overstates the average speed.

Rule: for equal distances the average speed is $\\frac{2uv}{u+v}$, always below $\\frac{u+v}{2}$ when $u \\neq v$.`,
          },
        };
      }

      // between: the first leg is fixed, the second leg has an unknown positive length
      if (hi - lo < 10) continue;
      const kind = d === 1 ? rng.pick(['above', 'below']) : d === 2 ? rng.pick(['above', 'below', 'inside']) : rng.pick(['inside', 'inside', 'above', 'below']);
      const swap = rng.chance(0.5); // which speed the fixed leg has
      const uu = swap ? hi : lo;
      const vv = swap ? lo : hi;
      let t: number;
      if (kind === 'above') t = hi + rng.pick([0, 0, 5, 10]);
      else if (kind === 'below') t = lo - rng.pick([0, 0, 5]);
      else t = lo + 5 * rng.int(1, (hi - lo) / 5 - 1);
      if (t <= 0 || (kind === 'inside' && (t <= lo || t >= hi))) continue;
      const ansA: QCChoice = t >= hi ? 'B' : t <= lo ? 'A' : 'D';
      const ans = ansA === 'D' ? 'D' : side === 'A' ? ansA : flip(ansA);
      const info = `${veh.who} covers the first ${L} ${veh.unit.startsWith('miles') ? 'miles' : 'kilometers'} of a trip at ${uu} ${veh.unit}. It then covers the remaining $d$ ${veh.unit.startsWith('miles') ? 'miles' : 'kilometers'}, where $d > 0$, at ${vv} ${veh.unit}.`;
      const qa = 'The average speed for the whole trip, in the same unit';
      const qb = `$${t}$`;
      const trap: QCQuestion['traps'] = ans !== 'D' ? ({ D: 'stat-speed-need-distance' } as QCQuestion['traps']) : undefined;
      const compare =
        ansA === 'B'
          ? `The average is strictly between ${lo} and ${hi}, so it is below ${t}.`
          : ansA === 'A'
            ? `The average is strictly between ${lo} and ${hi}, so it is above ${t}.`
            : `${t} lies between ${lo} and ${hi}, so it depends on $d$: a very short second leg keeps the average near ${uu}, a very long one brings it near ${vv}.`;
      const dStar = (x: number) => frac(L).mul(new Frac(x - uu).div(uu)).div(new Frac(vv - x).div(vv));
      const proof =
        ansA === 'D' ? ` At $d = ${fTex(dStar(t))}$ the average is exactly ${t}; a longer $d$ moves it toward ${vv}, a shorter $d$ toward ${uu}, so it ends on either side of ${t}.` : '';
      return {
        params: { mode, u: uu, v: vv, L, t, side },
        q: {
          format: 'qc',
          info,
          quantityA: side === 'A' ? qa : qb,
          quantityB: side === 'A' ? qb : qa,
          answer: ans,
          ...(trap ? { traps: trap } : {}),
          explanation: `The average speed of a trip made of two legs is a weighted average of the two speeds, with time as the weight. It is therefore strictly between ${lo} and ${hi}, whatever $d$ is, and it moves toward ${vv} as $d$ grows.

${compare}${proof}

Check: with $d = ${L}$ the average is $${eq(avgSpeed([{ dist: frac(L), speed: uu }, { dist: frac(L), speed: vv }])).replace(/^= /, '')}$, inside the interval.

Trap: ${ansA === 'D' ? 'testing one distance only, such as a second leg as long as the first, shows one relation, and another distance shows the opposite.' : 'the missing distance does not matter here, so answer D is not right.'}

Rule: a mixture of speeds can never be slower than the slowest or faster than the fastest.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'qc') return 'wrong format';
    const flipIf = (c: QCChoice) => (p.side === 'A' ? c : flip(c));
    if (p.mode === 'equal-dist' || p.mode === 'hm') {
      // the result must not depend on the leg length: try several
      const vals = [1, 7, 60].map((D) => avgSpeed([{ dist: frac(D), speed: p.u }, { dist: frac(D), speed: p.v }]));
      if (!vals.every((x) => x.eq(vals[0]))) return 'average depends on the leg length';
      const b = p.mode === 'equal-dist' ? new Frac(p.u + p.v, 2) : new Frac(Math.round(p.t * 2), 2);
      const a = qcFromSamples([[vals[0], b]]);
      return q.answer === flipIf(a) ? null : `expected ${flipIf(a)}`;
    }
    if (p.mode === 'equal-time') {
      const hours = p.L;
      const total = avgSpeed([{ dist: frac(p.u * hours), speed: p.u }, { dist: frac(p.v * hours), speed: p.v }]);
      const a = qcFromSamples([[total, new Frac(p.u + p.v, 2)]]);
      return q.answer === flipIf(a) ? null : `expected ${flipIf(a)}`;
    }
    // unknown length of the second leg: sample it from very short to very long
    const samples: [Frac, Frac][] = [];
    for (let k = 0; k <= 150; k++) {
      const dist = new Frac(Math.round(1.1 ** k * 1000), 1000);
      samples.push([avgSpeed([{ dist: frac(p.L), speed: p.u }, { dist, speed: p.v }]), frac(p.t)]);
    }
    const a = qcFromSamples(samples);
    const expected = a === 'D' ? 'D' : flipIf(a);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const weightedSpeedTemplates: Template<any>[] = [avgSpeedQC];
