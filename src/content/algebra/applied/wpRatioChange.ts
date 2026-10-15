import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { choiceValuesMatch, expectMcs, trapChoices, uniqueIndex } from './util';

// alg.word-problems: a ratio changes when items are added or removed; find the original (or new) count.

export const wpRatioChangeTraps: Record<string, Trap> = {
  'algw-ratio-one-part': {
    label: 'Gave the size of one part instead of the quantity asked',
    fix: 'If the ratio is $r : s$ and one part has size $t$, a group is $r$ parts, that is $rt$ items. Multiply back before answering.',
  },
  'algw-ratio-wrong-group': {
    label: 'Answered for the other group',
    fix: 'Reread the last sentence: which group, or which total, does the question ask for? Underline it before solving.',
  },
  'algw-ratio-before-after': {
    label: 'Gave the count after the change when the question asks before (or the reverse)',
    fix: 'The equation uses both: counts before the change in terms of $t$, counts after the change in the ratio. Check which one the question wants.',
  },
  'algw-ratio-group-for-total': {
    label: 'Gave one group when the question asks for the total (or the total for one group)',
    fix: 'A group is its share of the parts; the total is all the parts together. Match the answer to the question.',
  },
  'algw-ratio-parts-as-counts': {
    label: 'Took the numbers of the ratio as the actual counts',
    fix: 'A ratio $r : s$ only fixes the shape. The actual counts are $rt$ and $st$ for some size $t$ that the added or removed items let you find.',
  },
};

interface Ctx {
  A: string;
  B: string;
  tot: string;
  add: string;
  rem: string;
}

const CTX: Ctx[] = [
  { A: 'boys', B: 'girls', tot: 'members', add: 'join the club', rem: 'leave the club' },
  { A: 'red marbles', B: 'blue marbles', tot: 'marbles', add: 'are added to the bag', rem: 'are removed from the bag' },
  { A: 'fiction books', B: 'nonfiction books', tot: 'books', add: 'are added to the shelf', rem: 'are taken off the shelf' },
  { A: 'full-time employees', B: 'part-time employees', tot: 'employees', add: 'join the company', rem: 'leave the company' },
  { A: 'adult tickets', B: 'child tickets', tot: 'tickets', add: 'are added to the box office stock', rem: 'are sold' },
];

type Ask = 'A' | 'B' | 'total' | 'new-total';

interface RatioParams {
  r: number;
  s: number;
  r2: number;
  s2: number;
  dA: number;
  dB: number;
  ask: Ask;
  values: Frac[];
}

/** Coefficient times t without a leading 1. */
const ct = (k: number) => (k === 1 ? 't' : `${k}t`);
const times = (k: number, e: string) => (k === 1 ? e : `${k}(${e})`);

const quantity = (ask: Ask, r: number, s: number, dA: number, dB: number, t: number): number =>
  ask === 'A' ? r * t : ask === 'B' ? s * t : ask === 'total' ? (r + s) * t : (r + s) * t + dA + dB;

/** Counts before the change are r t and s t; the change must give the new ratio r2 : s2. */
function solveT(r: number, s: number, r2: number, s2: number, dA: number, dB: number): Frac | null {
  const den = s2 * r - r2 * s;
  if (den === 0) return null;
  return frac(r2 * dB - s2 * dA, den);
}

