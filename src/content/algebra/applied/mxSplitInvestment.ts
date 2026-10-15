import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { money, NAMES } from './util';

// alg.mixtures-interest: one sum split between two accounts with different simple rates (numeric entry).

export const mxSplitTraps: Record<string, Trap> = {
  'algw-split-even': {
    label: 'Split the money evenly between the accounts',
    fix: 'The rates differ, so equal sums would not give the stated interest. Let one account hold $x$ and the other hold the rest.',
  },
  'algw-split-wrong-account': {
    label: 'Gave the amount in the other account',
    fix: 'After solving for one account, reread which account the question asks about; the two amounts add up to the total.',
  },
  'algw-split-all-interest': {
    label: 'Credited all the interest to one account',
    fix: 'Both accounts earn interest. The stated interest is the sum (or the difference) of the two amounts of interest.',
  },
  'algw-split-difference-sign': {
    label: 'Added the smaller interest instead of subtracting it',
    fix: 'If one account earns $D more than the other, then (higher interest) $-$ (lower interest) $= D$.',
  },
};

interface SplitParams {
  kind: 'total' | 'equal' | 'more';
  T: number;
  r1: number;
  r2: number;
  I: number;
  ask: 'high' | 'low';
}

const RATE_PAIRS: [number, number][] = [];
for (let hi = 3; hi <= 12; hi++) for (let lo = 2; lo < hi; lo++) RATE_PAIRS.push([hi, lo]);

