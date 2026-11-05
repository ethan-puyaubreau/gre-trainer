// The sync decision, kept free of Supabase so it can be unit tested.

export interface Side {
  /** Answers recorded (history length); 0 with no skills means an empty profile. */
  answers: number;
  empty: boolean;
}

export type Decision = 'push' | 'pull' | 'none' | 'conflict';

/**
 * What to do when this browser meets the cloud copy.
 * - no cloud row: push this browser's progress (if any);
 * - this browser empty, or unchanged since the last sync while the cloud moved on: take the cloud copy;
 * - cloud unchanged since our last sync: push our changes (or nothing);
 * - both changed (or another account's data is here): ask the user.
 */
export function decide(opts: {
  local: Side;
  remote: { updatedAt: string } | null;
  meta: { uid?: string; remoteUpdatedAt?: string; dirty: boolean };
  uid: string;
}): Decision {
  const { local, remote, meta, uid } = opts;
  if (!remote) return local.empty ? 'none' : 'push';
  if (local.empty) return 'pull';
  const sameAccount = meta.uid === uid;
  const cloudMoved = !sameAccount || meta.remoteUpdatedAt !== remote.updatedAt;
  if (!cloudMoved) return meta.dirty ? 'push' : 'none';
  if (sameAccount && !meta.dirty) return 'pull';
  return 'conflict';
}
