import { Frac, frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { num } from '../../../engine/tex';
import { dx } from './util';

const fx = (f: Frac) => (f.isTerminating() ? dx(f) : `$${num(f)}$`);

// alg.rate-work: a mover with a current or wind: speeds add one way and subtract the other (numeric entry).

export const rwCurrentTraps: Record<string, Trap> = {
  'algw-current-wrong-quantity': {
    label: 'Gave the speed in still water when the current was asked (or the reverse)',
    fix: 'Downstream speed $= u + w$ and upstream speed $= u - w$. Half their sum is $u$, half their difference is $w$; reread which one is asked.',
  },
  'algw-current-unhalved': {
    label: 'Gave the sum or the difference of the two speeds without halving',
    fix: 'The two speeds are $u + w$ and $u - w$. Adding them gives $2u$ and subtracting gives $2w$, so divide by 2.',
  },
  'algw-current-ignored': {
    label: 'Used one speed for both directions',
    fix: 'The current helps one way and hinders the other, so the two legs have different speeds and different times.',
  },
  'algw-current-stop-ignored': {
    label: 'Counted the stop as travel time',
    fix: 'Time spent stopped is not time spent moving. Subtract it from the total before using $d = rt$.',
  },
};

interface CurrentParams {
  kind: 'current' | 'still' | 'distance';
  D: number;
  t1: number;
  t2: number;
  u: number;
  w: number;
  stop: number;
  T: number;
}

const WORLDS = [
  { mover: 'A boat', med: 'river', still: 'still water', fwd: 'downstream', back: 'upstream', dist: 'kilometers', cur: 'The river flows at a constant speed' },
  { mover: 'A canoe', med: 'river', still: 'still water', fwd: 'downstream', back: 'upstream', dist: 'kilometers', cur: 'The river flows at a constant speed' },
  { mover: 'A plane', med: 'wind', still: 'still air', fwd: 'with the wind', back: 'against the wind', dist: 'miles', cur: 'The wind blows at a constant speed along the route' },
  { mover: 'A barge', med: 'canal current', still: 'still water', fwd: 'with the current', back: 'against the current', dist: 'kilometers', cur: 'The canal current has a constant speed' },
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const rwCurrent: Template<CurrentParams> = {
  id: 'alg.rate-work.current',
  skill: 'alg.rate-work',
  format: 'ne',
  style: 'speed with a current or wind: downstream and upstream',
  generate(rng, d) {
    const W = rng.pick(WORLDS);
    const kind: CurrentParams['kind'] = d === 1 ? 'current' : d === 2 ? 'still' : 'distance';
    for (;;) {
      const u = rng.int(d === 3 ? 12 : 6, d === 3 ? 40 : 24);
      const w = rng.int(2, Math.floor(u / 2));
      if (u - w < 3) continue;
      const v1 = u + w;
      const v2 = u - w;
      const unit = `${W.dist} per hour`;
      const L = (v1 * v2) / gcd(v1, v2);
      const D = kind === 'distance' ? 0 : L * rng.int(1, 3);
      if (D > 900) continue;
      if (kind === 'distance') {
        const stop = rng.int(1, 4);
        const fits: number[] = [];
        for (let x = 30; x <= 600; x++) {
          const h = frac(x, v1).add(frac(x, v2));
          if (h.isInt() && h.toNumber() >= 3 && h.toNumber() <= 24) fits.push(x);
        }
        if (!fits.length) continue;
        const D = rng.pick(fits);
        const moving = frac(D, v1).add(frac(D, v2));
        const T = moving.toNumber() + stop;
        const traps = [
          { value: frac(T * v1 * v2, 2 * u), trap: 'algw-current-stop-ignored', why: 'counts the stop as moving time' },
          { value: frac((T - stop) * u, 2), trap: 'algw-current-ignored', why: 'uses the still-water speed for both legs' },
        ].filter((x) => x.value.isTerminating() && !x.value.eq(D));
        const first = traps[0];
        return {
          params: { kind, D: 0, t1: 0, t2: 0, u, w, stop, T },
          q: {
            format: 'ne',
            stem: `${W.mover} travels at ${u} ${unit} in ${W.still}. ${W.cur}, ${w} ${unit}. ${W.mover.replace(/^A /, 'The ')} makes a round trip over a one-way distance of $D$ ${W.dist}, going ${W.fwd} first and ${W.back} on the return, with a stop of ${stop} ${stop === 1 ? 'hour' : 'hours'} at the far end. The whole trip, stop included, takes ${T} hours. What is $D$?`,
            answer: frac(D),
            suffix: W.dist,
            traps: traps.map((x) => ({ value: x.value, trap: x.trap })),
            explanation: `Moving time is the total minus the stop: ${T} − ${stop} = ${T - stop} hours. The speeds are ${u} + ${w} = ${v1} ${W.fwd} and ${u} − ${w} = ${v2} ${W.back}, so $\\frac{D}{${v1}} + \\frac{D}{${v2}} = ${T - stop}$, that is, $D \\cdot \\frac{${v1 + v2}}{${v1 * v2}} = ${T - stop}$ and $D = ${T - stop} \\cdot \\frac{${v1 * v2}}{${v1 + v2}} = ${D}$.

Check: ${D} ÷ ${v1} = ${fx(frac(D, v1))} and ${D} ÷ ${v2} = ${fx(frac(D, v2))} hours, which sum to ${T - stop}.${first ? ` Trap: ${dx(first.value)} ${first.why}.` : ''} Rule: the two legs cover the same distance at different speeds, so add their TIMES, not their speeds.`,
          },
        };
      }
      const t1 = D / v1;
      const t2 = D / v2;
      if (t1 < 2) continue;
      const answer = frac(kind === 'current' ? w : u);
      const traps = [
        { value: frac(kind === 'current' ? u : w), trap: 'algw-current-wrong-quantity', why: `is the ${kind === 'current' ? 'speed in still water' : 'speed of the current'}, which is not what is asked` },
        { value: frac(kind === 'current' ? v1 - v2 : v1 + v2), trap: 'algw-current-unhalved', why: 'forgets to halve the difference or the sum' },
        ...(kind === 'still' ? [{ value: frac(2 * D, t1 + t2), trap: 'algw-current-ignored', why: 'is the average speed of the round trip, which is not the speed in still water' }] : []),
      ].filter((x) => x.value.isTerminating() && !x.value.eq(answer));
      const first = traps[0];
      const stem = `${W.mover} travels ${D} ${W.dist} ${W.fwd} in ${t1} hours and returns over the same route ${W.back} in ${t2} hours. ${W.cur}. ${W.mover} keeps a constant speed relative to the ${W.med === 'wind' ? 'air' : 'water'}. ${
        kind === 'current' ? `What is the speed of the ${W.med}, in ${unit}?` : `What is the speed of the ${W.mover.slice(2)} in ${W.still}, in ${unit}?`
      }`;
      return {
        params: { kind, D, t1, t2, u, w, stop: 0, T: 0 },
        q: {
          format: 'ne',
          stem,
          answer,
          suffix: unit,
          traps: traps.map((x) => ({ value: x.value, trap: x.trap })),
          explanation: `Turn each leg into a speed. ${cap(W.fwd)}: ${D} ÷ ${t1} = ${v1}. ${cap(W.back)}: ${D} ÷ ${t2} = ${v2}. With $u$ for the mover and $w$ for the ${W.med}, $u + w = ${v1}$ and $u - w = ${v2}$. Adding gives $2u = ${v1 + v2}$ and subtracting gives $2w = ${v1 - v2}$, so $u = ${u}$ and $w = ${w}$.

Check: ${u} + ${w} = ${v1} and ${u} − ${w} = ${v2}.${first ? ` Trap: ${dx(first.value)} ${first.why}.` : ''} Rule: half the sum of the two speeds is the mover's own speed, and half the difference is the speed of the ${W.med}.`,
        },
      };
    }
  },
  check(q, { kind, D, t1, t2, u, w, stop, T }) {
    if (q.format !== 'ne') return 'wrong format';
    const a = q.answer;
    if (kind === 'distance') {
      // Replay the trip with the stored answer as the one-way distance.
      const total = a.div(u + w).add(a.div(u - w)).add(stop);
      return total.eq(T) ? null : `trip takes ${total} hours, not ${T}`;
    }
    // Rebuild the missing speed from the first leg, then test the return leg.
    const out = frac(D, t1);
    const mover: Frac = kind === 'current' ? out.sub(a) : a;
    const cur: Frac = kind === 'current' ? a : out.sub(a);
    if (mover.sub(cur).sign() <= 0) return 'return speed is not positive';
    return frac(D).div(mover.sub(cur)).eq(t2) && mover.add(cur).eq(out) ? null : `return leg takes ${frac(D).div(mover.sub(cur))} hours, not ${t2}`;
  },
};
