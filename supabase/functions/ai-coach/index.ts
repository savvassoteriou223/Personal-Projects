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
- Sleep 7–9h. Poor sleep + high soreness on the readiness check-in = train lighter.
- ~80% of cardio easy (Zone 2); heavy cardio same day as legs blunts strength (separate 6h+).
- Abs visible ~10–12% BF men / ~18–20% women — diet reveals them, not ab exercises.
`;

const SYSTEM_PROMPT = `You are the Helix AI Coach — a science-based strength and hypertrophy coach.

RULES:
1. Only answer questions about training, nutrition, body composition, and recovery.
2. If asked anything else, respond: "I'm your Helix coach — I can only help with training, nutrition, and recovery."
3. Ground all advice in the science. The user's data includes an "EVIDENCE BASE" — the app's own curated findings — which is your AUTHORITATIVE source: cite it, stay consistent with it, and prefer it over your own general knowledge. The RESEARCH REFERENCE below is supporting background. Never state a claim that contradicts the EVIDENCE BASE, and if a topic isn't covered by either, say it's outside the app's evidence rather than inventing specifics. Use specific numbers, not vague advice.
4. Name gaps explicitly when the user's data falls short of research targets.
5. Keep responses under 120 words. This is a hard ceiling, not a target — it applies just as much to a broad question ("explain progressive overload over the next 3 months") as a narrow one. When a full answer would run long, give the single most actionable point and stop; do not compress a complete answer into dense prose to squeeze under the limit. Plain text only — no markdown, bullets, or headers.
6. Be direct. No padding or encouragement.
7. Exercise changes — pick the right tool, and NEVER interrogate:
   - BEFORE any change, alternative, or suggestion: establish what you are changing. Read the slot's [group] tag, its sets and reps, whether it is marked "SOLE slot" for its group, and what the group contributes to the user's stated goal and weekly volume targets. A replacement answers "what does this slot exist to do?" — never "what is a similar exercise?". Your rationale must reflect that role.
   - If the user asks to CHANGE / REPLACE / SWAP an exercise but does NOT name a specific replacement — call suggest_exercise_alternatives ONCE with 3 ranked, research-backed options (best first) for that one slot. Do not ask which exercise (use the current/live one) and do not ask what to replace it with. "you pick" / "I don't know" / "you decide" also means: return ranked alternatives.
   - If the user NAMES the replacement (e.g. "swap X for Y"), or asks to ADD or REMOVE an exercise, or to change sets/reps/rpe — use propose_program_change with a specific concrete change in the SAME reply.
   - If the user asks for MORE emphasis/focus on a muscle without naming a specific exercise, check its line in "This week's volume" first: if it is below optimal, prefer propose_program_change with edit_type adjust_sets on the muscle's existing slot(s) — raise sets toward optimal_high. More volume is what closes a volume gap, not a "better" exercise. Only reach for suggest_exercise_alternatives here if that muscle's volume is already at or above optimal, so there's no room left to add sets.
   - Your text reply must still name the actual ranked options in prose (e.g. "Best options: Leg curl, then Nordic curl, then Romanian deadlift") — never rely only on the structured card. The card is UI-only state that doesn't survive the app closing and reopening; only your text is saved to memory, so a reply like "here are your options:" with nothing else becomes a dangling, meaningless sentence once the card is gone. Keep it to one sentence, just make that sentence self-contained.
7a. CRITICAL — never ask the user which exercise OR whether the change is one-time vs permanent:
   - WHICH exercise: if a live workout's "Current exercise" is shown in the data and the user says "this exercise", "this one", "change this", "swap this", etc., they mean that CURRENT exercise — propose for it immediately, never ask which. Only ask if there is genuinely no current exercise and the request names none.
   - ONE-TIME vs PERMANENT: NEVER ask this. The app shows the user a "Just this workout / All future" choice when they tap Apply, so it is not your job to ask. Always just propose the change (use type permanent_edit by default; only use session_swap if the user themselves explicitly said "just today"/"one time"). Do not mention scope in your text reply.
