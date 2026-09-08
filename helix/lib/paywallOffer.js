/**
 * paywallOffer — what the paywall is allowed to CLAIM, derived from the store.
 *
 * Extracted from PremiumPaywall for the same reason recoveryMap was extracted
 * from TodayScreen: it could not be tested inside a .jsx component, and this is
 * the code that must never lie. The paywall used to hard-code "7-day free
 * trial", a "Start free trial" button and a "SAVE 50%" badge regardless of what
 * was actually configured. If no trial existed, that button charged the user
 * immediately — a misleading-claim rejection and a refund magnet.
 *
 * Pure: RevenueCat package/price data in, claims out.
 */

/**
 * The free trial a package actually carries, or null.
 *
 * iOS reports it as product.introPrice with a zero price; Android as the
 * freePhase of the subscription option. A PAID introductory price is not a
 * trial and must not be described as one.
 */
export function trialOf(pkg) {
  const product = pkg?.product;
  if (!product) return null;

  const intro = product.introPrice;
  if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
    return { count: intro.periodNumberOfUnits, unit: String(intro.periodUnit || '').toUpperCase() };
  }

  const period = product.defaultOption?.freePhase?.billingPeriod;
  if (period && period.value > 0) {
    return { count: period.value, unit: String(period.unit || '').toUpperCase() };
  }

  return null;
}

/**
 * "7-day free trial", "2-week free trial". The unit stays singular: it is a
 * compound modifier, not a count. An unrecognised unit returns null so the UI
 * makes no claim rather than a broken one.
 */
export function trialLabel(trial) {
  if (!trial) return null;
  const unit = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }[trial.unit];
  return unit ? `${trial.count}-${unit} free trial` : null;
}

// RevenueCat's INTRO_ELIGIBILITY_STATUS: 0 UNKNOWN, 1 INELIGIBLE, 2 ELIGIBLE,
// 3 NO_INTRO_OFFER_EXISTS.
const INELIGIBLE = 1, NO_INTRO_OFFER = 3;

/**
 * Whether the store has definitely refused this user a trial.
 *
 * Only a definite no counts. Android answers UNKNOWN for every product, so
 * treating UNKNOWN as a refusal would hide the trial on Android entirely —
 * there the store has already filtered ineligible offers out of the offering.
 */
export function deniesTrial(entry) {
  return entry?.status === INELIGIBLE || entry?.status === NO_INTRO_OFFER;
}

/**
 * Saving of the yearly plan against twelve months of the monthly one, or null
 * when there is nothing honest to claim. Replaces a hard-coded "SAVE 50%" that
 * no price change ever updated.
 */
export function yearlySaving(monthlyPrice, yearlyPrice) {
  if (!monthlyPrice || !yearlyPrice) return null;
  const full = monthlyPrice * 12;
  if (full <= 0 || yearlyPrice >= full) return null;
  const pct = Math.round((1 - yearlyPrice / full) * 100);
  return pct >= 5 ? pct : null;
}
