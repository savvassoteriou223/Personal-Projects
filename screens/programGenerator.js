// Helix Program Generator
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

import { MOVEMENT_PATTERNS, getBestExercise, getExercisesForEquipment, getAllExercisesForPattern, getAlternatives } from './movementLibrary';
import { expandAllConditions } from '../lib/conditionsDb';

// ─── VOLUME TARGETS PER MUSCLE ───────────────────────────────────────────────
// Sets/muscle/week by experience level — hypertrophy focus
// Intersection of: Baz-Valle et al. (2022) PMC8884877 general ranges +
// Schoenfeld et al. (2017) PMID 27433992 dose-response +
// Physique athlete survey data PMC12345604 (upper bound reference)
// Beginner: < 1 year for this goal. Intermediate: 1–3 years. Advanced: 3+ years.

export const VOLUME_TARGETS = {
  chest: {
    beginner:     { min: 6,  optimal_low: 6,  optimal_high: 9  },
    intermediate: { min: 10, optimal_low: 10, optimal_high: 15 },
    advanced:     { min: 12, optimal_low: 14, optimal_high: 20 },
    note: 'Include both flat and incline pressing for upper/lower fibre development',
  },
  back: {
    beginner:     { min: 8,  optimal_low: 8,  optimal_high: 10 },
    intermediate: { min: 10, optimal_low: 10, optimal_high: 20 },
    advanced:     { min: 14, optimal_low: 16, optimal_high: 25 },
    note: 'Include vertical pulls (lat width) and horizontal pulls (back thickness)',
  },
  shoulders: {
    beginner:     { min: 6,  optimal_low: 6,  optimal_high: 10 },
    intermediate: { min: 10, optimal_low: 10, optimal_high: 18 },
    advanced:     { min: 12, optimal_low: 14, optimal_high: 22 },
    note: 'Whole-deltoid total. Track side/rear heads separately (side_delts, rear_delts) — pressing only develops front delts',
  },
  side_delts: {
    beginner:     { min: 4,  optimal_low: 5,  optimal_high: 9  },
    intermediate: { min: 6,  optimal_low: 8,  optimal_high: 16 },
    advanced:     { min: 10, optimal_low: 12, optimal_high: 22 },
    note: 'Direct abduction work (lateral raises) — pressing barely contributes',
  },
  rear_delts: {
    beginner:     { min: 3,  optimal_low: 4,  optimal_high: 8  },
    intermediate: { min: 6,  optimal_low: 6,  optimal_high: 14 },
    advanced:     { min: 8,  optimal_low: 10, optimal_high: 18 },
    note: 'Direct isolation (face pulls, reverse pec deck) — rows add some indirect volume',
  },
  biceps: {
    beginner:     { min: 3,  optimal_low: 3,  optimal_high: 6  },
    intermediate: { min: 6,  optimal_low: 6,  optimal_high: 10 },
    advanced:     { min: 8,  optimal_low: 8,  optimal_high: 14 },
    note: 'Direct isolation sets only — rows and pull-ups add indirect volume on top',
  },
  triceps: {
    beginner:     { min: 3,  optimal_low: 3,  optimal_high: 6  },
    intermediate: { min: 6,  optimal_low: 6,  optimal_high: 10 },
    advanced:     { min: 10, optimal_low: 10, optimal_high: 16 },
    note: 'Direct isolation sets only — all pressing adds indirect volume on top',
  },
  quads: {
    beginner:     { min: 6,  optimal_low: 6,  optimal_high: 10 },
    intermediate: { min: 10, optimal_low: 10, optimal_high: 15 },
    advanced:     { min: 12, optimal_low: 14, optimal_high: 20 },
    note: 'Include knee-dominant squatting and knee-extension isolation',
  },
  hamstrings: {
    beginner:     { min: 5,  optimal_low: 5,  optimal_high: 8  },
    intermediate: { min: 8,  optimal_low: 8,  optimal_high: 12 },
    advanced:     { min: 10, optimal_low: 10, optimal_high: 15 },
    note: 'Hip hinge (RDL, deadlift) primary — leg curl targets short head differently',
  },
  glutes: {
    beginner:     { min: 6,  optimal_low: 6,  optimal_high: 10 },
    intermediate: { min: 8,  optimal_low: 8,  optimal_high: 14 },
    advanced:     { min: 10, optimal_low: 12, optimal_high: 18 },
    note: 'Compounds provide baseline stimulus — hip thrust and RDL are additive',
  },
  calves: {
    beginner:     { min: 4,  optimal_low: 4,  optimal_high: 8  },
    intermediate: { min: 6,  optimal_low: 6,  optimal_high: 12 },
    advanced:     { min: 10, optimal_low: 10, optimal_high: 16 },
    note: 'Full ROM emphasizing the stretch. Type I fibre dominance — tolerates higher frequency',
  },
  abs: {
    beginner:     { min: 3,  optimal_low: 3,  optimal_high: 8  },
    intermediate: { min: 6,  optimal_low: 6,  optimal_high: 10 },
    advanced:     { min: 8,  optimal_low: 8,  optimal_high: 12 },
    note: 'Compounds provide indirect stimulus — direct work builds on this baseline',
  },
};

export function getVolumeTargets(level = 'intermediate') {
  const tier = ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'intermediate';
  const result = {};
  Object.entries(VOLUME_TARGETS).forEach(([muscle, data]) => {
    result[muscle] = { ...data[tier], note: data.note };
  });
  return result;
}

// ─── BLOCK PERIODIZATION ─────────────────────────────────────────────────────
// Block lengths by experience level, grounded in neural adaptation research.
// Del Vecchio et al. (2019) J Neurophysiol 122(6):2538–2548 — neural efficiency
// gains peak in the first 2–4 weeks. Carroll et al. (2002) Clin Neurophysiol
// 113(8):1213–1222 — motor unit recruitment plateaus after ~4 weeks on the same
// movement. Running an exercise past its adaptation window yields diminishing
// stimulus; rotating exercises within the same movement pattern restores novelty.
// Kataoka et al. (2024) Sports Med 54:31–48 — mTOR signalling dampens after 3
// repeated bouts; 10 days of reduced stimulus restores it.

export const BLOCK_PERIODIZATION = {
  beginner: {
    min: 6, max: 8, default: 7,
    rationale: 'Beginners are still building motor patterns. Longer blocks let the movement pattern consolidate fully before rotating. Neural adaptation peaks at week 4 (Del Vecchio 2019); weeks 5–8 reinforce it.',
  },
  intermediate: {
    min: 4, max: 6, default: 5,
    rationale: 'Intermediate lifters adapt faster. A 4–6 week block captures the full hypertrophic window before mTOR signalling dampens. Kataoka et al. (2024): synthesis rates drop after 3 repeated bouts in trained individuals.',
  },
  advanced: {
    min: 3, max: 5, default: 4,
    rationale: 'Advanced lifters exhaust neural efficiency gains quickly. Pelland et al. (2026) Sports Med: mechanical tension accumulation plateaus sooner in highly trained individuals. 3–5 weeks captures the window before accommodation.',
  },
};

// Returns the default block length in weeks for a given experience level.
export function getBlockLength(level = 'intermediate') {
  const config = BLOCK_PERIODIZATION[level] || BLOCK_PERIODIZATION.intermediate;
  return config.default;
}

// Returns true if the current date is past the block's scheduled end date.
export function isBlockComplete(blockStartDate, level = 'intermediate') {
  if (!blockStartDate) return false;
  const start = new Date(blockStartDate);
  const weeksElapsed = (Date.now() - start.getTime()) / (7 * 86400000);
  return weeksElapsed >= getBlockLength(level);
}

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
    honest_note: 'The sweet spot for most lifters. Each muscle trained twice per week with 3 days recovery between sessions. Upper A hits side delts twice — machine and cable — because small muscles need 3× weekly direct work. Upper B adds a second rear delt slot; rear delts are the most undertrained muscle in most programs. Progressive overload is the engine — when you can complete all your sets with ease for 2–3 weeks in a row, it\'s time to add weight or reps. Tracking your lifts is not optional here: without a log you\'ll plateau without realising it.',
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
    optimality: 'suboptimal',
    optimality_score: 5,
    science_basis: 'Each muscle is trained only once per week. Schoenfeld et al. (2016) meta-analysis: 2×/week frequency is superior to 1×/week for hypertrophy when distributing the same volume. A single weekly session per muscle leaves growth on the table versus an upper/lower at the same 4 days.',
    honest_note: 'The classic "bro split". It works, but it is the least optimal 4-day option — every muscle is trained just once per week. Evidence-based coaches (Nippard, Israetel, Helms) rank it below upper/lower for this reason. At 4 days, Upper/Lower trains everything twice and is the better choice for most lifters. Choose this only if you strongly prefer the one-muscle-per-day feel.',
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
    optimality: 'optimal',
    optimality_score: 8,
    science_basis: 'PPLPPL structure with two distinct leg days — every muscle, including quads, hamstrings and calves, is trained twice per week. This is the balanced version of PPL that avoids the single-leg-day frequency problem that makes most 6-day PPL programs suboptimal (Pelland et al. 2024: 2× frequency aids volume distribution).',
    honest_note: 'A genuinely balanced 6-day split — legs are trained twice per week (Legs A and Legs B), not once, so there is no lower-body shortfall. High commitment: 6 days/week demands consistent sleep and nutrition to recover. Excellent for dedicated intermediate-advanced lifters.',
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
    schedule_template: ['Monday', 'Tuesday', 'Wednesday', 'Friday', 'Saturday', 'Sunday'],
    rest_between: [0, 0, 1, 0, 0, 1],
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
  if (raw.includes('machines')) equipment.push('machines', 'smith'); // gyms with machines have a Smith machine
  if (raw.includes('kettlebells')) equipment.push('kettlebells');
  if (raw.includes('resistance bands')) equipment.push('bands');
  if (raw.some(e => e.includes('bodyweight'))) equipment.push('bodyweight');

  // Pull-up bar is only available if the user explicitly selected it, or trains
  // at a gym (a barbell rack / machine area always has a bar). Bodyweight-only
  // users are NOT assumed to own one — otherwise pull-ups get programmed for
  // people who have nothing to hang from. A bodyweight user who does have a bar
  // ticks "Pull-up bar" to get them back.
  const hasPullupBar = raw.some(e => e.includes('pull-up') || e.includes('pullup') || e.includes('pull up'));
  if (hasPullupBar || equipment.includes('barbell') || equipment.includes('machines')) {
    if (!equipment.includes('pullup_bar')) equipment.push('pullup_bar');
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
  const expLevel = profile.trainingExperience || 'beginner';
  warnings.push({
    type: 'volume',
    level: 'info',
    title: 'Your weekly volume targets',
    message: 'Your program is calibrated to your experience level. Volume targets are based on research-backed ranges per muscle group — enough to drive adaptation without exceeding recovery capacity.',
    source: 'Baz-Valle et al. (2022) PMC8884877; Schoenfeld et al. (2017) PMID 27433992.',
    data: getVolumeTargets(expLevel),
  });

  return warnings;
}

// ─── SPLIT RANKINGS BY DAYS + GOAL ──────────────────────────────────────────
// Based on PMC12927080 + Schoenfeld et al. (2016) + Pelland et al. (2024)

