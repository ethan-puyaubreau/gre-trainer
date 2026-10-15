import { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import type { Difficulty, NumberLineFigure, Template, Trap } from '../../../engine/types';
import { F, pickWeighted } from './util';

export const absIntervalTraps: Record<string, Trap> = {
  'nl-width-for-radius': {
    label: 'Used the whole width of the segment as the distance from the center',
    fix: '$|x - c| \\le r$ describes the points within $r$ of the CENTER $c$, so $r$ is half the length of the segment: the segment from $-3$ to $7$ has center $2$ and radius $5$, not $10$.',
  },
  'nl-center-sign': {
    label: 'Got the sign of the center wrong',
    fix: '$|x - c|$ is the distance from $c$. For a center at $-2$ write $|x - (-2)| = |x + 2|$; for a center at $2$ write $|x - 2|$.',
  },
  'nl-inside-outside': {
    label: 'Mixed up "within" and "farther than"',
    fix: '"Distance at most $r$" ($\\le$) is the stretch around the center; "distance more than $r$" ($>$) is the two rays outside it. Test the center: it must satisfy the inside case.',
  },
  'nl-endpoint-as-center': {
    label: 'Centered the inequality at an endpoint instead of the midpoint',
    fix: 'The center is the midpoint of the two endpoints, $\\frac{L + U}{2}$. An inequality centered at one endpoint is not symmetric about the segment.',
  },
  'nl-strict-for-inclusive': {
    label: 'Used a strict inequality although the endpoints are included',
    fix: '"Endpoints included" needs $\\le$ (or $\\ge$). With $<$ the endpoints themselves, where the distance equals the radius, are left out.',
  },
  'nl-one-branch': {
    label: 'Kept only one of the two sides of an absolute value',
    fix: '$|x - c| > r$ means $x - c > r$ OR $x - c < -r$. Both rays are solutions; keeping one loses half the set.',
  },
  'nl-coefficient-ignored': {
    label: 'Ignored the coefficient of $x$ inside the absolute value',
    fix: 'In $|2x - 8| \\le 6$ the bounds $-6 \\le 2x - 8 \\le 6$ must be divided by 2 at the end: $1 \\le x \\le 7$, not $2 \\le x \\le 14$.',
  },
  'nl-divide-one-side': {
    label: 'Divided the radius by the coefficient but not the center',
    fix: 'After $-r \\le ax - b \\le r$ add $b$ to all three parts, THEN divide all three by $a$: the center becomes $\\frac{b}{a}$, not $b$.',
  },
};

type Op = 'le' | 'lt' | 'ge' | 'gt';
type Desc =
  | { k: 'abs'; c: Frac; r: Frac; op: Op }
  | { k: 'in'; lo: Frac; hi: Frac; strict: boolean }
  | { k: 'out'; lo: Frac; hi: Frac; strict: boolean }
  | { k: 'ray'; dir: 'gt' | 'lt'; v: Frac; strict: boolean };

interface Params {
  mode: 'segment' | 'solve' | 'scaled';
  L: Frac;
  U: Frac;
  given: { c: Frac; r: Frac; op: Op; a: number } | null;
  cands: Desc[];
}

const SYM: Record<Op, string> = { le: '\\le', lt: '<', ge: '\\ge', gt: '>' };
const shift = (c: Frac) => (c.sign() === 0 ? 'x' : c.sign() > 0 ? `x - ${c.toTex()}` : `x + ${c.neg().toTex()}`);
const tex = (d: Desc): string => {
  if (d.k === 'abs') return `|${shift(d.c)}| ${SYM[d.op]} ${d.r.toTex()}`;
  const le = d.strict ? '<' : '\\le';
  const ge = d.strict ? '>' : '\\ge';
  if (d.k === 'ray') return `x ${d.dir === 'gt' ? ge : le} ${d.v.toTex()}`;
  return d.k === 'in' ? `${d.lo.toTex()} ${le} x ${le} ${d.hi.toTex()}` : `x ${le} ${d.lo.toTex()} \\text{ or } x ${ge} ${d.hi.toTex()}`;
};
const holds = (d: Desc, x: Frac): boolean => {
  if (d.k === 'abs') {
    const t = x.sub(d.c).abs();
    return d.op === 'le' ? t.lte(d.r) : d.op === 'lt' ? t.lt(d.r) : d.op === 'ge' ? t.gte(d.r) : t.gt(d.r);
  }
  if (d.k === 'ray') return d.dir === 'gt' ? (d.strict ? x.gt(d.v) : x.gte(d.v)) : d.strict ? x.lt(d.v) : x.lte(d.v);
  if (d.k === 'in') return d.strict ? x.gt(d.lo) && x.lt(d.hi) : x.gte(d.lo) && x.lte(d.hi);
  return d.strict ? x.lt(d.lo) || x.gt(d.hi) : x.lte(d.lo) || x.gte(d.hi);
};

const absInterval: Template<Params> = {
  id: 'arith.number-line.abs-interval-mcs',
  skill: 'arith.number-line',
  format: 'mcs',
  style: 'absolute value inequality and the set of points it describes on the number line',
  generate(rng: Rng, diff: Difficulty) {
    for (;;) {
      const mode = pickWeighted<Params['mode']>(rng, diff === 1 ? [['segment', 1]] : diff === 2 ? [['segment', 1], ['solve', 2]] : [['scaled', 3], ['solve', 1]]);
      type Item = { d: Desc; trap?: string; ok?: boolean };
      let items: Item[];
      let stem: string;
      let explanation: string;
      let L = F(0);
      let U = F(0);
      let given: Params['given'] = null;
      let figure: NumberLineFigure | undefined;
      if (mode === 'segment') {
        const half = diff === 2;
        const m = half ? F(rng.int(-9, 9) * 2 + rng.pick([0, 1]), 2) : F(rng.int(-9, 9));
        const h = half ? F(rng.int(1, 7) * 2 + 1, 2) : F(rng.int(1, 8));
        if (m.sign() === 0) continue;
        L = m.sub(h);
        U = m.add(h);
        items = [
          { d: { k: 'abs', c: m, r: h, op: 'le' }, ok: true },
          { d: { k: 'abs', c: m, r: h.mul(2), op: 'le' }, trap: 'nl-width-for-radius' },
          { d: { k: 'abs', c: m.neg(), r: h, op: 'le' }, trap: 'nl-center-sign' },
          { d: { k: 'abs', c: m, r: h, op: 'ge' }, trap: 'nl-inside-outside' },
          { d: { k: 'abs', c: m, r: h, op: 'lt' }, trap: 'nl-strict-for-inclusive' },
          { d: { k: 'abs', c: L, r: h, op: 'le' }, trap: 'nl-endpoint-as-center' },
        ];
        stem = `On the number line, the points at $${L.toTex()}$ and $${U.toTex()}$ are the endpoints of a segment. Which of the following inequalities is true for exactly the numbers $x$ on the segment, endpoints included?`;
        figure = { kind: 'numberLine', min: Math.floor(L.toNumber()) - 1, max: Math.ceil(U.toNumber()) + 1, points: [{ at: L.toNumber(), value: `$${L.toTex()}$` }, { at: U.toNumber(), value: `$${U.toTex()}$` }] };
        explanation = `Recognize: a segment symmetric about its midpoint is described by one absolute value, $|x - \\text{center}| \\le \\text{radius}$.

The center is the midpoint $\\frac{${L.toTex()} + ${U.toTex().startsWith('-') ? `(${U.toTex()})` : U.toTex()}}{2} = ${m.toTex()}$ and the radius is half the length, $\\frac{${U.toTex()} - ${L.sign() < 0 ? `(${L.toTex()})` : L.toTex()}}{2} = ${h.toTex()}$. So the inequality is $${tex(items[0].d)}$.

Check: the endpoints give $|${shift(m).replace('x', L.toTex())}| = ${h.toTex()}$, so they are included by $\\le$.`;
      } else if (mode === 'solve') {
        const neg = diff === 3;
        const c = F(neg ? -rng.int(1, 9) : rng.int(1, 9));
        const r = F(rng.int(1, neg ? 9 : 6));
        const op = rng.pick<Op>(['gt', 'ge', 'lt', 'le']);
        given = { c, r, op, a: 1 };
        const lo = c.sub(r);
        const hi = c.add(r);
        const outer = op === 'gt' || op === 'ge';
        const strict = op === 'gt' || op === 'lt';
        const mk = (l: Frac, h: Frac, out: boolean, st: boolean): Desc => (out ? { k: 'out', lo: l, hi: h, strict: st } : { k: 'in', lo: l, hi: h, strict: st });
        const dir = rng.pick(['gt', 'lt'] as const);
        const oneBranch: Item = { d: { k: 'ray', dir, v: outer ? (dir === 'gt' ? hi : lo) : dir === 'gt' ? lo : hi, strict }, trap: 'nl-one-branch' };
        items = [
          { d: mk(lo, hi, outer, strict), ok: true },
          { d: mk(lo, hi, !outer, strict), trap: 'nl-inside-outside' },
          { d: mk(c.neg().sub(r), c.neg().add(r), outer, strict), trap: 'nl-center-sign' },
          { d: mk(c.sub(r.mul(2)), c.add(r.mul(2)), outer, strict), trap: 'nl-width-for-radius' },
          oneBranch,
          { d: mk(lo, hi, outer, !strict), trap: 'nl-strict-for-inclusive' },
        ];
        const given0: Desc = { k: 'abs', c, r, op };
        stem = `Which of the following is the set of all numbers $x$ that satisfy $${tex(given0)}$ ?`;
        const dist = outer ? `farther than ${op === 'ge' ? 'or exactly ' : ''}$${r.toTex()}$ from` : `within ${op === 'le' ? '(or exactly at) ' : ''}$${r.toTex()}$ of`;
        explanation = `Recognize: $|x - c|$ is the distance between $x$ and $c$ on the number line, so the inequality describes points ${dist} $${c.toTex()}$.

The center is $${c.toTex()}$ and the radius is $${r.toTex()}$, so the borders are $${c.toTex()} - ${r.toTex()} = ${lo.toTex()}$ and $${c.toTex()} + ${r.toTex()} = ${hi.toTex()}$. ${outer ? 'Farther than the radius means outside the borders, on both rays' : 'Within the radius means between the borders'}: $${tex(items[0].d)}$.

Check: the center $${c.toTex()}$ has distance 0 from itself, so it ${outer ? 'must not' : 'must'} belong to the set, and it ${holds(items[0].d, c) ? 'does' : 'does not'}.`;
        L = lo;
        U = hi;
      } else {
        const a = rng.pick([2, 2, 3]);
        const p = rng.int(-6, 4);
        let q = p + rng.int(2, 8);
        if (a === 3 && (q - p) % 2) q += 1;
        if (a === 3 && (p + q) % 2) continue;
        const b = (a * (p + q)) / 2;
        const r = (a * (q - p)) / 2;
        if (!Number.isInteger(b) || !Number.isInteger(r) || b === 0) continue;
        const op: Op = rng.pick(['le', 'lt']);
        const strict = op === 'lt';
        const Bf = F(b);
        const Rf = F(r);
        const Af = F(a);
        given = { c: Bf, r: Rf, op, a };
        const mid = F(p + q, 2);
        const rad = F(q - p, 2);
        const lo = F(p);
        const hi = F(q);
        items = [
          { d: { k: 'in', lo, hi, strict }, ok: true },
          { d: { k: 'in', lo: Bf.sub(Rf), hi: Bf.add(Rf), strict }, trap: 'nl-coefficient-ignored' },
          { d: { k: 'in', lo: Bf.sub(Rf.div(Af)), hi: Bf.add(Rf.div(Af)), strict }, trap: 'nl-divide-one-side' },
          { d: { k: 'out', lo, hi, strict }, trap: 'nl-inside-outside' },
          { d: { k: 'in', lo: mid.neg().sub(rad), hi: mid.neg().add(rad), strict }, trap: 'nl-center-sign' },
        ];
        const lin = b > 0 ? `${a}x - ${b}` : `${a}x + ${-b}`;
        const Bn = Math.abs(b);
        stem = `Which of the following is the set of all numbers $x$ that satisfy $|${lin}| ${SYM[op]} ${r}$ ?`;
        explanation = `Recognize: an absolute value inequality $|u| ${SYM[op]} r$ means $-r ${SYM[op]} u ${SYM[op]} r$, here with $u = ${lin}$.

Write $-${r} ${SYM[op]} ${lin} ${SYM[op]} ${r}$. ${b > 0 ? 'Add' : 'Subtract'} ${Bn} in all three parts: $${b - r} ${SYM[op]} ${a}x ${SYM[op]} ${b + r}$. Divide all three parts by ${a}: $${tex(items[0].d)}$.

Check: at the border $x = ${q}$, $|${a}(${q}) ${b > 0 ? '-' : '+'} ${Bn}| = ${Math.abs(a * q - b)}$, which equals the bound ${r}.`;
        L = lo;
        U = hi;
      }
      // texts must be distinct
      const texts = items.map((i) => `$${tex(i.d)}$`);
      if (new Set(texts).size !== texts.length) continue;
      const keep = rng.shuffle([items.find((i) => i.ok)!, ...rng.sample(items.filter((i) => !i.ok), 4)]);
      const why: Record<string, string> = {
        'nl-width-for-radius': 'uses twice the right radius',
        'nl-center-sign': 'has the wrong sign for the center',
        'nl-inside-outside': 'describes the opposite set',
        'nl-endpoint-as-center': 'is centered at an endpoint',
        'nl-strict-for-inclusive': 'has the wrong strictness at the borders',
        'nl-one-branch': 'keeps only one side',
        'nl-coefficient-ignored': 'skips the division by the coefficient',
        'nl-divide-one-side': 'divides only the radius by the coefficient',
      };
      const seen = new Set<string>();
      const named = keep.filter((i) => i.trap && !seen.has(i.trap) && seen.add(i.trap)).slice(0, 2);
      explanation += `

Trap: the choice $${tex(named[0].d)}$ ${why[named[0].trap!]}${named[1] ? `, and the choice $${tex(named[1].d)}$ ${why[named[1].trap!]}` : ''}.

Read the center and the radius from the endpoints, and apply every operation to all parts.`;
      return {
        params: { mode, L, U, given, cands: keep.map((i) => i.d) },
        q: {
          format: 'mcs',
          stem,
          ...(figure ? { figure } : {}),
          choices: keep.map((i) => ({ text: `$${tex(i.d)}$`, ...(i.trap ? { trap: i.trap } : {}) })),
          answer: keep.findIndex((i) => i.ok),
          explanation,
        },
      };
    }
  },
  check(q, { mode, L, U, given, cands }) {
    if (q.format !== 'mcs') return 'wrong format';
    // Truth of the original statement at many test points, compared with every choice.
    const truth = (x: Frac): boolean => {
      if (mode === 'segment') return x.gte(L) && x.lte(U);
      const g = given!;
      const t = x.mul(g.a).sub(g.c).abs();
      return g.op === 'le' ? t.lte(g.r) : g.op === 'lt' ? t.lt(g.r) : g.op === 'ge' ? t.gte(g.r) : t.gt(g.r);
    };
    const xs: Frac[] = [];
    for (let k = -240; k <= 240; k++) xs.push(F(k, 12));
    const hits = cands.flatMap((d, i) => (xs.every((x) => holds(d, x) === truth(x)) ? [i] : []));
    if (hits.length !== 1) return `${hits.length} choices match the statement`;
    return hits[0] === q.answer ? null : `expected choice ${hits[0]}, got ${q.answer}`;
  },
};

export const absIntervalTemplates: Template<any>[] = [absInterval];
