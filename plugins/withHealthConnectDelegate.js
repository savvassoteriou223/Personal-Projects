// react-native-health-connect's own Expo plugin only edits the manifest — it does
// NOT register the permission delegate, so requesting Health Connect permissions
// crashes with "lateinit property requestPermission has not been initialized".
// This plugin injects the required MainActivity.onCreate registration.
const { withMainActivity } = require('@expo/config-plugins');

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, (config) => {
    let src = config.modResults.contents;
    const isKotlin = config.modResults.language === 'kt';
    if (!isKotlin) return config; // Expo SDK 56 MainActivity is Kotlin

    // 1. Add the import once, right after the package declaration.
    if (!src.includes(IMPORT)) {
      src = src.replace(/^(package .*)$/m, `$1\n\n${IMPORT}`);
    }

    // 2. Register the delegate inside onCreate (idempotent).
    if (!src.includes(CALL)) {
      if (/override fun onCreate\s*\(/.test(src)) {
        // Insert immediately after the existing super.onCreate(...) call.
        src = src.replace(/(super\.onCreate\([^)]*\))/, `$1\n    ${CALL}`);
      } else {
        // No onCreate present — add a minimal one after the class opening brace.
        src = src.replace(
          /(class MainActivity[^{]*\{)/,
          `$1\n  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n    super.onCreate(savedInstanceState)\n    ${CALL}\n  }\n`
        );
      }
    }

    config.modResults.contents = src;
    return config;
  });
};
