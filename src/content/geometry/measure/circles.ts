import { qcCompare, qcFromSamples, QC_TEXT } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num, plain } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { angleAt, dist, pathLength, shoelace, unitCircle } from './ex';
import { arcPts, Fig, onCircle, type P2 } from './fig';
import { noClash, Redraw, retryAll } from '../redraw';
import { trapNotes } from '../notes';
import { positioned } from '../shapes/util';

const deg = (v: number | string) => `${v}^\\circ`;
const relText = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');
const piTex = (k: Frac) => (k.eq(1) ? '\\pi' : k.isInt() ? `${num(k.n)}\\pi` : `${k.toDecimalString()}\\pi`);
const kTex = (k: Frac) => (k.isInt() ? num(k.n) : k.toDecimalString());

/** Compare with a relative tolerance (numeric checks built from polygon approximations). */
function cmpTol(a: number, b: number, tol = 1e-5): QCChoice {
  if (Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))) return 'C';
  return a > b ? 'A' : 'B';
}

/** Bisection for an increasing function f on [lo, hi]: x with f(x) = target. */
function solveUp(f: (x: number) => number, target: number, lo: number, hi: number, iters = 100): number {
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Point of tangency from external point P to the circle (center O, radius r), found numerically. */
function tangentPoint(O: P2, r: number, P: P2): P2 {
  const base = Math.atan2(P[1] - O[1], P[0] - O[0]);
  // On the arc from the direction of P (dot > 0) to 90° away (dot < 0), OA·AP changes sign once.
  const f = (t: number) => {
    const A = onCircle(O, r, ((base + t) * 180) / Math.PI);
    return -((A[0] - O[0]) * (P[0] - A[0]) + (A[1] - O[1]) * (P[1] - A[1]));
  };
  const t = solveUp(f, 0, 0, Math.PI / 2);
  return onCircle(O, r, ((base + t) * 180) / Math.PI);
}

/* ================================================================== 1. Ratios of circle measures (MCS) */

interface RatioParams {
  mode: 'radius-area' | 'radius-circ' | 'area-circ' | 'circ-area' | 'diameter-area';
  a: number;
  b: number;
  ratios: [number, number][];
}

/** What the explanation says about the wrong choices that are present, by trap id. */
const RATIO_NOTES: Record<string, (vs: string) => string> = {
  'geom-circle-ratio-inverted': (vs) => `reversing the order, ${vs}, answers "B to A" instead of "A to B"`,
  'geom-circle-ratio-linear': (vs) => `the ratio of the lengths, ${vs}, forgets that areas use the square`,
  'geom-circle-ratio-squared': (vs) => `squaring the ratio for a length, ${vs}, gives the ratio of the areas`,
  'geom-circle-ratio-cubed': (vs) => `cubing the ratio, ${vs}, is for volumes`,
  'geom-circle-radius-diameter': (vs) => `mixing up radius and diameter, ${vs}, doubles one side of the ratio`,
};

const ratio: Template<RatioParams> = {
  id: 'geo.circles.ratio',
  skill: 'geo.circles',
  format: 'mcs',
  style: 'ratio of two circles’ areas or circumferences',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1
        ? (['radius-area', 'radius-circ', 'radius-area'] as const)
        : d === 2
          ? (['radius-area', 'area-circ', 'circ-area'] as const)
          : (['area-circ', 'circ-area', 'diameter-area'] as const),
    );
    let p: number;
    let q: number;
    do {
      p = rng.int(1, d === 1 ? 5 : 7);
      q = rng.int(2, d === 1 ? 6 : 9);
    } while (p === q || gcd(p, q) !== 1);
    const red = ([x, y]: [number, number]): [number, number] => {
      const g = gcd(x, y);
      return [x / g, y / g];
    };
    let correct: [number, number];
    const wrong: { r: [number, number]; trap?: string }[] = [];
    let stem: string;
    let explanation: string;
    let a = 0;
    let b = 0;
    if (mode === 'radius-area' || mode === 'radius-circ') {
      // r_A = r, r_B = (p/q) r
      const areas = mode === 'radius-area';
      a = q;
      b = p;
      correct = areas ? [q * q, p * p] : [q, p];
      if (areas) {
        wrong.push({ r: [p * p, q * q], trap: 'geom-circle-ratio-inverted' }, { r: [q, p], trap: 'geom-circle-ratio-linear' }, { r: [p, q], trap: 'geom-circle-ratio-linear' }, { r: [q ** 3, p ** 3], trap: 'geom-circle-ratio-cubed' });
      } else {
        wrong.push({ r: [p, q], trap: 'geom-circle-ratio-inverted' }, { r: [q * q, p * p], trap: 'geom-circle-ratio-squared' }, { r: [p * p, q * q], trap: 'geom-circle-ratio-squared' }, { r: [2 * q, p], trap: 'geom-circle-radius-diameter' });
      }
      const rB = frac(p, q).toTex();
      stem = `Circle $A$ has radius $r$, and circle $B$ has radius $${rB}r$. What is the ratio of the ${areas ? 'area' : 'circumference'} of $A$ to that of $B$?`;
      explanation = areas
        ? `Area is $\\pi r^2$, so the ratio is $\\dfrac{\\pi r^2}{\\pi \\left(${rB}r\\right)^2} = \\dfrac{1}{${frac(p * p, q * q).toTex()}} = ${frac(q * q, p * p).toTex({ dfrac: true })}$, that is, ${q * q} to ${p * p}.

The radii are in the ratio ${q} to ${p}, and areas use the SQUARE of that ratio. Keep the order: circle $A$ first.`
        : `Circumference is $2\\pi r$, a length, so it scales like the radius: $\\dfrac{2\\pi r}{2\\pi \\cdot ${rB}r} = ${frac(q, p).toTex({ dfrac: true })}$, that is, ${q} to ${p}. Keep the order: circle $A$ first.`;
    } else if (mode === 'area-circ') {
      // areas (p^2) pi and (q^2) pi -> circumferences p : q
      a = p * p;
      b = q * q;
      correct = [p, q];
      wrong.push({ r: [p * p, q * q], trap: 'geom-circle-ratio-squared' }, { r: [q, p], trap: 'geom-circle-ratio-inverted' }, { r: [q * q, p * p], trap: 'geom-circle-ratio-inverted' }, { r: [2 * p, q], trap: 'geom-circle-radius-diameter' });
      stem = `Circle $W$ has area $${piTex(new Frac(p * p))}$, and circle $Z$ has area $${piTex(new Frac(q * q))}$. What is the ratio of the circumference of $W$ to that of $Z$?`;
      explanation = `From $\\pi r^2 = ${piTex(new Frac(p * p))}$ the radius of $W$ is ${p}; from $\\pi r^2 = ${piTex(new Frac(q * q))}$ the radius of $Z$ is ${q}.

Circumferences are $2\\pi \\cdot ${p}$ and $2\\pi \\cdot ${q}$, in the ratio ${p} to ${q}. Lengths are in the ratio of the square roots of the areas.`;
    } else if (mode === 'circ-area') {
      a = 2 * p;
      b = 2 * q;
      correct = [p * p, q * q];
      wrong.push({ r: [p, q], trap: 'geom-circle-ratio-linear' }, { r: [q * q, p * p], trap: 'geom-circle-ratio-inverted' }, { r: [q, p], trap: 'geom-circle-ratio-inverted' }, { r: [2 * p * p, q * q], trap: 'geom-circle-radius-diameter' });
      stem = `The circumference of circle $W$ is $${piTex(new Frac(2 * p))}$, and the circumference of circle $Z$ is $${piTex(new Frac(2 * q))}$. What is the ratio of the area of $W$ to that of $Z$?`;
      explanation = `From $2\\pi r = ${piTex(new Frac(2 * p))}$ the radius of $W$ is ${p}; from $2\\pi r = ${piTex(new Frac(2 * q))}$ the radius of $Z$ is ${q}.

The areas are $${piTex(new Frac(p * p))}$ and $${piTex(new Frac(q * q))}$, in the ratio ${p * p} to ${q * q}. Areas use the square of the ratio of the lengths.`;
    } else {
      // diameter of A = p * radius of B  ->  r_A = (p/2) r_B, areas p^2 : 4
      p = rng.pick([1, 3, 5, 3, 5, 7]);
      a = p;
      correct = red([p * p, 4]);
      wrong.push({ r: [p * p, 1], trap: 'geom-circle-radius-diameter' }, { r: red([p, 2]), trap: 'geom-circle-ratio-linear' }, { r: red([4, p * p]), trap: 'geom-circle-ratio-inverted' }, { r: [p, 1], trap: 'geom-circle-ratio-linear' }, { r: [1, p * p], trap: 'geom-circle-ratio-inverted' });
      stem = `The diameter of circle $A$ is ${p === 1 ? 'equal to' : `${p} times`} the radius of circle $B$. What is the ratio of the area of $A$ to that of $B$?`;
      explanation = `Let the radius of $B$ be $r$. The diameter of $A$ is $${p === 1 ? '' : p}r$, so its radius is $${frac(p, 2).toTex()}r$.

Ratio of areas: $\\dfrac{\\pi \\left(${frac(p, 2).toTex()}r\\right)^2}{\\pi r^2} = ${frac(p * p, 4).toTex({ dfrac: true })}$, that is, ${correct[0]} to ${correct[1]}.

The diameter is twice the radius, so $${p === 1 ? '' : p}r$ is the diameter of $A$, not its radius.`;
    }
    correct = red(correct);
    const txt = (r: [number, number]) => `${plain(r[0])} to ${plain(r[1])}`;
    const [x0, y0] = correct;
    const generic: [number, number][] = [
      [2 * x0, y0],
      [x0, 2 * y0],
      [3 * x0, y0],
      [x0, 3 * y0],
    ];
    const items = positioned<[number, number]>(
      rng,
      correct,
      wrong.map((w) => ({ v: red(w.r), trap: w.trap })),
      rng.shuffle(generic).map(red),
      (r) => r[0] / r[1],
    );
    const choices = items.map((it) => ({ text: txt(it.v), ...(it.trap ? { trap: it.trap } : {}) }));
    const answer = items.findIndex((it) => it.ok);
    const notes = trapNotes(choices, RATIO_NOTES);
    return {
      params: { mode, a, b, ratios: items.map((it) => it.v) },
      q: { format: 'mcs', stem, choices, answer, explanation: notes ? `${explanation}\n\n${notes}` : explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // Build both circles numerically and measure them with 4000-gons.
    let rA: number;
    let rB: number;
    let measure: 'area' | 'circ';
    if (p.mode === 'radius-area' || p.mode === 'radius-circ') {
      rA = 1.7;
      rB = (1.7 * p.b) / p.a;
      measure = p.mode === 'radius-area' ? 'area' : 'circ';
    } else if (p.mode === 'area-circ' || p.mode === 'circ-area') {
      // Polygon measures scale like r^2 (area) and r (perimeter): invert from the unit 4000-gon.
      const unit = unitCircle();
      const inv = p.mode === 'area-circ' ? (v: number) => Math.sqrt(v / unit.area) : (v: number) => v / unit.perim;
      rA = inv(p.a * Math.PI);
      rB = inv(p.b * Math.PI);
      measure = p.mode === 'area-circ' ? 'circ' : 'area';
    } else {
      rB = 2.3;
      rA = (p.a * rB) / 2;
      measure = 'area';
    }
    const m = (r: number) => (measure === 'area' ? r * r * unitCircle().area : r * unitCircle().perim);
    const target = m(rA) / m(rB);
    const hits = p.ratios.flatMap(([x, y], i) => (Math.abs(x / y - target) < 1e-4 * Math.max(1, target) ? [i] : []));
    if (hits.length !== 1) return `${hits.length} choices match ${target}`;
    return hits[0] === q.answer ? null : `expected choice ${hits[0]}`;
  },
};

/* ================================================================== 2. Arcs and sectors (NE) */

interface ArcParams {
  ask: 'arc' | 'sector' | 'angle-sector' | 'angle-arc';
  major: boolean;
  r: number;
  O: P2;
  A: P2;
  B: P2;
  C: P2 | null;
  inscribed: boolean;
  given: number;
}

const THETAS = [20, 30, 36, 40, 45, 60, 72, 80, 90, 100, 120, 135, 140, 150, 160];

const arcSector: Template<ArcParams> = {
  id: 'geo.circles.arc-sector',
  skill: 'geo.circles',
  format: 'ne',
  style: 'arc length or sector area from an angle',
  generate(rng, d) {
    const reverse = d === 3 && rng.chance(0.45);
    const askLen = rng.chance(0.45);
    const inscribed = d >= 2 && rng.chance(d === 2 ? 0.4 : 0.5) && !reverse;
    const major = d >= 2 && !inscribed && !reverse && rng.chance(0.45);
    let theta = 0;
    let r = 0;
    let k = new Frac(0);
    for (let tries = 0; ; tries++) {
      theta = rng.pick(inscribed ? THETAS.filter((t) => t % 10 === 0) : THETAS);
      r = rng.int(2, 12);
      const region = major ? 360 - theta : theta;
      k = askLen ? new Frac(region * 2 * r, 360) : new Frac(region * r * r, 360);
      if ([1, 2, 4].includes(k.d) && !k.lt(1)) break;
      if (tries > 500) throw new Error('arcSector: no numbers');
    }
    const region = major ? 360 - theta : theta;
    const O: P2 = [0, 0];
    const rot = rng.int(-30, 30);
    const a0 = rot - theta / 2 - 90 + (rng.chance(0.5) ? 0 : 180);
    const A = onCircle(O, r, a0);
    const B = onCircle(O, r, a0 + theta);
    const C = onCircle(O, r, a0 + theta + (360 - theta) * rng.pick([0.35, 0.5, 0.65]));
    const fig = new Fig();
    fig.pt('O', O).pt('A', A).pt('B', B).circle('O', r);
    const shade = !askLen;
    if (shade) {
      const arc = major ? arcPts(O, r, a0 + theta, a0 + 360) : arcPts(O, r, a0, a0 + theta);
      fig.polyXY([O, ...arc], true);
    }
    fig.seg('O', 'A', `$${r}$`).seg('O', 'B');
    if (inscribed || (major && askLen)) fig.pt('C', C);
    const alpha = theta / 2;
    if (inscribed) {
      fig.seg('C', 'A').seg('C', 'B').angleLabel('A', 'C', 'B', `$${deg(alpha)}$`);
    } else {
      fig.angleLabel('A', 'O', 'B', reverse ? '$x^\\circ$' : `$${deg(theta)}$`);
    }
    const what = askLen ? (major ? 'the length of arc $ACB$' : 'the length of minor arc $AB$') : 'the area of the shaded region';
    const traps: { value: Frac; trap: string }[] = [];
    let stem: string;
    let answer: Frac;
    let explanation: string;
    const full = askLen ? `2\\pi(${r}) = ${piTex(new Frac(2 * r))}` : `\\pi(${r})^2 = ${piTex(new Frac(r * r))}`;
    if (reverse) {
      answer = new Frac(theta);
      // the other formula: sector value read as an arc, or arc read as a sector
      const other = askLen ? k.mul(360).div(r * r) : k.mul(360).div(2 * r);
      if (other.eq(answer)) throw new Redraw('a trap equals the answer');
      if (other.lt(360)) traps.push({ value: other, trap: 'geom-circle-arc-sector-mixed' });
      stem = `In the figure above, $O$ is the center of the circle. If ${what} is $${piTex(k)}$, what is the value of $x$?`;
      explanation = `The whole circle has ${askLen ? 'circumference' : 'area'} $${full}$. The ${askLen ? 'arc' : 'sector'} is the fraction $\\frac{x}{360}$ of it:

$$\\frac{x}{360} \\cdot ${piTex(new Frac(askLen ? 2 * r : r * r))} = ${piTex(k)} \\quad\\Rightarrow\\quad x = 360 \\cdot \\frac{${kTex(k)}}{${askLen ? 2 * r : r * r}} = ${theta}$$

Use the ${askLen ? 'circumference $2\\pi r$ for an arc' : 'area $\\pi r^2$ for a sector'}, not the other formula.`;
    } else {
      answer = k;
      const other = askLen ? new Frac(region * r * r, 360) : new Frac(region * 2 * r, 360);
      traps.push({ value: other, trap: 'geom-circle-arc-sector-mixed' });
      traps.push({ value: new Frac(askLen ? 2 * r : r * r), trap: 'geom-circle-forgot-fraction' });
      if (inscribed) traps.push({ value: askLen ? new Frac(alpha * 2 * r, 360) : new Frac(alpha * r * r, 360), trap: 'geom-circle-inscribed-as-central' });
      if (major) traps.push({ value: askLen ? new Frac(theta * 2 * r, 360) : new Frac(theta * r * r, 360), trap: 'geom-circle-minor-major' });
      stem = `In the figure above, $O$ is the center of the circle. If ${what} is $k\\pi$, what is the value of $k$?`;
      const angleStep = inscribed
        ? `Angle $ACB$ is an inscribed angle of $${deg(alpha)}$, so the central angle $AOB$ on the same arc is twice as large: $${deg(theta)}$.\n\n`
        : major
          ? `The ${askLen ? 'arc $ACB$ goes the long way around' : 'shaded sector is the larger one'}: its central angle is $360^\\circ - ${deg(theta)} = ${deg(region)}$.\n\n`
          : '';
      explanation = `${angleStep}The ${askLen ? 'arc' : 'sector'} is $\\frac{${region}}{360}$ of the whole circle, whose ${askLen ? 'circumference' : 'area'} is $${full}$:

$$\\frac{${region}}{360} \\cdot ${piTex(new Frac(askLen ? 2 * r : r * r))} = ${piTex(k)}, \\quad k = ${kTex(k)}$$

${
  inscribed
    ? `Using the inscribed angle ${alpha}° as if it were the central angle gives half the answer.`
    : major
      ? `Using ${theta}° gives the other (smaller) part of the circle.`
      : `An arc uses the circumference $2\\pi r$; a sector uses the area $\\pi r^2$.`
}`;
    }
    return {
      params: { ask: reverse ? (askLen ? 'angle-arc' : 'angle-sector') : askLen ? 'arc' : 'sector', major, r, O, A, B, C: inscribed || (major && askLen) ? C : null, inscribed, given: reverse ? k.toNumber() : 0 },
      q: {
        format: 'ne',
        stem,
        figure: fig.build(false),
        answer,
        traps: ((): typeof traps => {
          if (traps.some((t) => t.value.eq(answer))) throw new Redraw('a trap equals the answer');
          return traps;
        })(),
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const { O, A, B, r } = p;
    const a0 = (Math.atan2(A[1] - O[1], A[0] - O[0]) * 180) / Math.PI;
    if (p.inscribed && p.C) {
      // The labeled inscribed angle must be what the drawing shows; the central angle is measured, not derived.
      const insc = angleAt(A, p.C, B);
      const central = angleAt(A, O, B);
      if (Math.abs(central - 2 * insc) > 1e-6) return 'figure inconsistent';
    }
    const minor = angleAt(A, O, B);
    const measure = (theta: number) => {
      const pts = arcPts(O, r, a0, a0 + theta, p.ask.startsWith("angle") ? 1 : 0.5);
      return p.ask === 'arc' || p.ask === 'angle-arc' ? pathLength(pts) : shoelace([O, ...pts]);
    };
    if (p.ask === 'angle-arc' || p.ask === 'angle-sector') {
      const theta = solveUp(measure, p.given * Math.PI, 0.1, 359, 30);
      return Math.abs(theta - q.answer.toNumber()) < 0.05 ? null : `expected angle ${theta}`;
    }
    const v = measure(p.major ? 360 - minor : minor) / Math.PI;
    return Math.abs(v - q.answer.toNumber()) < 1e-4 * Math.max(1, v) ? null : `expected k = ${v}`;
  },
};

/* ================================================================== 3. Comparisons (QC) */

interface CircleQCParams {
  mode: 'obtuse-chord' | 'circ-diff' | 'inscribed' | 'semicircle' | 'tangent';
  m: number;
  k: number;
  kPi: boolean;
  variant: string;
  theta: number;
  alpha: number;
}

const compareQC: Template<CircleQCParams> = {
  id: 'geo.circles.compare-qc',
  skill: 'geo.circles',
  format: 'qc',
  style: 'compare chords, angles or circumferences in circles',
  generate(rng, d) {
    const base: CircleQCParams = { mode: 'inscribed', m: 0, k: 0, kPi: false, variant: '', theta: 0, alpha: 0 };
    const x = rng.next();
    const mode: CircleQCParams['mode'] = x < 0.22 ? 'obtuse-chord' : x < 0.44 ? 'circ-diff' : x < 0.66 ? 'inscribed' : x < 0.83 ? 'semicircle' : 'tangent';
    const fig = new Fig();
    if (mode === 'obtuse-chord') {
      const m = rng.int(2, 9);
      const variant = rng.pick(['obtuse', 'obtuse', 'right', 'radius', 'radius'] as const);
      const O: P2 = [0, 0];
      // right: RT is a diameter and S is on the upper arc; obtuse: S is on the short arc RT below.
      const R = onCircle(O, m, variant === 'right' ? 180 : rng.int(195, 215));
      const T = onCircle(O, m, variant === 'right' ? 0 : rng.int(325, 345));
      const S = onCircle(O, m, variant === 'right' ? rng.int(60, 120) : rng.int(250, 290));
      fig.pt('O', O).hide('O').pt('R', R).pt('S', S).pt('T', T).circle('O', m);
      fig.poly(['R', 'S', 'T']);
      const quantityB = variant === 'radius' ? `$${m}$` : `$${2 * m}$`;
      const answer: QCChoice = variant === 'right' ? 'C' : variant === 'obtuse' ? 'B' : 'D';
      const info =
        variant === 'right'
          ? `Triangle $RST$ is inscribed in a circle with area $${piTex(new Frac(m * m))}$, and angle $RST$ measures $90^\\circ$.`
          : `Triangle $RST$ is inscribed in a circle with area $${piTex(new Frac(m * m))}$, and the measure of angle $RST$ is greater than $90^\\circ$.`;
      return {
        params: { ...base, mode, m, variant, k: variant === 'radius' ? m : 2 * m },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info,
          quantityA: `$RT$`,
          quantityB,
          answer,
          traps: variant === 'obtuse' ? { C: 'geom-circle-chord-diameter' } : variant === 'radius' ? { A: 'geom-circle-chord-diameter' } : { B: 'geom-circle-chord-diameter' },
          explanation:
            variant === 'right'
              ? `The area is $${piTex(new Frac(m * m))}$, so the radius is ${m} and the diameter is ${2 * m}. An inscribed angle of $90^\\circ$ cuts off a semicircle, so $RT$ is a diameter: $RT = ${2 * m}$. (C)

A chord is shorter than the diameter only when the angle at $S$ is not a right angle.`
              : variant === 'obtuse'
                ? `The area is $${piTex(new Frac(m * m))}$, so the radius is ${m} and the diameter is ${2 * m}. $RT$ is a chord of the circle. It would be a diameter only if angle $RST$ were exactly $90^\\circ$ (an angle inscribed in a semicircle). Since the angle is greater than $90^\\circ$, $RT$ is a chord that is not a diameter, so $RT < ${2 * m}$. (B)

The longest chord of a circle is a diameter; $RT$ only looks like one.`
                : `The radius is ${m}. $RT$ is a chord that is not a diameter, so $0 < RT < ${2 * m}$, but it can be shorter or longer than ${m}: if $R$ and $T$ are close together, $RT$ is tiny; if angle $S$ is just over $90^\\circ$, $RT$ is almost ${2 * m}. (D)

Knowing that $RT$ is less than the diameter does not compare it with the radius.`,
        },
      };
    }
    if (mode === 'circ-diff') {
      const k = rng.int(2, d === 1 ? 6 : 12);
      const variant = rng.pick(['6k', '6k', '6.3k', '6.28k', 'pi', 'area'] as const);
      const B = variant === '6k' ? 6 * k : variant === '6.3k' ? 6.3 * k : variant === '6.28k' ? 6.28 * k : 2 * k;
      const BTex = variant === 'pi' ? `$${2 * k}\\pi$` : `$${variant === '6k' ? 6 * k : Number((B).toFixed(2))}$`;
      const answer: QCChoice = variant === '6k' || variant === '6.28k' ? 'A' : variant === '6.3k' ? 'B' : variant === 'pi' ? 'C' : 'D';
      const traps: QCQuestion['traps'] =
        variant === '6k' || variant === '6.28k'
          ? { C: 'geom-circle-pi-rounded', D: 'geom-circle-diff-depends' }
          : variant === 'area'
            ? { C: 'geom-circle-diff-depends' }
            : { D: 'geom-circle-diff-depends' };
      const area = variant === 'area';
      return {
        params: { ...base, mode, k, variant, m: B, kPi: variant === 'pi' },
        q: {
          format: 'qc',
          info: `Circle $A$ has a radius ${k} greater than that of circle $B$.`,
          quantityA: area ? `The area of circle $A$ minus the area of circle $B$` : `The circumference of circle $A$ minus the circumference of circle $B$`,
          quantityB: area ? `$${num(4 * k * k)}$` : BTex,
          answer,
          traps,
          explanation: area
            ? `Let the radius of $B$ be $r$. The difference of the areas is $\\pi(r + ${k})^2 - \\pi r^2 = \\pi(${2 * k}r + ${k * k})$, which grows with $r$. For a tiny $r$ it is about $${k * k}\\pi \\approx ${(k * k * 3.14).toFixed(1)}$, less than ${plain(4 * k * k)}; for a large $r$ it is as large as you like. (D)

For circumferences the radius cancels ($2\\pi(r + ${k}) - 2\\pi r = ${2 * k}\\pi$), but for areas it does not.`
            : `Let the radius of $B$ be $r$. Then Quantity A is $2\\pi(r + ${k}) - 2\\pi r = ${2 * k}\\pi$, whatever $r$ is.

${
  variant === 'pi'
    ? `So the quantities are equal. (C)`
    : `Since $\\pi \\approx 3.1416$, $${2 * k}\\pi \\approx ${(2 * k * Math.PI).toFixed(3)}$, ${answer === 'A' ? 'greater' : 'less'} than ${variant === '6k' ? 6 * k : Number(B.toFixed(2))}. (${answer})`
}

The individual radii are not needed: they cancel.${variant === '6k' || variant === '6.28k' || variant === '6.3k' ? ' Treating $\\pi$ as 3 gives the wrong comparison when the numbers are this close.' : ''}`,
        },
      };
    }
    if (mode === 'inscribed') {
      const theta = 2 * rng.int(15, 70);
      const O: P2 = [0, 0];
      const R = 5;
      const a0 = 270 - theta / 2 + rng.int(-25, 25);
      const A = onCircle(O, R, a0);
      const B = onCircle(O, R, a0 + theta);
      const C = onCircle(O, R, a0 + theta + (360 - theta) * rng.pick([0.4, 0.5, 0.6]));
      fig.pt('O', O).pt('A', A).pt('B', B).pt('C', C).circle('O', R);
      fig.seg('O', 'A').seg('O', 'B').seg('C', 'A').seg('C', 'B');
      fig.angleLabel('A', 'O', 'B', `$${deg(theta)}$`).angleLabel('A', 'C', 'B', '$x^\\circ$');
      const x2 = theta / 2;
      const opts: [number, string | undefined][] = [
        [x2, undefined],
        [x2 - rng.int(1, 6), undefined],
        [x2 - rng.int(1, 6), undefined],
        [x2 + rng.int(1, 6), undefined],
        [theta, 'geom-circle-inscribed-as-central'],
        [Math.round((x2 + theta) / 2), 'geom-circle-inscribed-as-central'],
      ];
      const [k, trapId] = rng.pick(opts);
      const answer = qcCompare(x2, k);
      const trapAns = qcCompare(theta, k);
      return {
        params: { ...base, mode, k, theta },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: `$O$ is the center of the circle, and $A$, $B$ and $C$ lie on the circle.`,
          quantityA: `$x$`,
          quantityB: `$${k}$`,
          answer,
          traps: trapId && trapAns !== answer ? { [trapAns]: trapId } : undefined,
          explanation: `Angle $ACB$ is inscribed and cuts off the same arc $AB$ as the central angle $AOB$, so it is half of it: $x = \\frac{${theta}}{2} = ${x2}$.

Compare ${x2} with ${k}: ${relText(answer)}. (${answer})

An inscribed angle is not equal to the central angle on the same arc; it is half of it.`,
        },
      };
    }
    if (mode === 'semicircle') {
      const alpha = 5 * rng.int(4, 14);
      const O: P2 = [0, 0];
      const R = 5;
      const A: P2 = [-R, 0];
      const B: P2 = [R, 0];
      // C: angle CAB = alpha means the central angle COB = 2 alpha
      const C = onCircle(O, R, 2 * alpha);
      fig.pt('O', O, [0, -1]).pt('A', A).pt('B', B).pt('C', C).circle('O', R);
      fig.seg('A', 'B').seg('A', 'C').seg('C', 'B');
      fig.angleLabel('C', 'A', 'B', `$${deg(alpha)}$`).angleLabel('A', 'B', 'C', '$y^\\circ$');
      const y = 90 - alpha;
      const opts: [number, string | undefined][] = [
        [y, undefined],
        [y - rng.int(1, 8), undefined],
        [y - rng.int(1, 8), undefined],
        [y + rng.int(1, 8), undefined],
        [alpha, undefined],
      ];
      const [k] = rng.pick(opts.filter(([v]) => v > 0 && (v !== alpha || alpha !== y)));
      const answer = qcCompare(y, k);
      return {
        params: { ...base, mode, k, alpha },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: `$O$ is the center of the circle, and $AB$ is a diameter.`,
          quantityA: `$y$`,
          quantityB: `$${k}$`,
          answer,
          traps: { D: 'geom-circle-semicircle-right' },
          explanation: `Since $AB$ is a diameter, the inscribed angle $ACB$ cuts off a semicircle and measures $90^\\circ$. In triangle $ABC$: $${alpha} + 90 + y = 180$, so $y = ${y}$.

Compare ${y} with ${k}: ${relText(answer)}. (${answer})

The comparison is determined: an angle inscribed in a semicircle is always a right angle.`,
        },
      };
    }
    // tangent
    const alpha = 5 * rng.int(4, 13);
    const O: P2 = [0, 0];
    const R = 3;
    const OP = R / Math.sin((alpha * Math.PI) / 180);
    const P: P2 = [OP, 0];
    const A = tangentPoint(O, R, P);
    fig.pt('O', O).pt('A', A).pt('P', P).circle('O', R);
    fig.seg('O', 'A').seg('A', 'P').seg('O', 'P').right('O', 'A', 'P');
    fig.angleLabel('A', 'P', 'O', `$${deg(alpha)}$`).angleLabel('A', 'O', 'P', '$y^\\circ$');
    const y = 90 - alpha;
    const opts: number[] = [y, y - rng.int(1, 8), y - rng.int(1, 8), y + rng.int(1, 8), alpha];
    const k = rng.pick(opts.filter((v) => v > 0 && !(v === alpha && alpha === y)));
    const answer = qcCompare(y, k);
    return {
      params: { ...base, mode: 'tangent', k, alpha },
      q: {
        format: 'qc',
        figure: fig.build(false),
        info: `$O$ is the center of the circle, and $PA$ is tangent to the circle at $A$.`,
        quantityA: `$y$`,
        quantityB: `$${k}$`,
        answer,
        traps: { D: 'geom-circle-tangent-right' },
        explanation: `A tangent is perpendicular to the radius drawn to the point of tangency, so angle $OAP = 90^\\circ$. In triangle $OAP$: $y + 90 + ${alpha} = 180$, so $y = ${y}$.

Compare ${y} with ${k}: ${relText(answer)}. (${answer})

The right angle at $A$ is what makes the comparison determined.`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    let expected: QCChoice;
    if (p.mode === 'obtuse-chord') {
      const samples: [number, number][] = [];
      for (let i = 0; i < 60; i++) {
        // random R, T; S on the arc that makes angle S as required
        const tR = rng.next() * 360;
        const span = p.variant === 'right' ? 180 : 5 + rng.next() * 170; // minor arc RT (degrees)
        const tT = tR + span;
        const tS = p.variant === 'right' ? tT + rng.next() * 170 + 5 : tR + rng.next() * span; // obtuse: S on the minor arc
        const R = onCircle([0, 0], p.m, tR);
        const T = onCircle([0, 0], p.m, tT);
        const S = onCircle([0, 0], p.m, tS);
        const angS = angleAt(R, S, T);
        if (p.variant === 'right' ? Math.abs(angS - 90) > 1e-6 : angS <= 90) return 'sampler broke the angle condition';
        samples.push([dist(R, T), p.k]);
      }
      expected = qcFromSamples(samples);
    } else if (p.mode === 'circ-diff') {
      const samples: [number, number][] = [];
      const radii = [0.001, 0.01, 0.1, 0.3, 1, 2, 5, 10, 30, 100, ...Array.from({ length: 10 }, () => rng.next() * 20)];
      for (const rB of radii) {
        const rA = rB + p.k;
        const u = unitCircle();
        const vA = p.variant === 'area' ? (rA * rA - rB * rB) * u.area : (rA - rB) * u.perim;
        const vB = p.variant === 'area' ? 4 * p.k * p.k : p.kPi ? 2 * p.k * Math.PI : p.m;
        samples.push([vA, vB]);
      }
      const rel = samples.map(([a, b]) => cmpTol(a, b));
      expected = rel.every((r) => r === rel[0]) ? rel[0] : 'D';
    } else if (p.mode === 'inscribed') {
      const samples: [number, number][] = [];
      const A = onCircle([0, 0], 4, 0);
      const B = onCircle([0, 0], 4, p.theta);
      if (Math.abs(angleAt(A, [0, 0], B) - p.theta) > 1e-6) return 'bad central angle';
      for (let i = 0; i < 20; i++) samples.push([angleAt(A, onCircle([0, 0], 4, p.theta + 1 + rng.next() * (358 - p.theta)), B), p.k]);
      expected = cmpAll(samples);
    } else if (p.mode === 'semicircle') {
      // C = where the ray from A at angle alpha above AB meets the circle (found by bisection along the ray)
      const R = 4;
      const A: P2 = [-R, 0];
      const B: P2 = [R, 0];
      const u: P2 = [Math.cos((p.alpha * Math.PI) / 180), Math.sin((p.alpha * Math.PI) / 180)];
      // distance to the center minus R is negative just inside A and positive beyond the far side
      const len = solveUp((s) => Math.hypot(A[0] + s * u[0], A[1] + s * u[1]) - R, 0, R * 0.01, 2 * R);
      const C: P2 = [A[0] + len * u[0], A[1] + len * u[1]];
      expected = cmpTol(angleAt(A, B, C), p.k, 1e-6);
    } else {
      const R = 2;
      const P: P2 = [R / Math.sin((p.alpha * Math.PI) / 180), 0];
      const A = tangentPoint([0, 0], R, P);
      if (Math.abs(angleAt(A, P, [0, 0]) - p.alpha) > 1e-6) return 'tangent construction failed';
      expected = cmpTol(angleAt(A, [0, 0], P), p.k, 1e-6);
    }
    return q.answer === expected ? null : `expected ${expected} (${QC_TEXT[expected]})`;
  },
};

function cmpAll(samples: [number, number][]): QCChoice {
  const rel = samples.map(([a, b]) => cmpTol(a, b, 1e-6));
  return rel.every((r) => r === rel[0]) ? rel[0] : 'D';
}

/* ================================================================== 4. Lengths: tangents, chords, wheels (NE) */

interface LengthParams {
  mode: 'tangent-PA' | 'tangent-OP' | 'tangent-PB' | 'chord-AB' | 'chord-r' | 'chord-OM' | 'wheel';
  r: number;
  a: number;
  b: number;
  dist: number;
  unitFactor: number;
}

const CHORD_TRIPLES: [number, number, number][] = [
  // [radius, distance to center, half chord]
  [5, 3, 4],
  [5, 4, 3],
  [10, 6, 8],
  [10, 8, 6],
  [13, 5, 12],
  [13, 12, 5],
  [17, 8, 15],
  [17, 15, 8],
  [25, 7, 24],
  [15, 9, 12],
  [15, 12, 9],
];
const TAN_TRIPLES: [number, number, number][] = [
  // [radius, tangent length, distance OP]
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [6, 8, 10],
  [8, 6, 10],
  [8, 15, 17],
  [9, 12, 15],
  [12, 5, 13],
  [7, 24, 25],
  [12, 9, 15],
];

const lengths: Template<LengthParams> = {
  id: 'geo.circles.lengths',
  skill: 'geo.circles',
  format: 'ne',
  style: 'tangent segments, chords and rolling wheels',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1
        ? (['tangent-PA', 'chord-AB', 'tangent-OP', 'wheel'] as const)
        : d === 2
          ? (['tangent-PB', 'chord-AB', 'chord-r', 'wheel'] as const)
          : (['tangent-PB', 'chord-OM', 'chord-r', 'wheel'] as const),
    );
    const base: LengthParams = { mode, r: 0, a: 0, b: 0, dist: 0, unitFactor: 1 };
    const fig = new Fig();
    if (mode === 'wheel') {
      const inches = rng.chance(0.5);
      let D: number;
      let distance: number;
      let N: number;
      do {
        D = inches ? rng.pick([20, 24, 26, 28, 30, 36]) : rng.pick([50, 60, 64, 70, 75, 80]);
        distance = inches ? 10 * rng.int(5, 40) : 50 * rng.int(4, 40);
        N = (distance * (inches ? 12 : 100)) / (Math.PI * D);
      } while (N - Math.floor(N) < 0.08 || N - Math.floor(N) > 0.92 || N < 8);
      const factor = inches ? 12 : 100;
      const ans = Math.floor(N);
      const traps: { value: Frac; trap: string }[] = [
        { value: new Frac(Math.floor(N / 2)), trap: 'geom-circle-radius-diameter' },
        { value: new Frac(Math.floor(2 * N)), trap: 'geom-circle-radius-diameter' },
        { value: new Frac(ans + 1), trap: 'geom-circle-wheel-round-up' },
        { value: new Frac(Math.floor((distance * factor) / D)), trap: 'geom-circle-wheel-no-pi' },
      ];
      const big = inches ? 'feet' : 'meters';
      const small = inches ? 'inches' : 'centimeters';
      return {
        params: { ...base, r: D / 2, dist: distance, unitFactor: factor },
        q: {
          format: 'ne',
          stem: rng.pick([
            `A wheel with a diameter of ${D} ${small} rolls in a straight line without slipping. How many complete revolutions does the wheel make while it travels ${plain(distance)} ${big}? (1 ${inches ? 'foot = 12 inches' : 'meter = 100 centimeters'})`,
            `The wheel of a ${inches ? 'cart' : 'trolley'} is ${D} ${small} across. If it rolls ${plain(distance)} ${big} along a straight, level path without slipping, how many complete turns does it make? (1 ${inches ? 'foot = 12 inches' : 'meter = 100 centimeters'})`,
            `A ${inches ? 'bicycle' : 'roller'} wheel has a diameter of ${D} ${small}. How many complete revolutions does it make over a straight run of ${plain(distance)} ${big}, with no slipping? (1 ${inches ? 'foot = 12 inches' : 'meter = 100 centimeters'})`,
          ]),
          suffix: 'complete revolutions',
          answer: new Frac(ans),
          traps: ((): typeof traps => {
            if (traps.some((t) => t.value.eq(ans))) throw new Redraw('a trap equals the answer');
            return traps;
          })(),
          explanation: `Each revolution moves the wheel one circumference: $\\pi d = ${D}\\pi \\approx ${(D * Math.PI).toFixed(2)}$ ${small}.

The distance is $${num(distance)} \\times ${factor} = ${num(distance * factor)}$ ${small}, so the number of revolutions is $\\frac{${num(distance * factor)}}{${D}\\pi} \\approx ${N.toFixed(2)}$.

The wheel completes ${ans} revolutions (the last one is not finished). Use the diameter in $\\pi d$ (or $2\\pi r$ with $r = ${D / 2}$), and convert ${big} to ${small} first.`,
        },
      };
    }
    if (mode.startsWith('tangent')) {
      const [r, t, dd] = rng.pick(TAN_TRIPLES);
      const O: P2 = [0, 0];
      const P: P2 = [dd, 0];
      const A = tangentPoint(O, r, P);
      fig.pt('O', O).pt('A', A).pt('P', P).circle('O', r);
      fig.right('O', 'A', 'P');
      let answer: Frac;
      const traps: { value: Frac; trap: string }[] = [];
      let stem: string;
      let explanation: string;
      if (mode === 'tangent-PA') {
        fig.seg('O', 'A', `$${r}$`).seg('A', 'P').seg('O', 'P', `$${dd}$`);
        answer = new Frac(t);
        traps.push({ value: new Frac(dd - r), trap: 'geom-circle-no-right-triangle' });
        stem = rng.pick([
          `In the figure above, $O$ is the center of the circle and $PA$ is tangent to the circle at $A$. What is the length of $PA$?`,
          `In the figure above, the line through $P$ and $A$ is tangent at $A$ to the circle with center $O$. What is the length of $PA$?`,
          `$O$ is the center of the circle in the figure above, and $PA$ touches the circle at $A$ without crossing it. What is the length of $PA$?`,
        ]);
        explanation = `A tangent is perpendicular to the radius at the point of tangency, so triangle $OAP$ has a right angle at $A$ with hypotenuse $OP = ${dd}$:

$$PA = \\sqrt{${dd}^2 - ${r}^2} = \\sqrt{${dd * dd - r * r}} = ${t}$$

Subtracting the lengths ($${dd} - ${r}$) ignores the right triangle.`;
      } else if (mode === 'tangent-OP') {
        fig.seg('O', 'A', `$${r}$`).seg('A', 'P', `$${t}$`).seg('O', 'P');
        answer = new Frac(dd);
        traps.push({ value: new Frac(r + t), trap: 'geom-circle-no-right-triangle' });
        stem = rng.pick([
          `In the figure above, $O$ is the center of the circle and $PA$ is tangent to the circle at $A$. What is the length of $OP$?`,
          `In the figure above, the line through $P$ and $A$ is tangent at $A$ to the circle with center $O$. What is the length of $OP$?`,
          `$O$ is the center of the circle in the figure above, and $PA$ touches the circle at $A$ without crossing it. What is the length of $OP$?`,
        ]);
        explanation = `The radius $OA$ is perpendicular to the tangent $PA$, so $OP$ is the hypotenuse of right triangle $OAP$:

$$OP = \\sqrt{${r}^2 + ${t}^2} = \\sqrt{${r * r + t * t}} = ${dd}$$

$OP$ is not $${r} + ${t}$: the two legs are perpendicular, not in a straight line.`;
      } else {
        const Bp: P2 = [r, 0];
        fig.pt('B', Bp, [-1, -1]);
        fig.seg('O', 'A', `$${r}$`).seg('A', 'P', `$${t}$`).seg('O', 'P');
        answer = new Frac(dd - r);
        traps.push({ value: new Frac(dd), trap: 'geom-circle-pb-whole' });
        if (t - r > 0) traps.push({ value: new Frac(t - r), trap: 'geom-circle-no-right-triangle' });
        stem = `In the figure above, $O$ is the center of the circle, $PA$ is tangent to the circle at $A$, and $B$ is the point where segment $OP$ meets the circle. What is the length of $PB$?`;
        explanation = `Radius $OA \\perp PA$, so in right triangle $OAP$: $OP = \\sqrt{${r}^2 + ${t}^2} = ${dd}$.

$OB$ is also a radius (${r}), so $PB = OP - OB = ${dd} - ${r} = ${dd - r}$.

${dd} is the distance from $P$ to the center, not to the circle.`;
      }
      return {
        params: { ...base, r, a: t, b: dd },
        q: { format: 'ne', stem, figure: fig.build(false), answer, traps: noClash(traps, answer), explanation },
      };
    }
    // chords
    const [r, h, half] = rng.pick(CHORD_TRIPLES);
    const O: P2 = [0, 0];
    const A: P2 = [-half, -h];
    const B: P2 = [half, -h];
    const M: P2 = [0, -h];
    fig.pt('O', O).pt('A', A).pt('B', B).pt('M', M, [0, -1]).circle('O', r);
    fig.right('O', 'M', 'B');
    let answer: Frac;
    const traps: { value: Frac; trap: string }[] = [];
    let stem: string;
    let explanation: string;
    if (mode === 'chord-AB') {
      fig.seg('A', 'B').seg('O', 'M', `$${h}$`, true).seg('O', 'A', `$${r}$`);
      answer = new Frac(2 * half);
      traps.push({ value: new Frac(half), trap: 'geom-circle-half-chord' });
      stem = `In the figure above, $O$ is the center of the circle, and $OM$ is perpendicular to chord $AB$. What is the length of $AB$?`;
      explanation = `The perpendicular from the center bisects the chord, so $M$ is the midpoint of $AB$. In right triangle $OMA$ (hypotenuse $OA = ${r}$):

$$AM = \\sqrt{${r}^2 - ${h}^2} = \\sqrt{${r * r - h * h}} = ${half}$$

So $AB = 2 \\cdot ${half} = ${2 * half}$. Stopping at ${half} gives only half the chord.`;
    } else if (mode === 'chord-r') {
      fig.seg('A', 'B', `$${2 * half}$`).seg('O', 'M', `$${h}$`, true).seg('O', 'A');
      answer = new Frac(r);
      const wrong = Math.sqrt(4 * half * half + h * h);
      if (Number.isInteger(wrong)) traps.push({ value: new Frac(wrong), trap: 'geom-circle-whole-chord-leg' });
      traps.push({ value: new Frac(half + h), trap: 'geom-circle-no-right-triangle' });
      stem = `In the figure above, $O$ is the center of the circle, $OM$ is perpendicular to chord $AB$, $AB = ${2 * half}$ and $OM = ${h}$. What is the radius of the circle?`;
      explanation = `The perpendicular from the center bisects the chord: $AM = \\frac{${2 * half}}{2} = ${half}$. The radius $OA$ is the hypotenuse of right triangle $OMA$:

$$OA = \\sqrt{${half}^2 + ${h}^2} = \\sqrt{${half * half + h * h}} = ${r}$$

Use half the chord as the leg, not the whole chord.`;
    } else {
      fig.seg('A', 'B', `$${2 * half}$`).seg('O', 'M', undefined, true).seg('O', 'A', `$${r}$`);
      answer = new Frac(h);
      const wrong = r * r - 4 * half * half;
      if (wrong > 0 && Number.isInteger(Math.sqrt(wrong))) traps.push({ value: new Frac(Math.sqrt(wrong)), trap: 'geom-circle-whole-chord-leg' });
      traps.push({ value: new Frac(r - half), trap: 'geom-circle-no-right-triangle' });
      stem = `In the figure above, $O$ is the center of the circle and $OM$ is perpendicular to chord $AB$. What is the length of $OM$?`;
      explanation = `$OM$ bisects the chord, so $AM = ${half}$. In right triangle $OMA$ with hypotenuse $OA = ${r}$:

$$OM = \\sqrt{${r}^2 - ${half}^2} = \\sqrt{${r * r - half * half}} = ${h}$$

The leg is half the chord (${half}), not the whole chord.`;
    }
    return {
      params: { ...base, r, a: h, b: half },
      q: { format: 'ne', stem, figure: fig.build(false), answer, traps: noClash(traps, answer), explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    let v: number;
    if (p.mode === 'wheel') {
      // Roll a 4000-gon wheel revolution by revolution.
      const circ = p.r * unitCircle().perim;
      const total = p.dist * p.unitFactor;
      let n = 0;
      while ((n + 1) * circ <= total) n++;
      v = n;
    } else if (p.mode.startsWith('tangent')) {
      const O: P2 = [0, 0];
      // r = p.r, tangent length p.a, OP = p.b (given data differs by mode; rebuild from what is given)
      const r = p.r;
      let OP: number;
      if (p.mode === 'tangent-PA') OP = p.b;
      else OP = solveUp((x) => dist(tangentPoint(O, r, [x, 0]), [x, 0]), p.a, r + 1e-9, 1000, 60);
      const P: P2 = [OP, 0];
      const A = tangentPoint(O, r, P);
      v = p.mode === 'tangent-PA' ? dist(A, P) : p.mode === 'tangent-OP' ? OP : OP - r;
    } else {
      // chord at distance h from the center of a circle of radius r: find endpoints by bisection
      const chordAt = (r: number, h: number) => 2 * solveUp((x) => Math.hypot(x, h), r, 0, r);
      if (p.mode === 'chord-AB') v = chordAt(p.r, p.a);
      else if (p.mode === 'chord-r') v = solveUp((r) => (r <= p.a ? 0 : chordAt(r, p.a)), 2 * p.b, p.a, 1000);
      else v = solveUp((h) => -chordAt(p.r, h), -2 * p.b, 0, p.r);
    }
    return Math.abs(q.answer.toNumber() - v) < 1e-6 * Math.max(1, v) ? null : `expected ${v}`;
  },
};

export const circleTemplates = retryAll([ratio, arcSector, compareQC, lengths]);

