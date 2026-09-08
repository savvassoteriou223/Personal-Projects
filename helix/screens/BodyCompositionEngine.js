// ─── BODY COMPOSITION ENGINE ──────────────────────────────────────────────────
// Research-backed weight trend analysis, projection, and pace feedback.
//
// Sources:
// Kanellakis et al. (2023) Am J Hum Biol — menstrual cycle weight fluctuation ~0.5kg, peaks day 1 flow
// White et al. (2011) PMC3154522 — 765 cycles, fluid retention patterns across cycle
// Stein-Brüggemann et al. (2025) Eur J Sport Sci PMC12009753 — BC estimates and MC phases
// Helms et al. — optimal lean bulk rate 0.25% body weight/week for intermediate+
// CDC/ACSM consensus — 0.5–1.0 kg/week safe fat loss range
// ScienceDirect meta-analysis (2024) — protein >1.3g/kg prevents muscle decline during cut
// Hall KD (2024) Obesity 32(6) — metabolic adaptation after 10% body weight loss
// Springer systematic review (2024) — daily self-weighing significantly more effective than weekly

// ─── PACE THRESHOLDS ─────────────────────────────────────────────────────────
// Rate of change benchmarks per goal, per training level

export const PACE_THRESHOLDS = {
  lose: {
    tooSlow:    { max: 0.15, label: 'Too slow',    color: '#9494A0', message: "Less than 0.15kg/week. You may not be in a meaningful deficit — check your calorie tracking." },
    optimal:    { min: 0.15, max: 0.75, label: 'Optimal', color: '#1D9E75', message: "Losing fat at a sustainable pace while preserving muscle. Keep going." },
    fast:       { min: 0.75, max: 1.0,  label: 'Fast',     color: '#BA7517', message: "Approaching the upper limit of safe fat loss. Make sure protein is high (>1.6g/kg) to protect muscle." },
    tooFast:    { min: 1.0,  label: 'Too fast',   color: '#E85D5C', message: "Above 1kg/week consistently. Research shows 20–40% of this may be muscle loss. Consider slowing the deficit." },
    // Kanellakis 2023: menstrual cycle causes ~0.5kg fluctuation
    // A spike of 0.5–1.5kg with no calorie change is likely water
    spikeThreshold: 0.5,
  },
  gain: {
    // Rates are in kg/week. Benchmarks from Helms et al. and Ribeiro study.
    beginner: {
      tooSlow:  { max: 0.05, label: 'Very slow', color: '#9494A0', message: "Under 0.05kg/week. Likely not in a sufficient surplus to drive muscle growth." },
      optimal:  { min: 0.05, max: 0.25, label: 'Optimal lean bulk', color: '#1D9E75', message: "Gaining at a lean bulk pace. Most weight gain should be muscle." },
      fast:     { min: 0.25, max: 0.4,  label: 'Fast',  color: '#BA7517', message: "Gaining quickly. Fine for beginners but monitor fat accumulation." },
      tooFast:  { min: 0.4,  label: 'Too fast', color: '#E85D5C', message: "Above 0.4kg/week. Research shows faster rates primarily increase fat, not muscle. Consider slowing." },
    },
    intermediate: {
      tooSlow:  { max: 0.03, label: 'Very slow', color: '#9494A0', message: "Under 0.03kg/week. May not be in enough of a surplus for consistent muscle growth." },
      optimal:  { min: 0.03, max: 0.12, label: 'Optimal lean bulk', color: '#1D9E75', message: "Lean bulk pace for intermediate lifters. Good balance of muscle gain vs fat." },
      fast:     { min: 0.12, max: 0.2,  label: 'Fast',  color: '#BA7517', message: "Gaining faster than typical for your level. Watch fat accumulation." },
      tooFast:  { min: 0.2,  label: 'Too fast', color: '#E85D5C', message: "Gaining too fast for an intermediate. More than half of this is likely fat. Slow to 0.06–0.12kg/week." },
    },
    advanced: {
      tooSlow:  { max: 0.01, label: 'Very slow', color: '#9494A0', message: "Gains slow down significantly at advanced level. This may be appropriate." },
      optimal:  { min: 0.01, max: 0.06, label: 'Optimal', color: '#1D9E75', message: "Appropriate gain rate for an advanced lifter. Muscle growth is slow but real." },
      fast:     { min: 0.06, max: 0.15, label: 'Fast', color: '#BA7517', message: "Gaining faster than expected for advanced level. Likely accumulating more fat than muscle." },
      tooFast:  { min: 0.15, label: 'Too fast', color: '#E85D5C', message: "Advanced lifters gain muscle very slowly. Rates this high are primarily fat." },
    },
  },
  maintain: {
    maintained:  { min: -0.15, max: 0.15, label: 'Maintaining', color: '#1D9E75', message: "Weight is stable. Maintenance is working." },
    drifting:    { label: 'Drifting', color: '#BA7517', message: "Weight is slowly shifting outside maintenance range." },
  },
};

