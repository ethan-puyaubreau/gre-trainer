import type { Frac } from '../../../engine/frac';
import { lcm, lcmAll } from '../../../engine/math';
import type { Template, Trap } from '../../../engine/types';
import { trapOnlyChoices } from './util';

// Select-one counting questions where the "sets" are the multiples of given integers in a range.
export const setsMultiplesTraps: Record<string, Trap> = {
  'prob-mult-no-overlap': {
    label: 'Added the counts of multiples without removing the overlap',
    fix: 'A number that is a multiple of both is counted in each list. Remove the multiples of the least common multiple once: $a$ + $b$ $-$ both.',
  },
  'prob-mult-product-overlap': {
    label: 'Used the product as the number that is a multiple of both',
    fix: 'The numbers divisible by both are the multiples of the least common multiple, not of the product. For 4 and 6 it is 12, not 24.',
  },
  'prob-mult-round-up': {
    label: 'Rounded a quotient up instead of down',
    fix: 'The multiples of $m$ up to $n$ are $m, 2m, \\dots, km$ with $km \\le n$, so the count is $\\lfloor n/m \\rfloor$. A partial multiple past $n$ does not count.',
  },
  'prob-mult-range-start': {
    label: 'Counted from 1 instead of from the start of the range',
    fix: 'For a range from $L$ to $U$, count the multiples up to $U$ and subtract those below $L$, that is, those up to $L - 1$.',
  },
  'prob-mult-wrong-region': {
    label: 'Answered about a different region of the diagram',
    fix: 'Match the wording to the region: "either" is the union, "neither" is the rest, "exactly one" leaves out the overlap.',
  },
  'prob-mult-triple': {
    label: 'Forgot to add back the numbers divisible by all three',
    fix: 'With three lists: sum $-$ pair overlaps $+$ triple overlap. A multiple of all three is counted three times and removed three times by the pair overlaps, so add it back once.',
  },
  'prob-mult-one-set': {
    label: 'Counted only one of the lists',
    fix: 'The question names several divisors. Count the multiples of each, then combine them with the overlaps.',
  },
};

type Kind = 'either' | 'neither' | 'exactly-one';

interface MultParams {
  kind: Kind;
  ds: number[];
  lo: number;
  hi: number;
  values: number[];
}

const PAIRS_COPRIME: [number, number][] = [[2, 3], [3, 5], [4, 5], [2, 5], [3, 7], [5, 7], [4, 7], [3, 8], [2, 7], [3, 4], [5, 6], [2, 9], [5, 8], [4, 9], [3, 10], [7, 8]];
const PAIRS_COMMON: [number, number][] = [[4, 6], [6, 9], [6, 10], [4, 10], [6, 15], [10, 15], [8, 12], [9, 12], [6, 8], [10, 12], [12, 18], [14, 21]];
const TRIPLES: [number, number, number][] = [[2, 3, 5], [3, 4, 5], [2, 3, 7], [2, 5, 7], [3, 5, 7], [4, 6, 9], [2, 4, 5], [6, 10, 15], [3, 4, 6]];

const prod = (xs: number[]) => xs.reduce((p, x) => p * x, 1);

/** All non-empty subsets of the divisors of the given size. */
function subsets(ds: number[], size: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === size) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < ds.length; i++) rec(i + 1, [...cur, ds[i]]);
  };
  rec(0, []);
  return out;
}

/** Number of integers in the range that are in the stated region, with a given way of counting and combining. */
function region(kind: Kind, ds: number[], total: number, count: (m: number) => number, join: (xs: number[]) => number): number {
  // inclusion-exclusion over the union
  let union = 0;
  for (let s = 1; s <= ds.length; s++) for (const sub of subsets(ds, s)) union += (s % 2 ? 1 : -1) * count(join(sub));
  if (kind === 'either') return union;
  if (kind === 'neither') return total - union;
  // exactly one (two lists): a + b - 2 * overlap
  return count(ds[0]) + count(ds[1]) - 2 * count(join(ds));
}

