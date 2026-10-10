import { QC_CHOICES, QC_TEXT, letter } from '../engine/build';
import type { Response } from '../engine/grade';
import { parseIntBox } from '../engine/frac';
import { parseNumericResponse } from '../engine/grade';
import type { QuestionBody } from '../engine/types';
import { Figure } from './Figure';
import { Rich, RichInline } from './Rich';

interface Props {
  q: QuestionBody;
  response: Response | undefined;
  onChange?: (r: Response) => void;
  /** No more changes allowed. */
  locked?: boolean;
  /** Show correct / wrong marks. */
  reveal?: boolean;
  autoFocus?: boolean;
}

export function QuestionView({ q, response, onChange, locked, reveal, autoFocus }: Props) {
  const set = (r: Response) => {
    if (!locked) onChange?.(r);
  };
  return (
    <div>
      <Figure figure={q.figure} />
      {q.format === 'qc' && <QC q={q} response={response} set={set} locked={locked} reveal={reveal} />}
      {q.format === 'mcs' && <MCS q={q} response={response} set={set} locked={locked} reveal={reveal} />}
      {q.format === 'mcm' && <MCM q={q} response={response} set={set} locked={locked} reveal={reveal} />}
      {q.format === 'ne' && <NE q={q} response={response} set={set} locked={locked} reveal={reveal} autoFocus={autoFocus} />}
    </div>
  );
}

type Sub<F> = { q: F; response: Response | undefined; set: (r: Response) => void; locked?: boolean; reveal?: boolean };

function choiceClass(selected: boolean, isCorrect: boolean, reveal?: boolean) {
  if (reveal) {
    if (isCorrect) return 'choice correct';
    if (selected) return 'choice wrong';
    return 'choice';
  }
  return selected ? 'choice selected' : 'choice';
}

