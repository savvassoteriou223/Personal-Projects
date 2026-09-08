import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../supabase';

// Bump this whenever a gif mapping is corrected or removed. The cache never
// expires on its own, so a device that already fetched a wrong clip would keep
// showing it forever otherwise — v14 drops the pendulum squat's hack-squat gif.
const CACHE_NS = '@exgif14:';

// Web: in-memory only — AsyncStorage uses localStorage which races with Supabase auth init on refresh
const memCache = new Map();

function normalise(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export async function getExerciseGif(exerciseName) {
  if (!exerciseName) return null;

  const searchName = normalise(exerciseName);
  const cacheKey   = CACHE_NS + searchName;

  if (memCache.has(cacheKey)) return memCache.get(cacheKey);

  if (Platform.OS !== 'web') {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) { memCache.set(cacheKey, cached); return cached; }
    } catch (_) {}
  }

  const { data: exact } = await supabase
    .from('exercise_gifs')
    .select('gif_url')
    .eq('name', searchName)
    .maybeSingle();

  const gif = exact?.gif_url || null;

  if (gif) {
    memCache.set(cacheKey, gif);
    if (Platform.OS !== 'web') {
      try { await AsyncStorage.setItem(cacheKey, gif); } catch (_) {}
    }
  }
  return gif;
}
