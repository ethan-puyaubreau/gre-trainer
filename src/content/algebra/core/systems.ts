import { numericChoices, qcCompare } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, intExcept, qcEnd, qcSamples, sideFill, someTraps, times } from './util';

/** a x + b y = c */
type Eq = [number, number, number];
const eqTex = ([a, b, c]: Eq, vx = 'x', vy = 'y') => `${lin([[a, vx], [b, vy]])} = ${num(c)}`;

/** Cramer's rule in floating point (used by checks). */
function cramer(e1: Eq, e2: Eq): [number, number] | null {
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  if (det === 0) return null;
  return [(e1[2] * e2[1] - e1[1] * e2[2]) / det, (e1[0] * e2[2] - e1[2] * e2[0]) / det];
}

/* ================================================================== 1. Add or subtract the equations (NE) */

interface CombineParams {
  e1: Eq;
  e2: Eq;
  target: [number, number];
}

const combineNE: Template<CombineParams> = {
  id: 'alg.systems.combine-ne',
  skill: 'alg.systems',
  format: 'ne',
  style: 'add or subtract the equations to get x + y or x − y',
  generate(rng, d) {
    const kind = rng.pick(['sum', 'diff'] as const);
    let e1: Eq;
    let e2: Eq;
    let x0: number;
    let y0: number;
    let k: number;
    for (;;) {
      const a = rng.int(1, d === 3 ? 12 : 8);
      const b = intExcept(rng, 1, d === 3 ? 12 : 8, a);
      k = rng.int(2, d === 1 ? 8 : 12);
      const c = kind === 'sum' ? k - a : a - k;
      const dd = kind === 'sum' ? k - b : b + k;
      if (c === 0 || dd === 0 || a * dd - b * c === 0) continue;
      if (d === 1 && (c < 0 || dd < 0)) continue;
      x0 = rng.int(-6, d === 3 ? 20 : 12);
      y0 = rng.int(-6, d === 3 ? 20 : 12);
      if (x0 === y0 || (kind === 'diff' && x0 - y0 === 0)) continue;
      e1 = [a, b, a * x0 + b * y0];
      e2 = [c, dd, c * x0 + dd * y0];
      break;
    }
    const target: [number, number] = kind === 'sum' ? [1, 1] : [1, -1];
    const answer = kind === 'sum' ? x0! + y0! : x0! - y0!;
    const op = kind === 'sum' ? 'Add' : 'Subtract the second equation from the first';
    const combined = kind === 'sum' ? [e1![0] + e2![0], e1![1] + e2![1], e1![2] + e2![2]] : [e1![0] - e2![0], e1![1] - e2![1], e1![2] - e2![2]];
    const traps: { value: Frac; trap: string }[] = [];
    if (x0! !== answer) traps.push({ value: frac(x0!), trap: 'alg-answered-one-variable' });
    if (combined[2] !== answer) traps.push({ value: frac(combined[2]), trap: 'alg-forgot-divide' });
    const tgt = kind === 'sum' ? 'x + y' : 'x - y';
    return {
      params: { e1: e1!, e2: e2!, target },
      q: {
        format: 'ne',
        stem: `$$${eqTex(e1!)}$$
$$${eqTex(e2!)}$$

If $x$ and $y$ satisfy the system of equations above, what is the value of $${tgt}$?`,
        answer: frac(answer),
        traps,
        explanation: `No need to solve for $x$ and $y$. ${op}${kind === 'sum' ? ' the two equations' : ''}: $${eqTex(combined as Eq)}$.

Divide by ${k!}: $${tgt} = ${num(answer)}$.

(Solving fully gives $x = ${num(x0!)}$ and $y = ${num(y0!)}$, which takes longer and risks a slip.)`,
      },
    };
  },
  check(q, { e1, e2, target }) {
    if (q.format !== 'ne') return 'wrong format';
    const s = cramer(e1, e2);
    if (!s) return 'singular system';
    const v = target[0] * s[0] + target[1] * s[1];
    return close(q.answer.toNumber(), v, 1e-9) ? null : `expected ${v}`;
  },
};

