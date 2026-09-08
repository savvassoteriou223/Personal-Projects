const { withAndroidStyles } = require('@expo/config-plugins');

module.exports = function withBlackSplash(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    if (!styles.resources.style) return config;

    const setItem = (style, name, value) => {
      if (!style.item) style.item = [];
      const existing = style.item.find(i => i.$ && i.$.name === name);
      if (existing) existing._ = value;
      else style.item.push({ $: { name }, _: value });
    };

    for (const style of styles.resources.style) {
      const n = style.$.name || '';
      if (n === 'AppTheme' || n.includes('SplashScreen') || n.includes('Splash')) {
        setItem(style, 'android:windowSplashScreenBackground', '#000000');
        setItem(style, 'android:windowBackground', '#000000');
      }
    }

    return config;
  });
};
