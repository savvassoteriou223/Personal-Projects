import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { supabase } from '../supabase';

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
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={s.sectionLabel}>BETA USERS</Text>
          <Text style={s.sectionSub}>These users get full premium access for free.</Text>

          {emails.map((item) => (
            <View key={item.id} style={s.emailRow}>
              <Text style={s.emailText}>{item.email}</Text>
              <Pressable onPress={() => removeEmail(item.id, item.email)} style={s.removeBtn}>
                <Text style={s.removeBtnText}>Remove</Text>
              </Pressable>
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
              placeholderTextColor="#3D3D4A"
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={addEmail}
            />
            <Pressable style={[s.addBtn, loading && { opacity: 0.5 }]} onPress={addEmail} disabled={loading}>
              <Text style={s.addBtnText}>Add</Text>
            </Pressable>
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
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  closeBtn: { backgroundColor: '#1A1A20', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  closeBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  scroll: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 11, color: '#71717A', fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  sectionSub: { fontSize: 13, color: '#71717A', marginBottom: 16, lineHeight: 20 },
  emailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  emailText: { fontSize: 14, color: '#FFFFFF', flex: 1 },
  removeBtn: { marginLeft: 12, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2C1A1A', borderRadius: 8, borderWidth: 0.5, borderColor: '#E24B4A44' },
  removeBtnText: { color: '#E24B4A', fontSize: 12, fontWeight: '600' },
  empty: { color: '#71717A', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35', padding: 14, color: '#FFFFFF', fontSize: 15 },
  addBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addBtnText: { color: '#111114', fontWeight: '600', fontSize: 14 },
  noteCard: { marginTop: 24, backgroundColor: '#111114', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#FFFFFF1A' },
  noteText: { fontSize: 12, color: '#71717A', lineHeight: 18 },
});
