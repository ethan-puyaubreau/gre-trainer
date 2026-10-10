import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import type { QCChoice, Template } from '../../../engine/types';
import { FigBuilder, add, angleAt, bisect, dir, dist, foot, fromSides, intersect, mul, near, shoelace, sub, unit, type Pt } from './fig';
import { drawPhi, isPhiType, measureAt, measured, mulberry, POSITIONS, transversalFigure, type At, type Pos } from './lines';
import { checkMcm, qcTraps, QC_SAY } from './util';

const SKILL = 'geo.figure-reasoning';
const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);

/* ================================================================== 1. A point on a side: do the parts look equal or are they? (QC) */

type PSKind = 'iso-top' | 'iso-left' | 'iso-alt' | 'iso-bis' | 'bis-only' | 'alt-only' | 'alt-longer' | 'numbers' | 'midpoint';
interface PSParams {
  kind: PSKind;
  swap: boolean;
  n?: number;
  m?: number;
  leftLonger?: boolean;
}

const LETTERS: [string, string, string, string][] = [
  ['Q', 'P', 'R', 'S'],
  ['B', 'A', 'C', 'D'],
  ['K', 'J', 'L', 'M'],
  ['Y', 'X', 'Z', 'W'],
];

const pointOnSide: Template<PSParams> = {
  id: 'geo.figure-reasoning.point-on-side-qc',
  skill: SKILL,
  format: 'qc',
  style: 'a point on a side of a triangle: are the two parts equal?',
  generate(rng, d) {
    const kind: PSKind = rng.pick(
      d === 1
        ? (['iso-top', 'iso-left', 'midpoint', 'numbers', 'iso-alt'] as const)
        : d === 2
          ? (['iso-top', 'iso-left', 'iso-alt', 'iso-bis', 'alt-only', 'numbers', 'alt-longer'] as const)
          : (['iso-left', 'bis-only', 'alt-only', 'iso-bis', 'iso-alt', 'alt-longer', 'alt-longer'] as const),
    );
    const [nV, nL, nR, nS] = rng.pick(LETTERS);
    const swap = rng.chance(0.5);
    let n: number | undefined;
    let m: number | undefined;
    let leftLonger: boolean | undefined;
    let info: string;
    let base: QCChoice; // relation of LS to SR
    let why: string;
    // drawing
    const L: Pt = [0, 0];
    const R: Pt = [5, 0];
    let V: Pt = [2.5, 3.2];
    let tS = 0.5 + rng.pick([-0.03, -0.02, 0.02, 0.03]);
    let rightMark = false;
    let bisMarks = false;
    const LS = `${nL}${nS}`;
    const SR = `${nS}${nR}`;
    switch (kind) {
      case 'iso-top':
        info = `$${nV}${nL} = ${nV}${nR}$`;
        base = 'D';
        V = [2.5 + rng.pick([-0.15, 0.15]), 3.1];
        why = `The equal sides make the triangle isosceles, but they say nothing about where $${nS}$ is on $${nL}${nR}$. $${nS}$ could be the midpoint (equal parts), or close to $${nL}$ ($${LS} < ${SR}$), or close to $${nR}$ ($${LS} > ${SR}$). (D)`;
        break;
      case 'iso-left':
        info = `$${nL}${nV} = ${nL}${nR}$`;
        base = 'D';
        V = mul(dir(rng.int(52, 64)), 5);
        why = `$${nL}${nV} = ${nL}${nR}$ only says that two sides from $${nL}$ are equal. Nothing fixes the position of $${nS}$ on $${nL}${nR}$: redraw it near $${nL}$ or near $${nR}$ and the comparison changes. (D)`;
        break;
      case 'iso-alt':
        info = `$${nV}${nL} = ${nV}${nR}$ and $${nV}${nS} \\perp ${nL}${nR}$`;
        base = 'C';
        tS = 0.5;
        rightMark = true;
        why = `Right triangles $${nV}${nS}${nL}$ and $${nV}${nS}${nR}$ have equal hypotenuses ($${nV}${nL} = ${nV}${nR}$) and share the leg $${nV}${nS}$, so their other legs are equal: $${LS}^2 = ${nV}${nL}^2 - ${nV}${nS}^2 = ${nV}${nR}^2 - ${nV}${nS}^2 = ${SR}^2$.`;
        break;
      case 'iso-bis':
        info = `$${nV}${nL} = ${nV}${nR}$, and $${nV}${nS}$ bisects angle $${nL}${nV}${nR}$`;
        base = 'C';
        tS = 0.5;
        bisMarks = true;
        why = `Triangles $${nV}${nL}${nS}$ and $${nV}${nR}${nS}$ have $${nV}${nL} = ${nV}${nR}$, equal angles at $${nV}$, and the common side $${nV}${nS}$, so they are congruent (side-angle-side). Hence $${LS} = ${SR}$.`;
        break;
      case 'bis-only':
        info = `$${nV}${nS}$ bisects angle $${nL}${nV}${nR}$`;
        base = 'D';
        bisMarks = true;
        V = [2.5 + rng.pick([-0.2, 0.2]), 3.0];
        why = `An angle bisector splits the opposite side in the ratio of the two adjacent sides: $\\frac{${LS}}{${SR}} = \\frac{${nV}${nL}}{${nV}${nR}}$. Nothing says whether $${nV}${nL}$ is longer, shorter or equal to $${nV}${nR}$, so the parts can compare either way. (D)`;
        break;
      case 'alt-only':
        info = `$${nV}${nS} \\perp ${nL}${nR}$`;
        base = 'D';
        rightMark = true;
        tS = 0.5 + rng.pick([-0.04, 0.04]);
        V = [5 * tS, 3.1];
        why = `A perpendicular from $${nV}$ lands at the midpoint of $${nL}${nR}$ only when $${nV}${nL} = ${nV}${nR}$. Here $${nV}$ could be above any point of $${nL}${nR}$, so $${LS}$ can be shorter, equal or longer than $${SR}$. (D)`;
        break;
      case 'alt-longer': {
        leftLonger = rng.chance(0.5);
        info = `$${nV}${nS} \\perp ${nL}${nR}$ and $${leftLonger ? `${nV}${nL} > ${nV}${nR}` : `${nV}${nL} < ${nV}${nR}`}$`;
        base = leftLonger ? 'A' : 'B';
        rightMark = true;
        tS = leftLonger ? 0.56 : 0.44;
        V = [5 * tS, 3.0];
        why = `In right triangles $${nV}${nS}${nL}$ and $${nV}${nS}${nR}$, the common leg is $${nV}${nS}$, so $${LS}^2 = ${nV}${nL}^2 - ${nV}${nS}^2$ and $${SR}^2 = ${nV}${nR}^2 - ${nV}${nS}^2$. The longer hypotenuse gives the longer leg: ${leftLonger ? `$${LS} > ${SR}$` : `$${LS} < ${SR}$`}.`;
        break;
      }
      case 'numbers': {
        n = rng.int(8, 20);
        m = rng.chance(0.3) && n % 2 === 0 ? n / 2 : Math.round(n / 2) + rng.pick([-2, -1, 1, 2]);
        if (m * 2 === n) m = n / 2;
        info = `$${nL}${nR} = ${n}$ and $${LS} = ${m}$`;
        base = m * 2 > n ? 'A' : m * 2 < n ? 'B' : 'C';
        tS = 0.5 + (m / n - 0.5) * 0.4;
        why = `$${SR} = ${nL}${nR} - ${LS} = ${n} - ${m} = ${n - m}$, so $${LS} = ${m}$ ${base === 'A' ? '>' : base === 'B' ? '<' : '='} $${SR} = ${n - m}$.`;
        break;
      }
      default:
        info = `$${nS}$ is the midpoint of $${nL}${nR}$`;
        base = 'C';
        tS = 0.5;
        why = `A midpoint splits the segment into two equal parts, so $${LS} = ${SR}$.`;
    }
    const answer = swap ? flip(base) : base;
    const S: Pt = [5 * tS, 0];
    const fb = new FigBuilder().pt(nV, V).pt(nL, L).pt(nR, R).pt(nS, S, [0, -1]).poly(nV, nL, nR).seg(nV, nS);
    if (rightMark) fb.right(nV, nS, nR);
    if (bisMarks) fb.arc(nL, nV, nS).arc(nS, nV, nR);
    const fig = fb.build(true);
    const qa = `$${swap ? SR : LS}$`;
    const qb = `$${swap ? LS : SR}$`;
    const sayLine = base === 'D' ? '' : `\n\nSo ${QC_SAY[answer]}. (${answer})`;
    return {
      params: { kind, swap, n, m, leftLonger },
      q: {
        format: 'qc',
        info,
        figure: fig,
        quantityA: qa,
        quantityB: qb,
        answer,
        traps: qcTraps(answer, base === 'D' ? { C: 'geo-fig-looks-equal' } : { D: 'geo-fig-gave-up' }),
        explanation: `${why}${sayLine}${base === 'D' ? '\n\nThe figure is not drawn to scale: $' + nS + '$ only looks like the midpoint.' : ''}`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const rnd = mulberry(p.kind.length * 101 + (p.n ?? 0) * 7 + (p.m ?? 0));
    const samples: [number, number][] = [];
    const L: Pt = [0, 0];
    const R: Pt = [1, 0];
    const bisFoot = (V: Pt) => intersect(V, add(unit(sub(L, V)), unit(sub(R, V))), L, [1, 0]);
    for (let i = 0; i < 400; i++) {
      let S: Pt;
      let Rr: Pt = R;
      switch (p.kind) {
        case 'iso-top':
          S = [0.01 + 0.98 * rnd(), 0];
          break;
        case 'iso-left':
          S = [0.01 + 0.98 * rnd(), 0];
          break;
        case 'iso-alt':
          S = foot([0.5, 0.1 + 3 * rnd()], L, R);
          break;
        case 'iso-bis':
          S = bisFoot([0.5, 0.1 + 3 * rnd()]);
          break;
        case 'bis-only':
          S = bisFoot([-0.5 + 2 * rnd(), 0.1 + 3 * rnd()]);
          break;
        case 'alt-only':
          S = foot([0.01 + 0.98 * rnd(), 0.1 + 3 * rnd()], L, R);
          break;
        case 'alt-longer': {
          const V: Pt = [0.01 + 0.98 * rnd(), 0.1 + 3 * rnd()];
          if (p.leftLonger ? !(dist(V, L) > dist(V, R)) : !(dist(V, L) < dist(V, R))) continue;
          S = foot(V, L, R);
          break;
        }
        case 'numbers':
          Rr = [p.n!, 0];
          S = [p.m!, 0];
          break;
        default:
          S = [0.5, 0];
      }
      const ls = dist(L, S);
      const sr = dist(S, Rr);
      samples.push(p.swap ? [sr, ls] : [ls, sr]);
    }
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

/* ================================================================== 2. Lines that look parallel, angles that look right (QC) */

type LKind = 'par-none' | 'par-given' | 'par-forced' | 'par-numbers' | 'right-none' | 'right-solved' | 'tri-sum';
interface LParams {
  kind: LKind;
  phi?: number;
  posX?: Pos;
  posY?: Pos;
  posZ?: Pos;
  X?: number;
  Z?: number;
  rel?: { a: number; b: number; c: number }; // a·x + b·y = c (right-solved)
  cmp?: 'x-90' | 'x-y' | 'sum';
  z?: number;
  N?: number;
}

const linesLookQC: Template<LParams> = {
  id: 'geo.figure-reasoning.lines-qc',
  skill: SKILL,
  format: 'qc',
  style: 'lines that look parallel and angles that look right',
  generate(rng, d) {
    const kind: LKind = rng.pick(
      d === 1
        ? (['par-none', 'par-given', 'right-none', 'right-solved', 'tri-sum'] as const)
        : d === 2
          ? (['par-none', 'par-numbers', 'right-none', 'right-solved', 'tri-sum', 'par-given'] as const)
          : (['par-forced', 'par-numbers', 'par-none', 'right-solved', 'tri-sum', 'right-none'] as const),
    );
    if (kind.startsWith('par')) {
      const theta = rng.int(10, 15) * 5;
      const phi = rng.chance(0.5) ? theta : 180 - theta;
      const posX = rng.pick(POSITIONS);
      // y in a matching position at the lower intersection (equal if the lines were parallel)
      const posY = rng.pick(POSITIONS.filter((p) => isPhiType(p) === isPhiType(posX)));
      const posZ = rng.pick(POSITIONS.filter((p) => isPhiType(p) !== isPhiType(posY)));
      let info: string | undefined;
      let answer: QCChoice;
      let labX = '$x^\\circ$';
      const labY = '$y^\\circ$';
      let labZ: string | undefined;
      let explanation: string;
      let params: LParams = { kind, phi, posX, posY, posZ };
      const mx = measureAt(posX, phi);
      if (kind === 'par-none') {
        answer = 'D';
        explanation = `Lines $\\ell$ and $m$ only LOOK parallel; nothing says they are. If they were parallel, $x$ would equal $y$, but tilting $\\ell$ slightly changes $x$ without changing $y$, making $x$ larger or smaller than $y$. (D)`;
      } else if (kind === 'par-given') {
        info = '$\\ell \\parallel m$';
        answer = 'C';
        explanation = `Since $\\ell \\parallel m$, the angles $x^\\circ$ and $y^\\circ$ are in matching positions at the two intersections, so $x = y$. (C)`;
      } else if (kind === 'par-forced') {
        labZ = '$z^\\circ$';
        info = '$x + z = 180$';
        answer = 'C';
        explanation = `If $x + z = 180$, then line $\\ell$ makes the same angle with the transversal as line $m$ does, so $\\ell \\parallel m$ (the converse of the parallel-lines angle facts). Then $x$ and $y$, in matching positions, are equal. (C)

You may not assume the lines are parallel from the picture, but here the given equation proves it.`;
      } else {
        // numbers: x and z given in the figure, lines not stated parallel
        const X = mx + rng.pick([-5, 5, 0, 10, -10]);
        const Z = 180 - measureAt(posY, phi);
        labX = `$${X}^\\circ$`;
        labZ = `$${Z}^\\circ$`;
        const y = 180 - Z;
        answer = X > y ? 'A' : X < y ? 'B' : 'C';
        params = { ...params, X, Z };
        explanation = `Nothing says the lines are parallel, but $y$ is fixed anyway: the $y^\\circ$ angle and the $${Z}^\\circ$ angle form a straight line, so $y = 180 - ${Z} = ${y}$.

Compare $x = ${X}$ with $y = ${y}$: ${QC_SAY[answer]}. (${answer})`;
      }
      // z must sit at the bottom intersection, adjacent to y on a straight line
      const marks: { at: At; pos: Pos; tex: string }[] = [
        { at: 'P', pos: posX, tex: labX },
        { at: 'Q', pos: posY, tex: labY },
        ...(labZ ? [{ at: 'Q' as At, pos: posZ, tex: labZ }] : []),
      ];
      const fig = transversalFigure(drawPhi(phi), marks);
      fig.notToScale = true;
      const traps =
        kind === 'par-none' ? { C: 'geo-fig-looks-parallel' } : kind === 'par-numbers' ? { C: 'geo-fig-looks-parallel', D: 'geo-fig-gave-up' } : { D: 'geo-fig-gave-up' };
      return {
        params,
        q: { format: 'qc', info, figure: fig, quantityA: '$x$', quantityB: '$y$', answer, traps: qcTraps(answer, traps), explanation },
      };
    }
    if (kind === 'right-none' || kind === 'right-solved') {
      // a ray from O on line AB, drawn nearly perpendicular
      const tilt = rng.pick([-4, -3, 3, 4]);
      const O: Pt = [0, 0];
      const fb = new FigBuilder().pt('O', O, [0, -1]).pt('A', [-3, 0]).pt('B', [3, 0]).pt('C', mul(dir(90 + tilt), 3)).seg('A', 'B').seg('O', 'C');
      fb.angle('O', 'C', 'A', '$x^\\circ$', 30).angle('O', 'B', 'C', '$y^\\circ$', 30);
      const fig = fb.build(true);
      if (kind === 'right-none') {
        const cmp: 'x-90' | 'x-y' = rng.pick(['x-90', 'x-y']);
        return {
          params: { kind, cmp },
          q: {
            format: 'qc',
            info: '$A$, $O$, and $B$ lie on a line.',
            figure: fig,
            quantityA: '$x$',
            quantityB: cmp === 'x-90' ? '$90$' : '$y$',
            answer: 'D',
            traps: { C: 'geo-fig-looks-right' },
            explanation: `All we know is $x + y = 180$ (angles along a straight line). The ray $OC$ looks perpendicular to $AB$, but no right angle is marked or given: with $x = 80$, $y = 100$; with $x = 100$, $y = 80$. (D)`,
          },
        };
      }
      // determined by a relation
      const form = rng.pick(['y=x+k', 'x=2y-k', 'x=y', 'x=ky'] as const);
      let rel: { a: number; b: number; c: number };
      let infoRel: string;
      if (form === 'y=x+k') {
        const k = rng.pick([10, 20, 30, 16, 24]);
        rel = { a: -1, b: 1, c: k };
        infoRel = `y = x + ${k}`;
      } else if (form === 'x=2y-k') {
        const k = rng.pick([30, 60, 90, 120, 21, 39]);
        rel = { a: 1, b: -2, c: -k };
        infoRel = `x = 2y - ${k}`;
      } else if (form === 'x=y') {
        rel = { a: 1, b: -1, c: 0 };
        infoRel = 'x = y';
      } else {
        const k = rng.pick([2, 3, 4, 5]);
        rel = { a: 1, b: -k, c: 0 };
        infoRel = `x = ${k}y`;
      }
      // solve with x + y = 180
      const det = rel.a * 1 - rel.b * 1; // a x + b y = c, x + y = 180 -> x = (c - 180 b)/(a - b)
      const x = (rel.c - 180 * rel.b) / det;
      const y = 180 - x;
      const cmp: 'x-90' | 'x-y' = rng.pick(['x-90', 'x-90', 'x-y']);
      const answer: QCChoice = cmp === 'x-90' ? (x > 90 ? 'A' : x < 90 ? 'B' : 'C') : x > y ? 'A' : x < y ? 'B' : 'C';
      return {
        params: { kind, rel, cmp },
        q: {
          format: 'qc',
          info: `$A$, $O$, and $B$ lie on a line, and $${infoRel}$.`,
          figure: fig,
          quantityA: '$x$',
          quantityB: cmp === 'x-90' ? '$90$' : '$y$',
          answer,
          traps: qcTraps(answer, { C: 'geo-fig-looks-right', D: 'geo-fig-gave-up' }),
          explanation: `Angles along a straight line: $x + y = 180$. Together with $${infoRel}$, this gives $x = ${num2(x)}$ and $y = ${num2(y)}$.

So ${QC_SAY[answer]}. (${answer}) The ray only looks perpendicular; the equations decide.`,
        },
      };
    }
    // tri-sum: triangle with one known angle z, the other two x and y
    const z = rng.int(6, 16) * 5;
    const cmp: 'x-y' | 'sum' = rng.chance(0.6) ? 'x-y' : 'sum';
    const N = cmp === 'sum' ? 180 - z + rng.pick([0, 0, 10, -10]) : 0;
    const answer: QCChoice = cmp === 'x-y' ? 'D' : 180 - z > N ? 'A' : 180 - z < N ? 'B' : 'C';
    const half = (180 - z) / 2;
    const [T, L, R] = (() => {
      const a1 = half + rng.pick([-3, 3]);
      const Lp: Pt = [0, 0];
      const Rp: Pt = [5, 0];
      const Tp = intersect(Lp, dir(a1), Rp, dir(180 - (180 - z - a1)));
      return [Tp, Lp, Rp];
    })();
    const fb = new FigBuilder().pt('P', T).pt('Q', L).pt('R', R).poly('P', 'Q', 'R');
    fb.angle('P', 'Q', 'R', `$${z}^\\circ$`).angle('Q', 'P', 'R', '$x^\\circ$').angle('R', 'P', 'Q', '$y^\\circ$');
    return {
      params: { kind, cmp, z, N },
      q: {
        format: 'qc',
        figure: fb.build(true),
        quantityA: cmp === 'x-y' ? '$x$' : '$x + y$',
        quantityB: cmp === 'x-y' ? '$y$' : `$${N}$`,
        answer,
        traps: qcTraps(answer, cmp === 'x-y' ? { C: 'geo-fig-looks-equal' } : { D: 'geo-fig-gave-up' }),
        explanation:
          cmp === 'x-y'
            ? `The angle sum gives only $x + y = 180 - ${z} = ${180 - z}$. The split is not fixed: $x = ${half - 10}$, $y = ${half + 10}$ works, and so does the reverse. The figure only makes them look equal. (D)`
            : `The angles of a triangle add up to $180^\\circ$, so $x + y = 180 - ${z} = ${180 - z}$, whatever the individual values. Compared with $${N}$: ${QC_SAY[answer]}. (${answer})`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const rnd = mulberry(p.kind.length * 37 + (p.phi ?? 0) + (p.z ?? 0) * 3 + (p.X ?? 0));
    const samples: [number, number][] = [];
    for (let i = 0; i < 300; i++) {
      switch (p.kind) {
        case 'par-none': {
          const tilt = -20 + 40 * rnd();
          const phi = 30 + 120 * rnd();
          samples.push([measured(phi, 'P', p.posX!, tilt), measured(phi, 'Q', p.posY!)]);
          break;
        }
        case 'par-given': {
          const phi = 10 + 160 * rnd();
          samples.push([measured(phi, 'P', p.posX!), measured(phi, 'Q', p.posY!)]);
          break;
        }
        case 'par-forced': {
          const phi = 30 + 120 * rnd();
          const z = measured(phi, 'Q', p.posZ!);
          const f = (tilt: number) => measured(phi, 'P', p.posX!, tilt) + z - 180;
          const lo = -25;
          const hi = 25;
          if (Math.sign(f(lo)) === Math.sign(f(hi))) continue;
          const tilt = bisect(f, lo, hi);
          samples.push([measured(phi, 'P', p.posX!, tilt), measured(phi, 'Q', p.posY!)]);
          break;
        }
        case 'par-numbers': {
          // the bottom line fixes phi through z; the top line is tilted to make x as given
          let phi = -1;
          for (let t = 1; t < 180; t++) if (near(measured(t, 'Q', p.posZ!), p.Z!, 1e-9)) phi = t;
          if (phi < 0) return 'no transversal fits z';
          const f = (tilt: number) => measured(phi, 'P', p.posX!, tilt) - p.X!;
          const tilt = bisect(f, -40, 40);
          if (!near(measured(phi, 'P', p.posX!, tilt), p.X!, 1e-6)) return 'no tilt fits x';
          samples.push([p.X!, measured(phi, 'Q', p.posY!)]);
          i = 1000;
          break;
        }
        case 'right-none':
        case 'right-solved': {
          const ang = (psi: number) => {
            const C = dir(psi);
            return { x: angleAt([0, 0], [-1, 0], C), y: angleAt([0, 0], C, [1, 0]) };
          };
          let psi: number;
          if (p.kind === 'right-none') psi = 1 + 178 * rnd();
          else {
            const { a, b, c } = p.rel!;
            psi = bisect((s) => {
              const { x, y } = ang(s);
              return a * x + b * y - c;
            }, 1e-6, 180 - 1e-6);
            i = 1000;
          }
          const { x, y } = ang(psi);
          samples.push([x, p.cmp === 'x-90' ? 90 : y]);
          break;
        }
        case 'tri-sum': {
          // apex angle z built from two rays; the base vertex slides along the second ray
          const T: Pt = [0, 0];
          const L = dir(-90 - p.z! / 2);
          const R = mul(dir(-90 + p.z! / 2), 0.1 + 5 * rnd());
          const x = angleAt(L, T, R);
          const y = angleAt(R, T, L);
          samples.push(p.cmp === 'x-y' ? [x, y] : [x + y, p.N!]);
          break;
        }
      }
    }
    if (!samples.length) return 'no samples';
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

const num2 = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? `${Math.round(v)}` : v.toFixed(1));

/* ================================================================== 3. What can be concluded from a figure (MCM) */

type InfoKind = 'none' | 'AC=BD' | 'isoE' | 'numbers' | 'angle70';
type StmtId = 'order' | 'sum' | 'AD>BC' | 'AB=CD' | 'EB=EC' | 'right' | 'linear' | 'ext' | 'ext2' | 'triineq' | 'BC>AB' | 'ABE>EBC' | 'AC=BD' | 'AD=12';
interface MBParams {
  info: InfoKind;
  stmts: StmtId[];
}

interface Conf {
  a: number;
  b: number;
  c: number;
  d: number;
  E: Pt;
}

const STMT: Record<StmtId, { text: string; holds: (k: Conf) => boolean; trap?: string }> = {
  order: { text: '$AC > AB$', holds: (k) => k.c - k.a > k.b - k.a + 1e-9 },
  sum: { text: '$AB + BC = AC$', holds: (k) => near(k.b - k.a + (k.c - k.b), k.c - k.a) },
  'AD>BC': { text: '$AD > BC$', holds: (k) => k.d - k.a > k.c - k.b + 1e-9 },
  'AB=CD': { text: '$AB = CD$', holds: (k) => near(k.b - k.a, k.d - k.c), trap: 'geo-fig-looks-equal' },
  'EB=EC': { text: '$EB = EC$', holds: (k) => near(dist(k.E, [k.b, 0]), dist(k.E, [k.c, 0])), trap: 'geo-fig-looks-equal' },
  right: { text: 'Angle $EBC$ is a right angle.', holds: (k) => near(angleAt([k.b, 0], k.E, [k.c, 0]), 90), trap: 'geo-fig-looks-right' },
  linear: {
    text: 'The measures of angles $ABE$ and $EBC$ add up to $180^\\circ$.',
    holds: (k) => near(angleAt([k.b, 0], [k.a, 0], k.E) + angleAt([k.b, 0], k.E, [k.c, 0]), 180),
  },
  ext: { text: 'The measure of angle $ECD$ is greater than the measure of angle $EBC$.', holds: (k) => angleAt([k.c, 0], k.E, [k.d, 0]) > angleAt([k.b, 0], k.E, [k.c, 0]) + 1e-9 },
  ext2: { text: 'The measure of angle $ECD$ is greater than the measure of angle $BEC$.', holds: (k) => angleAt([k.c, 0], k.E, [k.d, 0]) > angleAt(k.E, [k.b, 0], [k.c, 0]) + 1e-9 },
  triineq: { text: '$EB + EC > BC$', holds: (k) => dist(k.E, [k.b, 0]) + dist(k.E, [k.c, 0]) > k.c - k.b + 1e-9 },
  'BC>AB': { text: '$BC > AB$', holds: (k) => k.c - k.b > k.b - k.a + 1e-9, trap: 'geo-fig-looks-equal' },
  'ABE>EBC': { text: 'The measure of angle $ABE$ is greater than the measure of angle $EBC$.', holds: (k) => angleAt([k.b, 0], [k.a, 0], k.E) > angleAt([k.b, 0], k.E, [k.c, 0]) + 1e-9, trap: 'geo-fig-looks-right' },
  'AC=BD': { text: '$AC = BD$', holds: (k) => near(k.c - k.a, k.d - k.b), trap: 'geo-fig-looks-equal' },
  'AD=12': { text: '$AD = 12$', holds: (k) => near(k.d - k.a, 12) },
};

const ALWAYS: StmtId[] = ['order', 'sum', 'AD>BC', 'linear', 'ext', 'ext2', 'triineq'];

function sampleConf(info: InfoKind, rnd: () => number): Conf {
  const a = 0;
  let b = a + 0.2 + 3 * rnd();
  let c = b + 0.2 + 3 * rnd();
  let d = c + 0.2 + 3 * rnd();
  let E: Pt = [b - 2 + (c - b + 4) * rnd(), 0.2 + 3 * rnd()];
  if (info === 'AC=BD') d = c + (b - a);
  if (info === 'isoE') E = [(b + c) / 2, 0.2 + 3 * rnd()];
  if (info === 'numbers') {
    b = 3;
    c = 7;
    d = 12;
  }
  if (info === 'angle70') E = add([b, 0], mul(dir(70), 0.3 + 3 * rnd()));
  return { a, b, c, d, E };
}

const mustBeTrue: Template<MBParams> = {
  id: 'geo.figure-reasoning.must-be-true-mcm',
  skill: SKILL,
  format: 'mcm',
  style: 'which conclusions a figure (not drawn to scale) supports',
  generate(rng, d) {
    const info: InfoKind = rng.pick(d === 1 ? (['none', 'numbers', 'AC=BD'] as const) : (['none', 'AC=BD', 'isoE', 'numbers', 'angle70'] as const));
    // Rules: what each piece of information forces (check() re-tests them on random drawings).
    const forced: Record<InfoKind, StmtId[]> = {
      none: [],
      'AC=BD': ['AB=CD', 'AC=BD'],
      isoE: ['EB=EC', 'ABE>EBC'],
      numbers: ['BC>AB', 'AD=12'],
      angle70: ['ABE>EBC'],
    };
    const truthOf = (id: StmtId): boolean => ALWAYS.includes(id) || forced[info].includes(id);
    // candidate statements by relevance
    const looks: StmtId[] = ['AB=CD', 'EB=EC', 'right'];
    const extra: StmtId[] = info === 'numbers' ? ['BC>AB', 'AD=12', 'AC=BD'] : info === 'angle70' ? ['ABE>EBC', 'right'] : info === 'AC=BD' ? ['AB=CD', 'BC>AB'] : info === 'isoE' ? ['EB=EC', 'ABE>EBC'] : ['BC>AB', 'AC=BD', 'ABE>EBC'];
    const nTotal = d === 1 ? 5 : 6;
    const pool = [...new Set([...rng.shuffle(extra).slice(0, 2), ...rng.shuffle(looks).slice(0, 2), ...rng.shuffle(ALWAYS)])];
    let chosen: StmtId[] = [];
    for (const id of pool) {
      if (chosen.length >= nTotal) break;
      if (id === 'right' && chosen.includes('EB=EC')) continue;
      if (id === 'EB=EC' && chosen.includes('right')) continue;
      chosen.push(id);
    }
    // need at least two false statements
    const truths = chosen.map(truthOf);
    if (truths.filter((t) => !t).length < 2 || truths.filter((t) => t).length < 1) return mustBeTrue.generate(rng, d);
    chosen = rng.shuffle(chosen);
    const tv = chosen.map(truthOf);
    const { choices, answer } = flaggedChoices(
      chosen.map((id, i) => ({ text: STMT[id].text, correct: tv[i], ...(!tv[i] && STMT[id].trap ? { trap: STMT[id].trap } : {}) })),
    );
    // figure: AB looks equal to CD; E above near B (looks right) or above the middle of BC (looks isosceles)
    const nums = info === 'numbers';
    const xb = nums ? 3 * 0.55 : 1.5;
    const xc = nums ? 7 * 0.55 : 4.2;
    const xd = nums ? 12 * 0.55 : 5.7;
    const Ex = chosen.includes('right') || info === 'angle70' ? xb + (info === 'angle70' ? 0.9 : 0.06) : (xb + xc) / 2 + (info === 'isoE' ? 0 : 0.08);
    const fb = new FigBuilder().pt('A', [0, 0]).pt('B', [xb, 0]).pt('C', [xc, 0]).pt('D', [xd, 0]).pt('E', [Ex, 2.4]);
    fb.seg('A', 'D').seg('E', 'B').seg('E', 'C');
    for (const n of ['A', 'B', 'C', 'D']) fb.pt(n, fb.points[n], [0, -1]);
    const infoText =
      info === 'none'
        ? ''
        : info === 'AC=BD'
          ? ', and $AC = BD$'
          : info === 'isoE'
            ? ', and angles $EBC$ and $ECB$ have equal measures'
            : info === 'numbers'
              ? ', $AB = 3$, $BC = 4$, and $CD = 5$'
              : ', and the measure of angle $EBC$ is $70^\\circ$';
    const why: Record<StmtId, string> = {
      order: '$B$ is between $A$ and $C$ (points on a line are in the order shown), so $AC = AB + BC > AB$',
      sum: 'points on a line are in the order shown, so $AC$ is made of $AB$ and $BC$',
      'AD>BC': '$BC$ is part of $AD$',
      'AB=CD': info === 'AC=BD' ? 'subtract $BC$ from both $AC$ and $BD$' : info === 'numbers' ? '$3 \\ne 5$' : 'the lengths only look equal',
      'EB=EC': info === 'isoE' ? 'equal angles face equal sides' : 'nothing makes triangle $EBC$ isosceles',
      right: info === 'angle70' ? 'angle $EBC$ is $70^\\circ$' : 'no right angle is marked or given; it only looks like one',
      linear: '$A$, $B$, $C$ are on a straight line, so the two angles at $B$ form a straight angle',
      ext: 'angle $ECD$ is an exterior angle of triangle $EBC$, equal to angle $EBC$ plus angle $BEC$',
      ext2: 'angle $ECD$ is an exterior angle of triangle $EBC$, equal to angle $BEC$ plus angle $EBC$',
      triineq: 'any two sides of a triangle add up to more than the third',
      'BC>AB': info === 'numbers' ? '$4 > 3$' : info === 'AC=BD' ? 'the given fact fixes $AB = CD$, not how $BC$ compares with $AB$' : 'nothing fixes these lengths',
      'ABE>EBC':
        info === 'angle70'
          ? 'angle $ABE = 180 - 70 = 110$, which is greater than $70$'
          : info === 'isoE'
            ? 'angles $EBC$ and $ECB$ are equal, so each is less than $90^\\circ$, and angle $ABE = 180^\\circ -$ angle $EBC$ is more than $90^\\circ$'
            : 'the two angles at $B$ add to $180^\\circ$, but either one can be the larger',
      'AC=BD': info === 'numbers' ? '$AC = 7$ but $BD = 9$' : info === 'AC=BD' ? 'given' : 'nothing fixes these lengths',
      'AD=12': '$3 + 4 + 5 = 12$',
    };
    return {
      params: { info, stmts: chosen },
      q: {
        format: 'mcm',
        stem: `In the figure above, points $A$, $B$, $C$, and $D$ lie on a line${infoText}. Which of the following statements must be true?`,
        instruction: 'Indicate all such statements.',
        figure: fb.build(true),
        choices,
        answer,
        explanation: `A GRE figure shows the order of points on a line and which side of a line a point is on, but not lengths or angle sizes.

${chosen.map((id, i) => `- ${STMT[id].text.replace(/\.$/, '')}: ${why[id]} ${tv[i] ? '✓' : '✗'}`).join('\n')}`,
      },
    };
  },
  check(q, { info, stmts }) {
    if (q.format !== 'mcm') return 'format';
    const r = mulberry(991 + info.length);
    const confs = Array.from({ length: 500 }, () => sampleConf(info, r));
    // also try extreme shapes: E far left / right, near the line
    const expected = stmts.flatMap((id, i) => (confs.every((k) => STMT[id].holds(k)) ? [i] : []));
    return checkMcm(q.answer, expected);
  },
};

/* ================================================================== 4. Does it have to be a right angle? (QC) */

type RAKind = 'alg-sides' | 'area' | 'third';
interface RAParams {
  kind: RAKind;
  p?: number;
  q?: number;
  r?: number;
  mode?: 'free' | 'zero' | 'plus' | 'minus';
  a?: number;
  b?: number;
  right?: boolean;
  N?: number;
}

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [6, 8, 10],
];

const rightAngleQC: Template<RAParams> = {
  id: 'geo.figure-reasoning.right-angle-qc',
  skill: SKILL,
  format: 'qc',
  style: 'a triangle that looks right-angled: what do the given sides force?',
  generate(rng, d) {
    const kind: RAKind = rng.pick(d === 1 ? (['area', 'third', 'alg-sides'] as const) : (['alg-sides', 'area', 'third'] as const));
    if (kind === 'alg-sides') {
      // GE-08
      const [p, q, r] = rng.pick(TRIPLES);
      const mode = rng.pick(d === 1 ? (['free', 'zero'] as const) : (['free', 'free', 'zero', 'plus', 'minus'] as const));
      const s1 = mode === 'minus' ? `${p} - y` : `${p} + y`;
      const s2 = mode === 'plus' ? `${q} + y` : `${q} - y`;
      const info = mode === 'free' ? undefined : mode === 'zero' ? '$y = 0$' : mode === 'plus' ? '$y > 0$' : '$0 < y < 1$';
      const answer: QCChoice = mode === 'free' ? 'D' : mode === 'zero' ? 'C' : mode === 'plus' ? 'B' : 'A';
      const C: Pt = [0, 0];
      const B: Pt = [4.2, 0];
      const A: Pt = mul(dir(90 + rng.pick([-2, 2])), (4.2 * p) / q);
      const fb = new FigBuilder().pt('A', A).pt('B', B).pt('C', C).poly('A', 'B', 'C');
      fb.side('A', 'C', 'B', `$${s1}$`).side('C', 'B', 'A', `$${s2}$`).side('A', 'B', 'C', `$${r}$`).angle('C', 'A', 'B', '$x^\\circ$');
      const explanation =
        mode === 'free'
          ? `If $y = 0$, the sides are $${p}$, $${q}$, $${r}$, a Pythagorean triple, so $x = 90$. But if $y = 1$, the sides are $${p + 1}$, $${q - 1}$, $${r}$, and $${p + 1}^2 + ${q - 1}^2 = ${(p + 1) ** 2 + (q - 1) ** 2} \\ne ${r * r}$, so $x \\ne 90$. (D)

The figure looks like a right triangle, but no right angle is marked.`
          : mode === 'zero'
            ? `With $y = 0$ the sides are $${p}$, $${q}$, $${r}$ and $${p}^2 + ${q}^2 = ${r}^2$, so by the converse of the Pythagorean theorem the angle opposite the side $${r}$ is a right angle: $x = 90$. (C)`
            : mode === 'plus'
              ? `Compare the two shorter sides' squares with $${r}^2$: $(${p} + y)^2 + (${q} + y)^2 = ${r * r} + ${2 * (p + q)}y + 2y^2 > ${r}^2$ when $y > 0$. When the sum of the squares of two sides is greater than the square of the third side, the angle opposite the third side is acute, so $x < 90$. (B)`
              : `$(${p} - y)^2 + (${q} - y)^2 = ${r * r} - ${2 * (p + q)}y + 2y^2 < ${r}^2$ for $0 < y < 1$. When the squares of two sides add up to less than the square of the third side, the angle opposite the third side is obtuse, so $x > 90$. (A)`;
      return {
        params: { kind, p, q, r, mode },
        q: {
          format: 'qc',
          info,
          figure: fb.build(true),
          quantityA: '$x$',
          quantityB: '$90$',
          answer,
          traps: qcTraps(answer, mode === 'free' ? { C: 'geo-fig-triple-assumed' } : { C: 'geo-fig-looks-right', D: 'geo-fig-gave-up' }),
          explanation,
        },
      };
    }
    const a = rng.int(3, 12);
    let b = rng.int(3, 12);
    while (b === a) b = rng.int(3, 12);
    const right = rng.chance(d === 1 ? 0.4 : 0.3);
    const C: Pt = [0, 0];
    const B: Pt = [4.2, 0];
    const tilt = right ? 0 : rng.pick([-3, 3]);
    const A: Pt = mul(dir(90 + tilt), (4.2 * a) / b);
    const fb = new FigBuilder().pt('A', A).pt('B', B).pt('C', C).poly('A', 'B', 'C');
    fb.side('A', 'C', 'B', `$${a}$`).side('C', 'B', 'A', `$${b}$`);
    if (right) fb.right('A', 'C', 'B');
    if (kind === 'area') {
      const half = (a * b) / 2;
      let N: number;
      if (right) N = half + rng.pick([0, -1, 1, 0]);
      else N = rng.pick([half, half, Math.floor(half / 2), half + rng.int(1, 4)]);
      const answer: QCChoice = right ? (half > N ? 'A' : half < N ? 'B' : 'C') : N > half ? 'B' : 'D';
      const assumed: QCChoice = half > N ? 'A' : half < N ? 'B' : 'C';
      return {
        params: { kind, a, b, right, N },
        q: {
          format: 'qc',
          info: right ? undefined : `In triangle $ABC$, $AC = ${a}$ and $BC = ${b}$.`,
          figure: fb.build(!right),
          quantityA: 'The area of triangle $ABC$',
          quantityB: `$${num2(N)}$`,
          answer,
          traps: qcTraps(answer, right ? { D: 'geo-fig-gave-up' } : { [assumed]: 'geo-fig-looks-right' }),
          explanation: right
            ? `The right angle is marked, so $AC$ and $BC$ are base and height: area $= \\frac{1}{2}(${a})(${b}) = ${num2(half)}$. ${QC_SAY[answer][0].toUpperCase() + QC_SAY[answer].slice(1)}. (${answer})`
            : `With $BC$ as the base, the height is the distance from $A$ to line $BC$, which is at most $AC = ${a}$, reached only when angle $C$ is a right angle. So the area is at most $\\frac{1}{2}(${a})(${b}) = ${num2(half)}$, and it can be as small as we like when angle $C$ is close to $0^\\circ$ or $180^\\circ$.

${answer === 'B' ? `Every possible area is at most $${num2(half)}$, less than $${num2(N)}$. (B)` : `The area can be ${N === half ? `equal to $${num2(half)}$ (right angle) or less than it` : `greater than $${num2(N)}$ (near a right angle) or less (a flat triangle)`}. (D)`}

The angle at $C$ only looks like a right angle; no mark says so.`,
        },
      };
    }
    // third side
    const hyp = Math.hypot(a, b);
    let N: number;
    if (right) N = Math.round(hyp) + rng.pick([0, 1, -1]);
    else N = rng.pick([a + b, a + b + 1, Math.abs(a - b), Math.max(1, Math.abs(a - b) - 1), Math.round(hyp), Math.round(hyp) + 1]);
    const answer: QCChoice = right ? (hyp > N ? 'A' : hyp < N - 1e-9 ? 'B' : 'C') : N >= a + b ? 'B' : N <= Math.abs(a - b) ? 'A' : 'D';
    const assumed: QCChoice = hyp > N ? 'A' : hyp < N ? 'B' : 'C';
    return {
      params: { kind, a, b, right, N },
      q: {
        format: 'qc',
        info: right ? undefined : `In triangle $ABC$, $AC = ${a}$ and $BC = ${b}$.`,
        figure: fb.build(!right),
        quantityA: '$AB$',
        quantityB: `$${N}$`,
        answer,
        traps: qcTraps(answer, right ? { D: 'geo-fig-gave-up' } : { [assumed]: 'geo-fig-looks-right' }),
        explanation: right
          ? `The right angle at $C$ is marked, so $AB = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}}$. Compare squares: $${a * a + b * b}$ vs $${N}^2 = ${N * N}$. ${QC_SAY[answer][0].toUpperCase() + QC_SAY[answer].slice(1)}. (${answer})`
          : `Without a right angle, $AB$ can be any length strictly between $${Math.max(a, b)} - ${Math.min(a, b)} = ${Math.abs(b - a)}$ and $${a} + ${b} = ${a + b}$ (triangle inequality), depending on angle $C$.

${answer === 'B' ? `Every possible value of $AB$ is less than $${N}$. (B)` : answer === 'A' ? `Every possible value of $AB$ is greater than $${N}$. (A)` : `$${N}$ is inside that range, so $AB$ can be less than or greater than $${N}$. (D)`}${answer === 'D' ? ` (Only if angle $C$ were a right angle would $AB$ be $\\sqrt{${a * a + b * b}}$.)` : ''}`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const samples: [number, number][] = [];
    if (p.kind === 'alg-sides') {
      const ys: number[] =
        p.mode === 'zero' ? [0] : p.mode === 'plus' ? Array.from({ length: 200 }, (_, i) => 0.01 + i * 0.05) : p.mode === 'minus' ? Array.from({ length: 98 }, (_, i) => 0.01 + i * 0.01) : Array.from({ length: 201 }, (_, i) => -3 + i * 0.03);
      for (const y of ys) {
        const s1 = p.mode === 'minus' ? p.p! - y : p.p! + y;
        const s2 = p.mode === 'plus' ? p.q! + y : p.q! - y;
        if (s1 <= 0 || s2 <= 0) continue;
        // C at origin, B on the x-axis at distance s2, A at distance s1 from C and r from B
        const Cc: Pt = [0, 0];
        const Bb: Pt = [s2, 0];
        const Aa = fromSides(Cc, Bb, s1, p.r!);
        if (!Aa) continue;
        samples.push([angleAt(Cc, Aa, Bb), 90]);
      }
    } else {
      const thetas = p.right ? [90] : [...Array.from({ length: 179 }, (_, i) => i + 0.5), 90];
      for (const t of thetas) {
        const C: Pt = [0, 0];
        const B: Pt = [p.b!, 0];
        const A = mul(dir(t), p.a!);
        samples.push([p.kind === 'area' ? shoelace([A, B, C]) : dist(A, B), p.N!]);
      }
    }
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

export const readingTemplates = [pointOnSide, linesLookQC, mustBeTrue, rightAngleQC];
