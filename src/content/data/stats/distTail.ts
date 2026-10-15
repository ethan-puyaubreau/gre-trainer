import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { fTex, normalPercent, QC_WORDS } from './util';

// Quantitative comparison on two normal populations: which has the larger share inside a window
// around its mean, or beyond a cut-off. The comparison is settled by standard units.
export const distTailTraps: Record<string, Trap> = {
  'stat-dist-sd-reversed': {
    label: 'Thought a larger standard deviation puts more values near the mean',
    fix: 'A larger standard deviation spreads the values out, so a fixed window around the mean holds a smaller share. Compare window width in standard deviations.',
  },
  'stat-dist-mean-only': {
    label: 'Compared only the means',
    fix: 'The share beyond a cut-off depends on how many standard deviations the cut-off is from the mean, not on the mean alone.',
  },
  'stat-dist-range-ignored': {
    label: 'Answered D although the standard deviation range settles it',
    fix: 'Test both ends of the allowed range. If the comparison comes out the same at both ends, it is the same for every value in between.',
  },
  'stat-dist-one-sd': {
    label: 'Tested one value of the unknown standard deviation',
    fix: 'Try the ends of the allowed range of the standard deviation. If the comparison flips between them, the answer is D.',
  },
};

interface Ctx {
  pa: string;
  pb: string;
  what: (p: string) => string; // "cereal boxes filled by Machine P"
  noun: string; // "weight"
  unit: string;
  mean: [number, number];
  sd: [number, number];
}

const CTX: Ctx[] = [
  { pa: 'Machine P', pb: 'Machine Q', what: (p) => `cereal boxes filled by ${p}`, noun: 'weight', unit: 'grams', mean: [300, 500], sd: [4, 12] },
  { pa: 'Class A', pb: 'Class B', what: (p) => `students in ${p}`, noun: 'score', unit: 'points', mean: [60, 80], sd: [4, 12] },
  { pa: 'Route 1', pb: 'Route 2', what: (p) => `buses on ${p}`, noun: 'trip time', unit: 'minutes', mean: [30, 60], sd: [2, 9] },
  { pa: 'Field X', pb: 'Field Y', what: (p) => `plants in ${p}`, noun: 'height', unit: 'centimeters', mean: [40, 90], sd: [3, 10] },
];

type Mode = 'window' | 'above' | 'below';

interface TailParams {
  mode: Mode;
  mx: number;
  sx: number;
  my: number;
  syLo: number;
  syHi: number;
  /** window half-widths for X and Y (window mode) or the cut-off in both (wx = wy = cut-off). */
  wx: number;
  wy: number;
}

/** Score of a population: the larger the score, the larger the share asked about (exact). */
function score(mode: Mode, m: number, s: number, w: number): Frac {
  if (mode === 'window') return new Frac(w, s);
  return mode === 'above' ? new Frac(m - w, s) : new Frac(w - m, s);
}

