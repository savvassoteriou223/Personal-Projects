# Stable Slot IDs for Coach/Workout Edits — Design

**Date:** 2026-07-17
**Status:** Approved (design), pending spec review
**Scope:** Replace name+index exercise identity with a stable, deterministic **slot ID** so coach/workout edits always target the exercise the user meant. Client + one additive DB column. No edge-function, no schema-destructive change.

---

## 1. Problem (already root-caused — see memory `coach-edit-slot-identity`)

Edits are tracked by exercise **name** and **positional index** across two arrays that drift apart:
- The live in-workout list is not deduplicated; the stored program is (`deduplicateDayExercises` collapses all squat variants into one group).
- `program_template_overrides` rows store `exercise_index` and are replayed **sequentially** against an array that mutates between edits (TodayScreen applies each override via `applyPermanentEdit`, which re-runs filters).
- `saveProposal` relocates a proposal by name via `findIndex` → **first match**, so with two same-named exercises an edit meant for the second hits the first.

Confirmed reproduction (mjs harness): replacing an exercise with one sharing a base movement made dedup silently **delete a different, pre-existing exercise** (day count 2 → 1).

**Already shipped (commit `2ee9fc9`):** `applyPermanentEdit` no longer runs the whole-day dedup after a `replace_exercise`, so a replace can no longer delete a different exercise. That stopped the data loss. It did NOT fix wrong-slot targeting — this spec does.

## 2. Goals & success criteria

- An edit always targets the slot the user pointed at, regardless of duplicates, dedup, block rotation, or skip-learning.
- Existing users' saved coach edits keep working, and quietly migrate to the new identity.
- No `ai-coach` edge-function/prompt/tool-schema change; no edge deploy.
- No regression: `node --test lib/**/*.test.js` stays green; all screens parse; the Profile/Progress/workout flows verify live.

## 3. Non-goals

- The squat-group dedup semantics (`BASE_MOVEMENT_GROUP` collapsing all squats). The shipped safety fix covers the data loss; whether two squats *should* be allowed is a separate product decision.
- `session_exercise_overrides` (also `exercise_index`-keyed, but session-scoped and short-lived) — follow-up.
- Removing the `exercise_index` column (dual-read keeps it; dropping it is a later cleanup once rows have healed).

---

## 4. The slot ID

### 4.1 Format
```
slotId = `${dayId}:${patternKey}:${occurrence}`     e.g. "day_a:squat_pattern:0"
```
`occurrence` = 0-based index of that patternKey's repetition **within the day**.

**Empirical basis:** across 810 generated days (2 sexes × 3 levels × 5 day-counts × 3 equipment sets × 3 blocks) **no day repeats a patternKey** — so `occurrence` is always `0` today. The suffix is deliberate insurance: if a future split template ever repeats a pattern in one day, IDs stay unique instead of silently colliding (the exact bug class this spec removes).

### 4.2 The model: a slot ID names the ROLE, not the exercise
Stamped **at generation, from the template's patternKey, before any override/filter runs**. A `replace_exercise` swaps *what fills the slot*; the slot **keeps its ID**.

This is what makes it stable across the three things that break positional indices today:

| Event | Effect on array | Effect on slotId |
|---|---|---|
| Block rotation (`blockIndex`) | same patterns, different exercise picked | **unchanged** |
| Skip-learning / dislikes (`excludeIds`) | same pattern, different pick | **unchanged** |
| Dedup / contraindication filter | slots removed → positions shift | **unchanged** for survivors |
| Template change (split / sex / day-count) | different slots | changes — correct: the program genuinely changed, stale overrides should stop applying |

`buildExercise` already returns `pattern: patternKey` on every exercise, and `be()` stamps `_pattern` (`programGenerator.js:2525`), so the role is already present — it just isn't used as identity.

### 4.3 Where it's assigned
In `generateProgram`, after `days` is built (the `be(...)` lists are filtered by `.filter(Boolean)` at that point), walk each day and stamp `ex.slotId`, computing `occurrence` per `(day, pattern)`. This is one post-process in one place, before overrides/filters.

Coach-**added** exercises are not in the template: their slot ID is `${dayId}:added:${additionRowId}` — the `program_additions` row id is their stable identity (no new column needed there).

### 4.4 Invariants
- Every exercise in a generated program has a `slotId`.
- Slot IDs are unique within a day.
- `generateProgram` with identical inputs produces identical slot IDs (deterministic).
- `applyPermanentEdit`'s `replace_exercise` preserves the target slot's existing `slotId`.
- Filters/dedup never rewrite a surviving slot's `slotId`.

