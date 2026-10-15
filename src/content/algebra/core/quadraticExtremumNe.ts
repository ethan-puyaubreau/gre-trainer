import { Frac, frac } from '../../../engine/frac';
import { num, poly } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { intExcept } from './util';

export const quadraticExtremumTraps: Record<string, Trap> = {
  'alg-quad-vertex-sign': {
    label: 'Took the vertex at $x = \\frac{b}{2a}$ instead of $x = -\\frac{b}{2a}$',
    fix: 'Completing the square, $x^2 + bx = (x + \\frac{b}{2})^2 - \\frac{b^2}{4}$, puts the vertex at $x = -\\frac{b}{2}$ (for $a = 1$). Check by substituting.',
  },
  'alg-quad-answered-x': {
    label: 'Gave the $x$ of the vertex when the question asks for the extreme value (or the reverse)',
    fix: 'The vertex has two coordinates: the $x$ where the extreme occurs and the value of the function there. Answer the one asked.',
  },
  'alg-quad-constant': {
    label: 'Took the constant term as the least (or greatest) value',
    fix: 'The constant term is the value at $x = 0$, not at the vertex. Evaluate the function at the vertex instead.',
  },
  'alg-quad-completed-wrong': {
    label: 'Added instead of subtracted the squared half-coefficient when completing the square',
    fix: '$ax^2 + bx + c = a(x - p)^2 + (c - ap^2)$: the amount you add inside the square must be taken back out.',
  },
  'alg-quad-forgot-half': {
    label: 'Forgot to halve the coefficient of $x$ when locating the vertex',
    fix: 'The vertex is at $x = -\\frac{b}{2a}$, so there is a 2 in the denominator.',
  },
  'alg-quad-vertex-outside': {
    label: 'Used the vertex value although the vertex lies outside the allowed interval',
    fix: 'When the vertex is not an allowed $x$, the function is monotonic on the interval: its extreme is at the endpoint closest to the vertex.',
  },
  'alg-quad-endpoints-only': {
    label: 'Checked only the endpoints of the interval',
    fix: 'A parabola can reach its extreme between the endpoints: compare the vertex too whenever it lies inside the interval.',
  },
  'alg-quad-wrong-endpoint': {
    label: 'Took the endpoint farther from the vertex',
    fix: 'For a parabola opening up, the least value on an interval is nearest the vertex and the greatest is at the farther endpoint (mirror this for a parabola opening down).',
  },
};

interface Params {
  a: number;
  b: number;
  c: number;
  /** 0: all real x, 1: L <= x <= R, 2: x >= L */
  dom: 0 | 1 | 2;
  L: number;
  R: number;
  ask: 'value' | 'x';
}

const fn = (a: number, b: number, c: number) => (x: number) => a * x * x + b * x + c;

