import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { clock, num } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { choiceValuesMatch, dx, valuedChoices, expectMcs, expectQc, NAMES, qcEnd, uniqueIndex } from './util';

/** Pairs of times whose combined time a*b/(a+b) is a terminating decimal. */
function pairsWithNiceTogether(maxT: number, integerOnly: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 2; a <= maxT; a++)
    for (let b = a + 1; b <= maxT; b++) {
      const t = frac(a * b, a + b);
      if (integerOnly ? t.isInt() : t.mul(10).isInt()) out.push([a, b]);
    }
  return out;
}

const INT_PAIRS = pairsWithNiceTogether(40, true);
const DEC_PAIRS = pairsWithNiceTogether(40, false).filter(([a, b]) => !frac(a * b, a + b).isInt());

/* =============================================================================================
 * 1. Combined work: together, units, one stops early, a drain (NE) [BOOK AL-07]
 * =========================================================================================== */

interface WorkParams {
  kind: 'together' | 'units' | 'stops' | 'drain';
  a: number;
  b: number;
  /** units: units per batch and units required; stops: hours together. */
  u: number;
  M: number;
  t: number;
}

const MACHINES = [
  { A: 'Machine A', B: 'Machine B', job: 'fill a production order', both: 'Machines A and B' },
  { A: 'Printer P', B: 'Printer Q', job: 'print a batch of brochures', both: 'Printers P and Q' },
  { A: 'Pump X', B: 'Pump Y', job: 'fill a tank', both: 'Pumps X and Y' },
];

