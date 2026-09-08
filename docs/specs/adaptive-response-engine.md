# Adaptive Response Engine (ARE)

> The self-experimenting, individually-modeled strength coach — a closed loop that
> learns how *your* body responds and runs controlled n-of-1 experiments to optimize
> your training. This is the invention Helix is built around; everything else is a feature.

Status: **integrated.** The engine was pure and unreferenced until 2026-07-29;
`lib/areStore.js` now drives it from real training data, `supabase/migrations/
add_adaptive_response_engine.sql` gives it memory, and Coach surfaces its read at
the top of the focus chain. The migration must be applied in the dashboard before
the loop can persist anything — until then it fails closed and stays invisible.

---

## 0. One-paragraph thesis

Every fitness app applies population-average rules to individuals ("3 sessions at the
top of the range → add weight"). ARE replaces that with a **closed control loop**: it
maintains a quantified model of *your* individual training response, detects where that
model is uncertain, **autonomously designs and runs a controlled within-subject
experiment** to resolve the uncertainty, evaluates the result with honest statistics, and
updates your model — then repeats. The output is a coach that converges on *your* optimal
training, entirely from data you already log, with **no wearable required**.

---

## 1. The novel method (what we'd actually claim)

The invention is **not** "personalization," "an AI coach," or "camera velocity" — all have
prior art. The novel, non-obvious method is the **fully-automated closed experimentation
loop applied to consumer resistance-training data**:

> A system and method for optimizing individualized resistance-training prescription
> comprising: (a) estimating, from passively-logged set-level performance data, a set of
> individual dose–response parameters and their uncertainty; (b) computing an
> expected-value-of-information over unresolved parameters; (c) autonomously generating a
> controlled within-subject experimental protocol (intervention variable, control-held
> variables, outcome metric, minimum detectable effect, duration, decision rule) targeting
> the highest-value parameter; (d) executing the protocol by programmatically modifying the
> subject's training program; (e) evaluating the outcome against the pre-registered
> decision rule with effect-size and false-discovery control; and (f) updating the
> individual model and repeating.

The defensible core is **(b)+(c)+(e)** — deciding *what to test*, designing the test, and
judging it honestly — done automatically from noisy consumer logs. A patent attorney does
the prior-art search; this is the claim skeleton.

---

## 2. Architecture — the loop

```
        ┌────────────────────────────────────────────────────────┐
        │                                                        │
        ▼                                                        │
  [1] Individual Response Model (IRM)                            │
      per-user params + confidence, from logged sets             │
        │                                                        │
        ▼                                                        │
  [2] Uncertainty / Value-of-Information                         │
      "what don't we know that's worth knowing?"                 │
        │                                                        │
        ▼                                                        │
  [3] Experiment Design Engine                                   │
      pre-registered n-of-1 protocol                             │
        │                                                        │
        ▼                                                        │
  [4] Execution  ── modifies program via propose_program_change  │
        │                                                        │
        ▼                                                        │
  [5] Evaluation (statistics, decision rule)                     │
        │                                                        │
        ▼                                                        │
  [6] Model update ──────────────────────────────────────────────┘
```

One experiment runs at a time per user. Everything is derived from `completed_sets` +
`workout_sessions` — no new sensors required.

---

## 3. Component 1 — Individual Response Model (IRM)

Persistent, continuously-updated per-user parameter set. Each parameter carries a
**confidence** (data sufficiency + fit quality) so downstream steps know what's trustworthy.

| Parameter | Meaning | Estimated from |
|---|---|---|
| `adaptationRate[lift]` | kg/week trend of estimated 1RM | per-session best est-1RM (Epley) → linear slope |
| `volumeResponse[muscle]` | marginal progress per weekly set | progress vs. weekly-set history (needs variation) |
| `frequencyResponse[muscle]` | progress at 1× vs 2×+ per week | progress across frequency changes |
| `recoveryHalfLife[muscle]` | sessions/days until performance restored | within- and between-session performance decay |
| `effectiveRepRange[lift]` | rep range where *your* est-1RM moves most | est-1RM change bucketed by working rep range |
| `fatigueSignature` | expected-vs-actual performance gap | deviation of logged reps/load from IRM prediction |

**Math, v1 (adaptationRate):** per exercise, take each session's best working-set est-1RM
(`w * (1 + reps/30)`), form a time series, fit an ordinary least-squares slope in kg/week.
Confidence = f(n sessions, time span, R²). Below a floor → `null` (honest "don't know
yet"). This is the module shipped alongside this doc (`lib/individualModel.js`).

The harder parameters (volume/frequency response) are *causal* and generally **can't be
learned from observation alone** — which is exactly why the engine has to run experiments.

---

## 4. Component 2 — Uncertainty & Value of Information

For each parameter the IRM couldn't pin down (low confidence, or no natural variation to
learn from), estimate **value of information**: how much would resolving it improve the
prescription, weighted by how resolvable it is in a reasonable trial length.

`VoI(param) = expectedGain(param) × resolvability(param) × userRelevance(param)`

Pick the top-VoI parameter as the next experiment target. Example: if `volumeResponse[chest]`
is unknown and chest is a stated priority lagging behind other muscles, it wins.

---

## 5. Component 3 — Experiment Design Engine

Given a target parameter, generate a **pre-registered** protocol (locked before it runs —
this is what protects against post-hoc rationalization):

- **Intervention variable** — e.g. chest weekly sets 12 → 18.
- **Held constant** — all other muscles, intensity scheme, bodyweight target.
- **Design** — A/B blocks or ABAB reversal; reversal preferred (each user is their own
  control twice, cancels drift).
- **Outcome metric** — pre-declared, objective, from logs (e.g. est-1RM slope of the main
  chest lift; or volume-load at fixed RPE).
- **Minimum detectable effect (MDE)** — set from the user's own historical noise, so we
  don't chase effects smaller than the person's week-to-week variance.
- **Duration** — powered to detect the MDE given that noise (typically 3–6 weeks/arm).
- **Decision rule** — keep / revert / inconclusive-extend, written *now*.

Everything is stored so evaluation can't move the goalposts.

---

## 6. Component 4 — Execution

The protocol is realized by the **existing** program-modification pipeline
(`propose_program_change` + the confirm-this-change UI). The engine never silently changes
someone's training — the user opts into "run this test?" once, then the arms apply
automatically. Blind where possible (don't tell the user which arm they're in for the
outcome window, to avoid effort confounds).

State tracked in a new `are_experiments` row: protocol, current arm, arm-start dates,
collected metric points, status.

---

## 7. Component 5 — Evaluation & Statistics (the rigor *is* the invention)

Training data is noisy; naive comparison = confidently wrong = snake oil. So:

- Compare arms on the **pre-registered metric only**.
- Compute **effect size vs the user's own noise** (standardized against their historical
  week-to-week SD), not raw deltas.
