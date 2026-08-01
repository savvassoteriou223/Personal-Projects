import { test } from 'node:test';
import assert from 'node:assert/strict';

import { keepInPatternAlternatives } from './exerciseAlternatives.js';
import { getPatternLabelForExercise, MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';
import { resolveExerciseByName } from '../screens/programGenerator.js';

const GYM = ['barbell', 'dumbbells', 'machines', 'cables', 'bench'];

// The reported bug: asking the coach to replace the decline press on an Upper
// day came back with the three flat-bench variants.
const REPORTED = {
  day_id: 'upper_a',
  current_exercise: 'Decline barbell press',
  alternatives: [
    { exercise_name: 'Barbell bench press', rationale: 'Most loadable chest press.' },
    { exercise_name: 'Machine chest press', rationale: 'Stable, easy to progress.' },
    { exercise_name: 'Dumbbell bench press', rationale: 'Greater range of motion.' },
  ],
};

test('the decline slot and the flat-bench slot are different patterns', () => {
  assert.equal(resolveExerciseByName('Decline barbell press').patternKey, 'chest_decline');
  assert.equal(resolveExerciseByName('Barbell bench press').patternKey, 'chest_horizontal_push');
});

test('pattern labels distinguish chest regions the muscle tag collapsed', () => {
  const decline = getPatternLabelForExercise('Decline barbell press');
  const flat = getPatternLabelForExercise('Barbell bench press');
  const incline = getPatternLabelForExercise('Incline barbell press');
  assert.notEqual(decline, flat);
  assert.notEqual(decline, incline);
  assert.notEqual(flat, incline);
  assert.match(decline, /Lower Chest/);
});

test('an exercise the library does not know has no label', () => {
  assert.equal(getPatternLabelForExercise('Sandbag carry to the car'), null);
  assert.equal(getPatternLabelForExercise(undefined), null);
});

test('every library exercise resolves to a label', () => {
  for (const pat of Object.values(MOVEMENT_PATTERNS)) {
    for (const ex of pat.exercises) {
      assert.equal(getPatternLabelForExercise(ex.name), pat.label, ex.name);
    }
  }
});

test('flat-bench options offered for a decline slot are all dropped', () => {
  const out = keepInPatternAlternatives(REPORTED, GYM);
  const names = out.alternatives.map(o => o.exercise_name);
  assert.ok(!names.includes('Barbell bench press'));
  assert.ok(!names.includes('Machine chest press'));
  assert.ok(!names.includes('Dumbbell bench press'));
});

test('the filtered card is topped back up with real decline options', () => {
  const out = keepInPatternAlternatives(REPORTED, GYM);
  assert.equal(out.alternatives.length, 3);
  for (const opt of out.alternatives) {
    assert.equal(resolveExerciseByName(opt.exercise_name).patternKey, 'chest_decline');
    assert.ok(opt.rationale, `${opt.exercise_name} should carry a rationale`);
  }
});

test('the exercise being replaced is never offered back as its own alternative', () => {
  const out = keepInPatternAlternatives(REPORTED, GYM);
  const names = out.alternatives.map(o => o.exercise_name.toLowerCase());
  assert.ok(!names.includes('decline barbell press'));
});

test('top-ups respect the equipment the user actually has', () => {
  const out = keepInPatternAlternatives(REPORTED, ['dumbbells']);
  for (const opt of out.alternatives) {
    const { patternKey, exerciseId } = resolveExerciseByName(opt.exercise_name);
    const ex = MOVEMENT_PATTERNS[patternKey].exercises.find(e => e.id === exerciseId);
    assert.ok(
      ex.equipment.some(eq => eq === 'dumbbells' || eq === 'bodyweight'),
      `${opt.exercise_name} needs ${ex.equipment.join('/')}`
    );
  }
});

test('in-pattern options the model got right are kept, with their rationales', () => {
  const good = {
    current_exercise: 'Decline barbell press',
    alternatives: [
      { exercise_name: 'Dips (chest focus, lean forward)', rationale: 'Loaded stretch at the lower pec.' },
      { exercise_name: 'Cable crossover (lower chest)', rationale: 'Constant tension through the shortened range.' },
      { exercise_name: 'Decline dumbbell press', rationale: 'Greater range of motion than the barbell.' },
    ],
  };
  const out = keepInPatternAlternatives(good, GYM);
  assert.deepEqual(out, good, 'a fully in-pattern payload should pass through untouched');
});

test('a partially wrong list keeps the good options and replaces only the bad', () => {
  const mixed = {
    current_exercise: 'Decline barbell press',
    alternatives: [
      { exercise_name: 'Decline dumbbell press', rationale: 'Greater range of motion.' },
      { exercise_name: 'Barbell bench press', rationale: 'Most loadable chest press.' },
      { exercise_name: 'Incline barbell press', rationale: 'Upper chest emphasis.' },
    ],
  };
  const out = keepInPatternAlternatives(mixed, GYM);
  assert.equal(out.alternatives[0].exercise_name, 'Decline dumbbell press');
  assert.equal(out.alternatives[0].rationale, 'Greater range of motion.');
  assert.equal(out.alternatives.length, 3);
  for (const opt of out.alternatives) {
    assert.equal(resolveExerciseByName(opt.exercise_name).patternKey, 'chest_decline');
  }
});

test('an unknown current exercise passes through rather than emptying the card', () => {
  const custom = {
    current_exercise: 'Coach Dave special',
    alternatives: [{ exercise_name: 'Barbell bench press', rationale: 'x' }],
  };
  assert.deepEqual(keepInPatternAlternatives(custom, GYM), custom);
});

test('the guard holds across every pattern, not just chest', () => {
  // A vertical pull offered horizontal-pull options, and a side delt offered
  // rear delt options — the same class of error in other families.
  const cases = [
    ['Lat pulldown (wide pronated grip)', 'back_vertical_pull', ['Barbell row', 'T-bar row', 'Dumbbell row']],
    ['Dumbbell lateral raise', 'shoulders_side_delt', ['Face pull (cable)', 'Reverse pec deck', 'Barbell row']],
    ['Leg extension', 'quad_isolation', ['Romanian deadlift', 'Leg curl (seated)', 'Barbell row']],
  ];
  for (const [current, expectedPattern, wrongOptions] of cases) {
    const resolved = resolveExerciseByName(current);
    assert.ok(resolved, `${current} should exist in the library`);
    assert.equal(resolved.patternKey, expectedPattern, current);
    const out = keepInPatternAlternatives(
      { current_exercise: current, alternatives: wrongOptions.map(n => ({ exercise_name: n, rationale: 'x' })) },
      GYM
    );
    for (const opt of out.alternatives) {
      assert.equal(
        resolveExerciseByName(opt.exercise_name).patternKey,
        expectedPattern,
        `${current} → ${opt.exercise_name}`
      );
    }
  }
});
