-- Self-reported readiness. Replaces the sensor input lost when Health Connect
-- was removed (2026-07-14) — feeds the proactive coach card and coach context.
-- A separate table (not daily_health_logs) because that table upserts on
-- (user_id, date) and is still written from HealthKit on iOS, so a check-in
-- would collide with a sensor row; it is also sensor-shaped, not categorical.
create table if not exists recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep text,      -- 'good' | 'ok' | 'poor'   (null when skipped)
  soreness text,   -- 'fresh' | 'normal' | 'sore'
  energy text,     -- 'high' | 'ok' | 'low'
  score int,       -- 0-6                       (null when skipped)
  label text,      -- 'Ready' | 'Moderate' | 'Low' (stable English, not translated)
  skipped boolean not null default false,
  applied boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table recovery_checkins enable row level security;

drop policy if exists "own checkins" on recovery_checkins;
create policy "own checkins" on recovery_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