const combinedWork: Template<WorkParams> = {
  id: 'alg.rate-work.combined',
  skill: 'alg.rate-work',
  format: 'ne',
  style: 'time for two workers together (rates add)',
  generate(rng, d) {
    const kind: WorkParams['kind'] = d === 1 ? 'together' : d === 2 ? rng.pick(['together', 'units'] as const) : rng.pick(['stops', 'drain', 'units'] as const);
    const m = rng.pick(MACHINES);
    const base: WorkParams = { kind, a: 0, b: 0, u: 0, M: 0, t: 0 };
    if (kind === 'together') {
      const [a, b] = rng.shuffle(rng.pick(d === 1 ? INT_PAIRS.filter(([x, y]) => y <= 24 && x >= 3) : DEC_PAIRS.filter(([, y]) => y <= 30)));
      const T = frac(a * b, a + b);
      const unit = d === 1 ? 'hours' : 'minutes';
      return {
        params: { ...base, a, b },
        q: {
          format: 'ne',
          stem: `Working alone at its constant rate, ${m.A} can ${m.job} in ${a} ${unit}. Working alone at its constant rate, ${m.B} can ${m.job} in ${b} ${unit}. How many ${unit} does it take ${m.both}, working simultaneously at their respective constant rates, to ${m.job}?`,
          answer: T,
          suffix: unit,
          traps: [
            { value: frac(a + b, 2), trap: 'algw-average-times' },
            { value: frac(a + b), trap: 'algw-add-times' },
          ].filter((t) => t.value.isTerminating()),
          explanation: `Add the rates. ${m.A} does $\\frac{1}{${a}}$ of the job per ${unit.slice(0, -1)} and ${m.B} does $\\frac{1}{${b}}$, so together they do

$$\\frac{1}{${a}} + \\frac{1}{${b}} = \\frac{${a + b}}{${a * b}}$$

of the job per ${unit.slice(0, -1)}. The time is the reciprocal: $\\frac{${a * b}}{${a + b}} = ${dx(T)}$ ${unit}.

Sanity check: together they must be faster than the faster one alone (${Math.min(a, b)} ${unit}). The average of the times, ${dx(frac(a + b, 2))}, is slower than that.`,
        },
      };
    }
    if (kind === 'units') {
      for (;;) {
        const u = rng.pick([60, 120, 150, 180, 240, 300]);
        const a = rng.pick([4, 5, 6, 8, 10, 12, 15, 20]);
        const b = rng.pick([4, 5, 6, 8, 10, 12, 15, 20, 24, 30]);
        if (a === b || u % a !== 0 || u % b !== 0) continue;
        const ra = u / a;
        const rb = u / b;
        const M = (ra + rb) * rng.int(2, 9);
        if (M === u) continue;
        const T = M / (ra + rb);
        const thing = rng.pick(['bolts', 'labels', 'boxes', 'copies']);
        const wrongAvg = frac(M * (a + b), 2 * u);
        return {
          params: { ...base, a, b, u, M },
          q: {
            format: 'ne',
            stem: `Working alone at its constant rate, ${m.A} produces ${u} ${thing} in ${a} minutes. Working alone at its constant rate, ${m.B} produces ${u} ${thing} in ${b} minutes. At these rates, how many minutes does it take ${m.both}, working simultaneously, to produce ${num(M)} ${thing}?`,
            answer: frac(T),
            suffix: 'minutes',
            traps: wrongAvg.isTerminating() && !wrongAvg.eq(T) ? [{ value: wrongAvg, trap: 'algw-average-times' }] : [],
            explanation: `${m.A} produces $\\frac{${u}}{${a}} = ${ra}$ ${thing} per minute and ${m.B} produces $\\frac{${u}}{${b}} = ${rb}$ per minute. Together: ${ra + rb} ${thing} per minute.

Time $= \\frac{${num(M)}}{${ra + rb}} = ${T}$ minutes.

Rates (${thing} per minute) add; times do not.`,
          },
        };
      }
    }
    if (kind === 'stops') {
      for (;;) {
        const [a, b] = rng.shuffle(rng.pick(INT_PAIRS.filter(([, y]) => y <= 30)));
        const t = rng.int(1, Math.floor((a * b) / (a + b)) - 1 || 1);
        const left = frac(1).sub(frac(t, a)).sub(frac(t, b));
        if (left.sign() <= 0) continue;
        const R = left.mul(b);
        if (!R.isTerminating() || !R.mul(100).isInt()) continue;
        const traps: { value: Frac; trap: string }[] = [];
        const naive = frac(b - t);
        if (!naive.eq(R) && naive.sign() > 0) traps.push({ value: naive, trap: 'algw-subtract-times' });
        return {
          params: { ...base, a, b, t },
          q: {
            format: 'ne',
            stem: `Working alone at its constant rate, ${m.A} can ${m.job} in ${a} hours, and ${m.B}, working alone at its constant rate, can do the same job in ${b} hours. The two work together for ${t} hour${t === 1 ? '' : 's'}, and then ${m.A} stops. How many more hours does it take ${m.B}, working alone, to finish the job?`,
            answer: R,
            suffix: 'hours',
            traps,
            explanation: `Together they do $\\frac{1}{${a}} + \\frac{1}{${b}}$ of the job per hour, so in ${t} hour${t === 1 ? '' : 's'} they finish $${t}\\left(\\frac{1}{${a}} + \\frac{1}{${b}}\\right) = ${num(frac(t, a).add(frac(t, b)))}$ of it.

That leaves $${num(left)}$ of the job for ${m.B}, which does $\\frac{1}{${b}}$ per hour: $${num(left)} \\div \\frac{1}{${b}} = ${num(left)} \\times ${b} = ${dx(R)}$ hours.

Subtracting times (${b} − ${t}) ignores the work ${m.A} did; always track the FRACTION of the job done.`,
          },
        };
      }
    }
    // drain: filling pipe a hours, drain b hours (b > a)
    for (;;) {
      const a = rng.int(2, 12);
      const b = a + rng.int(1, 12);
      const T = frac(a * b, b - a);
      if (!T.isTerminating() || !T.mul(10).isInt() || T.toNumber() > 60) continue;
      const wrong = frac(a * b, a + b);
      return {
        params: { ...base, a, b },
        q: {
          format: 'ne',
          stem: `An inlet pipe, working alone at its constant rate, can fill an empty tank in ${a} hours. A drain, working alone at its constant rate, can empty the full tank in ${b} hours. If the tank is empty and both the inlet pipe and the drain are open, how many hours will it take to fill the tank?`,
          answer: T,
          suffix: 'hours',
          traps: wrong.isTerminating() ? [{ value: wrong, trap: 'algw-drain-sign' }] : [],
          explanation: `The pipe adds $\\frac{1}{${a}}$ of a tank per hour and the drain removes $\\frac{1}{${b}}$, so the tank gains

$$\\frac{1}{${a}} - \\frac{1}{${b}} = \\frac{${b - a}}{${a * b}}$$

of a tank per hour. Filling it takes $\\frac{${a * b}}{${b - a}} = ${dx(T)}$ hours, longer than the pipe alone (${a} hours), as it must be.`,
        },
      };
    }
  },
  check(q, { kind, a, b, u, M, t }) {
    // Plug the stored answer back into the work equation.
    if (q.format !== 'ne') return 'wrong format';
    const T = q.answer;
    let done: Frac;
    if (kind === 'together') done = T.div(a).add(T.div(b));
    else if (kind === 'units') done = T.mul(u).div(a).add(T.mul(u).div(b)).div(M);
    else if (kind === 'stops') done = frac(t, a).add(frac(t, b)).add(T.div(b));
    else done = T.div(a).sub(T.div(b));
    return done.eq(1) ? null : `answer does not complete the job (${done})`;
  },
};

