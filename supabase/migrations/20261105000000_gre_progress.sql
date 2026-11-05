-- GRE Quant Trainer: one progress document per signed-in user.
-- Safe to run in a shared Supabase project: one prefixed table, row level security on, no access for anonymous users.

create table if not exists public.gre_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  -- A full export is well under 2 MB (history is capped at 4000 answers); refuse anything far larger.
  constraint gre_progress_size check (octet_length(data::text) < 5000000)
);

alter table public.gre_progress enable row level security;

-- The server sets the version stamp, so clients with wrong clocks cannot win a sync race.
create or replace function public.gre_progress_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gre_progress_touch on public.gre_progress;
create trigger gre_progress_touch
  before insert or update on public.gre_progress
  for each row execute function public.gre_progress_touch();

drop policy if exists "gre_progress read own" on public.gre_progress;
drop policy if exists "gre_progress insert own" on public.gre_progress;
drop policy if exists "gre_progress update own" on public.gre_progress;
drop policy if exists "gre_progress delete own" on public.gre_progress;

create policy "gre_progress read own" on public.gre_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "gre_progress insert own" on public.gre_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "gre_progress update own" on public.gre_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gre_progress delete own" on public.gre_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.gre_progress from anon;
grant select, insert, update, delete on public.gre_progress to authenticated;
