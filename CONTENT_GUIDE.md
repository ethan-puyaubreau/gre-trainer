# Writing question styles

Every question in the app comes from a **template**: a function that turns a random seed into a
GRE-style question with an exact answer key. A **skill** (e.g. "Cycles & repeating patterns") has
at least 3 templates in different styles, so a missed question can come back as the same skill
in a different style with new numbers.

Reference implementations: `src/content/arithmetic/cycles.ts` and `src/content/arithmetic/roots.ts`.

## Files of an area

```
src/content/<area>/         (algebra splits these into core/ and applied/)
  skills.ts     Skill[]: id, unit, name, summary, strategy card
  traps.ts      Record<trapId, Trap>: the named mistakes distractors come from
  <topic>.ts    templates, exported as an array
  index.ts      AreaContent: { area, skills, traps, templates }
```

Ids: skills `<area-prefix>.<skill>` (`arith.cycles`, `alg.linear-equations`, `geo.triangles`,
`data.statistics`); templates `<skill id>.<style>` (`arith.cycles.decimal-digit`). Never rename an
id once shipped: saved progress refers to it.

## The Template contract (`src/engine/types.ts`)

```ts
const myTemplate: Template<MyParams> = {
  id, skill, format: 'qc' | 'mcs' | 'mcm' | 'ne', style: 'short description',
  generate(rng, difficulty) { ...; return { q, params }; },
  check(q, params, rng) { ...; return null /* ok */ or 'error message'; },
};
```

- `generate` must use only `rng` for randomness (never `Math.random`), so a seed reproduces a question.
- `difficulty`: 1 = easy, 2 = typical GRE medium, 3 = hard. Bigger numbers alone do not make a
  question harder. See "Difficulty" below.
- `check` re-derives the answer **by a different method** than `generate`: brute force, enumeration,
  floating-point evaluation, simulation, or random sampling of the allowed values. It is what
  guarantees that answer keys are right, so never just recompute with the same formula.
- For QC questions whose answer may be D, sample the allowed values in `check` and use
  `qcFromSamples` (`src/engine/build.ts`): it returns D as soon as two samples disagree.

## GRE formats

| format | rules |
|---|---|
| `qc` Quantitative comparison | `info` (centered, optional), `quantityA`, `quantityB`, `answer` A/B/C/D. Vary the answer across seeds. If both quantities are fixed numbers, D is impossible. |
| `mcs` Select one | exactly 5 choices. Numeric choices in ascending order (`numericChoices`). Only exception: when every natural wrong value falls on one side of the key (ratio parts, remaining amounts), ascending order would pin the key to one end of the list, so pass `order: 'random'` to `numericChoices` (never a hand-rolled shuffle) and say why in a comment. |
| `mcm` Select one or more | 3 to 8 choices, `instruction` like "Indicate all such values.", answer = ascending indices. |
| `ne` Numeric entry | `answer` is an exact `Frac`. It must be a terminating decimal unless `fractionBoxes: true`. Use `prefix` / `suffix` for "x + y =" or "employees". |

Builders in `src/engine/build.ts`: `qcCompare`, `qcFromSamples`, `numericChoices`, `textChoices`, `flaggedChoices`.

## Traps and distractors

Every wrong choice comes from a real mistake: subtracting under a radical, adding percents,
off-by-one term counts, forgetting that 2 is prime... Declare the mistake once in the area's
`traps.ts` (`label` = the wrong idea, `fix` = what to do instead) and tag the wrong choice with
its id (`trap` on a choice, `traps` on QC/NE). When a student picks it, the app names the mistake.

Rules for the wrong choices of `mcs` and `mcm`:

- **One named trap per wrong choice.** If you cannot name the mistake that leads to a choice, it is
  filler. Replace it with a real trap. If the question has fewer natural traps than wrong choices,
  add a step where a student can slip, instead of padding.
- **No ladders.** Do not surround the key with neighbours: `r-1, r, r+1`, `+100`, consecutive
  integers, an evenly spaced run. A value one away from the key is fine only when it is a named
  off-by-one trap, and then only one of them.
- **Every trap the explanation cites is a choice.** If the explanation says "20,400 is the
  tempting answer", then 20,400 must be among the choices (for QC and NE, in `traps`). Do not
  cite a trap that no choice shows.
- **Every choice is possible.** A units digit is 0-9, a probability is between 0 and 1, a count is
  a whole number. Choices are written as numerals ("5", not "Five").
