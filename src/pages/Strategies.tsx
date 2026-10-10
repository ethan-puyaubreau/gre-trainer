import { useEffect } from 'react';
import { Rich, RichInline } from '../components/Rich';
import { AREA_NAMES, AREAS, templatesBySkill } from '../content';
import { href } from '../router';

export function Strategies({ focus }: { focus?: string }) {
  useEffect(() => {
    if (focus) document.getElementById(`skill-${focus}`)?.scrollIntoView({ block: 'start' });
  }, [focus]);
  return (
    <div>
      <h1>Strategy cards</h1>
      <p className="muted">The fast methods for every skill, and the traps the wrong answer choices are built from.</p>
      {AREAS.filter((a) => a.skills.length).map((area) => (
        <section key={area.area}>
          <h2>{AREA_NAMES[area.area]}</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            {area.skills.map((s) => (
              <div
                key={s.id}
                id={`skill-${s.id}`}
                className="card"
                style={focus === s.id ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px var(--accent-soft)' } : undefined}
              >
                <div className="row">
                  <strong>{s.name}</strong>
                  <span className="spacer" />
                  <span className="chip">{s.unit}</span>
                </div>
                <p className="muted small" style={{ marginTop: 4 }}>
                  {s.summary}
                </p>
                <Rich text={s.strategy} />
                {(templatesBySkill.get(s.id)?.length ?? 0) > 0 && (
                  <a className="btn" style={{ marginTop: 10, display: 'inline-block' }} href={href('practice', 'skill', s.id)}>
                    Practice
                  </a>
                )}
              </div>
            ))}
          </div>
          {Object.keys(area.traps).length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary>
                <strong>Traps in {AREA_NAMES[area.area]}</strong> ({Object.keys(area.traps).length})
              </summary>
              <ul className="list-plain card" style={{ marginTop: 8 }}>
                {Object.entries(area.traps).map(([id, t]) => (
                  <li key={id}>
                    <strong>
                      <RichInline text={t.label} />
                    </strong>
                    <Rich className="small" text={t.fix} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
