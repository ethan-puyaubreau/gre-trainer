import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num, poly } from '../../../engine/tex';
import type { Choice, GeometryFigure, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { choiceValuesMatch, dots, expectMcm, expectMcs, expectNe, expectQc, plot, ptTex, qcEnd, trapChoices, uniqueIndex, type Window } from './util';

type Pt = [number, number];

/* =============================================================================================
 * 1. Which line meets the V-shaped graph y = a|x - h| + k (MCS, figure) [BOOK AL-06]
 * =========================================================================================== */

interface VParams {
  a: number;
  h: number;
  k: number;
  lines: { m: number; c: number }[];
}

const gTex = (m: number, c: number) => `g(x) = ${poly([m, c])}`;

const lineMeetsV: Template<VParams> = {
  id: 'alg.graphs.line-meets-graph',
  skill: 'alg.graphs',
  format: 'mcs',
  style: 'which line intersects a graphed absolute-value function',
  generate(rng, d) {
    const a = d === 1 ? rng.pick([1, 2]) : d === 2 ? rng.pick([2, 3]) : rng.pick([1, 2]);
    const h = d === 3 ? rng.pick([-2, -1, 1, 2]) : 0;
    const k = rng.int(d === 2 ? 1 : 2, 4);
    const meets = (m: number, c: number) => Math.abs(m) > a || m * h + c >= k;
    // Correct line: usually steeper than the branches but passing below the vertex.
    const steep = rng.chance(d === 1 ? 0.5 : 0.7);
    let correct: { m: number; c: number };
    if (steep) {
      const m = (a + rng.int(1, 2)) * rng.sign();
      const gh = k - rng.int(2, 5); // value of g at x = h, below the vertex
      correct = { m, c: gh - m * h };
    } else {
      const m = rng.int(0, a) * rng.sign();
      const gh = k + rng.int(0, 2);
      correct = { m, c: gh - m * h };
    }
    // Wrong lines: never meet (|m| <= a and below the vertex at x = h).
    const pool: { m: number; c: number; trap?: string }[] = [];
    for (let m = -a; m <= a; m++)
      for (let drop = 1; drop <= 5; drop++) {
        const c = k - drop - m * h;
        pool.push({ m, c, trap: Math.abs(m) === a ? 'algw-parallel-meet' : 'algw-line-eventually-meets' });
      }
    const wrong: typeof pool = [];
    const parallel = rng.shuffle(pool.filter((p) => Math.abs(p.m) === a && Math.sign(p.m) === Math.sign(correct.m || 1)));
    wrong.push(parallel[0]);
    for (const pass of [0, 1])
      for (const p of rng.shuffle(pool)) {
        if (wrong.length >= 4) break;
        if (pass === 0 && wrong.some((w) => w.m === p.m) && rng.chance(0.7)) continue;
        if (wrong.some((w) => w.m === p.m && w.c === p.c) || (p.m === correct.m && p.c === correct.c)) continue;
        wrong.push(p);
      }
    // Listed by slope (as in the book) or by intercept.
    const bySlope = rng.chance(0.5);
    if (!meets(correct.m, correct.c) || wrong.some((w) => meets(w.m, w.c))) throw new Error('line-meets-graph: inconsistent choices');
    const all = [{ ...correct, ok: true }, ...wrong.map((w) => ({ ...w, ok: false }))].sort((u, v) => (bySlope ? u.m - v.m || u.c - v.c : u.c - v.c || u.m - v.m));
    const choices: Choice[] = all.map((l) => ({ text: `$${gTex(l.m, l.c)}$`, ...(!l.ok && 'trap' in l && l.trap ? { trap: l.trap } : {}) }));
    const answer = all.findIndex((l) => l.ok);

    const w: Window = { xMin: -5, xMax: 5, yMin: -3, yMax: 8 };
    const f = (x: number) => a * Math.abs(x - h) + k;
    const curves = plot(f, w, { include: [h] }).map((pts) => ({ pts }));
    const yLab = Math.min(w.yMax - 1, f(3.5));
    const xLab = h + (yLab - k) / a;
    const figure: GeometryFigure = {
      kind: 'geometry',
      points: {},
      axes: { ...w, grid: true, step: 1, labelTicks: true },
      curves,
      labels: [{ at: [Math.min(xLab + 1.3, 4.4), yLab - 0.6], text: '$y = f(x)$' }],
    };

    // Explanation: where the correct line meets f.
    const m0 = correct.m;
    const c0 = correct.c;
    let meetText: string;
    if (Math.abs(m0) > a) {
      const right = m0 > 0;
      // right branch: a(x - h) + k = m x + c  ->  x = (c - k + a h)/(a - m)
      const x = right ? frac(c0 - k + a * h, a - m0) : frac(c0 - k - a * h, -a - m0);
      const y = frac(m0).mul(x).add(c0);
      meetText = `Only $${gTex(m0, c0)}$ works: at $x = ${num(h)}$ it is below the vertex, but its slope $${num(m0)}$ is steeper than the ${right ? 'right' : 'left'} branch (slope $${right ? a : -a}$), so it catches up with that branch at $${ptTex(x, y)}$.`;
    } else {
      meetText = `Only $${gTex(m0, c0)}$ works: at $x = ${num(h)}$ its value is $${num(m0 * h + c0)}$, at or above the vertex height ${k}, so it must cross the V.`;
    }
    const par = wrong[0];
    return {
      params: { a, h, k, lines: all.map(({ m, c }) => ({ m, c })) },
      q: {
        format: 'mcs',
        figure,
        stem: `The graph of the function $f$ is shown in the $xy$-plane above. The graph of which of the following functions $g$, each defined for every real number $x$, meets the graph of $f$?`,
        choices,
        answer,
        explanation: `From the graph, $f(x) = ${a === 1 ? '' : a}|x ${h === 0 ? '' : h > 0 ? `- ${h}` : `+ ${-h}`}| + ${k}$: a V with vertex $${ptTex(h, k)}$ whose branches have slopes $${a}$ and $${-a}$.

A line that passes below the vertex (its value at $x = ${num(h)}$ is less than ${k}) meets the V only if it is steeper than the branches, that is, if its slope is greater than ${a} or less than $${-a}$. Otherwise the V rises at least as fast as the line on both sides and the line stays below it.

${meetText}

$${gTex(par.m, par.c)}$ is parallel to a branch of the V and lies below it, so it never meets the graph.`,
      },
    };
  },
  check(q, { a, h, k, lines }) {
    if (q.format !== 'mcs') return 'wrong format';
    for (let i = 0; i < lines.length; i++) if (q.choices[i].text !== `$${gTex(lines[i].m, lines[i].c)}$`) return 'choice text mismatch';
    // f - g is convex and piecewise linear with one kink at h: it has a root iff its minimum <= 0.
    const idx = uniqueIndex(lines, ({ m, c }) => {
      const diff = (x: number) => a * Math.abs(x - h) + k - (m * x + c);
      return Math.min(diff(-1e6), diff(h), diff(1e6)) <= 0;
    });
    return expectMcs(q, idx);
  },
};

/* =============================================================================================
 * 2. Parabola facts compared: symmetry, minimum, "at least", values (QC) [GEN AL-G37, BOOK AL-04 idea]
 * =========================================================================================== */

interface ParabParams {
  mode: 'sym' | 'min' | 'ge' | 'compare';
  /** y = A x^2 + B x + C */
  A: number;
  B: number;
  C: number;
  N: number;
  x1: number;
  x2: number;
  excludeVertex: boolean;
}

const quadTex = (A: number, B: number, C: number) => poly([A, B, C]);

const parabolaQC: Template<ParabParams> = {
  id: 'alg.graphs.parabola-qc',
  skill: 'alg.graphs',
  format: 'qc',
  style: 'parabola symmetry, vertex and minimum value',
  generate(rng, d) {
    const mode = rng.pick(d === 1 ? (['sym', 'min', 'compare'] as const) : d === 2 ? (['sym', 'min', 'ge', 'compare'] as const) : (['sym', 'ge', 'compare', 'ge'] as const));
    const base = { x1: 0, x2: 0, excludeVertex: false, N: 0 };
    if (mode === 'sym') {
      const A = d === 3 ? rng.pick([2, 3, -1, -2]) : 1;
      const h = rng.pick([-3, -2, -1, 1, 2, 3, 4]);
      const B = -2 * A * h;
      const C = rng.int(-9, 9);
      const N = rng.pick([2 * h, 2 * h, 2 * h + 1, 2 * h - 1, h, -2 * h]);
      const answer = qcCompare(2 * h, N);
      const trapAns = qcCompare(-2 * h, N);
      const traps: QCQuestion['traps'] = answer === 'C' ? { D: 'algw-symmetric-points' } : trapAns !== answer ? { [trapAns]: 'algw-vertex-sign' } : undefined;
      return {
        params: { ...base, mode, A, B, C, N },
        q: {
          format: 'qc',
          info: `The points $(r, s)$ and $(t, s)$, where $r \\ne t$, lie on the graph of $y = ${quadTex(A, B, C)}$ in the $xy$-plane.`,
          quantityA: '$r + t$',
          quantityB: `$${num(N)}$`,
          answer,
          traps,
          explanation: `The two points have the same $y$-coordinate, so they are mirror images across the axis of symmetry of the parabola. The axis is $x = -\\frac{b}{2a} = -\\frac{${num(B)}}{2${A === 1 ? '' : `(${num(A)})`}} = ${num(h)}$.

Mirror images are equally far from the axis, so $r$ and $t$ average to ${h < 0 ? `$${h}$` : h}: $r + t = 2(${num(h)}) = ${num(2 * h)}$, whichever pair of points is chosen.

Compare $${num(2 * h)}$ with $${num(N)}$. ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'min') {
      const p = rng.int(-6, 3);
      const half = rng.int(1, d === 1 ? 3 : 5);
      const q2 = p + 2 * half;
      const min = -half * half;
      const yInt = p * q2;
      const opts = [min, min, min + 1, min - 1, yInt !== min ? yInt : min + 2, -2 * half];
      const N = rng.pick(opts);
      const answer = qcCompare(min, N);
      const trapAns = qcCompare(yInt, N);
      const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-min-at-intercept' } : undefined;
      const fac = (r: number) => (r === 0 ? 'x' : `(x ${r > 0 ? '-' : '+'} ${Math.abs(r)})`);
      return {
        params: { ...base, mode, A: 1, B: -(p + q2), C: p * q2, N },
        q: {
          format: 'qc',
          info: `$y = ${fac(p)}${fac(q2)}$`,
          quantityA: 'The least possible value of $y$',
          quantityB: `$${num(N)}$`,
          answer,
          traps,
          explanation: `The graph is a parabola opening upward with $x$-intercepts $${num(p)}$ and $${num(q2)}$. Its lowest point, the vertex, is halfway between them, at $x = \\frac{${num(p)} + ${q2 < 0 ? `(${q2})` : q2}}{2} = ${num((p + q2) / 2)}$.

There, $y = (${num((p + q2) / 2)} - ${p < 0 ? `(${p})` : p})(${num((p + q2) / 2)} - ${q2 < 0 ? `(${q2})` : q2}) = (${half})(${-half}) = ${num(min)}$, the least possible value of $y$.

Compare $${num(min)}$ with $${num(N)}$. ${qcEnd(answer)}${yInt !== min ? ` (The value at $x = 0$, $${num(yInt)}$, is not the minimum.)` : ''}`,
        },
      };
    }
    if (mode === 'ge') {
      const up = rng.chance(0.7);
      const A = up ? 1 : -1;
      const h = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4, 5]);
      const kv = rng.int(-6, 6);
      const B = -2 * A * h;
      const C = A * h * h + kv;
      const excludeVertex = rng.chance(0.3);
      const N = excludeVertex ? kv : rng.pick([kv, kv, kv - A]);
      // v - N = A (u - h)^2 + kv - N
      let answer: QCChoice;
      if (N === kv) answer = excludeVertex ? (up ? 'A' : 'B') : 'D';
      else answer = up ? 'A' : 'B';
      const traps: QCQuestion['traps'] = answer === 'D' ? { [up ? 'A' : 'B']: 'algw-strict-vs-nonstrict' } : excludeVertex ? { D: 'algw-single-case' } : undefined;
      const form = d === 3 ? quadTex(A, B, C) : `${up ? '' : '-'}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${kv < 0 ? '-' : '+'} ${Math.abs(kv)}`;
      const complete =
        d === 3
          ? `Complete the square: $y = ${quadTex(A, B, C)} = ${up ? '' : '-'}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${kv < 0 ? '-' : '+'} ${Math.abs(kv)}$. `
          : '';
      const reason =
        N === kv
          ? excludeVertex
            ? `Since $u \\ne ${num(h)}$, the square is strictly positive, so $v ${up ? '>' : '<'} ${num(kv)}$. ${qcEnd(answer)}`
            : `So $v ${up ? '\\ge' : '\\le'} ${num(kv)}$, with equality when $u = ${num(h)}$. For $u = ${num(h)}$ the quantities are equal; for any other $u$, Quantity ${up ? 'A' : 'B'} is greater. ${qcEnd('D')}`
          : `So $v ${up ? '\\ge' : '\\le'} ${num(kv)}$, and $${num(kv)} ${up ? '>' : '<'} ${num(N)}$. ${qcEnd(answer)}`;
      return {
        params: { ...base, mode, A, B, C, N, x1: h, excludeVertex },
        q: {
          format: 'qc',
          info: `The point $(u, v)$ lies on the graph of $y = ${form}$ in the $xy$-plane${excludeVertex ? `, and $u \\ne ${num(h)}$` : ''}.`,
          quantityA: '$v$',
          quantityB: `$${num(N)}$`,
          answer,
          traps,
          explanation: `${complete}Since $(u ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 \\ge 0$, the value $v = ${up ? '' : '-'}(u ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${kv < 0 ? '-' : '+'} ${Math.abs(kv)}$ is ${
            up ? 'at least' : 'at most'
          } $${num(kv)}$. ${reason}`,
        },
      };
    }
    // compare f(x1) and f(x2)
    const up = rng.chance(0.5);
    const A = up ? 1 : -1;
    const h = rng.pick([-2, -1, 1, 2, 3, 4]);
    const kv = rng.int(-5, 8);
    const B = -2 * A * h;
    const C = A * h * h + kv;
    let d1: number;
    let d2: number;
    do {
      d1 = rng.int(1, 6);
      d2 = rng.chance(0.25) ? d1 : rng.int(1, 6);
    } while (d1 === d2 && rng.chance(0.3));
    // x1 on the left of the axis, x2 on the right (or both on one side sometimes)
    let x1 = h - d1;
    let x2 = h + d2;
    if (rng.chance(0.5)) [x1, x2] = [x2, x1];
    const f = (x: number) => A * x * x + B * x + C;
    const answer = qcCompare(f(x1), f(x2));
    const naive = qcCompare(A > 0 ? x1 : -x1, A > 0 ? x2 : -x2); // "bigger x, bigger value" (or the reverse when opening down)
    const naive2 = qcCompare(x1, x2);
    const trapAns = naive2 !== answer ? naive2 : naive !== answer ? naive : null;
    const traps: QCQuestion['traps'] = trapAns ? { [trapAns]: 'algw-parabola-monotone' } : undefined;
    const fDef = d === 3 ? quadTex(A, B, C) : `${up ? '' : '-'}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${kv < 0 ? '-' : '+'} ${Math.abs(kv)}`;
    const dist1 = Math.abs(x1 - h);
    const dist2 = Math.abs(x2 - h);
    return {
      params: { ...base, mode, A, B, C, N: 0, x1, x2 },
      q: {
        format: 'qc',
        info: `The function $f$ is defined by $f(x) = ${fDef}$ for all numbers $x$.`,
        quantityA: `$f(${num(x1)})$`,
        quantityB: `$f(${num(x2)})$`,
        answer,
        traps,
        explanation: `${d === 3 ? `Complete the square: $f(x) = ${up ? '' : '-'}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})^2 ${kv < 0 ? '-' : '+'} ${Math.abs(kv)}$. ` : ''}The graph is a parabola opening ${
          up ? 'upward' : 'downward'
        } with axis of symmetry $x = ${num(h)}$, so values depend only on the distance from $${num(h)}$: the ${up ? 'farther' : 'closer'} the input, the greater the value.

$${num(x1)}$ is ${dist1} unit${dist1 === 1 ? '' : 's'} from $${num(h)}$ and $${num(x2)}$ is ${dist2} unit${dist2 === 1 ? '' : 's'} away. ${
          dist1 === dist2 ? 'They are equally far, so the values are equal.' : `Directly: $f(${num(x1)}) = ${num(f(x1))}$ and $f(${num(x2)}) = ${num(f(x2))}$.`
        } ${qcEnd(answer)}`,
      },
    };
  },
  check(q, prm, rng) {
    const { mode, A, B, C, N } = prm;
    const fF = (x: Frac) => x.mul(x).mul(A).add(x.mul(B)).add(C);
    if (mode === 'sym') {
      // For several random r, find every x with f(x) = f(r) numerically and add them.
      const f = (x: number) => A * x * x + B * x + C;
      const samples: [number, number][] = [];
      for (let i = 0; i < 12; i++) {
        const r = -20 + rng.next() * 40;
        const s = f(r);
        const roots: number[] = [];
        const g = (x: number) => f(x) - s;
        for (let x = -60; x < 60; x += 0.01) {
          const a0 = g(x);
          const b0 = g(x + 0.01);
          if (a0 === 0) roots.push(x);
          else if (a0 * b0 < 0) {
            let lo = x;
            let hi = x + 0.01;
            for (let j = 0; j < 60; j++) {
              const mid = (lo + hi) / 2;
              if (g(lo) * g(mid) <= 0) hi = mid;
              else lo = mid;
            }
            roots.push((lo + hi) / 2);
          }
        }
        if (roots.length !== 2) continue;
        samples.push([roots[0] + roots[1], N]);
      }
      if (samples.length < 5) return 'could not find root pairs';
      return expectQc(q, qcFromSamples(samples.map(([s, n]) => [Math.round(s * 1e6) / 1e6, n])));
    }
    if (mode === 'min') {
      let best: Frac | null = null;
      for (let i = -80; i <= 80; i++) {
        const v = fF(frac(i, 2));
        if (!best || v.lt(best)) best = v;
      }
      return expectQc(q, qcCompare(best!, N));
    }
    if (mode === 'ge') {
      const samples: [Frac, Frac][] = [];
      for (let i = -60; i <= 60; i++) {
        const u = frac(i, 4).add(prm.x1);
        if (prm.excludeVertex && u.eq(prm.x1)) continue;
        samples.push([fF(u), frac(N)]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    return expectQc(q, qcCompare(fF(frac(prm.x1)), fF(frac(prm.x2))));
  },
};

/* =============================================================================================
 * 3. Points inside a region bounded by lines (MCM) [BOOK AL-22]
 * =========================================================================================== */

interface RegionParams {
  kind: 'triangle' | 'wedge';
  a: number;
  b: number;
  c: number;
  /** wedge: y > m1 x + k1 and y < m2 x + k2 */
  m1: number;
  k1: number;
  m2: number;
  k2: number;
  pts: Pt[];
}

const ineqTex = (rel: '>' | '<', m: number, k: number) => `y ${rel} ${poly([m, k])}`;

const regionPoints: Template<RegionParams> = {
  id: 'alg.graphs.region-points',
  skill: 'alg.graphs',
  format: 'mcm',
  style: 'which points lie in a region bounded by lines',
  generate(rng, d) {
    if (d < 3) {
      let a: number;
      let b: number;
      let t: number;
      do {
        a = rng.int(1, 5);
        b = rng.int(1, 5);
        t = rng.int(1, 3);
      } while (gcd(a, b) !== 1 || a === b || a * t < 4 || b * t < 4 || a * t > 12 || b * t > 12);
      const c = a * b * t;
      const X = c / a;
      const Y = c / b;
      const inside: Pt[] = [];
      const outside: Pt[] = [];
      for (let x = 1; x < X; x++)
        for (let y = 1; y < Y; y++) {
          const v = a * x + b * y;
          if (v >= c - 5 && v < c) inside.push([x, y]);
          if (v > c && v <= c + 6) outside.push([x, y]);
        }
      const negs: Pt[] = [];
      for (let y = 1; y < Y + 3; y++) if (-a + b * y < c) negs.push([-1, y]);
      for (let x = 1; x < X + 3; x++) if (a * x - b < c) negs.push([x, -1]);
      const nCorrect = rng.int(1, 3);
      const pickIn = rng.sample(inside, Math.min(nCorrect, inside.length));
      const nWrong = 5 - pickIn.length;
      const wrong: { p: Pt; trap: string }[] = [];
      if (d === 2 && negs.length) wrong.push({ p: rng.pick(negs), trap: 'algw-region-sign' });
      for (const p of rng.shuffle(outside)) {
        if (wrong.length >= nWrong) break;
        wrong.push({ p, trap: 'algw-region-eyeball' });
      }
      const items = [...pickIn.map((p) => ({ p, correct: true, trap: undefined as string | undefined })), ...wrong.map((w) => ({ p: w.p, correct: false, trap: w.trap as string | undefined }))].sort((u, v) => u.p[0] - v.p[0] || u.p[1] - v.p[1]);
      const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${ptTex(it.p[0], it.p[1])}$`, correct: it.correct, ...(it.trap ? { trap: it.trap } : {}) })));
      const eq = `${a === 1 ? '' : a}x + ${b === 1 ? '' : b}y = ${c}`;
      const why = items
        .map((it) => {
          const [x, y] = it.p;
          if (x < 0 || y < 0) return `- $${ptTex(x, y)}$: its ${x < 0 ? '$x$' : '$y$'}-coordinate is negative, so it is outside $R$ even though $${a === 1 ? '' : a}x + ${b === 1 ? '' : b}y = ${a * x + b * y} < ${c}$.`;
          const v = a * x + b * y;
          return `- $${ptTex(x, y)}$: $${a === 1 ? '' : `${a}`}${a === 1 ? `${x}` : `(${x})`} + ${b === 1 ? `${y}` : `${b}(${y})`} = ${v}$, ${v < c ? `less than ${c}: inside` : `greater than ${c}: outside`}.`;
        })
        .join('\n');
      return {
        params: { kind: 'triangle', a, b, c, m1: 0, k1: 0, m2: 0, k2: 0, pts: items.map((it) => it.p) },
        q: {
          format: 'mcm',
          stem: `In the $xy$-plane, region $R$ is the triangular region bounded by the $x$-axis, the $y$-axis, and the line with equation $${eq}$. Which of the following points lie inside region $R$?`,
          instruction: 'Indicate all such points.',
          choices,
          answer,
          explanation: `The line $${eq}$ meets the axes at $${ptTex(X, 0)}$ and $${ptTex(0, Y)}$, and the origin satisfies $${a === 1 ? '' : a}(0) + ${b === 1 ? '' : b}(0) < ${c}$. So a point is inside $R$ exactly when $x > 0$, $y > 0$, and $${a === 1 ? '' : a}x + ${b === 1 ? '' : b}y < ${c}$. Substitute each point:
${why}

Every point here is close to the line, so judging by eye is unreliable: compute.`,
        },
      };
    }
    // wedge: y > m1 x + k1 and y < m2 x + k2 with m1 > m2 (crossing lines)
    let m1: number;
    let m2: number;
    let k1: number;
    let k2: number;
    do {
      m1 = rng.pick([1, 2, 3, -1]);
      m2 = rng.pick([-1, -2, -3, 0, 1]);
      k1 = rng.int(-5, 2);
      k2 = rng.int(3, 10);
    } while (m1 <= m2);
    const pass1 = (p: Pt) => p[1] > m1 * p[0] + k1;
    const pass2 = (p: Pt) => p[1] < m2 * p[0] + k2;
    const both: Pt[] = [];
    const one: Pt[] = [];
    for (let x = -4; x <= 8; x++)
      for (let y = -6; y <= 12; y++) {
        const p: Pt = [x, y];
        const s1 = p[1] - (m1 * x + k1);
        const s2 = m2 * x + k2 - p[1];
        if (s1 === 0 || s2 === 0) continue;
        if (pass1(p) && pass2(p) && Math.min(s1, s2) <= 3) both.push(p);
        else if (pass1(p) !== pass2(p) && Math.abs(pass1(p) ? s2 : s1) <= 3) one.push(p);
      }
    const nCorrect = rng.int(1, 3);
    const pickIn = rng.sample(both, Math.min(nCorrect, both.length));
    const pickOut = rng.sample(one, 5 - pickIn.length);
    const items = [...pickIn.map((p) => ({ p, correct: true, trap: undefined as string | undefined })), ...pickOut.map((p) => ({ p, correct: false, trap: 'algw-region-one-condition' as string | undefined }))].sort(
      (u, v) => u.p[0] - v.p[0] || u.p[1] - v.p[1],
    );
    const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${ptTex(it.p[0], it.p[1])}$`, correct: it.correct, ...(it.trap ? { trap: it.trap } : {}) })));
    const why = items
      .map((it) => {
        const [x, y] = it.p;
        const v1 = m1 * x + k1;
        const v2 = m2 * x + k2;
        const ok1 = y > v1;
        const ok2 = y < v2;
        return `- $${ptTex(x, y)}$: $${poly([m1, k1]).replace(/x/, `(${x})`)} = ${num(v1)}$ and $${poly([m2, k2]).replace(/x/, `(${x})`)} = ${num(v2)}$; ${ok1 && ok2 ? `$${num(v1)} < ${num(y)} < ${num(v2)}$, in $R$` : !ok1 ? `$${num(y)}$ is not greater than $${num(v1)}$, not in $R$` : `$${num(y)}$ is not less than $${num(v2)}$, not in $R$`}.`;
      })
      .join('\n');
    return {
      params: { kind: 'wedge', a: 0, b: 0, c: 0, m1, k1, m2, k2, pts: items.map((it) => it.p) },
      q: {
        format: 'mcm',
        stem: `In the $xy$-plane, region $R$ consists of all points $(x, y)$ that satisfy both of the inequalities $${ineqTex('>', m1, k1)}$ and $${ineqTex('<', m2, k2)}$. Which of the following points are in region $R$?`,
        instruction: 'Indicate all such points.',
        choices,
        answer,
        explanation: `A point is in $R$ only if its $y$-coordinate is greater than $${poly([m1, k1])}$ AND less than $${poly([m2, k2])}$. Substitute each $x$:
${why}

Several points satisfy one inequality but not the other; they are not in $R$.`,
      },
    };
  },
  check(q, prm) {
    if (prm.kind === 'triangle') {
      const V: Pt[] = [
        [0, 0],
        [prm.c / prm.a, 0],
        [0, prm.c / prm.b],
      ];
      const cross = (o: Pt, p: Pt, r: Pt) => (p[0] - o[0]) * (r[1] - o[1]) - (p[1] - o[1]) * (r[0] - o[0]);
      return expectMcm(
        q,
        prm.pts.map((p) => {
          const s = [cross(V[0], V[1], p), cross(V[1], V[2], p), cross(V[2], V[0], p)];
          return s.every((x) => x > 0) || s.every((x) => x < 0);
        }),
      );
    }
    // Half-planes by the side of each boundary line (cross product with a direction vector).
    const above = (m: number, k: number, p: Pt) => 1 * (p[1] - k) - m * (p[0] - 0) > 0;
    return expectMcm(
      q,
      prm.pts.map((p) => above(prm.m1, prm.k1, p) && !above(prm.m2, prm.k2, p) && p[1] !== prm.m2 * p[0] + prm.k2),
    );
  },
};

/* =============================================================================================
 * 4. Read values from a graphed function: f(f(a)), solutions of f(x) = c, shifts (NE, figure)
 * =========================================================================================== */

interface ReadParams {
  kind: 'compose' | 'count' | 'shift';
  a: number;
  c: number;
  s: number;
  v: number;
}

function makeKnots(rng: { int(a: number, b: number): number; pick<T>(x: readonly T[]): T; chance(p: number): boolean }): Pt[] {
  for (;;) {
    const pts: Pt[] = [[-4, rng.int(-2, 3)]];
    let x = -4;
    while (x < 4) {
      const dx = Math.min(4 - x, rng.pick([1, 2, 2, 3]));
      const prev = pts[pts.length - 1][1];
      const slopes = [-2, -1, 1, 2, 0].filter((s) => {
        const y = prev + s * dx;
        // no flat pieces lying on the x-axis, where the graph would hide behind the axis
        return y >= -3 && y <= 4 && !(s === 0 && (prev === 0 || rng.chance(0.6)));
      });
      if (!slopes.length) break;
      const s = rng.pick(slopes);
      x += dx;
      pts.push([x, prev + s * dx]);
    }
    if (x !== 4 || pts.length < 4) continue;
    const ys = pts.map((p) => p[1]);
    if (Math.max(...ys) - Math.min(...ys) < 4) continue;
    return pts;
  }
}

const interp = (pts: Pt[], x: number): number => {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x >= x0 - 1e-9 && x <= x1 + 1e-9) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return NaN;
};

const readGraph: Template<ReadParams> = {
  id: 'alg.graphs.read-graph',
  skill: 'alg.graphs',
  format: 'ne',
  style: 'read values from a graphed function: composition, solutions, shifts',
  generate(rng, d) {
    for (;;) {
      const knots = makeKnots(rng);
      const f = (x: number) => interp(knots, x);
      const kind: ReadParams['kind'] = d === 1 ? 'compose' : d === 2 ? rng.pick(['compose', 'count'] as const) : rng.pick(['shift', 'count', 'shift'] as const);
      const knotYs = new Set(knots.map((p) => p[1]));
      let a = 0;
      let c = 0;
      let s = 0;
      let v = 0;
      let answer: number;
      let stem: string;
      let explanation: string;
      let traps: { value: Frac; trap: string }[] = [];
      if (kind === 'compose') {
        const cands = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter((x) => Number.isInteger(f(x)) && f(x) >= -4 && f(x) <= 4 && f(x) !== x);
        if (!cands.length) continue;
        a = rng.pick(cands);
        const fa = f(a);
        answer = f(fa);
        if (!Number.isInteger(answer) || answer === 0 || answer === 1) continue;
        if (fa !== answer) traps = [{ value: frac(fa), trap: 'algw-composite-once' }];
        stem = `The graph of the function $f$, defined for $-4 \\le x \\le 4$, is shown in the $xy$-plane above. What is the value of $f(f(${num(a)}))$?`;
        explanation = `Work from the inside out. The graph passes through $${ptTex(a, fa)}$, so $f(${num(a)}) = ${num(fa)}$.

Then $f(f(${num(a)})) = f(${num(fa)})$, and the graph passes through $${ptTex(fa, answer)}$, so $f(${num(fa)}) = ${num(answer)}$.

Stopping after one step gives $${num(fa)}$, the value of $f(${num(a)})$ only.`;
      } else if (kind === 'count') {
        const cs = [-2, -1, 0, 1, 2, 3].filter((y) => !knotYs.has(y));
        if (!cs.length) continue;
        c = rng.pick(cs);
        let cnt = 0;
        const xs: string[] = [];
        for (let i = 0; i + 1 < knots.length; i++) {
          const [x0, y0] = knots[i];
          const [x1, y1] = knots[i + 1];
          if ((y0 - c) * (y1 - c) < 0) {
            cnt++;
            xs.push(`between $${num(x0)}$ and $${num(x1)}$`);
          }
        }
        if (cnt < 2) continue;
        answer = cnt;
        stem = `The graph of the function $f$, defined for $-4 \\le x \\le 4$, is shown in the $xy$-plane above. For how many values of $x$ is $f(x) = ${num(c)}$?`;
        explanation = `Draw the horizontal line $y = ${num(c)}$ across the graph and count the points where it meets the graph: it crosses the graph ${cnt} times (${xs.join(', ')}).

So there are ${cnt} values of $x$ with $f(x) = ${num(c)}$. Look at the whole graph; it is easy to miss a crossing near an endpoint.`;
        if (cnt > 1) traps = [{ value: frac(cnt - 1), trap: 'algw-count-crossings' }];
      } else {
        s = rng.pick([-2, -1, 1, 2, 3]);
        v = rng.pick([-2, -1, 1, 2, 3]);
        const cands = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter((x) => {
          const inner = x - s;
          const wrongInner = x + s;
          return inner >= -4 && inner <= 4 && Number.isInteger(f(inner)) && wrongInner >= -4 && wrongInner <= 4 && f(wrongInner) !== f(inner);
        });
        if (!cands.length) continue;
        a = rng.pick(cands);
        const inner = a - s;
        answer = f(inner) + v;
        if (answer === 0 || answer === 1) continue;
        traps = [{ value: frac(f(a + s) + v), trap: 'algw-shift-direction' }];
        const gDef = `f(x ${s > 0 ? '-' : '+'} ${Math.abs(s)}) ${v > 0 ? '+' : '-'} ${Math.abs(v)}`;
        stem = `The graph of the function $f$, defined for $-4 \\le x \\le 4$, is shown in the $xy$-plane above. The function $g$ is defined by $g(x) = ${gDef}$. What is the value of $g(${num(a)})$?`;
        explanation = `$g(${num(a)}) = f(${num(a)} ${s > 0 ? '-' : '+'} ${Math.abs(s)}) ${v > 0 ? '+' : '-'} ${Math.abs(v)} = f(${num(inner)}) ${v > 0 ? '+' : '-'} ${Math.abs(v)}$.

From the graph, $f(${num(inner)}) = ${num(f(inner))}$, so $g(${num(a)}) = ${num(f(inner))} ${v > 0 ? '+' : '-'} ${Math.abs(v)} = ${num(answer)}$.

The graph of $g$ is the graph of $f$ moved ${Math.abs(s)} unit${Math.abs(s) === 1 ? '' : 's'} to the ${s > 0 ? 'right' : 'left'}: reading $f(${num(a + s)})$ instead shifts the wrong way.`;
      }
      const w: Window = { xMin: -5, xMax: 5, yMin: -4, yMax: 5 };
      // Put the label "y = f(x)" in a corner the graph stays away from.
      const corners: Pt[] = [
        [-3.4, 4.4],
        [3.4, 4.4],
        [-3.4, -3.4],
        [3.4, -3.4],
      ];
      const far = corners.find(([cx, cy]) => [cx - 1.2, cx, cx + 1.2].every((x) => Math.abs(f(Math.max(-4, Math.min(4, x))) - cy) > 1.3));
      if (!far) continue;
      const figure: GeometryFigure = {
        kind: 'geometry',
        points: { L: knots[0], R: knots[knots.length - 1] },
        hideLabels: ['L', 'R'],
        circles: dots(['L', 'R'], w),
        axes: { ...w, grid: true, step: 1, labelTicks: true },
        curves: [{ pts: knots }],
        labels: [{ at: far, text: '$y = f(x)$' }],
      };
      return {
        params: { kind, a, c, s, v },
        q: { format: 'ne', figure, stem, answer: frac(answer), traps: traps.filter((t) => !t.value.eq(answer)), explanation },
      };
    }
  },
  check(q, { kind, a, c, s, v }) {
    const fig = (Array.isArray(q.figure) ? q.figure[0] : q.figure) as GeometryFigure;
    const pts = fig.curves![0].pts;
    const f = (x: number) => interp(pts, x);
    if (kind === 'compose') return expectNe(q, Math.round(f(f(a))));
    if (kind === 'shift') return expectNe(q, Math.round(f(a - s) + v));
    // Count sign changes of f - c on a fine grid.
    let cnt = 0;
    let last = 0;
    for (let i = 0; i <= 8 * 256; i++) {
      const x = -4 + i / 256;
      const val = f(x) - c;
      const sg = Math.sign(val);
      if (sg !== 0 && last !== 0 && sg !== last) cnt++;
      if (sg !== 0) last = sg;
    }
    return expectNe(q, cnt);
  },
};

/* =============================================================================================
 * 5. Intersections of a parabola with a line or another parabola (MCS) [GEN AL-G39]
 * =========================================================================================== */

interface MeetParams {
  kind: 'horizontal' | 'sum-x' | 'point-y' | 'two-parabolas';
  /** First graph y = p1 x^2 + p2 x + p3, second y = q1 x^2 + q2 x + q3. */
  P: [number, number, number];
  Q: [number, number, number];
  values: Frac[];
}

const fmtV = (v: Frac) => `$${num(v)}$`;

const intersectionPoints: Template<MeetParams> = {
  id: 'alg.graphs.intersection',
  skill: 'alg.graphs',
  format: 'mcs',
  style: 'intersection points of a parabola and a line',
  generate(rng, d) {
    const kind: MeetParams['kind'] = d === 1 ? 'horizontal' : d === 2 ? rng.pick(['sum-x', 'point-y'] as const) : rng.pick(['two-parabolas', 'point-y'] as const);
    let P: [number, number, number];
    let Q: [number, number, number];
    let correct: Frac;
    let traps: { value: Frac; trap: string }[] = [];
    let stem: string;
    let explanation: string;
    if (kind === 'horizontal') {
      const k0 = rng.int(-12, 4);
      const half = rng.int(2, 8);
      const c = k0 + half * half;
      P = [1, 0, k0];
      Q = [0, 0, c];
      correct = frac(2 * half);
      traps = [
        { value: frac(half), trap: 'algw-one-intersection' },
        { value: frac(half * half), trap: 'algw-distance-no-root' },
        { value: frac(2 * half * half), trap: 'algw-distance-no-root' },
        { value: frac(c), trap: 'algw-answered-line-height' },
        { value: frac(4 * half * half), trap: 'algw-distance-no-root' },
      ];
      stem = rng.chance(0.5)
        ? `In the $xy$-plane, the line $y = ${num(c)}$ intersects the graph of $y = ${poly([1, 0, k0])}$ at two points. What is the distance between these two points?`
        : `In the $xy$-plane, the graph of $y = ${poly([1, 0, k0])}$ meets the horizontal line $y = ${num(c)}$ at two points. How far apart are these two points?`;
      explanation = `At an intersection, $${poly([1, 0, k0])} = ${num(c)}$, so $x^2 = ${half * half}$ and $x = ${half}$ or $x = -${half}$.

The two points are $${ptTex(-half, c)}$ and $${ptTex(half, c)}$, on the same horizontal line, so the distance between them is $${half} - (-${half}) = ${2 * half}$.

Keeping only $x = ${half}$ gives half the distance.`;
    } else if (kind === 'sum-x' || kind === 'point-y') {
      let r1: number;
      let r2: number;
      let m: number;
      let k: number;
      let b: number;
      let c0: number;
      do {
        r1 = rng.int(-5, 4);
        r2 = rng.int(r1 + 1, 6);
        m = rng.int(-3, 3);
        k = rng.int(-6, 6);
        // x^2 + b x + c0 - (m x + k) = (x - r1)(x - r2)
        b = m - (r1 + r2);
        c0 = r1 * r2 + k;
      } while (b === 0 || m === 0 || r1 + r2 === 0);
      P = [1, b, c0];
      Q = [0, m, k];
      const parab = poly([1, b, c0]);
      const line = poly([m, k]);
      if (kind === 'sum-x') {
        correct = frac(r1 + r2);
        traps = [
          { value: frac(-b), trap: 'algw-intercepts-not-intersection' },
          { value: frac(-(r1 + r2)), trap: 'alg-sign-slip' },
          { value: frac(r1 * r2), trap: 'alg-product-for-sum' },
          { value: frac(b), trap: 'alg-coefficient-as-root' },
          { value: frac(m), trap: 'alg-coefficient-as-root' },
        ];
        stem = `In the $xy$-plane, the graph of $y = ${parab}$ and the line $y = ${line}$ intersect at two points. What is the sum of the $x$-coordinates of the two points?`;
        explanation = `Set the expressions equal: $${parab} = ${line}$, so $${poly([1, b - m, c0 - k])} = 0$, which factors as $${fac(r1)}${fac(r2)} = 0$.

The $x$-coordinates are $${num(r1)}$ and $${num(r2)}$, and their sum is $${num(r1 + r2)}$. (For $x^2 + px + q = 0$ the sum of the roots is $-p$.)

The sum of the $x$-intercepts of the parabola, $${num(-b)}$, answers a different question: those points are not on the line.`;
      } else {
        const yv = m * r2 + k;
        correct = frac(yv);
        traps = [
          { value: frac(r2), trap: 'algw-gave-x-not-y' },
          { value: frac(m * r1 + k), trap: 'algw-answered-other-unknown' },
          { value: frac(r1), trap: 'algw-gave-x-not-y' },
          { value: frac(m * r2), trap: 'alg-dropped-term' },
          { value: frac(r2 * r2 + b * r2), trap: 'alg-dropped-term' },
        ];
        stem = `In the $xy$-plane, the graph of $y = ${parab}$ and the line $y = ${line}$ intersect at two points. What is the $y$-coordinate of the point of intersection that has the greater $x$-coordinate?`;
        explanation = `Set the expressions equal: $${parab} = ${line}$, so $${poly([1, b - m, c0 - k])} = 0$, which factors as $${fac(r1)}${fac(r2)} = 0$. The $x$-coordinates are $${num(r1)}$ and $${num(r2)}$.

The greater one is $${num(r2)}$; substitute it into the line: $y = ${substTex(0, m, k, r2)} = ${num(yv)}$. (The parabola gives the same value.)

$${num(r2)}$ is the $x$-coordinate, not the $y$-coordinate.`;
      }
    } else {
      // two parabolas: y = x^2 + b1 x + c1 and y = -x^2 + b2 x + c2; 2x^2 + (b1-b2)x + (c1-c2) = 0 with integer roots
      let r1: number;
      let r2: number;
      let b1: number;
      let c1: number;
      do {
        r1 = rng.int(-4, 2);
        r2 = rng.int(r1 + 1, 5);
        b1 = rng.int(-4, 4);
        c1 = rng.int(-6, 6);
      } while (r1 + r2 === 0);
      // 2(x - r1)(x - r2) = 2x^2 - 2(r1+r2)x + 2 r1 r2 = x^2 + b1 x + c1 - (-x^2 + b2 x + c2)
      const b2 = b1 + 2 * (r1 + r2);
      const c2 = c1 - 2 * r1 * r2;
      P = [1, b1, c1];
      Q = [-1, b2, c2];
      const yv = r2 * r2 + b1 * r2 + c1;
      correct = frac(yv);
      traps = [
        { value: frac(r2), trap: 'algw-gave-x-not-y' },
        { value: frac(r1 * r1 + b1 * r1 + c1), trap: 'algw-answered-other-unknown' },
        { value: frac(r1), trap: 'algw-gave-x-not-y' },
        { value: frac(r2 * r2 + b1 * r2), trap: 'alg-dropped-term' },
        { value: frac(-(r2 * r2) + b2 * r2 + c2 - 2 * (r2 * r2)), trap: 'alg-sign-slip' },
      ];
      stem = `In the $xy$-plane, the graphs of $y = ${poly(P)}$ and $y = ${poly(Q)}$ intersect at two points. What is the $y$-coordinate of the point of intersection that has the greater $x$-coordinate?`;
      explanation = `Set the expressions equal: $${poly(P)} = ${poly(Q)}$, so $${poly([2, b1 - b2, c1 - c2])} = 0$, that is, $2(${poly([1, -(r1 + r2), r1 * r2])}) = 0$, which gives $x = ${num(r1)}$ or $x = ${num(r2)}$.

The greater is $x = ${num(r2)}$. Substitute into the first equation: $y = ${substTex(1, b1, c1, r2)} = ${num(yv)}$.

$${num(r2)}$ is the $x$-coordinate, not the $y$-coordinate.`;
    }
    const WHY: Record<string, string> = {
      'algw-one-intersection': 'keeping only one of the two intersection points',
      'algw-distance-no-root': 'forgetting a square root, or squaring a distance',
      'algw-intercepts-not-intersection': 'using the x-intercepts of the parabola instead of the intersection points',
      'algw-gave-x-not-y': 'giving an x-coordinate instead of the y-coordinate',
      'algw-answered-other-unknown': 'finding y at the other intersection point',
      'alg-sign-slip': 'a sign error',
      'alg-product-for-sum': 'giving the product of the solutions instead of their sum',
      'alg-coefficient-as-root': 'using a coefficient of the equation as the answer',
      'alg-dropped-term': 'leaving out a term when substituting',
      'algw-answered-line-height': 'giving the height of the line instead of the distance',
    };
    const res = trapChoices(
      rng,
      correct,
      traps.filter((t) => kind !== 'horizontal' || t.value.sign() > 0),
      fmtV,
    );
    if (!res) return intersectionPoints.generate(rng, d);
    const { choices, answer, values } = res;
    const cited = res.kept[0];
    return {
      params: { kind, P, Q, values },
      q: { format: 'mcs', stem, choices, answer, explanation: `${explanation}

Trap: $${num(cited.value)}$ comes from ${WHY[cited.trap]}.` },
    };
  },
  check(q, { kind, P, Q, values }) {
    const err = choiceValuesMatch(q, values, fmtV);
    if (err) return err;
    const f = (x: number) => P[0] * x * x + P[1] * x + P[2];
    const g = (x: number) => Q[0] * x * x + Q[1] * x + Q[2];
    const h = (x: number) => f(x) - g(x);
    const roots: number[] = [];
    for (let i = -4000; i < 4000; i++) {
      const x0 = i / 200;
      const x1 = (i + 1) / 200;
      if (h(x0) === 0) roots.push(x0);
      else if (h(x0) * h(x1) < 0) {
        let lo = x0;
        let hi = x1;
        for (let j = 0; j < 60; j++) {
          const mid = (lo + hi) / 2;
          if (h(lo) * h(mid) <= 0) hi = mid;
          else lo = mid;
        }
        roots.push((lo + hi) / 2);
      }
    }
    if (roots.length !== 2) return `${roots.length} intersection points`;
    const target =
      kind === 'horizontal' ? Math.abs(roots[1] - roots[0]) : kind === 'sum-x' ? roots[0] + roots[1] : g(Math.max(...roots));
    return expectMcs(
      q,
      uniqueIndex(values, (v) => Math.abs(v.toNumber() - target) < 1e-6),
    );
  },
};

/** "(x - 3)" style factor; "x" for a root at 0. */
const fac = (r: number) => (r === 0 ? 'x' : `(x ${r < 0 ? '+' : '-'} ${Math.abs(r)})`);

/** Substitution TeX "(-2)^2 + 3(-2) - 4" for y = A x^2 + B x + C at x. */
function substTex(A: number, B: number, C: number, x: number): string {
  const px = x < 0 ? `(${num(x)})` : num(x);
  const parts: string[] = [];
  if (A !== 0) parts.push(`${A === 1 ? '' : A === -1 ? '-' : num(A)}${px}^2`);
  if (B !== 0) parts.push(`${parts.length ? (B < 0 ? '- ' : '+ ') : B < 0 ? '-' : ''}${Math.abs(B) === 1 ? '' : num(Math.abs(B))}(${num(x)})`);
  if (C !== 0 || !parts.length) parts.push(`${parts.length ? (C < 0 ? '- ' : '+ ') : C < 0 ? '-' : ''}${num(Math.abs(C))}`);
  return parts.join(' ');
}

export const graphTemplates: Template<any>[] = [lineMeetsV, parabolaQC, regionPoints, readGraph, intersectionPoints];
