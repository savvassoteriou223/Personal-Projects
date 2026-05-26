import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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

// On web, read directly from localStorage — avoids the async initialization
// race where getSession() returns null before the auth client finishes loading.
// The Supabase client still uses its own session for request signing (headers).
const STORAGE_KEY = `sb-${supabaseUrl?.match(/\/\/([^.]+)/)?.[1]}-auth-token`;

export function getCurrentUser() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return Promise.resolve(null);
    const session = JSON.parse(raw);
    return Promise.resolve(session?.user ?? null);
  } catch {
    return Promise.resolve(null);
  }
}
