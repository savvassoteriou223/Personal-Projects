import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { format, startOfWeek, eachDayOfInterval, endOfWeek, subWeeks } from 'date-fns';
import { colors } from '../lib/theme';
import { animateLayout } from '../lib/motion';
import Tappable from '../components/Tappable';
import { VOLUME_TARGETS } from './programGenerator';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { supabase, getCurrentUser } from '../supabase';

const SCREEN_W = Dimensions.get('window').width;

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs',
];

function getMuscleTarget(muscle, level, t) {
  const target = VOLUME_TARGETS[muscle.toLowerCase()]?.[level];
  if (!target) return '—';
  return t('profile.setsPerWeek', { low: target.optimal_low, high: target.optimal_high });
}

// Build exercise → muscles map from movementLibrary (same as TodayScreen / ProfileScreen)
const _EXERCISE_MUSCLE_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(pattern => {
    pattern.exercises.forEach(ex => {
      map[ex.name.toLowerCase()] = pattern.muscles.map(m => m.toLowerCase());
    });
  });
  return map;
})();

function _normaliseMuscle(raw) {
  const r = raw.toLowerCase();
  if (r === 'chest' || r === 'upper chest' || r === 'lower chest') return 'chest';
  if (r === 'lats' || r === 'traps' || r === 'upper traps' ||
      r === 'upper trapezius' || r === 'levator scapulae') return 'back';
  if (r === 'shoulders' || r === 'anterior delts' || r === 'side deltoids' ||
      r === 'rear delts' || r === 'rear deltoids' || r === 'external rotators') return 'shoulders';
  if (r === 'biceps' || r === 'brachialis') return 'biceps';
  if (r === 'triceps') return 'triceps';
  if (r === 'quads') return 'quads';
  if (r === 'hamstrings') return 'hamstrings';
  if (r === 'glutes' || r === 'glute medius' || r === 'glute minimus') return 'glutes';
  if (r === 'gastrocnemius' || r === 'soleus') return 'calves';
  if (r === 'rectus abdominis' || r === 'obliques') return 'abs';
  return null;
}

function matchesMuscle(exName, muscle) {
  const raw = _EXERCISE_MUSCLE_MAP[exName?.toLowerCase()] || [];
  const normalised = [...new Set(raw.map(_normaliseMuscle).filter(Boolean))];
  return normalised.includes(muscle.toLowerCase());
}

