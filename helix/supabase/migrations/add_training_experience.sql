-- Add trainingExperience to profiles
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS "trainingExperience" text NOT NULL DEFAULT 'beginner';
