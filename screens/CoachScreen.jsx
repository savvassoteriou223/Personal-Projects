import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { VOLUME_TARGETS } from './programGenerator';
import { format, subDays } from 'date-fns';

const MONTHLY_QUOTA = 50;

const _MUSCLE_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(p => {
    p.exercises.forEach(ex => { map[ex.name.toLowerCase()] = p.muscles.map(m => m.toLowerCase()); });
  });
  return map;
})();

function normaliseMuscle(r) {
  r = r.toLowerCase();
  if (r === 'chest' || r === 'upper chest' || r === 'lower chest') return 'chest';
  if (r === 'lats' || r === 'lower back' || r === 'traps' || r === 'upper traps' || r === 'upper trapezius' || r === 'levator scapulae') return 'back';
  if (r === 'shoulders' || r === 'anterior delts' || r === 'side deltoids' || r === 'rear delts' || r === 'rear deltoids' || r === 'external rotators') return 'shoulders';
  if (r === 'biceps' || r === 'brachialis') return 'biceps';
  if (r === 'triceps') return 'triceps';
  if (r === 'quads') return 'quads';
  if (r === 'hamstrings') return 'hamstrings';
  if (r === 'glutes' || r === 'glute medius' || r === 'glute minimus') return 'glutes';
  if (r === 'gastrocnemius' || r === 'soleus') return 'calves';
  if (r === 'rectus abdominis' || r === 'obliques') return 'abs';
  return null;
}
function getMuscles(name) {
  return [...new Set((_MUSCLE_MAP[name?.toLowerCase()] || []).map(normaliseMuscle).filter(Boolean))];
}

