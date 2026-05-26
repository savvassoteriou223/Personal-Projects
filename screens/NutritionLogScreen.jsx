import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as Haptics from 'expo-haptics';
import { supabase, getCurrentUser } from '../supabase';

const MEALS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snacks' },
];

function autoMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export default function NutritionLogScreen({ onClose, initialMeal }) {
  const insets = useSafeAreaInsets();
  const [selectedMeal, setSelectedMeal] = useState(initialMeal || autoMeal());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (text) setDescription(text);
  });

  const toggleSpeech = async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed for voice input.');
      return;
    }
    setDescription('');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
  };
  const [editingIndex, setEditingIndex] = useState(null);
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const { data } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .order('created_at', { ascending: true });
      if (data) setEntries(data);
    } catch {}
  };

  const calculate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('unauthorised');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/nutrition-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ description: description.trim() }),
        }
      );

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          Alert.alert('Daily limit reached', 'You have used your 5 daily AI food logs. Resets at midnight.');
          setLoading(false);
          return;
        }
        if (res.status === 403) {
          Alert.alert('Premium required', 'AI nutrition logging requires a Helix Pro subscription.');
          setLoading(false);
          return;
        }
        if (res.status === 401) {
          Alert.alert('Session expired', 'Please log out and log back in.');
          setLoading(false);
          return;
        }
        const errCode = json.error || 'ai_unavailable';
        console.error('nutrition-ai error response:', res.status, errCode);
        Alert.alert('Could not calculate', `Error: ${errCode}. Please try again.`);
        setLoading(false);
        return;
      }

      if (!json?.items?.length) {
        Alert.alert('No items found', 'Try describing your meal in more detail.');
        setLoading(false);
        return;
      }

      setResult({ items: json.items, totals: json.totals });
    } catch (err) {
      console.error('nutrition calc error:', err);
      Alert.alert('Could not calculate', err.message || 'Network error. Check your connection.');
    }
    setLoading(false);
  };


  const updateItem = (index, field, raw) => {
    const val = parseInt(raw, 10);
    const items = result.items.map((item, i) =>
      i === index ? { ...item, [field]: isNaN(val) ? 0 : val } : item
    );
    const totals = recalcTotals(items);
    setResult({ items, totals });
  };

  const updateGrams = (index, raw) => {
    const g = parseFloat(raw);
    const items = result.items.map((item, i) => {
      if (i !== index || !item.per100) return i === index ? { ...item, grams: raw } : item;
      const m = isNaN(g) || g <= 0 ? 0 : g / 100;
      return {
        ...item,
        grams: raw,
        quantity: `${raw}g`,
        calories: Math.round(item.per100.kcal * m),
        protein_g: Math.round(item.per100.protein * m),
        carbs_g: Math.round(item.per100.carbs * m),
        fat_g: Math.round(item.per100.fat * m),
      };
    });
    setResult({ items, totals: recalcTotals(items) });
  };

  const recalcTotals = (items) => items.reduce(
    (acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      protein_g: acc.protein_g + (Number(item.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(item.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(item.fat_g) || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const removeItem = (index) => {
    const items = result.items.filter((_, i) => i !== index);
    setResult({ items, totals: recalcTotals(items) });
  };

  const logMeal = async () => {
    if (!result?.items?.length) return;
    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const rows = result.items.map(item => ({
      user_id: user.id,
      date: today,
      meal_type: selectedMeal,
      food_name: `${item.name} (${item.quantity})`,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      servings: 1,
    }));

    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert(rows)
      .select();

    if (error) {
      Alert.alert('Log failed', 'Could not save. Please try again.');
      setSaving(false);
      return;
    }

    if (data) setEntries(prev => [...prev, ...data]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResult(null);
    setDescription('');
    setSaving(false);
  };

  const deleteEntry = async (id) => {
    await supabase.from('nutrition_logs').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const mealEntries = entries.filter(e => e.meal_type === selectedMeal);
  const mealTotals = mealEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein_g || 0),
      carbs: acc.carbs + (e.carbs_g || 0),
      fat: acc.fat + (e.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Log food</Text>
        <Pressable onPress={onClose}>
          <Text style={styles.doneBtn}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Meal tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mealTabs}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
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

        {/* Input */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Type what you've eaten. The more detail you give, the more accurate the result."
            placeholderTextColor="#3D3D4A"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!loading}
          />
          <View style={styles.inputActions}>
            <Pressable
              style={[styles.micBtn, isListening && styles.micBtnActive]}
              onPress={toggleSpeech}
              disabled={loading}
            >
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={18}
                color={isListening ? '#E24B4A' : '#71717A'}
              />
              <Text style={[styles.micBtnText, isListening && styles.micBtnTextActive]}>
                {isListening ? 'Listening...' : 'Voice'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.calcBtn, (!description.trim() || loading) && styles.calcBtnDisabled]}
              onPress={calculate}
              disabled={!description.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#111114" size="small" />
                : <Text style={styles.calcBtnText}>Calculate</Text>
              }
            </Pressable>
          </View>
        </View>

        {/* Confirmation card */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeading}>Confirm meal</Text>
            <Text style={styles.resultTip}>Tap any value to edit it if something looks off.</Text>

            {result.items.map((item, i) => (
              <View key={i} style={styles.resultItem}>
                <View style={styles.resultItemHeader}>
                  <Text style={styles.resultItemName} numberOfLines={1}>{item.name}</Text>
                  <Pressable onPress={() => removeItem(i)} hitSlop={8}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.editFields}>
                  {item.per100 && (
                    <View style={styles.editField}>
                      <TextInput
                        style={styles.editInput}
                        value={item.grams}
                        onChangeText={v => updateGrams(i, v)}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                      <Text style={styles.editLabel}>grams</Text>
                    </View>
                  )}
                  {[
                    { label: 'kcal', field: 'calories' },
                    { label: 'P', field: 'protein_g' },
                    { label: 'C', field: 'carbs_g' },
                    { label: 'F', field: 'fat_g' },
                  ].map(({ label, field }) => (
                    <View key={field} style={styles.editField}>
                      <TextInput
                        style={[styles.editInput, item.per100 && styles.editInputReadonly]}
                        value={String(item[field])}
                        onChangeText={v => !item.per100 && updateItem(i, field, v)}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        editable={!item.per100}
                      />
                      <Text style={styles.editLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.resultTotals}>
              <Text style={styles.totalLabel}>Total</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.totalMacros}>
                P: {result.totals.protein_g}g · C: {result.totals.carbs_g}g · F: {result.totals.fat_g}g
              </Text>
              <Text style={styles.totalCal}>{result.totals.calories} kcal</Text>
            </View>

            <View style={styles.resultActions}>
              <Pressable
                style={[styles.logBtn, saving && styles.logBtnDisabled]}
                onPress={logMeal}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#111114" size="small" />
                  : <Text style={styles.logBtnText}>Log meal</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

        {/* Logged entries for selected meal */}
        {mealEntries.length > 0 && (
          <View style={styles.entriesSection}>
            <View style={styles.entriesHeader}>
              <Text style={styles.entriesTitle}>
                {MEALS.find(m => m.key === selectedMeal)?.label}
              </Text>
              <Text style={styles.entriesTotalCal}>{Math.round(mealTotals.calories)} kcal</Text>
            </View>
            <Text style={styles.entriesTotalMacros}>
              P: {Math.round(mealTotals.protein)}g · C: {Math.round(mealTotals.carbs)}g · F: {Math.round(mealTotals.fat)}g
            </Text>
            {mealEntries.map(entry => (
              <View key={entry.id} style={styles.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName} numberOfLines={1}>{entry.food_name}</Text>
                  <Text style={styles.entryMacros}>
                    P: {Math.round(entry.protein_g)}g · C: {Math.round(entry.carbs_g)}g · F: {Math.round(entry.fat_g)}g
                  </Text>
                </View>
                <Text style={styles.entryCal}>{Math.round(entry.calories)} kcal</Text>
                <Pressable onPress={() => deleteEntry(entry.id)} style={styles.deleteBtn} hitSlop={8}>
                  <Text style={styles.deleteText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 16, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  doneBtn: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  mealTabs: { paddingVertical: 16 },
  mealTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A20', borderWidth: 0.5, borderColor: '#2C2C35',
  },
  mealTabActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF44' },
  mealTabText: { fontSize: 13, color: '#71717A', fontWeight: '500' },
  mealTabTextActive: { color: '#FFFFFF' },

  inputCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#1A1A20', borderRadius: 16,
    padding: 16, borderWidth: 0.5, borderColor: '#2C2C35',
  },
  input: {
    color: '#FFFFFF', fontSize: 15, lineHeight: 22,
    minHeight: 72, marginBottom: 12,
  },
  inputActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  micBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 13,
    borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35',
    backgroundColor: '#12121A',
  },
  micBtnActive: { borderColor: '#E24B4A33', backgroundColor: '#E24B4A11' },
  micBtnText: { fontSize: 13, color: '#71717A', fontWeight: '500' },
  micBtnTextActive: { color: '#E24B4A' },
  calcBtn: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  calcBtnDisabled: { opacity: 0.35 },
  calcBtnText: { color: '#111114', fontSize: 14, fontWeight: '600' },

  resultCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#1A1A20', borderRadius: 16,
    padding: 16, borderWidth: 0.5, borderColor: '#2C2C35',
  },
  resultHeading: { fontSize: 13, color: '#71717A', fontWeight: '500', marginBottom: 4 },
  resultTip: { fontSize: 11, color: '#3D3D4A', marginBottom: 12 },
  resultItem: {
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35',
  },
  resultItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultItemName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500', flex: 1, marginRight: 8 },
  removeBtnText: { color: '#52525B', fontSize: 12 },
  editFields: { flexDirection: 'row', gap: 8 },
  editField: { alignItems: 'center' },
  editInput: {
    backgroundColor: '#2C2C35', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6,
    color: '#FFFFFF', fontSize: 13, width: 56, textAlign: 'center',
  },
  editInputReadonly: { color: '#71717A' },
  editLabel: { fontSize: 10, color: '#52525B', marginTop: 3 },

  resultTotals: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 12, marginTop: 2, gap: 8,
  },
  totalLabel: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
  totalMacros: { fontSize: 11, color: '#71717A' },
  totalCal: { fontSize: 14, color: '#FFFFFF', fontWeight: '700', minWidth: 58, textAlign: 'right' },

  resultActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  logBtn: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { color: '#111114', fontSize: 14, fontWeight: '600' },

  entriesSection: { marginHorizontal: 20 },
  entriesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  entriesTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  entriesTotalCal: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  entriesTotalMacros: { fontSize: 11, color: '#52525B', marginBottom: 10 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#1A1A20', gap: 8,
  },
  entryName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  entryMacros: { fontSize: 11, color: '#71717A', marginTop: 2 },
  entryCal: { fontSize: 13, color: '#A1A1AA', fontWeight: '500' },
  deleteBtn: { paddingLeft: 4 },
  deleteText: { color: '#52525B', fontSize: 12 },

});
