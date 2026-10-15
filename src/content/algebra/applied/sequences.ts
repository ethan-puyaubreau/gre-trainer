import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num, ordinal } from '../../../engine/tex';
import { term } from '../../../engine/text';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { choiceValuesMatch, expectMcm, expectMcs, expectNe, expectQc, qcEnd, trapChoices, uniqueIndex } from './util';

const sub = (i: number | string) => `a_{${i}}`;
const diffWords = (d: number) => (d >= 0 ? `${d} more than` : `${-d} less than`);

/* =============================================================================================
 * 1. n-th term of an arithmetic or geometric sequence (NE) [GEN]
 * =========================================================================================== */

interface NthParams {
  kind: 'arith1' | 'arith2' | 'geo';
  /** Common difference (arith1 only). */
  step: number;
  /** Known terms (index, value). */
  known: [number, Frac][];
  target: number;
  positive: boolean;
}

const GEO_RATIOS = [frac(2), frac(3), frac(-2), frac(1, 2), frac(-3), frac(3, 2)];

const nthTerm: Template<NthParams> = {
  id: 'alg.sequences.nth-term',
  skill: 'alg.sequences',
  format: 'ne',
  style: 'n-th term from the first term or from two known terms',
  generate(rng, d) {
    if (d === 1) {
      const a1 = rng.int(-8, 20);
      const dd = rng.int(2, 9) * (rng.chance(0.8) ? 1 : -1);
      const n = rng.int(15, 60);
      const ans = a1 + (n - 1) * dd;
      return {
        params: { kind: 'arith1', step: dd, known: [[1, frac(a1)]], target: n, positive: false },
        q: {
          format: 'ne',
          stem: `In a sequence, the first term is $${num(a1)}$ and each term after the first is ${diffWords(dd)} the preceding term. What is the ${ordinal(n)} term of the sequence?`,
          answer: frac(ans),
          traps: [{ value: frac(a1 + n * dd), trap: 'algw-seq-off-by-one' }],
          explanation: `Going from the 1st term to the ${ordinal(n)} term takes ${n - 1} steps of $${num(dd)}$, not ${n}:

$$${sub(n)} = ${num(a1)} + (${n} - 1)(${num(dd)}) = ${num(a1)} ${dd * (n - 1) < 0 ? '-' : '+'} ${num(Math.abs(dd * (n - 1)))} = ${num(ans)}$$

Using ${n} steps gives $${num(a1 + n * dd)}$, one step too far.`,
        },
      };
    }
    if (d === 2) {
      let m: number;
      let n: number;
      let dd: number;
      let a1: number;
      let k: number;
      do {
        m = rng.int(2, 8);
        n = m + rng.int(3, 9);
        dd = rng.int(2, 9) * (rng.chance(0.8) ? 1 : -1);
        a1 = rng.int(-15, 25);
        k = rng.chance(0.75) ? n + rng.int(5, 25) : rng.int(m + 1, n - 1);
      } while (k === m || k === n);
      const am = a1 + (m - 1) * dd;
      const an = a1 + (n - 1) * dd;
      const ak = a1 + (k - 1) * dd;
      const traps: { value: Frac; trap: string }[] = [];
      if ((an - am) % (n - m + 1) === 0) {
        const dw = (an - am) / (n - m + 1);
        traps.push({ value: frac(an + (k - n) * dw), trap: 'algw-seq-steps' });
      }
      traps.push({ value: frac(an + (k - n + 1) * dd), trap: 'algw-seq-off-by-one' });
      return {
        params: { kind: 'arith2', step: 0, known: [[m, frac(am)], [n, frac(an)]], target: k, positive: false },
        q: {
          format: 'ne',
          stem: `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is obtained by adding the same constant to the preceding term. If $${sub(m)} = ${num(am)}$ and $${sub(n)} = ${num(an)}$, what is the value of $${sub(k)}$?`,
          answer: frac(ak),
          traps: traps.filter((t) => !t.value.eq(ak)),
          explanation: `From $${sub(m)}$ to $${sub(n)}$ there are $${n} - ${m} = ${n - m}$ steps, so the constant is $\\frac{${num(an)} - ${am < 0 ? `(${num(am)})` : num(am)}}{${n - m}} = ${num(dd)}$.

From $${sub(n)}$ to $${sub(k)}$ there are $${k} - ${n} = ${k - n}$ steps: $${sub(k)} = ${num(an)} ${(k - n) * dd < 0 ? '-' : '+'} ${num(Math.abs((k - n) * dd))} = ${num(ak)}$.

Count steps (differences of positions), not terms: dividing by ${n - m + 1} instead of ${n - m} gives the wrong constant.`,
        },
      };
    }
    // geometric
    let r: Frac;
    let m: number;
    let n: number;
    let k: number;
    let a1: Frac;
    let terms: Frac[];
    for (;;) {
      r = rng.pick(GEO_RATIOS);
      m = rng.int(1, 4);
      n = m + rng.pick([2, 3]);
      k = n + rng.int(1, 3);
      const base = rng.int(1, 6) * (rng.chance(0.25) ? -1 : 1);
      // a1 chosen so every term up to a_k is an integer
      a1 = frac(base).mul(r.d ** (k - 1));
      terms = [a1];
      for (let i = 1; i < k; i++) terms.push(terms[i - 1].mul(r));
      if (terms.every((t) => t.isInt() && Math.abs(t.toNumber()) <= 5000)) break;
    }
    const positive = r.sign() > 0 && terms.every((t) => t.sign() > 0);
    const am = terms[m - 1];
    const an = terms[n - 1];
    const ak = terms[k - 1];
    const steps = n - m;
    const evenSteps = steps % 2 === 0;
    const traps: { value: Frac; trap: string }[] = [];
    const dArith = an.sub(am).div(steps);
    const arithGuess = an.add(dArith.mul(k - n));
    if (arithGuess.isTerminating()) traps.push({ value: arithGuess, trap: 'algw-geo-as-arith' });
    traps.push({ value: an.mul(r.pow(k - n + 1)), trap: 'algw-geo-exponent' });
    const cond = evenSteps ? (positive ? ' All the terms of the sequence are positive.' : r.sign() > 0 ? ` The constant $r$ is positive.` : ' The constant $r$ is negative.') : '';
    return {
      params: { kind: 'geo', step: 0, known: [[m, am], [n, an]], target: k, positive: evenSteps && r.sign() > 0 },
      q: {
        format: 'ne',
        stem: `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is equal to the preceding term multiplied by a constant $r$.${cond} If $${sub(m)} = ${num(am)}$ and $${sub(n)} = ${num(an)}$, what is the value of $${sub(k)}$?`,
        answer: ak,
        traps: traps.filter((t) => !t.value.eq(ak)),
        explanation: `From $${sub(m)}$ to $${sub(n)}$ the term is multiplied by $r$ ${steps} times: $r^{${steps}} = ${am.eq(1) ? '' : `\\frac{${num(an)}}{${num(am)}} = `}${num(an.div(am))}$, so $r = ${num(r)}$${evenSteps ? ' (the sign is fixed by the given condition)' : ''}.

Then $${sub(k)} = ${sub(n)} \\cdot ${k - n === 1 ? 'r' : `r^{${k - n}}`} = ${num(an)} \\cdot ${(r.sign() < 0 || !r.isInt() ? `\\left(${num(r)}\\right)` : num(r)) + (k - n === 1 ? '' : `^{${k - n}}`)} = ${num(ak)}$.

The terms are multiplied, not increased by a constant, so do not use differences.`,
      },
    };
  },
  check(q, { kind, step, known, target, positive }) {
    const [m, am] = known[0];
    if (kind === 'arith1') {
      let t = am;
      for (let i = 1; i < target; i++) t = t.add(step);
      return expectNe(q, t);
    }
    const [n, an] = known[1];
    const sols: Frac[] = [];
    if (kind === 'arith2') {
      for (let dd = -60; dd <= 60; dd++) {
        let t = am;
        for (let i = m; i < n; i++) t = t.add(dd);
        if (!t.eq(an)) continue;
        let x = am;
        if (target > m) for (let i = m; i < target; i++) x = x.add(dd);
        else for (let i = m; i > target; i--) x = x.sub(dd);
        sols.push(x);
      }
    } else {
      const cands = [2, 3, 4, 5].flatMap((p) => [frac(p), frac(-p), frac(1, p), frac(-1, p), frac(p, p + 1), frac(p + 1, p), frac(-p, p + 1), frac(-(p + 1), p)]);
      const seen = new Set<string>();
      for (const r of cands) {
        if (seen.has(r.toString())) continue;
        seen.add(r.toString());
        if (positive && r.sign() < 0) continue;
        if (q.format === 'ne' && /is negative/.test(q.stem) && r.sign() > 0) continue;
        let t = am;
        for (let i = m; i < n; i++) t = t.mul(r);
        if (!t.eq(an)) continue;
        let x = an;
        for (let i = n; i < target; i++) x = x.mul(r);
        sols.push(x);
      }
    }
    const uniq = [...new Set(sols.map((s) => s.toString()))];
    if (uniq.length !== 1) return `${uniq.length} consistent sequences`;
    return expectNe(q, sols[0]);
  },
};