export const SPLIT_RANKINGS = {
  2: {
    muscle:    [{ id: 'full_body_2x', rank: 1, why: 'Only viable option at 2 days. Full body ensures each muscle hits 2× weekly minimum.' }],
    strength:  [{ id: 'full_body_2x', rank: 1, why: 'Heavy compounds twice per week. Full body maximizes frequency on big lifts.' }],
    lose:      [{ id: 'full_body_2x', rank: 1, why: 'Full body sessions burn more calories and preserve muscle during deficit.' }],
    endurance: [{ id: 'full_body_2x', rank: 1, why: 'Full body at 2 days. High reps, short rest. Resistance work supports cardio base.' }],
    maintain:  [{ id: 'full_body_2x', rank: 1, why: 'Minimum effective dose for health maintenance. Full body covers all muscle groups.' }],
    default:          [{ id: 'full_body_2x', rank: 1, why: 'Only viable option at 2 days.' }],
    recomp:           [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Small deficit — keep volume up to signal muscle retention while losing fat.' }],
    cut_strength:     [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Prioritise heavy compounds — preserving neuromuscular strength in deficit requires consistent practice.' }],
    cut_endurance:    [{ id: 'full_body_2x', rank: 1, why: 'Full body 2× with short rest. Pair each session with cardio — cardio is the primary fat loss driver here.' }],
    powerbuilding:    [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. At minimum frequency keep the big compounds heavy — powerbuilding needs more days to fully express.' }],
    hybrid_muscle:    [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Your dedicated cardio sessions provide the endurance stimulus — keep lifting heavy.' }],
    hybrid_strength:  [{ id: 'full_body_2x', rank: 1, why: 'Full body 2× with heavy compound emphasis. Cardio sessions handled separately.' }],
    powerbuilding_cut:[{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Deficit limits recovery — heavy compounds first, skip isolation when fatigued.' }],
    athletic_recomp:  [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Near-maintenance calories. Add 2–3 cardio sessions for the athletic component.' }],
    athletic_cut:     [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Strength maintained via heavy compounds. Cardio drives fat loss.' }],
    athletic_bulk:    [{ id: 'full_body_2x', rank: 1, why: 'Full body 2×. Add 2–3 dedicated cardio sessions. Resist cutting lifting volume — it drives the bulk.' }],
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
    endurance: [
      { id: 'full_body_3x', rank: 1, why: 'High-rep full body 3× per week. Short rest periods maximize metabolic stimulus.' },
    ],
    maintain: [
      { id: 'full_body_3x', rank: 1, why: 'Ideal maintenance dose. 3× full body keeps all muscle groups stimulated without excess volume.' },
    ],
    default: [
      { id: 'full_body_3x', rank: 1, why: 'Best all-around option for 3 days.' },
    ],
    recomp: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× — each muscle trained 3× per week. Critical for recomp: maximal muscle retention signal while in slight deficit.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Full Body + Upper/Lower hybrid. Good recomp alternative — maintains high frequency.' },
    ],
    cut_strength: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3×. Compound lifts trained frequently to preserve neuromuscular strength adaptations in deficit.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Hybrid allows dedicated heavy days — useful for maintaining key compound lifts.' },
    ],
    cut_endurance: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× with high-rep, short-rest sets. Pair with dedicated cardio — cardio is the primary driver of fat loss here.' },
    ],
    powerbuilding: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3×. Alternate heavy and volume days — trains big compounds frequently while adding hypertrophy work.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Full Body + Upper/Lower. Heavy full body day + volume upper/lower days — good powerbuilding structure at 3 days.' },
    ],
    hybrid_muscle: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× at moderate rest. Your dedicated cardio sessions provide the endurance stimulus — keep lifting heavy to counter the interference effect.' },
    ],
    hybrid_strength: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× with heavy compound emphasis. Cardio sessions strictly separate — interference is real.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Hybrid allows dedicated heavy compound days — strong structure for the strength-endurance athlete.' },
    ],
    powerbuilding_cut: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3×. In deficit, frequency helps preserve both strength and muscle. Heavy compounds first, volume second.' },
      { id: 'hybrid_3x',    rank: 2, why: 'Hybrid allows heavy and volume days — maintains powerbuilding stimulus at lower total volume in deficit.' },
    ],
    athletic_recomp: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× near maintenance. Add 2–3 cardio sessions. Frequent resistance training is the anchor for athletic recomp.' },
    ],
    athletic_cut: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× in moderate deficit. Cardio and the deficit drive fat loss — lifting preserves strength and athletic capacity.' },
    ],
    athletic_bulk: [
      { id: 'full_body_3x', rank: 1, why: 'Full body 3× with surplus. Add 2–3 dedicated cardio sessions — ensures all muscles grow while athletic capacity improves.' },
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
    endurance: [
      { id: 'upper_lower_4x', rank: 1, why: 'Upper/lower 4× with high reps and short rest. Resistance training at endurance rep ranges maximizes metabolic demand.' },
    ],
    maintain: [
      { id: 'upper_lower_4x', rank: 1, why: 'Upper/lower covers all muscle groups twice per week at low-moderate volume. Sustainable long-term.' },
      { id: 'full_body_4x',   rank: 2, why: 'High frequency, shorter sessions. Good for general fitness maintenance.' },
    ],
    default: [
      { id: 'upper_lower_4x', rank: 1, why: 'Best all-around 4-day option.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'Classic split alternative.' },
    ],
    recomp: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4×. 2× frequency per muscle — the strongest muscle-retention signal available in a slight deficit.' },
      { id: 'full_body_4x',                 rank: 2, why: 'Full body 4×. Higher frequency option for recomp — works well if you prefer shorter sessions.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 3, why: 'Focused sessions with once-weekly direct frequency. Acceptable for recomp when volume is maintained.' },
    ],
    cut_strength: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4×. Heavy compounds twice per week preserves strength in deficit. Research: 2× frequency best for maintaining neuromuscular performance.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'High per-session volume on big lifts. Lower frequency is harder to maintain in deficit but keeps intensity high.' },
    ],
    cut_endurance: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4× with high reps and short rest. Efficient metabolic stimulus — pair with 3–4 cardio sessions.' },
      { id: 'full_body_4x',                 rank: 2, why: 'Full body 4×. Circuit-style training maximises caloric expenditure per session.' },
    ],
    powerbuilding: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4×. Heavy and volume days alternate — the classic powerbuilding structure. Each compound trained 2× per week.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'High per-session volume per movement. Strong strength carry-over despite lower frequency.' },
    ],
    hybrid_muscle: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4× with moderate rest. Keep cardio separate (6+ hours) to minimise interference. 2× frequency maximises muscle stimulus.' },
      { id: 'full_body_4x',                 rank: 2, why: 'Full body 4× — shorter sessions leave more energy for cardio training.' },
    ],
    hybrid_strength: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4×. Heavy compounds 2× per week with cardio kept strictly separate. Builds strength while maintaining conditioning.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'Focused strength sessions per movement. Lower lifting frequency works if cardio is kept well separated.' },
    ],
    powerbuilding_cut: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4× in deficit. 2× frequency minimises muscle loss — heavy compounds first, isolation only if energy allows.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'Focused sessions — acceptable in deficit when total volume is reduced proportionally.' },
    ],
    athletic_recomp: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4× near maintenance with cardio sessions alongside. Balances muscle retention, strength, and athletic conditioning.' },
      { id: 'full_body_4x',                 rank: 2, why: 'Full body 4× — leaves more weekly slots for cardio while hitting every muscle frequently.' },
    ],
    athletic_cut: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4× in deficit. 2× frequency preserves strength. Cardio is the primary fat loss driver — add 3+ sessions per week.' },
      { id: 'full_body_4x',                 rank: 2, why: 'Full body 4× with short rest — higher metabolic stimulus per session, reduces need for separate cardio.' },
    ],
    athletic_bulk: [
      { id: 'upper_lower_4x',               rank: 1, why: 'Upper/lower 4×. Surplus calories power muscle and athletic development. Add 2–3 cardio sessions for the endurance component.' },
      { id: 'chest_back_shoulders_legs_4x', rank: 2, why: 'Focused compound sessions per movement. Add cardio as extra sessions alongside.' },
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
    endurance: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: '5 high-rep sessions per week. Combined with cardio, maximizes metabolic conditioning.' },
    ],
    maintain: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Active lifestyle maintenance at 5 days. Moderate volume keeps fitness without excess fatigue.' },
    ],
    default: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Best 5-day option for most lifters.' },
    ],
    recomp: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Hybrid 5×. High volume maintains the hypertrophy stimulus needed to build muscle even in a slight deficit.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5× — maximum frequency. Effective for recomp if recovery is strong.' },
    ],
    cut_strength: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Hybrid 5×. Compounds trained twice per week preserves neuromuscular strength. Volume reduced in deficit — keep compound intensity high.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5×. High frequency maintains movement patterns in deficit.' },
    ],
    cut_endurance: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'High volume with short rest. Combined with cardio, maximises fat loss while preserving lean mass.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5× — high metabolic demand per session, good option if cardio is separate.' },
    ],
    powerbuilding: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Best powerbuilding option at 5 days. Upper/lower heavy days + PPL volume days. Compounds 2× per week with dedicated volume work.' },
      { id: 'full_body_5x',     rank: 2, why: 'Very high frequency on all lifts — advanced lifters only.' },
    ],
    hybrid_muscle: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Hybrid 5× for muscle. Moderate rest periods (90 sec – 2 min). Cardio kept strictly separate to minimise interference.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5×. Shorter sessions leave more capacity for cardio.' },
    ],
    hybrid_strength: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Compounds trained twice per week with volume work. Cardio sessions kept strictly separate (6+ hours) to prevent acute strength losses.' },
      { id: 'full_body_5x',     rank: 2, why: 'Maximum lifting frequency — effective for the strength-endurance athlete with excellent recovery capacity.' },
    ],
    powerbuilding_cut: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Hybrid 5× at reduced volume in deficit. Prioritise heavy compound sessions — drop accessory work first when fatigue accumulates.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5×. High frequency supports strength maintenance in deficit — adjust volume per energy levels daily.' },
    ],
    athletic_recomp: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Hybrid 5× near maintenance. Ideal for athletic recomp — high frequency supports muscle gain and metabolic adaptation simultaneously.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5× — maximises weekly muscle stimulus. Athletic conditioning added on top.' },
    ],
    athletic_cut: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'High volume in moderate deficit. Heavy compounds preserved — cardio and deficit drive fat loss, lifting preserves everything else.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5×. Shorter sessions allow more athletic conditioning sessions alongside lifting.' },
    ],
    athletic_bulk: [
      { id: 'ul_ppl_hybrid_5x', rank: 1, why: 'Best option for concurrent training bulk. Compounds 2× per week with surplus calories. Dedicated cardio sessions — manage interference carefully.' },
      { id: 'full_body_5x',     rank: 2, why: 'Full body 5× with surplus. High frequency — effective for advanced athletes combining strength and endurance development.' },
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
    endurance: [
      { id: 'upper_lower_6x', rank: 1, why: '6-day high-rep programme. Maximum conditioning stimulus alongside dedicated cardio.' },
    ],
    maintain: [
      { id: 'upper_lower_6x', rank: 1, why: 'Active daily training at moderate volume. Upper/lower 6× is sustainable for health-focused lifters.' },
    ],
    default: [
      { id: 'upper_lower_6x', rank: 1, why: 'Best 6-day option.' },
      { id: 'ppl_6x',         rank: 2, why: 'Classic alternative.' },
    ],
    recomp: [
      { id: 'upper_lower_6x', rank: 1, why: 'Maximum frequency for recomp. 3× per muscle per week — strongest possible muscle retention signal in a slight deficit.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL 6×. 2× frequency with high per-session volume — strong recomp option.' },
    ],
    cut_strength: [
      { id: 'upper_lower_6x', rank: 1, why: 'Highest lifting frequency. 3× weekly practice on main compounds maintains neuromuscular strength despite caloric deficit.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL in deficit. Focused sessions allow high intensity per lift — lower frequency but high per-session load.' },
    ],
    cut_endurance: [
      { id: 'upper_lower_6x', rank: 1, why: '6-day high-rep resistance programme. Maximum weekly volume preserves muscle in deficit. Add cardio as active recovery sessions.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL 6× with endurance rep ranges. Focused metabolic sessions alongside dedicated cardio.' },
    ],
    powerbuilding: [
      { id: 'upper_lower_6x', rank: 1, why: 'Each muscle 3× per week. Alternates heavy and volume days — the most complete powerbuilding structure available.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL 6×. Each muscle 2× per week with high volume per session. Strong powerbuilding alternative.' },
    ],
    hybrid_muscle: [
      { id: 'upper_lower_6x', rank: 1, why: 'Maximum muscle frequency. Cardio as active recovery or in separate sessions (6+ hours apart). Highest concurrent training stimulus.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL 6× with moderate rest periods. Good muscle-endurance concurrent structure.' },
    ],
    hybrid_strength: [
      { id: 'upper_lower_6x', rank: 1, why: 'Highest lifting frequency for strength. Cardio strictly separate. 3× per compound per week maximises strength adaptation.' },
      { id: 'ppl_6x',         rank: 2, why: 'Focused heavy push/pull/legs. Strength-biased with room for conditioning on off-lifting days.' },
    ],
    powerbuilding_cut: [
      { id: 'upper_lower_6x', rank: 1, why: '3× frequency preserves both strength and muscle in deficit. Drop isolation volume first when recovery suffers — keep compounds heavy.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL in deficit. Volume reduced vs a bulk — intensity maintained on compound movements.' },
    ],
    athletic_recomp: [
      { id: 'upper_lower_6x', rank: 1, why: 'Maximum resistance frequency near maintenance. Athletic conditioning fits alongside or as active recovery. Best overall stimulus for all three adaptations.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL 6× with conditioning added on top. High volume per muscle — demanding but highly effective.' },
    ],
    athletic_cut: [
      { id: 'upper_lower_6x', rank: 1, why: 'Maximum frequency preserves strength in deficit. Cardio added as conditioning work — total load is very high, monitor recovery closely.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL in deficit. Focused sessions reduce per-session fatigue — more sustainable alongside frequent cardio.' },
    ],
    athletic_bulk: [
      { id: 'upper_lower_6x', rank: 1, why: 'Each muscle 3× per week with surplus calories. Cardio develops athletic capacity alongside maximum hypertrophy stimulus.' },
      { id: 'ppl_6x',         rank: 2, why: 'PPL 6× with surplus. Focused muscle groups per session — pairs well with endurance training on the same days.' },
    ],
  },
};

// Resolve any combination of goals to a single canonical combo key.
// This is the single source of truth used by split selection, goal profiles,
// and calorie calculation — so all three systems stay consistent.
export function resolveGoalCombo(goals = []) {
  const hasFat      = goals.includes('lose');
  const hasMuscle   = goals.includes('gain') || goals.includes('aesthetics');
  const hasStrength = goals.includes('strength');
  const hasEnd      = goals.includes('endurance');

  // 4-way (all active → athletic recomp near maintenance)
  if (hasFat && hasMuscle && hasStrength && hasEnd) return 'athletic_recomp';

  // Triple combos
  if (hasFat  && hasMuscle   && hasStrength) return 'powerbuilding_cut';
  if (hasFat  && hasMuscle   && hasEnd)      return 'athletic_recomp';
  if (hasFat  && hasStrength && hasEnd)      return 'athletic_cut';
  if (hasMuscle && hasStrength && hasEnd)    return 'athletic_bulk';

  // Dual combos
  if (hasFat  && hasMuscle)    return 'recomp';
  if (hasFat  && hasStrength)  return 'cut_strength';
  if (hasFat  && hasEnd)       return 'cut_endurance';
  if (hasMuscle && hasStrength) return 'powerbuilding';
  if (hasMuscle && hasEnd)     return 'hybrid_muscle';
  if (hasStrength && hasEnd)   return 'hybrid_strength';

  // Single goals
  if (hasFat)      return 'cut';
  if (hasMuscle)   return 'muscle';
  if (hasStrength) return 'strength';
  if (hasEnd)      return 'endurance';
  return 'maintain';
}

// Calorie and protein targets per combo key.
// multiplier applied to TDEE estimate (weight_kg * 24).
// proteinPerKg is grams of protein per kg bodyweight.
export const GOAL_COMBO_CALORIES = {
  cut:               { multiplier: 0.80, proteinPerKg: 2.2 }, // -20% deficit, high protein to preserve muscle
  muscle:            { multiplier: 1.15, proteinPerKg: 2.0 }, // +15% surplus
  strength:          { multiplier: 1.10, proteinPerKg: 1.8 }, // +10% surplus
  endurance:         { multiplier: 1.00, proteinPerKg: 1.6 }, // maintenance
  maintain:          { multiplier: 1.00, proteinPerKg: 1.6 }, // maintenance
  recomp:            { multiplier: 0.95, proteinPerKg: 2.4 }, // -5% deficit, highest protein (muscle building in deficit)
  cut_strength:      { multiplier: 0.88, proteinPerKg: 2.2 }, // -12% deficit, strength preserved via high protein
  cut_endurance:     { multiplier: 0.85, proteinPerKg: 2.0 }, // -15% deficit, cardio drives fat loss
  powerbuilding:     { multiplier: 1.12, proteinPerKg: 2.0 }, // +12% surplus for strength + size
  hybrid_muscle:     { multiplier: 1.08, proteinPerKg: 2.0 }, // +8% (interference effect reduces efficiency)
  hybrid_strength:   { multiplier: 1.05, proteinPerKg: 1.8 }, // +5% small surplus, strength focus
  powerbuilding_cut: { multiplier: 0.90, proteinPerKg: 2.2 }, // -10% deficit, strength first
  athletic_recomp:   { multiplier: 0.97, proteinPerKg: 2.4 }, // -3% (near maintenance), all qualities
  athletic_cut:      { multiplier: 0.88, proteinPerKg: 2.0 }, // -12% deficit, athletic performance preserved
  athletic_bulk:     { multiplier: 1.08, proteinPerKg: 2.0 }, // +8% surplus, concurrent training
};

// ─── TDEE + NUTRITION TARGETS ─────────────────────────────────────────────────
// Mifflin-St Jeor BMR × activity multiplier (O'Neill 2023, Sports Med)
// More accurate than weight × 24 — accounts for height, age, sex, activity level
export function calculateTDEE(weight_kg, height_cm, age, sex, weekly_workouts) {
  if (!weight_kg || !height_cm || !age) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const sexOffset = sex === 'female' ? -161 : sex === 'male' ? 5 : -78; // other = midpoint
  const bmr = base + sexOffset;
  const activityMultiplier =
    weekly_workouts <= 1 ? 1.2 :
    weekly_workouts <= 2 ? 1.375 :
    weekly_workouts <= 4 ? 1.55 :
    weekly_workouts <= 6 ? 1.725 : 1.9;
  return Math.round(bmr * activityMultiplier);
}

