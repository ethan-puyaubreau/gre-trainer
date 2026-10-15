import { flaggedChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num, poly } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, intExcept, qcEnd, qcSamples, trapChoices } from './util';

/** "(x - 3)" / "(x + 2)" / "x" for a root r. */
const factorTex = (r: number) => (r === 0 ? 'x' : `(x ${r > 0 ? '-' : '+'} ${Math.abs(r)})`);
const factorsTex = (roots: number[]) => {
  if (roots.length === 1) return factorTex(roots[0]).replace(/^\((.*)\)$/, '$1');
  const sorted = [...roots].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : 0));
  return sorted.map(factorTex).join('');
};

/* ================================================================== 1. Expression in the two roots (NE) */

type RootTarget = 'reciprocal-product' | 'reciprocal-sum' | 'sum-squares' | 'diff-square' | 'shifted-product' | 'ratio-sum';

interface RootParams {
  coefs: [number, number, number];
  target: RootTarget;
}

function rootTargetValue(t: RootTarget, s: Frac, p: Frac): Frac {
  switch (t) {
    case 'reciprocal-product':
      return s.add(p).add(1).div(p);
    case 'reciprocal-sum':
      return s.div(p);
    case 'sum-squares':
      return s.mul(s).sub(p.mul(2));
    case 'diff-square':
      return s.mul(s).sub(p.mul(4));
    case 'shifted-product':
      return p.add(s).add(1);
    case 'ratio-sum':
      return s.mul(s).sub(p.mul(2)).div(p);
  }
}

const TARGET_TEX: Record<RootTarget, string> = {
  'reciprocal-product': '\\left(\\dfrac{1 + a}{a}\\right)\\left(\\dfrac{1 + b}{b}\\right)',
  'reciprocal-sum': '\\dfrac{1}{a} + \\dfrac{1}{b}',
  'sum-squares': 'a^2 + b^2',
  'diff-square': '(a - b)^2',
  'shifted-product': '(a + 1)(b + 1)',
  'ratio-sum': '\\dfrac{a}{b} + \\dfrac{b}{a}',
};

