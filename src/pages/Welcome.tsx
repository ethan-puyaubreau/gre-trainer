import { useState } from 'react';
import { SKILLS, TEMPLATES } from '../content';
import { DEFAULT_DAILY_GOAL, isExamDate } from '../mastery/habit';
import { go, href } from '../router';
import { cloudEnabled } from '../sync/config';
import { useProgress } from '../store/progress';
import '../fx-welcome.css';

const GOALS: [number, string][] = [
  [10, 'Light · ~20 min'],
  [20, 'Steady · ~40 min'],
  [40, 'Intense · ~75 min'],
];

const STEPS: [string, string][] = [
  ['Practice', 'Every question is generated, so the supply never runs out. Each one is timed against the real GRE pace.'],
  ['Get repaired', 'A miss names the trap you fell into, then the skill comes back a few questions later with new numbers and in another format.'],
  ['Prove mastery', 'A skill is Mastered only after clean answers in several styles and formats, spread over more than a day. Then spaced reviews keep it.'],
];

/** First visit: what the app is, how it works, and two settings that shape the plan (exam date, daily goal). */
export function Welcome() {
  const { settings, updateSettings } = useProgress();
  const [goal, setGoal] = useState(settings.dailyGoal ?? DEFAULT_DAILY_GOAL);
  const [date, setDate] = useState(settings.examDate ?? '');
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const finish = (to: 'practice' | 'dashboard') => {
    updateSettings({ onboarded: true, dailyGoal: goal, examDate: isExamDate(date) ? date : undefined });
    if (to === 'practice') go('practice');
    else go();
  };

  return (
    <div className="welcome">
      <section className="welcome-hero">
        <span className="chip chip-accent">Free · no sign-up · works offline</span>
        <h1>Train for GRE Quant the way a tutor would.</h1>
        <p className="welcome-lead">
          Unlimited, verified questions that adapt to what you miss. Know exactly which trap got you, and see each skill climb from <em>Not started</em> to{' '}
          <em>Mastered</em>.
        </p>
        <div className="welcome-stats" aria-label="Content">
          <div>
            <b>{SKILLS.length}</b>
            <span>skills</span>
          </div>
          <div>
            <b>{TEMPLATES.length}</b>
            <span>question styles</span>
          </div>
          <div>
            <b>550+</b>
            <span>named traps</span>
          </div>
          <div>
            <b>100%</b>
            <span>answer keys machine-checked</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className="welcome-steps">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card">
              <span className="welcome-step-n" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{t}</h3>
              <p className="muted small">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card welcome-setup" aria-labelledby="setup">
        <h2 id="setup">Set up your plan</h2>
        <p className="muted small">Both can be changed later in Settings.</p>

        <fieldset className="welcome-field">
          <legend>How much a day?</legend>
          <div className="welcome-goals">
            {GOALS.map(([n, label]) => (
              <button key={n} type="button" className={`btn welcome-goal ${goal === n ? 'is-on' : ''}`} aria-pressed={goal === n} onClick={() => setGoal(n)}>
                <b>{n} questions</b>
                <span className="muted small">{label}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="welcome-field">
          <span className="welcome-label">
            When is your GRE? <span className="muted small">(optional)</span>
          </span>
          <input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="welcome-date" />
        </label>

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary btn-big" onClick={() => finish('practice')}>
            Start my first session →
          </button>
          <button className="btn btn-ghost" onClick={() => finish('dashboard')}>
            Show me the dashboard first
          </button>
        </div>
      </section>

      <p className="muted small welcome-foot">
        Already practised on another device?{' '}
        {cloudEnabled ? (
          <a href={href('settings')}>Sign in to sync</a>
        ) : (
          <a href={href('settings')}>Import your progress file</a>
        )}
        . Your progress stays in this browser{cloudEnabled ? ' unless you sign in' : ''}; nothing is tracked.
      </p>
    </div>
  );
}
