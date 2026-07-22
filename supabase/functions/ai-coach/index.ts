import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MONTHLY_QUOTA = 100;

// NOTE: studiesLibrary.js (client) is the SINGLE SOURCE OF TRUTH for the science.
// The authoritative, up-to-date findings are injected into each request as the
// "EVIDENCE BASE" (rule 3). This constant is only a LEAN FALLBACK for older
// clients that don't send it — keep it concise and in sync; don't let it grow
// back into a wall of paragraphs.
const SCIENCE_REFERENCE = `
PROGRAMMING:
- Volume: 10–20 sets/muscle/week is optimal (each extra set ~+0.24% growth); min ~4; per-session ceiling ~10–12. Beginners 10–12, intermediate 12–16, advanced 16–20.
- Effort: closer to failure = more growth, but 1–3 RIR matches failure with better recovery. Compounds RPE 7–8, secondary 8–9, isolation 9–10.
- Reps: all ranges grow muscle near failure; 5–12 balance, 12–20 joint-friendly.
- Rest: heavy compounds 3–5 min, moderate 2–3, isolation 1–2.
- Frequency: each muscle ≥2×/week; beyond that total volume matters most.
- Overload: double progression (hit top of rep range → add load → restart bottom).
- Deload: every 4–8 weeks cut volume 30–50% for a week.

MUSCLE / EXERCISE TARGETING:
- Chest by line of pull: incline / LOW-to-HIGH cable = UPPER chest; decline / dips / HIGH-to-LOW cable = LOWER chest; flat = mid. (low-to-high = upper, high-to-low = lower — never reverse this.)
- Back: needs vertical pulls (lat width) + horizontal pulls (thickness).
- Shoulders: pressing trains front delt only; side and rear delts need direct isolation.
- Triceps: long head grows most from overhead extensions — far more than pushdowns.
- Biceps: stretched-position curls (incline, behind-body cable) beat short-position.
- Quads: squats (vastus lateralis) + leg extension (rectus femoris) — both needed.
- Hamstrings: hip hinge at long length (RDL) primary; Nordic biases semitendinosus.
- Glutes: hip thrust (peak contraction) + RDL (stretch).
- Calves: standing raise with full stretch grows gastroc; seated/no-stretch ≈ 0%.
- Abs: weighted direct work (cable crunch, ab wheel) >> bodyweight.
- Lengthened-position training generally beats short-position for growth.

NUTRITION:
- Protein 1.6–2.2 g/kg/day (cutting 2.0–2.4). Per-meal cap overturned. Timing barely matters.
- Creatine 3–5 g/day (no loading) ≈ +1.4 kg FFM. Caffeine 3–6 mg/kg 45–60 min pre.
- Fat-loss deficit 300–500 kcal/day (>500 risks muscle). Lean bulk ~5–10% surplus.

RECOVERY & CARDIO:
- Sleep 7–9h. Low HRV + poor sleep = train lighter.
- ~80% of cardio easy (Zone 2); heavy cardio same day as legs blunts strength (separate 6h+).
- Abs visible ~10–12% BF men / ~18–20% women — diet reveals them, not ab exercises.
`;

