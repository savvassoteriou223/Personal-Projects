// LiftIQ Program Generator
// Builds personalized training programs from user profile data
// All principles from peer-reviewed research — no proprietary content
//
// Key sources:
// [1] Schoenfeld, Ogborn & Krieger (2017) J Sports Sci 35(11):1073-1082 — volume dose-response
// [2] Schoenfeld, Ogborn & Krieger (2016) Sports Med 46(11):1689-1697 — 2x/week frequency
// [3] Schoenfeld & Grgic (2019) J Sports Sci 37(11):1286-1295 — frequency when volume equated
// [4] Schoenfeld et al. (2016) J Strength Cond Res 30(7):1805-1812 — 3min rest periods
// [5] Morton et al. (2016) J Appl Physiol 121(1):129-138 — all rep ranges work close to failure
// [6] Baz-Valle et al. (2022) J Hum Kinet 81:199-210 — 12-20 sets/week optimal
// [7] Van Every, Nippard & Phillips (2025) J Sport Health Sci — mechanical tension primary driver
// [8] Kassiano et al. (2023) J Strength Cond Res — long muscle length superior
// [9] Maeo et al. (2024) — double hypertrophy from long-length hamstring training
// [10] Ramos-Campo et al. (2024) J Strength Cond Res 38(7):1330-1340 — split vs full body similar when volume equated
// [11] Pelland et al. (2024) — volume primary driver, frequency graph flat

import { MOVEMENT_PATTERNS, getBestExercise, getExercisesForEquipment } from './movementLibrary';

// ─── VOLUME TARGETS PER MUSCLE ───────────────────────────────────────────────
// Based on: Schoenfeld et al. (2017) [1] and Baz-Valle et al. (2022) [6]

export const VOLUME_TARGETS = {
  chest:      { min: 10, optimal_low: 12, optimal_high: 16, note: 'Include both flat and incline pressing for upper/lower fiber development' },
  back:       { min: 10, optimal_low: 12, optimal_high: 16, note: 'Include vertical pulls (lat width) and horizontal pulls (back thickness)' },
  shoulders:  { min: 8,  optimal_low: 10, optimal_high: 14, note: 'Side delt requires direct isolation — pressing alone develops anterior delt only' },
  biceps:     { min: 6,  optimal_low: 8,  optimal_high: 12, note: 'Account for indirect volume from rows and pull-ups' },
  triceps:    { min: 6,  optimal_low: 8,  optimal_high: 12, note: 'Long head best trained overhead — include at least one overhead extension' },
  quads:      { min: 10, optimal_low: 12, optimal_high: 16, note: 'Multiple exercises produce more complete development than squats alone' },
  hamstrings: { min: 8,  optimal_low: 10, optimal_high: 14, note: 'Train at long muscle lengths — hip hinge is primary, leg curl is secondary' },
  glutes:     { min: 8,  optimal_low: 12, optimal_high: 16, note: 'Train through peak contraction (hip thrust) and lengthened position (RDL)' },
  calves:     { min: 8,  optimal_low: 10, optimal_high: 14, note: 'Full ROM emphasizing the stretch. Respond well to higher reps and higher frequency' },
  abs:        { min: 6,  optimal_low: 8,  optimal_high: 12, note: 'EMG research: rectus abdominis minimally active during squats/deadlifts — direct work necessary' },
};

// ─── SPLIT DEFINITIONS ───────────────────────────────────────────────────────

export const SPLITS = {
  full_body_2x: {
    id: 'full_body_2x',
    name: 'Full Body 2×/week',
    days: 2,
    frequency_per_muscle: 2,
    optimality: 'suboptimal',
    optimality_score: 5,
    science_basis: 'Schoenfeld et al. (2016): twice per week is superior to once per week. Full body sessions are the only way to achieve 2× frequency with only 2 gym days.',
    honest_note: '2 days is the research minimum. Each muscle hits the 2× weekly threshold but with lower total volume than 3-4 day programs. Expect approximately 60% of the results you would get at 4 days/week.',
    session_time_est: '70–90 min',
    day_structure: ['Full Body A', 'Full Body B'],
    schedule_template: ['Monday', 'Thursday'],
    rest_between: [2, 3],
  },
  full_body_3x: {
    id: 'full_body_3x',
    name: 'Full Body 3×/week',
    days: 3,
    frequency_per_muscle: 3,
    optimality: 'good',
    optimality_score: 7,
    science_basis: 'Currier et al. (2023, BJSM, n=5097): higher-load, multiset, thrice-weekly training was the top-ranked prescription for strength (SMD 1.60 vs control) in the largest RT Bayesian NMA to date. Full body 3× directly matches this structure.',
    honest_note: 'A solid, research-supported program. Each muscle trained 3× per week with adequate volume. Beginner and intermediate lifters will make excellent progress here. Lahav et al. (2026, Front Endocrinol): resistance training preserves fat-free mass better than aerobic exercise during caloric restriction — if fat loss is also a goal, keep lifting heavy.',
    session_time_est: '60–80 min',
    day_structure: ['Full Body A', 'Full Body B', 'Full Body C'],
    schedule_template: ['Monday', 'Wednesday', 'Friday'],
    rest_between: [1, 1, 2],
  },
  upper_lower_4x: {
    id: 'upper_lower_4x',
    name: 'Upper / Lower 4×/week',
    days: 4,
    frequency_per_muscle: 2,
    optimality: 'optimal',
    optimality_score: 8,
    science_basis: 'Currier et al. (2023, BJSM, n=3364): higher-load multiset twice-weekly training was the top-ranked prescription for hypertrophy in a Bayesian network meta-analysis of 119 RCTs. Upper/lower achieves this exact structure — each muscle trained 2× per week with high load and multiple sets.',
    honest_note: 'The sweet spot for most lifters. Each muscle trained twice per week with 3 days recovery between sessions. Upper B includes lower chest and trap work for complete upper body coverage. Progressive overload is the engine — when you can complete all your sets with ease for 2–3 weeks in a row, it\'s time to add weight or reps. Tracking your lifts is not optional here: without a log you\'ll plateau without realising it.',
    session_time_est: '60–80 min',
    day_structure: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
    schedule_template: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    rest_between: [0, 1, 0, 2],
  },
  chest_back_shoulders_legs_4x: {
    id: 'chest_back_shoulders_legs_4x',
    name: 'Chest+Tri / Back+Bi / Shoulders / Legs',
    days: 4,
    frequency_per_muscle: 1,
    optimality: 'good',
    optimality_score: 7,
    science_basis: 'Ramos-Campo et al. (2024): split vs full-body produces similar hypertrophy when volume is equated. Focused sessions allow higher per-session volume for each muscle group.',
    honest_note: 'Classic muscle-group split. Each muscle hit once directly per week but with high focused volume. Research shows results similar to upper/lower when total volume is matched.',
    session_time_est: '55–75 min',
    day_structure: ['Chest + Triceps', 'Back + Biceps', 'Shoulders + Abs', 'Legs'],
    schedule_template: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    rest_between: [0, 1, 0, 2],
  },
  ul_ppl_hybrid_5x: {
    id: 'ul_ppl_hybrid_5x',
    name: 'PPL / Upper / Lower 5×/week',
    days: 5,
    frequency_per_muscle: 2,
    optimality: 'optimal',
    optimality_score: 9,
    science_basis: 'Pelland et al. (2024): volume is the primary driver of hypertrophy. Currier et al. (2023, BJSM): all resistance training prescriptions outperform no exercise; multiset higher-load training optimises both strength and hypertrophy. This hybrid achieves maximum volume with maintained 2× frequency.',
    honest_note: 'The best balance of frequency and volume for intermediate-advanced lifters. 5 sessions per week is a significant commitment — only choose this if you can sustain it long-term.',
    session_time_est: '55–75 min',
    day_structure: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
    schedule_template: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday'],
    rest_between: [0, 0, 1, 0, 2],
  },
  ppl_6x: {
    id: 'ppl_6x',
    name: 'Push / Pull / Legs 6×/week',
    days: 6,
    frequency_per_muscle: 2,
    optimality: 'good',
    optimality_score: 7,
    science_basis: 'Each muscle trained twice per week with high per-session volume. 6-day commitment required — each session is focused and shorter than full body workouts.',
    honest_note: 'High commitment — 6 days/week. Works well for dedicated lifters. Warning: slightly upper-body biased (4 upper sessions vs 2 lower). Ensure adequate sleep and nutrition to recover.',
    session_time_est: '50–70 min',
    day_structure: ['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'],
    schedule_template: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    rest_between: [0, 0, 1, 0, 0, 1],
  },
  hybrid_3x: {
    id: 'hybrid_3x',
    name: 'Full Body / Upper / Lower 3×/week',
    days: 3,
    frequency_per_muscle: 2,
    optimality: 'good',
    optimality_score: 6,
    science_basis: 'Hybrid split combining full body with upper/lower. Each muscle hit twice per week across 3 sessions. Great for lifters who want split feel without sacrificing frequency.',
    honest_note: 'Good option if you prefer the feel of a split but only have 3 days. Slightly harder to manage volume than pure full body 3x but equally effective.',
    session_time_est: '60–80 min',
    day_structure: ['Full Body', 'Upper Body', 'Lower Body'],
    schedule_template: ['Monday', 'Wednesday', 'Saturday'],
    rest_between: [1, 2, 1],
  },
  full_body_4x: {
    id: 'full_body_4x',
    name: 'Full Body 4×/week',
    days: 4,
    frequency_per_muscle: 4,
    optimality: 'good',
    optimality_score: 7,
    science_basis: 'Very high frequency — each muscle trained 4× per week. Research shows frequency matters less than volume when equated (Pelland et al., 2024). Best for advanced lifters who have already maximized lower frequency approaches.',
    honest_note: 'Advanced only. Very high systemic fatigue. Each session must be shorter to allow recovery. Not recommended for beginners or intermediates.',
    session_time_est: '50–65 min',
    day_structure: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D'],
    schedule_template: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
    rest_between: [0, 1, 0, 2],
  },
  upper_lower_6x: {
    id: 'upper_lower_6x',
    name: 'Upper / Lower 6×/week',
    days: 6,
    frequency_per_muscle: 3,
    optimality: 'optimal',
    optimality_score: 8,
    science_basis: 'Each muscle trained 3× per week — maximum practical frequency for hypertrophy. Upper C is a dedicated shoulder specialisation day with OHP, laterals, Y raise, Lu raise, rear delts, and traps.',
    honest_note: 'Excellent for dedicated intermediate-advanced lifters. 6 days is a significant commitment. Upper C gives shoulders their own full session — no volume is missing.',
    session_time_est: '55–70 min',
    day_structure: ['Upper A', 'Lower A', 'Upper B', 'Lower B', 'Upper C (Shoulders)', 'Lower C'],
    schedule_template: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    rest_between: [0, 0, 0, 0, 0, 1],
  },
  full_body_5x: {
    id: 'full_body_5x',
    name: 'Full Body 5×/week',
    days: 5,
    frequency_per_muscle: 5,
    optimality: 'good',
    optimality_score: 7,
    science_basis: 'Advanced lifters only. Maximum frequency — each muscle 5× per week. Sessions must be shorter and lower volume per muscle. Requires excellent recovery, nutrition and sleep.',
    honest_note: 'Advanced only. Very high frequency demands perfect sleep, nutrition, and stress management. Most lifters will do better on the UL/PPL hybrid at 5 days.',
    session_time_est: '45–60 min',
    day_structure: ['Full Body A', 'Full Body B', 'Full Body C', 'Full Body D', 'Full Body E'],
    schedule_template: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    rest_between: [0, 0, 0, 0, 2],
  },
};

