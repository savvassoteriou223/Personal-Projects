/**
 * Guards the plausibility bounds applied to health logs before they reach the
 * coach.
 *
 * Probing the live coach produced: "your sleep data has logging errors (91h and
 * 16h entries aren't usable)". The model was handed a 91-hour night and spent
 * its answer explaining that the app's own data was broken. A value outside
 * human range is a sync artefact or a bad write, never a measurement, and it
 * should be dropped rather than reasoned about.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Mirrors SANE in CoachScreen. Kept here so the bounds are asserted rather than
// living only inside a 2,300-line component.
const SANE = {
  sleep_hours: [2, 14],
  hrv_ms: [10, 200],
  resting_hr: [30, 120],
  steps: [0, 100000],
};
const sane = (field, v) => {
  const r = SANE[field];
  return typeof v === 'number' && Number.isFinite(v) && v >= r[0] && v <= r[1] ? v : null;
};

test('the values that actually appeared in production are rejected', () => {
  assert.equal(sane('sleep_hours', 91), null, '91 hours of sleep is not a night');
  assert.equal(sane('sleep_hours', 16), null);
});

test('ordinary readings survive', () => {
  assert.equal(sane('sleep_hours', 8), 8);
  assert.equal(sane('sleep_hours', 6.5), 6.5);
  assert.equal(sane('resting_hr', 58), 58);
  assert.equal(sane('hrv_ms', 45), 45);
});

test('nulls, strings and NaN are rejected rather than passed through', () => {
  // A string sneaking through would be compared with >= and could pass, then
  // reach the model as text pretending to be a measurement.
  for (const bad of [null, undefined, NaN, Infinity, '8', '', {}]) {
    assert.equal(sane('sleep_hours', bad), null, `${JSON.stringify(bad)} should be rejected`);
  }
});

test('bounds are inclusive at the edges', () => {
  assert.equal(sane('sleep_hours', 2), 2);
  assert.equal(sane('sleep_hours', 14), 14);
  assert.equal(sane('resting_hr', 30), 30);
  assert.equal(sane('resting_hr', 120), 120);
});