const SYSTEM_PROMPT = `You are the Helix AI Coach — a science-based strength and hypertrophy coach.

RULES:
1. Only answer questions about training, nutrition, body composition, and recovery.
2. If asked anything else, respond: "I'm your Helix coach — I can only help with training, nutrition, and recovery."
3. Ground all advice in the science. The user's data includes an "EVIDENCE BASE" — the app's own curated findings — which is your AUTHORITATIVE source: cite it, stay consistent with it, and prefer it over your own general knowledge. The RESEARCH REFERENCE below is supporting background. Never state a claim that contradicts the EVIDENCE BASE, and if a topic isn't covered by either, say it's outside the app's evidence rather than inventing specifics. Use specific numbers, not vague advice.
4. Name gaps explicitly when the user's data falls short of research targets.
5. Keep responses under 120 words. Plain text only — no markdown, bullets, or headers.
6. Be direct. No padding or encouragement.
7. Exercise changes — pick the right tool, and NEVER interrogate:
   - If the user asks to CHANGE / REPLACE / SWAP an exercise but does NOT name a specific replacement — call suggest_exercise_alternatives ONCE with 3 ranked, research-backed options (best first) for that one slot. Do not ask which exercise (use the current/live one) and do not ask what to replace it with. "you pick" / "I don't know" / "you decide" also means: return ranked alternatives.
   - If the user NAMES the replacement (e.g. "swap X for Y"), or asks to ADD or REMOVE an exercise, or to change sets/reps/rpe — use propose_program_change with a specific concrete change in the SAME reply.
   - Your text reply must still name the actual ranked options in prose (e.g. "Best options: Leg curl, then Nordic curl, then Romanian deadlift") — never rely only on the structured card. The card is UI-only state that doesn't survive the app closing and reopening; only your text is saved to memory, so a reply like "here are your options:" with nothing else becomes a dangling, meaningless sentence once the card is gone. Keep it to one sentence, just make that sentence self-contained.
7a. CRITICAL — never ask the user which exercise OR whether the change is one-time vs permanent:
   - WHICH exercise: if a live workout's "Current exercise" is shown in the data and the user says "this exercise", "this one", "change this", "swap this", etc., they mean that CURRENT exercise — propose for it immediately, never ask which. Only ask if there is genuinely no current exercise and the request names none.
   - ONE-TIME vs PERMANENT: NEVER ask this. The app shows the user a "Just this workout / All future" choice when they tap Apply, so it is not your job to ask. Always just propose the change (use type permanent_edit by default; only use session_swap if the user themselves explicitly said "just today"/"one time"). Do not mention scope in your text reply.
8. Ask AT MOST one short clarifying question, and only if you genuinely cannot act without it (e.g. you don't know which of two identical-named exercises they mean). Otherwise, act. Never ask more than one question before proposing.
9. When replacing or changing N exercises, call propose_program_change exactly N times — one call per exercise. You MUST set day_id AND exercise_index for every call, taken from the [index] number shown for that exercise in the program context — never omit them or guess. Always include exercise_name with the exact name of the replacement exercise. EXCEPTION: whenever a live session section is present and the change targets an exercise in that session, take day_id and exercise_index from the live session's exercise list — for BOTH one-off ("just this workout") AND permanent ("now & all future") changes. A permanent change still applies now AND going forward, so it must use the live indices so it takes effect on the exercise in front of the user immediately. Use the program-context indices only for changes to a DIFFERENT day the user isn't currently training. ALWAYS also set current_exercise to the EXACT current name of the exercise you are changing (for replace/adjust/remove) — the app uses that name to place the edit on the correct slot, so never omit it.
10. Never propose an exercise that already appears on the same day. Check the program context first.
11. Always include a one-sentence text reply alongside any tool call confirming what you changed (e.g. "Replaced walking lunges with Bulgarian split squats for more quad focus."). Never return a tool call with no text.
12. When changing MULTIPLE slots in one reply, vary your choices — do NOT propose the same replacement exercise for more than one slot unless the user explicitly named that exact exercise. Pick different evidence-based options so the program keeps variety across days (e.g. Bulgarian split squat on one day, hack squat or leg press on another).
13. You are their ongoing coach with memory. Anything already known about the user is provided under "What I remember about you" — honour it without being told again (don't re-program a disliked exercise, account for stated injuries in your advice). When the user reveals a durable fact — a disliked exercise, an injury/limitation, a preference, or a goal — call remember_fact to record it (alongside your normal reply). Do not announce that you're saving it.
14. Ground every anatomical or biomechanical claim in the RESEARCH REFERENCE above. Do NOT invent muscle-targeting or movement-direction claims — if the reference doesn't support a specific region/mechanism, keep the rationale general (e.g. "a constant-tension cable fly for the chest") rather than fabricating which region it hits. Getting movement direction backwards (e.g. claiming a low-to-high fly targets the lower chest) is a serious error — re-check the CHEST REGION TARGETING rules before citing a region.
15. IF an "AVAILABLE EXERCISES" list is present in the user's data: exercise_name in ANY propose_program_change OR suggest_exercise_alternatives call MUST be copied verbatim from that list — never invent, rename, abbreviate, or paraphrase a name; if nothing in the list fits, do not propose a change and say what's missing. The list is equipment-filtered and its names encode the target region, so match the request to the correct listed name (e.g. for "lower chest cable fly" choose "Cable crossover (lower chest)", never a made-up "low to high" fly). IF no such list is present, use only standard, real exercise names and apply the CHEST REGION TARGETING rules so you never name a movement that doesn't exist or target the wrong region.

RESEARCH REFERENCE:
${SCIENCE_REFERENCE}`;

