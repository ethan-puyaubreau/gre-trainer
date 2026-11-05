import { useState } from 'react';
import { cloudEnabled } from '../sync/config';
import { loadCloud } from '../sync';
import { useSync } from '../sync/state';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Sign in to keep progress across devices. Hidden when the build has no cloud project. */
export function AccountCard() {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!cloudEnabled) return null;

  const run = async (f: (m: Awaited<ReturnType<typeof loadCloud>>) => Promise<void>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await f(await loadCloud());
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg((e as Error).message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const signedIn = sync.email && sync.status !== 'signed-out';

  return (
    <div className="card" id="account" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Account &amp; sync</h3>
      {sync.status === 'loading' && <p className="muted small">Checking your account…</p>}

      {!signedIn && sync.status !== 'loading' && (
        <>
          <p className="muted small">
            Optional. Sign in with your email to keep your progress on every device. No password: we email you a link and a 6-digit code. Only your email and your progress are stored, and you can delete them here at any time.
          </p>
          {!sent ? (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async (m) => {
                  await m.sendLink(email.trim());
                  setSent(true);
                });
              }}
            >
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
                className="field"
              />
              <button className="btn btn-primary" disabled={busy}>
                Email me a sign-in link
              </button>
            </form>
          ) : (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void run((m) => m.verifyCode(email.trim(), code.trim()));
              }}
            >
              <p className="small" style={{ flexBasis: '100%', margin: 0 }}>
                Check <b>{email}</b>. Open the link in this browser, or type the code here (works from any device).
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Code from the email"
                className="field"
                style={{ width: 130 }}
              />
              <button className="btn btn-primary" disabled={busy || code.trim().length < 6}>
                Sign in
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setSent(false)}>
                Use another email
              </button>
            </form>
          )}
        </>
      )}

      {signedIn && (
        <>
          <p className="small" style={{ marginTop: 0 }}>
            Signed in as <b>{sync.email}</b>.{' '}
            <span className="muted">
              {sync.status === 'syncing' && 'Syncing…'}
              {sync.status === 'synced' && sync.lastSyncAt && `Synced ${new Date(sync.lastSyncAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}.`}
            </span>
          </p>
          {sync.status === 'conflict' && sync.conflict && (
            <div className="sync-conflict" role="alert">
              <p className="small" style={{ marginTop: 0 }}>
                <b>Two different versions of your progress.</b> This browser has {sync.conflict.localAnswers} answers; your account has {sync.conflict.cloudAnswers}{' '}
                (saved {when(sync.conflict.cloudUpdatedAt)}). Which one should be kept? The other one is replaced.
              </p>
              <div className="row">
                <button className="btn" disabled={busy} onClick={() => void run((m) => m.resolve('local'))}>
                  Keep this browser's
                </button>
                <button className="btn" disabled={busy} onClick={() => void run((m) => m.resolve('cloud'))}>
                  Keep my account's
                </button>
              </div>
            </div>
          )}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => void run((m) => m.reconcile(), 'Sync checked.')}>
              Sync now
            </button>
            <button className="btn" disabled={busy} onClick={() => void run((m) => m.signOut(), 'Signed out. Your progress stays in this browser.')}>
              Sign out
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Delete the copy of your progress stored in your account? This browser keeps its own copy.'))
                  void run((m) => m.deleteCloudData(), 'Cloud copy deleted.');
              }}
            >
              Delete cloud data
            </button>
          </div>
        </>
      )}

      {sync.status === 'error' && sync.error && <p className="small" style={{ color: 'var(--bad)' }}>Sync error: {sync.error}</p>}
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}

/** A one-line banner on every page while a conflict waits, so it is not missed. */
export function SyncConflictBanner() {
  const status = useSync((s) => s.status);
  if (status !== 'conflict') return null;
  return (
    <div className="sync-banner" role="status">
      Your progress differs between this browser and your account. <a href="#/settings">Choose which to keep</a>.
    </div>
  );
}
