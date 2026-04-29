import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { supabase } from '../supabase';
import { format } from 'date-fns';

export default function WorkoutsScreen({ onStartWorkout }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setSessions(data);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <Pressable style={styles.startBtn} onPress={onStartWorkout}>
          <Text style={styles.startBtnText}>+ Start workout</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8 }}>
        {!loading && sessions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No workouts logged yet.</Text>
            <Text style={styles.emptySub}>Start a workout to see your history here.</Text>
          </View>
        ) : (
          sessions.map(s => (
            <View key={s.id} style={styles.sessionCard}>
              <View>
                <Text style={styles.sessionName}>{s.name}</Text>
                <Text style={styles.sessionDate}>
                  {format(new Date(s.created_at), 'EEE, MMM d · h:mm a')}
                </Text>
              </View>
              <View style={styles.sessionRight}>
                {s.duration_min > 0 && <Text style={styles.sessionDuration}>{s.duration_min} min</Text>}
                {s.perceived_exertion && <Text style={styles.sessionRpe}>RPE {s.perceived_exertion}</Text>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  startBtn: { backgroundColor: '#534AB7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  startBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '500', marginBottom: 8 },
  emptySub: { color: '#71717A', fontSize: 14, textAlign: 'center' },
  sessionCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  sessionDate: { fontSize: 13, color: '#71717A' },
  sessionRight: { alignItems: 'flex-end' },
  sessionDuration: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  sessionRpe: { fontSize: 12, color: '#71717A', marginTop: 2 },
});