import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { num, paren } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { qcEnd } from './util';

// New alg.graphs style (QC): where does a line cross the x-axis when only part of the slope is known?
export const interceptRangeTraps: Record<string, Trap> = {
  'alg-gq-one-case': {
    label: 'Tested one convenient slope and concluded for all of them',
    fix: 'The slope is only restricted, not given. One slope that works shows what is possible, not what is forced. Test a second slope at the other end of the allowed range.',
  },
  'alg-gq-endpoint': {
    label: 'Treated a bound that the slope never reaches as if it were reached',
    fix: 'If the slope must be strictly greater than $m_0$, the intercept gets as close as we like to the value for $m_0$ but never equals it. A strict inequality stays strict.',
  },
  'alg-gq-sign': {
    label: 'Lost the sign when computing the x-intercept',
    fix: 'On the line through $(p, q)$ with slope $m$, $y = 0$ when $x = p - \\frac{q}{m}$. Subtracting the rise needed over the slope, not adding it.',
  },
};

interface RParams {
  mode: 'exact' | 'ray' | 'threshold';
  p: number;
  q: number;
  p2: number;
  q2: number;
  m0: number;
  N: number;
}

const xint = (p: number, q: number, m: Frac) => frac(p).sub(frac(q).div(m));
const nz = (rng: Rng, lo: number, hi: number) => rng.int(lo, hi) * rng.sign();


