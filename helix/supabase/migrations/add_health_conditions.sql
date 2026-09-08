-- Add health_conditions array to profiles for contraindication filtering
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS health_conditions text[] NOT NULL DEFAULT '{}';
