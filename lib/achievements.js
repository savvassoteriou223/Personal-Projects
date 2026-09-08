// ─── WHAT A SESSION EARNED ──────────────────────────────────────────────────
//
// The "reward system", such as it is. There is no badge shelf and no unlock
// table: a reward nobody sees motivates nobody, so the only thing an
// achievement does here is decide the headline on a shareable sticker.
//
// One headline per session, never four. `detectAchievement` walks a fixed
// priority ladder and returns the rarest TRUE thing that happened. The last
// rung is always reachable, so the ladder never returns nothing and never
// invents a compliment — a card that praises every session is one nobody
// believes by the third.
//
// Everything here is pure. Callers fetch the history; this only judges it.

import { epley1RM } from './epley';

// Streak lengths worth announcing. Every-week milestones would make the
// headline meaningless by week three, so it thins out as it grows.
export const STREAK_MILESTONES = [4, 8, 12, 16, 20, 26, 39, 52, 78, 104];

// A session has to beat its predecessors by more than rounding to count as
// "heaviest" — three extra kilos on twelve tonnes is not a story.
const HEAVIEST_MARGIN = 1.03;
// …and it needs something to beat. One prior session of a type is not a record.
const HEAVIEST_MIN_HISTORY = 3;

/**
 * The best working set of each exercise in a finished session.
 * Warm-ups are excluded — a warm-up cannot set a record.
 *
 * `sets` is the in-memory WorkoutExecutionScreen shape:
 *   [{ name, completedSets: [{ weight, reps, done, type }] }]
 *
 * Returns { [exerciseName]: { weight, reps, e1rm } }.
 */
export function bestWorkingSets(sets) {
  const out = {};
  (sets || []).forEach(ex => {
    if (!ex?.name) return;
    (ex.completedSets || []).forEach(s => {
      if (!s.done || s.type === 'warmup') return;
      const weight = parseFloat(s.weight) || 0;
      const reps = parseInt(s.reps) || 0;
      if (weight <= 0 || reps <= 0) return;
      const prev = out[ex.name];
      // Heaviest wins; reps break the tie. That is the set someone would name
      // if you asked what they did on the exercise.
      if (!prev || weight > prev.weight || (weight === prev.weight && reps > prev.reps)) {
        out[ex.name] = { weight, reps, e1rm: epley1RM(weight, reps) };
      }
    });
  });
  return out;
}

/** Total working tonnage of a session, in kg. Warm-ups excluded. */
export function sessionVolume(sets) {
  let kg = 0;
  (sets || []).forEach(ex => (ex.completedSets || []).forEach(s => {
    if (!s.done || s.type === 'warmup') return;
    kg += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
  }));
  return Math.round(kg);
}

/**
 * Decide the session's headline.
 *
 * @param {object[]} sets          in-memory session (see bestWorkingSets)
 * @param {object}   priorBests    { [exerciseName]: { weight, reps } } — heaviest
 *                                 ever logged BEFORE this session. Absent name =
 *                                 first time, which is never a PR: everything is
 *                                 a record the first time you do it.
 * @param {number}   streakWeeks   consecutive weeks trained, including this one
 * @param {number[]} priorVolumes  tonnage of previous sessions of the SAME day,
 *                                 most recent first
 * @param {string}   focus         the day's muscles, e.g. "Chest · Shoulders"
 *
 * @returns {{type: string, ...}} always a value; `type` is one of
 *          'pr' | 'streak' | 'heaviest' | 'muscles'
 */
export function detectAchievement({ sets, priorBests = {}, streakWeeks = 0, priorVolumes = [], focus = '' } = {}) {
  // ── 1 · a personal record ────────────────────────────────────────────────
  // Compared on weight, not estimated 1RM: "I benched 85" is the thing people
  // say, and an e1RM record set by grinding two extra reps at a lighter weight
  // reads as a lie on a sticker even when the maths is sound.
  const bests = bestWorkingSets(sets);
  let pr = null;
  Object.entries(bests).forEach(([name, cur]) => {
    const prev = priorBests[name];
    if (!prev || !(prev.weight > 0)) return;          // first-ever ≠ record
    if (cur.weight <= prev.weight) return;
    const gain = cur.weight - prev.weight;
    if (!pr || gain > pr.gainKg) {
      pr = {
        type: 'pr',
        exercise: name,
        weight: cur.weight,
        reps: cur.reps,
        prevWeight: prev.weight,
        prevReps: prev.reps ?? null,
        gainKg: Math.round(gain * 10) / 10,
        e1rm: Math.round(cur.e1rm),
      };
    }
  });
  if (pr) return pr;

  // ── 2 · a streak milestone ───────────────────────────────────────────────
  if (STREAK_MILESTONES.includes(streakWeeks)) {
    return { type: 'streak', weeks: streakWeeks };
  }

  // ── 3 · the heaviest session of its kind ─────────────────────────────────
  const volume = sessionVolume(sets);
  const history = (priorVolumes || []).filter(v => v > 0);
  if (volume > 0 && history.length >= HEAVIEST_MIN_HISTORY) {
    const best = Math.max(...history);
    if (volume > best * HEAVIEST_MARGIN) {
      const mean = history.reduce((n, v) => n + v, 0) / history.length;
      return {
        type: 'heaviest',
        volumeKg: volume,
        sessions: history.length,
        // Percent over the running average, which is a fairer claim than
        // "beat your best" when the best was a single outlier.
        overAveragePct: Math.round(((volume - mean) / mean) * 100),
      };
    }
  }

  // ── 4 · nothing rare happened, and that is fine ──────────────────────────
  return { type: 'muscles', focus, volumeKg: volume };
}

/**
 * Consecutive weeks containing at least one session, counting the current week.
 * Same definition Profile and the Coach use, so a shared number never disagrees
 * with the one in the app.
 *
 * @param {string[]} completedAt ISO timestamps, any order
 * @param {Date}     now
 */
export function streakWeeks(completedAt = [], now = new Date()) {
  const weekKey = d => {
    const x = new Date(d);
    // Monday-based, matching startOfWeek({ weekStartsOn: 1 }) elsewhere.
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };

  const weeks = new Set();
  completedAt.forEach(t => {
    const ms = new Date(t).getTime();
    if (Number.isFinite(ms)) weeks.add(weekKey(ms));
  });

  const thisWeek = weekKey(now);
  let streak = 0;
  let cursor = thisWeek;
  while (weeks.has(cursor)) {
    streak++;
    cursor -= 7 * 86400000;
  }
  return streak;
}