/* =============================================================================================
 * 2. Recursively defined sequences: forward, two-term rules, backward, running mean (NE) [BOOK AR-44]
 * =========================================================================================== */

interface RecParams {
  kind: 'forward' | 'two-back' | 'backward' | 'mean';
  p: number;
  q: number;
  /** Starting values (a1, or a1 and a2). */
  start: number[];
  /** Rule for two-back: a_n = u a_{n-1} + v a_{n-2}. */
  u: number;
  v: number;
  /** Given index/value for backward. */
  givenIdx: number;
  target: number;
}

function linRule(p: number, q: number): string {
  return `${p === 1 ? '' : p === -1 ? '-' : p}${sub('n-1')} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
}

const recursiveSeq: Template<RecParams> = {
  id: 'alg.sequences.recursive',
  skill: 'alg.sequences',
  format: 'ne',
  style: 'apply or undo a recursive rule',
  generate(rng, d) {
    const kind: RecParams['kind'] = d === 1 ? 'forward' : d === 2 ? rng.pick(['forward', 'two-back'] as const) : rng.pick(['backward', 'mean', 'backward'] as const);
    const base: RecParams = { kind, p: 0, q: 0, start: [], u: 0, v: 0, givenIdx: 0, target: 0 };
    if (kind === 'forward') {
      for (;;) {
        const p = rng.pick(d === 1 ? [2, 3] : [2, 3, -2, -1]);
        const q = rng.int(-6, 6) || 1;
        const a1 = rng.int(-4, 6);
        const k = d === 1 ? rng.int(4, 5) : rng.int(5, 6);
        const seq = [a1];
        for (let i = 1; i <= k; i++) seq.push(p * seq[i - 1] + q);
        const wrong = [a1];
        for (let i = 1; i < k; i++) wrong.push(p * (wrong[i - 1] + q));
        const ans = seq[k - 1];
        if (Math.abs(ans) > 3000 || new Set(seq).size < seq.length) continue;
        const traps = [
          { value: frac(seq[k - 2]), trap: 'algw-seq-off-by-one' },
          { value: frac(seq[k]), trap: 'algw-seq-off-by-one' },
          { value: frac(wrong[k - 1]), trap: 'algw-recursion-order' },
        ].filter((t) => !t.value.eq(ans));
        const steps = seq
          .slice(1, k)
          .map((v, i) => `$${sub(i + 2)} = ${p === 1 ? '' : p === -1 ? '-' : p}(${num(seq[i])}) ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${num(v)}$`)
          .join(', ');
        return {
          params: { ...base, p, q, start: [a1], target: k },
          q: {
            format: 'ne',
            stem: `The sequence $a_1, a_2, a_3, \\ldots$ is defined by $a_1 = ${num(a1)}$ and $a_n = ${linRule(p, q)}$ for all $n > 1$. What is the value of $${sub(k)}$?`,
            answer: frac(ans),
            traps,
            explanation: `Apply the rule one term at a time, multiplying first and then ${q < 0 ? 'subtracting' : 'adding'} ${Math.abs(q)}: ${steps}.

So $${sub(k)} = ${num(ans)}$. Count carefully: $${sub(k)}$ needs ${k - 1} applications of the rule.`,
          },
        };
      }
    }
    if (kind === 'two-back') {
      for (;;) {
        const [u, v] = rng.pick([
          [1, 1],
          [1, -1],
          [2, -1],
          [1, 2],
          [-1, 1],
        ] as const);
        const a1 = rng.int(-3, 6);
        const a2 = rng.int(-3, 6);
        const k = rng.int(6, 7);
        const seq = [a1, a2];
        for (let i = 2; i <= k; i++) seq.push(u * seq[i - 1] + v * seq[i - 2]);
        const ans = seq[k - 1];
        if (a1 === a2 || Math.abs(ans) > 500 || new Set(seq.slice(0, k)).size < 4) continue;
        const ruleTex = `${u === 1 ? '' : u === -1 ? '-' : u}${sub('n-1')} ${v < 0 ? '-' : '+'} ${Math.abs(v) === 1 ? '' : Math.abs(v)}${sub('n-2')}`;
        return {
          params: { ...base, u, v, start: [a1, a2], target: k },
          q: {
            format: 'ne',
            stem: `In the sequence $a_1, a_2, a_3, \\ldots$, $a_1 = ${num(a1)}$, $a_2 = ${num(a2)}$, and $a_n = ${ruleTex}$ for all $n \\ge 3$. What is the value of $${sub(k)}$?`,
            answer: frac(ans),
            traps: [
              { value: frac(seq[k - 2]), trap: 'algw-seq-off-by-one' },
              { value: frac(seq[k]), trap: 'algw-seq-off-by-one' },
            ].filter((t) => !t.value.eq(ans)),
            explanation: `Each term uses the two terms before it. Listing the terms: $${seq
              .slice(0, k)
              .map((x, i) => `${sub(i + 1)} = ${num(x)}`)
              .join(',\\ ')}$.

So $${sub(k)} = ${num(ans)}$.`,
          },
        };
      }
    }
    if (kind === 'backward') {
      for (;;) {
        const p = rng.pick([2, 3]);
        const q = (rng.int(1, 7) * rng.sign()) || 1;
        const a1 = rng.int(-5, 9);
        const g = rng.int(4, 5);
        const seq = [a1];
        for (let i = 1; i < g; i++) seq.push(p * seq[i - 1] + q);
        const ag = seq[g - 1];
        if (Math.abs(ag) > 1000 || new Set(seq).size < seq.length) continue;
        const forwardTrap = p * ag + q;
        // undo in the wrong order: subtract-then-divide reversed (divide first, then undo q)
        // Undoing in the wrong order: divide first, then subtract.
        let w = frac(ag);
        for (let i = g; i > 1; i--) w = w.div(p).sub(q);
        const traps: { value: Frac; trap: string }[] = [{ value: frac(forwardTrap), trap: 'algw-recursion-backward' }, { value: frac(seq[1]), trap: 'algw-seq-off-by-one' }];
        if (w.isTerminating()) traps.push({ value: w, trap: 'algw-recursion-order' });
        const back = seq
          .slice(0, g - 1)
          .reverse()
          .map((v, i) => `$${sub(g - 1 - i)} = \\frac{${num(seq[g - 1 - i])} ${q < 0 ? '+' : '-'} ${Math.abs(q)}}{${p}} = ${num(v)}$`)
          .join(', ');
        return {
          params: { ...base, p, q, givenIdx: g, start: [ag], target: 1 },
          q: {
            format: 'ne',
            stem: `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is defined by $a_n = ${linRule(p, q)}$. If $${sub(g)} = ${num(ag)}$, what is the value of $a_1$?`,
            answer: frac(a1),
            traps: traps.filter((t) => !t.value.eq(a1)),
            explanation: `Undo the rule: from $a_n = ${linRule(p, q)}$ we get $${sub('n-1')} = \\frac{a_n ${q < 0 ? '+' : '-'} ${Math.abs(q)}}{${p}}$ (undo the ${q < 0 ? 'subtraction' : 'addition'} first, then the multiplication).

Going back from $${sub(g)} = ${num(ag)}$: ${back}.

Applying the rule forward to $${sub(g)}$ gives $${sub(g + 1)} = ${num(forwardTrap)}$, a later term, not an earlier one.`,
          },
        };
      }
    }
    // mean rule: a3 = mean(a1, a2), and every later term is the mean of all the preceding terms
    let a1: number;
    let a2: number;
    do {
      a1 = rng.int(-4, 12);
      a2 = rng.int(-4, 12);
    } while (a1 === a2 || (a1 + a2) % 2 === 0);
    const k = rng.int(5, 8);
    const ans = frac(a1 + a2, 2);
    return {
      params: { ...base, kind: 'mean', start: [a1, a2], target: k },
      q: {
        format: 'ne',
        stem: `In a sequence, the first term is $${num(a1)}$ and the second term is $${num(a2)}$. Each term after the second is the average (arithmetic mean) of all the terms that come before it. What is the ${ordinal(k)} term of the sequence?

Give your answer as a fraction.`,
        answer: ans,
        fractionBoxes: true,
        traps: (() => {
          const w = [frac(a1), frac(a2)];
          while (w.length < k) w.push(w[w.length - 1].add(w[w.length - 2]).div(2));
          return w[k - 1].eq(ans) ? [] : [{ value: w[k - 1], trap: 'algw-mean-two-terms' }];
        })(),
        explanation: `The 3rd term is $\\frac{${num(a1)} + ${a2 < 0 ? `(${num(a2)})` : num(a2)}}{2} = ${num(ans)}$.

Adding a number equal to the current mean does not change the mean, so the 4th term is again $${num(ans)}$, and so is every term after it. The ${ordinal(k)} term is $${num(ans)}$.

No long computation is needed: once a term equals the mean of everything before it, the sequence is constant from then on.`,
      },
    };
  },
  check(q, prm) {
    const { kind, p, q: qq, start, u, v, givenIdx, target } = prm;
    if (kind === 'forward') {
      const rec = (n: number): number => (n === 1 ? start[0] : p * rec(n - 1) + qq);
      return expectNe(q, rec(target));
    }
    if (kind === 'two-back') {
      const memo = new Map<number, number>();
      const rec = (n: number): number => {
        if (n <= 2) return start[n - 1];
        if (!memo.has(n)) memo.set(n, u * rec(n - 1) + v * rec(n - 2));
        return memo.get(n)!;
      };
      return expectNe(q, rec(target));
    }
    if (kind === 'backward') {
      const hits: number[] = [];
      for (let a = -2000; a <= 2000; a++) {
        let x = a;
        for (let i = 1; i < givenIdx; i++) x = p * x + qq;
        if (x === start[0]) hits.push(a);
      }
      if (hits.length !== 1) return `${hits.length} starting values`;
      return expectNe(q, hits[0]);
    }
    const terms = start.map((x) => frac(x));
    while (terms.length < target) terms.push(terms.reduce((s, x) => s.add(x), frac(0)).div(terms.length));
    return expectNe(q, terms[target - 1]);
  },
};

/* =============================================================================================
 * 3. Sequence quantities compared, often with an unknown first term (QC)
 * =========================================================================================== */

interface SeqQcParams {
  mode: 'diff' | 'double' | 'symmetric' | 'geo-ratio' | 'geo-sign';
  d: number;
  r: number;
  /** Indices used by the quantities. */
  i: number[];
  N: number;
  /** Constraint on a1: 'none' | '>x' | '<x' | 'pos' | 'neg', with value. */
  cons: 'none' | 'gt' | 'lt' | 'pos' | 'neg';
  cv: number;
  /** Given term for 'symmetric': a_k = V. */
  k: number;
  V: number;
}

const seqCompareQC: Template<SeqQcParams> = {
  id: 'alg.sequences.compare-qc',
  skill: 'alg.sequences',
  format: 'qc',
  style: 'compare terms when the first term is unknown',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1 ? (['diff', 'diff', 'geo-ratio', 'symmetric'] as const) : d === 2 ? (['diff', 'double', 'symmetric', 'geo-ratio'] as const) : (['double', 'symmetric', 'geo-sign', 'geo-ratio'] as const),
    );
    const base: SeqQcParams = { mode, d: 0, r: 0, i: [], N: 0, cons: 'none', cv: 0, k: 0, V: 0 };
    const arithInfo = (dd: number) => `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is ${diffWords(dd)} the preceding term.`;
    if (mode === 'diff') {
      const dd = rng.int(2, 9) * (rng.chance(0.8) ? 1 : -1);
      const n = rng.int(3, 20);
      const m = n + rng.int(4, 30);
      const exact = (m - n) * dd;
      const trapV = (m - n + 1) * dd;
      const N = rng.pick([exact, exact, trapV, exact + rng.pick([-2, -1, 1, 2])]);
      const answer = qcCompare(exact, N);
      const trapAns = qcCompare(trapV, N);
      const traps: QCQuestion['traps'] = answer === 'C' ? { D: 'algw-single-case' } : trapAns !== answer ? { [trapAns]: 'algw-seq-steps' } : undefined;
      return {
        params: { ...base, d: dd, i: [m, n], N },
        q: {
          format: 'qc',
          info: arithInfo(dd),
          quantityA: `$${sub(m)} - ${sub(n)}$`,
          quantityB: `$${num(N)}$`,
          answer,
          traps,
          explanation: `The first term is unknown, but it cancels in a difference: from $${sub(n)}$ to $${sub(m)}$ there are $${m} - ${n} = ${m - n}$ steps of $${num(dd)}$, so $${sub(m)} - ${sub(n)} = ${m - n}(${num(dd)}) = ${num(exact)}$.

Compare $${num(exact)}$ with $${num(N)}$. ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'double') {
      const dd = rng.int(2, 9);
      const kk = rng.int(3, 12);
      const cons: SeqQcParams['cons'] = rng.pick(['none', 'none', 'gt', 'lt']);
      const cv = dd;
      // a_{2k} - 2 a_k = d - a_1
      const answer: QCChoice = cons === 'none' ? 'D' : cons === 'gt' ? 'B' : 'A';
      const traps: QCQuestion['traps'] = answer === 'D' ? { C: 'algw-seq-proportional' } : { C: 'algw-seq-proportional' };
      const consText = cons === 'none' ? '' : ` The first term, $a_1$, is ${cons === 'gt' ? 'greater' : 'less'} than ${cv}.`;
      return {
        params: { ...base, d: dd, i: [2 * kk, kk], cons, cv },
        q: {
          format: 'qc',
          info: `${arithInfo(dd)}${consText}`,
          quantityA: `$${sub(2 * kk)}$`,
          quantityB: `$2${sub(kk)}$`,
          answer,
          traps,
          explanation: `Write both in terms of $a_1$: $${sub(2 * kk)} = a_1 + ${2 * kk - 1}(${dd}) = a_1 + ${(2 * kk - 1) * dd}$ and $2${sub(kk)} = 2(a_1 + ${kk - 1}(${dd})) = 2a_1 + ${2 * (kk - 1) * dd}$.

Quantity A minus Quantity B is $${dd} - a_1$. ${
            cons === 'none'
              ? `It is positive if $a_1 < ${dd}$, zero if $a_1 = ${dd}$, and negative if $a_1 > ${dd}$. ${qcEnd('D')}`
              : cons === 'gt'
                ? `Since $a_1 > ${dd}$, it is negative. ${qcEnd('B')}`
                : `Since $a_1 < ${dd}$, it is positive. ${qcEnd('A')}`
          }

Doubling the position does not double the term: the first term gets in the way.`,
        },
      };
    }
    if (mode === 'symmetric') {
      const k = rng.int(4, 12);
      const j = rng.int(1, k - 1);
      const V = rng.int(-20, 40);
      const off = rng.chance(0.3); // use k-j and k+j+1 -> depends on d
      const N = off ? 2 * V : rng.pick([2 * V, 2 * V, 2 * V + 1, 2 * V - 1, V]);
      const answer: QCChoice = off ? 'D' : qcCompare(2 * V, N);
      const traps: QCQuestion['traps'] = answer === 'D' ? { C: 'algw-single-case' } : answer === 'C' ? { D: 'algw-single-case' } : undefined;
      const lo = k - j;
      const hi = off ? k + j + 1 : k + j;
      return {
        params: { ...base, k, V, i: [lo, hi], N },
        q: {
          format: 'qc',
          info: `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is obtained by adding the same constant to the preceding term, and $${sub(k)} = ${num(V)}$.`,
          quantityA: `$${sub(lo)} + ${sub(hi)}$`,
          quantityB: `$${num(N)}$`,
          answer,
          traps,
          explanation: off
            ? `Let the constant be $d$. Then $${sub(lo)} = ${num(V)} - ${term(j, 'd')}$ and $${sub(hi)} = ${num(V)} + ${term(j + 1, 'd')}$, so $${sub(lo)} + ${sub(hi)} = ${num(2 * V)} + d$, which depends on $d$: it equals $${num(2 * V)}$ only if $d = 0$. ${qcEnd('D')}`
            : `Let the constant be $d$. Terms equally far from $${sub(k)}$ balance: $${sub(lo)} = ${num(V)} - ${term(j, 'd')}$ and $${sub(hi)} = ${num(V)} + ${term(j, 'd')}$, so $${sub(lo)} + ${sub(hi)} = 2(${num(V)}) = ${num(2 * V)}$ whatever $d$ is.

Compare $${num(2 * V)}$ with $${num(N)}$. ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'geo-ratio') {
      const r = rng.pick(d === 1 ? [2, 3] : [2, 3, -2, -3]);
      const n = rng.int(2, 6);
      const gap = rng.int(2, 4);
      const m = n + gap;
      const exact = r ** gap;
      const trapV = r ** (gap + 1);
      const N = rng.pick([exact, exact, trapV, r ** (gap - 1), -exact]);
      const answer = qcCompare(exact, N);
      const trapAns = qcCompare(trapV, N);
      const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-geo-exponent' } : answer === 'C' ? { D: 'algw-single-case' } : undefined;
      const rT = r < 0 ? `(${r})` : `${r}`;
      return {
        params: { ...base, r, i: [m, n], N },
        q: {
          format: 'qc',
          info: `In the sequence $a_1, a_2, a_3, \\ldots$, $a_1 \\ne 0$ and each term after the first is $${r}$ times the preceding term.`,
          quantityA: `$\\dfrac{${sub(m)}}{${sub(n)}}$`,
          quantityB: `$${N < 0 ? `-${num(-N)}` : num(N)}$`,
          answer,
          traps,
          explanation: `Going from $${sub(n)}$ to $${sub(m)}$ multiplies by $${r}$ a total of $${m} - ${n} = ${gap}$ times, so $\\frac{${sub(m)}}{${sub(n)}} = ${rT}^{${gap}} = ${num(exact)}$, whatever $a_1$ is.

Compare $${num(exact)}$ with $${num(N)}$. ${qcEnd(answer)}`,
        },
      };
    }
    // geo-sign: r > 1 given, compare a_m and a_n (m > n), sign of a1 decides
    const r = rng.pick([2, 3, 4]);
    const n = rng.int(2, 5);
    const m = n + rng.int(1, 3);
    const cons: SeqQcParams['cons'] = rng.pick(['none', 'none', 'pos', 'neg']);
    const answer: QCChoice = cons === 'none' ? 'D' : cons === 'pos' ? 'A' : 'B';
    const traps: QCQuestion['traps'] = answer === 'D' ? { A: 'algw-single-case' } : cons === 'neg' ? { A: 'algw-single-case' } : undefined;
    const consText = cons === 'none' ? 'and $a_1 \\ne 0$' : cons === 'pos' ? 'and $a_1 > 0$' : 'and $a_1 < 0$';
    return {
      params: { ...base, r, i: [m, n], cons },
      q: {
        format: 'qc',
        info: `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is ${r} times the preceding term, ${consText}.`,
        quantityA: `$${sub(m)}$`,
        quantityB: `$${sub(n)}$`,
        answer,
        traps,
        explanation: `$${sub(m)} = ${m - n === 1 ? r : `${r}^{${m - n}}`} \\cdot ${sub(n)} = ${r ** (m - n)}${sub(n)}$, and every term has the same sign as $a_1$.

${
          cons === 'none'
            ? `If $a_1 > 0$, multiplying a positive number by ${r ** (m - n)} makes it larger, so Quantity A is greater. If $a_1 < 0$, the terms are negative and $${sub(m)}$ is farther below 0, so Quantity B is greater. ${qcEnd('D')}`
            : cons === 'pos'
              ? `The terms are positive, so multiplying by ${r ** (m - n)} makes $${sub(m)}$ larger. ${qcEnd('A')}`
              : `The terms are negative, so multiplying by ${r ** (m - n)} moves $${sub(m)}$ farther below 0: it is smaller. ${qcEnd('B')}`
        }`,
      },
    };
  },
  check(q, prm, rng) {
    const samples: [Frac, Frac][] = [];
    for (let t = 0; t < 300; t++) {
      let a1: Frac;
      const pick = () => frac(rng.int(-200, 200), rng.pick([1, 1, 2, 3]));
      if (prm.mode === 'geo-ratio' || prm.mode === 'geo-sign') {
        do a1 = pick();
        while (a1.n === 0 || (prm.cons === 'pos' && a1.sign() <= 0) || (prm.cons === 'neg' && a1.sign() >= 0));
        const term = (n: number) => {
          let x = a1;
          for (let i = 1; i < n; i++) x = x.mul(prm.r);
          return x;
        };
        const [m, n] = prm.i;
        samples.push(prm.mode === 'geo-ratio' ? [term(m).div(term(n)), frac(prm.N)] : [term(m), term(n)]);
        continue;
      }
      let dd = frac(prm.d);
      if (prm.mode === 'symmetric') {
        dd = pick();
        // a1 from a_k = V
        a1 = frac(prm.V).sub(dd.mul(prm.k - 1));
      } else {
        do a1 = t === 0 && prm.cons === 'none' ? frac(prm.cv) : pick();
        while ((prm.cons === 'gt' && !a1.gt(prm.cv)) || (prm.cons === 'lt' && !a1.lt(prm.cv)));
      }
      const term = (n: number) => {
        let x = a1;
        for (let i = 1; i < n; i++) x = x.add(dd);
        return x;
      };
      const [x, y] = prm.i;
      if (prm.mode === 'diff') samples.push([term(x).sub(term(y)), frac(prm.N)]);
      else if (prm.mode === 'double') samples.push([term(x), term(y).mul(2)]);
      else samples.push([term(x).add(term(y)), frac(prm.N)]);
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/* =============================================================================================
 * 4. Which numbers are terms of the sequence (MCM) [BOOK AR-44 for the recursive version]
 * =========================================================================================== */

interface TermsParams {
  kind: 'arith' | 'formula' | 'recursion' | 'geo-neg';
  a1: number;
  d: number;
  /** formula: a_n = d n + e */
  e: number;
  /** recursion: a_n = p a_{n-1} + q, with a_g given */
  p: number;
  q: number;
  g: number;
  ag: number;
  r: number;
  values: number[];
}

const termsOfSequence: Template<TermsParams> = {
  id: 'alg.sequences.terms-mcm',
  skill: 'alg.sequences',
  format: 'mcm',
  style: 'which numbers are terms of a sequence',
  generate(rng, d) {
    const kind: TermsParams['kind'] = d === 1 ? 'arith' : d === 2 ? rng.pick(['arith', 'formula'] as const) : rng.pick(['recursion', 'geo-neg'] as const);
    const base: TermsParams = { kind, a1: 0, d: 0, e: 0, p: 0, q: 0, g: 0, ag: 0, r: 0, values: [] };
    let correct: number[] = [];
    let wrong: { v: number; trap?: string }[] = [];
    let stem: string;
    let explanation: string;
    let params: TermsParams;
    if (kind === 'arith' || kind === 'formula') {
      const dd = rng.int(3, 9);
      let a1: number;
      let e = 0;
      if (kind === 'arith') a1 = rng.int(1, 30);
      else {
        do e = rng.int(-8, 8);
        while (e === 0 || Math.abs(e) % dd === 0 || dd + e < 1);
        a1 = dd + e;
      }
      const isTerm = (v: number) => v >= a1 && (v - a1) % dd === 0;
      const nCorrect = rng.int(1, 3);
      const ks = rng.sample([4, 7, 9, 12, 15, 18, 22, 25, 31, 40], nCorrect);
      correct = ks.map((k) => a1 + k * dd);
      const cands: { v: number; trap?: string }[] = [];
      const mult = dd * rng.int(5, 30);
      if (!isTerm(mult)) cands.push({ v: mult, trap: 'algw-seq-multiple-of-d' });
      const before = a1 - dd * rng.int(1, 2);
      if (kind === 'formula' && !isTerm(e) && e !== 0) cands.push({ v: e, trap: 'algw-seq-before-start' });
      else if (!isTerm(before) && before !== 0) cands.push({ v: before, trap: 'algw-seq-before-start' });
      if (kind === 'formula') {
        const flip = dd * rng.int(5, 25) - e;
        if (!isTerm(flip)) cands.push({ v: flip, trap: 'algw-seq-multiple-of-d' });
      }
      for (const k of rng.shuffle([5, 8, 11, 14, 17, 20, 23, 28])) {
        const v = a1 + k * dd + rng.pick([1, -1, 2]);
        if (!isTerm(v)) cands.push({ v, trap: 'algw-seq-near-term' });
      }
      const seen = new Set(correct);
      wrong = [];
      for (const c of cands) {
        if (seen.has(c.v) || wrong.length >= 5 - nCorrect + (d === 2 ? 1 : 0)) continue;
        seen.add(c.v);
        wrong.push(c);
      }
      params = { ...base, a1, d: dd, e };
      stem =
        kind === 'arith'
          ? `In a sequence, the first term is ${a1} and each term after the first is ${dd} more than the preceding term. Which of the following numbers are terms of the sequence?`
          : `The $n$th term of a sequence is $a_n = ${dd}n ${e < 0 ? '-' : '+'} ${Math.abs(e)}$ for all positive integers $n$. Which of the following numbers are terms of the sequence?`;
      explanation = `${kind === 'formula' ? `The first term is $${dd}(1) ${e < 0 ? '-' : '+'} ${Math.abs(e)} = ${a1}$ and each term is ${dd} more than the one before. ` : ''}A number $N$ is a term exactly when $N \\ge ${a1}$ and $N - ${a1}$ is a multiple of ${dd}:
${[...correct.map((v) => ({ v, ok: true })), ...wrong.map((w) => ({ v: w.v, ok: false }))]
  .sort((x, y) => x.v - y.v)
  .map(({ v, ok }) =>
    ok
      ? `- $${num(v)}$: $${num(v)} - ${a1} = ${num(v - a1)} = ${dd} \\cdot ${(v - a1) / dd}$, a term (the ${ordinal((v - a1) / dd + 1)}).`
      : v < a1
        ? `- $${num(v)}$: less than the first term, so not a term.`
        : `- $${num(v)}$: $${num(v)} - ${a1} = ${num(v - a1)}$, not a multiple of ${dd}.`,
  )
  .join('\n')}`;
    } else if (kind === 'recursion') {
      let p: number;
      let qq: number;
      let seq: number[];
      for (;;) {
        p = rng.pick([2, 3]);
        qq = -rng.int(1, 6);
        const a1 = rng.int(2, 8);
        seq = [a1];
        for (let i = 1; i < 6; i++) seq.push(p * seq[i - 1] + qq);
        if (new Set(seq).size === 6 && seq.every((x) => x > 0) && seq[5] < 2000) break;
      }
      const g = 4;
      const ag = seq[g - 1];
      // Correct: a1, a2, a3 (backward), a5 (forward); decoys: undoing in the wrong order, and neighbors.
      const pool = [seq[0], seq[1], seq[2], seq[4]];
      correct = rng.sample(pool, rng.int(2, 3));
      const isTerm = (v: number) => seq.includes(v) || v > seq[5];
      const cands: { v: number; trap?: string }[] = [];
      for (let i = 1; i <= 3; i++) {
        // Undoing in the wrong order: divide by p first, then undo the subtraction.
        const wrongOrder = seq[i] / p - qq;
        if (Number.isInteger(wrongOrder) && wrongOrder > 0 && !isTerm(wrongOrder)) cands.push({ v: wrongOrder, trap: 'algw-recursion-order' });
        // Undoing the subtraction with the wrong sign.
        const wrongSign = (seq[i] + qq) / p;
        if (Number.isInteger(wrongSign) && wrongSign > 0 && !isTerm(wrongSign)) cands.push({ v: wrongSign, trap: 'algw-recursion-sign' });
      }
      for (const v of [seq[0] - 1, seq[1] + 1, seq[2] - 1, seq[4] + 2, seq[3] + p]) if (!isTerm(v) && v > 0) cands.push({ v, trap: 'algw-seq-near-term' });
      const seen = new Set([...correct, ag]);
      wrong = [];
      for (const c of rng.shuffle(cands)) {
        if (seen.has(c.v) || wrong.length >= 6 - correct.length) continue;
        seen.add(c.v);
        wrong.push(c);
      }
      params = { ...base, p, q: qq, g, ag };
      stem = `In the sequence $a_1, a_2, a_3, \\ldots$, each term after the first is defined by $a_n = ${linRule(p, qq)}$. If $${sub(g)} = ${ag}$, which of the following numbers are terms of the sequence?`;
      explanation = `Work backward with $${sub('n-1')} = \\frac{a_n + ${-qq}}{${p}}$ (undo the subtraction first, then the multiplication), and forward with the rule itself:

$$${seq.map((x, i) => `${sub(i + 1)} = ${x}`).join(',\\ ')}$$

After $${sub(6)}$ the terms only grow. So the terms among the choices are ${[...correct].sort((x, y) => x - y).join(', ')}. The other numbers come from undoing the steps in the wrong order (dividing before adding back ${-qq}) or from arithmetic slips.`;
    } else {
      const r = rng.pick([-2, -3]);
      const a1 = rng.int(1, 5) * rng.sign();
      const seq = [a1];
      for (let i = 1; i < 9; i++) seq.push(seq[i - 1] * r);
      const idxs = rng.sample([3, 4, 5, 6, 7, 8], rng.int(2, 3));
      correct = idxs.map((i) => seq[i]);
      const cands: { v: number; trap?: string }[] = [];
      for (const i of rng.shuffle([2, 3, 4, 5, 6, 7, 8])) cands.push({ v: -seq[i], trap: 'algw-geo-sign' });
      cands.push({ v: a1 * Math.abs(r) * 5 * Math.sign(r), trap: 'algw-seq-near-term' });
      const seen = new Set(correct);
      wrong = [];
      for (const c of cands) {
        if (seen.has(c.v) || seq.includes(c.v) || wrong.length >= 6 - correct.length) continue;
        seen.add(c.v);
        wrong.push(c);
      }
      params = { ...base, a1, r };
      stem = `In a sequence, the first term is $${num(a1)}$ and each term after the first is $${r}$ times the preceding term. Which of the following numbers are terms of the sequence?`;
      explanation = `List the terms: $${seq.slice(0, 9).map((x) => num(x)).join(',\\ ')}, \\ldots$

Multiplying by a negative number makes the signs alternate: the odd-numbered terms have the sign of $a_1$ and the even-numbered terms the opposite sign. A number with the right size but the wrong sign is not a term.`;
    }
    const items = [...correct.map((v) => ({ v, correct: true, trap: undefined as string | undefined })), ...wrong.map((w) => ({ v: w.v, correct: false, trap: w.trap }))].sort((x, y) => x.v - y.v);
    const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${num(it.v)}$`, correct: it.correct, ...(it.trap ? { trap: it.trap } : {}) })));
    params.values = items.map((it) => it.v);
    return {
      params,
      q: { format: 'mcm', stem, instruction: 'Indicate all such numbers.', choices, answer, explanation },
    };
  },
  check(q, prm) {
    // Generate the terms by iteration and test membership.
    const terms = new Set<number>();
    if (prm.kind === 'arith' || prm.kind === 'formula') {
      let x = prm.kind === 'arith' ? prm.a1 : prm.d * 1 + prm.e;
      for (let i = 0; i < 2000; i++, x += prm.d) terms.add(x);
    } else if (prm.kind === 'geo-neg') {
      let x = prm.a1;
      for (let i = 0; i < 25; i++, x *= prm.r) terms.add(x);
    } else {
      let a1: number | null = null;
      for (let a = -500; a <= 500; a++) {
        let x = a;
        for (let i = 1; i < prm.g; i++) x = prm.p * x + prm.q;
        if (x === prm.ag) a1 = a;
      }
      if (a1 === null) return 'no first term';
      let x = a1;
      for (let i = 0; i < 20 && Math.abs(x) < 1e9; i++, x = prm.p * x + prm.q) terms.add(x);
    }
    return expectMcm(
      q,
      prm.values.map((v) => terms.has(v)),
    );
  },
};

