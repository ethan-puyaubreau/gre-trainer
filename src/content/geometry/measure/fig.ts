// Figure helpers for the measurement templates: a small builder over GeometryFigure with hidden
// helper points, so arcs, shaded sectors, ellipses (cylinders) and boxes can be drawn with the
// segments and polygons the renderer supports.

import type { GeometryFigure, Rich } from '../../../engine/types';

export type P2 = [number, number];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point on a circle, angle in degrees counterclockwise from the positive x-axis. */
export const onCircle = (c: P2, r: number, deg: number): P2 => [c[0] + r * Math.cos(rad(deg)), c[1] + r * Math.sin(rad(deg))];

/** Points along an arc from a0 to a1 degrees (counterclockwise when a1 > a0), endpoints included. */
export function arcPts(c: P2, r: number, a0: number, a1: number, stepDeg = 5): P2[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / stepDeg));
  return Array.from({ length: n + 1 }, (_, i) => onCircle(c, r, a0 + ((a1 - a0) * i) / n));
}

/** Points along an ellipse arc (semi-axes rx, ry), angles in degrees. */
export function ellipsePts(c: P2, rx: number, ry: number, a0: number, a1: number, stepDeg = 10): P2[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / stepDeg));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = rad(a0 + ((a1 - a0) * i) / n);
    return [c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t)] as P2;
  });
}

export class Fig {
  points: Record<string, P2> = {};
  private hidden: string[] = [];
  private offsets: Record<string, P2> = {};
  private segments: NonNullable<GeometryFigure['segments']> = [];
  private polygons: NonNullable<GeometryFigure['polygons']> = [];
  private circles: NonNullable<GeometryFigure['circles']> = [];
  private rightAngles: NonNullable<GeometryFigure['rightAngles']> = [];
  private angles: NonNullable<GeometryFigure['angles']> = [];
  private labels: NonNullable<GeometryFigure['labels']> = [];
  private k = 0;

