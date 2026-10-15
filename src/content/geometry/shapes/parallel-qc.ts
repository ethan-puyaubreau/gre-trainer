import { bisect } from './fig';
import { qcCompareNum, qcFromSamples } from '../../../engine/build';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { Redraw, retryAll } from '../redraw';
import { POSITIONS, drawPhi, isPhiType, measured, relName, transversalFigure, type Pos } from './lines';
import { QC_SAY, qcTraps } from './util';

/* Compare two angles at a transversal: sometimes the lines are parallel, sometimes only the picture says so (QC). */

export const parallelQcTraps: Record<string, Trap> = {
  'geo-qc-assumed-parallel': {
    label: 'Treated two lines as parallel because the figure draws them that way',
    fix: 'A figure is not evidence. Unless the problem says the lines are parallel (or marks them), the angles can change: tilt one line a little and the angles at it move.',
  },
};

type Form = 'xy' | 'sum' | 'num';
type Cons = 'none' | 'acute' | 'obtuse';
interface P {
  parallel: boolean;
  pos1: Pos;
  pos2: Pos;
  form: Form;
  cons: Cons;
  a?: number;
  N?: number;
}

const TILTS = [-30, -20, -10, 10, 20, 30];

interface Sample {
  x: number;
  y: number;
  tilt: number;
}
const r1 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Every configuration the statement allows, measured on the drawing (coordinates + atan2). */
function samples(p: P): Sample[] {
  const out: Sample[] = [];
  const tilts = p.parallel ? [0] : [0, ...TILTS];
  for (const tilt of tilts) {
    if (p.form === 'num') {
      const f = (phi: number) => measured(phi, 'P', p.pos1, tilt) - p.a!;
      const phi = bisect(f, 0.5, 179.5);
      if (Math.abs(f(phi)) > 1e-6) continue;
      out.push({ x: p.a!, y: r1(measured(phi, 'Q', p.pos2, tilt)), tilt });
      continue;
    }
    for (let phi = 1; phi < 180; phi++) {
      const x = r1(measured(phi, 'P', p.pos1, tilt));
      if (p.cons === 'acute' && x >= 90) continue;
      if (p.cons === 'obtuse' && x <= 90) continue;
      out.push({ x, y: r1(measured(phi, 'Q', p.pos2, tilt)), tilt });
    }
  }
  return out;
}
const pair = (p: P, s: Sample): [number, number] => (p.form === 'xy' ? [s.x, s.y] : p.form === 'sum' ? [s.x + s.y, 180] : [s.y, p.N!]);

const show = (p: P, s: Sample) => {
  const n = (v: number) => `${Math.round(v)}`;
  const t = s.tilt === 0 ? '' : `, with line $\\ell$ tilted by $${Math.abs(s.tilt)}^\\circ$`;
  return p.form === 'num' ? `$y = ${n(s.y)}$${t}` : `$x = ${n(s.x)}$ and $y = ${n(s.y)}$${t}`;
};

