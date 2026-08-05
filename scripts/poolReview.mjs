/**
 * poolReview.mjs — builds the exercise-pool review page.
 *
 * The "current" side is read straight out of movementLibrary.js so it can never
 * drift from what the app actually ships. The "proposed" side is the only
 * hand-authored part, and nothing here writes to the library — this is a
 * review artifact, approvals happen separately.
 *
 * Run: node --loader ./scripts/extres.mjs scripts/poolReview.mjs <out.html>
 */
import fs from 'fs';
import { MOVEMENT_PATTERNS, getAllExercisesForPattern } from '../screens/movementLibrary.js';

const SETS = {
  'Full gym':   ['barbell', 'dumbbells', 'cables', 'machines', 'smith', 'pullup_bar', 'bodyweight'],
  'Garage':     ['barbell', 'dumbbells', 'bodyweight', 'pullup_bar'],
  'Dumbbells':  ['dumbbells', 'bodyweight'],
  'Bodyweight': ['bodyweight'],
  'Bands':      ['bands', 'bodyweight'],
};

// Muscle-group ordering for the page. Chest first — it is the thinnest of the
// large muscles and where the review starts.
const GROUPS = [
  ['Chest',     ['chest_horizontal_push', 'chest_incline_push', 'chest_isolation', 'chest_decline']],
  ['Back',      ['back_isolation', 'back_vertical_pull', 'back_inner', 'back_horizontal_pull']],
  ['Shoulders', ['upper_traps', 'shoulders_vertical_push', 'shoulders_side_delt', 'rear_delt']],
  ['Legs',      ['quad_isolation', 'hamstring_isolation', 'calves', 'glute_focused', 'hip_hinge', 'squat_pattern']],
  ['Arms',      ['triceps', 'biceps', 'forearms']],
  ['Core',      ['core']],
];

