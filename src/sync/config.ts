// Cloud sync is optional: it is on only when the build was given a Supabase project (see docs/PRODUCTION.md).
// The anon key is public by design; the rows are protected by row level security.
const env = import.meta.env as Record<string, string | undefined>;

export const SUPABASE_URL = env.VITE_SUPABASE_URL?.trim() || undefined;
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY?.trim() || undefined;
/** Table holding one progress row per user (prefixed so it can live in a shared project). */
export const SYNC_TABLE = env.VITE_SUPABASE_TABLE?.trim() || 'gre_progress';
export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
