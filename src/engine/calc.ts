// Evaluation logic of the on-screen calculator (order of operations, 8-digit display).

export type Tok = number | '+' | '-' | '*' | '/' | '(' | ')';

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export function evaluate(tokens: Tok[]): number {
  const out: Tok[] = [];
  const ops: Tok[] = [];
  for (const t of tokens) {
    if (typeof t === 'number') out.push(t);
    else if (t === '(') ops.push(t);
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
      if (!ops.length) throw new Error('paren');
      ops.pop();
    } else {
      while (ops.length && ops[ops.length - 1] !== '(' && PREC[ops[ops.length - 1] as string] >= PREC[t]) out.push(ops.pop()!);
      ops.push(t);
    }
  }
  while (ops.length) {
    const o = ops.pop()!;
    if (o === '(') throw new Error('paren');
    out.push(o);
  }
  const st: number[] = [];
  for (const t of out) {
    if (typeof t === 'number') st.push(t);
    else {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) throw new Error('syntax');
      if (t === '/' && b === 0) throw new Error('div0');
      st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : a / b);
    }
  }
  if (st.length !== 1) throw new Error('syntax');
  return st[0];
}

export function formatCalc(x: number): string {
  if (!Number.isFinite(x) || Math.abs(x) >= 1e8) return 'Error';
  if (Math.abs(x) < 1e-7) return '0';
  // up to 8 significant digits, like the GRE calculator display
  const digits = Math.max(0, 7 - Math.floor(Math.log10(Math.abs(x))));
  const s = x.toFixed(Math.min(7, digits));
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