function MuscleVolumeChart({ data, width }) {
  if (!data || data.length === 0 || !width || width <= 0) return null;

  const max = Math.max(...data.map(d => d.sets), 1);
  // Round max up to nearest nice number for clean grid
  const niceMax = max <= 3 ? 4 : max <= 6 ? 8 : max <= 10 ? 12 : max <= 15 ? 16 : Math.ceil(max / 5) * 5;

  const padL = 28;  // y-axis labels
  const padR = 4;
  const padT = 28;  // room for value labels above dots
  const padB = 22;  // day labels
  const svgW = width;
  const svgH = 160;
  const W = svgW - padL - padR;
  const H = svgH - padT - padB;

  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W),
    y: padT + H - (d.sets / niceMax) * H,
    sets: d.sets,
    label: d.label,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length-1].x.toFixed(1)} ${padT + H} L ${pts[0].x.toFixed(1)} ${padT + H} Z`;

  // Nice grid values: 0, 25%, 50%, 75%, 100% of niceMax
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    val: Math.round(niceMax * pct),
    y: padT + H - pct * H,
  }));

  return (
    <Svg width={svgW} height={svgH}>
      {/* Y axis line */}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + H} stroke={colors.borderStrong} strokeWidth="1" />
      {/* X axis line */}
      <Line x1={padL} y1={padT + H} x2={svgW - padR} y2={padT + H} stroke={colors.borderStrong} strokeWidth="1" />

      {/* Grid lines + Y labels */}
      {gridLines.map(({ val, y }, i) => (
        <React.Fragment key={`grid-${i}`}>
          {/* Horizontal grid */}
          <Line
            x1={padL} y1={y} x2={svgW - padR} y2={y}
            stroke={i === 0 ? colors.borderStrong : colors.border}
            strokeWidth={i === 0 ? 1 : 0.5}
            strokeDasharray={i === 0 ? undefined : '3,4'}
          />
          {/* Y label — right-aligned next to y-axis */}
          <SvgText
            x={padL - 5} y={y + 4}
            fontSize="9" fill={i === 0 ? colors.textSubtle : colors.borderStrong}
            textAnchor="end" fontWeight={i === 0 ? 'normal' : 'normal'}
          >{val}</SvgText>
          {/* Tick mark on Y axis */}
          <Line x1={padL - 2} y1={y} x2={padL} y2={y} stroke={colors.borderStrong} strokeWidth="1" />
        </React.Fragment>
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill={colors.textPrimary} fillOpacity="0.08" />

      {/* Line */}
      <Path d={linePath} fill="none" stroke={colors.textPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots + value labels + day labels */}
      {pts.map((p, i) => (
        <React.Fragment key={`pt-${i}`}>
          {/* Tick on X axis */}
          <Line x1={p.x} y1={padT + H} x2={p.x} y2={padT + H + 4} stroke={colors.borderStrong} strokeWidth="1" />

          {/* Day label below x-axis */}
          <SvgText x={p.x} y={svgH - 4} fontSize="10" fill={colors.textSubtle} textAnchor="middle">{p.label}</SvgText>

          {/* Dot */}
          <Circle
            cx={p.x} cy={p.y} r="5"
            fill={p.sets > 0 ? colors.textPrimary : colors.surface}
            stroke={p.sets > 0 ? colors.textPrimary : colors.border}
            strokeWidth="2"
          />

          {/* Value label — always above dot, clamped inside SVG */}
          {p.sets > 0 && (
            <SvgText
              x={p.x}
              y={Math.max(14, p.y - 8)}
              fontSize="11" fill={colors.textPrimary} fontWeight="bold" textAnchor="middle"
            >{p.sets}</SvgText>
          )}
        </React.Fragment>
      ))}
    </Svg>
  );
}

export default function VolumePanel() {
  const { t } = useTranslation();
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');
  const [showMuscleDropdown, setShowMuscleDropdown] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [chartWidth, setChartWidth] = useState(SCREEN_W - 72);
  const [allSets, setAllSets] = useState([]);
  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);
  const [trainingExperience, setTrainingExperience] = useState('beginner');

  useFocusEffect(useCallback(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: prof } = await supabase.from('profiles').select('trainingExperience').eq('id', user.id).single();
      if (prof?.trainingExperience) setTrainingExperience(prof.trainingExperience);

      const { data: sessionData } = await supabase
        .from('workout_sessions')
        .select('id, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (sessionData?.length > 0) {
        const ids = sessionData.map(s => s.id);
        const { data: sets } = await supabase.from('completed_sets')
          .select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);

        if (sets?.length > 0) {
          const dateMap = {};
          sessionData.forEach(s => { dateMap[s.id] = s.completed_at; });
          setAllSets(sets.map(s => ({ ...s, completed_at: dateMap[s.session_id] })));
        }
      }
    })();
  }, []));

  useEffect(() => {
    const baseDate = subWeeks(new Date(), weekOffset);
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
    const data = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const count = allSets.filter(s => {
        if (!s.completed_at) return false;
        return format(new Date(s.completed_at), 'yyyy-MM-dd') === dayStr &&
          matchesMuscle(s.exercise_name, selectedMuscle);
      }).length;
      return { label: format(day, 'EEE'), sets: count };
    });
    setWeeklyVolumeData(data);
  }, [selectedMuscle, weekOffset, allSets]);

  const totalSets = weeklyVolumeData.reduce((s, d) => s + d.sets, 0);
  const weekLabel = weekOffset === 0 ? t('profile.weekThis') : weekOffset === 1 ? t('profile.weekLast') : t('profile.weekAgo', { n: weekOffset });

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={styles.card}>
        {/* Controls row */}
        <View style={styles.dataControlRow}>
          <Tappable style={styles.muscleDropdownBtn} onPress={() => { animateLayout(); setShowMuscleDropdown(v => !v); }}>
            <Text style={styles.muscleDropdownText}>{t(`today.muscles.${selectedMuscle.toLowerCase()}`, { defaultValue: selectedMuscle })}</Text>
            <Text style={styles.dropdownArrow}>{showMuscleDropdown ? '▲' : '▼'}</Text>
          </Tappable>
          <View style={styles.weekNav}>
            <Tappable onPress={() => setWeekOffset(v => v+1)} style={styles.weekNavBtn}>
              <Text style={styles.weekNavArrow}>‹</Text>
            </Tappable>
            <Text style={styles.weekNavLabel}>{weekLabel}</Text>
            <Tappable onPress={() => setWeekOffset(v => Math.max(0,v-1))} style={[styles.weekNavBtn, weekOffset===0&&{opacity:0.3}]} disabled={weekOffset===0}>
              <Text style={styles.weekNavArrow}>›</Text>
            </Tappable>
          </View>
        </View>

        {showMuscleDropdown && (
          <View style={styles.dropdownList}>
            {MUSCLE_GROUPS.map(m => (
              <Tappable key={m} style={[styles.dropdownItem, selectedMuscle===m&&styles.dropdownItemActive]} onPress={() => { setSelectedMuscle(m); setShowMuscleDropdown(false); }}>
                <Text style={[styles.dropdownItemText, selectedMuscle===m&&styles.dropdownItemTextActive]}>{t(`today.muscles.${m.toLowerCase()}`, { defaultValue: m })}</Text>
              </Tappable>
            ))}
          </View>
        )}

        <View style={styles.chartTitleRow}>
          <Text style={styles.chartTitle}>{t('profile.chartTitle', { muscle: t(`today.muscles.${selectedMuscle.toLowerCase()}`, { defaultValue: selectedMuscle }), week: weekLabel })}</Text>
          <View style={[styles.totalBadge, totalSets === 0 && styles.totalBadgeEmpty]}>
            <Text style={[styles.totalBadgeText, totalSets === 0 && { color: colors.textSubtle }]}>
              {t('profile.setsCount', { n: totalSets })}
            </Text>
          </View>
        </View>

        <View
          style={{ width: '100%' }}
          onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
        >
          <MuscleVolumeChart data={weeklyVolumeData} width={chartWidth} />
        </View>

        <View style={styles.targetNote}>
          <Text style={styles.targetNoteText}>
            {t('profile.targetNote', { level: t(`levels.${trainingExperience}`, { defaultValue: trainingExperience }), range: getMuscleTarget(selectedMuscle, trainingExperience, t) })}
          </Text>
        </View>
      </View>

      {/* Day breakdown bars */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile.dayBreakdown')}</Text>
        {weeklyVolumeData.map((d, i) => {
          const maxSets = Math.max(...weeklyVolumeData.map(x => x.sets), 1);
          return (
            <View key={i} style={styles.dayBreakRow}>
              <Text style={styles.dayBreakLabel}>{d.label}</Text>
              <View style={styles.dayBreakBar}>
                <View style={[styles.dayBreakFill, { width: `${(d.sets/maxSets)*100}%` }]} />
              </View>
              <Text style={[styles.dayBreakSets, d.sets===0&&{color:colors.textFaint}]}>{d.sets > 0 ? t('profile.daySets', { n: d.sets }) : '—'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginTop: 14, overflow: 'hidden' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  dataControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  muscleDropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.control, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  muscleDropdownText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  dropdownArrow: { fontSize: 9, color: colors.textSubtle },
  dropdownList: { backgroundColor: colors.control, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14 },
  dropdownItemActive: { backgroundColor: colors.surfaceElevated },
  dropdownItemText: { fontSize: 13, color: colors.textMuted },
  dropdownItemTextActive: { color: colors.textPrimary, fontWeight: '600' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekNavBtn: { padding: 6 },
  weekNavArrow: { fontSize: 22, color: colors.textPrimary, fontWeight: '700', lineHeight: 24 },
  weekNavLabel: { fontSize: 11, color: colors.textSubtle, minWidth: 75, textAlign: 'center' },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  chartTitle: { fontSize: 12, color: colors.textSubtle },
  totalBadge: { backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.border },
  totalBadgeEmpty: { borderColor: colors.border, backgroundColor: colors.surfaceInset },
  totalBadgeText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
  targetNote: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  targetNoteText: { fontSize: 11, color: colors.textSubtle, fontStyle: 'italic' },
  dayBreakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  dayBreakLabel: { fontSize: 12, color: colors.textSubtle, width: 30, fontWeight: '500' },
  dayBreakBar: { flex: 1, height: 6, backgroundColor: colors.control, borderRadius: 3, overflow: 'hidden' },
  dayBreakFill: { height: '100%', backgroundColor: colors.surfaceInverse, borderRadius: 3 },
  dayBreakSets: { fontSize: 11, color: colors.textPrimary, fontWeight: '600', width: 32, textAlign: 'right' },
});
