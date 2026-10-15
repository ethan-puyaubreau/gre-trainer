import type { Trap } from '../../../engine/types';

// Mistakes specific to fractions, decimals, the number line, percents, ratios and rates.
// Ids start with "num-" (the integers area uses "int-").
export const numbersTraps: Record<string, Trap> = {
  /* ---------------------------------------------------------------- fractions */
  'num-same-operation-both': {
    label: 'Any operation done to both parts keeps a fraction equal',
    fix: 'Only multiplying or dividing the numerator and the denominator by the same nonzero number keeps the value (it multiplies the fraction by 1). Adding, subtracting, squaring or taking reciprocals changes it: $\\frac{1 + 1}{2 + 1} = \\frac{2}{3} \\ne \\frac{1}{2}$.',
  },
  'num-add-same-to-fraction': {
    label: 'Adding the same number to the top and bottom keeps the fraction',
    fix: 'Adding the same positive number to both parts moves a fraction toward 1: $\\frac{2}{5} < \\frac{2 + 1}{5 + 1}$, while $\\frac{5}{2} > \\frac{5 + 1}{2 + 1}$. Cross-multiply to compare.',
  },
  'num-hidden-factor': {
    label: 'Missed a common factor',
    fix: 'Factor before comparing: $\\frac{3 + 3x}{5 + 5x} = \\frac{3(1 + x)}{5(1 + x)} = \\frac{3}{5}$ for every allowed $x$.',
  },
  'num-boundary-value': {
    label: 'Ignored an allowed boundary value',
    fix: 'When the condition includes an endpoint ($x \\ge 0$, $|z| \\le 1$), test that endpoint too. If one allowed value gives equality and another gives a strict inequality, the answer is D.',
  },
  'num-compare-parts': {
    label: 'Compared numerators (or denominators) instead of values',
    fix: 'A bigger numerator does not make a bigger fraction when the denominators differ. Cross-multiply ($\\frac{a}{b} > \\frac{c}{d} \\iff ad > bc$) or convert to decimals.',
  },
  'num-fraction-of-whole': {
    label: 'Took a fraction of the whole instead of the remainder',
    fix: '"$\\frac{1}{4}$ of the remaining amount" is a fraction of what is left, not of the original. Multiply what remains at each step: $\\left(1 - \\frac{1}{3}\\right)\\left(1 - \\frac{1}{4}\\right)$.',
  },
  /* ---------------------------------------------------------------- decimals */
  'num-terminating-test': {
    label: 'Wrong test for a terminating decimal',
    fix: 'Reduce the fraction first, then look at the denominator: the decimal terminates exactly when the only prime factors left are 2 and 5. $\\frac{7}{60}$ repeats (60 has a factor 3) but $\\frac{21}{60} = \\frac{7}{20}$ terminates.',
  },
  'num-rounding-exact': {
    label: 'Treated a rounded value as the exact value',
    fix: 'If $x$ rounds to 3.47, then $x$ can be anything from 3.465 up to (but not including) 3.475. Compare the whole interval with the other quantity.',
  },
  'num-double-rounding': {
    label: 'Rounded in two steps',
    fix: 'Round once, looking only at the digit right after the place you round to: 2.446 to the nearest tenth is 2.4. Rounding first to 2.45 and then to 2.5 is wrong.',
  },
  'num-decimal-shift': {
    label: 'Misplaced the decimal point (off by a power of 10)',
    fix: 'Count powers of 10 carefully: write each number as digits times a power of 10, multiply the digits, then add (or subtract) the exponents.',
  },
  'num-divided-wrong': {
    label: 'Multiplied by the divisor instead of dividing',
    fix: 'Dividing by $c \\times 10^{p}$ divides the decimal parts and subtracts $p$ from the exponent: $\\frac{6 \\times 10^{4}}{2 \\times 10^{2}} = 3 \\times 10^{2}$, not $12 \\times 10^{6}$.',
  },
  'num-exponent-sign': {
    label: 'Added an exponent that should be subtracted',
    fix: 'Dividing by $10^{p}$ subtracts $p$ from the exponent: $\\frac{10^{7}}{10^{-3}} = 10^{7 - (-3)} = 10^{10}$.',
  },
  'num-repeating-truncate': {
    label: 'Treated a repeating decimal as if it stopped',
    fix: '$0.\\overline{4} = 0.444\\ldots = \\frac{4}{9}$, which is more than 0.4. Write repeating decimals as fractions ($0.\\overline{d} = \\frac{d}{9}$, $0.\\overline{ab} = \\frac{ab}{99}$) before adding or comparing.',
  },
  'num-wrong-pairs': {
    label: 'Matched quantities with the wrong prices',
    fix: 'Multiply each quantity by its own unit price before adding.',
  },
  'num-round-up-count': {
    label: 'Rounded a "how many can you buy" answer up',
    fix: 'You cannot buy part of an item, and you cannot spend more than you have: take the whole-number part of the quotient (round down).',
  },
  /* ---------------------------------------------------------------- number line */
  'num-equal-segments': {
    label: 'Assumed the segments are equal',
    fix: 'Use the stated relation. If $AB = CD$ and $BC = 3AB$, the whole length is $u + 3u + u = 5u$, not three equal parts.',
  },
  'num-segment-count': {
    label: 'Counted the wrong number of equal units',
    fix: 'Write every segment in one unit $u$ and add ALL of them: $AB + BC + CD$.',
  },
  'num-wrong-segment': {
    label: 'Used the wrong segment as the step',
    fix: 'Each point is reached by adding the length of the segment BEFORE it: B = A + AB, with AB the first part of the ratio, not the middle one.',
  },
  'num-abs-vs-one': {
    label: 'Compared |x| with 1 without locating x between the ticks',
    fix: '|x| < 1 exactly when x lies between the ticks -1 and 1, whatever its sign. A negative number between -1 and 0 has |x| < 1.',
  },
  'num-wrong-point': {
    label: 'Found the coordinate of the wrong point',
    fix: 'Re-read which point is asked for and check that your answer lies between its neighbors.',
  },
  'num-distance-abs': {
    label: 'Compared sizes instead of distances',
    fix: 'The distance between $x$ and $c$ is $|x - c|$. A large positive number can be close to a positive $c$, and a negative number can be far from it.',
  },
  'num-ticks-vs-intervals': {
    label: 'Counted tick marks instead of intervals',
    fix: 'Between two labeled tick marks, count the spaces, not the marks: from tick 0 to tick 4 there are 4 equal intervals.',
  },
  'num-sign-rules': {
    label: 'Misapplied the sign rules',
    fix: 'A product (or quotient) is positive when it has an even number of negative factors. $x - y$ is positive exactly when $x$ is to the right of $y$ on the number line.',
  },
  'num-abs-one-solution': {
    label: 'Used only one solution of an absolute value',
    fix: '$|x - a| = d$ means $x = a + d$ OR $x = a - d$: a point at distance $d$ can be on either side of $a$.',
  },
  'num-product-range': {
    label: 'Checked the sign of the product but not its size',
    fix: 'After the sign is right, compute the size: $-20 \\times \\frac{1}{16} = -1.25$ is negative but not between $-1$ and 0.',
  },
  /* ---------------------------------------------------------------- percents */
  'num-percent-unknown-base': {
    label: 'Compared percents as if they were amounts',
    fix: 'A percent change is a fraction of a base. Without the bases, a larger percent does not mean a larger dollar change: 10% of 500 is more than 30% of 100.',
  },
  'num-percent-wrong-base': {
    label: 'Used the wrong base for the percent',
    fix: 'Percent change and profit percent are computed on the ORIGINAL amount (the cost, the old price): $\\frac{\\text{change}}{\\text{original}} \\times 100$.',
  },
  'num-percent-as-decimal': {
    label: 'Entered a decimal where a percent is asked',
    fix: 'When the answer box is followed by %, enter the percent: 0.33 of the cost is 33%.',
  },
  'num-change-only': {
    label: 'Gave only the change, not the new total',
    fix: 'The new amount includes the original: $s + 0.08s = 1.08s$, and $s - 0.15s = 0.85s$.',
  },
  'num-percent-as-number': {
    label: 'Added a percent as if it were a number of dollars',
    fix: 'A percent of $s$ depends on $s$: 8% of $s$ is $0.08s$, not 8 or 0.08.',
  },
  'num-reverse-percent': {
    label: 'Undid a percent change by reversing the percent',
    fix: 'If the sale price $s$ is 80% of the original $P$, then $P = \\frac{s}{0.8} = 1.25s$, not $1.2s$: the 20% was taken on $P$, not on $s$.',
  },
  'num-percent-swap': {
    label: 'Thought $x\\%$ of $y$ and $y\\%$ of $x$ differ',
    fix: '$x\\%$ of $y = \\frac{xy}{100} = y\\%$ of $x$. Swapping can make a percent easy: 8% of 25 is 25% of 8, which is 2.',
  },
  'num-percent-greater-less': {
    label: 'Used the same percent for "greater than" and "less than"',
    fix: 'The base changes. If $x$ is 25% greater than $y$, then $y$ is 20% less than $x$, because the difference is compared with $x$, the larger number.',
  },
  'num-percent-scaling': {
    label: 'Scaled the percent and the number the same way',
    fix: 'To keep $p\\%$ of $N$ unchanged, scale one up and the other DOWN by the same factor: 12% of 250 = 24% of 125 = 6% of 500.',
  },
  'num-percentage-points': {
    label: 'Gave the change in percentage points',
    fix: 'Going from 4% to 12% is a rise of 8 percentage points, but the percent increase is $\\frac{12 - 4}{4} = 200\\%$: divide the change by the original percent.',
  },
  'num-ratio-as-change': {
    label: 'Used new ÷ old as the percent change',
    fix: '12 is 300% OF 4, but it is 200% MORE than 4. Percent change = $\\frac{\\text{new} - \\text{old}}{\\text{old}} \\times 100$.',
  },
  'num-largest-group-only': {
    label: 'Used the percent of the largest group only',
    fix: 'Every group counts, in proportion to its size: 0.5(40%) + 0.25(70%) + 0.25(90%) = 60%, not the 40% of the biggest group.',
  },
  'num-weights-swapped': {
    label: 'Matched the shares to the wrong groups',
    fix: 'Pair each percent with the share of ITS OWN group before adding: the percent of the larger group gets the larger weight.',
  },
  'num-unweighted-mean': {
    label: 'Averaged the percents without weighting them',
    fix: 'When the groups have different sizes, multiply each percent by its share of the whole and add: $0.5(40\\%) + 0.25(70\\%) + 0.25(90\\%) = 60\\%$, not the plain average.',
  },
  /* ---------------------------------------------------------------- successive percents */
  'num-add-percents': {
    label: 'Added successive percents',
    fix: 'Successive changes multiply: −15% then +8% is $0.85 \\times 1.08 = 0.918$, an overall change of −8.2%, not −7%.',
  },
  'num-percent-cancel': {
    label: 'Thought +x% then −x% cancel out',
    fix: '$(1 + x)(1 - x) = 1 - x^2 < 1$: the decrease is taken on a larger amount, so you end BELOW the start (+20% then −20% gives 96%).',
  },
  'num-stopped-early': {
    label: 'Stopped before the last change',
    fix: 'Apply every change in the question, one after another: 1000 up 10%, down 20%, then up 5% needs all three multipliers.',
  },
  'num-change-direction': {
    label: 'Applied a change in the wrong direction',
    fix: 'A decrease uses a multiplier below 1 (−20% → 0.8) and an increase one above 1 (+20% → 1.2). Read each word: "rose", "fell", "added", "reduced".',
  },
  'num-order-of-changes': {
    label: 'Thought the order of the changes matters',
    fix: 'Successive percent changes multiply, and multiplication is commutative: −20% then +10% gives $0.8 \\times 1.1$, the same as $1.1 \\times 0.8$.',
  },
  'num-second-on-original': {
    label: 'Applied the second percent to the original amount',
    fix: 'Each change is taken on the amount right before it: the tax is computed on the discounted price, not the original price.',
  },
  'num-undo-same-percent': {
    label: 'Undid a change with the same percent',
    fix: 'To undo +25% you need −20% (since $1.25 \\times 0.8 = 1$), and to undo −20% you need +25%. The base of the second change is the new amount.',
  },
  /* ---------------------------------------------------------------- ratios */
  'num-ratio-whole': {
    label: 'Applied the ratio to the whole instead of the remainder',
    fix: 'Take out the known fraction first, then split only what remains by the ratio.',
  },
  'num-ratio-wrong-part': {
    label: 'Took the wrong share of the ratio',
    fix: 'If $M : P = 2 : 1$, then $M$ is $\\frac{2}{3}$ of the total and $P$ is $\\frac{1}{3}$: the share is (its part) / (sum of the parts).',
  },
  'num-ratio-chain': {
    label: 'Combined two ratios without a common middle term',
    fix: 'Rescale both ratios so the shared quantity has the same number: $a : b = 2 : 3$ and $b : c = 4 : 5$ become $8 : 12$ and $12 : 15$, so $a : b : c = 8 : 12 : 15$.',
  },
  'num-ratio-parts': {
    label: 'Gave the size of one part instead of the quantity',
    fix: 'After finding one part ($m$), multiply by the number of parts the quantity has.',
  },
  'num-ratio-part-whole': {
    label: 'Confused part-to-part with part-to-whole',
    fix: 'A red : blue ratio of $3 : 5$ means $\\frac{3}{8}$ of the marbles are red, not $\\frac{3}{5}$.',
  },
  'num-ratio-sign': {
    label: 'Assumed the numbers are positive',
    fix: 'A ratio fixes $\\frac{x}{y}$, not the signs. If $\\frac{x}{y} = \\frac{3}{4}$ and both are negative, $x = -3$ is greater than $y = -4$.',
  },
  'num-before-after': {
    label: 'Answered with the count before (or after) the change',
    fix: 'Re-read whether the question asks for the number before or after the items are added or removed.',
  },
  /* ---------------------------------------------------------------- rates */
  'num-time-conversion': {
    label: 'Used the wrong time conversion',
    fix: 'An hour has 60 minutes and $60 \\times 60 = 3{,}600$ seconds; a day has $24 \\times 60 = 1{,}440$ minutes. Write the units and cancel them.',
  },
  'num-inverted-rate': {
    label: 'Multiplied by the rate instead of dividing (or the reverse)',
    fix: 'Total = rate × quantity, so quantity = total ÷ rate. Check the units: (dollars) ÷ (dollars per mile) = miles.',
  },
  'num-inverted-conversion': {
    label: 'Turned a conversion factor upside down',
    fix: 'Write the factor as a fraction that cancels the old unit: $\\frac{60\\text{ min}}{1\\text{ h}}$ to go from per minute to per hour gives a BIGGER number per hour.',
  },
  'num-unit-forgotten': {
    label: 'Stopped before the units were right',
    fix: 'Follow the units to the end: miles ÷ (miles per gallon) = gallons, and gallons × (dollars per gallon) = dollars. A number of gallons is not a cost.',
  },
  'num-factor-forgotten': {
    label: 'Left one of the factors out',
    fix: 'List every factor the units call for (kilowatts, hours per day, days, dollars per kilowatt-hour) and use each once.',
  },
  'num-subtract-for-divide': {
    label: 'Subtracted the rate instead of dividing by it',
    fix: 'How many times the rate fits into the total is a division: $\\frac{\\$5.40}{\\$0.15} = 36$, not $5.40 - 0.15$.',
  },
  'num-fixed-fee-ignored': {
    label: 'Divided the whole total by the rate, fee included',
    fix: 'The fixed fee is not paid per unit. Take it out of the total first, then divide what is left by the rate.',
  },
  'num-one-way': {
    label: 'Counted only one way of a round trip',
    fix: 'A round trip covers the distance twice.',
  },
};
