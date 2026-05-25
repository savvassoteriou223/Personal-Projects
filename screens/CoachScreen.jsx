import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, getCurrentUser } from '../supabase';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { VOLUME_TARGETS, generateProgram } from './programGenerator';
import { format, subDays } from 'date-fns';

const MONTHLY_QUOTA = 100;

const _MUSCLE_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(p => {
    p.exercises.forEach(ex => { map[ex.name.toLowerCase()] = p.muscles.map(m => m.toLowerCase()); });
  });
  return map;
})();

// Maps exercise → only its PRIMARY muscle (first in the pattern list).
// Used for weekly volume counting so that rows/pulldowns don't inflate biceps
// and bench press doesn't inflate triceps — matching VOLUME_TARGETS design intent.
const _PRIMARY_MUSCLE_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(p => {
    const primary = normaliseMuscle(p.muscles[0]);
    if (primary) p.exercises.forEach(ex => { map[ex.name.toLowerCase()] = primary; });
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
function getPrimaryMuscle(name) {
  return _PRIMARY_MUSCLE_MAP[name?.toLowerCase()] || null;
}

export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [confirmingIndex, setConfirmingIndex] = useState(null);
  const [proposalSaved, setProposalSaved] = useState(false);
  const [userData, setUserData] = useState(null);
  const [quota, setQuota] = useState({ used: 0, remaining: MONTHLY_QUOTA });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);

  useFocusEffect(useCallback(() => {
    loadUserData();
  }, []));

  const loadUserData = async () => {
    const user = await getCurrentUser();
    if (!user) return;

    const [{ data: profile }, { data: sessions }] = await Promise.all([
      supabase.from('profiles').select('*, ai_calls_used, ai_calls_reset_at').eq('id', user.id).single(),
      supabase.from('workout_sessions').select('id, name, completed_at, duration_min, perceived_exertion')
        .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(20),
    ]);

    if (profile) {
      const resetAt = profile.ai_calls_reset_at ? new Date(profile.ai_calls_reset_at) : null;
      const now = new Date();
      const isNewMonth = !resetAt ||
        now.getUTCFullYear() !== resetAt.getUTCFullYear() ||
        now.getUTCMonth() !== resetAt.getUTCMonth();
      const used = isNewMonth ? 0 : (profile.ai_calls_used ?? 0);
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
          if (sessionDate >= sevenDaysAgo) {
            const primary = getPrimaryMuscle(s.exercise_name);
            if (primary) weeklyVolume[primary] = (weeklyVolume[primary] || 0) + 1;
          }
          if (s.weight_kg) {
            if (!prs[s.exercise_name] || s.weight_kg > prs[s.exercise_name].weight) {
              prs[s.exercise_name] = { weight: s.weight_kg, reps: s.reps };
            }
          }
        });
      }
    }

    // Load current block so program context matches what the user actually sees
    const { data: block } = await supabase
      .from('program_blocks')
      .select('block_index, block_start_date')
      .eq('user_id', user.id)
      .maybeSingle();

    const blockIndex = block?.block_index || 0;
    const blockStartDate = block?.block_start_date || null;
    const program = profile ? generateProgram(profile, blockIndex, blockStartDate) : null;

    const data = { profile, weeklyVolume, prs, recentSessions, program, blockIndex };
    setUserData(data);
    return data;
  };

  const buildContext = (data) => {
    const { profile, weeklyVolume, prs, recentSessions, program } = data;
    const exp = profile?.trainingExperience || 'intermediate';
    const volumeLines = Object.entries(VOLUME_TARGETS).map(([m, t]) => {
      const target = t[exp] || t.intermediate;
      const done = weeklyVolume[m] || 0;
      const status = done < target.min ? 'under minimum' : done > target.optimal_high ? 'over optimal' : done >= target.optimal_low ? 'optimal' : 'below optimal';
      return `  ${m}: ${done} sets (${status}, target ${target.optimal_low}–${target.optimal_high})`;
    }).join('\n');

    const prLines = Object.entries(prs).slice(0, 15).map(([ex, p]) =>
      `  ${ex}: ${p.weight}kg × ${p.reps || '?'}`
    ).join('\n');

    const sessionLines = recentSessions.slice(0, 5).map(s =>
      `  ${format(new Date(s.completed_at), 'EEE MMM d')}: ${s.name} (${s.duration_min || '?'}min, RPE ${s.perceived_exertion || '?'})`
    ).join('\n');

    const programLines = program
      ? program.days.filter(d => !d.optional).map(day =>
          `  ${day.id} — ${day.name}:\n${day.exercises.map((ex, idx) => {
            const muscles = getMuscles(ex.name);
            const muscleTag = muscles.length ? ` [${muscles.join('/')}]` : '';
            return `    [${idx}] ${ex.name}${muscleTag} (${ex.sets ?? 3}×${ex.reps || '8–12'}, rest ${ex.rest || '2 min'})`;
          }).join('\n')}`
        ).join('\n')
      : '  Program not available';

    return `User profile:
- Name: ${profile?.name || 'unknown'}
- Experience: ${exp}
- Goal: ${(profile?.goals || []).join(', ') || 'not set'}
- Training: ${profile?.weekly_workouts} days/week, ${profile?.session_length} min sessions
- Weight: ${profile?.weight_kg}kg, Height: ${profile?.height_cm}cm

Current program: ${program?.name || 'unknown'} (split ID: ${profile?.selected_split || 'unknown'})
Days and exercises:
${programLines}

This week's volume — last 7 days (sets per muscle):
${volumeLines}

Personal records:
${prLines}

Recent sessions:
${sessionLines}`;
  };

  const callCoach = async (messages, userContext) => {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { messages, userContext },
    });

    if (error) {
      if (error.message?.includes('quota_exceeded') || error.status === 429 || error.context?.status === 429) {
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

    return data ?? null;
  };

  const generateInsight = async () => {
    if (quotaExceeded) return;
    setLoading(true);
    setInsight(null);
    const data = userData || await loadUserData();
    if (!data) { setLoading(false); return; }

    try {
      const result = await callCoach(
        [{ role: 'user', content: 'Analyse my training this week and give me your top insight.' }],
        buildContext(data)
      );
      setInsight(result?.text || 'No insight generated.');
    } catch {
      setInsight('Failed to connect. Check your internet connection.');
    }
    setLoading(false);
  };

  const saveProposal = async (p) => {
    const user = await getCurrentUser();
    if (!user) return false;
    let err;
    if (p.type === 'add_exercise') {
      ({ error: err } = await supabase.from('program_additions').insert({
        user_id: user.id,
        day_id: p.day_id || '',
        exercise_name: p.exercise_name || '',
        sets: p.sets || 3,
        reps: p.reps || '10–15',
        rest: p.rest || '90 sec',
      }));
    } else {
      ({ error: err } = await supabase.from('program_template_overrides').insert({
        user_id: user.id,
        day_id: p.day_id || '',
        exercise_index: p.exercise_index ?? 0,
        edit_type: p.edit_type || 'replace_exercise',
        pattern_key: p.pattern_key || null,
        exercise_id: p.exercise_id || null,
        sets: p.sets || null,
        reps: p.reps || null,
        rpe: p.rpe || null,
        is_session_swap: p.type === 'session_swap',
      }));
    }
    return !err;
  };

  const applyProposal = async (index) => {
    if (confirmingIndex !== null) return;
    setConfirmingIndex(index);
    const ok = await saveProposal(proposals[index]);
    setConfirmingIndex(null);
    if (ok) {
      const remaining = proposals.filter((_, i) => i !== index);
      setProposals(remaining);
      if (remaining.length === 0) setProposalSaved(true);
    }
  };

  const dismissProposal = (index) => {
    setProposals(proposals.filter((_, i) => i !== index));
  };

  const requestAlternative = (p) => {
    const what = p.exercise_name ? `"${p.exercise_name}"` : 'that exercise';
    const where = p.day_name ? ` on ${p.day_name}` : '';
    setQuestion(`Give me an alternative to ${what}${where}`);
    setProposals(proposals.filter(x => x !== p));
  };

  const askQuestion = async () => {
    if (!question.trim() || quotaExceeded) return;
    setAsking(true);
    setAnswer(null);
    setProposals([]);
    setProposalSaved(false);
    const data = userData || await loadUserData();
    const currentQuestion = question.trim();

    const newHistory = [
      ...conversationHistory,
      { role: 'user', content: currentQuestion },
    ];

    try {
      const result = await callCoach(newHistory, data ? buildContext(data) : '');
      const answerText = result?.text || 'No answer generated.';
      setAnswer(answerText);
      if (result?.proposals?.length) {
        setProposals(result.proposals);
      }
      setConversationHistory([
        ...newHistory,
        { role: 'assistant', content: answerText },
      ]);
      setQuestion('');
    } catch {
      setAnswer('Failed to connect.');
    }
    setAsking(false);
  };

  const applyAllProposals = async () => {
    if (!proposals.length || confirmingIndex !== null) return;
    setConfirmingIndex(-1); // -1 = apply-all in progress
    let hadError = false;
    for (const p of proposals) {
      const ok = await saveProposal(p);
      if (!ok) hadError = true;
    }
    setConfirmingIndex(null);
    if (!hadError) {
      setProposalSaved(true);
      setProposals([]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
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
          placeholder={quotaExceeded ? 'Monthly limit reached' : 'e.g. Add more shoulders to my next push day'}
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

        {/* Proposal confirmation card */}
        {proposals.length > 0 && (
          <View style={styles.proposalCard}>
            <Text style={styles.proposalLabel}>
              {proposals.length === 1
                ? (proposals[0].type === 'add_exercise' ? 'Coach proposes adding' : 'Coach proposes changing')
                : `Coach proposes ${proposals.length} changes`}
            </Text>
            {proposals.map((p, i) => (
              <View key={i} style={[styles.proposalItem, i > 0 && styles.proposalItemBorder]}>
                <View style={styles.proposalScopeRow}>
                  <View style={[
                    styles.proposalScopePill,
                    p.type === 'session_swap' && styles.proposalScopePillSession,
                  ]}>
                    <Text style={[
                      styles.proposalScopeText,
                      p.type === 'session_swap' && styles.proposalScopeTextSession,
                    ]}>
                      {p.scope_label || (p.type === 'session_swap' ? 'This session only' : 'Permanent change')}
                    </Text>
                  </View>
                </View>
                {p.exercise_name && (
                  <Text style={styles.proposalExercise}>{p.exercise_name}</Text>
                )}
                {(p.sets || p.reps) && (
                  <Text style={styles.proposalDetail}>
                    {p.sets ? `${p.sets} sets` : ''}{p.sets && p.reps ? ' × ' : ''}{p.reps || ''}{p.rest ? ` · ${p.rest} rest` : ''}
                  </Text>
                )}
                {p.day_name && (
                  <Text style={styles.proposalDay}>{p.day_name}</Text>
                )}
                {p.rationale && (
                  <Text style={styles.proposalRationale}>{p.rationale}</Text>
                )}
                <View style={styles.proposalItemActions}>
                  <Pressable
                    style={[styles.proposalApplyBtn, confirmingIndex !== null && styles.btnDisabled]}
                    onPress={() => applyProposal(i)}
                    disabled={confirmingIndex !== null}
                  >
                    <Text style={styles.proposalApplyText}>
                      {confirmingIndex === i ? 'Saving...' : 'Apply'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.proposalAltBtn}
                    onPress={() => requestAlternative(p)}
                    disabled={confirmingIndex !== null}
                  >
                    <Text style={styles.proposalAltText}>Alternative</Text>
                  </Pressable>
                  <Pressable
                    style={styles.proposalRemoveBtn}
                    onPress={() => dismissProposal(i)}
                    disabled={confirmingIndex !== null}
                  >
                    <Text style={styles.proposalRemoveText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {proposals.length > 1 && (
              <View style={styles.proposalActions}>
                <Pressable
                  style={[styles.confirmBtn, confirmingIndex !== null && styles.btnDisabled]}
                  onPress={applyAllProposals}
                  disabled={confirmingIndex !== null}
                >
                  <Text style={styles.confirmBtnText}>
                    {confirmingIndex === -1 ? 'Saving...' : 'Apply all'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.dismissBtn}
                  onPress={() => setProposals([])}
                >
                  <Text style={styles.dismissBtnText}>Dismiss all</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {proposalSaved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>Added to your program. It will appear in your next workout.</Text>
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
  header: { padding: 24, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#71717A', marginTop: 4 },

  quotaCard: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 14 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  quotaLabel: { fontSize: 12, color: '#71717A' },
  quotaCount: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  quotaCountExceeded: { color: '#E24B4A' },
  quotaBarBg: { height: 4, backgroundColor: '#2C2C35', borderRadius: 2 },
  quotaBarFill: { height: 4, backgroundColor: '#FFFFFF', borderRadius: 2 },
  quotaBarWarn: { backgroundColor: '#BA7517' },
  quotaBarExceeded: { backgroundColor: '#E24B4A' },
  quotaExceededText: { fontSize: 11, color: '#E24B4A', marginTop: 8 },

  card: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  cardSub: { fontSize: 11, color: '#71717A', marginBottom: 14 },

  insightBox: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: '#FFFFFF' },
  insightText: { fontSize: 13, color: '#FFFFFF', lineHeight: 21 },
  insightEmpty: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 14 },
  insightEmptyText: { fontSize: 13, color: '#71717A', lineHeight: 20 },

  generateBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#2C2C35' },
  generateBtnText: { color: '#111114', fontSize: 14, fontWeight: '600' },

  questionInput: { backgroundColor: '#12121A', borderRadius: 12, padding: 12, color: '#FFFFFF', fontSize: 14, lineHeight: 20, marginBottom: 12, minHeight: 72, textAlignVertical: 'top', borderWidth: 0.5, borderColor: '#2C2C35' },
  answerBox: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#1D9E75' },
  answerText: { fontSize: 13, color: '#FFFFFF', lineHeight: 21 },

  proposalCard: { backgroundColor: '#12121A', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#FFFFFF' },
  proposalItem: { paddingTop: 8 },
  proposalItemBorder: { marginTop: 10, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  proposalScopeRow: { flexDirection: 'row', marginBottom: 8 },
  proposalScopePill: { backgroundColor: '#FFFFFF0D', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, borderWidth: 0.5, borderColor: '#FFFFFF' },
  proposalScopePillSession: { backgroundColor: '#BA751722', borderColor: '#BA7517' },
  proposalScopeText: { fontSize: 10, color: '#E4E4E8', fontWeight: '600' },
  proposalScopeTextSession: { color: '#BA7517' },
  proposalLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  proposalExercise: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  proposalDetail: { fontSize: 13, color: '#A1A1AA', marginBottom: 4 },
  proposalDay: { fontSize: 12, color: '#E4E4E8', marginBottom: 8 },
  proposalRationale: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 12 },
  proposalItemActions: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 4 },
  proposalApplyBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  proposalApplyText: { color: '#111114', fontSize: 12, fontWeight: '700' },
  proposalAltBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  proposalAltText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  proposalRemoveBtn: { width: 34, backgroundColor: '#1A1A20', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  proposalRemoveText: { color: '#71717A', fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },

  proposalActions: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  confirmBtnText: { color: '#111114', fontSize: 13, fontWeight: '600' },
  dismissBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  dismissBtnText: { color: '#71717A', fontSize: 13, fontWeight: '500' },

  savedBanner: { backgroundColor: '#0D1F18', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 0.5, borderColor: '#1D9E75' },
  savedBannerText: { fontSize: 13, color: '#1D9E75', lineHeight: 18 },

  askBtn: { backgroundColor: '#1D9E75', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  askBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  quickChip: { backgroundColor: '#12121A', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  quickChipDisabled: { opacity: 0.4 },
  quickChipText: { fontSize: 13, color: '#A1A1AA' },
});
