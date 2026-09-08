/**
 * Structural guard for the studies library.
 *
 * This is the app's evidence base — the coach quotes it and the why-layer cites
 * it — so a malformed or mislabelled entry shows up to users as science. It does
 * not (and cannot) check that a citation is factually right; that needs a human
 * reading the paper. Two entries were added in this session with the wrong
 * author attached, so treat `cite` as the field most worth reviewing by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STUDIES, getStudiesByTags, formatEvidenceBase } from '../screens/studiesLibrary.js';

test('every study has an insight, a citation and tags', () => {
  for (const [key, s] of Object.entries(STUDIES)) {
    assert.ok(s.insight, `${key}: missing insight`);
    assert.ok(s.cite, `${key}: missing cite`);
    assert.ok(Array.isArray(s.tags) && s.tags.length, `${key}: missing tags`);
  }
});

test('any citation that names authors also gives a year', () => {
  // Some entries cite a principle rather than a paper ("Anatomy", "Standard
  // practice"). That is honest — it does not claim a specific study. What must
  // not happen is a citation that looks like a paper ("Singer et al.") without a
  // year to pin it to, because that is unverifiable by the reader.
  for (const [key, s] of Object.entries(STUDIES)) {
    const namesAuthors = /et al\.|&\s+[A-Z]/.test(s.cite);
    if (!namesAuthors) continue;
    assert.match(s.cite, /\b(19|20)\d{2}\b/, `${key}: names authors but has no year — "${s.cite}"`);
  }
});

test('preprints are labelled as preprints', () => {
  // A preprint is not peer reviewed. Presenting one the same way as a published
  // meta-analysis overstates it, so the label has to survive edits.
  const known = ['Davidson & Barillas 2025'];
  for (const author of known) {
    const entries = Object.entries(STUDIES).filter(([, s]) => s.cite.startsWith(author));
    assert.ok(entries.length, `expected a study cited to ${author}`);
    for (const [key, s] of entries) {
      assert.match(s.cite, /preprint/i, `${key}: ${author} is a preprint and must say so`);
    }
  }
});

test('tag lookup reaches the goal-relevant findings', () => {
  for (const tag of ['rest', 'strength', 'volume', 'effort', 'cardio']) {
    assert.ok(getStudiesByTags([tag]).length, `no studies tagged "${tag}"`);
  }
});

test('no finding needing a wearable reaches the coach', () => {
  // The whole library is sent to the model as "your source of truth". A rule
  // about HRV or step count in there makes it reason about numbers the app
  // cannot see — which is how the weekly review came to discuss sleep and HRV
  // for users with no recovery data at all. HRV and Steps were also the two
  // permissions that got a release rejected, so this is a policy edge as well
  // as an accuracy one.
  const base = formatEvidenceBase().toLowerCase();
  for (const term of ['hrv', 'heart rate variability', 'steps/day', 'steps a day', 'resting heart rate']) {
    assert.ok(!base.includes(term), `evidence base sent to the coach still mentions "${term}"`);
  }
});

test('withheld findings are still in the library for the why-layer', () => {
  // Withholding them from the coach must not delete them: as general advice to
  // a reader they are true, and the user-facing science layer can show them.
  const flagged = Object.entries(STUDIES).filter(([, s]) => s.needsWearable);
  assert.ok(flagged.length >= 3, 'expected the wearable-dependent findings to still exist');
});
