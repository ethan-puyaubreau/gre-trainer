# Going to production

The app is a static site on GitHub Pages. Everything works without a backend; accounts are an optional layer.

## What ships by default

- **Welcome page** (`src/pages/Welcome.tsx`): first-time visitors (no answers, welcome not finished) land there instead
  of an empty dashboard. It sets the daily goal and the exam date. Anyone with saved answers skips it.
- **Offline / installable** (`public/sw.js`, `public/manifest.webmanifest`): the service worker is registered in
  production builds only. Pages are network first with the cached shell as a fallback; hashed assets are cache first.
  The first visit precaches the shell, its JS/CSS and the KaTeX woff2 fonts. Bump `CACHE` in `sw.js` only to force a full
  re-download; normal deploys need nothing (new hashes, network-first `index.html`).
- **Accessibility**: skip link, labelled main nav, a heading on every page.

## Optional: accounts and cross-device sync (Supabase)

Off unless the build gets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. With them, Settings shows an
**Account & sync** card: passwordless email sign-in (magic link in the same browser, or the 6-digit code on any device),
then one JSON document per user, synced a few seconds after each change and when the tab is hidden or shown again.
The Supabase code is a lazy chunk: the default build never loads it.

### 1. Database

Run `supabase/migrations/20261105000000_gre_progress.sql` in the SQL editor (or `supabase db push`). It creates
`public.gre_progress` with row level security: a signed-in user can read and write only their own row; anonymous
users get nothing. `updated_at` is set by the server and used to detect concurrent changes.

**Shared project (e.g. an existing "Sentinel" project):** the table is prefixed so it can live next to other apps, but
note that **`auth.users` is shared by every app of a project**: one email = one user for all of them, and the email
templates and redirect allow-list are project-wide. If the other apps must not see GRE users, use a dedicated project
(the free tier is enough: one row of < 2 MB per user). If you need another table name, set `VITE_SUPABASE_TABLE`.

### 2. Auth settings (Dashboard → Authentication)

- **URL configuration**: Site URL `https://ethan-puyaubreau.github.io/gre-trainer/`, and add the same URL to the
  redirect allow-list (plus `http://localhost:5173/gre-trainer/` for development).
- **Email provider**: enabled, "Confirm email" on.
- **Email template "Magic Link"**: include the code so phone users can sign in on another device, e.g.
  `<p><a href="{{ .ConfirmationURL }}">Sign in</a></p><p>Or type this code: <b>{{ .Token }}</b></p>`.
- **SMTP**: the built-in sender is rate limited (a few emails per hour). Configure a real SMTP (Resend, Postmark, SES…)
  before launch.
- The app uses the PKCE flow: the link comes back as `?code=…`, which does not clash with the `#/` hash routes.

### 3. GitHub secrets

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | the project's **anon / publishable** key |

`deploy.yml` passes them to the build. **Never** use the `service_role` / secret key here: whatever the build receives is
public in the JavaScript bundle. The anon key is public by design; the RLS policies are what protect the data.

### Sync rules

`src/sync/decide.ts` (unit tested in `tests/sync.test.ts`):

| This browser | Cloud | Result |
| --- | --- | --- |
| anything | no row | upload |
| empty | has a row | download |
| changed since last sync | unchanged | upload |
| unchanged | changed | download |
| changed | changed (or other account) | ask: keep this browser's or the account's |

Signing out keeps the progress in the browser. "Delete cloud data" deletes the row (the auth user stays; delete it from
the dashboard if asked to erase an account).

## Launch checklist

- [ ] `npm test` and `npm run build` green on `main` (CI does both).
- [ ] Supabase: migration run, Site URL + redirect allow-list set, custom SMTP, magic-link template with `{{ .Token }}`.
- [ ] Secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` added; check the Account card appears on the live site.
- [ ] Sign in on two devices; answer on one, open the other: progress follows.
- [ ] Lighthouse PWA/accessibility pass on the live URL; install the app on a phone and open it in airplane mode.
- [ ] A privacy note (what is stored, how to delete it) linked from Settings if accounts are on, as required by GDPR for EU users.
