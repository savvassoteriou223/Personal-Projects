-- Push notification token — stored per user, updated on each sign-in.
-- The app only writes this after the user grants notification permission,
-- so NULL means the user has not granted permission or hasn't signed in yet.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
