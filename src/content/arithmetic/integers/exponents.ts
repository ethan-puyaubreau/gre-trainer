import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { range } from '../../../engine/math';
import { num } from '../../../engine/tex';
import { term } from '../../../engine/text';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { QC_WORDS, expectMcm, expectMcsBy, expectNe, expectQc, listAnd } from './util';

/* ------------------------------------------------------------------ 1. Negative exponents, negative bases (QC) */

interface PowForm {
  /** base is negative */
  neg: boolean;
  /** base is 1/a instead of a */
  recip: boolean;
  /** exponent written as -n instead of n */
  flip: boolean;
}

type NegKind = 'two-forms' | 'vs-const' | 'two-bases' | 'sum-neg-powers';

interface NegExpParams {
  kind: NegKind;
  a: number;
  b: number;
  /** sign of n: 1, -1, or 0 for "nonzero integer" */
  nSign: 1 | -1 | 0;
  parity: 'even' | 'odd' | 'any';
  fa: PowForm;
  fb: PowForm | null;
  c: number;
  terms: number;
}

const formTex = (f: PowForm, a: number) => {
  const base = f.recip ? (f.neg ? `\\left(-\\frac{1}{${a}}\\right)` : `\\left(\\frac{1}{${a}}\\right)`) : f.neg ? `(-${a})` : `${a}`;
  return `${base}^{${f.flip ? '-n' : 'n'}}`;
};

/** Region of (base)^n for an integer n with |n| >= 1: sign and whether |value| > 1. */
function region(f: PowForm, nSign: 1 | -1, odd: boolean): { sign: 1 | -1; big: boolean } {
  const e = (f.recip ? -1 : 1) * (f.flip ? -1 : 1) * nSign;
  return { sign: f.neg && odd ? -1 : 1, big: e > 0 };
}

function compareRegions(x: { sign: 1 | -1; big: boolean }, y: { sign: 1 | -1; big: boolean }, sameMagnitude: boolean): QCChoice {
  if (x.sign !== y.sign) return x.sign > 0 ? 'A' : 'B';
  if (sameMagnitude) return 'C';
  if (x.big === y.big) throw new Error('compareRegions: undetermined');
  const xBigger = x.big; // |x| > |y|
  return x.sign > 0 ? (xBigger ? 'A' : 'B') : xBigger ? 'B' : 'A';
}

function regionVsConst(r: { sign: 1 | -1; big: boolean }, c: number): QCChoice {
  // value lies in (1, inf), (0, 1), (-1, 0) or (-inf, -1); c is -1, 0 or 1
  const lo = r.sign > 0 ? (r.big ? 1 : 0) : r.big ? -Infinity : -1;
  const hi = r.sign > 0 ? (r.big ? Infinity : 1) : r.big ? -1 : 0;
  if (lo >= c) return 'A';
  if (hi <= c) return 'B';
  throw new Error('regionVsConst: straddles');
}

const regionText = (r: { sign: 1 | -1; big: boolean }) =>
  r.sign > 0 ? (r.big ? 'greater than 1' : 'between 0 and 1') : r.big ? 'less than $-1$' : 'between $-1$ and 0';

/** Equivalent form with a positive exponent m = |n| (TeX), for the explanation. */
function positiveForm(f: PowForm, a: number, nSign: 1 | -1, odd: boolean | null, letter: string): string {
  const e = (f.recip ? -1 : 1) * (f.flip ? -1 : 1) * nSign;
  if (f.neg && odd === null) return e > 0 ? `(-${a})^{${letter}}` : `\\left(-\\frac{1}{${a}}\\right)^{${letter}}`;
  const sign = f.neg && odd ? '-' : '';
  return e > 0 ? `${sign}${a}^{${letter}}` : `${sign}\\frac{1}{${a}^{${letter}}}`;
}

const valueOf = (f: PowForm, a: number, n: number): Frac => {
  const base = f.recip ? frac(f.neg ? -1 : 1, a) : frac(f.neg ? -a : a);
  return base.pow(f.flip ? -n : n);
};

const allowedN = (nSign: 1 | -1 | 0, parity: 'even' | 'odd' | 'any') =>
  [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6].filter((n) => (nSign === 0 || Math.sign(n) === nSign) && (parity === 'any' || (parity === 'even') === (n % 2 === 0)));

const NEG_FORMS: PowForm[] = [
  { neg: false, recip: true, flip: false }, // (1/a)^n
  { neg: true, recip: false, flip: false }, // (-a)^n
  { neg: true, recip: true, flip: false }, // (-1/a)^n
  { neg: false, recip: false, flip: true }, // a^-n
  { neg: true, recip: false, flip: true }, // (-a)^-n
  { neg: false, recip: false, flip: false }, // a^n
];

