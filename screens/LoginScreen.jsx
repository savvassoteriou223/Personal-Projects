import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../supabase';

export default function LoginScreen({ onLogin, onGoToSignup, onGoBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError('');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const { error } = await supabase.auth.signInWithPassword(
        { email, password },
        { fetchOptions: { signal: controller.signal } }
      );
      clearTimeout(timer);
      if (error) { setError(error.message); return; }
      onLogin && onLogin();
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError' || e.message?.includes('abort')) {
        setError('Connection timed out. Please try again.');
      } else {
        setError(e.message || 'Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email address.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'helix://reset-password',
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResetSent(true);
  };

  const switchToReset = () => {
    setMode('reset');
    setError('');
    setResetSent(false);
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setResetSent(false);
  };

  if (mode === 'reset') {
    return (
      <View style={styles.container}>
        <Pressable onPress={switchToLogin} style={{ paddingBottom: 24 }}>
          <Text style={{ color: '#71717A', fontSize: 15 }}>← Back to sign in</Text>
        </Pressable>

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.sub}>We'll send a reset link to your email.</Text>

        {resetSent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentTitle}>Check your email</Text>
            <Text style={styles.sentText}>
              A reset link has been sent to {email}. Follow the link to set a new password.
            </Text>
            <Pressable style={styles.btn} onPress={switchToLogin}>
              <Text style={styles.btnText}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#3D3D4A"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnText}>Send reset link</Text>
              }
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={onGoBack} style={{ paddingBottom: 24 }}>
        <Text style={{ color: '#71717A', fontSize: 15 }}>← Back</Text>
      </Pressable>

      <Image source={require('../assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.sub}>Sign in to your Helix account</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@email.com"
        placeholderTextColor="#3D3D4A"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0 }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor="#3D3D4A"
          secureTextEntry={!showPassword}
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
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.btnText}>Sign in</Text>
        }
      </Pressable>

      <Pressable onPress={onGoToSignup} style={styles.switchLink}>
        <Text style={styles.switchText}>
          Don't have an account? <Text style={styles.switchHighlight}>Sign up</Text>
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13', padding: 24, justifyContent: 'center' },
  logo: { width: 64, height: 64, borderRadius: 14, marginBottom: 24, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, marginBottom: 8 },
  sub: { fontSize: 15, color: '#71717A', marginBottom: 40 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35', padding: 16, color: '#FFFFFF', fontSize: 16 },
  error: { color: '#E24B4A', fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  switchLink: { alignItems: 'center', marginTop: 20 },
  switchText: { color: '#71717A', fontSize: 14 },
  switchHighlight: { color: '#534AB7', fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: '#71717A' },
  forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 13, color: '#534AB7' },
  sentBox: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#1D9E75', marginTop: 8 },
  sentTitle: { fontSize: 16, fontWeight: '700', color: '#1D9E75', marginBottom: 8 },
  sentText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22, marginBottom: 20 },
});
