/**
 * programAudit.mjs — audits generated programs on the two things that matter:
 *   1. weekly volume per muscle vs VOLUME_TARGETS
 *   2. muscle groups targeted on the right day, no duplicate slots
 *
 * Volume is measured with the app's own buildVolumeView(), the same function
 * that renders the user's "this week's volume" rows — so the audit cannot
 * disagree with what the app reports. A first version used
 * exerciseMuscleGroups() instead, which folds side/rear delts into "shoulders"
 * and counts secondary muscles as full sets; that produced ~1900 findings, most
 * of them measurement error rather than real defects.
 *
 * Run:  node --loader ./scripts/extres.mjs scripts/programAudit.mjs
 * (the loader resolves the app's extensionless imports for plain Node ESM)
 */
import { generateProgram } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';

const TIER = { under_6m: 'beginner', '6m_to_2y': 'intermediate', '2y_to_4y': 'intermediate', over_4y: 'advanced' };

// Side delts are shoulder abduction — push/shoulder work. A lateral raise on a
// back-and-biceps day is a targeting error, not a matter of taste.
const DAY_RULES = [
  // Only days that are PURELY one hemisphere. "Upper A — Push + Pull" legitimately
  // contains chest, side delts and biceps, so matching a bare /pull/ flagged
  // correct programming as an error.
  { match: /^pull/i, forbid: ['shoulders_side_delt', 'chest_horizontal_push', 'chest_incline_push', 'quad_isolation'] },
  { match: /^push/i, forbid: ['biceps', 'hamstring_isolation', 'back_horizontal_pull', 'back_vertical_pull'] },
  { match: /^(legs?|lower)/i, forbid: ['chest_horizontal_push', 'biceps', 'triceps', 'shoulders_side_delt'] },
];

export function auditProgram(profile) {
  const p = generateProgram(profile);
  const tier = TIER[profile.trainingExperience] || 'intermediate';
  const issues = [];
  const weekSets = []; // one entry per working set, as the app records them

  for (const day of p.days || []) {
    const slot = {}, patternsToday = new Set();
    for (const ex of day.exercises || []) {
      if (!ex?.name || (ex.sets || 0) <= 0) continue;
      slot[ex.pattern] = (slot[ex.pattern] || 0) + 1;
      patternsToday.add(ex.pattern);
      for (let i = 0; i < ex.sets; i++) weekSets.push({ exercise_name: ex.name });
    }
    for (const [pat, n] of Object.entries(slot))
      if (n > 1) issues.push({ type: 'duplicate-slot', detail: `${pat} ×${n}`, day: day.name });
    for (const rule of DAY_RULES) {
      if (!rule.match.test(day.name)) continue;
      for (const bad of rule.forbid)
        if (patternsToday.has(bad)) issues.push({ type: 'mistargeted', detail: `${bad} on ${day.name}`, day: day.name });
    }
  }

  // the app's own view of weekly volume
  for (const g of buildVolumeView(weekSets, tier)) {
    const check = (label, done, t) => {
      if (!t) return;
      if (done < t.min) issues.push({ type: 'under-volume', detail: `${label} ${done} < min ${t.min}` });
      else if (done > t.optimal_high) issues.push({ type: 'over-volume', detail: `${label} ${done} > opt ${t.optimal_high}` });
    };
    if (g.split) g.heads.forEach(h => check(h.key, h.direct, h.target));
    else check(g.key, g.done, g.target);
  }
  return { split: p?.name, issues, days: (p.days || []).length };
}

const EQUIP = {
  'full gym': ['Barbell', 'Dumbbells', 'Cables', 'Machines'],
  'home dumbbells': ['Dumbbells'],
  'bodyweight': ['Bodyweight only'],
};
const EXPS = ['under_6m', '6m_to_2y', '2y_to_4y', 'over_4y'];
const DAYS = [3, 4, 5, 6];
const GOALS = [['gain'], ['strength'], ['lose']];

const tally = {}, splitsWith = {};
let n = 0, clean = 0;
for (const [, equipment] of Object.entries(EQUIP))
  for (const trainingExperience of EXPS)
    for (const weekly_workouts of DAYS)
      for (const goals of GOALS) {
        n++;
        let r;
        try { r = auditProgram({ trainingExperience, equipment, weekly_workouts, goals, sex: 'male', weight_kg: 80 }); }
        catch (e) { tally['ERROR ' + e.message.slice(0, 50)] = (tally['ERROR ' + e.message.slice(0, 50)] || 0) + 1; continue; }
        if (!r.issues.length) clean++;
        for (const i of r.issues) {
          const k = `${i.type}: ${i.detail}`;
          tally[k] = (tally[k] || 0) + 1;
          (splitsWith[k] = splitsWith[k] || new Set()).add(r.split);
        }
      }

const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
console.log(`swept ${n} programs — ${clean} clean, ${n - clean} with issues\n`);
const byType = {};
sorted.forEach(([k, c]) => { const t = k.split(':')[0]; byType[t] = (byType[t] || 0) + c; });
console.log('BY TYPE'); Object.entries(byType).sort((a,b)=>b[1]-a[1]).forEach(([t,c]) => console.log('  ', String(c).padStart(4), t));
console.log('\nTOP FINDINGS');
sorted.slice(0, 24).forEach(([k, c]) => console.log('  ', String(c).padStart(3), k));
