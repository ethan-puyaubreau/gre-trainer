import { textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lcm } from '../../../engine/math';
import { lin } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';
import { Fig, onCircle, type P2 } from './fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Equal circles packed inside a circle (3, 4 or 7): the region left over, or the circles together, in terms of D (MCS). */

export const packingTraps: Record<string, Trap> = {
  'geom-pack-complement': {
    label: 'Gave the other region (the circles instead of the gap, or the gap instead of the circles)',
    fix: 'Reread which area is asked. The gap and the small circles add up to the large circle, so find one and use the large circle to get the other.',
  },
  'geom-pack-one-circle': {
    label: 'Counted a single small circle',
    fix: 'There are several identical circles. Multiply the area of one by their number before you subtract from the large circle.',
  },
  'geom-pack-count-off': {
    label: 'Miscounted the small circles',
    fix: 'Count the circles in the figure, including one at the center if there is one. Seven circles means one in the middle and six around it.',
  },
  'geom-pack-diameters-add': {
    label: 'Assumed the small diameters add up to the large diameter',
    fix: 'Small circles are not lined up along one diameter. Use the centers: they form a triangle, a square or a hexagon, and the large radius is a small radius plus the distance from the middle to a center.',
  },
};

type Ask = 'gap' | 'circles' | 'ratio';
interface Params {
  n: number;
  k: number;
  ask: Ask;
  vals: number[];
  textOfRight: string;
}

/** f = r / R and the exact value of f^2, for the packing of n circles. */
const PACK: Record<number, { f2: [Frac, Frac, number]; f: number }> = {
  7: { f2: [new Frac(1, 9), new Frac(0), 2], f: 1 / 3 },
  4: { f2: [new Frac(3), new Frac(-2), 2], f: Math.SQRT2 - 1 },
  3: { f2: [new Frac(21), new Frac(-12), 3], f: 2 * Math.sqrt(3) - 3 },
};

/** a + b sqrt(s), in units of the large circle's area (or of pi D^2). */
interface Q {
  a: Frac;
  b: Frac;
  s: number;
}
const val = (q: Q) => q.a.toNumber() + q.b.toNumber() * Math.sqrt(q.s);
const scale = (q: Q, k: Frac): Q => ({ a: q.a.mul(k), b: q.b.mul(k), s: q.s });

function texQ(q: Q, area: string | null): string {
  const den = lcm(q.a.d, q.b.d);
  const A = q.a.mul(den).toNumber();
  const B = q.b.mul(den).toNumber();
  const rad = `\\sqrt{${q.s}}`;
  const multi = A !== 0 && B !== 0;
  const body = B === 0 ? lin([[A, '']]) : multi ? (B > 0 ? lin([[B, rad], [A, '']]) : lin([[A, ''], [B, rad]])) : lin([[B, rad]]);
  let top = body;
  if (area) top = multi ? `(${body})${area}` : body === '1' ? area : `${body}${area}`;
  return den === 1 ? top : `\\frac{${top}}{${den}}`;
}

