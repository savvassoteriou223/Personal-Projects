// Fake expo-notifications: records every scheduled notification so a test can
// assert on the real schedule the service produced.
export const state = {
  scheduled: [],
  permission: 'granted',
  requestCalls: 0,
  channels: [],
  nextId: 1,
};

export function __reset(permission = 'granted') {
  state.scheduled = [];
  state.permission = permission;
  state.requestCalls = 0;
  state.channels = [];
  state.nextId = 1;
}

export const SchedulableTriggerInputTypes = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  CALENDAR: 'calendar',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
};

export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };

export function setNotificationHandler() {}

export async function setNotificationChannelAsync(id, config) {
  state.channels.push({ id, config });
}

export async function getPermissionsAsync() {
  return { status: state.permission };
}

export async function requestPermissionsAsync() {
  state.requestCalls++;
  return { status: state.permission };
}

export async function getExpoPushTokenAsync() {
  return { data: 'ExponentPushToken[test]' };
}

export async function scheduleNotificationAsync({ content, trigger }) {
  const identifier = `n${state.nextId++}`;
  state.scheduled.push({ identifier, content, trigger });
  return identifier;
}

export async function getAllScheduledNotificationsAsync() {
  return state.scheduled.map(n => ({ ...n }));
}

export async function cancelScheduledNotificationAsync(identifier) {
  state.scheduled = state.scheduled.filter(n => n.identifier !== identifier);
}
