import { flaggedChoices, qcCompare } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import type { Choice, QCQuestion, Template } from '../../../engine/types';
import { QC_WORDS, evalExpr, expectMcm, expectMcsBy, expectNe, expectQc, plainToTex, spreadChoices, substitute } from './util';

/* Every expression below exists twice: a plain string (parsed by evalExpr in check(), and used for
 * the trap values with the "mistaken" parser modes) and a JS function (used by generate()). The
 * tests compare the two on every seed. */

type V = Record<string, number>;
interface Expr {
  plain: string;
  f: (v: V) => Frac;
}

const F = (n: number) => frac(n);
const pw = (x: number, e: number) => frac(x).pow(e);

/* ------------------------------------------------------------------ 1. Substitute given values, compare (QC) */

interface SubstPair {
  A: Expr;
  B: Expr;
  /** trap id when a student "distributes" the power (A and B look equal) */
  distribute?: string;
}

function substPairs(n: number): SubstPair[] {
  return [
    {
      A: { plain: `(r-s)^${n}`, f: ({ r, s }) => pw(r - s, n) },
      B: { plain: `r^${n}-s^${n}`, f: ({ r, s }) => pw(r, n).sub(pw(s, n)) },
      distribute: 'int-distribute-power',
    },
    {
      A: { plain: '(r+s)^2', f: ({ r, s }) => pw(r + s, 2) },
      B: { plain: 'r^2+s^2', f: ({ r, s }) => pw(r, 2).add(pw(s, 2)) },
      distribute: 'square-of-sum',
    },
    {
      A: { plain: '(r+s)^3', f: ({ r, s }) => pw(r + s, 3) },
      B: { plain: 'r^3+s^3', f: ({ r, s }) => pw(r, 3).add(pw(s, 3)) },
      distribute: 'int-distribute-power',
    },
    {
      A: { plain: '-s^2', f: ({ s }) => pw(s, 2).neg() },
      B: { plain: '(-s)^2', f: ({ s }) => pw(-s, 2) },
    },
    {
      A: { plain: '(r*s)^2', f: ({ r, s }) => pw(r * s, 2) },
      B: { plain: 'r^2*s^2', f: ({ r, s }) => pw(r, 2).mul(pw(s, 2)) },
    },
    {
      A: { plain: 'r^2-s^2', f: ({ r, s }) => pw(r, 2).sub(pw(s, 2)) },
      B: { plain: '(r-s)^2', f: ({ r, s }) => pw(r - s, 2) },
      distribute: 'int-distribute-power',
    },
    {
      A: { plain: 's^3', f: ({ s }) => pw(s, 3) },
      B: { plain: '-s^2', f: ({ s }) => pw(s, 2).neg() },
    },
    {
      A: { plain: 'r-s^2', f: ({ r, s }) => F(r).sub(pw(s, 2)) },
      B: { plain: '(r-s)^2', f: ({ r, s }) => pw(r - s, 2) },
    },
  ];
}

interface SubstParams {
  r: number;
  s: number;
  plainA: string;
  plainB: string;
}

