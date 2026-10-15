import { qcCompare, textChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd, lcm } from '../../../engine/math';
import { lin, num, paren } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { N, V, add, close, intExcept, times, div, evalEx, lx, mul, qcEnd, qcSamples, texEx, trapChoices, type Ex } from './util';

/* ================================================================== 1. Solve a linear equation (MCS) */

interface SolveParams {
  kind: 'collect' | 'distribute' | 'fractions';
  /** collect: [a, b, c, d] for ax + b = c - dx. distribute: [a, b, c, dd, e, f] for a(bx - c) + dd = ex + f.
   *  fractions: [p, m, q, n, r] for (x + p)/m - (x - q)/n = r. */
  k: number[];
  values: [number, number][];
}

/** Left and right side of the equation at x. */
function sides(kind: SolveParams['kind'], k: number[], x: Frac): [Frac, Frac] {
  if (kind === 'collect') {
    const [a, b, c, d] = k;
    return [x.mul(a).add(b), new Frac(c).sub(x.mul(d))];
  }
  if (kind === 'distribute') {
    const [a, b, c, dd, e, f] = k;
    return [x.mul(b).sub(c).mul(a).add(dd), x.mul(e).add(f)];
  }
  const [p, m, q, n, r] = k;
  return [x.add(p).div(m).sub(x.sub(q).div(n)), new Frac(r)];
}

function residual(kind: SolveParams['kind'], k: number[], x: Frac): Frac {
  const [l, r] = sides(kind, k, x);
  return l.sub(r);
}

/** "add 5 to" / "subtract 5 from" both sides, for moving the constant b away from the left. */
const removeConst = (b: number) => (b > 0 ? `subtract ${b} from` : `add ${-b} to`);

