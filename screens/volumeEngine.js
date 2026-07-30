// Helix Volume Engine
// ─────────────────────────────────────────────────────────────────────────────
// One source of truth for weekly volume, shared by the Today heat map and the
// AI coach. Counts volume per muscle HEAD (front/side/rear delts, lats/traps,
// upper/lower chest …) and separates DIRECT from INDIRECT work:
//
//   • direct   — the exercise's primary muscle (1 set credited)
//   • indirect — each secondary muscle the movement also trains (0.5 set)
//
// The VOLUME_TARGETS in programGenerator are calibrated for DIRECT isolation
// volume (their notes say e.g. "rows add indirect volume on top"). So the bar /
// status is ALWAYS judged on direct volume against the target — indirect work is
// reported alongside ("+N indirect") so a lifter can see that pressing feeds the
// front delts and pulling feeds the rear delts, without double-counting it into
// the target comparison.

import { MOVEMENT_PATTERNS } from './movementLibrary';
import { getVolumeTargets } from './programGenerator';

const SECONDARY_WEIGHT = 0.5;

// Exercise name (lowercased) → its pattern's muscle list (primary first).
const EXERCISE_MUSCLES = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(p => {
    (p.exercises || []).forEach(ex => {
      if (ex?.name) map[ex.name.toLowerCase()] = p.muscles || [];
    });
  });
  return map;
})();

// Raw library muscle name → head bucket key.
export function muscleToHead(raw) {
  const r = (raw || '').toLowerCase().trim();
  if (r === 'chest') return 'chest';
  if (r === 'upper chest') return 'upper_chest';
  if (r === 'lower chest') return 'lower_chest';
  if (r === 'lats') return 'lats';
  if (r === 'traps' || r === 'upper traps' || r === 'upper trapezius' ||
      r === 'mid-traps' || r === 'rhomboids' || r === 'levator scapulae') return 'traps';
  if (r === 'lower back') return 'lower_back';
  if (r === 'shoulders' || r === 'anterior delts') return 'front_delts';
  if (r === 'side deltoids') return 'side_delts';
  if (r === 'rear delts' || r === 'rear deltoids' || r === 'external rotators') return 'rear_delts';
  if (r === 'biceps' || r === 'brachialis') return 'biceps';
  if (r === 'triceps') return 'triceps';
  if (r === 'quads') return 'quads';
  if (r === 'hamstrings') return 'hamstrings';
  if (r === 'glutes' || r === 'glute medius' || r === 'glute minimus') return 'glutes';
  if (r === 'gastrocnemius' || r === 'soleus' || r === 'calves') return 'calves';
  if (r === 'rectus abdominis' || r === 'obliques') return 'abs';
  if (r === 'forearms' || r === 'brachioradialis' ||
      r === 'wrist flexors' || r === 'wrist extensors') return 'forearms';
  return null;
}

// sets: [{ exercise_name, pattern_key }] — one entry per completed working set.
// Returns { head: { direct, indirect } } with fractional set credit.
export function computeHeadVolume(sets = []) {
  const vol = {};
  const add = (head, key, amt) => {
    if (!head) return;
    if (!vol[head]) vol[head] = { direct: 0, indirect: 0 };
    vol[head][key] += amt;
  };
  sets.forEach(s => {
    // pattern_key first. It is the durable link to MOVEMENT_PATTERNS: it
    // survives coach swaps, mid-workout replacements and display-name changes.
    // Matching on the name alone meant any set whose stored name was not an
    // exact library key registered under NO muscle and vanished from the chart
    // without a trace — the user logged five sets of calves and saw four.
    const byPattern = s.pattern_key ? MOVEMENT_PATTERNS[s.pattern_key]?.muscles : null;
    const muscles = byPattern || EXERCISE_MUSCLES[s.exercise_name?.toLowerCase()] || [];
    if (!muscles.length) return;
    add(muscleToHead(muscles[0]), 'direct', 1);
    muscles.slice(1).forEach(m => add(muscleToHead(m), 'indirect', SECONDARY_WEIGHT));
  });
  return vol;
}

