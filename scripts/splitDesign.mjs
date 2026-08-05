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
  // Optional only. Pressing already supplies front delt volume, so this slot is
  // offered on a dedicated shoulder day and never forced onto a push day.
  frontDelt:['front_delt', null, 'Front raise'],
  // Arms are split by HEAD, not by exercise. `load` filters the pool by where the
  // load sits, which is what distinguishes the heads, while leaving block
  // rotation free to vary the movement inside that head.
  bicepsLong: ['biceps', null, 'Curl (long head)', 'stretch'],
  bicepsShort:['biceps', null, 'Curl (short head)', 'contracted'],
  tricepsLong:['triceps', null, 'Triceps (long head)', 'stretch'],
  tricepsLat: ['triceps', null, 'Triceps (lateral)', 'contracted'],
  // A third triceps slot pinned to dips. Two `contracted` slots in the same week
  // resolve to the same exercise — both pick the pool's first contracted pick —
  // so a 6-day split ran the identical cable pushdown on Push A and Push B.
  // Dips are a loadable compound, which the other two slots are not.
  tricepsDip: ['triceps', 'dips_tricep', 'Dips (tricep focus)'],
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
// Calves were [10,16]. The app's intermediate calf band is 6-10, so the
// intersection collapsed to [10,10] — floor equal to ceiling, pinning every
// non-mev split to the very top of the range while every other muscle sat
// around 30% into its band. 8 puts calves mid-band and leaves the ceiling free.
const USER = { quads:[12,16], chest:[12,16], back:[12,16], hamstrings:[10,16],
  calves:[8,12], side_delts:[10,16], rear_delts:[8,12], biceps:[8,12],
  triceps:[8,12], abs:[8,12] };
const USER_GLUTES = f => f ? [12,16] : [8,12];

// Intersect with what the app will actually judge against, so a passing design
// also renders green. Low-frequency splits drop to the app's MEV floor, which
// the user's own rules permit — full optimal is unreachable at 2–3 days.
function ranges(tier, f, mev, floors) {
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
    // PROTOTYPE: floor was a.min. allocate() deliberately aims at the FLOOR of
    // this window, so a floor of `min` built every non-intermediate program to
    // exactly minimum effective volume — and the Today heat map grades against
    // optimal_low, so a freshly generated advanced program rendered amber on
    // six muscles before the user trained once. optimal_low is the bar the app
    // itself judges by, so it is the bar the solver should design to.
    out[k] = strict
      ? [Math.max(ulo, a.min), Math.min(uhi, a.optimal_high)]
      : [a.optimal_low, a.optimal_high];
  };
  for (const [k, r] of Object.entries(USER)) both(k, r);
  both('glutes', USER_GLUTES(f));
  // The glute sex tilt only ever applied on the strict path, so every beginner,
  // every advanced and every mev split judged men against the full glute floor
  // and reported them short. Men are not meant to be chasing direct glute
  // volume in this app — they take their glute stimulus from squats, lunges,
  // leg press and hinges, which credit quads and hamstrings. Apply the male
  // ceiling on every path, not just one.
  if (!f && out.glutes) out.glutes = [Math.min(out.glutes[0], USER_GLUTES(false)[0]), out.glutes[1]];
  // A split may pin one muscle's floor lower than the shared spec when its
  // structure demands it — concentrating three calf slots on two leg days, say.
  // Only ever lowers, never raises, and only the floor.
  if (floors) for (const [k, v] of Object.entries(floors))
    if (out[k]) out[k] = [Math.min(out[k][0], v), out[k][1]];

  // An advanced lifter must never be prescribed less than an intermediate one.
  // The two tiers are solved from DIFFERENT sources: intermediate from the USER
  // spec above (chest 12-16, quads 12-16, calves 10-16), advanced from the app's
  // tier targets. The reference table's advanced figure is the ENTRY POINT of a
  // wide band — chest 10-20, back 10-25 — and that entry point sits below the
  // intermediate spec. So advanced programs came out with fewer sets than
  // intermediate ones on chest, back, quads, hamstrings, calves and abs.
  // Clamping the advanced floor up to the intermediate floor keeps the two
  // sources but restores the ordering.
  if (tier === 'advanced') {
    const inter = ranges('intermediate', f, mev, floors);
    for (const k of Object.keys(out))
      if (inter[k]) out[k] = [Math.max(out[k][0], inter[k][0]), Math.max(out[k][1], inter[k][1])];
  }
  return out;
}

