-- Per-request token accounting for the AI coach.
--
-- One user message can fan out into many model calls while costing the user a
-- single quota unit, so the only figure that reflects real spend is the sum
-- across every call a request made. console.log was the first attempt at
-- recording this, but the project's edge-function log view only surfaces
-- boot/shutdown events — the spend lines never appeared. A table is queryable
-- from the SQL editor, survives log retention, and can be aggregated.
--
-- Insert-only from the edge function (service role). Users may read their own
-- rows; nobody may write via the client, so the numbers can't be forged.

create table if not exists public.ai_usage_log (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  mode          text,                       -- 'chat' | 'weekly_summary'
  calls         integer not null default 0, -- model calls made for this ONE user message
  input_tokens      integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens  integer not null default 0,
  output_tokens      integer not null default 0
);

create index if not exists ai_usage_log_user_created_idx
  on public.ai_usage_log (user_id, created_at desc);
create index if not exists ai_usage_log_created_idx
  on public.ai_usage_log (created_at desc);

alter table public.ai_usage_log enable row level security;

-- Read-only for the owner. No insert/update/delete policy for authenticated
-- users at all: the service-role key used by the edge function bypasses RLS,
-- so the function can still write while clients cannot.
drop policy if exists "own usage readable" on public.ai_usage_log;
create policy "own usage readable"
  on public.ai_usage_log for select
  using (auth.uid() = user_id);

comment on table public.ai_usage_log is
  'Token spend per ai-coach request. calls = model calls for one user message; a sweep fans out to several. Billable input = input + cache_write + cache_read, each at a different rate.';
