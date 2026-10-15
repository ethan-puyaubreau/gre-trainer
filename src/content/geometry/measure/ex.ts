// Exact values of the form  a + b·π + c·√2 + ...  for answer choices such as 64 − 16π or 25π − 48,
// plus the numeric helpers the check() functions use (shoelace areas, grid integration, angles).

import type { Rng } from '../../../engine/rng';
import { Frac, type FracLike } from '../../../engine/frac';
import { squareOut } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { Choice } from '../../../engine/types';
import { Redraw } from '../redraw';
import { pickPosition } from '../shapes/util';
import type { P2 } from './fig';

/** Unit of a term: '1' (rational), 'pi', or 'r<n>' for the square root of a squarefree n > 1. */
type Unit = string;
const UNIT_ORDER = (u: Unit) => (u === '1' ? 0 : u === 'pi' ? 1 : 2 + Number(u.slice(1)));
const unitValue = (u: Unit) => (u === '1' ? 1 : u === 'pi' ? Math.PI : Math.sqrt(Number(u.slice(1))));
/** Frac from a Frac, an integer, or a terminating decimal number such as 367.5. */
const F = (x: FracLike) => (x instanceof Frac ? x : Number.isInteger(x) ? Frac.of(x) : new Frac(Math.round(x * 1e6), 1e6));

/** Serializable exact value: list of [numerator, denominator, unit]. */
export type ExData = [number, number, Unit][];

export class Ex {
  private constructor(readonly terms: Map<Unit, Frac>) {}

  static of(x: FracLike): Ex {
    return new Ex(new Map([['1', F(x)]]));
  }
  /** k·π */
  static pi(k: FracLike): Ex {
    return new Ex(new Map([['pi', F(k)]]));
  }
  /** k·√n, simplified (√12 = 2√3). */
  static sqrt(n: number, k: FracLike = 1): Ex {
    const [out, inside] = squareOut(n);
    const c = F(k).mul(out);
    return new Ex(new Map([[inside === 1 ? '1' : `r${inside}`, c]]));
  }
  static from(data: ExData): Ex {
    return new Ex(new Map(data.map(([n, d, u]) => [u, new Frac(n, d)])));
  }
  data(): ExData {
    return [...this.terms].filter(([, c]) => c.n !== 0).map(([u, c]) => [c.n, c.d, u]);
  }
  add(o: Ex | FracLike): Ex {
    const b = o instanceof Ex ? o : Ex.of(o);
    const m = new Map(this.terms);
    for (const [u, c] of b.terms) m.set(u, (m.get(u) ?? new Frac(0)).add(c));
    return new Ex(m);
  }
  sub(o: Ex | FracLike): Ex {
    const b = o instanceof Ex ? o : Ex.of(o);
    return this.add(b.scale(-1));
  }
  scale(k: FracLike): Ex {
    const m = new Map<Unit, Frac>();
    for (const [u, c] of this.terms) m.set(u, c.mul(F(k)));
    return new Ex(m);
  }
  value(): number {
    let s = 0;
    for (const [u, c] of this.terms) s += c.toNumber() * unitValue(u);
    return s;
  }
  /** The rational part when the value has no π or radical term, else null. */
  rational(): Frac | null {
    let r = new Frac(0);
    for (const [u, c] of this.terms) {
      if (c.n === 0) continue;
      if (u !== '1') return null;
      r = r.add(c);
    }
    return r;
  }
  /** TeX (to put inside $...$): positive terms first, e.g. 64 - 16\pi, 8\pi - 16, \frac{9\pi}{2}. */
  tex(): string {
    const ts = [...this.terms].filter(([, c]) => c.n !== 0).sort((a, b) => UNIT_ORDER(a[0]) - UNIT_ORDER(b[0]));
    if (!ts.length) return '0';
    const pos = ts.filter(([, c]) => c.n > 0);
    const neg = ts.filter(([, c]) => c.n < 0);
    const ordered = [...pos, ...neg];
    return ordered
      .map(([u, c], i) => {
        const a = c.abs();
        const body = termTex(a, u);
        if (i === 0) return (c.n < 0 ? '-' : '') + body;
        return (c.n < 0 ? ' - ' : ' + ') + body;
      })
      .join('');
  }
}

function termTex(a: Frac, u: Unit): string {
  if (u === '1') return a.toTex();
  const sym = u === 'pi' ? '\\pi' : `\\sqrt{${u.slice(1)}}`;
  if (a.isInt()) return (a.n === 1 ? '' : num(a.n)) + sym;
  return `\\frac{${a.n === 1 ? '' : num(a.n)}${sym}}{${num(a.d)}}`;
}

/**
 * Select-one choices from exact values. Candidates are, in priority order: the trap values (tagged),
 * the fillers, scaled copies of the answer with tidy coefficients (×1/2, ×3/4, ×3/2, ×2...), and
 * answer ± k·step. Non-positive values, duplicates and values too close to another choice are dropped.
 * The correct answer goes to a uniformly random position (A–E) as far as the candidates on each side
 * allow; within a side, earlier candidates (traps first) are preferred. Ascending order.
 * The first `must` traps are always among the choices (the explanation cites them); one that cannot be shown redraws.
 */