const multiples: Template<MultParams> = {
  id: 'data.sets.multiples-count',
  skill: 'data.sets',
  format: 'mcs',
  style: 'count integers in a range that are multiples of one number, another, both or neither (two or three divisors)',
  generate(rng, d) {
    for (;;) {
      const three = d === 3 && rng.chance(0.65);
      const ds: number[] = three ? [...rng.pick(TRIPLES)] : [...rng.pick(d === 1 ? PAIRS_COPRIME : d === 2 ? [...PAIRS_COMMON, ...PAIRS_COMMON, ...PAIRS_COPRIME] : PAIRS_COMMON)];
      const kind: Kind = three ? rng.pick(['either', 'neither']) : d === 1 ? rng.pick(['either', 'neither']) : rng.pick(['either', 'neither', 'exactly-one']);
      const inRange = d >= 2 && (d === 3 || rng.chance(0.4));
      const lo = inRange ? rng.int(2, 30) * 5 + 1 : 1;
      const hi = d === 1 ? rng.int(12, 40) * 5 : rng.int(Math.max(lo + 80, 100), 500);
      if (hi > 500) continue;
      const total = hi - lo + 1;
      const C = (m: number) => Math.floor(hi / m) - Math.floor((lo - 1) / m);
      const Cceil = (m: number) => Math.ceil(hi / m) - Math.floor((lo - 1) / m);
      const Cfrom1 = (m: number) => Math.floor(hi / m);
      const key = region(kind, ds, total, C, lcmAll);
      if (key < 8 || C(lcmAll(ds)) < 2 || C(lcmAll(ds.slice(0, 2))) < 2) continue;
      const sumC = ds.reduce((a, m) => a + C(m), 0);
      const pairs = subsets(ds, 2).reduce((a, p) => a + C(lcmAll(p)), 0);
      const traps: { value: number; trap: string; must?: boolean }[] = [];
      const noOverlap = kind === 'neither' ? total - sumC : sumC;
      traps.push({ value: noOverlap, trap: 'prob-mult-no-overlap', must: true });
      if (ds.some((_, i) => ds.some((__, j) => j > i && lcm(ds[i], ds[j]) !== ds[i] * ds[j]))) traps.push({ value: region(kind, ds, total, C, prod), trap: 'prob-mult-product-overlap' });
      traps.push({ value: region(kind, ds, total, Cceil, lcmAll), trap: 'prob-mult-round-up' });
      if (lo > 1) traps.push({ value: region(kind, ds, total, Cfrom1, lcmAll), trap: 'prob-mult-range-start' });
      traps.push({ value: kind === 'either' ? total - key : kind === 'neither' ? total - key : region('either', ds, total, C, lcmAll), trap: 'prob-mult-wrong-region' });
      if (ds.length === 3) traps.push({ value: kind === 'neither' ? total - (sumC - pairs) : sumC - pairs, trap: 'prob-mult-triple' });
      traps.push({ value: kind === 'neither' ? total - C(ds[0]) : C(ds[0]), trap: 'prob-mult-one-set' });
      const built = trapOnlyChoices(rng, key, rng.shuffle(traps).sort((x, y) => Number(!!y.must) - Number(!!x.must)), (v: Frac) => `$${v.n}$`, 5, 0, true);
      if (!built) continue;
      if (!built.used.some((u) => u.must)) continue;

      const ask =
        kind === 'either'
          ? ds.length === 2
            ? `are multiples of ${ds[0]}, ${ds[1]}, or both`
            : `are multiples of at least one of ${ds[0]}, ${ds[1]}, and ${ds[2]}`
          : kind === 'neither'
            ? ds.length === 2
              ? `are multiples of neither ${ds[0]} nor ${ds[1]}`
              : `are not multiples of any of ${ds[0]}, ${ds[1]}, and ${ds[2]}`
            : `are multiples of exactly one of ${ds[0]} and ${ds[1]}`;
      const range = lo === 1 ? `from 1 to ${hi}, inclusive` : `from ${lo} to ${hi}, inclusive`;
      const stem = `How many of the integers ${range}, ${ask}?`;

      const cnt = (m: number) => (lo === 1 ? `\\left\\lfloor \\dfrac{${hi}}{${m}} \\right\\rfloor = ${C(m)}` : `\\left\\lfloor \\dfrac{${hi}}{${m}} \\right\\rfloor - \\left\\lfloor \\dfrac{${lo - 1}}{${m}} \\right\\rfloor = ${C(m)}`);
      const lines = ds.map((m) => `- Multiples of ${m}: $${cnt(m)}$.`);
      const pairLines = subsets(ds, 2).map((p) => `- Multiples of both ${p[0]} and ${p[1]}, that is, of ${lcmAll(p)}: $${C(lcmAll(p))}$.`);
      const tripleLine = ds.length === 3 ? [`- Multiples of all three, that is, of ${lcmAll(ds)}: $${C(lcmAll(ds))}$.`] : [];
      const union = region('either', ds, total, C, lcmAll);
      const combine =
        ds.length === 2
          ? `Together: $${C(ds[0])} + ${C(ds[1])} - ${C(lcmAll(ds))} = ${union}$ multiples of ${ds[0]} or ${ds[1]}.`
          : `Together: $${sumC} - ${pairs} + ${C(lcmAll(ds))} = ${union}$ multiples of at least one.`;
      const last =
        kind === 'either'
          ? ''
          : kind === 'neither'
            ? ` The integers in neither list are $${total} - ${union} = ${key}$.`
            : ` Exactly one list: $${C(ds[0])} + ${C(ds[1])} - 2(${C(lcmAll(ds))}) = ${key}$, because the overlap is in both lists.`;
      const cited = built.used.find((u) => u.must)!;
      const trapLine =
        kind === 'neither'
          ? `Trap: subtracting only the individual counts, without adding back the overlap, gives $${cited.value}$.`
          : `Trap: adding the counts without removing the overlap gives $${cited.value}$, since the multiples of ${lcmAll(ds.slice(0, 2))} are in two lists.`;
      return {
        params: { kind, ds, lo, hi, values: built.values.map((v) => v.toNumber()) },
        q: {
          format: 'mcs',
          stem,
          choices: built.choices,
          answer: built.answer,
          explanation: `Recognize: the multiples of each number overlap, so count by lists and fix the overlap.\n\n${[...lines, ...pairLines, ...tripleLine].join('\n')}\n\n${combine}${last}\n\n${trapLine}\n\nCount each list with a quotient rounded down; combine with the overlaps.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    let expected = 0;
    for (let n = p.lo; n <= p.hi; n++) {
      const hits = p.ds.filter((m) => n % m === 0).length;
      if (p.kind === 'either' ? hits >= 1 : p.kind === 'neither' ? hits === 0 : hits === 1) expected++;
    }
    const got = Number(q.choices[q.answer]?.text.replace(/[$,{}]/g, ''));
    return got === expected ? null : `expected ${expected}, keyed ${got}`;
  },
};

export const setsMultiplesTemplates: Template<any>[] = [multiples];
