import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { trapChoices } from './util';

export const quadraticWordTraps: Record<string, Trap> = {
  'alg-quad-word-one-dimension': {
    label: 'Answered with one dimension or one number instead of the quantity asked',
    fix: 'After solving the quadratic, rebuild every quantity of the story and answer the one the question names.',
  },
  'alg-quad-word-semi': {
    label: 'Gave half the perimeter',
    fix: 'The perimeter goes all the way round: $2(\\text{width} + \\text{length})$.',
  },
  'alg-quad-word-length-only': {
    label: 'Doubled only one dimension when computing the perimeter',
    fix: 'A rectangle has two lengths AND two widths: perimeter $= 2L + 2W$.',
  },
  'alg-quad-word-dropped-offset': {
    label: 'Forgot the extra amount when building the length from the width',
    fix: 'Length $= k \\cdot \\text{width} + s$: multiply first, then add the extra.',
  },
  'alg-quad-word-doubled': {
    label: 'Treated the two consecutive numbers as equal',
    fix: 'Consecutive numbers differ: one is $n$ and the other is $n + 1$ (or $n + 2$ for even or odd numbers), so their sum is not twice one of them.',
  },
  'alg-quad-word-total': {
    label: 'Gave the side of the whole figure instead of the width of the border',
    fix: 'The large square is the small square plus a border on every side. Subtract the small side and split what is left between the two sides.',
  },
  'alg-quad-word-one-side': {
    label: 'Put the border on one side only',
    fix: 'A border of width $w$ around a square adds $w$ on EACH side, so the side grows by $2w$.',
  },
  'alg-quad-word-added': {
    label: 'Added the small side instead of subtracting it',
    fix: 'The border is what the large figure has beyond the small one: subtract the small side, do not add it.',
  },
};

interface Params {
  kind: 'rect' | 'consec' | 'path';
  /** rect: [k, s, A, asked (0 perimeter, 1 length)]. consec: [step, P]. path: [s, A]. */
  k: number[];
  values: number[];
}

const THINGS = ['garden', 'poster', 'rug', 'banner', 'field'];

