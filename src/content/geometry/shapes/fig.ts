// Plane-geometry helpers for the shapes templates: vector math used both to draw figures and to
// re-measure them in check() (coordinates + atan2 instead of the angle theorems the questions test),
// plus label placement inside angles so "(3x + 20)°" never sits on top of a line.

import type { GeometryFigure } from '../../../engine/types';

export type Pt = [number, number];

export const RAD = Math.PI / 180;
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, s: number): Pt => [a[0] * s, a[1] * s];
export const norm = (a: Pt) => Math.hypot(a[0], a[1]);
export const dist = (a: Pt, b: Pt) => norm(sub(a, b));
export const unit = (a: Pt): Pt => mul(a, 1 / (norm(a) || 1));
export const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
export const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
/** Unit vector at `deg` degrees counterclockwise from the positive x-axis. */
export const dir = (deg: number): Pt => [Math.cos(deg * RAD), Math.sin(deg * RAD)];
export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const mid = (a: Pt, b: Pt): Pt => lerp(a, b, 0.5);

/** Measure of angle AVB in degrees, in [0, 180]. */
export function angleAt(V: Pt, A: Pt, B: Pt): number {
  const u = sub(A, V);
  const v = sub(B, V);
  return Math.atan2(Math.abs(cross(u, v)), dot(u, v)) / RAD;
}

/** Intersection of the lines p + t·d and q + s·e. */
export function intersect(p: Pt, d: Pt, q: Pt, e: Pt): Pt {
  const t = cross(sub(q, p), e) / cross(d, e);
  return add(p, mul(d, t));
}

/** Foot of the perpendicular from P to line AB. */
export function foot(P: Pt, A: Pt, B: Pt): Pt {
  const d = sub(B, A);
  return add(A, mul(d, dot(sub(P, A), d) / dot(d, d)));
}

/** Area of a polygon (shoelace formula). */
export const shoelace = (pts: Pt[]) => Math.abs(pts.reduce((s, p, i) => s + cross(p, pts[(i + 1) % pts.length]), 0)) / 2;

/** Rotate v by `deg` degrees counterclockwise. */
export const rot = (v: Pt, deg: number): Pt => {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};

/** Third vertex C of a triangle with AB on a line, |AC| = b, |BC| = a, C on the left of A->B. Null if impossible. */
export function fromSides(A: Pt, B: Pt, b: number, a: number): Pt | null {
  const c = dist(A, B);
  const x = (b * b + c * c - a * a) / (2 * c);
  const y2 = b * b - x * x;
  if (y2 <= 1e-9) return null;
  const u = unit(sub(B, A));
  return add(add(A, mul(u, x)), mul([-u[1], u[0]], Math.sqrt(y2)));
}

/** Triangle with base QR on the x-axis and the given base angles (degrees): returns [Q, R, P]. */
export function triFromAngles(angQ: number, angR: number, base = 1): [Pt, Pt, Pt] {
  const Q: Pt = [0, 0];
  const R: Pt = [base, 0];
  const P = intersect(Q, dir(angQ), R, dir(180 - angR));
  return [Q, R, P];
}

/** Root of a continuous function on [lo, hi] by bisection (f(lo) and f(hi) of opposite signs). */
export function bisect(f: (t: number) => number, lo: number, hi: number, iters = 80): number {
  let flo = f(lo);
  for (let i = 0; i < iters; i++) {
    const m = (lo + hi) / 2;
    const fm = f(m);
    if (fm === 0) return m;
    if (fm < 0 === flo < 0) {
      lo = m;
      flo = fm;
    } else hi = m;
  }
  return (lo + hi) / 2;
}

export const near = (a: number, b: number, eps = 1e-7) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------------ label placement */

/** Rough rendered width in px of a short TeX label (KaTeX at 15px). */
export function labelWidthPx(tex: string): number {
  const t = tex
    .replace(/\$/g, '')
    .replace(/\\circ/g, '°')
    .replace(/\\ell/g, 'l')
    .replace(/\\sqrt/g, '√')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}^ ]/g, '');
  let w = 0;
  for (const ch of t) w += '+-=−'.includes(ch) ? 17 : ch === '°' ? 6 : '()'.includes(ch) ? 6 : '√'.includes(ch) ? 12 : 9;
  return w + 4;
}

/** Pixels per figure unit as the renderer computes it (inner box of 340 px), with a safety factor. */
export function pxPerUnit(pts: Pt[], safety = 0.9): number {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9);
  return (340 / span) * safety;
}

/**
 * Center for a label inside the angle a-V-b (rays V->a and V->b, measure below 180), pushed along the
 * bisector until a box of the label's approximate size clears both rays by `margin` px.
 */
export function wedgeLabel(V: Pt, a: Pt, b: Pt, tex: string, k: number, opts: { minPx?: number; margin?: number } = {}): Pt {
  const ua = unit(sub(a, V));
  const ub = unit(sub(b, V));
  let bis = add(ua, ub);
  let s = Math.sign(cross(ua, ub));
  if (norm(bis) < 1e-9 || s === 0) {
    bis = [-ua[1], ua[0]];
    s = 1;
  }
  bis = unit(bis);
  const hw = labelWidthPx(tex) / 2 / k;
  const hh = 10 / k;
  const m = (opts.margin ?? 3) / k;
  const straight = Math.abs(cross(ua, ub)) < 1e-9;
  for (let px = opts.minPx ?? 20; px < 420; px += 2) {
    const C = add(V, mul(bis, px / k));
    const corners: Pt[] = [
      [C[0] - hw, C[1] - hh],
      [C[0] + hw, C[1] - hh],
      [C[0] - hw, C[1] + hh],
      [C[0] + hw, C[1] + hh],
    ];
    const ok = corners.every((p) => {
      const w = sub(p, V);
      if (straight) return cross(ua, w) * s >= m;
      return cross(ua, w) * s >= m && cross(w, ub) * s >= m;
    });
    if (ok) return C;
  }
  return add(V, mul(bis, 40 / k));
}

