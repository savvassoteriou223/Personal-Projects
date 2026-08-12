import { test } from 'node:test';
import assert from 'node:assert';
import { format } from 'date-fns';
import { reviewWindow, reviewWeekKey, inReviewWindow } from './reviewWeek.js';

const at = (y, m, d, h = 11) => new Date(y, m - 1, d, h);
const fmt = (x) => format(x, 'yyyy-MM-dd');

test('the reviewed week is always closed — it never includes today', () => {
  // Every day of one week must review the SAME window, and that window must end
  // before the current week starts. This is the property the whole fix rests on:
  // a window that cannot grow cannot contradict a cached summary of it.
  for (const day of [9, 10, 11, 12, 13, 14, 15]) { // Sun Aug 9 → Sat Aug 15 2026
    const now = at(2026, 8, day);
    const { start, end } = reviewWindow(now);
    assert.equal(fmt(start), '2026-08-02', `start on Aug ${day}`);
    assert.equal(fmt(end), '2026-08-09', `end on Aug ${day}`);
    assert.ok(end <= now, `window must have closed by Aug ${day}`);
    assert.equal(inReviewWindow(now, now), false, `Aug ${day} must not be in its own review window`);
  }
});

test('the window advances on Sunday, not mid-week', () => {
  assert.equal(fmt(reviewWindow(at(2026, 8, 8)).start), '2026-07-26');  // Sat — still last week's
  assert.equal(fmt(reviewWindow(at(2026, 8, 9)).start), '2026-08-02');  // Sun — rolls over
  assert.equal(fmt(reviewWindow(at(2026, 8, 15)).start), '2026-08-02'); // Sat — held
  assert.equal(fmt(reviewWindow(at(2026, 8, 16)).start), '2026-08-09'); // Sun — rolls over
});

test('a session logged today is never part of the reviewed week', () => {
  // The exact reported bug: trained Tue Aug 11, opened Coach Wed Aug 12.
  const now = at(2026, 8, 12);
  assert.equal(inReviewWindow(at(2026, 8, 11), now), false); // yesterday — current week
  assert.equal(inReviewWindow(at(2026, 8, 12), now), false); // today — current week
  assert.equal(inReviewWindow(at(2026, 8, 5), now), true);   // last Wed — reviewed week
  assert.equal(inReviewWindow(at(2026, 8, 8), now), true);   // last Sat — reviewed week, inclusive
  assert.equal(inReviewWindow(at(2026, 8, 2), now), true);   // last Sun — reviewed week, inclusive
  assert.equal(inReviewWindow(at(2026, 8, 1), now), false);  // two weeks back
});

test('the key is stable within a week and versioned away from pre-fix rows', () => {
  assert.equal(reviewWeekKey(at(2026, 8, 12)), 'v2-2026-08-02');
  assert.equal(reviewWeekKey(at(2026, 8, 15, 23)), 'v2-2026-08-02');
  assert.equal(reviewWeekKey(at(2026, 8, 16)), 'v2-2026-08-09');
  // Pre-fix keys were bare dates of the CURRENT week — no v2 key can collide.
  assert.ok(reviewWeekKey(at(2026, 8, 12)).startsWith('v2-'));
});

test('year boundaries do not produce a broken window', () => {
  const now = at(2027, 1, 2); // Sat
  const { start, end } = reviewWindow(now);
  assert.equal(fmt(start), '2026-12-20');
  assert.equal(fmt(end), '2026-12-27');
  assert.equal(Math.round((end - start) / 86400000), 7);
});
