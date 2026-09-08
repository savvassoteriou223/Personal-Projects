-- Block tracking + AI coach overrides + skip tracking
-- Run in Supabase Dashboard → SQL Editor

-- ── 1. program_blocks ────────────────────────────────────────────────────────
-- One row per user. Tracks which training block they are on and when it started.
-- block_index drives exercise rotation in generateProgram(profile, blockIndex).

CREATE TABLE IF NOT EXISTS program_blocks (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  block_index      integer NOT NULL DEFAULT 0,
  block_start_date timestamptz NOT NULL DEFAULT now(),
  split_id         text,
  level            text NOT NULL DEFAULT 'beginner',
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE program_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own block" ON program_blocks
  FOR ALL USING (auth.uid() = user_id);

-- ── 2. program_template_overrides ────────────────────────────────────────────
-- Permanent AI coach edits to a user's program template.
-- Applied on top of generateProgram() output before rendering.

CREATE TABLE IF NOT EXISTS program_template_overrides (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_id         text NOT NULL,
  exercise_index integer NOT NULL,
  edit_type      text NOT NULL,  -- replace_exercise | adjust_sets | adjust_reps | adjust_rpe | add_exercise | remove_exercise
  pattern_key    text,
  exercise_id    text,
  sets           integer,
  reps           text,
  rpe            integer,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE program_template_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own overrides" ON program_template_overrides
  FOR ALL USING (auth.uid() = user_id);

-- ── 3. session_exercise_overrides ────────────────────────────────────────────
-- One-off session swaps. Scoped to a single session — do not affect the template.

CREATE TABLE IF NOT EXISTS session_exercise_overrides (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id             uuid REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id                uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_index         integer NOT NULL,
  pattern_key            text,
  exercise_id            text,
  original_exercise_name text,
  created_at             timestamptz DEFAULT now()
);

ALTER TABLE session_exercise_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own session overrides" ON session_exercise_overrides
  FOR ALL USING (auth.uid() = user_id);

-- ── 4. exercise_skips ────────────────────────────────────────────────────────
-- Recorded when a user skips or replaces an exercise mid-session.
-- Feeds the rotation trigger: 3+ skips = implicit swap signal.

CREATE TABLE IF NOT EXISTS exercise_skips (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_id    uuid REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  pattern_key   text,
  skipped_at    timestamptz DEFAULT now()
);

ALTER TABLE exercise_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own skips" ON exercise_skips
  FOR ALL USING (auth.uid() = user_id);

-- ── 5. completed_sets additions ───────────────────────────────────────────────
-- user_id: direct user reference for history queries without a join.
-- pattern_key: movement pattern the exercise belongs to (for rotation tracking).
-- completed_at: mirrors session timestamp so checkReadyToProgress can sort by date.

ALTER TABLE completed_sets
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pattern_key text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill user_id and completed_at from workout_sessions
UPDATE completed_sets cs
SET
  user_id      = ws.user_id,
  completed_at = ws.completed_at
FROM workout_sessions ws
WHERE cs.session_id = ws.id
  AND (cs.user_id IS NULL OR cs.completed_at IS NULL);

-- Index for fast per-user history lookups
CREATE INDEX IF NOT EXISTS idx_completed_sets_user_date
  ON completed_sets (user_id, completed_at DESC);
