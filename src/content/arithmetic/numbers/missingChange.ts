import { Frac } from '../../../engine/frac';
import type { Template } from '../../../engine/types';
import { close, dec, F, pct } from './util';

const mult = (p: number | Frac) => F(1).add((p instanceof Frac ? p : F(p)).div(100));
const rose = (p: number) => (p > 0 ? 'raised' : 'lowered');

type Mode = 'undo' | 'second' | 'first';

interface Params {
  mode: Mode;
  /** signed first change in percent (for 'first' the sign only: the size is the answer) */
  p: number;
  /** signed second change in percent (for 'second' the sign only) */
  q: number;
  /** final price as a percent of the original */
  f: Frac;
}

const UNDO_UP = [25, 60, 100, 150, 300, 400];
const UNDO_DOWN = [-20, -50, -60, -75, -80];
const FIRST = [10, 20, 25, 30, 40, 50, 60];
const SECOND = [10, 15, 20, 25, 30, 40, 50];
const ITEMS = [
  ['television', 'bicycle', 'guitar', 'jacket', 'coat', 'sofa', 'blender', 'backpack', 'monitor', 'kayak', 'microwave', 'telescope'],
  ['laptop', 'camera', 'sofa', 'watch'],
  ['printer', 'tent', 'drone', 'lamp'],
];

const missingChangeNE: Template<Params> = {
  id: 'arith.successive-percent.missing-change-ne',
  skill: 'arith.successive-percent',
  format: 'ne',
  style: 'find the missing percent of two successive changes (the one that undoes the first, or from the final result)',
  generate(rng, d) {
    const item = rng.pick(ITEMS[d - 1]);
    for (;;) {
      const mode: Mode = d === 1 ? 'undo' : d === 2 ? 'second' : 'first';
      if (mode === 'undo') {
        const p = rng.chance(0.6) ? rng.pick(UNDO_UP) : rng.pick(UNDO_DOWN);
        const want = mult(p).inv().sub(1).abs().mul(100);
        if (!want.isTerminating()) continue;
        const p1 = mult(p).mul(100);
        return {
          params: { mode, p, q: -p, f: F(100) },
          q: {
            format: 'ne',
            stem: `The price of a ${item} was ${rose(p)} by ${Math.abs(p)}%. By what percent must the new price then be ${rose(-p)} to return to the original price?`,
            answer: want,
            suffix: '%',
            traps: [{ value: F(Math.abs(p)), trap: 'num-undo-same-percent' }],
            explanation: `Take the original price as 100. After the ${Math.abs(p)}% change the price is $${dec(p1)}$. To get back to 100, the second change must ${p > 0 ? 'remove' : 'add'} $${Math.abs(p)}$, and that is a percent of the NEW price $${dec(p1)}$.

$\\frac{${Math.abs(p)}}{${dec(p1)}} = ${dec(want.div(100))}$, so the second change is $${dec(want)}\\%$.

Check: $${dec(mult(p))} \\times ${dec(mult(want.mul(-Math.sign(p))))} = 1$.

Trap: ${Math.abs(p)}% is tempting, but the same percent of a different base is a different amount, so it does not undo the first change. The percent that undoes a change is measured on the amount it starts from.`,
          },
        };
      }
      if (mode === 'second') {
        const p = rng.pick([1, -1]) * rng.pick(FIRST);
        const qMag = rng.pick(SECOND);
        const q = rng.pick([1, -1]) * qMag;
        const f = mult(p).mul(mult(q)).mul(100);
        if (!f.mul(10).isInt() || f.eq(100)) continue;
        const naive = f.sub(100).sub(p).abs();
        const traps = naive.isTerminating() && !naive.eq(qMag) && naive.sign() > 0 ? [{ value: naive, trap: 'num-add-percents' }] : [];
        return {
          params: { mode, p, q, f },
          q: {
            format: 'ne',
            stem: `The price of a ${item} was ${rose(p)} by ${Math.abs(p)}%, and then the new price was ${rose(q)} by some percent. The final price was ${pct(f).replace(/\\%$/, '')}% of the original price. By what percent was the new price ${rose(q)}?`,
            answer: F(qMag),
            suffix: '%',
            traps,
            explanation: `Take the original price as 100. After the first change it is $${dec(mult(p).mul(100))}$, and the final price is $${dec(f)}$. The second change is a percent of the NEW price.

$${dec(f)} \\div ${dec(mult(p).mul(100))} = ${dec(mult(q))}$, so the second multiplier is $${dec(mult(q))}$ and the price was ${rose(q)} by $${qMag}\\%$.

Check: $${dec(mult(p))} \\times ${dec(mult(q))} = ${dec(f.div(100))}$, which is $${dec(f)}\\%$ of the original.${
              traps.length ? `\n\nTrap: ${dec(naive)}% comes from subtracting percents of different bases, ${Math.abs(p)}% of the original and the unknown percent of the new price.` : ''
            }`,
          },
        };
      }
      // first change unknown
      const pMag = rng.pick(FIRST.concat([75, 80]));
      const p = rng.pick([1, -1]) * pMag;
      const q = rng.pick([1, -1]) * rng.pick(SECOND);
      if (Math.sign(p) === Math.sign(q) && rng.chance(0.6)) continue;
      const f = mult(p).mul(mult(q)).mul(100);
      if (!f.mul(10).isInt() || f.eq(100) || f.sign() <= 0) continue;
      const naive = f.sub(100).sub(q).abs();
      const traps = naive.isTerminating() && !naive.eq(pMag) && naive.sign() > 0 ? [{ value: naive, trap: 'num-add-percents' }] : [];
      return {
        params: { mode, p, q, f },
        q: {
          format: 'ne',
          stem: `The price of a ${item} was ${rose(p)} by some percent, and then the new price was ${rose(q)} by ${Math.abs(q)}%. The final price was ${pct(f).replace(/\\%$/, '')}% of the original price. By what percent was the price ${rose(p)} at first?`,
          answer: F(pMag),
          suffix: '%',
          traps,
          explanation: `The two changes multiply: first multiplier $\\times ${dec(mult(q))} = ${dec(f.div(100))}$, since the final price is $${dec(f)}\\%$ of the original.

First multiplier $= ${dec(f.div(100))} \\div ${dec(mult(q))} = ${dec(mult(p))}$, so the first change was ${rose(p)} by $${pMag}\\%$.

Check: $${dec(mult(p))} \\times ${dec(mult(q))} = ${dec(f.div(100))}$.${
            traps.length ? `\n\nTrap: ${dec(naive)}% comes from taking away the ${Math.abs(q)}% from the net change. The second percent is taken on the new price, so it cannot be subtracted from a change measured on the original.` : ''
          }`,
        },
      };
    }
  },
  check(q, { mode, p, q: qq, f }) {
    if (q.format !== 'ne') return 'wrong format';
    const ans = q.answer.toNumber();
    const step = (v: number, pc: number) => v + (v * pc) / 100;
    let final: number;
    if (mode === 'undo') final = step(step(100, p), -Math.sign(p) * ans);
    else if (mode === 'second') final = step(step(100, p), Math.sign(qq) * ans);
    else final = step(step(100, Math.sign(p) * ans), qq);
    return close(final, mode === 'undo' ? 100 : f.toNumber(), 1e-9) ? null : `answer ${ans} gives ${final}, expected ${mode === 'undo' ? 100 : f.toNumber()}`;
  },
};

export const missingChangeTemplates: Template<any>[] = [missingChangeNE];
