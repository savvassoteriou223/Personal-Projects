import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, ScrollView, Pressable,
  StyleSheet, Dimensions, StatusBar, ActivityIndicator, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { getExerciseGif } from './exerciseDBService';

const { width: SCREEN_W } = Dimensions.get('window');
const FIGURE_H = 260;

export default function ExerciseSlideshow({ exercise, visible, onClose, gifUrl: cachedUrl }) {
  const [gifUrl, setGifUrl]       = useState(null);
  const [gifLoading, setGifLoading] = useState(false);

  useEffect(() => {
    if (!visible || !exercise?.name) { setGifUrl(null); return; }

    // Use pre-fetched URL immediately if available
    if (cachedUrl) { setGifUrl(cachedUrl); setGifLoading(false); return; }

    // Fallback: fetch (only happens if gifCache missed this exercise)
    setGifUrl(null);
    setGifLoading(true);
    getExerciseGif(exercise.name)
      .then(url => setGifUrl(url || null))
      .catch(() => setGifUrl(null))
      .finally(() => setGifLoading(false));
  }, [exercise?.name, visible, cachedUrl]);

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
        <View style={styles.header}>
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

          {/* ── Exercise visual ── */}
          {(gifLoading || gifUrl) && (
            <View style={styles.poseSection}>
              {gifLoading ? (
                <View style={styles.gifPlaceholder}>
                  <ActivityIndicator color="#534AB7" />
                </View>
              ) : Platform.OS === 'web' ? (
                  <img
                    src={gifUrl}
                    style={{ width: SCREEN_W, height: FIGURE_H + 40, objectFit: 'contain', backgroundColor: '#0A0A10' }}
                    alt=""
                  />
              ) : (
                  <Image
                    source={{ uri: gifUrl }}
                    style={styles.gif}
                    contentFit="contain"
                    autoplay
                  />
              )
              }
            </View>
          )}

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
    backgroundColor: '#1A1830', borderRadius: 20,
    borderWidth: 0.5, borderColor: '#534AB7',
  },
  doneBtnText: { color: '#7F77DD', fontSize: 14, fontWeight: '600' },

  poseSection: {
    backgroundColor: '#0A0A10',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E1E28',
    paddingBottom: 10,
    minHeight: FIGURE_H,
    justifyContent: 'center',
  },
  gif: {
    width: SCREEN_W,
    height: FIGURE_H + 40,
    backgroundColor: '#0A0A10',
  },
  gifPlaceholder: {
    width: SCREEN_W,
    height: FIGURE_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slide: {
    width: SCREEN_W,
    alignItems: 'center',
    backgroundColor: '#0A0A10',
  },
  phaseLabel: {
    fontSize: 10, fontWeight: '700', color: '#534AB7',
    textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 8,
  },
  phaseCue: {
    fontSize: 13, color: '#A89FE8', lineHeight: 19,
    marginTop: 4, paddingHorizontal: 24, textAlign: 'center',
  },

  dots: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 6, marginTop: 12,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2C2C35' },
  dotActive: { backgroundColor: '#534AB7', width: 16 },
  hint: {
    textAlign: 'center', fontSize: 10,
    color: '#3D3D4A', letterSpacing: 0.3, marginTop: 6,
  },

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
    borderLeftWidth: 3, borderLeftColor: '#534AB7',
  },
  researchText: { fontSize: 13, color: '#71717A', lineHeight: 20 },
});
