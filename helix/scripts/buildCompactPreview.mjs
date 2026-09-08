/**
 * buildCompactPreview.mjs — visual preview of Compact mode.
 *
 * Renders the Today-card toggle in both states (using the app's own theme
 * tokens) plus the real numbers: what the trim does to one session exercise by
 * exercise, and normal vs compact across every split. Data comes from
 * compact-data.json, dumped by running compactWorkout through the real
 * generator — nothing on this page is hand-typed.
 *
 * Run: node scripts/buildCompactPreview.mjs <data.json> <out.html>
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ex = data.example;
const saved = ex.normal - ex.compact;

// The app's exercise preview shows 4 rows then "+N more" — mirror that.
const previewRows = (mode) => ex.ex.slice(0, 4).map(e => `
  <div class="exrow">
    <span class="dot"></span>
    <span class="exname">${esc(e.name)}</span>
    <span class="exdetail">${mode === 'compact' ? e.to : e.from}×${esc(e.reps)}</span>
  </div>`).join('') + `<div class="more">+${ex.ex.length - 4} more</div>`;

const card = (on) => `
<div class="phone">
  <div class="scard">
    <div class="slabel">TODAY</div>
    <div class="sname">${esc(ex.day)}</div>
    <div class="sfocus">Heavy push + pull</div>
    <div class="smeta">
      <span class="chip">${ex.ex.length} exercises</span>
      <span class="chip">${ex.ex.reduce((n, e) => n + (on ? e.to : e.from), 0)} sets</span>
    </div>
    <div class="preview">${previewRows(on ? 'compact' : 'normal')}</div>
    <div class="ctoggle ${on ? 'on' : ''}">
      <div class="ctext">
        <div class="ctitle ${on ? 'on' : ''}">Compact mode</div>
        <div class="csub">${on
          ? 'Same exercises, fewer sets. Keep the weight and push the last set of each.'
          : 'Short on time? Cut to the minimum that still counts toward your week.'}</div>
      </div>
      <div class="cbadge ${on ? 'on' : ''}">~${on ? ex.compact : ex.normal} min</div>
    </div>
    <div class="startbtn">Start workout</div>
  </div>
  <div class="phlabel">${on ? 'ON — trimmed to ' + ex.compact + ' min' : 'OFF — full session, ' + ex.normal + ' min'}</div>
</div>`;

const exerciseRows = ex.ex.map(e => {
  const cut = e.from - e.to;
  return `<tr>
    <td>${esc(e.name)}</td>
    <td class="tag">${e.comp ? 'compound' : 'isolation'}</td>
    <td class="n">${e.from}</td>
    <td class="arrow">→</td>
    <td class="n ${cut ? 'cut' : 'same'}">${e.to}</td>
    <td class="n dim">${cut ? '−' + cut : '·'}</td>
  </tr>`;
}).join('');

const splitRows = data.splits.map(s => {
  const rows = s.days.map(d => {
    const pn = Math.min(100, d.n / 110 * 100), pc = Math.min(100, d.c / 110 * 100);
    return `<div class="brow">
      <span class="bl">${esc(d.name)}</span>
      <span class="btrack">
        <span class="bfull" style="width:${pn.toFixed(1)}%"></span>
        <span class="bcomp" style="width:${pc.toFixed(1)}%"></span>
      </span>
      <span class="bn">${d.n}m</span><span class="barr">→</span><span class="bn green">${d.c}m</span>
    </div>`;
  }).join('');
  const avgSave = Math.round(s.days.reduce((n, d) => n + (d.n - d.c), 0) / s.days.length);
  return `<section class="splitcard">
    <h3>${esc(s.name)} <span class="save">−${avgSave}m avg</span></h3>
    ${rows}
  </section>`;
}).join('');

const html = `<title>Helix — Compact mode</title>
<style>
/* Deliberately single-theme: the page previews the app's dark UI, so it commits
   to the app's own palette rather than inventing a light variant of it. */
:root{
  --bg:#0B0B10; --surface:#111114; --inset:#12121A; --border:#2C2C35; --borderSoft:#1E1E28;
  --ink:#FFFFFF; --muted:#A1A1AA; --subtle:#9494A0;
  --accent:#1D9E75; --accentSoft:#1D9E7522; --accentHair:#1D9E7540; --inverse:#F4F4F6;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:40px 22px 90px}
h1{font-size:30px;margin:0 0 6px;letter-spacing:-.025em}
.sub{margin:0;color:var(--muted);max-width:60ch}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--subtle);
  margin:44px 0 14px;padding-bottom:7px;border-bottom:1px solid var(--borderSoft)}

.phones{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin-top:22px}
.phone{flex:0 1 330px}
.phlabel{text-align:center;margin-top:10px;font-size:12px;color:var(--subtle);
  text-transform:uppercase;letter-spacing:.09em}
.scard{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:18px}
.slabel{font-size:11px;letter-spacing:.12em;color:var(--subtle);font-weight:600}
.sname{font-size:22px;font-weight:700;margin-top:4px;letter-spacing:-.02em}
.sfocus{font-size:13px;color:var(--muted);margin-top:2px}
.smeta{display:flex;gap:8px;margin-top:12px}
.chip{background:var(--inset);border:0.5px solid var(--border);border-radius:8px;
  padding:4px 10px;font-size:13px;color:var(--muted);font-weight:500}
