import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { Fig, onCircle, type P2 } from './fig';
import { retryAll } from '../redraw';

/* Regular polygon inscribed in a circle: compare a diameter, a chord or an arc with k sides (QC). */

export const polygonArcTraps: Record<string, Trap> = {
  'geom-poly-hexagon-side-r': {
    label: 'Used "side = radius" for a polygon that is not a hexagon',
    fix: 'Only the regular hexagon has a side equal to the radius (six equilateral triangles around the center). A regular $n$-gon has side $2r\\sin\\frac{180^\\circ}{n}$, which is about $0.77r$ for $n = 8$ and $0.52r$ for $n = 12$.',
  },
  'geom-poly-arc-chord-equal': {
    label: 'Treated an arc and the chord or sides it spans as equal',
    fix: 'A curved arc is longer than the straight chord between its endpoints, and the sides of the polygon lie inside the arc: chord < sides < arc.',
  },
  'geom-poly-more-sides-longer': {
    label: 'Assumed more sides means a longer perimeter, whatever the circles',
    fix: 'For ONE circle the perimeter grows with the number of sides, but two circles of different radii can reverse that. Compare the radii first.',
  },
  'geom-poly-needs-radius': {
    label: 'Said "cannot be determined" although the radii are ordered',
    fix: 'The radii need no values: if one is at least as large as the other and the larger circle also has at least as many sides, its perimeter is greater.',
  },
};

type Kind = 'path' | 'arc' | 'chord' | 'diam' | 'radius';
interface Spec {
  kind: Kind;
  k: number;
}
interface Params {
  mode: 'same' | 'two';
  n: number;
  a: Spec;
  b: Spec;
  n2: number;
  rel: 'none' | 'ge' | 'gt';
}

const NAME: Record<number, string> = { 6: 'hexagon', 8: 'octagon', 10: 'decagon', 12: '12-gon' };
const nameOf = (n: number) => `regular ${NAME[n]}`;
const sides = (k: number) => (k === 1 ? 'one side' : `${k} consecutive sides`);
const apart = (k: number) => (k === 1 ? 'adjacent vertices' : `two vertices that are ${k} sides apart`);

/** Length in units of r (formula). */
function val(s: Spec, n: number): number {
  switch (s.kind) {
    case 'path':
      return 2 * s.k * Math.sin(Math.PI / n);
    case 'arc':
      return (2 * Math.PI * s.k) / n;
    case 'chord':
      return 2 * Math.sin((s.k * Math.PI) / n);
    case 'diam':
      return 2;
    default:
      return 1;
  }
}

const text = (s: Spec): string => {
  switch (s.kind) {
    case 'path':
      return s.k === 1 ? 'The length of one side of the polygon' : `The sum of the lengths of ${sides(s.k)} of the polygon`;
    case 'arc':
      return `The length of the arc of the circle cut off by ${sides(s.k)} of the polygon`;
    case 'chord':
      return `The length of the chord joining ${apart(s.k)}`;
    case 'diam':
      return 'The diameter of the circle';
    default:
      return 'The radius of the circle';
  }
};

const cmp = (x: number, y: number): QCChoice => (Math.abs(x - y) <= 1e-9 * Math.max(1, x, y) ? 'C' : x > y ? 'A' : 'B');
const fmt = (x: number) => x.toFixed(3);

