import { frac } from '../../../engine/frac';
import { gcd, lcm } from '../../../engine/math';
import type { Template, Trap } from '../../../engine/types';
import { expectNe } from './util';

export const countMultiplesTraps: Record<string, Trap> = {
  'int-count-gaps-not-multiples': {
    label: 'Counted the gaps between multiples, not the multiples',
    fix: 'If the first and last multiples are $f$ and $l$, there are $(l - f)/m + 1$ of them: $n$ multiples have only $n - 1$ gaps. Or count $\\lfloor B/m \\rfloor - \\lfloor (A-1)/m \\rfloor$.',
  },
  'int-count-lower-end-dropped': {
    label: 'Removed the multiples up to A instead of those below A',
    fix: 'The range starts AT $A$, so $A$ itself counts when it is a multiple. Subtract the multiples of $m$ up to $A - 1$, not up to $A$.',
  },
  'int-count-double-counted': {
    label: 'Counted the numbers divisible by both twice',
    fix: 'For "p or q", a number divisible by both appears in both lists. Add the two counts and subtract the count of numbers divisible by both.',
  },
  'int-count-product-not-lcm': {
    label: 'Used p times q for the numbers divisible by both',
    fix: 'Numbers divisible by both $p$ and $q$ are the multiples of lcm$(p, q)$. That equals $pq$ only when $p$ and $q$ share no factor.',
  },
  'int-count-subtract-q': {
    label: 'Subtracted all the multiples of q',
    fix: '"Divisible by p but not q" removes only the multiples of $p$ that are also multiples of $q$, which are the multiples of lcm$(p, q)$, not all the multiples of $q$.',
  },
  'int-count-wrong-question': {
    label: 'Answered "at least one" when the question asked for something else',
    fix: 'Read the condition again. "Neither" is everything outside the union; "exactly one" removes the numbers divisible by both from the union twice.',
  },
};

type Kind = 'single' | 'either' | 'but-not' | 'neither' | 'exactly-one';
interface P {
  kind: Kind;
  p: number;
  q: number;
  A: number;
  B: number;
}

const cnt = (m: number, A: number, B: number) => Math.floor(B / m) - Math.floor((A - 1) / m);

const KINDS: Record<number, Kind[]> = {
  1: ['single'],
  2: ['either', 'either', 'but-not'],
  3: ['neither', 'exactly-one', 'but-not', 'neither'],
};

