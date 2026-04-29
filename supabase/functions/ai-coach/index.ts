import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MONTHLY_QUOTA = 50;

// Serialised from scienceEngine.js — cached by Anthropic on first call each 5-min window
const SCIENCE_REFERENCE = `
VOLUME (Schoenfeld et al. 2017, meta-analysis, 15 studies):
- Minimum effective: 10 sets/week per muscle group
- Optimal range: 12–20 sets/week
- Each additional set adds ~0.37% muscle size (dose-response, p=0.002)
- Beyond 20 sets/week: diminishing returns, recovery cost outweighs benefit
- Beginners: 10–12 sets/week | Intermediate: 12–16 | Advanced: 16–20

VOLUME BY MUSCLE GROUP:
- Chest: 12–16 sets/week, 2×/week min. Include flat + incline.
- Back: 12–16 sets/week, 2×/week. Vertical pulls (width) + horizontal pulls (thickness).
- Shoulders: 10–14 sets/week, 2–3×/week. Side delt needs direct isolation — pressing = anterior only.
- Biceps: 8–12 sets/week, 2×/week. Account for indirect row/pull-up volume.
- Triceps: 8–12 sets/week, 2×/week. Long head (largest) best trained with arm overhead.
- Quads: 12–16 sets/week, 2×/week. Multiple exercises > squats alone.
- Hamstrings: 10–14 sets/week, 2×/week. Hip hinge (length) + leg curl (isolation).
- Glutes: 12–16 sets/week, 2×/week. Hip thrust (peak contraction) + RDL (lengthened).
- Calves: 10–14 sets/week, 2–3×/week. Full ROM, emphasise stretch.
- Abs: 8–12 sets/week, 2×/week. Minimally active in squats/deadlifts — direct work needed.

EFFORT / PROXIMITY TO FAILURE (Refalo et al. 2023; Zourdos et al. 2016):
- Proximity to failure is essential regardless of rep range
- 1–2 RIR = equivalent hypertrophy to failure, better recovery
- Primary compounds (squat, deadlift, bench, press): RPE 7–8, RIR 2–3
- Secondary compounds (rows, lunges, dips): RPE 8–9, RIR 1–2
- Isolation (curls, laterals, flies): RPE 9–10, RIR 0–1

RPE SCALE (Zourdos et al. 2016):
RPE 10 = 0 RIR (true failure) | RPE 9 = 1 RIR | RPE 8 = 2 RIR | RPE 7 = 3 RIR | RPE 6 = 4 RIR

REP RANGES (Morton et al. 2016; Schoenfeld & Grgic 2020):
- 1–5: maximal strength, high CNS demand
- 5–12: optimal strength/hypertrophy balance (most practical)
- 12–20: equal hypertrophy to 5–12 when taken close to failure
- 20–30+: muscular endurance; cardiovascular often limits before muscle

REST PERIODS (Schoenfeld et al. 2016 RCT):
- 3-min rest > 1-min rest for hypertrophy and strength in trained men
- Heavy compounds: 3–5 min | Moderate compounds: 2–3 min | Isolation: 1–2 min

TRAINING FREQUENCY (Schoenfeld et al. 2016 meta-analysis; Schoenfeld & Grgic 2019):
- 2× per week per muscle > 1× per week for hypertrophy
- Beyond 2×/week: total weekly volume matters more than frequency
- Beginner: 2–3 full-body sessions | Intermediate: 4 sessions, upper/lower | Advanced: 5–6 sessions, PPL

PROGRESSIVE OVERLOAD:
- Load progression: increase weight, keep sets/reps (best for beginners)
- Double progression: work a rep range, hit top end → increase load → restart bottom (most sustainable)
- Volume progression: add working sets
- Density progression: same work in less time (secondary only)

RECOVERY (Morton et al. 2018; general literature):
- Protein: min 1.6g/kg/day, optimal 2.2g/kg/day — beyond 1.62g/kg no additional FFM benefit
- Sleep: 7–9 hours minimum
- Deload: every 4–8 weeks or when performance consistently drops
- Deload protocol: reduce volume 30–50% for one week, load can stay similar
- Between sessions: 2–4 days per muscle group minimum

MUSCLE GAIN EXPECTATIONS (natural, male reference):
- Year 1: 0.9–1.1 kg/month | Year 2: 0.45–0.55 | Year 3: 0.23–0.27 | Year 4: 0.11–0.14
- Caloric surplus 5–10% above maintenance for lean gaining
- Caloric deficit 10–20% below maintenance — muscle gain possible but slower
`;

const SYSTEM_PROMPT = `You are the FitPulse AI Coach — a science-based strength and hypertrophy coach built into the FitPulse app.

STRICT RULES:
1. You ONLY answer questions about fitness training, nutrition, body composition, and recovery.
2. If asked about anything else (coding, writing, general knowledge, etc.), respond exactly: "I'm your FitPulse coach — I can only help with training, nutrition, and recovery. Try a general AI assistant for other questions."
3. Always ground your advice in the peer-reviewed research below. Reference specific numbers (sets, percentages, rep ranges) rather than giving vague advice.
4. When the user's data shows a gap versus the research targets, name it explicitly.
5. Keep all responses under 150 words. Plain text only — no markdown, no bullet symbols, no headers.
6. Be direct and honest. Do not pad with encouragement.

PEER-REVIEWED RESEARCH REFERENCE:
${SCIENCE_REFERENCE}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'unauthorised' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return json({ error: 'unauthorised' }, 401);
    }

    // Load quota state
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ai_calls_used, ai_calls_reset_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: 'profile_not_found' }, 404);
    }

    // Reset counter if we're in a new calendar month
    const resetAt = new Date(profile.ai_calls_reset_at ?? 0);
    const now = new Date();
    let callsUsed: number = profile.ai_calls_used ?? 0;

    if (
      now.getFullYear() !== resetAt.getFullYear() ||
      now.getMonth() !== resetAt.getMonth()
    ) {
      await supabase
        .from('profiles')
        .update({ ai_calls_used: 0, ai_calls_reset_at: now.toISOString() })
        .eq('id', user.id);
      callsUsed = 0;
    }

    if (callsUsed >= MONTHLY_QUOTA) {
      return json({ error: 'quota_exceeded', remaining: 0 }, 429);
    }

    // Parse request
    const { userContext, question } = await req.json();
    if (!question?.trim()) {
      return json({ error: 'missing_question' }, 400);
    }

    const userMessage = userContext
      ? `My training data:\n${userContext}\n\nQuestion: ${question}`
      : question;

    // Call Anthropic with prompt caching on the system prompt
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic error:', errBody);
      return json({ error: 'ai_unavailable' }, 502);
    }

    const anthropicJson = await anthropicRes.json();
    const text = anthropicJson.content?.[0]?.text ?? 'No response generated.';

    // Increment quota counter
    await supabase
      .from('profiles')
      .update({ ai_calls_used: callsUsed + 1 })
      .eq('id', user.id);

    return json({
      text,
      remaining: MONTHLY_QUOTA - callsUsed - 1,
      used: callsUsed + 1,
      quota: MONTHLY_QUOTA,
    });
  } catch (err) {
    console.error('ai-coach error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
