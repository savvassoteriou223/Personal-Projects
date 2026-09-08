-- Stores the AI Coach's automatic weekly narrative review (the paywall's
-- "Weekly narrative summary every Sunday"). One row per user per week; the
-- client generates it on the first Coach open of a new week and reads it back
-- thereafter, so it only ever generates once a week.

create table if not exists public.weekly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key date not null,            -- the Sunday that starts the week
  content text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_key)
);

alter table public.weekly_summaries enable row level security;

create policy "weekly_summaries_select_own" on public.weekly_summaries
  for select using (auth.uid() = user_id);

create policy "weekly_summaries_insert_own" on public.weekly_summaries
  for insert with check (auth.uid() = user_id);