const negativeExponentQC: Template<NegExpParams> = {
  id: 'arith.exponents.negative-exponent-qc',
  skill: 'arith.exponents',
  format: 'qc',
  style: 'negative exponents and negative bases with an unknown n',
  generate(rng, diff) {
    const kinds: NegKind[] = diff === 1 ? ['two-forms', 'two-bases', 'sum-neg-powers'] : diff === 2 ? ['two-forms', 'vs-const', 'sum-neg-powers', 'two-bases'] : ['two-forms', 'vs-const', 'two-forms', 'two-bases'];
    const kind = rng.pick(kinds);
    for (;;) {
      const a = rng.pick([2, 3, 4, 5]);
      let b = 0;
      let nSign: 1 | -1 | 0 = rng.chance(0.75) ? -1 : 1;
      let parity: NegExpParams['parity'] = rng.pick(['even', 'odd', 'any'] as const);
      let fa: PowForm = rng.pick(NEG_FORMS);
      let fb: PowForm | null = null;
      let c = 0;
      let terms = 0;
      let answer: QCChoice;
      let info: string | undefined;
      let quantityA: string;
      let quantityB: string;
      let explanation: string;
      let traps: QCQuestion['traps'];
      const nWord = (sgn: 1 | -1 | 0, par: string) => `$n$ is ${par === 'any' ? (sgn === 0 ? 'a nonzero' : sgn < 0 ? 'a negative' : 'a positive') : par === 'even' ? 'an even' : 'an odd'}${par !== 'any' && sgn !== 0 ? (sgn < 0 ? ' negative' : ' positive') : par !== 'any' ? ' nonzero' : ''} integer.`;

      if (kind === 'sum-neg-powers') {
        terms = rng.pick([2, 3]);
        const k = rng.pick([2, 3, 4, 5]);
        b = k;
        const total = range(1, terms).reduce((s, i) => s + k ** i, 0);
        const value = total / k; // 1 + k (+ k^2)
        const roll = rng.next();
        c = roll < 0.35 ? value : roll < 0.7 ? value - rng.int(1, 3) : value + rng.int(1, 3);
        answer = qcCompare(value, c);
        const wrongValue = range(1, terms).reduce((s, i) => s.add(frac(1, k ** i)), frac(0)).div(k);
        const trapAns = qcCompare(wrongValue, c);
        traps = trapAns !== answer ? { [trapAns]: 'int-negative-exponent' } : undefined;
        const termsTex = range(1, terms)
          .map((i) => `\\left(\\frac{1}{${k}}\\right)^{-${i}}`)
          .join(' + ');
        quantityA = `$\\dfrac{${termsTex}}{${k}}$`;
        quantityB = `$${c}$`;
        const powers = range(1, terms).map((i) => (i === 1 ? `${k}` : `${k}^{${i}}`));
        explanation = `A negative exponent takes the reciprocal: $\\left(\\frac{1}{${k}}\\right)^{-i} = ${k}^i$. So the numerator is $${powers.join(' + ')} = ${total}$, and Quantity A is $\\frac{${total}}{${k}} = ${value}$.

Compare ${value} with ${c}: ${QC_WORDS[answer]}. (${answer})

Reading $\\left(\\frac{1}{${k}}\\right)^{-1}$ as $\\frac{1}{${k}}$ (or as a negative number) makes Quantity A less than 1.`;
        return {
          params: { kind, a, b, nSign: 1, parity: 'any', fa, fb, c, terms },
          q: { format: 'qc', quantityA, quantityB, answer, traps, explanation },
        };
      }

      if (kind === 'two-bases') {
        // (1/a)^n vs (1/b)^n, a < b
        b = rng.pick([2, 3, 4, 5, 6].filter((x) => x > a));
        if (!b) continue;
        nSign = rng.pick([1, -1, -1, 0] as const);
        parity = 'any';
        fa = { neg: false, recip: true, flip: false };
        fb = { neg: false, recip: true, flip: false };
        answer = nSign > 0 ? 'A' : nSign < 0 ? 'B' : 'D';
        traps = nSign < 0 ? { A: 'int-negative-exponent' } : nSign === 0 ? { A: 'tested-one-value' } : undefined;
        info = nWord(nSign, 'any');
        quantityA = `$${formTex(fa, a)}$`;
        quantityB = `$${formTex(fb, b)}$`;
        const ex = nSign === 0 ? null : nSign > 0 ? 2 : -2;
        explanation =
          nSign > 0
            ? `For positive $n$, $\\left(\\frac{1}{${a}}\\right)^n = \\frac{1}{${a}^n}$ and $\\left(\\frac{1}{${b}}\\right)^n = \\frac{1}{${b}^n}$. Since $${a}^n < ${b}^n$, the first fraction is greater. For example, $n = 2$: $\\frac{1}{${a * a}} > \\frac{1}{${b * b}}$. (A)`
            : nSign < 0
              ? `Write $n = -m$ with $m$ a positive integer. Then $\\left(\\frac{1}{${a}}\\right)^n = ${a}^m$ and $\\left(\\frac{1}{${b}}\\right)^n = ${b}^m$, and $${a}^m < ${b}^m$. For example, $n = ${ex}$: $${a * a} < ${b * b}$. (B)

With a negative exponent the comparison flips: the smaller fraction raised to a negative power gives the larger number.`
              : `If $n$ is positive, Quantity A is greater: $n = 1$ gives $\\frac{1}{${a}} > \\frac{1}{${b}}$. If $n$ is negative, Quantity B is greater: $n = -1$ gives $${a} < ${b}$. The relationship cannot be determined. (D)`;
        return {
          params: { kind, a, b, nSign, parity, fa, fb, c, terms },
          q: { format: 'qc', info, quantityA, quantityB, answer, traps, explanation },
        };
      }

      // two-forms / vs-const, same base a (nSign is +1 or -1 here)
      const sgn = nSign < 0 ? -1 : 1;
      const parities = parity === 'any' ? [false, true] : [parity === 'odd'];
      if (kind === 'two-forms') {
        fb = rng.pick(NEG_FORMS.filter((f) => f !== fa));
        if (!fa.neg && !fb.neg && rng.chance(0.7)) continue; // keep negative bases common
        const results = parities.map((odd) => {
          const ra = region(fa, sgn, odd);
          const rb = region(fb!, sgn, odd);
          const eA = (fa.recip ? -1 : 1) * (fa.flip ? -1 : 1);
          const eB = (fb!.recip ? -1 : 1) * (fb!.flip ? -1 : 1);
          return compareRegions(ra, rb, eA === eB);
        });
        answer = new Set(results).size === 1 ? results[0] : 'D';
        // the classic slips
        const noSign = (f: PowForm): PowForm => ({ ...f, neg: false });
        const slipSign = (() => {
          const rs = parities.map((odd) => {
            const ea = (fa.recip ? -1 : 1) * (fa.flip ? -1 : 1);
            const eb = (fb!.recip ? -1 : 1) * (fb!.flip ? -1 : 1);
            return compareRegions(region(noSign(fa), sgn, odd), region(noSign(fb!), sgn, odd), ea === eb);
          });
          return new Set(rs).size === 1 ? rs[0] : 'D';
        })();
        const slipExp = (() => {
          const rs = parities.map((odd) => {
            const ea = (fa.recip ? -1 : 1) * (fa.flip ? -1 : 1);
            const eb = (fb!.recip ? -1 : 1) * (fb!.flip ? -1 : 1);
            return compareRegions(region(fa, 1, odd), region(fb!, 1, odd), ea === eb);
          });
          return new Set(rs).size === 1 ? rs[0] : 'D';
        })();
        traps = {};
        if (slipSign !== answer) traps[slipSign] = 'int-negative-base-sign';
        if (sgn < 0 && slipExp !== answer && !traps[slipExp]) traps[slipExp] = 'int-negative-exponent';
        if (parity === 'any' && answer === 'D') {
          const first = results[0];
          if (!traps[first]) traps[first] = 'tested-one-value';
        }
        if (!Object.keys(traps).length) traps = undefined;
        quantityA = `$${formTex(fa, a)}$`;
        quantityB = `$${formTex(fb, a)}$`;
      } else {
        c = rng.pick([-1, 0, 1]);
        const results: QCChoice[] = [];
        let ok = true;
        for (const odd of parities) {
          try {
            results.push(regionVsConst(region(fa, sgn, odd), c));
          } catch {
            ok = false;
          }
        }
        if (!ok) continue;
        answer = new Set(results).size === 1 ? results[0] : 'D';
        const slip = parities.map((odd) => regionVsConst(region({ ...fa, neg: false }, sgn, odd), c));
        const slipAns = new Set(slip).size === 1 ? slip[0] : 'D';
        const slip2 = parities.map((odd) => regionVsConst(region(fa, 1, odd), c));
        const slip2Ans = new Set(slip2).size === 1 ? slip2[0] : 'D';
        traps = {};
        if (slipAns !== answer) traps[slipAns] = 'int-negative-base-sign';
        if (sgn < 0 && slip2Ans !== answer && !traps[slip2Ans]) traps[slip2Ans] = 'int-negative-exponent';
        if (!Object.keys(traps).length) traps = undefined;
        quantityA = `$${formTex(fa, a)}$`;
        quantityB = `$${c}$`;
      }
      // the parity of n changes the value only through a negative base: with positive bases do not mention it
      const signed = fa.neg || !!fb?.neg;
      if (!signed) parity = 'any';
      info = nWord(sgn, parity);

      // explanation
      const letter = sgn < 0 ? 'm' : 'n';
      const intro = sgn < 0 ? `Write $n = -m$, where $m$ is a positive${parity === 'any' ? '' : ` ${parity}`} integer.` : '';
      const describe = (form: PowForm, odd: boolean) => `$${formTex(form, a)} = ${positiveForm(form, a, sgn, odd, letter)}$`;
      const caseLines = parities.map((odd) => {
        const partA = `${describe(fa, odd)} (${regionText(region(fa, sgn, odd))})`;
        const partB = fb ? `${describe(fb, odd)} (${regionText(region(fb, sgn, odd))})` : `Quantity B is $${c}$`;
        return { odd, text: `${partA}; ${partB}` };
      });
      const exN = (odd: boolean) => (sgn < 0 ? (odd ? -1 : -2) : odd ? 1 : 2);
      const exVal = (form: PowForm, odd: boolean) => valueOf(form, a, exN(odd)).toTex();
      const exampleFor = (odd: boolean) => `$n = ${exN(odd)}$ gives $${exVal(fa, odd)}$ and $${fb ? exVal(fb, odd) : c}$`;
      if (parity === 'any' && signed) {
        const [ev, od] = caseLines;
        explanation = `${intro ? `${intro} ` : ''}The parity of $n$ is not given: check both cases.

- If $n$ is even: ${ev.text}. ${cap(QC_WORDS[results0(fa, fb, sgn, false, c)])}.
- If $n$ is odd: ${od.text}. ${cap(QC_WORDS[results0(fa, fb, sgn, true, c)])}.

${answer === 'D' ? `The two cases disagree (for example, ${exampleFor(false)}, while ${exampleFor(true)}), so the relationship cannot be determined. (D)` : `Both cases agree: ${QC_WORDS[answer]}. (${answer})`}`;
      } else {
        explanation = `${intro ? `${intro} ` : ''}${cap(caseLines[0].text)}.

So ${QC_WORDS[answer]}. For example, ${exampleFor(parity === 'odd')}. (${answer})`;
      }
      const tips: string[] = [];
      if (fa.neg || fb?.neg) tips.push(parity === 'any' ? 'a negative base gives a positive value for even exponents and a negative one for odd exponents' : `a negative base raised to an ${parity} power is ${parity === 'even' ? 'positive' : 'negative'}`);
      if (sgn < 0) tips.push('a negative exponent means the reciprocal, not a negative value');
      if (tips.length) explanation += `\n\nRemember: ${listAnd(tips)}.`;
      return {
        params: { kind, a, b, nSign: sgn, parity, fa, fb, c, terms },
        q: { format: 'qc', info, quantityA, quantityB, answer, traps, explanation },
      };
    }
  },
  check(q, p) {
    if (p.kind === 'sum-neg-powers') {
      const k = p.b;
      const A = range(1, p.terms)
        .reduce((s, i) => s.add(frac(1, k).pow(-i)), frac(0))
        .div(k);
      return expectQc(q, qcCompare(A, p.c));
    }
    const ns = allowedN(p.nSign, p.parity);
    const samples: [Frac, Frac][] = ns.map((n) => [valueOf(p.fa, p.a, n), p.fb ? valueOf(p.fb, p.kind === 'two-bases' ? p.b : p.a, n) : frac(p.c)]);
    return expectQc(q, qcFromSamples(samples));
  },
};

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** One-case comparison used by the explanation. */
function results0(fa: PowForm, fb: PowForm | null, sgn: 1 | -1, odd: boolean, c: number): QCChoice {
  if (!fb) return regionVsConst(region(fa, sgn, odd), c);
  const eA = (fa.recip ? -1 : 1) * (fa.flip ? -1 : 1);
  const eB = (fb.recip ? -1 : 1) * (fb.flip ? -1 : 1);
  return compareRegions(region(fa, sgn, odd), region(fb, sgn, odd), eA === eB);
}

