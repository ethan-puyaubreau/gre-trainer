import type { Trap } from '../../../engine/types';

// New named mistakes for the integer skills. Ids start with "int-". Mistakes that already exist in
// ../traps.ts (forgot-two-is-prime, one-is-prime, counted-endpoint, tested-one-value, ...) are reused.
export const integerTraps: Record<string, Trap> = {
  // ---------------------------------------------------------------- divisibility
  'int-divides-remainder-only': {
    label: 'Picked a divisor of the remainder only',
    fix: 'If $n = dk + r$, a number divides every such $n$ only if it divides both $d$ and $r$. Test $k = 1$: it must divide $d + r$ too.',
  },
  'int-divides-divisor-only': {
    label: 'Picked a divisor of the divisor only',
    fix: 'If $n = dk + r$, dividing $d$ is not enough. Test $k = 0$: then $n = r$, so the number must divide $r$ as well.',
  },
  'int-remainder-not-reduced': {
    label: 'Left a remainder larger than the divisor',
    fix: 'A remainder is always less than the divisor. If the work gives 14 when dividing by 9, keep subtracting 9: the remainder is 5.',
  },
  'int-huge-number': {
    label: 'Assumed the remainder of a huge number cannot be found',
    fix: 'Remainders follow patterns: $10 = 9 + 1$, so every power of 10 leaves remainder 1 when divided by 9 (or 3); $100 = 99 + 1$, so even powers of 10 leave remainder 1 when divided by 11; and 100 is a multiple of 4.',
  },
  'int-ignored-different': {
    label: 'Ignored the word "different"',
    fix: 'If $x$ and $y$ must be different, the case $x = y$ is not allowed. For different positive odd integers the smallest sum is $1 + 3 = 4$, not $1 + 1 = 2$.',
  },
  'int-cancel-first': {
    label: 'Did not cancel the given factor first',
    fix: 'Cancel the known part of the denominator first. The unknown factor must divide what is LEFT of the numerator, not the whole numerator.',
  },
  'int-remainder-complement': {
    label: 'Counted the remainder from the next multiple',
    fix: 'A remainder $r$ means $n$ is $r$ ABOVE a multiple of the divisor: $n = dk + r$, not $dk - r$. For remainder 2 on division by 7, 9 works ($7 + 2$) and 12 does not ($14 - 2$).',
  },
  'int-remainder-ignored': {
    label: 'Picked a multiple of the divisor',
    fix: 'A multiple of the divisor leaves remainder 0. The remainder in the question tells you how far above a multiple $n$ sits.',
  },
  'int-one-condition-only': {
    label: 'Checked only one of the conditions',
    fix: 'A value must satisfy every condition in the question. Test each candidate against all of them.',
  },
  // ---------------------------------------------------------------- primes & parity
  'int-odd-composite-as-prime': {
    label: 'Took an odd composite number for a prime',
    fix: 'Odd does not mean prime: $27 = 3 \\cdot 9$, $49 = 7 \\cdot 7$, $51 = 3 \\cdot 17$, $91 = 7 \\cdot 13$. Test the primes up to $\\sqrt{n}$ before calling $n$ prime.',
  },
  'int-primes-sum-parity': {
    label: 'Assumed a sum of two primes has to be odd',
    fix: 'Two odd primes add up to an EVEN number: $22 = 5 + 17$. Only a sum that includes the prime 2 can be odd.',
  },
  'int-parity-rules': {
    label: 'Misapplied an odd/even rule',
    fix: 'odd $\\pm$ odd = even, odd $\\pm$ even = odd, odd $\\times$ odd = odd, and even $\\times$ any integer = even. A power has the parity of its base.',
  },
  // ---------------------------------------------------------------- factors
  'int-forgot-greater-than-one': {
    label: 'Ignored the condition "greater than 1"',
    fix: 'Apply every constraint before computing: with both factors greater than 1, the pair $1 \\times N$ is not allowed.',
  },
  'int-assumed-distinct': {
    label: 'Assumed the two letters stand for different numbers',
    fix: 'Unless the question says "different" or "distinct", $p$ and $q$ can be equal. Test the case $p = q$.',
  },
  'int-divisors-exponents': {
    label: 'Counted divisors from the exponents the wrong way',
    fix: '$p^a q^b$ has $(a + 1)(b + 1)$ positive divisors: the exponent of $p$ can be any of $0, 1, \\ldots, a$. Do not multiply or add the exponents themselves.',
  },
  'int-divisors-add': {
    label: 'Added the (exponent + 1) terms instead of multiplying them',
    fix: 'The choices for each prime are independent, so the counts MULTIPLY: $2^3 \\cdot 3^2$ has $(3 + 1)(2 + 1) = 12$ divisors, not $4 + 3 = 7$.',
  },
  'int-stopped-factoring': {
    label: 'Stopped factoring before the factors were prime',
    fix: 'Keep dividing until every factor is prime. A factor like 15 or 21 is not prime: $15 = 3 \\cdot 5$, so the prime factors are 3 and 5.',
  },
  'int-sign-slip': {
    label: 'Flipped the sign inside the parentheses',
    fix: 'After factoring out the common power, keep the original sign: $2^{13} + 2^{9} = 2^{9}(2^{4} + 1)$, not $2^{9}(2^{4} - 1)$.',
  },
  'int-exponent-as-prime': {
    label: 'Took an exponent for a prime factor',
    fix: 'An exponent says how many times a prime is used; it is not a factor of the number. Factor the expression, then read off its primes.',
  },
  'int-smaller-prime-factor': {
    label: 'Named a prime factor that is not the greatest',
    fix: 'List all the prime factors, then pick the greatest. The first prime you find is usually the smallest.',
  },
  'int-count-with-multiplicity': {
    label: 'Counted repeated prime factors more than once',
    fix: '"Different prime factors" counts each prime once, however many times it divides: $2^5 \\cdot 3^2$ has two different prime factors, 2 and 3.',
  },
  'int-missing-prime': {
    label: 'Chose a value with a prime that is not in the numerator',
    fix: 'After cancelling, $y$ can only use the primes (with at most the powers) that are left in the numerator. A prime that is not there cannot cancel.',
  },
  'int-power-too-many': {
    label: 'Chose a value with more copies of a prime than are left',
    fix: 'Count each prime: if only $2^2$ is left after cancelling, then 8 ($2^3$) does not divide it.',
  },
  'int-divisors-missed-ends': {
    label: 'Left out 1 or the number itself',
    fix: '1 and $N$ are divisors of $N$. The formula $(a + 1)(b + 1)$ already counts them.',
  },
  'int-divisors-parity': {
    label: 'Counted all divisors instead of only the even (or odd) ones',
    fix: 'Odd divisors use only the odd primes: for $2^3 \\cdot 3^2 \\cdot 5$ there are $(2 + 1)(1 + 1) = 6$ odd divisors, and $24 - 6 = 18$ even ones.',
  },
  'int-factor-common-power': {
    label: 'Did not factor out the common power',
    fix: 'Factor first: $2^{12} - 2^{8} = 2^{8}(2^{4} - 1) = 2^{8} \\cdot 3 \\cdot 5$. The primes inside the parentheses are factors too.',
  },
  'int-subtracted-exponents': {
    label: '$b^m - b^n = b^{m-n}$',
    fix: 'Exponents subtract only when you divide: $b^m \\div b^n = b^{m-n}$. For a difference, factor: $b^m - b^n = b^n(b^{m-n} - 1)$.',
  },
  'int-least-multiplier': {
    label: 'Did not use the least multiplier',
    fix: 'Multiplying by $N$ itself always gives a square, but rarely the least one, and multiplying by every prime of $N$ may not work at all. Add just enough of each prime to make its exponent even (a multiple of 3 for a cube).',
  },
  'int-counted-ordered-pairs': {
    label: 'Counted each factor pair twice',
    fix: 'A $4 \\times 9$ rectangle is the same as a $9 \\times 4$ one. Count unordered factor pairs: half the number of divisors, rounded up when $N$ is a perfect square.',
  },
  // ---------------------------------------------------------------- LCM & GCD
  'int-lcm-is-product': {
    label: 'Used the product instead of the LCM',
    fix: 'The least common multiple of $a$ and $b$ is $ab$ only when they share no prime factor. For 12 and 18 it is 36, not 216.',
  },
  'int-added-intervals': {
    label: 'Added the intervals instead of finding the LCM',
    fix: 'Events with intervals 12 and 18 minutes do not coincide after 12 + 18 = 30 minutes. They coincide at common multiples: the first is lcm$(12, 18) = 36$.',
  },
  'int-lcm-two-only': {
    label: 'Used the LCM of only some of the numbers',
    fix: 'Everything lines up only at multiples of the LCM of ALL the intervals. A common multiple of two of them is not enough.',
  },
  'int-gcd-lcm-swapped': {
    label: 'Mixed up GCD and LCM',
    fix: 'Splitting things into the largest equal groups uses the GCD. Finding when things line up again, or the least amount that works for every size, uses the LCM.',
  },
  'int-lcm-gcd-not-checked': {
    label: 'Did not check that the LCM (or GCD) comes out exactly',
    fix: 'Compute the LCM or GCD for each candidate. If lcm$(x, 12) = 36$, then $x$ must divide 36 AND bring the factor $3^2$ that 12 lacks: lcm$(6, 12) = 12$, not 36.',
  },
  // ---------------------------------------------------------------- consecutive integers
  'int-multiples-count': {
    label: 'Off by one when counting multiples',
    fix: 'Multiples of $k$ from the first one $f$ to the last one $l$: $\\frac{l - f}{k} + 1$. Or count $\\lfloor b/k \\rfloor - \\lfloor (a-1)/k \\rfloor$.',
  },
  'int-double-counted': {
    label: 'Did not handle the overlap',
    fix: 'Numbers divisible by both $a$ and $b$ (the multiples of their LCM) are in both lists: subtract them once for "or", and remove them for "but not".',
  },
  'int-doubled-sum': {
    label: '$S(2m) = 2S(m)$',
    fix: 'Each of the integers $m + 1, \\ldots, 2m$ is $m$ more than one of $1, \\ldots, m$, so $S(2m) = 2S(m) + m^2$. Or use $\\frac{n(n+1)}{2}$ directly.',
  },
  'int-sum-split': {
    label: 'Lost part of the second half of the sum',
    fix: '$(m+1) + \\cdots + 2m = S(m) + m \\cdot m$, so $S(2m) = S(m) + S(m) + m^2$, not $S(m) + m^2$.',
  },
  'int-sum-difference-shift': {
    label: '$S(b) - S(a) = S(b - a)$',
    fix: '$S(60) - S(40)$ is $41 + 42 + \\cdots + 60$ (20 terms averaging 50.5), not $1 + 2 + \\cdots + 20$.',
  },
  'int-line-self': {
    label: 'Miscounted the person in the middle',
    fix: 'People in line = (people ahead) + 1 + (people behind). Someone who is $k$th from the front and $m$th from the back is counted in both positions, so the line has $k + m - 1$ people.',
  },
  'int-other-end': {
    label: 'Gave the other end of the run',
    fix: 'Read whether the question asks for the least or the greatest term, and check your answer against the run you built.',
  },
  'int-sum-scale': {
    label: 'Assumed doubling the last term quadruples the sum',
    fix: 'Doubling $n$ does not quadruple the sum exactly: $S(2m) = 2S(m) + m^2$, and $4S(m)$ is $m$ too large. Test with $m = 3$: $S(3) = 6$ and $S(6) = 21$, not 24.',
  },
  'int-gave-middle-term': {
    label: 'Gave the average instead of the requested term',
    fix: 'Sum $\\div$ number of terms is the average, which is the middle term. Then step out to the least or greatest term.',
  },
  'int-step-size': {
    label: 'Used a step of 1 for consecutive even (or odd) integers',
    fix: 'Consecutive even integers, like consecutive odd integers, differ by 2: $n, n + 2, n + 4, \\ldots$',
  },
  'int-sum-multiple-of-count': {
    label: 'Assumed a sum of $k$ consecutive integers is a multiple of $k$',
    fix: 'That holds only when $k$ is odd ($k$ times the middle term). Four consecutive integers sum to $4n + 6$, which is never a multiple of 4.',
  },
  // ---------------------------------------------------------------- exponents
  'int-negative-exponent': {
    label: 'Mishandled a negative exponent',
    fix: '$a^{-n} = \\frac{1}{a^n}$: a negative exponent takes the reciprocal, it does not make the number negative. $\\left(\\frac{1}{3}\\right)^{-2} = 9$ and $2^{-4} = \\frac{1}{16}$.',
  },
  'int-negative-base-sign': {
    label: 'Lost the sign of a negative base',
    fix: '$(-a)^n$ is positive when $n$ is even and negative when $n$ is odd, and this also holds for negative $n$.',
  },
  'int-added-like-powers': {
    label: '$b^n + b^n = b^{2n}$',
    fix: 'Adding equal powers multiplies by a count: $2^n + 2^n = 2 \\cdot 2^n = 2^{n+1}$ and $3^n + 3^n + 3^n = 3^{n+1}$. Exponents add only when powers are multiplied.',
  },
  'int-power-of-power': {
    label: '$(b^m)^n = b^{m+n}$',
    fix: 'A power of a power multiplies the exponents: $(2^2)^{10} = 2^{20}$.',
  },
  'int-base-change-exponent': {
    label: 'Changed the base without changing the exponent',
    fix: 'Rewrite the whole power: $4^x = (2^2)^x = 2^{2x}$, not $2^x$; $27^x = 3^{3x}$.',
  },
  'int-exponent-distribute': {
    label: 'Multiplied only part of the exponent',
    fix: 'The outer exponent multiplies the WHOLE inner exponent: $9^{x+1} = (3^2)^{x+1} = 3^{2x+2}$, not $3^{2x+1}$.',
  },
  'int-power-ten-direction': {
    label: 'Reversed the direction of the exponents',
    fix: 'If $10^x$ is a small percent of $10^y$, then $10^x$ is the smaller number, so $x < y$. Write the percent as a power of 10 first: $0.1\\% = 10^{-3}$.',
  },
  'int-power-ten-factor': {
    label: 'Gave the relation between the numbers instead of the exponents',
    fix: 'The question links the exponents. If $10^x$ is 1 percent of $10^y$, then $10^x = 10^{y-2}$, so $x = y - 2$. It is not $y = 100x$.',
  },
  'int-percent-not-divided': {
    label: 'Treated $q$ percent as $q$',
    fix: '$q$ percent means $\\frac{q}{100}$: 1 percent is $10^{-2}$, 0.1 percent is $10^{-3}$, and 10 percent is $10^{-1}$.',
  },
  // ---------------------------------------------------------------- evaluating expressions
  'int-distribute-power': {
    label: '$(a - b)^n = a^n - b^n$',
    fix: 'Powers do not distribute over $+$ or $-$. Compute inside the parentheses first, then raise to the power.',
  },
  'int-no-parentheses': {
    label: 'Substituted a negative value without parentheses',
    fix: 'Write the value in parentheses: with $s = -7$, $2 - s = 2 - (-7) = 9$ and $s^2 = (-7)^2 = 49$, not $-7^2 = -49$.',
  },
  'int-negative-square': {
    label: '$-3^2 = 9$',
    fix: 'The exponent applies before the minus sign: $-3^2 = -(3^2) = -9$. Only $(-3)^2 = 9$.',
  },
  'int-left-to-right': {
    label: 'Ignored the order of operations',
    fix: 'Parentheses, then exponents, then $\\times$ and $\\div$ from left to right, then $+$ and $-$ from left to right.',
  },
  'int-operation-swapped': {
    label: 'Swapped the inputs of the defined operation',
    fix: 'In $a \\star b$, the first number replaces $a$ and the second replaces $b$. Most defined operations are not symmetric.',
  },
  'int-operation-grouping': {
    label: 'Evaluated the operations in the wrong order',
    fix: 'Work from the innermost parentheses outward, and use the result as an input of the next operation.',
  },
};
