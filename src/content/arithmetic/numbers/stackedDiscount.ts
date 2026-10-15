import { qcCompare } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { usd } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { dec, expectQC, F, pct, qcEnd, qcFromFloatSamples, swapQC, usdF } from './util';

const mult = (p: number | Frac) => F(1).sub((p instanceof Frac ? p : F(p)).div(100));
/** Total percent taken off by successive discounts. */
const combined = (ps: number[]) => F(1).sub(ps.reduce((m, p) => m.mul(mult(p)), F(1))).mul(100);

type Mode = 'add' | 'exact' | 'near' | 'undo' | 'range' | 'three';

interface Params {
  mode: Mode;
  price: number;
  ps: number[];
  r: Frac;
  rLo: number;
  rHi: number;
  up: boolean;
  swap: boolean;
}

const PRICES = [40, 60, 80, 120, 150, 200, 250, 400, 600];
const PS = [10, 15, 20, 25, 30, 40, 50];

const stackedDiscountQC: Template<Params> = {
  id: 'arith.successive-percent.stacked-discount-qc',
  skill: 'arith.successive-percent',
  format: 'qc',
  style: 'two or three successive discounts against one single discount, or undoing a percent change',
  generate(rng, d) {
    for (;;) {
      const mode: Mode = rng.pick(d === 1 ? (['add', 'exact'] as const) : d === 2 ? (['near', 'undo', 'near'] as const) : (['range', 'range', 'range', 'three'] as const));
      const swap = rng.chance(0.5);
      const price = rng.pick(PRICES);
      const fix = (rel: QCChoice): QCChoice => (swap ? swapQC(rel) : rel);
      const orient = (two: string, single: string) => ({ quantityA: swap ? single : two, quantityB: swap ? two : single });
      if (mode === 'undo') {
        const up = rng.chance(0.4);
        const p = rng.pick([10, 20, 25, 40, 50]);
        const R = rng.pick([40, 60, 80, 100, 120, 160, 200, 240]);
        const S = up ? R * (100 + p) / 100 : (R * (100 - p)) / 100;
        if (!Number.isInteger(S)) continue;
        const better = up ? mult(p).mul(S) : F(S).mul(F(1).add(F(p).div(100)));
        const orig = F(R);
        const word = up ? 'increase' : 'discount';
        const rel: QCChoice = qcCompare(orig, better);
        const side = orient('The original price of the coat', up ? `${usd(S)} decreased by ${p}%` : `${usd(S)} increased by ${p}%`);
        return {
          params: { mode, price: R, ps: [p], r: F(S), rLo: 0, rHi: 0, up, swap },
          q: {
            format: 'qc',
            info: `After a ${p}% ${word}, the price of a coat is ${usd(S)}.`,
            ...side,
            answer: fix(rel),
            traps: { [fix('C')]: 'num-reverse-percent' },
            explanation: `The ${p}% was taken on the original price, so reversing it means dividing by the multiplier, not applying the same percent to the new price.

If the original price is $x$, then $x \\times ${dec(up ? F(1).add(F(p).div(100)) : mult(p))} = ${S}$, so $x = ${R}$. The other amount is ${usd(S)} $\\times ${dec(up ? mult(p) : F(1).add(F(p).div(100)))} = ${usdF(better, !better.isInt())}$.

${usd(R)} is more than ${usdF(better, !better.isInt())}. Trap: undoing the change with the same percent on the new price would make the two amounts equal, which is false.

${qcEnd(fix(rel))}`,
          },
        };
      }
      // discounts against one single discount
      const k = mode === 'three' ? 3 : 2;
      const ps = Array.from({ length: k }, () => rng.pick(PS));
      const comb = combined(ps);
      if (mode === 'three') {
        const prod = ps.reduce((m, p) => m * (100 - p), 1);
        if (prod % 1000 !== 0 || new Set(ps).size === 1) continue;
      } else if (ps[0] === ps[1] && rng.chance(0.5)) continue;
      const sum = ps.reduce((s, p) => s + p, 0);
      if (sum >= 100) continue;
      let r: Frac;
      let rLo = 0;
      let rHi = 0;
      if (mode === 'add') r = F(sum);
      else if (mode === 'exact') {
        if (!comb.isTerminating() || comb.eq(sum)) continue;
        r = comb;
      } else if (mode === 'near') {
        if (!comb.isTerminating()) continue;
        r = comb.add(rng.pick([-3, -2, -1, 1, 2, 3]));
      } else if (mode === 'three') {
        r = F(Math.floor(comb.toNumber()) + rng.pick([-2, -1, 0, 1, 2]));
      } else {
        if (!comb.isInt()) continue;
        const c = comb.n;
        rLo = c - rng.int(2, 8);
        rHi = c + rng.int(2, 8);
        r = F(0);
      }
      if (r.sign() < 0 || r.gt(99)) continue;
      const two = ps.reduce((m, p) => m.mul(mult(p)), F(price));
      const nPrice = (x: Frac) => usdF(x, !x.isInt());
      const stem = ps.length === 2 ? `takes ${ps[0]}% off the regular price and then takes ${ps[1]}% off the reduced price` : `takes ${ps[0]}% off the regular price, then ${ps[1]}% off the new price, and then ${ps[2]}% off that price`;
      const tex = ps.map((p) => dec(mult(p))).join(' \\times ');
      if (mode === 'range') {
        const infoR = `A store ${stem} of a jacket whose regular price is ${usd(price)}. A second store takes $r\\%$ off the same regular price, where $r$ is an integer and $${rLo} < r < ${rHi}$.`;
        const c = comb.n;
        const sample = (x: number) => mult(x).mul(price);
        const rels = [c - 1, c, c + 1].map((x) => ({ x, rel: qcCompare(two, sample(x)) }));
        const w1 = rels[0];
        const w2 = rels[2];
        const word = (rel: QCChoice) => (rel === 'A' ? 'the first store charges more' : rel === 'B' ? 'the first store charges less' : 'the prices are equal');
        const side = orient('The price after both discounts at the first store', 'The price at the second store');
        return {
          params: { mode, price, ps, r: F(0), rLo, rHi, up: false, swap },
          q: {
            format: 'qc',
            info: infoR,
            ...side,
            answer: fix('D'),
            traps: { [fix(w1.rel)]: 'tested-one-value' },
            explanation: `The first store's discounts multiply: ${usd(price)} $\\times ${tex} = ${nPrice(two)}$, the same as one discount of $${pct(comb)}$. The second store's price depends on $r$, so test allowed values on each side of $${c}$.

- $r = ${w1.x}$: it charges ${usd(price)} $\\times ${dec(mult(w1.x))} = ${nPrice(sample(w1.x))}$, so ${word(w1.rel)}.
- $r = ${w2.x}$: it charges ${usd(price)} $\\times ${dec(mult(w2.x))} = ${nPrice(sample(w2.x))}$, so ${word(w2.rel)}.

Both values of $r$ are allowed, so the relationship cannot be determined. (D)

Trap: stopping after $r = ${w1.x}$ would suggest that ${word(w1.rel)} every time, and a fixed answer needs every allowed $r$ to agree.`,
          },
        };
      }
      const single = mult(r).mul(price);
      const rel: QCChoice = qcCompare(two, single);
      const naive: QCChoice = qcCompare(F(sum), r) === 'A' ? 'B' : qcCompare(F(sum), r) === 'B' ? 'A' : 'C';
      const traps: QCQuestion['traps'] = naive !== rel ? { [fix(naive)]: 'num-add-percents' } : undefined;
      const rTex = `$${pct(r)}$`;
      const sideTex = orient('The price after the successive discounts', `The price after a single ${rTex} discount off the regular price`);
      return {
        params: { mode, price, ps, r, rLo, rHi, up: false, swap },
        q: {
          format: 'qc',
          info: `A store ${stem} of a jacket whose regular price is ${usd(price)}.`,
          ...sideTex,
          answer: fix(rel),
          traps,
          explanation: `Each discount applies to the price left by the one before it, so the multipliers multiply: ${usd(price)} $\\times ${tex} = ${nPrice(two)}$. That equals one discount of $${pct(comb)}$, not $${sum}\\%$, because every later discount is taken on a smaller price.

A single ${rTex} discount leaves ${usd(price)} $\\times ${dec(mult(r))} = ${nPrice(single)}$.

${rel === 'C' ? 'The prices are equal.' : two.gt(single) ? `${nPrice(two)} is more than ${nPrice(single)}.` : `${nPrice(two)} is less than ${nPrice(single)}.`}${
            naive !== rel ? ` Trap: adding the discounts to $${sum}\\%$ and comparing that with ${rTex} would suggest that ${naive === 'A' ? 'the first price is greater' : naive === 'B' ? 'the second price is greater' : 'the prices are equal'}.` : ''
          }

${qcEnd(fix(rel))}`,
        },
      };
    }
  },
  check(q, { mode, price, ps, r, rLo, rHi, up, swap }) {
    const step = (v: number, pc: number) => v - (v * pc) / 100;
    let samples: [number, number][];
    if (mode === 'undo') {
      const p = ps[0];
      const S = r.toNumber();
      // find the original by searching: apply the change to a candidate until it gives S
      let orig = NaN;
      for (let x = 1; x <= 2000; x++) if (Math.abs((up ? x * (1 + p / 100) : step(x, p)) - S) < 1e-9) orig = x;
      samples = [[orig, up ? S - (S * p) / 100 : S + (S * p) / 100]];
    } else if (mode === 'range') {
      const two = ps.reduce((v, p) => step(v, p), price);
      samples = [];
      for (let x = rLo + 1; x < rHi; x++) samples.push([two, step(price, x)]);
    } else {
      samples = [[ps.reduce((v, p) => step(v, p), price), step(price, r.toNumber())]];
    }
    if (swap) samples = samples.map(([a, b]) => [b, a]);
    return expectQC(q, qcFromFloatSamples(samples, 1e-9));
  },
};

export const stackedDiscountTemplates: Template<any>[] = [stackedDiscountQC];