- Require the effect to clear the **MDE** *and* a confidence threshold given the sample.
- Control **false discovery** across the many experiments a user will run over time
  (a user running 20 tests/year will hit false positives by chance — correct for it).
- Outcomes: **keep** (adopt + update model), **revert** (drop + record "no effect for you"),
  **inconclusive** (extend or shelve). "No detectable effect" is a *first-class, valuable*
  result — it's still learning about the user.

---

## 8. Component 6 — Model update & memory

The verdict writes back into the IRM (`volumeResponse[chest] = +X/set, high confidence`)
and into coach memory, so all downstream coaching and future VoI calculations use it. The
loop restarts on the next-highest-VoI parameter.

---

## 9. Fatigue & readiness without a wearable

Because there is **no HRV/wearable**, readiness is inferred from **performance signatures**:
the gap between what the IRM *predicts* you should lift today and what you actually log
(rep drop-off within a session, load-for-reps below your model's expectation across
sessions). Persistent negative deviation ⇒ accumulated fatigue ⇒ autoregulate (trim volume,
suggest a deload). This is its own differentiated method: **readiness derived from lift
performance, not physiology sensors.** (Optional future input: markerless camera bar
velocity — richer signal, but prior art exists for the *measurement*, so it's an input, not
the claim.)

---

## 10. Data-schema additions (Supabase)

- `are_individual_model` — user_id, param_key, value, confidence, updated_at.
- `are_experiments` — user_id, target_param, protocol_json, status, current_arm,
  arm_started_at, metric_points_json, verdict, created_at.
- (Migrations applied manually in the dashboard per project convention.)

No changes to how sets are logged — ARE consumes the existing `completed_sets`.

---

## 11. Guardrails, safety, consent

- **Safety is never an experimental variable.** No testing that risks injury; contraindication
  filters and RPE caps still bind. Deload is always available regardless of an active trial.
- **Explicit opt-in** to each experiment, in plain language, with the "why."
- **Escape hatch** — user can end a trial anytime; life events (travel, illness, injury)
  pause it and invalidate the affected window.
- **Honesty** — the app says when it doesn't have enough signal. Never manufacture a result.

---

## 12. Build order & status

The **engine (the brain / the IP) is built and unit-tested** — pure, deterministic, running
on the data you already log. What remains is **integration** (persistence, UI, program-edit
wiring, real-data validation), which needs the live app + DB + a device.

| # | Piece | Where | Status |
|---|---|---|---|
| 1 | IRM — `adaptationRate` | `lib/individualModel.js` | ✅ built + tested |
| 2 | IRM — fatigue signature (wearable-free readiness) | `lib/individualModel.js` | ✅ built + tested |
| — | Model assembly (app entry point) | `lib/individualModel.js` `assembleModel` | ✅ built + tested |
| — | VoI ranking (what to test next) | `lib/adaptiveResponseEngine.js` | ✅ built + tested |
| 3 | Experiment design (pre-registered protocol) | `lib/adaptiveResponseEngine.js` | ✅ built + tested |
| 5 | Evaluation statistics (keep/revert/inconclusive) | `lib/adaptiveResponseEngine.js` | ✅ built + tested |
| 6 | Model write-back | `lib/adaptiveResponseEngine.js` | ✅ built + tested |
| — | The loop orchestrator | `lib/adaptiveResponseEngine.js` `nextAction` | ✅ built + tested |
| — | Supabase schema (`are_individual_model`, `are_experiments`) | `supabase/migrations/add_adaptive_response_engine.sql` | 🟡 written, apply in dashboard |
| — | Service: load sets → run engine → persist → drive UI | `lib/areStore.js` | ✅ done |
| — | Opt-in + "what I've learned about you" UI | screens | ⬜ needs app + device |
| — | Execute arms via `propose_program_change`; collect metric points | wiring | ⬜ needs app |
| — | Real-data statistical validation & threshold tuning | — | ⬜ needs real users |

Phases 1–3 already *feel* novel read-only (a coach that shows what it's learned about your
body). The loop is proven in tests end-to-end (idle → propose → conclude → model update);
closing it in the live app is the integration column above.

---

## 13. Honest risks

- **Statistical validity** is the whole game; get it wrong and it's worse than no feature.
- **Adherence** — real users miss sessions, breaking clean arms; the design must tolerate
  ragged data or quietly abandon underpowered trials.
- **Time-to-value** — a first meaningful result takes weeks of the user's training; the UX
  must make the *journey* (what it's learning) rewarding before the payoff lands.
- **Patent** — needs an attorney + prior-art search; the practical moat is execution + the
  accumulating per-user model, which no competitor can copy.