// ─── CORE CALCULATIONS ────────────────────────────────────────────────────────

/**
 * Compute 7-day moving average from array of { date, weight_kg } entries.
 * Input should be sorted newest first (as Supabase returns with order desc).
 * Returns array sorted oldest first: [{ date, raw, avg7 }]
 *
 * Research: 7-day window balances noise reduction with responsiveness.
 * Weekly weighing misses trend nuance; daily with 7-day avg is optimal.
 * (Springer systematic review 2024, Happy Scale methodology)
 */
export function computeMovingAverage(metrics = [], windowDays = 7) {
  if (!metrics.length) return [];

  // Sort oldest first for the rolling calc
  const sorted = [...metrics]
    .filter(m => m.weight_kg && m.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return sorted.map((entry, i) => {
    // Window: look back windowDays entries from this point
    const start = Math.max(0, i - windowDays + 1);
    const window = sorted.slice(start, i + 1);
    const avg = window.reduce((sum, e) => sum + e.weight_kg, 0) / window.length;
    return {
      date: entry.date,
      raw: entry.weight_kg,
      avg7: Math.round(avg * 10) / 10,
    };
  });
}

/**
 * Calculate weekly rate of change from moving averages.
 * Compares last 7-day avg to 7-day avg from 7 days ago.
 * Returns kg/week (negative = losing, positive = gaining).
 */
export function computeWeeklyRate(movingAvgs = []) {
  if (movingAvgs.length < 7) return null;
  const latest = movingAvgs[movingAvgs.length - 1].avg7;
  const weekAgo = movingAvgs[movingAvgs.length - 8]?.avg7
    ?? movingAvgs[0].avg7;
  return Math.round((latest - weekAgo) * 100) / 100;
}

/**
 * Project weeks to reach target weight at current rate.
 * Returns { weeks, targetDate } or null if rate is moving away from target.
 */
export function projectWeeksToTarget(currentAvg, targetWeight, weeklyRate) {
  if (!currentAvg || !targetWeight || !weeklyRate) return null;
  const gap = targetWeight - currentAvg;
  // Rate must be in the right direction
  if (gap > 0 && weeklyRate <= 0) return null; // trying to gain but losing
  if (gap < 0 && weeklyRate >= 0) return null; // trying to lose but gaining
  const weeks = Math.abs(gap / weeklyRate);
  if (weeks > 200) return null; // too far out to be meaningful
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Math.round(weeks * 7));
  return {
    weeks: Math.round(weeks),
    targetDate: targetDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
  };
}

/**
 * Classify current rate of change against research-backed pace thresholds.
 * Returns { label, color, message, pace: 'optimal'|'tooSlow'|'fast'|'tooFast'|'maintained'|'drifting' }
 */
export function classifyPace(weeklyRate, goals = [], trainingLevel = 'intermediate') {
  if (weeklyRate === null) return null;
  const absRate = Math.abs(weeklyRate);

  const isLosing = goals.includes('lose');
  const isGaining = goals.includes('gain') || goals.includes('strength') || goals.includes('aesthetics');
  const isMaintaining = goals.includes('maintain') || (!isLosing && !isGaining);

  if (isLosing) {
    const t = PACE_THRESHOLDS.lose;
    if (absRate < t.tooSlow.max) return { ...t.tooSlow, pace: 'tooSlow' };
    if (absRate <= t.fast.min) return { ...t.optimal, pace: 'optimal' };
    if (absRate <= t.tooFast.min) return { ...t.fast, pace: 'fast' };
    return { ...t.tooFast, pace: 'tooFast' };
  }

  if (isGaining) {
    const level = trainingLevel === 'beginner' ? 'beginner'
      : trainingLevel === 'advanced' ? 'advanced' : 'intermediate';
    const t = PACE_THRESHOLDS.gain[level];
    if (absRate < t.tooSlow.max) return { ...t.tooSlow, pace: 'tooSlow' };
    if (absRate <= t.fast.min) return { ...t.optimal, pace: 'optimal' };
    if (absRate <= t.tooFast.min) return { ...t.fast, pace: 'fast' };
    return { ...t.tooFast, pace: 'tooFast' };
  }

  // Maintenance
  const t = PACE_THRESHOLDS.maintain;
  if (weeklyRate >= t.maintained.min && weeklyRate <= t.maintained.max) {
    return { ...t.maintained, pace: 'maintained' };
  }
  return { ...t.drifting, pace: 'drifting',
    message: weeklyRate > 0
      ? "Slowly gaining. If this is unintentional, check calorie intake."
      : "Slowly losing. If unintentional, consider eating slightly more." };
}

