import { test } from 'node:test';
import assert from 'node:assert/strict';

import { replacementPatternCheck, soleSlotPatterns } from './proposalPreflight.js';

// ── replacementPatternCheck ──────────────────────────────────────────────────

test('flat bench replacing a decline press is a known crossing', () => {
  const c = replacementPatternCheck('Decline barbell press', 'Barbell bench press');
  assert.deepEqual(c, {
    known: true, crosses: true,
    from: 'chest_decline', to: 'chest_horizontal_push',
  });
});

test('decline dumbbell replacing decline barbell stays in pattern', () => {
  const c = replacementPatternCheck('Decline barbell press', 'Decline dumbbell press');
  assert.equal(c.known, true);
  assert.equal(c.crosses, false);
});

test('a name outside the library is not judged', () => {
  assert.deepEqual(
    replacementPatternCheck('Coach Dave special', 'Barbell bench press'),
    { known: false, crosses: false }
  );
  assert.deepEqual(
    replacementPatternCheck('Decline barbell press', 'Coach Dave special'),
    { known: false, crosses: false }
  );
  assert.deepEqual(replacementPatternCheck(null, null), { known: false, crosses: false });
});

test('the check judges other families the same way', () => {
  // Vertical pull → horizontal pull is a crossing even though both are "back".
  const c = replacementPatternCheck('Lat pulldown (wide pronated grip)', 'Barbell row');
  assert.equal(c.crosses, true);
  assert.equal(c.from, 'back_vertical_pull');
  assert.equal(c.to, 'back_horizontal_pull');
});

// ── soleSlotPatterns ─────────────────────────────────────────────────────────

const DAYS = [
  { id: 'upper_a', exercises: [
    { name: 'Barbell bench press' },
    { name: 'Decline barbell press' },   // only chest_decline slot anywhere
    { name: 'Lat pulldown (wide pronated grip)' },
  ] },
  { id: 'upper_b', exercises: [
    { name: 'Dumbbell bench press' },    // chest_horizontal_push again
    { name: 'Pull-up (overhand)' },      // back_vertical_pull again
    { name: 'Some hand-entered thing' }, // unknown → ignored
  ] },
];

test('a pattern with one slot across the program is flagged sole', () => {
  const sole = soleSlotPatterns(DAYS);
  assert.ok(sole.has('chest_decline'));
});

test('patterns with slots on multiple days are not sole', () => {
  const sole = soleSlotPatterns(DAYS);
  assert.ok(!sole.has('chest_horizontal_push'));
  assert.ok(!sole.has('back_vertical_pull'));
});

test('unknown names never produce a flag, and empty input is safe', () => {
  const sole = soleSlotPatterns(DAYS);
  for (const k of sole) assert.notEqual(k, undefined);
  assert.equal(soleSlotPatterns([]).size, 0);
  assert.equal(soleSlotPatterns(undefined).size, 0);
});

test('two slots of one pattern on the SAME day still means not sole', () => {
  const days = [{ id: 'push', exercises: [
    { name: 'Barbell bench press' },
    { name: 'Dumbbell bench press' },
  ] }];
  assert.ok(!soleSlotPatterns(days).has('chest_horizontal_push'));
});