/* ------------------------------------------------------------------ 2. Factoring powers of a common base (QC) */

type BaseForm = 'diff-over-b' | 'double' | 'triple' | 'next-minus' | 'power-of-power' | 'b-times';

interface CommonBaseParams {
  form: BaseForm;
  b: number;
  n: number;
  /** Quantity B = k * b^g */
  k: number;
  g: number;
  /** n unknown: Quantity A is kb^n (k equal powers), Quantity B is b^n + c */
  unknownN?: { copies: number; c: number };
}

/** Exact value of Quantity A by direct BigInt arithmetic (checks). */
function baseFormValue(form: BaseForm, b: number, n: number): bigint {
  const B = BigInt(b);
  const N = BigInt(n);
  switch (form) {
    case 'diff-over-b':
      return (B ** N - B ** (N - 1n)) / B;
    case 'double':
      return B ** N + B ** N;
    case 'triple':
      return B ** N + B ** N + B ** N;
    case 'next-minus':
      return B ** (N + 1n) - B ** N;
    case 'power-of-power':
      return (B * B) ** N;
    case 'b-times':
      return B * B ** N;
  }
}

const baseFormTex = (form: BaseForm, b: number, n: number) => {
  switch (form) {
    case 'diff-over-b':
      return `\\dfrac{${b}^{${n}} - ${b}^{${n - 1}}}{${b}}`;
    case 'double':
      return `${b}^{${n}} + ${b}^{${n}}`;
    case 'triple':
      return `${b}^{${n}} + ${b}^{${n}} + ${b}^{${n}}`;
    case 'next-minus':
      return `${b}^{${n + 1}} - ${b}^{${n}}`;
    case 'power-of-power':
      return `(${b}^{2})^{${n}}`;
    case 'b-times':
      return `${b} \\cdot ${b}^{${n}}`;
  }
};

