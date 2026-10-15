import { qcCompare } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, intExcept, qcEnd, qcSamples, times, trapChoices } from './util';

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
    for (;;) {
      const kind: ProductParams['kind'] = rng.pick(d === 1 ? ['x-from-xy2', 'y-from-x2y'] : d === 2 ? ['x-from-xy2', 'y-from-x2y', 'ratio'] : ['x-from-xy2', 'ratio', 'product']);
      let A: number;
      let B: number;
      let answer: Frac;
      let stem: string;
      let method: string;
      const wrongs: { value: Frac; trap: string; why: string; refute: string }[] = [];
      if (kind === 'x-from-xy2' || kind === 'y-from-x2y') {
        // xy^2 = A, xy = B  (or x^2 y = A, xy = B, roles swapped)
        const other = rng.int(2, 6); // y (or x)
        const Bv = rng.int(2, 12);
        B = Bv;
        A = B * other;
        answer = new Frac(B, other);
        if (answer.eq(1)) continue;
        const [u, w] = kind === 'x-from-xy2' ? ['x', 'y'] : ['y', 'x'];
        const first = kind === 'x-from-xy2' ? 'xy^2' : 'x^2y';
        stem = `If $${first} = ${A}$ and $xy = ${B}$, what is the value of $${u}$?`;
        method = `Two product equations: divide one by the other so that a common factor cancels. $\\dfrac{${first}}{xy} = ${w}$, so $${w} = \\dfrac{${A}}{${B}} = ${other}$ (the ratio of the two right sides). Then $${u} \\cdot ${other} = ${B}$ gives $${u} = ${answer.toTex()}$.

Check: $${u} \\cdot ${w}^2 = ${answer.toTex()} \\cdot ${other * other} = ${num(answer.mul(other * other))}$ and $${u}${w} = ${B}$.`;
        const refute = (t: Frac) => `If $${u} = ${t.toTex()}$, then $${w} = ${new Frac(B).div(t).toTex()}$ and $${first} = ${t.mul(new Frac(B).div(t).pow(2)).toTex()}$, not ${A}.`;
        wrongs.push({ value: frac(other), trap: 'alg-answered-other-variable', why: `giving $${w}$ instead of $${u}$`, refute: `The question asks for $${u}$; $${w} = ${other}$ is only the middle step.` });
        wrongs.push({ value: new Frac(other, B), trap: 'alg-divided-wrong-way', why: `dividing $${w}$ by ${B} instead of ${B} by $${w}$`, refute: refute(new Frac(other, B)) });
        wrongs.push({ value: new Frac(B, A), trap: 'alg-divided-wrong-way', why: 'dividing the second equation by the first', refute: refute(new Frac(B, A)) });
        wrongs.push({ value: frac(A), trap: 'alg-operation-swapped', why: `multiplying ${B} by $${w}$ instead of dividing`, refute: refute(frac(A)) });
        wrongs.push({ value: frac(B), trap: 'alg-forgot-divide', why: `stopping at $${u}${w} = ${B}$ without dividing by $${w}$`, refute: refute(frac(B)) });
        wrongs.push({ value: frac(A - B), trap: 'alg-wrong-operation-on-equations', why: 'subtracting the equations instead of dividing them', refute: refute(frac(A - B)) });
        wrongs.push({ value: new Frac(1, B), trap: 'alg-divided-wrong-way', why: `turning $${u}${w} = ${B}$ upside down`, refute: refute(new Frac(1, B)) });
        wrongs.push({ value: new Frac(B, other * other), trap: 'alg-exponent-slip', why: `dividing ${B} by $${w}^2$ where $${w}$ was needed`, refute: refute(new Frac(B, other * other)) });
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
          method = `The ratio $\\frac{x}{y}$ appears when the first equation is divided by the second, with no need to find $x$ and $y$: $\\dfrac{x^2y}{xy^2} = \\dfrac{x}{y}$, so $\\dfrac{x}{y} = \\dfrac{${A}}{${B}} = ${answer.toTex()}$.

Check: $x = ${x0}$ and $y = ${y0}$ give $x^2y = ${A}$, $xy^2 = ${B}$ and $\\frac{x}{y} = ${answer.toTex()}$.`;
          const refute = (t: Frac) => `$\\frac{x}{y}$ is $\\frac{${A}}{${B}}$, which is not $${t.toTex()}$.`;
          wrongs.push({ value: new Frac(y0, x0), trap: 'alg-divided-wrong-way', why: 'dividing the equations in the wrong order', refute: `Dividing the second by the first gives $\\frac{y}{x}$, not $\\frac{x}{y}$.` });
          wrongs.push({ value: frac(x0), trap: 'alg-answered-one-variable', why: 'giving $x$', refute: refute(frac(x0)) });
          wrongs.push({ value: frac(y0), trap: 'alg-answered-one-variable', why: 'giving $y$', refute: refute(frac(y0)) });
          wrongs.push({ value: frac(A * B), trap: 'alg-operation-swapped', why: 'multiplying the equations instead of dividing them', refute: refute(frac(A * B)) });
          wrongs.push({ value: frac(Math.abs(A - B)), trap: 'alg-wrong-operation-on-equations', why: 'subtracting the equations', refute: refute(frac(Math.abs(A - B))) });
        } else {
          answer = frac(x0 * y0);
          stem = `If $x^2y = ${A}$ and $xy^2 = ${B}$, what is the value of $xy$?`;
          method = `The product of the two left sides is a power of $xy$: $x^2y \\cdot xy^2 = x^3y^3 = (xy)^3$, so $(xy)^3 = ${A} \\cdot ${B} = ${num(A * B)}$. The cube root gives $xy = ${x0 * y0}$.

Check: $${x0 * y0}^3 = ${num((x0 * y0) ** 3)} = ${num(A * B)}$.`;
          const refute = (t: Frac) => `$(xy)^3 = ${num(A * B)}$, but $${t.toTex()}^3 = ${t.pow(3).toTex()}$.`;
          wrongs.push({ value: frac(A * B), trap: 'alg-forgot-root', why: `stopping at $(xy)^3 = ${num(A * B)}$ without taking the cube root`, refute: `That is the value of $(xy)^3$, not of $xy$.` });
          wrongs.push({ value: frac(x0), trap: 'alg-answered-one-variable', why: 'giving $x$', refute: refute(frac(x0)) });
          wrongs.push({ value: frac(y0), trap: 'alg-answered-one-variable', why: 'giving $y$', refute: refute(frac(y0)) });
          wrongs.push({ value: new Frac(A, B), trap: 'alg-operation-swapped', why: 'dividing the equations when a product was needed', refute: refute(new Frac(A, B)) });
          wrongs.push({ value: frac(A + B), trap: 'alg-wrong-operation-on-equations', why: 'adding the equations', refute: refute(frac(A + B)) });
        }
      }
      const res = trapChoices(rng, answer, wrongs.filter((w) => w.value.sign() > 0), (v) => `$${v.toTex()}$`);
      if (!res) continue;
      const cited = res.kept[0];
      return {
        params: { kind, A: A!, B: B!, values: res.values.map((v) => [v.n, v.d] as [number, number]) },
        q: {
          format: 'mcs',
          stem: stem!,
          choices: res.choices,
          answer: res.answer,
          explanation: `${method!}

Trap: $${cited.value.toTex()}$ comes from ${cited.why}. ${cited.refute}

Rule: to isolate a variable from product equations, divide or multiply them so that the other factors cancel.`,
        },
      };
    }
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
        ? `Substitute $x = y ${a > 0 ? '-' : '+'} ${Math.abs(a)}$ into $xy = ${num(k)}$: $${lin([[1, 'y^2'], [-a, 'y']])} = ${num(k)}$, so $${lin([[1, 'y^2'], [-a, 'y'], [-k, '']])} = 0$ and $(y ${r1 < 0 ? '+' : '-'} ${Math.abs(r1)})(y ${r2 < 0 ? '+' : '-'} ${Math.abs(r2)}) = 0$.

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
  values: [number, number][];
}

const solutionCountMCS: Template<CountParams> = {
  id: 'alg.systems.solution-count-mcs',
  skill: 'alg.systems',
  format: 'mcs',
  style: 'constant that gives no solution or infinitely many',
  generate(rng, d) {
    for (;;) {
      const kind: CountParams['kind'] = rng.pick(['none', 'infinite']);
      const a1 = rng.int(2, 6);
      let b1: number;
      do b1 = rng.int(-6, 6);
      while (b1 === 0 || Math.abs(b1) === a1);
      let c1: number;
      do c1 = rng.int(-9, 12);
      while (c1 === 0 || Math.abs(c1) === 1);
      const m = rng.pick(d === 1 ? [2, 3] : [2, 3, -2, -3, 4]);
      let stem: string;
      let method: string;
      let rule: string;
      let answer: Frac;
      let e2: [number, number, number];
      const wrongs: { value: Frac; trap: string; why: string }[] = [];
      if (kind === 'none') {
        const b2 = m * b1;
        let c2: number;
        do c2 = rng.int(-15, 20);
        while (c2 === m * c1 || c2 === 0);
        answer = frac(m * a1);
        e2 = [NaN, b2, c2];
        stem = `$$${eqTex([a1, b1, c1])}$$
