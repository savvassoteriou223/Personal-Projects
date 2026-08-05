/**
 * Tests the muscle heat map — which had none, because the calculation lived
 * inline in TodayScreen.
 *
 * The reported failure: a leg day with five calf sets across two movements, and
 * the map showed calves fresh.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  primaryMuscleFor, lastTrainedPerMuscle, recoveryStatus, buildRecoveryMap,
} from './recoveryMap.js';

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads',
                 'hamstrings', 'glutes', 'calves', 'forearms', 'abs'];

const YESTERDAY = new Date('2026-07-29T19:00:00Z');
const TODAY = new Date('2026-07-30T09:00:00Z');
const DATES = { s1: YESTERDAY };
const s = (name, patternKey) => ({ exercise_name: name, pattern_key: patternKey, session_id: 's1' });

test('the reported leg day: calves register as trained', () => {
  // Exactly what the user did — three sets of the programmed calf exercise, then
  // two more on a movement swapped in over a glute slot.
  const sets = [
    ...Array(4).fill(s('Barbell back squat', 'squat_pattern')),
    ...Array(4).fill(s('Romanian deadlift (barbell)', 'hip_hinge')),
    ...Array(3).fill(s('Standing calf raise', 'calves')),
    ...Array(2).fill(s('Seated calf raise', 'calves')),
  ];
  const map = buildRecoveryMap(sets, DATES, MUSCLES, TODAY);
  assert.notEqual(map.calves.status, 'fresh', 'calves were trained and must not read fresh');
  assert.equal(map.calves.daysSince, 1);
  assert.equal(map.quads.status, 'recovering', 'quads take 3 days; 1 day in is recovering');
});

test('three sets of one exercise is enough to count', () => {
  // The old gate demanded two DIFFERENT exercises or five sets, so this read as
  // untrained.
  const map = buildRecoveryMap(Array(3).fill(s('Standing calf raise', 'calves')), DATES, MUSCLES, TODAY);
  assert.equal(map.calves.daysSince, 1);
});

test('a single incidental set still does not count', () => {
  // The gate has a real job: one set of shrugs should not mark the whole back as
  // trained. Lowering it to two must not remove that.
  const map = buildRecoveryMap([s('Barbell shrug', 'upper_traps')], DATES, MUSCLES, TODAY);
  assert.equal(map.back.status, 'fresh');
});

test('a swapped exercise attributes to its own muscle, not the slot it replaced', () => {
  // The root defect: doSwap wrote the new name but kept the old pattern_key, so
  // calf work was filed under glutes.
  const sets = Array(3).fill(s('Seated calf raise', 'calves'));
  const map = buildRecoveryMap(sets, DATES, MUSCLES, TODAY);
  assert.notEqual(map.calves.status, 'fresh');
  assert.equal(map.glutes.status, 'fresh', 'the replaced slot must not claim the work');
});

test('secondary muscles do not reset the recovery clock', () => {
  // An overhead press works triceps and upper chest. If secondaries counted, a
  // shoulder day would tell you your chest is recovering.
  const map = buildRecoveryMap(Array(4).fill(s('Barbell overhead press', 'shoulders_vertical_push')),
                               DATES, MUSCLES, TODAY);
  assert.notEqual(map.shoulders.status, 'fresh');
  assert.equal(map.chest.status, 'fresh');
  assert.equal(map.triceps.status, 'fresh');
});

test('a renamed exercise falls back to its pattern_key', () => {
  assert.equal(primaryMuscleFor('Some renamed movement', 'calves'), 'calves');
});

test('a legacy row with no pattern_key still attributes by name', () => {
  assert.equal(primaryMuscleFor('Standing calf raise', null), 'calves');
});

test('an exact library name beats a stale pattern_key', () => {
  // Swapping an exercise into a slot keeps the slot's old pattern. Production
  // rows had "Seated leg curl" saved under squat_pattern — crediting hamstring
  // work to quads — and "Standing calf raise" under glute_focused.
  assert.equal(primaryMuscleFor('Seated leg curl', 'squat_pattern'), 'hamstrings');
  assert.equal(primaryMuscleFor('Standing calf raise', 'glute_focused'), 'calves');
});

test('training this morning reads as trained today, not as a day ago', () => {
  const map = buildRecoveryMap(Array(3).fill(s('Standing calf raise', 'calves')),
                               { s1: new Date('2026-07-30T06:00:00Z') }, MUSCLES, TODAY);
  assert.equal(map.calves.daysSince, 0);
  assert.equal(map.calves.status, 'trained_today');
});

test('recovery thresholds differ by muscle', () => {
  // Calves recover in a day, quads in three. One day out they must not read the
  // same.
  assert.equal(recoveryStatus('calves', 1), 'ready');
  assert.equal(recoveryStatus('quads', 1), 'recovering');
  assert.equal(recoveryStatus('quads', 3), 'ready');
  assert.equal(recoveryStatus('quads', 5), 'fresh');
});

test('a muscle never trained reads fresh rather than crashing', () => {
  const map = buildRecoveryMap([], {}, MUSCLES, TODAY);
  for (const m of MUSCLES) assert.equal(map[m].status, 'fresh');
});
