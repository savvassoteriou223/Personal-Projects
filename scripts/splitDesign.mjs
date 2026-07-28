/**
 * splitDesign.mjs — designs all 10 splits and verifies them BEFORE any of it is
 * coded, using the app's own muscle attribution and its own volume targets.
 *
 * Two things make this different from a hand-written tally:
 *
 *  1. Attribution comes from MOVEMENT_PATTERNS, exactly as computeHeadVolume()
 *     reads it: a set credits DIRECT to muscles[0] only. That matters, because
 *     the app judges a muscle on direct volume alone. Squats therefore give
 *     glutes nothing, upper_traps (shrugs) count toward BACK, and an overhead
 *     press credits front delts — which have no target at all.
 *
 *  2. Targets are the intersection of the app's VOLUME_TARGETS and the user's
 *     own stated ranges. Both must hold: the user's rules are the brief, and
 *     VOLUME_TARGETS is what the app actually renders, so designing to only one
 *     of them would ship a program the app then paints red.
 */
import { MOVEMENT_PATTERNS } from '../screens/movementLibrary.js';
import { muscleToHead } from '../screens/volumeEngine.js';
import { getVolumeTargets } from '../screens/programGenerator.js';

// slot key → [pattern, preferred exercise id or null, display name, load?]
// `load` filters the exercise pool by load_position to guarantee a muscle HEAD.
const SLOT = {
  squat:    ['squat_pattern', null, 'Squat'],
  legpress: ['squat_pattern', 'leg_press', 'Leg press'],
  hinge:    ['hip_hinge', 'romanian_deadlift', 'RDL'],
  deadlift: ['hip_hinge', 'conventional_deadlift', 'Deadlift'],
  // glute_focused is the ONLY pattern that credits glutes directly. The walking
  // lunge lives here and is a compound, which is what lets men reach glute range
  // with no glute isolation at all (user rules 3 and 4).
  lunge:    ['glute_focused', 'walking_lunge', 'Walking lunge'],
  // Second glute slot. Women get true isolation (hip abduction); men get the
  // cable pull-through, a hip-hinge COMPOUND — so men still take no dedicated
  // glute isolation.
  glute2M:  ['glute_focused', 'cable_pull_through', 'Cable pull-through'],
  glute2F:  ['glute_focused', 'hip_abduction_machine', 'Hip abduction'],
  quadIso:  ['quad_isolation', null, 'Leg extension'],
  hamIso:   ['hamstring_isolation', null, 'Leg curl'],
  calves:   ['calves', null, 'Calf raise'],
  core:     ['core', null, 'Abs'],
  benchFlat:['chest_horizontal_push', null, 'Bench press'],
  benchInc: ['chest_incline_push', null, 'Incline press'],
  // Lower chest. The pattern has six exercises and the old tables used none of
  // them, so no program trained the sternal head at all.
  benchDec: ['chest_decline', null, 'Decline press / dip'],
  chestIso: ['chest_isolation', null, 'Chest fly'],
  latIso:   ['back_isolation', null, 'Lat pullover'],
  ohp:      ['shoulders_vertical_push', null, 'Overhead press'],
  rowH:     ['back_horizontal_pull', null, 'Row'],
  pullV:    ['back_vertical_pull', null, 'Pull-up / pulldown'],
  rowInner: ['back_inner', null, 'Close-grip row'],
  traps:    ['upper_traps', null, 'Shrug'],
  sideDelt: ['shoulders_side_delt', null, 'Lateral raise'],
  rearDelt: ['rear_delt', null, 'Rear delt'],
  // Arms are split by HEAD, not by exercise. `load` filters the pool by where the
  // load sits, which is what distinguishes the heads, while leaving block
  // rotation free to vary the movement inside that head.
  bicepsLong: ['biceps', null, 'Curl (long head)', 'stretch'],
  bicepsShort:['biceps', null, 'Curl (short head)', 'contracted'],
  tricepsLong:['triceps', null, 'Triceps (long head)', 'stretch'],
  tricepsLat: ['triceps', null, 'Triceps (lateral)', 'contracted'],
  // Calves have no load_position, and a bent knee slackens the gastrocnemius so
  // the soleus does the work — seated and standing are not interchangeable.
  calvesSeat: ['calves', 'seated_calf_raise', 'Seated calf raise'],
};