/* ================================================================== 2. Two product equations (MCS) */

interface ProductParams {
  kind: 'x-from-xy2' | 'y-from-x2y' | 'ratio' | 'product';
  /** first equation value, second equation value */
  A: number;
  B: number;
  values: [number, number][];
}

const productMCS: Template<ProductParams> = {
  id: 'alg.systems.product-mcs',
  skill: 'alg.systems',
  format: 'mcs',
  style: 'divide two product equations',
  generate(rng, d) {
    const kind: ProductParams['kind'] = rng.pick(d === 1 ? ['x-from-xy2', 'y-from-x2y'] : d === 2 ? ['x-from-xy2', 'y-from-x2y', 'ratio'] : ['x-from-xy2', 'ratio', 'product']);
    let A: number;
    let B: number;
    let answer: Frac;
    let stem: string;
    let explanation: string;
    const traps: { value: Frac; trap: string }[] = [];
    const fillers: Frac[] = [];
    if (kind === 'x-from-xy2' || kind === 'y-from-x2y') {
      // xy^2 = A, xy = B  (or x^2 y = A, xy = B, roles swapped)
      const other = rng.int(2, 6); // y (or x)
      let Bv: number;
      do Bv = rng.int(1, 12);
      while (Bv % other === 0 && rng.chance(0.7));
      B = Bv;
      A = B * other;
      answer = new Frac(B, other);
      const [u, w] = kind === 'x-from-xy2' ? ['x', 'y'] : ['y', 'x'];
      const first = kind === 'x-from-xy2' ? 'xy^2' : 'x^2y';
      stem = `If $${first} = ${A}$ and $xy = ${B}$, what is the value of $${u}$?`;
      explanation = `Divide the first equation by the second: $\\dfrac{${first}}{xy} = ${w}$, so $${w} = \\dfrac{${A}}{${B}} = ${other}$.

Then $${u} \\cdot ${other} = ${B}$ gives $${u} = ${answer.toTex()}$.

Careful: the question asks for $${u}$, not $${w}$.`;
      traps.push({ value: frac(other), trap: 'alg-answered-other-variable' });
      traps.push({ value: new Frac(other, B), trap: 'alg-divided-wrong-way' });
      fillers.push(new Frac(1, other), new Frac(A, 1), new Frac(A - B, 1), new Frac(B * B, 1), new Frac(A, B * B + 1));
    } else {
      let x0: number;
      let y0: number;
      do {
        x0 = rng.int(1, 6);
        y0 = rng.int(1, 6);
      } while (x0 === y0);
      A = x0 * x0 * y0;
      B = x0 * y0 * y0;
      if (kind === 'ratio') {
        answer = new Frac(x0, y0);
        stem = `If $x^2y = ${A}$ and $xy^2 = ${B}$, what is the value of $\\dfrac{x}{y}$?`;
        explanation = `Divide the first equation by the second: $\\dfrac{x^2y}{xy^2} = \\dfrac{x}{y}$, so $\\dfrac{x}{y} = \\dfrac{${A}}{${B}} = ${answer.toTex()}$.

There is no need to find $x$ and $y$ themselves. Dividing in the other order gives $\\frac{y}{x}$.`;
        traps.push({ value: new Frac(y0, x0), trap: 'alg-divided-wrong-way' });
        fillers.push(frac(x0), frac(y0), new Frac(A - B, 1).abs(), new Frac(x0 * y0, 1), new Frac(x0 + 1, y0));
      } else {
        answer = frac(x0 * y0);
        stem = `If $x^2y = ${A}$ and $xy^2 = ${B}$, what is the value of $xy$?`;
        explanation = `Multiply the two equations: $x^2y \\cdot xy^2 = x^3y^3 = (xy)^3$, so $(xy)^3 = ${A} \\cdot ${B} = ${num(A * B)}$.

The cube root gives $xy = ${x0 * y0}$.`;
        traps.push({ value: frac(A * B), trap: 'alg-forgot-root' });
        fillers.push(frac(A + B), new Frac(A, B), frac(x0 * y0 + 1), frac(x0 * y0 * x0), frac(Math.max(1, x0 * y0 - 2)));
      }
    }
    const { choices, answer: idx } = numericChoices(rng, {
      correct: answer,
      traps: someTraps(rng, traps.filter((t) => !t.value.eq(answer))),
      fillers: [...sideFill(rng, answer!, answer!.isInt() ? 1 : new Frac(1, answer!.d)).filter((v) => v.sign() > 0), ...rng.shuffle(fillers)],
      format: (v) => `$${v.toTex()}$`,
    });
    const values = choices.map((c) => parseFracTex(c.text));
    return { params: { kind, A: A!, B: B!, values }, q: { format: 'mcs', stem: stem!, choices, answer: idx, explanation: explanation! } };
  },
  check(q, { kind, A, B, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some(([n, dd], i) => q.choices[i].text !== `$${new Frac(n, dd).toTex()}$`)) return 'choice text mismatch';
    const ok = values.map(([n, dd]) => {
      const v = new Frac(n, dd);
      if (kind === 'x-from-xy2' || kind === 'y-from-x2y') {
        // v is the asked variable u; the other is B / v; check u * w^2 = A
        if (v.n === 0) return false;
        const w = new Frac(B).div(v);
        return v.mul(w).mul(w).eq(A);
      }
      // Solve numerically: (xy)^3 = A B, x = A / (xy), y = B / (xy).
      const p = Math.cbrt(A * B);
      const x = A / p;
      const y = B / p;
      return close(v.toNumber(), kind === 'ratio' ? x / y : x * y, 1e-9);
    });
    const hits = ok.flatMap((b, i) => (b ? [i] : []));
    if (hits.length !== 1) return `${hits.length} matching choices`;
    return hits[0] === q.answer ? null : `expected ${hits[0]}`;
  },
};

