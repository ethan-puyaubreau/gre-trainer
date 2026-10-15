import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from './fig';
import { Redraw, retryAll } from '../redraw';
import { qcTraps } from '../shapes/util';

/* Tangent segment from an outside point against a number, the radius, half of OP or OP - r (QC, with ranges for r). */

export const tangentQcTraps: Record<string, Trap> = {
  'geom-tan-d-minus-r': {
    label: 'Took the tangent length to be OP - r',
    fix: 'OP - r is the gap from P to the nearest point of the circle, along the line through the center. The tangent goes to T, off to the side: it is a leg of the right triangle OTP, so $PT = \\sqrt{OP^2 - r^2}$, which is longer than OP - r.',
  },
  'geom-tan-needs-more': {
    label: 'Said "cannot be determined" although the numbers or the range fix the relation',
    fix: 'List what is allowed (the integers in the range, with r smaller than OP) and test the two ends. If both give the same relation, so does everything between them.',
  },
  'geom-tan-one-test': {
    label: 'Decided from a single value of r',
    fix: 'A range of values of r can sit on both sides of the threshold. Find the value of r where the two quantities are equal and see whether the allowed integers are all on one side.',
  },
};

type Kind = 'num' | 'radius' | 'half' | 'dr';
interface Params {
  kind: Kind;
  d: number;
  r: number;
  k: number;
  lo: number;
  hi: number;
  swap: boolean;
}

const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]];

const other = (kind: Kind, d: number, r: number) => (kind === 'radius' ? r : kind === 'half' ? d / 2 : d - r);
const letter = (a: number, b: number): QCChoice => (a > b ? 'A' : a < b ? 'B' : 'C');
const flip = (l: QCChoice, swap: boolean): QCChoice => (!swap ? l : l === 'A' ? 'B' : l === 'B' ? 'A' : l);
/** Relation of PT to the other quantity, in integers (PT^2 = d^2 - r^2). A means PT is larger. */
function exact(kind: Kind, d: number, r: number): QCChoice {
  const p2 = d * d - r * r;
  if (kind === 'radius') return letter(p2, r * r);
  if (kind === 'half') return letter(4 * p2, d * d);
  return letter(p2, (d - r) ** 2);
}

