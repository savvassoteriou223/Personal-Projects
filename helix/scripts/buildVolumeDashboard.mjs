/**
 * buildVolumeDashboard.mjs — visual status of every split.
 *
 * Built to be SCANNED, not read: a grid where colour carries the finding, and
 * per-muscle bars showing where delivered volume sits inside the optimal band.
 * Prose only where a number cannot explain itself.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/buildVolumeDashboard.mjs <out.html>
 */
import fs from 'fs';
import { SPLITS, generateProgram, getVolumeTargets } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';

const EQ = ['full_gym', 'barbell', 'dumbbells', 'cables', 'machines', 'pullup_bar', 'bench'];
const TIERS = [['beginner', 'under_6m', 'Beg'], ['intermediate', '6m_to_2y', 'Int'], ['advanced', 'over_4y', 'Adv']];
// Men are not held to the direct-glute floor; flagging it every time is noise.
const WAIVED = { glutes: sex => sex === 'male' };
const COMPOUND = new Set(['squat_pattern', 'hip_hinge', 'chest_horizontal_push', 'chest_incline_push',
  'chest_decline', 'back_vertical_pull', 'back_horizontal_pull', 'shoulders_vertical_push', 'back_inner']);

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function measure(splitKey, exp, tier, sex) {
  const p = generateProgram({
    selected_split: splitKey, weekly_workouts: SPLITS[splitKey].days,
    trainingExperience: exp, goals: ['muscle'], sex, weight_kg: 80, equipment: EQ,
  });
  const sets = [];
  const days = (p.days || []).map(d => {
    let n = 0, mins = 0;
    (d.exercises || []).forEach(e => {
      n += e.sets; mins += e.sets * (COMPOUND.has(e.pattern) ? 3 : 2);
      for (let i = 0; i < e.sets; i++) sets.push({ exercise_name: e.name, pattern_key: e.pattern, reps: 10, weight_kg: 40, set_type: 'working' });
    });
    return { name: d.name, optional: !!d.optional, exercises: (d.exercises || []).length, sets: n, mins };
  });
  const muscles = {};
  buildVolumeView(sets, tier, sex).forEach(g => {
    const rows = g.split ? g.heads.filter(h => h.target).map(h => [h.key, h.direct, h.target])
      : (g.target ? [[g.key, g.done, g.target]] : []);
    rows.forEach(([k, done, t]) => {
      const waived = WAIVED[k]?.(sex) || false;
      muscles[k] = {
        done, ...t, waived,
        status: done < t.optimal_low ? (waived ? 'waived' : (done < t.min ? 'bad' : 'low')) : (done > t.optimal_high ? 'over' : 'ok'),
      };
    });
  });
  const real = days.filter(d => !d.optional);
  // The LONGEST day is what a lifter actually has to find time for. Averaging
  // hid a 100-minute leg day behind three 60-minute ones.
  const worst = real.reduce((a, b) => (b.mins > a.mins ? b : a), real[0] || { mins: 0, sets: 0, name: '' });
  return {
    muscles, days,
    total: days.reduce((n, d) => n + d.sets, 0),
    perSession: Math.round(real.reduce((n, d) => n + d.sets, 0) / (real.length || 1)),
    minsPerSession: Math.round(real.reduce((n, d) => n + d.mins, 0) / (real.length || 1)),
    worstMins: worst.mins, worstSets: worst.sets, worstDay: worst.name,
  };
}

const DATA = {};
for (const key of Object.keys(SPLITS))
  for (const sex of ['male', 'female'])
    for (const [tier, exp] of TIERS) (DATA[key] ??= {})[`${sex}.${tier}`] = measure(key, exp, tier, sex);

const MUSCLES = Object.keys(DATA[Object.keys(SPLITS)[0]]['male.intermediate'].muscles);
const LABEL = { side_delts: 'side delt', rear_delts: 'rear delt', hamstrings: 'hams', chest: 'chest',
  back: 'back', biceps: 'biceps', triceps: 'triceps', quads: 'quads', glutes: 'glutes', calves: 'calves', abs: 'abs' };

