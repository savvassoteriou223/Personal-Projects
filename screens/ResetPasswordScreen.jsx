import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { friendlyAuthError } from '../lib/errorMessage';

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
            placeholderTextColor="#8A8A94"
            secureTextEntry={!showPassword}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showPassword ? t('auth.hide') : t('auth.show')}</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{t('auth.newPassword.confirmLabel')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.inputInner, { flex: 1 }]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t('auth.newPassword.confirmPlaceholder')}
            placeholderTextColor="#8A8A94"
            secureTextEntry={!showConfirm}
          />
          <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{showConfirm ? t('auth.hide') : t('auth.show')}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#111114" />
            : <Text style={styles.btnText}>{t('auth.newPassword.submit')}</Text>
          }
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, marginBottom: 8 },
  sub: { fontSize: 15, color: '#9494A0', marginBottom: 40 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  inputInner: { padding: 16, color: '#FFFFFF', fontSize: 16, backgroundColor: 'transparent' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: '#9494A0' },
  error: { color: '#E85D5C', fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  successBox: { margin: 24, backgroundColor: '#1A1A20', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#1D9E75' },
  successTitle: { fontSize: 16, fontWeight: '700', color: '#1D9E75', marginBottom: 8 },
  successText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22 },
});
