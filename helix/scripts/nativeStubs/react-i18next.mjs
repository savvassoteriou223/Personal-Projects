// react-i18next stand-in that resolves against the REAL locales/en.json rather
// than echoing keys back. That difference is the point: a test can then assert
// that nothing on a shareable sticker rendered as a raw `workout.share.newPr`,
// which is the failure mode a key-echoing mock would hide.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EN = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'locales', 'en.json'), 'utf8'));

/** Keys this run could not resolve, so a test can inspect them. */
export const __missingKeys = [];
export function __resetMissing() { __missingKeys.length = 0; }

function lookup(key) {
  return key.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), EN);
}

function interpolate(str, opts = {}) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (m, name) =>
    (opts[name] !== undefined ? String(opts[name]) : m));
}

export function t(key, opts = {}) {
  const hit = lookup(key);
  if (typeof hit === 'string') return interpolate(hit, opts);
  if (opts.defaultValue !== undefined) {
    // Resolvable only via the inline fallback — the locale file is missing it.
    __missingKeys.push(key);
    return interpolate(opts.defaultValue, opts);
  }
  __missingKeys.push(key);
  return key;
}

export function useTranslation() {
  return { t, i18n: { language: 'en', changeLanguage: async () => {} } };
}

export const initReactI18next = { type: '3rdParty', init: () => {} };
export const Trans = ({ children }) => children ?? null;

export default { useTranslation, t, initReactI18next, Trans };
