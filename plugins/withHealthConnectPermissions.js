// The react-native-health-connect Expo plugin only injects the
// ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter — it IGNORES the `permissions`
// array passed in app.json and never declares the actual health permissions, nor
// the Android 14+ usage activity-alias. Without the <uses-permission> entries,
// Health Connect has nothing to grant and requestPermission() returns empty —
// which is exactly the "Connect does nothing" bug. This plugin adds:
//   1. the READ permissions Helix needs,
//   2. the <queries> entry so getSdkStatus() can see Health Connect on Android 13-,
//   3. the Android 14+ VIEW_PERMISSION_USAGE activity-alias so Helix appears in
//      the Health Connect permissions screen.
const { withAndroidManifest } = require('@expo/config-plugins');

const READ_PERMISSIONS = [
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_STEPS',
];

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

module.exports = function withHealthConnectPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // 1. Declare the health read permissions.
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of READ_PERMISSIONS) {
      if (!manifest['uses-permission'].some(p => p.$?.['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    // 2. Make the Health Connect package visible to package queries (Android 11+
    //    package visibility) so getSdkStatus() reports correctly on Android 13-,
    //    where Health Connect is a separately installed app.
    manifest.queries = manifest.queries || [];
    const hasHcPackage = manifest.queries.some(q =>
      (q.package || []).some(p => p.$?.['android:name'] === HEALTH_CONNECT_PACKAGE)
    );
    if (!hasHcPackage) {
      manifest.queries.push({ package: [{ $: { 'android:name': HEALTH_CONNECT_PACKAGE } }] });
    }

    // 3. Android 14+ requires an activity that handles VIEW_PERMISSION_USAGE with
    //    the HEALTH_PERMISSIONS category, or the app never shows up in Health
    //    Connect's permission UI.
    const application = manifest.application[0];
    application['activity-alias'] = application['activity-alias'] || [];
    const aliasName = 'ViewPermissionUsageActivity';
    if (!application['activity-alias'].some(a => a.$?.['android:name'] === aliasName)) {
      application['activity-alias'].push({
        $: {
          'android:name': aliasName,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }

    return config;
  });
};
