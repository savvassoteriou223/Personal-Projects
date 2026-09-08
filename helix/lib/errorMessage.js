// Map any auth/network error to a SAFE, user-facing message. NEVER surface a raw
// error.message in the UI — those can leak the backend hostname, stack traces,
// and other internals (e.g. "UnknownHostException: ...<project>.supabase.co").
// `t` is the i18next translate fn; defaultValue keeps it working before keys exist.
export function friendlyAuthError(err, t) {
  const tr = typeof t === 'function' ? t : (_k, o) => o?.defaultValue;
  const msg = (err?.message || '').toLowerCase();
  if (/fetch|network|resolve|host|timed out|timeout|unreachable|connection|failed to fetch|networkerror|offline/.test(msg)) {
    return tr('auth.errors.connection', { defaultValue: 'Couldn’t connect. Check your internet connection and try again.' });
  }
  if (/invalid login|invalid credentials|invalid email or password/.test(msg)) {
    return tr('auth.errors.invalidCredentials', { defaultValue: 'Wrong email or password.' });
  }
  if (/already registered|already exists|user already/.test(msg)) {
    return tr('auth.errors.alreadyRegistered', { defaultValue: 'An account with this email already exists.' });
  }
  if (/email not confirmed|not confirmed/.test(msg)) {
    return tr('auth.errors.emailNotConfirmed', { defaultValue: 'Please confirm your email, then sign in.' });
  }
  if (/rate limit|too many/.test(msg)) {
    return tr('auth.errors.rateLimited', { defaultValue: 'Too many attempts. Please wait a moment and try again.' });
  }
  if (/password/.test(msg) && /short|least|weak/.test(msg)) {
    return tr('auth.errors.passwordShort', { defaultValue: 'Password is too short.' });
  }
  return tr('auth.errors.generic', { defaultValue: 'Something went wrong. Please try again.' });
}