export function exChoices(
  rng: Rng,
  correct: Ex,
  traps: { v: Ex; trap: string }[],
  fillers: Ex[],
  opts: { count?: number; minGap?: number; step?: Ex; fmt?: (v: Ex) => string; allowZero?: boolean; scales?: boolean; must?: number } = {},
): { choices: Choice[]; answer: number; values: ExData[] } {
  const count = opts.count ?? 5;
  const minGap = opts.minGap ?? 0.01;
  const c = correct.value();
  const maxDen = Math.max(...correct.data().map(([, d]) => d), 1);
  // integer answers get integer look-alikes; answers with pi or radicals may get halves (e.g. 18 - 9pi/2)
  const intOnly = correct.rational() !== null && maxDen === 1;
  const tidy = (v: Ex) => v.data().every(([, d]) => d <= (intOnly ? 1 : 2 * maxDen));
  const must = opts.must ?? 0;
  const pool: { v: Ex; trap?: string; must?: boolean }[] = [...traps.map((t, i) => ({ v: t.v, trap: t.trap, must: i < must })), ...rng.shuffle(fillers).map((v) => ({ v }))];
  if (opts.scales !== false)
    for (const k of rng.shuffle([new Frac(1, 2), new Frac(3, 4), new Frac(3, 2), new Frac(2), new Frac(1, 4), new Frac(3), new Frac(2, 3), new Frac(4, 3)])) {
      const v = correct.scale(k);
      if (tidy(v)) pool.push({ v });
    }
  if (opts.step) for (let k = 1; k <= 8; k++) pool.push({ v: correct.add(opts.step.scale(k)) }, { v: correct.sub(opts.step.scale(k)) });
  const ok = (x: number) => (opts.allowZero ? x >= 0 : x > 0);
  const near = (x: number, y: number) => Math.abs(x - y) <= minGap * Math.max(1, Math.abs(x), Math.abs(y));
  // Greedy de-duplication in priority order: every kept value is far enough from the answer and from each other.
  const kept: { v: Ex; trap?: string; must?: boolean; x: number; t: string }[] = [];
  const ct = correct.tex();
  for (const it of pool) {
    const x = it.v.value();
    const t = it.v.tex();
    if (it.trap && ok(x) && (near(x, c) || t === ct)) throw new Redraw('a trap equals the answer');
    if (!ok(x) || near(x, c) || kept.some((k) => near(k.x, x)) || t === ct || kept.some((k) => k.t === t)) {
      if (it.must) throw new Redraw('a trap cited in the explanation cannot be shown');
      continue;
    }
    kept.push({ ...it, x, t });
  }
  const below = kept.filter((k) => k.x < c);
  const above = kept.filter((k) => k.x > c);
  if (below.length + above.length < count - 1) throw new Error(`exChoices: only ${below.length + above.length} wrong choices for ${correct.tex()}`);
  // Position of the correct value: keep as many named traps as possible, at random among the best positions.
  const tb = below.filter((k) => k.trap).length;
  const ta = above.filter((k) => k.trap).length;
  const mb = below.filter((k) => k.must).length;
  const ma = above.filter((k) => k.must).length;
  const plan = Array.from({ length: count }, (_, K) => ({ K, kept: Math.min(tb, K) + Math.min(ta, count - 1 - K) })).filter(
    (p) => p.K <= below.length && count - 1 - p.K <= above.length && p.K >= mb && count - 1 - p.K >= ma,
  );
  if (!plan.length) throw new Redraw('no position keeps every cited trap');
  const target = pickPosition(rng, plan, (p) => p.kept, count - 1).K;
  const items: { v: Ex; trap?: string; ok?: boolean; x: number }[] = [{ v: correct, ok: true, x: c }, ...below.slice(0, target), ...above.slice(0, count - 1 - target)];
  items.sort((a, b) => a.x - b.x);
  const fmt = opts.fmt ?? ((v: Ex) => `$${v.tex()}$`);
  return {
    choices: items.map((it) => ({ text: fmt(it.v), ...(it.trap ? { trap: it.trap } : {}) })),
    answer: items.findIndex((it) => it.ok),
    values: items.map((it) => it.v.data()),
  };
}

/** check() helper: the only choice whose value matches `target` (relative tolerance) must be `answer`. */
export function checkChoiceValue(values: ExData[], answer: number, target: number, tol = 1e-6): string | null {
  const hits = values.flatMap((v, i) => (Math.abs(Ex.from(v).value() - target) <= tol * Math.max(1, Math.abs(target)) ? [i] : []));
  if (hits.length !== 1) return `${hits.length} choices match the computed value ${target}`;
  return hits[0] === answer ? null : `expected choice ${hits[0]} (value ${target})`;
}

/* ------------------------------------------------------------------ numeric geometry for checks */

export const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Polygon area by the shoelace formula. */
export function shoelace(pts: P2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function pathLength(pts: P2[], closed = false): number {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) s += dist(pts[i], pts[i + 1]);
  if (closed && pts.length > 1) s += dist(pts[pts.length - 1], pts[0]);
  return s;
}

/** Angle at vertex v between rays v->a and v->b, in degrees (0 to 180). */
export function angleAt(a: P2, v: P2, b: P2): number {
  const ux = a[0] - v[0];
  const uy = a[1] - v[1];
  const wx = b[0] - v[0];
  const wy = b[1] - v[1];
  const c = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Polygon approximating a circle (many sides), for numeric circumference/area checks. */
export function circlePolygon(c: P2, r: number, n = 4000): P2[] {
  return Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)] as P2);
}

let unitCache: { area: number; perim: number } | null = null;
/** Area and perimeter of the unit-radius 4000-gon (computed once): circle measures for radius r are r²·area and r·perim. */
export function unitCircle(): { area: number; perim: number } {
  if (!unitCache) {
    const pts = circlePolygon([0, 0], 1);
    unitCache = { area: shoelace(pts), perim: pathLength(pts, true) };
  }
  return unitCache;
}
