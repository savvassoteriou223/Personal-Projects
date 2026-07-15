// ─── READINESS ────────────────────────────────────────────────────────────────
// Pure scoring + session adjustment. No imports, no I/O — so it runs under
// `node --test` with no test framework and no React Native.
//
// WHY NO WEIGHT ADJUSTMENT: the app never prescribes load. exerciseToSetState
// (WorkoutExecutionScreen.jsx) has no weight field; the weight input is only a
// "last time" placeholder and the user types the number. So "drop 10%" would be
// lowering a value that does not exist, to tell someone to do something they are
// already free to do. We adjust what the app actually prescribes: effort
// (last_rpe) and volume (target_sets). That IS autoregulation — see
// `effort_failure_not_required` (Enes 2024) in studiesLibrary.js.

const SLEEP    = { good: 2, ok: 1, poor: 0 };
const SORENESS = { fresh: 2, normal: 1, sore: 0 };
const ENERGY   = { high: 2, ok: 1, low: 0 };

// Rendered by the check-in sheet. `labelKey`/`optionKeys` are i18n keys —
// the VALUES ('good' etc.) are the stable logic tokens and are never translated.
export const READINESS_QUESTIONS = [
  { id: 'sleep',    labelKey: 'readiness.q.sleep',    options: ['good', 'ok', 'poor'] },
  { id: 'soreness', labelKey: 'readiness.q.soreness', options: ['fresh', 'normal', 'sore'] },
  { id: 'energy',   labelKey: 'readiness.q.energy',   options: ['high', 'ok', 'low'] },
];

const RPE_FLOOR = 6;
const SETS_FLOOR = 1;

// Returns a STABLE English label for logic. Display must translate separately —
// getProactiveCoachPrompt compares recoveryLabel === 'Low'.
export function scoreCheckIn({ sleep, soreness, energy } = {}) {
  const score = (SLEEP[sleep] ?? 0) + (SORENESS[soreness] ?? 0) + (ENERGY[energy] ?? 0);
  const label = score >= 5 ? 'Ready' : score >= 3 ? 'Moderate' : 'Low';
  return { score, label };
}

// Returns a NEW sets array (never mutates). Identity-returns on 'Ready'.
export function adjustSessionForReadiness(sets, label) {
  if (label !== 'Moderate' && label !== 'Low') return sets;
  const dropSet = label === 'Low';
  return sets.map(ex => {
    const nextSets = dropSet ? Math.max(SETS_FLOOR, (ex.target_sets ?? 1) - 1) : ex.target_sets;
    return {
      ...ex,
      last_rpe: Math.max(RPE_FLOOR, (ex.last_rpe ?? 9) - 2),
      target_sets: nextSets,
      // completedSets length is derived from target_sets everywhere else in the
      // app, so keep them in lockstep or the UI renders a phantom row.
      completedSets: ex.completedSets.slice(0, nextSets),
    };
  });
}
