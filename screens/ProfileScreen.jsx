import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Dimensions, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { supabase, getCurrentUser } from '../supabase';
import AdminScreen from './AdminScreen';
import { format, startOfWeek, eachDayOfInterval, endOfWeek, subWeeks } from 'date-fns';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { calculateTDEE, calculateNutritionTargets, INJURY_BODY_PARTS } from './programGenerator';
import { computeInsights } from './insightsEngine';
import BodyCompositionCard from './BodyCompositionCard';
import { VOLUME_TARGETS } from './programGenerator';
import { isHealthAvailable, isHealthAuthorized, requestHealthPermissions, disconnectHealth, getRecoveryData, openHealthSettings } from '../lib/healthService';
import { CONDITIONS_DB, SEVERITY_OPTIONS, POST_OP_TIMELINE_OPTIONS, deriveConditionKeys, conditionSummaryLabel } from '../lib/conditionsDb';
import { useTranslation } from 'react-i18next';
import LanguagePicker from '../components/LanguagePicker';
import { LANGUAGES } from '../lib/i18n';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 140;

const GOALS = [
  { key: 'lose', label: 'Lose fat' },
  { key: 'gain', label: 'Build muscle' },
  { key: 'strength', label: 'Build strength' },
  { key: 'aesthetics', label: 'Aesthetics' },
  { key: 'endurance', label: 'Improve endurance' },
  { key: 'maintain', label: 'Stay healthy' },
];

const ACTIVITY_TYPES = [
  { key: 'weights',  label: 'Weight training' },
  { key: 'running',  label: 'Running' },
  { key: 'walking',  label: 'Walking' },
  { key: 'swimming', label: 'Swimming' },
  { key: 'cycling',  label: 'Cycling' },
  { key: 'hiit',     label: 'HIIT' },
];

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbells', 'Cables', 'Machines',
  'Bodyweight only', 'Pull-up bar', 'Kettlebells', 'Resistance bands',
];

// Stored equipment value → i18n key (display only; stored value stays English).
const EQUIP_I18N_KEY = {
  'Barbell': 'barbell', 'Dumbbells': 'dumbbells', 'Cables': 'cables', 'Machines': 'machines',
  'Bodyweight only': 'bodyweight', 'Pull-up bar': 'pullupBar', 'Kettlebells': 'kettlebells', 'Resistance bands': 'bands',
};
const equipLabel = (t, value) => t(`onboarding.equipment.${EQUIP_I18N_KEY[value] || ''}`, { defaultValue: value });

const HEALTH_CONDITIONS = [
  { key: 'none', label: 'None' },
  { key: 'lower_back_disc_herniation', label: 'Lower back disc' },
  { key: 'spondylolisthesis', label: 'Spondylolisthesis' },
  { key: 'shoulder_impingement', label: 'Shoulder impingement' },
  { key: 'rotator_cuff_tear', label: 'Rotator cuff tear' },
  { key: 'ac_joint_injury', label: 'AC joint injury' },
  { key: 'pec_tear', label: 'Pec tear' },
  { key: 'shoulder_instability', label: 'Shoulder instability' },
  { key: 'bicep_tendinopathy', label: 'Bicep tendinopathy' },
  { key: 'cervical_disc_herniation', label: 'Cervical disc' },
  { key: 'lateral_epicondylitis', label: 'Tennis elbow' },
  { key: 'medial_epicondylitis', label: 'Golfer\'s elbow' },
  { key: 'elbow_tendinopathy', label: 'Elbow tendinopathy' },
  { key: 'knee_replacement', label: 'Knee replacement' },
  { key: 'severe_knee_osteoarthritis', label: 'Knee osteoarthritis' },
  { key: 'patellofemoral_syndrome', label: 'Patellofemoral syndrome' },
  { key: 'bilateral_hip_replacement', label: 'Hip replacement' },
  { key: 'proximal_hamstring_tendinopathy', label: 'Hamstring tendinopathy' },
  { key: 'achilles_tendinopathy', label: 'Achilles tendinopathy' },
  { key: 'wrist_injury', label: 'Wrist injury' },
  { key: 'carpal_tunnel_syndrome', label: 'Carpal tunnel' },
];

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs',
];

const EXPERIENCE_LEVELS = [
  { key: 'beginner',     label: 'Beginner',     sub: '< 2 years' },
  { key: 'intermediate', label: 'Intermediate', sub: '2–4 years' },
  { key: 'advanced',     label: 'Advanced',     sub: '4+ years' },
];

function getMuscleTarget(muscle, level, t) {
  const target = VOLUME_TARGETS[muscle.toLowerCase()]?.[level];
  if (!target) return '—';
  return t('profile.setsPerWeek', { low: target.optimal_low, high: target.optimal_high });
}

// Build exercise → muscles map from movementLibrary (same as TodayScreen)
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
      <Line x1={padL} y1={padT} x2={padL} y2={padT + H} stroke="#3D3D4A" strokeWidth="1" />
      {/* X axis line */}
      <Line x1={padL} y1={padT + H} x2={svgW - padR} y2={padT + H} stroke="#3D3D4A" strokeWidth="1" />

      {/* Grid lines + Y labels */}
      {gridLines.map(({ val, y }, i) => (
        <React.Fragment key={`grid-${i}`}>
          {/* Horizontal grid */}
          <Line
            x1={padL} y1={y} x2={svgW - padR} y2={y}
            stroke={i === 0 ? '#3D3D4A' : '#2C2C35'}
            strokeWidth={i === 0 ? 1 : 0.5}
            strokeDasharray={i === 0 ? undefined : '3,4'}
          />
          {/* Y label — right-aligned next to y-axis */}
          <SvgText
            x={padL - 5} y={y + 4}
            fontSize="9" fill={i === 0 ? '#9494A0' : '#3D3D4A'}
            textAnchor="end" fontWeight={i === 0 ? 'normal' : 'normal'}
          >{val}</SvgText>
          {/* Tick mark on Y axis */}
          <Line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="#3D3D4A" strokeWidth="1" />
        </React.Fragment>
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill="#FFFFFF" fillOpacity="0.08" />

      {/* Line */}
      <Path d={linePath} fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots + value labels + day labels */}
      {pts.map((p, i) => (
        <React.Fragment key={`pt-${i}`}>
          {/* Tick on X axis */}
          <Line x1={p.x} y1={padT + H} x2={p.x} y2={padT + H + 4} stroke="#3D3D4A" strokeWidth="1" />

          {/* Day label below x-axis */}
          <SvgText x={p.x} y={svgH - 4} fontSize="10" fill="#9494A0" textAnchor="middle">{p.label}</SvgText>

          {/* Dot */}
          <Circle
            cx={p.x} cy={p.y} r="5"
            fill={p.sets > 0 ? '#FFFFFF' : '#1A1A20'}
            stroke={p.sets > 0 ? '#FFFFFF' : '#2C2C35'}
            strokeWidth="2"
          />

          {/* Value label — always above dot, clamped inside SVG */}
          {p.sets > 0 && (
            <SvgText
              x={p.x}
              y={Math.max(14, p.y - 8)}
              fontSize="11" fill="#FFFFFF" fontWeight="bold" textAnchor="middle"
            >{p.sets}</SvgText>
          )}
        </React.Fragment>
      ))}
    </Svg>
  );
}

