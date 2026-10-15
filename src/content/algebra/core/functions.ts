import { flaggedChoices, qcCompare, textChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num, paren, poly } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { N, V, abs, add, close, times, div, evalEx, intExcept, mul, polyEx, pow, qcEnd, qcSamples, texEx, trapChoices, type Ex } from './util';

const horner = (c: number[], x: number) => c.reduce((s, a) => s * x + a, 0);
const hornerF = (c: number[], x: Frac) => c.reduce((s: Frac, a) => s.mul(x).add(a), new Frac(0));

/* ================================================================== 1. Evaluate and compose functions (NE) */

interface ComposeParams {
  kind: 'fg' | 'gf' | 'ff' | 'solve';
  f: number[];
  g: number[];
  k: number;
  m: number;
}

const composeNE: Template<ComposeParams> = {
  id: 'alg.functions.compose-ne',
  skill: 'alg.functions',
  format: 'ne',
  style: 'evaluate a composition or solve f(g(x)) = m',
  generate(rng, d) {
    const kind: ComposeParams['kind'] = rng.pick(d === 1 ? ['fg', 'gf'] : d === 2 ? ['fg', 'gf', 'ff'] : ['solve', 'fg', 'solve', 'ff']);
    const lin1 = (): number[] => [intExcept(rng, -5, 6, 0, 1), intExcept(rng, -9, 9, 0)];
    const quad = (): number[] => [1, rng.int(-5, 5), rng.int(-9, 9)];
    let f: number[];
    let g: number[];
    if (kind === 'solve') {
      f = lin1();
      g = lin1();
    } else if (d === 1) {
      f = lin1();
      g = rng.chance(0.5) ? lin1() : [1, 0, intExcept(rng, -6, 6, 0)];
    } else {
      [f, g] = rng.shuffle([lin1(), quad()]);
    }
    const k = intExcept(rng, -4, 5, 0);
    let answer: Frac;
    let m = 0;
    let stem: string;
    let explanation: string;
    const traps: { value: Frac; trap: string }[] = [];
    const F = (x: Frac) => hornerF(f, x);
    const G = (x: Frac) => hornerF(g, x);
    const defs = kind === 'ff' ? `$f(x) = ${poly(f)}$` : `$f(x) = ${poly(f)}$ and $g(x) = ${poly(g)}$`;
    if (kind === 'fg' || kind === 'gf') {
      const inner = kind === 'fg' ? G(frac(k)) : F(frac(k));
      answer = kind === 'fg' ? F(inner) : G(inner);
      const other = kind === 'fg' ? G(F(frac(k))) : F(G(frac(k)));
      const [o, i] = kind === 'fg' ? ['f', 'g'] : ['g', 'f'];
      stem = `If ${defs} for all values of $x$, what is the value of $${o}(${i}(${k}))$?`;
      explanation = `Work from the inside out. First $${i}(${k}) = ${substitute(kind === 'fg' ? g : f, frac(k))} = ${num(inner)}$.

Then $${o}(${num(inner)}) = ${substitute(kind === 'fg' ? f : g, inner)} = ${num(answer)}$.

Trap: applying the functions in the other order gives $${i}(${o}(${k})) = ${num(other)}$, which is a different number.

Rule: in $${o}(${i}(${k}))$ the function next to the number acts first.`;
      if (!other.eq(answer)) traps.push({ value: other, trap: 'alg-composition-order' });
      const prod = F(frac(k)).mul(G(frac(k)));
      if (!prod.eq(answer) && !prod.eq(other)) traps.push({ value: prod, trap: 'alg-composition-product' });
    } else if (kind === 'ff') {
      const inner = F(frac(k));
      answer = F(inner);
      stem = `If ${defs} for all values of $x$, what is the value of $f(f(${k}))$?`;
      const sq = inner.mul(inner);
      explanation = `Work from the inside out. First $f(${k}) = ${substitute(f, frac(k))} = ${num(inner)}$. Then $f(${num(inner)}) = ${substitute(f, inner)} = ${num(answer)}$.

Trap: $f(f(${k}))$ is not $f(${k}) \\cdot f(${k})$; that would give $${num(sq)}$. The result of the first step is the INPUT of the second.

Rule: feed each result back into the rule.`;
      if (!sq.eq(answer)) traps.push({ value: sq, trap: 'alg-composition-product' });
    } else {
      // f(g(x)) = m, linear: f(g(x)) = f0 (g0 x + g1) + f1
      let x0: Frac;
      do x0 = new Frac(rng.int(-12, 12), rng.pick([1, 1, 2]));
      while (!F(G(x0)).isInt());
      m = F(G(x0)).toNumber();
      answer = x0;
      stem = `If ${defs} for all values of $x$, for what value of $x$ does $f(g(x)) = ${num(m)}$?`;
      const a = f[0] * g[0];
      const b = f[0] * g[1] + f[1];
      explanation = `Build $f(g(x))$: replace $x$ in $f$ by $g(x)$: $f(g(x)) = ${times(f[0], poly(g))} ${f[1] < 0 ? '-' : '+'} ${Math.abs(f[1])} = ${poly([a, b])}$.

Solve $${poly([a, b])} = ${num(m)}$: $${lin([[a, 'x']])} = ${num(m - b)}$, so $x = ${x0.toTex()}${x0.isInt() ? '' : ` = ${x0.toDecimalString()}`}$.

Check: $g(${x0.toTex()}) = ${G(x0).toTex()}$ and $f(${G(x0).toTex()}) = ${num(m)}$.

Trap: solving $g(x) = ${num(m)}$ instead, which gives $x = ${new Frac(m - g[1], g[0]).toTex()}$, ignores $f$: the equation is about $f(g(x))$.`;
      const wrongInner = new Frac(m - g[1], g[0]); // solved g(x) = m instead
      if (!wrongInner.eq(answer) && wrongInner.isTerminating()) traps.push({ value: wrongInner, trap: 'alg-composition-inner-only' });
    }
    return {
      params: { kind, f, g, k, m },
      q: { format: 'ne', stem: stem!, answer: answer!, traps, explanation: explanation! },
    };
  },
  check(q, { kind, f, g, k, m }) {
    if (q.format !== 'ne') return 'wrong format';
    const F = (x: number) => horner(f, x);
    const G = (x: number) => horner(g, x);
    if (kind === 'solve') {
      const x = q.answer.toNumber();
      return close(F(G(x)), m, 1e-9) ? null : `f(g(${x})) = ${F(G(x))}, not ${m}`;
    }
    const v = kind === 'fg' ? F(G(k)) : kind === 'gf' ? G(F(k)) : F(F(k));
    return close(q.answer.toNumber(), v, 1e-9) ? null : `expected ${v}`;
  },
};

