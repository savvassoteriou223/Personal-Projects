import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return json(null, 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorised' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the user from the JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'unauthorised' }, 401);

    const uid = user.id;

    // 1. Delete nutrition logs
    await supabaseAdmin.from('nutrition_logs').delete().eq('user_id', uid);

    // 2. Get all workout session IDs for this user
    const { data: sessions } = await supabaseAdmin
      .from('workout_sessions')
      .select('id')
      .eq('user_id', uid);

    if (sessions?.length) {
      const sessionIds = sessions.map((s: { id: string }) => s.id);
      await supabaseAdmin.from('completed_sets').delete().in('session_id', sessionIds);
    }

    // 3. Delete workout sessions
    await supabaseAdmin.from('workout_sessions').delete().eq('user_id', uid);

    // 4. Delete weight logs
    await supabaseAdmin.from('weight_logs').delete().eq('user_id', uid);

    // 5. Delete profile
    await supabaseAdmin.from('profiles').delete().eq('id', uid);

    // 6. Delete the auth user (requires service role)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return json({ error: 'delete_failed' }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error('delete-account error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}
