-- exercise_gifs: stores Supabase Storage URLs keyed by normalised exercise name.
-- Seeded via scripts/seedExerciseGifsByName.js (service-role key).
-- Anon users only need SELECT to display GIFs in the app.

CREATE TABLE IF NOT EXISTS exercise_gifs (
  name       text PRIMARY KEY,
  gif_url    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exercise_gifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read exercise_gifs" ON exercise_gifs;
CREATE POLICY "Public read exercise_gifs"
  ON exercise_gifs FOR SELECT
  USING (true);
