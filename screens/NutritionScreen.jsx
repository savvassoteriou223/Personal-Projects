import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { supabase, getCurrentUser } from '../supabase';
import { generateProgram } from './programGenerator';

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];
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
      const [{ data: prof }, { data: logs }] = await Promise.all([
        supabase.from('profiles').select('caloric_target, protein_target, carb_target, fat_target, training_caloric_target, training_carb_target, rest_caloric_target, rest_carb_target, nutrition_focus, trainingExperience, equipment, weekly_workouts, goals, selected_split, sports, health_conditions, injury_profile, coach_notes').eq('id', user.id).single(),
        supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at', { ascending: true }),
      ]);
      if (prof) setProfile(prof);
      if (logs) setEntries(logs);
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
    { key: 'protein', label: t('nutrition.macros.protein'), val: totals.protein, target: targets.protein, color: '#FFFFFF' },
    { key: 'carbs',   label: t('nutrition.macros.carbs'),   val: totals.carbs,   target: targets.carbs,   color: '#BA7517' },
    { key: 'fat',     label: t('nutrition.macros.fat'),     val: totals.fat,      target: targets.fat,     color: '#E24B4A' },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('nutrition.greetingMorning') : hour < 17 ? t('nutrition.greetingAfternoon') : t('nutrition.greetingEvening');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>{t('nutrition.title')}</Text>
        {!isPremium && (
          <Pressable style={styles.upgradeChip} onPress={onOpenNutrition}>
            <Text style={styles.upgradeChipText}>{t('nutrition.upgrade')}</Text>
          </Pressable>
        )}
      </View>

      {/* Morning nutrition card */}
      {targets.calories > 0 && (
        <View style={styles.morningCard}>
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
              <Pressable style={[styles.toggleBtn, isTrainingDay && styles.toggleBtnActive]} onPress={() => { trainingDayTouched.current = true; setIsTrainingDay(true); }}>
                <Text style={[styles.toggleBtnText, isTrainingDay && styles.toggleBtnTextActive]}>{t('nutrition.train')}</Text>
              </Pressable>
              <Pressable style={[styles.toggleBtn, !isTrainingDay && styles.toggleBtnActive]} onPress={() => { trainingDayTouched.current = true; setIsTrainingDay(false); }}>
                <Text style={[styles.toggleBtnText, !isTrainingDay && styles.toggleBtnTextActive]}>{t('nutrition.rest')}</Text>
              </Pressable>
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
                <Text style={[styles.calVal, { color: remaining >= 0 ? '#1D9E75' : '#E24B4A' }]}>{Math.abs(remaining)}</Text>
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

      {/* Meals */}
      <View style={styles.mealsSection}>
        {MEAL_KEYS.map(mealKey => {
          const mealEntries = entries.filter(e => e.meal_type === mealKey);
          const mealMacros = mealEntries.reduce((acc, e) => ({ calories: acc.calories + (e.calories || 0), protein: acc.protein + (e.protein_g || 0), carbs: acc.carbs + (e.carbs_g || 0), fat: acc.fat + (e.fat_g || 0) }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
          const insight = getMealInsight(mealKey, mealEntries, targets, t);
          return (
            <View key={mealKey} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View>
                  <Text style={styles.mealName}>{t(`nutrition.meals.${mealKey}`)}</Text>
                  <Text style={styles.mealSub}>{mealEntries.length === 0 ? t('nutrition.nothingLogged') : t('nutrition.kcal', { value: Math.round(mealMacros.calories) })}</Text>
                </View>
                <Pressable style={styles.addBtn} onPress={() => onOpenNutritionMeal(mealKey)}>
                  <Text style={styles.addBtnText}>{t('nutrition.add')}</Text>
                </Pressable>
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
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  upgradeChip: { backgroundColor: '#2C2C35', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: '#3D3D4A' },
  upgradeChipText: { fontSize: 11, color: '#A1A1AA', fontWeight: '500' },

  morningCard: { marginHorizontal: 24, marginBottom: 12, backgroundColor: '#1A1A20', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#2C2C35' },
  morningRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  morningTitle: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  morningTarget: { fontSize: 11, color: '#71717A', lineHeight: 16 },
  trainingToggle: { flexDirection: 'row', backgroundColor: '#12121A', borderRadius: 8, padding: 2, gap: 2 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: '#2C2C35' },
  toggleBtnText: { fontSize: 11, color: '#52525B', fontWeight: '600' },
  toggleBtnTextActive: { color: '#FFFFFF' },


  summaryCard: { marginHorizontal: 24, marginBottom: 24, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  calRow: { flexDirection: 'row', marginBottom: 16 },
  calBlock: { flex: 1, alignItems: 'center' },
  calVal: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  calLabel: { fontSize: 11, color: '#71717A', marginTop: 2 },
  calDivider: { width: 0.5, backgroundColor: '#2C2C35' },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  macroLabel: { fontSize: 12, color: '#71717A', width: 52 },
  macroBarBg: { flex: 1, height: 5, backgroundColor: '#2C2C35', borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: 5, borderRadius: 3 },
  macroVal: { fontSize: 11, color: '#71717A', width: 68, textAlign: 'right' },

  mealsSection: { paddingHorizontal: 24 },
  mealCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#2C2C35' },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  mealName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  mealSub: { fontSize: 13, color: '#71717A' },
  addBtn: { borderWidth: 0.5, borderColor: '#3D3D4A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { fontSize: 12, color: '#FFFFFF', fontWeight: '500' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  entryName: { fontSize: 13, color: '#A1A1AA', flex: 1, marginRight: 8 },
  entryCal: { fontSize: 13, color: '#71717A' },
  mealMacroRow: { paddingTop: 10, marginTop: 6, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  mealMacroText: { fontSize: 12, color: '#52525B' },
  insightRow: { marginTop: 10, backgroundColor: '#111114', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: '#2C2C35' },
  insightText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
});
