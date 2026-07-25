// Adaptive Response Engine — the closed loop (spec §4-8, §12 phases 3-6).
// Pure functions. Given the Individual Response Model + context, decide what to test next,
// design a pre-registered n-of-1 protocol, judge the result with honest statistics, and
// write the verdict back into the model. No API calls, no side effects — the orchestration
// (persistence, program edits, opt-in UI) lives outside; this is the brain.

// ── Component 2: candidate experiments + value-of-information ──────────────────

// Generate the experiments the engine *could* run, from the user's training context.
// context: { lifts: [{ name, muscle, weeklyFrequency }], priorities: [muscle] }
export function generateCandidates(context = {}) {
  const cands = [];
  for (const lift of context.lifts || []) {
    // A frequency test only makes sense for a lift trained ≤1×/week (room to add a day).
    if ((lift.weeklyFrequency ?? 0) <= 1) {
      cands.push({ id: `frequency:${lift.name}`, type: 'frequency', target: lift.name, muscle: lift.muscle });
    }
  }
  for (const muscle of context.priorities || []) {
    cands.push({ id: `volume:${muscle}`, type: 'volume', target: muscle, muscle });
  }
  return cands;
}

// Rank candidates by value of information: how unknown the parameter is × how relevant it
// is to the user × how resolvable it is in a reasonable trial. Highest first.
export function rankExperiments(candidates, model = {}, context = {}) {
  const learned = model.learned || {};
  const priorities = new Set(context.priorities || []);
  return candidates
    .map((c) => {
      const paramKey = c.type === 'volume' ? `volumeResponse:${c.target}` : `frequencyResponse:${c.target}`;
      const known = learned[paramKey];
      const unknownness = known ? Math.max(0, 1 - (known.confidence || 0)) : 1;
      const relevance = priorities.has(c.muscle) ? 1 : 0.4;
      const resolvability = c.type === 'frequency' ? 0.8 : 0.7;
      return { ...c, paramKey, voi: +(unknownness * relevance * resolvability).toFixed(3) };
    })
    .sort((a, b) => b.voi - a.voi);
}

// ── Component 3: experiment design (pre-registered protocol) ──────────────────

// Everything is locked BEFORE the trial runs — that's what stops post-hoc rationalisation.
// mde is the minimum meaningful difference in the outcome metric (est-1RM slope, kg/week),
// derived by the caller from the user's own week-to-week noise; default is conservative.
export function designExperiment(candidate, { mde = 0.3, weeksPerArm = 3 } = {}) {
  const isFreq = candidate.type === 'frequency';
  return {
    id: candidate.id,
    type: candidate.type,
    target: candidate.target,
    muscle: candidate.muscle,
    paramKey: candidate.paramKey,
    variable: isFreq ? `weekly frequency of ${candidate.target}` : `weekly sets for ${candidate.muscle}`,
    arms: isFreq
      ? [{ name: 'A', value: 1 }, { name: 'B', value: 2 }]
      : [{ name: 'A', value: 'current' }, { name: 'B', value: 'current+6' }],
    held: 'all other muscles, intensity scheme, and bodyweight target',
    metric: `est-1RM slope of ${candidate.target} (kg/week)`,
    mde,
    weeksPerArm,
    decisionRule: 'keep B if B beats A by ≥ MDE with a medium+ effect size; revert if B is worse by the same; otherwise inconclusive → extend or shelve',
    createdAt: Date.now(),
  };
}

// ── Component 5: evaluation (the rigor is the invention) ──────────────────────

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

// Judge an experiment against its PRE-REGISTERED rule. armData: { A: [metric...], B: [...] }.
// Requires the difference to clear the MDE *and* a medium effect size relative to the user's
// own noise — so we never chase deltas smaller than week-to-week variance. "inconclusive" is
// a first-class, honest outcome. priorTests tightens the bar (crude false-discovery guard:
// the more tests a user has run, the larger the effect we demand by chance).
export function evaluateExperiment(protocol, armData = {}, { priorTests = 0 } = {}) {
  const A = armData.A || [], B = armData.B || [];
  if (A.length < 2 || B.length < 2) {
    return { verdict: 'inconclusive', reason: 'not enough data', extend: true };
  }
  const diff = mean(B) - mean(A);
  const pooled = Math.sqrt(((A.length - 1) * sd(A) ** 2 + (B.length - 1) * sd(B) ** 2) / (A.length + B.length - 2)) || 1e-9;
  const effectSize = diff / pooled;                 // Cohen's d
  const effectFloor = 0.5 + 0.1 * priorTests;       // demand more as tests accumulate
  const out = { diff: +diff.toFixed(3), effectSize: +effectSize.toFixed(2) };
  if (diff >= protocol.mde && effectSize >= effectFloor) return { verdict: 'keep', ...out };
  if (diff <= -protocol.mde && effectSize <= -effectFloor) return { verdict: 'revert', reason: 'B worse for you', ...out };
  return { verdict: 'inconclusive', extend: A.length + B.length < 8, ...out };
}

// ── Component 6: model write-back ─────────────────────────────────────────────

export function applyVerdict(model = {}, protocol, evaluation) {
  const learned = { ...(model.learned || {}) };
  if (evaluation.verdict === 'keep') {
    learned[protocol.paramKey] = { value: protocol.arms[1].value, effect: evaluation.diff, confidence: 0.7, testedAt: Date.now() };
  } else if (evaluation.verdict === 'revert') {
    learned[protocol.paramKey] = { value: protocol.arms[0].value, effect: 0, confidence: 0.7, testedAt: Date.now(), note: 'no benefit for you' };
  }
  return { ...model, learned };
}

// ── The loop ──────────────────────────────────────────────────────────────────

// One step of the closed loop. Pure: returns the action to take, never performs it.
// state: { model, activeExperiment, armData, context, designOpts, evalOpts }
//   → { action: 'continue'|'conclude'|'propose'|'idle', ... }
export function nextAction(state = {}) {
  const { model = {}, activeExperiment, armData, context = {} } = state;

  if (activeExperiment) {
    const evaluation = evaluateExperiment(activeExperiment, armData || {}, state.evalOpts);
    if (evaluation.verdict === 'inconclusive' && evaluation.extend) {
      return { action: 'continue', experiment: activeExperiment, evaluation };
    }
    return { action: 'conclude', experiment: activeExperiment, evaluation, model: applyVerdict(model, activeExperiment, evaluation) };
  }

  const ranked = rankExperiments(generateCandidates(context), model, context);
  if (!ranked.length || ranked[0].voi <= 0) return { action: 'idle', reason: 'nothing worth testing yet' };
  return { action: 'propose', candidate: ranked[0], experiment: designExperiment(ranked[0], state.designOpts) };
}

export const _internal = { mean, sd };
