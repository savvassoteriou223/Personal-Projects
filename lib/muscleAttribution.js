// Muscle attribution for completed sets.
//
// A completed set is saved with both an `exercise_name` and a durable
// `pattern_key` (see WorkoutExecutionScreen.saveWorkout). The pattern_key is the
// authoritative link to MOVEMENT_PATTERNS — it survives display-name variants,
// coach swaps and library renames. Volume/recovery UI must attribute muscles from
// the pattern_key first and only fall back to the exercise name, otherwise any set
// whose saved name isn't an exact library key registers under NO muscle and
// silently vanishes from every chart.

import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';

// The 10 tracked muscle groups shown in the volume/recovery UI.
export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs',
];

// Map a raw anatomical muscle string (as authored in movementLibrary) onto one of
// the tracked groups, or null when it isn't tracked (e.g. forearms, adductors —
// there is no volume target for those). This list must cover EVERY muscle string
// that appears in MOVEMENT_PATTERNS; the muscleAttribution test guards that.
export function normaliseMuscle(raw) {
  const r = String(raw || '').toLowerCase().trim();
  if (['chest', 'upper chest', 'mid chest', 'lower chest'].includes(r)) return 'chest';
  if (['lats', 'traps', 'mid-traps', 'mid traps', 'upper traps', 'upper trapezius',
       'levator scapulae', 'rhomboids', 'lower back', 'teres'].includes(r)) return 'back';
  if (['shoulders', 'delts', 'deltoids', 'anterior delts', 'front delts',
       'side deltoids', 'side delts', 'medial delts', 'lateral delts',
       'rear delts', 'rear deltoids', 'external rotators'].includes(r)) return 'shoulders';
  if (['biceps', 'brachialis'].includes(r)) return 'biceps';
  if (['triceps'].includes(r)) return 'triceps';
  if (['quads', 'quadriceps'].includes(r)) return 'quads';
  if (['hamstrings'].includes(r)) return 'hamstrings';
  if (['glutes', 'glute medius', 'glute minimus', 'gluteus maximus'].includes(r)) return 'glutes';
  if (['gastrocnemius', 'soleus', 'calves'].includes(r)) return 'calves';
  if (['rectus abdominis', 'obliques', 'abs', 'core'].includes(r)) return 'abs';
  return null; // untracked (e.g. forearms: flexors/extensors/brachioradialis, adductors)
}

// exercise-name (lowercased) → its pattern's raw muscle strings. Fallback for sets
// with no saved pattern_key (legacy rows).
const EXERCISE_MUSCLE_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach((pattern) => {
    pattern.exercises.forEach((ex) => { map[ex.name.toLowerCase()] = pattern.muscles; });
  });
  return map;
})();

// Tracked muscle groups a completed set trained. Prefers the durable pattern_key;
// falls back to the exercise name for legacy rows that predate pattern_key.
export function exerciseMuscleGroups(exerciseName, patternKey) {
  const raw = (patternKey && MOVEMENT_PATTERNS[patternKey])
    ? MOVEMENT_PATTERNS[patternKey].muscles
    : (EXERCISE_MUSCLE_MAP[String(exerciseName || '').toLowerCase()] || []);
  return [...new Set(raw.map(normaliseMuscle).filter(Boolean))];
}

export function matchesMuscle(exerciseName, patternKey, muscle) {
  return exerciseMuscleGroups(exerciseName, patternKey).includes(String(muscle || '').toLowerCase());
}