/** "3(-2)^{2} - 4(-2) + 1" : the polynomial with a value substituted. */
function substitute(c: number[], x: Frac): string {
  const deg = c.length - 1;
  const parts: string[] = [];
  c.forEach((a, i) => {
    if (a === 0) return;
    const p = deg - i;
    const xs = x.n < 0 || !x.isInt() ? `\\left(${x.toTex()}\\right)` : x.toTex();
    const body = p === 0 ? `${Math.abs(a)}` : `${Math.abs(a) === 1 ? '' : Math.abs(a)}${p === 1 ? xs : `${xs}^{${p}}`}`;
    const needsDot = p > 0 && Math.abs(a) !== 1 && !(x.n < 0 || !x.isInt());
    const b2 = needsDot ? `${Math.abs(a)} \\cdot ${p === 1 ? xs : `${xs}^{${p}}`}` : body;
    parts.push(parts.length === 0 ? (a < 0 ? '-' : '') + b2 : (a < 0 ? ' - ' : ' + ') + b2);
  });
  return parts.join('') || '0';
}

/* ================================================================== 2. Operations defined in the question (QC) */

/** Bivariate polynomial in a, b: [coef, power of a, power of b]. */
type BiPoly = [number, number, number][];

interface OpDef {
  sym: string;
  terms: BiPoly;
}

interface OpParams {
  op: BiPoly;
  kind: 'numeric' | 'variable';
  /** numeric: [p, q, r, s] for p*q vs r*s. variable: [c, side, lo, hi] with x*c (side 0) or c*x (side 1) vs c*x / number */
  k: number[];
  /** variable: condition interval (null = unbounded) and quantity B kind */
  lo: number | null;
  hi: number | null;
  bKind: 'swap' | 'number';
  bNum: number;
}

const evalOp = (t: BiPoly, a: number, b: number) => t.reduce((s, [c, i, j]) => s + c * a ** i * b ** j, 0);
const evalOpF = (t: BiPoly, a: Frac, b: Frac) => t.reduce((s: Frac, [c, i, j]) => s.add(a.pow(i).mul(b.pow(j)).mul(c)), new Frac(0));
/** The classic slip: (-3)^2 read as -3^2 = -9. */
const evalOpSlip = (t: BiPoly, a: number, b: number) =>
  t.reduce((s, [c, i, j]) => s + c * (a < 0 && i % 2 === 0 && i > 0 ? -(a ** i) : a ** i) * (b < 0 && j % 2 === 0 && j > 0 ? -(b ** j) : b ** j), 0);

const OPS: OpDef[] = [
  { sym: '\\diamond', terms: [[1, 2, 0], [-1, 1, 1]] }, // a^2 - ab
  { sym: '\\star', terms: [[1, 1, 1], [-1, 1, 0], [-1, 0, 1]] }, // ab - a - b
  { sym: '\\odot', terms: [[2, 1, 0], [-3, 0, 1]] }, // 2a - 3b
  { sym: '\\mathbin{\\#}', terms: [[1, 2, 1], [-1, 1, 2]] }, // a^2 b - a b^2
  { sym: '\\diamond', terms: [[1, 0, 2], [-2, 1, 0]] }, // b^2 - 2a
];

