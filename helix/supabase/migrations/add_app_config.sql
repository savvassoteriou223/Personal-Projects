-- Drives the in-app "Update available" banner (lib/updateCheck.js + App.js).
-- The app compares its running version against latest_version; if latest_version
-- is higher, the banner appears. Without this table the check silently fails and
-- the banner never shows.
--
-- TO RELEASE AN UPDATE: ship the new build, then bump latest_version here to the
-- new app.json "version" (e.g. '1.0.1'). Existing users on the older version will
-- then see the banner on next launch.
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS app_config (
  id             int PRIMARY KEY DEFAULT 1,
  latest_version text NOT NULL DEFAULT '1.0.0',
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT app_config_singleton CHECK (id = 1)  -- exactly one config row
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Read-only to all clients; only the dashboard/service role writes it.
DROP POLICY IF EXISTS "anyone can read app config" ON app_config;
CREATE POLICY "anyone can read app config" ON app_config
  FOR SELECT USING (true);

-- Seed the current shipped version so nobody is wrongly told to update.
INSERT INTO app_config (id, latest_version) VALUES (1, '1.0.0')
  ON CONFLICT (id) DO NOTHING;
