import { gcd, lcm } from '../../../engine/math';
import type { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { expectNE, F, pickWeighted } from './util';

export const wholeCountTraps: Record<string, Trap> = {
  'fr-product-of-denominators': {
    label: 'Multiplied the denominators instead of finding their least common multiple',
    fix: 'Every count must be a whole number, so the total is a multiple of EACH denominator, hence of their least common multiple. For 4 and 6 that is 12, not 24.',
  },
  'fr-one-denominator-only': {
    label: 'Satisfied only one of the fractions',
    fix: 'Each fraction forces its own condition on the total. A total that works for one denominator can leave a fractional number of people for the other.',
  },
  'fr-limit-not-multiple': {
    label: 'Used the limit itself even though it does not give whole counts',
    fix: 'The largest allowed total is the greatest multiple of the least common multiple that does not pass the limit, which can be well below the limit.',
  },
  'fr-total-instead-of-part': {
    label: 'Gave the total instead of the group that was asked for',
    fix: 'Finding the total is only the first step. Reread the question and finish by taking the requested fraction of the total.',
  },
  'fr-sum-of-denominators': {
    label: 'Added the denominators',
    fix: 'The total must be divisible by each denominator, so use their least common multiple, not their sum.',
  },
};

type Mode = 'least' | 'between' | 'leftover';
interface Params {
  mode: Mode;
  ask: 'greatest' | 'least';
  a: number;
  b: number;
  c: number;
  d: number;
  L: number;
  U: number;
  M: number;
}

const CTX = [
  { group: 'members', xp: 'are juniors', yp: 'are seniors', rp: 'are adults', head: 'A club' },
  { group: 'marbles', xp: 'are red', yp: 'are blue', rp: 'are green', head: 'A bag' },
  { group: 'students', xp: 'play soccer', yp: 'play chess', rp: 'do neither', head: 'A school group' },
  { group: 'cars', xp: 'are white', yp: 'are black', rp: 'have another color', head: 'A parking lot' },
];
const DENS = [4, 6, 8, 9, 10, 12, 14, 15, 18, 20];
const tx = (a: number, b: number) => `$\\frac{${a}}{${b}}$`;
const valid = (n: number, a: number, b: number, c: number, d: number) => (n * a) % b === 0 && (n * c) % d === 0;

function pickFracs(rng: Rng, diff: number) {
  for (;;) {
    const b = rng.pick(DENS);
    const d = rng.pick(DENS);
    if (b === d || b % d === 0 || d % b === 0) continue;
    if (diff === 1 && gcd(b, d) === 1) continue;
    const a = rng.int(1, b - 1);
    const c = rng.int(1, d - 1);
    if (gcd(a, b) !== 1 || gcd(c, d) !== 1) continue;
    if (a / b + c / d >= 0.9) continue;
    return { a, b, c, d };
  }
}

const wholeCount: Template<Params> = {
  id: 'arith.fractions.whole-count-ne',
  skill: 'arith.fractions',
  format: 'ne',
  style: 'fractions of a group must be whole numbers: least, only or greatest possible total',
  generate(rng, diff) {
    for (;;) {
      const mode = pickWeighted<Mode>(rng, diff === 1 ? [['least', 1]] : diff === 2 ? [['between', 3], ['least', 1]] : [['leftover', 1]]);
      const { a, b, c, d } = pickFracs(rng, diff);
      const m = lcm(b, d);
      const ctx = rng.pick(CTX);
      const fa = tx(a, b);
      const fc = tx(c, d);
      const green = F(1).sub(F(a, b)).sub(F(c, d));
      let key: Frac;
      let stem: string;
      let explanation: string;
      let L = 0;
      let U = 0;
      let M = 0;
      let ask: Params['ask'] = 'least';
      const traps: { value: Frac; trap: string }[] = [];
      const lcmLine = `The total must be a multiple of ${b} (so that $\\frac{${a}}{${b}}$ of it is a whole number) and a multiple of ${d}, so it is a multiple of $\\text{lcm}(${b}, ${d}) = ${m}$.`;
      if (mode === 'least') {
        key = F(m);
        stem = `${ctx.head} has ${ctx.group}. ${fa} of them ${ctx.xp} and ${fc} of them ${ctx.yp}. What is the least possible number of ${ctx.group} in all?`;
        if (b * d !== m) traps.push({ value: F(b * d), trap: 'fr-product-of-denominators' });
        traps.push({ value: F(b + d), trap: 'fr-sum-of-denominators' }, { value: F(Math.max(b, d)), trap: 'fr-one-denominator-only' });
        explanation = `Recognize: a fraction of a group of people or objects must be a whole number, so the total is limited by the denominators.

${lcmLine} The smallest positive multiple is $${m}$ itself.

Check: $${m}$ ${ctx.group} give $${(a * m) / b}$ in the first part and $${(c * m) / d}$ in the second, both whole numbers; no smaller total works for both denominators.

${b * d !== m ? `Trap: multiplying the denominators gives $${b * d}$, which works but is not the least. ` : ''}Take the least common multiple, not the product.`;
      } else if (mode === 'between') {
        const k = rng.int(2, 6);
        key = F(k * m);
        L = k * m - rng.int(1, Math.max(1, m - 1));
        U = k * m + rng.int(1, Math.max(1, m - 1));
        ask = 'least';
        stem = `${ctx.head} has more than ${num(L)} and fewer than ${num(U)} ${ctx.group}. Exactly ${fa} of them ${ctx.xp} and exactly ${fc} of them ${ctx.yp}. How many ${ctx.group} are there in all?`;
        const onlyB = [];
        for (let n = L + 1; n < U; n++) if (n % b === 0 && n !== k * m) onlyB.push(n);
        const onlyD = [];
        for (let n = L + 1; n < U; n++) if (n % d === 0 && n !== k * m) onlyD.push(n);
        for (const v of [...onlyB, ...onlyD].slice(0, 2)) traps.push({ value: F(v), trap: 'fr-one-denominator-only' });
        explanation = `Recognize: both fractions must give whole numbers, and the range then leaves only one possible total.

${lcmLine} The multiples of ${m} near the range are $${(k - 1) * m}$, $${k * m}$ and $${(k + 1) * m}$; only $${k * m}$ lies between ${num(L)} and ${num(U)}.

Check: $\\frac{${a}}{${b}} \\cdot ${k * m} = ${(a * k * m) / b}$ and $\\frac{${c}}{${d}} \\cdot ${k * m} = ${(c * k * m) / d}$, both whole.

${traps.length ? `Trap: a total such as $${traps[0].value.toNumber()}$ is in the range and fits one denominator, but not both. ` : ''}A total that fits only one fraction fails the other.`;
      } else {
        ask = rng.chance(0.7) ? 'greatest' : 'least';
        if (ask === 'greatest') {
          const k = rng.int(3, 9);
          M = k * m + rng.int(1, m - 1);
          const n = k * m;
          key = green.mul(n);
          const naive = green.mul(M);
          const floorNaive = F(Math.floor(naive.toNumber()));
          if (!naive.isInt()) traps.push({ value: floorNaive, trap: 'fr-limit-not-multiple' });
          traps.push({ value: F(n), trap: 'fr-total-instead-of-part' });
          stem = `${ctx.head} has at most ${num(M)} ${ctx.group}. Exactly ${fa} of them ${ctx.xp}, exactly ${fc} ${ctx.yp}, and the rest ${ctx.rp}. What is the greatest possible number of ${ctx.group} in the last group?`;
          explanation = `Recognize: the total must keep both counts whole, so it is not just any number up to the limit.

${lcmLine} The greatest multiple of ${m} that does not exceed ${num(M)} is $${n}$. The last group is the rest: $1 - \\frac{${a}}{${b}} - \\frac{${c}}{${d}} = ${green.toTex()}$ of the total, so $${green.toTex()} \\cdot ${n} = ${key.toNumber()}$.

Check: $${n} + ${m} = ${n + m}$ is above ${num(M)}, so $${n}$ is the greatest allowed total.

Trap: using the limit ${num(M)} itself as the total fails, because it does not keep both counts whole. Find the greatest multiple of the least common multiple first.`;
        } else {
          key = green.mul(m);
          traps.push({ value: green.mul(b * d), trap: 'fr-product-of-denominators' }, { value: green.mul(Math.max(b, d)), trap: 'fr-one-denominator-only' });
          stem = `${ctx.head} has ${ctx.group}. Exactly ${fa} of them ${ctx.xp}, exactly ${fc} ${ctx.yp}, and the rest ${ctx.rp}. What is the least possible number of ${ctx.group} in the last group?`;
          explanation = `Recognize: the total must keep both counts whole, so its smallest value comes from the denominators.

${lcmLine} The least total is $${m}$. The last group is $1 - \\frac{${a}}{${b}} - \\frac{${c}}{${d}} = ${green.toTex()}$ of the total, so it has $${green.toTex()} \\cdot ${m} = ${key.toNumber()}$ members at least.

Check: a larger total, like $${2 * m}$, gives $${green.mul(2 * m).toNumber()}$, which is larger.

${b * d !== m ? `Trap: using the product $${b * d}$ as the total gives $${green.mul(b * d).toNumber()}$, too many. ` : ''}Use the least common multiple of the denominators.`;
        }
      }
      if (!key.isInt() || key.sign() <= 0) continue;
      const keep = traps.filter((t) => t.value.isInt() && t.value.sign() > 0 && !t.value.eq(key)).filter((t, i, arr) => arr.findIndex((u) => u.value.eq(t.value)) === i);
      if (mode === 'leftover' && ask === 'greatest' && keep.length === 0) continue;
      return {
        params: { mode, ask, a, b, c, d, L, U, M },
        q: { format: 'ne', stem, answer: key, traps: keep, explanation },
      };
    }
  },
  check(q, { mode, ask, a, b, c, d, L, U, M }) {
    const ok = (n: number) => valid(n, a, b, c, d);
    if (mode === 'least') {
      for (let n = 1; n <= 5000; n++) if (ok(n)) return expectNE(q, n);
    } else if (mode === 'between') {
      const hits: number[] = [];
      for (let n = L + 1; n < U; n++) if (ok(n)) hits.push(n);
      if (hits.length !== 1) return `${hits.length} totals fit`;
      return expectNE(q, hits[0]);
    } else {
      const greenOf = (n: number) => n - (n * a) / b - (n * c) / d;
      if (ask === 'greatest') {
        for (let n = M; n >= 1; n--) if (ok(n)) return expectNE(q, greenOf(n));
      } else for (let n = 1; n <= 5000; n++) if (ok(n)) return expectNE(q, greenOf(n));
    }
    return 'no total found';
  },
};

export const wholeCountTemplates: Template<any>[] = [wholeCount];
