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
    label: 'Made some values small while trying to make the average large',
    fix: 'For the greatest average, push every value as high as the conditions allow; for the least average, push every value as low as allowed.',
  },
  'stat-overlap-ignored': {
    label: 'Counted the shared integers twice',
    fix: 'Different integers in two lists = (size of first) + (size of second) − (number in both).',
  },
  'stat-overlap-off-by-one': {
    label: 'Miscounted the integers from one point to another',
    fix: 'From $a$ to $b$ inclusive there are $b - a + 1$ integers. Check the count with a small example.',
  },
};
