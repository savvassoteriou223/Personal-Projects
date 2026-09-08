/**
 * buildGoalMatrix.mjs — every goal x every split, audited and rendered.
 *
 * The visual review covered one slice: full gym, goal `muscle`. This sweeps the
 * whole space — 16 goals x 10 splits x 5 equipment scenarios x 4 experience
 * levels x 2 sexes — and reports where volume, day structure or exercise
 * quality break down.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/buildGoalMatrix.mjs <out.html>
 */
import fs from 'fs';
import { SPLITS, GOAL_PROFILES, generateProgram } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';

const EQUIP = {
  'full gym':   ['full_gym', 'barbell', 'dumbbells', 'cables', 'machines', 'pullup_bar', 'bench'],
  'garage':     ['Barbell', 'Dumbbells', 'Pull-up bar'],
  'dumbbells':  ['Dumbbells'],
  'bodyweight': ['Bodyweight only'],
  'bands':      ['Resistance bands'],
};
const EXPS = [['beginner', 'under_6m'], ['intermediate', '6m_to_2y'], ['advanced', 'over_4y']];
const GOALS = Object.keys(GOAL_PROFILES);
const SPLIT_KEYS = Object.keys(SPLITS);
// Men are not held to the direct-glute floor — see USER_GLUTES / MALE_GLUTES.
const waived = (m, sex) => m === 'glutes' && sex === 'male';

// Exercises that credit volume but cannot be loaded or measured. A lifter gets
// the sets on their chart; the stimulus does not scale with them.
const UNLOADABLE = /self-resisted|towel row|towel curl|wall sit|lying lateral raise|prone (t|y)-raise|prone y-t-w/i;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const cells = {};      // `${goal}|${split}` -> {n, bad, low, unloadable}
const byEquip = {};    // equipment -> {n, bad}
const findings = {};   // detail -> count
let n = 0, clean = 0;

for (const goal of GOALS)
  for (const key of SPLIT_KEYS)
    for (const [eqName, equipment] of Object.entries(EQUIP))
      for (const [tier, exp] of EXPS)
        for (const sex of ['male', 'female']) {
          n++;
          const ck = `${goal}|${key}`;
          const c = (cells[ck] ??= { n: 0, bad: 0, low: 0, unloadable: 0, worst: null });
          const be = (byEquip[eqName] ??= { n: 0, bad: 0 });
          c.n++; be.n++;
          let p;
          try {
            p = generateProgram({
              selected_split: key, weekly_workouts: SPLITS[key].days, trainingExperience: exp,
              goals: [goal], sex, weight_kg: 80, equipment,
            });
          } catch (e) { c.bad++; be.bad++; findings[`crash: ${e.message.slice(0, 40)}`] = (findings[`crash: ${e.message.slice(0, 40)}`] || 0) + 1; continue; }

          const sets = [];
          let unloadableSets = 0;
          for (const d of p.days || []) for (const ex of d.exercises || []) {
            if (UNLOADABLE.test(ex.name)) unloadableSets += ex.sets;
            for (let i = 0; i < ex.sets; i++)
              sets.push({ exercise_name: ex.name, pattern_key: ex.pattern, reps: 10, weight_kg: 40, set_type: 'working' });
          }
          if (unloadableSets >= 6) c.unloadable++;

          let issues = 0;
          for (const g of buildVolumeView(sets, tier, sex)) {
            const rows = g.split ? g.heads.filter(h => h.target).map(h => [h.key, h.direct, h.target])
              : (g.target ? [[g.key, g.done, g.target]] : []);
            for (const [m, done, t] of rows) {
              if (waived(m, sex)) continue;
              if (done < t.min) { issues++; findings[`${m} below minimum`] = (findings[`${m} below minimum`] || 0) + 1; }
              else if (done < t.optimal_low) { c.low++; findings[`${m} below optimal`] = (findings[`${m} below optimal`] || 0) + 1; }
            }
          }
          if (issues) { c.bad++; be.bad++; } else clean++;
        }

const status = c => c.bad ? 'bad' : c.unloadable ? 'unload' : c.low ? 'low' : 'ok';
const rows = GOALS.map(goal => {
  const tds = SPLIT_KEYS.map(k => {
    const c = cells[`${goal}|${k}`];
    const s = status(c);
    const title = `${goal} / ${k}: ${c.n} programs, ${c.bad} below minimum, ${c.low} below optimal, ${c.unloadable} with unloadable volume`;
    return `<td class="c ${s}" title="${esc(title)}"></td>`;
  }).join('');
  return `<tr><th class="sticky">${esc(goal)}</th>${tds}</tr>`;
}).join('');

const eqRows = Object.entries(byEquip).map(([name, v]) => {
  const pct = v.n ? Math.round((v.n - v.bad) / v.n * 100) : 0;
  const cls = pct === 100 ? 'ok' : pct >= 90 ? 'low' : 'bad';
  return `<div class="barrow"><span class="bl">${esc(name)}</span>
    <span class="track"><span class="fill ${cls}" style="width:${pct}%"></span></span>
    <span class="bn ${cls}">${pct}%</span><span class="bt">${v.n - v.bad}/${v.n}</span></div>`;
}).join('');

