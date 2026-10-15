import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { qcEnd } from './util';

export const quadraticDiscriminantTraps: Record<string, Trap> = {
  'alg-quad-disc-reverse': {
    label: 'Reversed the discriminant condition',
    fix: 'Two real solutions need $b^2 - 4ac > 0$, none need $b^2 - 4ac < 0$. Sketch the parabola if you are unsure: it crosses the axis twice when its lowest point is below the axis.',
  },
  'alg-quad-disc-boundary': {
    label: 'Treated the boundary value of the constant as an allowed value (or as the only one)',
    fix: 'Check whether the boundary is included: exactly one solution is the boundary itself, two solutions or none exclude it.',
  },
};

type Kind = 'two' | 'none' | 'one' | 'atleast' | 'atmost';

interface Params {
  kind: Kind;
  a: number;
  b: number;
  t: [number, number];
  intK: boolean;
}

const WORDS: Record<Kind, string> = {
  two: 'two different real solutions',
  none: 'no real solution',
  one: 'exactly one real solution',
  atleast: 'at least one real solution',
  atmost: 'at most one real solution',
};
const REVERSED: Record<Kind, Kind> = { two: 'none', none: 'two', one: 'one', atleast: 'atmost', atmost: 'atleast' };

/** Relation of the constant k to the boundary T for the kind: '<', '>', '=', '<=', '>='. */
const REL: Record<Kind, string> = { two: '<', none: '>', one: '=', atleast: '\\le', atmost: '\\ge' };

/** Number of real roots of ax^2 + bx + k from the height of the vertex (a > 0): below the axis, on it, above it. */
function rootCount(a: number, b: number, k: Frac): number {
  const low = k.sub(new Frac(b * b, 4 * a));
  return low.sign() < 0 ? 2 : low.sign() === 0 ? 1 : 0;
}

const okFor = (kind: Kind, n: number) =>
  kind === 'two' ? n === 2 : kind === 'none' ? n === 0 : kind === 'one' ? n === 1 : kind === 'atleast' ? n >= 1 : n <= 1;

/** Answer of the QC from the exact boundary (generate's route). */
function answerOf(kind: Kind, T: Frac, t: Frac, intK: boolean): QCChoice {
  const c = T.cmp(t); // 1: T > t
  const s = intK ? new Frac(1) : new Frac(0);
  if (kind === 'one') return c > 0 ? 'A' : c < 0 ? 'B' : 'C';
  if (kind === 'two') {
    // k < T (integer k: k <= T - 1)
    const top = T.sub(s);
    return t.gte(top) ? 'B' : 'D';
  }
  if (kind === 'none') {
    const bottom = T.add(s);
    return t.lte(bottom) ? 'A' : 'D';
  }
  if (kind === 'atleast') return t.gt(T) ? 'B' : 'D';
  return t.lt(T) ? 'A' : 'D';
}

