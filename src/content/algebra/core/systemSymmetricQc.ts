import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lin, num, paren } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { intExcept, qcEnd } from './util';

export const systemSymmetricTraps: Record<string, Trap> = {
  'alg-sys-symmetric-equal': {
    label: 'Decided $x = y$ because the two equations look symmetric',
    fix: 'Swapped coefficients do not make the unknowns equal. Subtract the equations: $x - y = \\frac{A - B}{p - q}$, which is 0 only if $A = B$.',
  },
  'alg-sys-bound-as-value': {
    label: 'Treated the boundary of an inequality as the value of the unknown',
    fix: 'From $x + y = S$ and $x - y > T$ you only get $x > \\frac{S + T}{2}$: $x$ can be any larger number, so compare against the whole range.',
  },
  'alg-sys-forgot-sum-divide': {
    label: 'Read $(p + q)(x + y) = A + B$ as $x + y = A + B$',
    fix: 'Adding the equations gives $(p + q)x + (p + q)y = A + B$. Divide by $p + q$ to get $x + y$.',
  },
};

interface Params {
  kind: 'swap' | 'bound';
  /** swap: [p, q, A, B, form] with form 0 = x vs y, 1 = x + y vs t, 2 = x^2 - y^2 vs t. bound: [S, T, dir (1: x - y > T, -1: x - y < T)]. */
  k: number[];
  /** Quantity B: t = t[0] / t[1]. */
  t: number;
}

