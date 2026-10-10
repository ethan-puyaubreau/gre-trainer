import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Rng } from '../../../engine/rng';
import type { GeometryFigure, QCChoice, Template } from '../../../engine/types';
import {
  RAD,
  add,
  angleAt,
  bisect,
  dir,
  figPoints,
  mul,
  near,
  pxPerUnit,
  rot,
  sub,
  wedgeLabel,
  type Pt,
} from './fig';
import { angleLabel, checkMcm, checkMcs, exprTex, intChoices, linTex, qcTraps, QC_SAY } from './util';

const SKILL = 'geo.lines-angles';

/* ================================================================== transversal figure (shared) */

/** Angle positions at an intersection: upper-left, upper-right, lower-right, lower-left. */
export type Pos = 'UL' | 'UR' | 'LR' | 'LL';
export const POSITIONS: Pos[] = ['UL', 'UR', 'LR', 'LL'];
/** P = intersection with the top line ℓ, Q = with the bottom line m. */
export type At = 'P' | 'Q';
/** With the transversal at phi degrees from the positive x-axis, UR and LL measure phi. */
export const isPhiType = (p: Pos) => p === 'UR' || p === 'LL';
export const measureAt = (p: Pos, phi: number) => (isPhiType(p) ? phi : 180 - phi);

/** Drawn transversal angle: keep the acute angle between 50° and 72° so labels have room. */
export const drawPhi = (phi: number) => (phi <= 90 ? Math.min(72, Math.max(50, phi)) : 180 - Math.min(72, Math.max(50, 180 - phi)));

interface TransversalGeom {
  P: Pt;
  Q: Pt;
  /** Rays (V, a, b) bounding the angle at a position. */
  rays(at: At, pos: Pos): [Pt, Pt, Pt];
}

/** Lines ℓ (y = 3, optionally tilted by `tilt` degrees about P) and m (y = 0) cut by a transversal at `phi`. */
export function transversalGeom(phi: number, tilt = 0): TransversalGeom {
  const H = 3;
  const u = dir(phi);
  const Q: Pt = [0, 0];
  const P: Pt = [H / Math.tan(phi * RAD), H];
  const rays = (at: At, pos: Pos): [Pt, Pt, Pt] => {
    const V = at === 'P' ? P : Q;
    const along = at === 'P' ? dir(tilt) : ([1, 0] as Pt);
    const right = add(V, along);
    const left = sub(V, along);
    const up = add(V, u);
    const down = sub(V, u);
    switch (pos) {
      case 'UR':
        return [V, right, up];
      case 'UL':
        return [V, up, left];
      case 'LL':
        return [V, left, down];
      case 'LR':
        return [V, down, right];
    }
  };
  return { P, Q, rays };
}

/** Measured angle (coordinates + atan2) at a position: used by check() instead of the theorems. */
export function measured(phi: number, at: At, pos: Pos, tilt = 0): number {
  const [V, a, b] = transversalGeom(phi, tilt).rays(at, pos);
  return angleAt(V, a, b);
}

/** Figure: two lines and a transversal, with free labels inside the requested angles. */
export function transversalFigure(
  phi: number,
  marks: { at: At; pos: Pos; tex: string }[],
  opts: { tilt?: number; lineNames?: [string, string]; transversalName?: string } = {},
): GeometryFigure {
  const tilt = opts.tilt ?? 0;
  const g = transversalGeom(phi, tilt);
  const { P, Q } = g;
  const u = dir(phi);
  const xL = Math.min(P[0], Q[0]) - 2.7;
  const xR = Math.max(P[0], Q[0]) + 2.7;
  const tl = dir(tilt);
  const L1 = add(P, mul(tl, (xL - P[0]) / tl[0]));
  const L2 = add(P, mul(tl, (xR - P[0]) / tl[0]));
  const points: Record<string, Pt> = {
    P,
    Q,
    L1,
    L2,
    M1: [xL, 0],
    M2: [xR, 0],
    T1: sub(Q, mul(u, 1.6)),
    T2: add(P, mul(u, 1.6)),
  };
  const [n1, n2] = opts.lineNames ?? ['\\ell', 'm'];
  const labels: { at: Pt; text: string }[] = [
    { at: [L2[0] + 0.45, L2[1]], text: `$${n1}$` },
    { at: [xR + 0.45, 0], text: `$${n2}$` },
  ];
  if (opts.transversalName) labels.push({ at: add(points.T2, mul(u, 0.4)), text: `$${opts.transversalName}$` });
  const k = pxPerUnit([...Object.values(points), ...labels.map((l) => l.at)]);
  for (const m of marks) {
    const [V, a, b] = g.rays(m.at, m.pos);
    labels.push({ at: wedgeLabel(V, a, b, m.tex, k, { minPx: 16 }), text: m.tex });
  }
  return {
    kind: 'geometry',
    points,
    hideLabels: Object.keys(points),
    segments: [
      { from: 'L1', to: 'L2' },
      { from: 'M1', to: 'M2' },
      { from: 'T1', to: 'T2' },
    ],
    labels,
  };
}

/** Name of the relationship between two angle positions (null when it has no standard name). */
export function relName(a: { at: At; pos: Pos }, b: { at: At; pos: Pos }): string | null {
  const same = isPhiType(a.pos) === isPhiType(b.pos);
  if (a.at === b.at) return same ? 'vertical angles' : 'adjacent angles that form a straight line';
  const [top, bot] = a.at === 'P' ? [a.pos, b.pos] : [b.pos, a.pos];
  const key = `${top}-${bot}`;
  const names: Record<string, string> = {
    'UR-UR': 'corresponding angles',
    'LL-LL': 'corresponding angles',
    'UL-UL': 'corresponding angles',
    'LR-LR': 'corresponding angles',
    'LL-UR': 'alternate interior angles',
    'LR-UL': 'alternate interior angles',
    'UR-LL': 'alternate exterior angles',
    'UL-LR': 'alternate exterior angles',
    'LL-UL': 'same-side interior angles',
    'LR-UR': 'same-side interior angles',
    'UL-LL': 'same-side exterior angles',
    'UR-LR': 'same-side exterior angles',
  };
  return names[key] ?? null;
}

/* ================================================================== 1. Parallel lines, algebraic angles (MCS) */

