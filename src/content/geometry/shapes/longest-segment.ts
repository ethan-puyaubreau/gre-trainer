import { textChoices } from '../../../engine/build';
import type { Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* A point D on side BC of triangle ABC, angles given, figure not to scale: which segment is the longest (or shortest)? (MCS) */

export const longestSegmentTraps: Record<string, Trap> = {
  'geo-fig-looks-extreme': {
    label: 'Picked the segment that looks longest (or shortest) in the drawing',
    fix: 'The figure is not drawn to scale. Use only the angle measures: in a triangle the longest side is across from the largest angle and the shortest is across from the smallest.',
  },
  'geo-fig-adjacent-angle': {
    label: 'Picked a side that forms the extreme angle instead of the side across from it',
    fix: 'A side is compared with the angle OPPOSITE it, the one that does not touch the side. The largest angle sits across from the longest side.',
  },
};

interface Params {
  theta: number; // angle ADB
  b: number; // angle at B
  c: number; // angle at C
  ask: 'longest' | 'shortest';
  names: string[]; // A, B, C, D
  answerText: string;
  choiceTexts: string[];
}

const SETS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['P', 'Q', 'R', 'S'],
  ['X', 'Y', 'Z', 'W'],
  ['K', 'L', 'M', 'N'],
  ['E', 'F', 'G', 'H'],
];

const deg = (v: number) => `$${v}^\\circ$`;

