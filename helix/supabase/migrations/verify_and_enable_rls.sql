-- SECURITY: confirm every user-data table enforces row-level security.
-- Run in Supabase Dashboard -> SQL Editor.
--
-- A table WITHOUT RLS is readable/writable by anyone holding the public anon key
-- (which ships in the app bundle) -> full data breach: any user can read every
-- other user's workouts, health metrics, nutrition, and weight history.

-- ── STEP 1: AUDIT ─────────────────────────────────────────────────────────────
-- Run this alone first. Any table it lists has RLS OFF and must be fixed.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- ── STEP 2: ENFORCE ───────────────────────────────────────────────────────────
-- Enable RLS + owner-only policies on the core tables. Idempotent (safe to re-run).
-- Each block is guarded by to_regclass(), so a table that doesn't exist in YOUR
-- schema is silently skipped instead of erroring. Owner column assumed to be
-- user_id (except completed_sets, scoped via its parent session). If STEP 1 lists
-- a table not covered here, copy a block and adjust the name/owner column.

-- user-owned tables keyed by a user_id column
DO $$
DECLARE
  t text;
  owned text[] := ARRAY[
    'workout_sessions',
    'daily_health_logs',
    'nutrition_logs',
    'weight_logs',       -- may not exist; guarded
    'body_weight_logs',  -- alt name; guarded
    'weights'            -- alt name; guarded
  ];
BEGIN
  FOREACH t IN ARRAY owned LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "users manage own %1$s" ON %1$I', t);
      EXECUTE format(
        'CREATE POLICY "users manage own %1$s" ON %1$I USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t
      );
      RAISE NOTICE 'RLS enforced on %', t;
    END IF;
  END LOOP;
END $$;

-- completed_sets — no user_id, scoped through its parent workout_sessions row.
DO $$
BEGIN
  IF to_regclass('public.completed_sets') IS NOT NULL THEN
    ALTER TABLE completed_sets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users manage own completed_sets" ON completed_sets;
    CREATE POLICY "users manage own completed_sets" ON completed_sets
      USING (EXISTS (SELECT 1 FROM workout_sessions ws
                     WHERE ws.id = completed_sets.session_id AND ws.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM workout_sessions ws
                     WHERE ws.id = completed_sets.session_id AND ws.user_id = auth.uid()));
    RAISE NOTICE 'RLS enforced on completed_sets';
  END IF;
END $$;

-- After STEP 2, re-run STEP 1 — it should return ZERO rows (ignoring public
-- read-only tables you intend to be open, e.g. exercise_gifs / app_config, which
-- have RLS ON with a deliberate public-read policy). Anything STILL listed is a
-- table this script didn't cover — tell me its name and I'll add a block.
