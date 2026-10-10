import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { decimal, num } from '../../../engine/tex';
import type { GeometryFigure, QCChoice, Template } from '../../../engine/types';
import {
  FigBuilder,
  TRI_NAMES,
  add,
  angleAt,
  bisect,
  dir,
  dist,
  foot,
  fromSides,
  intersect,
  mul,
  near,
  shoelace,
  softAngles,
  sub,
  unit,
  triFromAngles,
  type Pt,
} from './fig';
import { mulberry } from './lines';
import { angleLabel, checkMcm, checkMcs, evalTex, exprTex, intChoices, linTex, qcTraps, QC_SAY } from './util';

const SKILL = 'geo.triangles';
/** Exact value for display: integers with commas, other terminating fractions as decimals. */
const dec = (f: Frac) => (f.isInt() ? num(f.n) : decimal(f));

interface E {
  c: number;
  k: number;
}
const ev = (e: E, x: number) => e.c * x + e.k;
const lab = (e: E) => angleLabel(e.c, e.k);
const term = (e: E) => (e.c === 0 || e.k === 0 ? exprTex(e.c, e.k) : `(${exprTex(e.c, e.k)})`);

type V3 = 'T' | 'L' | 'R';

/** Triangle drawn from its (true) angles at top T, bottom-left L, bottom-right R; base 4 units. */
function triPts(angT: number, angL: number, angR: number): Record<V3, Pt> {
  const [, l, r] = softAngles([angT, angL, angR]);
  const [L, R, T] = triFromAngles(l, r, 4);
  return { T, L, R };
}

/**
 * Coordinates of a triangle from TWO known angles, built with rays only (the third angle is never
 * computed as 180 minus the others): used by check() to re-measure figures.
 */
function triFromTwo(known: Partial<Record<V3, number>>): Record<V3, Pt> | null {
  const { T, L, R } = known;
  if (L !== undefined && R !== undefined) {
    if (L + R >= 180) return null;
    const [l, r, t] = triFromAngles(L, R, 1);
    return { L: l, R: r, T: t };
  }
  const O: Pt = [0, 0];
  if (T !== undefined && L !== undefined) {
    const Tp = dir(L);
    const Rp = intersect(Tp, dir(L + 180 + T), O, [1, 0]);
    return Rp[0] > 1e-9 ? { L: O, T: Tp, R: Rp } : null;
  }
  if (T !== undefined && R !== undefined) {
    const Tp = dir(180 - R);
    const Lp = intersect(Tp, dir(-R - T), O, [1, 0]);
    return Lp[0] < -1e-9 ? { R: O, T: Tp, L: Lp } : null;
  }
  return null;
}
const angOf = (t: Record<V3, Pt>, v: V3) => (v === 'T' ? angleAt(t.T, t.L, t.R) : v === 'L' ? angleAt(t.L, t.T, t.R) : angleAt(t.R, t.T, t.L));
/** Side opposite vertex v. */
const sideOf = (t: Record<V3, Pt>, v: V3) => (v === 'T' ? dist(t.L, t.R) : v === 'L' ? dist(t.T, t.R) : dist(t.T, t.L));

/** Three angle expressions in x summing to 180 (values in [lo, hi]). */
function triExprs(rng: Rng, d: number, lo = 20, hi = 125): { exprs: [E, E, E]; x0: number } {
  for (;;) {
    const x0 = d === 1 ? rng.int(2, 6) * 5 : rng.int(10, 40);
    const e1: E = { c: rng.int(1, d === 1 ? 3 : 4), k: d === 1 ? 0 : rng.pick([0, 10, 20, -10, 15, 5, 30]) };
    const e2: E = { c: rng.int(1, d === 1 ? 3 : 4), k: rng.pick([0, 10, 20, -10, 15, -5, 30]) };
    const c3 = rng.int(1, d === 1 ? 3 : 5);
    const k3 = 180 - c3 * x0 - ev(e1, x0) - ev(e2, x0);
    if (Math.abs(k3) > 60 || (d === 1 && k3 % 5 !== 0)) continue;
    const exprs: [E, E, E] = [e1, e2, { c: c3, k: k3 }];
    const vals = exprs.map((e) => ev(e, x0));
    if (vals.some((v) => v < lo || v > hi)) continue;
    if (new Set(exprs.map((e) => `${e.c},${e.k}`)).size < 3) continue;
    return { exprs: rng.shuffle(exprs) as [E, E, E], x0 };
  }
}

/** Brute-force x so that a triangle built from the L and R expressions closes with the T expression. */
function solveTriX(exprs: [E, E, E]): { x: number; ang: Record<V3, number> } | null {
  const hits: { x: number; ang: Record<V3, number> }[] = [];
  for (let x = -60; x <= 200; x++) {
    const [eT, eL, eR] = exprs;
    const l = ev(eL, x);
    const r = ev(eR, x);
    const t = ev(eT, x);
    if (l <= 0 || r <= 0 || t <= 0 || l + r >= 180) continue;
    const tri = triFromTwo({ L: l, R: r })!;
    if (near(angOf(tri, 'T'), t, 1e-9)) hits.push({ x, ang: { T: angOf(tri, 'T'), L: l, R: r } });
  }
  return hits.length === 1 ? hits[0] : null;
}

/* ================================================================== 1. Angle sum and exterior angles (MCS) */

type SumParams =
  | { v: 'expr'; exprs: [E, E, E]; ask: 'x' | 'largest' | 'diff'; values: number[] }
  | { v: 'exterior'; ext: E; top: E; left: E; ask: 'x' | 'top'; values: number[] }
  | { v: 'iso'; apex: 'T' | 'L'; given: V3; value: number; ask: V3 | 'ext'; values: number[] };