const countMultiples: Template<P> = {
  id: 'arith.divisibility.count-multiples',
  skill: 'arith.divisibility',
  format: 'ne',
  style: 'how many integers in a range are divisible by p, p or q, p but not q, neither',
  generate(rng, diff) {
    for (;;) {
      const kind = rng.pick(KINDS[diff]);
      const p = rng.int(3, diff === 1 ? 19 : 15);
      let q = rng.int(3, 15);
      if (kind !== 'single' && (q === p || p % q === 0 || q % p === 0)) continue;
      if (kind === 'single') q = 1;
      const A = diff === 1 ? rng.int(1, 60) * (rng.chance(0.5) ? p : 1) : rng.chance(0.5) ? 1 : rng.int(2, 80);
      const B = A + rng.int(diff === 1 ? 80 : 150, diff === 1 ? 400 : 700);
      const a = cnt(p, A, B);
      const b = kind === 'single' ? 0 : cnt(q, A, B);
      const L = kind === 'single' ? p : lcm(p, q);
      const c = kind === 'single' ? 0 : cnt(L, A, B);
      const total = B - A + 1;
      const union = a + b - c;
      const answer = { single: a, either: union, 'but-not': a - c, neither: total - union, 'exactly-one': a + b - 2 * c }[kind];
      const traps: Record<string, number> = {};
      if (kind === 'single') {
        traps['int-count-gaps-not-multiples'] = Math.floor((B - A) / p);
        traps['int-count-lower-end-dropped'] = Math.floor(B / p) - Math.floor(A / p);
      } else {
        if (kind === 'either') traps['int-count-double-counted'] = a + b;
        if (kind === 'but-not') traps['int-count-subtract-q'] = a - b;
        if (kind === 'neither' || kind === 'exactly-one') traps['int-count-wrong-question'] = kind === 'neither' ? union : a + b - c;
        if (gcd(p, q) > 1) traps['int-count-product-not-lcm'] = kind === 'either' ? a + b - cnt(p * q, A, B) : kind === 'but-not' ? a - cnt(p * q, A, B) : kind === 'neither' ? total - (a + b - cnt(p * q, A, B)) : a + b - 2 * cnt(p * q, A, B);
      }
      const list = Object.entries(traps).filter(([, v]) => v !== answer && v >= 0);
      if (!list.length || answer < 3) continue;
      const range = A === 1 ? `from 1 to ${B}` : `from ${A} to ${B}`;
      const stem = {
        single: `How many integers ${range}, inclusive, are divisible by ${p}?`,
        either: `How many integers ${range}, inclusive, are divisible by ${p}, by ${q}, or by both?`,
        'but-not': `How many integers ${range}, inclusive, are divisible by ${p} but not by ${q}?`,
        neither: `How many integers ${range}, inclusive, are divisible by neither ${p} nor ${q}?`,
        'exactly-one': `How many integers ${range}, inclusive, are divisible by exactly one of the numbers ${p} and ${q}?`,
      }[kind];
      const [tid, tv] = list[0];
      const sayTrap: Record<string, string> = {
        'int-count-gaps-not-multiples': `$\\lfloor (${B} - ${A}) / ${p} \\rfloor$ gives $${tv}$, which counts the gaps between multiples.`,
        'int-count-lower-end-dropped': `Removing the multiples up to ${A} instead of up to ${A - 1} gives $${tv}$, and loses ${A} when it is a multiple.`,
        'int-count-double-counted': `Adding ${a} and ${b} gives $${tv}$, which counts twice the numbers divisible by both (there are $${c}$).`,
        'int-count-product-not-lcm': `Using ${p} times ${q} for the overlap gives $${tv}$, but ${p} and ${q} share a factor.`,
        'int-count-subtract-q': `Taking ${b} away from ${a} gives $${tv}$, but only the $${c}$ common multiples must go.`,
        'int-count-wrong-question': `Stopping at the union gives $${tv}$, which answers a different question.`,
      };
      const head =
        kind === 'single'
          ? `Counting multiples in a range: count the multiples up to ${B}, then remove those below ${A}. There are $\\lfloor ${B}/${p} \\rfloor = ${Math.floor(B / p)}$ multiples up to ${B} and $\\lfloor ${A - 1}/${p} \\rfloor = ${Math.floor((A - 1) / p)}$ below ${A}, so $${Math.floor(B / p)} - ${Math.floor((A - 1) / p)} = ${answer}$.`
          : `Counting with conditions on two divisors: use inclusion and exclusion. ${p} divides ${a} of the numbers and ${q} divides ${b}. Numbers divisible by both are the multiples of lcm$(${p}, ${q}) = ${L}$: there are ${c}.`;
      const step =
        kind === 'single'
          ? `Check: the first multiple is ${Math.ceil(A / p) * p} and the last is ${Math.floor(B / p) * p}; $(${Math.floor(B / p) * p} - ${Math.ceil(A / p) * p})/${p} + 1 = ${answer}$.`
          : kind === 'either'
            ? `Divisible by at least one: $${a} + ${b} - ${c} = ${answer}$.`
            : kind === 'but-not'
              ? `Multiples of ${p} that are not multiples of ${q} are the multiples of ${p} minus those that are also multiples of ${q}: $${a} - ${c} = ${answer}$.`
              : kind === 'neither'
                ? `At least one: $${a} + ${b} - ${c} = ${union}$. Out of ${total} integers, neither leaves $${total} - ${union} = ${answer}$.`
                : `Numbers divisible by both are in both counts, so exactly one is $${a} + ${b} - 2 \\cdot ${c} = ${answer}$.`;
      return {
        params: { kind, p, q, A, B },
        q: {
          format: 'ne',
          stem,
          answer: frac(answer),
          traps: list.map(([trap, v]) => ({ value: frac(v), trap })),
          explanation: `${head}

${step}

Trap: ${sayTrap[tid]} Rule: ${kind === 'single' ? 'a run of multiples has one fewer gap than it has multiples.' : 'count the multiples of each number, and use the least common multiple for the overlap.'}`,
        },
      };
    }
  },
  check(q, { kind, p, q: qq, A, B }) {
    let n = 0;
    for (let x = A; x <= B; x++) {
      const dp = x % p === 0;
      const dq = kind !== 'single' && x % qq === 0;
      if (kind === 'single' ? dp : kind === 'either' ? dp || dq : kind === 'but-not' ? dp && !dq : kind === 'neither' ? !dp && !dq : dp !== dq) n++;
    }
    return expectNe(q, n);
  },
};

export const countMultiplesTemplates: Template<any>[] = [countMultiples];
