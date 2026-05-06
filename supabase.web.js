import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://guvvzimnucttjjzmpsvp.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnZ6aW1udWN0dGpqem1wc3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzc4NjQsImV4cCI6MjA5MTgxMzg2NH0.DzlaEHqxnln1GgjkBKLSyyIoyR6-VrknUL0d0wyuPaQ';

// DB/storage requests get an 8-second timeout. Auth requests MUST NOT be
// aborted — an aborted token refresh causes the SDK to fire SIGNED_OUT,
// which logs the user out and wipes the session from localStorage.
function fetchWithTimeout(url, options = {}) {
  if (typeof url === 'string' && url.includes('/auth/v1/')) {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout },
});

// On web, getSession() reads localStorage — no network call, no hang.
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}
