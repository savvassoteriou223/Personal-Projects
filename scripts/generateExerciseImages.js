// generateExerciseImages.js
// Generates DALL-E 3 anatomical exercise renders and uploads to Supabase Storage.
//
// Prerequisites:
//   1. Run scripts/supabase_exercise_images.sql in Supabase SQL Editor.
//   2. Create an 'exercise-images' bucket in Supabase Storage:
//        Dashboard → Storage → New bucket → Name: exercise-images → Public: ON
//   3. npm install openai   (one-time, from project root)
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/generateExerciseImages.js
//
// Cost:  39 images × $0.040 = ~$1.56 USD  (DALL-E 3 standard 1024×1024)
// Time:  ~12 minutes  (rate-limited to 5 img/min on Tier 1 accounts)
//
// To resume after a failure, the script skips images already in Supabase.

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const SUPABASE_URL        = 'https://guvvzimnucttjjzmpsvp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnZ6aW1udWN0dGpqem1wc3ZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIzNzg2NCwiZXhwIjoyMDkxODEzODY0fQ.aZQ2Bth5LlolhfKtn9fBeIsknTx-jCLmn1zxw096LKs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BUCKET = 'exercise-images';

// ─── Shared style suffix ──────────────────────────────────────────────────────
const S = 'CGI 3D render, muscular male athlete, dark studio background, ' +
  'professional fitness instructional image, full body visible, no text, no watermarks.';

