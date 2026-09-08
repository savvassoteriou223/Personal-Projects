// Reusable language picker — a modal list of supported languages.
// Used during account setup (WelcomeScreen) and from Profile settings.
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '../lib/i18n';

export default function LanguagePicker({ visible, onClose }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language?.split('-')[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>{t('language.title')}</Text>
          {LANGUAGES.map(lang => {
            const active = current === lang.code;
            return (
              <Pressable
                key={lang.code}
                style={[s.row, active && s.rowActive]}
                onPress={async () => { await setLanguage(lang.code); onClose?.(); }}
              >
                <Text style={[s.label, active && s.labelActive]}>{lang.label}</Text>
                {active && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#18181F', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3D3D4A', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8,
    backgroundColor: '#111114', borderWidth: 0.5, borderColor: '#2C2C35',
  },
  rowActive: { borderColor: '#FFFFFF', backgroundColor: '#1C1C22' },
  label: { fontSize: 16, color: '#A1A1AA' },
  labelActive: { color: '#FFFFFF', fontWeight: '600' },
});
