import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen({ onGetStarted, onLogin }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Image source={require('../assets/adaptive-icon.png')} style={styles.logo} />
        <Text style={styles.title}>Helix</Text>
        <Text style={styles.sub}>Science-based training, smart nutrition,{'\n'}and AI coaching in one place.</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'space-between' },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logo: { width: 200, height: 200, resizeMode: 'contain', marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '300', color: '#FFFFFF', letterSpacing: 8, marginBottom: 10 },
  sub: { fontSize: 15, color: '#52525B', textAlign: 'center', lineHeight: 24 },
  buttons: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  btnPrimary: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  btnSecondary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#3D3D4A' },
  btnSecondaryText: { color: '#71717A', fontSize: 16 },
});
