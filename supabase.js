import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Auth endpoints (login, signup, refresh, reset) are never aborted — aborting
// a refresh causes SIGNED_OUT and wipes the session; aborting login just
// produces a confusing timeout error with no retry. Only data queries get
// the 8-second timeout.
function fetchWithTimeout(url, options = {}) {
  const urlStr = typeof url === 'string' ? url : (url?.url ?? '');
  const isAuth = urlStr.includes('/auth/v1/');
  const ms = isAuth ? 45000 : 15000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network request timed out')), ms);
    fetch(url, options).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: Platform.OS === 'web'
    ? { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    : {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
  global: { fetch: fetchWithTimeout },
});

// Keep auto-refresh alive when app comes to foreground.
// Without this, auto-refresh stops in background and the token goes stale,
// causing SIGNED_OUT to fire when the user reopens the app.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh?.();
    } else {
      supabase.auth.stopAutoRefresh?.();
    }
  });
}

// Web: read user directly from localStorage to avoid the async init race
// and to work even when the access token is mid-refresh.
// Native: getUser() validates against the server (more reliable than getSession).
const _WEB_STORAGE_KEY = Platform.OS === 'web'
  ? `sb-${supabaseUrl?.match(/\/\/([^.]+)/)?.[1]}-auth-token`
  : null;

export async function getCurrentUser() {
  if (Platform.OS === 'web') {
    try {
      const raw = window.localStorage.getItem(_WEB_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw)?.user ?? null;
    } catch {
      return null;
    }
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}