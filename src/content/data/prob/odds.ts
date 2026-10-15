import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import type { Template, Trap } from '../../../engine/types';

// Odds questions for data.probability, with their traps.
export const oddsTraps: Record<string, Trap> = {
  'prob-odds-wrong-side': {
    label: 'Used the unfavorable part of the odds as the numerator',
    fix: 'Odds "$u$ to $v$" put the favorable part first. The probability of the event is $\\frac{u}{u + v}$; the probability that it does not happen is $\\frac{v}{u + v}$.',
  },
  'prob-odds-as-ratio': {
    label: 'Read the odds as a probability',
    fix: 'Odds compare favorable to unfavorable outcomes ($u : v$); a probability compares favorable to ALL outcomes: $\\frac{u}{u + v}$. Odds of 1 to 1 are a probability of $\\frac{1}{2}$, not 1.',
  },
  'prob-odds-one-over-total': {
    label: 'Counted a single favorable outcome out of the $u + v$ total',
    fix: 'The odds say there are $u$ favorable outcomes out of $u + v$, not one. The probability is $\\frac{u}{u + v}$.',
  },
  'prob-odds-net': {
    label: 'Used the difference of the two parts of the odds',
    fix: 'The probability uses the favorable part over the SUM of both parts, not their difference: $\\frac{u}{u + v}$.',
  },
  'prob-odds-fifty-fifty': {
    label: 'Treated the event as a coin flip',
    fix: 'Odds other than 1 to 1 are not 50-50. Read the two parts of the odds and build $\\frac{u}{u + v}$.',
  },
  'prob-odds-no-complement': {
    label: 'Stopped at "neither" when the question asks for "at least one"',
    fix: '"At least one" is the complement of "neither": subtract the probability of "neither" from 1.',
  },
  'prob-odds-add': {
    label: 'Added the probabilities of two events that can both happen',
    fix: 'Adding counts the case where both happen twice. For "at least one", compute $1 - P(\\text{neither})$.',
  },
  'prob-odds-both': {
    label: 'Answered the probability of both events instead of the one asked',
    fix: 'Multiplying the two probabilities gives "both happen". Reread whether the question asks for both, neither, or at least one.',
  },
  'prob-odds-complement-final': {
    label: 'Gave "at least one" when the question asks for "neither"',
    fix: '"Neither" multiplies the two complements: $(1 - p_1)(1 - p_2)$. "At least one" is $1$ minus that.',
  },
  'prob-odds-wrong-side-twice': {
    label: 'Used the unfavorable part of the odds for both events',
    fix: 'Convert each pair of odds on its own: $\\frac{u}{u + v}$ is the probability, $\\frac{v}{u + v}$ the probability of the opposite.',
  },
};

const EVENTS = [
  { favor: 'rain on Saturday', clause: 'it rains on Saturday', neg: 'it does not rain on Saturday' },
  { favor: 'the home team winning its next game', clause: 'the home team wins its next game', neg: 'the home team does not win its next game' },
  { favor: 'a seed from this packet germinating', clause: 'a seed from this packet germinates', neg: 'a seed from this packet does not germinate' },
  { favor: 'a part chosen at random passing inspection', clause: 'a part chosen at random passes inspection', neg: 'a part chosen at random fails inspection' },
  { favor: 'the bus arriving on time', clause: 'the bus arrives on time', neg: 'the bus does not arrive on time' },
  { favor: 'a customer paying by card', clause: 'a customer pays by card', neg: 'a customer does not pay by card' },
];

interface OddsParams {
  /** odds pairs as stated (favorable : unfavorable), one pair per event */
  pairs: [number, number][];
  kind: 'event' | 'complement' | 'neither' | 'atleast';
}

const coprimePair = (rng: { int(a: number, b: number): number }, uMin: number, uMax: number, vMin: number, vMax: number): [number, number] => {
  for (;;) {
    const u = rng.int(uMin, uMax);
    const v = rng.int(vMin, vMax);
    if (u !== v && gcd(u, v) === 1) return [u, v];
  }
};

