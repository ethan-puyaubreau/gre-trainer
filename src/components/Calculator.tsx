import { useCallback, useEffect, useRef, useState } from 'react';

// A GRE-style on-screen calculator: four operations with order of operations, parentheses,
// square root, sign change, memory, and "Transfer Display" for numeric entry questions.

type Tok = number | '+' | '-' | '*' | '/' | '(' | ')';

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

const OPS_TEXT: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷', '(': '(', ')': ')' };

export function Calculator({ onClose, onTransfer }: { onClose: () => void; onTransfer?: (value: string) => void }) {
  const [tokens, setTokens] = useState<Tok[]>([]);
  const [entry, setEntry] = useState('0');
  const [fresh, setFresh] = useState(true); // next digit replaces the entry
  const [mem, setMem] = useState(0);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const entryValue = () => Number(entry);
  const lastTok = tokens[tokens.length - 1];

  const digit = useCallback(
    (d: string) => {
      setError(false);
      if (fresh) {
        setEntry(d === '.' ? '0.' : d);
        setFresh(false);
        return;
      }
      if (d === '.' && entry.includes('.')) return;
      if (entry.replace(/[-.]/g, '').length >= 8) return;
      setEntry(entry === '0' && d !== '.' ? d : entry + d);
    },
    [entry, fresh],
  );

  const op = useCallback(
    (o: '+' | '-' | '*' | '/') => {
      if (error) return;
      // replace a trailing operator if no number was typed after it
      if (fresh && typeof lastTok === 'string' && lastTok !== ')' && lastTok !== '(') {
        setTokens([...tokens.slice(0, -1), o]);
        return;
      }
      const next: Tok[] = lastTok === ')' && fresh ? [...tokens, o] : [...tokens, entryValue(), o];
      setTokens(next);
      setFresh(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tokens, entry, fresh, error],
  );

  const equals = useCallback(() => {
    if (error) return;
    const seq: Tok[] = lastTok === ')' && fresh ? tokens : [...tokens, entryValue()];
    // auto-close parentheses
    let open = 0;
    for (const t of seq) open += t === '(' ? 1 : t === ')' ? -1 : 0;
    const full = [...seq, ...Array<Tok>(Math.max(0, open)).fill(')')];
    try {
      const v = evaluate(full);
      const s = formatCalc(v);
      if (s === 'Error') throw new Error('range');
      setEntry(s);
      setTokens([]);
      setFresh(true);
    } catch {
      setError(true);
      setTokens([]);
      setEntry('0');
      setFresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, entry, fresh, error]);

  const press = useCallback(
    (k: string) => {
      switch (k) {
        case 'C':
          setTokens([]);
          setEntry('0');
          setFresh(true);
          setError(false);
          return;
        case 'CE':
          setEntry('0');
          setFresh(true);
          setError(false);
          return;
        case '±':
          if (entry !== '0') setEntry(entry.startsWith('-') ? entry.slice(1) : '-' + entry);
          return;
        case '√': {
          const v = entryValue();
          if (v < 0) {
            setError(true);
            return;
          }
          setEntry(formatCalc(Math.sqrt(v)));
          setFresh(true);
          return;
        }
        case '(':
          if (!fresh || lastTok === ')') return;
          setTokens([...tokens, '(']);
          return;
        case ')': {
          let open = 0;
          for (const t of tokens) open += t === '(' ? 1 : t === ')' ? -1 : 0;
          if (open <= 0) return;
          setTokens(lastTok === ')' && fresh ? [...tokens, ')'] : [...tokens, entryValue(), ')']);
          setFresh(true);
          return;
        }
        case 'MR':
          setEntry(formatCalc(mem));
          setFresh(true);
          return;
        case 'MC':
          setMem(0);
          return;
        case 'M+':
          setMem(mem + entryValue());
          setFresh(true);
          return;
        case '=':
          equals();
          return;
        case '+':
        case '-':
        case '*':
        case '/':
          op(k);
          return;
        default:
          digit(k);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry, fresh, tokens, mem, digit, op, equals],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = { Enter: '=', '=': '=', Escape: 'C', Backspace: 'CE', x: '*', X: '*' };
      const k = map[e.key] ?? e.key;
      if (/^[0-9.]$/.test(k) || ['+', '-', '*', '/', '(', ')', '=', 'C', 'CE'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        press(k);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [press]);

  const exprText = tokens.map((t) => (typeof t === 'number' ? formatCalc(t) : OPS_TEXT[t])).join(' ');
  const keys: [string, string?][] = [
    ['MR', 'op'],
    ['MC', 'op'],
    ['M+', 'op'],
    ['(', 'op'],
    [')', 'op'],
    ['7'],
    ['8'],
    ['9'],
    ['/', 'op'],
    ['C', 'op'],
    ['4'],
    ['5'],
    ['6'],
    ['*', 'op'],
    ['CE', 'op'],
    ['1'],
    ['2'],
    ['3'],
    ['-', 'op'],
    ['√', 'op'],
    ['±', 'op'],
    ['0'],
    ['.'],
    ['+', 'op'],
    ['=', 'eq'],
  ];
  return (
    <div className="calc" ref={ref} tabIndex={-1} role="dialog" aria-label="Calculator">
      <div className="calc-head">
        Calculator {mem !== 0 && <span className="chip" style={{ marginLeft: 8 }}>M</span>}
        <span className="spacer" />
        <button className="btn btn-ghost" onClick={onClose} aria-label="Close calculator">
          ✕
        </button>
      </div>
      <div className="calc-display" aria-live="polite">
        <div className="calc-expr">{exprText}</div>
        {error ? 'Error' : entry}
      </div>
      <div className="calc-grid">
        {keys.map(([k, cls]) => (
          <button key={k} className={cls} onClick={() => press(k)}>
            {OPS_TEXT[k] ?? k}
          </button>
        ))}
      </div>
      {onTransfer && (
        <button className="btn calc-transfer" onClick={() => !error && onTransfer(entry)}>
          Transfer Display
        </button>
      )}
    </div>
  );
}
