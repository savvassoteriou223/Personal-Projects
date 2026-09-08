/**
 * buildSplitExplorer.mjs — builds ONE self-contained HTML page that walks the
 * whole hierarchy in a single place:
 *
 *   Goal -> splits -> exercises per split -> muscle group per exercise
 *        -> set volume vs the optimal range
 *
 * Replaces the three separate CSVs, which forced cross-referencing by hand.
 *
 * Data is generated from the REAL generateProgram / buildVolumeView, embedded
 * as JSON, and rendered client-side so goal + experience tier are selectable
 * without regenerating anything.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/buildSplitExplorer.mjs <out.html>
 */
import fs from 'fs';
import { generateProgram, SPLITS, SPLIT_RANKINGS, VOLUME_TARGETS } from '../screens/programGenerator.js';
import { buildVolumeView } from '../screens/volumeEngine.js';
import { getPatternLabelForExercise } from '../screens/movementLibrary.js';

const OUT = process.argv[2] || 'split_explorer.html';
const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cables', 'Machines', 'Pull-up bar', 'Bodyweight only'];
const TIERS = ['beginner', 'intermediate', 'advanced'];
const ALL_GOALS = [...new Set(Object.values(SPLIT_RANKINGS).flatMap(o => Object.keys(o)))];

const build = (splitId, tier, goal) => generateProgram({
  trainingExperience: tier, equipment: EQUIPMENT, weekly_workouts: SPLITS[splitId].days,
  goals: [goal], sex: 'male', weight_kg: 80, selected_split: splitId,
});
const sigOf = (p) => (p.days || []).map(d =>
  `${d.id}:` + (d.exercises || []).map(e => `${e.name}#${e.sets}x${e.reps}`).join('|')).join('||');
const weekSets = (p) => {
  const out = [];
  for (const day of p.days || [])
    for (const ex of day.exercises || []) {
      if (!ex?.name || (ex.sets || 0) <= 0) continue;
      for (let i = 0; i < ex.sets; i++)
        out.push({ exercise_name: ex.name, pattern_key: ex.pattern, reps: 10, weight_kg: 50, set_type: 'working' });
    }
  return out;
};
const statusOf = (done, t) =>
  done === 0 && t.min > 0 ? 'zero'
  : done < t.min ? 'under'
  : done < t.optimal_low ? 'low'
  : done <= t.optimal_high ? 'ok' : 'over';

// goal -> variant index, per split+tier (verified identical everywhere, but
// computed rather than assumed so a future generator change can't silently
// invalidate the page).
const data = { splits: {}, goals: ALL_GOALS, tiers: TIERS, goalVariant: {}, programs: {}, rankings: {} };

for (const [id, s] of Object.entries(SPLITS)) {
  data.splits[id] = { name: s.name, days: s.days, optimality: s.optimality, score: s.optimality_score };
}
for (const days of Object.keys(SPLIT_RANKINGS)) {
  data.rankings[days] = {};
  for (const [goal, list] of Object.entries(SPLIT_RANKINGS[days])) {
    data.rankings[days][goal] = list.map(o => ({ id: o.id, rank: o.rank, why: o.why }));
  }
}

for (const splitId of Object.keys(SPLITS)) {
  data.programs[splitId] = {};
  data.goalVariant[splitId] = {};
  for (const tier of TIERS) {
    const variants = new Map();
    const gv = {};
    for (const goal of ALL_GOALS) {
      const p = build(splitId, tier, goal);
      const sig = sigOf(p);
      if (!variants.has(sig)) variants.set(sig, { idx: variants.size, program: p });
      gv[goal] = variants.get(sig).idx;
    }
    data.goalVariant[splitId][tier] = gv;
    data.programs[splitId][tier] = [...variants.values()].map(({ program }) => {
      const days = (program.days || []).map(d => ({
        id: d.id, name: d.name,
        ex: (d.exercises || []).map(e => ({
          n: e.name,
          g: getPatternLabelForExercise(e.name) || (e.muscles || ''),
          m: e.muscles || '',
          s: e.sets ?? 0, r: e.reps ?? '', rest: e.rest ?? '',
        })),
      }));
      const vol = [];
      for (const g of buildVolumeView(weekSets(program), tier)) {
        const push = (key, done, t) => {
          if (!t) return;
          vol.push({ m: key, d: done, min: t.min, lo: t.optimal_low, hi: t.optimal_high, st: statusOf(done, t) });
        };
        if (g.split) g.heads.forEach(h => push(h.key, h.direct, h.target));
        else push(g.key, g.done, g.target);
      }
      return { days, vol };
    });
  }
}
data.targets = {};
for (const [m, byTier] of Object.entries(VOLUME_TARGETS)) {
  data.targets[m] = {};
  for (const t of TIERS) if (byTier[t]) data.targets[m][t] = byTier[t];
}

