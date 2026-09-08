# Stable Slot IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every exercise slot a stable, deterministic ID so coach/workout edits always target the exercise the user meant — never the wrong one.

**Architecture:** `generateProgram` stamps `slotId = ${dayId}:${pattern}:${occurrence}` on every exercise at the end of generation (from the template's patternKey — the slot's *role*). Edits resolve by `slotId`, with the legacy `exerciseIndex` path kept as a fallback for rows written before this change. The coach's `exercise_index` stays a transient wire format that the client converts to a `slotId` at save time, so the `ai-coach` edge function is untouched.

**Tech Stack:** Expo SDK 56 / React Native 0.85, Supabase (Postgres + RLS), `react-i18next`. Tests: `node --test` for `lib/`, plus a copy-to-`.mjs` harness for `screens/programGenerator.js`.

## Global Constraints

- **Slot ID format:** `` `${dayId}:${patternKey}:${occurrence}` `` — occurrence is the 0-based repetition index of that patternKey **within the day**. Verified across 810 generated days: a patternKey never repeats in a day, so occurrence is always `0`; the suffix exists so a future split that repeats a pattern collides never-silently.
- **A slot ID names the ROLE, not the exercise.** `replace_exercise` swaps what fills the slot; the slot **keeps its `slotId`**.
- **Additive only.** `slotId` is a new field; `exercise_index` and its code path stay working. No destructive schema change.
- **No `ai-coach` edge-function, SYSTEM_PROMPT, or tool-schema change. No edge deploy.**
- **Keep the shipped safety fix:** `applyPermanentEdit` must continue to skip `deduplicateDayExercises` for `replace_exercise` (commit `2ee9fc9`). Do not re-introduce it.
- **Migrations are applied BY HAND in the Supabase dashboard** (memory `supabase-schema-drift`). The migration must land **before** the client ships. Client code must not break if `slot_id` is absent.
- Design system: colors from `lib/theme.js`, no raw hex; buttons use `components/Tappable`.
- `screens/programGenerator.js` uses ESM `export` but the project is CommonJS — `node --test` cannot import it. Use the `.mjs` harness (below).

---

## The `.mjs` harness (used by Tasks 1–2)

`programGenerator.js` imports only `./movementLibrary` and `../lib/conditionsDb`; neither of those imports anything. To test it under node:

```bash
cd c:/Users/user/fitpulse
mkdir -p .tmp_slot
sed -E "s#from '\./movementLibrary'#from './movementLibrary.mjs'#; s#from '\.\./lib/conditionsDb'#from './conditionsDb.mjs'#" screens/programGenerator.js > .tmp_slot/pg.mjs
cp screens/movementLibrary.js .tmp_slot/movementLibrary.mjs
cp lib/conditionsDb.js .tmp_slot/conditionsDb.mjs
```
Re-run those 4 lines after ANY edit to `programGenerator.js` (the copy is a snapshot). Clean up with `rm -rf .tmp_slot` when done. `.tmp_slot/` is scratch — do not commit it; add it to `.gitignore` in Task 1 if not already ignored.

## Verification block (referenced as "VERIFY(files)")

1. **Parse-check** each changed `.jsx`/`.js`:
   ```bash
   node -e "require('@babel/core').transformFileSync('<FILE>',{presets:['babel-preset-expo'],configFile:false});console.log('<FILE> OK')"
   ```
2. **Suite stays green:** `node --test lib/**/*.test.js` → currently `pass 12 / fail 0`. Report the real number.
3. Do NOT run Expo/Metro/screenshots — the orchestrator handles visual verification.

---

## Task 1: Stamp `slotId` in `generateProgram`

**Files:**
- Modify: `screens/programGenerator.js` (insert immediately after the dedup map that ends ~`:3408`, before `const sportEntries = ...`)
- Create: `.tmp_slot/slotid.test.mjs` (harness test — scratch, not committed)
- Modify: `.gitignore` (add `.tmp_slot/` if absent)

**Interfaces:**
- Produces: every exercise object returned by `generateProgram(...)` gains `slotId: string` of the form `` `${day.id}:${ex.pattern}:${n}` ``. `buildExercise` already returns `pattern: patternKey`, so no change there. Later tasks rely on `ex.slotId` existing on generated exercises.

- [ ] **Step 1: Write the failing harness test** — create `.tmp_slot/slotid.test.mjs`:

