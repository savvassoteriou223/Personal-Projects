// LiftIQ Science Engine
// All principles derived exclusively from peer-reviewed research
// No proprietary content — sources cited for every claim
//
// Key sources:
// [1] Schoenfeld, Ogborn & Krieger (2017) J Sports Sci 35(11):1073-1082
// [2] Schoenfeld, Ogborn & Krieger (2016) Sports Med 46(11):1689-1697
// [3] Schoenfeld & Grgic (2019) J Sports Sci 37(11):1286-1295
// [4] Schoenfeld et al. (2016) J Strength Cond Res 30(7):1805-1812
// [5] Morton et al. (2016) J Appl Physiol 121(1):129-138
// [6] Schoenfeld & Grgic (2020) Sports Med Open 7(1):1-10
// [7] Zourdos et al. (2016) J Strength Cond Res 30(1):267-275
// [8] Refalo et al. (2023) Sports Med 53(3):649-665
// [9] Baz-Valle et al. (2022) J Hum Kinet 81:199-210

export const RPE_SCALE = [
  { rpe: 10,  rir: 0, label: 'Maximal effort',  description: 'Cannot complete another rep — true muscular failure' },
  { rpe: 9.5, rir: 0, label: 'Near maximal',    description: 'Zero reps left, but could slightly increase the load' },
  { rpe: 9,   rir: 1, label: 'Very hard',        description: '1 rep remaining' },
  { rpe: 8.5, rir: 1, label: 'Hard',             description: 'Definitely 1, possibly 2 reps remaining' },
  { rpe: 8,   rir: 2, label: 'Challenging',      description: '2 reps remaining — target for most working sets' },
  { rpe: 7.5, rir: 2, label: 'Moderate-hard',   description: 'Definitely 2, possibly 3 reps remaining' },
  { rpe: 7,   rir: 3, label: 'Moderate',         description: '3 reps remaining — acceptable for opening sets' },
  { rpe: 6,   rir: 4, label: 'Easy',             description: '4+ reps remaining — warm-up zone' },
  { rpe: 5,   rir: 5, label: 'Very easy',        description: '5+ reps remaining — insufficient stimulus' },
];
// Source: RPE scale adapted for resistance training by Zourdos et al. (2016) [7]

export const EFFORT_GUIDELINES = {
  research_summary: 'Proximity to failure is essential for maximizing hypertrophy regardless of rep range (Refalo et al., 2023 [8]). Training to complete failure is not necessary — 1-2 RIR produces equivalent growth while preserving recovery capacity.',
  by_exercise_type: {
    primary_compounds: { target_rpe: '7–8', target_rir: '2–3', rationale: 'High systemic fatigue. RPE 7-8 provides adequate stimulus while preserving performance across subsequent sets.' },
    secondary_compounds: { target_rpe: '8–9', target_rir: '1–2', rationale: 'Moderate fatigue. Can train closer to failure while maintaining quality.' },
    isolation: { target_rpe: '9–10', target_rir: '0–1', rationale: 'Low injury risk and low systemic fatigue. Near-failure training well tolerated.' },
  },
};

export const VOLUME_GUIDELINES = {
  research_basis: 'Schoenfeld et al. (2017) [1] meta-analysis of 15 studies found a significant dose-response between weekly sets per muscle and hypertrophy (p=0.002). Each additional set increased muscle size by ~0.37%.',
  minimum_effective: { sets_per_week: 10, source: 'Schoenfeld et al. (2017) [1]' },
  optimal_range: { sets_per_week: '12–20', source: 'Baz-Valle et al. (2022) [9]; Schoenfeld et al. (2017) [1]' },
  diminishing_returns: { threshold: '20+ sets per week', notes: 'Recovery cost begins to outweigh hypertrophic benefit beyond this threshold.' },
  by_experience: {
    beginner:     { weekly_sets: '10–12' },
    intermediate: { weekly_sets: '12–16' },
    advanced:     { weekly_sets: '16–20' },
  },
  what_counts: 'Sets taken to RPE 6+ for compounds, RPE 7+ for isolation. Warm-up sets excluded (Zourdos et al., 2016 [7]).',
};

