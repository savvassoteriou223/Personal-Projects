# Split design

How every training split in the app is built, and how we know it is right.

## The problem this replaced

The ten splits used to be ~840 lines of hand-written day lists. Each day named its
exercises directly and pinned many of them to one exact movement via `prefer:`.
The result, counted across the templates:

- **36 hard-coded side-delt slots**, 13 of them locked to the same cable lateral raise
- 14 pinned hip thrusts, 12 pinned standing calf raises, 9 pinned face pulls
- side-delt work on **pull days**, where shoulder abduction does not belong
- days with two slots doing the same job — a face pull and a Y-raise, two lateral
  raises, two curls

The exercise library had the variety to avoid all of this. The templates simply
never reached it. A user's report was blunt and correct: *"why do we have a
lateral raise every day."*

## How it works now

`SPLIT_DAYS` in `screens/programGenerator.js` holds every day as a list of
**slots**. A slot is a movement pattern plus a set count per experience tier:

```js
['squat_pattern', [4, 5, 6]]                       // beginner, intermediate, advanced
['glute_focused', [3, 4, 5], 'walking_lunge']      // optional preferred exercise
```

The generator turns each slot into an exercise through `be()`, which picks from
the pattern's pool with block rotation, the user's equipment, their level, and
the exercises they have skipped. Reps, RPE and rest come from the goal profile
via `SLOT_REPS`, keyed on the pattern's role.

### Set counts are derived, not authored

`scripts/splitDesign.mjs` computes them. For each split, tier and sex it takes
each muscle's target window, aims at the **floor** of that window, and spreads
the budget evenly across however many slots the split gives that muscle, clamped
to 2–6 sets per slot.

Aiming at the floor rather than the midpoint matters: an advanced lifter's
side-delt window tops out at 16, and in a split with one side-delt slot the
midpoint rule produced *11 sets of lateral raises in a single session*. Opening
at the floor is also what block periodisation wants, since it progresses volume
upward across the block instead of starting at the ceiling.

This replaced a flat 0.8 / 1.0 / 1.2 experience multiplier applied to one set of
intermediate counts. A single factor cannot work, because tiers do not scale
uniformly across muscles — back runs 8-10 → 10-20 → 14-24 while quads run
6-10 → 10-15 → 12-20 — so any one factor overshoots some muscles while
undershooting others, and per-slot rounding compounds the error.

### Measured the way the app measures

The design script scores itself with the app's own attribution, reading
`MOVEMENT_PATTERNS` exactly as `computeHeadVolume()` does: a set credits
**direct** volume to `muscles[0]` only. Three consequences drive the whole
design:

- **Squats and deadlifts give glutes nothing.** Glute volume comes only from the
  `glute_focused` pattern.
- **Shrugs count toward back**, because `upper_traps` maps to the traps head.
- **The overhead press credits front delts**, which have no target at all — so it
  contributes no tracked volume.

Targets are the intersection of the app's `VOLUME_TARGETS` and the project's
split-design rules. Both have to hold: the rules are the brief, and
`VOLUME_TARGETS` is what the app actually renders, so designing to one alone
would ship a program the app then paints red. The rules' numbers are the
*intermediate* spec; beginner and advanced are judged on the app's own tier
targets, since holding a beginner to 12 quad sets is the very thing the tier
scaling exists to prevent.

### The sex tilt

The tilt only ever swaps one accessory slot, and never a compound.

- Women take glute **isolation** (hip abduction).
- Men take the **cable pull-through**, a hip-hinge compound.
- The **walking lunge stays for both sexes**.

That last point is what makes the rules self-consistent. The rules say men get no
dedicated glute isolation, and also that every muscle must land in range for both
sexes. Since only `glute_focused` credits glutes, men can only satisfy both if a
*compound* lives in that pattern — and the walking lunge does.

## Verification

Two scripts, both run against the real generator:

```bash
node --loader ./scripts/extres.mjs scripts/splitDesign.mjs   # design:  60/60
node --loader ./scripts/extres.mjs scripts/programAudit.mjs  # audit:  288/288
```

- **`splitDesign.mjs`** — 10 splits × 3 tiers × 2 sexes. Checks every tracked
  muscle against its window, that no slot falls below 2 sets, that sessions stay
  5–9 exercises, and that no day runs the same job twice.
- **`programAudit.mjs`** — generates 288 real programs (3 equipment × 4
  experience × 4 day-counts × 3 goals × 2 sexes) and measures each with
  `buildVolumeView()`, the same function that renders the user's weekly volume
  rows. Checks volume, day targeting, and duplicates.

Both report zero issues. Before this work the same audit reported 18 of 144 clean.

### What counts as a duplicate

Two slots may share a pattern when they do genuinely different jobs — a squat and
a leg press, a walking lunge and a hip abduction. What is a defect is the **same
exercise twice in a day**, or a pattern run three or more times in one session. A
day dedicated to a muscle may run two variations of it, so a shoulder day is
allowed its two side-delt movements.

## Equipment fallback

If a slot's pattern has nothing for the user's equipment, `be()` substitutes a
sibling pattern that credits the **same muscle directly**, preferring one the day
is not already running. Without this, slots silently vanished and took their
volume with them — a bodyweight-only user was being shipped a program with **zero
back sets and zero biceps sets**.

Only same-direct-muscle substitutions are allowed. Sending a side-delt slot to the
overhead press would move the credit to front delts and quietly reintroduce the
mistargeting these tables exist to prevent.

Closing the remaining gaps also required fixing the library itself:

- `walking_lunge` was tagged `['dumbbells']`. A walking lunge needs no equipment,
  and that tag stripped bodyweight users of their main glute compound.
- The only bodyweight leg curl was the Nordic curl, gated as `advanced`, so
  beginners and dumbbell-only users got no direct hamstring work. Added the
  slider leg curl.
- Added the inverted row under a table, the prone Y-T-W raise, the towel row, the
  self-resisted curl, and the dumbbell fly — the patterns that were otherwise
  empty without a bar, a cable stack or a machine.

## Changing a split

Edit the day's slot list in `scripts/splitDesign.mjs`, run it until it reports
`60 pass / 0 fail`, then regenerate the table and paste it into
`programGenerator.js`:

```bash
node --loader ./scripts/extres.mjs scripts/splitDesign.mjs emit
```

Then re-run `programAudit.mjs`. Do not hand-edit the set counts in
`SPLIT_DAYS` — they are solved output, and editing them there desynchronises the
table from the verifier that proves it.