// ─── Exercise prompts  (key → [phase0, phase1, phase2]) ───────────────────────
const EXERCISES = [
  {
    key: 'squat',
    phases: [
      { name: 'Set up',         prompt: `Muscular man standing upright with a barbell resting across his upper back, feet shoulder-width apart, about to perform a barbell back squat. Front-facing view. ${S}` },
      { name: 'Break parallel', prompt: `Muscular man at the bottom of a barbell back squat, thighs below parallel, knees pushed out, chest up, barbell on upper back. Front-facing view. ${S}` },
      { name: 'Drive through',  prompt: `Muscular man driving up from the bottom of a barbell back squat, halfway to standing, hips and shoulders rising together. Front-facing view. ${S}` },
    ],
  },
  {
    key: 'deadlift',
    phases: [
      { name: 'Wedge in',      prompt: `Muscular man in the starting position of a conventional barbell deadlift — hips back, back flat, bar over mid-foot, arms straight, shoulders over bar. Side view. ${S}` },
      { name: 'Bar off floor', prompt: `Muscular man just lifted a barbell off the floor in a conventional deadlift, knees extending, back angle maintained, bar close to shins. Side view. ${S}` },
      { name: 'Lockout',       prompt: `Muscular man standing tall at the top of a conventional barbell deadlift, hips fully extended, shoulders back, bar hanging at hip height. Side view. ${S}` },
    ],
  },
  {
    key: 'ohp',
    phases: [
      { name: 'Front rack',       prompt: `Muscular man standing with a barbell at shoulder height ready to press overhead, elbows slightly in front, core braced. Front view. ${S}` },
      { name: 'Bar clears head',  prompt: `Muscular man pressing a barbell overhead, bar passing his forehead, arms half extended, head slightly back. Front view. ${S}` },
      { name: 'Overhead lockout', prompt: `Muscular man with a barbell locked out directly overhead, arms fully extended, standing tall. Front view. ${S}` },
    ],
  },
  {
    key: 'bench',
    phases: [
      { name: 'Setup',          prompt: `Muscular man lying flat on a weight bench holding a barbell at full arm extension above his chest, ready to lower it for a bench press. Side view. ${S}` },
      { name: 'Lower to chest', prompt: `Muscular man lying on a weight bench with a barbell touching his lower chest, elbows bent at roughly 60 degrees, performing a barbell bench press. Side view. ${S}` },
      { name: 'Press in arc',   prompt: `Muscular man lying on a weight bench pressing a barbell upward, arms halfway extended, performing a barbell bench press. Side view. ${S}` },
    ],
  },
  {
    key: 'row',
    phases: [
      { name: 'Hinge and brace',     prompt: `Muscular man bent forward at the hips holding a barbell with straight arms hanging below his shoulders, back flat at 45 degrees, ready to row. Side view. ${S}` },
      { name: 'Pull to lower chest', prompt: `Muscular man bent forward pulling a barbell up to his lower chest, elbows driven back, performing a bent-over barbell row. Side view. ${S}` },
      { name: 'Peak squeeze',        prompt: `Muscular man bent forward with a barbell held at his sternum, shoulder blades fully squeezed together, top position of a bent-over barbell row. Side view. ${S}` },
    ],
  },
  {
    key: 'pullup',
    phases: [
      { name: 'Dead hang',         prompt: `Muscular man hanging from a pull-up bar with arms fully extended, shoulder-width overhand grip, body straight. Front view. ${S}` },
      { name: 'Elbows to pockets', prompt: `Muscular man halfway up on a pull-up bar, chin approaching the bar, elbows driving down and back. Front view. ${S}` },
      { name: 'Chin over bar',     prompt: `Muscular man at the top of a pull-up, chin above the bar, chest near the bar, elbows fully bent. Front view. ${S}` },
    ],
  },
  {
    key: 'rdl',
    phases: [
      { name: 'Hip hinge',         prompt: `Muscular man standing holding a barbell at hip height, hips pushed back, slight knee bend, beginning a Romanian deadlift. Side view. ${S}` },
      { name: 'Hamstring stretch', prompt: `Muscular man hinged forward with a barbell near his shins, back flat, hamstrings fully stretched, bottom of a Romanian deadlift. Side view. ${S}` },
      { name: 'Hip extension',     prompt: `Muscular man standing upright squeezing glutes at the top of a Romanian deadlift, barbell at hip height. Side view. ${S}` },
    ],
  },
  {
    key: 'curl',
    phases: [
      { name: 'Start',            prompt: `Muscular man standing holding dumbbells at his sides with palms facing forward, about to perform a bicep curl. Front view. ${S}` },
      { name: '90° position',     prompt: `Muscular man performing a dumbbell bicep curl with forearms parallel to the floor, elbows pinned to his sides. Front view. ${S}` },
      { name: 'Peak contraction', prompt: `Muscular man at the top of a dumbbell bicep curl, forearms fully curled up near his shoulders, biceps fully contracted. Front view. ${S}` },
    ],
  },
  {
    key: 'lunge',
    phases: [
      { name: 'Step forward',               prompt: `Muscular man stepping forward into a lunge position, front foot planted, front shin vertical, about to lower his back knee. Side view. ${S}` },
      { name: 'Bottom — back knee near floor', prompt: `Muscular man at the bottom of a forward lunge, back knee just above the floor, front knee over toe, torso upright. Side view. ${S}` },
      { name: 'Drive up',                   prompt: `Muscular man pushing through his front heel to stand up from the bottom of a lunge, front leg extending. Side view. ${S}` },
    ],
  },
  {
    key: 'hipthrust',
    phases: [
      { name: 'Setup',   prompt: `Muscular man with his upper back resting on a flat bench, a barbell across his hips, feet flat on the floor, hips lowered, ready to thrust up. Side view. ${S}` },
      { name: 'Bottom',  prompt: `Muscular man with upper back on a bench, barbell across hips, hips at their lowest point before a hip thrust. Side view. ${S}` },
      { name: 'Lockout', prompt: `Muscular man at the top of a barbell hip thrust, hips fully extended, body forming a straight line from shoulders to knees, glutes squeezed. Side view. ${S}` },
    ],
  },
  {
    key: 'dip',
    phases: [
      { name: 'Top — arms straight',         prompt: `Muscular man at the top of a parallel bar dip, arms fully straight, body supported between two parallel bars, slight forward lean. Side view. ${S}` },
      { name: 'Lower — upper arm parallel',  prompt: `Muscular man at the bottom of a parallel bar dip, upper arms parallel to the floor, elbows bent 90 degrees, chest stretched forward. Side view. ${S}` },
      { name: 'Press to lockout',            prompt: `Muscular man pressing up from the bottom of a parallel bar dip, arms halfway extended, body rising between the bars. Side view. ${S}` },
    ],
  },
  {
    key: 'pushup',
    phases: [
      { name: 'Top — plank position',     prompt: `Muscular man in push-up top position — arms fully extended, straight line from head to heels, hands below shoulders. Side view. ${S}` },
      { name: 'Lower — chest near floor', prompt: `Muscular man at the bottom of a push-up, chest just above the floor, elbows bent at 45 degrees, body in a straight line. Side view. ${S}` },
      { name: 'Press to lockout',         prompt: `Muscular man pressing up from the bottom of a push-up, arms extending, body straight, nearly back to top position. Side view. ${S}` },
    ],
  },
  {
    key: 'latpulldown',
    phases: [
      { name: 'Arms extended',            prompt: `Muscular man seated at a lat pulldown machine, arms fully extended gripping a wide bar overhead, leaning slightly back. Front view. ${S}` },
      { name: 'Halfway — elbows driving', prompt: `Muscular man seated at a lat pulldown machine, bar at forehead height, elbows pulling down and back toward his hips. Front view. ${S}` },
      { name: 'Bar to upper chest',       prompt: `Muscular man seated at a lat pulldown machine, bar pulled down to his upper chest, elbows behind his body, lats fully contracted. Front view. ${S}` },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchImageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function imageAlreadyExists(key, index) {
  const { data } = await supabase
    .from('exercise_images')
    .select('image_url')
    .eq('exercise_key', key)
    .eq('phase_index', index)
    .single();
  return !!data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.error('Usage: OPENAI_API_KEY=sk-... node scripts/generateExerciseImages.js');
    process.exit(1);
  }

  const total = EXERCISES.reduce((n, e) => n + e.phases.length, 0);
  console.log(`Generating ${total} exercise images (approx. $${(total * 0.04).toFixed(2)} USD)…\n`);

  let done = 0;
  let skipped = 0;

  for (const exercise of EXERCISES) {
    for (let i = 0; i < exercise.phases.length; i++) {
      const phase = exercise.phases[i];
      const label = `${exercise.key}/${i} (${phase.name})`;

      // Skip if already uploaded (safe resume after failure)
      if (await imageAlreadyExists(exercise.key, i)) {
        console.log(`  ✓ skip  ${label}`);
        skipped++;
        continue;
      }

      console.log(`  → gen   ${label}`);

      try {
        // 1. Generate with DALL-E 3
        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: phase.prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'url',
        });
        const tempUrl = response.data[0].url;

        // 2. Download the image
        const imageBuffer = await fetchImageBuffer(tempUrl);

        // 3. Upload to Supabase Storage
        const storagePath = `${exercise.key}/${i}.png`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, imageBuffer, { contentType: 'image/png', upsert: true });
        if (upErr) throw upErr;

        // 4. Get permanent public URL
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        // 5. Insert into exercise_images table
        const { error: dbErr } = await supabase
          .from('exercise_images')
          .upsert({
            exercise_key: exercise.key,
            phase_index:  i,
            phase_name:   phase.name,
            image_url:    publicUrl,
          }, { onConflict: 'exercise_key,phase_index' });
        if (dbErr) throw dbErr;

        console.log(`  ✓ done  ${label}`);
        done++;

        // Rate-limit: 5 images/min on Tier 1 → wait 13 s between requests
        if (done + skipped < total) await sleep(13000);

      } catch (err) {
        console.error(`  ✗ fail  ${label}: ${err.message}`);
        console.error('    Re-run the script to retry failed images (already-done ones are skipped).');
        await sleep(5000);
      }
    }
  }

  console.log(`\nDone. Generated: ${done}, Skipped (already existed): ${skipped}`);
  if (done > 0) {
    console.log('\nNext: the app will automatically show these images in the exercise slideshow.');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