// head → display group, mirroring volumeEngine's MUSCLE_GROUPS rollup.
const GROUP_OF = { chest:'chest', upper_chest:'chest', lower_chest:'chest',
  lats:'back', traps:'back', lower_back:'back', side_delts:'side_delts',
  rear_delts:'rear_delts', biceps:'biceps', triceps:'triceps', quads:'quads',
  hamstrings:'hamstrings', glutes:'glutes', calves:'calves', abs:'abs' };

// Direct-credit group for a slot — muscles[0], the same one computeHeadVolume
// credits. front_delts and forearms map nowhere: they have no target.
const directGroup = key => {
  const m = MOVEMENT_PATTERNS[SLOT[key][0]].muscles[0];
  return GROUP_OF[muscleToHead(m)] || null;
};

// The user's own non-negotiable ranges (memory: split-design-rules).
const USER = { quads:[12,16], chest:[12,16], back:[12,16], hamstrings:[10,16],
  calves:[10,16], side_delts:[10,16], rear_delts:[8,12], biceps:[8,12],
  triceps:[8,12], abs:[8,12] };
const USER_GLUTES = f => f ? [12,16] : [8,12];

// Intersect with what the app will actually judge against, so a passing design
// also renders green. Low-frequency splits drop to the app's MEV floor, which
// the user's own rules permit — full optimal is unreachable at 2–3 days.
function ranges(tier, f, mev) {
  const app = getVolumeTargets(tier);
  const out = {};
  // The user's ranges are the INTERMEDIATE spec — that is the tier the splits
  // are designed at, and the tier the experience factor scales away from. Held
  // against a beginner they would demand 12 quad sets from someone the research
  // puts at 6-10, which is the very thing the 0.8 factor exists to prevent. So
  // beginner and advanced are judged on the app's own tier targets.
  const strict = tier === 'intermediate' && !mev;
  const both = (k, [ulo, uhi]) => {
    const a = app[k]; if (!a) return;
    out[k] = strict
      ? [Math.max(ulo, a.min), Math.min(uhi, a.optimal_high)]
      : [a.min, a.optimal_high];
  };
  for (const [k, r] of Object.entries(USER)) both(k, r);
  both('glutes', USER_GLUTES(f));
  return out;
}

const G2 = f => (f ? 'glute2F' : 'glute2M');

const SPLITS = {
// Two sessions cannot carry eighteen muscle heads AND MEV volume — 9 slots x 2
// is 18 slots for 18 heads with nothing left for a second slot on anything. This
// split is judged on the movers and on reduced head coverage; the arms get one
// head each rather than two.
'Full Body 2x': { only:['quads','chest','back','hamstrings','glutes','calves'], mev:true, heads:'reduced', days:f=>[
  ['Full Body A',[['squat',5],['benchFlat',5],['rowH',5],['rowInner',4],['sideDelt',5],['tricepsLong',4],['calves',5],['lunge',5],['hinge',4]]],
  ['Full Body B',[['legpress',5],['deadlift',5],['benchInc',5],['pullV',5],['ohp',3],['rearDelt',4],['bicepsLong',4],['calvesSeat',5],[G2(f),5]]]]},

'Full Body 3x': { mev:true, days:f=>[
  ['Full Body A',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['rearDelt',4],['tricepsLong',3],['bicepsLong',4],['calves',5],['core',3]]],
  ['Full Body B',[['hinge',4],['benchInc',4],['pullV',4],['rearDelt',3],['lunge',4],['quadIso',4],['calvesSeat',4],['core',3]]],
  ['Full Body C',[['legpress',4],['benchDec',4],['rowInner',4],['sideDelt',5],['ohp',3],['tricepsLat',3],['bicepsShort',3],[G2(f),4],['hamIso',4]]]]},

