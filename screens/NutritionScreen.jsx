import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, getCurrentUser } from '../supabase';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

// Approximate share of daily protein/calories each meal should provide
const MEAL_PROTEIN_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
const MEAL_CAL_SHARE     = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };

function getMealInsight(mealKey, entries, targets) {
  if (!entries.length) return null;

  const p    = entries.reduce((s, e) => s + (e.protein_g || 0), 0);
  const c    = entries.reduce((s, e) => s + (e.carbs_g  || 0), 0);
  const f    = entries.reduce((s, e) => s + (e.fat_g    || 0), 0);
  const kcal = entries.reduce((s, e) => s + (e.calories || 0), 0);

  const targetP    = (targets.protein  || 0) * (MEAL_PROTEIN_SHARE[mealKey] || 0.25);
  const targetKcal = (targets.calories || 0) * (MEAL_CAL_SHARE[mealKey]    || 0.25);

  // Protein too low for this meal slot
  if (targets.protein > 0 && p < targetP * 0.6) {
    const tip = {
      breakfast: 'Low on protein — Greek yogurt, eggs, or a shake would help hit your morning target.',
      lunch:     'Low on protein — add chicken, tuna, or legumes to balance this meal.',
      dinner:    'Low on protein — fish, lean beef, or tofu would bring this closer to your target.',
      snack:     'Low on protein — cottage cheese or a protein bar would boost this snack.',
    };
    return tip[mealKey] || 'Consider adding a protein source to reach your daily target.';
  }

  // Fat-heavy and protein-light for a main meal
  if ((mealKey === 'breakfast' || mealKey === 'lunch' || mealKey === 'dinner') && f > 25 && p < 20) {
    return 'Fat-heavy and low in protein — try swapping some fat sources for lean protein.';
  }

  // Calorie-dense snack
  if (mealKey === 'snack' && kcal > 400) {
    return 'High-calorie snack — consider splitting it or choosing something lower-density if you are in a deficit.';
  }

  // Light main meal
  if ((mealKey === 'lunch' || mealKey === 'dinner') && targets.calories > 0 && kcal < targetKcal * 0.5) {
    return 'Light meal — make sure the rest of your day makes up your daily calorie target.';
  }

  // Good protein but very few carbs at breakfast/lunch — suggest pairing
  if (targets.protein > 0 && p >= targetP * 0.85 && c < 15 && (mealKey === 'breakfast' || mealKey === 'lunch')) {
    return 'Good protein. Pair with complex carbs like oats or whole grain bread for sustained energy.';
  }

  return null;
}

export default function NutritionScreen({ onOpenNutrition, onOpenNutritionMeal, refreshKey }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useEffect(() => { loadData(); }, [refreshKey]);

  const loadData = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const [{ data: prof }, { data: logs }] = await Promise.all([
        supabase.from('profiles').select('caloric_target, protein_target, carb_target, fat_target').eq('id', user.id).single(),
        supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at', { ascending: true }),
      ]);
      if (prof) setProfile(prof);
      if (logs) setEntries(logs);
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

  const targets = {
    calories: profile?.caloric_target || 0,
    protein:  profile?.protein_target || 0,
    carbs:    profile?.carb_target    || 0,
    fat:      profile?.fat_target     || 0,
  };

  const remaining = targets.calories - Math.round(totals.calories);

  const macros = [
    { label: 'Protein', val: totals.protein, target: targets.protein, color: '#FFFFFF' },
    { label: 'Carbs',   val: totals.carbs,   target: targets.carbs,   color: '#BA7517' },
    { label: 'Fat',     val: totals.fat,      target: targets.fat,     color: '#D4537E' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Nutrition</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.calRow}>
          <View style={styles.calBlock}>
            <Text style={styles.calVal}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calLabel}>kcal eaten</Text>
          </View>
          {targets.calories > 0 && (
            <>
              <View style={styles.calDivider} />
              <View style={styles.calBlock}>
                <Text style={[styles.calVal, { color: remaining >= 0 ? '#1D9E75' : '#E24B4A' }]}>
                  {Math.abs(remaining)}
                </Text>
                <Text style={styles.calLabel}>{remaining >= 0 ? 'remaining' : 'over'}</Text>
              </View>
              <View style={styles.calDivider} />
              <View style={styles.calBlock}>
                <Text style={styles.calVal}>{targets.calories}</Text>
                <Text style={styles.calLabel}>target</Text>
              </View>
            </>
          )}
        </View>

        {macros.map(({ label, val, target, color }) => (
          <View key={label} style={styles.macroRow}>
            <Text style={styles.macroLabel}>{label}</Text>
            <View style={styles.macroBarBg}>
              <View style={[
                styles.macroBarFill,
                { width: `${Math.min(target > 0 ? (val / target) * 100 : 0, 100)}%`, backgroundColor: color },
              ]} />
            </View>
            <Text style={styles.macroVal}>
              {Math.round(val)}{target > 0 ? `/${target}g` : 'g'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.mealsSection}>
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal_type === meal.key);
          const mealMacros = mealEntries.reduce((acc, e) => ({
            calories: acc.calories + (e.calories || 0),
            protein:  acc.protein  + (e.protein_g || 0),
            carbs:    acc.carbs    + (e.carbs_g   || 0),
            fat:      acc.fat      + (e.fat_g     || 0),
          }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
          const insight = getMealInsight(meal.key, mealEntries, targets);

          return (
            <View key={meal.key} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View>
                  <Text style={styles.mealName}>{meal.label}</Text>
                  <Text style={styles.mealSub}>
                    {mealEntries.length === 0 ? 'Nothing logged' : `${Math.round(mealMacros.calories)} kcal`}
                  </Text>
                </View>
                <Pressable style={styles.addBtn} onPress={() => onOpenNutritionMeal(meal.key)}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              </View>

              {mealEntries.map(entry => (
                <View key={entry.id} style={styles.entryRow}>
                  <Text style={styles.entryName} numberOfLines={1}>{entry.food_name}</Text>
                  <Text style={styles.entryCal}>{Math.round(entry.calories)} kcal</Text>
                </View>
              ))}

              {mealEntries.length > 0 && (
                <View style={styles.mealMacroRow}>
                  <Text style={styles.mealMacroText}>
                    P: {Math.round(mealMacros.protein)}g · C: {Math.round(mealMacros.carbs)}g · F: {Math.round(mealMacros.fat)}g
                  </Text>
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
