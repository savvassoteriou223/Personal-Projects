# Helix — Program & Exercise Audit
> For internal review of volume, exercise selection, and condition-specific adjustments.
> Source files: `programLibrary.js` (static), `programGenerator.js` (live — what users receive), `scienceEngine.js`, `nutritionConditionsLibrary.js`

---

## 1. Goal → Program Routing

| Goal selection | Days/week | Program assigned |
|---|---|---|
| Fat loss or Endurance only (no muscle/strength goal) | 2 | Full Body 2×/week Express |
| Fat loss or Endurance only | 3 | Full Body 3×/week Express |
| Fat loss or Endurance only | 4 | Upper/Lower 4×/week Express |
| Any muscle/strength goal (or mixed) | 2 | Full Body 2×/week |
| Any muscle/strength goal | 3 | Full Body 3×/week |
| Any muscle/strength goal | 4 | Upper/Lower 4×/week |
| Any goal | 5 | Hybrid 5×/week |
| Any goal | 6 | PPL 6×/week |

**Research minimum:** Train each muscle ≥2×/week. Only 2-day programs fall below optimal frequency. All others meet the threshold.

---

## 2. Split Options (programGenerator.js — what users see)

| Split | Days | Freq/muscle | Optimality | Session time |
|---|---|---|---|---|
| Full Body 2×/week | 2 | 2× | Suboptimal | 70–90 min |
| Full Body 3×/week | 3 | 3× | Good | 60–80 min |
| Upper/Lower 4×/week | 4 | 2× | **Optimal** | 60–80 min |
| Chest+Tri/Back+Bi/Shoulders/Legs | 4 | 1× | Good | 55–75 min |
| PPL/Upper/Lower Hybrid 5×/week | 5 | 2× | **Optimal** | 55–75 min |
| Full Body 4×/week | 4 | 4× | Good (Advanced) | 50–65 min |
| Full Body/Upper/Lower Hybrid 3×/week | 3 | 2× | Good | 60–80 min |
| PPL 6×/week | 6 | 2× | Good | 50–70 min |

---

## 3. Weekly Volume Targets per Muscle Group

From `scienceEngine.js` / `programGenerator.js` — these are the targets the generator aims for.

| Muscle | Minimum (sets/week) | Optimal range | Notes |
|---|---|---|---|
| Chest | 10 | 12–16 | Include flat + incline for full fibre coverage |
| Back | 10 | 12–16 | Include vertical pull (width) + horizontal pull (thickness) |
| Shoulders | 8 | 10–14 | Side delt needs direct isolation — pressing alone hits anterior only |
| Biceps | 6 | 8–12 | Count indirect volume from rows + pull-ups |
| Triceps | 6 | 8–12 | Long head best trained overhead — include ≥1 overhead extension |
| Quads | 10 | 12–16 | Multiple exercises for complete development |
| Hamstrings | 8 | 10–14 | Hip hinge primary (long muscle length) + leg curl secondary |
| Glutes | 8 | 12–16 | Peak contraction (hip thrust) + lengthened (RDL) both needed |
| Calves | 8 | 10–14 | Full ROM, stretch emphasis, respond well to higher reps + frequency |
| Abs | 6 | 8–12 | Direct work necessary — minimally active in squats/deadlifts (EMG) |

---

## 4. Full Exercise Tables by Program

---

### A. Full Body 2×/week — Standard (Beginner)

**Day A**
| Exercise | Sets | Reps | Rest | RPE early→last | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|---|
| Barbell back squat | 3 | 6–8 | 3–4 min | 7→9 | Quads, glutes | Goblet squat | Leg press |
| Barbell bench press | 3 | 6–8 | 3–4 min | 7→9 | Chest, shoulders, triceps | DB bench press | Machine chest press |
| Barbell row | 3 | 8–10 | 2–3 min | 7→9 | Lats, traps, biceps | Dumbbell row | Seated cable row |
| DB lateral raise | 3 | 12–15 | 1–2 min | 9→10 | Side deltoids | Cable lateral raise | Machine lateral raise |
| Dumbbell curl | 3 | 10–12 | 1–2 min | 9→10 | Biceps | Barbell curl | Cable curl |
| Seated calf raise | 3 | 12–15 | 1–2 min | 9→10 | Calves | Standing calf raise | Leg press calf press |

