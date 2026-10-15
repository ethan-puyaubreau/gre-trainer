import { flaggedChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num, paren } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { N, V, div, evalEx, intExcept, mul, pow, qcEnd, qcSamples, texEx, add, trapChoices, type Ex } from './util';

type Op = '<' | '<=' | '>' | '>=';
const OP_TEX: Record<Op, string> = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' };
const flip = (o: Op): Op => ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' })[o] as Op;
const holds = (l: Frac, o: Op, r: Frac) => {
  const c = l.cmp(r);
  return o === '<' ? c < 0 : o === '<=' ? c <= 0 : o === '>' ? c > 0 : c >= 0;
};

/* ================================================================== 1. Which values satisfy an inequality (MCM) */

interface SolveIneqParams {
  kind: 'linear' | 'compound';
  /** linear: a x + b (op) c x + d -> [a, b, c, d]; compound: L (op1) p x + q (op2) R -> [L, p, q, R] */
  k: number[];
  ops: Op[];
  values: number[];
}

function ineqHolds(kind: SolveIneqParams['kind'], k: number[], ops: Op[], x: Frac): boolean {
  if (kind === 'linear') {
    const [a, b, c, d] = k;
    return holds(x.mul(a).add(b), ops[0], x.mul(c).add(d));
  }
  const [L, p, q, R] = k;
  const mid = x.mul(p).add(q);
  return holds(new Frac(L), ops[0], mid) && holds(mid, ops[1], new Frac(R));
}

/** A wrong solution set (a named slip) with the clause that says what the student did. */
interface WrongSet {
  trap: string;
  why: string;
  has: (x: Frac) => boolean;
}

