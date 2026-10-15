import { flaggedChoices, numericChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num, paren } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { N, V, countWord, wordCount, sideFill, someTraps, div, evalEx, intExcept, mul, pow, qcEnd, qcSamples, texEx, add, type Ex } from './util';

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

const solveIneqMCM: Template<SolveIneqParams> = {
  id: 'alg.inequalities.solve-mcm',
  skill: 'alg.inequalities',
  format: 'mcm',
  style: 'which values satisfy a linear or compound inequality',
  generate(rng, d) {
    const kind: SolveIneqParams['kind'] = d === 1 ? 'linear' : rng.pick(d === 2 ? ['linear', 'compound'] : ['compound', 'compound', 'linear']);
    let k: number[];
    let ops: Op[];
    let stem: string;
    let explanation: string;
    let candidates: number[];
    let noFlip: (x: number) => boolean;
    if (kind === 'linear') {
      const t = rng.int(-6, 8);
      let a: number;
      let c: number;
      do {
        a = rng.int(-6, 7);
        c = rng.int(-6, 7);
      } while (a === c || a === 0 || c === 0 || (d === 1 ? false : a - c > 0 && rng.chance(0.6)));
      const b = rng.int(-12, 12);
      const dd = (a - c) * t + b; // equality at x = t
      const op: Op = rng.pick(['<', '<=', '>', '>=']);
      k = [a, b, c, dd];
      ops = [op];
      const coef = a - c;
      const resOp = coef > 0 ? op : flip(op);
      stem = `Which of the following values of $x$ satisfy the inequality $${lin([[a, 'x'], [b, '']])} ${OP_TEX[op]} ${lin([[c, 'x'], [dd, '']])}$?`;
      explanation = `Collect the $x$ terms on the left and the numbers on the right: $${lin([[coef, 'x']])} ${OP_TEX[op]} ${num(dd - b)}$.

${coef < 0 ? `Divide by $${coef}$, a negative number, so the inequality sign flips: $x ${OP_TEX[resOp]} ${num(t)}$.` : coef === 1 ? `So $x ${OP_TEX[resOp]} ${num(t)}$.` : `Divide by ${coef}: $x ${OP_TEX[resOp]} ${num(t)}$.`}${
        op === '<' || op === '>' ? ` The value $${num(t)}$ itself is not included.` : ` The value $${num(t)}$ itself is included.`
      }`;
      candidates = [t - 3, t - 2, t - 1, t, t + 1, t + 2, t + 3, t + 5, t - 5];
      noFlip = (x) => holds(frac(x), coef > 0 ? flip(op) : op, frac(t));
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
      const q = rng.int(-9, 9);
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
      explanation = `Do the same step to all three parts. ${q === 0 ? '' : `${q > 0 ? `Subtract ${q}` : `Add ${-q}`}: $${num(L - q)} ${OP_TEX[op1]} ${lin([[p, 'x']])} ${OP_TEX[op2]} ${num(R - q)}$. `}${
        p < 0
          ? `Divide by $${p}$, which is negative, so both signs flip: $${num(lo)} ${OP_TEX[flip(op1)]} x ${OP_TEX[flip(op2)]} ${num(hi)}$, that is, $${num(a1)} ${OP_TEX[o1]} x ${OP_TEX[o2]} ${num(a2)}$.`
          : `Divide by ${p}: $${num(a1)} ${OP_TEX[o1]} x ${OP_TEX[o2]} ${num(a2)}$.`
      }

Check each choice against this interval, paying attention to which endpoints are included.`;
      candidates = [a1 - 2, a1 - 1, a1, a1 + 1, Math.round((a1 + a2) / 2), a2 - 1, a2, a2 + 1, a2 + 2, -a1, -a2];
      noFlip = (x) => {
        if (p > 0) return false;
        // the inequality written without flipping: lo op1 x op2 hi
        return holds(frac(lo), op1, frac(x)) && holds(frac(x), op2, frac(hi));
      };
    }
    const uniq = [...new Set(candidates!)];
    const flags = uniq.map((x) => ({ x, ok: ineqHolds(kind, k!, ops!, frac(x)) }));
    const good = rng.shuffle(flags.filter((f) => f.ok));
    const bad = rng.shuffle(flags.filter((f) => !f.ok));
    const total = rng.pick([5, 6, 7]);
    const nGood = Math.max(1, Math.min(good.length, rng.int(1, Math.min(4, total - 2))));
    const picked = [...good.slice(0, nGood), ...bad.slice(0, total - nGood)].sort((u, v) => u.x - v.x);
    const items = picked.map((f) => {
      let trap: string | undefined;
      if (!f.ok && noFlip!(f.x)) trap = 'alg-no-flip';
      else if (!f.ok && kind === 'linear' && f.x === (k![3] - k![1]) / (k![0] - k![2])) trap = 'alg-strict-endpoint';
      else if (!f.ok && kind === 'compound') {
        const [L, p, q, R] = k!;
        if (f.x === (L - q) / p || f.x === (R - q) / p) trap = 'alg-strict-endpoint';
      }
      return { text: `$${num(f.x)}$`, correct: f.ok, ...(trap ? { trap } : {}) };
    });
    const { choices, answer } = flaggedChoices(items);
    return {
      params: { kind, k: k!, ops: ops!, values: picked.map((f) => f.x) },
      q: {
        format: 'mcm',
        stem: stem!,
        instruction: 'Indicate all such values.',
        choices,
        answer,
        explanation: explanation!,
      },
    };
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
  /** square: x^2 (op) k -> [k]; abs: |a x - b| (op) c -> [a, b, c]; product: (x - a)(x - b) < 0 -> [a, b] */
  k: number[];
  op: Op;
  values: number[];
}

const countIntegersMCS: Template<CountParams> = {
  id: 'alg.inequalities.integer-count-mcs',
  skill: 'alg.inequalities',
  format: 'mcs',
  style: 'count the integers in a solution set',
  generate(rng, d) {
    const kind: CountParams['kind'] = rng.pick(d === 1 ? ['square', 'product'] : d === 2 ? ['square', 'abs', 'product'] : ['abs', 'square', 'abs']);
    let k: number[];
    let op: Op;
    let stem: string;
    let explanation: string;
    let answer: number;
    const traps: { value: number; trap: string }[] = [];
    if (kind === 'square') {
      const perfect = rng.chance(0.3);
      const m0 = rng.int(2, d === 1 ? 4 : 7);
      const K = perfect ? m0 * m0 : m0 * m0 + rng.int(1, 2 * m0);
      op = perfect && rng.chance(0.5) ? '<=' : '<';
      k = [K];
      let m = 0;
      while ((m + 1) * (m + 1) < K || (op === '<=' && (m + 1) * (m + 1) <= K)) m++;
      answer = 2 * m + 1;
      const form = rng.chance(0.5) ? `x^2 - ${K} ${OP_TEX[op]} 0` : `x^2 ${OP_TEX[op]} ${K}`;
      stem = `How many integers $x$ satisfy the inequality $${form}$?`;
      explanation = `$x^2 ${OP_TEX[op]} ${K}$ means $-${perfect ? m0 : `\\sqrt{${K}}`} ${OP_TEX[op]} x ${OP_TEX[op]} ${perfect ? m0 : `\\sqrt{${K}}`}$${perfect ? '' : `, and $${m}^2 = ${m * m} < ${K} < ${(m + 1) ** 2} = ${m + 1}^2$`}.

The integers are $${m <= 3 ? Array.from({ length: 2 * m + 1 }, (_, i) => i - m).join(', ') : `-${m}, -${m - 1}, \\ldots, ${m - 1}, ${m}`}$: ${m} negative, ${m} positive, and 0, for a total of ${answer}.`;
      traps.push({ value: m, trap: 'alg-count-positive-only' }, { value: 2 * m, trap: 'alg-count-forgot-zero' });
      if (perfect && op === '<') traps.push({ value: 2 * m0 + 1, trap: 'counted-endpoint' });
      if (!perfect && K <= 20) traps.push({ value: K, trap: 'alg-count-to-k' });
    } else if (kind === 'abs') {
      const a = d === 3 ? rng.pick([1, 2, 3]) : 1;
      const b = intExcept(rng, -9, 9, 0);
      const c = rng.int(2, 8);
      op = rng.pick(['<', '<=']);
      k = [a, b, c];
      // -c op a x - b op c  ->  (b - c)/a op x op (b + c)/a
      const lo = new Frac(b - c, a);
      const hi = new Frac(b + c, a);
      const ints: number[] = [];
      for (let x = Math.floor(lo.toNumber()) - 1; x <= Math.ceil(hi.toNumber()) + 1; x++) if (holds(lo, op, frac(x)) && holds(frac(x), op, hi)) ints.push(x);
      answer = ints.length;
      const inside = a === 1 ? `x ${b > 0 ? '-' : '+'} ${Math.abs(b)}` : `${a}x ${b > 0 ? '-' : '+'} ${Math.abs(b)}`;
      stem = `How many integers $x$ satisfy $|${inside}| ${OP_TEX[op]} ${c}$?`;
      explanation = `$|${inside}| ${OP_TEX[op]} ${c}$ means $-${c} ${OP_TEX[op]} ${inside} ${OP_TEX[op]} ${c}$. ${b > 0 ? `Add ${b}` : `Subtract ${-b}`}: $${num(b - c)} ${OP_TEX[op]} ${a === 1 ? 'x' : `${a}x`} ${OP_TEX[op]} ${num(b + c)}$${a === 1 ? '' : `, then divide by ${a}: $${lo.toTex()} ${OP_TEX[op]} x ${OP_TEX[op]} ${hi.toTex()}$`}.

The integers in this interval are $${num(ints[0])}$ through $${num(ints[ints.length - 1])}$: there are $${num(ints[ints.length - 1])} - ${paren(ints[0])} + 1 = ${answer}$ of them.${op === '<' && (lo.isInt() || hi.isInt()) ? ' The endpoints themselves are excluded because the inequality is strict.' : ''}`;
      const strictOther = op === '<' ? answer + (lo.isInt() ? 1 : 0) + (hi.isInt() ? 1 : 0) : answer - (lo.isInt() ? 1 : 0) - (hi.isInt() ? 1 : 0);
      if (op === '<') traps.push({ value: strictOther, trap: 'counted-endpoint' });
      traps.push({ value: answer - 1, trap: 'alg-count-off-by-one' });
    } else {
      const a = rng.int(-8, 4);
      const b = a + rng.int(3, 9);
      op = '<';
      k = [a, b];
      answer = b - a - 1;
      const f = (r: number) => (r === 0 ? 'x' : `(x ${r > 0 ? '-' : '+'} ${Math.abs(r)})`);
      stem = `How many integers $x$ satisfy $${f(a)}${f(b)} < 0$?`;
      explanation = `A product of two factors is negative when the factors have opposite signs. That happens between the two roots: $${num(a)} < x < ${num(b)}$ (for $x$ outside, both factors have the same sign).

The integers strictly between $${num(a)}$ and $${num(b)}$ number $${b} - ${paren(a)} - 1 = ${answer}$.`;
      traps.push({ value: b - a + 1, trap: 'counted-endpoint' }, { value: b - a, trap: 'alg-count-off-by-one' });
    }
    const { choices, answer: idx } = numericChoices(rng, {
      correct: answer!,
      traps: someTraps(rng, traps.filter((t) => t.value !== answer && t.value >= 0)),
      fillers: [...sideFill(rng, answer!).filter((v) => v.sign() >= 0), frac(answer! + 1), frac(answer! + 2), frac(answer! * 2)],
      format: (v) => countWord(v.toNumber()),
    });
    const values = choices.map((c) => wordCount(c.text));
    return { params: { kind, k: k!, op: op!, values }, q: { format: 'mcs', stem: stem!, choices, answer: idx, explanation: explanation! } };
  },
  check(q, { kind, k, op, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => v < 0 || q.choices[i].text !== countWord(v))) return 'choice text mismatch';
    const cmp = (l: number, r: number) => (op === '<' ? l < r : l <= r);
    let count = 0;
    for (let x = -300; x <= 300; x++) {
      const ok = kind === 'square' ? cmp(x * x, k[0]) : kind === 'abs' ? cmp(Math.abs(k[0] * x - k[1]), k[2]) : (x - k[0]) * (x - k[1]) < 0;
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
            ? `$|m + ${K}| = m + ${K}$ when $m + ${K} \\ge 0$, but when $m + ${K} < 0$ (for example $m = ${-K - 1}$), Quantity A is positive and Quantity B is negative. ${qcEnd('D')}`
            : `Since $m > ${num(-K)}$, $m + ${K}$ is positive, and the absolute value of a positive number is the number itself. ${qcEnd('C')}`;
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
        explanation = `Try values. ${tried}

In general, ${cond === 'neg' ? ifNeg.replace(/^If/, 'if') : ifPos}${cond === 'none' ? ` ${ifNeg}` : ''} ${here} ${qcEnd(answer)}`;
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
      explanation = `$${info.slice(1, -1)}$ means $-${c} ${opT} ${a === 1 ? 'x' : `${a}x`} ${b > 0 ? '-' : '+'} ${Math.abs(b)} ${opT} ${c}$, so $${num(b - c)} ${opT} ${a === 1 ? 'x' : `${a}x`} ${opT} ${num(b + c)}$${
        a === 1 ? '' : ` and $${num(lo)} ${opT} x ${opT} ${num(hi)}$`
      }.

${
        answer === 'A'
          ? `Every allowed $x$ is ${closed ? 'at least' : 'greater than'} $${num(lo)}$${closed && lo === t ? '' : ''}, which is ${lo === t ? 'equal to' : 'greater than'} $${num(t)}$, so $x > ${num(t)}$.`
          : answer === 'B'
            ? `Every allowed $x$ is ${closed ? 'at most' : 'less than'} $${num(hi)}$, which is ${hi === t ? 'equal to' : 'less than'} $${num(t)}$, so $x < ${num(t)}$.`
            : `The interval contains values of $x$ on both sides of $${num(t)}$${t === lo || t === hi ? ` (including $x = ${num(t)}$ itself)` : ''}.`
      } ${qcEnd(answer)}`;
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
      if (naive !== answer) traps.push({ value: frac(naive), trap: 'alg-range-subtract' });
    } else if (kind === 'product') {
      const corners = [x1 * y1, x1 * y2, x2 * y1, x2 * y2];
      answer = want === 'max' ? Math.max(...corners) : Math.min(...corners);
      stem = `If ${xr} and ${yr}, what is the ${wantWord} possible value of $xy$?`;
      explanation = `The extreme values of a product occur at the endpoints, but signs matter, so test all four combinations: $(${num(x1)})(${num(y1)}) = ${num(x1 * y1)}$, $(${num(x1)})(${num(y2)}) = ${num(x1 * y2)}$, $(${num(x2)})(${num(y1)}) = ${num(x2 * y1)}$, $(${num(x2)})(${num(y2)}) = ${num(x2 * y2)}$.

The ${wantWord} is $${num(answer)}$.`;
      const naive = want === 'max' ? x2 * y2 : x1 * y1;
      if (naive !== answer) traps.push({ value: frac(naive), trap: 'alg-range-product' });
    } else if (kind === 'square') {
      const lo = rng.int(-9, -1);
      const hi = rng.int(1, 9);
      const finalLo = lo === -hi ? lo - 1 : lo;
      answer = want === 'max' ? Math.max(finalLo * finalLo, hi * hi) : 0;
      stem = `If $${num(finalLo)} \\le x \\le ${hi}$, what is the ${wantWord} possible value of $x^2$?`;
      explanation =
        want === 'max'
          ? `$x^2$ is largest where $x$ is farthest from 0. The endpoints give $(${num(finalLo)})^2 = ${finalLo * finalLo}$ and $${hi}^2 = ${hi * hi}$, so the greatest value is ${answer}.`
          : `The interval contains 0, and $x^2 \\ge 0$ for every $x$, so the least value is $0^2 = 0$, not the square of an endpoint.`;
      const naive = want === 'max' ? hi * hi : Math.min(finalLo * finalLo, hi * hi);
      if (naive !== answer) traps.push({ value: frac(naive), trap: 'alg-range-square' });
      strict = [false, false, false, false];
      return {
        params: { kind, x: [finalLo, hi], y: [0, 0], coef, want, strict },
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
      const naive = coef[0] * pick(coef[0], x1, x2) + coef[1] * pick(coef[1], y1, y2);
      if (naive !== answer) traps.push({ value: frac(naive), trap: 'alg-strict-endpoint' });
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
    for (const a of xs)
      for (const b of ys) {
        const v = kind === 'product' ? a * b : kind === 'square' ? a * a : coef[0] * a + coef[1] * b;
        best = want === 'max' ? Math.max(best, v) : Math.min(best, v);
      }
    return Math.abs(q.answer.toNumber() - best) < 1e-9 ? null : `expected ${best}`;
  },
};

/* ================================================================== 5. Order expressions under a condition (MCS) */

interface OrderCase {
  cond: string;
  exprs: Ex[];
  /** a representative point */
  rep: [number, number];
  /** sampler for the region */
  region: [number, number, number, number];
  twoVar: boolean;
}

const x = V('x');
const y = V('y');
const ORDER_CASES: OrderCase[] = [
  { cond: '-1 < x < y < 0', exprs: [mul(x, y), mul(pow(x, 2), y), mul(x, pow(y, 2))], rep: [-0.5, -0.25], region: [-1, 0, -1, 0], twoVar: true },
  { cond: '0 < x < y < 1', exprs: [mul(x, y), div(x, y), div(y, x)], rep: [0.25, 0.5], region: [0, 1, 0, 1], twoVar: true },
  { cond: '-1 < x < y < 0', exprs: [mul(x, y), div(x, y), div(y, x)], rep: [-0.5, -0.25], region: [-1, 0, -1, 0], twoVar: true },
  { cond: 'x < y < 0', exprs: [add(x, y), add(x, mul(N(-1), y)), add(y, mul(N(-1), x))], rep: [-3, -1], region: [-20, 0, -20, 0], twoVar: true },
  { cond: 'x < 0 < y < 1', exprs: [mul(x, y), mul(x, pow(y, 2)), mul(pow(x, 2), y)], rep: [-2, 0.5], region: [-20, 0, 0, 1], twoVar: true },
  { cond: '-1 < x < 0', exprs: [x, pow(x, 2), pow(x, 3)], rep: [-0.5, 0], region: [-1, 0, 0, 0], twoVar: false },
  { cond: 'x < -1', exprs: [x, pow(x, 3), div(N(1), x)], rep: [-2, 0], region: [-30, -1, 0, 0], twoVar: false },
  { cond: '0 < x < 1', exprs: [x, pow(x, 2), div(N(1), x)], rep: [0.5, 0], region: [0, 1, 0, 0], twoVar: false },
];

interface OrderParams {
  c: number;
  perms: number[][];
}

const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

const orderText = (cs: OrderCase, p: number[]) => `$${p.map((i) => texEx(cs.exprs[i])).join(' < ')}$`;

const orderMCS: Template<OrderParams> = {
  id: 'alg.inequalities.order-mcs',
  skill: 'alg.inequalities',
  format: 'mcs',
  style: 'order expressions when the variables lie in an interval',
  generate(rng, d) {
    const pool = d === 1 ? [3, 5, 7, 6] : d === 2 ? [1, 3, 4, 5, 6, 7] : [0, 1, 2, 4];
    const c = rng.pick(pool);
    const cs = ORDER_CASES[c];
    const env = { x: cs.rep[0], y: cs.rep[1] };
    const vals = cs.exprs.map((e) => evalEx(e, env));
    const correct = [0, 1, 2].sort((i, j) => vals[i] - vals[j]);
    const byAbs = [0, 1, 2].sort((i, j) => Math.abs(vals[i]) - Math.abs(vals[j]));
    const key = (p: number[]) => p.join('');
    const others = rng.shuffle(PERMS.filter((p) => key(p) !== key(correct)));
    // keep the magnitude ordering and the reversed ordering among the wrong choices
    const rev = [...correct].reverse();
    const preferred = [byAbs, rev].filter((p) => key(p) !== key(correct));
    const wrong: number[][] = [];
    for (const p of [...preferred, ...others]) if (wrong.length < 4 && !wrong.some((w) => key(w) === key(p))) wrong.push(p);
    const all = rng.shuffle([correct, ...wrong]);
    const choices: Choice[] = all.map((p) => ({
      text: orderText(cs, p),
      ...(key(p) === key(byAbs) && key(p) !== key(correct) ? { trap: 'alg-magnitude-vs-value' } : key(p) === key(rev) ? { trap: 'alg-order-reversed' } : {}),
    }));
    const names = cs.exprs.map((e) => `$${texEx(e)}$`);
    const listNames = `${names[0]}, ${names[1]}, and ${names[2]}`;
    const repText = cs.twoVar ? `$x = ${fracTex(cs.rep[0])}$ and $y = ${fracTex(cs.rep[1])}$` : `$x = ${fracTex(cs.rep[0])}$`;
    const valueList = cs.exprs.map((e, i) => `$${texEx(e)} = ${fracTex(vals[i])}$`).join(', ');
    return {
      params: { c, perms: all },
      q: {
        format: 'mcs',
        stem: `If $${cs.cond}$, which of the following lists ${listNames} in order from least to greatest?`,
        choices,
        answer: all.findIndex((p) => key(p) === key(correct)),
        explanation: `Test values allowed by the condition, for example ${repText}: ${valueList}. So ${orderText(cs, correct)}.

${
          vals.some((v) => v < 0)
            ? 'The order holds for every allowed value: signs decide first (every negative number is less than every positive one), and among negative numbers the one farther from 0 is smaller. Ordering by size alone, ignoring the signs, is the trap.'
            : 'The order holds for every allowed value: for numbers between 0 and 1, multiplying by another such number makes a product smaller, and dividing by one makes a quotient larger.'
        }`,
      },
    };
  },
  check(q, { c, perms }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    const cs = ORDER_CASES[c];
    const [x1, x2, y1, y2] = cs.region;
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      let xv: number;
      let yv: number;
      do {
        xv = x1 + (x2 - x1) * rng.next();
        yv = cs.twoVar ? y1 + (y2 - y1) * rng.next() : 0;
      } while (xv === x1 || xv === x2 || (cs.twoVar && (yv === y1 || yv === y2 || (cs.cond.includes('x < y') && !(xv < yv)))));
      const vals = cs.exprs.map((e) => evalEx(e, { x: xv, y: yv }));
      const order = [0, 1, 2].sort((a, b) => vals[a] - vals[b]);
      seen.add(order.join(''));
    }
    if (seen.size !== 1) return `order not constant: ${[...seen]}`;
    const truth = [...seen][0];
    const idx = perms.findIndex((p) => p.join('') === truth);
    if (perms.some((p, i) => q.choices[i].text !== orderText(cs, p))) return 'choice text mismatch';
    return idx === q.answer ? null : `expected ${idx}`;
  },
};

function fracTex(v: number): string {
  for (const dd of [1, 2, 3, 4, 8, 16, 32, 64]) {
    const n = Math.round(v * dd);
    if (Math.abs(n / dd - v) < 1e-12) return new Frac(n, dd).toTex();
  }
  return num(v);
}

export const inequalityTemplates = [solveIneqMCM, countIntegersMCS, absQC, rangeNE, orderMCS];
