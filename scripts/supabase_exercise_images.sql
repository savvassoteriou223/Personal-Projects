-- exercise_images table for AI-generated anatomical exercise renders
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS exercise_images (
  exercise_key TEXT    NOT NULL,  -- 'squat', 'deadlift', 'ohp', etc.
  phase_index  INTEGER NOT NULL,  -- 0 = setup, 1 = mid-movement, 2 = peak/lockout
  phase_name   TEXT,
  image_url    TEXT    NOT NULL,
  PRIMARY KEY (exercise_key, phase_index)
);

ALTER TABLE exercise_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read exercise_images"
  ON exercise_images FOR SELECT USING (true);
