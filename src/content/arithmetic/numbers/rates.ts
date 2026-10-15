import { flaggedChoices, qcCompare, qcFromSamples, valuedChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal, num, plain, usd } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, dec, plainNum, QC_REL, expectMCM, expectMCS, expectNE, expectQC, F, fd, numChoices, pickWeighted, qcEnd, spreadFillers, swapQC } from './util';

/* ================================================================== 1. Rate x time with a unit conversion (QC) */

interface UCParams {
  ctx: number;
  a: number;
  b: number;
  t: number;
  value: number;
  swap: boolean;
  /** the duration is an unknown positive integer h */
  unknown?: boolean;
}

interface UCCtx {
  /** seconds per "b unit" and per "t unit" */
  bUnit: 'second' | 'minute';
  tUnit: 'hour' | 'day';
  info: (a: number, b: number, t: number) => string;
  qa: (t: number) => string;
  /** same situation with an unknown whole number of hours (days) h */
  infoH: (a: number, b: number) => string;
  qaH: string;
}

const UC_CTX: UCCtx[] = [
  {
    bUnit: 'second',
    tUnit: 'hour',
    info: (a, b, t) => `A copy machine ran without stopping for ${t > 1 ? `${t} hours` : 'one hour'}, producing ${a} copies every ${b} seconds the whole time.`,
    qa: (t) => `The number of copies the machine made in ${t > 1 ? `the ${t} hours` : 'that hour'}`,
    infoH: (a, b) => `A copy machine ran without stopping for $h$ hours, producing ${a} copies every ${b} seconds the whole time. $h$ is a positive integer.`,
    qaH: 'The number of copies the machine made in the $h$ hours',
  },
  {
    bUnit: 'second',
    tUnit: 'hour',
    info: (a, b, t) => `A machine fills bottles at a constant rate of ${a} bottles every ${b} seconds. It runs without stopping for ${t > 1 ? `${t} hours` : 'one hour'}.`,
    qa: (t) => `The number of bottles the machine fills in ${t > 1 ? `${t} hours` : 'one hour'}`,
    infoH: (a, b) => `A machine fills bottles at a constant rate of ${a} bottles every ${b} seconds. It runs without stopping for $h$ hours, where $h$ is a positive integer.`,
    qaH: 'The number of bottles the machine fills in $h$ hours',
  },
  {
    bUnit: 'minute',
    tUnit: 'day',
    info: (a, b, t) => `Water drips from a leaking pipe at a constant rate of ${a} milliliters every ${b} minutes, for ${t > 1 ? `${t} full days` : 'one full day'}.`,
    qa: (t) => `The number of milliliters of water that drip from the pipe in ${t > 1 ? `the ${t} days` : 'that day'}`,
    infoH: (a, b) => `Water drips from a leaking pipe at a constant rate of ${a} milliliters every ${b} minutes, for $h$ full days, where $h$ is a positive integer.`,
    qaH: 'The number of milliliters of water that drip from the pipe in the $h$ days',
  },
];

