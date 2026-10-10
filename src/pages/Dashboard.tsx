import { useMemo, useState } from 'react';
import { Rich, RichInline } from '../components/Rich';
import { formatClock } from '../components/Timer';
import { AREA_NAMES, AREAS, skillById, SKILLS, templatesBySkill, TRAPS } from '../content';
import type { Skill } from '../engine/types';
import { calibrate, MIN_PER_CELL, type Cell, type Row } from '../mastery/calibration';
import { dayKey, isDue, LEVEL_NAMES, newSkillState, nextStep, type Level } from '../mastery/model';
import { href } from '../router';
import { useProgress } from '../store/progress';

/** Khan-style course mastery: Familiar 50, Proficient 80, Mastered 100 points per skill. */
const POINTS: Record<Level, number> = { 0: 0, 1: 0, 2: 50, 3: 80, 4: 100 };
const DIFF_NAMES = ['easy', 'medium', 'hard'];

export function Dashboard() {
  const { skills: states, history, remediation, settings } = useProgress();
  const [open, setOpen] = useState<Skill | null>(null);
  const now = Date.now();
  const playable = SKILLS.filter((s) => (templatesBySkill.get(s.id)?.length ?? 0) > 0);

  const stats = useMemo(() => {
    const today = dayKey(now);
    const todays = history.filter((h) => dayKey(h.at) === today);
    const last = history.slice(-50);
    const pts = playable.reduce((s, sk) => s + POINTS[(states[sk.id]?.level ?? 0) as Level], 0);
    const counts = [0, 0, 0, 0, 0];
    for (const sk of playable) counts[states[sk.id]?.level ?? 0]++;
    const due = playable.filter((sk) => states[sk.id] && isDue(states[sk.id], now)).length;
    const trapCounts = new Map<string, number>();
    for (const h of history.slice(-400)) for (const t of h.traps) trapCounts.set(t, (trapCounts.get(t) ?? 0) + 1);
    const traps = [...trapCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const timed = last.filter((h) => h.mode === 'practice');
    return {
      today: todays.length,
      todayCorrect: todays.filter((h) => h.correct).length,
      accuracy: last.length ? Math.round((100 * last.filter((h) => h.correct).length) / last.length) : null,
      avgTime: timed.length ? timed.reduce((s, h) => s + h.timeMs, 0) / timed.length : null,
      mastery: playable.length ? Math.round((100 * pts) / (100 * playable.length)) : 0,
      counts,
      due,
      traps,
    };
  }, [history, states, now, playable]);

  const calib = useMemo(() => calibrate(history, (id) => skillById.get(id)?.area), [history]);
  const diffRows = [
    ['All areas', calib.overall],
    ...AREAS.filter((a) => calib.byArea[a.area]).map((a) => [AREA_NAMES[a.area], calib.byArea[a.area]!]),
  ] as [string, Row][];
  const flagged = playable.filter((s) => states[s.id]?.flagged);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div className="muted small">Course mastery</div>
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{stats.mastery}%</div>
            <div className="progress" style={{ marginTop: 8 }}>
              <div style={{ width: `${stats.mastery}%` }} />
            </div>
            <div className="legend" style={{ marginTop: 10 }}>
              {LEVEL_NAMES.map((n, i) => (
                <span key={n}>
                  <i className={`level-dot level-${i}`} /> {n} {stats.counts[i]}
                </span>
              ))}
            </div>
          </div>
          <div className="stat" style={{ minWidth: 110 }}>
            <b>
              {stats.todayCorrect}/{stats.today}
            </b>
            <span>correct today</span>
          </div>
          <div className="stat" style={{ minWidth: 110 }}>
            <b>{stats.accuracy === null ? '–' : `${stats.accuracy}%`}</b>
            <span>accuracy (last 50)</span>
          </div>
          <div className="stat" style={{ minWidth: 110 }}>
            <b style={{ color: stats.avgTime !== null && stats.avgTime > settings.paceSec * 1000 ? 'var(--bad)' : undefined }}>
              {stats.avgTime === null ? '–' : formatClock(stats.avgTime)}
            </b>
            <span>avg time / {formatClock(settings.paceSec * 1000)} pace</span>
          </div>
        </div>
      </div>

      <div className="grid grid-3">
        <a className="card" href={href('practice')} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="chip chip-accent">Recommended</div>
          <h3 style={{ marginTop: 10 }}>Smart practice</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Repairs missed skills in a new style, reviews what is due, then moves you forward.
            {remediation.length > 0 && ` ${remediation.length} skill${remediation.length > 1 ? 's' : ''} waiting to come back.`}
          </p>
        </a>
        <a className="card" href={href('practice', 'review')} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={`chip ${stats.due ? 'chip-warn' : ''}`}>{stats.due} due</div>
          <h3 style={{ marginTop: 10 }}>Spaced review</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Skills come back 1 day after a miss, and 3, 7, 21 then 60 days after mastery.
          </p>
        </a>
        <a className="card" href={href('section')} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="chip">12 q · 21 min / 15 q · 26 min</div>
          <h3 style={{ marginTop: 10 }}>Section test</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Timed GRE simulation with mark &amp; review, calculator and an adaptive second section.
          </p>
        </a>
      </div>

      {flagged.length > 0 && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--warn)' }}>
          <strong>Flagged from your Official Guide practice set:</strong>{' '}
          {flagged.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ', '}
              <a href={href('practice', 'skill', s.id)}>{s.name}</a>
            </span>
          ))}
          . Smart practice serves these first until they reach Proficient.
        </div>
      )}

      {AREAS.map((area) => {
        const skills = area.skills.filter((s) => (templatesBySkill.get(s.id)?.length ?? 0) > 0);
        if (!skills.length) return null;
        const units = [...new Set(skills.map((s) => s.unit))];
        const pts = skills.reduce((s, sk) => s + POINTS[(states[sk.id]?.level ?? 0) as Level], 0);
        return (
          <section key={area.area}>
            <div className="row">
              <h2 style={{ marginBottom: 8 }}>{AREA_NAMES[area.area]}</h2>
              <span className="chip">{Math.round(pts / skills.length)}% mastery</span>
              <span className="spacer" />
              <a className="btn" href={href('practice', 'area', area.area)}>
                Practice {AREA_NAMES[area.area]}
              </a>
            </div>
            <div className="grid grid-3">
              {units.map((u) => (
                <div key={u} className="card unit-block" style={{ padding: 14 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{u}</h3>
                    <span className="spacer" />
                    <a className="small" href={href('practice', 'unit', area.area, u)}>
                      Practice unit
                    </a>
                  </div>
                  <div className="skills-col">
                    {skills
                      .filter((s) => s.unit === u)
                      .map((s) => {
                        const st = states[s.id];
                        const lvl = st?.level ?? 0;
                        return (
                          <button key={s.id} className="skill-tile" onClick={() => setOpen(s)} title={LEVEL_NAMES[lvl]}>
                            <i className={`level-dot level-${lvl}`} />
                            <span className="name">{s.name}</span>
                            {st?.flagged && <span className="chip chip-warn">weak</span>}
                            {st && isDue(st, now) && <span className="chip chip-accent">due</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {stats.traps.length > 0 && (
        <section>
          <h2>Traps you fall for</h2>
          <div className="card">
            <ul className="list-plain">
              {stats.traps.map(([id, n]) => (
                <li key={id}>
                  <div className="row">
                    <strong>
                      <RichInline text={TRAPS[id]?.label ?? id} />
                    </strong>
                    <span className="chip chip-bad">
                      {n} time{n > 1 ? 's' : ''}
                    </span>
                  </div>
                  <Rich className="small muted" text={TRAPS[id]?.fix} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {calib.overall.some((c) => c.n > 0) && (
        <section>
          <h2>Difficulty check</h2>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Your success should fall from easy to hard. If it does not, the difficulty levels of those questions are mislabeled. Hinted answers are
              not counted, and cells with fewer than {MIN_PER_CELL} answers are greyed out.
            </p>
            <table className="review-table">
              <thead>
                <tr>
                  <th />
                  <th>Easy</th>
                  <th>Medium</th>
                  <th>Hard</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map(([name, row]) => (
                  <tr key={name}>
                    <th>{name}</th>
                    {row.map((c, i) => (
                      <DiffCell key={i} cell={c} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {calib.inverted.length > 0 && (
              <p className="small" style={{ marginBottom: 0 }}>
                <strong>Harder went better than easier in:</strong>{' '}
                {calib.inverted.map((v, i) => (
                  <span key={v.skillId}>
                    {i > 0 && ', '}
                    {skillById.get(v.skillId)?.name ?? v.skillId} ({DIFF_NAMES[v.easier - 1]} {Math.round(100 * v.rates[v.easier - 1]!)}% vs{' '}
                    {DIFF_NAMES[v.easier]} {Math.round(100 * v.rates[v.easier]!)}%)
                  </span>
                ))}
              </p>
            )}
          </div>
        </section>
      )}

      {open && <SkillDrawer skill={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function DiffCell({ cell }: { cell: Cell }) {
  if (!cell.n) return <td className="muted">–</td>;
  return (
    <td className={cell.n < MIN_PER_CELL ? 'muted' : undefined}>
      {Math.round((100 * cell.correct) / cell.n)}% · {formatClock(cell.timeMs / cell.n)} <span className="muted small">({cell.n})</span>
    </td>
  );
}

function SkillDrawer({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const { skills: states, history, settings } = useProgress();
  const st = states[skill.id] ?? newSkillState();
  const templates = templatesBySkill.get(skill.id) ?? [];
  const mine = history.filter((h) => h.skillId === skill.id);
  const acc = mine.length ? Math.round((100 * mine.filter((h) => h.correct).length) / mine.length) : null;
  const avg = mine.length ? mine.reduce((s, h) => s + h.timeMs, 0) / mine.length : null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={skill.name}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{skill.name}</h2>
          <span className="spacer" />
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted">{skill.summary}</p>
        <div className="row">
          <span className="chip chip-accent">
            <i className={`level-dot level-${st.level}`} /> {LEVEL_NAMES[st.level]}
          </span>
          <span className="chip">difficulty {'●'.repeat(st.difficulty)}</span>
          {acc !== null && <span className="chip">{acc}% correct</span>}
          {avg !== null && (
            <span className={`chip ${avg > settings.paceSec * 1000 ? 'chip-bad' : 'chip-good'}`}>avg {formatClock(avg)}</span>
          )}
        </div>
        <p>{nextStep(st)}</p>
        <a className="btn btn-primary" href={href('practice', 'skill', skill.id)}>
          Practice this skill
        </a>
        <h3>Question styles</h3>
        <ul className="list-plain">
          {templates.map((t) => (
            <li key={t.id} className="row">
              <span style={{ width: 18 }}>{st.styles.includes(t.id) ? '✓' : '·'}</span>
              <span style={{ flex: 1 }}>{t.style}</span>
              <span className="chip">{{ qc: 'Comparison', mcs: 'Select one', mcm: 'Select all', ne: 'Numeric entry' }[t.format]}</span>
            </li>
          ))}
        </ul>
        <h3>Strategy</h3>
        <div className="strategy-box">
          <Rich text={skill.strategy} />
        </div>
      </aside>
    </>
  );
}