const substituteQC: Template<SubstParams> = {
  id: 'arith.order-of-operations.substitute-qc',
  skill: 'arith.order-of-operations',
  format: 'qc',
  style: 'substitute given values (with negatives) into power expressions, compare',
  generate(rng, diff) {
    for (;;) {
      const n = rng.pick(diff === 1 ? [2] : [2, 3, 4]);
      const pairs = substPairs(n);
      const pool = diff === 1 ? [pairs[1], pairs[3], pairs[4], pairs[6]] : diff === 2 ? pairs : [pairs[0], pairs[2], pairs[5], pairs[7], pairs[1]];
      const pair = rng.pick(pool);
      const r = rng.chance(diff === 3 ? 0.35 : 0.15) ? -rng.int(1, 6) : rng.int(1, 6);
      const s = -rng.int(1, 9);
      if (r === s) continue;
      const swap = rng.chance(0.5);
      const [EA, EB] = swap ? [pair.B, pair.A] : [pair.A, pair.B];
      const v = { r, s };
      const a = EA.f(v);
      const b = EB.f(v);
      if (Math.abs(a.toNumber()) > 1e6 || Math.abs(b.toNumber()) > 1e6) continue;
      const answer = qcCompare(a, b);
      // what the classic slips give
      const noParA = evalExpr(substitute(EA.plain, v, false));
      const noParB = evalExpr(substitute(EB.plain, v, false));
      const slip = qcCompare(noParA, noParB);
      const traps: QCQuestion['traps'] = {};
      if (slip !== answer) traps[slip] = 'int-no-parentheses';
      if (pair.distribute && answer !== 'C' && !traps.C) traps.C = pair.distribute;
      const em = /s\^(\d)/.exec(EA.plain + ' ' + EB.plain);
      const se = em ? Number(em[1]) : 0;
      const slipNote =
        slip !== answer && se % 2 === 0 && se > 0
          ? `\n\nWithout parentheses, $s^{${se}}$ would become $${s}^{${se}} = ${-(Math.abs(s) ** se)}$ instead of $(${s})^{${se}} = ${s ** se}$: the exponent applies before the minus sign.`
          : '';
      const show = (e: Expr) => {
        const withNums = plainToTex(substitute(e.plain, v));
        return `$${plainToTex(e.plain)} = ${withNums} = ${e.f(v).toTex()}$`;
      };
      return {
        params: { r, s, plainA: EA.plain, plainB: EB.plain },
        q: {
          format: 'qc',
          info: `$r = ${r}$ and $s = ${s}$`,
          quantityA: `$${plainToTex(EA.plain)}$`,
          quantityB: `$${plainToTex(EB.plain)}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `Substitute with parentheses around the negative values, then follow the order of operations (parentheses, exponents, then multiplication and subtraction).

- Quantity A: ${show(EA)}
- Quantity B: ${show(EB)}

${QC_WORDS[answer][0].toUpperCase()}${QC_WORDS[answer].slice(1)}. (${answer})${
            pair.distribute && answer !== 'C' ? `\n\nThe two expressions are not equal in general: a power does not distribute over a sum or difference.` : ''
          }${slipNote}`,
        },
      };
    }
  },
  check(q, { r, s, plainA, plainB }) {
    return expectQc(q, qcCompare(evalExpr(substitute(plainA, { r, s })), evalExpr(substitute(plainB, { r, s }))));
  },
};

/* ------------------------------------------------------------------ 2. Defined operations (MCS) */

interface OpDef {
  sym: string;
  plain: string;
  f: (a: number, b: number) => number;
  /** b can be solved for (linear in b with nonzero coefficient) */
  solvable?: boolean;
}

const OPS: OpDef[] = [
  { sym: '\\star', plain: 'a*b-a+b', f: (a, b) => a * b - a + b, solvable: true },
  { sym: '\\diamond', plain: 'a^2-b', f: (a, b) => a * a - b, solvable: true },
  { sym: '\\otimes', plain: '2*a-3*b', f: (a, b) => 2 * a - 3 * b, solvable: true },
  { sym: '\\oplus', plain: 'a^2-a*b', f: (a, b) => a * a - a * b, solvable: true },
  { sym: '\\odot', plain: '(a-b)^2+a', f: (a, b) => (a - b) ** 2 + a },
  { sym: '\\#', plain: 'a*b+b^2', f: (a, b) => a * b + b * b },
];

interface OpParams {
  op: number;
  kind: 'single' | 'left' | 'right' | 'solve';
  x: number;
  y: number;
  z: number;
  values: number[];
}

const opValue = (op: OpDef, a: number, b: number) => evalExpr(substitute(op.plain, { a, b }));

const customOperation: Template<OpParams> = {
  id: 'arith.order-of-operations.custom-operation',
  skill: 'arith.order-of-operations',
  format: 'mcs',
  style: 'evaluate a newly defined operation (nested, with negatives)',
  generate(rng, diff) {
    for (;;) {
      const kind: OpParams['kind'] = diff === 1 ? 'single' : diff === 2 ? rng.pick(['left', 'right'] as const) : rng.pick(['right', 'solve', 'left'] as const);
      const opIdx = rng.int(0, OPS.length - 1);
      const op = OPS[opIdx];
      if (kind === 'solve' && !op.solvable) continue;
      const x = rng.int(-5, 5) || 2;
      const y = rng.int(-5, 5) || -3;
      const z = rng.int(-4, 5) || 1;
      if (x === y) continue;
      if (x >= 0 && y >= 0) continue; // keep a negative input
      let answer: number;
      let expr: string;
      const traps: { v: number; trap?: string }[] = [];
      let work: string;
      const def = plainToTex(op.plain);
      const app = (a: number, b: number) => op.f(a, b);
      const P = (n: number) => (n < 0 ? `(${n})` : `${n}`);
      const showApp = (a: number, b: number) => `${P(a)} ${op.sym} ${P(b)} = ${plainToTex(substitute(op.plain, { a, b }))} = ${app(a, b)}`;
      if (kind === 'single') {
        answer = app(x, y);
        expr = `${P(x)} ${op.sym} ${P(y)}`;
        traps.push({ v: app(y, x), trap: 'int-operation-swapped' });
        traps.push({ v: evalExpr(substitute(op.plain, { a: x, b: y }, false)).toNumber(), trap: 'int-no-parentheses' });
        work = `Replace $a$ with $${x}$ and $b$ with $${y}$: $${showApp(x, y)}$.`;
      } else if (kind === 'left') {
        const inner = app(x, y);
        answer = app(inner, z);
        expr = `(${P(x)} ${op.sym} ${P(y)}) ${op.sym} ${P(z)}`;
        traps.push({ v: app(x, app(y, z)), trap: 'int-operation-grouping' });
        traps.push({ v: app(z, inner), trap: 'int-operation-swapped' });
        work = `Inside the parentheses first: $${showApp(x, y)}$. Then $${showApp(inner, z)}$.`;
      } else if (kind === 'right') {
        const inner = app(y, z);
        answer = app(x, inner);
        expr = `${P(x)} ${op.sym} (${P(y)} ${op.sym} ${P(z)})`;
        traps.push({ v: app(app(x, y), z), trap: 'int-operation-grouping' });
        traps.push({ v: app(inner, x), trap: 'int-operation-swapped' });
        work = `Inside the parentheses first: $${showApp(y, z)}$. Then $${showApp(x, inner)}$.`;
      } else {
        // x op k = target, solve for k (search over a small range: the definitions are linear in b)
        const k = y;
        const target = app(x, k);
        const sols = Array.from({ length: 41 }, (_, i) => i - 20).filter((t) => app(x, t) === target);
        if (sols.length !== 1) continue;
        answer = k;
        expr = '';
        traps.push({ v: Array.from({ length: 41 }, (_, i) => i - 20).find((t) => app(t, x) === target) ?? NaN, trap: 'int-operation-swapped' });
        work = `Replace $a$ with $${x}$ and $b$ with $k$: $${plainToTex(op.plain.replace(/a/g, P(x)).replace(/b/g, 'k'))} = ${target}$. Solving gives $k = ${k}$. Check: $${showApp(x, k)}$.`;
        const { choices, answer: idx } = spreadChoices(rng, answer, [...traps, ...[-3, -2, -1, 1, 2, 3, 4, 5].map((d) => ({ v: k + d })), { v: -k }]);
        return {
          params: { op: opIdx, kind, x, y: k, z: target, values: choices.map((c) => Number(c.text.slice(1, -1))) },
          q: {
            format: 'mcs',
            stem: `For all numbers $a$ and $b$, the operation $${op.sym}$ is defined by $a ${op.sym} b = ${def}$. If $${P(x)} ${op.sym} k = ${target}$, what is the value of $k$?`,
            choices,
            answer: idx,
            explanation: `${work}

The number before the symbol replaces $a$ and the number after it replaces $b$.`,
          },
        };
      }
      if (Math.abs(answer) > 400) continue;
      const fillers = [-6, -4, -3, -2, -1, 1, 2, 3, 4, 6].map((d) => ({ v: answer + d }));
      let built: ReturnType<typeof spreadChoices>;
      try {
        const near = (v: number) => Number.isFinite(v) && Math.abs(v - answer) <= Math.max(40, 2 * Math.abs(answer));
        built = spreadChoices(rng, answer, [...traps.filter((t) => near(t.v)), ...fillers]);
      } catch {
        continue;
      }
      return {
        params: { op: opIdx, kind, x, y, z, values: built.choices.map((c) => Number(c.text.slice(1, -1))) },
        q: {
          format: 'mcs',
          stem: `For all numbers $a$ and $b$, the operation $${op.sym}$ is defined by $a ${op.sym} b = ${def}$. What is the value of $${expr}$?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `${work}

Follow the definition exactly: the first number replaces $a$, the second replaces $b$${kind === 'single' ? '' : ', and the parentheses tell you which operation to do first'}. Put negative numbers in parentheses when you substitute.`,
        },
      };
    }
  },
  check(q, { op: opIdx, kind, x, y, z, values }) {
    const op = OPS[opIdx];
    let expected: number;
    if (kind === 'single') expected = opValue(op, x, y).toNumber();
    else if (kind === 'left') expected = opValue(op, opValue(op, x, y).toNumber(), z).toNumber();
    else if (kind === 'right') expected = opValue(op, x, opValue(op, y, z).toNumber()).toNumber();
    else {
      // solve x op k = z by trying integers
      const sols = Array.from({ length: 201 }, (_, i) => i - 100).filter((k) => opValue(op, x, k).eq(z));
      if (sols.length !== 1) return `${sols.length} solutions`;
      expected = sols[0];
    }
    return expectMcsBy(q, (i) => values[i] === expected);
  },
};