**Day B**
| Exercise | Sets | Reps | Rest | RPE early→last | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|---|
| Romanian deadlift | 3 | 8–10 | 2–3 min | 6→7 | Hamstrings, glutes | Deadlift | Hip thrust |
| Lat pulldown | 3 | 8–10 | 2–3 min | 7→9 | Lats, biceps | Pull-up | Cable pulldown |
| DB shoulder press | 3 | 8–12 | 2–3 min | 7→9 | Shoulders, triceps | BB overhead press | Machine shoulder press |
| Leg extension | 2 | 15–20 | 1–2 min | 9→10 | Quads | Goblet squat | Dumbbell lunge |
| Tricep pushdown | 3 | 10–12 | 1–2 min | 9→10 | Triceps | Overhead tricep ext. | EZ-bar skullcrusher |
| Cable crunch | 3 | 10–15 | 1 min | 9→10 | Abs | Ab wheel rollout | Hanging knee raise |

**Weekly volume audit (2× standard):**
| Muscle | Sets/week | vs Minimum (10) | vs Optimal (12–16) |
|---|---|---|---|
| Chest | 3 | ⚠️ -7 | ⚠️ -9 |
| Back | 6 | ⚠️ -4 | ⚠️ -6 |
| Shoulders | 6 | ⚠️ -2 | ⚠️ -4 |
| Biceps | 3 | ⚠️ -3 | ⚠️ -5 |
| Triceps | 6 | ⚠️ 0 (min 6) | ⚠️ -2 |
| Quads | 5 | ⚠️ -5 | ⚠️ -7 |
| Hamstrings | 3 | ⚠️ -5 | ⚠️ -7 |
| Glutes | 3 | ⚠️ -5 | ⚠️ -9 |
| Calves | 3 | ⚠️ -5 | ⚠️ -7 |
| Abs | 3 | ⚠️ -3 | ⚠️ -5 |

> **Note:** 2×/week programs are structurally volume-limited. The honest_note in programGenerator acknowledges this: "~60% of results at 4 days/week." These numbers are expected, not a bug. The app already warns users.

---

### B. Full Body 2×/week — Express (Fat Loss / Endurance, 45–60 min)

**Day A**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| Leg press | 3 | 6–8 | 3–4 min | Quads, glutes | BB back squat | Goblet squat |
| Dumbbell bench press | 3 | 8–10 | 2–3 min | Chest, shoulders, triceps | BB bench press | Machine chest press |
| Dumbbell row | 3 | 10–12 | 2–3 min | Back, biceps | Barbell row | Seated cable row |
| SS: Dumbbell curl | 2 | 12–15 | 30 sec | Biceps | Barbell curl | Cable curl |
| SS: Tricep pushdown | 2 | 12–15 | 1–2 min | Triceps | Overhead tricep ext. | EZ-bar skullcrusher |

**Day B**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| Romanian deadlift | 3 | 8–10 | 2–3 min | Hamstrings, glutes | Hip thrust | 45° back ext. |
| Lat pulldown | 3 | 8–12 | 2–3 min | Lats, biceps | Pull-up | Chin-up |
| Barbell overhead press | 3 | 6–10 | 2–3 min | Shoulders, triceps | DB shoulder press | Machine shoulder press |
| SS: Lateral raise | 2 | 12–15 | 30 sec | Side deltoids | Cable lateral raise | Machine lateral raise |
| SS: Seated calf raise | 2 | 12–15 | 1–2 min | Calves | Standing calf raise | Leg press calf press |

> Express version removes abs, reduces iso sets, adds supersets. Slightly less volume than standard 2×, offset by training density and time efficiency.

---

### C. Full Body 3×/week — Standard (Beginner)

