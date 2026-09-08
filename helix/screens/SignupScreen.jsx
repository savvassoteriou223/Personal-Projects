import {
  useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { friendlyAuthError } from '../lib/errorMessage';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

export default function SignupScreen({ onSignup, onGoToLogin, onGoBack }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [sex, setSex] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const monthRef = useRef();
  const yearRef = useRef();

  const handleSignup = async () => {
    if (!name || !email || !dobDay || !dobMonth || !dobYear || !sex || !password || !confirm) {
      setError(t('auth.errors.fillAll')); return;
    }
    const day = parseInt(dobDay, 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear, 10);
    const now = new Date();
    if (
      isNaN(day) || isNaN(month) || isNaN(year) ||
      day < 1 || day > 31 || month < 1 || month > 12 ||
      year < 1900 || year > now.getFullYear()
    ) {
      setError(t('auth.errors.validDob')); return;
    }
    const dob = new Date(year, month - 1, day);
    if (dob.getMonth() + 1 !== month || dob.getDate() !== day) {
      setError(t('auth.errors.validDob')); return;
    }
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
    if (age < 13 || age > 120) { setError(t('auth.errors.minAge')); return; }

    if (password.length < 8) { setError(t('auth.errors.passwordShort')); return; }
    if (password !== confirm) { setError(t('auth.errors.passwordMismatch')); return; }

    setLoading(true);
    setError('');

    const dobStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, age, dob: dobStr, sex },
        emailRedirectTo: Linking.createURL('auth/confirm'),
      },
    });

    setLoading(false);
    if (signUpError) { setError(friendlyAuthError(signUpError, t)); return; }
    if (data.session) {
      // Email confirmation disabled — navigate immediately.
      onSignup && onSignup();
    } else {
      // Email confirmation on — user must confirm before session is created.
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView style={[styles.container, { padding: 24, justifyContent: 'center', flex: 1 }]} edges={['top', 'bottom']}>
        <View style={styles.sentBox}>
          <Text style={styles.sentTitle}>{t('auth.emailSent.title')}</Text>
          <Text style={styles.sentText}>
            {t('auth.emailSent.text', { email })}
          </Text>
        </View>
        <Tappable onPress={onGoToLogin} style={[styles.btn, { marginTop: 24 }]}>
          <Text style={styles.btnText}>{t('auth.backToSignIn')}</Text>
        </Tappable>
        <Tappable
          onPress={async () => {
            const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
            if (resendError) {
              Alert.alert(t('auth.emailSent.resendFailTitle'), friendlyAuthError(resendError, t));
            } else {
              Alert.alert(t('auth.emailSent.resendOkTitle'), t('auth.emailSent.resendOkMsg', { email }));
            }
          }}
          style={{ alignItems: 'center', marginTop: 16 }}
        >
          <Text style={{ color: colors.textSubtle, fontSize: 14 }}>{t('auth.emailSent.resend')}</Text>
        </Tappable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Tappable onPress={onGoBack} style={{ paddingBottom: 24 }}>
            <Text style={{ color: colors.textSubtle, fontSize: 15 }}>← {t('auth.back')}</Text>
          </Tappable>

          <Text style={styles.title}>{t('auth.signup.title')}</Text>
          <Text style={styles.sub}>{t('auth.signup.subtitle')}</Text>

          <Text style={styles.label}>{t('auth.signup.name')}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={name}
              onChangeText={setName}
              placeholder={t('auth.signup.namePlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

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
              returnKeyType="next"
            />
          </View>

          <Text style={styles.label}>{t('auth.signup.dob')}</Text>
          <View style={styles.dobRow}>
            <View style={[styles.inputWrap, styles.dobDay]}>
              <TextInput
                style={styles.inputInner}
                value={dobDay}
                onChangeText={v => { setDobDay(v.replace(/\D/g, '')); if (v.length >= 2) monthRef.current?.focus(); }}
                placeholder="DD"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
            </View>
            <View style={[styles.inputWrap, styles.dobMonth]}>
              <TextInput
                ref={monthRef}
                style={styles.inputInner}
                value={dobMonth}
                onChangeText={v => { setDobMonth(v.replace(/\D/g, '')); if (v.length >= 2) yearRef.current?.focus(); }}
                placeholder="MM"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
            </View>
            <View style={[styles.inputWrap, styles.dobYear]}>
              <TextInput
                ref={yearRef}
                style={styles.inputInner}
                value={dobYear}
                onChangeText={v => setDobYear(v.replace(/\D/g, ''))}
                placeholder="YYYY"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="next"
              />
            </View>
          </View>

          <Text style={styles.label}>{t('auth.signup.sex')}</Text>
          <Text style={styles.inputSub}>{t('auth.signup.sexSub')}</Text>
          <View style={styles.sexRow}>
            {[['male', t('auth.signup.male')], ['female', t('auth.signup.female')], ['other', t('auth.signup.other')]].map(([val, label]) => (
              <Tappable
                key={val}
                style={[styles.sexBtn, sex === val && styles.sexBtnActive]}
                onPress={() => setSex(val)}
              >
                <Text style={[styles.sexBtnText, sex === val && styles.sexBtnTextActive]}>{label}</Text>
              </Tappable>
            ))}
          </View>

          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.inputInner, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder={t('auth.signup.minChars')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="next"
            />
            <Tappable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? t('auth.hide') : t('auth.show')}</Text>
            </Tappable>
          </View>

          <Text style={styles.label}>{t('auth.signup.confirmPassword')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.inputInner, { flex: 1 }]}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              placeholder={t('auth.signup.confirmPlaceholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
            />
            <Tappable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showConfirm ? t('auth.hide') : t('auth.show')}</Text>
            </Tappable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Tappable
            style={styles.btn}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.surfaceRaised} />
              : <Text style={styles.btnText}>{t('auth.signup.createAccount')}</Text>
            }
          </Tappable>

          <Text style={styles.legal}>
            {t('auth.signup.legal')}
          </Text>

          <Tappable onPress={onGoToLogin} style={styles.switchLink}>
            <Text style={styles.switchText}>
              {t('auth.signup.haveAccount')} <Text style={styles.switchHighlight}>{t('auth.signup.signIn')}</Text>
            </Text>
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
  inputSub: { fontSize: 12, color: colors.textFaint, marginTop: -4, marginBottom: 8 },
  inputWrap: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border },
  inputInner: { padding: 16, color: colors.textPrimary, fontSize: 16, backgroundColor: 'transparent' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: colors.textSubtle },
  dobRow: { flexDirection: 'row', gap: 8 },
  dobDay: { width: 64 },
  dobMonth: { width: 64 },
  dobYear: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  rowHalf: { flex: 1 },
  sexRow: { flexDirection: 'row', gap: 8, marginTop: 0 },
  sexBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, paddingVertical: 16, alignItems: 'center' },
  sexBtnActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderActive },
  sexBtnText: { fontSize: 15, color: colors.textSubtle, fontWeight: '500' },
  sexBtnTextActive: { color: colors.textSecondary, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: colors.surfaceRaised, fontSize: 16, fontWeight: '600' },
  legal: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  switchLink: { alignItems: 'center', marginTop: 16 },
  switchText: { color: colors.textSubtle, fontSize: 14 },
  switchHighlight: { color: colors.textPrimary, fontWeight: '600' },
  sentBox: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: colors.accent },
  sentTitle: { fontSize: 16, fontWeight: '700', color: colors.accent, marginBottom: 8 },
  sentText: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
});
