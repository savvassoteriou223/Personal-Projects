// Resolves the app's extensionless relative imports for plain Node ESM, and
// redirects the handful of native-only packages to test stubs so lib/ modules
// that touch them can be unit-tested without a device.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const stubDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'nativeStubs');

const NATIVE_STUBS = {
  'expo-notifications': 'expo-notifications.mjs',
  'react-native': 'react-native.mjs',
  '@react-native-async-storage/async-storage': 'async-storage.mjs',
};

export async function resolve(specifier, context, next) {
  const stub = NATIVE_STUBS[specifier];
  if (stub) {
    return { url: pathToFileURL(path.join(stubDir, stub)).href, shortCircuit: true };
  }
  try { return await next(specifier, context); }
  catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return next(specifier + '.js', context);
    }
    throw err;
  }
}
