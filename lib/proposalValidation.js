// Validation for coach-proposed program changes, before they become an
// "Apply" card or a database row.
//
// The AI coach returns proposals as structured tool-call output. Live
// behavioural testing against the real model showed it intermittently emits a
// propose_program_change with no day_id (seen on multi-slot sweeps across two
// separate runs). Such a proposal cannot identify a slot: saveProposal falls
// back to day_id: '' and writes an override row that no day will ever match —
// invisible to the user, permanently inert, and counted as if a real change
// had been made.
//
// The edge function filters these server-side too. This is the client half of
// that defence: the two ends are deliberately independent, so an older
// deployed function paired with a newer client (or the reverse) still can't
// surface a malformed card.

/**
 * A proposal is applicable only if it identifies the slot it changes.
 * add_exercise is the one edit type with no index — it creates a new slot
 * rather than targeting an existing one.
 */
export function isApplicableProposal(p) {
  if (!p || !p.day_id || !p.edit_type) return false;
  // A replace/add with no exercise_name names nothing to change TO. Seen live
  // on a large sweep ("EZ-bar skullcrusher -> undefined"): saveProposal can't
  // resolve it, so the card renders and then silently fails on Apply. Better
  // to never show it.
  if (p.edit_type === 'add_exercise') return !!p.exercise_name;
  if (p.edit_type === 'replace_exercise' && !p.exercise_name) return false;
  return Number.isInteger(p.exercise_index);
}

export function filterApplicableProposals(proposals) {
  return (proposals || []).filter(isApplicableProposal);
}

/** Stable identity for a slot, used to dedupe proposals targeting the same one. */
export function proposalSlotKey(p) {
  return `${p?.day_id}#${p?.exercise_index}`;
}

/**
 * Drops proposals that target a slot already covered by an earlier proposal.
 * A continuation turn occasionally re-proposes a slot it already handled;
 * without this the user sees two cards for one exercise.
 */
export function dedupeProposalsBySlot(proposals) {
  const seen = new Set();
  return (proposals || []).filter(p => {
    const key = proposalSlotKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Applies both guards in the order the UI needs them. */
export function sanitizeProposals(proposals) {
  return dedupeProposalsBySlot(filterApplicableProposals(proposals));
}
