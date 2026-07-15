# Readiness check-in → adaptive session

**Date:** 2026-07-15
**Status:** design, pending approval

## Why this, and why now

Market research (2026-07-15) found one uncontested gap in the category:

- **Fitbod** estimates muscle-group fatigue from *session history*, not how you feel. It syncs Apple Health/Fitbit for activity but does not read HRV or sleep.
- **Hevy** does nothing with recovery. Its wearable integration is workout logging only.
- **Whoop** measures readiness properly but does not program lifting.

**Nobody joins "how recovered are you today" → "here's what changes in today's session."**

This matters commercially because our other differentiators are gone or going:

- The program generator is being **commoditised**: Hevy Trainer now generates progressive-overload programs from experience/goal/equipment/frequency **free**, on a $23.99/yr app with the category's best free tier.
- "Science-based" is claimed by everyone and is invisible inside the app.
- Conversational AI coaching is becoming table stakes ("users now expect conversational AI in any premium fitness app").

Readiness→session needs **no health permissions** — which is decisive, since Google rejected our release three times over Health Connect justification and we removed it entirely on 2026-07-14.

## The key insight: this is an input, not a feature

The loop already exists and is already wired:

- `getProactiveCoachPrompt()` picks the single most important thing to say today and TodayScreen renders it as a card (`TodayScreen.jsx:162`).
- Tapping it deep-links into the coach with the question pre-filled and auto-sent (`App.js:581`).
- `maybeSendProactiveNudge()` sends it as a push notification.
- The coach has memory, reads the program, and can edit it.

`getProactiveCoachPrompt` has a `'recovery'` branch — *"Recovery is low today…"* — that **can no longer fire on Android**, because we removed the sensor input that fed it.

**This feature restores that input.** It is not a new subsystem; it reconnects a loop we already built, using 3 taps instead of a wearable.

## Scope

**In scope**
1. A readiness check-in (3 taps) on the first workout of each day.
2. A session-only adjustment the user explicitly accepts.
3. Persistence, so the coach and the proactive card can use it.

**Out of scope (deliberately)**
- Trends/graphs of readiness over time.
- Any change to the program template (this is session-only, always).
- Re-adding Health Connect or any wearable.
- Coach *writing* readiness (it only reads it).

## Design

### Trigger and placement

Rendered as a bottom sheet inside **`WorkoutExecutionScreen`**.

Rationale: all three workout entry points (`TodayScreen`, and two `ProgramScreen` paths) call `onStartWorkout` → `setActiveWorkout` in `App.js` → they **all mount `WorkoutExecutionScreen`**. It is the single funnel, so nothing can bypass the check-in and `App.js` needs no changes. This is the same class of bug as the coach paywall leak fixed on 2026-07-14, where gating at *call sites* left a second door open.

It also already owns the live session state (`sets`), so the **adjustment** is a pure local transform of that state — **no template override and no risk to the program**. (The *check-in answers* are persisted, per Persistence below; the *adjustment* itself writes nothing and dies with the session.)

- Shows **once per day**, on the first workout only. If a `recovery_checkins` row exists for today, skip.
- **Skippable** in one tap. A skip is recorded (as skipped) and not asked again that day.
- If the score is **Ready**, no suggestion is shown — the workout just starts. The check-in only interrupts when it has something to say.

### Questions

Three, each a one-tap choice:

| Question | Options |
|---|---|
| Sleep | good / ok / poor |
| Soreness | fresh / normal / sore |
| Energy | high / ok / low |

### Scoring

Maps to the existing **Ready / Moderate / Low** vocabulary already used by `buildRecoveryStatus()` in `lib/healthService.js`, so the check-in, the coach and the proactive card all speak the same language.

**Labels are capitalized, stable English, and never translated.** `getProactiveCoachPrompt` compares `recoveryLabel === 'Low'` (`programGenerator.js:1613`) and `buildRecoveryStatus` returns `'Ready'|'Moderate'|'Low'`. Display text is translated separately via `t()`. This is not cosmetic: `TodayScreen` currently passes the *translated* `t('today.readiness.low')` into that comparison, so the recovery nudge has **only ever fired in English** ('Niedrig'/'Bajo'/'Faible' never match). The implementation fixes that.

Score each answer 2 (good) / 1 (ok) / 0 (poor), sum (0–6):

- **5–6 → Ready** — no suggestion, start the workout.
- **3–4 → Moderate** — suggest an effort reduction.
- **0–2 → Low** — suggest an effort reduction *and* a volume cut.

A **new scorer** is written for categorical self-report rather than reusing `buildRecoveryStatus(hrv, sleepHours, rhr)`, whose signature takes numeric sensor values. The *vocabulary* is reused; the function is not.

### The adjustment — what the app can actually change

**Critical constraint:** the app does **not** prescribe load. `exerciseToSetState()` (`WorkoutExecutionScreen.jsx:64`) has `target_sets`, `target_reps`, `rest`, `early_rpe`, `last_rpe` — **and no weight field**. The weight input is `placeholder={prevWeights[ex.name]?.weight}`, a "last time" hint. The user types the weight.

