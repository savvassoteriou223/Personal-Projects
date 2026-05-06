import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MONTHLY_QUOTA = 100;

const SCIENCE_REFERENCE = `
VOLUME (Schoenfeld et al. 2017):
- Minimum effective: 10 sets/week per muscle group
- Optimal: 12–20 sets/week. Beyond 20: diminishing returns.
- Beginners: 10–12 | Intermediate: 12–16 | Advanced: 16–20

VOLUME BY MUSCLE GROUP (sets/week):
- Chest: 12–16. Include flat + incline.
- Back: 12–16. Vertical pulls (width) + horizontal pulls (thickness).
- Shoulders: 10–14. Side/rear delts need isolation — pressing = anterior only.
- Biceps: 8–12. Account for indirect row/pull-up volume.
- Triceps: 8–12. Long head best trained overhead.
- Quads: 12–16. Multiple exercises beat squats alone.
- Hamstrings: 10–14. Hip hinge (length) + leg curl (isolation).
- Glutes: 12–16. Hip thrust (peak) + RDL (lengthened).
- Calves: 10–14. Full ROM, emphasise stretch.
- Abs: 8–12. Squats/deadlifts provide minimal direct stimulus.

EFFORT (Refalo 2023; Zourdos 2016):
- 1–2 RIR = equivalent hypertrophy to failure, better recovery.
- Compounds (squat/bench/deadlift/press): RPE 7–8, RIR 2–3
- Secondary compounds (rows/lunges/dips): RPE 8–9, RIR 1–2
- Isolation (curls/laterals/flies): RPE 9–10, RIR 0–1

REP RANGES (Morton 2016; Schoenfeld 2020):
- All ranges produce equal hypertrophy when taken close to failure.
- 5–12: best strength/hypertrophy balance. 12–20: equal size, less joint stress.

REST (Schoenfeld 2016):
- Heavy compounds: 3–5 min | Moderate compounds: 2–3 min | Isolation: 1–2 min

PROGRESSIVE OVERLOAD:
- Double progression: work a rep range, hit top → increase load → restart bottom.

RECOVERY:
- Protein: 1.6–2.2g/kg/day. Sleep: 7–9h. Deload every 4–8 weeks (cut volume 30–50%).
`;

const SYSTEM_PROMPT = `You are the Helix AI Coach — a science-based strength and hypertrophy coach.

RULES:
1. Only answer questions about training, nutrition, body composition, and recovery.
2. If asked anything else, respond: "I'm your Helix coach — I can only help with training, nutrition, and recovery."
3. Ground all advice in the research below. Use specific numbers, not vague advice.
4. Name gaps explicitly when the user's data falls short of research targets.
5. Keep responses under 120 words. Plain text only — no markdown, bullets, or headers.
6. Be direct. No padding or encouragement.
7. When the user explicitly asks to add, remove, replace, or modify an exercise in their program — use the propose_program_change tool. Do not propose changes unless the user has clearly asked for one.

RESEARCH REFERENCE:
${SCIENCE_REFERENCE}`;

// Tool definition — Claude uses this to return structured program proposals.
// Two types:
//   permanent_edit — persists across all future sessions (written to program_template_overrides)
//   session_swap   — one-off for the next session only (written to program_template_overrides with is_one_time flag)
//   add_exercise   — adds a new exercise slot to a day (written to program_additions)
const TOOLS = [
  {
    name: 'propose_program_change',
    description: 'Propose a specific change to the training program. Only call this when the user explicitly asks to add, remove, replace, or change an exercise or sets/reps in their program.',
    input_schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['permanent_edit', 'session_swap', 'add_exercise'],
          description: 'permanent_edit: changes every future session. session_swap: one-off for next session only. add_exercise: adds a new exercise to a day.',
        },
        day_id: {
          type: 'string',
          description: 'The day ID from the program (e.g. push, pull, upper_a, lower_b, legs). Must match an actual day in the user program.',
        },
        day_name: {
          type: 'string',
          description: 'Human-readable day name, e.g. Push — Chest / Shoulders / Triceps',
        },
        exercise_index: {
          type: 'integer',
          description: '0-based index of the exercise to change or replace. Required for permanent_edit and session_swap.',
        },
        exercise_name: {
          type: 'string',
          description: 'Name of the exercise to add or replace with.',
        },
        pattern_key: {
          type: 'string',
          description: 'Movement pattern key from the library (e.g. chest_incline_push, back_vertical_pull).',
        },
        edit_type: {
          type: 'string',
          enum: ['replace_exercise', 'adjust_sets', 'adjust_reps', 'adjust_rpe', 'add_exercise', 'remove_exercise'],
          description: 'The specific type of edit to apply.',
        },
        sets: { type: 'integer', description: 'New set count (for adjust_sets or add_exercise).' },
        reps: { type: 'string', description: 'New rep range string, e.g. 8–12 (for adjust_reps or add_exercise).' },
        rest: { type: 'string', description: 'Rest period, e.g. 2 min (for add_exercise).' },
        rationale: {
          type: 'string',
          description: 'One sentence, science-based reason for the change. Cite a specific number or principle.',
        },
        scope_label: {
          type: 'string',
          description: 'Permanent change or This session only',
        },
      },
      required: ['type', 'edit_type', 'rationale', 'scope_label'],
    },
  },
];

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
    if (!authHeader) return json({ error: 'unauthorised' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'unauthorised' }, 401);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ai_calls_used, ai_calls_reset_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return json({ error: 'profile_not_found' }, 404);

    const resetAt = new Date(profile.ai_calls_reset_at ?? 0);
    const now = new Date();
    let callsUsed: number = profile.ai_calls_used ?? 0;

    if (now.getFullYear() !== resetAt.getFullYear() || now.getMonth() !== resetAt.getMonth()) {
      await supabase.from('profiles')
        .update({ ai_calls_used: 0, ai_calls_reset_at: now.toISOString() })
        .eq('id', user.id);
      callsUsed = 0;
    }

    if (callsUsed >= MONTHLY_QUOTA) return json({ error: 'quota_exceeded', remaining: 0 }, 429);

    const { userContext, question } = await req.json();
    if (!question?.trim()) return json({ error: 'missing_question' }, 400);

    const userMessage = userContext
      ? `My training data:\n${userContext}\n\nQuestion: ${question}`
      : question;

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
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
        tools: TOOLS,
        tool_choice: { type: 'auto' },
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic error:', errBody);
      return json({ error: 'ai_unavailable' }, 502);
    }

    const anthropicJson = await anthropicRes.json();

    // Extract text response and optional program proposal
    const textBlock = anthropicJson.content?.find((b: { type: string }) => b.type === 'text');
    const toolBlock = anthropicJson.content?.find(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'propose_program_change'
    );

    const text = textBlock?.text ?? '';
    const proposal = toolBlock?.input ?? null;

    await supabase.from('profiles')
      .update({ ai_calls_used: callsUsed + 1 })
      .eq('id', user.id);

    return json({
      text,
      proposal,
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
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
