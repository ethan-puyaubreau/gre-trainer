import { qcCompare, textChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd, lcm } from '../../../engine/math';
import { lin, num, paren } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { N, V, add, close, intExcept, times, div, evalEx, lx, mul, qcEnd, qcSamples, texEx, trapChoices, evalFrac, type Ex } from './util';

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
      const wrong = m * c + e;
      explanation = `The target contains the same block $${a}x$ as the equation, so isolate that block instead of solving for $x$${(c - b) % a !== 0 ? ` (it is the fraction $${new Frac(c - b, a).toTex()}$)` : ''}. From the equation, $${a}x = ${num(c)} ${b > 0 ? '-' : '+'} ${Math.abs(b)} = ${num(c - b)}$.

Then $${lin([[m * a, 'x']])} = ${times(m, num(c - b))} = ${num(m * (c - b))}$${e === 0 ? '' : `, so $${target} = ${num(m * (c - b))} ${e < 0 ? '-' : '+'} ${Math.abs(e)} = ${num(answer)}$`}.

Check: substituting $x = ${new Frac(c - b, a).toTex()}$ into the target gives the same value, $${num(answer)}$.

Trap: scaling the right side as it stands, $${times(m, num(c))}${e === 0 ? '' : ` ${e < 0 ? '-' : '+'} ${Math.abs(e)}`} = ${num(wrong)}$, forgets that the constant $${num(b)}$ on the left must be moved first. Rule: isolate the block the target contains, then scale it.`;
      traps.push({ value: frac(wrong), trap: 'alg-shortcut-constant' });
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
      explanation = `One equation cannot give both $${v1}$ and $${v2}$, so look at the target instead: its variable part is a multiple of the left side. $${lin([[m * a, v1], [m * b, v2]])} = ${times(m, lin([[a, v1], [b, v2]]))} = ${times(m, num(c))} = ${num(m * c)}$.

${e === 0 ? `So the value is $${num(answer)}$.` : `So $${target} = ${num(m * c)} ${e < 0 ? '-' : '+'} ${Math.abs(e)} = ${num(answer)}$.`}

Check: every pair $(${v1}, ${v2})$ that satisfies the equation gives this value, because the target depends only on the left side.

Trap: ${e === 0 ? 'trying to solve for both letters is impossible with one equation, and unnecessary' : `$${times(m, `(${num(c)} ${e < 0 ? '-' : '+'} ${Math.abs(e)})`)} = ${num(m * (c + e))}$ scales the constant $${num(e)}$ as well, but only the letters are multiplied`}. Rule: if the target is a multiple of the left side, scale the whole equation.`;
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
      const wrong = m * (e + b) + f;
      explanation = `The target contains the combined $x$ term, so collect the $x$ terms and the constants on opposite sides: subtract $${lin([[dd, 'x']])}$ from both sides and ${b > 0 ? `subtract ${b} from` : `add ${-b} to`} both sides to get $${a - dd}x = ${num(e - b)}$.

${m === 1 ? '' : `Multiply by ${m}: $${m * (a - dd)}x = ${num(m * (e - b))}$. `}${f === 0 ? `So the value is $${num(answer)}$.` : `Then $${target} = ${num(m * (e - b))} ${f < 0 ? '-' : '+'} ${Math.abs(f)} = ${num(answer)}$.`}

Check: the target's $x$ coefficient, $${m * (a - dd)}$, is ${m === 1 ? 'exactly' : `$${m}$ times`} the collected coefficient $${a - dd}$.

Trap: carrying $${num(b)}$ across without changing its sign gives $${num(e + b)}$ instead of $${num(e - b)}$ on the right, and the final value $${num(wrong)}$. Rule: moving a term to the other side changes its sign.`;
      traps.push({ value: frac(wrong), trap: 'alg-move-term-sign' });
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
  /** relation: [a, b, c]. solve-for: [p, q, r, form]. harmonic: [k, 0, 0, 2]. */
  k: number[];
  /** relation: [coef r, coef s] per choice. Otherwise expression trees. */
  rels: [number, number][];
  exprs: Ex[];
  /** Names of the variables of the relation, or of a, b, c in the harmonic form. */
  vars: string[];
}

