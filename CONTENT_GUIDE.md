# Writing question styles

Every question in the app comes from a **template**: a function that turns a random seed into a
GRE-style question with an exact answer key. A **skill** (e.g. "Cycles & repeating patterns") has
at least 3 templates in different styles, so a missed question can come back as the same skill
in a different style with new numbers.

Reference implementations: `src/content/arithmetic/cycles.ts` and `src/content/arithmetic/roots.ts`.

## Files of an area

```
src/content/<area>/
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
- `difficulty`: 1 = easy, 2 = typical GRE medium, 3 = hard (bigger numbers, an extra step, a subtler trap).
- `check` re-derives the answer **by a different method** than `generate`: brute force, enumeration,
  floating-point evaluation, simulation, or random sampling of the allowed values. It is what
  guarantees that answer keys are right, so never just recompute with the same formula.
- For QC questions whose answer may be D, sample the allowed values in `check` and use
  `qcFromSamples` (`src/engine/build.ts`): it returns D as soon as two samples disagree.

## GRE formats

| format | rules |
|---|---|
| `qc` Quantitative comparison | `info` (centered, optional), `quantityA`, `quantityB`, `answer` A/B/C/D. Vary the answer across seeds. If both quantities are fixed numbers, D is impossible. |
| `mcs` Select one | exactly 5 choices. Numeric choices in ascending order (`numericChoices`). |
| `mcm` Select one or more | 3 to 8 choices, `instruction` like "Indicate all such values.", answer = ascending indices. |
| `ne` Numeric entry | `answer` is an exact `Frac`. It must be a terminating decimal unless `fractionBoxes: true`. Use `prefix` / `suffix` for "x + y =" or "employees". |

Builders in `src/engine/build.ts`: `qcCompare`, `qcFromSamples`, `numericChoices`, `textChoices`, `flaggedChoices`.

## Traps

Every wrong choice should come from a real mistake when possible: subtracting under a radical,
adding percents, off-by-one term counts, forgetting that 2 is prime... Declare the mistake once in
the area's `traps.ts` (`label` = the wrong idea, `fix` = what to do instead) and tag the wrong
choice with its id (`trap` on a choice, `traps` on QC/NE). When a student picks it, the app names
the mistake.

## Rich text rules (checked by the tests)

- Math goes between `$...$`; display math between `$$...$$`. Paragraphs are separated by a blank line.
  Lines starting with `- ` are bullets.
- Money: always `usd(18)` (renders `\$18`). A bare `$` starts math mode.
- Negative numbers always inside math (`$-7$`), otherwise they render with a hyphen.
- Numbers ≥ 1,000 get commas: `num(12000)` inside math, `plain(12000)` in text.
- Helpers: `num`, `fr`, `usd`, `plain`, `sqrt`, `poly`, `lin`, `paren`, `ordinal`, `clock` in `src/engine/tex.ts`.
- `Frac` (`src/engine/frac.ts`) for all exact arithmetic; `src/engine/math.ts` for gcd/lcm/primes/etc.

## Explanations

Short, like the GRE answer explanations: the fastest correct method first, then a sentence on the
trap. Use the actual numbers of the question.

## Figures

Set `figure` (or an array of figures) on the question. Kinds: `numberLine`, `geometry` (named points,
segments, polygons, circles, right-angle and angle marks, labels, optional axes/lines/curves,
`notToScale`), `table`, `bar`, `line`, `pie`, `scatter`, `histogram`, `boxplot`. See `src/engine/types.ts`.

## Testing

```
npx vitest run tests/content.test.ts                    # every template, 150 seeds x 3 difficulties
ONLY=arith.cycles npx vitest run tests/content.test.ts  # focus on some templates
SEEDS=1000 npx vitest run tests/content.test.ts         # deeper run
npx vitest run tests/mutation.test.ts                   # checks must reject corrupted answer keys
```

The suite checks structure, KaTeX rendering, determinism, variety, and `check()` on every seed.

## Originality

Questions must be original: generators may follow the patterns of official material but must
never reproduce a published question verbatim.
