import type { Skill } from '../../../engine/types';

const area = 'data' as const;

export const probSkills: Skill[] = [
  // ---------------------------------------------------------------- Counting & probability
  {
    id: 'data.counting',
    area,
    unit: 'Counting & probability',
    name: 'Counting',
    summary: 'Multiplication principle, permutations, combinations, arrangements with restrictions, committees, handshakes.',
    strategy: `First decide whether order matters. Distinct roles or positions (president, first chair, gold medal) mean it does; a committee or a group means it does not.

- Multiplication principle: successive choices multiply. 4 shirts and 3 pairs of pants give $4 \\times 3 = 12$ outfits.
- Ordered: $n(n-1)\\cdots(n-k+1)$. Unordered: divide by $k!$, so $\\binom{n}{k} = \\frac{n!}{k!(n-k)!}$, and $\\binom{n}{k} = \\binom{n}{n-k}$.
- Fill the restricted slot first: the leading digit cannot be 0, the reserved seat, the last digit of an even number.
- "Must be together": glue them into one block, then multiply by the orders inside the block. "Not together" = total $-$ together.
- "At least one": total $-$ none. Handshakes or games among $n$: $\\frac{n(n-1)}{2}$.`,
  },
  {
    id: 'data.probability',
    area,
    unit: 'Counting & probability',
    name: 'Probability',
    summary: 'Single events, complements, independent events, draws without replacement, conditional probability from a table.',
    strategy: `With equally likely outcomes, probability = favorable outcomes ÷ total outcomes.

- "Neither A nor B" and "at least one" are easiest through the complement: $P(\\text{not } E) = 1 - P(E)$.
- Independent events multiply. At least one of them: $1 - (1 - p)(1 - q)$. Never add the probabilities.
- Without replacement, the second draw has one item fewer in total and one fewer of the kind already drawn. "One of each" happens in two orders.
- "Given that X": restrict to the X row or column of the table and divide by that total, not by the grand total.
- $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$. Unless the events are independent or mutually exclusive, $P(A \\text{ and } B)$ is only known to lie in a range.`,
  },
  {
    id: 'data.sets',
    area,
    unit: 'Counting & probability',
    name: 'Sets & Venn diagrams',
    summary: 'Two- and three-set overlaps: both, neither, exactly one, least and greatest possible overlap.',
    strategy: `Two sets: Total = A + B $-$ Both + Neither. Write it down and solve for the missing piece.

- Only A = A $-$ Both. Exactly one = A + B $-$ 2(Both).
- Least possible overlap: A + B $-$ Total (or 0 if that is negative). Greatest: the smaller of A and B.
- Neither $-$ Both = Total $-$ A $-$ B, whatever the overlap is.
- Venn diagrams: fill the regions from the center outward, so no one is counted twice.
- Three sets with "exactly two" and "all three" given: at least one = A + B + C $-$ (exactly two) $-$ 2(all three).`,
  },
  // ---------------------------------------------------------------- Graphs & tables
  {
    id: 'data.interpretation',
    area,
    unit: 'Graphs & tables',
    name: 'Data interpretation',
    summary: 'Tables, bar graphs and circle graphs: read values, percent change, parts of a total, what must be true.',
    strategy: `Read the title, the units and the scale before the question. "(in thousands)" multiplies every entry by 1,000.

- Percent change = (new $-$ old) ÷ old. The base is the earlier value.
- Successive percent changes multiply: +10% then $-10\\%$ gives $1.1 \\times 0.9 = 0.99$, a 1% loss. Never add them.
- Percents of different totals cannot be compared directly. Convert each to an amount (percent × total).
- Circle graph: amount = percent × total; central angle = percent × 360°.
- Graphs are drawn to scale. When the question says "approximately", estimate and pick the closest choice.
- "Must be true": percent changes alone never tell you which entity is bigger.`,
  },
];
