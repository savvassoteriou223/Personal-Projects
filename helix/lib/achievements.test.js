/**
 * Guards the achievement ladder.
 *
 * The ladder decides the headline on a sticker the user posts publicly, so the
 * failure modes are worse than a wrong pixel: claiming a PR that did not happen
 * is a lie printed under someone's face, and never claiming one makes the whole
 * feature pointless. The rungs below are ordered, and order is the behaviour —
 * a PR must outrank a streak milestone that lands the same day.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAchievement,
  bestWorkingSets,
  sessionVolume,
  streakWeeks,
  STREAK_MILESTONES,
} from './achievements.js';

const set = (weight, reps, extra = {}) => ({ weight: String(weight), reps: String(reps), done: true, ...extra });
const ex = (name, ...sets) => ({ name, completedSets: sets });

// ─── bestWorkingSets ────────────────────────────────────────────────────────

test('best set is the heaviest, with reps breaking a tie', () => {
  const b = bestWorkingSets([ex('Bench', set(80, 8), set(85, 5), set(85, 8), set(70, 12))]);
  assert.equal(b.Bench.weight, 85);
  assert.equal(b.Bench.reps, 8);
});

test('warm-ups can never set the best', () => {
  const b = bestWorkingSets([ex('Bench', set(100, 3, { type: 'warmup' }), set(80, 8))]);
  assert.equal(b.Bench.weight, 80);
});

test('unfinished and empty sets are ignored', () => {
  const b = bestWorkingSets([ex('Bench',
    { weight: '120', reps: '5', done: false },
    { weight: '', reps: '', done: true },
    set(80, 8),
  )]);
  assert.equal(b.Bench.weight, 80);
});

test('a bodyweight exercise with no load produces no best set', () => {
  const b = bestWorkingSets([ex('Pull-up', set('', 10))]);
  assert.equal(b['Pull-up'], undefined);
});

// ─── sessionVolume ──────────────────────────────────────────────────────────

test('volume sums working sets and excludes warm-ups', () => {
  const v = sessionVolume([
    ex('Squat', set(100, 5), set(100, 5), set(60, 10, { type: 'warmup' })),
    ex('Leg press', set(200, 10)),
  ]);
  assert.equal(v, 100 * 5 + 100 * 5 + 200 * 10);
});

// ─── the ladder ─────────────────────────────────────────────────────────────

test('beating your heaviest ever is a PR', () => {
  const a = detectAchievement({
    sets: [ex('Bench', set(85, 8))],
    priorBests: { Bench: { weight: 82.5, reps: 8 } },
  });
  assert.equal(a.type, 'pr');
  assert.equal(a.exercise, 'Bench');
  assert.equal(a.weight, 85);
  assert.equal(a.gainKg, 2.5);
});

test('a first-ever exercise is NOT a PR', () => {
  // Everything is a record the first time you do it; announcing that is noise.
  const a = detectAchievement({
    sets: [ex('Pendulum squat', set(140, 8))],
    priorBests: {},
    focus: 'Quads',
  });
  assert.equal(a.type, 'muscles');
});

test('matching your best is not a PR', () => {
  const a = detectAchievement({
    sets: [ex('Bench', set(85, 8))],
    priorBests: { Bench: { weight: 85, reps: 6 } },
    focus: 'Chest',
  });
  assert.equal(a.type, 'muscles');
});

test('when two lifts PR, the bigger jump wins the headline', () => {
  const a = detectAchievement({
    sets: [ex('Bench', set(85, 8)), ex('Squat', set(150, 5))],
    priorBests: { Bench: { weight: 82.5, reps: 8 }, Squat: { weight: 140, reps: 5 } },
  });
  assert.equal(a.exercise, 'Squat');
  assert.equal(a.gainKg, 10);
});

test('a PR outranks a streak milestone landing the same day', () => {
  const a = detectAchievement({
    sets: [ex('Bench', set(85, 8))],
    priorBests: { Bench: { weight: 80, reps: 8 } },
    streakWeeks: 12,
  });
  assert.equal(a.type, 'pr');
});

test('a milestone week with no PR announces the streak', () => {
  const a = detectAchievement({
    sets: [ex('Bench', set(80, 8))],
    priorBests: { Bench: { weight: 85, reps: 8 } },
    streakWeeks: 12,
  });
  assert.equal(a.type, 'streak');
  assert.equal(a.weeks, 12);
});

test('a non-milestone streak week says nothing about the streak', () => {
  const a = detectAchievement({
    sets: [ex('Bench', set(80, 8))],
    priorBests: { Bench: { weight: 85, reps: 8 } },
    streakWeeks: 7,
    focus: 'Chest',
  });
  assert.equal(a.type, 'muscles');
});

test('every declared milestone is actually reachable', () => {
  STREAK_MILESTONES.forEach(weeks => {
    const a = detectAchievement({
      sets: [ex('Bench', set(80, 8))],
      priorBests: { Bench: { weight: 85, reps: 8 } },
      streakWeeks: weeks,
    });
    assert.equal(a.type, 'streak', `week ${weeks} should announce`);
  });
});

test('heaviest-ever session needs real history behind it', () => {
  // Two prior sessions is not a record worth printing.
  const a = detectAchievement({
    sets: [ex('Squat', set(100, 10))],
    priorBests: { Squat: { weight: 120, reps: 5 } },
    priorVolumes: [500, 600],
    focus: 'Quads',
  });
  assert.equal(a.type, 'muscles');
});

test('beating the previous best session by a clear margin is heaviest', () => {
  const a = detectAchievement({
    sets: [ex('Squat', set(100, 20))],   // 2000
    priorBests: { Squat: { weight: 120, reps: 5 } },
    priorVolumes: [1500, 1400, 1600, 1200],
  });
  assert.equal(a.type, 'heaviest');
  assert.equal(a.volumeKg, 2000);
  assert.ok(a.overAveragePct > 0);
});

test('scraping past the old best by rounding is not heaviest', () => {
  const a = detectAchievement({
    sets: [ex('Squat', set(100, 10))],   // 1000
    priorBests: { Squat: { weight: 120, reps: 5 } },
    priorVolumes: [990, 950, 900, 980],  // best 990, +1% — inside the margin
    focus: 'Quads',
  });
  assert.equal(a.type, 'muscles');
});

test('the ladder always returns something', () => {
  const a = detectAchievement({});
  assert.equal(a.type, 'muscles');
});

test('an empty session never claims anything', () => {
  const a = detectAchievement({
    sets: [ex('Bench', { weight: '', reps: '', done: false })],
    priorBests: { Bench: { weight: 40, reps: 8 } },
    priorVolumes: [900, 800, 850, 870],
  });
  assert.equal(a.type, 'muscles');
  assert.equal(a.volumeKg, 0);
});

// ─── streakWeeks ────────────────────────────────────────────────────────────

const WED = new Date('2026-08-19T10:00:00Z');       // a Wednesday
const daysAgo = n => new Date(WED.getTime() - n * 86400000).toISOString();

test('training this week alone is a one-week streak', () => {
  assert.equal(streakWeeks([daysAgo(1)], WED), 1);
});

test('consecutive weeks accumulate', () => {
  assert.equal(streakWeeks([daysAgo(1), daysAgo(8), daysAgo(15)], WED), 3);
});

test('a missed week ends the streak', () => {
  // this week + two weeks ago, nothing last week
  assert.equal(streakWeeks([daysAgo(1), daysAgo(15)], WED), 1);
});

test('several sessions in one week still count as one week', () => {
  assert.equal(streakWeeks([daysAgo(0), daysAgo(1), daysAgo(2)], WED), 1);
});

test('no history is a zero streak, not a crash', () => {
  assert.equal(streakWeeks([], WED), 0);
  assert.equal(streakWeeks(undefined, WED), 0);
});

test('garbage timestamps are skipped rather than thrown on', () => {
  assert.equal(streakWeeks(['not a date', daysAgo(1)], WED), 1);
});
