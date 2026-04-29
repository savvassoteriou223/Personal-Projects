import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { supabase } from '../supabase';
import { BarCodeScanner } from 'expo-barcode-scanner';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

const USDA_KEY = process.env.EXPO_PUBLIC_USDA_KEY;

export default function NutritionLogScreen({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('breakfast');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [servingGrams, setServingGrams] = useState('100');
  const [showScanner, setShowScanner] = useState(false);
  const [scanPermission, setScanPermission] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('caloric_target, protein_target, carb_target, fat_target')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof);

    const { data: logs } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: true });
    if (logs) setEntries(logs);
  };

  const searchFood = async () => {
    if (search.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(search)}&dataType=SR%20Legacy,Survey%20(FNDDS),Foundation&pageSize=8&api_key=${USDA_KEY}`
      );
      const data = await res.json();
      const results = (data.foods || []).map(food => {
        const nutrients = food.foodNutrients || [];
        const kcal = (() => {
          const e = nutrients.find(n =>
            n.nutrientName?.toLowerCase().includes('energy') &&
            n.unitName?.toLowerCase() === 'kcal'
          );
          return Math.round(e?.value || 0);
        })();
        const get = (name) => {
          const n = nutrients.find(n => n.nutrientName?.toLowerCase().includes(name));
          return Math.round(n?.value || 0);
        };
        return {
          name: food.description,
          brand: food.brandOwner || null,
          calories: kcal,
          protein: get('protein'),
          carbs: get('carbohydrate'),
          fat: get('total lipid'),
        };
      }).filter(f => f.calories > 0);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const openScanner = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    const granted = status === 'granted';
    setScanPermission(granted);
    if (granted) setShowScanner(true);
    else setShowScanner(true); // still show — renders the denied UI
  };

  const handleBarcodeScan = async ({ data }) => {
    setShowScanner(false);
    setSearching(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await res.json();
      if (json.status === 1 && json.product) {
        const p = json.product;
        const n = p.nutriments || {};
        const food = {
          name: p.product_name || 'Unknown product',
          brand: p.brands || null,
          calories: Math.round(n['energy-kcal_100g'] || 0),
          protein: Math.round(n.proteins_100g || 0),
          carbs: Math.round(n.carbohydrates_100g || 0),
          fat: Math.round(n.fat_100g || 0),
        };
        setSelectedFood(food);
        setServingGrams('100');
        setShowSearch(true);
      }
    } catch {
      // nothing
    }
    setSearching(false);
  };

  const logFood = async (food) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert({
        user_id: user.id,
        date: today,
        meal_type: selectedMeal,
        food_name: food.name,
        calories: food.calories,
        protein_g: food.protein,
        carbs_g: food.carbs,
        fat_g: food.fat,
        servings: 1,
      })
      .select()
      .single();

    if (!error && data) {
      setEntries(prev => [...prev, data]);
      setSearch('');
      setSearchResults([]);
      setShowSearch(false);
      setSelectedFood(null);
    }
  };

  const deleteEntry = async (id) => {
    await supabase.from('nutrition_logs').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log food</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.doneBtn}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.summaryCard}>
          <View style={styles.calRow}>
            <View style={styles.calBlock}>
              <Text style={styles.calVal}>{Math.round(totals.calories)}</Text>
              <Text style={styles.calLabel}>eaten</Text>
            </View>
            <View style={styles.calDivider} />
            <View style={styles.calBlock}>
              <Text style={[styles.calVal, { color: targets.calories - totals.calories >= 0 ? '#1D9E75' : '#E24B4A' }]}>
                {Math.abs(Math.round(targets.calories - totals.calories))}
              </Text>
              <Text style={styles.calLabel}>{targets.calories - totals.calories >= 0 ? 'remaining' : 'over'}</Text>
            </View>
            <View style={styles.calDivider} />
            <View style={styles.calBlock}>
              <Text style={styles.calVal}>{targets.calories}</Text>
              <Text style={styles.calLabel}>target</Text>
            </View>
          </View>
          {[
            { label: 'Protein', val: totals.protein, target: targets.protein, color: '#534AB7' },
            { label: 'Carbs', val: totals.carbs, target: targets.carbs, color: '#BA7517' },
            { label: 'Fat', val: totals.fat, target: targets.fat, color: '#D4537E' },
          ].map(({ label, val, target, color }) => (
            <View key={label} style={styles.macroRow}>
              <Text style={styles.macroLabel}>{label}</Text>
              <View style={styles.macroBarBg}>
                <View style={[styles.macroBarFill, { width: `${Math.min(target > 0 ? val / target : 0, 1) * 100}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.macroVal}>{Math.round(val)}/{target}g</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealTabs}>
          {MEALS.map(m => (
            <Pressable
              key={m.key}
              style={[styles.mealTab, selectedMeal === m.key && styles.mealTabActive]}
              onPress={() => setSelectedMeal(m.key)}
            >
              <Text style={[styles.mealTabText, selectedMeal === m.key && styles.mealTabTextActive]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {showSearch ? (
          <View style={styles.searchCard}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search food..."
                placeholderTextColor="#3D3D4A"
                onSubmitEditing={searchFood}
              />
              <Pressable style={styles.searchBtn} onPress={searchFood}>
                {searching
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.searchBtnText}>Search</Text>
                }
              </Pressable>
            </View>

            {searchResults.map((food, i) => (
              <Pressable key={i} style={styles.resultRow} onPress={() => { setSelectedFood(food); setServingGrams('100'); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
                  {food.brand && <Text style={styles.resultBrand}>{food.brand}</Text>}
                  <Text style={styles.resultMacros}>P: {food.protein}g · C: {food.carbs}g · F: {food.fat}g · per 100g</Text>
                </View>
                <View style={styles.resultCalBox}>
                  <Text style={styles.resultCal}>{food.calories}</Text>
                  <Text style={styles.resultCalLabel}>kcal</Text>
                </View>
              </Pressable>
            ))}

            {selectedFood && (
              <View style={styles.servingCard}>
                <Text style={styles.servingTitle} numberOfLines={1}>{selectedFood.name}</Text>
                <View style={styles.servingRow}>
                  <TextInput
                    style={styles.servingInput}
                    value={servingGrams}
                    onChangeText={setServingGrams}
                    keyboardType="decimal-pad"
                    placeholder="100"
                    placeholderTextColor="#3D3D4A"
                  />
                  <Text style={styles.servingUnit}>g</Text>
                  <Pressable style={styles.logBtn} onPress={() => {
                    const grams = parseFloat(servingGrams);
                    if (!grams || grams <= 0) return;
                    const multiplier = grams / 100;
                    logFood({
                      ...selectedFood,
                      calories: Math.round(selectedFood.calories * multiplier),
                      protein: Math.round(selectedFood.protein * multiplier),
                      carbs: Math.round(selectedFood.carbs * multiplier),
                      fat: Math.round(selectedFood.fat * multiplier),
                    });
                    setSelectedFood(null);
                  }}>
                    <Text style={styles.logBtnText}>Log</Text>
                  </Pressable>
                </View>
                <Text style={styles.servingPreview}>
                  {Math.round(selectedFood.calories * parseFloat(servingGrams || 0) / 100)} kcal · P: {Math.round(selectedFood.protein * parseFloat(servingGrams || 0) / 100)}g · C: {Math.round(selectedFood.carbs * parseFloat(servingGrams || 0) / 100)}g · F: {Math.round(selectedFood.fat * parseFloat(servingGrams || 0) / 100)}g
                </Text>
              </View>
            )}

            <Pressable style={styles.cancelSearchBtn} onPress={() => { setShowSearch(false); setSearchResults([]); setSearch(''); setSelectedFood(null); }}>
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.addFoodRow}>
            <Pressable style={[styles.addFoodBtn, { flex: 1 }]} onPress={() => setShowSearch(true)}>
              <Text style={styles.addFoodBtnText}>+ Search food</Text>
            </Pressable>
            <Pressable style={styles.scanBtn} onPress={openScanner}>
              <Text style={styles.scanBtnText}>Scan</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.entriesSection}>
          {entries.filter(e => e.meal_type === selectedMeal).length === 0 ? (
            <Text style={styles.emptyText}>Nothing logged for this meal yet.</Text>
          ) : (
            entries.filter(e => e.meal_type === selectedMeal).map(entry => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName} numberOfLines={1}>{entry.food_name}</Text>
                  <Text style={styles.entryMacros}>P: {Math.round(entry.protein_g)}g · C: {Math.round(entry.carbs_g)}g · F: {Math.round(entry.fat_g)}g</Text>
                </View>
                <Text style={styles.entryCal}>{Math.round(entry.calories)} kcal</Text>
                <Pressable onPress={() => deleteEntry(entry.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>✕</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {showScanner && (
        <View style={StyleSheet.absoluteFillObject}>
          {scanPermission === false ? (
            <View style={styles.scanDenied}>
              <Text style={styles.scanDeniedText}>Camera permission denied.</Text>
              <Pressable onPress={() => setShowScanner(false)}>
                <Text style={styles.cancelSearchText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <BarCodeScanner
              onBarCodeScanned={handleBarcodeScan}
              style={StyleSheet.absoluteFillObject}
            >
              <View style={styles.scanOverlay}>
                <Text style={styles.scanHint}>Point at a barcode</Text>
                <Pressable style={styles.scanCancelBtn} onPress={() => setShowScanner(false)}>
                  <Text style={styles.scanCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </BarCodeScanner>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  doneBtn: { color: '#534AB7', fontSize: 15, fontWeight: '600' },
  summaryCard: { margin: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  calRow: { flexDirection: 'row', marginBottom: 16 },
  calBlock: { flex: 1, alignItems: 'center' },
  calVal: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  calLabel: { fontSize: 11, color: '#71717A', marginTop: 2 },
  calDivider: { width: 0.5, backgroundColor: '#2C2C35' },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  macroLabel: { fontSize: 12, color: '#71717A', width: 52 },
  macroBarBg: { flex: 1, height: 5, backgroundColor: '#2C2C35', borderRadius: 3 },
  macroBarFill: { height: 5, borderRadius: 3 },
  macroVal: { fontSize: 11, color: '#71717A', width: 68, textAlign: 'right' },
  mealTabs: { paddingHorizontal: 20, marginBottom: 16 },
  mealTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A20', borderWidth: 0.5, borderColor: '#2C2C35', marginRight: 8 },
  mealTabActive: { backgroundColor: '#EEEDFE', borderColor: '#534AB7' },
  mealTabText: { fontSize: 13, color: '#71717A', fontWeight: '500' },
  mealTabTextActive: { color: '#534AB7' },
  addFoodRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 8 },
  addFoodBtn: { borderWidth: 0.5, borderColor: '#2C2C35', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addFoodBtnText: { color: '#534AB7', fontSize: 14, fontWeight: '500' },
  scanBtn: { backgroundColor: '#534AB7', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  scanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  searchCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 10, padding: 10, color: '#FFFFFF', fontSize: 14 },
  searchBtn: { backgroundColor: '#534AB7', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35', gap: 10 },
  resultName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  resultBrand: { fontSize: 11, color: '#71717A', marginTop: 1 },
  resultMacros: { fontSize: 11, color: '#71717A', marginTop: 2 },
  resultCalBox: { alignItems: 'center', minWidth: 44 },
  resultCal: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  resultCalLabel: { fontSize: 10, color: '#71717A' },
  servingCard: { marginTop: 12, backgroundColor: '#2C2C35', borderRadius: 12, padding: 14 },
  servingTitle: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', marginBottom: 10 },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  servingInput: { backgroundColor: '#1A1A20', borderRadius: 8, padding: 10, color: '#FFFFFF', fontSize: 15, width: 80, textAlign: 'center' },
  servingUnit: { fontSize: 14, color: '#71717A' },
  logBtn: { flex: 1, backgroundColor: '#534AB7', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  logBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  servingPreview: { fontSize: 12, color: '#71717A' },
  cancelSearchBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  cancelSearchText: { color: '#71717A', fontSize: 14 },
  entriesSection: { paddingHorizontal: 20 },
  emptyText: { color: '#71717A', fontSize: 14, paddingVertical: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#1A1A20', gap: 8 },
  entryName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  entryMacros: { fontSize: 11, color: '#71717A', marginTop: 2 },
  entryCal: { fontSize: 14, color: '#A1A1AA', fontWeight: '500' },
  deleteBtn: { padding: 4 },
  deleteText: { color: '#71717A', fontSize: 12 },
  scanOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60 },
  scanHint: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  scanCancelBtn: { backgroundColor: '#1A1A20', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  scanCancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  scanDenied: { flex: 1, backgroundColor: '#0F0F13', justifyContent: 'center', alignItems: 'center', gap: 16 },
  scanDeniedText: { color: '#FFFFFF', fontSize: 16 },
});