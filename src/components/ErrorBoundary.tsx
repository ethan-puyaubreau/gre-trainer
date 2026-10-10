import { Component, type ReactNode } from 'react';
import { PROGRESS_KEY } from '../store/progress';

/** The raw persisted value, readable even when the state inside it is what crashed the app. */
function rawProgress(): string | null {
  try {
    return localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
}

function downloadRaw(raw: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  a.download = `gre-trainer-progress-raw-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function resetProgress() {
  if (!window.confirm('Erase all progress in this browser? Download it first if you want a backup.')) return;
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // storage unavailable: nothing to erase
  }
  window.location.reload();
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const raw = rawProgress();
    return (
      <div className="app">
        <main>
          <div className="card">
            <h1>Something went wrong</h1>
            <p className="muted small">
              The page crashed ({error.message}). Your progress is still saved in this browser: download a copy before you reset anything.
            </p>
            <div className="row">
              {raw && (
                <button className="btn" onClick={() => downloadRaw(raw)}>
                  Download progress
                </button>
              )}
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
              <span className="spacer" />
              <button className="btn btn-danger" onClick={resetProgress}>
                Reset progress
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}