// ─── EQUIPMENT NORMALIZER ────────────────────────────────────────────────────

export function normalizeEquipment(onboardingEquipment = []) {
  const equipment = [];
  const raw = onboardingEquipment.map(e => e.toLowerCase());

  if (raw.includes('barbell')) equipment.push('barbell');
  if (raw.includes('dumbbells')) equipment.push('dumbbells');
  if (raw.includes('cables')) equipment.push('cables');
  if (raw.includes('machines')) equipment.push('machines');
  if (raw.includes('kettlebells')) equipment.push('kettlebells');
  if (raw.includes('resistance bands')) equipment.push('bands');
  if (raw.some(e => e.includes('bodyweight'))) equipment.push('bodyweight');

  // Pull-up bar is available if they have a barbell (rack) or machines
  if (equipment.includes('barbell') || equipment.includes('machines')) {
    equipment.push('pullup_bar');
  }

  // Always add bodyweight as a fallback
  if (!equipment.includes('bodyweight')) equipment.push('bodyweight');

  return equipment;
}

// ─── WARNINGS SYSTEM ─────────────────────────────────────────────────────────

export function generateWarnings(profile, selectedSplit) {
  const warnings = [];
  const goals = profile.goals || [];
  const days = parseInt(profile.weekly_workouts) || 3;
  const equipment = normalizeEquipment(profile.equipment || []);
  const wantsMuscle = goals.includes('gain') || goals.includes('strength') || goals.includes('aesthetics');
  const wantsEndurance = goals.includes('endurance');
  const wantsFat = goals.includes('lose');

  // Days warnings
  if (wantsMuscle && days === 2) {
    warnings.push({
      type: 'frequency',
      level: 'high',
      title: 'Suboptimal frequency for muscle growth',
      message: '2 days/week is the research minimum. Each muscle will be trained twice per week but with lower total volume than 3-4 day programs. Expect approximately 60% of the results compared to training 4 days/week.',
      source: 'Schoenfeld, Ogborn & Krieger (2016). Effects of resistance training frequency on measures of muscle hypertrophy. Sports Medicine, 46(11):1689–1697.',
    });
  }

  if (wantsMuscle && days === 3) {
    warnings.push({
      type: 'frequency',
      level: 'info',
      title: 'Good frequency for muscle growth',
      message: '3 days/week meets the research minimum of 2× per muscle per week and allows sufficient volume. A solid choice for lifters with limited time.',
      source: 'Schoenfeld et al. (2016): training twice per week is superior to once per week for hypertrophy.',
    });
  }

  if (wantsMuscle && days >= 4) {
    warnings.push({
      type: 'frequency',
      level: 'success',
      title: 'Optimal frequency for muscle growth',
      message: `${days} days/week allows each muscle to be trained twice per week with adequate volume — the research sweet spot for hypertrophy.`,
      source: 'Schoenfeld et al. (2016); Baz-Valle et al. (2022): 12-20 sets per muscle per week optimal.',
    });
  }

  // Equipment warnings
  if (equipment.length === 1 && equipment[0] === 'bodyweight') {
    warnings.push({
      type: 'equipment',
      level: 'high',
      title: 'Bodyweight training will plateau',
      message: 'Bodyweight training produces results initially but you will plateau without progressive overload. Research shows mechanical tension via increasing resistance is the primary driver of hypertrophy. A weighted vest (~€30) or resistance bands extend progress significantly.',
      source: 'Van Every, Nippard & Phillips (2025). Load-induced human skeletal muscle hypertrophy: Mechanisms, myths, and misconceptions. J Sport Health Sci.',
    });
  }

  if (!equipment.includes('pullup_bar') && !equipment.includes('cables') && !equipment.includes('machines')) {
    warnings.push({
      type: 'equipment',
      level: 'medium',
      title: 'Limited vertical pull options',
      message: 'Pull-ups and lat pulldowns are among the most effective back width exercises. A doorframe pull-up bar (~€20) is one of the best investments you can make for your training.',
      source: null,
    });
  }

  if (!equipment.includes('barbell') && wantsMuscle) {
    warnings.push({
      type: 'equipment',
      level: 'medium',
      title: 'No barbell — limited progressive overload ceiling',
      message: 'A barbell allows the heaviest loading for compound movements (bench press, squat, deadlift, overhead press). Without one, dumbbell and machine alternatives work well but you may hit a load ceiling at intermediate level.',
      source: null,
    });
  }

  // Goal conflicts
  if (wantsEndurance && wantsMuscle) {
    warnings.push({
      type: 'goal_conflict',
      level: 'medium',
      title: 'Endurance and muscle growth partially conflict',
      message: 'Building muscle requires progressive overload with adequate recovery. High-volume endurance training can interfere with muscle protein synthesis. We recommend separating cardio and weight training by at least 6 hours, and prioritizing sleep and protein intake.',
      source: 'Interference effect: concurrent training research (Wilson et al., 2012)',
    });
  }

  if (wantsFat && !wantsMuscle) {
    warnings.push({
      type: 'goal_info',
      level: 'info',
      title: 'Fat loss happens in the kitchen',
      message: 'Resistance training preserves muscle while in a caloric deficit — but fat loss is primarily determined by nutrition. Your training program will be optimized to maintain muscle mass. Track your food intake for best results.',
      source: 'Willis et al. (2012): resistance training preserves lean mass during caloric restriction. J Appl Physiol.',
    });
  }

  // Volume warning
  warnings.push({
    type: 'volume',
    level: 'info',
    title: 'Your weekly volume targets',
    message: 'For optimal hypertrophy, research recommends 10-20 sets per muscle per week. Your program is designed to hit these targets. Track your sets to ensure you stay within the optimal range.',
    source: 'Schoenfeld et al. (2017); Baz-Valle et al. (2022).',
    data: VOLUME_TARGETS,
  });

  return warnings;
}

// ─── SPLIT RANKINGS BY DAYS + GOAL ──────────────────────────────────────────
// Based on PMC12927080 + Schoenfeld et al. (2016) + Pelland et al. (2024)