/* =============================================================================================
 * 2. Time for one worker alone, from a time together (MCS) [BOOK AL-07 reverse form, PS2]
 * =========================================================================================== */

interface AloneParams {
  kind: 'two' | 'three';
  /** Time for the whole team, and time for the known part of the team (one machine, or two pumps). */
  together: Frac;
  known: Frac;
  values: Frac[];
}

const THREE_PAIRS: [number, number][] = [];
for (let T3 = 2; T3 <= 12; T3++)
  for (let T2 = T3 + 1; T2 <= 15; T2++) {
    const c = frac(T2 * T3, T2 - T3);
    if (c.isTerminating() && c.mul(100).isInt() && c.toNumber() <= 60) THREE_PAIRS.push([T2, T3]);
  }

const fmtDec = (v: Frac) => `$${dx(v)}$`;

const aloneTime: Template<AloneParams> = {
  id: 'alg.rate-work.alone-time',
  skill: 'alg.rate-work',
  format: 'mcs',
  style: 'time alone from the time together (subtract rates)',
  generate(rng, d) {
    const kind: AloneParams['kind'] = d === 3 || (d === 2 && rng.chance(0.3)) ? 'three' : 'two';
    let correct: Frac;
    let traps: { value: Frac; trap: string }[];
    let stem: string;
    let explanation: string;
    let together: Frac;
    let known: Frac;
    if (kind === 'two') {
      const pool = (d === 1 ? INT_PAIRS : [...INT_PAIRS, ...DEC_PAIRS]).filter(([, y]) => y <= 30);
      const [x, y] = rng.shuffle(rng.pick(pool));
      const Tt = frac(x * y, x + y);
      const a = x;
      together = Tt;
      known = frac(a);
      correct = frac(y);
      traps = [
        { value: frac(a).sub(Tt), trap: 'algw-subtract-times' },
        { value: Tt.mul(2).sub(a), trap: 'algw-average-times' },
        { value: frac(a).add(Tt), trap: 'algw-add-times' },
        { value: Tt.div(2), trap: 'algw-alone-faster' },
      ].filter((t) => t.value.sign() > 0 && t.value.mul(100).isInt());
      const m = rng.pick(MACHINES);
      stem = `Working simultaneously at their respective constant rates, ${m.both} can ${m.job} in ${dx(Tt)} hours. Working alone at its constant rate, ${m.A} can ${m.job} in ${a} hours. How many hours would it take ${m.B}, working alone at its constant rate, to ${m.job}?`;
      explanation = `Subtract rates, not times. Together they do $\\frac{1}{${dx(Tt)}}$ of the job per hour and ${m.A} alone does $\\frac{1}{${a}}$, so ${m.B} does

$$\\frac{1}{${dx(Tt)}} - \\frac{1}{${a}} = \\frac{1}{${y}}$$

of the job per hour, and needs ${y} hours alone.

Check: $\\frac{${a} \\cdot ${y}}{${a} + ${y}} = ${dx(Tt)}$. A time alone shorter than ${dx(Tt)} hours is impossible, and $${a} - ${dx(Tt)}$ treats times like rates.`;
    } else {
      const [T2, T3] = rng.pick(THREE_PAIRS);
      together = frac(T3);
      known = frac(T2);
      correct = frac(T2 * T3, T2 - T3);
      traps = [
        { value: frac(T2 - T3), trap: 'algw-subtract-times' },
        { value: frac(T3, 2), trap: 'algw-alone-faster' },
        { value: frac(T2 + T3), trap: 'algw-add-times' },
        { value: frac(2 * T3 - T2), trap: 'algw-average-times' },
      ].filter((t) => t.value.sign() > 0 && !t.value.eq(correct));
      const names = rng.pick([
        ['A', 'B', 'C'],
        ['P', 'Q', 'R'],
        ['X', 'Y', 'Z'],
      ]);
      stem = `Working together at their respective constant rates, pumps ${names[0]}, ${names[1]}, and ${names[2]} can fill an empty tank in ${T3} hours. Pumps ${names[0]} and ${names[1]}, working together at their respective constant rates, can fill the empty tank in ${T2} hours. How many hours would it take pump ${names[2]}, working alone at its constant rate, to fill the empty tank?`;
      explanation = `All three fill $\\frac{1}{${T3}}$ of the tank per hour and pumps ${names[0]} and ${names[1]} fill $\\frac{1}{${T2}}$, so pump ${names[2]} alone fills

$$\\frac{1}{${T3}} - \\frac{1}{${T2}} = \\frac{${T2 - T3}}{${T2 * T3}}$$

of the tank per hour. Alone it needs $\\frac{${T2 * T3}}{${T2 - T3}} = ${dx(correct)}$ hours.

$${T2} - ${T3} = ${T2 - T3}$ subtracts times instead of rates, and any answer below ${T3} hours would make pump ${names[2]} faster than all three pumps together.`;
    }
    const dir = rng.sign();
    const fillers = [correct.add(dir), correct.add(2 * dir), correct.sub(dir)].filter((v) => v.sign() > 0);
    const { choices, answer, values } = valuedChoices(rng, { correct, traps: rng.shuffle(traps).slice(0, 3), fillers, format: fmtDec, positive: true });
    return { params: { kind, together, known, values }, q: { format: 'mcs', stem, choices, answer, explanation } };
  },
  check(q, { together, known, values }) {
    const err = choiceValuesMatch(q, values, fmtDec);
    if (err) return err;
    // A choice is right when its rate plus the known rate is the team's rate.
    return expectMcs(
      q,
      uniqueIndex(values, (v) => v.sign() > 0 && frac(1).div(known).add(frac(1).div(v)).eq(frac(1).div(together))),
    );
  },
};

