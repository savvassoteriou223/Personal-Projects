import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import LanguagePicker from '../components/LanguagePicker';
import { LANGUAGES } from '../lib/i18n';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';
import {
  getReminderPrefs,
  setReminderPrefs,
  enableWorkoutReminders,
  syncWorkoutReminders,
  cancelWorkoutReminders,
} from '../lib/notificationService';

// Reminder times worth offering. A full time picker would need a new native
// dependency for a setting most people set once, so this is a fixed ladder
// covering early-morning through late-evening training.
const REMINDER_HOURS = [5, 6, 7, 8, 9, 12, 16, 17, 18, 19, 20, 21];

export default function SettingsScreen({ visible, onClose, onSignOut, weeklyWorkouts }) {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const [reminders, setReminders] = useState(null);

  useEffect(() => {
    if (visible) getReminderPrefs().then(setReminders);
  }, [visible]);

  const reminderContent = useCallback(() => ({
    title: t('settings.reminderPushTitle'),
    body: t('settings.reminderPushBody'),
  }), [t]);

  const toggleReminders = async (on) => {
    if (on) {
      const ok = await enableWorkoutReminders({ weeklyWorkouts, content: reminderContent() });
      if (!ok) {
        Alert.alert(t('settings.reminderDeniedTitle'), t('settings.reminderDeniedMsg'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.openSettings'), onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      setReminders(await getReminderPrefs());
    } else {
      setReminders(await setReminderPrefs({ ...reminders, enabled: false }));
      await cancelWorkoutReminders();
    }
  };

  const pickHour = async (hour) => {
    const next = await setReminderPrefs({ ...reminders, hour, minute: 0 });
    setReminders(next);
    await syncWorkoutReminders({ weeklyWorkouts, content: reminderContent() });
  };

  const signOut = async () => { await supabase.auth.signOut(); onSignOut?.(); };

  const deleteAccount = () => {
    Alert.alert(
      t('profile.alerts.deleteTitle'),
      t('profile.alerts.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.alerts.deletePermanently'),
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { error } = await supabase.functions.invoke('delete-account', {});
            if (error) {
              Alert.alert(t('profile.alerts.errorTitle'), t('profile.alerts.deleteError'));
              return;
            }
            await supabase.auth.signOut();
            onSignOut?.();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.title')}</Text>
          <Tappable onPress={onClose}><Text style={styles.doneBtn}>{t('common.done')}</Text></Tappable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Language */}
          <View style={styles.card}>
            <Tappable style={styles.langRow} onPress={() => setLangOpen(true)}>
              <Text style={styles.cardTitle}>{t('language.settingsLabel')}</Text>
              <View style={styles.langRowRight}>
                <Text style={styles.langRowValue}>
                  {(LANGUAGES.find(l => l.code === i18n.language?.split('-')[0]) || LANGUAGES[0]).label}
                </Text>
                <Text style={styles.dropdownArrow}>▸</Text>
              </View>
            </Tappable>
          </View>

          {/* Workout reminders */}
          <View style={styles.card}>
            <View style={styles.reminderRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.cardTitle}>{t('settings.reminderTitle')}</Text>
                <Text style={styles.cardSub}>{t('settings.reminderSub')}</Text>
              </View>
              <Switch
                value={!!reminders?.enabled}
                onValueChange={toggleReminders}
                disabled={!reminders}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surfaceInverse}
              />
            </View>

            {reminders?.enabled && (
              <View style={styles.hourSection}>
                <Text style={styles.hourLabel}>{t('settings.reminderTime')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourRow}>
                  {REMINDER_HOURS.map(h => {
                    const active = reminders.hour === h;
                    return (
                      <Tappable
                        key={h}
                        style={[styles.hourChip, active && styles.hourChipActive]}
                        onPress={() => pickHour(h)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.hourChipText, active && styles.hourChipTextActive]}>
                          {`${String(h).padStart(2, '0')}:00`}
                        </Text>
                      </Tappable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Account actions */}
          <View style={styles.accountSection}>
            <Tappable onPress={() => Linking.openURL('https://venerable-nasturtium-4e9b15.netlify.app/')}>
              <Text style={styles.privacyLink}>{t('profile.privacyPolicy')}</Text>
            </Tappable>
            <Tappable style={styles.deleteAccountBtn} onPress={deleteAccount}>
              <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
            </Tappable>
            <Text style={styles.deleteAccountSub}>
              {t('profile.deleteAccountSub')}
            </Text>
          </View>

          <Tappable style={styles.signOutRow} onPress={signOut}>
            <Text style={styles.signOut}>{t('profile.signOut')}</Text>
          </Tappable>
        </ScrollView>

        <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  doneBtn: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginTop: 14, overflow: 'hidden' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textFaint, lineHeight: 17, marginTop: 3 },
  reminderRow: { flexDirection: 'row', alignItems: 'center' },
  hourSection: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 14, marginHorizontal: -16, paddingHorizontal: 16 },
  hourLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  hourRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  hourChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  hourChipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.borderActive },
  hourChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  hourChipTextActive: { color: colors.textOnLight, fontWeight: '600' },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  langRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langRowValue: { fontSize: 14, color: colors.textMuted },
  dropdownArrow: { fontSize: 9, color: colors.textSubtle },
  accountSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, alignItems: 'center', gap: 4 },
  privacyLink: { fontSize: 13, color: colors.textSubtle, textDecorationLine: 'underline', paddingVertical: 8 },
  deleteAccountBtn: { paddingVertical: 10 },
  deleteAccountText: { fontSize: 13, color: colors.danger, fontWeight: '500' },
  deleteAccountSub: { fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 4 },
  signOutRow: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  signOut: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
});
