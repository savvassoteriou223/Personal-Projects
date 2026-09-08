/**
 * Guards the goal -> profile mapping.
 *
 * resolveGoalCombo() returns a key that getGoalProfile() looks up in
 * GOAL_PROFILES, falling back to GOAL_PROFILES.muscle when the key is missing.
 * That fallback is silent, so a typo does not throw — it just hands the user the
 * wrong prescription. It shipped that way: fat loss resolved to 'cut' while the
 * profile was named 'lose', so anyone who picked "lose fat" on its own trained on
 * the muscle-building profile.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGoalCombo,
  GOAL_PROFILES,
} from '../screens/programGenerator.js';

const GOAL_IDS = ['lose', 'gain', 'aesthetics', 'strength', 'endurance'];

// every subset of the selectable goals
function allCombos() {
  const out = [];
  for (let mask = 0; mask < 1 << GOAL_IDS.length; mask++) {
    out.push(GOAL_IDS.filter((_, bit) => (mask >> bit) & 1));
  }
  return out;
}

test('every goal combination resolves to a real GOAL_PROFILES key', () => {
  for (const goals of allCombos()) {
    const key = resolveGoalCombo(goals);
    assert.ok(
      Object.hasOwn(GOAL_PROFILES, key),
      `resolveGoalCombo(${JSON.stringify(goals)}) returned "${key}", which is not a GOAL_PROFILES key — ` +
      'getGoalProfile would silently fall back to the muscle profile',
    );
  }
});

test('no GOAL_PROFILES entry is unreachable', () => {
  const reachable = new Set(allCombos().map(resolveGoalCombo));
  const orphans = Object.keys(GOAL_PROFILES).filter(k => !reachable.has(k));
  assert.deepEqual(orphans, [], `unreachable profiles: ${orphans.join(', ')}`);
});

test('fat loss alone does not resolve to the muscle profile', () => {
  assert.equal(resolveGoalCombo(['lose']), 'lose');
});

test('every profile carries the fields the generator reads', () => {
  for (const [name, gp] of Object.entries(GOAL_PROFILES)) {
    for (const field of ['compoundReps', 'isolationReps', 'compoundSets', 'isolationSets', 'compoundRPE', 'lastSetRPE', 'restCompound', 'restIsolation']) {
      assert.ok(gp[field] != null, `${name} is missing ${field}`);
    }
  }
});

test('no goal prescribes grinding a heavy compound to failure', () => {
  // Strength gains are insensitive to proximity to failure across a wide RIR
  // range (Robinson et al. 2024, 67 strength studies), so RPE 10 on a heavy
  // compound buys fatigue rather than strength.
  for (const [name, gp] of Object.entries(GOAL_PROFILES)) {
    assert.ok(gp.lastSetRPE <= 9, `${name} prescribes RPE ${gp.lastSetRPE} on the last set`);
  }
});
