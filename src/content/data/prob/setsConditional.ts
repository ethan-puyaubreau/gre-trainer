import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';

// Quantity comparison on two conditional percents of the same overlap: "of group A, the percent also
// in group B" against "of group B, the percent also in group A". Same top, different bases.
export const setsConditionalTraps: Record<string, Trap> = {
  'prob-cond-same-overlap': {
    label: 'Called the two percents equal because the same people are in both groups',
    fix: 'The overlap is the same, but each percent divides it by a different group. The smaller group gives the larger percent.',
  },
  'prob-cond-larger-base': {
    label: 'Thought the larger group gives the larger percent',
    fix: 'Percent = overlap divided by the group. With the same overlap, the larger group gives the smaller percent.',
  },
  'prob-cond-relation-ignored': {
    label: 'Answered D although the information about the group sizes settles it',
    fix: 'Which group is larger decides the comparison, and the overlap is the same in both percents. Use the relation you are given.',
  },
  'prob-cond-one-case': {
    label: 'Judged from one possible case only',
    fix: 'When the sizes of the groups are not fixed, try a case with the first group larger and a case with the second larger. If the answers differ, it is D.',
  },
};

interface Ctx {
  pop: (n: string) => string; // "Of the 80 members of a club"
  grp: string; // "the members of a sports club"
  plural: string; // "members"
  nounA: string;
  nounB: string;
  vA: string; // "play tennis"
  vB: string; // "play golf"
  both: string; // "play both tennis and golf"
  alsoA: string; // phrase for members of A: "also play golf"
  alsoB: string;
  notA: string; // "do not play golf" (for members of A)
  notB: string;
}

const CTX: Ctx[] = [
  { pop: (n) => `Of the ${n} members of a sports club`, grp: 'the members of a sports club', plural: 'members', nounA: 'tennis players', nounB: 'golfers', vA: 'play tennis', vB: 'play golf', both: 'play both tennis and golf', alsoA: 'also play golf', alsoB: 'also play tennis', notA: 'do not play golf', notB: 'do not play tennis' },
  { pop: (n) => `Of the ${n} employees at a firm`, grp: 'the employees at a firm', plural: 'employees', nounA: 'French speakers', nounB: 'Spanish speakers', vA: 'speak French', vB: 'speak Spanish', both: 'speak both French and Spanish', alsoA: 'also speak Spanish', alsoB: 'also speak French', notA: 'do not speak Spanish', notB: 'do not speak French' },
  { pop: (n) => `Of the ${n} households in a neighborhood`, grp: 'the households in a neighborhood', plural: 'households', nounA: 'dog owners', nounB: 'cat owners', vA: 'own a dog', vB: 'own a cat', both: 'own both a dog and a cat', alsoA: 'also own a cat', alsoB: 'also own a dog', notA: 'do not own a cat', notB: 'do not own a dog' },
  { pop: (n) => `Of the ${n} students in a grade`, grp: 'the students in a grade', plural: 'students', nounA: 'biology students', nounB: 'chemistry students', vA: 'take biology', vB: 'take chemistry', both: 'take both biology and chemistry', alsoA: 'also take chemistry', alsoB: 'also take biology', notA: 'do not take chemistry', notB: 'do not take biology' },
];

type Mode = 'exact' | 'percent' | 'relation' | 'range';
type Rel = 'more' | 'fewer' | 'equal' | 'none';

interface CondParams {
  mode: Mode;
  negate: boolean;
  N: number;
  a: number;
  b: number;
  c: number;
  bLo: number;
  bHi: number;
  rel: Rel;
}

const flip = (x: QCChoice): QCChoice => (x === 'A' ? 'B' : x === 'B' ? 'A' : x);

/** Value of Quantity A and B for given sizes (exact). */
const pair = (negate: boolean, a: number, b: number, c: number): [Frac, Frac] => (negate ? [new Frac(a - c, a), new Frac(b - c, b)] : [new Frac(c, a), new Frac(c, b)]);

interface Sample {
  r: [Frac, Frac];
  x: number;
  y: number;
  cc: number;
}

