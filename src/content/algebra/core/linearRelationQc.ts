import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lin } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { intExcept, qcEnd } from './util';

export const linearRelationTraps: Record<string, Trap> = {
  'alg-lin-ignore-sign': {
    label: 'Treated the unknown as positive when the condition allows a negative value',
    fix: 'Multiplying or dividing by a negative number reverses the order. Test one value of each sign allowed by the condition before deciding.',
  },
  'alg-lin-offset-no-divide': {
    label: 'Forgot to divide by the coefficient when comparing two unknowns',
    fix: 'From $ax + b = ay + c$ you get $a(x - y) = c - b$, so $x - y = \\frac{c - b}{a}$, not $c - b$.',
  },
  'alg-lin-offset-sign': {
    label: 'Reversed the order of the subtraction when finding $x - y$',
    fix: 'Subtract the SAME terms from both sides: $x - y$ goes with $c - b$ (the constant of the $y$ side minus that of the $x$ side).',
  },
  'alg-lin-threshold-flip': {
    label: 'Took the sign of the difference from the wrong side of the turning value',
    fix: 'Write $x - y$ as a multiple of $(y - y^*)$, where $y^*$ is where it is 0, and check which side of $y^*$ the allowed values lie on.',
  },
};

interface Params {
  kind: 'ratio' | 'offset' | 'threshold';
  /** ratio: [a, b] for ax = by. offset: [a, b, c] for ax + b = ay + c. threshold: [a, b, c, e] for ax + b = cy + e. */
  k: number[];
  /** ratio: 1 for y > 0, -1 for y < 0, 0 for y not 0. threshold: the bound L of y > L. */
  cond: number;
  /** offset: Quantity B is y + w, with w = w[0] / w[1]. */
  w: [number, number];
}

