// Resolves the app's extensionless relative imports for plain Node ESM.
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (err) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return next(specifier + '.js', context);
    }
    throw err;
  }
}