const G2 = f => (f ? 'glute2F' : 'glute2M');

const SPLITS = {
// Hard budget: 9 exercises per session (see the `sizes` check) x 2 days = 18
// slots. That is the whole design space, and it is why this split is the most
// compromised in the app.
//
// PROTOTYPE had `only:` masking abs, delts and arms out of the check entirely,
// which hid a real defect: abs had NO slot on either day, so every 2-day
// program shipped 0 ab sets at every tier while the check reported clean.
// The mask is gone — every muscle is judged now.
//
// The 18 are spent as: 2 slots each on quads, chest, back, hamstrings and
// glutes = 10; 2 on side delts; then one each on calves, rear delts, biceps,
// triceps, abs and the overhead press = 6.
//
// Two slots had to be found. Abs took the third back slot (rowInner): back
// keeps 2x frequency through rowH and pullV, and 2 slots x SET_MAX 6 still
// clears the intermediate target of 10, whereas abs had literally nothing.
// Side delts took the second calf slot, because one slot caps a muscle at 6
// sets and the intermediate side-delt floor is 8 — unreachable on one slot at
// any weighting. Calves drop to a single slot, which still meets their
// intermediate floor of 6 exactly; the standing/seated distinction is lost to
// block rotation instead of being a dedicated slot.
//
// Advanced is NOT satisfiable here and no arrangement fixes it: the advanced
// floors sum to 124 sets/week, which needs 21 slots at SET_MAX 6 against a
// ceiling of 18. It is left failing deliberately rather than masked.
// Men trade the second glute slot (the cable pull-through) for a second calf
// slot — an explicit product decision. Their glute stimulus still arrives via
// squat, leg press, walking lunge, RDL and deadlift; what drops is the DIRECT
// credit, because computeHeadVolume only counts the glute_focused pattern.
// Women keep hip abduction and are unaffected.
'Full Body 2x': { mev:true, heads:'reduced', waive:{ glutes:(f)=>!f }, days:f=>[
  ['Full Body A',[['squat',5],['benchFlat',5],['rowH',5],['sideDelt',5],['tricepsLong',4],(f ? ['calves',5] : ['bicepsShort',4]),['lunge',5],['hinge',4],['core',3]]],
  ['Full Body B',[['legpress',5],['deadlift',5],['benchInc',5],['pullV',5],['ohp',3],['sideDelt',5],['rearDelt',4],['bicepsLong',4],(f ? ['glute2F',5] : ['calves',5])]]]},

'Full Body 3x': { mev:true, optShoulders:true, days:f=>[
  ['Full Body A',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['rearDelt',4],['tricepsLong',3],['bicepsLong',4],['calves',5],['core',3]]],
  ['Full Body B',[['hinge',4],['benchInc',4],['pullV',4],['rearDelt',3],['lunge',4],['quadIso',4],['calvesSeat',4],['core',3]]],
  ['Full Body C',[['legpress',4],['benchDec',4],['rowInner',4],['sideDelt',5],['ohp',3],['tricepsLat',3],['bicepsShort',3],[G2(f),4],['hamIso',4]]]]},

'Full Body / Upper / Lower 3x': { mev:true, optShoulders:true, heads:'reduced', days:f=>[
  ['Full Body',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['rearDelt',4],['tricepsLong',3],['bicepsLong',4],['calves',4],['core',3]]],
  ['Upper',[['benchInc',4],['benchDec',4],['pullV',4],['rowInner',4],['sideDelt',5],['ohp',3],['rearDelt',4],['bicepsLong',3],['tricepsLat',3]]],
  ['Lower',[['legpress',4],['deadlift',4],['lunge',4],[G2(f),4],['quadIso',4],['hamIso',4],['calvesSeat',4],['core',3]]]]},