const linearRelationQC: Template<Params> = {
  id: 'alg.linear-equations.relation-qc',
  skill: 'alg.linear-equations',
  format: 'qc',
  style: 'compare two unknowns tied by one linear equation',
  generate(rng, d) {
    const kind: Params['kind'] =
      d === 1 ? rng.pick(['ratio', 'ratio', 'offset']) : d === 2 ? rng.pick(['offset', 'offset', 'ratio']) : rng.pick(['threshold', 'threshold', 'threshold', 'ratio']);
    const traps: QCQuestion['traps'] = {};
    let info: string;
    let qa = '$x$';
    let qb = '$y$';
    let answer: QCChoice;
    let explanation: string;
    let k: number[];
    let cond = 0;
    let w: [number, number] = [0, 1];
    if (kind === 'ratio') {
      const a = rng.int(2, 9);
      const b = intExcept(rng, 2, 9, a) * (d === 1 || rng.chance(0.5) ? 1 : -1);
      cond = rng.pick([1, -1, 1, -1, 0]);
      k = [a, b];
      const r = new Frac(b, a);
      const rm1 = r.sub(1);
      const yWord = cond === 1 ? '$y > 0$' : cond === -1 ? '$y < 0$' : '$y \\ne 0$';
      info = `$${lin([[a, 'x']])} = ${lin([[b, 'y']])}$\n\n${yWord[0] === '$' ? 'Also, ' : ''}${yWord}.`;
      const sideOf = (ys: number): QCChoice => qcCompare(r.mul(ys), ys);
      answer = cond === 0 ? 'D' : sideOf(cond);
      const ifPositive = sideOf(1);
      if (answer === 'D') {
        traps.A = traps.B = traps.C = 'tested-one-value';
      } else {
        traps.D = 'alg-qc-variable-d';
        if (ifPositive !== answer) traps[ifPositive] = 'alg-lin-ignore-sign';
      }
      const yp = sideOf(1);
      const ym = sideOf(-1);
      explanation = `Both letters are tied by one equation, so write one in terms of the other: $x = ${r.toTex()}\\,y$. Then $x - y = ${rm1.toTex()}\\,y$, whose sign depends on the sign of $y$.

${
  answer === 'D'
    ? `$y$ may be positive or negative. For $y = 1$ we get $x = ${r.toTex()}$ and Quantity ${yp === 'A' ? 'A' : 'B'} is greater; for $y = -1$ we get $x = ${r.neg().toTex()}$ and Quantity ${ym === 'A' ? 'A' : 'B'} is greater. Two allowed values disagree. (D)`
    : `The factor $${rm1.toTex()}$ is ${rm1.sign() > 0 ? 'positive' : 'negative'} and $y$ is ${cond > 0 ? 'positive' : 'negative'}, so $x - y$ is ${answer === 'A' ? 'positive' : 'negative'}. Check with $y = ${cond}$: $x = ${r.mul(cond).toTex()}$. ${qcEnd(answer)}`
}${answer !== 'D' && ifPositive !== answer ? `\n\nTrap: with a positive $y$ the answer would be ${ifPositive}; the condition $y < 0$ reverses it.` : ''}

Rule: ${answer === 'D' ? 'with an unknown sign, one test value never proves a comparison.' : 'when a condition fixes the sign of a variable, use it before comparing multiples.'}`;
    } else if (kind === 'offset') {
      const a = rng.int(2, d === 1 ? 4 : 7);
      let b: number;
      let c: number;
      do {
        b = rng.int(-9, 9);
        c = rng.chance(d === 1 ? 1 : 0.5) ? b + a * intExcept(rng, -4, 6, 0) : rng.int(-9, 18);
      } while (c === b);
      k = [a, b, c];
      const t = new Frac(c - b, a);
      const dw = rng.pick([0, 0, 1, -1, 2, -2, 3, -3]);
      const wv = t.add(dw);
      w = [wv.n, wv.d];
      const wt = (v: Frac) => (v.sign() === 0 ? 'y' : `y ${v.sign() < 0 ? '-' : '+'} ${v.abs().toTex()}`);
      info = `$${lin([[a, 'x'], [b, '']])} = ${lin([[a, 'y'], [c, '']])}$`;
      qb = `$${wt(wv)}$`;
      answer = qcCompare(t, wv); // x - y = t against w
      traps.D = 'alg-qc-variable-d';
      const wrong1 = qcCompare(new Frac(c - b), wv);
      const wrong2 = qcCompare(t.neg(), wv);
      let trapNote = '';
      if (wrong1 !== answer) {
        traps[wrong1] = 'alg-lin-offset-no-divide';
        trapNote = `\n\nTrap: leaving out the division by ${a} gives $x - y = ${c - b}$ and Quantity ${wrong1} (not ${answer}).`;
      } else if (wrong2 !== answer) {
        traps[wrong2] = 'alg-lin-offset-sign';
        trapNote = `\n\nTrap: subtracting in the wrong order gives $x - y = ${t.neg().toTex()}$ and Quantity ${wrong2} (not ${answer}).`;
      }
      explanation = `Both sides contain the same multiple of the unknown, so you do not need either value: move the $x$ and $y$ terms together. Collect the unknowns on the left and the constants on the right: $${lin([[a, 'x'], [-a, 'y']])} = ${c - b}$, so $x - y = ${t.toTex()}$.

Quantity A, $x$, equals $${wt(t)}$ (since $x - y = ${t.toTex()}$). Quantity B is $${wt(wv)}$, so ${
        answer === 'C' ? 'the two are identical.' : `Quantity ${answer} is greater by $${t.sub(wv).abs().toTex()}$.`
      } ${qcEnd(answer)}${trapNote}

Rule: when two unknowns share a coefficient, compare them through their difference.`;
    } else {
      const a = rng.int(2, 5);
      let m: number;
      do m = rng.int(-4, 4);
      while (m === 0 || a + m < 1 || a + m === a);
      const c = a + m;
      const ystar = rng.int(-4, 6);
      const s = -m * ystar;
      const b = rng.int(-9, 9);
      const e = b + s;
      k = [a, b, c, e];
      const L = rng.chance(0.35) ? ystar - rng.int(1, 4) : ystar + rng.int(0, 3);
      cond = L;
      info = `$${lin([[a, 'x'], [b, '']])} = ${lin([[c, 'y'], [e, '']])}$\n\nAlso, $y > ${L < 0 ? `-${-L}` : L}$.`;
      answer = L < ystar ? 'D' : m > 0 ? 'A' : 'B';
      const opposite: QCChoice = answer === 'A' ? 'B' : 'A';
      if (answer === 'D') traps.A = traps.B = traps.C = 'tested-one-value';
      else {
        traps.D = 'alg-qc-variable-d';
        traps[opposite] = 'alg-lin-threshold-flip';
      }
      const yAt = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
      const fac = ystar === 0 ? lin([[m, 'y']]) : `${m < 0 ? '-' : ''}${Math.abs(m) === 1 ? '' : Math.abs(m)}(y ${ystar < 0 ? '+' : '-'} ${Math.abs(ystar)})`;
      explanation = `Look at the difference $x - y$. From $${lin([[a, 'x'], [b, '']])} = ${lin([[c, 'y'], [e, '']])}$, $${lin([[a, 'x']])} = ${lin([[c, 'y'], [e - b, '']])}$, so $${a}(x - y) = ${lin([[c - a, 'y'], [e - b, '']])}$.

The right side is $${fac}$, which is 0 at $y = ${yAt(ystar)}$: $x - y$ changes sign there. For $y > ${yAt(ystar)}$ it is ${m > 0 ? 'positive' : 'negative'}, because the coefficient $${c} - ${a} = ${m}$ is ${m > 0 ? 'positive' : 'negative'}. ${
        answer === 'D'
          ? `Here $y > ${yAt(L)}$ allows values on both sides of $${yAt(ystar)}$: at $y = ${yAt(ystar + 1)}$ Quantity ${m > 0 ? 'A' : 'B'} is greater, and at $y = ${new Frac(2 * ystar - 1, 2).toTex()}$ Quantity ${m > 0 ? 'B' : 'A'} is greater. (D)`
          : `Every allowed $y$ is greater than $${yAt(ystar)}$ (since $y > ${yAt(L)}$ and $${yAt(L)} \\ge ${yAt(ystar)}$), so $x - y$ is ${m > 0 ? 'positive' : 'negative'} throughout. ${qcEnd(answer)}

Trap: reading the sign from the coefficient $${c}$ or $${a}$ alone. What matters is their difference, $${c} - ${a} = ${m}$.`
      }

Rule: a difference of two unknowns can change sign; find where, then see which side the condition allows.`;
    }
    return { params: { kind, k: k!, cond, w }, q: { format: 'qc', info, quantityA: qa, quantityB: qb, answer, traps, explanation } };
  },
  check(q, { kind, k, cond, w }) {
    if (q.format !== 'qc') return 'wrong format';
    const pairs: [Frac, Frac][] = [];
    if (kind === 'ratio') {
      const [a, b] = k;
      const ys: number[] = [];
      for (let v = 1; v <= 24; v++) ys.push(v / 2);
      for (const y of ys) {
        if (cond >= 0) pairs.push([new Frac(b, a).mul(new Frac(y * 2, 2)), new Frac(y * 2, 2)]);
        if (cond <= 0) pairs.push([new Frac(b, a).mul(new Frac(-y * 2, 2)), new Frac(-y * 2, 2)]);
      }
    } else if (kind === 'offset') {
      const [a, b, c] = k;
      for (let y = -12; y <= 12; y++) {
        const yf = new Frac(y, 3);
        pairs.push([yf.mul(a).add(c - b).div(a), yf.add(new Frac(w[0], w[1]))]);
      }
    } else {
      const [a, b, c, e] = k;
      for (let i = 1; i <= 160; i++) {
        const y = new Frac(cond).add(new Frac(i, 4));
        pairs.push([y.mul(c).add(e - b).div(a), y]);
      }
    }
    const expected = qcFromSamples(pairs);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const linearRelationTemplates = [linearRelationQC];
