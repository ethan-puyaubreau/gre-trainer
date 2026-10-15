import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../components/Timer';
import { DEFAULT_DAILY_GOAL, MAX_DAILY_GOAL, MIN_DAILY_GOAL } from '../mastery/habit';
import { DEFAULT_PACE_SEC } from '../mastery/model';
import { exportProgress, isProgressData, NOT_AN_EXPORT, useProgress } from '../store/progress';

const fieldStyle = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' } as const;
const answers = (k: number) => `${k} answer${k === 1 ? '' : 's'}`;

export function Settings() {
  const { settings, updateSettings, importData, reset, history } = useProgress();
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  // The field is typed in, so it keeps its own text: an empty or half-typed number is not a goal yet.
  const goal = settings.dailyGoal ?? DEFAULT_DAILY_GOAL;
  const [goalText, setGoalText] = useState(String(goal));
  useEffect(() => setGoalText(String(goal)), [goal]);

  const download = () => {
    updateSettings({ lastExportAt: Date.now() });
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gre-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const upload = async (f: File) => {
    try {
      const data: unknown = JSON.parse(await f.text());
      if (!isProgressData(data)) throw new Error(NOT_AN_EXPORT);
      if (!window.confirm(`Importing replaces the ${answers(history.length)} in this browser with the ${answers(data.history.length)} in this file. Continue?`)) return;
      importData(data);
      setMsg('Progress imported.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pace</h3>
        <p className="muted small">
          From Proficient on, a correct answer counts toward mastery only if it is within this time. Below Proficient only accuracy counts. The GRE gives about 1:45 per question (21 min for 12, 26 min for 15).
        </p>
        <div className="row">
          <input
            type="range"
            min={60}
            max={180}
            step={5}
            value={settings.paceSec}
            onChange={(e) => updateSettings({ paceSec: Number(e.target.value) })}
            aria-label="Pace per question"
          />
          <strong>{formatClock(settings.paceSec * 1000)}</strong>
          {settings.paceSec !== DEFAULT_PACE_SEC && (
            <button className="btn btn-ghost" onClick={() => updateSettings({ paceSec: DEFAULT_PACE_SEC })}>
              Reset to GRE pace
            </button>
          )}
        </div>
        <label className="row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={settings.showTimer} onChange={(e) => updateSettings({ showTimer: e.target.checked })} />
          Show the timer while answering
        </label>

        <h3>Daily goal</h3>
        <div className="row">
          <input
            type="number"
            min={MIN_DAILY_GOAL}
            max={MAX_DAILY_GOAL}
            step={1}
            value={goalText}
            onChange={(e) => {
              setGoalText(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isInteger(n) && n >= MIN_DAILY_GOAL && n <= MAX_DAILY_GOAL) updateSettings({ dailyGoal: n });
            }}
            onBlur={() => setGoalText(String(goal))}
            style={{ ...fieldStyle, width: 84 }}
            aria-label="Daily goal in answers"
          />
          <span>answers a day</span>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          The ring on the dashboard fills as you answer. Choose between {MIN_DAILY_GOAL} and {MAX_DAILY_GOAL}.
        </p>

        <h3>Exam date</h3>
        <div className="row">
          <input
            type="date"
            style={fieldStyle}
            value={settings.examDate ?? ''}
            onChange={(e) => updateSettings({ examDate: e.target.value || undefined })}
            aria-label="Exam date"
          />
          {settings.examDate && (
            <button className="btn btn-ghost" onClick={() => updateSettings({ examDate: undefined })}>
              Clear
            </button>
          )}
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Optional. The dashboard counts the days down to it.
        </p>

        <h3>Lessons before new skills</h3>
        <div className="tabs">
          {(
            [
              [true, 'On'],
              [false, 'Off'],
            ] as const
          ).map(([v, label]) => {
            const on = (settings.lessons !== false) === v;
            return (
              <button key={label} className={on ? 'on' : ''} aria-pressed={on} onClick={() => updateSettings({ lessons: v })}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          A short lesson comes before the first question of a new skill. You can reopen any lesson from Strategies or from a skill on the dashboard.
        </p>

        <h3>Theme</h3>
        <div className="tabs">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className={settings.theme === t ? 'on' : ''} aria-pressed={settings.theme === t} onClick={() => updateSettings({ theme: t })}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <h3>Animations</h3>
        <div className="tabs">
          {(
            [
              ['system', 'Follow system'],
              ['on', 'On'],
              ['off', 'Off'],
            ] as const
          ).map(([m, label]) => {
            const on = (settings.motion ?? 'system') === m;
            return (
              <button key={m} className={on ? 'on' : ''} aria-pressed={on} onClick={() => updateSettings({ motion: m })}>
                {label}
              </button>
            );
          })}
        </div>
        {(settings.motion ?? 'system') === 'system' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Your system asks for reduced motion, so animations are off. Choose On to see them anyway.
          </p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Your data</h3>
        <p className="muted small">
          Progress is stored in this browser only ({answers(history.length)} so far). Export it to keep a backup or to continue on another device.
        </p>
        <div className="row">
          <button className="btn" onClick={download}>
            Export progress
          </button>
          <button className="btn" onClick={() => file.current?.click()}>
            Import progress
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ''; // lets the same file be picked again
              if (f) upload(f);
            }}
          />
          <span className="spacer" />
          <button
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm('Erase all progress in this browser? Export it first if you want a backup.')) {
                reset();
                setMsg('Progress reset.');
              }
            }}
          >
            Reset progress
          </button>
        </div>
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