// The most-requested 3-day split, and the only one in the app that trains each
// muscle once a week — hence freq1. Every other 3-day option hits each muscle
// three times, which is what the app's own Schoenfeld reference argues for, so
// this is ranked BELOW them rather than offered as the default. It earns its
// place because people search for it by name and because one hard session per
// muscle with a full week to recover suits some lifters better than spreading
// the same volume thin.
//
// Slot budget is tight: a whole week of one muscle in one session, capped at 9
// exercises and 6 sets per exercise. Chest takes three slots to reach 12 without
// any single exercise running to 6; abs need two slots (8 sets, 6 max each) so
// the second sits on Push.
// Leg floors dropped to the app's own targets. Once-a-week frequency puts every
// quad, hamstring and calf set on ONE day, and the USER spec (quads 12-16,
// hamstrings 10-16) pushed that day to 101 minutes. Only the leg muscles are
// lowered — push and pull days are comfortable and keep the full spec.
'Push / Pull / Legs 3x': { freq1:true, floors:{ quads:10, hamstrings:8, calves:6 }, waive:{ glutes:(f)=>!f }, days:f=>[
  ['Push',[['benchFlat',4],['benchInc',4],['chestIso',4],['ohp',3],['sideDelt',5],['sideDelt',5],['tricepsLong',4],['tricepsLat',4],['core',3]]],
  ['Pull',[['pullV',4],['rowH',4],['rowInner',4],['rearDelt',4],['rearDelt',4],['bicepsLong',4],['bicepsShort',4],['traps',3]]],
  ['Legs',[['squat',4],['legpress',4],['hinge',5],['hamIso',4],['lunge',f?6:4],[G2(f),f?6:4],['calves',4],['calvesSeat',3],['core',3]]]]},

'Upper / Lower 4x': { optShoulders:true, days:f=>[
  ['Upper A',[['benchFlat',4],['pullV',4],['rowH',4],['ohp',3],['sideDelt',5],['rearDelt',4],['tricepsLong',4],['bicepsLong',4]]],
  ['Lower A',[['squat',4],['hinge',4],['lunge',4],['quadIso',4],['calves',4],['calvesSeat',3],['core',4]]],
  ['Upper B',[['benchInc',4],['benchDec',4],['pullV',4],['rowInner',4],['sideDelt',5],['rearDelt',4],['tricepsLat',4],['bicepsShort',4]]],
  ['Lower B',[['legpress',4],['deadlift',4],['lunge',4],[G2(f),4],['hamIso',4],['calvesSeat',5],['core',4]]]]},

// Men keep one glute slot (the walking lunge) after the pull-through was traded
// for calf work, so direct glute credit caps at 6 against a male floor of 8.
// Same accepted trade as Full Body 2x — the stimulus arrives through squat, leg
// press, RDL and the lunge itself; only the DIRECT credit is short.
// mev: this split concentrates a whole muscle group into one session, so the
// strict USER floors (quads 12-16, calves 10-16, hamstrings 10-16) all landed
// on the SAME day — a 101-minute leg day for women. Judged on the app's own
// tier floors instead, which is what every other one-day-per-muscle split
// already does. Volume stays inside the optimal band; it just stops sitting
// above it on the day that can least afford the minutes.
'Chest+Tri / Back+Bi / Shoulders / Legs': { freq1:true, mev:true, waive:{ glutes:(f)=>!f }, days:f=>[
  ['Chest + Triceps',[['benchFlat',4],['benchInc',4],['benchDec',4],['chestIso',4],['tricepsLong',4],['tricepsLat',4],['core',5]]],
  ['Back + Biceps',[['pullV',4],['rowH',4],['rowInner',4],['latIso',3],['bicepsLong',4],['bicepsShort',4],['core',5]]],
  // Calves belong on the leg day, not tacked onto shoulders. They sat there
  // because Legs was already at seven slots, which left Shoulders carrying
  // 31-35 sets against 24 on chest and back. Moving them balances the week and
  // frees the men's second glute slot: the cable pull-through goes, since men
  // are not chasing direct glute volume here (see USER_GLUTES).
  ['Shoulders',[['ohp',3],['sideDelt',5],['sideDelt',5],['rearDelt',4],['rearDelt',4]]],
  ['Legs',[['squat',4],['hinge',5],['legpress',4],['lunge',f?6:4],...(f?[[G2(f),6]]:[]),['calves',5],['quadIso',4],['hamIso',5],['calvesSeat',5]]]]},