'Full Body / Upper / Lower 3x': { mev:true, heads:'reduced', days:f=>[
  ['Full Body',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['rearDelt',4],['tricepsLong',3],['bicepsLong',4],['calves',4],['core',3]]],
  ['Upper',[['benchInc',4],['benchDec',4],['pullV',4],['rowInner',4],['sideDelt',5],['ohp',3],['rearDelt',4],['bicepsLong',3],['tricepsLat',3]]],
  ['Lower',[['legpress',4],['deadlift',4],['lunge',4],[G2(f),4],['quadIso',4],['hamIso',4],['calvesSeat',4],['core',3]]]]},

'Upper / Lower 4x': { days:f=>[
  ['Upper A',[['benchFlat',4],['rowH',4],['ohp',3],['sideDelt',5],['rearDelt',4],['tricepsLong',4],['bicepsLong',4]]],
  ['Lower A',[['squat',4],['hinge',4],['lunge',4],['quadIso',4],['calves',5],['core',4]]],
  ['Upper B',[['benchInc',4],['benchDec',4],['pullV',4],['rowInner',4],['sideDelt',5],['rearDelt',4],['tricepsLat',4],['bicepsShort',4]]],
  ['Lower B',[['legpress',4],['deadlift',4],['lunge',4],[G2(f),4],['hamIso',4],['calvesSeat',5],['core',4]]]]},

'Chest+Tri / Back+Bi / Shoulders / Legs': { days:f=>[
  ['Chest + Triceps',[['benchFlat',4],['benchInc',4],['benchDec',4],['chestIso',4],['tricepsLong',4],['tricepsLat',4],['core',5]]],
  ['Back + Biceps',[['pullV',4],['rowH',4],['rowInner',4],['latIso',3],['bicepsLong',4],['bicepsShort',4],['core',5]]],
  ['Shoulders',[['ohp',3],['sideDelt',5],['sideDelt',5],['rearDelt',4],['rearDelt',4],['calves',5],['calvesSeat',5]]],
  ['Legs',[['squat',4],['hinge',5],['legpress',4],['lunge',f?6:4],[G2(f),f?6:4],['quadIso',4],['hamIso',5]]]]},

'Full Body 4x': { days:f=>[
  ['Full Body A',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['tricepsLong',4],['calves',5],['core',4]]],
  ['Full Body B',[['hinge',4],['benchInc',4],['pullV',4],['rearDelt',4],['bicepsLong',4],['lunge',f?6:4],['core',4]]],
  ['Full Body C',[['legpress',4],['benchDec',4],['rowInner',4],['sideDelt',5],['tricepsLat',4],['calvesSeat',5],['core',4]]],
  ['Full Body D',[['deadlift',4],[G2(f),f?6:4],['quadIso',4],['ohp',3],['rearDelt',4],['bicepsShort',4],['hamIso',4]]]]},

'PPL / Upper / Lower 5x': { days:f=>[
  ['Push',[['benchFlat',4],['benchInc',4],['ohp',3],['sideDelt',5],['tricepsLong',4],['tricepsLat',4]]],
  ['Pull',[['pullV',4],['rowH',4],['rearDelt',4],['bicepsLong',4],['traps',3],['core',4]]],
  ['Legs',[['squat',4],['hinge',4],['lunge',f?6:4],['quadIso',4],['calves',5],['core',4]]],
  ['Upper',[['benchDec',4],['chestIso',4],['rowInner',4],['sideDelt',5],['rearDelt',4],['bicepsShort',4]]],
  ['Lower',[['legpress',4],['deadlift',4],[G2(f),f?6:4],['hamIso',4],['calvesSeat',5],['core',2]]]]},

'Full Body 5x': { days:f=>[
  ['Full Body A',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['tricepsLong',4],['calves',5]]],
  ['Full Body B',[['hinge',4],['benchInc',4],['pullV',4],['rearDelt',4],['bicepsLong',4],['core',4]]],
  ['Full Body C',[['legpress',4],['benchDec',4],['rowInner',4],['sideDelt',5],['calvesSeat',5],['core',4]]],
  ['Full Body D',[['deadlift',4],['lunge',f?6:4],['ohp',3],['rearDelt',4],['tricepsLat',4],['core',4]]],
  ['Full Body E',[['quadIso',4],['hamIso',4],[G2(f),f?6:4],['latIso',3],['bicepsShort',4],['calves',5]]]]},

