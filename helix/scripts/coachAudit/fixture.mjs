// Realistic userContext fixture, matching the exact text format buildContext()
// in CoachScreen.jsx produces, built from real exercise names in movementLibrary.js
// so verbatim-name checks are meaningful.

export const FIXTURE_CONTEXT = `User profile:
- Name: Alex
- Experience: intermediate
- Goal: gain
- Activities: gym
- Sports schedule: none
- Equipment available: Barbell, Dumbbells, Cables, Machines, Pull-up bar
- Supplements: Creatine
- Training: 4 days/week, 60 min sessions
- Current streak: 6 consecutive weeks trained
- Weight: 82kg (target 86kg), Height: 180cm
- Exercises excluded from the program (disliked/repeatedly skipped): none
- Injuries: none reported
- Active conditions (already filtered out of the program below): none

Current program: Upper / Lower 4x (split ID: upper_lower_4x)
Days and exercises ("SOLE slot" = the program's only work for that group; losing
that slot means the user stops training that region at all):
  push — Push — Chest / Shoulders / Triceps:
    [0] Barbell bench press [Chest — Horizontal Push] (3×8–12, rest 3 min)
    [1] Decline barbell press [Chest — Decline / Lower Chest] (3×10–15, rest 2 min) — SOLE slot for this group
    [2] Dumbbell shoulder press [Shoulders — Vertical Push] (3×8–12, rest 2 min)
    [3] Dumbbell lateral raise [Shoulders — Side Delt Isolation] (3×12–15, rest 90 sec) — SOLE slot for this group
    [4] Cable tricep pushdown (rope or bar) [Triceps] (3×10–15, rest 90 sec)
  pull — Pull — Back / Biceps:
    [0] Barbell row [Back — Horizontal Pull (Back Thickness + Inner Back)] (4×8–12, rest 2 min)
    [1] Lat pulldown (wide pronated grip) [Back — Vertical Pull (Lat Width)] (3×10–12, rest 2 min) — SOLE slot for this group
    [2] Barbell curl (straight bar) [Biceps] (3×8–12, rest 90 sec)
    [3] Incline dumbbell curl [Biceps] (3×10–15, rest 90 sec)

Rest days between sessions (the program's own built-in spacing):
  Push → no rest day → Pull

Changes you (the coach) already made to this program — do not re-propose these,
and you can truthfully reference having already done them:
  None yet

AVAILABLE EXERCISES (equipment-filtered; patterns hard-contraindicated by the
conditions on file are already removed below — you cannot propose them because
they are not in this list). When you propose adding or replacing an exercise,
the exercise_name MUST be copied EXACTLY from this list — never invent, rename,
or paraphrase an exercise. The name already encodes the target region (e.g.
"Cable crossover (lower chest)"), so pick the one that matches the user's
request. If nothing here fits, say so instead of proposing.

The list is grouped by movement pattern, and each exercise in the program above
is tagged with the group it belongs to. A REPLACEMENT MUST COME FROM THE SAME
GROUP as the exercise being replaced — that group is the training slot, and
leaving it silently deletes the region the program allocated sets to. "Chest —
Decline / Lower Chest", "Chest — Incline Push (Upper Chest)" and "Chest —
Horizontal Push" are three DIFFERENT slots, not interchangeable bench variants.
Only cross groups if the user explicitly asks for a different movement (or
every option in the group is excluded), and say so in your reply when you do:
  Chest — Horizontal Push: Barbell bench press, Dumbbell bench press, Machine chest press, Push-up
  Chest — Incline Push (Upper Chest): Incline barbell press, Incline dumbbell press, Incline machine chest press
  Chest — Decline / Lower Chest: Decline barbell press, Decline dumbbell press, Cable crossover (lower chest), Standing cable fly (lower chest / multi-angle), Dips (chest focus, lean forward)
  Chest — Isolation (Fly / Stretch): Cable fly (seated or standing), Pec deck (chest fly machine)
  Triceps: Overhead tricep extension, Katana extension, Dumbbell French press, Cable tricep pushdown (rope or bar), Single-arm dumbbell kickback, Single-arm cable kickback, Dips (tricep focus, upright), Machine tricep extension, Diamond push-up
  Back — Vertical Pull (Lat Width): Pull-up (overhand), Chin-up (underhand — bicep focus), Weighted pull-up, Lat pulldown (wide pronated grip), Close grip lat pulldown (V-bar), Half-kneeling single-arm lat pulldown, Machine lat pulldown
  Back — Horizontal Pull (Back Thickness + Inner Back): Barbell row, T-bar row, Dumbbell row, Seated cable row (close grip), Chest-supported dumbbell row, Machine row (chest-supported), Inverted row (Australian pull-up), Single-arm kettlebell row
  Shoulders — Vertical Push: Barbell overhead press, Dumbbell shoulder press, Arnold press, Machine shoulder press, Pike push-up
  Shoulders — Side Delt Isolation: Cable lateral raise, Dumbbell lateral raise, Super ROM lateral raise, Machine lateral raise
  Biceps: Bayesian cable curl, Incline dumbbell curl, Preacher curl, Chin-up (bicep focus), Barbell curl (straight bar), EZ-bar curl, Cable curl (standing), Dumbbell curl, Machine bicep curl, Incline hammer curl, Standing hammer curl

EVIDENCE BASE — the app's curated findings. This is your source of truth: cite and
stay consistent with these, and do NOT contradict them or invent science beyond
them. If something isn't covered here, say it's outside the app's evidence base
rather than guessing:
  Chest region targeting: incline/low-to-high cable = upper chest; decline/dips/high-to-low cable = lower chest; flat = mid chest.
  Side delts: direct lateral raise work required, pressing barely contributes.
  Volume: 10-20 sets/muscle/week optimal, ~4 minimum, beyond 20 diminishing returns.

This week's volume — last 7 days (sets per muscle):
  chest: 6 direct sets (below optimal, target 10-15)
  back: 7 direct sets (below optimal, target 10-20)
  shoulders: 3 direct sets (under minimum, target 10-18)
  side_delts: 3 direct sets (under minimum, target 8-16)
  rear_delts: 0 direct sets (under minimum, target 6-14)
  biceps: 6 direct sets (optimal, target 6-10)
  triceps: 3 direct sets (below optimal, target 6-10)
  quads: 0 direct sets (under minimum, target 10-15)
  hamstrings: 0 direct sets (under minimum, target 8-12)
  glutes: 0 direct sets (under minimum, target 8-12)
  calves: 0 direct sets (under minimum, target 8-14)
  abs: 0 direct sets (under minimum, target 6-10)

Personal records:
  Barbell bench press: 90kg × 6
  Barbell row: 85kg × 8
  Barbell curl (straight bar): 35kg × 10

Plateau detection (same detector Today shows — stay consistent with it, never
contradict a plateau or its absence):
  None detected

Deload status (same detector Today shows):
  Not currently suggested

Performance correlations:
  Not enough history yet to correlate

Recent strength sessions:
  Mon Jul 27: Push — Chest / Shoulders / Triceps (58min, RPE 8)
  Wed Jul 29: Pull — Back / Biceps (55min, RPE 7)

Recent cardio sessions:
  None logged

Self-reported readiness (last 7 days):
  No readiness check-ins yet

Nutrition — targets vs recent intake:
  Strategy: lean bulk
  Daily target: 2800 kcal · 180g protein · 300g carbs · 80g fat
  Logged average over last 5 day(s): 2650 kcal · 165g protein · 290g carbs · 75g fat

Bodyweight (last 30 days, manually logged — may be sparse):
  2026-07-01: 81.2kg → 2026-07-28: 82.0kg (+0.8kg over 4 logged entries)`;

// Variant with a live in-workout session on the Push day, current exercise =
// Dumbbell lateral raise (index 3) — for testing rule 7a ("this exercise").
export const FIXTURE_CONTEXT_LIVE = FIXTURE_CONTEXT + `

LIVE SESSION IN PROGRESS — Push — Chest / Shoulders / Triceps:
Current exercise: [3] Dumbbell lateral raise [Shoulders — Side Delt Isolation] (3×12–15, rest 90 sec) — SOLE slot for this group
The user is mid-workout right now. "this exercise" / "this one" / "swap this" always means the current exercise above.`;
