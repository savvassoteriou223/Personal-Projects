import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../lib/theme';
import { supabase, getCurrentUser } from '../supabase';
import { epley1RM } from '../lib/epley';

export default function PRsPanel() {
  const { t } = useTranslation();
  const [prs, setPrs] = useState([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: sessionData } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', user.id);

      if (!sessionData?.length) return;

      const ids = sessionData.map(s => s.id);
      const { data: sets } = await supabase.from('completed_sets')
        .select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);

      if (sets?.length > 0) {
        const prMap = {};
        sets.filter(s => s.weight_kg).forEach(s => {
          if (!prMap[s.exercise_name] || s.weight_kg > prMap[s.exercise_name].weight_kg) prMap[s.exercise_name] = s;
        });
        setPrs(Object.entries(prMap).map(([n, s]) => ({
          name: n, weight_kg: s.weight_kg, reps: s.reps,
          // Epley 1RM estimate
          orm: s.reps && s.reps > 1 ? Math.round(epley1RM(s.weight_kg, s.reps)) : s.weight_kg,
        })).sort((a, b) => b.weight_kg - a.weight_kg));
      }
    })();
  }, []));

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.personalRecords', { count: prs.length })}</Text>
        {prs.length === 0
          ? <Text style={styles.empty}>{t('profile.noPrs')}</Text>
          : prs.map((pr, i) => (
            <View key={i} style={styles.prRow}>
              <View style={[styles.prRank, i < 3 && { backgroundColor: i===0?colors.warning:i===1?colors.textSubtle:colors.borderStrong }]}>
                <Text style={styles.prRankText}>{i+1}</Text>
              </View>
              <Text style={styles.prName} numberOfLines={1}>{pr.name}</Text>
              <View style={styles.prValGroup}>
                <Text style={styles.prWeight}>{t('profile.prVal', { weight: pr.weight_kg, reps: pr.reps || '—' })}</Text>
                {pr.orm && pr.reps > 1 && (
                  <Text style={styles.prOrm}>{t('profile.prOrm', { orm: pr.orm })}</Text>
                )}
              </View>
            </View>
          ))
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginTop: 14, overflow: 'hidden' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  empty: { fontSize: 13, color: colors.textSubtle },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  prRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  prRankText: { fontSize: 10, fontWeight: '700', color: colors.textPrimary },
  prName: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  prValGroup: { alignItems: 'flex-end' },
  prWeight: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  prOrm: { fontSize: 10, color: colors.textSubtle, marginTop: 1 },
});