'Push / Pull / Legs 6x': { days:f=>[
  ['Push A',[['benchFlat',4],['ohp',3],['chestIso',4],['sideDelt',5],['tricepsLong',4],['tricepsLat',4]]],
  ['Pull A',[['pullV',4],['rowH',4],['rearDelt',4],['bicepsLong',4],['traps',3],['core',3]]],
  ['Legs A',[['squat',4],['hinge',4],['lunge',f?6:4],['quadIso',4],['calves',5]]],
  ['Push B',[['benchInc',4],['benchDec',4],['ohp',3],['sideDelt',5],['tricepsLat',4],['core',3]]],
  ['Pull B',[['rowInner',4],['latIso',3],['rearDelt',4],['bicepsShort',4],['core',3]]],
  ['Legs B',[['legpress',4],['deadlift',4],[G2(f),f?6:4],['hamIso',4],['calvesSeat',5],['core',3]]]]},

'Upper / Lower 6x': { days:f=>[
  ['Upper A',[['benchFlat',4],['ohp',3],['rowH',4],['sideDelt',5],['tricepsLong',4],['bicepsLong',4]]],
  ['Lower A',[['squat',4],['hinge',4],['lunge',f?6:4],['quadIso',4],['calves',5],['core',4]]],
  ['Upper B',[['benchInc',4],['pullV',4],['rearDelt',4],['bicepsShort',4],['tricepsLat',4],['core',3]]],
  ['Lower B',[['legpress',4],['deadlift',4],['hamIso',4],['calvesSeat',5],['core',3]]],
  ['Upper C',[['benchDec',4],['rowInner',4],['latIso',3],['sideDelt',5],['rearDelt',4],['tricepsLong',4]]],
  ['Lower C',[[G2(f),f?6:4],['lunge',f?6:4],['quadIso',4],['hamIso',4],['calves',5],['core',3]]]]},
};


// ── set allocation ───────────────────────────────────────────────────────────
// Set counts are DERIVED, not authored. For each tier and sex we take the
// muscle's target window, aim at its midpoint, and spread that budget evenly
// across however many slots the split gives that muscle. This replaces a flat
// 0.8/1.2 experience multiplier, which could never work: a single factor has to
// track eleven muscles whose ranges scale differently between tiers (back goes
// 8-10 -> 10-20 -> 14-24, quads 6-10 -> 10-15 -> 12-20), so any one factor
// overshot some muscles while undershooting others.
//
// Slots with no volume target -- overhead press (front delts), forearms -- are
// not budgeted and keep a fixed count.
const UNTARGETED_SETS = 3;

function allocate(cfg, f, tier) {
  const R = ranges(tier, f, cfg.mev);
  const days = cfg.days(f);

  // how many slots each muscle gets across the week
  const slotsFor = {};
  for (const [, slots] of days)
    for (const [k] of slots) {
      const g = directGroup(k);
      if (g) (slotsFor[g] = slotsFor[g] || []).push(k);
    }

  // Even split of the muscle's budget across its slots. Two constraints:
  //
  //  • Aim at the FLOOR of the window, not the midpoint. The midpoint sounds
  //    fairer but it is wrong per-exercise: an advanced lifter's side-delt
  //    window tops out at 16, and in a split with one side-delt slot that
  //    becomes 16 sets of lateral raises in a single session. Starting at the
  //    floor is also what block periodisation wants, since it progresses volume
  //    upward over the block rather than opening at the ceiling.
  //
  //  • Clamp any one slot to SET_MIN..SET_MAX. Nobody runs 2-set or 13-set
  //    exercises; a budget that cannot fit is capped, and the caller's range
  //    check then reports it rather than silently emitting an absurd program.
  const SET_MIN = 2, SET_MAX = 6;
  const perMuscle = {};
  for (const [g, ks] of Object.entries(slotsFor)) {
    const [lo, hi] = R[g] || [ks.length * 3, ks.length * 4];
    const budget = Math.max(lo, Math.min(hi, ks.length * SET_MIN));
    const base = Math.floor(budget / ks.length);
    let rem = budget - base * ks.length;
    perMuscle[g] = ks.map(() => {
      const n = base + (rem-- > 0 ? 1 : 0);
      return Math.max(SET_MIN, Math.min(SET_MAX, n));
    });
  }

  const cursor = {};
  return days.map(([name, slots]) => [name, slots.map(([k]) => {
    const g = directGroup(k);
    if (!g) return [k, UNTARGETED_SETS];
    const i = (cursor[g] = (cursor[g] || 0));
    cursor[g] = i + 1;
    return [k, perMuscle[g][i]];
  })]);
}