/**
 * Detect a likely hormonal water retention spike.
 * Flags when weight rises >0.5kg in 1–2 days with no logged calorie surplus.
 * Research: Kanellakis et al. (2023) — menstrual cycle spike avg 0.5kg, range 0–1.5kg.
 * Returns true if spike detected.
 */
export function detectWaterRetentionSpike(movingAvgs = [], sex = 'male') {
  if (sex !== 'female' || movingAvgs.length < 3) return false;
  const latest = movingAvgs[movingAvgs.length - 1];
  const twoDaysAgo = movingAvgs[movingAvgs.length - 3];
  if (!latest || !twoDaysAgo) return false;
  const delta = latest.raw - twoDaysAgo.raw;
  return delta >= PACE_THRESHOLDS.lose.spikeThreshold;
}

/**
 * Infer training level from profile (weeks training, strength level).
 * Used for pace threshold selection when bulking.
 */
export function inferTrainingLevel(profile = {}) {
  // Use program_start_date as proxy — very rough but better than nothing
  if (!profile.program_start_date) return 'intermediate';
  const weeksTraining = Math.floor(
    (new Date() - new Date(profile.program_start_date)) / (7 * 86400000)
  );
  if (weeksTraining < 26) return 'beginner';     // < 6 months
  if (weeksTraining < 104) return 'intermediate'; // 6 months – 2 years
  return 'advanced';
}

/**
 * Infer current trend from rate of change, regardless of stated goal.
 * Returns 'cutting' | 'maintaining' | 'gaining'
 */
export function inferTrend(weeklyRate) {
  if (weeklyRate === null) return null;
  if (weeklyRate < -0.15) return 'cutting';
  if (weeklyRate > 0.15) return 'gaining';
  return 'maintaining';
}

/**
 * Full body composition analysis — main entry point.
 * Takes raw metrics array and profile, returns all computed values.
 */
export function analyseBodyComposition(metrics = [], profile = {}) {
  if (metrics.length < 2) return null;

  const movingAvgs = computeMovingAverage(metrics);
  const currentAvg = movingAvgs[movingAvgs.length - 1]?.avg7 ?? null;
  const weeklyRate = computeWeeklyRate(movingAvgs);
  const targetWeight = profile.target_weight_kg ?? null;
  const goals = profile.goals || [];
  const sex = profile.sex || 'male';
  const trainingLevel = inferTrainingLevel(profile);

  const projection = targetWeight && weeklyRate !== null
    ? projectWeeksToTarget(currentAvg, targetWeight, weeklyRate)
    : null;

  const pace = weeklyRate !== null
    ? classifyPace(weeklyRate, goals, trainingLevel)
    : null;

  const trend = inferTrend(weeklyRate);
  const waterSpike = detectWaterRetentionSpike(movingAvgs, sex);

  // Alert: losing too fast
  const muscleLossRisk = goals.includes('lose') && weeklyRate !== null && weeklyRate < -1.0;

  // Alert: gaining too fast
  const excessFatRisk = (goals.includes('gain') || goals.includes('aesthetics'))
    && weeklyRate !== null
    && (trainingLevel === 'intermediate' ? weeklyRate > 0.2 : weeklyRate > 0.3);

  // Alert: no movement while trying to change
  const stalled = weeklyRate !== null && Math.abs(weeklyRate) < 0.1
    && (goals.includes('lose') || goals.includes('gain'));

  return {
    movingAvgs,           // [{ date, raw, avg7 }] for chart
    currentAvg,           // current 7-day average weight
    weeklyRate,           // kg/week rate of change
    trend,                // 'cutting' | 'maintaining' | 'gaining'
    pace,                 // { label, color, message, pace }
    projection,           // { weeks, targetDate } or null
    waterSpike,           // boolean — likely hormonal spike
    muscleLossRisk,       // boolean — losing too fast
    excessFatRisk,        // boolean — gaining too fast
    stalled,              // boolean — no movement
    trainingLevel,        // 'beginner' | 'intermediate' | 'advanced'
    dataPoints: metrics.length,
  };
}
