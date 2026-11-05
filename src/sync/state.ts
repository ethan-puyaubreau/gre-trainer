import { create } from 'zustand';

export type SyncStatus = 'off' | 'loading' | 'signed-out' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface Conflict {
  localAnswers: number;
  cloudAnswers: number;
  cloudUpdatedAt: string;
}

export interface SyncState {
  status: SyncStatus;
  email?: string;
  lastSyncAt?: number;
  error?: string;
  conflict?: Conflict;
}

/** What the account UI shows; written only by the sync engine. Not persisted. */
export const useSync = create<SyncState>(() => ({ status: 'off' }));

const META_KEY = 'gre-trainer-sync-meta';

/** What this browser knows about the cloud copy: whose it is, its version at the last sync, and whether local progress changed since. */
export interface SyncMeta {
  uid?: string;
  remoteUpdatedAt?: string;
  dirty: boolean;
}

export function readMeta(): SyncMeta {
  try {
    const v = JSON.parse(localStorage.getItem(META_KEY) ?? 'null');
    if (v && typeof v === 'object') return { uid: v.uid, remoteUpdatedAt: v.remoteUpdatedAt, dirty: !!v.dirty };
  } catch {
    // Storage blocked or corrupted: start as if never synced.
  }
  return { dirty: true };
}

export function writeMeta(m: SyncMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // Storage blocked: the next start compares again from scratch.
  }
}

export function clearMeta() {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    // Nothing to clear.
  }
}