const GOAL_LABELS = {
  muscle: 'Build muscle', strength: 'Strength', lose: 'Lose fat', endurance: 'Endurance',
  maintain: 'Maintain', default: 'Default', recomp: 'Recomposition', cut_strength: 'Cut + strength',
  cut_endurance: 'Cut + endurance', powerbuilding: 'Powerbuilding', hybrid_muscle: 'Hybrid — muscle',
  hybrid_strength: 'Hybrid — strength', powerbuilding_cut: 'Powerbuilding cut',
  athletic_recomp: 'Athletic recomp', athletic_cut: 'Athletic cut', athletic_bulk: 'Athletic bulk',
};

const html = `<title>Split Explorer — goal to volume</title>
<style>
  :root{
    --bg:#0F0F13; --surface:#15151b; --raised:#1A1A20; --border:#24242e;
    --text:#EDEDF0; --dim:#9A9AA5; --faint:#6E6E78;
    --accent:#1D9E75; --accent-soft:#1D9E7518; --accent-line:#1D9E7540;
    --warn:#E3A23D; --warn-soft:#BA751522; --crit:#E06B5E; --crit-soft:#E06B5E22;
  }
  :root[data-theme="light"]{
    --bg:#F7F7F3; --surface:#FFFFFF; --raised:#FBFBF8; --border:#E2E2DB;
    --text:#14140F; --dim:#55554D; --faint:#86867C;
    --accent:#157A5B; --accent-soft:#157A5B12; --accent-line:#157A5B33;
    --warn:#96600F; --warn-soft:#96600F14; --crit:#A8382B; --crit-soft:#A8382B14;
  }
  @media (prefers-color-scheme:light){:root:not([data-theme="dark"]){
    --bg:#F7F7F3; --surface:#FFFFFF; --raised:#FBFBF8; --border:#E2E2DB;
    --text:#14140F; --dim:#55554D; --faint:#86867C;
    --accent:#157A5B; --accent-soft:#157A5B12; --accent-line:#157A5B33;
    --warn:#96600F; --warn-soft:#96600F14; --crit:#A8382B; --crit-soft:#A8382B14;
  }}
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--text);margin:0;padding:0 0 80px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:14px;line-height:1.5}
  .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
  header{padding:32px 0 18px}
  .eyebrow{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:.09em;
    text-transform:uppercase;color:var(--accent);margin:0 0 8px}
  h1{font-size:clamp(21px,2.6vw,27px);margin:0 0 8px;font-weight:650;letter-spacing:-.01em}
  header p{color:var(--dim);margin:0;max-width:70ch;font-size:13.5px}
  .chain{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:14px;
    font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:var(--faint)}
  .chain b{color:var(--dim);font-weight:500}
  .chain span{color:var(--accent)}

  .controls{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:1px solid var(--border);
    padding:12px 0;margin-bottom:22px}
  .controls .row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
  .field{display:flex;flex-direction:column;gap:5px}
  .field label{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);
    font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
  select{background:var(--raised);color:var(--text);border:1px solid var(--border);border-radius:7px;
    padding:7px 10px;font-size:13.5px;font-family:inherit;min-width:190px}
  .seg{display:flex;border:1px solid var(--border);border-radius:7px;overflow:hidden}
  .seg button{background:var(--raised);color:var(--dim);border:0;padding:7px 13px;font-size:12.5px;
    font-family:inherit;cursor:pointer;border-right:1px solid var(--border)}
  .seg button:last-child{border-right:0}
  .seg button[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent);font-weight:600}
  .tally{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}
  .pill{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:10.5px;padding:4px 8px;
    border-radius:5px;border:1px solid var(--border);color:var(--dim);white-space:nowrap}
  .pill.ok{background:var(--accent-soft);color:var(--accent);border-color:var(--accent-line)}
  .pill.low{background:var(--warn-soft);color:var(--warn);border-color:var(--warn)}
  .pill.bad{background:var(--crit-soft);color:var(--crit);border-color:var(--crit)}

  .split{border:1px solid var(--border);border-radius:11px;background:var(--surface);margin-bottom:16px;overflow:hidden}
  .split.flag{border-color:var(--crit)}
  .split>summary{padding:13px 16px;cursor:pointer;display:flex;align-items:center;gap:11px;flex-wrap:wrap;
    background:var(--raised);list-style:none;user-select:none}
  .split>summary::-webkit-details-marker{display:none}
  .split>summary::before{content:'▸';color:var(--faint);font-size:11px;transition:transform .15s}
  .split[open]>summary::before{transform:rotate(90deg)}
  .sname{font-weight:600;font-size:14px}
  .sdays{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:var(--faint)}
  .rank{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:10px;padding:3px 7px;border-radius:4px;
    background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent-line)}
  .rank.off{background:transparent;color:var(--faint);border-color:var(--border)}
  .sbody{padding:4px 16px 16px}
  .why{color:var(--dim);font-size:12.5px;margin:10px 0 16px;padding-left:11px;border-left:2px solid var(--accent-line)}

  h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin:20px 0 8px;
    font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-weight:500}
  .scroll{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px;min-width:560px}
  th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);
    font-weight:500;padding:6px 9px;border-bottom:1px solid var(--border);
    font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;white-space:nowrap}
  td{padding:6px 9px;border-bottom:1px solid var(--border);vertical-align:top}
  tbody tr:last-child td{border-bottom:0}
  .num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
  .grp{color:var(--dim);font-size:12px}
  .daytag{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:var(--accent);
    padding:9px 9px 3px;display:block}
  .st{display:inline-block;min-width:78px;text-align:center;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
    font-size:10.5px;padding:2px 6px;border-radius:4px}
  .st.ok{background:var(--accent-soft);color:var(--accent)}
  .st.low{background:var(--warn-soft);color:var(--warn)}
  .st.under,.st.zero{background:var(--crit-soft);color:var(--crit)}
  .bar{position:relative;height:6px;background:var(--border);border-radius:3px;min-width:110px;margin-top:5px}
  .bar i{position:absolute;top:0;bottom:0;left:0;border-radius:3px;background:var(--accent)}
  .bar i.low{background:var(--warn)} .bar i.under,.bar i.zero{background:var(--crit)}
  .bar u{position:absolute;top:-3px;bottom:-3px;border-left:1px dashed var(--faint);opacity:.7}
  .note{color:var(--faint);font-size:11.5px;margin-top:9px}
  footer{color:var(--faint);font-size:12px;border-top:1px solid var(--border);margin-top:34px;padding-top:16px}
  footer code{font-size:11.5px;color:var(--dim)}
</style>

<div class="wrap">
<header>
  <p class="eyebrow">Program generator · full matrix</p>
  <h1>Split Explorer</h1>
  <p>Every generated program in one place. Pick a goal and an experience level; each split below expands to its exercises, the muscle group each one trains, and how the week's sets land against the optimal range for that muscle.</p>
  <div class="chain"><b>Goal</b><span>→</span><b>splits</b><span>→</span><b>exercises</b><span>→</span><b>muscle group</b><span>→</span><b>sets vs optimal</b></div>
</header>

<div class="controls"><div class="row">
  <div class="field"><label for="goal">Goal</label><select id="goal"></select></div>
  <div class="field"><label>Experience</label><div class="seg" id="tier"></div></div>
  <div class="field"><label>Show</label><div class="seg" id="filter">
    <button data-f="all" aria-pressed="true">All splits</button>
    <button data-f="issues" aria-pressed="false">Only with shortfalls</button>
  </div></div>
  <div class="tally" id="tally"></div>
</div></div>

<div id="out"></div>

<footer>
  Generated from the app's own <code>generateProgram()</code> and <code>buildVolumeView()</code> — the same functions that build and measure a real user's program. Volume counts DIRECT sets only, credited the way the app credits them; indirect work from compounds is excluded, matching the Today heat map.
  <br><br>
  Two collapses worth knowing: <b>16 goal keys produce only 4 distinct programs</b> per split (only <i>strength</i>, <i>lose</i> and <i>endurance</i> differ — the other 13 are byte-identical), and <b>equipment never changes set counts</b>, only which exercise fills a slot, so volume here holds for any equipment set.
</footer>
</div>

<script>
const DATA = ${JSON.stringify(data)};
const GOAL_LABELS = ${JSON.stringify(GOAL_LABELS)};
const ST_LABEL = { ok:'optimal', low:'below optimal', under:'below minimum', zero:'no work', over:'above optimal' };

let goal = 'muscle', tier = 'intermediate', filter = 'all';

const goalSel = document.getElementById('goal');
DATA.goals.forEach(g => {
  const o = document.createElement('option');
  o.value = g; o.textContent = GOAL_LABELS[g] || g;
  goalSel.appendChild(o);
});
goalSel.value = goal;
goalSel.addEventListener('change', e => { goal = e.target.value; render(); });

const tierBox = document.getElementById('tier');
DATA.tiers.forEach(t => {
  const b = document.createElement('button');
  b.textContent = t; b.setAttribute('aria-pressed', String(t === tier));
  b.addEventListener('click', () => {
    tier = t;
    [...tierBox.children].forEach(c => c.setAttribute('aria-pressed', String(c.textContent === t)));
    render();
  });
  tierBox.appendChild(b);
});

document.getElementById('filter').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  filter = b.dataset.f;
  [...b.parentElement.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  render();
});

function barFor(v) {
  // Scale to optimal_high so the dashed marker (optimal_low) sits comparably.
  const max = Math.max(v.hi, v.d, 1);
  const pct = Math.min(100, (v.d / max) * 100);
  const loPct = Math.min(100, (v.lo / max) * 100);
  return '<div class="bar"><i class="' + v.st + '" style="width:' + pct.toFixed(1) + '%"></i>' +
         '<u style="left:' + loPct.toFixed(1) + '%"></u></div>';
}

function render() {
  const out = document.getElementById('out');
  out.innerHTML = '';
  let tally = { ok:0, low:0, under:0, zero:0 };

  const cards = Object.keys(DATA.splits).map(id => {
    const s = DATA.splits[id];
    const vi = DATA.goalVariant[id][tier][goal];
    const prog = DATA.programs[id][tier][vi];
    const ranked = (DATA.rankings[s.days] && DATA.rankings[s.days][goal]) || [];
    const rank = ranked.find(r => r.id === id);
    const counts = prog.vol.reduce((a, v) => (a[v.st] = (a[v.st] || 0) + 1, a), {});
    Object.keys(tally).forEach(k => tally[k] += counts[k] || 0);
    const problems = (counts.low || 0) + (counts.under || 0) + (counts.zero || 0);
    return { id, s, prog, rank, counts, problems };
  });

  cards.sort((a, b) => (a.rank ? a.rank.rank : 99) - (b.rank ? b.rank.rank : 99) || a.s.days - b.s.days);

  const shown = filter === 'issues' ? cards.filter(c => c.problems > 0) : cards;

  document.getElementById('tally').innerHTML =
    '<span class="pill ok">' + tally.ok + ' optimal</span>' +
    '<span class="pill low">' + tally.low + ' below optimal</span>' +
    '<span class="pill bad">' + (tally.under + tally.zero) + ' below minimum</span>';

  if (!shown.length) { out.innerHTML = '<p class="note">No splits with shortfalls for this goal and experience level.</p>'; return; }

  shown.forEach((c, i) => {
    const d = document.createElement('details');
    d.className = 'split' + ((c.counts.under || c.counts.zero) ? ' flag' : '');
    if (i === 0) d.open = true;

    const badge = c.rank
      ? '<span class="rank">recommended #' + c.rank.rank + ' at ' + c.s.days + ' days</span>'
      : '<span class="rank off">not ranked for this goal</span>';
    const flags = c.problems
      ? '<span class="pill ' + ((c.counts.under || c.counts.zero) ? 'bad' : 'low') + '">' + c.problems + ' muscle' + (c.problems === 1 ? '' : 's') + ' short</span>'
      : '<span class="pill ok">all optimal</span>';

    let h = '<summary><span class="sname">' + c.s.name + '</span>' +
            '<span class="sdays">' + c.s.days + ' days · ' + c.id + '</span>' + badge + flags + '</summary>' +
            '<div class="sbody">';
    if (c.rank) h += '<p class="why">' + c.rank.why + '</p>';

    h += '<h3>Exercises and the muscle group each trains</h3><div class="scroll"><table>' +
         '<thead><tr><th>#</th><th>Exercise</th><th>Muscle group</th><th class="num">Sets</th><th class="num">Reps</th></tr></thead><tbody>';
    c.prog.days.forEach(day => {
      h += '<tr><td colspan="5"><span class="daytag">' + day.name + '</span></td></tr>';
      day.ex.forEach((e, ix) => {
        h += '<tr><td class="num">' + ix + '</td><td>' + e.n + '</td>' +
             '<td class="grp">' + e.g + '</td><td class="num">' + e.s + '</td><td class="num">' + e.r + '</td></tr>';
      });
    });
    h += '</tbody></table></div>';

    h += '<h3>Weekly sets vs optimal range</h3><div class="scroll"><table>' +
         '<thead><tr><th>Muscle</th><th class="num">Sets</th><th class="num">Min</th><th class="num">Optimal</th><th>Status</th></tr></thead><tbody>';
    c.prog.vol.slice().sort((a, b) => (a.st === b.st ? 0 : (a.st === 'ok' ? 1 : b.st === 'ok' ? -1 : 0)))
      .forEach(v => {
        h += '<tr><td>' + v.m + barFor(v) + '</td><td class="num">' + v.d + '</td><td class="num">' + v.min + '</td>' +
             '<td class="num">' + v.lo + '–' + v.hi + '</td>' +
             '<td><span class="st ' + v.st + '">' + ST_LABEL[v.st] + '</span></td></tr>';
      });
    h += '</tbody></table></div><p class="note">Bar is filled to the set count; the dashed line marks the bottom of the optimal range.</p></div>';

    d.innerHTML = h;
    out.appendChild(d);
  });
}
render();
</script>`;

fs.writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`splits ${Object.keys(SPLITS).length} · goals ${ALL_GOALS.length} · tiers ${TIERS.length}`);
