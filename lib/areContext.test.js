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