const oddsMCS: Template<OddsParams> = {
  id: 'data.probability.odds-mcs',
  skill: 'data.probability',
  format: 'mcs',
  style: 'odds in favor converted to the probability of an event or of its complement',
  generate(rng, d) {
    for (;;) {
      const [e1, e2] = rng.sample(EVENTS, 2);
      let stem: string;
      let kind: OddsParams['kind'];
      let pairs: [number, number][];
      let key: Frac;
      let traps: { value: Frac; trap: string }[];
      let how: string;
      let lead: string;
      const tex = (f: Frac) => f.toTex();
      if (d < 3) {
        const against = d === 2 && rng.chance(0.4);
        const [a, b] = d === 1 ? coprimePair(rng, 2, 8, 3, 9) : coprimePair(rng, 1, 12, 2, 14);
        const small = Math.min(a, b);
        const big = Math.max(a, b);
        // stated odds: in favor u : v (u < v) or against u : v (u > v); f = favorable part, c = the other part
        const u = against ? big : small;
        const v = against ? small : big;
        pairs = [[u, v]];
        const f = against ? v : u; // favorable outcomes
        const c = against ? u : v; // unfavorable outcomes
        const askNeg = d === 2 && !against && rng.chance(0.6);
        kind = askNeg ? 'complement' : 'event';
        const pEvent = new Frac(f, f + c);
        key = askNeg ? new Frac(c, f + c) : pEvent;
        const side = `${f} favorable and ${c} unfavorable outcomes`;
        stem = `The odds ${against ? 'against' : 'in favor of'} ${e1.favor} are ${u} to ${v}. What is the probability that ${askNeg ? e1.neg : e1.clause}?`;
        const wrong = askNeg ? pEvent : new Frac(c, f + c);
        traps = [
          { value: wrong, trap: 'prob-odds-wrong-side' },
          { value: new Frac(small, big), trap: 'prob-odds-as-ratio' },
          { value: new Frac(1, f + c), trap: 'prob-odds-one-over-total' },
          { value: new Frac(big - small, f + c), trap: 'prob-odds-net' },
          { value: new Frac(1, 2), trap: 'prob-odds-fifty-fifty' },
        ];
        lead = `Odds compare favorable outcomes to unfavorable ones, so read the two numbers as counts, not as a probability.`;
        how = `Odds of ${u} to ${v} ${against ? 'against' : 'in favor'} mean ${side}, ${f + c} in all. ${askNeg ? `The event we want is the unfavorable one: $\\frac{${c}}{${f + c}}$.` : `The probability of the event is the favorable part over the total: $\\frac{${f}}{${f + c}}$.`} Check: the odds are $${f}$ to $${c}$ for the event, and $\\frac{${f}}{${f + c}} \\div \\frac{${c}}{${f + c}} = \\frac{${f}}{${c}}$.`;
      } else {
        const p1 = coprimePair(rng, 1, 5, 2, 8);
        const p2 = coprimePair(rng, 1, 5, 2, 8);
        if (p1[0] > p1[1] || p2[0] > p2[1]) continue;
        pairs = [p1, p2];
        const q1 = new Frac(p1[0], p1[0] + p1[1]);
        const q2 = new Frac(p2[0], p2[0] + p2[1]);
        const neither = q1.neg().add(1).mul(q2.neg().add(1));
        const atLeast = neither.neg().add(1);
        const wantNeither = rng.chance(0.5);
        kind = wantNeither ? 'neither' : 'atleast';
        key = wantNeither ? neither : atLeast;
        stem = `The odds in favor of ${e1.favor} are ${p1[0]} to ${p1[1]}, and the odds in favor of ${e2.favor} are ${p2[0]} to ${p2[1]}. Assume the two events are independent. What is the probability that ${wantNeither ? 'neither event occurs' : 'at least one of the events occurs'}?`;
        const r1 = new Frac(p1[0], p1[1]);
        const r2 = new Frac(p2[0], p2[1]);
        const wrongSide = new Frac(p1[0], p1[0] + p1[1]).mul(new Frac(p2[0], p2[0] + p2[1]));
        traps = wantNeither
          ? [
              { value: atLeast, trap: 'prob-odds-complement-final' },
              { value: q1.mul(q2), trap: 'prob-odds-both' },
              { value: r1.neg().add(1).mul(r2.neg().add(1)), trap: 'prob-odds-as-ratio' },
              { value: q1.neg().add(1).add(q2.neg().add(1)), trap: 'prob-odds-add' },
              { value: new Frac(1, 2), trap: 'prob-odds-fifty-fifty' },
            ]
          : [
              { value: neither, trap: 'prob-odds-no-complement' },
              { value: q1.add(q2), trap: 'prob-odds-add' },
              { value: q1.mul(q2), trap: 'prob-odds-both' },
              { value: wrongSide.neg().add(1), trap: 'prob-odds-wrong-side-twice' },
              { value: r1.neg().add(1).mul(r2.neg().add(1)).neg().add(1), trap: 'prob-odds-as-ratio' },
            ];
        lead = `Convert each pair of odds to a probability first, then combine the independent events.`;
        how = `Odds of ${p1[0]} to ${p1[1]} give $p_1 = ${tex(q1)}$, and ${p2[0]} to ${p2[1]} give $p_2 = ${tex(q2)}$. The probability that an event does not occur is $1 - p$, so for independent events $P(\\text{neither}) = ${tex(q1.neg().add(1))} \\cdot ${tex(q2.neg().add(1))} = ${tex(neither)}$.${wantNeither ? '' : ` "At least one" is the opposite of "neither": $1 - ${tex(neither)} = ${tex(atLeast)}$.`}`;
      }
      traps = traps.filter((t) => t.value.gt(0) && t.value.lt(1));
      const distinct = new Set(traps.filter((t) => !t.value.eq(key)).map((t) => t.value.toString()));
      if (distinct.size < 4) continue;
      const built = numericChoices(rng, { correct: key, traps, format: (v) => `$${tex(v)}$`, order: 'random' });
      const present = new Map(built.choices.filter((c) => c.trap).map((c) => [c.trap!, c.text]));
      const order = ['prob-odds-wrong-side', 'prob-odds-complement-final', 'prob-odds-no-complement', 'prob-odds-as-ratio', 'prob-odds-add', 'prob-odds-both', 'prob-odds-one-over-total', 'prob-odds-net', 'prob-odds-wrong-side-twice', 'prob-odds-fifty-fifty'];
      const firstId = order.find((id) => present.has(id))!;
      const val = present.get(firstId)!;
      const trapLine: Record<string, string> = {
        'prob-odds-wrong-side': `${val} is a mistake that swaps the favorable and unfavorable parts: it is the probability of the opposite event.`,
        'prob-odds-complement-final': `${val} is the probability of "at least one", a wrong answer to "neither".`,
        'prob-odds-no-complement': `${val} is only the probability of "neither", a wrong stopping point for "at least one".`,
        'prob-odds-as-ratio': `${val} is tempting because it divides one part of the odds by the other, but that is a ratio of odds, not a probability.`,
        'prob-odds-add': `${val} is a mistake that adds probabilities of events that can both happen.`,
        'prob-odds-both': `${val} is the probability that both events occur, a different question.`,
        'prob-odds-one-over-total': `${val} is a mistake that counts one favorable outcome instead of the ${pairs[0][0] > pairs[0][1] ? pairs[0][1] : pairs[0][0]} the odds give.`,
        'prob-odds-net': `${val} is a mistake that uses the difference of the two parts instead of their sum.`,
        'prob-odds-wrong-side-twice': `${val} is a mistake that swaps the favorable and unfavorable parts for both events.`,
        'prob-odds-fifty-fifty': `${val} is tempting as a coin flip, but these odds are not 1 to 1.`,
      };
      return {
        params: { pairs, kind },
        q: {
          format: 'mcs',
          stem,
          choices: built.choices,
          answer: built.answer,
          explanation: `${lead}\n\n${how}\n\nTrap: ${trapLine[firstId]}\n\nRule: odds $u$ to $v$ in favor mean probability $\\frac{u}{u + v}$; against, the event has probability $\\frac{v}{u + v}$.`,
        },
      };
    }
  },
  check(q, { pairs, kind }) {
    if (q.format !== 'mcs') return 'wrong format';
    // Count equally likely outcomes: each event has f favorable and c unfavorable ones.
    const count = (pair: [number, number], against: boolean) => (against ? { f: pair[1], c: pair[0] } : { f: pair[0], c: pair[1] });
    let good = 0;
    let all = 0;
    if (pairs.length === 1) {
      const against = pairs[0][0] > pairs[0][1];
      const { f, c } = count(pairs[0], against);
      for (let i = 0; i < f + c; i++) {
        all++;
        const favorable = i < f;
        if (kind === 'event' ? favorable : !favorable) good++;
      }
    } else {
      const a = pairs[0][0] + pairs[0][1];
      const b = pairs[1][0] + pairs[1][1];
      for (let i = 0; i < a; i++)
        for (let j = 0; j < b; j++) {
          all++;
          const e1 = i < pairs[0][0];
          const e2 = j < pairs[1][0];
          if (kind === 'neither' ? !e1 && !e2 : e1 || e2) good++;
        }
    }
    const want = new Frac(good, all);
    return q.choices[q.answer].text === `$${want.toTex()}$` ? null : `expected ${want.toString()}, keyed ${q.choices[q.answer].text}`;
  },
};

export const oddsTemplates: Template<any>[] = [oddsMCS];