/* ------------------------------------------------------------------ 3. Evaluate an expression (NE) */

interface EvalParams {
  plain: string;
  vars: V;
}

interface Shape {
  plain: string;
  vars: V;
  value: number;
  given: string;
  /** worked steps (TeX), starting after the original expression */
  steps: string;
}

const neg = (n: number) => (n < 0 ? `(${n})` : `${n}`);

function evalShape(rng: Rng, diff: number): Shape | null {
  const pick = rng.int(0, 2);
  if (diff === 1) {
    if (pick === 0) {
      const [a, b, c, d] = [rng.int(5, 20), rng.int(2, 6), rng.int(2, 6), rng.int(1, 9)];
      const value = a - b * c + d;
      return { plain: `${a}-${b}*${c}+${d}`, vars: {}, value, given: '', steps: `${a} - ${b * c} + ${d} = ${value}` };
    }
    if (pick === 1) {
      const [a, b] = [rng.int(2, 6), rng.int(2, 4)];
      const value = -(a * a) + (-b) ** 3;
      return { plain: `-${a}^2+(-${b})^3`, vars: {}, value, given: '', steps: `-${a * a} + (${(-b) ** 3}) = ${value}` };
    }
    const [a, b, c] = [rng.int(2, 9), rng.int(2, 5), rng.int(2, 5)];
    const value = a - b * b;
    return { plain: `-${b}^2+${a * c}/${c}`, vars: {}, value: -(b * b) + a, given: '', steps: `-${b * b} + ${a} = ${value}` };
  }
  if (diff === 2) {
    if (pick === 0) {
      const t = rng.pick([2, 3, 4, 6]);
      const c = rng.int(1, 5);
      const d = c + t;
      const sq = t * t;
      const divs = [2, 3, 4, 6, 8, 9].filter((x) => sq % x === 0);
      const e = rng.pick(divs);
      const b = rng.int(2, 6);
      const a = rng.int(5, 40);
      const value = a - (b * sq) / e;
      return {
        plain: `${a}-${b}*(${c}-${d})^2/${e}`,
        vars: {},
        value,
        given: '',
        steps: `${a} - ${b} \\cdot (${c - d})^{2} \\div ${e} = ${a} - ${b} \\cdot ${sq} \\div ${e} = ${a} - ${(b * sq) / e} = ${value}`,
      };
    }
    if (pick === 1) {
      const [a, b, c] = [rng.int(2, 7), rng.int(2, 5), rng.int(2, 4)];
      const value = a * a - b ** 3 + a * b;
      return {
        plain: `(-${a})^2-${b}^3/(-${c})^0+${a}*${b}`,
        vars: {},
        value,
        given: '',
        steps: `${a * a} - ${b ** 3} \\div 1 + ${a * b} = ${value}`,
      };
    }
    const x = -rng.int(2, 6);
    const [p, q] = [rng.int(2, 5), rng.int(1, 9)];
    const value = x * x - p * x + q;
    return { plain: `x^2-${p}*x+${q}`, vars: { x }, value, given: `x = ${x}`, steps: `${x * x} - ${neg(p * x)} + ${q} = ${value}` };
  }
  if (pick === 0) {
    const x = -rng.int(2, 5);
    const [p, q] = [rng.int(2, 4), rng.int(2, 6)];
    const value = -(x * x) + p * x ** 3 - q * x;
    return {
      plain: `-x^2+${p}*x^3-${q}*x`,
      vars: { x },
      value,
      given: `x = ${x}`,
      steps: `-${x * x} + ${p}(${x ** 3}) - ${neg(q * x)} = -${x * x} + ${neg(p * x ** 3)} + ${-q * x} = ${value}`,
    };
  }
  if (pick === 1) {
    const x = -rng.int(1, 4);
    const y = rng.int(2, 5);
    const value = x * x * y - x * y * y + (x - y) ** 2;
    return {
      plain: `x^2*y-x*y^2+(x-y)^2`,
      vars: { x, y },
      value,
      given: `x = ${x} \\text{ and } y = ${y}`,
      steps: `${x * x * y} - ${neg(x * y * y)} + ${(x - y) ** 2} = ${value}`,
    };
  }
  const x = -rng.int(2, 6);
  const y = -rng.int(1, 6);
  if (x === y) return null;
  const value = (x - y) ** 3 - x * y;
  return {
    plain: `(x-y)^3-x*y`,
    vars: { x, y },
    value,
    given: `x = ${x} \\text{ and } y = ${y}`,
    steps: `(${x - y})^{3} - ${x * y} = ${(x - y) ** 3} - ${x * y} = ${value}`,
  };
}

