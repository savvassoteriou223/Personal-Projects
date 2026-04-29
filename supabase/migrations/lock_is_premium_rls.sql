-- Prevent users from elevating their own is_premium flag.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).

-- 1. Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing broad update policy (adjust name if yours differs)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- 3. Re-create update policy that locks is_premium to its current value
--    (only the service role, which bypasses RLS, can change is_premium)
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_premium = (SELECT is_premium FROM profiles WHERE id = auth.uid())
);

-- 4. Ensure SELECT is allowed for own row (needed for the WITH CHECK subquery above)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- 5. Ensure INSERT is allowed on signup
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Note: DELETE on profiles is handled server-side by the delete-account Edge Function
-- which uses the service role key and therefore bypasses RLS.
