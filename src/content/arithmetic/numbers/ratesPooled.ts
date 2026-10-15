import { Frac } from '../../../engine/frac';
import { decimal, plain, usd } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { decOrFrac, expectNE, F } from './util';

export const ratePooledTraps: Record<string, Trap> = {
  'rate-mean-of-rates': {
    label: 'Averaged the rates instead of dividing total by total',
    fix: 'An average rate is the total amount divided by the total base (dollars over pounds, miles over hours, pages over minutes). The plain mean of the rates ignores how much of each there was.',
  },
  'rate-stop-ignored': {
    label: 'Left the idle time out of the total time',
    fix: 'Average speed (or output) over the whole period counts the stops too: the idle minutes are part of the total time in the denominator.',
  },
  'rate-stop-units': {
    label: 'Added minutes to hours without converting',
    fix: 'Convert before adding: 30 minutes is $\\frac{1}{2}$ hour, so a stop adds $\\frac{\\text{minutes}}{60}$ to a time measured in hours.',
  },
  'rate-total-over-count': {
    label: 'Divided the total by the number of parts instead of by the total base',
    fix: 'Divide by the total amount of the base (pounds, hours, minutes), not by the number of items or legs.',
  },
};

type Mode = 'price' | 'speed' | 'mpg' | 'pages';

interface PRParams {
  mode: Mode;
  /** amount of each part: pounds, miles, miles, minutes */
  q: number[];
  /** rate of each part: cents per pound, mph, mpg, pages per minute */
  r: number[];
  /** idle minutes */
  extra: number;
}

const ITEMS = [
  ['almonds', 'cashews'],
  ['coffee beans', 'cocoa beans'],
  ['basmati rice', 'jasmine rice'],
];
const ordinalWord = ['first', 'second', 'third'];

const term = (mode: Mode, a: number, r: number, i: number, items: string[]): string => {
  if (mode === 'price') return `${a} pounds of ${items[i]} at ${usd(r / 100, 2)} per pound`;
  if (mode === 'speed') return `${a} miles at ${r} miles per hour`;
  if (mode === 'mpg') return `${a} miles ${['on a highway', 'in the city', 'on a mountain road'][i]} at ${r} miles per gallon`;
  return `${a} minutes at ${r} pages per minute`;
};

const dv = (f: Frac) => decOrFrac(f);
const tv = (f: Frac) => (f.isInt() ? plain(f.toNumber()) : `$${decOrFrac(f)}$`);

