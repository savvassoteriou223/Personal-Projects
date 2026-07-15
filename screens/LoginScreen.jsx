import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { friendlyAuthError } from '../lib/errorMessage';

export default function LoginScreen({ onLogin, onGoToSignup, onGoBack, onRecovery }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login');

 // 'login' | 'reset' | 'reset_code'
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError(t('auth.errors.fillAll')); return; }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(friendlyAuthError(error, t)); setLoading(false); return; }
      // SIGNED_IN event navigates away. Fallback in case it never fires.
      setTimeout(() => setLoading(false), 8000);
    } catch (e) {
      setError(friendlyAuthError(e, t));
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError(t('auth.errors.enterEmail')); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) { setError(friendlyAuthError(error, t)); return; }
    setMode('reset_code');
  };

  const handleResetCode = async () => {
    if (!resetCode) { setError(t('auth.errors.enterCode')); return; }
    setLoading(true);
    setError('');
    onRecovery && onRecovery();
    const { error } = await supabase.auth.verifyOtp({ email, token: resetCode.trim(), type: 'email' });
    setLoading(false);
    if (error) { onRecovery && onRecovery(false); setError(t('auth.errors.invalidCode')); return; }
  };

  const switchToReset = () => { setMode('reset'); setError(''); setResetSent(false); setResetCode(''); };
  const switchToLogin = () => { setMode('login'); setError(''); setResetSent(false); setResetCode(''); };

  if (mode === 'reset_code') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={switchToReset} style={{ paddingBottom: 24 }}>
              <Text style={{ color: '#9494A0', fontSize: 15 }}>← {t('auth.back')}</Text>
            </Pressable>

            <Text style={styles.title}>{t('auth.code.title')}</Text>
            <Text style={styles.sub}>{t('auth.code.subtitle', { email })}</Text>

            <Text style={styles.label}>{t('auth.code.label')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInner}
                value={resetCode}
                onChangeText={setResetCode}
                placeholder={t('auth.code.placeholder')}
                placeholderTextColor="#8A8A94"
                keyboardType="number-pad"
                autoCapitalize="none"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
              onPress={handleResetCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#111114" />
                : <Text style={styles.btnText}>{t('auth.code.verify')}</Text>
              }
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (mode === 'reset') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={switchToLogin} style={{ paddingBottom: 24 }}>
              <Text style={{ color: '#9494A0', fontSize: 15 }}>← {t('auth.backToSignIn')}</Text>
            </Pressable>

            <Text style={styles.title}>{t('auth.reset.title')}</Text>
            <Text style={styles.sub}>{t('auth.reset.subtitle')}</Text>

            <Text style={styles.label}>{t('auth.email')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInner}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor="#8A8A94"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#111114" />
                : <Text style={styles.btnText}>{t('auth.reset.sendCode')}</Text>
              }
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={onGoBack} style={{ paddingBottom: 24 }}>
            <Text style={{ color: '#9494A0', fontSize: 15 }}>← {t('auth.back')}</Text>
          </Pressable>

          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.sub}>{t('auth.login.subtitle')}</Text>

          <Text style={styles.label}>{t('auth.email')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#8A8A94"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.inputInner, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder={t('auth.login.passwordPlaceholder')}
              placeholderTextColor="#8A8A94"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? t('auth.hide') : t('auth.show')}</Text>
            </Pressable>
          </View>

          <Pressable onPress={switchToReset} style={styles.forgotLink}>
            <Text style={styles.forgotText}>{t('auth.login.forgot')}</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#111114" />
              : <Text style={styles.btnText}>{t('auth.login.signIn')}</Text>
            }
          </Pressable>

          <Pressable onPress={onGoToSignup} style={styles.switchLink}>
            <Text style={styles.switchText}>
              {t('auth.login.noAccount')} <Text style={styles.switchHighlight}>{t('auth.login.signUp')}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 64, height: 64, borderRadius: 14, marginBottom: 24, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, marginBottom: 8 },
  sub: { fontSize: 15, color: '#9494A0', marginBottom: 40 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  inputWrap: { backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  inputInner: { padding: 16, color: '#FFFFFF', fontSize: 16, backgroundColor: 'transparent' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: '#9494A0' },
  error: { color: '#E85D5C', fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  switchLink: { alignItems: 'center', marginTop: 20 },
  switchText: { color: '#9494A0', fontSize: 14 },
  switchHighlight: { color: '#FFFFFF', fontWeight: '600' },
  forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 13, color: '#FFFFFF' },
  sentBox: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#1D9E75', marginTop: 8 },
  sentTitle: { fontSize: 16, fontWeight: '700', color: '#1D9E75', marginBottom: 8 },
  sentText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22, marginBottom: 20 },
});
