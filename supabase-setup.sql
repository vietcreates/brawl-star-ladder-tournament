-- Brawl Stars Ladder — Supabase setup
-- Paste this into Supabase → SQL Editor → New query → Run.

-- 1. One row holds the entire tournament state as JSON.
create table if not exists public.tournament_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Row Level Security: anyone can read AND write (PIN is enforced client-side).
--    This is simple and appropriate for a casual tournament app.
alter table public.tournament_state enable row level security;

drop policy if exists "public read" on public.tournament_state;
create policy "public read"
  on public.tournament_state for select
  using (true);

drop policy if exists "public insert" on public.tournament_state;
create policy "public insert"
  on public.tournament_state for insert
  with check (true);

drop policy if exists "public update" on public.tournament_state;
create policy "public update"
  on public.tournament_state for update
  using (true);

-- 3. Real-time: broadcast changes so all phones update live.
alter publication supabase_realtime add table public.tournament_state;

-- 4. Seed the single row the app uses.
insert into public.tournament_state (id, data)
values ('main', '{"players":[],"rounds":[],"activeRound":1}')
on conflict (id) do nothing;
