/**
 * Render smoke tests for the share surfaces.
 *
 * These do NOT prove the feature works — there is no layout engine here and
 * nothing captures a PNG, so anything geometric or native still needs a device.
 * What they do prove is the class of bug that would otherwise reach a user's
 * public post: a crash on render, an `undefined` printed as text, a raw i18n
 * key on the sticker, or the transparency invariant being broken.
 *
 * That last one is the important one. StorySticker MUST paint no background
 * anywhere: captureRef yields transparency only where nothing is drawn, so one
 * stray backgroundColor turns the sticker into a black slab on top of the
 * user's photo — and it would look completely fine in the in-app preview,
 * which sits on a dark plate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import renderer from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { __missingKeys, __resetMissing } from 'react-i18next';

import StorySticker from './StorySticker.js';
import WorkoutShareSheet, { buildShareStats, ShareCard } from './WorkoutShareSheet.js';

// ─── helpers ────────────────────────────────────────────────────────────────

const render = (el) => {
  let tree;
  renderer.act(() => { tree = renderer.create(el); });
  return tree;
};

/** Every rendered node, flattened. */
function nodes(json) {
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    out.push(n);
    (n.children || []).forEach(walk);
  })(json);
  return out;
}

/** Every string a user would actually see. */
function texts(json) {
  const out = [];
  (function walk(n) {
    if (n == null) return;
    if (typeof n === 'string') { out.push(n); return; }
    if (typeof n !== 'object') return;
    (n.children || []).forEach(walk);
  })(json);
  return out;
}

const ACHIEVEMENTS = {
  pr:       { type: 'pr', exercise: 'Barbell bench press', weight: 85, reps: 8, prevWeight: 82.5, prevReps: 8, gainKg: 2.5, e1rm: 107 },
  streak:   { type: 'streak', weeks: 12 },
  heaviest: { type: 'heaviest', volumeKg: 12640, sessions: 6, overAveragePct: 18 },
  muscles:  { type: 'muscles', focus: 'Chest · Shoulders · Triceps', volumeKg: 4180 },
};

const BEST = { name: 'Barbell bench press', weight: 85, reps: 8 };

const sticker = (props) => render(
  React.createElement(StorySticker, {
    focus: 'Chest · Shoulders · Triceps', best: BEST, width: 320, ...props,
  }),
);

// ─── the transparency invariant ─────────────────────────────────────────────

test('the sticker paints no background except the percentile chip', () => {
  // The chip is the one filled element by design; anything else with a fill
  // becomes an opaque block sitting on the user's photo.
  for (const a of Object.values(ACHIEVEMENTS)) {
    const tree = sticker({ achievement: a, percentile: 12 }).toJSON();
    const filled = nodes(tree)
      .map(n => StyleSheet.flatten(n.props?.style))
      .filter(s => s && s.backgroundColor && s.backgroundColor !== 'transparent');

    assert.equal(filled.length, 1, `${a.type}: expected only the chip to be filled, got ${filled.length}`);
    assert.equal(filled[0].backgroundColor, '#2FD69C');
  }
});

test('with no percentile the sticker is entirely unpainted', () => {
  for (const a of Object.values(ACHIEVEMENTS)) {
    const tree = sticker({ achievement: a }).toJSON();
    const filled = nodes(tree)
      .map(n => StyleSheet.flatten(n.props?.style))
      .filter(s => s && s.backgroundColor && s.backgroundColor !== 'transparent');
    assert.equal(filled.length, 0, `${a.type} painted something`);
  }
});

// ─── every rung renders, and renders real words ─────────────────────────────

test('every achievement type renders without throwing', () => {
  for (const a of Object.values(ACHIEVEMENTS)) {
    assert.ok(sticker({ achievement: a }).toJSON(), `${a.type} rendered nothing`);
  }
});

test('no rendered text is undefined, null or NaN', () => {
  for (const a of Object.values(ACHIEVEMENTS)) {
    const seen = texts(sticker({ achievement: a, percentile: 12 }).toJSON());
    seen.forEach(s => {
      assert.ok(!/undefined|null|NaN/.test(s), `${a.type} rendered "${s}"`);
    });
  }
});

test('no rendered text is a raw translation key', () => {
  __resetMissing();
  for (const a of Object.values(ACHIEVEMENTS)) {
    texts(sticker({ achievement: a, percentile: 12 }).toJSON()).forEach(s => {
      assert.ok(!/^workout\.share\./.test(s), `rendered raw key: ${s}`);
    });
  }
  assert.deepEqual(__missingKeys, [], `keys missing from locales/en.json: ${__missingKeys.join(', ')}`);
});