export const REST_PERIODS = {
  research_basis: 'Schoenfeld et al. (2016) [4] RCT found 3-minute rest periods produced significantly greater hypertrophy and strength than 1-minute rest in resistance-trained men.',
  by_exercise_type: [
    { type: 'Heavy compounds', rest_seconds: 180, rest_range: '3–5 min', rationale: 'Greatest fatigue. Short rest reduces set quality and total volume.' },
    { type: 'Moderate compounds', rest_seconds: 120, rest_range: '2–3 min', rationale: 'Adequate recovery while maintaining session efficiency.' },
    { type: 'Isolation exercises', rest_seconds: 60, rest_range: '1–2 min', rationale: 'Local fatigue recovers faster. Shorter rest acceptable.' },
  ],
};

export const REP_RANGES = {
  research_basis: 'Morton et al. (2016) [5] found no significant difference in hypertrophy between 8-12RM and 20-25RM training taken close to failure in resistance-trained men. Schoenfeld & Grgic (2020) [6] proposed muscle adaptations occur across a wide loading spectrum.',
  ranges: [
    { range: '1–5',   primary_benefit: 'Maximal strength and neuromuscular adaptation', notes: 'High CNS demand. More warm-up sets required. Best for primary compounds.' },
    { range: '5–12',  primary_benefit: 'Optimal strength and hypertrophy balance', notes: 'Most practical range for accumulating volume with progressive overload.' },
    { range: '12–20', primary_benefit: 'Hypertrophy with high metabolic stress', notes: 'Equally effective when taken close to failure (Morton et al., 2016).' },
    { range: '20–30+', primary_benefit: 'Muscular endurance', notes: 'Cardiovascular limitation often precedes muscular failure. Use strategically.' },
  ],
};

export const PROGRESSIVE_OVERLOAD = {
  definition: 'Systematic increase in training stress over time to maintain a hypertrophic stimulus as the body adapts.',
  strategies: [
    { id: 'linear_load',        name: 'Load progression',   description: 'Increase weight while maintaining sets and reps. Primary method for beginners.' },
    { id: 'rep_overload',       name: 'Rep progression',    description: 'Keep load fixed, add reps each session within a target range.' },
    { id: 'double_progression', name: 'Double progression', description: 'Work within a rep range. Hit the top end, then increase load and return to the bottom. Most sustainable long-term method.' },
    { id: 'adding_sets',        name: 'Volume progression', description: 'Add working sets while maintaining load and rep range.' },
    { id: 'reduce_rest',        name: 'Density progression', description: 'Same work in less time. Secondary strategy — do not compromise set quality.' },
  ],
};

export const TRAINING_FREQUENCY = {
  research_basis: 'Schoenfeld et al. (2016) [2] meta-analysis: twice per week superior to once per week for hypertrophy. Schoenfeld & Grgic (2019) [3]: no significant difference between frequencies when total volume is equated.',
  key_finding: 'Train each muscle group at least twice per week. Beyond twice weekly, total volume matters more than frequency.',
  by_experience: {
    beginner:     { optimal: '2–3 full-body sessions/week', split: 'Full body' },
    intermediate: { optimal: '4 sessions/week, each muscle 2×', split: 'Upper/Lower' },
    advanced:     { optimal: '5–6 sessions/week, each muscle 2–3×', split: 'PPL or Hybrid' },
  },
};

export const WARMUP_PROTOCOL = {
  general: { duration: '5–10 min', methods: ['Light cardio', 'Dynamic stretching', 'Arm circles, leg swings'] },
  exercise_specific: {
    heavy_compounds: '3–4 sets (squat, deadlift, bench, overhead press)',
    moderate_compounds: '2 sets (rows, pull-ups, lunges)',
    isolation: '0–1 sets (curls, lateral raises)',
    pyramid: {
      set_1: '45–50% working weight × 6–10 reps',
      set_2: '60–65% working weight × 4–6 reps',
      set_3: '75–80% working weight × 3–5 reps',
    },
  },
};

