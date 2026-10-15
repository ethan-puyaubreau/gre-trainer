import { flaggedChoices } from '../../../engine/build';
import { gcd } from '../../../engine/math';
import type { Choice, Template, Trap } from '../../../engine/types';
import { expectMcm, listAnd } from '../integers/util';

export const ratioTotalTraps: Record<string, Trap> = {
  'rat-multiple-of-term': {
    label: 'Treated one term of the ratio as the unit of the total',
    fix: 'In a ratio of 2 to 3, a group of 5 holds 2 of one kind and 3 of the other. The total comes in lots of 2 + 3 = 5, not in lots of 2 or of 3.',
  },
  'rat-product-for-sum': {
    label: 'Multiplied the terms instead of adding them',
    fix: 'The total of one lot is the SUM of the terms. A ratio of 2 to 3 means 5 items per lot, not 6.',
  },
  'rat-term-left-out': {
    label: 'Left one part out of the lot',
    fix: 'Every part of the ratio belongs to the total: add all the parts, then take multiples of that sum.',
  },
  'rat-unmatched-terms': {
    label: 'Added the terms of two ratios without matching the shared term',
    fix: 'When two ratios share a quantity, first scale them so that quantity has the same number in both. Only then do the three parts form one ratio whose sum gives the lot.',
  },
};

interface RatTotParams {
  pairs: [number, number][];
  vals: number[];
}

const CONTEXTS = [
  { intro: (ks: string) => `A shelter houses only ${ks}.`, kinds: ['cats', 'dogs', 'rabbits'], total: 'animals at the shelter' },
  { intro: (ks: string) => `A library shelf holds only ${ks}.`, kinds: ['novels', 'biographies', 'atlases'], total: 'books on the shelf' },
  { intro: (ks: string) => `A bag contains only ${ks}.`, kinds: ['red marbles', 'blue marbles', 'green marbles'], total: 'marbles in the bag' },
  { intro: (ks: string) => `A fruit stand sells only ${ks}.`, kinds: ['apples', 'pears', 'plums'], total: 'pieces of fruit at the stand' },
];