export const wpRatioChange: Template<RatioParams> = {
  id: 'alg.word-problems.ratio-change',
  skill: 'alg.word-problems',
  format: 'mcs',
  style: 'a ratio after items are added or removed',
  generate(rng, d) {
    const c = rng.pick(CTX);
    for (;;) {
      const r = rng.int(1, 9);
      const s = rng.int(1, 9);
      if (r === s || gcd(r, s) !== 1) continue;
      const t = rng.int(d === 1 ? 3 : 4, d === 1 ? 12 : 20);
      let dA = 0;
      let dB = 0;
      const k1 = rng.int(2, Math.max(3, Math.floor(t * 0.6))) * rng.sign();
      if (d < 3) {
        if (rng.chance(0.5)) dA = k1;
        else dB = k1;
      } else {
        dA = k1;
        dB = rng.int(2, Math.max(3, Math.floor(t * 0.6))) * rng.sign();
        if (dA === dB) continue;
      }
      const nA = r * t + dA;
      const nB = s * t + dB;
      if (nA < 2 || nB < 2) continue;
      const g = gcd(nA, nB);
      const r2 = nA / g;
      const s2 = nB / g;
      if (r2 === r && s2 === s) continue;
      if (r2 > 15 || s2 > 15 || r2 === s2 || s2 === 1) continue;
      // The new ratio must not point to a different original size.
      const tt = solveT(r, s, r2, s2, dA, dB);
      if (!tt || !tt.eq(t)) continue;
      const ask: Ask = d === 1 ? rng.pick(['A', 'B'] as const) : d === 2 ? rng.pick(['total', 'new-total'] as const) : rng.pick(['A', 'B', 'total', 'new-total'] as const);
      const correct = quantity(ask, r, s, dA, dB, t);
      const cands: { value: number; trap: string; why: string }[] = [
        { value: t, trap: 'algw-ratio-one-part', why: 'the size of one part' },
        { value: ask === 'A' ? s * t : ask === 'B' ? r * t : ask === 'total' ? quantity('new-total', r, s, dA, dB, t) : quantity('total', r, s, dA, dB, t), trap: ask === 'A' || ask === 'B' ? 'algw-ratio-wrong-group' : 'algw-ratio-before-after', why: ask === 'A' || ask === 'B' ? `the number of ${ask === 'A' ? c.B : c.A}` : ask === 'total' ? 'the number after the change' : 'the number before the change' },
        { value: ask === 'A' ? nA : ask === 'B' ? nB : ask === 'total' ? r * t : s * t, trap: ask === 'A' || ask === 'B' ? 'algw-ratio-before-after' : 'algw-ratio-group-for-total', why: ask === 'A' || ask === 'B' ? `the number of ${ask === 'A' ? c.A : c.B} after the change` : `the number of ${ask === 'total' ? c.A : c.B} alone` },
        { value: ask === 'A' || ask === 'B' ? (r + s) * t : (r2 + s2) * (ask === 'total' ? 1 : 1), trap: ask === 'A' || ask === 'B' ? 'algw-ratio-group-for-total' : 'algw-ratio-parts-as-counts', why: ask === 'A' || ask === 'B' ? `all the ${c.tot} together` : 'the sum of the numbers of the new ratio' },
        { value: ask === 'A' ? r : ask === 'B' ? s : r + s, trap: 'algw-ratio-parts-as-counts', why: 'the number of the original ratio' },
      ];
      const res = trapChoices(
        rng,
        correct,
        cands.filter((x) => x.value > 0).map((x) => ({ ...x, value: frac(x.value) })),
        (v) => `$${num(v)}$`,
      );
      if (!res) continue;
      // Ascending order would never put the key first (one part and the ratio numbers are always smaller), so shuffle.
      const order = rng.shuffle(res.choices.map((_, i) => i));
      const choices = order.map((i) => res.choices[i]);
      const answer = order.indexOf(res.answer);
      const values = order.map((i) => res.values[i]);
      const side = (dd: number, noun: string) => (dd > 0 ? `${dd} ${noun} ${c.add}` : `${-dd} ${noun} ${c.rem}`);
      const chg = dA && dB ? `${side(dA, c.A)} and ${side(dB, c.B)}` : dA ? side(dA, c.A) : side(dB, c.B);
      const stem = `The ratio of ${c.A} to ${c.B} is ${r} to ${s}. After ${chg}, the ratio of ${c.A} to ${c.B} is ${r2} to ${s2}. ${
        ask === 'A' ? `How many ${c.A} were there originally?` : ask === 'B' ? `How many ${c.B} were there originally?` : ask === 'total' ? `How many ${c.tot} were there altogether before the change?` : `How many ${c.tot} are there altogether after the change?`
      }`;
      const aTx = dA ? `${ct(r)} ${dA > 0 ? '+' : '-'} ${Math.abs(dA)}` : ct(r);
      const bTx = dB ? `${ct(s)} ${dB > 0 ? '+' : '-'} ${Math.abs(dB)}` : ct(s);
      const kept = res.kept[0];
      const explanation = `A ratio fixes shape, not size, so let one part be $t$: originally $${ct(r)}$ ${c.A} and $${ct(s)}$ ${c.B}. Adding and removing happen to the actual counts, giving $\\frac{${aTx}}{${bTx}} = \\frac{${r2}}{${s2}}$. Cross-multiplying, $${times(s2, aTx)} = ${times(r2, bTx)}$, so $${ct(Math.abs(s2 * r - r2 * s))} = ${num(Math.abs(r2 * dB - s2 * dA))}$ and $t = ${t}$. Originally: ${num(r * t)} ${c.A} and ${num(s * t)} ${c.B}; after: ${num(nA)} and ${num(nB)}.

Check: with $t = ${t}$ the counts after the change are $${dA ? `${num(r * t)} ${dA > 0 ? '+' : '-'} ${Math.abs(dA)} = ` : ''}${nA}$ and $${dB ? `${num(s * t)} ${dB > 0 ? '+' : '-'} ${Math.abs(dB)} = ` : ''}${nB}$, and $${nA} : ${nB}$ is ${nA * s2 === nB * r2 && (nA !== r2 || nB !== s2) ? `$${r2} : ${s2}$ in lowest terms` : `already $${r2} : ${s2}$`}.

Trap: ${num(kept.value)} is ${cands.find((x) => x.trap === kept.trap && frac(x.value).eq(kept.value))!.why}, not the quantity asked. Rule: write the counts with the size $t$, apply the change to them, then match the new ratio.`;
      return { params: { r, s, r2, s2, dA, dB, ask, values }, q: { format: 'mcs', stem, choices, answer, explanation } };
    }
  },
  check(q, { r, s, r2, s2, dA, dB, ask, values }) {
    const err = choiceValuesMatch(q, values, (v) => `$${num(v)}$`);
    if (err) return err;
    // Brute force the size of one part and test the new ratio by cross-multiplying.
    const hits: number[] = [];
    for (let t = 1; t <= 400; t++) if ((r * t + dA) * s2 === (s * t + dB) * r2 && r * t + dA > 0 && s * t + dB > 0) hits.push(t);
    if (hits.length !== 1) return `${hits.length} sizes fit the ratios`;
    const want = frac(quantity(ask, r, s, dA, dB, hits[0]));
    return expectMcs(q, uniqueIndex(values, (v) => v.eq(want)));
  },
};
