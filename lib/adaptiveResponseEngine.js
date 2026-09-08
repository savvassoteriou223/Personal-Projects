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
    // A volume trial's INTERVENTION is a muscle's weekly sets, but its OUTCOME
    // has to be measured on a lift — "est-1RM slope of calves" is not a
    // quantity. Carry a representative lift for the muscle so the protocol can
    // name something measurable; without one there is nothing to read the
    // result off, so the candidate is not offered at all.
    const metricLift = (context.lifts || []).find(l => l.muscle === muscle)?.name || null;
    if (!metricLift) continue;
    cands.push({ id: `volume:${muscle}`, type: 'volume', target: muscle, muscle, metricLift });
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
    metric: `est-1RM slope of ${candidate.metricLift || candidate.target} (kg/week)`,
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


// ── Context & arm bucketing ───────────────────────────────────────────────────
// These read a program and a set log but touch no network and no database, so
// they live with the rest of the pure engine rather than in the store. Keeping
// them here is also what makes them testable: importing the store pulls in the
// Supabase client, which needs a React Native runtime.

// What the engine needs to know about how this person currently trains: which
// lifts, how often, and which muscles they care about. Frequency comes from the
// program rather than from logs, because the question a frequency trial asks is
// "what if we PRESCRIBED two days" — prescription, not adherence.
export function buildContext(program, profile, weeklyVolume = {}) {
  const freq = {};
  const muscleOf = {};
  for (const day of program?.days || []) {
    for (const ex of day.exercises || []) {
      if (!ex?.name) continue;
      freq[ex.name] = (freq[ex.name] || 0) + 1;
      if (ex.muscles) muscleOf[ex.name] = String(ex.muscles).split(',')[0].trim().toLowerCase();
    }
  }
  const lifts = Object.entries(freq).map(([name, weeklyFrequency]) => ({
    name, weeklyFrequency, muscle: muscleOf[name] || null,
  }));

  // Priorities: the muscles this lifter is furthest below target on. A trial is
  // only worth a lifter's weeks if it is aimed at something they care about,
  // and an under-served muscle is the most defensible reading of that without
  // asking them to rank body parts.
  const priorities = Object.entries(weeklyVolume)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([muscle]) => muscle);

  return { lifts, priorities, goals: profile?.goals || [] };
}


// Outcome points for each arm, taken only from sets logged inside that arm's
// window. Anything logged before the arm started belongs to the old condition
// and would blur the comparison.
export function collectArmData(experimentRow, sets = []) {
  // Stored points win when they exist, so a trial that recorded its own outcome
  // is read back verbatim.
  const stored = experimentRow?.metric_points_json || [];
  if (stored.length) {
    const byArm = { A: [], B: [] };
    for (const p of stored) if (byArm[p.arm]) byArm[p.arm].push(p.value);
    return byArm;
  }

  // Otherwise derive the outcome from the sets already logged. This is what
  // lets a trial conclude at all: nothing writes metric_points during a
  // workout, so a trial relying on stored points could never reach a verdict.
  //
  // Deriving is also the more honest design — the outcome is recomputed from
  // the raw log every time rather than frozen at write time, so a corrected or
  // deleted set changes the verdict instead of leaving a stale number behind.
  const started = experimentRow?.arm_started_at ? new Date(experimentRow.arm_started_at).getTime() : null;
  const protocol = experimentRow?.protocol_json;
  if (!started || !protocol) return { A: [], B: [] };

  // The metric names a lift; find it in the log. Frequency trials target the
  // lift directly, volume trials carry a representative one.
  const lift = protocol.metricLift || (protocol.type === 'frequency' ? protocol.target : null);
  if (!lift) return { A: [], B: [] };

  const armMs = (protocol.weeksPerArm || 3) * 7 * 864e5;
  const crossover = started + armMs;
  const end = crossover + armMs;

  const byArm = { A: [], B: [] };
  const bySession = {};
  for (const set of sets) {
    if (set.exercise_name !== lift) continue;
    const at = new Date(set.completed_at).getTime();
    if (!at || at < started || at >= end) continue;   // outside the trial window
    const e = est1RM(set.weight_kg, set.reps);
    if (e == null) continue;
    // One point per session — the best set. Counting every set would weight a
    // session by how many sets it happened to contain, which is precisely the
    // variable a volume trial is manipulating.
    const key = `${at < crossover ? 'A' : 'B'}|${set.completed_at}`;
    bySession[key] = Math.max(bySession[key] ?? 0, e);
  }
  for (const [key, value] of Object.entries(bySession)) {
    byArm[key.split('|')[0]].push(+value.toFixed(2));
  }
  return byArm;
}

// Epley, matching individualModel's estimator. Duplicated rather than imported
// so this module stays dependency-free and independently testable.
function est1RM(weightKg, reps) {
  if (!weightKg || !reps || reps < 1) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export const _internal = { mean, sd };