// Nutrition targets from TDEE + focus (Ruiz-Castellano 2021; Helms 2023; Morton 2018)
// Returns base targets + training/rest day split (carbs ±40g, calories ±160 kcal)
export function calculateNutritionTargets(tdee, weight_kg, nutrition_focus = 'maintain') {
  if (!tdee || !weight_kg) return null;
  const configs = {
    cut:      { offset: -400, proteinPerKg: 2.2 },  // 0.5% BW/week loss; high protein to preserve muscle
    bulk:     { offset: +250, proteinPerKg: 1.8 },  // ~5% surplus; surplus spares protein (Morton 2018)
    maintain: { offset: 0,    proteinPerKg: 1.8 },
    recomp:   { offset: -200, proteinPerKg: 2.4 },  // slight deficit; highest protein for simultaneous recomp
  };
  const { offset, proteinPerKg } = configs[nutrition_focus] || configs.maintain;
  const calories = Math.max(1200, tdee + offset);
  const protein = Math.round(weight_kg * proteinPerKg);
  const fat = Math.max(Math.round(weight_kg * 0.5), Math.round(calories * 0.2 / 9)); // min 0.5g/kg or 20% kcal
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  // Training day: +40g carbs (+160 kcal). Rest day: -40g carbs (-160 kcal).
  // Protein and fat stay constant — only carbs shift for glycogen/recovery.
  const carbShift = 40;
  const calShift = carbShift * 4;

  return {
    caloric_target: calories,
    protein_target: protein,
    fat_target: fat,
    carb_target: carbs,
    training_caloric_target: calories + calShift,
    training_carb_target: carbs + carbShift,
    rest_caloric_target: Math.max(1200, calories - calShift),
    rest_carb_target: Math.max(0, carbs - carbShift),
  };
}

// ─── INJURY PROFILE → CONDITIONS ──────────────────────────────────────────────
// Users pick a body part + how it feels, instead of needing a clinical diagnosis.
// This maps that to the condition strings CONTRAINDICATION_MAP already understands.
//
// Severity tiers (resolved per-session):
//   'good'  → no restrictions (cleared for full training today)
//   'usual' → soft conditions only (modify / warn)
//   'flare' → hard + soft conditions (unsafe lifts get substituted)
export const INJURY_BODY_PARTS = [
  { key: 'back',      label: 'Lower back' },
  { key: 'knees',     label: 'Knees' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'hips',      label: 'Hips' },
  { key: 'elbows',    label: 'Elbows / wrists' },
];

const BODY_PART_CONDITIONS = {
  back:      { usual: ['lower_back_disc_herniation'], flare: ['lower_back_disc_herniation', 'spondylolisthesis'] },
  knees:     { usual: ['patellofemoral_syndrome'],    flare: ['severe_knee_osteoarthritis', 'patellofemoral_syndrome'] },
  shoulders: { usual: ['shoulder_impingement'],       flare: ['shoulder_impingement', 'rotator_cuff_tear'] },
  hips:      { usual: ['hip_labral_tear'],            flare: ['hip_labral_tear'] },
  elbows:    { usual: ['elbow_tendinopathy'],         flare: ['lateral_epicondylitis', 'medial_epicondylitis', 'elbow_tendinopathy'] },
};

// injuryProfile: [{ body_part, severity: 'always'|'sometimes' }]
// todayOverrides: { [body_part]: 'good'|'usual'|'flare' } — from the pre-workout check-in
// Returns clinical condition strings to feed applyContraindicationFilters.
export function getConditionsFromInjuryProfile(injuryProfile = [], todayOverrides = {}) {
  const conditions = new Set();
  for (const entry of injuryProfile) {
    const map = BODY_PART_CONDITIONS[entry.body_part];
    if (!map) continue;
    // Today's check-in answer wins. Otherwise: 'always' → usual baseline, 'sometimes' → nothing.
    let tier = todayOverrides[entry.body_part];
    if (!tier) tier = entry.severity === 'always' ? 'usual' : null;
    if (!tier || tier === 'good') continue;
    (tier === 'flare' ? map.flare : map.usual).forEach(c => conditions.add(c));
  }
  return [...conditions];
}

// Apply contraindication filtering to a single workout (one day), not a full program.
// Used at workout start once the pre-workout check-in has resolved today's conditions.
export function applyContraindicationsToWorkout(workout, conditions = [], equipment = []) {
  if (!conditions.length || !workout?.exercises) return workout;
  const filtered = applyContraindicationFilters(
    { days: [workout] },
    { health_conditions: conditions, equipment }
  );
  return filtered.days[0];
}

