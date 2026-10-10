# GRE Quant Trainer

A GRE Quantitative Reasoning practice app with mastery tracking, in the spirit of Khan Academy.
Every question comes from a generator, so there is an unlimited supply of new questions. When you
miss one, the same skill comes back a few questions later **in a different style with new
numbers**, until you have shown you master it.

Live site: https://ethan-puyaubreau.github.io/gre-trainer/

## What it does

- **Skills, styles and generators.** The four GRE areas (Arithmetic, Algebra, Geometry, Data
  Analysis) are split into skills. Each skill has at least 3 question styles across the four GRE
  formats (quantitative comparison, select one, select one or more, numeric entry).
- **Mastery levels.** Not started → Attempted → Familiar → Proficient → Mastered.
  - A correct answer within the GRE pace (1:45 per question) and without hints moves the skill up.
  - A correct but slow or hinted answer only counts up to Familiar.
  - Mastered requires clean answers on 3 different styles, on 2 different days.
- **Repair queue.** A miss drops the skill one level. The skill comes back 2–4 questions later in
  another style, and again the next day.
- **Spaced review.** Mastered skills come back after 3, 7, 21 and 60 days. A miss on review drops the
  skill to Proficient.
- **Traps.** Wrong answer choices come from named mistakes, such as √a − √b = √(a − b), adding
  successive percents, or forgetting that 2 is prime. When you pick one, the app tells you which
  mistake it was. The dashboard lists the traps you fall for most.
- **Pace timer.** Each practice question has a pace bar against the GRE's 1:45 per question.
- **Section test.** Section 1 has 12 questions in 21 minutes. Section 2 has 15 questions in 26
  minutes, and its difficulty is set by your Section 1 score. Both sections have:
  - mark and review screens
  - an on-screen calculator that follows the order of operations, with Transfer Display
  - a data interpretation set
- **Strategy cards** for every skill, with the shortcuts.
- **Progress** is kept in your browser's local storage. Export and import it as JSON from Settings.

## Content

| Area | Skills | Question styles | Named traps |
|---|---|---|---|
| Arithmetic | 17 | 89 | 111 |
| Algebra | 14 | 63 | 166 |
| Geometry | 9 | 39 | 141 |
| Data Analysis | 8 | 66 (7 data interpretation families) | 132 |
| **Total** | **48** | **257** | **550** |

Each style generates 1,500 verified variants (500 seeds × 3 difficulty levels). Coverage follows
the question patterns of ETS's *Official GRE Quantitative Reasoning Practice Questions* (Vol. 1,
3rd ed.) and the ETS Math Review. All questions are original: generators reuse the patterns, never
the published questions.

## Answer keys are verified

Each generator has a `check()` that recomputes the answer by an independent method: brute force,
enumeration, simulation, floating-point evaluation, or random sampling for "must be true" and "cannot
be determined" questions.

- **Full validation.** The test suite runs every generator on 150 seeds × 3 difficulty levels and checks:
  - the structure of each question and its KaTeX rendering
  - that the same seed always gives the same question
  - that questions and answers vary across seeds
  - that select-one answers are spread over positions A–E
  - the answer key against `check()`
- **Every question the app can serve is verified.** The app only serves seeds 1–500. The suite
  checks the answer key of every one of those questions, for every generator and difficulty.
- **The checks themselves are tested.** A second suite corrupts answer keys on purpose and requires
  every `check()` to reject them.

## Development

```bash
npm ci
npm run dev        # http://localhost:5173/gre-trainer/
npm test           # all tests
SEEDS=1000 npm test
npm run build      # type-check + production build into dist/
```

Writing new question styles: see [CONTENT_GUIDE.md](CONTENT_GUIDE.md).

## Deployment

`.github/workflows/deploy.yml` runs the tests and the build on every pull request. On pushes to
`main` it also deploys `dist/` to GitHub Pages. One-time setup: in the repository settings, go to
**Pages → Build and deployment → Source** and choose **GitHub Actions**.

## Stack

Vite, React 19, TypeScript, KaTeX for math, Zustand for state (persisted to localStorage), Vitest.
