import { useRef, useState } from 'react';
import { formatClock } from '../components/Timer';
import { DEFAULT_PACE_SEC } from '../mastery/model';
import { exportProgress, isProgressData, NOT_AN_EXPORT, useProgress } from '../store/progress';

const answers = (k: number) => `${k} answer${k === 1 ? '' : 's'}`;

export function Settings() {
  const { settings, updateSettings, importData, reset, history } = useProgress();
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

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
          A correct answer counts toward mastery only if it is within this time. The GRE gives about 1:45 per question (21 min for 12, 26 min for 15).
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
