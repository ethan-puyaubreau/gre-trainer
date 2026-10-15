import { sum } from '../../../engine/math';
import type { Template, Trap } from '../../../engine/types';
import { expectMcsBy, spreadChoices } from './util';

export const missingDigitTraps: Record<string, Trap> = {
  'int-digit-smallest-only': {
    label: 'Stopped at the smallest digit that works',
    fix: 'The question asks about every digit that makes the number divisible. After the first one, keep testing the other digits 0 to 9.',
  },
  'int-digit-largest-only': {
    label: 'Kept only the largest digit that works',
    fix: 'Add up every digit that works, not just one of them. List all the digits that pass before you add.',
  },
  'int-digit-count-not-sum': {
    label: 'Counted the valid digits instead of adding them',
    fix: 'Read the last line of the question: "sum of all possible values of $d$" means add the digits, not count them.',
  },
  'int-digit-partial-test': {
    label: 'Applied only one of the divisibility tests',
    fix: 'A number divisible by 12 must pass the test for 3 AND the test for 4 (same idea for 6, 15, 24, 30). Keep only the digits that pass both.',
  },
  'int-digit-either-test': {
    label: 'Accepted a digit that passes either test',
    fix: 'Divisibility by a composite number needs every test at once. A digit that passes one test and fails the other does not work.',
  },
  'int-digit-wrong-rule': {
    label: 'Used the digit-sum test where it does not apply',
    fix: 'The digit-sum test works only for 3 and 9. Divisibility by 4 looks at the last two digits, and by 8 at the last three.',
  },
  'int-digit-complement': {
    label: 'Set d equal to the known digit sum instead of completing it',
    fix: 'If the known digits add to $S$, you need $S + d$ to be a multiple of 3, so $d$ makes up the difference: $d \\equiv -S \\pmod 3$, not $d \\equiv S$.',
  },
};

type Rule = 'r0' | 'r2' | 'r3' | 'r4' | 'r5' | 'r8';
const last = (ds: number[], k: number) => ds.slice(-k).reduce((s, x) => s * 10 + x, 0);
const RULES: Record<Rule, (ds: number[]) => boolean> = {
  r0: (ds) => ds[ds.length - 1] === 0,
  r2: (ds) => ds[ds.length - 1] % 2 === 0,
  r3: (ds) => sum(ds) % 3 === 0,
  r4: (ds) => last(ds, 2) % 4 === 0,
  r5: (ds) => ds[ds.length - 1] % 5 === 0,
  r8: (ds) => last(ds, 3) % 8 === 0,
};
const RULE_LINE: Record<Rule, string> = {
  r0: 'a multiple of 10 ends in 0',
  r2: 'a multiple of 2 ends in an even digit',
  r3: 'a multiple of 3 has a digit sum that is a multiple of 3',
  r4: 'a multiple of 4 has its last two digits forming a multiple of 4',
  r5: 'a multiple of 5 ends in 0 or 5',
  r8: 'a multiple of 8 has its last three digits forming a multiple of 8',
};
const WINDOW: Record<Rule, number> = { r0: 1, r2: 1, r3: 99, r4: 2, r5: 1, r8: 3 };

interface Weak {
  trap: string;
  test: (ds: number[], d: number) => boolean;
}
const only = (r: Rule, trap = 'int-digit-partial-test'): Weak => ({ trap, test: (ds) => RULES[r](ds) });
const either = (a: Rule, b: Rule): Weak => ({ trap: 'int-digit-either-test', test: (ds) => RULES[a](ds) || RULES[b](ds) });
const complement: Weak = { trap: 'int-digit-complement', test: (ds, d) => (sum(ds) - 2 * d) % 3 === 0 };

interface Kind {
  m: number;
  rules: Rule[];
  weak: Weak[];
}
const KINDS: Record<string, Kind> = {
  three: { m: 3, rules: ['r3'], weak: [complement] },
  four: { m: 4, rules: ['r4'], weak: [only('r3', 'int-digit-wrong-rule'), only('r2')] },
  six: { m: 6, rules: ['r2', 'r3'], weak: [only('r2'), only('r3'), either('r2', 'r3')] },
  eight: { m: 8, rules: ['r8'], weak: [only('r4'), only('r3', 'int-digit-wrong-rule')] },
  twelve: { m: 12, rules: ['r3', 'r4'], weak: [only('r3'), only('r4'), either('r3', 'r4')] },
  twentyfour: { m: 24, rules: ['r3', 'r8'], weak: [only('r3'), only('r8'), either('r3', 'r8')] },
  fifteen: { m: 15, rules: ['r3', 'r5'], weak: [only('r3'), only('r5'), either('r3', 'r5')] },
  thirty: { m: 30, rules: ['r0', 'r3'], weak: [only('r0'), only('r3'), either('r0', 'r3')] },
};
const BY_DIFF: Record<number, string[]> = {
  1: ['three', 'three', 'four'],
  2: ['four', 'six', 'eight', 'six'],
  3: ['twelve', 'twentyfour', 'fifteen', 'thirty'],
};

