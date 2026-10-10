import { useMemo, useState } from 'react';
import { QuestionView } from '../components/QuestionView';
import { Rich, RichInline } from '../components/Rich';
import { formatClock } from '../components/Timer';
import { skillById, templateById, TRAPS } from '../content';
import { generateQuestion, parseQuestionId } from '../engine/generate';
import { useProgress } from '../store/progress';

export function History() {
  const { history, sections, settings } = useProgress();
  const [filter, setFilter] = useState<'all' | 'wrong' | 'slow'>('all');
  const [open, setOpen] = useState<number | null>(null);
  const rows = useMemo(() => {
    const list = history.map((h, i) => ({ h, i })).reverse();
    if (filter === 'wrong') return list.filter(({ h }) => !h.correct);
    if (filter === 'slow') return list.filter(({ h }) => h.mode === 'practice' && h.timeMs > settings.paceSec * 1000);
    return list;
  }, [history, filter, settings.paceSec]);

  return (
    <div>
      <h1>History</h1>
      {sections.length > 0 && (
        <>
          <h2>Section tests</h2>
          <div className="card" style={{ padding: 0 }}>
            <table className="review-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sections</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {[...sections].reverse().map((s) => {
                  const c = s.parts.reduce((a, p) => a + p.correct, 0);
                  const n = s.parts.reduce((a, p) => a + p.questions, 0);
                  return (
                    <tr key={s.at}>
                      <td>{new Date(s.at).toLocaleString()}</td>
                      <td>
                        {s.parts.map((p, i) => (
                          <span key={i} className="chip" style={{ marginRight: 6 }}>
                            S{i + 1}: {p.correct}/{p.questions} in {formatClock(p.usedSec * 1000)}
                          </span>
                        ))}
                      </td>
                      <td>
                        <strong>
                          {c}/{n}
                        </strong>{' '}
                        ({Math.round((100 * c) / n)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h2>Questions</h2>
      <div className="tabs">
        {(
          [
            ['all', 'All'],
            ['wrong', 'Missed'],
            ['slow', 'Over pace'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card empty">Nothing here yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="review-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Skill · style</th>
                <th>Result</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map(({ h, i }) => {
                const parsed = parseQuestionId(h.qid);
                const t = parsed && templateById.get(parsed.templateId);
                return [
                  <tr key={i} className="clickable" onClick={() => setOpen(open === i ? null : i)}>
                    <td className="small">
                      {/* No handler of its own: a keyboard or mouse click on the button bubbles to the row, which toggles it. */}
                      <button type="button" className="btn btn-ghost small" style={{ padding: '2px 6px' }} aria-expanded={open === i}>
                        {new Date(h.at).toLocaleString()}
                      </button>
                    </td>
                    <td>
                      {skillById.get(h.skillId)?.name ?? h.skillId}
                      <div className="muted small">
                        {t?.style ?? h.templateId}
                        {h.mode === 'section' ? ' · section test' : ''}
                      </div>
                    </td>
                    <td>
                      {h.correct ? <span className="chip chip-good">correct</span> : <span className="chip chip-bad">missed</span>}
                      {h.traps.map((tr) => (
                        <div key={tr} className="small" style={{ color: 'var(--warn)' }}>
                          <RichInline text={TRAPS[tr]?.label ?? tr} />
                        </div>
                      ))}
                    </td>
                    <td className={h.mode === 'practice' && h.timeMs > settings.paceSec * 1000 ? 'muted' : ''}>{formatClock(h.timeMs)}</td>
                  </tr>,
                  open === i && t && parsed && (
                    <tr key={`${i}-open`}>
                      <td colSpan={4}>
                        {(() => {
                          const q = generateQuestion(t, parsed.seed, parsed.difficulty);
                          return (
                            <>
                              <QuestionView q={q} response={h.response} locked reveal />
                              <h3>Explanation</h3>
                              <Rich text={q.explanation} />
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