export default function CoachScreen() {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [userData, setUserData] = useState(null);
  const [quota, setQuota] = useState({ used: 0, remaining: MONTHLY_QUOTA });
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useFocusEffect(useCallback(() => {
    loadUserData();
  }, []));

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, { data: sessions }] = await Promise.all([
      supabase.from('profiles').select('*, ai_calls_used, ai_calls_reset_at').eq('id', user.id).single(),
      supabase.from('workout_sessions').select('id, name, completed_at, duration_min, perceived_exertion')
        .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(20),
    ]);

    if (profile) {
      const used = profile.ai_calls_used ?? 0;
      setQuota({ used, remaining: Math.max(0, MONTHLY_QUOTA - used) });
      setQuotaExceeded(used >= MONTHLY_QUOTA);
    }

    let weeklyVolume = {};
    let prs = {};
    let recentSessions = sessions || [];

    if (sessions?.length) {
      const ids = sessions.map(s => s.id);
      const { data: sets } = await supabase.from('completed_sets')
        .select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);

      if (sets?.length) {
        const sevenDaysAgo = subDays(new Date(), 7);
        const sessionDateMap = {};
        sessions.forEach(s => { sessionDateMap[s.id] = new Date(s.completed_at); });

        sets.forEach(s => {
          const sessionDate = sessionDateMap[s.session_id];
          const muscles = getMuscles(s.exercise_name);
          if (sessionDate >= sevenDaysAgo) {
            muscles.forEach(m => { weeklyVolume[m] = (weeklyVolume[m] || 0) + 1; });
          }
          if (s.weight_kg) {
            if (!prs[s.exercise_name] || s.weight_kg > prs[s.exercise_name].weight) {
              prs[s.exercise_name] = { weight: s.weight_kg, reps: s.reps };
            }
          }
        });
      }
    }

    const data = { profile, weeklyVolume, prs, recentSessions };
    setUserData(data);
    return data;
  };

  const buildContext = (data) => {
    const { profile, weeklyVolume, prs, recentSessions } = data;
    const volumeLines = Object.entries(VOLUME_TARGETS).map(([m, t]) => {
      const done = weeklyVolume[m] || 0;
      const status = done < t.min ? 'under minimum' : done > t.optimal_high ? 'over optimal' : done >= t.optimal_low ? 'optimal' : 'below optimal';
      return `  ${m}: ${done} sets (${status}, target ${t.optimal_low}–${t.optimal_high})`;
    }).join('\n');

    const prLines = Object.entries(prs).slice(0, 15).map(([ex, p]) =>
      `  ${ex}: ${p.weight}kg × ${p.reps || '?'}`
    ).join('\n');

    const sessionLines = recentSessions.slice(0, 5).map(s =>
      `  ${format(new Date(s.completed_at), 'EEE MMM d')}: ${s.name} (${s.duration_min || '?'}min, RPE ${s.perceived_exertion || '?'})`
    ).join('\n');

    return `User profile:
- Name: ${profile?.name || 'unknown'}
- Goal: ${(profile?.goals || []).join(', ') || 'not set'}
- Training: ${profile?.weekly_workouts} days/week, ${profile?.session_length} min sessions
- Weight: ${profile?.weight_kg}kg, Height: ${profile?.height_cm}cm

This week's volume — last 7 days (sets per muscle):
${volumeLines}

Personal records:
${prLines}

Recent sessions:
${sessionLines}`;
  };

  const callCoach = async (question, userContext) => {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { question, userContext },
    });

    if (error) {
      if (error.message?.includes('quota_exceeded') || error.context?.status === 429) {
        setQuotaExceeded(true);
        setQuota(q => ({ ...q, remaining: 0 }));
        return null;
      }
      throw error;
    }

    if (data?.remaining !== undefined) {
      setQuota({ used: data.used, remaining: data.remaining });
      setQuotaExceeded(data.remaining <= 0);
    }

    return data?.text ?? null;
  };

  const generateInsight = async () => {
    if (quotaExceeded) return;
    setLoading(true);
    setInsight(null);
    const data = userData || await loadUserData();
    if (!data) { setLoading(false); return; }

    try {
      const text = await callCoach(
        'Analyse my training this week and give me your top insight.',
        buildContext(data)
      );
      setInsight(text || 'No insight generated.');
    } catch {
      setInsight('Failed to connect. Check your internet connection.');
    }
    setLoading(false);
  };

  const askQuestion = async () => {
    if (!question.trim() || quotaExceeded) return;
    setAsking(true);
    setAnswer(null);
    const data = userData || await loadUserData();

    try {
      const text = await callCoach(question, data ? buildContext(data) : '');
      setAnswer(text || 'No answer generated.');
    } catch {
      setAnswer('Failed to connect.');
    }
    setAsking(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Coach</Text>
        <Text style={styles.subtitle}>Science-based · Powered by Claude</Text>
      </View>

      {/* Quota bar */}
      <View style={styles.quotaCard}>
        <View style={styles.quotaRow}>
          <Text style={styles.quotaLabel}>Monthly messages</Text>
          <Text style={[styles.quotaCount, quotaExceeded && styles.quotaCountExceeded]}>
            {quota.used} / {MONTHLY_QUOTA}
          </Text>
        </View>
        <View style={styles.quotaBarBg}>
          <View
            style={[
              styles.quotaBarFill,
              { width: `${Math.min(100, (quota.used / MONTHLY_QUOTA) * 100)}%` },
              quota.used / MONTHLY_QUOTA > 0.8 && styles.quotaBarWarn,
              quotaExceeded && styles.quotaBarExceeded,
            ]}
          />
        </View>
        {quotaExceeded && (
          <Text style={styles.quotaExceededText}>
            Monthly limit reached. Resets on the 1st.
          </Text>
        )}
      </View>

      {/* Weekly insight */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly insight</Text>
        <Text style={styles.cardSub}>Analyses your volume, PRs, and recent sessions against research targets</Text>

        {insight ? (
          <View style={styles.insightBox}>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ) : (
          <View style={styles.insightEmpty}>
            <Text style={styles.insightEmptyText}>
              Tap below to get a personalised weekly analysis based on your training data.
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.generateBtn, (loading || quotaExceeded) && styles.btnDisabled]}
          onPress={generateInsight}
          disabled={loading || quotaExceeded}
        >
          <Text style={styles.generateBtnText}>
            {loading ? 'Analysing...' : insight ? 'Refresh insight' : 'Generate insight'}
          </Text>
        </Pressable>
      </View>

      {/* Ask a question */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ask your coach</Text>
        <Text style={styles.cardSub}>Questions about your training, recovery, or programming</Text>

        <TextInput
          style={[styles.questionInput, quotaExceeded && { opacity: 0.4 }]}
          value={quotaExceeded ? '' : question}
          onChangeText={setQuestion}
          placeholder={quotaExceeded ? 'Monthly limit reached' : 'e.g. Should I add more leg volume this week?'}
          placeholderTextColor="#3D3D4A"
          multiline
          numberOfLines={3}
          editable={!quotaExceeded}
        />

        {answer && (
          <View style={styles.answerBox}>
            <Text style={styles.answerText}>{answer}</Text>
          </View>
        )}

        <Pressable
          style={[styles.askBtn, (asking || quotaExceeded) && styles.btnDisabled]}
          onPress={askQuestion}
          disabled={asking || quotaExceeded}
        >
          <Text style={styles.askBtnText}>{asking ? 'Thinking...' : 'Ask'}</Text>
        </Pressable>
      </View>

      {/* Quick question chips */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick questions</Text>
        {[
          'What muscle group am I neglecting most?',
          'Is my training frequency optimal?',
          'Which exercise should I prioritise next session?',
          'Am I recovering enough between sessions?',
        ].map((q, i) => (
          <Pressable
            key={i}
            style={[styles.quickChip, quotaExceeded && styles.quickChipDisabled]}
            onPress={() => { if (!quotaExceeded) setQuestion(q); }}
          >
            <Text style={styles.quickChipText}>{q}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { padding: 24, paddingTop: 56 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#71717A', marginTop: 4 },

  quotaCard: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 14 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  quotaLabel: { fontSize: 12, color: '#71717A' },
  quotaCount: { fontSize: 12, fontWeight: '600', color: '#A89FE8' },
  quotaCountExceeded: { color: '#E24B4A' },
  quotaBarBg: { height: 4, backgroundColor: '#2C2C35', borderRadius: 2 },
  quotaBarFill: { height: 4, backgroundColor: '#534AB7', borderRadius: 2 },
  quotaBarWarn: { backgroundColor: '#BA7517' },
  quotaBarExceeded: { backgroundColor: '#E24B4A' },
  quotaExceededText: { fontSize: 11, color: '#E24B4A', marginTop: 8 },

  card: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  cardSub: { fontSize: 11, color: '#71717A', marginBottom: 14 },

  insightBox: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: '#534AB7' },
  insightText: { fontSize: 13, color: '#FFFFFF', lineHeight: 21 },
  insightEmpty: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 14 },
  insightEmptyText: { fontSize: 13, color: '#71717A', lineHeight: 20 },

  generateBtn: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#2C2C35' },
  generateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  questionInput: { backgroundColor: '#12121A', borderRadius: 12, padding: 12, color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 12, minHeight: 72, textAlignVertical: 'top', borderWidth: 0.5, borderColor: '#2C2C35' },
  answerBox: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#1D9E75' },
  answerText: { fontSize: 13, color: '#FFFFFF', lineHeight: 21 },
  askBtn: { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  askBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  quickChip: { backgroundColor: '#12121A', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  quickChipDisabled: { opacity: 0.4 },
  quickChipText: { fontSize: 13, color: '#A1A1AA' },
});