7b. CRITICAL — a replacement STAYS IN THE SAME MOVEMENT PATTERN. Every exercise in the program and live-session context is tagged with its pattern group in [brackets], and AVAILABLE EXERCISES is grouped by those same labels. The group is the training slot: the program allocated a set count to that specific region, so leaving the group silently deletes it. Read the current exercise's [tag] first, then pick only from that group.
   - "Chest — Decline / Lower Chest", "Chest — Incline Push (Upper Chest)" and "Chest — Horizontal Push" are three DIFFERENT slots. Offering a flat barbell/dumbbell/machine bench press as an alternative to a decline press is WRONG — it drops the day's lower-chest work entirely. The same applies to every family: vertical vs horizontal pull, side vs rear delt, quad vs hamstring.
   - The muscle worked is NOT the test. Two exercises hitting "chest" are not interchangeable if they sit in different groups.
   - Cross groups ONLY if the user explicitly asks for a different movement, or every option in the group is unavailable (equipment, injury, disliked). When you do, say so plainly in your reply ("nothing else in your decline options works with dumbbells only, so this moves the slot to flat pressing").
   - Every deliberate crossing MUST also set pattern_change_reason on the propose_program_change call — the app REJECTS cross-group replacements that do not declare it. A slot marked "SOLE slot" deserves extra weight: leaving its group means the user stops training that region entirely, so say that consequence out loud before doing it.
   - Naming a specific exercise that happens to sit in a different group (e.g. "replace my decline press with an incline dumbbell press") DOES count as explicitly asking for a different movement — proceed with propose_program_change, set pattern_change_reason, and state the tradeoff in your text reply. The ONE exception: if the slot is marked "SOLE slot" for its group AND the replacement CROSSES into a different group, that specific combination is the one case rule 8 permits a clarifying/confirming question instead of acting immediately. This exception is narrow — it does NOT extend to a same-group replacement of a SOLE slot (still act immediately, same as any other swap), and it does NOT extend to REMOVING a SOLE slot with no replacement named (rule 11's example — "Dropping the lateral raise removes your only side delt work..." — is the correct pattern there: state the consequence in the text of the propose_program_change reply, do not ask permission first).
7c. "The workout" / "today's workout" / "my workout" with NO day named means the day marked "Next scheduled session" in the context — act on that one day, not the whole program. Do not just describe a plan in text and ask permission ("Want me to make those changes?") — that is a question, not an action, and rule 8 only permits one narrow exception to "otherwise, act". Call propose_program_change with the concrete edits (e.g. remove_exercise on the lowest-priority slots) in the same reply.
8. Ask AT MOST one short clarifying question, and only if you genuinely cannot act without it (e.g. you don't know which of two identical-named exercises they mean), or for the narrow SOLE-slot-crossing-group case carved out in rule 7b. Otherwise, act — this includes removing a SOLE slot, which still gets an immediate propose_program_change with the consequence stated in text, never a question. Never ask more than one question before proposing.
9. When replacing or changing N exercises, call propose_program_change exactly N times — one call per exercise. You MUST set day_id AND exercise_index for every call, taken from the [index] number shown for that exercise in the program context — never omit them or guess. Always include exercise_name with the exact name of the replacement exercise. EXCEPTION: whenever a live session section is present and the change targets an exercise in that session, take day_id and exercise_index from the live session's exercise list — for BOTH one-off ("just this workout") AND permanent ("now & all future") changes. A permanent change still applies now AND going forward, so it must use the live indices so it takes effect on the exercise in front of the user immediately. Use the program-context indices only for changes to a DIFFERENT day the user isn't currently training. ALWAYS also set current_exercise to the EXACT current name of the exercise you are changing (for replace/adjust/remove) — the app uses that name to place the edit on the correct slot, so never omit it.
   - When a constraint applies across MULTIPLE slots (an equipment limitation for a trip, an injury affecting several movement patterns, "swap all my X") — call declare_change_scope FIRST, listing EVERY affected slot on EVERY day, then call propose_program_change once per slot, working through the days in order. Read the whole program listing before declaring: a 3-day program with barbell work on all 3 days and a "no barbell" constraint is e.g. 3 + 2 + 2 = 7 slots, not 3. The declared list is a checklist the app verifies against, and it will prompt you to continue until every slot on it is actually proposed — so declare completely even if you cannot fit every propose_program_change into one reply. Never describe your text reply's scope more broadly than what the tool calls actually cover — if you say "across all three days," every one of those days must have a corresponding tool call, or say only what you actually changed.
10. Never propose an exercise that already appears on the same day. Check the program context first.
11. Always include a text reply alongside ANY tool call — propose_program_change, suggest_exercise_alternatives, AND remember_fact, every time, with no exceptions. An empty text field is never correct, even when the tool call itself seems self-explanatory. Concretely: propose_program_change → one sentence confirming what changed ("Replaced walking lunges with Bulgarian split squats for more quad focus."), or for a SOLE-slot removal, the consequence stated plainly ("Dropping the lateral raise removes your only side delt work — you'll be at 0 sets against an 8-set minimum."); suggest_exercise_alternatives → one self-contained sentence naming the ranked options (rule 7); remember_fact called alone (nothing else asked) → still answer whatever the user actually said, don't let the silent save be your whole response. The structured tool output is UI-only state that vanishes when the app closes — your text is the only part that survives into memory, so a blank text field turns this whole turn into nothing once the card is gone.
12. When changing MULTIPLE slots in one reply, vary your choices — do NOT propose the same replacement exercise for more than one slot unless the user explicitly named that exact exercise. Pick different evidence-based options so the program keeps variety across days (e.g. Bulgarian split squat on one day, hack squat or leg press on another).
13. You are their ongoing coach with memory. Anything already known about the user is provided under "What I remember about you" — honour it without being told again (don't re-program a disliked exercise, account for stated injuries in your advice). When the user reveals a durable fact — a disliked exercise, an injury/limitation, a preference, or a goal — call remember_fact to record it (alongside your normal reply). Do not announce that you're saving it.
13a. remember_fact is NEVER a sufficient response on its own when the fact makes exercises currently in the program unusable — losing access to equipment, an injury that rules out a movement, a newly stated dislike of a programmed exercise. Recording "no barbell for two weeks" and stopping there leaves the user holding a program they cannot perform: the fact is saved and nothing is fixed. In that case record the fact AND fix the program in the same reply — declare_change_scope for every affected slot, then propose_program_change for each. Saving a fact is bookkeeping, not an action.
14. Ground every anatomical or biomechanical claim in the RESEARCH REFERENCE above. Do NOT invent muscle-targeting or movement-direction claims — if the reference doesn't support a specific region/mechanism, keep the rationale general (e.g. "a constant-tension cable fly for the chest") rather than fabricating which region it hits. Getting movement direction backwards (e.g. claiming a low-to-high fly targets the lower chest) is a serious error — re-check the CHEST REGION TARGETING rules before citing a region.
15. IF an "AVAILABLE EXERCISES" list is present in the user's data: exercise_name in ANY propose_program_change OR suggest_exercise_alternatives call MUST be copied verbatim from that list — never invent, rename, abbreviate, or paraphrase a name; if nothing in the list fits, do not propose a change and say what's missing. The list is equipment-filtered and its names encode the target region, so match the request to the correct listed name (e.g. for "lower chest cable fly" choose "Cable crossover (lower chest)", never a made-up "low to high" fly). IF no such list is present, use only standard, real exercise names and apply the CHEST REGION TARGETING rules so you never name a movement that doesn't exist or target the wrong region.

RESEARCH REFERENCE:
${SCIENCE_REFERENCE}`;

// Appended as an extra (uncached) system block only for the weekly review, so the
// main cached SYSTEM_PROMPT prefix still hits. Overrides the 120-word limit and
// tools for this one reply.
const WEEKLY_SUMMARY_DIRECTIVE = `This request is the user's WEEKLY REVIEW. Do NOT call any tool. The app renders their volume, sessions and week-over-week numbers as CHARTS directly above your text, so do not list or restate numbers — they are already on screen. Write 50-80 words, plain text, second person (\"you\"), no markdown, no headers, no bullets. Two things only: WHY the week looked the way it did, and the ONE thing to change next week. Never mention HRV, heart rate, step count or any device-measured metric \u2014 the app collects none of them, so referring to them invents data. Sleep may only be discussed as the user SELF-REPORTED it in a readiness check-in, never as measured hours. Never invent data that isn't provided.`;

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

// The user's profile.trainingExperience already reaches the model as a fact in
// buildContext's "Experience:" line — but a fact sitting in the data isn't an
// instruction, and nothing told the model to change its OWN language because of
// it. It kept citing "mechanism", "region", set/rep science, and movement-pattern
// names as if talking to someone who already lifts. A beginner asking "why does
// my chest hurt today" doesn't need EMG-activation language; they need an answer
// they can act on. This only fires for beginners — intermediate/advanced get the
// existing register unchanged, since they're not who this is fixing.
function experienceDirective(level: string | null | undefined): string | null {
  if (level !== 'beginner') return null;
  return `This user is a BEGINNER — do not assume gym vocabulary. Before using a term a
first-timer might not know (RPE, deload, movement pattern, hypertrophy, eccentric,
progressive overload, a named lift they haven't done), either replace it with a plain
description or define it in the same sentence, briefly. Never cite a mechanism or a
study to a beginner as the reason for something ("EMG activation", "stretch-mediated
hypertrophy") — give the practical, felt-experience reason instead ("this works your
chest through a longer stretch, which research shows grows it faster" beats naming the
mechanism). Stay encouraging, not clinical. The 120-word cap and one-sentence-per-tool-call
rules still apply — plain language, not more words.`;
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
          enum: ['permanent_edit', 'session_swap'],
          // 'add_exercise' used to be a third option here too, duplicating
          // edit_type — an addition is naturally BOTH type:'permanent_edit'
          // (it lasts) AND edit_type:'add_exercise' (what it does), and the
          // app used to trust only one of those signals at the point that
          // mattered: it silently overwrote an existing exercise instead of
          // adding a new one. Scope goes ONLY here now; the action (add,
          // replace, adjust, remove) goes ONLY in edit_type below — never both.
          description: 'Scope only: permanent_edit changes every future session, session_swap is one-off for the next session only. This is unrelated to WHAT the edit does — that is edit_type.',
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
          description: 'For replace/adjust/remove: 0-based index of the exercise being changed, as shown in [brackets] in the program context. NOT USED for edit_type add_exercise (a new slot has no index yet) — send 0 and it will be ignored.',
        },
        exercise_name: {
          type: 'string',
          description: 'Name of the exercise to add or replace with.',
        },
        current_exercise: {
          type: 'string',
          description: 'REQUIRED for replace/adjust/remove edits: the EXACT current name of the exercise being changed, copied verbatim from the program / live-session context. The app relocates the edit to the slot with this name, so a mis-counted exercise_index can never change the wrong exercise.',
        },
        slot_pattern_label: {
          type: 'string',
          description: 'The [group] tag of the slot being changed, copied verbatim from the program / live-session context (for add_exercise: the group of the exercise being added). Fill this FIRST — it is your statement of what the slot exists to do, and the replacement, sets, and rationale must all be consistent with it.',
        },
        pattern_change_reason: {
          type: 'string',
          description: 'REQUIRED whenever a replacement belongs to a DIFFERENT group than the slot it replaces. One sentence: why the slot is deliberately leaving its group (the user explicitly asked for a different movement, or nothing in the group is usable with their equipment / injuries). The app REJECTS cross-group replacements without this field. Never use it to excuse an accidental cross — pick an in-group exercise instead.',
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
      required: ['type', 'edit_type', 'day_id', 'exercise_index', 'slot_pattern_label', 'rationale', 'scope_label'],
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
        pattern_label: {
          type: 'string',
          description: 'The movement-pattern group the exercise being replaced belongs to, copied verbatim from its [tag] in the program / live-session context (e.g. "Chest — Decline / Lower Chest"). State it here BEFORE choosing options: every alternative must come from this same group in AVAILABLE EXERCISES.',
        },
        alternatives: {
          type: 'array',
          description: 'Ranked best-first. Give 3 options (2 minimum). ALL of them must come from the pattern_label group — a decline/lower-chest slot gets decline and lower-chest options, never flat or incline bench variants.',
          items: {
            type: 'object',
            properties: {
              exercise_name: { type: 'string', description: 'Copied VERBATIM from AVAILABLE EXERCISES, and from the SAME group as pattern_label. Never invented or renamed.' },
              rationale: { type: 'string', description: 'One short sentence, grounded in the EVIDENCE BASE / RESEARCH REFERENCE, on why this ranks where it does (cite a specific mechanism or number).' },
            },
            required: ['exercise_name', 'rationale'],
          },
        },
      },
      required: ['day_id', 'exercise_index', 'pattern_label', 'alternatives'],
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
  {
    name: 'declare_change_scope',
    // Behavioral testing showed the model is RELIABLE at identifying every
    // affected slot (it enumerated all 7 correctly in prose: "Full Body A:
    // squat [0], bench [1], row [2]... that's 7 barbell slots across 3 days")
    // but UNRELIABLE at then emitting a propose_program_change for each one in
    // a single turn — it consistently stopped after the first day. Capturing
    // that enumeration structurally turns an unverifiable one-shot into a
    // checklist the server can drive to completion and verify against.
    description: 'Call this FIRST, before any propose_program_change, whenever ONE user request affects MORE THAN ONE exercise slot — an equipment limitation for a trip, an injury affecting several movement patterns, "swap all my X", "make everything shorter". List EVERY affected slot across EVERY day of the program, including days the user is not training next: a constraint that spans the week affects all of them. This is a checklist, not a change — you must still call propose_program_change once per slot. The app verifies your proposals against this list and will prompt you to continue until every declared slot is actually done, so an accurate list here is what lets a multi-day request finish properly. ALWAYS also set whichever of excluded_equipment / excluded_patterns / excluded_exercises describes what triggered the sweep: the app cross-checks those against the {equip:...} and {pat:...} tags on every slot in the program and adds anything your list missed, which is what makes the sweep reliable. Do NOT call this for a single-slot change.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Short phrase for what triggered the sweep, e.g. "no barbell for 2 weeks", "shoulder pain on overhead pressing".',
        },
        excluded_equipment: {
          type: 'array',
          items: { type: 'string' },
          description: 'Set when the sweep is caused by equipment the user no longer has: the equipment keys they lose, copied from the {equip:...} tags in the program listing (e.g. ["barbell"]).',
        },
        excluded_patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Set when the sweep is caused by a movement the user must stop doing — an injury or pain that rules out a whole pattern rather than one exercise. Use the pattern keys from the {pat:...} tags in the program listing (e.g. ["shoulders_vertical_push"]).',
        },
        excluded_exercises: {
          type: 'array',
          items: { type: 'string' },
          description: 'Set when the sweep targets specific exercises wherever they appear — a stated dislike, or "swap all my X". Exact exercise names as they appear in the program listing (e.g. ["Walking lunge (long stride)"]).',
        },
        slots: {
          type: 'array',
          description: 'Every slot that must change, across every affected day. Read the full program listing before filling this in — an incomplete list means the user silently keeps exercises they cannot do.',
          items: {
            type: 'object',
            properties: {
              day_id: { type: 'string', description: 'The day ID exactly as shown in the program context.' },
              exercise_index: { type: 'integer', description: 'The [index] number shown for that exercise.' },
              current_exercise: { type: 'string', description: 'Exact current name of the exercise in that slot.' },
            },
            required: ['day_id', 'exercise_index', 'current_exercise'],
          },
        },
      },
      required: ['reason', 'slots'],
    },
  },
  {
    name: 'compact_workout',
    // Time pressure is the most common reason a session gets skipped entirely,
    // and the honest answer is a shorter session rather than a missed one. This
    // is a scale-down of what is already programmed — never a re-selection —
    // so it does not go through propose_program_change and does not touch the
    // stored program. It expires on its own: today's trim is today's only.
    description: 'Turn on COMPACT MODE — trim a session to the minimum volume that still counts — when the user says they are short on time — "I only have 30 minutes", "can we make today quick", "I need to be out in an hour", "no time today". Keeps every exercise and cuts sets: compounds drop by one but never below 2, isolation caps at 2. Use scope "today" for a single session (the default — a busy day is usually one day) and "week" only when they say their whole week is compressed. This does NOT change their program: it is a one-off trim, so do not call propose_program_change for it. Call it compact mode when you tell them, matching what the app calls it. Tell them plainly what it costs — it is the minimum that maintains, not the volume that builds fastest. If instead they want a permanently shorter program, that IS a program change and belongs in propose_program_change.',
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['today', 'week'],
          description: 'today: trim the next session only. week: trim every training day this week. Default to today unless they clearly mean the whole week.',
        },
        reason: {
          type: 'string',
          description: 'Short phrase in their own terms, e.g. "only 30 minutes today", "travelling all week".',
        },
      },
      required: ['scope'],
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
      .select('ai_calls_used, ai_calls_reset_at, language, is_premium, is_admin, "trainingExperience"')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return json({ error: 'profile_not_found' }, 404);

    // The coach is a paid feature. Enforce it server-side too — the client paywall
    // can be bypassed by calling this function directly, and every call costs money.
    if (!profile.is_premium && !profile.is_admin) return json({ error: 'premium_required' }, 403);

    const langDirective = languageDirective(profile.language);
    const expDirective = experienceDirective(profile.trainingExperience);

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

    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    };
    const anthropicSystem = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ...(langDirective ? [{ type: 'text', text: langDirective }] : []),
      ...(expDirective ? [{ type: 'text', text: expDirective }] : []),
      ...(isSummary ? [{ type: 'text', text: WEEKLY_SUMMARY_DIRECTIVE }] : []),
    ];
    // No tools for the weekly review — it's a narrative, not a program edit.
    // No tools either when contextBlock is missing: propose_program_change and
    // suggest_exercise_alternatives both require the [index]/[brackets] data
    // that lives in userContext (day_id, exercise_index, pattern group). Without
    // it a client-side hiccup (auth refresh mid-conversation, a failed fetch)
    // would otherwise leave the model free to call those tools with a guessed
    // or hallucinated index — silently editing the wrong exercise slot. A
    // context-less turn gets a plain, ungrounded text answer instead.
    const anthropicTools = (isSummary || !contextBlock) ? {} : { tools: TOOLS, tool_choice: { type: 'auto' } };

    // Per-REQUEST usage accounting. One user message can fan out into many
    // model calls while costing the user a single quota unit, so the only
    // number that reflects real spend is the sum across every call this
    // request made — not any individual response's usage block.
    const spend = { calls: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };

    async function callAnthropic(messages: unknown[]) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          // Raised from 1500: a declare_change_scope listing every slot in a
          // 6-day split, plus the propose_program_change calls in the same
          // turn, does not fit in 1500 — and a truncated turn is what the
          // completion loop then has to spend extra round trips recovering.
          // Only generated tokens are billed, so the common short reply is
          // unaffected by the higher ceiling.
          max_tokens: isSummary ? 600 : 3000,
          system: anthropicSystem,
          messages,
          ...anthropicTools,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('Anthropic error:', errBody);
        return null;
      }
      const parsed = await res.json();
      const u = parsed?.usage ?? {};
      spend.calls += 1;
      spend.input += u.input_tokens ?? 0;
      spend.cacheWrite += u.cache_creation_input_tokens ?? 0;
      spend.cacheRead += u.cache_read_input_tokens ?? 0;
      spend.output += u.output_tokens ?? 0;
      return parsed;
    }

    const anthropicJson = await callAnthropic(claudeMessages);
    if (!anthropicJson) {
      await refundCall(supabase, user.id);
      return json({ error: 'ai_unavailable' }, 502);
    }

    // Extract text response and all program proposals (may be multiple per response).
    let textBlock = anthropicJson.content?.find((b: { type: string }) => b.type === 'text');
    let toolBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'propose_program_change'
    );

    let factBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'remember_fact'
    );

    // Ranked, research-backed replacement options. Rule 7 asks for ONE call per
    // slot, but rule 12 explicitly anticipates multiple slots changing in one
    // reply — "change both my curls, you pick" correctly produces two separate
    // suggest_exercise_alternatives calls, one per slot. This used to be
    // extracted with .find() (singular): behavioral testing caught that the
    // SECOND slot's alternatives were silently discarded before the response
    // even left the server — the user asked for two things and only ever saw
    // one, with no error and no explanation. Collecting all of them is the fix.
    let altBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'suggest_exercise_alternatives'
    );

    let scopeBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'declare_change_scope'
    );

    // A trim is not a program edit — the client applies it to the session it is
    // about to run and forgets it. Passed straight through rather than going
    // near the proposal validation, which exists to protect the STORED program.
    let compactBlocks = (anthropicJson.content ?? []).filter(
      (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'compact_workout'
    );

    // A propose_program_change missing day_id (or a non-add edit missing
    // exercise_index) cannot identify a slot. Live testing produced these
    // intermittently. Dropping them here means malformed calls never reach the
    // client, never become an "Apply" card, and never get counted as covering
    // a slot they don't actually identify.
    // Mirrors lib/proposalValidation.js on the client (kept as independent
    // copies so a version skew between deployed function and shipped app
    // can't reopen the hole). A replace/add with no exercise_name names
    // nothing to change TO and fails silently on Apply.
    const isApplicable = (p: { day_id?: string; edit_type?: string; exercise_index?: number; exercise_name?: string }) => {
      if (!p?.day_id || !p?.edit_type) return false;
      if (p.edit_type === 'add_exercise') return !!p.exercise_name;
      if (p.edit_type === 'replace_exercise' && !p.exercise_name) return false;
      return Number.isInteger(p.exercise_index);
    };

    let proposals = toolBlocks.map((b: { input: unknown }) => b.input).filter(isApplicable);
    let facts = factBlocks.map((b: { input: unknown }) => b.input);
    let alternatives = altBlocks.map((b: { input: unknown }) => b.input);
    // The model's own checklist of every slot this request must touch. Its
    // presence is what upgrades the completion loop from day-level to
    // slot-level: without it the server only knows which days were touched,
    // not whether every affected slot ON those days is actually done.
    type Slot = { day_id: string; exercise_index: number; current_exercise?: string };

    // Every slot in the program with its equipment, parsed from the {equip:...}
    // tags the client emits on each exercise line. This is the server's own
    // view of the program — it does not depend on the model noticing anything.
    type ProgramSlot = { day_id: string; exercise_index: number; name: string; equip: string[]; pattern: string };
    const parseProgramSlots = (ctx: string): ProgramSlot[] => {
      const out: ProgramSlot[] = [];
      let currentDay: string | null = null;
      for (const line of ctx.split('\n')) {
        const dayMatch = line.match(/^ {2}(\S+) — .*:$/);
        if (dayMatch) { currentDay = dayMatch[1]; continue; }
        const exMatch = line.match(/^ {4}\[(\d+)\] (.+?) \[.*?\] \([^)]*\)(.*)$/);
        if (exMatch && currentDay) {
          const trailing = exMatch[3] || '';
          out.push({
            day_id: currentDay,
            exercise_index: Number(exMatch[1]),
            name: exMatch[2].trim(),
            equip: (trailing.match(/\{equip:([^}]*)\}/)?.[1] || '').split('+').filter(Boolean),
            pattern: trailing.match(/\{pat:([^}]*)\}/)?.[1] || '',
          });
        }
      }
      return out;
    };
    const programSlots = parseProgramSlots(typeof userContext === 'string' ? userContext : '');

    // The newest thing the user actually typed. The current client posts a
    // `messages` history; `question` is only set by the legacy single-string
    // format, so reading it alone yields '' in production.
    const lastUserContent = Array.isArray(msgHistory)
      ? [...msgHistory].reverse().find((m: { role?: string }) => m?.role === 'user')?.content
      : null;
    const askedText = String(
      typeof lastUserContent === 'string'
        ? lastUserContent
        : Array.isArray(lastUserContent)
          ? lastUserContent.map((b: { text?: string }) => b?.text ?? '').join(' ')
          : (question ?? '')
    ).toLowerCase();

    // Equipment the user says they have LOST, read from their own words rather
    // than from the model remembering to set excluded_equipment. That field is
    // optional and the model skips it, which left the server trusting a
    // hand-written slot list — a real sweep reported "4 exercises across 4
    // days" while a barbell Romanian deadlift stayed in the Legs day.
    //
    // Deliberately conservative: only a negation immediately followed by the
    // equipment word counts. "no barbell" and "without a barbell" derive an
    // exclusion; "only dumbbells" does NOT (it names what is still available,
    // and treating it as a loss would swap out the wrong half of the program).
    const NEGATED_EQUIPMENT = /\b(?:no|without|don'?t have|do not have|haven'?t got|have no|cannot use|can'?t use|lost (?:my|the)?)\s+(?:a|an|any|my|the)?\s*([a-z][a-z-]{2,})/g;
    const serverExcludedEquipment: string[] = [];
    for (const m of askedText.matchAll(NEGATED_EQUIPMENT)) {
      const word = m[1];
      for (const tag of new Set(programSlots.flatMap(s => s.equip.map(e => e.toLowerCase())))) {
        const stem = tag.replace(/s$/, '');
        if (stem.length > 3 && (word === tag || word === stem || word.startsWith(stem))) {
          serverExcludedEquipment.push(tag);
        }
      }
    }

    // Same treatment for the other two sweep triggers. excluded_exercises and
    // excluded_patterns are as optional as excluded_equipment was, and the
    // model omits them just as readily — so an injury or a dislike would
    // silently fall back to whatever slot list it happened to write by hand.
    // When the user names an exercise that IS in their program and pairs it
    // with pain or refusal, every instance of that exercise (and, for pain,
    // the whole movement pattern) belongs on the checklist.
    // Vocabulary is deliberately colloquial: people report pain as "kills me",
    // "wrecks my knee", "plays up", not as "causes discomfort".
    const RULES_OUT = /\b(hurts?|hurting|pain(?:ful)?|sore|injur\w*|tweak\w*|kill(?:s|ing)?|wreck(?:s|ing)?|aggravat\w*|bother(?:s|ing)?|flar\w*|agony|plays up|hate|hated|can'?t do|cannot do|no more|stop doing|sick of|get rid of|avoid|don'?t want)\b/;
    const serverExcludedExercises: string[] = [];
    const serverExcludedPatterns: string[] = [];
    if (RULES_OUT.test(askedText)) {
      const painful = /\b(hurts?|hurting|pain(?:ful)?|sore|injur\w*|tweak\w*|kill(?:s|ing)?|wreck(?:s|ing)?|aggravat\w*|flar\w*|agony|plays up|can'?t do|cannot do)\b/.test(askedText);
      for (const s of programSlots) {
        const n = s.name.toLowerCase();
        // Match on the name minus any parenthetical qualifier, so "overhead
        // press" matches "Barbell overhead press" without needing the brand of
        // bar, but stay long enough not to collide on a single common word.
        const core = n.replace(/\([^)]*\)/g, '').trim();
        if (core.length > 6 && askedText.includes(core)) {
          serverExcludedExercises.push(s.name);
          if (painful && s.pattern) serverExcludedPatterns.push(s.pattern);
        }
      }
    }

    // Authoritative day_id -> display name, straight from the program listing.
    // day_name is an optional tool field and the parallel workers routinely
    // omit it, which leaked raw ids ("pull_a") into the user-facing summary.
    const dayNameById = new Map<string, string>();
    for (const line of (typeof userContext === 'string' ? userContext : '').split('\n')) {
      const m = line.match(/^ {2}(\S+) — (.*):$/);
      if (m) dayNameById.set(m[1], m[2].replace(/\s*\(optional day.*$/, '').trim());
    }

    // For an EQUIPMENT sweep the model's enumeration is advisory, not
    // authoritative: across repeated live runs of a 6-day split it reliably
    // named 14 of the 16 barbell slots, consistently missing two whose names
    // don't announce the equipment ("Incline bench row (wide grip / flared
    // elbows)"). Because the slot list was the model's own, the server had no
    // way to know two were absent and reported the sweep as complete. Deriving
    // the affected set from the {equip:...} tags instead makes it verifiable:
    // whatever the model listed, every slot needing the lost equipment is on
    // the checklist. Non-equipment sweeps (injury, preference) have no such
    // ground truth and still rely on the declaration alone.
    // deno-lint-ignore no-explicit-any
    const computeDeclaredSlots = (blocks: any[]): Slot[] => {
      const declaredRaw: Slot[] = (blocks
        .flatMap((b: { input?: { slots?: Slot[] } }) => b.input?.slots ?? []) as Slot[])
        .filter(s => !!s?.day_id && Number.isInteger(s?.exercise_index));

      const norm = (v: string) => String(v).toLowerCase().trim();
      // deno-lint-ignore no-explicit-any
      const collect = (key: string) => blocks
        .flatMap((b: any) => b?.input?.[key] ?? [])
        .map(norm)
        .filter(Boolean);
      // Union with what the user's own message implies, so a missing
      // excluded_equipment on the model's side cannot shrink the checklist.
      const excludedEquipment = [...new Set([...collect('excluded_equipment'), ...serverExcludedEquipment])];
      const excludedPatterns = [...new Set([...collect('excluded_patterns'), ...serverExcludedPatterns.map(p => p.toLowerCase())])];
      const excludedExercises = [...new Set([...collect('excluded_exercises'), ...serverExcludedExercises.map(e => e.toLowerCase())])];

      // Every axis a real sweep is ever keyed on, each checkable against the
      // program itself: equipment lost, a movement pattern ruled out by pain,
      // or a named exercise the user is done with. Whatever the model listed,
      // anything in the program matching the stated cause is on the checklist.
      const derived: Slot[] = (excludedEquipment.length || excludedPatterns.length || excludedExercises.length)
        ? programSlots
            .filter(s =>
              s.equip.some(e => excludedEquipment.includes(norm(e)))
              || (s.pattern && excludedPatterns.includes(norm(s.pattern)))
              || excludedExercises.includes(norm(s.name))
            )
            .map(s => ({ day_id: s.day_id, exercise_index: s.exercise_index, current_exercise: s.name }))
        : [];
      const equipmentDerived = derived;

      const seen = new Set(declaredRaw.map(s => `${s.day_id}#${s.exercise_index}`));
      return [
        ...declaredRaw,
        ...equipmentDerived.filter(s => !seen.has(`${s.day_id}#${s.exercise_index}`)),
      ];
    };

    let declaredSlots: Slot[] = computeDeclaredSlots(scopeBlocks);

    // Patterns the sweep itself rules out. Needed at fan-out time because they
    // invert rule 7b: normally a replacement must stay in the slot's group,
    // but when the GROUP is what the user can no longer do, staying in it
    // fixes nothing. Live testing caught exactly that — "my shoulder kills me
    // on overhead press" was answered with Machine shoulder press, which is
    // still overhead pressing.
    // Read lazily, not captured once: the salvage step below can REPLACE
    // scopeBlocks (the model's first turn is sometimes just a remember_fact,
    // and the declaration only arrives on the retry). Computing this eagerly
    // meant an injury sweep that came in via salvage always saw an empty list
    // and silently fell back to staying in-pattern.
    // deno-lint-ignore no-explicit-any
    const sweptPatterns = (): string[] => scopeBlocks
      .flatMap((b: any) => b?.input?.excluded_patterns ?? [])
      .map((p: string) => String(p).toLowerCase().trim())
      .filter(Boolean);
    const patternBySlotKey = new Map<string, string>(
      programSlots.map(s => [`${s.day_id}#${s.exercise_index}`, s.pattern])
    );

    // ── Multi-day completion loop ───────────────────────────────────────────
    // Rule 9's multi-day sweep clause (an equipment/injury constraint spanning
    // several sessions) does not reliably make the model exhaustive in one
    // turn — behavioral testing caught it claiming "across all three days" in
    // text while propose_program_change only ever touched the first day, even
    // with an explicit worked example in the prompt (3 attempts, all failed
    // the same way, confirmed NOT a token-budget cutoff via stop_reason).
    // Rather than trust one shot, the server now knows every day_id that
    // actually exists (parsed straight from userContext, independent of what
    // the model claims) and keeps asking it to continue — same tool_result
    // turn-taking a real client would do — until every day is covered, the
    // model stops proposing anything new, or a hard cap is hit.
    // Day header lines look like "  full_body_a — Full Body A:" — nothing
    // after the trailing colon (exercises are on the following indented
    // lines). The AVAILABLE EXERCISES block below uses the same 2-space "—"
    // format for its group labels (e.g. "  Quads — Squat Pattern: Barbell
    // back squat, ...") but always has exercise names after the colon on the
    // same line, never a bare trailing colon — that's what distinguishes them.
    const allDayIds = new Set(
      [...(typeof userContext === 'string' ? userContext : '').matchAll(/^ {2}(\S+) — .*:$/gm)].map(m => m[1])
    );
    const scopeClaimRe = /\ball\b[^.!?]{0,20}\bdays?\b|every (day|session)|across (all|every)/i;
    const slotKey = (s: { day_id?: string; exercise_index?: number }) => `${s.day_id}#${s.exercise_index}`;
    // Which slots still need a proposal. Prefers the model's declared checklist
    // (slot-level, the accurate answer); falls back to day-level coverage when
    // no scope was declared, which is all the server can infer on its own.
    const outstanding = () => {
      const proposedKeys = new Set(proposals.map(slotKey));
      if (declaredSlots.length) {
        return declaredSlots
          .filter(s => !proposedKeys.has(slotKey(s)))
          .map(s => `${s.day_id}[${s.exercise_index}] ${s.current_exercise ?? ''}`.trim());
      }
      const touchedDayIds = new Set([...proposals, ...alternatives].map((p: { day_id?: string }) => p?.day_id).filter(Boolean));
      return [...allDayIds].filter(d => !touchedDayIds.has(d));
    };
    let loopMessages = claudeMessages;
    let loopJson = anthropicJson;
    let continuationRan = false;

    // Salvage a defective first turn: the model sometimes answers a blocking
    // constraint ("no barbell where I'm going") by calling remember_fact and
    // NOTHING else — no text, no scope, no proposals. Live testing showed this
    // is non-deterministic: the identical request produced a full 14-proposal
    // sweep on one run and a bare fact-save on the next. The fact gets stored
    // and the user's program is left unusable, with a blank reply. A turn with
    // no text AND no edits is defective under rule 11 regardless of cause, so
    // it costs nothing to reject it and ask once for the real answer. Narrow by
    // construction: any turn that produced either text or an edit skips this.
    // Two shapes of the same failure, both seen live:
    //   (a) remember_fact and literally nothing else — no text at all.
    //   (b) remember_fact plus a friendly acknowledgement ("Got it, I'll keep
    //       barbell exercises out of your recommendations") and no program
    //       change. This one is worse: it READS as success, so the user
    //       believes their program was fixed and never checks.
    // The first version of this check only caught (a), because it required the
    // text to be empty — so (b) shipped to production and did exactly that.
    // A fact whose category implies a CONSTRAINT (an injury, a dislike, a
    // preference like losing equipment) is never adequately handled by saving
    // it alone: the exercises it rules out are still sitting in the program.
    // A plain 'goal' fact ("I want visible abs") legitimately needs no edit.
    const changedNothing = toolBlocks.length === 0 && altBlocks.length === 0 && scopeBlocks.length === 0;
    const savedConstraintFact = factBlocks.some(
      (b: { input?: { category?: string } }) => ['injury', 'dislike', 'preference'].includes(b.input?.category ?? '')
    );

    // Third shape of the same failure, and the one that survives the two guards
    // above: the constraint is ALREADY in memory, so the model calls no tool at
    // all and simply confirms — "Already noted, your program will avoid barbell
    // exercises." Nothing was saved and nothing was changed, so both a
    // fact-based and a text-based trigger miss it, and the exercises the user
    // cannot perform stay in the program indefinitely. Detected from the data
    // instead of the model's behaviour: if the user's own words name a piece of
    // equipment that some slot in their program still requires, and this turn
    // changed nothing, then the reply is wrong no matter how confident it reads.
    // Static vocabulary, NOT the {equip:...} tags in the context. Those tags
    // only exist in clients from v47 on, so keying off them meant every older
    // install silently lost this backstop — which is exactly how a real test
    // on v46 produced "your program already has barbell exercises that need
    // swapping. Want me to replace them now?" with nothing actually changed.
    // A server-side guard must not depend on the client being up to date.
    const EQUIPMENT_WORDS = [
      'barbell', 'dumbbell', 'machine', 'cable', 'kettlebell',
      'band', 'pull-up bar', 'pullup bar', 'smith', 'rack', 'bench',
    ];
    const equipInProgram = new Set(programSlots.flatMap(s => s.equip.map(e => e.toLowerCase())));
    const namesLostEquipment = [...EQUIPMENT_WORDS, ...equipInProgram].some(e => {
      // 'dumbbells' should match "no dumbbells" and "no dumbbell" alike.
      const stem = e.replace(/s$/, '');
      return stem.length > 3 && askedText.includes(stem);
    });

    if (changedNothing && (
      (factBlocks.length > 0 && (!textBlock?.text?.trim() || savedConstraintFact))
      || namesLostEquipment
    )) {
      const assistantContent = anthropicJson.content ?? [];
      const salvageMessages = [
        ...loopMessages,
        { role: 'assistant', content: assistantContent },
        {
          role: 'user',
          content: [
            ...assistantContent
              .filter((b: { type: string }) => b.type === 'tool_use')
              .map((b: { id: string }) => ({ type: 'tool_result', tool_use_id: b.id, content: 'Noted.' })),
            { type: 'text', text: 'You did not change the program. Confirming that a constraint is "already noted" or "on file" changes nothing — the affected exercises are still in the program right now and the user will meet them in their next session. Saying you will "keep it in mind" or "leave it out of future recommendations" is not enough — the exercises it rules out are still in the user\'s program right now, and they will attempt them. If any currently programmed exercise is affected, call declare_change_scope listing every affected slot (set excluded_equipment / excluded_patterns / excluded_exercises), then call propose_program_change for each one. If nothing currently programmed is actually affected, say so plainly instead. Include a text reply either way.' },
          ],
        },
      ];
      const salvaged = await callAnthropic(salvageMessages);
      if (salvaged) {
        loopJson = salvaged;
        loopMessages = salvageMessages;
        textBlock = salvaged.content?.find((b: { type: string }) => b.type === 'text');
        toolBlocks = (salvaged.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'propose_program_change');
        altBlocks = (salvaged.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'suggest_exercise_alternatives');
        scopeBlocks = (salvaged.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'declare_change_scope');
        if (!compactBlocks.length) compactBlocks = (salvaged.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'compact_workout');
        proposals = toolBlocks.map((b: { input: unknown }) => b.input).filter(isApplicable);
        alternatives = altBlocks.map((b: { input: unknown }) => b.input);
        declaredSlots = computeDeclaredSlots(scopeBlocks);
      }
    }
    // ── Parallel per-day fan-out ────────────────────────────────────────────
    // The sequential continuation loop below is correct but slow: a 6-day
    // sweep measured 50-75s, because each turn waits for the previous one and
    // spends most of that time generating ~1000 output tokens. Those turns
    // only had to be a conversation while the checklist lived in the model's
    // head. It doesn't any more — the server derives the affected slots
    // itself, so the remaining work is a known list that can be split by day
    // and issued concurrently. Wall time becomes the slowest single day
    // instead of the sum of all of them, for the same number of API calls
    // (so no extra cost, and the user's monthly quota is still one call).
    // Each worker re-sends the same cached context prefix, so the fan-out
    // reads from the cache written by the first turn rather than paying for
    // it again. Anything a worker fails to produce simply stays outstanding
    // and the sequential loop below picks it up as before.
    // Two waves, not one: a worker occasionally returns only some of the slots
    // it was given (measured once in three runs — 15 of 16, with the miss then
    // costing 22s in the sequential fallback without being recovered). The
    // second wave only ever carries what the first missed, so it is small and
    // fast, and is skipped entirely when the first wave was complete.
    const MAX_FANOUT_WAVES = 2;
    for (let wave = 0; wave < MAX_FANOUT_WAVES && declaredSlots.length; wave++) {
      const proposedKeys = new Set(proposals.map(slotKey));
      const todo = declaredSlots.filter(s => !proposedKeys.has(slotKey(s)));
      if (!todo.length) break;
      {
        const byDay = new Map<string, Slot[]>();
        todo.forEach(s => {
          const list = byDay.get(s.day_id) ?? [];
          list.push(s);
          byDay.set(s.day_id, list);
        });
        const sweepReason = scopeBlocks
          .map((b: { input?: { reason?: string } }) => b.input?.reason)
          .filter(Boolean)[0] ?? 'the change the user asked for';

        const ruledOutPatterns = sweptPatterns();
        const workerResults = await Promise.all([...byDay.entries()].map(([dayId, slots]) =>
          callAnthropic([
            ...(contextBlock ? [contextBlock] : []),
            {
              role: 'user',
              content: `Apply this change to the program: ${sweepReason}.\n\nOn day "${dayId}", exactly these slots must change:\n${slots.map(s => {
                const pat = patternBySlotKey.get(slotKey(s)) || '';
                const ruledOut = pat && ruledOutPatterns.includes(pat.toLowerCase());
                return `  [${s.exercise_index}] ${s.current_exercise ?? ''}${ruledOut ? ' — its movement pattern is the thing being ruled out, so this replacement MUST come from a DIFFERENT group (set pattern_change_reason)' : ''}`;
              }).join('\n')}\n\nCall propose_program_change once for EACH slot listed above, using day_id "${dayId}" and the exercise_index shown. Copy every exercise_name verbatim from AVAILABLE EXERCISES. Unless a slot is marked above as having its pattern ruled out, the replacement must stay in the SAME group as the slot it replaces (rule 7b). Vary your choices across slots rather than reusing one exercise. Return only the tool calls — no text reply is needed for this request, and do not call declare_change_scope.`,
            },
          ])
        ));

        const seen = new Set(proposals.map(slotKey));
        const declaredKeys = new Set(declaredSlots.map(slotKey));
        for (const wr of workerResults) {
          if (!wr) continue;
          const wProposals = (wr.content ?? [])
            .filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'propose_program_change')
            .map((b: { input: unknown }) => b.input)
            .filter(isApplicable)
            // A worker only has authority over slots that were on the
            // checklist — ignore anything it invents beyond its brief.
            .filter((p: { day_id?: string; exercise_index?: number }) => {
              const k = slotKey(p);
              if (!declaredKeys.has(k) || seen.has(k)) return false;
              seen.add(k);
              return true;
            });
          proposals = [...proposals, ...wProposals];
        }
        // The first turn's text is a promise ("I'll map every barbell slot"),
        // not a summary of what the workers went on to do — same situation the
        // sequential loop creates, so reuse its roll-up.
        continuationRan = true;
      }
    }

    // Raised from 2: a real 6-day PPL with 16 barbell slots measurably needed
    // more than two continuations to finish. Now mostly a fallback — the
    // fan-out above handles the declared-checklist case — so it matters for
    // sweeps with no declaration and for slots a worker failed to return.
    const MAX_CONTINUATIONS = 5;
    for (let i = 0; i < MAX_CONTINUATIONS; i++) {
      const remaining = outstanding();
      // With a declared checklist the model's wording no longer matters — the
      // checklist itself is the evidence a sweep is in progress, and it must
      // NOT additionally require a proposal to already exist: the model
      // follows "call declare_change_scope FIRST" literally and often spends
      // its whole first turn on the declaration alone. Requiring an edit here
      // broke exactly that case — the loop exited before it ever ran and the
      // reply came back with zero proposals. Without a declaration, fall back
      // to the old heuristic (made an edit AND claimed broad scope in prose).
      const sweepInProgress = declaredSlots.length > 0
        || ((toolBlocks.length > 0 || altBlocks.length > 0) && scopeClaimRe.test(textBlock?.text || ''));
      if (!sweepInProgress || remaining.length === 0) break;

      // Continue the conversation: the assistant's tool_use turn needs a
      // matching tool_result for every tool_use id before Anthropic will
      // accept another turn. Nothing has actually been applied yet (the user
      // applies proposals client-side), so the result is a neutral placeholder.
      const assistantContent = loopJson.content ?? [];
      const toolResults = assistantContent
        .filter((b: { type: string; id?: string }) => b.type === 'tool_use')
        .map((b: { id: string }) => ({ type: 'tool_result', tool_use_id: b.id, content: 'Noted.' }));
      const continuePrompt = declaredSlots.length
        ? `Continue — these slots you declared in declare_change_scope still have no propose_program_change call: ${remaining.join('; ')}. Call propose_program_change for each of them now. Do not re-propose slots you have already done, and do not call declare_change_scope again.`
        : `Continue — you haven't covered these days of the program yet: ${remaining.join(', ')}. Apply the same constraint to every affected slot on those days now, the same way you just did for the day(s) above.`;
      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: [...toolResults, { type: 'text', text: continuePrompt }] },
      ];

      const proposalsBefore = proposals.length;
      const contJson = await callAnthropic(loopMessages);
      if (!contJson) break; // best-effort: keep what's already been gathered rather than failing the whole reply
      continuationRan = true;

      loopJson = contJson;
      textBlock = contJson.content?.find((b: { type: string }) => b.type === 'text');
      toolBlocks = (contJson.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'propose_program_change');
      factBlocks = (contJson.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'remember_fact');
      altBlocks = (contJson.content ?? []).filter((b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'suggest_exercise_alternatives');

      // De-duplicate by slot: a continuation occasionally re-proposes a slot it
      // already did, which would otherwise show the user two cards for one
      // exercise and make the "N of M done" count wrong.
      const seenSlots = new Set(proposals.map(slotKey));
      const newProposals = toolBlocks
        .map((b: { input: unknown }) => b.input)
        .filter(isApplicable)
        .filter((p: { day_id?: string; exercise_index?: number }) => {
          const k = slotKey(p);
          if (seenSlots.has(k)) return false;
          seenSlots.add(k);
          return true;
        });

      proposals = [...proposals, ...newProposals];
      facts = [...facts, ...factBlocks.map((b: { input: unknown }) => b.input)];
      alternatives = [...alternatives, ...altBlocks.map((b: { input: unknown }) => b.input)];

      // No-progress guard: if a continuation added nothing new, asking again
      // will not help — stop rather than burn further calls and latency.
      if (proposals.length === proposalsBefore) break;
    }

    // Rule 11 tells the model to always pair a tool call with text — it doesn't
    // reliably comply (behavioral testing caught it skipping text specifically
    // when the ONLY tool call was suggest_exercise_alternatives or remember_fact).
    // The structured tool output is UI-only and never survives the app closing;
    // an empty text field means that turn is permanently blank once it's gone.
    // This is the deterministic backstop — synthesize a minimal, truthful
    // sentence from the tool call itself rather than trusting the prompt alone.
    const text = textBlock?.text?.trim()
      || (alternatives.length
        // One sentence per slot so a multi-slot reply doesn't collapse into a
        // single ambiguous list — "Best options for X: A, then B. Best options
        // for Y: C, then D." rather than one flat list with no slot markers.
        ? alternatives.map((alt: { current_exercise?: string; alternatives?: { exercise_name: string }[] }) =>
            alt.alternatives?.length
              ? `Best options${alt.current_exercise ? ` for ${alt.current_exercise}` : ''}: ${alt.alternatives.map(a => a.exercise_name).join(', then ')}.`
              : null
          ).filter(Boolean).join(' ') || null
        : null)
      || (proposals.length
        // exercise_name is the thing being added/replaced-in — absent for a
        // removal, which has nothing to name. rationale is where the model
        // puts the actual substance (including a SOLE-slot consequence for a
        // removal), so prefer it outright over reconstructing a thinner
        // sentence from the structured fields alone.
        ? (proposals[0]?.rationale
            || `${proposals[0]?.edit_type === 'remove_exercise' ? 'Removed' : 'Updated'} ${proposals.map((p: { exercise_name?: string; current_exercise?: string }) => p.exercise_name || p.current_exercise).filter(Boolean).join(', ')}${proposals[0]?.day_name ? ` on ${proposals[0].day_name}` : ''}.`)
        : null)
      || (facts.length
        ? `Noted — ${facts.map((f: { summary?: string }) => f.summary).filter(Boolean).join('; ')}.`
        : null)
      // Last resort: the model declared a sweep but produced no proposal and no
      // text at all. Saying nothing would leave the turn blank forever (tool
      // output is UI-only), so name what it identified and let the user retry.
      || (declaredSlots.length
        ? `Found ${declaredSlots.length} exercise${declaredSlots.length === 1 ? '' : 's'} affected, but couldn't apply the changes — ask again to retry.`
        : '');

    // When the completion loop above actually ran a continuation, textBlock
    // is whatever the LAST turn said — it narrates only that turn's slice
    // (e.g. just Full Body C), not the full multi-day change the user asked
    // for and actually got. Gated on continuationRan specifically (not just
    // "proposals span multiple days"): a single turn that naturally covers
    // 2+ days on its own already has a coherent, complete, often
    // science-grounded rationale from the model — replacing that with a
    // generic roll-up would be a downgrade, not a fix.
    // day_name isn't a required tool field (day_id is) — key by day_id so a
    // call that omits day_name doesn't get treated as a different/unnamed day.
    const dayLabelById = new Map<string, string>();
    proposals.forEach((p: { day_id?: string; day_name?: string }) => {
      if (!p.day_id || dayLabelById.has(p.day_id)) return;
      dayLabelById.set(p.day_id, p.day_name || dayNameById.get(p.day_id) || p.day_id);
    });
    const distinctDayLabels = [...dayLabelById.values()];
    const multiDayText = (continuationRan && distinctDayLabels.length > 1)
      ? `Updated ${proposals.length} exercise${proposals.length === 1 ? '' : 's'} across ${distinctDayLabels.length} days: ${distinctDayLabels.join(', ')}.`
      : null;
    const rolledUpText = multiDayText || text;

    // Safety net for when the loop still can't finish (a sweep larger than
    // MAX_CONTINUATIONS, or the no-progress guard tripping). Reported at
    // SLOT level whenever a checklist was declared: day-level reporting used
    // to call a day "covered" once any one slot on it was proposed, so a
    // 6-day split with the squat swapped but the deadlift untouched read as
    // done. Never claim more coverage than the proposals actually provide —
    // a user who believes a sweep finished won't re-check the days it missed.
    const finalOutstanding = outstanding();
    const declaredTotal = declaredSlots.length;
    const finalText = (finalOutstanding.length > 0 && proposals.length && (continuationRan || declaredTotal > 0))
      ? (declaredTotal
          ? `Changed ${declaredTotal - finalOutstanding.length} of ${declaredTotal} affected exercises so far (still to do: ${finalOutstanding.join('; ')}) — say "do the rest" to continue.`
          : `Updated ${allDayIds.size - finalOutstanding.length} of ${allDayIds.size} days so far (still need: ${finalOutstanding.join(', ')}) — say "do the rest" to continue.`)
      : rolledUpText;

    // Persisted rather than logged: this project's edge-function log view only
    // surfaces boot/shutdown events, so console.log output was invisible and
    // spend could not be measured at all. A row per request is queryable from
    // the SQL editor and aggregates over time. Fire-and-forget — a usage-write
    // failure must never fail the user's actual coach reply.
    supabase.from('ai_usage_log').insert({
      user_id: user.id,
      mode: isSummary ? 'weekly_summary' : 'chat',
      calls: spend.calls,
      input_tokens: spend.input,
      cache_write_tokens: spend.cacheWrite,
      cache_read_tokens: spend.cacheRead,
      output_tokens: spend.output,
    }).then(
      ({ error }: { error: unknown }) => { if (error) console.error('ai_usage_log insert failed:', error); },
      (e: unknown) => console.error('ai_usage_log insert threw:', e),
    );

    // Call already reserved before the Anthropic request — nothing to increment here.
    return json({
      // Emitted to the function logs so real spend per user message is
      // measurable in production, not estimated. Billable input is
      // input + cacheWrite + cacheRead, each charged at a different rate.
      _usage: spend,
      text: finalText,
      proposals,
      facts,
      alternatives,
      // { scope, reason } when the coach trimmed a session for time. Separate
      // from `proposals` on purpose: proposals edit the stored program and need
      // the user to Apply, a trim applies to the session about to be run and
      // expires with it.
      compact: compactBlocks.length ? compactBlocks[0].input : null,
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