const evaluateNE: Template<EvalParams> = {
  id: 'arith.order-of-operations.evaluate-ne',
  skill: 'arith.order-of-operations',
  format: 'ne',
  style: 'evaluate an expression: order of operations, negatives, substitution',
  generate(rng, diff) {
    for (;;) {
      const sh = evalShape(rng, diff);
      if (!sh) continue;
      const { plain, vars, value, given, steps } = sh;
      if (Math.abs(value) > 5000) continue;
      const hasVars = Object.keys(vars).length > 0;
      const substituted = hasVars ? substitute(plain, vars) : plain;
      const slips: { v: Frac; trap: string }[] = [];
      const tight = evalExpr(substituted, { unaryTight: true });
      if (!tight.eq(value)) slips.push({ v: tight, trap: 'int-negative-square' });
      const flat = evalExpr(substituted, { flat: true });
      if (!flat.eq(value)) slips.push({ v: flat, trap: 'int-left-to-right' });
      if (hasVars) {
        const bare = evalExpr(substitute(plain, vars, false));
        if (!bare.eq(value)) slips.push({ v: bare, trap: 'int-no-parentheses' });
      }
      const traps = slips.filter((t, i, arr) => arr.findIndex((u) => u.v.eq(t.v)) === i && t.v.isInt());
      if (!traps.length && rng.chance(0.7)) continue;
      const tex = plainToTex(plain);
      const stem = hasVars ? `If $${given}$, what is the value of $${tex}$?` : `What is the value of $${tex}$?`;
      const subTex = plainToTex(substituted);
      return {
        params: { plain, vars },
        q: {
          format: 'ne',
          stem,
          answer: frac(value),
          traps: traps.map((t) => ({ value: t.v, trap: t.trap })),
          explanation: `Parentheses first, then exponents (a minus sign in front of a power applies after the power: $-3^2 = -9$), then multiplication and division from left to right, then addition and subtraction.${
            hasVars ? ` Substitute with parentheses around the negative values.` : ''
          }

$$${hasVars ? subTex : tex} = ${steps}$$${
            traps.length
              ? `\n\n${traps
                  .map((t) =>
                    t.trap === 'int-negative-square'
                      ? `Treating a minus sign in front of a power as part of the base gives $${t.v.toTex()}$.`
                      : t.trap === 'int-left-to-right'
                        ? `Working strictly from left to right gives $${t.v.toTex()}$.`
                        : `Substituting without parentheses gives $${t.v.toTex()}$.`,
                  )
                  .join(' ')}`
              : ''
          }`,
        },
      };
    }
  },
  check(q, { plain, vars }) {
    return expectNe(q, evalExpr(substitute(plain, vars)));
  },
};