interface ParLabel {
  at: At;
  pos: Pos;
  c: number;
  k: number;
}
interface ParAlgParams {
  labels: [ParLabel, ParLabel];
  ask: 'x' | 'angle' | 'y';
  askLabel: 0 | 1;
  yAt?: { at: At; pos: Pos };
  values: number[];
}

/** "3(25) + 10" */
const evalTex = (c: number, k: number, x: number) => `${c === 1 ? '' : c}(${x})${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`}`;
const labTex = (l: { c: number; k: number }) => angleLabel(l.c, l.k).replace(/\$/g, '');
const sumTerm = (l: { c: number; k: number }) => (l.c === 0 || l.k === 0 ? exprTex(l.c, l.k) : `(${exprTex(l.c, l.k)})`);

const parallelAlgebra: Template<ParAlgParams> = {
  id: 'geo.lines-angles.parallel-algebra',
  skill: SKILL,
  format: 'mcs',
  style: 'parallel lines and a transversal, angles given as expressions in x',
  generate(rng, d) {
    for (;;) {
      const theta = rng.int(8, 16) * 5;
      const phi = rng.chance(0.5) ? theta : 180 - theta;
      const pos1 = rng.pick(POSITIONS);
      const pos2 = rng.pick(POSITIONS);
      const m1 = measureAt(pos1, phi);
      const m2 = measureAt(pos2, phi);
      const x0 = d === 1 ? rng.int(2, 7) * 5 : rng.int(10, 40);
      const c1 = d === 1 ? 0 : rng.int(1, 4);
      const k1 = d === 1 ? m1 : m1 - c1 * x0;
      const c2 = rng.int(2, d === 1 ? 4 : 6);
      const k2 = m2 - c2 * x0;
      if (c1 === c2 || Math.abs(k1) > 90 || Math.abs(k2) > 90 || (d === 1 && k2 % 5 !== 0)) continue;
      if (d > 1 && k1 === 0 && k2 === 0) continue;
      const labels: [ParLabel, ParLabel] = [
        { at: 'P', pos: pos1, c: c1, k: k1 },
        { at: 'Q', pos: pos2, c: c2, k: k2 },
      ];
      const same = isPhiType(pos1) === isPhiType(pos2);
      // The classic slip: equal <-> supplementary.
      const xw = same ? (180 - k1 - k2) / (c1 + c2) : c1 !== c2 ? (k2 - k1) / (c1 - c2) : NaN;
      const wrongTrap = same ? 'geo-par-supp-not-equal' : 'geo-par-equal-not-supp';
      const xwOk = Number.isInteger(xw) && xw > 0 && xw !== x0;

      const ask: ParAlgParams['ask'] = d === 1 ? 'x' : d === 2 ? (rng.chance(0.5) ? 'x' : 'angle') : rng.chance(0.75) ? 'y' : 'angle';
      const askLabel: 0 | 1 = ask === 'angle' && c1 > 0 && rng.chance(0.5) ? 0 : 1;
      let yAt: { at: At; pos: Pos } | undefined;
      if (ask === 'y') {
        const free = (['P', 'Q'] as At[]).flatMap((at) => POSITIONS.filter((p) => !(at === 'P' && p === pos1) && !(at === 'Q' && p === pos2)).map((pos) => ({ at, pos })));
        yAt = rng.pick(free);
      }

      let correct: number;
      const traps: { value: number; trap: string }[] = [];
      let fillers: number[];
      if (ask === 'x') {
        correct = x0;
        if (xwOk) traps.push({ value: xw, trap: wrongTrap });
        traps.push({ value: m2, trap: 'geo-ang-wrong-unknown' });
        fillers = [x0 + 5, x0 - 5, x0 + 10, x0 - 10, 2 * x0];
      } else if (ask === 'angle') {
        const L = labels[askLabel];
        correct = L.c * x0 + L.k;
        traps.push({ value: x0, trap: 'geo-ang-wrong-unknown' });
        if (xwOk) {
          const w = L.c * xw + L.k;
          if (w > 0 && w < 180) traps.push({ value: w, trap: wrongTrap });
        }
        fillers = [180 - correct, correct + 10, correct - 10, correct + 20, correct - 20];
      } else {
        const y = measureAt(yAt!.pos, phi);
        correct = y;
        traps.push({ value: 180 - y, trap: isPhiType(yAt!.pos) === isPhiType(pos2) ? 'geo-par-supp-not-equal' : 'geo-par-equal-not-supp' });
        traps.push({ value: x0, trap: 'geo-ang-wrong-unknown' });
        fillers = [y + 10, y - 10, y + 20, y - 20];
      }
      if (traps.some((t) => t.value === correct)) continue;
      const { choices, answer, values } = intChoices(rng, correct, traps, fillers);

      const marks = [
        { at: 'P' as At, pos: pos1, tex: angleLabel(c1, k1) },
        { at: 'Q' as At, pos: pos2, tex: angleLabel(c2, k2) },
        ...(yAt ? [{ ...yAt, tex: '$y^\\circ$' }] : []),
      ];
      const figure = transversalFigure(drawPhi(phi), marks);

      // Explanation
      const L1 = `$${labTex(labels[0])}$`;
      const L2 = `$${labTex(labels[1])}$`;
      const name = relName(labels[0], labels[1]);
      const relSentence = same
        ? `the ${L1} angle and the ${L2} angle are ${name}, so they are equal.`
        : name
          ? `the ${L1} angle and the ${L2} angle are ${name}, so they add up to $180^\\circ$.`
          : `the angle on line $m$ in the same position as the ${L1} angle (its corresponding angle) forms a straight line with the ${L2} angle, so the two labeled angles add up to $180^\\circ$.`;
      const e1 = exprTex(c1, k1);
      const e2 = exprTex(c2, k2);
      let solve: string;
      if (same) {
        const cc = c2 - c1;
        solve = `$${e2} = ${e1}$, so $${linTex(cc, 0)} = ${num(k1 - k2)}$`;
      } else {
        solve = `$${sumTerm(labels[0])} + ${sumTerm(labels[1])} = 180$, so $${linTex(c1 + c2, 0)} = ${num(180 - k1 - k2)}$`;
      }
      const lines = [`Because $\\ell \\parallel m$, ${relSentence}`, `So ${solve}, which gives $x = ${x0}$.`];
      if (ask === 'angle') {
        const L = labels[askLabel];
        lines.push(`The question asks for the angle, not $x$: $${evalTex(L.c, L.k, x0)} = ${correct}$.`);
      }
      if (ask === 'y') {
        const sameY = isPhiType(yAt!.pos) === isPhiType(pos2);
        const nm = relName(yAt!, labels[1]);
        lines.push(
          sameY
            ? `The ${L2} angle measures $${num(m2)}^\\circ$, and the $y^\\circ$ angle is in a matching position (${nm ?? 'equal angles'}), so $y = ${m2}$.`
            : `The ${L2} angle measures $${num(m2)}^\\circ$, and the $y^\\circ$ angle is supplementary to it${nm ? ` (${nm})` : ''}, so $y = 180 - ${m2} = ${correct}$.`,
        );
      }
      lines.push(
        xwOk
          ? same
            ? `Trap: making the two angles add up to $180^\\circ$ gives $x = ${xw}$, but angles in matching positions are equal.`
            : `Trap: setting the two expressions equal gives $x = ${xw}$, but these angles are not in matching positions, so they are supplementary.`
          : `Check: with $x = ${x0}$ the labeled angles measure $${m1}^\\circ$ and $${m2}^\\circ$, ${same ? 'equal as they should be' : `and $${m1} + ${m2} = 180$`}.`,
      );
      const stem =
        ask === 'x'
          ? 'In the figure above, lines $\\ell$ and $m$ are parallel. What is the value of $x$?'
          : ask === 'angle'
            ? `In the figure above, lines $\\ell$ and $m$ are parallel. What is the measure, in degrees, of the angle labeled $${labTex(labels[askLabel])}$?`
            : 'In the figure above, lines $\\ell$ and $m$ are parallel. What is the value of $y$?';
      return {
        params: { labels, ask, askLabel, yAt, values },
        q: { format: 'mcs', stem, figure, choices, answer, explanation: lines.join('\n\n') },
      };
    }
  },
  check(q, { labels, ask, askLabel, yAt, values }) {
    if (q.format !== 'mcs') return 'format';
    // Search the transversal angle: for each phi, measure the two labeled angles on the drawing.
    const sols: { phi: number; x: number }[] = [];
    for (let phi = 1; phi < 180; phi++) {
      const g1 = measured(phi, labels[0].at, labels[0].pos);
      const g2 = measured(phi, labels[1].at, labels[1].pos);
      const x = (g2 - labels[1].k) / labels[1].c;
      if (near(labels[0].c * x + labels[0].k, g1, 1e-9)) sols.push({ phi, x });
    }
    if (sols.length !== 1) return `${sols.length} configurations fit the labels`;
    const { phi, x } = sols[0];
    const target =
      ask === 'x' ? x : ask === 'angle' ? labels[askLabel].c * x + labels[askLabel].k : measured(phi, yAt!.at, yAt!.pos);
    return checkMcs(q.answer, values, target);
  },
};

/* ================================================================== 2. Angles on a line / around a point (NE) */

type AroundKind = 'line' | 'ratio' | 'point' | 'cross';
interface AroundParams {
  kind: AroundKind;
  exprs: { c: number; k: number }[];
  /** ratio kind: 'whole' means r / (r + s) = p / q, 'parts' means r : s = p : q. */
  ratio?: { form: 'whole' | 'parts'; p: number; q: number; ask: 'r' | 's' };
  ask: 'x' | 'largest' | number | 'y';
}

function aroundExprs(rng: Rng, n: number, total: number, d: number): { exprs: { c: number; k: number }[]; x0: number } | null {
  const x0 = rng.int(d === 1 ? 2 : 3, d === 1 ? 6 : 9) * 5 + (d === 3 ? rng.pick([0, 0, 2, 3]) : 0);
  const exprs: { c: number; k: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const c = rng.int(1, d === 1 ? 3 : 4);
    const k = d === 1 && i === 0 ? 0 : rng.pick([0, 0, 10, 20, 30, -10, 15, 5]);
    exprs.push({ c, k });
  }
  const c = rng.int(1, d === 1 ? 3 : 5);
  const k = total - c * x0 - exprs.reduce((s, e) => s + e.c * x0 + e.k, 0);
  if (Math.abs(k) > 60 || (d === 1 && k % 5 !== 0)) return null;
  exprs.push({ c, k });
  const vals = exprs.map((e) => e.c * x0 + e.k);
  if (vals.some((v) => v < 25 || v >= 175)) return null;
  if (new Set(exprs.map((e) => `${e.c},${e.k}`)).size < n) return null;
  return { exprs, x0 };
}

/** Rays from O at cumulative angles; labels inside the wedges. Values are drawn with a 28° minimum. */
function fanFigure(values: number[], texs: string[], total: 180 | 360, start: number, withLine: boolean): GeometryFigure {
  const minDraw = 28;
  const raw = values.map((v) => Math.max(minDraw, v));
  const scale = total / raw.reduce((s, v) => s + v, 0);
  const drawn = raw.map((v) => v * scale);
  const R = 3;
  const O: Pt = [0, 0];
  const points: Record<string, Pt> = { O };
  const dirs: number[] = [start];
  for (const v of drawn) dirs.push(dirs[dirs.length - 1] + v);
  const rayNames: string[] = [];
  dirs.forEach((a, i) => {
    if (total === 360 && i === dirs.length - 1) return;
    const n = `R${i}`;
    points[n] = mul(dir(a), R);
    rayNames.push(n);
  });
  const segments = withLine
    ? [{ from: 'R0', to: `R${dirs.length - 1}` }, ...rayNames.slice(1, -1).map((n) => ({ from: 'O', to: n }))]
    : rayNames.map((n) => ({ from: 'O', to: n }));
  const k = pxPerUnit(Object.values(points).concat([[-R, -R], [R, R]]));
  const labels = values.map((_, i) => ({ at: wedgeLabel(O, dir(dirs[i]), dir(dirs[i + 1]), texs[i], k, { minPx: 22 }), text: texs[i] }));
  return { kind: 'geometry', points, hideLabels: Object.keys(points), segments, labels };
}

const aroundPoint: Template<AroundParams> = {
  id: 'geo.lines-angles.around-point',
  skill: SKILL,
  format: 'ne',
  style: 'angles on a straight line or around a point, with expressions or a ratio',
  generate(rng, d) {
    const kind: AroundKind = rng.pick(
      d === 1 ? (['line', 'line', 'ratio'] as const) : d === 2 ? (['line', 'ratio', 'ratio', 'point'] as const) : (['point', 'cross', 'cross', 'ratio'] as const),
    );
    if (kind === 'ratio') {
      // GE-17: r and s on a straight line, a ratio is given.
      const form: 'whole' | 'parts' = rng.chance(0.55) ? 'whole' : 'parts';
      let p: number;
      let q: number;
      for (;;) {
        if (form === 'whole') {
          q = rng.pick(d === 1 ? [3, 4, 5, 6, 9, 10] : [8, 9, 12, 15, 16, 20, 24]);
          p = rng.int(1, q - 1);
        } else {
          p = rng.int(1, d === 1 ? 5 : 7);
          q = rng.int(1, d === 1 ? 5 : 9);
        }
        const r = new Frac(180 * p, form === 'whole' ? q : p + q);
        const g = form === 'whole' ? q : p + q;
        if (p === q || (form === 'whole' && (p * 2 === q || new Frac(p, q).d !== q))) continue;
        if (form === 'parts' && (new Frac(p, q).d !== q || p === q)) continue;
        if (!r.isTerminating() || r.toDecimalString().replace(/^\d+\.?/, '').length > 2) continue;
        if (r.toNumber() < 20 || r.toNumber() > 160 || g > 30) continue;
        break;
      }
      const ask: 'r' | 's' = form === 'whole' || rng.chance(0.6) ? 'r' : 's';
      const whole = form === 'whole' ? q : p + q;
      const r = new Frac(180 * p, whole);
      const s = new Frac(180).sub(r);
      const ans = ask === 'r' ? r : s;
      const traps: { value: Frac; trap: string }[] = [];
      const r360 = new Frac(360 * p, whole);
      traps.push({ value: ask === 'r' ? r360 : new Frac(360).sub(r360), trap: 'geo-ang-line-360' });
      const misread = form === 'whole' ? new Frac(180 * p, p + q) : new Frac(180 * p, q);
      if (misread.lt(180)) traps.push({ value: ask === 'r' ? misread : new Frac(180).sub(misread), trap: 'geo-ang-ratio-whole' });
      const figure = fanFigure([r.toNumber(), s.toNumber()].reverse(), ['$s^\\circ$', '$r^\\circ$'], 180, 0, true);
      const cond = form === 'whole' ? `$\\dfrac{r}{r + s} = \\dfrac{${p}}{${q}}$` : `$\\dfrac{r}{s} = \\dfrac{${p}}{${q}}$`;
      return {
        params: { kind, exprs: [], ratio: { form, p, q, ask }, ask: 0 },
        q: {
          format: 'ne',
          stem: `In the figure above, a ray meets a straight line. If ${cond}, what is the value of $${ask}$?`,
          answer: ans,
          traps: traps.filter((t) => !t.value.eq(ans)),
          figure,
          explanation:
            form === 'whole'
              ? `The two angles form a straight line, so $r + s = 180$. Then $\\dfrac{r}{180} = \\dfrac{${p}}{${q}}$ and $r = \\dfrac{${p} \\cdot 180}{${q}} = ${num(r)}$.