const longestSegment: Template<Params> = {
  id: 'geo.figure-reasoning.longest-segment-mcs',
  skill: 'geo.figure-reasoning',
  format: 'mcs',
  style: 'two triangles sharing a side: which segment do the angles force to be longest or shortest?',
  generate(rng, d) {
    const [nA, nB, nC, nD] = rng.pick(SETS);
    const ask: Params['ask'] = d === 1 ? 'longest' : d === 2 ? 'shortest' : rng.pick(['longest', 'shortest']);
    // sides: AB AD BD (triangle 1), AC AD DC (triangle 2); angles: theta = ADB, 180 - theta = ADC
    const names = { AB: nA + nB, AD: nA + nD, BD: nB + nD, AC: nA + nC, DC: nD + nC };
    type Seg = keyof typeof names;
    const segs = Object.keys(names) as Seg[];
    let found: { theta: number; b: number; c: number; answer: Seg } | null = null;
    for (let tries = 0; tries < 400 && !found; tries++) {
      const theta = rng.int(35, 145);
      if (Math.abs(theta - 90) < 6) continue;
      const b = rng.int(15, 164 - theta);
      const c = rng.int(15, theta - 15);
      const bad = 180 - theta - b; // angle at A in triangle 1
      const cad = theta - c; // angle at A in triangle 2
      const adc = 180 - theta;
      const t1 = [b, bad, theta];
      const t2 = [c, cad, adc];
      if (new Set(t1).size < 3 || new Set(t2).size < 3 || bad < 10 || cad < 10) continue;
      // each side with the angle across from it
      const opp: Record<Seg, number> = { AD: b, BD: bad, AB: theta, AC: adc, DC: cad };
      // facts "x > y" from each triangle
      const gt: Record<string, Set<string>> = Object.fromEntries(segs.map((s) => [s, new Set<string>()]));
      for (const tri of [['AD', 'BD', 'AB'], ['AD', 'AC', 'DC']] as Seg[][]) {
        // triangle 2: AD is across from the angle at C
        const o = (s: Seg) => (tri.includes('AC') && s === 'AD' ? c : opp[s]);
        for (const x of tri) for (const y of tri) if (o(x) > o(y)) gt[x].add(y);
      }
      // transitive closure
      for (let rep = 0; rep < 5; rep++) for (const x of segs) for (const y of [...gt[x]]) for (const z of gt[y]) gt[x].add(z);
      const top = segs.filter((s) => gt[s].size === 4);
      const bottom = segs.filter((s) => segs.every((o) => o === s || gt[o].has(s)));
      const cand = ask === 'longest' ? top : bottom;
      if (cand.length === 1) found = { theta, b, c, answer: cand[0] };
    }
    if (!found) throw new Redraw('no forced extreme');
    const { theta, b, c, answer } = found;
    const bad = 180 - theta - b;
    const cad = theta - c;
    const adc = 180 - theta;
    // a drawing in which the answer is not the visual extreme, and the visual extreme is a unique segment
    let pts: Record<string, P2> | null = null;
    let looks: Seg | null = null;
    for (let tries = 0; tries < 80 && !pts; tries++) {
      const w = 7 + 3 * rng.next();
      const dx = 2.2 + (w - 4.4) * rng.next();
      const A: P2 = [dx + 3 * (rng.next() - 0.5), 2.6 + 2.6 * rng.next()];
      const P = { A, B: [0, 0] as P2, C: [w, 0] as P2, D: [dx, 0] as P2 };
      const len = (s: Seg): number => {
        const p = P[s[0] as 'A'];
        const q = P[s[1] as 'A'];
        return Math.hypot(p[0] - q[0], p[1] - q[1]);
      };
      // Seg keys are two-letter keys over the canonical letters A,B,C,D
      const ranked = [...segs].sort((x, y) => (ask === 'longest' ? len(y) - len(x) : len(x) - len(y)));
      const gap = Math.abs(len(ranked[0]) - len(ranked[1])) / len(ranked[0]);
      if (ranked[0] !== answer && gap > 0.08) {
        pts = P;
        looks = ranked[0];
      }
    }
    if (!pts || !looks) throw new Redraw('no misleading drawing');
    // the sides that form the extreme angle in the answer's triangle
    const tri1: Seg[] = ['AB', 'AD', 'BD'];
    const tri2: Seg[] = ['AC', 'AD', 'DC'];
    const inTri = answer === 'AD' || tri1.includes(answer) ? tri1 : tri2;
    const adjacent = rng.shuffle(inTri.filter((s) => s !== answer && s !== looks));
    const trapped = new Map<Seg, string>([[looks, 'geo-fig-looks-extreme']]);
    if (adjacent.length) trapped.set(adjacent[0], 'geo-fig-adjacent-angle');
    const text = (s: Seg) => `$${names[s]}$`;
    const wrong = segs.filter((s) => s !== answer).map((s) => ({ text: text(s), ...(trapped.has(s) ? { trap: trapped.get(s) } : {}) }));
    const { choices, answer: ans } = textChoices(rng, text(answer), wrong);
    const fig = new Fig();
    const labelAt = (n: string, p: P2, off: P2) => fig.pt(n, p, off);
    labelAt(nA, pts.A, [0, 1]);
    labelAt(nB, pts.B, [-1, -0.6]);
    labelAt(nC, pts.C, [1, -0.6]);
    labelAt(nD, pts.D, [0, -1]);
    fig.poly([nA, nB, nC]).seg(nA, nD).angleLabel(nA, nB, nD, deg(b)).angleLabel(nB, nA, nD, deg(bad)).angleLabel(nD, nA, nC, deg(cad)).angleLabel(nA, nC, nD, deg(c));
    if (d === 3) fig.angleLabel(nA, nD, nC, deg(adc));
    else fig.angleLabel(nB, nD, nA, deg(theta));
    const side = (s: Seg) => names[s];
    const ord = (xs: Seg[], key: (s: Seg) => number) => [...xs].sort((x, y) => key(y) - key(x)).map((s) => side(s)).join(' > ');
    const key1 = (s: Seg) => ({ AD: b, BD: bad, AB: theta, AC: 0, DC: 0 })[s];
    const key2 = (s: Seg) => ({ AD: c, AC: adc, DC: cad, AB: 0, BD: 0 })[s];
    const ext = ask === 'longest' ? 'longest' : 'shortest';
    const notes = trapNotes(
      choices,
      {
        'geo-fig-looks-extreme': (vs) => `${vs} looks ${ext} in the drawing, but the figure is not to scale`,
        'geo-fig-adjacent-angle': (vs) => `${vs} is a side that touches the ${ask === 'longest' ? 'largest' : 'smallest'} angle of its triangle instead of lying across from it`,
      },
      2,
    );
    const stem = `In the figure, point $${nD}$ lies on side $${nB}${nC}$ of triangle $${nA}${nB}${nC}$. Which of the segments $${names.AB}$, $${names.AC}$, $${names.AD}$, $${names.BD}$ and $${names.DC}$ must be the ${ext}?`;
    return {
      params: { theta, b, c, ask, names: [nA, nB, nC, nD], answerText: text(answer), choiceTexts: choices.map((x) => x.text) },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(true),
        choices,
        answer: ans,
        explanation: `Recognize: the figure is not to scale, so compare lengths only through the angles. In a triangle the longest side lies across from the largest angle and the shortest across from the smallest.

Since $${nD}$ is on $${nB}${nC}$, angle $${nA}${nD}${d === 3 ? nB : nC}$ is $180^\\circ - ${d === 3 ? adc : theta}^\\circ = ${d === 3 ? theta : adc}^\\circ$. Triangle $${nA}${nB}${nD}$ has angles ${deg(b)}, ${deg(bad)} and ${deg(theta)}, so $${ord(tri1, key1)}$. Triangle $${nA}${nD}${nC}$ has angles ${deg(c)}, ${deg(cad)} and ${deg(adc)}, so $${ord(tri2, key2)}$.

The triangles share $${names.AD}$, which links the two orders. Together they make $${names[answer]}$ the ${ext} of all five.

${notes}

Rule: order the sides inside each triangle by the opposite angles, then chain the triangles through their shared side.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // law of sines with the shared segment AD = 1
    const r = (x: number) => (x * Math.PI) / 180;
    const bad = 180 - p.theta - p.b;
    const cad = p.theta - p.c;
    const adc = 180 - p.theta;
    const [nA, nB, nC, nD] = p.names;
    const len: Record<string, number> = {
      [nA + nB]: Math.sin(r(p.theta)) / Math.sin(r(p.b)),
      [nA + nD]: 1,
      [nB + nD]: Math.sin(r(bad)) / Math.sin(r(p.b)),
      [nA + nC]: Math.sin(r(adc)) / Math.sin(r(p.c)),
      [nD + nC]: Math.sin(r(cad)) / Math.sin(r(p.c)),
    };
    const entries = Object.entries(len).sort((x, y) => (p.ask === 'longest' ? y[1] - x[1] : x[1] - y[1]));
    const expected = `$${entries[0][0]}$`;
    if (q.choices[q.answer].text !== expected) return `expected ${expected}`;
    return entries[0][1] === entries[1][1] ? 'tie' : null;
  },
};

export const longestSegmentTemplates = retryAll([longestSegment]);