export const SPLIT_RANKINGS = {
  2: {
    muscle:   [{ id: 'full_body_2x', rank: 1, why: 'Only viable option at 2 days. Full body ensures each muscle hits 2× weekly minimum.' }],
    strength: [{ id: 'full_body_2x', rank: 1, why: 'Heavy compounds twice per week. Full body maximizes frequency on big lifts.' }],
    lose:     [{ id: 'full_body_2x', rank: 1, why: 'Full body sessions burn more calories and preserve muscle during deficit.' }],
    default:  [{ id: 'full_body_2x', rank: 1, why: 'Only viable option at 2 days.' }],
  },
  3: {
    muscle: [
      { id: 'full_body_3x', rank: 1, why: 'Hits each muscle 3× per week. Best frequency for hypertrophy at 3 days.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Full Body + Upper/Lower hybrid. Good alternative if you prefer split feel.' },
    ],
    strength: [
      { id: 'full_body_3x', rank: 1, why: 'Heavy compounds 3× weekly. Practice the main lifts most frequently.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Full Body + Upper/Lower. Allows focused heavy days.' },
    ],
    lose: [
      { id: 'full_body_3x', rank: 1, why: 'Higher caloric expenditure per session. Preserves muscle in deficit.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Good alternative with slightly more focused sessions.' },
    ],
    default: [
      { id: 'full_body_3x', rank: 1, why: 'Best all-around option for 3 days.' },
    ],
  },
  4: {
    muscle: [
      { id: 'upper_lower_4x',             rank: 1, why: 'Research sweet spot. Each muscle 2× per week with adequate volume. More sets per muscle than full body.' },
      { id: 'full_body_4x',               rank: 2, why: 'Higher frequency (4× per muscle) with shorter sessions. Advanced lifters only.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 3, why: 'Classic bro split. Each muscle once directly but high focused volume. Works when volume is equated (Ramos-Campo et al., 2024).' },
    ],
    strength: [
      { id: 'upper_lower_4x',             rank: 1, why: 'Heavy compounds twice per week. Best for strength — practice the main lifts with adequate recovery.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'High per-session volume on each lift. Less frequency but more focus.' },
      { id: 'full_body_4x',               rank: 3, why: 'High frequency but lower per-session volume on each lift.' },
    ],
    lose: [
      { id: 'upper_lower_4x',             rank: 1, why: 'Best muscle retention during deficit. 2× frequency maintains strength on all movements.' },
      { id: 'full_body_4x',               rank: 2, why: 'Higher caloric burn per session. Good for fat loss.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 3, why: 'Focused sessions. Works but lower frequency risks more muscle loss in deficit.' },
    ],
    default: [
      { id: 'upper_lower_4x', rank: 1, why: 'Best all-around 4-day option.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'Classic split alternative.' },
    ],
  },
  5: {
    muscle: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Best balance of volume and frequency. PPL block hits volume, Upper/Lower hits frequency.' },
      { id: 'full_body_5x',     rank: 2, why: 'Advanced lifters only. Very high frequency — requires excellent recovery.' },
      { id: 'ppl_6x',           rank: 3, why: 'PPL once through at 5 days (skip one session). Less optimal than hybrid.' },
    ],
    strength: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Compounds trained twice weekly with high volume. Best strength + size combo.' },
      { id: 'full_body_5x',     rank: 2, why: 'Maximum frequency on big lifts. Advanced only.' },
    ],
    lose: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'High volume preserves muscle in deficit. 5 sessions maximizes weekly expenditure.' },
      { id: 'full_body_5x',     rank: 2, why: 'High frequency, shorter sessions. Good fat loss option.' },
    ],
    default: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Best 5-day option for most lifters.' },
    ],
  },
  6: {
    muscle: [
      { id: 'upper_lower_6x', rank: 1, why: 'Each muscle 3× per week. Maximum practical frequency for hypertrophy.' },
      { id: 'ppl_6x',         rank: 2, why: 'Classic PPL. Each muscle 2× per week. Slightly less frequency than UL but more focused sessions. Programs 18–20.' },
    ],
    strength: [
      { id: 'upper_lower_6x', rank: 1, why: 'Highest frequency on main lifts. 3× weekly practice accelerates strength gains.' },
      { id: 'ppl_6x',         rank: 2, why: 'Good strength option. Focused push/pull sessions.' },
    ],
    lose: [
      { id: 'upper_lower_6x', rank: 1, why: 'Maximum weekly volume preserves muscle in deficit.' },
      { id: 'ppl_6x',         rank: 2, why: 'High volume alternative. Good fat loss option.' },
    ],
    default: [
      { id: 'upper_lower_6x', rank: 1, why: 'Best 6-day option.' },
      { id: 'ppl_6x',         rank: 2, why: 'Classic alternative.' },
    ],
  },
};

// Get goal key from profile goals array
function getGoalKey(goals = []) {
  if (goals.includes('gain') || goals.includes('aesthetics')) return 'muscle';
  if (goals.includes('strength')) return 'strength';
  if (goals.includes('lose')) return 'lose';
  return 'default';
}

// Get ranked splits for a given days + goals combination
export function getRankedSplits(days, goals = []) {
  const clampedDays = Math.min(Math.max(days, 2), 6);
  const goalKey = getGoalKey(goals);
  const rankings = SPLIT_RANKINGS[clampedDays];
  const ranked = rankings[goalKey] || rankings.default || [];

  // Add the full split object to each ranking entry, skip unknown split ids
  return ranked
    .map(r => {
      const split = SPLITS[r.id];
      if (!split) return null;
      return { ...split, rank: r.rank, rank_why: r.why };
    })
    .filter(Boolean);
}

// ─── SPLIT SELECTOR ──────────────────────────────────────────────────────────

export function selectSplit(profile) {
  const days = parseInt(profile.weekly_workouts) || 3;
  const goals = profile.goals || [];

  // If user has manually selected a split, use that
  if (profile.selected_split && SPLITS[profile.selected_split]) {
    return SPLITS[profile.selected_split];
  }

  // Otherwise pick the top ranked split for their days + goals
  const ranked = getRankedSplits(days, goals);
  return ranked[0] || SPLITS.full_body_3x;
}

// ─── EXERCISE BUILDER ────────────────────────────────────────────────────────

function buildExercise(patternKey, equipment, overrides = {}) {
  const pattern = MOVEMENT_PATTERNS[patternKey];
  if (!pattern) return null;

  const availableExercises = getExercisesForEquipment(patternKey, equipment);
  if (availableExercises.length === 0) return null;

  // If a preferred exercise id is specified, try to find it first
  let ex = availableExercises[0];
  if (overrides.prefer) {
    const preferred = availableExercises.find(e => e.id === overrides.prefer);
    if (preferred) ex = preferred;
  }

  // Build substitution list — everything except the chosen exercise
  const subs = availableExercises.filter(e => e.id !== ex.id);

  return {
    name: ex.name,
    pattern: patternKey,
    muscles: pattern.muscles.join(', '),
    category: pattern.label.split(' — ')[1] || pattern.label,
    sets: overrides.sets || ex.sets,
    reps: overrides.reps || ex.reps,
    rest: ex.rest,
    early_rpe: overrides.early_rpe || 7,
    last_rpe: overrides.last_rpe || 9,
    stretch_position: ex.stretch_position,
    research_note: ex.research_note,
    study: ex.study || null,
    cues: ex.cues,
    progression_path: ex.progression_path || null,
    // Substitutions — up to 3, with equipment notes
    sub1: subs[0]?.name || null,
    sub2: subs[1]?.name || null,
    sub3: subs[2]?.name || null,
    sub1_equipment: subs[0]?.equipment?.[0] || null,
    sub2_equipment: subs[1]?.equipment?.[0] || null,
    equipment_required: ex.equipment,
    optional: overrides.optional || false,
  };
}

// ─── GOAL PROFILES ───────────────────────────────────────────────────────────
// Each goal has its own rep ranges, RPE targets, rest periods, and exercise priorities.
// This is what makes the program actually different per goal — not just labels.

export const GOAL_PROFILES = {
  muscle: {
    label: 'Build muscle',
    description: 'Maximise hypertrophy through volume, stretch-position loading, and progressive overload.',
    compoundReps: '6–10',
    isolationReps: '10–15',
    compoundSets: 4,
    isolationSets: 3,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '2–3 min',
    restIsolation: '1–2 min',
    volumeMultiplier: 1.0,
    prioritiseIsolation: true,
    cardioNote: null,
  },
  strength: {
    label: 'Build strength',
    description: 'Maximise 1RM through heavy compound work, CNS adaptation, and lower fatigue accumulation.',
    compoundReps: '3–6',
    isolationReps: '8–12',
    compoundSets: 5,
    isolationSets: 2,
    compoundRPE: 8,
    lastSetRPE: 10,
    restCompound: '3–5 min',
    restIsolation: '2 min',
    volumeMultiplier: 0.85,
    prioritiseIsolation: false,
    cardioNote: null,
  },
  lose: {
    label: 'Lose fat',
    description: 'Preserve muscle and strength during a caloric deficit. Shorter rest, maintained intensity.',
    compoundReps: '6–10',
    isolationReps: '12–15',
    compoundSets: 3,
    isolationSets: 2,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '90 sec',
    restIsolation: '60 sec',
    volumeMultiplier: 0.8,
    prioritiseIsolation: false,
    cardioNote: 'Add 2–3 cardio sessions/week (20–30 min moderate intensity). Keep them separate from lifting if possible.',
  },
  aesthetics: {
    label: 'Aesthetics',
    description: 'Balanced muscle development with emphasis on lagging areas, proportion, and conditioning.',
    compoundReps: '8–12',
    isolationReps: '12–20',
    compoundSets: 4,
    isolationSets: 3,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '2 min',
    restIsolation: '60–90 sec',
    volumeMultiplier: 1.0,
    prioritiseIsolation: true,
    cardioNote: '1–2 low-intensity cardio sessions/week supports conditioning without compromising recovery.',
  },
  endurance: {
    label: 'Improve endurance',
    description: 'Muscular endurance and cardiovascular capacity. High reps, short rest, circuit-friendly.',
    compoundReps: '12–20',
    isolationReps: '15–25',
    compoundSets: 3,
    isolationSets: 2,
    compoundRPE: 6,
    lastSetRPE: 8,
    restCompound: '60 sec',
    restIsolation: '30–45 sec',
    volumeMultiplier: 0.9,
    prioritiseIsolation: false,
    cardioNote: '3–5 cardio sessions/week is the primary driver. Resistance training supports it.',
  },
};