```js
import { generateProgram } from './pg.mjs';
import assert from 'node:assert';

const EQUIP = [
  ['barbell','dumbbell','machine','cable','bodyweight','smith_machine','kettlebell','bands','pull_up_bar'],
  ['dumbbell','bodyweight'],
  ['bodyweight'],
];
const mk = (sex, lvl, d, equipment) => ({ sex, trainingExperience: lvl, equipment, days_per_week: d, goals: ['hypertrophy'] });

let days = 0;
for (const sex of ['male','female'])
  for (const lvl of ['beginner','intermediate','advanced'])
    for (const d of [2,3,4,5,6])
      for (const equipment of EQUIP)
        for (const block of [0,1,2]) {
          const prog = generateProgram(mk(sex,lvl,d,equipment), block, null, {});
          for (const day of prog?.days || []) {
            days++;
            const ids = day.exercises.map(e => e.slotId);
            assert.ok(ids.every(Boolean), `missing slotId in ${day.id} (${sex}/${lvl}/${d}d/block${block})`);
            assert.strictEqual(new Set(ids).size, ids.length, `duplicate slotId in ${day.id}: ${ids}`);
            for (const ex of day.exercises) {
              assert.strictEqual(ex.slotId, `${day.id}:${ex.pattern}:0`, `unexpected slotId ${ex.slotId}`);
            }
          }
        }
assert.ok(days > 500, `expected a broad matrix, got ${days} days`);

// Determinism: same inputs -> same ids
const a = generateProgram(mk('male','intermediate',4,EQUIP[0]), 0, null, {});
const b = generateProgram(mk('male','intermediate',4,EQUIP[0]), 0, null, {});
assert.deepStrictEqual(
  a.days.map(d => d.exercises.map(e => e.slotId)),
  b.days.map(d => d.exercises.map(e => e.slotId)),
  'slotIds must be deterministic for identical inputs');

// Stability across block rotation: the same ROLE keeps its id even though the exercise changes
const b0 = generateProgram(mk('male','intermediate',4,EQUIP[0]), 0, null, {});
const b1 = generateProgram(mk('male','intermediate',4,EQUIP[0]), 1, null, {});
assert.deepStrictEqual(
  b0.days.map(d => d.exercises.map(e => e.slotId)),
  b1.days.map(d => d.exercises.map(e => e.slotId)),
  'slotIds must be stable across blockIndex');

// Stability across skip-learning: excluding a picked exercise keeps the slot's id
const base = generateProgram(mk('male','intermediate',4,EQUIP[0]), 0, null, {});
const pickedId = base.days[0].exercises[0].id;
const withDislike = generateProgram(mk('male','intermediate',4,EQUIP[0]), 0, null, { dislikedIds: [pickedId] });
assert.strictEqual(withDislike.days[0].exercises[0].slotId, base.days[0].exercises[0].slotId,
  'slotId must survive a disliked exercise being swapped out of the slot');

console.log(`slotId tests PASSED across ${days} days`);
```

- [ ] **Step 2: Build the harness and run the test — expect FAIL**

```bash
cd c:/Users/user/fitpulse && mkdir -p .tmp_slot
sed -E "s#from '\./movementLibrary'#from './movementLibrary.mjs'#; s#from '\.\./lib/conditionsDb'#from './conditionsDb.mjs'#" screens/programGenerator.js > .tmp_slot/pg.mjs
cp screens/movementLibrary.js .tmp_slot/movementLibrary.mjs
cp lib/conditionsDb.js .tmp_slot/conditionsDb.mjs
cd .tmp_slot && node slotid.test.mjs
```
Expected: FAIL — `missing slotId in day_a (...)` (AssertionError), because nothing stamps it yet.

- [ ] **Step 3: Implement the stamp** — in `screens/programGenerator.js`, immediately AFTER the dedup map:

```js
  days = days.map(day => ({
    ...day,
    exercises: deduplicateDayExercises(day.exercises || [], equipment, level, dislikedIds),
  }));
```
insert:

