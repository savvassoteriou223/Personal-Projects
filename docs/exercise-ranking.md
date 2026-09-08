# Exercise ranking reference

The order exercises appear in within each pattern in `screens/movementLibrary.js`
is a ranking, and `primary_alternative: true` marks the first choices. Nothing
outside that file recorded *why* a given exercise sat where it did, so when the
ordering drifted there was no way to tell. This file is that record.

Keep it in sync with the library. If the two disagree, one of them is wrong and
it needs resolving rather than ignoring — the generator anchors compound slots
to the top-ranked exercise, so a wrong #1 is pinned into every program until
someone notices.

## Ranking criteria

Three factors, applied in this order:

1. **Stretch and tension** — how hard the target muscle is loaded at long
   muscle length. Lengthened-position loading is the strongest single predictor
   of growth in the current literature, and it is why a barbell press ranks
   below a machine or dumbbell press whose bottom position allows a deeper
   stretch.
2. **Resistance profile and comfort** — whether the movement is smooth through
   the full range, targets the muscle without joint pain, and lets the lifter
   actually feel the working muscle. Exercises that lose tension at the point
   of peak stretch rank down.
3. **Ease of progression** — how simply load or reps can be added session to
   session. Movements that are awkward to load incrementally, or where balance
   fails before the muscle does, rank down.

**Known bias in these criteria:** weighting stretch and stability favours
machines and cables over free weights. That is defensible for pure hypertrophy
and questionable for strength-focused goals, where the barbell lift is the
thing being progressed and has to remain the anchor. Treat the order below as
the hypertrophy answer, not the universal one.

## Tiers

Compiled from published evidence-based rankings. Muscle groups with no
published tier list are marked as gaps rather than filled in by guesswork.

### Chest
- **S+** — Machine chest press
- **S** — Seated cable pec flye
- **A** — Bench press · Incline bench press · Flat dumbbell press · Incline dumbbell press · Dips · Deficit push-up · Dumbbell guillotine press · Smith machine bench · Incline Smith bench · Cable crossover · Pec deck · Dumbbell flye · Cable press-around
- **B** — Decline bench press · Decline dumbbell press · Banded push-up
- **C** — Push-up · Floor press
- **D** — Dumbbell pullover · Plyometric push-up
- **F** — Hex press · Guillotine press · 1-arm dumbbell press · Cross-body standing dumbbell flye · Plate press

### Back
- **S** — Wide-grip lat pulldown · Neutral-grip lat pulldown · One-arm lat pulldown · Meadows row · Chest-supported row · Cable row · Wide-grip cable row
- **A** — Wide-grip pull-up · Neutral-grip pull-up · Cross-body one-arm pulldown · Deficit Pendlay row · One-arm dumbbell row · Kroc row · Cable lat prayer · Dumbbell pullover
- **B** — Chin-up · Barbell row · Pendlay row · Rope face pull
- **C** — Deadlift · Yates row · Inverted row · Free-standing T-bar row
- **D** — Above-the-knee rack pull
- **F** — Renegade row · Dumbbell row curl · Dumbbell row press · Dumbbell row kickback

### Shoulders
- **S** — Cable lateral raise · Cable Y-raise · Behind-the-back cuffed cable lateral raise · Reverse pec deck · Reverse cable crossover
- **A+** — Machine shoulder press · Standing machine lateral raise
- **A** — Lean-in dumbbell lateral raise · Rope face pull · Seated dumbbell overhead press · Side-lying dumbbell raise
- **B+** — Standing barbell overhead press
- **B** — Standing dumbbell lateral raise · Bent-over reverse dumbbell flye · Seated machine lateral raise · Lean-away dumbbell lateral raise · Super ROM dumbbell lateral raise · Seated barbell overhead press · Upright row
- **C** — Banded lateral raise
- **D** — Front raise (any variation)

### Triceps
- **S+** — Overhead cable extension (bar)
- **S** — Barbell skullcrusher
- **A** — Pressdown (bar) · Overhead cable extension (rope) · Katana extension · 1-arm dumbbell overhead extension · Dumbbell skullcrusher · Smith JM press · Cable kickback · Close-grip bench
- **B** — Pressdown (rope) · Dumbbell French press · JM press · Close-grip dips · Machine dips · Diamond push-up
- **C** — Reverse-grip pressdown · Bench dips · Close-grip push-up · Dumbbell triceps kickback

### Biceps
- **S+** — Face-away Bayesian curl
- **S** — Dumbbell preacher curl · Machine preacher curl · Preacher hammer curl
- **A** — EZ-bar curl · Standing dumbbell curl · Incline curl · Lying dumbbell curl · Modified 21s · Standing cable curl · Bayesian cable curl variation · Cheat curl · Strict curl · Hammer curl · Inverse Zottman curl
- **B** — Barbell curl · Flat bench curl · Chin-up
- **C** — Scott curl · Drag curl · Spider curl · 21s

### Quads
- **S+** — Hack squat
- **S** — Barbell back squat · Pendulum squat · Smith machine squat · Bulgarian split squat
- **A** — Barbell front squat · Low-bar squat · 45° leg press · Leg extension · Reverse Nordic
- **B** — Lunge · Goblet squat · Sissy squat
- **C** — Horizontal leg press · Deadlift · Step-up · Pistol squat
- **F** — Combo squat variations · Jump squat · Bosu ball squat

### Glutes
- **S** — Walking lunge · Machine hip abduction · 45° back extension · Smith lunge (front foot elevated)
- **A** — Machine hip thrust · Single-leg dumbbell hip thrust · Barbell back squat · Smith squat · Bulgarian split squat · Kickback · Step-up · Smith lunge · Romanian deadlift
- **B** — Barbell hip thrust · Glute bridge · Cable hip abduction · Curtsy lunge · Conventional deadlift · Sumo deadlift · Cable pull-through
- **C** — Frog pump · Lateral banded walk
- **D** — Donkey kick · Fire hydrant · Kettlebell swing

### Gaps — no published tier list
**Hamstrings, calves, abs, forearms, traps.** The only signals available are
Romanian deadlift and seated leg curl both placing highly in general
"best exercises" lists. These are deliberately left unranked rather than
invented; the library's own ordering for these patterns stands until there is
something real to check it against.

## Known conflicts with the current library

As of writing, the library's #1 disagrees with the tiers above on four slots
that the generator anchors:

| pattern | library #1 | tier list says |
|---|---|---|
| `chest_horizontal_push` | Barbell bench press | Machine chest press (bench is A) |
| `back_horizontal_pull` | Barbell row | Chest-supported / cable row (barbell row is B) |
| `back_vertical_pull` | Pull-up | Lat pulldown (pull-up is A) |
| `squat_pattern` | Barbell back squat | Hack squat (back squat is S) |

There is also an internal inconsistency in `chest_decline`: decline barbell
press sits first in the array but is not flagged `primary_alternative`, while
cable crossover and dips further down are. Array position and the flag disagree,
so "the top-ranked exercise" is ambiguous for that pattern.

None of these are resolved yet. Resolving them is a positioning decision — see
the bias note under the criteria — not a data-entry one.