function QC({ q, response, set, locked, reveal }: Sub<Extract<QuestionBody, { format: 'qc' }>>) {
  const picked = response?.format === 'qc' ? response.choice : undefined;
  return (
    <div>
      {q.info && (
        <div className="qc-info">
          <Rich text={q.info} />
        </div>
      )}
      <div className="qc-grid">
        <div>
          <div className="qh">Quantity A</div>
          <div className="qbox">
            <Rich text={q.quantityA} />
          </div>
        </div>
        <div>
          <div className="qh">Quantity B</div>
          <div className="qbox">
            <Rich text={q.quantityB} />
          </div>
        </div>
      </div>
      <div className="choices">
        {QC_CHOICES.map((c) => (
          <button
            key={c}
            className={choiceClass(picked === c, q.answer === c, reveal)}
            onClick={() => set({ format: 'qc', choice: c })}
            disabled={locked && !reveal}
            aria-pressed={picked === c}
          >
            <span className="bubble">{c}</span>
            <span className="choice-text">{QC_TEXT[c]}</span>
            {reveal && q.answer === c && <span className="mark" style={{ color: 'var(--good)' }}>✓</span>}
            {reveal && picked === c && q.answer !== c && <span className="mark" style={{ color: 'var(--bad)' }}>✗</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function MCS({ q, response, set, locked, reveal }: Sub<Extract<QuestionBody, { format: 'mcs' }>>) {
  const picked = response?.format === 'mcs' ? response.choice : -1;
  return (
    <div>
      <Rich text={q.stem} />
      <div className="choices">
        {q.choices.map((c, i) => (
          <button
            key={i}
            className={choiceClass(picked === i, q.answer === i, reveal)}
            onClick={() => set({ format: 'mcs', choice: i })}
            disabled={locked && !reveal}
            aria-pressed={picked === i}
          >
            <span className="bubble">{letter(i)}</span>
            <span className="choice-text">
              <RichInline text={c.text} />
            </span>
            {reveal && q.answer === i && <span className="mark" style={{ color: 'var(--good)' }}>✓</span>}
            {reveal && picked === i && q.answer !== i && <span className="mark" style={{ color: 'var(--bad)' }}>✗</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function MCM({ q, response, set, locked, reveal }: Sub<Extract<QuestionBody, { format: 'mcm' }>>) {
  const picked = response?.format === 'mcm' ? response.choices : [];
  const toggle = (i: number) => {
    const next = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i].sort((a, b) => a - b);
    set({ format: 'mcm', choices: next });
  };
  return (
    <div>
      <Rich text={q.stem} />
      <div className="instruction">
        <RichInline text={q.instruction} />
      </div>
      <div className="choices">
        {q.choices.map((c, i) => {
          const sel = picked.includes(i);
          const ok = q.answer.includes(i);
          return (
            <button key={i} className={choiceClass(sel, ok, reveal)} onClick={() => toggle(i)} disabled={locked && !reveal} aria-pressed={sel}>
              <span className="bubble square">{sel ? '✓' : letter(i)}</span>
              <span className="choice-text">
                <RichInline text={c.text} />
              </span>
              {reveal && ok && <span className="mark" style={{ color: 'var(--good)' }}>{sel ? '✓' : 'missed'}</span>}
              {reveal && sel && !ok && <span className="mark" style={{ color: 'var(--bad)' }}>✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NE({ q, response, set, locked, reveal, autoFocus }: Sub<Extract<QuestionBody, { format: 'ne' }>> & { autoFocus?: boolean }) {
  const val = response?.format === 'ne' ? response : undefined;
  const parsed = val ? parseNumericResponse(val) : null;
  const cls = reveal ? (parsed && parsed.eq(q.answer) ? 'ne-input correct' : 'ne-input wrong') : 'ne-input';
  // Hint only once the input is clearly bad: a lone fraction box is just unfinished.
  const typed = !val ? [] : 'value' in val ? [val.value] : [val.num, val.den].filter((x) => x.trim() !== '');
  const bad = !parsed && typed.some((x) => x.trim() !== '') && (typed.length > 1 || (!!val && 'value' in val) || parseIntBox(typed[0]) === null);
  const hint = !bad ? '' : val && 'value' in val && val.value.includes(',') ? 'Use a dot for decimals, e.g. 1.5' : 'Not a valid number';
  return (
    <div>
      <Rich text={q.stem} />
      <div className="ne-row">
        {q.prefix && <RichInline text={q.prefix} />}
        {q.fractionBoxes ? (
          <span className="ne-frac">
            <input
              className={cls}
              inputMode="numeric"
              aria-label="Numerator"
              value={val && 'num' in val ? val.num : ''}
              onChange={(e) => set({ format: 'ne', num: e.target.value, den: val && 'den' in val ? val.den : '' })}
              disabled={locked}
              autoFocus={autoFocus}
              data-ne-input="num"
            />
            <hr />
            <input
              className={cls}
              inputMode="numeric"
              aria-label="Denominator"
              value={val && 'den' in val ? val.den : ''}
              onChange={(e) => set({ format: 'ne', num: val && 'num' in val ? val.num : '', den: e.target.value })}
              disabled={locked}
              data-ne-input="den"
            />
          </span>
        ) : (
          <input
            className={cls}
            inputMode="decimal"
            aria-label="Answer"
            value={val && 'value' in val ? val.value : ''}
            onChange={(e) => set({ format: 'ne', value: e.target.value })}
            disabled={locked}
            autoFocus={autoFocus}
            data-ne-input="value"
          />
        )}
        {q.suffix && <RichInline text={q.suffix} />}
      </div>
      {!locked && (
        <div className="muted small" style={{ textAlign: 'center' }}>
          {q.fractionBoxes ? 'Enter a fraction: integers only, no decimal point.' : 'Integer or decimal; it may be negative. Equivalent forms are accepted.'}
        </div>
      )}
      {!locked && hint && (
        <div className="muted small" style={{ textAlign: 'center' }} role="status">
          {hint}
        </div>
      )}
      {reveal && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          Correct answer:{' '}
          <strong>
            <RichInline text={`$${q.fractionBoxes || !q.answer.isTerminating() ? q.answer.toTex() : q.answer.toDecimalString()}$`} />
          </strong>
        </div>
      )}
    </div>
  );
}
