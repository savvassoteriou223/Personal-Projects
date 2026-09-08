import { test } from 'node:test';
import assert from 'node:assert';
import {
  generateCandidates, rankExperiments, designExperiment,
  evaluateExperiment, applyVerdict, nextAction,
} from './adaptiveResponseEngine.js';

test('generateCandidates: ≤1×/wk lift → frequency test; priorities → volume tests', () => {
  const ctx = {
    lifts: [
      { name: 'Bench Press', muscle: 'chest', weeklyFrequency: 1 },
      { name: 'Squat', muscle: 'quads', weeklyFrequency: 2 }, // already 2× — no freq test
    ],
    priorities: ['chest'],
  };
  const c = generateCandidates(ctx);
  assert.ok(c.find((x) => x.id === 'frequency:Bench Press'));
  assert.ok(!c.find((x) => x.id === 'frequency:Squat'));
  assert.ok(c.find((x) => x.id === 'volume:chest'));
});

test('rankExperiments: an unknown parameter outranks an already-learned one', () => {
  const candidates = [
    { id: 'volume:chest', type: 'volume', target: 'chest', muscle: 'chest' },
    { id: 'volume:back', type: 'volume', target: 'back', muscle: 'back' },
  ];
  const model = { learned: { 'volumeResponse:chest': { confidence: 0.9 } } };
  const ranked = rankExperiments(candidates, model, { priorities: ['chest', 'back'] });
  assert.strictEqual(ranked[0].target, 'back'); // chest is nearly resolved → lower VoI
  assert.ok(ranked[0].voi > ranked[1].voi);
});

test('designExperiment: produces a fully pre-registered protocol', () => {
  const p = designExperiment({ id: 'frequency:Bench Press', type: 'frequency', target: 'Bench Press', muscle: 'chest', paramKey: 'frequencyResponse:Bench Press' });
  assert.strictEqual(p.arms.length, 2);
  assert.ok(p.metric.includes('Bench Press'));
  assert.ok(p.mde > 0);
  assert.ok(p.decisionRule && p.createdAt);
});

test('evaluateExperiment: clear win → keep', () => {
  const p = designExperiment({ id: 'x', type: 'volume', target: 'chest', muscle: 'chest', paramKey: 'volumeResponse:chest' });
  const r = evaluateExperiment(p, { A: [1.0, 1.1, 0.9], B: [1.7, 1.8, 1.6] });
  assert.strictEqual(r.verdict, 'keep');
  assert.ok(r.diff > 0.3 && r.effectSize > 0.5);
});

test('evaluateExperiment: clear loss → revert', () => {
  const p = designExperiment({ id: 'x', type: 'volume', target: 'chest', muscle: 'chest', paramKey: 'volumeResponse:chest' });
  const r = evaluateExperiment(p, { A: [1.7, 1.8, 1.6], B: [1.0, 1.1, 0.9] });
  assert.strictEqual(r.verdict, 'revert');
});

test('evaluateExperiment: tiny difference → inconclusive, not a false positive', () => {
  const p = designExperiment({ id: 'x', type: 'volume', target: 'chest', muscle: 'chest', paramKey: 'volumeResponse:chest' });
  const r = evaluateExperiment(p, { A: [1.0, 1.1, 0.9], B: [1.05, 1.15, 0.95] });
  assert.strictEqual(r.verdict, 'inconclusive');
});

test('evaluateExperiment: thin data → inconclusive + extend', () => {
  const p = designExperiment({ id: 'x', type: 'volume', target: 'chest', muscle: 'chest', paramKey: 'volumeResponse:chest' });
  const r = evaluateExperiment(p, { A: [1.0], B: [1.5] });
  assert.strictEqual(r.verdict, 'inconclusive');
  assert.strictEqual(r.extend, true);
});

test('applyVerdict: keep writes the learned parameter into the model', () => {
  const p = designExperiment({ id: 'x', type: 'frequency', target: 'Bench Press', muscle: 'chest', paramKey: 'frequencyResponse:Bench Press' });
  const m = applyVerdict({ learned: {} }, p, { verdict: 'keep', diff: 0.7 });
  assert.ok(m.learned['frequencyResponse:Bench Press']);
  assert.strictEqual(m.learned['frequencyResponse:Bench Press'].value, 2); // B arm
});

test('nextAction: idle with candidates → proposes a designed experiment', () => {
  const state = {
    model: { learned: {} },
    context: { lifts: [{ name: 'Bench Press', muscle: 'chest', weeklyFrequency: 1 }], priorities: ['chest'] },
  };
  const a = nextAction(state);
  assert.strictEqual(a.action, 'propose');
  assert.ok(a.experiment && a.experiment.arms.length === 2);
});

test('nextAction: active experiment with a clear result → concludes and updates the model', () => {
  const experiment = designExperiment({ id: 'volume:chest', type: 'volume', target: 'chest', muscle: 'chest', paramKey: 'volumeResponse:chest' });
  const a = nextAction({ model: { learned: {} }, activeExperiment: experiment, armData: { A: [1.0, 1.1, 0.9], B: [1.7, 1.8, 1.6] } });
  assert.strictEqual(a.action, 'conclude');
  assert.strictEqual(a.evaluation.verdict, 'keep');
  assert.ok(a.model.learned['volumeResponse:chest']);
});

test('nextAction: active experiment with thin data → keep running it', () => {
  const experiment = designExperiment({ id: 'volume:chest', type: 'volume', target: 'chest', muscle: 'chest', paramKey: 'volumeResponse:chest' });
  const a = nextAction({ model: { learned: {} }, activeExperiment: experiment, armData: { A: [1.0], B: [1.1] } });
  assert.strictEqual(a.action, 'continue');
});