**Day A (Mon)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| BB back squat | 3 | 6–8 | 3–4 min | Quads, glutes | Goblet squat | Leg press |
| BB bench press | 3 | 6–8 | 3–4 min | Chest, shoulders, triceps | DB bench press | Machine chest press |
| Barbell row | 3 | 8–10 | 2–3 min | Back, biceps | Dumbbell row | Pendlay row |
| DB lateral raise | 3 | 12–15 | 1–2 min | Side deltoids | Cable lateral raise | Machine lateral raise |
| SS: Barbell curl | 2 | 10–12 | 30 sec | Biceps | Dumbbell curl | Cable curl |
| SS: Seated calf raise | 2 | 10–12 | 1–2 min | Calves | Standing calf raise | Leg press calf press |

**Day B (Wed)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| Romanian deadlift | 3 | 8–10 | 2–3 min | Hamstrings, glutes | Deadlift | Hip thrust |
| DB shoulder press | 3 | 8–12 | 2–3 min | Shoulders, triceps | BB overhead press | Machine shoulder press |
| Lat pulldown | 3 | 8–10 | 2–3 min | Lats, biceps | Pull-up | Chin-up |
| Leg extension | 2 | 15–20 | 1–2 min | Quads | Dumbbell lunge | Bulgarian split squat |
| SS: Tricep pushdown | 2 | 12–15 | 30 sec | Triceps | Overhead tricep ext. | EZ-bar skullcrusher |
| SS: Standing calf raise | 2 | 12–15 | 1–2 min | Calves | Seated calf raise | Leg press calf press |

**Day C (Fri)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| Leg press | 3 | 8–10 | 3–4 min | Quads, glutes | Bulgarian split squat | BB front squat |
| Incline BB press | 3 | 8–10 | 2–3 min | Upper chest, shoulders | Incline DB press | Machine incline press |
| Seated cable row | 3 | 10–12 | 2–3 min | Back, biceps | Dumbbell row | Barbell row |
| Hip thrust | 3 | 10–15 | 2 min | Glutes | 45° back ext. | Romanian deadlift |
| Face pull | 3 | 15–20 | 1 min | Rear delts, rotator cuff | Reverse fly | Band pull-apart |
| Cable crunch | 3 | 10–15 | 1 min | Abs | Ab wheel rollout | Hanging knee raise |

**Weekly volume audit (3× standard):**
| Muscle | Sets/week | vs Minimum (10) | vs Optimal (12–16) |
|---|---|---|---|
| Chest | 6 (A bench + C incline) | ⚠️ -4 | ⚠️ -6 |
| Back | 11 (A row + B lat pulldown + C cable row) | ✅ +1 | ⚠️ -1 |
| Shoulders | 8 (B OHP + A lateral raise + C face pull) | ✅ min met | ⚠️ -2 |
| Biceps | 4 (indirect) | ⚠️ -2 | ⚠️ -4 |
| Triceps | 4 (indirect) | ⚠️ -2 | ⚠️ -4 |
| Quads | 8 (A squat + B leg ext + C leg press) | ⚠️ -2 | ⚠️ -4 |
| Hamstrings | 3 (B RDL) | ⚠️ -5 | ⚠️ -7 |
| Glutes | 6 (B RDL + C hip thrust) | ⚠️ -2 | ⚠️ -6 |
| Calves | 4 (A + B calf raise) | ⚠️ -4 | ⚠️ -8 |
| Abs | 3 (C crunch) | ⚠️ -3 | ⚠️ -5 |

> **Flag:** Hamstrings significantly underserved at 3 sets/week. Glutes low. Calves low. Consider adding leg curl on Day B or C.

---

### D. Full Body 3×/week — Express (Fat Loss / Endurance, 45–60 min)

**Day A:** Machine chest press (2×6–8) · SS: Leg press / Lateral raise (3×6–8 / 3×12–15) · Chest-supported row (2×8–10) · SS: Barbell curl / Seated calf raise (2×12–15 each)

**Day B:** Romanian deadlift (3×8–10) · Lat pulldown (3×8–10) · Glute ham raise (2×8–10) · Pec deck (2×15–20) · SS: EZ skullcrusher / Cable crunch (2×12–15 each)

**Day C:** Incline DB press (2×8–10) · 45° back extension (3×8–10) · Dumbbell row (2×10–12) · Leg extension (2×15–20) · SS: Incline DB curl / Standing calf raise (2×10–12 / 2×12–15)

