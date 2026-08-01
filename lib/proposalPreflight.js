// What the coach must know before it changes anything.
//
// A replacement is an answer to "what does this slot exist to do?", not "what
// is a similar exercise?". The model is told this (ai-coach rule 7b) and made
// to declare its understanding on the tool call; these pure helpers are the
// app-side verification, because a misunderstanding here is invisible in the
// UI — a flat bench press offered for a decline slot reads as perfectly
// sensible while deleting the day's lower-chest work.

import { resolveExerciseByName } from '../screens/programGenerator';

// Compares the slot being replaced with the proposed replacement.
// `known` is false when either name is outside the library (renamed or
// hand-entered slots) — no judgement is possible, so none is made.
export function replacementPatternCheck(currentName, proposedName) {
  const cur = currentName ? resolveExerciseByName(currentName) : null;
  const next = proposedName ? resolveExerciseByName(proposedName) : null;
  if (!cur?.patternKey || !next?.patternKey) return { known: false, crosses: false };
  return {
    known: true,
    crosses: cur.patternKey !== next.patternKey,
    from: cur.patternKey,
    to: next.patternKey,
  };
}

// Movement patterns with exactly ONE slot across the whole program. Replacing
// that slot out-of-group, or removing it, deletes the region's training
// entirely — the highest-stakes edit the coach can make, and the one the
// context must put on the line the model is about to touch.
export function soleSlotPatterns(days) {
  const counts = {};
  for (const day of days || []) {
    for (const ex of day.exercises || []) {
      const k = resolveExerciseByName(ex.name)?.patternKey;
      if (k) counts[k] = (counts[k] || 0) + 1;
    }
  }
  return new Set(Object.keys(counts).filter(k => counts[k] === 1));
}
