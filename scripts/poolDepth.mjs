/**
 * poolDepth.mjs — how many exercise options each movement pattern actually has,
 * per realistic equipment set.
 *
 * Depth matters for three separate reasons:
 *   1. Block rotation cycles through the pool. A pattern with 2 options repeats
 *      every other block; with 1 it never varies at all.
 *   2. The coach offers 3 ranked alternatives on request. Fewer than 4 options
 *      means it cannot fill that list.
 *   3. A day needing two slots of one pattern (two side-delt slots, two triceps
 *      heads) needs at least 2 distinct options or the dedup pass merges them.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/poolDepth.mjs
 */
import { MOVEMENT_PATTERNS, getAllExercisesForPattern } from '../screens/movementLibrary.js';

const SETS = {
  // 'machines' implies 'smith' in the generator (programGenerator.js), so the
  // full-gym set has to include it or Smith variants read as unreachable.
  'full gym':    ['barbell', 'dumbbells', 'cables', 'machines', 'smith', 'pullup_bar', 'bodyweight'],
  'garage':      ['barbell', 'dumbbells', 'bodyweight', 'pullup_bar'],
  'dumbbells':   ['dumbbells', 'bodyweight'],
  'bodyweight':  ['bodyweight'],
  'bands':       ['bands', 'bodyweight'],
};
const NAMES = Object.keys(SETS);

const rows = Object.entries(MOVEMENT_PATTERNS).map(([key, pat]) => {
  const counts = {};
  for (const [n, eq] of Object.entries(SETS)) counts[n] = getAllExercisesForPattern(key, eq).length;
  return { key, label: pat.label || '', total: (pat.exercises || []).length, counts };
});

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('pattern', 26) + pad('all', 5) + NAMES.map(n => pad(n, 11)).join(''));
console.log('-'.repeat(26 + 5 + NAMES.length * 11));
rows.sort((a, b) => a.counts['full gym'] - b.counts['full gym']);
for (const r of rows) {
  console.log(pad(r.key, 26) + pad(r.total, 5) +
    NAMES.map(n => pad(r.counts[n] === 0 ? '— 0' : r.counts[n], 11)).join(''));
}

// A pattern needs 4+ options for the coach to offer 3 alternatives, and 3+ for
// block rotation to feel varied across a training year.
console.log('\nTHIN — under 4 options, so the coach cannot offer 3 alternatives:');
for (const n of NAMES) {
  const thin = rows.filter(r => r.counts[n] > 0 && r.counts[n] < 4);
  const none = rows.filter(r => r.counts[n] === 0);
  console.log(`\n  ${n}:`);
  if (none.length) console.log(`    NO OPTIONS AT ALL: ${none.map(r => r.key).join(', ')}`);
  if (thin.length) thin.forEach(r => console.log(`    ${r.counts[n]}  ${r.key}`));
  if (!thin.length && !none.length) console.log('    all patterns have 4+');
}

const gymThin = rows.filter(r => r.counts['full gym'] < 4);
console.log(`\n\nFull gym: ${gymThin.length} of ${rows.length} patterns have fewer than 4 options.`);
console.log(`Library total: ${rows.reduce((n, r) => n + r.total, 0)} exercises across ${rows.length} patterns ` +
  `(mean ${(rows.reduce((n, r) => n + r.total, 0) / rows.length).toFixed(1)}).`);
