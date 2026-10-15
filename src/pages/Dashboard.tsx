import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { LessonView } from '../components/LessonView';
import { Rich, RichInline } from '../components/Rich';
import { formatClock } from '../components/Timer';
import { AREA_NAMES, AREAS, skillById, SKILLS, templatesBySkill, TRAPS } from '../content';
import { LESSONS } from '../content/lessons';
import type { Skill } from '../engine/types';
import { calibrate, MIN_PER_CELL, type Cell, type Row } from '../mastery/calibration';
import { dayStreak, DEFAULT_DAILY_GOAL, tomorrowDue } from '../mastery/habit';
import { dayKey, isDue, LEVEL_NAMES, newSkillState, nextCriteria, nextStep, progressToNext, requirementsFor, type Level } from '../mastery/model';
import { reducedMotion } from '../motion';
import { href } from '../router';
import { useProgress } from '../store/progress';
import '../fx-dashboard.css';

/** Khan-style course mastery: Familiar 50, Proficient 80, Mastered 100 points per skill. */
const POINTS: Record<Level, number> = { 0: 0, 1: 0, 2: 50, 3: 80, 4: 100 };
const DIFF_NAMES = ['easy', 'medium', 'hard'];

const SEEN_KEY = 'gre-trainer-dashboard-seen';
const COUNT_MS = 600;
const RAISED_MS = 2600;
interface Seen {
  mastery: number;
  levels: Record<string, number>;
}


function readSeen(): Seen | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? 'null');
    return typeof v?.mastery === 'number' && v.levels ? v : null;
  } catch {
    return null;
  }
}

/** Compares with the previous visit in this tab: the old mastery to count up from, and the skills whose level rose. */
function useSinceLastVisit(mastery: number, levels: Record<string, number>) {
  const [seen] = useState(readSeen);
  const [raised, setRaised] = useState(() => new Set(seen ? Object.keys(levels).filter((id) => levels[id] > (seen.levels[id] ?? 0)) : []));
  useEffect(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify({ mastery, levels }));
    } catch {
      // Storage blocked: the next visit simply has nothing to compare with.
    }
    if (!raised.size) return;
    const t = setTimeout(() => setRaised(new Set()), RAISED_MS);
    return () => clearTimeout(t);
    // Mount only: leaving and coming back compares with this visit.
  }, []);
  return { from: seen?.mastery, raised };
}