export const RECOVERY_GUIDELINES = {
  between_sessions: {
    minimum_days: '2–4 days per muscle group',
    rationale: 'Protein synthesis peaks 24-48h post-exercise and returns to baseline by 48-72h in trained individuals.',
  },
  sleep: { recommended_hours: '7–9', minimum: 7 },
  nutrition: {
    protein_min_per_kg: 1.6,
    protein_optimal_per_kg: 2.2,
    source: 'Morton et al. (2018) meta-analysis: intakes beyond 1.62g/kg/day provided no additional benefit to fat-free mass',
    caloric_surplus: '5–10% above maintenance for muscle gain',
    caloric_deficit: '10–20% below maintenance — muscle gain possible but at reduced rate',
  },
  deload: {
    frequency: 'Every 4–8 weeks or when performance consistently declines',
    protocol: 'Reduce volume 30–50% for one week. Load can remain similar.',
    signs_needed: ['Consistent strength decrease', 'Persistent joint discomfort', 'Motivation decline', 'Unresolved soreness'],
  },
};

export const VOLUME_BY_MUSCLE = {
  chest:      { min: 10, optimal: '12–16', freq: '2×/week', notes: 'Include flat and incline pressing for upper/lower fiber development (Fonseca et al., 2014).' },
  back:       { min: 10, optimal: '12–16', freq: '2×/week', notes: 'Include vertical pulls (lat width) and horizontal pulls (back thickness).' },
  shoulders:  { min: 8,  optimal: '10–14', freq: '2–3×/week', notes: 'Side deltoid requires direct isolation — pressing primarily develops anterior deltoids.' },
  biceps:     { min: 6,  optimal: '8–12',  freq: '2×/week', notes: 'Account for indirect volume from rows and pull-ups.' },
  triceps:    { min: 6,  optimal: '8–12',  freq: '2×/week', notes: 'Long head (largest portion) best trained with arm overhead.' },
  quads:      { min: 10, optimal: '12–16', freq: '2×/week', notes: 'Multiple exercises produce more complete development than squats alone (Fonseca et al., 2014).' },
  hamstrings: { min: 8,  optimal: '10–14', freq: '2×/week', notes: 'Train at long muscle lengths (hip hinge) and with direct isolation (leg curl).' },
  glutes:     { min: 8,  optimal: '12–16', freq: '2×/week', notes: 'Train through peak contraction (hip thrust) and lengthened position (Romanian deadlift).' },
  calves:     { min: 8,  optimal: '10–14', freq: '2–3×/week', notes: 'Full range of motion with emphasis on the stretch position.' },
  abs:        { min: 6,  optimal: '8–12',  freq: '2×/week', notes: 'EMG research: rectus abdominis is minimally active during squats/deadlifts. Direct work necessary.' },
};

export const MUSCLE_GAIN_EXPECTATIONS = {
  men: [
    { year: 'Year 1', monthly_kg: '0.9–1.1' },
    { year: 'Year 2', monthly_kg: '0.45–0.55' },
    { year: 'Year 3', monthly_kg: '0.23–0.27' },
    { year: 'Year 4', monthly_kg: '0.11–0.14' },
    { year: 'Year 5+', monthly_kg: '0.05–0.09' },
  ],
  key_points: [
    'Caloric surplus of 5–10% above maintenance optimizes muscle gain with minimal fat accumulation',
    'Body recomposition is most achievable for beginners and those returning after a layoff',
    'Consistency over years is the primary determinant of results',
  ],
};

// Helpers
export const getRPEInfo = (rpe) =>
  RPE_SCALE.find(r => r.rpe === rpe) ||
  RPE_SCALE.find(r => Math.abs(r.rpe - rpe) < 0.6);

export const getRestForType = (type) =>
  REST_PERIODS.by_exercise_type.find(r =>
    r.type.toLowerCase().includes(type.toLowerCase())
  ) || REST_PERIODS.by_exercise_type[1];
