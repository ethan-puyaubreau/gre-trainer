import { Frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import type { Rng } from '../../../engine/rng';
import type { Template, Trap } from '../../../engine/types';
import { expectMCS, F, numChoices } from './util';

export const rateMeetingTraps: Record<string, Trap> = {
  'rate-mean-closing': {
    label: 'Used the average of the two speeds as the closing speed',
    fix: 'Two movers approaching each other cover the gap together, at the SUM of their speeds, not at their average.',
  },
  'rate-single-speed': {
    label: 'Used only one of the two speeds',
    fix: 'Both movers matter. Two objects approaching each other close the gap at the SUM of their speeds; one chasing the other closes it at the DIFFERENCE.',
  },
  'rate-closing-difference': {
    label: 'Subtracted the speeds when the movers approach each other',
    fix: 'Moving toward each other (or apart), distances add, so the speeds add. Subtract only when both move the same way.',
  },
  'rate-closing-sum': {
    label: 'Added the speeds when one mover chases the other',
    fix: 'In a chase both move the same way, so the gap shrinks only by the DIFFERENCE of the speeds.',
  },
  'rate-wrong-clock': {
    label: 'Answered with the time from the wrong starting moment',
    fix: 'Re-read which departure the clock starts from. Time after the first mover leaves = head start + time after the second leaves.',
  },
  'rate-gap-wrong-speed': {
    label: 'Computed the head-start gap with the wrong speed',
    fix: "The gap at the moment the second mover starts is the FIRST mover's speed times the head start.",
  },
  'rate-head-start-ignored': {
    label: 'Forgot the distance covered during the head start',
    fix: 'Add the distance the first mover covered before the second one left, either as a smaller gap or as extra time.',
  },
  'rate-wrong-end': {
    label: 'Measured from the wrong end',
    fix: 'The distances from the two starting points add up to the total. Check which end the question measures from.',
  },
  'rate-simultaneous-start': {
    label: 'Treated a later start as a simultaneous start',
    fix: 'If one mover leaves later, the other has already covered part of the distance. Subtract that distance before using the sum of the speeds.',
  },
};

type Kind = 'toward' | 'apart' | 'chase' | 'toward-late';

interface RMParams {
  kind: Kind;
  v1: number;
  v2: number;
  /** total distance (toward kinds), head start (chase), minutes etc. */
  D: number;
  h: number;
  t: number;
  /** chase: ask the time since the first mover left */
  sinceFirst: boolean;
  values: Frac[];
}

const CTX = [
  { a: 'Train A', b: 'Train B', who: 'two trains', unit: 'miles per hour', len: 'miles', sp: [40, 90, 5], pts: ['City P', 'City Q'] },
  { a: 'Cyclist A', b: 'Cyclist B', who: 'two cyclists', unit: 'kilometers per hour', len: 'kilometers', sp: [12, 30, 2], pts: ['the village', 'the lake'] },
  { a: 'Car A', b: 'Car B', who: 'two cars', unit: 'miles per hour', len: 'miles', sp: [35, 70, 5], pts: ['Town X', 'Town Y'] },
];

const speed = (rng: Rng, sp: number[]) => sp[0] + sp[2] * rng.int(0, Math.floor((sp[1] - sp[0]) / sp[2]));
const halves = (rng: Rng, lo: number, hi: number) => rng.int(lo * 2, hi * 2) / 2;
const fmt = (v: Frac) => `$${decimal(v)}$`;
const nice = (v: Frac) => v.isTerminating() && v.sign() > 0 && (v.toDecimalString().split('.')[1] ?? '').length <= 2;

const meeting: Template<RMParams> = {
  id: 'arith.rates.meeting-mcs',
  skill: 'arith.rates',
  format: 'mcs',
  style: 'closing speed of two movers, with or without a head start',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    for (;;) {
      const kind: Kind = d === 1 ? (rng.chance(0.6) ? 'toward' : 'apart') : d === 2 ? 'chase' : 'toward-late';
      const v1 = speed(rng, ctx.sp);
      const v2 = speed(rng, ctx.sp);
      if (v1 === v2) continue;
      let D = 0;
      let h = 0;
      let t = 0;
      let sinceFirst = false;
      let ans: Frac;
      const traps: { value: Frac; trap: string }[] = [];
      let stem: string;
      let steps: string;
      let slips: [Frac, string][];
      const [p0, p1] = ctx.pts;
      if (kind === 'toward') {
        t = halves(rng, 1.5, 6);
        D = (v1 + v2) * t;
        if (!Number.isInteger(D)) continue;
        ans = F(t * 2, 2);
        traps.push(
          { value: F(D, v1), trap: 'rate-single-speed' },
          { value: F(D, v2), trap: 'rate-single-speed' },
          { value: F(D, Math.abs(v1 - v2)), trap: 'rate-closing-difference' },
          { value: F(v1 + v2, D), trap: 'num-inverted-rate' },
        );
        stem = `${ctx.a} leaves ${p0} and ${ctx.b} leaves ${p1} at the same moment, and they travel toward each other along the same straight road. ${p0} and ${p1} are ${num(D)} ${ctx.len} apart. ${ctx.a} travels at ${v1} ${ctx.unit} and ${ctx.b} at ${v2} ${ctx.unit}. How many hours after they leave do they meet?`;
        steps = `Moving toward each other, the gap closes at $${v1} + ${v2} = ${v1 + v2}$ ${ctx.len} per hour, so they meet after $\\frac{${num(D)}}{${v1 + v2}} = ${decimal(ans)}$ hours.`;
        slips = [
          [F(D, v1), `dividing by ${v1} alone ignores ${ctx.b}`],
          [F(D, v2), `dividing by ${v2} alone ignores ${ctx.a}`],
          [F(D, Math.abs(v1 - v2)), `subtracting the speeds treats the two as chasing each other`],
          [F(v1 + v2, D), `speed over distance is upside down`],
          [F(t * 4, 2), `the average of the speeds is not the closing speed`],
        ];
      } else if (kind === 'apart') {
        t = halves(rng, 1.5, 6);
        ans = F(Math.round((v1 + v2) * t * 2), 2);
        traps.push(
          { value: F(Math.abs(v1 - v2) * t * 2, 2), trap: 'rate-closing-difference' },
          { value: F(v1 * t * 2, 2), trap: 'rate-single-speed' },
          { value: F(v2 * t * 2, 2), trap: 'rate-single-speed' },
          { value: F(v1 + v2, 1).div(F(t * 2, 2)), trap: 'num-inverted-rate' },
          { value: ans.div(2), trap: 'rate-mean-closing' },
        );
        stem = `${ctx.a} and ${ctx.b} start from the same point at the same time and travel in opposite directions along a straight road, at ${v1} ${ctx.unit} and ${v2} ${ctx.unit}. How many ${ctx.len} apart are they after ${decimal(F(t * 2, 2))} hours?`;
        steps = `Moving apart, the gap grows at $${v1} + ${v2} = ${v1 + v2}$ ${ctx.len} per hour, so after ${decimal(F(t * 2, 2))} hours it is $${v1 + v2} \\times ${decimal(F(t * 2, 2))} = ${decimal(ans)}$ ${ctx.len}.`;
        slips = [
          [traps[0].value, `subtracting the speeds treats them as moving the same way`],
          [traps[1].value, `${v1} alone leaves out ${ctx.b}`],
          [traps[2].value, `${v2} alone leaves out ${ctx.a}`],
          [traps[3].value, 'dividing speed by time is not a distance'],
          [traps[4].value, 'the average of the speeds is not the closing speed'],
        ];
      } else if (kind === 'chase') {
        const slow = Math.min(v1, v2);
        const fast = Math.max(v1, v2);
        h = halves(rng, 1.5, 3);
        if ((slow * h * 2) % (fast - slow) !== 0) continue;
        t = (slow * h) / (fast - slow);
        if (t * 2 !== Math.round(t * 2) || t > 8 || t === 1) continue;
        sinceFirst = rng.chance(0.5);
        ans = F(Math.round((sinceFirst ? t + h : t) * 2), 2);
        const hS = decimal(F(h * 2, 2));
        stem = `${ctx.a} leaves ${p0} for ${p1} traveling at ${slow} ${ctx.unit}. ${hS} hours later, ${ctx.b} leaves ${p0} on the same road at ${fast} ${ctx.unit}. How many hours after ${sinceFirst ? ctx.a : ctx.b} leaves does ${ctx.b} catch up with ${ctx.a}?`;
        steps = `When ${ctx.b} leaves, ${ctx.a} is already $${slow} \\times ${hS} = ${decimal(F(Math.round(slow * h * 2), 2))}$ ${ctx.len} ahead. ${ctx.b} gains $${fast} - ${slow} = ${fast - slow}$ ${ctx.len} per hour, so it catches up after $\\frac{${decimal(F(Math.round(slow * h * 2), 2))}}{${fast - slow}} = ${decimal(F(t * 2, 2))}$ hours${sinceFirst ? `, which is ${decimal(F(t * 2, 2))} + ${hS} = ${decimal(ans)}$ hours after ${ctx.a} left` : ''}.`;
        const other = F(Math.round((sinceFirst ? t : t + h) * 2), 2);
        traps.push(
          { value: other, trap: 'rate-wrong-clock' },
          { value: F(Math.round(slow * h * 2), 2 * (fast + slow)), trap: 'rate-closing-sum' },
          { value: F(Math.round(slow * h * 2), 2 * fast), trap: 'rate-single-speed' },
          { value: F(Math.round(fast * h * 2), 2 * (fast - slow)), trap: 'rate-gap-wrong-speed' },
        );
        slips = [
          [other, `${decimal(other)} measures the time from the other departure`],
          [traps[1].value, `adding the speeds treats the two as approaching each other`],
          [traps[2].value, `dividing by ${fast} alone forgets that ${ctx.a} keeps moving`],
          [traps[3].value, `the head start is covered at the slower speed, ${slow}, not at ${fast}`],
        ];
      } else {
        // toward-late: A leaves p0 at v1, B leaves p1 at v2 h hours later; distance from p0 where they meet
        h = halves(rng, 1.5, 3);
        t = halves(rng, 1.5, 5);
        D = v1 * h + (v1 + v2) * t;
        if (!Number.isInteger(D)) continue;
        const gap = D - v1 * h;
        const meet = v1 * (h + t);
        ans = F(Math.round(meet * 2), 2);
        const hS = decimal(F(h * 2, 2));
        stem = `${p0} and ${p1} are ${num(D)} ${ctx.len} apart on a straight road. ${ctx.a} leaves ${p0} for ${p1} at ${v1} ${ctx.unit}. ${hS} hours later, ${ctx.b} leaves ${p1} for ${p0} at ${v2} ${ctx.unit}. How many ${ctx.len} from ${p0} are the two when they meet?`;
        steps = `In the ${hS}-hour head start, ${ctx.a} covers $${v1} \\times ${hS} = ${decimal(F(Math.round(v1 * h * 2), 2))}$ ${ctx.len}, leaving a gap of $${num(D)} - ${decimal(F(Math.round(v1 * h * 2), 2))} = ${num(gap)}$ ${ctx.len}. That gap closes at $${v1} + ${v2} = ${v1 + v2}$ ${ctx.len} per hour, taking $${decimal(F(t * 2, 2))}$ hours. ${ctx.a} has then driven ${hS} + ${decimal(F(t * 2, 2))} hours, so the meeting point is $${v1} \\times ${decimal(F(Math.round((h + t) * 2), 2))} = ${decimal(ans)}$ ${ctx.len} from ${p0}.`;
        traps.push(
          { value: F(Math.round(v1 * t * 2), 2), trap: 'rate-head-start-ignored' },
          { value: F(Math.round((D - meet) * 2), 2), trap: 'rate-wrong-end' },
          { value: F(D * v1, v1 + v2), trap: 'rate-simultaneous-start' },
          { value: F(Math.round(v1 * h * 2), 2), trap: 'rate-gap-wrong-speed' },
        );
        slips = [
          [traps[0].value, `${ctx.a}'s distance during the shared time leaves out its head start`],
          [traps[1].value, `that distance is measured from ${p1}`],
          [traps[2].value, `that answer pretends both left at the same moment`],
          [traps[3].value, `that is only what ${ctx.a} covers during the head start`],
        ];
      }
      if (traps.some((x) => x.value.eq(ans))) continue;
      const okTraps = traps.filter((x) => nice(x.value));
      if (new Set(okTraps.map((x) => x.value.toString())).size < 2) continue;
      const fillers = [ans.mul(2), ans.div(2), ans.mul(3).div(2), ans.mul(3).div(4), ans.mul(4).div(3)].filter(nice);
      const { choices, answer, values } = numChoices(rng, { correct: ans, traps: okTraps, fillers, format: fmt, order: 'shuffled' });
      const shown = slips.filter(([v]) => values.some((w) => w.eq(v)) && !v.eq(ans)).map(([, s]) => s);
      return {
        params: { kind, v1, v2, D, h, t, sinceFirst, values },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `Recognize: ${kind === 'chase' ? 'two movers going the same way, so the gap changes at the difference of the speeds' : kind === 'toward-late' ? 'a late start, so the first mover has already covered part of the distance' : 'two movers going opposite ways, so distances add and the speeds add'}.

${steps}

Check: ${kind === 'toward' ? `$${v1} \\times ${decimal(ans)} + ${v2} \\times ${decimal(ans)} = ${num(D)}$` : kind === 'apart' ? `${decimal(ans)} ${ctx.len} in ${decimal(F(t * 2, 2))} hours is $${v1 + v2}$ per hour` : kind === 'chase' ? `at the catch-up moment both are the same distance from the start` : `the two distances, ${decimal(ans)} and ${decimal(F(Math.round((D - v1 * (h + t)) * 2), 2))}, add up to ${num(D)}`}.

Trap: ${shown.length ? shown.slice(0, 2).join('; ') : 'use the right closing speed and the right starting moment'}. Decide first whether the speeds add or subtract, then which clock the question uses.`,
        },
      };
    }
  },
  check(q, { kind, v1, v2, D, h, t, sinceFirst, values }) {
    // Step through the motion minute by minute with exact fractions.
    const at = (m: number) => F(m, 60);
    const H = F(Math.round(h * 2), 2);
    let result: Frac | null = null;
    if (kind === 'toward') {
      for (let m = 1; m <= 24 * 60 && !result; m++) if (at(m).mul(v1).add(at(m).mul(v2)).gte(D)) result = at(m);
    } else if (kind === 'apart') {
      let gap = F(0);
      for (let m = 1; m <= Math.round(t * 60); m++) gap = gap.add(F(v1 + v2, 60));
      result = gap;
    } else if (kind === 'chase') {
      const slow = Math.min(v1, v2);
      const fast = Math.max(v1, v2);
      for (let m = 1; m <= 48 * 60 && !result; m++) {
        const now = at(m); // time since the first mover left
        if (now.gt(H) && now.sub(H).mul(fast).gte(now.mul(slow))) result = sinceFirst ? now : now.sub(H);
      }
    } else {
      for (let m = 1; m <= 48 * 60 && !result; m++) {
        const now = at(m);
        const a = now.mul(v1);
        const b = now.gt(H) ? F(D).sub(now.sub(H).mul(v2)) : F(D);
        if (a.gte(b)) result = a;
      }
    }
    if (!result) return 'no meeting found';
    const hits = values.flatMap((v, i) => (v.eq(result!) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

export const rateMeetingTemplates: Template<any>[] = [meeting];
