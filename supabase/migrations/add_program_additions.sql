-- AI Coach exercise additions — exercises the coach proposes and the user confirms
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS program_additions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  day_id      text NOT NULL,
  exercise_name text NOT NULL,
  sets        integer NOT NULL DEFAULT 3,
  reps        text NOT NULL DEFAULT '10-15',
  rest        text NOT NULL DEFAULT '90 sec',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE program_additions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own additions" ON program_additions
  FOR ALL USING (auth.uid() = user_id);
