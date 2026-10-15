import { flaggedChoices } from '../../../engine/build';
import type { Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { Redraw, retryAll } from '../redraw';
import { mulberry } from './lines';

/* Points on a circle, figure not drawn to scale: which statements must be true? (MCM) */

export const circleMustTraps: Record<string, Trap> = {
  'geo-fig-circ-looks': {
    label: 'Accepted something because the drawing makes it look true',
    fix: 'A right angle, an equal pair of chords or a "diameter" that only looks right is not given. Use only what the statement says and what circle theorems force; ask whether you can move a point and break the statement.',
  },
  'geo-fig-circ-arc': {
    label: 'Used the inscribed-angle rule for a point that may sit on the other arc',
    fix: 'An inscribed angle is half of the central angle only when its vertex is on the MAJOR arc (the side of the chord that holds the center). On the minor arc it is $180^\\circ$ minus that half.',
  },
  'geo-fig-circ-boundary': {
    label: 'Used a strict inequality where equality can happen',
    fix: 'A chord is at most as long as the diameter, and it equals the diameter when the chord passes through the center. "Less than" needs a reason that rules this case out.',
  },
};

type Info = 'none' | 'diam' | 'notdiam' | 'major' | 'pe';
type Id = 'radii' | 'base' | 'chord' | 'chordStrict' | 'eq' | 'right' | 'half' | 'pe' | 'tri' | 'sum' | 'gt' | 'pa';
interface Params {
  info: Info;
  stmts: Id[];
  names: string[];
}

const SETS: string[][] = [
  ['A', 'B', 'P'],
  ['X', 'Y', 'Z'],
  ['K', 'L', 'M'],
  ['R', 'S', 'T'],
];

interface Cfg {
  A: P2;
  B: P2;
  P: P2;
}
const dist = (u: P2, v: P2) => Math.hypot(u[0] - v[0], u[1] - v[1]);
const ang = (V: P2, U: P2, W: P2) => {
  const a = [U[0] - V[0], U[1] - V[1]];
  const b = [W[0] - V[0], W[1] - V[1]];
  return Math.atan2(Math.abs(a[0] * b[1] - a[1] * b[0]), a[0] * b[0] + a[1] * b[1]);
};
const O: P2 = [0, 0];
const EPS = 1e-9;

const STMT: Record<Id, { text: (n: string[]) => string; holds: (c: Cfg) => boolean; truth: Info[]; trap: string }> = {
  radii: { text: (n) => `$O${n[0]} = O${n[1]}$`, holds: (c) => Math.abs(dist(O, c.A) - dist(O, c.B)) < EPS, truth: ['none', 'diam', 'notdiam', 'major', 'pe'], trap: '' },
  base: { text: (n) => `$\\angle O${n[0]}${n[1]} = \\angle O${n[1]}${n[0]}$`, holds: (c) => Math.abs(ang(c.A, O, c.B) - ang(c.B, O, c.A)) < EPS, truth: ['none', 'diam', 'notdiam', 'major', 'pe'], trap: '' },
  chord: { text: (n) => `$${n[0]}${n[1]} \\le 2 \\cdot O${n[0]}$`, holds: (c) => dist(c.A, c.B) <= 2 * dist(O, c.A) + EPS, truth: ['none', 'diam', 'notdiam', 'major', 'pe'], trap: '' },
  chordStrict: { text: (n) => `$${n[0]}${n[1]} < 2 \\cdot O${n[0]}$`, holds: (c) => dist(c.A, c.B) < 2 * dist(O, c.A) - EPS, truth: ['notdiam', 'major'], trap: 'geo-fig-circ-boundary' },
  eq: { text: (n) => `$${n[0]}${n[1]} = O${n[0]}$`, holds: (c) => Math.abs(dist(c.A, c.B) - dist(O, c.A)) < EPS, truth: [], trap: 'geo-fig-circ-looks' },
  right: { text: (n) => `$\\angle ${n[0]}${n[2]}${n[1]} = 90^\\circ$`, holds: (c) => Math.abs(ang(c.P, c.A, c.B) - Math.PI / 2) < 1e-7, truth: ['diam'], trap: 'geo-fig-circ-looks' },
  half: { text: (n) => `$\\angle ${n[0]}O${n[1]} = 2 \\cdot \\angle ${n[0]}${n[2]}${n[1]}$`, holds: (c) => Math.abs(ang(O, c.A, c.B) - 2 * ang(c.P, c.A, c.B)) < 1e-7, truth: ['diam', 'major'], trap: 'geo-fig-circ-arc' },
  pe: { text: (n) => `$${n[2]}${n[0]} = ${n[2]}${n[1]}$`, holds: (c) => Math.abs(dist(c.P, c.A) - dist(c.P, c.B)) < 1e-7, truth: ['pe'], trap: 'geo-fig-circ-looks' },
  tri: { text: (n) => `$${n[2]}${n[0]} + ${n[2]}${n[1]} > ${n[0]}${n[1]}$`, holds: (c) => dist(c.P, c.A) + dist(c.P, c.B) > dist(c.A, c.B) + EPS, truth: ['none', 'diam', 'notdiam', 'major', 'pe'], trap: '' },
  sum: {
    text: (n) => `$\\angle ${n[2]}${n[0]}${n[1]} + \\angle ${n[2]}${n[1]}${n[0]} + \\angle ${n[0]}${n[2]}${n[1]} = 180^\\circ$`,
    holds: (c) => Math.abs(ang(c.A, c.P, c.B) + ang(c.B, c.P, c.A) + ang(c.P, c.A, c.B) - Math.PI) < 1e-7,
    truth: ['none', 'diam', 'notdiam', 'major', 'pe'],
    trap: '',
  },
  gt: { text: (n) => `$\\angle ${n[0]}O${n[1]} > \\angle ${n[0]}${n[2]}${n[1]}$`, holds: (c) => ang(O, c.A, c.B) > ang(c.P, c.A, c.B) + 1e-9, truth: ['diam', 'major'], trap: 'geo-fig-circ-arc' },
  pa: { text: (n) => `$${n[2]}${n[0]} \\le 2 \\cdot O${n[2]}$`, holds: (c) => dist(c.P, c.A) <= 2 * dist(O, c.P) + EPS, truth: ['none', 'diam', 'notdiam', 'major', 'pe'], trap: '' },
};
const ALL = Object.keys(STMT) as Id[];

const unit = (deg: number): P2 => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
const side = (A: P2, B: P2, X: P2) => Math.sign((B[0] - A[0]) * (X[1] - A[1]) - (B[1] - A[1]) * (X[0] - A[0]));

/** A random drawing that obeys the information, including the special positions (diameter, opposite points). */
function sample(info: Info, r: () => number): Cfg {
  const grid = () => 30 * Math.floor(r() * 12);
  const pickAngle = () => (r() < 0.5 ? grid() : r() * 360);
  for (let tries = 0; tries < 200; tries++) {
    const a = pickAngle();
    let b = pickAngle();
    let p = pickAngle();
    if (info === 'diam') b = a + 180;
    else if (r() < 0.2) b = a + 180;
    if (info === 'pe') p = (a + b) / 2 + (r() < 0.5 ? 0 : 180);
    else if (r() < 0.2) p = a + 180;
    const A = unit(a);
    const B = unit(b);
    const P = unit(p);
    if (dist(A, B) < 1e-6 || dist(P, A) < 1e-6 || dist(P, B) < 1e-6) continue;
    const diam = Math.abs(dist(A, B) - 2) < 1e-9;
    if (info === 'notdiam' && diam) continue;
    if (info === 'major') {
      if (diam) continue;
      if (side(A, B, P) !== side(A, B, O) || side(A, B, P) === 0) continue;
    }
    if (info === 'pe' && Math.abs(dist(P, A) - dist(P, B)) > 1e-7) continue;
    return { A, B, P };
  }
  throw new Error('no drawing');
}

const mustCircle: Template<Params> = {
  id: 'geo.figure-reasoning.circle-must-be-true-mcm',
  skill: 'geo.figure-reasoning',
  format: 'mcm',
  style: 'points on a circle, figure not to scale: which statements about chords and angles must be true?',
  generate(rng, d) {
    const names = rng.pick(SETS);
    const info: Info = rng.pick(d === 1 ? (['none', 'diam', 'none'] as const) : d === 2 ? (['none', 'diam', 'notdiam', 'major'] as const) : (['major', 'pe', 'notdiam', 'diam', 'none'] as const));
    const trueIds = ALL.filter((id) => STMT[id].truth.includes(info));
    const falseIds = ALL.filter((id) => !STMT[id].truth.includes(info));
    const total = d === 1 ? 5 : 6;
    const nFalse = Math.min(falseIds.length, rng.int(2, 4));
    const nTrue = total - nFalse;
    if (nFalse < 2 || nTrue < 1 || nTrue > 4 || trueIds.length < nTrue) throw new Redraw('not enough statements');
    // the "looks true" statements are what the drawing suggests, so keep at least one of them in the false ones
    const chosenFalse = rng.shuffle(falseIds).slice(0, nFalse);
    const chosenTrue = rng.shuffle(trueIds).slice(0, nTrue);
    if (!chosenFalse.some((id) => STMT[id].trap === 'geo-fig-circ-looks')) throw new Redraw('no looks statement');
    const stmts = rng.shuffle([...chosenFalse, ...chosenTrue]);
    const truth = stmts.map((id) => STMT[id].truth.includes(info));
    const { choices, answer } = flaggedChoices(stmts.map((id, i) => ({ text: STMT[id].text(names), correct: truth[i], ...(!truth[i] ? { trap: STMT[id].trap } : {}) })));
    const [nA, nB, nP] = names;
    const infoText: Record<Info, string> = {
      none: '',
      diam: `, and $${nA}${nB}$ passes through $O$`,
      notdiam: `, and $${nA}${nB}$ is not a diameter`,
      major: `, and $${nP}$ and $O$ lie on the same side of line $${nA}${nB}$`,
      pe: `, and $${nP}${nA} = ${nP}${nB}$`,
    };
    // figure: A and B nearly opposite (but not exactly unless given), P near the top, so the drawing suggests many wrong things
    const aDeg = 205;
    const bDeg = info === 'diam' ? 25 : info === 'pe' ? 335 : 340;
    const pDeg = info === 'pe' ? (aDeg + bDeg) / 2 + 180 : info === 'major' ? 100 : 95;
    const R = 2.4;
    const at = (deg: number): P2 => [R * unit(deg)[0], R * unit(deg)[1]];
    const fig = new Fig();
    fig.pt('O', [0, 0], [0.5, -0.6]).pt(nA, at(aDeg), [-1, -0.2]).pt(nB, at(bDeg), [1, -0.2]).pt(nP, at(pDeg), [0, 1]);
    fig.circle('O', R).seg(nA, nB).seg(nP, nA).seg(nP, nB).seg('O', nA).seg('O', nB);
    const bullet = (id: Id, i: number) => `- ${choices[i].text}: ${REASON(id, info, names, truth[i])} ${truth[i] ? '(true)' : '(not forced)'}`;
    const lines = stmts.map(bullet).join('\n');
    return {
      params: { info, stmts, names },
      q: {
        format: 'mcm',
        stem: `In the figure, which is not drawn to scale, $${nA}$, $${nB}$, and $${nP}$ are distinct points on a circle with center $O$${infoText[info]}. Which of the following statements must be true?`,
        instruction: 'Indicate all such statements.',
        figure: fig.build(true),
        choices,
        answer,
        explanation: `Recognize: the drawing is not to scale, so a statement must be true for EVERY way of placing the points that fits the information. One placement that breaks it is enough to reject it.

${lines}

Rule: keep what the circle forces (equal radii, inscribed angles on the correct arc, the chord at most the diameter) and test each other statement by moving a point.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'format';
    const r = mulberry(7001 + p.info.length * 13);
    const cfgs = Array.from({ length: 700 }, () => sample(p.info, r));
    const exp = p.stmts.flatMap((id, i) => (cfgs.every((c) => STMT[id].holds(c)) ? [i] : []));
    return JSON.stringify(exp) === JSON.stringify(q.answer) ? null : `expected ${JSON.stringify(exp)}`;
  },
};

function REASON(id: Id, info: Info, n: string[], ok: boolean): string {
  const [a, b, pp] = n;
  switch (id) {
    case 'radii':
      return `both are radii of the circle`;
    case 'base':
      return `triangle $O${a}${b}$ has two equal radii, so its base angles are equal`;
    case 'chord':
      return `no chord is longer than a diameter`;
    case 'chordStrict':
      return ok ? `${info === 'major' ? '$O$ is off the chord, so' : 'the chord is not a diameter, so'} it is shorter than a diameter` : `if $${a}${b}$ passes through $O$ it equals the diameter`;
    case 'eq':
      return info === 'diam' ? `a diameter is twice a radius, never equal to it` : `the chord only looks as long as a radius; nothing fixes its length`;
    case 'right':
      return ok ? `an angle inscribed in a semicircle is a right angle` : `a right angle needs $${a}${b}$ to be a diameter, and it need not be`;
    case 'half':
      return ok ? (info === 'diam' ? `the central angle is $180^\\circ$ and the inscribed angle $90^\\circ$` : `$${pp}$ is on the same side as $O$, the larger arc, where the inscribed angle is half the central one`) : `if $${pp}$ is on the smaller arc the inscribed angle is $180^\\circ$ minus half the central angle`;
    case 'pe':
      return ok ? `given` : `$${pp}$ is not fixed to be halfway between $${a}$ and $${b}$`;
    case 'tri':
      return `$${pp}$ is not on line $${a}${b}$, so the sum of two sides of triangle $${pp}${a}${b}$ exceeds the third`;
    case 'sum':
      return `the three angles of triangle $${pp}${a}${b}$ add to $180^\\circ$`;
    case 'gt':
      return ok ? `the central angle is double the inscribed one here, and a positive angle doubled is larger` : `on the smaller arc the inscribed angle can exceed the central one`;
    default:
      return `$${pp}${a}$ is a chord, so it is at most the diameter $2 \\cdot O${pp}$`;
  }
}

export const circleMustTemplates = retryAll([mustCircle]);
