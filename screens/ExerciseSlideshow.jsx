import React from 'react';
import {
  View, Text, Modal, ScrollView, Pressable,
  StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ExerciseSlideshow({ exercise, visible, onClose }) {
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
      <StatusBar barStyle="light-content" backgroundColor="#0F0F13" />
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
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Technique cues ── */}
          {exercise.cues?.length > 0 && (
            <View style={styles.cuesSection}>
              <Text style={styles.sectionLabel}>TECHNIQUE CUES</Text>
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
              <Text style={styles.sectionLabel}>WHY THIS EXERCISE</Text>
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
  container: { flex: 1, backgroundColor: '#0F0F13' },

  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C35',
    alignItems: 'center',
  },
  handle: { width: 36, height: 4, backgroundColor: '#2C2C35', borderRadius: 2, marginBottom: 14 },
  headerContent: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  exerciseName: {
    fontSize: 20, fontWeight: '700', color: '#FFFFFF',
    letterSpacing: -0.3, textTransform: 'capitalize',
  },
  prescription: { fontSize: 12, color: '#71717A', marginTop: 3 },
  doneBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: '#1C1C22', borderRadius: 20,
    borderWidth: 0.5, borderColor: '#FFFFFF',
  },
  doneBtnText: { color: '#E4E4E8', fontSize: 14, fontWeight: '600' },

  cuesSection: { padding: 20, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#4A4A5A',
    letterSpacing: 1.2, marginBottom: 12,
  },
  cueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cueNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1D9E7522',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  cueNumText: { color: '#1D9E75', fontSize: 10, fontWeight: '700' },
  cueText: { flex: 1, fontSize: 14, color: '#A1A1AA', lineHeight: 21 },

  researchSection: { paddingHorizontal: 20, paddingTop: 8 },
  researchCard: {
    backgroundColor: '#1A1A20', borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: '#2C2C35',
    borderLeftWidth: 3, borderLeftColor: '#FFFFFF',
  },
  researchText: { fontSize: 13, color: '#71717A', lineHeight: 20 },
});