const solveLinearMCS: Template<SolveParams> = {
  id: 'alg.linear-equations.solve-mcs',
  skill: 'alg.linear-equations',
  format: 'mcs',
  style: 'solve a one-variable equation',
  generate(rng, d) {
    for (;;) {
      const kind: SolveParams['kind'] = d === 1 ? 'collect' : d === 2 ? rng.pick(['distribute', 'collect', 'distribute']) : rng.pick(['fractions', 'distribute', 'fractions']);
      let x0: number;
      do x0 = rng.int(-12, 12);
      while (Math.abs(x0) <= 1);
      let k: number[];
      let stem: string;
      let recognize: string;
      let steps: string;
      let rule: string;
      const traps: { value: Frac; trap: string; why: string }[] = [];
      if (kind === 'collect') {
        const a = rng.int(2, 9);
        let dd: number;
        do dd = rng.int(1, 7);
        while (dd === a);
        let b: number;
        do b = rng.int(-15, 15);
        while (b === 0);
        const c = (a + dd) * x0 + b;
        k = [a, b, c, dd];
        stem = `If $${lin([[a, 'x'], [b, '']])} = ${lin([[c, ''], [-dd, 'x']])}$, what is the value of $x$?`;
        recognize = `The unknown appears on both sides, so gather the $x$ terms on one side by doing the same thing to both sides.`;
        steps = `Add $${lin([[dd, 'x']])}$ to both sides (it cancels the $-${lin([[dd, 'x']])}$ on the right) and ${removeConst(b)} both sides: $${a + dd}x = ${num(c - b)}$. Divide both sides by ${a + dd}: $x = ${num(x0)}$.

Check: $${a}(${num(x0)}) ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${num(a * x0 + b)}$ and $${num(c)} - ${dd === 1 ? '' : dd}(${num(x0)}) = ${num(c - dd * x0)}$.`;
        rule = `Whatever you add or subtract on one side, do on the other.`;
        traps.push({ value: new Frac(c - b, a - dd), trap: 'alg-move-term-sign', why: `moving $${lin([[dd, 'x']])}$ across by subtracting it from the left` });
        traps.push({ value: new Frac(c + b, a + dd), trap: 'alg-move-term-sign', why: `moving the constant $${num(b)}$ across with the wrong operation` });
        traps.push({ value: new Frac(c + b, a - dd), trap: 'alg-move-term-sign', why: `moving both terms across with the wrong operations` });
        traps.push({ value: new Frac(c - b, a), trap: 'alg-dropped-term', why: `forgetting the $x$ term on the right` });
        traps.push({ value: new Frac(c, a + dd), trap: 'alg-dropped-term', why: `forgetting to move the constant $${num(b)}$ at all` });
        traps.push({ value: frac(-x0), trap: 'alg-sign-slip', why: `subtracting in the wrong order` });
      } else if (kind === 'distribute') {
        const a = rng.int(2, 5);
        const b = rng.int(1, 4);
        const c = rng.int(1, 9);
        let e: number;
        do e = rng.int(1, 7);
        while (e === a * b || e === a * b * 2);
        const dd = rng.int(-9, 9);
        const f = a * (b * x0 - c) + dd - e * x0;
        k = [a, b, c, dd, e, f];
        const lhs = `${a}(${lin([[b, 'x'], [-c, '']])})${dd === 0 ? '' : dd > 0 ? ` + ${dd}` : ` - ${-dd}`}`;
        stem = `If $${lhs} = ${lin([[e, 'x'], [f, '']])}$, what is the value of $x$?`;
        const left = lin([[a * b, 'x'], [-a * c + dd, '']]);
        recognize = `A number multiplies a parenthesis, so distribute first, then collect.`;
        steps = `The ${a} multiplies both terms inside: $${a}(${lin([[b, 'x'], [-c, '']])}) = ${lin([[a * b, 'x'], [-a * c, '']])}$, so the left side is $${left}$. Then $${left} = ${lin([[e, 'x'], [f, '']])}$ gives $${lin([[a * b - e, 'x']])} = ${num(f + a * c - dd)}$, so $x = ${num(x0)}$.

Check: both sides equal $${num(e * x0 + f)}$.`;
        rule = `A factor outside parentheses multiplies every term inside.`;
        traps.push({ value: new Frac(f + c - dd, a * b - e), trap: 'alg-distribute-partial', why: `multiplying only the first term, $${a}(${lin([[b, 'x'], [-c, '']])}) \\to ${lin([[a * b, 'x'], [-c, '']])}$` });
        traps.push({ value: new Frac(f - dd + a * c, a * b + e), trap: 'alg-move-term-sign', why: `moving $${lin([[e, 'x']])}$ across with the wrong operation` });
        traps.push({ value: new Frac(f + a * c + dd, a * b - e), trap: 'alg-move-term-sign', why: `moving the constant $${num(dd)}$ across with the wrong operation` });
        if (dd !== 0) traps.push({ value: new Frac(f + a * c, a * b - e), trap: 'alg-dropped-term', why: `dropping the ${dd > 0 ? '+' : '-'} ${Math.abs(dd)} after the parentheses` });
        traps.push({ value: new Frac(f - a * c - dd, a * b - e), trap: 'alg-move-term-sign', why: `moving the product $${num(a * c)}$ across with the wrong operation` });
        traps.push({ value: frac(-x0), trap: 'alg-sign-slip', why: `subtracting in the wrong order` });
      } else {
        let m: number;
        let n: number;
        do [m, n] = rng.sample([2, 3, 4, 5, 6], 2);
        while (lcm(m, n) > 20);
        // choose p, q so that x0 + p is a multiple of m and x0 - q a multiple of n
        const p = (() => {
          const opts = [];
          for (let t = -9; t <= 9; t++) if (t !== 0 && (x0 + t) % m === 0) opts.push(t);
          return rng.pick(opts);
        })();
        const q = (() => {
          const opts = [];
          for (let t = -9; t <= 9; t++) if (t !== 0 && (x0 - t) % n === 0) opts.push(t);
          return rng.pick(opts);
        })();
        const r = (x0 + p) / m - (x0 - q) / n;
        if (r === 0) continue; // the right side must need scaling too
        k = [p, m, q, n, r];
        const L = lcm(m, n);
        const A = L / m;
        const B = L / n;
        stem = `If $\\dfrac{${lin([[1, 'x'], [p, '']])}}{${m}} - \\dfrac{${lin([[1, 'x'], [-q, '']])}}{${n}} = ${num(r)}$, what is the value of $x$?`;
        recognize = `Fractions with different denominators: multiply the whole equation by their least common denominator to clear them.`;
        steps = `Multiply both sides by ${L}, so every term is scaled, including $${num(r)}$: $${A === 1 ? '' : A}(${lin([[1, 'x'], [p, '']])}) - ${B === 1 ? '' : B}(${lin([[1, 'x'], [-q, '']])}) = ${num(r * L)}$. The minus sign applies to both terms of the second parenthesis, giving $${lin([[A - B, 'x'], [A * p + B * q, '']])} = ${num(r * L)}$. So ${A - B === 1 ? '' : `$${lin([[A - B, 'x']])} = ${num(r * L - A * p - B * q)}$ and `}$x = ${num(x0)}$.`;
        rule = `Multiply every term by the same number, then watch the minus sign in front of a parenthesis.`;
        traps.push({ value: new Frac(r - A * p - B * q, A - B), trap: 'alg-lcd-partial', why: `leaving the right side $${num(r)}$ unmultiplied` });
        traps.push({ value: new Frac(r * L - A * p + B * q, A - B), trap: 'alg-distribute-minus', why: `letting the minus sign act on $x$ only, not on $${num(-q)}$` });
        traps.push({ value: new Frac(r * L - p - q, A - B), trap: 'alg-distribute-partial', why: `scaling only the $x$ in each numerator` });
        traps.push({ value: new Frac(r * L - A * p + B * q, A + B), trap: 'alg-distribute-minus', why: `treating the subtraction as an addition` });
        traps.push({ value: new Frac(r * L - A * p - B * q, A), trap: 'alg-dropped-term', why: `forgetting the $x$ of the second fraction` });
        traps.push({ value: frac(-x0), trap: 'alg-sign-slip', why: `losing the sign of the answer` });
      }
      const res = trapChoices(rng, x0, traps, (v) => `$${v.toTex()}$`);
      if (!res) continue;
      const t = res.kept[0];
      const [lv, rv] = sides(kind, k!, t.value);
      const explanation = `${recognize}

${steps}

Trap: $x = ${t.value.toTex()}$ comes from ${t.why}. Test it: the left side is $${lv.toTex()}$ but the right side is $${rv.toTex()}$, so it is not a solution.

${rule}`;
      return {
        params: { kind, k: k!, values: res.values.map((v) => [v.n, v.d] as [number, number]) },
        q: { format: 'mcs', stem, choices: res.choices, answer: res.answer, explanation },
      };
    }
  },
  check(q, { kind, k, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    const sols = values.flatMap(([n, dd], i) => (residual(kind, k, new Frac(n, dd)).n === 0 ? [i] : []));
    if (values.some(([n, dd], i) => q.choices[i].text !== `$${new Frac(n, dd).toTex()}$`)) return 'choice text mismatch';
    if (sols.length !== 1) return `${sols.length} solutions among the choices`;
    return sols[0] === q.answer ? null : `expected ${sols[0]}`;
  },
};

/* ================================================================== 2. Solve an equation with fractions, compare (QC) */

interface FracQCParams {
  kind: 'sum' | 'proportion';
  k: number[];
  /** Quantity B is this number, or (when y is set) the integer y between y[0] and y[1] inclusive. */
  B: number;
  y: [number, number] | null;
}

const fractionQC: Template<FracQCParams> = {
  id: 'alg.linear-equations.fraction-qc',
  skill: 'alg.linear-equations',
  format: 'qc',
  style: 'solve an equation with fractions, then compare',
  generate(rng, d) {
    const kind: FracQCParams['kind'] = rng.pick(d === 1 ? ['sum', 'sum', 'proportion'] : ['sum', 'proportion']);
    let k: number[];
    let x0: number;
    let info: string;
    let steps: string;
    let trapVal: number | null = null;
    let trapId = '';
    let trapRatios: Frac[] | null = null;
    if (kind === 'sum') {
      let a: number;
      let b: number;
      do [a, b] = rng.sample(d === 1 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 8], 2);
      while (lcm(a, b) > 24);
      const L = lcm(a, b);
      x0 = L * rng.int(1, d === 3 ? 6 : 4) * (d === 3 && rng.chance(0.3) ? -1 : 1);
      const sgnB = d === 3 && rng.chance(0.5) ? -1 : 1;
      const c = x0 / a + (sgnB * x0) / b;
      if (c === 0 || Math.abs(x0) <= 1) return fractionQC.generate(rng, d);
      k = [a, sgnB * b, c];
      info = `$\\dfrac{x}{${a}} ${sgnB > 0 ? '+' : '-'} \\dfrac{x}{${b}} = ${num(c)}$`;
      const coefNum = L / a + (sgnB * L) / b;
      steps = `Multiply both sides by ${L}, the least common denominator, so no term is left unscaled: $${lin([[L / a, 'x']])} ${sgnB > 0 ? '+' : '-'} ${lin([[L / b, 'x']])} = ${num(c * L)}$${coefNum === 1 ? '' : `, that is $${lin([[coefNum, 'x']])} = ${num(c * L)}$`}, so $x = ${num(x0)}$.

Check: $\\frac{${num(x0)}}{${a}} ${sgnB > 0 ? '+' : '-'} \\frac{${num(x0)}}{${b}} = ${num(x0 / a)} ${sgnB > 0 ? '+' : '-'} ${paren(x0 / b)} = ${num(c)}$.`;
      if (sgnB > 0) {
        trapVal = c * (a + b);
        trapId = 'alg-fraction-add-denominators';
      }
    } else {
      let a: number;
      let b: number;
      do [a, b] = rng.sample([2, 3, 4, 5, 6, 7], 2);
      while (gcd(a, b) !== 1);
      x0 = rng.int(-10, 15);
      const opts: number[] = [];
      for (let t = -9; t <= 9; t++) if (t !== 0 && (x0 + t) % a === 0 && (x0 + t) / a !== 0) opts.push(t);
      const p = rng.pick(opts);
      const ratio = (x0 + p) / a; // = (x0 - q)/b
      const q = x0 - b * ratio;
      if (q === 0 || Math.abs(x0) <= 1) return fractionQC.generate(rng, d);
      k = [p, a, q, b];
      info = `$\\dfrac{${lin([[1, 'x'], [p, '']])}}{${a}} = \\dfrac{${lin([[1, 'x'], [-q, '']])}}{${b}}$`;
      steps = `Cross-multiply, each numerator times the OTHER denominator: $${b}(${lin([[1, 'x'], [p, '']])}) = ${a}(${lin([[1, 'x'], [-q, '']])})$, that is, $${lin([[b, 'x'], [b * p, '']])} = ${lin([[a, 'x'], [-a * q, '']])}$. So ${b - a === 1 ? '' : `$${lin([[b - a, 'x']])} = ${num(-a * q - b * p)}$ and `}$x = ${num(x0)}$.

Check: both fractions equal $${num(ratio)}$.`;
      // multiplying each numerator by its own denominator
      if (a !== b) {
        const wrong = new Frac(-b * q - a * p, a - b); // a(x + p) = b(x - q)
        if (wrong.isInt()) {
          trapVal = wrong.n;
          trapId = 'alg-cross-multiply-wrong';
          trapRatios = [new Frac(wrong.n + p, a), new Frac(wrong.n - q, b)];
        }
      }
    }
    const rel = rng.pick(['C', 'A', 'B', 'T', 'D'] as const);
    let B = x0;
    let y: [number, number] | null = null;
    if (rel === 'D') {
      y = [x0 - rng.int(1, 4), x0 + rng.int(1, 4)];
      B = x0;
    } else if (rel === 'T' && trapVal !== null && trapVal !== x0) B = trapVal;
    else if (rel === 'C') B = x0;
    else B = x0 + (rel === 'A' || (rel === 'T' && rng.chance(0.5)) ? -1 : 1) * rng.int(1, 3);
    let answer: QCChoice;
    if (y) {
      const rels = new Set<QCChoice>();
      for (let v = y[0]; v <= y[1]; v++) rels.add(qcCompare(x0, v));
      answer = rels.size > 1 ? 'D' : [...rels][0];
    } else answer = qcCompare(x0, B);
    const traps: QCQuestion['traps'] = {};
    if (!y && trapVal !== null) {
      const ta = qcCompare(trapVal, B);
      if (ta !== answer) traps[ta] = trapId;
    }
    if (answer === 'D') for (const l of ['A', 'B', 'C'] as const) traps[l] = 'tested-one-value';
    else traps.D = 'alg-qc-variable-d';
    const trapNote =
      !y && trapId === 'alg-fraction-add-denominators'
        ? `\n\nTrap: adding denominators, $\\frac{x}{${k[0]}} + \\frac{x}{${k[1]}} = \\frac{x}{${k[0] + k[1]}}$, would give $x = ${num(trapVal!)}$. Test $x = ${k[0] * k[1]}$: the left side is $${k[1]} + ${k[0]} = ${k[0] + k[1]}$, but $\\frac{${k[0] * k[1]}}{${k[0] + k[1]}}$ is not that. Fractions add over a common denominator.`
        : !y && trapId === 'alg-cross-multiply-wrong'
          ? `\n\nTrap: multiplying each numerator by its own denominator would give $x = ${num(trapVal!)}$, which is not the solution: the two fractions are $${num(trapRatios![0])}$ and $${num(trapRatios![1])}$ there, not equal.`
          : '';
    let verdict: string;
    if (y) {
      const lo = y[0];
      const hi = y[1];
      verdict = answer === 'D'
        ? `The equation fixes $x = ${num(x0)}$, but $y$ is only known to be an integer from $${num(lo)}$ to $${num(hi)}$. For $y = ${num(lo)}$ Quantity A is greater; for $y = ${num(hi)}$ Quantity B is greater. Two allowed values disagree, so the relationship cannot be determined. (D)`
        : `The equation fixes $x = ${num(x0)}$. ${qcEnd(answer)}`;
    } else
      verdict = `The equation has exactly one solution, so $x$ is fixed: compare $${num(x0)}$ with $${num(B)}$. ${qcEnd(answer)}`;
    return {
      params: { kind, k: k!, B, y },
      q: {
        format: 'qc',
        info: y ? `${info}\n\n$y$ is an integer with $${num(y[0])} \\le y \\le ${num(y[1])}$.` : info,
        quantityA: '$x$',
        quantityB: y ? '$y$' : `$${num(B)}$`,
        answer,
        traps,
        explanation: `One equation with one unknown fixes $x$, so solve it before comparing.

${steps}

${verdict}${trapNote}`,
      },
    };
  },
  check(q, { kind, k, B, y }) {
    if (q.format !== 'qc') return 'wrong format';
    const f =
      kind === 'sum'
        ? (x: number) => x / k[0] + x / k[1] - k[2]
        : (x: number) => (x + k[0]) / k[1] - (x - k[2]) / k[3];
    // f is linear: its root from two evaluations.
    const root = -f(0) / (f(1) - f(0));
    const samples: [number, number][] = [];
    if (y) for (let v = y[0]; v <= y[1]; v++) samples.push([root, v]);
    else samples.push([root, B]);
    const expected = qcSamples(samples, 1e-9);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 3. Shortcut to a target expression (NE) */

interface ShortParams {
  kind: 'scale' | 'two-var' | 'collect';
  k: number[];
}

const shortcutNE: Template<ShortParams> = {
  id: 'alg.linear-equations.shortcut-ne',
  skill: 'alg.linear-equations',
  format: 'ne',
  style: 'value of an expression without solving for the variable',
  generate(rng, d) {
    const kind: ShortParams['kind'] = rng.pick(d === 1 ? ['scale', 'scale', 'collect'] : ['scale', 'two-var', 'collect']);
    let stem: string;
    let explanation: string;
    let answer: number;
    let k: number[];
    const traps: { value: Frac; trap: string }[] = [];
    if (kind === 'scale') {
      const a = rng.int(2, 7);
      let b: number;
      do b = rng.int(-9, 9);
      while (b === 0);
      let c: number;
      do c = rng.int(-10, 25);
      while ((c - b) % a === 0 && rng.chance(0.75));
      const m = rng.pick(d === 1 ? [2, 3] : [2, 3, -1, -2, 4]);
      const e = rng.int(-9, 9);
      // target: m*a x + e
      answer = m * (c - b) + e;
      k = [a, b, c, m, e];
      const target = m < 0 ? lin([[e, ''], [m * a, 'x']]) : lin([[m * a, 'x'], [e, '']]);
      stem = `If $${lin([[a, 'x'], [b, '']])} = ${num(c)}$, what is the value of $${target}$?`;
      explanation = `No need to find $x$${(c - b) % a !== 0 ? ` (it is the fraction $${new Frac(c - b, a).toTex()}$)` : ''}. From the equation, $${a}x = ${num(c)} ${b > 0 ? '-' : '+'} ${Math.abs(b)} = ${num(c - b)}$.

Then $${lin([[m * a, 'x']])} = ${times(m, num(c - b))} = ${num(m * (c - b))}$${e === 0 ? '' : `, so $${target} = ${num(m * (c - b))} ${e < 0 ? '-' : '+'} ${Math.abs(e)} = ${num(answer)}$`}.`;
      const wrong = m * c + e;
      if (wrong !== answer) traps.push({ value: frac(wrong), trap: 'alg-shortcut-constant' });
    } else if (kind === 'two-var') {
      const [v1, v2] = rng.pick([['a', 'b'], ['x', 'y'], ['p', 'q'], ['m', 'n']]);
      const a = rng.int(1, 5);
      let b = rng.int(-6, 6);
      if (b === 0 || b === a) b = a + 1;
      const c = rng.int(-12, 20);
      const m = rng.pick([2, 3, -2, 4]);
      const e = rng.int(-9, 9);
      answer = m * c + e;
      k = [a, b, c, m, e];
      const target = lin([[m * a, v1], [m * b, v2], [e, '']]);
      stem = `If $${lin([[a, v1], [b, v2]])} = ${num(c)}$, what is the value of $${target}$?`;
      explanation = `One equation cannot give both $${v1}$ and $${v2}$, so look at the target: $${lin([[m * a, v1], [m * b, v2]])} = ${times(m, lin([[a, v1], [b, v2]]))} = ${times(m, num(c))} = ${num(m * c)}$.

${e === 0 ? '' : `So $${target} = ${num(m * c)} ${e < 0 ? '-' : '+'} ${Math.abs(e)} = ${num(answer)}$.`}`;
      if (e !== 0) traps.push({ value: frac(m * (c + e)), trap: 'alg-shortcut-constant' });
    } else {
      const a = rng.int(4, 9);
      const dd = rng.int(1, a - 2);
      let b = rng.int(-9, 9);
      if (b === 0) b = 4;
      let e = rng.int(-9, 15);
      if (e === b) e = b + 3;
      const m = rng.pick([1, 2, 3]);
      const f = rng.int(-6, 6);
      // (a - dd) x = e - b ; target m(a - dd) x + f
      answer = m * (e - b) + f;
      k = [a, b, dd, e, m, f];
      const target = lin([[m * (a - dd), 'x'], [f, '']]);
      stem = `If $${lin([[a, 'x'], [b, '']])} = ${lin([[dd, 'x'], [e, '']])}$, what is the value of $${target}$?`;
      explanation = `Collect the $x$ terms: subtract $${lin([[dd, 'x']])}$ from both sides and ${b > 0 ? `subtract ${b} from` : `add ${-b} to`} both sides to get $${a - dd}x = ${num(e - b)}$.

${m === 1 ? '' : `Multiply by ${m}: $${m * (a - dd)}x = ${num(m * (e - b))}$. `}${f === 0 ? `So the value is $${num(answer)}$.` : `Then $${target} = ${num(m * (e - b))} ${f < 0 ? '-' : '+'} ${Math.abs(f)} = ${num(answer)}$.`}`;
      const wrong = m * (e + b) + f;
      if (wrong !== answer) traps.push({ value: frac(wrong), trap: 'alg-move-term-sign' });
    }
    return { params: { kind, k: k! }, q: { format: 'ne', stem, answer: frac(answer), traps, explanation } };
  },
  check(q, { kind, k }, rng) {
    if (q.format !== 'ne') return 'wrong format';
    let value: number;
    if (kind === 'scale') {
      const [a, b, c, m, e] = k;
      const x = (c - b) / a;
      value = m * a * x + e;
    } else if (kind === 'two-var') {
      const [a, b, c, m, e] = k;
      // any solution of the equation gives the same value
      const vals = [0, 1, 2].map(() => {
        const s = rng.next() * 20 - 10;
        const t = (c - a * s) / b;
        return m * a * s + m * b * t + e;
      });
      if (!vals.every((v) => close(v, vals[0], 1e-9))) return 'value depends on the solution';
      value = vals[0];
    } else {
      const [a, b, dd, e, m, f] = k;
      const x = (e - b) / (a - dd);
      value = m * (a - dd) * x + f;
    }
    return close(q.answer.toNumber(), value, 1e-9) ? null : `expected ${value}`;
  },
};

/* ================================================================== 4. Literal equations and relations (MCS) */

interface LiteralParams {
  kind: 'relation' | 'solve-for' | 'harmonic';
  k: number[];
  /** relation: [coef r, coef s] per choice. Otherwise expression trees. */
  rels: [number, number][];
  exprs: Ex[];
}

const relTex = ([cr, cs]: [number, number]) => `${lin([[cr, 'r']])} = ${lin([[cs, 's']])}`;
const normRel = ([cr, cs]: [number, number]): string => {
  const g = gcd(cr, cs) || 1;
  const sg = cr < 0 ? -1 : 1;
  return `${(sg * cr) / g},${(sg * cs) / g}`;
};

const literalMCS: Template<LiteralParams> = {
  id: 'alg.linear-equations.literal-mcs',
  skill: 'alg.linear-equations',
  format: 'mcs',
  style: 'literal equations and the relation an equation forces',
  generate(rng, d) {
    const kind: LiteralParams['kind'] = rng.pick(d === 1 ? ['solve-for', 'solve-for', 'relation'] : d === 2 ? ['relation', 'solve-for', 'harmonic'] : ['relation', 'relation', 'solve-for', 'harmonic']);
    if (kind === 'relation') {
      let a: number;
      let b: number;
      do [a, b] = rng.sample([1, 2, 3, 4, 5], 2);
      while (gcd(a, b) !== 1);
      const c = d === 3 ? a + b : (() => {
        let t: number;
        do t = rng.int(2, 9);
        while (t === a || t === b);
        return t;
      })();
      // (r + s)/c = r/a + s/b  <=>  b(a - c) r = a(c - b) s
      let cr = b * (a - c);
      let cs = a * (c - b);
      const g = gcd(cr, cs);
      cr /= g;
      cs /= g;
      if (cr < 0) {
        cr = -cr;
        cs = -cs;
      }
      const correct: [number, number] = [cr, cs];
      const pool: { v: [number, number]; trap?: string }[] = [
        { v: [cr, -cs], trap: 'alg-sign-slip' },
        { v: [Math.abs(cs), Math.sign(cs) * cr], trap: 'alg-swapped-coefficients' },
        { v: [1, 1] },
        { v: [b, a] },
        { v: [b, -a] },
        { v: [b * b, a * a] },
        { v: [b * b, -a * a] },
        { v: [a, b] },
        { v: [cr + 1, cs] },
      ];
      const seen = new Set([normRel(correct)]);
      const wrong: { v: [number, number]; trap?: string }[] = [];
      for (const w of d === 3 ? pool : [pool[0], pool[1], ...rng.shuffle(pool.slice(2))]) {
        if (wrong.length === 4) break;
        if (w.v[0] === 0 || w.v[1] === 0 || seen.has(normRel(w.v))) continue;
        seen.add(normRel(w.v));
        wrong.push(w);
      }
      const ordered = [{ v: correct, ok: true as const }, ...wrong.map((w) => ({ ...w, ok: false as const }))].sort(
        (x, y) => Math.abs(x.v[0]) - Math.abs(y.v[0]) || Math.abs(x.v[1]) - Math.abs(y.v[1]) || y.v[1] - x.v[1],
      );
      const choices = ordered.map((o) => ({ text: `$${relTex(o.v)}$`, ...('trap' in o && o.trap ? { trap: o.trap } : {}) }));
      const answer = ordered.findIndex((o) => o.ok);
      const lhsCoef = b * (a - c);
      const rhsCoef = a * (c - b);
      return {
        params: { kind, k: [a, b, c], rels: ordered.map((o) => o.v), exprs: [] },
        q: {
          format: 'mcs',
          stem: `If $\\dfrac{r + s}{${c}} = \\dfrac{r}{${a}} + \\dfrac{s}{${b}}$, which of the following must be true?`,
          choices,
          answer,
          explanation: `Multiply both sides by $${c * a * b}$ (the product of the denominators): $${a * b}(r + s) = ${c * b}r + ${c * a}s$.

Collect the $r$ terms on one side and the $s$ terms on the other: $${lin([[lhsCoef, 'r']])} = ${lin([[rhsCoef, 's']])}$${relTex([lhsCoef, rhsCoef]) !== relTex(correct) ? `, or $${relTex(correct)}$` : ''}.

A sign slip while moving terms gives $${relTex([cr, -cs])}$; check your answer with numbers, for example $r = ${Math.abs(cs)}$, $s = ${cs < 0 ? -cr : cr}$.`,
        },
      };
    }
    if (kind === 'solve-for') {
      const form = rng.pick(d === 1 ? ['affine'] : ['affine', 'mobius']);
      if (form === 'affine') {
        // y = (p x + q) / r  ->  x = (r y - q) / p
        let p: number;
        let q: number;
        let r: number;
        do {
          p = rng.int(2, 7);
          q = intExcept(rng, -9, 9, 0);
          r = rng.int(2, 6);
        } while (gcd(gcd(p, q), r) !== 1 || gcd(gcd(r, q), p) !== 1);
        const yv = V('y');
        const correct = div(lx(r, -q, 'y'), N(p));
        const wrongs: { e: Ex; trap?: string }[] = [
          { e: div(lx(r, q, 'y'), N(p)), trap: 'alg-move-term-sign' },
          { e: div(mul(N(r), add(yv, N(-q))), N(p)), trap: 'alg-undo-order' },
          { e: div(lx(p, -q, 'y'), N(r)), trap: 'alg-swapped-coefficients' },
          { e: div(lx(1, -q, 'y'), N(p * r)) },
          { e: lx(new Frac(r, p), -q, 'y') },
        ];
        return finishSolveFor(rng, 'solve-for', [p, q, r, 0], correct, wrongs, `If $y = \\dfrac{${lin([[p, 'x'], [q, '']])}}{${r}}$, which of the following expresses $x$ in terms of $y$?`,
          `Undo the operations in reverse order. Multiply both sides by ${r}: $${r}y = ${lin([[p, 'x'], [q, '']])}$. Subtract $${num(q)}$: $${lin([[r, 'y'], [-q, '']])} = ${p}x$. Divide by ${p}: $x = ${texEx(correct)}$.

Check with a number: $x = 1$ gives $y = ${new Frac(p + q, r).toTex()}$, and the formula returns 1.`);
      }
      // y = (x + p)/(x - q)  ->  x = (q y + p)/(y - 1)
      let p = rng.int(1, 9);
      let q = rng.int(1, 9);
      if (p === q) q = p + 1;
      if (rng.chance(0.3) && p !== q) p = -p;
      const correct = div(lx(q, p, 'y'), lx(1, -1, 'y'));
      const wrongs: { e: Ex; trap?: string }[] = [
        { e: div(lx(q, -p, 'y'), lx(1, -1, 'y')), trap: 'alg-move-term-sign' },
        { e: div(lx(q, p, 'y'), lx(1, 1, 'y')), trap: 'alg-move-term-sign' },
        { e: div(N(p + q), lx(1, -1, 'y')) },
        { e: div(lx(q, p, 'y'), add(N(1), mul(N(-1), V('y')))), trap: 'alg-sign-slip' },
        { e: lx(q, p, 'y') },
      ];
      return finishSolveFor(rng, 'solve-for', [p, q, 0, 1], correct, wrongs, `If $y = \\dfrac{${lin([[1, 'x'], [p, '']])}}{${lin([[1, 'x'], [-q, '']])}}$ and $x \\ne ${q}$, which of the following expresses $x$ in terms of $y$?`,
        `Multiply both sides by $${lin([[1, 'x'], [-q, '']])}$: $${lin([[1, 'xy'], [-q, 'y']])} = ${lin([[1, 'x'], [p, '']])}$. Put the $x$ terms on the left: $xy - x = ${lin([[q, 'y'], [p, '']])}$, so $x(y - 1) = ${lin([[q, 'y'], [p, '']])}$ and $x = ${texEx(correct)}$.

Watch the signs when you move $${q}y$ and $x$ across the equals sign.`);
    }
    // harmonic: 1/a + k/b = 1/c  -> c = ab / (b + k a)
    const kk = rng.pick(d === 2 ? [1, 2] : [1, 2, 3]);
    const correct = div(mul(V('a'), V('b')), kk === 1 ? add(V('a'), V('b')) : add(V('b'), mul(N(kk), V('a'))));
    const wrongs: { e: Ex; trap?: string }[] = [
      { e: kk === 1 ? add(V('a'), V('b')) : add(V('a'), div(V('b'), N(kk))), trap: 'alg-reciprocal-sum' },
      { e: div(kk === 1 ? add(V('a'), V('b')) : add(V('b'), mul(N(kk), V('a'))), mul(V('a'), V('b'))), trap: 'alg-forgot-reciprocal' },
      { e: div(mul(V('a'), V('b')), kk === 1 ? add(V('a'), mul(N(-1), V('b'))) : add(V('a'), mul(N(kk), V('b')))) },
      { e: div(mul(N(kk), V('a'), V('b')), add(V('a'), V('b'))) },
      { e: div(mul(V('a'), V('b')), N(kk + 1)) },
    ];
    const kTerm = kk === 1 ? '\\dfrac{1}{b}' : `\\dfrac{${kk}}{b}`;
    return finishSolveFor(rng, 'harmonic', [kk, 0, 0, 2], correct, wrongs, `If $a$, $b$ and $c$ are positive and $\\dfrac{1}{a} + ${kTerm} = \\dfrac{1}{c}$, which of the following expresses $c$ in terms of $a$ and $b$?`,
      `Add the fractions on the left: $\\dfrac{1}{a} + ${kTerm} = \\dfrac{${kk === 1 ? 'b + a' : `b + ${kk}a`}}{ab}$. This equals $\\dfrac{1}{c}$, so $c$ is the reciprocal: $c = ${texEx(correct)}$.

$\\frac{1}{c}$ is not $c$: stopping before taking the reciprocal gives the upside-down answer, and $\\frac{1}{a} + \\frac{1}{b} \\ne \\frac{1}{a + b}$.`);
  },
  check(q, { kind, k, rels, exprs }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    const matches: number[] = [];
    if (kind === 'relation') {
      const [a, b, c] = k;
      rels.forEach((rel, i) => {
        if (q.choices[i].text !== `$${relTex(rel)}$`) matches.push(-100);
        let ok = true;
        for (const r of [1.7, -3.2, 5]) {
          // solve (r + s)/c - r/a - s/b = 0 for s (linear in s)
          const f = (s: number) => (r + s) / c - r / a - s / b;
          const s = -f(0) / (f(1) - f(0));
          if (Math.abs(rel[0] * r - rel[1] * s) > 1e-9 * Math.max(1, Math.abs(r), Math.abs(s))) ok = false;
        }
        if (ok) matches.push(i);
      });
    } else {
      exprs.forEach((e, i) => {
        if (q.choices[i].text !== `$${texEx(e)}$`) matches.push(-100);
        let ok = true;
        for (let j = 0; j < 6; j++) {
          if (kind === 'solve-for') {
            const [p, qq, r, form] = k;
            const x = rng.next() * 20 - 10;
            const y = form === 0 ? (p * x + qq) / r : (x + p) / (x - qq);
            if (!close(evalEx(e, { y }), x, 1e-8)) ok = false;
          } else {
            const [kk] = k;
            const a = 0.5 + rng.next() * 9;
            const b = 0.5 + rng.next() * 9;
            const c = 1 / (1 / a + kk / b);
            if (!close(evalEx(e, { a, b }), c, 1e-9)) ok = false;
          }
        }
        if (ok) matches.push(i);
      });
    }
    if (matches.includes(-100)) return 'choice text mismatch';
    if (matches.length !== 1) return `${matches.length} matching choices`;
    return matches[0] === q.answer ? null : `expected ${matches[0]}`;
  },
};

function finishSolveFor(
  rng: Parameters<Template['generate']>[0],
  kind: LiteralParams['kind'],
  k: number[],
  correct: Ex,
  wrongs: { e: Ex; trap?: string }[],
  stem: string,
  explanation: string,
) {
  const seen = new Set([texEx(correct)]);
  const kept = wrongs.filter((w) => {
    const t = texEx(w.e);
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
  const { choices, answer } = textChoices(
    rng,
    `$${texEx(correct)}$`,
    kept.slice(0, 4).map((w) => ({ text: `$${texEx(w.e)}$`, ...(w.trap ? { trap: w.trap } : {}) })),
  );
  const all = [correct, ...kept.map((w) => w.e)];
  const exprs = choices.map((c) => all.find((e) => `$${texEx(e)}$` === c.text)!);
  return {
    params: { kind, k, rels: [] as [number, number][], exprs },
    q: { format: 'mcs' as const, stem, choices, answer, explanation },
  };
}

export const linearTemplates = [solveLinearMCS, fractionQC, shortcutNE, literalMCS];
