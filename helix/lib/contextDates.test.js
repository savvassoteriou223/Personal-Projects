import { test } from 'node:test';
import assert from 'node:assert';
import { relDate, daysAgo, toLocalDate, todayLine } from './contextDates.js';

const NOW = new Date(2026, 7, 12, 11, 40); // Wed 12 Aug 2026, local

test('the reported case: a session logged yesterday reads as yesterday', () => {
  // A workout finished Tue evening, coach opened Wed morning. The model was
  // being handed "Tue Aug 11" and calling it a week with no training.
  assert.equal(relDate(new Date(2026, 7, 11, 18, 30), NOW), 'Tue Aug 11 (YESTERDAY)');
  assert.equal(relDate(new Date(2026, 7, 12, 7, 0), NOW), 'Wed Aug 12 (TODAY)');
  assert.equal(relDate(new Date(2026, 7, 5, 9, 0), NOW), 'Wed Aug 5 (7 days ago)');
});

test('distance is counted in calendar days, not elapsed hours', () => {
  // 23:00 last night is 12 hours ago but ONE day ago. Rounding elapsed time
  // would call it 0 and the coach would claim you trained today.
  assert.equal(daysAgo(new Date(2026, 7, 11, 23, 0), NOW), 1);
  assert.equal(daysAgo(new Date(2026, 7, 12, 0, 5), NOW), 0);
  assert.equal(daysAgo(new Date(2026, 7, 12, 23, 59), NOW), 0);
});

test('date-only columns are read as local days, not UTC instants', () => {
  // health_logs.date / nutrition_logs.date / check-in date are 'yyyy-MM-dd'.
  // new Date('2026-08-12') is UTC midnight — the previous evening in every
  // western timezone, which mislabels today's own check-in as yesterday.
  const d = toLocalDate('2026-08-12');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 12);
  assert.equal(d.getHours(), 0);
  assert.equal(relDate('2026-08-12', NOW), 'Wed Aug 12 (TODAY)');
  assert.equal(relDate('2026-08-11', NOW), 'Tue Aug 11 (YESTERDAY)');
});

test('future dates and junk degrade safely', () => {
  assert.equal(relDate(new Date(2026, 7, 14), NOW), 'Fri Aug 14 (in 2 days)');
  assert.equal(relDate('not a date', NOW), 'unknown date');
  assert.equal(relDate(null, NOW), 'unknown date');
});

test('the anchor states the year, so no date is ambiguous', () => {
  const line = todayLine(NOW);
  assert.match(line, /TODAY IS Wednesday, 12 August 2026\./);
  assert.match(line, /do not tell the user they have not trained/);
});
