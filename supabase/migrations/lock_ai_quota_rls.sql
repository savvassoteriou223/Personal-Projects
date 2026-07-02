-- SECURITY: freeze the AI usage counters against client tampering.
-- Run in Supabase Dashboard -> SQL Editor.
--
-- WHY: the profiles UPDATE policy only froze is_premium / is_admin. The AI usage
-- counters (ai_calls_used, nutrition_calls_used and their reset timestamps) were
-- left writable by the owner, so a user could send
--     update profiles set ai_calls_used = 0 where id = <self>
-- and reset their own quota at will -> unlimited AI calls -> your Anthropic bill.
-- Only the Edge Functions (service role, which bypasses RLS) may change these.
--
-- This redefines the same "Users can update own profile" policy created by
-- add_admin_system.sql, adding the counter columns to the frozen set. Safe: the
-- client never legitimately changes these columns, so an unchanged value still
-- passes the WITH CHECK (equality holds); only an actual change is rejected.

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_premium               = (SELECT is_premium               FROM profiles WHERE id = auth.uid())
  AND is_admin                 = (SELECT is_admin                 FROM profiles WHERE id = auth.uid())
  AND ai_calls_used            = (SELECT ai_calls_used            FROM profiles WHERE id = auth.uid())
  AND ai_calls_reset_at        = (SELECT ai_calls_reset_at        FROM profiles WHERE id = auth.uid())
  AND nutrition_calls_used     = (SELECT nutrition_calls_used     FROM profiles WHERE id = auth.uid())
  AND nutrition_calls_reset_at = (SELECT nutrition_calls_reset_at FROM profiles WHERE id = auth.uid())
);
