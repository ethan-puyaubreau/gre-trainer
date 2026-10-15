import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';

/** Greatest or least value of an expression when integers sit between bounds (numeric entry). */
interface BoundsParams {
  names: [string, string];
  /** integer ranges after reading the strict signs: [lo, hi] for each variable */
  r: [[number, number], [number, number]];
  /** how the bounds are written: [loStrict, hiStrict] for each variable */
  strict: [[boolean, boolean], [boolean, boolean]];
  /** expression: p*x + q*y, or the product when product is true */
  p: number;
  q: number;
  product: boolean;
  greatest: boolean;
}

const evalAt = (b: BoundsParams, x: number, y: number) => (b.product ? x * y : b.p * x + b.q * y);

function exprTex(b: BoundsParams) {
  const [x, y] = b.names;
  return b.product ? `${x}${y}` : lin([[b.p, x], [b.q, y]]);
}

function boundTex(name: string, [lo, hi]: [number, number], [ls, hs]: [boolean, boolean]) {
  return `${num(ls ? lo - 1 : lo)} ${ls ? '<' : '\\le'} ${name} ${hs ? '<' : '\\le'} ${num(hs ? hi + 1 : hi)}`;
}

/** Extreme over the corners of the two integer ranges. */
function corners(b: BoundsParams, r = b.r): { v: number; x: number; y: number } {
  const cs = [r[0][0], r[0][1]].flatMap((x) => [r[1][0], r[1][1]].map((y) => ({ x, y, v: evalAt(b, x, y) })));
  return cs.reduce((m, c) => ((b.greatest ? c.v > m.v : c.v < m.v) ? c : m));
}

function build(b: BoundsParams) {
  const [x, y] = b.names;
  const best = corners(b);
  const wide = (r: [number, number], s: [boolean, boolean]): [number, number] => [s[0] ? r[0] - 1 : r[0], s[1] ? r[1] + 1 : r[1]];
  const treatedInclusive = corners(b, [wide(b.r[0], b.strict[0]), wide(b.r[1], b.strict[1])]);
  const naive = b.greatest ? evalAt(b, b.r[0][1], b.r[1][1]) : evalAt(b, b.r[0][0], b.r[1][0]);
  const traps = [
    { value: new Frac(treatedInclusive.v), trap: 'alg-ineq-bounds-endpoint' },
    { value: new Frac(naive), trap: 'alg-ineq-bounds-same-direction' },
  ].filter((t, i, a) => !t.value.eq(best.v) && a.findIndex((u) => u.value.eq(t.value)) === i);
  const stem = `If $${boundTex(x, b.r[0], b.strict[0])}$ and $${boundTex(y, b.r[1], b.strict[1])}$, where $${x}$ and $${y}$ are integers, what is the ${b.greatest ? 'greatest' : 'least'} possible value of $${exprTex(b)}$?`;
  const ints = (n: string, r: [number, number], s: [boolean, boolean]) =>
    s[0] || s[1] ? `$${n}$ runs from $${num(r[0])}$ to $${num(r[1])}$` : '';
  const shrink = [ints(x, b.r[0], b.strict[0]), ints(y, b.r[1], b.strict[1])].filter(Boolean);
  const first = shrink.length ? `Between integers a strict sign moves the bound inward by 1: ${shrink.join(' and ')}.` : `The bounds are included, so $${x}$ runs from $${num(b.r[0][0])}$ to $${num(b.r[0][1])}$ and $${y}$ from $${num(b.r[1][0])}$ to $${num(b.r[1][1])}$.`;
  let method: string;
  if (b.product) {
    const list = [b.r[0][0], b.r[0][1]].flatMap((xv) => [b.r[1][0], b.r[1][1]].map((yv) => `$${num(xv)} \\cdot ${yv < 0 ? `(${yv})` : yv} = ${num(xv * yv)}$`)).join(', ');
    method = `A product of two ranges is extreme at a corner, so test all four corners, signs included. The four products are ${list}. The ${b.greatest ? 'greatest' : 'least'} is $${num(best.v)}$, from $${x} = ${num(best.x)}$ and $${y} = ${num(best.y)}$.`;
  } else {
    const end = (c: number, n: string, v: number) => `$${n}$ has a ${c > 0 ? 'positive' : 'negative'} multiplier, so use its ${(c > 0) === b.greatest ? 'largest' : 'smallest'} value, $${num(v)}$`;
    method = `To ${b.greatest ? 'maximize' : 'minimize'} $${exprTex(b)}$, pick each end by the sign in front of the variable: ${end(b.p, x, best.x)}, and ${end(b.q, y, best.y)}. The result is $${num(best.v)}$.`;
  }
  const cited = traps[0];
  const trapLine = cited
    ? cited.trap === 'alg-ineq-bounds-endpoint'
      ? `Trap: using the written bounds as if they were included gives $${num(cited.value)}$, but a strict sign excludes its end.`
      : `Trap: pushing both variables the same way gives $${num(cited.value)}$, but a negative coefficient reverses which end is best.`
    : '';
  const explanation = `Extreme values over integers sit at the ends of the allowed ranges.

${first} ${method}

${trapLine} Rule: shrink strict bounds first, then test the ends, with signs.`.replace(/\n\n \s*Rule/, '\n\nRule');
  return { stem, answer: new Frac(best.v), traps, explanation };
}