/** Point on the outside of segment AB (away from `away`), `px` pixels from its midpoint. */
export function sideLabel(A: Pt, B: Pt, away: Pt, k: number, px = 16): Pt {
  const M = mid(A, B);
  let n: Pt = unit([-(B[1] - A[1]), B[0] - A[0]]);
  if (dot(n, sub(away, M)) > 0) n = mul(n, -1);
  return add(M, mul(n, px / k));
}

/** Collect every coordinate a figure uses (for pxPerUnit). */
export function figPoints(f: Pick<GeometryFigure, 'points' | 'labels'>): Pt[] {
  return [...Object.values(f.points), ...(f.labels ?? []).map((l) => l.at)];
}

/** TeX for a figure angle label: deg('x') -> "x^\circ". */
export const deg = (t: string | number) => `${t}^\\circ`;

/* ------------------------------------------------------------------ builder */

type Seg = NonNullable<GeometryFigure['segments']>[number];

/** Small builder: named points, hidden helpers, and angle labels placed once the scale is known. */
export class FigBuilder {
  points: Record<string, Pt> = {};
  private hidden: string[] = [];
  private offsets: Record<string, Pt> = {};
  private segments: Seg[] = [];
  private polygons: NonNullable<GeometryFigure['polygons']> = [];
  private rightAngles: NonNullable<GeometryFigure['rightAngles']> = [];
  private angles: NonNullable<GeometryFigure['angles']> = [];
  private labels: { at: Pt; text: string }[] = [];
  private wedges: { V: Pt; a: Pt; b: Pt; tex: string; minPx?: number }[] = [];
  private sides: { A: Pt; B: Pt; away: Pt; tex: string; px: number }[] = [];
  private h = 0;

  pt(name: string, p: Pt, offset?: Pt): this {
    this.points[name] = p;
    if (offset) this.offsets[name] = offset;
    return this;
  }
  /** Unlabeled helper point; returns its generated name. */
  helper(p: Pt): string {
    const n = `_h${this.h++}`;
    this.points[n] = p;
    this.hidden.push(n);
    return n;
  }
  hide(...names: string[]): this {
    this.hidden.push(...names);
    return this;
  }
  seg(from: string, to: string, label?: string, dashed?: boolean): this {
    this.segments.push({ from, to, ...(label ? { label } : {}), ...(dashed ? { dashed } : {}) });
    return this;
  }
  poly(...pts: string[]): this {
    this.polygons.push({ pts });
    return this;
  }
  right(a: string, vertex: string, b: string): this {
    this.rightAngles.push({ a, vertex, b });
    return this;
  }
  arc(a: string, vertex: string, b: string, label?: string): this {
    this.angles.push({ a, vertex, b, ...(label ? { label } : {}) });
    return this;
  }
  text(at: Pt, tex: string): this {
    this.labels.push({ at, text: tex });
    return this;
  }
  /** Label inside angle a-V-b (point names). */
  angle(vertex: string, a: string, b: string, tex: string, minPx?: number): this {
    this.wedges.push({ V: this.points[vertex], a: this.points[a], b: this.points[b], tex, minPx });
    return this;
  }
  /** Label beside segment AB on the side away from point `away` (all point names). */
  side(A: string, B: string, away: string, tex: string, px = 16): this {
    this.sides.push({ A: this.points[A], B: this.points[B], away: this.points[away], tex, px });
    return this;
  }
  build(notToScale = false): GeometryFigure {
    const k = pxPerUnit([...Object.values(this.points), ...this.labels.map((l) => l.at)]);
    const labels = [...this.labels];
    for (const w of this.wedges) labels.push({ at: wedgeLabel(w.V, w.a, w.b, w.tex, k, { minPx: w.minPx }), text: w.tex });
    for (const s of this.sides) {
      const extra = s.tex.length > 6 ? (labelWidthPx(s.tex) / 2) * 0.55 : 0;
      labels.push({ at: sideLabel(s.A, s.B, s.away, k, s.px + extra), text: s.tex });
    }
    return {
      kind: 'geometry',
      points: this.points,
      ...(this.hidden.length ? { hideLabels: this.hidden } : {}),
      ...(Object.keys(this.offsets).length ? { labelOffsets: this.offsets } : {}),
      ...(this.segments.length ? { segments: this.segments } : {}),
      ...(this.polygons.length ? { polygons: this.polygons } : {}),
      ...(this.rightAngles.length ? { rightAngles: this.rightAngles } : {}),
      ...(this.angles.length ? { angles: this.angles } : {}),
      ...(labels.length ? { labels } : {}),
      ...(notToScale ? { notToScale } : {}),
    };
  }
}

/** Letter sets for triangle vertices: [top, bottom-left, bottom-right]. */
export const TRI_NAMES: [string, string, string][] = [
  ['A', 'B', 'C'],
  ['P', 'Q', 'R'],
  ['J', 'K', 'L'],
  ['R', 'S', 'T'],
  ['X', 'Y', 'Z'],
  ['D', 'E', 'F'],
];

/** Drawn angles: each at least `min` degrees, renormalized to 180. */
export function softAngles(angles: number[], min = 34): number[] {
  const raw = angles.map((a) => Math.max(min, a));
  const s = raw.reduce((t, a) => t + a, 0);
  return raw.map((a) => (a * 180) / s);
}