```js
  // ─── Stable slot identity ──────────────────────────────────────────────────
  // Edits (coach overrides, live swaps) must target the SLOT — its ROLE in the
  // day — not a position in an array. Positions shift under block rotation,
  // skip-learning and dedup; the slot's pattern does not. Stamped once, here, so
  // every consumer sees the same id and no later filter has to recompute it.
  // `occurrence` is always 0 today (verified across 810 generated days: a
  // patternKey never repeats within a day). It exists so that if a future split
  // template ever does repeat one, the ids stay unique instead of silently
  // colliding — which is the exact bug class this identity removes.
  days = days.map(day => {
    const seen = {};
    return {
      ...day,
      exercises: (day.exercises || []).map(ex => {
        if (!ex) return ex;
        const n = seen[ex.pattern] = (seen[ex.pattern] ?? -1) + 1;
        return { ...ex, slotId: `${day.id}:${ex.pattern}:${n}` };
      }),
    };
  });
```

- [ ] **Step 4: Rebuild the harness and re-run — expect PASS**

```bash
cd c:/Users/user/fitpulse
sed -E "s#from '\./movementLibrary'#from './movementLibrary.mjs'#; s#from '\.\./lib/conditionsDb'#from './conditionsDb.mjs'#" screens/programGenerator.js > .tmp_slot/pg.mjs
cd .tmp_slot && node slotid.test.mjs
```
Expected: PASS — `slotId tests PASSED across 810 days`.

- [ ] **Step 5: VERIFY(`screens/programGenerator.js`)** — parse-check it, and `node --test lib/**/*.test.js` → `pass 12 / fail 0`.

- [ ] **Step 6: Commit** (ensure `.tmp_slot/` is gitignored; do not commit it)

```bash
git add screens/programGenerator.js .gitignore
git commit -m "Stamp deterministic slotId (dayId:pattern:occurrence) on every generated slot"
```

---

## Task 2: `applyPermanentEdit` resolves by `slotId`

**Files:**
- Modify: `screens/programGenerator.js` — `applyPermanentEdit` (starts `:2287`; the `days.map` target-resolution at `:2290-2296`)
- Create: `.tmp_slot/applyedit.test.mjs` (harness test — scratch)

**Interfaces:**
- Consumes: `ex.slotId` from Task 1.
- Produces: `applyPermanentEdit(program, edit, equipment)` where `edit` MAY carry `slotId: string`. Resolution order: `edit.slotId` → `exercises.findIndex(e => e.slotId === edit.slotId)`; if `slotId` is absent, fall back to `edit.exerciseIndex` exactly as today. A `slotId` that matches nothing is a **no-op** (the slot is gone). `replace_exercise` preserves the target's existing `slotId`. Later tasks pass `slotId` in the edit object.

- [ ] **Step 1: Write the failing harness test** — create `.tmp_slot/applyedit.test.mjs`:

```js
import { applyPermanentEdit } from './pg.mjs';
import assert from 'node:assert';

const EQUIP = ['barbell','dumbbell','machine','cable','bodyweight'];
const mkProgram = () => ({ days: [{ id: 'legs', name: 'Legs', exercises: [
  { id: 'lying_leg_curl', name: 'Lying leg curl', pattern: 'hamstring_isolation', slotId: 'legs:hamstring_isolation:0', sets: 3, reps: '10–15' },
  { id: 'pendulum_squat', name: 'Pendulum squat', pattern: 'squat_pattern', slotId: 'legs:squat_pattern:0', sets: 3, reps: '6–12' },
]}]});

// 1. Targets by slotId — edits the SECOND slot, not the first
let out = applyPermanentEdit(mkProgram(), {
  type: 'replace_exercise', dayId: 'legs', slotId: 'legs:squat_pattern:0',
  patternKey: 'squat_pattern', preferExerciseId: 'hack_squat',
}, EQUIP);
assert.strictEqual(out.days[0].exercises.length, 2, 'no slot may be dropped');
assert.strictEqual(out.days[0].exercises[0].name, 'Lying leg curl', 'must not touch the other slot');
assert.strictEqual(out.days[0].exercises[1].id, 'hack_squat', 'must replace the slotId-addressed exercise');

// 2. replace_exercise PRESERVES the slot's identity
assert.strictEqual(out.days[0].exercises[1].slotId, 'legs:squat_pattern:0',
  'a replace swaps the exercise, the slot keeps its id');

// 3. Unknown slotId is a no-op (slot is gone)
out = applyPermanentEdit(mkProgram(), {
  type: 'replace_exercise', dayId: 'legs', slotId: 'legs:does_not_exist:0',
  patternKey: 'squat_pattern', preferExerciseId: 'hack_squat',
}, EQUIP);
assert.deepStrictEqual(out.days[0].exercises.map(e => e.id), ['lying_leg_curl','pendulum_squat'],
  'an unresolvable slotId must change nothing');

// 4. Legacy fallback: no slotId -> exerciseIndex still works
out = applyPermanentEdit(mkProgram(), {
  type: 'replace_exercise', dayId: 'legs', exerciseIndex: 1,
  patternKey: 'squat_pattern', preferExerciseId: 'hack_squat',
}, EQUIP);
assert.strictEqual(out.days[0].exercises[1].id, 'hack_squat', 'legacy exerciseIndex path must still apply');
assert.strictEqual(out.days[0].exercises.length, 2, 'legacy path must not drop a slot either');

// 5. adjust_sets by slotId
out = applyPermanentEdit(mkProgram(), { type: 'adjust_sets', dayId: 'legs', slotId: 'legs:squat_pattern:0', sets: 5 }, EQUIP);
assert.strictEqual(out.days[0].exercises[1].sets, 5);
assert.strictEqual(out.days[0].exercises[1].slotId, 'legs:squat_pattern:0');

console.log('applyPermanentEdit slotId tests PASSED');
```