const quadraticWordMCS: Template<Params> = {
  id: 'alg.quadratics.word-mcs',
  skill: 'alg.quadratics',
  format: 'mcs',
  style: 'a story that leads to a quadratic: areas and consecutive numbers',
  generate(rng, d) {
    for (;;) {
      const kind: Params['kind'] = d === 1 ? 'rect' : d === 2 ? rng.pick(['rect', 'consec', 'rect']) : rng.pick(['rect', 'path', 'path', 'consec']);
      let stem: string;
      let key: number;
      let k: number[];
      let steps: string;
      let rule: string;
      const cand: { value: number; trap: string; why: string }[] = [];
      if (kind === 'rect') {
        const mult = d === 1 ? 1 : d === 2 ? rng.pick([1, 2]) : rng.pick([2, 3]);
        const s = rng.int(2, 9);
        const w = rng.int(3, 18);
        const L = mult * w + s;
        const A = w * L;
        if (A > 700) continue;
        const asked = d === 1 ? 0 : rng.int(0, 1);
        key = asked === 0 ? 2 * (w + L) : L;
        k = [mult, s, A, asked];
        const thing = rng.pick(THINGS);
        const rel = mult === 1 ? `${s} feet more than its width` : `${s} feet more than ${mult === 2 ? 'twice' : 'three times'} its width`;
        stem = `The length of a rectangular ${thing} is ${rel}. Its area is ${A} square feet. What is its ${asked === 0 ? 'perimeter' : 'length'}, in feet?`;
        steps = `Let $w$ be the width in feet. The length is $${mult === 1 ? '' : mult}w + ${s}$, so the area gives $w(${mult === 1 ? '' : mult}w + ${s}) = ${A}$, that is $${mult === 1 ? '' : mult}w^2 + ${s}w - ${A} = 0$. Factor: $(w - ${w})(${mult === 1 ? '' : mult}w + ${mult * w + s}) = 0$, so $w = ${w}$ or $w = ${new Frac(-(mult * w + s), mult).toTex()}$. A width cannot be negative, so $w = ${w}$ and the length is $${mult === 1 ? '' : `${mult} \\cdot `}${w} + ${s} = ${L}$.${asked === 0 ? ` The perimeter is $2(${w} + ${L}) = ${2 * (w + L)}$.` : ''}

Check: $${w} \\cdot ${L} = ${A}$.`;
        rule = 'Name the unknown, write the area as a product of two expressions in it, factor, and discard the negative root.';
        if (asked === 0) {
          cand.push({ value: w, trap: 'alg-quad-word-one-dimension', why: `$${w}$ is only the width.` });
          cand.push({ value: L, trap: 'alg-quad-word-one-dimension', why: `$${L}$ is only the length.` });
          cand.push({ value: w + L, trap: 'alg-quad-word-semi', why: `$${w} + ${L} = ${w + L}$ is half of the way round.` });
          cand.push({ value: 2 * L, trap: 'alg-quad-word-length-only', why: `Doubling only the length gives $${2 * L}$.` });
          cand.push({ value: 2 * w + L, trap: 'alg-quad-word-length-only', why: `Counting the length once and the width twice gives $${2 * w + L}$.` });
        } else {
          cand.push({ value: w, trap: 'alg-quad-word-one-dimension', why: `$${w}$ is the width, not the length.` });
          cand.push({ value: 2 * (w + L), trap: 'alg-quad-word-one-dimension', why: `$${2 * (w + L)}$ is the perimeter, not the length.` });
          cand.push({ value: mult * w, trap: 'alg-quad-word-dropped-offset', why: `$${mult * w}$ leaves out the extra ${s} feet.` });
          cand.push({ value: w + s, trap: 'alg-quad-word-dropped-offset', why: `Adding ${s} to the width without the multiplier gives $${w + s}$.` });
          cand.push({ value: w + L, trap: 'alg-quad-word-one-dimension', why: `$${w + L}$ is the sum of both dimensions.` });
        }
      } else if (kind === 'consec') {
        const step = rng.pick([1, 2, 2]);
        const n1 = rng.int(d === 2 ? 4 : 5, 22);
        const odd = step === 2 && rng.chance(0.5);
        const first = step === 2 ? (odd ? 2 * Math.floor(n1 / 2) + 1 : 2 * Math.floor(n1 / 2)) : n1;
        if (first < 3) continue;
        const second = first + step;
        const P = first * second;
        key = first + second;
        k = [step, P];
        const noun = step === 1 ? 'integers' : first % 2 === 0 ? 'even integers' : 'odd integers';
        stem = `The product of two consecutive positive ${noun} is ${P}. What is the sum of the two integers?`;
        steps = `Let $n$ be the lesser integer. The greater is $n + ${step}$, so $n(n + ${step}) = ${P}$, that is $n^2 + ${step === 1 ? '' : step}n - ${P} = 0$. Factor: $(n - ${first})(n + ${second}) = 0$. The integers are positive, so $n = ${first}$ and the greater is ${second}. Their sum is $${first} + ${second} = ${key}$.

Check: $${first} \\cdot ${second} = ${P}$.`;
        rule = 'For consecutive numbers use $n$ and $n + $ step; the product gives a quadratic whose positive root is the lesser number.';
        cand.push({ value: first, trap: 'alg-quad-word-one-dimension', why: `$${first}$ is only the lesser integer.` });
        cand.push({ value: second, trap: 'alg-quad-word-one-dimension', why: `$${second}$ is only the greater integer.` });
        cand.push({ value: 2 * first, trap: 'alg-quad-word-doubled', why: `Doubling the lesser integer gives $${2 * first}$.` });
        cand.push({ value: 2 * second, trap: 'alg-quad-word-doubled', why: `Doubling the greater integer gives $${2 * second}$.` });
        cand.push({ value: key + step, trap: 'alg-sign-slip', why: `A slip of one step in either number gives $${key + step}$.` });
      } else {
        const s = 2 * rng.int(2, 8);
        const w = rng.int(1, 9);
        const S = s + 2 * w;
        const A = S * S;
        if (A > 900) continue;
        key = w;
        k = [s, A];
        stem = `A square patio has sides of ${s} feet. A path of constant width is built all the way around it, and the patio and path together cover ${A} square feet. What is the width of the path, in feet?`;
        steps = `Let $w$ be the width of the path. The path adds $w$ on each side, so the whole square has side $${s} + 2w$ and $(${s} + 2w)^2 = ${A}$. Taking the positive root, $${s} + 2w = ${S}$, so $2w = ${S - s}$ and $w = ${w}$.

Check: $(${s} + ${2 * w})^2 = ${S}^2 = ${A}$.`;
        rule = 'A border of width $w$ around a figure adds $2w$ to each side length.';
        cand.push({ value: S, trap: 'alg-quad-word-total', why: `$${S}$ is the side of the whole square, not the path.` });
        cand.push({ value: 2 * w, trap: 'alg-quad-word-one-side', why: `$${S} - ${s} = ${2 * w}$ treats the path as being on one side only.` });
        cand.push({ value: s + w, trap: 'alg-quad-word-added', why: `$${s} + ${w} = ${s + w}$ adds the patio side instead of subtracting it.` });
        cand.push({ value: S / 2, trap: 'alg-quad-word-total', why: `Halving the whole side gives $${S / 2}$, which is not the path width.` });
        cand.push({ value: S - w, trap: 'alg-sign-slip', why: `$${S} - ${w} = ${S - w}$ subtracts the wrong amount.` });
      }
      const uniq = cand.filter((c) => Number.isInteger(c.value) && c.value > 0);
      const res = trapChoices(rng, key, uniq.map((c) => ({ ...c, value: new Frac(c.value) })), (v) => `$${v.toTex()}$`);
      if (!res) continue;
      const order = rng.shuffle(res.choices.map((_, i) => i));
      return {
        params: { kind, k: k!, values: order.map((i) => res.values[i].n) },
        q: {
          format: 'mcs',
          stem,
          choices: order.map((i) => res.choices[i]),
          answer: order.indexOf(res.answer),
          explanation: `A story whose unknown multiplies itself gives a quadratic: set it up, factor, and keep the root that makes sense.

${steps!}

Trap: ${res.kept[0].why}

Rule: ${rule!}`,
        },
      };
    }
  },
  check(q, { kind, k, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => q.choices[i].text !== `$${num(v)}$`)) return 'choice text mismatch';
    let found: number | null = null;
    let count = 0;
    if (kind === 'rect') {
      const [mult, s, A, asked] = k;
      for (let w = 1; w <= 300; w++) {
        const L = mult * w + s;
        if (w * L === A) {
          count++;
          found = asked === 0 ? 2 * (w + L) : L;
        }
      }
    } else if (kind === 'consec') {
      const [step, P] = k;
      for (let n = 1; n <= 300; n++)
        if (n * (n + step) === P) {
          count++;
          found = 2 * n + step;
        }
    } else {
      const [s, A] = k;
      for (let w = 1; w <= 100; w++)
        if ((s + 2 * w) * (s + 2 * w) === A) {
          count++;
          found = w;
        }
    }
    if (count !== 1 || found === null) return `${count} solutions`;
    const hits = values.flatMap((v, i) => (v === found ? [i] : []));
    return hits.length === 1 && hits[0] === q.answer ? null : `expected ${found}`;
  },
};

export const quadraticWordTemplates = [quadraticWordMCS];