const quadraticDiscriminantQC: Template<Params> = {
  id: 'alg.quadratics.discriminant-qc',
  skill: 'alg.quadratics',
  format: 'qc',
  style: 'how many real solutions a parameter allows, then compare the parameter',
  generate(rng, d) {
    for (;;) {
      const kind: Kind = d === 1 ? rng.pick(['two', 'none', 'one', 'two', 'none']) : rng.pick(['two', 'none', 'one', 'atleast', 'atmost', 'two', 'none']);
      const a = d === 1 ? 1 : rng.pick([1, 2, 4]);
      const h = rng.int(1, 6) * rng.sign();
      const b = d === 1 || rng.chance(0.6) ? 2 * a * h : rng.int(1, 12) * rng.sign();
      const T = new Frac(b * b, 4 * a);
      const intK = d === 3 && T.isInt() && (kind === 'two' || kind === 'none') && rng.chance(0.8);
      // target t for Quantity B
      let t: Frac;
      if (intK) t = kind === 'two' ? T.sub(new Frac(1, 2)) : T.add(new Frac(1, 2));
      else {
        const dt = new Frac(rng.pick([0, 0, 1, -1, 2, -2, 3, -3, 5]), rng.pick([1, 1, 2]));
        t = T.add(dt);
        if (d === 1 && !T.isInt()) continue;
      }
      if (t.isInt() === false && !t.isTerminating()) continue;
      const answer = answerOf(kind, T, t, intK);
      const rev = answerOf(REVERSED[kind], T, t, intK);
      const traps: QCQuestion['traps'] = {};
      if (answer === 'D') traps.A = traps.B = traps.C = 'tested-one-value';
      else {
        traps.D = 'alg-qc-variable-d';
        if (rev !== answer && rev !== 'D') traps[rev] = 'alg-quad-disc-reverse';
        else if ((kind === 'two' || kind === 'none') && t.eq(T)) traps.C = 'alg-quad-disc-boundary';
      }
      const eq = `${a === 1 ? '' : a}x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x + k = 0`;
      const info = `$${eq}$\n\nHere $k$ is ${intK ? 'an integer' : 'a constant'}, and the equation has ${WORDS[kind]}.`;
      const bTex = decimal(t);
      const discText = `The number of real solutions is set by the discriminant $b^2 - 4ac = ${num(b * b)} - ${4 * a}k$.`;
      const cond = REL[kind];
      const cut = `$${num(b * b)} - ${4 * a}k ${kind === 'two' ? '> 0' : kind === 'none' ? '< 0' : kind === 'one' ? '= 0' : kind === 'atleast' ? '\\ge 0' : '\\le 0'}$ gives $k ${cond} ${T.toTex()}$`;
      const relWord = (k: Frac) => (k.lt(t) ? 'less than' : k.gt(t) ? 'greater than' : 'equal to');
      const mid = T.add(t).div(2);
      const [lowK, highK] =
        kind === 'two' ? [t.sub(1), mid] : kind === 'none' ? [mid, t.add(1)] : kind === 'atleast' ? [t.sub(1), T] : [T, t.add(1)];
      const verdict =
        answer === 'D'
          ? `Quantity B is $${bTex}$. Both $k = ${lowK.toTex()}$ and $k = ${highK.toTex()}$ are allowed, yet the first is ${relWord(lowK)} Quantity B and the second is ${relWord(highK)} it. Two allowed values disagree. (D)`
          : kind === 'one'
            ? `Here $k = ${T.toTex()}$ exactly, and Quantity B is $${bTex}$. ${qcEnd(answer)}`
            : `Every allowed $k$ ${answer === 'A' ? 'is greater than' : 'is less than'} $${bTex}$${
                intK ? `: an integer $k$ with $k ${cond} ${T.toTex()}$ satisfies $k ${kind === 'two' ? '\\le ' + T.sub(1).toTex() : '\\ge ' + T.add(1).toTex()}$` : ''
              }. ${qcEnd(answer)}`;
      const explanation = `${discText} Set it against 0 for "${WORDS[kind]}": ${cut}.

${verdict}

${
  rev !== answer && rev !== 'D' && answer !== 'D'
    ? `Trap: reversing the discriminant condition (using the opposite sign) would turn $k ${cond} ${T.toTex()}$ around and point to ${rev}.\n\n`
    : ''
}Rule: translate "how many solutions" into a sign condition on $b^2 - 4ac$, then see where the constant is allowed to be.`;
      return { params: { kind, a, b, t: [t.n, t.d], intK }, q: { format: 'qc', info, quantityA: '$k$', quantityB: `$${bTex}$`, answer, traps, explanation } };
    }
  },
  check(q, { kind, a, b, t, intK }) {
    if (q.format !== 'qc') return 'wrong format';
    const T = new Frac(b * b, 4 * a);
    const pairs: [Frac, Frac][] = [];
    const tf = new Frac(t[0], t[1]);
    for (let j = -160; j <= 160; j++) {
      const k = intK ? T.add(Math.floor(j / 4)) : T.add(new Frac(j, 4));
      if (!okFor(kind, rootCount(a, b, k))) continue;
      pairs.push([k, tf]);
    }
    if (pairs.length === 0) return 'no allowed k sampled';
    const expected = qcFromSamples(pairs);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const quadraticDiscriminantTemplates = [quadraticDiscriminantQC];