export const mxSplitInvestment: Template<SplitParams> = {
  id: 'alg.mixtures-interest.split-investment',
  skill: 'alg.mixtures-interest',
  format: 'ne',
  style: 'one sum in two accounts: total interest, equal interest, or an interest gap',
  generate(rng, d) {
    const kind: SplitParams['kind'] = d === 1 ? 'total' : d === 2 ? 'equal' : 'more';
    const nm = rng.pick(NAMES);
    for (;;) {
      const [r1, r2] = rng.pick(RATE_PAIRS);
      const ask: SplitParams['ask'] = rng.chance(0.5) ? 'high' : 'low';
      let x: number; // amount in the higher-rate account
      let y: number; // amount in the lower-rate account
      let I = 0;
      if (kind === 'equal') {
        // x r1 = y r2: x = r2 m, y = r1 m
        const m = rng.int(1, 12) * 50;
        x = r2 * m;
        y = r1 * m;
        if (x === y || Math.abs(r1 - r2) < 1) continue;
      } else {
        x = rng.int(2, 18) * 500;
        y = rng.int(2, 18) * 500;
        if (x === y) continue;
        if (kind === 'total') I = (x * r1 + y * r2) / 100;
        else I = (x * r1 - y * r2) / 100;
      }
      if (kind !== 'equal' && (!Number.isInteger(I) || I <= 0)) continue;
      const T = x + y;
      const ans = ask === 'high' ? x : y;
      const other = ask === 'high' ? y : x;
      const rate = ask === 'high' ? r1 : r2;
      const traps: { value: Frac; trap: string; why: string }[] = [
        { value: frac(T, 2), trap: 'algw-split-even', why: 'puts half of the money in each account' },
        { value: frac(other), trap: 'algw-split-wrong-account', why: 'is the amount in the other account' },
      ];
      if (kind === 'total') traps.push({ value: frac(100 * I, rate), trap: 'algw-split-all-interest', why: `gives all of the interest to the ${rate} percent account` });
      if (kind === 'more') {
        const wrongX = frac(T * r2 - 100 * I, r1 + r2);
        traps.push({ value: ask === 'high' ? wrongX : frac(T).sub(wrongX), trap: 'algw-split-difference-sign', why: 'adds the interest of the lower account instead of subtracting it' });
        traps.push({ value: frac(100 * I, rate), trap: 'algw-split-all-interest', why: `credits the whole ${money(I)} to the ${rate} percent account` });
      }
      const good = traps.filter((t) => t.value.sign() > 0 && t.value.mul(100).isInt() && !t.value.eq(ans));
      const first = good[0];
      const stem =
        kind === 'total'
          ? `${nm} puts ${money(T)} into two savings accounts. One pays ${r1} percent simple annual interest and the other pays ${r2} percent simple annual interest. After 1 year the two accounts together have earned ${money(I)} in interest. How many dollars did ${nm} put into the account that pays ${rate} percent?`
          : kind === 'equal'
            ? `${nm} divides ${money(T)} between two savings accounts, one paying ${r1} percent simple annual interest and the other paying ${r2} percent simple annual interest. In 1 year the two accounts earn exactly the same amount of interest. How many dollars did ${nm} put into the account that pays ${rate} percent?`
            : `${nm} divides ${money(T)} between two savings accounts, one paying ${r1} percent simple annual interest and the other paying ${r2} percent simple annual interest. In 1 year the ${r1} percent account earns ${money(I)} more in interest than the ${r2} percent account. How many dollars did ${nm} put into the account that pays ${rate} percent?`;
      const tail = ask === 'low' ? ` The question asks about the ${r2} percent account, so subtract: ${num(T)} − ${num(x)} = ${num(y)}.` : '';
      const body =
        kind === 'total'
          ? `Let $x$ be the amount at ${r1} percent; the rest, $${num(T)} - x$, earns ${r2} percent. The interest is $${r1 / 100}x + ${r2 / 100}(${num(T)} - x) = ${num(I)}$. Multiplying by 100: $${r1}x + ${num(r2 * T)} - ${r2}x = ${num(100 * I)}$, so $${r1 - r2 === 1 ? '' : r1 - r2}x = ${num(100 * I - r2 * T)}$ and $x = ${num(x)}$.${tail}`
          : kind === 'equal'
            ? `Let $x$ be the amount at ${r1} percent. Equal interest means $${r1 / 100}x = ${r2 / 100}(${num(T)} - x)$, that is, $${r1}x = ${r2}(${num(T)} - x)$, so $${r1 + r2}x = ${num(r2 * T)}$ and $x = ${num(x)}$.${tail}`
            : `Let $x$ be the amount at ${r1} percent. The higher-rate interest minus the lower-rate interest is ${money(I)}: $${r1 / 100}x - ${r2 / 100}(${num(T)} - x) = ${num(I)}$. Multiplying by 100: $${r1 + r2}x - ${num(r2 * T)} = ${num(100 * I)}$, so $${r1 + r2}x = ${num(100 * I + r2 * T)}$ and $x = ${num(x)}$.${tail}`;
      const check =
        kind === 'total'
          ? `${money(x)} at ${r1} percent earns ${money(frac(x * r1, 100))} and ${money(y)} at ${r2} percent earns ${money(frac(y * r2, 100))}; together ${money(I)}.`
          : kind === 'equal'
            ? `${money(x)} at ${r1} percent earns ${money(frac(x * r1, 100))}, and ${money(y)} at ${r2} percent earns ${money(frac(y * r2, 100))}.`
            : `${money(frac(x * r1, 100))} − ${money(frac(y * r2, 100))} = ${money(I)}.`;
      return {
        params: { kind, T, r1, r2, I, ask },
        q: {
          format: 'ne',
          stem,
          answer: frac(ans),
          suffix: 'dollars',
          traps: good.map((t) => ({ value: t.value, trap: t.trap })),
          explanation: `${body}

Check: ${check}${first ? ` Trap: ${money(first.value)} ${first.why}.` : ''} Rule: with two accounts, write one unknown, express the other as the total minus it, and put the stated interest condition into one equation.`,
        },
      };
    }
  },
  check(q, { kind, T, r1, r2, I, ask }) {
    if (q.format !== 'ne') return 'wrong format';
    const a = q.answer;
    // Replay: the answer is the amount in the asked account; the other is the rest.
    const high = ask === 'high' ? a : frac(T).sub(a);
    const low = frac(T).sub(high);
    if (high.sign() <= 0 || low.sign() <= 0) return 'an account would hold no money';
    const iHigh = high.mul(r1).div(100);
    const iLow = low.mul(r2).div(100);
    if (kind === 'total') return iHigh.add(iLow).eq(I) ? null : `total interest ${iHigh.add(iLow)} != ${I}`;
    if (kind === 'equal') return iHigh.eq(iLow) ? null : `interests ${iHigh} and ${iLow} differ`;
    return iHigh.sub(iLow).eq(I) ? null : `gap ${iHigh.sub(iLow)} != ${I}`;
  },
};