- **Wrong is wrong.** No choice may equal the key or be equivalent to it (`1/2` and `0.5`). Check
  that the trap value really differs from the key for this seed.
- **Vary the order.** If a template builds its choices from a sorted list, shuffle them so the key
  and the shape of the options do not repeat (for example, an interval with the negative end always
  first).

## Degenerate cases to reject

When a seed produces one of these, draw again inside `generate`. Do not patch the text.

- A trap that gives the same answer as the right method (a fixed point `f(x) = x` where the
  "wrong" substitution still works).
- An identity function, `x = 0`, `x = 1` or `x = -1` as the solution, a ratio of `1:1`, a fraction
  `1/1`, a coefficient or exponent of 1 that would print, an answer of 0 when it is not the point.
- A key that breaks the stated constraint. If the question says "to the nearest 5" or "without
  exceeding", check the key against that rule, not only the arithmetic.
- An integrality test done with floating point. `Math.log(9) / Math.log(3)` is not exactly 2. Test
  with integer loops, `Frac` or an exact integer root.
- A picture or numbers that create a shortcut the problem does not state, for example two
  segments that happen to be equal.
- Unrealistic values: a ladder measured to 0.01 foot, primality checks of 137 or 143 that take
  minutes by hand.
- A range like "between 72 and 204" when its ends could be answers. Say "inclusive" or "exclusive".

## Difficulty

The three levels are not three scales of the same question. A level-3 question is harder because
of its structure. It needs at least one of:

- **chained steps**: the result of one step feeds the next, and the order matters;
- **a hidden threshold**: the relation flips at a value that the data does not show;
- **an integrality constraint**: only whole people, whole boxes, or multiples of a common value
  are allowed;
- **a worst case**: the question asks what is guaranteed, not what is typical;
- **a figure to exploit**: a symmetry, a right angle, or a known ratio makes the problem short, and
  only a student who sees it finishes in time.

A level-3 question that is solved in one direct step is a level 2. Relabel it, or make it harder.

- Level 1: one idea, applied directly, with clean numbers.
- Level 2: the typical GRE medium. Two steps, or one idea with a trap.
- Level 3: one of the five features above, plus a trap that matches it.

At the same seed, levels 1, 2 and 3 must not give the same question, and level 3 must be harder
than level 1. Watch for identities (`x = x`), special values that collapse the question, and
"closest to -0.5" when 0 is a choice.

## Bank size and QC balance

- Each template should give at least **100 distinct questions per difficulty** over the 500
  served seeds. If a template varies only by its numbers, add structures: other phrasings,
  other contexts, other sub-cases. Template families with 10 to 25 distinct questions are too small.
- Do not duplicate the content of another template. Two styles of the same skill must test
  different things.
- In QC, D ("cannot be determined") is the answer of about **20 to 25%** of questions. Spread
  A, B and C evenly over the rest. A QC template that can never return D needs a reason (for
  example, both quantities are fixed numbers).
- The D case must be real: sample values allowed by the stated constraints (use `qcFromSamples`),
  and show two that disagree. Do not build D from identities.

## Rich text rules (checked by the tests)

- Math goes between `$...$`; display math between `$$...$$`. Paragraphs are separated by a blank line.
  Lines starting with `- ` are bullets.
- Money: always `usd(18)` (renders `\$18`). A bare `$` starts math mode.
- Negative numbers always inside math (`$-7$`), otherwise they render with a hyphen.
- Numbers ≥ 1,000 get commas: `num(12000)` inside math, `plain(12000)` in text.
- Helpers: `num`, `fr`, `usd`, `plain`, `sqrt`, `poly`, `lin`, `paren`, `ordinal`, `clock` in `src/engine/tex.ts`.
- `Frac` (`src/engine/frac.ts`) for all exact arithmetic; `src/engine/math.ts` for gcd/lcm/primes/etc.

## Clean generated text

A generated sentence must read as if a person wrote it. These rules are not all enforced by tests
yet, so check them yourself.

- Never print a leftover of the generator: a coefficient `1` (`1n`, `1x`, `-1x`), an exponent `1`
  (`r^1`), a denominator `1` (`\frac{4}{1}`, `1/1`), a doubled sign (`N - -2`, write `N + 2`),
  `c = 7 = 7`, `x = -9 and x = -9`, or a dropped operator.
- Agree the unit with the number: "1 year", not "1 years"; "1 foot", not "1 feet". Start a
  sentence with a capital only at its start ("So the greater prime", not "So The greater prime").
