import { Frac, frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { choiceValuesMatch, dx, expectMcs, trapChoices, uniqueIndex } from './util';

// alg.mixtures-interest: part of a mixture is drawn off and replaced (select one).

export const mxReplacementTraps: Record<string, Trap> = {
  'algw-replace-subtract': {
    label: 'Subtracted the liters removed from the percent',
    fix: 'Liters and percents are different units. Track the liters of the substance: the removed liters carry only their share of it.',
  },
  'algw-replace-removed-share': {
    label: 'Gave the share of the substance that was removed',
    fix: 'The question asks what is in the container NOW, not what was taken out. Subtract the removed substance from what you started with.',
  },
  'algw-replace-forgot-added': {
    label: 'Forgot the substance in the replacement liquid',
    fix: 'The replacement liquid is not pure water this time: the liters added bring their own share of the substance.',
  },
  'algw-replace-no-removal': {
    label: 'Added the new liquid without removing any',
    fix: 'The container is restored to its size by REMOVING part of the old mixture first. The total volume does not grow.',
  },
  'algw-replace-no-dilution': {
    label: 'Forgot that the replacement liquid is weaker',
    fix: 'The replacement carries less of the substance than what was removed, so the concentration falls.',
  },
  'algw-replace-once': {
    label: 'Applied only one of the two replacements',
    fix: 'After the first replacement the container holds a new mixture, and the second replacement removes some of THAT mixture.',
  },
  'algw-replace-linear': {
    label: 'Removed the same amount of substance both times',
    fix: 'The second removal takes out liquid that is already diluted, so it removes less of the substance than the first. The factor is repeated, not subtracted.',
  },
};

interface ReplaceParams {
  kind: 'water' | 'solution' | 'twice';
  V: number;
  k: number;
  p: number;
  q: number;
  values: Frac[];
}

const THINGS = [
  { c: 'a tank', stuff: 'antifreeze', liquid: 'coolant mixture' },
  { c: 'a barrel', stuff: 'alcohol', liquid: 'alcohol solution' },
  { c: 'a vat', stuff: 'acid', liquid: 'acid solution' },
  { c: 'a pitcher', stuff: 'juice', liquid: 'juice drink' },
];

/** Liters with the right plural, e.g. 1 liter, 1.5 liters. */
const lit = (x: Frac) => `${dx(x)} ${x.eq(1) ? 'liter' : 'liters'}`;

const fmt = (v: Frac) => `$${dx(v)}\\%$`;
const ok = (v: Frac) => v.sign() > 0 && v.mul(10).isInt();

export const mxReplacement: Template<ReplaceParams> = {
  id: 'alg.mixtures-interest.replacement',
  skill: 'alg.mixtures-interest',
  format: 'mcs',
  style: 'draw off part of a mixture and replace it',
  generate(rng, d) {
    const kind: ReplaceParams['kind'] = d === 1 ? 'water' : d === 2 ? 'solution' : 'twice';
    const T = rng.pick(THINGS);
    for (;;) {
      const V = rng.pick([20, 25, 40, 50, 80, 100]);
      const k = rng.int(1, Math.floor(V / (kind === 'twice' ? 3 : 2) / 5)) * 5;
      const p = rng.int(2, 18) * 5;
      const q = kind === 'solution' ? rng.int(1, 16) * 5 : 0;
      if (kind === 'solution' && (q === p || q >= p + 40 || p >= q + 60)) continue;
      if (k >= V) continue;
      const left = frac(V - k, V);
      let correct: Frac;
      let cands: { value: Frac; trap: string; why: string }[];
      let stem: string;
      let body: string;
      if (kind === 'water') {
        correct = left.mul(p);
        cands = [
          { value: frac(p - k), trap: 'algw-replace-subtract', why: `subtracts the ${k} liters from the percent` },
          { value: frac(p * k, V), trap: 'algw-replace-removed-share', why: 'is the share of the substance that was taken out' },
          { value: frac(p * V, V + k), trap: 'algw-replace-no-removal', why: 'only adds water and never draws off any mixture' },
          { value: frac(p), trap: 'algw-replace-no-dilution', why: 'ignores that water was added' },
          { value: frac(p, 2), trap: 'algw-average-percents', why: 'averages the percent with the 0 percent of water' },
        ];
        stem = `${T.c[0].toUpperCase()}${T.c.slice(1)} holds ${V} liters of a ${p} percent ${T.liquid}. ${k} liters of the mixture are drawn off and replaced with ${k} liters of water. What percent of the new mixture is ${T.stuff}?`;
        body = `Track the ${T.stuff}. At first there are ${V} × ${dx(frac(p, 100))} = ${lit(frac(p * V, 100))} of it. The ${k} liters drawn off carry ${lit(frac(p * k, 100))}, which leaves ${lit(frac(p * (V - k), 100))}. Water adds none, and the volume is back to ${V} liters, so the percent is $\\frac{${dx(frac(p * (V - k), 100))}}{${V}} = ${dx(correct)}\\%$.`;
      } else if (kind === 'solution') {
        correct = frac(p * (V - k) + q * k, V);
        cands = [
          { value: frac(p * V + q * k, V + k), trap: 'algw-replace-no-removal', why: `adds the ${k} liters without drawing any off` },
          { value: frac(p + q, 2), trap: 'algw-average-percents', why: 'averages the two percents' },
          { value: frac(q * k, V), trap: 'algw-replace-removed-share', why: 'counts only the substance that was added' },
          { value: frac(p), trap: 'algw-replace-no-dilution', why: 'ignores the replacement liquid' },
          { value: frac(p * (V - k), V), trap: 'algw-replace-forgot-added', why: 'forgets the substance in the replacement liquid' },
        ];
        stem = `${T.c[0].toUpperCase()}${T.c.slice(1)} holds ${V} liters of a ${p} percent ${T.liquid}. ${k} liters of the mixture are drawn off and replaced with ${k} liters of a ${q} percent ${T.liquid}. What percent of the new mixture is ${T.stuff}?`;
        body = `Track the ${T.stuff}. At first: ${lit(frac(p * V, 100))}. The ${k} liters drawn off take ${dx(frac(p * k, 100))}; the ${k} liters added bring ${dx(frac(q * k, 100))}. Now there are ${dx(frac(p * V, 100))} − ${dx(frac(p * k, 100))} + ${dx(frac(q * k, 100))} = ${lit(frac(p * (V - k) + q * k, 100))} in ${V} liters, so the percent is ${dx(correct)}.`;
      } else {
        const r1 = left.mul(p);
        correct = left.mul(r1);
        cands = [
          { value: r1, trap: 'algw-replace-once', why: 'applies only the first replacement' },
          { value: frac(p * (V - 2 * k), V), trap: 'algw-replace-linear', why: 'removes the same amount of substance twice' },
          { value: frac(p * 2 * k, V), trap: 'algw-replace-removed-share', why: 'is the share of the substance taken out in all' },
          { value: frac(p), trap: 'algw-replace-no-dilution', why: 'ignores the replacements' },
          { value: frac(p - 2 * k), trap: 'algw-replace-subtract', why: `subtracts the ${2 * k} liters from the percent` },
        ];
        stem = `${T.c[0].toUpperCase()}${T.c.slice(1)} holds ${V} liters of a ${p} percent ${T.liquid}. ${k} liters of the mixture are drawn off and replaced with ${k} liters of water. Then ${k} liters of the new mixture are drawn off and replaced with ${k} liters of water. What percent of the final mixture is ${T.stuff}?`;
        body = `Each replacement keeps the fraction $\\frac{${V - k}}{${V}} = ${dx(left)}$ of the ${T.stuff}, because the liquid drawn off has the same concentration as the rest. After the first: ${p} × ${dx(left)} = ${dx(r1)} percent. After the second: ${dx(r1)} × ${dx(left)} = ${dx(correct)} percent.`;
      }
      if (!ok(correct)) continue;
      const res = trapChoices(
        rng,
        correct,
        cands.filter((x) => ok(x.value) && x.value.lt(100)),
        fmt,
      );
      if (!res) continue;
      // The key often sits at an end of the sorted list, so shuffle.
      const order = rng.shuffle(res.choices.map((_, i) => i));
      const choices = order.map((i) => res.choices[i]);
      const answer = order.indexOf(res.answer);
      const values = order.map((i) => res.values[i]);
      const kept = res.kept[0] as unknown as { why: string; value: Frac };
      return {
        params: { kind, V, k, p, q, values },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `${body}

Check: ${kind === 'solution' ? `a mixture of ${p} and ${q} percent liquids must land between ${Math.min(p, q)} and ${Math.max(p, q)} percent, and ${dx(correct)} does` : `water only dilutes, so the result must be below ${p} percent, and ${dx(correct)} is`}.

Trap: ${dx(kept.value)} percent ${kept.why}. Rule: follow the liters of the substance through each draw and each refill.`,
        },
      };
    }
  },
  check(q, { kind, V, k, p, q: qq, values }) {
    const err = choiceValuesMatch(q, values, fmt);
    if (err) return err;
    // Simulate in tenths of a liter: draw off a share of everything, refill, and track the substance.
    let substance = frac(V * p, 100);
    const round = (refill: number) => {
      substance = substance.sub(substance.mul(k).div(V)).add(frac(k * refill, 100));
    };
    if (kind === 'water') round(0);
    else if (kind === 'solution') round(qq);
    else {
      round(0);
      round(0);
    }
    const want = substance.div(V).mul(100);
    return expectMcs(q, uniqueIndex(values, (v) => v.eq(want)));
  },
};