- [ ] **Step 2: Rebuild harness, run — expect FAIL**

```bash
cd c:/Users/user/fitpulse
sed -E "s#from '\./movementLibrary'#from './movementLibrary.mjs'#; s#from '\.\./lib/conditionsDb'#from './conditionsDb.mjs'#" screens/programGenerator.js > .tmp_slot/pg.mjs
cd .tmp_slot && node applyedit.test.mjs
```
Expected: FAIL — with no `slotId` support, `edit.exerciseIndex` is `undefined` → `idx = -1` → the replace is skipped, so `exercises[1].id` is still `pendulum_squat`.

- [ ] **Step 3: Implement slotId resolution** — in `applyPermanentEdit`, replace:

```js
    let exercises = [...day.exercises];
    const idx = edit.exerciseIndex ?? -1;
```
with:

```js
    let exercises = [...day.exercises];
    // Resolve the target SLOT. slotId is the durable identity (survives block
    // rotation, skip-learning and dedup); exerciseIndex is the legacy path for
    // override rows written before slot ids existed. An unresolvable slotId is a
    // no-op: the slot is gone, and editing "whatever is at some index" instead is
    // exactly the wrong-target bug this replaces.
    const idx = edit.slotId != null
      ? exercises.findIndex(e => e?.slotId === edit.slotId)
      : (edit.exerciseIndex ?? -1);
```

and in the `replace_exercise` case, change:

```js
          if (newEx) exercises[idx] = newEx;
```
to:

```js
          // The slot keeps its identity — a replace changes what FILLS the slot,
          // not which slot it is. Without this the id would follow the new
          // exercise's pattern and the next edit would miss.
          if (newEx) exercises[idx] = { ...newEx, slotId: current.slotId };
```

- [ ] **Step 4: Rebuild harness, re-run — expect PASS**