const unitConvertQC: Template<UCParams> = {
  id: 'arith.rates.unit-convert-qc',
  skill: 'arith.rates',
  format: 'qc',
  style: 'constant rate over a long time, with a unit conversion',
  generate(rng, d) {
    const ctxIdx = rng.int(0, UC_CTX.length - 1);
    const C = UC_CTX[ctxIdx];
    const span = C.tUnit === 'hour' ? 3600 : 1440; // number of b-units in one t-unit
    let a: number;
    let b: number;
    do {
      a = rng.int(2, 9);
      b = rng.pick(C.bUnit === 'second' ? [2, 3, 4, 5, 6, 8, 9, 10, 12, 15] : [2, 3, 4, 5, 6, 8, 10, 12]);
    } while (a === b || ((span * a) % b !== 0 && d === 1));
    let t = C.tUnit === 'hour' ? rng.int(d === 1 ? 1 : 2, d === 3 ? 8 : 5) : rng.int(1, 3);
    if (a === 2 && b === 3 && t === 5) t = 4; // avoid the published example's numbers
    const exact = (span * t * a) / b;
    if (!Number.isInteger(exact)) return unitConvertQC.generate(rng, d);
    // Sometimes the duration is only known to be a whole number: the relation can then flip with h (answer D).
    const per = (span * a) / b;
    if (Number.isInteger(per) && rng.chance(d === 1 ? 0.15 : 0.3)) {
      const flips = rng.chance(0.7);
      const m = rng.int(1, 4);
      const options = flips ? [per * m, per * m + a] : [per - a, per - b, per - 10, per - 100].filter((v) => v > 0);
      const value = rng.pick(options);
      const swapH = rng.chance(0.4);
      const first = qcCompare(per, value); // the amount compared with the value at h = 1
      const answer: QCChoice = flips ? 'D' : swapH ? 'B' : 'A';
      const unitWord = C.tUnit;
      const hBeyond = Math.floor(value / per) + 1;
      const qb = `$${num(value)}$`;
      return {
        params: { ctx: ctxIdx, a, b, t: 1, value, swap: swapH, unknown: true },
        q: {
          format: 'qc',
          info: C.infoH(a, b),
          quantityA: swapH ? qb : C.qaH,
          quantityB: swapH ? C.qaH : qb,
          answer,
          traps: flips ? { [swapH ? swapQC(first) : first]: 'tested-one-value' } : undefined,
          explanation: `One ${unitWord} is ${plain(span)} ${C.bUnit}s, so the amount in one ${unitWord} is $${num(span)} \\times \\frac{${a}}{${b}} = ${num(per)}$, and in $h$ ${unitWord}s it is $${num(per)}h$.

${
            flips
              ? `Test two allowed values of $h$: $h = 1$ gives ${plain(per)}, which is ${first === 'C' ? 'equal to' : 'less than'} ${plain(value)}, and $h = ${hBeyond}$ gives ${plain(per * hBeyond)}, which is more than ${plain(value)}. The relationship depends on $h$, so it cannot be determined. (D)

Trap: testing only $h = 1$ suggests ${QC_REL[swapH ? swapQC(first) : first]}; $h$ can be any positive integer.`
              : `Even the shortest allowed duration ($h = 1$) gives ${plain(per)}, which is more than ${plain(value)}, and the amount only grows with $h$. So the amount is always greater. (${answer})

Trap: D is tempting only because $h$ is not given; here every allowed $h$ leads to the same answer.`
          }`,
        },
      };
    }
    const kase = pickWeighted(rng, [
      ['C', 2.5],
      ['near', 4],
      ['short', 1.5],
      ['inverted', d === 1 ? 0 : 1.5],
    ] as ['C' | 'near' | 'short' | 'inverted', number][]);
    let value: number;
    let trapId: string | null = null;
    if (kase === 'C') value = exact;
    else if (kase === 'near') value = exact + (rng.chance(0.5) ? 1 : -1) * rng.pick([a, b, 10, 100, 1000].filter((x) => x < exact / 2));
    else if (kase === 'short') {
      value = (60 * t * a) / b; // one factor of 60 forgotten
      trapId = 'num-time-conversion';
    } else {
      value = (span * t * b) / a; // rate turned upside down
      trapId = 'num-inverted-rate';
    }
    if (!Number.isInteger(value) || value === exact || value <= 0) value = exact;
    const swap = rng.chance(0.4);
    const rel = qcCompare(exact, value);
    const answer = swap ? swapQC(rel) : rel;
    const traps: QCQuestion['traps'] = trapId && rel !== 'C' ? { C: trapId } : undefined;
    const qa = C.qa(t);
    const qb = `$${num(value)}$`;
    const conv =
      C.tUnit === 'hour'
        ? `One hour is $60 \\times 60 = 3{,}600$ seconds${t > 1 ? `, so ${t} hours are $${num(3600 * t)}$ seconds` : ''}`
        : `One day is $24 \\times 60 = 1{,}440$ minutes${t > 1 ? `, so ${t} days are $${num(1440 * t)}$ minutes` : ''}`;
    return {
      params: { ctx: ctxIdx, a, b, t, value, swap },
      q: {
        format: 'qc',
        info: C.info(a, b, t),
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        traps,
        explanation: `${conv}. The rate is $\\frac{${a}}{${b}}$ per ${C.bUnit}, so the total is $${num(span * t)} \\times \\frac{${a}}{${b}} = ${num(exact)}$.

Compare $${num(exact)}$ with $${num(value)}$.${trapId === 'num-time-conversion' ? ` ($${num(value)}$ is what you get by using 60 instead of ${C.tUnit === 'hour' ? '3,600' : '1,440'}.)` : trapId ? ` ($${num(value)}$ comes from turning the rate upside down.)` : ''} ${qcEnd(answer)}`,
      },
    };
  },
  check(q, { ctx, a, b, t, value, swap, unknown }) {
    // Simulate: count batches of `a` produced every `b` time units.
    const span = UC_CTX[ctx].tUnit === 'hour' ? 3600 : 1440;
    const samples: [number, number][] = [];
    for (const hh of unknown ? [1, 2, 3, 4, 5, 6, 8, 12] : [t]) {
      let made = 0;
      for (let clock = b; clock <= span * hh; clock += b) made += a;
      samples.push(swap ? [value, made] : [made, value]);
    }
    return expectQC(q, qcFromSamples(samples));
  },
};

/* ================================================================== 2. Total and unit rate: how many units (MCS) */

interface URParams {
  rate: Frac;
  fee: Frac;
  total: Frac;
  values: Frac[];
}

const UR_CTX = [
  {
    text: (r: string, T: string, fee: string) =>
      `A sponsor agreed to donate ${r} for each lap that Maya swam in a fundraiser${fee ? `, plus a one-time gift of ${fee}` : ''}. The sponsor donated a total of ${T}. How many laps did Maya swim?`,
    unit: 'laps',
  },
  {
    text: (r: string, T: string, fee: string) => `A copy shop charges ${r} per page${fee ? ` plus a service fee of ${fee} per order` : ''}. Jamal paid ${T} for one order of copies. How many pages did he copy?`,
    unit: 'pages',
  },
  {
    text: (r: string, T: string, fee: string) =>
      `A bike-share service charges ${r} per minute of riding${fee ? ` plus an unlock fee of ${fee}` : ''}. A rider paid ${T} for one ride. For how many minutes did the rider ride?`,
    unit: 'minutes',
  },
];

