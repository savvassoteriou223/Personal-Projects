import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HEALTH_AUTHORIZED_KEY = '@helix_health_authorized';

// ─── Lazy-load native modules (graceful fallback if not installed) ─────────────
let _hk = null;
let _hc = null;

function getHealthkit() {
  if (_hk !== null) return _hk;
  try { _hk = require('@kingstinct/react-native-healthkit'); }
  catch { _hk = undefined; }
  return _hk;
}

function getHealthConnect() {
  if (_hc !== null) return _hc;
  try { _hc = require('react-native-health-connect'); }
  catch { _hc = undefined; }
  return _hc;
}

export function isHealthKitAvailable() {
  if (Platform.OS !== 'ios') return false;
  return getHealthkit() != null;
}

export function isHealthConnectAvailable() {
  if (Platform.OS !== 'android') return false;
  return getHealthConnect() != null;
}

export function isHealthAvailable() {
  return isHealthKitAvailable() || isHealthConnectAvailable();
}

// ─── Permissions ──────────────────────────────────────────────────────────────
export async function requestHealthPermissions() {
  if (Platform.OS === 'ios') {
    const hk = getHealthkit();
    if (!hk) return false;
    try {
      const { HKQuantityTypeIdentifier, HKCategoryTypeIdentifier } = hk;
      await hk.default.requestAuthorization(
        [
          HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
          HKQuantityTypeIdentifier.restingHeartRate,
          HKCategoryTypeIdentifier.sleepAnalysis,
        ],
        []
      );
      await AsyncStorage.setItem(HEALTH_AUTHORIZED_KEY, '1');
      return true;
    } catch { return false; }
  }

  if (Platform.OS === 'android') {
    const hc = getHealthConnect();
    if (!hc) return false;
    try {
      await hc.initialize();
      const granted = await hc.requestPermission([
        { accessType: 'read', recordType: 'SleepSession' },
        { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
        { accessType: 'read', recordType: 'RestingHeartRate' },
      ]);
      if (granted) await AsyncStorage.setItem(HEALTH_AUTHORIZED_KEY, '1');
      return !!granted;
    } catch { return false; }
  }

  return false;
}

export async function isHealthAuthorized() {
  if (!isHealthAvailable()) return false;
  const val = await AsyncStorage.getItem(HEALTH_AUTHORIZED_KEY);
  return val === '1';
}

export async function disconnectHealth() {
  await AsyncStorage.removeItem(HEALTH_AUTHORIZED_KEY);
}

// ─── Sleep ────────────────────────────────────────────────────────────────────
// Returns hours of sleep for the most recent night (last 18h window)
export async function getLastNightSleep() {
  const end = new Date();
  const start = new Date(end.getTime() - 18 * 3600000);

  if (Platform.OS === 'ios') {
    const hk = getHealthkit();
    if (!hk) return null;
    try {
      const { HKCategoryTypeIdentifier, HKCategoryValueSleepAnalysis } = hk;
      const Healthkit = hk.default;
      const samples = await Healthkit.queryCategorySamples(
        HKCategoryTypeIdentifier.sleepAnalysis,
        { from: start, to: end }
      );
      // Include all asleep stages (Core=1, Deep=3, REM=4 on Apple Watch)
      const ASLEEP = new Set([
        HKCategoryValueSleepAnalysis.asleepCore,
        HKCategoryValueSleepAnalysis.asleepDeep,
        HKCategoryValueSleepAnalysis.asleepREM,
        HKCategoryValueSleepAnalysis.asleep,
      ]);
      const totalMs = samples
        .filter(s => ASLEEP.has(s.value))
        .reduce((acc, s) => acc + (new Date(s.endDate) - new Date(s.startDate)), 0);
      return totalMs > 0 ? +(totalMs / 3600000).toFixed(1) : null;
    } catch { return null; }
  }

  if (Platform.OS === 'android') {
    const hc = getHealthConnect();
    if (!hc) return null;
    try {
      await hc.initialize();
      const { records } = await hc.readRecords('SleepSession', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      const totalMs = records.reduce((acc, r) => acc + (new Date(r.endTime) - new Date(r.startTime)), 0);
      return totalMs > 0 ? +(totalMs / 3600000).toFixed(1) : null;
    } catch { return null; }
  }

  return null;
}

// ─── HRV ──────────────────────────────────────────────────────────────────────
// Returns latest HRV in ms. iOS: SDNN. Android: RMSSD. Both are valid recovery signals.
export async function getLatestHRV() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600000);

  if (Platform.OS === 'ios') {
    const hk = getHealthkit();
    if (!hk) return null;
    try {
      const { HKQuantityTypeIdentifier } = hk;
      const Healthkit = hk.default;
      const samples = await Healthkit.queryQuantitySamples(
        HKQuantityTypeIdentifier.heartRateVariabilitySDNN,
        { from: start, to: end, limit: 1, ascending: false, unit: 'ms' }
      );
      const val = samples[0]?.quantity;
      return val != null ? Math.round(val) : null;
    } catch { return null; }
  }

  if (Platform.OS === 'android') {
    const hc = getHealthConnect();
    if (!hc) return null;
    try {
      await hc.initialize();
      const { records } = await hc.readRecords('HeartRateVariabilityRmssd', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      if (!records.length) return null;
      return Math.round(records[records.length - 1].heartRateVariabilityMillis);
    } catch { return null; }
  }

  return null;
}

// ─── Resting Heart Rate ───────────────────────────────────────────────────────
export async function getRestingHeartRate() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600000);

  if (Platform.OS === 'ios') {
    const hk = getHealthkit();
    if (!hk) return null;
    try {
      const { HKQuantityTypeIdentifier } = hk;
      const Healthkit = hk.default;
      const samples = await Healthkit.queryQuantitySamples(
        HKQuantityTypeIdentifier.restingHeartRate,
        { from: start, to: end, limit: 1, ascending: false, unit: 'count/min' }
      );
      const val = samples[0]?.quantity;
      return val != null ? Math.round(val) : null;
    } catch { return null; }
  }

  if (Platform.OS === 'android') {
    const hc = getHealthConnect();
    if (!hc) return null;
    try {
      await hc.initialize();
      const { records } = await hc.readRecords('RestingHeartRate', {
        timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      });
      if (!records.length) return null;
      return records[records.length - 1].beatsPerMinute;
    } catch { return null; }
  }

  return null;
}

