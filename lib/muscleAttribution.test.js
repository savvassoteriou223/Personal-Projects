import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';
import {
  MUSCLE_GROUPS, normaliseMuscle, exerciseMuscleGroups, matchesMuscle,
} from './muscleAttribution.js';

// ── The reported bug: an upper-body session where only chest registered ──
// Sets are saved with a durable pattern_key. A back set whose exercise_name is
// NOT an exact library key (a swap, a variant, legacy data) must still register
// as Back via its pattern_key — not vanish from every muscle.
test('back set with an unknown display name still registers via pattern_key', () => {
  const groups = exerciseMuscleGroups('Some Renamed Row 3000', 'back_horizontal_pull');
  assert.ok(groups.includes('back'), `expected back, got [${groups}]`);
  assert.ok(matchesMuscle('Some Renamed Row 3000', 'back_horizontal_pull', 'Back'));
});

// Rows (Rhomboids / Mid-traps / Rear delts) previously normalised to shoulders
// ONLY — a horizontal pull that trained "no back". Regression guard.
test('inner-back / row pattern counts as Back', () => {
  assert.ok(exerciseMuscleGroups(null, 'back_inner').includes('back'));
});

// Name fallback still works for legacy rows with no pattern_key.
test('legacy row (no pattern_key) attributes by exercise name', () => {
  const groups = exerciseMuscleGroups('Pull-up (overhand)', null);
  assert.ok(groups.includes('back'), `expected back, got [${groups}]`);
});

// Every muscle string authored in the library must map to a tracked group,
// except the deliberately-untracked forearm/adductor strings. This is what
// prevents a whole exercise silently registering under nothing.
test('every library pattern registers under at least one tracked group', () => {
  const UNTRACKED_OK = new Set(['forearm', 'forearms', 'grip']); // pattern-key substrings w/o a target
  const offenders = [];
  for (const [key, pattern] of Object.entries(MOVEMENT_PATTERNS)) {
    const groups = exerciseMuscleGroups(null, key);
    if (groups.length === 0 && ![...UNTRACKED_OK].some((u) => key.includes(u))) {
      offenders.push(`${key} (${pattern.muscles.join(', ')})`);
    }
  }
  assert.deepEqual(offenders, [], `patterns registering under NO muscle:\n${offenders.join('\n')}`);
});

test('normaliseMuscle handles casing / hyphen variants', () => {
  assert.equal(normaliseMuscle('Rhomboids'), 'back');
  assert.equal(normaliseMuscle('Mid-traps'), 'back');
  assert.equal(normaliseMuscle('Side deltoids'), 'shoulders');
  assert.equal(normaliseMuscle('Flexors'), null); // untracked forearm
});

test('MUSCLE_GROUPS is the canonical 10', () => {
  assert.equal(MUSCLE_GROUPS.length, 10);
});
