// LiftIQ Program Library
// Programs designed from peer-reviewed exercise science principles
// No proprietary content from any book or third party
//
// Structural principles:
// - Split selection: Schoenfeld et al. (2016) — 2×/week per muscle superior to 1×/week
// - Volume: Schoenfeld et al. (2017) — 10–20 sets/week per muscle group
// - Rep ranges: Morton et al. (2016) — all rep ranges effective close to failure
// - Rest periods: Schoenfeld et al. (2016) — 3+ min rest for compounds
// - Exercise variety: Fonseca et al. (2014) — variety produces more complete development
// - Effort: Refalo et al. (2023) — proximity to failure essential; failure not necessary

// ─── PROGRAM SELECTION ───────────────────────────────────────────────────────

export function selectProgram(profile) {
  const days = parseInt(profile.weekly_workouts) || 3;
  const goals = profile.goals || [];

  const wantsStrength = goals.includes('strength');
  const wantsEndurance = goals.includes('endurance');
  const wantsFat = goals.includes('lose_fat') || goals.includes('fat');
  const wantsMuscle = goals.includes('gain') || goals.includes('muscle') || goals.includes('aesthetics');

  // Pure endurance or fat loss only → higher rep express versions
  const conditioningOnly = (wantsEndurance || wantsFat) && !wantsMuscle && !wantsStrength;

  if (days <= 2) return conditioningOnly ? PROGRAMS.full_body_2x_express : PROGRAMS.full_body_2x;
  if (days === 3) return conditioningOnly ? PROGRAMS.full_body_3x_express : PROGRAMS.full_body_3x;
  if (days === 4) return conditioningOnly ? PROGRAMS.upper_lower_4x_express : PROGRAMS.upper_lower_4x;
  if (days === 5) return PROGRAMS.hybrid_5x;
  return PROGRAMS.ppl_6x;
}

// ─── PROGRAM DATA ─────────────────────────────────────────────────────────────

