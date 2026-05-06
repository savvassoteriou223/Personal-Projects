import { View, Text, StyleSheet, Pressable, Image } from 'react-native';

export default function WelcomeScreen({ onGetStarted, onLogin }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Helix</Text>
        <Text style={styles.sub}>
          Science-based training, smart nutrition,{'\n'}and AI coaching in one place.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.8 }]}
          onPress={onGetStarted}
        >
          <Text style={styles.btnPrimaryText}>Get started</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.8 }]}
          onPress={onLogin}
        >
          <Text style={styles.btnSecondaryText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13', justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logo: { width: 100, height: 100, borderRadius: 22, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '300', color: '#FFFFFF', letterSpacing: 8, marginTop: 8 },
  sub: { fontSize: 15, color: '#71717A', textAlign: 'center', lineHeight: 24 },
  buttons: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  btnPrimary: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnSecondary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#3D3D4A' },
  btnSecondaryText: { color: '#71717A', fontSize: 16 },
});