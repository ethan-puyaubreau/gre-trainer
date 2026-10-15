import { minus } from '../../../engine/text';
import { num, paren } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { intExcept, qcEnd, qcSamples } from './util';

// New question styles for alg.qc-algebra, alg.systems and alg.linear-equations, with their traps.
export const hiddenTraps: Record<string, Trap> = {
  'alg-qc-strict-boundary': {
    label: 'Treated a strict boundary as an allowed value and answered "equal"',
    fix: 'With $x > 3$ the value $x = 3$ is not allowed, so the two quantities never tie. Quantities are equal only if they are equal for every allowed value.',
  },
};

/* ================================================================== 1. Hidden threshold under sign constraints (QC) */

interface HiddenParams {
  s: number;
  r: number;
  lo: number | null;
  hi: number | null;
  wneg: boolean;
}

const PAIRS = [
  ['x', 'y'],
  ['a', 'b'],
  ['m', 'n'],
  ['p', 'q'],
  ['u', 'v'],
];

const hiddenThresholdQC: Template<HiddenParams> = {
  id: 'alg.qc-algebra.hidden-threshold-qc',
  skill: 'alg.qc-algebra',
  format: 'qc',
  style: 'a sign constraint on one variable and a hidden threshold in the other',
  generate(rng, d) {
    const [X, Y] = rng.pick(PAIRS);
    let s: number;
    let t: number;
    let r: number;
    do {
      t = d === 1 ? rng.int(2, 9) : rng.int(-9, 9);
      s = d === 3 ? intExcept(rng, -6, 6, 0) : 0;
      r = t + s;
    } while (Math.abs(t) < 2 || Math.abs(r) < 2);
    const wneg = d === 1 ? rng.chance(0.75) : rng.chance(0.5);
    const goal = rng.pick(['D', 'D', 'above', 'below'] as const);
    let lo: number | null = null;
    let hi: number | null = null;
    const pad = () => rng.int(2, d === 1 ? 4 : 6);
    if (goal === 'D') {
      lo = t - pad();
      hi = t + pad();
      if (d < 3) {
        if (rng.chance(0.5)) hi = null;
        else if (rng.chance(0.4)) lo = null;
      }
    } else if (goal === 'above') {
      lo = t + rng.int(0, 3);
      if (d > 1 && rng.chance(0.4)) hi = lo + rng.int(2, 6);
    } else {
      hi = t - rng.int(0, 3);
      if (d > 1 && rng.chance(0.4)) lo = hi - rng.int(2, 6);
    }
    const allBelow = hi !== null && hi <= t;
    const allAbove = lo !== null && lo >= t;
    const sy = wneg ? -1 : 1;
    let answer: QCChoice;
    if (!allBelow && !allAbove) answer = 'D';
    else answer = sy * (allAbove ? 1 : -1) > 0 ? 'A' : 'B';

    // wording of the constraint on X: a window, written with an absolute value at level 3 when centred on an integer
    let cx: string;
    if (lo !== null && hi !== null && d === 3 && (lo + hi) % 2 === 0) cx = `|${minus(X, (lo + hi) / 2)}| < ${(hi - lo) / 2}`;
    else if (lo !== null && hi !== null) cx = `${num(lo)} < ${X} < ${num(hi)}`;
    else if (lo !== null) cx = `${X} > ${num(lo)}`;
    else cx = `${X} < ${num(hi!)}`;
    const cy = wneg ? `${Y} < 0` : `${Y} > 0`;
    const info = `$${cx}$ and $${cy}$`;
    const aTex = s === 0 ? `${X}${Y}` : `(${minus(X, -s)})${Y}`;
    const bTex = `${num(r)}${Y}`;
    const w = wneg ? -1 : 1;
    const plug = (u: number) => (s === 0 ? paren(u) : `(${num(u)} ${s < 0 ? '-' : '+'} ${Math.abs(s)})`);
    const test = (u: number) => {
      const A = (u + s) * w;
      const B = r * w;
      return { A, B, win: A > B ? 'A is greater' : 'B is greater' };
    };

    const parts: string[] = [];
    const diff = s === 0 ? `${X}${Y} - ${paren(t)}${Y}` : `(${minus(X, -s)})${Y} - ${paren(r)}${Y}`;
    parts.push(`Both quantities contain $${Y}$, whose sign we know, so compare $A - B$ instead of guessing: $A - B = ${diff} = ${Y}(${minus(X, t)})$.`);
    parts.push(
      wneg
        ? `Since $${Y} < 0$, this product is positive exactly when $${minus(X, t)}$ is negative. So Quantity A is greater when $${X} < ${num(t)}$, and Quantity B is greater when $${X} > ${num(t)}$. The negative sign of $${Y}$ reverses the comparison.`
        : `Since $${Y} > 0$, this product has the sign of $${minus(X, t)}$. So Quantity A is greater when $${X} > ${num(t)}$, and Quantity B is greater when $${X} < ${num(t)}$.`,
    );
    const traps: QCQuestion['traps'] = {};
    if (answer === 'D') {
      const tb = test(t - 1);
      const ta = test(t + 1);
      parts.push(
        `The condition $${cx}$ lets $${X}$ fall on both sides of $${num(t)}$. With $${X} = ${num(t - 1)}$ and $${Y} = ${w}$: $A = ${plug(t - 1)} \\cdot ${paren(w)} = ${num(tb.A)}$ and $B = ${num(tb.B)}$, so ${tb.win}. With $${X} = ${num(t + 1)}$ and the same $${Y}$: $A = ${num(ta.A)}$ and $B = ${num(ta.B)}$, so ${ta.win}. Two allowed values disagree. ${qcEnd('D')}`,
      );
      const lowU = lo !== null ? lo + 1 : hi! - 1;
      const one = test(lowU);
      const oneKey: QCChoice | null = one.A > one.B ? 'A' : one.A < one.B ? 'B' : null;
      if (oneKey) traps[oneKey] = 'tested-one-value';
      parts.push(`Trap: testing only $${X} = ${num(lowU)}$ points to ${oneKey ? `Quantity ${oneKey}` : 'a tie'}, but one allowed value never settles the relationship.`);
    } else {
      const edge = allAbove ? lo! : hi!;
      parts.push(
        `The condition $${cx}$ keeps every allowed $${X}$ ${allAbove ? 'above' : 'below'} $${num(t)}$${edge === t ? ` ($${X} = ${num(t)}$ itself is not allowed)` : ''}, so $${minus(X, t)}$ is ${allAbove ? 'positive' : 'negative'}. ${qcEnd(answer)}`,
      );
      if (wneg) traps[answer === 'A' ? 'B' : 'A'] = 'alg-no-flip';
      if (edge === t) traps.C = 'alg-qc-strict-boundary';
      else traps.D = 'alg-qc-variable-d';
      parts.push(
        wneg
          ? `Trap: reading "$${X}$ is ${allAbove ? 'above' : 'below'} $${num(t)}$" as "A is ${allAbove ? 'greater' : 'smaller'}" forgets that multiplying by the negative $${Y}$ reverses the comparison.`
          : `Trap: answering "cannot be determined" because $${X}$ and $${Y}$ are unknown ignores that the condition fixes the sign of $${minus(X, t)}$.`,
      );
    }
    parts.push('Rule: when both quantities share a factor of known sign, factor it out and compare what is left with the condition on the other variable.');
    return {
      params: { s, r, lo, hi, wneg },
      q: { format: 'qc', info, quantityA: `$${aTex}$`, quantityB: `$${bTex}$`, answer, traps, explanation: parts.join('\n\n') },
    };
  },
  check(q, { s, r, lo, hi, wneg }, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const us: number[] = [];
    for (let k = -240; k <= 240; k++) us.push(k / 4);
    us.push(-1000, 1000);
    for (let i = 0; i < 200; i++) us.push((rng.next() * 2 - 1) * 80);
    const ok = (u: number) => (lo === null || u > lo) && (hi === null || u < hi);
    const ws = wneg ? [-0.01, -0.5, -1, -3, -10, -100] : [0.01, 0.5, 1, 3, 10, 100];
    const samples: [number, number][] = [];
    for (const u of us) if (ok(u)) for (const w of ws) samples.push([(u + s) * w, r * w]);
    const expected = qcSamples(samples, 1e-12);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const hiddenTemplates: Template<any>[] = [hiddenThresholdQC];
