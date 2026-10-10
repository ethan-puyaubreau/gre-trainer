// Exact values of the form  a + b·π + c·√2 + ...  for answer choices such as 64 − 16π or 25π − 48,
// plus the numeric helpers the check() functions use (shoelace areas, grid integration, angles).

import type { Rng } from '../../../engine/rng';
import { Frac, type FracLike } from '../../../engine/frac';
import { squareOut } from '../../../engine/math';
import { num } from '../../../engine/tex';
import type { Choice } from '../../../engine/types';
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
 * Select-one choices from exact values: the correct one, trap values (tagged, kept in priority),
 * then fillers. Non-positive values, duplicates and values too close to another choice are skipped.
 * The position of the correct answer is spread: a random number of wrong choices is taken below it
 * (extra values correct ± k·step are generated when a side runs short). Ascending order.
 */
export function exChoices(
  rng: Rng,
  correct: Ex,
  traps: { v: Ex; trap: string }[],
  fillers: Ex[],
  opts: { count?: number; minGap?: number; step?: Ex; fmt?: (v: Ex) => string; allowZero?: boolean } = {},
): { choices: Choice[]; answer: number; values: ExData[] } {
  const count = opts.count ?? 5;
  const minGap = opts.minGap ?? 0.01;
  const c = correct.value();
  const pool: { v: Ex; trap?: string }[] = [...traps.map((t) => ({ v: t.v, trap: t.trap })), ...rng.shuffle(fillers).map((v) => ({ v }))];
  if (opts.step) for (let k = 1; k <= 8; k++) pool.push({ v: correct.add(opts.step.scale(k)) }, { v: correct.sub(opts.step.scale(k)) });
  const valid = (x: number) => (opts.allowZero ? x >= 0 : x > 0);
  const below = pool.filter((it) => valid(it.v.value()) && it.v.value() < c);
  const above = pool.filter((it) => it.v.value() > c);
  const items: { v: Ex; trap?: string; ok?: boolean }[] = [{ v: correct, ok: true }];
  const close = (x: number) => items.some((it) => Math.abs(it.v.value() - x) <= minGap * Math.max(1, Math.abs(x), Math.abs(it.v.value())));
  const take = (list: { v: Ex; trap?: string }[], n: number) => {
    let got = 0;
    for (const it of list) {
      if (got >= n) break;
      const x = it.v.value();
      if (close(x) || items.some((o) => o.v.tex() === it.v.tex())) continue;
      items.push(it);
      got++;
    }
    return got;
  };
  // Count usable values on each side (greedy, ignoring cross-side closeness, which cannot happen).
  const usable = (list: { v: Ex }[]) => {
    const kept: number[] = [c];
    for (const it of list) {
      const x = it.v.value();
      if (!kept.some((y) => Math.abs(x - y) <= minGap * Math.max(1, Math.abs(x), Math.abs(y)))) kept.push(x);
    }
    return kept.length - 1;
  };
  const need = count - 1;
  const nb = usable(below);
  const na = usable(above);
  const lo = Math.max(0, need - na);
  const hi = Math.min(need, nb);
  if (lo > hi) throw new Error(`exChoices: only ${nb + na} wrong choices for ${correct.tex()}`);
  // Keep every trap when possible (they carry the feedback), otherwise spread freely.
  const tb = Math.min(usable(below.filter((it) => it.trap)), need);
  const ta = Math.min(usable(above.filter((it) => it.trap)), need);
  const lo2 = Math.max(lo, tb);
  const hi2 = Math.min(hi, need - ta);
  const nBelow = lo2 <= hi2 && !(lo2 === hi2 && rng.chance(0.3)) ? rng.int(lo2, hi2) : rng.int(lo, hi);
  const gotB = take(below, nBelow);
  take(above, need - gotB);
  if (items.length < count) take(below, count - items.length);
  if (items.length < count) throw new Error(`exChoices: only ${items.length} choices for ${correct.tex()}`);
  items.sort((a, b) => a.v.value() - b.v.value());
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

/** Point-in-polygon (ray casting). */
export function inPolygon(pts: P2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const inDisk = (c: P2, r: number, x: number, y: number) => (x - c[0]) ** 2 + (y - c[1]) ** 2 < r * r;

/** Area of {(x, y) in box : pred(x, y)} by counting the midpoints of an n x n grid. */
export function gridArea(pred: (x: number, y: number) => boolean, box: [number, number, number, number], n = 700): number {
  const [x0, y0, x1, y1] = box;
  const hx = (x1 - x0) / n;
  const hy = (y1 - y0) / n;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * hx;
    for (let j = 0; j < n; j++) if (pred(x, y0 + (j + 0.5) * hy)) count++;
  }
  return count * hx * hy;
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