/* =============================================================================================
 * 3. Average speed and speed-time relations (QC) [GEN AL-G23; BOOK AL-12 inverse variation]
 * =========================================================================================== */

interface SpeedParams {
  mode: 'round-mean' | 'round-value' | 'split' | 'faster';
  u: number;
  v: number;
  N: number;
  swap: boolean;
  /** split: 'none' | 'more-slow' | 'more-fast' | 'equal-time' */
  cond: 'none' | 'more-slow' | 'more-fast' | 'equal-time';
  /** faster: percent increase and multiplier k (in hundredths). */
  pct: number;
  k100: number;
}

const HARMONIC: [number, number][] = [];
for (let u = 20; u <= 80; u += 5)
  for (let v = u + 10; v <= 120; v += 5) if ((2 * u * v) % (u + v) === 0 && (u + v) % 2 === 0) HARMONIC.push([u, v]);

const speedQC: Template<SpeedParams> = {
  id: 'alg.rate-work.speed-qc',
  skill: 'alg.rate-work',
  format: 'qc',
  style: 'average speed is total distance over total time',
  generate(rng, d) {
    const mode = rng.pick(d === 1 ? (['round-mean', 'round-value', 'faster'] as const) : d === 2 ? (['round-value', 'split', 'faster'] as const) : (['split', 'faster', 'round-value', 'split'] as const));
    const base: SpeedParams = { mode, u: 0, v: 0, N: 0, swap: false, cond: 'none', pct: 0, k100: 0 };
    const [nm] = rng.sample(NAMES, 1);
    if (mode === 'round-mean' || mode === 'round-value') {
      const [u, v] = rng.pick(HARMONIC);
      const H = (2 * u * v) / (u + v);
      const mean = (u + v) / 2;
      const N = mode === 'round-mean' ? mean : rng.pick([H, H, H + 1, H - 1, mean]);
      const swap = rng.chance(0.4);
      const A = swap ? N : H;
      const B = swap ? H : N;
      const answer = qcCompare(A, B);
      const wrongA = swap ? N : mean;
      const wrongB = swap ? mean : N;
      const trapAns = qcCompare(wrongA, wrongB);
      const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-average-speeds' } : undefined;
      const qAvg = `${nm}'s average speed, in miles per hour, for the entire round trip`;
      return {
        params: { ...base, u, v, N, swap },
        q: {
          format: 'qc',
          info: `${nm} drove from home to a lake at an average speed of ${u} miles per hour and returned home along the same route at an average speed of ${v} miles per hour.`,
          quantityA: swap ? `$${num(N)}$` : qAvg,
          quantityB: swap ? qAvg : `$${num(N)}$`,
          answer,
          traps,
          explanation: `Pick a convenient distance, say ${u * v / gcdN(u, v)} miles each way (a multiple of ${u} and ${v}). Going takes $\\frac{${u * v / gcdN(u, v)}}{${u}} = ${v / gcdN(u, v)}$ hours and returning takes $\\frac{${u * v / gcdN(u, v)}}{${v}} = ${u / gcdN(u, v)}$ ${u / gcdN(u, v) === 1 ? 'hour' : 'hours'}.

Average speed $= \\frac{\\text{total distance}}{\\text{total time}} = \\frac{${(2 * u * v) / gcdN(u, v)}}{${(u + v) / gcdN(u, v)}} = ${H}$ miles per hour, whatever the distance.

${N === mean ? `It is less than ${mean}, the average of the two speeds, because more time is spent at the slower speed. ` : ''}${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'split') {
      const u = rng.pick([30, 40, 45, 50]);
      const v = u + rng.pick([10, 20, 30]);
      const cond = rng.pick(['none', 'more-slow', 'more-fast', 'equal-time'] as const);
      const mean = frac(u + v, 2);
      const answer: QCChoice = cond === 'equal-time' ? 'C' : cond === 'more-slow' ? 'B' : 'D';
      const traps: QCQuestion['traps'] = answer === 'D' ? { C: 'algw-average-speeds' } : answer === 'B' ? { C: 'algw-average-speeds' } : { B: 'algw-single-case' };
      const condText =
        cond === 'none'
          ? ''
          : cond === 'more-slow'
            ? ` ${nm} drove more miles at ${u} miles per hour than at ${v} miles per hour.`
            : cond === 'more-fast'
              ? ` ${nm} drove more miles at ${v} miles per hour than at ${u} miles per hour.`
              : ` ${nm} drove for the same amount of time at each speed.`;
      const why =
        cond === 'equal-time'
          ? `With equal times $t$ at each speed, the distance is $${u}t + ${v}t$ and the time is $2t$, so the average speed is exactly $\\frac{${u} + ${v}}{2} = ${num(mean)}$. ${qcEnd('C')}`
          : cond === 'more-slow'
            ? `Even with equal distances, more TIME is spent at ${u} miles per hour, so the average is below $${num(mean)}$. With even more distance at ${u}, it is lower still. ${qcEnd('B')}`
            : `The average speed is $${num(mean)}$ only when the times at the two speeds are equal. With $x$ miles at ${u} and $y$ miles at ${v}, that happens when $\\frac{x}{${u}} = \\frac{y}{${v}}$. ${
                cond === 'more-fast'
                  ? `Driving more miles at ${v} still allows $\\frac{x}{${u}}$ to be smaller or larger than $\\frac{y}{${v}}$ (for example $x = ${u}, y = ${2 * v}$ or $x = ${u * 2}, y = ${u * 2 + 10}$), so the average can be above or below $${num(mean)}$.`
                  : `With most of the miles at ${v} the average is close to ${v}; with most at ${u} it is close to ${u}.`
              } ${qcEnd('D')}`;
      return {
        params: { ...base, u, v, cond },
        q: {
          format: 'qc',
          info: `On a trip, ${nm} drove $x$ miles at an average speed of ${u} miles per hour and then $y$ miles at an average speed of ${v} miles per hour.${condText}`,
          quantityA: `${nm}'s average speed, in miles per hour, for the entire trip`,
          quantityB: `$${num(mean)}$`,
          answer,
          traps,
          explanation: `Average speed $= \\frac{x + y}{\\frac{x}{${u}} + \\frac{y}{${v}}}$, total distance over total time; it is a weighted average of ${u} and ${v} weighted by TIME.

${why}`,
        },
      };
    }
    // faster: same distance, speed increased by pct percent; compare t with k * T
    const pct = rng.pick([25, 20, 50]);
    const ratio = frac(100 + pct, 100); // t / T
    const opts = pct === 25 ? [120, 125, 130] : pct === 20 ? [115, 120, 125] : [140, 150, 160];
    const k100 = rng.pick(opts);
    const answer = qcCompare(ratio, frac(k100, 100));
    const wrongRatio = frac(100, 100 - pct); // thinks time drops by pct percent
    const trapAns = qcCompare(wrongRatio, frac(k100, 100));
    const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-direct-variation' } : undefined;
    return {
      params: { ...base, pct, k100 },
      q: {
        format: 'qc',
        info: `Driving at a constant speed, ${nm} makes a certain trip in $t$ hours. Driving at a constant speed that is ${pct} percent greater, ${nm} makes the same trip in $T$ hours.`,
        quantityA: '$t$',
        quantityB: `$${dx(frac(k100, 100))}T$`,
        answer,
        traps,
        explanation: `For a fixed distance, time × speed is constant. The new speed is ${dx(ratio)} times the old one, so $t = ${dx(ratio)}T$.

Compare $${dx(ratio)}T$ with $${dx(frac(k100, 100))}T$ ($T > 0$). ${qcEnd(answer)}

A speed ${pct} percent greater does not cut the time by ${pct} percent: $T = \\frac{t}{${dx(ratio)}} = ${hrs(frac(100, 100 + pct))}t$.`,
      },
    };
  },
  check(q, prm, rng) {
    const samples: [Frac, Frac][] = [];
    if (prm.mode === 'round-mean' || prm.mode === 'round-value') {
      for (let i = 0; i < 30; i++) {
        const dist = frac(rng.int(1, 500));
        const time = dist.div(prm.u).add(dist.div(prm.v));
        const avg = dist.mul(2).div(time);
        samples.push(prm.swap ? [frac(prm.N), avg] : [avg, frac(prm.N)]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    if (prm.mode === 'split') {
      for (let i = 0; i < 2000; i++) {
        let x: Frac;
        let y: Frac;
        if (prm.cond === 'equal-time') {
          const t = frac(rng.int(1, 200), 10);
          x = t.mul(prm.u);
          y = t.mul(prm.v);
        } else {
          x = frac(rng.int(1, 600));
          y = frac(rng.int(1, 600));
          if (prm.cond === 'more-slow' && !x.gt(y)) continue;
          if (prm.cond === 'more-fast' && !y.gt(x)) continue;
        }
        const avg = x.add(y).div(x.div(prm.u).add(y.div(prm.v)));
        samples.push([avg, frac(prm.u + prm.v, 2)]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    for (let i = 0; i < 30; i++) {
      const dist = frac(rng.int(10, 500));
      const s = frac(rng.int(10, 80));
      const t = dist.div(s);
      const T = dist.div(s.mul(100 + prm.pct).div(100));
      samples.push([t, T.mul(prm.k100).div(100)]);
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/** Hours as a decimal when it terminates, otherwise as a fraction. */
const hrs = (h: Frac) => (h.isTerminating() ? dx(h) : num(h));

function gcdN(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/* =============================================================================================
 * 4. When do two travelers meet or catch up? (MCS, clock-time choices) [GEN AL-G22]
 * =========================================================================================== */

interface MeetParams {
  kind: 'toward' | 'catch' | 'toward-delay';
  D: number;
  u: number;
  v: number;
  t0: number;
  delay: number;
  times: number[];
}

const meetCatch: Template<MeetParams> = {
  id: 'alg.rate-work.meet-catch',
  skill: 'alg.rate-work',
  format: 'mcs',
  style: 'meeting or catch-up time with relative speed',
  generate(rng, d) {
    const kind: MeetParams['kind'] = d === 1 ? 'toward' : d === 2 ? 'catch' : rng.pick(['toward-delay', 'catch'] as const);
    for (;;) {
      const t0 = rng.pick([7, 8, 9, 10, 11, 13, 14]) * 60 + rng.pick([0, 0, 30]);
      let D = 0;
      let u: number;
      let v: number;
      let delay = 0;
      let meet: number; // minutes after midnight
      const wrong: { t: number; trap?: string }[] = [];
      let stem: string;
      let explanation: string;
      const [n1, n2] = rng.sample(NAMES, 2);
      if (kind === 'toward') {
        u = rng.pick([40, 45, 50, 55, 60, 65, 70]);
        v = rng.pick([50, 55, 60, 65, 70, 75, 80]);
        const hours = frac(rng.pick([3, 4, 5, 6, 7, 8, 9, 10]), 4); // 0.75 to 2.5 hours
        D = hours.mul(u + v).toNumber();
        if (!Number.isInteger(D) || u === v) continue;
        meet = t0 + hours.mul(60).toNumber();
        if (v !== u) {
          const w = frac(D, Math.abs(v - u)).mul(60);
          if (w.isInt() && w.toNumber() < 600) wrong.push({ t: t0 + w.toNumber(), trap: 'algw-relative-speed-sign' });
        }
        stem = `${n1} and ${n2} live ${D} miles apart. At ${clock(t0, 'short')} they start driving toward each other on the same road, ${n1} at a constant speed of ${u} miles per hour and ${n2} at a constant speed of ${v} miles per hour. At what time do they meet?`;
        explanation = `They close the gap at $${u} + ${v} = ${u + v}$ miles per hour (approaching, the speeds add). Time to meet: $\\frac{${D}}{${u + v}} = ${hrs(hours)}$ ${hours.eq(1) ? 'hour' : 'hours'}, that is, ${hours.mul(60).toNumber()} minutes after ${clock(t0, 'short')}, so they meet at ${clock(meet, 'short')}`;
      } else if (kind === 'catch') {
        u = rng.pick([30, 40, 45, 48, 50, 60]);
        v = u + rng.pick([10, 12, 15, 20, 30]);
        delay = rng.pick([30, 45, 60, 90, 120]);
        const gap = frac(u * delay, 60);
        const hours = gap.div(v - u);
        const mins = hours.mul(60);
        if (!mins.isInt() || mins.toNumber() > 480 || mins.toNumber() < 15) continue;
        meet = t0 + delay + mins.toNumber();
        const w1 = gap.div(u + v).mul(60);
        if (w1.isInt()) wrong.push({ t: t0 + delay + w1.toNumber(), trap: 'algw-relative-speed-sign' });
        wrong.push({ t: t0 + mins.toNumber(), trap: 'algw-wrong-start-time' });
        stem = `${n1} leaves a rest stop at ${clock(t0, 'short')} and drives along a highway at a constant speed of ${u} miles per hour. ${n2} leaves the same rest stop at ${clock(
          t0 + delay,
          'short',
        )} and drives along the same highway in the same direction at a constant speed of ${v} miles per hour. At what time does ${n2} catch up with ${n1}?`;
        explanation = `When ${n2} leaves, ${n1} has a head start of $${u} \\times ${dx(frac(delay, 60))} = ${hrs(gap)}$ miles. Moving in the same direction, ${n2} closes that gap at $${v} - ${u} = ${v - u}$ miles per hour, so it takes $\\frac{${hrs(gap)}}{${v - u}} = ${hrs(hours)}$ ${hours.eq(1) ? 'hour' : 'hours'} (${mins.toNumber()} minutes) after ${clock(t0 + delay, 'short')}, that is, until ${clock(meet, 'short')}

Adding the speeds would be right only if they drove toward each other, and the catch-up time is counted from ${n2}'s departure, not from ${n1}'s.`;
      } else {
        u = rng.pick([40, 45, 50, 60]);
        v = rng.pick([50, 55, 60, 65, 70, 75]);
        delay = rng.pick([30, 60, 90]);
        const hoursAfter = frac(rng.pick([2, 3, 4, 5, 6, 7, 8]), 4);
        D = frac(u * delay, 60).add(hoursAfter.mul(u + v)).toNumber();
        if (!Number.isInteger(D)) continue;
        meet = t0 + delay + hoursAfter.mul(60).toNumber();
        const ignore = frac(D, u + v).mul(60);
        if (ignore.isInt()) {
          wrong.push({ t: t0 + delay + ignore.toNumber(), trap: 'algw-head-start' });
          wrong.push({ t: t0 + ignore.toNumber() });
        }
        wrong.push({ t: t0 + hoursAfter.mul(60).toNumber(), trap: 'algw-wrong-start-time' });
        stem = `Towns P and Q are ${D} miles apart. At ${clock(t0, 'short')}, ${n1} leaves P and drives toward Q at a constant speed of ${u} miles per hour. At ${clock(
          t0 + delay,
          'short',
        )}, ${n2} leaves Q and drives toward P on the same road at a constant speed of ${v} miles per hour. At what time do they meet?`;
        explanation = `By ${clock(t0 + delay, 'short')}, ${n1} has driven $${u} \\times ${dx(frac(delay, 60))} = ${hrs(frac(u * delay, 60))}$ miles, so $${hrs(frac(D * 60 - u * delay, 60))}$ miles separate them. From then on they approach each other at $${u} + ${v} = ${u + v}$ miles per hour, meeting $\\frac{${hrs(frac(D * 60 - u * delay, 60))}}{${u + v}} = ${hrs(hoursAfter)}$ ${hoursAfter.eq(1) ? 'hour' : 'hours'} later, at ${clock(meet, 'short')}

Ignoring ${n1}'s head start, or adding the travel time to ${clock(t0, 'short')} instead of ${clock(t0 + delay, 'short')}, gives the wrong time.`;
      }
      // Choices: correct, traps, and quarter-hour neighbors; listed in time order.
      const opts = new Map<number, string | undefined>();
      opts.set(meet, undefined);
      for (const w of wrong) if (!opts.has(w.t) && w.t > t0 && w.t < 24 * 60 && opts.size < 4) opts.set(w.t, w.trap);
      const dir = rng.sign();
      for (const step of [dir * 30, dir * 60, dir * 90, -dir * 30, -dir * 60, dir * 15]) {
        const t = meet + step;
        if (opts.size >= 5) break;
        if (!opts.has(t) && t > t0 && t < 24 * 60) opts.set(t, undefined);
      }
      if (opts.size < 5 || meet > 22 * 60) continue;
      const times = [...opts.keys()].sort((x, y) => x - y);
      const choices: Choice[] = times.map((t) => ({ text: clock(t, 'short'), ...(opts.get(t) ? { trap: opts.get(t)! } : {}) }));
      return {
        params: { kind, D, u, v, t0, delay, times },
        q: { format: 'mcs', stem, choices, answer: times.indexOf(meet), explanation },
      };
    }
  },
  check(q, { kind, D, u, v, t0, delay, times }) {
    if (q.format !== 'mcs') return 'wrong format';
    for (let i = 0; i < times.length; i++) if (q.choices[i].text !== clock(times[i], 'short')) return 'choice text mismatch';
    // Minute-by-minute simulation of both positions (miles from the first traveler's start).
    const startB = kind === 'toward' ? t0 : t0 + delay;
    let hit: number | null = null;
    for (let t = t0; t < 24 * 60 && hit === null; t++) {
      const a = frac(u * (t - t0), 60);
      const bMoved = t >= startB ? frac(v * (t - startB), 60) : frac(0);
      if (kind === 'catch') {
        if (t > startB && bMoved.eq(a)) hit = t;
      } else if (a.add(bMoved).eq(D)) hit = t;
    }
    if (hit === null) return 'they never meet';
    return expectMcs(
      q,
      uniqueIndex(times, (t) => t === hit),
    );
  },
};

export const rateWorkTemplates: Template<any>[] = [combinedWork, aloneTime, speedQC, meetCatch];