const packing: Template<Params> = {
  id: 'geo.composite.packing',
  skill: 'geo.composite',
  format: 'mcs',
  style: 'equal circles packed in a circle: the leftover or the covered area in terms of D',
  generate(rng, d) {
    const n = d === 1 ? 7 : d === 2 ? 4 : 3;
    const k = rng.int(1, 6);
    const ask = rng.pick(['gap', 'circles', 'ratio'] as const);
    const sym = rng.pick(['D', 'd', 'W', 'L']);
    const [f2a, f2b, s] = PACK[n].f2;
    const total: Q = { a: f2a.mul(n), b: f2b.mul(n), s }; // n f^2: share of the large circle covered
    const gap: Q = { a: new Frac(1).sub(total.a), b: total.b.neg(), s };
    const one: Q = { a: f2a, b: f2b, s };
    const countOff: Q = { a: f2a.mul(n - 1), b: f2b.mul(n - 1), s };
    // diameters add up: r = R / n, share = n * (1/n)^2 = 1/n
    const wrongShare: Q = { a: new Frac(1, n), b: new Frac(0), s };
    const unit = new Frac(k * k, 4); // area of the large circle in units of pi D^2
    const wrapUp = (share: Q): Q => (ask === 'ratio' ? share : scale(share, unit));
    const gapOf = (covered: Q): Q => ({ a: new Frac(1).sub(covered.a), b: covered.b.neg(), s });
    const want = ask === 'circles' ? total : gap;
    const right = wrapUp(want);
    const traps: { q: Q; trap: string }[] = [];
    const other = ask === 'circles' ? gap : total;
    traps.push({ q: wrapUp(other), trap: 'geom-pack-complement' });
    traps.push({ q: wrapUp(ask === 'circles' ? one : gapOf(one)), trap: 'geom-pack-one-circle' });
    traps.push({ q: wrapUp(ask === 'circles' ? countOff : gapOf(countOff)), trap: 'geom-pack-count-off' });
    traps.push({ q: wrapUp(ask === 'circles' ? wrongShare : gapOf(wrongShare)), trap: 'geom-pack-diameters-add' });
    // a value above the share of the large circle is impossible (circles) or must be positive (gap)
    const limit = ask === 'ratio' ? 1 : unit.toNumber();
    const ok = (q: Q) => val(q) > 1e-9 && val(q) < limit - 1e-9;
    const near = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
    const rv = val(right);
    if (traps.some((t) => near(val(t.q), rv))) throw new Redraw('a trap equals the answer');
    const wrong: { q: Q; trap?: string }[] = [];
    for (const t of traps) if (ok(t.q) && !wrong.some((w) => near(val(w.q), val(t.q)))) wrong.push(t);
    const fill = [new Frac(1, 2), new Frac(1, 3), new Frac(2, 3), new Frac(3, 4), new Frac(1, 4)];
    for (const fr of rng.shuffle(fill)) {
      if (wrong.length >= 4) break;
      const q: Q = ask === 'ratio' ? { a: fr, b: new Frac(0), s: 2 } : { a: fr.mul(unit), b: new Frac(0), s: 2 };
      if (ok(q) && !near(val(q), rv) && !wrong.some((w) => near(val(w.q), val(q)))) wrong.push({ q });
    }
    if (wrong.length < 4) throw new Redraw('not enough choices');
    const area = ask === 'ratio' ? null : `\\pi ${sym}^2`;
    const kept = wrong.slice(0, 4);
    const items: Choice[] = kept.map((w) => ({ text: `$${texQ(w.q, area)}$`, ...(w.trap ? { trap: w.trap } : {}) }));
    const rightText = `$${texQ(right, area)}$`;
    const { choices, answer } = textChoices(rng, rightText, items);
    const valOf = new Map<string, number>([[rightText, rv], ...kept.map((w) => [`$${texQ(w.q, area)}$`, val(w.q)] as [string, number])]);
    // figure
    const R = 3;
    const r = R * PACK[n].f;
    const fig = new Fig();
    const rot = n === 4 ? 45 : 90;
    const centers: P2[] = n === 7 ? [[0, 0], ...Array.from({ length: 6 }, (_, i) => onCircle([0, 0], R - r, 90 + 60 * i))] : Array.from({ length: n }, (_, i) => onCircle([0, 0], R - r, rot + (360 * i) / n));
    fig.circle(fig.h([0, 0]), R);
    for (const c of centers) fig.circle(fig.h(c), r);
    fig.segXY([-R, 0], [R, 0], `$${k === 1 ? sym : `${k}${sym}`}$`, true);
    const bigDiam = k === 1 ? `$${sym}$` : `$${k}${sym}$`;
    const story = rng.pick(['circles', 'cables'] as const);
    const cab = story === 'cables';
    const things = cab ? 'cables, each with a circular cross section,' : 'circles';
    const holder = cab ? 'a circular pipe' : 'a larger circle';
    const touch = cab ? 'touches the wall of the pipe' : 'touches the larger circle';
    const word = n === 7 ? 'Seven' : n === 4 ? 'Four' : 'Three';
    const arrangement =
      n === 7
        ? `${word} identical ${things} are placed inside ${holder}: one is at the center and touches the six around it, and each of those six ${touch} and its two neighbors.`
        : n === 4
          ? `${word} identical ${things} are placed inside ${holder} so that each ${touch} and two of the other ${cab ? 'cables' : 'small circles'}.`
          : `${word} identical ${things} are placed inside ${holder} so that each ${touch} and the other two ${cab ? 'cables' : 'small circles'}.`;
    const quantity = cab
      ? ask === 'gap'
        ? 'What is the area of the part of the cross section of the pipe that is not covered by the cables?'
        : ask === 'circles'
          ? 'What is the total cross-sectional area of the cables?'
          : 'What fraction of the cross section of the pipe is not covered by the cables?'
      : ask === 'gap'
        ? 'What is the area of the region that is inside the larger circle and outside all of the small circles?'
        : ask === 'circles'
          ? 'What is the total area of the small circles?'
          : 'What fraction of the area of the larger circle lies outside all of the small circles?';
    const stem = `${arrangement} The ${cab ? 'pipe' : 'larger circle'} has ${cab ? 'an inside ' : ''}diameter ${bigDiam}. ${quantity}`;
    const f2tex = n === 7 ? '\\frac{1}{9}' : n === 4 ? '(3 - 2\\sqrt{2})' : '(21 - 12\\sqrt{3})';
    const geometry =
      n === 7
        ? 'Along a diameter of the large circle three small diameters fit: an outer circle, the center circle and the opposite outer circle. So $R = 3r$, where $R$ is the large radius and $r$ the small one, and $r = \\frac{R}{3}$.'
        : n === 4
          ? 'The four centers form a square of side $2r$, so each center is $r\\sqrt{2}$ from the middle. The large radius is $R = r + r\\sqrt{2}$, so $r = \\frac{R}{1 + \\sqrt{2}} = R(\\sqrt{2} - 1)$.'
          : 'The three centers form an equilateral triangle of side $2r$, so each center is $\\frac{2r}{\\sqrt{3}}$ from the middle. The large radius is $R = r + \\frac{2r}{\\sqrt{3}}$, so $r = R(2\\sqrt{3} - 3)$.';
    const notes = trapNotes(
      choices,
      {
        'geom-pack-complement': (vs) => `${vs} is the area of the other region, not the one asked for`,
        'geom-pack-one-circle': (vs) => `${vs} comes from counting a single small circle`,
        'geom-pack-count-off': (vs) => `${vs} comes from using one circle too few`,
        'geom-pack-diameters-add': (vs) => `${vs} comes from assuming that the ${n} small diameters add up to the large diameter`,
      },
      2,
    );
    const share = texQ(ask === 'circles' ? total : gap, null);
    const bigArea = k === 1 ? `\\frac{\\pi ${sym}^2}{4}` : `\\frac{${k * k}\\pi ${sym}^2}{4}`;
    return {
      params: { n, k, ask, vals: choices.map((c) => valOf.get(c.text)!), textOfRight: rightText },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(false),
        choices,
        answer,
        explanation: `Everything follows from the radius $r$ of a small circle in terms of the large radius $R$.

${geometry} Then $r^2 = R^2 \\cdot ${f2tex}$: the ${n} small circles cover $${texQ(total, null)}$ of the large circle, and the gap is $${texQ(gap, null)}$ of it.

The large circle has diameter ${bigDiam}, so its area is $${bigArea}$. ${ask === 'ratio' ? `The share outside the small circles is $${share}$.` : `The ${ask === 'circles' ? 'small circles together' : 'region outside them'} measure $${share}$ of that: $${texQ(right, area)}$.`}

Check: the small circles cover about ${(val(total) * 100).toFixed(1)}% of the large circle, so about ${(val(gap) * 100).toFixed(1)}% is left.

${notes}

Rule: find the small radius from the centers' arrangement first, then compute with shares of the large circle.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    // find r numerically by tangency: ring of m circles (m = n, or 6 around a center for n = 7)
    const R = 1;
    const m = p.n === 7 ? 6 : p.n;
    // distance between neighboring centers on the ring minus 2r: positive for a small r
    let lo = 1e-9;
    let hi = R / 2;
    for (let i = 0; i < 200; i++) {
      const r = (lo + hi) / 2;
      const gapBetween = 2 * (R - r) * Math.sin(Math.PI / m) - 2 * r;
      if (gapBetween > 0) lo = r;
      else hi = r;
    }
    const r = lo;
    if (p.n === 7 && Math.abs(R - r - 2 * r) > 1e-9) return 'the ring does not touch the center circle';
    const covered = (p.n * r * r) / (R * R);
    const target = p.ask === 'circles' ? covered : 1 - covered;
    const truth = p.ask === 'ratio' ? target : (target * p.k * p.k) / 4;
    const hits = p.vals.flatMap((v, i) => (Math.abs(v - truth) < 1e-9 * Math.max(1, truth) ? [i] : []));
    if (hits.length !== 1) return `${hits.length} choices match ${truth}`;
    return hits[0] === q.answer && q.choices[q.answer].text === p.textOfRight ? null : `expected choice ${hits[0]}`;
  },
};

export const packingTemplates = retryAll([packing]);
