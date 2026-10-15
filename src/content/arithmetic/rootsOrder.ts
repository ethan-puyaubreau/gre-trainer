import type { Template, Trap } from '../../engine/types';

export const rootsOrderTraps: Record<string, Trap> = {
  'root-compare-radicand': {
    label: 'Compared only the numbers under the radical',
    fix: 'A coefficient multiplies the whole root: $c\\sqrt{r} = \\sqrt{c^2 r}$. Compare $c^2 r$, not $r$: $2\\sqrt{3} = \\sqrt{12}$ is larger than $\\sqrt{7}$.',
  },
  'root-compare-coefficient': {
    label: 'Compared only the coefficients',
    fix: 'The radicand matters too. Move the coefficient inside, $c\\sqrt{r} = \\sqrt{c^2 r}$ (or $\\sqrt[3]{c^3 r}$ for a cube root), or estimate each value.',
  },
};

interface Item {
  c: number;
  r: number;
  index: 2 | 3;
}
interface Params {
  items: Item[];
  kind: 'greatest' | 'least';
}

const tex = ({ c, r, index }: Item) => `${c === 1 ? '' : c}${index === 2 ? `\\sqrt{${r}}` : `\\sqrt[3]{${r}}`}`;
const val = ({ c, r, index }: Item) => c * Math.pow(r, 1 / index);
const isPower = (n: number, k: number) => Math.abs(Math.round(Math.pow(n, 1 / k)) ** k - n) < 1e-9;

const orderRoots: Template<Params> = {
  id: 'arith.roots.order-mcs',
  skill: 'arith.roots',
  format: 'mcs',
  style: 'greatest or least of several radicals with coefficients',
  generate(rng, d) {
    const kind = rng.pick(['greatest', 'least'] as const);
    const gap = d === 1 ? 0.4 : d === 2 ? 0.25 : 0.12;
    const extreme = kind === 'greatest' ? 'largest' : 'smallest';
    for (;;) {
      const items: Item[] = [];
      for (let i = 0; i < 5; i++) {
        const cube = d > 1 && i < 2 && rng.chance(0.9);
        items.push(
          cube
            ? { c: rng.int(1, 4), r: rng.int(2, 40), index: 3 }
            : { c: rng.int(1, d === 1 ? 7 : 9), r: rng.int(2, d === 1 ? 30 : 45), index: 2 },
        );
      }
      if (items.some((it) => isPower(it.r, it.index))) continue;
      const vals = items.map(val);
      const sorted = [...vals].sort((a, b) => a - b);
      if (sorted.some((v, i) => i > 0 && v - sorted[i - 1] < gap)) continue;
      const best = vals.indexOf(kind === 'greatest' ? sorted[4] : sorted[0]);
      const pickBy = (f: (it: Item) => number) => {
        const fs = items.map(f);
        const m = kind === 'greatest' ? Math.max(...fs) : Math.min(...fs);
        return fs.filter((x) => x === m).length === 1 ? fs.indexOf(m) : -1;
      };
      const byRad = pickBy((it) => it.r);
      const byCoef = pickBy((it) => it.c);
      if (byRad < 0 || byCoef < 0 || byRad === byCoef || byRad === best || byCoef === best) continue;
      if (items.every((it) => it.c === 1) || new Set(items.map(tex)).size < 5) continue;
      const order = rng.shuffle([0, 1, 2, 3, 4]);
      const choices = order.map((i) => ({
        text: `$${tex(items[i])}$`,
        ...(i === byRad ? { trap: 'root-compare-radicand' } : i === byCoef ? { trap: 'root-compare-coefficient' } : {}),
      }));
      const shown = order.map((i) => `$${tex(items[i])} \\approx ${val(items[i]).toFixed(2)}$`).join(', ');
      const frames = [`Which of the following is the ${kind}?`, `Which of the following numbers is the ${kind}?`];
      return {
        params: { items: order.map((i) => items[i]), kind },
        q: {
          format: 'mcs',
          stem: frames[rng.int(0, 1)],
          choices,
          answer: order.indexOf(best),
          explanation: `Both the coefficient and the radicand change the size of a root, so put every number on the same footing.

${d === 1 ? 'Move each coefficient under the radical, $c\\sqrt{r} = \\sqrt{c^2 r}$, and compare radicands, or estimate:' : 'Cube roots and square roots cannot share one radical, so estimate each value:'} ${shown}.

The ${kind} is $${tex(items[best])}$.

Trap: the ${extreme} radicand, $${tex(items[byRad])}$, and the ${extreme} coefficient, $${tex(items[byCoef])}$, each ignore the other factor.`,
        },
      };
    }
  },
  check(q, { items, kind }) {
    if (q.format !== 'mcs') return 'wrong format';
    const v = items.map((it) => it.c * (it.index === 2 ? Math.sqrt(it.r) : Math.cbrt(it.r)));
    const m = kind === 'greatest' ? Math.max(...v) : Math.min(...v);
    const hits = v.map((x, i) => (Math.abs(x - m) < 1e-9 ? i : -1)).filter((i) => i >= 0);
    return hits.length === 1 && hits[0] === q.answer ? null : `answer should be ${hits}`;
  },
};

export const rootsOrderTemplates = [orderRoots];
