import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';

export default function LoginScreen({ onLogin, onGoToSignup, onGoBack, onRecovery }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lastCharVisible, setLastCharVisible] = useState(false);
  const maskTimer = useRef(null);
  const prevPasswordLen = useRef(0);

  const handlePasswordChange = (newMasked) => {
    const prevLen = prevPasswordLen.current;
    const newLen = newMasked.length;
    let newActual;
    if (newLen > prevLen) {
      const added = newMasked.slice(prevLen);
      newActual = password + added;
      setLastCharVisible(true);
      if (maskTimer.current) clearTimeout(maskTimer.current);
      maskTimer.current = setTimeout(() => setLastCharVisible(false), 700);
    } else {
      newActual = password.slice(0, newLen);
      setLastCharVisible(false);
      if (maskTimer.current) clearTimeout(maskTimer.current);
    }
    prevPasswordLen.current = newLen;
    setPassword(newActual);
  };

  const displayPassword = showPassword
    ? password
    : password.length === 0
      ? ''
      : '•'.repeat(password.length - (lastCharVisible ? 1 : 0)) + (lastCharVisible ? password[password.length - 1] : '');
  const [mode, setMode] = useState('login');

 // 'login' | 'reset' | 'reset_code'
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      // SIGNED_IN event navigates away. Fallback in case it never fires.
      setTimeout(() => setLoading(false), 8000);
    } catch (e) {
      setError(e.message || 'Sign in failed.');
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email address.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMode('reset_code');
  };

  const handleResetCode = async () => {
    if (!resetCode) { setError('Enter the code from your email.'); return; }
    setLoading(true);
    setError('');
    onRecovery && onRecovery();
    const { error } = await supabase.auth.verifyOtp({ email, token: resetCode.trim(), type: 'email' });
    setLoading(false);
    if (error) { onRecovery && onRecovery(false); setError('Invalid or expired code.'); return; }
  };

  const switchToReset = () => { setMode('reset'); setError(''); setResetSent(false); setResetCode(''); };
  const switchToLogin = () => { setMode('login'); setError(''); setResetSent(false); setResetCode(''); };

  if (mode === 'reset_code') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={switchToReset} style={{ paddingBottom: 24 }}>
              <Text style={{ color: '#71717A', fontSize: 15 }}>← Back</Text>
            </Pressable>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.sub}>Enter the 6-digit code we sent to {email}.</Text>

            <Text style={styles.label}>Code</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInner}
                value={resetCode}
                onChangeText={setResetCode}
                placeholder="Enter code"
                placeholderTextColor="#3D3D4A"
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
                : <Text style={styles.btnText}>Verify</Text>
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
              <Text style={{ color: '#71717A', fontSize: 15 }}>← Back to sign in</Text>
            </Pressable>

            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.sub}>We'll send a reset link to your email.</Text>

            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.inputInner}
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                placeholderTextColor="#3D3D4A"
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
                : <Text style={styles.btnText}>Send reset code</Text>
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
            <Text style={{ color: '#71717A', fontSize: 15 }}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your Helix account</Text>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.inputInner}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#3D3D4A"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.inputInner, { flex: 1 }]}
              value={displayPassword}
              onChangeText={handlePasswordChange}
              placeholder="Your password"
              placeholderTextColor="#3D3D4A"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Pressable onPress={switchToReset} style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#111114" />
              : <Text style={styles.btnText}>Sign in</Text>
            }
          </Pressable>

          <Pressable onPress={onGoToSignup} style={styles.switchLink}>
            <Text style={styles.switchText}>
              Don't have an account? <Text style={styles.switchHighlight}>Sign up</Text>
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
  sub: { fontSize: 15, color: '#71717A', marginBottom: 40 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  inputWrap: { backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  inputInner: { padding: 16, color: '#FFFFFF', fontSize: 16, backgroundColor: 'transparent' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: '#71717A' },
  error: { color: '#E24B4A', fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  switchLink: { alignItems: 'center', marginTop: 20 },
  switchText: { color: '#71717A', fontSize: 14 },
  switchHighlight: { color: '#FFFFFF', fontWeight: '600' },
  forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 13, color: '#FFFFFF' },
  sentBox: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#1D9E75', marginTop: 8 },
  sentTitle: { fontSize: 16, fontWeight: '700', color: '#1D9E75', marginBottom: 8 },
  sentText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22, marginBottom: 20 },
});
