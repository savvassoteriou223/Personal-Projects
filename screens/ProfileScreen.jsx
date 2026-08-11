import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, getCurrentUser } from '../supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminScreen from './AdminScreen';
import { format, startOfWeek } from 'date-fns';
import { calculateTDEE, calculateNutritionTargets, INJURY_BODY_PARTS } from './programGenerator';
import { computeInsights } from './insightsEngine';
import BodyCompositionCard from './BodyCompositionCard';
import { CONDITIONS_DB, SEVERITY_OPTIONS, POST_OP_TIMELINE_OPTIONS, deriveConditionKeys, conditionSummaryLabel } from '../lib/conditionsDb';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import SettingsScreen from './SettingsScreen';
import DataScreen from './DataScreen';
import { colors } from '../lib/theme';
import { animateLayout } from '../lib/motion';
import Tappable from '../components/Tappable';
import { syncWorkoutReminders } from '../lib/notificationService';

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

const EXPERIENCE_LEVELS = [
  { key: 'beginner',     label: 'Beginner',     sub: '< 2 years' },
  { key: 'intermediate', label: 'Intermediate', sub: '2–4 years' },
  { key: 'advanced',     label: 'Advanced',     sub: '4+ years' },
];

export default function ProfileScreen({ onSignOut, isAdmin, isPremium, onUpgrade, onRestore }) {
  const { t } = useTranslation();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showData, setShowData] = useState(false);
  const [profile, setProfile] = useState(null);
  const [metrics, setMetrics] = useState([]);
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
  const [weeklySetTrend, setWeeklySetTrend] = useState([]); // last 6 weeks: [{weekStart, sets}]
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  // Quick body weight log
  const [quickWeight, setQuickWeight] = useState('');
  const [quickWeightSaved, setQuickWeightSaved] = useState(false);
  // Edit-form accordion: which collapsible sections are open. Independent,
  // not mutually exclusive — a settings form benefits from comparing two
  // groups at once, unlike a single-lens content tab.
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (key) => {
    animateLayout();
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const summarize = (labels, max = 3) => {
    if (!labels.length) return null;
    if (labels.length <= max) return labels.join(', ');
    return `${labels.slice(0, max).join(', ')} +${labels.length - max}`;
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

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

      // Training volume trend — real completed_sets, last 6 weeks, total sets
      // per week. Distinct from Today/Program's "this week only" snapshot —
      // this is the consistency-over-time view.
      (async () => {
        const sixWeeksAgo = startOfWeek(new Date(Date.now() - 42 * 86400000), { weekStartsOn: 1 });
        const recentSessions = sessionData.filter(s => new Date(s.completed_at) >= sixWeeksAgo);
        if (!recentSessions.length) { setWeeklySetTrend([]); return; }
        const ids = recentSessions.map(s => s.id);
        const { data: sets } = await supabase.from('completed_sets').select('session_id').in('session_id', ids);
        const sessionWeek = {};
        recentSessions.forEach(s => {
          sessionWeek[s.id] = startOfWeek(new Date(s.completed_at), { weekStartsOn: 1 }).toISOString().split('T')[0];
        });
        const byWeek = {};
        (sets || []).forEach(row => {
          const wk = sessionWeek[row.session_id];
          if (wk) byWeek[wk] = (byWeek[wk] || 0) + 1;
        });
        const weeks = [];
        for (let i = 5; i >= 0; i--) {
          const wk = startOfWeek(new Date(Date.now() - i * 7 * 86400000), { weekStartsOn: 1 }).toISOString().split('T')[0];
          weeks.push({ weekStart: wk, sets: byWeek[wk] || 0 });
        }
        setWeeklySetTrend(weeks);
      })();
    }

    const { data: bm } = await supabase.from('body_metrics').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(90);
    if (bm) setMetrics(bm);
    setLoading(false);
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
    // No goal_set_at column exists — a changed goals[] restarts the local
    // milestone clock instead, and clears any milestones already shown for
    // the old goal so a genuinely new goal gets its own checkpoints.
    const prevGoals = profile?.goals || [];
    const goalsChanged = JSON.stringify([...selectedGoals].sort()) !== JSON.stringify([...prevGoals].sort());

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

    if (goalsChanged) {
      await AsyncStorage.setItem('goalStartedAt', new Date().toISOString());
      await AsyncStorage.removeItem('shownMilestoneIds');
    }

    // Days-per-week drives which weekdays get a reminder — rebuild the schedule.
    syncWorkoutReminders({
      weeklyWorkouts: weeklyW,
      content: { title: t('settings.reminderPushTitle'), body: t('settings.reminderPushBody') },
    });

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

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    </SafeAreaView>
  );

  const h = parseFloat(editing ? height : profile?.height_cm);
  const w = parseFloat(editing ? weight : profile?.weight_kg);
  const bmi = h && w ? (w / ((h/100)**2)).toFixed(1) : null;
  const bmiColor = bmi ? (bmi < 18.5 ? colors.warning : bmi < 25 ? colors.accent : bmi < 30 ? colors.warning : colors.danger) : null;

  // Live preview of the calculated nutrition targets — used both inside the
  // Nutrition focus section and in its collapsed-section summary.
  const previewTdee = calculateTDEE(parseFloat(weight), parseFloat(height), profile?.age, sex, parseInt(weeklyWorkouts) || 3);
  const previewTargets = previewTdee && parseFloat(weight) ? calculateNutritionTargets(previewTdee, parseFloat(weight), nutritionFocus) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
                <Tappable onPress={() => setShowAdmin(true)} style={styles.adminBtn}>
                  <Text style={styles.adminBtnText}>{t('profile.admin')}</Text>
                </Tappable>
              )}
              <Tappable onPress={() => setShowSettings(true)} style={styles.gearBtn} hitSlop={8} accessibilityLabel={t('settings.title')}>
                <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
              </Tappable>
            </View>
          </View>
          <AdminScreen visible={showAdmin} onClose={() => setShowAdmin(false)} />
          <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} onSignOut={onSignOut} weeklyWorkouts={profile?.weekly_workouts} />
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

        <Tappable style={styles.dataRow} onPress={() => setShowData(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dataRowLabel}>{t('data.rowTitle')}</Text>
            <Text style={styles.dataRowSub}>{t('data.rowSub')}</Text>
          </View>
          {!isPremium && (
            <View style={styles.dataRowLock}>
              <Ionicons name="lock-closed" size={9} color={colors.textOnLight} />
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Tappable>
        <DataScreen visible={showData} onClose={() => setShowData(false)} isPremium={isPremium} onUpgrade={onUpgrade} onRestore={onRestore} />

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

        <View style={{ paddingTop: 4 }}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('profile.myProfile')}</Text>
              {!editing
                ? <Tappable onPress={() => setEditing(true)}><Text style={styles.editBtn}>{t('profile.edit')}</Text></Tappable>
                : <View style={{ flexDirection: 'row' }}>
                    <Tappable onPress={() => setEditing(false)} style={{ marginRight: 16 }}><Text style={styles.cancelBtn}>{t('common.cancel')}</Text></Tappable>
                    <Tappable onPress={saveProfile}><Text style={styles.saveBtn}>{t('common.save')}</Text></Tappable>
                  </View>
              }
            </View>
            {editing ? (
              <>
                {[['name', name, setName, 'default'], ['weight', weight, setWeight, 'decimal-pad'], ['height', height, setHeight, 'decimal-pad'], ['targetWeight', targetWeight, setTargetWeight, 'decimal-pad']].map(([fieldKey, val, setter, kb]) => (
                  <View key={fieldKey}>
                    <Text style={styles.inputLabel}>{t(`profile.fields.${fieldKey}`)}</Text>
                    <TextInput style={styles.input} value={val} onChangeText={setter} keyboardType={kb} placeholderTextColor={colors.textFaint} />
                  </View>
                ))}
                <Text style={styles.inputLabel}>{t('profile.daysPerWeek')}</Text>
                <View style={styles.optionRow}>
                  {[2,3,4,5,6].map(d => (
                    <Tappable key={d} style={[styles.optionBtn, parseInt(weeklyWorkouts)===d && styles.optionBtnActive]} onPress={() => setWeeklyWorkouts(d.toString())} accessibilityState={{ selected: parseInt(weeklyWorkouts)===d }}>
                      <Text style={[styles.optionBtnText, parseInt(weeklyWorkouts)===d && styles.optionBtnTextActive]}>{d}</Text>
                    </Tappable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.sessionLength')}</Text>
                <View style={styles.optionRow}>
                  {[30,45,60,90,120].map(m => (
                    <Tappable key={m} style={[styles.optionBtn, parseInt(sessionLength)===m && styles.optionBtnActive]} onPress={() => setSessionLength(m.toString())} accessibilityState={{ selected: parseInt(sessionLength)===m }}>
                      <Text style={[styles.optionBtnText, parseInt(sessionLength)===m && styles.optionBtnTextActive]}>{m}m</Text>
                    </Tappable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>{t('profile.experienceLevel')}</Text>
                <View style={styles.optionRow}>
                  {EXPERIENCE_LEVELS.map(lvl => (
                    <Tappable key={lvl.key} style={[styles.expBtn, trainingExperience === lvl.key && styles.expBtnActive]} onPress={() => setTrainingExperience(lvl.key)} accessibilityState={{ selected: trainingExperience === lvl.key }}>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.expBtnLabel, trainingExperience === lvl.key && styles.expBtnLabelActive]}>{t(`levels.${lvl.key}`)}</Text>
                      <Text style={[styles.expBtnSub, trainingExperience === lvl.key && styles.expBtnSubActive]}>{t(`profile.expSub.${lvl.key}`)}</Text>
                    </Tappable>
                  ))}
                </View>
                <AccordionSection
                  title={t('profile.goals')}
                  summary={summarize(selectedGoals.map(g => t(`onboarding.goals.${g}`, { defaultValue: g })))}
                  isOpen={!!openSections.goals}
                  onToggle={() => toggleSection('goals')}
                >
                  <View style={styles.goalsWrap}>
                    {GOALS.map(g => (
                      <Tappable key={g.key} style={[styles.goalChip, selectedGoals.includes(g.key) && styles.goalChipActive]} onPress={() => toggleGoal(g.key)} accessibilityState={{ selected: selectedGoals.includes(g.key) }}>
                        <Text style={[styles.goalChipText, selectedGoals.includes(g.key) && styles.goalChipTextActive]}>{t(`onboarding.goals.${g.key}`)}</Text>
                      </Tappable>
                    ))}
                  </View>
                </AccordionSection>

                <AccordionSection
                  title={t('profile.equipment')}
                  summary={summarize(selectedEquipment.map(e => equipLabel(t, e)))}
                  isOpen={!!openSections.equipment}
                  onToggle={() => toggleSection('equipment')}
                >
                  <Text style={styles.inputSub}>{t('profile.equipmentSub')}</Text>
                  <View style={styles.goalsWrap}>
                  {EQUIPMENT_OPTIONS.map(e => (
                    <Tappable
                      key={e}
                      style={[styles.goalChip, selectedEquipment.includes(e) && styles.goalChipActive]}
                      onPress={() => setSelectedEquipment(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e])}
                      accessibilityState={{ selected: selectedEquipment.includes(e) }}
                    >
                      <Text style={[styles.goalChipText, selectedEquipment.includes(e) && styles.goalChipTextActive]}>{equipLabel(t, e)}</Text>
                    </Tappable>
                  ))}
                  </View>
                </AccordionSection>

                <AccordionSection
                  title={t('profile.nutritionFocus')}
                  summary={previewTargets
                    ? `${t(`profile.focus.${nutritionFocus}`)} · ${previewTargets.caloric_target} kcal · ${previewTargets.protein_target}g protein`
                    : t(`profile.focus.${nutritionFocus}`)}
                  isOpen={!!openSections.nutrition}
                  onToggle={() => toggleSection('nutrition')}
                >
                  <Text style={styles.inputSub}>{t('profile.nutritionFocusSub')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {[['cut', t('profile.focus.cut'), t('profile.focus.cutSub')], ['bulk', t('profile.focus.bulk'), t('profile.focus.bulkSub')], ['maintain', t('profile.focus.maintain'), t('profile.focus.maintainSub')], ['recomp', t('profile.focus.recomp'), t('profile.focus.recompSub')]].map(([val, label, sub]) => (
                      <Tappable key={val} style={[styles.goalChip, nutritionFocus === val && styles.goalChipActive, { paddingVertical: 10 }]} onPress={() => setNutritionFocus(val)} accessibilityState={{ selected: nutritionFocus === val }}>
                        <Text style={[styles.goalChipText, nutritionFocus === val && styles.goalChipTextActive]}>{label}</Text>
                        <Text style={[{ fontSize: 9, color: nutritionFocus === val ? colors.textMuted : colors.textFaint, marginTop: 2 }]}>{sub}</Text>
                      </Tappable>
                    ))}
                  </View>

                  {previewTargets && (
                    <View style={{ backgroundColor: colors.surfaceInset, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.border }}>
                      <Text style={{ fontSize: 10, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{t('profile.calculatedTargets')}</Text>
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 2 }}>{t('profile.maintenanceTdee', { tdee: previewTdee })}</Text>
                      <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600', marginBottom: 2 }}>{t('profile.targetsLine', { cal: previewTargets.caloric_target, protein: previewTargets.protein_target, carbs: previewTargets.carb_target, fat: previewTargets.fat_target })}</Text>
                      <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 4 }}>{t('profile.savedAuto')}</Text>
                    </View>
                  )}
                </AccordionSection>

                <AccordionSection
                  title={t('profile.whatTrain')}
                  summary={summarize(selectedActivities.map(k => t(`profile.activities.${k}`)))}
                  isOpen={!!openSections.activities}
                  onToggle={() => toggleSection('activities')}
                >
                <Text style={styles.inputSub}>{t('profile.whatTrainSub')}</Text>
                <View style={styles.goalsWrap}>
                  {ACTIVITY_TYPES.map(a => (
                    <Tappable
                      key={a.key}
                      style={[styles.goalChip, selectedActivities.includes(a.key) && styles.goalChipActive]}
                      onPress={() => setSelectedActivities(p => p.includes(a.key) ? p.filter(x => x !== a.key) : [...p, a.key])}
                      accessibilityState={{ selected: selectedActivities.includes(a.key) }}
                    >
                      <Text style={[styles.goalChipText, selectedActivities.includes(a.key) && styles.goalChipTextActive]}>{t(`profile.activities.${a.key}`)}</Text>
                    </Tappable>
                  ))}
                </View>
                </AccordionSection>

                <AccordionSection
                  title={t('profile.sports')}
                  summary={summarize(selectedSports.map(s => t(`onboarding.sports.${s.key}`, { defaultValue: s.label || s.key })))}
                  isOpen={!!openSections.sports}
                  onToggle={() => toggleSection('sports')}
                >
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
                      <Tappable
                        key={s.key}
                        style={[styles.goalChip, selected && styles.goalChipActive]}
                        onPress={() => setSelectedSports(p =>
                          selected ? p.filter(x => x.key !== s.key) : [...p, { key: s.key, label: s.label, days: [] }]
                        )}
                        accessibilityState={{ selected: !!selected }}
                      >
                        <Text style={[styles.goalChipText, selected && styles.goalChipTextActive]}>{t(`onboarding.sports.${s.key}`, { defaultValue: s.label })}</Text>
                      </Tappable>
                    );
                  })}
                </View>
                {selectedSports.length > 0 && (
                  <View style={{ marginTop: 14, gap: 14 }}>
                    {selectedSports.map(s => (
                      <View key={s.key}>
                        <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '500', marginBottom: 8 }}>{t('profile.sportDays', { sport: t(`onboarding.sports.${s.key}`, { defaultValue: s.label || s.key }) })}</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {['mon','tue','wed','thu','fri','sat','sun'].map((wd, i) => {
                            const full = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i];
                            const active = (s.days || []).includes(full);
                            return (
                              <Tappable
                                key={full}
                                style={[styles.profDayBtn, active && styles.profDayBtnActive]}
                                onPress={() => setSelectedSports(prev => prev.map(x =>
                                  x.key !== s.key ? x : { ...x, days: active ? x.days.filter(d => d !== full) : [...(x.days || []), full] }
                                ))}
                                accessibilityState={{ selected: active }}
                              >
                                <Text style={[styles.profDayBtnText, active && styles.profDayBtnTextActive]}>{t(`weekdaysShort.${wd}`)}</Text>
                              </Tappable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                </AccordionSection>

                <AccordionSection
                  title={t('profile.injuries')}
                  summary={summarize(injuryProfile.map(i => {
                    const bp = INJURY_BODY_PARTS.find(b => b.key === i.body_part);
                    return `${bp?.label || i.body_part} — ${i.severity === 'always' ? t('profile.injAlways') : t('profile.injSometimes')}`;
                  }))}
                  isOpen={!!openSections.injuries}
                  onToggle={() => toggleSection('injuries')}
                >
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
                          <Tappable
                            key={label}
                            style={[styles.injuryOpt, (entry?.severity ?? null) === val && styles.injuryOptActive]}
                            onPress={() => setSeverity(val)}
                            accessibilityState={{ selected: (entry?.severity ?? null) === val }}
                          >
                            <Text style={[styles.injuryOptText, (entry?.severity ?? null) === val && styles.injuryOptTextActive]}>{label}</Text>
                          </Tappable>
                        ))}
                      </View>
                    </View>
                  );
                })}
                </AccordionSection>

                <AccordionSection
                  title={t('profile.injuriesConditions')}
                  summary={profileHealthEntries.length
                    ? t('profile.conditionsCount', { count: profileHealthEntries.length, defaultValue: `${profileHealthEntries.length} on file` })
                    : null}
                  isOpen={!!openSections.conditions}
                  onToggle={() => toggleSection('conditions')}
                >
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
                        <Tappable onPress={() => setProfileHealthEntries(prev => prev.filter((_, idx) => idx !== i))} style={{ padding: 6 }} accessibilityLabel={t('common.close')}>
                          <Text style={{ color: colors.textSubtle, fontSize: 14 }}>✕</Text>
                        </Tappable>
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
                      placeholderTextColor={colors.textFaint}
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
                              <Tappable
                                key={cond.key}
                                style={[styles.profCondRow, ci < filtered.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}
                                onPress={() => {
                                  setPh6pending({ region: regionKey, conditionKey: cond.key, conditionLabel: cond.label, canBePost: cond.canBePost, alwaysPost: cond.alwaysPost, isVariable: cond.isVariable });
                                  setPh6phase(cond.alwaysPost ? 'post_op' : 'severity');
                                }}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.profCondLabel}>{cond.label}</Text>
                                  <Text style={styles.profCondDesc}>{cond.desc}</Text>
                                </View>
                                <Text style={{ fontSize: 18, color: colors.textFaint }} accessibilityElementsHidden importantForAccessibility="no">›</Text>
                              </Tappable>
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
                    <Tappable onPress={() => setPh6phase('list')} style={{ marginBottom: 4 }}>
                      <Text style={{ color: colors.textSubtle, fontSize: 14 }}>← {t('common.back')}</Text>
                    </Tappable>
                    <Text style={[styles.inputLabel, { marginBottom: 8 }]}>{t('profile.severityQuestion', { condition: ph6pending.conditionLabel })}</Text>
                    {SEVERITY_OPTIONS.map(s => (
                      <Tappable
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
                      </Tappable>
                    ))}
                    {ph6pending.canBePost && (
                      <Tappable style={[styles.profLayerCard, { borderColor: '#3D3D5C' }]} onPress={() => setPh6phase('post_op')}>
                        <Text style={styles.profLayerLabel}>{t('profile.postSurgery')}</Text>
                        <Text style={styles.profLayerDesc}>{t('profile.postSurgeryDesc')}</Text>
                      </Tappable>
                    )}
                  </View>
                )}

                {/* Phase: post-op timeline */}
                {ph6phase === 'post_op' && ph6pending && (
                  <View style={{ gap: 10 }}>
                    <Tappable onPress={() => setPh6phase(ph6pending.alwaysPost ? 'list' : 'severity')} style={{ marginBottom: 4 }}>
                      <Text style={{ color: colors.textSubtle, fontSize: 14 }}>← {t('common.back')}</Text>
                    </Tappable>
                    <Text style={[styles.inputLabel, { marginBottom: 8 }]}>{t('profile.surgeryWhen')}</Text>
                    {POST_OP_TIMELINE_OPTIONS.map(opt => (
                      <Tappable
                        key={opt.key}
                        style={styles.profLayerCard}
                        onPress={() => {
                          setProfileHealthEntries(prev => [...prev, { region: ph6pending.region, conditionKey: ph6pending.conditionKey, conditionLabel: ph6pending.conditionLabel, severity: 'severe', postOp: true, postOpTimeline: opt.key, isVariable: false }]);
                          setPh6phase('list'); setPh6pending(null); setPh6search('');
                        }}
                      >
                        <Text style={styles.profLayerLabel}>{opt.label}</Text>
                        <Text style={styles.profLayerDesc}>{opt.desc}</Text>
                      </Tappable>
                    ))}
                  </View>
                )}
                </AccordionSection>
              </>
            ) : (
              <>
                {[
                  { label: t('profile.fieldWeight'), value: profile?.weight_kg ? `${profile.weight_kg} kg` : '—' },
                  { label: t('profile.fieldHeight'), value: profile?.height_cm ? `${profile.height_cm} cm` : '—' },
                  { label: t('profile.fieldTarget'), value: profile?.target_weight_kg ? `${profile.target_weight_kg} kg` : '—' },
                  { label: t('profile.fieldTraining'), value: t('profile.trainingVal', { days: profile?.weekly_workouts, min: profile?.session_length }) },
                  { label: t('profile.fieldExperience'), value: t(`levels.${profile?.trainingExperience || 'beginner'}`) },
                  // Calories differ on training and rest days, and the Nutrition
                  // tab shows whichever applies today. Showing the base
                  // caloric_target here put a third number on screen that the
                  // user never actually eats to, so the two tabs contradicted
                  // each other one tap apart. Show the real range instead.
                  { label: t('profile.fieldNutrition'), value: (() => {
                    const focus = profile?.nutrition_focus
                      ? t(`profile.focus.${profile.nutrition_focus}`)
                      : t('profile.nutritionNotSet');
                    const rest = profile?.rest_caloric_target;
                    const train = profile?.training_caloric_target;
                    const cal = (rest && train && rest !== train)
                      ? `${Math.min(rest, train)}–${Math.max(rest, train)}`
                      : (profile?.caloric_target || null);
                    if (!cal) return focus;
                    return focus + t('profile.nutritionSuffix', { cal, protein: profile.protein_target });
                  })() },
                  ...((profile?.sports || []).length > 0
                    ? [{ label: t('profile.fieldSports'), value: profile.sports.map(s => t(`onboarding.sports.${s.key}`, { defaultValue: s.label || s.key })).join(', ') }]
                    : []),
                ].map((row, i, arr) => (
                  <View key={row.label} style={[styles.profileRow, i > 0 && styles.profileRowBorder]}>
                    <Text style={styles.profileRowLabel}>{row.label}</Text>
                    <Text style={styles.profileRowValue} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
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
                        <View key={i} style={[styles.goalChipActive, { backgroundColor: colors.dangerSoft, borderColor: colors.dangerHair, paddingVertical: 6, paddingHorizontal: 10 }]}>
                          <Text style={[styles.goalChipTextActive, { color: colors.danger }]}>{conditionSummaryLabel(e)}</Text>
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
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
              />
              <Tappable style={[styles.quickWeightBtn, quickWeightSaved && { backgroundColor: colors.accent }]} onPress={logQuickWeight}>
                <Text style={styles.quickWeightBtnText}>{quickWeightSaved ? t('profile.weightSaved') : t('profile.logBtn')}</Text>
              </Tappable>
            </View>
            <Text style={styles.quickWeightTip}>
              {t('profile.weightTip')}
            </Text>
          </View>

          {/* Body composition trend card */}
          <BodyCompositionCard metrics={metrics} profile={profile} />

          {/* Training volume trend — real completed_sets, last 6 weeks */}
          {weeklySetTrend.length > 0 && weeklySetTrend.some(w => w.sets > 0) && (
            <View style={styles.volumeTrendCard}>
              <Text style={styles.volumeTrendTitle}>{t('profile.volumeTrendTitle', { defaultValue: 'Training volume — last 6 weeks' })}</Text>
              <View style={styles.volumeTrendBars}>
                {weeklySetTrend.map((w, i) => {
                  const max = Math.max(...weeklySetTrend.map(x => x.sets), 1);
                  const pct = Math.max(4, (w.sets / max) * 100);
                  const isThisWeek = i === weeklySetTrend.length - 1;
                  return (
                    <View key={w.weekStart} style={styles.volumeTrendCol}>
                      <View style={styles.volumeTrendTrack}>
                        <View style={[styles.volumeTrendFill, { height: `${pct}%` }, isThisWeek && styles.volumeTrendFillActive]} />
                      </View>
                      <Text style={styles.volumeTrendCount}>{w.sets}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.volumeTrendCaption}>{t('profile.volumeTrendCaption', { defaultValue: 'Total sets logged per week, oldest to most recent.' })}</Text>
            </View>
          )}

        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── EDIT-FORM ACCORDION SECTION ─────────────────────────────────────────────
// Collapsible group for the profile editor: only Basics (name/weight/height/
// target, days/week, session length, experience, sex) stays open by default —
// everything else opens on demand, with a one-line summary of what's set so
// you don't have to open a section just to check it.
function AccordionSection({ title, summary, isOpen, onToggle, children }) {
  return (
    <View style={styles.section}>
      <Tappable onPress={onToggle} style={styles.sectionHead} accessibilityState={{ expanded: isOpen }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!summary && <Text style={styles.sectionSummary} numberOfLines={1}>{summary}</Text>}
        </View>
        <Text style={styles.sectionChevron} accessibilityElementsHidden importantForAccessibility="no">{isOpen ? '▲' : '▼'}</Text>
      </Tappable>
      {isOpen && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19, fontWeight: '700', color: colors.surfaceRaised },
  profileName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  profileEmail: { fontSize: 12, color: colors.textSubtle, marginTop: 1 },
  adminBtn: { backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: colors.border },
  adminBtnText: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },
  gearBtn: { padding: 4 },
  insightsCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.successBg, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: colors.accentHair },
  insightsTitle: { fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 12 },
  insightItem: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 6 },
  insightText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: colors.border },
  dataRowLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  dataRowSub: { fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  dataRowLock: { width: 15, height: 15, borderRadius: 8, backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  statVal: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  statLabel: { fontSize: 9, color: colors.textSubtle, marginTop: 2 },
  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginTop: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  // Edit-form accordion sections
  section: { backgroundColor: colors.surfaceInset, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, marginTop: 10, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  sectionSummary: { fontSize: 11.5, color: colors.textSubtle, marginTop: 2 },
  sectionChevron: { fontSize: 11, color: colors.textFaint },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  editBtn: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  cancelBtn: { fontSize: 13, color: colors.textSubtle },
  saveBtn: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  inputLabel: { fontSize: 11, color: colors.textSubtle, marginBottom: 5, marginTop: 10 },
  inputSub: { fontSize: 11, color: colors.textFaint, marginBottom: 8, lineHeight: 16 },
  input: { backgroundColor: colors.control, borderRadius: 8, padding: 11, color: colors.textPrimary, fontSize: 14 },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  optionBtn: { flex: 1, backgroundColor: colors.control, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  optionBtnActive: { backgroundColor: colors.surfaceInverse },
  optionBtnText: { color: colors.textSubtle, fontSize: 13, fontWeight: '500' },
  optionBtnTextActive: { color: colors.surfaceRaised },
  profileField: { fontSize: 13, color: colors.textSubtle, marginBottom: 5 },
  profileFieldVal: { color: colors.textPrimary, fontWeight: '500' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  profileRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border },
  profileRowLabel: { flex: 1, fontSize: 13, color: colors.textSubtle },
  profileRowValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', maxWidth: '50%' },
  goalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  injuryRow: { marginBottom: 12 },
  injuryLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginBottom: 6 },
  injuryOpts: { flexDirection: 'row', gap: 6 },
  injuryOpt: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  injuryOptActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.borderActive },
  injuryOptText: { fontSize: 12, color: colors.textSubtle, fontWeight: '600' },
  injuryOptTextActive: { color: colors.surfaceRaised },
  profEntryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.border },
  profEntryRegion: { fontSize: 10, color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  profEntryLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  profCondRegion: { fontSize: 11, color: colors.textSubtle, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  profCondRow: { backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  profCondLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  profCondDesc: { fontSize: 11, color: colors.textSubtle },
  profLayerCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, borderWidth: 0.5, borderColor: colors.border },
  profLayerLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginBottom: 2 },
  profLayerDesc: { fontSize: 12, color: colors.textSubtle },
  profDayBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  profDayBtnActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.borderActive },
  profDayBtnText: { fontSize: 11, color: colors.textSubtle, fontWeight: '600' },
  profDayBtnTextActive: { color: colors.surfaceRaised },
  goalChip: { backgroundColor: colors.surfaceInset, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.border },
  goalChipActive: { backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.borderActive },
  goalChipText: { fontSize: 12, color: colors.textSubtle },
  goalChipTextActive: { fontSize: 12, color: colors.textSecondary },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  metricDate: { fontSize: 12, color: colors.textSubtle, width: 45 },
  metricVal: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  metricSub: { fontSize: 12, color: colors.textSubtle },
  prReps: { fontSize: 12, color: colors.textSubtle },
  // History tab
  rpeTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rpeTagText: { fontSize: 10, fontWeight: '600' },
  // Quick weight log
  quickWeightRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickWeightInput: { flex: 1, backgroundColor: colors.surfaceInset, borderRadius: 10, padding: 11, color: colors.textPrimary, fontSize: 14, borderWidth: 0.5, borderColor: colors.border },
  quickWeightBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  quickWeightBtnText: { color: colors.surfaceRaised, fontWeight: '700', fontSize: 14 },
  quickWeightTip: { fontSize: 11, color: colors.textFaint, lineHeight: 16 },

  volumeTrendCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  volumeTrendTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  volumeTrendBars: { flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 8, marginBottom: 8 },
  volumeTrendCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 },
  volumeTrendTrack: { width: '100%', height: 52, justifyContent: 'flex-end' },
  volumeTrendFill: { width: '100%', borderRadius: 4, backgroundColor: colors.control },
  volumeTrendFillActive: { backgroundColor: colors.accent },
  volumeTrendCount: { fontSize: 9.5, color: colors.textFaint, fontWeight: '600' },
  volumeTrendCaption: { fontSize: 11, color: colors.textSubtle, lineHeight: 15 },
  expBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  expBtnActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderActive },
  expBtnLabel: { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  expBtnLabelActive: { color: colors.textPrimary },
  expBtnSub: { fontSize: 10, color: colors.textFaint, marginTop: 2 },
  expBtnSubActive: { color: colors.textPrimary },
});