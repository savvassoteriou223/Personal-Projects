/**
 * ExerciseDetailCard.jsx — Helix Exercise Detail
 *
 * Bottom sheet / inline card that shows:
 *   - Exercise name + difficulty badge
 *   - MuscleMap SVG with primary/secondary highlights
 *   - Recommended sets / reps / rest
 *   - Technique cues (scrollable)
 *   - Research note (collapsible)
 *   - Stretch position badge
 *
 * Props:
 *   exercise : object   — one exercise entry from movementLibrary.js
 *   pattern  : object   — the parent pattern (for muscle arrays)
 *   onClose  : function — called when close button tapped
 *
 * Usage:
 *   import { MOVEMENT_PATTERNS } from './movementLibrary';
 *   const pattern = MOVEMENT_PATTERNS['chest_horizontal_push'];
 *   const exercise = pattern.exercises[0];
 *   <ExerciseDetailCard exercise={exercise} pattern={pattern} onClose={() => {}} />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import MuscleMap from './MuscleMap';
import { useTranslation } from 'react-i18next';
import { getExerciseInsight } from './studiesLibrary';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#0A0A0C',
  surface:     '#111116',
  surfaceHigh: '#18181F',
  border:      '#1E1E28',
  borderBright:'#2A2A38',
  green:       '#1D9E75',
  amber:       '#BA7517',
  red:         '#E85D5C',
  textPrimary: '#F1F0F5',
  textSecond:  '#8B8A9A',
  textMuted:   '#4A4A5A',
};

const DIFFICULTY_COLOR = {
  beginner:     { bg: C.green  + '22', text: C.green  },
  intermediate: { bg: C.amber  + '22', text: C.amber  },
  advanced:     { bg: C.red    + '22', text: C.red    },
};

const OVERLOAD_COLOR = {
  high:   C.green,
  medium: C.amber,
  low:    C.red,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color, bg }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function StatPill({ label, value }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CueRow({ index, text }) {
  return (
    <View style={styles.cueRow}>
      <View style={styles.cueNumber}>
        <Text style={styles.cueNumberText}>{index + 1}</Text>
      </View>
      <Text style={styles.cueText}>{text}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExerciseDetailCard({ exercise, pattern, onClose }) {
  const { t } = useTranslation();
  const [researchOpen, setResearchOpen] = useState(false);

  if (!exercise || !pattern) return null;

  const diffStyle = DIFFICULTY_COLOR[exercise.difficulty] || DIFFICULTY_COLOR.beginner;
  const overloadColor = OVERLOAD_COLOR[exercise.progressive_overload] || C.amber;

  // Build muscle arrays for MuscleMap
  // Primary = this pattern's muscles, Secondary = nothing by default
  // You can extend this to include muscles from research_note parsing if needed
  const primaryMuscles = pattern.muscles ?? [];
  const secondaryMuscles = [];

  // Heuristic: if pattern has shoulders/triceps as muscles and this is a chest exercise,
  // treat them as secondary. Otherwise keep all as primary.
  // For precision, wire up exercise-level muscle data here if added to library later.

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <View style={styles.badgeRow}>
            <Badge
              label={exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
              color={diffStyle.text}
              bg={diffStyle.bg}
            />
            {exercise.stretch_position && (
              <Badge label="Stretch loaded" color={C.amber} bg={C.amber + '22'} />
            )}
            <Badge
              label={`${exercise.progressive_overload} overload`}
              color={overloadColor}
              bg={overloadColor + '22'}
            />
          </View>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Muscle map ── */}
      <View style={styles.muscleSection}>
        <MuscleMap
          primary={primaryMuscles}
          secondary={secondaryMuscles}
          size="md"
          showLabels
          showLegend
        />
      </View>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <StatPill label="Sets"  value={exercise.sets} />
        <StatPill label="Reps"  value={exercise.reps} />
        <StatPill label="Rest"  value={exercise.rest} />
        <StatPill label="Equipment" value={exercise.equipment.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(', ')} />
      </View>

      {/* ── Technique cues ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('cards.exerciseDetail.technique')}</Text>
        {exercise.cues.map((cue, i) => (
          <CueRow key={i} index={i} text={cue} />
        ))}
      </View>

      {/* ── Key insight — the concise, evidence-based "why this exercise" ── */}
      {(() => {
        const insight = getExerciseInsight({ name: exercise.name, primaryMuscles: pattern?.muscles });
        if (!insight) return null;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('cards.exerciseDetail.whyHere')}</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightText}>{insight.insight}</Text>
              {insight.metric && (
                <Text style={styles.insightMetric}>
                  {insight.metric.this} vs {insight.metric.control} · {insight.metric.method}
                </Text>
              )}
              <Text style={styles.insightCite}>{insight.cite}</Text>
            </View>
          </View>
        );
      })()}

      {/* ── Research note (collapsible) ── */}
      {exercise.research_note && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.researchHeader}
            onPress={() => setResearchOpen(o => !o)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionLabel}>{t('cards.exerciseDetail.research')}</Text>
            <Text style={styles.researchToggle}>{researchOpen ? '▲ Less' : '▼ More'}</Text>
          </TouchableOpacity>
          {researchOpen && (
            <View style={styles.researchBody}>
              <Text style={styles.researchText}>{exercise.research_note}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Progression path (if exists) ── */}
      {exercise.progression_path && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('cards.exerciseDetail.progressionPath')}</Text>
          {exercise.progression_path.map((step, i) => (
            <View key={i} style={styles.progressionRow}>
              <View style={[styles.progressionDot, i === 0 && { backgroundColor: C.green }]} />
              <Text style={styles.progressionText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  exerciseName: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeBtnText: {
    color: C.textSecond,
    fontSize: 12,
    fontWeight: '700',
  },

  // Muscle map
  muscleSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: C.surfaceHigh,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statPill: {
    flex: 1,
    minWidth: 60,
    backgroundColor: C.surfaceHigh,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 3,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  // Cues
  cueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cueNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.green + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  cueNumberText: {
    color: C.green,
    fontSize: 10,
    fontWeight: '700',
  },
  cueText: {
    flex: 1,
    color: C.textSecond,
    fontSize: 13,
    lineHeight: 20,
  },

  // Research
  researchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  researchToggle: {
    color: C.green,
    fontSize: 11,
    fontWeight: '600',
  },
  researchBody: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  researchText: {
    color: C.textSecond,
    fontSize: 12,
    lineHeight: 19,
  },

  // Key insight (concise evidence-based "why")
  insightCard: {
    backgroundColor: C.green + '14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.green + '40',
    borderLeftWidth: 3,
    borderLeftColor: C.green,
    padding: 12,
  },
  insightText: {
    color: C.textPrimary,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
  },
  insightMetric: {
    color: C.green,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  insightCite: {
    color: C.textMuted,
    fontSize: 11,
    marginTop: 6,
  },

  // Progression
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  progressionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.textMuted,
    marginTop: 5,
    flexShrink: 0,
  },
  progressionText: {
    flex: 1,
    color: C.textSecond,
    fontSize: 13,
    lineHeight: 20,
  },
});