> Express versions use 2-set compounds instead of 3, replace heavy multi-joint movements with machine alternatives, and use supersets throughout to compress session time.

---

### E. Upper / Lower 4×/week — Standard (Beginner–Intermediate)

**Upper A — Strength (Mon)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| BB bench press | 3 | 3–5 | 3–4 min | Chest, shoulders, triceps | Machine chest press | Flat DB press |
| Barbell row | 3 | 5–7 | 3–4 min | Back, biceps | Pendlay row | Dumbbell row |
| BB overhead press | 3 | 5–8 | 3–4 min | Shoulders, triceps | DB shoulder press (seated) | DB shoulder press (standing) |
| Lat pulldown | 3 | 8–10 | 2–3 min | Lats, biceps | Pull-up | Chin-up |
| DB lateral raise | 2 | 12–15 | 1–2 min | Side deltoids | Cable lateral raise | Machine lateral raise |
| SS: Barbell curl | 2 | 10–12 | 30 sec | Biceps | Dumbbell curl | EZ-bar curl |
| SS: Tricep pushdown | 2 | 10–12 | 1–2 min | Triceps | Overhead tricep ext. | EZ-bar skullcrusher |

**Lower A — Quad Focus (Tue)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| BB back squat | 3 | 3–5 | 3–5 min | Quads, glutes | Leg press | Goblet squat |
| Romanian deadlift | 3 | 6–10 | 2–3 min | Hamstrings, glutes | Deadlift | Hip thrust |
| Leg press | 3 | 8–10 | 3–4 min | Quads, glutes | Bulgarian split squat | Dumbbell lunge |
| Leg extension | 2 | 15–20 | 1–2 min | Quads | Goblet squat | Sissy squat |
| Seated calf raise | 3 | 10–20 | 1–2 min | Calves | Standing calf raise | Leg press calf press |
| Cable crunch | 3 | 10–15 | 1 min | Abs | Decline sit-up | Hanging knee raise |

**Upper B — Hypertrophy (Thu)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| Incline DB press | 3 | 8–12 | 2–3 min | Upper chest | Incline machine press | Incline BB press |
| Seated cable row | 3 | 10–15 | 2–3 min | Back, biceps | Dumbbell row | Chest-supported row |
| Cable fly | 2 | 12–15 | 1–2 min | Chest | Pec deck | Dumbbell fly |
| Face pull | 3 | 15–20 | 1 min | Rear delts | Reverse fly | Band pull-apart |
| Lateral raise | 3 | 15–20 | 1–2 min | Side deltoids | Cable lateral raise | Machine lateral raise |
| SS: Incline DB curl | 2 | 10–12 | 30 sec | Biceps long head | Cable curl | Preacher curl |
| SS: Overhead tricep ext. | 2 | 10–12 | 1–2 min | Triceps long head | DB skullcrusher | Cable tricep ext. |

**Lower B — Posterior Chain (Fri)**
| Exercise | Sets | Reps | Rest | Primary muscles | Alt 1 | Alt 2 |
|---|---|---|---|---|---|---|
| Conventional deadlift | 3 | 3–5 | 3–5 min | Glutes, hamstrings, back | Romanian deadlift | Hip thrust |
| Bulgarian split squat | 3 | 8–10 | 2–3 min | Quads, glutes | Barbell lunge | Leg press |
| Hip thrust | 3 | 10–15 | 2 min | Glutes | 45° back ext. | Glute bridge |
| Lying leg curl | 3 | 10–15 | 1–2 min | Hamstrings | Nordic ham curl | Seated leg curl |
| Hip abduction | 2 | 15–20 | 1 min | Glute medius | Cable hip abduction | Lateral banded walk |
| Standing calf raise | 3 | 10–15 | 1–2 min | Calves | Seated calf raise | Leg press calf press |