const parallelQc: Template<P> = {
  id: 'geo.lines-angles.parallel-compare-qc',
  skill: 'geo.lines-angles',
  format: 'qc',
  style: 'compare two angles at a transversal when the lines may or may not be parallel',
  generate(rng, d) {
    const kinds: [boolean, Form, Cons][] =
      d === 1
        ? [[true, 'num', 'none'], [true, 'num', 'none'], [true, 'num', 'none'], [false, 'num', 'none']]
        : d === 2
          ? [[true, 'xy', 'none'], [true, 'sum', 'none'], [false, 'xy', 'none'], [true, 'num', 'none']]
          : [[true, 'xy', rng.pick(['acute', 'obtuse'] as const)], [true, 'sum', rng.pick(['acute', 'obtuse'] as const)], [false, 'num', 'none'], [true, 'xy', 'none'], [false, 'sum', 'none']];
    const [parallel, form, cons] = rng.pick(kinds);
    const pos1 = rng.pick(POSITIONS);
    const pos2 = rng.pick(POSITIONS);
    const same = isPhiType(pos1) === isPhiType(pos2);
    if (cons !== 'none' && ((form === 'xy' && same) || (form === 'sum' && !same))) throw new Redraw('constraint would not matter');
    let a: number | undefined;
    let N: number | undefined;
    let ya = 0;
    if (form === 'num') {
      a = rng.pick([35, 40, 45, 50, 55, 60, 65, 70, 75, 110, 115, 120, 125, 130, 135, 140, 145]);
      ya = same ? a : 180 - a;
      N = parallel ? ya + rng.pick(d === 1 ? [-20, -10, 10, 20] : [-20, -10, 0, 0, 10, 20]) : ya;
      if (N === 90 || N <= 0) throw new Redraw('N');
    }
    // answer by the angle theorems
    let answer: QCChoice;
    let altAnswer: QCChoice | undefined; // what the opposite equal/supplementary slip gives
    const cmp = (u: number, v: number): QCChoice => qcCompareNum(u, v);
    if (!parallel) answer = 'D';
    else if (form === 'num') {
      answer = cmp(ya, N!);
      altAnswer = cmp(same ? 180 - a! : a!, N!);
    } else if (form === 'xy') {
      answer = same ? 'C' : cons === 'acute' ? 'B' : cons === 'obtuse' ? 'A' : 'D';
    } else {
      answer = !same ? 'C' : cons === 'acute' ? 'B' : cons === 'obtuse' ? 'A' : 'D';
    }
    const p: P = { parallel, pos1, pos2, form, cons, a, N };
    // the same question measured on the drawing: the examples of the explanation come from here
    const all = samples(p);
    const pool = all.filter((s) => s.x >= 40 && s.x <= 140 && s.y >= 40 && s.y <= 140 && s.x !== 90 && s.y !== 90);
    const dis: [Sample, Sample] | null = (() => {
      if (answer !== 'D') return null;
      for (const src of [pool, all]) {
        const first = src[0];
        const other = src.find((s) => cmp(...pair(p, s)) !== cmp(...pair(p, first)));
        if (other) return [first, other];
      }
      return null;
    })();
    if (answer === 'D' && !dis) throw new Redraw('no disagreeing examples');
    const phiTrue = a === undefined ? 62 : isPhiType(pos1) ? a : 180 - a;
    const marks = [
      { at: 'P' as const, pos: pos1, tex: form === 'num' ? `$${a}^\\circ$` : '$x^\\circ$' },
      { at: 'Q' as const, pos: pos2, tex: '$y^\\circ$' },
    ];
    const dp = drawPhi(phiTrue);
    const figure = { ...transversalFigure(dp, marks), ...(!parallel || dp !== phiTrue || form !== 'num' ? { notToScale: true } : {}) };
    const rel = relName({ at: 'P', pos: pos1 }, { at: 'Q', pos: pos2 });
    const consTxt = cons === 'acute' ? '$x < 90$' : cons === 'obtuse' ? '$x > 90$' : '';
    const info = parallel
      ? `Lines $\\ell$ and $m$ are parallel${consTxt ? ` and ${consTxt}` : ''}.`
      : `Lines $\\ell$ and $m$ are cut by a transversal${consTxt ? `, and ${consTxt}` : ''}.`;
    const quantityA = form === 'xy' ? '$x$' : form === 'sum' ? '$x + y$' : '$y$';
    const quantityB = form === 'xy' ? '$y$' : form === 'sum' ? '$180$' : `$${N}$`;
    // explanation
    const X = form === 'num' ? `${a}` : 'x';
    const relation = same
      ? `are ${rel}, so they are equal: $y = ${X}$`
      : rel
        ? `are ${rel}, so they add up to $180^\\circ$: $y = 180 - ${X}$`
        : `make a straight line with an angle equal to $${X}$, so they add up to $180^\\circ$: $y = 180 - ${X}$`;
    const say = (s: Sample) => QC_SAY[cmp(...pair(p, s))];
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    let body: string;
    if (!parallel) {
      body = `Recognize: the problem never says $\\ell \\parallel m$. The picture only looks parallel, so no relation between the angles is guaranteed.

If the lines were parallel, the two angles ${relation}. But tilt $\\ell$ and the angle at $\\ell$ changes while the angle at $m$ stays. For example, ${show(p, dis ? dis[0] : all[0])}: ${dis ? say(dis[0]) : ''}. But ${show(p, dis![1])}: ${say(dis![1])}.

Trap: reading the figure as parallel gives ${form === 'num' ? 'equal quantities' : 'a fixed answer'}. Without the word "parallel", the answer is D.

Rule: use only what the statement gives, never the look of the figure.`;
    } else if (form === 'num') {
      const alt = same ? 180 - a! : a!;
      body = `Recognize: $\\ell \\parallel m$, so the two angles ${relation}.

So Quantity A is $${ya}$ and Quantity B is $${N}$: ${QC_SAY[answer]}.

Check: ${same ? 'the angles are in matching positions, so equal' : 'one is acute and one obtuse, so supplementary'}.

${altAnswer && altAnswer !== answer ? `Trap: ${same ? 'adding them to $180$' : 'making them equal'} gives $y = ${alt}$ and the wrong comparison.\n\n` : ''}Rule: positions decide equal or supplementary.`;
    } else if (answer === 'D') {
      body = `Recognize: $\\ell \\parallel m$, so the two angles ${relation}. That alone does not say which quantity is larger.

For example, ${show(p, dis![0])}: ${say(dis![0])}. But ${show(p, dis![1])}: ${say(dis![1])}. Both are allowed, so the relationship cannot be determined.

Rule: parallel lines leave only two angle values, but until $x$ is pinned down both cases stay open.`;
    } else {
      const why =
        form === 'xy'
          ? cons === 'none'
            ? `$y = x$`
            : cons === 'acute'
              ? `$y = 180 - x$, and with $x < 90$ we get $y > 90 > x$`
              : `$y = 180 - x$, and with $x > 90$ we get $y < 90 < x$`
          : cons === 'none'
            ? `$x + y = x + (180 - x) = 180$`
            : cons === 'acute'
              ? `$y = x$, so $x + y = 2x < 180$`
              : `$y = x$, so $x + y = 2x > 180$`;
      const x0 = cons === 'obtuse' ? 120 : 60;
      body = `Recognize: $\\ell \\parallel m$, so the two angles ${relation}.

Then ${why}. ${cap(QC_SAY[answer])}.

Check: $x = ${x0}$ gives $y = ${same ? x0 : 180 - x0}$, the same comparison.

Rule: positions decide equal or supplementary; a bound on $x$ settles the order.`;
    }
    const assumed: QCChoice = form === 'num' ? 'C' : form === 'xy' ? (same ? 'C' : 'D') : !same ? 'C' : 'D';
    const traps = !parallel
      ? qcTraps(answer, { [assumed]: 'geo-qc-assumed-parallel' })
      : form === 'num' && altAnswer
        ? qcTraps(answer, { [altAnswer]: same ? 'geo-par-supp-not-equal' : 'geo-par-equal-not-supp' })
        : undefined;
    return { params: p, q: { format: 'qc', info, figure, quantityA, quantityB, answer, traps, explanation: body } };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const s = samples(p);
    if (!s.length) return 'no configuration';
    const exp = qcFromSamples(s.map((v) => pair(p, v)));
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

export const parallelQcTemplates = retryAll([parallelQc]);
