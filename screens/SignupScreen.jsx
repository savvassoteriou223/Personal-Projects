import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../supabase';

export default function SignupScreen({ onSignup, onGoToLogin, onGoBack }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !age || !sex || !password || !confirm) {
      setError('Please fill in all fields.'); return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 100) {
      setError('Please enter a valid age (13–100).'); return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, age: ageNum, sex },
        emailRedirectTo: 'helix://',
      },
    });

    setLoading(false);
    if (signUpError) { setError(signUpError.message); return; }
    if (data.session) {
      // Email confirmation is disabled — session is live immediately,
      // onAuthStateChange will fire and route to onboarding automatically
    } else {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <View style={[styles.container, { padding: 24, justifyContent: 'center', flex: 1 }]}>
        <View style={styles.sentBox}>
          <Text style={styles.sentTitle}>Check your email</Text>
          <Text style={styles.sentText}>
            We sent a confirmation link to {email}. Tap it to activate your account — it only takes a second.
          </Text>
        </View>
        <Pressable onPress={onGoToLogin} style={[styles.btn, { marginTop: 24 }]}>
          <Text style={styles.btnText}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, justifyContent: 'center', flexGrow: 1 }}>
      <Pressable onPress={onGoBack} style={{ paddingBottom: 24 }}>
        <Text style={{ color: '#71717A', fontSize: 15 }}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Create account</Text>
      <Text style={styles.sub}>Free forever. Upgrade when you're ready.</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Alex"
        placeholderTextColor="#3D3D4A"
        autoCapitalize="words"
      />

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

      <View style={styles.row}>
        <View style={styles.rowHalf}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="25"
            placeholderTextColor="#3D3D4A"
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <View style={styles.rowHalf}>
          <Text style={styles.label}>Sex</Text>
          <View style={styles.sexRow}>
            {['Male', 'Female'].map(s => (
              <Pressable
                key={s}
                style={[styles.sexBtn, sex === s.toLowerCase() && styles.sexBtnActive]}
                onPress={() => setSex(s.toLowerCase())}
              >
                <Text style={[styles.sexBtnText, sex === s.toLowerCase() && styles.sexBtnTextActive]}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0 }]}
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 8 characters"
          placeholderTextColor="#3D3D4A"
          secureTextEntry={!showPassword}
        />
        <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Confirm password</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0 }]}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat password"
          placeholderTextColor="#3D3D4A"
          secureTextEntry={!showConfirm}
        />
        <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
          <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.btnText}>Create account</Text>
        }
      </Pressable>

      <Text style={styles.legal}>
        By signing up you agree to our Terms of Service and Privacy Policy.
      </Text>

      <Pressable onPress={onGoToLogin} style={styles.switchLink}>
        <Text style={styles.switchText}>
          Already have an account? <Text style={styles.switchHighlight}>Sign in</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  title: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1, marginBottom: 8 },
  sub: { fontSize: 15, color: '#71717A', marginBottom: 40 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35', padding: 16, color: '#FFFFFF', fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  rowHalf: { flex: 1 },
  sexRow: { flexDirection: 'row', gap: 8, marginTop: 0 },
  sexBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35', paddingVertical: 16, alignItems: 'center' },
  sexBtnActive: { backgroundColor: '#1A1830', borderColor: '#534AB7' },
  sexBtnText: { fontSize: 15, color: '#71717A', fontWeight: '500' },
  sexBtnTextActive: { color: '#7F77DD', fontWeight: '600' },
  error: { color: '#E24B4A', fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  legal: { fontSize: 12, color: '#3D3D4A', textAlign: 'center', marginTop: 16, lineHeight: 18 },
  switchLink: { alignItems: 'center', marginTop: 16 },
  switchText: { color: '#71717A', fontSize: 14 },
  switchHighlight: { color: '#534AB7', fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  eyeBtn: { paddingHorizontal: 14 },
  eyeText: { fontSize: 13, color: '#71717A' },
  sentBox: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#1D9E75' },
  sentTitle: { fontSize: 16, fontWeight: '700', color: '#1D9E75', marginBottom: 8 },
  sentText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22 },
});