Therefore **"drop your weights 10%" is theatre** — there is no prescribed weight to lower, and the user is already free to lift lighter. Any load-based adjustment is rejected.

Adjust only what the app genuinely prescribes:

| Score | Adjustment (session only) |
|---|---|
| Ready | none — the workout starts unchanged |
| Moderate | `last_rpe` − 2, floored at 6 (e.g. 9 → 7). `early_rpe` untouched. |
| Low | `last_rpe` − 2, floored at 6, **and** `target_sets` − 1 per exercise, floored at 1 |

`target_reps` and `rest` are left alone: changing reps muddies progressive-overload comparisons, and rest is already prescribed per exercise type.

This is not a workaround — it *is* autoregulation, and our own evidence base backs it: `effort_dose` (proximity to failure is a continuous dose-response), `effort_failure_not_required` (1–3 RIR matches failure with better recovery — Enes 2024), and the Zourdos RPE scale in `scienceEngine.js`. Lowering the effort target causes the user to select a lighter load *by their own judgement* — the only mechanism that was ever available.

The workout header shows an "Adjusted for recovery" badge so the change is never invisible.

### Persistence

New table, matching the existing `add_<thing>.sql` migration convention. **Applied manually in the Supabase dashboard** (per established practice).

`supabase/migrations/add_recovery_checkins.sql`:

```sql
create table if not exists recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep text,        -- 'good' | 'ok' | 'poor'  (null when skipped)
  soreness text,     -- 'fresh' | 'normal' | 'sore'
  energy text,       -- 'high' | 'ok' | 'low'
  score int,         -- 0-6 (null when skipped)
  label text,        -- 'Ready' | 'Moderate' | 'Low' — stable English, never translated
  skipped boolean not null default false,
  applied boolean not null default false, -- did the user accept the adjustment
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table recovery_checkins enable row level security;
create policy "own checkins" on recovery_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

A **new table** rather than extending `daily_health_logs`, because that table upserts on `(user_id, date)` and is still written from HealthKit on iOS — a check-in would collide with an iOS user's sensor row. It is also sensor-shaped (`sleep_hours`, `hrv_ms`), not categorical.

### Wiring it back into the loop

1. **Coach context** — `CoachScreen.buildContext()` reads the last 7 days of `recovery_checkins` and adds them to the existing "Recovery data" block, restoring the recovery context lost with Health Connect.
2. **Proactive card** — `getProactiveCoachPrompt()` takes the latest check-in so its dead `'recovery'` branch fires again. Its copy is already recovery-agnostic ("Your sleep and recovery signals suggest you're under-recovered") after the 2026-07-14 reword.

## Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `screens/RecoveryCheckIn.jsx` | The sheet: 3 questions + suggestion + Apply/Skip. Presentational; reports a result upward. | theme tokens |
| `lib/readiness.js` | `scoreCheckIn({sleep,soreness,energy}) → {score,label}` and `adjustSessionForReadiness(sets,label) → sets`. Pure, no I/O, unit-testable. | none |
| `WorkoutExecutionScreen` | Decides whether to show it today, applies the returned transform to `sets`, renders the badge. | both of the above |
| `recovery_checkins` table | Persistence. | migration |

`lib/readiness.js` holds all the logic and is pure, so scoring and adjustment can be tested without a device.

## Error handling

- **Offline / insert fails** → the check-in still works and still adjusts the session. Persistence is best-effort; never block training on a network call.
- **Row already exists for today** → skip silently.
- **Skipped** → record `skipped: true`, no adjustment, don't re-ask today.
- **`target_sets` floor of 1** — never reduce an exercise to zero sets.

## Testing

- Unit (`lib/readiness.js`): scoring boundaries (0/2/3/4/5/6 → label), and that `adjustSessionForReadiness` lowers RPE, cuts sets, floors at 1, and **never touches weight** (there is no weight to touch).
- Manual: fresh account → first workout shows sheet → skip → not re-asked today. Answer all-poor → Low → Apply → badge shows, sets reduced, RPE lowered. Second workout same day → no sheet. Tomorrow → sheet again.

## Success criteria

1. The `'recovery'` proactive branch fires again on Android, with no health permissions.
2. A user can go from "slept badly" to a visibly lighter session in under 10 seconds.
3. The program template is never modified.
4. Skipping costs one tap and is never nagged.

## Risks

- **Friction.** ~70–80% of days the answer is "fine" and the check-in does nothing — pure tax. Mitigated by: once/day, one-tap skip, and no interruption when Ready. If early users skip it habitually, the fallback is a one-tap "I'm good / something's off" entry instead of three questions. **Watch this in the first 20 users.**
- **Self-report is noisy.** Accepted: it is the only signal available without a wearable, and it beats the current signal, which is nothing.
- **Unvalidated.** No user has asked for this. It is a bet on the one gap the market research found, taken deliberately.