const qcSymmetric: Template<Params> = {
  id: 'alg.systems.symmetric-qc',
  skill: 'alg.systems',
  format: 'qc',
  style: 'swapped-coefficient systems and an inequality on the difference',
  generate(rng, d) {
    const kind: Params['kind'] = d === 1 ? 'swap' : rng.pick(['swap', 'bound', 'swap']);
    const traps: QCQuestion['traps'] = {};
    let info: string;
    let qa: string;
    let qb: string;
    let answer: QCChoice;
    let explanation: string;
    let k: number[];
    let t: number;
    if (kind === 'swap') {
      const p = rng.int(2, 9);
      const q = d === 3 && rng.chance(0.4) ? -intExcept(rng, 1, 7, p) : intExcept(rng, 1, 9, p);
      if (p + q === 0) return qcSymmetric.generate(rng, d);
      const form = d === 1 ? rng.pick([0, 0, 1]) : d === 2 ? rng.pick([0, 1, 1]) : rng.pick([2, 2, 1, 0]);
      const x0 = rng.int(-4, 12);
      const y0 = rng.chance(0.2) ? x0 : rng.int(-4, 12);
      const A = p * x0 + q * y0;
      const B = q * x0 + p * y0;
      const s = x0 + y0;
      const df = x0 - y0;
      k = [p, q, A, B, form];
      info = `$${lin([[p, 'x'], [q, 'y']])} = ${num(A)}$\n\n$${lin([[q, 'x'], [p, 'y']])} = ${num(B)}$`;
      const mt = (c: number, body: string) => (c === 1 ? body : c === -1 ? `-(${body})` : `${num(c)}(${body})`);
      const sumTex = `${mt(p + q, 'x + y')} = ${num(A + B)}`;
      const subTex = `${mt(p - q, 'x - y')} = ${num(A - B)}`;
      const how = `The coefficients are swapped, so combine the equations. Adding them gives $${sumTex}$${p + q === 1 ? '' : `, so $x + y = ${num(s)}$`}. Subtracting the second from the first gives $${subTex}$${p - q === 1 ? '' : `, so $x - y = ${num(df)}$`}.`;
      if (form === 0) {
        qa = '$x$';
        qb = '$y$';
        t = 0;
        answer = qcCompare(x0, y0);
        if (answer !== 'C') traps.C = 'alg-sys-symmetric-equal';
        explanation = `${how}

${df === 0 ? 'So $x = y$, and the quantities are equal' : df > 0 ? 'Since $x - y$ is positive, $x$ is greater than $y$' : 'Since $x - y$ is negative, $y$ is greater than $x$'}. ${qcEnd(answer)}${
          answer !== 'C' ? `\n\nTrap: because the equations look symmetric, it is tempting to say $x = y$. That would need the right sides to be equal, but $${num(A)} - ${paren(B)} = ${num(A - B)}$, not 0.` : ''
        }

Rule: add the equations for the sum and subtract them for the difference; no need to find $x$ and $y$.`;
      } else if (form === 1) {
        const dlt = rng.pick([0, 0, 1, -1, 2, -2, 3, -3]);
        t = s + dlt;
        qa = '$x + y$';
        qb = `$${num(t)}$`;
        answer = qcCompare(s, t);
        const wrong = qcCompare(A + B, t);
        if (wrong !== answer) traps[wrong] = 'alg-sys-forgot-sum-divide';
        explanation = `${how}

Quantity A is $x + y = ${num(s)}$ and Quantity B is $${num(t)}$. ${qcEnd(answer)}${
          wrong !== answer ? `\n\nTrap: reading the sum of the equations as $x + y = ${num(A + B)}$ forgets to divide by $${num(p + q)}$ and points to ${wrong}.` : ''
        }

Rule: when both equations share the same coefficients in swapped order, their sum and difference give $x + y$ and $x - y$ directly.`;
      } else {
        const dlt = rng.pick([0, 0, 1, -1, 3, -3, 6, -6]);
        t = s * df + dlt;
        qa = '$x^2 - y^2$';
        qb = `$${num(t)}$`;
        answer = qcCompare(s * df, t);
        explanation = `${how}

Now $x^2 - y^2 = (x + y)(x - y) = (${num(s)})(${num(df)}) = ${num(s * df)}$. Quantity B is $${num(t)}$. ${qcEnd(answer)}

Check with $x = ${num(x0)}$ and $y = ${num(y0)}$ (they satisfy both equations): $${num(x0 * x0)} - ${y0 < 0 ? `(${y0 * y0})` : y0 * y0} = ${num(x0 * x0 - y0 * y0)}$.

Rule: $x^2 - y^2$ factors as $(x + y)(x - y)$, and both factors are available without solving.`;
      }
      traps.D = 'alg-qc-variable-d';
    } else {
      const S = rng.int(-6, 14);
      const T = rng.int(-6, 8);
      const dir = rng.pick([1, -1]);
      const h = new Frac(S + T, 2);
      k = [S, T, dir];
      const lo = dir === 1;
      info = `$x + y = ${num(S)}$\n\n$x - y ${lo ? '>' : '<'} ${num(T)}$`;
      // determined when t sits on the far side of the boundary
      const det = rng.chance(0.55);
      const gap = rng.int(0, 3);
      const tv = det ? (lo ? h.sub(gap) : h.add(gap)) : lo ? h.add(rng.int(1, 4)) : h.sub(rng.int(1, 4));
      t = tv.toNumber();
      if (!Number.isInteger(t)) t = Math.round(t * 2) / 2;
      qa = '$x$';
      qb = `$${new Frac(Math.round(t * 2), 2).toTex()}$`;
      const tf = new Frac(Math.round(t * 2), 2);
      answer = lo ? (tf.lte(h) ? 'A' : 'D') : tf.gte(h) ? 'B' : 'D';
      if (answer === 'D') traps[lo ? 'B' : 'A'] = 'alg-sys-bound-as-value';
      else traps.D = 'alg-qc-variable-d';
      explanation = `Add the two conditions as you would equations: $x + y = ${num(S)}$ and $x - y ${lo ? '>' : '<'} ${num(T)}$ give $2x ${lo ? '>' : '<'} ${num(S + T)}$, so $x ${lo ? '>' : '<'} ${h.toTex()}$. This is a range, not a single value.

${
  answer === 'D'
    ? `Quantity B, $${tf.toTex()}$, lies ${lo ? 'above' : 'below'} $${h.toTex()}$, so $x$ can be just past $${h.toTex()}$ (${lo ? 'less' : 'greater'} than Quantity B) or far ${lo ? 'above' : 'below'} it (${lo ? 'greater' : 'less'}). Two allowed values disagree. (D)\n\nTrap: setting $x - y = ${num(T)}$ and solving gives $x = ${h.toTex()}$, one boundary value, which hides the range.`
    : `Quantity B, $${tf.toTex()}$, is ${lo ? 'at most' : 'at least'} $${h.toTex()}$, so every allowed $x$ is ${lo ? 'greater' : 'less'} than it. ${qcEnd(answer)}`
}

Rule: an inequality on a difference leaves a range for each unknown; compare the whole range with the other quantity.`;
    }
    return { params: { kind, k, t: t! }, q: { format: 'qc', info, quantityA: qa!, quantityB: qb!, answer, traps, explanation } };
  },
  check(q, { kind, k, t }) {
    if (q.format !== 'qc') return 'wrong format';
    const pairs: [Frac, Frac][] = [];
    if (kind === 'swap') {
      const [p, qq, A, B, form] = k;
      const det = p * p - qq * qq;
      if (det === 0) return 'singular';
      const x = new Frac(A * p - qq * B, det);
      const y = new Frac(p * B - qq * A, det);
      if (!x.mul(p).add(y.mul(qq)).eq(A) || !x.mul(qq).add(y.mul(p)).eq(B)) return 'solution does not satisfy the system';
      pairs.push(form === 0 ? [x, y] : form === 1 ? [x.add(y), new Frac(t)] : [x.mul(x).sub(y.mul(y)), new Frac(t)]);
    } else {
      const [S, T, dir] = k;
      const tf = new Frac(Math.round(t * 2), 2);
      for (let i = 1; i <= 120; i++) {
        const x = new Frac(S + T, 2).add(new Frac(dir * i, 4));
        const y = new Frac(S).sub(x);
        const diff = x.sub(y);
        if (dir === 1 ? !diff.gt(T) : !diff.lt(T)) return 'sample outside the condition';
        pairs.push([x, tf]);
      }
    }
    const expected = qcFromSamples(pairs);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const systemSymmetricTemplates = [qcSymmetric];
