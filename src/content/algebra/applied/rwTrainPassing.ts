import { Frac, frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { dx } from './util';

// alg.rate-work: a long moving object passes a point, a platform or another train (numeric entry).

export const rwTrainTraps: Record<string, Trap> = {
  'algw-train-length-ignored': {
    label: 'Left out the length of the train',
    fix: 'To pass a platform completely, the FRONT must travel the platform length plus the train length, since the rear has to clear the far end.',
  },
  'algw-train-length-twice': {
    label: 'Counted the length of the train twice',
    fix: 'The distance to clear a platform is platform + train, once. The front covers the platform and the rear then covers the train length.',
  },
  'algw-train-speed-from-platform': {
    label: 'Found the speed from the platform length alone',
    fix: 'While crossing a platform the train covers platform + train length, so speed $= \\frac{\\text{platform} + \\text{train}}{\\text{time}}$.',
  },
  'algw-train-total-distance': {
    label: 'Gave the distance covered while crossing instead of the length of the train',
    fix: 'The crossing distance is platform + train. Subtract the platform to get the length of the train.',
  },
  'algw-train-one-length': {
    label: 'Used the length of only one train',
    fix: 'To pass completely, the rear of the overtaking train must clear the front of the other: the closing distance is the SUM of both lengths.',
  },
};

interface TrainParams {
  kind: 'cross' | 'length' | 'overtake';
  L: number;
  P: number;
  v: number;
  t1: number;
  t2: number;
  LB: number;
  vB: number;
}

const OBJECTS = [
  { who: 'A passenger train', noun: 'passenger train' },
  { who: 'A commuter train', noun: 'commuter train' },
  { who: 'An express train', noun: 'express train' },
  { who: 'A tram', noun: 'tram' },
];

export const rwTrainPassing: Template<TrainParams> = {
  id: 'alg.rate-work.train-passing',
  skill: 'alg.rate-work',
  format: 'ne',
  style: 'a long train passes a pole, a platform or another train',
  generate(rng, d) {
    const kind: TrainParams['kind'] = d === 1 ? 'cross' : d === 2 ? 'length' : 'overtake';
    const { who, noun } = rng.pick(OBJECTS);
    for (;;) {
      const v = rng.pick([8, 10, 12, 15, 16, 20, 24, 25, 30]);
      const t1 = rng.int(4, 18);
      const L = v * t1;
      if (kind === 'cross') {
        const P = rng.int(3, 40) * 10;
        const ans = frac(L + P, v);
        if (!ans.mul(10).isInt() || P > 400) continue;
        const traps = [
          { value: frac(P, v), trap: 'algw-train-length-ignored' },
          { value: frac(2 * L + P, v), trap: 'algw-train-length-twice' },
        ].filter((x) => x.value.mul(10).isInt() && x.value.gt(1) && !x.value.eq(ans));
        return {
          params: { kind, L, P, v, t1, t2: 0, LB: 0, vB: 0 },
          q: {
            format: 'ne',
            stem: `${who} ${L} meters long, traveling at a constant speed, takes ${t1} seconds to pass a signal pole beside the track. At that speed, how many seconds does it take the ${noun} to cross completely a bridge ${P} meters long, from the moment its front reaches the bridge until its rear leaves it?`,
            answer: ans,
            suffix: 'seconds',
            traps,
            explanation: `Passing a pole means the ${noun} travels its own length, so its speed is ${L} ÷ ${t1} = ${v} meters per second. To clear the bridge, the front must travel the bridge plus the train: ${P} + ${L} = ${P + L} meters. The time is $${P + L} \\div ${v} = ${dx(ans)}$ seconds.

Check: in ${dx(ans)} seconds the ${noun} covers ${v} × ${dx(ans)} = ${P + L} meters.${traps[0] ? ` Trap: ${dx(traps[0].value)} seconds ${traps[0].trap === 'algw-train-length-ignored' ? 'is the time for the front alone to travel the bridge' : 'counts the length of the train twice'}.` : ''} Rule: crossing time = (object length + train length) ÷ speed.`,
          },
        };
      }
      if (kind === 'length') {
        const P = rng.int(5, 40) * 10;
        const t2f = frac(L + P, v);
        if (!t2f.isInt() || t2f.toNumber() > 60) continue;
        const t2 = t2f.toNumber();
        const wrongV = frac(P, t2);
        const traps = [
          { value: wrongV.mul(t1), trap: 'algw-train-speed-from-platform' },
          { value: frac(L + P), trap: 'algw-train-total-distance' },
        ].filter((x) => x.value.mul(10).isInt() && x.value.gt(1) && !x.value.eq(L));
        return {
          params: { kind, L, P, v, t1, t2, LB: 0, vB: 0 },
          q: {
            format: 'ne',
            stem: `${who}, traveling at a constant speed, takes ${t1} seconds to pass a signal pole beside the track and ${t2} seconds to cross completely a platform ${P} meters long, from the moment its front reaches the platform until its rear leaves it. How many meters long is the ${noun}?`,
            answer: frac(L),
            suffix: 'meters',
            traps,
            explanation: `Let $L$ be the length. Passing the pole covers $L$ in ${t1} seconds, so the speed is $\\frac{L}{${t1}}$. Crossing the platform covers $L + ${P}$ in ${t2} seconds, so the speed is also $\\frac{L + ${P}}{${t2}}$. Equal speeds give $${t2}L = ${t1}(L + ${P})$, so $${t2 - t1}L = ${t1 * P}$ and $L = ${L}$.

Check: the speed is ${L} ÷ ${t1} = ${v} meters per second, and ${L + P} ÷ ${v} = ${t2} seconds.${traps[0] ? ` Trap: ${dx(traps[0].value)} ${traps[0].trap === 'algw-train-total-distance' ? 'is the whole distance covered while crossing, platform included' : 'comes from a speed that ignores the train length'}.` : ''} Rule: one speed, two distances; set the two ratios equal.`,
          },
        };
      }
      // overtake: A (length L, speed v from the pole time) catches up with B moving the same way.
      const LB = rng.int(3, 20) * 10;
      const vB = rng.int(3, v - 2);
      const ans = frac(L + LB, v - vB);
      if (!ans.mul(10).isInt() || ans.toNumber() > 90 || v - vB < 2) continue;
      const traps = [
        { value: frac(L + LB, v + vB), trap: 'algw-relative-speed-sign' },
        { value: frac(L, v - vB), trap: 'algw-train-one-length' },
        { value: frac(LB, v - vB), trap: 'algw-train-one-length' },
      ].filter((x) => x.value.mul(10).isInt() && x.value.gt(1) && !x.value.eq(ans));
      return {
        params: { kind, L, P: 0, v, t1, t2: 0, LB, vB },
        q: {
          format: 'ne',
          stem: `${who} ${L} meters long takes ${t1} seconds, at a constant speed, to pass a signal pole. On the next track a ${LB}-meter freight train moves in the same direction at a constant ${vB} meters per second. At one moment the front of the ${noun} is level with the rear of the freight train. How many seconds after that moment is the ${noun} completely past the freight train, its rear level with the freight train's front?`,
          answer: ans,
          suffix: 'seconds',
          traps,
          explanation: `Speed of the ${noun}: ${L} ÷ ${t1} = ${v} meters per second. Going the same way, it gains ${v} − ${vB} = ${v - vB} meters on the freight train each second. To be completely past, it must gain the two lengths: ${L} + ${LB} = ${L + LB} meters. The time is $${L + LB} \\div ${v - vB} = ${dx(ans)}$ seconds.

Check: in ${dx(ans)} seconds the ${noun} moves ${dx(ans.mul(v))} meters and the freight train ${dx(ans.mul(vB))}, a difference of ${L + LB}.${traps[0] ? ` Trap: ${dx(traps[0].value)} seconds ${traps[0].trap === 'algw-relative-speed-sign' ? 'adds the speeds, as if the trains approached each other' : 'counts the length of one train only'}.` : ''} Rule: same direction, subtract the speeds; completely past, add the lengths.`,
        },
      };
    }
  },
  check(q, { kind, L, P, v, t1, t2, LB, vB }) {
    if (q.format !== 'ne') return 'wrong format';
    const a = q.answer;
    const step = frac(1, 10);
    if (kind === 'length') {
      // Use the answer as the length: speed from the pole, then find when the rear clears the platform.
      const speed = a.div(t1);
      let t = frac(0);
      for (let i = 0; i < 700 && speed.mul(t).sub(a).lt(P); i++) t = t.add(step);
      return t.eq(t2) ? null : `crossing would take ${t} seconds, not ${t2}`;
    }
    // Step time forward until the rear has cleared; the answer must be the first such moment.
    const rearClear = (t: Frac) => (kind === 'cross' ? frac(v).mul(t).sub(L).gte(P) : frac(v).mul(t).sub(L).gte(frac(vB).mul(t).add(LB)));
    if (!rearClear(a)) return `not clear at ${a}`;
    if (a.gt(step) && rearClear(a.sub(step))) return `already clear at ${a.sub(step)}`;
    return null;
  },
};