'Full Body 4x': { optShoulders:true, days:f=>[
  ['Full Body A',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['tricepsLong',4],['calves',5],['core',4]]],
  ['Full Body B',[['hinge',4],['benchInc',4],['pullV',4],['rearDelt',4],['bicepsLong',4],['lunge',f?6:4],['core',4]]],
  ['Full Body C',[['legpress',4],['benchDec',4],['rowInner',4],['sideDelt',5],['tricepsLat',4],['calvesSeat',5],['core',4]]],
  ['Full Body D',[['deadlift',4],[G2(f),f?6:4],['quadIso',4],['benchInc',4],['pullV',4],['ohp',3],['rearDelt',4],['bicepsShort',4],['hamIso',4]]]]},

// Three calf slots across two leg days pinned calves to 10 (the shared floor)
// while the shrug sat on the 2-set minimum. Floor dropped to 8 so those two sets
// move to traps, which FIXED_SETS now authors at 4.
'PPL / Upper / Lower 5x': { optShoulders:true, floors:{ calves:8 }, days:f=>[
  ['Push',[['benchFlat',4],['benchInc',4],['ohp',3],['sideDelt',5],['tricepsLong',4],['tricepsLat',4]]],
  // Shrugs were pinned at the two-set floor while calves ran to the top of their
  // band (10 of 6-10) across three separate slots. Two sets move from calves to
  // traps: calves stay in range at 8, and the shrug becomes a real slot rather
  // than a token one.
  ['Pull',[['pullV',4],['rowH',4],['rearDelt',4],['bicepsLong',4],['traps',6],['core',4]]],
  ['Legs',[['squat',4],['hinge',4],['lunge',f?6:4],['quadIso',4],['calves',3],['calvesSeat',2],['core',4]]],
  ['Upper',[['benchDec',4],['chestIso',4],['pullV',4],['rowInner',4],['sideDelt',5],['rearDelt',4],['tricepsLat',4],['bicepsShort',4]]],
  ['Lower',[['legpress',4],['deadlift',4],[G2(f),f?6:4],['hamIso',4],['calvesSeat',5],['core',2]]]]},

'Full Body 5x': { optShoulders:true, days:f=>[
  ['Full Body A',[['squat',4],['benchFlat',4],['rowH',4],['sideDelt',5],['tricepsLong',4],['calves',5]]],
  ['Full Body B',[['hinge',4],['benchInc',4],['pullV',4],['rearDelt',4],['bicepsLong',4],['core',4]]],
  ['Full Body C',[['legpress',4],['benchDec',4],['rowInner',4],['sideDelt',5],['calvesSeat',5],['core',4]]],
  ['Full Body D',[['deadlift',4],['lunge',f?6:4],['benchInc',4],['pullV',4],['ohp',3],['rearDelt',4],['tricepsLat',4],['core',4]]],
  ['Full Body E',[['quadIso',4],['hamIso',4],[G2(f),f?6:4],['ohp',3],['latIso',3],['bicepsShort',4],['calves',5]]]]},

'Push / Pull / Legs 6x': { days:f=>[
  ['Push A',[['benchFlat',4],['ohp',3],['chestIso',4],['sideDelt',5],['tricepsLong',4],['tricepsLat',4]]],
  ['Pull A',[['pullV',4],['rowH',4],['rearDelt',4],['bicepsLong',4],['traps',3],['core',3]]],
  ['Legs A',[['squat',4],['hinge',4],['lunge',f?6:4],['quadIso',4],['calves',4],['calvesSeat',3]]],
  ['Push B',[['benchInc',4],['benchDec',4],['ohp',3],['sideDelt',5],['tricepsDip',4],['core',3]]],
  ['Pull B',[['pullV',4],['rowInner',4],['rearDelt',4],['bicepsShort',4],['core',3]]],
  ['Legs B',[['legpress',4],['deadlift',4],[G2(f),f?6:4],['hamIso',4],['calvesSeat',5],['core',3]]]]},