// Milestone thresholds — when these are hit, trigger the goal agenda
export const GOAL_MILESTONES = {
  muscle: [
    { id: 'muscle_8w',  weeks: 8,  label: '8 weeks of muscle building complete', message: "You've run a full hypertrophy block. Time to assess: keep building, shift to strength, or enter a cut?" },
    { id: 'muscle_16w', weeks: 16, label: '16 weeks — long block complete',       message: 'Four months of consistent training. Your body has adapted significantly. Time to set a new goal.' },
  ],
  strength: [
    { id: 'strength_8w',  weeks: 8,  label: '8-week strength block complete',  message: 'A full strength cycle done. Retest your maxes, then decide: continue building strength or shift to hypertrophy?' },
    { id: 'strength_12w', weeks: 12, label: '12-week strength cycle complete', message: "You've run a serious strength programme. Time to reassess your goals and plan the next block." },
  ],
  lose: [
    { id: 'lose_target', type: 'weight', label: 'Target weight reached', message: "You've hit your target weight. Now the real question: maintain, keep cutting, or switch to building muscle?" },
    { id: 'lose_8w',     weeks: 8, label: '8 weeks of cutting complete',    message: 'Extended cuts reduce muscle-building capacity. Time to consider a maintenance phase or reverse diet.' },
  ],
  aesthetics: [
    { id: 'aesthetics_12w', weeks: 12, label: '12-week aesthetics block', message: 'Three months in. Which area needs the most work? Adjust your focus for the next block.' },
  ],
  endurance: [
    { id: 'endurance_8w', weeks: 8, label: '8 weeks of endurance training', message: 'Your base fitness has improved. Ready to add more intensity, shift to muscle building, or keep going?' },
  ],
};

function getGoalProfile(goals = []) {
  if (goals.includes('strength')) return GOAL_PROFILES.strength;
  if (goals.includes('lose')) return GOAL_PROFILES.lose;
  if (goals.includes('aesthetics')) return GOAL_PROFILES.aesthetics;
  if (goals.includes('endurance')) return GOAL_PROFILES.endurance;
  return GOAL_PROFILES.muscle;
}

// ─── PLATEAU RESEARCH ────────────────────────────────────────────────────────
// All plateau detection thresholds, messages, and interventions are grounded
// in peer-reviewed research. Sources cited inline.

export const PLATEAU_RESEARCH = {

  muscle: {
    // Kataoka et al. (2024) Sports Med 54:31–48
    // mTOR phosphorylation dampens after 3 weeks of training despite progressive overload.
    // Myofibrillar synthetic rates drop after just 3 repeated exercise bouts.
    // Strength and hypertrophy plateau separately — treat them independently.
    earlyWarningWeeks: 2,       // flag at 2 weeks no estimated 1RM improvement
    confirmedWeeks: 4,          // confirmed plateau at 4 weeks
    resensitisationDays: 10,    // Kataoka: 10 days detraining restores mTOR responsiveness
    earlyMessage: "Your estimated strength on this lift hasn't improved in 2 weeks. This is common — anabolic signalling naturally adapts to repeated stimulus. A variation in exercise or rep range often restores it.",
    confirmedMessage: "4 weeks without progress on this lift. Research shows that simply adding more weight won't fix this — anabolic signalling becomes refractory with chronic training (Kataoka et al. 2024). The fix is variation, not harder effort.",
    interventions: [
      "Switch to a different exercise hitting the same pattern (e.g. barbell bench → incline dumbbell press)",
      "Change rep range — if you've been doing 6–10, shift to 10–15 for 3–4 weeks",
      "Consider 7–10 days of reduced volume to re-sensitise anabolic signalling",
      "Increase protein per meal — trained individuals rely more on nutrition to sustain growth",
    ],
    science: "Kataoka R, Hammert WB, Yamada Y et al. (2024) Sports Med 54:31–48. Pelland JC et al. (2026) Sports Med 56:481–505.",
  },

  strength: {
    // Coleman et al. (2024) PeerJ PMID:38274324 — deloads negatively affect 1RM short-term
    // Bell et al. (2023) Delphi Consensus — reduce sets not load during strength deload
    // Deloading Practices Survey (2024) PMC10948666 — athletes keep load, reduce effort
    earlyWarningWeeks: 2,
    confirmedWeeks: 3,          // strength plateaus faster — neural adaptation ceiling
    deloadStrategy: 'volume',   // reduce sets 30-50%, KEEP load — Bell consensus
    earlyMessage: "Your 1RM estimate hasn't moved in 2 weeks. Strength plateaus faster than muscle growth because neural adaptation has a ceiling. Changing rep ranges or adding a technique-focus week often breaks through.",
    confirmedMessage: "3 weeks without strength progress. The fix here is NOT a deload — research shows deloads actually reduce 1RM short-term for strength athletes (Coleman et al. 2024). Instead: change the rep range, add a variation, or audit your technique.",
    interventions: [
      "Switch from working at 3–5 reps to a wave loading protocol (e.g. 6/4/2 across sets)",
      "Add pause reps or tempo reps to break through sticking points",
      "Check your sleep and caloric intake — CNS recovery is heavily dependent on both",
      "If deloading, reduce sets by 30–50% but keep the same load (Bell consensus 2023)",
    ],
    science: "Coleman M, Burke R et al. (2024) PeerJ PMID:38274324. Bell L et al. (2023) Sports Med Open. Deloading Practices Survey PMC10948666.",
  },

  lose: {
    // Hall KD (2024) Obesity 32(6):1163–1168 PMID:38644683
    // After 10% body weight loss, TEE drops ~15% — 40% is pure metabolic adaptation
    // Poon et al. (2025) Nutr Rev 83(1):59–71 PMID:38422372 — diet breaks attenuate adaptation
    // Sarwan et al. (2024) StatPearls PMID:35015425 — mechanisms and interventions
    staleWeeks: 2,              // 2 weeks no weight trend change = plateau
    movingAverageDays: 7,       // use 7-day moving average, not daily weight
    earlyMessage: "Your weight hasn't trended down in 2 weeks. This is normal — not a sign to eat less. Your body has reduced its metabolic rate in response to the deficit. Eating less usually makes it worse.",
    confirmedMessage: "Your weight has stalled. Research shows that after significant weight loss, your metabolism adapts by burning ~15% fewer calories — 40% of that is pure biological adaptation, not just less body mass to fuel (Hall 2024). The most evidence-backed fix is a 1-week diet break at maintenance calories.",
    interventions: [
      "1-week diet break at maintenance calories — Poon et al. (2025) showed this attenuates metabolic adaptation better than continuous restriction",
      "Increase resistance training volume slightly — muscle mass is the primary driver of resting metabolism",
      "Increase NEAT (non-exercise activity thermogenesis) — fidgeting, standing, walking all count",
      "Increase dietary protein — higher protein preserves metabolic rate better during a cut",
      "Do NOT simply cut calories further — this accelerates metabolic adaptation and muscle loss",
    ],
    science: "Hall KD (2024) Obesity 32(6):1163–1168. Poon ETC et al. (2025) Nutr Rev 83(1):59–71. Sarwan G et al. (2024) StatPearls PMID:35015425.",
  },

  endurance: {
    // Wang et al. (2024) Eur J Appl Physiol 124(8):2235–2249 PMID:38904772
    // VO2max gains from HIIT become non-significant after 10 weeks of same protocol
    // Wang et al. (2025) BMC Sports Sci Med Rehabil 17:156 — RST strongest efficacy
    // Polarized Training Review (2024) PMC11679080 — 80/20 distribution breaks plateau
    plateauWeeks: 8,            // endurance plateau at ~8–10 weeks of same protocol
    earlyMessage: "Your cardio fitness gains are likely slowing — VO2max improvements from the same training type plateau at 8–10 weeks (Wang et al. 2024). Switching training method, not adding more of the same, is what breaks through.",
    confirmedMessage: "You've been on the same endurance protocol for over 10 weeks. Research shows VO2max adaptations become non-significant after this point with the same stimulus. Time to change the type, not just the volume.",
    interventions: [
      "Switch from moderate continuous cardio (MICT) to HIIT — shown to break VO2max plateau effectively",
      "Try polarized training: 80% of sessions at low intensity, 20% at high intensity — stronger evidence than threshold training (2024 systematic review)",
      "If already doing HIIT, switch to repeated sprint training (RST) — Wang et al. (2025) network meta-analysis: RST has the highest efficacy for VO2max in trained individuals",
      "Add a 1-week lower intensity deload before introducing new stimulus",
    ],
    science: "Wang Z et al. (2024) Eur J Appl Physiol 124(8):2235–2249. Wang J et al. (2025) BMC Sports Sci Med Rehabil 17:156. Polarized Training Review (2024) PMC11679080.",
  },
};