const pooled: Template<PRParams> = {
  id: 'arith.rates.pooled-rate-ne',
  skill: 'arith.rates',
  format: 'ne',
  style: 'average rate over several parts, total over total',
  generate(rng, d) {
    const mode =
      d === 1 ? rng.pick(['price', 'speed'] as const) : d === 2 ? rng.pick(['speed', 'mpg', 'price'] as const) : rng.pick(['speed', 'pages', 'mpg'] as const);
    const items = rng.pick(ITEMS);
    for (;;) {
      const n = d === 3 ? 3 : 2;
      let q: number[];
      let r: number[];
      let extra = 0;
      if (mode === 'price') {
        q = Array.from({ length: n }, () => rng.int(2, 12));
        r = Array.from({ length: n }, () => rng.int(2, 7) * 25 + rng.pick([0, 100, 200, 300]));
      } else if (mode === 'speed') {
        r = Array.from({ length: n }, () => rng.int(3, 10) * 10);
        q = r.map((v) => (v * rng.int(2, 7)) / 2);
        extra = d >= 2 ? rng.pick([15, 20, 30, 45]) : 0;
      } else if (mode === 'mpg') {
        r = Array.from({ length: n }, () => rng.int(4, 16) * 2);
        q = r.map((g) => g * rng.int(2, 9));
      } else {
        r = Array.from({ length: n }, () => rng.int(2, 9) * 5);
        q = Array.from({ length: n }, () => rng.int(2, 12) * 5);
        extra = rng.pick([5, 10, 15, 20, 25]);
      }
      if (new Set(r).size < n) continue;
      // total over total
      let num_ = F(0);
      let den = F(0);
      for (let i = 0; i < n; i++) {
        if (mode === 'price') {
          num_ = num_.add(F(q[i] * r[i], 100));
          den = den.add(q[i]);
        } else if (mode === 'speed') {
          num_ = num_.add(q[i]);
          den = den.add(F(q[i], r[i]));
        } else if (mode === 'mpg') {
          num_ = num_.add(q[i]);
          den = den.add(F(q[i], r[i]));
        } else {
          num_ = num_.add(q[i] * r[i]);
          den = den.add(q[i]);
        }
      }
      const idle = mode === 'speed' ? F(extra, 60) : F(extra);
      const ans = num_.div(den.add(idle));
      const places = (x: Frac) => (x.isTerminating() ? (x.toDecimalString().split('.')[1] ?? '').length : 99);
      if (!ans.isTerminating() || places(ans) > 2) continue;
      // the plain mean of the rates
      const rateVals = r.map((x) => (mode === 'price' ? F(x, 100) : F(x)));
      const meanRate = rateVals.reduce((a, x) => a.add(x), F(0)).div(n);
      if (meanRate.eq(ans)) continue; // equal weights would hide the plain-mean misconception
      const traps: { value: Frac; trap: string }[] = [{ value: meanRate, trap: 'rate-mean-of-rates' }];
      if (mode === 'speed' && extra) {
        traps.push({ value: num_.div(den), trap: 'rate-stop-ignored' }, { value: num_.div(den.add(extra)), trap: 'rate-stop-units' });
      } else if (mode === 'pages') {
        traps.push({ value: num_.div(den), trap: 'rate-stop-ignored' }, { value: num_.div(n), trap: 'rate-total-over-count' });
      } else if (mode === 'price') {
        traps.push({ value: num_.div(n), trap: 'rate-total-over-count' });
      }
      const kept = traps.filter((t) => t.value.isTerminating() && places(t.value) <= 3 && !t.value.eq(ans));
      if (!kept.length) continue;
      if (kept.length < traps.length - 1) continue;
      const parts = q.map((a, i) => term(mode, a, r[i], i, items));
      const list = parts.length === 2 ? `${parts[0]}, then ${parts[1]}` : `${parts[0]}, then ${parts[1]}, then ${parts[2]}`;
      const stem =
        mode === 'price'
          ? `A shopper buys ${parts[0]} and ${parts[1]}. What is the average price, in dollars, of one pound of the ${items[0]} and ${items[1]} together?`
          : mode === 'speed'
            ? `A driver travels ${list}${extra ? `, and rests for ${extra} minutes between the first two legs` : ''}. What is the driver's average speed for the whole trip${extra ? ', rest included' : ''}, in miles per hour?`
            : mode === 'mpg'
              ? `A truck drives ${list}. What is its average fuel economy for the whole trip, in miles per gallon?`
              : `A printer prints ${parts[0]}${n === 3 ? `, then ${parts[1]}` : ''}, jams and prints nothing for ${extra} minutes, and then prints ${parts[n - 1]}. What is the average number of pages per minute over the whole period, jam included?`;
      const unit = mode === 'price' ? 'dollars per pound' : mode === 'speed' ? 'miles per hour' : mode === 'mpg' ? 'miles per gallon' : 'pages per minute';
      const totalWord = mode === 'price' ? 'dollars' : mode === 'pages' ? 'pages' : 'miles';
      const baseWord = mode === 'price' ? 'pounds' : mode === 'speed' ? 'hours' : mode === 'mpg' ? 'gallons' : 'minutes';
      const baseParts =
        mode === 'price'
          ? q.map((a) => `${a}`)
          : mode === 'speed'
            ? q.map((a, i) => `\\frac{${a}}{${r[i]}}`)
            : mode === 'mpg'
              ? q.map((a, i) => `\\frac{${a}}{${r[i]}}`)
              : q.map((a) => `${a}`);
      const totalParts =
        mode === 'price' ? q.map((a, i) => `${a}(${decimal(F(r[i], 100))})`) : mode === 'pages' ? q.map((a, i) => `${a}\\cdot${r[i]}`) : q.map((a) => `${a}`);
      const idleTxt = extra ? (mode === 'speed' ? ` + \\frac{${extra}}{60}` : ` + ${extra}`) : '';
      const slips = kept.map((t) => {
        const v = decimal(t.value);
        if (t.trap === 'rate-mean-of-rates') return `$${v}$ is the plain mean of the rates, which ignores how much was done at each rate`;
        if (t.trap === 'rate-stop-ignored') return `$${v}$ leaves the idle time out of the total`;
        if (t.trap === 'rate-stop-units') return `$${v}$ adds ${extra} minutes as if they were ${extra} hours`;
        return `$${v}$ divides by the number of parts instead of the total base`;
      });
      void ordinalWord;
      return {
        params: { mode, q, r, extra },
        q: {
          format: 'ne',
          stem,
          answer: ans,
          suffix: unit,
          traps: kept,
          explanation: `Recognize: an average rate is the total ${totalWord} divided by the total ${baseWord}, not the mean of the rates.

Total ${totalWord}: $${totalParts.join(' + ')} = ${dv(num_)}$. Total ${baseWord}: $${baseParts.join(' + ')}${idleTxt} = ${dv(den.add(idle))}$. The average is $\\frac{${dv(num_)}}{${dv(den.add(idle))}} = ${decimal(ans)}$.

Check: ${tv(ans)} times ${tv(den.add(idle))} ${baseWord} gives back ${tv(num_)} ${totalWord}.

Trap: ${slips.slice(0, 2).join('; ')}. Add up the totals first, then divide once.`,
        },
      };
    }
  },
  check(q, { mode, q: amounts, r, extra }) {
    // Walk through the parts one unit at a time: add what each unit of the base produces, then divide.
    let produced = 0;
    let used = 0;
    if (mode === 'price') {
      for (let i = 0; i < amounts.length; i++)
        for (let k = 0; k < amounts[i]; k++) {
          produced += r[i] / 100;
          used += 1;
        }
    } else if (mode === 'pages') {
      for (let i = 0; i < amounts.length; i++)
        for (let k = 0; k < amounts[i]; k++) {
          produced += r[i];
          used += 1;
        }
      used += extra;
    } else {
      // distance in one-minute steps (speed in mph, fuel use in mpg is distance / gallons)
      for (let i = 0; i < amounts.length; i++) {
        produced += amounts[i];
        used += mode === 'speed' ? amounts[i] / r[i] : amounts[i] / r[i];
      }
      if (mode === 'speed') used += extra / 60;
    }
    return expectNE(q, produced / used, 1e-9);
  },
};

export const ratePooledTemplates: Template<any>[] = [pooled];