test('the PR sticker states the lift, the weight and the gain', () => {
  const seen = texts(sticker({ achievement: ACHIEVEMENTS.pr }).toJSON()).join(' ');
  assert.match(seen, /NEW PR/);
  assert.match(seen, /Barbell bench press/);
  assert.match(seen, /85/);
  assert.match(seen, /2\.5/);
});

test('the percentile chip appears only when a percentile is supplied', () => {
  const without = texts(sticker({ achievement: ACHIEVEMENTS.pr }).toJSON()).join(' ');
  const with_ = texts(sticker({ achievement: ACHIEVEMENTS.pr, percentile: 12 }).toJSON()).join(' ');
  assert.ok(!/TOP/.test(without), 'chip rendered with no source');
  assert.match(with_, /TOP 12%/);
});

// ─── degenerate sessions ────────────────────────────────────────────────────

test('a bodyweight session with no loaded set still renders', () => {
  // best === null is the real bodyweight case: the hero collapses rather than
  // printing "undefined kg".
  const seen = texts(sticker({ achievement: ACHIEVEMENTS.muscles, best: null }).toJSON()).join(' ');
  assert.ok(!/undefined/.test(seen));
  assert.match(seen, /CHEST/);
});

test('a sticker with no focus and no best renders the mark and nothing broken', () => {
  const seen = texts(sticker({ achievement: { type: 'muscles' }, best: null, focus: '' }).toJSON()).join(' ');
  assert.match(seen, /HELIX/);
  assert.ok(!/undefined/.test(seen));
});

// ─── the sheet ──────────────────────────────────────────────────────────────

const SETS = [
  { name: 'Barbell bench press', completedSets: [{ weight: '85', reps: '8', done: true }] },
  { name: 'Incline dumbbell press', completedSets: [{ weight: '32.5', reps: '10', done: true }] },
];

test('the share sheet renders in its default story mode', () => {
  const stats = buildShareStats({ workoutName: 'Push A', focus: 'Chest · Triceps', sets: SETS, durationSec: 3120, streakWeeks: 12 });
  const tree = render(React.createElement(WorkoutShareSheet, {
    visible: true, stats, achievement: ACHIEVEMENTS.pr, onClose: () => {},
  })).toJSON();
  const seen = texts(tree).join(' ');
  assert.match(seen, /Story/);
  assert.match(seen, /NEW PR/);
  assert.ok(!/undefined/.test(seen));
});

test('the sheet survives a session with no rows at all', () => {
  // Pure bodyweight: buildShareStats produces zero rows, so `bestRow` is null.
  const stats = buildShareStats({
    workoutName: 'Calisthenics B', focus: 'Back · Biceps',
    sets: [{ name: 'Pull-up', completedSets: [{ weight: '', reps: '9', done: true }] }],
    durationSec: 1860,
  });
  // buildShareStats still emits a row for an unloaded set, with weight 0 —
  // which is exactly the case that used to render "0 kg × 9" on the sticker.
  assert.equal(stats.rows.length, 1);
  assert.equal(stats.rows[0].weight, 0);
  const tree = render(React.createElement(WorkoutShareSheet, {
    visible: true, stats, achievement: ACHIEVEMENTS.muscles, onClose: () => {},
  })).toJSON();
  const seen = texts(tree).join(' ');
  assert.ok(!/undefined/.test(seen));
  assert.ok(!/0 kg/.test(seen), 'claimed a zero-kilo lift on a bodyweight set');
});

test('the sheet renders with no achievement at all', () => {
  // openShare is best-effort: if every history query fails it still opens.
  const stats = buildShareStats({ workoutName: 'Push A', sets: SETS, durationSec: 3120 });
  const tree = render(React.createElement(WorkoutShareSheet, {
    visible: true, stats, achievement: null, onClose: () => {},
  })).toJSON();
  assert.ok(tree);
  assert.ok(!/undefined/.test(texts(tree).join(' ')));
});

test('the card still renders and reports reps when nothing was loaded', () => {
  const stats = buildShareStats({
    workoutName: 'Calisthenics B',
    sets: [{ name: 'Pull-up', completedSets: [{ weight: '', reps: '9', done: true }] }],
    durationSec: 1860,
  });
  const seen = texts(render(React.createElement(ShareCard, { stats, width: 320 })).toJSON()).join(' ');
  assert.match(seen, /REPS/);
  assert.ok(!/KG LIFTED/.test(seen), 'claimed tonnage on a bodyweight session');
});