const boundsNE: Template<BoundsParams> = {
  id: 'alg.inequalities.bounds-ne',
  skill: 'alg.inequalities',
  format: 'ne',
  style: 'greatest or least value of an expression for integers between bounds',
  generate(rng, d) {
    for (;;) {
      const names = rng.pick([['x', 'y'], ['m', 'n'], ['a', 'b']] as [string, string][]);
      const rangeOf = (lo: number, hi: number, strictP: number): { r: [number, number]; s: [boolean, boolean] } => {
        const s: [boolean, boolean] = [rng.chance(strictP), rng.chance(strictP)];
        const a = rng.int(lo, hi - 3);
        const w = rng.int(2, 7);
        return { r: [a, a + w], s };
      };
      let p = 1;
      let q = 1;
      let product = false;
      let rx;
      let ry;
      if (d === 1) {
        rx = rangeOf(1, 9, 1);
        ry = rangeOf(1, 9, 1);
        p = 1;
        q = 1;
      } else if (d === 2) {
        rx = rangeOf(-4, 8, 0.6);
        ry = rangeOf(-4, 8, 0.6);
        p = rng.int(1, 4);
        q = rng.pick([-1, 1]) * rng.int(1, 4);
      } else {
        rx = rangeOf(-9, 2, 0.6);
        ry = rangeOf(-9, 2, 0.6);
        product = true;
        if (rx.r[0] * rx.r[1] >= 0 && ry.r[0] * ry.r[1] >= 0) continue;
      }
      const b: BoundsParams = { names, r: [rx.r, ry.r], strict: [rx.s, ry.s], p, q, product, greatest: rng.chance(0.55) };
      if (d === 2 && Math.abs(p) === Math.abs(q) && p === q) continue;
      const out = build(b);
      if (out.answer.eq(0) || out.answer.eq(1) || out.traps.length < 1) continue;
      return { q: { format: 'ne', stem: out.stem, answer: out.answer, traps: out.traps, explanation: out.explanation }, params: b };
    }
  },
  check(q, b) {
    if (q.format !== 'ne') return 'wrong format';
    let best = b.greatest ? -Infinity : Infinity;
    for (let x = b.r[0][0] - 3; x <= b.r[0][1] + 3; x++)
      for (let y = b.r[1][0] - 3; y <= b.r[1][1] + 3; y++) {
        const okx = x >= b.r[0][0] && x <= b.r[0][1];
        const oky = y >= b.r[1][0] && y <= b.r[1][1];
        if (!okx || !oky) continue;
        const v = evalAt(b, x, y);
        best = b.greatest ? Math.max(best, v) : Math.min(best, v);
      }
    if (!q.answer.eq(best)) return `expected ${best}`;
    // the stem must describe the stored integer ranges
    const [lo, hi] = b.r[0];
    const txt = boundTex(b.names[0], [lo, hi], b.strict[0]);
    return q.stem.includes(txt) ? null : 'stem does not show the x bounds';
  },
};

export const boundsTemplates = [boundsNE];

export const boundsTraps: Record<string, Trap> = {
  'alg-ineq-bounds-endpoint': {
    label: 'Used a strict bound as if it were included',
    fix: 'For integers, $x < 6$ means $x \\le 5$ and $x > 2$ means $x \\ge 3$. Shrink strict bounds before choosing the ends.',
  },
  'alg-ineq-bounds-same-direction': {
    label: 'Pushed every variable the same way',
    fix: 'A negative coefficient (or a subtraction) reverses which end of the range is best: look at the sign in front of each variable.',
  },
};
