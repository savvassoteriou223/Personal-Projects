-- Adaptive Response Engine — persistence for the closed n-of-1 loop.
-- Spec: docs/specs/adaptive-response-engine.md §10.
--
-- The engine itself (lib/individualModel.js, lib/adaptiveResponseEngine.js) is
-- pure and already shipped. It has no memory of its own: every verdict it
-- reaches is lost unless the learned parameters and the running trial are
-- persisted. These two tables are that memory.
--
-- Nothing changes about how sets are logged — ARE reads the existing
-- completed_sets. Apply in the Supabase dashboard, per project convention.

-- ── The Individual Response Model ────────────────────────────────────────────
-- One row per learned parameter, e.g. param_key 'volumeResponse:chest'. Written
-- only when an experiment concludes, so a row here always means "this was
-- actually tested on this person", never "assumed from the population".
create table if not exists public.are_individual_model (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  param_key   text        not null,
  value       jsonb       not null,
  effect      numeric,
  confidence  numeric     not null default 0.7,
  note        text,
  tested_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, param_key)
);

-- ── Experiments ──────────────────────────────────────────────────────────────
-- protocol_json is PRE-REGISTERED: the variable, both arms, what is held
-- constant, the outcome metric, the minimum detectable effect and the decision
-- rule are all fixed before the trial starts. That is what makes the verdict
-- honest rather than a post-hoc story, so the protocol must never be rewritten
-- once status leaves 'proposed'.
create table if not exists public.are_experiments (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  target_param      text        not null,
  protocol_json     jsonb       not null,
  -- proposed → the user has not opted in yet (§11: explicit opt-in, always)
  -- running   → an arm is live
  -- concluded → a verdict was reached and written into are_individual_model
  -- abandoned → user ended it, or a life event invalidated the window
  status            text        not null default 'proposed'
                    check (status in ('proposed','running','concluded','abandoned')),
  current_arm       text,
  arm_started_at    timestamptz,
  metric_points_json jsonb      not null default '[]'::jsonb,
  verdict           text        check (verdict in ('keep','revert','inconclusive')),
  verdict_detail    jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- The loop only ever asks two questions: "is there a live trial for this user?"
-- and "what has this user already run?"
create index if not exists are_experiments_user_status_idx
  on public.are_experiments (user_id, status);

-- One live trial at a time. Two concurrent trials would confound each other —
-- neither verdict could be trusted, which defeats the entire method.
create unique index if not exists are_experiments_one_running_per_user
  on public.are_experiments (user_id)
  where status = 'running';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Both tables are per-user and hold nothing the client should not see about
-- itself, so owner-only read/write is the whole policy.
alter table public.are_individual_model enable row level security;
alter table public.are_experiments      enable row level security;

drop policy if exists are_model_owner on public.are_individual_model;
create policy are_model_owner on public.are_individual_model
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists are_experiments_owner on public.are_experiments;
create policy are_experiments_owner on public.are_experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
