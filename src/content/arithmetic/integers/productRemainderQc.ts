import { qcCompare, qcFromSamples } from '../../../engine/build';
import type { Trap, QCChoice, Template } from '../../../engine/types';
import { QC_WORDS, expectQc } from './util';

export const productRemainderTraps: Record<string, Trap> = {
  'cons-one-n-remainder': {
    label: 'Judged the remainder from the first value of n only',
    fix: 'The remainder of an expression in $n$ repeats as $n$ grows. Test every value in one full cycle: $n(n+1)$ divided by 3 leaves 2 for $n = 1$ but 0 for $n = 2$.',
  },
};

type Cond = 'any' | 'even' | 'odd';
interface Params {
  k: number;
  m: number;
  c: number;
  r: number;
  cond: Cond;
  v: string;
  swap: boolean;
}

const prodVal = (n: number, k: number, c: number) => {
  let p = c;
  let t = 1;
  for (let i = 0; i < k; i++) t *= n + i;
  p += t;
  return p;
};
const allowed = (n: number, cond: Cond) => cond === 'any' || (cond === 'even') === (n % 2 === 0);
const exprTex = (v: string, k: number, c: number) => {
  const f = Array.from({ length: k }, (_, i) => (i === 0 ? v : `(${v} + ${i})`)).join('');
  return c ? `${f} + ${c}` : f;
};

const productRemainderQc: Template<Params> = {
  id: 'arith.consecutive.product-remainder-qc',
  skill: 'arith.consecutive',
  format: 'qc',
  style: 'remainder of a product of consecutive integers compared with a number',
  generate(rng, d) {
    let target = rng.pick<QCChoice>(['A', 'B', 'C', 'C', 'D', 'D', 'A', 'B']);
    for (let tries = 1; ; tries++) {
      if (tries % 40 === 0) target = rng.pick<QCChoice>(['B', 'C', 'D']);
      const k = d === 1 ? 2 : d === 2 ? rng.pick([2, 3]) : rng.pick([3, 4]);
      const m = d === 1 ? rng.int(2, 5) : d === 2 ? rng.int(2, 6) : rng.int(7, 12);
      const c = d === 1 ? 0 : d === 2 ? rng.int(0, 1) : rng.int(0, 2);
      const cond: Cond = rng.pick(['any', 'any', 'even', 'odd']);
      const r = rng.int(0, m - 1);
      // one full cycle of the remainder: period lcm(2, m) covers every allowed residue
      const vals = new Set<number>();
      for (let n = 1; n <= 2 * m; n++) if (allowed(n, cond)) vals.add(prodVal(n, k, c) % m);
      const rels = new Set([...vals].map((x) => qcCompare(x, r)));
      const rel: QCChoice = rels.size > 1 ? 'D' : [...rels][0];
      if (rel !== target) continue;
      const swap = rng.chance(0.5);
      const v = rng.pick(['n', 'n', 'x', 'k']);
      const ns = [...Array(2 * m).keys()].map((i) => i + 1).filter((n) => allowed(n, cond));
      const first = ns[0];
      const firstRel = qcCompare(prodVal(first, k, c) % m, r);
      const flip = (x: QCChoice): QCChoice => (swap ? (x === 'A' ? 'B' : x === 'B' ? 'A' : x) : x);
      const answer = flip(rel);
      const trapLetter = flip(firstRel);
      const sorted = [...vals].sort((a, b) => a - b);
      const sample = (n: number) => {
        const t = Array.from({ length: k }, (_, i) => n + i).join(' \\cdot ');
        return `$${v} = ${n}$: $${t}${c ? ` + ${c}` : ''} = ${prodVal(n, k, c)}$ leaves remainder ${prodVal(n, k, c) % m}`;
      };
      const lo = ns.find((n) => prodVal(n, k, c) % m === sorted[0])!;
      const hi = ns.find((n) => prodVal(n, k, c) % m === sorted[sorted.length - 1])!;
      const shown = [...new Set([first, ns[1], lo, hi])].slice(0, 3);
      const condText = cond === 'any' ? 'a positive integer' : cond === 'even' ? 'an even positive integer' : 'an odd positive integer';
      const e = exprTex(v, k, c);
      const A = `The remainder when $${e}$ is divided by ${m}`;
      const B = `$${r}$`;
      const outcome =
        rel === 'D'
          ? `The remainders are not all on one side of ${r}, so the comparison changes with ${v}.`
          : rel === 'C'
            ? `Every remainder equals ${r}.`
            : `Every remainder is ${rel === 'A' ? 'greater' : 'less'} than ${r}.`;
      return {
        params: { k, m, c, r, cond, v, swap },
        q: {
          format: 'qc',
          info: `$${v}$ is ${condText}.`,
          quantityA: swap ? B : A,
          quantityB: swap ? A : B,
          answer,
          ...(trapLetter !== answer ? { traps: { [trapLetter]: 'cons-one-n-remainder' } } : {}),
          explanation: `The remainder of an expression in $${v}$ depends only on the remainder of $${v}$, so it repeats: test the values of one full cycle.

${shown.map(sample).join('; ')}. Over a full cycle the possible remainders are ${sorted.join(', ')}. ${outcome}

Trap: ${trapLetter !== answer ? `stopping at $${v} = ${first}$, whose remainder is ${firstRel === 'A' ? 'greater than' : firstRel === 'B' ? 'less than' : 'equal to'} ${r}, suggests that ${QC_WORDS[trapLetter]} (${trapLetter}).` : `a single test value would not prove the comparison; the whole cycle does.`}

To compare a remainder with a number, list the remainders over one full cycle of $${v}$. So ${QC_WORDS[answer]} (${answer}).`,
        },
      };
    }
  },
  check(q, { k, m, c, r, cond, swap }, rng) {
    const pairs: [number, number][] = [];
    const add = (n: number) => {
      if (n >= 1 && allowed(n, cond)) pairs.push(swap ? [r, prodVal(n, k, c) % m] : [prodVal(n, k, c) % m, r]);
    };
    for (let n = 1; n <= 90; n++) add(n);
    for (let i = 0; i < 30; i++) add(rng.int(100, 400));
    return expectQc(q, qcFromSamples(pairs));
  },
};

export const productRemainderTemplates: Template<any>[] = [productRemainderQc];
