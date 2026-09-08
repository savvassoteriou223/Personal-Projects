/**
 * exportSplitMatrix.mjs — dumps the FULL generated-program matrix to CSV for
 * manual analysis: every exercise, in every split, for every distinct goal
 * variant, at every experience tier, with the muscle group it trains and the
 * optimal set range for that muscle.
 *
 * Goal collapsing: SPLIT_RANKINGS exposes 16 goal keys, but for a FIXED split
 * they generate only 4 distinct programs — `strength`, `lose` and `endurance`
 * each differ, and the other 13 (muscle, maintain, default, recomp,
 * cut_strength, cut_endurance, powerbuilding, hybrid_muscle, hybrid_strength,
 * powerbuilding_cut, athletic_recomp, athletic_cut, athletic_bulk) are
 * byte-identical to each other. Verified across all 10 splits × 3 tiers. The
 * export therefore emits one row-set per DISTINCT program and names every goal
 * it covers, rather than 12 duplicate copies.
 *
 * Equipment: full gym. Equipment selects WHICH exercise fills a slot, never
 * the set count — a bodyweight-only and a full-gym program of the same split
 * have identical per-muscle volume — so one equipment set is enough to analyse
 * volume. (Verified: 0 of 80 days×goal cells change split by equipment.)
 *
 * Run: node --loader ./scripts/extres.mjs scripts/exportSplitMatrix.mjs
 * Writes: docs/analysis/*.csv
 */
import fs from 'fs';
import path from 'path';
import { generateProgram, SPLITS, SPLIT_RANKINGS, VOLUME_TARGETS } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';
import { getPatternLabelForExercise } from '../screens/movementLibrary.js';