```bash
cd c:/Users/user/fitpulse
sed -E "s#from '\./movementLibrary'#from './movementLibrary.mjs'#; s#from '\.\./lib/conditionsDb'#from './conditionsDb.mjs'#" screens/programGenerator.js > .tmp_slot/pg.mjs
cd .tmp_slot && node applyedit.test.mjs && node slotid.test.mjs
```
Expected: both PASS (Task 1's test must still pass).

- [ ] **Step 5: VERIFY(`screens/programGenerator.js`)** — parse-check; `node --test lib/**/*.test.js` → `pass 12 / fail 0`.

- [ ] **Step 6: Commit**

```bash
git add screens/programGenerator.js
git commit -m "applyPermanentEdit: resolve target by slotId, preserve slot identity on replace"
```

---

## Task 3: Migration + dual-read + migrate-on-read

**Files:**
- Create: `supabase/migrations/add_override_slot_id.sql`
- Modify: `screens/TodayScreen.jsx:277-291` (the `overrides.forEach(o => applyPermanentEdit(...))` mapping)

**Interfaces:**
- Consumes: `applyPermanentEdit` accepting `edit.slotId` (Task 2); `ex.slotId` on generated exercises (Task 1).
- Produces: override rows may carry `slot_id`. TodayScreen passes `slotId: o.slot_id` into the edit; when a legacy row (`slot_id == null`) resolves via its index, TodayScreen best-effort writes the resolved `slot_id` back.

- [ ] **Step 1: Write the migration** — create `supabase/migrations/add_override_slot_id.sql`:

```sql
-- Stable slot identity for coach edits.
-- Edits used to be keyed by exercise_index, a POSITION that shifts under block
-- rotation, skip-learning and dedup — so a replayed edit could land on the wrong
-- exercise. slot_id names the slot's ROLE (dayId:pattern:occurrence) and is
-- generated client-side, so it cannot be backfilled in SQL; the client heals old
-- rows on read instead. Nullable + additive: rows without it keep using
-- exercise_index.
ALTER TABLE program_template_overrides
  ADD COLUMN IF NOT EXISTS slot_id text;
```

- [ ] **Step 2: HUMAN STEP — apply the migration**

⚠️ This project applies migrations BY HAND in the Supabase dashboard (SQL Editor). **This must be applied BEFORE the client that writes `slot_id` ships**, or those writes fail against an un-migrated table. Ask the user to run `supabase/migrations/add_override_slot_id.sql`, then verify live:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/program_template_overrides?select=slot_id&limit=0"
```
Expected: `200` (the column exists). A `400` means it is not applied yet — STOP and report; do not proceed to Step 3.

- [ ] **Step 3: Dual-read + migrate-on-read** — in `screens/TodayScreen.jsx`, replace:

```js
        if (overrides?.length) {
          const equipment = normalizeEquipment(prof.equipment || []);
          overrides.forEach(o => {
            prog = applyPermanentEdit(prog, {
              type: o.edit_type,
              dayId: o.day_id,
              exerciseIndex: o.exercise_index,
              patternKey: o.pattern_key,
              preferExerciseId: o.exercise_id,
              sets: o.sets,
              reps: o.reps,
              rpe: o.rpe,
            }, equipment);
          });
        }
```
with:

```js
        if (overrides?.length) {
          const equipment = normalizeEquipment(prof.equipment || []);
          overrides.forEach(o => {
            // Legacy rows (written before slot ids) have no slot_id and still
            // resolve by position. Resolve the slot BEFORE applying the edit so we
            // can heal the row: the pre-edit array is the one its index refers to.
            let healSlotId = null;
            if (!o.slot_id) {
              const day = prog.days?.find(d => d.id === o.day_id);
              healSlotId = day?.exercises?.[o.exercise_index]?.slotId ?? null;
            }
            prog = applyPermanentEdit(prog, {
              type: o.edit_type,
              dayId: o.day_id,
              slotId: o.slot_id ?? healSlotId ?? undefined,
              exerciseIndex: o.exercise_index,
              patternKey: o.pattern_key,
              preferExerciseId: o.exercise_id,
              sets: o.sets,
              reps: o.reps,
              rpe: o.rpe,
            }, equipment);
            // Best-effort heal: upgrade the row to slot identity so it stops
            // depending on position. Never block rendering on it.
            if (!o.slot_id && healSlotId) {
              supabase.from('program_template_overrides')
                .update({ slot_id: healSlotId })
                .eq('id', o.id)
                .then(() => {}, () => {});
            }
          });
        }
```

Note: passing `slotId: healSlotId` means a legacy row resolves by slot on THIS render too (identical target — it was derived from that same index), so behaviour is unchanged while the row heals.

- [ ] **Step 4: VERIFY(`screens/TodayScreen.jsx`)** — parse-check; `node --test lib/**/*.test.js` → `pass 12 / fail 0`. (No harness test: this path needs Supabase + a generated program; the orchestrator verifies it live.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/add_override_slot_id.sql screens/TodayScreen.jsx
git commit -m "Override slot_id: migration + dual-read + best-effort migrate-on-read"
```

---

## Task 4: Carry `slotId` into the live workout

**Files:**
- Modify: `screens/WorkoutExecutionScreen.jsx` — `exerciseToSetState` (`:69-92`), the `program_additions` loader (`:229-277`), `applyCoachEdit` (`:377-436`)

**Interfaces:**
- Consumes: `ex.slotId` on generated exercises (Task 1).
- Produces: live `sets[]` entries carry `slotId`. `applyCoachEdit(p)` resolves its target by `p.slot_id` when present. Coach-added exercises get `slotId = ${dayId}:added:${additionRowId}`.

- [ ] **Step 1: Carry slotId through `exerciseToSetState`** — in the returned object (after `name: ex.name,`), add:

```js
    slotId: ex.slotId || null,
```

- [ ] **Step 2: Give added exercises a slot id** — in the `program_additions` loader, the `extra` mapping currently does `...exerciseToSetState({ name: a.exercise_name, ... })`. Change that map's returned object to stamp the addition's own identity:

```js
        return {
          ...exerciseToSetState({
            name: a.exercise_name,
            /* …unchanged fields… */
          }),
          // An added exercise is not in the template, so it has no pattern-derived
          // slot. Its addition-row id IS its stable identity.
          slotId: `${workout.id}:added:${a.id}`,
        };
```

- [ ] **Step 3: Resolve coach edits by slotId in `applyCoachEdit`** — replace:

```js
    const inRange = (i) => i >= 0 && i < sets.length;
    let idx = p.exercise_index ?? -1;
```
with:

```js
    const inRange = (i) => i >= 0 && i < sets.length;
    // slot_id is the durable target: the live list and the saved program can
    // differ in length/order (the live list is not deduped), so an index from one
    // does not address the other. Fall back to the index only for proposals with
    // no slot id.
    let idx = p.slot_id != null
      ? sets.findIndex(e => e.slotId === p.slot_id)
      : (p.exercise_index ?? -1);
```

Leave the existing `if (!inRange(idx)) idx = currentExIdx;` fallback and everything after it unchanged.

- [ ] **Step 4: VERIFY(`screens/WorkoutExecutionScreen.jsx`)** — parse-check; `node --test lib/**/*.test.js` → `pass 12 / fail 0`.

- [ ] **Step 5: Commit**

```bash
git add screens/WorkoutExecutionScreen.jsx
git commit -m "Live workout: carry slotId into sets; coach edits target by slotId"
```

---

## Task 5: CoachScreen — map the transient index to a slot id

**Files:**
- Modify: `screens/CoachScreen.jsx` — `saveProposal` (`:636-722`), specifically the name-relocation block (`:652-657`) and the `program_template_overrides` insert (`:708-719`)

**Interfaces:**
- Consumes: `ex.slotId` on `userData.program.days[].exercises[]` (Task 1); the `slot_id` column (Task 3); `applyCoachEdit` reading `p.slot_id` (Task 4).
- Produces: proposals carry `slot_id`; override rows are written with `slot_id`; `onProposalApplied(p)` passes `slot_id` through to the live apply.

**Why this works without touching the edge function:** `buildContext` (`:345`, listing `day.exercises.map((ex, idx) => …)` at `:380`) is CLIENT-side. The model's `exercise_index` is therefore an index into a list this client just built — so the client can resolve it to a `slotId` immediately, against that same array.

- [ ] **Step 1: Resolve index → slotId, and drop the name-relocation** — in `saveProposal`, replace the block:

```js
    if (!isAdd && day && p.current_exercise) {
      const wantLc = p.current_exercise.trim().toLowerCase();
      const byName = (day.exercises || []).findIndex(ex => (ex.name || '').trim().toLowerCase() === wantLc);
      if (byName === -1) return false;
      p = { ...p, exercise_index: byName };
    }
```
with:

```js
    // Resolve the model's exercise_index — an index into the list buildContext
    // just sent it — to the durable slot id, here, while that array is still the
    // one it refers to. `current_exercise` stays a sanity check ONLY: relocating
    // by name used findIndex, which returns the FIRST match, so with two
    // same-named exercises an edit meant for the second hit the first. Reject a
    // mismatch instead of retargeting it.
    if (!isAdd && day) {
      const target = (day.exercises || [])[p.exercise_index];
      if (!target) return false;
      if (p.current_exercise) {
        const wantLc = p.current_exercise.trim().toLowerCase();
        if ((target.name || '').trim().toLowerCase() !== wantLc) return false;
      }
      p = { ...p, slot_id: target.slotId ?? null };
    }
```

- [ ] **Step 2: Persist `slot_id`** — in the `program_template_overrides` insert, add the column alongside `exercise_index` (keep `exercise_index` for rollback safety and legacy readers):

```js
      ({ error: err } = await supabase.from('program_template_overrides').insert({
        user_id: user.id,
        day_id: p.day_id || '',
        exercise_index: p.exercise_index ?? 0,
        slot_id: p.slot_id ?? null,
        edit_type: p.edit_type || 'replace_exercise',
        pattern_key: patternKey,
        exercise_id: exerciseId,
        sets: p.sets || null,
        reps: p.reps || null,
        rpe: p.rpe || null,
        is_session_swap: sessionOnly,
      }));
```

- [ ] **Step 3: Check the bounds guard still makes sense** — the existing bounds-check (`:661-666`) validates `p.exercise_index` against `day.exercises.length`. Keep it: the index is still how the model addresses the list, and Step 1's `target` lookup depends on it being in range. Do NOT delete it.

- [ ] **Step 4: VERIFY(`screens/CoachScreen.jsx`)** — parse-check; `node --test lib/**/*.test.js` → `pass 12 / fail 0`.

- [ ] **Step 5: Commit**

```bash
git add screens/CoachScreen.jsx
git commit -m "Coach: resolve the model's transient index to a durable slot_id at save time"
```

---

## Task 6: Regression sweep

- [ ] **Step 1: Parse every screen + App.js**

```bash
cd c:/Users/user/fitpulse && cat > ._pc.cjs <<'EOF'
const babel=require('@babel/core'),fs=require('fs');
const files=[...fs.readdirSync('screens').filter(f=>f.endsWith('.jsx')).map(f=>'screens/'+f),'screens/programGenerator.js','components/Tappable.jsx','lib/theme.js','lib/motion.js','App.js'];
let bad=0;for(const f of files){try{babel.transformSync(fs.readFileSync(f,'utf8'),{filename:f,presets:['babel-preset-expo'],babelrc:false,configFile:false});}catch(e){bad++;console.log('FAIL',f,'::',String(e.message).split('\n')[0]);}}
console.log(bad===0?`ALL ${files.length} PARSE OK`:`${bad} FAILED`);
EOF
node ._pc.cjs; rm -f ._pc.cjs
```
Expected: `ALL ... PARSE OK`.

- [ ] **Step 2: Suite** — `node --test lib/**/*.test.js` → `pass 12 / fail 0`.

- [ ] **Step 3: Harness re-run** — rebuild `.tmp_slot/pg.mjs` from the final `programGenerator.js` and run BOTH `slotid.test.mjs` and `applyedit.test.mjs`. Both must PASS.

- [ ] **Step 4: Safety-fix regression** — confirm the `2ee9fc9` behaviour survives: `applyPermanentEdit` must still SKIP `deduplicateDayExercises` for `replace_exercise`. Grep `screens/programGenerator.js` for `skipDedup` and confirm it is still set in the `replace_exercise` case and still honoured at the return. If it is gone, restore it — a replace must never delete a different exercise.

- [ ] **Step 5: Clean up scratch** — `rm -rf .tmp_slot` (it is gitignored; never commit it).

- [ ] **Step 6: Update memory** — update `coach-edit-slot-identity` (the fix is now shipped: what slot ids are, the format, where they're stamped, the dual-read/heal path, and that the edge fn was deliberately untouched) and `design-system` if relevant.

---

## Self-review notes (author)

- **Spec coverage:** slot ID format + occurrence suffix → T1. Role-not-exercise model / preserved on replace → T1+T2. Stamped before external overrides/filters → T1 (inserted at the end of `generateProgram`, which runs before TodayScreen's overrides). Resolution + no-op on missing slot + legacy fallback → T2. Live workout + added-exercise ids → T4. No edge change / client index→slotId mapping → T5. Migration + dual-read + migrate-on-read + RLS → T3. Testing via harness → T1/T2/T6. Keep the `2ee9fc9` safety fix → Global Constraints + T6 Step 4.
- **Deviation from spec:** the spec said stamp "after `days` is built"; the plan pins it precisely AFTER `generateProgram`'s own internal dedup (`:3405-3408`) and before the return. Both satisfy "before overrides/filters" (those run externally in TodayScreen); stamping at the end means the ids are computed on exactly the set that ships and no later in-generator transform can desync them.
- **Ordering:** T3's migration is a HUMAN step and gates the client that writes `slot_id` (T5). T3 Step 2 hard-stops if the column is absent.
- **`session_exercise_overrides`** is out of scope per the spec (session-scoped, short-lived) — it keeps its `exercise_index`.