// ─── Proposed additions ──────────────────────────────────────────────────────
// `why` is the case for the exercise. `note` is a caveat on the pattern itself
// that adding exercises would NOT solve — recorded so the gap isn't mistaken
// for something a bigger pool fixes.
const PROPOSED = {
  chest_horizontal_push: {
    add: [
      ['Dumbbell floor press', 'dumbbells', 'Shorter range, no loaded stretch at the bottom — the standard swap when benching aggravates a shoulder. Dumbbell-only users have 3 options.'],
      ['Barbell floor press', 'barbell', 'Same joint-friendly press for garage setups, which sit at 2 options.'],
      ['Cable chest press', 'cables', 'There is no cable horizontal press anywhere in the library. Every full gym has one, and it is the most joint-friendly way to press.'],
      ['Weighted push-up', 'bodyweight', 'The only loadable bodyweight press. Without it a bodyweight user has no way to progress once push-ups get easy.'],
    ],
  },
  chest_incline_push: {
    add: [
      ['Low-to-high cable press', 'cables', 'No cable option in this pattern either. Resistance line matches upper-chest fibre direction.'],
      ['Reverse-grip barbell bench press', 'barbell', 'One of the few barbell presses with a genuine upper-chest bias, and it adds variety without a new machine.'],
      ['Landmine press', 'barbell', 'Incline-angle pressing for people who cannot press overhead or lie back comfortably.'],
    ],
  },
  chest_isolation: {
    add: [
      ['Incline dumbbell fly', 'dumbbells', 'Dumbbell-only users have exactly one chest isolation option. This doubles it and biases upper chest.'],
      ['Low-to-high cable fly', 'cables', 'Distinct from the existing flat cable fly by resistance angle, not just a renamed variant.'],
      ['Dumbbell squeeze press', 'dumbbells', 'Adduction under constant tension — isolation stimulus without a stretched shoulder position.'],
    ],
    note: 'No bodyweight chest isolation is proposed because there is not an honest one. That zero should be closed by having the generator substitute a press for bodyweight-only users.',
  },
  chest_decline: {
    add: [],
    note: 'The only chest pattern with adequate depth. The dumbbell and bodyweight gaps are the same substitution question — dips need a bar and there is no real unweighted decline press.',
  },

  back_isolation: {
    add: [
      ['Dumbbell pullover', 'dumbbells', 'Closes a hard zero: dumbbell-only users currently get no lat isolation at all.'],
      ['Straight-arm cable pulldown', 'cables', 'Shoulder extension with a locked elbow — the cleanest lat isolation there is, and it is missing.'],
      ['Band straight-arm pulldown', 'bands', 'Closes the band zero with the same mechanics.'],
      ['Incline bench dumbbell pullover', 'dumbbells', 'Loads the lat in a deeper stretched position than the flat version.'],
    ],
    note: 'The weakest pattern in the library: 3 exercises total, all pullover variants, and empty for dumbbells, bodyweight and bands.',
  },
  back_vertical_pull: {
    add: [
      ['Band lat pulldown (anchored high)', 'bands', 'Bands have one option. This is the closest band analogue to a pulldown.'],
      ['Negative-only pull-up', 'pullup_bar', 'The missing rung between "cannot do a pull-up" and a full one. Beginners currently jump straight to the real thing.'],
      ['Machine assisted pull-up', 'machines', 'The gym equivalent of the same rung, and standard equipment.'],
    ],
    note: 'The dumbbell and bodyweight zeros are physics, not pool size — you cannot vertically pull with no bar and no anchor. Worth confirming what the generator substitutes there, because those users may be getting no lat work at all.',
  },
  back_inner: {
    add: [
      ['Seated cable row (wide grip, high elbows)', 'cables', 'A second cable option so block rotation is not stuck alternating two exercises.'],
      ['Band wide row (flared elbows)', 'bands', 'Bands have one option here.'],
      ['Inverted row (wide grip, elbows flared)', 'bodyweight', 'The one bodyweight option is a Y-T-W raise, which is a light prehab movement, not a loadable mid-back row.'],
    ],
  },
  back_horizontal_pull: {
    add: [
      ['Seal row', 'barbell', 'Fully chest-supported so the lower back cannot limit the set — the cleanest way to overload mid-back.'],
      ['Single-arm cable row', 'cables', 'Adds unilateral work and a longer range than the bilateral version.'],
    ],
    note: 'Already one of the deepest patterns. These two are quality, not coverage.',
  },

  upper_traps: {
    add: [
      ['Trap bar shrug', 'barbell', 'Neutral-grip loading with the weight in line with the body rather than in front of it.'],
      ['Smith machine shrug', 'smith', 'Lets grip fail after the traps rather than before, which is the usual limiter.'],
      ['Overhead carry / dead hang shrug', 'pullup_bar', 'Closes the bodyweight zero with a real loaded movement.'],
    ],
    note: 'This pattern has no volume target defined anywhere in the generator — worth resolving separately from pool size.',
  },
  shoulders_vertical_push: {
    add: [
      ['Seated dumbbell press (back supported)', 'dumbbells', 'The existing entry is unsupported; the supported version allows heavier loading with no lower-back involvement.'],
      ['Landmine shoulder press', 'barbell', 'Overhead pressing for anyone with limited shoulder mobility, who currently has no option.'],
      ['Band overhead press (seated)', 'bands', 'Bands have two options.'],
    ],
  },
  shoulders_side_delt: {
    add: [
      ['Leaning cable lateral raise', 'cables', 'Torso lean puts the hardest part of the strength curve at the stretched position rather than the top.'],
      ['Upright row (wide grip, cable or dumbbell)', 'cables', 'A loadable side-delt movement with a heavier profile than raises.'],
      ['Lu raise (overhead arc)', 'dumbbells', 'Already in the library but filed under rear delt, where it does not belong — moving it here rather than adding it.'],
    ],
  },
  rear_delt: {
    add: [
      ['Chest-supported reverse dumbbell flye (incline bench)', 'dumbbells', 'Removes momentum entirely, which is the main reason rear delt work fails.'],
      ['Band bent-over reverse flye', 'bands', 'A true bent-over rear delt movement for band users.'],
    ],
    note: 'Three current entries are not rear delt movements — Barbell front raise trains the opposing muscle, and both Y raises are lower trap. All three are rotation options, so the generator will serve them and credit rear delt volume for work that never happened. Pending your call.',
  },

  quad_isolation: {
    add: [
      ['Reverse Nordic curl', 'bodyweight', 'Knee extension under a deep stretch, and the only quad isolation that needs no machine. Full gyms currently see two options — both leg extension variants.'],
      ['Cable leg extension (ankle strap)', 'cables', 'Closes the "no leg extension machine" case, which currently drops to nothing usable.'],
      ['Banded leg extension (seated)', 'bands', 'Same movement for band users.'],
    ],
    note: 'Thinnest pattern in a full gym — 2 options, so rotation alternates between the same two forever and the coach cannot offer 3 alternatives.',
  },
  hamstring_isolation: {
    add: [
      ['Dumbbell lying leg curl', 'dumbbells', 'Dumbbell users have two options, one of which is the Nordic — brutal for a beginner and effectively unusable.'],
      ['Glute-ham raise', 'machines', 'The strongest hamstring movement in the eccentric position and a genuine gap.'],
      ['Stability ball leg curl', 'bodyweight', 'A far gentler entry point than the Nordic for anyone who cannot do one.'],
    ],
  },
  calves: {
    add: [
      ['Smith machine calf raise', 'smith', 'Stable loading without needing a dedicated calf machine.'],
      ['Dumbbell single-leg calf raise', 'dumbbells', 'Dumbbell users have two options and no loaded unilateral work.'],
      ['Band standing calf raise', 'bands', 'Bands have one option.'],
      ['Seated dumbbell calf raise (knee bent)', 'dumbbells', 'Bent-knee loading hits soleus, which the standing variants largely miss.'],
    ],
    note: 'Full-gym depth of 6 is fine; every other equipment set is at 1 or 2.',
  },
  glute_focused: {
    add: [
      ['Dumbbell hip thrust', 'dumbbells', 'The single most important missing glute movement for anyone without a barbell — garage and dumbbell users are at 2.'],
      ['Barbell hip thrust', 'barbell', 'Currently filed under hip hinge, so it credits hamstrings and back rather than glutes. Should be here.'],
      ['Band hip thrust', 'bands', 'Same movement for band users.'],
      ['Reverse hyperextension', 'machines', 'Direct glute loading with no spinal compression.'],
      ['Frog pump', 'bodyweight', 'High-rep glute work needing no equipment at all.'],
    ],
  },
  hip_hinge: {
    add: [
      ['Dumbbell single-leg Romanian deadlift (loaded)', 'dumbbells', 'The existing single-leg version is bodyweight only, so there is no way to progress it.'],
      ['Trap bar deadlift', 'barbell', 'A more forgiving spinal position than conventional, and the usual recommendation for beginners.'],
      ['Good morning', 'barbell', 'Hamstring-dominant hinge that loads the stretch differently to an RDL.'],
    ],
  },
  squat_pattern: {
    add: [
      ['Heels-elevated goblet squat', 'dumbbells', 'Lets people who cannot reach depth actually squat, rather than being handed a movement they will do badly.'],
      ['Belt squat', 'machines', 'Loaded squatting with no spinal compression — the standard answer for a cranky lower back.'],
      ['Reverse lunge', 'dumbbells', 'Easier on the knee than a forward lunge and more stable than a Bulgarian split squat.'],
    ],
    note: 'The deepest pattern in the library at 16. These are gap-fillers, not padding.',
  },

  triceps: {
    add: [
      ['Cross-body cable extension', 'cables', 'Long-head biased at a different angle to the overhead version.'],
      ['JM press', 'barbell', 'A heavy, loadable triceps movement — the pattern is otherwise all light isolation.'],
      ['Bodyweight tricep extension (bar or table)', 'bodyweight', 'Bodyweight users have two options, both of which are pressing patterns rather than elbow extension.'],
    ],
  },
  biceps: {
    add: [
      ['Inverted row (supinated, curl grip)', 'bodyweight', 'Bodyweight biceps has one entry — a self-resisted towel curl, which cannot be progressed or measured.'],
      ['Concentration curl', 'dumbbells', 'Fully braced, no swing possible.'],
      ['Spider curl', 'dumbbells', 'Loads the shortened position, which nothing else in the pattern does.'],
    ],
    note: 'Already the deepest arm pattern at 14. Only the bodyweight gap is a real problem.',
  },
  forearms: {
    add: [
      ['Dead hang', 'pullup_bar', 'Closes the bodyweight zero and is the most direct grip-endurance work there is.'],
      ['Band wrist curl', 'bands', 'Closes the band zero.'],
      ['Plate pinch carry', 'machines', 'Trains pinch grip, which no current entry touches.'],
    ],
  },

  core: {
    add: [
      ['Reverse crunch', 'bodyweight', 'No lower-ab flexion movement exists in the library at all.'],
      ['Pallof press', 'cables', 'No anti-rotation work exists either — a whole trained direction is missing.'],
      ['Dead bug', 'bodyweight', 'Anti-extension that a complete beginner can actually perform, unlike the ab wheel.'],
      ['Hollow body hold', 'bodyweight', 'Progressable isometric; the plank is the only current hold and it caps out fast.'],
      ['Weighted decline sit-up', 'bodyweight', 'The only loadable spinal flexion option other than the cable crunch.'],
      ['Cable woodchop', 'cables', 'Rotational work, also entirely absent.'],
      ['Suitcase carry', 'dumbbells', 'Loaded anti-lateral-flexion; the dumbbell side bend is the only current entry and it trains the opposite.'],
    ],
    note: 'Depth of 5 in a full gym hides the real problem — the pattern covers only flexion and one isometric. Anti-rotation, anti-extension, rotation and lower-ab flexion are all missing.',
  },
};

