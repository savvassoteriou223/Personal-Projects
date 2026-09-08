/**
 * areStore — the integration layer for the Adaptive Response Engine.
 *
 * lib/individualModel.js and lib/adaptiveResponseEngine.js are pure: they can
 * model a lifter, decide what is worth testing, design a pre-registered trial,
 * and judge the result — but they cannot remember anything, read the user's
 * sets, or change a program. That is why the engine shipped and then did
 * nothing: nothing ever called it.
 *
 * This module is the missing half. It loads the training data, assembles the
 * model, runs one step of the loop, and persists whatever came out. It performs
 * no program edits itself — a trial only changes training after the user opts
 * in, and the change is routed through the same proposal pipeline every other
 * coach edit uses, so it is reviewable and revertible.
 *
 * Spec: docs/specs/adaptive-response-engine.md (§10 schema, §11 guardrails).
 */
import { supabase } from '../supabase';
import { assembleModel } from './individualModel';
import { nextAction, buildContext, collectArmData } from './adaptiveResponseEngine';

// A trial compares two arms over several weeks. Below this there is not enough
// history to estimate the user's own noise, and without that the minimum
// detectable effect is a guess — so the engine stays quiet rather than
// designing a trial it cannot honestly judge.
const MIN_SETS_TO_MODEL = 60;
const MIN_WEEKS_OF_HISTORY = 4;

// ── Persistence ──────────────────────────────────────────────────────────────

export async function loadState(userId) {
  const [{ data: params }, { data: experiments }] = await Promise.all([
    supabase.from('are_individual_model').select('*').eq('user_id', userId),
    supabase.from('are_experiments').select('*').eq('user_id', userId)
      .in('status', ['proposed', 'running']).order('created_at', { ascending: false }),
  ]);

  const learned = {};
  for (const row of params || []) {
    learned[row.param_key] = {
      value: row.value, effect: row.effect,
      confidence: row.confidence, note: row.note,
      testedAt: row.tested_at ? new Date(row.tested_at).getTime() : null,
    };
  }
  const running = (experiments || []).find(e => e.status === 'running') || null;
  const proposed = (experiments || []).find(e => e.status === 'proposed') || null;
  return { learned, running, proposed };
}

async function saveLearned(userId, learned, previous) {
  // Only write parameters the loop actually changed this step. Rewriting the
  // whole model every run would bump tested_at on findings that were not
  // retested, making old evidence look fresh.
  const rows = Object.entries(learned)
    .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(previous[k]))
    .map(([param_key, v]) => ({
      user_id: userId, param_key,
      value: v.value ?? null, effect: v.effect ?? null,
      confidence: v.confidence ?? 0.7, note: v.note ?? null,
      tested_at: new Date(v.testedAt || Date.now()).toISOString(),
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  await supabase.from('are_individual_model').upsert(rows, { onConflict: 'user_id,param_key' });
}

// ── One step of the loop ─────────────────────────────────────────────────────

/**
 * Runs the engine once and persists the outcome.
 *
 * Returns { action, ... } straight from nextAction, plus `blocked` when there is
 * not enough history to model this person honestly. Never edits the program —
 * callers decide what to surface, and nothing changes training until opt-in.
 */
export async function step(userId, { sets = [], program, profile, weeklyVolume, weeksOfHistory = 0 } = {}) {
  if (sets.length < MIN_SETS_TO_MODEL || weeksOfHistory < MIN_WEEKS_OF_HISTORY) {
    // §11: the app says when it does not have enough signal, rather than
    // manufacturing a finding.
    return { action: 'idle', blocked: 'insufficient_history', have: sets.length, need: MIN_SETS_TO_MODEL };
  }

  const { learned, running, proposed } = await loadState(userId);
  const model = assembleModel(sets, { learned });
  const context = buildContext(program, profile, weeklyVolume);

  const activeExperiment = running ? running.protocol_json : null;
  const armData = running ? collectArmData(running, sets) : null;

  const result = nextAction({ model, activeExperiment, armData, context });

  if (result.action === 'conclude' && running) {
    await supabase.from('are_experiments').update({
      status: 'concluded',
      verdict: result.evaluation?.verdict || 'inconclusive',
      verdict_detail: result.evaluation || null,
      updated_at: new Date().toISOString(),
    }).eq('id', running.id);
    await saveLearned(userId, result.model?.learned || {}, learned);
  }

  if (result.action === 'propose') {
    // Do not queue a second proposal on top of one the user has not answered.
    if (proposed) return { ...result, action: 'propose', experimentRow: proposed, alreadyProposed: true };
    const { data } = await supabase.from('are_experiments').insert({
      user_id: userId,
      target_param: result.experiment.paramKey,
      protocol_json: result.experiment,
      status: 'proposed',
    }).select().single();
    return { ...result, experimentRow: data || null };
  }

  return { ...result, experimentRow: running };
}

// ── Opt-in / opt-out (§11) ───────────────────────────────────────────────────

export async function acceptExperiment(experimentId) {
  return supabase.from('are_experiments').update({
    status: 'running', current_arm: 'A',
    arm_started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', experimentId);
}

// The escape hatch. A trial the user cannot walk away from is not consent, and
// an abandoned trial must never write a verdict — a half-run comparison is not
// evidence about this person.
export async function abandonExperiment(experimentId) {
  return supabase.from('are_experiments').update({
    status: 'abandoned', updated_at: new Date().toISOString(),
  }).eq('id', experimentId);
}
