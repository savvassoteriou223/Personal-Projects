/**
 * buildSplitSheets.mjs — one printable sheet per split.
 *
 * Structure and per-tier set counts come straight from SPLIT_DAYS; exercise
 * names, reps and rest come from generateProgram itself (full gym, block 0),
 * so the sheets show exactly what the app would build — nothing is
 * re-implemented here.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/buildSplitSheets.mjs <out.html>
 */
import fs from 'fs';
import { SPLITS, generateProgram } from '../screens/programGenerator.js';
import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';

const FULL_GYM = ['full_gym', 'barbell', 'dumbbells', 'cables', 'machines', 'pullup_bar', 'bench'];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// One generated program per split per tier — the app's own output.
const TIERS = [
  ['beginner', 'under_6m'],
  ['intermediate', '6m_to_2y'],
  ['advanced', 'over_4y'],
];

function gen(splitKey, trainingExperience, sex) {
  return generateProgram({
    selected_split: splitKey,
    weekly_workouts: SPLITS[splitKey].days,
    trainingExperience,
    goals: ['muscle'],
    sex,
    weight_kg: 80,
    equipment: FULL_GYM,
  });
}

const sections = Object.keys(SPLITS).map(key => {
  const meta = SPLITS[key];
  // Male + female, intermediate, for names/reps/rest; all tiers for set counts.
  const progM = gen(key, '6m_to_2y', 'male');
  const progF = gen(key, '6m_to_2y', 'female');
  const byTier = Object.fromEntries(TIERS.map(([t, exp]) => [t, gen(key, exp, 'male')]));

  const dayCards = (progM.days || []).map((day, di) => {
    const fDay = (progF.days || [])[di];
    const rows = (day.exercises || []).map((ex, ei) => {
      // Per-tier sets for this slot: same day/slot position in each tier's
      // program. A slot that doesn't exist at a tier (zero sets) shows —.
      const sets = TIERS.map(([t]) => {
        const d = (byTier[t].days || [])[di];
        const match = d && (d.exercises || []).find(e => e.pattern === ex.pattern &&
          !e._used && e.name === ex.name) || d && (d.exercises || []).find(e => e.pattern === ex.pattern && !e._used);
        if (match) { match._used = true; return match.sets || 0; }
        return 0;
      });
      const fEx = fDay && (fDay.exercises || [])[ei];
      const femaleDiff = fEx && fEx.name !== ex.name ? fEx.name : null;
      const muscles = (MOVEMENT_PATTERNS[ex.pattern]?.muscles || []).join(', ');
      return `<tr>
        <td class="n">${ei + 1}</td>
        <td class="exn">${esc(ex.name)}${femaleDiff ? `<span class="fvar">women: ${esc(femaleDiff)}</span>` : ''}</td>
        <td class="mus">${esc(muscles)}</td>
        ${sets.map(s => `<td class="n">${s || '—'}</td>`).join('')}
        <td class="n">${esc(ex.reps || '')}</td>
        <td class="n rest">${esc(ex.rest || '')}</td>
      </tr>`;
    }).join('\n');
    // clear tier-match markers for the next day
    TIERS.forEach(([t]) => ((byTier[t].days || [])[di]?.exercises || []).forEach(e => { delete e._used; }));

    return `<section class="day${day.optional ? ' optional' : ''}">
      <header class="dayhead">
        <h3>${esc(day.name)}${day.optional ? '<span class="opt">optional</span>' : ''}</h3>
        ${day.focus ? `<span class="focus">${esc(day.focus)}</span>` : ''}
      </header>
      <table>
        <thead><tr>
          <th class="n">#</th><th>Exercise</th><th>Muscles worked</th>
          <th class="n">Beg</th><th class="n">Int</th><th class="n">Adv</th>
          <th class="n">Reps</th><th class="n">Rest</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).join('\n');

  return `<article class="split">
    <header class="splithead">
      <h2>${esc(meta.name)}</h2>
      <div class="metaline">
        <span>${meta.days} days/week</span>
        <span>each muscle ${meta.frequency_per_muscle}×/week</span>
        <span>${esc(meta.session_time_est)}</span>
        <span class="sched">${(meta.schedule_template || []).map(esc).join(' · ')}</span>
      </div>
    </header>
    ${dayCards}
  </article>`;
}).join('\n');

const html = `<title>Helix — Training splits</title>
<style>
:root{
  --paper:#fbfbf9; --card:#ffffff; --ink:#17181a; --ink-2:#4d4f52; --ink-3:#84868a;
  --rule:#e2e2de; --rule-2:#c9c9c4; --head:#f0f0ec; --acc:#28527a; --opt:#8a6510;
}
@media (prefers-color-scheme:dark){
  :root{ --paper:#141517; --card:#1c1d20; --ink:#e9e9e6; --ink-2:#a9aaa7; --ink-3:#7b7c7a;
    --rule:#2b2c2f; --rule-2:#404144; --head:#232427; --acc:#8db4dd; --opt:#d6ad5c; }
}
:root[data-theme="light"]{
  --paper:#fbfbf9; --card:#ffffff; --ink:#17181a; --ink-2:#4d4f52; --ink-3:#84868a;
  --rule:#e2e2de; --rule-2:#c9c9c4; --head:#f0f0ec; --acc:#28527a; --opt:#8a6510;
}
:root[data-theme="dark"]{
  --paper:#141517; --card:#1c1d20; --ink:#e9e9e6; --ink-2:#a9aaa7; --ink-3:#7b7c7a;
  --rule:#2b2c2f; --rule-2:#404144; --head:#232427; --acc:#8db4dd; --opt:#d6ad5c;
}
*{box-sizing:border-box}
body{margin:0; background:var(--paper); color:var(--ink);
  font:14px/1.45 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:900px; margin:0 auto; padding:32px 24px 80px}
h1{font-size:26px; letter-spacing:-.02em; margin:0 0 4px}
.sub{color:var(--ink-2); margin:0 0 8px}

.split{background:var(--card); border:1px solid var(--rule); margin-top:28px;
  padding:20px 22px 8px; break-after:page}
.split:last-child{break-after:auto}
.splithead{border-bottom:2px solid var(--ink); padding-bottom:10px; margin-bottom:6px}
.splithead h2{margin:0 0 4px; font-size:20px; letter-spacing:-.015em}
.metaline{display:flex; flex-wrap:wrap; gap:4px 18px; color:var(--ink-2); font-size:12.5px}
.metaline .sched{color:var(--ink-3)}

.day{margin:16px 0 20px; break-inside:avoid}
.dayhead{display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:6px}
.dayhead h3{margin:0; font-size:15px}
.opt{margin-left:8px; font-size:10px; text-transform:uppercase; letter-spacing:.08em;
  color:var(--opt); border:1px solid var(--opt); padding:1px 6px; border-radius:2px; vertical-align:2px}
.focus{color:var(--ink-3); font-size:12px}

table{border-collapse:collapse; width:100%; font-size:12.5px}
th{font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-3);
  text-align:left; padding:5px 8px; background:var(--head); border-bottom:1px solid var(--rule-2)}
td{padding:5px 8px; border-bottom:1px solid var(--rule); vertical-align:top}
th.n, td.n{text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums}
.exn{font-weight:600}
.fvar{display:block; font-weight:400; font-size:11px; color:var(--acc)}
.mus{color:var(--ink-2)}
td.rest{color:var(--ink-3)}

@media print{
  :root{ --paper:#fff; --card:#fff; --ink:#000; --ink-2:#333; --ink-3:#555;
    --rule:#ccc; --rule-2:#999; --head:#eee; --acc:#28527a; --opt:#8a6510; }
  body{font-size:11.5px}
  .wrap{max-width:none; padding:0}
  .split{border:0; padding:0; margin-top:0}
  .intro{display:none}
}
@page{margin:14mm}
</style>
<div class="wrap">
<div class="intro">
<h1>Helix — Training splits</h1>
<p class="sub">Full-gym equipment, block 1 exercise selection — exactly what the app generates.
Beg / Int / Adv columns are working sets per exercise at each experience tier. One split per printed page.</p>
</div>
${sections}
</div>`;

const out = process.argv[2] || 'split-sheets.html';
fs.writeFileSync(out, html);
console.log(`${out} — ${Object.keys(SPLITS).length} splits`);
