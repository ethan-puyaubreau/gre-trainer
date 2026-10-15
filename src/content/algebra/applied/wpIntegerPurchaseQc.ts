import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { expectQc, money, NAMES, qcEnd } from './util';

// alg.word-problems: one total spent on two kinds of items, whole-number counts (quantitative comparison).

export const wpIntegerPurchaseTraps: Record<string, Trap> = {
  'algw-first-solution-only': {
    label: 'Stopped at the first whole-number solution found',
    fix: 'One equation with two unknown counts usually has several whole-number solutions. List them all (or the ones the conditions allow) before comparing.',
  },
  'algw-cheaper-means-more': {
    label: 'Assumed the cheaper item was bought in the larger number',
    fix: 'Price alone does not decide the counts. The total spent fixes only the combinations of $px + qy = T$ that are whole numbers; test them.',
  },
};

interface PurchaseParams {
  p: number;
  q: number;
  T: number;
  cond: 'none' | 'first3' | 'second3' | 'max';
  /** cond 'max': the most items bought in all. */
  m: number;
}

const STORES = [
  { a: 'notebooks', b: 'pens', verb: 'bought' },
  { a: 'muffins', b: 'bagels', verb: 'bought' },
  { a: 'stamps', b: 'postcards', verb: 'bought' },
  { a: 'plants', b: 'seed packets', verb: 'bought' },
  { a: 'adult tickets', b: 'child tickets', verb: 'bought' },
  { a: 'folders', b: 'binders', verb: 'ordered' },
];

/** Whole-number pairs (x, y), both at least 1, with px + qy = T that also meet the condition. */
function solutions(p: number, q: number, T: number, cond: PurchaseParams['cond'], m: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = 1; p * x < T; x++) {
    const rest = T - p * x;
    if (rest % q !== 0) continue;
    const y = rest / q;
    if (cond === 'first3' && x < 3) continue;
    if (cond === 'second3' && y < 3) continue;
    if (cond === 'max' && x + y > m) continue;
    out.push([x, y]);
  }
  return out;
}

const relation = (x: number, y: number): QCChoice => (x > y ? 'A' : x < y ? 'B' : 'C');

export const wpIntegerPurchaseQc: Template<PurchaseParams> = {
  id: 'alg.word-problems.integer-purchase-qc',
  skill: 'alg.word-problems',
  format: 'qc',
  style: 'one total spent on two items: compare the whole-number counts',
  generate(rng, d) {
    const store = rng.pick(STORES);
    const [nm] = rng.sample(NAMES, 1);
    const wanted = rng.pick<QCChoice>(['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'D', 'D']);
    for (;;) {
      const lo = d === 1 ? 2 : d === 2 ? 3 : 5;
      const hi = d === 1 ? 9 : d === 2 ? 14 : 24;
      const p = rng.int(lo, hi);
      const q = rng.int(lo, hi);
      if (p === q) continue;
      const mx = d === 1 ? 8 : d === 2 ? 12 : 15;
      const T = p * rng.int(1, mx) + q * rng.int(1, mx);
      const cond: PurchaseParams['cond'] = d === 1 ? 'none' : d === 2 ? rng.pick(['first3', 'second3'] as const) : rng.pick(['first3', 'second3', 'max'] as const);
      const everything = solutions(p, q, T, 'none', 0);
      if (everything.length === 0 || T < 25) continue;
      const m = cond === 'max' ? rng.pick(everything.map(([x, y]) => x + y)) : 0;
      const sols = solutions(p, q, T, cond, m);
      if (sols.length === 0) continue;
      const answer: QCChoice = new Set(sols.map(([x, y]) => relation(x, y))).size > 1 ? 'D' : relation(sols[0][0], sols[0][1]);
      if (answer !== wanted) continue;
      // Without the extra condition the counts must still be ambiguous enough to be a fair question.
      const first = relation(sols[0][0], sols[0][1]);
      const cheap: QCChoice = p < q ? 'A' : 'B';
      const traps: QCQuestion['traps'] = {};
      if (first !== answer) traps[first] = 'algw-first-solution-only';
      if (cheap !== answer && !(cheap in traps)) traps[cheap] = 'algw-cheaper-means-more';
      const condText =
        cond === 'none'
          ? ''
          : cond === 'first3'
            ? ` ${nm} ${store.verb} at least 3 ${store.a}.`
            : cond === 'second3'
              ? ` ${nm} ${store.verb} at least 3 ${store.b}.`
              : ` ${nm} ${store.verb} at most ${m} items in all.`;
      const allSols = everything;
      const listAll = allSols.map(([x, y]) => `$(${x}, ${y})$`).join(', ');
      const keep = sols.map(([x, y]) => `$(${x}, ${y})$`).join(', ');
      const word = (r: QCChoice) => (r === 'A' ? `${store.a} outnumber ${store.b}` : r === 'B' ? `${store.b} outnumber ${store.a}` : 'the counts are equal');
      const other = sols.find(([x, y]) => relation(x, y) !== first);
      const why =
        answer === 'D'
          ? `In $(${sols[0][0]}, ${sols[0][1]})$ ${word(first)}, but in $(${other![0]}, ${other![1]})$ ${word(relation(other![0], other![1]))}. ${qcEnd('D')}`
          : answer === 'C'
            ? `Only $(${sols[0][0]}, ${sols[0][1]})$ works, and the counts are equal. ${qcEnd('C')}`
            : `${sols.length === 1 ? `Only $(${sols[0][0]}, ${sols[0][1]})$ works, and there ${word(answer)}.` : `In every remaining pair ${word(answer)}.`} ${qcEnd(answer)}`;
      const trapText = traps[first] ? `reading only the first pair, $(${allSols[0][0]}, ${allSols[0][1]})$, would suggest ${first === 'C' ? 'equal counts' : `Quantity ${first}`}` : traps[cheap] ? `guessing that the cheaper item is bought more often points to Quantity ${cheap}, but only the listed pairs count` : 'treating the counts as any real numbers allows endless splits and settles nothing';
      return {
        params: { p, q, T, cond, m },
        q: {
          format: 'qc',
          info: `${nm} spent exactly ${money(T)} on ${store.a} and ${store.b}, buying at least one of each kind. The ${store.a} cost ${money(p)} each and the ${store.b} cost ${money(q)} each.${condText}`,
          quantityA: `The number of ${store.a} ${nm} ${store.verb}`,
          quantityB: `The number of ${store.b} ${nm} ${store.verb}`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `Both counts are whole numbers, so list the pairs $(x, y)$ with $${p}x + ${q}y = ${T}$: ${listAll}.${cond === 'none' || sols.length === allSols.length ? '' : ` The condition keeps ${keep}.`}

${why}

Trap: ${trapText}. Rule: when the counts must be whole numbers, enumerate every case the conditions allow before you compare.`,
        },
      };
    }
  },
  check(q, { p, q: qq, T, cond, m }) {
    // Brute force over every (x, y) in a box, instead of solving for y from x.
    const samples: [number, number][] = [];
    for (let x = 1; x <= T; x++)
      for (let y = 1; y <= T; y++) {
        if (p * x + qq * y !== T) continue;
        if (cond === 'first3' && x < 3) continue;
        if (cond === 'second3' && y < 3) continue;
        if (cond === 'max' && x + y > m) continue;
        samples.push([x, y]);
      }
    if (!samples.length) return 'no whole-number solution';
    return expectQc(q, qcFromSamples(samples));
  },
};
