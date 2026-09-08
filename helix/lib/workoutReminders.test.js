import test from 'node:test';
import assert from 'node:assert/strict';

import * as N from 'expo-notifications';
import { __clear } from '@react-native-async-storage/async-storage';
import { __setPlatform } from 'react-native';

import {
  getReminderPrefs,
  setReminderPrefs,
  syncWorkoutReminders,
  enableWorkoutReminders,
  cancelWorkoutReminders,
} from './notificationService.js';

const reset = (permission = 'granted') => { N.__reset(permission); __clear(); __setPlatform('ios'); };

const weekdaysOf = () => N.state.scheduled
  .filter(n => n.content.data?.type === 'workout_reminder')
  .map(n => n.trigger.weekday)
  .sort((a, b) => a - b);

test('off by default — enabling nothing schedules nothing', async () => {
  reset();
  const prefs = await getReminderPrefs();
  assert.equal(prefs.enabled, false);
  const n = await syncWorkoutReminders({ weeklyWorkouts: 4 });
  assert.equal(n, 0);
  assert.equal(N.state.scheduled.length, 0);
});

test('enabling schedules one weekly trigger per training day', async () => {
  reset();
  const ok = await enableWorkoutReminders({ weeklyWorkouts: 4 });
  assert.equal(ok, true);
  assert.equal(N.state.scheduled.length, 4);
  assert.deepEqual(weekdaysOf(), [2, 3, 5, 6]); // Mon, Tue, Thu, Fri
  for (const n of N.state.scheduled) {
    assert.equal(n.trigger.type, 'weekly');
    assert.equal(n.trigger.hour, 18);
    assert.equal(n.trigger.minute, 0);
  }
});

test('every frequency 1-7 schedules exactly that many distinct days', async () => {
  for (let days = 1; days <= 7; days++) {
    reset();
    await enableWorkoutReminders({ weeklyWorkouts: days });
    const wd = weekdaysOf();
    assert.equal(wd.length, days, `${days} days/week scheduled ${wd.length}`);
    assert.equal(new Set(wd).size, days, `${days} days/week had duplicate weekdays`);
    assert.ok(wd.every(d => d >= 1 && d <= 7), `${days} days/week produced out-of-range weekday`);
  }
});

test('re-syncing does not stack duplicates', async () => {
  reset();
  await enableWorkoutReminders({ weeklyWorkouts: 3 });
  assert.equal(N.state.scheduled.length, 3);
  await syncWorkoutReminders({ weeklyWorkouts: 3 });
  await syncWorkoutReminders({ weeklyWorkouts: 3 });
  assert.equal(N.state.scheduled.length, 3);
});

test('changing days-per-week rebuilds the schedule', async () => {
  reset();
  await enableWorkoutReminders({ weeklyWorkouts: 6 });
  assert.equal(N.state.scheduled.length, 6);
  await syncWorkoutReminders({ weeklyWorkouts: 2 });
  assert.deepEqual(weekdaysOf(), [2, 5]);
  assert.equal(N.state.scheduled.length, 2);
});

test('cancelling leaves other notifications untouched', async () => {
  reset();
  await N.scheduleNotificationAsync({ content: { title: 'nudge', data: {} }, trigger: null });
  await enableWorkoutReminders({ weeklyWorkouts: 3 });
  assert.equal(N.state.scheduled.length, 4);
  await cancelWorkoutReminders();
  assert.equal(N.state.scheduled.length, 1);
  assert.equal(N.state.scheduled[0].content.title, 'nudge');
});

test('denied permission schedules nothing and stays off', async () => {
  reset('denied');
  const ok = await enableWorkoutReminders({ weeklyWorkouts: 4 });
  assert.equal(ok, false);
  assert.equal(N.state.scheduled.length, 0);
  const prefs = await getReminderPrefs();
  assert.equal(prefs.enabled, false);
});

test('permission revoked later — sync clears the schedule instead of throwing', async () => {
  reset();
  await enableWorkoutReminders({ weeklyWorkouts: 3 });
  assert.equal(N.state.scheduled.length, 3);
  N.state.permission = 'denied';
  const n = await syncWorkoutReminders({ weeklyWorkouts: 3 });
  assert.equal(n, 0);
  assert.equal(N.state.scheduled.length, 0);
});

test('turning off cancels everything', async () => {
  reset();
  await enableWorkoutReminders({ weeklyWorkouts: 5 });
  assert.equal(N.state.scheduled.length, 5);
  await setReminderPrefs({ enabled: false });
  await cancelWorkoutReminders();
  assert.equal(N.state.scheduled.length, 0);
});

test('chosen hour is persisted and applied', async () => {
  reset();
  await enableWorkoutReminders({ weeklyWorkouts: 3 });
  await setReminderPrefs({ enabled: true, hour: 6, minute: 0 });
  await syncWorkoutReminders({ weeklyWorkouts: 3 });
  assert.ok(N.state.scheduled.every(n => n.trigger.hour === 6));
  const prefs = await getReminderPrefs();
  assert.equal(prefs.hour, 6);
});

test('garbage weekly_workouts falls back to 3 days', async () => {
  for (const bad of [null, undefined, 0, -2, 99, 'abc']) {
    reset();
    await enableWorkoutReminders({ weeklyWorkouts: bad });
    const wd = weekdaysOf();
    assert.ok(wd.length >= 1 && wd.length <= 7, `input ${bad} produced ${wd.length} reminders`);
  }
  reset();
  await enableWorkoutReminders({ weeklyWorkouts: 'abc' });
  assert.deepEqual(weekdaysOf(), [2, 4, 6]);
});

test('android creates the notification channel before scheduling', async () => {
  reset();
  __setPlatform('android');
  await enableWorkoutReminders({ weeklyWorkouts: 3 });
  assert.ok(N.state.channels.some(c => c.id === 'default'));
  assert.ok(N.state.scheduled.every(n => n.trigger.channelId === 'default'));
});

test('web is a no-op', async () => {
  reset();
  __setPlatform('web');
  assert.equal(await enableWorkoutReminders({ weeklyWorkouts: 4 }), false);
  assert.equal(await syncWorkoutReminders({ weeklyWorkouts: 4 }), 0);
  assert.equal(N.state.scheduled.length, 0);
});

test('custom localized content reaches the scheduled notification', async () => {
  reset();
  await enableWorkoutReminders({
    weeklyWorkouts: 2,
    content: { title: 'Trainingstag', body: 'Deine Einheit wartet auf dich.' },
  });
  assert.ok(N.state.scheduled.every(n => n.content.title === 'Trainingstag'));
  assert.ok(N.state.scheduled.every(n => n.content.body === 'Deine Einheit wartet auf dich.'));
});