The ratio compares $r$ with the WHOLE straight angle, not with $s$: reading it as $r : s = ${p} : ${q}$ would give a different answer. And a straight line is $180^\\circ$, not $360^\\circ$.`
              : `The two angles form a straight line, so $r + s = 180$. With $r : s = ${p} : ${q}$, the straight angle is split into $${p} + ${q} = ${p + q}$ equal parts of $\\dfrac{180}{${p + q}}$ degrees each, so $r = ${num(r)}$ and $s = ${num(s)}$.

So $${ask} = ${num(ans)}$. Careful: $\\frac{r}{s} = \\frac{${p}}{${q}}$ does not mean $r$ is $\\frac{${p}}{${q}}$ of $180$.`,
        },
      };
    }
    if (kind === 'cross') {
      // Two lines cross at O; a ray splits one angle into a and b; the vertical angle is labeled.
      for (;;) {
        const x0 = rng.int(4, 12) * 5;
        const c1 = rng.int(1, 3);
        const c2 = rng.int(1, 2);
        const k1 = rng.pick([0, 10, -10, 5, 20]);
        const k2 = rng.pick([0, 10, 15, -5, 20]);
        const a = c1 * x0 + k1;
        const b = c2 * x0 + k2;
        const v = a + b;
        if (a < 20 || b < 20 || v < 60 || v > 140) continue;
        const c3 = rng.int(2, 5);
        if (c3 === c1 + c2) continue;
        const k3 = v - c3 * x0;
        if (Math.abs(k3) > 80) continue;
        const exprs = [
          { c: c1, k: k1 },
          { c: c2, k: k2 },
          { c: c3, k: k3 },
        ];
        const y = 180 - v;
        // figure: line 1 horizontal; ray at angle a; line 2 at angle a + b.
        const O: Pt = [0, 0];
        const da = Math.max(28, a);
        const db = Math.max(28, b);
        const sc = Math.min(1, 150 / (da + db));
        const t1 = da * sc;
        const t2 = (da + db) * sc;
        const R = 3;
        const points: Record<string, Pt> = { O, A: [R, 0], B: [-R, 0], E: mul(dir(t1), R), C: mul(dir(t2), R), D: mul(dir(t2 + 180), R) };
        const k = pxPerUnit(Object.values(points));
        const texs = exprs.map((e) => angleLabel(e.c, e.k));
        const labels = [
          { at: wedgeLabel(O, points.A, points.E, texs[0], k), text: texs[0] },
          { at: wedgeLabel(O, points.E, points.C, texs[1], k), text: texs[1] },
          { at: wedgeLabel(O, points.B, points.D, texs[2], k), text: texs[2] },
          { at: wedgeLabel(O, points.C, points.B, '$y^\\circ$', k), text: '$y^\\circ$' },
        ];
        const figure: GeometryFigure = {
          kind: 'geometry',
          points,
          hideLabels: Object.keys(points),
          segments: [
            { from: 'A', to: 'B' },
            { from: 'C', to: 'D' },
            { from: 'O', to: 'E' },
          ],
          labels,
        };
        const traps = [
          { value: frac(v), trap: 'geo-ang-vertical-adjacent' },
          { value: frac(x0), trap: 'geo-ang-wrong-unknown' },
        ].filter((t) => !t.value.eq(y));
        return {
          params: { kind, exprs, ask: 'y' },
          q: {
            format: 'ne',
            stem: 'In the figure above, two lines intersect, and a ray is drawn from their point of intersection. What is the value of $y$?',
            answer: frac(y),
            traps,
            figure,
            explanation: `Together, the $${labTex({ c: c1, k: k1 })}$ and $${labTex({ c: c2, k: k2 })}$ angles form the angle that is vertical to the $${labTex({ c: c3, k: k3 })}$ angle, so their sum equals it:

$$${linTex(c1 + c2, k1 + k2)} = ${exprTex(c3, k3)}$$

so $x = ${x0}$ and that angle measures $${v}^\\circ$.

The $y^\\circ$ angle forms a straight line with it, so $y = 180 - ${v} = ${y}$. ($y$ is adjacent to the $${v}^\\circ$ angle, not vertical to it, so $y \\ne ${v}$.)`,
          },
        };
      }
    }
    const total: 180 | 360 = kind === 'line' ? 180 : 360;
    const n = kind === 'line' ? 3 : 4;
    let gen: ReturnType<typeof aroundExprs> = null;
    while (!gen) gen = aroundExprs(rng, n, total, d);
    const { exprs, x0 } = gen;
    const vals = exprs.map((e) => e.c * x0 + e.k);
    const largest = Math.max(...vals);
    const unique = vals.filter((v) => v === largest).length === 1;
    const ask: AroundParams['ask'] = d === 1 ? 'x' : unique && rng.chance(0.6) ? 'largest' : rng.chance(0.5) ? 'x' : rng.int(0, n - 1);
    const answer = ask === 'x' ? x0 : ask === 'largest' ? largest : vals[ask as number];
    const C = exprs.reduce((s, e) => s + e.c, 0);
    const K = exprs.reduce((s, e) => s + e.k, 0);
    const other = total === 180 ? 360 : 180;
    const xw = new Frac(other - K, C);
    const traps: { value: Frac; trap: string }[] = [];
    const wrongTrap = total === 180 ? 'geo-ang-line-360' : 'geo-ang-point-180';
    if (xw.sign() > 0) {
      if (ask === 'x') traps.push({ value: xw, trap: wrongTrap });
      else {
        const e = ask === 'largest' ? exprs[vals.indexOf(largest)] : exprs[ask as number];
        const w = xw.mul(e.c).add(e.k);
        if (w.sign() > 0) traps.push({ value: w, trap: wrongTrap });
      }
    }
    if (ask !== 'x') traps.push({ value: frac(x0), trap: 'geo-ang-wrong-unknown' });
    const texs = exprs.map((e) => angleLabel(e.c, e.k));
    const figure = fanFigure(vals, texs, total, kind === 'line' ? 0 : rng.int(0, 11) * 30 + 10, kind === 'line');
    const where = kind === 'line' ? 'In the figure above, two rays are drawn from a point on a straight line.' : 'In the figure above, four rays are drawn from a point.';
    const askText =
      ask === 'x' ? 'what is the value of $x$?' : ask === 'largest' ? 'what is the measure, in degrees, of the largest of the angles shown?' : `what is the measure, in degrees, of the angle labeled $${texs[ask as number].replace(/\$/g, '')}$?`;
    const sumTex = exprs.map((e) => (e.k === 0 ? exprTex(e.c, 0) : `(${exprTex(e.c, e.k)})`)).join(' + ');
    const asked =
      ask === 'x'
        ? ''
        : `\n\nThen ${ask === 'largest' ? `the angles measure ${vals.map((v) => `$${v}^\\circ$`).join(', ')}; the largest is $${largest}^\\circ$` : `the angle measures $${answer}^\\circ$`}. (Stopping at $x = ${x0}$ answers the wrong question.)`;
    return {
      params: { kind, exprs, ask },
      q: {
        format: 'ne',
        stem: `${where} ${askText.charAt(0).toUpperCase() + askText.slice(1)}`,
        answer: frac(answer),
        traps: traps.filter((t) => !t.value.eq(answer)),
        figure,
        explanation: `${kind === 'line' ? 'The angles together make a straight angle' : 'The angles together go all the way around the point'}, so they add up to $${total}^\\circ$:

$$${sumTex} = ${total}$$

so $${linTex(C, K)} = ${total}$${K === 0 ? '' : `, $${linTex(C, 0)} = ${total - K}$`} and $x = ${x0}$.${asked}

${total === 180 ? 'Angles along a straight line total $180^\\circ$; $360^\\circ$ is for a full turn around a point.' : 'A full turn around a point is $360^\\circ$; $180^\\circ$ is only for angles along a straight line.'}`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    let target: number | null = null;
    if (p.kind === 'ratio') {
      const { form, p: a, q: b, ask } = p.ratio!;
      // Rotate the ray in quarter-degree steps; measure both angles from coordinates.
      const hits: number[] = [];
      for (let j = 1; j < 720; j++) {
        const t = j / 4;
        const ray = dir(t);
        const r = angleAt([0, 0], [1, 0], ray);
        const s = angleAt([0, 0], ray, [-1, 0]);
        const ok = form === 'whole' ? near(r * b, (r + s) * a, 1e-12) : near(r * b, s * a, 1e-12);
        if (ok) hits.push(ask === 'r' ? r : s);
      }
      if (hits.length !== 1) return `${hits.length} ray positions fit`;
      target = hits[0];
    } else if (p.kind === 'cross') {
      const [e1, e2, e3] = p.exprs;
      const hits: number[] = [];
      for (let x = -100; x <= 300; x++) {
        const a = e1.c * x + e1.k;
        const b = e2.c * x + e2.k;
        if (a <= 0 || b <= 0 || a + b >= 180) continue;
        const C = dir(a + b);
        const D = mul(C, -1);
        const vert = angleAt([0, 0], [-1, 0], D);
        if (near(vert, e3.c * x + e3.k, 1e-9)) hits.push(angleAt([0, 0], C, [-1, 0]));
      }
      if (hits.length !== 1) return `${hits.length} values of x fit`;
      target = hits[0];
    } else {
      const total = p.kind === 'line' ? 180 : 360;
      const hits: number[] = [];
      for (let x = -100; x <= 300; x++) {
        const vals = p.exprs.map((e) => e.c * x + e.k);
        if (vals.some((v) => v <= 0 || v >= 180)) continue;
        // Turn a ray through each angle in turn; it must end on the opposite ray (line) or back home (point).
        let v: Pt = [1, 0];
        for (const a of vals) v = rot(v, a);
        const end = total === 180 ? ([-1, 0] as Pt) : ([1, 0] as Pt);
        if (Math.hypot(v[0] - end[0], v[1] - end[1]) < 1e-9) {
          hits.push(p.ask === 'x' ? x : p.ask === 'largest' ? Math.max(...vals) : vals[p.ask as number]);
        }
      }
      if (hits.length !== 1) return `${hits.length} values of x fit`;
      target = hits[0];
    }
    return Math.abs(q.answer.toNumber() - target) < 1e-9 ? null : `expected ${target}`;
  },
};

/* ================================================================== 3. The "bent line" between parallel lines (QC) */

type ZigKind = 'numbers' | 'find-b' | 'symbolic' | 'lower-bound' | 'double' | 'open';
interface ZigParams {
  kind: ZigKind;
  a?: number;
  b?: number;
  x?: number;
  N?: number;
}

/** Bent path A -> P -> B between ℓ (y = 3) and m (y = 0), angles a at A and b at B measured from the rightward direction. */
function zigGeom(a: number, b: number, h = 1.4): { A: Pt; P: Pt; B: Pt } {
  const P: Pt = [5, h];
  const A = sub(P, mul(dir(-a), (3 - h) / Math.sin(a * RAD)));
  const B = sub(P, mul(dir(b), h / Math.sin(b * RAD)));
  return { A, P, B };
}
/** Angle x at P measured from coordinates (null when the path is not a proper bend). */
function zigX(a: number, b: number, h = 1.4): number | null {
  if (a <= 0 || b <= 0 || a + b >= 180) return null;
  const { A, P, B } = zigGeom(a, b, h);
  return angleAt(P, A, B);
}

const zigzagQC: Template<ZigParams> = {
  id: 'geo.lines-angles.bent-line-qc',
  skill: SKILL,
  format: 'qc',
  style: 'angle at the bend of a path between two parallel lines',
  generate(rng, d) {
    const kind: ZigKind = rng.pick(
      d === 1
        ? (['numbers', 'numbers', 'find-b', 'symbolic'] as const)
        : d === 2
          ? (['numbers', 'numbers', 'find-b', 'find-b', 'symbolic', 'lower-bound'] as const)
          : (['numbers', 'find-b', 'find-b', 'double', 'lower-bound', 'open'] as const),
    );
    const a = rng.int(5, 13) * 5;
    let b = rng.int(5, 12) * 5;
    while (a + b > 150 || b === a) b = rng.int(5, 12) * 5;
    const x = a + b;
    let labA = `$${a}^\\circ$`;
    let labB = `$${b}^\\circ$`;
    let labX = '$x^\\circ$';
    let info = '$\\ell \\parallel m$';
    let qa: string;
    let qb: string;
    let answer: QCChoice;
    let traps: Partial<Record<QCChoice, string>> = {};
    let explanation: string;
    let params: ZigParams;
    const drawA = Math.min(60, Math.max(30, a));
    const drawB = Math.min(60, Math.max(30, b));
    const aux = 'Draw a line through the bend parallel to $\\ell$ and $m$. It splits the angle at the bend into two parts that are alternate interior angles with the angles at $\\ell$ and at $m$';
    switch (kind) {
      case 'numbers': {
        const N = x + rng.pick([-15, -10, -5, 0, 5, 10]);
        answer = N < x ? 'A' : N > x ? 'B' : 'C';
        const wrong = 180 - x;
        const wrongAns: QCChoice = wrong > N ? 'A' : wrong < N ? 'B' : 'C';
        traps = { [wrongAns]: 'geo-par-bend' };
        qa = '$x$';
        qb = `$${N}$`;
        explanation = `${aux}, so $x = ${a} + ${b} = ${x}$.