const commonBaseQC: Template<CommonBaseParams> = {
  id: 'arith.exponents.common-base-qc',
  skill: 'arith.exponents',
  format: 'qc',
  style: 'factor sums and differences of powers of one base',
  generate(rng, diff) {
    // Sometimes n is only known to be a positive integer: k equal powers against one power plus a constant can flip with n (answer D).
    if (diff >= 2 && rng.chance(0.3)) {
      const b = rng.pick([2, 3, 5]);
      const copies = rng.pick([2, 3]);
      const gap = (copies - 1) * b; // at n = 1 the quantities differ by gap - c
      const flips = rng.chance(0.7);
      const c = flips ? gap * rng.pick([1, 2, 3, 5]) + rng.pick([0, 0, 1]) : rng.int(1, gap - 1);
      const sum = Array(copies).fill(`${b}^{n}`).join(' + ');
      const first: QCChoice = qcCompare(copies * b, b + c); // n = 1
      let nStar = 1;
      while (BigInt(copies - 1) * BigInt(b) ** BigInt(nStar) <= BigInt(c)) nStar++;
      const answer: QCChoice = flips ? 'D' : 'A';
      const word = (r: QCChoice) => (r === 'C' ? 'equal to' : r === 'A' ? 'greater than' : 'less than');
      return {
        params: { form: 'double', b, n: 0, k: c, g: 0, unknownN: { copies, c } },
        q: {
          format: 'qc',
          info: '$n$ is a positive integer.',
          quantityA: `$${sum}$`,
          quantityB: `$${b}^{n} + ${c}$`,
          answer,
          traps: flips ? { [first]: 'tested-one-value' } : undefined,
          explanation: `${copies === 2 ? 'Two equal powers' : 'Three equal powers'} add like $x + x${copies === 3 ? ' + x' : ''} = ${copies}x$, so Quantity A is $${copies} \\cdot ${b}^{n}$. Subtract $${b}^{n}$ from both quantities: compare $${copies - 1 === 1 ? '' : `${copies - 1} \\cdot `}${b}^{n}$ with ${c}.

${
            flips
              ? `For $n = 1$ this is $${(copies - 1) * b}$ against ${c}: Quantity A is ${word(first)} Quantity B. For $n = ${nStar}$ it is $${(copies - 1) * b ** nStar}$ against ${c}: Quantity A is greater. Two allowed values disagree, so the relationship cannot be determined. (D)

Trap: testing $n = 1$ alone suggests ${first === 'C' ? 'that the quantities are equal' : `that Quantity ${first === 'A' ? 'A' : 'B'} is greater`}; the power keeps growing with $n$.`
              : `Already for $n = 1$ the powers are $${(copies - 1) * b}$, more than ${c}, and they only grow. So Quantity A is greater. (A)`
          }

Exponents add only when powers are multiplied: $${b}^{n} + ${b}^{n} \\ne ${b}^{2n}$.`,
        },
      };
    }
    const forms: BaseForm[] = diff === 1 ? ['double', 'triple', 'b-times', 'power-of-power'] : diff === 2 ? ['diff-over-b', 'double', 'next-minus', 'power-of-power'] : ['diff-over-b', 'next-minus', 'triple', 'double'];
    const form = rng.pick(forms);
    const b = form === 'triple' ? rng.pick([2, 3]) : form === 'double' ? rng.pick([2, 2, 3, 5]) : rng.pick([2, 3, 5, 10]);
    const n = rng.int(diff === 1 ? 8 : 15, diff === 1 ? 20 : 40);
    // normalized value: coef * b^exp
    const norm: Record<BaseForm, [number, number]> = {
      'diff-over-b': [b - 1, n - 2],
      double: [2, n],
      triple: [3, n],
      'next-minus': [b - 1, n],
      'power-of-power': [1, 2 * n],
      'b-times': [1, n + 1],
    };
    let [coef, e] = norm[form];
    // absorb the coefficient when it is a power of b
    while (coef % b === 0 && coef > 1) {
      coef /= b;
      e += 1;
    }
    const roll = rng.next();
    const rel: QCChoice = roll < 0.33 ? 'A' : roll < 0.56 ? 'B' : 'C';
    let k: number;
    let g: number;
    if (rel === 'C') {
      k = coef;
      g = e;
    } else if (coef === 1) {
      k = 1;
      g = rel === 'A' ? e - 1 : e + 1;
      if (rng.chance(0.4)) {
        k = rel === 'A' ? b - 1 : b + 1;
        g = e - 1;
        if (k === b) k = 1;
      }
    } else if (rng.chance(0.5)) {
      // a pure power of b just below or just above coef * b^e
      k = 1;
      let j = 0;
      while (b ** (j + 1) < coef) j++; // b^j < coef <= b^(j+1)
      g = rel === 'A' ? e + j : e + j + 1;
    } else {
      k = rel === 'A' ? coef - 1 : coef + 1;
      g = e;
      if (k % b === 0) {
        k = 1;
        g = e + 1;
        if (rel === 'A') g = e;
      }
    }
    // relation via exponent arithmetic: coef*b^e vs k*b^g
    const m = Math.min(e, g);
    const answer = qcCompare(coef * b ** (e - m), k * b ** (g - m));
    // the classic slips and what they would give
    const wrong: Partial<Record<BaseForm, [bigint, string]>> = {
      'diff-over-b': [BigInt(b) ** 1n / BigInt(b), 'int-subtracted-exponents'],
      double: [BigInt(b) ** BigInt(2 * n), 'int-added-like-powers'],
      triple: [BigInt(b) ** BigInt(3 * n), 'int-added-like-powers'],
      'next-minus': [BigInt(b), 'int-subtracted-exponents'],
      'power-of-power': [BigInt(b) ** BigInt(n + 2), 'int-power-of-power'],
    };
    let traps: QCQuestion['traps'];
    const w = wrong[form];
    if (w) {
      const Bv = BigInt(k) * BigInt(b) ** BigInt(g);
      const trapAns: QCChoice = w[0] > Bv ? 'A' : w[0] < Bv ? 'B' : 'C';
      if (trapAns !== answer) traps = { [trapAns]: w[1] };
    }
    const Btex = k === 1 ? `${b}^{${g}}` : `${k} \\cdot ${b}^{${g}}`;
    const valTex = coef === 1 ? `${b}^{${e}}` : `${coef} \\cdot ${b}^{${e}}`;
    const steps: Record<BaseForm, string> = {
      'diff-over-b': `Factor out $${b}^{${n - 1}}$: $${b}^{${n}} - ${b}^{${n - 1}} = ${b}^{${n - 1}}(${b} - 1) = ${b - 1 === 1 ? '' : `${b - 1} \\cdot `}${b}^{${n - 1}}$. Dividing by ${b} lowers the exponent by 1: Quantity A $= ${valTex}$.`,
      double: `Two equal powers add like $x + x = 2x$: $${b}^{${n}} + ${b}^{${n}} = 2 \\cdot ${b}^{${n}}${b === 2 ? ` = 2^{${n + 1}}` : ''}$.`,
      triple: `Three equal powers add like $x + x + x = 3x$: $3 \\cdot ${b}^{${n}}${b === 3 ? ` = 3^{${n + 1}}` : ''}$.`,
      'next-minus': `Factor out $${b}^{${n}}$: $${b}^{${n + 1}} - ${b}^{${n}} = ${b}^{${n}}(${b} - 1) = ${valTex}$.`,
      'power-of-power': `A power of a power multiplies the exponents: $(${b}^{2})^{${n}} = ${b}^{${2 * n}}$.`,
      'b-times': `Multiplying by one more factor of ${b} adds 1 to the exponent: $${b} \\cdot ${b}^{${n}} = ${b}^{${n + 1}}$.`,
    };
    const compare =
      answer === 'C'
        ? `That is exactly Quantity B. (C)`
        : `Compare $${valTex}$ with $${Btex}$: divide both by $${b}^{${m}}$ to get ${coef * b ** (e - m)} and ${k * b ** (g - m)}, so ${QC_WORDS[answer]}. (${answer})`;
    const slips: Partial<Record<BaseForm, string>> = {
      'diff-over-b': `Trap: $${b}^{${n}} - ${b}^{${n - 1}}$ is not $${b}$: exponents subtract only when you divide powers.`,
      'next-minus': `Trap: $${b}^{${n + 1}} - ${b}^{${n}}$ is not $${b}$: exponents subtract only when you divide powers.`,
      double: `Trap: $${b}^{${n}} + ${b}^{${n}}$ is not $${b}^{${2 * n}}$: exponents add only when you multiply powers.`,
      triple: `Trap: the sum is not $${b}^{${3 * n}}$: exponents add only when you multiply powers.`,
      'power-of-power': `Trap: it is not $${b}^{${n + 2}}$: exponents multiply for a power of a power.`,
    };
    return {
      params: { form, b, n, k, g },
      q: {
        format: 'qc',
        quantityA: `$${baseFormTex(form, b, n)}$`,
        quantityB: `$${Btex}$`,
        answer,
        traps,
        explanation: `${steps[form]}${form === 'diff-over-b' || form === 'next-minus' ? '' : ` So Quantity A $= ${valTex}$.`}

${compare}${slips[form] ? `\n\n${slips[form]}` : ''}`,
      },
    };
  },
  check(q, { form, b, n, k, g, unknownN }) {
    if (unknownN) {
      const samples = Array.from({ length: 14 }, (_, i) => i + 1).map((nn) => [unknownN.copies * b ** nn, b ** nn + unknownN.c] as [number, number]);
      return expectQc(q, qcFromSamples(samples));
    }
    const A = baseFormValue(form, b, n);
    const B = BigInt(k) * BigInt(b) ** BigInt(g);
    return expectQc(q, A > B ? 'A' : A < B ? 'B' : 'C');
  },
};

