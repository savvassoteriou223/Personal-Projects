import { test } from 'node:test';
import assert from 'node:assert';
import { computeAdaptationRates, computeFatigueSignature, assembleModel, _internal } from './individualModel.js';

const { est1RM, linreg, confidence } = _internal;
const DAY = 86400000;

// Build weekly sets for one exercise: weights[i] lifted for `reps` on week i.
function weeklySets(name, weights, reps = 5, startWeeksAgo = null) {
  const base = Date.now() - (startWeeksAgo ?? weights.length) * 7 * DAY;
  return weights.map((w, i) => ({
    exercise_name: name,
    weight_kg: w,
    reps,
    completed_at: new Date(base + i * 7 * DAY).toISOString(),
  }));
}

test('est1RM: 1 rep is the weight; higher reps use Epley; junk is null', () => {
  assert.strictEqual(est1RM(100, 1), 100);
  assert.ok(Math.abs(est1RM(100, 5) - 100 * (1 + 5 / 30)) < 1e-9);
  assert.strictEqual(est1RM(0, 5), null);
  assert.strictEqual(est1RM(100, 0), null);
});

test('linreg: perfect upward line → correct slope, R²=1', () => {
  const fit = linreg([[0, 0], [1, 2], [2, 4], [3, 6]]);
  assert.ok(Math.abs(fit.slope - 2) < 1e-9);
  assert.ok(Math.abs(fit.r2 - 1) < 1e-9);
});

test('linreg: identical x (no time span) → null', () => {
  assert.strictEqual(linreg([[3, 1], [3, 2], [3, 3]]), null);
});

test('confidence: below session/span floors is 0 (honest "unknown")', () => {
  assert.strictEqual(confidence({ sessions: 3, spanWeeks: 6, r2: 1 }), 0);
  assert.strictEqual(confidence({ sessions: 8, spanWeeks: 1, r2: 1 }), 0);
  assert.ok(confidence({ sessions: 8, spanWeeks: 6, r2: 1 }) > 0.5);
});

test('computeAdaptationRates: a steadily progressing lift → positive rate, real confidence', () => {
  const sets = weeklySets('Bench Press', [100, 101, 102, 103, 104, 105, 106, 107]);
  const res = computeAdaptationRates(sets);
  const bench = res['Bench Press'];
  assert.ok(bench, 'bench should be modeled');
  // +1kg working weight/week at reps=5 → +1kg*(1+5/30) est-1RM/week ≈ 1.17
  assert.ok(bench.ratePerWeek > 1 && bench.ratePerWeek < 1.3, `rate ${bench.ratePerWeek}`);
  assert.strictEqual(bench.sessions, 8);
  assert.ok(bench.confidence > 0.6, `confidence ${bench.confidence}`);
});

test('computeAdaptationRates: a flat lift → ~0 rate', () => {
  const sets = weeklySets('Squat', [140, 140, 140, 140, 140, 140]);
  const res = computeAdaptationRates(sets);
  assert.ok(Math.abs(res['Squat'].ratePerWeek) < 0.01, 'flat → near-zero slope');
});

test('computeAdaptationRates: too few sessions → excluded when minConfidence required', () => {
  const sets = weeklySets('Row', [60, 62, 64]); // 3 sessions
  const res = computeAdaptationRates(sets, { minConfidence: 0.01 });
  assert.strictEqual(res['Row'], undefined, 'sparse data must not produce a trusted rate');
});

test('computeFatigueSignature: recent sessions on-trend → fresh', () => {
  const sets = weeklySets('Bench Press', [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  const f = computeFatigueSignature(sets);
  assert.strictEqual(f.label, 'fresh', `deviation ${f.deviationPct}`);
  assert.ok(f.score > 0.85);
});

test('computeFatigueSignature: recent sessions falling below trend → fatigued', () => {
  // 8 sessions climbing, then two well below where the trend predicted
  const sets = weeklySets('Bench Press', [100, 101, 102, 103, 104, 105, 106, 107, 102, 101]);
  const f = computeFatigueSignature(sets);
  assert.strictEqual(f.label, 'fatigued', `deviation ${f.deviationPct}`);
  assert.ok(f.deviationPct < -5);
  assert.ok(f.score < 0.4);
});

test('computeFatigueSignature: not enough history → null (honest)', () => {
  const f = computeFatigueSignature(weeklySets('Row', [60, 62, 64]));
  assert.strictEqual(f.score, null);
});

test('assembleModel: bundles rates + fatigue + carried-over learned params', () => {
  const sets = weeklySets('Bench Press', [100, 101, 102, 103, 104, 105, 106, 107]);
  const m = assembleModel(sets, { learned: { 'volumeResponse:chest': { value: 'current+6', confidence: 0.7 } } });
  assert.ok(m.adaptationRates['Bench Press']);
  assert.ok('fatigue' in m && 'label' in m.fatigue);
  assert.strictEqual(m.learned['volumeResponse:chest'].confidence, 0.7); // persisted learning survives
});

test('computeAdaptationRates: same-day sets collapse to the best (no double counting)', () => {
  const day = new Date().toISOString();
  const sets = [
    { exercise_name: 'Deadlift', weight_kg: 180, reps: 3, completed_at: day },
    { exercise_name: 'Deadlift', weight_kg: 200, reps: 1, completed_at: day },
  ];
  // one calendar day → one point → not enough for a slope, so nothing returned
  const res = computeAdaptationRates(sets);
  assert.strictEqual(res['Deadlift'], undefined);
});