// Appended as an extra (uncached) system block only for the weekly review, so the
// main cached SYSTEM_PROMPT prefix still hits. Overrides the 120-word limit and
// tools for this one reply.
const WEEKLY_SUMMARY_DIRECTIVE = `This request is the user's WEEKLY REVIEW. For THIS reply only, ignore rule 5's 120-word limit and do NOT call any tool. Write a 150–220 word narrative review of the user's PAST TRAINING WEEK from their data: open with the single most important takeaway, then what they did well, the biggest gap versus the research volume targets, a note on recovery if that data is present, and end with one concrete focus for next week. Plain text, second person ("you"), no markdown, no headers, no bullet lists. Be specific with their real numbers and never invent data that isn't provided.`;

// Maps a stored language code to its English name for the model directive.
// English (and any unknown code) returns null → no directive, default behaviour.
const LANGUAGE_NAMES: Record<string, string> = { es: 'Spanish', de: 'German', fr: 'French', it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese (Simplified)' };

function languageDirective(code: string | null | undefined): string | null {
  const name = code ? LANGUAGE_NAMES[code] : null;
  if (!name) return null;
  // Exercise names must stay verbatim — they're matched against the equipment-filtered
  // AVAILABLE EXERCISES list and written into tool calls, which the app looks up by name.
  return `Write your entire text reply to the user in ${name}. However, keep all exercise names and any exercise_name values in tool calls EXACTLY as they appear in the user's data (do not translate exercise names).`;
}

// Tool definition — Claude uses this to return structured program proposals.
// Two types:
//   permanent_edit — persists across all future sessions (written to program_template_overrides)
//   session_swap   — one-off for the next session only (written to program_template_overrides with is_one_time flag)
//   add_exercise   — adds a new exercise slot to a day (written to program_additions)
const TOOLS = [
  {
    name: 'propose_program_change',
    description: 'Propose a specific change to the training program. Only call this when the user explicitly asks to add, remove, replace, or change an exercise or sets/reps in their program. Call once per exercise that needs changing.',
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
          description: '0-based index of the exercise to change or replace, as shown in [brackets] in the program context. Required for permanent_edit and session_swap.',
        },
        exercise_name: {
          type: 'string',
          description: 'Name of the exercise to add or replace with.',
        },
        current_exercise: {
          type: 'string',
          description: 'REQUIRED for replace/adjust/remove edits: the EXACT current name of the exercise being changed, copied verbatim from the program / live-session context. The app relocates the edit to the slot with this name, so a mis-counted exercise_index can never change the wrong exercise.',
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
      required: ['type', 'edit_type', 'day_id', 'exercise_index', 'rationale', 'scope_label'],
    },
  },
  {
    name: 'suggest_exercise_alternatives',
    description: 'When the user asks to CHANGE / REPLACE / SWAP an exercise without naming a specific replacement, call this ONCE to offer ranked, research-backed alternatives for that ONE exercise slot. Never ask which exercise (use the current/live exercise) and never ask what to replace it with — return the options directly. Order them best-first. Use propose_program_change instead only when the user explicitly names the replacement, or for sets/reps/rpe changes, additions, or removals.',
    input_schema: {
      type: 'object',
      properties: {
        day_id: { type: 'string', description: 'The day ID the exercise is on (from the program or live session context).' },
        day_name: { type: 'string', description: 'Human-readable day name.' },
        exercise_index: { type: 'integer', description: '0-based index of the exercise being replaced, from the [brackets] in the context (live-session indices when mid-workout).' },
        current_exercise: { type: 'string', description: 'The exact name of the exercise being replaced.' },
        alternatives: {
          type: 'array',
          description: 'Ranked best-first. Give 3 options (2 minimum).',
          items: {
            type: 'object',
            properties: {
              exercise_name: { type: 'string', description: 'Copied VERBATIM from AVAILABLE EXERCISES. Never invented or renamed.' },
              rationale: { type: 'string', description: 'One short sentence, grounded in the EVIDENCE BASE / RESEARCH REFERENCE, on why this ranks where it does (cite a specific mechanism or number).' },
            },
            required: ['exercise_name', 'rationale'],
          },
        },
      },
      required: ['day_id', 'exercise_index', 'alternatives'],
    },
  },
  {
    name: 'remember_fact',
    description: 'Record a durable fact about the user that a personal trainer would note and recall in future sessions — a disliked exercise, an injury or physical limitation, a training preference, or a stated goal. Call this whenever the user reveals such a thing (e.g. "I hate lunges", "my left knee hurts on squats", "I prefer dumbbells", "I want visible abs by summer"). Do NOT call it for transient questions or small talk. You may call it alongside answering normally.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['dislike', 'injury', 'preference', 'goal'],
          description: 'dislike: an exercise/movement they dislike. injury: a pain, injury, or physical limitation. preference: an equipment/style preference. goal: a stated objective.',
        },
        summary: {
          type: 'string',
          description: 'A short third-person fact, e.g. "Dislikes walking lunges", "Left knee pain on deep squats", "Prefers dumbbells over barbell", "Wants visible abs by August".',
        },
        exercise_name: {
          type: 'string',
          description: 'For a dislike of a specific exercise, the exact exercise name so it can be removed from programming.',
        },
      },
      required: ['category', 'summary'],
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

    // Prefer the new sb_secret_ key (set as SERVICE_SECRET_KEY); fall back to the
    // legacy auto-injected service_role key so nothing breaks during migration.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'unauthorised' }, 401);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ai_calls_used, ai_calls_reset_at, language, is_premium, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return json({ error: 'profile_not_found' }, 404);

    // The coach is a paid feature. Enforce it server-side too — the client paywall
    // can be bypassed by calling this function directly, and every call costs money.
    if (!profile.is_premium && !profile.is_admin) return json({ error: 'premium_required' }, 403);

    const langDirective = languageDirective(profile.language);

    const resetAt = new Date(profile.ai_calls_reset_at ?? 0);
    const now = new Date();
    let callsUsed: number = profile.ai_calls_used ?? 0;

    if (now.getUTCFullYear() !== resetAt.getUTCFullYear() || now.getUTCMonth() !== resetAt.getUTCMonth()) {
      await supabase.from('profiles')
        .update({ ai_calls_used: 0, ai_calls_reset_at: now.toISOString() })
        .eq('id', user.id);
      callsUsed = 0;
    }

    // Atomically reserve one monthly call (optimistic concurrency — closes the
    // TOCTOU where concurrent requests could all pass a plain read-then-check).
    // Returns the counter value it actually wrote, so the response reflects
    // reality even when concurrent requests raced past the initial read.
    const reservedSlot = await reserveCall(supabase, user.id, callsUsed, MONTHLY_QUOTA);
    if (reservedSlot === null) return json({ error: 'quota_exceeded', remaining: 0 }, 429);
    const reservedUsed: number = reservedSlot;

    const body = await req.json();
    const { userContext, messages: msgHistory, question, mode } = body;
    const isSummary = mode === 'weekly_summary';

    // Build the messages array for Claude.
    // The per-user context (program, evidence base, exercise menu, memory) is large
    // (~5k tokens) and mostly stable within a conversation, so we send it as its own
    // leading user block with a cache breakpoint. Turn 1 writes it to cache; turns 2+
    // read it at ~0.1x instead of full price. The client rebuilds userContext each
    // request, so it's always current — the cache simply hits when it's unchanged.
    // New clients send a messages array; old format sends a single question string.
    let claudeMessages: unknown[];

    const contextBlock = userContext
      ? {
          role: 'user',
          content: [
            { type: 'text', text: `My training data:\n${userContext}`, cache_control: { type: 'ephemeral' } },
          ],
        }
      : null;

    if (msgHistory?.length) {
      // Cached context first, then the verbatim conversation history. Adjacent
      // user turns are merged server-side, so the data sits ahead of the question.
      claudeMessages = contextBlock ? [contextBlock, ...msgHistory] : msgHistory;
    } else if (question?.trim()) {
      claudeMessages = contextBlock
        ? [contextBlock, { role: 'user', content: `Question: ${question}` }]
        : [{ role: 'user', content: question }];
    } else {
      await refundCall(supabase, user.id);
      return json({ error: 'missing_question' }, 400);
    }

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
        max_tokens: isSummary ? 600 : 1500,
        // Cached base prompt first (stable across users), then a small per-user
        // language directive as a separate uncached block so the cache still hits.
        // The weekly-review directive is likewise appended uncached (rare path).
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          ...(langDirective ? [{ type: 'text', text: langDirective }] : []),
          ...(isSummary ? [{ type: 'text', text: WEEKLY_SUMMARY_DIRECTIVE }] : []),
        ],
        messages: claudeMessages,
        // No tools for the weekly review — it's a narrative, not a program edit.
        ...(isSummary ? {} : { tools: TOOLS, tool_choice: { type: 'auto' } }),
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      console.error('Anthropic error:', errBody);
      await refundCall(supabase, user.id);
      return json({ error: 'ai_unavailable' }, 502);
    }

    const anthropicJson = await anthropicRes.json();

    // Extract text response and all program proposals (may be multiple per response).
    const textBlock = anthropicJson.content?.find((b: { type: string }) => b.type === 'text');
    const toolBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'propose_program_change'
    );

    const factBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'remember_fact'
    );

    // Ranked, research-backed replacement options for a single slot (one call).
    const altBlock = (anthropicJson.content ?? []).find(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'suggest_exercise_alternatives'
    );

    const text = textBlock?.text ?? '';
    const proposals = toolBlocks.map((b: { input: unknown }) => b.input);
    const facts = factBlocks.map((b: { input: unknown }) => b.input);
    const alternatives = altBlock?.input ?? null;

    // Call already reserved before the Anthropic request — nothing to increment here.
    return json({
      text,
      proposals,
      facts,
      alternatives,
      remaining: MONTHLY_QUOTA - reservedUsed,
      used: reservedUsed,
      quota: MONTHLY_QUOTA,
    });

  } catch (err) {
    console.error('ai-coach error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

// Atomically reserve one monthly call using optimistic concurrency.
// Each attempt re-reads the counter and only writes if unchanged since the read,
// so concurrent requests can never both claim the same slot.
// Returns the new counter value on success, or null when the quota is exhausted.
// deno-lint-ignore no-explicit-any
async function reserveCall(supabase: any, userId: string, known: number, limit: number): Promise<number | null> {
  let used = known;
  for (let i = 0; i < 6; i++) {
    if (used >= limit) return null;
    const { data } = await supabase
      .from('profiles')
      .update({ ai_calls_used: used + 1 })
      .eq('id', userId)
      .eq('ai_calls_used', used)
      .select('ai_calls_used');
    if (data && data.length > 0) return used + 1;
    const { data: cur } = await supabase.from('profiles').select('ai_calls_used').eq('id', userId).single();
    used = cur?.ai_calls_used ?? limit;
  }
  return null;
}

// Best-effort refund when the AI call fails after a slot was reserved.
// deno-lint-ignore no-explicit-any
async function refundCall(supabase: any, userId: string): Promise<void> {
  const { data: cur } = await supabase.from('profiles').select('ai_calls_used').eq('id', userId).single();
  const used = cur?.ai_calls_used ?? 0;
  if (used > 0) {
    await supabase.from('profiles').update({ ai_calls_used: used - 1 }).eq('id', userId).eq('ai_calls_used', used);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
