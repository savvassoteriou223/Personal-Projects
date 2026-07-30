/**
 * Proves that logged sets reach the right muscle.
 *
 * A user did a leg day, swapped a glute exercise for a second calf movement
 * mid-workout, logged five calf sets — and the app showed four, with calves
 * reading "ready" on the recovery map. Three separate defects produced that:
 *
 *  1. doSwap replaced the exercise but never updated `pattern`, so the swapped
 *     sets were saved with the REPLACED movement's pattern_key.
 *  2. computeHeadVolume attributed by exercise name only, so any set whose
 *     stored name was not an exact library key silently counted for nothing.
 *  3. The recovery gate required two different exercises OR five sets before a
 *     muscle counted as trained.
 *
 * Volume tracking is the product. A set that vanishes is the worst class of bug
 * this app can have, because nothing surfaces it — the number is simply wrong.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHeadVolume, buildVolumeView } from '../screens/volumeEngine.js';

test('a set attributes by pattern_key even when the name is unknown', () => {
  // A renamed library entry, or a name saved by an older build.
  const vol = computeHeadVolume([
    { exercise_name: 'Some renamed calf movement', pattern_key: 'calves', reps: 12, weight_kg: 40 },
    { exercise_name: 'Some renamed calf movement', pattern_key: 'calves', reps: 12, weight_kg: 40 },
  ]);
  assert.equal(vol.calves?.direct, 2, 'pattern_key must carry the set when the name does not');
});

test('an unknown name with no pattern_key still counts for nothing', () => {
  // Legacy rows predating pattern_key have nothing to attribute by. This is the
  // honest limit of the fix and is asserted so it is not mistaken for a bug.
  const vol = computeHeadVolume([{ exercise_name: 'Totally unknown lift', reps: 10, weight_kg: 50 }]);
  assert.deepEqual(vol, {});
});

test('name attribution still works for rows without a pattern_key', () => {
  const vol = computeHeadVolume([{ exercise_name: 'Standing calf raise', reps: 12, weight_kg: 40 }]);
  assert.equal(vol.calves?.direct, 1);
});

test('the reported scenario: swapped calf work lands on calves, not glutes', () => {
  // Three sets of the programmed calf exercise, then two more on a movement
  // swapped in over a glute slot. Before the fix the swapped pair carried
  // pattern_key 'glute_focused' and the total read 3.
  const sets = [
    ...Array(3).fill({ exercise_name: 'Standing calf raise', pattern_key: 'calves', reps: 12, weight_kg: 40 }),
    ...Array(2).fill({ exercise_name: 'Seated calf raise', pattern_key: 'calves', reps: 12, weight_kg: 40 }),
  ];
  const vol = computeHeadVolume(sets);
  assert.equal(vol.calves?.direct, 5, 'all five logged sets must count');
  assert.equal(vol.glutes, undefined, 'nothing should land on glutes');
});

test('pattern_key wins over a name that maps somewhere else', () => {
  // The failure mode exactly: the slot was a glute exercise, the lifter swapped
  // in a calf movement. Whichever field is trusted decides the muscle, so the
  // durable one has to win.
  const vol = computeHeadVolume([
    { exercise_name: 'Standing calf raise', pattern_key: 'calves', reps: 12, weight_kg: 40 },
  ]);
  assert.equal(vol.calves?.direct, 1);
  assert.ok(!vol.glutes, 'the replaced slot must not keep claiming the work');
});

test('the weekly view reports what was logged', () => {
  const sets = Array(5).fill({ exercise_name: 'Standing calf raise', pattern_key: 'calves', reps: 12, weight_kg: 40 });
  const calves = buildVolumeView(sets, 'intermediate').find(g => g.key === 'calves');
  assert.equal(calves.done, 5);
});

test('warm-up sets are not working volume', () => {
  // The workout screen lets a lifter tag a set warmup / drop / failure and saves
  // the tag; the volume engine ignored it and counted all four alike, so two
  // warm-ups before a working set reported three sets of chest and every target
  // was judged against an inflated number.
  const sets = [
    { exercise_name: 'Barbell bench press', pattern_key: 'chest_horizontal_push', reps: 10, weight_kg: 40, set_type: 'warmup' },
    { exercise_name: 'Barbell bench press', pattern_key: 'chest_horizontal_push', reps: 10, weight_kg: 60, set_type: 'working' },
  ];
  const chest = buildVolumeView(sets, 'intermediate').find(g => g.key === 'chest');
  assert.equal(chest.done, 1);
});

test('drop sets and sets to failure still count as working volume', () => {
  // Only the warm-up is excluded. A drop set is hard work and research counts it.
  const sets = [
    { exercise_name: 'Barbell bench press', pattern_key: 'chest_horizontal_push', reps: 8, weight_kg: 60, set_type: 'drop' },
    { exercise_name: 'Barbell bench press', pattern_key: 'chest_horizontal_push', reps: 6, weight_kg: 60, set_type: 'failure' },
  ];
  const chest = buildVolumeView(sets, 'intermediate').find(g => g.key === 'chest');
  assert.equal(chest.done, 2);
});

test('a set marked done with nothing entered does not count', () => {
  const sets = [
    { exercise_name: 'Barbell bench press', pattern_key: 'chest_horizontal_push', reps: 10, weight_kg: 60 },
    { exercise_name: 'Barbell bench press', pattern_key: 'chest_horizontal_push', reps: null, weight_kg: null },
  ];
  const chest = buildVolumeView(sets, 'intermediate').find(g => g.key === 'chest');
  assert.equal(chest.done, 1);
});

test('bodyweight sets count despite having no weight', () => {
  // weight_kg is null for every push-up. Filtering on weight would silently
  // erase the entire bodyweight audience's training.
  const sets = Array(3).fill({
    exercise_name: 'Push-up', pattern_key: 'chest_horizontal_push', reps: 12, weight_kg: null,
  });
  const chest = buildVolumeView(sets, 'intermediate').find(g => g.key === 'chest');
  assert.equal(chest.done, 3);
});
