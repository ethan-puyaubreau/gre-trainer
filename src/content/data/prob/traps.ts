import type { Trap } from '../../../engine/types';

export const probTraps: Record<string, Trap> = {
  // ---------------------------------------------------------------- counting
  'prob-order-matters': {
    label: 'Counted ordered selections when order does not matter',
    fix: 'A committee, a group or a hand of cards has no order: divide the ordered count by $k!$, that is, use $\\binom{n}{k}$.',
  },
  'prob-order-ignored': {
    label: 'Ignored order when the positions are different',
    fix: 'Different roles (president, vice president) or positions make different outcomes: use $n(n-1)\\cdots$, not $\\binom{n}{k}$.',
  },
  'prob-choose-symmetry': {
    label: 'Assumed bigger groups always give more choices',
    fix: '$\\binom{n}{k} = \\binom{n}{n-k}$: choosing who is in is the same as choosing who is left out. The counts grow up to $k = \\frac{n}{2}$ and then shrink.',
  },
  'prob-handshake-double': {
    label: 'Counted every pair twice',
    fix: 'With $n$ people, $n(n-1)$ counts each handshake once from each side. Divide by 2: $\\frac{n(n-1)}{2}$.',
  },
  'prob-unknown-means-d': {
    label: 'Answered D just because $n$ is unknown',
    fix: 'Compare the two formulas for every allowed $n$ (or test a few values). If the relationship is the same for all of them, the answer is determined.',
  },
  'prob-ignored-restriction': {
    label: 'Ignored a condition of the question',
    fix: 'Reread the condition (a fixed seat, "at least one", a digit that cannot repeat...) and build it into the count before multiplying.',
  },
  'prob-missed-case': {
    label: 'Counted only one of the cases',
    fix: 'List every case (either end, either group, every allowed position) and add the counts of all of them.',
  },
  'prob-forgot-internal-order': {
    label: 'Forgot the order inside a block',
    fix: 'After gluing items into a block or reserving seats for them, multiply by the number of ways to order them there: 2 for a pair, $3! = 6$ for three.',
  },
  'prob-answered-complement': {
    label: 'Counted the opposite case',
    fix: 'If you counted the arrangements where the condition fails, subtract them from the total to get the ones asked for.',
  },
  'prob-repeated-letters': {
    label: 'Counted identical letters as different',
    fix: 'Divide $n!$ by the factorial of each repeat count: BANANA gives $\\frac{6!}{3!\\,2!} = 60$.',
  },
  'prob-repetition': {
    label: 'Used the wrong repetition rule',
    fix: 'With repetition allowed every position keeps all its choices; without repetition each position has one choice fewer than the previous one.',
  },
  'prob-add-not-multiply': {
    label: 'Added the choices instead of multiplying',
    fix: 'Successive choices multiply: every choice for the first position can be combined with every choice for the next one.',
  },
  'prob-leading-zero': {
    label: 'Allowed 0 as the first digit',
    fix: 'A number cannot start with 0: the first digit of a 2- or 3-digit integer has only 9 possible values (or fewer).',
  },
  'prob-restricted-first': {
    label: 'Filled an unrestricted position before a restricted one',
    fix: 'Fill the most restricted positions first (the units digit of an odd number, the first digit), then the free ones.',
  },
  'prob-case-split': {
    label: 'Used one product where cases were needed',
    fix: 'When one choice changes the number of options of another (a units digit of 0 frees the first digit), split into cases and add.',
  },
  'prob-overlap-subtract': {
    label: 'Subtracted overlapping cases more than once',
    fix: 'Count directly position by position (or subtract each case exactly once). Here: first digit 8 choices, the others 9 each.',
  },
  'prob-at-least-one-overcount': {
    label: 'Picked "one of them" first, then filled the rest',
    fix: 'That counts a committee with two of them twice. For "at least one", take all committees minus those with none.',
  },
  'prob-exactly-vs-at-least': {
    label: 'Mixed up "exactly one" and "at least one"',
    fix: '"At least one" also includes the cases where two or more happen. Exactly one of two events: $p(1 - q) + (1 - p)q$; at least one: $1 - (1 - p)(1 - q)$.',
  },
  'prob-excluded-both': {
    label: 'Left both people out entirely',
    fix: 'Only the committees containing BOTH are forbidden. Subtract those from the total; committees with just one of the two are allowed.',
  },
  'prob-assumed-distinct': {
    label: 'Assumed every pair gives a different value',
    fix: 'Different pairs can give the same product or sum ($2 \\times 6 = 3 \\times 4$). List the values and look for repeats.',
  },
  // ---------------------------------------------------------------- probability
  'prob-wrong-event': {
    label: 'Found the probability of a different event',
    fix: 'Reread exactly what is asked. "Neither A nor B" is $1 - P(A \\text{ or } B)$; "at least one" is $1 - P(\\text{none})$; the complement of the answer is a common wrong choice.',
  },
  'prob-count-as-percent': {
    label: 'Read a count as a percent',
    fix: 'A probability is favorable ÷ total. 9 items out of 60 is $\\frac{9}{60} = 0.15$, not 0.09.',
  },
  'prob-stale-total': {
    label: 'Used the total before items were removed',
    fix: 'After removing items, both the favorable count and the total change. Divide by the number of items left.',
  },
  'prob-add-probabilities': {
    label: 'Added probabilities of events that can happen together',
    fix: 'Adding counts the "both" case twice. For independent events: at least one = $1 - (1 - p)(1 - q)$; in general $P(A \\text{ or } B) = P(A) + P(B) - P(A \\text{ and } B)$.',
  },
  'prob-and-vs-or': {
    label: 'Computed "both" instead of "at least one"',
    fix: 'Both = $pq$ (independent events). At least one = $1 - (1 - p)(1 - q)$, which also includes the cases where only one happens.',
  },
  'prob-with-replacement': {
    label: 'Treated the draws as if the first item were put back',
    fix: 'Without replacement, the second draw has one item fewer in total and one fewer of the kind already drawn: $\\frac{r}{n} \\times \\frac{r - 1}{n - 1}$.',
  },
  'prob-one-draw': {
    label: 'Gave the probability of a single draw',
    fix: 'Several items are drawn: multiply the probabilities of the successive draws, or divide favorable selections by all selections.',
  },
  'prob-one-order': {
    label: 'Counted only one order',
    fix: '"One of each" can happen as red then blue or blue then red: add both orders (multiply by 2).',
  },
  'prob-missed-factor': {
    label: 'Left out part of the favorable selection',
    fix: 'A favorable selection must be completed: choose the items with the property AND the remaining items without it, and multiply the counts.',
  },
  'prob-wrong-denominator': {
    label: 'Divided by the wrong total',
    fix: 'Divide by the number of possible outcomes for the question asked: everyone for "and", only the given group for "given that".',
  },
  'prob-reversed-condition': {
    label: 'Reversed the condition',
    fix: '$P(A \\text{ given } B)$ divides by the $B$ total; $P(B \\text{ given } A)$ divides by the $A$ total. Find the "given that" group first.',
  },
  'prob-assume-independent': {
    label: 'Assumed the events are independent',
    fix: 'Only multiply $P(E)P(F)$ when independence is stated. Otherwise $P(E \\text{ and } F)$ can be anything from $\\max(0, P(E) + P(F) - 1)$ to the smaller of the two.',
  },
  'prob-assume-exclusive': {
    label: 'Assumed the events cannot occur together',
    fix: '$P(E \\text{ or } F) = P(E) + P(F)$ only for mutually exclusive events. Otherwise subtract $P(E \\text{ and } F)$.',
  },
  'prob-sums-equally-likely': {
    label: 'Treated all dice sums as equally likely',
    fix: 'There are 36 equally likely outcomes; a sum of $s$ happens in $6 - |s - 7|$ of them, so 7 is the most likely sum.',
  },
  'prob-union-below-max': {
    label: 'Let $P(A \\text{ or } B)$ be smaller than $P(A)$ or $P(B)$',
    fix: 'Whenever $A$ occurs, "$A$ or $B$" occurs, so $P(A \\text{ or } B)$ is at least the larger of $P(A)$ and $P(B)$.',
  },
  'prob-and-above-min': {
    label: 'Let $P(A \\text{ and } B)$ exceed the smaller probability',
    fix: '"$A$ and $B$" can only happen when $A$ happens, so $P(A \\text{ and } B) \\le P(A)$, and likewise $\\le P(B)$.',
  },
  'prob-and-floor': {
    label: 'Forgot the lower limit $P(A) + P(B) - 1$',
    fix: 'Since $P(A \\text{ or } B) \\le 1$, $P(A \\text{ and } B) = P(A) + P(B) - P(A \\text{ or } B) \\ge P(A) + P(B) - 1$.',
  },
};
