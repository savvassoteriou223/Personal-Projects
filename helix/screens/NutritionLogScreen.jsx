import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack'];

// Speech-recognition locale per app language.
const SPEECH_LOCALES = { en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', pt: 'pt-BR', ru: 'ru-RU', zh: 'zh-CN' };

function autoMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export default function NutritionLogScreen({ onClose, initialMeal, isPremium }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [selectedMeal, setSelectedMeal] = useState(initialMeal || autoMeal());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [recentItems, setRecentItems] = useState([]);

  // Manual entry state
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCal, setManualCal] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualF, setManualF] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd'); // local date, not UTC

  useSpeechRecognitionEvent('start', () => setIsListening(true));
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', () => setIsListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript;
    if (text) setDescription(text);
  });

  useEffect(() => {
    loadEntries();
    loadRecentItems();
  }, []);

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

  const loadRecentItems = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('nutrition_logs')
        .select('food_name, calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .neq('date', today)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(60);
      if (data) {
        const seen = new Set();
        const unique = data.filter(e => {
          if (seen.has(e.food_name)) return false;
          seen.add(e.food_name);
          return true;
        }).slice(0, 8);
        setRecentItems(unique);
      }
    } catch {}
  };

  const toggleSpeech = async () => {
    if (isListening) { ExpoSpeechRecognitionModule.stop(); return; }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) { Alert.alert(t('nutritionLog.alerts.permissionTitle'), t('nutritionLog.alerts.micPermission')); return; }
    setDescription('');
    ExpoSpeechRecognitionModule.start({ lang: SPEECH_LOCALES[i18n.language?.split('-')[0]] || 'en-US', interimResults: true });
  };

  const callNutritionAI = async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('unauthorised');
    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/nutrition-ai`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      }
    );
    const json = await res.json();
    if (!res.ok) {
      if (res.status === 429) throw new Error('daily_limit');
      if (res.status === 403) throw new Error('premium_required');
      if (res.status === 401) throw new Error('session_expired');
      throw new Error(json.error || 'ai_unavailable');
    }
    if (!json?.items?.length) throw new Error('no_items');
    return json;
  };

  const handleAIError = (err) => {
    if (err.message === 'daily_limit') Alert.alert(t('nutritionLog.alerts.dailyLimitTitle'), t('nutritionLog.alerts.dailyLimitMsg'));
    else if (err.message === 'premium_required') Alert.alert(t('nutritionLog.alerts.premiumTitle'), t('nutritionLog.alerts.premiumMsg'));
    else if (err.message === 'session_expired') Alert.alert(t('nutritionLog.alerts.sessionTitle'), t('nutritionLog.alerts.sessionMsg'));
    else if (err.message === 'no_items') Alert.alert(t('nutritionLog.alerts.noItemsTitle'), t('nutritionLog.alerts.noItemsMsg'));
    else if (err.message === 'image_too_large') Alert.alert(t('nutritionLog.alerts.photoLargeTitle'), t('nutritionLog.alerts.photoLargeMsg'));
    else if (err.message === 'invalid_image') Alert.alert(t('nutritionLog.alerts.invalidPhotoTitle'), t('nutritionLog.alerts.invalidPhotoMsg'));
    // Never surface the raw err.message — it can leak the backend hostname on a
    // network error. Show a connection hint or the generic calc-fail message.
    else if (/fetch|network|resolve|host|timeout|connection|offline/i.test(err?.message || ''))
      Alert.alert(t('nutritionLog.alerts.calcFailTitle'), t('auth.errors.connection', { defaultValue: 'Couldn’t connect. Check your internet connection and try again.' }));
    else Alert.alert(t('nutritionLog.alerts.calcFailTitle'), t('nutritionLog.alerts.calcFailMsg'));
  };

  const calculate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const json = await callNutritionAI({ description: description.trim() });
      setResult({ items: json.items, totals: json.totals });
    } catch (err) { handleAIError(err); }
    setLoading(false);
  };

  const calculateFromImage = async (imageBase64) => {
    setLoading(true);
    setResult(null);
    try {
      const json = await callNutritionAI({ image: imageBase64 });
      setResult({ items: json.items, totals: json.totals });
    } catch (err) { handleAIError(err); }
    setLoading(false);
  };

  const pickPhoto = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert(t('nutritionLog.alerts.permissionTitle'), t('nutritionLog.alerts.photoPermission')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.35, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      await calculateFromImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) { Alert.alert(t('nutritionLog.alerts.permissionTitle'), t('nutritionLog.alerts.cameraPermission')); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.35, base64: true });
    if (!res.canceled && res.assets[0]?.base64) {
      await calculateFromImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const updateItem = (index, field, raw) => {
    const val = parseInt(raw, 10);
    const items = result.items.map((item, i) =>
      i === index ? { ...item, [field]: isNaN(val) ? 0 : val } : item
    );
    setResult({ items, totals: recalcTotals(items) });
  };

  const updateGrams = (index, raw) => {
    const g = parseFloat(raw);
    const items = result.items.map((item, i) => {
      if (i !== index || !item.per100) return i === index ? { ...item, grams: raw } : item;
      const m = isNaN(g) || g <= 0 ? 0 : g / 100;
      return { ...item, grams: raw, quantity: `${raw}g`, calories: Math.round(item.per100.kcal * m), protein_g: Math.round(item.per100.protein * m), carbs_g: Math.round(item.per100.carbs * m), fat_g: Math.round(item.per100.fat * m) };
    });
    setResult({ items, totals: recalcTotals(items) });
  };

  const recalcTotals = (items) => items.reduce(
    (acc, item) => ({ calories: acc.calories + (Number(item.calories) || 0), protein_g: acc.protein_g + (Number(item.protein_g) || 0), carbs_g: acc.carbs_g + (Number(item.carbs_g) || 0), fat_g: acc.fat_g + (Number(item.fat_g) || 0) }),
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
      user_id: user.id, date: today, meal_type: selectedMeal,
      food_name: `${item.name} (${item.quantity})`,
      calories: item.calories, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g, servings: 1,
    }));
    const { data, error } = await supabase.from('nutrition_logs').insert(rows).select();
    if (error) { Alert.alert(t('nutritionLog.alerts.logFailTitle'), t('nutritionLog.alerts.logFailMsg')); setSaving(false); return; }
    if (data) setEntries(prev => [...prev, ...data]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResult(null);
    setDescription('');
    setSaving(false);
    loadRecentItems();
  };

  const quickAdd = async (item) => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await supabase.from('nutrition_logs').insert({
      user_id: user.id, date: today, meal_type: selectedMeal,
      food_name: item.food_name, calories: item.calories,
      protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g, servings: 1,
    }).select();
    if (!error && data) {
      setEntries(prev => [...prev, ...data]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const logManual = async () => {
    if (!manualName.trim()) { Alert.alert(t('nutritionLog.alerts.nameRequiredTitle'), t('nutritionLog.alerts.nameRequiredMsg')); return; }
    const user = await getCurrentUser();
    if (!user) return;
    const { data, error } = await supabase.from('nutrition_logs').insert({
      user_id: user.id, date: today, meal_type: selectedMeal,
      food_name: manualName.trim(),
      calories: parseInt(manualCal) || 0, protein_g: parseInt(manualP) || 0,
      carbs_g: parseInt(manualC) || 0, fat_g: parseInt(manualF) || 0, servings: 1,
    }).select();
    if (error) { Alert.alert(t('nutritionLog.alerts.logFailTitle'), t('nutritionLog.alerts.logFailMsgShort')); return; }
    if (data) setEntries(prev => [...prev, ...data]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowManual(false);
    setManualName(''); setManualCal(''); setManualP(''); setManualC(''); setManualF('');
    loadRecentItems();
  };

  const deleteEntry = async (id) => {
    await supabase.from('nutrition_logs').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const mealEntries = entries.filter(e => e.meal_type === selectedMeal);
  const mealTotals = mealEntries.reduce(
    (acc, e) => ({ calories: acc.calories + (e.calories || 0), protein: acc.protein + (e.protein_g || 0), carbs: acc.carbs + (e.carbs_g || 0), fat: acc.fat + (e.fat_g || 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[st.header, { paddingTop: insets.top + 16 }]}>
        <Text style={st.title}>{t('nutritionLog.title')}</Text>
        <Tappable onPress={onClose}><Text style={st.doneBtn}>{t('common.done')}</Text></Tappable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {/* Meal tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.mealTabs} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {MEAL_KEYS.map(mealKey => (
            <Tappable key={mealKey} style={[st.mealTab, selectedMeal === mealKey && st.mealTabActive]} onPress={() => setSelectedMeal(mealKey)}>
              <Text style={[st.mealTabText, selectedMeal === mealKey && st.mealTabTextActive]}>{t(`nutrition.meals.${mealKey}`)}</Text>
            </Tappable>
          ))}
        </ScrollView>

        {/* Quick-add */}
        {recentItems.length > 0 && (
          <View style={st.quickAddSection}>
            <Text style={st.quickAddLabel}>{t('nutritionLog.recent')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentItems.map((item, i) => (
                <Tappable key={i} style={st.quickAddChip} onPress={() => quickAdd(item)}>
                  <Text style={st.quickAddName} numberOfLines={1}>{item.food_name.split(' (')[0]}</Text>
                  <Text style={st.quickAddCal}>{t('nutrition.kcal', { value: item.calories })}</Text>
                </Tappable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input card */}
        <View style={st.inputCard}>
          {isPremium ? (
            <>
              <TextInput
                style={st.input}
                value={description}
                onChangeText={setDescription}
                placeholder={t('nutritionLog.describePlaceholder')}
                placeholderTextColor={colors.textFaint}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
              <View style={st.inputActions}>
                <Tappable style={[st.iconBtn, isListening && st.iconBtnActive]} onPress={toggleSpeech} disabled={loading}>
                  <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={18} color={isListening ? colors.danger : colors.textSubtle} />
                </Tappable>
                <Tappable style={st.iconBtn} onPress={takePhoto} disabled={loading}>
                  <Ionicons name="camera-outline" size={18} color={colors.textSubtle} />
                </Tappable>
                <Tappable style={st.iconBtn} onPress={pickPhoto} disabled={loading}>
                  <Ionicons name="image-outline" size={18} color={colors.textSubtle} />
                </Tappable>
                <Tappable style={[st.calcBtn, (!description.trim() || loading) && st.calcBtnDisabled]} onPress={calculate} disabled={!description.trim() || loading}>
                  {loading ? <ActivityIndicator color={colors.surfaceRaised} size="small" /> : <Text style={st.calcBtnText}>{t('nutritionLog.calculate')}</Text>}
                </Tappable>
              </View>
            </>
          ) : (
            <View style={st.premiumNote}>
              <Text style={st.premiumNoteText}>{t('nutritionLog.premiumNote')}</Text>
            </View>
          )}
        </View>

        {/* Manual entry button */}
        <Tappable style={st.manualBtn} onPress={() => setShowManual(true)}>
          <Ionicons name="create-outline" size={14} color={colors.textSubtle} />
          <Text style={st.manualBtnText}>{t('nutritionLog.manualEntry')}</Text>
        </Tappable>

        {/* Confirmation card */}
        {result && (
          <View style={st.resultCard}>
            <Text style={st.resultHeading}>{t('nutritionLog.confirmMeal')}</Text>
            <Text style={st.resultTip}>{t('nutritionLog.confirmTip')}</Text>
            {result.items.map((item, i) => (
              <View key={i} style={st.resultItem}>
                <View style={st.resultItemHeader}>
                  <Text style={st.resultItemName} numberOfLines={1}>{item.name}</Text>
                  <Tappable onPress={() => removeItem(i)} hitSlop={8}><Text style={st.removeBtnText}>✕</Text></Tappable>
                </View>
                <View style={st.editFields}>
                  {item.per100 && (
                    <View style={st.editField}>
                      <TextInput style={st.editInput} value={item.grams} onChangeText={v => updateGrams(i, v)} keyboardType="decimal-pad" selectTextOnFocus />
                      <Text style={st.editLabel}>{t('nutritionLog.grams')}</Text>
                    </View>
                  )}
                  {[{ label: t('nutritionLog.macroAbbr.kcal'), field: 'calories' }, { label: t('nutritionLog.macroAbbr.protein'), field: 'protein_g' }, { label: t('nutritionLog.macroAbbr.carbs'), field: 'carbs_g' }, { label: t('nutritionLog.macroAbbr.fat'), field: 'fat_g' }].map(({ label, field }) => (
                    <View key={field} style={st.editField}>
                      <TextInput style={[st.editInput, item.per100 && st.editInputReadonly]} value={String(item[field])} onChangeText={v => !item.per100 && updateItem(i, field, v)} keyboardType="number-pad" selectTextOnFocus editable={!item.per100} />
                      <Text style={st.editLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
            <View style={st.resultTotals}>
              <Text style={st.totalLabel}>{t('nutritionLog.total')}</Text>
              <View style={{ flex: 1 }} />
              <Text style={st.totalMacros}>{t('nutrition.mealMacros', { p: result.totals.protein_g, c: result.totals.carbs_g, f: result.totals.fat_g })}</Text>
              <Text style={st.totalCal}>{t('nutrition.kcal', { value: result.totals.calories })}</Text>
            </View>
            <View style={st.resultActions}>
              <Tappable style={[st.logBtn, saving && st.logBtnDisabled]} onPress={logMeal} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.surfaceRaised} size="small" /> : <Text style={st.logBtnText}>{t('nutritionLog.logMeal')}</Text>}
              </Tappable>
            </View>
          </View>
        )}

        {/* Logged entries */}
        {mealEntries.length > 0 && (
          <View style={st.entriesSection}>
            <View style={st.entriesHeader}>
              <Text style={st.entriesTitle}>{t(`nutrition.meals.${selectedMeal}`)}</Text>
              <Text style={st.entriesTotalCal}>{t('nutrition.kcal', { value: Math.round(mealTotals.calories) })}</Text>
            </View>
            <Text style={st.entriesTotalMacros}>{t('nutrition.mealMacros', { p: Math.round(mealTotals.protein), c: Math.round(mealTotals.carbs), f: Math.round(mealTotals.fat) })}</Text>
            {mealEntries.map(entry => (
              <View key={entry.id} style={st.entryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.entryName} numberOfLines={1}>{entry.food_name}</Text>
                  <Text style={st.entryMacros}>{t('nutrition.mealMacros', { p: Math.round(entry.protein_g), c: Math.round(entry.carbs_g), f: Math.round(entry.fat_g) })}</Text>
                </View>
                <Text style={st.entryCal}>{t('nutrition.kcal', { value: Math.round(entry.calories) })}</Text>
                <Tappable onPress={() => deleteEntry(entry.id)} style={st.deleteBtn} hitSlop={8}>
                  <Text style={st.deleteText}>✕</Text>
                </Tappable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Manual entry modal */}
      <Modal visible={showManual} transparent animationType="slide" onRequestClose={() => setShowManual(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={st.modalOverlay} onPress={() => setShowManual(false)}>
            <Pressable style={[st.modalCard, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
              <Text style={st.modalTitle}>{t('nutritionLog.manualEntry')}</Text>
              <TextInput style={st.modalInput} value={manualName} onChangeText={setManualName} placeholder={t('nutritionLog.foodName')} placeholderTextColor={colors.textFaint} />
              <View style={st.modalMacroRow}>
                {[['calories', manualCal, setManualCal], ['protein', manualP, setManualP], ['carbs', manualC, setManualC], ['fat', manualF, setManualF]].map(([macroKey, val, setter]) => (
                  <View key={macroKey} style={st.modalMacroField}>
                    <TextInput style={st.modalMacroInput} value={val} onChangeText={setter} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textFaint} />
                    <Text style={st.modalMacroLabel}>{t(`nutritionLog.manualMacros.${macroKey}`)}</Text>
                  </View>
                ))}
              </View>
              <Tappable style={st.logBtn} onPress={logManual}>
                <Text style={st.logBtnText}>{t('nutritionLog.addTo', { meal: t(`nutrition.meals.${selectedMeal}`) })}</Text>
              </Tappable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  doneBtn: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  mealTabs: { paddingVertical: 16 },
  mealTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border },
  mealTabActive: { backgroundColor: colors.surfaceElevated, borderColor: '#FFFFFF44' },
  mealTabText: { fontSize: 13, color: colors.textSubtle, fontWeight: '500' },
  mealTabTextActive: { color: colors.textPrimary },

  quickAddSection: { paddingHorizontal: 20, marginBottom: 12 },
  quickAddLabel: { fontSize: 10, color: colors.textFaint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  quickAddChip: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0.5, borderColor: colors.border, maxWidth: 130 },
  quickAddName: { fontSize: 12, color: colors.textPrimary, fontWeight: '500', marginBottom: 2 },
  quickAddCal: { fontSize: 10, color: colors.textFaint },

  inputCard: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  input: { color: colors.textPrimary, fontSize: 15, lineHeight: 22, minHeight: 72, marginBottom: 12 },
  inputActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { padding: 12, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.surfaceInset },
  iconBtnActive: { borderColor: '#E85D5C33', backgroundColor: '#E85D5C11' },
  calcBtn: { flex: 1, backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  calcBtnDisabled: { opacity: 0.35 },
  calcBtnText: { color: colors.surfaceRaised, fontSize: 14, fontWeight: '600' },
  premiumNote: { padding: 4 },
  premiumNoteText: { fontSize: 13, color: colors.textFaint, lineHeight: 20 },

  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginBottom: 16, paddingVertical: 4 },
  manualBtnText: { fontSize: 13, color: colors.textSubtle },

  resultCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  resultHeading: { fontSize: 13, color: colors.textSubtle, fontWeight: '500', marginBottom: 4 },
  resultTip: { fontSize: 11, color: colors.textFaint, marginBottom: 12 },
  resultItem: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  resultItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultItemName: { fontSize: 14, color: colors.textPrimary, fontWeight: '500', flex: 1, marginRight: 8 },
  removeBtnText: { color: colors.textFaint, fontSize: 12 },
  editFields: { flexDirection: 'row', gap: 8 },
  editField: { alignItems: 'center' },
  editInput: { backgroundColor: colors.control, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6, color: colors.textPrimary, fontSize: 13, width: 56, textAlign: 'center' },
  editInputReadonly: { color: colors.textSubtle },
  editLabel: { fontSize: 10, color: colors.textFaint, marginTop: 3 },
  resultTotals: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, marginTop: 2, gap: 8 },
  totalLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  totalMacros: { fontSize: 11, color: colors.textSubtle },
  totalCal: { fontSize: 14, color: colors.textPrimary, fontWeight: '700', minWidth: 58, textAlign: 'right' },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  logBtn: { flex: 1, backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { color: colors.surfaceRaised, fontSize: 14, fontWeight: '600' },

  entriesSection: { marginHorizontal: 20 },
  entriesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  entriesTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  entriesTotalCal: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  entriesTotalMacros: { fontSize: 11, color: colors.textFaint, marginBottom: 10 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.surface, gap: 8 },
  entryName: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  entryMacros: { fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  entryCal: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  deleteBtn: { paddingLeft: 4 },
  deleteText: { color: colors.textFaint, fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 0.5, borderTopColor: colors.border, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: { backgroundColor: colors.control, borderRadius: 10, padding: 14, color: colors.textPrimary, fontSize: 15 },
  modalMacroRow: { flexDirection: 'row', gap: 8 },
  modalMacroField: { flex: 1, alignItems: 'center' },
  modalMacroInput: { backgroundColor: colors.control, borderRadius: 8, padding: 10, color: colors.textPrimary, fontSize: 15, width: '100%', textAlign: 'center', marginBottom: 4 },
  modalMacroLabel: { fontSize: 10, color: colors.textFaint },
});