function parseFracTex(t: string): [number, number] {
  const s = t.replace(/\$/g, '').replace(/\{,\}/g, '');
  const m = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return [(m[1] ? -1 : 1) * Number(m[2]), Number(m[3])];
  return [Number(s), 1];
}

/* ================================================================== 3. Compare the unknowns of a system (QC) */

interface CompareParams {
  kind: 'linear' | 'nonlinear' | 'dependent';
  e1: Eq;
  e2: Eq;
  /** nonlinear: k and a in xy = k, x = y - a */
  k: number;
  a: number;
  /** Quantity A and B as coefficient vectors over [x, y, 1]. */
  qa: [number, number, number];
  qb: [number, number, number];
}

const vecTex = ([p, q, r]: [number, number, number]) => lin([[p, 'x'], [q, 'y'], [r, '']]);

const compareQC: Template<CompareParams> = {
  id: 'alg.systems.compare-qc',
  skill: 'alg.systems',
  format: 'qc',
  style: 'compare the unknowns of a system',
  generate(rng, d) {
    const kind: CompareParams['kind'] = rng.pick(d === 1 ? ['linear', 'linear', 'dependent'] : ['linear', 'nonlinear', 'dependent', 'nonlinear']);
    let info: string;
    let qa: [number, number, number] = [1, 0, 0];
    let qb: [number, number, number] = [0, 1, 0];
    let answer: QCChoice;
    const traps: QCQuestion['traps'] = {};
    let explanation: string;
    let e1: Eq = [0, 0, 0];
    let e2: Eq = [0, 0, 0];
    let k = 0;
    let a = 0;
    if (kind === 'linear') {
      let x0: number;
      let y0: number;
      for (;;) {
        x0 = rng.int(-5, 10);
        y0 = rng.chance(0.2) ? x0 : rng.int(-5, 10);
        const c1 = [rng.int(1, 6), rng.int(-6, 6)];
        const c2 = [rng.int(-6, 6), rng.int(1, 6)];
        if (c1[1] === 0 || c2[0] === 0 || c1[0] * c2[1] - c1[1] * c2[0] === 0) continue;
        e1 = [c1[0], c1[1], c1[0] * x0 + c1[1] * y0];
        e2 = [c2[0], c2[1], c2[0] * x0 + c2[1] * y0];
        break;
      }
      answer = qcCompare(x0, y0);
      info = `$${eqTex(e1)}$

$${eqTex(e2)}$`;
      traps.D = 'alg-qc-variable-d';
      const det = e1[0] * e2[1] - e1[1] * e2[0];
      explanation = `Two independent linear equations have exactly one solution, so solve. Eliminate a variable: multiply the first equation by $${num(e2[1])}$ and the second by $${num(e1[1])}$ and subtract to get $${lin([[det, 'x']])} = ${num(det * x0)}$, so $x = ${num(x0)}$. Then the first equation gives $y = ${num(y0)}$.

Compare $x = ${num(x0)}$ with $y = ${num(y0)}$. ${qcEnd(answer)}`;
    } else if (kind === 'nonlinear') {
      let y1: number;
      let y2: number;
      do {
        y1 = rng.int(-7, 7);
        y2 = rng.int(-7, 7);
      } while (y1 === 0 || y2 === 0 || y1 === y2 || y1 + y2 === 0);
      a = y1 + y2;
      k = -y1 * y2;
      // xy = k, x = y - a  =>  y^2 - a y - k = 0 with roots y1, y2
      info = `$xy = ${num(k)}$ and $x = y ${a > 0 ? '-' : '+'} ${Math.abs(a)}$`;
      const askY = rng.chance(0.65);
      if (askY) {
        qa = [0, 1, 0];
        qb = [0, 0, 0];
        const signs = new Set([Math.sign(y1), Math.sign(y2)]);
        answer = signs.size > 1 ? 'D' : y1 > 0 ? 'A' : 'B';
        if (answer === 'D') traps[y1 > 0 || y2 > 0 ? 'A' : 'B'] = 'alg-found-one-solution';
        else traps.D = 'alg-qc-variable-d';
      } else {
        qa = [1, 0, 0];
        qb = [0, 1, 0];
        answer = a > 0 ? 'B' : 'A';
        traps.D = 'alg-qc-variable-d';
      }
      const [r1, r2] = [Math.min(y1, y2), Math.max(y1, y2)];
      explanation = askY
        ? `Substitute $x = y ${a > 0 ? '-' : '+'} ${Math.abs(a)}$ into $xy = ${num(k)}$: $y^2 ${a > 0 ? '-' : '+'} ${Math.abs(a)}y = ${num(k)}$, so $${lin([[1, 'y^2'], [-a, 'y'], [-k, '']])} = 0$ and $(y ${r1 < 0 ? '+' : '-'} ${Math.abs(r1)})(y ${r2 < 0 ? '+' : '-'} ${Math.abs(r2)}) = 0$.

So $y = ${num(r1)}$ or $y = ${num(r2)}$ (with $x = ${num(r1 - a)}$ or $x = ${num(r2 - a)}$). ${
            answer === 'D' ? 'One value of $y$ is negative and the other positive.' : `Both values of $y$ are ${r1 > 0 ? 'positive' : 'negative'}.`
          } ${qcEnd(answer)}${answer === 'D' ? '\n\nFinding only one of the two solutions makes the answer look determined.' : ''}`
        : `You do not need to solve: the second equation says $x - y = ${num(-a)}$, so $x$ is ${Math.abs(a)} ${a > 0 ? 'less' : 'more'} than $y$ for every solution. ${qcEnd(answer)}`;
    } else {
      // dependent system: second equation is a multiple of the first
      let p: number;
      let q: number;
      do {
        p = rng.int(1, 6);
        q = rng.int(-6, 6);
      } while (q === 0 || q === -p || q === p);
      let c: number;
      do c = rng.int(-10, 20);
      while (c === 0);
      const m = rng.pick([2, 3, -2, 4]);
      e1 = [p, q, c];
      e2 = [m * p, m * q, m * c];
      info = `$${eqTex(e1)}$

$${eqTex(e2)}$`;
      if (rng.chance(0.5)) {
        qa = [1, 0, 0];
        qb = [0, 1, 0];
        answer = 'D';
        traps.C = 'alg-dependent-system';
        // Two points of the line on opposite sides of x = y: x - y changes sign at x = c / (p + q).
        const tStar = c / (p + q);
        const t1 = Math.floor(tStar) - 1;
        const t2 = Math.ceil(tStar) + 1;
        const pt = (t: number) => `$x = ${num(t)}$, $y = ${new Frac(c - p * t, q).toTex()}$`;
        const ex1 = pt(t1);
        const ex2 = pt(t2);
        explanation = `The second equation is the first multiplied by $${m}$, so the two equations say the same thing: there are infinitely many solutions.

For example, ${ex1} and ${ex2} both satisfy the equations, and they compare $x$ and $y$ differently. ${qcEnd(answer)}`;
      } else {
        const t = rng.pick([2, 3, -1, 5]);
        qa = [t * p, t * q, 0];
        const B = t * c + rng.pick([0, 0, -2, 3]);
        qb = [0, 0, B];
        answer = qcCompare(t * c, B);
        traps.D = 'alg-dependent-system';
        explanation = `The second equation is just the first multiplied by $${m}$, so $x$ and $y$ cannot be found. But Quantity A is a multiple of the left side: $${vecTex(qa)} = ${times(t, lin([[p, 'x'], [q, 'y']]))} = ${times(t, num(c))} = ${num(t * c)}$.

Compare $${num(t * c)}$ with $${num(B)}$. ${qcEnd(answer)}`;
      }
    }
    return {
      params: { kind, e1, e2, k, a, qa, qb },
      q: {
        format: 'qc',
        info,
        quantityA: `$${vecTex(qa)}$`,
        quantityB: `$${vecTex(qb)}$`,
        answer,
        traps: Object.keys(traps).length ? traps : undefined,
        explanation,
      },
    };
  },
  check(q, { kind, e1, e2, k, a, qa, qb }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const val = (v: [number, number, number], x: number, y: number) => v[0] * x + v[1] * y + v[2];
    const samples: [number, number][] = [];
    if (kind === 'linear') {
      const s = cramer(e1, e2);
      if (!s) return 'singular';
      samples.push([val(qa, s[0], s[1]), val(qb, s[0], s[1])]);
    } else if (kind === 'nonlinear') {
      // y^2 - a y - k = 0 by bisection on each side of the vertex
      const f = (y: number) => (y - a) * y - k;
      const vtx = a / 2;
      for (const dir of [-1, 1]) {
        let lo = vtx;
        let hi = vtx + dir * 1000;
        for (let i = 0; i < 200; i++) {
          const mid = (lo + hi) / 2;
          if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid;
          else hi = mid;
        }
        const y = (lo + hi) / 2;
        const x = y - a;
        if (Math.abs(x * y - k) > 1e-6) return 'bad root';
        samples.push([val(qa, x, y), val(qb, x, y)]);
      }
    } else {
      for (let i = 0; i < 200; i++) {
        const x = (rng.next() * 2 - 1) * rng.pick([5, 50, 500]);
        const y = (e1[2] - e1[0] * x) / e1[1];
        if (Math.abs(e2[0] * x + e2[1] * y - e2[2]) > 1e-6) return 'second equation not satisfied';
        samples.push([val(qa, x, y), val(qb, x, y)]);
      }
    }
    const expected = qcSamples(samples, 1e-9);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. No solution / infinitely many solutions (MCS) */

interface CountParams {
  kind: 'none' | 'infinite';
  e1: Eq;
  /** second equation with the unknown constant marked by NaN */
  e2: [number, number, number];
  values: number[];
}

const solutionCountMCS: Template<CountParams> = {
  id: 'alg.systems.solution-count-mcs',
  skill: 'alg.systems',
  format: 'mcs',
  style: 'constant that gives no solution or infinitely many',
  generate(rng, d) {
    const kind: CountParams['kind'] = rng.pick(['none', 'infinite']);
    const a1 = rng.int(1, 6);
    let b1: number;
    do b1 = rng.int(-6, 6);
    while (b1 === 0 || Math.abs(b1) === a1);
    let c1: number;
    do c1 = rng.int(-9, 12);
    while (c1 === 0);
    const m = rng.pick(d === 1 ? [2, 3] : [2, 3, -2, -3, 4]);
    let stem: string;
    let explanation: string;
    let answer: number;
    let e2: [number, number, number];
    const traps: { value: number; trap: string }[] = [];
    const fillers: number[] = [];
    if (kind === 'none') {
      const b2 = m * b1;
      let c2: number;
      do c2 = rng.int(-15, 20);
      while (c2 === m * c1);
      answer = m * a1;
      e2 = [NaN, b2, c2];
      stem = `$$${eqTex([a1, b1, c1])}$$
$$${lin([[1, 'kx'], [b2, 'y']])} = ${num(c2)}$$

In the system of equations above, $k$ is a constant. For what value of $k$ does the system have no solution?`;
      explanation = `Two linear equations have no solution when their left sides are proportional but the right sides are not (parallel lines). The $y$-coefficients give the factor: $${num(b2)} = ${m}(${num(b1)})$.

So $k = ${m}(${a1}) = ${num(answer)}$. Then the left side of the second equation is $${m}$ times the left side of the first, while $${num(c2)} \\ne ${m}(${num(c1)})$, so no pair $(x, y)$ satisfies both.`;
      traps.push({ value: -answer, trap: 'alg-proportional-sign' });
      if (Number.isInteger(a1 / m)) traps.push({ value: a1 / m, trap: 'alg-ratio-inverted' });
      fillers.push(a1, answer + m, answer - 1, answer + 1, b2, answer * 2);
    } else {
      answer = m * c1;
      e2 = [m * a1, m * b1, NaN];
      stem = `$$${eqTex([a1, b1, c1])}$$
$$${lin([[m * a1, 'x'], [m * b1, 'y']])} = k$$

In the system of equations above, $k$ is a constant. For what value of $k$ does the system have infinitely many solutions?`;
      explanation = `The left side of the second equation is $${m}$ times the left side of the first. The system has infinitely many solutions when the second equation is exactly $${m}$ times the first, that is, when $k = ${m}(${num(c1)}) = ${num(answer)}$. For any other $k$ there is no solution.`;
      traps.push({ value: c1, trap: 'alg-ignored-scaling' });
      traps.push({ value: -answer, trap: 'alg-proportional-sign' });
      fillers.push(answer + m, answer - m, answer + 1, c1 + m, answer * 2);
    }
    const { choices, answer: idx } = numericChoices(rng, {
      correct: answer,
      traps: someTraps(rng, traps.filter((t) => t.value !== answer).map((t) => ({ value: t.value, trap: t.trap }))),
      fillers: [...sideFill(rng, answer, rng.pick([1, Math.abs(m)])), ...rng.shuffle(fillers.filter((f) => f !== answer))],
      format: (v) => `$${num(v)}$`,
    });
    const values = choices.map((c) => Number(c.text.replace(/\$|\{,\}/g, '')));
    return {
      params: { kind, e1: [a1, b1, c1], e2: e2!, values },
      q: { format: 'mcs', stem, choices, answer: idx, explanation },
    };
  },
  check(q, { kind, e1, e2, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => q.choices[i].text !== `$${num(v)}$`)) return 'choice text mismatch';
    // Classify by determinants (Cramer / rank), independently of the ratio argument.
    const classify = (f: Eq): 'one' | 'none' | 'infinite' => {
      const det = e1[0] * f[1] - e1[1] * f[0];
      if (det !== 0) return 'one';
      const dx = e1[2] * f[1] - e1[1] * f[2];
      const dy = e1[0] * f[2] - e1[2] * f[0];
      return dx === 0 && dy === 0 ? 'infinite' : 'none';
    };
    const hits = values.flatMap((v, i) => {
      const f: Eq = [Number.isNaN(e2[0]) ? v : e2[0], e2[1], Number.isNaN(e2[2]) ? v : e2[2]];
      return classify(f) === kind ? [i] : [];
    });
    if (hits.length !== 1) return `${hits.length} matching choices`;
    return hits[0] === q.answer ? null : `expected ${hits[0]}`;
  },
};

export const systemTemplates = [combineNE, productMCS, compareQC, solutionCountMCS];
