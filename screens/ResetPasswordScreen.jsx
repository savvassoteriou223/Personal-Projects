import {
  useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { friendlyAuthError } from '../lib/errorMessage';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

export default function ResetPasswordScreen({ onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirm) { setError(t('auth.errors.fillBoth')); return; }
    if (password.length < 8) { setError(t('auth.errors.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.errors.passwordMismatch')); return; }

    setLoading(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) { setError(friendlyAuthError(updateError, t)); return; }
    setDone(true);
    setTimeout(() => onDone && onDone(), 1500);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>{t('auth.success.title')}</Text>
          <Text style={styles.successText}>{t('auth.success.text')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={{ padding: 24, justifyContent: 'center', flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('auth.newPassword.title')}</Text>
        <Text style={styles.sub}>{t('auth.newPassword.subtitle')}</Text>

        <Text style={styles.label}>{t('auth.newPassword.label')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.inputInner, { flex: 1 }]}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.newPassword.placeholder')}
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showPassword}
          />
          <Tappable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showPassword ? t('auth.hide') : t('auth.show')}</Text>
          </Tappable>
        </View>

        <Text style={styles.label}>{t('auth.newPassword.confirmLabel')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.inputInner, { flex: 1 }]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t('auth.newPassword.confirmPlaceholder')}
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showConfirm}
          />
          <Tappable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showConfirm ? t('auth.hide') : t('auth.show')}</Text>
          </Tappable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Tappable
          style={styles.btn}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.surfaceRaised} />
            : <Text style={styles.btnText}>{t('auth.newPassword.submit')}</Text>
          }
        </Tappable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  title: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1, marginBottom: 8 },
  sub: { fontSize: 15, color: colors.textSubtle, marginBottom: 40 },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border },
  inputInner: { padding: 16, color: colors.textPrimary, fontSize: 16, backgroundColor: 'transparent' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: colors.textSubtle },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: colors.surfaceRaised, fontSize: 16, fontWeight: '600' },
  successBox: { margin: 24, backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: colors.accent },
  successTitle: { fontSize: 16, fontWeight: '700', color: colors.accent, marginBottom: 8 },
  successText: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
});
