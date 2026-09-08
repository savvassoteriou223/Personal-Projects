import {
  useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { friendlyAuthError } from '../lib/errorMessage';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

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
            <Tappable onPress={switchToReset} style={{ paddingBottom: 24 }}>
              <Text style={{ color: colors.textSubtle, fontSize: 15 }}>← {t('auth.back')}</Text>
            </Tappable>

            <Text style={styles.title}>{t('auth.code.title')}</Text>
            <Text style={styles.sub}>{t('auth.code.subtitle', { email })}</Text>

            <Text style={styles.label}>{t('auth.code.label')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInner}
                value={resetCode}
                onChangeText={setResetCode}
                placeholder={t('auth.code.placeholder')}
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Tappable
              style={styles.btn}
              onPress={handleResetCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.surfaceRaised} />
                : <Text style={styles.btnText}>{t('auth.code.verify')}</Text>
              }
            </Tappable>
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
            <Tappable onPress={switchToLogin} style={{ paddingBottom: 24 }}>
              <Text style={{ color: colors.textSubtle, fontSize: 15 }}>← {t('auth.backToSignIn')}</Text>
            </Tappable>

            <Text style={styles.title}>{t('auth.reset.title')}</Text>
            <Text style={styles.sub}>{t('auth.reset.subtitle')}</Text>

            <Text style={styles.label}>{t('auth.email')}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInner}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Tappable
              style={styles.btn}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.surfaceRaised} />
                : <Text style={styles.btnText}>{t('auth.reset.sendCode')}</Text>
              }
            </Tappable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Tappable onPress={onGoBack} style={{ paddingBottom: 24 }}>
            <Text style={{ color: colors.textSubtle, fontSize: 15 }}>← {t('auth.back')}</Text>
          </Tappable>

          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.sub}>{t('auth.login.subtitle')}</Text>

          <Text style={styles.label}>{t('auth.email')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={colors.textFaint}
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
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <Tappable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? t('auth.hide') : t('auth.show')}</Text>
            </Tappable>
          </View>

          <Tappable onPress={switchToReset} style={styles.forgotLink}>
            <Text style={styles.forgotText}>{t('auth.login.forgot')}</Text>
          </Tappable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Tappable
            style={styles.btn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.surfaceRaised} />
              : <Text style={styles.btnText}>{t('auth.login.signIn')}</Text>
            }
          </Tappable>

          <Tappable onPress={onGoToSignup} style={styles.switchLink}>
            <Text style={styles.switchText}>
              {t('auth.login.noAccount')} <Text style={styles.switchHighlight}>{t('auth.login.signUp')}</Text>
            </Text>
          </Tappable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 64, height: 64, borderRadius: 14, marginBottom: 24, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1, marginBottom: 8 },
  sub: { fontSize: 15, color: colors.textSubtle, marginBottom: 40 },
  label: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  inputWrap: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border },
  inputInner: { padding: 16, color: colors.textPrimary, fontSize: 16, backgroundColor: 'transparent' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: colors.textSubtle },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: colors.surfaceRaised, fontSize: 16, fontWeight: '600' },
  switchLink: { alignItems: 'center', marginTop: 20 },
  switchText: { color: colors.textSubtle, fontSize: 14 },
  switchHighlight: { color: colors.textPrimary, fontWeight: '600' },
  forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 13, color: colors.textPrimary },
  sentBox: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: colors.accent, marginTop: 8 },
  sentTitle: { fontSize: 16, fontWeight: '700', color: colors.accent, marginBottom: 8 },
  sentText: { fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 20 },
});
