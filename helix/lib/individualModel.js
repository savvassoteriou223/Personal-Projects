// Adaptive Response Engine — Individual Response Model (IRM), v1.
// Pure functions, no API calls. Estimates per-lift ADAPTATION RATE (kg/week trend of
// estimated 1RM) from passively-logged sets, each with an honest CONFIDENCE so downstream
// steps (value-of-information, experiment design) know what to trust and what is still
// unknown. See docs/specs/adaptive-response-engine.md.

const DAY = 86400000;

// Epley estimated 1RM. reps === 1 → the weight itself.
function est1RM(weightKg, reps) {
  if (!weightKg || !reps || reps < 1) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

// Group sets by exercise; collapse each calendar day to that day's BEST est-1RM (a working
// max), returning a per-exercise time series of { t, e1rm } sorted by time.
// sets: [{ exercise_name, weight_kg, reps, completed_at }]
function sessionBestSeriesByExercise(sets) {
  const byEx = {};
  for (const s of sets || []) {
    const e = est1RM(s.weight_kg, s.reps);
    if (e == null || !s.exercise_name || !s.completed_at) continue;
    const t = new Date(s.completed_at).getTime();
    if (!Number.isFinite(t)) continue;
    const day = Math.floor(t / DAY);
    const ex = (byEx[s.exercise_name] ||= {});
    if (!ex[day] || e > ex[day].e1rm) ex[day] = { t, e1rm: e };
  }
  const out = {};
  for (const [name, days] of Object.entries(byEx)) {
    out[name] = Object.values(days).sort((a, b) => a.t - b.t);
  }
  return out;
}

// Ordinary least-squares slope + R² for [x, y] points. null if fewer than 2 distinct x.
function linreg(points) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of points) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null; // all x identical — no time span
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const meanY = sy / n;
  let ssTot = 0, ssRes = 0;
  for (const [x, y] of points) {
    const yp = slope * x + intercept;
    ssRes += (y - yp) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

// Confidence in [0,1] from data sufficiency + fit quality. Deliberately conservative:
// below the session/span floors it returns 0 ("not enough signal yet"), so the engine
// never pretends to know your response from three noisy data points.
function confidence({ sessions, spanWeeks, r2 }) {
  if (sessions < 4 || spanWeeks < 2) return 0;
  const nComponent = Math.min(1, (sessions - 3) / 6);     // saturates ~9 sessions
  const spanComponent = Math.min(1, (spanWeeks - 1) / 5); // saturates ~6 weeks
  const fitComponent = Math.max(0, Math.min(1, r2));      // noisy series → low confidence
  return +(nComponent * 0.4 + spanComponent * 0.3 + fitComponent * 0.3).toFixed(3);
}

// Per-exercise adaptation rate (kg/week) with confidence.
// Returns { [exercise]: { ratePerWeek, sessions, spanWeeks, r2, confidence } }.
// A confidence of 0 means "unknown — do not coach off this yet".
export function computeAdaptationRates(sets, { minConfidence = 0 } = {}) {
  const series = sessionBestSeriesByExercise(sets);
  const out = {};
  for (const [name, pts] of Object.entries(series)) {
    if (pts.length < 2) continue;
    const t0 = pts[0].t;
    const xy = pts.map(p => [(p.t - t0) / (7 * DAY), p.e1rm]); // x: weeks, y: kg
    const fit = linreg(xy);
    if (!fit) continue;
    const spanWeeks = (pts[pts.length - 1].t - t0) / (7 * DAY);
    const conf = confidence({ sessions: pts.length, spanWeeks, r2: fit.r2 });
    if (conf < minConfidence) continue;
    out[name] = {
      ratePerWeek: +fit.slope.toFixed(2),
      sessions: pts.length,
      spanWeeks: +spanWeeks.toFixed(1),
      r2: +fit.r2.toFixed(3),
      confidence: conf,
    };
  }
  return out;
}

// Performance-signature readiness — no wearable (spec §9). For each lift, fit the trend on
// its ESTABLISHED history (excluding the most recent `window` sessions), predict the recent
// sessions, and measure how far actual fell below prediction. Persistent negative deviation
// = the user is underperforming their own trajectory = accumulated fatigue. Fitting on the
// older data (not all of it) is what lets the recent window actually deviate.
export function computeFatigueSignature(sets, { window = 2 } = {}) {
  const series = sessionBestSeriesByExercise(sets);
  const devs = [];
  let lifts = 0;
  for (const pts of Object.values(series)) {
    const older = pts.slice(0, -window);
    const recent = pts.slice(-window);
    if (older.length < 4 || recent.length < 1) continue;
    const t0 = older[0].t;
    const fit = linreg(older.map(p => [(p.t - t0) / (7 * DAY), p.e1rm]));
    if (!fit) continue;
    lifts++;
    for (const p of recent) {
      const predicted = fit.slope * ((p.t - t0) / (7 * DAY)) + fit.intercept;
      if (predicted > 0) devs.push((p.e1rm - predicted) / predicted);
    }
  }
  if (devs.length < 2) return { score: null, deviationPct: null, label: null, lifts };
  const mean = devs.reduce((a, b) => a + b, 0) / devs.length;
  return {
    score: +Math.max(0, Math.min(1, 1 + mean / 0.08)).toFixed(2), // 1 = on/above model, 0 = ≤-8%
    deviationPct: +(mean * 100).toFixed(1),
    label: mean >= -0.02 ? 'fresh' : mean >= -0.05 ? 'moderate' : 'fatigued',
    lifts,
  };
}

// Single entry point for the app: assemble the Individual Response Model from logged sets,
// merging in any parameters already learned from past experiments (persisted elsewhere).
// This is the object the closed loop (adaptiveResponseEngine.nextAction) consumes.
export function assembleModel(sets, { learned = {} } = {}) {
  return {
    adaptationRates: computeAdaptationRates(sets, { minConfidence: 0.3 }),
    fatigue: computeFatigueSignature(sets),
    learned, // grows as the engine runs experiments; empty for a new user
  };
}

// Exposed for unit tests only.
export const _internal = { est1RM, sessionBestSeriesByExercise, linreg, confidence };