const arcChord: Template<Params> = {
  id: 'geo.polygons.arc-chord-qc',
  skill: 'geo.polygons',
  format: 'qc',
  style: 'regular polygon inscribed in a circle: a diameter, chord or arc against k sides',
  generate(rng, d) {
    const fig = new Fig();
    const rot = rng.int(0, 359);
    const draw = (n: number, c: P2, r: number) => {
      fig.polyXY(Array.from({ length: n }, (_, i) => onCircle(c, r, rot + (360 * i) / n)));
      fig.circle(fig.h(c), r);
    };
    if (d >= 2 && rng.chance(0.3)) {
      // two circles of unrelated sizes
      const [n, n2] = rng.pick([[6, 8], [8, 6], [6, 12], [12, 6], [8, 12], [12, 8], [6, 10], [10, 6], [8, 10], [10, 8]] as [number, number][]);
      const rel = rng.pick(['none', 'ge', 'gt', 'ge', 'gt'] as const);
      const per = (m: number) => 2 * m * Math.sin(Math.PI / m);
      const bigger = n > n2;
      const answer: QCChoice = rel !== 'none' && bigger ? 'A' : 'D';
      const relText = rel === 'ge' ? 'Circle $X$ has a radius at least as large as that of circle $Y$.' : rel === 'gt' ? 'Circle $X$ has a radius greater than that of circle $Y$.' : 'Circles $X$ and $Y$ are different circles.';
      draw(n, [-2.4, 0], 2);
      draw(n2, [2.4, 0], rel === 'none' ? 1.3 : 1.5);
      const traps: Partial<Record<QCChoice, string>> = answer === 'D' ? { [bigger ? 'A' : 'B']: 'geom-poly-more-sides-longer' } : { D: 'geom-poly-needs-radius' };
      const why =
        answer === 'A'
          ? `The ${NAME[n]} has more sides and sits in a circle that is at least as large, so both effects push the same way and its perimeter is greater.`
          : rel === 'none'
            ? 'Nothing relates the two radii, so either circle may be the larger one.'
            : `The polygon with more sides sits in the smaller circle here, so the two effects fight and the radii decide.`;
      const q: QCQuestion = {
        format: 'qc',
        figure: fig.build(true),
        info: `A ${nameOf(n)} is inscribed in circle $X$, and a ${nameOf(n2)} is inscribed in circle $Y$. ${relText}`,
        quantityA: `The perimeter of the ${NAME[n]}`,
        quantityB: `The perimeter of the ${NAME[n2]}`,
        answer,
        traps,
        explanation: `Both perimeters depend on a radius and on the number of sides: with radius $\\rho$ and $m$ sides the perimeter is $2m\\rho\\sin\\frac{180^\\circ}{m}$.

In ONE circle, more sides give a longer perimeter: about $${fmt(per(n))}\\rho$ for $m = ${n}$ and $${fmt(per(n2))}\\rho$ for $m = ${n2}$. ${why} (${answer})

Test: with equal radii the polygon with more sides wins; make its circle small enough and the other wins${answer === 'A' ? ', but the stated order of the radii forbids that' : ''}.

Trap: "more sides, longer" is true only inside one circle.`,
      };
      return { params: { mode: 'two', n, n2, a: { kind: 'path', k: n }, b: { kind: 'path', k: n2 }, rel }, q };
    }
    // one circle
    const n = rng.pick(d === 1 ? [6] : d === 2 ? [6, 8, 12] : [6, 8, 10, 12]);
    const kinds: Kind[] = d === 1 ? ['path', 'diam', 'radius'] : d === 2 ? ['path', 'diam', 'chord', 'radius'] : ['path', 'arc', 'chord', 'diam'];
    const spec = (): Spec => {
      const kind = rng.pick(kinds);
      const kMax = Math.floor(n / 2);
      return { kind, k: kind === 'diam' || kind === 'radius' ? 0 : kind === 'chord' ? rng.int(2, kMax - 1) : rng.int(1, kMax) };
    };
    const a = spec();
    const b = spec();
    const trivial = (s: Spec) => s.kind === 'diam' || s.kind === 'radius';
    if ((a.kind === b.kind && a.k === b.k) || (trivial(a) && trivial(b)) || (d === 3 && a.kind !== 'arc' && b.kind !== 'arc')) return arcChord.generate(rng, d);
    const answer = cmp(val(a, n), val(b, n));
    const hasArc = a.kind === 'arc' || b.kind === 'arc';
    const traps: Partial<Record<QCChoice, string>> = {};
    if (answer !== 'C') {
      if (hasArc) traps.C = 'geom-poly-arc-chord-equal';
      else if (n !== 6 && (a.kind === 'path' || b.kind === 'path')) traps.C = 'geom-poly-hexagon-side-r';
    }
    const line = (s: Spec, who: string) => `- ${who}: about $${fmt(val(s, n))}r$.`;
    fig.pt('O', [0, 0], [0, 0.4]);
    draw(n, [0, 0], 2);
    const q: QCQuestion = {
      format: 'qc',
      figure: fig.build(true),
      info: `A ${nameOf(n)} is inscribed in a circle with center $O$ and radius $r$.`,
      quantityA: text(a),
      quantityB: text(b),
      answer,
      traps: Object.keys(traps).length ? traps : undefined,
      explanation: `Both quantities are lengths in one circle, so write each as a multiple of the radius $r$.

A chord across $k$ sides is $2r\\sin\\frac{k \\cdot 180^\\circ}{${n}}$ (one side is the case $k = 1$), a path of $k$ sides is $k$ times the side, and an arc across $k$ sides is $\\frac{k}{${n}}$ of the circumference $2\\pi r$.

${line(a, 'Quantity A')}
${line(b, 'Quantity B')}

So ${answer === 'C' ? 'the quantities are equal' : answer === 'A' ? 'Quantity A is larger' : 'Quantity B is larger'}. (${answer})

Trap: ${hasArc ? 'an arc looks as long as its chord, but a curve between two points is always longer than the straight segment' : traps.C ? 'the hexagon fact "side = radius" is tempting, yet it fails for other polygons' : 'the picture makes these lengths look alike, so compute each one rather than trust the drawing'}.

Rule: for the same endpoints, chord < path of sides < arc.`,
    };
    return { params: { mode: 'same', n, n2: 0, a, b, rel: 'none' }, q };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'format';
    const poly = (m: number, rho: number): P2[] => Array.from({ length: m }, (_, i) => [rho * Math.cos((2 * Math.PI * i) / m), rho * Math.sin((2 * Math.PI * i) / m)] as P2);
    const dist = (u: P2, v: P2) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    const perim = (m: number, rho: number) => {
      const v = poly(m, rho);
      return v.reduce((s, pt, i) => s + dist(pt, v[(i + 1) % m]), 0);
    };
    if (p.mode === 'two') {
      const samples: [number, number][] = [];
      for (let i = 0; i < 90; i++) {
        const r = 1 + 9 * rng.next();
        const gap = [1, 0.05, 0.003][i % 3] * (0.01 + 0.99 * rng.next()); // how far s sits below r
        let s = r * (1 - gap);
        if (p.rel === 'none' && i % 2) s = r * (1 + gap); // no order given: either circle may be larger
        samples.push([perim(p.n, r), perim(p.n2, s)]);
      }
      if (p.rel === 'ge') samples.push([perim(p.n, 2), perim(p.n2, 2)]);
      const exp = qcFromSamples(samples);
      return exp === q.answer ? null : `expected ${exp}`;
    }
    const rho = 3.7;
    const v = poly(p.n, rho);
    const meas = (s: Spec) => {
      if (s.kind === 'diam') return 2 * rho;
      if (s.kind === 'radius') return rho;
      if (s.kind === 'chord') return dist(v[0], v[s.k]);
      if (s.kind === 'path') return Array.from({ length: s.k }, (_, i) => dist(v[i], v[i + 1])).reduce((x, y) => x + y, 0);
      let ang = Math.atan2(v[s.k][1], v[s.k][0]) - Math.atan2(v[0][1], v[0][0]);
      if (ang < 0) ang += 2 * Math.PI;
      return ang * rho;
    };
    const exp = cmp(meas(p.a), meas(p.b));
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const polygonArcTemplates = retryAll([arcChord]);