/* ------------------------------------------------------------------ 3. Equations with powers of a common base (NE) */

type EqKind = 'product-sum' | 'mixed-product' | 'nested' | 'repeated-sum' | 'reciprocal';

interface EqParams {
  kind: EqKind;
  base: number;
  /** generic integer parameters, meaning depends on kind */
  p: number;
  q: number;
  c: number;
  d: number;
  k: number;
}

/** BigInt rational helpers for exact checks: [numerator, denominator]. */
type BR = [bigint, bigint];
const bpow = (b: number, e: number): BR => (e >= 0 ? [BigInt(b) ** BigInt(e), 1n] : [1n, BigInt(b) ** BigInt(-e)]);
const bmul = (x: BR, y: BR): BR => [x[0] * y[0], x[1] * y[1]];
const badd = (x: BR, y: BR): BR => [x[0] * y[1] + y[0] * x[1], x[1] * y[1]];
const beq = (x: BR, y: BR) => x[0] * y[1] === y[0] * x[1];
const fracPow = (n: number, d: number, e: number): BR => (e >= 0 ? [BigInt(n) ** BigInt(e), BigInt(d) ** BigInt(e)] : [BigInt(d) ** BigInt(-e), BigInt(n) ** BigInt(-e)]);

const sameBaseEquation: Template<EqParams> = {
  id: 'arith.exponents.same-base-equation',
  skill: 'arith.exponents',
  format: 'ne',
  style: 'solve an equation by rewriting powers with a common base',
  generate(rng, diff) {
    const kinds: EqKind[] = diff === 1 ? ['product-sum', 'mixed-product'] : diff === 2 ? ['mixed-product', 'nested', 'repeated-sum'] : ['nested', 'repeated-sum', 'reciprocal'];
    const kind = rng.pick(kinds);
    for (;;) {
      let base = 2;
      let p = 0;
      let q = 0;
      let c = 0;
      let d = 0;
      let k = 0;
      let answer: number;
      let stem: string;
      let prefix: string | undefined;
      let explanation: string;
      const traps: { value: number; trap: string }[] = [];
      if (kind === 'product-sum') {
        // (b^x)(b^2)^y = b^k ; ask x + 2y
        base = rng.pick([2, 3, 5]);
        k = rng.int(8, base === 2 ? 30 : 18);
        const sq = base * base;
        stem = `If $(${base}^{x})(${sq}^{y}) = ${base}^{${k}}$, what is the value of $x + 2y$?`;
        prefix = '$x + 2y =$';
        answer = k;
        explanation = `Write ${sq} as a power of ${base}: $${sq}^{y} = (${base}^2)^y = ${base}^{2y}$. Then $${base}^{x} \\cdot ${base}^{2y} = ${base}^{x + 2y}$, so $x + 2y = ${k}$.

You do not need $x$ and $y$ separately.`;
      } else if (kind === 'mixed-product') {
        // (b^p)^x * (b^q)^c = b^k ; ask x
        base = rng.pick([2, 3]);
        [p, q] = rng.pick([
          [2, 3],
          [3, 2],
          [2, 4],
          [4, 3],
        ] as [number, number][]);
        if (base === 3 && (p === 4 || q === 4)) continue;
        const x = rng.int(2, 9);
        c = rng.int(2, 6);
        k = p * x + q * c;
        if (k > 40) continue;
        answer = x;
        const P = base ** p;
        const Q = base ** q;
        stem = `If $${P}^{x} \\cdot ${Q}^{${c}} = ${base}^{${k}}$, what is the value of $x$?`;
        const wrongX = k - q * c; // treats P^x as base^x
        if (wrongX === answer || wrongX <= 0) continue; // the slip must give a different, positive value
        traps.push({ value: wrongX, trap: 'int-base-change-exponent' });
        explanation = `Rewrite with base ${base}: $${P}^{x} = ${base}^{${p}x}$ and $${Q}^{${c}} = ${base}^{${q * c}}$. Multiplying adds exponents: $${base}^{${p}x + ${q * c}} = ${base}^{${k}}$, so $${p}x + ${q * c} = ${k}$ and $x = ${answer}$.

Writing $${P}^{x}$ as $${base}^{x}$ forgets that ${P} is $${base}^{${p}}$.`;
      } else if (kind === 'nested') {
        // (b^p)^(x + c) = (b^q)^(x + d)
        base = rng.pick([2, 3]);
        [p, q] = rng.pick([
          [2, 3],
          [3, 2],
          [2, 4],
          [4, 2],
          [3, 4],
          [4, 3],
        ] as [number, number][]);
        if (base === 3 && (p === 4 || q === 4)) continue;
        const x = rng.int(-3, 9);
        c = rng.int(-3, 4);
        const top = p * (x + c) - q * x;
        if (top % q !== 0) continue;
        d = top / q;
        if (Math.abs(d) > 5 || d === c || (c === 0 && d === 0)) continue;
        if (Math.abs(p * (x + c)) > 30) continue;
        answer = x;
        const P = base ** p;
        const Q = base ** q;
        const expTex = (cc: number) => (cc === 0 ? 'x' : `x ${cc > 0 ? '+' : '-'} ${Math.abs(cc)}`);
        stem = `If $${P}^{${expTex(c)}} = ${Q}^{${expTex(d)}}$, what is the value of $x$?`;
        // forgot to distribute: p x + c = q x + d
        if ((c - d) % (q - p) === 0) {
          const wrongX = (c - d) / (q - p);
          if (wrongX === answer) continue;
          traps.push({ value: wrongX, trap: 'int-exponent-distribute' });
        }
        explanation = `Write both sides with base ${base}: $${P} = ${base}^{${p}}$ and $${Q} = ${base}^{${q}}$. Then $${base}^{${p}(${expTex(c)})} = ${base}^{${q}(${expTex(d)})}$, so the exponents are equal:

$$${p}(${expTex(c)}) = ${q}(${expTex(d)})$$

$${p}x ${p * c >= 0 ? '+' : '-'} ${Math.abs(p * c)} = ${q}x ${q * d >= 0 ? '+' : '-'} ${Math.abs(q * d)}$, which gives $x = ${answer}$.

The outer exponent multiplies the whole exponent: $${P}^{${expTex(c)}} = ${base}^{${p}x ${p * c >= 0 ? '+' : '-'} ${Math.abs(p * c)}}$.`;
      } else if (kind === 'repeated-sum') {
        // b copies of b^x = b^k  -> x = k - 1
        base = rng.pick([2, 3, 4, 5]);
        k = rng.int(6, base === 2 ? 30 : base === 5 ? 15 : 18);
        answer = k - 1;
        const sumTex = Array(base).fill(`${base}^{x}`).join(' + ');
        stem = `If $${sumTex} = ${base}^{${k}}$, what is the value of $x$?`;
        if (k % base === 0) traps.push({ value: k / base, trap: 'int-added-like-powers' });
        explanation = `There are ${base} equal terms, so the left side is $${base} \\cdot ${base}^{x} = ${base}^{x + 1}$. Then $x + 1 = ${k}$ and $x = ${answer}$.

Adding equal powers does not add (or multiply) the exponents: $${sumTex} \\ne ${base}^{${base}x}$.`;
      } else {
        // (1/b^p)^x = (b^q)^c  -> -p x = q c
        base = rng.pick([2, 3, 5]);
        [p, q] = rng.pick([
          [1, 2],
          [2, 1],
          [2, 3],
          [3, 2],
          [1, 3],
          [2, 2],
        ] as [number, number][]);
        c = rng.int(1, 6);
        if ((q * c) % p !== 0) continue;
        answer = -(q * c) / p;
        if (base ** (q * c) > 1e12) continue;
        const P = base ** p;
        const Q = base ** q;
        stem = `If $\\left(\\dfrac{1}{${P}}\\right)^{x} = ${c === 1 ? `${Q}` : `${Q}^{${c}}`}$, what is the value of $x$?`;
        traps.push({ value: -answer, trap: 'int-negative-exponent' });
        explanation = `Write both sides with base ${base}: $\\frac{1}{${P}} = ${base}^{${-p}}$, so the left side is $${base}^{${term(-p, 'x')}}$, and the right side is $${q * c === 1 ? `${base}` : `${base}^{${q * c}}`}$. Then $${term(-p, 'x')} = ${q * c}$ and $x = ${answer}$.

$x$ is negative: a reciprocal base needs a negative exponent to give a number greater than 1.`;
      }
      return {
        params: { kind, base, p, q, c, d, k },
        q: {
          format: 'ne',
          stem,
          ...(prefix ? { prefix } : {}),
          answer: frac(answer),
          traps: traps.filter((t, i, arr) => arr.findIndex((u) => u.value === t.value) === i).map((t) => ({ value: frac(t.value), trap: t.trap })),
          explanation,
        },
      };
    }
  },
  check(q, { kind, base, p, q: qq, c, d, k }) {
    if (q.format !== 'ne' || !q.answer.isInt()) return 'answer should be an integer';
    const holds = (x: number): boolean => {
      switch (kind) {
        case 'product-sum':
          return false; // handled below
        case 'mixed-product':
          return beq(bmul(bpow(base ** p, x), bpow(base ** qq, c)), bpow(base, k));
        case 'nested':
          return beq(bpow(base ** p, x + c), bpow(base ** qq, x + d));
        case 'repeated-sum': {
          let s: BR = [0n, 1n];
          for (let i = 0; i < base; i++) s = badd(s, bpow(base, x));
          return beq(s, bpow(base, k));
        }
        case 'reciprocal':
          return beq(fracPow(1, base ** p, x), bpow(base ** qq, c));
      }
    };
    if (kind === 'product-sum') {
      // every integer pair (x, y) that works gives the same x + 2y
      const vals = new Set<number>();
      for (let x = -12; x <= 40; x++)
        for (let y = -6; y <= 20; y++) if (beq(bmul(bpow(base, x), bpow(base * base, y)), bpow(base, k))) vals.add(x + 2 * y);
      if (vals.size !== 1) return `x + 2y not unique: ${[...vals]}`;
      return expectNe(q, [...vals][0]);
    }
    const sols = range(-40, 40).filter(holds);
    if (sols.length !== 1) return `${sols.length} integer solutions`;
    return expectNe(q, sols[0]);
  },
};

