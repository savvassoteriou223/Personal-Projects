-- Add sports to profiles — saved by onboarding and the profile editor.
-- Missing in the live DB, which made every profile save fail with 42703.
-- Shape: array of objects [{ key, label, days: ['Monday', ...] }], so jsonb.
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sports jsonb NOT NULL DEFAULT '[]'::jsonb;