const tangentQc: Template<Params> = {
  id: 'geo.circles.tangent-qc',
  skill: 'geo.circles',
  format: 'qc',
  style: 'tangent length from an outside point against a number, the radius, half of OP or OP - r',
  generate(rng, dif) {
    const swap = rng.chance(0.5);
    const fig = new Fig();
    let kind: Kind;
    let d: number;
    let r = 0;
    let k = 0;
    let lo = 0;
    let hi = 0;
    let answer: QCChoice; // PT against the other quantity: A = PT larger
    let cond: string;
    let body: string;
    const tr: Partial<Record<QCChoice, string>> = {};
    if (dif === 1) {
      kind = 'num';
      const [a, b, c] = rng.pick(TRIPLES);
      const m = rng.int(1, Math.floor(60 / c));
      const legR = rng.chance(0.5);
      r = (legR ? a : b) * m;
      const t = (legR ? b : a) * m;
      d = c * m;
      k = t + (rng.chance(0.3) ? 0 : rng.sign() * rng.int(1, 3));
      answer = letter(t, k);
      const wrong = letter(d - r, k);
      if (wrong !== answer) tr[wrong] = 'geom-tan-d-minus-r';
      cond = `The circle has radius ${r}.`;
      body = `Here $PT = \\sqrt{OP^2 - r^2} = \\sqrt{${d}^2 - ${r}^2} = \\sqrt{${d * d - r * r}} = ${t}$. Compared with $${k}$, $PT$ is ${answer === 'C' ? 'equal' : answer === 'A' ? 'larger' : 'smaller'}.

Check: $${r}^2 + ${t}^2 = ${r * r + t * t} = ${d}^2$.`;
    } else {
      kind = rng.pick(dif === 2 ? (['radius', 'radius', 'half', 'half', 'dr'] as Kind[]) : (['radius', 'half', 'half', 'dr'] as Kind[]));
      d = dif === 2 ? rng.int(8, 24) : rng.int(25, 60);
      const star = kind === 'radius' ? d / Math.SQRT2 : (d * Math.sqrt(3)) / 2; // PT equals the other quantity at r = star
      const fl = Math.floor(star);
      const ce = Math.ceil(star);
      const want: QCChoice = kind === 'dr' ? 'A' : rng.pick(['A', 'B', 'D', 'D']);
      if (kind === 'dr') {
        lo = 1;
        hi = d - 1;
      } else if (want === 'A') {
        lo = rng.int(1, Math.max(1, fl - 2));
        hi = rng.int(lo, fl);
      } else if (want === 'B') {
        hi = rng.int(Math.min(ce + 1, d - 1), d - 1);
        lo = rng.int(ce, hi);
      } else {
        lo = rng.int(1, Math.max(1, fl - 1));
        hi = rng.int(Math.min(ce + 1, d - 1), d - 1);
      }
      if (kind !== 'dr' && hi <= lo) throw new Redraw('one-value range');
      const same = exact(kind, d, lo) === exact(kind, d, hi);
      answer = same ? exact(kind, d, lo) : 'D';
      if (kind !== 'dr' && answer !== want) throw new Redraw('range does not give the planned relation');
      const oneSided = dif === 3 && kind !== 'dr' && hi === d - 1 && rng.chance(0.7);
      cond =
        kind === 'dr'
          ? `The circle has radius $r$, where $0 < r < ${d}$.`
          : oneSided
            ? `The circle has radius $r$, where $r$ is an integer and $r \\ge ${lo}$.`
            : `The circle has radius $r$, where $r$ is an integer and $${lo} \\le r \\le ${hi}$.`;
      if (answer !== 'D') tr.D = 'geom-tan-needs-more';
      else tr[exact(kind, d, lo)] = 'geom-tan-one-test';
      if (kind === 'dr') {
        tr.C = 'geom-tan-d-minus-r';
        body = `Here $PT^2 = OP^2 - r^2 = (OP - r)(OP + r)$. Since $OP + r > OP - r > 0$, this is larger than $(OP - r)^2$, so $PT > OP - r$ for every allowed $r$. For instance $r = ${Math.floor(d / 2)}$ gives $PT = \\sqrt{${d * d - Math.floor(d / 2) ** 2}} \\approx ${Math.sqrt(d * d - Math.floor(d / 2) ** 2).toFixed(1)}$ against $OP - r = ${d - Math.floor(d / 2)}$.`;
      } else {
        const oth = kind === 'radius' ? '$r$' : `half of $OP$, which is $${d / 2}$,`;
        const threshold = kind === 'radius' ? '$r = \\frac{OP}{\\sqrt{2}}$' : '$r = \\frac{\\sqrt{3}}{2} \\cdot OP$';
        const rel = (x: number) =>
          `$r = ${x}$ gives $PT = \\sqrt{${d * d - x * x}} \\approx ${Math.sqrt(d * d - x * x).toFixed(1)}$ against $${kind === 'radius' ? x : d / 2}$`;
        body =
          answer === 'D'
            ? `$PT$ equals ${oth} when ${threshold}, about $${star.toFixed(1)}$ here. The allowed integers lie on both sides of it: ${rel(lo)}, but ${rel(hi)}. Two allowed values disagree.`
            : `$PT$ equals ${oth} when ${threshold}, about $${star.toFixed(1)}$ here. Every allowed integer, from $${lo}$ to $${hi}$, is ${answer === 'A' ? 'below' : 'above'} that value, so $PT$ is always ${answer === 'A' ? 'larger' : 'smaller'}. For example ${rel(hi)}.`;
      }
    }
    const ptText = 'The length of $PT$';
    const othText = kind === 'num' ? `$${k}$` : kind === 'radius' ? '$r$' : kind === 'half' ? `$${d / 2}$` : '$OP - r$';
    const finalAnswer = flip(answer, swap);
    const rr = kind === 'num' ? r : kind === 'half' ? d * 0.45 : d * 0.4;
    const T: P2 = [(rr * rr) / d, (rr * Math.sqrt(d * d - rr * rr)) / d];
    fig.pt('O', [0, 0], [-0.8, -0.7]).pt('P', [d, 0], [0.8, -0.7]).pt('T', T, [0, 1]);
    fig.circle('O', rr);
    fig.seg('O', 'P', `$${d}$`).seg('O', 'T', kind === 'num' ? `$${r}$` : '$r$').seg('P', 'T');
    fig.right('O', 'T', 'P');
    const flipped: Partial<Record<QCChoice, string>> = {};
    for (const [l, t] of Object.entries(tr)) flipped[flip(l as QCChoice, swap)] = t;
    const q: QCQuestion = {
      format: 'qc',
      figure: fig.build(kind !== 'num'),
      info: `Point $P$ lies outside a circle with center $O$, $OP = ${d}$, and $PT$ is tangent to the circle at $T$. ${cond}`,
      quantityA: swap ? othText : ptText,
      quantityB: swap ? ptText : othText,
      answer: finalAnswer,
      traps: qcTraps(finalAnswer, flipped),
      explanation: `A tangent is perpendicular to the radius at the point of tangency, so $OTP$ is a right triangle with its right angle at $T$, legs $r$ and $PT$, and hypotenuse $OP$.

${body} So the answer is ${finalAnswer}.

Trap: ${kind === 'num' ? `using $OP - r = ${d - r}$ for $PT$; that is only the gap along the line through the center` : kind === 'dr' ? 'thinking the two quantities are equal; $OP - r$ is the gap along the line $OP$, always shorter than the tangent' : answer === 'D' ? 'stopping after one value of $r$' : 'answering D because $r$ is not a single number; here every allowed integer is on the same side of the threshold'}.

Rule: the tangent length from $P$ is $\\sqrt{OP^2 - r^2}$, and $r$ stays below $OP$ because $P$ is outside.`,
    };
    return { params: { kind, d, r, k, lo, hi, swap }, q };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    // coordinates: O at the origin, P at (d, 0); T is the point of the circle where OT is perpendicular to TP
    const ptOf = (r: number) => {
      const T: P2 = [(r * r) / p.d, (r * Math.sqrt(p.d * p.d - r * r)) / p.d];
      return Math.hypot(p.d - T[0], T[1]);
    };
    const samples: [number, number][] = [];
    if (p.kind === 'num') samples.push([ptOf(p.r), p.k]);
    else for (let r = p.lo; r <= p.hi; r++) samples.push([ptOf(r), other(p.kind, p.d, r)]);
    const exp = qcFromSamples(p.swap ? samples.map(([a, b]) => [b, a] as [number, number]) : samples);
    return exp === q.answer ? null : `expected ${exp}`;
  },
};

export const tangentQcTemplates = retryAll([tangentQc]);