const solveIneqMCM: Template<SolveIneqParams> = {
  id: 'alg.inequalities.solve-mcm',
  skill: 'alg.inequalities',
  format: 'mcm',
  style: 'which values satisfy a linear or compound inequality',
  generate(rng, d) {
    for (;;) {
      const kind: SolveIneqParams['kind'] = d === 1 ? 'linear' : rng.pick(d === 2 ? ['linear', 'compound'] : ['compound', 'compound', 'linear']);
      let k: number[];
      let ops: Op[];
      let stem: string;
      let steps: string;
      const wrongSets: WrongSet[] = [];
      let center: number[]; // values around which candidates are drawn
      const between = (u: Frac, v: Frac) => (x: Frac) => (u.lte(v) ? x.gte(u) && x.lte(v) : x.gte(v) && x.lte(u));
      if (kind === 'linear') {
        const t = rng.int(-6, 8);
        let a: number;
        let c: number;
        do {
          a = rng.int(-6, 7);
          c = rng.int(-6, 7);
        } while (a === c || a === 0 || c === 0 || (d === 1 ? false : a - c > 0 && rng.chance(0.6)));
        const b = intExcept(rng, -12, 12, 0);
        const dd = (a - c) * t + b; // equality at x = t
        const op: Op = rng.pick(['<', '<=', '>', '>=']);
        k = [a, b, c, dd];
        ops = [op];
        const coef = a - c;
        const resOp = coef > 0 ? op : flip(op);
        stem = `Which of the following values of $x$ satisfy the inequality $${lin([[a, 'x'], [b, '']])} ${OP_TEX[op]} ${lin([[c, 'x'], [dd, '']])}$?`;
        const strict = op === '<' || op === '>';
        steps = `Collect the $x$ terms on one side and the numbers on the other: $${lin([[coef, 'x']])} ${OP_TEX[op]} ${num(dd - b)}$. ${
          coef < 0
            ? `Divide by $${coef}$: a negative divisor reverses the inequality ($2 < 3$ but $-2 > -3$), so $x ${OP_TEX[resOp]} ${num(t)}$.`
            : coef === 1
              ? `So $x ${OP_TEX[resOp]} ${num(t)}$.`
              : `Divide by ${coef} (positive, so the sign stays): $x ${OP_TEX[resOp]} ${num(t)}$.`
        } The value $${num(t)}$ is ${strict ? 'not ' : ''}included.`;
        if (coef < 0) wrongSets.push({ trap: 'alg-no-flip', why: `dividing by $${coef}$ without reversing the sign`, has: (x) => holds(x, op, new Frac(t)) });
        if (strict) wrongSets.push({ trap: 'alg-strict-endpoint', why: `including $${num(t)}$ although the inequality is strict`, has: (x) => x.eq(t) });
        const t2 = new Frac(dd + b, coef);
        wrongSets.push({ trap: 'alg-move-term-sign', why: `moving the constant $${num(b)}$ across without changing its sign`, has: (x) => holds(x, resOp, t2) });
        if (a + c !== 0) {
          const t3 = new Frac(dd - b, a + c);
          const res3 = a + c > 0 ? op : flip(op);
          wrongSets.push({ trap: 'alg-move-term-sign', why: `moving $${lin([[c, 'x']])}$ across without changing its sign`, has: (x) => holds(x, res3, t3) });
        }
        center = [t, Math.round(t2.toNumber()), a + c !== 0 ? Math.round((dd - b) / (a + c)) : t];
      } else {
        // L op1 p x + q op2 R with integer endpoints for x
        let p: number;
        do p = rng.pick(d === 3 ? [-4, -3, -2, 2, 3, -1] : [-3, -2, 2, 3, 4]);
        while (p === 0);
        let x1: number;
        let x2: number;
        do {
          x1 = rng.int(-7, 6);
          x2 = rng.int(-6, 9);
        } while (x2 - x1 < 2 || x2 - x1 > 7);
        const q = intExcept(rng, -9, 9, 0);
        // L and R are p*x + q at the endpoints, ordered so that L < R.
        const v1 = p * x1 + q;
        const v2 = p * x2 + q;
        const L = Math.min(v1, v2);
        const R = Math.max(v1, v2);
        const op1: Op = rng.pick(['<', '<=']);
        const op2: Op = rng.pick(['<', '<=']);
        k = [L, p, q, R];
        ops = [op1, op2];
        stem = `Which of the following values of $x$ satisfy $${num(L)} ${OP_TEX[op1]} ${lin([[p, 'x'], [q, '']])} ${OP_TEX[op2]} ${num(R)}$?`;
        const lo = (L - q) / p;
        const hi = (R - q) / p;
        const [a1, a2] = p > 0 ? [lo, hi] : [hi, lo];
        const [o1, o2] = p > 0 ? [op1, op2] : [op2, op1];
        steps = `Do the same step to all three parts of the chain. ${q > 0 ? `Subtract ${q}` : `Add ${-q}`}: $${num(L - q)} ${OP_TEX[op1]} ${lin([[p, 'x']])} ${OP_TEX[op2]} ${num(R - q)}$. ${
          p < 0
            ? `Divide by $${p}$, a negative number: both signs flip and the ends swap, $${num(a1)} ${OP_TEX[o1]} x ${OP_TEX[o2]} ${num(a2)}$.`
            : `Divide by ${p}: $${num(a1)} ${OP_TEX[o1]} x ${OP_TEX[o2]} ${num(a2)}$.`
        }`;
        const strictEnds = [o1 === '<' ? a1 : null, o2 === '<' ? a2 : null].filter((v): v is number => v !== null);
        if (strictEnds.length) wrongSets.push({ trap: 'alg-strict-endpoint', why: `counting an endpoint although its sign is strict`, has: (x) => strictEnds.some((e) => x.eq(e)) });
        if (Math.abs(p) !== 1) wrongSets.push({ trap: 'alg-compound-partial', why: `dividing only the middle part by ${Math.abs(p)}`, has: between(new Frac(L - q), new Frac(R - q)) });
        wrongSets.push({ trap: 'alg-compound-partial', why: `${q > 0 ? 'subtracting' : 'adding'} ${Math.abs(q)} in the middle part only`, has: between(new Frac(L, p), new Frac(R, p)) });
        wrongSets.push({ trap: 'alg-move-term-sign', why: `${q > 0 ? 'adding' : 'subtracting'} ${Math.abs(q)} in each part instead of ${q > 0 ? 'subtracting' : 'adding'} it`, has: between(new Frac(L + q, p), new Frac(R + q, p)) });
        center = [lo, hi, Math.round((L + q) / p), Math.round((R + q) / p), Math.round(L / p), Math.round(R / p), L - q, R - q].filter((v) => Math.abs(v) <= 30 || v === lo || v === hi);
      }
      // Candidates: every integer near the interesting numbers; a wrong one must be explained by one of the slips.
      const lowest = Math.min(...center) - 2;
      const highest = Math.max(...center) + 2;
      const cands: { x: number; ok: boolean; wrong?: WrongSet }[] = [];
      for (let x = Math.max(lowest, -30); x <= Math.min(highest, 30); x++) {
        const ok = ineqHolds(kind, k!, ops!, frac(x));
        const wrong = ok ? undefined : wrongSets.find((w) => w.has(frac(x)));
        if (ok || wrong) cands.push({ x, ok, wrong });
      }
      const total = rng.pick([5, 6, 7]);
      const good = cands.filter((c) => c.ok);
      const nGood = Math.max(1, Math.min(good.length, rng.int(1, Math.min(4, total - 2))));
      // Values are drawn apart from each other (no runs of consecutive integers) and, among the wrong ones, one slip at a time.
      const near = (list: { x: number }[], x: number) => list.some((c) => Math.abs(c.x - x) <= 1);
      const pickedGood: typeof cands = [];
      for (const c of rng.shuffle(good)) if (pickedGood.length < nGood && !near(pickedGood, c.x)) pickedGood.push(c);
      for (const c of rng.shuffle(good)) if (pickedGood.length < nGood && !pickedGood.includes(c)) pickedGood.push(c);
      const groups = rng.shuffle([...new Set(wrongSets.filter((w) => cands.some((c) => c.wrong === w)))]).map((w) => rng.shuffle(cands.filter((c) => c.wrong === w)));
      const pickedBad: typeof cands = [];
      for (let round = 0; round < 8 && pickedBad.length < total - nGood; round++)
        for (const g of groups) {
          const free = g.filter((c) => !pickedBad.includes(c) && !near(pickedBad, c.x) && !near(pickedGood, c.x));
          if (free.length && pickedBad.length < total - nGood) pickedBad.push(free[0]);
        }
      if (pickedBad.length < 2 || nGood + pickedBad.length < 5) continue;
      const picked = [...pickedGood, ...pickedBad].sort((u, v) => u.x - v.x);
      // no evenly spaced run of three choices (such a run looks like a ladder)
      if (picked.some((c, i) => i + 2 < picked.length && picked[i + 1].x - c.x === picked[i + 2].x - picked[i + 1].x && picked[i + 1].x - c.x <= 3)) continue;
      const { choices, answer } = flaggedChoices(picked.map((c) => ({ text: `$${num(c.x)}$`, correct: c.ok, ...(c.wrong ? { trap: c.wrong.trap } : {}) })));
      // Check a solution in the original inequality; refute the first wrong choice the same way.
      const sides = (x: number) => ({ l: k![0] * x + k![1], r: k![2] * x + k![3], m: k![1] * x + k![2] });
      const describe = (x: number, ok: boolean) => {
        const s = sides(x);
        return kind === 'linear'
          ? `$${num(s.l)}$ on the left and $${num(s.r)}$ on the right, and $${num(s.l)} ${OP_TEX[ops![0]]} ${num(s.r)}$ is ${ok ? 'true' : 'false'}`
          : `$${num(s.m)}$ in the middle, which ${ok ? 'lies' : 'does not lie'} between $${num(k![0])}$ and $${num(k![3])}$`;
      };
      const g = pickedGood[0];
      const w = pickedBad.find((c) => c.wrong)!;
      const explanation = `${steps}

Check: $x = ${num(g.x)}$ gives ${describe(g.x, true)}.

Trap: $${num(w.x)}$ comes from ${w.wrong!.why}. It gives ${describe(w.x, false)}.

Rule: reverse the sign when you multiply or divide by a negative number, and treat every part of a chain alike.`;
      return {
        params: { kind, k: k!, ops: ops!, values: picked.map((c) => c.x) },
        q: { format: 'mcm', stem: stem!, instruction: 'Indicate all such values.', choices, answer, explanation },
      };
    }
  },
  check(q, { kind, k, ops, values }) {
    if (q.format !== 'mcm') return 'wrong format';
    if (values.some((v, i) => q.choices[i].text !== `$${num(v)}$`)) return 'choice text mismatch';
    // Substitute each value into the original inequality, in floating point.
    const expected = values.flatMap((x, i) => {
      let ok: boolean;
      const cmp = (l: number, o: Op, r: number) => (o === '<' ? l < r : o === '<=' ? l <= r : o === '>' ? l > r : l >= r);
      if (kind === 'linear') ok = cmp(k[0] * x + k[1], ops[0], k[2] * x + k[3]);
      else ok = cmp(k[0], ops[0], k[1] * x + k[2]) && cmp(k[1] * x + k[2], ops[1], k[3]);
      return ok ? [i] : [];
    });
    if (!expected.length) return 'no correct choice';
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/* ================================================================== 2. Count the integer solutions (MCS) */

interface CountParams {
  kind: 'square' | 'abs' | 'product';
  /** square: x^2 (op) k -> [k]; abs: |a x - b| (op) c -> [a, b, c]; product: (x - a)(x - b) (op) 0 -> [a, b] */
  k: number[];
  op: Op;
  values: number[];
}

/** A wrong count with the slip that gives it and a sentence that refutes it. */
interface WrongCount {
  value: number;
  trap: string;
  why: string;
  refute: string;
}

const countIntegersMCS: Template<CountParams> = {
  id: 'alg.inequalities.integer-count-mcs',
  skill: 'alg.inequalities',
  format: 'mcs',
  style: 'count the integers in a solution set',
  generate(rng, d) {
    for (;;) {
      const kind: CountParams['kind'] = rng.pick(d === 1 ? ['square', 'product'] : d === 2 ? ['square', 'abs', 'product'] : ['abs', 'square', 'abs']);
      let k: number[];
      let op: Op;
      let stem: string;
      let method: string;
      let rule: string;
      let answer: number;
      const wrongs: WrongCount[] = [];
      if (kind === 'square') {
        const perfect = rng.chance(0.3);
        const m0 = d === 1 ? rng.int(2, 4) : d === 2 ? rng.int(5, 7) : rng.int(8, 10);
        const K = perfect ? m0 * m0 : m0 * m0 + rng.int(1, 2 * m0);
        op = perfect && rng.chance(0.5) ? '<=' : '<';
        k = [K];
        let m = 0;
        while ((m + 1) * (m + 1) < K || (op === '<=' && (m + 1) * (m + 1) <= K)) m++;
        answer = 2 * m + 1;
        const form = rng.chance(0.5) ? `x^2 - ${K} ${OP_TEX[op]} 0` : `x^2 ${OP_TEX[op]} ${K}`;
        stem = `How many integers $x$ satisfy the inequality $${form}$?`;
        method = `A square is below $${K}$ when $x$ is within $\\sqrt{${K}}$ of 0 on either side: $-${perfect ? m0 : `\\sqrt{${K}}`} ${OP_TEX[op]} x ${OP_TEX[op]} ${perfect ? m0 : `\\sqrt{${K}}`}$${perfect ? '' : `, and $${m}^2 = ${m * m} < ${K} < ${(m + 1) ** 2} = ${m + 1}^2$`}.

The integers are $${m <= 3 ? Array.from({ length: 2 * m + 1 }, (_, i) => i - m).join(', ') : `-${m}, -${m - 1}, \\ldots, ${m - 1}, ${m}`}$: ${m} negative, ${m} positive and 0, so ${answer}.`;
        rule = 'A negative number squared is positive too, so a bound on $x^2$ allows negative $x$: count both signs and zero.';
        wrongs.push({ value: m, trap: 'alg-count-positive-only', why: 'counting only the positive integers', refute: `But $(-1)^2 = 1 < ${K}$, so negative integers count too.` });
        wrongs.push({ value: 2 * m, trap: 'alg-count-forgot-zero', why: 'forgetting $x = 0$', refute: `But $0^2 = 0 ${OP_TEX[op]} ${K}$, so $0$ is a solution.` });
        wrongs.push({ value: m + 1, trap: 'alg-count-positive-only', why: 'counting zero and the positive integers only', refute: `But $(-1)^2 = 1 < ${K}$, so negative integers count too.` });
        if (!perfect) wrongs.push({ value: 2 * m + 3, trap: 'alg-sqrt-rounded-up', why: `rounding $\\sqrt{${K}}$ up to ${m + 1}`, refute: `But $${m + 1}^2 = ${(m + 1) ** 2}$ is already above ${K}.` });
        if (!perfect) wrongs.push({ value: K, trap: 'alg-count-to-k', why: `counting up to ${K} instead of $\\sqrt{${K}}$`, refute: `But $${m + 1}^2 = ${(m + 1) ** 2}$ already exceeds ${K}.` });
        wrongs.push({ value: 2 * m + 2, trap: 'alg-count-zero-twice', why: 'counting 0 once among the positive and once among the negative integers', refute: `But $0$ is a single number: the list is ${m} negative, 0, ${m} positive.` });
        if (!perfect) wrongs.push({ value: 2 * K - 1, trap: 'alg-count-to-k', why: `reading $x^2 < ${K}$ as $-${K} < x < ${K}$`, refute: `But $${m + 1}^2 = ${(m + 1) ** 2}$ already exceeds ${K}, so $x$ stops near $\\sqrt{${K}}$.` });
        if (perfect && op === '<') wrongs.push({ value: answer + 2, trap: 'counted-endpoint', why: `counting $-${m0}$ and ${m0}$`, refute: `But $${m0}^2 = ${K}$ is not less than ${K}.` });
        if (perfect && op === '<=') wrongs.push({ value: answer - 2, trap: 'alg-strict-endpoint', why: `leaving out $-${m0}$ and ${m0}$`, refute: `But $${m0}^2 = ${K}$ satisfies $\\le ${K}$.` });
      } else if (kind === 'abs') {
        const a = d === 3 ? 3 : 2;
        const b = intExcept(rng, -9, 9, 0);
        const c = rng.int(2, 8);
        op = rng.pick(['<', '<=']);
        k = [a, b, c];
        // -c op a x - b op c  ->  (b - c)/a op x op (b + c)/a
        const lo = new Frac(b - c, a);
        const hi = new Frac(b + c, a);
        const countIn = (l: Frac, h: Frac, o: Op) => {
          let n = 0;
          for (let x = Math.floor(l.toNumber()) - 1; x <= Math.ceil(h.toNumber()) + 1; x++) if (holds(l, o, frac(x)) && holds(frac(x), o, h)) n++;
          return n;
        };
        const ints: number[] = [];
        for (let x = Math.floor(lo.toNumber()) - 1; x <= Math.ceil(hi.toNumber()) + 1; x++) if (holds(lo, op, frac(x)) && holds(frac(x), op, hi)) ints.push(x);
        answer = ints.length;
        const inside = `${a}x ${b > 0 ? '-' : '+'} ${Math.abs(b)}`;
        stem = `How many integers $x$ satisfy $|${inside}| ${OP_TEX[op]} ${c}$?`;
        method = `$|${inside}| ${OP_TEX[op]} ${c}$ means the inside is within ${c} of 0 on either side: $-${c} ${OP_TEX[op]} ${inside} ${OP_TEX[op]} ${c}$. ${b > 0 ? `Add ${b}` : `Subtract ${-b}`} in each part: $${num(b - c)} ${OP_TEX[op]} ${a}x ${OP_TEX[op]} ${num(b + c)}$; divide by ${a}: $${lo.toTex()} ${OP_TEX[op]} x ${OP_TEX[op]} ${hi.toTex()}$.

The integers run from $${num(ints[0])}$ to $${num(ints[ints.length - 1])}$: $${num(ints[ints.length - 1])} - ${paren(ints[0])} + 1 = ${answer}$ of them.${op === '<' && (lo.isInt() || hi.isInt()) ? ' A strict sign excludes the endpoints.' : ''}`;
        rule = 'Split |u| < c into -c < u < c, solve the chain, then count the whole numbers inside.';
        const endpoints = (lo.isInt() ? 1 : 0) + (hi.isInt() ? 1 : 0);
        if (op === '<' && endpoints > 0) wrongs.push({ value: answer + endpoints, trap: 'counted-endpoint', why: 'counting the endpoints of a strict inequality', refute: `But at an endpoint the inside equals ${c} exactly, which is not less than ${c}.` });
        if (op === '<=' && endpoints > 0) wrongs.push({ value: answer - endpoints, trap: 'alg-strict-endpoint', why: 'leaving out the endpoints of a non-strict inequality', refute: `But at an endpoint the inside equals ${c} exactly, which the sign allows.` });
        wrongs.push({ value: op === '<' ? answer + 1 : answer - 1, trap: 'alg-count-off-by-one', why: 'subtracting the end values and stopping there', refute: `The run $${num(ints[0])}$ to $${num(ints[ints.length - 1])}$ has exactly ${answer} numbers on the list.` });
        if (a > 1) wrongs.push({ value: countIn(new Frac(b - c), new Frac(b + c), op), trap: 'alg-abs-no-divide', why: `forgetting to divide the ends by ${a}`, refute: `The ends $${num(b - c)}$ and $${num(b + c)}$ bound $${a}x$, not $x$.` });
        if (a > 1) wrongs.push({ value: countIn(new Frac(-b - c, a), new Frac(-b + c, a), op), trap: 'alg-move-term-sign', why: `moving ${Math.abs(b)} across with the wrong sign`, refute: `The ends then move to $${new Frac(-b - c, a).toTex()}$ and $${new Frac(-b + c, a).toTex()}$.` });
        wrongs.push({ value: c, trap: 'alg-abs-one-side', why: 'keeping only one of the two cases of the absolute value', refute: `The inequality also holds on the other side of the middle value.` });
      } else {
        const a = d === 1 ? -rng.int(1, 4) : -rng.int(5, 8);
        const b = d === 1 ? rng.int(1, 5) : rng.int(6, 9);
        op = rng.pick(['<', '<=']);
        k = [a, b];
        answer = op === '<' ? b - a - 1 : b - a + 1;
        const f = (r: number) => `(x ${r > 0 ? '-' : '+'} ${Math.abs(r)})`;
        stem = `How many integers $x$ satisfy $${f(a)}${f(b)} ${OP_TEX[op]} 0$?`;
        method = `A product of two factors is ${op === '<' ? 'negative' : 'negative or zero'} when the factors have opposite signs${op === '<' ? '' : ' or one factor is 0'}. That happens between the roots: $${num(a)} ${OP_TEX[op]} x ${OP_TEX[op]} ${num(b)}$ (outside, both factors have the same sign).

The integers ${op === '<' ? 'strictly between' : 'from'} $${num(a)}$ ${op === '<' ? 'and' : 'to'} $${num(b)}$ number $${b} - ${paren(a)} ${op === '<' ? '- 1' : '+ 1'} = ${answer}$, and $0$ is among them.`;
        rule = 'A product is negative between its roots; count the integers there and keep the endpoint rule in mind.';
        if (op === '<') {
          wrongs.push({ value: b - a + 1, trap: 'counted-endpoint', why: `counting the roots $${num(a)}$ and $${b}$`, refute: `At a root the product is $0$, not negative.` });
          wrongs.push({ value: b - a, trap: 'alg-count-off-by-one', why: 'subtracting the roots without removing the endpoints', refute: `That count still includes one of the roots.` });
          wrongs.push({ value: b - a - 2, trap: 'alg-count-forgot-zero', why: 'forgetting $x = 0$', refute: `At $x = 0$ the product is $${a * b}$, which is negative.` });
        } else {
          wrongs.push({ value: b - a - 1, trap: 'alg-strict-endpoint', why: `leaving out the roots $${num(a)}$ and $${b}$`, refute: `At a root the product is $0$, which the sign allows.` });
          wrongs.push({ value: b - a, trap: 'alg-count-off-by-one', why: 'subtracting the roots without adding 1', refute: `The run includes both roots, so the count is the difference plus 1.` });
          wrongs.push({ value: b - a - 2, trap: 'alg-count-forgot-zero', why: 'forgetting $x = 0$', refute: `At $x = 0$ the product is $${a * b}$, which is negative.` });
        }
        wrongs.push({ value: b - 1, trap: 'alg-count-positive-only', why: 'counting only the positive side of the interval', refute: `Negative integers down to $${num(a)}$ also work.` });
        if (b - a < 4) continue;
      }
      const res = trapChoices(rng, answer, wrongs.filter((w) => w.value >= 0), (v) => `${v.n}`);
      if (!res) continue;
      const cited = res.kept[0];
      const explanation = `${method}

Trap: ${cited.value.n} comes from ${cited.why}. ${cited.refute}

Rule: ${rule}`;
      return {
        params: { kind, k: k!, op: op!, values: res.values.map((v) => v.n) },
        q: { format: 'mcs', stem: stem!, choices: res.choices, answer: res.answer, explanation },
      };
    }
  },
  check(q, { kind, k, op, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => v < 0 || q.choices[i].text !== `${v}`)) return 'choice text mismatch';
    const cmp = (l: number, r: number) => (op === '<' ? l < r : l <= r);
    let count = 0;
    for (let x = -300; x <= 300; x++) {
      const ok = kind === 'square' ? cmp(x * x, k[0]) : kind === 'abs' ? cmp(Math.abs(k[0] * x - k[1]), k[2]) : cmp((x - k[0]) * (x - k[1]), 0);
      if (ok) count++;
    }
    const hits = values.flatMap((v, i) => (v === count ? [i] : []));
    if (hits.length !== 1) return `count ${count} appears ${hits.length} times`;
    return hits[0] === q.answer ? null : `expected ${count}`;
  },
};

/* ================================================================== 3. Absolute value comparisons (QC) */

interface AbsParams {
  kind: 'abs-vs-linear' | 'interval';
  /** abs-vs-linear: [k, sign s, form]; interval: [a, b, c, t, closed] */
  k: number[];
  cond: 'none' | 'pos' | 'neg' | 'gt-minus-k';
}

const absQC: Template<AbsParams> = {
  id: 'alg.inequalities.abs-qc',
  skill: 'alg.inequalities',
  format: 'qc',
  style: 'absolute value against a linear expression or a bound',
  generate(rng, d) {
    const kind: AbsParams['kind'] = rng.pick(['abs-vs-linear', 'interval']);
    let info: string | undefined;
    let A: string;
    let B: string;
    let answer: QCChoice;
    const traps: QCQuestion['traps'] = {};
    let explanation: string;
    let k: number[];
    let cond: AbsParams['cond'] = 'none';
    if (kind === 'abs-vs-linear') {
      const K = rng.int(1, 9);
      const form = rng.pick(['plus', 'minus', 'same'] as const);
      if (form === 'same') {
        // |m + K| vs m + K
        cond = rng.pick(['none', 'gt-minus-k', 'gt-minus-k']);
        info = cond === 'none' ? undefined : `$m > ${num(-K)}$`;
        A = `$|m + ${K}|$`;
        B = `$m + ${K}$`;
        answer = cond === 'none' ? 'D' : 'C';
        if (answer === 'D') traps.C = 'alg-abs-drop-bars';
        else traps.D = 'alg-qc-variable-d';
        explanation =
          cond === 'none'
            ? `The absolute value equals its argument only when the argument is not negative, and nothing here fixes the sign of $m + ${K}$, so test two values. For $m = 0$: Quantity A is ${K} and Quantity B is ${K}. For $m = ${num(-K - 1)}$: Quantity A is 1 and Quantity B is $-1$.

The cases disagree, equal in one and Quantity A greater in the other. ${qcEnd('D')}

Trap: testing only $m = 0$ suggests the quantities are equal. Rule: $|u| = u$ only when $u \\ge 0$; otherwise $|u| = -u$.`
            : `Since $m > ${num(-K)}$, $m + ${K}$ is positive, and the absolute value of a positive number is the number itself. Check with an allowed value. For $m = 0$: Quantity A is ${K} and Quantity B is ${K}. ${qcEnd('C')}

Trap: a value such as $m = ${num(-K - 1)}$ would make Quantity A equal to 1 and Quantity B equal to $-1$, but it is not allowed because $m > ${num(-K)}$. Rule: $|u| = u$ whenever $u \\ge 0$.`;
        k = [K, 1, 2];
      } else {
        // plus: |m + K| vs K - m  (A >= B iff m >= 0);  minus: |m - K| vs m + K (A >= B iff m <= 0)
        cond = rng.pick(d === 1 ? ['pos', 'neg'] : ['none', 'pos', 'neg', 'none']);
        info = cond === 'none' ? undefined : cond === 'pos' ? '$m > 0$' : '$m < 0$';
        A = form === 'plus' ? `$|m + ${K}|$` : `$|m - ${K}|$`;
        B = form === 'plus' ? `$${K} - m$` : `$m + ${K}$`;
        const posAnswer: QCChoice = form === 'plus' ? 'A' : 'B';
        const negAnswer: QCChoice = form === 'plus' ? 'B' : 'A';
        answer = cond === 'none' ? 'D' : cond === 'pos' ? posAnswer : negAnswer;
        if (answer === 'D') {
          traps.C = 'tested-one-value';
          traps[posAnswer] = 'alg-abs-drop-bars';
        } else {
          traps.D = 'alg-qc-variable-d';
          if (!traps.C) traps.C = 'tested-one-value';
        }
        const here = cond === 'none' ? 'Nothing fixes the sign of $m$, and the two cases give different answers.' : cond === 'pos' ? 'Here $m > 0$.' : 'Here $m < 0$.';
        // only values of m that satisfy the condition are tried, and only the cases that can occur are argued
        const tried = (cond === 'none' ? [1, -1] : cond === 'pos' ? [1] : [-1])
          .map((m) => `For $m = ${num(m)}$: Quantity A is ${Math.abs(form === 'plus' ? m + K : m - K)} and Quantity B is ${form === 'plus' ? K - m : m + K}.`)
          .join(' ');
        const ifPos =
          form === 'plus'
            ? `if $m > 0$ then $|m + ${K}| = m + ${K}$, which is greater than $${K} - m$.`
            : `if $m > 0$ then $|m - ${K}|$, the difference of two positive numbers, is less than their sum $m + ${K}$.`;
        const ifNeg =
          form === 'plus'
            ? `If $m < 0$, then $${K} - m = ${K} + |m|$, and adding a negative number to ${K} gives something smaller in size: $|m + ${K}| < ${K} + |m|$.`
            : `If $m < 0$, then $|m - ${K}| = ${K} - m$, which is greater than $${K} + m$.`;
        const otherM = cond === 'pos' ? -1 : 1;
        const otherA = Math.abs(form === 'plus' ? otherM + K : otherM - K);
        const otherB = form === 'plus' ? K - otherM : otherM + K;
        const trapLine =
          cond === 'none'
            ? `Trap: either value alone points to a winner, but the winner changes with the sign of $m$. Rule: when the sign is free, test one value of each sign.`
            : `Trap: testing $m = ${num(otherM)}$ instead, a value the condition forbids, would give ${otherA} against ${otherB}. Rule: test only values the condition allows.`;
        explanation = `The sign inside the bars matters, so try values that satisfy the condition. ${tried}

In general, ${cond === 'neg' ? ifNeg.replace(/^If/, 'if') : ifPos}${cond === 'none' ? ` ${ifNeg}` : ` ${here}`} ${qcEnd(answer)}

${trapLine}`;
        k = [K, form === 'plus' ? 1 : -1, form === 'plus' ? 0 : 1];
      }
    } else {
      const a = d === 1 ? 1 : rng.pick([1, 2, 2, 3]);
      // |a x - b| < c with b = a m0 and c = a w, so the endpoints m0 - w and m0 + w are integers
      const m0 = intExcept(rng, -5, 7, 0);
      const w = rng.int(1, a === 1 ? 7 : 4);
      const b = a * m0;
      const c = a * w;
      const lo = (b - c) / a;
      const hi = (b + c) / a;
      const closed = rng.chance(0.4);
      const goal = rng.pick(['A', 'B', 'D', 'D', 'edge'] as const);
      let t: number;
      if (goal === 'A') t = lo - rng.int(closed ? 1 : 0, 3);
      else if (goal === 'B') t = hi + rng.int(closed ? 1 : 0, 3);
      else if (goal === 'edge') t = rng.pick([lo, hi]);
      else t = rng.int(Math.ceil(lo + 0.5), Math.floor(hi - 0.5));
      const opT = closed ? '\\le' : '<';
      info = `$|${a === 1 ? 'x' : `${a}x`} ${b > 0 ? '-' : '+'} ${Math.abs(b)}| ${opT} ${c}$`;
      A = '$x$';
      B = `$${num(t)}$`;
      // A > B for all allowed x iff lo >= t (open) or lo > t (closed)
      if (closed ? lo > t : lo >= t) answer = 'A';
      else if (closed ? hi < t : hi <= t) answer = 'B';
      else answer = 'D';
      if (answer === 'D') {
        if (t === lo || t === hi) traps[t === lo ? 'A' : 'B'] = 'alg-strict-endpoint';
        else traps.A = 'tested-one-value';
      } else traps.D = 'alg-qc-variable-d';
      const half = (v: number) => (Number.isInteger(v) ? num(v) : v.toFixed(1));
      const caseText = (x: number) => `For $x = ${half(x)}$: Quantity A is $${half(x)}$ and Quantity B is $${num(t)}$.`;
      const atEdge = t === lo || t === hi;
      // the allowed values shown: both sides of t for D, the closest allowed value to t otherwise
      const shown =
        answer === 'D'
          ? atEdge
            ? [t, t === lo ? t + 0.5 : t - 0.5]
            : [t - 0.5, t + 0.5]
          : answer === 'A'
            ? [closed ? lo : lo + 0.5]
            : [closed ? hi : hi - 0.5];
      const trapLine =
        answer === 'D'
          ? atEdge
            ? `Trap: $${num(t)}$ is an endpoint that belongs to the set, so $x$ can equal it as well as exceed it.`
            : `Trap: one allowed value alone would settle the comparison wrongly.`
          : atEdge
            ? `Trap: $x$ never equals $${num(t)}$ because the inequality is strict.`
            : `Trap: because $x$ is unknown, answering D is tempting, but every allowed $x$ lies on the same side of $${num(t)}$.`;
      explanation = `Turn the absolute value into a range for $x$. $${info.slice(1, -1)}$ means $-${c} ${opT} ${a === 1 ? 'x' : `${a}x`} ${b > 0 ? '-' : '+'} ${Math.abs(b)} ${opT} ${c}$, so $${num(b - c)} ${opT} ${a === 1 ? 'x' : `${a}x`} ${opT} ${num(b + c)}$${
        a === 1 ? '' : ` and $${num(lo)} ${opT} x ${opT} ${num(hi)}$`
      }.

${
        answer === 'A'
          ? `Every allowed $x$ is ${closed ? 'at least' : 'greater than'} $${num(lo)}$, which is ${lo === t ? 'equal to' : 'greater than'} $${num(t)}$, so $x > ${num(t)}$.`
          : answer === 'B'
            ? `Every allowed $x$ is ${closed ? 'at most' : 'less than'} $${num(hi)}$, which is ${hi === t ? 'equal to' : 'less than'} $${num(t)}$, so $x < ${num(t)}$.`
            : `The range contains values of $x$ on both sides of $${num(t)}$${atEdge ? ' (including the endpoint itself)' : ''}.`
      } ${shown.map(caseText).join(' ')} ${qcEnd(answer)}

${trapLine} Rule: find every allowed $x$ first, then compare the ends of that range with the number.`;
      k = [a, b, c, t, closed ? 1 : 0];
    }
    return {
      params: { kind, k: k!, cond },
      q: { format: 'qc', info, quantityA: A!, quantityB: B!, answer: answer!, traps: Object.keys(traps).length ? traps : undefined, explanation: explanation! },
    };
  },
  check(q, { kind, k, cond }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const samples: [number, number][] = [];
    if (kind === 'abs-vs-linear') {
      const [K, s, form] = k;
      const ok = (m: number) => (cond === 'none' ? true : cond === 'pos' ? m > 0 : cond === 'neg' ? m < 0 : m > -K);
      const ms = [...Array.from({ length: 300 }, () => (rng.next() * 2 - 1) * rng.pick([1, 5, 20, 100])), -K - 1, -K + 0.5, 0.5, -0.5, 3, -3].filter(ok);
      for (const m of ms) {
        if (form === 2) samples.push([Math.abs(m + K), m + K]);
        else if (s === 1) samples.push([Math.abs(m + K), K - m]);
        else samples.push([Math.abs(m - K), m + K]);
      }
    } else {
      const [a, b, c, t, closed] = k;
      const inSet = (x: number) => (closed ? Math.abs(a * x - b) <= c : Math.abs(a * x - b) < c);
      const lo = (b - c) / a;
      const hi = (b + c) / a;
      const xs = [lo, hi, lo + 1e-6, hi - 1e-6, ...Array.from({ length: 300 }, () => lo + (hi - lo) * rng.next())].filter(inSet);
      for (const x of xs) samples.push([x, t]);
    }
    const expected = qcSamples(samples, 1e-12);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. Greatest or least value from ranges (NE) */

interface RangeParams {
  kind: 'linear' | 'product' | 'square' | 'integer';
  /** x in [x1, x2], y in [y1, y2]; integer: strictness flags */
  x: [number, number];
  y: [number, number];
  coef: [number, number];
  want: 'max' | 'min';
  strict: [boolean, boolean, boolean, boolean];
}

const rangeNE: Template<RangeParams> = {
  id: 'alg.inequalities.range-ne',
  skill: 'alg.inequalities',
  format: 'ne',
  style: 'greatest or least value of an expression from ranges',
  generate(rng, d) {
    const kind: RangeParams['kind'] = rng.pick(d === 1 ? ['linear', 'square'] : d === 2 ? ['linear', 'product', 'square'] : ['product', 'integer', 'linear']);
    const want: RangeParams['want'] = rng.pick(['max', 'min']);
    const x1 = rng.int(-8, 1);
    const x2 = x1 + rng.int(3, 10);
    const y1 = rng.int(-5, 4);
    const y2 = y1 + rng.int(2, 8);
    let coef: [number, number] = [1, -1];
    let strict: [boolean, boolean, boolean, boolean] = [false, false, false, false];
    let stem: string;
    let explanation: string;
    let answer: number;
    const traps: { value: Frac; trap: string }[] = [];
    const wantWord = want === 'max' ? 'greatest' : 'least';
    const xr = `$${num(x1)} \\le x \\le ${num(x2)}$`;
    const yr = `$${num(y1)} \\le y \\le ${num(y2)}$`;
    if (kind === 'linear') {
      coef = rng.pick(d === 1 ? ([[1, -1], [1, 1]] as [number, number][]) : ([[1, -1], [2, -1], [1, -3], [2, 3], [-1, 2]] as [number, number][]));
      const pickX = (c: number) => ((c > 0) === (want === 'max') ? x2 : x1);
      const pickY = (c: number) => ((c > 0) === (want === 'max') ? y2 : y1);
      const bx = pickX(coef[0]);
      const by = pickY(coef[1]);
      answer = coef[0] * bx + coef[1] * by;
      const expr = lin([[coef[0], 'x'], [coef[1], 'y']]);
      stem = `If ${xr} and ${yr}, what is the ${wantWord} possible value of $${expr}$?`;
      explanation = `To make $${expr}$ as ${want === 'max' ? 'large' : 'small'} as possible, choose each variable separately: $x = ${num(bx)}$ (${(coef[0] > 0) === (want === 'max') ? 'largest' : 'smallest'} $x$) and $y = ${num(by)}$ (${(coef[1] > 0) === (want === 'max') ? 'largest' : 'smallest'} $y$, because $y$ has a ${coef[1] > 0 ? 'positive' : 'negative'} coefficient).

The ${wantWord} value is $${coef[0] === 1 ? paren(bx) : coef[0] === -1 ? `-${paren(bx)}` : `${coef[0]}(${num(bx)})`} ${coef[1] < 0 ? '-' : '+'} ${Math.abs(coef[1]) === 1 ? paren(by) : `${Math.abs(coef[1])}(${num(by)})`} = ${num(answer)}$.`;
      const naive = coef[0] * (want === 'max' ? x2 : x1) + coef[1] * (want === 'max' ? y2 : y1);
      // both coefficients push the same way: the naive method works, so there is nothing to learn here
      if (naive === answer) return rangeNE.generate(rng, d);
      const otherX = coef[0] * (bx === x1 ? x2 : x1) + coef[1] * by;
      traps.push({ value: frac(naive), trap: 'alg-range-subtract' });
      explanation += `

Check: switching $x$ to its other end gives $${num(otherX)}$, which is ${want === 'max' ? 'smaller' : 'larger'}.

Trap: taking the ${want === 'max' ? 'largest' : 'smallest'} value of both variables gives $${num(naive)}$, but a negative coefficient turns a larger variable into a smaller result. Rule: pick the end of each variable by the sign of its coefficient.`;
    } else if (kind === 'product') {
      const corners = [x1 * y1, x1 * y2, x2 * y1, x2 * y2];
      answer = want === 'max' ? Math.max(...corners) : Math.min(...corners);
      stem = `If ${xr} and ${yr}, what is the ${wantWord} possible value of $xy$?`;
      explanation = `The extreme values of a product occur at the endpoints, but signs matter, so test all four combinations: $(${num(x1)})(${num(y1)}) = ${num(x1 * y1)}$, $(${num(x1)})(${num(y2)}) = ${num(x1 * y2)}$, $(${num(x2)})(${num(y1)}) = ${num(x2 * y1)}$, $(${num(x2)})(${num(y2)}) = ${num(x2 * y2)}$.

The ${wantWord} is $${num(answer)}$.`;
      const naive = want === 'max' ? x2 * y2 : x1 * y1;
      // the two extreme endpoints already give the key: the signs never matter, so draw again
      if (naive === answer) return rangeNE.generate(rng, d);
      traps.push({ value: frac(naive), trap: 'alg-range-product' });
      explanation += `

Check: the four corners cover every sign combination of $x$ and $y$, so no other pair of values can do better.

Trap: multiplying the ${want === 'max' ? 'largest' : 'smallest'} endpoints gives $${num(naive)}$, but a product of two negative endpoints can be larger and a mixed-sign product smaller. Rule: a product on a rectangle is extreme at a corner, so test all four.`;
    } else if (kind === 'square') {
      // x^2 on an interval that stays on one side of 0 ('away'), contains 0 ('zero-in'), or (x - h)^2 + c ('shift')
      const variant = rng.pick(d === 1 ? (['away', 'zero-in'] as const) : (['away', 'zero-in', 'shift', 'shift'] as const));
      let lo: number;
      let hi: number;
      let h = 0;
      let c = 0;
      if (variant === 'away') {
        lo = rng.int(2, 6);
        hi = lo + rng.int(2, 6);
        if (rng.chance(0.5)) [lo, hi] = [-hi, -lo];
      } else {
        lo = rng.int(-9, -2);
        hi = rng.int(2, 9);
        if (lo === -hi) lo -= 1;
      }
      if (variant === 'shift') {
        h = rng.int(Math.min(lo + 1, hi - 1), Math.max(lo + 1, hi - 1));
        c = rng.int(2, 9);
      }
      const sq = (v: number) => (v - h) * (v - h) + c;
      const nearEnd = Math.abs(lo - h) <= Math.abs(hi - h) ? lo : hi;
      const farEnd = nearEnd === lo ? hi : lo;
      const inside = lo <= h && h <= hi;
      const best = want === 'max' ? sq(farEnd) : inside ? c : sq(nearEnd);
      answer = best;
      const e = h === 0 ? 'x^2' : `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + ${c}`;
      const base = h === 0 ? 'x' : `x ${h > 0 ? '-' : '+'} ${Math.abs(h)}`;
      stem = `If $${num(lo)} \\le x \\le ${num(hi)}$, what is the ${wantWord} possible value of $${e}$?`;
      const val = (v: number) => (h === 0 ? `(${num(v)})^2` : `(${num(v)} ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 + ${c}`);
      let naive: number;
      let naiveWhy: string;
      if (want === 'max') {
        explanation = `A square is largest where its base is farthest from 0, so check the two ends: $${val(lo)} = ${sq(lo)}$ and $${val(hi)} = ${sq(hi)}$. The greatest value is $${num(answer)}$.

Check: a value inside the interval, such as $x = ${num(Math.round((lo + hi) / 2))}$, gives $${num(sq(Math.round((lo + hi) / 2)))}$, which is not larger.`;
        naive = sq(nearEnd);
        naiveWhy = `squaring the end nearer ${h === 0 ? '0' : `$x = ${h}$`}, which gives the smaller end value`;
        if (naive === answer) return rangeNE.generate(rng, d);
      } else if (inside) {
        explanation = `A square is never negative, and $${base}$ can be 0 inside the interval (at $x = ${num(h)}$), so the least value is $${h === 0 ? '0^2 = 0' : `0 + ${c} = ${c}`}$, not the value at an endpoint.

Check: the end values are $${sq(lo)}$ and $${sq(hi)}$, both larger.`;
        naive = Math.min(sq(lo), sq(hi));
        naiveWhy = 'taking the smaller end value';
        if (naive === answer) return rangeNE.generate(rng, d);
      } else {
        explanation = `Here $${base}$ stays ${lo - h > 0 ? 'positive' : 'negative'} on the whole interval, so the square grows with the distance from 0 and the least value is at the end nearer 0: $${val(nearEnd)} = ${num(answer)}$.

Check: the other end gives $${num(sq(farEnd))}$, which is larger.`;
        naive = h === 0 ? 0 : c;
        naiveWhy = 'assuming the least square is 0 even though 0 is not in the interval';
        if (naive === answer) return rangeNE.generate(rng, d);
      }
      if (!Number.isNaN(naive)) {
        explanation += `\n\nTrap: ${naiveWhy} gives $${num(naive)}$, which is not the ${wantWord} value on this interval.`;
        traps.push({ value: frac(naive), trap: 'alg-range-square' });
      }
      explanation += `\n\nRule: the extreme values of a square are at an endpoint or where its base is 0; check both.`;
      strict = [false, false, false, false];
      return {
        params: { kind, x: [lo, hi], y: [h, c], coef, want, strict },
        q: { format: 'ne', stem, answer: frac(answer), traps, explanation },
      };
    } else {
      strict = [rng.chance(0.7), rng.chance(0.5), rng.chance(0.5), rng.chance(0.7)];
      coef = rng.pick([[1, -1], [1, 1], [2, -1]] as [number, number][]);
      const ix1 = strict[0] ? x1 + 1 : x1;
      const ix2 = strict[1] ? x2 - 1 : x2;
      const iy1 = strict[2] ? y1 + 1 : y1;
      const iy2 = strict[3] ? y2 - 1 : y2;
      const pick = (c: number, lo: number, hi: number) => ((c > 0) === (want === 'max') ? hi : lo);
      const bx = pick(coef[0], ix1, ix2);
      const by = pick(coef[1], iy1, iy2);
      answer = coef[0] * bx + coef[1] * by;
      const s = (b: boolean) => (b ? '<' : '\\le');
      const expr = lin([[coef[0], 'x'], [coef[1], 'y']]);
      stem = `If $x$ and $y$ are integers such that $${num(x1)} ${s(strict[0])} x ${s(strict[1])} ${num(x2)}$ and $${num(y1)} ${s(strict[2])} y ${s(strict[3])} ${num(y2)}$, what is the ${wantWord} possible value of $${expr}$?`;
      explanation = `The integers allowed are $x = ${num(ix1)}, \\ldots, ${num(ix2)}$ and $y = ${num(iy1)}, \\ldots, ${num(iy2)}$ (a strict inequality excludes its endpoint).

To make $${expr}$ as ${want === 'max' ? 'large' : 'small'} as possible take $x = ${num(bx)}$ and $y = ${num(by)}$: the value is $${num(answer)}$.`;
      const nx = pick(coef[0], x1, x2);
      const ny = pick(coef[1], y1, y2);
      const naive = coef[0] * nx + coef[1] * ny;
      // the strict signs do not move the key: the endpoint slip is not a slip here, so draw again
      if (naive === answer) return rangeNE.generate(rng, d);
      traps.push({ value: frac(naive), trap: 'alg-strict-endpoint' });
      explanation += `

Check: $x = ${num(bx)}$ and $y = ${num(by)}$ are both allowed integers, and moving either one further would leave its range.

Trap: using $x = ${num(nx)}$ and $y = ${num(ny)}$ as they stand gives $${num(naive)}$, but a strict inequality excludes its endpoint. Rule: for integers, step in by 1 from every strict endpoint.`;
    }
    return {
      params: { kind, x: [x1, x2], y: [y1, y2], coef, want, strict },
      q: { format: 'ne', stem: stem!, answer: frac(answer!), traps, explanation: explanation! },
    };
  },
  check(q, { kind, x, y, coef, want, strict }) {
    if (q.format !== 'ne') return 'wrong format';
    // Brute force over a grid of values (quarter steps include every endpoint and 0).
    const grid = (lo: number, hi: number, sLo: boolean, sHi: boolean, step: number) => {
      const out: number[] = [];
      for (let v = lo; v <= hi + 1e-9; v += step) if (!(sLo && v === lo) && !(sHi && v === hi)) out.push(v);
      return out;
    };
    let best = want === 'max' ? -Infinity : Infinity;
    const step = kind === 'integer' ? 1 : 0.25;
    const xs = grid(x[0], x[1], strict[0], strict[1], step);
    const ys = kind === 'square' ? [0] : grid(y[0], y[1], strict[2], strict[3], step);
    const [sh, sc] = kind === 'square' ? y : [0, 0];
    for (const a of xs)
      for (const b of ys) {
        const v = kind === 'product' ? a * b : kind === 'square' ? (a - sh) * (a - sh) + sc : coef[0] * a + coef[1] * b;
        best = want === 'max' ? Math.max(best, v) : Math.min(best, v);
      }
    return Math.abs(q.answer.toNumber() - best) < 1e-9 ? null : `expected ${best}`;
  },
};

/* ================================================================== 5. Order expressions under a condition (MCS) */

const x = V('x');
const y = V('y');

interface OrderCond {
  /** Level of difficulty that uses this condition. */
  level: 1 | 2 | 3;
  /** The condition as TeX. */
  text: string;
  twoVar: boolean;
  /** Test points shown in the explanation: the first lists the values, the second is the check. */
  reps: [number, number][];
  /** Points that break the condition, each one a wrong assumption a student may make. */
  outside: [number, number][];
  /** Expressions that can be ordered under this condition. */
  menu: Ex[];
  /** Why the order is the same for every allowed value. */
  why: string;
  inRegion: (x: number, y: number) => boolean;
  /** Random allowed point (independent of the grid used to build the question). */
  sample: (u: number, v: number) => [number, number];
}

const SINGLE_MENU = [x, pow(x, 2), pow(x, 3), pow(x, 4), div(N(1), x), div(N(1), pow(x, 2)), mul(N(-1), x)];
const PAIR_MENU = [mul(x, y), div(x, y), div(y, x), add(x, y), add(y, mul(N(-1), x)), add(x, mul(N(-1), y)), pow(x, 2), pow(y, 2), mul(pow(x, 2), y), mul(x, pow(y, 2))];
const lowHigh = (a: number, b: number): [number, number] => (a <= b ? [a, b] : [b, a]);

const ORDER_CONDS: OrderCond[] = [
  {
    level: 1,
    text: '0 < x < 1',
    twoVar: false,
    reps: [[0.5, 0], [0.25, 0]],
    outside: [[2, 0], [-0.5, 0], [-2, 0]],
    menu: SINGLE_MENU,
    why: 'For a number between 0 and 1, each extra factor of $x$ makes the power smaller, and the reciprocal is larger than 1.',
    inRegion: (a) => a > 0 && a < 1,
    sample: (u) => [0.001 + 0.998 * u, 0],
  },
  {
    level: 1,
    text: '-1 < x < 0',
    twoVar: false,
    reps: [[-0.5, 0], [-0.25, 0]],
    outside: [[0.5, 0], [-2, 0], [2, 0]],
    menu: SINGLE_MENU,
    why: 'Signs decide first: every negative number is less than every positive one, and among negative numbers the one farther from 0 is smaller.',
    inRegion: (a) => a > -1 && a < 0,
    sample: (u) => [-0.001 - 0.998 * u, 0],
  },
  {
    level: 1,
    text: 'x > 1',
    twoVar: false,
    reps: [[2, 0], [3, 0]],
    outside: [[0.5, 0], [-2, 0], [-0.5, 0]],
    menu: SINGLE_MENU,
    why: 'For $x > 1$, a higher power is larger, and the reciprocal is between 0 and 1.',
    inRegion: (a) => a > 1,
    sample: (u) => [1.001 + 40 * u * u, 0],
  },
  {
    level: 1,
    text: 'x < -1',
    twoVar: false,
    reps: [[-2, 0], [-3, 0]],
    outside: [[-0.5, 0], [2, 0], [0.5, 0]],
    menu: SINGLE_MENU,
    why: 'For $x < -1$, odd powers are negative and get more negative as the exponent grows, even powers are positive, and the reciprocal is between $-1$ and 0.',
    inRegion: (a) => a < -1,
    sample: (u) => [-1.001 - 40 * u * u, 0],
  },
  {
    level: 2,
    text: '0 < x < y < 1',
    twoVar: true,
    reps: [[0.25, 0.5], [0.5, 0.75]],
    outside: [[2, 3], [-0.5, -0.25]],
    menu: PAIR_MENU,
    why: 'Both numbers are between 0 and 1 and $x < y$: a product of two such numbers is smaller than each, and dividing a smaller one by a larger one gives less than 1.',
    inRegion: (a, b) => a > 0 && a < b && b < 1,
    sample: (u, v) => lowHigh(0.001 + 0.998 * u, 0.001 + 0.998 * v),
  },
  {
    level: 2,
    text: 'x < y < 0',
    twoVar: true,
    reps: [[-3, -1], [-4, -2]],
    outside: [[1, 3], [-0.5, -0.25]],
    menu: PAIR_MENU,
    why: 'Both numbers are negative and $x$ is farther from 0 than $y$, so $x - y$ is negative, $y - x$ is positive, and sums and products follow the signs.',
    inRegion: (a, b) => a < b && b < 0,
    sample: (u, v) => lowHigh(-0.01 - 30 * u * u, -0.01 - 30 * v * v),
  },
  {
    level: 2,
    text: '0 < x < y',
    twoVar: true,
    reps: [[1, 2], [2, 5]],
    outside: [[-2, -1], [0.25, 0.5]],
    menu: PAIR_MENU,
    why: 'Both numbers are positive and $x < y$: the quotient $\\frac{x}{y}$ is below 1, $\\frac{y}{x}$ is above 1, and $y - x$ is positive.',
    inRegion: (a, b) => a > 0 && a < b,
    sample: (u, v) => lowHigh(0.01 + 20 * u * u, 0.01 + 20 * v * v),
  },
  {
    level: 3,
    text: '-1 < x < y < 0',
    twoVar: true,
    reps: [[-0.5, -0.25], [-0.75, -0.5]],
    outside: [[-3, -2], [0.25, 0.5]],
    menu: PAIR_MENU,
    why: 'Both numbers are negative fractions with $x$ farther from 0: a product of two of them is positive and smaller than either size, and a quotient of the larger size over the smaller is more than 1.',
    inRegion: (a, b) => a > -1 && a < b && b < 0,
    sample: (u, v) => lowHigh(-0.001 - 0.998 * u, -0.001 - 0.998 * v),
  },
  {
    level: 3,
    text: 'x < 0 < y < 1',
    twoVar: true,
    reps: [[-2, 0.5], [-3, 0.25]],
    outside: [[2, 0.5], [-2, 2]],
    menu: PAIR_MENU,
    why: 'Here $x$ is negative and $y$ is a positive fraction: multiplying $x$ by $y$ shrinks its size, so $xy$ lies between $x$ and 0.',
    inRegion: (a, b) => a < 0 && b > 0 && b < 1,
    sample: (u, v) => [-0.01 - 30 * u * u, 0.001 + 0.998 * v],
  },
];

interface OrderParams {
  c: number;
  exprs: Ex[];
  perms: number[][];
}

const PERM_KEY = (p: number[]) => p.join('');
const argsort = (vals: number[]) => [0, 1, 2].sort((i, j) => vals[i] - vals[j]);

/** Values grid for deciding that the order of three expressions does not change over a region. */
const GRID = [-30, -10, -4, -2, -1.5, -1.01, -0.99, -0.75, -0.5, -0.25, -0.1, -0.01, 0.01, 0.1, 0.25, 0.5, 0.75, 0.99, 1.01, 1.5, 2, 4, 10, 30];

/** The common order of the three expressions over the region, or null when it changes or two values tie. */
function constantOrder(cond: OrderCond, exprs: Ex[]): number[] | null {
  let seen: string | null = null;
  let any = false;
  for (const a of GRID)
    for (const b of cond.twoVar ? GRID : [0]) {
      if (!cond.inRegion(a, b)) continue;
      const vals = exprs.map((e) => evalEx(e, { x: a, y: b }));
      const order = argsort(vals);
      if (vals[order[0]] === vals[order[1]] || vals[order[1]] === vals[order[2]]) return null;
      const key = PERM_KEY(order);
      if (seen !== null && seen !== key) return null;
      seen = key;
      any = true;
    }
  return any && seen ? seen.split('').map(Number) : null;
}

const orderText = (exprs: Ex[], p: number[]) => `$${p.map((i) => texEx(exprs[i])).join(' < ')}$`;

const orderMCS: Template<OrderParams> = {
  id: 'alg.inequalities.order-mcs',
  skill: 'alg.inequalities',
  format: 'mcs',
  style: 'order expressions when the variables lie in an interval',
  generate(rng, d) {
    for (;;) {
      const pool = ORDER_CONDS.map((cs, i) => ({ cs, i })).filter(({ cs }) => cs.level === d);
      const { cs, i: c } = rng.pick(pool);
      const exprs = rng.sample(cs.menu, 3);
      const order = constantOrder(cs, exprs);
      if (!order) continue;
      const [rx, ry] = cs.reps[0];
      const vals = exprs.map((e) => evalEx(e, { x: rx, y: ry }));
      if (PERM_KEY(argsort(vals)) !== PERM_KEY(order)) continue; // the shown test point must follow the common order
      const key = PERM_KEY(order);
      // Wrong lists, each one a slip.
      const cands: { perm: number[]; trap: string; why: string }[] = [];
      const add2 = (perm: number[], trap: string, why: string) => {
        if (PERM_KEY(perm) === key || cands.some((k) => PERM_KEY(k.perm) === PERM_KEY(perm))) return;
        cands.push({ perm, trap, why });
      };
      add2(argsort(vals.map((v) => Math.abs(v))), 'alg-magnitude-vs-value', 'ordering by size and ignoring the signs');
      add2([...order].reverse(), 'alg-order-reversed', 'listing from greatest to least');
      add2(argsort(vals.map((v) => -Math.abs(v))), 'alg-magnitude-vs-value', 'ordering by size, largest first');
      for (const [ox, oy] of cs.outside)
        add2(argsort(exprs.map((e) => evalEx(e, { x: ox, y: oy }))), 'alg-assumed-outside-interval', cs.twoVar ? `testing $x = ${fracTex(ox)}$ and $y = ${fracTex(oy)}$, which break the condition` : `testing $x = ${fracTex(ox)}$, which breaks the condition`);
      if (cs.twoVar) add2(argsort(exprs.map((e) => evalEx(e, { x: ry, y: rx }))), 'alg-condition-reversed', 'reading the condition as $y < x$');
      if (cands.length < 4) continue;
      const wrong = rng.shuffle(cands).slice(0, 4);
      const all = rng.shuffle([{ perm: order, trap: '', why: '' }, ...wrong]);
      const choices: Choice[] = all.map((a) => ({ text: orderText(exprs, a.perm), ...(a.trap ? { trap: a.trap } : {}) }));
      const names = exprs.map((e) => `$${texEx(e)}$`);
      const listNames = `${names[0]}, ${names[1]}, and ${names[2]}`;
      const where = (px0: number, py0: number) => (cs.twoVar ? `$x = ${fracTex(px0)}$ and $y = ${fracTex(py0)}$` : `$x = ${fracTex(px0)}$`);
      const valueList = exprs.map((e, k) => `$${texEx(e)} = ${fracTex(vals[k])}$`).join(', ');
      const [cx, cy] = cs.reps[1];
      const vals2 = exprs.map((e) => evalEx(e, { x: cx, y: cy }));
      // The first wrong list: a pair it puts in the wrong order.
      const w0 = wrong[0];
      let refute = '';
      for (let a = 0; a + 1 < 3 && !refute; a++) {
        const u = w0.perm[a];
        const v = w0.perm[a + 1];
        if (vals[u] > vals[v]) refute = `It puts $${texEx(exprs[u])}$ before $${texEx(exprs[v])}$, but at the test values $${texEx(exprs[u])} = ${fracTex(vals[u])}$ is greater than $${texEx(exprs[v])} = ${fracTex(vals[v])}$.`;
      }
      const explanation = `Test a value the condition allows, ${where(rx, ry)}: ${valueList}. So ${orderText(exprs, order)}.

${cs.why} Check with ${where(cx, cy)}: ${exprs.map((e, k) => `$${texEx(e)} = ${fracTex(vals2[k])}$`).join(', ')}, in the same order.

Trap: ${w0.why} gives ${orderText(exprs, w0.perm)}. ${refute}

Rule: test values the condition allows; compare signs before sizes.`;
      return {
        params: { c, exprs, perms: all.map((a) => a.perm) },
        q: {
          format: 'mcs',
          stem: `If $${cs.text}$, which of the following lists ${listNames} in order from least to greatest?`,
          choices,
          answer: all.findIndex((a) => PERM_KEY(a.perm) === key),
          explanation,
        },
      };
    }
  },
  check(q, { c, exprs, perms }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    const cs = ORDER_CONDS[c];
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const [xv, yv] = cs.sample(rng.next(), rng.next());
      if (!cs.inRegion(xv, yv)) continue;
      const vals = exprs.map((e) => evalEx(e, { x: xv, y: yv }));
      seen.add(argsort(vals).join(''));
    }
    if (seen.size !== 1) return `order not constant: ${[...seen]}`;
    const truth = [...seen][0];
    const idx = perms.findIndex((p) => p.join('') === truth);
    if (perms.some((p, i) => q.choices[i].text !== orderText(exprs, p))) return 'choice text mismatch';
    return idx === q.answer ? null : `expected ${idx}`;
  },
};

function fracTex(v: number): string {
  for (let dd = 1; dd <= 4096; dd++) {
    const n = Math.round(v * dd);
    if (Math.abs(n / dd - v) < 1e-12 * Math.max(1, Math.abs(v))) return new Frac(n, dd).toTex();
  }
  return num(v);
}

export const inequalityTemplates = [solveIneqMCM, countIntegersMCS, absQC, rangeNE, orderMCS];
