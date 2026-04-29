import { View, Text, StyleSheet, Pressable } from 'react-native';


function Logo({ size = 80 }) {
  return (
    <View style={{ alignItems: 'flex-start', justifyContent: 'center' }}>
      <View>
        <Text style={{
          position: 'absolute', top: -6, left: size * 0.42,
          fontSize: 12, fontWeight: '500', color: '#7F77DD', letterSpacing: 3,
        }}>IQ</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <View style={{
            width: 2.5, height: size * 0.55,
            backgroundColor: 'white', borderRadius: 1.5,
          }} />
          <View style={{
            width: size * 0.42, height: 2.5,
            backgroundColor: 'white', borderRadius: 1.5,
          }} />
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen({ onGetStarted, onLogin }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Logo size={72} />
        <Text style={styles.title}>LiftIQ</Text>
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
  logoOuter: { backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center', marginBottom: 24, padding: 14 },
  logoInner: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginBottom: 4 },
  bar: { backgroundColor: '#FFFFFF', borderRadius: 3 },
  iqDot: { backgroundColor: '#FFFFFF', position: 'absolute', bottom: 10, right: 12 },
  title: { fontSize: 32, fontWeight: '300', color: '#FFFFFF', letterSpacing: 8, marginTop: 16 },
  sub: { fontSize: 15, color: '#71717A', textAlign: 'center', lineHeight: 24 },
  buttons: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  btnPrimary: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  btnSecondary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#3D3D4A' },
  btnSecondaryText: { color: '#71717A', fontSize: 16 },
});