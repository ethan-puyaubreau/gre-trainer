import type { Trap } from '../../../engine/types';

export const statsTraps: Record<string, Trap> = {
  /* ------------------------------------------------------------------ mean, median & mode */
  'stat-average-of-means': {
    label: 'Averaged two averages of groups of different sizes',
    fix: 'Convert each average to a total (average × count), add or subtract the totals, then divide by the new count.',
  },
  'stat-wrong-count': {
    label: 'Divided by (or multiplied by) the wrong number of values',
    fix: 'Recount after the change: removing one of $n$ values leaves $n - 1$; adding one makes $n + 1$. Use the count that goes with each average.',
  },
  'stat-change-not-divided': {
    label: 'Added the whole change to the average',
    fix: 'Changing one value by $c$ changes the total by $c$ and the average by $c \\div n$.',
  },
  'stat-change-direction': {
    label: 'Moved the average the wrong way',
    fix: 'If the correct value is larger than the recorded one, the correct total and average are larger; if smaller, they are smaller.',
  },
  'stat-median-unsorted': {
    label: 'Took the middle entry of an unsorted list as the median',
    fix: 'Put the values in increasing order first; the median is the middle value of the ordered list.',
  },
  'stat-one-value-tested': {
    label: 'Tested only one possible value',
    fix: 'When a value is unknown, try the extremes of what is allowed (smallest, largest, very large). If the comparison changes, the answer is D.',
  },
  'stat-median-is-x': {
    label: 'Assumed the unknown value is the median',
    fix: 'The median is whatever value lands in the middle once the list is ordered; that may be a known value, not $x$.',
  },
  'stat-mean-is-median': {
    label: 'Assumed the mean equals the median',
    fix: 'Mean and median are equal for symmetric data (like evenly spaced lists), not in general. Extreme values pull the mean but not the median.',
  },
  'stat-median-boundary': {
    label: 'Misplaced the edge of the allowed values by one',
    fix: 'Test the edge itself and the value just beyond it: the median is the target exactly as long as $x$ does not move past the neighbouring known number.',
  },
  'stat-median-known-number': {
    label: 'Picked a number already in the list',
    fix: 'Put $x$ in order with the others and read the new median or mean. A value that is already in the list is not a solution unless it passes that test.',
  },
  'stat-median-no-double': {
    label: 'Forgot that the median of an even list is an average',
    fix: 'With an even count the median is the average of the two middle numbers: $\\frac{\\text{middle} + x}{2} = m$ gives $x = 2m - \\text{middle}$, not $m - \\text{middle}$.',
  },
  'stat-median-wrong-middle': {
    label: 'Paired $x$ with the wrong known number',
    fix: 'One of the two middle numbers is a fixed known number; $x$ is paired with that one, not with its neighbour on the other side.',
  },
  'stat-median-position': {
    label: 'Thought the median could not be located without the values',
    fix: 'Only the order matters for the median: in increasing order the negative numbers come first, so count positions to see which numbers are in the middle.',
  },
  'stat-threshold': {
    label: 'Compared the median with the mean through a bound that is above the mean',
    fix: '"More than half are below $K$" says only that the median is below $K$. That decides the comparison with the mean only when $K$ is at most the mean.',
  },
  'stat-rest-average': {
    label: 'Assumed the remaining values average the overall average',
    fix: 'Compare the known values with the overall average: if they total less than their share, the others must total more, and vice versa.',
  },
  'stat-need-each-value': {
    label: 'Thought every individual value was needed',
    fix: 'Totals are enough: sum = average × count. An average compared with a known number often follows from the totals alone.',
  },
  'stat-same-mean-zero': {
    label: 'Concluded that a value which leaves the average unchanged must be 0',
    fix: 'Adding a value leaves the average unchanged exactly when the value equals the average. That average may be any number.',
  },
  'stat-case-not-checked': {
    label: 'Kept a solution that falls outside its own case',
    fix: 'When the median depends on where $x$ falls, solve each case separately and keep only the solutions that lie in that case’s range.',
  },
  'stat-extreme-order': {
    label: 'Ignored that values above the median are at least the median (and values below it at most the median)',
    fix: 'In the ordered list, values after the median are at least the median and values before it are at most the median. Push each value only as far as that allows.',
  },
  'stat-extreme-zero': {
    label: 'Used 0 for a positive integer',
    fix: 'The least positive integer is 1.',
  },
  'stat-extreme-distinct': {
    label: 'Misread whether the integers must be different',
    fix: 'If the integers must be different, use consecutive values (1, 2, ... or $m - 1$, $m - 2$, ...); if not, repeats are allowed.',
  },
  'stat-extreme-balance': {
    label: 'Put all of the leftover total into the largest value',
    fix: 'To make the largest value as small as possible, share the leftover total as evenly as possible among the values allowed to grow.',
  },
  'stat-extreme-direction': {
    label: 'Pushed some values the wrong way for the average asked',
    fix: 'For the greatest average, push every value as high as the conditions allow; for the least average, push every value as low as allowed.',
  },
  'stat-extreme-short': {
    label: 'Stopped short of the limit the conditions allow',
    fix: 'A value that is free to grow must be taken as high as its neighbours allow: here every integer above the median can equal the greatest one.',
  },
  'stat-extreme-top-ignored': {
    label: 'Ignored the stated greatest integer',
    fix: 'The greatest integer is given: it is in the list at exactly that value, so the integers between the median and it can be as small as the median, but the last one cannot.',
  },
  'stat-extreme-median-twice': {
    label: 'Counted the median twice',
    fix: 'The median is one of the integers: it appears once in the sum, so subtract it once.',
  },
  'stat-extreme-rounding': {
    label: 'Rounded the shared total the wrong way',
    fix: 'When the leftover total cannot be split evenly, the larger share goes to the larger value: round the greatest value up, not down.',
  },
  'stat-extreme-median-missing': {
    label: 'Left the median out of the list',
    fix: 'The median is one of the integers (the middle one): it counts in the total and in the number of integers.',
  },
  'stat-overlap-ignored': {
    label: 'Counted the shared integers twice',
    fix: 'Different integers in two lists = (size of first) + (size of second) − (number in both).',
  },
  'stat-overlap-nested': {
    label: 'Assumed the shorter list lies inside the longer one',
    fix: 'Lists of consecutive integers nest only when they are centered on the same integer. Place both on a number line from the anchor the problem gives.',
  },
  'stat-overlap-wrong-anchor': {
    label: 'Read the condition tying the two lists as a different condition',
    fix: 'Put the numbers of the two lists on a line using exactly the stated condition: the median of one list at the start, at the end, or at the middle of the other.',
  },
  'stat-overlap-half': {
    label: 'Took half of a list as the shared part',
    fix: 'Count the shared integers from the anchor: the median itself plus the integers on the side where the lists meet, up to the end of the shorter side.',
  },
  'stat-overlap-other-count': {
    label: 'Answered the other count: shared integers instead of different ones, or the reverse',
    fix: 'Shared (in both lists) is the overlap; different (in either list) is the total minus the overlap. Reread which one is asked.',
  },
  'stat-overlap-subtract-twice': {
    label: 'Subtracted the shared integers twice',
    fix: 'Add the two lengths, then subtract the overlap once: the shared integers were counted twice, so one copy of them must go, not both.',
  },
  'stat-overlap-single': {
    label: 'Assumed the lists share only the integer they are tied at',
    fix: 'The anchor gives one shared integer, but the lists keep running the same way on that side: count the integers of the shorter side up to its end.',
  },
  'stat-overlap-off-by-one': {
    label: 'Miscounted the integers from one point to another',
    fix: 'From $a$ to $b$ inclusive there are $b - a + 1$ integers. Check the count with a small example.',
  },
  /* ------------------------------------------------------------------ weighted averages */
  'stat-weighted-midpoint': {
    label: 'Took the overall average halfway between the group averages',
    fix: 'The midpoint is the overall average only when the groups are the same size; otherwise the overall average is closer to the larger group\u2019s average.',
  },
  'stat-weighted-bound': {
    label: 'Mishandled the boundary value of the overall average',
    fix: 'Compute the overall average for the boundary case ("exactly $k$ times as many"). "More than" excludes that value; "at least" allows it.',
  },
  'stat-weighted-wrong-side': {
    label: 'Pulled the overall average toward the smaller group',
    fix: 'The larger group has more weight, so the overall average lies on the larger group\u2019s side of the midpoint.',
  },
  'stat-weighted-inverted': {
    label: 'Inverted the ratio of the group sizes',
    fix: 'The group whose average is closer to the overall average is the larger group: $\\dfrac{n_1}{n_2} = \\dfrac{a_2 - c}{c - a_1}$.',
  },
  'stat-ratio-as-fraction': {
    label: 'Used the ratio of the two groups as the fraction of the whole',
    fix: 'If the groups are in the ratio $p : q$, the first group is $\\frac{p}{p + q}$ of the total, not $\\frac{p}{q}$.',
  },
  'stat-answered-part': {
    label: 'Gave one group instead of the whole',
    fix: 'Reread what is asked: when the question asks for everyone, add the known group and the one you found.',
  },
  'stat-weighted-no-divide': {
    label: 'Multiplied by one distance but never divided by the other',
    fix: 'The sizes are in the ratio of the distances from the overall average: scale the known size by one distance and divide by the other.',
  },
  'stat-weighted-whole-gap': {
    label: 'Divided by the whole gap between the two averages',
    fix: 'The overall average splits the gap into two pieces, and the group sizes are in the ratio of those two pieces, not of one piece to the whole gap.',
  },
  'stat-ratio-one-part': {
    label: 'Took one part as the share',
    fix: 'A ratio $q : p$ has $q + p$ parts in all; the first group has $q$ of them, so its share is $\\frac{q}{q + p}$.',
  },
  'stat-answered-total': {
    label: 'Gave the total instead of the part asked for',
    fix: 'Reread the question: it asks for one group, not for both groups together.',
  },
  'stat-unweighted-mean': {
    label: 'Averaged the group values without weighting by the counts',
    fix: 'Multiply each value (or group average) by its count, add, and divide by the total count.',
  },
  'stat-divided-by-groups': {
    label: 'Divided the total by the number of groups',
    fix: 'An average per person divides the total by the number of people, not by the number of groups.',
  },
  'stat-shortfall-divided': {
    label: 'Divided the shortfall by the new value instead of by its excess over the target',
    fix: 'Each new member raises the total by its value but also raises the count; it helps by only (its value − the target average).',
  },
  /* ------------------------------------------------------------------ spread */
  'stat-sd-shift': {
    label: 'Thought adding a constant changes the standard deviation',
    fix: 'Adding (or subtracting) the same number to every value shifts the data and the mean together; the standard deviation, range and IQR do not change.',
  },
  'stat-sd-scale': {
    label: 'Thought multiplying every value by $k$ leaves the standard deviation unchanged',
    fix: 'Multiplying every value by $k$ multiplies every distance from the mean, and so the standard deviation, by $|k|$.',
  },
  'stat-sd-range': {
    label: 'Judged standard deviation by the range alone',
    fix: 'Two lists with the same range can have different standard deviations: what matters is how far the values are from the mean overall.',
  },
  'stat-sd-constant': {
    label: 'Gave a nonzero standard deviation to a list of equal values',
    fix: 'If all values are equal, every value is at the mean, so the standard deviation is 0.',
  },
  'stat-sample-sd': {
    label: 'Divided by $n - 1$ instead of $n$',
    fix: 'The GRE standard deviation divides the sum of squared deviations by the number of values $n$, then takes the square root.',
  },
  'stat-sd-mad': {
    label: 'Used the average distance from the mean as the standard deviation',
    fix: 'Square the distances, average the squares, then take the square root. That is at least the average distance.',
  },
  'stat-sd-variance': {
    label: 'Squared the standard deviation, or multiplied it by $k^2$',
    fix: 'The square of the standard deviation is the variance, which is multiplied by $k^2$. The standard deviation itself is multiplied by $|k|$.',
  },
  'stat-sd-is-mean': {
    label: 'Transformed the mean instead of the spread',
    fix: 'The new mean is $k \\times$ mean $+ c$, but the question asks for a measure of spread, which ignores $c$.',
  },
  'stat-sd-direction': {
    label: 'Chose the opposite extreme',
    fix: 'Reread whether the question asks for the greatest or the least spread, and check which end of the ranking you are choosing.',
  },
  'stat-sd-intercept': {
    label: 'Chose the equation with the most extreme constant term',
    fix: 'The constant term shifts every $y$-value equally and does not affect the standard deviation; only $|a|$ in $y = ax + b$ matters.',
  },
  'stat-sd-negative-slope': {
    label: 'Compared signed slopes instead of their absolute values',
    fix: 'A negative coefficient reverses the order of the values but spreads them just as much: compare $|a|$.',
  },
  'stat-percentile-direction': {
    label: 'Moved the percentile the wrong way',
    fix: 'A value below $x$ has fewer data below it, so its percentile is lower; a value above $x$ has a higher percentile.',
  },
  'stat-percentile-complement': {
    label: 'Counted from the top: percent above instead of percent below',
    fix: 'The $n$th percentile has $n$ percent of the data below it. Do not subtract it from 100 unless the question asks for the percent above.',
  },
  'stat-percentile-shift-only': {
    label: 'Gave the shift in percentile points instead of the new percentile',
    fix: 'The count between the two values is a shift: add it to or subtract it from the known percentile to get the new one.',
  },
  'stat-percentile-added': {
    label: 'Added the two percentiles instead of subtracting them',
    fix: 'The data between two values is the difference of their percentiles: the $v$ percentile minus the $u$ percentile, as a percent of the total.',
  },
  'stat-percentile-no-shift': {
    label: 'Forgot to account for the values in between',
    fix: 'Convert the count of values between the two measurements to a percent of all the data and shift the percentile by that amount.',
  },
  'stat-percentile-count': {
    label: 'Mixed up a count of values with percentage points',
    fix: 'Percentile points are percents of the whole data set: divide the count by the total number of values (times 100).',
  },
  'stat-iqr-range': {
    label: 'Mixed up the range and the interquartile range',
    fix: 'Range = greatest − least (the whisker ends). Interquartile range = $Q_3 - Q_1$ (the ends of the box).',
  },
  'stat-iqr-half': {
    label: 'Used only half of the box',
    fix: 'The interquartile range goes from $Q_1$ to $Q_3$, across the whole box, not from the median to a quartile.',
  },
  'stat-boxplot-wrong-mark': {
    label: 'Read the wrong mark on the box plot',
    fix: 'In a box plot the line inside the box is the median; the box ends are $Q_1$ and $Q_3$; the whisker ends are the least and greatest values.',
  },
  /* ------------------------------------------------------------------ distributions */
  'stat-freq-as-data': {
    label: 'Treated the frequencies as the data values',
    fix: 'In a frequency table the counts say how many times each value occurs; the data are the values, each repeated as often as its count.',
  },
  'stat-freq-ignored': {
    label: 'Ignored the frequencies',
    fix: 'Each value counts as many times as its frequency: use cumulative counts for the median and (value × count) for the total.',
  },
  'stat-interval-complement': {
    label: 'Found the probability outside the interval instead of inside',
    fix: 'Add the probabilities of the regions between the two endpoints; use 1 minus the rest only as a check.',
  },
  'stat-interval-extra': {
    label: 'Included a region outside the interval',
    fix: 'Each labeled region covers one unit interval; include only the regions between the two endpoints.',
  },
  'stat-class-midpoints': {
    label: 'Used class midpoints as if they were the data',
    fix: 'A grouped table hides the exact values. Find the least and greatest possible values of the statistic by pushing values to the ends of their classes.',
  },
  'stat-grouped-unknown': {
    label: 'Thought nothing can be concluded from grouped data',
    fix: 'Even without exact values, class boundaries bound the statistic: if every possible value is on one side of the other quantity, the answer is determined.',
  },
  'stat-sd-interval-edge': {
    label: 'Misjudged a value near the edge of the interval',
    fix: 'Within $k$ standard deviations means from mean $- k \\times$ SD to mean $+ k \\times$ SD, inclusive. Compute both endpoints exactly.',
  },
  'stat-sd-units': {
    label: 'Miscounted the number of standard deviations',
    fix: 'The number of standard deviations from the mean is $\\dfrac{|\\text{value} - \\text{mean}|}{\\text{SD}}$.',
  },
  'stat-raw-distance': {
    label: 'Compared raw distances from the mean instead of standard units',
    fix: 'Divide each distance from the mean by that distribution\u2019s standard deviation before comparing.',
  },
  'stat-sd-midpoint': {
    label: 'Put the mean halfway between the two values',
    fix: 'The mean is halfway only when the two values are the same number of SDs from it. Set up value = mean $\\pm$ $z \\times$ SD for both values and solve.',
  },
  'stat-sd-z-subtract': {
    label: 'Subtracted the SD counts of values on opposite sides of the mean',
    fix: 'One value below the mean and one above are $z_1 + z_2$ standard deviations apart.',
  },
  'stat-normal-one-side': {
    label: 'Used a two-sided percent for one side of the mean',
    fix: 'About 68% lie within 1 SD on both sides together; between the mean and 1 SD on one side there are only about 34%.',
  },
  'stat-normal-complement': {
    label: 'Found the percent outside the range instead of inside',
    fix: 'Add the region percents between the two values; the rest of the 100% lies outside.',
  },
  'stat-normal-percent-only': {
    label: 'Gave the percent instead of the number of items',
    fix: 'Multiply the percent by the total number of items to get how many.',
  },
  'stat-normal-sd-count': {
    label: 'Used the wrong number of standard deviations for the percentile',
    fix: 'From the figure: 16% below $-1$ and 2% below $-2$ (84% and 98% below $+1$ and $+2$). Match the percentile to the right tick mark.',
  },
};
