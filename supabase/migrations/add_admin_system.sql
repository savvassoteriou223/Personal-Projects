-- Admin system
-- Run in Supabase Dashboard → SQL Editor

-- 1. Add is_admin to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Lock is_admin so users cannot self-elevate (same pattern as is_premium)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_premium = (SELECT is_premium FROM profiles WHERE id = auth.uid())
  AND is_admin   = (SELECT is_admin   FROM profiles WHERE id = auth.uid())
);

-- 3. Admin emails table — only admins can read or write
CREATE TABLE IF NOT EXISTS admin_emails (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admin_emails" ON admin_emails;
CREATE POLICY "Admins can manage admin_emails"
ON admin_emails
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 4. Seed admin email
INSERT INTO admin_emails (email) VALUES ('savvas.soteriou223@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 5. Grant existing account admin + premium access
UPDATE profiles
SET is_admin = true, is_premium = true
FROM auth.users u
WHERE profiles.id = u.id AND u.email = 'savvas.soteriou223@gmail.com';

-- 6. Trigger: auto-grant admin to new signups whose email is in admin_emails
CREATE OR REPLACE FUNCTION auto_grant_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Use NEW.email directly — no need to join auth.users since profiles.email
  -- is populated from the same value by handle_new_user.
  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE email = NEW.email) THEN
    NEW.is_admin   := true;
    NEW.is_premium := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_grant_admin ON profiles;
CREATE TRIGGER trg_auto_grant_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION auto_grant_admin_on_signup();