const rootExpressionNE: Template<RootParams> = {
  id: 'alg.quadratics.root-expression-ne',
  skill: 'alg.quadratics',
  format: 'ne',
  style: 'value of an expression in the two roots',
  generate(rng, d) {
    const target: RootTarget = rng.pick(
      d === 1 ? ['sum-squares', 'shifted-product', 'reciprocal-sum'] : d === 2 ? ['reciprocal-product', 'reciprocal-sum', 'sum-squares', 'diff-square', 'shifted-product'] : ['reciprocal-product', 'ratio-sum', 'sum-squares', 'reciprocal-sum'],
    );
    let r1: Frac;
    let r2: Frac;
    let lead = 1;
    do {
      const a = intExcept(rng, -7, 9, 0);
      if (d === 3 && rng.chance(0.5) && target !== 'ratio-sum' && target !== 'reciprocal-product') {
        lead = rng.pick([2, 3]);
        r1 = frac(a);
        r2 = new Frac(intExcept(rng, -5, 7, 0), lead);
      } else {
        lead = 1;
        r1 = frac(a);
        r2 = frac(intExcept(rng, -7, 9, 0));
      }
    } while (r1.eq(r2) || r2.isInt() !== (lead === 1) || r1.add(r2).n === 0);
    const s = r1.add(r2);
    const p = r1.mul(r2);
    const coefs: [number, number, number] = [lead, s.mul(-lead).toNumber(), p.mul(lead).toNumber()];
    const answer = rootTargetValue(target, s, p);
    const direct = (() => {
      switch (target) {
        case 'reciprocal-product':
          return r1.add(1).div(r1).mul(r2.add(1).div(r2));
        case 'reciprocal-sum':
          return r1.inv().add(r2.inv());
        case 'sum-squares':
          return r1.mul(r1).add(r2.mul(r2));
        case 'diff-square':
          return r1.sub(r2).pow(2);
        case 'shifted-product':
          return r1.add(1).mul(r2.add(1));
        case 'ratio-sum':
          return r1.div(r2).add(r2.div(r1));
      }
    })();
    const fractionBoxes = !answer.isTerminating();
    const traps: { value: Frac; trap: string }[] = [];
    const whys: string[] = [];
    const push = (v: Frac, t: string, why: string) => {
      if (!v.eq(answer) && (fractionBoxes || v.isTerminating())) {
        traps.push({ value: v, trap: t });
        whys.push(`${why} gives $${v.toTex()}$`);
      }
    };
    push(rootTargetValue(target, s.neg(), p), 'alg-vieta-sign', `taking the sum of the solutions as $${s.neg().toTex()}$ instead of $${s.toTex()}$`);
    if (target === 'sum-squares') push(s.mul(s), 'square-of-sum', `treating $(a + b)^2$ as $a^2 + b^2$`);
    if (target === 'diff-square') push(s.mul(s).sub(p.mul(2)), 'alg-middle-term-half', `subtracting $2ab$ instead of $4ab$`);
    const eq = `${poly(coefs)} = 0`;
    const sTex = s.toTex();
    const pTex = p.toTex();
    const pP = p.n < 0 ? `(${pTex})` : pTex;
    const times = (k: number) => (p.n < 0 ? `${k}(${pTex})` : `${k} \\cdot ${pTex}`);
    const work: Record<RootTarget, string> = {
      'reciprocal-product': `$\\dfrac{(1 + a)(1 + b)}{ab} = \\dfrac{1 + (a + b) + ab}{ab} = \\dfrac{1 + ${s.n < 0 ? `(${sTex})` : sTex} + ${pP}}{${pTex}}$`,
      'reciprocal-sum': `$\\dfrac{1}{a} + \\dfrac{1}{b} = \\dfrac{a + b}{ab} = ${s.toTex()} \\div ${p.n < 0 ? `(${pTex})` : pTex}$`,
      'sum-squares': `$a^2 + b^2 = (a + b)^2 - 2ab = ${s.n < 0 ? `(${sTex})` : sTex}^2 - ${times(2)}$`,
      'diff-square': `$(a - b)^2 = (a + b)^2 - 4ab = ${s.n < 0 ? `(${sTex})` : sTex}^2 - ${times(4)}$`,
      'shifted-product': `$(a + 1)(b + 1) = ab + (a + b) + 1 = ${pTex} + ${s.n < 0 ? `(${sTex})` : sTex} + 1$`,
      'ratio-sum': `$\\dfrac{a}{b} + \\dfrac{b}{a} = \\dfrac{a^2 + b^2}{ab} = \\dfrac{(a + b)^2 - 2ab}{ab}$`,
    };
    const factored =
      lead === 1
        ? `$${poly(coefs)} = (x ${r1.n > 0 ? '-' : '+'} ${num(r1.abs())})(x ${r2.n > 0 ? '-' : '+'} ${num(r2.abs())})$`
        : `$${poly(coefs)} = (x ${r1.n > 0 ? '-' : '+'} ${num(r1.abs())})(${lead}x ${r2.n > 0 ? '-' : '+'} ${num(r2.abs().mul(lead))})$`;
    return {
      params: { coefs, target },
      q: {
        format: 'ne',
        stem: `If $a$ and $b$ are the two solutions of the equation $${eq}$, what is the value of $${TARGET_TEX[target]}$?${fractionBoxes ? '\n\nGive your answer as a fraction.' : ''}`,
        answer,
        fractionBoxes: fractionBoxes || undefined,
        traps,
        explanation: `Factor: ${factored}, so the solutions are $${r1.toTex()}$ and $${r2.toTex()}$. Then $a + b = ${sTex}$ and $ab = ${pTex}$.

${work[target]}${target === 'ratio-sum' ? ` $= \\dfrac{${num(s.mul(s).sub(p.mul(2)))}}{${pTex}}$` : ''}, which equals $${answer.toTex()}$.

Check: putting $a = ${r1.toTex()}$ and $b = ${r2.toTex()}$ straight into the expression gives $${direct.toTex()}$ as well.${
          whys.length ? `\n\nTrap: ${whys[0]}, but that does not match the direct substitution.` : ''
        }

Rule: rewrite the expression with $a + b$ and $ab$, which the equation gives without solving for the roots.`,
      },
    };
  },
  check(q, { coefs, target }) {
    if (q.format !== 'ne') return 'wrong format';
    const [A, B, C] = coefs;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) return 'no two real roots';
    const a = (-B + Math.sqrt(disc)) / (2 * A);
    const b = (-B - Math.sqrt(disc)) / (2 * A);
    const v =
      target === 'reciprocal-product'
        ? ((1 + a) / a) * ((1 + b) / b)
        : target === 'reciprocal-sum'
          ? 1 / a + 1 / b
          : target === 'sum-squares'
            ? a * a + b * b
            : target === 'diff-square'
              ? (a - b) ** 2
              : target === 'shifted-product'
                ? (a + 1) * (b + 1)
                : a / b + b / a;
    return close(q.answer.toNumber(), v, 1e-9) ? null : `expected ${v}`;
  },
};

