-- Structured durable facts the AI coach learns about the user (dislikes,
-- injuries/limitations, preferences, goals) — so it reasons over them every
-- session regardless of how long ago they were mentioned, instead of relying on
-- the raw transcript scrolling out of the context window.
-- Shape: [{ category, summary, exercise_name?, created_at }]
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coach_notes jsonb NOT NULL DEFAULT '[]'::jsonb;
