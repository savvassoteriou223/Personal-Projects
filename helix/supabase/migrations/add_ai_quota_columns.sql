-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_calls_used    integer   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_calls_reset_at timestamptz NOT NULL DEFAULT now();