$$${lin([[1, 'kx'], [b2, 'y']])} = ${num(c2)}$$

In the system of equations above, $k$ is a constant. For what value of $k$ does the system have no solution?`;
        method = `No solution means parallel lines: the left sides are proportional but the right sides are not. The $y$-coefficients give the factor, $${num(b2)} = ${m}(${num(b1)})$, so $k = ${m}(${a1}) = ${num(answer)}$.

Check: the second left side is then $${m}$ times the first, but $${num(c2)} \\ne ${m}(${num(c1)}) = ${num(m * c1)}$, so no pair $(x, y)$ satisfies both.`;
        rule = 'No solution: same slope, different constant.';
        wrongs.push({ value: frac(-m * a1), trap: 'alg-proportional-sign', why: 'losing the sign of the factor' });
        wrongs.push({ value: new Frac(a1, m), trap: 'alg-ratio-inverted', why: `dividing ${a1} by $${m}$ instead of multiplying` });
        wrongs.push({ value: frac(a1), trap: 'alg-ignored-scaling', why: 'ignoring the factor between the equations' });
        wrongs.push({ value: frac(m), trap: 'alg-ratio-factor-only', why: 'giving the factor itself' });
        wrongs.push({ value: frac(m * c1), trap: 'alg-wrong-ratio-pair', why: 'scaling the constant of the first equation instead of its $x$-coefficient' });
        wrongs.push({ value: frac(b2), trap: 'alg-wrong-ratio-pair', why: 'copying the $y$-coefficient of the second equation' });
        wrongs.push({ value: frac(a1 * b2), trap: 'alg-operation-swapped', why: `multiplying ${a1} by ${num(b2)} where the ratio ${num(b2)}/${num(b1)} was needed` });
        wrongs.push({ value: frac(a1 + m), trap: 'alg-added-factor', why: 'adding the factor instead of multiplying by it' });
        wrongs.push({ value: new Frac(a1 * c2, c1), trap: 'alg-wrong-ratio-pair', why: 'matching the constants on the right instead of the $y$-coefficients' });
        wrongs.push({ value: frac(m * m * a1), trap: 'alg-factor-twice', why: `multiplying by the factor $${m}$ twice` });
      } else {
        answer = frac(m * c1);
        e2 = [m * a1, m * b1, NaN];
        stem = `$$${eqTex([a1, b1, c1])}$$