/* =============================================================================================
 * 5. Sums of terms (MCS)
 * =========================================================================================== */

interface SumParams {
  kind: 'first-n' | 'range' | 'geo';
  a1: number;
  d: number;
  /** range: a_k = p k + c */
  p: number;
  c: number;
  from: number;
  to: number;
  r: number;
  values: Frac[];
}

const fmtN = (v: Frac) => `$${num(v)}$`;

const sequenceSum: Template<SumParams> = {
  id: 'alg.sequences.sum',
  skill: 'alg.sequences',
  format: 'mcs',
  style: 'sum of a run of terms of an arithmetic or geometric sequence',
  generate(rng, d) {
    const kind: SumParams['kind'] = d === 1 ? 'first-n' : d === 2 ? rng.pick(['first-n', 'range'] as const) : rng.pick(['range', 'geo'] as const);
    const base: SumParams = { kind, a1: 0, d: 0, p: 0, c: 0, from: 0, to: 0, r: 0, values: [] };
    let correct: number;
    let traps: { value: Frac; trap: string }[] = [];
    let stem: string;
    let explanation: string;
    let params: SumParams;
    if (kind === 'first-n') {
      const a1 = rng.int(1, 12);
      const dd = rng.int(2, 7);
      const n = rng.pick([10, 12, 15, 20, 25, 30]);
      const last = a1 + (n - 1) * dd;
      correct = (n * (a1 + last)) / 2;
      traps = [
        { value: frac(n * last), trap: 'algw-seq-sum-last-times-n' },
        { value: frac((n - 1) * (a1 + a1 + (n - 2) * dd), 2), trap: 'algw-seq-count-terms' },
        { value: frac(n * (a1 + a1 + n * dd), 2), trap: 'algw-seq-off-by-one' },
        { value: frac(n * (a1 + last)), trap: 'algw-seq-forgot-half' },
        { value: frac(n * a1), trap: 'algw-seq-first-times-n' },
        { value: frac(correct + last + dd), trap: 'algw-seq-count-terms' },
        { value: frac(correct - a1), trap: 'algw-seq-count-terms' },
        { value: frac(a1 + last, 2), trap: 'algw-seq-average' },
        { value: frac(last), trap: 'algw-answered-single-term' },
      ].filter((t) => t.value.isInt());
      params = { ...base, a1, d: dd, from: 1, to: n };
      const shown = [0, 1, 2, 3].map((i) => num(a1 + i * dd)).join(', ');
      stem = `What is the sum of the first ${n} terms of the sequence $${shown}, \\ldots$, in which each term after the first is ${dd} more than the preceding term?`;
      explanation = `The ${ordinal(n)} term is $${a1} + ${n - 1}(${dd}) = ${last}$. The terms are evenly spaced, so their average is the average of the first and last terms, $\\frac{${a1} + ${last}}{2} = ${num(frac(a1 + last, 2))}$.

Sum $= ${n} \\times ${num(frac(a1 + last, 2))} = ${num(correct)}$.`;
    } else if (kind === 'range') {
      const p = rng.int(2, 6);
      const c = rng.int(-9, 9) || 1;
      const from = rng.int(5, 20);
      const to = from + rng.int(9, 30);
      const term = (k: number) => p * k + c;
      const count = to - from + 1;
      correct = (count * (term(from) + term(to))) / 2;
      traps = [
        { value: frac((count - 1) * (term(from) + term(to)), 2), trap: 'algw-seq-count-terms' },
        { value: frac(count * term(to)), trap: 'algw-seq-sum-last-times-n' },
        { value: frac(count * (term(from) + term(to))), trap: 'algw-seq-forgot-half' },
        { value: frac(count * term(from)), trap: 'algw-seq-first-times-n' },
        { value: frac(to * (term(1) + term(to)), 2), trap: 'algw-seq-from-start' },
        { value: frac(correct + term(to + 1)), trap: 'algw-seq-count-terms' },
        { value: frac(correct - term(from)), trap: 'algw-seq-count-terms' },
        { value: frac(term(from) + term(to), 2), trap: 'algw-seq-average' },
        { value: frac(term(to)), trap: 'algw-answered-single-term' },
      ].filter((t) => t.value.isInt());
      params = { ...base, p, c, from, to };
      stem = `The sequence $a_1, a_2, a_3, \\ldots$ is defined by $a_k = ${p}k ${c < 0 ? '-' : '+'} ${Math.abs(c)}$ for all positive integers $k$. What is the sum of the terms from $${sub(from)}$ to $${sub(to)}$, inclusive?`;
      explanation = `$${sub(from)} = ${term(from)}$ and $${sub(to)} = ${term(to)}$. From term ${from} to term ${to} there are $${to} - ${from} + 1 = ${count}$ terms, evenly spaced (each ${p} more than the one before).

Sum $= ${count} \\times \\frac{${term(from)} + ${term(to)}}{2} = ${num(correct)}$.`;
    } else {
      const r = rng.pick([2, 3]);
      const a1 = rng.int(1, 5) * (r === 3 ? 1 : rng.pick([1, 3]));
      const n = r === 2 ? rng.int(6, 9) : rng.int(5, 6);
      const seq = [a1];
      for (let i = 1; i < n; i++) seq.push(seq[i - 1] * r);
      correct = seq.reduce((s, x) => s + x, 0);
      const last = seq[n - 1];
      traps = [
        { value: frac(correct - last), trap: 'algw-seq-count-terms' },
        { value: frac(correct + last * r), trap: 'algw-seq-count-terms' },
        { value: frac(n * last), trap: 'algw-seq-sum-last-times-n' },
        { value: frac(a1 * (r ** n - 1)), trap: 'algw-geo-formula-slip' },
        { value: frac(n * a1), trap: 'algw-seq-first-times-n' },
        { value: frac(a1 * r ** n, r - 1), trap: 'algw-geo-formula-slip' },
        { value: frac(last), trap: 'algw-answered-single-term' },
        { value: frac(correct - a1), trap: 'algw-seq-count-terms' },
      ].filter((t) => t.value.isInt());
      params = { ...base, a1, r, from: 1, to: n };
      stem = `In the sum $${seq.slice(0, 3).map((x) => num(x)).join(' + ')} + \\cdots + ${num(last)}$, each term after the first is ${r} times the preceding term. What is the value of the sum?`;
      explanation = `First count the terms: $${num(last)} = ${a1 === 1 ? '' : `${a1} \\cdot `}${r}^{${n - 1}}$, so there are ${n} terms: $${seq.map((x) => num(x)).join(' + ')}$.

Adding them gives $${num(correct)}$. (Shortcut: $${a1 === 1 ? '' : a1}${a1 === 1 ? '' : '\\cdot'}\\frac{${r}^{${n}} - 1}{${r} - 1} = ${num(correct)}$.)`;
    }
    const WHY: Record<string, string> = {
      'algw-seq-sum-last-times-n': 'multiplying the last term by the number of terms, as if every term were the largest',
      'algw-seq-count-terms': 'miscounting the terms by one',
      'algw-seq-off-by-one': 'going one step too far',
      'algw-seq-forgot-half': 'forgetting to divide by 2',
      'algw-seq-first-times-n': 'multiplying the first term by the number of terms',
      'algw-seq-from-start': 'adding from the first term instead of from the stated start',
      'algw-geo-formula-slip': 'a slip in the formula for a geometric sum',
      'algw-seq-average': 'giving the average of the first and last terms instead of the sum',
      'algw-answered-single-term': 'giving a single term instead of the sum',
    };
    const res = trapChoices(rng, correct, traps.filter((t) => t.value.sign() > 0 || correct <= 0), fmtN);
    if (!res) return sequenceSum.generate(rng, d);
    const cited = res.kept[0];
    params.values = res.values;
    return { params, q: { format: 'mcs', stem, choices: res.choices, answer: res.answer, explanation: `${explanation}

Trap: $${num(cited.value)}$ comes from ${WHY[cited.trap]}.` } };
  },
  check(q, prm) {
    const err = choiceValuesMatch(q, prm.values, fmtN);
    if (err) return err;
    let total = 0;
    if (prm.kind === 'first-n') for (let i = 0; i < prm.to; i++) total += prm.a1 + i * prm.d;
    else if (prm.kind === 'range') for (let k = prm.from; k <= prm.to; k++) total += prm.p * k + prm.c;
    else for (let i = 0, x = prm.a1; i < prm.to; i++, x *= prm.r) total += x;
    return expectMcs(
      q,
      uniqueIndex(prm.values, (v) => v.eq(total)),
    );
  },
};

export const sequenceTemplates: Template<any>[] = [nthTerm, recursiveSeq, seqCompareQC, termsOfSequence, sequenceSum];