'Upper / Lower 6x': { days:f=>[
  ['Upper A',[['benchFlat',4],['ohp',3],['pullV',4],['rowH',4],['sideDelt',5],['tricepsLong',4],['bicepsLong',4]]],
  ['Lower A',[['squat',4],['hinge',4],['lunge',f?6:4],['quadIso',4],['calves',5],['core',4]]],
  ['Upper B',[['benchInc',4],['pullV',4],['rowH',4],['rearDelt',4],['bicepsShort',4],['tricepsLat',4],['core',3]]],
  ['Lower B',[['legpress',4],['deadlift',4],['hamIso',4],['calvesSeat',5],['core',3]]],
  ['Upper C',[['benchDec',4],['rowInner',4],['sideDelt',5],['rearDelt',4],['tricepsLong',4],['bicepsLong',4]]],
  ['Lower C',[[G2(f),f?6:4],['hinge',4],['legpress',4],['calves',5],['core',3]]]]},
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

// Slots whose set count is AUTHORED per tier rather than budgeted.
//
// The shrug is the case this exists for. Upper traps have no volume target of
// their own, and directGroup folds them into `back` — so the shrug shared the
// back budget with four rows and always landed on the two-set minimum, at every
// tier, in every split that has one. Giving traps its own line makes the slot
// real without inventing a whole-muscle target that every split lacking a shrug
// would then fail.
// Zero at beginner is deliberate, not a gap: the beginner back band is a single
// value (10), and rows alone fill it, so an authored shrug on top pushed back
// over its ceiling. Direct trap work is an intermediate-and-up concern anyway —
// rows and deadlifts already load the traps hard at that stage.
const FIXED_SETS = { traps: [0, 4, 4] };