const quadraticExtremumNE: Template<Params> = {
  id: 'alg.quadratics.extremum-ne',
  skill: 'alg.quadratics',
  format: 'ne',
  style: 'least or greatest value of a quadratic, on all reals or on an interval',
  generate(rng, d) {
    for (;;) {
      const a = d === 1 ? 1 : d === 2 ? rng.pick([1, 2, 3, -1, -2, -3, 4]) : rng.pick([1, 2, -1, -2, 3]);
      const p = intExcept(rng, -8, 8, 0);
      const q = intExcept(rng, -18, 24, 0, 1);
      const b = -2 * a * p;
      const c = a * p * p + q;
      const f = fn(a, b, c);
      const ask: Params['ask'] = d === 1 && rng.chance(0.3) && Math.abs(p) > 1 ? 'x' : 'value';
      let dom: Params['dom'] = 0;
      let L = 0;
      let R = 0;
      if (d === 3) {
        dom = rng.pick([1, 1, 2] as const);
        const inInterior = rng.chance(0.4);
        if (dom === 2) L = inInterior ? p - rng.int(1, 5) : p + rng.int(1, 5);
        else {
          const w = rng.int(3, 8);
          if (inInterior) {
            L = p - rng.int(1, w - 1);
            R = L + w;
          } else if (rng.chance(0.5)) {
            L = p + rng.int(1, 4);
            R = L + w;
          } else {
            R = p - rng.int(1, 4);
            L = R - w;
          }
        }
      }
      const inside = dom === 0 || (dom === 1 && L < p && p < R) || (dom === 2 && L <= p);
      let key = ask === 'x' ? p : q;
      if (!inside) key = dom === 1 ? (a > 0 ? Math.min(f(L), f(R)) : Math.max(f(L), f(R))) : f(L);
      if (Math.abs(key) > 400 || key === 0 || key === 1) continue;
      const word = a > 0 ? 'least' : 'greatest';
      const fx = `f(x) = ${poly([a, b, c])}`;
      const domText = dom === 0 ? '' : dom === 1 ? ` for $${num(L)} \\le x \\le ${num(R)}$` : ` for $x \\ge ${num(L)}$`;
      const stem =
        ask === 'x'
          ? `For what value of $x$ does $${fx}$ take its least value, where $x$ is any real number?`
          : dom === 0
            ? `What is the ${word} value of $${fx}$ if $x$ can be any real number?`
            : `What is the ${word} value of $${fx}$${domText}?`;
      const pTex = num(p);
      const sq = `${a === 1 ? '' : a === -1 ? '-' : a}(x ${p < 0 ? '+' : '-'} ${Math.abs(p)})^2 ${q < 0 ? '-' : '+'} ${Math.abs(q)}`;
      const recog =
        ask === 'x' || dom === 0
          ? `A quadratic with a ${a > 0 ? 'positive' : 'negative'} leading coefficient has a ${a > 0 ? 'lowest' : 'highest'} point at its vertex, so complete the square.`
          : `On an interval, first locate the vertex: the extreme is there only if the vertex is an allowed $x$.`;
      const trapList: { value: Frac; trap: string; why: string }[] = [];
      if (ask === 'x') {
        trapList.push({ value: frac(-p), trap: 'alg-quad-vertex-sign', why: `$x = ${num(-p)}$ comes from using $+\\frac{b}{2a}$ for the vertex; substituting it gives $${num(f(-p))}$, which is not the least value.` });
        trapList.push({ value: frac(q), trap: 'alg-quad-answered-x', why: `$${num(q)}$ is the least value, not the $x$ where it occurs.` });
        trapList.push({ value: frac(2 * p), trap: 'alg-quad-forgot-half', why: `$-\\frac{b}{a} = ${num(2 * p)}$ forgets the 2 in $2a$.` });
        trapList.push({ value: frac(c), trap: 'alg-quad-constant', why: `$${num(c)}$ is the constant term, the value at $x = 0$.` });
      } else if (dom === 0) {
        trapList.push({ value: frac(c), trap: 'alg-quad-constant', why: `$${num(c)}$ is the value at $x = 0$, not at the vertex.` });
        trapList.push({ value: frac(p), trap: 'alg-quad-answered-x', why: `$${pTex}$ is the $x$ of the vertex, not the value there.` });
        trapList.push({ value: frac(f(-p)), trap: 'alg-quad-vertex-sign', why: `Using the vertex at $x = ${num(-p)}$ instead of $${pTex}$ gives $${num(f(-p))}$.` });
        trapList.push({ value: frac(c + a * p * p), trap: 'alg-quad-completed-wrong', why: `Adding $${num(a * p * p)}$ instead of subtracting it gives $${num(c + a * p * p)}$.` });
      } else {
        const ends = dom === 1 ? [L, R] : [L];
        if (!inside) trapList.push({ value: frac(q), trap: 'alg-quad-vertex-outside', why: `$${num(q)}$ is the value at the vertex $x = ${pTex}$, which is not in the interval.` });
        else for (const e of ends) trapList.push({ value: frac(f(e)), trap: 'alg-quad-endpoints-only', why: `$f(${num(e)}) = ${num(f(e))}$ is an endpoint value, but the vertex $x = ${pTex}$ is inside the interval and goes beyond it.` });
        if (dom === 1 && !inside) trapList.push({ value: frac(a > 0 ? Math.max(f(L), f(R)) : Math.min(f(L), f(R))), trap: 'alg-quad-wrong-endpoint', why: `The endpoint farther from the vertex gives $${num(a > 0 ? Math.max(f(L), f(R)) : Math.min(f(L), f(R)))}$, the opposite extreme.` });
        trapList.push({ value: frac(c), trap: 'alg-quad-constant', why: `$${num(c)}$ is the value at $x = 0$.` });
        trapList.push({ value: frac(f(-p)), trap: 'alg-quad-vertex-sign', why: `Using the vertex at $x = ${num(-p)}$ gives $${num(f(-p))}$.` });
      }
      const wrong = trapList.filter((t) => !t.value.eq(key));
      if (!wrong.length) continue;
      const checkLine =
        ask === 'x' ? `Check: $f(${pTex}) = ${num(q)}$, and values of $x$ on either side give more.` : `Check: $f(${pTex}) = ${num(a * p * p)} ${b * p < 0 ? '-' : '+'} ${Math.abs(b * p)} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${num(q)}$.`;
      const body =
        dom === 0 || ask === 'x'
          ? `Completing the square: $${fx}$ equals $${sq}$, because $${a === 1 ? '' : a === -1 ? '-' : a}(x ${p < 0 ? '+' : '-'} ${Math.abs(p)})^2$ contributes $${num(a * p * p)}$ to the constant, and $${num(c)} - ${a * p * p < 0 ? `(${a * p * p})` : a * p * p} = ${num(q)}$. ${a > 0 ? 'A square is never negative' : 'A square is never negative, so with a negative multiplier the term never rises above 0'}, so the ${word} value is reached when the square is 0, at $x = ${pTex}$, and it equals $${num(q)}$.`
          : `Completing the square, $f(x) = ${sq}$, so the vertex is at $x = ${pTex}$ with value $${num(q)}$. ${
              inside
                ? `That $x$ is allowed in the interval, so the ${word} value is $${num(q)}$.`
                : `That $x$ is NOT in the interval, so $f$ only ${(a > 0) === (L > p) ? 'increases' : 'decreases'} across it and the ${word} value sits at the endpoint nearer the vertex, $x = ${num(dom === 1 ? (Math.abs(L - p) < Math.abs(R - p) ? L : R) : L)}$: $f = ${num(key)}$.`
            }`;
      const explanation = `${recog}

${body}

${checkLine}

Trap: ${wrong[0].why}

Rule: write the quadratic as $a(x - p)^2 + q$; the vertex is $(p, q)$, and on an interval you must check whether $p$ is allowed.`;
      return {
        params: { a, b, c, dom, L, R, ask },
        q: { format: 'ne', stem, answer: frac(key), traps: wrong.map(({ value, trap }) => ({ value, trap })), explanation },
      };
    }
  },
  check(q, { a, b, c, dom, L, R, ask }) {
    if (q.format !== 'ne') return 'wrong format';
    const f = fn(a, b, c);
    let lo = -90;
    let hi = 90;
    if (dom === 1) [lo, hi] = [L, R];
    if (dom === 2) [lo, hi] = [L, L + 90];
    let best = f(lo);
    let bestX = lo;
    for (let x = lo; x <= hi + 1e-9; x += 0.25) {
      const v = f(x);
      if (a > 0 ? v < best : v > best) {
        best = v;
        bestX = x;
      }
    }
    // an opening-up parabola has no greatest value on all reals: those cases never ask for it
    const got = ask === 'x' ? bestX : best;
    return Math.abs(got - q.answer.toNumber()) < 1e-9 ? null : `expected ${got}`;
  },
};

export const quadraticExtremumTemplates = [quadraticExtremumNE];