function biTex(t: BiPoly, a: string, b: string): string {
  const pw = (v: string, p: number) => (p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`);
  return t
    .map(([c, i, j], idx) => {
      const body = `${Math.abs(c) === 1 && i + j > 0 ? '' : Math.abs(c)}${pw(a, i)}${pw(b, j)}`;
      return idx === 0 ? (c < 0 ? '-' : '') + body : (c < 0 ? ' - ' : ' + ') + body;
    })
    .join('');
}

function biSub(t: BiPoly, a: number, b: number): string {
  const pw = (v: number, p: number) => (p === 0 ? '' : p === 1 ? `(${num(v)})` : `(${num(v)})^{${p}}`);
  return t
    .map(([c, i, j], idx) => {
      const coef = Math.abs(c) === 1 ? '' : `${Math.abs(c)}`;
      const body = `${coef}${pw(a, i)}${pw(b, j)}`;
      return idx === 0 ? (c < 0 ? '-' : '') + body : (c < 0 ? ' - ' : ' + ') + body;
    })
    .join('');
}

/** Polynomial in x (coefficients by power, index = power) from substituting x and a constant. */
function opPolyX(t: BiPoly, xFirst: boolean, c: number): number[] {
  const out = [0, 0, 0, 0];
  for (const [co, i, j] of t) {
    const px = xFirst ? i : j;
    const pc = xFirst ? j : i;
    out[px] += co * c ** pc;
  }
  return out;
}

const operationQC: Template<OpParams> = {
  id: 'alg.functions.operation-qc',
  skill: 'alg.functions',
  format: 'qc',
  style: 'operation defined by a formula',
  generate(rng, d) {
    const opIdx = rng.int(0, OPS.length - 1);
    const op = OPS[opIdx];
    const kind: OpParams['kind'] = d === 1 ? 'numeric' : rng.pick(['numeric', 'variable', 'variable']);
    const s = op.sym;
    const def = `For all numbers $a$ and $b$, the operation $${s}$ is defined by $a ${s} b = ${biTex(op.terms, 'a', 'b')}$.`;
    let info: string;
    let A: string;
    let B: string;
    let answer: QCChoice;
    const traps: QCQuestion['traps'] = {};
    let explanation: string;
    let k: number[];
    let lo: number | null = null;
    let hi: number | null = null;
    let bKind: OpParams['bKind'] = 'swap';
    let bNum = 0;
    if (kind === 'numeric') {
      const p = intExcept(rng, -5, 6, 0);
      let q = intExcept(rng, -5, 6, 0, p);
      if (opIdx === 0 && rng.chance(0.3)) q = -p; // the equal case for a^2 - ab
      let r = q;
      let sv = p;
      if (rng.chance(0.3)) {
        r = intExcept(rng, -5, 6, 0);
        sv = intExcept(rng, -5, 6, 0);
      }
      k = [p, q, r, sv];
      const vA = evalOpF(op.terms, frac(p), frac(q));
      const vB = evalOpF(op.terms, frac(r), frac(sv));
      answer = qcCompare(vA, vB);
      info = def;
      A = `$${paren(p)} ${s} ${paren(q)}$`;
      B = `$${paren(r)} ${s} ${paren(sv)}$`;
      const slip = qcCompare(new Frac(evalOpSlip(op.terms, p, q)), new Frac(evalOpSlip(op.terms, r, sv)));
      if (slip !== answer) traps[slip] = 'alg-substitute-negative';
      if (r === q && sv === p && answer !== 'C' && !traps.C) traps.C = 'alg-assumed-commutative';
      explanation = `Substitute carefully, keeping negative numbers in parentheses.

Quantity A: $${paren(p)} ${s} ${paren(q)} = ${biSub(op.terms, p, q)} = ${num(vA)}$.

Quantity B: $${paren(r)} ${s} ${paren(sv)} = ${biSub(op.terms, r, sv)} = ${num(vB)}$.

${qcEnd(answer)}`;
    } else {
      const c = intExcept(rng, -4, 5, 0);
      const xFirst = rng.chance(0.5);
      const polyA = opPolyX(op.terms, xFirst, c);
      bKind = rng.chance(0.6) ? 'swap' : 'number';
      const polyB = bKind === 'swap' ? opPolyX(op.terms, !xFirst, c) : [0, 0, 0, 0];
      // condition
      const condKind = rng.pick(['gt', 'lt', 'between', 'none'] as const);
      // P(x) = A - B ; roots
      if (bKind === 'number') {
        // choose B as A's value at a random point so that the comparison is interesting
        const x0 = intExcept(rng, -4, 5, 0);
        bNum = horner([...polyA].reverse(), x0) + rng.pick([0, 0, 1, -1]);
        polyB[0] = bNum;
      }
      const P = polyA.map((v, i) => v - polyB[i]);
      const roots = realRoots(P);
      const crit = [...roots].sort((u, v) => u - v);
      if (condKind === 'gt') {
        const r = crit.length ? rng.pick(crit) : rng.int(-3, 3);
        lo = rng.pick([Math.floor(r) - 1, Math.ceil(r), Math.ceil(r) + 1]);
      } else if (condKind === 'lt') {
        const r = crit.length ? rng.pick(crit) : rng.int(-3, 3);
        hi = rng.pick([Math.ceil(r) + 1, Math.floor(r), Math.floor(r) - 1]);
      }
      else if (condKind === 'between') {
        lo = rng.int(-4, 2);
        hi = lo + rng.int(1, 4);
      }
      const inside = crit.filter((r) => (lo === null || r > lo + 1e-12) && (hi === null || r < hi - 1e-12));
      const isZero = P.every((v) => v === 0);
      if (isZero) answer = 'C';
      else if (inside.length) answer = 'D';
      else {
        // any interior point decides
        // no root inside the allowed values: any allowed point decides
        const pt = lo !== null && hi !== null ? (lo + hi) / 2 : lo !== null ? lo + 0.5 : hi !== null ? hi - 0.5 : 0.5;
        const val = horner([...P].reverse(), pt);
        answer = val > 0 ? 'A' : val < 0 ? 'B' : 'D';
      }
      k = [c, xFirst ? 0 : 1];
      const condText = lo !== null && hi !== null ? `$${num(lo)} < x < ${num(hi)}$` : lo !== null ? `$x > ${num(lo)}$` : hi !== null ? `$x < ${num(hi)}$` : '';
      info = condText ? `${def}\n\n${condText}` : def;
      const xExpr = xFirst ? `x ${s} ${paren(c)}` : `${paren(c)} ${s} x`;
      A = `$${xExpr}$`;
      const swapExpr = xFirst ? `${paren(c)} ${s} x` : `x ${s} ${paren(c)}`;
      B = bKind === 'swap' ? `$${swapExpr}$` : `$${num(bNum)}$`;
      if (answer === 'D') traps.A = 'tested-one-value';
      else if (answer !== 'C') traps.D = 'alg-qc-variable-d';
      if (bKind === 'swap' && answer !== 'C' && !traps.C) traps.C = 'alg-assumed-commutative';
      const pa = poly([polyA[3], polyA[2], polyA[1], polyA[0]]);
      const pb = bKind === 'swap' ? poly([polyB[3], polyB[2], polyB[1], polyB[0]]) : num(bNum);
      const pd0 = poly([P[3], P[2], P[1], P[0]]);
      const intRoots = P[3] === 0 && P[2] !== 0 && roots.length === 2 && roots.every((r) => Number.isInteger(r));
      const pd = intRoots ? `${pd0} = ${P[2] === 1 ? '' : P[2] === -1 ? '-' : P[2]}${[...roots].sort((u, w) => (u === 0 ? -1 : w === 0 ? 1 : u - w)).map((r) => (r === 0 ? 'x' : `(x ${r > 0 ? '-' : '+'} ${Math.abs(r)})`)).join('')}` : pd0;
      const critText = inside.length
        ? dExample(P, lo, hi)
        : isZero
          ? 'The difference is 0 for every $x$.'
          : `${crit.length ? `The difference is 0 only at $x = ${crit.map(fmtRoot).join('$ and $x = ')}$, outside the allowed values` : 'The difference is never 0'}, so its sign is the same for every allowed $x$: it is ${answer === 'A' ? 'positive' : 'negative'}.`;
      explanation = `Apply the definition with $a$ and $b$ replaced by what is on each side of $${s}$. Quantity A: $${xExpr} = ${pa}$. Quantity B: ${bKind === 'swap' ? `$${swapExpr} = ${pb}$` : `$${pb}$`}.

Quantity A minus Quantity B is $${pd}$. ${critText} ${qcEnd(answer)}`;
    }
    return {
      params: { op: op.terms, kind, k: k!, lo, hi, bKind, bNum },
      q: { format: 'qc', info: info!, quantityA: A!, quantityB: B!, answer: answer!, traps: Object.keys(traps).length ? traps : undefined, explanation: explanation! },
    };
  },
  check(q, { op, kind, k, lo, hi, bKind, bNum }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    if (kind === 'numeric') {
      const [p, qq, r, s] = k;
      const expected = qcSamples([[evalOp(op, p, qq), evalOp(op, r, s)]]);
      return q.answer === expected ? null : `expected ${expected}`;
    }
    const [c, side] = k;
    // Exact rational samples: integers, simple fractions, and a fine grid next to each bound.
    const xs: Frac[] = [];
    for (let n = -40; n <= 40; n++) for (const dd of [1, 2, 3, 4, 7]) xs.push(new Frac(n, dd));
    for (const b of [lo, hi]) if (b !== null) for (let j = -2000; j <= 2000; j++) xs.push(new Frac(b * 200 + j, 200));
    for (let j = 0; j < 100; j++) xs.push(new Frac(Math.round((rng.next() * 2 - 1) * 1e6), 1000));
    const ok = (x: Frac) => (lo === null || x.gt(lo)) && (hi === null || x.lt(hi));
    const seen = new Set<QCChoice>();
    for (const x of xs.filter(ok)) {
      const a = side === 0 ? evalOpF(op, x, frac(c)) : evalOpF(op, frac(c), x);
      const b = bKind === 'number' ? frac(bNum) : side === 0 ? evalOpF(op, frac(c), x) : evalOpF(op, x, frac(c));
      seen.add(qcCompare(a, b));
    }
    const expected: QCChoice = seen.size === 1 ? [...seen][0] : 'D';
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/** Two allowed values of x that compare differently (for a D explanation). */
function dExample(P: number[], lo: number | null, hi: number | null): string {
  const cands: Frac[] = [];
  for (let n = -24; n <= 24; n++) cands.push(new Frac(n, 2));
  for (let n = -60; n <= 60; n++) cands.push(new Frac(n, 10));
  for (const b of [lo, hi]) if (b !== null) for (let j = -100; j <= 100; j++) cands.push(new Frac(b * 100 + j, 100));
  const ok = cands
    .filter((x) => (lo === null || x.gt(lo)) && (hi === null || x.lt(hi)))
    .sort((u, w) => u.d - w.d || u.abs().cmp(w.abs())); // simple values first
  const val = (x: Frac) => hornerF([P[3], P[2], P[1], P[0]], x);
  const sign = (x: Frac) => val(x).sign();
  const first = ok.find((x) => sign(x) !== 0)!;
  const second = ok.find((x) => sign(x) !== sign(first))!;
  const word = (x: Frac) => (sign(x) > 0 ? 'so Quantity A is greater' : sign(x) < 0 ? 'so Quantity B is greater' : 'so the quantities are equal');
  return `For example, at $x = ${first.toTex()}$ the difference is $${num(val(first))}$, ${word(first)}; but at $x = ${second.toTex()}$ it is $${num(val(second))}$, ${word(second)}.`;
}

/** Real roots of a polynomial of degree <= 2 given by coefficients indexed by power. */
function realRoots(P: number[]): number[] {
  const [c0, c1, c2, c3] = P;
  if (c3 !== 0) throw new Error('degree 3 not supported');
  if (c2 === 0) return c1 === 0 ? [] : [-c0 / c1];
  const disc = c1 * c1 - 4 * c2 * c0;
  if (disc < 0) return [];
  if (disc === 0) return [-c1 / (2 * c2)];
  return [(-c1 - Math.sqrt(disc)) / (2 * c2), (-c1 + Math.sqrt(disc)) / (2 * c2)];
}

function fmtRoot(r: number): string {
  for (const dd of [1, 2, 3, 4, 5, 6]) {
    const n = Math.round(r * dd);
    if (Math.abs(n / dd - r) < 1e-9) return new Frac(n, dd).toTex();
  }
  return num(Math.round(r * 100) / 100);
}

/* ================================================================== 3. Functions given by a table (MCS) */

interface TableParams {
  kind: 'compose' | 'linear' | 'formula';
  xs: number[];
  fs: number[];
  gs: number[];
  k: number;
  values: number[];
  formulas: Ex[];
}

const tableMCS: Template<TableParams> = {
  id: 'alg.functions.table-mcs',
  skill: 'alg.functions',
  format: 'mcs',
  style: 'read a function from a table',
  generate(rng, d) {
    for (;;) {
      const kind: TableParams['kind'] = rng.pick(d === 1 ? ['compose', 'linear'] : ['compose', 'linear', 'formula']);
      if (kind === 'compose') {
        const xs = [1, 2, 3, 4, 5];
        let fs: number[];
        let gs: number[];
        let k: number;
        do {
          fs = xs.map(() => rng.int(1, 5));
          gs = xs.map(() => rng.int(1, 5));
          k = rng.pick(xs);
        } while (fs[gs[k - 1] - 1] === gs[fs[k - 1] - 1] || new Set(fs).size < 3 || new Set(gs).size < 3);
        const inner = gs[k - 1];
        const answer = fs[inner - 1];
        const other = gs[fs[k - 1] - 1];
        const fk = fs[k - 1];
        const wrongs = [
          { value: other, trap: 'alg-composition-order', why: `computing $g(f(${k}))$ instead of $f(g(${k}))$` },
          { value: fk, trap: 'alg-composition-inner-only', why: `reading only $f(${k})$ and skipping $g$` },
          { value: inner, trap: 'alg-composition-inner-only', why: `stopping at $g(${k})$ without applying $f$` },
          { value: fk * inner, trap: 'alg-composition-product', why: `multiplying $f(${k})$ by $g(${k})$` },
          { value: fk + inner, trap: 'alg-composition-product', why: `adding $f(${k})$ and $g(${k})$` },
          { value: fs[fk - 1], trap: 'alg-composition-same-function', why: `applying $f$ twice, $f(f(${k}))$` },
          { value: gs[inner - 1], trap: 'alg-composition-same-function', why: `applying $g$ twice, $g(g(${k}))$` },
        ];
        const res = trapChoices(rng, answer, wrongs, (v) => `$${v.n}$`);
        if (!res) continue;
        const cited = res.kept[0];
        return {
          params: { kind, xs, fs, gs, k, values: res.values.map((v) => v.n), formulas: [] },
          q: {
            format: 'mcs',
            figure: { kind: 'table', headers: ['$x$', '$f(x)$', '$g(x)$'], rows: xs.map((x, i) => [`$${x}$`, `$${fs[i]}$`, `$${gs[i]}$`]) },
            stem: `The table shows some values of the functions $f$ and $g$. What is the value of $f(g(${k}))$?`,
            choices: res.choices,
            answer: res.answer,
            explanation: `A composition is read from the inside out: the output of $g$ becomes the input of $f$. In the row $x = ${k}$, $g(${k}) = ${inner}$. Then in the row $x = ${inner}$, $f(${inner}) = ${answer}$.

Check the order: $f(g(${k}))$ uses the $g$ column first, then the $f$ column.

Trap: $${cited.value.n}$ comes from ${cited.why}. The question asks for $f(g(${k})) = f(${inner}) = ${answer}$.

Rule: apply the inner function first and look its result up as the next input.`,
          },
        };
      }
      if (kind === 'linear') {
        const m = intExcept(rng, -5, 6, 0);
        const b = intExcept(rng, -9, 12, 0);
        if (m === 1 && b === 0) continue;
        const start = rng.int(-2, 3);
        const step = rng.pick([1, 2, 3]);
        const xs = [0, 1, 2].map((i) => start + i * step);
        const fs = xs.map((x) => m * x + b);
        const k = xs[2] + step * rng.int(2, 6);
        const answer = m * k + b;
        const x1 = xs.find((x) => x !== 0) ?? xs[1];
        const prop = new Frac(m * x1 + b, x1).mul(k);
        const wrongs: { value: Frac; trap: string; why: string }[] = [
          { value: prop, trap: 'alg-linear-as-proportional', why: `treating $f$ as proportional: $f(${num(x1)}) = ${num(m * x1 + b)}$ scaled up to $x = ${k}$` },
          { value: frac(m * k), trap: 'alg-forgot-intercept', why: `using the slope ${num(m)} but forgetting the constant $${num(b)}$` },
          { value: frac(b * k + m), trap: 'alg-swapped-coefficients', why: `swapping the slope and the constant` },
          { value: frac(m * k - b), trap: 'alg-sign-slip', why: `losing the sign of the constant $${num(b)}$` },
        ];
        if (step > 1) wrongs.push({ value: frac(fs[2] + (fs[2] - fs[1]) * (k - xs[2])), trap: 'alg-step-count', why: `adding the change per table step ${num(fs[2] - fs[1])} once for every unit of $x$` });
        const res = trapChoices(rng, answer, wrongs, (v) => `$${v.toTex()}$`);
        if (!res) continue;
        const cited = res.kept[0];
        const slopeTex = step === 1 ? `${num(fs[1] - fs[0])}` : `\\frac{${num(fs[1] - fs[0])}}{${step}} = ${num(m)}`;
        return {
          params: { kind, xs, fs, gs: [], k, values: res.values.map((v) => v.toNumber()), formulas: [] },
          q: {
            format: 'mcs',
            figure: { kind: 'table', headers: ['$x$', '$f(x)$'], rows: xs.map((x, i) => [`$${num(x)}$`, `$${num(fs[i])}$`]) },
            stem: `The table shows three values of a linear function $f$. What is the value of $f(${k})$?`,
            choices: res.choices,
            answer: res.answer,
            explanation: `A linear function changes by the same amount for each equal step in $x$. From $x = ${num(xs[0])}$ to $x = ${num(xs[1])}$, $f$ changes by $${num(fs[1] - fs[0])}$ over ${step} unit${step > 1 ? 's' : ''}, so the slope is $${slopeTex}$, and $f(x) = ${poly([m, b])}$.

Check: $f(${num(xs[2])}) = ${num(fs[2])}$. Then $f(${k}) = ${substitute([m, b], frac(k))} = ${num(answer)}$.

Trap: $${cited.value.toTex()}$ comes from ${cited.why}. The constant $${num(b)}$ is not zero, so $f$ is not proportional.

Rule: find the slope, then the constant, then substitute.`,
          },
        };
      }
      // formula: which rule fits the table
      const quadratic = rng.chance(0.5);
      const a = intExcept(rng, -3, 4, 0);
      const c = intExcept(rng, -6, 6, 0);
      const xs = quadratic ? [0, 1, 2, 3].slice(rng.int(0, 1), undefined).slice(0, 3) : [1, 2, 3];
      const truth = quadratic ? polyEx([a, 0, c]) : polyEx([a, c]);
      const fs = xs.map((x) => evalEx(truth, { x }));
      const f0 = fs[0];
      const x0 = xs[0];
      // wrong rules that fit the first row (or the first two rows) only
      const cands: { e: Ex; trap: string }[] = [];
      const lineThrough = (slope: number) => polyEx([slope, f0 - slope * x0]);
      const quadThrough = (lead: number) => polyEx([lead, 0, f0 - lead * x0 * x0]);
      if (quadratic) {
        cands.push({ e: lineThrough(a * (x0 + xs[1])), trap: 'alg-matched-one-row' });
        cands.push({ e: quadThrough(a + 1), trap: 'alg-matched-one-row' });
        cands.push({ e: quadThrough(-a), trap: 'alg-matched-one-row' });
        cands.push({ e: quadThrough(a - 1), trap: 'alg-matched-one-row' });
        cands.push({ e: lineThrough(a + 2), trap: 'alg-matched-one-row' });
        cands.push({ e: polyEx([a, 0, 0]), trap: 'alg-forgot-intercept' });
      } else {
        cands.push({ e: lineThrough(a + 1), trap: 'alg-matched-one-row' });
        cands.push({ e: lineThrough(a - 1), trap: 'alg-matched-one-row' });
        if (x0 !== 0) cands.push({ e: polyEx([new Frac(f0, x0), 0]), trap: 'alg-linear-as-proportional' });
        cands.push({ e: polyEx([a, 0]), trap: 'alg-forgot-intercept' });
        cands.push({ e: quadThrough(1), trap: 'alg-matched-one-row' });
        cands.push({ e: lineThrough(-a), trap: 'alg-matched-one-row' });
      }
      const seen = new Set([texEx(truth)]);
      const wrong = rng.shuffle(cands).filter((w) => {
        const t = texEx(w.e);
        if (seen.has(t)) return false;
        if (xs.every((x) => close(evalEx(w.e, { x }), evalEx(truth, { x })))) return false;
        if (/\\frac/.test(t)) return false;
        seen.add(t);
        return true;
      });
      if (wrong.length < 4) continue;
      const { choices, answer } = textChoices(
        rng,
        `$f(x) = ${texEx(truth)}$`,
        wrong.slice(0, 4).map((w) => ({ text: `$f(x) = ${texEx(w.e)}$`, trap: w.trap })),
      );
      const all = [truth, ...wrong.slice(0, 4).map((w) => w.e)];
      const formulas = choices.map((ch: Choice) => all.find((e) => `$f(x) = ${texEx(e)}$` === ch.text)!);
      const w0 = wrong[0];
      const badRow = xs.slice(1).find((x) => !close(evalEx(w0.e, { x }), evalEx(truth, { x })))!;
      return {
        params: { kind, xs, fs, gs: [], k: 0, values: [], formulas },
        q: {
          format: 'mcs',
          figure: { kind: 'table', headers: ['$x$', '$f(x)$'], rows: xs.map((x, i) => [`$${num(x)}$`, `$${num(fs[i])}$`]) },
          stem: 'The table shows three values of the function $f$. Which of the following could define $f$?',
          choices,
          answer,
          explanation: `A rule must fit EVERY row of the table, so test each choice on all the rows. Several choices fit the first row; only $f(x) = ${texEx(truth)}$ also gives ${xs
            .slice(1)
            .map((x, i) => `$f(${num(x)}) = ${num(fs[i + 1])}$`)
            .join(' and ')}.

Check: ${xs.map((x) => `$f(${num(x)}) = ${num(evalEx(truth, { x }))}$`).join(', ')}.

Trap: $f(x) = ${texEx(w0.e)}$ comes from ${w0.trap === 'alg-linear-as-proportional' ? 'treating the function as proportional' : w0.trap === 'alg-forgot-intercept' ? 'dropping the constant' : 'matching the first row only'}. It gives $f(${num(badRow)}) = ${num(evalEx(w0.e, { x: badRow }))}$, not $${num(evalEx(truth, { x: badRow }))}$.

Rule: one matching row proves nothing; a rule must fit all of them.`,
        },
      };
    }
  },
  check(q, { kind, xs, fs, gs, k, values, formulas }) {
    if (q.format !== 'mcs') return 'wrong format';
    const rows = (q.figure as { rows: string[][] }).rows.map((r) => r.map((cell) => parseNum(cell)));
    if (rows.some((r, i) => r[0] !== xs[i] || r[1] !== fs[i])) return 'table mismatch';
    let hits: number[];
    if (kind === 'compose') {
      const look = (col: number, x: number) => rows.find((r) => r[0] === x)?.[col];
      const inner = look(2, k)!;
      const truth = look(1, inner);
      hits = values.flatMap((v, i) => (v === truth ? [i] : []));
      void gs;
    } else if (kind === 'linear') {
      // slope and intercept from the LAST two rows
      const [xa, fa] = rows[1];
      const [xb, fb] = rows[2];
      const slope = (fb - fa) / (xb - xa);
      const truth = fb + slope * (k - xb);
      hits = values.flatMap((v, i) => (close(v, truth) ? [i] : []));
    } else {
      hits = formulas.flatMap((e, i) => (rows.every(([x, y]) => close(evalEx(e, { x }), y)) ? [i] : []));
    }
    if (hits.length !== 1) return `${hits.length} matching choices`;
    return hits[0] === q.answer ? null : `expected ${hits[0]}`;
  },
};

function parseNum(t: string): number {
  const s = t.replace(/\$/g, '').replace(/\{,\}/g, '');
  const m = /^(-?)\\frac\{(\d+)\}\{(\d+)\}$/.exec(s);
  if (m) return ((m[1] ? -1 : 1) * Number(m[2])) / Number(m[3]);
  return Number(s);
}

/* ================================================================== 4. Function defined by a property (NE) */

interface PropParams {
  kind: 'periodic' | 'step' | 'growth' | 'transformed';
  k: number[];
}

const propertyNE: Template<PropParams> = {
  id: 'alg.functions.property-ne',
  skill: 'alg.functions',
  format: 'ne',
  style: 'function given by a property or a transformed input',
  generate(rng, d) {
    for (;;) {
      const kind: PropParams['kind'] = rng.pick(d === 1 ? ['periodic', 'step'] : d === 2 ? ['step', 'growth', 'transformed', 'periodic'] : ['transformed', 'step', 'transformed', 'growth']);
      let stem: string;
      let explanation: string;
      let answer: number;
      let k: number[];
      const traps: { value: Frac; trap: string }[] = [];
      if (kind === 'periodic') {
        const p = rng.int(1, 4);
        const a = rng.int(-5, 6);
        const n = rng.int(3, 12);
        const b = a + p * n;
        const v = intExcept(rng, -9, 15, 0);
        answer = v;
        k = [p, a, b, v];
        stem = `For every number $x$, the function $f$ satisfies $f(x) = f(x + ${p})$. If $f(${num(a)}) = ${num(v)}$, what is $f(${num(b)})$?`;
        explanation = `The property says the value of $f$ repeats every ${p} unit${p > 1 ? 's' : ''}: $f(${num(a)}) = f(${num(a + p)}) = f(${num(a + 2 * p)}) = \\cdots$. Since $${num(b)} = ${num(a)} + ${p} \\cdot ${n}$, you reach $${num(b)}$ after ${n} steps, so $f(${num(b)}) = ${num(v)}$.`;
        traps.push({ value: frac(v + (b - a)), trap: 'alg-step-count' });
      } else if (kind === 'step') {
        const p = rng.pick(d === 1 ? [1, 2] : [2, 3, 4]);
        const c = intExcept(rng, -6, 7, 0);
        const a = rng.int(-4, 6);
        const n = rng.int(3, 9);
        const b = a + p * n;
        const v = rng.int(-10, 15);
        answer = v + c * n;
        k = [p, c, a, b, v];
        stem = `For every number $x$, the function $f$ satisfies $f(x + ${p}) = f(x) ${c < 0 ? '-' : '+'} ${Math.abs(c)}$. If $f(${num(a)}) = ${num(v)}$, what is $f(${num(b)})$?`;
        explanation = `Each increase of ${p} in $x$ ${c > 0 ? 'adds' : 'subtracts'} ${Math.abs(c)}. From $x = ${num(a)}$ to $x = ${num(b)}$ the input increases by $${b - a} = ${p} \\cdot ${n}$, which is ${n} steps.

So $f(${num(b)}) = ${num(v)} ${c < 0 ? '-' : '+'} ${n} \\cdot ${Math.abs(c)} = ${num(answer)}$.${p > 1 ? ` Counting ${b - a} steps instead of ${n} gives $${num(v + c * (b - a))}$.` : ''}`;
        if (p > 1) traps.push({ value: frac(v + c * (b - a)), trap: 'alg-step-count' });
      } else if (kind === 'growth') {
        const r = rng.pick([2, 3, -2]);
        const a = rng.int(-3, 4);
        const n = rng.int(2, r === 3 ? 4 : 5);
        const v = rng.int(1, 6);
        answer = v * r ** n;
        k = [r, a, n, v];
        stem = `For every number $x$, the function $f$ satisfies $f(x + 1) = ${num(r)}f(x)$. If $f(${num(a)}) = ${v}$, what is $f(${num(a + n)})$?`;
        explanation = `Each increase of 1 in $x$ multiplies the value by $${num(r)}$. Going from $x = ${num(a)}$ to $x = ${num(a + n)}$ takes ${n} steps, so $f(${num(a + n)}) = ${v} \\cdot ${paren(r)}^{${n}} = ${num(answer)}$.`;
        traps.push({ value: frac(v * r * n), trap: 'alg-growth-linear' });
      } else {
        // f((x + h)/m) = x^2 + e  ->  f(t) with x = m t - h
        const m = rng.pick([2, 3]);
        const h = intExcept(rng, -5, 5, 0);
        const e = rng.int(-9, 9);
        const t = intExcept(rng, -3, 5, 0);
        const x0 = m * t - h;
        const quad = rng.chance(0.6);
        const lin2 = rng.int(2, 5);
        answer = quad ? x0 * x0 + e : lin2 * x0 + e;
        k = [m, h, e, t, quad ? 1 : 0, lin2];
        const rule = quad ? poly([1, 0, e]) : poly([lin2, e]);
        const input = `\\dfrac{x ${h < 0 ? '-' : '+'} ${Math.abs(h)}}{${m}}`;
        stem = `The function $f$ is defined by $f\\left(${input}\\right) = ${rule}$ for all numbers $x$. What is the value of $f(${num(t)})$?`;
        explanation = `Find the $x$ that makes the input equal to $${num(t)}$: $${input} = ${num(t)}$ gives $x = ${m}(${num(t)}) ${h < 0 ? '+' : '-'} ${Math.abs(h)} = ${num(x0)}$.

Then $f(${num(t)}) = ${quad ? `${paren(x0)}^2` : `${lin2}(${num(x0)})`}${e === 0 ? '' : ` ${e < 0 ? '-' : '+'} ${Math.abs(e)}`} = ${num(answer)}$. Substituting $${num(t)}$ directly into $${rule}$ is the trap: the rule is written for the variable $x$, not for the input of $f$.`;
        const direct = quad ? t * t + e : lin2 * t + e;
        traps.push({ value: frac(direct), trap: 'alg-substitute-directly' });
      }
      // a wrong-method value that equals the right answer would make the question degenerate: draw again
      if (traps.some((tr) => tr.value.eq(answer!))) continue;
      return {
        params: { kind, k: k! },
        q: { format: 'ne', stem: stem!, answer: frac(answer!), traps, explanation: explanation! },
      };
    }
  },
  check(q, { kind, k }) {
    if (q.format !== 'ne') return 'wrong format';
    let value: number;
    if (kind === 'periodic') {
      const [p, a, b, v] = k;
      let x = a;
      while (x < b) x += p; // f(x + p) = f(x): the value is carried along unchanged
      if (x !== b) return 'b not reachable';
      value = v;
    } else if (kind === 'step') {
      const [p, c, a, b, v] = k;
      let x = a;
      let fx = v;
      while (x < b) {
        x += p;
        fx += c;
      }
      if (x !== b) return 'b not reachable';
      value = fx;
    } else if (kind === 'growth') {
      const [r, , n, v] = k;
      let fx = v;
      for (let i = 0; i < n; i++) fx *= r;
      value = fx;
    } else {
      const [m, h, e, t, quad, lin2] = k;
      // solve (x + h)/m = t by bisection
      let lo = -1000;
      let hi = 1000;
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if ((mid + h) / m < t) lo = mid;
        else hi = mid;
      }
      const x = (lo + hi) / 2;
      value = quad ? x * x + e : lin2 * x + e;
    }
    return close(q.answer.toNumber(), value, 1e-9) ? null : `expected ${value}`;
  },
};

/* ================================================================== 5. Odd and even functions (MCM) */

type Parity = 'odd' | 'even' | 'neither';

interface ParityParams {
  want: 'odd' | 'even';
  fns: Ex[];
}

function parityFamily(rng: Parameters<Template['generate']>[0]): { e: Ex; neg: string; parity: Parity }[] {
  const x = V('x');
  const k = rng.int(1, 5);
  const m = rng.int(1, 6);
  const kx = (p: number) => {
    const xp = p === 1 ? x : pow(x, p);
    return k === 1 ? xp : mul(N(k), xp);
  };
  return [
    { e: add(pow(x, 3), k === 1 ? x : mul(N(k), x)), neg: `-x^{3} - ${k === 1 ? '' : k}x`, parity: 'odd' },
    { e: div(k === 1 ? x : mul(N(k), x), add(pow(x, 2), N(m))), neg: `\\dfrac{-${k === 1 ? '' : k}x}{x^{2} + ${m}}`, parity: 'odd' },
    { e: mul(x, abs(x)), neg: `(-x)|-x| = -x|x|`, parity: 'odd' },
    { e: add(pow(x, 5), mul(N(-k), pow(x, 3))), neg: `-x^{5} + ${k === 1 ? '' : k}x^{3}`, parity: 'odd' },
    { e: add(pow(x, 4), mul(N(-k), pow(x, 2))), neg: `x^{4} - ${k === 1 ? '' : k}x^{2}`, parity: 'even' },
    { e: div(N(k), add(pow(x, 2), N(m))), neg: `\\dfrac{${k}}{x^{2} + ${m}}`, parity: 'even' },
    { e: add(pow(x, 2), mul(N(k), abs(x))), neg: `x^{2} + ${k === 1 ? '' : k}|x|`, parity: 'even' },
    { e: add(pow(x, 3), N(k)), neg: `-x^{3} + ${k}`, parity: 'neither' },
    { e: pow(add(x, N(k)), 2), neg: `(-x + ${k})^{2} = (x - ${k})^{2}`, parity: 'neither' },
    { e: add(pow(x, 2), kx(1)), neg: `x^{2} - ${k === 1 ? '' : k}x`, parity: 'neither' },
    { e: add(pow(x, 3), mul(N(-1), pow(x, 2))), neg: `-x^{3} - x^{2}`, parity: 'neither' },
  ];
}

const symmetryMCM: Template<ParityParams> = {
  id: 'alg.functions.symmetry-mcm',
  skill: 'alg.functions',
  format: 'mcm',
  style: 'which functions satisfy f(−x) = −f(x) or f(−x) = f(x)',
  generate(rng, d) {
    const want: ParityParams['want'] = d === 1 ? 'even' : rng.pick(['odd', 'odd', 'even']);
    const fam = parityFamily(rng);
    const good = rng.shuffle(fam.filter((f) => f.parity === want));
    const other = want === 'odd' ? 'even' : 'odd';
    const bad = rng.shuffle(fam.filter((f) => f.parity !== want));
    const nGood = rng.int(1, 3);
    const total = 5;
    // keep at least one of the opposite parity and one "neither" among the wrong choices
    const badPick = [bad.find((f) => f.parity === other)!, bad.find((f) => f.parity === 'neither')!, ...bad];
    const wrong: typeof fam = [];
    for (const f of badPick) if (wrong.length < total - nGood && !wrong.includes(f)) wrong.push(f);
    const picked = rng.shuffle([...good.slice(0, nGood), ...wrong]);
    const rel = want === 'odd' ? 'f(-x) = -f(x)' : 'f(-x) = f(x)';
    const { choices, answer } = flaggedChoices(
      picked.map((f) => ({
        text: `$f(x) = ${texEx(f.e)}$`,
        correct: f.parity === want,
        ...(f.parity === want ? {} : { trap: f.parity === 'neither' ? 'alg-parity-mixed' : 'alg-even-vs-odd' }),
      })),
    );
    const lines = picked
      .map((f) => {
        const verdict = f.parity === want ? 'yes' : 'no';
        const what = f.parity === 'odd' ? 'this is $-f(x)$' : f.parity === 'even' ? 'this is $f(x)$ itself' : 'this is neither $f(x)$ nor $-f(x)$';
        return `- $f(x) = ${texEx(f.e)}$: $f(-x) = ${f.neg}$; ${what}, so ${verdict}.`;
      })
      .join('\n');
    return {
      params: { want, fns: picked.map((f) => f.e) },
      q: {
        format: 'mcm',
        stem: `Which of the following functions $f$, defined for all numbers $x$, satisfy $${rel}$ for all $x$?`,
        instruction: 'Indicate all such functions.',
        choices,
        answer,
        explanation: `Replace $x$ by $-x$ in each formula and compare the result with $f(x)$. Odd powers change sign, even powers and $|x|$ do not.
${lines}

A single value can mislead: test the identity in general, not just at $x = 1$.`,
      },
    };
  },
  check(q, { want, fns }, rng) {
    if (q.format !== 'mcm') return 'wrong format';
    if (fns.some((e, i) => q.choices[i].text !== `$f(x) = ${texEx(e)}$`)) return 'choice text mismatch';
    const expected = fns.flatMap((e, i) => {
      for (let j = 0; j < 12; j++) {
        const x = rng.next() * 8 - 4;
        const a = evalEx(e, { x: -x });
        const b = evalEx(e, { x });
        if (!close(a, want === 'odd' ? -b : b, 1e-9)) return [];
      }
      return [i];
    });
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

export const functionTemplates = [composeNE, operationQC, tableMCS, propertyNE, symmetryMCM];
