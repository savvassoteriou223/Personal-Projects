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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return respond({ error: 'unauthorised' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, is_admin, nutrition_calls_used, nutrition_calls_reset_at')
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

    if (!profile?.is_admin && callsUsed >= 5) {
      return respond({ error: 'daily_limit_reached' }, 429);
    }

    const { description } = await req.json();
    if (!description?.trim()) return respond({ error: 'missing_description' }, 400);
    if (description.length > 500) return respond({ error: 'description_too_long' }, 400);

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: description },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error('OpenAI error:', errBody);
      return respond({ error: 'ai_unavailable' }, 502);
    }

    const openaiJson = await openaiRes.json();
    const content = openaiJson.choices?.[0]?.message?.content;
    if (!content) return respond({ error: 'no_response' }, 502);

    let result;
    try {
      const cleaned = content.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse OpenAI response:', content);
      return respond({ error: 'parse_error' }, 502);
    }

    if (!Array.isArray(result.items)) return respond({ error: 'invalid_response' }, 502);

    result.totals = result.items.reduce(
      (acc: Record<string, number>, item: Record<string, number>) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein_g: acc.protein_g + (Number(item.protein_g) || 0),
        carbs_g: acc.carbs_g + (Number(item.carbs_g) || 0),
        fat_g: acc.fat_g + (Number(item.fat_g) || 0),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    );

    await supabase.from('profiles')
      .update({ nutrition_calls_used: callsUsed + 1 })
      .eq('id', user.id);

    return respond(result);

  } catch (err) {
    console.error('nutrition-ai error:', err);
    return respond({ error: 'internal_error' }, 500);
  }
});

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
