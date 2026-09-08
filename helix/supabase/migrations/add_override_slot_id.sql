-- Stable slot identity for coach edits.
-- Edits used to be keyed by exercise_index, a POSITION that shifts under block
-- rotation, skip-learning and dedup — so a replayed edit could land on the wrong
-- exercise. slot_id names the slot's ROLE (dayId:pattern:occurrence) and is
-- generated client-side, so it cannot be backfilled in SQL; the client heals old
-- rows on read instead. Nullable + additive: rows without it keep using
-- exercise_index.
ALTER TABLE program_template_overrides
  ADD COLUMN IF NOT EXISTS slot_id text;
