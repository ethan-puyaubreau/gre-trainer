import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { trapChoices } from './util';

export const linearWordTraps: Record<string, Trap> = {
  'alg-lin-word-other-end': {
    label: 'Answered with the other end of the list (least instead of greatest, or the reverse)',
    fix: 'Solve for the variable you defined, then build the term the question asks for from it.',
  },
  'alg-lin-word-mean': {
    label: 'Gave the average of the terms as an end of the list',
    fix: 'The average of an evenly spaced list is its middle, not an end: add or subtract half the total spread.',
  },
  'alg-lin-word-gap-count': {
    label: 'Counted the wrong number of gaps between the terms',
    fix: '$n$ terms have $n - 1$ gaps, so the greatest term is the least plus $(n - 1)$ steps.',
  },
  'alg-lin-word-step': {
    label: 'Used a step of 1 for evenly spaced numbers that are not consecutive integers',
    fix: 'Consecutive even integers, odd integers or multiples of $m$ are $2$ (or $m$) apart, so each term is the previous one plus the step.',
  },
  'alg-lin-word-one-n': {
    label: 'Added the years once instead of for each person',
    fix: 'In $N$ years EVERY person is $N$ years older, so a sum of two ages grows by $2N$.',
  },
  'alg-lin-word-forgot-multiple': {
    label: 'Forgot Tom\'s own age when writing the sum of the two ages',
    fix: 'If Maria is $3t + 2$, the two ages add up to $t + (3t + 2) = 4t + 2$, not $3t + 2$.',
  },
  'alg-lin-word-now-vs-later': {
    label: 'Gave an age at the wrong time (now instead of later, or the reverse)',
    fix: 'Find the age NOW first, then add the years that pass only if the question asks about later.',
  },
};

interface Params {
  kind: 'consec' | 'ages';
  /** consec: [n, step, sum, asked (0 least, 1 greatest), type (0 integers, 1 even, 2 odd, 3 multiples)]. ages: [a, b, N, sum, asked]. */
  k: number[];
  values: number[];
}

const ageWord = (a: number) => (a === 2 ? 'twice' : a === 3 ? 'three times' : 'four times');