/** Eases from `from` to `to` over COUNT_MS; with no `from` or reduced motion, the final value is there from the first render. */
function useCountUp(to: number, from: number | undefined): number {
  const [v, setV] = useState(() => (from === undefined || reducedMotion() ? to : from));
  const cur = useRef(v);
  useEffect(() => {
    const a = cur.current;
    if (a === to || reducedMotion()) {
      cur.current = to;
      setV(to);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const step = (now: number) => {
      t0 ||= now;
      const k = Math.min(1, (now - t0) / COUNT_MS);
      cur.current = a + (to - a) * (1 - (1 - k) ** 4);
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return v;
}

export function Dashboard() {
  const { skills: states, history, sections, remediation, settings } = useProgress();
  const [open, setOpen] = useState<Skill | null>(null);
  const opener = useRef<HTMLElement | null>(null);
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
    const tried = Object.fromEntries(playable.filter((sk) => states[sk.id]).map((sk) => [sk.id, states[sk.id]]));
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
      tomorrow: tomorrowDue(tried, now),
      streak: dayStreak(history, now),
      traps,
    };
  }, [history, states, now, playable]);

  const levels = Object.fromEntries(playable.map((sk) => [sk.id, states[sk.id]?.level ?? 0]));
  const { from, raised } = useSinceLastVisit(stats.mastery, levels);
  const shown = useCountUp(stats.mastery, from);

  const calib = useMemo(() => calibrate(history, sections, (id) => skillById.get(id)?.area), [history, sections]);
  const diffRows = [
    ['All areas', calib.overall],
    ...AREAS.filter((a) => calib.byArea[a.area]).map((a) => [AREA_NAMES[a.area], calib.byArea[a.area]!]),
  ] as [string, Row][];

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <div className="muted small">Course mastery</div>
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{Math.round(shown)}%</div>
            <div className="progress" style={{ marginTop: 8 }}>
              {/* Slid with transform (the parent clips it) so the animation stays off the layout path. */}
              <div style={{ width: '100%', transform: `translateX(${shown - 100}%)` }} />
            </div>
            <div className="legend" style={{ marginTop: 10 }}>
              {LEVEL_NAMES.map((n, i) => (
                <span key={n}>
                  <i className={`level-dot level-${i}`} /> {n} {stats.counts[i]}
                </span>
              ))}
            </div>
          </div>
          <GoalRing done={stats.today} goal={settings.dailyGoal ?? DEFAULT_DAILY_GOAL} />
          <div className="stat" style={{ minWidth: 80 }}>
            <b>{stats.streak}</b>
            <span>day streak</span>
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
        <p className="habit-line muted small">
          <span>Tomorrow: {stats.tomorrow === 0 ? 'nothing to review' : `${stats.tomorrow} skill${stats.tomorrow === 1 ? '' : 's'} to review`}</span>
        </p>
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
                        const p = progressToNext(st ?? newSkillState(), requirementsFor(templatesBySkill.get(s.id) ?? []), now);
                        const label = lvl === 4 ? LEVEL_NAMES[4] : `${LEVEL_NAMES[lvl]}, ${Math.round(100 * p)}% to ${LEVEL_NAMES[lvl + 1]}`;
                        return (
                          <button
                            key={s.id}
                            className={raised.has(s.id) ? 'skill-tile fx-raised' : 'skill-tile'}
                            onClick={(e) => {
                              opener.current = e.currentTarget;
                              setOpen(s);
                            }}
                            title={label}
                          >
                            <span
                              className="mastery-ring"
                              style={{ '--p': p, '--ring': `var(--level-${Math.min(lvl + 1, 4)})` } as CSSProperties}
                              aria-hidden="true"
                            >
                              <i className={`level-dot level-${lvl}`} />
                            </span>
                            <span className="name">{s.name}</span>
                            {raised.has(s.id) && (
                              <span className="fx-up" aria-hidden="true">
                                {LEVEL_NAMES[lvl]}
                              </span>
                            )}
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

      {calib.overall.some((c) => c.n > 0) ? (
        <section>
          <h2>Difficulty check</h2>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Your success should fall from easy to hard. If it does not, the difficulty levels of those questions are mislabeled. Only
              section tests at medium level count (Section 1 is always medium): there the difficulty of each question is drawn at random, so
              the rates are not skewed by how well you are doing, unlike practice, where difficulty follows your results. This fills slowly,
              a few questions per test. Hinted answers are not counted, and cells with fewer than {MIN_PER_CELL} answers are greyed out.
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
      ) : (
        <p className="muted small">The difficulty check appears after your first section tests.</p>
      )}

      {open && <SkillDrawer skill={open} opener={opener} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Today's answers against the daily goal: a ring that is drawn in on arrival (the global reduced-motion rules cut it). */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const p = Math.min(1, done / goal);
  const met = done >= goal;
  return (
    <div className="stat">
      <div
        className={met ? 'goal-ring done' : 'goal-ring'}
        role="progressbar"
        aria-label="Daily goal"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(done, goal)}
        aria-valuetext={`${done} of ${goal} answers today`}
      >
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle className="goal-track" cx="18" cy="18" r="15" />
          {p > 0 && <circle className="goal-arc" cx="18" cy="18" r="15" pathLength={1} style={{ strokeDashoffset: 1 - p }} />}
        </svg>
        <b>{done}</b>
      </div>
      <span>{met ? 'goal reached' : `of ${goal} today`}</span>
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

/** A native modal dialog: Escape, the focus trap and the inert page come with showModal(). */
function SkillDrawer({ skill, opener, onClose }: { skill: Skill; opener: RefObject<HTMLElement | null>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => {
      d.close();
      opener.current?.focus();
    };
  }, [opener]);
  const { skills: states, history, settings } = useProgress();
  const st = states[skill.id] ?? newSkillState();
  const templates = templatesBySkill.get(skill.id) ?? [];
  const criteria = nextCriteria(st, requirementsFor(templates), Date.now());
  const mine = history.filter((h) => h.skillId === skill.id);
  const acc = mine.length ? Math.round((100 * mine.filter((h) => h.correct).length) / mine.length) : null;
  const avg = mine.length ? mine.reduce((s, h) => s + h.timeMs, 0) / mine.length : null;
  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-label={skill.name}
      // Reset the browser's centered-dialog defaults; the big shadow dims the page like the old backdrop.
      style={{
        left: 'auto',
        margin: '0 0 0 auto',
        height: 'auto',
        maxWidth: 'none',
        maxHeight: 'none',
        borderWidth: '0 0 0 1px',
        color: 'var(--text)',
        boxShadow: '0 0 0 100vmax rgba(10, 5, 20, 0.35)',
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the ::backdrop targets the dialog itself, outside its box.
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}
    >
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
        {avg !== null && <span className={`chip ${avg > settings.paceSec * 1000 ? 'chip-bad' : 'chip-good'}`}>avg {formatClock(avg)}</span>}
      </div>
      {st.level === 4 ? (
        <p>{nextStep(st)}</p>
      ) : (
        <>
          <h3>To reach {LEVEL_NAMES[st.level + 1]}</h3>
          <ul className="list-plain">
            {criteria.map((c) => (
              <li key={c.key} className="row">
                <span style={{ width: 18 }}>{c.done ? '✓' : '·'}</span>
                <span style={{ flex: 1 }}>
                  {c.label}
                  {c.detail && <span className="muted small"> · {c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {st.level === 3 && criteria.every((c) => c.done) && <p className="small">All set: one more correct answer on pace makes it Mastered.</p>}
        </>
      )}
      <a className="btn btn-primary" href={href('practice', 'skill', skill.id)}>
        Practice this skill
      </a>
      <h3>Question styles</h3>
      <ul className="list-plain">
        {templates.map((t) => (
          <li key={t.id} className="row">
            <span style={{ width: 18 }}>{st.styles[t.id] ? '✓' : '·'}</span>
            <span style={{ flex: 1 }}>{t.style}</span>
            <span className="chip">{{ qc: 'Comparison', mcs: 'Select one', mcm: 'Select all', ne: 'Numeric entry' }[t.format]}</span>
          </li>
        ))}
      </ul>
      <h3>Strategy</h3>
      <div className="strategy-box">
        <Rich text={skill.strategy} />
      </div>
      {LESSONS[skill.id] && (
        <details style={{ marginTop: 12 }}>
          <summary>
            <strong>Lesson</strong>
          </summary>
          <LessonView skillId={skill.id} />
        </details>
      )}
    </dialog>
  );
}
