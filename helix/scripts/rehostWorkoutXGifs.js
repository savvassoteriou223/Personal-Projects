// Re-hosts every WorkoutX-sourced gif into Supabase Storage, so the
// exercise_gifs table never stores a live third-party API key again.
//
// WHY THIS EXISTS: seedWorkoutXGifs.js stores gif_url as a WorkoutX API URL
// with the key baked in as a query param (?api-key=...). exercise_gifs has a
// public SELECT policy (USING (true)) — required so the app can read gifs
// without a login round-trip — which means that key is readable by anyone,
// with zero authentication, via a single REST call:
//
//   curl "$SUPABASE_URL/rest/v1/exercise_gifs?select=gif_url" \
//     -H "apikey: $ANON_KEY"
//
// This script downloads each WorkoutX gif once (using a fresh key you control)
// and re-uploads the raw file to the `exercise-gifs` Storage bucket — the same
// bucket 46 rows already use safely. The stored gif_url becomes a plain
// Storage URL with no secret in it, matching that existing safe pattern.
//
// BEFORE running this:
//   1. Rotate/revoke the WorkoutX key that is currently exposed in the DB —
//      that key is compromised the moment it's public, regardless of this
//      script. Get the new key from the WorkoutX dashboard.
//   2. This script uses the NEW key only to download the gifs (authenticated,
//      short-lived use) — it is never written back into the database.
//
// Usage:
//   SUPABASE_SERVICE_KEY=... WORKOUTX_KEY=<new key> node scripts/rehostWorkoutXGifs.js
//
// Safe to re-run: already re-hosted rows (gif_url not on workoutxapp.com) are
// skipped, and storage uploads use upsert so a partial run can resume.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKOUTX_KEY         = process.env.WORKOUTX_KEY;
const BUCKET               = 'exercise-gifs';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !WORKOUTX_KEY) {
  console.error('Missing env vars. Run with:');
  console.error('  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... WORKOUTX_KEY=<new, rotated key> node scripts/rehostWorkoutXGifs.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// "barbell curl" -> "barbell-curl.gif" — matches the naming the 46 already-safe
// rows use (verified against live data: dumbbell-romanian-deadlift.gif etc).
function storagePath(name) {
  return `${name.replace(/\s+/g, '-')}.gif`;
}

function publicStorageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const { data: rows, error } = await supabase.from('exercise_gifs').select('name, gif_url');
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  const toRehost = (rows || []).filter(r => r.gif_url?.includes('workoutxapp.com'));
  console.log(`${rows.length} total rows, ${toRehost.length} still on WorkoutX (key-exposed) URLs.\n`);
  if (!toRehost.length) { console.log('Nothing to do — all rows already re-hosted.'); return; }

  let done = 0, failed = 0;

  for (const row of toRehost) {
    try {
      // The stored URL carries the OLD (leaked) key, which may already be
      // revoked. Rebuild the fetch URL from the gif id in that URL's path,
      // authenticated with the NEW key passed to this script — never the
      // stored one.
      const idMatch = row.gif_url.match(/\/gifs\/([^./]+)\.gif/);
      if (!idMatch) { console.warn(`  ? ${row.name}: couldn't parse gif id from ${row.gif_url}`); failed++; continue; }
      const fetchUrl = `https://api.workoutxapp.com/v1/gifs/${idMatch[1]}.gif?api-key=${WORKOUTX_KEY}`;

      // WorkoutX rate-limits at ~30 req/window; back off and retry on 429
      // rather than treating it as a real failure.
      let res = await fetch(fetchUrl);
      for (let attempt = 0; res.status === 429 && attempt < 5; attempt++) {
        const waitMs = 1000 * Number(res.headers.get('retry-after') || 10);
        await new Promise(r => setTimeout(r, waitMs));
        res = await fetch(fetchUrl);
      }
      if (!res.ok) { console.warn(`  ✗ ${row.name}: download ${res.status}`); failed++; continue; }
      const bytes = new Uint8Array(await res.arrayBuffer());

      const path = storagePath(row.name);
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: 'image/gif', upsert: true });
      if (uploadErr) { console.warn(`  ✗ ${row.name}: upload failed — ${uploadErr.message}`); failed++; continue; }

      const newUrl = publicStorageUrl(path);
      const { error: updateErr } = await supabase
        .from('exercise_gifs')
        .update({ gif_url: newUrl })
        .eq('name', row.name);
      if (updateErr) { console.warn(`  ✗ ${row.name}: DB update failed — ${updateErr.message}`); failed++; continue; }

      done++;
      console.log(`  ✓ ${row.name}`);
    } catch (e) {
      console.warn(`  ✗ ${row.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${done} re-hosted, ${failed} failed.`);
  if (failed) console.log('Re-run the script to retry failed rows — it skips ones already fixed.');
  console.log('\nOnce this reaches 0 failures: confirm the WorkoutX key has been rotated');
  console.log('(step 1 above) — the leaked key must not still be live even though the');
  console.log('database no longer stores it.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