// ─── DELOAD RESEARCH ─────────────────────────────────────────────────────────
// Full research-backed deload system.
//
// Sources:
// Bell, Darragh et al. (2025) Strength & Conditioning Journal DOI:10.1519/SSC.0000000000000910
//   — Most recent practical guide. Every 4–8 weeks preplanned. Volume tiers by recovery need.
//   — Duration 5–7 days standard; longer blocks may need 2–5 days complete cessation first.
//   — Two approaches: preplanned (every N weeks) or autoregulatory (reactive to fatigue signals).
// Bell et al. (2023) Delphi Consensus — Sports Medicine Open PMID:37730925
//   — Expert consensus: reduce volume, keep intensity OR reduce both. Keep exercise selection same.
//   — Accessory exercises can be dropped; main compound lifts stay.
// Rogerson et al. (2024) Sports Medicine Open PMC10948666 — Survey n=246 athletes
//   — Real-world: 6.4 ± 1.7 days, every 5.6 ± 2.3 weeks. Keep frequency, reduce sets + reps.
//   — Load typically decreases in practice; effort reduced by increasing RIR.
// Coleman et al. (2024) PeerJ PMID:38274324 — Schoenfeld lab RCT
//   — Deloads do NOT hurt hypertrophy. Deloads DO hurt 1RM short-term for strength athletes.
// Jacko et al. (2022) Int J Mol Sci PMC9141560
//   — 7 sessions of 3x/week training blunts mTOR signalling. 10 days cessation restores it.
// Ogasawara et al. — Journal of Applied Physiology
//   — Periodic training (6 weeks on / 3 weeks off) = same hypertrophy as continuous, 20-25% fewer sessions.
// Kataoka et al. (2024) Sports Med 54:31–48 — mTOR refractoriness mechanism.
// Poon et al. (2025) Nutr Rev 83(1):59–71 — Diet breaks attenuate metabolic adaptation.
// Bell et al. (2022) Front Sports Act Living — Psychological dimension: burnout, monotony, adherence.

export const DELOAD_RESEARCH = {

  // ── Timing ──────────────────────────────────────────────────────────────────
  preplannedWeeks: 6,         // trigger preplanned deload every 6 weeks (centre of 4–8 range)
  durationDays: 7,            // standard duration (Rogerson 2024: 6.4 ± 1.7 days)
  minSessionsRequired: 12,    // minimum sessions in 6 weeks to confirm consistent training

  // ── Autoregulatory signals (Bell 2025: reactive deloads based on real-time feedback) ──
  // These are checked in addition to the time-based trigger.
  autoregSignals: {
    rpeRisingThreshold: 0.5,  // avg RPE rising >0.5 over last 3 sessions vs prior 3
    consecutiveHighRPE: 3,    // 3+ sessions in a row at RPE 9–10 suggests fatigue
    plateauSessionsThreshold: 3, // 3 sessions with no progress on any compound lift
  },

  // ── Volume reduction by recovery need (Bell 2025) ────────────────────────────
  volumeReductionByNeed: {
    low:      { min: 0.25, max: 0.45, label: 'Low recovery need'      },
    moderate: { min: 0.40, max: 0.60, label: 'Moderate recovery need' },
    high:     { min: 0.60, max: 0.90, label: 'High recovery need'     },
  },

  // ── Per-goal deload structure ─────────────────────────────────────────────────
  byGoal: {

    muscle: {
      label: "Hypertrophy deload",
      recoveryNeed: 'moderate',
      volumeReduction: 0.50,    // 50% sets (centre of moderate bracket)
      keepIntensity: true,      // same load — Bell consensus, Rogerson survey
      keepFrequency: true,      // same sessions per week — Rogerson 2024
      keepExercises: true,      // same exercise selection — Bell 2023
      dropAccessories: true,    // drop isolation/accessory work, keep main lifts
      science: "Jacko et al. (2022): 10 days of reduced stimulus restores mTOR phosphorylation blunted by chronic training. Coleman et al. (2024): deloads have no negative effect on hypertrophy. Bell & Darragh (2025): 40–60% volume reduction for moderate recovery needs.",
      headline: "Deload week",
      message: "You've trained consistently for 6 weeks. A 1-week deload re-sensitises your anabolic signalling — the same muscle-building pathways (mTOR) that blunt with continuous training get restored after 7–10 days of reduced stimulus (Jacko et al. 2022). You will not lose muscle.",
      instructions: [
        "Keep the same exercises — novel movements cause DOMS and defeat the purpose",
        "Keep the same weights on the bar — do not reduce load",
        "Cut your sets in half — if you normally do 4 sets, do 2",
        "Drop all accessory/isolation work for this week",
        "Stop each set at 3–4 reps in reserve — no grinding",
        "Prioritise sleep and protein this week — this is when adaptation consolidates",
      ],
      dietNote: null,
    },

    strength: {
      label: "Technique week",
      recoveryNeed: 'low',
      volumeReduction: 0.40,    // 40% — low-moderate (deloads hurt 1RM, keep it light)
      keepIntensity: true,      // same load (Bell consensus — intensity can stay same)
      keepFrequency: true,
      keepExercises: true,
      dropAccessories: true,
      science: "Coleman et al. (2024) PeerJ: deloads negatively affected 1RM and isometric strength vs continuous training. Bell & Darragh (2025): reduce volume 25–45% for low recovery needs. Keep load lifted the same.",
      headline: "Technique week",
      message: "6 weeks of heavy lifting. Important: research shows full deloads temporarily reduce your 1-rep max (Coleman et al. 2024). Instead of a rest week, this is a technique week — same weights, fewer sets, focused on bar speed and movement quality.",
      instructions: [
        "Keep the same weights — do NOT go lighter",
        "Reduce sets by 40% — 5 sets becomes 3",
        "Focus entirely on bar speed and technique — treat every rep as a skill",
        "Video your main lifts this week to identify weak points",
        "Drop all accessories — main compound lifts only",
        "Come back next week ready to push volume again",
      ],
      dietNote: null,
    },

    lose: {
      label: "Diet break + light week",
      recoveryNeed: 'low',
      volumeReduction: 0.30,    // 30% — lower reduction, need to preserve muscle
      keepIntensity: true,
      keepFrequency: true,
      keepExercises: true,
      dropAccessories: false,   // keep volume moderate to preserve muscle during diet break
      science: "Poon et al. (2025) Nutr Rev: intermittent dieting with break periods attenuates metabolic adaptation better than continuous restriction. Bell & Darragh (2025): 25–45% volume reduction for low recovery needs. Lift to preserve muscle while eating at maintenance.",
      headline: "Diet break week",
      message: "6 weeks of cutting. Your metabolism has adapted — eating at maintenance for 1 week attenuates this adaptation and improves subsequent fat loss (Poon et al. 2025). This is not quitting the diet. It is a planned tool that makes the next cut more effective.",
      instructions: [
        "Eat at maintenance calories this week — not a surplus, not a deficit",
        "Keep protein high — this is the most important week to hit your target",
        "Reduce training sets by 30% — keep the intensity",
        "Keep all your main compound lifts — do not drop them",
        "Use this week to address sleep, stress, and recovery",
        "Return to deficit next week — you will likely find hunger easier to manage",
      ],
      dietNote: "Eat at maintenance (your TDEE) this week. Use your logged average weight to confirm you are not gaining — a 0.3–0.5kg rise is normal water retention, not fat gain.",
    },

    aesthetics: {
      label: "Recovery week",
      recoveryNeed: 'moderate',
      volumeReduction: 0.50,
      keepIntensity: true,
      keepFrequency: true,
      keepExercises: true,
      dropAccessories: true,
      science: "Bell & Darragh (2025): 40–60% volume reduction for moderate recovery needs. Bell et al. (2022): deloads reduce training monotony and protect long-term adherence. Rogerson (2024): 6.4 days average, every 5.6 weeks in practice.",
      headline: "Recovery week",
      message: "6 weeks of training. A recovery week protects joint health, prevents burnout, and maintains long-term adherence — the most underrated benefit of deloading (Bell et al. 2022). You will come back feeling fresh and lifting better.",
      instructions: [
        "Keep the same weights — do not go lighter",
        "Cut sets in half on all main lifts",
        "Drop all isolation work for this week",
        "Focus on pump and mind-muscle connection rather than load",
        "Prioritise mobility work and sleep this week",
      ],
      dietNote: null,
    },

    endurance: {
      label: "Easy week",
      recoveryNeed: 'moderate',
      volumeReduction: 0.40,
      keepIntensity: false,     // endurance: reduce both volume AND intensity (Wang 2024)
      keepFrequency: true,
      keepExercises: true,
      dropAccessories: false,
      science: "Wang et al. (2024) Eur J Appl Physiol: VO2max gains non-significant after 10 weeks same HIIT protocol. Bell & Darragh (2025): 40–60% volume reduction. For endurance, reduce intensity as well as volume before introducing a new training type.",
      headline: "Easy week",
      message: "6 weeks on the same endurance programme. Reduce both volume and intensity this week before switching training method next week — this clears accumulated fatigue so your body can fully respond to the new stimulus.",
      instructions: [
        "Reduce cardio volume by 40% — shorter sessions",
        "Drop intensity to Zone 2 only — no HIIT or high-effort work",
        "Keep resistance training sessions but reduce sets",
        "After this week, switch your training type (e.g. MICT → HIIT) for fresh adaptation",
        "Use this week to plan the next 6-week block",
      ],
      dietNote: null,
    },
  },
};

