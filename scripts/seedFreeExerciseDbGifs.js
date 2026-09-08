// Seeds exercise_gifs from the free-exercise-db dataset — public domain
// (The Unlicense), no API key, no vendor, hosted permanently on GitHub.
//
// WHY THIS EXISTS: the WorkoutX provider (seedWorkoutXGifs.js) bakes its API
// key directly into every stored gif_url, and that table is publicly
// readable — anyone can extract the key with a single unauthenticated REST
// call. free-exercise-db sidesteps the whole problem: it's public domain, so
// nothing secret is ever fetched, stored, or exposed.
//
// The dataset gives two still JPEGs per exercise (a start and end position),
// not a pre-made animated gif. This script downloads both, decodes them, and
// encodes a real 2-frame looping GIF — genuinely simple, matching "not very
// detailed" — then uploads it to the same `exercise-gifs` Storage bucket the
// 46 already-safe rows use. The stored gif_url never contains a key, by
// construction, because the source data never had one.
//
// NAME_MAP below is a hand-verified subset (~35% of the movement library) —
// every id was checked against a live copy of the dataset before being added
// here. It intentionally does NOT try to auto-match the rest: a wrong guess
// would show the WRONG exercise's demonstration, which is worse than showing
// none. Extending coverage is hand-verifying more entries the same way, not
// loosening this into a fuzzy matcher.
//
// Usage:
//   SUPABASE_SERVICE_KEY=... node scripts/seedFreeExerciseDbGifs.js
//   SUPABASE_SERVICE_KEY=... node scripts/seedFreeExerciseDbGifs.js --reupload

const { createClient } = require('@supabase/supabase-js');
const jpeg = require('jpeg-js');
const GIFEncoder = require('gif-encoder-2');

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET               = 'exercise-gifs';
const REUPLOAD             = process.argv.includes('--reupload');
const RAW_BASE             = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars. Run with:');
  console.error('  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seedFreeExerciseDbGifs.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function norm(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
function storagePath(name) {
  return `${name.replace(/\s+/g, '-')}.gif`;
}
function publicStorageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// library exercise name (normalised) → free-exercise-db id
//
// DEPRECATED as an active source (2026-07-31): free-exercise-db's images are
// real photos of a person in a gym, not the illustrated anatomy-diagram style
// WorkoutX produces — product direction rejected the photo style once seen
// side by side. The 13 exercises this script had seeded were replaced with
// WorkoutX equivalents (or removed, where WorkoutX has none) directly in the
// database; see ID_MAP in seedWorkoutXGifs.js. NAME_MAP is left empty so a
// future `--reupload` can't silently overwrite WorkoutX rows with photos.
// Re-populate only for an exercise you've hand-verified has NO WorkoutX
// equivalent AND where the photo style has been explicitly approved again.
const NAME_MAP = {};

async function buildGif(id) {
  const frames = [];
  for (const i of [0, 1]) {
    const res = await fetch(`${RAW_BASE}/${id}/${i}.jpg`);
    if (!res.ok) throw new Error(`frame ${i}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    frames.push(jpeg.decode(buf, { useTArray: true }));
  }
  const { width, height } = frames[0];
  const encoder = new GIFEncoder(width, height, 'neuquant', false);
  encoder.setDelay(500);   // half a second per frame — a slow, readable rep
  encoder.setRepeat(0);    // loop forever
  encoder.start();
  for (const f of frames) encoder.addFrame(f.data);
  encoder.finish();
  return encoder.out.getData();
}

async function main() {
  const { data: existing } = await supabase.from('exercise_gifs').select('name');
  const seeded = new Set((existing || []).map(r => r.name));

  let done = 0, failed = 0, skipped = 0;

  for (const [rawName, id] of Object.entries(NAME_MAP)) {
    const key = norm(rawName);
    if (!REUPLOAD && seeded.has(key)) { skipped++; continue; }

    try {
      const gifBytes = await buildGif(id);
      const path = storagePath(key);

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, gifBytes, { contentType: 'image/gif', upsert: true });
      if (uploadErr) throw new Error(`upload: ${uploadErr.message}`);

      const { error: dbErr } = await supabase
        .from('exercise_gifs')
        .upsert({ name: key, gif_url: publicStorageUrl(path) }, { onConflict: 'name' });
      if (dbErr) throw new Error(`db: ${dbErr.message}`);

      done++;
      console.log(`  ✓ ${rawName} (${id})`);
    } catch (e) {
      failed++;
      console.warn(`  ✗ ${rawName} (${id}): ${e.message}`);
    }
  }

  if (skipped) console.log(`\n(skipped ${skipped} already seeded — use --reupload to replace)`);
  console.log(`\nDone: ${done} seeded, ${failed} failed.`);
  console.log(`Covers ${Object.keys(NAME_MAP).length} of the ~163 exercises in movementLibrary.js —`);
  console.log('extend NAME_MAP with more hand-verified ids to cover more.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