const OUT_DIR = path.join(process.cwd(), 'docs', 'analysis');
const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cables', 'Machines', 'Pull-up bar', 'Bodyweight only'];
const TIERS = ['beginner', 'intermediate', 'advanced'];
const ALL_GOALS = [...new Set(Object.values(SPLIT_RANKINGS).flatMap(o => Object.keys(o)))];

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, headers) =>
  [headers.join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\n') + '\n';

const build = (splitId, tier, goal) => generateProgram({
  trainingExperience: tier,
  equipment: EQUIPMENT,
  weekly_workouts: SPLITS[splitId].days,
  goals: [goal],
  sex: 'male',
  weight_kg: 80,
  selected_split: splitId,
});

const programSignature = (p) => (p.days || []).map(d =>
  `${d.id}:` + (d.exercises || []).map(e => `${e.name}#${e.sets}x${e.reps}`).join('|')
).join(' || ');

const weekSetsFor = (p) => {
  const out = [];
  for (const day of p.days || [])
    for (const ex of day.exercises || []) {
      if (!ex?.name || (ex.sets || 0) <= 0) continue;
      for (let i = 0; i < ex.sets; i++)
        out.push({ exercise_name: ex.name, pattern_key: ex.pattern, reps: 10, weight_kg: 50, set_type: 'working' });
    }
  return out;
};

const exerciseRows = [];
const volumeRows = [];

for (const splitId of Object.keys(SPLITS)) {
  const split = SPLITS[splitId];
  for (const tier of TIERS) {
    // Collapse the 16 goals into distinct programs for this split+tier.
    const variants = new Map(); // signature -> { goals: [], program }
    for (const goal of ALL_GOALS) {
      const p = build(splitId, tier, goal);
      const sig = programSignature(p);
      if (!variants.has(sig)) variants.set(sig, { goals: [], program: p });
      variants.get(sig).goals.push(goal);
    }

    let variantNo = 0;
    for (const { goals, program } of variants.values()) {
      variantNo++;
      const goalsCovered = goals.join(' | ');
      const representativeGoal = goals[0];

      // ── exercise rows ──
      (program.days || []).forEach((day, dayIdx) => {
        (day.exercises || []).forEach((ex, exIdx) => {
          exerciseRows.push({
            split_id: splitId,
            split_name: split.name,
            days_per_week: split.days,
            experience_tier: tier,
            goal_variant: `${variantNo} of ${variants.size}`,
            representative_goal: representativeGoal,
            goals_covered: goalsCovered,
            day_index: dayIdx,
            day_id: day.id,
            day_name: day.name,
            exercise_index: exIdx,
            exercise_name: ex.name,
            muscle_group_label: getPatternLabelForExercise(ex.name) || '',
            pattern_key: ex.pattern || '',
            muscles_trained: ex.muscles || '',
            sets: ex.sets ?? '',
            reps: ex.reps ?? '',
            rest: ex.rest ?? '',
            equipment_required: (ex.equipment_required || []).join('+'),
          });
        });
      });

      // ── per-muscle volume vs target, for this exact program ──
      for (const g of buildVolumeView(weekSetsFor(program), tier)) {
        const push = (key, done, t) => {
          if (!t) return;
          const status = done === 0 && t.min > 0 ? 'ZERO'
            : done < t.min ? 'below_minimum'
            : done < t.optimal_low ? 'below_optimal'
            : done <= t.optimal_high ? 'optimal'
            : 'above_optimal';
          volumeRows.push({
            split_id: splitId,
            split_name: split.name,
            days_per_week: split.days,
            experience_tier: tier,
            goal_variant: `${variantNo} of ${variants.size}`,
            representative_goal: representativeGoal,
            goals_covered: goalsCovered,
            muscle: key,
            direct_sets: done,
            target_min: t.min,
            target_optimal_low: t.optimal_low,
            target_optimal_high: t.optimal_high,
            status,
          });
        };
        if (g.split) g.heads.forEach(h => push(h.key, h.direct, h.target));
        else push(g.key, g.done, g.target);
      }
    }
  }
}

// ── reference: optimal set ranges per muscle per tier ──
const targetRows = [];
for (const [muscle, byTier] of Object.entries(VOLUME_TARGETS)) {
  for (const tier of TIERS) {
    const t = byTier[tier];
    if (!t) continue;
    targetRows.push({
      muscle, experience_tier: tier,
      minimum_sets: t.min,
      optimal_low: t.optimal_low,
      optimal_high: t.optimal_high,
      optimal_range: `${t.optimal_low}-${t.optimal_high}`,
      note: byTier.note || '',
    });
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'split_exercises.csv'), toCsv(exerciseRows, [
  'split_id', 'split_name', 'days_per_week', 'experience_tier', 'goal_variant',
  'representative_goal', 'goals_covered', 'day_index', 'day_id', 'day_name',
  'exercise_index', 'exercise_name', 'muscle_group_label', 'pattern_key',
  'muscles_trained', 'sets', 'reps', 'rest', 'equipment_required',
]));
fs.writeFileSync(path.join(OUT_DIR, 'split_volume_vs_target.csv'), toCsv(volumeRows, [
  'split_id', 'split_name', 'days_per_week', 'experience_tier', 'goal_variant',
  'representative_goal', 'goals_covered', 'muscle', 'direct_sets',
  'target_min', 'target_optimal_low', 'target_optimal_high', 'status',
]));
fs.writeFileSync(path.join(OUT_DIR, 'volume_targets.csv'), toCsv(targetRows, [
  'muscle', 'experience_tier', 'minimum_sets', 'optimal_low', 'optimal_high', 'optimal_range', 'note',
]));

const distinctPrograms = new Set(exerciseRows.map(r =>
  `${r.split_id}|${r.experience_tier}|${r.goal_variant}`)).size;
console.log(`splits: ${Object.keys(SPLITS).length}`);
console.log(`goal keys: ${ALL_GOALS.length} -> collapse to distinct programs per split+tier`);
console.log(`distinct programs exported: ${distinctPrograms}`);
console.log(`exercise rows:          ${exerciseRows.length}  -> docs/analysis/split_exercises.csv`);
console.log(`volume-vs-target rows:  ${volumeRows.length}  -> docs/analysis/split_volume_vs_target.csv`);
console.log(`volume target rows:     ${targetRows.length}  -> docs/analysis/volume_targets.csv`);

const bad = volumeRows.filter(r => r.status === 'ZERO' || r.status === 'below_minimum').length;
const sub = volumeRows.filter(r => r.status === 'below_optimal').length;
console.log(`\nstatus tally: ZERO/below_minimum=${bad}  below_optimal=${sub}  optimal=${volumeRows.filter(r => r.status === 'optimal').length}  above_optimal=${volumeRows.filter(r => r.status === 'above_optimal').length}`);
