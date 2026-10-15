import type { Trap } from '../../../engine/types';

export const appliedTrapMap: Record<string, Trap> = {
  /* ------------------------------------------------------------ lines in the xy-plane */
  'algw-swap-coordinates': {
    label: 'Mixed up the $x$- and $y$-coordinates',
    fix: 'In $(a, b)$ the first number is the $x$-coordinate (left-right) and the second is the $y$-coordinate (up-down). A point above the line $y = x$ has $y > x$.',
  },
  'algw-point-on-line': {
    label: 'Treated the coordinates of a point on the line as unknown',
    fix: 'A point lies on a line exactly when its coordinates satisfy the equation of the line: $(r, s)$ on $y = -x$ means $s = -r$. That relation fixes the comparison.',
  },
  'algw-perp-no-sign': {
    label: 'Perpendicular slope: took the reciprocal but kept the sign',
    fix: 'Perpendicular slopes are negative reciprocals: $m$ and $-\\frac{1}{m}$, whose product is $-1$.',
  },
  'algw-perp-no-reciprocal': {
    label: 'Perpendicular slope: changed the sign but did not take the reciprocal',
    fix: 'The slope perpendicular to $m$ is $-\\frac{1}{m}$, not $-m$. Flip the fraction AND change the sign.',
  },
  'algw-parallel-perp': {
    label: 'Confused parallel and perpendicular slopes',
    fix: 'Parallel lines have the SAME slope. Perpendicular lines have slopes whose product is $-1$.',
  },
  'algw-kept-intercept': {
    label: 'Kept the y-intercept of the given line',
    fix: 'A parallel line through another point has the same slope but a different intercept. Substitute the point into $y = mx + b$ and solve for $b$.',
  },
  'algw-intercept-sign': {
    label: 'Sign error when solving for the intercept',
    fix: 'From $q = mp + b$, the intercept is $b = q - mp$. Watch the sign of $mp$ when $m$ or $p$ is negative.',
  },
  'algw-standard-form-slope': {
    label: 'Read the slope of $ax + by = c$ as $\\frac{a}{b}$',
    fix: 'Solve for $y$ first: $y = -\\frac{a}{b}x + \\frac{c}{b}$, so the slope is $-\\frac{a}{b}$.',
  },
  'algw-x-vs-y-intercept': {
    label: 'Gave the $y$-intercept when the $x$-intercept was asked',
    fix: 'The $x$-intercept is where $y = 0$: set $y = 0$ in the equation and solve for $x$.',
  },
  'algw-distance-add': {
    label: 'Added the horizontal and vertical distances',
    fix: 'The distance is the hypotenuse of a right triangle: $\\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$, not $|\\Delta x| + |\\Delta y|$.',
  },
  'algw-distance-no-root': {
    label: 'Forgot the square root in the distance formula',
    fix: '$(\\Delta x)^2 + (\\Delta y)^2$ is the SQUARE of the distance. Take its square root.',
  },
  'algw-midpoint-half': {
    label: 'Stopped at the distance to the midpoint',
    fix: 'The midpoint is halfway, so the whole segment is twice the distance from an endpoint to the midpoint.',
  },
  'algw-midpoint-reversed': {
    label: 'Averaged an endpoint with the midpoint',
    fix: 'If $M$ is the midpoint of $PQ$, then $Q = 2M - P$: from $P$ to $M$ is one step, and the same step again reaches $Q$.',
  },
  'algw-difference-as-coordinate': {
    label: 'Gave the horizontal distance instead of the coordinate',
    fix: 'Solving $(t - a)^2 = k^2$ gives $t - a = \\pm k$, so $t = a \\pm k$. Then use the condition on $t$ to pick one.',
  },
  'algw-slope-inverted': {
    label: 'Used run over rise for the slope',
    fix: 'Slope is rise over run: $\\frac{y_2 - y_1}{x_2 - x_1}$ (change in $y$ divided by change in $x$).',
  },
  'algw-quadrant-sign-slip': {
    label: 'Misread a sign and placed the line in a quadrant it does not reach',
    fix: 'Mark the intercepts first: the sign of the y-intercept says where the line meets the y-axis, the sign of the slope says which way it tilts. Then follow it through the axes.',
  },
  'algw-quadrant-complement': {
    label: 'Listed the quadrants the line DOES pass through',
    fix: 'The question asks for the quadrants the line does NOT pass through. Find the ones it crosses, then name the others.',
  },
  'algw-slope-sign': {
    label: 'Wrong sign of the slope',
    fix: 'A line that goes DOWN from left to right has a negative slope; one that goes up has a positive slope.',
  },
  /* ------------------------------------------------------------ graphs of functions */
  'algw-region-eyeball': {
    label: 'Judged a point near the boundary by eye',
    fix: 'Substitute the coordinates into the inequality. Points just past the boundary look inside but fail the test.',
  },
  'algw-region-sign': {
    label: 'Forgot the other boundaries of the region',
    fix: 'A region bounded by the axes contains only points with $x > 0$ and $y > 0$. Check every boundary, not just the slanted line.',
  },
  'algw-region-one-condition': {
    label: 'Checked only one of the inequalities',
    fix: 'A point is in the region only if it satisfies ALL the inequalities that define it.',
  },
  'algw-parallel-meet': {
    label: 'Thought a line parallel to a branch would meet it',
    fix: 'Two parallel lines with different intercepts never meet. A line below the vertex of a V-shaped graph meets it only if it is steeper than the branches.',
  },
  'algw-line-eventually-meets': {
    label: 'Assumed any slanted line eventually crosses the graph',
    fix: 'A line that passes below the vertex of $y = a|x - h| + k$ crosses it only if its slope is steeper than $a$ in absolute value. Otherwise the V rises faster and the line stays below.',
  },
  'algw-strict-vs-nonstrict': {
    label: 'Forgot the case of equality',
    fix: '$(x - h)^2 \\ge 0$, and it EQUALS 0 at $x = h$. "Greater than or equal to" allows both A and C, so the answer is D.',
  },
  'algw-parabola-monotone': {
    label: 'Assumed a larger $x$ gives a larger $y$ on a parabola',
    fix: 'A parabola is symmetric about its axis $x = h$. Compare the DISTANCES of the two $x$-values from $h$: on a downward parabola the closer one is higher.',
  },
  'algw-symmetric-points': {
    label: 'Missed the symmetry of the parabola',
    fix: 'Two points of a parabola with the same $y$-coordinate are mirror images across its axis $x = h$, so their $x$-coordinates always add up to $2h$, whichever pair is chosen.',
  },
  'algw-vertex-sign': {
    label: 'Sign error in the axis of symmetry',
    fix: 'For $y = ax^2 + bx + c$ the axis is $x = -\\frac{b}{2a}$; for $y = (x - h)^2 + k$ the vertex is $(h, k)$, not $(-h, k)$.',
  },
  'algw-min-at-intercept': {
    label: 'Took the $y$-intercept as the minimum',
    fix: 'An upward parabola reaches its minimum at the vertex, halfway between its $x$-intercepts, not at $x = 0$.',
  },
  'algw-intercepts-not-intersection': {
    label: 'Found the $x$-intercepts instead of the intersection points',
    fix: 'Intersection points satisfy BOTH equations: set the two expressions for $y$ equal and solve.',
  },
  'algw-one-intersection': {
    label: 'Kept only one solution of the equation',
    fix: '$x^2 = k$ has two solutions, $\\sqrt{k}$ and $-\\sqrt{k}$; a horizontal line above the vertex meets a parabola twice.',
  },
  'algw-gave-x-not-y': {
    label: 'Gave the $x$-coordinate instead of the $y$-coordinate',
    fix: 'After solving for $x$, substitute it back into one of the equations to get $y$.',
  },
  'algw-shift-direction': {
    label: 'Shifted the graph the wrong way',
    fix: '$f(x - 2)$ moves the graph 2 units to the RIGHT: $g(5) = f(5 - 2) = f(3)$. Inside the parentheses, the shift is opposite to the sign.',
  },
  'algw-composite-once': {
    label: 'Applied the function only once',
    fix: 'For $f(f(a))$, read $f(a)$ first, then read $f$ again at that value.',
  },
  'algw-count-crossings': {
    label: 'Missed some solutions of $f(x) = c$',
    fix: 'Draw the horizontal line $y = c$ across the whole graph and count every point where it meets the graph.',
  },
  /* ------------------------------------------------------------ sequences */
  'algw-seq-off-by-one': {
    label: 'Off by one term',
    fix: 'From term 1 to term $n$ there are $n - 1$ steps, so $a_n = a_1 + (n - 1)d$ (or $a_1 r^{n-1}$). Count the steps, not the terms.',
  },
  'algw-seq-steps': {
    label: 'Counted the terms instead of the steps between two terms',
    fix: 'From $a_m$ to $a_n$ there are $n - m$ steps of the common difference, so $a_n - a_m = (n - m)d$.',
  },
  'algw-seq-count-terms': {
    label: 'Wrong number of terms in the sum',
    fix: 'From term $m$ to term $n$ inclusive there are $n - m + 1$ terms.',
  },
  'algw-seq-sum-last-times-n': {
    label: 'Multiplied the last term by the number of terms',
    fix: 'Sum of an arithmetic sequence = (number of terms) $\\times$ (first term + last term) $\\div 2$.',
  },
  'algw-seq-proportional': {
    label: 'Assumed the terms are proportional to their positions',
    fix: '$a_{2k} = 2a_k$ only when $a_1 = d$. The first term shifts every term, so the comparison depends on it.',
  },
  'algw-geo-exponent': {
    label: 'Off by one in the exponent of a geometric sequence',
    fix: '$a_n = a_1 r^{n-1}$, and $\\frac{a_m}{a_k} = r^{m-k}$: count the multiplications between the two terms.',
  },
  'algw-geo-as-arith': {
    label: 'Treated a geometric sequence as arithmetic',
    fix: 'When each term is a constant MULTIPLE of the previous one, divide terms to find the ratio; do not subtract.',
  },
  'algw-geo-sign': {
    label: 'Ignored the sign pattern of a negative ratio',
    fix: 'With a negative ratio the terms alternate in sign: $a_n$ has the sign of $a_1$ when $n$ is odd and the opposite sign when $n$ is even.',
  },
  'algw-seq-before-start': {
    label: 'Counted a value before the first term',
    fix: 'The sequence starts at $a_1$. A value that fits the pattern but comes before $a_1$ is not a term.',
  },
  'algw-seq-multiple-of-d': {
    label: 'Assumed the terms are multiples of the common difference',
    fix: 'The terms $a_1, a_1 + d, a_1 + 2d, \\dots$ all leave the same remainder as $a_1$ when divided by $d$: subtract $a_1$ and test divisibility by $d$.',
  },
  'algw-recursion-order': {
    label: 'Applied the steps of the recursive rule in the wrong order',
    fix: 'Follow the rule exactly: for $a_n = 2a_{n-1} - 3$, multiply the previous term by 2 FIRST, then subtract 3.',
  },
  'algw-mean-two-terms': {
    label: 'Averaged only the two previous terms',
    fix: 'The rule averages ALL the preceding terms. A term equal to the mean of the earlier terms leaves that mean unchanged, so from then on every term is the same.',
  },
  'algw-recursion-backward': {
    label: 'Ran the rule forward instead of undoing it',
    fix: 'To go back one term, undo the steps in reverse order: if $a_n = 2a_{n-1} - 3$, then $a_{n-1} = \\frac{a_n + 3}{2}$.',
  },
  /* ------------------------------------------------------------ word problems */
  'algw-forgot-divide-difference': {
    label: 'Stopped before dividing by the difference of the two values',
    fix: 'Swapping one item of the cheaper kind for one of the dearer kind adds the DIFFERENCE of the values. Divide the extra total by that difference to count the swaps.',
  },
  'algw-answered-value-not-count': {
    label: 'Gave the money (or points) instead of the number of items',
    fix: 'Reread the question: it asks how many items, not how much they are worth in total.',
  },
  'algw-answered-count-not-value': {
    label: 'Gave the number of items instead of their value',
    fix: 'The question asks for an amount of money (or points, or legs): multiply the number of items by the value of one.',
  },
  'algw-answered-total-value': {
    label: 'Gave the total value of both kinds',
    fix: 'The total is given in the problem. The question asks for the part that comes from ONE kind.',
  },
  'algw-all-at-one-price': {
    label: 'Priced every item at the same rate',
    fix: 'The two kinds of items have different values. Only the items of the asked kind are priced at its rate.',
  },
  'algw-wrong-divisor': {
    label: 'Divided the extra value by the wrong number',
    fix: 'Each swap changes the total by the DIFFERENCE of the two values, so divide the extra by that difference.',
  },
  'algw-difference-of-counts': {
    label: 'Gave the difference between the two counts',
    fix: 'The question asks for the number of items of one kind, not for how much one kind exceeds the other.',
  },
  'algw-intermediate-step': {
    label: 'Gave a number from the middle of the solution',
    fix: 'After the last step, reread the question: does your number answer it? The price, the difference of prices and the first subtraction are only stepping stones.',
  },
  'algw-answered-total': {
    label: 'Gave the total number of items',
    fix: 'The total is given in the problem; the question asks for the number of ONE of the two kinds.',
  },
  'algw-assumed-equal-split': {
    label: 'Assumed the items split evenly between the two kinds',
    fix: 'Nothing says the two kinds are equally common. Use the total value to find the split.',
  },
  'algw-wrong-pairing': {
    label: 'Multiplied or divided the wrong pair of quantities',
    fix: 'Write the rate with its units (dollars per pencil) and ask which quantities cancel; a quick numeric example checks the arrangement.',
  },
  'algw-answered-other-unknown': {
    label: 'Answered with the other unknown',
    fix: 'Reread the question before answering: after solving for one quantity, compute the one that was actually asked for.',
  },
  'algw-more-than-order': {
    label: 'Translated "$k$ more than twice $y$" as $2(y + k)$',
    fix: '"$k$ more than twice $y$" is $2y + k$. "Twice the sum of $y$ and $k$" would be $2(y + k)$.',
  },
  'algw-more-than-direction': {
    label: 'Put the "more than" on the wrong group',
    fix: '"There are $k$ more $X$ than $Y$" means $X = Y + k$, so $Y = X - k$. Check with numbers: 10 members and 3 more members than nonmembers gives 7 nonmembers.',
  },
  'algw-age-offset-one': {
    label: 'Applied "years ago" (or "from now") to only one person',
    fix: 'Everyone ages at the same rate: $n$ years ago BOTH ages were $n$ less.',
  },
  'algw-formula-order': {
    label: 'Applied the formula in the wrong order (or with the factor inverted)',
    fix: 'Follow the formula exactly: $F = \\frac{9}{5}C + 32$ means multiply by $\\frac{9}{5}$, then add 32. To solve for $C$, undo in reverse order: subtract 32, then multiply by $\\frac{5}{9}$.',
  },
  'algw-forgot-fixed-fee': {
    label: 'Ignored the fixed charge',
    fix: 'Subtract the fixed fee from the total first; only the rest is paid at the per-unit rate.',
  },
  'algw-units-mismatch': {
    label: 'Answered in the wrong unit',
    fix: 'Convert to the unit the question asks for: 6 half-hours is 3 hours, 90 minutes is 1.5 hours.',
  },
  'algw-units-cents': {
    label: 'Mixed cents and dollars',
    fix: 'Put every amount in the same unit before combining: $c$ cents is $\\frac{c}{100}$ dollars.',
  },
  'algw-first-unit-twice': {
    label: 'Charged the first unit twice',
    fix: 'When the first mile has its own price, only the remaining $m - 1$ miles are charged at the other rate.',
  },
  'algw-percent-of-wrong-base': {
    label: 'Applied the percent to the wrong amount',
    fix: 'Take the percent of the amount it refers to: "$p$ percent of the water in the tank" is $p$ percent of the contents, not of the capacity.',
  },
  'algw-used-vs-left': {
    label: 'Computed the part used instead of the part left',
    fix: 'If $p$ percent is used, $(100 - p)$ percent remains: multiply by $1 - \\frac{p}{100}$.',
  },
  'algw-added-subtracted': {
    label: 'Subtracted an amount that was added',
    fix: 'Translate each step with its own sign: amounts added increase the total, amounts used decrease it.',
  },
  'algw-order-of-steps': {
    label: 'Applied the steps in the wrong order',
    fix: 'The percent applies to what is there at that moment. Follow the story in order: percent first, then the amount added.',
  },
  'algw-rate-inverted': {
    label: 'Inverted the unit rate',
    fix: 'Cost per item = total cost ÷ number of items. Check the units: (dollars per item) × items = dollars.',
  },
  'algw-exactly-one-total': {
    label: 'Ignored the percent that describes the group',
    fix: 'Only the people with EXACTLY one of the two properties split into "first only" and "second only". Find the size of that group first.',
  },
  'algw-single-case': {
    label: 'Tested only one case',
    fix: 'When the quantities depend on unknown values, try several values allowed by the conditions (small, large, equal). If the comparison changes, the answer is D.',
  },
  'algw-cost-exact-multiple': {
    label: 'Ignored the "less than" (or "more than") part of the price relation',
    fix: 'Write the price relation exactly, e.g. $L = 3S - 2$, and cancel the common part of both quantities before comparing.',
  },
  /* ------------------------------------------------------------ rate, work, distance */
  'algw-average-times': {
    label: 'Averaged the two times',
    fix: 'Rates add, times do not: $\\frac{1}{T} = \\frac{1}{a} + \\frac{1}{b}$. Working together is faster than either one alone.',
  },
  'algw-add-times': {
    label: 'Added the two times',
    fix: 'Two machines working together finish SOONER than either one alone. Add the rates (jobs per hour), not the times.',
  },
  'algw-subtract-times': {
    label: 'Subtracted the times',
    fix: 'Subtract RATES, not times: $\\frac{1}{b} = \\frac{1}{T} - \\frac{1}{a}$, then invert.',
  },
  'algw-alone-faster': {
    label: 'Found a time alone shorter than the time together',
    fix: 'One machine alone can never be faster than a team that includes it. Any time alone must exceed the time together.',
  },
  'algw-drain-sign': {
    label: 'Added the rate of the drain',
    fix: 'A drain works against the pipe: net rate = filling rate − draining rate.',
  },
  'algw-average-speeds': {
    label: 'Averaged the speeds',
    fix: 'Average speed = total distance ÷ total time. Over equal distances more time is spent at the lower speed, so the average speed is below the average of the speeds.',
  },
  'algw-direct-variation': {
    label: 'Treated an inverse relation as direct',
    fix: 'For a fixed distance, time = distance ÷ speed. A speed 25 percent higher multiplies the time by $\\frac{1}{1.25} = 0.8$, which is not 25 percent less than 1.25 times.',
  },
  'algw-relative-speed-sign': {
    label: 'Added the speeds when one chases the other (or subtracted when they approach)',
    fix: 'Moving toward each other, the gap closes at the SUM of the speeds. Moving in the same direction, it closes at the DIFFERENCE.',
  },
  'algw-head-start': {
    label: 'Ignored the head start',
    fix: 'Before the second traveler leaves, the first one has already covered (speed × delay). Only after that does the gap start to close.',
  },
  'algw-wrong-start-time': {
    label: 'Added the travel time to the wrong starting time',
    fix: 'The time to close the gap is counted from the moment both are moving, that is, from the later departure.',
  },
  /* ------------------------------------------------------------ mixtures and interest */
  'algw-average-percents': {
    label: 'Averaged the percents',
    fix: 'Weight each concentration by its amount: concentration = total amount of solute ÷ total amount of mixture.',
  },
  'algw-total-vs-added': {
    label: 'Gave the final total instead of the amount added',
    fix: 'The final volume includes what was there already. Amount added = final volume − starting volume.',
  },
  'algw-mixture-ratio-inverted': {
    label: 'Inverted the mixing ratio',
    fix: 'The mixture ends up closer to the solution used in larger amount. Write the solute equation: $x \\cdot p + y \\cdot q = (x + y) \\cdot c$.',
  },
  'algw-weighted-range': {
    label: 'Allowed a concentration that a mixture cannot reach',
    fix: 'A mixture of two solutions is a weighted average: strictly between the two concentrations, and closer to the one used in larger amount.',
  },
  'algw-pure-adds-volume': {
    label: 'Forgot that the added substance also adds volume',
    fix: 'Adding $y$ liters of pure substance increases BOTH the amount of substance and the total volume: use $\\frac{\\text{substance} + y}{\\text{volume} + y}$.',
  },
  'algw-compounding-frequency': {
    label: 'Thought the compounding frequency does not matter',
    fix: 'More frequent compounding earns interest on interest sooner: 8 percent compounded semiannually gives $1.04^2 = 1.0816$, more than $1.08$.',
  },
  'algw-simple-for-compound': {
    label: 'Used simple interest for compound interest',
    fix: 'With compound interest the interest also earns interest: the value is $P(1 + r)^n$, which is more than $P(1 + nr)$ for $n \\ge 2$.',
  },
  'algw-compound-rate-split': {
    label: 'Did not split the annual rate among the periods',
    fix: 'Compounded $k$ times a year at annual rate $r$: each period multiplies by $1 + \\frac{r}{k}$, and there are $k$ periods per year.',
  },
  'algw-interest-years': {
    label: 'Forgot the number of years',
    fix: 'Simple interest is $I = Prt$: principal × annual rate × number of years.',
  },
  'algw-interest-vs-value': {
    label: 'Gave the interest instead of the total value',
    fix: 'The value of the account is the principal plus the interest: $P(1 + r)^n$, not $P(1 + r)^n - P$.',
  },
  'algw-linear-growth': {
    label: 'Treated doubling as linear growth',
    fix: 'Doubling $n$ times multiplies the amount by $2^n$, not by $n$ or $2n$: 3 doublings give $8P$.',
  },
};
