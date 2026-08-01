-- Scopes program_template_overrides to the split they were created under.
--
-- THE BUG: day IDs are reused across DIFFERENT splits — 'upper_a', 'full_body_a',
-- 'lower_b' etc. each appear in 2-4 separate split definitions (see SPLIT_DAYS in
-- screens/programGenerator.js). Overrides were fetched with no split filter at
-- all: `select('*').eq('user_id', user.id)`. A user who customises "Upper A" on
-- Upper/Lower 4x, then switches to Upper/Lower 6x — which ALSO has a day called
-- "Upper A", with a different exercise composition — has that old override
-- silently re-applied to the new split's same-named-but-different day. If the
-- new day happens to have a slot with the same (day_id, pattern, occurrence)
-- signature the old slot_id encodes, the edit lands on a real but WRONG
-- exercise; if not, it silently no-ops. Neither is correct — the override
-- belongs to a specific split's specific program shape, and nothing recorded
-- which one.
--
-- The exact same bug exists in program_additions (exercises the coach ADDED to
-- a day, as opposed to replaced/adjusted) — same day_id reuse, same missing
-- scope, same fix.
--
-- Apply in the Supabase dashboard, per project convention.

alter table public.program_template_overrides
  add column if not exists split_id text;

alter table public.program_additions
  add column if not exists split_id text;

-- Existing rows have no way to know which split they were written under —
-- leave them null rather than guess. The application code heals them on next
-- read (same pattern already used for legacy slot_id-less rows): a null-split
-- row is stamped with the CURRENT split only if it successfully resolves
-- against the CURRENT program, which is the closest honest guess available and
-- matches the existing slot_id healing precedent in the same read path.