// ── the grid: splits × muscles, one cell per tier ───────────────────────────
function grid(sex) {
  const head = `<tr><th class="sticky">split</th>${MUSCLES.map(m => `<th>${esc(LABEL[m] || m)}</th>`).join('')}<th>sets/wk</th></tr>`;
  const rows = Object.keys(SPLITS).map(key => {
    const cells = MUSCLES.map(m => {
      const pips = TIERS.map(([tier]) => {
        const d = DATA[key][`${sex}.${tier}`].muscles[m];
        return `<i class="p ${d.status}" title="${esc(tier)}: ${d.done} of ${d.optimal_low}-${d.optimal_high}"></i>`;
      }).join('');
      return `<td class="pips">${pips}</td>`;
    }).join('');
    const tot = TIERS.map(([tier]) => DATA[key][`${sex}.${tier}`].total).join(' · ');
    return `<tr><th class="sticky">${esc(SPLITS[key].name)}</th>${cells}<td class="tot">${tot}</td></tr>`;
  }).join('');
  return `<div class="scroll"><table class="gridtbl">${head}${rows}</table></div>`;
}

// ── bars: where delivered sits inside the band ──────────────────────────────
function bars(key, sex, tier) {
  const m = DATA[key][`${sex}.${tier}`].muscles;
  return MUSCLES.map(k => {
    const d = m[k];
    const scale = Math.max(d.optimal_high, d.done) * 1.08;
    const pct = x => (x / scale * 100).toFixed(1);
    return `<div class="barrow">
      <span class="bl">${esc(LABEL[k] || k)}</span>
      <span class="track">
        <span class="band" style="left:${pct(d.optimal_low)}%;width:${pct(d.optimal_high - d.optimal_low)}%"></span>
        <span class="fill ${d.status}" style="width:${pct(d.done)}%"></span>
      </span>
      <span class="bn ${d.status}">${d.done}</span>
      <span class="bt">${d.optimal_low}–${d.optimal_high}</span>
    </div>`;
  }).join('');
}

// ── findings, derived not written ───────────────────────────────────────────
const findings = [];
for (const key of Object.keys(SPLITS)) {
  for (const sex of ['male', 'female']) for (const [tier] of TIERS) {
    const d = DATA[key][`${sex}.${tier}`];
    for (const [m, v] of Object.entries(d.muscles))
      if (v.status === 'bad' || v.status === 'low')
        findings.push({ sev: v.status === 'bad' ? 1 : 2, split: SPLITS[key].name, what: `${LABEL[m] || m} ${v.done} of ${v.optimal_low}`, ctx: `${sex} · ${tier}` });
  }
  const longest = Object.entries(DATA[key]).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.worstMins - a.worstMins)[0];
  if (longest.worstMins > 90)
    findings.push({
      sev: longest.worstMins > 100 ? 1 : 2, split: SPLITS[key].name,
      what: `${esc(longest.worstDay)} ~${longest.worstMins} min · ${longest.worstSets} sets`,
      ctx: longest.k.replace('.', ' · '),
    });
}
const seen = new Set();
const uniq = findings.filter(f => { const k = f.split + f.what; if (seen.has(k)) return false; seen.add(k); return true; })
  .sort((a, b) => a.sev - b.sev);

// ── session length ──────────────────────────────────────────────────────────
// Worst single day across both sexes at intermediate — the day someone has to
// clear their evening for, not a comfortable average.
const sessionRows = Object.keys(SPLITS).map(key => {
  const v = ['male.intermediate', 'female.intermediate']
    .map(k => ({ k, ...DATA[key][k] })).sort((a, b) => b.worstMins - a.worstMins)[0];
  const w = Math.min(100, v.worstMins / 120 * 100);
  const cls = v.worstMins > 100 ? 'bad' : v.worstMins > 85 ? 'low' : 'ok';
  return `<div class="barrow">
    <span class="bl wide">${esc(SPLITS[key].name)}</span>
    <span class="track"><span class="fill ${cls}" style="width:${w.toFixed(1)}%"></span></span>
    <span class="bn ${cls}">${v.worstMins}m</span>
    <span class="bt">${esc(v.worstDay)}</span>
  </div>`;
}).join('');

