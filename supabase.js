import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://guvvzimnucttjjzmpsvp.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnZ6aW1udWN0dGpqem1wc3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMzc4NjQsImV4cCI6MjA5MTgxMzg2NH0.DzlaEHqxnln1GgjkBKLSyyIoyR6-VrknUL0d0wyuPaQ';

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: Platform.OS === 'web'
    ? { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
    : {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
  global: { fetch: fetchWithTimeout },
});

export async function getCurrentUser() {
  if (Platform.OS === 'web') {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}