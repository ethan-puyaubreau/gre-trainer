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
  'prob-wrong-positions': {
    label: 'Used the wrong number of positions',
    fix: 'Count the digits (or places) of the number asked for, and use exactly that many factors.',
  },
  'prob-double-count': {
    label: 'Counted every outcome twice',
    fix: 'Check whether two ways of building an outcome really give different outcomes; if not, the count is not doubled.',
  },
  'prob-half-count': {
    label: 'Counted only half of the outcomes',
    fix: 'Do not halve a count unless two outcomes are really the same; a restriction usually removes some cases, not exactly half.',
  },
  'prob-over-exclude': {
    label: 'Removed a digit from every position',
    fix: 'A restriction such as "no leading 0" applies to one position only. Remove 0 from the first digit, and keep it for the others.',
  },
  'prob-half-parity': {
    label: 'Assumed half of the numbers are odd (or even)',
    fix: 'Odd and even numbers are equally many only when no restriction treats the digits differently. Here the leading digit cannot be 0, so count them directly.',
  },
  'prob-wrong-set': {
    label: 'Counted a different set than the one asked',
    fix: 'Reread the condition (odd or even, with or without a digit) and count exactly that set.',
  },
  'prob-palindrome-free': {
    label: 'Counted the wrong number of free digits in a palindrome',
    fix: 'In a palindrome of $k$ digits, only the first $\\lceil k/2 \\rceil$ digits can be chosen; the others copy them.',
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
  'prob-off-by-one': {
    label: 'Miscounted the favorable items by one',
    fix: 'Add the counts of exactly the colors asked for, and check the total with a quick sum before dividing.',
  },
  'prob-equally-likely': {
    label: 'Treated the possibilities as equally likely',
    fix: 'Two possible results are equally likely only when the counts say so. Use favorable $\\div$ total.',
  },
  'prob-excluded-one-color': {
    label: 'Left out only one of the two colors',
    fix: '"Neither A nor B" removes the items of both colors: subtract both counts from the total before dividing.',
  },
  'prob-wrong-size': {
    label: 'Used a committee of the wrong size',
    fix: 'Use the number of members the committee has, in every factor: the sizes of the parts must add up to it.',
  },
  'prob-swapped-groups': {
    label: 'Swapped the numbers taken from the two groups',
    fix: 'Match each group with its own count: choose $i$ from the first group and $j$ from the second, not the other way round.',
  },
  'prob-excluded-one': {
    label: 'Left one of the two people out entirely',
    fix: 'Only committees with both are forbidden. Either person may serve alone, so neither is excluded altogether.',
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
  // ---------------------------------------------------------------- sets
  'prob-venn-no-overlap': {
    label: 'Forgot to subtract the overlap',
    fix: 'Members of both groups are counted once in each group: at least one = A + B $-$ both.',
  },
  'prob-venn-forgot-neither': {
    label: 'Forgot the members in neither group',
    fix: 'Total = A + B $-$ both + neither. Leave the neither group out only when the question says everyone is in at least one group.',
  },
  'prob-venn-only': {
    label: 'Mixed up "only A" and "A"',
    fix: 'A circle includes its overlap. Only A = A $-$ both; exactly one = A + B $-$ 2(both).',
  },
  'prob-venn-min-zero': {
    label: 'Assumed the overlap could be 0',
    fix: 'If A + B is more than the total, at least A + B $-$ total members must be in both groups.',
  },
  'prob-venn-max': {
    label: 'Went past the greatest possible value',
    fix: 'The overlap cannot exceed the smaller group, and the neither group cannot exceed the total minus the larger group.',
  },
  'prob-venn-missed-region': {
    label: 'Left out a region that belongs to what is asked',
    fix: 'List the regions of the diagram that satisfy the question, then add all of them and only them.',
  },
  'prob-venn-extra-region': {
    label: 'Added a region that does not belong to what is asked',
    fix: 'List the regions of the diagram that satisfy the question, then add all of them and only them.',
  },
  'prob-venn-wrong-region': {
    label: 'Counted the wrong region in place of the right one',
    fix: 'Match each phrase of the question ("only", "both", "neither", "at least") to its regions before adding.',
  },
  'prob-venn-triple': {
    label: 'Mishandled the members in all three groups',
    fix: 'With "exactly two" data: at least one = A + B + C $-$ (exactly two) $-$ 2(all three). With pairwise overlaps: A + B + C $-$ (pairs) + (all three).',
  },
  'prob-venn-exactly-two': {
    label: 'Used "exactly two" as if it were the pairwise overlaps',
    fix: 'Pairwise overlaps include the members in all three groups; "exactly two" does not. Subtract (exactly two) and then 2 × (all three).',
  },
  'prob-venn-difference-fixed': {
    label: 'Answered D although the difference is fixed',
    fix: 'Neither $-$ both = total $-$ A $-$ B for every possible overlap, so the comparison is determined.',
  },
  'prob-overlap-off-by-one': {
    label: 'Counted the shared integers off by one',
    fix: 'The median of an odd list of consecutive integers is a member: it and the $\\frac{m-1}{2}$ integers on one side make $\\frac{m+1}{2}$ shared integers.',
  },
  'prob-percent-not-count': {
    label: 'Gave the percent instead of the number',
    fix: 'Convert at the end: $p$ percent of $N$ is $\\frac{p}{100} \\times N$.',
  },
  'prob-percent-of-whole': {
    label: 'Used the whole population as the base',
    fix: '"What percent of the car owners" divides by the car owners, not by everyone: $\\frac{\\text{part}}{\\text{that group}} \\times 100$.',
  },
  // ---------------------------------------------------------------- data interpretation
  'prob-add-percents': {
    label: 'Added successive percent changes',
    fix: 'Successive changes multiply: +10% then +20% is $1.1 \\times 1.2 = 1.32$, a 32% increase, not 30%. Two decreases add up to less than their sum.',
  },
  'prob-percent-cancel': {
    label: 'Assumed +k% and $-$k% cancel out',
    fix: 'The second percent applies to a different base: $1.1 \\times 0.9 = 0.99$, a net 1% loss.',
  },
  'prob-percent-reverse': {
    label: 'Undid a percent change by flipping its sign',
    fix: 'To go back from the new amount, divide by the growth factor: after a 20% increase, divide by 1.2 (do not multiply by 0.8).',
  },
  'prob-percent-wrong-base': {
    label: 'Used the wrong base for the percent',
    fix: 'Percent change and "X as a percent of Y" divide by the base (the earlier value, or Y). Identify the base before dividing.',
  },
  'prob-di-one-step': {
    label: 'Applied only one of the changes',
    fix: 'From the first year to the third year, apply both yearly changes in order.',
  },
  'prob-di-wrong-column': {
    label: 'Read the wrong row or column',
    fix: 'Match the row and column headings (and the legend) to the exact years and categories in the question before reading a value.',
  },
  'prob-di-not-applied': {
    label: 'Did not apply the change',
    fix: 'Apply the percent change to the amount: multiply by the growth factor, 1 plus a rise or 1 minus a fall.',
  },
  'prob-di-change-only': {
    label: 'Gave the size of the change instead of the new amount',
    fix: 'A percent change of the amount is only the difference; the new amount is the old one plus (or minus) it.',
  },
  'prob-di-compound-overshoot': {
    label: 'Thought compounding adds more than it does',
    fix: 'Multiply the growth factors: 1.1 times 1.2 is 1.32, only 2 points above the sum of the percents (30%).',
  },
  'prob-di-both-changes': {
    label: 'Required the changes to agree, or accepted any single change',
    fix: 'Combine the two changes: multiply the growth factors and compare the product with 1.',
  },
  'prob-di-miscount': {
    label: 'Miscounted the rows that satisfy the condition',
    fix: 'Test every row separately against the condition, then count the rows that pass.',
  },
  'prob-di-no-divide': {
    label: 'Gave the total change instead of the average per year',
    fix: 'An average per year divides the total change by the number of years it took.',
  },
  'prob-di-one-interval': {
    label: 'Used one interval instead of the whole span',
    fix: 'An average over a span uses the first and last values of the span, not one interval inside it.',
  },
  'prob-di-no-subtract': {
    label: 'Divided the final value without subtracting the starting value',
    fix: 'An increase is the final value minus the starting value; divide that difference by the years.',
  },
  'prob-di-wrong-fraction': {
    label: 'Used the wrong fraction in the comparison',
    fix: 'Compare with exactly the fraction stated in the question, for example one fifth of the other column.',
  },
  'prob-di-weights-swapped': {
    label: 'Gave each year the count of the other year as its weight',
    fix: 'Each mean is weighted by its own count: multiply the mean of a year by the number of items of that same year.',
  },
  'prob-di-forgot-rate': {
    label: 'Gave the total instead of the percent of it',
    fix: 'After finding the total, take the stated percent of it: multiply by the rate divided by 100.',
  },
  'prob-di-forgot-count': {
    label: 'Forgot to multiply by the number of items',
    fix: 'The tax on every item sold is the rate times the total of the prices: mean times the number of items.',
  },
  'prob-di-decimal-point': {
    label: 'Misplaced the decimal point',
    fix: 'Estimate the size of the answer first (a rough ratio or product), then place the decimal point to match it.',
  },
  'prob-di-inverted': {
    label: 'Divided the wrong way round',
    fix: '"How many times A is B" is A divided by B: the larger over the smaller when A is the larger.',
  },
  'prob-di-forgot-subtract': {
    label: 'Compared with the total instead of the unlisted amount',
    fix: 'The categories not listed are the total minus the listed ones: find that amount first, then compare each category with it.',
  },
  'prob-di-misread-graph': {
    label: 'Misread a bar by one gridline',
    fix: 'Read each bar against the axis and take the value at the top of the bar before computing.',
  },
  'prob-di-fraction-of-total': {
    label: 'Compared the countries with the wrong share of the total',
    fix: 'Take the stated fraction of the region total given in the title of the bar graph, then compare it with the sum of the bars.',
  },
  'prob-di-one-fraction': {
    label: 'Used one of the fractions instead of combining them',
    fix: 'Take each fraction of its own cell, add the amounts, and divide by the combined total of the same cells.',
  },
  'prob-di-sd-two-values': {
    label: 'Compared only two of the four numbers',
    fix: 'Standard deviation depends on all four numbers: check how far each one is from the row mean.',
  },
  'prob-di-rounding': {
    label: 'Rounded the estimate to the wrong neighbouring value',
    fix: 'Compute the share as a decimal first, then pick the choice it is closest to.',
  },
  'prob-di-sign': {
    label: 'Applied the change in the wrong direction',
    fix: 'A $+$ entry is an increase (multiply by $1 + p$), a $-$ entry a decrease (multiply by $1 - p$).',
  },
  'prob-di-rates-not-sizes': {
    label: 'Inferred amounts from percent changes',
    fix: 'Percent changes say nothing about sizes: a small store can grow faster than a big one. A statement about amounts needs the amounts.',
  },
  'prob-di-average-of-averages': {
    label: 'Averaged two averages of different-sized groups',
    fix: 'Combine totals, not means: (mean₁ × count₁ + mean₂ × count₂) ÷ (count₁ + count₂). The bigger group pulls the result toward its mean.',
  },
  'prob-di-mean-not-total': {
    label: 'Compared totals by comparing means',
    fix: 'A total is mean × count. A higher mean can still give a smaller total when fewer items were sold.',
  },
  'prob-di-median-total': {
    label: 'Drew a conclusion the median cannot support',
    fix: 'The median gives the middle value only. Totals need mean × count, and the median says nothing about the largest or smallest values.',
  },
  'prob-di-thousands': {
    label: 'Ignored the units of the display',
    fix: 'Check the title and axis labels: "(in thousands)" or "thousands of dollars" means multiply every value read by 1,000.',
  },
  'prob-percent-decimal': {
    label: 'Converted the percent to a decimal incorrectly',
    fix: '$p$ percent is $\\frac{p}{100}$: 2% = 0.02, not 0.2.',
  },
  'prob-di-wrong-total': {
    label: 'Applied a percent to the wrong total',
    fix: 'Each percent in a circle graph is a percent of that graph\'s total. Find the right total first (it may have to be derived from a part and its percent).',
  },
  'prob-di-range': {
    label: 'Took the largest value as the range',
    fix: 'Range = greatest value $-$ least value.',
  },
  'prob-di-largest-not-majority': {
    label: 'Took the largest category for a majority',
    fix: 'A category beats all the others combined only if it is more than 50% of the total.',
  },
  'prob-di-lumped-category': {
    label: 'Drew conclusions about members of a lumped category',
    fix: 'A bar or sector like "Other" gives only a total; it says nothing about how that total is split among its members.',
  },
  'prob-di-per-unit': {
    label: 'Compared single units instead of the quantities asked',
    fix: 'Multiply each value read from the graph by the quantity in the choice before comparing.',
  },
  'prob-di-unit-conversion': {
    label: 'Skipped or reversed the unit conversion',
    fix: 'Convert the quantity into the unit of the graph first: 10 kilograms ≈ $10 \\times 2.2 = 22$ pounds.',
  },
  'prob-di-difference-of-quotients': {
    label: 'Divided by the difference instead of subtracting quotients',
    fix: 'Find how many units each year\'s time buys ($\\frac{\\text{total minutes}}{\\text{minutes per unit}}$), then subtract. $\\frac{T}{b} - \\frac{T}{a} \\ne \\frac{T}{a - b}$.',
  },
  'prob-di-sd-size': {
    label: 'Judged spread by the size of the numbers',
    fix: 'Standard deviation measures how far the values are from their own mean. Small values can be very spread out; large, nearly equal values have a small standard deviation.',
  },
  'prob-di-wrong-divisor': {
    label: 'Divided by the wrong number of values',
    fix: 'An average per season divides by the number of seasons (zeros included), not by the number of nonzero entries.',
  },
  'prob-percent-ratio-as-change': {
    label: 'Gave new ÷ old as the percent increase',
    fix: 'Percent increase = $\\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100$; $\\frac{\\text{new}}{\\text{old}} \\times 100$ is the new value as a percent of the old one.',
  },
};