**Weekly volume audit (Upper/Lower 4×):**
| Muscle | Sets/week | vs Minimum (10) | vs Optimal (12–16) |
|---|---|---|---|
| Chest | 10 (UA bench + UB incline + UB fly) | ✅ meets min | ⚠️ -2 |
| Back | 12 (UA row + UA lat pulldown + UB cable row + UB face pull) | ✅ | ✅ |
| Shoulders | 10 (UA OHP + UA lateral + UB face pull + UB lateral) | ✅ | ⚠️ -2 |
| Biceps | 8 (direct + indirect rows/pulldowns) | ✅ meets min | ⚠️ -0 |
| Triceps | 8 (direct + indirect pressing) | ✅ meets min | ⚠️ 0 |
| Quads | 14 (LA squat + LA leg press + LA leg ext + LB BSS) | ✅ | ✅ |
| Hamstrings | 9 (LA RDL + LB deadlift + LB leg curl) | ⚠️ -1 | ⚠️ -1 |
| Glutes | 12 (LA RDL + LA squat + LB deadlift + LB hip thrust + LB hip abduction) | ✅ | ✅ |
| Calves | 6 (LA seated + LB standing) | ⚠️ -2 | ⚠️ -4 |
| Abs | 3 (LA crunch) | ⚠️ -3 | ⚠️ -5 |

> **Flags:** Calves still below minimum at only 6 sets. Abs at 3 sets — needs a second ab session. Hamstrings borderline at 9 sets.

---

### F. Upper / Lower 4×/week — Express

Same structure as standard 4×, reduced to 2 sets per compound, supersets throughout. Volume approximately 70% of standard. Session time 45–60 min.

Key exercise differences: Machine chest press replaces BB bench, Chest-supported row replaces barbell row, Hack squat replaces BB squat.

---

### G. Hybrid 5×/week (Intermediate–Advanced)

**Upper A — Heavy (Mon):** BB bench 3×3–5 · Barbell row 3×5–7 · BB overhead press 3×5–8 · Weighted pull-up 3×5–8 · DB lateral raise 3×12–15

**Lower A — Quad (Tue):** BB squat 4×3–5 · Romanian deadlift 3×6–10 · Leg press 3×8–10 · Leg extension 2×12–20 · Cable crunch 3×10–15

**Push — Chest/Shoulders/Triceps (Wed):** Incline BB press 3×6–10 · DB shoulder press 3×10–12 · Cable fly 3×12–15 · Lateral raise 3×15–20 · SS: Overhead tricep ext./Tricep pushdown 3×10–15 each

**Lower B — Posterior Chain (Fri):** Conventional deadlift 3×3–5 · Bulgarian split squat 3×8–10 · Hip thrust 3×10–15 · Lying leg curl 3×10–15 · Standing calf raise 3×10–15

**Pull — Back/Biceps (Sat):** Pull-up 3×6–10 · Barbell row 3×8–10 · Seated cable row 3×10–12 · Face pull 3×15–20 · SS: Barbell curl/Incline DB curl 3×8–12 each

**Weekly volume audit (Hybrid 5×):**
| Muscle | Sets/week | vs Optimal (12–16) |
|---|---|---|
| Chest | 14 (UA bench + Push incline + Push fly) | ✅ |
| Back | 15 (UA row + Pull pull-up + Pull row + Pull cable row) | ✅ |
| Shoulders | 15 (UA OHP + Push OHP + Push/Pull lateral + Pull face pull) | ✅ |
| Biceps | 12 (direct + indirect) | ✅ |
| Triceps | 12 (direct + indirect) | ✅ |
| Quads | 15 (LA squat × 4 + LA leg press + LA leg ext + LB BSS) | ✅ |
| Hamstrings | 9 (LA RDL + LB deadlift + LB leg curl) | ⚠️ -1 |
| Glutes | 12 (LA squat + LB deadlift + LB hip thrust + LB BSS) | ✅ |
| Calves | 3 (LB calf raise) | ⚠️ -7 |
| Abs | 3 (LA cable crunch) | ⚠️ -3 |

> **Flag:** Calves critically underserved — only 1 exercise across the whole week. Abs thin. Hamstrings borderline.

---

### H. PPL 6×/week (Intermediate–Advanced)

**Push A — Chest Focus (Mon):** BB bench 4×4–6 · Incline DB press 3×8–12 · Cable fly 3×12–15 · DB shoulder press 3×8–12 · Lateral raise 3×15–20 · SS: Overhead tricep ext./Tricep pushdown 3×10–15 each