- Read at least two generated questions out loud before you commit.

## Explanations

An explanation is a small lesson, not only an answer key. Write **60 to 110 words** (a formula counts as one word), in this order:

1. **Recognize.** One sentence on the sign that tells you what kind of problem this is.
2. **Steps, with the reason.** The fastest correct method first (a sign, a comparison, a parity
   argument), the calculation after. Say why each step is allowed. Use the actual numbers of the
   question.
3. **Check.** Substitute the answer, or test a limit case, in one line.
4. **Trap.** Name the wrong value, say why it is tempting, and refute it with a number
   ($\sqrt{9}-\sqrt{4}=1$, not $\sqrt{5}$). The wrong value must be one of the choices.
5. **General rule.** One sentence the student can reuse.

Rules:

- Do not teach a slogan that causes a trap. "The term changes sign" is the source of the
  move-term sign mistake. Say what is done to both sides.
- If you state a rule, show why it works: one counter-example is enough. Say why a remainder of 0
  means the last item of the cycle.
- Say only what is true for this seed. Re-read the explanation against a level 1 and a level 3
  question. For D in a QC, test values that satisfy the stated conditions (if `m > 0`, do not test
  `m = -1`), and give two that disagree. Do not conclude from a single test.
- If the key comes from the code's own rule ("the farthest from zero on the same side"), say that
  rule, not a different one.

A good example, written for a template of `arith.cycles` (106 words):

> Last digit of a huge power: look for a cycle.
>
> A product's last digit depends only on its factors' last digits, so use $3^{58}$ for $13^{58}$.
> Powers of 3 end in 3, 9, 7, 1. After 1, times 3 gives 3 again, so the cycle repeats every 4
> powers. As $58 = 4 \cdot 14 + 2$, we land on the second term, 9.
>
> Check: $3^6 = 729$ ends in 9, and 6 leaves remainder 2.
>
> Trap: 4, from $3 \times 58$, tempts. But $3^2 = 9$, not 6: an exponent counts factors.
>
> For a cycle of length $k$, divide the position by $k$. Remainder 0 means whole cycles are done,
> so you stand on the last term.

## Figures

Set `figure` (or an array of figures) on the question. Kinds: `numberLine`, `geometry` (named points,
segments, polygons, circles, right-angle and angle marks, labels, optional axes/lines/curves,
`notToScale`), `table`, `bar`, `line`, `pie`, `scatter`, `histogram`, `boxplot`. See `src/engine/types.ts`.

A figure must never contradict its labels. Draw it from the same numbers as the labels, or set
`notToScale`. A segment labelled 10 must not look shorter than one labelled 6.

## Data interpretation sets

On the GRE, 2-3 questions share one table or graph. To make a family, give 2+ templates the same
`set: '<family name>'` and build the dataset FIRST in `generate()`, with one shared function and
the same rng calls (e.g. `const data = makeSalesData(rng, difficulty)` as the very first line).
Templates of a family share a random stream, so for a given seed they draw the same dataset;
the section test shows them together as "Questions 10 to 12 are based on the following data."
A test checks that all templates of a family produce identical figures for the same seed.

## Testing

```
npx vitest run content                                  # every template, all areas
npx vitest run content-arithmetic                       # one area (content-algebra, -geometry, -data)
ONLY=arith.cycles npx vitest run content-arithmetic     # focus on some templates
SEEDS=600 npx vitest run content                        # deeper full validation
npx vitest run mutation                                 # checks must reject corrupted answer keys
PRINT=1 ONLY=<template id> SEED=4 npx vitest run zz-sample   # print sample questions
```

For each template the suite checks, on the first 150 seeds × 3 difficulties: structure, KaTeX
rendering, `check()`, determinism, variety, and (select-one) that the answer position is spread
over A–E. It also runs `check()` on every seed up to `SEED_POOL` (500): the app only serves
those seeds, so every question a student can see has a verified answer key.

The tests do not judge the teaching. Before you commit, print two seeds at each difficulty
(`zz-sample`) and read the question, the choices and the explanation as a student would.

## Originality

Questions must be original: generators may follow the patterns of official material but must
never reproduce a published question verbatim.

The hard official questions use a small set of mathematical patterns (an archetype). You may
build a style on an archetype. You may not copy an item: write a new story, new numbers, a new
figure and new choices. Do not quote ETS wording in code, comments or explanations. If your
question could be mistaken for a published one, change it until it cannot.
