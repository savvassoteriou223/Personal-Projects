/**
 * logbookAudit.mjs — drives the real logging pipeline over every scenario a
 * lifter can create, and checks that what they logged is what the app reports.
 *
 * programAudit proves the PROGRAM is right. Nothing proved that a set survives
 * the trip from the workout screen to the volume chart — which is how five
 * logged calf sets came to display as four, with the muscle reading "ready".
 *
 * Everything here runs the shipped functions. No mocks of app logic.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/logbookAudit.mjs
 */
import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';
import { computeHeadVolume, buildVolumeView, muscleToHead } from '../screens/volumeEngine.js';
import { exerciseMuscleGroups } from '../lib/muscleAttribution.js';

const findings = [];
const report = (severity, area, detail) => findings.push({ severity, area, detail });

// A set as saveWorkout writes it.
const setRow = (name, patternKey, extra = {}) => ({
  exercise_name: name, pattern_key: patternKey,
  reps: 10, weight_kg: 60, set_type: 'working', ...extra,
});

// ── 1. Every exercise in the library must attribute ──────────────────────────
// If a lifter can select it, its sets must land on a muscle. An exercise that
// attributes to nothing is a set that disappears.
{
  let checked = 0;
  for (const [patternKey, pattern] of Object.entries(MOVEMENT_PATTERNS)) {
    for (const ex of pattern.exercises) {
      checked++;
      const byPattern = computeHeadVolume([setRow(ex.name, patternKey)]);
      if (!Object.keys(byPattern).length) {
        report('CRITICAL', 'attribution', `${ex.name} (${patternKey}) attributes to no muscle`);
      }
      // And by name alone, which is how legacy rows arrive.
      const byName = computeHeadVolume([{ exercise_name: ex.name, reps: 10, weight_kg: 60 }]);
      if (!Object.keys(byName).length) {
        report('HIGH', 'legacy rows', `${ex.name}: a row saved before pattern_key existed attributes to nothing`);
      }
      // The two paths must agree, or the same set counts differently depending
      // on when it was logged.
      const a = JSON.stringify(byPattern), b = JSON.stringify(byName);
      if (b !== '{}' && a !== b) {
        report('HIGH', 'inconsistent', `${ex.name}: pattern_key and name attribute differently`);
      }
    }
  }
  console.log(`  attribution: swept ${checked} exercises`);
}

// ── 2. Warm-up sets must not count as working volume ─────────────────────────
// saveWorkout stores set_type. If the volume engine ignores it, a lifter who
// logs two warm-ups sees four sets of chest for two hard ones.
{
  const mixed = [
    setRow('Barbell bench press', 'chest_horizontal_push', { set_type: 'warmup' }),
    setRow('Barbell bench press', 'chest_horizontal_push', { set_type: 'warmup' }),
    setRow('Barbell bench press', 'chest_horizontal_push', { set_type: 'working' }),
  ];
  const chest = buildVolumeView(mixed, 'intermediate').find(g => g.key === 'chest');
  if (chest.done !== 1) {
    report('CRITICAL', 'warm-up sets',
      `2 warm-ups + 1 working set reports ${chest.done} sets of chest — warm-ups are counted as working volume`);
  }
}

// ── 3. A dropped/failed set with no reps must not inflate volume ─────────────
{
  const withEmpty = [
    setRow('Barbell bench press', 'chest_horizontal_push'),
    setRow('Barbell bench press', 'chest_horizontal_push', { reps: null, weight_kg: null }),
  ];
  const chest = buildVolumeView(withEmpty, 'intermediate').find(g => g.key === 'chest');
  if (chest.done !== 1) {
    report('MEDIUM', 'empty sets',
      `a set with no reps and no weight still counts (${chest.done} instead of 1)`);
  }
}

// ── 4. Bodyweight work must count ────────────────────────────────────────────
// weight_kg is null for a push-up. If anything filters on weight, the whole
// bodyweight audience logs into a void.
{
  const bw = Array(3).fill(setRow('Push-up', 'chest_horizontal_push', { weight_kg: null }));
  const chest = buildVolumeView(bw, 'intermediate').find(g => g.key === 'chest');
  if (chest.done !== 3) {
    report('CRITICAL', 'bodyweight', `3 push-up sets report ${chest.done} — bodyweight work is being dropped`);
  }
}

// ── 5. The two attribution engines must not disagree ─────────────────────────
// volumeEngine drives the chart; muscleAttribution drives recovery and the
// coach. If they disagree, the map and the chart tell different stories about
// the same session.
{
  for (const [patternKey, pattern] of Object.entries(MOVEMENT_PATTERNS)) {
    const ex = pattern.exercises[0];
    if (!ex) continue;
    const volHeads = Object.keys(computeHeadVolume([setRow(ex.name, patternKey)]));
    const groups = exerciseMuscleGroups(ex.name, patternKey);
    const primaryHead = muscleToHead(pattern.muscles[0]);
    if (primaryHead && !volHeads.includes(primaryHead)) {
      report('HIGH', 'engine disagreement', `${patternKey}: volume engine misses the primary head ${primaryHead}`);
    }
    if (!groups.length) {
      report('HIGH', 'engine disagreement', `${patternKey}: recovery attribution returns no muscle for ${ex.name}`);
    }
  }
}

// ── 6. A pattern_key that no longer exists must not crash or silently drop ───
{
  const stale = computeHeadVolume([{ exercise_name: 'Barbell bench press', pattern_key: 'pattern_deleted_in_v2', reps: 10, weight_kg: 60 }]);
  if (!Object.keys(stale).length) {
    report('MEDIUM', 'stale pattern',
      'a set whose pattern_key no longer exists attributes to nothing even though its NAME is still valid');
  }
}

// ── 7. Volume targets must exist for every group the view reports ────────────
{
  for (const g of buildVolumeView([], 'intermediate')) {
    if (!g.split && !g.target) {
      report('MEDIUM', 'targets', `group "${g.key}" is rendered with no volume target to judge it against`);
    }
  }
}

// ── report ───────────────────────────────────────────────────────────────────
const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);
console.log(`\n${findings.length} finding(s)\n`);
const seen = new Set();
for (const f of findings) {
  const key = `${f.severity}|${f.area}|${f.detail.slice(0, 60)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`  [${f.severity}] ${f.area}: ${f.detail}`);
}
const byArea = {};
findings.forEach(f => { byArea[`${f.severity} ${f.area}`] = (byArea[`${f.severity} ${f.area}`] || 0) + 1; });
if (findings.length > 12) {
  console.log('\n  totals:');
  Object.entries(byArea).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));
}