const linearWordMCS: Template<Params> = {
  id: 'alg.linear-equations.word-mcs',
  skill: 'alg.linear-equations',
  format: 'mcs',
  style: 'consecutive numbers and ages set up as a linear equation',
  generate(rng, d) {
    for (;;) {
      const kind: Params['kind'] = d === 1 ? 'consec' : d === 2 ? rng.pick(['consec', 'ages']) : rng.pick(['consec', 'ages', 'ages']);
      let stem: string;
      let key: number;
      let k: number[];
      let steps: string;
      let rule: string;
      const cand: { value: number; trap: string; why: string }[] = [];
      if (kind === 'consec') {
        const n0 = d === 1 ? rng.pick([3, 5]) : rng.pick([3, 4, 5]);
        const type = d === 1 ? 0 : d === 2 ? rng.pick([1, 2, 0, 1, 2]) : rng.pick([3, 3, 1, 2]);
        const m = type === 1 || type === 2 ? 2 : type === 3 ? rng.pick([3, 4, 5, 6, 7, 9]) : 1;
        const n = m === 1 && n0 === 4 ? 5 : n0;
        let x = rng.int(type === 3 ? -4 : -12, type === 3 ? 14 : 60);
        if (type === 1) x = 2 * Math.floor(x / 2);
        if (type === 2) x = 2 * Math.floor(x / 2) + 1;
        if (type === 3) x *= m;
        const S = n * x + (m * n * (n - 1)) / 2;
        if (S <= 0 || x === 0) continue;
        const asked = rng.int(0, 1);
        const span = m * (n - 1);
        key = asked === 1 ? x + span : x;
        k = [n, m, S, asked, type];
        const noun = ['integers', 'even integers', 'odd integers', `multiples of ${m}`][type];
        const gaps = (n * (n - 1)) / 2;
        stem = `The sum of ${n} consecutive ${noun} is ${S}. What is the ${asked ? 'greatest' : 'least'} of these numbers?`;
        const terms = Array.from({ length: n }, (_, i) => `x${i === 0 ? '' : ` + ${m * i}`}`).join(', ');
        steps = `Let $x$ be the least. The ${n} numbers are $${terms}$, and they add up to $${n}x + ${m * gaps} = ${S}$. So $${n}x = ${S - m * gaps}$ and $x = ${num(x)}$${asked ? `. The greatest is $x + ${span} = ${num(key)}$` : ''}.

Check: ${Array.from({ length: n }, (_, i) => num(x + m * i)).map((t) => `$${t}$`).join(', ')} add up to $${S}$.`;
        rule = type === 0 ? 'Name the least number $x$; the others are $x + 1$, $x + 2$, and so on.' : `Name the least number $x$; the others are $x + ${m}$, $x + ${2 * m}$, and so on, since the numbers are ${m} apart.`;
        const other = asked ? x : x + span;
        cand.push({ value: other, trap: 'alg-lin-word-other-end', why: `${asked ? 'The least number' : 'The greatest number'} is $${num(other)}$, but the question asks for the ${asked ? 'greatest' : 'least'}.` });
        const mean = new Frac(S, n);
        cand.push({ value: mean.isInt() ? mean.n : NaN, trap: 'alg-lin-word-mean', why: `$${S} \\div ${n} = ${mean.toTex()}$ is the average, the middle of the list, not an end.` });
        cand.push({ value: key - m, trap: 'alg-lin-word-gap-count', why: `Taking one step too few lands on $${num(key - m)}$.` });
        cand.push({ value: S - m * gaps + (asked ? span : 0), trap: 'alg-forgot-divide', why: `Stopping at $${n}x = ${S - m * gaps}$ without dividing by ${n} gives $${S - m * gaps + (asked ? span : 0)}$.` });
        if (m !== 1) {
          const x1 = new Frac(S - gaps, n);
          const v = x1.add(asked ? n - 1 : 0);
          cand.push({ value: v.isInt() ? v.n : NaN, trap: 'alg-lin-word-step', why: `Treating the numbers as consecutive integers (step 1) gives $${v.toTex()}$.` });
        }
      } else {
        const a = rng.int(2, 4);
        const b = d === 2 ? rng.pick([0, 0, 2, 3, 4, 5, -2, -3]) : rng.pick([2, 3, 4, 5, 6, -2, -3, -4]);
        const t = a * rng.int(2, 8);
        const N = (a + 1) * rng.int(1, 3);
        const asked = d === 2 ? rng.int(0, 1) : rng.int(1, 2);
        const maria = a * t + b;
        if (maria <= 12) continue;
        const S = t + maria + 2 * N;
        const A = (tt: Frac) => (asked === 0 ? tt : asked === 1 ? tt.mul(a).add(b) : tt.mul(a).add(b + N));
        key = A(new Frac(t)).n;
        k = [a, b, N, S, asked];
        const rel = b === 0 ? `${ageWord(a)} as old as Tom` : `${Math.abs(b)} years ${b > 0 ? 'older' : 'younger'} than ${ageWord(a)} Tom's age`;
        stem = `Maria is ${rel}. In ${N} years, the sum of their ages will be ${S}. ${asked === 0 ? 'How old is Tom now' : asked === 1 ? 'How old is Maria now' : `How old will Maria be in ${N} years`}?`;
        steps = `Let $t$ be Tom's age now. Maria is $${a === 1 ? '' : a}t${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${-b}`}$ now. In ${N} years they are $t + ${N}$ and $${a}t${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${-b}`} + ${N}$, so $${a + 1}t${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${-b}`} + ${2 * N} = ${S}$. Then $${a + 1}t = ${S - b - 2 * N}$ and $t = ${t}$.${asked === 0 ? '' : asked === 1 ? ` Maria is $${a}(${t})${b === 0 ? '' : b > 0 ? ` + ${b}` : ` - ${-b}`} = ${maria}$.` : ` Maria is $${maria}$ now, so $${maria + N}$ in ${N} years.`}

Check: in ${N} years the ages are ${t + N} and ${maria + N}, which add up to ${S}.`;
        rule = 'Both people age during the same years: the sum of two ages grows by twice the number of years.';
        const tw = (x: Frac) => (x.isInt() && x.n > 0 ? A(x).n : NaN);
        cand.push({ value: tw(new Frac(S - b - N, a + 1)), trap: 'alg-lin-word-one-n', why: `Adding the ${N} years only once makes Tom ${new Frac(S - b - N, a + 1).toTex()} now${asked === 0 ? '' : ` and leads to $${tw(new Frac(S - b - N, a + 1))}$`}.` });
        cand.push({ value: tw(new Frac(S - b - 2 * N, a)), trap: 'alg-lin-word-forgot-multiple', why: `Leaving Tom's own age out of the sum divides by $${a}$ instead of $${a + 1}$ and gives $${tw(new Frac(S - b - 2 * N, a))}$.` });
        cand.push({ value: tw(new Frac(S + b - 2 * N, a + 1)), trap: 'alg-sign-slip', why: `Moving $${num(b)}$ across with the wrong sign gives $${tw(new Frac(S + b - 2 * N, a + 1))}$.` });
        if (b !== 0) cand.push({ value: tw(new Frac(S - 2 * N, a + 1)), trap: 'alg-dropped-term', why: `Dropping the ${Math.abs(b)} years gives $${tw(new Frac(S - 2 * N, a + 1))}$.` });
        const alt = asked === 0 ? maria : asked === 1 ? t : t + N;
        cand.push({ value: alt, trap: 'alg-lin-word-other-end', why: `$${alt}$ is the age of ${asked === 0 ? 'Maria' : asked === 1 ? 'Tom' : 'Tom in the future'}, not the one asked.` });
        const now = asked === 2 ? maria : asked === 0 ? t + N : maria + N;
        cand.push({ value: now, trap: 'alg-lin-word-now-vs-later', why: `$${now}$ is an age at the wrong moment (${asked === 2 ? 'now instead of later' : 'later instead of now'}).` });
      }
      const traps = cand.filter((c) => Number.isFinite(c.value) && (kind === 'consec' || c.value > 0) && Number.isInteger(c.value)).map((c) => ({ ...c, value: new Frac(c.value) }));
      const res = trapChoices(rng, key, traps, (v) => `$${v.toTex()}$`);
      if (!res) continue;
      const t0 = res.kept[0];
      const order = rng.shuffle(res.choices.map((_, i) => i)); // sorted choices would put the key near the middle or the bottom
      return {
        params: { kind, k: k!, values: order.map((i) => res.values[i].n) },
        q: {
          format: 'mcs',
          stem,
          choices: order.map((i) => res.choices[i]),
          answer: order.indexOf(res.answer),
          explanation: `${kind === 'consec' ? 'Evenly spaced numbers with a known sum: define the least one as the variable.' : 'Two ages that change together: write both ages with one variable.'}

${steps!}

Trap: ${t0.why}

Rule: ${rule!}`,
        },
      };
    }
  },
  check(q, { kind, k, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => q.choices[i].text !== `$${num(v)}$`)) return 'choice text mismatch';
    let found: number | null = null;
    let count = 0;
    if (kind === 'consec') {
      const [n, m, S, asked, type] = k;
      for (let x = -400; x <= 800; x++) {
        if (type === 1 && x % 2 !== 0) continue;
        if (type === 2 && Math.abs(x % 2) !== 1) continue;
        if (type === 3 && x % m !== 0) continue;
        let sum = 0;
        for (let i = 0; i < n; i++) sum += x + m * i;
        if (sum === S) {
          count++;
          found = asked === 1 ? x + m * (n - 1) : x;
        }
      }
    } else {
      const [a, b, N, S, asked] = k;
      for (let t = 1; t <= 200; t++) {
        const maria = a * t + b;
        if (maria < 1) continue;
        if (t + N + maria + N === S) {
          count++;
          found = asked === 0 ? t : asked === 1 ? maria : maria + N;
        }
      }
    }
    if (count !== 1 || found === null) return `${count} solutions`;
    const hits = values.flatMap((v, i) => (v === found ? [i] : []));
    return hits.length === 1 && hits[0] === q.answer ? null : `expected value ${found}`;
  },
};

export const linearWordTemplates = [linearWordMCS];
