import { QuestionView } from '../components/QuestionView';
import { Rich } from '../components/Rich';
import { templateById } from '../content';
import { generateQuestion } from '../engine/generate';
import type { Difficulty } from '../engine/types';

/** Debug view: #/preview/<templateId>/<seed>/<difficulty> renders one question with its answer and explanation. */
export function Preview({ route }: { route: string[] }) {
  const [id, seedStr = '1', dStr = '2'] = route;
  const t = id ? templateById.get(id) : undefined;
  if (!t) return <div className="card empty">Unknown template {id}</div>;
  const q = generateQuestion(t, Number(seedStr), Number(dStr) as Difficulty);
  return (
    <div className="question-card" data-preview-ready>
      <div className="question-meta">
        <span className="chip">{t.id}</span>
        <span className="chip">
          seed {seedStr} · difficulty {dStr}
        </span>
      </div>
      <QuestionView q={q} response={undefined} locked reveal />
      <h3>Explanation</h3>
      <Rich text={q.explanation} />
    </div>
  );
}