**Pull A — Back Focus (Tue):** Pull-up 4×6–10 · Barbell row 3×6–8 · Seated cable row 3×10–12 · Face pull 3×15–20 · SS: Barbell curl/Incline DB curl 3×8–12 each

**Legs A — Quad Focus (Wed):** BB squat 4×4–6 · Leg press 3×10–12 · Romanian deadlift 3×8–10 · Leg extension 3×15–20 · Seated calf raise 3×10–20 · Cable crunch 3×10–15

**Push B — Shoulder Focus (Thu):** BB overhead press 4×5–8 · Incline BB press 3×8–12 · Lateral raise 4×15–20 · Pec deck 3×12–15 · SS: EZ skullcrusher/Cable tricep pushdown 3×10–15 each

**Pull B — Bicep Focus (Fri):** Lat pulldown 4×8–12 · Dumbbell row 3×10–12 · Reverse pec deck 3×12–15 · SS: Barbell curl/Bayesian cable curl/Hammer curl 3×8–15 each

**Legs B — Posterior Chain (Sat):** Conventional deadlift 3×4–6 · Bulgarian split squat 3×8–10 · Hip thrust 3×10–15 · Lying leg curl 3×10–15 · Hip abduction 2×15–20 · Standing calf raise 4×10–15

**Weekly volume audit (PPL 6×):**
| Muscle | Sets/week | vs Optimal (12–16) |
|---|---|---|
| Chest | 20 (PA bench+fly+incline + PB incline+pec deck) | ✅ (high end) |
| Back | 20 (PA pull-up+row+cable row + PB lat pulldown+row) | ✅ (high end) |
| Shoulders | 21 (PA DB press + PB OHP + PA/PB lateral + pulls face pull+rev pec deck) | ⚠️ above 20 — monitor recovery |
| Biceps | 15 (direct: 9 + indirect: ~6) | ✅ |
| Triceps | 12 (direct: 6 + indirect pressing: ~6) | ✅ |
| Quads | 16 (LA squat+leg press+leg ext + LB BSS) | ✅ |
| Hamstrings | 9 (LA RDL + LB deadlift + LB leg curl) | ⚠️ -1 |
| Glutes | 12 | ✅ |
| Calves | 7 (LA seated + LB standing × 4) | ⚠️ -1 |
| Abs | 3 (LA crunch only) | ⚠️ -3 |

> **Flag:** Shoulder volume at 21 sets across 6 days may cause overuse. Hamstrings consistently low across all programs (only 3 exercises: RDL, deadlift, leg curl). Abs appear only in leg days.

---

## 5. Cross-Program Issues (Review These)

| Issue | Severity | Affected programs | Recommended fix |
|---|---|---|---|
| Hamstrings underserved (~9 sets vs 10 min) | Medium | All programs | Add seated/lying leg curl to any program missing it, or increase RDL sets |
| Abs only appear in leg sessions (3 sets/week) | Medium | All programs | Add 1 ab exercise to Upper B or Pull sessions |
| Calves underserved in 2×, 3×, 5× programs | Medium | FB2×, FB3×, Hybrid5× | Add second calf exercise to a second session |
| Chest volume borderline on 3× and below | Low | FB2×, FB3× | Expected given day count — note in UI already |
| Shoulder volume in PPL (21 sets) | Low | PPL 6× | Consider reducing lateral raises from 4 sets to 3 in Push B |
| No direct bicep/tricep in 2× standard | Low | FB2× | Only 3 sets each — expected and noted |

---

## 6. Condition-Specific Exercise Interactions

From `nutritionConditionsLibrary.js` — how each medical condition affects training:

