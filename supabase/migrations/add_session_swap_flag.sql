ALTER TABLE program_template_overrides
  ADD COLUMN IF NOT EXISTS is_session_swap boolean NOT NULL DEFAULT false;
