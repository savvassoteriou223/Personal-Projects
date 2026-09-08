// Resolves the app's extensionless relative imports for plain Node ESM,
// redirects the handful of native-only packages to test stubs so lib/ modules
// that touch them can be unit-tested without a device, and transpiles JSX so
// screen components can be rendered with react-test-renderer.
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const stubDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'nativeStubs');

const NATIVE_STUBS = {
  'expo-notifications': 'expo-notifications.mjs',
  'react-native': 'react-native.mjs',
  '@react-native-async-storage/async-storage': 'async-storage.mjs',
  'react-i18next': 'react-i18next.mjs',
  'expo-haptics': 'expo-haptics.mjs',
};

export async function resolve(specifier, context, next) {
  const stub = NATIVE_STUBS[specifier];
  if (stub) {
    return { url: pathToFileURL(path.join(stubDir, stub)).href, shortCircuit: true };
  }
  try { return await next(specifier, context); }
  catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      // Extensionless relative import — try .js, then .jsx.
      try { return await next(specifier + '.js', context); }
      catch (_) { return next(specifier + '.jsx', context); }
    }
    // `./Foo.js` written against a file that is actually `./Foo.jsx`.
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      return next(specifier.slice(0, -3) + '.jsx', context);
    }
    throw err;
  }
}

// Node cannot parse JSX. Transform it with the standalone JSX plugin rather
// than babel-preset-expo, which compiles to CommonJS and would break the ESM
// graph the loader is feeding. Only JSX is touched; imports stay as they are.
export async function load(url, context, next) {
  if (url.endsWith('.jsx')) {
    const filename = fileURLToPath(url);
    const babel = require('@babel/core');
    const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
      filename, babelrc: false, configFile: false, sourceType: 'module',
      plugins: [[require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }]],
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return next(url, context);
}
