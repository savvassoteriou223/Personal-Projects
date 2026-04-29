// exerciseDBService.js
// Looks up animated exercise GIF URLs from the exercise_gifs Supabase table.
// Falls back to null if no close match found (ExerciseSlideshow handles the fallback).
// Results are cached in AsyncStorage — each exercise only hits Supabase once per device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';

const CACHE_NS = '@exgif:';

function normalise(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export async function getExerciseGif(exerciseName) {
  if (!exerciseName) return null;

  const cacheKey = CACHE_NS + normalise(exerciseName);

  // AsyncStorage cache — avoids hitting Supabase on every open
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached !== null) return cached || null; // '' = confirmed no match
  } catch (_) {}

  // Fuzzy match via pg_trgm (similarity > 0.25)
  const { data, error } = await supabase.rpc('find_exercise_gif', {
    search_name: normalise(exerciseName),
  });

  const gif = !error && data ? data : '';

  try { await AsyncStorage.setItem(cacheKey, gif); } catch (_) {}

  return gif || null;
}
