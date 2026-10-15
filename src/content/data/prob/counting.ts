import { qcCompare, qcFromSamples } from '../../../engine/build';
import { frac, type Frac } from '../../../engine/frac';
import { factorial, nCr, nPr } from '../../../engine/math';
import { num } from '../../../engine/tex';
import { plural } from '../../../engine/text';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { countCombinations, countSequences, forEachCombination, forEachPermutation, mcsCheck, neCheck, trapOnlyChoices, word } from './util';

const SKILL = 'data.counting';
const bin = (n: number | string, k: number | string) => `\\binom{${n}}{${k}}`;
const rel = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');

/* ================================================================== 1. Compare two counts (QC) */

type Spec = { op: 'C' | 'P'; n: number | null; k: number; mult: number } | { op: 'num'; value: number };

interface CompareParams {
  a: Spec;
  b: Spec;
  /** When the specs use the unknown n: n is an integer greater than m. */
  m: number | null;
}

const specValue = (s: Spec, n: number) => (s.op === 'num' ? s.value : s.mult * (s.op === 'C' ? nCr(s.n ?? n, s.k) : nPr(s.n ?? n, s.k)));

const ROLES = ['a president', 'a vice president', 'a treasurer'];
const rolesText = (r: number) => (r === 2 ? `${ROLES[0]} and ${ROLES[1]}` : `${ROLES[0]}, ${ROLES[1]}, and ${ROLES[2]}`);

/** Committee sizes where C(n, k) = P(m, r): the roles-vs-committee comparison is a tie. */
const EQUAL_ROLES: [number, number, number, number][] = [
  [6, 3, 5, 2],
  [8, 3, 8, 2],
  [10, 3, 6, 3],
  [10, 4, 7, 3],
];