---

## 5. How edits target slots

### 5.1 Applying overrides
`applyPermanentEdit(program, edit, equipment)` resolves its target as:
1. `edit.slotId` present → `exercises.findIndex(e => e.slotId === edit.slotId)`. Not found → **no-op** (the slot is gone; silently skipping is correct and is what today's code cannot do safely).
2. `edit.slotId` absent (legacy row) → existing `edit.exerciseIndex` path, unchanged.

On `replace_exercise`, the new exercise inherits the slot's `slotId` (and the skip-dedup safety behaviour from `2ee9fc9` stays).

### 5.2 The live workout
`exerciseToSetState` carries `slotId` into the live `sets`. `applyCoachEdit` targets by `slotId` instead of `p.exercise_index`. **This is what removes the live-vs-stored divergence**: the live array and the stored program no longer need matching lengths or order for an edit to land correctly. The current `if (!inRange(idx)) idx = currentExIdx` fallback becomes unnecessary for slot-addressed edits.

### 5.3 The coach — no edge change
`buildContext` is client-side (`CoachScreen.jsx:345`, listing `day.exercises.map((ex, idx) => …)` at :380). The model's `exercise_index` is therefore a **transient wire format into a list the client itself built**.

At `saveProposal` time the client maps `exercise_index` → `slotId` **against the exact array it used to build that context**, and persists the slot ID. The name-based `findIndex` relocation (`CoachScreen.jsx:654`) — the first-match bug — is removed; `current_exercise` may remain only as a sanity check (mismatch → reject, as today).

Consequence: the `ai-coach` function, its `SYSTEM_PROMPT`, and its tool schemas are untouched. No deploy.

---

## 6. Backward compatibility

**Migration** (matching the `add_session_swap_flag.sql` precedent):
```sql
ALTER TABLE program_template_overrides
  ADD COLUMN IF NOT EXISTS slot_id text;
```
Nullable; no backfill in SQL (the program is client-generated, so SQL cannot compute slot IDs).

**Dual-read:** rows with `slot_id` resolve by slot; rows with `slot_id IS NULL` use the legacy `exercise_index` path exactly as today.

**Migrate-on-read:** when a legacy row resolves successfully via its index, the client writes the resolved `slot_id` back to that row. Rows heal as users open the app and the fragile path fades out without a risky bulk migration. Existing RLS already permits it: `CREATE POLICY "users manage own overrides" ON program_template_overrides FOR ALL USING (auth.uid() = user_id)`.

**Ordering / tolerance:** ⚠️ Per this project, **migrations are applied by hand in the Supabase dashboard** (memory `supabase-schema-drift`). The client must therefore tolerate `slot_id` not existing yet: writes that include `slot_id` would fail against an un-migrated table, so the client must not break if the column is absent. Simplest safe order: **apply the migration first, then ship the client**. The plan must call this out as a human step and gate the client release on it.

---

## 7. Testing

`screens/programGenerator.js` uses ESM `export` but the project is CommonJS, so `node --test` cannot import it directly. Use the established harness (memory `coach-edit-slot-identity` / `program-invariant-proof`): copy `programGenerator.js` + `movementLibrary.js` + `lib/conditionsDb.js` to `.mjs` (patch programGenerator's two relative imports; the other two import nothing) and test under node ESM.

Cases:
1. Every generated exercise has a `slotId`; slot IDs are unique within each day — asserted across a profile matrix (sexes × levels × day-counts × equipment × blocks).
2. **Stability:** the same slot keeps its ID across `blockIndex` changes and across `dislikedIds` exclusions.
3. `applyPermanentEdit` with `slotId` edits the right slot even when another exercise shares its name; preserves `slotId` on replace; no-ops when the slot is gone.
4. Legacy fallback: an edit with only `exerciseIndex` still applies as before.
5. The original repro: a replace that creates a same-base-movement duplicate does not mis-target or delete a different exercise.

Live verification (Expo web `:8081` + puppeteer, reviewer account `helixapptest@gmail.com`): a coach replace mid-workout lands on the intended card; the Program day still renders after reload.

## 8. Risks

- Touches the generator (core), override application, the coach save/apply path, and the live workout. Mitigate by keeping `slotId` **additive** (a new field), dual-read (legacy path untouched), and incremental tasks each verified by the harness.
- Migrate-on-read adds a write on a read path — make it best-effort and non-blocking (a failed backfill must never break rendering).
- The `program_additions` slot ID depends on the row id being available client-side where added exercises are materialised; verify before relying on it.
