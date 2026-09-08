import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SYSTEM_PROMPT = `You are a precise nutrition calculator. The user describes food they have eaten.

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "items": [
    {
      "name": "Food item name",
      "quantity": "amount with unit e.g. 200g, 1 medium, 2 slices",
      "calories": 250,
      "protein_g": 30,
      "carbs_g": 10,
      "fat_g": 8
    }
  ]
}

Rules:
- Use standard nutritional data (USDA values)
- All macro values must be whole numbers
- For vague quantities: "a bowl of rice" = 200g cooked, "a cup" = 240ml, "a handful" = 30g
- Split every distinct food into its own item`;

// Maps a stored language code to its English name. English/unknown returns null.
const LANGUAGE_NAMES: Record<string, string> = { es: 'Spanish', de: 'German', fr: 'French', it: 'Italian', pt: 'Portuguese', ru: 'Russian', zh: 'Chinese (Simplified)' };

function languageInstruction(code: string | null | undefined): string {
  const name = code ? LANGUAGE_NAMES[code] : null;
  if (!name) return '';
  // Only the display "name" is translated; quantities/macros stay numeric/standard.
  return `\n- Write each item's "name" field in ${name}.`;
}

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
    if (!authHeader) return respond({ error: 'unauthorised' }, 401);

    // Prefer the new sb_secret_ key (set as SERVICE_SECRET_KEY); fall back to the
    // legacy auto-injected service_role key so nothing breaks during migration.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return respond({ error: 'unauthorised' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, is_admin, nutrition_calls_used, nutrition_calls_reset_at, language')
      .eq('id', user.id)
      .single();

    if (!profile?.is_premium && !profile?.is_admin) return respond({ error: 'premium_required' }, 403);

    const now = new Date();
    const resetAt = new Date(profile.nutrition_calls_reset_at ?? 0);
    let callsUsed: number = profile.nutrition_calls_used ?? 0;

    if (now.toISOString().slice(0, 10) !== resetAt.toISOString().slice(0, 10)) {
      await supabase.from('profiles')
        .update({ nutrition_calls_used: 0, nutrition_calls_reset_at: now.toISOString() })
        .eq('id', user.id);
      callsUsed = 0;
    }

    // Validate input before reserving a call so bad requests don't consume quota.
    const body = await req.json();
    const { description, image } = body;

    if (!description?.trim() && !image) return respond({ error: 'missing_input' }, 400);
    if (description && description.length > 500) return respond({ error: 'description_too_long' }, 400);
    if (image && typeof image !== 'string') return respond({ error: 'invalid_image' }, 400);
    if (image && !image.startsWith('data:image/')) return respond({ error: 'invalid_image' }, 400);
    if (image && image.length > 1200000) return respond({ error: 'image_too_large' }, 400);

    // Atomically reserve a daily call (optimistic concurrency — closes the TOCTOU
    // where concurrent requests could all pass a plain read-then-check).
    if (!profile?.is_admin) {
      const reserved = await reserveCall(supabase, user.id, callsUsed, 6);
      if (!reserved) return respond({ error: 'daily_limit_reached' }, 429);
    }

    const userMessage = image
      ? {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: image, detail: 'low' } },
            { type: 'text', text: 'Identify every food item visible in this image and return nutrition data.' },
          ],
        }
      : { role: 'user', content: description };

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + languageInstruction(profile.language) },
          userMessage,
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error('OpenAI error:', errBody);
      if (!profile?.is_admin) await refundCall(supabase, user.id);
      return respond({ error: 'ai_unavailable' }, 502);
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) {
      if (!profile?.is_admin) await refundCall(supabase, user.id);
      return respond({ error: 'no_response' }, 502);
    }

    let result;
    try {
      const cleaned = content.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse OpenAI response:', content);
      if (!profile?.is_admin) await refundCall(supabase, user.id);
      return respond({ error: 'parse_error' }, 502);
    }

    if (!Array.isArray(result.items)) {
      if (!profile?.is_admin) await refundCall(supabase, user.id);
      return respond({ error: 'invalid_response' }, 502);
    }

    result.totals = result.items.reduce(
      (acc: Record<string, number>, item: Record<string, number>) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein_g: acc.protein_g + (Number(item.protein_g) || 0),
        carbs_g: acc.carbs_g + (Number(item.carbs_g) || 0),
        fat_g: acc.fat_g + (Number(item.fat_g) || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    // Call already reserved before the OpenAI request — nothing to increment here.
    return respond(result);

  } catch (err) {
    console.error('nutrition-ai error:', err);
    return respond({ error: 'internal_error' }, 500);
  }
});

// Atomically reserve one daily call using optimistic concurrency.
// Each attempt re-reads the counter and only writes if it is unchanged since the
// read (eq filter), so concurrent requests can never both claim the same slot.
// deno-lint-ignore no-explicit-any
async function reserveCall(supabase: any, userId: string, known: number, limit: number): Promise<boolean> {
  let used = known;
  for (let i = 0; i < 6; i++) {
    if (used >= limit) return false;
    const { data } = await supabase
      .from('profiles')
      .update({ nutrition_calls_used: used + 1 })
      .eq('id', userId)
      .eq('nutrition_calls_used', used)
      .select('nutrition_calls_used');
    if (data && data.length > 0) return true; // won the slot
    // Lost the race — re-read and try again
    const { data: cur } = await supabase.from('profiles').select('nutrition_calls_used').eq('id', userId).single();
    used = cur?.nutrition_calls_used ?? limit;
  }
  return false;
}

// Best-effort refund when the AI call fails after a slot was reserved.
// deno-lint-ignore no-explicit-any
async function refundCall(supabase: any, userId: string): Promise<void> {
  const { data: cur } = await supabase.from('profiles').select('nutrition_calls_used').eq('id', userId).single();
  const used = cur?.nutrition_calls_used ?? 0;
  if (used > 0) {
    await supabase.from('profiles').update({ nutrition_calls_used: used - 1 }).eq('id', userId).eq('nutrition_calls_used', used);
  }
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