/* ------------------------------------------------------------------ 4. Which two numbers have a product in an interval (MCM) */

interface PairNum {
  tex: string;
  n: number;
  d: number;
}

interface ProductParams {
  lo: number;
  hi: number;
  nums: PairNum[];
}

const NEG_INTS = [-24, -20, -18, -16, -15, -12, -10, -9, -8, -6, -5, -4, -3];
const POW_FRACS: PairNum[] = [
  { tex: '2^{-3}', n: 1, d: 8 },
  { tex: '2^{-4}', n: 1, d: 16 },
  { tex: '2^{-5}', n: 1, d: 32 },
  { tex: '3^{-2}', n: 1, d: 9 },
  { tex: '3^{-3}', n: 1, d: 27 },
  { tex: '5^{-2}', n: 1, d: 25 },
  { tex: '10^{-1}', n: 1, d: 10 },
  { tex: '4^{-2}', n: 1, d: 16 },
  { tex: '6^{-2}', n: 1, d: 36 },
];
const NEG_POWS: PairNum[] = [
  { tex: '(-2)^{-3}', n: -1, d: 8 },
  { tex: '(-3)^{-3}', n: -1, d: 27 },
  { tex: '(-2)^{-5}', n: -1, d: 32 },
];

const productInterval: Template<ProductParams> = {
  id: 'arith.exponents.product-interval',
  skill: 'arith.exponents',
  format: 'mcm',
  style: 'pick the two numbers whose product lies in an interval (negative exponents, signs)',
  generate(rng, diff) {
    for (;;) {
      const lo = -1;
      const hi = 0;
      const val = (x: PairNum) => frac(x.n, x.d);
      let nums: PairNum[];
      if (diff === 3 && rng.chance(0.4)) {
        // a negative power of a negative base pairs with a small positive integer
        const np = rng.pick(NEG_POWS);
        const kSmall = rng.int(2, np.d - 1);
        const kBig = rng.pick(range(np.d, np.d + 12));
        const negInts = rng.sample(NEG_INTS, rng.int(1, 2)).map((v) => ({ tex: `${v}`, n: v, d: 1 }));
        nums = [np, { tex: `${kSmall}`, n: kSmall, d: 1 }, { tex: `${kBig}`, n: kBig, d: 1 }, ...negInts];
        if (kSmall > 9 || kBig > 40) continue;
      } else {
        // the valid pair: -m with a positive power 1/d, m < d; every other pair fails
        const powPool = POW_FRACS.filter((x) => x.d >= 9);
        const pc = rng.pick(powPool);
        const others = rng.sample(
          POW_FRACS.filter((x) => x.d < pc.d && x.d !== pc.d),
          Math.min(diff === 1 ? 1 : rng.int(1, 2), POW_FRACS.filter((x) => x.d < pc.d).length),
        );
        if (!others.length || new Set([pc.d, ...others.map((x) => x.d)]).size !== others.length + 1) continue;
        const maxOther = Math.max(...others.map((x) => x.d));
        const mcChoices = NEG_INTS.map((v) => -v).filter((m) => m < pc.d && m >= maxOther);
        if (!mcChoices.length) continue;
        const mc = rng.pick(mcChoices);
        const bigPool = range(pc.d, pc.d + 16).filter((m) => m % 2 === 0 || m % 5 === 0);
        const mOthers = rng.sample(bigPool, rng.int(1, diff === 1 ? 1 : 2));
        nums = [pc, ...others, { tex: `${-mc}`, n: -mc, d: 1 }, ...mOthers.map((m) => ({ tex: `${-m}`, n: -m, d: 1 }))];
        if (diff >= 2 && rng.chance(0.5)) {
          const k = rng.int(2, 6);
          nums.push({ tex: `${k}`, n: k, d: 1 });
        }
      }
      if (nums.length > 6 || nums.length < 4 || new Set(nums.map((x) => x.tex)).size !== nums.length) continue;
      const good: [number, number][] = [];
      for (let i = 0; i < nums.length; i++)
        for (let j = i + 1; j < nums.length; j++) {
          const pr = val(nums[i]).mul(val(nums[j]));
          if (pr.gt(lo) && pr.lt(hi)) good.push([i, j]);
        }
      if (good.length !== 1) continue;
      // order by value
      const order = rng.shuffle(nums.map((x, i) => ({ x, i })));
      const sorted = order.map((o) => o.x);
      const [gi, gj] = good[0];
      const pairSet = new Set([order.findIndex((o) => o.i === gi), order.findIndex((o) => o.i === gj)]);
      // trap: a positive integer that "works" if a negative exponent is read as a negative sign
      const misread = (x: PairNum) => (x.tex.includes('^{-') && x.n > 0 ? frac(-x.n, x.d) : val(x));
      const items = sorted.map((x, idx) => {
        let trap: string | undefined;
        if (!pairSet.has(idx)) {
          if (!x.tex.includes('^') && x.n > 0) {
            const fooled = sorted.some((y) => y !== x && y.tex.includes('^{-') && y.n > 0 && misread(y).mul(val(x)).gt(lo) && misread(y).mul(val(x)).lt(hi));
            trap = fooled ? 'int-negative-exponent' : 'num-sign-rules';
          } else if (x.tex.includes('^') && x.n < 0) trap = 'num-sign-rules';
          else trap = 'num-product-range';
        }
        return { text: `$${x.tex}$`, correct: pairSet.has(idx), ...(trap ? { trap } : {}) };
      });
      const { choices, answer } = flaggedChoices(items as (Choice & { correct: boolean })[]);
      const [x1, x2] = [sorted[[...pairSet][0]], sorted[[...pairSet][1]]].sort((u, v) => val(u).cmp(val(v)));
      const prod = val(x1).mul(val(x2));
      const valueList = sorted
        .filter((x) => x.tex.includes('^'))
        .map((x) => `$${x.tex} = ${val(x).toTex()}$`);
      const negList = sorted.filter((x) => val(x).sign() < 0 && !x.tex.includes('^'));
      return {
        params: { lo, hi, nums: sorted },
        q: {
          format: 'mcm',
          stem: 'The product of which two of the following numbers is greater than $-1$ and less than 0?',
          instruction: 'Indicate both of the numbers.',
          choices,
          answer,
          explanation: `First rewrite the powers: ${listAnd(valueList)}. A negative exponent gives a reciprocal, which is positive when the base is positive.

The product must be negative, so one factor is negative and the other positive, and its size must be less than 1.${
            negList.length
              ? ` ${listAnd(negList.map((x) => `$${x.tex}$`))} ${negList.length > 1 ? 'are' : 'is'} negative.`
              : ''
          } Only $${x1.tex} \\times ${x2.tex} = ${val(x1).toTex()} \\times ${val(x2).toTex()} = ${prod.toTex()}$ lies between $-1$ and 0; every other pair has a positive product or a product of size at least 1.

Trap: a negative factor is not enough. The product must also be smaller than 1 in size, which needs a fraction with a large denominator.`,
        },
      };
    }
  },
  check(q, { lo, hi, nums }) {
    const ok: number[] = [];
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const pr = (nums[i].n * nums[j].n) / (nums[i].d * nums[j].d);
        if (pr > lo && pr < hi) ok.push(i, j);
      }
    if (ok.length !== 2) return `${ok.length / 2} valid pairs`;
    return expectMcm(q, ok.sort((x, y) => x - y));
  },
};

