/**
 * recoveryMap — the muscle-recovery calculation, extracted so it can be tested.
 *
 * This lived inline inside TodayScreen, which meant the heat map on the home
 * screen — one of the app's two headline visuals — had no test of any kind. A
 * user logged five sets of calves across two movements and the map showed calves
 * fresh; the gate demanded two DIFFERENT exercises or five sets, and the swapped
 * movement had been filed under the muscle it replaced. Neither could be caught
 * without running this, and nothing could run it.
 *
 * Pure: sets and session dates in, recovery map out.
 */
import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';

// Raw library muscle string → the muscle key the heat map draws.
export function normaliseMuscle(raw) {
  const r = String(raw || '').toLowerCase().trim();
  if (['chest', 'upper chest', 'mid chest', 'lower chest'].includes(r)) return 'chest';
  if (['lats', 'traps', 'upper traps', 'upper trapezius', 'levator scapulae',
       'mid-traps', 'mid traps', 'rhomboids', 'lower back', 'teres'].includes(r)) return 'back';
  if (['shoulders', 'delts', 'deltoids', 'anterior delts', 'front delts',
       'side deltoids', 'side delts', 'medial delts', 'lateral delts',
       'rear delts', 'rear deltoids'].includes(r)) return 'shoulders';
  if (['biceps', 'brachialis'].includes(r)) return 'biceps';
  if (r === 'triceps') return 'triceps';
  if (r === 'quads' || r === 'quadriceps') return 'quads';
  if (r === 'hamstrings') return 'hamstrings';
  if (['glutes', 'glute medius', 'glute minimus', 'gluteus maximus'].includes(r)) return 'glutes';
  if (['gastrocnemius', 'soleus', 'calves'].includes(r)) return 'calves';
  if (['rectus abdominis', 'obliques', 'abs', 'core'].includes(r)) return 'abs';
  if (['forearms', 'brachioradialis', 'wrist flexors', 'wrist extensors'].includes(r)) return 'forearms';
  return null;
}

const EXERCISE_PRIMARY_MAP = (() => {
  const map = {};
  for (const pattern of Object.values(MOVEMENT_PATTERNS)) {
    const primary = normaliseMuscle(pattern.muscles[0]);
    if (primary) for (const ex of pattern.exercises) map[ex.name.toLowerCase()] = primary;
  }
  return map;
})();

/**
 * The muscle a set trained. pattern_key first: it is the durable link and
 * survives coach swaps, mid-workout replacements and library renames. The name
 * is the fallback for rows written before pattern_key existed.
 */
export function primaryMuscleFor(exerciseName, patternKey) {
  const pattern = patternKey && MOVEMENT_PATTERNS[patternKey];
  if (pattern) return normaliseMuscle(pattern.muscles[0]);
  return EXERCISE_PRIMARY_MAP[String(exerciseName || '').toLowerCase()] || null;
}

// Two sets of direct work is training a muscle. The gate exists so a single
// incidental set does not light the map up, but attribution is already
// primary-mover only — it previously demanded two different exercises OR five
// sets, which filtered out three hard sets of calves as if they never happened.
export const MIN_SETS_TO_COUNT = 2;

// Days until ready to retrain. Schoenfeld et al. 2016 + fibre-type composition.
export const MUSCLE_RECOVERY_DAYS = {
  abs: 1, calves: 1, forearms: 1,
  biceps: 2, triceps: 2, shoulders: 2, chest: 2, glutes: 2,
  quads: 3, hamstrings: 3, back: 3,
};

export function recoveryStatus(muscle, daysSince) {
  if (daysSince === null || daysSince === undefined) return 'fresh';
  if (daysSince === 0) return 'trained_today';
  const threshold = MUSCLE_RECOVERY_DAYS[muscle] ?? 2;
  if (daysSince < threshold) return 'recovering';
  if (daysSince === threshold) return 'ready';
  return 'fresh';
}

/**
 * When each muscle was last trained.
 *
 * sets:        [{ exercise_name, pattern_key, session_id }]
 * sessionDates: { session_id: Date }
 */
export function lastTrainedPerMuscle(sets = [], sessionDates = {}) {
  const perSession = {};
  for (const set of sets) {
    const muscle = primaryMuscleFor(set.exercise_name, set.pattern_key);
    if (!muscle) continue;
    const muscles = (perSession[set.session_id] ||= {});
    const entry = (muscles[muscle] ||= { count: 0, exercises: new Set() });
    entry.count += 1;
    if (set.exercise_name) entry.exercises.add(String(set.exercise_name).toLowerCase());
  }

  const last = {};
  for (const [sessionId, muscles] of Object.entries(perSession)) {
    const date = sessionDates[sessionId];
    if (!date) continue;
    for (const [muscle, entry] of Object.entries(muscles)) {
      if (entry.count < MIN_SETS_TO_COUNT) continue;
      if (!last[muscle] || date > last[muscle]) last[muscle] = date;
    }
  }
  return last;
}

const DAY_MS = 86400000;

/** The map the body heat map renders: muscle → { daysSince, status, lastDate }. */
export function buildRecoveryMap(sets, sessionDates, muscles, today = new Date()) {
  const last = lastTrainedPerMuscle(sets, sessionDates);
  const out = {};
  for (const muscle of muscles) {
    const lastDate = last[muscle] || null;
    // Whole days elapsed, floored — training yesterday evening and checking this
    // morning is 1 day, not 0.
    const daysSince = lastDate
      ? Math.floor((new Date(today).setHours(0, 0, 0, 0) - new Date(lastDate).setHours(0, 0, 0, 0)) / DAY_MS)
      : null;
    out[muscle] = { daysSince, status: recoveryStatus(muscle, daysSince), lastDate };
  }
  return out;
}
