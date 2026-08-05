/**
 * dayAudit.mjs — audits every split DAY BY DAY, and writes an HTML report.
 *
 * Why this exists: programAudit.mjs checks weekly totals per muscle and nothing
 * else. A week with 8 triceps sets on Push and 0 on Upper has the same weekly
 * total as 4 and 4, so it passes 288/288 while being an incoherent program.
 * Real defects found that way and missed by every existing script:
 *   - PPL/UL 5x "Upper" day contains no press, no vertical pull, no triceps
 *   - Push day carries a muscle's entire weekly volume while Upper carries none
 *   - Isolation sets rivalling the day's primary compound volume
 *
 * The day compositions are hand-written in splitDesign.mjs (the solver only
 * computes SET COUNTS, not which pattern lands on which day), so nothing has
 * ever verified them.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/dayAudit.mjs [out.html]
 */
import fs from 'fs';
import { generateProgram, SPLITS, SPLIT_RANKINGS, VOLUME_TARGETS } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';
import { getPatternLabelForExercise, MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';

const OUT = process.argv[2] || 'day_audit.html';
const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cables', 'Machines', 'Pull-up bar'];
// Splits that train each muscle once a week BY DESIGN, or that have too few
// sessions for twice-weekly frequency to be arithmetically possible. Mirrors
// the freq1 flag and the days>=4 gate in splitDesign.mjs — without these the
// report is dominated by findings that are deliberate design decisions.
const FREQ_EXEMPT = new Set(['chest_back_shoulders_legs_4x']);
const TIERS = ['beginner', 'intermediate', 'advanced'];
const ALL_GOALS = [...new Set(Object.values(SPLIT_RANKINGS).flatMap(o => Object.keys(o)))];

// What a day's NAME promises it will train. A day called "Upper" that contains
// no pressing and no vertical pull is broken regardless of what the weekly
// totals say — the user reads the name and expects the movement.
const DAY_EXPECTS = [
  { re: /^push/i,  need: [['chest_horizontal_push','chest_incline_push','chest_decline'], ['shoulders_vertical_push'], ['triceps']],
    label: ['a chest press', 'a shoulder press', 'triceps'] },
  { re: /^pull/i,  need: [['back_vertical_pull'], ['back_horizontal_pull','back_inner'], ['biceps']],
    label: ['a vertical pull', 'a horizontal pull', 'biceps'] },
  { re: /^upper/i, need: [['chest_horizontal_push','chest_incline_push','chest_decline'], ['back_vertical_pull','back_horizontal_pull','back_inner'], ['triceps'], ['biceps']],
    label: ['a chest press', 'a pull', 'triceps', 'biceps'] },
  { re: /^(lower|legs)/i, need: [['squat_pattern'], ['hip_hinge']],
    label: ['a squat pattern', 'a hip hinge'] },
  { re: /^full body/i, need: [['squat_pattern','quad_isolation','hip_hinge','glute_focused'], ['chest_horizontal_push','chest_incline_push','chest_decline','chest_isolation','shoulders_vertical_push'], ['back_vertical_pull','back_horizontal_pull','back_inner','back_isolation']],
    label: ['a leg movement', 'an upper push', 'an upper pull'] },
];

const COMPOUND = new Set(['squat_pattern','hip_hinge','glute_focused','chest_horizontal_push',
  'chest_incline_push','chest_decline','back_vertical_pull','back_horizontal_pull','back_inner','shoulders_vertical_push']);

const setsOf = day => (day.exercises || []).flatMap(e =>
  Array.from({ length: e.sets || 0 }, () => ({ exercise_name: e.name, pattern_key: e.pattern, reps: 10, weight_kg: 50, set_type: 'working' })));

const volOf = (sets, tier) => {
  const o = {};
  for (const g of buildVolumeView(sets, tier)) {
    if (g.split) g.heads.forEach(h => { o[h.key] = h.direct; });
    else o[g.key] = g.done;
  }
  return o;
};

const musclesOf = name => {
  for (const p of Object.values(MOVEMENT_PATTERNS))
    for (const e of p.exercises || []) if (e.name === name) return e.muscles || '';
  return '';
};

const programSig = p => (p.days || []).map(d => `${d.id}:` + (d.exercises || []).map(e => `${e.name}#${e.sets}`).join('|')).join('||');

const report = [];
let totalFindings = 0;

for (const splitId of Object.keys(SPLITS)) {
  for (const tier of TIERS) {
    // Collapse goals to distinct programs — 16 goal keys yield 4 programs.
    const variants = new Map();
    for (const goal of ALL_GOALS) {
      const p = generateProgram({ trainingExperience: tier, equipment: EQUIPMENT,
        weekly_workouts: SPLITS[splitId].days, goals: [goal], sex: 'male', weight_kg: 80, selected_split: splitId });
      const sig = programSig(p);
      if (!variants.has(sig)) variants.set(sig, { goals: [], p });
      variants.get(sig).goals.push(goal);
    }

    for (const { goals, p } of variants.values()) {
      const weekly = volOf(p.days.flatMap(setsOf), tier);
      const days = [];

      for (const d of p.days) {
        const dayVol = volOf(setsOf(d), tier);
        const patterns = new Set(d.exercises.map(e => e.pattern));
        const findings = [];

        // 1. Does the day deliver what its name promises?
        const expect = DAY_EXPECTS.find(x => x.re.test(d.name));
        if (expect && !d.optional) {
          expect.need.forEach((group, i) => {
            if (!group.some(pk => patterns.has(pk))) findings.push({ sev: 'high', msg: `Missing ${expect.label[i]} — on a day called "${d.name.split('—')[0].trim()}"` });
          });
        }

        // 2. A muscle's whole week landing on one day. Splits exist to spread
        //    volume across sessions; 100% on one day is a scheduling failure
        //    even when the weekly number is perfect.
        const freqApplies = p.days.filter(x => !x.optional).length >= 4 && !FREQ_EXEMPT.has(splitId);
        for (const [m, dv] of Object.entries(freqApplies ? dayVol : {})) {
          const wv = weekly[m] || 0;
          if (dv >= 6 && wv > 0 && dv / wv >= 0.99 && p.days.filter(x => !x.optional).length > 1)
            findings.push({ sev: 'high', msg: `All ${wv} weekly ${m.replace(/_/g,' ')} sets are on this one day` });
          else if (dv >= 8 && wv > 0 && dv / wv >= 0.8)
            findings.push({ sev: 'med', msg: `${dv} of ${wv} weekly ${m.replace(/_/g,' ')} sets on one day` });
        }

        // 3. Junk volume. Past roughly 10-12 hard sets for one muscle in a
        //    single session the extra sets add almost nothing — effort and
        //    technique have decayed by then. This is the app's own stated
        //    per-session ceiling (SCIENCE_REFERENCE), it just was not checked
        //    anywhere, so a bro split could pile 16 back sets into one day
        //    while every weekly number looked correct.
        for (const [m, dv] of Object.entries(dayVol)) {
          if (dv > 12) findings.push({ sev: 'high', msg: `${dv} ${m.replace(/_/g,' ')} sets in one session — past the ~10-12 point where extra sets stop counting` });
        }

        // 4. Isolation out-volumING the day's compounds.
        const compSets = d.exercises.filter(e => COMPOUND.has(e.pattern)).reduce((n,e)=>n+(e.sets||0),0);
        const isoSets  = d.exercises.filter(e => !COMPOUND.has(e.pattern)).reduce((n,e)=>n+(e.sets||0),0);
        if (compSets > 0 && isoSets > compSets)
          findings.push({ sev: 'low', msg: `${isoSets} isolation sets vs ${compSets} compound sets` });

        // 4. Equipment the user doesn't have.
        const owned = new Set(['barbell','dumbbells','cables','machines','pullup_bar','bodyweight']);
        d.exercises.forEach(e => {
          const req = e.equipment_required || [];
          if (req.length && !req.every(r => owned.has(r)))
            findings.push({ sev: 'high', msg: `${e.name} needs ${req.join('+')}, which this user does not have` });
        });

        totalFindings += findings.length;
        days.push({
          id: d.id, name: d.name, optional: !!d.optional, findings,
          exercises: d.exercises.map(e => ({
            name: e.name, sets: e.sets, reps: e.reps,
            group: getPatternLabelForExercise(e.name) || '',
            muscles: musclesOf(e.name),
            equip: (e.equipment_required || []).join('+'),
            compound: COMPOUND.has(e.pattern),
          })),
          vol: Object.entries(dayVol).filter(([,v]) => v > 0).sort((a,b)=>b[1]-a[1]),
        });
      }

      report.push({
        splitId, splitName: SPLITS[splitId].name, dayCount: SPLITS[splitId].days,
        tier, goals, days, weekly,
        findings: days.reduce((n,d)=>n+d.findings.length,0),
      });
    }
  }
}

console.log(`audited ${report.length} programs (${report.reduce((n,r)=>n+r.days.length,0)} days) — ${totalFindings} findings`);
const bySev = {};
report.forEach(r => r.days.forEach(d => d.findings.forEach(f => bySev[f.sev] = (bySev[f.sev]||0)+1)));
console.log('by severity:', JSON.stringify(bySev));
const worst = [...report].sort((a,b)=>b.findings-a.findings).slice(0,6);
console.log('\nworst programs:');
worst.forEach(r => console.log(`  ${r.findings.toString().padStart(2)}  ${r.splitId} / ${r.tier} / ${r.goals[0]}`));

fs.writeFileSync('day_audit.json', JSON.stringify({ report, targets: VOLUME_TARGETS }, null, 2));
console.log('\nwrote day_audit.json');