// ── verify ───────────────────────────────────────────────────────────────────
// Same role twice in a day is the redundancy the user reported (two lateral
// raises, face pull + Y-raise). Two slots may share a PATTERN only when they
// play different roles — squat + leg press, walking lunge + hip abduction — and
// a day dedicated to a muscle may run two variations of it.
const DEDICATED = { shoulders_side_delt:/shoulder/i, rear_delt:/shoulder/i,
  triceps:/tricep/i, biceps:/bicep/i };

// Mirrors be(): the experience factor scales every slot and rounds per-slot, so
// it has to be modelled here rather than applied to the weekly total.
const LEVEL_VOLUME_FACTOR = { beginner: 0.8, intermediate: 1.0, advanced: 1.2 };

function check(cfg, f, tier) {
  const R = ranges(tier, f, cfg.mev), vol = {}, bad = [], sizes = [];
  const days = allocate(cfg, f, tier);
  for (const [dname, slots] of days) {
    sizes.push(slots.length);
    const seen = {};
    for (const [k, sets] of slots) {
      const g = directGroup(k);
      if (g) vol[g] = (vol[g] || 0) + sets;
      if (sets < 2) bad.push(`${k} only ${sets} sets on ${dname}`);
      const pat = SLOT[k][0];
      if (seen[pat] === k && !DEDICATED[pat]?.test(dname)) bad.push(`dup ${k} on ${dname}`);
      seen[pat] = k;
    }
  }
  for (const [k, [lo, hi]] of Object.entries(R)) {
    if (cfg.only && !cfg.only.includes(k)) continue;
    const v = vol[k] || 0;
    if (v < lo) bad.push(`${k} ${v}<${lo}`); else if (v > hi) bad.push(`${k} ${v}>${hi}`);
  }
  if (sizes.some(s => s < 5 || s > 9)) bad.push(`sessions ${sizes.join('/')}`);
  return { bad, vol, R, days };
}

let pass = 0; const fails = [];
for (const [name, cfg] of Object.entries(SPLITS))
  for (const tier of ['beginner', 'intermediate', 'advanced'])
    for (const sex of ['male', 'female']) {
      const { bad } = check(cfg, sex === 'female', tier);
      if (bad.length) fails.push(`${name} [${tier}/${sex}] ${bad.join('  ')}`); else pass++;
    }
console.log(`${pass} pass / ${fails.length} fail  (10 splits x 3 tiers x 2 sexes)\n`);
fails.forEach(x => console.log('  X', x));

if (process.argv[2] === 'print') {
  const only = process.argv[3];
  for (const [name, cfg] of Object.entries(SPLITS)) {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;
    console.log('\n' + '='.repeat(70) + '\n' + name.toUpperCase());
    for (const sex of ['male', 'female']) {
      const f = sex === 'female';
      const { vol, R } = check(cfg, f, 'intermediate');
      console.log(`\n  --- ${sex.toUpperCase()} ---`);
      for (const [d, slots] of cfg.days(f))
        console.log(`  ${d}: ` + slots.map(([k, s]) => `${s}x ${SLOT[k][2]}`).join(', '));
      console.log('    ' + Object.entries(R)
        .filter(([k]) => !cfg.only || cfg.only.includes(k))
        .map(([k, [lo, hi]]) => `${k} ${vol[k] || 0}/${lo}-${hi}`).join('  '));
    }
  }
}