const detail = Object.keys(SPLITS).map(key => `<section class="split" id="${esc(key)}">
  <h3>${esc(SPLITS[key].name)} <span class="days">${SPLITS[key].days} days</span></h3>
  <div class="tiers">
    ${TIERS.map(([tier, , short]) => `<div class="tier">
      <h4>${esc(short)}</h4>${bars(key, 'male', tier)}
    </div>`).join('')}
  </div>
</section>`).join('');

const html = `<title>Helix — split volume status</title>
<style>
:root{ --bg:#f6f6f4; --card:#fff; --ink:#16171a; --ink2:#5a5d61; --ink3:#8d9095; --rule:#e3e3df;
  --ok:#3f7d4e; --okbg:#e3efe4; --low:#a8761a; --lowbg:#f6ecd8; --bad:#a83a2c; --badbg:#f6e0dc;
  --wv:#6a6d72; --wvbg:#e9e9e6; --band:#d7d9dc; }
@media (prefers-color-scheme:dark){ :root{ --bg:#131417; --card:#1b1c20; --ink:#e9e9e6; --ink2:#a5a7ab; --ink3:#75787c;
  --rule:#2a2b2f; --ok:#7fb98d; --okbg:#1e2a20; --low:#d8ab5c; --lowbg:#2e2718; --bad:#e0897a; --badbg:#331f1c;
  --wv:#8e9195; --wvbg:#232428; --band:#33353a; } }
:root[data-theme="light"]{ --bg:#f6f6f4; --card:#fff; --ink:#16171a; --ink2:#5a5d61; --ink3:#8d9095; --rule:#e3e3df;
  --ok:#3f7d4e; --okbg:#e3efe4; --low:#a8761a; --lowbg:#f6ecd8; --bad:#a83a2c; --badbg:#f6e0dc;
  --wv:#6a6d72; --wvbg:#e9e9e6; --band:#d7d9dc; }
:root[data-theme="dark"]{ --bg:#131417; --card:#1b1c20; --ink:#e9e9e6; --ink2:#a5a7ab; --ink3:#75787c;
  --rule:#2a2b2f; --ok:#7fb98d; --okbg:#1e2a20; --low:#d8ab5c; --lowbg:#2e2718; --bad:#e0897a; --badbg:#331f1c;
  --wv:#8e9195; --wvbg:#232428; --band:#33353a; }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);
  font:14px/1.4 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1120px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:24px;margin:0 0 2px;letter-spacing:-.02em}
.sub{margin:0 0 22px;color:var(--ink2);font-size:13px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.13em;color:var(--ink3);
  margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--rule)}
.card{background:var(--card);border:1px solid var(--rule);padding:14px 16px}

.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2);margin:8px 0 0}
.legend b{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.b-ok{background:var(--ok)} .b-low{background:var(--low)} .b-bad{background:var(--bad)} .b-wv{background:var(--wv)}

.scroll{overflow-x:auto;background:var(--card);border:1px solid var(--rule)}
.gridtbl{border-collapse:collapse;width:100%;min-width:720px;font-size:12px}
.gridtbl th,.gridtbl td{padding:5px 7px;border-bottom:1px solid var(--rule);text-align:center}
.gridtbl tr:first-child th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600}
th.sticky{text-align:left;position:sticky;left:0;background:var(--card);font-weight:500;white-space:nowrap;z-index:1}
.pips{white-space:nowrap}
i.p{display:inline-block;width:9px;height:16px;border-radius:2px;margin:0 1px}
i.ok{background:var(--ok)} i.low{background:var(--low)} i.bad{background:var(--bad)} i.waived{background:var(--wv)} i.over{background:var(--low)}
td.tot{color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:11px}

.barrow{display:grid;grid-template-columns:74px 1fr 30px 52px;gap:8px;align-items:center;padding:2px 0}
.barrow .bl{font-size:11.5px;color:var(--ink2);text-align:right}
.barrow .bl.wide{font-size:11.5px}
.track{position:relative;height:13px;background:var(--bg);border:1px solid var(--rule);border-radius:2px;overflow:hidden}
.band{position:absolute;top:0;bottom:0;background:var(--band)}
.fill{position:absolute;top:0;bottom:0;left:0;opacity:.92}
.fill.ok{background:var(--ok)} .fill.low{background:var(--low)} .fill.bad{background:var(--bad)}
.fill.waived{background:var(--wv)} .fill.over{background:var(--low)}
.bn{font-size:11.5px;font-variant-numeric:tabular-nums;text-align:right;font-weight:600}
.bn.ok{color:var(--ok)} .bn.low{color:var(--low)} .bn.bad{color:var(--bad)} .bn.waived{color:var(--wv)} .bn.over{color:var(--low)}
.bt{font-size:10.5px;color:var(--ink3);font-variant-numeric:tabular-nums}
.barrow.head{grid-template-columns:1fr}

table.find{border-collapse:collapse;width:100%;font-size:12.5px;background:var(--card);border:1px solid var(--rule)}
table.find td{padding:6px 10px;border-bottom:1px solid var(--rule)}
table.find tr td:first-child{width:6px;padding:0}
td.s1{background:var(--bad)} td.s2{background:var(--low)}
.fsplit{font-weight:600;white-space:nowrap} .fctx{color:var(--ink3);font-size:11px;white-space:nowrap;text-align:right}
.none{padding:12px;color:var(--ink3);background:var(--card);border:1px solid var(--rule)}

.split{background:var(--card);border:1px solid var(--rule);padding:12px 14px;margin-bottom:10px}
.split h3{margin:0 0 10px;font-size:14px}
.days{color:var(--ink3);font-weight:400;font-size:11.5px;margin-left:6px}
.tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
@media(max-width:820px){.tiers{grid-template-columns:1fr}}
.tier h4{margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink3)}
</style>
<div class="wrap">
<h1>Split volume status</h1>
<p class="sub">Full gym · generated from the app itself. Each cell is three tiers: beginner, intermediate, advanced.</p>

<h2>All splits &times; all muscles &mdash; men</h2>
${grid('male')}
<p class="legend">
  <span><b class="b-ok"></b>in optimal band</span>
  <span><b class="b-low"></b>below optimal, above minimum</span>
  <span><b class="b-bad"></b>below minimum</span>
  <span><b class="b-wv"></b>waived by design (men's glutes)</span>
</p>

<h2>Same, women</h2>
${grid('female')}

<h2>Problems &mdash; ${uniq.length}</h2>
${uniq.length ? `<table class="find">${uniq.map(f => `<tr>
  <td class="s${f.sev}"></td><td class="fsplit">${esc(f.split)}</td><td>${esc(f.what)}</td><td class="fctx">${esc(f.ctx)}</td>
</tr>`).join('')}</table>` : '<p class="none">Nothing below optimal anywhere.</p>'}

<h2>Longest single session &mdash; intermediate, worst of either sex</h2>
<div class="card">${sessionRows}
<p class="legend" style="margin-top:10px"><span>bar = minutes for the HARDEST day of the week, scale 0&ndash;120 · 3 min per compound set, 2 min per isolation set, warm-ups excluded</span></p></div>

<h2>Per-muscle detail &mdash; men, all tiers</h2>
<p class="sub">Grey band = optimal range. Bar = delivered.</p>
${detail}
</div>`;

const out = process.argv[2] || 'volume-dashboard.html';
fs.writeFileSync(out, html);
console.log(`${out} — ${Object.keys(SPLITS).length} splits, ${uniq.length} problems`);
