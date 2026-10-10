import { flaggedChoices, qcCompare, qcCompareNum } from '../../engine/build';
import { frac } from '../../engine/frac';
import { num } from '../../engine/tex';
import type { Choice, QCQuestion, Template } from '../../engine/types';

/** A radical expression term: coef * root_index(radicand). */
interface Rad {
  coef: number;
  radicand: number;
  index: 2 | 3;
}

const radTex = ({ coef, radicand, index }: Rad) => {
  const root = index === 2 ? `\\sqrt{${num(radicand)}}` : `\\sqrt[3]{${num(radicand)}}`;
  if (radicand === 1) return num(coef);
  return coef === 1 ? root : `${num(coef)}${root}`;
};
const radValue = ({ coef, radicand, index }: Rad) => coef * (index === 2 ? Math.sqrt(radicand) : Math.cbrt(radicand));

const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11];

/* ------------------------------------------------------------------ 1. Difference / sum of radicals vs a single radical (QC) */

interface DiffParams {
  a: number;
  b: number;
  c: number;
  m: number;
  index: 2 | 3;
  op: '-' | '+';
}

const radicalCompareQC: Template<DiffParams> = {
  id: 'arith.roots.combine-qc',
  skill: 'arith.roots',
  format: 'qc',
  style: 'combine two radicals, compare with one radical',
  generate(rng, d) {
    const index: 2 | 3 = d === 3 && rng.chance(0.7) ? 3 : 2;
    const c = index === 2 ? rng.pick([2, 3, 5, 6, 7]) : rng.pick([2, 3, 5, 10]);
    const op: '-' | '+' = d === 1 ? '-' : rng.pick(['-', '+'] as const);
    let a: number;
    let b: number;
    do {
      a = index === 2 ? rng.int(2, d === 1 ? 5 : 7) : rng.int(2, 4);
      b = index === 2 ? rng.int(1, a - 1 || 1) : rng.int(1, a - 1 || 1);
    } while (b >= a || (index === 2 && b === 1 && d < 3));
    const k = op === '-' ? a - b : a + b;
    const pw = (x: number) => x ** index;
    // B = root(m * c). Equal 45% of the time, otherwise just above / below.
    const rel = rng.chance(0.45) ? 'C' : rng.pick(['A', 'B']);
    const delta = rng.int(1, 3);
    const m = rel === 'C' ? pw(k) : rel === 'A' ? Math.max(1, pw(k) - delta) : pw(k) + delta;
    const answer = qcCompare(pw(k), m);
    // The classic slip: subtract (or add) under the radical.
    const slipInside = op === '-' ? pw(a) - pw(b) : pw(a) + pw(b);
    const slipAnswer = qcCompare(slipInside, m);
    const traps: QCQuestion['traps'] =
      slipAnswer !== answer ? { [slipAnswer]: op === '-' ? 'radical-subtract' : 'radical-add' } : undefined;

    const root = (n: number) => (index === 2 ? `\\sqrt{${num(n)}}` : `\\sqrt[3]{${num(n)}}`);
    const A = `${root(pw(a) * c)} ${op} ${root(pw(b) * c)}`;
    const B = root(m * c);
    const power = index === 2 ? 'square' : 'cube';
    return {
      params: { a, b, c, m, index, op },
      q: {
        format: 'qc',
        quantityA: `$${A}$`,
        quantityB: `$${B}$`,
        answer,
        traps,
        explanation: `Take the perfect ${power}s out: $${root(pw(a) * c)} = ${radTex({ coef: a, radicand: c, index })}$ and $${root(pw(b) * c)} = ${radTex({
          coef: b,
          radicand: c,
          index,
        })}$, so Quantity A is $${radTex({ coef: k, radicand: c, index })}${k === 1 ? '' : ` = ${root(pw(k) * c)}`}$.

Compare $${root(pw(k) * c)}$ with $${B}$: ${answer === 'C' ? 'they are equal' : answer === 'A' ? 'Quantity A is greater' : 'Quantity B is greater'}. (${answer})

Careful: $${A} \\ne ${root(Math.abs(slipInside) * c)}$. Radicals do not ${op === '-' ? 'subtract' : 'add'} under the root sign.`,
      },
    };
  },
  check(q, { a, b, c, m, index, op }) {
    const r = (n: number) => (index === 2 ? Math.sqrt(n) : Math.cbrt(n));
    const A = op === '-' ? r(a ** index * c) - r(b ** index * c) : r(a ** index * c) + r(b ** index * c);
    const expected = qcCompareNum(A, r(m * c), 1e-12);
    return q.format === 'qc' && q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ------------------------------------------------------------------ 2. Simplify a sum of radicals (MCS) */

interface SimplifyParams {
  terms: { sign: 1 | -1; radicand: number }[];
  choices: Rad[];
}

const simplifyRadicals: Template<SimplifyParams> = {
  id: 'arith.roots.simplify-sum',
  skill: 'arith.roots',
  format: 'mcs',
  style: 'simplify a sum of square roots',
  generate(rng, d) {
    const r = rng.pick([2, 3, 5, 6, 7]);
    const nTerms = d === 1 ? 2 : 3;
    let coefs: number[];
    let signs: (1 | -1)[];
    let k: number;
    do {
      coefs = Array.from({ length: nTerms }, () => rng.int(1, d === 3 ? 7 : 5));
      signs = coefs.map((_, i) => (i === 0 ? 1 : rng.chance(d === 1 ? 0.5 : 0.35) ? -1 : 1));
      k = coefs.reduce((s, c, i) => s + signs[i] * c, 0);
    } while (k <= 1 || new Set(coefs).size < nTerms || coefs.every((c) => c === 1));
    const radicands = coefs.map((c) => c * c * r);
    const terms = radicands.map((radicand, i) => ({ sign: signs[i], radicand }));
    const insideSum = radicands.reduce((s, x, i) => s + signs[i] * x, 0);
    const absSum = coefs.reduce((s, c) => s + c, 0);

    const correct: Rad = { coef: k, radicand: r, index: 2 };
    const cands: (Rad & { trap?: string })[] = [
      { coef: 1, radicand: insideSum, index: 2, trap: signs.includes(-1) ? 'radical-subtract' : 'radical-add' },
      { coef: 1, radicand: k * r, index: 2, trap: 'radical-coefficient' },
      { coef: absSum, radicand: r, index: 2 },
      { coef: k + 1, radicand: r, index: 2 },
      { coef: k - 1, radicand: r, index: 2 },
      { coef: k, radicand: 2 * r, index: 2 },
      { coef: k * k, radicand: r, index: 2 },
    ];
    const seen = new Set([radValue(correct).toFixed(9)]);
    const wrong: (Rad & { trap?: string })[] = [];
    for (const cand of cands) {
      if (cand.radicand <= 0 || cand.coef <= 0) continue;
      // Simplify display of the candidate radicand when the student would (e.g. sqrt(4*3) shows as sqrt(12)).
      const v = radValue(cand).toFixed(9);
      if (seen.has(v)) continue;
      seen.add(v);
      wrong.push(cand);
      if (wrong.length === 4) break;
    }
    const all = [{ ...correct, ok: true }, ...wrong].sort((x, y) => radValue(x) - radValue(y));
    const choices: Choice[] = all.map((x) => ({ text: `$${radTex(x)}$`, ...('trap' in x && x.trap ? { trap: x.trap } : {}) }));
    const expr = terms.map((t, i) => `${i === 0 ? '' : t.sign < 0 ? ' - ' : ' + '}\\sqrt{${num(t.radicand)}}`).join('');
    const steps = coefs.map((c) => `\\sqrt{${num(c * c * r)}} = ${radTex({ coef: c, radicand: r, index: 2 })}`).join(',\\; ');
    return {
      params: { terms, choices: all.map(({ coef, radicand, index }) => ({ coef, radicand, index })) },
      q: {
        format: 'mcs',
        stem: `Which of the following is equal to $${expr}$?`,
        choices,
        answer: all.findIndex((x) => 'ok' in x),
        explanation: `Simplify each radical: $${steps}$.

All the terms are multiples of $\\sqrt{${r}}$, so they combine like ordinary terms: $${coefs
          .map((c, i) => `${i === 0 ? '' : signs[i] < 0 ? ' - ' : ' + '}${c}`)
          .join('')} = ${k}$, giving $${radTex(correct)}$.

$${expr} \\ne \\sqrt{${num(insideSum)}}$: you cannot add or subtract under the radical.`,
      },
    };
  },
  check(q, { terms, choices }) {
    if (q.format !== 'mcs') return 'wrong format';
    const value = terms.reduce((s, t) => s + t.sign * Math.sqrt(t.radicand), 0);
    const matches = choices.map((c, i) => [i, Math.abs(radValue(c) - value) < 1e-9] as const).filter(([, ok]) => ok);
    if (matches.length !== 1) return `${matches.length} choices equal the expression`;
    return matches[0][0] === q.answer ? null : `answer should be ${matches[0][0]}`;
  },
};

/* ------------------------------------------------------------------ 3. Value of a squared / multiplied radical expression (NE) */

interface ValueParams {
  kind: 'product' | 'square';
  radicands: number[];
  signs: (1 | -1)[];
}

const radicalValueNE: Template<ValueParams> = {
  id: 'arith.roots.value-ne',
  skill: 'arith.roots',
  format: 'ne',
  style: 'value of a product or square of radicals',
  generate(rng, d) {
    const r = rng.pick([2, 3, 5, 6, 7]);
    if (d === 1) {
      // sqrt(p^2 r) * sqrt(q^2 r) = p q r
      const [p, q] = rng.sample([1, 2, 3, 4, 5], 2);
      const radicands = [p * p * r, q * q * r];
      const value = p * q * r;
      return {
        params: { kind: 'product', radicands, signs: [1, 1] },
        q: {
          format: 'ne',
          stem: `What is the value of $\\sqrt{${radicands[0]}} \\cdot \\sqrt{${radicands[1]}}$?`,
          answer: frac(value),
          explanation: `$\\sqrt{${radicands[0]}} \\cdot \\sqrt{${radicands[1]}} = \\sqrt{${num(radicands[0] * radicands[1])}}$, and $${num(
            radicands[0] * radicands[1],
          )} = ${value}^2$, so the value is ${value}.

Or simplify first: $${radTex({ coef: p, radicand: r, index: 2 })} \\cdot ${radTex({ coef: q, radicand: r, index: 2 })} = ${p * q} \\cdot ${r} = ${value}$.`,
        },
      };
    }
    const n = d === 2 ? 2 : 3;
    let coefs: number[];
    let signs: (1 | -1)[];
    let k: number;
    do {
      coefs = rng.sample([1, 2, 3, 4, 5, 6], n);
      signs = coefs.map((_, i) => (i === 0 ? 1 : rng.chance(0.4) ? -1 : 1));
      k = coefs.reduce((s, c, i) => s + signs[i] * c, 0);
    } while (k === 0);
    const radicands = coefs.map((c) => c * c * r);
    const value = k * k * r;
    const naive = radicands.reduce((s, x) => s + x, 0);
    const expr = radicands.map((x, i) => `${i === 0 ? '' : signs[i] < 0 ? ' - ' : ' + '}\\sqrt{${num(x)}}`).join('');
    return {
      params: { kind: 'square', radicands, signs },
      q: {
        format: 'ne',
        stem: `What is the value of $\\left(${expr}\\right)^2$?`,
        answer: frac(value),
        traps: naive !== value ? [{ value: frac(naive), trap: 'square-of-sum' }] : [],
        explanation: `Simplify inside first: ${coefs
          .map((c) => `$\\sqrt{${num(c * c * r)}} = ${radTex({ coef: c, radicand: r, index: 2 })}$`)
          .join(', ')}. The sum inside the parentheses is $${radTex({ coef: Math.abs(k), radicand: r, index: 2 })
          .replace(/^/, k < 0 ? '-' : '')}$.

Squaring: $(${k}\\sqrt{${r}})^2 = ${k * k} \\cdot ${r} = ${value}$.

Adding the squares of each term (${num(naive)}) forgets the cross terms: $(a + b)^2 \\ne a^2 + b^2$.`,
      },
    };
  },
  check(q, { kind, radicands, signs }) {
    const v =
      kind === 'product'
        ? Math.sqrt(radicands[0]) * Math.sqrt(radicands[1])
        : radicands.reduce((s, x, i) => s + signs[i] * Math.sqrt(x), 0) ** 2;
    return q.format === 'ne' && Math.abs(q.answer.toNumber() - v) < 1e-6 ? null : `expected ${v}`;
  },
};

/* ------------------------------------------------------------------ 4. Which expressions equal k*sqrt(r) (MCM) */

type Expr =
  | { t: 'root'; n: number } // sqrt(n)
  | { t: 'coef'; c: number; n: number } // c sqrt(n)
  | { t: 'prod'; x: number; y: number } // sqrt(x) sqrt(y)
  | { t: 'sum'; x: number; y: number } // sqrt(x) + sqrt(y)
  | { t: 'quot'; x: number; y: number }; // sqrt(x) / sqrt(y)

const exprTex = (e: Expr): string => {
  switch (e.t) {
    case 'root':
      return `\\sqrt{${num(e.n)}}`;
    case 'coef':
      return `${e.c}\\sqrt{${num(e.n)}}`;
    case 'prod':
      return `\\sqrt{${num(e.x)}} \\cdot \\sqrt{${num(e.y)}}`;
    case 'sum':
      return `\\sqrt{${num(e.x)}} + \\sqrt{${num(e.y)}}`;
    case 'quot':
      return `\\dfrac{\\sqrt{${num(e.x)}}}{\\sqrt{${num(e.y)}}}`;
  }
};
const exprValue = (e: Expr): number => {
  switch (e.t) {
    case 'root':
      return Math.sqrt(e.n);
    case 'coef':
      return e.c * Math.sqrt(e.n);
    case 'prod':
      return Math.sqrt(e.x) * Math.sqrt(e.y);
    case 'sum':
      return Math.sqrt(e.x) + Math.sqrt(e.y);
    case 'quot':
      return Math.sqrt(e.x) / Math.sqrt(e.y);
  }
};

interface EqualParams {
  k: number;
  r: number;
  exprs: Expr[];
}

const equalRadicalsMCM: Template<EqualParams> = {
  id: 'arith.roots.equal-forms',
  skill: 'arith.roots',
  format: 'mcm',
  style: 'which forms equal a given radical',
  generate(rng, d) {
    const k = rng.pick(d === 1 ? [4, 6] : [4, 6, 8, 9, 10, 12]);
    const r = rng.pick(SQUAREFREE.filter((x) => x < 8));
    const N = k * k * r;
    const divs = [2, 3, 4, 5, 6].filter((m) => k % m === 0 && m < k);
    const m = rng.pick(divs);
    const forms: Expr[] = [
      { t: 'root', n: N },
      { t: 'coef', c: m, n: (k / m) ** 2 * r },
      { t: 'prod', x: 2 * r, y: (k * k) / 2 },
      { t: 'quot', x: N * 4, y: 4 },
    ];
    const trueForms = forms.filter((e) => (e.t !== 'prod' || Number.isInteger(e.y)) && Math.abs(exprValue(e) - k * Math.sqrt(r)) < 1e-9);
    const falseForms: (Expr & { trap?: string })[] = [
      { t: 'root', n: k * r, trap: 'radical-coefficient' },
      { t: 'sum', x: k * k, y: r, trap: 'radical-add' },
      { t: 'coef', c: m, n: (k / m) * r, trap: 'radical-coefficient' },
      { t: 'root', n: k * k + r, trap: 'radical-add' },
      { t: 'coef', c: k * k, n: r },
    ];
    const nTrue = rng.int(d === 1 ? 1 : 2, Math.min(3, trueForms.length));
    const picksTrue = rng.sample(trueForms, nTrue);
    const nFalse = (d === 1 ? 4 : 5) - nTrue;
    const picksFalse = rng
      .shuffle(falseForms)
      .filter((e) => Math.abs(exprValue(e) - k * Math.sqrt(r)) > 1e-9)
      .slice(0, nFalse);
    const all = rng.shuffle([...picksTrue.map((e) => ({ e, correct: true })), ...picksFalse.map((e) => ({ e, correct: false }))]);
    const { choices, answer } = flaggedChoices(
      all.map(({ e, correct }) => ({ text: `$${exprTex(e)}$`, correct, ...('trap' in e && e.trap ? { trap: e.trap as string } : {}) })),
    );
    const target = `${k}\\sqrt{${r}}`;
    const why = all
      .map(({ e, correct }) => {
        const v = exprTex(e);
        if (correct) {
          if (e.t === 'root') return `$${v} = \\sqrt{${k * k} \\cdot ${r}} = ${target}$ ✓`;
          if (e.t === 'coef') return `$${v} = ${e.c} \\cdot ${k / e.c}\\sqrt{${r}} = ${target}$ ✓`;
          if (e.t === 'prod') return `$${v} = \\sqrt{${num(e.x * e.y)}} = ${target}$ ✓`;
          return `$${v} = \\dfrac{2\\sqrt{${num(N)}}}{2} = ${target}$ ✓`;
        }
        if (e.t === 'sum') return `$${v} = ${Math.sqrt((e as { x: number }).x)} + \\sqrt{${r}}$, not $${target}$ ✗`;
        if (e.t === 'root') return `$${v}$ is not $${target} = \\sqrt{${num(N)}}$ ✗`;
        if (e.t === 'coef') return `$${v} = \\sqrt{${num((e.c * e.c) * e.n)}}$, not $\\sqrt{${num(N)}}$ ✗`;
        return `$${v}$ ✗`;
      })
      .map((s) => `- ${s}`)
      .join('\n');
    return {
      params: { k, r, exprs: all.map((x) => x.e) },
      q: {
        format: 'mcm',
        stem: `Which of the following are equal to $${target}$?`,
        instruction: 'Indicate all such expressions.',
        choices,
        answer,
        explanation: `Write the target as a single radical: $${target} = \\sqrt{${k}^2 \\cdot ${r}} = \\sqrt{${num(N)}}$. Then check each choice:
${why}`,
      },
    };
  },
  check(q, { k, r, exprs }) {
    if (q.format !== 'mcm') return 'wrong format';
    const target = k * Math.sqrt(r);
    const expected = exprs.flatMap((e, i) => (Math.abs(exprValue(e) - target) < 1e-9 ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

export const rootTemplates = [radicalCompareQC, simplifyRadicals, radicalValueNE, equalRadicalsMCM];

// Exported for reuse by other arithmetic templates.
export { radTex, radValue };
export type { Rad };
