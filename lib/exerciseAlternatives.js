// Holds coach-suggested replacements inside the slot they replace.
//
// The coach offers ranked alternatives when the user asks to swap an exercise
// without naming a replacement. Those options come back from the model, and a
// wrong one is invisible: offering a flat barbell bench press to replace a
// decline press reads as a sensible "bench press alternative", but the decline
// slot is the day's only lower-chest work, and applying it deletes that region
// along with the sets the split allocated to it.
//
// Prompt rule 7b asks the model to stay in the pattern. This is the enforcement.

import { getAllExercisesForPattern } from '../screens/movementLibrary';
import { resolveExerciseByName, normalizeEquipment } from '../screens/programGenerator';

const MAX_OPTIONS = 3;

// Drops any offered alternative that sits in a different movement pattern than
// the exercise being replaced, then tops the list back up from that pattern's
// own equipment-filtered pool so a filtered card still offers a real choice.
//
// `alts` is the suggest_exercise_alternatives payload; returns the same shape.
export function keepInPatternAlternatives(alts, equipmentList) {
  const current = alts?.current_exercise;
  const resolved = current ? resolveExerciseByName(current) : null;
  // A name the library doesn't know (a renamed or hand-entered slot) has no
  // pattern to hold the options to — pass it through rather than emptying it.
  if (!resolved?.patternKey) return alts;

  const offered = alts.alternatives || [];
  const inPattern = offered.filter(opt => {
    const r = opt?.exercise_name ? resolveExerciseByName(opt.exercise_name) : null;
    return r?.patternKey === resolved.patternKey;
  });
  if (inPattern.length === offered.length) return alts;

  const equipment = normalizeEquipment(equipmentList || []);
  const pool = getAllExercisesForPattern(resolved.patternKey, equipment) || [];
  const taken = new Set([
    current.toLowerCase(),
    ...inPattern.map(o => o.exercise_name?.toLowerCase()),
  ]);
  const topUps = pool
    .filter(e => !taken.has(e.name.toLowerCase()))
    .slice(0, Math.max(0, MAX_OPTIONS - inPattern.length))
    .map(e => ({
      exercise_name: e.name,
      // The library's own note, first sentence only — a real rationale rather
      // than one invented to justify a substitution the model didn't make.
      rationale: e.research_note ? `${e.research_note.split('. ')[0]}.` : null,
    }));

  return { ...alts, alternatives: [...inPattern, ...topUps] };
}