const ratioTotals: Template<RatTotParams> = {
  id: 'arith.ratios.total-select',
  skill: 'arith.ratios',
  format: 'mcm',
  style: 'which totals are possible when the parts of a ratio must be whole items',
  generate(rng, diff) {
    for (;;) {
      let parts: number[];
      let pairs: [number, number][];
      let shown: number[];
      if (diff === 1) {
        const p = rng.int(1, 8);
        const q = rng.int(2, 9);
        if (p === q || gcd(p, q) !== 1) continue;
        parts = [p, q];
        pairs = [[p, q]];
        shown = [p, q];
      } else if (diff === 2) {
        parts = [rng.int(1, 8), rng.int(1, 8), rng.int(1, 8)];
        if (new Set(parts).size < 3 || parts.reduce((g, x) => gcd(g, x), 0) !== 1) continue;
        pairs = [
          [parts[0], parts[1]],
          [parts[1], parts[2]],
        ];
        shown = parts;
      } else {
        const [p, q, r, s] = [rng.int(1, 9), rng.int(2, 9), rng.int(2, 9), rng.int(1, 9)];
        if (q === r || gcd(p, q) !== 1 || gcd(r, s) !== 1 || p === q || r === s) continue;
        const m = (q * r) / gcd(q, r);
        const raw = [(p * m) / q, m, (s * m) / r];
        const g = raw.reduce((a, x) => gcd(a, x), 0);
        parts = raw.map((x) => x / g);
        pairs = [
          [p, q],
          [r, s],
        ];
        shown = [p, q, r, s];
      }
      const S = parts.reduce((a, x) => a + x, 0);
      const [slo, shi] = diff === 1 ? [5, 13] : diff === 2 ? [8, 22] : [14, 60];
      if (S < slo || S > shi) continue;
      const top = Math.min(10 * S, 420);
      const product = diff === 3 ? 0 : shown.reduce((a, x) => a * x, 1);
      if (diff !== 3 && shown.includes(product)) continue;
      const leftOut = diff === 1 ? 0 : S - Math.min(...parts);
      const sumShown = diff === 3 ? shown.reduce((a, x) => a + x, 0) : 0;
      const good: number[] = [];
      const bad: { v: number; trap: string }[] = [];
      for (let t = 8; t <= top; t++) {
        if (t % S === 0) good.push(t);
        else if (product > 1 && product <= top && t % product === 0) bad.push({ v: t, trap: 'rat-product-for-sum' });
        else if (sumShown > 0 && sumShown !== S && t % sumShown === 0) bad.push({ v: t, trap: 'rat-unmatched-terms' });
        else if (leftOut > 1 && diff === 2 && t % leftOut === 0) bad.push({ v: t, trap: 'rat-term-left-out' });
        else if (shown.some((x) => x > 1 && t % x === 0)) bad.push({ v: t, trap: 'rat-multiple-of-term' });
      }
      const count = diff === 1 ? 5 : 6;
      const nGood = diff === 1 ? rng.int(1, 2) : rng.int(2, 3);
      if (good.length < nGood) continue;
      const classes = rng.shuffle([...new Set(bad.map((b) => b.trap))]);
      const pools = classes.map((c) => rng.shuffle(bad.filter((b) => b.trap === c)));
      const wrong: { v: number; trap: string }[] = [];
      for (let round = 0; wrong.length < count - nGood && round < 8; round++)
        for (const pool of pools) if (wrong.length < count - nGood && pool[round]) wrong.push(pool[round]);
      if (wrong.length < count - nGood) continue;
      const items = [...rng.sample(good, nGood).map((v) => ({ v, correct: true, trap: undefined as string | undefined })), ...wrong.map((w) => ({ ...w, correct: false }))].sort((x, y) => x.v - y.v);
      const { choices, answer } = flaggedChoices(items.map((x) => ({ text: `$${x.v}$`, correct: x.correct, ...(x.trap ? { trap: x.trap } : {}) })) as (Choice & { correct: boolean })[]);
      const ctx = rng.pick(CONTEXTS);
      const ks = ctx.kinds.slice(0, diff === 1 ? 2 : 3);
      const ratioText =
        diff === 3
          ? `The ratio of ${ks[0]} to ${ks[1]} is ${pairs[0][0]} to ${pairs[0][1]}, and the ratio of ${ks[1]} to ${ks[2]} is ${pairs[1][0]} to ${pairs[1][1]}.`
          : `The ratio of ${ks.join(' to ')} is ${parts.join(' to ')}.`;
      const stem = `${ctx.intro(listAnd(ks))} ${ratioText} Which of the following could be the total number of ${ctx.total}?`;
      const w = items.find((x) => !x.correct)!;
      const trapLine: Record<string, string> = {
        'rat-multiple-of-term': `${w.v} is a multiple of one term of the ratio, but not of the sum ${S}`,
        'rat-product-for-sum': `${w.v} is a multiple of ${product}, the product of the terms, but the lot is their sum ${S}`,
        'rat-term-left-out': `${w.v} is a multiple of ${leftOut}, which leaves one part out of the ${S}`,
        'rat-unmatched-terms': `${w.v} is a multiple of ${sumShown}, the sum of the four terms, but the middle term was never matched`,
      };
      const good1 = items.find((x) => x.correct)!.v;
      let lot: string;
      if (diff === 3) {
        const m = (pairs[0][1] * pairs[1][0]) / gcd(pairs[0][1], pairs[1][0]);
        const A = pairs[0][0] * (m / pairs[0][1]);
        const C = pairs[1][1] * (m / pairs[1][0]);
        const g = gcd(gcd(A, m), C);
        lot = `Give the shared middle term the same value in both ratios: ${A} to ${m} and ${m} to ${C}. The kinds are in the ratio $${A} : ${m} : ${C}$${g > 1 ? `, which reduces to $${parts.join(' : ')}$` : ''}, so a lot holds ${parts.join(' + ')} = ${S} items.`;
      } else {
        lot = `A lot holds ${parts.join(' + ')} = ${S} items.`;
      }
      const explanation = `Recognize: each kind is a whole number of items, so the total is a whole number of lots of the ratio.

${lot} So every possible total is a multiple of ${S}.

Check: $${good1} = ${good1 / S} \\cdot ${S}$, so the kinds number ${parts.map((x) => (x * good1) / S).join(', ')}.

Trap: ${trapLine[w.trap!]}. Add all the parts, then take multiples of that sum.`;
      return {
        params: { pairs, vals: items.map((x) => x.v) },
        q: { format: 'mcm', stem, instruction: 'Indicate all such numbers.', choices, answer, explanation },
      };
    }
  },
  check(q, { pairs, vals }) {
    const ok = (T: number) => {
      for (let y = 1; y < T; y++) {
        const [p1, q1] = pairs[0];
        if ((y * p1) % q1 !== 0) continue;
        const x = (y * p1) / q1;
        if (pairs.length === 1) {
          if (x + y === T) return true;
          continue;
        }
        const [p2, q2] = pairs[1];
        if ((y * q2) % p2 !== 0) continue;
        if (x + y + (y * q2) / p2 === T) return true;
      }
      return false;
    };
    return expectMcm(q, vals.flatMap((T, i) => (ok(T) ? [i] : [])));
  },
};

export const ratioTotalTemplates: Template<any>[] = [ratioTotals];
