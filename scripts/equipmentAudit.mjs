/**
 * equipmentAudit.mjs — sweeps the REAL onboarding equipment options (not the
 * 3 coarse buckets programAudit.mjs uses) through generateProgram, and checks
 * two things programAudit.mjs doesn't:
 *
 *  1. Equipment coverage: does every pattern in every split resolve to at
 *     least one exercise for this exact equipment set? buildExercise() fails
 *     SILENTLY (returns null, slot dropped) — it never throws — so a gap here
 *     shows up as a muscle sitting at 0 sets, not a crash.
 *
 *  2. Optimal range, not just minimum: programAudit.mjs only flags done < min
 *     or done > optimal_high. A muscle that clears min but never reaches
 *     optimal_low is currently invisible. This flags that gray zone too.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/equipmentAudit.mjs
 */
import { generateProgram, VOLUME_TARGETS } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';

const TIER = { under_6m: 'beginner', '6m_to_2y': 'intermediate', '2y_to_4y': 'intermediate', over_4y: 'advanced' };

// Real onboarding values (screens/OnboardingScreen.jsx EQUIPMENT list) — single
// selections and the realistic combos a real user actually ticks, not a full
// powerset of 8 (256 combos, mostly nonsensical).
const EQUIP_SCENARIOS = {
  'barbell only':          ['Barbell'],
  'dumbbells only':        ['Dumbbells'],
  'cables only':           ['Cables'],
  'machines only':         ['Machines'],
  'bodyweight only':       ['Bodyweight only'],
  'pullup bar only':       ['Pull-up bar'],
  'kettlebells only':      ['Kettlebells'],
  'bands only':            ['Resistance bands'],
  'bodyweight + bands':    ['Bodyweight only', 'Resistance bands'],
  'bodyweight + pullup':   ['Bodyweight only', 'Pull-up bar'],
  'bodyweight + kb':       ['Bodyweight only', 'Kettlebells'],
  'home dumbbells':        ['Dumbbells', 'Bodyweight only'],
  'full gym':              ['Barbell', 'Dumbbells', 'Cables', 'Machines', 'Pull-up bar'],
  'garage gym (bb+db)':    ['Barbell', 'Dumbbells'],
};

const EXPS = ['under_6m', '6m_to_2y', '2y_to_4y', 'over_4y'];
const DAYS = [2, 3, 4, 5, 6];
const GOALS = [['gain'], ['strength'], ['lose']];

const zeroSetFindings = {};   // muscle got 0 direct sets — equipment gap
const belowOptimal = {};      // cleared min, never reached optimal_low
let n = 0, crashes = 0;

for (const [label, equipment] of Object.entries(EQUIP_SCENARIOS))
  for (const trainingExperience of EXPS)
    for (const weekly_workouts of DAYS)
      for (const goals of GOALS)
        for (const sex of ['male', 'female']) {
          n++;
          let p, weekSets = [];
          try {
            p = generateProgram({ trainingExperience, equipment, weekly_workouts, goals, sex, weight_kg: 80 });
          } catch (e) {
            crashes++;
            const k = `CRASH: ${e.message.slice(0, 80)}`;
            zeroSetFindings[k] = (zeroSetFindings[k] || 0) + 1;
            continue;
          }
          for (const day of p.days || [])
            for (const ex of day.exercises || []) {
              if (!ex?.name || (ex.sets || 0) <= 0) continue;
              for (let i = 0; i < ex.sets; i++)
                weekSets.push({ exercise_name: ex.name, pattern_key: ex.pattern, reps: 10, weight_kg: 50, set_type: 'working' });
            }

          const tier = TIER[trainingExperience] || 'intermediate';
          for (const g of buildVolumeView(weekSets, tier)) {
            const check = (labelKey, done, t) => {
              if (!t) return;
              if (done === 0 && t.min > 0) {
                const k = `${labelKey}: 0 sets (equipment gap) — ${label}, ${weekly_workouts}d, ${trainingExperience}`;
                zeroSetFindings[k] = (zeroSetFindings[k] || 0) + 1;
              } else if (done >= t.min && done < t.optimal_low) {
                const k = `${labelKey} | ${weekly_workouts}d`;
                belowOptimal[k] = (belowOptimal[k] || 0) + 1;
              }
            };
            if (g.split) g.heads.forEach(h => check(h.key, h.direct, h.target));
            else check(g.key, g.done, g.target);
          }
        }

console.log(`swept ${n} programs across ${Object.keys(EQUIP_SCENARIOS).length} equipment scenarios × ${EXPS.length} experience × ${DAYS.length} day-counts × ${GOALS.length} goals × 2 sexes\n`);
console.log(`crashes: ${crashes}\n`);

console.log('═══ ZERO-SET FINDINGS (equipment gaps — a whole muscle got nothing) ═══');
const zSorted = Object.entries(zeroSetFindings).sort((a, b) => b[1] - a[1]);
if (!zSorted.length) console.log('  none');
zSorted.slice(0, 60).forEach(([k, c]) => console.log('  ', String(c).padStart(4), k));

console.log('\n═══ BELOW-OPTIMAL (clears minimum, never reaches optimal_low), by muscle × day-count ═══');
const grid = {};
for (const [k, c] of Object.entries(belowOptimal)) {
  const [muscle, days] = k.split(' | ');
  (grid[muscle] = grid[muscle] || {})[days] = (grid[muscle][days] || 0) + c;
}
const dayCols = DAYS.map(d => `${d}d`);
console.log('  ', 'muscle'.padEnd(14), dayCols.map(d => d.padStart(6)).join(''));
Object.entries(grid).sort((a, b) => {
  const suma = Object.values(a[1]).reduce((x, y) => x + y, 0);
  const sumb = Object.values(b[1]).reduce((x, y) => x + y, 0);
  return sumb - suma;
}).forEach(([m, byDay]) => {
  console.log('  ', m.padEnd(14), dayCols.map(d => String(byDay[d] || 0).padStart(6)).join(''));
});
