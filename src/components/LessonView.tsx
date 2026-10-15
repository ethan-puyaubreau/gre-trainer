import type { ReactNode } from 'react';
import { TRAPS } from '../content';
import { LESSONS } from '../content/lessons';
import { Rich, RichInline } from './Rich';

/** A skill's lesson: the idea, how to recognize the problem, one worked example and the traps. Buttons, if any, go in `children`. */
export function LessonView({ skillId, children }: { skillId: string; children?: ReactNode }) {
  const lesson = LESSONS[skillId];
  if (!lesson) return null;
  const { idea, recognize, example } = lesson;
  const traps = lesson.traps.map((id) => TRAPS[id]).filter(Boolean);
  return (
    <div className="lesson">
      <h3>The idea</h3>
      <Rich text={idea} />
      <h3>How to recognize it</h3>
      <Rich text={recognize} />
      <h3>Worked example</h3>
      <div className="strategy-box" style={{ marginTop: 0 }}>
        <Rich text={example.problem} />
        <ol style={{ paddingLeft: 22 }}>
          {example.steps.map((step, i) => (
            <li key={i}>
              <RichInline text={step} />
            </li>
          ))}
        </ol>
        <p style={{ marginBottom: 0 }}>
          <strong>Answer:</strong> <RichInline text={example.answer} />
        </p>
      </div>
      {traps.length > 0 && (
        <>
          <h3>Traps</h3>
          {traps.map((t, i) => (
            <div className="trap-box" key={i}>
              <strong>
                <RichInline text={t.label} />
              </strong>
              <Rich text={t.fix} />
            </div>
          ))}
        </>
      )}
      {children}
    </div>
  );
}
