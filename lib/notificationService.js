import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROACTIVE_LAST_KEY = '@helix_proactive_last';
const REMINDER_PREFS_KEY = '@helix_reminder_prefs';

// Marks the local notifications we schedule ourselves, so cancelling reminders
// never touches a notification some other part of the app queued.
const REMINDER_TYPE = 'workout_reminder';

export const DEFAULT_REMINDER_PREFS = { enabled: false, hour: 18, minute: 0 };

// Which weekdays a given training frequency maps to. expo-notifications weekdays
// are 1=Sunday..7=Saturday. Days are spread so rest falls between sessions rather
// than stacking the week front-loaded — the profile stores only a count
// (weekly_workouts), never specific days.
const REMINDER_WEEKDAYS = {
  1: [2],                    // Mon
  2: [2, 5],                 // Mon, Thu
  3: [2, 4, 6],              // Mon, Wed, Fri
  4: [2, 3, 5, 6],           // Mon, Tue, Thu, Fri
  5: [2, 3, 4, 6, 7],        // Mon, Tue, Wed, Fri, Sat
  6: [2, 3, 4, 5, 6, 7],     // Mon–Sat
  7: [1, 2, 3, 4, 5, 6, 7],
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert is deprecated in favour of the banner/list split.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function registerForPushNotifications(supabase, userId) {
  if (Platform.OS === 'web') return null;

  await ensureAndroidChannel();

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

// ---------------------------------------------------------------------------
// Workout reminders
//
// These are LOCAL notifications with a weekly calendar trigger, so they fire
// while the app is closed. The proactive nudge above cannot: it uses
// `trigger: null` from a screen effect, so it only ever fires with Helix open.
// ---------------------------------------------------------------------------

export async function getReminderPrefs() {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_PREFS_KEY);
    return raw ? { ...DEFAULT_REMINDER_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_REMINDER_PREFS };
  } catch {
    return { ...DEFAULT_REMINDER_PREFS };
  }
}

export async function setReminderPrefs(prefs) {
  const next = { ...DEFAULT_REMINDER_PREFS, ...prefs };
  await AsyncStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(next));
  return next;
}

export async function cancelWorkoutReminders() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => n.content?.data?.type === REMINDER_TYPE)
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {
    // Nothing to cancel, or the platform refused — reminders stay as they were.
  }
}

// Rebuilds the whole reminder schedule from the current prefs + training
// frequency. Safe to call repeatedly: it always cancels first, so it cannot
// stack duplicates when the user edits their days-per-week.
export async function syncWorkoutReminders({ weeklyWorkouts, content } = {}) {
  if (Platform.OS === 'web') return 0;
  try {
    await cancelWorkoutReminders();

    const prefs = await getReminderPrefs();
    if (!prefs.enabled) return 0;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return 0;

    await ensureAndroidChannel();

    const days = Math.min(7, Math.max(1, parseInt(weeklyWorkouts, 10) || 3));
    const weekdays = REMINDER_WEEKDAYS[days] || REMINDER_WEEKDAYS[3];

    await Promise.all(weekdays.map(weekday =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: content?.title || 'Training day',
          body: content?.body || 'Your session is ready when you are.',
          data: { type: REMINDER_TYPE },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: prefs.hour,
          minute: prefs.minute,
          channelId: 'default',
        },
      })
    ));

    return weekdays.length;
  } catch {
    return 0;
  }
}

// Turning reminders on is the one place we ask for permission outside sign-in,
// because the user just asked for notifications explicitly.
export async function enableWorkoutReminders({ weeklyWorkouts, content } = {}) {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;

  await setReminderPrefs({ ...(await getReminderPrefs()), enabled: true });
  await syncWorkoutReminders({ weeklyWorkouts, content });
  return true;
}
