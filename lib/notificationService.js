import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROACTIVE_LAST_KEY = '@helix_proactive_last';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(supabase, userId) {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync();

  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  return token;
}

// Proactive coach nudge — a local notification fired when the home screen detects
// something a trainer would raise (low recovery, deload due, stall, missed days).
// Deduped per signal-key per day and rate-limited to once every 2 days overall so
// it never nags. No-ops if notification permission was not granted.
export async function maybeSendProactiveNudge(prompt) {
  if (Platform.OS === 'web' || !prompt?.key) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return false;

    const today = new Date().toISOString().slice(0, 10);
    const raw = await AsyncStorage.getItem(PROACTIVE_LAST_KEY);
    const last = raw ? JSON.parse(raw) : null;
    if (last) {
      const daysSince = (Date.now() - (last.ts || 0)) / 86400000;
      // Same message already shown today, or any nudge within the last 2 days.
      if (last.key === prompt.key && last.date === today) return false;
      if (daysSince < 2) return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: { title: prompt.title, body: prompt.body, data: { proactiveKey: prompt.key } },
      trigger: null, // deliver now
    });
    await AsyncStorage.setItem(PROACTIVE_LAST_KEY, JSON.stringify({ key: prompt.key, date: today, ts: Date.now() }));
    return true;
  } catch {
    return false;
  }
}
