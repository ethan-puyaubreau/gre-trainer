import type { Skill } from '../../../engine/types';

const area = 'data' as const;

export const statsSkills: Skill[] = [
  {
    id: 'data.center',
    area,
    unit: 'Descriptive statistics',
    name: 'Mean, median & mode',
    summary: 'Sum = average × count, medians of lists with unknowns, mean versus median, extreme lists.',
    strategy: `Work with totals: sum = average × count.

- Adding, removing or correcting a value: update the total, then divide by the new count. Do not average two averages of groups of different sizes.
- Median: put the list in order first. With an unknown $x$, the median is a known value or $x$ itself depending on where $x$ falls; try $x$ small, in the middle and very large.
- Evenly spaced lists: mean = median, so the sum is $n \\times$ median. Adding a value equal to the average leaves the average unchanged.
- Mean versus median: one extreme value pulls the mean but not the median, so only signs or bounds rarely decide the comparison (think D).
- Greatest or least possible value: push every other value to its limit (1 for positive integers, the median for values on the median's other side).`,
  },
  {
    id: 'data.weighted',
    area,
    unit: 'Descriptive statistics',
    name: 'Weighted averages',
    summary: 'Combined average of groups, possible overall averages, group sizes from averages.',
    strategy: `The combined average of two groups is $\\dfrac{n_1 a_1 + n_2 a_2}{n_1 + n_2}$. It lies between $a_1$ and $a_2$, closer to the larger group.

- Equal group sizes: the overall average is exactly the midpoint.
- Distances to the overall average are in the inverse ratio of the sizes: $\\frac{n_2}{n_1} = \\frac{c - a_1}{a_2 - c}$.
- "Group 1 has more than $k$ times as many members": the overall average is within $\\frac{1}{k + 1}$ of the gap from $a_1$.
- Grouped data (counts and values): multiply each value by its count, add, divide by the total count, not by the number of groups.`,
  },
  {
    id: 'data.spread',
    area,
    unit: 'Descriptive statistics',
    name: 'Range, standard deviation & quartiles',
    summary: 'Range, IQR, percentiles, and judging or transforming standard deviations.',
    strategy: `Range = greatest − least. Interquartile range = $Q_3 - Q_1$, where $Q_1$ and $Q_3$ are the medians of the lower and upper halves of the ordered list.

- Standard deviation measures spread around the mean: values bunched near the mean give a small SD, values far from it a large SD. Equal values have SD 0.
- Adding $c$ to every value leaves the SD, range and IQR unchanged; multiplying every value by $k$ multiplies them by $|k|$.
- The GRE standard deviation is the square root of the average of the squared deviations (divide by $n$).
- The $p$th percentile has about $p\\%$ of the data below it: $Q_1 \\approx$ 25th, median = 50th, $Q_3 \\approx$ 75th. In a box plot each of the four sections holds about 25% of the data, whatever its length.`,
  },
  {
    id: 'data.distributions',
    area,
    unit: 'Distributions',
    name: 'Distributions & the normal curve',
    summary: 'Frequency tables, grouped data, standard deviation units, the normal distribution.',
    strategy: `Frequency table: the median is found from cumulative counts (position $\\frac{n + 1}{2}$ in the ordered data); the mean is $\\dfrac{\\sum \\text{value} \\times \\text{count}}{\\sum \\text{count}}$.

- Grouped data hide the exact values: the least possible range is the lowest value of the top class minus the highest value of the bottom class.
- Standard units: value = mean + $z \\times$ SD. "2 standard deviations above the mean" means mean + 2 SD. Two values in SD units give two equations for the mean and the SD.
- Normal distribution: symmetric about the mean, with about 34% between the mean and 1 SD, 14% between 1 and 2 SDs and 2% beyond 2 SDs on each side (about 68% within 1 SD).
- Compare positions in different distributions in SD units, not by raw distances.`,
  },
];