const compareCountsQC: Template<CompareParams> = {
  id: 'data.counting.compare-qc',
  skill: SKILL,
  format: 'qc',
  style: 'compare two counts: committees, offices, handshakes, unknown n',
  generate(rng, d) {
    const kinds = d === 1 ? ['symmetry', 'roles', 'handshake'] : d === 2 ? ['symmetry', 'roles', 'handshake', 'unknown', 'unknown'] : ['roles', 'unknown', 'unknown', 'symmetry'];
    const kind = rng.pick(kinds);
    let info: string | undefined;
    let qa = '';
    let qb = '';
    let a: Spec;
    let b: Spec;
    let m: number | null = null;
    let traps: QCQuestion['traps'];
    let explanation = '';
    const swap = rng.chance(0.5);

    if (kind === 'symmetry') {
      const n = rng.int(d === 1 ? 6 : 7, d === 1 ? 9 : 12);
      // k < j always; then the sides are swapped at random.
      let k: number;
      let j: number;
      const mode = rng.pick(['complement', 'next', 'next', 'other'] as const);
      if (mode === 'complement') {
        k = rng.int(2, Math.floor((n - 1) / 2));
        j = n - k;
      } else if (mode === 'next') {
        // C(n, k) vs C(n, k + 1): equal when 2k + 1 = n, otherwise it depends on which side of n/2 they are.
        k = rng.int(Math.max(2, Math.floor(n / 2) - 2), Math.min(n - 2, Math.floor(n / 2) + 1));
        j = k + 1;
      } else {
        k = rng.int(2, Math.floor((n - 1) / 2));
        j = rng.pick([n - k + 1, n - k - 1, k + 2].filter((x) => x > k && x <= n - 1 && x !== n - k));
      }
      const [ka, kb] = swap ? [j, k] : [k, j];
      a = { op: 'C', n, k: ka, mult: 1 };
      b = { op: 'C', n, k: kb, mult: 1 };
      const ctx = rng.pick([
        { intro: `Set $S$ has ${n} elements.`, thing: (s: number) => `The number of subsets of $S$ that have exactly ${s} element${s === 1 ? '' : 's'}` },
        { intro: `A committee is to be formed from a group of ${n} people.`, thing: (s: number) => `The number of different ${s}-person committees that can be formed` },
        { intro: `A student will choose some of the ${n} books on a reading list.`, thing: (s: number) => `The number of different groups of ${s} book${s === 1 ? '' : 's'} the student can choose` },
      ]);
      info = ctx.intro;
      qa = ctx.thing(ka);
      qb = ctx.thing(kb);
      const va = nCr(n, ka);
      const vb = nCr(n, kb);
      const answer = qcCompare(va, vb);
      const naive = qcCompare(ka, kb);
      if (naive !== answer) traps = { [naive]: 'prob-choose-symmetry' };
      explanation = `Order does not matter, so count combinations: $${bin(n, ka)} = ${num(va)}$ and $${bin(n, kb)} = ${num(vb)}$, so ${rel(answer)}. (${answer})

${
  ka + kb === n
    ? `No arithmetic is needed: choosing the ${Math.min(ka, kb)} that are in is the same as choosing the ${Math.max(ka, kb)} that are left out, so $${bin(n, ka)} = ${bin(n, kb)}$.`
    : `Shortcut: rewrite each count with the smaller of $k$ and $${n} - k$ (${[ka, kb]
        .map((x) => (x > n - x ? `$${bin(n, x)} = ${bin(n, n - x)}$` : `$${bin(n, x)}$`))
        .join(', ')}); the closer that number is to $\\frac{${n}}{2}$, the more groups there are.`
} More elements per group does not always mean more groups.`;
    } else if (kind === 'roles') {
      let n: number;
      let k: number;
      let mm: number;
      let r: number;
      if (rng.chance(0.3)) [n, k, mm, r] = rng.pick(EQUAL_ROLES);
      else {
        do {
          n = rng.int(6, d === 3 ? 12 : 10);
          k = rng.int(2, d === 1 ? 3 : 4);
          mm = rng.int(4, 9);
          r = rng.int(2, 3);
        } while (nCr(n, k) === nPr(mm, r) || Math.abs(nCr(n, k) - nPr(mm, r)) > 3 * Math.min(nCr(n, k), nPr(mm, r)));
      }
      const comm: Spec = { op: 'C', n, k, mult: 1 };
      const roles: Spec = { op: 'P', n: mm, k: r, mult: 1 };
      const commText = `The number of different ${k}-member committees that can be chosen from a group of ${n} people`;
      const rolesTextQ = `The number of different ways to choose ${rolesText(r)} from a club of ${mm} members, if no member can hold more than one office`;
      [a, b] = swap ? [roles, comm] : [comm, roles];
      [qa, qb] = swap ? [rolesTextQ, commText] : [commText, rolesTextQ];
      const vc = nCr(n, k);
      const vr = nPr(mm, r);
      const [va, vb] = swap ? [vr, vc] : [vc, vr];
      const answer = qcCompare(va, vb);
      // Mistakes: using combinations for the offices, or permutations for the committee.
      const ignoredOrder = swap ? qcCompare(nCr(mm, r), vc) : qcCompare(vc, nCr(mm, r));
      const addedOrder = swap ? qcCompare(vr, nPr(n, k)) : qcCompare(nPr(n, k), vr);
      traps = {};
      if (ignoredOrder !== answer) traps[ignoredOrder] = 'prob-order-ignored';
      if (addedOrder !== answer && !traps[addedOrder]) traps[addedOrder] = 'prob-order-matters';
      const rolesCalc = r === 2 ? `${mm} \\times ${mm - 1}` : `${mm} \\times ${mm - 1} \\times ${mm - 2}`;
      explanation = `The offices are different roles, so order matters: $${rolesCalc} = ${num(vr)}$ ways.

A committee has no roles, so order does not matter: $${bin(n, k)} = \\frac{${Array.from({ length: k }, (_, i) => n - i).join(' \\times ')}}{${k}!} = ${num(vc)}$.

So ${rel(answer)}. (${answer})

The trap is mixing up the two situations: $\\binom{${mm}}{${r}}$ for the offices or $${num(nPr(n, k))}$ ordered picks for the committee.`;
    } else if (kind === 'handshake') {
      const n = rng.int(d === 1 ? 6 : 10, d === 1 ? 10 : 16);
      const T = (n * (n - 1)) / 2;
      const pickK = rng.next();
      const k = pickK < 0.35 ? T : pickK < 0.6 ? n * (n - 1) : pickK < 0.8 ? T + rng.int(1, n - 1) : T - rng.int(1, n - 1);
      const ctx = rng.pick([
        { info: `At a meeting, each of the ${n} people present shook hands exactly once with each of the other people present.`, what: 'The total number of handshakes' },
        { info: `In a league of ${n} teams, each team played each of the other teams exactly once.`, what: 'The total number of games played' },
      ]);
      info = ctx.info;
      a = { op: 'C', n, k: 2, mult: 1 };
      b = { op: 'num', value: k };
      qa = ctx.what;
      qb = `$${num(k)}$`;
      const answer = qcCompare(T, k);
      const dbl = qcCompare(n * (n - 1), k);
      if (dbl !== answer) traps = { [dbl]: 'prob-handshake-double' };
      explanation = `Each of the ${n} participants meets ${n - 1} others, which gives $${n} \\times ${n - 1} = ${num(n * (n - 1))}$, but that counts every pair twice (once from each side). The total is $\\frac{${n} \\times ${n - 1}}{2} = ${num(T)} = ${bin(n, 2)}$.

Compare $${num(T)}$ with $${num(k)}$: ${rel(answer)}. (${answer})`;
    } else {
      // unknown n
      const variant = rng.pick(d === 2 ? ['ab', 'ab', 'pc', 'sym', 'cn'] : ['ab', 'ab', 'pc', 'cn', 'cn']);
      if (variant === 'ab') {
        const [ka, kb] = rng.pick([
          [3, 2],
          [4, 2],
          [4, 3],
          [5, 2],
          [3, 1],
        ] as [number, number][]);
        m = rng.int(ka, ka + kb + 2);
        const big: Spec = { op: 'C', n: null, k: ka, mult: 1 };
        const small: Spec = { op: 'C', n: null, k: kb, mult: 1 };
        [a, b] = swap ? [small, big] : [big, small];
        const t = (s: number) => (s === 1 ? 'The number of ways to choose 1 person from $n$ people' : `The number of different ${s}-person committees that can be formed from $n$ people`);
        [qa, qb] = swap ? [t(kb), t(ka)] : [t(ka), t(kb)];
        info = `$n$ is an integer greater than $${m}$.`;
        const s = ka + kb;
        const answer: QCChoice = m >= s ? (swap ? 'B' : 'A') : 'D';
        if (answer !== 'D') traps = { D: 'prob-unknown-means-d' };
        explanation = `$\\binom{n}{${ka}}$ and $\\binom{n}{${kb}}$ are equal when $${ka} + ${kb} = n$, that is when $n = ${s}$, because $\\binom{n}{k} = \\binom{n}{n-k}$. For $n > ${s}$ the ${ka}-person committees are more numerous${
          s - 1 > m ? `, and for $n < ${s}$ they are fewer` : ''
        }.

${
  answer === 'D'
    ? `Since $n > ${m}$ allows $n = ${s}$ (equal) and $n = ${s + 1}$ (${num(nCr(s + 1, ka))} versus ${num(nCr(s + 1, kb))}), the relationship cannot be determined. (D)`
    : `Here $n > ${m} \\ge ${s}$, so $n \\ge ${m + 1}$ and the ${ka}-person committees always win: for example $n = ${m + 1}$ gives ${num(nCr(m + 1, ka))} versus ${num(nCr(m + 1, kb))}. (${answer})`
}`;
      } else if (variant === 'pc') {
        const r = rng.pick([2, 3]);
        m = rng.int(r, r + 4);
        const ordered: Spec = { op: 'P', n: null, k: r, mult: 1 };
        const scaled: Spec = { op: 'C', n: null, k: r, mult: factorial(r) };
        [a, b] = swap ? [scaled, ordered] : [ordered, scaled];
        const tOrd = `The number of different ways to choose ${rolesText(r)} from $n$ club members, if no member can hold more than one office`;
        const tSc = `${r === 2 ? 'Twice' : '6 times'} the number of different ${r}-member committees that can be chosen from the $n$ club members`;
        [qa, qb] = swap ? [tSc, tOrd] : [tOrd, tSc];
        info = `$n$ is an integer greater than $${m}$.`;
        traps = { D: 'prob-unknown-means-d' };
        explanation = `Every ${r}-member committee can be turned into ${r === 2 ? '2' : '$3! = 6$'} different assignments of the ${r} offices, so the number of ways to fill the offices is exactly ${r === 2 ? 'twice' : '6 times'} the number of committees: $${
          r === 2 ? 'n(n-1) = 2 \\cdot \\frac{n(n-1)}{2}' : 'n(n-1)(n-2) = 6 \\cdot \\frac{n(n-1)(n-2)}{6}'
        }$ for every $n$.

The quantities are equal whatever $n$ is. (C)`;
      } else if (variant === 'sym') {
        const k = rng.int(2, 4);
        m = rng.int(k + 1, k + 5);
        const s1: Spec = { op: 'C', n: null, k, mult: 1 };
        // C(n, n-k) written with the unknown: represented by its symmetric twin for checking.
        const s2: Spec = { op: 'C', n: null, k, mult: 1 };
        [a, b] = [s1, s2];
        const t1 = `The number of different groups of ${k} people that can be chosen from $n$ people`;
        const t2 = `The number of different groups of $n - ${k}$ people that can be chosen from $n$ people`;
        [qa, qb] = swap ? [t2, t1] : [t1, t2];
        info = `$n$ is an integer greater than $${m}$.`;
        traps = { D: 'prob-unknown-means-d' };
        explanation = `Choosing the ${k} people who are in a group is the same as choosing the $n - ${k}$ people who are left out: every choice of one corresponds to exactly one choice of the other. So $\\binom{n}{${k}} = \\binom{n}{n-${k}}$ for every $n$.

The quantities are equal. (C)`;
      } else {
        const c = rng.pick([1, 2, 3]);
        m = rng.int(2 * c - 1 < 2 ? 2 : 2 * c - 1, 2 * c + 3);
        const pairs: Spec = { op: 'C', n: null, k: 2, mult: 1 };
        const lin: Spec = { op: 'P', n: null, k: 1, mult: c };
        [a, b] = swap ? [lin, pairs] : [pairs, lin];
        const tPairs = 'The number of different pairs of people that can be chosen from $n$ people';
        const tLin = `$${c === 1 ? '' : c}n$`;
        [qa, qb] = swap ? [tLin, tPairs] : [tPairs, tLin];
        info = `$n$ is an integer greater than $${m}$.`;
        const eq = 2 * c + 1;
        const pairsWin: QCChoice = swap ? 'B' : 'A';
        const answer: QCChoice = m >= eq ? pairsWin : 'D';
        if (answer !== 'D') traps = { D: 'prob-unknown-means-d' };
        explanation = `The number of pairs is $\\frac{n(n-1)}{2}$. Compare it with $${c === 1 ? '' : c}n$: dividing both by $n > 0$ compares $\\frac{n-1}{2}$ with $${c}$, so they are equal when $n = ${eq}$ and the pairs are more numerous when $n > ${eq}$.

${
  answer === 'D'
    ? `Since $n > ${m}$ allows $n = ${eq}$ (equal) and $n = ${eq + 1}$ (${num(nCr(eq + 1, 2))} pairs versus ${num(c * (eq + 1))}), the relationship cannot be determined. (D)`
    : `Here $n > ${m}$, so $n \\ge ${m + 1} > ${eq}$ and the number of pairs is always greater. (${answer})`
}`;
      }
    }

    // Final answer from the specs (exact formulas). check() re-derives by enumeration.
    let answer: QCChoice;
    if (m === null) answer = qcCompare(specValue(a!, 0), specValue(b!, 0));
    else {
      const rels = new Set<QCChoice>();
      for (let n = m + 1; n <= m + 10; n++) rels.add(qcCompare(specValue(a!, n), specValue(b!, n)));
      answer = rels.size > 1 ? 'D' : [...rels][0];
    }
    if (traps && traps[answer]) delete traps[answer];
    if (traps && Object.keys(traps).length === 0) traps = undefined;
    return {
      params: { a: a!, b: b!, m },
      q: { format: 'qc', info, quantityA: qa, quantityB: qb, answer, ...(traps ? { traps } : {}), explanation },
    };
  },
  check(q, { a, b, m }) {
    const count = (s: Spec, n: number) =>
      s.op === 'num' ? s.value : s.mult * (s.op === 'C' ? countCombinations(s.n ?? n, s.k) : countSequences(s.n ?? n, s.k));
    let expected: QCChoice;
    if (m === null) expected = qcCompare(count(a, 0), count(b, 0));
    else {
      const samples: [number, number][] = [];
      for (let n = m + 1; n <= Math.max(m + 4, 13); n++) samples.push([count(a, n), count(b, n)]);
      expected = qcFromSamples(samples);
    }
    return q.format === 'qc' && q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 2. Arrangements in a row (NE) */

const NAMES = ['Ana', 'Ben', 'Chloe', 'Dmitri', 'Elena', 'Femi', 'Grace', 'Hiro', 'Ines', 'Jamal'];
const WORD_LIST = ['LEVEL', 'BANANA', 'LETTER', 'COFFEE', 'PEPPER', 'TOMATO', 'CANNON', 'TATTOO', 'BALLOON', 'ADDRESS', 'ERROR', 'ASSESS'];

type ArrKind = 'first' | 'end' | 'ends' | 'together' | 'apart' | 'block3' | 'word' | 'fixed';
interface ArrParams {
  kind: ArrKind;
  n: number;
  word: string;
  /** For 'fixed': where the fixed letter goes, and whether the other letter must (or must not) be next to it. */
  where: 'middle' | 'first';
  near: boolean;
}

const arrangements: Template<ArrParams> = {
  id: 'data.counting.arrangements',
  skill: SKILL,
  format: 'ne',
  style: 'arrangements in a row with a restriction (ends, together, apart, repeated letters)',
  generate(rng, d) {
    const kind: ArrKind = rng.pick(
      d === 1 ? (['first', 'end', 'ends', 'fixed'] as const) : d === 2 ? (['together', 'apart', 'ends', 'fixed', 'fixed'] as const) : (['apart', 'block3', 'word', 'word', 'fixed'] as const),
    );
    const n = kind === 'word' ? 0 : kind === 'fixed' ? (d === 3 ? 7 : rng.pick([5, 5, 6])) : d === 1 ? rng.int(4, 6) : d === 2 ? rng.int(5, 7) : rng.int(6, 7);
    const where: 'middle' | 'first' = kind === 'fixed' && n % 2 === 1 && rng.chance(0.7) ? 'middle' : 'first';
    const near = kind === 'fixed' && d === 1 ? rng.chance(0.5) : kind === 'fixed' ? rng.chance(0.25) : false;
    const w = kind === 'word' ? rng.pick(WORD_LIST) : '';
    const f = factorial;
    const [x, y] = rng.sample(NAMES, 2);
    const ctx = rng.pick([
      { group: `friends`, setup: `${word(n).replace(/^./, (c) => c.toUpperCase())} friends, including ${x} and ${y}, are to be seated in a row of ${n} chairs.`, verb: 'can the friends be seated', spot: 'chair' },
      { group: `students`, setup: `${word(n).replace(/^./, (c) => c.toUpperCase())} students, including ${x} and ${y}, are to stand in a single row for a photograph.`, verb: 'can the students be arranged', spot: 'position' },
    ]);
    let stem = '';
    let answer = 0;
    const traps: { value: Frac; trap: string }[] = [];
    let explanation = '';
    switch (kind) {
      case 'first':
        answer = f(n - 1);
        stem = `${ctx.setup} In how many different ways ${ctx.verb} if ${x} must be in the leftmost ${ctx.spot}?`;
        traps.push({ value: frac(f(n)), trap: 'prob-ignored-restriction' });
        explanation = `Fill the restricted spot first: ${x} has 1 choice (the leftmost ${ctx.spot}). The other ${n - 1} people fill the remaining ${n - 1} spots in $${n - 1}! = ${num(answer)}$ ways.

$${n}! = ${num(f(n))}$ ignores the restriction.`;
        break;
      case 'end':
        answer = 2 * f(n - 1);
        stem = `${ctx.setup} In how many different ways ${ctx.verb} if ${x} must be at one of the two ends of the row?`;
        traps.push({ value: frac(f(n - 1)), trap: 'prob-missed-case' }, { value: frac(f(n)), trap: 'prob-ignored-restriction' });
        explanation = `${x} has 2 choices (left end or right end), and then the other ${n - 1} people can be arranged in $${n - 1}! = ${num(f(n - 1))}$ ways: $2 \\times ${num(f(n - 1))} = ${num(answer)}$.

$${num(f(n - 1))}$ counts only one of the two ends.`;
        break;
      case 'ends':
        answer = 2 * f(n - 2);
        stem = `${ctx.setup} In how many different ways ${ctx.verb} if ${x} and ${y} must be at the two ends of the row?`;
        traps.push({ value: frac(f(n - 2)), trap: 'prob-forgot-internal-order' }, { value: frac(f(n)), trap: 'prob-ignored-restriction' });
        explanation = `${x} and ${y} take the two ends in 2 ways (${x} on the left or ${y} on the left). The other ${n - 2} people fill the middle in $${n - 2}! = ${num(f(n - 2))}$ ways: $2 \\times ${num(f(n - 2))} = ${num(answer)}$.

$${num(f(n - 2))}$ forgets that ${x} and ${y} can switch ends.`;
        break;
      case 'together':
        answer = 2 * f(n - 1);
        stem = `${ctx.setup} In how many different ways ${ctx.verb} if ${x} and ${y} must be next to each other?`;
        traps.push({ value: frac(f(n - 1)), trap: 'prob-forgot-internal-order' }, { value: frac(f(n) - 2 * f(n - 1)), trap: 'prob-answered-complement' });
        explanation = `Glue ${x} and ${y} into one block. The block and the other ${n - 2} people are ${n - 1} units, arranged in $${n - 1}! = ${num(f(n - 1))}$ ways, and inside the block the two can be in 2 orders: $2 \\times ${num(f(n - 1))} = ${num(answer)}$.

$${num(f(n - 1))}$ forgets the 2 orders inside the block.`;
        break;
      case 'apart':
        answer = f(n) - 2 * f(n - 1);
        stem = `${ctx.setup} In how many different ways ${ctx.verb} if ${x} and ${y} must NOT be next to each other?`;
        traps.push({ value: frac(f(n) - f(n - 1)), trap: 'prob-forgot-internal-order' }, { value: frac(2 * f(n - 1)), trap: 'prob-answered-complement' });
        explanation = `Count the complement. Without restriction there are $${n}! = ${num(f(n))}$ arrangements. With ${x} and ${y} together (one block, 2 orders inside): $2 \\times ${n - 1}! = ${num(2 * f(n - 1))}$.

Not together: $${num(f(n))} - ${num(2 * f(n - 1))} = ${num(answer)}$.

Subtracting only $${n - 1}! = ${num(f(n - 1))}$ forgets the 2 orders inside the block.`;
        break;
      case 'block3': {
        answer = 6 * f(n - 2);
        const subj = rng.pick([
          { items: 'books', sp: 'mathematics books', setup: `${word(n).replace(/^./, (c) => c.toUpperCase())} different books, 3 of which are mathematics books, are to be placed in a row on a shelf.`, v: 'can the books be placed' },
          { items: 'photos', sp: 'beach photos', setup: `${word(n).replace(/^./, (c) => c.toUpperCase())} different photos, 3 of which are beach photos, are to be hung in a row on a wall.`, v: 'can the photos be hung' },
        ]);
        stem = `${subj.setup} In how many different ways ${subj.v} if the 3 ${subj.sp} must be next to one another?`;
        traps.push({ value: frac(f(n - 2)), trap: 'prob-forgot-internal-order' }, { value: frac(f(n)), trap: 'prob-ignored-restriction' });
        explanation = `Treat the 3 ${subj.sp} as one block. The block and the other ${n - 3} ${subj.items} are ${n - 2} units: $${n - 2}! = ${num(f(n - 2))}$ arrangements. Inside the block the 3 can be ordered in $3! = 6$ ways: $6 \\times ${num(f(n - 2))} = ${num(answer)}$.

$${num(f(n - 2))}$ forgets the order inside the block.`;
        break;
      }
      case 'fixed': {
        const letters = 'ABCDEFG'.slice(0, n).split('');
        const [fx, other] = rng.sample(letters, 2);
        const list = `${letters.slice(0, -1).join(', ')}, and ${letters[n - 1]}`;
        const spots = where === 'middle' ? (near ? 2 : n - 3) : near ? 1 : n - 2;
        answer = spots * f(n - 2);
        const place = where === 'middle' ? 'in the middle position' : 'in the first position';
        stem = `The ${n} letters ${list} are to be arranged in a row, with each letter used exactly once. If ${fx} must be ${place} and ${other} must ${near ? '' : 'not '}be next to ${fx}, how many different arrangements are possible?`;
        traps.push({ value: frac(f(n - 1)), trap: 'prob-ignored-restriction' });
        if (spots > 1) traps.push({ value: frac(f(n - 2)), trap: 'prob-missed-case' });
        const nearSpots = where === 'middle' ? 2 : 1;
        explanation = `Place the restricted letters first. ${fx} goes ${place} (1 way). ${
          near
            ? `${other} must take ${nearSpots === 2 ? 'one of the 2 positions' : 'the 1 position'} next to ${fx}`
            : `${other} cannot take the ${nearSpots === 2 ? '2 positions' : 'position'} next to ${fx}, so it has $${n - 1} - ${nearSpots} = ${spots}$ positions`
        }. The other ${n - 2} letters fill the remaining ${n - 2} positions in $${n - 2}! = ${num(f(n - 2))}$ ways.

Total: $${spots} \\times ${num(f(n - 2))} = ${num(answer)}$. Ignoring the rule for ${other} gives $${n - 1}! = ${num(f(n - 1))}$.`;
        break;
      }
      case 'word': {
        const counts = new Map<string, number>();
        for (const ch of w) counts.set(ch, (counts.get(ch) ?? 0) + 1);
        const reps = [...counts.entries()].filter(([, c]) => c > 1);
        const denom = reps.reduce((p, [, c]) => p * f(c), 1);
        answer = f(w.length) / denom;
        stem = `How many different ${w.length}-letter strings can be formed by arranging all the letters of the word ${w}?`;
        traps.push({ value: frac(f(w.length)), trap: 'prob-repeated-letters' });
        if (reps.length > 1) traps.push({ value: frac(f(w.length) / f(reps[0][1])), trap: 'prob-repeated-letters' });
        const repText = reps.map(([ch, c]) => `${ch} appears ${word(c)} times`).join(' and ');
        explanation = `If all ${w.length} letters were different there would be $${w.length}! = ${num(f(w.length))}$ arrangements. But ${repText}, and swapping identical letters gives the same string, so divide by ${reps
          .map(([, c]) => `$${c}!$`)
          .join(' and ')}: $\\frac{${w.length}!}{${reps.map(([, c]) => `${c}!`).join(' \\, ')}} = ${num(answer)}$.

$${num(f(w.length))}$ counts the same string several times.`;
        break;
      }
    }
    // a mistake that gives the answer is not a mistake: draw again
    if (traps.some((t) => t.value.eq(answer))) return arrangements.generate(rng, d);
    return {
      params: { kind, n, word: w, where, near },
      q: { format: 'ne', stem, answer: frac(answer), traps, explanation },
    };
  },
  check(q, { kind, n, word: w, where, near }) {
    let count = 0;
    if (kind === 'word') {
      const seen = new Set<string>();
      forEachPermutation(w.split(''), (p) => seen.add(p.join('')));
      count = seen.size;
    } else {
      const people = Array.from({ length: n }, (_, i) => i);
      const pos = new Array<number>(n);
      forEachPermutation(people, (p) => {
        for (let k = 0; k < n; k++) pos[p[k]] = k;
        const px = pos[0];
        const py = pos[1];
        const adj = Math.abs(px - py) === 1;
        let ok = true;
        if (kind === 'first') ok = px === 0;
        else if (kind === 'end') ok = px === 0 || px === n - 1;
        else if (kind === 'ends') ok = (px === 0 && py === n - 1) || (py === 0 && px === n - 1);
        else if (kind === 'together') ok = adj;
        else if (kind === 'apart') ok = !adj;
        else if (kind === 'fixed') ok = px === (where === 'middle' ? (n - 1) / 2 : 0) && adj === near;
        else if (kind === 'block3') {
          const b = [pos[0], pos[1], pos[2]].sort((u, v) => u - v);
          ok = b[2] - b[0] === 2;
        }
        if (ok) count++;
      });
    }
    return neCheck(q, frac(count));
  },
};

/* ================================================================== 3. Codes and digit strings (MCS) */

type CodeKind = 'code' | 'distinct' | 'odd-distinct' | 'even-distinct' | 'no-digit' | 'all-even' | 'palindrome' | 'at-least-one';
interface CodeParams {
  kind: CodeKind;
  letters: number;
  L: number;
  D: number;
  repeat: boolean;
  digits: number;
  /** no-digit: the banned digit; at-least-one: the required digit. */
  banned: number;
}

const LETTERS = 'ABCDEFGH';
const DIGIT_WORDS = ['', '', 'two', 'three', 'four', 'five', 'six'];
const CODE_KINDS: Record<1 | 2 | 3, CodeKind[]> = {
  1: ['code', 'code', 'no-digit', 'all-even'],
  2: ['code', 'distinct', 'odd-distinct', 'palindrome', 'no-digit', 'all-even'],
  3: ['even-distinct', 'odd-distinct', 'distinct', 'at-least-one', 'at-least-one', 'palindrome'],
};

const codes: Template<CodeParams> = {
  id: 'data.counting.codes',
  skill: SKILL,
  format: 'mcs',
  style: 'codes and digit strings with the multiplication principle',
  generate(rng, d) {
    const P = nPr;
    const mk = (value: number, trap: string, why: (v: string) => string) => ({ value, trap, why });
    for (;;) {
      const kind = rng.pick(CODE_KINDS[d]);
      const p: CodeParams = { kind, letters: 0, L: 0, D: 0, repeat: true, digits: 3, banned: -1 };
      let stem = '';
      let correct = 0;
      let traps: ReturnType<typeof mk>[] = [];
      let head = '';
      let check = '';
      let rule = '';
      if (kind === 'code') {
        [p.L, p.D] = rng.pick([
          [1, 3],
          [2, 2],
          [3, 1],
          [2, 1],
          [1, 2],
        ] as [number, number][]);
        p.letters = rng.int(4, 8);
        p.repeat = d === 1;
        const letterList = LETTERS.slice(0, p.letters).split('').join(', ');
        const rep = p.repeat ? 'Letters and digits may be repeated.' : 'No letter and no digit may appear more than once in a code.';
        stem = `A security code consists of ${word(p.L)} letter${p.L > 1 ? 's' : ''} followed by ${word(p.D)} digit${p.D > 1 ? 's' : ''}. Each letter is one of ${letterList}, and each digit is one of the digits 0 through 9. ${rep} How many different codes are possible?`;
        const letterStrings = p.repeat ? p.letters ** p.L : P(p.letters, p.L);
        const digitStrings = p.repeat ? 10 ** p.D : P(10, p.D);
        correct = letterStrings * digitStrings;
        const other = p.repeat ? P(p.letters, p.L) * P(10, p.D) : p.letters ** p.L * 10 ** p.D;
        traps = [
          mk(other, 'prob-repetition', (v) => `${p.repeat ? 'forbidding' : 'allowing'} repeats gives $${v}$, but repeats are ${p.repeat ? 'allowed' : 'not allowed'}`),
          mk(p.L * p.letters + p.D * 10, 'prob-add-not-multiply', (v) => `adding the numbers of choices gives $${v}$, but choices for successive positions multiply`),
          mk(letterStrings + digitStrings, 'prob-add-not-multiply', (v) => `adding the number of letter strings and digit strings gives $${v}$, but every letter string goes with every digit string`),
          mk(nCr(p.letters, p.L) * nCr(10, p.D), 'prob-order-ignored', (v) => `choosing sets of symbols gives $${v}$, but the same symbols in a different order are a different code`),
          mk(letterStrings, 'prob-ignored-restriction', (v) => `counting only the letter part gives $${v}$, but each of them goes with every digit string`),
          mk(digitStrings, 'prob-ignored-restriction', (v) => `counting only the digit part gives $${v}$, but each of them goes with every letter string`),
        ];
        const slots = [
          ...Array.from({ length: p.L }, (_, i) => (p.repeat ? p.letters : p.letters - i)),
          ...Array.from({ length: p.D }, (_, i) => (p.repeat ? 10 : 10 - i)),
        ];
        head = `A code is filled position by position, so multiply the numbers of choices: $${slots.join(' \\times ')} = ${num(correct)}$.${p.repeat ? '' : ' Each letter or digit already used is not available for the next position.'}`;
        check = `${num(letterStrings)} letter strings, each followed by any of ${num(digitStrings)} digit strings: $${num(letterStrings)} \\times ${num(digitStrings)} = ${num(correct)}$.`;
        rule = 'Choices made one after another multiply; they never add.';
      } else if (kind === 'distinct') {
        p.digits = d === 2 ? 3 : rng.pick([4, 5]);
        const k = p.digits;
        stem = `How many ${k}-digit positive integers have ${DIGIT_WORDS[k]} different digits?`;
        correct = 9 * P(9, k - 1);
        traps = [
          mk(P(10, k), 'prob-leading-zero', (v) => `allowing 0 first gives $${v}$, but a leading 0 does not make a ${k}-digit number`),
          mk(9 * 10 ** (k - 1), 'prob-repetition', (v) => `allowing repeated digits gives $${v}$, but the digits must be different`),
          mk(P(9, k), 'prob-over-exclude', (v) => `never using 0 gives $${v}$, but 0 may appear after the first digit`),
          mk(9 ** k, 'prob-repetition', (v) => `9 choices for every digit gives $${v}$, but each later digit has one choice fewer than the one before`),
        ];
        head = `The first digit cannot be 0: 9 choices. Each later digit is any digit not used yet, 0 included: $9 \\times ${Array.from({ length: k - 1 }, (_, i) => 9 - i).join(' \\times ')} = ${num(correct)}$.`;
        check = `with all ${k} positions free, $${Array.from({ length: k }, (_, i) => 10 - i).join(' \\times ')} = ${num(P(10, k))}$ counts the strings that start with 0, ${num(P(9, k - 1))} of them, and $${num(P(10, k))} - ${num(P(9, k - 1))} = ${num(correct)}$.`;
        rule = 'Fill the position with the restriction first, then the freer ones.';
      } else if (kind === 'odd-distinct' || kind === 'even-distinct') {
        const odd = kind === 'odd-distinct';
        p.digits = d === 2 ? 3 : rng.pick([3, 4]);
        const k = p.digits;
        stem = `How many ${k}-digit positive integers are ${odd ? 'odd' : 'even'} and have ${DIGIT_WORDS[k]} different digits?`;
        const mid = P(8, k - 2);
        const oddCount = 5 * 8 * mid;
        const evenCount = 9 * mid + 4 * 8 * mid;
        correct = odd ? oddCount : evenCount;
        const allDistinct = 9 * P(9, k - 1);
        traps = [
          mk(9 * mid * 5, odd ? 'prob-restricted-first' : 'prob-case-split', (v) => `${odd ? 'choosing the first digit before the units digit' : 'one product with 5 choices for the units digit'} gives $${v}$, which ${odd ? 'counts numbers whose units digit repeats an earlier digit' : 'ignores that a units digit of 0 leaves more choices for the first digit'}`),
          mk(9 * 10 ** (k - 2) * 5, 'prob-repetition', (v) => `allowing repeated digits gives $${v}$, but the digits must be different`),
          mk(allDistinct / 2, 'prob-half-parity', (v) => `half of the ${num(allDistinct)} numbers with different digits gives $${v}$, but the odd and even ones are not equally many`),
          mk(odd ? evenCount : oddCount, 'prob-wrong-set', (v) => `$${v}$ counts the ${odd ? 'even' : 'odd'} numbers instead`),
          ...(odd
            ? [mk(5 * 9 ** (k - 1), 'prob-repetition', (v) => `9 choices for each other digit gives $${v}$, but digits already used are not available`)]
            : [
                mk(9 * mid, 'prob-missed-case', (v) => `counting only the numbers that end in 0 gives $${v}$, but 2, 4, 6 and 8 can end the number too`),
                mk(4 * 8 * mid, 'prob-missed-case', (v) => `leaving out the numbers that end in 0 gives $${v}$, but they count too`),
              ]),
        ];
        head = odd
          ? `Fill the most restricted digits first. Units digit: odd, 5 choices. First digit: not 0 and not the units digit, 8 choices. ${k === 3 ? 'The middle digit' : `The other ${k - 2} digits`}: $${Array.from({ length: k - 2 }, (_, i) => 8 - i).join(' \\times ')}$ choices. Total: $5 \\times 8 \\times ${Array.from({ length: k - 2 }, (_, i) => 8 - i).join(' \\times ')} = ${num(correct)}$.`
          : `Split on the units digit, because 0 as a units digit changes the choices for the first digit. Units digit 0: $9 \\times ${Array.from({ length: k - 2 }, (_, i) => 8 - i).join(' \\times ')} = ${num(9 * mid)}$. Units digit 2, 4, 6 or 8: $4 \\times 8 \\times ${Array.from({ length: k - 2 }, (_, i) => 8 - i).join(' \\times ')} = ${num(4 * 8 * mid)}$. Total: $${num(9 * mid)} + ${num(4 * 8 * mid)} = ${num(correct)}$.`;
        check = `the ${num(oddCount)} odd and ${num(evenCount)} even numbers add up to ${num(allDistinct)}, the count of all ${k}-digit numbers with different digits.`;
        rule = 'Start with the restricted position, and split into cases when one choice changes the others.';
      } else if (kind === 'no-digit') {
        p.banned = rng.int(1, 9);
        p.digits = d === 1 ? 3 : 4;
        const k = p.digits;
        stem = `How many ${k}-digit positive integers do not contain the digit ${p.banned}?`;
        correct = 8 * 9 ** (k - 1);
        traps = [
          mk(9 ** k, 'prob-leading-zero', (v) => `9 choices for every position gives $${v}$, but the first digit cannot be 0`),
          mk(8 ** k, 'prob-over-exclude', (v) => `removing both 0 and ${p.banned} from every position gives $${v}$, but only the first digit cannot be 0`),
          mk(9 * 10 ** (k - 1) - k * 10 ** (k - 1), 'prob-overlap-subtract', (v) => `taking away ${k} lots of $10^{${k - 1}}$ numbers, one per position, gives $${v}$, but numbers with ${p.banned} twice are taken away twice`),
          mk(8 * 10 ** (k - 1), 'prob-ignored-restriction', (v) => `checking only the first digit gives $${v}$, but every position must avoid ${p.banned}`),
        ];
        head = `First digit: any of 1 through 9 except ${p.banned}, so 8 choices. Each other digit: any of 0 through 9 except ${p.banned}, so 9 choices. Total: $8 \\times ${Array.from({ length: k - 1 }, () => 9).join(' \\times ')} = ${num(correct)}$.`;
        check = `9 choices for every position would give $9^{${k}} = ${num(9 ** k)}$ strings, and $9^{${k - 1}} = ${num(9 ** (k - 1))}$ of them start with 0: $${num(9 ** k)} - ${num(9 ** (k - 1))} = ${num(correct)}$.`;
        rule = 'Count the choices for each position separately, remembering which positions have extra limits.';
      } else if (kind === 'all-even') {
        p.digits = d === 1 ? 3 : 4;
        const k = p.digits;
        stem = `How many ${k}-digit positive integers have only even digits?`;
        correct = 4 * 5 ** (k - 1);
        traps = [
          mk(5 ** k, 'prob-leading-zero', (v) => `5 choices for every digit gives $${v}$, but the first digit cannot be 0`),
          mk(4 ** k, 'prob-over-exclude', (v) => `4 choices for every digit gives $${v}$, but only the first digit cannot be 0`),
          mk(4 + 5 * (k - 1), 'prob-add-not-multiply', (v) => `adding the numbers of choices gives $${v}$, but choices for successive digits multiply`),
          mk(9 * 10 ** (k - 2) * 5, 'prob-ignored-restriction', (v) => `making only the units digit even gives $${v}$, but every digit must be even`),
        ];
        head = `The even digits are 0, 2, 4, 6, 8. The first digit cannot be 0, so it has 4 choices; each other digit has 5: $4 \\times ${Array.from({ length: k - 1 }, () => 5).join(' \\times ')} = ${num(correct)}$.`;
        check = `5 choices for every position would give $5^{${k}} = ${num(5 ** k)}$ strings, and $5^{${k - 1}} = ${num(5 ** (k - 1))}$ of them start with 0: $${num(5 ** k)} - ${num(5 ** (k - 1))} = ${num(correct)}$.`;
        rule = 'The leading digit has its own count when 0 is among the allowed digits.';
      } else if (kind === 'palindrome') {
        p.digits = d === 2 ? rng.pick([3, 4, 5]) : rng.pick([5, 6]);
        const k = p.digits;
        const free = Math.ceil(k / 2);
        stem = `How many ${k}-digit positive integers read the same forward and backward (such as ${k === 3 ? '474' : k === 4 ? '3553' : k === 5 ? '20502' : '718817'})?`;
        correct = 9 * 10 ** (free - 1);
        traps = [
          mk(10 ** free, 'prob-leading-zero', (v) => `allowing 0 as the first digit gives $${v}$, but a leading 0 does not make a ${k}-digit number`),
          mk(9 * 10 ** (k - 1), 'prob-ignored-restriction', (v) => `letting every digit be free gives $${v}$, but the last digits must copy the first ones`),
          mk(9 * 10 ** free, 'prob-palindrome-free', (v) => `treating ${free + 1} digits as free gives $${v}$, but only the first ${free} can be chosen`),
          mk(9 * 10 ** (free - 2), 'prob-palindrome-free', (v) => `treating ${plural(free - 1, 'digit')} as free gives $${v}$, but the first ${free} can all be chosen`),
          mk(9 * P(9, free - 1), 'prob-repetition', (v) => `requiring different digits gives $${v}$, but a palindrome may repeat digits`),
        ];
        head = `The first ${free} digit${free === 1 ? '' : 's'} decide${free === 1 ? 's' : ''} the number: the last ${k - free} copy the first ones in reverse. The first digit has 9 choices (not 0), each other free digit has 10: $9 \\times ${Array.from({ length: free - 1 }, () => 10).join(' \\times ')} = ${num(correct)}$.`;
        check = `for ${k === 3 ? '3' : k === 4 ? '4' : '5'} digits the first half ${free === 2 ? 'ab' : 'abc'} fixes the whole number, so the count equals the number of such halves.`;
        rule = 'In a palindrome only the first half of the digits is free.';
      } else {
        // at-least-one
        p.banned = rng.int(1, 9);
        p.digits = rng.pick([3, 4]);
        const k = p.digits;
        const total = 9 * 10 ** (k - 1);
        stem = `How many ${k}-digit positive integers contain at least one digit ${p.banned}?`;
        correct = total - 8 * 9 ** (k - 1);
        traps = [
          mk(total - 9 ** k, 'prob-leading-zero', (v) => `counting the numbers without ${p.banned} as $9^{${k}}$ lets the first digit be 0, which gives $${v}$`),
          mk(k * 10 ** (k - 1), 'prob-at-least-one-overcount', (v) => `putting ${p.banned} in one position and leaving the others free gives $${v}$, but a number with ${p.banned} twice is counted twice`),
          mk(8 * 9 ** (k - 1), 'prob-answered-complement', (v) => `$${v}$ counts the numbers WITHOUT the digit ${p.banned}`),
          mk(total - 8 ** k, 'prob-over-exclude', (v) => `removing 0 and ${p.banned} from every position gives $${v}$ for the numbers without ${p.banned}, but only the first digit cannot be 0`),
          mk(10 ** (k - 1), 'prob-missed-case', (v) => `counting only the numbers that start with ${p.banned} gives $${v}$, but ${p.banned} can be in any position`),
        ];
        head = `Use the complement. All ${k}-digit numbers: $9 \\times 10^{${k - 1}} = ${num(total)}$. Those with no ${p.banned}: first digit 8 choices, each other digit 9: $8 \\times 9^{${k - 1}} = ${num(8 * 9 ** (k - 1))}$. So at least one ${p.banned}: $${num(total)} - ${num(8 * 9 ** (k - 1))} = ${num(correct)}$.`;
        check = `the numbers with and without ${p.banned} add up to ${num(total)}: $${num(correct)} + ${num(8 * 9 ** (k - 1))}$.`;
        rule = '"At least one" is easiest as everything minus "none".';
      }
      // mistakes that apply to every kind: another number of positions, a factor of 2
      const calc: Partial<Record<CodeKind, (kk: number) => number>> = {
        distinct: (kk) => 9 * P(9, kk - 1),
        'odd-distinct': (kk) => 5 * 8 * P(8, kk - 2),
        'even-distinct': (kk) => 41 * P(8, kk - 2),
        'no-digit': (kk) => 8 * 9 ** (kk - 1),
        'all-even': (kk) => 4 * 5 ** (kk - 1),
        palindrome: (kk) => 9 * 10 ** (Math.ceil(kk / 2) - 1),
        'at-least-one': (kk) => 9 * 10 ** (kk - 1) - 8 * 9 ** (kk - 1),
      };
      const f = calc[kind];
      if (f) {
        traps.push(mk(f(p.digits + 1), 'prob-wrong-positions', (v) => `working with ${p.digits + 1} digits gives $${v}$, but the numbers have ${p.digits} digits`));
        if (p.digits > 3) traps.push(mk(f(p.digits - 1), 'prob-wrong-positions', (v) => `working with ${p.digits - 1} digits gives $${v}$, but the numbers have ${p.digits} digits`));
      } else {
        const orders = p.L + p.D === 2 ? 2 : p.L + p.D === 3 ? 3 : 4;
        traps.push(mk(correct * orders, 'prob-ignored-restriction', (v) => `letting the letters and digits come in any order gives $${v}$, but the letters come first`));
      }
      if (rng.chance(0.5)) traps.push(mk(2 * correct, 'prob-double-count', (v) => `doubling gives $${v}$, as if each ${kind === 'code' ? 'code' : 'number'} could be counted in two ways`));
      if (correct % 2 === 0 && rng.chance(0.5)) traps.push(mk(correct / 2, 'prob-half-count', (v) => `halving gives $${v}$, as if only half of the ${kind === 'code' ? 'codes' : 'numbers'} qualified`));
      const built = trapOnlyChoices(
        rng,
        correct,
        rng.shuffle(traps.filter((t) => t.value > 0 && Number.isInteger(t.value))),
        (v) => `$${num(v.n)}$`,
      );
      if (!built) continue;
      const cite = rng.pick(built.used);
      return {
        params: p,
        q: {
          format: 'mcs',
          stem,
          choices: built.choices,
          answer: built.answer,
          explanation: `${head}

Check: ${check}

Trap: ${cite.why(num(cite.value))}.

${rule}`,
        },
      };
    }
  },
  check(q, p) {
    let count = 0;
    if (p.kind === 'code') {
      // Enumerate the letter part and the digit part separately; every pair of parts is a code.
      const strings = (alphabet: number, len: number) => (p.repeat ? alphabet ** len : countSequences(alphabet, len));
      let letterParts = 0;
      if (p.repeat) {
        const rec = (k: number): number => (k === p.L ? 1 : Array.from({ length: p.letters }, () => rec(k + 1)).reduce((a, b) => a + b, 0));
        letterParts = rec(0);
      } else letterParts = strings(p.letters, p.L);
      const digitParts = p.repeat ? 10 ** p.D : countSequences(10, p.D);
      count = letterParts * digitParts;
    } else if (p.kind === 'palindrome') {
      // reverse each number with integer arithmetic
      const lo = 10 ** (p.digits - 1);
      for (let v = lo; v < lo * 10; v++) {
        let r = 0;
        for (let x = v; x > 0; x = Math.floor(x / 10)) r = r * 10 + (x % 10);
        if (r === v) count++;
      }
    } else {
      const lo = 10 ** (p.digits - 1);
      for (let v = lo; v < lo * 10; v++) {
        const ds = String(v).split('').map(Number);
        const distinct = new Set(ds).size === ds.length;
        let ok = false;
        if (p.kind === 'distinct') ok = distinct;
        else if (p.kind === 'odd-distinct') ok = distinct && v % 2 === 1;
        else if (p.kind === 'even-distinct') ok = distinct && v % 2 === 0;
        else if (p.kind === 'no-digit') ok = !ds.includes(p.banned);
        else if (p.kind === 'all-even') ok = ds.every((x) => x % 2 === 0);
        else ok = ds.includes(p.banned);
        if (ok) count++;
      }
    }
    return mcsCheck(q, `$${num(count)}$`);
  },
};

/* ================================================================== 4. Committees with a condition (MCS) */

type CommKind = 'mix' | 'at-least-one' | 'exactly' | 'not-both' | 'each-group';
interface CommParams {
  kind: CommKind;
  g1: number;
  g2: number;
  k: number;
  j: number;
}

const GROUPS = [
  ['teachers', 'parents', 'teacher', 'parent'],
  ['seniors', 'juniors', 'senior', 'junior'],
  ['chemists', 'biologists', 'chemist', 'biologist'],
  ['managers', 'engineers', 'manager', 'engineer'],
  ['women', 'men', 'woman', 'man'],
] as const;

const others = (m: number) => (m === 1 ? '1 other' : `${m} others`);

const committees: Template<CommParams> = {
  id: 'data.counting.committees',
  skill: SKILL,
  format: 'mcs',
  style: 'committees with a condition (exactly, at least one, not both)',
  generate(rng, d) {
    const mk = (value: number, trap: string, why: (v: string) => string) => ({ value, trap, why });
    for (;;) {
      const kind: CommKind = rng.pick(d === 1 ? (['mix', 'mix', 'exactly'] as const) : d === 2 ? (['at-least-one', 'exactly', 'mix'] as const) : (['not-both', 'each-group', 'at-least-one'] as const));
      const [p1, p2, s1, s2] = rng.pick(GROUPS);
      const g1 = rng.int(4, d === 1 ? 6 : 7);
      const g2 = rng.int(3, d === 1 ? 5 : 6);
      const n = g1 + g2;
      const k = kind === 'mix' ? rng.int(3, 4) : rng.int(3, Math.min(5, n - 3));
      let j = kind === 'mix' || kind === 'exactly' ? rng.int(1, Math.min(g2, k - 1)) : 0;
      if (kind === 'mix') j = Math.min(j, g2, k - 1);
      const intro = `A committee of ${k} is to be chosen from a group of ${g1} ${p1} and ${g2} ${p2}.`;
      let stem = '';
      let correct = 0;
      let traps: ReturnType<typeof mk>[] = [];
      let explanation = '';
      let check = '';
      const all = nCr(n, k);
      if (kind === 'mix' || kind === 'exactly') {
        const i = k - j;
        correct = nCr(g1, i) * nCr(g2, j);
        stem =
          kind === 'mix'
            ? `${intro} How many different committees are possible if the committee must consist of ${i} ${i === 1 ? s1 : p1} and ${j} ${j === 1 ? s2 : p2}?`
            : `${intro} How many different committees include exactly ${j} ${j === 1 ? s2 : p2}?`;
        let atLeast = 0;
        for (let t = j; t <= Math.min(g2, k); t++) atLeast += nCr(g1, k - t) * nCr(g2, t);
        traps = [
          mk(nCr(g1, i) + nCr(g2, j), 'prob-add-not-multiply', (v) => `adding the two counts gives $${v}$, but every choice of ${p1} can be paired with every choice of ${p2}`),
          mk(all, 'prob-ignored-restriction', (v) => `ignoring the condition gives $${v}$, which counts all the committees of ${k}`),
          mk(nPr(g1, i) * nPr(g2, j), 'prob-order-matters', (v) => `counting ordered selections gives $${v}$, but a committee has no order`),
          mk(nCr(g1, j) * nCr(g2, i), 'prob-swapped-groups', (v) => `swapping the numbers of ${p1} and ${p2} gives $${v}$`),
          mk(atLeast, 'prob-exactly-vs-at-least', (v) => `counting committees with at least ${j} ${j === 1 ? s2 : p2} gives $${v}$, which includes those with more`),
          mk(nCr(n, j), 'prob-ignored-restriction', (v) => `choosing only the ${j} ${j === 1 ? s2 : p2} from everyone gives $${v}$ and leaves out the rest of the committee`),
        ];
        explanation = `Choose the ${p1} and the ${p2} separately and multiply: $${bin(g1, i)} \\times ${bin(g2, j)} = ${nCr(g1, i)} \\times ${nCr(g2, j)} = ${num(correct)}$.`;
        check = `${i} + ${j} = ${k} members, as required; and ${num(correct)} is one part of the ${num(all)} possible committees.`;
      } else if (kind === 'at-least-one') {
        correct = all - nCr(g1, k);
        stem = `${intro} How many different committees include at least one of the ${p2}?`;
        traps = [
          mk(g2 * nCr(n - 1, k - 1), 'prob-at-least-one-overcount', (v) => `picking one ${s2} first and then any ${others(k - 1)} gives $${v}$, which counts committees with two or more ${p2} several times`),
          mk(g2 * nCr(g1, k - 1), 'prob-exactly-vs-at-least', (v) => `counting committees with exactly one ${s2} gives $${v}$ and leaves out those with more`),
          mk(all, 'prob-ignored-restriction', (v) => `ignoring the condition gives $${v}$, which includes committees with no ${s2}`),
          mk(nCr(g1, k), 'prob-answered-complement', (v) => `$${v}$ counts the committees with no ${s2}`),
          mk(all - nCr(g2, k), 'prob-wrong-set', (v) => `subtracting the committees made only of ${p2} gives $${v}$ instead of those made only of ${p1}`),
        ];
        explanation = `Use the complement: all committees minus the committees with no ${s2} (all ${p1}): $${bin(n, k)} - ${bin(g1, k)} = ${num(all)} - ${num(nCr(g1, k))} = ${num(correct)}$.`;
        check = `the committees with at least one ${s2} and those with none add up to ${num(all)}: $${num(correct)} + ${num(nCr(g1, k))}$.`;
      } else if (kind === 'not-both') {
        const [x, y] = rng.sample(NAMES, 2);
        const both = nCr(n - 2, k - 2);
        correct = all - both;
        stem = `${intro} Two of the ${n} people, ${x} and ${y}, refuse to serve on the committee together. How many different committees are possible?`;
        traps = [
          mk(nCr(n - 2, k), 'prob-excluded-both', (v) => `leaving both of them out gives $${v}$, but each may serve without the other`),
          mk(all, 'prob-ignored-restriction', (v) => `ignoring the condition gives $${v}$, which includes committees with both of them`),
          mk(both, 'prob-answered-complement', (v) => `$${v}$ counts the committees that contain both of them`),
          mk(all - 2 * both, 'prob-overlap-subtract', (v) => `subtracting the committees with both of them twice gives $${v}$`),
          mk(nCr(n - 1, k), 'prob-excluded-one', (v) => `leaving one of them out gives $${v}$, but the other may serve, with or without the first`),
        ];
        explanation = `Count the committees that contain both ${x} and ${y}: the other ${plural(k - 2, 'member')} come${k - 2 === 1 ? 's' : ''} from the remaining ${n - 2} people, $${bin(n - 2, k - 2)} = ${num(both)}$. Subtract from the total: $${bin(n, k)} - ${num(both)} = ${num(all)} - ${num(both)} = ${num(correct)}$.`;
        check = `committees with neither, only ${x} or only ${y}: $${num(nCr(n - 2, k))} + 2 \\times ${num(nCr(n - 2, k - 1))} = ${num(correct)}$.`;
      } else {
        correct = all - nCr(g1, k) - nCr(g2, k);
        stem = `${intro} How many different committees include at least one ${s1} and at least one ${s2}?`;
        traps = [
          mk(g1 * g2 * nCr(n - 2, k - 2), 'prob-at-least-one-overcount', (v) => `picking one ${s1} and one ${s2} first and then any ${others(k - 2)} gives $${v}$, which counts many committees several times`),
          mk(all - nCr(g1, k), 'prob-missed-case', (v) => `removing only the all-${p1} committees gives $${v}$ and keeps the all-${p2} ones`),
          mk(all - nCr(g2, k), 'prob-missed-case', (v) => `removing only the all-${p2} committees gives $${v}$ and keeps the all-${p1} ones`),
          mk(all, 'prob-ignored-restriction', (v) => `ignoring the condition gives $${v}$, which includes committees of one kind only`),
          mk(nCr(g1, k) + nCr(g2, k), 'prob-answered-complement', (v) => `$${v}$ counts the committees made of one kind only`),
        ];
        explanation = `Subtract the committees made of one kind only: $${bin(n, k)} - ${bin(g1, k)} - ${bin(g2, k)} = ${num(all)} - ${num(nCr(g1, k))} - ${num(nCr(g2, k))} = ${num(correct)}$.`;
        check = `the mixed committees and the one-kind committees add up to ${num(all)}: $${num(correct)} + ${num(nCr(g1, k) + nCr(g2, k))}$.`;
      }
      // the same count for a committee one member bigger or smaller
      const forSize = (kk: number): number => {
        if (kind === 'mix' || kind === 'exactly') return kk - j >= 0 ? nCr(g1, kk - j) * nCr(g2, j) : 0;
        if (kind === 'at-least-one') return nCr(n, kk) - nCr(g1, kk);
        if (kind === 'not-both') return nCr(n, kk) - (kk >= 2 ? nCr(n - 2, kk - 2) : 0);
        return nCr(n, kk) - nCr(g1, kk) - nCr(g2, kk);
      };
      for (const kk of [k + 1, k - 1])
        if (kk >= 2) traps.push(mk(forSize(kk), 'prob-wrong-size', (v) => `a committee of ${kk} gives $${v}$, but the committee has ${k} members`));
      const built = trapOnlyChoices(
        rng,
        correct,
        rng.shuffle(traps.filter((t) => t.value > 0 && Number.isInteger(t.value))),
        (v) => `$${num(v.n)}$`,
      );
      if (!built) continue;
      const cite = rng.pick(built.used);
      return {
        params: { kind, g1, g2, k, j },
        q: {
          format: 'mcs',
          stem,
          choices: built.choices,
          answer: built.answer,
          explanation: `${explanation}

Check: ${check}

Trap: ${cite.why(num(cite.value))}.

A condition on a committee is easiest as a product of separate choices, or as everything minus the cases that break it.`,
        },
      };
    }
  },
  check(q, { kind, g1, g2, k, j }) {
    const n = g1 + g2;
    // Members 0..g1-1 are in group 1; g1..n-1 in group 2. For "not both", members 0 and 1 are the pair.
    const count = countCombinations(n, k, (m) => {
      const in2 = m.filter((x) => x >= g1).length;
      switch (kind) {
        case 'mix':
        case 'exactly':
          return in2 === j;
        case 'at-least-one':
          return in2 >= 1;
        case 'not-both':
          return !(m.includes(0) && m.includes(1));
        case 'each-group':
          return in2 >= 1 && in2 <= k - 1;
      }
    });
    return mcsCheck(q, `$${num(count)}$`);
  },
};

/* ================================================================== 5. Handshakes, games, pairs (NE) */

type PairKind = 'once' | 'twice' | 'reverse' | 'triangles' | 'two-groups' | 'diagonals';
interface PairParams {
  kind: PairKind;
  n: number;
  t: number;
  b: number;
  total: number;
}

const pairs: Template<PairParams> = {
  id: 'data.counting.pairs',
  skill: SKILL,
  format: 'ne',
  style: 'handshakes, round-robin games and pairs (also solved backward)',
  generate(rng, d) {
    const kind: PairKind = rng.pick(
      d === 1 ? (['once', 'once', 'twice'] as const) : d === 2 ? (['twice', 'reverse', 'once'] as const) : (['reverse', 'triangles', 'two-groups', 'diagonals'] as const),
    );
    const n =
      kind === 'reverse'
        ? d === 2
          ? rng.int(8, 16)
          : rng.int(12, 30)
        : kind === 'triangles'
          ? rng.int(6, 14)
          : kind === 'two-groups'
            ? rng.int(4, 12)
            : kind === 'diagonals'
              ? rng.int(6, 20)
              : d === 1
                ? rng.int(4, 10)
                : rng.int(11, kind === 'twice' ? 16 : 19);
    const t = kind === 'twice' ? rng.int(2, 3) : 1;
    const b = kind === 'two-groups' ? rng.int(4, 12) : 0;
    let stem = '';
    let answer = 0;
    let total = 0;
    let suffix: string | undefined;
    const traps: { value: Frac; trap: string }[] = [];
    let explanation = '';
    const pairsN = (n * (n - 1)) / 2;
    if (kind === 'once' || kind === 'twice') {
      answer = t * pairsN;
      const times = t === 1 ? 'exactly once' : t === 2 ? 'exactly twice' : 'exactly 3 times';
      const ctx = rng.pick([
        `In a chess tournament, each of the ${n} players played each of the other players ${times}. How many games were played in all?`,
        `In a soccer league of ${n} teams, each team played each of the other teams ${times} during the season. How many games were played in all?`,
        `In a debate league of ${n} teams, each team debated each of the other teams ${times}. How many debates took place in all?`,
        `Each of the ${n} members of a tennis club played each of the other members ${times}. How many matches were played in all?`,
        `At a board-game night, each of the ${n} guests played one game against each of the other guests ${t === 1 ? 'exactly once' : times}. How many games were played in all?`,
        ...(t === 1
          ? [
              `At a conference, each of the ${n} participants shook hands exactly once with each of the other participants. How many handshakes took place?`,
              `At a reunion, each of the ${n} guests greeted each of the other guests with exactly one hug. How many hugs were exchanged in all?`,
            ]
          : []),
      ]);
      stem = ctx;
      traps.push({ value: frac(t * n * (n - 1)), trap: 'prob-handshake-double' });
      if (t > 1) traps.push({ value: frac(pairsN), trap: 'prob-ignored-restriction' });
      explanation = `The number of different pairs is $${bin(n, 2)} = \\frac{${n} \\times ${n - 1}}{2} = ${num(pairsN)}$${
        t > 1 ? `, and each pair meets ${t} times: $${t} \\times ${num(pairsN)} = ${num(answer)}$` : ''
      }.

$${n} \\times ${n - 1}$ counts every pair twice, once from each side.`;
    } else if (kind === 'reverse') {
      answer = n;
      total = pairsN;
      const ctx = rng.pick([
        { s: `At a party, each guest shook hands exactly once with each of the other guests. If there were ${plainNum(total)} handshakes in all, how many guests were at the party?`, suffix: 'guests' },
        { s: `In a tennis tournament, each player played exactly one match against each of the other players. If ${plainNum(total)} matches were played in all, how many players were in the tournament?`, suffix: 'players' },
        { s: `In a chess club, every member played exactly one game against every other member. If ${plainNum(total)} games were played in all, how many members does the club have?`, suffix: 'members' },
        { s: `At a reunion, each person greeted every other person exactly once with a handshake. If there were ${plainNum(total)} handshakes in all, how many people were at the reunion?`, suffix: 'people' },
      ]);
      stem = ctx.s;
      suffix = ctx.suffix;
      traps.push({ value: frac(Math.round(Math.sqrt(total))), trap: 'prob-handshake-double' });
      explanation = `With $n$ people there are $\\frac{n(n-1)}{2}$ handshakes, so $n(n-1) = 2 \\times ${num(total)} = ${num(2 * total)}$. Two consecutive integers with product ${num(2 * total)}: $${n} \\times ${n - 1}$. So $n = ${n}$.

Forgetting to double (solving $n(n-1) = ${num(total)}$ or taking $\\sqrt{${num(total)}}$) misses the fact that each handshake involves two people.`;
    } else if (kind === 'diagonals') {
      answer = (n * (n - 3)) / 2;
      stem = `A convex polygon has ${n} sides. A diagonal is a segment that joins two vertices that are not next to each other. How many diagonals does the polygon have?`;
      traps.push({ value: frac(pairsN), trap: 'prob-ignored-restriction' }, { value: frac(n * (n - 3)), trap: 'prob-handshake-double' }, { value: frac(pairsN - n - 1), trap: 'prob-missed-case' });
      explanation = `Every pair of vertices is joined by a segment, $${bin(n, 2)} = ${num(pairsN)}$ of them, but ${n} of these segments are sides of the polygon, not diagonals: $${num(pairsN)} - ${n} = ${num(answer)}$.

Equivalently each vertex has $${n} - 3$ diagonals and every diagonal is counted from both ends: $\\frac{${n}(${n - 3})}{2}$. Taking all $${num(pairsN)}$ segments counts the sides too.`;
    } else if (kind === 'triangles') {
      answer = nCr(n, 3);
      stem = `${word(n).replace(/^./, (c) => c.toUpperCase())} different points lie on a circle. How many different triangles have all three of their vertices among these ${n} points?`;
      traps.push({ value: frac(nPr(n, 3)), trap: 'prob-order-matters' }, { value: frac(nPr(n, 3) / 2), trap: 'prob-order-matters' });
      explanation = `No three points on a circle are on a line, so every choice of 3 points gives a triangle, and the order of the vertices does not matter: $${bin(n, 3)} = \\frac{${n} \\times ${n - 1} \\times ${n - 2}}{3!} = ${num(answer)}$.

$${n} \\times ${n - 1} \\times ${n - 2} = ${num(nPr(n, 3))}$ counts each triangle $3! = 6$ times.`;
    } else {
      answer = n * b + pairsN;
      stem = `At a reception, each of the ${n} members of a host committee shook hands exactly once with each of the ${b} guests and exactly once with each of the other committee members. The guests did not shake hands with one another. How many handshakes took place?`;
      traps.push({ value: frac(n * b + n * (n - 1)), trap: 'prob-handshake-double' }, { value: frac(n * b), trap: 'prob-missed-case' }, { value: frac(nCr(n + b, 2)), trap: 'prob-ignored-restriction' });
      explanation = `Committee–guest handshakes: every one of the ${n} members with every one of the ${b} guests, $${n} \\times ${b} = ${num(n * b)}$. Handshakes among the members: $${bin(n, 2)} = ${num(pairsN)}$. Total: $${num(n * b)} + ${num(pairsN)} = ${num(answer)}$.

Counting the members' handshakes as $${n} \\times ${n - 1}$ counts each of them twice.`;
    }
    // a mistake that gives the answer is not a mistake: draw again
    if (traps.some((x) => x.value.eq(answer))) return pairs.generate(rng, d);
    return {
      params: { kind, n, t, b, total },
      q: { format: 'ne', stem, answer: frac(answer), ...(suffix ? { suffix } : {}), traps, explanation },
    };
  },
  check(q, { kind, n, t, b, total }) {
    const countPairs = (m: number) => {
      let c = 0;
      for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) c++;
      return c;
    };
    let expected = 0;
    if (kind === 'once' || kind === 'twice') expected = t * countPairs(n);
    else if (kind === 'reverse') {
      for (let m = 2; m < 200; m++)
        if (countPairs(m) === total) {
          expected = m;
          break;
        }
    } else if (kind === 'triangles') {
      let c = 0;
      forEachCombination(n, 3, () => c++);
      expected = c;
    } else if (kind === 'diagonals') {
      // vertices 0..n-1 around the polygon; count the pairs that are not neighbours
      let c = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (j - i !== 1 && !(i === 0 && j === n - 1)) c++;
      expected = c;
    } else {
      // People 0..n-1 are committee members, n..n+b-1 guests. Count pairs that shake hands.
      let c = 0;
      for (let i = 0; i < n + b; i++) for (let j = i + 1; j < n + b; j++) if (i < n) c++;
      expected = c;
    }
    return neCheck(q, frac(expected));
  },
};

/* ================================================================== 6. Counting outcomes: digit conditions, distinct products (QC) */

type DigitCond = 'different' | 'both-odd' | 'both-even' | 'sum' | 'units-greater' | 'palindrome';
interface OutcomeParams {
  kind: 'digits' | 'products' | 'sums' | 'sum-range';
  cond: DigitCond;
  s: number;
  S: number[];
  T: number[];
  k: number;
}

const DIGIT_TEXT: Record<DigitCond, (s: number) => string> = {
  different: () => 'The number of two-digit positive integers whose tens digit and units digit are different',
  'both-odd': () => 'The number of two-digit positive integers whose digits are both odd',
  'both-even': () => 'The number of two-digit positive integers whose digits are both even',
  sum: (s) => `The number of two-digit positive integers whose digits have a sum of ${s}`,
  'units-greater': () => 'The number of two-digit positive integers whose units digit is greater than their tens digit',
  palindrome: () => 'The number of three-digit positive integers that read the same forward and backward (such as 474)',
};

function digitCount(cond: DigitCond, s: number): { count: number; trap?: number; trapId?: string; why: string } {
  switch (cond) {
    case 'different':
      return { count: 81, trap: 90, trapId: 'prob-ignored-restriction', why: 'There are 90 two-digit integers (10 through 99), and exactly 9 of them have equal digits (11, 22, ..., 99). So $90 - 9 = 81$ have different digits. Equivalently: 9 choices for the tens digit (not 0), then 9 for the units digit (anything but the tens digit).' };
    case 'both-odd':
      return { count: 25, why: 'Each digit can be 1, 3, 5, 7 or 9: $5 \\times 5 = 25$.' };
    case 'both-even':
      return { count: 20, trap: 25, trapId: 'prob-leading-zero', why: 'The tens digit can be 2, 4, 6 or 8 (not 0), and the units digit 0, 2, 4, 6 or 8: $4 \\times 5 = 20$.' };
    case 'sum': {
      const c = s <= 9 ? s : 19 - s;
      const lo = s <= 9 ? 1 : s - 9;
      const hi = s <= 9 ? s : 9;
      return {
        count: c,
        ...(s <= 9 ? { trap: s + 1, trapId: 'prob-leading-zero' } : {}),
        why: `The tens digit $t$ determines the units digit $${s} - t$, which must be a digit from 0 to 9. So $t$ runs from ${lo} to ${hi}: ${c} integers (${Array.from({ length: c }, (_, i) => `${lo + i}${s - lo - i}`).join(', ')}).`,
      };
    }
    case 'units-greater':
      return { count: 36, trap: 45, trapId: 'prob-leading-zero', why: 'Any 2 different digits from 1 to 9, written in increasing order, give exactly one such integer (the tens digit cannot be 0): $\\binom{9}{2} = 36$.' };
    case 'palindrome':
      return { count: 90, trap: 100, trapId: 'prob-leading-zero', why: 'The first digit (also the last) has 9 choices (not 0) and the middle digit has 10: $9 \\times 10 = 90$.' };
  }
}

const outcomesQC: Template<OutcomeParams> = {
  id: 'data.counting.outcomes-qc',
  skill: SKILL,
  format: 'qc',
  style: 'count integers with a digit condition, or distinct products of two sets, against a number',
  generate(rng, d) {
    const kind = rng.pick(d === 1 ? (['digits', 'digits', 'products'] as const) : (['digits', 'products', 'sums', 'sum-range', 'sum-range'] as const));
    const p: OutcomeParams = { kind, cond: 'different', s: 0, S: [], T: [], k: 0 };
    let info: string | undefined;
    let qa = '';
    let count = 0;
    let traps: QCQuestion['traps'];
    let why = '';
    if (kind === 'digits') {
      p.cond = rng.pick(d === 1 ? (['different', 'both-odd', 'both-even', 'sum'] as const) : (['different', 'both-even', 'sum', 'units-greater', 'palindrome'] as const));
      p.s = rng.int(4, 14);
      const r = digitCount(p.cond, p.s);
      count = r.count;
      qa = DIGIT_TEXT[p.cond](p.s);
      why = r.why;
      const roll = rng.next();
      if (r.trap !== undefined && roll < 0.25) p.k = r.trap;
      else if (roll < 0.5) p.k = count;
      else if (roll < 0.8) p.k = count - rng.int(1, 2);
      else p.k = count + rng.int(1, 2);
      if (r.trap !== undefined) traps = { [qcCompare(r.trap, p.k)]: r.trapId! };
    } else if (kind === 'sum-range') {
      // the count depends on an unknown digit sum s, so the comparison can depend on s
      p.cond = 'sum';
      const count = (sum: number) => (sum <= 9 ? sum : 19 - sum);
      const lo = rng.int(2, 12);
      const hi = lo + rng.int(2, 6);
      p.T = [lo, hi];
      const counts = Array.from({ length: hi - lo + 1 }, (_, i) => count(lo + i));
      p.k = rng.chance(0.6) ? rng.int(Math.min(...counts), Math.max(...counts)) : rng.chance(0.5) ? Math.min(...counts) - rng.int(1, 2) : Math.max(...counts) + rng.int(1, 2);
      if (p.k < 1) p.k = 1;
      info = `$s$ is an integer with $${lo} \\le s \\le ${hi}$.`;
      qa = DIGIT_TEXT.sum(0).replace('a sum of 0', 'a sum of $s$');
      const rels = new Set(counts.map((c) => qcCompare(c, p.k)));
      const ansRange: QCChoice = rels.size > 1 ? 'D' : [...rels][0];
      why = `The number of two-digit integers with digit sum $s$ is $s$ when $s \\le 9$ and $19 - s$ when $s \\ge 10$. For $s = ${lo}, \\ldots, ${hi}$ the counts are $${counts.join(',\\ ')}$, compared with $${p.k}$.`;
      if (ansRange !== 'D') traps = { D: 'prob-unknown-means-d' };
      return {
        params: p,
        q: {
          format: 'qc',
          info,
          quantityA: qa,
          quantityB: `$${num(p.k)}$`,
          answer: ansRange,
          ...(traps ? { traps } : {}),
          explanation: `${why} ${
            ansRange === 'D'
              ? `The count is ${[...rels]
                  .sort()
                  .map((r) => (r === 'A' ? `greater than $${p.k}$` : r === 'B' ? `less than $${p.k}$` : `equal to $${p.k}$`))
                  .map((t, i, all) => (i === 0 ? `${t} for some values of $s$` : i === all.length - 1 ? `${all.length > 2 ? ', and ' : ' and '}${t} for ${all.length > 2 ? 'others still' : 'others'}` : `, ${t} for others`))
                  .join('')}, so the relationship cannot be determined. (D)`
              : `Every count is ${ansRange === 'A' ? 'greater' : 'less'} than $${p.k}$, so ${rel(ansRange)}. (${ansRange})`
          }`,
        },
      };
    } else {
      const m = rng.int(2, d === 1 ? 3 : 4);
      const n = rng.int(3, 4);
      do {
        p.S = rng.sample([1, 2, 3, 4, 5, 6, 8, 9], m).sort((u, v) => u - v);
        p.T = rng.sample(kind === 'sums' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 8, 9, 10, 12], n).sort((u, v) => u - v);
        const vals = new Set<number>();
        for (const x of p.S) for (const y of p.T) vals.add(kind === 'products' ? x * y : x + y);
        count = vals.size;
      } while (m * n - count > 3);
      info = `$S = \\{${p.S.join(', ')}\\}$ and $T = \\{${p.T.join(', ')}\\}$. The number $x$ is in $S$ and the number $y$ is in $T$.`;
      const op = kind === 'products' ? 'xy' : 'x + y';
      qa = `The number of different values of $${op}$`;
      p.k = rng.chance(0.35) ? m * n : count + rng.pick([-1, -1, 0, 1]);
      if (p.k === m * n && count < m * n) traps = { C: 'prob-assumed-distinct' };
      const vals = new Map<number, string[]>();
      for (const x of p.S) for (const y of p.T) {
        const v = kind === 'products' ? x * y : x + y;
        vals.set(v, [...(vals.get(v) ?? []), kind === 'products' ? `${x} \\times ${y}` : `${x} + ${y}`]);
      }
      const repeats = [...vals.entries()].filter(([, ws]) => ws.length > 1);
      why = `There are $${m} \\times ${n} = ${m * n}$ pairs $(x, y)$, but different pairs can give the same value. ${
        repeats.length
          ? `Here ${repeats.map(([v, ws]) => `$${ws.join(' = ')} = ${v}$`).join(', ')}, so the number of different values is $${num(count)}$.`
          : `Listing them shows that all ${m * n} values are different.`
      }`;
    }
    const answer = qcCompare(count, p.k);
    if (traps && traps[answer]) traps = undefined;
    return {
      params: p,
      q: {
        format: 'qc',
        info,
        quantityA: qa,
        quantityB: `$${num(p.k)}$`,
        answer,
        ...(traps ? { traps } : {}),
        explanation: `${why}

Compare $${num(count)}$ with $${num(p.k)}$: ${rel(answer)}. (${answer})`,
      },
    };
  },
  check(q, p) {
    let count = 0;
    if (p.kind === 'sum-range') {
      // for every s in the range, count the two-digit integers with that digit sum
      const samples: [number, number][] = [];
      for (let sum = p.T[0]; sum <= p.T[1]; sum++) {
        let c = 0;
        for (let v = 10; v <= 99; v++) if (Math.floor(v / 10) + (v % 10) === sum) c++;
        samples.push([c, p.k]);
      }
      const expectedRange = qcFromSamples(samples);
      return q.format === 'qc' && q.answer === expectedRange ? null : `expected ${expectedRange}`;
    }
    if (p.kind === 'digits') {
      const [lo, hi] = p.cond === 'palindrome' ? [100, 999] : [10, 99];
      for (let v = lo; v <= hi; v++) {
        const ds = String(v).split('').map(Number);
        const ok =
          p.cond === 'different'
            ? ds[0] !== ds[1]
            : p.cond === 'both-odd'
              ? ds.every((x) => x % 2 === 1)
              : p.cond === 'both-even'
                ? ds.every((x) => x % 2 === 0)
                : p.cond === 'sum'
                  ? ds[0] + ds[1] === p.s
                  : p.cond === 'units-greater'
                    ? ds[1] > ds[0]
                    : ds[0] === ds[2];
        if (ok) count++;
      }
    } else {
      // Scan every candidate value and test whether some pair produces it.
      const max = Math.max(...p.S) * Math.max(...p.T) + Math.max(...p.S) + Math.max(...p.T);
      for (let v = 1; v <= max; v++) {
        const hit = p.S.some((x) => (p.kind === 'products' ? v % x === 0 && p.T.includes(v / x) : p.T.includes(v - x)));
        if (hit) count++;
      }
    }
    const expected = qcCompare(count, p.k);
    return q.format === 'qc' && q.answer === expected ? null : `expected ${expected} (count ${count})`;
  },
};

function plainNum(x: number): string {
  return x.toLocaleString('en-US');
}

export const countingTemplates: Template<any>[] = [compareCountsQC, outcomesQC, arrangements, codes, committees, pairs];

// Used by the other files of this folder.
export { bin };