// ── emit the SPLIT_DAYS literal for programGenerator.js ──────────────────────
const SPLIT_ID = {
  'Full Body 2x': 'full_body_2x', 'Full Body 3x': 'full_body_3x',
  'Full Body / Upper / Lower 3x': 'hybrid_3x', 'Upper / Lower 4x': 'upper_lower_4x',
  'Chest+Tri / Back+Bi / Shoulders / Legs': 'chest_back_shoulders_legs_4x',
  'Full Body 4x': 'full_body_4x', 'PPL / Upper / Lower 5x': 'ul_ppl_hybrid_5x',
  'Full Body 5x': 'full_body_5x', 'Push / Pull / Legs 6x': 'ppl_6x',
  'Upper / Lower 6x': 'upper_lower_6x',
};
const FOCUS = {
  'Full Body A':'Squat · press · row', 'Full Body B':'Hinge · incline · pull',
  'Full Body C':'Leg press · fly · inner back', 'Full Body D':'Deadlift · glutes · shoulders',
  'Full Body E':'Isolation · weak points', 'Full Body':'Squat · press · row',
  'Upper A':'Heavy push + pull', 'Upper B':'Incline + arms', 'Upper C':'Isolation + delts',
  'Lower A':'Squat + glutes', 'Lower B':'Deadlift + quads', 'Lower C':'Glutes + hamstrings',
  'Upper':'Full upper body', 'Lower':'Full lower body',
  'Push':'Chest · shoulders · triceps', 'Pull':'Back · rear delts · biceps', 'Legs':'Full lower body',
  'Push A':'Flat press focus', 'Push B':'Incline focus', 'Pull A':'Vertical pull focus',
  'Pull B':'Horizontal pull focus', 'Legs A':'Squat focus', 'Legs B':'Posterior chain',
  'Chest + Triceps':'Chest · triceps', 'Back + Biceps':'Back · biceps', 'Shoulders':'Delts · calves',
};
const dayId = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const TIERS = ['beginner', 'intermediate', 'advanced'];

if (process.argv[2] === 'emit') {
  const out = [];
  for (const [name, cfg] of Object.entries(SPLITS)) {
    // allocated[tier][sex] -> [[dayName, [[slotKey, sets], ...]], ...]
    const A = {};
    for (const t of TIERS) A[t] = { m: allocate(cfg, false, t), f: allocate(cfg, true, t) };
    out.push(`  ${SPLIT_ID[name]}: f => [`);
    const dayCount = Math.max(A.intermediate.m.length, A.intermediate.f.length);
    for (let d = 0; d < dayCount; d++) {
      const dname = A.intermediate.m[d][0];
      const nSlots = Math.max(A.intermediate.m[d][1].length, A.intermediate.f[d][1].length);
      const parts = [];
      for (let i = 0; i < nSlots; i++) {
        const lit = sex => {
          const row = TIERS.map(t => A[t][sex][d][1][i]);
          if (row.some(r => !r)) return null;
          const k = row[0][0], [pat, pref, , load] = SLOT[k];
          const sets = row.map(r => r[1]);
          // 3rd element is a pinned exercise, 4th is the head filter; a slot that
          // needs only the head passes null so `load` lands in the right place.
          const tail = load ? `, ${pref ? `'${pref}'` : 'null'}, '${load}'`
                            : (pref ? `, '${pref}'` : '');
          return `['${pat}', [${sets.join(', ')}]${tail}]`;
        };
        const m = lit('m'), w = lit('f');
        if (!m) { parts.push(`...(f ? [${w}] : [])`); continue; }
        if (!w) { parts.push(`...(f ? [] : [${m}])`); continue; }
        parts.push(m === w ? m : `(f ? ${w} : ${m})`);
      }
      out.push(`    { id: '${dayId(dname)}', name: '${dname}', focus: '${FOCUS[dname] || dname}', slots: [`);
      out.push('      ' + parts.join(', '));
      out.push('    ] },');
    }
    out.push('  ],');
  }
  console.log(['const SPLIT_DAYS = {', ...out, '};'].join('\n'));
}