function getGoalKey(goals = []) {
  return resolveGoalCombo(goals);
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
// Block-aware: exercises are selected based on blockIndex.
// Block 0 → first primary_alternative: true exercise for the pattern.
// Block 1+ → cycles through rotation alternatives (primary_alternative: false),
//   wrapping around when exhausted.
// An explicit `prefer` override always wins regardless of block.

function buildExercise(patternKey, equipment, overrides = {}) {
  const pattern = MOVEMENT_PATTERNS[patternKey];
  if (!pattern) return null;

  // getAllExercisesForPattern: primary_alternative: true exercises first, then rotation pool
  const allExercises = getAllExercisesForPattern
    ? getAllExercisesForPattern(patternKey, equipment)
    : getExercisesForEquipment(patternKey, equipment);

  if (!allExercises || allExercises.length === 0) return null;

  const blockIndex = overrides.blockIndex || 0;

  // Beginners: keep technically demanding lifts (front squat, deficit Pendlay
  // row, Nordic curl) out of automatic selection and block rotation — they stay
  // available as manual swaps.
  let pool = allExercises;
  if (overrides.level === 'beginner') {
    const accessible = allExercises.filter(e => e.difficulty !== 'advanced');
    // If the ONLY options for this pattern+equipment are advanced (e.g. hamstring
    // isolation with a barbell only → just the Nordic curl), drop the slot rather
    // than force an advanced lift on a beginner. Every split day filters out null
    // slots, and the day's compounds still cover the muscle.
    if (accessible.length === 0) return null;
    pool = accessible;
  }

  // Skip/swap learning: exercises the user has repeatedly skipped are treated as
  // disliked and dropped from automatic selection — unless that would empty the
  // pattern, in which case we keep them (programming something beats nothing).
  if (overrides.excludeIds?.length) {
    const liked = pool.filter(e => !overrides.excludeIds.includes(e.id));
    if (liked.length > 0) pool = liked;
  }

  let ex;
  if (overrides.prefer) {
    // Explicit preference wins — UNLESS the difficulty gate excluded it. Splits
    // that prefer 'conventional_deadlift' (advanced) would otherwise force it on
    // beginners, bypassing the safety gate; fall back to the best gated option
    // (e.g. Romanian deadlift) in that case.
    const preferred = allExercises.find(e => e.id === overrides.prefer);
    ex = (preferred && pool.includes(preferred)) ? preferred : pool[0];
  } else {
    // Split pool into primary (anchor for block 0) and rotation alternatives
    const primaries  = pool.filter(e => e.primary_alternative !== false);
    const rotations  = pool.filter(e => e.primary_alternative === false);

    if (blockIndex === 0 || rotations.length === 0) {
      ex = primaries[0] || pool[0];
    } else {
      // Cycle through rotation alternatives; wrap around after exhausting the list
      const rotIdx = (blockIndex - 1) % rotations.length;
      ex = rotations[rotIdx] || primaries[0] || pool[0];
    }
  }

  // Top 3 alternatives for in-session substitutions (same difficulty gate)
  const subs = pool.filter(e => e.id !== ex.id).slice(0, 3);

  return {
    id: ex.id,
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
    load_position: ex.load_position || null,
    research_note: ex.research_note,
    study: ex.study || null,
    cues: ex.cues,
    progression_path: ex.progression_path || null,
    sub1: subs[0]?.name || null,
    sub2: subs[1]?.name || null,
    sub3: subs[2]?.name || null,
    sub1_id: subs[0]?.id || null,
    sub2_id: subs[1]?.id || null,
    sub3_id: subs[2]?.id || null,
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
  maintain: {
    label: 'Stay healthy',
    description: 'Maintain muscle, joint health, and general fitness. Moderate load, compound focus, sustainable.',
    compoundReps: '10–15',
    isolationReps: '12–15',
    compoundSets: 3,
    isolationSets: 2,
    compoundRPE: 6,
    lastSetRPE: 8,
    restCompound: '90 sec',
    restIsolation: '60 sec',
    volumeMultiplier: 0.75,
    prioritiseIsolation: false,
    cardioNote: '2–3 moderate cardio sessions/week supports cardiovascular health alongside lifting.',
  },

  // ── Combination goal profiles ──────────────────────────────────────────────
  recomp: {
    label: 'Body recomposition',
    description: 'Build muscle and lose fat simultaneously in a slight deficit with very high protein. Slower than a dedicated bulk or cut — but progress moves in both directions at once.',
    compoundReps: '6–12',
    isolationReps: '10–15',
    compoundSets: 3,
    isolationSets: 3,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '2 min',
    restIsolation: '90 sec',
    volumeMultiplier: 0.9,
    prioritiseIsolation: true,
    cardioNote: '1–2 cardio sessions/week. Keep intensity moderate — high-intensity cardio in a deficit increases muscle loss risk.',
  },
  cut_strength: {
    label: 'Strength-focused cut',
    description: 'Preserve hard-earned strength while dropping body fat. Heavier loads, fewer sets — intensity stays high, total volume reduces.',
    compoundReps: '4–8',
    isolationReps: '8–12',
    compoundSets: 4,
    isolationSets: 2,
    compoundRPE: 8,
    lastSetRPE: 10,
    restCompound: '2–3 min',
    restIsolation: '90 sec',
    volumeMultiplier: 0.80,
    prioritiseIsolation: false,
    cardioNote: '2–3 cardio sessions/week. Separate from lifting by at least 6 hours to protect strength performance.',
  },
  cut_endurance: {
    label: 'Endurance cut',
    description: 'Lose fat while improving cardiovascular capacity. High-rep resistance work complements dedicated cardio as the primary fat loss driver.',
    compoundReps: '12–20',
    isolationReps: '15–25',
    compoundSets: 3,
    isolationSets: 2,
    compoundRPE: 6,
    lastSetRPE: 8,
    restCompound: '45–60 sec',
    restIsolation: '30–45 sec',
    volumeMultiplier: 0.85,
    prioritiseIsolation: false,
    cardioNote: '4–5 cardio sessions/week is the primary driver. Resistance training preserves muscle during the deficit.',
  },
  powerbuilding: {
    label: 'Powerbuilding',
    description: 'Maximise strength on the big lifts while building significant muscle mass. Heavy compound work paired with higher-rep accessory work.',
    compoundReps: '3–8',
    isolationReps: '8–15',
    compoundSets: 5,
    isolationSets: 3,
    compoundRPE: 8,
    lastSetRPE: 9,
    restCompound: '3–4 min',
    restIsolation: '90 sec–2 min',
    volumeMultiplier: 1.05,
    prioritiseIsolation: true,
    cardioNote: '1–2 low-intensity cardio sessions/week (GPP). Avoid high-intensity cardio — it compromises recovery for heavy compound work.',
  },
  hybrid_muscle: {
    label: 'Muscle + endurance',
    description: 'Build muscle while maintaining or improving cardiovascular fitness. Interference effect is real — manage it with session timing, adequate sleep, and high protein.',
    compoundReps: '8–15',
    isolationReps: '10–20',
    compoundSets: 3,
    isolationSets: 3,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '90 sec–2 min',
    restIsolation: '60–90 sec',
    volumeMultiplier: 0.95,
    prioritiseIsolation: true,
    cardioNote: '2–3 cardio sessions/week. Separate lifting and cardio by 6+ hours. Prioritise sleep and protein to offset the interference effect (Wilson et al., 2012).',
  },
  hybrid_strength: {
    label: 'Strength + endurance',
    description: 'Build maximal strength while maintaining cardiovascular fitness. Heavy compounds prioritised — cardio kept separate to minimise interference on strength output.',
    compoundReps: '4–8',
    isolationReps: '8–12',
    compoundSets: 4,
    isolationSets: 2,
    compoundRPE: 8,
    lastSetRPE: 10,
    restCompound: '2–4 min',
    restIsolation: '90 sec',
    volumeMultiplier: 0.85,
    prioritiseIsolation: false,
    cardioNote: '2–3 cardio sessions/week strictly separate from lifting (6+ hours). High-intensity cardio on the same day as heavy lifting acutely reduces strength output.',
  },
  powerbuilding_cut: {
    label: 'Powerbuilding cut',
    description: 'Drop body fat while maintaining strength and muscle mass. Compounds stay heavy — isolation volume is the first thing to reduce when deficit fatigue accumulates.',
    compoundReps: '4–8',
    isolationReps: '8–12',
    compoundSets: 4,
    isolationSets: 2,
    compoundRPE: 8,
    lastSetRPE: 10,
    restCompound: '2–3 min',
    restIsolation: '90 sec',
    volumeMultiplier: 0.85,
    prioritiseIsolation: false,
    cardioNote: '2–3 cardio sessions/week at low-to-moderate intensity. High-intensity cardio combined with heavy lifting in a deficit accelerates overtraining.',
  },
  athletic_recomp: {
    label: 'Athletic recomposition',
    description: 'Lose fat, build muscle, and improve athleticism near maintenance calories. The slowest path — but all qualities develop in parallel. Demands excellent nutrition and sleep.',
    compoundReps: '8–15',
    isolationReps: '10–15',
    compoundSets: 3,
    isolationSets: 2,
    compoundRPE: 7,
    lastSetRPE: 8,
    restCompound: '90 sec',
    restIsolation: '60 sec',
    volumeMultiplier: 0.9,
    prioritiseIsolation: false,
    cardioNote: '3–4 conditioning sessions/week. Prioritise sleep, high protein, and session quality over quantity — this is a complex concurrent training goal.',
  },
  athletic_cut: {
    label: 'Athletic cut',
    description: 'Lose fat while maintaining strength and athletic performance. Moderate deficit, heavy compounds, frequent cardio — the deficit and cardio drive fat loss, lifting preserves the rest.',
    compoundReps: '5–10',
    isolationReps: '10–15',
    compoundSets: 3,
    isolationSets: 2,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '2 min',
    restIsolation: '60–90 sec',
    volumeMultiplier: 0.82,
    prioritiseIsolation: false,
    cardioNote: '3–4 cardio sessions/week. Alternate high and low intensity to balance fat loss with athletic performance retention.',
  },
  athletic_bulk: {
    label: 'Athletic bulk',
    description: 'Build muscle and strength while improving cardiovascular fitness. Slight surplus supports all three adaptations — gains are slower than a pure bulk but you maintain athletic capacity throughout.',
    compoundReps: '6–12',
    isolationReps: '10–15',
    compoundSets: 4,
    isolationSets: 3,
    compoundRPE: 7,
    lastSetRPE: 9,
    restCompound: '2–3 min',
    restIsolation: '90 sec',
    volumeMultiplier: 0.95,
    prioritiseIsolation: true,
    cardioNote: '2–3 cardio sessions/week. Keep them aerobic-dominant — high-intensity cardio competes with resistance training recovery and limits the surplus benefit.',
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
  const combo = resolveGoalCombo(goals);
  return GOAL_PROFILES[combo] || GOAL_PROFILES.muscle;
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

// ─── PROACTIVE COACH PROMPT ──────────────────────────────────────────────────
// A pocket personal trainer reaches out instead of waiting to be asked. Given
// the signals already computed on the home screen, pick the single most
// important thing the coach should raise today (or null if all is well).
// Returns { key, title, body, ask } — `ask` is the question to pre-fill the
// coach with when the user taps the nudge.
export function getProactiveCoachPrompt({
  daysSinceLastSession = null,
  weeklyWorkoutsTarget = 3,
  deload = null,
  plateaus = [],
  recoveryLabel = null,
} = {}) {
  // 1. Recovery comes first — training hard on a low-recovery day is the most
  //    time-sensitive call.
  if (recoveryLabel === 'Low') {
    return {
      key: 'recovery',
      title: 'Recovery is low today',
      body: 'Your sleep and recovery signals suggest you’re under-recovered. Consider lighter loads or a rest day.',
      ask: 'My recovery is low today — should I still train, and if so how should I adjust?',
    };
  }
  // 2. Deload due — accumulated fatigue over weeks.
  if (deload) {
    return {
      key: 'deload',
      title: 'You’re due a deload',
      body: deload.reason || 'You’ve trained hard for several weeks without a break. A deload week will let you grow into the work.',
      ask: 'Should I take a deload this week, and how should I structure it?',
    };
  }
  // 3. A lift has stalled.
  if (plateaus && plateaus.length > 0) {
    const name = plateaus[0].exercise || plateaus[0].exercise_name || plateaus[0].name || 'a lift';
    return {
      key: 'plateau',
      title: `${name} has stalled`,
      body: 'No progress here for a few weeks. Worth changing the stimulus or checking recovery.',
      ask: `${name} has stalled for weeks — how should I break through the plateau?`,
    };
  }
  // 4. Missed sessions — only nudge once the gap clearly exceeds their cadence.
  if (typeof daysSinceLastSession === 'number') {
    const expectedGap = Math.max(2, Math.ceil(7 / Math.max(1, weeklyWorkoutsTarget)));
    if (daysSinceLastSession >= expectedGap + 3) {
      return {
        key: 'missed',
        title: 'Let’s get back to it',
        body: `It’s been ${daysSinceLastSession} days since your last session. Want to adjust this week’s plan to ease back in?`,
        ask: `I haven’t trained in ${daysSinceLastSession} days — how should I restart without overdoing it?`,
      };
    }
  }
  return null;
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

// ─── PROGRESSIVE OVERLOAD SYSTEM ────────────────────────────────────────────
// Double-progression model: reps ceiling first, then weight.
// This is the single most important structural driver of long-term hypertrophy.
//
// Van Every, Nippard & Phillips (2025) J Sport Health Sci: mechanical tension
// via progressive resistance increase is the primary hypertrophic mechanism.
// Morton et al. (2016) J Appl Physiol 121(1):129–138: all rep ranges work when
// taken close to failure AND when load progresses consistently over time.

export const PROGRESSIVE_OVERLOAD = {
  model: 'double_progression',
  description: 'Add reps each session until every set hits the top of the rep range. Then increase load by the smallest available increment and return to the bottom of the range.',
  // Per rep-range: rep ceiling and recommended load increment on weight jump
  repRanges: {
    '3–6':   { ceiling: 6,  barbell: 5,    dumbbell: 2.5 },
    '5–8':   { ceiling: 8,  barbell: 2.5,  dumbbell: 2   },
    '6–10':  { ceiling: 10, barbell: 2.5,  dumbbell: 2   },
    '8–12':  { ceiling: 12, barbell: 2.5,  dumbbell: 2   },
    '10–15': { ceiling: 15, barbell: 2.5,  dumbbell: 2   },
    '12–15': { ceiling: 15, barbell: 2.5,  dumbbell: 2   },
    '12–20': { ceiling: 20, barbell: 1.25, dumbbell: 1   },
    '15–20': { ceiling: 20, barbell: 1.25, dumbbell: 1   },
  },
  stallThreshold: 3,    // sessions at same weight+reps before calling a stall
  plateauThreshold: 6,  // sessions of no progress before confirmed plateau
};

// Evaluate progression status for an exercise from its set history.
// sets: [{ exercise_name, weight_kg, reps, completed_at }]
// repRange: string like '8–12' (matches PROGRESSIVE_OVERLOAD.repRanges keys)
// Returns: { status, note, lastWeight, lastReps, increment_kg? }
export function checkReadyToProgress(sets = [], exerciseName, repRange) {
  const exerciseSets = (sets || [])
    .filter(s => s.exercise_name === exerciseName && s.weight_kg && s.reps && s.completed_at)
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

  if (exerciseSets.length < 3) {
    return { status: 'insufficient_data', note: 'Need at least 3 logged sets to assess progression.' };
  }

  // Most recent session
  const lastDate = new Date(exerciseSets[0].completed_at).toDateString();
  const lastSessionSets = exerciseSets.filter(s => new Date(s.completed_at).toDateString() === lastDate);
  const lastWeight = lastSessionSets[0]?.weight_kg;
  const lastReps = lastSessionSets.map(s => s.reps);
  const avgReps = lastReps.reduce((a, b) => a + b, 0) / lastReps.length;

  // Parse ceiling from repRange
  const rangeConfig = repRange ? PROGRESSIVE_OVERLOAD.repRanges[repRange] : null;
  // parseInt yields NaN (not null) on bad input, so `?? 12` never fired.
  // Accept both en-dash and hyphen rep ranges.
  const parsedCeiling = parseInt(repRange?.split(/[–-]/)?.[1], 10);
  const ceiling = rangeConfig?.ceiling ?? (Number.isNaN(parsedCeiling) ? 12 : parsedCeiling);
  const defaultIncrement = rangeConfig?.barbell ?? 2.5;

  const allHitCeiling = lastReps.every(r => r >= ceiling);

  // Stall detection: same weight and avg reps across last N sessions
  const byDate = {};
  exerciseSets.forEach(s => {
    const d = new Date(s.completed_at).toDateString();
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  });
  const recentDates = Object.keys(byDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .slice(0, PROGRESSIVE_OVERLOAD.stallThreshold);

  const sessionWeights = recentDates.map(d => byDate[d][0]?.weight_kg);
  const sessionAvgReps = recentDates.map(d => {
    const r = byDate[d].map(s => s.reps);
    return r.reduce((a, b) => a + b, 0) / r.length;
  });
  const isStalled =
    recentDates.length >= PROGRESSIVE_OVERLOAD.stallThreshold &&
    sessionWeights.every(w => w === sessionWeights[0]) &&
    sessionAvgReps.every(r => Math.abs(r - sessionAvgReps[0]) < 0.5);

  // Adaptive increment: rather than a flat 2.5 kg for everyone, learn this user's
  // own demonstrated jump on THIS lift from history (median of their positive
  // weight steps). Cold-start falls back to an exercise-type default — isolation
  // and small-muscle work micro-loads, compounds jump bigger.
  const chronWeights = Object.keys(byDate)
    .sort((a, b) => new Date(a) - new Date(b))
    .map(d => byDate[d][0]?.weight_kg)
    .filter(w => typeof w === 'number');
  const positiveSteps = [];
  for (let i = 1; i < chronWeights.length; i++) {
    const step = +(chronWeights[i] - chronWeights[i - 1]).toFixed(2);
    if (step > 0) positiveSteps.push(step);
  }
  let increment;
  if (positiveSteps.length >= 2) {
    positiveSteps.sort((a, b) => a - b);
    increment = positiveSteps[Math.floor(positiveSteps.length / 2)]; // their typical jump
  } else {
    const resolved = resolveExerciseByName(exerciseName);
    const ISOLATION = new Set(['biceps', 'triceps', 'shoulders_side_delt', 'rear_delt', 'upper_traps', 'forearms', 'core']);
    increment = (resolved && ISOLATION.has(resolved.patternKey)) ? 1.25 : defaultIncrement;
  }

  if (allHitCeiling) {
    return {
      status: 'increase_weight',
      lastWeight,
      lastReps: avgReps,
      increment_kg: increment,
      note: `All sets hit ${ceiling} reps at ${lastWeight} kg — add ${increment} kg next session and return to the bottom of the rep range.`,
    };
  }

  if (isStalled) {
    return {
      status: 'stalled',
      lastWeight,
      lastReps: avgReps,
      note: `Same weight and reps for ${PROGRESSIVE_OVERLOAD.stallThreshold} sessions. Consider a technique check, a brief volume drop, or an exercise rotation.`,
    };
  }

  return {
    status: 'add_reps',
    lastWeight,
    lastReps: avgReps,
    note: `${avgReps.toFixed(1)} reps avg at ${lastWeight} kg last session. Add reps until every set hits ${ceiling}, then increase load.`,
  };
}

// ─── ROTATION TRIGGER SYSTEM ─────────────────────────────────────────────────
// Three triggers in priority order:
//   1. Block boundary — block length elapsed for the user's experience level
//   2. Progressive overload plateau — stall confirmed across N sessions
//   3. Implicit skip / swap pattern — user consistently avoids an exercise
//
// Carroll et al. (2002): motor unit recruitment adaptation plateaus at ~4 weeks.
// Kataoka et al. (2024): mTOR refractoriness after 3 repeated bouts.
// Rotation keeps mechanical tension novel without changing the movement pattern.

export const ROTATION_CONFIG = {
  skipPatternThreshold: 3,     // 3+ skips of the same exercise = implicit swap signal
  stallSessionsForSwap: 3,     // stall detected → rotation candidate
  minBlockWeeksBeforeSwap: 2,  // never trigger plateau-swap in first 2 weeks of a block
};

// Determine what rotation trigger (if any) applies to a given exercise.
// exerciseName: string
// sets: completed set history
// sessions: [{ completed_at, exercises: [{ name, skipped: bool }] }]
// blockStartDate: ISO date string of current block start
// level: 'beginner' | 'intermediate' | 'advanced'
// Returns: { trigger: 'none'|'block_end'|'plateau'|'skip_pattern', reason, priority }
export function detectRotationTrigger(exerciseName, sets = [], sessions = [], blockStartDate = null, level = 'intermediate') {
  const candidates = [];

  // ── Trigger 1: Block end ────────────────────────────────────────────────────
  if (blockStartDate && isBlockComplete(blockStartDate, level)) {
    candidates.push({
      trigger: 'block_end',
      priority: 1,
      reason: `Block complete (${getBlockLength(level)} weeks). Rotating to a fresh stimulus — motor unit recruitment to this movement pattern has plateaued (Carroll et al. 2002).`,
    });
  }

  // ── Trigger 2: Plateau on progressive overload ──────────────────────────────
  const progress = checkReadyToProgress(sets, exerciseName, null);
  if (progress.status === 'stalled') {
    const weeksInBlock = blockStartDate
      ? (Date.now() - new Date(blockStartDate).getTime()) / (7 * 86400000)
      : 999;
    if (weeksInBlock >= ROTATION_CONFIG.minBlockWeeksBeforeSwap) {
      candidates.push({
        trigger: 'plateau',
        priority: 2,
        reason: progress.note,
      });
    }
  }

  // ── Trigger 3: Implicit skip / swap pattern ─────────────────────────────────
  let skipCount = 0;
  sessions.forEach(session => {
    const ex = (session.exercises || []).find(e => e.name === exerciseName);
    if (ex?.skipped) skipCount++;
  });
  if (skipCount >= ROTATION_CONFIG.skipPatternThreshold) {
    candidates.push({
      trigger: 'skip_pattern',
      priority: 3,
      reason: `Exercise skipped ${skipCount} times recently — implicit signal that it isn't working for this client.`,
    });
  }

  if (candidates.length === 0) return { trigger: 'none' };
  return candidates.sort((a, b) => a.priority - b.priority)[0];
}

// Return the next exercise to rotate to within the same movement pattern.
// Cycles through all available exercises; skips the current one.
// blockIndex is used to prevent cycling back to the same rotation exercise immediately.
export function getNextRotationExercise(patternKey, currentExerciseId, equipment, blockIndex = 0) {
  const all = getAllExercisesForPattern
    ? getAllExercisesForPattern(patternKey, equipment)
    : getExercisesForEquipment(patternKey, equipment);

  if (!all || all.length <= 1) return null;

  const currentIdx = all.findIndex(e => e.id === currentExerciseId);
  if (currentIdx === -1) return all[0];

  // Step forward, wrap around
  const nextIdx = (currentIdx + 1) % all.length;
  return all[nextIdx];
}

// ─── CONTRAINDICATION FILTERS ─────────────────────────────────────────────────
// Hard filters: exercise is unsafe — replace with a safe substitute from PATTERN_SUBSTITUTES.
// Soft filters: exercise is risky — keep but flag with a warning note.
//
// Conditions vocabulary (matches profile.health_conditions values):
//   shoulder_impingement, ac_joint_injury, rotator_cuff_tear, pec_tear
//   shoulder_instability, bicep_tendinopathy
//   cervical_disc_herniation, scoliosis, sciatica
//   lateral_epicondylitis, medial_epicondylitis, elbow_tendinopathy
//   lower_back_disc_herniation, spondylolisthesis
//   bilateral_hip_replacement, hip_labral_tear, inguinal_hernia
//   knee_replacement, severe_knee_osteoarthritis, patellofemoral_syndrome
//   proximal_hamstring_tendinopathy, achilles_tendinopathy, plantar_fasciitis
//   carpal_tunnel_syndrome, wrist_injury
//   osteoporosis

export const CONTRAINDICATION_MAP = {
  chest_horizontal_push: [
    { conditions: ['shoulder_impingement', 'ac_joint_injury', 'shoulder_instability'], hard: true, reason: 'Horizontal pressing loads the AC joint and anterior capsule. Replaced with chest isolation (fly) which keeps the shoulder in a safer position.' },
    { conditions: ['pec_tear'], hard: true, reason: 'Horizontal pressing is contraindicated with pec tear history until fully cleared by a physio.' },
    { conditions: ['wrist_injury', 'carpal_tunnel_syndrome'], hard: false, reason: 'Pressing with a fixed grip stresses the wrist. Use a neutral or cambered grip, reduce load, and stop if wrist pain develops.' },
  ],
  chest_incline_push: [
    { conditions: ['shoulder_impingement', 'ac_joint_injury'], hard: false, reason: 'Incline pressing is more impingement-prone than flat pressing. Reduce load, avoid locking out overhead, and stop if sharp pain occurs.' },
    { conditions: ['rotator_cuff_tear'], hard: true, reason: 'Incline pressing places the rotator cuff under load at a vulnerable angle. Replaced with safer chest isolation work.' },
  ],
  chest_decline: [
    { conditions: ['shoulder_impingement', 'ac_joint_injury', 'pec_tear'], hard: true, reason: 'Dips and decline pressing load the pec tendon and anterior capsule at the bottom position. Replaced with isolation work.' },
  ],
  chest_isolation: [
    { conditions: ['pec_tear'], hard: false, reason: 'Fly movements stretch the pec under load — use a reduced range of motion and stop well before any stretch-induced pain.' },
  ],
  triceps: [
    { conditions: ['lateral_epicondylitis', 'elbow_tendinopathy'], hard: false, reason: 'Tricep extensions (especially overhead) stress the lateral elbow. Prefer pushdowns with light bands at a limited range. Avoid dips.' },
    { conditions: ['shoulder_impingement', 'ac_joint_injury'], hard: false, reason: 'Dips and behind-head extensions load the shoulder in a compromised position. Use cable pushdowns or machine extensions only.' },
  ],
  shoulders_vertical_push: [
    { conditions: ['shoulder_impingement', 'rotator_cuff_tear', 'ac_joint_injury', 'shoulder_instability'], hard: true, reason: 'Overhead pressing is contraindicated with shoulder pathology. Replaced with lateral raises which train the delts without overhead loading.' },
    { conditions: ['cervical_disc_herniation'], hard: false, reason: 'Overhead pressing creates axial spinal load that can aggravate cervical discs. Use a seated, supported, or landmine press variation.' },
    { conditions: ['scoliosis'], hard: false, reason: 'Heavy overhead pressing creates axial spinal load on an asymmetric spine. Use seated dumbbell press or landmine press to reduce compressive forces.' },
    { conditions: ['osteoporosis'], hard: false, reason: 'Heavy overhead pressing with osteoporosis increases vertebral fracture risk under axial load. Use lighter loads with controlled technique and avoid loaded behind-the-neck movements.' },
    { conditions: ['wrist_injury', 'carpal_tunnel_syndrome'], hard: false, reason: 'Use a neutral grip (dumbbells or landmine) and reduce pressing load to limit wrist extension stress.' },
  ],
  back_vertical_pull: [
    { conditions: ['shoulder_impingement', 'ac_joint_injury'], hard: false, reason: 'Lat pulldowns involve internal rotation under load — use a wide neutral grip and avoid behind-the-neck variations. Switch to rows if pain persists.' },
    { conditions: ['bicep_tendinopathy'], hard: false, reason: 'Heavy pulling loads the long head of the bicep. Use a machine pulldown with a neutral grip and reduce range if pain occurs at the top stretch.' },
  ],
  back_horizontal_pull: [
    { conditions: ['lower_back_disc_herniation', 'spondylolisthesis'], hard: false, reason: 'Bent-over rows require significant lumbar stability under load. Use a chest-supported row, seated cable row, or machine row instead — these eliminate spinal shear.' },
    { conditions: ['scoliosis', 'sciatica'], hard: false, reason: 'Bent-over rows create asymmetric lumbar loading. Use chest-supported or seated cable rows to remove spinal shear.' },
  ],
  back_inner: [
    { conditions: ['shoulder_impingement', 'ac_joint_injury', 'shoulder_instability'], hard: false, reason: 'Wide-grip rows with flared elbows place the shoulder in a vulnerable position at end-range. Reduce load and range of motion, or substitute a neutral-grip chest-supported row.' },
    { conditions: ['lateral_epicondylitis', 'elbow_tendinopathy'], hard: false, reason: 'Wide overhand grip rows stress the lateral elbow. Use a neutral grip and reduce load.' },
    { conditions: ['wrist_injury', 'carpal_tunnel_syndrome'], hard: false, reason: 'Overhand grip rows stress the wrist in extension. Switch to a neutral grip handle.' },
  ],
  squat_pattern: [
    { conditions: ['knee_replacement', 'severe_knee_osteoarthritis'], hard: true, reason: 'Deep squat loading is contraindicated. Replaced with hip hinge work (deadlifts, RDLs) which keeps knee angle shallow.' },
    { conditions: ['patellofemoral_syndrome'], hard: false, reason: 'Deep squats compress the patellofemoral joint. Limit depth to pain-free range, avoid front-loaded squats, and prefer hip-hinge-dominant movements.' },
    { conditions: ['lower_back_disc_herniation'], hard: false, reason: 'High-bar back squat increases lumbar compressive load. Prefer goblet squat, trap bar, or leg press at moderate depth.' },
    { conditions: ['scoliosis'], hard: false, reason: 'Barbell back squat creates asymmetric axial compression on a curved spine. Prefer goblet squat, safety bar, or leg press to distribute load more evenly.' },
    { conditions: ['hip_labral_tear'], hard: false, reason: 'Deep squat may impinge the labrum at full hip flexion. Limit depth to pain-free range and avoid excessive forward lean.' },
    { conditions: ['inguinal_hernia'], hard: false, reason: 'Heavy squats create significant intra-abdominal pressure. Use moderate loads, avoid the Valsalva maneuver, and consult your surgeon before heavy loading.' },
  ],
  quad_isolation: [
    { conditions: ['knee_replacement', 'severe_knee_osteoarthritis', 'patellofemoral_syndrome'], hard: true, reason: 'Leg extensions load the patellofemoral joint directly and are contraindicated with knee pathology. Slot removed — additional hip hinge volume added instead.' },
  ],
  hip_hinge: [
    { conditions: ['lower_back_disc_herniation', 'spondylolisthesis'], hard: false, reason: 'Conventional deadlift maximises lumbar shear forces. Prefer trap bar deadlift, Romanian DL from blocks, or 45° back extension. Avoid conventional pulling from the floor.' },
    { conditions: ['bilateral_hip_replacement'], hard: true, reason: 'Deep hip hinge loading is contraindicated. Slot removed — consult your physio for a hip-safe alternative.' },
    { conditions: ['scoliosis', 'sciatica'], hard: false, reason: 'Conventional deadlift creates significant asymmetric spinal load. Prefer trap bar deadlift or Romanian DL which maintains a more neutral spine.' },
    { conditions: ['inguinal_hernia'], hard: false, reason: 'Heavy deadlifts create significant intra-abdominal pressure (Valsalva). Use lighter loads with controlled breathing and avoid breath-holding under load.' },
    { conditions: ['hip_labral_tear'], hard: false, reason: 'Deep hip hinge may provoke labral symptoms. Limit range of motion, avoid butt-wink, and stop if clicking or sharp pain occurs.' },
  ],
  hamstring_isolation: [
    { conditions: ['proximal_hamstring_tendinopathy'], hard: false, reason: 'High hip-flexion loaded stretches (Nordic curl, lying leg curl at full ROM) aggravate proximal hamstring tendons. Use standing leg curl, keep hip angle neutral, and avoid end-range stretch.' },
  ],
  glute_focused: [
    { conditions: ['bilateral_hip_replacement'], hard: false, reason: 'Hip thrusts and glute bridges load the hip in a position that may stress a hip replacement. Use machine abductions and clamshells — consult your physio.' },
    { conditions: ['hip_labral_tear'], hard: false, reason: 'Hip thrust end-range extension may provoke labral symptoms. Monitor for clicking or groin pain; reduce range of motion if needed.' },
  ],
  upper_traps: [
    { conditions: ['cervical_disc_herniation'], hard: false, reason: 'Heavy shrugs create axial cervical loading. Keep weight moderate and avoid sudden high-speed movements.' },
  ],
  biceps: [
    { conditions: ['medial_epicondylitis', 'elbow_tendinopathy'], hard: false, reason: 'Supinated curls aggravate the medial elbow. Use a neutral hammer grip exclusively and reduce load until pain-free.' },
    { conditions: ['bicep_tendinopathy'], hard: false, reason: 'Loading the bicep at full stretch (incline or Bayesian curl) stresses the long head tendon. Prefer preacher or concentration curls at a shortened position.' },
  ],
  calves: [
    { conditions: ['achilles_tendinopathy'], hard: false, reason: 'Calf raises load the Achilles tendon. Avoid the deep stretch at the bottom during acute phase. Build eccentrically (slow lowering only). Consult a physio before returning to full range.' },
    { conditions: ['plantar_fasciitis'], hard: false, reason: 'Calf raises load the plantar fascia via the windlass mechanism. Avoid deep heel drop, keep range of motion pain-free, and prefer seated over standing variations during the acute phase.' },
  ],
  forearms: [
    { conditions: ['carpal_tunnel_syndrome', 'wrist_injury'], hard: false, reason: 'Wrist curls and extensions stress the carpal tunnel. Use neutral-grip variations and keep wrist in a neutral position. Stop if tingling or numbness develops.' },
    { conditions: ['lateral_epicondylitis'], hard: false, reason: 'Wrist extension exercises aggravate lateral epicondylitis (tennis elbow). Avoid wrist extension under load. Focus on eccentric flexion only.' },
  ],
};

// When a pattern is hard-blocked, substitute with this pattern if available.
// null = no substitute — remove the exercise slot entirely.
const PATTERN_SUBSTITUTES = {
  chest_horizontal_push: 'chest_isolation',       // bench blocked → fly (shoulder-safe)
  chest_incline_push: null,                        // no safe sub for upper chest with shoulder issues
  chest_decline: 'chest_isolation',               // dips blocked → fly
  shoulders_vertical_push: 'shoulders_side_delt', // OHP blocked → lateral raises
  squat_pattern: 'hip_hinge',                     // knee squat blocked → deadlift/RDL
  quad_isolation: null,                           // knee isolation blocked → skip
  hip_hinge: null,                                // back blocked → skip (nothing safe enough)
  back_vertical_pull: 'back_horizontal_pull',     // lat pulldown blocked → row
};

// Build a minimal exercise object from a pattern + raw exercise, matching the
// structure expected by WorkoutExecutionScreen. Used for contraindication substitutes.
function buildSubstituteExercise(patternKey, rawEx, originalSets, originalRpe) {
  const pattern = MOVEMENT_PATTERNS[patternKey];
  if (!pattern || !rawEx) return null;
  return {
    id: rawEx.id,
    name: rawEx.name,
    pattern: patternKey,
    muscles: pattern.muscles.join(', '),
    category: pattern.label.split(' — ')[1] || pattern.label,
    sets: originalSets || rawEx.sets,
    reps: rawEx.reps,
    rest: rawEx.rest,
    early_rpe: originalRpe?.early || 7,
    last_rpe: originalRpe?.last || 9,
    stretch_position: rawEx.stretch_position,
    load_position: rawEx.load_position || null,
    research_note: rawEx.research_note,
    cues: rawEx.cues,
    progression_path: rawEx.progression_path || null,
    sub1: null, sub2: null, sub3: null,
    sub1_id: null, sub2_id: null, sub3_id: null,
    sub1_equipment: null, sub2_equipment: null,
    equipment_required: rawEx.equipment,
    optional: false,
    contraindication_substitute: true,
  };
}

// Filter a program's exercises based on the user's health conditions.
// Hard-blocked exercises are replaced with safe substitutes where possible.
// Soft-blocked exercises are kept and flagged with a warning note.
// profile.health_conditions: string[] — e.g. ['shoulder_impingement', 'knee_replacement']

export function applyContraindicationFilters(program, profile) {
  const raw = profile.health_conditions || [];
  if (raw.length === 0) return program;
  const conditions = expandAllConditions(raw);

  const equipment = normalizeEquipment(profile.equipment || []);

  const days = program.days.map(day => {
    // Day-level awareness: a substitute must not duplicate an exercise or a
    // movement pattern already programmed on this day — two slots resolving to
    // the same pattern means double volume for one subregion and a hole where
    // the blocked subregion was. Better to drop the slot than unbalance the day.
    const dayPatterns = new Set((day.exercises || []).map(e => e?.pattern));
    const usedIds = new Set((day.exercises || []).map(e => e?.id));

    const exercises = (day.exercises || [])
      .map(ex => {
        const rules = CONTRAINDICATION_MAP[ex.pattern] || [];
        const matched = rules.filter(r => r.conditions.some(c => conditions.includes(c)));
        if (matched.length === 0) return ex;

        const hardBlock = matched.find(r => r.hard);
        if (hardBlock) {
          // Try to find a safe substitute in a related pattern — but only if
          // that pattern isn't already trained on this day
          const subPatternKey = PATTERN_SUBSTITUTES[ex.pattern];
          if (subPatternKey && !dayPatterns.has(subPatternKey)) {
            const subRules = CONTRAINDICATION_MAP[subPatternKey] || [];
            const subBlocked = subRules.some(r => r.hard && r.conditions.some(c => conditions.includes(c)));
            if (!subBlocked) {
              const candidates = getAllExercisesForPattern(subPatternKey, equipment)
                .filter(e => !usedIds.has(e.id));
              const best = candidates.find(e => e.primary_alternative) || candidates[0];
              if (best) {
                usedIds.add(best.id);
                dayPatterns.add(subPatternKey);
                return buildSubstituteExercise(subPatternKey, best, ex.sets, { early: ex.early_rpe, last: ex.last_rpe });
              }
            }
          }
          return null; // no substitute available — remove slot
        }

        // Soft block — keep but flag with the reason
        const softNote = matched.map(r => r.reason).join(' ');
        return { ...ex, contraindication_note: softNote, contraindication_level: 'soft' };
      })
      .filter(Boolean);

    // Safety net: this filter runs at display time (TodayScreen), after the
    // generator's own dedup pass — re-check for duplicates it may introduce
    return { ...day, exercises: deduplicateDayExercises(exercises, equipment, profile.trainingExperience || 'beginner') };
  });

  return { ...program, days };
}

// ─── AI COACH ACTION TYPES ───────────────────────────────────────────────────
// Two distinct action types with separate DB write semantics:
//
//   1. Permanent template edit — modifies the stored program template.
//      Written to: program_template_overrides table.
//      Persists across all future sessions until changed again.
//      Triggered by: "I hate this exercise", "I can't do X", "add Y every week".
//
//   2. Session-level swap — one-off replacement for the current session only.
//      Written to: session_exercise_overrides table (session_id scoped).
//      Does not affect future sessions.
//      Triggered by: "swap this today", "something different this session".

// Preview a permanent edit locally before writing to the DB.
// edit: {
//   type: 'replace_exercise' | 'adjust_sets' | 'adjust_reps' | 'adjust_rpe'
//        | 'add_exercise' | 'remove_exercise'
//   dayId: string
//   exerciseIndex?: number
//   patternKey?: string      — for replace / add
//   preferExerciseId?: string
//   sets?: number | reps?: string | rpe?: number
// }
// Skip/swap learning: given raw exercise_skips rows, return the ids of exercises
// the user has skipped >= threshold times. The generator drops these from
// automatic selection — the "3+ skips = implicit swap" signal the schema intended.
export function computeDislikedExerciseIds(skipRows = [], threshold = 3) {
  const counts = {};
  for (const r of skipRows) {
    const key = (r?.exercise_name || '').toLowerCase().trim();
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  const ids = new Set();
  for (const [name, n] of Object.entries(counts)) {
    if (n >= threshold) {
      const resolved = resolveExerciseByName(name);
      if (resolved?.exerciseId) ids.add(resolved.exerciseId);
    }
  }
  return [...ids];
}

// Durable coach memory: turn the user's recorded "dislike" facts into exercise
// ids the generator should drop — so telling the coach "I hate lunges" stops
// lunges being programmed, the same as repeatedly skipping them.
export function dislikedExerciseIdsFromNotes(notes = []) {
  const ids = new Set();
  for (const f of notes || []) {
    if (f?.category === 'dislike' && f.exercise_name) {
      const r = resolveExerciseByName(f.exercise_name);
      if (r?.exerciseId) ids.add(r.exerciseId);
    }
  }
  return [...ids];
}

// Resolve an exercise NAME (as proposed by the AI coach) to its id + pattern key,
// so a "replace with X" actually places X — instead of rebuilding the slot blindly.
export function resolveExerciseByName(name) {
  if (!name) return null;
  const target = name.toLowerCase().trim();
  // Exact match first
  for (const [patternKey, pattern] of Object.entries(MOVEMENT_PATTERNS)) {
    const ex = pattern.exercises.find(e => e.name.toLowerCase().trim() === target);
    if (ex) return { exerciseId: ex.id, patternKey };
  }
  // Fuzzy contains match (handles "Bulgarian split squat" vs "Bulgarian split squat (dumbbell)")
  for (const [patternKey, pattern] of Object.entries(MOVEMENT_PATTERNS)) {
    const ex = pattern.exercises.find(e => {
      const n = e.name.toLowerCase();
      return n.includes(target) || target.includes(n);
    });
    if (ex) return { exerciseId: ex.id, patternKey };
  }
  return null;
}

export function applyPermanentEdit(program, edit, equipment = []) {
  if (!program?.days) return program;

  const days = program.days.map(day => {
    if (day.id !== edit.dayId) return day;
    let exercises = [...day.exercises];
    const idx = edit.exerciseIndex ?? -1;
    // A replace is an in-place, index-based edit: it never grows or shifts the
    // array, so it can't "land on" a slot the generator placed elsewhere the way
    // an add can. Running the whole-day dedup after it is therefore both
    // unnecessary AND destructive — if the replacement shares a base movement with
    // another slot (e.g. the user swaps in a second squat via the coach), dedup
    // silently DELETES the other, pre-existing exercise. That is data loss the user
    // never asked for. So skip dedup for replace: a visible duplicate is a far
    // better failure mode than a silently removed exercise, and duplicate creation
    // is blocked at the entry points instead.
    let skipDedup = false;

    switch (edit.type) {
      case 'replace_exercise': {
        if (idx >= 0 && idx < exercises.length) {
          const current = exercises[idx];
          const newEx = buildExercise(edit.patternKey || current.pattern, equipment, {
            prefer: edit.preferExerciseId,
            sets: current.sets,
            reps: current.reps,
          });
          if (newEx) exercises[idx] = newEx;
        }
        skipDedup = true;
        break;
      }
      case 'adjust_sets': {
        if (idx >= 0 && idx < exercises.length)
          exercises[idx] = { ...exercises[idx], sets: edit.sets };
        break;
      }
      case 'adjust_reps': {
        if (idx >= 0 && idx < exercises.length)
          exercises[idx] = { ...exercises[idx], reps: edit.reps };
        break;
      }
      case 'adjust_rpe': {
        if (idx >= 0 && idx < exercises.length)
          exercises[idx] = { ...exercises[idx], last_rpe: edit.rpe };
        break;
      }
      case 'add_exercise': {
        const newEx = buildExercise(edit.patternKey, equipment, {
          prefer: edit.preferExerciseId,
        });
        if (newEx) exercises.push(newEx);
        break;
      }
      case 'remove_exercise': {
        if (idx >= 0 && idx < exercises.length)
          exercises = exercises.filter((_, i) => i !== idx);
        break;
      }
    }

    // Edits are re-applied to a template that shifts under them (skip-learning,
    // block rotation), so an ADD can land on an exercise the generator already
    // placed elsewhere in the day. The contraindication filter's dedup safety net
    // only runs for users with health conditions — dedup here so healthy profiles
    // are covered too. Replace is exempt (see skipDedup above): it must never
    // delete a different, pre-existing exercise.
    return { ...day, exercises: skipDedup ? exercises : deduplicateDayExercises(exercises, equipment) };
  });

  return { ...program, days };
}

// Apply a one-off session swap that does not modify the program template.
// Returns a new session plan with the swap flagged (_session_swap: true).
// swap: { exerciseIndex: number, patternKey?: string, preferExerciseId?: string }
export function applySessionSwap(sessionPlan, swap, equipment = []) {
  if (!sessionPlan?.exercises) return sessionPlan;

  const exercises = [...sessionPlan.exercises];
  const idx = swap.exerciseIndex;

  if (idx >= 0 && idx < exercises.length) {
    const current = exercises[idx];
    const newEx = buildExercise(swap.patternKey || current.pattern, equipment, {
      prefer: swap.preferExerciseId,
      sets: current.sets,
      reps: current.reps,
    });
    if (newEx) {
      exercises[idx] = {
        ...newEx,
        _session_swap: true,
        _original_name: current.name,
        _original_id: current.id,
      };
    }
  }

  return { ...sessionPlan, exercises };
}

// ─── DUPLICATE EXERCISE GUARD ────────────────────────────────────────────────
// After a day is built, if the same exercise ID appears more than once (happens
// when a pattern's primary falls back to an already-used exercise due to
// equipment constraints), replace duplicates with the next unused alternative
// from the same pattern. If no alternative exists, keeps the duplicate rather
// than dropping the slot.
// Apply the same difficulty gate buildExercise uses, so dedup substitutions and
// their suggested swaps never hand a beginner an advanced lift. Falls back to the
// full pool only if gating would leave nothing.
function gatePoolByLevel(pool, level) {
  if (level === 'beginner' && Array.isArray(pool)) {
    const accessible = pool.filter(e => e.difficulty !== 'advanced');
    if (accessible.length > 0) return accessible;
  }
  return pool || [];
}

// Exercises that are the SAME base movement — having two in one day is redundant
// (e.g. pull-up + weighted pull-up, back squat + goblet squat). Grouped so the day
// keeps at most one and folds the volume in. Complementary same-pattern pairs that
// train different sub-functions (seated vs standing calf = soleus vs gastroc,
// tricep pushdown vs overhead = different heads, straight vs hammer curl) are
// deliberately NOT grouped — those are good programming and stay.
const BASE_MOVEMENT_GROUP = {
  // Bilateral squat (split squats, lunges, and leg press are intentionally excluded)
  barbell_back_squat: 'squat', barbell_front_squat: 'squat', smith_machine_squat: 'squat',
  hack_squat: 'squat', pendulum_squat: 'squat', goblet_squat: 'squat', bodyweight_squat: 'squat',
  kettlebell_goblet_squat: 'squat', band_squat: 'squat',
  // Romanian deadlift variants (conventional/sumo deadlift are a different pull, excluded)
  romanian_deadlift: 'rdl', dumbbell_romanian_deadlift: 'rdl', single_leg_rdl_bodyweight: 'rdl',
  kettlebell_rdl: 'rdl', band_rdl: 'rdl',
  // Glute bridge
  glute_bridge: 'glute_bridge', single_leg_glute_bridge: 'glute_bridge',
  // Y-raise
  incline_y_raise: 'y_raise', prone_y_raise: 'y_raise',
};

// Every vertical-pull-bar/pulldown movement is the same pattern — one per day.
function baseMovementGroup(ex) {
  if (!ex) return null;
  if (BASE_MOVEMENT_GROUP[ex.id]) return BASE_MOVEMENT_GROUP[ex.id];
  if (ex.pattern === 'back_vertical_pull') return 'vertical_pull';
  return null;
}

function deduplicateDayExercises(exercises, equipment, level = 'intermediate', excludeIds = []) {
  const usedIds = new Set();
  const usedNames = new Set();
  const usedGroups = new Set();
  const firstById = new Map(); // id -> the kept output exercise (for set-merging)
  const firstByGroup = new Map();
  const out = [];
  for (const ex of exercises) {
    if (!ex) { out.push(ex); continue; }
    const group = baseMovementGroup(ex);
    const dupById = usedIds.has(ex.id) || usedNames.has(ex.name);
    const dupByGroup = group && usedGroups.has(group);
    if (!dupById && !dupByGroup) {
      usedIds.add(ex.id); usedNames.add(ex.name);
      if (group) { usedGroups.add(group); firstByGroup.set(group, ex); }
      firstById.set(ex.id, ex);
      out.push(ex);
      continue;
    }
    // Duplicate movement in the same day. Previously we substituted "a distinct
    // alternative from the same pattern" — but same-pattern alternatives are often
    // the SAME base movement (pull-up→weighted pull-up, squat→bodyweight squat,
    // glute bridge→single-leg glute bridge), which produced redundant pairs.
    // Instead, concentrate the volume: merge this slot's sets into the first
    // occurrence (capped), so the day never shows two versions of one movement.
    const first = firstById.get(ex.id) || out.find(o => o && o.name === ex.name);
    if (first && typeof first.sets === 'number' && typeof ex.sets === 'number') {
      first.sets = Math.min(8, first.sets + ex.sets);
    }
    // drop the duplicate (its volume has been folded into `first`)
  }
  return out;
}

// ─── SPORT-AWARE SCHEDULE ────────────────────────────────────────────────────
// Builds a schedule_template that avoids days occupied by sport sessions.
// Spaces strength days as evenly as possible across the remaining days.
const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function buildDynamicSchedule(strengthDayCount, occupiedDays) {
  const available = ALL_DAYS.filter(d => !occupiedDays.includes(d));
  if (available.length === 0 || strengthDayCount === 0) return ALL_DAYS.slice(0, strengthDayCount);
  const count = Math.min(strengthDayCount, available.length);
  const step = available.length / count;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(available[Math.round(i * step)]);
  }
  return result;
}

// ─── PROGRAM BUILDER ─────────────────────────────────────────────────────────

// blockIndex: which training block this is (0 = first block, 1 = second, ...).
// Passing blockIndex > 0 rotates exercises within each movement pattern,
// cycling through rotation alternatives in library order.
// blockStartDate: ISO date string — used in the return value for rotation tracking.
export function generateProgram(profile, blockIndex = 0, blockStartDate = null, opts = {}) {
  const equipment = normalizeEquipment(profile.equipment || []);
  const split = selectSplit(profile);
  // Exercise ids the user has repeatedly skipped/swapped away (computed by the
  // caller from exercise_skips) — dropped from automatic selection. See `be`.
  const dislikedIds = opts.dislikedIds || [];
  const goals = profile.goals || [];
  const gp = getGoalProfile(goals); // full goal profile object
  const level = getLevelFromProfile(profile);
  // Experience-based volume scaling. Hypertrophy follows a dose-response that keeps
  // rising with diminishing returns and is steeper the more trained the lifter is
  // (Schoenfeld, Ogborn & Krieger 2017 J Sports Sci; Pelland/Nuckols et al. 2026
  // Sports Med 56:481-505; Enes et al. 2024 J Appl Physiol — progressively raising
  // volume beats holding it static in trained lifters). Beginners grow on less and
  // should not accrue junk volume; advanced lifters need more. The factor scales
  // the whole program around the intermediate baseline the splits are designed at.
  // SAME factor for both sexes — per-set hypertrophy does not differ by sex
  // (Refalo, Nuckols et al. 2025 PeerJ 13:e19042); women simply tolerate the top
  // of the range better via faster intra/inter-set recovery (Hunter 2014).
  const LEVEL_VOLUME_FACTOR = { beginner: 0.8, intermediate: 1.0, advanced: 1.2 };
  const volumeFactor = LEVEL_VOLUME_FACTOR[level] || 1.0;
  // Sex-based lower-body emphasis. Same weekly volume per muscle for both — the
  // accessory slots just point at quads (male/other/unset) or glutes (female),
  // keeping every muscle inside its target range either way.
  const isFemale = (profile?.sex || '').toLowerCase() === 'female';

  // be() — block-aware exercise builder. Threads blockIndex automatically so
  // exercise selection rotates each time a new block is generated, then scales
  // the set count by the experience-based volume factor.
  const be = (patternKey, overrides = {}) => {
    const ex = buildExercise(patternKey, equipment, { blockIndex, level, excludeIds: dislikedIds, ...overrides });
    if (ex && typeof ex.sets === 'number' && volumeFactor !== 1.0) {
      ex.sets = Math.max(1, Math.round(ex.sets * volumeFactor));
    }
    if (ex) ex._pattern = patternKey;
    return ex;
  };

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
          focus: isFemale ? 'Squat · Chest · Back · Glutes' : 'Squat · Chest · Back · Quads',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('back_horizontal_pull', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            // Lower-body emphasis (sex tilt): quads for male/other, glutes for female
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'day_b',
          name: 'Full Body B',
          focus: isFemale ? 'Hinge · Incline · Vertical pull · Glutes' : 'Hinge · Incline · Vertical pull · Quads',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE, prefer: 'romanian_deadlift' }),
            be('chest_incline_push', { reps: compoundReps, sets: compoundSets }),
            be('back_vertical_pull', { reps: compoundReps, sets: compoundSets }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            // Lower-body emphasis (sex tilt): both get a quad squat here so women
            // still hit quad volume; the glute lean for women lives on Day A (hip thrust)
            isFemale
              ? be('squat_pattern', { prefer: 'hack_squat', sets: isolationSets, reps: isolationReps })
              : be('squat_pattern', { prefer: 'leg_press', sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
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
          focus: isFemale ? 'Squat · Push · Glutes' : 'Squat · Push · Quads',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('back_vertical_pull', { reps: '8–12', sets: compoundSets, prefer: 'lat_pulldown' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            // Lower tilt: quad iso (male) vs glute (female)
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'day_b',
          name: 'Full Body B',
          focus: 'Hinge · Pull · Hamstrings',
          exercises: [
            be('hip_hinge', { reps: '8–12', sets: compoundSets, prefer: 'romanian_deadlift' }),
            be('chest_incline_push', { reps: '8–12', sets: compoundSets }),
            be('back_horizontal_pull', { reps: '8–12', sets: compoundSets }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            be('rear_delt', { sets: isolationSets, reps: '15–20' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'day_c',
          name: 'Full Body C',
          focus: isFemale ? 'Legs (glute lean) · volume' : 'Legs (quad lean) · volume',
          exercises: [
            be('squat_pattern', { reps: '8–12', sets: compoundSets, prefer: 'leg_press' }),
            be('chest_horizontal_push', { reps: '10–15', sets: isolationSets, prefer: 'machine_chest_press' }),
            be('back_vertical_pull', { reps: '10–15', sets: compoundSets, prefer: 'close_grip_lat_pulldown' }),
            // Tilt: female gets a glute slot here; male spends it on rear delts (the most undertrained head)
            isFemale
              ? be('glute_focused', { prefer: 'hip_abduction_machine', sets: isolationSets, reps: '12–20' })
              : be('rear_delt', { sets: isolationSets, reps: '15–20' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
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
          focus: 'Heavy horizontal press and row, OHP, side delts, overhead tricep extension',
          exercises: [
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('back_horizontal_pull', { reps: compoundReps, sets: compoundSets }),
            be('shoulders_vertical_push', { reps: compoundReps, sets: 3 }),
            be('shoulders_side_delt', { sets: isolationSets, reps: isolationReps }),
            be('shoulders_side_delt', { sets: 2, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            be('triceps', { sets: isolationSets, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'lower_a',
          name: isFemale ? 'Lower A — Squat + Glutes' : 'Lower A — Squat + Quads',
          focus: 'Heavy squat, RDL, then quad or glute emphasis',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('hip_hinge', { reps: '8–12', sets: compoundSets, prefer: 'romanian_deadlift' }),
            // Emphasis tilt 1
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: compoundSets, reps: '8–12' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            // Emphasis tilt 2: female → glute isolation, male → extra calves
            isFemale
              ? be('glute_focused', { prefer: 'hip_abduction_machine', sets: isolationSets, reps: '12–20' })
              : be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper_b',
          name: 'Upper B — Hypertrophy + Arms',
          focus: 'Incline press, vertical pull, lower chest, side delts, rear delts, arms',
          exercises: [
            be('chest_incline_push', { reps: '8–12', sets: 3 }),
            be('back_vertical_pull', { reps: '8–12', sets: 4 }),
            be('back_horizontal_pull', { reps: '10–15', sets: 3 }),
            be('chest_isolation', { sets: isolationSets, reps: isolationReps }),
            be('chest_decline', { sets: isolationSets, reps: '12–15' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '15–20' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'incline_y_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            gp.prioritiseIsolation ? be('upper_traps', { sets: isolationSets, reps: '12–15' }) : null,
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'preacher_curl' }),
            be('triceps', { sets: isolationSets, reps: isolationReps, prefer: 'cable_tricep_pushdown' }),
            be('core', { sets: isolationSets }),
            be('core', { sets: 3, reps: '8–12', prefer: 'ab_wheel_rollout' }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'lower_b',
          name: isFemale ? 'Lower B — Deadlift + Glutes' : 'Lower B — Deadlift + Quads',
          focus: 'Deadlift, squat variation, then quad or glute emphasis',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE, prefer: 'conventional_deadlift' }),
            be('squat_pattern', { reps: '8–12', sets: compoundSets, prefer: 'hack_squat' }),
            // Emphasis tilt 1
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: compoundSets, reps: '8–12' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'lying_leg_curl' }),
            // Emphasis tilt 2: female → glute isolation, male → extra calves
            isFemale
              ? be('glute_focused', { prefer: 'kettlebell_hip_thrust', sets: isolationSets, reps: '12–20' })
              : be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'optional_shoulders',
          name: 'Shoulders Day',
          optional: true,
          focus: 'OHP · cable lateral raises · Lu raises · Y raises · rear delts · shrugs — ~45 min',
          tip: 'Add as a 5th session when shoulder volume feels low. Replace a rest day — ideally Saturday.',
          exercises: [
            be('shoulders_vertical_push', { reps: '8–12', sets: 4 }),
            be('shoulders_side_delt', { sets: 4, reps: '12–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: 3, reps: '15–20', prefer: 'reverse_pec_deck' }),
            be('rear_delt', { sets: 2, reps: '12–15', prefer: 'lu_lateral_raise' }),
            be('upper_traps', { sets: 3, reps: '12–15', prefer: 'barbell_shrug' }),
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
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('chest_incline_push', { reps: '8–12', sets: 3 }),
            be('chest_isolation', { sets: isolationSets, reps: '12–15' }),
            be('chest_decline', { sets: isolationSets, reps: '12–15' }),
            be('triceps', { sets: isolationSets, reps: '10–15', prefer: 'overhead_tricep_extension' }),
            be('triceps', { sets: isolationSets, reps: '10–15', prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'back_bi',
          name: 'Back + Biceps',
          focus: 'Lat width + back thickness + side delt frequency + bicep volume',
          exercises: [
            be('back_vertical_pull', { reps: '6–10', sets: compoundSets }),
            be('back_horizontal_pull', { reps: compoundReps, sets: compoundSets }),
            be('back_horizontal_pull', { reps: '10–15', sets: 2 }),
            be('rear_delt', { sets: isolationSets }),
            be('shoulders_side_delt', { sets: 2, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('biceps', { sets: isolationSets, reps: '10–15' }),
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'preacher_curl' }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'shoulders_abs',
          name: 'Shoulders + Abs',
          focus: 'Full shoulder development + core',
          exercises: [
            be('shoulders_vertical_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('shoulders_side_delt', { sets: 2, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: isolationSets }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            gp.prioritiseIsolation ? be('upper_traps', { sets: isolationSets, reps: '12–15' }) : null,
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'legs',
          name: 'Legs',
          focus: 'Complete lower body — quads, hamstrings, glutes, calves',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('hip_hinge', { reps: '8–12', sets: 3 }),
            // Mid-block tilts toward sex: male = quad lean, female = glute lean
            ...(isFemale
              ? [
                  be('hip_hinge', { prefer: 'hip_thrust', sets: compoundSets, reps: '8–12' }),
                  be('glute_focused', { prefer: 'hip_abduction_machine', sets: isolationSets, reps: '12–20' }),
                  be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
                  be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
                ]
              : [
                  be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
                  be('squat_pattern', { sets: isolationSets, reps: '12–15', prefer: 'leg_press' }),
                  be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
                ]),
            be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
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
          focus: 'Heavy chest + OHP, side delts, lower chest, overhead extension + pushdown',
          exercises: [
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('chest_incline_push', { reps: '8–12', sets: 3 }),
            be('chest_decline', { sets: isolationSets, reps: '12–15' }),
            be('shoulders_vertical_push', { reps: compoundReps, sets: 3 }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('triceps', { sets: isolationSets, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
            be('triceps', { sets: isolationSets, reps: '10–15', prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'pull',
          name: 'Pull — Back / Biceps',
          focus: 'Vertical + horizontal pulls, inner back, rear delts, face pull, incline curl + hammer curl',
          exercises: [
            be('back_vertical_pull', { reps: '6–10', sets: 4 }),
            be('back_horizontal_pull', { reps: compoundReps, sets: 4 }),
            be('back_inner', { reps: '10–15', sets: 3 }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'incline_y_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20', prefer: 'cable_lateral_raise' }),
            gp.prioritiseIsolation ? be('upper_traps', { sets: isolationSets, reps: '12–15', prefer: 'barbell_shrug' }) : null,
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            be('biceps', { sets: 2, reps: isolationReps, prefer: 'standing_hammer_curl' }),
            be('core', { sets: isolationSets }),
            be('core', { sets: 3, reps: '8–12', prefer: 'ab_wheel_rollout' }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'legs',
          name: 'Legs',
          focus: 'Squat, RDL, leg extension reclined, seated curl, calves',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('hip_hinge', { reps: '8–12', sets: 3 }),
            be('glute_focused', { sets: isolationSets, reps: '15–20' }),
            be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper',
          name: 'Upper — Full Upper Body',
          focus: 'Incline chest, vertical pull, chest isolation, side delts, rear delts, arms volume',
          exercises: [
            be('chest_incline_push', { reps: '8–12', sets: 3, prefer: 'incline_dumbbell_press' }),
            be('back_vertical_pull', { reps: '8–12', sets: 4, prefer: 'chin_up' }),
            be('chest_isolation', { sets: isolationSets, reps: '12–15' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '15–20' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'bayesian_cable_curl' }),
            be('triceps', { sets: isolationSets, reps: isolationReps, prefer: 'cable_tricep_pushdown' }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'lower',
          name: 'Lower — Posterior Chain Focus',
          focus: 'Deadlift, hip thrust, hamstrings, glutes, calves',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE, prefer: 'conventional_deadlift' }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            be('squat_pattern', { reps: '8–12', sets: 3 }),
            // Lower-body tilt (stays lower): male quad lean, female glute lean
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('squat_pattern', { prefer: 'leg_press', sets: isolationSets, reps: '10–15' }),
            isFemale
              ? be('glute_focused', { prefer: 'hip_abduction_machine', sets: 2, reps: '15–20' })
              : be('quad_isolation', { sets: 2, reps: '12–15' }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'lying_leg_curl' }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'optional_shoulders',
          name: 'Shoulders Day',
          optional: true,
          focus: 'OHP · cable laterals · Lu raise · Y raise · rear delts · shrugs — ~45 min',
          tip: 'Add as a 6th session. Brings side delt to 11 sets/week and rear delt to 9 — hitting the optimal research range.',
          exercises: [
            be('shoulders_vertical_push', { reps: '8–12', sets: 4 }),
            be('shoulders_side_delt', { sets: 4, reps: '12–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: 3, reps: '15–20', prefer: 'reverse_pec_deck' }),
            be('rear_delt', { sets: 2, reps: '12–15', prefer: 'lu_lateral_raise' }),
            be('upper_traps', { sets: 3, reps: '12–15', prefer: 'barbell_shrug' }),
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
          focus: 'Flat bench, incline press, chest isolation, side delts x2, overhead tricep extension',
          exercises: [
            // Flat press anchors the day — the sternocostal (mid/lower) pec needs
            // horizontal pressing; incline alone leaves it understimulated
            // (regional hypertrophy: incline grows clavicular, flat grows sternocostal).
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('chest_incline_push', { reps: '8–12', sets: isolationSets }),
            be('chest_isolation', { sets: isolationSets, reps: '12–15' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: isolationReps }),
            be('shoulders_side_delt', { sets: 2, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('triceps', { sets: isolationSets, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
          ].filter(Boolean),
        },
        {
          id: 'pull_a',
          name: 'Pull A — Back Focus',
          focus: 'Heavy vertical + horizontal pull, inner back, Y raise, face pull, incline curl',
          exercises: [
            be('back_vertical_pull', { reps: '5–8', sets: 4 }),
            be('back_horizontal_pull', { reps: compoundReps, sets: 4 }),
            be('back_inner', { reps: '10–15', sets: 3 }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'incline_y_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            gp.prioritiseIsolation ? be('upper_traps', { sets: isolationSets, reps: '12–15' }) : null,
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            be('core', { sets: isolationSets }),
            be('core', { sets: 3, reps: '10–15', prefer: 'cable_crunch' }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'legs_a',
          name: 'Legs A — Quad Focus',
          focus: 'Heavy squat, leg extension reclined, seated curl, calves',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('hip_hinge', { reps: '8–10', sets: 3 }),
            be('glute_focused', { sets: isolationSets, reps: '15–20' }),
            be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'push_b',
          name: 'Push B — Shoulder Focus',
          focus: 'OHP, lateral raises, incline press, overhead extension + pushdown',
          exercises: [
            be('shoulders_vertical_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('shoulders_side_delt', { sets: 3, reps: '12–20' }),
            be('shoulders_side_delt', { sets: 3, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('chest_incline_push', { reps: '8–12', sets: 2, prefer: 'incline_dumbbell_press' }),
            be('triceps', { sets: isolationSets, reps: '10–15', prefer: 'overhead_tricep_extension' }),
            be('triceps', { sets: isolationSets, reps: '10–15', prefer: 'cable_tricep_pushdown' }),
          ].filter(Boolean),
        },
        {
          id: 'pull_b',
          name: 'Pull B — Bicep Focus',
          focus: 'Vertical pull volume, inner back, face pull, reverse pec deck, Bayesian curl + hammer curl',
          exercises: [
            be('back_vertical_pull', { reps: '8–12', sets: 4, prefer: 'chin_up' }),
            // 2 sets (not 3) keeps weekly direct back volume at the 20-set ceiling
            be('back_horizontal_pull', { reps: '10–15', sets: 2 }),
            be('back_inner', { reps: '12–15', sets: 3 }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'reverse_pec_deck' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            be('biceps', { sets: isolationSets, reps: '10–15', prefer: 'bayesian_cable_curl' }),
            be('biceps', { sets: 2, reps: '10–15', prefer: 'standing_hammer_curl' }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'legs_b',
          name: 'Legs B — Posterior Chain Focus',
          focus: 'Deadlift, hip thrust, hamstrings, glutes, calves',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE, prefer: 'romanian_deadlift' }),
            be('squat_pattern', { reps: '8–12', sets: 3 }),
            be('quad_isolation', { sets: isolationSets, reps: '15–20' }),
            // Glute slot: male keeps compound lunge, female dedicated glute (hip thrust)
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('glute_focused', { sets: isolationSets, reps: '12–15', prefer: 'walking_lunge' }),
            // Tilt (stays lower): male quad (leg press), female glute (abduction)
            isFemale
              ? be('glute_focused', { sets: 2, reps: '15–20', prefer: 'hip_abduction_machine' })
              : be('squat_pattern', { sets: 2, reps: '12–15', prefer: 'leg_press' }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'lying_leg_curl' }),
            be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
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
          focus: 'Compounds + ' + (isFemale ? 'glute' : 'quad') + ' emphasis',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('back_vertical_pull', { reps: '8–12', sets: compoundSets, prefer: 'lat_pulldown' }),
            be('hip_hinge', { reps: '8–12', sets: isolationSets, prefer: 'romanian_deadlift' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            // Lower tilt: quad iso (male) vs glute (female)
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper',
          name: 'Upper Body',
          focus: 'Chest, back, shoulders, arms',
          exercises: [
            be('chest_incline_push', { reps: '8–12', sets: compoundSets }),
            be('back_horizontal_pull', { reps: '8–12', sets: compoundSets }),
            be('chest_horizontal_push', { reps: '10–15', sets: isolationSets, prefer: 'machine_chest_press' }),
            be('back_vertical_pull', { reps: '10–15', sets: isolationSets, prefer: 'close_grip_lat_pulldown' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: isolationSets, reps: '15–20', prefer: 'face_pull' }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
          ].filter(Boolean),
        },
        {
          id: 'lower',
          name: isFemale ? 'Lower Body — Glute focus' : 'Lower Body — Quad focus',
          focus: 'Squat, hinge, then quad or glute emphasis',
          exercises: [
            be('squat_pattern', { reps: '8–12', sets: compoundSets, prefer: 'leg_press' }),
            be('hip_hinge', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE, prefer: 'conventional_deadlift' }),
            // Emphasis tilt 1
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: compoundSets, reps: '8–12' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            // Emphasis tilt 2: female → glute, male → calves
            isFemale
              ? be('glute_focused', { prefer: 'hip_abduction_machine', sets: isolationSets, reps: '12–20' })
              : be('calves', { sets: isolationSets, prefer: 'seated_calf_raise' }),
            be('calves', { sets: isolationSets, prefer: 'standing_calf_raise' }),
            be('core', { sets: isolationSets }),
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
            be('squat_pattern', { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            be('chest_horizontal_push', { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            be('back_horizontal_pull', { reps: compoundReps, sets: 3 }),
            be('shoulders_side_delt', { sets: isolationSets }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            // Tilt: female glute (hip thrust), male extra side delt
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'fb_b',
          name: 'Full Body B',
          focus: 'Hip hinge + vertical push/pull focus',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            // Tilt: female glute (hip abduction), male rear delt
            isFemale
              ? be('glute_focused', { prefer: 'hip_abduction_machine', sets: isolationSets, reps: '12–20' })
              : be('rear_delt', { sets: isolationSets, reps: '15–20' }),
            be('back_vertical_pull', { reps: '6–10', sets: 3 }),
            be('shoulders_vertical_push', { reps: compoundReps, sets: 3 }),
            be('chest_incline_push', { reps: '8–12', sets: 3, prefer: 'incline_dumbbell_press' }),
            be('quad_isolation', { sets: isolationSets }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_c',
          name: 'Full Body C',
          focus: 'Incline + isolation volume focus',
          exercises: [
            be('squat_pattern', { reps: '8–12', sets: 3 }),
            be('chest_incline_push', { reps: '8–12', sets: 3 }),
            be('back_horizontal_pull', { reps: '10–15', sets: 3 }),
            be('quad_isolation', { sets: isolationSets }),
            // Triceps here instead of a 4th ham-curl day — hams are already covered by
            // the curls on A/B/D plus the B and D hinges; this balances arm volume.
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('rear_delt', { sets: isolationSets }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            // Tilt: female glute (hip abduction), male extra side delt
            isFemale
              ? be('glute_focused', { prefer: 'hip_abduction_machine', sets: isolationSets, reps: '12–20' })
              : be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'fb_d',
          name: 'Full Body D',
          focus: 'Posterior chain + arms volume',
          exercises: [
            be('hip_hinge', { reps: '8–12', sets: 3, prefer: isFemale ? 'hip_thrust' : 'romanian_deadlift' }),
            // Tilt: female glute (hip thrust), male quad (leg extension)
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('back_vertical_pull', { reps: '8–12', sets: 3, prefer: 'chin_up' }),
            be('chest_isolation', { sets: isolationSets }),
            be('hamstring_isolation', { sets: isolationSets }),
            be('shoulders_side_delt', { sets: isolationSets }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
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
          focus: 'Heavy horizontal press/row, overhead press, side delts, overhead tricep extension',
          exercises: [
            be('chest_horizontal_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('back_horizontal_pull', { reps: compoundReps, sets: compoundSets }),
            be('shoulders_vertical_push', { reps: compoundReps, sets: 3 }),
            be('shoulders_side_delt', { sets: isolationSets, reps: isolationReps }),
            be('shoulders_side_delt', { sets: 2, reps: '15–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20' }),
            be('biceps', { sets: 2, reps: isolationReps, prefer: 'incline_dumbbell_curl' }),
            be('triceps', { sets: 2, reps: isolationReps, prefer: 'overhead_tricep_extension' }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'lower_a',
          name: 'Lower A — Quad Focus',
          focus: 'Heavy squat, leg extension reclined, calves, core',
          exercises: [
            be('squat_pattern', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('hip_hinge', { reps: '6–10', sets: 3 }),
            be('glute_focused', { sets: isolationSets, reps: '15–20' }),
            be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps, prefer: 'seated_leg_curl' }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper_b',
          name: 'Upper B — Hypertrophy Volume',
          focus: 'Incline push, vertical pull, chest isolation, lower chest, rear delts, pushdowns',
          exercises: [
            be('chest_incline_push', { reps: '8–12', sets: 3 }),
            be('back_vertical_pull', { reps: '8–12', sets: 4 }),
            be('chest_isolation', { sets: isolationSets, reps: '12–15' }),
            be('chest_decline', { sets: isolationSets, reps: '12–15' }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20', prefer: 'cable_lateral_raise' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'reverse_pec_deck' }),
            be('biceps', { sets: isolationSets, reps: isolationReps, prefer: 'bayesian_cable_curl' }),
            be('triceps', { sets: isolationSets, reps: isolationReps, prefer: 'cable_tricep_pushdown' }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'lower_b',
          name: 'Lower B — Posterior Chain',
          focus: 'RDL/deadlift, hip thrust, hamstrings, glutes, calves',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE, prefer: 'hip_thrust' }),
            be('squat_pattern', { reps: '8–12', sets: 3 }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps }),
            be('glute_focused', { sets: isolationSets }),
            // Tilt (stays lower): male calves, female glute (abduction)
            isFemale
              ? be('glute_focused', { sets: 2, reps: '15–20', prefer: 'hip_abduction_machine' })
              : be('calves', { sets: 2, prefer: 'standing_calf_raise' }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'upper_c',
          name: 'Upper C — Shoulders Specialisation',
          focus: 'Overhead press, lateral raises, Y raise, Lu raise, rear delts, traps',
          exercises: [
            be('shoulders_vertical_push', { reps: compoundReps, sets: compoundSets, early_rpe: compoundRPE }),
            be('shoulders_side_delt', { sets: 4, reps: '12–20' }),
            be('rear_delt', { sets: 3, reps: '15–20' }),
            be('rear_delt', { sets: 2, reps: '15–20', prefer: 'face_pull' }),
            be('upper_traps', { sets: 3, reps: '12–15' }),
            be('back_horizontal_pull', { reps: '10–15', sets: 3 }),
            be('biceps', { sets: 2, reps: isolationReps, prefer: 'standing_hammer_curl' }),
            be('triceps', { sets: 2, reps: isolationReps, prefer: 'ez_bar_skullcrusher' }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'lower_c',
          name: 'Lower C — Full Lower Body',
          focus: 'Complete lower body — quads, hamstrings, glutes, calves',
          exercises: [
            be('squat_pattern', { reps: '8–12', sets: 3 }),
            be('hip_hinge', { reps: '8–12', sets: 3 }),
            be('quad_isolation', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets }),
            be('glute_focused', { sets: isolationSets }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
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
            be('squat_pattern', { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            be('chest_horizontal_push', { reps: compoundReps, sets: 3 }),
            be('back_horizontal_pull', { reps: compoundReps, sets: 3 }),
            be('shoulders_side_delt', { sets: isolationSets }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            // Lower tilt (stays lower): male quad, female glute (keeps walking lunge)
            isFemale
              ? be('glute_focused', { sets: isolationSets, reps: '12–15', prefer: 'walking_lunge' })
              : be('quad_isolation', { sets: isolationSets, reps: '15–20' }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps }),
            be('core', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'fb_b',
          name: 'Full Body B',
          focus: 'Hip hinge + vertical pull + triceps',
          exercises: [
            be('hip_hinge', { reps: compoundReps, sets: 3, early_rpe: compoundRPE }),
            // Tilt: female glute (hip thrust); male gets side delts here — Day B already
            // has a leg curl + RDL, so a 2nd curl was redundant; full-body day, not a leg day
            isFemale
              ? be('hip_hinge', { prefer: 'hip_thrust', sets: isolationSets, reps: '10–15' })
              : be('shoulders_side_delt', { sets: isolationSets, reps: '12–20' }),
            be('back_vertical_pull', { reps: '6–10', sets: 3 }),
            be('shoulders_vertical_push', { reps: compoundReps, sets: 3 }),
            be('shoulders_side_delt', { sets: isolationSets, reps: '12–20', prefer: 'cable_lateral_raise' }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('hamstring_isolation', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_c',
          name: 'Full Body C',
          focus: 'Incline + isolation volume',
          exercises: [
            be('squat_pattern', { reps: '8–12', sets: 3 }),
            be('chest_incline_push', { reps: '8–12', sets: 3 }),
            be('back_horizontal_pull', { reps: '10–15', sets: 3 }),
            be('quad_isolation', { sets: isolationSets }),
            // Lower tilt (stays lower): male hamstring, female glute (abduction)
            isFemale
              ? be('glute_focused', { sets: 2, reps: '15–20', prefer: 'hip_abduction_machine' })
              : be('hamstring_isolation', { sets: 2, reps: isolationReps, prefer: 'lying_leg_curl' }),
            be('shoulders_side_delt', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
        {
          id: 'fb_d',
          name: 'Full Body D',
          focus: 'Posterior chain + arms',
          exercises: [
            be('hip_hinge', { reps: '8–12', sets: 3, prefer: 'hip_thrust' }),
            be('back_vertical_pull', { reps: '8–12', sets: 3, prefer: 'chin_up' }),
            be('chest_isolation', { sets: isolationSets }),
            be('hamstring_isolation', { sets: isolationSets }),
            be('biceps', { sets: isolationSets, reps: isolationReps }),
            // Lower tilt (stays lower): male calves, female glute (bridge)
            isFemale
              ? be('glute_focused', { sets: 2, reps: '15–20', prefer: 'glute_bridge' })
              : be('calves', { sets: 2, prefer: 'standing_calf_raise' }),
            be('triceps', { sets: isolationSets, reps: isolationReps }),
            be('calves', { sets: isolationSets }),
            be('forearms', { sets: 2, reps: isolationReps, optional: true }),
          ].filter(Boolean),
        },
        {
          id: 'fb_e',
          name: 'Full Body E',
          focus: 'Weak points + isolation',
          exercises: [
            be('squat_pattern', { reps: '10–15', sets: 3 }),
            be('back_vertical_pull', { reps: '10–15', sets: 3, prefer: 'lat_pulldown' }),
            be('chest_isolation', { sets: isolationSets }),
            be('rear_delt', { sets: isolationSets }),
            be('biceps', { sets: 2, reps: isolationReps }),
            be('triceps', { sets: 2, reps: isolationReps }),
            be('glute_focused', { sets: isolationSets }),
            be('calves', { sets: isolationSets }),
            be('core', { sets: isolationSets }),
          ].filter(Boolean),
        },
      ];
      break;
    }

    default:
      days = [];
  }

  // ── Dedup pass: no exercise should appear twice in the same day. If it does,
  // swap the duplicate for a different exercise from the same movement pattern. ──
  days = days.map(day => {
    if (!day.exercises) return day;
    const seen = new Set();
    const exercises = day.exercises.map(ex => {
      if (!ex?.name) return ex;
      if (!seen.has(ex.name)) { seen.add(ex.name); return ex; }
      // Duplicate — try an alternative from the same pattern not already used
      // today, gated to the user's level so a beginner never gets an advanced swap.
      const pool = ex.pattern ? gatePoolByLevel(getAllExercisesForPattern?.(ex.pattern, equipment) || [], level) : [];
      const alt = pool.find(e => !seen.has(e.name));
      if (alt) {
        const rebuilt = buildExercise(ex.pattern, equipment, { prefer: alt.id, sets: ex.sets, reps: ex.reps, level });
        if (rebuilt?.name && !seen.has(rebuilt.name)) { seen.add(rebuilt.name); return rebuilt; }
      }
      seen.add(ex.name);
      return ex;
    });
    return { ...day, exercises };
  });

  const blockLengthWeeks = getBlockLength(level);

  days = days.map(day => ({
    ...day,
    exercises: deduplicateDayExercises(day.exercises || [], equipment, level, dislikedIds),
  }));

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

  const sportEntries = (profile.sports || []).filter(s => s?.days?.length > 0);
  const occupiedDays = [...new Set(sportEntries.flatMap(s => s.days))];
  const scheduleTemplate = occupiedDays.length > 0
    ? buildDynamicSchedule(days.length, occupiedDays)
    : split.schedule_template;

  return {
    id: split.id,
    name: split.name,
    split,
    days_per_week: split.days,
    level,
    session_time: split.session_time_est,
    schedule: scheduleTemplate,
    rest_between: split.rest_between || [],
    science_basis: split.science_basis,
    honest_note: split.honest_note,
    // ── Block tracking ─────────────────────────────────────────────────────
    block_index: blockIndex,
    block_start_date: blockStartDate || new Date().toISOString(),
    block_length_weeks: blockLengthWeeks,
    block_end_date: (() => {
      const start = blockStartDate ? new Date(blockStartDate) : new Date();
      start.setDate(start.getDate() + blockLengthWeeks * 7);
      return start.toISOString();
    })(),
    // ── Progressive overload ───────────────────────────────────────────────
    progression: 'Double progression — add reps each session within the rep range. When every set hits the ceiling on all sets, increase load by the smallest available increment and return to the bottom of the range.',
    progression_model: PROGRESSIVE_OVERLOAD.model,
    // ── Program metadata ───────────────────────────────────────────────────
    warnings: generateWarnings(profile, split),
    volume_targets: VOLUME_TARGETS,
    sport_sessions: sportEntries.flatMap(s => s.days.map(d => ({ day: d, sport: s.label || s.key }))),
    days: days.map((day, i) => ({
      ...day,
      scheduled_day: scheduleTemplate[i] || null,
    })),
  };
}

// ─── OPTIONAL-DAY VOLUME REBALANCING ─────────────────────────────────────────
// An optional specialisation day (e.g. the Shoulders Day) piles a big block of
// isolation volume onto one or two muscle heads on top of the main split. If the
// lifter actually COMPLETES it in a given week, the main days' isolation for
// those heads would push the weekly total past its optimal ceiling. This trims
// the main-day isolation sets for the affected heads back down so the weekly
// total lands at the head's optimal_high — compounds and presses are never
// touched, and the trim only happens in weeks the optional day was done.
//
// Maps an optional day id → the heads it loads and the exercise pattern that
// feeds each head (used to find the matching isolation slots on the main days).
const OPTIONAL_DAY_HEADS = {
  optional_shoulders: [
    { head: 'side_delts', pattern: 'shoulders_side_delt' },
    { head: 'rear_delts', pattern: 'rear_delt' },
  ],
};

export function rebalanceForCompletedOptionalDays(program, completedDayNames = []) {
  if (!program?.days?.length) return program;
  const completed = new Set(
    (completedDayNames || []).map(n => n?.toLowerCase().trim()).filter(Boolean)
  );
  if (!completed.size) return program;

  const tier = program.level || 'intermediate';

  // For every optional day that was completed this week, total the sets it adds
  // to each head so we know how much the main days need to give back.
  const headInfo = {}; // head -> { pattern, optionalSets }
  program.days.forEach(d => {
    if (!d.optional || !completed.has(d.name?.toLowerCase().trim())) return;
    (OPTIONAL_DAY_HEADS[d.id] || []).forEach(({ head, pattern }) => {
      const added = (d.exercises || [])
        .filter(ex => ex.pattern === pattern)
        .reduce((n, ex) => n + (ex.sets || 0), 0);
      if (!headInfo[head]) headInfo[head] = { pattern, optionalSets: 0 };
      headInfo[head].optionalSets += added;
    });
  });
  if (!Object.keys(headInfo).length) return program;

  // Clone days + exercises so we can adjust set counts without mutating the
  // generated program (which is cached / reused elsewhere).
  const days = program.days.map(d => ({
    ...d,
    exercises: (d.exercises || []).map(ex => ({ ...ex })),
  }));

  Object.entries(headInfo).forEach(([head, { pattern, optionalSets }]) => {
    const target = VOLUME_TARGETS[head]?.[tier]?.optimal_high;
    if (!target) return;

    // Isolation slots for this head on the main (non-optional) days only.
    const slots = [];
    days.forEach(d => {
      if (d.optional) return;
      d.exercises.forEach(ex => { if (ex.pattern === pattern) slots.push(ex); });
    });
    const mainTotal = slots.reduce((n, ex) => n + (ex.sets || 0), 0);
    let excess = (mainTotal + optionalSets) - target;
    if (excess <= 0) return; // already within range — leave it alone

    // Trim one set at a time off the currently-largest slot so the cut is spread
    // out rather than gutting a single exercise.
    while (excess > 0 && slots.some(ex => (ex.sets || 0) > 0)) {
      const biggest = slots
        .filter(ex => (ex.sets || 0) > 0)
        .sort((a, b) => (b.sets || 0) - (a.sets || 0))[0];
      biggest.sets -= 1;
      excess -= 1;
    }
  });

  // Drop any isolation slot that was trimmed all the way to zero.
  const trimPatterns = new Set(Object.values(headInfo).map(h => h.pattern));
  days.forEach(d => {
    if (d.optional) return;
    d.exercises = d.exercises.filter(ex => !(trimPatterns.has(ex.pattern) && (ex.sets || 0) <= 0));
  });

  return { ...program, days, volume_rebalanced: true };
}

// ─── LEVEL DETECTOR ──────────────────────────────────────────────────────────

function getLevelFromProfile(profile) {
  return profile.trainingExperience || 'beginner';
}

// ─── WEEKLY VOLUME CHECKER ───────────────────────────────────────────────────
// Check if a generated program hits volume targets

export function checkProgramVolume(program, level = 'intermediate') {
  const volumeByMuscle = {};
  const targets = getVolumeTargets(level);

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
  Object.entries(targets).forEach(([muscle, t]) => {
    const actual = volumeByMuscle[muscle] || 0;
    report[muscle] = {
      actual,
      min: t.min,
      optimal_low: t.optimal_low,
      optimal_high: t.optimal_high,
      status: actual < t.min ? 'below_minimum'
        : actual < t.optimal_low ? 'below_optimal'
        : actual <= t.optimal_high ? 'optimal'
        : 'above_optimal',
    };
  });

  return report;
}