// ─── PLATEAU DETECTOR ────────────────────────────────────────────────────────
// Takes completed_sets data and profile, returns plateau flags per lift and per goal.
// Called from TodayScreen with the last 30 days of set data.

export function detectPlateaus(sets = [], profile = {}) {
  const goals = profile.goals || [];
  const goalKey = goals.includes('strength') ? 'strength'
    : goals.includes('lose') ? 'lose'
    : goals.includes('endurance') ? 'endurance'
    : 'muscle';

  const research = PLATEAU_RESEARCH[goalKey];
  const plateaus = [];

  // ── Strength / muscle plateau: track estimated 1RM per compound lift ──────
  if (goalKey !== 'lose' && goalKey !== 'endurance') {
    // Epley formula: 1RM ≈ weight × (1 + reps/30)
    const epley = (w, r) => r === 1 ? w : w * (1 + r / 30);

    // Group sets by exercise, sorted by date
    const byExercise = {};
    sets.forEach(s => {
      if (!s.weight_kg || !s.reps || !s.completed_at) return;
      const date = new Date(s.completed_at).toDateString();
      if (!byExercise[s.exercise_name]) byExercise[s.exercise_name] = {};
      const est1rm = epley(s.weight_kg, s.reps);
      if (!byExercise[s.exercise_name][date] || est1rm > byExercise[s.exercise_name][date]) {
        byExercise[s.exercise_name][date] = est1rm;
      }
    });

    // For each exercise, check if estimated 1RM has stalled
    Object.entries(byExercise).forEach(([exercise, dateMap]) => {
      const entries = Object.entries(dateMap)
        .sort(([a], [b]) => new Date(a) - new Date(b));

      if (entries.length < 4) return; // need at least 4 sessions to detect

      const recent = entries.slice(-6); // last 6 sessions
      const peak = Math.max(...recent.map(([, v]) => v));
      const oldest = recent[0][1];
      const newest = recent[recent.length - 1][1];
      const firstDate = new Date(recent[0][0]);
      const lastDate = new Date(recent[recent.length - 1][0]);
      const daysSinceImprovement = Math.floor((new Date() - firstDate) / 86400000);
      const improvement = ((newest - oldest) / oldest) * 100;

      // No meaningful improvement (<2%) over earlyWarning or confirmed period
      const earlyWarningDays = research.earlyWarningWeeks * 7;
      const confirmedDays = (research.confirmedWeeks || 3) * 7;

      if (improvement < 2 && daysSinceImprovement >= confirmedDays) {
        plateaus.push({
          type: 'confirmed',
          goal: goalKey,
          exercise,
          days: daysSinceImprovement,
          est1rm: Math.round(newest),
          message: research.confirmedMessage,
          interventions: research.interventions,
          science: research.science,
        });
      } else if (improvement < 2 && daysSinceImprovement >= earlyWarningDays) {
        plateaus.push({
          type: 'warning',
          goal: goalKey,
          exercise,
          days: daysSinceImprovement,
          est1rm: Math.round(newest),
          message: research.earlyMessage,
          interventions: research.interventions,
          science: research.science,
        });
      }
    });
  }

  return plateaus;
}

// ─── DELOAD DETECTOR ─────────────────────────────────────────────────────────
// Two modes (Bell & Darragh 2025):
//   1. Preplanned — triggers after 6 weeks of consistent training with no natural break
//   2. Autoregulatory — triggers earlier if fatigue signals are present in the log
//
// Returns null if no deload needed, or an object with:
//   { ...deloadConfig, trigger: 'preplanned'|'autoreg', reason: string, weeksTraining: number }

export function detectDeloadNeeded(sessions = [], sets = [], profile = {}) {
  if (sessions.length < 8) return null;

  const goals = profile.goals || [];
  const goalKey = goals.includes('strength') ? 'strength'
    : goals.includes('lose') ? 'lose'
    : goals.includes('endurance') ? 'endurance'
    : goals.includes('aesthetics') ? 'aesthetics'
    : 'muscle';

  const deloadConfig = DELOAD_RESEARCH.byGoal[goalKey];

  // Sort sessions chronologically
  const sorted = [...sessions]
    .filter(s => s.completed_at)
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));

  const now = new Date();
  const sixWeeksAgo = new Date(now - 42 * 86400000);
  const recentSessions = sorted.filter(s => new Date(s.completed_at) >= sixWeeksAgo);

  if (recentSessions.length < 8) return null;

  // ── Check for natural break in the last 6 weeks (>10 days gap = already deloaded) ──
  for (let i = 1; i < recentSessions.length; i++) {
    const gap = (new Date(recentSessions[i].completed_at) - new Date(recentSessions[i - 1].completed_at)) / 86400000;
    if (gap > 10) return null; // had a natural break, no deload needed
  }

  // ── Calculate weeks of unbroken training ─────────────────────────────────
  const oldestRecent = new Date(recentSessions[0].completed_at);
  const weeksTraining = Math.floor((now - oldestRecent) / (7 * 86400000));

  // ── Autoregulatory signals (Bell 2025 — reactive deload approach) ─────────
  // Signal 1: RPE trend — average RPE rising over last 3 sessions vs prior 3
  const setsWithRpe = sets.filter(s => s.rpe && s.completed_at);
  let autoregReason = null;

  if (setsWithRpe.length >= 12) {
    // Group sets by session date to get per-session avg RPE
    const sessionRpe = {};
    setsWithRpe.forEach(s => {
      const date = new Date(s.completed_at).toDateString();
      if (!sessionRpe[date]) sessionRpe[date] = [];
      sessionRpe[date].push(s.rpe);
    });
    const sessionDates = Object.keys(sessionRpe).sort((a, b) => new Date(a) - new Date(b));

    if (sessionDates.length >= 6) {
      const recent3 = sessionDates.slice(-3);
      const prior3 = sessionDates.slice(-6, -3);
      const avgRpe = dates => {
        const allRpes = dates.flatMap(d => sessionRpe[d]);
        return allRpes.reduce((a, b) => a + b, 0) / allRpes.length;
      };
      const recentAvg = avgRpe(recent3);
      const priorAvg = avgRpe(prior3);

      if (recentAvg - priorAvg >= DELOAD_RESEARCH.autoregSignals.rpeRisingThreshold) {
        autoregReason = `Your average RPE has risen ${(recentAvg - priorAvg).toFixed(1)} points over the last 3 sessions — a sign of accumulating fatigue (Bell & Darragh 2025).`;
      }

      // Signal 2: 3+ consecutive sessions at RPE 9–10
      const last3Avgs = recent3.map(d => avgRpe([d]));
      if (last3Avgs.every(r => r >= 9)) {
        autoregReason = "Your last 3 sessions have all averaged RPE 9–10. This level of sustained effort signals accumulated fatigue — time to reduce load before performance drops.";
      }
    }
  }

  // ── Decision ─────────────────────────────────────────────────────────────────
  // Autoregulatory trigger — fire earlier if fatigue signals are present
  if (autoregReason && weeksTraining >= 3) {
    return {
      ...deloadConfig,
      trigger: 'autoreg',
      reason: autoregReason,
      weeksTraining,
    };
  }

  // Preplanned trigger — 6 weeks of consistent training
  if (weeksTraining >= DELOAD_RESEARCH.preplannedWeeks) {
    return {
      ...deloadConfig,
      trigger: 'preplanned',
      reason: `You have trained consistently for ${weeksTraining} weeks without a planned recovery week.`,
      weeksTraining,
    };
  }

  return null;
}

// ─── DELOAD PROGRAM GENERATOR ──────────────────────────────────────────────────
// Takes the current week's program and returns a modified deload version.
// Reduces sets per the goal's volumeReduction, keeps exercises and load.

export function generateDeloadWeek(program, deloadConfig) {
  if (!program || !program.days) return null;

  return {
    ...program,
    isDeload: true,
    deloadLabel: deloadConfig.label,
    days: program.days.map(day => ({
      ...day,
      name: `${day.name} (Deload)`,
      exercises: day.exercises
        .filter(ex => {
          // Drop accessories if config says so
          if (deloadConfig.dropAccessories && ex.optional) return false;
          return true;
        })
        .map(ex => ({
          ...ex,
          // Reduce sets
          sets: Math.max(1, Math.round(ex.sets * (1 - deloadConfig.volumeReduction))),
          // If endurance goal, also reduce intensity signal
          early_rpe: deloadConfig.keepIntensity ? ex.early_rpe : Math.max(5, ex.early_rpe - 2),
          last_rpe: deloadConfig.keepIntensity ? ex.last_rpe : Math.max(6, ex.last_rpe - 2),
          // Add deload note to each exercise
          deload_note: deloadConfig.keepIntensity
            ? "Same weight as normal. Stop 3–4 reps before failure."
            : "Reduce weight by 20%. Easy pace — Zone 2 effort.",
        })),
    })),
  };
}

// ─── PROGRAM BUILDER ─────────────────────────────────────────────────────────

