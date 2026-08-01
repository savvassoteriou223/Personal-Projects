// The single decision: does this proposal ADD a new slot, or act on an
// EXISTING one (replace / adjust / remove)?
//
// This used to be answered twice — once to decide whether to skip
// exercise_index bounds-checking, once to decide which table to write to —
// and the two checks read different fields. The model naturally sends
// type:'permanent_edit' (it's a lasting change) + edit_type:'add_exercise'
// (what it does) for an addition; checking only `type` in the second place
// disagreed with checking `type` OR `edit_type` in the first. The bounds-check
// got (correctly) skipped, believing this was an add, and the write then fell
// into the REPLACE path using an exercise_index that had never been
// validated — silently overwriting an existing exercise instead of adding one.
//
// Routing through this one function everywhere makes that disagreement
// impossible: there is only one place either check can come from.
export function isAddProposal(p) {
  return p?.type === 'add_exercise' || p?.edit_type === 'add_exercise';
}
