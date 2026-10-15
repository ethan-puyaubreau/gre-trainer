import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import type { Rng } from '../../../engine/rng';
import { decimal, num } from '../../../engine/tex';
import type { Difficulty, GeometryFigure, QCChoice, QuestionBody, Template } from '../../../engine/types';
import { FigBuilder, RAD, add, angleAt, bisect, dir, dist, fromSides, intersect, lerp, mul, near, rot, shoelace, sub, type Pt } from './fig';
import { mulberry } from './lines';
import { checkMcm, checkMcs, intChoices, positioned, qcTraps, QC_SAY } from './util';
import { Redraw, retryAll } from '../redraw';
import { trapNotes } from '../notes';

const SKILL = 'geo.similarity';
const dec = (f: Frac) => (f.isInt() ? num(f.n) : decimal(f));
const ft = (f: Frac) => f.toTex();
/** n/d in TeX without a denominator of 1: rt(3, 1) -> "3". */
const rt = (n: number, d: number) => (d === 1 ? num(n) : `\\frac{${num(n)}}{${num(d)}}`);

/** Coprime ratio pairs p : q (AD : DB). */
const RATIOS: [number, number][] = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 3],
  [3, 2],
  [3, 1],
  [1, 3],
  [3, 4],
  [4, 3],
  [2, 5],
  [5, 2],
  [3, 5],
];

/**
 * Triangle ABC with D on AB, E on AC, DE parallel to BC. With `len` (AD, AB and DE) or `sides` (AD, AB and AC) the
 * shape is built to match the numbers (then rotated so BC is horizontal); otherwise a default scalene shape is used.
 */
function dePic(
  rDraw: number,
  labels: Partial<Record<'AD' | 'DB' | 'DE' | 'BC' | 'AE' | 'EC', string>>,
  shade = false,
  len?: { AD: number; AB: number; DE: number },
  sides?: { AD: number; AB: number; AC: number },
): GeometryFigure {
  let A: Pt = [1.7, 3.7];
  let B: Pt = [0, 0];
  let C: Pt = [5.2, 0];
  let r = Math.min(0.8, Math.max(0.2, rDraw));
  // rotate so that BC is horizontal and A is above it, scale to about 5 units wide
  const fit = (g: Record<'A' | 'B' | 'C', Pt>) => {
    const ang = Math.atan2(g.C[1] - g.B[1], g.C[0] - g.B[0]) / RAD;
    const tr = (P: Pt) => rot(sub(P, g.B), -ang);
    let pts = [g.A, g.B, g.C].map(tr);
    if (pts[0][1] < 0) pts = pts.map(([x, y]) => [x, -y] as Pt);
    const span = Math.max(...pts.map((P) => P[0])) - Math.min(...pts.map((P) => P[0]));
    const h = pts[0][1];
    const sc = Math.min(5.2 / span, 4.2 / h);
    [A, B, C] = pts.map((P) => mul(P, sc)) as [Pt, Pt, Pt];
  };
  if (len) {
    const lim = len.DE >= len.AD ? 70 : Math.min(70, (Math.asin(len.DE / len.AD) / RAD) * 0.85);
    const g = buildDE(Math.max(lim, 28), len.AD, len.AB, len.DE) ?? buildDE(lim, len.AD, len.AB, len.DE);
    if (g) {
      fit(g);
      r = len.AD / len.AB;
    }
  } else if (sides) {
    fit({ A: [0, 0], B: [sides.AB, 0], C: mul(dir(55), sides.AC) });
    r = sides.AD / sides.AB;
  }
  const D = lerp(A, B, r);
  const E = lerp(A, C, r);
  const fb = new FigBuilder().pt('A', A).pt('B', B).pt('C', C).pt('D', D, [-1, 0.25]).pt('E', E, [1, 0.25]).poly('A', 'B', 'C').seg('D', 'E');
  if (shade) fb.poly('A', 'D', 'E');
  if (labels.AD) fb.side('A', 'D', 'C', labels.AD, 13);
  if (labels.DB) fb.side('D', 'B', 'C', labels.DB, 13);
  if (labels.AE) fb.side('A', 'E', 'B', labels.AE, 13);
  if (labels.EC) fb.side('E', 'C', 'B', labels.EC, 13);
  if (labels.DE) fb.side('D', 'E', 'B', labels.DE, 11);
  if (labels.BC) fb.side('B', 'C', 'A', labels.BC);
  return fb.build();
}

/**
 * Independent construction for check(): rays from A at angle `alpha`; D at distance ad on ray 1 and E on
 * ray 2 with |DE| = de (circle-line intersection); B at distance ab on ray 1; C where the parallel to DE
 * through B meets ray 2.
 */
function buildDE(alpha: number, ad: number, ab: number, de: number): Record<'A' | 'B' | 'C' | 'D' | 'E', Pt> | null {
  const A: Pt = [0, 0];
  const u2 = dir(alpha);
  const D: Pt = [ad, 0];
  const proj = D[0] * u2[0];
  const disc = de * de - ad * ad + proj * proj;
  if (disc < 0) return null;
  const t = proj + Math.sqrt(disc);
  if (t <= 1e-9) return null;
  const E = mul(u2, t);
  const B: Pt = [ab, 0];
  const C = intersect(B, sub(E, D), A, u2);
  return { A, B, C, D, E };
}

/** Angles at A for which a segment of length `de` from the point at distance `ad` reaches the other ray. */
function alphasFor(ad: number, de: number): number[] {
  const lim = Math.min(85, de >= ad ? 85 : (Math.asin(de / ad) / RAD) * 0.97);
  return [0.3, 0.55, 0.8, 0.97].map((f) => Math.max(2, f * lim));
}

/* ================================================================== 1. Segment parallel to a side (NE) */

type PSAsk = 'BC' | 'DE' | 'DB' | 'EC' | 'area';
interface PSParams {
  ask: PSAsk;
  AD: number;
  DB?: number;
  DE?: number;
  BC?: number;
  AE?: number;
  S?: number;
}