$$${lin([[m * a1, 'x'], [m * b1, 'y']])} = k$$

In the system of equations above, $k$ is a constant. For what value of $k$ does the system have infinitely many solutions?`;
        method = `Infinitely many solutions mean the same line twice: the second equation must be exactly $${m}$ times the first, constant included. The left side is already $${m}$ times the first, so $k = ${m}(${num(c1)}) = ${num(answer)}$.

Check: with $k = ${num(answer)}$ the second equation divided by $${m}$ gives back $${eqTex([a1, b1, c1])}$. For any other $k$ the lines are parallel and there is no solution.`;
        rule = 'Infinitely many solutions: every number of the first equation is multiplied by the same factor.';
        wrongs.push({ value: frac(c1), trap: 'alg-ignored-scaling', why: 'forgetting to multiply the constant by the factor' });
        wrongs.push({ value: frac(-m * c1), trap: 'alg-proportional-sign', why: 'losing the sign of the factor' });
        wrongs.push({ value: new Frac(c1, m), trap: 'alg-ratio-inverted', why: `dividing ${num(c1)} by $${m}$ instead of multiplying` });
        wrongs.push({ value: frac(m * a1), trap: 'alg-wrong-ratio-pair', why: 'copying the new $x$-coefficient instead of scaling the constant' });
        wrongs.push({ value: frac(m * b1), trap: 'alg-wrong-ratio-pair', why: 'copying the new $y$-coefficient instead of scaling the constant' });
        wrongs.push({ value: frac(m), trap: 'alg-ratio-factor-only', why: 'giving the factor itself' });
        wrongs.push({ value: frac(c1 + m), trap: 'alg-added-factor', why: 'adding the factor to the constant instead of multiplying' });
        wrongs.push({ value: frac(m * m * c1), trap: 'alg-factor-twice', why: `multiplying by the factor $${m}$ twice` });
      }
      const res = trapChoices(rng, answer, wrongs, (v) => `$${num(v)}$`);
      if (!res) continue;
      const cited = res.kept[0];
      return {
        params: { kind, e1: [a1, b1, c1], e2: e2!, values: res.values.map((v) => [v.n, v.d] as [number, number]) },
        q: {
          format: 'mcs',
          stem,
          choices: res.choices,
          answer: res.answer,
          explanation: `${method}