// Display groups for the simple heat map. Each expands into heads for the
// detailed view. `targetKey` is the VOLUME_TARGETS key for the group total;
// a head's own `targetKey` (when present) means that head is monitored on its
// own target instead of the group total. `split: true` groups never roll their
// heads up into the group total — their status comes from the monitored heads
// (this is what stops the shoulders bar false-alarming, since front-delt work
// from pressing isn't lumped against the whole-deltoid target).
export const MUSCLE_GROUPS = [
  { key: 'chest', targetKey: 'chest', heads: [
    { key: 'upper_chest' }, { key: 'chest' }, { key: 'lower_chest' },
  ] },
  { key: 'back', targetKey: 'back', heads: [
    { key: 'lats' }, { key: 'traps' }, { key: 'lower_back' },
  ] },
  { key: 'shoulders', targetKey: 'shoulders', split: true, heads: [
    { key: 'front_delts' },                       // covered by pressing — informational only
    { key: 'side_delts', targetKey: 'side_delts' },
    { key: 'rear_delts', targetKey: 'rear_delts' },
  ] },
  { key: 'biceps',     targetKey: 'biceps',     heads: [{ key: 'biceps' }] },
  { key: 'triceps',    targetKey: 'triceps',    heads: [{ key: 'triceps' }] },
  { key: 'quads',      targetKey: 'quads',      heads: [{ key: 'quads' }] },
  { key: 'hamstrings', targetKey: 'hamstrings', heads: [{ key: 'hamstrings' }] },
  { key: 'glutes',     targetKey: 'glutes',     heads: [{ key: 'glutes' }] },
  { key: 'calves',     targetKey: 'calves',     heads: [{ key: 'calves' }] },
  { key: 'abs',        targetKey: 'abs',        heads: [{ key: 'abs' }] },
];

const GREEN = '#1D9E75', AMBER = '#BA7517', RED = '#E85D5C';

export function colorForVolume(done, target) {
  if (!target) return GREEN;
  const junk = target.optimal_high * 1.5;
  if (done > junk) return RED;                 // junk volume
  if (done > target.optimal_high) return AMBER; // over optimal
  if (done < target.min) return RED;            // below minimum
  if (done < target.optimal_low) return AMBER;  // below optimal
  return GREEN;
}

// How far a head is outside its optimal window — used to pick the limiting head
// of a split group (the one whose status drives the group's colour).
function severity(direct, target) {
  if (!target) return -1;
  const { min, optimal_low, optimal_high } = target;
  const junk = optimal_high * 1.5;
  if (direct > junk) return 100 + (direct - junk);
  if (direct < min) return 90 + (min - direct);
  if (direct > optimal_high) return 50 + (direct - optimal_high);
  if (direct < optimal_low) return 40 + (optimal_low - direct);
  return 0;
}

const round1 = (n) => Math.round(n * 2) / 2; // nearest 0.5

// Builds everything both views need from a week of logged sets.
// Returns one entry per MUSCLE_GROUP: { key, split, done, target, color, heads }
// where each head is { key, direct, indirect, target, color }.
export function buildVolumeView(sets = [], tier = 'intermediate') {
  const headVol = computeHeadVolume(sets);
  const targets = getVolumeTargets(tier);

  return MUSCLE_GROUPS.map(group => {
    const heads = group.heads.map(h => {
      const v = headVol[h.key] || { direct: 0, indirect: 0 };
      const tgt = h.targetKey ? targets[h.targetKey] : null;
      const direct = round1(v.direct);
      return {
        key: h.key,
        direct,
        indirect: round1(v.indirect),
        target: tgt,
        color: tgt ? colorForVolume(direct, tgt) : GREEN,
      };
    });

    if (group.split) {
      // Status comes from the monitored heads only (side/rear delts). Front
      // delts have no direct target, so they never drive an alarm.
      const monitored = heads.filter(h => h.target);
      const limiting = monitored.reduce(
        (a, b) => (severity(b.direct, b.target) > severity(a.direct, a.target) ? b : a),
        monitored[0] || null,
      );
      return {
        key: group.key,
        split: true,
        done: limiting ? limiting.direct : 0,
        target: limiting ? limiting.target : null,
        color: limiting ? limiting.color : GREEN,
        heads,
      };
    }

    const target = targets[group.targetKey];
    const done = round1(heads.reduce((n, h) => n + (headVol[h.key]?.direct || 0), 0));
    return {
      key: group.key,
      split: false,
      done,
      target,
      color: colorForVolume(done, target),
      heads,
    };
  });
}
