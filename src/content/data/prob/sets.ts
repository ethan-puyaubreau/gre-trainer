import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { frac, Frac } from '../../../engine/frac';
import { sum } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { GeometryFigure, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { mcmCheck, mcsCheck, neCheck, trapOnlyChoices } from './util';

const SKILL = 'data.sets';
const rel = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');

interface TwoCtx {
  pop: (n: string) => string;
  unit: string;
  A: string;
  B: string;
  both: string;
  neither: string;
  onlyA: string;
  exactlyOne: string;
  /** Short names for Venn diagrams. */
  nameA: string;
  nameB: string;
}

const TWO_CTX: TwoCtx[] = [
  { pop: (n) => `Of the ${n} employees at a company`, unit: 'employees', A: 'speak French', B: 'speak Spanish', both: 'speak both French and Spanish', neither: 'speak neither language', onlyA: 'speak French but not Spanish', exactlyOne: 'speak exactly one of the two languages', nameA: 'French', nameB: 'Spanish' },
  { pop: (n) => `Of the ${n} students in a graduating class`, unit: 'students', A: 'took biology', B: 'took chemistry', both: 'took both biology and chemistry', neither: 'took neither subject', onlyA: 'took biology but not chemistry', exactlyOne: 'took exactly one of the two subjects', nameA: 'Biology', nameB: 'Chemistry' },
  { pop: (n) => `Of the ${n} households surveyed in a town`, unit: 'households', A: 'own a dog', B: 'own a cat', both: 'own both a dog and a cat', neither: 'own neither a dog nor a cat', onlyA: 'own a dog but not a cat', exactlyOne: 'own exactly one of the two kinds of pets', nameA: 'Dog', nameB: 'Cat' },
  { pop: (n) => `Of the ${n} members of a sports club`, unit: 'members', A: 'play tennis', B: 'play golf', both: 'play both tennis and golf', neither: 'play neither sport', onlyA: 'play tennis but not golf', exactlyOne: 'play exactly one of the two sports', nameA: 'Tennis', nameB: 'Golf' },
];

/** Region counts of a two-set population: [only A, only B, both, neither]. */
type Regions2 = [number, number, number, number];

/** Expand regions into members (flags inA, inB) so checks can count directly. */
function members2(r: Regions2): [boolean, boolean][] {
  const out: [boolean, boolean][] = [];
  const push = (n: number, a: boolean, b: boolean) => {
    for (let i = 0; i < n; i++) out.push([a, b]);
  };
  push(r[0], true, false);
  push(r[1], false, true);
  push(r[2], true, true);
  push(r[3], false, false);
  return out;
}

/* ================================================================== 1. Two-set (and three-set) counts (NE) */

type CountKind = 'both' | 'neither' | 'only' | 'exactly-one' | 'percent' | 'lists' | 'three-exactly' | 'three-pairwise';
interface CountParams {
  kind: CountKind;
  regions: number[];
  /** Total population when percents are used (regions are then percents). */
  N: number;
  /** Lists (DA-13): R starts at r0 with m terms, T starts at t0 with n terms. */
  r0: number;
  m: number;
  t0: number;
  n: number;
}

/** 3-set regions: [a, b, c, ab, ac, bc, abc, none] (a = only A, ab = A and B but not C...). */
const IN3: [boolean, boolean, boolean][] = [
  [true, false, false],
  [false, true, false],
  [false, false, true],
  [true, true, false],
  [true, false, true],
  [false, true, true],
  [true, true, true],
  [false, false, false],
];

const THREE_CTX = [
  { pop: (n: number) => `Each of the ${n} students in a program was asked which of three languages, French, Spanish, and German, they study.`, sets: ['French', 'Spanish', 'German'], verb: 'study', unit: 'students', none: 'study none of the three languages' },
  { pop: (n: number) => `A survey asked ${n} people which of three streaming services, X, Y, and Z, they subscribe to.`, sets: ['service X', 'service Y', 'service Z'], verb: 'subscribe to', unit: 'people', none: 'subscribe to none of the three services' },
  { pop: (n: number) => `At a conference, each of the ${n} attendees could attend any of three workshops: P, Q, and R.`, sets: ['workshop P', 'workshop Q', 'workshop R'], verb: 'attended', unit: 'attendees', none: 'attended none of the three workshops' },
];

const twoSetCount: Template<CountParams> = {
  id: 'data.sets.two-set-count',
  skill: SKILL,
  format: 'ne',
  style: 'overlapping groups: both, neither, exactly one (three groups at the hardest level)',
  generate(rng, d) {
    const kind: CountKind = rng.pick(
      d === 1 ? (['both', 'neither', 'both'] as const) : d === 2 ? (['only', 'exactly-one', 'percent', 'lists'] as const) : (['three-exactly', 'three-pairwise', 'three-exactly'] as const),
    );
    const p: CountParams = { kind, regions: [], N: 0, r0: 0, m: 0, t0: 0, n: 0 };
    let stem = '';
    let answer = 0;
    let suffix: string | undefined;
    const traps: { value: Frac; trap: string }[] = [];
    let explanation = '';
    if (kind === 'lists') {
      p.m = rng.pick([7, 9, 11, 13, 15]);
      p.r0 = rng.int(-10, 40);
      const anchor = rng.pick(['median-least', 'greatest-median'] as const);
      if (anchor === 'median-least') {
        p.n = rng.int((p.m + 1) / 2 + 1, p.m + 8);
        p.t0 = p.r0 + (p.m - 1) / 2;
      } else {
        p.n = rng.pick([5, 7, 9, 11, 13].filter((x) => (x + 1) / 2 < p.m));
        p.t0 = p.r0 + p.m - 1 - (p.n - 1) / 2;
      }
      const overlap = anchor === 'median-least' ? (p.m + 1) / 2 : (p.n + 1) / 2;
      answer = p.m + p.n - overlap;
      const anchorText = anchor === 'median-least' ? 'The median of list R equals the smallest integer in list T.' : 'The greatest integer in list R is equal to the median of the integers in list T.';
      stem = `List R consists of ${p.m} consecutive integers, and list T consists of ${p.n} consecutive integers. ${anchorText} How many different integers are in list R or list T or both?`;
      traps.push({ value: frac(p.m + p.n), trap: 'prob-venn-no-overlap' }, { value: frac(answer + 1), trap: 'prob-overlap-off-by-one' }, { value: frac(answer - 1), trap: 'prob-overlap-off-by-one' });
      explanation =
        anchor === 'median-least'
          ? `The median of ${p.m} consecutive integers is the middle one, so it and the $${(p.m - 1) / 2}$ integers above it, $${(p.m + 1) / 2}$ integers in all, are the top of list R. List T starts at the median and is longer than that, so those $${overlap}$ integers are in both lists.

Different integers: $${p.m} + ${p.n} - ${overlap} = ${answer}$. Adding $${p.m} + ${p.n}$ counts the shared integers twice.`
          : `The median of the ${p.n} integers in T is the middle one: it and the $${(p.n - 1) / 2}$ integers below it, $${overlap}$ integers in all, form the bottom of list T. They end at the greatest integer of R, and R is longer than that, so those $${overlap}$ integers are in both lists.

Different integers: $${p.m} + ${p.n} - ${overlap} = ${answer}$. Adding $${p.m} + ${p.n}$ counts the shared integers twice.`;
    } else if (kind === 'three-exactly' || kind === 'three-pairwise') {
      const ctx = rng.pick(THREE_CTX);
      const r = [rng.int(8, 30), rng.int(8, 30), rng.int(8, 30), rng.int(2, 12), rng.int(2, 12), rng.int(2, 12), rng.int(2, 8), rng.int(3, 20)];
      p.regions = r;
      const N = sum(r);
      const sizes = [0, 1, 2].map((s) => sum(r.filter((_, i) => IN3[i][s])));
      const T = r[6];
      const S = sum(sizes);
      const none = r[7];
      answer = none;
      suffix = ctx.unit;
      const setList = `${sizes[0]} ${ctx.verb} ${ctx.sets[0]}, ${sizes[1]} ${ctx.verb} ${ctx.sets[1]}, and ${sizes[2]} ${ctx.verb} ${ctx.sets[2]}`;
      if (kind === 'three-exactly') {
        const E2 = r[3] + r[4] + r[5];
        stem = `${ctx.pop(N)} Of them, ${setList}. Also, ${E2} ${ctx.verb} exactly two of the three, and ${T} ${ctx.verb} all three. How many of the ${N} ${ctx.unit} ${ctx.none}?`;
        traps.push({ value: frac(N - (S - E2 - T)), trap: 'prob-venn-triple' }, { value: frac(N - (S - E2 + T)), trap: 'prob-venn-exactly-two' }, { value: frac(N - (S - E2)), trap: 'prob-venn-triple' });
        explanation = `Adding the three totals counts everyone in exactly two groups twice and everyone in all three groups three times. So the number in at least one group is $${sizes.join(' + ')} - ${E2} - 2(${T}) = ${S - E2 - 2 * T}$.

None of the three: $${N} - ${S - E2 - 2 * T} = ${answer}$.

Subtracting the ${T} only once leaves them counted twice.`;
      } else {
        const AB = r[3] + T;
        const AC = r[4] + T;
        const BC = r[5] + T;
        const sx = ctx.sets;
        stem = `${ctx.pop(N)} Of them, ${setList}. Also, ${AB} ${ctx.verb} both ${sx[0]} and ${sx[1]}, ${AC} ${ctx.verb} both ${sx[0]} and ${sx[2]}, ${BC} ${ctx.verb} both ${sx[1]} and ${sx[2]}, and ${T} ${ctx.verb} all three. How many of the ${N} ${ctx.unit} ${ctx.none}?`;
        traps.push({ value: frac(N - (S - AB - AC - BC)), trap: 'prob-venn-triple' }, { value: frac(N - (S - AB - AC - BC + 2 * T)), trap: 'prob-venn-triple' });
        explanation = `Inclusion–exclusion: at least one $= ${sizes.join(' + ')} - ${AB} - ${AC} - ${BC} + ${T} = ${S - AB - AC - BC + T}$. (Each pairwise count includes the ${T} in all three groups, so subtracting the three pairs removes them three times; adding ${T} back counts them exactly once.)

None of the three: $${N} - ${S - AB - AC - BC + T} = ${answer}$.

Forgetting to add back the ${T} gives $${N - (S - AB - AC - BC)}$.`;
      }
    } else {
      const ctx = rng.pick(TWO_CTX);
      if (kind === 'percent') {
        // Regions as percents; N a multiple of 20 so every count is an integer.
        let r: Regions2;
        do {
          r = [rng.int(2, 12) * 5, rng.int(2, 10) * 5, rng.int(1, 6) * 5, 0];
          r[3] = 100 - r[0] - r[1] - r[2];
        } while (r[3] < 5);
        p.regions = r;
        p.N = rng.pick([200, 300, 400, 500, 600, 800, 1200]);
        const pa = r[0] + r[2];
        const pb = r[1] + r[2];
        answer = (r[2] * p.N) / 100;
        suffix = ctx.unit;
        stem = `${ctx.pop(p.N.toLocaleString('en-US'))}, ${pa} percent ${ctx.A}, ${pb} percent ${ctx.B}, and ${r[3]} percent ${ctx.neither}. How many of the ${ctx.unit} ${ctx.both}?`;
        traps.push({ value: frac(r[2]), trap: 'prob-percent-not-count' });
        const noNeither = pa + pb - 100;
        if (noNeither > 0) traps.push({ value: frac(noNeither * p.N, 100), trap: 'prob-venn-forgot-neither' });
        explanation = `Work in percents. At least one: $100 - ${r[3]} = ${100 - r[3]}$ percent. Both: $${pa} + ${pb} - ${100 - r[3]} = ${r[2]}$ percent. Number: $${r[2]}\\%$ of $${num(p.N)}$ is $${num(answer)}$.

${r[2]} is the percent, not the number of ${ctx.unit}.`;
      } else {
        const r: Regions2 = [rng.int(5, 40), rng.int(5, 40), rng.int(3, 25), rng.int(2, 25)];
        p.regions = r;
        const N = sum(r);
        const a = r[0] + r[2];
        const b = r[1] + r[2];
        suffix = ctx.unit;
        if (kind === 'both') {
          answer = r[2];
          stem = `${ctx.pop(`${N}`)}, ${a} ${ctx.A}, ${b} ${ctx.B}, and ${r[3]} ${ctx.neither}. How many of the ${ctx.unit} ${ctx.both}?`;
          traps.push({ value: frac(a + b - N), trap: 'prob-venn-forgot-neither' });
          explanation = `Total = (${ctx.nameA}) + (${ctx.nameB}) $-$ (both) + (neither): $${N} = ${a} + ${b} - x + ${r[3]}$, so $x = ${a} + ${b} + ${r[3]} - ${N} = ${answer}$.

Leaving out the ${r[3]} who ${ctx.neither} gives $${a + b - N}$.`;
        } else if (kind === 'neither') {
          answer = r[3];
          stem = `${ctx.pop(`${N}`)}, ${a} ${ctx.A}, ${b} ${ctx.B}, and ${r[2]} ${ctx.both}. How many of the ${ctx.unit} ${ctx.neither}?`;
          traps.push({ value: frac(N - a - b), trap: 'prob-venn-no-overlap' });
          explanation = `At least one: $${a} + ${b} - ${r[2]} = ${a + b - r[2]}$ (the ${r[2]} in both were counted twice). Neither: $${N} - ${a + b - r[2]} = ${answer}$.

$${N} - ${a} - ${b}$ forgets that the ${r[2]} in both groups were counted twice.`;
          if (N - a - b <= 0) traps.pop();
        } else if (kind === 'only') {
          answer = r[0];
          stem = `${ctx.pop(`${N}`)}, ${a} ${ctx.A}, ${b} ${ctx.B}, and ${r[3]} ${ctx.neither}. How many of the ${ctx.unit} ${ctx.onlyA}?`;
          traps.push({ value: frac(a), trap: 'prob-venn-only' }, { value: frac(N - r[3] - b - r[2]), trap: 'prob-venn-only' });
          explanation = `First the overlap: both $= ${a} + ${b} + ${r[3]} - ${N} = ${r[2]}$. Then only ${ctx.nameA}: $${a} - ${r[2]} = ${answer}$.

$${a}$ includes the ${r[2]} who are in both groups.`;
        } else {
          answer = r[0] + r[1];
          stem = `${ctx.pop(`${N}`)}, ${a} ${ctx.A}, ${b} ${ctx.B}, and ${r[3]} ${ctx.neither}. How many of the ${ctx.unit} ${ctx.exactlyOne}?`;
          traps.push({ value: frac(N - r[3]), trap: 'prob-venn-only' }, { value: frac(a + b), trap: 'prob-venn-no-overlap' });
          explanation = `Both: $${a} + ${b} + ${r[3]} - ${N} = ${r[2]}$. Exactly one = at least one minus both: $(${N} - ${r[3]}) - ${r[2]} = ${answer}$. (Or: $${a} + ${b} - 2(${r[2]}) = ${answer}$.)

$${N - r[3]}$ is the number in at least one group, which still includes the ${r[2]} in both.`;
        }
      }
    }
    // a mistake that gives the answer is not a mistake: draw again
    if (traps.some((t) => t.value.eq(answer))) return twoSetCount.generate(rng, d);
    return {
      params: p,
      q: {
        format: 'ne',
        stem,
        answer: frac(answer),
        ...(suffix ? { suffix } : {}),
        traps: traps.filter((t) => t.value.sign() > 0).filter((t, i, arr) => arr.findIndex((x) => x.value.eq(t.value)) === i),
        explanation,
      },
    };
  },
  check(q, p) {
    let expected: number;
    if (p.kind === 'lists') {
      const all = new Set<number>();
      for (let i = 0; i < p.m; i++) all.add(p.r0 + i);
      for (let i = 0; i < p.n; i++) all.add(p.t0 + i);
      expected = all.size;
    } else if (p.kind === 'three-exactly' || p.kind === 'three-pairwise') {
      const people: [boolean, boolean, boolean][] = [];
      p.regions.forEach((n, i) => {
        for (let k = 0; k < n; k++) people.push(IN3[i]);
      });
      expected = people.filter((x) => !x[0] && !x[1] && !x[2]).length;
    } else {
      const people = members2(p.regions as Regions2);
      const scale = p.kind === 'percent' ? p.N / 100 : 1;
      const count = (f: (m: [boolean, boolean]) => boolean) => people.filter(f).length * scale;
      expected =
        p.kind === 'both' || p.kind === 'percent'
          ? count(([a, b]) => a && b)
          : p.kind === 'neither'
            ? count(([a, b]) => !a && !b)
            : p.kind === 'only'
              ? count(([a, b]) => a && !b)
              : count(([a, b]) => a !== b);
    }
    return neCheck(q, frac(expected));
  },
};

/* ================================================================== 2. Possible sizes of an overlap (MCM) */

interface RangeParams {
  ask: 'both' | 'neither' | 'difference';
  N: number;
  a: number;
  b: number;
  /** both: at least this many in neither. difference: at least this many members of A are not in B. */
  extra: number;
  values: number[];
}

/** Every feasible [onlyA, onlyB, both, neither] for the constraints, by enumeration. */
function feasible2(N: number, a: number, b: number, minNeither: number): Regions2[] {
  const out: Regions2[] = [];
  for (let both = 0; both <= N; both++)
    for (let neither = 0; neither <= N; neither++) {
      const oa = a - both;
      const ob = b - both;
      if (oa < 0 || ob < 0) continue;
      if (oa + ob + both + neither !== N) continue;
      if (neither < minNeither) continue;
      out.push([oa, ob, both, neither]);
    }
  return out;
}

const overlapRange: Template<RangeParams> = {
  id: 'data.sets.overlap-range',
  skill: SKILL,
  format: 'mcm',
  style: 'which numbers could be the overlap, the neither group, or a set difference',
  generate(rng, d) {
    const ask: RangeParams['ask'] = d === 1 ? 'both' : d === 2 ? rng.pick(['both', 'neither'] as const) : rng.pick(['difference', 'both'] as const);
    const ctx = rng.pick(TWO_CTX);
    const p: RangeParams = { ask, N: 0, a: 0, b: 0, extra: 0, values: [] };
    let lo: number;
    let hi: number;
    let stem: string;
    let explanation: string;
    let belowTrap: string;
    let aboveTrap: string;
    if (ask === 'difference') {
      p.a = rng.int(8, 25);
      p.b = p.a + rng.int(3, 20);
      p.extra = rng.int(2, p.a - 3);
      lo = p.b - p.a + p.extra;
      hi = p.b;
      stem = `There are ${p.a} members in set $A$ and ${p.b} in set $B$, and at least ${p.extra} members of $A$ do not belong to $B$. Which of the following could be the number of members of $B$ that are not members of $A$?`;
      explanation = `Members of $B$ not in $A$ $= ${p.b} - (\\text{members in both})$. At least ${p.extra} members of $A$ are outside $B$, so at most $${p.a} - ${p.extra} = ${p.a - p.extra}$ are in both, and at least 0 are. So the count is from $${p.b} - ${p.a - p.extra} = ${lo}$ up to $${p.b} - 0 = ${hi}$, inclusive.

$${p.b - p.a}$ ignores the condition on the ${p.extra} members of $A$ outside $B$.`;
      belowTrap = 'prob-ignored-restriction';
      aboveTrap = 'prob-venn-max';
    } else {
      p.N = rng.pick([40, 50, 60, 80, 100, 120]);
      do {
        p.a = rng.int(Math.round(p.N * 0.4), Math.round(p.N * 0.8));
        p.b = rng.int(Math.round(p.N * 0.3), Math.round(p.N * 0.75));
      } while (p.a === p.b || p.a + p.b <= p.N + 3);
      p.extra = ask === 'both' && d >= 2 && rng.chance(0.5) ? rng.int(2, Math.min(8, p.N - Math.max(p.a, p.b) - 1)) : 0;
      if (p.extra < 0) p.extra = 0;
      const pop = ctx.pop(`${p.N}`);
      if (ask === 'both') {
        lo = Math.max(0, p.a + p.b - p.N + p.extra);
        hi = Math.min(p.a, p.b);
        stem = `${pop}, ${p.a} ${ctx.A} and ${p.b} ${ctx.B}.${p.extra ? ` At least ${p.extra} of the ${ctx.unit} ${ctx.neither}.` : ''} Which of the following could be the number of ${ctx.unit} ${ctx.unit === 'households' ? 'that' : 'who'} ${ctx.both}?`;
        explanation = `Least overlap: ${p.extra ? `at most $${p.N} - ${p.extra} = ${p.N - p.extra}$ ${ctx.unit} are in at least one group, so` : `at most ${p.N} ${ctx.unit} are in at least one group, so`} at least $${p.a} + ${p.b} - ${p.N - p.extra} = ${lo}$ must be in both. Greatest overlap: everyone in the smaller group is also in the larger one, $${hi}$. Every whole number from ${lo} to ${hi} is possible.

The overlap cannot be ${lo > 0 ? 'less than ' + lo + ' (the two groups do not fit in the total otherwise) and cannot be' : ''} more than ${hi}.`;
        belowTrap = 'prob-venn-min-zero';
        aboveTrap = 'prob-venn-max';
      } else {
        lo = Math.max(0, p.N - p.a - p.b);
        hi = p.N - Math.max(p.a, p.b);
        stem = `${pop}, ${p.a} ${ctx.A} and ${p.b} ${ctx.B}. Which of the following could be the number of ${ctx.unit} ${ctx.unit === 'households' ? 'that' : 'who'} ${ctx.neither}?`;
        explanation = `Neither $= ${p.N} - (\\text{at least one})$, and at least one $= ${p.a} + ${p.b} - (\\text{both})$. The overlap can be from $${p.a} + ${p.b} - ${p.N} = ${p.a + p.b - p.N}$ to $${Math.min(p.a, p.b)}$, so at least one is from $${Math.max(p.a, p.b)}$ to $${p.N}$, and neither is from $${lo}$ to $${hi}$, inclusive.

Neither cannot exceed $${p.N} - ${Math.max(p.a, p.b)} = ${hi}$, because all ${Math.max(p.a, p.b)} in the larger group are in at least one group.`;
        belowTrap = 'prob-venn-forgot-neither';
        aboveTrap = 'prob-venn-max';
      }
    }
    // Choices: 2-4 inside [lo, hi], 1-2 below, 1-2 above, ascending.
    const span = hi - lo;
    const inside = new Set<number>([lo + rng.int(0, Math.max(0, Math.floor(span / 3)))]);
    if (rng.chance(0.5)) inside.add(hi);
    if (rng.chance(0.5)) inside.add(lo);
    while (inside.size < Math.min(span + 1, rng.int(2, 4))) inside.add(rng.int(lo, hi));
    const vals: { v: number; trap?: string }[] = [...inside].map((v) => ({ v }));
    const belowCands = [lo - rng.int(1, 3), ask === 'difference' ? p.b - p.a : 0, lo - rng.int(4, 8)].filter((v) => v >= 0 && v < lo);
    for (const v of rng.shuffle(belowCands).slice(0, rng.int(1, 2))) if (!vals.some((x) => x.v === v)) vals.push({ v, trap: belowTrap });
    const aboveCands = [hi + rng.int(1, 3), hi + rng.int(4, 9)];
    for (const v of aboveCands.slice(0, rng.int(1, 2))) if (!vals.some((x) => x.v === v)) vals.push({ v, trap: aboveTrap });
    if (ask === 'difference' && !vals.some((x) => x.v === p.b - p.a)) vals.push({ v: p.b - p.a, trap: 'prob-ignored-restriction' });
    for (let extra = 1; vals.length < 5 && extra < 40; extra++) {
      const v = extra % 2 ? hi + 3 + extra : lo + Math.floor((extra * span) / 7);
      if (v >= 0 && !vals.some((x) => x.v === v)) vals.push({ v, ...(v > hi ? { trap: aboveTrap } : {}) });
    }
    const sorted = vals.slice(0, 7).sort((x, y) => x.v - y.v);
    p.values = sorted.map((x) => x.v);
    const { choices, answer } = flaggedChoices(sorted.map((x) => ({ text: `$${num(x.v)}$`, correct: x.v >= lo && x.v <= hi, ...(x.trap && (x.v < lo || x.v > hi) ? { trap: x.trap } : {}) })));
    return { params: p, q: { format: 'mcm', stem, instruction: 'Indicate all such numbers.', choices, answer, explanation } };
  },
  check(q, p) {
    let possible: Set<number>;
    if (p.ask === 'difference') {
      // A has a members, B has b; enumerate the overlap and keep it when at least `extra` of A are outside B.
      possible = new Set();
      for (let both = 0; both <= Math.min(p.a, p.b); both++) if (p.a - both >= p.extra) possible.add(p.b - both);
    } else {
      const regs = feasible2(p.N, p.a, p.b, p.ask === 'both' ? p.extra : 0);
      possible = new Set(regs.map((r) => (p.ask === 'both' ? r[2] : r[3])));
    }
    return mcmCheck(q, p.values.map((v) => possible.has(v)));
  },
};

/* ================================================================== 3. Overlap comparisons (QC) */

interface OverlapQCParams {
  kind: 'both-vs-k' | 'determined' | 'least' | 'neither-vs-both';
  N: number;
  a: number;
  b: number;
  neither: number;
  k: number;
}

const overlapQC: Template<OverlapQCParams> = {
  id: 'data.sets.overlap-qc',
  skill: SKILL,
  format: 'qc',
  style: 'compare an overlap with a number: determined, bounded, or not determined',
  generate(rng, d) {
    const kind: OverlapQCParams['kind'] = rng.pick(
      d === 1 ? (['determined', 'both-vs-k', 'least'] as const) : d === 2 ? (['both-vs-k', 'both-vs-k', 'least', 'neither-vs-both', 'determined'] as const) : (['both-vs-k', 'neither-vs-both', 'least'] as const),
    );
    const ctx = rng.pick(TWO_CTX);
    const p: OverlapQCParams = { kind, N: rng.pick([50, 60, 80, 100, 120, 150]), a: 0, b: 0, neither: -1, k: 0 };
    const wantOverlap = kind === 'neither-vs-both' ? rng.pick(['over', 'under', 'equal'] as const) : 'over';
    do {
      p.a = rng.int(Math.round(p.N * 0.3), Math.round(p.N * 0.8));
      p.b = rng.int(Math.round(p.N * 0.25), Math.round(p.N * 0.75));
      if (wantOverlap === 'equal') p.b = p.N - p.a;
    } while (p.a === p.b || (wantOverlap === 'over' && p.a + p.b <= p.N + 2) || (wantOverlap === 'under' && p.a + p.b >= p.N - 2) || p.b <= 0);
    const lo = Math.max(0, p.a + p.b - p.N);
    const hi = Math.min(p.a, p.b);
    let info = `${ctx.pop(`${p.N}`)}, ${p.a} ${ctx.A} and ${p.b} ${ctx.B}.`;
    let qa = `The number of the ${p.N} ${ctx.unit} ${ctx.unit === 'households' ? 'that' : 'who'} ${ctx.both}`;
    let qb = '';
    let answer: QCChoice;
    let traps: QCQuestion['traps'];
    let explanation = '';
    if (kind === 'determined') {
      const both = rng.int(Math.max(lo, 1), hi - 1);
      p.neither = p.N - (p.a + p.b - both);
      info = `${ctx.pop(`${p.N}`)}, ${p.a} ${ctx.A}, ${p.b} ${ctx.B}, and ${p.neither} ${ctx.neither}.`;
      const wrong = p.a + p.b - p.N;
      const roll = rng.next();
      p.k = roll < 0.35 ? both : roll < 0.55 && wrong > 0 && wrong !== both ? wrong : both + rng.pick([-3, -2, 2, 3]);
      qb = `$${p.k}$`;
      answer = qcCompare(both, p.k);
      const t = qcCompare(wrong, p.k);
      if (t !== answer) traps = { [t]: 'prob-venn-forgot-neither' };
      explanation = `Total = ${ctx.nameA} + ${ctx.nameB} $-$ both + neither: $${p.N} = ${p.a} + ${p.b} - x + ${p.neither}$, so $x = ${both}$. Compare with ${p.k}: ${rel(answer)}. (${answer})`;
    } else if (kind === 'least') {
      qa = `The least possible number of the ${p.N} ${ctx.unit} ${ctx.unit === 'households' ? 'that' : 'who'} ${ctx.both}`;
      const roll = rng.next();
      p.k = roll < 0.35 ? lo : lo + rng.pick([-3, -2, -1, 1, 2, 3]);
      if (p.k < 0) p.k = lo + 2;
      qb = `$${p.k}$`;
      answer = qcCompare(lo, p.k);
      const t = qcCompare(0, p.k);
      if (t !== answer) traps = { [t]: 'prob-venn-min-zero' };
      explanation = `The ${p.a} + ${p.b} = ${p.a + p.b} memberships must fit among ${p.N} ${ctx.unit}, so at least $${p.a + p.b} - ${p.N} = ${lo}$ ${ctx.unit} are counted in both groups (and ${lo} is possible: everyone else is in exactly one group). Compare ${lo} with ${p.k}: ${rel(answer)}. (${answer})`;
    } else if (kind === 'neither-vs-both') {
      qb = `The number of the ${p.N} ${ctx.unit} ${ctx.unit === 'households' ? 'that' : 'who'} ${ctx.neither}`;
      // neither - both = N - a - b for every possible overlap
      const diff = p.N - p.a - p.b;
      answer = diff > 0 ? 'B' : diff < 0 ? 'A' : 'C';
      traps = { D: 'prob-venn-difference-fixed' };
      explanation = `Neither $= ${p.N} - (${p.a} + ${p.b} - \\text{both})$, so neither $-$ both $= ${p.N} - ${p.a} - ${p.b} = ${diff}$ no matter how large the overlap is. ${
        diff > 0 ? `The neither group is always ${diff} larger. (B)` : diff < 0 ? `The overlap is always ${-diff} larger. (A)` : 'They are always equal. (C)'
      }

The overlap itself is unknown, but the comparison does not depend on it.`;
    } else {
      const roll = rng.next();
      p.k = roll < 0.45 ? rng.int(lo + 1, hi - 1) : roll < 0.6 ? lo : roll < 0.8 ? Math.max(0, lo - rng.int(1, 6)) : hi + rng.int(1, 5);
      if (p.k === lo && lo === 0) p.k = rng.int(1, hi - 1);
      qb = `$${p.k}$`;
      answer = p.k < lo ? 'A' : p.k > hi ? 'B' : 'D';
      if (answer === 'A') traps = { D: 'prob-venn-min-zero' };
      if (answer === 'D' && p.k === p.a + p.b - p.N) traps = { C: 'prob-venn-forgot-neither' };
      explanation = `The overlap is not determined. It is at least $${p.a} + ${p.b} - ${p.N} = ${lo}$ (otherwise the ${p.a + p.b} memberships would not fit among ${p.N} ${ctx.unit}) and at most ${hi} (the smaller group entirely inside the larger). ${
        answer === 'A' ? `Since every possible value is at least ${lo} > ${p.k}, Quantity A is greater. (A)` : answer === 'B' ? `Since every possible value is at most ${hi} < ${p.k}, Quantity B is greater. (B)` : `${p.k} lies in that range, and so do larger and smaller values. (D)`
      }${answer === 'D' && p.k === lo ? `\n\nThe overlap could be exactly ${lo} (if nobody is in neither group), but it could also be larger.` : ''}`;
    }
    if (traps && traps[answer]) traps = undefined;
    return { params: p, q: { format: 'qc', info, quantityA: qa, quantityB: qb, answer, ...(traps ? { traps } : {}), explanation } };
  },
  check(q, p) {
    const regs = feasible2(p.N, p.a, p.b, 0).filter((r) => p.neither < 0 || r[3] === p.neither);
    let samples: [number, number][];
    if (p.kind === 'least') {
      const least = Math.min(...regs.map((r) => r[2]));
      samples = [[least, p.k]];
    } else if (p.kind === 'neither-vs-both') samples = regs.map((r) => [r[2], r[3]]);
    else samples = regs.map((r) => [r[2], p.k]);
    const expected = qcFromSamples(samples);
    return q.format === 'qc' && q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. Venn diagram figures (MCS) */

type VennAsk = 'in-b' | 'exactly-one' | 'not-a' | 'x-two' | 'circle-totals' | 'exactly-two' | 'in-a3' | 'at-least-two';
interface VennParams {
  sets: 2 | 3;
  regions: number[];
  /** Index of the region shown as x (-1 = none). */
  xAt: number;
  ask: VennAsk;
  total: number;
}

const VENN2 = [
  { names: ['Soccer', 'Tennis'], unit: 'students', pop: 'students in a class', A: 'play soccer', B: 'play tennis' },
  { names: ['French', 'Spanish'], unit: 'employees', pop: 'employees of a company', A: 'speak French', B: 'speak Spanish' },
  { names: ['Laptop', 'Tablet'], unit: 'people', pop: 'people surveyed', A: 'own a laptop', B: 'own a tablet' },
];
const VENN3 = [
  { names: ['Art', 'Music', 'Drama'], unit: 'students', pop: 'students', member: 'students who take' },
  { names: ['X', 'Y', 'Z'], unit: 'shoppers', pop: 'shoppers', member: 'shoppers who visited store' },
];

function vennFigure(sets: 2 | 3, names: string[], texts: string[]): GeometryFigure {
  if (sets === 2) {
    return {
      kind: 'geometry',
      points: { R1: [0, 0], R2: [10, 0], R3: [10, 6.6], R4: [0, 6.6], O1: [3.75, 3.1], O2: [6.25, 3.1] },
      hideLabels: ['R1', 'R2', 'R3', 'R4', 'O1', 'O2'],
      polygons: [{ pts: ['R1', 'R2', 'R3', 'R4'] }],
      circles: [
        { center: 'O1', r: 2.4 },
        { center: 'O2', r: 2.4 },
      ],
      labels: [
        { at: [2.5, 3.1], text: texts[0] },
        { at: [7.5, 3.1], text: texts[1] },
        { at: [5, 3.1], text: texts[2] },
        { at: [9.1, 0.6], text: texts[3] },
        { at: [2.3, 6.05], text: names[0] },
        { at: [7.7, 6.05], text: names[1] },
      ],
    };
  }
  return {
    kind: 'geometry',
    points: { R1: [0, 0], R2: [10, 0], R3: [10, 8.4], R4: [0, 8.4], O1: [3.9, 5.2], O2: [6.1, 5.2], O3: [5, 3.3] },
    hideLabels: ['R1', 'R2', 'R3', 'R4', 'O1', 'O2', 'O3'],
    polygons: [{ pts: ['R1', 'R2', 'R3', 'R4'] }],
    circles: [
      { center: 'O1', r: 2.2 },
      { center: 'O2', r: 2.2 },
      { center: 'O3', r: 2.2 },
    ],
    labels: [
      { at: [2.85, 5.85], text: texts[0] },
      { at: [7.15, 5.85], text: texts[1] },
      { at: [5, 2.0], text: texts[2] },
      { at: [5, 6.35], text: texts[3] },
      { at: [3.8, 3.85], text: texts[4] },
      { at: [6.2, 3.85], text: texts[5] },
      { at: [5, 4.75], text: texts[6] },
      { at: [9.1, 0.6], text: texts[7] },
      { at: [1.4, 7.8], text: names[0] },
      { at: [8.6, 7.8], text: names[1] },
      { at: [2.2, 1.4], text: names[2] },
    ],
  };
}

const vennDiagram: Template<VennParams> = {
  id: 'data.sets.venn-diagram',
  skill: SKILL,
  format: 'mcs',
  style: 'read a Venn diagram (two or three circles, with an unknown region)',
  generate(rng, d) {
    const sets: 2 | 3 = d === 3 ? 3 : 2;
    let regions: number[];
    let xAt = -1;
    let ask: VennAsk;
    let figure: GeometryFigure;
    let stem = '';
    let correct = 0;
    let included: number[] = [];
    let regionNames: string[] = [];
    let explanation = '';
    let total = 0;
    if (sets === 2) {
      const ctx = rng.pick(VENN2);
      regions = [rng.int(8, 40), rng.int(8, 40), rng.int(4, 20), rng.int(3, 18)];
      total = sum(regions);
      const [oa, ob, both, neither] = regions;
      ask = d === 1 ? rng.pick(['in-b', 'exactly-one', 'not-a'] as const) : rng.pick(['x-two', 'circle-totals'] as const);
      let texts = regions.map((r) => `$${r}$`);
      const names = ctx.names;
      regionNames = [`the ${names[0]}-only region`, `the ${names[1]}-only region`, 'the overlap', 'the region outside both circles'];
      if (ask === 'circle-totals') {
        // Book convention: a number next to a circle's name is that circle's total.
        texts = ['', '', '$x$', `$${neither}$`];
        xAt = 2;
        figure = vennFigure(2, [`${names[0]} (${oa + both})`, `${names[1]} (${ob + both})`], texts);
        stem = `In the Venn diagram above, the number next to each circle's label is the total number of ${ctx.unit} in that circle, $x$ is the number of ${ctx.unit} in both circles, and ${neither} ${ctx.unit} are in neither circle. If there are ${total} ${ctx.unit} in all, how many of them are in exactly one of the two circles?`;
        correct = oa + ob;
        included = [0, 1];
        explanation = `Total: $${total} = ${oa + both} + ${ob + both} - x + ${neither}$, so $x = ${both}$. Exactly one: $(${oa + both} - ${both}) + (${ob + both} - ${both}) = ${oa} + ${ob} = ${correct}$.

$${total - neither}$ counts everyone in at least one circle, including the ${both} in both.`;
      } else if (ask === 'x-two') {
        // only A = 2x or x + c, both = x
        const mult = rng.pick([2, 3]);
        const xv = rng.int(4, 12);
        regions = [mult * xv, rng.int(8, 30), xv, rng.int(3, 15)];
        total = sum(regions);
        texts = [`$${mult}x$`, `$${regions[1]}$`, '$x$', `$${regions[3]}$`];
        xAt = 2;
        figure = vennFigure(2, names, texts);
        stem = `The Venn diagram above shows the numbers of ${ctx.unit} in each region. If there are ${total} ${ctx.unit} in all, how many of them ${ctx.A}?`;
        correct = (mult + 1) * xv;
        included = [0, 2];
        explanation = `Add the regions: $${mult}x + x + ${regions[1]} + ${regions[3]} = ${total}$, so $${mult + 1}x = ${total - regions[1] - regions[3]}$ and $x = ${xv}$. The ${names[0]} circle holds $${mult}x + x = ${mult + 1}x = ${correct}$ ${ctx.unit}.

$${mult * xv}$ leaves out the ${xv} in the overlap, which are also inside the ${names[0]} circle.`;
      } else {
        figure = vennFigure(2, names, texts);
        if (ask === 'in-b') {
          stem = `The Venn diagram above shows the numbers of ${ctx.pop} who ${ctx.A}, who ${ctx.B}, who do both, and who do neither. How many of the ${ctx.unit} ${ctx.B}?`;
          correct = ob + both;
          included = [1, 2];
          explanation = `Everything inside the ${names[1]} circle: $${ob} + ${both} = ${correct}$.

${ob} is only the part of the circle outside the overlap.`;
        } else if (ask === 'exactly-one') {
          stem = `The Venn diagram above shows the numbers of ${ctx.pop} who ${ctx.A}, who ${ctx.B}, who do both, and who do neither. How many of the ${ctx.unit} are in exactly one of the two groups?`;
          correct = oa + ob;
          included = [0, 1];
          explanation = `Exactly one means inside one circle but outside the overlap: $${oa} + ${ob} = ${correct}$.

$${oa + ob + both}$ also counts the ${both} in both groups.`;
        } else {
          stem = `The Venn diagram above shows the numbers of ${ctx.pop} who ${ctx.A}, who ${ctx.B}, who do both, and who do neither. How many of the ${ctx.unit} do NOT ${ctx.A}?`;
          correct = ob + neither;
          included = [1, 3];
          explanation = `Everyone outside the ${names[0]} circle: the ${ob} in the ${names[1]} circle only and the ${neither} outside both circles, $${ob} + ${neither} = ${correct}$.

${neither} forgets the ${ob} who are only in the ${names[1]} circle.`;
        }
      }
    } else {
      const ctx = rng.pick(VENN3);
      regions = [rng.int(6, 25), rng.int(6, 25), rng.int(6, 25), rng.int(2, 12), rng.int(2, 12), rng.int(2, 12), rng.int(1, 9), rng.int(3, 15)];
      total = sum(regions);
      xAt = rng.pick([3, 4, 5, 6]);
      ask = rng.pick(['exactly-two', 'in-a3', 'at-least-two'] as const);
      const texts = regions.map((r, i) => (i === xAt ? '$x$' : `$${r}$`));
      figure = vennFigure(3, ctx.names, texts);
      const pairs = regions[3] + regions[4] + regions[5];
      const T = regions[6];
      const others = total - regions[xAt];
      const xv = regions[xAt];
      const nameList = `${ctx.names[0]}, ${ctx.names[1]}, and ${ctx.names[2]}`;
      const [n0, n1, n2] = ctx.names;
      regionNames = [`the ${n0}-only region`, `the ${n1}-only region`, `the ${n2}-only region`, `the ${n0}-and-${n1} region`, `the ${n0}-and-${n2} region`, `the ${n1}-and-${n2} region`, 'the center (all three groups)', 'the region outside all circles'];
      const solve = `The regions add up to ${total}: $x + ${others} = ${total}$, so $x = ${xv}$.`;
      if (ask === 'exactly-two') {
        stem = `The Venn diagram above shows the numbers of ${ctx.pop} in groups ${nameList} (the number in each region counts the ${ctx.unit} in that region only). If there are ${total} ${ctx.unit} in all, how many are in exactly two of the three groups?`;
        correct = pairs;
        included = [3, 4, 5];
        explanation = `${solve} Exactly two means the three regions where just two circles overlap: $${regions[3]} + ${regions[4]} + ${regions[5]} = ${correct}$.

The center region (${T}) is in all three groups, not exactly two.`;
      } else if (ask === 'at-least-two') {
        stem = `The Venn diagram above shows the numbers of ${ctx.pop} in groups ${nameList} (the number in each region counts the ${ctx.unit} in that region only). If there are ${total} ${ctx.unit} in all, how many are in at least two of the three groups?`;
        correct = pairs + T;
        included = [3, 4, 5, 6];
        explanation = `${solve} At least two: the three two-group regions plus the center, $${regions[3]} + ${regions[4]} + ${regions[5]} + ${T} = ${correct}$.

$${pairs}$ leaves out the ${T} who are in all three groups.`;
      } else {
        stem = `The Venn diagram above shows the numbers of ${ctx.pop} in groups ${nameList} (the number in each region counts the ${ctx.unit} in that region only). If there are ${total} ${ctx.unit} in all, how many are in group ${ctx.names[0]}?`;
        correct = regions[0] + regions[3] + regions[4] + T;
        included = [0, 3, 4, 6];
        explanation = `${solve} Group ${ctx.names[0]} is its whole circle: $${regions[0]} + ${regions[3]} + ${regions[4]} + ${T} = ${correct}$.

${regions[0]} is only the part of the circle outside the other two.`;
      }
    }
    // Each wrong choice is the right regions with one or two regions left out, added or swapped.
    const regs = regions!;
    const inc = new Set(included);
    const overlapAt = sets === 2 ? 2 : 6;
    const outsideAt = sets === 2 ? 3 : 7;
    const deltas: { removed: number[]; added: number[] }[] = [];
    const ids = regs.map((_, i) => i);
    for (const i of ids) deltas.push({ removed: inc.has(i) ? [i] : [], added: inc.has(i) ? [] : [i] });
    const doubles: typeof deltas = [];
    for (const i of ids) for (const j of ids) if (i < j) doubles.push({ removed: [i, j].filter((x) => inc.has(x)), added: [i, j].filter((x) => !inc.has(x)) });
    const phrase = (xs: number[]) => xs.map((i) => regionNames[i]).join(' and ');
    const cands = [...rng.shuffle(deltas), ...rng.shuffle(doubles)].flatMap((dl) => {
      const set = new Set(inc);
      dl.removed.forEach((i) => set.delete(i));
      dl.added.forEach((i) => set.add(i));
      const value = [...set].reduce((t, i) => t + regs[i], 0);
      if (value <= 0 || value === correct) return [];
      const trap =
        dl.added.length === 0
          ? dl.removed.length === 1 && dl.removed[0] === overlapAt
            ? sets === 2
              ? 'prob-venn-only'
              : 'prob-venn-triple'
            : dl.removed.length === 1 && dl.removed[0] === outsideAt
              ? 'prob-venn-forgot-neither'
              : 'prob-venn-missed-region'
          : dl.removed.length === 0
            ? 'prob-venn-extra-region'
            : 'prob-venn-wrong-region';
      const why = (x: string) =>
        dl.added.length === 0
          ? `leaving out ${phrase(dl.removed)} gives $${x}$, but it belongs to what is asked`
          : dl.removed.length === 0
            ? `also counting ${phrase(dl.added)} gives $${x}$, but it is not part of what is asked`
            : `counting ${phrase(dl.added)} in place of ${phrase(dl.removed)} gives $${x}$`;
      return [{ value, trap, why }];
    });
    // the old last paragraph named one trap; replace it with a mistake that is really a choice
    explanation = explanation.replace(/\n\n[^\n]*$/, '');
    const built = trapOnlyChoices(rng, correct, cands, (x) => `$${num(x.n)}$`);
    if (!built) return vennDiagram.generate(rng, d);
    const cite = rng.pick(built.used);
    explanation = `${explanation}

Trap: ${cite.why(num(cite.value))}.

Read every region from the diagram, then add exactly the regions the question names.`;
    return { params: { sets, regions: regions!, xAt, ask: ask!, total }, q: { format: 'mcs', figure: figure!, stem, choices: built.choices, answer: built.answer, explanation } };
  },
  check(q, { sets, regions, xAt, ask, total }) {
    // Solve for x by trying every value, then count members region by region.
    const r = regions.slice();
    if (ask === 'circle-totals') {
      // Only the circle totals and the outside count are shown.
      const tA = regions[0] + regions[2];
      const tB = regions[1] + regions[2];
      let found = -1;
      for (let x = 0; x <= total; x++) if (tA - x >= 0 && tB - x >= 0 && tA - x + (tB - x) + x + regions[3] === total) found = x;
      if (found < 0) return 'no x';
      r[0] = tA - found;
      r[1] = tB - found;
      r[2] = found;
    } else if (xAt >= 0) {
      const mult = ask === 'x-two' ? regions[0] / regions[2] : 0;
      let found = -1;
      for (let x = 0; x <= total; x++) {
        const trial = r.map((v, i) => (i === xAt ? x : v));
        if (ask === 'x-two') trial[0] = mult * x;
        if (sum(trial) === total) {
          found = x;
          break;
        }
      }
      if (found < 0) return 'no x';
      r[xAt] = found;
      if (ask === 'x-two') r[0] = mult * found;
    }
    let expected = 0;
    if (sets === 2) {
      const ms = members2(r as Regions2);
      expected =
        ask === 'in-b'
          ? ms.filter(([, b]) => b).length
          : ask === 'x-two'
            ? ms.filter(([a]) => a).length
            : ask === 'not-a'
              ? ms.filter(([a]) => !a).length
              : ms.filter(([a, b]) => a !== b).length;
    } else {
      const ms: [boolean, boolean, boolean][] = [];
      r.forEach((n, i) => {
        for (let k = 0; k < n; k++) ms.push(IN3[i]);
      });
      const cnt = (m: [boolean, boolean, boolean]) => m.filter(Boolean).length;
      expected = ask === 'exactly-two' ? ms.filter((m) => cnt(m) === 2).length : ask === 'at-least-two' ? ms.filter((m) => cnt(m) >= 2).length : ms.filter((m) => m[0]).length;
    }
    return mcsCheck(q, `$${num(expected)}$`);
  },
};

/* ================================================================== 5. Percent of a group (MCS) */

interface PctGroupParams {
  /** Percents of the population: only A, only B, both, neither. */
  regions: number[];
  ask: 'a-not-b' | 'b-also-a' | 'prob-b-given-a';
}

const PCT_CTX = [
  { pop: 'the residents of a town', A: 'own a car', B: 'own a bicycle', aOwners: 'car owners', bOwners: 'bicycle owners', bNotA: 'own a bicycle but not a car', aNotB: 'own a car but not a bicycle', person: 'resident', aCond: 'owns a car', bEvent: 'also owns a bicycle' },
  { pop: 'the employees of a company', A: 'have a graduate degree', B: 'work remotely', aOwners: 'employees with a graduate degree', bOwners: 'remote workers', bNotA: 'work remotely but do not have a graduate degree', aNotB: 'have a graduate degree but do not work remotely', person: 'employee', aCond: 'has a graduate degree', bEvent: 'works remotely' },
  { pop: 'the members of a gym', A: 'take a yoga class', B: 'take a cycling class', aOwners: 'members who take yoga', bOwners: 'members who take cycling', bNotA: 'take cycling but not yoga', aNotB: 'take yoga but not cycling', person: 'member', aCond: 'takes a yoga class', bEvent: 'also takes a cycling class' },
];

const percentOfGroup: Template<PctGroupParams> = {
  id: 'data.sets.percent-of-group',
  skill: SKILL,
  format: 'mcs',
  style: 'percents of a population: what percent of one group is (not) in the other',
  generate(rng, d) {
    const ctx = rng.pick(PCT_CTX);
    const ask: PctGroupParams['ask'] = d === 1 ? 'a-not-b' : d === 2 ? rng.pick(['a-not-b', 'b-also-a'] as const) : rng.pick(['b-also-a', 'prob-b-given-a', 'a-not-b'] as const);
    let regions: number[];
    for (;;) {
      const pa = rng.pick([20, 25, 30, 40, 45, 50, 60, 75, 80]);
      const fracOnly = rng.pick([frac(1, 5), frac(1, 4), frac(2, 5), frac(1, 2), frac(3, 5), frac(3, 4), frac(4, 5)]);
      const oa = fracOnly.mul(pa);
      if (!oa.isInt()) continue;
      const both = pa - oa.n;
      const ob = rng.int(1, 6) * 5;
      const neither = 100 - oa.n - both - ob;
      if (neither < 5) continue;
      regions = [oa.n, ob, both, neither];
      const pb = ob + both;
      if (ask === 'b-also-a' && (both * 100) % pb !== 0) continue;
      break;
    }
    const [oa, ob, both] = regions;
    const pa = oa + both;
    const pb = ob + both;
    const stem0 = `Of ${ctx.pop}, ${pa} percent ${ctx.A}, ${pb} percent ${ctx.B}, and ${ob} percent ${ctx.bNotA}.`;
    let stem = '';
    let correct: Frac;
    const traps: { value: Frac; trap: string; why: (v: string) => string }[] = [];
    const T = (value: Frac, trap: string, why: (v: string) => string) => traps.push({ value, trap, why });
    const sq = (x: string) => `$${x}$`;
    let explanation = '';
    let fmt: (v: Frac) => string;
    if (ask === 'a-not-b') {
      correct = frac(100 * oa, pa);
      stem = `${stem0} What percent of the ${ctx.aOwners} do not ${ctx.B}?`;
      T(frac(oa), 'prob-percent-of-whole', (x) => `${sq(x + '\\%')} is a percent of everyone, but the base here is the ${ctx.aOwners}`);
      T(frac(100 * both, pa), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of the ${ctx.aOwners} who do ${ctx.B}`);
      T(frac(both), 'prob-percent-of-whole', (x) => `${sq(x + '\\%')} is the percent of everyone who do both`);
      T(frac(100 * oa, pb), 'prob-percent-wrong-base', (x) => `dividing by the ${pb} percent who ${ctx.B} gives ${sq(x + '\\%')}, but the base is the ${pa} percent who ${ctx.A}`);
      T(frac(100 - pa), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of everyone who do not ${ctx.A}`);
      T(frac(100 * oa, 100 - pb), 'prob-percent-wrong-base', (x) => `dividing by the ${100 - pb} percent who do not ${ctx.B} gives ${sq(x + '\\%')}, but the base is the ${ctx.aOwners}`);
      T(frac(100 * oa, oa + ob), 'prob-percent-wrong-base', (x) => `dividing by everyone in exactly one group gives ${sq(x + '\\%')}, but the base is the ${ctx.aOwners}`);
      T(frac(100 * oa, pa + pb), 'prob-percent-wrong-base', (x) => `dividing by the two percents added up gives ${sq(x + '\\%')}, but the base is the ${ctx.aOwners}`);
      T(frac(100 - oa), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of everyone outside the group of ${ctx.person}s who ${ctx.aNotB}`);
      T(frac(100 - both), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of everyone who do not do both`);
      T(frac(100 * ob, pb), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of the ${ctx.bOwners} who do not ${ctx.A}`);
      fmt = (v) => `$${v.isInt() ? num(v) : v.toNumber().toFixed(1)}\\%$`;
      explanation = `Both: $${pb} - ${ob} = ${both}$ percent of everyone. So $${pa} - ${both} = ${oa}$ percent of everyone ${ctx.aNotB}. As a percent of the ${ctx.aOwners}: $\\frac{${oa}}{${pa}} = ${num(correct)}\\%$.

${oa} percent is a percent of the whole population; the question uses the ${ctx.aOwners} as the base.`;
    } else if (ask === 'b-also-a') {
      correct = frac(100 * both, pb);
      stem = `${stem0} What percent of the ${ctx.bOwners} also ${ctx.A}?`;
      T(frac(both), 'prob-percent-of-whole', (x) => `${sq(x + '\\%')} uses the whole population as the base`);
      T(frac(100 * both, pa), 'prob-reversed-condition', (x) => `dividing by the ${pa} percent who ${ctx.A} gives ${sq(x + '\\%')}, the wrong group`);
      T(frac(100 * ob, pb), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of the ${ctx.bOwners} who do not ${ctx.A}`);
      T(frac(100 * both, pa + pb - both), 'prob-percent-wrong-base', (x) => `dividing by everyone in at least one group gives ${sq(x + '\\%')}, but the base is the ${ctx.bOwners}`);
      T(frac(100 - pb), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of everyone who do not ${ctx.B}`);
      T(frac(100 * both, 100 - pa), 'prob-percent-wrong-base', (x) => `dividing by the ${100 - pa} percent who do not ${ctx.A} gives ${sq(x + '\\%')}, but the base is the ${ctx.bOwners}`);
      T(frac(100 * both, ob + both + oa), 'prob-percent-wrong-base', (x) => `dividing by everyone in at least one group gives ${sq(x + '\\%')}, but the base is the ${ctx.bOwners}`);
      T(frac(100 * both, pa + pb), 'prob-percent-wrong-base', (x) => `dividing by the two percents added up gives ${sq(x + '\\%')}, but the base is the ${ctx.bOwners}`);
      T(frac(100 - both), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of everyone who do not do both`);
      T(frac(100 - ob), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of everyone outside the group of ${ctx.person}s who ${ctx.bNotA}`);
      T(frac(100 * oa, pa), 'prob-wrong-event', (x) => `${sq(x + '\\%')} is the percent of the ${ctx.aOwners} who do not ${ctx.B}`);
      fmt = (v) => `$${v.isInt() ? num(v) : v.toNumber().toFixed(1)}\\%$`;
      explanation = `Both: $${pb} - ${ob} = ${both}$ percent of everyone. As a percent of the ${ctx.bOwners}: $\\frac{${both}}{${pb}} = ${num(correct)}\\%$.

${both} percent uses the whole population as the base, and $\\frac{${both}}{${pa}}$ uses the wrong group.`;
    } else {
      correct = frac(both, pa);
      stem = `${stem0} If one of the ${ctx.person}s who ${ctx.A} is to be selected at random, what is the probability that the ${ctx.person} selected ${ctx.bEvent}?`;
      T(frac(both, 100), 'prob-percent-of-whole', (x) => `${sq(x)} divides by everyone instead of the given group`);
      T(frac(both, pb), 'prob-reversed-condition', (x) => `dividing by the ${pb} percent who ${ctx.B} gives ${sq(x)}, the wrong group`);
      T(frac(oa, pa), 'prob-wrong-event', (x) => `${sq(x)} is the probability of the other event`);
      T(frac(both, pa + pb - both), 'prob-percent-wrong-base', (x) => `dividing by everyone in at least one group gives ${sq(x)}, but the group is those who ${ctx.A}`);
      T(frac(pa, 100), 'prob-percent-of-whole', (x) => `${sq(x)} is the probability for the whole population`);
      T(frac(pb, 100), 'prob-percent-of-whole', (x) => `${sq(x)} is the probability that the other trait appears in the whole population`);
      fmt = (v) => `$${v.toTex()}$`;
      explanation = `Both: $${pb} - ${ob} = ${both}$ percent of everyone. Among the ${pa} percent who ${ctx.A}, the share in both is $\\frac{${both}}{${pa}} = ${correct.toTex()}$.

$\\frac{${both}}{100}$ divides by everyone instead of the given group.`;
    }
    // percents are shown with at most one decimal, so keep only mistakes that are exact there
    const usable = traps.filter((t) => t.value.sign() > 0 && (ask === 'prob-b-given-a' ? t.value.lt(1) : t.value.mul(10).isInt() && !t.value.gt(100)));
    explanation = explanation.replace(/\n\n[^\n]*$/, '');
    const built = trapOnlyChoices(rng, correct!, rng.shuffle(usable), fmt!);
    if (!built) return percentOfGroup.generate(rng, d);
    const cite = rng.pick(built.used);
    explanation = `${explanation}

Trap: ${cite.why(ask === 'prob-b-given-a' ? cite.value.toTex() : cite.value.isInt() ? num(cite.value) : cite.value.toNumber().toFixed(1))}.

The base of a percent is the group named after "of the": divide by that group, not by everyone.`;
    return { params: { regions: regions!, ask }, q: { format: 'mcs', stem, choices: built.choices, answer: built.answer, explanation } };
  },
  check(q, { regions, ask }) {
    // Build a population of 100 people (percents) and count.
    const people = members2(regions as Regions2);
    const A = people.filter(([a]) => a);
    const B = people.filter(([, b]) => b);
    if (ask === 'a-not-b') {
      const v = frac(100 * A.filter(([, b]) => !b).length, A.length);
      return mcsCheck(q, `$${v.isInt() ? num(v) : v.toNumber().toFixed(1)}\\%$`);
    }
    if (ask === 'b-also-a') {
      const v = frac(100 * B.filter(([a]) => a).length, B.length);
      return mcsCheck(q, `$${v.isInt() ? num(v) : v.toNumber().toFixed(1)}\\%$`);
    }
    return mcsCheck(q, `$${frac(A.filter(([, b]) => b).length, A.length).toTex()}$`);
  },
};

export const setsTemplates: Template<any>[] = [twoSetCount, overlapRange, overlapQC, vennDiagram, percentOfGroup];