Trap: $${num(cited.value)}$ comes from ${cited.why}; it does not make the second equation ${kind === 'none' ? 'parallel to' : 'a copy of'} the first.

Rule: ${rule}`,
        },
      };
    }
  },
  check(q, { kind, e1, e2, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some(([n, dd], i) => q.choices[i].text !== `$${num(new Frac(n, dd))}$`)) return 'choice text mismatch';
    // Classify by determinants (Cramer / rank), independently of the ratio argument, in exact arithmetic.
    const classify = (f: [Frac, Frac, Frac]): 'one' | 'none' | 'infinite' => {
      const det = f[1].mul(e1[0]).sub(f[0].mul(e1[1]));
      if (!det.eq(0)) return 'one';
      const dx = f[1].mul(e1[2]).sub(f[2].mul(e1[1]));
      const dy = f[2].mul(e1[0]).sub(f[0].mul(e1[2]));
      return dx.eq(0) && dy.eq(0) ? 'infinite' : 'none';
    };
    const hits = values.flatMap(([n, dd], i) => {
      const v = new Frac(n, dd);
      const f: [Frac, Frac, Frac] = [Number.isNaN(e2[0]) ? v : new Frac(e2[0]), new Frac(e2[1]), Number.isNaN(e2[2]) ? v : new Frac(e2[2])];
      return classify(f) === kind ? [i] : [];
    });
    if (hits.length !== 1) return `${hits.length} matching choices`;
    return hits[0] === q.answer ? null : `expected ${hits[0]}`;
  },
};

export const systemTemplates = [combineNE, productMCS, compareQC, solutionCountMCS];