// ─── Build ───────────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SETNAMES = Object.keys(SETS);

const data = {};
for (const [key, pat] of Object.entries(MOVEMENT_PATTERNS)) {
  const depth = {};
  for (const [n, eq] of Object.entries(SETS)) depth[n] = getAllExercisesForPattern(key, eq).length;
  data[key] = { label: pat.label || key, depth, ex: pat.exercises };
}

const tier = n => (n === 0 ? 'crit' : n < 4 ? 'thin' : 'ok');
const totalNow = Object.values(data).reduce((n, p) => n + p.ex.length, 0);
const totalAdd = Object.values(PROPOSED).reduce((n, p) => n + p.add.length, 0);
const critCount = Object.values(data).reduce((n, p) => n + SETNAMES.filter(s => p.depth[s] === 0).length, 0);

// Depth matrix, worst-first so the problems are at the top.
const matrixRows = Object.entries(data)
  .sort((a, b) => (a[1].depth['Full gym'] - b[1].depth['Full gym']) || a[0].localeCompare(b[0]))
  .map(([key, p]) => {
    const adds = (PROPOSED[key]?.add || []).length;
    return `<tr>
      <th scope="row"><code>${esc(key)}</code></th>
      <td class="n">${p.ex.length}</td>
      ${SETNAMES.map(s => `<td class="n ${tier(p.depth[s])}">${p.depth[s] === 0 ? '0' : p.depth[s]}</td>`).join('')}
      <td class="n add">${adds ? '+' + adds : '&middot;'}</td>
    </tr>`;
  }).join('\n');

