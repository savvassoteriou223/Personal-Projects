/**
 * The paywall used to hard-code "7-day free trial", a "Start free trial" button
 * and a "SAVE 50%" badge regardless of what the stores actually offered. If no
 * trial was configured, that button charged the user on the spot — a
 * misleading-claim rejection and a refund magnet. These cases pin the derived
 * versions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { trialOf, trialLabel, deniesTrial, yearlySaving } from './paywallOffer.js';

const iosPkg = (intro) => ({ product: { identifier: 'm', introPrice: intro } });
const androidPkg = (freePhase) => ({ product: { identifier: 'm', introPrice: null, defaultOption: { freePhase } } });

test('no offer configured means no trial, on either platform', () => {
  assert.equal(trialOf(iosPkg(null)), null);
  assert.equal(trialOf(androidPkg(null)), null);
  assert.equal(trialOf({ product: { identifier: 'm' } }), null);
  assert.equal(trialOf(undefined), null);
  assert.equal(trialLabel(null), null);
});

test('iOS free trial is read from introPrice', () => {
  const t = trialOf(iosPkg({ price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 }));
  assert.deepEqual(t, { count: 7, unit: 'DAY' });
  assert.equal(trialLabel(t), '7-day free trial');
});

test('a PAID intro offer is not a free trial', () => {
  // A discounted first month is an intro price, not a trial. Calling it a free
  // trial is the same false claim in a different costume.
  assert.equal(trialOf(iosPkg({ price: 4.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 })), null);
});

test('Android free trial is read from the free phase of the base-plan offer', () => {
  const t = trialOf(androidPkg({ billingPeriod: { unit: 'WEEK', value: 2 } }));
  assert.deepEqual(t, { count: 2, unit: 'WEEK' });
  assert.equal(trialLabel(t), '2-week free trial');
});

test('the unit stays singular — it is a compound modifier, not a count', () => {
  assert.equal(trialLabel({ count: 14, unit: 'DAY' }), '14-day free trial');
  assert.equal(trialLabel({ count: 1, unit: 'MONTH' }), '1-month free trial');
});

test('an unrecognised period unit yields no claim rather than a broken one', () => {
  assert.equal(trialLabel({ count: 7, unit: 'UNKNOWN' }), null);
  assert.equal(trialLabel({ count: 7, unit: '' }), null);
});

test('only a definite no removes the trial', () => {
  assert.equal(deniesTrial({ status: 1 }), true,  'INELIGIBLE');
  assert.equal(deniesTrial({ status: 3 }), true,  'NO_INTRO_OFFER_EXISTS');
  assert.equal(deniesTrial({ status: 2 }), false, 'ELIGIBLE');
  // Android answers UNKNOWN for everything; treating it as a no would hide the
  // trial on Android entirely.
  assert.equal(deniesTrial({ status: 0 }), false, 'UNKNOWN');
  assert.equal(deniesTrial(undefined), false, 'no answer at all');
});

test('savings are computed from the real prices', () => {
  assert.equal(yearlySaving(10.99, 89.99), 32);
  assert.equal(yearlySaving(9.99, 69.99), 42);
  assert.equal(yearlySaving(10.99, 79.99), 39);
});

test('no badge when there is nothing to claim', () => {
  assert.equal(yearlySaving(10.99, null), null, 'yearly price missing');
  assert.equal(yearlySaving(null, 89.99), null, 'monthly price missing');
  assert.equal(yearlySaving(10.99, 131.88), null, 'yearly costs the same');
  assert.equal(yearlySaving(10.99, 200), null, 'yearly costs MORE');
  assert.equal(yearlySaving(10.99, 129), null, 'saving under 5% is not worth a badge');
});
