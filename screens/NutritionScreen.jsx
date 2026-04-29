import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

export default function NutritionScreen({ onOpenNutrition }) {
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const [{ data: prof }, { data: logs }] = await Promise.all([
      supabase.from('profiles').select('caloric_target, protein_target, carb_target, fat_target').eq('id', user.id).single(),
      supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', today).order('created_at', { ascending: true }),
    ]);
    if (prof) setProfile(prof);
    if (logs) setEntries(logs);
  };

  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein: acc.protein + (e.protein_g || 0),
    carbs: acc.carbs + (e.carbs_g || 0),
    fat: acc.fat + (e.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const targets = {
    calories: profile?.caloric_target || 0,
    protein: profile?.protein_target || 0,
    carbs: profile?.carb_target || 0,
    fat: profile?.fat_target || 0,
  };

  const remaining = targets.calories - Math.round(totals.calories);

  const macros = [
    { label: 'Protein', val: totals.protein, target: targets.protein, color: '#534AB7' },
    { label: 'Carbs', val: totals.carbs, target: targets.carbs, color: '#BA7517' },
    { label: 'Fat', val: totals.fat, target: targets.fat, color: '#D4537E' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition</Text>
        <Pressable style={styles.logBtn} onPress={onOpenNutrition}>
          <Text style={styles.logBtnText}>+ Log food</Text>
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.calRow}>
          <View style={styles.calBlock}>
            <Text style={styles.calVal}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calLabel}>kcal eaten</Text>
          </View>
          <View style={styles.calDivider} />
          <View style={styles.calBlock}>
            <Text style={[styles.calVal, { color: remaining >= 0 ? '#1D9E75' : '#E24B4A' }]}>
              {Math.abs(remaining)}
            </Text>
            <Text style={styles.calLabel}>{remaining >= 0 ? 'remaining' : 'over'}</Text>
          </View>
          {targets.calories > 0 && (
            <>
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
          const mealCals = mealEntries.reduce((s, e) => s + (e.calories || 0), 0);
          return (
            <View key={meal.key} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View>
                  <Text style={styles.mealName}>{meal.label}</Text>
                  <Text style={styles.mealSub}>
                    {mealEntries.length === 0 ? 'Nothing logged' : `${Math.round(mealCals)} kcal`}
                  </Text>
                </View>
                <Pressable style={styles.addBtn} onPress={onOpenNutrition}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              </View>
              {mealEntries.map(entry => (
                <View key={entry.id} style={styles.entryRow}>
                  <Text style={styles.entryName} numberOfLines={1}>{entry.food_name}</Text>
                  <Text style={styles.entryCal}>{Math.round(entry.calories)} kcal</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  logBtn: { backgroundColor: '#534AB7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  logBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
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
  addBtnText: { fontSize: 12, color: '#534AB7', fontWeight: '500' },
  entryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  entryName: { fontSize: 13, color: '#A1A1AA', flex: 1, marginRight: 8 },
  entryCal: { fontSize: 13, color: '#71717A' },
});
