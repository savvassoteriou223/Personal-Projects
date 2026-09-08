/**
 * Covers the pure half of the ARE integration: how training
 * context is derived, and the guardrail that keeps the engine quiet when it
 * cannot honestly model someone yet.
 *
 * The persistence paths are not covered here — they need a live Supabase and
 * belong in an integration test, not this suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, collectArmData, generateCandidates, designExperiment } from './adaptiveResponseEngine.js';

const PROGRAM = {
  days: [
    { id: 'upper_a', name: 'Upper A', exercises: [
      { name: 'Barbell bench press', muscles: 'Chest, Shoulders, Triceps' },
      { name: 'Barbell row', muscles: 'Lats, Rhomboids' },
    ] },
    { id: 'lower_a', name: 'Lower A', exercises: [
      { name: 'Barbell back squat', muscles: 'Quads, Glutes' },
    ] },
    { id: 'upper_b', name: 'Upper B', exercises: [
      { name: 'Barbell bench press', muscles: 'Chest, Shoulders, Triceps' },
    ] },
  ],
};

test('weekly frequency counts prescribed slots, across days', () => {
  const ctx = buildContext(PROGRAM, {}, {});
  const bench = ctx.lifts.find(l => l.name === 'Barbell bench press');
  const squat = ctx.lifts.find(l => l.name === 'Barbell back squat');
  assert.equal(bench.weeklyFrequency, 2, 'bench appears on Upper A and Upper B');
  assert.equal(squat.weeklyFrequency, 1);
});

test('a lift takes the first muscle of its pattern, not all of them', () => {
  // Frequency trials are attributed to one muscle; counting bench as chest AND
  // shoulders AND triceps would let one trial claim three findings.
  const ctx = buildContext(PROGRAM, {}, {});
  assert.equal(ctx.lifts.find(l => l.name === 'Barbell bench press').muscle, 'chest');
});

test('priorities are the least-trained muscles, lowest first', () => {
  const ctx = buildContext(PROGRAM, {}, { chest: 14, back: 12, calves: 2, biceps: 4, quads: 16 });
  assert.deepEqual(ctx.priorities, ['calves', 'biceps', 'back']);
});

test('an empty program yields no candidates rather than throwing', () => {
  const ctx = buildContext(null, null, {});
  assert.deepEqual(ctx.lifts, []);
  assert.deepEqual(ctx.priorities, []);
});

test('arm data only counts points tagged to an arm', () => {
  const row = { metric_points_json: [
    { arm: 'A', value: 1.2 }, { arm: 'B', value: 1.9 },
    { arm: 'A', value: 1.4 }, { arm: 'C', value: 99 }, // stray arm is ignored
  ] };
  const data = collectArmData(row, []);
  assert.deepEqual(data.A, [1.2, 1.4]);
  assert.deepEqual(data.B, [1.9]);
});

test('a trial with no logged points yields empty arms, not zeros', () => {
  // Empty is "no evidence"; a zero would be a measured result of nothing.
  const data = collectArmData({ metric_points_json: [] }, []);
  assert.deepEqual(data, { A: [], B: [] });
});

test('a volume candidate is only offered when its outcome is measurable', () => {
  // The intervention is a muscle's weekly sets, but the outcome has to be read
  // off a lift — "est-1RM slope of calves" is not a quantity. A priority muscle
  // with no lift in the program is skipped rather than producing an unreadable
  // protocol.
  const ctx = {
    lifts: [{ name: 'Barbell bench press', muscle: 'chest', weeklyFrequency: 2 }],
    priorities: ['chest', 'calves'],
  };
  const cands = generateCandidates(ctx);
  const volume = cands.filter(c => c.type === 'volume');
  assert.deepEqual(volume.map(c => c.target), ['chest'], 'calves has no lift to measure');
  assert.equal(volume[0].metricLift, 'Barbell bench press');
});

test('a designed volume protocol names the lift, never the muscle', () => {
  const [cand] = generateCandidates({
    lifts: [{ name: 'Barbell back squat', muscle: 'quads', weeklyFrequency: 2 }],
    priorities: ['quads'],
  });
  const protocol = designExperiment({ ...cand, paramKey: 'volumeResponse:quads' });
  assert.match(protocol.metric, /Barbell back squat/);
  assert.doesNotMatch(protocol.metric, /slope of quads/);
});

test('arm data is derived from the set log when no points were stored', () => {
  // Nothing writes metric_points during a workout, so a trial that depended on
  // stored points could never reach a verdict. Deriving from the log is what
  // closes the loop.
  const started = Date.parse('2026-01-01T00:00:00Z');
  const day = (n) => new Date(started + n * 864e5).toISOString();
  const row = {
    arm_started_at: new Date(started).toISOString(),
    protocol_json: { type: 'frequency', target: 'Barbell bench press', weeksPerArm: 2 },
    metric_points_json: [],
  };
  const sets = [
    { exercise_name: 'Barbell bench press', weight_kg: 100, reps: 1, completed_at: day(1) },  // arm A
    { exercise_name: 'Barbell bench press', weight_kg: 102, reps: 1, completed_at: day(20) }, // arm B
    { exercise_name: 'Barbell back squat',  weight_kg: 200, reps: 1, completed_at: day(2) },  // other lift
    { exercise_name: 'Barbell bench press', weight_kg: 999, reps: 1, completed_at: day(60) }, // past the trial
  ];
  const data = collectArmData(row, sets);
  assert.deepEqual(data.A, [100]);
  assert.deepEqual(data.B, [102]);
});

test('a session contributes one point, not one per set', () => {
  // A volume trial manipulates how many sets you do. Counting each set would
  // let the intervention inflate its own outcome.
  const started = Date.parse('2026-01-01T00:00:00Z');
  const at = new Date(started + 864e5).toISOString();
  const row = {
    arm_started_at: new Date(started).toISOString(),
    protocol_json: { type: 'volume', target: 'chest', metricLift: 'Barbell bench press', weeksPerArm: 2 },
  };
  const sets = [
    { exercise_name: 'Barbell bench press', weight_kg: 90, reps: 1, completed_at: at },
    { exercise_name: 'Barbell bench press', weight_kg: 100, reps: 1, completed_at: at },
    { exercise_name: 'Barbell bench press', weight_kg: 95, reps: 1, completed_at: at },
  ];
  const data = collectArmData(row, sets);
  assert.deepEqual(data.A, [100], 'best set of the session only');
});

test('stored points still win when a trial recorded its own outcome', () => {
  const data = collectArmData({ metric_points_json: [{ arm: 'A', value: 5 }] }, []);
  assert.deepEqual(data, { A: [5], B: [] });
});
