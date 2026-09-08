/**
 * headCoverage.mjs — audits whether generated programs train every HEAD of each
 * muscle, not just the muscle.
 *
 * programAudit.mjs proves weekly set counts land in range. Set counts cannot see
 * that a chest hit 14 times was pressed flat 14 times and never declined, or
 * that both triceps slots were pushdowns and the long head was never lengthened.
 * That is the difference between "enough volume" and "correct targeting".
 *
 * Heads come from two places in the library:
 *   • the pattern's own muscles[] — upper/mid/lower chest, lats vs traps, the
 *     three deltoid heads
 *   • the chosen exercise's load_position — the only thing that separates a
 *     triceps LONG head (loaded stretched, overhead) from the lateral/medial
 *     heads (loaded contracted, pushdowns and kickbacks). Same for the biceps
 *     long head (incline/Bayesian) vs short head (preacher).
 *
 * Run: node --loader ./scripts/extres.mjs scripts/headCoverage.mjs
 */
import { generateProgram } from '../screens/programGenerator.js';
import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';

// Which heads a slot trains, given the pattern and the exercise picked for it.
function headsOf(ex) {
  const pattern = MOVEMENT_PATTERNS[ex.pattern];
  if (!pattern) return [];
  const heads = [];
  const primary = (pattern.muscles || [])[0] || '';
  const p = primary.toLowerCase();

  if (p === 'upper chest') heads.push('chest:upper');
  if (p === 'chest' || p === 'mid chest') heads.push('chest:mid');
  if (p === 'lower chest') heads.push('chest:lower');
  if (p === 'lats') heads.push('back:lats');
  if (p === 'rhomboids' || p === 'mid-traps') heads.push('back:mid');
  if (p === 'upper trapezius') heads.push('back:traps');
  if (p === 'shoulders' || p === 'anterior delts') heads.push('delts:front');
  if (p === 'side deltoids') heads.push('delts:side');
  if (p === 'rear deltoids') heads.push('delts:rear');
  if (p === 'quads') heads.push('quads');
  if (p === 'hamstrings') heads.push('hamstrings');
  if (p === 'glutes') heads.push('glutes');
  if (p === 'rectus abdominis') heads.push('abs');

  // Arms: the head depends on where the load sits, not on the pattern.
  if (ex.pattern === 'triceps') {
    heads.push(ex.load_position === 'stretch' ? 'triceps:long' : 'triceps:lateral');
  }
  if (ex.pattern === 'biceps') {
    heads.push(ex.load_position === 'stretch' ? 'biceps:long' : 'biceps:short');
  }
  // Calves: the knee angle decides. A bent knee slackens the gastrocnemius and
  // leaves the soleus to do the work, so seated and standing are not swappable.
  if (ex.pattern === 'calves') {
    heads.push(/seated/i.test(ex.name) ? 'calves:soleus' : 'calves:gastroc');
  }
  return heads;
}

// What a complete program has to cover.
const REQUIRED = [
  'chest:upper', 'chest:mid', 'chest:lower',
  'back:lats', 'back:mid',
  'delts:front', 'delts:side', 'delts:rear',
  'triceps:long', 'triceps:lateral',
  'biceps:long', 'biceps:short',
  'quads', 'hamstrings', 'glutes',
  'calves:gastroc', 'calves:soleus',
  'abs',
];

// Two sessions a week cannot carry eighteen heads and still hit volume: 9 slots
// x 2 days is 18 slots for 18 heads, leaving nothing for the second slot any
// muscle needs to reach its floor. A 2-day lifter gets one head per arm, and the
// pressing heads it can fit — that is a real constraint of the frequency, not a
// programming defect, so it is scored against a reduced list instead of hidden.
const REDUCED = REQUIRED.filter(h => ![
  'chest:lower', 'triceps:lateral', 'biceps:short', 'abs',
].includes(h));

export function coverage(profile) {
  const p = generateProgram(profile);
  const required = (parseInt(profile.weekly_workouts) || 3) <= 2 ? REDUCED : REQUIRED;
  const seen = new Set();
  let slots = 0;
  const perDay = [];
  for (const day of p.days || []) {
    const n = (day.exercises || []).filter(e => e?.name && e.sets > 0).length;
    perDay.push(n);
    slots += n;
    for (const ex of day.exercises || []) headsOf(ex).forEach(h => seen.add(h));
  }
  return {
    split: p?.name,
    missing: required.filter(h => !seen.has(h)),
    perDay,
    slots,
  };
}

const EQUIP = { 'full gym': ['Barbell', 'Dumbbells', 'Cables', 'Machines'] };
const EXPS = ['under_6m', '6m_to_2y', 'over_4y'];
const DAYS = [2, 3, 4, 5, 6];

const missTally = {}, splitMiss = {};
let n = 0, clean = 0;
for (const [, equipment] of Object.entries(EQUIP))
  for (const trainingExperience of EXPS)
    for (const weekly_workouts of DAYS)
      for (const sex of ['male', 'female']) {
        n++;
        const r = coverage({ trainingExperience, equipment, weekly_workouts, goals: ['gain'], sex, weight_kg: 80 });
        if (!r.missing.length) clean++;
        for (const m of r.missing) {
          missTally[m] = (missTally[m] || 0) + 1;
          (splitMiss[r.split] = splitMiss[r.split] || new Set()).add(m);
        }
      }

console.log(`swept ${n} programs — ${clean} cover every head, ${n - clean} have gaps\n`);
console.log('MISSING HEADS (programs affected)');
Object.entries(missTally).sort((a, b) => b[1] - a[1])
  .forEach(([h, c]) => console.log('  ', String(c).padStart(3), h));

console.log('\nBY SPLIT');
for (const [split, set] of Object.entries(splitMiss)) {
  console.log(`  ${split}\n     ${[...set].join(', ')}`);
}

console.log('\nSESSION SIZE (exercises per day, intermediate)');
for (const weekly_workouts of DAYS) {
  const r = coverage({ trainingExperience: '6m_to_2y', equipment: EQUIP['full gym'], weekly_workouts, goals: ['gain'], sex: 'male', weight_kg: 80 });
  console.log(`  ${weekly_workouts}d  ${r.split}: ${r.perDay.join('/')}`);
}
