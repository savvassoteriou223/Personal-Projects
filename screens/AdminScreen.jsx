import {
  useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Modal,
} from 'react-native';
import { supabase } from '../supabase';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

export default function AdminScreen({ visible, onClose }) {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) fetchEmails();
  }, [visible]);

  const fetchEmails = async () => {
    const { data, error } = await supabase
      .from('admin_emails')
      .select('id, email, added_at')
      .order('added_at', { ascending: true });
    if (!error) setEmails(data || []);
  };

  const addEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('admin_emails').insert({ email: trimmed });
    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Could not add this email. Please try again.');
      return;
    }
    // Grant premium immediately if they already have an account
    const { error: rpcError } = await supabase.rpc('grant_premium_to_email', { target_email: trimmed });
    if (rpcError) Alert.alert('Warning', 'Added to the list, but premium could not be granted automatically.');
    setNewEmail('');
    fetchEmails();
  };

  const removeEmail = (id, email) => {
    Alert.alert(
      'Remove beta access',
      `Remove ${email}? They will lose premium features on next login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('admin_emails').delete().eq('id', id);
            fetchEmails();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Beta Access</Text>
          <Tappable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Done</Text>
          </Tappable>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={s.sectionLabel}>BETA USERS</Text>
          <Text style={s.sectionSub}>These users get full premium access for free.</Text>

          {emails.map((item) => (
            <View key={item.id} style={s.emailRow}>
              <Text style={s.emailText}>{item.email}</Text>
              <Tappable onPress={() => removeEmail(item.id, item.email)} style={s.removeBtn}>
                <Text style={s.removeBtnText}>Remove</Text>
              </Tappable>
            </View>
          ))}

          {emails.length === 0 && (
            <Text style={s.empty}>No beta users yet.</Text>
          )}

          <Text style={[s.sectionLabel, { marginTop: 32 }]}>ADD BETA USER</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={addEmail}
            />
            <Tappable style={[s.addBtn, loading && { opacity: 0.5 }]} onPress={addEmail} disabled={loading}>
              <Text style={s.addBtnText}>Add</Text>
            </Tappable>
          </View>

          <View style={s.noteCard}>
            <Text style={s.noteText}>If the user already has an account, they get access immediately. New accounts get access automatically when they sign up with this email.</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  closeBtn: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  closeBtnText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  scroll: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 11, color: colors.textSubtle, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  sectionSub: { fontSize: 13, color: colors.textSubtle, marginBottom: 16, lineHeight: 20 },
  emailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: colors.border },
  emailText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  removeBtn: { marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.dangerBg, borderRadius: 8, borderWidth: 0.5, borderColor: colors.dangerHair },
  removeBtnText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  empty: { color: colors.textSubtle, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 14, color: colors.textPrimary, fontSize: 15 },
  addBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addBtnText: { color: colors.surfaceRaised, fontWeight: '600', fontSize: 14 },
  noteCard: { marginTop: 24, backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#FFFFFF1A' },
  noteText: { fontSize: 12, color: colors.textSubtle, lineHeight: 18 },
});
