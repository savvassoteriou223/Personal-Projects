const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAbiFilters(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('abiFilters')) return config;
    config.modResults.contents = contents.replace(
      /defaultConfig\s*\{/,
      'defaultConfig {\n        ndk {\n            abiFilters "arm64-v8a", "armeabi-v7a"\n        }'
    );
    return config;
  });
};
