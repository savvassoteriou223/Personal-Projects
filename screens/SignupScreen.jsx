import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '../supabase';

export default function SignupScreen({ onSignup, onGoToLogin, onGoBack }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSignup = async () => {
  if (!name || !email || !password || !confirm) { setError('Please fill in all fields.'); return; }
  if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
  if (password !== confirm) { setError('Passwords do not match.'); return; }
  setLoading(true);
  setError('');

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (signUpError) { setError(signUpError.message); setLoading(false); return; }

  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      name,
      email,
    });
    if (profileError) { setError(profileError.message); setLoading(false); return; }
  }

  setLoading(false);
  onSignup && onSignup();
};

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
});