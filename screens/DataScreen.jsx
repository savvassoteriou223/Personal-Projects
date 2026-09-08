import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase, getCurrentUser } from '../supabase';
import { getRecentCheckIns } from '../lib/recoveryStore';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';
import PremiumPaywall from './PremiumPaywall';

// Bounded windows, not "every row ever" — enough to be genuinely comprehensive
// without an unpaginated query pulling a user's entire multi-year history into
// memory on every open.
const SESSION_LIMIT = 60;
const NUTRITION_LIMIT = 150;
const HEALTH_LIMIT = 60;
const WEIGHT_LIMIT = 60;
const CHECKIN_DAYS = 60;

export default function DataScreen({ visible, onClose, isPremium, onUpgrade, onRestore }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);

  useEffect(() => {
    if (visible && isPremium && !data) loadAll();
  }, [visible, isPremium]);

  const loadAll = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }

    const [{ data: sessions }, { data: nutrition }, { data: healthLogs }, { data: bodyMetrics }, checkins] = await Promise.all([
      supabase.from('workout_sessions')
        .select('id, name, completed_at, duration_min, perceived_exertion, session_type, distance_km, cardio_subtype')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(SESSION_LIMIT),
      supabase.from('nutrition_logs')
        .select('date, meal_type, food_name, calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(NUTRITION_LIMIT),
      supabase.from('daily_health_logs')
        .select('date, sleep_hours, hrv_ms, resting_hr, steps')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(HEALTH_LIMIT),
      supabase.from('body_metrics')
        .select('date, weight_kg')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(WEIGHT_LIMIT),
      getRecentCheckIns(CHECKIN_DAYS),
    ]);

    const strengthSessions = (sessions || []).filter(s => !s.session_type || s.session_type === 'strength');
    const cardioSessions = (sessions || []).filter(s => s.session_type && s.session_type !== 'strength');

    const setsBySession = {};
    if (strengthSessions.length) {
      const ids = strengthSessions.map(s => s.id);
      const { data: sets } = await supabase.from('completed_sets')
        .select('session_id, exercise_name, weight_kg, reps, set_number')
        .in('session_id', ids)
        .order('set_number', { ascending: true });
      (sets || []).forEach(s => {
        if (!setsBySession[s.session_id]) setsBySession[s.session_id] = [];
        setsBySession[s.session_id].push(s);
      });
    }

    const nutritionByDate = {};
    (nutrition || []).forEach(n => {
      if (!nutritionByDate[n.date]) nutritionByDate[n.date] = [];
      nutritionByDate[n.date].push(n);
    });

    setData({
      strengthSessions,
      cardioSessions,
      setsBySession,
      nutritionDates: Object.keys(nutritionByDate).sort().reverse(),
      nutritionByDate,
      healthLogs: healthLogs || [],
      bodyMetrics: bodyMetrics || [],
      checkins: (checkins || []).filter(c => !c.skipped),
    });
    setLoading(false);
  };

  const dateLabel = (d) => {
    try { return format(new Date(d), 'MMM d, yyyy'); } catch { return d; }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('data.title')}</Text>
          <Tappable onPress={onClose}><Text style={styles.doneBtn}>{t('common.done')}</Text></Tappable>
        </View>

        {!isPremium ? (
          <PremiumPaywall feature="Data" onUpgrade={onUpgrade} onRestore={onRestore} />
        ) : loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.textPrimary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={styles.scopeNote}>{t('data.scopeNote', { sessions: SESSION_LIMIT, nutrition: NUTRITION_LIMIT })}</Text>

            {/* ── Training history ── */}
            <Text style={styles.sectionTitle}>{t('data.trainingTitle')}</Text>
            {data.strengthSessions.length === 0 ? (
              <Text style={styles.emptyText}>{t('data.emptyTraining')}</Text>
            ) : data.strengthSessions.map((s) => {
              const isOpen = expandedSession === s.id;
              const sets = data.setsBySession[s.id] || [];
              return (
                <Tappable key={s.id} style={styles.sessionCard} onPress={() => setExpandedSession(isOpen ? null : s.id)}>
                  <View style={styles.sessionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionName}>{s.name || t('data.untitledSession')}</Text>
                      <Text style={styles.sessionSub}>{dateLabel(s.completed_at)} · {s.duration_min ? t('data.minutes', { n: s.duration_min }) : '—'}{s.perceived_exertion ? ` · RPE ${s.perceived_exertion}` : ''}</Text>
                    </View>
                    <Text style={styles.chev}>{isOpen ? '▾' : '▸'}</Text>
                  </View>
                  {isOpen && (
                    <View style={styles.setsList}>
                      {sets.length === 0 ? (
                        <Text style={styles.emptyText}>{t('data.noSets')}</Text>
                      ) : sets.map((set, i) => (
                        <View key={i} style={[styles.setRow, i > 0 && styles.setRowBorder]}>
                          <Text style={styles.setExercise} numberOfLines={1}>{set.exercise_name}</Text>
                          <Text style={styles.setDetail}>{set.weight_kg ? `${set.weight_kg}kg × ${set.reps}` : `${set.reps} reps`}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Tappable>
              );
            })}

            {/* ── Cardio history ── */}
            <Text style={styles.sectionTitle}>{t('data.cardioTitle')}</Text>
            {data.cardioSessions.length === 0 ? (
              <Text style={styles.emptyText}>{t('data.emptyCardio')}</Text>
            ) : data.cardioSessions.map((s) => (
              <View key={s.id} style={styles.plainRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.plainRowMain}>{s.cardio_subtype || s.session_type}{s.distance_km ? ` · ${s.distance_km}km` : ''}</Text>
                  <Text style={styles.plainRowSub}>{dateLabel(s.completed_at)}</Text>
                </View>
                <Text style={styles.plainRowValue}>{s.duration_min ? t('data.minutes', { n: s.duration_min }) : '—'}</Text>
              </View>
            ))}

            {/* ── Nutrition log ── */}
            <Text style={styles.sectionTitle}>{t('data.nutritionTitle')}</Text>
            {data.nutritionDates.length === 0 ? (
              <Text style={styles.emptyText}>{t('data.emptyNutrition')}</Text>
            ) : data.nutritionDates.map((d) => {
              const entries = data.nutritionByDate[d];
              const totals = entries.reduce((acc, e) => ({
                calories: acc.calories + (e.calories || 0),
                protein_g: acc.protein_g + (e.protein_g || 0),
              }), { calories: 0, protein_g: 0 });
              return (
                <View key={d} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayHeaderDate}>{dateLabel(d)}</Text>
                    <Text style={styles.dayHeaderTotals}>{Math.round(totals.calories)} kcal · {Math.round(totals.protein_g)}g P</Text>
                  </View>
                  {entries.map((e, i) => (
                    <View key={i} style={[styles.foodRow, i > 0 && styles.setRowBorder]}>
                      <Text style={styles.foodName} numberOfLines={1}>{e.food_name}</Text>
                      <Text style={styles.foodValue}>{e.calories ?? 0} kcal</Text>
                    </View>
                  ))}
                </View>
              );
            })}

            {/* ── Recovery check-ins ── */}
            <Text style={styles.sectionTitle}>{t('data.recoveryTitle')}</Text>
            {data.checkins.length === 0 ? (
              <Text style={styles.emptyText}>{t('data.emptyRecovery')}</Text>
            ) : data.checkins.map((c, i) => (
              <View key={i} style={styles.plainRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.plainRowMain}>{c.label || t('data.checkin')}</Text>
                  <Text style={styles.plainRowSub}>{dateLabel(c.date)} · {t('data.sleepHrs', { n: c.sleep ?? '—' })} · {t('data.sorenessLabel')} {c.soreness ?? '—'}/5 · {t('data.energyLabel')} {c.energy ?? '—'}/5</Text>
                </View>
                {c.score != null && <Text style={styles.plainRowValue}>{c.score}</Text>}
              </View>
            ))}

            {/* ── Health metrics (wearables) ── */}
            <Text style={styles.sectionTitle}>{t('data.healthTitle')}</Text>
            {data.healthLogs.length === 0 ? (
              <Text style={styles.emptyText}>{t('data.emptyHealth')}</Text>
            ) : data.healthLogs.map((h, i) => (
              <View key={i} style={styles.plainRow}>
                <Text style={styles.plainRowSub}>{dateLabel(h.date)}</Text>
                <Text style={styles.plainRowValue}>
                  {h.sleep_hours != null ? t('data.sleepHrs', { n: h.sleep_hours }) : '—'}
                  {h.hrv_ms != null ? ` · HRV ${h.hrv_ms}ms` : ''}
                  {h.resting_hr != null ? ` · RHR ${h.resting_hr}` : ''}
                </Text>
              </View>
            ))}

            {/* ── Body weight ── */}
            <Text style={styles.sectionTitle}>{t('data.weightTitle')}</Text>
            {data.bodyMetrics.length === 0 ? (
              <Text style={styles.emptyText}>{t('data.emptyWeight')}</Text>
            ) : data.bodyMetrics.map((m, i) => (
              <View key={i} style={styles.plainRow}>
                <Text style={styles.plainRowSub}>{dateLabel(m.date)}</Text>
                <Text style={styles.plainRowValue}>{m.weight_kg} kg</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  doneBtn: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scopeNote: { fontSize: 11, color: colors.textFaint, marginHorizontal: 20, marginTop: 14, marginBottom: 4, lineHeight: 16 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 20, marginTop: 22, marginBottom: 10 },
  emptyText: { fontSize: 12.5, color: colors.textFaint, marginHorizontal: 20, fontStyle: 'italic' },

  sessionCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: colors.border, marginBottom: 8 },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sessionSub: { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  chev: { fontSize: 14, color: colors.textFaint, marginLeft: 8 },
  setsList: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.borderSoft },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  setRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.borderSoft },
  setExercise: { fontSize: 12.5, color: colors.textSecondary, flex: 1, marginRight: 10 },
  setDetail: { fontSize: 12, color: colors.textSubtle, fontVariant: ['tabular-nums'] },

  plainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: colors.borderSoft },
  plainRowMain: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  plainRowSub: { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  plainRowValue: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500', marginLeft: 10 },

  dayCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: colors.border, marginBottom: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayHeaderDate: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  dayHeaderTotals: { fontSize: 11.5, color: colors.textSubtle },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  foodName: { fontSize: 12.5, color: colors.textMuted, flex: 1, marginRight: 10 },
  foodValue: { fontSize: 12, color: colors.textSubtle },
});