Quantity B is $${N}$, so ${QC_SAY[answer]}. (${answer})

The angle at the bend is the SUM of the two outer angles, not $180 - (${a} + ${b}) = ${wrong}$.`;
        params = { kind, a, b, N };
        break;
      }
      case 'find-b': {
        labB = '$y^\\circ$';
        labX = `$${x}^\\circ$`;
        const N = b + rng.pick([-15, -10, -5, 0, 5, 10].filter((v) => b + v > 0));
        answer = N < b ? 'A' : N > b ? 'B' : 'C';
        const wrong = 180 - x - a;
        if (wrong > 0) {
          const wa: QCChoice = wrong > N ? 'A' : wrong < N ? 'B' : 'C';
          traps = { [wa]: 'geo-par-bend' };
        }
        qa = '$y$';
        qb = `$${N}$`;
        explanation = `${aux}, so the angle at the bend equals $${a} + y$. Then $${a} + y = ${x}$ and $y = ${b}$.

Quantity B is $${N}$, so ${QC_SAY[answer]}. (${answer})`;
        params = { kind, a, x, N };
        break;
      }
      case 'symbolic': {
        labA = '$a^\\circ$';
        labB = '$b^\\circ$';
        answer = 'C';
        qa = '$x$';
        qb = '$a + b$';
        explanation = `${aux}: one part equals $a$ and the other equals $b$. So $x = a + b$ whatever the actual angles are. (C)`;
        params = { kind };
        break;
      }
      case 'lower-bound': {
        labB = '$b^\\circ$';
        const N = rng.pick([a, a - 5, a - 10]);
        answer = 'A';
        qa = '$x$';
        qb = `$${N}$`;
        explanation = `${aux}, so $x = ${a} + b$. Since $b > 0$, $x > ${a}${N < a ? ` > ${N}` : ''}$. (A)