const RATES = [0.05, 0.08, 0.15, 0.25, 0.35, 0.4, 0.45, 0.6, 0.65, 1.25].map(fd);

const unitRateMCS: Template<URParams> = {
  id: 'arith.rates.unit-rate-mcs',
  skill: 'arith.rates',
  format: 'mcs',
  style: 'total ÷ rate per unit (with or without a fixed fee)',
  generate(rng, d) {
    const ctx = rng.pick(UR_CTX);
    const rate = rng.pick(RATES);
    const n = rng.int(d === 1 ? 12 : 20, d === 1 ? 60 : 150);
    const fee = d === 3 ? fd(rng.pick([1, 1.5, 2, 2.5, 3, 5])) : F(0);
    const total = rate.mul(n).add(fee);
    const cents = (x: Frac) => !x.isInt();
    const m = (x: Frac) => (cents(x) ? usd(x.toNumber(), 2) : usd(x.toNumber()));
    const traps: { value: Frac; trap: string }[] = [
      { value: total.mul(rate), trap: 'num-inverted-rate' },
      { value: total.sub(rate), trap: 'num-subtract-for-divide' },
      { value: F(n).mul(10), trap: 'num-decimal-shift' },
      { value: F(n, 10), trap: 'num-decimal-shift' },
    ];
    if (fee.sign() > 0) traps.push({ value: total.div(rate), trap: 'num-fixed-fee-ignored' });
    const fmt = (v: Frac) => `$${v.isTerminating() ? decimal(v) : decimal(F(Math.round(v.toNumber() * 100), 100))}$`;
    const { choices, answer, values } = numChoices(rng, {
      correct: F(n),
      traps: traps.filter((t) => t.value.isTerminating() && (t.value.toDecimalString().split('.')[1] ?? '').length <= 3),
      fillers: (() => {
        const pool = [...[2, 4, 5, 10, 12].flatMap((k) => [F(n + k), F(n - k)]), F(n * 2), ...(n % 2 === 0 ? [F(n / 2)] : [])].filter((x) => x.sign() > 0);
        return spreadFillers(
          rng,
          F(n),
          traps.map((t) => t.value),
          pool.filter((x) => x.lt(n)),
          pool.filter((x) => x.gt(n)),
        );
      })(),
      format: fmt,
      order: 'shuffled',
    });
    const shownV = (v: Frac) => !v.eq(n) && values.some((x) => x.eq(v));
    return {
      params: { rate, fee, total, values },
      q: {
        format: 'mcs',
        stem: ctx.text(m(rate), m(total), fee.sign() > 0 ? m(fee) : ''),
        choices,
        answer,
        explanation: `${
          fee.sign() > 0 ? `First remove the fixed amount: ${m(total)} − ${m(fee)} = ${m(total.sub(fee))}. ` : ''
        }Each ${ctx.unit.replace(/s$/, '')} adds ${m(rate)}, so the number of ${ctx.unit} is $${decimal(total.sub(fee))} \\div ${decimal(rate)} = ${n}$. (Check: $${n} \\times ${decimal(rate)} = ${decimal(rate.mul(n))}$.)

Trap: ${[
          shownV(total.mul(rate)) ? `multiplying ${m(total)} by ${m(rate)} instead of dividing (the units must cancel: dollars ÷ dollars per ${ctx.unit.replace(/s$/, '')} = ${ctx.unit})` : '',
          shownV(total.sub(rate)) ? `subtracting the rate from the total` : '',
          fee.sign() > 0 && shownV(total.div(rate)) ? 'forgetting to take out the fixed fee first gives too many' : '',
          shownV(F(n).mul(10)) || shownV(F(n, 10)) ? 'a decimal point put in the wrong place when dividing by a rate such as ' + m(rate) : '',
        ]
          .filter(Boolean)
          .slice(0, 2)
          .join('; ')}.`,
      },
    };
  },
  check(q, { rate, fee, total, values }) {
    // Work forward from each choice: cost = units * rate + fee.
    const hits = values.flatMap((v, i) => (v.isInt() && v.mul(rate).add(fee).eq(total) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 3. Approximate cost from chained rates (MCS) */

type ACMode = 'fuel' | 'round-trip' | 'heater';

interface ACParams {
  mode: ACMode;
  x: number[];
  values: number[];
}

const approxCostMCS: Template<ACParams> = {
  id: 'arith.rates.approx-cost-mcs',
  skill: 'arith.rates',
  format: 'mcs',
  style: 'estimate a cost from two rates',
  generate(rng, d) {
    const mode: ACMode = d === 1 ? 'fuel' : d === 2 ? rng.pick(['fuel', 'round-trip'] as const) : rng.pick(['round-trip', 'heater'] as const);
    for (;;) {
      let x: number[];
      let exact: number;
      let stem: string;
      let expl: string;
      let unitLine: string;
      // Wrong values, each from a real slip.
      let slips: { v: number; trap: string; say: string }[];
      if (mode === 'heater') {
        const kw = rng.pick([0.8, 1.2, 1.5, 2]);
        const hours = rng.int(3, 9);
        const days = rng.pick([28, 30, 31]);
        const price = rng.pick([0.11, 0.13, 0.14, 0.17, 0.19]);
        x = [kw, hours, days, price];
        const energy = kw * hours * days;
        exact = energy * price;
        stem = `A space heater uses ${kw} kilowatts of power while it is running. It runs ${hours} hours a day for ${days} days, and electricity costs ${usd(price, 2)} per kilowatt-hour. Approximately what is the cost of the electricity the heater uses in those ${days} days?`;
        expl = `Energy used: $${kw} \\times ${hours} \\times ${days} = ${decimal(energy)}$ kilowatt-hours. Cost: $${decimal(energy)} \\times ${price} \\approx ${exact.toFixed(2)}$ dollars.`;
        unitLine = 'Check the units: kilowatts × hours = kilowatt-hours, and kilowatt-hours × (dollars per kilowatt-hour) = dollars.';
        slips = [
          { v: energy, trap: 'num-unit-forgotten', say: 'stopping at the energy in kilowatt-hours' },
          { v: kw * hours * price, trap: 'num-factor-forgotten', say: 'using the cost of one day only' },
          { v: energy / price, trap: 'num-inverted-rate', say: 'dividing by the price instead of multiplying' },
          { v: exact * 10, trap: 'num-decimal-shift', say: 'a decimal point put one place too far right' },
          { v: exact / 10, trap: 'num-decimal-shift', say: 'a decimal point put one place too far left' },
        ];
      } else {
        const miles = rng.int(d === 1 ? 120 : 150, d === 1 ? 480 : 620);
        const mpg = rng.int(18, 42);
        const price = rng.pick([2.89, 3.15, 3.49, 3.79, 3.95, 4.19, 4.59]);
        const trips = mode === 'round-trip' ? 2 : 1;
        x = [miles, mpg, price, trips];
        const gallons = (miles * trips) / mpg;
        exact = gallons * price;
        stem =
          mode === 'fuel'
            ? `On a trip of ${plain(miles)} miles, Dana's car averaged ${mpg} miles per gallon of gasoline. If the gasoline cost ${usd(price, 2)} per gallon, approximately what was the cost of the gasoline Dana's car used on the trip?`
            : `Dana drove from her home to a city ${miles} miles away and then drove back home along the same route. Her car averaged ${mpg} miles per gallon of gasoline, and the gasoline cost ${usd(price, 2)} per gallon. Approximately what was the cost of the gasoline used for the whole trip?`;
        expl = `${trips === 2 ? `The whole trip is $2 \\times ${miles} = ${num(miles * 2)}$ miles. ` : ''}Gallons used: $\\frac{${num(miles * trips)}}{${mpg}} \\approx ${gallons.toFixed(1)}$. Cost: $${gallons.toFixed(1)} \\times ${price} \\approx ${exact.toFixed(2)}$ dollars.`;
        unitLine = 'Check the units: (miles) ÷ (miles per gallon) = gallons, and (gallons) × (dollars per gallon) = dollars.';
        slips = [
          { v: gallons, trap: 'num-unit-forgotten', say: 'stopping at the gallons' },
          { v: miles * trips * price, trap: 'num-unit-forgotten', say: 'multiplying the miles by the price and skipping the mileage' },
          { v: gallons / price, trap: 'num-inverted-rate', say: 'dividing by the price instead of multiplying' },
          { v: exact * 10, trap: 'num-decimal-shift', say: 'a decimal point put one place too far right' },
          { v: exact / 10, trap: 'num-decimal-shift', say: 'a decimal point put one place too far left' },
          ...(trips === 2 ? [{ v: exact / 2, trap: 'num-one-way', say: 'counting only one way of the round trip' }] : []),
        ];
      }
      // choices are multiples of a round step; the wrong ones are the slips rounded to the same step
      const steps = [5, 10, 20, 25, 50, 100].filter((s) => s >= exact * 0.15 && s <= exact * 0.5 && Math.abs(exact - Math.round(exact / s) * s) <= 0.3 * s);
      if (!steps.length) continue;
      const step = rng.pick(steps);
      const nearest = Math.round(exact / step) * step;
      const wrong: { v: number; trap: string; say: string }[] = [];
      for (const s of rng.shuffle(slips)) {
        const r = Math.round(s.v / step) * step;
        if (r < step || r === nearest || wrong.some((w) => w.v === r)) continue;
        wrong.push({ ...s, v: r });
      }
      if (wrong.length < 4) continue;
      const picked = valuedChoices(
        rng,
        { text: usd(nearest), value: nearest },
        wrong.map((w) => ({ text: usd(w.v), value: w.v, trap: w.trap })),
      );
      const shownSay = wrong.filter((w) => picked.choices.some((c) => c.text === usd(w.v))).slice(0, 2);
      // The slips fall mostly on one side of the answer: shuffle so that the answer is not always in the middle.
      const choices = rng.shuffle(picked.choices);
      const answer = choices.findIndex((c) => c.text === usd(nearest));
      return {
        params: { mode, x, values: choices.map((c) => Number(c.text.replace(/[^0-9.]/g, ''))) },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `Multiply and divide step by step, then pick the closest choice. ${expl} The closest choice is ${usd(nearest)}.

${unitLine}

Trap: ${shownSay.map((w) => `${usd(w.v)} comes from ${w.say}`).join('; ')}.`,
        },
      };
    }
  },
  check(q, { mode, x, values }) {
    const exact = mode === 'heater' ? x[0] * x[1] * x[2] * x[3] : (x[2] * (x[0] * x[3])) / x[1];
    const dist = values.map((v) => Math.abs(v - exact));
    const best = Math.min(...dist);
    const hits = dist.flatMap((v, i) => (close(v, best) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 4. Which rates are equal (MCM) */

interface RateUnit {
  name: string;
  /** TeX of the conversion factor as a student would write it */
  ftex: string;
  /** value in this unit = base value * factor */
  factor: Frac;
  /** factor a student gets with a common slip */
  slips: { factor: Frac; trap: string }[];
}

interface Family {
  base: string;
  values: number[];
  units: RateUnit[];
}

const FAMILIES: Family[] = [
  {
    base: 'kilometers per hour',
    values: [36, 54, 72, 90, 108, 144, 180],
    units: [
      { name: 'meters per second', ftex: '\\frac{1{,}000}{3{,}600}', factor: F(1000, 3600), slips: [{ factor: F(1000, 60), trap: 'num-time-conversion' }, { factor: F(3600, 1000), trap: 'num-inverted-conversion' }] },
      { name: 'meters per minute', ftex: '\\frac{1{,}000}{60}', factor: F(1000, 60), slips: [{ factor: F(100, 60), trap: 'num-decimal-shift' }, { factor: F(60000), trap: 'num-inverted-conversion' }] },
      { name: 'kilometers per minute', ftex: '\\frac{1}{60}', factor: F(1, 60), slips: [{ factor: F(60), trap: 'num-inverted-conversion' }, { factor: F(1, 6), trap: 'num-decimal-shift' }] },
    ],
  },
  {
    base: 'liters per minute',
    values: [3, 6, 9, 12, 18, 24, 30],
    units: [
      { name: 'milliliters per second', ftex: '\\frac{1{,}000}{60}', factor: F(1000, 60), slips: [{ factor: F(60, 1000), trap: 'num-inverted-conversion' }, { factor: F(100, 60), trap: 'num-decimal-shift' }] },
      { name: 'liters per hour', ftex: '60', factor: F(60), slips: [{ factor: F(1, 60), trap: 'num-inverted-conversion' }, { factor: F(3600), trap: 'num-time-conversion' }] },
      { name: 'milliliters per minute', ftex: '1{,}000', factor: F(1000), slips: [{ factor: F(100), trap: 'num-decimal-shift' }, { factor: F(1, 1000), trap: 'num-inverted-conversion' }] },
    ],
  },
  {
    base: 'dollars per hour',
    values: [18, 24, 30, 36, 45, 54, 60, 72],
    units: [
      { name: 'cents per minute', ftex: '\\frac{100}{60}', factor: F(100, 60), slips: [{ factor: F(1, 60), trap: 'num-decimal-shift' }, { factor: F(6000), trap: 'num-inverted-conversion' }] },
      { name: 'dollars per minute', ftex: '\\frac{1}{60}', factor: F(1, 60), slips: [{ factor: F(60), trap: 'num-inverted-conversion' }, { factor: F(1, 3600), trap: 'num-time-conversion' }] },
      { name: 'dollars per 8-hour day', ftex: '8', factor: F(8), slips: [{ factor: F(1, 8), trap: 'num-inverted-conversion' }, { factor: F(24), trap: 'num-time-conversion' }] },
    ],
  },
];

interface ERParams {
  fam: number;
  v: number;
  items: { unit: number; value: Frac }[];
}

function rateNum(x: Frac): string | null {
  if (!x.isTerminating()) return null;
  const s = x.toDecimalString();
  if ((s.split('.')[1] ?? '').length > 3 || x.gt(100000)) return null;
  return x.isInt() ? plain(x.toNumber()) : s;
}

const equivalentRates: Template<ERParams> = {
  id: 'arith.rates.equivalent-rates-mcm',
  skill: 'arith.rates',
  format: 'mcm',
  style: 'which rates in other units are equal',
  generate(rng, d) {
    for (;;) {
      const famIdx = rng.int(0, FAMILIES.length - 1);
      const fam = FAMILIES[famIdx];
      const v = rng.pick(fam.values);
      const n = d === 1 ? 3 : d === 2 ? 4 : 5;
      // candidates: each unit gives one true value and its slips
      const cands: { unit: number; value: Frac; ok: boolean; trap?: string }[] = [];
      fam.units.forEach((u, i) => {
        cands.push({ unit: i, value: u.factor.mul(v), ok: true });
        for (const s of u.slips) cands.push({ unit: i, value: s.factor.mul(v), ok: false, trap: s.trap });
      });
      const usable = cands.filter((c) => rateNum(c.value) !== null && !(c.ok === false && c.value.eq(fam.units[c.unit].factor.mul(v))));
      const trues = usable.filter((c) => c.ok);
      const falses = usable.filter((c) => !c.ok);
      if (!trues.length || falses.length < 2) continue;
      const nTrue = rng.int(1, Math.min(trues.length, n - 1));
      if (n - nTrue > falses.length) continue;
      const picked = rng.shuffle([...rng.sample(trues, nTrue), ...rng.sample(falses, n - nTrue)]);
      const unitName = (c: { unit: number; value: Frac }) => (c.value.eq(1) ? fam.units[c.unit].name.replace(/^(\w+?)s /, '$1 ') : fam.units[c.unit].name);
      const texts = picked.map((c) => `${rateNum(c.value)} ${unitName(c)}`);
      if (new Set(texts).size < texts.length) continue;
      const { choices, answer } = flaggedChoices(picked.map((c, i) => ({ text: texts[i], correct: c.ok, ...(c.trap ? { trap: c.trap } : {}) })));
      const lines = fam.units
        .filter((_, i) => picked.some((c) => c.unit === i))
        .map((u) => `- ${u.name}: $${v} \\times ${u.ftex} = ${dec(u.factor.mul(v))}$`);
      return {
        params: { fam: famIdx, v, items: picked.map((c) => ({ unit: c.unit, value: c.value })) },
        q: {
          format: 'mcm',
          stem: `Which of the following rates are equal to ${v} ${fam.base}?`,
          instruction: 'Indicate all such rates.',
          choices,
          answer,
          explanation: `Convert ${v} ${fam.base} into each unit, writing the conversion as a fraction that cancels the old unit (1 hour = 60 minutes = 3,600 seconds, 1 kilometer = 1,000 meters, 1 liter = 1,000 milliliters, 1 dollar = 100 cents):
${lines.join('\n')}

Per a shorter time the number gets smaller (per hour → per minute: divide by 60), and in a smaller unit of amount it gets larger (kilometers → meters: multiply by 1,000). Using the factor the wrong way round gives the trap values.`,
        },
      };
    }
  },
  check(q, { fam, v, items }) {
    // Convert each choice back to the base unit with the inverse factor.
    const F0 = FAMILIES[fam];
    const back = (unit: number, value: Frac) => {
      const name = F0.units[unit].name;
      let x = value.toNumber();
      if (name.includes('meters') && !name.includes('kilometers')) x /= 1000; // to km
      if (name.includes('milliliters')) x /= 1000;
      if (name.includes('cents')) x /= 100;
      if (name.endsWith('per second')) x *= 3600 / (F0.base.endsWith('per minute') ? 60 : 1);
      else if (name.endsWith('per minute')) x *= F0.base.endsWith('per minute') ? 1 : 60;
      else if (name.endsWith('per hour')) x /= F0.base.endsWith('per minute') ? 60 : 1;
      else if (name.endsWith('8-hour day')) x /= 8;
      return x;
    };
    const expected = items.flatMap((it, i) => (close(back(it.unit, it.value), v) ? [i] : []));
    return expectMCM(q, expected);
  },
};

/* ================================================================== 5. Compound unit conversion (NE) */

type CUMode = 'mph-fps' | 'fps-mph' | 'cents-oz' | 'ml-day' | 'kmh-ms' | 'dollars-cents';

interface CUParams {
  mode: CUMode;
  v: number;
}

// Each level has its own values and its own people or objects, so the same wording never appears at two levels.
const CU_WHO: Record<string, string[][]> = {
  'mph-fps': [
    ['A car travels', 'A bus travels', 'A boat travels', 'A truck travels'],
    ['A train travels', 'A race car travels', 'A motorboat travels', 'A helicopter flies'],
    ['A plane taxis', 'A car travels', 'A train moves', 'A boat travels'],
  ],
  'fps-mph': [[], [], ['A plane taxis', 'A car travels', 'A train moves', 'A boat travels', 'A bus travels', 'A truck travels']],
  'kmh-ms': [['A cyclist travels', 'A scooter travels', 'A bus travels', 'A drone flies'], [], []],
  'ml-day': [
    [],
    ['A leaking faucet loses', 'A dripping pipe loses', 'A slow leak loses', 'A garden hose seeps'],
    ['A radiator loses', 'A cooling system leaks', 'A fountain loses', 'A tank leaks'],
  ],
  'dollars-cents': [
    [],
    ['A babysitter earns', 'A tutor earns', 'A barista earns', 'A driver earns'],
    ['A consultant bills', 'A contractor charges', 'A lawyer bills', 'An engineer bills'],
  ],
  'cents-oz': [['nuts', 'rice', 'coffee beans', 'dried fruit', 'almonds', 'cheese'], [], []],
};

const compoundNE: Template<CUParams> = {
  id: 'arith.rates.compound-ne',
  skill: 'arith.rates',
  format: 'ne',
  style: 'convert a rate between compound units',
  generate(rng, d) {
    const mode: CUMode =
      d === 1 ? rng.pick(['cents-oz', 'kmh-ms', 'mph-fps'] as const) : d === 2 ? rng.pick(['mph-fps', 'ml-day', 'dollars-cents'] as const) : rng.pick(['fps-mph', 'ml-day', 'dollars-cents'] as const);
    const who = rng.pick(CU_WHO[mode][d - 1]);
    if (mode === 'mph-fps' || mode === 'fps-mph') {
      const k = mode === 'fps-mph' ? rng.int(1, 8) : d === 1 ? rng.int(1, 4) : rng.int(5, 8);
      const mph = 15 * k;
      const fps = 22 * k;
      const v = mode === 'mph-fps' ? mph : fps;
      const ans = mode === 'mph-fps' ? F(fps) : F(mph);
      const wrong60 = mode === 'mph-fps' ? F(mph * 5280, 60) : F(fps * 60, 5280);
      const inverted = mode === 'mph-fps' ? F(mph * 3600, 5280) : F(fps * 5280, 3600);
      return {
        params: { mode, v },
        q: {
          format: 'ne',
          stem:
            mode === 'mph-fps'
              ? `${who} at a constant speed of ${mph} miles per hour. What is this speed in feet per second? (1 mile = 5,280 feet)`
              : `${who} at a constant speed of ${fps} feet per second. What is this speed in miles per hour? (1 mile = 5,280 feet)`,
          answer: ans,
          suffix: mode === 'mph-fps' ? 'feet per second' : 'miles per hour',
          traps: [
            { value: wrong60, trap: 'num-time-conversion' },
            { value: inverted, trap: 'num-inverted-conversion' },
          ].filter((t) => t.value.isTerminating() && !t.value.eq(ans)),
          explanation:
            mode === 'mph-fps'
              ? `Write the conversion as fractions that cancel the old units. $${mph}\\,\\frac{\\text{mi}}{\\text{h}} \\times \\frac{5{,}280\\text{ ft}}{1\\text{ mi}} \\times \\frac{1\\text{ h}}{3{,}600\\text{ s}} = \\frac{${num(mph * 5280)}}{3{,}600} = ${num(fps)}$ feet per second.

Check: ${fps} feet in each of 3,600 seconds is ${plain(fps * 3600)} feet in an hour, and $${num(fps * 3600)} \\div 5{,}280 = ${mph}$ miles.

Trap: an hour has 3,600 seconds, not 60 (${plainNum(wrong60)} comes from dividing by 60), and the factor for miles goes on top so that miles cancel.`
              : `Write the conversion as fractions that cancel the old units. $${fps}\\,\\frac{\\text{ft}}{\\text{s}} \\times \\frac{3{,}600\\text{ s}}{1\\text{ h}} \\times \\frac{1\\text{ mi}}{5{,}280\\text{ ft}} = \\frac{${num(fps * 3600)}}{5{,}280} = ${num(mph)}$ miles per hour.

Check: ${mph} miles in an hour is ${plain(mph * 5280)} feet, and $${num(mph * 5280)} \\div 3{,}600 = ${fps}$ feet per second.

Trap: an hour has 3,600 seconds, not 60 (${plainNum(wrong60)} comes from multiplying by 60), and the factor for feet goes on the bottom so that feet cancel.`,
        },
      };
    }
    if (mode === 'kmh-ms') {
      const v = 18 * rng.int(1, 8);
      const ans = F(v * 1000, 3600);
      return {
        params: { mode, v },
        q: {
          format: 'ne',
          stem: `${who} at a constant speed of ${v} kilometers per hour. What is this speed in meters per second? (1 kilometer = 1,000 meters)`,
          answer: ans,
          suffix: 'meters per second',
          traps: [
            { value: F(v * 1000, 60), trap: 'num-time-conversion' },
            { value: F(v * 36, 10), trap: 'num-inverted-conversion' },
            { value: F(v, 3600), trap: 'num-decimal-shift' },
          ].filter((t) => t.value.isTerminating() && !t.value.eq(ans)),
          explanation: `$${v}\\,\\frac{\\text{km}}{\\text{h}} \\times \\frac{1{,}000\\text{ m}}{1\\text{ km}} \\times \\frac{1\\text{ h}}{3{,}600\\text{ s}} = \\frac{${num(v * 1000)}}{3{,}600} = ${dec(ans)}$ meters per second.

Check: ${plainNum(ans)} meters per second for 3,600 seconds is ${plain(ans.toNumber() * 3600)} meters, which is ${v} kilometers.

Trap: an hour has 3,600 seconds, not 60, and metres per second is a smaller number than kilometres per hour (divide by 3.6, do not multiply).`,
        },
      };
    }
    if (mode === 'dollars-cents') {
      const v = d === 2 ? 3 * rng.int(3, 20) : 6 * rng.int(2, 20);
      const ans = F(v * 100, 60);
      return {
        params: { mode, v },
        q: {
          format: 'ne',
          stem: `${who} ${v} dollars per hour. How many cents is this per minute? (1 dollar = 100 cents)`,
          answer: ans,
          suffix: 'cents per minute',
          traps: [
            { value: F(v, 60), trap: 'num-decimal-shift' },
            { value: F(v * 100, 3600), trap: 'num-time-conversion' },
            { value: F(v * 6000), trap: 'num-inverted-conversion' },
          ].filter((t) => t.value.isTerminating() && !t.value.eq(ans)),
          explanation: `$${v}\\,\\frac{\\text{dollars}}{\\text{h}} \\times \\frac{100\\text{ cents}}{1\\text{ dollar}} \\times \\frac{1\\text{ h}}{60\\text{ min}} = \\frac{${num(v * 100)}}{60} = ${dec(ans)}$ cents per minute.

Check: ${plainNum(ans)} cents per minute for 60 minutes is ${plain(ans.toNumber() * 60)} cents, which is ${v} dollars.

Trap: ${plainNum(F(v, 60))} is the number of dollars per minute, not cents; and an hour has 60 minutes, not 3,600.`,
        },
      };
    }
    if (mode === 'cents-oz') {
      const c = 5 * rng.int(1, 19);
      const good = who;
      const ans = F(c * 16, 100);
      return {
        params: { mode, v: c },
        q: {
          format: 'ne',
          stem: `A store sells ${good} in bulk for ${c} cents per ounce. What is the price in dollars per pound? (1 pound = 16 ounces)`,
          answer: ans,
          prefix: '\\$',
          suffix: 'per pound',
          traps: [
            { value: F(c * 16), trap: 'num-decimal-shift' },
            { value: F(c, 16 * 100), trap: 'num-inverted-conversion' },
          ].filter((t) => t.value.isTerminating() && !t.value.eq(ans)),
          explanation: `$${c}\\,\\frac{\\text{cents}}{\\text{oz}} \\times \\frac{16\\text{ oz}}{1\\text{ lb}} = ${num(c * 16)}$ cents per pound, and ${plain(c * 16)} cents is ${usd((c * 16) / 100, 2)}.

Check: 100 cents make a dollar, so ${plain(c * 16)} cents is $${plain(c * 16)} \\div 100 = ${dec(ans)}$ dollars.

Trap: ${plain(c * 16)} is the price in cents; the answer must be in dollars.`,
        },
      };
    }
    // milliliters per minute -> liters per day
    const ml = rng.pick(d === 2 ? [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125] : [35, 45, 65, 80, 90, 110, 150, 175, 225, 300, 350, 400]);
    const ans = F(ml * 1440, 1000);
    return {
      params: { mode, v: ml },
      q: {
        format: 'ne',
        stem: `${who} water at a constant rate of ${ml} milliliters per minute. At this rate, how many liters is that in one day? (1 liter = 1,000 milliliters)`,
        answer: ans,
        suffix: 'liters',
        traps: [
          { value: F(ml * 60, 1000), trap: 'num-time-conversion' },
          { value: F(ml * 1440), trap: 'num-decimal-shift' },
        ].filter((t) => !t.value.eq(ans)),
        explanation: `One day has $24 \\times 60 = 1{,}440$ minutes. $${ml} \\times 1{,}440 = ${num(ml * 1440)}$ milliliters, which is $${num(ml * 1440)} \\div 1{,}000 = ${dec(ans)}$ liters.

Check: ${plainNum(ans)} liters is ${plain(ml * 1440)} milliliters, and $${num(ml * 1440)} \\div 1{,}440 = ${ml}$ per minute.

Trap: using 60 minutes (one hour) instead of 1,440 gives the loss in one hour; ${plain(ml * 1440)} is the answer in milliliters, not liters.`,
      },
    };
  },
  check(q, { mode, v }) {
    // Recompute through a different route (base units step by step).
    let x: number;
    if (mode === 'mph-fps') {
      const feetPerHour = v * 5280;
      x = feetPerHour / 60 / 60;
    } else if (mode === 'fps-mph') {
      const milesPerSecond = v / 5280;
      x = milesPerSecond * 60 * 60;
    } else if (mode === 'cents-oz') {
      const dollarsPerOunce = v / 100;
      x = dollarsPerOunce * 16;
    } else if (mode === 'kmh-ms') {
      const kmPerSecond = v / 3600;
      x = kmPerSecond * 1000;
    } else if (mode === 'dollars-cents') {
      const dollarsPerMinute = v / 60;
      x = dollarsPerMinute * 100;
    } else {
      const litersPerMinute = v / 1000;
      x = litersPerMinute * 60 * 24;
    }
    return expectNE(q, x, 1e-9);
  },
};

export const rateTemplates = [unitConvertQC, unitRateMCS, approxCostMCS, equivalentRates, compoundNE];