function allocate(cfg, f, tier) {
  const R = ranges(tier, f, cfg.mev, cfg.floors);
  const days = cfg.days(f);

  // how many slots each muscle gets across the week
  const slotsFor = {};
  for (const [, slots] of days)
    for (const [k] of slots) {
      // An authored slot must not also draw from its group's budget, or the
      // group's sets get divided by a slot that never spends them.
      if (FIXED_SETS[k]) continue;
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

  const tierIndex = { beginner: 0, intermediate: 1, advanced: 2 }[tier] ?? 1;
  const cursor = {};
  return days.map(([name, slots]) => [name, slots.map(([k]) => {
    if (FIXED_SETS[k]) return [k, FIXED_SETS[k][tierIndex]];
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

// ── Optional shoulder specialisation day ─────────────────────────────────────
// An ADD-ON, not part of the weekly budget: it is offered separately in the UI
// and only counts when the user actually does it, so its sets are fixed here
// rather than solved by allocate(). Doing so would fold them into the base
// week and shrink the main days to compensate — the opposite of the intent.
//
// Sizing comes from measured headroom. Side delts sit at 8-12 sets against a
// ceiling of 16 (intermediate) / 22 (advanced), rear delts at 6-10 against
// 14 / 18, so +6 side and +4 rear lands inside the optimal band at both tiers.
//
// Beginner is 0 on every slot, which drops the day entirely. Not an arithmetic
// call — 11 side-delt sets would exceed their ceiling of 9, but more to the
// point a beginner has 5 side-delt sets in the whole week and needs base
// volume, not a specialisation day. Specialising is for a lifter who has
// exhausted what their split gives them.
//
// Two side-delt slots on one day is intentional and legal: DEDICATED above
// permits the duplicate on a day matching /shoulder/i, and the generator's
// dedup pass picks a different exercise for the second one.
// PROTOTYPE carried TWO side-delt slots here, on top of the one every upper day
// already has. That stacked to 16 side-delt sets a week at intermediate against
// a band of 8-16 — the muscle sat pinned to its ceiling while chest sat at 12 of
// 8-15. The second slot is now a shrug: upper traps are a real shoulder-day
// muscle with no slot anywhere else in the app, and the day stays at five
// exercises, which the session-size check requires.
const OPTIONAL_SHOULDER_SLOTS = [
  ['sideDelt', [0, 2, 2]],
  ['rearDelt', [0, 4, 4]],
  ['ohp',      [0, 3, 4]],
  // Lowest set count on the day: the front delt is the one head that pressing
  // already covers, so this is a top-up, not a driver.
  ['frontDelt',[0, 2, 3]],
  ['traps',    [0, 3, 3]],
];

// Mirrors be(): the experience factor scales every slot and rounds per-slot, so
// it has to be modelled here rather than applied to the weekly total.
const LEVEL_VOLUME_FACTOR = { beginner: 0.8, intermediate: 1.0, advanced: 1.2 };

// What a day's NAME commits it to containing. Weekly totals cannot see this:
// a "Pull" day with no vertical pull, or an "Upper" day with no press and no
// triceps, hits its weekly numbers perfectly while being incoherent to train.
// Every entry is a list of alternatives — any one satisfies the requirement.
const DAY_REQUIRES = [
  { re: /^push/i, need: {
    'a chest press': ['chest_horizontal_push', 'chest_incline_push', 'chest_decline'],
    'a shoulder press': ['shoulders_vertical_push'],
    'triceps': ['triceps'],
  } },
  { re: /^pull/i, need: {
    'a vertical pull': ['back_vertical_pull'],
    'a horizontal pull': ['back_horizontal_pull', 'back_inner'],
    'biceps': ['biceps'],
  } },
  // A pull of SOME kind, not both kinds. Demanding vertical AND horizontal on
  // every Upper day forces six back slots in a 3-upper-day split, and since
  // SET_MIN is 2 that is 12 sets against a beginner ceiling of 10 — the rule
  // would be arithmetically unsatisfiable rather than merely unmet. Lat work is
  // still guaranteed by the week-level vertical-pull rule in check().
  { re: /^upper/i, need: {
    'a chest press': ['chest_horizontal_push', 'chest_incline_push', 'chest_decline'],
    'a pull': ['back_vertical_pull', 'back_horizontal_pull', 'back_inner'],
    'triceps': ['triceps'],
    'biceps': ['biceps'],
  } },
  { re: /^(lower|legs)/i, need: {
    'a squat pattern': ['squat_pattern'],
    'a hip hinge': ['hip_hinge'],
  } },
  { re: /^full body/i, need: {
    // Full-body days complement each other across the week, so demanding a
    // barbell CHEST press on every one is too strict — and forcing a fourth
    // chest slot pushed beginners past their ceiling. What each day must have
    // is legs, an upper push and an upper pull; a shoulder press or a fly is a
    // legitimate push, a pullover a legitimate pull.
    'a leg movement': ['squat_pattern', 'hip_hinge', 'quad_isolation', 'glute_focused'],
    'an upper push': ['chest_horizontal_push', 'chest_incline_push', 'chest_decline', 'chest_isolation', 'shoulders_vertical_push'],
    'an upper pull': ['back_vertical_pull', 'back_horizontal_pull', 'back_inner', 'back_isolation'],
  } },
];

function check(cfg, f, tier) {
  const R = ranges(tier, f, cfg.mev, cfg.floors), vol = {}, bad = [], waivers = [], sizes = [];
  const days = allocate(cfg, f, tier);
  // Which days each muscle group appears on — for the frequency rule below.
  const daysPerGroup = {};
  for (const [dname, slots] of days) {
    sizes.push(slots.length);
    const seen = {};
    const patterns = new Set(slots.map(([k]) => SLOT[k][0]));
    for (const [k, sets] of slots) {
      const g = directGroup(k);
      if (g) {
        vol[g] = (vol[g] || 0) + sets;
        (daysPerGroup[g] = daysPerGroup[g] || new Set()).add(dname);
      }
      // 0 is a deliberately dropped slot — the generator skips zero-set slots
      // entirely, which is how the optional shoulder day and the beginner shrug
      // work. A single set is the thing nobody programs.
      if (sets === 1) bad.push(`${k} only ${sets} set on ${dname}`);
      const pat = SLOT[k][0];
      // A once-a-week split has no second day to put the rest of a muscle on,
      // and one slot caps at SET_MAX. Ten side-delt sets therefore MUST be two
      // slots on the single push day — that is the structure working, not the
      // redundancy this check exists to catch.
      if (seen[pat] === k && !DEDICATED[pat]?.test(dname) && !cfg.freq1) bad.push(`dup ${k} on ${dname}`);
      seen[pat] = k;
    }
    // Does the day deliver what its name promises?
    const req = DAY_REQUIRES.find(x => x.re.test(dname));
    if (req) for (const [label, alts] of Object.entries(req.need))
      if (!alts.some(p => patterns.has(p))) bad.push(`${dname}: missing ${label}`);
  }
  for (const [k, [lo, hi]] of Object.entries(R)) {
    if (cfg.only && !cfg.only.includes(k)) continue;
    const v = vol[k] || 0;
    // A waiver is a decision that has been made and written down, not a mask.
    // `only:` silently drops a muscle from the check — that is how this split
    // shipped zero ab sets while reporting clean. A waiver still evaluates the
    // muscle and still prints it, it just does not count as a failure.
    const waived = cfg.waive?.[k];
    if (waived && (typeof waived !== 'function' || waived(f, tier))) {
      if (v < lo || v > hi) waivers.push(`${k} ${v} (want ${lo}-${hi}) — waived`);
      continue;
    }
    if (v < lo) bad.push(`${k} ${v}<${lo}`); else if (v > hi) bad.push(`${k} ${v}>${hi}`);
  }
  // Frequency. The app's own science reference states each muscle should be
  // trained at least twice a week, and it was the one rule the split design
  // never enforced — which is how a whole week of triceps ended up on one day
  // while the weekly total looked perfect.
  // Applied from 4 days up, and never to a split whose whole premise is
  // once-a-week frequency. At 2-3 days there are ~27 slots for 14 muscles, so
  // twice-weekly for everything is arithmetically impossible, not a defect —
  // the same reason those splits already run on the MEV floor. And the bro
  // split trains one muscle per day BY DESIGN; its honest_note already tells
  // the user that is the trade-off, so enforcing frequency there would mean
  // deleting the split rather than fixing it.
  if (days.length >= 4 && !cfg.freq1) {
    for (const [g, ds] of Object.entries(daysPerGroup)) {
      if (cfg.only && !cfg.only.includes(g)) continue;
      if (!R[g]) continue;
      if ((vol[g] || 0) >= 6 && ds.size < 2) bad.push(`${g} ${vol[g]} sets all on ${[...ds][0]} (needs 2+ days)`);
    }
  }
  // Lat width comes from vertical pulling specifically, and rows do not
  // substitute for it. Enforced across the WEEK rather than per day, so a
  // split with three upper days is not forced into more back slots than a
  // beginner's volume ceiling can hold.
  if (days.length >= 4 && !cfg.freq1) {
    const vDays = days.filter(([, slots]) => slots.some(([k]) => SLOT[k][0] === 'back_vertical_pull')).length;
    if (vDays < 2) bad.push(`vertical pull on only ${vDays} day(s) — needs 2`);
  }
  if (sizes.some(s => s < 5 || s > 9)) bad.push(`sessions ${sizes.join('/')}`);
  return { bad, waivers, vol, R, days };
}

let pass = 0; const fails = [], waived = [];
for (const [name, cfg] of Object.entries(SPLITS))
  for (const tier of ['beginner', 'intermediate', 'advanced'])
    for (const sex of ['male', 'female']) {
      const { bad, waivers } = check(cfg, sex === 'female', tier);
      if (waivers.length) waived.push(`${name} [${tier}/${sex}] ${waivers.join('  ')}`);
      if (bad.length) fails.push(`${name} [${tier}/${sex}] ${bad.join('  ')}`); else pass++;
    }
console.log(`${pass} pass / ${fails.length} fail  (10 splits x 3 tiers x 2 sexes)\n`);
fails.forEach(x => console.log('  X', x));
// Printed every run so a waiver can never quietly become invisible.
if (waived.length) { console.log('\n  waived (accepted by design):'); waived.forEach(x => console.log('    ~', x)); }

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
  'Full Body / Upper / Lower 3x': 'hybrid_3x', 'Push / Pull / Legs 3x': 'ppl_3x',
  'Upper / Lower 4x': 'upper_lower_4x',
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
    // Appended AFTER the solved days and marked optional, so the app renders it
    // in its own section rather than as part of the week. Its id must stay
    // 'optional_shoulders' — programGenerator keys the volume-trim table off it.
    if (cfg.optShoulders) {
      const slots = OPTIONAL_SHOULDER_SLOTS
        .map(([k, sets]) => `['${SLOT[k][0]}', [${sets.join(', ')}]]`)
        .join(', ');
      out.push(`    { id: 'optional_shoulders', name: 'Shoulders', focus: 'Side and rear delts', optional: true, slots: [`);
      out.push('      ' + slots);
      out.push('    ] },');
    }
    out.push('  ],');
  }
  console.log(['const SPLIT_DAYS = {', ...out, '};'].join('\n'));
}
