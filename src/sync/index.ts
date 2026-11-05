import { cloudEnabled } from './config';

/** Loads the Supabase code only when the build has a project configured. */
export const loadCloud = () => import('./cloud');

export function startCloudSync() {
  if (!cloudEnabled) return;
  void loadCloud()
    .then((m) => m.start())
    .catch(() => {
      // Offline on first visit: the chunk could not load. Sync starts on the next visit.
    });
}
