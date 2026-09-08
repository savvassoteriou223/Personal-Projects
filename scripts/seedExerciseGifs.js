// One-time seed script — populates exercise_gifs table in Supabase.
// Run AFTER creating the table (see supabase_setup.sql).
//
// Requires Node.js 18+ (uses native fetch).
// Usage:
//   SUPABASE_SERVICE_KEY=your_service_key node scripts/seedExerciseGifs.js
//
// Get your service role key from:
//   Supabase dashboard → Settings → API → service_role (secret) key

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EXERCISEDB_KEY       = process.env.EXERCISEDB_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !EXERCISEDB_KEY) {
  console.error('Missing env vars. Run with:');
  console.error('  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... EXERCISEDB_KEY=... node scripts/seedExerciseGifs.js');
  process.exit(1);
}


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function norm(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const BODY_PARTS = [
  'back', 'cardio', 'chest', 'lower arms', 'lower legs',
  'neck', 'shoulders', 'upper arms', 'upper legs', 'waist',
];

async function fetchBodyPart(bodyPart) {
  const res = await fetch(
    `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=500&offset=0`,
    {
      headers: {
        'x-rapidapi-key':  EXERCISEDB_KEY,
        'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
      },
    }
  );
  if (!res.ok) throw new Error(`ExerciseDB ${res.status} for ${bodyPart}`);
  return res.json();
}

async function main() {
  console.log('Fetching exercises by body part…');

  const all = [];
  for (const part of BODY_PARTS) {
    const exercises = await fetchBodyPart(part);
    console.log(`  ${part}: ${exercises.length}`);
    all.push(...exercises);
  }

  const exercises = all;
  console.log(`Total: ${exercises.length} exercises`);

  const rows = exercises
    .filter(e => e.gifUrl)
    .map(e => ({ name: norm(e.name), gif_url: e.gifUrl }));

  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('exercise_gifs')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'name' });
    if (error) throw error;
    console.log(`  Inserted ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  console.log('\nDone ✓  — you can now remove the API key from exerciseDBService.js');
}

main().catch(e => { console.error(e.message); process.exit(1); });