  /** Named (labeled) point. `offset` overrides where its letter goes, e.g. [0, 1] = above. */
  pt(name: string, p: P2, offset?: P2): this {
    this.points[name] = p;
    if (offset) this.offsets[name] = offset;
    return this;
  }
  /** Unlabeled helper point (no dot, no letter). */
  h(p: P2): string {
    const n = `h${this.k++}`;
    this.points[n] = p;
    this.hidden.push(n);
    return n;
  }
  /** Hide the letter and dot of a named point. */
  hide(...names: string[]): this {
    this.hidden.push(...names);
    return this;
  }
  seg(a: string, b: string, label?: Rich, dashed?: boolean): this {
    this.segments.push({ from: a, to: b, ...(label ? { label } : {}), ...(dashed ? { dashed } : {}) });
    return this;
  }
  /** Segment between two coordinates (helper endpoints). */
  segXY(a: P2, b: P2, label?: Rich, dashed?: boolean): this {
    return this.seg(this.h(a), this.h(b), label, dashed);
  }
  /** Polyline through coordinates, drawn with segments (dashed for hidden edges). */
  path(pts: P2[], dashed = false): this {
    const names = pts.map((p) => this.h(p));
    for (let i = 0; i + 1 < names.length; i++) this.seg(names[i], names[i + 1], undefined, dashed);
    return this;
  }
  poly(pts: string[], shade = false): this {
    this.polygons.push({ pts, ...(shade ? { shade } : {}) });
    return this;
  }
  /** Polygon through coordinates (helper points). */
  polyXY(pts: P2[], shade = false): this {
    return this.poly(
      pts.map((p) => this.h(p)),
      shade,
    );
  }
  /** Polygon through named points and coordinates (coordinates become helper points). */
  polyMixed(items: (string | P2)[], shade = false): this {
    return this.poly(
      items.map((it) => (typeof it === 'string' ? it : this.h(it))),
      shade,
    );
  }
  circle(center: string, r: number, shade = false): this {
    this.circles.push({ center, r, ...(shade ? { shade } : {}) });
    return this;
  }
  right(a: string, vertex: string, b: string): this {
    this.rightAngles.push({ a, vertex, b });
    return this;
  }
  angle(a: string, vertex: string, b: string, label?: Rich): this {
    this.angles.push({ a, vertex, b, ...(label ? { label } : {}) });
    return this;
  }
  label(at: P2, text: Rich): this {
    this.labels.push({ at, text });
    return this;
  }
  private pending: { a: string; v: string; b: string; text: Rich }[] = [];
  /**
   * Angle arc with its label pushed far enough into the angle that a wide label such as
   * "(2x - 60)°" does not cross the sides (the position is resolved in build()).
   */
  angleLabel(a: string, vertex: string, b: string, text: Rich): this {
    this.angles.push({ a, vertex, b });
    this.pending.push({ a, v: vertex, b, text });
    return this;
  }
  private resolvePending(): void {
    if (!this.pending.length) return;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of Object.values(this.points)) xs.push(x), ys.push(y);
    for (const c of this.circles) {
      const [x, y] = this.points[c.center];
      xs.push(x - c.r, x + c.r), ys.push(y - c.r, y + c.r);
    }
    const k = 340 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-9); // px per unit
    for (const { a, v, b, text } of this.pending) {
      const V = this.points[v];
      const u = (P: P2) => {
        const dx = P[0] - V[0];
        const dy = P[1] - V[1];
        const l = Math.hypot(dx, dy);
        return [dx / l, dy / l];
      };
      const u1 = u(this.points[a]);
      const u2 = u(this.points[b]);
      let bx = u1[0] + u2[0];
      let by = u1[1] + u2[1];
      let bl = Math.hypot(bx, by);
      if (bl < 1e-6) {
        bx = -u1[1];
        by = u1[0];
        bl = 1;
      }
      const plain = text.replace(/\\circ|\^|\$|\s|\\[a-z]+/g, '');
      const halfW = 5.5 * plain.length + 6;
      const halfH = 11;
      // Smallest distance t (px) along the bisector at which the label box clears both rays.
      let px = 40;
      for (const w of [u1, u2]) {
        let nx = -w[1];
        let ny = w[0];
        if (nx * bx + ny * by < 0) {
          nx = -nx;
          ny = -ny;
        }
        const along = (nx * bx + ny * by) / bl;
        if (along > 1e-6) px = Math.max(px, (Math.abs(nx) * halfW + Math.abs(ny) * halfH + 6) / along);
      }
      // ... and stays outside the angle arc (radius 22 px around the vertex).
      const gapToArc = (t: number) => {
        const cx = Math.abs((bx / bl) * t);
        const cy = Math.abs((by / bl) * t);
        return Math.hypot(Math.max(cx - halfW, 0), Math.max(cy - halfH, 0));
      };
      while (px < 130 && gapToArc(px) < 27) px += 2;
      px = Math.min(px, 130);
      this.labels.push({ at: [V[0] + (bx / bl) * (px / k), V[1] + (by / bl) * (px / k)], text });
      // keep the vertex letter out of the angle: put it on the opposite side
      if (!this.offsets[v] && !this.hidden.includes(v)) this.offsets[v] = [-bx / bl, -by / bl];
    }
    this.pending = [];
  }
  build(notToScale = true): GeometryFigure {
    this.resolvePending();
    const f: GeometryFigure = { kind: 'geometry', points: this.points };
    if (this.hidden.length) f.hideLabels = this.hidden;
    if (Object.keys(this.offsets).length) f.labelOffsets = this.offsets;
    if (this.segments.length) f.segments = this.segments;
    if (this.polygons.length) f.polygons = this.polygons;
    if (this.circles.length) f.circles = this.circles;
    if (this.rightAngles.length) f.rightAngles = this.rightAngles;
    if (this.angles.length) f.angles = this.angles;
    if (this.labels.length) f.labels = this.labels;
    if (notToScale) f.notToScale = true;
    return f;
  }
}

/* ------------------------------------------------------------------ 3-D sketches */

/**
 * Rectangular solid in oblique projection: front face [x0, x0 + L] x [y0, y0 + H], depth W drawn
 * receding up and to the right. Hidden edges are dashed. Labels go on the bottom front edge (L),
 * the left front edge (H) and the bottom right receding edge (W).
 */
