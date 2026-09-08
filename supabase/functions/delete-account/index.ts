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

    // 4. Delete every remaining table keyed to this user.
    //
    // This used to delete a single 'weight_logs' table, which does not exist —
    // supabase-js returns an error object rather than throwing, so the call
    // silently no-opped and the rest of the user's data was left to whatever
    // ON DELETE CASCADE each table happened to declare. Several of these tables
    // were created directly in the dashboard and their cascade behaviour is not
    // recorded in this repo, so relying on it was an unverifiable assumption
    // about a deletion request.
    //
    // Listing them explicitly makes the guarantee independent of the schema.
    // A name that does not exist is harmless for the same reason the old bug was
    // invisible: the error is returned, not thrown.
    const USER_TABLES = [
      'body_metrics',
      'daily_health_logs',
      'recovery_checkins',
      'exercise_skips',
      'coach_memory',
      'weekly_summaries',
      'program_blocks',
      'program_template_overrides',
      'program_additions',
      'are_experiments',
      'are_individual_model',
    ];
    for (const table of USER_TABLES) {
      const { error } = await supabaseAdmin.from(table).delete().eq('user_id', uid);
      // Log and continue: one missing or renamed table must not abort the
      // deletion and strand the rest of the user's data.
      if (error) console.error(`delete-account: ${table}:`, error.message);
    }

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
