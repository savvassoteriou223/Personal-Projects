/**
 * Guards translation completeness and placeholder integrity.
 *
 * i18next falls back to English for a missing key, so a gap is invisible in
 * development and silently ships as English text mid-screen for every non-English
 * user. That is how the seven locales drifted to 106 missing keys each — nothing
 * ever failed.
 *
 * A renamed placeholder is worse than a missing key: i18next cannot substitute
 * it, so the user is shown the raw `{{token}}`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'locales');
const read = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

const placeholders = s => (String(s).match(/\{\{\w+\}\}/g) || []).sort();

const EN = flatten(read('en.json'));
const OTHERS = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'en.json');

test('every locale file is valid JSON and non-empty', () => {
  assert.ok(OTHERS.length >= 7, `expected the shipped locales, found ${OTHERS.length}`);
  for (const f of OTHERS) assert.ok(Object.keys(flatten(read(f))).length > 0, `${f} is empty`);
});

test('no locale is missing a key that English has', () => {
  const report = [];
  for (const f of OTHERS) {
    const loc = flatten(read(f));
    const missing = Object.keys(EN).filter(k => !(k in loc));
    if (missing.length) report.push(`${f}: ${missing.length} missing (${missing.slice(0, 3).join(', ')}…)`);
  }
  assert.deepEqual(report, [], `translations have drifted:\n  ${report.join('\n  ')}`);
});

test('placeholders match English exactly in every locale', () => {
  const report = [];
  for (const f of OTHERS) {
    for (const [k, v] of Object.entries(flatten(read(f)))) {
      if (!(k in EN)) continue;
      const a = placeholders(EN[k]), b = placeholders(v);
      if (a.join() !== b.join()) report.push(`${f} ${k}: en[${a}] vs [${b}]`);
    }
  }
  assert.deepEqual(report, [], `placeholder mismatch — users would see the raw token:\n  ${report.join('\n  ')}`);
});

test('no locale carries a key English has dropped', () => {
  // Dead keys are harmless at runtime but hide real drift in the counts above.
  const report = [];
  for (const f of OTHERS) {
    const extra = Object.keys(flatten(read(f))).filter(k => !(k in EN));
    if (extra.length) report.push(`${f}: ${extra.length} orphaned (${extra.slice(0, 3).join(', ')}…)`);
  }
  assert.deepEqual(report, [], report.join('\n  '));
});
