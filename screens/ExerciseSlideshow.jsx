import React from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

export default function ExerciseSlideshow({ exercise, visible, onClose }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (!exercise) return null;

  const sets = exercise.sets ?? exercise.target_sets;
  const reps = exercise.reps ?? exercise.target_reps;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.container}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.headerContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              {sets && reps && (
                <Text style={styles.prescription}>
                  {sets} sets · {reps} reps{exercise.rest ? ` · ${exercise.rest}` : ''}
                </Text>
              )}
            </View>
            <Tappable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>{t('common.done')}</Text>
            </Tappable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Technique cues ── */}
          {exercise.cues?.length > 0 && (
            <View style={styles.cuesSection}>
              <Text style={styles.sectionLabel}>{t('cards.slideshow.techniqueCues')}</Text>
              {exercise.cues.map((cue, i) => (
                <View key={i} style={styles.cueRow}>
                  <View style={styles.cueNum}>
                    <Text style={styles.cueNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.cueText}>{cue}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Research note ── */}
          {exercise.research_note && (
            <View style={styles.researchSection}>
              <Text style={styles.sectionLabel}>{t('cards.slideshow.whyThisExercise')}</Text>
              <View style={styles.researchCard}>
                <Text style={styles.researchText}>{exercise.research_note}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.control, borderRadius: 2, marginBottom: 14 },
  headerContent: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  exerciseName: {
    fontSize: 20, fontWeight: '700', color: colors.textPrimary,
    letterSpacing: -0.3, textTransform: 'capitalize',
  },
  prescription: { fontSize: 12, color: colors.textSubtle, marginTop: 3 },
  doneBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: colors.surfaceElevated, borderRadius: 20,
    borderWidth: 0.5, borderColor: colors.border,
  },
  doneBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  cuesSection: { padding: 20, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textFaint,
    letterSpacing: 1.2, marginBottom: 12,
  },
  cueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cueNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  cueNumText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  cueText: { flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 21 },

  researchSection: { paddingHorizontal: 20, paddingTop: 8 },
  researchCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: colors.border,
  },
  researchText: { fontSize: 13, color: colors.textSubtle, lineHeight: 20 },
});