const interceptRangeQC: Template<RParams> = {
  id: 'alg.graphs.intercept-range-qc',
  skill: 'alg.graphs',
  format: 'qc',
  style: 'x-intercept of a line through a point when the slope is only bounded',
  generate(rng, d) {
    for (;;) {
      if (d === 1) {
        const X = nz(rng, 1, 8);
        const dx = nz(rng, 1, 4);
        const dy = nz(rng, 1, 6);
        const t1 = nz(rng, 1, 4);
        const t2 = nz(rng, 1, 4);
        if (Math.abs(dx) === Math.abs(dy) || t1 === t2) continue;
        const p = X + dx * t1;
        const q = dy * t1;
        const p2 = X + dx * t2;
        const q2 = dy * t2;
        if (Math.max(Math.abs(p), Math.abs(p2), Math.abs(q), Math.abs(q2)) > 24) continue;
        const N = X + rng.pick([0, 0, 0, 1, 2, -1, -2, 3, -3]);
        const m = frac(q2 - q, p2 - p);
        const wrong = frac(p).add(frac(q).div(m));
        const answer = qcCompare(X, N);
        const traps: QCQuestion['traps'] = {};
        const wrongAns = qcCompare(wrong, N);
        if (wrongAns !== answer) traps[wrongAns] = 'alg-gq-sign';
        const need = frac(-q).div(m);
        return {
          params: { mode: 'exact', p, q, p2, q2, m0: 0, N },
          q: {
            format: 'qc',
            info: `In the $xy$-plane, line $\\ell$ passes through the points $(${num(p)}, ${num(q)})$ and $(${num(p2)}, ${num(q2)})$.`,
            quantityA: 'The $x$-intercept of $\\ell$',
            quantityB: `$${num(N)}$`,
            answer,
            traps: Object.keys(traps).length ? traps : undefined,
            explanation: `Both points are given, so the line is fixed and its $x$-intercept is one number.

The slope is $\\frac{${num(q2)} - ${paren(q)}}{${num(p2)} - ${paren(p)}} = ${num(m)}$. To go from $y = ${num(q)}$ to $y = 0$ we need a change of $${num(-q)}$ in $y$, so $x$ changes by $\\frac{${num(-q)}}{${num(m)}} = ${num(need)}$ and the intercept is $${num(p)} ${need.sign() < 0 ? '-' : '+'} ${num(need.abs())} = ${num(X)}$.

Compare $${num(X)}$ with $${num(N)}$. ${qcEnd(answer)}

Trap: ${wrongAns !== answer ? `adding $\\frac{q}{m}$ instead of subtracting gives $${num(wrong)}$, which would point to ${wrongAns}` : 'a sign slip can still move the intercept to the other side of the point'}. Rule: x-intercept = $x_0 - \\frac{y_0}{m}$.`,
          },
        };
      }
      const hidden = d === 3;
      const m0 = hidden ? rng.int(1, 4) : 0;
      const t = hidden ? rng.int(2, 5) : 0;
      const q = hidden ? (rng.chance(0.5) ? 1 : -1) * m0 * t : nz(rng, 1, 9);
      const p = nz(rng, 1, 8);
      // the x-intercept p - q/m over all allowed slopes m > m0 fills the open interval (lo, hi); null = unbounded
      const lo = q > 0 ? (hidden ? p - t : null) : p;
      const hi = q > 0 ? p : hidden ? p + t : null;
      const goal = rng.pick<'A' | 'B' | 'D'>(['A', 'B', 'D']);
      const reach = rng.int(0, 3);
      let N: number;
      if (goal === 'D') N = lo !== null && hi !== null ? rng.int(lo + 1, hi - 1) : lo === null ? hi! - 1 - reach : lo + 1 + reach;
      else if (goal === 'A') {
        if (lo === null) continue;
        N = lo - reach;
      } else {
        if (hi === null) continue;
        N = hi + reach;
      }
      const answer: QCChoice = lo !== null && N <= lo ? 'A' : hi !== null && N >= hi ? 'B' : 'D';
      if (answer !== goal || Math.abs(N) > 40) continue;
      const sample = [frac(m0).add(frac(1, 1000000)), frac(m0).add(frac(1, 1000)), frac(m0).add(frac(1, 2)), frac(m0 + 1), frac(m0 + 2), frac(m0 + 7), frac(m0 + 40), frac(m0 + 1000000)];
      if (qcFromSamples(sample.map((mm) => [xint(p, q, mm), N] as [Frac, number])) !== answer) continue;
      const traps: QCQuestion['traps'] = {};
      let why: string;
      if (answer === 'D') {
        const probe = xint(p, q, frac(m0 + 1));
        const probeAns = qcCompare(probe, N);
        if (probeAns !== 'C') traps[probeAns] = 'alg-gq-one-case';
        why = `testing only $m = ${m0 + 1}$ puts the intercept at $${num(probe)}$ and seems to settle the comparison`;
      } else if (N === lo || N === hi) {
        traps.C = 'alg-gq-endpoint';
        why = `$${num(N)}$ is a value the intercept approaches but never reaches, so the two quantities are never equal`;
      } else {
        why = `moving the intercept to the wrong side of $${num(p)}$ by a sign slip reverses the comparison`;
      }
      const slopeWords = hidden ? `a slope greater than $${m0}$` : 'a positive slope';
      const rangeNote = hidden
        ? `Since $m > ${m0}$, the fraction $\\frac{${num(Math.abs(q))}}{m}$ is less than ${m0 === 1 ? `$${t}$` : `$\\frac{${num(Math.abs(q))}}{${m0}} = ${t}$`} but still positive, so the intercept lies strictly between $${num(Math.min(lo!, hi!))}$ and $${num(Math.max(lo!, hi!))}$ and gets as close to either end as we like.`
        : `Since $m > 0$, the fraction $\\frac{${num(Math.abs(q))}}{m}$ is positive and can be as small or as large as we like, so the intercept is ${q > 0 ? 'any number less than' : 'any number greater than'} $${num(p)}$.`;
      let ending: string;
      if (answer === 'D') {
        const cands = [frac(m0).add(frac(1, 4)), frac(m0).add(frac(1, 2)), ...Array.from({ length: 60 }, (_, j) => frac(m0 + j + 1))];
        const m1 = cands.find((c) => xint(p, q, c).lt(N));
        const m2 = cands.find((c) => xint(p, q, c).gt(N));
        if (!m1 || !m2) continue;
        ending = `The value $${num(N)}$ lies inside that range, so the comparison depends on the slope: with $m = ${num(m1)}$ the intercept is $${num(xint(p, q, m1))}$ and with $m = ${num(m2)}$ it is $${num(xint(p, q, m2))}$, on opposite sides of $${num(N)}$. ${qcEnd('D')}`;
      } else if (answer === 'A') {
        ending = `Every possible intercept is greater than $${num(lo!)}$, and $${num(N)}$ is at most $${num(lo!)}$. ${qcEnd('A')}`;
      } else {
        ending = `Every possible intercept is less than $${num(hi!)}$, and $${num(N)}$ is at least $${num(hi!)}$. ${qcEnd('B')}`;
      }
      return {
        params: { mode: hidden ? 'threshold' : 'ray', p, q, p2: 0, q2: 0, m0, N },
        q: {
          format: 'qc',
          info: `In the $xy$-plane, line $\\ell$ has ${slopeWords} and passes through the point $(${num(p)}, ${num(q)})$.`,
          quantityA: 'The $x$-intercept of $\\ell$',
          quantityB: `$${num(N)}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `The line is not fixed, so describe all of its possible $x$-intercepts.

Going from $y = ${num(q)}$ to $y = 0$ takes $x$ from $${num(p)}$ to $x = ${num(p)} - \\frac{${num(q)}}{m}$. ${rangeNote}

${ending}

Trap: ${why}. Rule: with a bounded slope, find the whole range of the intercept before comparing.`,
        },
      };
    }
  },
  check(q, P) {
    if (q.format !== 'qc') return 'wrong format';
    let samples: Frac[];
    if (P.mode === 'exact') samples = [frac(P.q2 - P.q, P.p2 - P.p)];
    else {
      samples = [];
      for (const k of [1000000, 1000, 2, 1]) samples.push(frac(P.m0).add(frac(1, k)));
      for (let j = 1; j <= 60; j++) samples.push(frac(P.m0 + j));
      samples.push(frac(P.m0 + 1000000));
    }
    const got = qcFromSamples(samples.map((m) => [xint(P.p, P.q, m), P.N] as [Frac, number]));
    return got === q.answer ? null : `expected ${got}, keyed ${q.answer}`;
  },
};

export const interceptRangeTemplates: Template<any>[] = [interceptRangeQC];