| Condition | Exercise guidance | Key restriction / watch |
|---|---|---|
| **IBS** | Moderate exercise improves gut motility. Intense training can temporarily worsen symptoms via gut blood flow reduction | Time meals 2–3 hours before training |
| **PCOS** | Resistance training particularly effective — improves insulin sensitivity, reduces androgens, improves body composition more than aerobic alone | Target 150+ min/week combined |
| **Coeliac Disease** | Poor performance, fatigue, higher injury risk until GFD corrects deficiencies. Performance normalises once established | Monitor iron + Vitamin D closely around training blocks |
| **Lactose Intolerance** | Dairy provides high-quality protein (whey/casein) for MPS. If avoiding dairy, ensure adequate protein from alternatives | Calcium watch — stress fracture risk in athletes |
| **Hypothyroidism** | Exercise improves metabolism, body comp, and mood — all impaired in hypothyroidism. RT counteracts muscle loss and metabolic slowdown | Ensure TSH is in range before expecting normal adaptations |
| **Type 2 Diabetes** | Exercise is first-line treatment. Post-meal walks of 10–15 min significantly reduce postprandial glucose. RT specifically highlighted by ADA | Insulin users: monitor glucose pre/post. Hypo risk during exercise |
| **IBD / Crohn's / UC** | Beneficial during remission (reduces inflammation, fatigue, improves bone density). During active flares: gentle activity (walking, yoga) only | High-intensity exercise may worsen symptoms during flares via gut blood flow diversion |
| **Gout** | Exercise helps weight loss — one of the most effective interventions for uric acid reduction | Critical: avoid dehydration during exercise |
| **CKD** | Safe and beneficial — improves CV function, counters sarcopenia. RT preserves muscle mass and metabolic function | Avoid excessive dehydration. Protein post-exercise may be slightly higher but must stay within CKD protein limits |
| **CVD / Hypertension** | Exercise is first-line treatment. RT improves HDL and glycaemic control. Aerobic exercise lowers resting BP 5–8 mmHg | Programs align with AHA 2024 cardiovascular health recommendations |
| **MASLD / NAFLD** | Exercise + diet combination significantly more effective than either alone. RT independently reduces liver fat and improves insulin sensitivity. Even without weight loss, exercise alone reduces liver steatosis | 150–300 min moderate aerobic/week targeted |

### Condition → Program Adjustment Notes

The app currently does **not** algorithmically modify exercise selection or volume based on health conditions — it only adjusts nutrition guidance. These are the recommended adjustments to consider adding:

| Condition | Suggested program adjustment |
|---|---|
| IBD (flare) | Auto-reduce to express/2× program, flag high-intensity exercises |
| CKD | Prefer machine-based alternatives (lower injury risk), avoid high-rep failure training |
| CVD | Flag maximal-effort sets (RPE 10) — cap at RPE 8 for this population |
| Hypothyroidism | No program change needed once medically managed, but flag if user reports fatigue unresponsive to deload |
| PCOS | Prioritise resistance training — should be shown as primary, not optional |
| T2 Diabetes | Show post-meal walk recommendation as a tip in TodayScreen |
| Gout | Flag dehydration risk during long sessions |

---

## 7. Summary Scorecard

| Program | Goals served | Volume adequacy | Condition flags | Overall |
|---|---|---|---|---|
| Full Body 2× Standard | All (suboptimal) | ⚠️ Below minimum most muscles | None | Use with clear expectation setting |
| Full Body 2× Express | Fat loss, Endurance | ⚠️ Very low volume | None | OK for time-constrained users |
| Full Body 3× Standard | All | ⚠️ Borderline — hamstrings/calves low | None | Needs hamstring + ab additions |
| Full Body 3× Express | Fat loss, Endurance | ⚠️ Moderate | None | Acceptable for goal |
| Upper/Lower 4× Standard | All | ✅ Most muscles at min | Calves + abs low | Best beginner-intermediate option |
| Upper/Lower 4× Express | Fat loss, Endurance | ✅ Mostly adequate | Calves + abs low | Good time-compressed option |
| Hybrid 5× | Muscle, Strength | ✅ Optimal most muscles | Calves critically low, abs thin | Add calf to Pull or Upper day |
| PPL 6× | All, high volume | ✅ Chest/back/shoulders at top | Shoulder overload risk, abs thin | Reduce Push B laterals, add ab day |

---

*Generated from: programLibrary.js · programGenerator.js · scienceEngine.js · nutritionConditionsLibrary.js*
*Last updated: 2026-04-30*
