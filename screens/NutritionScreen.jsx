import {
  useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase, getCurrentUser } from '../supabase';
import { generateProgram } from './programGenerator';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];
// One icon per meal for identity/scanability — same single accent color for
// all of them (not a rainbow per meal), the icon itself carries the distinction.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MEAL_PROTEIN_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
const MEAL_CAL_SHARE     = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
const MEAL_FAT_SHARE     = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
const MEAL_CARB_SHARE    = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };

function getMealInsight(mealKey, entries, targets, t) {
  if (!entries.length) return null;
  const p    = entries.reduce((s, e) => s + (e.protein_g || 0), 0);
  const c    = entries.reduce((s, e) => s + (e.carbs_g  || 0), 0);
  const f    = entries.reduce((s, e) => s + (e.fat_g    || 0), 0);
  const kcal = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const mealShare  = MEAL_CAL_SHARE[mealKey] || 0.25;
  const targetP    = (targets.protein  || 0) * (MEAL_PROTEIN_SHARE[mealKey] || 0.25);
  const targetKcal = (targets.calories || 0) * mealShare;
  const targetF    = (targets.fat      || 0) * (MEAL_FAT_SHARE[mealKey]  || 0.25);
  const targetC    = (targets.carbs    || 0) * (MEAL_CARB_SHARE[mealKey] || 0.25);
  const fatLimit  = targets.fat  > 0 ? Math.max(targetF  * 1.6, 30) : (mealKey === 'snack' ? 20 : 45);
  const carbLimit = targets.carbs > 0 ? Math.max(targetC * 1.6, 50) : (mealKey === 'snack' ? 50 : 100);
  if (targets.protein > 0 && p < targetP * 0.6) {
    return t(`nutrition.insights.lowProtein.${mealKey}`, { defaultValue: t('nutrition.insights.lowProtein.default') });
  }
  if (f > fatLimit) {
    return t(`nutrition.insights.highFat.${mealKey}`, { g: Math.round(f), defaultValue: t('nutrition.insights.highFat.default', { g: Math.round(f) }) });
  }
  if (c > carbLimit) {
    return t(`nutrition.insights.highCarb.${mealKey}`, { g: Math.round(c), defaultValue: t('nutrition.insights.highCarb.default', { g: Math.round(c) }) });
  }
  if ((mealKey === 'breakfast' || mealKey === 'lunch' || mealKey === 'dinner') && f > 25 && p < 20)
    return t('nutrition.insights.fatHeavyLowProtein');
  if (mealKey === 'snack' && kcal > 400)
    return t('nutrition.insights.highCalSnack');
  if ((mealKey === 'lunch' || mealKey === 'dinner') && targets.calories > 0 && kcal < targetKcal * 0.5)
    return t('nutrition.insights.lightMeal');
  if (targets.protein > 0 && p >= targetP * 0.85 && c < 15 && (mealKey === 'breakfast' || mealKey === 'lunch'))
    return t('nutrition.insights.goodProtein');
  return null;
}

