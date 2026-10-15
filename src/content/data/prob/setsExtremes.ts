import { frac, Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { neCheck } from './util';

// Numeric entry: the least or greatest possible size of an overlap, of a "neither" group, or of the
// group that has all three attributes, when only the group sizes are known.
export const setsExtremesTraps: Record<string, Trap> = {
  'prob-ext-no-subtract': {
    label: 'Gave the sum of the group sizes as the overlap',
    fix: 'If the groups add to more than the total, the surplus must be in both. Overlap at least = sum of the groups $-$ total.',
  },
  'prob-ext-wrong-extreme': {
    label: 'Gave the greatest possible value when the least was asked (or the reverse)',
    fix: 'The overlap is as small as it can be when the groups spread out, and as large as the smaller group when they are nested.',
  },
  'prob-ext-lack-once': {
    label: 'Subtracted the total only once with three groups',
    fix: 'With three groups the surplus counts a person in all three groups twice more than a person in one group. Subtract the total twice: $a + b + c - 2N$.',
  },
  'prob-ext-disjoint': {
    label: 'Assumed the groups cannot overlap',
    fix: 'Zero overlap gives the least "neither" group. The greatest "neither" group comes from as much overlap as possible, nested groups.',
  },
  'prob-ext-wrong-set': {
    label: 'Used the smaller group instead of the larger one',
    fix: 'People outside the larger group are in none of the groups, and they cannot exceed the total minus the larger group.',
  },
  'prob-ext-ignore-none': {
    label: 'Ignored the people who are in none of the groups',
    fix: 'Only the people in at least one group can be in all three. Take the total of those, $N$ minus the "none" group, in $a + b + c - 2N$.',
  },
  'prob-ext-none-sign': {
    label: 'Added the "none" group to the total instead of removing it',
    fix: 'The people in none of the groups are outside every circle, so the total for the circles is the total minus the "none" group.',
  },
};

const TRAP_TEXT: Record<string, (v: number) => string> = {
  'prob-ext-no-subtract': (v) => `Trap: $${v}$ is the sum of the two groups, which counts the overlap twice; it is not the overlap.`,
  'prob-ext-wrong-extreme': (v) => `Trap: $${v}$ is the greatest possible value, reached when the groups are nested; the least comes from spreading them out.`,
  'prob-ext-lack-once': (v) => `Trap: subtracting the total only once gives $${v}$, which still counts some people twice.`,
  'prob-ext-disjoint': (v) => `Trap: $${v}$ assumes the groups do not overlap, which gives the least "neither" group, not the greatest.`,
  'prob-ext-wrong-set': (v) => `Trap: using the smaller group gives $${v}$, which leaves out part of the larger group.`,
  'prob-ext-ignore-none': (v) => `Trap: using the whole total, as if everyone were in a group, gives $${v}$.`,
  'prob-ext-none-sign': (v) => `Trap: adding the "none" group to the total gives $${v}$ instead of removing it.`,
};

type Kind = 'min-both' | 'max-neither' | 'min-all3' | 'max-none3' | 'min-all3-none';

interface ExtParams {
  kind: Kind;
  N: number;
  sizes: number[];
  /** Fixed size of the "none" group (min-all3-none only). */
  none: number;
}

const CTX2 = [
  { pop: (n: number) => `In a survey of ${n} residents of a town`, unit: 'residents', A: 'own a bicycle', B: 'own a car', both: 'own both a bicycle and a car', neither: 'own neither' },
  { pop: (n: number) => `Of the ${n} people who attended a festival`, unit: 'people', A: 'bought a ticket for the concert', B: 'bought a ticket for the film', both: 'bought tickets for both', neither: 'bought a ticket for neither' },
  { pop: (n: number) => `Among the ${n} students in a school club`, unit: 'students', A: 'play chess', B: 'play checkers', both: 'play both games', neither: 'play neither game' },
  { pop: (n: number) => `A company has ${n} employees`, unit: 'employees', A: 'have a laptop', B: 'have a company phone', both: 'have both a laptop and a company phone', neither: 'have neither' },
];

const CTX3 = [
  { pop: (n: number) => `Each of the ${n} members of a library was asked which of three services, borrowing books, borrowing films and borrowing games, they have used. Of them, `, sets: ['borrowed books', 'borrowed films', 'borrowed games'], unit: 'members', all: 'used all three services', none: 'used none of the three services' },
  { pop: (n: number) => `A survey asked ${n} households which of three utilities, gas, water and internet, they have switched to a new provider. Of them, `, sets: ['switched gas', 'switched water', 'switched internet'], unit: 'households', all: 'switched all three utilities', none: 'switched none of the three utilities' },
  { pop: (n: number) => `Each of the ${n} participants in a study took three tests, A, B and C. Of them, `, sets: ['passed test A', 'passed test B', 'passed test C'], unit: 'participants', all: 'passed all three tests', none: 'passed none of the three tests' },
];

/** All (onlyA, onlyB, both, neither) for two groups of given sizes in a population of N. */
function two(N: number, a: number, b: number) {
  const out: { both: number; neither: number }[] = [];
  for (let both = 0; both <= Math.min(a, b); both++) {
    const neither = N - (a + b - both);
    if (neither >= 0) out.push({ both, neither });
  }
  return out;
}

/** For each count in all three, the interval [lo, hi] of possible "none" counts (regions enumerated, bc by interval). */
function three(N: number, a: number, b: number, c: number) {
  const out: { all: number; lo: number; hi: number }[] = [];
  for (let t = 0; t <= Math.min(a, b, c); t++)
    for (let ab = 0; ab <= Math.min(a, b) - t; ab++)
      for (let ac = 0; ac <= Math.min(a, c) - t; ac++) {
        const oa = a - t - ab - ac;
        const bcMax = Math.min(b - t - ab, c - t - ac);
        if (oa < 0 || bcMax < 0) continue;
        const none0 = N - oa - b - c + t; // "none" when bc = 0; each extra bc adds one
        const hi = none0 + bcMax;
        if (hi >= 0) out.push({ all: t, lo: Math.max(none0, 0), hi });
      }
  return out;
}

const extremes: Template<ExtParams> = {
  id: 'data.sets.extreme-overlap',
  skill: 'data.sets',
  format: 'ne',
  style: 'least or greatest possible overlap, neither group, or all-three group from the group sizes alone',
  generate(rng, d) {
    const kind: Kind = rng.pick(d === 1 ? (['min-both', 'max-neither', 'min-both'] as const) : d === 2 ? (['min-all3', 'max-none3', 'max-neither', 'min-all3'] as const) : (['min-all3-none', 'min-all3-none', 'min-all3'] as const));
    for (;;) {
      const N = rng.pick(d === 1 ? [40, 50, 60, 80, 100, 120] : [60, 70, 75, 80, 90, 100, 120, 150]);
      let sizes: number[] = [];
      let none = 0;
      let answer: number;
      const traps: { value: Frac; trap: string }[] = [];
      let steps: string;
      let ask: string;
      let stemExtra = '';
      const ctx2 = rng.pick(CTX2);
      const ctx3 = rng.pick(CTX3);
      if (kind === 'min-both' || kind === 'max-neither') {
        const a = rng.int(Math.ceil(N * 0.45), Math.ceil(N * 0.85));
        const b = rng.int(Math.ceil(N * 0.45), Math.ceil(N * 0.85));
        if (kind === 'min-both') {
          if (a + b - N < 4 || a + b - N > Math.min(a, b) - 4) continue;
        } else if (N - Math.max(a, b) < 4) continue;
        sizes = [a, b];
        if (kind === 'min-both') {
          answer = a + b - N;
          ask = `What is the least possible number of ${ctx2.unit} who ${ctx2.both}?`;
          traps.push({ value: frac(a + b), trap: 'prob-ext-no-subtract' }, { value: frac(Math.min(a, b)), trap: 'prob-ext-wrong-extreme' });
          steps = `Add the two groups: $${a} + ${b} = ${a + b}$. There are only $${N}$ ${ctx2.unit}, so the extra $${a + b - N}$ are counted twice, which means at least $${a + b - N}$ are in both. This many is enough when nobody is in neither group.

Check: $${a} - ${a + b - N} = ${N - b}$ ${ctx2.unit} in the first group only, and $${N - b} + ${b} = ${N}$.`;
        } else {
          answer = N - Math.max(a, b);
          ask = `What is the greatest possible number of ${ctx2.unit} who ${ctx2.neither}?`;
          traps.push({ value: frac(N - Math.min(a, b)), trap: 'prob-ext-wrong-set' });
          if (N - a - b > 0) traps.push({ value: frac(N - a - b), trap: 'prob-ext-disjoint' });
          steps = `The "neither" group is largest when the smaller group sits entirely inside the larger one, so that as few people as possible are in at least one group: only the larger group, $${Math.max(a, b)}$ ${ctx2.unit}. Then $${N} - ${Math.max(a, b)} = ${answer}$ ${ctx2.unit} are in neither.\n\nCheck: the smaller group, $${Math.min(a, b)}$, fits inside the larger one, $${Math.max(a, b)}$.`;
        }
        const stem = `${ctx2.pop(N)}, ${a} ${ctx2.A} and ${b} ${ctx2.B}. ${ask}`;
        return pack(stem, ctx2.unit);
      }
      // three groups
      if (kind === 'max-none3') {
        const s = [0, 0, 0].map(() => rng.int(Math.ceil(N * 0.3), Math.ceil(N * 0.85)));
        if (N - Math.max(...s) < 4) continue;
        sizes = s;
        answer = N - Math.max(...s);
        ask = `What is the greatest possible number of ${ctx3.unit} who ${ctx3.none}?`;
        traps.push({ value: frac(N - Math.min(...s)), trap: 'prob-ext-wrong-set' });
        if (N - s[0] - s[1] - s[2] > 0) traps.push({ value: frac(N - s[0] - s[1] - s[2]), trap: 'prob-ext-disjoint' });
        steps = `The group that is in none of the three is largest when the two smaller groups sit inside the largest one: then only the largest, $${Math.max(...s)}$ ${ctx3.unit}, is in at least one group. So $${N} - ${Math.max(...s)} = ${answer}$.\n\nCheck: nesting the groups uses no more than $${Math.max(...s)}$ ${ctx3.unit}.`;
      } else {
        if (kind === 'min-all3-none') {
          none = rng.int(5, Math.round(N * 0.15));
        }
        const M = N - none;
        const lacks = [0, 0, 0].map(() => rng.int(Math.max(3, Math.round(M * 0.06)), Math.round(M * 0.25)));
        const sum = lacks[0] + lacks[1] + lacks[2];
        if (M - sum < 3) continue;
        sizes = lacks.map((l) => M - l);
        answer = M - sum;
        ask = `What is the least possible number of ${ctx3.unit} who ${ctx3.all}?`;
        const [a, b, c] = sizes;
        const twice = a + b + c - 2 * N;
        if (kind === 'min-all3') {
          traps.push({ value: frac(a + b + c - N), trap: 'prob-ext-lack-once' }, { value: frac(Math.min(a, b, c)), trap: 'prob-ext-wrong-extreme' });
          steps = `Count the people who are missing from each group: $${N} - ${a} = ${lacks[0]}$, $${N} - ${b} = ${lacks[1]}$, $${N} - ${c} = ${lacks[2]}$. Together at most $${sum}$ people are missing from some group, so at least $${N} - ${sum} = ${answer}$ are in all three. (Equivalently, $${a} + ${b} + ${c} - 2(${N}) = ${answer}$.)\n\nCheck: $${answer} + ${sum} = ${N}$.`;
        } else {
          traps.push({ value: frac(twice), trap: 'prob-ext-ignore-none' }, { value: frac(a + b + c - 2 * (N + none)), trap: 'prob-ext-none-sign' }, { value: frac(a + b + c - M), trap: 'prob-ext-lack-once' });
          steps = `The ${none} ${ctx3.unit} in none of the three cannot be in any group, so only $${N} - ${none} = ${M}$ ${ctx3.unit} are left to fill the groups. Missing from each group among these: $${M} - ${a} = ${lacks[0]}$, $${M} - ${b} = ${lacks[1]}$, $${M} - ${c} = ${lacks[2]}$. At most $${sum}$ are missing from some group, so at least $${M} - ${sum} = ${answer}$ are in all three.\n\nCheck: $${a} + ${b} + ${c} - 2(${M}) = ${answer}$.`;
        }
        stemExtra = kind === 'min-all3-none' ? ` Exactly ${none} of the ${ctx3.unit} ${ctx3.none}.` : '';
        const stem = `${ctx3.pop(N)}${sizes.map((s, i) => `${s} ${ctx3.sets[i]}`).join(', ').replace(/, ([^,]*)$/, ', and $1')}.${stemExtra} ${ask}`;
        return pack(stem, ctx3.unit);
      }
      const stem = `${ctx3.pop(N)}${sizes.map((s, i) => `${s} ${ctx3.sets[i]}`).join(', ').replace(/, ([^,]*)$/, ', and $1')}. ${ask}`;
      return pack(stem, ctx3.unit);

      function pack(stem: string, suffix: string) {
        const keep = traps.filter((t) => t.value.sign() > 0 && !t.value.eq(answer)).filter((t, i, arr) => arr.findIndex((x) => x.value.eq(t.value)) === i);
        return {
          params: { kind, N, sizes, none },
          q: {
            format: 'ne' as const,
            stem,
            answer: frac(answer),
            suffix,
            traps: keep,
            explanation: `${steps}${keep.length ? `

${TRAP_TEXT[keep[0].trap](keep[0].value.n)}` : ''}

With only group sizes known, find the extreme by counting the people who are outside each group.`,
          },
        };
      }
    }
  },
  check(q, p) {
    let expected: number;
    const [a, b, c] = p.sizes;
    if (p.kind === 'min-both') expected = Math.min(...two(p.N, a, b).map((x) => x.both));
    else if (p.kind === 'max-neither') expected = Math.max(...two(p.N, a, b).map((x) => x.neither));
    else if (p.kind === 'max-none3') expected = Math.max(...three(p.N, a, b, c).map((x) => x.hi));
    else if (p.kind === 'min-all3') expected = Math.min(...three(p.N, a, b, c).map((x) => x.all));
    else expected = Math.min(...three(p.N, a, b, c).filter((x) => x.lo <= p.none && p.none <= x.hi).map((x) => x.all));
    return neCheck(q, frac(expected));
  },
};

export const setsExtremesTemplates: Template<any>[] = [extremes];
