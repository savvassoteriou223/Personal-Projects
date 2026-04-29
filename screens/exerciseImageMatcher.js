// exerciseImageMatcher.js
// Maps your movementLibrary exercise names → free-exercise-db image URLs
// Images hosted free on GitHub, no API key needed.
// Each exercise has 2 images: /0.jpg (start) and /1.jpg (end position)

const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// Manual map: your exercise name (lowercase) → free-exercise-db folder name
// Covers the most common gym exercises. Add more as needed.
const EXERCISE_MAP = {
  // CHEST
  'barbell bench press':            'Barbell_Bench_Press_-_Medium_Grip',
  'bench press':                    'Barbell_Bench_Press_-_Medium_Grip',
  'incline barbell bench press':    'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'incline bench press':            'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'decline bench press':            'Barbell_Decline_Bench_Press',
  'dumbbell bench press':           'Dumbbell_Bench_Press',
  'incline dumbbell press':         'Dumbbell_Incline_Bench_Press',
  'dumbbell flyes':                 'Dumbbell_Flyes',
  'incline dumbbell flyes':         'Dumbbell_Incline_Flyes',
  'cable fly':                      'Cable_Cross-Over',
  'cable crossover':                'Cable_Cross-Over',
  'chest dip':                      'Chest_Dip',
  'push up':                        'Push-up',
  'push-up':                        'Push-up',
  'pushup':                         'Push-up',

  // BACK
  'deadlift':                       'Barbell_Deadlift',
  'barbell deadlift':               'Barbell_Deadlift',
  'romanian deadlift':              'Romanian_Deadlift',
  'barbell row':                    'Bent_Over_Barbell_Row',
  'bent over barbell row':          'Bent_Over_Barbell_Row',
  'bent over row':                  'Bent_Over_Barbell_Row',
  'dumbbell row':                   'Dumbbell_Bent_Over_Row',
  'single arm dumbbell row':        'Dumbbell_Bent_Over_Row',
  'pull up':                        'Pullups',
  'pull-up':                        'Pullups',
  'pullup':                         'Pullups',
  'chin up':                        'Chin-up',
  'chin-up':                        'Chin-up',
  'lat pulldown':                   'Wide-Grip_Lat_Pulldown',
  'wide grip lat pulldown':         'Wide-Grip_Lat_Pulldown',
  'close grip lat pulldown':        'Close-Grip_Front_Lat_Pulldown',
  'seated cable row':               'Seated_Cable_Rows',
  'cable row':                      'Seated_Cable_Rows',
  't-bar row':                      'T-Bar_Row_with_Handle',
  'face pull':                      'Face_Pull',
  'straight arm pulldown':          'Straight-Arm_Pulldown',

  // SHOULDERS
  'overhead press':                 'Barbell_Shoulder_Press',
  'barbell overhead press':         'Barbell_Shoulder_Press',
  'military press':                 'Barbell_Shoulder_Press',
  'seated overhead press':          'Barbell_Shoulder_Press',
  'dumbbell shoulder press':        'Dumbbell_Shoulder_Press',
  'dumbbell overhead press':        'Dumbbell_Shoulder_Press',
  'arnold press':                   'Arnold_Dumbbell_Press',
  'lateral raise':                  'Side_Lateral_Raise',
  'dumbbell lateral raise':         'Side_Lateral_Raise',
  'cable lateral raise':            'Cable_Lateral_Raise',
  'front raise':                    'Dumbbell_Front_Raise',
  'rear delt fly':                  'Bent_Over_Dumbbell_Rear_Delt_Raise_with_Head_on_Bench',
  'reverse fly':                    'Bent_Over_Dumbbell_Rear_Delt_Raise_with_Head_on_Bench',
  'upright row':                    'Barbell_Upright_Row',

  // BICEPS
  'barbell curl':                   'Barbell_Curl',
  'ez bar curl':                    'EZ-Bar_Curl',
  'dumbbell curl':                  'Dumbbell_Bicep_Curl',
  'dumbbell bicep curl':            'Dumbbell_Bicep_Curl',
  'hammer curl':                    'Hammer_Curls',
  'incline dumbbell curl':          'Alternate_Incline_Dumbbell_Curl',
  'concentration curl':             'Concentration_Curls',
  'cable curl':                     'Cable_Hammer_Curls_-_Rope_Attachment',
  'preacher curl':                  'Barbell_Preacher_Curl',

  // TRICEPS
  'close grip bench press':         'Close-Grip_Barbell_Bench_Press',
  'tricep dip':                     'Triceps_Dip',
  'dip':                            'Triceps_Dip',
  'skull crusher':                  'Barbell_JM_Bench_Press',
  'ez bar skull crusher':           'Barbell_JM_Bench_Press',
  'overhead tricep extension':      'Seated_Dumbbell_Palms_In_Alternate_Bicep_Curl',
  'cable pushdown':                 'Triceps_Pushdown',
  'tricep pushdown':                'Triceps_Pushdown',
  'rope pushdown':                  'Triceps_Pushdown_-_Rope_Attachment',
  'overhead cable extension':       'Cable_Overhead_Triceps_Extension',

  // QUADS
  'squat':                          'Barbell_Full_Squat',
  'barbell squat':                  'Barbell_Full_Squat',
  'front squat':                    'Barbell_Front_Squat',
  'hack squat':                     'Barbell_Hack_Squat',
  'leg press':                      'Leg_Press',
  'lunges':                         'Barbell_Lunge',
  'lunge':                          'Barbell_Lunge',
  'dumbbell lunge':                 'Dumbbell_Lunge',
  'bulgarian split squat':          'Barbell_Step_Ups',
  'leg extension':                  'Leg_Extensions',
  'goblet squat':                   'Dumbbell_Goblet_Squat',

  // HAMSTRINGS
  'leg curl':                       'Lying_Leg_Curls',
  'lying leg curl':                 'Lying_Leg_Curls',
  'seated leg curl':                'Seated_Leg_Curl',
  'stiff leg deadlift':             'Stiff-Legged_Barbell_Deadlift',
  'good morning':                   'Good_Morning',

  // GLUTES
  'hip thrust':                     'Barbell_Hip_Thrust',
  'barbell hip thrust':             'Barbell_Hip_Thrust',
  'glute bridge':                   'Glute_Bridge',
  'cable kickback':                 'Cable_Hip_Adduction',
  'sumo deadlift':                  'Sumo_Deadlift',

  // CALVES
  'standing calf raise':            'Standing_Calf_Raises',
  'calf raise':                     'Standing_Calf_Raises',
  'seated calf raise':              'Seated_Calf_Raise',
  'donkey calf raise':              'Donkey_Calf_Raises',

  // ABS
  'crunch':                         'Crunch',
  'cable crunch':                   'Cable_Crunch',
  'plank':                          'Plank',
  'hanging leg raise':              'Hanging_Leg_Raise',
  'leg raise':                      'Flat_Bench_Lying_Leg_Raise',
  'russian twist':                  'Russian_Twist',
  'ab wheel rollout':               'Ab_Roller',
};

/**
 * Normalise a name for fuzzy matching:
 * lowercase, strip punctuation, collapse spaces
 */
function normalise(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get image URLs for an exercise name.
 * Returns { start, end } or null if no match found.
 *
 * Usage:
 *   const imgs = getExerciseImages('Barbell Bench Press');
 *   imgs.start → URL of start position image
 *   imgs.end   → URL of end position image
 */
export function getExerciseImages(exerciseName) {
  if (!exerciseName) return null;

  const key = normalise(exerciseName);

  // 1. Direct map lookup
  let folder = EXERCISE_MAP[key];

  // 2. Partial match fallback — find first map key that the input contains or vice versa
  if (!folder) {
    for (const [mapKey, mapFolder] of Object.entries(EXERCISE_MAP)) {
      if (key.includes(mapKey) || mapKey.includes(key)) {
        folder = mapFolder;
        break;
      }
    }
  }

  if (!folder) return null;

  return {
    start: `${BASE_URL}/${folder}/0.jpg`,
    end:   `${BASE_URL}/${folder}/1.jpg`,
  };
}

/**
 * Check if an exercise has images available.
 */
export function hasExerciseImages(exerciseName) {
  return getExerciseImages(exerciseName) !== null;
}