You do not need the value of $b$: the bend angle is always larger than either outer angle.`;
        params = { kind, a, N };
        break;
      }
      case 'double': {
        labA = '$a^\\circ$';
        labB = '$b^\\circ$';
        info = '$\\ell \\parallel m$ and $x = 2a$';
        answer = 'C';
        qa = '$a$';
        qb = '$b$';
        explanation = `${aux}, so $x = a + b$. With $x = 2a$: $a + b = 2a$, so $b = a$. (C)`;
        params = { kind };
        break;
      }
      default: {
        // open: only one outer angle is known and B lies above it.
        labB = '$b^\\circ$';
        const N = a + rng.pick([20, 30, 40]);
        answer = 'D';
        qa = '$x$';
        qb = `$${N}$`;
        explanation = `${aux}, so $x = ${a} + b$. Nothing fixes $b$: if $b = 10$, then $x = ${a + 10} < ${N}$, but if $b = ${N - a + 10}$, then $x = ${N + 10} > ${N}$. (D)`;
        params = { kind, a, N };
      }
    }
    const g = zigGeom(drawA, drawB, 1.3);
    const points: Record<string, Pt> = {
      ...g,
      L1: [Math.min(g.A[0], g.B[0]) - 1.6, 3],
      L2: [g.P[0] + 1.8, 3],
      M1: [Math.min(g.A[0], g.B[0]) - 1.6, 0],
      M2: [g.P[0] + 1.8, 0],
    };
    const lab = [
      { at: [points.L2[0] + 0.4, 3] as Pt, text: '$\\ell$' },
      { at: [points.M2[0] + 0.4, 0] as Pt, text: '$m$' },
    ];
    const k = pxPerUnit(figPoints({ points, labels: lab }));
    lab.push(
      { at: wedgeLabel(g.A, add(g.A, [1, 0]), g.P, labA, k), text: labA },
      { at: wedgeLabel(g.B, g.P, add(g.B, [1, 0]), labB, k), text: labB },
      { at: wedgeLabel(g.P, g.B, g.A, labX, k), text: labX },
    );
    const figure: GeometryFigure = {
      kind: 'geometry',
      points,
      hideLabels: Object.keys(points),
      segments: [
        { from: 'L1', to: 'L2' },
        { from: 'M1', to: 'M2' },
        { from: 'A', to: 'P' },
        { from: 'P', to: 'B' },
      ],
      labels: lab,
    };
    return {
      params,
      q: { format: 'qc', info, figure, quantityA: qa, quantityB: qb, answer, traps: qcTraps(answer, traps), explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const rng = mulberry(p.kind.length + (p.a ?? 0) * 7 + (p.N ?? 0));
    const samples: [number, number][] = [];
    for (let i = 0; i < 300; i++) {
      const h = 0.3 + 2.4 * rng();
      switch (p.kind) {
        case 'numbers':
          samples.push([zigX(p.a!, p.b!, h)!, p.N!]);
          break;
        case 'find-b': {
          // find b from the measured bend angle
          const bb = bisect((t) => (zigX(p.a!, t, h) ?? 999) - p.x!, 1e-6, 180 - p.a! - 1e-6);
          samples.push([bb, p.N!]);
          break;
        }
        case 'symbolic': {
          const a = 1 + 170 * rng();
          const b = (179 - a) * rng() + 0.5;
          const xm = zigX(a, b, h);
          if (xm === null) continue;
          const { A, P, B } = zigGeom(a, b, h);
          samples.push([xm, angleAt(A, add(A, [1, 0]), P) + angleAt(B, add(B, [1, 0]), P)]);
          break;
        }
        case 'lower-bound':
        case 'open': {
          const b = (180 - p.a!) * rng();
          const xm = zigX(p.a!, b, h);
          if (xm === null) continue;
          samples.push([xm, p.N!]);
          break;
        }
        case 'double': {
          const a = 1 + 88 * rng();
          const bb = bisect((t) => (zigX(a, t, h) ?? 999) - 2 * a, 1e-6, 180 - a - 1e-6);
          samples.push([a, bb]);
          break;
        }
      }
    }
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

/** Tiny deterministic float generator for check() sampling. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================== 4. Eight angles at two parallel lines (MCM) */

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
type Letter = (typeof LETTERS)[number];
const LETTER_AT: Record<Letter, { at: At; pos: Pos }> = {
  a: { at: 'P', pos: 'UL' },
  b: { at: 'P', pos: 'UR' },
  c: { at: 'P', pos: 'LR' },
  d: { at: 'P', pos: 'LL' },
  e: { at: 'Q', pos: 'UL' },
  f: { at: 'Q', pos: 'UR' },
  g: { at: 'Q', pos: 'LR' },
  h: { at: 'Q', pos: 'LL' },
};

type Stmt = { kind: 'eq'; p: Letter; q: Letter } | { kind: 'supp'; p: Letter; q: Letter } | { kind: 'sums'; p: Letter; q: Letter; r: Letter; s: Letter };

interface EightParams {
  mode: 'measure' | 'statements';
  given?: { letter: Letter; value: number };
  target?: number;
  letters?: Letter[];
  stmts?: Stmt[];
}

const stmtTex = (s: Stmt) =>
  s.kind === 'eq' ? `$${s.p} = ${s.q}$` : s.kind === 'supp' ? `$${s.p} + ${s.q} = 180$` : `$${s.p} + ${s.q} = ${s.r} + ${s.s}$`;

const eightAngles: Template<EightParams> = {
  id: 'geo.lines-angles.eight-angles',
  skill: SKILL,
  format: 'mcm',
  style: 'which of the eight angles at two parallel lines are equal or supplementary',
  generate(rng, d) {
    const theta = rng.int(9, 15) * 5;
    const phi = rng.chance(0.5) ? theta : 180 - theta;
    const type = (l: Letter) => isPhiType(LETTER_AT[l].pos);
    const val = (l: Letter) => measureAt(LETTER_AT[l].pos, phi);
    const figure = transversalFigure(
      drawPhi(phi),
      LETTERS.map((l) => ({ ...LETTER_AT[l], tex: `$${l}^\\circ$` })),
    );
    if (d === 1 || (d === 2 && rng.chance(0.4))) {
      const given = rng.pick(LETTERS);
      const gv = val(given);
      const target = rng.chance(0.5) ? gv : 180 - gv;
      const others = LETTERS.filter((l) => l !== given);
      const letters = rng.sample(others, d === 1 ? 5 : 6).sort();
      if (!letters.some((l) => val(l) === target)) letters[0] = others.find((l) => val(l) === target)!;
      letters.sort();
      const { choices, answer } = flaggedChoices(
        letters.map((l) => ({
          text: `$${l}$`,
          correct: val(l) === target,
          ...(val(l) !== target ? { trap: target === gv ? 'geo-par-equal-not-supp' : 'geo-par-supp-not-equal' } : {}),
        })),
      );
      const sameT = LETTERS.filter((l) => type(l) === type(given));
      const otherT = LETTERS.filter((l) => type(l) !== type(given));
      return {
        params: { mode: 'measure', given: { letter: given, value: gv }, target, letters },
        q: {
          format: 'mcm',
          stem: `In the figure above, lines $\\ell$ and $m$ are parallel and $${given} = ${gv}$. Which of the following angles have measure $${target}^\\circ$?`,
          instruction: 'Indicate all such angles.',
          figure,
          choices,
          answer,
          explanation: `Parallel lines cut by a transversal make only two different angle measures. Vertical angles, corresponding angles and alternate angles are equal, and two angles that form a straight line add up to $180^\\circ$.

