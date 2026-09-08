import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// RevenueCat -> Supabase premium sync.
//
// WHY: is_premium is RLS-locked so the client cannot set it (prevents self-granting
// premium). This webhook is the ONLY trusted path that flips is_premium, driven by
// RevenueCat's server-verified subscription events. The edge functions (ai-coach,
// nutrition-ai, barcode-lookup) gate on profiles.is_premium, so this is what makes
// a real paying customer actually work.
//
// ── DEPLOY ────────────────────────────────────────────────────────────────────
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//   (--no-verify-jwt is REQUIRED: RevenueCat cannot send a Supabase JWT. This
//    function does its own auth via the shared secret below.)
//
// ── CONFIGURE ─────────────────────────────────────────────────────────────────
//   1. Set a Supabase secret:   supabase secrets set RC_WEBHOOK_AUTH=<long-random-string>
//   2. RevenueCat dashboard -> Integrations -> Webhooks:
//        URL:            https://<project>.supabase.co/functions/v1/revenuecat-webhook
//        Authorization:  <the same long-random-string>
//   RevenueCat sends that value in the Authorization header on every event; we
//   reject anything that doesn't match, so nobody can forge "grant me premium".

const ENTITLEMENT = 'Helix Pro';

// Event types that GRANT premium (entitlement becomes/stays active).
const GRANT = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT',
]);
// Event types that REVOKE premium (access ends).
const REVOKE = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);
// CANCELLATION / BILLING_ISSUE deliberately do NOT change state — access continues
// until EXPIRATION (cancellation just turns off auto-renew; billing issue = grace).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // 1. Verify the shared secret. Without this, anyone could POST a fake event to
  //    grant themselves premium — this check is the core security control.
  const expected = Deno.env.get('RC_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== expected) {
    return json({ error: 'unauthorised' }, 401);
  }

  let body: { event?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const event = body?.event;
  const type = event?.type as string | undefined;
  if (!type) return json({ error: 'bad_request' }, 400);

  // 2. Only act on the Helix Pro entitlement when the event names one.
  const entRaw = (event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : null)) as string[] | null;
  if (entRaw && !entRaw.includes(ENTITLEMENT)) return json({ ok: true, ignored: 'entitlement' });

  // 3. Decide the new state; ignore events that don't change it.
  let premium: boolean;
  if (GRANT.has(type)) premium = true;
  else if (REVOKE.has(type)) premium = false;
  else return json({ ok: true, ignored: type });

  // 4. Map to the Supabase user. The app calls Purchases.logIn(supabaseUserId), so
  //    app_user_id is normally the uuid; include original id + aliases for safety
  //    (e.g. a purchase made anonymously before login).
  const ids = [event.app_user_id, event.original_app_user_id, ...((event.aliases as string[]) ?? [])]
    .filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
  if (!ids.length) return json({ ok: true, ignored: 'no_uuid_app_user_id' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await supabase
    .from('profiles')
    .update({ is_premium: premium })
    .in('id', [...new Set(ids)]);

  if (error) {
    console.error('revenuecat-webhook update failed:', error.message);
    return json({ error: 'update_failed' }, 500);
  }
  return json({ ok: true, premium });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
