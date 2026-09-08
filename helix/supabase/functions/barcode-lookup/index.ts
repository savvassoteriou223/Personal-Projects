import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('token_failed');
  return data.access_token;
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
      .select('is_premium')
      .eq('id', user.id)
      .single();

    if (!profile?.is_premium) return respond({ error: 'premium_required' }, 403);

    const { barcode } = await req.json();
    if (!barcode) return respond({ error: 'missing_barcode' });

    let token: string;
    try {
      token = await getToken(
        Deno.env.get('FATSECRET_CLIENT_ID')!,
        Deno.env.get('FATSECRET_CLIENT_SECRET')!,
      );
    } catch (e) {
      console.error('token error:', e);
      return respond({ error: 'auth_failed' });
    }

    // Step 1: barcode → food_id
    const barcodeRes = await fetch(
      `${API_URL}?method=food.find_id_for_barcode&barcode=${barcode}&format=json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const barcodeText = await barcodeRes.text();
    console.log('barcode response:', barcodeText);
    const barcodeData = JSON.parse(barcodeText);
    const foodId = barcodeData?.food_id?.value;
    if (!foodId) return respond({ error: 'not_found', raw: barcodeData });

    // Step 2: food_id → full nutrition with servings
    const foodRes = await fetch(
      `${API_URL}?method=food.get.v4&food_id=${foodId}&format=json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const foodText = await foodRes.text();
    console.log('food response:', foodText);
    const foodData = JSON.parse(foodText);
    const food = foodData?.food;
    if (!food) return respond({ error: 'no_data', raw: foodData });

    const raw = food.servings?.serving;
    const serving = Array.isArray(raw) ? raw[0] : raw;
    if (!serving) return respond({ error: 'no_serving', raw: food });

    return respond({
      name: food.food_name,
      quantity: serving.serving_description || `${serving.metric_serving_amount}${serving.metric_serving_unit}`,
      calories: Math.round(parseFloat(serving.calories ?? 0)),
      protein_g: Math.round(parseFloat(serving.protein ?? 0)),
      carbs_g: Math.round(parseFloat(serving.carbohydrate ?? 0)),
      fat_g: Math.round(parseFloat(serving.fat ?? 0)),
    });

  } catch (err) {
    console.error('barcode-lookup error:', err);
    return respond({ error: 'internal_error' });
  }
});

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