- equal to $${given}$: ${sameT.map((l) => `$${l}$`).join(', ')}, each $${gv}^\\circ$
- the other four: ${otherT.map((l) => `$${l}$`).join(', ')}, each $180 - ${gv} = ${180 - gv}^\\circ$

So the angles of measure $${target}^\\circ$ among the choices are ${letters
            .filter((l) => val(l) === target)
            .map((l) => `$${l}$`)
            .join(', ')}.`,
        },
      };
    }
    // statements that must be true
    const stmts: Stmt[] = [];
    const truth = (s: Stmt) =>
      s.kind === 'eq' ? type(s.p) === type(s.q) : s.kind === 'supp' ? type(s.p) !== type(s.q) : [s.p, s.q].map(type).sort().join() === [s.r, s.s].map(type).sort().join();
    const n = d === 2 ? 5 : 6;
    const want = rng.int(2, n - 2);
    let guard = 0;
    while (stmts.length < n && guard++ < 500) {
      const nT = stmts.filter(truth).length;
      const needTrue = nT < want;
      const needFalse = stmts.length - nT < n - want;
      const kind: Stmt['kind'] = d === 3 && rng.chance(0.3) ? 'sums' : rng.pick(['eq', 'supp'] as const);
      let s: Stmt;
      if (kind === 'sums') {
        const [p, q2, r, s2] = rng.sample(LETTERS, 4);
        s = { kind, p, q: q2, r, s: s2 };
      } else {
        // prefer pairs on different lines (the interesting ones)
        const p = rng.pick(LETTERS.slice(0, 4));
        const q2 = rng.pick(rng.chance(0.85) ? LETTERS.slice(4) : LETTERS.slice(0, 4).filter((l) => l !== p));
        s = { kind, p, q: q2 };
      }
      const t = truth(s);
      if ((t && !needTrue) || (!t && !needFalse)) continue;
      const key = stmtTex(s);
      if (stmts.some((x) => stmtTex(x) === key)) continue;
      stmts.push(s);
    }
    const { choices, answer } = flaggedChoices(
      stmts.map((s) => ({
        text: stmtTex(s),
        correct: truth(s),
        ...(!truth(s) && s.kind !== 'sums' ? { trap: s.kind === 'eq' ? 'geo-par-equal-not-supp' : 'geo-par-supp-not-equal' } : {}),
      })),
    );
    const sameT = LETTERS.filter((l) => type(l));
    const otherT = LETTERS.filter((l) => !type(l));
    const why = stmts
      .map((s) => {
        const t = truth(s);
        if (s.kind === 'sums') {
          if (!t) return `- ${stmtTex(s)}: not true in general, the two sides mix the two kinds of angles differently ✗`;
          const [r1, s1] = type(s.p) === type(s.r) ? [s.r, s.s] : [s.s, s.r];
          return `- ${stmtTex(s)}: $${s.p} = ${r1}$ and $${s.q} = ${s1}$, so the sums are equal ✓`;
        }
        const nm = relName(LETTER_AT[s.p], LETTER_AT[s.q]);
        if (s.kind === 'eq') return `- ${stmtTex(s)}: ${t ? `${nm}, equal` : `${nm ?? 'one of each kind'}, these add up to $180^\\circ$ instead`} ${t ? '✓' : '✗'}`;
        return `- ${stmtTex(s)}: ${t ? `${nm ?? 'one of each kind'}, supplementary` : `${nm}, these are equal (they add up to $180^\\circ$ only for a right angle)`} ${t ? '✓' : '✗'}`;
      })
      .join('\n');
    return {
      params: { mode: 'statements', stmts },
      q: {
        format: 'mcm',
        stem: 'In the figure above, lines $\\ell$ and $m$ are parallel. Which of the following statements must be true?',
        instruction: 'Indicate all such statements.',
        figure,
        choices,
        answer,
        explanation: `With parallel lines there are only two angle measures: ${sameT.map((l) => `$${l}$`).join(', ')} are all equal, ${otherT
          .map((l) => `$${l}$`)
          .join(', ')} are all equal, and an angle from one group plus an angle from the other is $180^\\circ$.

${why}`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'format';
    if (p.mode === 'measure') {
      const { letter, value } = p.given!;
      const phis: number[] = [];
      for (let phi = 1; phi < 180; phi++) if (near(measured(phi, LETTER_AT[letter].at, LETTER_AT[letter].pos), value, 1e-9)) phis.push(phi);
      if (phis.length !== 1) return `${phis.length} transversal angles fit`;
      const expected = p.letters!.flatMap((l, i) => (near(measured(phis[0], LETTER_AT[l].at, LETTER_AT[l].pos), p.target!, 1e-9) ? [i] : []));
      return checkMcm(q.answer, expected);
    }
    const m = (phi: number, l: Letter) => measured(phi, LETTER_AT[l].at, LETTER_AT[l].pos);
    const holds = (s: Stmt, phi: number) =>
      s.kind === 'eq' ? near(m(phi, s.p), m(phi, s.q)) : s.kind === 'supp' ? near(m(phi, s.p) + m(phi, s.q), 180) : near(m(phi, s.p) + m(phi, s.q), m(phi, s.r) + m(phi, s.s));
    const phis = [17, 38, 64, 103, 129, 161];
    const expected = p.stmts!.flatMap((s, i) => (phis.every((phi) => holds(s, phi)) ? [i] : []));
    return checkMcm(q.answer, expected);
  },
};

export const linesTemplates = [parallelAlgebra, aroundPoint, zigzagQC, eightAngles];
