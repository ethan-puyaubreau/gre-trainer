import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { choiceValuesMatch, expectMcs, trapChoices, uniqueIndex } from './util';

// alg.rate-work: identical workers or machines: workers x time = constant (select one).

export const rwCrewTraps: Record<string, Trap> = {
  'algw-direct-workers': {
    label: 'Treated workers and days as directly proportional',
    fix: 'With identical workers, more workers means FEWER days. The product workers x days (the total work) stays the same.',
  },
  'algw-crew-no-change': {
    label: 'Kept the original time',
    fix: 'Changing the number of workers changes the time. Compute the total work first, then divide by the new rate.',
  },
  'algw-crew-additive': {
    label: 'Changed the time by the difference in workers',
    fix: 'Rates multiply, they do not add days: twice the workers halve the time, they do not remove a fixed number of days.',
  },
  'algw-crew-workers-sum': {
    label: 'Treated the new crew as extra workers joining the old crew',
    fix: 'The question replaces the crew by a different one. Compute the total work and divide it by the size of the NEW crew only.',
  },
  'algw-crew-worker-days': {
    label: 'Gave the total work (worker-days) instead of the days',
    fix: 'Worker-days are the work to do. Divide them by the number of workers to get days.',
  },
  'algw-crew-count-ignored': {
    label: 'Ignored the change in the number of machines',
    fix: 'The output depends on the number of machines as well as on the time. Scale for the machines and for the amount produced.',
  },
  'algw-crew-units-ignored': {
    label: 'Ignored the change in the amount produced',
    fix: 'A different target amount needs proportionally more (or less) time. Scale for both the machines and the amount.',
  },
  'algw-crew-ratio-inverted': {
    label: 'Inverted the ratio of the amounts produced',
    fix: 'Producing more takes more time: multiply by the new amount over the old amount, not the other way round.',
  },
  'algw-crew-restart': {
    label: 'Gave only the time after the workers left',
    fix: 'The question asks for the days in all, including the days already worked before the workers left.',
  },
  'algw-crew-left-at-start': {
    label: 'Had the workers leave at the very start',
    fix: 'The workers leave after some days. The work done before that, at the full rate, still counts.',
  },
  'algw-crew-leave-ignored': {
    label: 'Ignored that some workers left',
    fix: 'After some workers leave, the remaining work is done at a slower rate, so the job takes longer than planned.',
  },
};

interface CrewParams {
  kind: 'days' | 'machines' | 'leave';
  m: number;
  D: number;
  n: number;
  U: number;
  V: number;
  h: number;
  t: number;
  k: number;
  values: Frac[];
}

const CREWS = [
  { w: 'painters', job: 'paint an apartment building' },
  { w: 'bricklayers', job: 'build a garden wall' },
  { w: 'proofreaders', job: 'proofread a manuscript' },
  { w: 'harvesters', job: 'harvest a field of wheat' },
  { w: 'movers', job: 'unload a warehouse' },
];

const ITEMS = ['bottles', 'brackets', 'circuit boards', 'tiles', 'envelopes'];

const fmt = (v: Frac) => `$${num(v)}$`;