const angleSum: Template<SumParams> = {
  id: 'geo.triangles.angle-sum',
  skill: SKILL,
  format: 'mcs',
  style: 'triangle angle sum, exterior angle or isosceles angles',
  generate(rng, d) {
    const names = rng.pick(TRI_NAMES);
    const [nT, nL, nR] = names;
    const v = rng.pick(d === 1 ? (['expr', 'iso'] as const) : d === 2 ? (['expr', 'exterior', 'iso'] as const) : (['expr', 'exterior', 'exterior', 'iso'] as const));
    if (v === 'expr') {
      const { exprs, x0 } = triExprs(rng, d);
      const vals = exprs.map((e) => ev(e, x0));
      const mx = Math.max(...vals);
      const mn = Math.min(...vals);
      let ask: 'x' | 'largest' | 'diff' = d === 1 ? 'x' : d === 2 ? 'largest' : rng.pick(['largest', 'diff'] as const);
      if (ask !== 'x' && vals.filter((t) => t === mx).length > 1) ask = 'x';
      const correct = ask === 'x' ? x0 : ask === 'largest' ? mx : mx - mn;
      const C = exprs.reduce((s, e) => s + e.c, 0);
      const K = exprs.reduce((s, e) => s + e.k, 0);
      const xw = (360 - K) / C;
      const traps: { value: number; trap: string }[] = [];
      const eMax = exprs[vals.indexOf(mx)];
      if (ask === 'x') traps.push({ value: xw, trap: 'geo-tri-sum-360' });
      if (ask === 'largest') {
        traps.push({ value: ev(eMax, xw), trap: 'geo-tri-sum-360' }, { value: x0, trap: 'geo-ang-wrong-unknown' });
      }
      if (ask === 'diff') traps.push({ value: mx, trap: 'geo-ang-wrong-unknown' }, { value: x0, trap: 'geo-ang-wrong-unknown' });
      const fillers = ask === 'x' ? [x0 + 5, x0 - 5, x0 + 10, 2 * x0] : [correct + 10, correct - 10, correct + 20, correct - 5, 180 - correct];
      const { choices, answer, values } = intChoices(rng, correct, traps, fillers);
      const pts = triPts(vals[0], vals[1], vals[2]);
      const fb = new FigBuilder().pt(nT, pts.T).pt(nL, pts.L).pt(nR, pts.R).poly(nT, nL, nR);
      fb.angle(nT, nL, nR, lab(exprs[0])).angle(nL, nT, nR, lab(exprs[1])).angle(nR, nT, nL, lab(exprs[2]));
      const askText =
        ask === 'x' ? 'what is the value of $x$?' : ask === 'largest' ? `what is the measure, in degrees, of the largest angle of triangle $${nT}${nL}${nR}$?` : `what is the positive difference, in degrees, between the measures of the largest and smallest angles of triangle $${nT}${nL}${nR}$?`;
      const after =
        ask === 'x'
          ? ''
          : `\n\nThe angles are ${vals.map((t) => `$${t}^\\circ$`).join(', ')}, so ${ask === 'largest' ? `the largest is $${mx}^\\circ$` : `the difference is $${mx} - ${mn} = ${correct}$`}. (Stopping at $x = ${x0}$ answers the wrong question.)`;
      return {
        params: { v, exprs, ask, values },
        q: {
          format: 'mcs',
          stem: `In triangle $${nT}${nL}${nR}$ above, ${askText}`,
          figure: fb.build(),
          choices,
          answer,
          explanation: `The angles of a triangle add up to $180^\\circ$:

$$${exprs.map(term).join(' + ')} = 180$$

so $${linTex(C, K)} = 180$${K === 0 ? '' : `, $${linTex(C, 0)} = ${180 - K}$`}, and $x = ${x0}$.${after}

Using $360^\\circ$ (the angle sum of a quadrilateral) instead of $180^\\circ$ is a common slip.`,
        },
      };
    }
    if (v === 'exterior') {
      let ext: E;
      let top: E;
      let left: E;
      let x0: number;
      for (;;) {
        const p = rng.int(6, 16) * 5;
        const q = rng.int(5, 14) * 5;
        if (p + q > 160 || p + q < 70 || p === q) continue;
        const e = p + q;
        if (d === 2) {
          x0 = p;
          ext = { c: 0, k: e };
          top = { c: 1, k: 0 };
          left = { c: 0, k: q };
        } else {
          x0 = rng.int(10, 35);
          const c2 = rng.int(1, 3);
          const k2 = p - c2 * x0;
          const c1 = rng.int(c2 + 1, c2 + 3);
          const k1 = e - c1 * x0;
          if (Math.abs(k1) > 70 || Math.abs(k2) > 70) continue;
          ext = { c: c1, k: k1 };
          top = { c: c2, k: k2 };
          left = { c: 0, k: q };
        }
        break;
      }
      const p = ev(top, x0);
      const q = left.k;
      const e = ev(ext, x0);
      const ask: 'x' | 'top' = d === 2 ? 'x' : rng.pick(['x', 'top'] as const);
      const correct = ask === 'x' ? x0 : p;
      // trap: treating the exterior angle as one of the triangle's angles
      const xw = d === 2 ? 180 - e - q : (180 - ext.k - top.k - q) / (ext.c + top.c);
      const traps: { value: number; trap: string }[] = [];
      if (ask === 'x') traps.push({ value: xw, trap: 'geo-tri-ext-adjacent' });
      else {
        traps.push({ value: ev(top, xw), trap: 'geo-tri-ext-adjacent' }, { value: x0, trap: 'geo-ang-wrong-unknown' });
      }
      traps.push({ value: 180 - e, trap: 'geo-ang-wrong-unknown' });
      const { choices, answer, values } = intChoices(rng, correct, traps, [correct + 10, correct - 10, correct + 5, e]);
      const pts = triPts(p, q, 180 - p - q);
      const fb = new FigBuilder().pt(nT, pts.T).pt(nL, pts.L).pt(nR, pts.R, [-0.5, -1]).poly(nT, nL, nR);
      const S = fb.helper(add(pts.R, [1.9, 0]));
      fb.seg(nR, S);
      fb.angle(nT, nL, nR, lab(top)).angle(nL, nT, nR, lab(left)).angle(nR, S, nT, lab(ext));
      const eq = d === 2 ? `${e} = x + ${q}` : `${exprTex(ext.c, ext.k)} = ${term(top)} + ${q}`;
      return {
        params: { v, ext, top, left, ask, values },
        q: {
          format: 'mcs',
          stem: `In the figure above, side $${nL}${nR}$ of triangle $${nT}${nL}${nR}$ is extended. ${ask === 'x' ? 'What is the value of $x$?' : `What is the measure, in degrees, of angle $${nT}$?`}`,
          figure: fb.build(),
          choices,
          answer,
          explanation: `An exterior angle of a triangle equals the sum of the two interior angles that are not next to it (the remote interior angles), here the angles at $${nT}$ and $${nL}$:

$$${eq}$$

${d === 2 ? `so $x = ${e} - ${q} = ${x0}$.` : `so ${ext.c - top.c === 1 ? '' : `$${linTex(ext.c - top.c, 0)} = ${num(top.k + q - ext.k)}$ and `}$x = ${x0}$.${ask === 'top' ? ` Angle $${nT}$ measures $${evalTex(top.c, top.k, x0)} = ${p}$ degrees.` : ''}`}

The exterior angle is not an angle of the triangle: adding it to the other two angles to make $180^\\circ$ is the trap.`,
        },
      };
    }
    // isosceles
    const apex: 'T' | 'L' = d === 1 ? 'T' : rng.pick(['T', 'L'] as const);
    let given: V3;
    let value: number;
    let ask: V3 | 'ext';
    let correct: number;
    const traps: { value: number; trap: string }[] = [];
    let ang: Record<V3, number>;
    if (apex === 'T') {
      if (rng.chance(0.5)) {
        value = rng.int(2, 14) * 10;
        given = 'T';
        ask = rng.pick(['L', 'R'] as const);
        correct = (180 - value) / 2;
        traps.push({ value, trap: 'geo-tri-iso-pair' }, { value: 180 - value, trap: 'geo-tri-iso-split' });
        ang = { T: value, L: correct, R: correct };
      } else {
        value = rng.int(5, 16) * 5;
        given = rng.pick(['L', 'R'] as const);
        ask = 'T';
        correct = 180 - 2 * value;
        traps.push({ value, trap: 'geo-tri-iso-pair' }, { value: 180 - value, trap: 'geo-tri-iso-split' });
        ang = { T: correct, L: value, R: value };
      }
    } else {
      value = rng.int(2, 14) * 10;
      given = 'L';
      ask = d === 3 && rng.chance(0.6) ? 'ext' : 'R';
      const base = (180 - value) / 2;
      ang = { T: base, L: value, R: base };
      correct = ask === 'ext' ? 180 - base : base;
      if (ask === 'ext') traps.push({ value: 180 - value, trap: 'geo-tri-iso-pair' }, { value: base, trap: 'geo-tri-ext-interior' });
      else traps.push({ value, trap: 'geo-tri-iso-pair' }, { value: 180 - 2 * value, trap: 'geo-tri-iso-pair' });
    }
    // keep the example non-equilateral
    if (ang.T === 60 && ang.L === 60) return angleSum.generate(rng, d);
    const { choices, answer, values } = intChoices(rng, correct, traps, [correct + 10, correct - 10, correct + 20, correct + 5]);
    const pts = triPts(ang.T, ang.L, ang.R);
    const nm: Record<V3, string> = { T: nT, L: nL, R: nR };
    const fb = new FigBuilder().pt(nT, pts.T).pt(nL, pts.L).pt(nR, pts.R, ask === 'ext' ? [-0.5, -1] : undefined).poly(nT, nL, nR);
    const other = (v: V3): [string, string] => (v === 'T' ? [nL, nR] : v === 'L' ? [nT, nR] : [nT, nL]);
    fb.angle(nm[given], ...other(given), `$${value}^\\circ$`);
    let S = '';
    if (ask === 'ext') {
      S = fb.helper(add(pts.R, [1.9, 0]));
      fb.seg(nR, S).angle(nR, S, nT, '$x^\\circ$');
    } else fb.angle(nm[ask], ...other(ask), '$x^\\circ$');
    const caption = apex === 'T' ? `${nT}${nL} = ${nT}${nR}` : `${nL}${nT} = ${nL}${nR}`;
    const eqAngles = apex === 'T' ? [nL, nR] : [nT, nR];
    const base = apex === 'T' ? ang.L : ang.T;
    let expl: string;
    if (apex === 'T' && given === 'T')
      expl = `Since $${caption}$, the angles opposite those sides, at $${eqAngles[0]}$ and $${eqAngles[1]}$, are equal. They share $180 - ${value} = ${180 - value}$ degrees, so each is $${correct}^\\circ$ and $x = ${correct}$.`;
    else if (apex === 'T')
      expl = `Since $${caption}$, the angles at $${nL}$ and $${nR}$ are equal, both $${value}^\\circ$. So $x = 180 - 2(${value}) = ${correct}$.`;
    else
      expl = `Since $${caption}$, the equal angles are the ones OPPOSITE the equal sides: the angles at $${nT}$ and $${nR}$ (not the angle at $${nL}$). They share $180 - ${value} = ${180 - value}$ degrees, so each is $${base}^\\circ$.${
        ask === 'ext' ? `\n\nThe angle $x^\\circ$ forms a straight line with the $${base}^\\circ$ angle at $${nR}$, so $x = 180 - ${base} = ${correct}$.` : ` So $x = ${correct}$.`
      }`;
    return {
      params: { v: 'iso', apex, given, value, ask, values },
      q: {
        format: 'mcs',
        stem: `In the figure above, $${caption}$${ask === 'ext' ? ` and side $${nL}${nR}$ is extended` : ''}. What is the value of $x$?`,
        figure: fb.build(),
        choices,
        answer,
        explanation: `${expl}

Trap: the equal angles face the equal sides. Making the wrong pair of angles equal gives a different answer.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    let target: number;
    if (p.v === 'expr') {
      const s = solveTriX(p.exprs);
      if (!s) return 'no unique x';
      const angs = Object.values(s.ang);
      target = p.ask === 'x' ? s.x : p.ask === 'largest' ? Math.max(...angs) : Math.max(...angs) - Math.min(...angs);
    } else if (p.v === 'exterior') {
      const hits: number[] = [];
      for (let x = -60; x <= 200; x++) {
        const t = ev(p.top, x);
        const l = ev(p.left, x);
        if (t <= 0 || l <= 0) continue;
        const tri = triFromTwo({ T: t, L: l });
        if (!tri) continue;
        const extM = angleAt(tri.R, add(tri.R, [1, 0]), tri.T);
        if (near(extM, ev(p.ext, x), 1e-9)) hits.push(p.ask === 'x' ? x : t);
      }
      if (hits.length !== 1) return `${hits.length} solutions`;
      target = hits[0];
    } else {
      // Build the isosceles triangle from its equal legs and measure.
      let tri: Record<V3, Pt>;
      if (p.apex === 'T' && p.given === 'T') {
        tri = { T: [0, 0], L: dir(-90 - p.value / 2), R: dir(-90 + p.value / 2) };
      } else if (p.apex === 'T') {
        const h = bisect((t) => angleAt([0, 0], [2, 0], [1, t]) - p.value, 1e-6, 1e3);
        tri = { L: [0, 0], R: [2, 0], T: [1, h] };
      } else {
        tri = { L: [0, 0], R: [1, 0], T: dir(p.value) };
      }
      if (p.ask === 'ext') target = angleAt(tri.R, add(tri.R, sub(tri.R, tri.L)), tri.T);
      else target = angOf(tri, p.ask);
    }
    return checkMcs(q.answer, p.values, target);
  },
};

/* ================================================================== 2. Third side / perimeter (MCM) */

interface ThirdParams {
  kind: 'side' | 'perimeter' | 'iso';
  a: number;
  b: number;
  values: number[];
}

const thirdSide: Template<ThirdParams> = {
  id: 'geo.triangles.third-side',
  skill: SKILL,
  format: 'mcm',
  style: 'triangle inequality: possible third sides or perimeters',
  generate(rng, d) {
    const kind = rng.pick(d === 1 ? (['side'] as const) : d === 2 ? (['side', 'side', 'iso'] as const) : (['side', 'perimeter', 'iso'] as const));
    let a = rng.int(3, 12);
    let b = rng.int(a + 2, a + 10);
    if (kind === 'iso') {
      a = rng.int(3, 9);
      b = rng.chance(0.5) ? rng.int(2 * a, 2 * a + 6) : rng.int(a + 1, 2 * a - 1);
    }
    const lo = b - a;
    const hi = a + b;
    let items: { v: number; ok: boolean; trap?: string }[] = [];
    if (kind === 'iso') {
      const cand = [2 * a + b, a + 2 * b, 3 * a, 3 * b, 2 * (a + b)];
      items = [...new Set(cand)].map((v) => {
        const okA = v === 2 * a + b && 2 * a > b;
        const okB = v === a + 2 * b;
        const trap = v === 2 * a + b && !okA ? 'geo-tri-iso-invalid' : undefined;
        return { v, ok: okA || okB, ...(trap ? { trap } : {}) };
      });
    } else {
      const shift = kind === 'perimeter' ? a + b : 0;
      const inside: number[] = [];
      for (let c = lo + 1; c < hi; c++) inside.push(c);
      const nIn = rng.int(1, Math.min(d === 3 ? 4 : 3, inside.length));
      const pickIn = rng.sample(inside, nIn);
      if (d === 3 && kind === 'side' && rng.chance(0.5)) pickIn[0] = lo + 0.5;
      const pool: { v: number; ok: boolean; trap?: string }[] = [
        ...pickIn.map((v) => ({ v, ok: true })),
        { v: lo, ok: false, trap: 'geo-tri-ineq-endpoint' },
        { v: hi, ok: false, trap: 'geo-tri-ineq-endpoint' },
        ...(lo > 1 ? [{ v: rng.int(1, lo - 1), ok: false, trap: 'geo-tri-ineq-low' }] : []),
        { v: hi + rng.int(1, 4), ok: false, trap: 'geo-tri-ineq-high' },
      ];
      const n = d === 1 ? 5 : d === 2 ? 6 : 7;
      const wrong = rng.shuffle(pool.filter((x) => !x.ok));
      items = [...pool.filter((x) => x.ok), ...wrong].slice(0, Math.max(n, nIn + 2));
      // keep at least two wrong choices
      if (items.filter((x) => !x.ok).length < 2) items = [...pool.filter((x) => x.ok).slice(0, n - 2), ...wrong.slice(0, 2)];
      items = items.map((x) => ({ ...x, v: x.v + shift }));
    }
    const seen = new Set<number>();
    items = items.filter((x) => (seen.has(x.v) ? false : (seen.add(x.v), true))).sort((x, y) => x.v - y.v);
    const fmt = (v: number) => `$${Number.isInteger(v) ? num(v) : v.toString()}$`;
    const { choices, answer } = flaggedChoices(items.map((x) => ({ text: fmt(x.v), correct: x.ok, ...(x.trap ? { trap: x.trap } : {}) })));
    const values = items.map((x) => x.v);
    let figure: GeometryFigure | undefined;
    let stem: string;
    let explanation: string;
    if (kind === 'side') {
      const [nT, nL, nR] = rng.pick(TRI_NAMES);
      // draw with a plausible third side
      const c0 = (lo + hi) / 2;
      const Lp: Pt = [0, 0];
      const Rp: Pt = [c0, 0];
      const Tp = fromSides(Lp, Rp, b, a) ?? ([c0 / 2, a] as Pt);
      figure = new FigBuilder()
        .pt(nT, Tp)
        .pt(nL, Lp)
        .pt(nR, Rp)
        .poly(nT, nL, nR)
        .side(nT, nL, nR, `$${b}$`)
        .side(nT, nR, nL, `$${a}$`)
        .side(nL, nR, nT, '$c$')
        .build();
      stem = `In triangle $${nT}${nL}${nR}$ above, which of the following could be the value of $c$?`;
      explanation = `The third side of a triangle must be greater than the difference of the other two and less than their sum:

$$${b} - ${a} < c < ${b} + ${a}, \\quad\\text{so}\\quad ${lo} < c < ${hi}$$

${items.map((x) => `- $${fmt(x.v).replace(/\$/g, '')}$: ${x.ok ? 'between them ✓' : x.v === lo || x.v === hi ? 'equal to a bound, so the "triangle" would be flat ✗' : x.v < lo ? `too short, the sides $${a}$ and $${fmt(x.v).replace(/\$/g, '')}$ could not reach across $${b}$ ✗` : `too long, longer than $${a} + ${b}$ ✗`}`).join('\n')}`;
    } else if (kind === 'perimeter') {
      stem = `Two sides of a triangle have lengths $${a}$ and $${b}$. Which of the following could be the perimeter of the triangle?`;
      explanation = `The third side $c$ satisfies $${lo} < c < ${hi}$, so the perimeter $${a} + ${b} + c$ is strictly between $${a + b} + ${lo} = ${a + b + lo}$ and $${a + b} + ${hi} = ${a + b + hi}$.

${items.map((x) => `- $${x.v}$: ${x.ok ? `third side $${x.v - a - b}$ works ✓` : `third side would be $${x.v - a - b}$, ${x.v - a - b <= lo ? 'too short' : 'too long'} ✗`}`).join('\n')}

The bounds themselves are not possible: a third side equal to $${lo}$ or $${hi}$ gives a flat figure.`;
    } else {
      stem = `An isosceles triangle has two sides of lengths $${a}$ and $${b}$. Which of the following could be the perimeter of the triangle?`;
      const okSmall = 2 * a > b;
      explanation = `The third side must repeat one of the given lengths: the sides are either $${a}, ${a}, ${b}$ or $${a}, ${b}, ${b}$.

- $${a}, ${b}, ${b}$: valid, since $${a} + ${b} > ${b}$. Perimeter $${a + 2 * b}$.
- $${a}, ${a}, ${b}$: ${okSmall ? `valid, since $${a} + ${a} = ${2 * a} > ${b}$. Perimeter $${2 * a + b}$.` : `NOT a triangle, since $${a} + ${a} = ${2 * a}$ is not greater than $${b}$.`}

So the possible perimeters are ${okSmall ? `$${2 * a + b}$ and $${a + 2 * b}$` : `only $${a + 2 * b}$`}.${okSmall ? '' : ' Checking the triangle inequality is the step that is easy to skip.'}`;
    }
    return {
      params: { kind, a, b, values },
      q: { format: 'mcm', stem, instruction: kind === 'side' ? 'Indicate all such values.' : 'Indicate all such perimeters.', figure, choices, answer, explanation },
    };
  },
  check(q, { kind, a, b, values }) {
    if (q.format !== 'mcm') return 'format';
    // Try to actually build each triangle with coordinates.
    const builds = (x: number, y: number, z: number) => x > 0 && y > 0 && z > 0 && fromSides([0, 0], [z, 0], y, x) !== null;
    const expected = values.flatMap((v, i) => {
      const ok =
        kind === 'side' ? builds(a, b, v) : kind === 'perimeter' ? builds(a, b, v - a - b) : [a, b].some((t) => v === a + b + t && builds(a, b, t));
      return ok ? [i] : [];
    });
    return checkMcm(q.answer, expected);
  },
};

/* ================================================================== 3. Side vs opposite angle (QC) */

type SAParams =
  | { v: 'angles'; known: Partial<Record<V3, number>>; cmp: [V3, V3] }
  | { v: 'expr'; exprs: [E, E, E]; cmp: [V3, V3] }
  | { v: 'one'; known: Partial<Record<V3, number>>; cmp: [V3, V3] }
  | { v: 'coord'; quad: 1 | 2 | 3 | 4; axis: 'x' | 'y'; theta: number };

const sideAngleQC: Template<SAParams> = {
  id: 'geo.triangles.side-angle-qc',
  skill: SKILL,
  format: 'qc',
  style: 'compare two sides from the angles opposite them',
  generate(rng, d) {
    const v = rng.pick(
      d === 1 ? (['angles', 'angles', 'expr'] as const) : d === 2 ? (['angles', 'expr', 'coord'] as const) : (['expr', 'one', 'coord', 'angles'] as const),
    );
    const names = rng.pick(TRI_NAMES);
    const nm: Record<V3, string> = { T: names[0], L: names[1], R: names[2] };
    const sideName = (x: V3) => (x === 'T' ? `${nm.L}${nm.R}` : x === 'L' ? `${nm.T}${nm.R}` : `${nm.T}${nm.L}`);
    if (v === 'coord') {
      // GE-21: a line through the origin making an angle with an axis; compare the coordinates of a point on it.
      const quad = rng.pick([1, 2, 3, 4] as const);
      const axis = rng.pick(['x', 'y'] as const);
      const theta = rng.pick([30, 35, 40, 44, 46, 50, 55, 60]);
      const alpha = axis === 'x' ? theta : 90 - theta; // angle from the x-axis
      const sx = quad === 1 || quad === 4 ? 1 : -1;
      const sy = quad === 1 || quad === 2 ? 1 : -1;
      const c = sx * Math.cos((alpha * Math.PI) / 180);
      const dd = sy * Math.sin((alpha * Math.PI) / 180);
      const answer: QCChoice = c > dd ? 'A' : 'B';
      const absAns: QCChoice = Math.abs(c) > Math.abs(dd) ? 'A' : 'B';
      const R = 4.2;
      const P: Pt = [c * R, dd * R];
      const axisPt: Pt = axis === 'x' ? [sx * 4.6, 0] : [0, sy * 4.6];
      // labels on the side of the line away from the angle mark
      const u: Pt = [c, dd];
      let n: Pt = [-u[1], u[0]];
      if (n[0] * axisPt[0] + n[1] * axisPt[1] > 0) n = mul(n, -1);
      // the point is drawn with an empty name; its "(c, d)" label goes farther out than a vertex letter
      const PT = '\\phantom{P}';
      const fb = new FigBuilder().pt('O', [0, 0], [-sx, sy]).pt(PT, P).text(add(P, add(mul(n, 0.95), mul(u, 0.25))), '$(c, d)$');
      const ax = fb.helper(axisPt);
      const far = fb.helper(mul(P, 1.22));
      const back = fb.helper(mul(P, -0.25));
      fb.seg(back, far).arc(ax, 'O', PT, `$${theta}^\\circ$`);
      const fig = fb.build();
      fig.axes = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
      const axisName = `${(axis === 'x' ? sx : sy) > 0 ? 'positive' : 'negative'} $${axis}$-axis`;
      const bigger = absAns === 'A' ? '|c|' : '|d|';
      return {
        params: { v, quad, axis, theta },
        q: {
          format: 'qc',
          info: `In the $xy$-plane above, the point $(c, d)$ lies on a line through the origin $O$ that makes an angle of $${theta}^\\circ$ with the ${axisName}.`,
          figure: fig,
          quantityA: '$c$',
          quantityB: '$d$',
          answer,
          traps: qcTraps(answer, { [absAns]: 'geo-tri-coord-abs', C: 'geo-fig-looks-equal' }),
          explanation: `Drop a perpendicular from $(c, d)$ to the $${axis}$-axis. In the right triangle formed, the legs are $|c|$ (horizontal) and $|d|$ (vertical). The $${theta}^\\circ$ angle at $O$ is opposite the ${axis === 'x' ? 'vertical leg $|d|$' : 'horizontal leg $|c|$'}, and the other acute angle, $${90 - theta}^\\circ$, is opposite the ${axis === 'x' ? 'horizontal leg $|c|$' : 'vertical leg $|d|$'}.

The longer leg is opposite the larger angle, so $${bigger}$ is larger: $|c| ${absAns === 'A' ? '>' : '<'} |d|$.

The point is in quadrant ${['I', 'II', 'III', 'IV'][quad - 1]}, so $c$ is ${sx > 0 ? 'positive' : 'negative'} and $d$ is ${sy > 0 ? 'positive' : 'negative'}. ${
            sx !== sy ? `A positive number is greater than a negative one, so ${answer === 'A' ? '$c > d$' : '$d > c$'}.` : sx > 0 ? `Both are positive, so the larger absolute value is the larger number.` : `Both are negative, so the one with the LARGER absolute value is the SMALLER number: ${answer === 'A' ? '$c > d$' : '$d > c$'}.`
          } (${answer})${theta === 44 || theta === 46 ? `\n\nThe angle is close to $45^\\circ$, but not equal to it, so the coordinates are not equal in size.` : ''}`,
        },
      };
    }
    let ang: Record<V3, number>;
    let known: Partial<Record<V3, number>> = {};
    let labels: Partial<Record<V3, string>> = {};
    let cmp: [V3, V3];
    let exprs: [E, E, E] | undefined;
    let x0 = 0;
    if (v === 'angles') {
      if (rng.chance(0.3)) {
        let al = rng.int(6, 16) * 5;
        if (al === 60) al = 65;
        const other = 180 - 2 * al;
        const order = rng.shuffle(['T', 'L', 'R'] as V3[]);
        ang = { [order[0]]: other, [order[1]]: al, [order[2]]: al } as Record<V3, number>;
        known = { [order[0]]: other, [order[1]]: al };
        cmp = rng.chance(0.5) ? [order[1], order[2]] : [order[2], order[1]];
      } else {
        let a1: number;
        let a2: number;
        let a3: number;
        do {
          a1 = rng.int(5, 20) * 5;
          a2 = rng.int(5, 20) * 5;
          a3 = 180 - a1 - a2;
        } while (a3 < 20 || new Set([a1, a2, a3]).size < 3 || Math.abs(a1 - a3) < 10 && Math.abs(a2 - a3) < 10);
        const order = rng.shuffle(['T', 'L', 'R'] as V3[]);
        ang = { [order[0]]: a1, [order[1]]: a2, [order[2]]: a3 } as Record<V3, number>;
        known = { [order[0]]: a1, [order[1]]: a2 };
        // compare a side opposite the unknown angle with another side
        cmp = rng.shuffle([order[2], rng.pick([order[0], order[1]])]) as [V3, V3];
      }
      for (const [kk, vv] of Object.entries(known)) labels[kk as V3] = `$${vv}^\\circ$`;
    } else if (v === 'expr') {
      const g = triExprs(rng, d, 20, 120);
      exprs = g.exprs;
      x0 = g.x0;
      ang = { T: ev(exprs[0], x0), L: ev(exprs[1], x0), R: ev(exprs[2], x0) };
      labels = { T: lab(exprs[0]), L: lab(exprs[1]), R: lab(exprs[2]) };
      cmp = rng.sample(['T', 'L', 'R'] as V3[], 2) as [V3, V3];
    } else {
      // one angle given at T
      const obtuse = rng.chance(0.65);
      const t = obtuse ? rng.int(19, 26) * 5 : rng.pick([40, 50, 70, 80]);
      const l = (180 - t) / 2 + rng.pick([-4, 4]);
      ang = { T: t, L: l, R: 180 - t - l };
      known = { T: t };
      labels = { T: `$${t}^\\circ$` };
      cmp = obtuse ? (rng.shuffle(['T', rng.pick(['L', 'R'] as V3[])]) as [V3, V3]) : (rng.shuffle(['L', 'R'] as V3[]) as [V3, V3]);
    }
    const [s1, s2] = cmp;
    let answer: QCChoice;
    if (v === 'one' && !cmp.includes('T')) answer = 'D';
    else answer = ang[s1] > ang[s2] ? 'A' : ang[s1] < ang[s2] ? 'B' : 'C';
    const pts = triPts(ang.T, ang.L, ang.R);
    const fb = new FigBuilder().pt(nm.T, pts.T).pt(nm.L, pts.L).pt(nm.R, pts.R).poly(nm.T, nm.L, nm.R);
    const others = (x: V3): [string, string] => (x === 'T' ? [nm.L, nm.R] : x === 'L' ? [nm.T, nm.R] : [nm.T, nm.L]);
    for (const [kk, tex] of Object.entries(labels)) fb.angle(nm[kk as V3], ...others(kk as V3), tex!);
    const reversed: QCChoice | undefined = answer === 'A' ? 'B' : answer === 'B' ? 'A' : undefined;
    const traps = qcTraps(answer, { ...(reversed ? { [reversed]: 'geo-tri-side-adjacent' } : {}), ...(answer === 'D' ? { C: 'geo-fig-looks-equal' } : {}) });
    let explanation: string;
    const opp = (x: V3) => `$${sideName(x)}$ is opposite the angle at $${nm[x]}$`;
    if (v === 'angles') {
      const unknown = (['T', 'L', 'R'] as V3[]).find((x) => known[x] === undefined)!;
      const kv = Object.values(known) as number[];
      explanation = `The angle at $${nm[unknown]}$ is $180 - ${kv[0]} - ${kv[1]} = ${ang[unknown]}$ degrees.

${opp(s1)} ($${ang[s1]}^\\circ$) and ${opp(s2)} ($${ang[s2]}^\\circ$). In a triangle the larger side is opposite the larger angle${answer === 'C' ? ', and equal angles face equal sides' : ''}, so ${QC_SAY[answer]}. (${answer})`;
    } else if (v === 'expr') {
      const C = exprs!.reduce((s, e) => s + e.c, 0);
      const K = exprs!.reduce((s, e) => s + e.k, 0);
      explanation = `The angles add up to $180^\\circ$: $${exprs!.map(term).join(' + ')} = 180$, so $${linTex(C, K)} = 180$ and $x = ${x0}$. The angles at $${nm.T}$, $${nm.L}$, $${nm.R}$ are $${ang.T}^\\circ$, $${ang.L}^\\circ$, $${ang.R}^\\circ$.

${opp(s1)} and ${opp(s2)}. The larger angle faces the larger side, so ${QC_SAY[answer]}. (${answer})`;
    } else if (answer === 'D') {
      explanation = `The angles at $${nm.L}$ and $${nm.R}$ add up to $180 - ${ang.T} = ${180 - ang.T}$ degrees, but nothing says how they split. If the angle at $${nm.L}$ is the larger one, then $${sideName('L')}$ is longer; if the angle at $${nm.R}$ is larger, $${sideName('R')}$ is longer. (D)

The figure only looks almost isosceles; it is not drawn to scale.`;
    } else {
      explanation = `The angle at $${nm.T}$ is $${ang.T}^\\circ$, so the other two angles share $${180 - ang.T}^\\circ$ and EACH is smaller than $${ang.T}^\\circ$. The side opposite the largest angle, $${sideName('T')}$, is the longest side. So ${QC_SAY[answer]}. (${answer})`;
    }
    return {
      params: v === 'expr' ? { v, exprs: exprs!, cmp } : { v, known, cmp },
      q: {
        format: 'qc',
        figure: fb.build(),
        quantityA: `$${sideName(s1)}$`,
        quantityB: `$${sideName(s2)}$`,
        answer,
        traps,
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    let exp: QCChoice;
    if (p.v === 'coord') {
      // rotate the axis direction by theta toward the quadrant, then compare coordinates
      const sx = p.quad === 1 || p.quad === 4 ? 1 : -1;
      const sy = p.quad === 1 || p.quad === 2 ? 1 : -1;
      const start: Pt = p.axis === 'x' ? [sx, 0] : [0, sy];
      const cands = [1, -1].map((s) => {
        const c = Math.cos((s * p.theta * Math.PI) / 180);
        const si = Math.sin((s * p.theta * Math.PI) / 180);
        return [start[0] * c - start[1] * si, start[0] * si + start[1] * c] as Pt;
      });
      const P = cands.find((u) => Math.sign(u[0]) === sx && Math.sign(u[1]) === sy);
      if (!P) return 'no point in quadrant';
      exp = qcFromSamples([2, 5, 9].map((r) => [r * P[0], r * P[1]] as [number, number]));
    } else if (p.v === 'expr') {
      const s = solveTriX(p.exprs);
      if (!s) return 'no unique x';
      const tri = triFromTwo({ L: s.ang.L, R: s.ang.R })!;
      exp = qcFromSamples([[sideOf(tri, p.cmp[0]), sideOf(tri, p.cmp[1])]]);
    } else if (p.v === 'angles') {
      const tri = triFromTwo(p.known);
      if (!tri) return 'bad triangle';
      exp = qcFromSamples([[sideOf(tri, p.cmp[0]), sideOf(tri, p.cmp[1])]]);
    } else {
      const t = p.known.T!;
      const rnd = mulberry(t * 13 + 1);
      const samples: [number, number][] = [];
      for (let i = 0; i < 200; i++) {
        const l = (180 - t) * (0.005 + 0.99 * rnd());
        const tri = triFromTwo({ T: t, L: l });
        if (tri) samples.push([sideOf(tri, p.cmp[0]), sideOf(tri, p.cmp[1])]);
      }
      exp = qcFromSamples(samples);
    }
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

/* ================================================================== 4. Isosceles exterior angle, triangle inequality (QC) */

type IneqForm = 'sum-vs-2z' | 'xy-vs-z' | 'z-vs-xy' | 'diff-vs-z' | 'sum-vs-2xy' | 'sum-vs-3z';
type IsoQCParams = { v: 'iso-ext'; apexAngle: number; N: number } | { v: 'ineq'; form: IneqForm };

const INEQ: Record<IneqForm, { info: string; A: string; B: string; answer: QCChoice; why: string }> = {
  'sum-vs-2z': {
    info: 'A triangle has sides of lengths $x$, $y$, and $z$.',
    A: '$x + y + z$',
    B: '$2z$',
    answer: 'A',
    why: 'Any side is shorter than the sum of the other two: $x + y > z$. Adding $z$ to both sides gives $x + y + z > 2z$. (A)',
  },
  'xy-vs-z': {
    info: 'A triangle has sides of lengths $x$, $y$, and $z$.',
    A: '$x + y$',
    B: '$z$',
    answer: 'A',
    why: 'In any triangle each side is shorter than the sum of the other two, so $x + y > z$ no matter which side is longest. (A)',
  },
  'z-vs-xy': {
    info: 'A triangle has sides of lengths $x$, $y$, and $z$.',
    A: '$z$',
    B: '$x + y$',
    answer: 'B',
    why: 'Each side is shorter than the sum of the other two, so $z < x + y$. (B)',
  },
  'diff-vs-z': {
    info: 'A triangle has sides of lengths $x$, $y$, and $z$, where $x > y$.',
    A: '$x - y$',
    B: '$z$',
    answer: 'B',
    why: 'Since $x < y + z$, subtracting $y$ gives $x - y < z$. The difference of two sides is always less than the third side. (B)',
  },
  'sum-vs-2xy': {
    info: 'A triangle has sides of lengths $x$, $y$, and $z$.',
    A: '$x + y + z$',
    B: '$2x + 2y$',
    answer: 'B',
    why: 'Subtract $x + y$ from both quantities: compare $z$ with $x + y$. Since $z < x + y$, Quantity B is greater. (B)',
  },
  'sum-vs-3z': {
    info: 'A triangle has sides of lengths $x$, $y$, and $z$.',
    A: '$x + y + z$',
    B: '$3z$',
    answer: 'D',
    why: 'Subtract $z$: compare $x + y$ with $2z$. With sides $3, 3, 1$ ($z = 1$), $x + y = 6 > 2$; with sides $2, 2, 3$ ($z = 3$), $x + y = 4 < 6$. (D)',
  },
};

const isoIneqQC: Template<IsoQCParams> = {
  id: 'geo.triangles.iso-inequality-qc',
  skill: SKILL,
  format: 'qc',
  style: 'isosceles exterior angle or triangle inequality comparison',
  generate(rng, d) {
    const v = rng.chance(d === 1 ? 0.6 : 0.5) ? 'iso-ext' : 'ineq';
    if (v === 'ineq') {
      const forms: IneqForm[] = d === 1 ? ['xy-vs-z', 'z-vs-xy', 'sum-vs-2z'] : d === 2 ? ['sum-vs-2z', 'diff-vs-z', 'sum-vs-2xy', 'z-vs-xy'] : ['sum-vs-2z', 'diff-vs-z', 'sum-vs-2xy', 'sum-vs-3z'];
      const form = rng.pick(forms);
      const f = INEQ[form];
      const fig = new FigBuilder();
      const p1 = fig.helper([0, 0]);
      const p2 = fig.helper([4.4, 0]);
      const p3 = fig.helper([1.5, 2.6]);
      fig.poly(p1, p2, p3).side(p1, p2, p3, '$z$').side(p1, p3, p2, '$x$').side(p2, p3, p1, '$y$');
      const fl = fig.build();
      const trapsMap: Partial<Record<QCChoice, string>> =
        f.answer === 'D' ? { B: 'geo-tri-ineq-assumed-longest' } : { D: 'geo-tri-ineq-forgot', ...(form === 'sum-vs-2z' || form === 'diff-vs-z' ? { C: 'geo-tri-ineq-endpoint' } : {}) };
      return {
        params: { v, form },
        q: { format: 'qc', info: f.info, figure: fl, quantityA: f.A, quantityB: f.B, answer: f.answer, traps: qcTraps(f.answer, trapsMap), explanation: f.why },
      };
    }
    // GE-23: AB = BC, apex angle at B, exterior angle x at A (CA extended beyond A).
    const names = rng.pick(TRI_NAMES);
    const [nA, nB, nC] = [names[0], names[1], names[2]];
    let apexAngle = rng.int(2, 14) * 10;
    if (apexAngle === 60) apexAngle = 40;
    const base = (180 - apexAngle) / 2;
    const x = 180 - base;
    const offsets = [-10, -10, 0, 0, 10, 10];
    if (2 * base !== x) offsets.push(2 * base - x);
    const N = x + rng.pick(offsets);
    const answer: QCChoice = x > N ? 'A' : x < N ? 'B' : 'C';
    const wrongPair = 180 - apexAngle; // thinking the angle at A equals the apex angle
    const interior = base;
    const tw = (w: number): QCChoice => (w > N ? 'A' : w < N ? 'B' : 'C');
    // Layout: B apex at the bottom-left, A top, C bottom-right; AB = BC.
    const B: Pt = [0, 0];
    const apexDraw = Math.min(110, Math.max(45, apexAngle));
    const C: Pt = [4, 0];
    const A: Pt = mul(dir(apexDraw), 4);
    const offA = add(unit(sub(A, B)), unit(sub(A, C)));
    const fb = new FigBuilder().pt(nA, A, offA).pt(nB, B).pt(nC, C).poly(nA, nB, nC);
    const ext = fb.helper(add(A, mul(sub(A, C), 0.45)));
    fb.seg(nA, ext);
    fb.angle(nB, nA, nC, `$${apexAngle}^\\circ$`).angle(nA, ext, nB, '$x^\\circ$');
    fb.text([2, -0.9], `$${nA}${nB} = ${nB}${nC}$`);
    return {
      params: { v: 'iso-ext', apexAngle, N },
      q: {
        format: 'qc',
        figure: fb.build(),
        quantityA: '$x$',
        quantityB: `$${N}$`,
        answer,
        traps: qcTraps(answer, { [tw(wrongPair)]: 'geo-tri-iso-pair', [tw(interior)]: 'geo-tri-ext-interior' }),
        explanation: `Since $${nA}${nB} = ${nB}${nC}$, the angles opposite these sides, at $${nC}$ and $${nA}$, are equal. They share $180 - ${apexAngle} = ${180 - apexAngle}$ degrees, so each is $${base}^\\circ$.

The angle $x^\\circ$ forms a straight line with the $${base}^\\circ$ angle at $${nA}$, so $x = 180 - ${base} = ${x}$.

Compare with $${N}$: ${QC_SAY[answer]}. (${answer})`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    let exp: QCChoice;
    if (p.v === 'iso-ext') {
      // equal legs BA = BC at the apex B, measure the exterior angle at A
      const B: Pt = [0, 0];
      const C: Pt = [1, 0];
      const A = dir(p.apexAngle);
      const beyond = add(A, sub(A, C));
      exp = qcFromSamples([[angleAt(A, beyond, B), p.N]]);
    } else {
      const rnd = mulberry(p.form.length * 31 + 7);
      const samples: [number, number][] = [];
      for (let i = 0; i < 2000 && samples.length < 600; i++) {
        const P: Pt[] = [0, 1, 2].map(() => [rnd() * 10, rnd() * 10] as Pt);
        if (shoelace(P) < 0.5) continue;
        const z = dist(P[0], P[1]);
        const x = dist(P[1], P[2]);
        const y = dist(P[2], P[0]);
        if (p.form === 'diff-vs-z' && !(x > y)) continue;
        const [A, B] =
          p.form === 'sum-vs-2z' ? [x + y + z, 2 * z] : p.form === 'xy-vs-z' ? [x + y, z] : p.form === 'z-vs-xy' ? [z, x + y] : p.form === 'diff-vs-z' ? [x - y, z] : p.form === 'sum-vs-2xy' ? [x + y + z, 2 * x + 2 * y] : [x + y + z, 3 * z];
        samples.push([A, B]);
      }
      exp = qcFromSamples(samples);
    }
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

/* ================================================================== 5. Area with base and height (NE) */

type AreaParams =
  | { v: 'obtuse'; p: number; h: number; b: number }
  | { v: 'hyp-altitude'; a: number; b: number }
  | { v: 'shared'; m: number; n: number; h: number; ask: 'ACD' | 'ABD' };

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
  [12, 16, 20],
];

const triangleArea: Template<AreaParams> = {
  id: 'geo.triangles.area-ne',
  skill: SKILL,
  format: 'ne',
  style: 'triangle area with an outside height, shared heights, altitude to the hypotenuse',
  generate(rng, d) {
    const v = rng.pick(d === 1 ? (['obtuse'] as const) : d === 2 ? (['obtuse', 'shared'] as const) : (['hyp-altitude', 'shared', 'obtuse'] as const));
    const [nA, nB, nC] = rng.pick(TRI_NAMES);
    if (v === 'obtuse') {
      const t = rng.pick(TRIPLES.slice(0, 4));
      const [p, h, s] = rng.chance(0.5) ? t : [t[1], t[0], t[2]];
      const b = rng.int(4, 14);
      const area = new Frac(b * h, 2);
      const withSlant = d >= 2;
      const D = 'D';
      // B at origin, C to the right, D to the left of B, A above D
      const Bp: Pt = [0, 0];
      const Cp: Pt = [b, 0];
      const Dp: Pt = [-p, 0];
      const Ap: Pt = [-p, h];
      const fb = new FigBuilder().pt(nA, Ap).pt(nB, Bp, [0.3, -1]).pt(nC, Cp).pt(D, Dp).poly(nA, nB, nC);
      fb.seg(D, nB, undefined, true).seg(D, nA, `$${h}$`, true).right(nA, D, nB);
      fb.side(nB, nC, nA, `$${b}$`);
      if (withSlant) fb.side(nA, nB, nC, `$${s}$`, 12);
      const traps = [
        ...(withSlant ? [{ value: new Frac(b * s, 2), trap: 'geo-tri-slant-height' }] : []),
        { value: new Frac((b + p) * h, 2), trap: 'geo-tri-extended-base' },
        { value: new Frac(b * h), trap: 'geo-tri-no-half' },
      ].filter((x) => !x.value.eq(area));
      return {
        params: { v, p, h, b },
        q: {
          format: 'ne',
          stem: `In the figure above, $${nA}${D}$ is perpendicular to line $${D}${nC}$${withSlant ? ` and $${nA}${nB} = ${s}$` : ''}. What is the area of triangle $${nA}${nB}${nC}$?`,
          answer: area,
          traps,
          figure: fb.build(),
          explanation: `Use $${nB}${nC} = ${b}$ as the base. The height to that base is the perpendicular distance from $${nA}$ to line $${nB}${nC}$, which is $${nA}${D} = ${h}$, even though $${D}$ lies outside the triangle.

Area $= \\frac{1}{2}(${b})(${h}) = ${dec(area)}$.

${withSlant ? `$${nA}${nB} = ${s}$ is a slanted side, not a height. ` : ''}The base is only $${nB}${nC}$, not $${D}${nC}$.`,
        },
      };
    }
    if (v === 'hyp-altitude') {
      const [a, b] = rng.pick([
        [3, 4],
        [6, 8],
        [9, 12],
        [12, 16],
        [15, 20],
        [7, 24],
      ] as [number, number][]);
      const [x, y] = rng.chance(0.5) ? [a, b] : [b, a];
      const c = Math.round(Math.hypot(x, y));
      const h = new Frac(x * y, c);
      // right angle at C (bottom-left), legs along the axes
      const Cp: Pt = [0, 0];
      const Ap: Pt = [0, x];
      const Bp: Pt = [y, 0];
      const Dp = foot(Cp, Ap, Bp);
      const fb = new FigBuilder().pt(nA, Ap).pt(nB, Bp).pt(nC, Cp).pt('D', Dp, [1, 1]).poly(nA, nB, nC);
      fb.seg(nC, 'D', undefined, true).right(nA, nC, nB).right(nC, 'D', nB);
      fb.side(nA, nC, nB, `$${x}$`).side(nC, nB, nA, `$${y}$`);
      return {
        params: { v, a: x, b: y },
        q: {
          format: 'ne',
          stem: `In right triangle $${nA}${nB}${nC}$ above, $${nC}D$ is perpendicular to $${nA}${nB}$. What is the length of $${nC}D$?`,
          answer: h,
          traps: [
            { value: new Frac(x * y, 2), trap: 'geo-ang-wrong-unknown' },
            { value: new Frac(c, 2), trap: 'geo-tri-hyp-midpoint' },
          ].filter((t) => !t.value.eq(h)),
          figure: fb.build(),
          explanation: `Compute the area two ways. With the legs as base and height: $\\frac{1}{2}(${x})(${y}) = ${dec(new Frac(x * y, 2))}$.

The hypotenuse is $\\sqrt{${x}^2 + ${y}^2} = ${c}$, and $${nC}D$ is the height to it: $\\frac{1}{2}(${c})(${nC}D) = ${dec(new Frac(x * y, 2))}$.

So $${nC}D = \\frac{${x} \\cdot ${y}}{${c}} = ${dec(h)}$. (The area, $${dec(new Frac(x * y, 2))}$, is not the answer.)`,
        },
      };
    }
    // shared height: B, C, D on a line, A above
    let m: number;
    let n: number;
    let h: number;
    do {
      m = rng.int(3, 10);
      n = rng.int(3, 12);
      h = rng.int(3, 10);
    } while (m === n || (m * h) % 2 !== 0);
    const S = (m * h) / 2;
    const ask: 'ACD' | 'ABD' = d === 3 && rng.chance(0.5) ? 'ABD' : 'ACD';
    const ans = ask === 'ACD' ? new Frac(n * h, 2) : new Frac((m + n) * h, 2);
    const Dn = 'D';
    const Ap: Pt = [m * 0.35, Math.max(h, (m + n) * 0.35)];
    const fb = new FigBuilder().pt(nA, Ap).pt(nB, [0, 0]).pt(nC, [m, 0]).pt(Dn, [m + n, 0]).poly(nA, nB, Dn);
    fb.seg(nA, nC).side(nB, nC, nA, `$${m}$`).side(nC, Dn, nA, `$${n}$`);
    const okTraps = [
      { value: new Frac(S), trap: 'geo-tri-same-area' },
      ...(ask === 'ACD' ? [{ value: new Frac(S * m, n), trap: 'geo-tri-ratio-flip' }] : [{ value: new Frac(n * h, 2), trap: 'geo-ang-wrong-unknown' }]),
    ].filter((t) => !t.value.eq(ans) && t.value.isTerminating());
    return {
      params: { v: 'shared', m, n, h, ask },
      q: {
        format: 'ne',
        stem: `In the figure above, points $${nB}$, $${nC}$, and $${Dn}$ lie on a line, and the area of triangle $${nA}${nB}${nC}$ is $${num(S)}$. What is the area of triangle $${ask === 'ACD' ? `${nA}${nC}${Dn}` : `${nA}${nB}${Dn}`}$?`,
        answer: ans,
        traps: okTraps,
        figure: fb.build(),
        explanation: `Triangles $${nA}${nB}${nC}$ and $${nA}${nC}${Dn}$ have the same height $h$: the distance from $${nA}$ to line $${nB}${Dn}$. From $\\frac{1}{2}(${m})h = ${num(S)}$, $h = ${h}$.

${ask === 'ACD' ? `Area of $${nA}${nC}${Dn}$ $= \\frac{1}{2}(${n})(${h}) = ${dec(ans)}$. Equivalently, with equal heights the areas are in the ratio of the bases, $${n} : ${m}$.` : `Area of $${nA}${nB}${Dn}$ $= \\frac{1}{2}(${m} + ${n})(${h}) = ${dec(ans)}$.`}

The two areas are not equal: the bases differ.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    let target: number;
    if (p.v === 'obtuse') {
      target = shoelace([[-p.p, p.h], [0, 0], [p.b, 0]]);
    } else if (p.v === 'hyp-altitude') {
      const A: Pt = [0, p.a];
      const B: Pt = [p.b, 0];
      target = dist([0, 0], foot([0, 0], A, B));
    } else {
      // find the height from the given area by bisection on A's height, then shoelace
      const S = (p.m * p.h) / 2;
      const ax = 1.3;
      const hh = bisect((t) => shoelace([[ax, t], [0, 0], [p.m, 0]]) - S, 0, 1000);
      const A: Pt = [ax, hh];
      target = p.ask === 'ACD' ? shoelace([A, [p.m, 0], [p.m + p.n, 0]]) : shoelace([A, [0, 0], [p.m + p.n, 0]]);
    }
    return Math.abs(q.answer.toNumber() - target) < 1e-7 ? null : `expected ${target}`;
  },
};

/* ================================================================== 6. Third vertex for a required area (MCM, coordinate plane) */

interface VertexParams {
  xa: number;
  xb: number;
  K: number;
  side: 'above' | 'below';
  pts: Pt[];
}

const thirdVertex: Template<VertexParams> = {
  id: 'geo.triangles.third-vertex',
  skill: SKILL,
  format: 'mcm',
  style: 'coordinates of a third vertex that give a triangle a required area',
  generate(rng, d) {
    let xa: number;
    let base: number;
    let h: number;
    do {
      xa = rng.int(1, 3);
      base = rng.int(3, 7);
      h = rng.int(2, d === 1 ? 4 : 6);
    } while ((base * h) % 2 !== 0);
    const xb = xa + base;
    const K = (base * h) / 2;
    const side: 'above' | 'below' = d === 3 && rng.chance(0.4) ? 'below' : 'above';
    const s = side === 'above' ? 1 : -1;
    const nCorrect = rng.pick(d === 1 ? [1, 2] : [1, 2, 2, 3]);
    const xs = rng.sample([-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((x) => x <= xb + 3 && x >= xa - 3), 5);
    const correct: Pt[] = xs.slice(0, nCorrect).map((x) => [x, s * h]);
    const wrongPool: { p: Pt; trap?: string }[] = [
      { p: [xs[nCorrect], -s * h], trap: 'geo-tri-wrong-side' },
      { p: [xs[nCorrect + 1] ?? xa, s * (h + 1)] },
      { p: [xs[nCorrect + 2] ?? xb, s * (h - 1)] },
      ...(h % 2 === 0 ? [{ p: [rng.pick([xa, xb, (xa + xb) / 2].filter(Number.isInteger)), (s * h) / 2] as Pt, trap: 'geo-tri-no-half' }] : []),
      { p: [xs[nCorrect + 3] ?? xa + 1, s * 2 * h], trap: 'geo-tri-height-double' },
    ];
    const wrong = rng.shuffle(wrongPool).slice(0, 5 - nCorrect);
    const items: { p: Pt; ok: boolean; trap?: string }[] = [...correct.map((p) => ({ p, ok: true })), ...wrong.map((w) => ({ p: w.p, ok: false, trap: w.trap }))];
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const uniq = items.filter((it, i) => items.findIndex((o) => key(o.p) === key(it.p)) === i);
    if (uniq.length < 5 || uniq.some((it) => !it.ok && Math.abs(it.p[1]) === h && Math.sign(it.p[1]) === s)) return thirdVertex.generate(rng, d);
    uniq.sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);
    const { choices, answer } = flaggedChoices(
      uniq.map((it) => ({ text: `$(${num(it.p[0])}, ${num(it.p[1])})$`, correct: it.ok, ...(it.trap ? { trap: it.trap } : {}) })),
    );
    const fb = new FigBuilder().pt('A', [xa, 0], [0, 1]).pt('B', [xb, 0], [0, 1]);
    const fig = fb.build();
    const yr = side === 'above' ? { yMin: -0.6, yMax: 7 } : { yMin: -7, yMax: 0.6 };
    fig.axes = { xMin: -0.6, xMax: Math.max(9, xb + 1), ...yr, step: 1, labelTicks: true };
    fig.hideLabels = [];
    return {
      params: { xa, xb, K, side, pts: uniq.map((it) => it.p) },
      q: {
        format: 'mcm',
        stem: `In the $xy$-plane above, points $A$ and $B$ lie on the $x$-axis. Point $C$ (not shown) lies ${side} the $x$-axis, and triangle $ABC$ has an area of $${num(K)}$. Which of the following points could be $C$?`,
        instruction: 'Indicate all such points.',
        figure: fig,
        choices,
        answer,
        explanation: `Take $AB$ as the base: $AB = ${xb} - ${paren(xa)} = ${base}$. The height is the vertical distance from $C$ to the $x$-axis, so $\\frac{1}{2}(${base})(\\text{height}) = ${num(K)}$ gives a height of $${h}$.

So $C$ can be ANY point with $y$-coordinate $${s * h}$ (${side} the axis); its $x$-coordinate does not matter, because moving $C$ parallel to the base keeps the same height.

${uniq.map((it) => `- $(${num(it.p[0])}, ${num(it.p[1])})$: ${it.ok ? 'height ' + h + ' ✓' : Math.sign(it.p[1]) !== s ? `wrong side of the $x$-axis ✗` : `height $${Math.abs(it.p[1])}$, area $${dec(new Frac(base * Math.abs(it.p[1]), 2))}$ ✗`}`).join('\n')}`,
      },
    };
  },
  check(q, { xa, xb, K, side, pts }) {
    if (q.format !== 'mcm') return 'format';
    const expected = pts.flatMap((p, i) => (near(shoelace([[xa, 0], [xb, 0], p]), K, 1e-12) && (side === 'above' ? p[1] > 0 : p[1] < 0) ? [i] : []));
    return checkMcm(q.answer, expected);
  },
};

const paren = (x: number) => (x < 0 ? `(${x})` : `${x}`);

export const triangleTemplates = [angleSum, thirdSide, sideAngleQC, isoIneqQC, triangleArea, thirdVertex];
