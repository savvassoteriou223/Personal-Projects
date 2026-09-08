import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCheckIn, adjustSessionForReadiness } from './readiness.js';

const mkSets = () => ([
  {
    name: 'Bench press', target_sets: 3, target_reps: '8', rest: '2–3 min',
    early_rpe: 7, last_rpe: 9,
    completedSets: [
      { weight: '', reps: '', done: false, type: 'working' },
      { weight: '', reps: '', done: false, type: 'working' },
      { weight: '', reps: '', done: false, type: 'working' },
    ],
  },
]);

test('scoreCheckIn: all good is Ready', () => {
  assert.deepEqual(scoreCheckIn({ sleep: 'good', soreness: 'fresh', energy: 'high' }),
    { score: 6, label: 'Ready' });
});

test('scoreCheckIn: all poor is Low', () => {
  assert.deepEqual(scoreCheckIn({ sleep: 'poor', soreness: 'sore', energy: 'low' }),
    { score: 0, label: 'Low' });
});

test('scoreCheckIn: boundaries 5=Ready 4=Moderate 3=Moderate 2=Low', () => {
  assert.equal(scoreCheckIn({ sleep: 'good', soreness: 'fresh', energy: 'ok' }).label, 'Ready');   // 5
  assert.equal(scoreCheckIn({ sleep: 'good', soreness: 'normal', energy: 'ok' }).label, 'Moderate'); // 4
  assert.equal(scoreCheckIn({ sleep: 'ok', soreness: 'normal', energy: 'ok' }).label, 'Moderate');   // 3
  assert.equal(scoreCheckIn({ sleep: 'poor', soreness: 'normal', energy: 'low' }).label, 'Low');     // 1
});

test('scoreCheckIn: unknown answers score 0, never throw', () => {
  assert.equal(scoreCheckIn({}).label, 'Low');
  assert.equal(scoreCheckIn({ sleep: 'banana' }).score, 0);
});

test('adjustSessionForReadiness: Ready changes nothing', () => {
  const sets = mkSets();
  assert.equal(adjustSessionForReadiness(sets, 'Ready'), sets);
});

test('adjustSessionForReadiness: Moderate lowers last_rpe and early_rpe by 2, keeps sets', () => {
  const out = adjustSessionForReadiness(mkSets(), 'Moderate');
  assert.equal(out[0].last_rpe, 7);
  // early_rpe (7) - 2 = 5, but clamped up to RPE_FLOOR (6), then clamped down
  // to nextLast (7) — floor wins here, so early_rpe lands on 6.
  assert.equal(out[0].early_rpe, 6, 'early_rpe drops with last_rpe, ramp stays ascending');
  assert.equal(out[0].target_sets, 3);
  assert.equal(out[0].completedSets.length, 3);
});

test('adjustSessionForReadiness: Low lowers rpe AND drops a set', () => {
  const out = adjustSessionForReadiness(mkSets(), 'Low');
  assert.equal(out[0].last_rpe, 7);
  assert.equal(out[0].early_rpe, 6, 'early_rpe drops with last_rpe, ramp stays ascending');
  assert.equal(out[0].target_sets, 2);
  assert.equal(out[0].completedSets.length, 2, 'completedSets must match target_sets');
});

test('adjustSessionForReadiness: keeps the RPE ramp ascending (early <= last)', () => {
  const sets = mkSets();
  sets[0].early_rpe = 9;   // the library's dominant case is 9 -> 10
  sets[0].last_rpe = 10;
  for (const label of ['Moderate', 'Low']) {
    const out = adjustSessionForReadiness(sets, label);
    assert.ok(out[0].early_rpe <= out[0].last_rpe,
      `${label}: ramp inverted (${out[0].early_rpe} -> ${out[0].last_rpe})`);
    assert.equal(out[0].last_rpe, 8);
    assert.equal(out[0].early_rpe, 7);
  }
});

test('adjustSessionForReadiness: floors — rpe never below 6, sets never below 1', () => {
  const sets = mkSets();
  sets[0].last_rpe = 7;
  sets[0].target_sets = 1;
  sets[0].completedSets = [{ weight: '', reps: '', done: false, type: 'working' }];
  const out = adjustSessionForReadiness(sets, 'Low');
  assert.equal(out[0].last_rpe, 6);
  assert.equal(out[0].early_rpe, 6, 'early_rpe floors alongside last_rpe');
  assert.equal(out[0].target_sets, 1);
  assert.equal(out[0].completedSets.length, 1);
});

test('adjustSessionForReadiness: never touches weight and does not mutate input', () => {
  const sets = mkSets();
  const out = adjustSessionForReadiness(sets, 'Low');
  assert.equal(sets[0].last_rpe, 9, 'input not mutated');
  assert.equal(sets[0].target_sets, 3, 'input not mutated');
  assert.ok(!('weight' in out[0]), 'no weight key is invented');
  for (const s of out[0].completedSets) assert.equal(s.weight, '', 'set weights untouched');
});