export function drawBox(
  fig: Fig,
  L: number,
  W: number,
  H: number,
  labels: { L?: Rich; W?: Rich; H?: Rich } = {},
  opts: { origin?: P2; diagonal?: boolean; depthScale?: number; waterLevel?: number } = {},
): { corners: Record<string, P2> } {
  const [x0, y0] = opts.origin ?? [0, 0];
  const s = opts.depthScale ?? 0.55;
  const dx = W * s * Math.cos(rad(35));
  const dy = W * s * Math.sin(rad(35));
  const c = {
    a: [x0, y0] as P2, // front bottom left
    b: [x0 + L, y0] as P2, // front bottom right
    c: [x0 + L, y0 + H] as P2, // front top right
    d: [x0, y0 + H] as P2, // front top left
    e: [x0 + dx, y0 + dy] as P2, // back bottom left (hidden)
    f: [x0 + L + dx, y0 + dy] as P2, // back bottom right
    g: [x0 + L + dx, y0 + H + dy] as P2, // back top right
    k: [x0 + dx, y0 + H + dy] as P2, // back top left
  };
  if (opts.waterLevel !== undefined) {
    const w = opts.waterLevel;
    // Water: front face and right face up to the level, plus the visible part of the surface.
    fig.polyXY([c.a, c.b, [c.b[0], y0 + w], [c.a[0], y0 + w]], true);
    fig.polyXY([c.b, c.f, [c.f[0], y0 + dy + w], [c.b[0], y0 + w]], true);
    fig.polyXY([[c.a[0], y0 + w], [c.b[0], y0 + w], [c.f[0], y0 + dy + w], [c.e[0], y0 + dy + w]], true);
  }
  fig.segXY(c.a, c.b, labels.L);
  fig.segXY(c.b, c.c);
  fig.segXY(c.c, c.d);
  fig.segXY(c.d, c.a, labels.H);
  fig.segXY(c.d, c.k);
  fig.segXY(c.k, c.g);
  fig.segXY(c.c, c.g);
  fig.segXY(c.b, c.f, labels.W);
  fig.segXY(c.f, c.g);
  fig.segXY(c.a, c.e, undefined, true);
  fig.segXY(c.e, c.f, undefined, true);
  fig.segXY(c.e, c.k, undefined, true);
  if (opts.diagonal) fig.segXY(c.a, c.g, undefined, true);
  return { corners: c };
}

/**
 * Right circular cylinder standing on its base: base center `origin`, radius r, height h (drawing
 * units). The back half of the bottom rim is dashed. Optional radius label (top, center to rim),
 * height label (right side) and water level (shaded).
 */
export function drawCylinder(
  fig: Fig,
  r: number,
  h: number,
  labels: { r?: Rich; h?: Rich; d?: Rich } = {},
  opts: { origin?: P2; waterLevel?: number; squash?: number } = {},
): void {
  const [x0, y0] = opts.origin ?? [0, 0];
  const ry = r * (opts.squash ?? 0.32);
  const bottom: P2 = [x0, y0];
  const top: P2 = [x0, y0 + h];
  if (opts.waterLevel !== undefined) {
    const w = opts.waterLevel;
    const lvl: P2 = [x0, y0 + w];
    const silhouette = [...ellipsePts(bottom, r, ry, 180, 360), ...ellipsePts(lvl, r, ry, 0, 180)];
    fig.polyXY(silhouette, true);
    fig.path(ellipsePts(lvl, r, ry, 180, 360));
  }
  // top rim (full ellipse)
  fig.polyXY(ellipsePts(top, r, ry, 0, 350));
  // bottom rim: front solid, back dashed
  fig.path(ellipsePts(bottom, r, ry, 180, 360));
  fig.path(ellipsePts(bottom, r, ry, 0, 180, 12), true);
  // sides
  fig.segXY([x0 - r, y0], [x0 - r, y0 + h]);
  fig.segXY([x0 + r, y0], [x0 + r, y0 + h], labels.h);
  // radius drawn toward the front right, so its label sits on the top face, clear of the back rim
  if (labels.r) fig.segXY(top, [x0 + r * Math.cos(-0.7), y0 + h + ry * Math.sin(-0.7)], labels.r);
  if (labels.d) fig.segXY([x0 - r, y0 + h], [x0 + r, y0 + h], labels.d);
}