export function generateProgram(profile) {
  const equipment = normalizeEquipment(profile.equipment || []);
  const split = selectSplit(profile);
  const goals = profile.goals || [];
  const gp = getGoalProfile(goals); // full goal profile object

  // Pull rep ranges, sets, RPE from goal profile
  const compoundReps = gp.compoundReps;
  const isolationReps = gp.isolationReps;
  const compoundRPE = gp.compoundRPE;
  const compoundSets = gp.compoundSets;
  const isolationSets = gp.isolationSets;

  // Keep wantsStrength for any legacy references
  const wantsStrength = goals.includes('strength');

  let days = [];

  switch (split.id) {

    case 'full_body_2x': {
      days = [
        {
          id: 'day_a',
          name: 'Full Body A',
          focus: 'Quad + Chest + Back focus',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, early_rpe: compoundRPE }),
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, early_rpe: compoundRPE }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, early_rpe: compoundRPE }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('biceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'day_b',
          name: 'Full Body B',
          focus: 'Hip hinge + Shoulders + Vertical pull focus',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, early_rpe: compoundRPE }),
            buildExercise('back_vertical_pull', equipment, { reps: compoundReps }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets }),
            buildExercise('triceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'full_body_3x': {
      days = [
        {
          id: 'day_a',
          name: 'Full Body A',
          focus: 'Strength focus — lower reps on compounds',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, early_rpe: compoundRPE }),
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, early_rpe: compoundRPE }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'day_b',
          name: 'Full Body B',
          focus: 'Hypertrophy focus — moderate reps',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: '8–12' }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12' }),
            buildExercise('shoulders_vertical_push', equipment, { reps: '8–12' }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('triceps', equipment, { sets: isolationSets }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'day_c',
          name: 'Full Body C',
          focus: 'Volume focus — isolation and weak points',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: '8–12' }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12' }),
            buildExercise('back_horizontal_pull', equipment, { reps: '10–15' }),
            buildExercise('hip_hinge', equipment, { sets: 2, reps: '10–15' }),
            buildExercise('rear_delt', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'upper_lower_4x': {
      days = [
        {
          id: 'upper_a',
          name: 'Upper A — Push + Pull Strength',
          focus: 'Heavy horizontal press and row, OHP, overhead tricep extension',
          exercises: [
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 4 }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            buildExercise('biceps', equipment, { sets: 3, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
          ].filter(Boolean),
        },
        {
          id: 'lower_a',
          name: 'Lower A — Quad Focus',
          focus: 'Heavy squat, leg extension reclined 40°, seated curl, calves',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('hip_hinge', equipment, { reps: '6–10', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, reps: '10–15', prefer: 'seated_leg_curl' }),
            buildExercise('calves', equipment, { sets: 4 }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper_b',
          name: 'Upper B — Hypertrophy + Arms',
          focus: 'Incline press, vertical pull, lower chest, side delts, arms',
          exercises: [
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 4 }),
            buildExercise('chest_isolation', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('chest_lower', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '15–20' }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'incline_y_raise' }),
            buildExercise('upper_traps', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('biceps', equipment, { sets: 3, reps: '10–15', prefer: 'preacher_curl' }),
            buildExercise('triceps', equipment, { sets: 3, reps: '10–15', prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'lower_b',
          name: 'Lower B — Posterior Chain',
          focus: 'RDL, hip thrust, hamstrings, glutes, calves',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('glute_isolation', equipment, { sets: 3, reps: '15–20' }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, reps: '10–15', prefer: 'lying_leg_curl' }),
            buildExercise('calves', equipment, { sets: 4 }),
          ].filter(Boolean),
        },
        {
          id: 'optional_shoulders',
          name: 'Shoulders Day',
          optional: true,
          focus: 'OHP · cable lateral raises · Lu raises · Y raises · rear delts · shrugs — ~45 min',
          tip: 'Add as a 5th session when shoulder volume feels low. Replace a rest day — ideally Saturday.',
          exercises: [
            buildExercise('shoulders_vertical_push', equipment, { reps: '8–12', sets: 4 }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '12–20', prefer: 'cable_lateral_raise' }),
            buildExercise('rear_delt', equipment, { sets: 3, reps: '15–20', prefer: 'reverse_pec_deck' }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '12–15', prefer: 'lu_lateral_raise' }),
            buildExercise('upper_traps', equipment, { sets: 3, reps: '12–15', prefer: 'barbell_shrug' }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'chest_back_shoulders_legs_4x': {
      days = [
        {
          id: 'chest_tri',
          name: 'Chest + Triceps',
          focus: 'Full chest development + tricep isolation',
          exercises: [
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('chest_isolation', equipment, { sets: 3, reps: '12–15' }),
            buildExercise('triceps', equipment, { sets: 4, reps: '10–15' }),
          ].filter(Boolean),
        },
        {
          id: 'back_bi',
          name: 'Back + Biceps',
          focus: 'Lat width + back thickness + bicep volume',
          exercises: [
            buildExercise('back_vertical_pull', equipment, { reps: '6–10', sets: 4 }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 4 }),
            buildExercise('rear_delt', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: 4, reps: '10–15' }),
          ].filter(Boolean),
        },
        {
          id: 'shoulders_abs',
          name: 'Shoulders + Abs',
          focus: 'Full shoulder development + core',
          exercises: [
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '12–20' }),
            buildExercise('rear_delt', equipment, { sets: isolationSets }),
            buildExercise('core', equipment, { sets: 4 }),
          ].filter(Boolean),
        },
        {
          id: 'legs',
          name: 'Legs',
          focus: 'Complete lower body — quads, hamstrings, glutes, calves',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('hip_hinge', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, reps: '10–15' }),
            buildExercise('glute_isolation', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: 4 }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'ul_ppl_hybrid_5x': {
      days = [
        {
          id: 'push',
          name: 'Push — Chest / Shoulders / Triceps',
          focus: 'Heavy chest + OHP, side delts, lower chest, overhead tricep extension',
          exercises: [
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('chest_lower', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '12–20' }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
          ].filter(Boolean),
        },
        {
          id: 'pull',
          name: 'Pull — Back / Biceps',
          focus: 'Vertical + horizontal pulls, rear delts, incline curl + Bayesian curl',
          exercises: [
            buildExercise('back_vertical_pull', equipment, { reps: '6–10', sets: 4 }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'incline_y_raise' }),
            buildExercise('upper_traps', equipment, { sets: 2, reps: '12–15', prefer: 'barbell_shrug' }),
            buildExercise('biceps', equipment, { sets: 3, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            buildExercise('biceps', equipment, { sets: 2, reps: isolationReps, prefer: 'standing_hammer_curl' }),
          ].filter(Boolean),
        },
        {
          id: 'legs',
          name: 'Legs',
          focus: 'Squat, RDL, leg extension reclined, seated curl, calves',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('hip_hinge', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, prefer: 'seated_leg_curl' }),
            buildExercise('calves', equipment, { sets: 4 }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper',
          name: 'Upper — Full Upper Body',
          focus: 'Incline chest, vertical pull, chest isolation, side delts, arms volume',
          exercises: [
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 4 }),
            buildExercise('chest_isolation', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('shoulders_side_delt', equipment, { sets: 3, reps: '15–20' }),
            buildExercise('biceps', equipment, { sets: 3, reps: isolationReps, prefer: 'bayesian_cable_curl' }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps, prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'lower',
          name: 'Lower — Posterior Chain Focus',
          focus: 'Deadlift, hip thrust, hamstrings, glutes, calves',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('glute_isolation', equipment, { sets: 3, reps: '15–20' }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, prefer: 'lying_leg_curl' }),
            buildExercise('calves', equipment, { sets: 4 }),
          ].filter(Boolean),
        },
        {
          id: 'optional_shoulders',
          name: 'Shoulders Day',
          optional: true,
          focus: 'OHP · cable laterals · Lu raise · Y raise · rear delts · shrugs — ~45 min',
          tip: 'Add as a 6th session. Brings side delt to 11 sets/week and rear delt to 9 — hitting the optimal research range.',
          exercises: [
            buildExercise('shoulders_vertical_push', equipment, { reps: '8–12', sets: 4 }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '12–20', prefer: 'cable_lateral_raise' }),
            buildExercise('rear_delt', equipment, { sets: 3, reps: '15–20', prefer: 'reverse_pec_deck' }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '12–15', prefer: 'lu_lateral_raise' }),
            buildExercise('upper_traps', equipment, { sets: 3, reps: '12–15', prefer: 'barbell_shrug' }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'ppl_6x': {
      days = [
        {
          id: 'push_a',
          name: 'Push A — Chest Focus',
          focus: 'Heavy chest, lower chest, side delts, overhead tricep extension',
          exercises: [
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('chest_lower', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('chest_isolation', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
          ].filter(Boolean),
        },
        {
          id: 'pull_a',
          name: 'Pull A — Back Focus',
          focus: 'Heavy vertical + horizontal pull, Y raise, incline curl',
          exercises: [
            buildExercise('back_vertical_pull', equipment, { reps: '5–8', sets: 4 }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'incline_y_raise' }),
            buildExercise('upper_traps', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('biceps', equipment, { sets: 3, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
          ].filter(Boolean),
        },
        {
          id: 'legs_a',
          name: 'Legs A — Quad Focus',
          focus: 'Heavy squat, leg extension reclined, seated curl, calves',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('hip_hinge', equipment, { reps: '8–10', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: 2, prefer: 'seated_leg_curl' }),
            buildExercise('calves', equipment, { sets: 4 }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'push_b',
          name: 'Push B — Shoulder Focus',
          focus: 'OHP, lateral raises, Lu raise, face pull, pushdown',
          exercises: [
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '12–20' }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 2 }),
            buildExercise('triceps', equipment, { sets: 3, reps: '10–15', prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'pull_b',
          name: 'Pull B — Bicep Focus',
          focus: 'Vertical pull volume, face pull, Bayesian curl + hammer curl',
          exercises: [
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 4 }),
            buildExercise('back_horizontal_pull', equipment, { reps: '10–15', sets: 3 }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20', prefer: 'reverse_pec_deck' }),
            buildExercise('biceps', equipment, { sets: 3, reps: '10–15', prefer: 'bayesian_cable_curl' }),
            buildExercise('biceps', equipment, { sets: 2, reps: '10–15', prefer: 'standing_hammer_curl' }),
          ].filter(Boolean),
        },
        {
          id: 'legs_b',
          name: 'Legs B — Posterior Chain Focus',
          focus: 'Deadlift, hip thrust, hamstrings, glutes, calves',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('glute_isolation', equipment, { sets: 3, reps: '15–20' }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, prefer: 'lying_leg_curl' }),
            buildExercise('calves', equipment, { sets: 4 }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'hybrid_3x': {
      days = [
        {
          id: 'full_body',
          name: 'Full Body',
          focus: 'Full body — compounds only, higher intensity',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 2 }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper',
          name: 'Upper Body',
          focus: 'Upper body — chest, back, shoulders, arms',
          exercises: [
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('chest_isolation', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: 3, reps: isolationReps }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps }),
          ].filter(Boolean),
        },
        {
          id: 'lower',
          name: 'Lower Body',
          focus: 'Lower body — quads, hamstrings, glutes, calves',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('hip_hinge', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: isolationSets }),
            buildExercise('glute_isolation', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: 4 }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'full_body_4x': {
      days = [
        {
          id: 'fb_a',
          name: 'Full Body A',
          focus: 'Squat + horizontal push/pull focus',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_b',
          name: 'Full Body B',
          focus: 'Hip hinge + vertical push/pull focus',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            buildExercise('back_vertical_pull', equipment, { reps: '6–10', sets: 3 }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets }),
            buildExercise('triceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_c',
          name: 'Full Body C',
          focus: 'Incline + isolation volume focus',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_horizontal_pull', equipment, { reps: '10–15', sets: 3 }),
            buildExercise('rear_delt', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_d',
          name: 'Full Body D',
          focus: 'Posterior chain + arms volume',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('hamstring_isolation', equipment, { sets: isolationSets }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'upper_lower_6x': {
      days = [
        {
          id: 'upper_a',
          name: 'Upper A — Heavy Push + Pull',
          focus: 'Heavy horizontal press/row, overhead press, overhead tricep extension',
          exercises: [
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 4 }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('rear_delt', equipment, { sets: 2, reps: '15–20' }),
            buildExercise('biceps', equipment, { sets: 2, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            buildExercise('triceps', equipment, { sets: 2, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
          ].filter(Boolean),
        },
        {
          id: 'lower_a',
          name: 'Lower A — Quad Focus',
          focus: 'Heavy squat, leg extension reclined, calves, core',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('hip_hinge', equipment, { reps: '6–10', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: 2, prefer: 'seated_leg_curl' }),
            buildExercise('calves', equipment, { sets: isolationSets }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper_b',
          name: 'Upper B — Hypertrophy Volume',
          focus: 'Incline push, vertical pull, chest isolation, lower chest, pushdowns',
          exercises: [
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 4 }),
            buildExercise('chest_isolation', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('chest_lower', equipment, { sets: 2, reps: '12–15' }),
            buildExercise('biceps', equipment, { sets: 3, reps: isolationReps, prefer: 'bayesian_cable_curl' }),
            buildExercise('triceps', equipment, { sets: 3, reps: isolationReps, prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'lower_b',
          name: 'Lower B — Posterior Chain',
          focus: 'RDL/deadlift, hip thrust, hamstrings, glutes, calves',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('hamstring_isolation', equipment, { sets: 3, reps: '10–15' }),
            buildExercise('glute_isolation', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper_c',
          name: 'Upper C — Shoulders Specialisation',
          focus: 'Overhead press, lateral raises, Y raise, Lu raise, rear delts, traps',
          exercises: [
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 4, early_rpe: compoundRPE }),
            buildExercise('shoulders_side_delt', equipment, { sets: 4, reps: '12–20' }),
            buildExercise('rear_delt', equipment, { sets: 3, reps: '15–20' }),
            buildExercise('upper_traps', equipment, { sets: 3, reps: '12–15' }),
            buildExercise('back_horizontal_pull', equipment, { reps: '10–15', sets: 3 }),
            buildExercise('biceps', equipment, { sets: 2, reps: isolationReps, prefer: 'standing_hammer_curl' }),
            buildExercise('triceps', equipment, { sets: 2, reps: isolationReps, prefer: 'ez_bar_skullcrusher' }),
          ].filter(Boolean),
        },
        {
          id: 'lower_c',
          name: 'Lower C — Full Lower Body',
          focus: 'Complete lower body — quads, hamstrings, glutes, calves',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('hip_hinge', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('quad_isolation', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('hamstring_isolation', equipment, { sets: isolationSets }),
            buildExercise('glute_isolation', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: 4 }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    case 'full_body_5x': {
      days = [
        {
          id: 'fb_a',
          name: 'Full Body A',
          focus: 'Squat + horizontal push/pull',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            buildExercise('chest_horizontal_push', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('back_horizontal_pull', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: isolationSets, reps: isolationReps }),
          ].filter(Boolean),
        },
        {
          id: 'fb_b',
          name: 'Full Body B',
          focus: 'Hip hinge + vertical pull + triceps',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            buildExercise('back_vertical_pull', equipment, { reps: '6–10', sets: 3 }),
            buildExercise('shoulders_vertical_push', equipment, { reps: compoundReps, sets: 3 }),
            buildExercise('triceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('calves', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_c',
          name: 'Full Body C',
          focus: 'Incline + isolation volume',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('chest_incline_push', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_horizontal_pull', equipment, { reps: '10–15', sets: 3 }),
            buildExercise('shoulders_side_delt', equipment, { sets: isolationSets }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_d',
          name: 'Full Body D',
          focus: 'Posterior chain + arms',
          exercises: [
            buildExercise('hip_hinge', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('back_vertical_pull', equipment, { reps: '8–12', sets: 3 }),
            buildExercise('hamstring_isolation', equipment, { sets: isolationSets }),
            buildExercise('biceps', equipment, { sets: isolationSets, reps: isolationReps }),
            buildExercise('triceps', equipment, { sets: isolationSets, reps: isolationReps }),
          ].filter(Boolean),
        },
        {
          id: 'fb_e',
          name: 'Full Body E',
          focus: 'Weak points + isolation',
          exercises: [
            buildExercise('squat_pattern', equipment, { reps: '10–15', sets: 3 }),
            buildExercise('chest_isolation', equipment, { sets: isolationSets }),
            buildExercise('rear_delt', equipment, { sets: isolationSets }),
            buildExercise('glute_isolation', equipment, { sets: isolationSets }),
            buildExercise('calves', equipment, { sets: isolationSets }),
            buildExercise('core', equipment, { sets: isolationSets }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    default:
      days = [];
  }

  return {
    id: split.id,
    name: split.name,
    split,
    days_per_week: split.days,
    level: getLevelFromProfile(profile),
    session_time: split.session_time_est,
    schedule: split.schedule_template,
    rest_between: split.rest_between || [],
    science_basis: split.science_basis,
    honest_note: split.honest_note,
    progression: 'Double progression — add reps within the rep range each session. When you hit the top end on all sets, increase the load and return to the bottom of the range.',
    warnings: generateWarnings(profile, split),
    volume_targets: VOLUME_TARGETS,
    days: days.map((day, i) => ({
      ...day,
      scheduled_day: split.schedule_template[i] || null,
    })),
  };
}

// ─── LEVEL DETECTOR ──────────────────────────────────────────────────────────

function getLevelFromProfile(profile) {
  const days = parseInt(profile.weekly_workouts) || 3;
  if (days <= 3) return 'Beginner';
  if (days <= 4) return 'Beginner–Intermediate';
  return 'Intermediate–Advanced';
}

// ─── WEEKLY VOLUME CHECKER ───────────────────────────────────────────────────
// Check if a generated program hits volume targets

export function checkProgramVolume(program) {
  const volumeByMuscle = {};

  program.days.forEach(day => {
    day.exercises.forEach(ex => {
      const pattern = MOVEMENT_PATTERNS[ex.pattern];
      if (!pattern) return;
      pattern.muscles.forEach(muscle => {
        const key = muscle.toLowerCase();
        volumeByMuscle[key] = (volumeByMuscle[key] || 0) + ex.sets;
      });
    });
  });

  const report = {};
  Object.entries(VOLUME_TARGETS).forEach(([muscle, targets]) => {
    const actual = volumeByMuscle[muscle] || 0;
    report[muscle] = {
      actual,
      min: targets.min,
      optimal_low: targets.optimal_low,
      optimal_high: targets.optimal_high,
      status: actual < targets.min ? 'below_minimum'
        : actual < targets.optimal_low ? 'below_optimal'
        : actual <= targets.optimal_high ? 'optimal'
        : 'above_optimal',
    };
  });

  return report;
}