/* ------------------------------------------------------------------ 4. Which expressions are negative / positive (MCM) */

const SIGN_BANK: Expr[] = [
  { plain: '-a^2', f: ({ a }) => pw(a, 2).neg() },
  { plain: '(-a)^2', f: ({ a }) => pw(-a, 2) },
  { plain: 'a^3', f: ({ a }) => pw(a, 3) },
  { plain: '-a^3', f: ({ a }) => pw(a, 3).neg() },
  { plain: 'a^2*b', f: ({ a, b }) => pw(a, 2).mul(b) },
  { plain: 'a*b^2', f: ({ a, b }) => F(a).mul(pw(b, 2)) },
  { plain: 'a-b', f: ({ a, b }) => F(a - b) },
  { plain: 'b-a', f: ({ a, b }) => F(b - a) },
  { plain: 'a^2-b^2', f: ({ a, b }) => pw(a, 2).sub(pw(b, 2)) },
  { plain: '(a-b)^2', f: ({ a, b }) => pw(a - b, 2) },
  { plain: '-b^2', f: ({ b }) => pw(b, 2).neg() },
  { plain: 'a*b', f: ({ a, b }) => F(a * b) },
  { plain: '-a*b', f: ({ a, b }) => F(-a * b) },
  { plain: '(a+b)^3', f: ({ a, b }) => pw(a + b, 3) },
  { plain: 'a^3+b^2', f: ({ a, b }) => pw(a, 3).add(pw(b, 2)) },
  { plain: 'b^2-a^2', f: ({ a, b }) => pw(b, 2).sub(pw(a, 2)) },
  { plain: 'a^4-b^3', f: ({ a, b }) => pw(a, 4).sub(pw(b, 3)) },
];