interface P {
  kind: string;
  digits: number[]; // -1 marks the blank
}

const fmt = (ds: number[]) => {
  const s = ds.map((x) => (x < 0 ? '\\boxed{d}' : String(x)));
  return s.map((c, i) => (i > 0 && (s.length - i) % 3 === 0 ? `{,}${c}` : c)).join('');
};
const fill = (ds: number[], d: number) => ds.map((x) => (x < 0 ? d : x));
const valid = (ds: number[], pass: (f: number[], d: number) => boolean) => {
  const out: number[] = [];
  for (let d = ds[0] < 0 ? 1 : 0; d <= 9; d++) if (pass(fill(ds, d), d)) out.push(d);
  return out;
};

const SAYS: Record<string, (v: number) => string> = {
  'int-digit-partial-test': (v) => `Applying only one of the tests gives $${v}$, but the number must pass both.`,
  'int-digit-either-test': (v) => `Accepting a digit that passes either test gives $${v}$, but each test must hold at once.`,
  'int-digit-wrong-rule': (v) => `Using the digit sum where the rule looks at the last digits gives $${v}$.`,
  'int-digit-complement': (v) => `Setting $d$ equal to the known digit sum, instead of completing it, gives $${v}$.`,
  'int-digit-smallest-only': (v) => `Stopping at the smallest digit gives $${v}$, but every digit that works counts.`,
  'int-digit-largest-only': (v) => `Keeping only the largest digit gives $${v}$, but every digit that works counts.`,
  'int-digit-count-not-sum': (v) => `Counting the digits gives $${v}$, but the question asks for their sum.`,
};

const missingDigit: Template<P> = {
  id: 'arith.divisibility.missing-digit',
  skill: 'arith.divisibility',
  format: 'mcs',
  style: 'sum of all digits that make a number with a blank digit divisible by m (digit tests)',
  generate(rng, diff) {
    for (;;) {
      const kind = rng.pick(BY_DIFF[diff]);
      const K = KINDS[kind];
      const len = diff === 1 ? 4 : diff === 2 ? 5 : rng.int(5, 6);
      const win = Math.max(...K.rules.map((r) => WINDOW[r]));
      const pos = len - 1 - rng.int(0, Math.min(win, len) - 1);
      const digits = Array.from({ length: len }, (_, i) => (i === pos ? -1 : rng.int(i === 0 ? 1 : 0, 9)));
      const ok = valid(digits, (f) => K.rules.every((r) => RULES[r](f)));
      if (ok.length < 2) continue;
      const correct = sum(ok);
      const cands: { v: number; trap: string }[] = [
        ...K.weak.map((w) => ({ v: sum(valid(digits, w.test)), trap: w.trap })),
        { v: ok[0], trap: 'int-digit-smallest-only' },
        { v: ok[ok.length - 1], trap: 'int-digit-largest-only' },
        { v: ok.length, trap: 'int-digit-count-not-sum' },
      ].filter((c) => c.v > 0);
      let res;
      try {
        res = spreadChoices(rng, correct, rng.shuffle(cands), (v) => `$${v}$`, 5, 'shuffled');
      } catch {
        continue;
      }
      const cite = res.choices.find((_, i) => i !== res.answer)!;
      const cv = Number(cite.text.replace(/\$/g, ''));
      const known = sum(digits.filter((x) => x >= 0));
      const lines = K.rules.map((r) => {
        const pass = valid(digits, (f) => RULES[r](f));
        return `Since ${RULE_LINE[r]}, ${r === 'r3' ? `the known digits add to ${known} and $d$ must complete a multiple of 3, so ` : ''}$d$ can be ${pass.join(', ')}.`;
      });
      const example = fill(digits, ok[0]).reduce((s, x) => s * 10 + x, 0);
      const explanation = `A blank digit and a divisibility condition: use the digit tests, one per factor.

${lines.join(' ')}${K.rules.length > 1 ? ` Both must hold, which leaves $d$ = ${ok.join(', ')}.` : ''} The sum is ${ok.join(' + ')} = ${correct}.

Check: with $d = ${ok[0]}$ the number is ${example.toLocaleString('en-US')}, and ${example.toLocaleString('en-US')} / ${K.m} = ${example / K.m}.

Trap: ${SAYS[cite.trap!](cv)}`;
      return {
        params: { kind, digits },
        q: {
          format: 'mcs',
          stem: `A digit $d$ is written in the blank so that the integer $${fmt(digits)}$ is divisible by ${K.m}. What is the sum of all possible values of $d$?`,
          choices: res.choices,
          answer: res.answer,
          explanation,
        },
      };
    }
  },
  check(q, { kind, digits }) {
    const m = KINDS[kind].m;
    let t = 0;
    for (let d = digits[0] < 0 ? 1 : 0; d <= 9; d++) if (Number(fill(digits, d).join('')) % m === 0) t += d;
    return expectMcsBy(q, (i) => q.format === 'mcs' && q.choices[i].text === `$${t}$`);
  },
};

export const missingDigitTemplates: Template<any>[] = [missingDigit];