const parallelSegment: Template<PSParams> = {
  id: 'geo.similarity.parallel-segment-ne',
  skill: SKILL,
  format: 'ne',
  style: 'a segment parallel to a side cuts off a similar triangle',
  generate(rng, d) {
    const ask: PSAsk = rng.pick(d === 1 ? (['BC', 'DE', 'EC'] as const) : d === 2 ? (['BC', 'DE', 'DB', 'EC'] as const) : (['DB', 'DE', 'area', 'area'] as const));
    const [p, q] = rng.pick(RATIOS.filter(([a, b]) => !(a === 1 && b === 1)));
    const n = p + q;
    const k1 = rng.int(1, 4);
    const k2 = rng.int(Math.max(1, k1 - 1), k1 + 2);
    const AD = p * k1;
    const DB = q * k1;
    const DE = p * k2;
    const BC = n * k2;
    const AE = p * rng.int(1, 4);
    const EC = (AE / p) * q;
    let answer: Frac;
    const traps: { value: Frac; trap: string }[] = [];
    let labels: Partial<Record<'AD' | 'DB' | 'DE' | 'BC' | 'AE' | 'EC', string>> = {};
    let stem = '';
    let explanation = '';
    let params: PSParams;
    const ratioTex = `\\frac{AD}{AB} = \\frac{${AD}}{${AD + DB}}${gcd(AD, AD + DB) > 1 ? ` = ${ft(new Frac(p, n))}` : ''}`;
    switch (ask) {
      case 'BC':
        answer = Frac.of(BC);
        traps.push({ value: new Frac(DE * DB, AD), trap: 'geo-sim-part-whole' }, { value: Frac.of(DE + DB), trap: 'geo-sim-additive' });
        labels = { AD: `$${AD}$`, DB: `$${DB}$`, DE: `$${DE}$` };
        stem = 'In the figure above, $DE$ is parallel to $BC$. What is the length of $BC$?';
        explanation = `Because $DE \\parallel BC$, triangle $ADE$ is similar to triangle $ABC$ (they share angle $A$, and the parallel lines make equal corresponding angles). Corresponding sides are proportional: $${ratioTex}$.

So $\\frac{DE}{BC} = ${ft(new Frac(p, n))}$ and $BC = ${DE} \\cdot ${ft(new Frac(n, p))} = ${BC}$.

Compare a part with the WHOLE side: $AD$ goes with $AB = ${AD + DB}$, not with $DB$.`;
        params = { ask, AD, DB, DE };
        break;
      case 'DE':
        answer = Frac.of(DE);
        traps.push({ value: new Frac(BC * AD, DB), trap: 'geo-sim-part-whole' }, { value: new Frac(BC, 2), trap: 'geo-sim-midpoint' });
        labels = { AD: `$${AD}$`, DB: `$${DB}$`, BC: `$${BC}$` };
        stem = 'In the figure above, $DE$ is parallel to $BC$. What is the length of $DE$?';
        explanation = `Triangles $ADE$ and $ABC$ are similar because $DE \\parallel BC$, so $\\frac{DE}{BC} = ${ratioTex}$.

$DE = ${BC} \\cdot ${ft(new Frac(p, n))} = ${DE}$.

Using $\\frac{AD}{DB}$ instead of $\\frac{AD}{AB}$ compares a part with a part; and $DE$ is half of $BC$ only when $D$ is the midpoint of $AB$.`;
        params = { ask, AD, DB, BC };
        break;
      case 'DB':
        answer = Frac.of(DB);
        traps.push({ value: Frac.of(AD + DB), trap: 'geo-sim-whole-not-part' }, { value: Frac.of(BC - DE), trap: 'geo-sim-additive' });
        labels = { AD: `$${AD}$`, DE: `$${DE}$`, BC: `$${BC}$` };
        stem = 'In the figure above, $DE$ is parallel to $BC$. What is the length of $DB$?';
        explanation = `Triangles $ADE$ and $ABC$ are similar, so $\\frac{AB}{AD} = \\frac{BC}{DE} = ${rt(BC, DE)}$, which gives $AB = ${AD} \\cdot ${ft(new Frac(BC, DE))} = ${AD + DB}$.

Then $DB = AB - AD = ${AD + DB} - ${AD} = ${DB}$.

The proportion gives the whole side $AB$; stopping there answers the wrong question.`;
        params = { ask, AD, DE, BC };
        break;
      case 'EC':
        answer = new Frac(EC);
        traps.push({ value: new Frac(AE * n, p), trap: 'geo-sim-whole-not-part' }, { value: new Frac(AE * p, q), trap: 'geo-sim-inverted' });
        labels = { AD: `$${AD}$`, DB: `$${DB}$`, AE: `$${AE}$` };
        stem = 'In the figure above, $DE$ is parallel to $BC$. What is the length of $EC$?';
        explanation = `A line parallel to one side of a triangle divides the other two sides in the same ratio: $\\frac{AE}{EC} = \\frac{AD}{DB} = ${rt(AD, DB)}${gcd(AD, DB) > 1 ? ` = ${ft(new Frac(p, q))}` : ''}$.

So $EC = ${AE} \\cdot ${ft(new Frac(q, p))} = ${dec(new Frac(EC))}$.

(Flipping the ratio, or computing all of $AC$, are the usual slips.)`;
        params = { ask, AD, DB, AE };
        break;
      default: {
        // area of the trapezoid DBCE from the area of ADE
        const m = rng.int(1, 4);
        const S = p * p * m;
        const total = n * n * m;
        answer = Frac.of(total - S);
        traps.push({ value: Frac.of(total), trap: 'geo-sim-whole-not-part' }, { value: new Frac(S * n, p).sub(S), trap: 'geo-sim-linear-area' });
        labels = { AD: `$${AD}$`, DB: `$${DB}$` };
        stem = `In the figure above, $DE$ is parallel to $BC$, and the area of the shaded triangle $ADE$ is $${S}$. What is the area of quadrilateral $DBCE$?`;
        explanation = `Triangles $ADE$ and $ABC$ are similar with ratio $${ratioTex}$. Areas scale by the SQUARE of that ratio: $\\frac{\\text{area } ADE}{\\text{area } ABC} = ${ft(new Frac(p * p, n * n))}$.

So the area of $ABC$ is $${S} \\cdot ${ft(new Frac(n * n, p * p))} = ${total}$, and the area of $DBCE$ is $${total} - ${S} = ${total - S}$.

Scaling the area by $${ft(new Frac(n, p))}$ instead of $(${ft(new Frac(n, p))})^2$ is the trap; so is forgetting to subtract the triangle.`;
        params = { ask, AD, DB, S };
      }
    }
    // equal numbers on the figure would hand out a shortcut (DE = AD, DB = BC - DE...): redraw instead
    const given = Object.values(labels).map((t) => Number(t!.replace(/\$/g, '')));
    if (new Set(given).size < given.length || given.some((g) => answer.eq(g)) || traps.some((t) => t.value.eq(answer))) throw new Redraw('equal lengths hand out a shortcut');
    return {
      params,
      q: {
        format: 'ne',
        stem,
        answer,
        traps: traps.filter((t) => t.value.sign() > 0 && t.value.isTerminating()),
        figure: dePic(
          p / n,
          labels,
          ask === 'area',
          ask === 'BC' || ask === 'DE' || ask === 'DB' ? { AD, AB: AD + DB, DE } : undefined,
          ask === 'EC' ? { AD, AB: AD + DB, AC: AE + EC } : undefined,
        ),
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    const results: number[] = [];
    const AB = p.AD + (p.DB ?? 0);
    const alphas = p.ask === 'BC' || p.ask === 'DB' ? alphasFor(p.AD, p.DE!) : p.ask === 'DE' ? alphasFor(AB, p.BC!) : [38, 55, 71];
    for (const alpha of alphas) {
      let v: number | null = null;
      if (p.ask === 'BC') {
        const g = buildDE(alpha, p.AD, p.AD + p.DB!, p.DE!);
        if (g) v = dist(g.B, g.C);
      } else if (p.ask === 'DE') {
        // C on ray 2 with |BC| given, then E from the parallel through D
        const ab = p.AD + p.DB!;
        const u2 = dir(alpha);
        const proj = ab * u2[0];
        const t = proj + Math.sqrt(p.BC! * p.BC! - ab * ab + proj * proj);
        const C = mul(u2, t);
        const E = intersect([p.AD, 0], sub(C, [ab, 0]), [0, 0], u2);
        v = dist([p.AD, 0], E);
      } else if (p.ask === 'DB') {
        const ab = bisect((x) => {
          const g = buildDE(alpha, p.AD, x, p.DE!);
          return g ? dist(g.B, g.C) - p.BC! : -1;
        }, p.AD, 100 * p.AD);
        v = ab - p.AD;
      } else if (p.ask === 'EC') {
        const u2 = dir(alpha);
        const E = mul(u2, p.AE!);
        const C = intersect([p.AD + p.DB!, 0], sub(E, [p.AD, 0]), [0, 0], u2);
        v = dist(E, C);
      } else {
        const u2 = dir(alpha);
        const t = bisect((x) => shoelace([[0, 0], [p.AD, 0], mul(u2, x)]) - p.S!, 0, 1e4);
        const E = mul(u2, t);
        const B: Pt = [p.AD + p.DB!, 0];
        const C = intersect(B, sub(E, [p.AD, 0]), [0, 0], u2);
        v = shoelace([[p.AD, 0], B, C, E]);
      }
      if (v === null || !Number.isFinite(v)) return 'construction failed';
      results.push(v);
    }
    if (results.some((r) => Math.abs(r - results[0]) > 1e-6)) return 'answer depends on the shape';
    return Math.abs(q.answer.toNumber() - results[0]) < 1e-6 ? null : `expected ${results[0]}`;
  },
};

/* ================================================================== 2. Area and perimeter ratios (QC) */

type ARKind = 'trapezoid' | 'given-area' | 'two-sides' | 'perimeter' | 'range';
interface ARParams {
  kind: ARKind;
  p?: number;
  q?: number;
  a?: number;
  b?: number;
  S?: number;
  N?: number;
  extra?: 'none' | 'angle' | 'third';
  ratio?: number;
  mult?: number;
  swap?: boolean;
}

/** Two triangles that look similar (ABC large on the left, DEF small on the right). */
function twoTriangles(k: number, names: [string, string, string, string, string, string], labels: Record<string, string> = {}): GeometryFigure {
  const [nA, nB, nC, nD, nE, nF] = names;
  const A0: Pt = [1.3, 2.6];
  const B0: Pt = [0, 0];
  const C0: Pt = [3.4, 0];
  const kk = Math.min(1.8, Math.max(0.55, k));
  const sA = kk > 1 ? 1 / kk : 1;
  const sD = kk > 1 ? 1 : kk;
  const A = mul(A0, sA);
  const B = mul(B0, sA);
  const C = mul(C0, sA);
  const off: Pt = [3.4 * sA + 1.5, 0];
  const D = add(off, mul(A0, sD));
  const E = add(off, mul(B0, sD));
  const F = add(off, mul(C0, sD));
  const fb = new FigBuilder().pt(nA, A).pt(nB, B).pt(nC, C).pt(nD, D).pt(nE, E).pt(nF, F).poly(nA, nB, nC).poly(nD, nE, nF);
  for (const [seg, tex] of Object.entries(labels)) {
    const [x, y, away] = seg.split('');
    const map: Record<string, string> = { a: nA, b: nB, c: nC, d: nD, e: nE, f: nF };
    fb.side(map[x], map[y], map[away], tex, 12);
  }
  // a ratio outside the drawable range is clamped: then the picture is not to scale
  return fb.build(kk !== k);
}

const areaRatioQC: Template<ARParams> = {
  id: 'geo.similarity.area-ratio-qc',
  skill: SKILL,
  format: 'qc',
  style: 'areas and perimeters of similar figures',
  generate(rng, d) {
    const kind: ARKind = rng.pick(
      d === 1
        ? (['given-area', 'perimeter', 'trapezoid'] as const)
        : d === 2
          ? (['trapezoid', 'given-area', 'perimeter', 'two-sides', 'range'] as const)
          : (['trapezoid', 'two-sides', 'given-area', 'perimeter', 'range', 'range'] as const),
    );
    if (kind === 'trapezoid') {
      const [p, q] = rng.pick([
        [3, 1],
        [5, 2],
        [4, 1],
        [2, 1],
        [1, 1],
        [3, 2],
        [5, 3],
        [7, 3],
        [7, 2],
      ] as [number, number][]);
      const n = p + q;
      const tri = p * p;
      const quad = n * n - p * p;
      const answer: QCChoice = tri > quad ? 'A' : 'B';
      const linear: QCChoice = p > q ? 'A' : p < q ? 'B' : 'C';
      return {
        params: { kind, p, q },
        q: {
          format: 'qc',
          info: `In triangle $ABC$, $DE \\parallel BC$, $AD = ${p}$, and $DB = ${q}$.`,
          figure: dePic(p / n, {}),
          quantityA: 'The area of triangle $ADE$',
          quantityB: 'The area of quadrilateral $DBCE$',
          answer,
          traps: qcTraps(answer, { [linear]: 'geo-sim-linear-area' }),
          explanation: `Triangle $ADE$ is similar to triangle $ABC$ with side ratio $\\frac{AD}{AB} = \\frac{${p}}{${n}}$, so its area is $\\left(\\frac{${p}}{${n}}\\right)^2 = \\frac{${tri}}{${n * n}}$ of the area of $ABC$. The quadrilateral gets the rest: $\\frac{${quad}}{${n * n}}$.

Since $${tri} ${tri > quad ? '>' : '<'} ${quad}$, ${QC_SAY[answer]}. (${answer})

Areas do not split in the ratio $${p} : ${q}$ of the sides: they scale with the square of the ratio of the whole triangles.`,
        },
      };
    }
    if (kind === 'given-area') {
      const a = rng.int(2, 8);
      let b = rng.int(2, 10);
      while (b === a) b = rng.int(2, 10);
      const m = rng.int(1, 4);
      const S = a * a * m;
      const area2 = b * b * m;
      const lin = (S * b) / a;
      const N = Number.isInteger(lin) && rng.chance(0.4) ? lin : area2 + rng.pick([0, 0, -m, m, 2 * m]);
      const answer: QCChoice = area2 > N ? 'A' : area2 < N ? 'B' : 'C';
      const linAns: QCChoice = lin > N ? 'A' : lin < N ? 'B' : 'C';
      return {
        params: { kind, a, b, S, N },
        q: {
          format: 'qc',
          info: `Triangle $ABC$ is similar to triangle $DEF$, with $AB = ${a}$ and $DE = ${b}$ corresponding sides. The area of triangle $ABC$ is $${S}$.`,
          figure: twoTriangles(b / a, ['A', 'B', 'C', 'D', 'E', 'F'], { abc: `$${a}$`, def: `$${b}$` }),
          quantityA: 'The area of triangle $DEF$',
          quantityB: `$${N}$`,
          answer,
          traps: qcTraps(answer, { [linAns]: 'geo-sim-linear-area' }),
          explanation: `The scale factor from $ABC$ to $DEF$ is $\\frac{${b}}{${a}}$, so areas are multiplied by $\\left(\\frac{${b}}{${a}}\\right)^2 = \\frac{${b * b}}{${a * a}}$.

Area of $DEF = ${S} \\cdot \\frac{${b * b}}{${a * a}} = ${area2}$. Compared with $${N}$: ${QC_SAY[answer]}. (${answer})

Multiplying the area by $\\frac{${b}}{${a}}$ only (giving $${dec(new Frac(S * b, a))}$) is the trap.`,
        },
      };
    }
    if (kind === 'perimeter') {
      const k = rng.int(2, 5);
      const ratio = k * k;
      const mult = rng.pick([k, k, ratio, k - 1, k + 1]);
      const answer: QCChoice = k > mult ? 'A' : k < mult ? 'B' : 'C';
      const linAns: QCChoice = ratio > mult ? 'A' : ratio < mult ? 'B' : 'C';
      const swap = rng.chance(0.3);
      const qa = 'The perimeter of triangle $PQR$';
      const qb = `$${mult}$ times the perimeter of triangle $STU$`;
      const ans: QCChoice = swap ? (answer === 'A' ? 'B' : answer === 'B' ? 'A' : 'C') : answer;
      const lin: QCChoice = swap ? (linAns === 'A' ? 'B' : linAns === 'B' ? 'A' : 'C') : linAns;
      return {
        params: { kind, ratio, mult, swap },
        q: {
          format: 'qc',
          info: `Triangle $PQR$ is similar to triangle $STU$, and the area of triangle $PQR$ is $${ratio}$ times the area of triangle $STU$.`,
          figure: twoTriangles(1 / k, ['P', 'Q', 'R', 'S', 'T', 'U']),
          quantityA: swap ? qb : qa,
          quantityB: swap ? qa : qb,
          answer: ans,
          traps: qcTraps(ans, { [lin]: 'geo-sim-perimeter-squared' }),
          explanation: `If the area ratio is $${ratio}$, the scale factor for lengths is $\\sqrt{${ratio}} = ${k}$. Perimeters are lengths, so the perimeter of $PQR$ is exactly $${k}$ times the perimeter of $STU$.

Compared with $${mult}$ times: ${QC_SAY[ans]}. (${ans})

Perimeters scale like sides ($${k}$), not like areas ($${ratio}$).`,
        },
      };
    }
    if (kind === 'range') {
      // the scale factor is only known to lie between two whole numbers: the area of DEF lies in an interval
      const k1 = rng.int(2, 4);
      const k2 = k1 + 1;
      const m = rng.int(1, 4);
      const S = k1 * k1 * k2 * k2 * m;
      const lo = k1 * k1 * m;
      const hi = k2 * k2 * m;
      const which = rng.pick(['A', 'D', 'D', 'B'] as const);
      const N = which === 'A' ? Math.max(1, lo - rng.int(0, 2)) : which === 'B' ? hi + rng.int(0, 3) : rng.int(lo + 1, hi - 1);
      const answer: QCChoice = N <= lo ? 'A' : N >= hi ? 'B' : 'D';
      return {
        params: { kind, a: k1, b: k2, S, N },
        q: {
          format: 'qc',
          info: `Triangle $ABC$ is similar to triangle $DEF$, and the area of triangle $ABC$ is $${S}$. The ratio of the length of $AB$ to the length of the corresponding side $DE$ is greater than $${k1}$ and less than $${k2}$.`,
          figure: { ...twoTriangles(1 / ((k1 + k2) / 2), ['A', 'B', 'C', 'D', 'E', 'F']), notToScale: true },
          quantityA: 'The area of triangle $DEF$',
          quantityB: `$${N}$`,
          answer,
          traps: qcTraps(answer, answer === 'D' ? { A: 'geo-sim-linear-area', B: 'geo-sim-linear-area' } : { D: 'geo-fig-gave-up' }),
          explanation: `If the ratio of lengths is $r$, the areas are in the ratio $r^2$, so the area of $DEF$ is $\\frac{${S}}{r^2}$. Since $${k1} < r < ${k2}$, we have $${k1 * k1} < r^2 < ${k2 * k2}$, and the area of $DEF$ lies strictly between $\\frac{${S}}{${k2 * k2}} = ${lo}$ and $\\frac{${S}}{${k1 * k1}} = ${hi}$.

${
            answer === 'A'
              ? `Every possible area is greater than $${lo}$, and $${N} \\le ${lo}$, so Quantity A is greater. (A)`
              : answer === 'B'
                ? `Every possible area is less than $${hi}$, and $${N} \\ge ${hi}$, so Quantity B is greater. (B)`
                : `$${N}$ lies inside that interval: a ratio just above $${k1}$ gives an area just under $${hi}$, which is greater than $${N}$; a ratio just under $${k2}$ gives an area just over $${lo}$, which is less than $${N}$. (D)`
          }

Rule: areas go with the square of the ratio of lengths, so square the ends of the range before comparing.`,
        },
      };
    }
    // two-sides: AB = 2DE and BC = 2EF, with or without the included angle
    const extra: 'none' | 'angle' | 'third' = rng.pick(['none', 'none', 'angle', 'third']);
    const k = rng.int(2, 3);
    const answer: QCChoice = extra === 'none' ? 'D' : 'C';
    const info =
      extra === 'none'
        ? `In triangles $ABC$ and $DEF$, $AB = ${k}DE$ and $BC = ${k}EF$.`
        : extra === 'angle'
          ? `In triangles $ABC$ and $DEF$, $AB = ${k}DE$, $BC = ${k}EF$, and the measure of angle $B$ equals the measure of angle $E$.`
          : `In triangles $ABC$ and $DEF$, $AB = ${k}DE$, $BC = ${k}EF$, and $AC = ${k}DF$.`;
    return {
      params: { kind, extra, ratio: k },
      q: {
        format: 'qc',
        info,
        figure: { ...twoTriangles(1 / k, ['A', 'B', 'C', 'D', 'E', 'F']), ...(extra === 'none' ? { notToScale: true } : {}) },
        quantityA: 'The area of triangle $ABC$',
        quantityB: `$${k * k}$ times the area of triangle $DEF$`,
        answer,
        traps: qcTraps(answer, answer === 'D' ? { C: 'geo-sim-ss-not-similar' } : { D: 'geo-sim-missed-similar', A: 'geo-sim-linear-area' }),
        explanation:
          extra === 'none'
            ? `Two pairs of proportional sides do not make the triangles similar: the angle between those sides is free. If angle $B$ equals angle $E$, the triangles are similar and the area of $ABC$ is exactly $${k * k}$ times the area of $DEF$. But if angle $B$ is $90^\\circ$ while angle $E$ is very small (or very close to $180^\\circ$), the area of $DEF$ is tiny and Quantity A is greater; with the angles the other way round, Quantity B is greater. (D)`
            : `${extra === 'angle' ? 'Two sides in the same ratio with equal included angles' : 'All three pairs of sides in the same ratio'} make the triangles similar, with scale factor $${k}$. Areas scale by $${k}^2 = ${k * k}$, so the two quantities are equal. (C)`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const samples: [number, number][] = [];
    const rnd = mulberry(7 + (p.p ?? 0) * 13 + (p.a ?? 0) * 17 + (p.ratio ?? 0) * 3);
    for (let i = 0; i < 300; i++) {
      if (p.kind === 'trapezoid') {
        const alpha = 15 + 140 * rnd();
        const ab = p.p! + p.q!;
        const C = mul(dir(alpha), 1 + 6 * rnd());
        const D: Pt = [p.p!, 0];
        const B: Pt = [ab, 0];
        const E = intersect(D, sub(C, B), [0, 0], C);
        samples.push([shoelace([[0, 0], D, E]), shoelace([D, B, C, E])]);
      } else if (p.kind === 'given-area') {
        const cx = -5 + 15 * rnd();
        const A: Pt = [0, 0];
        const B: Pt = [p.a!, 0];
        const C: Pt = [cx, (2 * p.S!) / p.a!];
        const f = (P: Pt) => mul(rot(P, 37), p.b! / p.a!);
        samples.push([shoelace([f(A), f(B), f(C)]), p.N!]);
      } else if (p.kind === 'range') {
        const r = p.a! + (1 - 0.0005) * rnd() + 0.0005;
        samples.push([p.S! / (r * r), p.N!]);
      } else if (p.kind === 'perimeter') {
        const S: Pt = [0, 0];
        const T: Pt = [2 + 3 * rnd(), 0];
        const U: Pt = [6 * rnd() - 1, 0.5 + 3 * rnd()];
        const a0 = shoelace([S, T, U]);
        const k = bisect((x) => shoelace([S, T, U].map((P) => mul(P, x))) - p.ratio! * a0, 0, 100);
        const per = (P: Pt[]) => dist(P[0], P[1]) + dist(P[1], P[2]) + dist(P[2], P[0]);
        const big = per([S, T, U].map((P) => mul(P, k)));
        const small = p.mult! * per([S, T, U]);
        samples.push(p.swap ? [small, big] : [big, small]);
      } else {
        const k = p.ratio!;
        const de = 1 + 3 * rnd();
        const ef = 1 + 3 * rnd();
        const angE = 5 + 170 * rnd();
        const angB = p.extra === 'angle' ? angE : 5 + 170 * rnd();
        let triDEF: Pt[];
        let triABC: Pt[];
        if (p.extra === 'third') {
          const df = Math.abs(de - ef) + 0.05 + (de + ef - Math.abs(de - ef) - 0.1) * rnd();
          const F = fromSides([0, 0], [ef, 0], de, df)!;
          triDEF = [[0, 0], [ef, 0], F];
          const A = fromSides([0, 0], [k * ef, 0], k * de, k * df)!;
          triABC = [[0, 0], [k * ef, 0], A];
        } else {
          triDEF = [[0, 0], [ef, 0], mul(dir(angE), de)];
          triABC = [[0, 0], [k * ef, 0], mul(dir(angB), k * de)];
        }
        samples.push([shoelace(triABC), k * k * shoelace(triDEF)]);
      }
    }
    if (p.kind === 'two-sides' && p.extra === 'none') {
      // include the similar case explicitly
      samples.push([1, 1]);
    }
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

/* ================================================================== 3. Scale factors in words: ratios, percents, shadows (MCS) */

type ScaleKind = 'ratio' | 'percent' | 'shadow' | 'lamp';
interface ScaleParams {
  kind: ScaleKind;
  dir?: 'side-to-area' | 'area-to-side';
  p?: number;
  q?: number;
  pct?: number;
  up?: boolean;
  h1?: number;
  s1?: number;
  s2?: number;
  H?: number;
  h?: number;
  dd?: number;
  values: number[];
}

function ratioChoice(rng: Rng, correct: [number, number], wrong: { r: [number, number]; trap?: string }[]) {
  const val = (r: [number, number]) => r[0] / r[1];
  const [a, b] = correct;
  const cands: [number, number][] = [
    [a, 2 * b],
    [2 * a, b],
    [a, 3 * b],
    [3 * a, b],
    [a + b, b],
    [a, a + b],
  ];
  const items = positioned(rng, correct, wrong.map((w) => ({ v: w.r, trap: w.trap })), cands, val);
  return {
    choices: items.map((it) => {
      const g = gcd(it.v[0], it.v[1]);
      return { text: `$${num(it.v[0] / g)}$ to $${num(it.v[1] / g)}$`, ...(it.trap ? { trap: it.trap } : {}) };
    }),
    answer: items.findIndex((it) => it.ok),
    values: items.map((it) => val(it.v)),
  };
}

/** What the explanation says about the wrong choices that are present, by trap id. */
const SCALE_NOTES: Record<string, (vs: string) => string> = {
  'geo-sim-linear-area': (vs) => `scaling an area like a length, ${vs}, forgets that areas grow with the square`,
  'geo-sim-inverted': (vs) => `flipping the ratio, ${vs}, answers the opposite question`,
  'geo-sim-cubed': (vs) => `cubing the ratio, ${vs}, is for volumes`,
  'geo-sim-perimeter-squared': (vs) => `squaring the ratio for a length, ${vs}, produces the ratio of the areas`,
  'geo-sim-double-percent': (vs) => `doubling the percent, ${vs}, forgets the product of the two increases`,
  'geo-sim-ratio-not-change': (vs) => `the new area as a percent of the old one, ${vs}, is not the change`,
  'geo-sim-square-percent': (vs) => `squaring the percent itself, ${vs}, is not the area factor`,
  'geo-sim-additive': (vs) => `adding the difference of the shadows to the height, ${vs}, treats the scale as a shift`,
  'geo-sim-no-divide': (vs) => `multiplying the post's height by the tree's shadow, ${vs}, never divides by the post's shadow`,
  'geo-sim-part-whole': (vs) => `comparing the shadow with the distance to the lamppost instead of the whole base, ${vs}, mixes a part with the whole`,
  'geo-sim-whole-not-part': (vs) => `${vs} is the distance from the lamppost to the tip of the shadow, which includes the part already there`,
};

function scaleCore(rng: Rng, d: Difficulty): { params: ScaleParams; q: QuestionBody } {
    const kind: ScaleKind = rng.pick(d === 1 ? (['shadow', 'ratio'] as const) : d === 2 ? (['ratio', 'percent', 'shadow'] as const) : (['ratio', 'percent', 'lamp', 'lamp'] as const));
    if (kind === 'ratio') {
      // GE-14 style, for similar triangles
      const pairs: [number, number][] = [
        [2, 3],
        [3, 4],
        [3, 5],
        [4, 5],
        [2, 5],
        [5, 6],
        [1, 3],
      ];
      const [p, q] = rng.pick(pairs);
      const flip = rng.chance(0.5);
      const [a, b] = flip ? [q, p] : [p, q];
      const dirn: 'side-to-area' | 'area-to-side' = d === 1 ? 'side-to-area' : rng.pick(['side-to-area', 'area-to-side'] as const);
      let res;
      let stem: string;
      let explanation: string;
      if (dirn === 'side-to-area') {
        res = ratioChoice(rng, [a * a, b * b], [
          { r: [a, b], trap: 'geo-sim-linear-area' },
          { r: [b * b, a * a], trap: 'geo-sim-inverted' },
          { r: [a ** 3, b ** 3], trap: 'geo-sim-cubed' },
        ]);
        stem = `Triangles $T$ and $U$ are similar, and the ratio of the length of each side of $T$ to the length of the corresponding side of $U$ is $${a}$ to $${b}$. What is the ratio of the area of $T$ to the area of $U$?`;
        explanation = `For similar figures, every length scales by $${rt(a, b)}$ and every area by $\\left(${rt(a, b)}\\right)^2 = ${rt(a * a, b * b)}$. So the ratio of the areas is $${a * a}$ to $${b * b}$.`;
      } else {
        res = ratioChoice(rng, [a, b], [
          { r: [a * a, b * b], trap: 'geo-sim-perimeter-squared' },
          { r: [b, a], trap: 'geo-sim-inverted' },
          { r: [b * b, a * a], trap: 'geo-sim-inverted' },
        ]);
        stem = `Triangles $T$ and $U$ are similar, and the ratio of the area of $T$ to the area of $U$ is $${a * a}$ to $${b * b}$. What is the ratio of the perimeter of $T$ to the perimeter of $U$?`;
        explanation = `Areas scale by the square of the scale factor, so the scale factor for lengths is $\\sqrt{${rt(a * a, b * b)}} = ${rt(a, b)}$. Perimeters are lengths, so their ratio is $${a}$ to $${b}$.`;
      }
      return {
        params: { kind, dir: dirn, p: a, q: b, values: res.values },
        q: { format: 'mcs', stem, choices: res.choices, answer: res.answer, explanation },
      };
    }
    if (kind === 'percent') {
      const pct = rng.pick([10, 20, 25, 30, 40, 50]);
      const up = rng.chance(0.65);
      const f = up ? 100 + pct : 100 - pct;
      const areaPct = new Frac(f * f, 100).sub(100).abs(); // percent change of the area
      const { choices, answer, values } = intChoices(
        rng,
        areaPct.toNumber(),
        [
          { value: pct, trap: 'geo-sim-linear-area' },
          { value: 2 * pct, trap: 'geo-sim-double-percent' },
          { value: new Frac(f * f, 100), trap: 'geo-sim-ratio-not-change' },
          { value: new Frac(pct * pct, 100), trap: 'geo-sim-square-percent' },
        ],
        [areaPct.toNumber() + 10, areaPct.toNumber() - 10, 3 * pct],
        (v) => `$${dec(v)}\\%$`,
      );
      const fr = new Frac(f, 100);
      return {
        params: { kind, pct, up, values },
        q: {
          format: 'mcs',
          stem: `Each side of triangle $T$ is ${up ? 'increased' : 'decreased'} by $${pct}$ percent to form triangle $U$. The area of $U$ is how many percent ${up ? 'greater' : 'less'} than the area of $T$?`,
          choices,
          answer,
          explanation: `$U$ is similar to $T$ with scale factor $${decimal(fr)}$, so its area is $${decimal(fr)}^2 = ${decimal(fr.mul(fr))}$ times the area of $T$.

That is ${up ? `an increase of $${decimal(fr.mul(fr))} - 1 = ${decimal(fr.mul(fr).sub(1))}$, or $${dec(areaPct)}\\%$` : `a decrease of $1 - ${decimal(fr.mul(fr))} = ${decimal(new Frac(1).sub(fr.mul(fr)))}$, or $${dec(areaPct)}\\%$`}.`,
        },
      };
    }
    if (kind === 'shadow') {
      for (;;) {
        const h1 = rng.pick([4, 5, 6, 8, 9]);
        const s1 = rng.pick([2, 3, 4, 5, 6, 10, 12]);
        if (h1 === s1) continue;
        const g = gcd(h1, s1);
        const unitS = s1 / g;
        const s2 = unitS * rng.int(2, 9);
        if (s2 <= s1 || s2 > 60) continue;
        const h2 = (h1 * s2) / s1;
        if (!Number.isInteger(h2) || h2 > 120) continue;
        const traps = [
          { value: new Frac(s1 * s2, h1), trap: 'geo-sim-inverted' },
          { value: h1 + s2 - s1, trap: 'geo-sim-additive' },
          { value: new Frac(h1 * s1, s2), trap: 'geo-sim-inverted' },
          { value: h1 * s2, trap: 'geo-sim-no-divide' },
        ].filter((t) => (t.value instanceof Frac ? t.value.isTerminating() : true));
        const { choices, answer, values } = intChoices(rng, h2, traps, [h2 + 2, h2 - 3, h2 + 5, h2 - 5, h2 + 8], (v) => `$${dec(v)}$`);
        // figure: post and tree with their shadows, sun rays dashed
        const sc = 4 / Math.max(h2, s2 + s1 + 6);
        const fb = new FigBuilder();
        const P0 = fb.helper([0, 0]);
        const P1 = fb.helper([0, h1 * sc]);
        const P2 = fb.helper([s1 * sc, 0]);
        const x0 = s1 * sc + 1.4;
        const T0 = fb.helper([x0, 0]);
        const T1 = fb.helper([x0, h2 * sc]);
        const T2 = fb.helper([x0 + s2 * sc, 0]);
        const G = fb.helper([x0 + s2 * sc + 0.4, 0]);
        const G0 = fb.helper([-0.4, 0]);
        fb.seg(G0, G).seg(P0, P1).seg(T0, T1).seg(P1, P2, undefined, true).seg(T1, T2, undefined, true).right(P1, P0, P2).right(T1, T0, T2);
        fb.side(P0, P1, P2, `$${h1}$`, 12).side(P0, P2, P1, `$${s1}$`, 12).side(T0, T2, T1, `$${s2}$`, 12).side(T0, T1, T2, '$h$', 12);
        return {
          params: { kind, h1, s1, s2, values },
          q: {
            format: 'mcs',
            stem: `At a certain time of day, a vertical post $${h1}$ feet tall casts a shadow $${s1}$ feet long, and a nearby vertical tree casts a shadow $${s2}$ feet long, as shown above. What is the height $h$ of the tree, in feet?`,
            figure: fb.build(),
            choices,
            answer,
            explanation: `The sun's rays make the same angle with the ground for both objects, so the two right triangles are similar: height and shadow are in the same ratio.

$$\\frac{h}{${s2}} = \\frac{${h1}}{${s1}} \\quad\\Rightarrow\\quad h = ${s2} \\cdot \\frac{${h1}}{${s1}} = ${h2}$$

Check: the tree's shadow is $${ft(new Frac(s2, s1))}$ times the post's shadow, and so is its height ($${ft(new Frac(s2, s1))} \\times ${h1} = ${h2}$).`,
          },
        };
      }
    }
    // lamp: person of height h at distance dd from a lamp post of height H; shadow length s
    for (;;) {
      const h = rng.pick([5, 6]);
      const m = rng.pick(h === 6 ? [2, 2.5, 3, 4] : [2, 3, 4]);
      const H = h * m;
      const dd = rng.int(2, 8) * (m === 2.5 ? 3 : 2);
      const s = new Frac(h * dd * 2, (H - h) * 2);
      if (!s.isTerminating() || s.toNumber() > 30) continue;
      const traps = [
        { value: new Frac(h * dd, H), trap: 'geo-sim-part-whole' },
        { value: new Frac(dd * (H - h), h), trap: 'geo-sim-inverted' },
        { value: s.add(dd), trap: 'geo-sim-whole-not-part' },
        { value: new Frac(dd * H, h), trap: 'geo-sim-inverted' },
      ].filter((t) => t.value.isTerminating());
      const { choices, answer, values } = intChoices(rng, s.toNumber(), traps, [s.add(2), s.sub(2), Frac.of(dd), s.add(1), s.sub(1)], (v) => `$${dec(v)}$`);
      const sc = 4 / (dd + s.toNumber());
      const fb = new FigBuilder();
      const L0 = fb.helper([0, 0]);
      fb.pt('L', [0, H * sc * 0.75], [-1, 0]);
      const P0 = fb.helper([dd * sc, 0]);
      fb.pt('P', [dd * sc, h * sc * 0.75], [0.3, 1]);
      const X = fb.helper([(dd + s.toNumber()) * sc, 0]);
      const G = fb.helper([(dd + s.toNumber()) * sc + 0.4, 0]);
      fb.seg(L0, G).seg(L0, 'L').seg(P0, 'P').seg('L', X, undefined, true).right('L', L0, P0).right('P', P0, X);
      fb.side(L0, P0, 'L', `$${dd}$`, 12).side(P0, X, 'P', '$s$', 12);
      return {
        params: { kind, H, h, dd, values },
        q: {
          format: 'mcs',
          stem: `A person $${h}$ feet tall stands $${dd}$ feet from the base of a lamppost that is $${H}$ feet tall, as shown above. The light at the top of the lamppost, $L$, makes the person cast a shadow of length $s$ feet on level ground. What is the value of $s$?`,
          figure: fb.build(),
          choices,
          answer,
          explanation: `The ray from $L$ over the top of the person, $P$, forms two similar right triangles that share the angle at the tip of the shadow: the small one (person, shadow $s$) and the large one (lamppost, base $${dd} + s$).

$$\\frac{s}{${h}} = \\frac{${dd} + s}{${H}} \\quad\\Rightarrow\\quad ${H}s = ${h * dd} + ${h}s \\quad\\Rightarrow\\quad s = \\frac{${h * dd}}{${H - h}} = ${dec(s)}$$

The base of the large triangle is $${dd} + s$, not $${dd}$.

Check: the person is $${ft(new Frac(h, H))}$ of the lamppost's height; the shadow is the same fraction of the distance from the lamppost to the tip of the shadow, $${dec(s.add(dd))}$.`,
        },
      };
    }
}

const scaleMCS: Template<ScaleParams> = {
  id: 'geo.similarity.scale-mcs',
  skill: SKILL,
  format: 'mcs',
  style: 'scale factors in words: ratio of areas, percent change, shadows',
  generate(rng, d) {
    const res = scaleCore(rng, d);
    const q = res.q;
    if (q.format === 'mcs') {
      const notes = trapNotes(q.choices, SCALE_NOTES);
      if (notes) q.explanation += `\n\n${notes}`;
    }
    return res;
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    let target: number;
    if (p.kind === 'ratio') {
      const T: Pt[] = [
        [0, 0],
        [3, 0],
        [1, 2],
      ];
      const U = T.map((P) => mul(rot(P, 50), p.q! / p.p!));
      const per = (X: Pt[]) => dist(X[0], X[1]) + dist(X[1], X[2]) + dist(X[2], X[0]);
      target = p.dir === 'side-to-area' ? shoelace(T) / shoelace(U) : per(T) / per(U);
    } else if (p.kind === 'percent') {
      const T: Pt[] = [
        [0, 0],
        [4, 0],
        [1, 3],
      ];
      const f = p.up ? 1 + p.pct! / 100 : 1 - p.pct! / 100;
      target = (Math.abs(shoelace(T.map((P) => mul(P, f))) - shoelace(T)) / shoelace(T)) * 100;
    } else if (p.kind === 'shadow') {
      // the tree's top lies on the line through the tip of its shadow parallel to the post's sun ray
      const ray = sub([0, p.h1!], [p.s1!, 0]);
      const top = intersect([100 + p.s2!, 0], ray, [100, 0], [0, 1]);
      target = top[1];
    } else {
      const X = intersect([0, p.H!], sub([p.dd!, p.h!], [0, p.H!]), [0, 0], [1, 0]);
      target = X[0] - p.dd!;
    }
    return checkMcs(q.answer, p.values, target);
  },
};

/* ================================================================== 4. Which statements must be true (MCM) */

type StKey = 'BC' | 'AE/EC' | 'angle' | 'area' | 'perimeter' | 'AD/DB';
interface StmtParams {
  AD: number;
  DB: number;
  DE: number;
  stmts: { key: StKey; truth: boolean }[];
}

const statementsMCM: Template<StmtParams> = {
  id: 'geo.similarity.statements-mcm',
  skill: SKILL,
  format: 'mcm',
  style: 'which statements about a triangle cut by a parallel segment must be true',
  generate(rng, d) {
    const [p, q] = rng.pick(RATIOS.filter(([a, b]) => a !== b));
    const n = p + q;
    const k1 = rng.int(1, 3);
    const k2 = rng.int(Math.max(1, k1 - 1), k1 + 2);
    const AD = p * k1;
    const DB = q * k1;
    const DE = p * k2;
    const BC = n * k2;
    // equal numbers on the figure (DE = AD...) would hand out shortcuts
    if (new Set([AD, DB, DE]).size < 3 || [AD, DB, DE].includes(BC)) throw new Redraw('equal lengths hand out a shortcut');
    const keys: StKey[] = rng.shuffle(['BC', 'AE/EC', 'angle', 'area', 'perimeter', 'AD/DB'] as StKey[]).slice(0, d === 1 ? 4 : d === 2 ? 5 : 6);
    let stmts = keys.map((key) => ({ key, truth: rng.chance(0.5) }));
    if (stmts.every((s) => s.truth)) stmts[0].truth = false;
    if (stmts.every((s) => !s.truth)) stmts[1].truth = true;
    const wrongBC = new Frac(DE * DB, AD);
    stmts = stmts.filter((s) => !(s.key === 'BC' && !s.truth && (wrongBC.eq(BC) || !wrongBC.isTerminating())));
    const text = (s: { key: StKey; truth: boolean }): { t: string; trap?: string } => {
      switch (s.key) {
        case 'BC':
          return s.truth ? { t: `$BC = ${BC}$` } : { t: `$BC = ${dec(wrongBC)}$`, trap: 'geo-sim-part-whole' };
        case 'AE/EC':
          return s.truth ? { t: `$\\dfrac{AE}{EC} = ${ft(new Frac(p, q))}$` } : { t: `$\\dfrac{AE}{EC} = ${ft(new Frac(p, n))}$`, trap: 'geo-sim-part-whole' };
        case 'angle':
          return s.truth ? { t: 'The measure of angle $ADE$ equals the measure of angle $ABC$.' } : { t: 'The measure of angle $ADE$ equals the measure of angle $ACB$.', trap: 'geo-sim-correspondence' };
        case 'area':
          return s.truth
            ? { t: `The area of triangle $ADE$ is $${ft(new Frac(p * p, n * n))}$ of the area of triangle $ABC$.` }
            : { t: `The area of triangle $ADE$ is $${ft(new Frac(p, n))}$ of the area of triangle $ABC$.`, trap: 'geo-sim-linear-area' };
        case 'perimeter':
          return s.truth
            ? { t: `The perimeter of triangle $ADE$ is $${ft(new Frac(p, n))}$ of the perimeter of triangle $ABC$.` }
            : { t: `The perimeter of triangle $ADE$ is $${ft(new Frac(p * p, n * n))}$ of the perimeter of triangle $ABC$.`, trap: 'geo-sim-perimeter-squared' };
        case 'AD/DB':
          return s.truth ? { t: '$\\dfrac{AD}{AB} = \\dfrac{DE}{BC}$' } : { t: '$\\dfrac{AD}{DB} = \\dfrac{DE}{BC}$', trap: 'geo-sim-part-whole' };
      }
    };
    const { choices, answer } = flaggedChoices(stmts.map((s) => ({ text: text(s).t, correct: s.truth, ...(text(s).trap ? { trap: text(s).trap } : {}) })));
    const why: Record<StKey, string> = {
      BC: `$\\frac{BC}{DE} = \\frac{AB}{AD} = ${rt(AD + DB, AD)}$, so $BC = ${BC}$`,
      'AE/EC': `the parallel segment splits $AC$ in the same ratio as $AB$: $\\frac{AE}{EC} = \\frac{AD}{DB} = ${ft(new Frac(p, q))}$ (it is $\\frac{AE}{AC}$ that equals $${ft(new Frac(p, n))}$)`,
      angle: 'angle $ADE$ corresponds to angle $ABC$ (corresponding angles at parallel lines); it equals angle $ACB$ only if the triangle happens to be isosceles',
      area: `areas scale by the square of $${ft(new Frac(p, n))}$, which is $${ft(new Frac(p * p, n * n))}$`,
      perimeter: `perimeters are lengths, so they scale by $${ft(new Frac(p, n))}$ itself`,
      'AD/DB': 'corresponding sides compare a part of $AB$ with the whole $AB$; $\\frac{AD}{DB}$ compares two parts',
    };
    return {
      params: { AD, DB, DE, stmts },
      q: {
        format: 'mcm',
        stem: `In the figure above, $DE$ is parallel to $BC$, $AD = ${AD}$, $DB = ${DB}$, and $DE = ${DE}$. Which of the following statements must be true?`,
        instruction: 'Indicate all such statements.',
        figure: dePic(p / n, { AD: `$${AD}$`, DB: `$${DB}$`, DE: `$${DE}$` }, false, { AD, AB: AD + DB, DE }),
        choices,
        answer,
        explanation: `Because $DE \\parallel BC$, triangle $ADE$ is similar to triangle $ABC$ with scale factor $\\frac{AD}{AB} = \\frac{${AD}}{${AD + DB}}${gcd(AD, AD + DB) > 1 ? ` = ${ft(new Frac(p, n))}` : ''}$.

${stmts.map((s) => `- ${text(s).t.replace(/\.$/, '')}: ${why[s.key]} ${s.truth ? '✓' : '✗'}`).join('\n')}`,
      },
    };
  },
  check(q, { AD, DB, DE, stmts }) {
    if (q.format !== 'mcm') return 'format';
    const holds = (key: StKey, truth: boolean, g: NonNullable<ReturnType<typeof buildDE>>) => {
      const AB = AD + DB;
      const AE = dist(g.A, g.E);
      const EC = dist(g.E, g.C);
      const per = (X: Pt[]) => dist(X[0], X[1]) + dist(X[1], X[2]) + dist(X[2], X[0]);
      const ar = shoelace([g.A, g.D, g.E]) / shoelace([g.A, g.B, g.C]);
      const pr = per([g.A, g.D, g.E]) / per([g.A, g.B, g.C]);
      const r = AD / AB;
      switch (key) {
        case 'BC':
          return near(dist(g.B, g.C), truth ? (DE * AB) / AD : (DE * DB) / AD);
        case 'AE/EC':
          return truth ? near(AE / EC, AD / DB) : near(AE / EC, AD / AB);
        case 'angle':
          return near(angleAt(g.D, g.A, g.E), truth ? angleAt(g.B, g.A, g.C) : angleAt(g.C, g.A, g.B));
        case 'area':
          return near(ar, truth ? r * r : r);
        case 'perimeter':
          return near(pr, truth ? r : r * r);
        case 'AD/DB':
          return near(truth ? AD / AB : AD / DB, DE / dist(g.B, g.C));
      }
    };
    const shapes = alphasFor(AD, DE)
      .map((a) => buildDE(a, AD, AD + DB, DE))
      .filter((g): g is NonNullable<typeof g> => g !== null);
    if (shapes.length < 3) return 'could not build shapes';
    const expected = stmts.flatMap((s, i) => (shapes.every((g) => holds(s.key, s.truth, g)) ? [i] : []));
    return checkMcm(q.answer, expected);
  },
};

export const similarTemplates = retryAll([parallelSegment, areaRatioQC, scaleMCS, statementsMCM]);