export const rwCrewScaling: Template<CrewParams> = {
  id: 'alg.rate-work.crew-scaling',
  skill: 'alg.rate-work',
  format: 'mcs',
  style: 'identical workers or machines: change the crew size',
  generate(rng, d) {
    const kind: CrewParams['kind'] = d === 1 ? 'days' : d === 2 ? 'machines' : 'leave';
    const C = rng.pick(CREWS);
    for (;;) {
      let correct: number;
      let cands: { value: number; trap: string; why: string }[];
      let stem: string;
      let explanation: (why: string, value: number) => string;
      let p: Omit<CrewParams, 'values'>;
      const base = { m: 0, D: 0, n: 0, U: 0, V: 0, h: 0, t: 0, k: 0 };
      if (kind === 'days') {
        const m = rng.int(2, 12);
        const n = rng.int(2, 24);
        const D = rng.int(2, 30);
        if (m === n || (m * D) % n !== 0) continue;
        correct = (m * D) / n;
        if (correct < 2) continue;
        cands = [
          { value: D, trap: 'algw-crew-no-change', why: 'keeps the original number of days' },
          { value: (D * n) % m === 0 ? (D * n) / m : 0, trap: 'algw-direct-workers', why: 'makes more workers take more days' },
          { value: D - (n - m), trap: 'algw-crew-additive', why: `subtracts the ${n - m} extra workers from the days` },
          { value: m * D, trap: 'algw-crew-worker-days', why: 'is the total work in worker-days' },
          { value: (m * D) % (m + n) === 0 ? (m * D) / (m + n) : 0, trap: 'algw-crew-workers-sum', why: `treats the ${n} workers as joining the ${m}` },
        ];
        p = { ...base, kind, m, D, n };
        stem = `${m} ${C.w}, all working at the same constant rate, can ${C.job} in ${D} days. At that rate, how many days would it take ${n} of these ${C.w} to ${C.job}?`;
        explanation = (why, value) => `Workers times days is constant for identical workers, so the job is $${m} \\times ${D} = ${num(m * D)}$ worker-days. With ${n} ${C.w} each working one worker-day per day, the time is $${num(m * D)} \\div ${n} = ${correct}$ days.

Check: $${n} \\times ${correct} = ${num(m * D)}$ worker-days.

Trap: the choice $${num(value)}$ ${why}. Rule: more workers means fewer days. The job needs the same ${num(m * D)} worker-days whoever does it, so keep the total work fixed and divide by the size of the crew.`;
      } else if (kind === 'machines') {
        const m = rng.int(2, 9);
        const n = rng.int(2, 15);
        const h = rng.int(2, 12);
        const U = rng.int(2, 10) * 50;
        const V = rng.int(2, 24) * 50;
        if (m === n || U === V || (h * m * V) % (U * n) !== 0) continue;
        correct = (h * m * V) / (U * n);
        if (correct < 2) continue;
        const item = rng.pick(ITEMS);
        const ok = (x: number) => Number.isInteger(x) && x > 0;
        cands = [
          { value: (h * V) / U, trap: 'algw-crew-count-ignored', why: 'ignores that the number of machines changed' },
          { value: (h * V * n) / (U * m), trap: 'algw-direct-workers', why: 'makes more machines take more hours' },
          { value: (h * m) / n, trap: 'algw-crew-units-ignored', why: 'ignores that the amount to produce changed' },
          { value: (h * m * U) / (V * n), trap: 'algw-crew-ratio-inverted', why: 'inverts the ratio of the amounts produced' },
          { value: h, trap: 'algw-crew-no-change', why: 'keeps the original time' },
        ].map((x) => ({ ...x, value: ok(x.value) ? x.value : 0 }));
        p = { ...base, kind, m, n, h, U, V };
        stem = `${m} identical machines, each working at the same constant rate, produce ${num(U)} ${item} in ${h} hours. At that rate, how many hours would ${n} of these machines need to produce ${num(V)} ${item}?`;
        explanation = (why, value) => `Time grows with the amount to produce and shrinks with the number of machines. The amount goes from ${num(U)} to ${num(V)}, so multiply the time by $\\frac{${num(V)}}{${num(U)}}${num(frac(V, U)) === `\\frac{${num(V)}}{${num(U)}}` ? '' : ` = ${num(frac(V, U))}`}$. The machines go from ${m} to ${n}, so multiply by $\\frac{${m}}{${n}}${num(frac(m, n)) === `\\frac{${m}}{${n}}` ? '' : ` = ${num(frac(m, n))}`}$. The time is $${h} \\times ${num(frac(V, U))} \\times ${num(frac(m, n))} = ${correct}$ hours.

Check: one machine makes $\\frac{${num(U)}}{${m} \\times ${h}} = ${num(frac(U, m * h))}$ ${item} an hour, and $${n} \\times ${correct} \\times ${num(frac(U, m * h))} = ${num(V)}$.

Trap: the choice $${num(value)}$ ${why}. Rule: scale the time by the machines AND by the amount.`;
      } else {
        const m = rng.int(4, 16);
        const k = rng.int(1, m - 2);
        const D = rng.int(6, 30);
        const t = rng.int(1, D - 2);
        const left = m - k;
        if ((m * (D - t)) % left !== 0) continue;
        const rest = (m * (D - t)) / left;
        correct = t + rest;
        cands = [
          { value: rest, trap: 'algw-crew-restart', why: 'counts only the days after the workers left' },
          { value: (m * D) / left, trap: 'algw-crew-left-at-start', why: 'has the workers leave before the work begins' },
          { value: (D * left) % m === 0 ? t + ((D - t) * left) / m : 0, trap: 'algw-direct-workers', why: 'makes the smaller crew finish the rest faster' },
          { value: D, trap: 'algw-crew-leave-ignored', why: 'ignores that some workers left' },
          { value: D + k, trap: 'algw-crew-additive', why: `adds the ${k} workers who left to the days` },
        ];
        p = { ...base, kind, m, D, t, k };
        stem = `${m} ${C.w}, all working at the same constant rate, can ${C.job} in ${D} days. They all start the job together, but after ${t} ${t === 1 ? 'day' : 'days'}, ${k} of them leave. The remaining ${C.w} keep working at the same rate until the job is done. How many days in all does the job take?`;
        explanation = (why, value) => `Count the work in worker-days: the job is $${m} \\times ${D} = ${num(m * D)}$. In ${t} ${t === 1 ? 'day' : 'days'} the full crew does $${m} \\times ${t} = ${num(m * t)}$, leaving $${num(m * (D - t))}$. The ${left} remaining ${C.w} do ${left} per day, so they need $${num(m * (D - t))} \\div ${left} = ${rest}$ more days, and the job takes $${t} + ${rest} = ${correct}$ days in all.

Check: $${num(m * t)} + ${left} \\times ${rest} = ${num(m * D)}$.

Trap: the choice $${num(value)}$ ${why}. Rule: split the job at the moment the crew changes, find the work left in worker-days, and add the two times.`;
      }
      const res = trapChoices(
        rng,
        correct,
        cands.filter((x) => x.value > 1 && Number.isInteger(x.value)).map((x) => ({ ...x, value: frac(x.value) })),
        fmt,
      );
      if (!res) continue;
      // The key is rarely the largest or smallest value here, so shuffle instead of sorting.
      const order = rng.shuffle(res.choices.map((_, i) => i));
      const choices = order.map((i) => res.choices[i]);
      const answer = order.indexOf(res.answer);
      const values = order.map((i) => res.values[i]);
      const kept = res.kept[0] as unknown as { why: string; value: Frac };
      return {
        params: { ...p!, values },
        q: { format: 'mcs', stem: stem!, choices, answer, explanation: explanation!(kept.why, kept.value.toNumber()) },
      };
    }
  },
  check(q, { kind, m, D, n, U, V, h, t, k, values }) {
    const err = choiceValuesMatch(q, values, fmt);
    if (err) return err;
    let want: Frac;
    if (kind === 'days') {
      want = frac(m * D, n);
    } else if (kind === 'machines') {
      // Output per machine-hour, then time for the new target.
      const perMachineHour = frac(U, m * h);
      want = frac(V).div(perMachineHour.mul(n));
    } else {
      // Day-by-day simulation in worker-days.
      let remaining = m * D;
      let days = 0;
      while (remaining > 0) {
        remaining -= days < t ? m : m - k;
        days++;
      }
      want = frac(days);
    }
    return expectMcs(q, uniqueIndex(values, (v) => v.eq(want)));
  },
};