const groupSections = GROUPS.map(([groupName, keys]) => {
  const cards = keys.map(key => {
    const p = data[key];
    const prop = PROPOSED[key] || { add: [] };
    const chips = SETNAMES.map(s =>
      `<span class="chip ${tier(p.depth[s])}"><span class="chip-k">${esc(s)}</span><span class="chip-v">${p.depth[s]}</span></span>`
    ).join('');

    const have = p.ex.map(e => `<li${e.primary_alternative ? ' class="pri"' : ''}>
        <span class="ex">${esc(e.name)}</span>
        <span class="eq">${esc((e.equipment || []).join(' · '))}</span>
      </li>`).join('\n');

    const add = prop.add.length
      ? `<ol class="addlist">${prop.add.map(([n, eq, why], i) => `<li>
            <div class="addhead"><span class="ex">${esc(n)}</span><span class="eq">${esc(eq)}</span></div>
            <p class="why">${esc(why)}</p>
          </li>`).join('\n')}</ol>`
      : `<p class="none">No additions proposed.</p>`;

    return `<article class="card" id="${esc(key)}">
      <header class="cardhead">
        <h3><code>${esc(key)}</code></h3>
        <div class="chips">${chips}</div>
      </header>
      ${prop.note ? `<p class="note">${esc(prop.note)}</p>` : ''}
      <div class="cols">
        <section class="col">
          <h4>Current <span class="count">${p.ex.length}</span></h4>
          <ul class="havelist">${have}</ul>
          <p class="legend">★ marks a primary pick — chosen first for its equipment type.</p>
        </section>
        <section class="col">
          <h4 class="addh">Proposed <span class="count add">${prop.add.length ? '+' + prop.add.length : '0'}</span></h4>
          ${add}
        </section>
      </div>
    </article>`;
  }).join('\n');

  const groupAdds = keys.reduce((n, k) => n + (PROPOSED[k]?.add || []).length, 0);
  return `<section class="group">
    <h2 id="g-${esc(groupName.toLowerCase())}">${esc(groupName)} <span class="gcount">${groupAdds ? '+' + groupAdds : 'no changes'}</span></h2>
    ${cards}
  </section>`;
}).join('\n');