const relTex = ([cr, cs]: [number, number], vr = 'r', vs = 's') => `${lin([[cr, vr]])} = ${lin([[cs, vs]])}`;
const normRel = ([cr, cs]: [number, number]): string => {
  const g = gcd(cr, cs) || 1;
  const sg = cr < 0 ? -1 : 1;
  return `${(sg * cr) / g},${(sg * cs) / g}`;
};

/** First x of the list where the formula e (in the variable v) does not give back x; y is the value fed to it. */
function probe(yOf: (x: Frac) => Frac | null, e: Ex, v: string, xs: number[]): { x: Frac; y: Frac; got: Frac } | null {
  for (const xn of xs) {
    const x = new Frac(xn);
    const y = yOf(x);
    if (!y) continue;
    try {
      const got = evalFrac(e, { [v]: y });
      if (!got.eq(x)) return { x, y, got };
    } catch {
      /* zero denominator: try another x */
    }
  }
  return null;
}

const literalMCS: Template<LiteralParams> = {
  id: 'alg.linear-equations.literal-mcs',
  skill: 'alg.linear-equations',
  format: 'mcs',
  style: 'literal equations and the relation an equation forces',
  generate(rng, d) {
    for (;;) {
      const kind: LiteralParams['kind'] = rng.pick(d === 1 ? ['solve-for', 'solve-for', 'relation'] : d === 2 ? ['relation', 'solve-for', 'harmonic'] : ['relation', 'relation', 'solve-for', 'harmonic']);
      if (kind === 'relation') {
        const [vr, vs] = rng.pick([['r', 's'], ['m', 'n'], ['u', 'v'], ['p', 'q'], ['x', 'y']]);
        let a: number;
        let b: number;
        do [a, b] = rng.sample([2, 3, 4, 5, 6, 7], 2);
        while (gcd(a, b) !== 1);
        const c =
          d === 3
            ? a + b
            : (() => {
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
        const ab = a * b;
        const bc = b * c;
        const ac = a * c;
        const pool: { v: [number, number]; trap: string; why: string }[] = [
          { v: [cr, -cs], trap: 'alg-sign-slip', why: `a sign error when collecting the terms` },
          { v: [Math.abs(cs), Math.sign(cs) * cr], trap: 'alg-swapped-coefficients', why: `swapping the two coefficients` },
          { v: [ab + bc, ac - ab], trap: 'alg-move-term-sign', why: `moving the $${vr}$ term across with the wrong sign` },
          { v: [ab - bc, ac + ab], trap: 'alg-move-term-sign', why: `moving the $${vs}$ term across with the wrong sign` },
          { v: [1 - bc, ac - 1], trap: 'alg-lcd-partial', why: `multiplying only the two fractions on the right by $${ab}$` },
        ];
        const seen = new Set([normRel(correct)]);
        const wrong: typeof pool = [];
        for (const w of rng.shuffle(pool)) {
          if (w.v[0] === 0 || w.v[1] === 0 || seen.has(normRel(w.v))) continue;
          seen.add(normRel(w.v));
          wrong.push(w);
        }
        if (wrong.length < 4) continue;
        const kept = wrong.slice(0, 4);
        const ordered = [{ v: correct, ok: true as const }, ...kept.map((w) => ({ ...w, ok: false as const }))].sort(
          (x, y) => Math.abs(x.v[0]) - Math.abs(y.v[0]) || Math.abs(x.v[1]) - Math.abs(y.v[1]) || y.v[1] - x.v[1],
        );
        const choices = ordered.map((o) => ({ text: `$${relTex(o.v, vr, vs)}$`, ...('trap' in o ? { trap: o.trap } : {}) }));
        const answer = ordered.findIndex((o) => o.ok);
        const lhsCoef = b * (a - c);
        const rhsCoef = ac - ab;
        const both = (x: Frac, y: Frac) => ({ l: x.add(y).div(c), r: x.div(a).add(y.div(b)) });
        const good = both(new Frac(cs), new Frac(cr));
        const w0 = kept[0];
        const bad = both(new Frac(w0.v[1]), new Frac(w0.v[0]));
        const explanation = `To find a relation, clear the denominators, then collect the $${vr}$ terms on one side and the $${vs}$ terms on the other.

Multiply both sides by $${c * a * b}$, the product of the denominators:$${ab}(${vr} + ${vs}) = ${bc}${vr} + ${ac}${vs}$. Subtract $${bc}${vr}$ and $${ab}${vs}$ from both sides: $${relTex([lhsCoef, rhsCoef], vr, vs)}$${relTex([lhsCoef, rhsCoef], vr, vs) !== relTex(correct, vr, vs) ? `, which simplifies to $${relTex(correct, vr, vs)}$` : ''}.

Check: $${vr} = ${num(cs)}$ and $${vs} = ${num(cr)}$ make both sides of the original equal $${good.l.toTex()}$.

Trap: $${relTex(w0.v, vr, vs)}$ comes from ${w0.why}. Take $${vr} = ${num(w0.v[1])}$, $${vs} = ${num(w0.v[0])}$, which satisfy it: the original sides are $${bad.l.toTex()}$ and $${bad.r.toTex()}$, not equal.

Rule: scale every term by the same number, then move terms one at a time.`;
        return {
          params: { kind, k: [a, b, c], rels: ordered.map((o) => o.v), exprs: [], vars: [vr, vs] },
          q: {
            format: 'mcs',
            stem: rng.pick([
              `If $\\dfrac{${vr} + ${vs}}{${c}} = \\dfrac{${vr}}{${a}} + \\dfrac{${vs}}{${b}}$, which of the following must be true?`,
              `If $\\dfrac{${vr}}{${a}} + \\dfrac{${vs}}{${b}} = \\dfrac{${vr} + ${vs}}{${c}}$, which of the following must be true?`,
              `The numbers $${vr}$ and $${vs}$ satisfy $\\dfrac{${vr} + ${vs}}{${c}} = \\dfrac{${vr}}{${a}} + \\dfrac{${vs}}{${b}}$. Which of the following relations do they satisfy?`,
            ]),
            choices,
            answer,
            explanation,
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
          const correct = div(lx(r, -q, 'y'), N(p));
          const wrongs: { e: Ex; trap: string; why: string }[] = rng.shuffle([
            { e: div(lx(r, q, 'y'), N(p)), trap: 'alg-move-term-sign', why: `adding $${num(q)}$ instead of subtracting it when moving it across` },
            { e: div(mul(N(r), add(V('y'), N(-q))), N(p)), trap: 'alg-undo-order', why: `subtracting $${num(q)}$ from $y$ before multiplying by ${r}` },
            { e: div(lx(p, -q, 'y'), N(r)), trap: 'alg-swapped-coefficients', why: `swapping ${p} and ${r}` },
            { e: div(lx(1, -q, 'y'), N(p * r)), trap: 'alg-inverse-operation', why: `dividing by ${r} where it should multiply` },
            { e: lx(new Frac(r, p), -q, 'y'), trap: 'alg-divide-partial', why: `dividing only $${r}y$ by ${p}, not $${num(-q)}$` },
          ]);
          const out = finishSolveFor(
            rng,
            kind,
            [p, q, r, 0],
            ['x', 'y'],
            correct,
            wrongs,
            `If $y = \\dfrac{${lin([[p, 'x'], [q, '']])}}{${r}}$, which of the following expresses $x$ in terms of $y$?`,
            (x) => new Frac(p).mul(x).add(q).div(r),
            `Solving for $x$ means undoing the operations done to it, in reverse order.

Multiply both sides by ${r}: $${r}y = ${lin([[p, 'x'], [q, '']])}$. ${q > 0 ? `Subtract ${q}` : `Add ${-q}`} on both sides: $${lin([[r, 'y'], [-q, '']])} = ${p}x$. Divide both sides by ${p}: $x = ${texEx(correct)}$. The division by ${r} was the last thing done to $x$, so it is the first thing undone.

Check: $x = 1$ gives $y = ${new Frac(p + q, r).toTex()}$, and the formula returns $1$.`,
            'Undo the operations in the reverse order, one at a time.',
          );
          if (out) return out;
          continue;
        }
        // y = (x + p)/(x - q)  ->  x = (q y + p)/(y - 1)
        let p = rng.int(1, 9);
        let q = rng.int(1, 9);
        if (p === q) q = p + 1;
        if (rng.chance(0.3)) p = -p;
        const correct = div(lx(q, p, 'y'), lx(1, -1, 'y'));
        const wrongs: { e: Ex; trap: string; why: string }[] = rng.shuffle([
          { e: div(lx(q, -p, 'y'), lx(1, -1, 'y')), trap: 'alg-move-term-sign', why: `moving $${num(p)}$ across with the wrong sign` },
          { e: div(lx(q, p, 'y'), lx(1, 1, 'y')), trap: 'alg-move-term-sign', why: `moving $x$ across with the wrong sign, which makes $y + 1$` },
          { e: div(lx(q, p, 'y'), add(N(1), mul(N(-1), V('y')))), trap: 'alg-sign-slip', why: `writing the factor as $1 - y$ instead of $y - 1$` },
          { e: div(lx(p, q, 'y'), lx(1, -1, 'y')), trap: 'alg-swapped-coefficients', why: `swapping the numbers $${num(p)}$ and $${num(q)}$` },
          { e: lx(q, p, 'y'), trap: 'alg-factor-skipped', why: `stopping at $x(y - 1) = ${lin([[q, 'y'], [p, '']])}$ without dividing by $y - 1$` },
        ]);
        const out2 = finishSolveFor(
          rng,
          kind,
          [p, q, 0, 1],
          ['x', 'y'],
          correct,
          wrongs,
          `If $y = \\dfrac{${lin([[1, 'x'], [p, '']])}}{${lin([[1, 'x'], [-q, '']])}}$ and $x \\ne ${q}$, which of the following expresses $x$ in terms of $y$?`,
          (x) => (x.eq(q) ? null : x.add(p).div(x.sub(q))),
          `$x$ sits in the numerator and the denominator: clear the denominator, gather the $x$ terms, then factor $x$ out.

Multiply both sides by $${lin([[1, 'x'], [-q, '']])}$: $${lin([[1, 'xy'], [-q, 'y']])} = ${lin([[1, 'x'], [p, '']])}$. Put the $x$ terms on the left: $xy - x = ${lin([[q, 'y'], [p, '']])}$. Factor: $x(y - 1) = ${lin([[q, 'y'], [p, '']])}$. Divide by $y - 1$ (it is not 0, since $y = 1$ would force $${num(p)} = ${num(-q)}$): $x = ${texEx(correct)}$.

Check: $x = 0$ gives $y = ${new Frac(-p, q).toTex()}$, and the formula returns $0$.`,
          'Collect every term that contains the unknown, factor it out, then divide.',
        );
        if (out2) return out2;
        continue;
      }
      // harmonic: 1/a + k/b = 1/c  -> c = ab / (b + k a)
      const kk = rng.pick(d === 2 ? [2] : [2, 3]);
      const [va, vb, vc] = rng.pick([['a', 'b', 'c'], ['p', 'q', 'r'], ['u', 'v', 'w'], ['f', 'g', 'h']]);
      const A = V(va);
      const Bv = V(vb);
      const denom = add(Bv, mul(N(kk), A));
      const correct = div(mul(A, Bv), denom);
      const wrongs: { e: Ex; trap: string; why: string }[] = rng.shuffle([
        { e: add(A, div(Bv, N(kk))), trap: 'alg-reciprocal-sum', why: `flipping each fraction separately, as if $\\frac{1}{${va}} + \\frac{${kk}}{${vb}}$ became $${va} + \\frac{${vb}}{${kk}}$` },
        { e: div(denom, mul(A, Bv)), trap: 'alg-forgot-reciprocal', why: `stopping at $\\frac{1}{${vc}}$ and not flipping` },
        { e: div(mul(A, Bv), add(Bv, mul(N(-kk), A))), trap: 'alg-sign-slip', why: `a sign error in the denominator` },
        { e: div(mul(A, Bv), add(mul(N(kk), Bv), A)), trap: 'alg-swapped-coefficients', why: `putting the ${kk} on $${vb}$ instead of $${va}$` },
        { e: div(mul(A, Bv), add(A, Bv)), trap: 'alg-dropped-term', why: `dropping the ${kk}` },
      ]);
      const kTerm = `\\dfrac{${kk}}{${vb}}`;
      const out3 = finishSolveFor(
        rng,
        'harmonic',
        [kk, 0, 0, 2],
        [va, vb, vc],
        correct,
        wrongs,
        `If $${va}$, $${vb}$ and $${vc}$ are positive and $\\dfrac{1}{${va}} + ${kTerm} = \\dfrac{1}{${vc}}$, which of the following expresses $${vc}$ in terms of $${va}$ and $${vb}$?`,
        null,
        `Reciprocals on both sides: add the fractions on the left over a common denominator, then take the reciprocal of both sides.

$\\dfrac{1}{${va}} + ${kTerm} = \\dfrac{${vb} + ${kk}${va}}{${va}${vb}}$. This equals $\\dfrac{1}{${vc}}$, and equal fractions have equal reciprocals, so $${vc} = ${texEx(correct)}$.

Check: $${va} = 2$ and $${vb} = 3$ give $\\frac{1}{2} + \\frac{${kk}}{3} =${new Frac(1, 2).add(new Frac(kk, 3)).toTex()}$, so $${vc} = ${new Frac(1).div(new Frac(1, 2).add(new Frac(kk, 3))).toTex()}$, which is what the formula gives.`,
        'A sum of fractions is combined first; only then can you flip.',
      );
      if (out3) return out3;
    }
  },
  check(q, { kind, k, rels, exprs, vars }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    const matches: number[] = [];
    if (kind === 'relation') {
      const [a, b, c] = k;
      rels.forEach((rel, i) => {
        if (q.choices[i].text !== `$${relTex(rel, vars[0], vars[1])}$`) matches.push(-100);
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
            if (!close(evalEx(e, { [vars[0]]: a, [vars[1]]: b }), c, 1e-9)) ok = false;
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

/**
 * Builds the MCS of a "solve for" question: the correct expression and four named wrong ones (the order
 * of `wrongs` is already shuffled). `yOf` gives y for a chosen x so that the cited trap can be refuted with
 * a number; null for the harmonic form, which is refuted with sample values of a and b.
 */
function finishSolveFor(
  rng: Parameters<Template['generate']>[0],
  kind: LiteralParams['kind'],
  k: number[],
  vars: string[],
  correct: Ex,
  wrongs: { e: Ex; trap: string; why: string }[],
  stem: string,
  yOf: ((x: Frac) => Frac | null) | null,
  method: string,
  rule: string,
) {
  const seen = new Set([texEx(correct)]);
  const kept = wrongs
    .filter((w) => {
      const t = texEx(w.e);
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .slice(0, 4);
  if (kept.length < 4) return null;
  const { choices, answer } = textChoices(
    rng,
    `$${texEx(correct)}$`,
    kept.map((w) => ({ text: `$${texEx(w.e)}$`, trap: w.trap })),
  );
  const all = [correct, ...kept.map((w) => w.e)];
  const exprs = choices.map((c) => all.find((e) => `$${texEx(e)}$` === c.text)!);
  const t = kept[0];
  let refute = '';
  if (yOf) {
    const pr = probe(yOf, t.e, 'y', [1, 2, 3, 0, -1, -2, 4, 5]);
    if (pr) refute = `Test it with $x = ${pr.x.toTex()}$: then $y = ${pr.y.toTex()}$, and $${texEx(t.e)}$ returns $${pr.got.toTex()}$ instead of $${pr.x.toTex()}$.`;
  } else {
    const [va, vb] = vars;
    const kk = k[0];
    for (const [a, b] of [[2, 3], [2, 4], [3, 6], [4, 2], [3, 5]]) {
      const c = new Frac(1).div(new Frac(1, a).add(new Frac(kk, b)));
      const got = evalFrac(t.e, { [va]: new Frac(a), [vb]: new Frac(b) });
      if (!got.eq(c)) {
        refute = `Test it with $${va} = ${a}$ and $${vb} = ${b}$: then $\\frac{1}{${a}} + \\frac{${kk}}{${b}} = ${new Frac(1).div(c).toTex()}$, so $${vars[2]} = ${c.toTex()}$, but the formula gives $${got.toTex()}$.`;
        break;
      }
    }
  }
  return {
    params: { kind, k, rels: [] as [number, number][], exprs, vars },
    q: {
      format: 'mcs' as const,
      stem,
      choices,
      answer,
      explanation: `${method}

Trap: $${texEx(t.e)}$ comes from ${t.why}. ${refute}

${rule}`,
    },
  };
}
export const linearTemplates = [solveLinearMCS, fractionQC, shortcutNE, literalMCS];