// ─── Recovery synthesis ───────────────────────────────────────────────────────
// Returns { label, color, advice } or null if no data
export function buildRecoveryStatus(hrv, sleepHours, rhr) {
  let points = 0;
  let maxPoints = 0;

  if (sleepHours !== null) {
    maxPoints += 2;
    if (sleepHours >= 7.5) points += 2;
    else if (sleepHours >= 6.5) points += 1;
    // <6.5h → 0 points
  }

  if (hrv !== null) {
    maxPoints += 2;
    if (hrv >= 55) points += 2;
    else if (hrv >= 35) points += 1;
    // <35ms → 0 points
  }

  if (rhr !== null) {
    maxPoints += 1;
    if (rhr <= 65) points += 1;
    // elevated RHR → 0 points
  }

  if (maxPoints === 0) return null;

  const ratio = points / maxPoints;

  if (ratio >= 0.7) return {
    label: 'Ready',
    color: '#1D9E75',
    advice: null,
  };
  if (ratio >= 0.4) return {
    label: 'Moderate',
    color: '#BA7517',
    advice: 'Consider reducing weight by 10% on heavy sets today.',
  };
  return {
    label: 'Low',
    color: '#E24B4A',
    advice: 'Poor recovery detected. A deload or rest is recommended today.',
  };
}

// ─── Main export: fetch everything ───────────────────────────────────────────
export async function getRecoveryData() {
  const [sleep, hrv, rhr] = await Promise.all([
    getLastNightSleep(),
    getLatestHRV(),
    getRestingHeartRate(),
  ]);
  return {
    sleep,
    hrv,
    rhr,
    status: buildRecoveryStatus(hrv, sleep, rhr),
  };
}
