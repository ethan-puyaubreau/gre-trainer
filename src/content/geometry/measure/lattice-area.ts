import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { paren } from '../../../engine/tex';
import type { NEQuestion, Template, Trap } from '../../../engine/types';
import { Fig } from './fig';
import { Redraw, retryAll } from '../redraw';

/* Area of a polygon from the coordinates of its vertices, listed in order (NE). */

export const latticeAreaTraps: Record<string, Trap> = {
  'geom-poly-lat-bbox': {
    label: 'Gave the area of the rectangle around the polygon',
    fix: 'The box through the extreme coordinates always contains the polygon, and the polygon fills only part of it. Use the shoelace formula, or subtract the corner pieces from the box.',
  },
  'geom-poly-lat-no-half': {
    label: 'Forgot the factor $\\frac12$ of the shoelace formula',
    fix: 'The difference $S_1 - S_2$ is TWICE the area. Divide it by 2 before answering.',
  },
  'geom-poly-lat-drop-term': {
    label: 'Left out the closing term from the last vertex back to the first',
    fix: 'The shoelace sums run around the whole polygon: after the last vertex comes the first one again. Repeat the first vertex at the end of the list.',
  },
};

interface Params {
  pts: [number, number][];
}

const NAMES = 'ABCDEFG';

/** Twice the signed area by the shoelace formula: [S1, S2] with S1 - S2 = 2A (signed). */
function sums(pts: [number, number][], dropLast = false): [number, number] {
  let s1 = 0;
  let s2 = 0;
  const m = dropLast ? pts.length - 1 : pts.length;
  for (let i = 0; i < m; i++) {
    const [x, y] = pts[i];
    const [u, v] = pts[(i + 1) % pts.length];
    s1 += x * v;
    s2 += y * u;
  }
  return [s1, s2];
}

const lattice: Template<Params> = {
  id: 'geo.polygons.lattice-area-ne',
  skill: 'geo.polygons',
  format: 'ne',
  style: 'area of a polygon from the coordinates of its vertices',
  generate(rng, d) {
    const k = d === 1 ? 3 : d === 2 ? rng.int(4, 5) : rng.int(6, 7);
    const raw: [number, number][] = [];
    const seen = new Set<string>();
    while (raw.length < k) {
      const p: [number, number] = [rng.int(-5, 9), rng.int(-4, 8)];
      if (!seen.has(p.join())) {
        seen.add(p.join());
        raw.push(p);
      }
    }
    const cx = raw.reduce((s, p) => s + p[0], 0) / k;
    const cy = raw.reduce((s, p) => s + p[1], 0) / k;
    const ang = (p: [number, number]) => Math.atan2(p[1] - cy, p[0] - cx);
    const pts = [...raw].sort((a, b) => ang(a) - ang(b));
    // star-shaped around the centroid: no equal angles and every gap below 180 degrees
    for (let i = 0; i < k; i++) {
      let gap = ang(pts[(i + 1) % k]) - ang(pts[i]);
      if (gap <= 0) gap += 2 * Math.PI;
      if (gap < 1e-6 || gap >= Math.PI - 1e-6 || Math.abs(gap - 2 * Math.PI) < 1e-6) throw new Redraw('not star-shaped');
    }
    // no vertex lying on the segment of its neighbours, and (hard) at least one reflex vertex
    let reflex = 0;
    for (let i = 0; i < k; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % k];
      const c = pts[(i + 2) % k];
      const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (cr === 0) throw new Redraw('collinear');
      if (cr < 0) reflex++;
    }
    if (d === 3 && reflex < 1) throw new Redraw('convex');
    if (d <= 2 && reflex > 0) throw new Redraw('reflex');
    const [s1, s2] = sums(pts);
    const twice = Math.abs(s1 - s2);
    const area = new Frac(twice, 2);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const bbox = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (twice < 12 || twice > 160) throw new Redraw('area size');
    const [d1, d2] = sums(pts, true);
    const traps = [
      { value: new Frac(bbox), trap: 'geom-poly-lat-bbox' },
      { value: new Frac(twice), trap: 'geom-poly-lat-no-half' },
      { value: new Frac(Math.abs(d1 - d2), 2), trap: 'geom-poly-lat-drop-term' },
    ].filter((t) => !t.value.eq(area));
    const fig = new Fig();
    const names = pts.map((_, i) => NAMES[i]);
    pts.forEach((p, i) => {
      const dx = p[0] - cx;
      const dy = p[1] - cy;
      const l = Math.hypot(dx, dy) || 1;
      fig.pt(names[i], p, [dx / l, dy / l]);
    });
    fig.poly(names);
    const f = fig.build(false);
    f.axes = { xMin: Math.min(-1, ...xs) - 1, xMax: Math.max(...xs) + 1, yMin: Math.min(-1, ...ys) - 1, yMax: Math.max(...ys) + 1, grid: true, step: 1, labelTicks: true };
    const list = pts.map((p, i) => `$${names[i]}(${p[0]}, ${p[1]})$`);
    const closed = [...pts, pts[0]];
    const pairs = (swap: boolean) => pts.map((p, i) => (swap ? `${paren(p[1])}\\cdot ${paren(closed[i + 1][0])}` : `${paren(p[0])}\\cdot ${paren(closed[i + 1][1])}`)).join(' + ');
    const q: NEQuestion = {
      format: 'ne',
      stem: `In the $xy$-plane, polygon $${names.join('')}$ has vertices ${list.slice(0, -1).join(', ')}, and ${list[k - 1]}, listed in order around the polygon. What is the area of the polygon?`,
      figure: f,
      answer: area,
      traps,
      suffix: 'square units',
      explanation: `Recognize: the vertices are given in order, so the shoelace formula applies.

Write $S_1 = x_1y_2 + x_2y_3 + \\dots + x_ky_1$ and $S_2 = y_1x_2 + y_2x_3 + \\dots + y_kx_1$. Here $S_1 = ${pairs(false)} = ${s1}$ and $S_2 = ${pairs(true)} = ${s2}$. The area is $\\frac{|S_1 - S_2|}{2} = \\frac{${twice}}{2} = ${area.toDecimalString()}$.

Check: the box around the polygon has area $${bbox}$ and the polygon fits inside it, so the area must be less than $${bbox}$.

Trap: $${bbox}$ is the box, not the polygon; and $${twice}$ forgets to halve.

Rule: sum the products around the whole polygon, closing back to the first vertex, subtract, and halve.`,
    };
    return { params: { pts }, q };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    const { pts } = p;
    const n = pts.length;
    // Pick's theorem: A = I + B/2 - 1 by counting lattice points
    let boundary = 0;
    for (let i = 0; i < n; i++) boundary += gcd(Math.abs(pts[i][0] - pts[(i + 1) % n][0]), Math.abs(pts[i][1] - pts[(i + 1) % n][1]));
    const onEdge = (x: number, y: number) =>
      pts.some((a, i) => {
        const b = pts[(i + 1) % n];
        const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        return cr === 0 && x >= Math.min(a[0], b[0]) && x <= Math.max(a[0], b[0]) && y >= Math.min(a[1], b[1]) && y <= Math.max(a[1], b[1]);
      });
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    let interior = 0;
    for (let x = -10; x <= 12; x++) for (let y = -10; y <= 12; y++) if (!onEdge(x, y) && inside(x, y)) interior++;
    const exp = interior + boundary / 2 - 1;
    return Math.abs(q.answer.toNumber() - exp) < 1e-9 ? null : `expected ${exp}`;
  },
};

export const latticeAreaTemplates = retryAll([lattice]);