const conditional: Template<CondParams> = {
  id: 'data.sets.conditional-percent',
  skill: 'data.sets',
  format: 'qc',
  style: 'compare "percent of A also in B" with "percent of B also in A" (same overlap, different bases)',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    const mode: Mode = d === 1 ? 'exact' : d === 2 ? rng.pick(['exact', 'percent', 'percent']) : rng.pick(['relation', 'relation', 'range']);
    const negate = d >= 2 && rng.chance(0.4);
    for (;;) {
      const N = mode === 'percent' ? 100 : mode === 'relation' ? rng.pick([30, 40, 50, 60]) : rng.pick([60, 80, 100, 120, 150]);
      const step = mode === 'percent' ? 5 : 1;
      const draw = () => rng.int(Math.round((N * 0.25) / step), Math.round((N * 0.7) / step)) * step;
      let a = draw();
      let b = draw();
      if (d === 1 && rng.chance(0.2)) b = a;
      const c = rng.int(Math.round((N * 0.08) / step), Math.round((Math.min(a, b) * 0.8) / step)) * step;
      let bLo = b;
      let bHi = b;
      let rel: Rel = 'none';
      if (c < step || c >= Math.min(a, b) || a + b - c > N) continue;
      if (mode === 'range') {
        bLo = b - rng.int(1, 6);
        bHi = b + rng.int(1, 6);
        if (bLo <= c) continue;
        if (a + bHi - c > N) continue;
      }
      if (mode === 'relation') {
        rel = rng.pick(['more', 'fewer', 'equal', 'none', 'none'] as const);
        if (rel === 'more') [a, b] = [Math.min(a, b), Math.max(a, b)];
        if (rel === 'fewer') [a, b] = [Math.max(a, b), Math.min(a, b)];
        if (a === b && rel !== 'equal') continue;
      }
      // Answer from exact samples of the allowed sizes.
      const samples: Sample[] = [];
      const add = (x: number, y: number, cc: number) => samples.push({ r: pair(negate, x, y, cc), x, y, cc });
      if (mode === 'relation') {
        for (let x = 2; x <= N; x++)
          for (let y = 2; y <= N; y++) {
            if (rel === 'more' && !(y > x)) continue;
            if (rel === 'fewer' && !(y < x)) continue;
            if (rel === 'equal' && x !== y) continue;
            for (const cc of [1, 2, Math.min(x, y) - 1]) if (cc >= 1 && cc < Math.min(x, y) && x + y - cc <= N) add(x, y, cc);
          }
      } else if (mode === 'range') {
        for (let y = bLo; y <= bHi; y++) add(a, y, c);
      } else add(a, b, c);
      const ans = qcFromSamples(samples.map((s) => s.r));
      if (mode === 'range' && ans !== 'D' && rng.chance(0.4)) continue;
      if (mode === 'relation' && rel === 'none' && ans !== 'D') continue;

      // Statement
      let info: string;
      if (mode === 'percent') info = `In a survey of ${ctx.grp}, $${a}\\%$ ${ctx.vA}, $${b}\\%$ ${ctx.vB}, and $${c}\\%$ ${ctx.both}.`;
      else if (mode === 'exact') info = `${ctx.pop(String(N))}, ${a} ${ctx.vA}, ${b} ${ctx.vB}, and ${c} ${ctx.both}.`;
      else if (mode === 'range') info = `${ctx.pop(String(N))}, ${a} ${ctx.vA}, ${c} ${ctx.both}, and the number who ${ctx.vB} is a whole number from ${bLo} to ${bHi}, inclusive.`;
      else {
        const infoRel = rel === 'more' ? ` More ${ctx.plural} ${ctx.vB} than ${ctx.vA}.` : rel === 'fewer' ? ` Fewer ${ctx.plural} ${ctx.vB} than ${ctx.vA}.` : rel === 'equal' ? ` The same number of ${ctx.plural} ${ctx.vA} as ${ctx.vB}.` : '';
        info = `${ctx.pop(String(N))}, some ${ctx.vA}, some ${ctx.vB}, and some ${ctx.both}, but not all of either group.${infoRel}`;
      }
      const qa = negate ? `The percent of the ${ctx.nounA} who ${ctx.notA}` : `The percent of the ${ctx.nounA} who ${ctx.alsoA}`;
      const qb = negate ? `The percent of the ${ctx.nounB} who ${ctx.notB}` : `The percent of the ${ctx.nounB} who ${ctx.alsoB}`;

      // Traps by letter
      const tr: Partial<Record<QCChoice, string>> = {};
      if (ans === 'D') {
        const first = qcFromSamples([samples[0].r]);
        if (first !== 'D') tr[first] = 'prob-cond-one-case';
      } else {
        if (mode === 'relation' || mode === 'range') tr.D = 'prob-cond-relation-ignored';
        if (ans !== 'C') tr.C = 'prob-cond-same-overlap';
        if (ans === 'A' || ans === 'B') tr[flip(ans)] = 'prob-cond-larger-base';
      }
      delete tr[ans];

      // Explanation
      const fracTex = (n: number, dd: number) => `\\dfrac{${n}}{${dd}}`;
      const which = (s: Sample) => qcFromSamples([s.r]);
      let body: string;
      if (mode === 'exact' || mode === 'percent') {
        const [qA, qB] = pair(negate, a, b, c);
        const topA = negate ? a - c : c;
        const topB = negate ? b - c : c;
        body = `Recognize: each percent is a fraction with its own group underneath. Quantity A is $${fracTex(topA, a)}$ and Quantity B is $${fracTex(topB, b)}$.\n\n${
          negate
            ? `Reduced, $${fracTex(topA, a)} = ${qA.toTex()}$ and $${fracTex(topB, b)} = ${qB.toTex()}$. The group with more members is mostly outside the overlap, so its percent of non-overlap is larger.`
            : a === b
              ? `The groups have the same size and the same overlap, so the fractions are equal.`
              : `The top is the same, ${c}, so the group with fewer members, ${Math.min(a, b)}, gives the larger fraction.`
        }`;
      } else if (mode === 'range') {
        const lo = pair(negate, a, bLo, c);
        const hi = pair(negate, a, bHi, c);
        body = `Quantity A is fixed at $${lo[0].toTex()}$. Quantity B depends on the size of the second group: it is $${lo[1].toTex()}$ at ${bLo} and $${hi[1].toTex()}$ at ${bHi}.\n\n${ans === 'D' ? 'Quantity A lies between these two values, so B is smaller for some allowed sizes and larger for others.' : 'Quantity A is on the same side of B for every allowed size.'}`;
      } else if (rel === 'none') {
        const pick = (w: QCChoice) => samples.find((s) => which(s) === w && s.cc === 2 && s.x >= 8 && s.y >= 8) ?? samples.find((s) => which(s) === w)!;
        const sa = pick('A');
        const sb = pick('B');
        body = `Let $c$ be the number in both. The percents have the same $c$ but different groups underneath, and nothing says which group is larger, so test two cases.\n\n- ${sa.x} in the first group, ${sa.y} in the second, ${sa.cc} in both: Quantity A is greater.\n- ${sb.x} in the first group, ${sb.y} in the second, ${sb.cc} in both: Quantity B is greater.`;
      } else if (rel === 'equal') {
        body = `The two groups have the same size, and the overlap is the same, so each percent is the same number of people divided by the same group size. The quantities are equal.`;
      } else {
        body = `Let $c$ be the number in both. The percents are built from the same $c > 0$ over group sizes $a$ and $b$, and ${rel === 'more' ? 'the second group is larger' : 'the first group is larger'}. ${negate ? 'The members outside the overlap are a larger share of the larger group, so the percent about the larger group is the greater one.' : 'The smaller group gives the larger percent.'}`;
      }
      const verdict = ans === 'D' ? 'So the relationship cannot be determined.' : ans === 'C' ? 'So the two quantities are equal.' : ans === 'A' ? 'So Quantity A is greater.' : 'So Quantity B is greater.';
      return {
        params: { mode, negate, N, a, b, c, bLo, bHi, rel },
        q: {
          format: 'qc',
          info,
          quantityA: qa,
          quantityB: qb,
          answer: ans,
          ...(Object.keys(tr).length ? { traps: tr as QCQuestion['traps'] } : {}),
          explanation: `${body}\n\n${verdict} (${ans})\n\nTrap: the same overlap does not make the percents equal; each is divided by its own group.\n\nCompare overlap-over-group fractions; the group sizes decide.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'qc') return 'wrong format';
    // Brute force over populations: every person is in A, B, both or neither.
    const results = new Set<string>();
    const consider = (a: number, b: number, c: number) => {
      const share = (grp: number) => (p.negate ? grp - c : c) / grp;
      const A = share(a);
      const B = share(b);
      results.add(Math.abs(A - B) < 1e-12 ? 'C' : A > B ? 'A' : 'B');
    };
    if (p.mode === 'range') for (let y = p.bLo; y <= p.bHi; y++) consider(p.a, y, p.c);
    else if (p.mode === 'relation') {
      for (let x = 2; x <= p.N; x++)
        for (let y = 2; y <= p.N; y++) {
          if (p.rel === 'more' && !(y > x)) continue;
          if (p.rel === 'fewer' && !(y < x)) continue;
          if (p.rel === 'equal' && x !== y) continue;
          for (let c = 1; c < Math.min(x, y); c++) if (x + y - c <= p.N) consider(x, y, c);
        }
    } else consider(p.a, p.b, p.c);
    const expected = results.size > 1 ? 'D' : [...results][0];
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const setsConditionalTemplates: Template<any>[] = [conditional];