/* ================================================================== 2. Where an equation is zero: compare x with a number (QC) */

interface ZeroParams {
  kind: 'rational' | 'x2-kx' | 'x2-c';
  num: number[];
  den: number[];
  k: number;
  t: number;
  absA: boolean;
}

const zeroQC: Template<ZeroParams> = {
  id: 'alg.quadratics.zero-qc',
  skill: 'alg.quadratics',
  format: 'qc',
  style: 'solutions of a factored or quadratic equation vs a number',
  generate(rng, d) {
    const kind: ZeroParams['kind'] = rng.pick(d === 1 ? ['x2-kx', 'x2-c', 'rational'] : ['rational', 'rational', 'x2-kx', 'x2-c']);
    let numR: number[] = [];
    let denR: number[] = [];
    let k = 0;
    let absA = false;
    let roots: number[];
    let info: string;
    let wrongRoots: number[] | null = null;
    let wrongTrap = '';
    let solveText: string;
    if (kind === 'rational') {
      const useX = rng.chance(0.4);
      const n1 = useX ? 0 : intExcept(rng, -8, 8, 0);
      const n2 = intExcept(rng, -8, 8, 0, n1);
      numR = [n1, n2];
      const cancel = rng.chance(0.5);
      const c = cancel ? rng.pick(numR) : intExcept(rng, -8, 8, n1, n2);
      denR = [c];
      if (d === 3 && rng.chance(0.5)) denR.push(intExcept(rng, -8, 8, n1, n2, c));
      roots = numR.filter((r) => !denR.includes(r));
      if (cancel) {
        wrongRoots = numR;
        wrongTrap = 'alg-denominator-root';
      }
      info = `$\\dfrac{${factorsTex(numR)}}{${factorsTex(denR)}} = 0$`;
      const excluded = numR.filter((r) => denR.includes(r));
      solveText = `A fraction equals 0 when its numerator is 0 and its denominator is not. The numerator is 0 for $x = ${numR.map(num).join('$ or $x = ')}$${
        excluded.length ? `, but $x = ${num(excluded[0])}$ also makes the denominator 0, so it is not allowed` : ', and neither value makes the denominator 0'
      }. So $x = ${roots.map(num).join('$ or $x = ')}$.`;
    } else if (kind === 'x2-kx') {
      k = intExcept(rng, -9, 9, 0, 1, -1);
      roots = [0, k];
      info = `$x^2 = ${num(k)}x$`;
      wrongRoots = [k];
      wrongTrap = 'alg-divided-by-variable';
      solveText = `Bring everything to one side and factor: $x^2 ${k > 0 ? '-' : '+'} ${Math.abs(k)}x = 0$, so $x(x ${k > 0 ? '-' : '+'} ${Math.abs(k)}) = 0$ and $x = 0$ or $x = ${num(k)}$.`;
    } else {
      const r = rng.int(2, 9);
      k = r * r;
      roots = [-r, r];
      absA = rng.chance(0.3);
      info = `$x^2 = ${k}$`;
      wrongRoots = [r];
      wrongTrap = 'alg-square-root-one-sign';
      solveText = `$x^2 = ${k}$ has two solutions: $x = ${r}$ and $x = -${r}$.${absA ? ` Either way $|x| = ${r}$.` : ''}`;
    }
    const vals = absA ? roots.map(Math.abs) : roots;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    // Choose t for a target relation.
    const targets: QCChoice[] = ['A', 'B'];
    if (lo !== hi) targets.push('D', 'D');
    if (lo === hi) targets.push('C', 'C');
    else targets.push('C');
    const goal = rng.pick(targets);
    let t: number;
    if (goal === 'A') t = lo - rng.int(1, 4);
    else if (goal === 'B') t = hi + rng.int(1, 4);
    else if (goal === 'C') t = lo === hi ? lo : rng.pick([lo, hi]);
    else t = hi - lo >= 2 ? rng.int(lo + 1, hi - 1) : rng.pick([lo, hi]);
    const rel = (xs: number[]): QCChoice => {
      const s = new Set(xs.map((x) => (x > t ? 'A' : x < t ? 'B' : 'C')));
      return s.size > 1 ? 'D' : ([...s][0] as QCChoice);
    };
    const answer = rel(vals);
    const traps: QCQuestion['traps'] = {};
    if (wrongRoots) {
      const w = rel(absA ? wrongRoots.map(Math.abs) : wrongRoots);
      if (w !== answer) traps[w] = wrongTrap;
    }
    if (answer !== 'D' && lo !== hi && !traps.D) traps.D = 'alg-qc-two-values-d';
    const quantA = absA ? '$|x|$' : '$x$';
    const verdict =
      answer === 'D'
        ? `${quantA} can be ${vals.map(num).map((v) => `$${v}$`).join(' or ')}, which compare differently with $${num(t)}$.`
        : lo === hi
          ? `${quantA} is $${num(lo)}$ in every case.`
          : `Every possible value (${vals.map((v) => `$${num(v)}$`).join(' and ')}) is ${answer === 'A' ? 'greater than' : answer === 'B' ? 'less than' : 'equal to'} $${num(t)}$.`;
    return {
      params: { kind, num: numR, den: denR, k, t, absA },
      q: {
        format: 'qc',
        info,
        quantityA: quantA,
        quantityB: `$${num(t)}$`,
        answer,
        traps: Object.keys(traps).length ? traps : undefined,
        explanation: `${solveText}

${verdict} ${qcEnd(answer)}${
          wrongTrap === 'alg-divided-by-variable'
            ? `\n\nDividing both sides by $x$ loses the solution $x = 0$.`
            : wrongTrap === 'alg-square-root-one-sign'
              ? `\n\nDo not forget the negative square root.`
              : ''
        }`,
      },
    };
  },
  check(q, { kind, num: numR, den: denR, k, t, absA }) {
    if (q.format !== 'qc') return 'wrong format';
    // Brute force over integers (all solutions are integers here): evaluate the equation itself.
    const sols: number[] = [];
    for (let x = -30; x <= 30; x++) {
      if (kind === 'rational') {
        const top = numR.reduce((p, r) => p * (x - r), 1);
        const bottom = denR.reduce((p, r) => p * (x - r), 1);
        if (bottom !== 0 && top / bottom === 0) sols.push(x);
      } else if (kind === 'x2-kx') {
        if (x * x === k * x) sols.push(x);
      } else if (x * x === k) sols.push(x);
    }
    if (!sols.length) return 'no solutions found';
    const expected = qcSamples(sols.map((x) => [absA ? Math.abs(x) : x, t] as [number, number]));
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 3. Which values could be x (MCM) */

type SolForm = 'standard' | 'moved' | 'product-const' | 'common-x' | 'square';

interface SolParams {
  form: SolForm;
  /** standard: x^2 + b x + c = 0 -> [b, c]; moved: x^2 = m x + n -> [m, n]; product-const: x(x - m) = n -> [m, n];
   *  common-x: a x^2 = m x -> [a, m]; square: (x - h)^2 = s -> [h, s] */
  k: [number, number];
  values: [number, number][];
}

function solResidual(form: SolForm, [u, v]: [number, number], x: Frac): Frac {
  switch (form) {
    case 'standard':
      return x.mul(x).add(x.mul(u)).add(v);
    case 'moved':
      return x.mul(x).sub(x.mul(u).add(v));
    case 'product-const':
      return x.mul(x.sub(u)).sub(v);
    case 'common-x':
      return x.mul(x).mul(u).sub(x.mul(v));
    case 'square':
      return x.sub(u).mul(x.sub(u)).sub(v);
  }
}

/** The two sides of the equation at x (their difference is solResidual). */
function solSides(form: SolForm, [u, v]: [number, number], x: Frac): [Frac, Frac] {
  switch (form) {
    case 'standard':
      return [x.mul(x).add(x.mul(u)).add(v), new Frac(0)];
    case 'moved':
      return [x.mul(x), x.mul(u).add(v)];
    case 'product-const':
      return [x.mul(x.sub(u)), new Frac(v)];
    case 'common-x':
      return [x.mul(x).mul(u), x.mul(v)];
    case 'square':
      return [x.sub(u).mul(x.sub(u)), new Frac(v)];
  }
}

const solutionsMCM: Template<SolParams> = {
  id: 'alg.quadratics.solutions-mcm',
  skill: 'alg.quadratics',
  format: 'mcm',
  style: 'which numbers could be a solution',
  generate(rng, d) {
    for (;;) {
      const form: SolForm = rng.pick(d === 1 ? ['standard', 'common-x', 'moved'] : d === 2 ? ['moved', 'product-const', 'common-x', 'square'] : ['product-const', 'square', 'moved', 'common-x']);
      let r1: Frac;
      let r2: Frac;
      let k: [number, number];
      let eq: string;
      let solve: string;
      const wrong: { v: Frac; trap: string; why: string }[] = [];
      if (form === 'common-x') {
        const a = rng.pick(d === 1 ? [2, 3] : [2, 3, 4]);
        const m = a * intExcept(rng, -6, 8, 0, 1);
        r1 = frac(0);
        r2 = new Frac(m, a);
        k = [a, m];
        eq = `${a}x^2 = ${lin([[m, 'x']])}`;
        solve = `Do not divide by $x$ (that loses the solution $x = 0$). Move everything to one side and factor: $${lin([[a, 'x^2'], [-m, 'x']])} = ${a}x(x ${r2.n > 0 ? '-' : '+'} ${num(r2.abs())}) = 0$, so $x = 0$ or $x = ${r2.toTex()}$.`;
        wrong.push({ v: r2.neg(), trap: 'alg-root-sign', why: 'reading the root of the factor with the wrong sign' });
        wrong.push({ v: frac(m), trap: 'alg-dropped-factor', why: `forgetting to divide $${num(m)}$ by ${a}` });
        wrong.push({ v: frac(a), trap: 'alg-coefficient-as-root', why: `taking the coefficient ${a} as a solution` });
        wrong.push({ v: frac(m * a), trap: 'alg-operation-swapped', why: `multiplying $${num(m)}$ by ${a} where it should be divided` });
      } else if (form === 'square') {
        const h = intExcept(rng, -6, 6, 0);
        const rt = rng.int(2, 6);
        const s = rt * rt;
        r1 = frac(h - rt);
        r2 = frac(h + rt);
        k = [h, s];
        eq = `(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 = ${s}`;
        solve = `Take square roots, keeping both signs: $x ${h > 0 ? '-' : '+'} ${Math.abs(h)} = ${rt}$ or $x ${h > 0 ? '-' : '+'} ${Math.abs(h)} = -${rt}$, so $x = ${num(h + rt)}$ or $x = ${num(h - rt)}$.`;
        wrong.push({ v: frac(-h + rt), trap: 'alg-root-sign', why: `moving $${num(h)}$ to the other side with the wrong sign` });
        wrong.push({ v: frac(-h - rt), trap: 'alg-root-sign', why: `moving $${num(h)}$ to the other side with the wrong sign` });
        wrong.push({ v: frac(h + s), trap: 'alg-forgot-root', why: `not taking the square root of ${s}` });
        wrong.push({ v: frac(rt), trap: 'alg-dropped-term', why: `forgetting to add $${num(h)}$` });
        wrong.push({ v: frac(h), trap: 'alg-coefficient-as-root', why: `taking the number $${num(h)}$ inside the parentheses as a solution` });
      } else {
        const a = intExcept(rng, -8, 9, 0);
        const b = intExcept(rng, -8, 9, 0, a, -a);
        r1 = frac(a);
        r2 = frac(b);
        const sum = a + b;
        const prod = a * b;
        if (form === 'standard') {
          k = [-sum, prod];
          eq = `${poly([1, -sum, prod])} = 0`;
          solve = `Factor: $${poly([1, -sum, prod])} = ${factorTex(a)}${factorTex(b)} = 0$, so $x = ${num(a)}$ or $x = ${num(b)}$.`;
          wrong.push({ v: frac(-a), trap: 'alg-root-sign', why: `reading the root of the factor $${factorTex(a)}$ with the wrong sign` });
          wrong.push({ v: frac(-b), trap: 'alg-root-sign', why: `reading the root of the factor $${factorTex(b)}$ with the wrong sign` });
          wrong.push({ v: frac(prod), trap: 'alg-coefficient-as-root', why: `taking the constant term $${num(prod)}$ as a solution` });
          wrong.push({ v: frac(-sum), trap: 'alg-coefficient-as-root', why: `taking the coefficient $${num(-sum)}$ of $x$ as a solution` });
          wrong.push({ v: frac(sum), trap: 'alg-vieta-sign', why: 'confusing the sum of the solutions with the coefficient of $x$' });
        } else if (form === 'moved') {
          k = [sum, -prod];
          eq = `x^2 = ${poly([sum, -prod])}`;
          solve = `Move every term to the left: $${poly([1, -sum, prod])} = 0$. Factor: $${factorTex(a)}${factorTex(b)} = 0$, so $x = ${num(a)}$ or $x = ${num(b)}$.`;
          wrong.push({ v: frac(-a), trap: 'alg-root-sign', why: `reading the root of the factor $${factorTex(a)}$ with the wrong sign` });
          wrong.push({ v: frac(-b), trap: 'alg-root-sign', why: `reading the root of the factor $${factorTex(b)}$ with the wrong sign` });
          wrong.push({ v: frac(-prod), trap: 'alg-coefficient-as-root', why: `taking the constant term $${num(-prod)}$ as a solution` });
          wrong.push({ v: frac(sum), trap: 'alg-coefficient-as-root', why: `taking the coefficient $${num(sum)}$ of $x$ as a solution` });
          wrong.push({ v: frac(prod), trap: 'alg-move-term-sign', why: 'moving the constant to the left without changing its sign' });
        } else {
          // x(x - m) = n with roots a, b: x^2 - m x - n = 0 -> m = a + b, n = -a b
          const m = sum;
          const n = -prod;
          if (m === 0 || n === 0) continue;
          k = [m, n];
          eq = `x(x ${m > 0 ? '-' : '+'} ${Math.abs(m)}) = ${num(n)}`;
          solve = `The zero-product rule needs 0 on one side, so first expand: $${poly([1, -m, -n])} = 0$. Factor: $${factorTex(a)}${factorTex(b)} = 0$, so $x = ${num(a)}$ or $x = ${num(b)}$.`;
          wrong.push({ v: frac(n), trap: 'alg-zero-product-nonzero', why: `setting the factor $x$ equal to $${num(n)}$, as if a product equal to $${num(n)}$ forced a factor to equal it` });
          wrong.push({ v: frac(n + m), trap: 'alg-zero-product-nonzero', why: `setting the factor $x ${m > 0 ? '-' : '+'} ${Math.abs(m)}$ equal to $${num(n)}$` });
          wrong.push({ v: frac(-a), trap: 'alg-root-sign', why: `reading the root of the factor $${factorTex(a)}$ with the wrong sign` });
          wrong.push({ v: frac(-b), trap: 'alg-root-sign', why: `reading the root of the factor $${factorTex(b)}$ with the wrong sign` });
          wrong.push({ v: frac(m), trap: 'alg-coefficient-as-root', why: `taking the number $${num(m)}$ in the parentheses as a solution` });
        }
      }
      const both = rng.chance(0.7);
      const goods = both ? [r1, r2] : [rng.pick([r1, r2])];
      // Wrong choices: distinct values that are not solutions, one slip at a time before any slip repeats.
      const pool = wrong.filter((w, i) => ![r1, r2].some((r) => r.eq(w.v)) && wrong.findIndex((u) => u.v.eq(w.v)) === i);
      const byTrap = new Map<string, typeof pool>();
      for (const w of rng.shuffle(pool)) byTrap.set(w.trap, [...(byTrap.get(w.trap) ?? []), w]);
      const ordered: typeof pool = [];
      for (let round = 0; ordered.length < pool.length; round++) for (const list of byTrap.values()) if (list[round]) ordered.push(list[round]);
      const total = rng.pick([5, 6]);
      const nWrong = Math.min(total - goods.length, ordered.length);
      if (goods.length + nWrong < 5) continue;
      const chosen = ordered.slice(0, nWrong);
      const items: { v: Frac; ok: boolean; trap?: string }[] = [...goods.map((v) => ({ v, ok: true })), ...chosen.map((w) => ({ v: w.v, ok: false, trap: w.trap }))];
      items.sort((x, y) => x.v.cmp(y.v));
      const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${it.v.toTex()}$`, correct: it.ok, ...(it.trap ? { trap: it.trap } : {}) })));
      const missing = [r1, r2].filter((r) => !goods.some((g) => g.eq(r)));
      const fmtSides = (x: Frac) => {
        const [l, r] = solSides(form, k!, x);
        return `the two sides are $${l.toTex()}$ and $${r.toTex()}$`;
      };
      const g0 = goods[0];
      const w0 = chosen[0];
      return {
        params: { form, k: k!, values: items.map((it) => [it.v.n, it.v.d] as [number, number]) },
        q: {
          format: 'mcm',
          stem: `If $${eq!}$, which of the following could be the value of $x$?`,
          instruction: 'Indicate all such values.',
          choices,
          answer,
          explanation: `${solve!} Both solutions work, so the correct choices are the ones that appear in the list${missing.length ? ` (the other solution, $${missing[0].toTex()}$, is not listed)` : ''}.

Check: for $x = ${g0.toTex()}$ ${fmtSides(g0)}, which are equal.

Trap: $${w0.v.toTex()}$ comes from ${w0.why}. For $x = ${w0.v.toTex()}$ ${fmtSides(w0.v)}, which differ.

Rule: a solution is a number that makes both sides equal; substitute to be sure.`,
        },
      };
    }
  },
  check(q, { form, k, values }) {
    if (q.format !== 'mcm') return 'wrong format';
    if (values.some(([n, dd], i) => q.choices[i].text !== `$${new Frac(n, dd).toTex()}$`)) return 'choice text mismatch';
    const expected = values.flatMap(([n, dd], i) => (solResidual(form, k, new Frac(n, dd)).n === 0 ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. One root known: find the coefficient or the other root (MCS) */

interface FactorParams {
  kind: 'find-k' | 'other-root' | 'identity';
  /** find-k / other-root: x^2 + kx + c = 0 with known root r -> [c, r]; identity: (x + a)(x + b) = x^2 + S x + c -> [a, S] */
  k: [number, number];
  values: number[];
}

const factorMCS: Template<FactorParams> = {
  id: 'alg.quadratics.factor-mcs',
  skill: 'alg.quadratics',
  format: 'mcs',
  style: 'use a known root or a factorization to find a coefficient',
  generate(rng, d) {
    for (;;) {
      const kind: FactorParams['kind'] = rng.pick(d === 1 ? ['find-k', 'identity'] : ['find-k', 'other-root', 'identity']);
      let r1: number;
      let r2: number;
      do {
        r1 = intExcept(rng, -9, 9, 0, 1, -1);
        r2 = intExcept(rng, -9, 9, 0, 1, -1);
      } while (r1 === r2 || r1 + r2 === 0);
      const c = r1 * r2;
      const kk = -(r1 + r2);
      let stem: string;
      let method: string;
      let rule: string;
      let answer: number;
      let k: [number, number];
      const wrongs: { value: number; trap: string; why: string }[] = [];
      if (kind === 'find-k' || kind === 'other-root') {
        k = [c, r1];
        const eqTex = `x^2 + kx ${c < 0 ? '-' : '+'} ${Math.abs(c)} = 0`;
        if (kind === 'find-k') {
          answer = kk;
          stem = `In the equation $${eqTex}$, $k$ is a constant. If $x = ${num(r1)}$ is a solution of the equation, what is the value of $k$?`;
          method = `A solution makes the equation true, so substitute it: $${r1 < 0 ? `(${r1})` : r1}^2 + ${r1 < 0 ? `(${r1})` : r1}k ${c < 0 ? '-' : '+'} ${Math.abs(c)} = 0$, so $${r1 * r1 + c} ${r1 < 0 ? '-' : '+'} ${Math.abs(r1)}k = 0$ and $k = ${num(answer)}$.

Check by factoring: $${poly([1, kk, c])} = ${factorTex(r1)}${factorTex(r2)}$, which is 0 at $x = ${num(r1)}$.`;
          rule = 'A number is a solution when substituting it makes the equation true.';
          wrongs.push({ value: -kk, trap: 'alg-vieta-sign', why: `the wrong sign for the sum of the solutions` });
          wrongs.push({ value: r2, trap: 'alg-answered-other-variable', why: `giving the other solution instead of $k$` });
          wrongs.push({ value: -r2, trap: 'alg-root-sign', why: `giving the other solution with the wrong sign` });
          wrongs.push({ value: -(r1 * r1 + c), trap: 'alg-forgot-divide', why: `not dividing by $${num(r1)}$ after substituting` });
          wrongs.push({ value: r1 - r2, trap: 'alg-sign-slip', why: `losing a sign while substituting $${num(r1)}$` });
        } else {
          answer = r2;
          stem = `In the equation $${eqTex}$, $k$ is a constant. If $x = ${num(r1)}$ is one solution of the equation, what is the other solution?`;
          method = `The product of the two solutions of $x^2 + kx ${c < 0 ? '-' : '+'} ${Math.abs(c)} = 0$ is the constant term, $${num(c)}$. So the other solution is $\\frac{${num(c)}}{${num(r1)}} = ${num(r2)}$.

Check: substituting $x = ${num(r1)}$ gives $k = ${num(kk)}$, and $${poly([1, kk, c])} = ${factorTex(r1)}${factorTex(r2)}$ has the solutions $${num(r1)}$ and $${num(r2)}$.`;
          rule = 'The two solutions multiply to the constant term and add to minus the coefficient of x.';
          wrongs.push({ value: -r2, trap: 'alg-root-sign', why: `giving the other solution with the wrong sign` });
          wrongs.push({ value: kk, trap: 'alg-answered-other-variable', why: `giving $k$ instead of the other solution` });
          wrongs.push({ value: r1 + r2, trap: 'alg-vieta-sign', why: `giving the sum of the solutions` });
          wrongs.push({ value: c, trap: 'alg-coefficient-as-root', why: `giving the product $${num(c)}$ of the solutions` });
          wrongs.push({ value: -2 * r1 - r2, trap: 'alg-vieta-sign', why: `using $k - ${num(r1)}$ instead of $-k - ${num(r1)}$` });
        }
      } else {
        // (x + a)(x + b) = x^2 + S x + c, given a and S, find c
        const a = r1;
        const b = r2;
        const S = a + b;
        k = [a, S];
        answer = a * b;
        stem = `If $(x ${a < 0 ? '-' : '+'} ${Math.abs(a)})(x + n) = ${poly([1, S, 0])} + c$ for all values of $x$, where $n$ and $c$ are constants, what is the value of $c$?`;
        method = `Expand the left side: $(x ${a < 0 ? '-' : '+'} ${Math.abs(a)})(x + n) = x^2 + (${num(a)} + n)x + ${a < 0 ? `(${a})` : a}n$. Matching the $x$ terms: $${num(a)} + n = ${num(S)}$, so $n = ${num(b)}$. Matching the constants: $c = ${a < 0 ? `(${a})` : a}(${num(b)}) = ${num(answer)}$.

Check at $x = 1$: $(1 ${a < 0 ? '-' : '+'} ${Math.abs(a)})(1 ${b < 0 ? '-' : '+'} ${Math.abs(b)}) = ${num((1 + a) * (1 + b))}$ and $1 ${S < 0 ? '-' : '+'} ${Math.abs(S)} ${answer < 0 ? '-' : '+'} ${Math.abs(answer)} = ${num(1 + S + answer)}$.`;
        rule = 'Two polynomials equal for all x have equal coefficients: match them one power at a time.';
        wrongs.push({ value: b, trap: 'alg-answered-other-variable', why: `giving $n$ instead of $c$` });
        wrongs.push({ value: a * (S + a), trap: 'alg-move-term-sign', why: `solving $${num(a)} + n = ${num(S)}$ with the wrong sign for $${num(a)}$` });
        wrongs.push({ value: S, trap: 'alg-sum-for-product', why: `giving the sum $${num(S)}$ instead of the product` });
        wrongs.push({ value: a * S, trap: 'alg-multiplied-wrong-numbers', why: `multiplying $${num(a)}$ by $${num(S)}$ instead of by $n$` });
        wrongs.push({ value: -answer, trap: 'alg-sign-slip', why: 'losing a sign in the product' });
      }
      const res = trapChoices(rng, answer, wrongs, (v) => `$${v.toTex()}$`);
      if (!res) continue;
      const cited = res.kept[0];
      return {
        params: { kind, k: k!, values: res.values.map((v) => v.n) },
        q: {
          format: 'mcs',
          stem: stem!,
          choices: res.choices,
          answer: res.answer,
          explanation: `${method!}

Trap: $${cited.value.toTex()}$ comes from ${cited.why}.

Rule: ${rule!}`,
        },
      };
    }
  },
  check(q, { kind, k, values }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => q.choices[i].text !== `$${num(v)}$`)) return 'choice text mismatch';
    const hits = values.flatMap((v, i) => {
      if (kind === 'find-k') {
        const [c, r] = k;
        return r * r + v * r + c === 0 ? [i] : [];
      }
      if (kind === 'other-root') {
        const [c, r] = k;
        const kk = -(r * r + c) / r; // k from the known root
        return v !== r && v * v + kk * v + c === 0 ? [i] : [];
      }
      // identity: there must be an n with (x + a)(x + n) = x^2 + S x + v at several x
      const [a, S] = k;
      const n = S - a;
      const ok = [0, 1, 2].every(() => {
        const x = rng.next() * 10 - 5;
        return close((x + a) * (x + n), x * x + S * x + v, 1e-9);
      });
      return ok ? [i] : [];
    });
    if (hits.length !== 1) return `${hits.length} matching choices`;
    return hits[0] === q.answer ? null : `expected ${hits[0]}`;
  },
};

export const quadraticTemplates = [rootExpressionNE, zeroQC, solutionsMCM, factorMCS];
