import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

// key + unit are canonical; the display label comes from i18n (cards.cardio.types.*).
const ACTIVITY_TYPES = [
  { key: 'run',   unit: 'km' },
  { key: 'walk',  unit: 'km' },
  { key: 'swim',  unit: 'm'  },
  { key: 'cycle', unit: 'km' },
  { key: 'other', unit: null },
];

const SWIM_STROKES = ['Freestyle', 'Breaststroke', 'Butterfly', 'Backstroke', 'Mixed'];

// rpe value is canonical; label/sub resolved from i18n (cards.cardio.rpe.*).
const RPE_OPTIONS = [
  { key: 'easy',     rpe: 5 },
  { key: 'moderate', rpe: 7 },
  { key: 'hard',     rpe: 9 },
];

export default function CardioLogModal({ visible, onClose, onSaved }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activityType, setActivityType] = useState('run');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [stroke, setStroke] = useState('Freestyle');
  const [rpe, setRpe] = useState(7);
  const [saving, setSaving] = useState(false);

  const selectedType = ACTIVITY_TYPES.find(at => at.key === activityType);

  const reset = () => {
    setActivityType('run');
    setDuration('');
    setDistance('');
    setStroke('Freestyle');
    setRpe(7);
  };

  const save = async () => {
    if (!duration.trim()) {
      Alert.alert(t('cards.cardio.missingDurationTitle'), t('cards.cardio.missingDurationMsg'));
      return;
    }
    setSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const durationMin = parseInt(duration) || 0;
      const rawDist = parseFloat(distance) || 0;
      const distanceKm = activityType === 'swim' ? rawDist / 1000 : rawDist;

      const distLabel = rawDist > 0
        ? ` · ${activityType === 'swim' ? rawDist + 'm' : rawDist + 'km'}`
        : '';
      const nameMap = { run: 'Run', walk: 'Walk', swim: 'Swim', cycle: 'Cycle', other: 'Activity' };
      const name = nameMap[activityType] + distLabel;

      const { error } = await supabase.from('workout_sessions').insert({
        user_id: user.id,
        name,
        session_type: activityType,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_min: durationMin,
        distance_km: distanceKm || null,
        cardio_subtype: activityType === 'swim' ? stroke : null,
        perceived_exertion: rpe,
      });

      if (error) throw error;
      reset();
      onSaved?.();
      onClose();
    } catch {
      Alert.alert(t('cards.cardio.errorTitle'), t('cards.cardio.errorMsg'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[st.card, { paddingBottom: insets.bottom + 24 }]} onPress={e => e.stopPropagation()}>
            <View style={st.handle} />
            <Text style={st.title}>{t('cards.cardio.title')}</Text>

            <Text style={st.label}>{t('cards.cardio.type')}</Text>
            <View style={st.typeRow}>
              {ACTIVITY_TYPES.map(at => (
                <Tappable
                  key={at.key}
                  style={[st.chip, activityType === at.key && st.chipActive]}
                  onPress={() => setActivityType(at.key)}
                >
                  <Text style={[st.chipText, activityType === at.key && st.chipTextActive]}>{t(`cards.cardio.types.${at.key}`)}</Text>
                </Tappable>
              ))}
            </View>

            <View style={st.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>{t('cards.cardio.duration')}</Text>
                <TextInput
                  style={st.input}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  placeholder={t('cards.cardio.durationPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                />
              </View>
              {selectedType?.unit ? (
                <View style={{ flex: 1 }}>
                  <Text style={st.label}>{t('cards.cardio.distance', { unit: selectedType.unit })}</Text>
                  <TextInput
                    style={st.input}
                    value={distance}
                    onChangeText={setDistance}
                    keyboardType="decimal-pad"
                    placeholder={activityType === 'swim' ? '1500' : '5.0'}
                    placeholderTextColor={colors.textFaint}
                  />
                </View>
              ) : <View style={{ flex: 1 }} />}
            </View>

            {activityType === 'swim' && (
              <>
                <Text style={st.label}>{t('cards.cardio.stroke')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={st.strokeRow}>
                    {SWIM_STROKES.map(s => (
                      <Tappable
                        key={s}
                        style={[st.chip, stroke === s && st.chipActive]}
                        onPress={() => setStroke(s)}
                      >
                        <Text style={[st.chipText, stroke === s && st.chipTextActive]}>{s}</Text>
                      </Tappable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={st.label}>{t('cards.cardio.effort')}</Text>
            <View style={st.rpeRow}>
              {RPE_OPTIONS.map(opt => (
                <Tappable
                  key={opt.rpe}
                  style={[st.rpeBtn, rpe === opt.rpe && st.rpeBtnActive]}
                  onPress={() => setRpe(opt.rpe)}
                >
                  <Text style={[st.rpeBtnLabel, rpe === opt.rpe && st.rpeBtnLabelActive]}>{t(`cards.cardio.rpe.${opt.key}`)}</Text>
                  <Text style={[st.rpeBtnSub, rpe === opt.rpe && st.rpeBtnSubActive]}>{t(`cards.cardio.rpe.${opt.key}Sub`)}</Text>
                </Tappable>
              ))}
            </View>

            <Tappable style={[st.saveBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
              <Text style={st.saveBtnText}>{saving ? t('cards.cardio.saving') : t('cards.cardio.save')}</Text>
            </Tappable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  card:          { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 0.5, borderTopColor: colors.border, gap: 14 },
  handle:        { width: 36, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  title:         { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  label:         { fontSize: 11, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  typeRow:       { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  strokeRow:     { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  inputRow:      { flexDirection: 'row', gap: 12 },
  input:         { backgroundColor: colors.control, borderRadius: 10, padding: 14, color: colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  chip:          { backgroundColor: colors.control, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: colors.borderStrong },
  chipActive:    { backgroundColor: colors.surfaceInverse, borderColor: colors.borderActive },
  chipText:      { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  chipTextActive:{ color: colors.surfaceRaised },
  rpeRow:        { flexDirection: 'row', gap: 8 },
  rpeBtn:        { flex: 1, backgroundColor: colors.control, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderStrong },
  rpeBtnActive:  { backgroundColor: colors.surfaceInverse, borderColor: colors.borderActive },
  rpeBtnLabel:   { fontSize: 13, fontWeight: '700', color: colors.textSubtle, marginBottom: 3 },
  rpeBtnLabelActive: { color: colors.surfaceRaised },
  rpeBtnSub:     { fontSize: 9, color: colors.textFaint, textAlign: 'center', lineHeight: 13 },
  rpeBtnSubActive: { color: colors.textFaint },
  saveBtn:       { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnText:   { color: colors.surfaceRaised, fontSize: 15, fontWeight: '600' },
});