export const PROGRAMS = {

  // ─── FULL BODY 2× / WEEK ─────────────────────────────────────────────────
  full_body_2x: {
    id: 'full_body_2x',
    name: 'Full Body 2×/week',
    split: 'Full Body',
    days_per_week: 2,
    level: 'Beginner',
    session_time: '60–90 min',
    schedule: ['Monday', 'Thursday'],
    science_basis: 'Schoenfeld et al. (2016): training each muscle twice per week is superior to once per week for hypertrophy. Full-body sessions achieve this with minimal training days.',
    progression: 'Double progression — add reps within the range each session. When all sets reach the top end, increase load and return to the bottom of the range.',
    days: [
      {
        id: 'day_a', name: 'Day A',
        exercises: [
          { name: 'Barbell back squat',     warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Goblet squat',          sub2: 'Leg press',             muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Barbell bench press',    warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Dumbbell bench press',  sub2: 'Machine chest press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Barbell row',            warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Dumbbell row',          sub2: 'Seated cable row',      muscles: 'Lats, traps, biceps', category: 'Horizontal pull' },
          { name: 'Dumbbell lateral raise', warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Dumbbell curl',          warmup: '0–1', sets: 3, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Barbell curl',          sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Seated calf raise',      warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Standing calf raise',   sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'day_b', name: 'Day B',
        exercises: [
          { name: 'Romanian deadlift',        warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 6, last_rpe: 7, rest: '2–3 min', sub1: 'Deadlift',              sub2: 'Hip thrust',            muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Lat pulldown',             warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Cable pulldown',        muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Dumbbell shoulder press',  warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell overhead press',sub2: 'Machine shoulder press',muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Leg extension',            warmup: '0–1', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Goblet squat',          sub2: 'Dumbbell lunge',        muscles: 'Quads', category: 'Isolation' },
          { name: 'Tricep pushdown',          warmup: '0–1', sets: 3, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Overhead tricep ext.',  sub2: 'EZ-bar skullcrusher',   muscles: 'Triceps', category: 'Isolation' },
          { name: 'Cable crunch',             warmup: '0',   sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Ab wheel rollout',      sub2: 'Hanging knee raise',    muscles: 'Abs', category: 'Core' },
        ],
      },
    ],
  },

  // ─── FULL BODY 2× EXPRESS ────────────────────────────────────────────────
  full_body_2x_express: {
    id: 'full_body_2x_express',
    name: 'Full Body 2×/week (Express)',
    split: 'Full Body',
    days_per_week: 2,
    level: 'All levels',
    session_time: '45–60 min',
    schedule: ['Monday', 'Thursday'],
    science_basis: 'Antagonist supersets allow two exercises to be performed with minimal additional rest, increasing training density without compromising set quality (Robbins et al., 2010).',
    progression: 'Double progression within each rep range. Superset structure allows more work per unit time.',
    days: [
      {
        id: 'day_a', name: 'Day A',
        exercises: [
          { name: 'Leg press',                     warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Barbell back squat',    sub2: 'Goblet squat',          muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Dumbbell bench press',          warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell bench press',   sub2: 'Machine chest press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Dumbbell row',                  warmup: '1–2', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell row',           sub2: 'Seated cable row',      muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Superset A1: Dumbbell curl',    warmup: '0',   sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '30 sec → B1', sub1: 'Barbell curl',     sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset A2: Tricep pushdown',  warmup: '0',   sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min → A1',sub1: 'Overhead tricep ext.',sub2: 'EZ-bar skullcrusher', muscles: 'Triceps', category: 'Isolation' },
        ],
      },
      {
        id: 'day_b', name: 'Day B',
        exercises: [
          { name: 'Romanian deadlift',             warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 6, last_rpe: 8, rest: '2–3 min', sub1: 'Hip thrust',            sub2: '45° back extension',    muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Lat pulldown',                  warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Barbell overhead press',        warmup: '1–2', sets: 3, reps: '6–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Dumbbell shoulder press',sub2: 'Machine shoulder press',muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Superset B1: Lateral raise',    warmup: '0',   sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '30 sec → B2',sub1: 'Cable lateral raise', sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Superset B2: Seated calf raise',warmup: '0',   sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min → B1',sub1: 'Standing calf raise',sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
    ],
  },

  // ─── FULL BODY 3× / WEEK ─────────────────────────────────────────────────
  full_body_3x: {
    id: 'full_body_3x',
    name: 'Full Body 3×/week',
    split: 'Full Body',
    days_per_week: 3,
    level: 'Beginner',
    session_time: '60–90 min',
    schedule: ['Monday', 'Wednesday', 'Friday'],
    science_basis: 'Three sessions per week provides higher frequency for each muscle group. Research (Schoenfeld et al., 2016) supports at least twice-weekly training per muscle. 3× weekly also reinforces technique faster for beginners.',
    progression: 'Double progression on all exercises. Rotate exercise variation across the three sessions for more complete muscle development (Fonseca et al., 2014).',
    days: [
      {
        id: 'day_a', name: 'Day A',
        exercises: [
          { name: 'Barbell back squat',       warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Goblet squat',          sub2: 'Leg press',             muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Barbell bench press',      warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Dumbbell bench press',  sub2: 'Machine chest press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Barbell row',              warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Dumbbell row',          sub2: 'Pendlay row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Dumbbell lateral raise',   warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Superset: Barbell curl',   warmup: '0–1', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Dumbbell curl',         sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset: Seated calf raise',warmup:'0–1',sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Standing calf raise',   sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'day_b', name: 'Day B',
        exercises: [
          { name: 'Romanian deadlift',          warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 6, last_rpe: 7, rest: '2–3 min', sub1: 'Deadlift',              sub2: 'Hip thrust',            muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Dumbbell shoulder press',    warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell overhead press',sub2: 'Machine shoulder press',muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Lat pulldown',               warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Leg extension',              warmup: '0–1', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Dumbbell lunge',        sub2: 'Bulgarian split squat', muscles: 'Quads', category: 'Isolation' },
          { name: 'Superset: Tricep pushdown',  warmup: '0–1', sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Overhead tricep ext.',  sub2: 'EZ-bar skullcrusher',   muscles: 'Triceps', category: 'Isolation' },
          { name: 'Superset: Standing calf raise',warmup:'0–1',sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Seated calf raise',     sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'day_c', name: 'Day C',
        exercises: [
          { name: 'Leg press',             warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Bulgarian split squat', sub2: 'Barbell front squat',   muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Incline barbell press', warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Incline dumbbell press',sub2: 'Machine incline press', muscles: 'Upper chest, shoulders', category: 'Horizontal push' },
          { name: 'Seated cable row',      warmup: '1–2', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Dumbbell row',          sub2: 'Barbell row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Hip thrust',            warmup: '1–2', sets: 3, reps: '10–15',early_rpe: 8, last_rpe: 9, rest: '2 min',   sub1: '45° back extension',    sub2: 'Romanian deadlift',     muscles: 'Glutes', category: 'Hip hinge' },
          { name: 'Face pull',             warmup: '0',   sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Reverse fly',           sub2: 'Band pull-apart',       muscles: 'Rear delts, rotator cuff', category: 'Isolation' },
          { name: 'Cable crunch',          warmup: '0',   sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Ab wheel rollout',      sub2: 'Hanging knee raise',    muscles: 'Abs', category: 'Core' },
        ],
      },
    ],
  },

  // ─── FULL BODY 3× EXPRESS ────────────────────────────────────────────────
  full_body_3x_express: {
    id: 'full_body_3x_express',
    name: 'Full Body 3×/week (Express)',
    split: 'Full Body',
    days_per_week: 3,
    level: 'All levels',
    session_time: '45–60 min',
    schedule: ['Monday', 'Wednesday', 'Friday'],
    science_basis: 'Supersets of non-competing muscle groups increase training density without compromising set quality (Robbins et al., 2010). All volume targets maintained within shorter sessions.',
    progression: 'Double progression. Superset structure allows higher weekly volume in less time.',
    days: [
      {
        id: 'day_a', name: 'Day A',
        exercises: [
          { name: 'Machine chest press',          warmup: '2–3', sets: 2, reps: '6–8',  early_rpe: 9, last_rpe: 10,rest: '2–3 min', sub1: 'Bench press',           sub2: 'Flat dumbbell press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Superset A1: Leg press',       warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 8, rest: '30–60 sec',sub1: 'Barbell front squat',  sub2: 'Dumbbell lunge',        muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Superset A2: Lateral raise',   warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Chest-supported row',          warmup: '1–2', sets: 2, reps: '8–10', early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Pendlay row',           sub2: 'Barbell row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Superset B1: Barbell curl',    warmup: '0–1', sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Dumbbell curl',         sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset B2: Seated calf raise',warmup:'0–1', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Standing calf raise',   sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'day_b', name: 'Day B',
        exercises: [
          { name: 'Romanian deadlift',              warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '2–3 min', sub1: 'Hip thrust',            sub2: 'Dumbbell Romanian deadlift',muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Lat pulldown',                   warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Glute ham raise',                warmup: '1–2', sets: 2, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '2 min',   sub1: '45° back extension',    sub2: 'Lying leg curl',        muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Pec deck',                       warmup: '0–1', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Dumbbell fly',          sub2: 'Push-up',               muscles: 'Chest', category: 'Isolation' },
          { name: 'Superset C1: EZ-bar skullcrusher',warmup:'0–1',sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Dumbbell skullcrusher', sub2: 'Overhead tricep ext.',  muscles: 'Triceps', category: 'Isolation' },
          { name: 'Superset C2: Cable crunch',      warmup: '0',   sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Decline sit-up',        sub2: 'Hanging leg raise',     muscles: 'Abs', category: 'Core' },
        ],
      },
      {
        id: 'day_c', name: 'Day C',
        exercises: [
          { name: 'Incline dumbbell press',        warmup: '1–2', sets: 2, reps: '8–10', early_rpe: 9, last_rpe: 10,rest: '2–3 min', sub1: 'Incline machine press', sub2: 'Incline barbell press', muscles: 'Upper chest', category: 'Horizontal push' },
          { name: '45° back extension',            warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Good morning',          sub2: 'Glute ham raise',       muscles: 'Glutes, hamstrings', category: 'Hip hinge' },
          { name: 'Dumbbell row',                  warmup: '1–2', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Chest-supported row',   sub2: 'Barbell row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Leg extension',                 warmup: '1–2', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Goblet squat',          sub2: 'Dumbbell lunge',        muscles: 'Quads', category: 'Isolation' },
          { name: 'Superset D1: Incline dumbbell curl',warmup:'0–1',sets:2,reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Cable curl',            sub2: 'Preacher curl',         muscles: 'Biceps long head', category: 'Isolation' },
          { name: 'Superset D2: Standing calf raise',warmup:'0–1',sets: 2,reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Seated calf raise',     sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
    ],
  },

  // ─── UPPER / LOWER 4× / WEEK ─────────────────────────────────────────────
  upper_lower_4x: {
    id: 'upper_lower_4x',
    name: 'Upper / Lower 4×/week',
    split: 'Upper/Lower',
    days_per_week: 4,
    level: 'Beginner–Intermediate',
    session_time: '60–90 min',
    schedule: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    science_basis: 'Upper/lower split trains each muscle group twice per week (Schoenfeld et al., 2016) while allowing 3-4 days recovery between same-muscle sessions. Alternating heavy/hypertrophy focus provides periodization without complex programming.',
    progression: 'Double progression. Heavy days use lower rep ranges for strength adaptation. Hypertrophy days use moderate rep ranges for volume accumulation.',
    days: [
      {
        id: 'upper_a', name: 'Upper A — Strength',
        exercises: [
          { name: 'Barbell bench press',      warmup: '2–3', sets: 3, reps: '3–5',  early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Machine chest press',   sub2: 'Flat dumbbell press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Barbell row',              warmup: '2–3', sets: 3, reps: '5–7',  early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Pendlay row',           sub2: 'Dumbbell row',          muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Barbell overhead press',   warmup: '2–3', sets: 3, reps: '5–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Dumbbell shoulder press (seated)',sub2:'Dumbbell shoulder press (standing)',muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Lat pulldown',             warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Dumbbell lateral raise',   warmup: '0–1', sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Superset: Barbell curl',   warmup: '0–1', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Dumbbell curl',         sub2: 'EZ-bar curl',           muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset: Tricep pushdown',warmup: '0–1', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Overhead tricep ext.',  sub2: 'EZ-bar skullcrusher',   muscles: 'Triceps', category: 'Isolation' },
        ],
      },
      {
        id: 'lower_a', name: 'Lower A — Quad Focus',
        exercises: [
          { name: 'Barbell back squat',   warmup: '2–3', sets: 3, reps: '3–5',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Leg press',             sub2: 'Goblet squat',          muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Romanian deadlift',    warmup: '2–3', sets: 3, reps: '6–10', early_rpe: 6, last_rpe: 7, rest: '2–3 min', sub1: 'Deadlift',              sub2: 'Hip thrust',            muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Leg press',            warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Bulgarian split squat', sub2: 'Dumbbell lunge',        muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Leg extension',        warmup: '0–1', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Goblet squat',          sub2: 'Sissy squat',           muscles: 'Quads', category: 'Isolation' },
          { name: 'Seated calf raise',    warmup: '0–1', sets: 3, reps: '10–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Standing calf raise',   sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
          { name: 'Cable crunch',         warmup: '0',   sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Plate-weighted decline sit-up',sub2:'Hanging knee raise', muscles: 'Abs', category: 'Core' },
        ],
      },
      {
        id: 'upper_b', name: 'Upper B — Hypertrophy',
        exercises: [
          { name: 'Incline dumbbell press', warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Incline machine press', sub2: 'Incline barbell press', muscles: 'Upper chest', category: 'Horizontal push' },
          { name: 'Seated cable row',       warmup: '1–2', sets: 3, reps: '10–15',early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Dumbbell row',          sub2: 'Chest-supported row',   muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Cable fly',              warmup: '0–1', sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Pec deck',              sub2: 'Dumbbell fly',          muscles: 'Chest', category: 'Isolation' },
          { name: 'Face pull',              warmup: '0',   sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Reverse fly',           sub2: 'Band pull-apart',       muscles: 'Rear delts', category: 'Isolation' },
          { name: 'Lateral raise',          warmup: '0–1', sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Superset: Incline dumbbell curl',warmup:'0–1',sets:2,reps:'10–12',early_rpe:9,last_rpe:10,rest:'30 sec',  sub1: 'Cable curl',            sub2: 'Preacher curl',         muscles: 'Biceps long head', category: 'Isolation' },
          { name: 'Superset: Overhead tricep ext.',warmup:'0–1',sets:2,reps:'10–12',early_rpe:9,last_rpe:10,rest:'1–2 min',  sub1: 'Dumbbell skullcrusher', sub2: 'Cable tricep ext.',     muscles: 'Triceps long head', category: 'Isolation' },
        ],
      },
      {
        id: 'lower_b', name: 'Lower B — Posterior Chain',
        exercises: [
          { name: 'Conventional deadlift',  warmup: '2–3', sets: 3, reps: '3–5',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Romanian deadlift',     sub2: 'Hip thrust',            muscles: 'Glutes, hamstrings, back', category: 'Hip hinge' },
          { name: 'Bulgarian split squat',  warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell lunge',         sub2: 'Leg press',             muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Hip thrust',             warmup: '1–2', sets: 3, reps: '10–15',early_rpe: 8, last_rpe: 9, rest: '2 min',   sub1: '45° back extension',    sub2: 'Glute bridge',          muscles: 'Glutes', category: 'Hip hinge' },
          { name: 'Lying leg curl',         warmup: '0–1', sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Nordic ham curl',       sub2: 'Seated leg curl',       muscles: 'Hamstrings', category: 'Isolation' },
          { name: 'Hip abduction',          warmup: '0',   sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Cable hip abduction',   sub2: 'Lateral banded walk',   muscles: 'Glute medius', category: 'Isolation' },
          { name: 'Standing calf raise',    warmup: '0–1', sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Seated calf raise',     sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
    ],
  },

  // ─── UPPER LOWER 4× EXPRESS ──────────────────────────────────────────────
  upper_lower_4x_express: {
    id: 'upper_lower_4x_express',
    name: 'Upper / Lower 4×/week (Express)',
    split: 'Upper/Lower',
    days_per_week: 4,
    level: 'All levels',
    session_time: '45–60 min',
    schedule: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    science_basis: 'Superset structure increases training density. Upper/lower pairing allows cross-body supersets (e.g., upper body exercise + leg isolation) with zero recovery conflict.',
    progression: 'Double progression. Fewer sets per exercise compensated by superset efficiency.',
    days: [
      {
        id: 'upper_a', name: 'Upper A',
        exercises: [
          { name: 'Machine chest press',          warmup: '2–3', sets: 2, reps: '6–8',  early_rpe: 9, last_rpe: 10,rest: '2–3 min', sub1: 'Bench press',           sub2: 'Flat dumbbell press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Superset A1: Leg press',       warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 8, rest: '30–60 sec',sub1: 'Barbell front squat',  sub2: 'Dumbbell lunge',        muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Superset A2: Lateral raise',   warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Chest-supported row',          warmup: '1–2', sets: 2, reps: '8–10', early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Pendlay row',           sub2: 'Barbell row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Superset B1: Preacher curl',   warmup: '0–1', sets: 2, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'EZ-bar curl',           sub2: 'Dumbbell curl',         muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset B2: Seated calf raise',warmup:'0–1', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Standing calf raise',   sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'lower_a', name: 'Lower A',
        exercises: [
          { name: 'Romanian deadlift',              warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '2–3 min', sub1: 'Dumbbell Romanian deadlift',sub2:'Hip thrust',           muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Lat pulldown',                   warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Glute ham raise',                warmup: '1–2', sets: 2, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '2 min',   sub1: '45° back extension',    sub2: 'Lying leg curl',        muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Pec deck',                       warmup: '0–1', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Dumbbell fly',          sub2: 'Push-up',               muscles: 'Chest', category: 'Isolation' },
          { name: 'Superset C1: EZ-bar skullcrusher',warmup:'0–1',sets: 2,reps: '12–15', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Dumbbell skullcrusher', sub2: 'Overhead tricep ext.',  muscles: 'Triceps', category: 'Isolation' },
          { name: 'Superset C2: Cable crunch',      warmup: '0',   sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Decline sit-up',        sub2: 'Hanging leg raise',     muscles: 'Abs', category: 'Core' },
        ],
      },
      {
        id: 'upper_b', name: 'Upper B',
        exercises: [
          { name: 'Incline dumbbell press',        warmup: '1–2', sets: 2, reps: '8–10', early_rpe: 9, last_rpe: 10,rest: '2–3 min', sub1: 'Incline machine press', sub2: 'Incline barbell press', muscles: 'Upper chest', category: 'Horizontal push' },
          { name: '45° back extension',            warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Good morning',          sub2: 'Glute ham raise',       muscles: 'Glutes, hamstrings, lower back', category: 'Hip hinge' },
          { name: 'Dumbbell row',                  warmup: '1–2', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Chest-supported row',   sub2: 'Barbell row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Leg extension',                 warmup: '1–2', sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Goblet squat',          sub2: 'Dumbbell lunge',        muscles: 'Quads', category: 'Isolation' },
          { name: 'Superset D1: Incline dumbbell curl',warmup:'0–1',sets:2,reps:'10–12', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Cable curl',            sub2: 'Preacher curl',         muscles: 'Biceps long head', category: 'Isolation' },
          { name: 'Superset D2: Standing calf raise',warmup:'0–1',sets: 2,reps:'12–15',  early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Seated calf raise',     sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'lower_b', name: 'Lower B',
        exercises: [
          { name: 'Hack squat',               warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Leg press',             sub2: 'Dumbbell lunge',        muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Lat pulldown',             warmup: '1–2', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Seated leg curl',          warmup: '1–2', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Lying leg curl',        sub2: 'Nordic ham curl',       muscles: 'Hamstrings', category: 'Isolation' },
          { name: 'Reverse pec deck',         warmup: '0–1', sets: 2, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Rope facepull',         sub2: 'Reverse cable fly',     muscles: 'Rear delts', category: 'Isolation' },
          { name: 'Superset E1: Tricep pushdown',warmup:'0–1',sets: 2,reps: '10–12', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'EZ-bar skullcrusher',   sub2: 'Tricep kickback (cable)',muscles: 'Triceps', category: 'Isolation' },
          { name: 'Superset E2: Roman chair leg raise',warmup:'0',sets:2,reps:'10–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Hanging leg raise',     sub2: 'Bent-knee leg raise',   muscles: 'Abs, hip flexors', category: 'Core' },
        ],
      },
    ],
  },

  // ─── HYBRID 5× / WEEK ────────────────────────────────────────────────────
  hybrid_5x: {
    id: 'hybrid_5x',
    name: 'Hybrid 5×/week',
    split: 'Upper/Lower/PPL',
    days_per_week: 5,
    level: 'Intermediate–Advanced',
    session_time: '60–90 min',
    schedule: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
    science_basis: 'Combines upper/lower frequency benefits with PPL session focus. Each muscle trained 2× per week at adequate volume. Alternating emphasis between sessions (strength vs hypertrophy focus) provides within-week variation.',
    progression: 'Double progression. Heavy days use lower reps for strength foundation; light days use higher reps for volume accumulation.',
    days: [
      {
        id: 'upper_a', name: 'Upper A — Heavy',
        exercises: [
          { name: 'Barbell bench press',      warmup: '2–3', sets: 3, reps: '3–5',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Machine chest press',   sub2: 'Flat dumbbell press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Barbell row',              warmup: '2–3', sets: 3, reps: '5–7',  early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Pendlay row',           sub2: 'Dumbbell row',          muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Barbell overhead press',   warmup: '2–3', sets: 3, reps: '5–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Dumbbell shoulder press (seated)',sub2:'Dumbbell shoulder press (standing)',muscles:'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Weighted pull-up',         warmup: '1–2', sets: 3, reps: '5–8',  early_rpe: 7, last_rpe: 9, rest: '3 min',   sub1: 'Lat pulldown',          sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Dumbbell lateral raise',   warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
        ],
      },
      {
        id: 'lower_a', name: 'Lower A — Quad',
        exercises: [
          { name: 'Barbell back squat',   warmup: '2–3', sets: 4, reps: '3–5',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Leg press',             sub2: 'Hack squat',            muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Romanian deadlift',    warmup: '2–3', sets: 3, reps: '6–10', early_rpe: 6, last_rpe: 7, rest: '2–3 min', sub1: 'Hip thrust',            sub2: 'Deadlift',              muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Leg press',            warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Bulgarian split squat', sub2: 'Dumbbell lunge',        muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Leg extension',        warmup: '0–1', sets: 2, reps: '12–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Goblet squat',          sub2: 'Sissy squat',           muscles: 'Quads', category: 'Isolation' },
          { name: 'Cable crunch',         warmup: '0',   sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Ab wheel rollout',      sub2: 'Hanging knee raise',    muscles: 'Abs', category: 'Core' },
        ],
      },
      {
        id: 'push', name: 'Push — Chest / Shoulders / Triceps',
        exercises: [
          { name: 'Incline barbell press',           warmup: '2–3', sets: 3, reps: '6–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Incline dumbbell press',sub2: 'Incline machine press', muscles: 'Upper chest', category: 'Horizontal push' },
          { name: 'Dumbbell shoulder press',         warmup: '1–2', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Machine shoulder press',sub2:'Arnold press',           muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Cable fly',                       warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Pec deck',              sub2: 'Dumbbell fly',          muscles: 'Chest', category: 'Isolation' },
          { name: 'Lateral raise',                   warmup: '0–1', sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Superset: Overhead tricep ext.',  warmup: '0–1', sets: 3, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Dumbbell skullcrusher', sub2: 'EZ-bar skullcrusher',   muscles: 'Triceps long head', category: 'Isolation' },
          { name: 'Superset: Tricep pushdown',       warmup: '0–1', sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable tricep kickback', sub2: 'Rope pushdown',         muscles: 'Triceps', category: 'Isolation' },
        ],
      },
      {
        id: 'lower_b', name: 'Lower B — Posterior Chain',
        exercises: [
          { name: 'Conventional deadlift',  warmup: '2–3', sets: 3, reps: '3–5',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Romanian deadlift',     sub2: 'Hip thrust',            muscles: 'Glutes, hamstrings, back', category: 'Hip hinge' },
          { name: 'Bulgarian split squat',  warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell lunge',         sub2: 'Step-up',               muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Hip thrust',             warmup: '1–2', sets: 3, reps: '10–15',early_rpe: 8, last_rpe: 9, rest: '2 min',   sub1: '45° back extension',    sub2: 'Glute bridge',          muscles: 'Glutes', category: 'Hip hinge' },
          { name: 'Lying leg curl',         warmup: '0–1', sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Nordic ham curl',       sub2: 'Seated leg curl',       muscles: 'Hamstrings', category: 'Isolation' },
          { name: 'Standing calf raise',    warmup: '0–1', sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Seated calf raise',     sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
      {
        id: 'pull', name: 'Pull — Back / Biceps',
        exercises: [
          { name: 'Pull-up',                  warmup: '1–2', sets: 3, reps: '6–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Lat pulldown',          sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Barbell row',              warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Dumbbell row',          sub2: 'Pendlay row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Seated cable row',         warmup: '1–2', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Chest-supported row',   sub2: 'Machine row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Face pull',                warmup: '0',   sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Reverse fly',           sub2: 'Band pull-apart',       muscles: 'Rear delts', category: 'Isolation' },
          { name: 'Superset: Barbell curl',   warmup: '0–1', sets: 3, reps: '8–12', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'EZ-bar curl',           sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset: Incline dumbbell curl',warmup:'0–1',sets:3,reps:'10–12',early_rpe:9,last_rpe:10,rest:'1–2 min',   sub1: 'Bayesian cable curl',   sub2: 'Preacher curl',         muscles: 'Biceps long head', category: 'Isolation' },
        ],
      },
    ],
  },

  // ─── PPL 6× / WEEK ───────────────────────────────────────────────────────
  ppl_6x: {
    id: 'ppl_6x',
    name: 'Push / Pull / Legs 6×/week',
    split: 'Push/Pull/Legs',
    days_per_week: 6,
    level: 'Intermediate–Advanced',
    session_time: '60–90 min',
    schedule: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    science_basis: 'PPL allows focused high-volume sessions per muscle group while maintaining twice-weekly frequency. Research (Schoenfeld et al., 2017) supports 12-20 sets/muscle/week, which PPL delivers efficiently across two focused sessions.',
    progression: 'Alternate A/B session emphasis each week. Session A = strength focus (lower reps), Session B = hypertrophy focus (higher reps).',
    days: [
      {
        id: 'push_a', name: 'Push A — Chest Focus',
        exercises: [
          { name: 'Barbell bench press',            warmup: '2–3', sets: 4, reps: '4–6',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Machine chest press',   sub2: 'Flat dumbbell press',   muscles: 'Chest, shoulders, triceps', category: 'Horizontal push' },
          { name: 'Incline dumbbell press',         warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Incline machine press', sub2: 'Incline barbell press', muscles: 'Upper chest', category: 'Horizontal push' },
          { name: 'Cable fly',                      warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Pec deck',              sub2: 'Dumbbell fly',          muscles: 'Chest', category: 'Isolation' },
          { name: 'Dumbbell shoulder press',        warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Machine shoulder press',sub2: 'Arnold press',          muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Lateral raise',                  warmup: '0–1', sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Superset: Overhead tricep ext.', warmup: '0–1', sets: 3, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'EZ-bar skullcrusher',   sub2: 'Dumbbell skullcrusher', muscles: 'Triceps long head', category: 'Isolation' },
          { name: 'Superset: Tricep pushdown',      warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Rope pushdown',         sub2: 'Cable kickback',        muscles: 'Triceps', category: 'Isolation' },
        ],
      },
      {
        id: 'pull_a', name: 'Pull A — Back Focus',
        exercises: [
          { name: 'Pull-up',                  warmup: '1–2', sets: 4, reps: '6–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Lat pulldown',          sub2: 'Weighted pull-up',      muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Barbell row',              warmup: '2–3', sets: 3, reps: '6–8',  early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pendlay row',           sub2: 'Dumbbell row',          muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Seated cable row',         warmup: '1–2', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 9, rest: '2 min',   sub1: 'Machine row',           sub2: 'Chest-supported row',   muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Face pull',                warmup: '0',   sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Reverse fly',           sub2: 'Band pull-apart',       muscles: 'Rear delts', category: 'Isolation' },
          { name: 'Superset: Barbell curl',   warmup: '0–1', sets: 3, reps: '8–12', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'EZ-bar curl',           sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset: Incline dumbbell curl',warmup:'0–1',sets:3,reps:'10–12',early_rpe:9,last_rpe:10,rest:'1 min',      sub1: 'Bayesian cable curl',   sub2: 'Preacher curl',         muscles: 'Biceps long head', category: 'Isolation' },
        ],
      },
      {
        id: 'legs_a', name: 'Legs A — Quad Focus',
        exercises: [
          { name: 'Barbell back squat',   warmup: '2–3', sets: 4, reps: '4–6',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Leg press',             sub2: 'Hack squat',            muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Leg press',            warmup: '2–3', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 8, rest: '3–4 min', sub1: 'Bulgarian split squat', sub2: 'Dumbbell lunge',        muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Romanian deadlift',    warmup: '2–3', sets: 3, reps: '8–10', early_rpe: 6, last_rpe: 7, rest: '2–3 min', sub1: 'Hip thrust',            sub2: 'Deadlift',              muscles: 'Hamstrings, glutes', category: 'Hip hinge' },
          { name: 'Leg extension',        warmup: '0–1', sets: 3, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Goblet squat',          sub2: 'Sissy squat',           muscles: 'Quads', category: 'Isolation' },
          { name: 'Seated calf raise',    warmup: '0–1', sets: 3, reps: '10–20',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Standing calf raise',   sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
          { name: 'Cable crunch',         warmup: '0',   sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Ab wheel rollout',      sub2: 'Hanging knee raise',    muscles: 'Abs', category: 'Core' },
        ],
      },
      {
        id: 'push_b', name: 'Push B — Shoulder Focus',
        exercises: [
          { name: 'Barbell overhead press',          warmup: '2–3', sets: 4, reps: '5–8',  early_rpe: 7, last_rpe: 9, rest: '3–4 min', sub1: 'Dumbbell shoulder press (standing)',sub2:'Dumbbell shoulder press (seated)', muscles: 'Shoulders, triceps', category: 'Vertical push' },
          { name: 'Incline barbell press',           warmup: '1–2', sets: 3, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Incline dumbbell press',sub2: 'Incline machine press', muscles: 'Upper chest', category: 'Horizontal push' },
          { name: 'Lateral raise',                   warmup: '0–1', sets: 4, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Cable lateral raise',   sub2: 'Machine lateral raise', muscles: 'Side deltoids', category: 'Isolation' },
          { name: 'Pec deck',                        warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Cable fly',             sub2: 'Dumbbell fly',          muscles: 'Chest', category: 'Isolation' },
          { name: 'Superset: EZ-bar skullcrusher',   warmup: '0–1', sets: 3, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Overhead tricep ext.',  sub2: 'Dumbbell skullcrusher', muscles: 'Triceps long head', category: 'Isolation' },
          { name: 'Superset: Cable tricep pushdown',warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Rope pushdown',         sub2: 'Tricep kickback (cable)',muscles: 'Triceps', category: 'Isolation' },
        ],
      },
      {
        id: 'pull_b', name: 'Pull B — Bicep Focus',
        exercises: [
          { name: 'Lat pulldown',             warmup: '1–2', sets: 4, reps: '8–12', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Pull-up',               sub2: 'Chin-up',               muscles: 'Lats, biceps', category: 'Vertical pull' },
          { name: 'Dumbbell row',             warmup: '1–2', sets: 3, reps: '10–12',early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Chest-supported row',   sub2: 'Barbell row',           muscles: 'Back, biceps', category: 'Horizontal pull' },
          { name: 'Reverse pec deck',         warmup: '0–1', sets: 3, reps: '12–15',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Rope facepull',         sub2: 'Reverse cable fly',     muscles: 'Rear delts', category: 'Isolation' },
          { name: 'Superset: Barbell curl',   warmup: '0–1', sets: 3, reps: '8–12', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'EZ-bar curl',           sub2: 'Cable curl',            muscles: 'Biceps', category: 'Isolation' },
          { name: 'Superset: Bayesian cable curl',warmup:'0–1',sets:3,reps:'10–15', early_rpe: 9, last_rpe: 10,rest: '30 sec',  sub1: 'Incline dumbbell curl', sub2: 'Preacher curl',         muscles: 'Biceps long head', category: 'Isolation' },
          { name: 'Superset: Hammer curl',    warmup: '0–1', sets: 3, reps: '10–12',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Reverse curl',          sub2: 'Rope hammer curl',      muscles: 'Brachialis, brachioradialis', category: 'Isolation' },
        ],
      },
      {
        id: 'legs_b', name: 'Legs B — Posterior Chain',
        exercises: [
          { name: 'Conventional deadlift',  warmup: '2–3', sets: 3, reps: '4–6',  early_rpe: 7, last_rpe: 8, rest: '3–5 min', sub1: 'Romanian deadlift',     sub2: 'Sumo deadlift',         muscles: 'Glutes, hamstrings, back', category: 'Hip hinge' },
          { name: 'Bulgarian split squat',  warmup: '1–2', sets: 3, reps: '8–10', early_rpe: 7, last_rpe: 9, rest: '2–3 min', sub1: 'Barbell lunge',         sub2: 'Step-up',               muscles: 'Quads, glutes', category: 'Squat' },
          { name: 'Hip thrust',             warmup: '1–2', sets: 3, reps: '10–15',early_rpe: 8, last_rpe: 9, rest: '2 min',   sub1: '45° back extension',    sub2: 'Glute bridge',          muscles: 'Glutes', category: 'Hip hinge' },
          { name: 'Lying leg curl',         warmup: '0–1', sets: 3, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Nordic ham curl',       sub2: 'Seated leg curl',       muscles: 'Hamstrings', category: 'Isolation' },
          { name: 'Hip abduction',          warmup: '0',   sets: 2, reps: '15–20',early_rpe: 9, last_rpe: 10,rest: '1 min',   sub1: 'Cable hip abduction',   sub2: 'Lateral banded walk',   muscles: 'Glute medius', category: 'Isolation' },
          { name: 'Standing calf raise',    warmup: '0–1', sets: 4, reps: '10–15',early_rpe: 9, last_rpe: 10,rest: '1–2 min', sub1: 'Seated calf raise',     sub2: 'Leg press calf press',  muscles: 'Calves', category: 'Isolation' },
        ],
      },
    ],
  },
};