/* ------------------------------------------------------------------ 5. Powers of 10 and percents (MCS) */

interface TenParams {
  /** q percent as a power of ten: q = 10^t */
  t: number;
  /** 0: 10^x = q% of 10^y ; 1: q% of 10^x = 10^y */
  dir: 0 | 1;
  /** offsets d of the choices "y = x + d" (999 encodes the multiplicative distractor) */
  offsets: number[];
}

const PCT_TEX: Record<number, string> = { [-3]: '0.001', [-2]: '0.01', [-1]: '0.1', 0: '1', 1: '10', 3: '1{,}000', 4: '10{,}000' };
const PCT_TEXT: Record<number, string> = { [-3]: '0.001', [-2]: '0.01', [-1]: '0.1', 0: '1', 1: '10', 3: '1,000', 4: '10,000' };
const MULT = 999;
/** 10^e without the exponent 1 or 0: p10(1) = "10", p10(0) = "1". */
const p10 = (e: number) => (e === 1 ? '10' : e === 0 ? '1' : `10^{${e}}`);

const powersOfTenPercent: Template<TenParams> = {
  id: 'arith.exponents.powers-of-ten-percent',
  skill: 'arith.exponents',
  format: 'mcs',
  style: 'powers of 10 combined with a percent: relation between exponents',
  generate(rng, diff) {
    // Each level has its own percents, so the same wording never appears at two levels.
    const t = rng.pick(diff === 1 ? [0, 1] : diff === 2 ? [-1, 3] : [-3, -2, 4]);
    const dir: 0 | 1 = rng.chance(0.5) ? 0 : 1;
    const e = t - 2;
    // dir 0: 10^x = 10^e 10^y -> y = x - e ;  dir 1: 10^y = 10^e 10^x -> y = x + e
    const off = (ea: number) => (dir === 0 ? -ea : ea);
    const dStar = off(e);
    // every wrong relation is a real slip: the direction reversed, or the percent read as 10^t, 10^(t-1), 10^(t-3)...
    const cands: { d: number; trap: string }[] = [
      { d: off(-e), trap: 'int-power-ten-direction' },
      { d: off(-t), trap: 'int-power-ten-direction' },
      { d: off(1 - t), trap: 'int-power-ten-direction' },
      { d: off(3 - t), trap: 'int-power-ten-direction' },
      { d: off(t), trap: 'int-percent-not-divided' },
      { d: off(t - 1), trap: 'int-percent-not-divided' },
      { d: off(t - 3), trap: 'int-percent-not-divided' },
      { d: off(t + 1), trap: 'int-percent-not-divided' },
      { d: off(t - 4), trap: 'int-percent-not-divided' },
    ];
    const pool: { d: number; trap: string }[] = [];
    for (const cnd of cands) if (cnd.d !== dStar && !pool.some((x) => x.d === cnd.d)) pool.push(cnd);
    // Half the time the last choice is the look-alike "y = 10^k x" (the relation between the numbers, not the exponents).
    const withMult = pool.length < 4 || rng.chance(0.3);
    const slots = withMult ? 4 : 5;
    const below = rng.shuffle(pool.filter((x) => x.d < dStar));
    const above = rng.shuffle(pool.filter((x) => x.d > dStar));
    let target = rng.int(0, slots - 1);
    target = Math.max(Math.min(target, below.length), slots - 1 - above.length);
    const picked = [...below.slice(0, target), ...above.slice(0, slots - 1 - target)];
    const all: { d: number; ok: boolean; trap?: string }[] = [
      { d: dStar, ok: true },
      ...picked.map((x) => ({ ...x, ok: false })),
      ...(withMult ? [{ d: MULT, ok: false, trap: 'int-power-ten-factor' }] : []),
    ];
    const factor = 10 ** Math.max(1, Math.abs(dStar));
    const relTex = (d: number) => (d === MULT ? `y = ${num(factor)}x` : d === 0 ? 'y = x' : `y = x ${d > 0 ? '+' : '-'} ${Math.abs(d)}`);
    all.sort((u, v) => (u.d === MULT ? 1 : v.d === MULT ? -1 : u.d - v.d));
    const choices: Choice[] = all.map((x) => ({ text: `$${relTex(x.d)}$`, ...(x.trap ? { trap: x.trap } : {}) }));
    const answer = all.findIndex((x) => x.ok);
    const pctTex = PCT_TEX[t];
    const pct = PCT_TEXT[t];
    const frame = rng.int(0, 1);
    const stem =
      dir === 0
        ? [
            `For integers $x$ and $y$, $10^{x}$ is equal to ${pct} percent of $10^{y}$. Which of the following must be true?`,
            `$x$ and $y$ are integers, and $10^{x}$ equals ${pct} percent of $10^{y}$. Which of the following relations must hold?`,
          ][frame]
        : [
            `For integers $x$ and $y$, ${pct} percent of $10^{x}$ is equal to $10^{y}$. Which of the following must be true?`,
            `$x$ and $y$ are integers, and ${pct} percent of $10^{x}$ equals $10^{y}$. Which of the following relations must hold?`,
          ][frame];
    const eTex = (v: string) => (e === 0 ? v : `${v} ${e > 0 ? '+' : '-'} ${Math.abs(e)}`);
    const work =
      dir === 0
        ? `So $10^{x} = ${p10(e)} \\cdot 10^{y} = 10^{${eTex('y')}}$, which means $x = ${eTex('y')}$, that is, $${relTex(dStar)}$.`
        : `So $10^{y} = ${p10(e)} \\cdot 10^{x} = 10^{${eTex('x')}}$, which means $${relTex(dStar)}$.`;
    const yEx = 5;
    const xEx = dir === 0 ? yEx + e : yEx - e;
    const slips: string[] = [];
    const dirTrap = all.find((x) => x.d === -dStar && x.trap === 'int-power-ten-direction');
    if (dirTrap) slips.push(`$${relTex(dirTrap.d)}$ reverses the direction`);
    if (all.some((x) => x.trap === 'int-percent-not-divided' || x.trap === 'int-power-ten-direction' && x.d !== -dStar)) slips.push(`reading ${pct} percent as $${p10(t)}$ (forgetting the division by 100) shifts the exponent`);
    if (withMult) slips.push(`$${relTex(MULT)}$ relates the numbers, but the question is about the exponents`);
    return {
      params: { t, dir, offsets: all.map((x) => x.d) },
      q: {
        format: 'mcs',
        stem,
        choices,
        answer,
        explanation: `Turn the percent into a power of 10: ${pct} percent is $\\frac{${pctTex}}{100} = ${p10(e)}$. ${work}

Check with numbers: if $x = ${xEx}$ and $y = ${yEx}$, then ${dir === 0 ? `${pct} percent of $10^{${yEx}}$ is $${p10(yEx + e)} = 10^{x}$` : `${pct} percent of $10^{${xEx}}$ is $${p10(xEx + e)} = 10^{y}$`}. ${
          e < 0
            ? `${pct} percent is less than 100 percent, so $10^{${dir === 0 ? 'x' : 'y'}}$ is the smaller power and $${dir === 0 ? 'x < y' : 'y < x'}$.`
            : `${pct} percent is more than 100 percent, so $10^{${dir === 0 ? 'x' : 'y'}}$ is the larger power and $${dir === 0 ? 'x > y' : 'y > x'}$.`
        }

Trap: ${slips.slice(0, 2).join('; ')}.`,
      },
    };
  },
  check(q, { t, dir, offsets }) {
    // brute force over integer pairs (x, y) with exact rationals
    const pct = t >= 0 ? frac(10 ** t, 100) : frac(1, 100 * 10 ** -t);
    const ten = frac(10);
    const pairs: [number, number][] = [];
    for (let x = -8; x <= 8; x++)
      for (let y = -8; y <= 8; y++) {
        const holds = dir === 0 ? ten.pow(x).eq(pct.mul(ten.pow(y))) : pct.mul(ten.pow(x)).eq(ten.pow(y));
        if (holds) pairs.push([x, y]);
      }
    if (pairs.length < 2) return 'no pairs';
    const dAbs = Math.max(1, Math.abs(dir === 0 ? 2 - t : t - 2));
    return expectMcsBy(q, (i) => pairs.every(([x, y]) => (offsets[i] === MULT ? y === 10 ** dAbs * x : y === x + offsets[i])));
  },
};

export const exponentTemplates: Template<any>[] = [negativeExponentQC, commonBaseQC, sameBaseEquation, productInterval, powersOfTenPercent];