.preview{border-top:0.5px solid var(--border);margin-top:14px;padding-top:12px;
  display:flex;flex-direction:column;gap:8px}
.exrow{display:flex;align-items:center;gap:9px}
.dot{width:4px;height:4px;border-radius:2px;background:var(--subtle);flex:none}
.exname{flex:1;font-size:14px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.exdetail{font-size:13px;color:var(--subtle);font-variant-numeric:tabular-nums}
.more{font-size:13px;color:var(--subtle);padding-left:13px}
.ctoggle{display:flex;align-items:center;gap:12px;margin-top:16px;background:var(--inset);
  border:0.5px solid var(--border);border-radius:10px;padding:12px}
.ctoggle.on{background:var(--accentSoft);border-color:var(--accentHair)}
.ctext{flex:1}
.ctitle{font-size:15px;font-weight:600}
.ctitle.on{color:var(--accent)}
.csub{font-size:13px;line-height:19px;color:var(--subtle);margin-top:2px}
.cbadge{background:var(--surface);border:0.5px solid var(--border);border-radius:10px;
  padding:4px 8px;font-size:13px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums}
.cbadge.on{background:var(--accent);border-color:var(--accent);color:var(--surface)}
.startbtn{background:var(--inverse);color:#111;border-radius:14px;padding:14px;
  text-align:center;font-weight:700;font-size:15px;letter-spacing:.3px;margin-top:16px}

table.ex{border-collapse:collapse;width:100%;background:var(--surface);
  border:1px solid var(--border);font-size:14px}
table.ex td{padding:8px 12px;border-bottom:1px solid var(--borderSoft)}
td.tag{color:var(--subtle);font-size:11px;text-transform:uppercase;letter-spacing:.07em;white-space:nowrap}
td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;width:36px}
td.arrow{color:var(--subtle);width:20px;text-align:center}
td.cut{color:var(--accent)}
td.same{color:var(--muted)}
td.dim{color:var(--subtle);font-weight:400}
.exfoot{display:flex;gap:26px;margin-top:12px;color:var(--muted);font-size:13.5px;flex-wrap:wrap}
.exfoot b{color:var(--accent);font-variant-numeric:tabular-nums}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.splitcard{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.splitcard h3{margin:0 0 10px;font-size:14px;font-weight:600;display:flex;
  justify-content:space-between;align-items:baseline;gap:8px}
.save{color:var(--accent);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
.brow{display:grid;grid-template-columns:76px 1fr 34px 14px 34px;gap:7px;align-items:center;padding:2.5px 0}
.bl{font-size:11.5px;color:var(--muted);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btrack{position:relative;height:12px;background:var(--inset);border-radius:2px;overflow:hidden}
.bfull{position:absolute;inset:0 auto 0 0;background:var(--border)}
.bcomp{position:absolute;inset:0 auto 0 0;background:var(--accent);opacity:.9}
.bn{font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--muted);text-align:right}
.bn.green{color:var(--accent);font-weight:700}
.barr{color:var(--subtle);font-size:10px;text-align:center}

.rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.rule{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.rule b{display:block;font-size:14px;margin-bottom:4px}
.rule p{margin:0;font-size:13px;line-height:19px;color:var(--muted)}
</style>
<div class="wrap">
<h1>Compact mode</h1>
<p class="sub">One tap on the Today card trims the session to the minimum volume that still counts toward
the week. Same exercises, fewer sets — nothing is removed, and it expires at midnight.</p>

<h2>The toggle — off and on</h2>
<div class="phones">${card(false)}${card(true)}</div>

<h2>${esc(ex.day)} — exercise by exercise</h2>
<div style="overflow-x:auto"><table class="ex">${exerciseRows}</table></div>
<div class="exfoot">
  <span><b>${ex.normal}m → ${ex.compact}m</b>&ensp;session</span>
  <span><b>${ex.ex.reduce((n, e) => n + e.from, 0)} → ${ex.ex.reduce((n, e) => n + e.to, 0)}</b>&ensp;working sets</span>
  <span><b>−${saved} min</b>&ensp;saved</span>
</div>

<h2>Every split, every day — grey full, green compact</h2>
<div class="grid">${splitRows}</div>

<h2>The rules</h2>
<div class="rules">
  <div class="rule"><b>Compounds are protected</b><p>Bench, squat, rows drop one set but never below 2 —
    they train several muscles at once and are the most stimulus per minute.</p></div>
  <div class="rule"><b>Isolation caps at 2</b><p>A lateral raise trains one head; it is the cheapest
    thing to trim. Every exercise stays, so the workout still looks like yours.</p></div>
  <div class="rule"><b>It expires on its own</b><p>A trim is a decision about today, not a setting.
    Today-scope dies at midnight; a coach-set week scope after 7 days.</p></div>
  <div class="rule"><b>The coach can switch it on</b><p>Say &ldquo;I&rsquo;ve only got 30 minutes&rdquo; and the coach
    turns compact mode on for you — no new coach UI, it is a tool call.</p></div>
</div>
</div>`;

fs.writeFileSync(process.argv[3], html);
console.log(process.argv[3]);