const tailCompare: Template<TailParams> = {
  id: 'data.distributions.tail-compare',
  skill: 'data.distributions',
  format: 'qc',
  style: 'compare the shares of two normal populations inside a window or beyond a cut-off (standard deviation sometimes unknown)',
  generate(rng, d) {
    const ctx = rng.pick(CTX);
    const wantD = d === 3 && rng.chance(0.55);
    for (let tries = 0; ; tries++) {
      const mode: Mode = d === 1 ? 'window' : d === 2 ? rng.pick(['window', 'above', 'below', 'above']) : rng.pick(['window', 'above', 'below']);
      const sx = rng.int(ctx.sd[0], ctx.sd[1]);
      const mx = rng.int(ctx.mean[0], ctx.mean[1]);
      let my = mx + rng.int(-12, 12);
      let sy = rng.int(ctx.sd[0], ctx.sd[1]);
      let syLo = sy;
      let syHi = sy;
      if (d === 1 && rng.chance(0.2)) sy = sx;
      if (d === 3) {
        syLo = Math.max(ctx.sd[0] - 1, sy - rng.int(1, 3));
        syHi = sy + rng.int(1, 3);
        if (syLo < 2) syLo = 2;
      } else {
        syLo = sy;
        syHi = sy;
      }
      let wx: number;
      let wy: number;
      if (mode === 'window') {
        wx = rng.int(ctx.sd[0], ctx.sd[1] * 2);
        wy = d === 1 ? wx : rng.chance(0.2) ? Math.max(1, Math.round((wx * sy) / sx)) : rng.int(ctx.sd[0], ctx.sd[1] * 2);
        my = mx + rng.int(-12, 12);
      } else {
        // one cut-off T for both populations, placed within about 2.5 SD of both means
        const T = mx + rng.int(-2, 2) * sx + rng.int(-1, 1);
        wx = T;
        wy = T;
        if (my === T || mx === T) continue;
        if (mode === 'below' && my === mx) my += 1;
      }
      const z = (w: number, m: number, s: number) => Math.abs(Number(score(mode, m, s, w).toNumber()));
      if (z(wx, mx, sx) > 3 || z(wy, my, syLo) > 4.5 || z(wy, my, syHi) > 4.5) continue;
      if (mode === 'window' && (z(wx, mx, sx) < 0.4 || z(wy, my, sy) < 0.4)) continue;
      // exact answer from the scores at every allowed whole-number SD of Y
      const sds: number[] = [];
      for (let s = syLo; s <= syHi; s++) sds.push(s);
      const sA = score(mode, mx, sx, wx);
      const ans = qcFromSamples(sds.map((s) => [sA, score(mode, my, s, wy)] as [Frac, Frac]));
      if (d === 3 && wantD !== (ans === 'D')) {
        if (tries < 200) continue;
      }
      if (d < 3 && ans === 'D') continue;
      if (d === 2 && ans === 'C' && rng.chance(0.6)) continue;

      const A = ctx.pa;
      const B = ctx.pb;
      const sdTxt = syLo === syHi ? `a standard deviation of ${sy} ${ctx.unit}` : `a standard deviation that is a whole number of ${ctx.unit} from ${syLo} to ${syHi}, inclusive`;
      const info = `The ${ctx.noun}s of the ${ctx.what(A)} and of the ${ctx.what(B)} are approximately normally distributed. For ${A} the mean is ${mx} ${ctx.unit} and the standard deviation is ${sx} ${ctx.unit}. For ${B} the mean is ${my} ${ctx.unit}, with ${sdTxt}.`;
      let qa: string;
      let qb: string;
      if (mode === 'window') {
        qa = `The percent of the ${ctx.what(A)} with ${ctx.noun} within $${wx}$ ${ctx.unit} of the mean for ${A}`;
        qb = `The percent of the ${ctx.what(B)} with ${ctx.noun} within $${wy}$ ${ctx.unit} of the mean for ${B}`;
      } else {
        const rel = mode === 'above' ? 'greater than' : 'less than';
        qa = `The percent of the ${ctx.what(A)} with ${ctx.noun} ${rel} $${wx}$ ${ctx.unit}`;
        qb = `The percent of the ${ctx.what(B)} with ${ctx.noun} ${rel} $${wy}$ ${ctx.unit}`;
      }

      const tr: Partial<Record<QCChoice, string>> = {};
      if (ans === 'D') {
        const first = qcFromSamples([[sA, score(mode, my, syLo, wy)]]);
        if (first !== 'D') tr[first] = 'stat-dist-one-sd';
      } else {
        if (syLo !== syHi) tr.D = 'stat-dist-range-ignored';
        if (mode === 'window') {
          if (ans === 'A' || ans === 'B') tr[ans === 'A' ? 'B' : 'A'] = 'stat-dist-sd-reversed';
        } else if (mx !== my) {
          const guess: QCChoice = mode === 'above' ? (mx > my ? 'A' : 'B') : mx < my ? 'A' : 'B';
          if (guess !== ans) tr[guess] = 'stat-dist-mean-only';
        }
      }
      delete tr[ans];

      // Explanation
      const sdTex = (m: number, s: number | string, w: number) => (mode === 'window' ? `\\dfrac{${w}}{${s}}` : `\\dfrac{|${w} - ${m}|}{${s}}`);
      const zOf = (m: number, s: number, w: number) => fTex(score(mode, m, s, w).abs());
      const side = (m: number, w: number) => (w > m ? 'above' : 'below');
      const part = (name: string, m: number, s: number, w: number) => `${name}: $${sdTex(m, s, w)} = ${zOf(m, s, w)}$ standard deviations${mode === 'window' ? '' : `, ${side(m, w)} its mean`}.`;
      const partB =
        syLo === syHi
          ? part(B, my, sy, wy)
          : `${B}: $${sdTex(my, 's', wy)}$ standard deviations, which is $${zOf(my, syHi, wy)}$ when $s = ${syHi}$ and $${zOf(my, syLo, wy)}$ when $s = ${syLo}$.`;
      const intro =
        mode === 'window'
          ? 'Recognize: both are normal, so measure each window in standard deviations. The share inside a window around the mean grows with the number of standard deviations it spans.'
          : `Recognize: both are normal with one cut-off, so locate the cut-off in standard deviations from each mean. ${mode === 'above' ? 'The cut-off that sits lower relative to its mean, in standard deviations, leaves the larger share above it.' : 'The cut-off that sits higher relative to its mean, in standard deviations, leaves the larger share below it.'}`;
      const verdict = ans === 'D' ? 'The comparison changes inside the allowed range of $s$, so the relationship cannot be determined.' : `So ${QC_WORDS[ans]}.`;
      const TRAP_LINES: Record<string, string> = {
        'stat-dist-sd-reversed': 'Trap: a larger standard deviation does not put more values near the mean; it puts fewer inside the same window.',
        'stat-dist-mean-only': 'Trap: comparing only the means ignores the spreads. A mean that is higher does not by itself give a larger share on the side asked about.',
        'stat-dist-range-ignored': 'Trap: an unknown standard deviation does not always mean D. Here both ends of the allowed range give the same comparison, so every value in between does too.',
        'stat-dist-one-sd': 'Trap: testing one value of $s$ shows one relation, and the other end of the range shows the opposite.',
      };
      const trapLine = TRAP_LINES[Object.values(tr)[0] as string] ?? 'Trap: comparing raw numbers instead of standard units.';
      const rule = mode === 'window' ? 'Window width over standard deviation is what decides.' : 'Convert cut-offs to standard units before comparing.';
      return {
        params: { mode, mx, sx, my, syLo, syHi, wx, wy },
        q: {
          format: 'qc',
          info,
          quantityA: qa,
          quantityB: qb,
          answer: ans,
          ...(Object.keys(tr).length ? { traps: tr as QCQuestion['traps'] } : {}),
          explanation: `${intro}

${part(A, mx, sx, wx)} ${partB}

${verdict} (${ans})

${trapLine}

${rule}`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'qc') return 'wrong format';
    const pct = (m: number, s: number, w: number) => {
      if (p.mode === 'window') return normalPercent(m, s, m - w, m + w);
      return p.mode === 'above' ? normalPercent(m, s, w, Infinity) : normalPercent(m, s, -Infinity, w);
    };
    const a = pct(p.mx, p.sx, p.wx);
    const samples: [number, number][] = [];
    for (let s = p.syLo; s <= p.syHi; s++) samples.push([a, pct(p.my, s, p.wy)]);
    const expected = qcFromSamples(samples);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const distTailTemplates: Template<any>[] = [tailCompare];
