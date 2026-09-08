import { Platform, Linking } from 'react-native';
import { supabase } from '../supabase';

// iOS App Store numeric ID — fill in once the app is published on the App Store.
const STORE_URLS = {
  ios: 'https://apps.apple.com/app/id<YOUR_IOS_APP_ID>',
  android: `https://play.google.com/store/apps/details?id=com.helixfit.app`,
};

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

export async function checkForUpdate(currentVersion) {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('latest_version')
      .single();
    if (!data?.latest_version) return false;
    return compareVersions(data.latest_version, currentVersion) > 0;
  } catch {
    return false;
  }
}

export function openStore() {
  const url = Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
  if (url.includes('<')) return; // store ID not configured yet — don't open a dead link
  Linking.openURL(url).catch(() => {});
}