const findRows = Object.entries(findings).sort((a, b) => b[1] - a[1]).slice(0, 14)
  .map(([k, v]) => `<tr><td class="s${/below minimum|crash/.test(k) ? 1 : 2}"></td><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('');

const html = `<title>Helix — goals × splits audit</title>
<style>
:root{--bg:#f6f6f4;--card:#fff;--ink:#16171a;--ink2:#5a5d61;--ink3:#8d9095;--rule:#e3e3df;
 --ok:#3f7d4e;--low:#a8761a;--bad:#a83a2c;--unload:#7a4a8c;}
@media (prefers-color-scheme:dark){:root{--bg:#131417;--card:#1b1c20;--ink:#e9e9e6;--ink2:#a5a7ab;--ink3:#75787c;
 --rule:#2a2b2f;--ok:#7fb98d;--low:#d8ab5c;--bad:#e0897a;--unload:#b78dc9;}}
:root[data-theme="light"]{--bg:#f6f6f4;--card:#fff;--ink:#16171a;--ink2:#5a5d61;--ink3:#8d9095;--rule:#e3e3df;
 --ok:#3f7d4e;--low:#a8761a;--bad:#a83a2c;--unload:#7a4a8c;}
:root[data-theme="dark"]{--bg:#131417;--card:#1b1c20;--ink:#e9e9e6;--ink2:#a5a7ab;--ink3:#75787c;
 --rule:#2a2b2f;--ok:#7fb98d;--low:#d8ab5c;--bad:#e0897a;--unload:#b78dc9;}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
 font:14px/1.45 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:28px 20px 70px}
h1{font-size:23px;margin:0 0 3px;letter-spacing:-.02em}
.sub{margin:0 0 20px;color:var(--ink2);font-size:13px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.13em;color:var(--ink3);margin:30px 0 10px;
 padding-bottom:6px;border-bottom:1px solid var(--rule)}
.stats{display:flex;flex-wrap:wrap;border:1px solid var(--rule);background:var(--card);margin-bottom:6px}
.stat{flex:1 1 130px;padding:11px 14px;border-right:1px solid var(--rule)}.stat:last-child{border-right:0}
.stat b{display:block;font-size:21px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.stat span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3)}
.scroll{overflow-x:auto;border:1px solid var(--rule);background:var(--card)}
table.m{border-collapse:collapse;width:100%;min-width:660px;font-size:11px}
table.m th{font-weight:500;padding:5px 6px;text-align:left;white-space:nowrap}
table.m tr:first-child th{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);
 writing-mode:vertical-rl;text-orientation:mixed;height:100px;padding:4px 2px;text-align:right}
th.sticky{position:sticky;left:0;background:var(--card);z-index:1;border-right:1px solid var(--rule)}
td.c{width:26px;height:22px;border:1px solid var(--bg)}
td.ok{background:var(--ok)}td.low{background:var(--low)}td.bad{background:var(--bad)}td.unload{background:var(--unload)}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2);margin-top:8px}
.legend b{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.card{background:var(--card);border:1px solid var(--rule);padding:13px 15px}
.barrow{display:grid;grid-template-columns:88px 1fr 44px 56px;gap:9px;align-items:center;padding:3px 0}
.bl{font-size:11.5px;color:var(--ink2);text-align:right}
.track{position:relative;height:13px;background:var(--bg);border:1px solid var(--rule);border-radius:2px;overflow:hidden}
.fill{position:absolute;inset:0 auto 0 0}.fill.ok{background:var(--ok)}.fill.low{background:var(--low)}.fill.bad{background:var(--bad)}
.bn{font-size:11.5px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.bn.ok{color:var(--ok)}.bn.low{color:var(--low)}.bn.bad{color:var(--bad)}
.bt{font-size:10.5px;color:var(--ink3);font-variant-numeric:tabular-nums}
table.f{border-collapse:collapse;width:100%;font-size:12.5px;background:var(--card);border:1px solid var(--rule)}
table.f td{padding:6px 10px;border-bottom:1px solid var(--rule)}
table.f td:first-child{width:6px;padding:0}
td.s1{background:var(--bad)}td.s2{background:var(--low)}
td.num{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink2);white-space:nowrap}
.none{padding:12px;color:var(--ink3);background:var(--card);border:1px solid var(--rule)}
</style>
<div class="wrap">
<h1>Goals &times; splits</h1>
<p class="sub">${GOALS.length} goals &times; ${SPLIT_KEYS.length} splits &times; ${Object.keys(EQUIP).length} equipment scenarios
&times; ${EXPS.length} experience levels &times; 2 sexes. Every cell is ${Object.keys(EQUIP).length * EXPS.length * 2} generated programs.</p>

<div class="stats">
  <div class="stat"><b>${n.toLocaleString()}</b><span>programs</span></div>
  <div class="stat"><b>${Math.round(clean / n * 100)}%</b><span>fully clean</span></div>
  <div class="stat"><b>${GOALS.length}</b><span>goals</span></div>
  <div class="stat"><b>${Object.values(cells).filter(c => c.bad).length}</b><span>cells with failures</span></div>
</div>

<h2>Every goal against every split</h2>
<div class="scroll"><table class="m">
<tr><th class="sticky">goal</th>${SPLIT_KEYS.map(k => `<th>${esc(SPLITS[k].name)}</th>`).join('')}</tr>
${rows}
</table></div>
<p class="legend">
  <span><b style="background:var(--ok)"></b>all in range</span>
  <span><b style="background:var(--low)"></b>below optimal somewhere</span>
  <span><b style="background:var(--unload)"></b>6+ sets of unloadable exercises</span>
  <span><b style="background:var(--bad)"></b>below minimum</span>
  <span style="color:var(--ink3)">hover a cell for counts</span>
</p>

<h2>Pass rate by equipment</h2>
<div class="card">${eqRows}</div>

<h2>Findings</h2>
${findRows ? `<table class="f">${findRows}</table>` : '<p class="none">Nothing found.</p>'}
</div>`;

const out = process.argv[2] || 'goal-matrix.html';
fs.writeFileSync(out, html);
console.log(`${out}\n${n} programs · ${clean} clean (${Math.round(clean / n * 100)}%) · ${Object.values(cells).filter(c => c.bad).length} failing cells`);
