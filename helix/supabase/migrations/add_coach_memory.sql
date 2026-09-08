-- Persistent AI coach memory — gives the coach continuity across app sessions
-- so it behaves like a personal trainer who remembers you, instead of resetting
-- every time the screen closes.
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS coach_memory (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       text NOT NULL,        -- 'user' | 'assistant'
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;

-- Drop-then-create so the migration is safe to re-run (Postgres has no
-- CREATE POLICY IF NOT EXISTS).
DROP POLICY IF EXISTS "users manage own coach memory" ON coach_memory;
CREATE POLICY "users manage own coach memory" ON coach_memory
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS coach_memory_user_time ON coach_memory (user_id, created_at);
