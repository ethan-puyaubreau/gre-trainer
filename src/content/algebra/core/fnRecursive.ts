import { Frac } from '../../../engine/frac';
import { lin, num, paren } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { trapChoices } from './util';

/** Value of a function defined by a recursive rule (select one). */
interface RecParams {
  name: string;
  a: number;
  p: number;
  q: number;
  k: number;
  values: number[];
}

const step = (p: number, q: number, x: number) => p * x + q;
function terms(a: number, p: number, q: number, k: number, qq = q): number[] {
  const out = [a];
  for (let i = 1; i < k + 1; i++) out.push(step(p, qq, out[i - 1]));
  return out; // out[i] = f(i + 1)
}

const recursiveMCS: Template<RecParams> = {
  id: 'alg.functions.recursive-mcs',
  skill: 'alg.functions',
  format: 'mcs',
  style: 'value of a function defined by a recursive rule',
  generate(rng, d) {
    for (;;) {
      const name = rng.pick(['f', 'g', 'h']);
      const sg = () => rng.pick([-1, 1]);
      let a: number;
      let p: number;
      let q: number;
      let k: number;
      if (d === 1) {
        a = rng.int(1, 6);
        p = 2;
        q = rng.int(1, 6);
        k = rng.int(4, 5);
      } else if (d === 2) {
        a = sg() * rng.int(1, 6);
        p = rng.pick([2, 3, 4]);
        q = sg() * rng.int(1, 7);
        k = rng.int(4, 5);
      } else {
        a = sg() * rng.int(1, 5);
        p = -rng.int(2, 3);
        q = sg() * rng.int(1, 8);
        k = rng.int(5, 6);
      }
      const seq = terms(a, p, q, k);
      const key = seq[k - 1];
      const traps = [
        { value: seq[k], trap: 'alg-fnrec-extra-step' },
        { value: seq[k - 2], trap: 'alg-fnrec-missed-step' },
        { value: terms(a, p, -q, k)[k - 1], trap: 'alg-fnrec-sign' },
        { value: a + (k - 1) * (seq[1] - a), trap: 'alg-fnrec-linear' },
        { value: a * p ** (k - 1), trap: 'alg-fnrec-drop-constant' },
      ];
      const res = trapChoices(rng, key, traps, (v) => `$${num(v)}$`);
      if (!res) continue;
      const cited = res.kept[0];
      const line = seq
        .slice(1, k)
        .map((v, i) => `$${name}(${i + 2}) = ${paren(p)}\\cdot ${paren(seq[i])} ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${num(v)}$`)
        .join(', ');
      const trapText: Record<string, string> = {
        'alg-fnrec-extra-step': `going one step too far leads to $${num(cited.value)}$, the value of $${name}(${k + 1})$`,
        'alg-fnrec-missed-step': `stopping one step early leads to $${num(cited.value)}$, the value of $${name}(${k - 1})$`,
        'alg-fnrec-sign': `flipping the sign of the constant term leads to $${num(cited.value)}$`,
        'alg-fnrec-linear': `assuming a constant difference between terms leads to $${num(cited.value)}$, but the differences keep changing`,
        'alg-fnrec-drop-constant': `repeating only the multiplication leads to $${num(cited.value)}$, which drops the constant each time`,
      };
      const explanation = `A recursive rule gives each term from the one before, so build the list from $${name}(1) = ${num(a)}$ up to $${name}(${k})$.

${line}. The value wanted is $${name}(${k}) = ${num(key)}$.

Check: the last step uses the term before it, $${num(seq[k - 2])}$: $${paren(p)}\\cdot ${paren(seq[k - 2])} ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${num(key)}$.

Trap: ${trapText[cited.trap]}. Rule: from $${name}(1)$ to $${name}(${k})$ the rule is used ${k - 1} times.`;
      return {
        q: {
          format: 'mcs',
          stem: `The function $${name}$ is defined for positive integers $n$ by $${name}(1) = ${num(a)}$ and $${name}(n + 1) = ${lin([[p, `${name}(n)`], [q, '']])}$. What is the value of $${name}(${k})$?`,
          choices: res.choices,
          answer: res.answer,
          explanation,
        },
        params: { name, a, p, q, k, values: res.values.map((v) => v.n) },
      };
    }
  },
  check(q, { a, p, q: c, k, values }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (values.some((v, i) => q.choices[i].text !== `$${num(v)}$`)) return 'choice text mismatch';
    // closed form: f(n) + c/(p-1) = p^(n-1) (a + c/(p-1))
    const s = new Frac(c, p - 1);
    let pw = new Frac(1);
    for (let i = 0; i < k - 1; i++) pw = pw.mul(p);
    const f = pw.mul(s.add(a)).sub(s);
    const hits = values.flatMap((v, i) => (f.eq(v) ? [i] : []));
    return hits.length === 1 && hits[0] === q.answer ? null : `closed form ${f.toTex()}, hits ${hits}`;
  },
};

export const recursiveTemplates = [recursiveMCS];

export const recursiveTraps: Record<string, Trap> = {
  'alg-fnrec-extra-step': {
    label: 'Applied the rule one time too many',
    fix: 'Going from $f(1)$ to $f(k)$ uses the rule $k - 1$ times, not $k$ times.',
  },
  'alg-fnrec-missed-step': {
    label: 'Stopped one term early',
    fix: 'List the terms $f(1), f(2), \\ldots$ and stop at the index asked for: $f(k)$, not $f(k-1)$.',
  },
  'alg-fnrec-sign': {
    label: 'Changed the sign of the constant in the rule',
    fix: 'Copy the rule exactly as written: if it adds a constant, each step adds it.',
  },
  'alg-fnrec-linear': {
    label: 'Assumed the terms grow by a constant difference',
    fix: 'A rule that multiplies the previous term does not add the same amount each time. Compute every term in turn.',
  },
  'alg-fnrec-drop-constant': {
    label: 'Forgot the added constant at each step',
    fix: 'Each step multiplies and then adds the constant; the constant also gets multiplied in the later steps.',
  },
};
