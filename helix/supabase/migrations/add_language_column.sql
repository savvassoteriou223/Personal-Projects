-- Stores each user's chosen app language (ISO 639-1 code: 'en', 'es', 'de', 'fr').
-- The app persists the choice locally in AsyncStorage for instant startup, but
-- also writes it here so the language follows the user across devices AND so the
-- AI edge functions (ai-coach, nutrition-ai) can read it and respond in-language.
-- Run in Supabase Dashboard → SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
