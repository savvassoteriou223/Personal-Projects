// Seed exercise GIFs from WorkoutX API into Supabase exercise_gifs table.
// WorkoutX supports ?api-key= query param so URLs can be used directly by the
// app's Image component without custom headers.
//
// Run:         node scripts/seedWorkoutXGifs.js
// Re-seed all: node scripts/seedWorkoutXGifs.js --reupload

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL || 'https://guvvzimnucttjjzmpsvp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_KEY env var is required.');
  console.error('Run: SUPABASE_SERVICE_KEY=your_service_role_key node scripts/seedWorkoutXGifs.js');
  process.exit(1);
}
const WORKOUTX_KEY         = process.env.WORKOUTX_KEY;
if (!WORKOUTX_KEY) { console.error('Error: WORKOUTX_KEY env var is required.'); process.exit(1); }
const WORKOUTX_GIF_BASE    = 'https://api.workoutxapp.com/v1/gifs';
const REUPLOAD             = process.argv.includes('--reupload');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function norm(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
function gif(id) { return `${WORKOUTX_GIF_BASE}/${id}.gif?api-key=${WORKOUTX_KEY}`; }

// library exercise name (normalised) → WorkoutX exercise id
// IDs confirmed via live API search — each maps to a real exercise with a GIF.
const ID_MAP = {
  // ── Chest horizontal ──────────────────────────────────────────────────────
  'barbell bench press':                         '0025',
  'dumbbell bench press':                        '0289',
  'smith machine bench press':                   '0748', // Smith Bench Press
  'machine chest press':                         '0576',
  'push-up':                                     '1274', // Deep Push Up — key must keep the hyphen: norm() strips "-" without adding a space, so "Push-up" normalizes to "pushup", not "push up"
  'deficit push-up':                             '1274', // closest available

  // ── Chest incline ─────────────────────────────────────────────────────────
  'incline barbell press':                       '0047',
  'incline dumbbell press':                      '0314',
  'decline push-up (feet elevated)':             '0279', // Decline Push-up
  'incline smith machine press':                 '0757', // Smith Incline Bench Press
  'incline machine chest press':                 '0577', // Lever Chest Press v2

  // ── Chest decline ─────────────────────────────────────────────────────────
  'decline barbell press':                       '0033', // Barbell Decline Bench Press
  'decline dumbbell press':                      '0301', // Dumbbell Decline Bench Press
  'decline machine press':                       '1300', // Lever Decline Chest Press

  // ── Chest fly / isolation ─────────────────────────────────────────────────
  'cable fly seated or standing':                '0155', // Cable Cross-over Variation
  'standing cable fly lower chest  multi-angle': '0155',
  'cable crossover lower chest':                 '0155',
  'pec deck chest fly machine':                  '0596', // Lever Seated Fly
  'pec deck':                                    '0596',
  'dumbbell fly':                                '0308', // Dumbbell Fly
  'dips chest focus lean forward':               '0139', // Assisted Chest Dip

  // ── Shoulders vertical push ───────────────────────────────────────────────
  'barbell overhead press':                      '0091', // Barbell Seated Overhead Press
  'dumbbell shoulder press':                     '0426', // Dumbbell Standing Overhead Press
  'arnold press':                                '2137', // Dumbbell Arnold Press
  'machine shoulder press':                      '0603', // Lever Shoulder Press
  'pike push-up':                                '1296',
  'kettlebell overhead press':                   '0523', // Kettlebell Arnold Press variant
  'band overhead press':                         '0997', // Band Shoulder Press

  // ── Shoulders side delt ───────────────────────────────────────────────────
  'dumbbell lateral raise':                      '0334',
  'cable lateral raise':                         '0192', // Cable One Arm Lateral Raise
  'super rom lateral raise':                     '0334',
  'machine lateral raise':                       '0584', // Lever Lateral Raise

  // ── Shoulders rear delt ───────────────────────────────────────────────────
  'face pull cable':                             '3697', // Cable Kneeling Rear Delt Row (with Rope)
  'reverse pec deck':                            '0154', // Cable Cross-over Reverse Fly
  'reverse pec deck rear delt fly':              '0154',
  'reverse cable crossover rear delt':           '0154',
  'reverse cable crossover':                     '0154',
  'bent-over reverse dumbbell flye':             '0383', // Dumbbell Reverse Fly
  'incline y raise':                             '3541', // Dumbbell Incline Y-raise
  'lu raise overhead arc':                       '0334', // use lateral raise
  'barbell front raise overhead arc':            '0041', // Barbell Front Raise
  'barbell front raise':                         '0041',

  // ── Traps ─────────────────────────────────────────────────────────────────
  'barbell shrug':                               '0095',
  'dumbbell shrug':                              '0406',
  'incline dumbbell shrug':                      '0406', // closest available
  'band shrug':                                  '1018', // Band Shrug
  'cable shrug':                                 '0220', // Cable Shrug

  // ── Triceps ───────────────────────────────────────────────────────────────
  'overhead tricep extension':                   '0194', // Cable Overhead Triceps Extension (rope)
  'ez-bar skullcrusher':                         '0060', // Barbell Lying Triceps Extension Skull Crusher
  'dumbbell french press':                       '0092', // Barbell Seated Overhead Triceps Extension
  'cable tricep pushdown rope or bar':           '0200', // Cable Pushdown (with Rope Attachment)
  'cable tricep pushdown':                       '0200',
  'single-arm dumbbell kickback':                '0333', // Dumbbell Kickback
  'single-arm cable kickback':                   '0860', // Cable Kickback
  'dips tricep focus upright':                   '0019', // Assisted Triceps Dip
  'tricep dip benchchair':                       '0019',
  'machine tricep extension':                    '0607', // Lever Triceps Extension
  'diamond push-up':                             '0283', // Diamond Push-up
  'katana extension':                            '0194', // same cable overhead ext
  'close-grip bench press':                      '0030', // Barbell Close-grip Bench Press

  // ── Back vertical pull ────────────────────────────────────────────────────
  'pull-up overhand':                            '0652', // Pull-up
  'chin-up underhand  bicep focus':              '1326', // Chin-up
  'chin-up bicep focus':                         '1326',
  'weighted pull-up':                            '0652',
  'lat pulldown wide pronated grip':             '2330', // Cable Lat Pulldown Full Range Of Motion
  'close grip lat pulldown v-bar':               '2616', // Cable Lateral Pulldown With V-bar
  'half-kneeling single-arm lat pulldown':       '0177', // Cable Lateral Pulldown (with Rope Attachment)
  'machine lat pulldown':                        '0197', // Cable Pulldown (pro Lat Bar)
  'cable lat pullover rope or bar':              '0073', // Barbell Pullover
  'pullover machine':                            '2285', // Lever Pullover
  'barbell pullover':                            '0073', // Barbell Pullover
  'kneeling cable pullover':                     '0073',

  // ── Back horizontal pull ─────────────────────────────────────────────────
  'barbell row':                                 '0027', // Barbell Bent Over Row
  'pendley row deficit':                         '0027', // legacy spelling — keep so old logged sessions still resolve
  'pendlay row deficit':                         '0027',
  't-bar row':                                   '1351', // Lever T-bar Reverse Grip Row
  'dumbbell row':                                '0292', // Dumbbell One Arm Bent-over Row
  'seated cable row close grip':                 '0213', // Cable Seated High Row (v-bar)
  'cable row wide grip  flared elbows':          '0218', // Cable Seated Wide-grip Row
  'chest-supported dumbbell row':                '0327', // Dumbbell Incline Row — was '0049' (Barbell Incline Row), wrong equipment for a dumbbell exercise
  'chest-supported dumbbell row wide grip  flared elbows': '0327', // Dumbbell Incline Row
  'chest-supported row wide grip  flared elbows': '0581', // Lever High Row
  'incline bench row wide grip  flared elbows':  '0049', // Barbell Incline Row
  'towel row around a door frame':               '3165', // Bodyweight Standing Row (with Towel)
  'machine row chest-supported':                 '0213',
  'inverted row australian pull-up':             '0499', // Inverted Row
  'inverted row under a table':                  '0499', // Inverted Row
  'single-arm kettlebell row':                   '0292',

  // ── Biceps ────────────────────────────────────────────────────────────────
  'bayesian cable curl':                         '0190', // Cable One Arm Curl
  'incline dumbbell curl':                       '0318', // Dumbbell Incline Curl
  'preacher curl':                               '0070', // Barbell Preacher Curl
  'barbell curl straight bar':                   '0031', // Barbell Curl
  'ez-bar curl':                                 '0447', // Ez Barbell Curl
  'cable curl standing':                         '0868', // Cable Curl
  'dumbbell curl':                               '0313', // Dumbbell Hammer Curl (closest single)
  'machine bicep curl':                          '0372', // Dumbbell Preacher Curl
  'incline hammer curl':                         '0320', // Dumbbell Incline Hammer Curl
  'standing hammer curl':                        '0313', // Dumbbell Hammer Curl
  'zottman curl':                                '0439', // Dumbbell Zottman Curl

  // ── Squats ────────────────────────────────────────────────────────────────
  'barbell back squat':                          '0043', // Barbell Full Squat
  'barbell front squat':                         '0042', // Barbell Front Squat
  'smith machine squat':                         '0770', // Smith Squat
  'hack squat':                                  '0743', // Sled Hack Squat
  // No entry for 'pendulum squat' on purpose. It used to point at 0743 (Sled
  // Hack Squat) as the "closest available", but the whole point of the pendulum
  // is the arc — the machine puts you through a curved path with a far more
  // upright torso than a hack squat's fixed rails. Showing the hack squat clip
  // teaches the wrong movement, and ExerciseGifThumb renders nothing at all when
  // a name has no gif, so no clip is the honest result.
  '45 leg press':                                '0739', // Sled 45° Leg Press
  'bulgarian split squat':                       '0410', // Dumbbell Single Leg Split Squat
  'bulgarian split squat bodyweight':            '2368', // Split Squats (Body Weight)
  'goblet squat':                                '1760', // Dumbbell Goblet Squat
  'lunge barbell or dumbbell':                   '0336', // Dumbbell Lunge
  'step-up dumbbell or barbell':                 '0431', // Dumbbell Step-up
  'bodyweight squat':                            '0043',
  'lunge bodyweight':                            '1460', // Walking Lunge
  'goblet squat kettlebell':                     '1760',
  'leg extension lean back':                     '0585', // Lever Leg Extension
  'leg extensions':                              '0585',
  'sissy squat':                                 '1489', // Sissy Squat
  'resistance band squat':                       '1004', // Band Squat

  // ── Hip hinge ─────────────────────────────────────────────────────────────
  'romanian deadlift barbell':                   '0085', // Barbell Romanian Deadlift
  'romanian deadlift':                           '0085',
  'conventional deadlift':                       '0032', // Barbell Deadlift
  'sumo deadlift':                               '0117', // Barbell Sumo Deadlift
  'romanian deadlift dumbbell':                  '1459', // Dumbbell Romanian Deadlift
  'hip thrust barbell or machine':               '1409', // Barbell Glute Bridge
  'unilateral hip thrust':                       '1409',
  '45 back extension rounded upper back':        '0573', // Lever Back Extension
  '45 back extension':                           '0573',
  'single-leg romanian deadlift bodyweight':     '1459',
  'kettlebell swing':                            '0549', // Kettlebell Swing
  'kettlebell romanian deadlift':                '1459',
  'resistance band romanian deadlift':           '1009', // Band Stiff Leg Deadlift — closest available; RDL and stiff-leg deadlift are near-identical movements

  // ── Hamstrings ────────────────────────────────────────────────────────────
  'seated leg curl':                             '0599', // Lever Seated Leg Curl
  'lying leg curl':                              '0586', // Lever Lying Leg Curl
  'nordic hamstring curl':                       '0586', // closest available

  // ── Glutes ────────────────────────────────────────────────────────────────
  'walking lunge long stride':                   '1460', // Walking Lunge
  'hip abduction machine':                       '0597', // Lever Seated Hip Abduction
  'cable pull-through':                          '0196', // Cable Pull Through (with Rope)
  'glute bridge bodyweight':                     '1409', // Barbell Glute Bridge
  'single-leg glute bridge':                     '1409',

  // ── Calves ────────────────────────────────────────────────────────────────
  'standing calf raise':                         '0605', // Lever Standing Calf Raise
  'seated calf raise':                           '0594', // Lever Seated Calf Raise
  'single-leg calf raise':                       '0409', // Dumbbell Single Leg Calf Raise
  'dumbbell standing calf raise':                '0417', // Dumbbell Standing Calf Raise
  'cable standing calf raise':                   '1375', // Cable Standing Calf Raise
  'leg press calf raise':                        '1391', // Sled Calf Press On Leg Press

  // ── Forearms ─────────────────────────────────────────────────────────────
  'reverse curl ez bar or barbell':              '0080', // Barbell Reverse Curl
  'dumbbell reverse curl':                       '0429', // Dumbbell Standing Reverse Curl
  'wrist curl dumbbell or cable':                '0125', // Barbell Wrist Curl V. 2
  'dumbbell wrist curl':                         '0369', // Dumbbell Over Bench Wrist Curl
  'reverse wrist curl dumbbell or cable':        '0079', // Barbell Reverse Wrist Curl V. 2
  'farmers walk  carry':                         '2133', // Farmers Walk

  // ── Core ─────────────────────────────────────────────────────────────────
  'cable crunch':                                '0175', // Cable Kneeling Crunch
  'ab wheel rollout':                            '0083', // Barbell Rollerout From Bench
  'hanging leg raise':                           '0010', // Assisted Hanging Knee Raise With Throw Down
  'hanging knee raise':                          '0011', // Assisted Hanging Knee Raise
  'plank isometric hold':                        '2135', // Weighted Front Plank
  'dumbbell side bend':                          '0407', // Dumbbell Side Bend
};

// Deliberately NOT mapped (decided 2026-07-31): band/kettlebell/bodyweight-only
// exercises where WorkoutX has no real match. A same-muscle substitute was
// tried and reverted — showing "Barbell Bent Over Row" under a banded-only
// exercise tells a bands-only user to grab a barbell they don't have, which is
// worse than no gif at all. These exercises keep their real name, equipment,
// and instructions with no visual: Band chest fly, Band tricep pushdown,
// Standing band pulldown, Meadows row, Resistance band row, Prone Y-T-W raise,
// Band lateral raise, Lying lateral raise, Band pull-apart, Band face pull,
// Prone Y-raise, Prone T-raise, Self-resisted towel curl, Resistance band curl,
// Resistance band hammer curl, Smith machine lunge, Single-leg extension,
// Wall sit, Step-up (bodyweight), Standing leg curl, Slider leg curl,
// Band leg curl (lying), Cable hip abduction (standing), Cable glute kickback,
// Kettlebell hip thrust.

async function main() {
  const { data: existing } = await supabase.from('exercise_gifs').select('name, gif_url');
  const seededMap = new Map((existing || []).map(r => [r.name, r.gif_url]));
  console.log(`Already in DB: ${seededMap.size}${REUPLOAD ? ' (--reupload: replacing all)' : ''}\n`);

  const rows = [];
  let skipped = 0;

  for (const [rawName, workoutxId] of Object.entries(ID_MAP)) {
    const key = norm(rawName);

    if (!REUPLOAD && seededMap.has(key)) {
      skipped++;
      continue;
    }

    const gifUrl = gif(workoutxId);
    rows.push({ name: key, gif_url: gifUrl });
    console.log(`  ✓ ${rawName} → ${workoutxId}`);
  }

  if (skipped > 0) console.log(`  (skipped ${skipped} already seeded — use --reupload to replace)\n`);

  if (rows.length > 0) {
    console.log(`\nUpserting ${rows.length} rows into exercise_gifs...`);
    const { error } = await supabase
      .from('exercise_gifs')
      .upsert(rows, { onConflict: 'name' });

    if (error) { console.error('Upsert error:', error.message); process.exit(1); }
    console.log('Done ✓');
  } else {
    console.log('Nothing new to insert.');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
