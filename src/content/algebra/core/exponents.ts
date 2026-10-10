import { flaggedChoices, textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { N, V, add, allowedValues, close, div, evalEx, lx, mul, pow, powT, qcEnd, qcSamples, sameFunction, texEx, type Ex } from './util';

/* ================================================================== 1. Solve an equation by writing every power with one base (NE) */

/** One factor base^(a x + c), with base = g^e, in the numerator (w = 1) or the denominator (w = -1). */
interface PowFactor {
  e: number;
  a: number;
  c: number;
  w: 1 | -1;
}

interface SolveParams {
  g: number;
  left: PowFactor[];
  right: PowFactor;
}

const expTex = (a: number, c: number) => lin([[a, 'x'], [c, '']]);
const factorTex = (g: number, f: PowFactor) => {
  const base = g ** f.e;
  const ex = expTex(f.a, f.c);
  return ex === '1' ? `${base}` : `${base}^{${ex}}`;
};

const solveExpNE: Template<SolveParams> = {
  id: 'alg.exponent-equations.solve-ne',
  skill: 'alg.exponent-equations',
  format: 'ne',
  style: 'solve for an exponent by rewriting with a common base',
  generate(rng, d) {
    const g = rng.pick(d === 3 ? [2, 3, 5] : [2, 3]);
    const maxE = g === 2 ? 4 : g === 3 ? 3 : 2;
    let left: PowFactor[];
    let right: PowFactor;
    let x: Frac;
    for (;;) {
      const nLeft = d === 1 ? 1 : 2;
      left = Array.from({ length: nLeft }, (_, i) => ({
        e: rng.int(1, maxE),
        a: rng.pick(d === 1 ? [1, 1, 2] : [1, 1, 2, 3]),
        c: rng.int(-3, 3),
        w: (d === 3 && i === 1 && rng.chance(0.5) ? -1 : 1) as 1 | -1,
      }));
      right = { e: rng.int(1, maxE), a: rng.pick([0, 1, 1, 2]), c: rng.int(-3, 4), w: 1 };
      if (right.a === 0) right.c = rng.int(2, 7);
      if (left.length === 2 && left[0].e === left[1].e) continue;
      if (left.every((f) => f.e === right.e)) continue;
      if (left.some((f) => f.e === right.e && f.a === right.a && f.c === right.c)) continue;
      const coef = left.reduce((s, f) => s + f.w * f.e * f.a, 0) - right.e * right.a;
      const rhs = right.e * right.c - left.reduce((s, f) => s + f.w * f.e * f.c, 0);
      if (coef === 0) continue;
      x = new Frac(rhs, coef);
      const okDen = d === 3 ? x.d === 1 || x.d === 2 : x.d === 1;
      if (!okDen || x.n === 0 || Math.abs(x.toNumber()) > 12) continue;
      if (right.a === 0 && g ** (right.e * right.c) > 1000) continue;
      break;
    }
    const num0 = left.filter((f) => f.w === 1).map((f) => factorTex(g, f)).join(' \\cdot ');
    const den0 = left.filter((f) => f.w === -1).map((f) => factorTex(g, f)).join(' \\cdot ');
    const lhs = den0 ? `\\dfrac{${num0}}{${den0}}` : num0;
    const rhs = right.a === 0 ? num(g ** (right.e * right.c)) : factorTex(g, right);
    // Rewritten with base g.
    const conv = (f: PowFactor) => `${g}^{${expTex(f.e * f.a, f.e * f.c)}}`;
    const convLine = [...left, ...(right.a === 0 ? [] : [right])]
      .filter((f) => f.e !== 1)
      .map((f) => `$${factorTex(g, f)} = (${g}^{${f.e}})^{${expTex(f.a, f.c)}} = ${conv(f)}$`)
      .join(', ');
    const lA = left.reduce((s, f) => s + f.w * f.e * f.a, 0);
    const lC = left.reduce((s, f) => s + f.w * f.e * f.c, 0);
    const rA = right.e * right.a;
    const rC = right.e * right.c;
    const lExp = expTex(lA, lC);
    const rExp = expTex(rA, rC);
    // Trap: equating the exponents as written, ignoring the different bases.
    const traps: { value: Frac; trap: string }[] = [];
    const naiveCoef = left.reduce((s, f) => s + f.w * f.a, 0) - right.a;
    const naiveRhs = right.c - left.reduce((s, f) => s + f.w * f.c, 0);
    if (naiveCoef !== 0) {
      const t = new Frac(naiveRhs, naiveCoef);
      if (!t.eq(x) && t.isTerminating()) traps.push({ value: t, trap: 'alg-ignore-base' });
    }
    const rhsNote = right.a === 0 ? `and $${num(g ** rC)} = ${g}^{${rC}}$` : '';
    const opText = den0
      ? 'Dividing powers of the same base subtracts the exponents'
      : left.length > 1
        ? 'Multiplying powers of the same base adds the exponents'
        : 'Now both sides have the same base';
    return {
      params: { g, left, right },
      q: {
        format: 'ne',
        stem: `If $${lhs} = ${rhs}$, what is the value of $x$?`,
        prefix: '$x =$',
        answer: x,
        traps,
        explanation: `Write every power with base ${g}${convLine ? `: ${convLine}` : ''}${rhsNote ? `, ${rhsNote}` : ''}.

${opText}, so the equation becomes $${g}^{${lExp}} = ${g}^{${rExp}}$. Equal powers of the same base have equal exponents:
$$${lExp} = ${rExp}$$
${lA - rA === 1 ? 'so' : `so $${expTex(lA - rA, 0)} = ${num(rC - lC)}$ and`} $x = ${x.toTex()}${x.isInt() ? '' : ` = ${x.toDecimalString()}`}$.

Setting the exponents equal before converting to one base is the classic mistake: different bases cannot be compared that way.`,
      },
    };
  },
  check(q, { g, left, right }) {
    if (q.format !== 'ne') return 'wrong format';
    const side = (x: number) =>
      left.reduce((s, f) => s + f.w * (f.a * x + f.c) * Math.log(g ** f.e), 0) - (right.a * x + right.c) * Math.log(g ** right.e);
    // The log-difference is linear in x: it must vanish at the answer and nowhere else.
    const x = q.answer.toNumber();
    if (Math.abs(side(x)) > 1e-9) return `not a solution: residual ${side(x)}`;
    if (Math.abs(side(x + 1) - side(x)) < 1e-9) return 'equation is degenerate';
    return null;
  },
};

/* ================================================================== 2. Equivalent power expressions (MCS) */

interface EquivPowParams {
  kind: 'quotient' | 'solve-m' | 'given-k';
  target: Ex;
  vars: string[];
  options: Ex[];
  /** For 'solve-m': bases b1, b2 with b1^m = b2^t. For 'given-k': [g, B, c]. */
  nums: number[];
}

const equivPowMCS: Template<EquivPowParams> = {
  id: 'alg.exponent-equations.equivalent-mcs',
  skill: 'alg.exponent-equations',
  format: 'mcs',
  style: 'rewrite powers in another base',
  generate(rng, d) {
    const kind = rng.pick(d === 1 ? (['quotient', 'given-k'] as const) : (['quotient', 'solve-m', 'given-k'] as const));
    const wrongs: { e: Ex; trap?: string }[] = [];
    let correct: Ex;
    let target: Ex;
    let vars: string[];
    let stem: string;
    let explanation: string;
    let nums: number[] = [];
    if (kind === 'quotient') {
      const g = rng.pick([2, 3]);
      const m = g === 2 ? rng.pick([2, 2, 3]) : 2;
      const B = g ** m;
      const v = rng.pick(['x', 'y']);
      const w = v === 'x' ? 'y' : 'x';
      const sigma = rng.sign();
      // numerator exponent: w + s1 v, denominator: w + s2 v, s1 - s2 = sigma * m
      const s2 = rng.pick(m === 2 ? [-1, 1] : [-1, 1, -2, 2].filter((s) => Math.abs(s + sigma * m) <= 2));
      const s1 = s2 + sigma * m;
      const sv = (s: number): Ex => (s === 1 ? V(v) : mul(N(s), V(v)));
      const numE = s1 === 0 ? V(w) : add(V(w), sv(s1));
      const denE = s2 === 0 ? V(w) : add(V(w), sv(s2));
      target = div(pow(N(g), numE), pow(N(g), denE));
      vars = ['x', 'y'];
      const Bv = (s: number, name: string) => pow(N(B), s === 1 ? V(name) : mul(N(-1), V(name)));
      correct = Bv(sigma, v);
      wrongs.push({ e: Bv(-sigma, v), trap: 'alg-exponent-order' });
      wrongs.push({ e: Bv(sigma, w), trap: 'alg-exponent-cancel' });
      wrongs.push({ e: Bv(-sigma, w) });
      wrongs.push({ e: pow(N(g), mul(V('x'), V('y'))), trap: 'alg-exponent-product' });
      const diff = `(${texEx(numE)}) - (${texEx(denE)})`;
      explanation = `Dividing powers of the same base subtracts the exponents: $${texEx(target)} = ${g}^{${diff}} = ${g}^{${sigma * m}${v}}$.

Since $${g}^{${m}} = ${B}$, $${g}^{${sigma * m}${v}} = (${g}^{${m}})^{${sigma < 0 ? '-' : ''}${v}} = ${texEx(correct)}$.

Subtract in the right order (numerator minus denominator); the other order gives $${texEx(wrongs[0].e)}$.`;
      stem = `Which of the following is equal to $${texEx(target)}$ for all numbers $x$ and $y$?`;
    } else if (kind === 'solve-m') {
      const g = rng.pick([2, 3]);
      const exps = g === 2 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
      let e1: number;
      let e2: number;
      do [e1, e2] = rng.sample(exps, 2);
      while (e2 % e1 === 0 && rng.chance(0.7));
      const b1 = g ** e1;
      const b2 = g ** e2;
      nums = [b1, b2];
      vars = ['t'];
      target = mul(N(new Frac(e2, e1)), V('t'));
      const coefT = (c: Frac): Ex => (c.isInt() ? mul(N(c), V('t')) : div(mul(N(c.n), V('t')), N(c.d)));
      correct = coefT(new Frac(e2, e1));
      wrongs.push({ e: coefT(new Frac(e1, e2)), trap: 'alg-exponent-ratio-inverted' });
      wrongs.push({ e: lx(1, e2 - e1, 't'), trap: 'alg-exponent-difference-added' });
      wrongs.push({ e: V('t'), trap: 'alg-ignore-base' });
      if (b2 % b1 === 0) wrongs.push({ e: mul(N(b2 / b1), V('t')), trap: 'alg-ignore-base' });
      wrongs.push({ e: mul(N(e2), V('t')) }, { e: lx(1, 1, 't') }, { e: mul(N(e1 * e2), V('t')) });
      wrongs.push({ e: mul(N(b2), V('t')) }, { e: pow(V('t'), e2) }, { e: lx(1, -1, 't') }, { e: mul(N(e1 + e2), V('t')) });
      stem = `If $${b1}^{m} = ${b2}^{t}$, then $m$ equals which of the following?`;
      explanation = `Write both sides with base ${g}: ${[e1 === 1 ? '' : `$${b1}^{m} = ${g}^{${e1}m}$`, e2 === 1 ? '' : `$${b2}^{t} = ${g}^{${e2}t}$`].filter(Boolean).join(' and ')}.

Equal powers of ${g} have equal exponents: $${e1 === 1 ? '' : e1}m = ${e2 === 1 ? '' : e2}t$, so $m = ${texEx(correct)}$.

Inverting the fraction gives $${texEx(wrongs[0].e)}$. Check with $t = ${e1}$: $${powT(b2, e1)} = ${powT(g, e1 * e2)} = ${powT(b1, e2)}$, so $m = ${e2}$.`;
    } else {
      const g = rng.pick([2, 3]);
      const e = g === 2 ? rng.pick([2, 3]) : 2;
      const B = g ** e;
      const c = rng.pick(d === 1 ? [1] : [1, 2]);
      nums = [g, B, c];
      vars = ['k'];
      // B^(n + c) = g^(e c) * k^e  where k = g^n
      const coef = g ** (e * c);
      target = mul(N(coef), pow(V('k'), e));
      correct = target;
      wrongs.push({ e: mul(N(g ** c), pow(V('k'), e)), trap: 'alg-exponent-distribute' });
      wrongs.push({ e: add(pow(V('k'), e), N(coef)), trap: 'alg-exponent-add-as-sum' });
      wrongs.push({ e: mul(N(coef), V('k')), trap: 'alg-power-base-mult' });
      wrongs.push({ e: mul(N(B), pow(V('k'), e)) }, { e: pow(V('k'), e * (c + 1)) }, { e: mul(N(coef), pow(V('k'), e + 1)) });
      stem = `If $${g}^{n} = k$, which of the following is equal to $${B}^{${c === 0 ? 'n' : `n + ${c}`}}$ in terms of $k$?`;
      explanation = `Write $${B}$ as $${g}^{${e}}$: $${B}^{n + ${c}} = ${g}^{${e}(n + ${c})} = ${g}^{${e}n} \\cdot ${g}^{${e * c}} = (${g}^{n})^{${e}} \\cdot ${num(coef)} = ${texEx(correct)}$.

Two slips to avoid: $${g}^{${e}(n + ${c})}$ is $${g}^{${e}n + ${e * c}}$, not $${g}^{${e}n + ${c}}$; and $${B}^{n}$ is $(${g}^{n})^{${e}}$, not $${B} \\cdot ${g}^{n}$.`;
    }
    // Keep 4 wrong choices that are really different from the answer and from each other.
    const pickRng = rng;
    const kept: { e: Ex; trap?: string }[] = [];
    const texts = new Set([texEx(correct)]);
    for (const w of wrongs) {
      if (kept.length === 4) break;
      if (texts.has(texEx(w.e))) continue;
      if (sameFunction(w.e, correct, vars, pickRng, 0.5, 3)) continue;
      if (kept.some((k) => sameFunction(k.e, w.e, vars, pickRng, 0.5, 3))) continue;
      texts.add(texEx(w.e));
      kept.push(w);
    }
    const { choices, answer } = textChoices(
      rng,
      `$${texEx(correct)}$`,
      kept.map((w) => ({ text: `$${texEx(w.e)}$`, ...(w.trap ? { trap: w.trap } : {}) })),
    );
    const all = [correct, ...kept.map((k) => k.e)];
    const options = choices.map((c) => all.find((e) => `$${texEx(e)}$` === c.text)!);
    return {
      params: { kind, target, vars, options, nums },
      q: { format: 'mcs', stem, choices, answer, explanation },
    };
  },
  check(q, { kind, target, options, nums }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    if (options.some((o, i) => q.choices[i].text !== `$${texEx(o)}$`)) return 'choice text mismatch';
    const matches: number[] = [];
    options.forEach((o, i) => {
      let ok = true;
      for (let j = 0; j < 8 && ok; j++) {
        const s = 0.5 + 3 * rng.next();
        const s2 = -2 + 4 * rng.next();
        if (kind === 'quotient') {
          ok = close(evalEx(o, { x: s, y: s2 }), evalEx(target, { x: s, y: s2 }), 1e-8);
        } else if (kind === 'solve-m') {
          // Solve b1^m = b2^t for m with logarithms, compare with the choice.
          const m = (s * Math.log(nums[1])) / Math.log(nums[0]);
          ok = close(evalEx(o, { t: s }), m, 1e-9);
        } else {
          const [g, B, c] = nums;
          const n = s2;
          ok = close(evalEx(o, { k: Math.pow(g, n) }), Math.pow(B, n + c), 1e-9);
        }
      }
      if (ok) matches.push(i);
    });
    if (matches.length !== 1) return `${matches.length} matching choices`;
    return matches[0] === q.answer ? null : `expected ${matches[0]}`;
  },
};

/* ================================================================== 3. Powers of x under a condition (QC) */

type Region = 'pos-ne1' | 'gt1' | 'lt1';

interface CasesParams {
  region: Region;
  /** A = (c x^-m)(dd x^n), B = (e x^p)/(f x^q) */
  c: number;
  dd: number;
  m: number;
  n: number;
  e: number;
  f: number;
  p: number;
  q: number;
}

const xp = (k: number) => (k === 1 ? 'x' : `x^{${k}}`);

function casesAnswer(KA: Frac, KB: Frac, P: number, Q: number, region: Region): QCChoice {
  // sign of KA x^P - KB x^Q on the region, x > 0.
  const r = KA.div(KB); // A/B = r x^(P-Q)
  const D = P - Q;
  const onGt1 = (): QCChoice => {
    if (D === 0) return r.gt(1) ? 'A' : r.lt(1) ? 'B' : 'C';
    if (D > 0) return r.cmp(1) >= 0 ? 'A' : 'D';
    return r.cmp(1) <= 0 ? 'B' : 'D';
  };
  const onLt1 = (): QCChoice => {
    if (D === 0) return r.gt(1) ? 'A' : r.lt(1) ? 'B' : 'C';
    if (D > 0) return r.cmp(1) <= 0 ? 'B' : 'D';
    return r.cmp(1) >= 0 ? 'A' : 'D';
  };
  if (region === 'gt1') return onGt1();
  if (region === 'lt1') return onLt1();
  const a = onGt1();
  const b = onLt1();
  return a === b ? a : 'D';
}

const casesQC: Template<CasesParams> = {
  id: 'alg.exponent-equations.cases-qc',
  skill: 'alg.exponent-equations',
  format: 'qc',
  style: 'compare powers of x when x may be above or below 1',
  generate(rng, d) {
    const region: Region = rng.pick(d === 1 ? ['gt1', 'lt1', 'pos-ne1'] : ['pos-ne1', 'pos-ne1', 'gt1', 'lt1']);
    const K = rng.pick([2, 3, 4, 6, 8, 12]);
    const divs = [1, 2, 3, 4, 6, 12].filter((x) => K % x === 0 && x !== K && x !== 1);
    const c = divs.length ? rng.pick(divs) : 1;
    const dd = K / c;
    const f = rng.pick([2, 3, 4]);
    const KBnum = d === 3 && rng.chance(0.4) ? rng.pick([K * 2, K / 2].filter((x) => Number.isInteger(x) && x > 0)) : K;
    const e = KBnum * f;
    let m: number;
    let n: number;
    let p: number;
    let qq: number;
    do {
      m = rng.int(1, 4);
      n = rng.int(1, 5);
      p = rng.int(1, 5);
      qq = rng.int(1, 5);
    } while (n === m || p === qq || (n - m === p - qq && !rng.chance(0.3)) || m === n);
    if (rng.chance(0.18)) {
      // same power after simplifying: the quantities are equal (when the coefficients match)
      qq = rng.int(1, 4);
      p = qq + (n - m);
      if (p < 1) {
        p = rng.int(1, 4);
        qq = p - (n - m);
      }
    }
    const P = n - m;
    const Q = p - qq;
    const KA = new Frac(K);
    const KB = new Frac(e, f);
    const answer = casesAnswer(KA, KB, P, Q, region);
    const info = region === 'pos-ne1' ? '$x > 0$ and $x \\ne 1$' : region === 'gt1' ? '$x > 1$' : '$0 < x < 1$';
    const A = `$\\left(${c === 1 ? '' : c}x^{-${m}}\\right)\\left(${dd === 1 ? '' : dd}${xp(n)}\\right)$`;
    const B = `$\\dfrac{${e}${xp(p)}}{${f}${xp(qq)}}$`;
    const powTex = (k: Frac, P0: number) => `${k.eq(1) ? '' : k.toTex()}${P0 === 0 ? (k.eq(1) ? '1' : '') : P0 === 1 ? 'x' : `x^{${P0}}`}`;
    const traps: QCQuestion['traps'] = {};
    const ifGt1 = casesAnswer(KA, KB, P, Q, 'gt1');
    const ifLt1 = casesAnswer(KA, KB, P, Q, 'lt1');
    if (answer === 'D') {
      if (ifGt1 !== 'D') traps[ifGt1] = 'alg-assumed-x-gt-1';
      if (ifLt1 !== 'D' && ifLt1 !== ifGt1 && !traps[ifLt1]) traps[ifLt1] = 'tested-one-value';
    } else if (region === 'lt1' && ifGt1 !== answer && ifGt1 !== 'D') traps[ifGt1] = 'fraction-power-grows';
    else if (answer !== 'C') traps.D = 'alg-qc-variable-d';
    const sameK = KA.eq(KB);
    const reason = (() => {
      if (sameK && P === Q) return 'The two quantities are the same expression.';
      if (sameK) {
        const hi = Math.max(P, Q);
        const lo = Math.min(P, Q);
        const facts = `For $x > 1$, $${xp(hi)} > ${lo === 0 ? '1' : lo < 0 ? `x^{${lo}}` : xp(lo)}$; for $0 < x < 1$ it is the other way around (for example, with $x = \\frac{1}{2}$).`;
        return facts;
      }
      return `Divide both quantities by the positive number $${powTex(KB, Q)}$: compare $${KA.div(KB).toTex()}${P - Q === 0 ? '' : P - Q === 1 ? 'x' : `x^{${P - Q}}`}$ with 1.`;
    })();
    const regionText =
      region === 'gt1'
        ? 'Here $x > 1$.'
        : region === 'lt1'
          ? 'Here $0 < x < 1$.'
          : 'The condition allows both $0 < x < 1$ and $x > 1$, so try one value of each kind.';
    return {
      params: { region, c, dd, m, n, e, f, p, q: qq },
      q: {
        format: 'qc',
        info,
        quantityA: A,
        quantityB: B,
        answer,
        traps: Object.keys(traps).length ? traps : undefined,
        explanation: `Simplify each quantity with the exponent rules. Quantity A: $${c * dd}x^{-${m} + ${n}} = ${powTex(KA, P)}$. Quantity B: $${KB.eq(1) ? '' : num(KB)}x^{${p} - ${qq}} = ${powTex(KB, Q)}$.

${reason} ${regionText} ${qcEnd(answer)}`,
      },
    };
  },
  check(q, { region, c, dd, m, n, e, f, p, q: qq }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const ok = (x: number) => x > 0 && x !== 1 && (region === 'pos-ne1' || (region === 'gt1' ? x > 1 : x < 1));
    const xs = allowedValues(rng, ok, 300).filter((x) => x < 1e4);
    for (let i = 0; i < 40; i++) xs.push(region === 'gt1' ? 1 + 1e-3 * (i + 1) : region === 'lt1' ? 1 - 1e-3 * (i + 1) : i % 2 ? 1 + 1e-3 * i : 1 - 1e-3 * i);
    const samples = xs.filter(ok).map((x) => [c * Math.pow(x, -m) * dd * Math.pow(x, n), (e * Math.pow(x, p)) / (f * Math.pow(x, qq))] as [number, number]);
    const expected = qcSamples(samples);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. Which expressions equal a power (MCM) */

interface EqPowParams {
  target: Ex;
  options: Ex[];
}

const equalPowersMCM: Template<EqPowParams> = {
  id: 'alg.exponent-equations.equal-powers-mcm',
  skill: 'alg.exponent-equations',
  format: 'mcm',
  style: 'which expressions equal a given power',
  generate(rng, d) {
    const g = rng.pick([2, 3]);
    const e = g === 2 ? rng.pick(d === 1 ? [2] : [2, 2, 3]) : 2;
    const B = g ** e;
    const c = rng.pick(d === 1 ? [1] : [1, 2]);
    const nc = (k: number) => lx(1, k, 'n');
    const target = pow(N(B), nc(c));
    const cands: { e: Ex; ok: boolean; trap?: string; why: string }[] = [];
    const big = `${g}^{${e}n + ${e * c}}`;
    cands.push({ e: pow(N(g), lx(e, e * c, 'n')), ok: true, why: `$${B}^{n + ${c}} = (${g}^{${e}})^{n + ${c}} = ${big}$` });
    cands.push({ e: mul(N(B ** c), pow(N(B), V('n'))), ok: true, why: c === 1 ? `$${B}^{n + 1} = ${B} \\cdot ${B}^{n}$` : `$${B}^{n + ${c}} = ${B}^{${c}} \\cdot ${B}^{n}$ and $${B}^{${c}} = ${B ** c}$` });
    cands.push({ e: pow(pow(N(g), nc(c)), e), ok: true, why: `a power of a power multiplies the exponents: $${e}(n + ${c}) = ${e}n + ${e * c}$` });
    cands.push({ e: div(pow(N(B), nc(c + 1)), N(B)), ok: true, why: `dividing by $${B}$ lowers the exponent by 1` });
    if (B === 4) {
      const term = pow(N(B), c === 1 ? V('n') : nc(c - 1));
      cands.push({ e: add(term, term, term, term), ok: true, why: `four equal terms make $4 \\cdot ${texEx(term)} = 4^{n + ${c}}$` });
    }
    if (e === 2) cands.push({ e: mul(pow(N(g), nc(c)), pow(N(g), nc(c))), ok: true, why: `the exponents add: $(n + ${c}) + (n + ${c}) = 2n + ${2 * c}$` });
    cands.push({ e: pow(N(g), lx(e, c, 'n')), ok: false, trap: 'alg-exponent-distribute', why: `the exponent should be $${e}(n + ${c}) = ${e}n + ${e * c}$, not $${e}n + ${c}$` });
    cands.push({ e: add(pow(N(B), V('n')), N(B ** c)), ok: false, trap: 'alg-exponent-add-as-sum', why: `$${B}^{n + ${c}}$ is the product $${B}^{n} \\cdot ${B ** c}$, not a sum` });
    if (e === 2) {
      const t = pow(N(g), nc(c));
      cands.push({ e: add(t, t), ok: false, trap: 'alg-power-sum', why: `$${texEx(t)} + ${texEx(t)} = 2 \\cdot ${texEx(t)}${g === 2 ? ` = 2^{n + ${c + 1}}` : ''}$, which is not $${B}^{n + ${c}}$` });
    }
    cands.push({ e: mul(N(e), pow(N(g), nc(c))), ok: false, trap: 'alg-power-base-mult', why: `$${B} = ${g}^{${e}}$, not $${e} \\cdot ${g}$, so $${B}^{k}$ is not $${e} \\cdot ${g}^{k}$` });
    if (c === 2) cands.push({ e: pow(pow(N(B), V('n')), 2), ok: false, trap: 'alg-exponent-add-as-mult', why: `$(${B}^{n})^{2} = ${B}^{2n}$, not $${B}^{n + 2}$` });
    else {
      const t = pow(N(B), V('n'));
      cands.push({ e: add(t, t), ok: false, trap: 'alg-power-sum', why: `$${B}^{n} + ${B}^{n} = 2 \\cdot ${B}^{n}$, while $${B}^{n + 1} = ${B} \\cdot ${B}^{n}$` });
    }
    // Remove wrong candidates that happen to be equal (and drop duplicates).
    const good = rng.shuffle(cands.filter((x) => x.ok));
    const bad = rng.shuffle(cands.filter((x) => !x.ok && !sameFunction(x.e, target, ['n'], rng, 0, 4)));
    const total = rng.pick([5, 6]);
    const nGood = rng.int(d === 1 ? 1 : 2, 3);
    const picked = rng.shuffle([...good.slice(0, nGood), ...bad.slice(0, total - nGood)]);
    const { choices, answer } = flaggedChoices(picked.map((x) => ({ text: `$${texEx(x.e)}$`, correct: x.ok, ...(x.trap ? { trap: x.trap } : {}) })));
    return {
      params: { target, options: picked.map((x) => x.e) },
      q: {
        format: 'mcm',
        stem: `Which of the following are equal to $${texEx(target)}$ for every integer $n$?`,
        instruction: 'Indicate all such expressions.',
        choices,
        answer,
        explanation: `Rewrite everything with base ${g}: $${texEx(target)} = ${big}$. Then check each choice:
${picked.map((x) => `- $${texEx(x.e)}$: ${x.ok ? 'equal' : 'not equal'}, ${x.why}.`).join('\n')}

A quick test with $n = 0$: $${texEx(target)}$ becomes $${B ** c}$, and every choice that is equal must give $${B ** c}$ too.`,
      },
    };
  },
  check(q, { target, options }, rng) {
    if (q.format !== 'mcm') return 'wrong format';
    if (options.some((o, i) => q.choices[i].text !== `$${texEx(o)}$`)) return 'choice text mismatch';
    const expected = options.flatMap((o, i) => {
      // integers and non-integers
      const ns = [0, 1, 2, 5, ...Array.from({ length: 6 }, () => rng.next() * 6 - 1)];
      return ns.every((n) => close(evalEx(o, { n }), evalEx(target, { n }), 1e-9)) ? [i] : [];
    });
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

export const exponentTemplates = [solveExpNE, equivPowMCS, casesQC, equalPowersMCM];
