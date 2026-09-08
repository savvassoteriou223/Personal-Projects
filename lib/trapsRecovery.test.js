import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseMuscle, primaryMuscleFor, buildRecoveryMap, MUSCLE_RECOVERY_DAYS } from './recoveryMap.js';

const MUSCLES = ['chest','back','traps','shoulders','biceps','triceps','quads','hamstrings','glutes','calves','forearms','abs'];
const TODAY = new Date('2026-08-11T09:00:00Z');
const YESTERDAY = { s1: new Date('2026-08-10T18:00:00Z') };
const set = (name, pattern, extra = {}) =>
  ({ exercise_name: name, pattern_key: pattern, session_id: 's1', reps: 10, weight_kg: 40, set_type: 'working', ...extra });

const PULL_NO_SHRUGS = [
  set('Lat pulldown (wide pronated grip)', 'back_vertical_pull'),
  set('Lat pulldown (wide pronated grip)', 'back_vertical_pull'),
  set('Barbell row', 'back_horizontal_pull'),
  set('Barbell row', 'back_horizontal_pull'),
];
const SHRUGS = [set('Cable shrug', 'upper_traps'), set('Cable shrug', 'upper_traps')];

test('traps is its own group, separate from back', () => {
  assert.equal(normaliseMuscle('upper traps'), 'traps');
  assert.equal(normaliseMuscle('upper trapezius'), 'traps');
  assert.equal(normaliseMuscle('levator scapulae'), 'traps');
  assert.equal(normaliseMuscle('lats'), 'back');
  assert.equal(normaliseMuscle('rhomboids'), 'back');
  assert.equal(MUSCLE_RECOVERY_DAYS.traps, 2);
});

test('only shrugs credit traps; rows and pulldowns credit back', () => {
  assert.equal(primaryMuscleFor('Cable shrug', 'upper_traps'), 'traps');
  assert.equal(primaryMuscleFor('Barbell shrug', 'upper_traps'), 'traps');
  assert.equal(primaryMuscleFor('Barbell row', 'back_horizontal_pull'), 'back');
  assert.equal(primaryMuscleFor('Lat pulldown (wide pronated grip)', 'back_vertical_pull'), 'back');
});

test('THE REPORTED BUG: pull day with shrugs skipped leaves traps untrained', () => {
  const m = buildRecoveryMap(PULL_NO_SHRUGS, YESTERDAY, MUSCLES, TODAY);
  assert.equal(m.back.status, 'recovering', 'back should be recovering');
  assert.equal(m.traps.daysSince, null, 'traps must show as never trained');
  assert.equal(m.traps.status, 'fresh');
});

test('same day WITH shrugs does mark traps trained', () => {
  const m = buildRecoveryMap([...PULL_NO_SHRUGS, ...SHRUGS], YESTERDAY, MUSCLES, TODAY);
  assert.equal(m.traps.daysSince, 1);
  assert.equal(m.traps.status, 'recovering');
  assert.equal(m.back.status, 'recovering');
});

test('shrugs alone do not mark the back trained', () => {
  const m = buildRecoveryMap(SHRUGS, YESTERDAY, MUSCLES, TODAY);
  assert.equal(m.traps.daysSince, 1);
  assert.equal(m.back.daysSince, null);
});

test('warm-up sets are not training', () => {
  const warmups = [
    set('Barbell row', 'back_horizontal_pull', { set_type: 'warmup', weight_kg: 20 }),
    set('Barbell row', 'back_horizontal_pull', { set_type: 'warmup', weight_kg: 20 }),
  ];
  assert.equal(buildRecoveryMap(warmups, YESTERDAY, MUSCLES, TODAY).back.daysSince, null);
});

test('a set toggled done but left blank is not training', () => {
  const blank = [
    set('Cable shrug', 'upper_traps', { reps: null, weight_kg: null }),
    set('Cable shrug', 'upper_traps', { reps: null, weight_kg: null }),
  ];
  assert.equal(buildRecoveryMap(blank, YESTERDAY, MUSCLES, TODAY).traps.daysSince, null);
});

test('bodyweight sets still count — weight alone may be absent', () => {
  const bw = [
    set('Pull-up (overhand)', 'back_vertical_pull', { weight_kg: null }),
    set('Pull-up (overhand)', 'back_vertical_pull', { weight_kg: null }),
  ];
  assert.equal(buildRecoveryMap(bw, YESTERDAY, MUSCLES, TODAY).back.daysSince, 1);
});

test('drop sets and sets to failure still count', () => {
  const hard = [
    set('Barbell row', 'back_horizontal_pull', { set_type: 'drop' }),
    set('Barbell row', 'back_horizontal_pull', { set_type: 'failure' }),
  ];
  assert.equal(buildRecoveryMap(hard, YESTERDAY, MUSCLES, TODAY).back.daysSince, 1);
});

test('a single set is still below the 2-set gate', () => {
  const one = [set('Cable shrug', 'upper_traps')];
  assert.equal(buildRecoveryMap(one, YESTERDAY, MUSCLES, TODAY).traps.daysSince, null);
});
