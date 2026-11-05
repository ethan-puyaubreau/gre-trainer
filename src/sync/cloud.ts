// Supabase-backed sync. Loaded with a dynamic import only when cloud sync is configured, so the default build carries none of it.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { exportProgress, isProgressData, useProgress } from '../store/progress';
import { SUPABASE_ANON_KEY, SUPABASE_URL, SYNC_TABLE } from './config';
import { decide } from './decide';
import { clearMeta, readMeta, useSync, writeMeta } from './state';

const PUSH_DELAY_MS = 4000;

let client: SupabaseClient | null = null;
let session: Session | null = null;
let applying = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;

function sb(): SupabaseClient {
  // PKCE puts the sign-in code in the query string (?code=), which leaves the app's #/ hash routes alone.
  client ??= createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

const localSide = () => {
  const s = useProgress.getState();
  return { answers: s.history.length, empty: s.history.length === 0 && Object.keys(s.skills).length === 0 && s.sections.length === 0 };
};

const fail = (e: unknown) => useSync.setState({ status: 'error', error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });

async function fetchRemote(uid: string): Promise<{ data: unknown; updatedAt: string } | null> {
  const { data, error } = await sb().from(SYNC_TABLE).select('data, updated_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? { data: data.data, updatedAt: data.updated_at as string } : null;
}

async function push(uid: string) {
  useSync.setState({ status: 'syncing' });
  const payload = JSON.parse(exportProgress());
  const { data, error } = await sb().from(SYNC_TABLE).upsert({ user_id: uid, data: payload }).select('updated_at').single();
  if (error) throw error;
  writeMeta({ uid, remoteUpdatedAt: data.updated_at as string, dirty: false });
  useSync.setState({ status: 'synced', lastSyncAt: Date.now(), conflict: undefined, error: undefined });
}

function pull(uid: string, remote: { data: unknown; updatedAt: string }) {
  if (!isProgressData(remote.data)) throw new Error('The cloud copy is not a valid progress file.');
  applying = true;
  try {
    useProgress.getState().importData(remote.data);
  } finally {
    applying = false;
  }
  writeMeta({ uid, remoteUpdatedAt: remote.updatedAt, dirty: false });
  useSync.setState({ status: 'synced', lastSyncAt: Date.now(), conflict: undefined, error: undefined });
}

/** Compare this browser with the cloud and act; a conflict waits for the user. */
export async function reconcile() {
  const uid = session?.user.id;
  if (!uid) return;
  try {
    useSync.setState({ status: 'syncing' });
    const remote = await fetchRemote(uid);
    const meta = readMeta();
    const d = decide({ local: localSide(), remote, meta, uid });
    if (d === 'push') await push(uid);
    else if (d === 'pull') pull(uid, remote!);
    else if (d === 'none') {
      writeMeta({ uid, remoteUpdatedAt: remote?.updatedAt, dirty: false });
      useSync.setState({ status: 'synced', lastSyncAt: Date.now(), conflict: undefined });
    } else {
      const answers = isProgressData(remote!.data) ? remote!.data.history.length : 0;
      useSync.setState({ status: 'conflict', conflict: { localAnswers: localSide().answers, cloudAnswers: answers, cloudUpdatedAt: remote!.updatedAt } });
    }
  } catch (e) {
    fail(e);
  }
}

/** The user's answer to a conflict. */
export async function resolve(keep: 'local' | 'cloud') {
  const uid = session?.user.id;
  if (!uid) return;
  try {
    if (keep === 'local') await push(uid);
    else {
      const remote = await fetchRemote(uid);
      if (remote) pull(uid, remote);
    }
  } catch (e) {
    fail(e);
  }
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (useSync.getState().status === 'conflict') return;
    void reconcile();
  }, PUSH_DELAY_MS);
}

function onSession(next: Session | null) {
  const prevUid = session?.user.id;
  session = next;
  if (!next) {
    useSync.setState({ status: 'signed-out', email: undefined, conflict: undefined });
    return;
  }
  useSync.setState({ email: next.user.email });
  if (next.user.id !== prevUid) void reconcile();
}

/** Start once per page: restore the session (or finish a magic-link sign-in) and watch for local changes. */
export async function start() {
  if (started) return;
  started = true;
  useSync.setState({ status: 'loading' });
  const auth = sb().auth;
  auth.onAuthStateChange((_event, s) => {
    // Supabase advises against awaiting other calls inside this callback.
    setTimeout(() => onSession(s), 0);
  });
  try {
    const { data } = await auth.getSession();
    onSession(data.session);
  } catch (e) {
    fail(e);
  }
  // Remove ?code=… left by the magic link, keeping the hash route.
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') || url.searchParams.has('error_description')) {
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  useProgress.subscribe(() => {
    if (applying) return;
    const m = readMeta();
    if (!m.dirty) writeMeta({ ...m, dirty: true });
    if (session) schedulePush();
  });
  // Coming back to the tab (another device may have synced meanwhile).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session && useSync.getState().status !== 'conflict') void reconcile();
    if (document.visibilityState === 'hidden' && session && readMeta().dirty && useSync.getState().status !== 'conflict') {
      clearTimeout(pushTimer);
      void reconcile();
    }
  });
}

const redirectTo = () => window.location.origin + window.location.pathname;

export async function sendLink(email: string) {
  const { error } = await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
  if (error) throw error;
}

/** The 6-digit code from the same email: works on any device (the link only works in the browser that asked for it). */
export async function verifyCode(email: string, token: string) {
  const { error } = await sb().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

/** Sign out; this browser keeps its progress. */
export async function signOut() {
  await sb().auth.signOut();
  clearMeta();
}

/** Delete the cloud copy (this browser keeps its progress) and sign out. */
export async function deleteCloudData() {
  const uid = session?.user.id;
  if (!uid) return;
  const { error } = await sb().from(SYNC_TABLE).delete().eq('user_id', uid);
  if (error) throw error;
  await signOut();
}
