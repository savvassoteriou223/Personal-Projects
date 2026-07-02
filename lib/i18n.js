// i18n setup — central language config for the whole app.
//
// Languages ship as static JSON bundles under /locales. The active language is
// chosen by: saved user preference (AsyncStorage) → device locale → English.
// Generated content (AI coach, nutrition AI) is localized separately by passing
// the active language code into the edge functions, not through these bundles.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import es from '../locales/es.json';
import de from '../locales/de.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import ru from '../locales/ru.json';
import zh from '../locales/zh.json';
import pt from '../locales/pt.json';

export const STORAGE_KEY = '@helix_language';

// The languages we actually ship. `label` is shown in the picker (in-language).
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh', label: '中文' },
];

const resources = {
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  fr: { translation: fr },
  it: { translation: it },
  ru: { translation: ru },
  zh: { translation: zh },
  pt: { translation: pt },
};

const SUPPORTED = LANGUAGES.map(l => l.code);

// Best match for the device's preferred language, falling back to English.
function deviceLanguage() {
  const tags = getLocales().map(l => l.languageCode).filter(Boolean);
  return tags.find(t => SUPPORTED.includes(t)) || 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLanguage(),       // synchronous default; overridden below if a pref is saved
    fallbackLng: 'en',
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });

// Apply a saved preference once AsyncStorage resolves (async, non-blocking).
AsyncStorage.getItem(STORAGE_KEY)
  .then(saved => { if (saved && SUPPORTED.includes(saved)) i18n.changeLanguage(saved); })
  .catch(() => {});

// Apply the language saved on the user's profile (called right after login).
// The server value wins so the choice follows the user across devices. We do NOT
// write back here — this is a one-way pull — to avoid a redundant round-trip.
export async function syncLanguageFromProfile(code) {
  if (!code || !SUPPORTED.includes(code)) return;
  if (i18n.language?.split('-')[0] === code) return;
  await i18n.changeLanguage(code);
  AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
}

// Change language and persist the choice — locally (instant startup next time)
// and to the user's profile when signed in, so it follows them across devices
// and the AI edge functions can read it to respond in-language.
export async function setLanguage(code) {
  if (!SUPPORTED.includes(code)) return;
  await i18n.changeLanguage(code);
  AsyncStorage.setItem(STORAGE_KEY, code).catch(() => {});
  // Lazy import avoids pulling the supabase client into the startup path.
  try {
    const { supabase, getCurrentUser } = await import('../supabase');
    const user = await getCurrentUser();
    if (user) await supabase.from('profiles').update({ language: code }).eq('id', user.id);
  } catch { /* offline or signed out — local preference still applies */ }
}

export default i18n;
