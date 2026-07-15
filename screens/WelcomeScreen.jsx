import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import LanguagePicker from '../components/LanguagePicker';
import { LANGUAGES } from '../lib/i18n';

export default function WelcomeScreen({ onGetStarted, onLogin }) {
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === i18n.language?.split('-')[0]) || LANGUAGES[0];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable style={styles.langBtn} onPress={() => setLangOpen(true)} hitSlop={8}>
        <Ionicons name="globe-outline" size={16} color="#A1A1AA" />
        <Text style={styles.langBtnText}>{current.label}</Text>
        <Ionicons name="chevron-down" size={14} color="#A1A1AA" />
      </Pressable>

      <View style={styles.top}>
        <Image source={require('../assets/adaptive-icon.png')} style={styles.logo} />
        <Text style={styles.title}>Helix</Text>
        <Text style={styles.sub}>{t('welcome.tagline')}</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.8 }]}
          onPress={onGetStarted}
        >
          <Text style={styles.btnPrimaryText}>{t('welcome.getStarted')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.8 }]}
          onPress={onLogin}
        >
          <Text style={styles.btnSecondaryText}>{t('welcome.haveAccount')}</Text>
        </Pressable>
      </View>

      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'space-between' },
  langBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    borderWidth: 0.5, borderColor: '#3D3D4A', backgroundColor: '#111114',
  },
  langBtnText: { color: '#A1A1AA', fontSize: 13, fontWeight: '500' },
  top: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logo: { width: 200, height: 200, resizeMode: 'contain', marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '300', color: '#FFFFFF', letterSpacing: 8, marginBottom: 10 },
  sub: { fontSize: 15, color: '#8A8A94', textAlign: 'center', lineHeight: 24 },
  buttons: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  btnPrimary: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  btnSecondary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#3D3D4A' },
  btnSecondaryText: { color: '#9494A0', fontSize: 16 },
});
