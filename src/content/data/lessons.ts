import type { Lesson } from '../lessons';

export const dataLessons: Record<string, Lesson> = {
  'data.center': {
    idea: `Work with totals: sum = average $\\times$ count. To add, remove or correct a value, update the total first, then divide by the new count.`,
    recognize: `Think totals when a question gives an average and a count, adds or removes a value, or asks for a greatest or least possible value. For medians, order the list first, and push the other values to their limits.`,
    example: {
      problem: `The average of $5$ numbers is $12$. A sixth number is added and the average of the six becomes $14$. What is the sixth number?`,
      steps: [
        `The first total is $5 \\times 12 = 60$, because sum = average $\\times$ count.`,
        `The new total is $6 \\times 14 = 84$, because there are now six numbers.`,
        `The sixth number is $84 - 60 = 24$, because the new total minus the old total is exactly what was added.`,
      ],
      answer: `$24$`,
    },
    traps: ['stat-wrong-count', 'stat-average-of-means', 'stat-extreme-order'],
  },
  'data.weighted': {
    idea: `The combined average of two groups is $\\frac{n_1 a_1 + n_2 a_2}{n_1 + n_2}$. It lies between the two group averages and sits closer to the average of the larger group.`,
    recognize: `Think weighted average when groups of different sizes each have their own average, or when a table lists values with counts. Never average the averages unless the groups are the same size.`,
    example: {
      problem: `Class A has $10$ students with an average score of $80$. Class B has $30$ students with an average score of $60$. What is the average score of all $40$ students?`,
      steps: [
        `Class A's total is $10 \\times 80 = 800$ and class B's total is $30 \\times 60 = 1800$, because total = average $\\times$ count for each group.`,
        `The combined total is $800 + 1800 = 2600$ over $40$ students, because every student counts once.`,
        `$2600 \\div 40 = 65$. This is below the midpoint $70$ and closer to $60$, as expected, because class B is the larger group.`,
      ],
      answer: `$65$`,
    },
    traps: ['stat-weighted-midpoint', 'stat-unweighted-mean', 'stat-weighted-inverted'],
  },
  'data.spread': {
    idea: `Range is greatest minus least. The interquartile range is $Q_3 - Q_1$, where the quartiles are the medians of the lower and upper halves of the ordered list. Adding a constant changes no spread; multiplying by $k$ multiplies it by $|k|$.`,
    recognize: `Think spread when a question mentions range, quartiles, a box plot, percentiles, or how a standard deviation changes after every value is shifted or scaled.`,
    example: {
      problem: `Find the interquartile range of the ordered list $2, 4, 6, 8, 12, 14, 16, 30$.`,
      steps: [
        `Split the $8$ values into halves of four: $2, 4, 6, 8$ and $12, 14, 16, 30$, because the quartiles are the medians of the two halves.`,
        `$Q_1 = \\frac{4 + 6}{2} = 5$ and $Q_3 = \\frac{14 + 16}{2} = 15$, because each half has an even number of values, so its median is the average of its middle two.`,
        `IQR $= 15 - 5 = 10$, because the IQR is $Q_3 - Q_1$. The range, $30 - 2 = 28$, is a different quantity.`,
      ],
      answer: `$10$`,
    },
    traps: ['stat-iqr-range', 'stat-sd-shift', 'stat-sd-scale'],
  },
  'data.distributions': {
    idea: `A frequency table says how many times each value occurs. For the median, use cumulative counts to reach position $\\frac{n + 1}{2}$; for the mean, multiply each value by its count. In standard units, value = mean + $z \\times$ SD.`,
    recognize: `Think of this with a table of values and counts, grouped data, values given in standard deviations from the mean, or a normal curve with percents.`,
    example: {
      problem: `Eleven households report how many cars they own: $3$ own none, $4$ own one, $2$ own two and $2$ own three. What is the median number of cars?`,
      steps: [
        `The median is in position $\\frac{11 + 1}{2} = 6$, because the middle entry of an ordered list of $11$ is the $6$th.`,
        `Count up: "none" covers positions $1$ to $3$ and "one car" covers positions $4$ to $7$, because each count stands for that many repeated values.`,
        `Position $6$ lies in the one-car group, so the median is $1$ car, because the counts are frequencies, not data values.`,
      ],
      answer: `$1$ car`,
    },
    traps: ['stat-freq-as-data', 'stat-raw-distance', 'stat-sd-units'],
  },
  'data.counting': {
    idea: `First decide whether order matters. If it does, or the choices fill distinct positions, multiply the choices slot by slot; if not, divide by the orderings, which gives $\\binom{n}{k}$. Fill any restricted slot first.`,
    recognize: `Think counting for "how many ways" and "how many numbers" questions, with words like arrangements, seats, committees or handshakes. Read the conditions (no repeats, even, must be together) before multiplying.`,
    example: {
      problem: `How many three-digit even numbers can be made from the digits $1, 2, 3, 4, 5$ if no digit is repeated?`,
      steps: [
        `Multiply the choices for the three positions, because digits in different places make different numbers.`,
        `Fill the restricted slot first: the units digit must be $2$ or $4$, which gives $2$ choices, because the number is even.`,
        `The hundreds digit then has $4$ choices and the tens digit $3$, because no digit is repeated, so the count is $2 \\times 4 \\times 3 = 24$.`,
      ],
      answer: `$24$`,
    },
    traps: ['prob-ignored-restriction', 'prob-order-matters', 'prob-handshake-double'],
  },
  'data.probability': {
    idea: `With equally likely outcomes, probability is favorable $\\div$ total. Independent events multiply, and draws without replacement change the total and the counts after each draw. For "at least one", use the complement.`,
    recognize: `Think probability when items are drawn, dice or coins are tossed, or a table asks "given that". Ask whether each draw is replaced, and what the new total is.`,
    example: {
      problem: `A bag holds $4$ red and $6$ blue marbles. Two marbles are drawn at random without replacement. What is the probability that both are red?`,
      steps: [
        `The first marble is red with probability $\\frac{4}{10}$, because $4$ of the $10$ marbles are red.`,
        `The second is red with probability $\\frac{3}{9}$, because one red marble is gone and so is one marble in total.`,
        `Multiply: $\\frac{4}{10} \\cdot \\frac{3}{9} = \\frac{12}{90} = \\frac{2}{15}$, because "and" for successive draws multiplies the chances.`,
      ],
      answer: `$\\frac{2}{15}$`,
    },
    traps: ['prob-with-replacement', 'prob-add-probabilities', 'prob-wrong-denominator'],
  },
  'data.sets': {
    idea: `For two overlapping groups, Total = A + B $-$ Both + Neither. Write it down, plug in what you know and solve for the missing piece. A circle includes its overlap, so Only A = A $-$ Both.`,
    recognize: `Think sets when a question says "both", "neither", "at least one" or "exactly one", or gives the sizes of two groups and their overlap. Least and greatest overlap questions use the same formula.`,
    example: {
      problem: `Of $40$ students, $25$ study French, $18$ study Spanish and $8$ study both. How many study neither language?`,
      steps: [
        `Write Total = French + Spanish $-$ Both + Neither, because students in both groups are counted once in each circle.`,
        `Plug in: $40 = 25 + 18 - 8 + \\text{Neither}$, so $40 = 35 + \\text{Neither}$, because $25 + 18 - 8 = 35$.`,
        `Neither $= 40 - 35 = 5$, because the formula must account for every student.`,
      ],
      answer: `$5$`,
    },
    traps: ['prob-venn-forgot-neither', 'prob-venn-no-overlap', 'prob-venn-only'],
  },
  'data.interpretation': {
    idea: `Read the title, units and scale before the question. Percent change is (new $-$ old) $\\div$ old, with the earlier value as the base, and successive percent changes multiply rather than add.`,
    recognize: `Think of these steps for any table, bar graph or circle graph, especially when the title gives units such as "in thousands" or the question asks for a percent change or a share of a total.`,
    example: {
      problem: `A bar graph titled "Visitors (in thousands)" shows $50$ for 2022 and $60$ for 2023. How many more visitors came in 2023, and by what percent did the number grow?`,
      steps: [
        `The bars stand for $50{,}000$ and $60{,}000$ visitors, because "in thousands" multiplies every value by $1000$.`,
        `The increase is $60{,}000 - 50{,}000 = 10{,}000$ visitors, because change = new $-$ old.`,
        `Percent growth $= \\frac{10{,}000}{50{,}000} = 20\\%$, because the base is the earlier year (dividing by $60{,}000$ would give about $16.7\\%$).`,
      ],
      answer: `$10{,}000$ more visitors, a $20\\%$ increase`,
    },
    traps: ['prob-di-thousands', 'prob-percent-wrong-base', 'prob-add-percents'],
  },
};