const html = `<title>Exercise pool review — Helix</title>
<style>
:root{
  --paper:#f5f5f2; --sunk:#ecebe6; --card:#fffffe; --ink:#191a17; --ink-2:#4c4f49;
  --ink-3:#7c807a; --rule:#dcdbd4; --rule-2:#c9c8bf;
  --crit:#9c3a24; --crit-bg:#f3e2dc; --thin:#8a6510; --thin-bg:#f2eada;
  --ok:#4c5c4a; --ok-bg:#e6ebe3; --add:#1f4f57; --add-bg:#dfeaeb;
}
@media (prefers-color-scheme:dark){
  :root{
    --paper:#15161a; --sunk:#101115; --card:#1c1e23; --ink:#e8e8e4; --ink-2:#a7a9a4;
    --ink-3:#787b78; --rule:#2c2f35; --rule-2:#3b3f46;
    --crit:#e08a70; --crit-bg:#3a231c; --thin:#d6ad5c; --thin-bg:#33291642;
    --ok:#9fb39a; --ok-bg:#22271f; --add:#7fc0c9; --add-bg:#152a2e;
  }
}
:root[data-theme="light"]{
  --paper:#f5f5f2; --sunk:#ecebe6; --card:#fffffe; --ink:#191a17; --ink-2:#4c4f49;
  --ink-3:#7c807a; --rule:#dcdbd4; --rule-2:#c9c8bf;
  --crit:#9c3a24; --crit-bg:#f3e2dc; --thin:#8a6510; --thin-bg:#f2eada;
  --ok:#4c5c4a; --ok-bg:#e6ebe3; --add:#1f4f57; --add-bg:#dfeaeb;
}
:root[data-theme="dark"]{
  --paper:#15161a; --sunk:#101115; --card:#1c1e23; --ink:#e8e8e4; --ink-2:#a7a9a4;
  --ink-3:#787b78; --rule:#2c2f35; --rule-2:#3b3f46;
  --crit:#e08a70; --crit-bg:#3a231c; --thin:#d6ad5c; --thin-bg:#332916;
  --ok:#9fb39a; --ok-bg:#22271f; --add:#7fc0c9; --add-bg:#152a2e;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
}
code{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace; font-size:.92em}
.wrap{max-width:1080px; margin:0 auto; padding:0 24px 96px}

header.top{border-bottom:2px solid var(--ink); padding:56px 0 22px; margin-bottom:28px}
h1{font-size:clamp(28px,4.4vw,42px); line-height:1.08; margin:0 0 10px; letter-spacing:-.022em; text-wrap:balance}
.sub{margin:0; color:var(--ink-2); max-width:62ch}
.stats{display:flex; flex-wrap:wrap; gap:0; margin-top:26px; border:1px solid var(--rule); background:var(--card)}
.stat{flex:1 1 150px; padding:13px 16px; border-right:1px solid var(--rule)}
.stat:last-child{border-right:0}
.stat b{display:block; font-size:24px; letter-spacing:-.02em; font-variant-numeric:tabular-nums}
.stat span{font-size:11px; text-transform:uppercase; letter-spacing:.085em; color:var(--ink-3)}

h2{font-size:12px; text-transform:uppercase; letter-spacing:.14em; color:var(--ink-3);
   margin:52px 0 16px; padding-bottom:7px; border-bottom:1px solid var(--rule-2);
   display:flex; justify-content:space-between; align-items:baseline}
.gcount{color:var(--add); letter-spacing:.04em; font-variant-numeric:tabular-nums}

.scroll{overflow-x:auto; border:1px solid var(--rule); background:var(--card)}
table{border-collapse:collapse; width:100%; min-width:660px; font-size:13px}
thead th{
  text-align:right; padding:9px 10px; font-size:10px; text-transform:uppercase;
  letter-spacing:.075em; color:var(--ink-3); border-bottom:1px solid var(--rule-2); font-weight:600;
  position:sticky; top:0; background:var(--card)
}
thead th:first-child{text-align:left}
tbody th{text-align:left; font-weight:400; padding:6px 10px; border-bottom:1px solid var(--rule); white-space:nowrap}
td.n{text-align:right; padding:6px 10px; border-bottom:1px solid var(--rule); font-variant-numeric:tabular-nums}
td.crit{color:var(--crit); background:var(--crit-bg); font-weight:700}
td.thin{color:var(--thin); background:var(--thin-bg)}
td.ok{color:var(--ink-2)}
td.add{color:var(--add); font-weight:600}

.card{background:var(--card); border:1px solid var(--rule); margin-bottom:14px}
.cardhead{display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; justify-content:space-between;
  padding:13px 16px; border-bottom:1px solid var(--rule); background:var(--sunk)}
.cardhead h3{margin:0; font-size:15px; font-weight:600; letter-spacing:-.01em}
.chips{display:flex; flex-wrap:wrap; gap:5px}
.chip{display:inline-flex; align-items:center; gap:6px; padding:2px 7px; border:1px solid var(--rule-2);
  font-size:10.5px; border-radius:2px}
.chip-k{color:var(--ink-3); text-transform:uppercase; letter-spacing:.055em}
.chip-v{font-variant-numeric:tabular-nums; font-weight:700}
.chip.crit{border-color:var(--crit); background:var(--crit-bg)} .chip.crit .chip-v{color:var(--crit)}
.chip.thin{border-color:var(--thin); background:var(--thin-bg)} .chip.thin .chip-v{color:var(--thin)}
.chip.ok .chip-v{color:var(--ok)}

.note{margin:0; padding:11px 16px; background:var(--thin-bg); border-bottom:1px solid var(--rule);
  color:var(--ink-2); font-size:13.5px; border-left:3px solid var(--thin)}

.cols{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)}
@media (max-width:760px){.cols{grid-template-columns:1fr}}
.col{padding:14px 16px 16px; min-width:0}
.col+.col{border-left:1px solid var(--rule)}
@media (max-width:760px){.col+.col{border-left:0; border-top:1px solid var(--rule)}}
h4{margin:0 0 10px; font-size:10.5px; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-3);
   display:flex; gap:8px; align-items:center}
h4.addh{color:var(--add)}
.count{font-variant-numeric:tabular-nums; letter-spacing:0; color:var(--ink-2)}
.count.add{color:var(--add); font-weight:700}

ul.havelist{list-style:none; margin:0; padding:0}
ul.havelist li{display:flex; gap:10px; justify-content:space-between; align-items:baseline;
  padding:4px 0; border-bottom:1px dotted var(--rule)}
ul.havelist li:last-child{border-bottom:0}
ul.havelist li.pri .ex::before{content:"★ "; color:var(--ink-3)}
.ex{min-width:0}
.eq{color:var(--ink-3); font-size:11px; font-family:ui-monospace,Menlo,Consolas,monospace;
  white-space:nowrap; text-align:right}
.legend{margin:10px 0 0; font-size:11px; color:var(--ink-3)}

ol.addlist{list-style:none; counter-reset:a; margin:0; padding:0}
ol.addlist li{counter-increment:a; padding:8px 0 9px 26px; position:relative; border-bottom:1px solid var(--rule)}
ol.addlist li:last-child{border-bottom:0}
ol.addlist li::before{content:"+"; position:absolute; left:0; top:8px; width:17px; height:17px;
  display:grid; place-items:center; background:var(--add-bg); color:var(--add);
  font-weight:700; font-size:12px; border-radius:2px}
.addhead{display:flex; gap:10px; justify-content:space-between; align-items:baseline}
.why{margin:3px 0 0; font-size:13px; color:var(--ink-2)}
.none{margin:0; color:var(--ink-3); font-size:13px; font-style:italic}
footer{margin-top:56px; padding-top:16px; border-top:1px solid var(--rule); color:var(--ink-3); font-size:12px}
</style>

<div class="wrap">
<header class="top">
  <h1>Exercise pool review</h1>
  <p class="sub">Every movement pattern in the library, how many options it actually offers per equipment set,
  and what is proposed to fill the gaps. The current side is read from <code>movementLibrary.js</code>;
  the proposed side is a recommendation only — nothing has been written.</p>
  <div class="stats">
    <div class="stat"><b>${totalNow}</b><span>exercises now</span></div>
    <div class="stat"><b>+${totalAdd}</b><span>proposed</span></div>
    <div class="stat"><b>${Object.keys(data).length}</b><span>patterns</span></div>
    <div class="stat"><b>${critCount}</b><span>hard zeros</span></div>
  </div>
</header>

<h2>Depth matrix <span class="gcount">worst first</span></h2>
<div class="scroll">
<table>
  <thead><tr>
    <th>pattern</th><th>all</th>
    ${SETNAMES.map(s => `<th>${esc(s)}</th>`).join('')}
    <th>add</th>
  </tr></thead>
  <tbody>${matrixRows}</tbody>
</table>
</div>
<p class="legend">Red is zero options. Amber is fewer than four — below four the coach cannot offer three
alternatives when you tap “Change this”, and block rotation repeats too tightly.
“All” counts every entry; the equipment columns count what is reachable, since gym users have
bodyweight-only entries filtered out.</p>

${groupSections}

<footer>Generated from movementLibrary.js by scripts/poolReview.mjs. Review artifact — no library changes applied.</footer>
</div>`;

const out = process.argv[2] || 'pool-review.html';
fs.writeFileSync(out, html);
console.log(`${out}\n${totalNow} current, +${totalAdd} proposed, ${critCount} hard zeros`);
