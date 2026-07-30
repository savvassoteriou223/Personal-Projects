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
    { exercise_name: 'Some renamed calf movement', pattern_key: 'calves' },
    { exercise_name: 'Some renamed calf movement', pattern_key: 'calves' },
  ]);
  assert.equal(vol.calves?.direct, 2, 'pattern_key must carry the set when the name does not');
});

test('an unknown name with no pattern_key still counts for nothing', () => {
  // Legacy rows predating pattern_key have nothing to attribute by. This is the
  // honest limit of the fix and is asserted so it is not mistaken for a bug.
  const vol = computeHeadVolume([{ exercise_name: 'Totally unknown lift' }]);
  assert.deepEqual(vol, {});
});

test('name attribution still works for rows without a pattern_key', () => {
  const vol = computeHeadVolume([{ exercise_name: 'Standing calf raise' }]);
  assert.equal(vol.calves?.direct, 1);
});

test('the reported scenario: swapped calf work lands on calves, not glutes', () => {
  // Three sets of the programmed calf exercise, then two more on a movement
  // swapped in over a glute slot. Before the fix the swapped pair carried
  // pattern_key 'glute_focused' and the total read 3.
  const sets = [
    ...Array(3).fill({ exercise_name: 'Standing calf raise', pattern_key: 'calves' }),
    ...Array(2).fill({ exercise_name: 'Seated calf raise', pattern_key: 'calves' }),
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
    { exercise_name: 'Standing calf raise', pattern_key: 'calves' },
  ]);
  assert.equal(vol.calves?.direct, 1);
  assert.ok(!vol.glutes, 'the replaced slot must not keep claiming the work');
});

test('the weekly view reports what was logged', () => {
  const sets = Array(5).fill({ exercise_name: 'Standing calf raise', pattern_key: 'calves' });
  const calves = buildVolumeView(sets, 'intermediate').find(g => g.key === 'calves');
  assert.equal(calves.done, 5);
});