export default function ProfileScreen({ onSignOut, isAdmin }) {
  const { t, i18n } = useTranslation();
  // Health is iOS-only now: isHealthAvailable() is false on Android (Health
  // Connect removed) and on web, and every panel under that tab is gated on it.
  // Offering a tab that opens to nothing is worse than not offering it.
  const TABS = isHealthAvailable()
    ? ['profile', 'data', 'prs', 'health']
    : ['profile', 'data', 'prs'];
  const [activeTab, setActiveTab] = useState('profile');
  const [showAdmin, setShowAdmin] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [prs, setPrs] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState('3');
  const [sessionLength, setSessionLength] = useState('60');
  const [trainingExperience, setTrainingExperience] = useState('beginner');
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [profileHealthEntries, setProfileHealthEntries] = useState([]);
  const [ph6phase, setPh6phase] = useState('list');
  const [ph6search, setPh6search] = useState('');
  const [ph6pending, setPh6pending] = useState(null);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedSports, setSelectedSports] = useState([]);
  const [sex, setSex] = useState('');
  const [nutritionFocus, setNutritionFocus] = useState('maintain');
  const [injuryProfile, setInjuryProfile] = useState([]); // [{ body_part, severity: 'sometimes'|'always' }]
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');
  const [showMuscleDropdown, setShowMuscleDropdown] = useState(false);
  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [allSets, setAllSets] = useState([]);
  const [chartWidth, setChartWidth] = useState(SCREEN_W - 72);
  const [streak, setStreak] = useState(0);
  // Quick body weight log
  const [quickWeight, setQuickWeight] = useState('');
  const [quickWeightSaved, setQuickWeightSaved] = useState(false);
  // Health
  const [healthAuthorized, setHealthAuthorized] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

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

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) {
      setProfile(prof);
      setName(prof.name || '');
      setWeight(prof.weight_kg?.toString() || '');
      setHeight(prof.height_cm?.toString() || '');
      setTargetWeight(prof.target_weight_kg?.toString() || '');
      setSelectedGoals(prof.goals || []);
      setWeeklyWorkouts(prof.weekly_workouts?.toString() || '3');
      setSessionLength(prof.session_length?.toString() || '60');
      setTrainingExperience(prof.trainingExperience || 'beginner');
      setSelectedEquipment(prof.equipment || []);
      setSelectedConditions(prof.health_conditions || []);
      const structured = (prof.health_conditions_structured || []).map(s => {
        try { return JSON.parse(s); } catch (_) { return null; }
      }).filter(Boolean);
      setProfileHealthEntries(structured);
      setSelectedActivities(prof.activity_types || []);
      setSelectedSports(prof.sports || []);
      setSex(prof.sex || '');
      setNutritionFocus(prof.nutrition_focus || 'maintain');
      setInjuryProfile(prof.injury_profile || []);
    }

    const { data: sessionData } = await supabase
      .from('workout_sessions')
      .select('id, completed_at, name, duration_min, perceived_exertion, session_type')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (sessionData?.length > 0) {
      setSessions(sessionData);

      // ── Performance correlation insights (nutrition + recovery vs session RPE) ──
      (async () => {
        const sixtyAgo = new Date();
        sixtyAgo.setDate(sixtyAgo.getDate() - 60);
        const sinceISO = format(sixtyAgo, 'yyyy-MM-dd');
        const [{ data: nutLogs }, { data: healthLogs }] = await Promise.all([
          supabase.from('nutrition_logs').select('date, protein_g, calories').eq('user_id', user.id).gte('date', sinceISO),
          supabase.from('daily_health_logs').select('date, sleep_hours, hrv_ms').eq('user_id', user.id).gte('date', sinceISO),
        ]);
        const nutritionByDate = {};
        (nutLogs || []).forEach(l => {
          if (!nutritionByDate[l.date]) nutritionByDate[l.date] = { protein: 0, calories: 0 };
          nutritionByDate[l.date].protein += l.protein_g || 0;
          nutritionByDate[l.date].calories += l.calories || 0;
        });
        const healthByDate = {};
        (healthLogs || []).forEach(l => { healthByDate[l.date] = { sleep_hours: l.sleep_hours, hrv_ms: l.hrv_ms }; });
        setInsights(computeInsights({
          // Strength sessions only — cardio's fixed RPE buckets skew the correlations.
          sessions: sessionData.filter(s => !s.session_type || s.session_type === 'strength'),
          nutritionByDate,
          healthByDate,
          targets: { protein_target: prof?.protein_target, caloric_target: prof?.caloric_target },
        }));
      })();

      // Streak — consecutive weeks where at least 1 session occurred
      const weekSet = new Set(sessionData.map(s => {
        const d = new Date(s.completed_at);
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        return weekStart.toISOString().split('T')[0];
      }));
      const sortedWeeks = [...weekSet].sort().reverse();
      let streakCount = 0;
      let checkDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      for (const wk of sortedWeeks) {
        const wkDate = new Date(wk);
        const diff = Math.round((checkDate - wkDate) / (1000 * 60 * 60 * 24 * 7));
        if (diff <= 1) { streakCount++; checkDate = wkDate; }
        else break;
      }
      setStreak(streakCount);

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
          orm: s.reps && s.reps > 1 ? Math.round(s.weight_kg * (1 + s.reps / 30)) : s.weight_kg,
        })).sort((a,b) => b.weight_kg - a.weight_kg));

        const dateMap = {};
        sessionData.forEach(s => { dateMap[s.id] = s.completed_at; });
        setAllSets(sets.map(s => ({ ...s, completed_at: dateMap[s.session_id] })));
      }
    }

    const { data: bm } = await supabase.from('body_metrics').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(90);
    if (bm) setMetrics(bm);
    setLoading(false);

    // Load health data independently — non-blocking
    const authorized = await isHealthAuthorized();
    setHealthAuthorized(authorized);
    if (authorized) {
      const data = await getRecoveryData();
      setRecoveryData(data);
    }
  };

  const handleConnectHealth = async () => {
    setHealthLoading(true);
    const result = await requestHealthPermissions();
    if (result.ok) {
      setHealthAuthorized(true);
      const data = await getRecoveryData();
      setRecoveryData(data);
      if (!data?.sleep && !data?.hrv && !data?.rhr && !data?.steps) {
        Alert.alert(
          t('profile.alerts.connectedNoDataTitle'),
          Platform.OS === 'ios'
            ? t('profile.alerts.connectedNoDataIos')
            : t('profile.alerts.connectedNoDataAndroid'),
          [
            { text: t('profile.alerts.ok'), style: 'cancel' },
            { text: t('profile.alerts.openSettings'), onPress: () => openHealthSettings() },
          ],
        );
      }
    } else if (result.reason === 'not_installed') {
      Alert.alert(
        t('profile.alerts.hcRequiredTitle'),
        t('profile.alerts.hcRequiredMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.alerts.install'), onPress: () => Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata')) },
        ],
      );
    } else if (result.reason === 'update_required') {
      Alert.alert(t('profile.alerts.updateHcTitle'), t('profile.alerts.updateHcMsg'));
    } else if (result.reason === 'denied') {
      // Always offer BOTH a retry and a settings deep-link: after repeated
      // denials the OS stops re-showing the in-app prompt, so "Try again" alone
      // would soft-lock the user. "Open settings" is the guaranteed path.
      Alert.alert(
        t('profile.alerts.permissionNeededTitle'),
        Platform.OS === 'ios'
          ? t('profile.alerts.permissionNeededIos')
          : t('profile.alerts.permissionNeededAndroid'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.alerts.openSettings'), onPress: () => openHealthSettings() },
          { text: t('profile.alerts.tryAgain'), onPress: () => handleConnectHealth() },
        ],
      );
    } else {
      Alert.alert(
        t('profile.alerts.couldNotConnectTitle'),
        t('profile.alerts.couldNotConnectMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.alerts.openSettings'), onPress: () => openHealthSettings() },
          { text: t('profile.alerts.tryAgain'), onPress: () => handleConnectHealth() },
        ],
      );
    }
    setHealthLoading(false);
  };

  const handleDisconnectHealth = async () => {
    await disconnectHealth();
    setHealthAuthorized(false);
    setRecoveryData(null);
  };

  const logQuickWeight = async () => {
    const val = parseFloat(quickWeight);
    if (!quickWeight || isNaN(val) || val <= 0) return;
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('body_metrics').insert({
      user_id: user.id,
      date: format(new Date(), 'yyyy-MM-dd'), // local date, not UTC
      weight_kg: val,
    });
    setQuickWeightSaved(true);
    setQuickWeight('');
    setTimeout(() => setQuickWeightSaved(false), 2000);
    loadData();
  };

  const saveProfile = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const prevEquipment = profile?.equipment || [];
    const prevConditions = profile?.health_conditions || [];
    // Conditions are edited via the structured entries, so derive the keys that
    // will actually be saved and compare those — selectedConditions is never
    // touched by the editor and always reported "unchanged".
    const newConditionKeys = [...new Set(profileHealthEntries.flatMap(e => deriveConditionKeys(e)))];
    const equipmentChanged = JSON.stringify([...selectedEquipment].sort()) !== JSON.stringify([...prevEquipment].sort());
    const conditionsChanged = JSON.stringify([...newConditionKeys].sort()) !== JSON.stringify([...prevConditions].sort());

    const wKg = parseFloat(weight) || null;
    const hCm = parseFloat(height) || null;
    const userAge = profile?.age || null;
    const weeklyW = parseInt(weeklyWorkouts) || 3;
    const newTdee = calculateTDEE(wKg, hCm, userAge, sex, weeklyW);
    const newTargets = newTdee && wKg ? calculateNutritionTargets(newTdee, wKg, nutritionFocus) : null;

    const { error } = await supabase.from('profiles').update({
      name,
      sex,
      weight_kg: wKg,
      height_cm: hCm,
      target_weight_kg: parseFloat(targetWeight) > 0 ? parseFloat(targetWeight) : null,
      goals: selectedGoals,
      weekly_workouts: weeklyW,
      session_length: parseInt(sessionLength) || 60,
      trainingExperience,
      equipment: selectedEquipment,
      health_conditions: newConditionKeys,
      health_conditions_structured: profileHealthEntries.map(e => JSON.stringify(e)),
      activity_types: selectedActivities,
      sports: selectedSports,
      nutrition_focus: nutritionFocus,
      injury_profile: injuryProfile,
      ...(newTdee && { tdee: newTdee }),
      ...(newTargets && {
        caloric_target: newTargets.caloric_target,
        protein_target: newTargets.protein_target,
        fat_target: newTargets.fat_target,
        carb_target: newTargets.carb_target,
        training_caloric_target: newTargets.training_caloric_target,
        training_carb_target: newTargets.training_carb_target,
        rest_caloric_target: newTargets.rest_caloric_target,
        rest_carb_target: newTargets.rest_carb_target,
      }),
    }).eq('id', user.id);

    if (error) { Alert.alert(t('profile.alerts.saveFailTitle'), t('profile.alerts.saveFailMsg')); return; }

    setProfile(p => ({
      ...p, name, sex,
      weight_kg: parseFloat(weight), height_cm: parseFloat(height),
      target_weight_kg: parseFloat(targetWeight), goals: selectedGoals,
      weekly_workouts: parseInt(weeklyWorkouts), session_length: parseInt(sessionLength),
      trainingExperience, equipment: selectedEquipment,
      health_conditions: newConditionKeys,
      health_conditions_structured: profileHealthEntries.map(e => JSON.stringify(e)),
      activity_types: selectedActivities,
      sports: selectedSports,
      nutrition_focus: nutritionFocus,
      injury_profile: injuryProfile,
      ...(newTdee && { tdee: newTdee }),
      ...(newTargets && {
        caloric_target: newTargets.caloric_target,
        protein_target: newTargets.protein_target,
        fat_target: newTargets.fat_target,
        carb_target: newTargets.carb_target,
      }),
    }));
    setEditing(false);

    if (equipmentChanged || conditionsChanged) {
      Alert.alert(
        t('profile.alerts.programUpdatingTitle'),
        t('profile.alerts.programUpdatingMsg'),
      );
    }
  };

  const toggleGoal = k => setSelectedGoals(p => p.includes(k) ? p.filter(g => g !== k) : [...p, k]);
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

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    </SafeAreaView>
  );

  const h = parseFloat(editing ? height : profile?.height_cm);
  const w = parseFloat(editing ? weight : profile?.weight_kg);
  const bmi = h && w ? (w / ((h/100)**2)).toFixed(1) : null;
  const bmiColor = bmi ? (bmi < 18.5 ? '#BA7517' : bmi < 25 ? '#1D9E75' : bmi < 30 ? '#BA7517' : '#E85D5C') : null;
  const totalSets = weeklyVolumeData.reduce((s, d) => s + d.sets, 0);
  const weekLabel = weekOffset === 0 ? t('profile.weekThis') : weekOffset === 1 ? t('profile.weekLast') : t('profile.weekAgo', { n: weekOffset });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tab bar — fixed above scroll, no stickyHeaderIndices needed.
          Health is only offered where health data actually exists. Android's
          Health Connect was removed (2026-07-14), so on Android every panel under
          this tab is gated off and it opened to an empty screen. */}
      <View style={styles.tabRow}>
        {TABS.map((key) => (
          <Pressable key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{t(`profile.tabs.${key}`)}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {/* Scrollable header — scrolls away */}
        <View style={styles.header}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{profile?.name || t('profile.noName')}</Text>
              <Text style={styles.profileEmail}>{profile?.email || ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {isAdmin && (
                <Pressable onPress={() => setShowAdmin(true)} style={styles.adminBtn}>
                  <Text style={styles.adminBtnText}>{t('profile.admin')}</Text>
                </Pressable>
              )}
              <Pressable onPress={signOut}><Text style={styles.signOut}>{t('profile.signOut')}</Text></Pressable>
            </View>
          </View>
          <AdminScreen visible={showAdmin} onClose={() => setShowAdmin(false)} />
          <View style={styles.statsRow}>
            {[
              { val: profile?.weight_kg || '—', label: 'kg' },
              { val: profile?.height_cm || '—', label: 'cm' },
              { val: bmi || '—', label: 'BMI', color: bmiColor },
              { val: `${streak}w`, label: t('profile.streak') },
            ].map((s, i) => (
              <View key={i} style={styles.statCard}>
                <Text style={[styles.statVal, s.color && { color: s.color }]}>{s.val}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Performance insights */}
        {insights.length > 0 && (
          <View style={styles.insightsCard}>
            <Text style={styles.insightsTitle}>{t('profile.insightsTitle')}</Text>
            {insights.map((text, i) => (
              <View key={i} style={styles.insightItem}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tab content */}
        <View>

          {/* ─── PROFILE TAB ─── */}
          {activeTab === 'profile' && (
            <View style={{ paddingTop: 4 }}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('profile.myProfile')}</Text>
              {!editing
                ? <Pressable onPress={() => setEditing(true)}><Text style={styles.editBtn}>{t('profile.edit')}</Text></Pressable>
                : <View style={{ flexDirection: 'row' }}>
                    <Pressable onPress={() => setEditing(false)} style={{ marginRight: 16 }}><Text style={styles.cancelBtn}>{t('common.cancel')}</Text></Pressable>
                    <Pressable onPress={saveProfile}><Text style={styles.saveBtn}>{t('common.save')}</Text></Pressable>
                  </View>
              }
            </View>
            {editing ? (
              <>
                {[['name', name, setName, 'default'], ['weight', weight, setWeight, 'decimal-pad'], ['height', height, setHeight, 'decimal-pad'], ['targetWeight', targetWeight, setTargetWeight, 'decimal-pad']].map(([fieldKey, val, setter, kb]) => (
                  <View key={fieldKey}>
                    <Text style={styles.inputLabel}>{t(`profile.fields.${fieldKey}`)}</Text>
                    <TextInput style={styles.input} value={val} onChangeText={setter} keyboardType={kb} placeholderTextColor="#8A8A94" />
                  </View>
                ))}
                <Text style={styles.inputLabel}>{t('profile.daysPerWeek')}</Text>
                <View style={styles.optionRow}>
                  {[2,3,4,5,6].map(d => (
                    <Pressable key={d} style={[styles.optionBtn, parseInt(weeklyWorkouts)===d && styles.optionBtnActive]} onPress={() => setWeeklyWorkouts(d.toString())}>
                      <Text style={[styles.optionBtnText, parseInt(weeklyWorkouts)===d && styles.optionBtnTextActive]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.sessionLength')}</Text>
                <View style={styles.optionRow}>
                  {[30,45,60,90,120].map(m => (
                    <Pressable key={m} style={[styles.optionBtn, parseInt(sessionLength)===m && styles.optionBtnActive]} onPress={() => setSessionLength(m.toString())}>
                      <Text style={[styles.optionBtnText, parseInt(sessionLength)===m && styles.optionBtnTextActive]}>{m}m</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.experienceLevel')}</Text>
                <View style={styles.optionRow}>
                  {EXPERIENCE_LEVELS.map(lvl => (
                    <Pressable key={lvl.key} style={[styles.expBtn, trainingExperience === lvl.key && styles.expBtnActive]} onPress={() => setTrainingExperience(lvl.key)}>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.expBtnLabel, trainingExperience === lvl.key && styles.expBtnLabelActive]}>{t(`levels.${lvl.key}`)}</Text>
                      <Text style={[styles.expBtnSub, trainingExperience === lvl.key && styles.expBtnSubActive]}>{t(`profile.expSub.${lvl.key}`)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.goals')}</Text>
                <View style={styles.goalsWrap}>
                  {GOALS.map(g => (
                    <Pressable key={g.key} style={[styles.goalChip, selectedGoals.includes(g.key) && styles.goalChipActive]} onPress={() => toggleGoal(g.key)}>
                      <Text style={[styles.goalChipText, selectedGoals.includes(g.key) && styles.goalChipTextActive]}>{t(`onboarding.goals.${g.key}`)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.equipment')}</Text>
                <Text style={styles.inputSub}>{t('profile.equipmentSub')}</Text>
                <View style={styles.goalsWrap}>
                  {EQUIPMENT_OPTIONS.map(e => (
                    <Pressable
                      key={e}
                      style={[styles.goalChip, selectedEquipment.includes(e) && styles.goalChipActive]}
                      onPress={() => setSelectedEquipment(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])}
                    >
                      <Text style={[styles.goalChipText, selectedEquipment.includes(e) && styles.goalChipTextActive]}>{equipLabel(t, e)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.bioSex')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {[['male', t('profile.sexMale')], ['female', t('profile.sexFemale')], ['other', t('profile.sexOther')]].map(([val, label]) => (
                    <Pressable key={val} style={[styles.goalChip, sex === val && styles.goalChipActive]} onPress={() => setSex(val)}>
                      <Text style={[styles.goalChipText, sex === val && styles.goalChipTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputLabel}>{t('profile.nutritionFocus')}</Text>
                <Text style={styles.inputSub}>{t('profile.nutritionFocusSub')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[['cut', t('profile.focus.cut'), t('profile.focus.cutSub')], ['bulk', t('profile.focus.bulk'), t('profile.focus.bulkSub')], ['maintain', t('profile.focus.maintain'), t('profile.focus.maintainSub')], ['recomp', t('profile.focus.recomp'), t('profile.focus.recompSub')]].map(([val, label, sub]) => (
                    <Pressable key={val} style={[styles.goalChip, nutritionFocus === val && styles.goalChipActive, { paddingVertical: 10 }]} onPress={() => setNutritionFocus(val)}>
                      <Text style={[styles.goalChipText, nutritionFocus === val && styles.goalChipTextActive]}>{label}</Text>
                      <Text style={[{ fontSize: 9, color: nutritionFocus === val ? '#A1A1AA' : '#8A8A94', marginTop: 2 }]}>{sub}</Text>
                    </Pressable>
                  ))}
                </View>

                {(() => {
                  const wKg = parseFloat(weight);
                  const hCm = parseFloat(height);
                  const userAge = profile?.age;
                  const weeklyW = parseInt(weeklyWorkouts) || 3;
                  const previewTdee = calculateTDEE(wKg, hCm, userAge, sex, weeklyW);
                  const previewTargets = previewTdee && wKg ? calculateNutritionTargets(previewTdee, wKg, nutritionFocus) : null;
                  if (!previewTargets) return null;
                  return (
                    <View style={{ backgroundColor: '#12121A', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 0.5, borderColor: '#2C2C35' }}>
                      <Text style={{ fontSize: 10, color: '#8A8A94', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{t('profile.calculatedTargets')}</Text>
                      <Text style={{ fontSize: 13, color: '#A1A1AA', marginBottom: 2 }}>{t('profile.maintenanceTdee', { tdee: previewTdee })}</Text>
                      <Text style={{ fontSize: 13, color: '#FFFFFF', fontWeight: '600', marginBottom: 2 }}>{t('profile.targetsLine', { cal: previewTargets.caloric_target, protein: previewTargets.protein_target, carbs: previewTargets.carb_target, fat: previewTargets.fat_target })}</Text>
                      <Text style={{ fontSize: 11, color: '#8A8A94', marginTop: 4 }}>{t('profile.savedAuto')}</Text>
                    </View>
                  );
                })()}

                <Text style={styles.inputLabel}>{t('profile.whatTrain')}</Text>
                <Text style={styles.inputSub}>{t('profile.whatTrainSub')}</Text>
                <View style={styles.goalsWrap}>
                  {ACTIVITY_TYPES.map(a => (
                    <Pressable
                      key={a.key}
                      style={[styles.goalChip, selectedActivities.includes(a.key) && styles.goalChipActive]}
                      onPress={() => setSelectedActivities(p => p.includes(a.key) ? p.filter(x => x !== a.key) : [...p, a.key])}
                    >
                      <Text style={[styles.goalChipText, selectedActivities.includes(a.key) && styles.goalChipTextActive]}>{t(`profile.activities.${a.key}`)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { marginTop: 20 }]}>{t('profile.sports')}</Text>
                <Text style={styles.inputSub}>{t('profile.sportsSub')}</Text>
                <View style={styles.goalsWrap}>
                  {[
                    { key: 'swimming',     label: 'Swimming' },
                    { key: 'running',      label: 'Running' },
                    { key: 'cycling',      label: 'Cycling' },
                    { key: 'football',     label: 'Football / Soccer' },
                    { key: 'basketball',   label: 'Basketball' },
                    { key: 'tennis',       label: 'Tennis / Racket sports' },
                    { key: 'martial_arts', label: 'Martial arts' },
                  ].map(s => {
                    const selected = selectedSports.find(x => x.key === s.key);
                    return (
                      <Pressable
                        key={s.key}
                        style={[styles.goalChip, selected && styles.goalChipActive]}
                        onPress={() => setSelectedSports(p =>
                          selected ? p.filter(x => x.key !== s.key) : [...p, { key: s.key, label: s.label, days: [] }]
                        )}
                      >
                        <Text style={[styles.goalChipText, selected && styles.goalChipTextActive]}>{t(`onboarding.sports.${s.key}`, { defaultValue: s.label })}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {selectedSports.length > 0 && (
                  <View style={{ marginTop: 14, gap: 14 }}>
                    {selectedSports.map(s => (
                      <View key={s.key}>
                        <Text style={{ fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8 }}>{t('profile.sportDays', { sport: t(`onboarding.sports.${s.key}`, { defaultValue: s.label || s.key }) })}</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {['mon','tue','wed','thu','fri','sat','sun'].map((wd, i) => {
                            const full = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i];
                            const active = (s.days || []).includes(full);
                            return (
                              <Pressable
                                key={full}
                                style={[styles.profDayBtn, active && styles.profDayBtnActive]}
                                onPress={() => setSelectedSports(prev => prev.map(x =>
                                  x.key !== s.key ? x : { ...x, days: active ? x.days.filter(d => d !== full) : [...(x.days || []), full] }
                                ))}
                              >
                                <Text style={[styles.profDayBtnText, active && styles.profDayBtnTextActive]}>{t(`weekdaysShort.${wd}`)}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.inputLabel}>{t('profile.injuries')}</Text>
                <Text style={styles.inputSub}>{t('profile.injuriesSub')}</Text>
                {INJURY_BODY_PARTS.map(bp => {
                  const entry = injuryProfile.find(i => i.body_part === bp.key);
                  const setSeverity = (sev) => {
                    setInjuryProfile(prev => {
                      const without = prev.filter(i => i.body_part !== bp.key);
                      return sev ? [...without, { body_part: bp.key, severity: sev }] : without;
                    });
                  };
                  return (
                    <View key={bp.key} style={styles.injuryRow}>
                      <Text style={styles.injuryLabel}>{bp.label}</Text>
                      <View style={styles.injuryOpts}>
                        {[[null, t('profile.injNone')], ['sometimes', t('profile.injSometimes')], ['always', t('profile.injAlways')]].map(([val, label]) => (
                          <Pressable
                            key={label}
                            style={[styles.injuryOpt, (entry?.severity ?? null) === val && styles.injuryOptActive]}
                            onPress={() => setSeverity(val)}
                          >
                            <Text style={[styles.injuryOptText, (entry?.severity ?? null) === val && styles.injuryOptTextActive]}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}

                <Text style={[styles.inputLabel, { marginTop: 20 }]}>{t('profile.injuriesConditions')}</Text>
                <Text style={styles.inputSub}>{t('profile.injuriesConditionsSub')}</Text>

                {/* Saved entries */}
                {profileHealthEntries.length > 0 && (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {profileHealthEntries.map((e, i) => (
                      <View key={i} style={styles.profEntryCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profEntryRegion}>{CONDITIONS_DB[e.region]?.label}</Text>
                          <Text style={styles.profEntryLabel}>{conditionSummaryLabel(e)}</Text>
                        </View>
                        <Pressable onPress={() => setProfileHealthEntries(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 6 }}>
                          <Text style={{ color: '#9494A0', fontSize: 14 }}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Phase: list */}
                {ph6phase === 'list' && (
                  <>
                    <TextInput
                      style={styles.input}
                      value={ph6search}
                      onChangeText={setPh6search}
                      placeholder={t('profile.searchPlaceholder')}
                      placeholderTextColor="#8A8A94"
                      clearButtonMode="while-editing"
                    />
                    <View style={{ marginTop: 12 }}>
                      {Object.entries(CONDITIONS_DB).map(([regionKey, region]) => {
                        const filtered = ph6search.trim()
                          ? region.conditions.filter(c =>
                              c.label.toLowerCase().includes(ph6search.toLowerCase()) ||
                              region.label.toLowerCase().includes(ph6search.toLowerCase())
                            )
                          : region.conditions;
                        if (filtered.length === 0) return null;
                        return (
                          <View key={regionKey} style={{ marginBottom: 16 }}>
                            <Text style={styles.profCondRegion}>{region.label}</Text>
                            {filtered.map((cond, ci) => (
                              <Pressable
                                key={cond.key}
                                style={[styles.profCondRow, ci < filtered.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' }]}
                                onPress={() => {
                                  setPh6pending({ region: regionKey, conditionKey: cond.key, conditionLabel: cond.label, canBePost: cond.canBePost, alwaysPost: cond.alwaysPost, isVariable: cond.isVariable });
                                  setPh6phase(cond.alwaysPost ? 'post_op' : 'severity');
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.profCondLabel}>{cond.label}</Text>
                                  <Text style={styles.profCondDesc}>{cond.desc}</Text>
                                </View>
                                <Text style={{ fontSize: 18, color: '#8A8A94' }}>›</Text>
                              </Pressable>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* Phase: severity */}
                {ph6phase === 'severity' && ph6pending && (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={() => setPh6phase('list')} style={{ marginBottom: 4 }}>
                      <Text style={{ color: '#9494A0', fontSize: 14 }}>← {t('common.back')}</Text>
                    </Pressable>
                    <Text style={[styles.inputLabel, { marginBottom: 8 }]}>{t('profile.severityQuestion', { condition: ph6pending.conditionLabel })}</Text>
                    {SEVERITY_OPTIONS.map(s => (
                      <Pressable
                        key={s.key}
                        style={styles.profLayerCard}
                        onPress={() => {
                          if (ph6pending.canBePost && s.key === 'severe') { setPh6phase('post_op'); return; }
                          setProfileHealthEntries(prev => [...prev, { region: ph6pending.region, conditionKey: ph6pending.conditionKey, conditionLabel: ph6pending.conditionLabel, severity: s.key, postOp: false, postOpTimeline: null, isVariable: ph6pending.isVariable }]);
                          setPh6phase('list'); setPh6pending(null); setPh6search('');
                        }}
                      >
                        <Text style={styles.profLayerLabel}>{s.label}</Text>
                        <Text style={styles.profLayerDesc}>{s.desc}</Text>
                      </Pressable>
                    ))}
                    {ph6pending.canBePost && (
                      <Pressable style={[styles.profLayerCard, { borderColor: '#3D3D5C' }]} onPress={() => setPh6phase('post_op')}>
                        <Text style={styles.profLayerLabel}>{t('profile.postSurgery')}</Text>
                        <Text style={styles.profLayerDesc}>{t('profile.postSurgeryDesc')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Phase: post-op timeline */}
                {ph6phase === 'post_op' && ph6pending && (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={() => setPh6phase(ph6pending.alwaysPost ? 'list' : 'severity')} style={{ marginBottom: 4 }}>
                      <Text style={{ color: '#9494A0', fontSize: 14 }}>← {t('common.back')}</Text>
                    </Pressable>
                    <Text style={[styles.inputLabel, { marginBottom: 8 }]}>{t('profile.surgeryWhen')}</Text>
                    {POST_OP_TIMELINE_OPTIONS.map(opt => (
                      <Pressable
                        key={opt.key}
                        style={styles.profLayerCard}
                        onPress={() => {
                          setProfileHealthEntries(prev => [...prev, { region: ph6pending.region, conditionKey: ph6pending.conditionKey, conditionLabel: ph6pending.conditionLabel, severity: 'severe', postOp: true, postOpTimeline: opt.key, isVariable: false }]);
                          setPh6phase('list'); setPh6pending(null); setPh6search('');
                        }}
                      >
                        <Text style={styles.profLayerLabel}>{opt.label}</Text>
                        <Text style={styles.profLayerDesc}>{opt.desc}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.profileField}>{t('profile.fieldName')}: <Text style={styles.profileFieldVal}>{profile?.name}</Text></Text>
                <Text style={styles.profileField}>{t('profile.fieldWeight')}: <Text style={styles.profileFieldVal}>{profile?.weight_kg ? `${profile.weight_kg} kg` : '—'}</Text></Text>
                <Text style={styles.profileField}>{t('profile.fieldHeight')}: <Text style={styles.profileFieldVal}>{profile?.height_cm ? `${profile.height_cm} cm` : '—'}</Text></Text>
                <Text style={styles.profileField}>{t('profile.fieldTarget')}: <Text style={styles.profileFieldVal}>{profile?.target_weight_kg ? `${profile.target_weight_kg} kg` : '—'}</Text></Text>
                <Text style={styles.profileField}>{t('profile.fieldTraining')}: <Text style={styles.profileFieldVal}>{t('profile.trainingVal', { days: profile?.weekly_workouts, min: profile?.session_length })}</Text></Text>
                <Text style={styles.profileField}>{t('profile.fieldExperience')}: <Text style={styles.profileFieldVal}>{t(`levels.${profile?.trainingExperience || 'beginner'}`)}</Text></Text>
                <Text style={styles.profileField}>{t('profile.fieldNutrition')}: <Text style={styles.profileFieldVal}>{(profile?.nutrition_focus ? t(`profile.focus.${profile.nutrition_focus}`) : t('profile.nutritionNotSet'))}{profile?.caloric_target ? t('profile.nutritionSuffix', { cal: profile.caloric_target, protein: profile.protein_target }) : ''}</Text></Text>
                {(profile?.sports || []).length > 0 && (
                  <Text style={styles.profileField}>{t('profile.fieldSports')}: <Text style={styles.profileFieldVal}>{profile.sports.map(s => t(`onboarding.sports.${s.key}`, { defaultValue: s.label || s.key })).join(', ')}</Text></Text>
                )}
                <View style={[styles.goalsWrap, { marginTop: 8 }]}>
                  {(profile?.goals || []).map(g => (
                    <View key={g} style={styles.goalChipActive}><Text style={styles.goalChipTextActive}>{t(`onboarding.goals.${g}`, { defaultValue: g })}</Text></View>
                  ))}
                </View>
                {(profile?.equipment || []).length > 0 && (
                  <>
                    <Text style={[styles.profileField, { marginTop: 10 }]}>{t('profile.equipment')}</Text>
                    <View style={[styles.goalsWrap, { marginTop: 4 }]}>
                      {(profile?.equipment || []).map(e => (
                        <View key={e} style={styles.goalChipActive}><Text style={styles.goalChipTextActive}>{equipLabel(t, e)}</Text></View>
                      ))}
                    </View>
                  </>
                )}
                {profileHealthEntries.length > 0 && (
                  <>
                    <Text style={[styles.profileField, { marginTop: 10 }]}>{t('profile.fieldConditions')}</Text>
                    <View style={{ gap: 6, marginTop: 4 }}>
                      {profileHealthEntries.map((e, i) => (
                        <View key={i} style={[styles.goalChipActive, { backgroundColor: '#E85D5C22', borderColor: '#E85D5C44', paddingVertical: 6, paddingHorizontal: 10 }]}>
                          <Text style={[styles.goalChipTextActive, { color: '#E85D5C' }]}>{conditionSummaryLabel(e)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </View>

          {/* Quick weight log */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profile.logWeight')}</Text>
            <View style={styles.quickWeightRow}>
              <TextInput
                style={styles.quickWeightInput}
                value={quickWeight}
                onChangeText={setQuickWeight}
                placeholder={t('profile.weightPlaceholder')}
                placeholderTextColor="#8A8A94"
                keyboardType="decimal-pad"
              />
              <Pressable style={[styles.quickWeightBtn, quickWeightSaved && { backgroundColor: '#1D9E75' }]} onPress={logQuickWeight}>
                <Text style={styles.quickWeightBtnText}>{quickWeightSaved ? t('profile.weightSaved') : t('profile.logBtn')}</Text>
              </Pressable>
            </View>
            <Text style={styles.quickWeightTip}>
              {t('profile.weightTip')}
            </Text>
          </View>

          {/* Body composition trend card */}
          <BodyCompositionCard metrics={metrics} profile={profile} />

          {/* Language */}
          <View style={styles.card}>
            <Pressable style={styles.langRow} onPress={() => setLangOpen(true)}>
              <Text style={styles.cardTitle}>{t('language.settingsLabel')}</Text>
              <View style={styles.langRowRight}>
                <Text style={styles.langRowValue}>
                  {(LANGUAGES.find(l => l.code === i18n.language?.split('-')[0]) || LANGUAGES[0]).label}
                </Text>
                <Text style={styles.dropdownArrow}>▸</Text>
              </View>
            </Pressable>
          </View>

          {/* Account actions */}
          <View style={styles.accountSection}>
            <Pressable onPress={() => Linking.openURL('https://venerable-nasturtium-4e9b15.netlify.app/')}>
              <Text style={styles.privacyLink}>{t('profile.privacyPolicy')}</Text>
            </Pressable>
            <Pressable style={styles.deleteAccountBtn} onPress={deleteAccount}>
              <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
            </Pressable>
            <Text style={styles.deleteAccountSub}>
              {t('profile.deleteAccountSub')}
            </Text>
          </View>
            </View>
          )}

          {/* ─── DATA TAB ─── */}
          {activeTab === 'data' && (
            <View style={{ paddingTop: 4 }}>
          <View style={styles.card}>
            {/* Controls row */}
            <View style={styles.dataControlRow}>
              <Pressable style={styles.muscleDropdownBtn} onPress={() => setShowMuscleDropdown(v => !v)}>
                <Text style={styles.muscleDropdownText}>{t(`today.muscles.${selectedMuscle.toLowerCase()}`, { defaultValue: selectedMuscle })}</Text>
                <Text style={styles.dropdownArrow}>{showMuscleDropdown ? '▲' : '▼'}</Text>
              </Pressable>
              <View style={styles.weekNav}>
                <Pressable onPress={() => setWeekOffset(v => v+1)} style={styles.weekNavBtn}>
                  <Text style={styles.weekNavArrow}>‹</Text>
                </Pressable>
                <Text style={styles.weekNavLabel}>{weekLabel}</Text>
                <Pressable onPress={() => setWeekOffset(v => Math.max(0,v-1))} style={[styles.weekNavBtn, weekOffset===0&&{opacity:0.3}]} disabled={weekOffset===0}>
                  <Text style={styles.weekNavArrow}>›</Text>
                </Pressable>
              </View>
            </View>

            {showMuscleDropdown && (
              <View style={styles.dropdownList}>
                {MUSCLE_GROUPS.map(m => (
                  <Pressable key={m} style={[styles.dropdownItem, selectedMuscle===m&&styles.dropdownItemActive]} onPress={() => { setSelectedMuscle(m); setShowMuscleDropdown(false); }}>
                    <Text style={[styles.dropdownItemText, selectedMuscle===m&&styles.dropdownItemTextActive]}>{t(`today.muscles.${m.toLowerCase()}`, { defaultValue: m })}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.chartTitleRow}>
              <Text style={styles.chartTitle}>{t('profile.chartTitle', { muscle: t(`today.muscles.${selectedMuscle.toLowerCase()}`, { defaultValue: selectedMuscle }), week: weekLabel })}</Text>
              <View style={[styles.totalBadge, totalSets === 0 && styles.totalBadgeEmpty]}>
                <Text style={[styles.totalBadgeText, totalSets === 0 && { color: '#9494A0' }]}>
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
                  <Text style={[styles.dayBreakSets, d.sets===0&&{color:'#8A8A94'}]}>{d.sets > 0 ? t('profile.daySets', { n: d.sets }) : '—'}</Text>
                </View>
              );
            })}
          </View>
            </View>
          )}

          {/* ─── HISTORY TAB ─── */}
          {/* ─── PRs TAB ─── */}
          {activeTab === 'prs' && (
            <View style={{ paddingTop: 4 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('profile.personalRecords', { count: prs.length })}</Text>
            {prs.length === 0
              ? <Text style={styles.empty}>{t('profile.noPrs')}</Text>
              : prs.map((pr, i) => (
                <View key={i} style={styles.prRow}>
                  <View style={[styles.prRank, i < 3 && { backgroundColor: i===0?'#BA7517':i===1?'#9494A0':'#3D3D4A' }]}>
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
          )}
          {/* ─── HEALTH TAB ─── */}
          {activeTab === 'health' && (
            <View style={{ paddingTop: 4 }}>

          {/* The "unavailable" / "install Health Connect" placeholders that used to
              live here are gone: TABS only offers this tab when isHealthAvailable()
              is true, so they were unreachable. A tab whose only content is "this
              tab does nothing" should not exist. */}
          {isHealthAvailable() && !healthAuthorized && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('profile.connect', { provider: Platform.OS === 'ios' ? t('profile.providerApple') : t('profile.providerHC') })}</Text>
              <Text style={styles.healthDesc}>
                {t('profile.healthDesc', { provider: Platform.OS === 'ios' ? t('profile.providerApple') : t('profile.providerHC'), companion: Platform.OS === 'ios' ? '' : t('profile.companionAndroid') })}
              </Text>
              <Pressable style={styles.healthConnectBtn} onPress={handleConnectHealth} disabled={healthLoading}>
                <Text style={styles.healthConnectBtnText}>
                  {healthLoading ? t('profile.connecting') : t('profile.connectBtn')}
                </Text>
              </Pressable>
            </View>
          )}

          {isHealthAvailable() && healthAuthorized && (
            <>
              {/* Recovery status */}
              <View style={[styles.card, recoveryData?.status && { borderColor: recoveryData.status.color + '44', borderWidth: 1 }]}>
                <Text style={styles.cardTitle}>{t('profile.todayRecovery')}</Text>
                {!recoveryData?.status && (
                  <Text style={styles.empty}>{t('profile.noHealthToday')}</Text>
                )}
                {recoveryData?.status && (
                  <>
                    <Text style={[styles.healthStatusLabel, { color: recoveryData.status.color }]}>
                      {recoveryData.status.label}
                    </Text>
                    <View style={styles.healthMetricsRow}>
                      {recoveryData.sleep !== null && (
                        <View style={styles.healthMetric}>
                          <Text style={styles.healthMetricVal}>{recoveryData.sleep}h</Text>
                          <Text style={styles.healthMetricLabel}>{t('profile.sleep')}</Text>
                        </View>
                      )}
                      {recoveryData.hrv !== null && (
                        <View style={styles.healthMetric}>
                          <Text style={styles.healthMetricVal}>{recoveryData.hrv} ms</Text>
                          <Text style={styles.healthMetricLabel}>{t('profile.hrv')}</Text>
                        </View>
                      )}
                      {recoveryData.rhr !== null && (
                        <View style={styles.healthMetric}>
                          <Text style={styles.healthMetricVal}>{recoveryData.rhr} bpm</Text>
                          <Text style={styles.healthMetricLabel}>{t('profile.restingHr')}</Text>
                        </View>
                      )}
                    </View>
                    {recoveryData.status.advice && (
                      <Text style={styles.healthAdvice}>{recoveryData.status.advice}</Text>
                    )}
                  </>
                )}
              </View>

              {/* What we read */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('profile.dataSources')}</Text>
                {[
                  [t('profile.sourceSleep'), t('profile.sourceSleepDesc')],
                  [t('profile.hrv'), Platform.OS === 'ios' ? t('profile.sourceHrvDescIos') : t('profile.sourceHrvDescAndroid')],
                  [t('profile.sourceRhr'), t('profile.sourceRhrDesc')],
                ].map(([name, desc]) => (
                  <View key={name} style={styles.healthSourceRow}>
                    <Text style={styles.healthSourceName}>{name}</Text>
                    <Text style={styles.healthSourceDesc}>{desc}</Text>
                  </View>
                ))}
              </View>

              {/* Disconnect */}
              <Pressable style={styles.healthDisconnectBtn} onPress={handleDisconnectHealth}>
                <Text style={styles.healthDisconnectText}>{t('profile.disconnect')}</Text>
              </Pressable>
            </>
          )}

            </View>
          )}

        </View>
      </ScrollView>
      </KeyboardAvoidingView>
      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { backgroundColor: '#0F0F13', paddingHorizontal: 20, paddingTop: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19, fontWeight: '700', color: '#111114' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  profileEmail: { fontSize: 12, color: '#9494A0', marginTop: 1 },
  signOut: { fontSize: 12, color: '#9494A0' },
  adminBtn: { backgroundColor: '#1C1C22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: '#FFFFFF' },
  adminBtnText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  insightsCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#0F1A16', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#1D9E7544' },
  insightsTitle: { fontSize: 13, fontWeight: '700', color: '#1D9E75', marginBottom: 12 },
  insightItem: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1D9E75', marginTop: 6 },
  insightText: { flex: 1, fontSize: 13, color: '#A1A1AA', lineHeight: 19 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  statVal: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 9, color: '#9494A0', marginTop: 2 },
  tabRow: { flexDirection: 'row', backgroundColor: '#0F0F13', borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FFFFFF' },
  tabText: { fontSize: 12, color: '#9494A0', fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  card: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginTop: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  editBtn: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  cancelBtn: { fontSize: 13, color: '#9494A0' },
  saveBtn: { fontSize: 13, color: '#1D9E75', fontWeight: '600' },
  inputLabel: { fontSize: 11, color: '#9494A0', marginBottom: 5, marginTop: 10 },
  inputSub: { fontSize: 11, color: '#8A8A94', marginBottom: 8, lineHeight: 16 },
  input: { backgroundColor: '#2C2C35', borderRadius: 8, padding: 11, color: '#FFF', fontSize: 14 },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  optionBtn: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  optionBtnActive: { backgroundColor: '#FFFFFF' },
  optionBtnText: { color: '#9494A0', fontSize: 13, fontWeight: '500' },
  optionBtnTextActive: { color: '#111114' },
  profileField: { fontSize: 13, color: '#9494A0', marginBottom: 5 },
  profileFieldVal: { color: '#FFF', fontWeight: '500' },
  goalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  injuryRow: { marginBottom: 12 },
  injuryLabel: { fontSize: 13, color: '#E4E4E8', fontWeight: '500', marginBottom: 6 },
  injuryOpts: { flexDirection: 'row', gap: 6 },
  injuryOpt: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  injuryOptActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  injuryOptText: { fontSize: 12, color: '#9494A0', fontWeight: '600' },
  injuryOptTextActive: { color: '#111114' },
  profEntryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#FFFFFF' },
  profEntryRegion: { fontSize: 10, color: '#9494A0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  profEntryLabel: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  profCondRegion: { fontSize: 11, color: '#9494A0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  profCondRow: { backgroundColor: '#1A1A20', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  profCondLabel: { fontSize: 13, color: '#E4E4E8', fontWeight: '500', marginBottom: 2 },
  profCondDesc: { fontSize: 11, color: '#9494A0' },
  profLayerCard: { backgroundColor: '#1A1A20', borderRadius: 10, padding: 14, borderWidth: 0.5, borderColor: '#2C2C35' },
  profLayerLabel: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginBottom: 2 },
  profLayerDesc: { fontSize: 12, color: '#9494A0' },
  profDayBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  profDayBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  profDayBtnText: { fontSize: 11, color: '#9494A0', fontWeight: '600' },
  profDayBtnTextActive: { color: '#111114' },
  goalChip: { backgroundColor: '#12121A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: '#2C2C35' },
  goalChipActive: { backgroundColor: '#1C1C22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: '#FFFFFF' },
  goalChipText: { fontSize: 12, color: '#9494A0' },
  goalChipTextActive: { fontSize: 12, color: '#E4E4E8' },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  metricDate: { fontSize: 12, color: '#9494A0', width: 45 },
  metricVal: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  metricSub: { fontSize: 12, color: '#9494A0' },
  empty: { fontSize: 13, color: '#9494A0' },
  dataControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  muscleDropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  muscleDropdownText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  dropdownArrow: { fontSize: 9, color: '#9494A0' },
  dropdownList: { backgroundColor: '#2C2C35', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14 },
  dropdownItemActive: { backgroundColor: '#1C1C22' },
  dropdownItemText: { fontSize: 13, color: '#A1A1AA' },
  dropdownItemTextActive: { color: '#FFFFFF', fontWeight: '600' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekNavBtn: { padding: 6 },
  weekNavArrow: { fontSize: 22, color: '#FFFFFF', fontWeight: '700', lineHeight: 24 },
  weekNavLabel: { fontSize: 11, color: '#9494A0', minWidth: 75, textAlign: 'center' },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  chartTitle: { fontSize: 12, color: '#9494A0' },
  totalBadge: { backgroundColor: '#1C1C22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#FFFFFF' },
  totalBadgeEmpty: { borderColor: '#2C2C35', backgroundColor: '#12121A' },
  totalBadgeText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
  targetNote: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  targetNoteText: { fontSize: 11, color: '#9494A0', fontStyle: 'italic' },
  dayBreakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  dayBreakLabel: { fontSize: 12, color: '#9494A0', width: 30, fontWeight: '500' },
  dayBreakBar: { flex: 1, height: 6, backgroundColor: '#2C2C35', borderRadius: 3, overflow: 'hidden' },
  dayBreakFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3 },
  dayBreakSets: { fontSize: 11, color: '#FFFFFF', fontWeight: '600', width: 32, textAlign: 'right' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  prRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1C1C22', alignItems: 'center', justifyContent: 'center' },
  prRankText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  prName: { fontSize: 13, color: '#FFF', flex: 1 },
  prValGroup: { alignItems: 'flex-end' },
  prWeight: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  prReps: { fontSize: 12, color: '#9494A0' },
  prOrm: { fontSize: 10, color: '#9494A0', marginTop: 1 },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  langRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langRowValue: { fontSize: 14, color: '#A1A1AA' },
  // History tab
  rpeTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rpeTagText: { fontSize: 10, fontWeight: '600' },
  // Quick weight log
  quickWeightRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickWeightInput: { flex: 1, backgroundColor: '#12121A', borderRadius: 10, padding: 11, color: '#FFF', fontSize: 14, borderWidth: 0.5, borderColor: '#2C2C35' },
  quickWeightBtn: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  quickWeightBtnText: { color: '#111114', fontWeight: '700', fontSize: 14 },
  quickWeightTip: { fontSize: 11, color: '#8A8A94', lineHeight: 16 },
  accountSection: { paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center', gap: 4 },
  privacyLink: { fontSize: 13, color: '#9494A0', textDecorationLine: 'underline', paddingVertical: 8 },
  deleteAccountBtn: { paddingVertical: 10 },
  deleteAccountText: { fontSize: 13, color: '#E85D5C', fontWeight: '500' },
  deleteAccountSub: { fontSize: 11, color: '#8A8A94', textAlign: 'center', marginTop: 4 },
  expBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  expBtnActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  expBtnLabel: { fontSize: 13, fontWeight: '600', color: '#9494A0' },
  expBtnLabelActive: { color: '#FFFFFF' },
  expBtnSub: { fontSize: 10, color: '#8A8A94', marginTop: 2 },
  expBtnSubActive: { color: '#FFFFFF' },
  // Health tab
  healthDesc: { fontSize: 13, color: '#9494A0', lineHeight: 20, marginBottom: 16 },
  healthConnectBtn: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  healthConnectBtnText: { fontSize: 14, fontWeight: '700', color: '#111114' },
  healthStatusLabel: { fontSize: 32, fontWeight: '800', marginBottom: 14 },
  healthMetricsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  healthMetric: { flex: 1, backgroundColor: '#12121A', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  healthMetricVal: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  healthMetricLabel: { fontSize: 10, color: '#9494A0' },
  healthAdvice: { fontSize: 13, color: '#A1A1AA', lineHeight: 19, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  healthSourceRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  healthSourceName: { fontSize: 13, fontWeight: '600', color: '#FFF', marginBottom: 2 },
  healthSourceDesc: { fontSize: 12, color: '#9494A0', lineHeight: 17 },
  healthDisconnectBtn: { marginHorizontal: 20, marginTop: 14, paddingVertical: 14, alignItems: 'center' },
  healthDisconnectText: { fontSize: 13, color: '#9494A0' },
});