export default function NutritionScreen({ onOpenNutrition, onOpenNutritionMeal, refreshKey, isPremium }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [proteinHistory, setProteinHistory] = useState([]); // last 7 days: [{date, protein}]
  const [isTrainingDay, setIsTrainingDay] = useState(true);
  // Once the user toggles Train/Rest manually, don't overwrite it on refresh.
  const trainingDayTouched = useRef(false);
  const today = format(new Date(), 'yyyy-MM-dd'); // local date, not UTC

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useEffect(() => { loadData(); }, [refreshKey]);

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    try {
      const sevenDaysAgoStr = format(new Date(Date.now() - 6 * 86400000), 'yyyy-MM-dd'); // today + 6 prior = 7 days
      const [{ data: prof }, { data: logs }, { data: weekLogs }] = await Promise.all([
        supabase.from('profiles').select('caloric_target, protein_target, carb_target, fat_target, training_caloric_target, training_carb_target, rest_caloric_target, rest_carb_target, nutrition_focus, trainingExperience, equipment, weekly_workouts, goals, selected_split, sports, health_conditions, injury_profile, coach_notes').eq('id', user.id).single(),
        supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at', { ascending: true }),
        supabase.from('nutrition_logs').select('date, protein_g').eq('user_id', user.id).gte('date', sevenDaysAgoStr),
      ]);
      if (prof) setProfile(prof);
      if (logs) setEntries(logs);
      if (weekLogs) {
        const byDate = {};
        weekLogs.forEach(l => { byDate[l.date] = (byDate[l.date] || 0) + (l.protein_g || 0); });
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd');
          days.push({ date: d, protein: byDate[d] || 0 });
        }
        setProteinHistory(days);
      }
      // Default Train/Rest to follow the program split: today is a training day if
      // the split's weekly schedule assigns a session to today's weekday — same
      // rule TodayScreen uses to decide rest vs workout. The toggle still lets the
      // user override on days they don't follow the split exactly.
      if (prof && !trainingDayTouched.current) {
        try {
          const prog = generateProgram(prof);
          const todayName = DAYS[new Date().getDay()];
          setIsTrainingDay((prog?.schedule || []).indexOf(todayName) !== -1);
        } catch (e) {
          console.warn('Nutrition schedule check failed:', e.message);
        }
      }
    } catch (e) {
      console.warn('Nutrition load failed:', e.message);
    }
  };

  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein:  acc.protein  + (e.protein_g || 0),
    carbs:    acc.carbs    + (e.carbs_g   || 0),
    fat:      acc.fat      + (e.fat_g     || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Use training/rest day specific targets if available, else fall back to single target
  const calTarget = isTrainingDay && profile?.training_caloric_target
    ? profile.training_caloric_target
    : (!isTrainingDay && profile?.rest_caloric_target ? profile.rest_caloric_target : (profile?.caloric_target || 0));
  const carbTarget = isTrainingDay && profile?.training_carb_target
    ? profile.training_carb_target
    : (!isTrainingDay && profile?.rest_carb_target ? profile.rest_carb_target : (profile?.carb_target || 0));

  const targets = {
    calories: calTarget,
    protein:  profile?.protein_target || 0,
    carbs:    carbTarget,
    fat:      profile?.fat_target || 0,
  };

  const remaining = targets.calories - Math.round(totals.calories);
  const macros = [
    { key: 'protein', label: t('nutrition.macros.protein'), val: totals.protein, target: targets.protein, color: colors.textPrimary },
    { key: 'carbs',   label: t('nutrition.macros.carbs'),   val: totals.carbs,   target: targets.carbs,   color: colors.warning },
    { key: 'fat',     label: t('nutrition.macros.fat'),     val: totals.fat,      target: targets.fat,     color: colors.danger },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('nutrition.greetingMorning') : hour < 17 ? t('nutrition.greetingAfternoon') : t('nutrition.greetingEvening');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>{t('nutrition.title')}</Text>
        {!isPremium && (
          <Tappable style={styles.upgradeChip} onPress={onOpenNutrition}>
            <Text style={styles.upgradeChipText}>{t('nutrition.upgrade')}</Text>
          </Tappable>
        )}
      </View>

      {/* Morning nutrition card */}
      {targets.calories > 0 && (
        <View style={[styles.morningCard, isTrainingDay && styles.morningCardTraining]}>
          <View style={styles.morningRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.morningTitle}>
                {greeting} · {isTrainingDay ? t('nutrition.trainingDay') : t('nutrition.restDay')}
              </Text>
              <Text style={styles.morningTarget}>
                {t('nutrition.target', { cal: targets.calories, protein: targets.protein, carbs: isTrainingDay ? t('nutrition.carbsUp') : t('nutrition.carbsModerate') })}
              </Text>
            </View>
            <View style={styles.trainingToggle}>
              <Tappable
                style={[styles.toggleBtn, isTrainingDay && styles.toggleBtnActive]}
                onPress={() => { trainingDayTouched.current = true; setIsTrainingDay(true); }}
                accessibilityState={{ selected: isTrainingDay }}
              >
                <Text style={[styles.toggleBtnText, isTrainingDay && styles.toggleBtnTextActive]}>{t('nutrition.train')}</Text>
              </Tappable>
              <Tappable
                style={[styles.toggleBtn, !isTrainingDay && styles.toggleBtnActive]}
                onPress={() => { trainingDayTouched.current = true; setIsTrainingDay(false); }}
                accessibilityState={{ selected: !isTrainingDay }}
              >
                <Text style={[styles.toggleBtnText, !isTrainingDay && styles.toggleBtnTextActive]}>{t('nutrition.rest')}</Text>
              </Tappable>
            </View>
          </View>
        </View>
      )}

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.calRow}>
          <View style={styles.calBlock}>
            <Text style={styles.calVal}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calLabel}>{t('nutrition.kcalEaten')}</Text>
          </View>
          {targets.calories > 0 && (
            <>
              <View style={styles.calDivider} />
              <View style={styles.calBlock}>
                <Text style={[styles.calVal, { color: remaining >= 0 ? colors.accent : colors.danger }]}>{Math.abs(remaining)}</Text>
                <Text style={styles.calLabel}>{remaining >= 0 ? t('nutrition.remaining') : t('nutrition.over')}</Text>
              </View>
              <View style={styles.calDivider} />
              <View style={styles.calBlock}>
                <Text style={styles.calVal}>{targets.calories}</Text>
                <Text style={styles.calLabel}>{t('nutrition.targetLabel')}</Text>
              </View>
            </>
          )}
        </View>
        {macros.map(({ label, val, target, color }) => (
          <View key={label} style={styles.macroRow}>
            <Text style={styles.macroLabel}>{label}</Text>
            <View style={styles.macroBarBg}>
              <View style={[styles.macroBarFill, { width: `${Math.min(target > 0 ? (val / target) * 100 : 0, 100)}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.macroVal}>{Math.round(val)}{target > 0 ? `/${target}g` : 'g'}</Text>
          </View>
        ))}
      </View>

      {/* Protein hit-rate — real nutrition_logs, last 7 days. Same 90%-of-target
          threshold computeInsights uses, so this never contradicts what Coach
          says about the same data. */}
      {targets.protein > 0 && proteinHistory.length > 0 && (
        <View style={styles.proteinCard}>
          <Text style={styles.proteinTitle}>{t('nutrition.proteinHistoryTitle')}</Text>
          <View style={styles.proteinBars}>
            {proteinHistory.map((d) => {
              const hit = d.protein >= targets.protein * 0.9;
              const pct = Math.min(100, Math.max(6, (d.protein / targets.protein) * 100));
              const isToday = d.date === today;
              return (
                <View key={d.date} style={styles.proteinBarCol}>
                  <View style={styles.proteinBarTrack}>
                    <View style={[styles.proteinBarFill, { height: `${pct}%` }, hit ? styles.proteinBarHit : styles.proteinBarMiss]} />
                  </View>
                  <Text style={[styles.proteinBarDay, isToday && styles.proteinBarDayToday]}>
                    {format(new Date(d.date + 'T00:00:00'), 'EEEEE')}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.proteinCaption}>
            {t('nutrition.proteinHistoryCaption', { count: proteinHistory.filter(d => d.protein >= targets.protein * 0.9).length })}
          </Text>
        </View>
      )}

      {/* Meals */}
      <View style={styles.mealsSection}>
        {MEAL_KEYS.map(mealKey => {
          const mealEntries = entries.filter(e => e.meal_type === mealKey);
          const mealMacros = mealEntries.reduce((acc, e) => ({ calories: acc.calories + (e.calories || 0), protein: acc.protein + (e.protein_g || 0), carbs: acc.carbs + (e.carbs_g || 0), fat: acc.fat + (e.fat_g || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
          const insight = getMealInsight(mealKey, mealEntries, targets, t);
          return (
            <View key={mealKey} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealHeaderLeft}>
                  <View>
                    <Text style={styles.mealName}>{t(`nutrition.meals.${mealKey}`)}</Text>
                    <Text style={styles.mealSub}>{mealEntries.length === 0 ? t('nutrition.nothingLogged') : t('nutrition.kcal', { value: Math.round(mealMacros.calories) })}</Text>
                  </View>
                </View>
                <Tappable style={styles.addBtn} onPress={() => onOpenNutritionMeal(mealKey)}>
                  <Text style={styles.addBtnText}>{t('nutrition.add')}</Text>
                </Tappable>
              </View>
              {mealEntries.map(entry => (
                <View key={entry.id} style={styles.entryRow}>
                  <Text style={styles.entryName} numberOfLines={1}>{entry.food_name}</Text>
                  <Text style={styles.entryCal}>{t('nutrition.kcal', { value: Math.round(entry.calories) })}</Text>
                </View>
              ))}
              {mealEntries.length > 0 && (
                <View style={styles.mealMacroRow}>
                  <Text style={styles.mealMacroText}>{t('nutrition.mealMacros', { p: Math.round(mealMacros.protein), c: Math.round(mealMacros.carbs), f: Math.round(mealMacros.fat) })}</Text>
                </View>
              )}
              {insight && (
                <View style={styles.insightRow}>
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  upgradeChip: { backgroundColor: colors.control, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: colors.borderStrong },
  upgradeChipText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },

  // Accent-tinted, not the same flat gray as the meal cards below it — this
  // is today's target, the one thing on the screen worth glancing at first.
  morningCard: { marginHorizontal: 24, marginBottom: 12, backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: colors.border },
  // The accent marks a TRAINING day. It used to be on every day, which
  // made it decoration rather than a signal.
  morningCardTraining: { borderColor: colors.accentHair },
  morningRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  morningTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  morningTarget: { fontSize: 11, color: colors.textSubtle, lineHeight: 16 },
  trainingToggle: { flexDirection: 'row', backgroundColor: colors.surfaceInset, borderRadius: 8, padding: 2, gap: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: colors.control },
  toggleBtnText: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  toggleBtnTextActive: { color: colors.textPrimary },


  summaryCard: { marginHorizontal: 24, marginBottom: 24, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  calRow: { flexDirection: 'row', marginBottom: 16 },
  calBlock: { flex: 1, alignItems: 'center' },
  calVal: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  calLabel: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  calDivider: { width: 0.5, backgroundColor: colors.control },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  macroLabel: { fontSize: 12, color: colors.textSubtle, width: 52 },
  macroBarBg: { flex: 1, height: 5, backgroundColor: colors.control, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: 5, borderRadius: 3 },
  macroVal: { fontSize: 11, color: colors.textSubtle, width: 68, textAlign: 'right' },

  proteinCard: { marginHorizontal: 24, marginBottom: 24, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  proteinTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  proteinBars: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 6, marginBottom: 8 },
  proteinBarCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 },
  proteinBarTrack: { width: '100%', height: 48, justifyContent: 'flex-end' },
  proteinBarFill: { width: '100%', borderRadius: 4 },
  proteinBarHit: { backgroundColor: colors.accent },
  proteinBarMiss: { backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border },
  proteinBarDay: { fontSize: 9, color: colors.textFaint, fontWeight: '600' },
  proteinBarDayToday: { color: colors.textPrimary },
  proteinCaption: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },

  mealsSection: { paddingHorizontal: 24 },
  mealCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: colors.border },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  mealSub: { fontSize: 13, color: colors.textSubtle },
  addBtn: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 0.5, borderTopColor: colors.border },
  entryName: { fontSize: 13, color: colors.textMuted, flex: 1, marginRight: 8 },
  entryCal: { fontSize: 13, color: colors.textSubtle },
  mealMacroRow: { paddingTop: 10, marginTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border },
  mealMacroText: { fontSize: 12, color: colors.textFaint },
  insightRow: { marginTop: 10, backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: colors.border },
  insightText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
