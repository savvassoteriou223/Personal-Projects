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
  // Traps are their own recovery group. Folding them into `back` meant the
  // trapezius shape on the body map was painted by the back value, so a day of
  // rows and pulldowns lit the traps red and skipping shrugs could never turn
  // them green. Only the upper trapezius splits off: it is the sole primary
  // mover of the `upper_traps` pattern (shrugs). Mid-traps and rhomboids stay
  // on `back` — they are only ever secondaries of rows, never muscles[0], so
  // attribution is unaffected either way.
  if (['traps', 'upper traps', 'trapezius', 'upper trapezius',
       'levator scapulae'].includes(r)) return 'traps';
  if (['lats', 'mid-traps', 'mid traps', 'rhomboids', 'lower back',
       'teres'].includes(r)) return 'back';
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
 * The muscle a set trained. Exact library name first: the stored pattern_key
 * goes stale when a slot's exercise is swapped (the name changes, the slot
 * keeps the old pattern — production rows had "Seated leg curl" saved under
 * squat_pattern). A name that matches the library IS the library entry, so its
 * own pattern wins; pattern_key remains the fallback for renamed/custom names.
 */
export function primaryMuscleFor(exerciseName, patternKey) {
  const byName = EXERCISE_PRIMARY_MAP[String(exerciseName || '').toLowerCase()];
  if (byName) return byName;
  const pattern = patternKey && MOVEMENT_PATTERNS[patternKey];
  return pattern ? normaliseMuscle(pattern.muscles[0]) : null;
}

// Two sets of direct work is training a muscle. The gate exists so a single
// incidental set does not light the map up, but attribution is already
// primary-mover only — it previously demanded two different exercises OR five
// sets, which filtered out three hard sets of calves as if they never happened.
export const MIN_SETS_TO_COUNT = 2;

// Days until ready to retrain. Schoenfeld et al. 2016 + fibre-type composition.
export const MUSCLE_RECOVERY_DAYS = {
  abs: 1, calves: 1, forearms: 1,
  biceps: 2, triceps: 2, shoulders: 2, chest: 2, glutes: 2, traps: 2,
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
 * Is this row a set that was actually performed?
 *
 * Mirrors the predicate in screens/volumeEngine.js. Recovery counted raw rows
 * while volume filtered them, so the two disagreed on what a set is: two
 * warm-up sets of rows marked the back trained, and a set toggled done but
 * left blank did the same. Drop sets and sets to failure ARE working sets.
 * Weight alone may legitimately be absent (every bodyweight exercise), so a
 * blank set is one missing BOTH reps and weight.
 */
function isPerformedSet(s) {
  if (s.set_type === 'warmup') return false;
  const noReps = s.reps === null || s.reps === undefined || s.reps === 0;
  const noWeight = s.weight_kg === null || s.weight_kg === undefined;
  return !(noReps && noWeight);
}

/**
 * When each muscle was last trained.
 *
 * sets:        [{ exercise_name, pattern_key, session_id, reps, weight_kg, set_type }]
 * sessionDates: { session_id: Date }
 */
export function lastTrainedPerMuscle(sets = [], sessionDates = {}) {
  const perSession = {};
  for (const set of sets) {
    if (!isPerformedSet(set)) continue;
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