interface SignParams {
  a: number;
  b: number;
  want: 'negative' | 'positive';
  plains: string[];
}

const signSelect: Template<SignParams> = {
  id: 'arith.order-of-operations.sign-select',
  skill: 'arith.order-of-operations',
  format: 'mcm',
  style: 'substitute negative values: which expressions are negative (positive)',
  generate(rng, diff) {
    const nChoices = diff === 1 ? 4 : 5;
    for (;;) {
      const a = -rng.int(1, diff === 1 ? 3 : 4);
      const b = diff === 3 && rng.chance(0.4) ? -rng.int(1, 4) : rng.int(2, 5);
      if (a === b) continue;
      const want: SignParams['want'] = rng.chance(0.6) ? 'negative' : 'positive';
      const picks = rng.sample(SIGN_BANK, nChoices);
      const v = { a, b };
      const vals = picks.map((e) => e.f(v));
      if (vals.some((x) => x.sign() === 0)) continue;
      const correct = vals.map((x) => (want === 'negative' ? x.sign() < 0 : x.sign() > 0));
      const nc = correct.filter(Boolean).length;
      if (nc < 1 || nc > 3) continue;
      const items = picks.map((e, i) => {
        let trap: string | undefined;
        if (!correct[i]) {
          const ok = (x: Frac) => (want === 'negative' ? x.sign() < 0 : x.sign() > 0);
          if (ok(evalExpr(substitute(e.plain, v, false)))) trap = 'int-no-parentheses';
          else if (ok(evalExpr(substitute(e.plain, v), { unaryTight: true }))) trap = 'int-negative-square';
        }
        return { text: `$${plainToTex(e.plain)}$`, correct: correct[i], ...(trap ? { trap } : {}) };
      });
      const { choices, answer } = flaggedChoices(items as (Choice & { correct: boolean })[]);
      const lines = picks.map((e, i) => `- $${plainToTex(e.plain)} = ${plainToTex(substitute(e.plain, v))} = ${vals[i].toTex()}$ ${correct[i] ? '✓' : '✗'}`);
      return {
        params: { a, b, want, plains: picks.map((e) => e.plain) },
        q: {
          format: 'mcm',
          stem: `If $a = ${a}$ and $b = ${b}$, which of the following expressions have a ${want} value?`,
          instruction: 'Indicate all such expressions.',
          choices,
          answer,
          explanation: `Substitute with parentheses and evaluate each expression:
${lines.join('\n')}

Two things to watch: $-a^2$ means $-(a^2)$, so it is negative for every nonzero $a$; and an even power of a negative number is positive while an odd power is negative.`,
        },
      };
    }
  },
  check(q, { a, b, want, plains }) {
    const expected = plains.flatMap((pl, i) => {
      const x = evalExpr(substitute(pl, { a, b }));
      return (want === 'negative' ? x.sign() < 0 : x.sign() > 0) ? [i] : [];
    });
    return expectMcm(q, expected);
  },
};

export const evaluateTemplates: Template<any>[] = [substituteQC, customOperation, evaluateNE, signSelect];
