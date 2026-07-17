import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import { MOVEMENT_PATTERNS, getAllExercisesForPattern } from './movementLibrary';
import { formatEvidenceBase } from './studiesLibrary';
import { VOLUME_TARGETS, generateProgram, resolveExerciseByName, normalizeEquipment, applyPermanentEdit, applyContraindicationFilters, getConditionsFromInjuryProfile, computeDislikedExerciseIds, dislikedExerciseIdsFromNotes, rebalanceForCompletedOptionalDays } from './programGenerator';
import { computeHeadVolume } from './volumeEngine';
import { getRecentCheckIns } from '../lib/recoveryStore';
import { format, subDays, startOfWeek } from 'date-fns';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

const MONTHLY_QUOTA = 100;

// Which week's review the user has dismissed. Local, not a DB column: it's a UI
// preference, and the summary itself already persists in weekly_summaries.
const WEEKLY_DISMISSED_KEY = '@helix_weekly_review_dismissed';

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
  if (r === 'lats' || r === 'traps' || r === 'upper traps' || r === 'upper trapezius' || r === 'levator scapulae') return 'back';
  // Side/rear delts get their own buckets so the coach's volume context can
  // report against VOLUME_TARGETS.side_delts / rear_delts instead of always 0.
  if (r === 'side deltoids') return 'side_delts';
  if (r === 'rear delts' || r === 'rear deltoids') return 'rear_delts';
  if (r === 'shoulders' || r === 'anterior delts' || r === 'external rotators') return 'shoulders';
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

export default function CoachScreen({ onClose, workoutContext, onProposalApplied, prefill, onPrefillConsumed }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  // `answer` is now ERROR-ONLY. Successful replies live in conversationHistory and
  // are rendered as the thread — previously only the newest answer was ever drawn,
  // so asking a follow-up silently erased the conversation the coach still
  // remembered and referred back to.
  const [answer, setAnswer] = useState(null);
  // The question in flight. conversationHistory isn't updated until the reply
  // lands, so without this the user's own message vanishes while they wait.
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [confirmingIndex, setConfirmingIndex] = useState(null);
  const [proposalSaved, setProposalSaved] = useState(false);
  const [alternatives, setAlternatives] = useState(null);
  const [userData, setUserData] = useState(null);
  const [quota, setQuota] = useState({ used: 0, remaining: MONTHLY_QUOTA });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyOffered, setWeeklyOffered] = useState(false); // review is due, not yet generated
  const weeklyReviewChecked = useRef(false);
  const scrollRef = useRef(null);

  // Follow the newest turn. Timeout lets the new turn lay out before we measure —
  // scrolling on the same tick lands short of the actual end.
  useEffect(() => {
    if (!conversationHistory.length && !pendingQuestion) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(id);
  }, [conversationHistory.length, pendingQuestion, asking]);

  // useEffect (not useFocusEffect) so this also works when embedded in the
  // workout modal, which renders outside the navigation container.
  useEffect(() => {
    (async () => {
      const data = await loadUserData();
      loadCoachMemory();
      if (data) maybeWeeklyReview(data);
    })();
  }, []);

  // Deep-link from the home screen's proactive card: auto-send the pre-filled
  // question once, then clear it so it isn't re-sent on the next render.
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (!prefill) { prefillHandled.current = false; return; }
    if (prefillHandled.current) return;
    prefillHandled.current = true;
    askQuestion(prefill);
    onPrefillConsumed?.();
  }, [prefill]);

  // Persistent memory: reload the recent conversation so the coach continues the
  // thread across app sessions instead of starting blank every time — the core
  // of feeling like a personal trainer who remembers you.
  const loadCoachMemory = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const { data } = await supabase
      .from('coach_memory')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(40); // last ~20 exchanges
    if (data?.length) {
      // The thread is BOTH the model's context and what the user sees. It used to
      // be context-only — the screen started blank every open and showed just the
      // newest answer, so the coach would reference an exchange the user could no
      // longer see. Reloading it here is what makes "remembers you" visible.
      setConversationHistory(data.map(m => ({ role: m.role, content: m.content })));
    }
  };

  const persistTurns = async (turns) => {
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('coach_memory').insert(
      turns.map(turn => ({ user_id: user.id, role: turn.role, content: turn.content }))
    );
  };

  // Durable structured facts the coach extracted (dislikes, injuries, prefs,
  // goals) — merged into profiles.coach_notes so they're always in context and
  // dislikes feed the program generator, even after the chat scrolls away.
  const persistCoachFacts = async (facts) => {
    const user = await getCurrentUser();
    if (!user) return;
    const existing = userData?.profile?.coach_notes || [];
    const seen = new Set(existing.map(f => (f.summary || '').toLowerCase().trim()));
    const additions = (facts || [])
      .filter(f => f?.summary && !seen.has(f.summary.toLowerCase().trim()))
      .map(f => ({
        category: f.category || 'note',
        summary: f.summary,
        exercise_name: f.exercise_name || null,
        created_at: new Date().toISOString(),
      }));
    if (!additions.length) return;
    const merged = [...existing, ...additions].slice(-50); // keep memory bounded
    await supabase.from('profiles').update({ coach_notes: merged }).eq('id', user.id);
    setUserData(d => (d ? { ...d, profile: { ...d.profile, coach_notes: merged } } : d));
  };

  const clearCoachMemory = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('coach_memory').delete().eq('user_id', user.id);
    setConversationHistory([]);
    setAnswer(null);
    setPendingQuestion(null); // else a cleared thread leaves an orphaned bubble
    setProposals([]);
    setAlternatives(null);
  };

  // Remove a single durable fact the coach has learned. Deleting a "dislike"
  // fact also lets that exercise back into programming (dislikedExerciseIdsFromNotes),
  // so this is the user's control over what the coach remembers about them.
  const deleteCoachNote = async (index) => {
    const user = await getCurrentUser();
    if (!user) return;
    const existing = userData?.profile?.coach_notes || [];
    const merged = existing.filter((_, i) => i !== index);
    await supabase.from('profiles').update({ coach_notes: merged }).eq('id', user.id);
    setUserData(d => (d ? { ...d, profile: { ...d.profile, coach_notes: merged } } : d));
  };

  const forgetNote = (index) => {
    Alert.alert(
      t('coach.memoryForgetTitle'),
      t('coach.memoryForgetMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('coach.memoryForget'), style: 'destructive', onPress: () => deleteCoachNote(index) },
      ],
    );
  };

  const loadUserData = async () => {
    const user = await getCurrentUser();
    if (!user) return;

    const [{ data: profile }, { data: sessions }, { data: cardioSessions }, { data: healthLogs }, { data: nutritionLogs }, recoveryCheckIns] = await Promise.all([
      supabase.from('profiles').select('*, ai_calls_used, ai_calls_reset_at').eq('id', user.id).single(),
      supabase.from('workout_sessions').select('id, name, completed_at, duration_min, perceived_exertion, session_type')
        .eq('user_id', user.id).order('completed_at', { ascending: false }).limit(20),
      supabase.from('workout_sessions')
        .select('name, session_type, duration_min, distance_km, cardio_subtype, completed_at')
        .eq('user_id', user.id).neq('session_type', 'strength')
        .order('completed_at', { ascending: false }).limit(10),
      supabase.from('daily_health_logs')
        .select('date, sleep_hours, hrv_ms, resting_hr, steps')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(7),
      supabase.from('nutrition_logs')
        .select('date, calories, protein_g, carbs_g, fat_g')
        .eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
        .order('date', { ascending: false }),
      getRecentCheckIns(7),
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
    let headVol = {}; // per-head { direct, indirect } from the shared volume engine
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

        const weekSets = [];
        sets.forEach(s => {
          const sessionDate = sessionDateMap[s.session_id];
          if (sessionDate >= sevenDaysAgo) {
            weekSets.push({ exercise_name: s.exercise_name });
            const primary = getPrimaryMuscle(s.exercise_name);
            if (primary) weeklyVolume[primary] = (weeklyVolume[primary] || 0) + 1;
          }
          if (s.weight_kg) {
            if (!prs[s.exercise_name] || s.weight_kg > prs[s.exercise_name].weight) {
              prs[s.exercise_name] = { weight: s.weight_kg, reps: s.reps };
            }
          }
        });
        headVol = computeHeadVolume(weekSets);
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
    // Match TodayScreen exactly: same disliked-exercise filtering, overrides, and
    // contraindication pipeline — otherwise the day/exercise indices the AI sees
    // diverge from the program the user actually sees and proposals miss.
    const skipsSince = new Date();
    skipsSince.setDate(skipsSince.getDate() - 90);
    const { data: skipRows } = await supabase
      .from('exercise_skips')
      .select('exercise_name')
      .eq('user_id', user.id)
      .gte('skipped_at', skipsSince.toISOString());
    const dislikedIds = [...new Set([
      ...computeDislikedExerciseIds(skipRows || []),
      ...dislikedExerciseIdsFromNotes(profile?.coach_notes || []),
    ])];
    let program = profile ? generateProgram(profile, blockIndex, blockStartDate, { dislikedIds }) : null;
    if (program) {
      const { data: overrides } = await supabase
        .from('program_template_overrides')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (overrides?.length) {
        const equipment = normalizeEquipment(profile.equipment || []);
        overrides.forEach(o => {
          program = applyPermanentEdit(program, {
            type: o.edit_type,
            dayId: o.day_id,
            exerciseIndex: o.exercise_index,
            patternKey: o.pattern_key,
            preferExerciseId: o.exercise_id,
            sets: o.sets,
            reps: o.reps,
            rpe: o.rpe,
          }, equipment);
        });
      }
      const baselineInjuryConditions = getConditionsFromInjuryProfile(profile.injury_profile || []);
      const mergedConditions = [...new Set([...(profile.health_conditions || []), ...baselineInjuryConditions])];
      program = applyContraindicationFilters(program, { ...profile, health_conditions: mergedConditions });
      // Match TodayScreen: if an optional specialisation day was completed this
      // week, the main days' isolation for those heads is trimmed so the program
      // context the coach reasons about reflects the rebalanced volume.
      const weekAgo = subDays(new Date(), 7);
      const completedThisWeek = (sessions || [])
        .filter(s => new Date(s.completed_at) >= weekAgo)
        .map(s => s.name);
      program = rebalanceForCompletedOptionalDays(program, completedThisWeek);
    }

    const data = { profile, weeklyVolume, headVol, prs, recentSessions, program, blockIndex, cardioSessions: cardioSessions || [], healthLogs: healthLogs || [], nutritionLogs: nutritionLogs || [], recoveryCheckIns: recoveryCheckIns || [] };
    setUserData(data);
    return data;
  };

  const buildContext = (data) => {
    const { profile, headVol = {}, prs, recentSessions, program, cardioSessions, healthLogs, nutritionLogs = [], recoveryCheckIns = [] } = data;
    const exp = profile?.trainingExperience || 'intermediate';
    // Volume judged on DIRECT sets against the (direct-isolation) targets; indirect
    // work from compounds is reported separately so the coach can see it without
    // double-counting it into the target comparison (matches the Today heat map).
    const DELT_HEADS = ['front_delts', 'side_delts', 'rear_delts'];
    const CHEST_HEADS = ['chest', 'upper_chest', 'lower_chest'];
    const BACK_HEADS = ['lats', 'traps', 'lower_back'];
    const sumHeads = (heads, key) => heads.reduce((n, h) => n + (headVol[h]?.[key] || 0), 0);
    const volFor = (m, key) =>
      m === 'shoulders' ? sumHeads(DELT_HEADS, key)
      : m === 'chest' ? sumHeads(CHEST_HEADS, key)
      : m === 'back' ? sumHeads(BACK_HEADS, key)
      : (headVol[m]?.[key] || 0);
    const fmtV = (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
    const volumeLines = Object.entries(VOLUME_TARGETS).map(([m, t]) => {
      const target = t[exp] || t.intermediate;
      const direct = volFor(m, 'direct');
      const indirect = volFor(m, 'indirect');
      const status = direct < target.min ? 'under minimum' : direct > target.optimal_high ? 'over optimal' : direct >= target.optimal_low ? 'optimal' : 'below optimal';
      const ind = indirect > 0 ? ` +${fmtV(indirect)} indirect` : '';
      return `  ${m}: ${fmtV(direct)} direct${ind} sets (${status}, target ${target.optimal_low}–${target.optimal_high})`;
    }).join('\n');

    const prLines = Object.entries(prs).slice(0, 15).map(([ex, p]) =>
      `  ${ex}: ${p.weight}kg × ${p.reps || '?'}`
    ).join('\n');

    const sessionLines = recentSessions.slice(0, 5).map(s =>
      `  ${format(new Date(s.completed_at), 'EEE MMM d')}: ${s.name} (${s.duration_min || '?'}min, RPE ${s.perceived_exertion || '?'})`
    ).join('\n');

    const programLines = program
      ? program.days.map(day =>
          `  ${day.id} — ${day.name}${day.optional ? ' (optional day — only done when the user chooses to)' : ''}:\n${day.exercises.map((ex, idx) => {
            const muscles = getMuscles(ex.name);
            const muscleTag = muscles.length ? ` [${muscles.join('/')}]` : '';
            return `    [${idx}] ${ex.name}${muscleTag} (${ex.sets ?? 3}×${ex.reps || '8–12'}, rest ${ex.rest || '2 min'})`;
          }).join('\n')}`
        ).join('\n')
      : '  Program not available';

    // The coach's menu of REAL exercises (equipment-filtered). Without this it
    // invents exercise names (e.g. a nonexistent "Cable fly (low to high)") and
    // gets their muscle targeting wrong. The library names encode the region, so
    // forcing the model to copy from here also fixes wrong-region picks.
    const menuEquipment = normalizeEquipment(profile?.equipment || []);
    const libraryLines = Object.entries(MOVEMENT_PATTERNS).map(([key, pat]) => {
      const exs = (getAllExercisesForPattern(key, menuEquipment) || []).map(e => e.name);
      return exs.length ? `  ${pat.label}: ${exs.join(', ')}` : null;
    }).filter(Boolean).join('\n');

    const healthLines = healthLogs?.length
      ? (() => {
          const logsWithHrv = healthLogs.filter(l => l.hrv_ms);
          // Exclude the latest day's log explicitly — slice(1) dropped the wrong
          // row whenever the latest log had no HRV value.
          const latestDate = healthLogs[0]?.date;
          const priorLogs = logsWithHrv.filter(l => l.date !== latestDate);
          const baseline = priorLogs.length >= 3
            ? Math.round(priorLogs.reduce((s, l) => s + l.hrv_ms, 0) / priorLogs.length)
            : null;
          const lines = healthLogs.map(l => {
            const parts = [l.date];
            if (l.sleep_hours) parts.push(`sleep ${l.sleep_hours}h`);
            if (l.hrv_ms) parts.push(`HRV ${l.hrv_ms}ms`);
            if (l.resting_hr) parts.push(`RHR ${l.resting_hr}bpm`);
            if (l.steps) parts.push(`${l.steps} steps`);
            return `  ${parts.join(', ')}`;
          }).join('\n');
          return baseline ? `${lines}\n  HRV baseline (recent avg): ${baseline}ms` : lines;
        })()
      : '  No health data connected';

    const checkInLines = recoveryCheckIns.length
      ? recoveryCheckIns
          .filter(c => !c.skipped)
          .map(c => `  ${c.date}: ${c.label} (sleep ${c.sleep}, soreness ${c.soreness}, energy ${c.energy})`)
          .join('\n') || '  Check-ins skipped'
      : '  No readiness check-ins yet';

    const cardioLines = cardioSessions?.length
      ? cardioSessions.slice(0, 5).map(s => {
          const dist = s.distance_km ? (s.session_type === 'swim' ? `${Math.round(s.distance_km * 1000)}m` : `${s.distance_km}km`) : '';
          const sub = [s.cardio_subtype, dist].filter(Boolean).join(' · ');
          return `  ${format(new Date(s.completed_at), 'EEE MMM d')}: ${s.session_type} ${sub} (${s.duration_min}min)`;
        }).join('\n')
      : '  None logged';

    const activityTypes = (profile?.activity_types || []).join(', ') || 'not set';

    // Durable facts the coach has learned — always injected so they survive even
    // when the raw conversation scrolls out of the window sent to the model.
    const notes = profile?.coach_notes || [];
    const memoryBlock = notes.length
      ? `\nWhat I remember about you:\n${notes.map(f => `  - [${f.category}] ${f.summary}`).join('\n')}\n`
      : '';

    // Nutrition — targets + recent intake, so the coach judges the user's actual
    // diet against their goals instead of giving generic textbook advice (it had
    // no nutrition data before this).
    const nutTargets = {
      calories: profile?.caloric_target || 0,
      protein: profile?.protein_target || 0,
      carbs: profile?.carb_target || 0,
      fat: profile?.fat_target || 0,
    };
    const nutByDate = {};
    (nutritionLogs || []).forEach(l => {
      const d = nutByDate[l.date] || (nutByDate[l.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 });
      d.calories += l.calories || 0; d.protein += l.protein_g || 0; d.carbs += l.carbs_g || 0; d.fat += l.fat_g || 0;
    });
    const nutDays = Object.keys(nutByDate);
    const nutAvg = nutDays.length ? {
      calories: Math.round(nutDays.reduce((s, d) => s + nutByDate[d].calories, 0) / nutDays.length),
      protein: Math.round(nutDays.reduce((s, d) => s + nutByDate[d].protein, 0) / nutDays.length),
      carbs: Math.round(nutDays.reduce((s, d) => s + nutByDate[d].carbs, 0) / nutDays.length),
      fat: Math.round(nutDays.reduce((s, d) => s + nutByDate[d].fat, 0) / nutDays.length),
    } : null;
    const nutritionBlock = nutTargets.calories
      ? `  Daily target: ${nutTargets.calories} kcal · ${nutTargets.protein}g protein · ${nutTargets.carbs}g carbs · ${nutTargets.fat}g fat\n` +
        (nutAvg
          ? `  Logged average over last ${nutDays.length} day(s): ${nutAvg.calories} kcal · ${nutAvg.protein}g protein · ${nutAvg.carbs}g carbs · ${nutAvg.fat}g fat`
          : `  No food logged in the last 7 days`)
      : '  No calorie/macro targets set yet';

    return `User profile:
- Name: ${profile?.name || 'unknown'}
- Experience: ${exp}
- Goal: ${(profile?.goals || []).join(', ') || 'not set'}
- Activities: ${activityTypes}
- Supplements: ${(profile?.supplements || []).filter(s => s !== 'None').join(', ') || 'none'}
- Training: ${profile?.weekly_workouts} days/week, ${profile?.session_length} min sessions
- Weight: ${profile?.weight_kg}kg, Height: ${profile?.height_cm}cm
${memoryBlock}
Current program: ${program?.name || 'unknown'} (split ID: ${profile?.selected_split || 'unknown'})
Days and exercises:
${programLines}

AVAILABLE EXERCISES (equipment-filtered for this user). When you propose adding or
replacing an exercise, the exercise_name MUST be copied EXACTLY from this list —
never invent, rename, or paraphrase an exercise. The name already encodes the
target region (e.g. "Cable crossover (lower chest)"), so pick the one that matches
the user's request. If nothing here fits, say so instead of proposing:
${libraryLines}

EVIDENCE BASE — the app's curated findings. This is your source of truth: cite and
stay consistent with these, and do NOT contradict them or invent science beyond
them. If something isn't covered here, say it's outside the app's evidence base
rather than guessing:
${formatEvidenceBase()}

This week's volume — last 7 days (sets per muscle):
${volumeLines}

Personal records:
${prLines}

Recent strength sessions:
${sessionLines}

Recent cardio sessions:
${cardioLines}

Recovery data (last 7 days):
${healthLines}

Self-reported readiness (last 7 days):
${checkInLines}

Nutrition — targets vs recent intake:
${nutritionBlock}${workoutContext ? `\n\nCurrent live workout (user is training right now):\n${workoutContext}` : ''}`;
  };

  const callCoach = async (messages, userContext, mode) => {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body: { messages, userContext, mode },
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

  // The week is keyed by the Sunday that starts it, so a new review becomes due
  // each Sunday — matching the paywall's "weekly narrative summary every Sunday".
  const currentWeekKey = () => format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');

  // The advertised weekly narrative summary.
  //
  // This used to auto-generate on the first Coach open of a new week, which spent
  // one of the user's 100 monthly messages WITHOUT asking. Now it only SHOWS an
  // already-generated review; producing a new one is an explicit tap (see
  // generateWeeklyReview). An already-paid-for summary costs nothing to re-show.
  const maybeWeeklyReview = async (data) => {
    if (workoutContext) return;                 // not during a live workout
    if (weeklyReviewChecked.current) return;
    weeklyReviewChecked.current = true;
    const user = await getCurrentUser();
    if (!user) return;
    const weekKey = currentWeekKey();
    // Checked BEFORE the fetch: a dismissed review must not reappear on every open.
    const dismissed = await AsyncStorage.getItem(WEEKLY_DISMISSED_KEY).catch(() => null);
    if (dismissed === weekKey) return;
    const { data: existing } = await supabase
      .from('weekly_summaries')
      .select('content')
      .eq('user_id', user.id)
      .eq('week_key', weekKey)
      .maybeSingle();
    if (existing?.content) { setWeeklySummary(existing.content); return; }
    // Nothing stored yet — offer the button instead of spending a message. Only
    // when there's a week worth summarising; a review of an empty week is filler.
    const trainedThisWeek = (data.recentSessions || []).some(
      s => new Date(s.completed_at) >= subDays(new Date(), 7)
    );
    if (trainedThisWeek) setWeeklyOffered(true);
  };

  // Explicit, user-initiated. Costs one monthly message, and the button says so.
  const generateWeeklyReview = async () => {
    if (weeklyLoading || quotaExceeded) return;
    const user = await getCurrentUser();
    if (!user) return;
    const data = userData || await loadUserData();
    if (!data) return;
    setWeeklyOffered(false);
    setWeeklyLoading(true);
    try {
      const result = await callCoach(
        [{ role: 'user', content: 'Write my weekly training review.' }],
        buildContext(data),
        'weekly_summary',
      );
      if (result?.text) {
        setWeeklySummary(result.text);
        // Unique (user_id, week_key) makes concurrent opens idempotent.
        await supabase.from('weekly_summaries').upsert(
          { user_id: user.id, week_key: currentWeekKey(), content: result.text },
          { onConflict: 'user_id,week_key' },
        );
      } else {
        setWeeklyOffered(true); // nothing came back — let them try again
      }
    } catch {
      setWeeklyOffered(true);
    }
    setWeeklyLoading(false);
  };

  // Dismiss this week's review. The summary stays in weekly_summaries (it's part
  // of the paid feature and the coach's record); this only hides the card until
  // next week's review is due.
  const dismissWeeklyReview = async () => {
    setWeeklySummary(null);
    setWeeklyLoading(false);
    AsyncStorage.setItem(WEEKLY_DISMISSED_KEY, currentWeekKey()).catch(() => {});
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
      setInsight(t('coach.failedConnectCheck'));
    }
    setLoading(false);
  };

  const saveProposal = async (p, sessionOnly = false) => {
    const user = await getCurrentUser();
    if (!user) return false;
    // Refuse proposals that target a day that doesn't exist in the program —
    // the row would be inserted and "Saved" shown, but nothing would ever change.
    const programDays = userData?.program?.days;
    const day = programDays?.find(d => d.id === p.day_id);
    if (programDays?.length && !day) {
      return false;
    }
    const isAdd = p.type === 'add_exercise' || p.edit_type === 'add_exercise';
    // Resolve the model's exercise_index — an index into the list buildContext
    // just sent it — to the durable slot id, here, while that array is still the
    // one it refers to. `current_exercise` stays a sanity check ONLY: relocating
    // by name used findIndex, which returns the FIRST match, so with two
    // same-named exercises an edit meant for the second hit the first. Reject a
    // mismatch instead of retargeting it.
    if (!isAdd && day) {
      const target = (day.exercises || [])[p.exercise_index];
      if (!target) return false;
      if (p.current_exercise) {
        const wantLc = p.current_exercise.trim().toLowerCase();
        if ((target.name || '').trim().toLowerCase() !== wantLc) return false;
      }
      p = { ...p, slot_id: target.slotId ?? null };
    }
    // Bounds-check the target slot for replaces/swaps (add creates a new slot).
    // A stale or hallucinated index would otherwise edit the wrong exercise or
    // write an override that silently never matches.
    if (!isAdd && day) {
      const idx = p.exercise_index;
      if (!Number.isInteger(idx) || idx < 0 || idx >= (day.exercises?.length || 0)) {
        return false;
      }
    }
    // Never write a duplicate: reject a proposed exercise that already appears on
    // the same day (rule 10 tells the model this, but validate it too). For a
    // replace, exclude the slot being replaced from the check.
    if (p.exercise_name && day) {
      const proposedLc = p.exercise_name.trim().toLowerCase();
      const targetIdx = isAdd ? -1 : p.exercise_index;
      const dup = (day.exercises || []).some((ex, i) =>
        i !== targetIdx && (ex.name || '').trim().toLowerCase() === proposedLc);
      if (dup) return false;
    }
    let err;
    if (p.type === 'add_exercise') {
      // Reject an invented exercise name — additions aren't name-resolved on the
      // way in, so without this an unreal name would be inserted and shown as a
      // real added exercise.
      if (!p.exercise_name || !resolveExerciseByName(p.exercise_name)) return false;
      ({ error: err } = await supabase.from('program_additions').insert({
        user_id: user.id,
        day_id: p.day_id || '',
        exercise_name: p.exercise_name || '',
        sets: p.sets || 3,
        reps: p.reps || '10–15',
        rest: p.rest || '90 sec',
      }));
    } else {
      // Resolve the proposed exercise NAME → its real id + pattern, so a replace
      // actually places that exercise instead of rebuilding the slot blindly.
      let patternKey = p.pattern_key || null;
      let exerciseId = p.exercise_id || null;
      if (p.exercise_name) {
        const resolved = resolveExerciseByName(p.exercise_name);
        if (resolved) {
          exerciseId = resolved.exerciseId;
          patternKey = resolved.patternKey;
        }
      }
      // A replace that resolves to nothing real would silently rebuild the same
      // slot — refuse it so the user isn't told "saved" when nothing changed.
      if ((p.edit_type || 'replace_exercise') === 'replace_exercise' && !exerciseId && !patternKey) {
        return false;
      }
      ({ error: err } = await supabase.from('program_template_overrides').insert({
        user_id: user.id,
        day_id: p.day_id || '',
        exercise_index: p.exercise_index ?? 0,
        slot_id: p.slot_id ?? null,
        edit_type: p.edit_type || 'replace_exercise',
        pattern_key: patternKey,
        exercise_id: exerciseId,
        sets: p.sets || null,
        reps: p.reps || null,
        rpe: p.rpe || null,
        is_session_swap: sessionOnly,
      }));
    }
    return !err;
  };

  const doApply = async (index, sessionOnly) => {
    if (confirmingIndex !== null) return;
    setConfirmingIndex(index);
    const ok = await saveProposal(proposals[index], sessionOnly);
    setConfirmingIndex(null);
    if (ok) {
      const remaining = proposals.filter((_, i) => i !== index);
      setProposals(remaining);
      if (remaining.length === 0) setProposalSaved(true);
      loadUserData(); // refresh so the coach's program context reflects the change
      if (onProposalApplied) {
        // Pass the canonical library name so the host can match it exactly.
        const p = proposals[index];
        let exerciseName = p.exercise_name;
        const resolved = p.exercise_name ? resolveExerciseByName(p.exercise_name) : null;
        if (resolved) {
          const ex = MOVEMENT_PATTERNS[resolved.patternKey]?.exercises.find(e => e.id === resolved.exerciseId);
          if (ex) exerciseName = ex.name;
        }
        onProposalApplied({ ...p, exercise_name: exerciseName });
      }
    } else {
      Alert.alert(t('coach.alerts.cantApplyTitle'), t('coach.alerts.cantApplyMsg'));
    }
  };

  const applyProposal = (index) => {
    if (confirmingIndex !== null) return;
    const p = proposals[index];
    // Additions are always permanent (they create a new slot) — no scope choice.
    if (p.type === 'add_exercise' || p.edit_type === 'add_exercise') {
      doApply(index, false);
      return;
    }
    // Both options change the exercise RIGHT NOW. The only difference is whether
    // it also sticks for future workouts — there's no "starts next time" option,
    // which would be pointless mid-workout.
    Alert.alert(
      t('coach.alerts.replaceTitle'),
      t('coach.alerts.replaceMsg'),
      [
        { text: t('coach.alerts.justThis'), onPress: () => doApply(index, true) },
        { text: t('coach.alerts.nowFuture'), onPress: () => doApply(index, false) },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  const dismissProposal = (index) => {
    setProposals(proposals.filter((_, i) => i !== index));
  };

  const requestAlternative = (p) => {
    // Swap the proposed exercise for a different one in the SAME movement pattern,
    // locally and instantly — no AI round-trip (that was unreliable and often
    // returned text with no new proposal, so the card just vanished).
    const resolved = resolveExerciseByName(p.exercise_name);
    const patternKey = p.pattern_key || resolved?.patternKey;
    const equipment = normalizeEquipment(userData?.profile?.equipment || []);
    const pool = patternKey ? (getAllExercisesForPattern(patternKey, equipment) || []) : [];
    if (pool.length < 2) {
      const what = p.exercise_name ? `"${p.exercise_name}"` : t('coach.thatExercise');
      const where = p.day_name ? t('coach.onDay', { day: p.day_name }) : '';
      setProposals(proposals.filter(x => x !== p));
      askQuestion(t('coach.altPrompt', { what, where }));
      return;
    }
    const currentId = p.exercise_id || resolved?.exerciseId;
    const curIdx = pool.findIndex(e => e.id === currentId);
    const next = pool[(curIdx + 1) % pool.length];
    setProposals(proposals.map(x => x === p
      ? { ...x, exercise_name: next.name, exercise_id: next.id, pattern_key: patternKey }
      : x));
  };

  // Apply one of the ranked alternatives the coach offered. Goes through the same
  // saveProposal validation + live-swap path as a normal proposal, so it inherits
  // the duplicate / bounds / name checks and the mid-workout apply.
  const applyChosenAlternative = async (slot, option, sessionOnly) => {
    const p = {
      type: sessionOnly ? 'session_swap' : 'permanent_edit',
      edit_type: 'replace_exercise',
      day_id: slot.day_id,
      day_name: slot.day_name,
      exercise_index: slot.exercise_index,
      current_exercise: slot.current_exercise,
      exercise_name: option.exercise_name,
      rationale: option.rationale,
    };
    const ok = await saveProposal(p, sessionOnly);
    if (!ok) { Alert.alert(t('coach.alerts.cantApplyTitle'), t('coach.alerts.cantApplyMsg')); return; }
    setAlternatives(null);
    setProposalSaved(true);
    loadUserData();
    if (onProposalApplied) {
      let exerciseName = option.exercise_name;
      const resolved = resolveExerciseByName(option.exercise_name);
      if (resolved) {
        const ex = MOVEMENT_PATTERNS[resolved.patternKey]?.exercises.find(e => e.id === resolved.exerciseId);
        if (ex) exerciseName = ex.name;
      }
      onProposalApplied({ ...p, exercise_name: exerciseName });
    }
  };

  const chooseAlternative = (slot, option) => {
    if (confirmingIndex !== null) return;
    // Same "just this workout / now & future" scope choice as a normal replace.
    Alert.alert(
      t('coach.alerts.replaceTitle'),
      t('coach.alerts.replaceMsg'),
      [
        { text: t('coach.alerts.justThis'), onPress: () => applyChosenAlternative(slot, option, true) },
        { text: t('coach.alerts.nowFuture'), onPress: () => applyChosenAlternative(slot, option, false) },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  const askQuestion = async (explicitText) => {
    const currentQuestion = (typeof explicitText === 'string' ? explicitText : question).trim();
    if (!currentQuestion || quotaExceeded || asking) return;
    setAsking(true);
    setAnswer(null);
    setProposals([]);
    setAlternatives(null);
    setProposalSaved(false);
    setPendingQuestion(currentQuestion); // show the user's turn immediately
    const data = userData || await loadUserData();

    const newHistory = [
      ...conversationHistory,
      { role: 'user', content: currentQuestion },
    ];

    try {
      // Cap the history sent to the model to bound token cost — memory can grow
      // long over weeks. The full thread still lives in state/DB.
      const result = await callCoach(newHistory.slice(-20), data ? buildContext(data) : '');
      const answerText = result?.text || t('coach.noAnswer');
      if (result?.proposals?.length) {
        setProposals(result.proposals);
      }
      if (result?.alternatives?.alternatives?.length) {
        setAlternatives(result.alternatives);
      }
      setConversationHistory([
        ...newHistory,
        { role: 'assistant', content: answerText },
      ]);
      setPendingQuestion(null); // it's in the thread now
      // Persist both turns so the coach remembers them next session (fire-and-forget).
      persistTurns([
        { role: 'user', content: currentQuestion },
        { role: 'assistant', content: answerText },
      ]).catch(() => {});
      // Persist any durable facts the coach extracted this turn.
      if (result?.facts?.length) persistCoachFacts(result.facts).catch(() => {});
      setQuestion('');
    } catch {
      // Drop the pending turn and surface the error transiently — the user's text
      // stays in the input so Ask retries it without retyping.
      setPendingQuestion(null);
      setAnswer(t('coach.failedConnect'));
    }
    setAsking(false);
  };

  const doApplyAll = async (sessionOnly) => {
    setConfirmingIndex(-1); // -1 = apply-all in progress
    let hadError = false;
    for (const p of proposals) {
      const isAdd = p.type === 'add_exercise' || p.edit_type === 'add_exercise';
      const ok = await saveProposal(p, isAdd ? false : sessionOnly);
      if (!ok) hadError = true;
    }
    setConfirmingIndex(null);
    if (!hadError) {
      setProposalSaved(true);
      setProposals([]);
      loadUserData();
    } else {
      Alert.alert(t('coach.alerts.someFailedTitle'), t('coach.alerts.someFailedMsg'));
    }
  };

  const applyAllProposals = () => {
    if (!proposals.length || confirmingIndex !== null) return;
    Alert.alert(
      t('coach.alerts.applyAllTitle'),
      t('coach.alerts.applyAllMsg'),
      [
        { text: t('coach.alerts.thisWorkoutOnly'), onPress: () => doApplyAll(true) },
        { text: t('coach.alerts.allFuture'), onPress: () => doApplyAll(false) },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  const isMidWorkout = !!workoutContext;
  const coachNotes = userData?.profile?.coach_notes || [];

  const editKindLabel = (p) => {
    if (p.type === 'add_exercise' || p.edit_type === 'add_exercise') return t('coach.addExercise');
    if (p.type === 'session_swap') return t('coach.sessionOnly');
    return t('coach.permanent');
  };

  const currentExerciseName = (p) => {
    if (!userData?.program) return null;
    const day = userData.program.days.find(d => d.id === p.day_id);
    return day?.exercises?.[p.exercise_index]?.name ?? null;
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('coach.title')}</Text>
            <Text style={styles.subtitle}>{t('coach.subtitle')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
            {conversationHistory.length > 0 && (
              <Tappable
                hitSlop={10}
                style={{ paddingTop: 4 }}
                onPress={() => Alert.alert(
                  t('coach.resetTitle'),
                  t('coach.resetMsg'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('coach.resetConfirm'), style: 'destructive', onPress: () => clearCoachMemory() },
                  ],
                )}
              >
                <Text style={{ color: colors.textSubtle, fontSize: 15, fontWeight: '600' }}>{t('coach.reset')}</Text>
              </Tappable>
            )}
            {onClose && (
              <Tappable onPress={onClose} hitSlop={10} style={{ paddingTop: 4 }}>
                <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600' }}>{t('common.done')}</Text>
              </Tappable>
            )}
          </View>
        </View>
      </View>

      {/* Quota bar */}
      <View style={styles.quotaCard}>
        <View style={styles.quotaRow}>
          <Text style={styles.quotaLabel}>{t('coach.monthlyMessages')}</Text>
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
            {t('coach.limitReached')}
          </Text>
        )}
      </View>

      {/* Weekly narrative review — auto-generated once per week, hidden mid-workout */}
      {!isMidWorkout && (weeklyOffered || weeklyLoading || weeklySummary) && (
        <View style={styles.card}>
          <View style={styles.weeklyHeader}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>{t('coach.weeklyReview')}</Text>
            {/* Dismissable — it otherwise re-renders on every Coach open all week. */}
            {(weeklySummary || weeklyOffered) && !weeklyLoading && (
              <Tappable onPress={dismissWeeklyReview} hitSlop={12} accessibilityLabel={t('common.close')}>
                <Text style={styles.weeklyDismiss}>✕</Text>
              </Tappable>
            )}
          </View>
          {weeklySummary ? (
            <View style={[styles.insightBox, { marginTop: 12, marginBottom: 0 }]}>
              <Text style={styles.insightText}>{weeklySummary}</Text>
            </View>
          ) : weeklyLoading ? (
            <Text style={[styles.cardSub, { marginTop: 6, marginBottom: 0 }]}>{t('coach.weeklyReviewLoading')}</Text>
          ) : (
            <>
              {/* The cost is stated on the button. It used to be spent silently. */}
              <Text style={[styles.cardSub, { marginTop: 6, marginBottom: 12 }]}>{t('coach.weeklyReviewOffer')}</Text>
              <Tappable
                style={[styles.weeklyBtn, quotaExceeded && styles.btnDisabled]}
                onPress={generateWeeklyReview}
                disabled={quotaExceeded}
              >
                <Text style={styles.weeklyBtnText}>{t('coach.weeklyReviewCta')}</Text>
              </Tappable>
            </>
          )}
        </View>
      )}

      {/* Ask a question */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('coach.ask')}</Text>
        <Text style={styles.cardSub}>{t('coach.askSub')}</Text>

        {/* ── Conversation thread ────────────────────────────────────────────
            conversationHistory was already being kept and sent to the model, but
            never drawn: only the newest answer rendered, so a follow-up erased the
            exchange the coach was still reasoning about. Render the whole thread. */}
        {(conversationHistory.length > 0 || pendingQuestion || asking || answer) && (
          <View style={styles.thread}>
            {conversationHistory.map((turn, i) => (
              <View
                key={i}
                style={[styles.turn, turn.role === 'user' ? styles.turnUser : styles.turnCoach]}
              >
                <Text style={turn.role === 'user' ? styles.turnUserText : styles.turnCoachText}>
                  {turn.content}
                </Text>
              </View>
            ))}
            {pendingQuestion && (
              <View style={[styles.turn, styles.turnUser]}>
                <Text style={styles.turnUserText}>{pendingQuestion}</Text>
              </View>
            )}
            {asking && (
              <View style={[styles.turn, styles.turnCoach]}>
                <Text style={styles.turnThinking}>{t('coach.thinking')}</Text>
              </View>
            )}
            {answer && !asking && (
              <View style={[styles.turn, styles.turnError]}>
                <Text style={styles.turnErrorText}>{answer}</Text>
              </View>
            )}
          </View>
        )}

        {/* Example chips are the empty state: an invitation on a blank thread,
            noise once a conversation exists. */}
        {!quotaExceeded && conversationHistory.length === 0 && !pendingQuestion && (
          <View style={styles.exampleChips}>
            {[
              { label: t('coach.examples.swapLabel'), prompt: t('coach.examples.swapPrompt') },
              { label: t('coach.examples.shouldersLabel'), prompt: t('coach.examples.shouldersPrompt') },
              { label: t('coach.examples.glutesLabel'), prompt: t('coach.examples.glutesPrompt') },
              { label: t('coach.examples.easeOffLabel'), prompt: t('coach.examples.easeOffPrompt') },
            ].map((c) => (
              <Tappable key={c.label} style={styles.exampleChip} onPress={() => setQuestion(c.prompt)}>
                <Text style={styles.exampleChipText}>{c.label}</Text>
              </Tappable>
            ))}
          </View>
        )}

        <TextInput
          style={[styles.questionInput, quotaExceeded && { opacity: 0.4 }]}
          value={quotaExceeded ? '' : question}
          onChangeText={setQuestion}
          placeholder={quotaExceeded ? t('coach.limitPlaceholder') : t('coach.inputPlaceholder')}
          placeholderTextColor={colors.textFaint}
          multiline
          numberOfLines={3}
          editable={!quotaExceeded}
        />

        {/* Proposal confirmation card */}
        {proposals.length > 0 && (
          <View style={styles.proposalCard}>
            <Text style={styles.proposalLabel}>
              {proposals.length === 1
                ? (proposals[0].type === 'add_exercise' ? t('coach.proposesAdding') : t('coach.proposesChanging'))
                : t('coach.proposesN', { count: proposals.length })}
            </Text>
            {proposals.map((p, i) => (
              <View key={i} style={[styles.proposalItem, i > 0 && styles.proposalItemBorder]}>
                <View style={styles.proposalScopeRow}>
                  <View style={styles.proposalScopePill}>
                    <Text style={styles.proposalScopeText}>
                      {editKindLabel(p)}
                    </Text>
                  </View>
                </View>
                {(() => {
                  const current = currentExerciseName(p);
                  const isReplace = (p.edit_type || 'replace_exercise') === 'replace_exercise' && p.type !== 'add_exercise';
                  if (isReplace && current && current !== p.exercise_name) {
                    return (
                      <Text style={styles.proposalExercise}>
                        <Text style={styles.proposalExerciseOld}>{current}</Text>  →  {p.exercise_name}
                      </Text>
                    );
                  }
                  return p.exercise_name ? <Text style={styles.proposalExercise}>{p.exercise_name}</Text> : null;
                })()}
                {(p.sets || p.reps) && (
                  <Text style={styles.proposalDetail}>
                    {p.sets ? t('coach.setsCount', { n: p.sets }) : ''}{p.sets && p.reps ? ' × ' : ''}{p.reps || ''}{p.rest ? t('coach.restSuffix', { rest: p.rest }) : ''}
                  </Text>
                )}
                {p.day_name && (
                  <Text style={styles.proposalDay}>{p.day_name}</Text>
                )}
                {p.rationale && (
                  <Text style={styles.proposalRationale}>{p.rationale}</Text>
                )}
                <View style={styles.proposalItemActions}>
                  <Tappable
                    style={[styles.proposalApplyBtn, confirmingIndex !== null && styles.btnDisabled]}
                    onPress={() => applyProposal(i)}
                    disabled={confirmingIndex !== null}
                  >
                    <Text style={styles.proposalApplyText}>
                      {confirmingIndex === i ? t('coach.saving') : t('coach.apply')}
                    </Text>
                  </Tappable>
                  <Tappable
                    style={styles.proposalAltBtn}
                    onPress={() => requestAlternative(p)}
                    disabled={confirmingIndex !== null}
                  >
                    <Text style={styles.proposalAltText}>{t('coach.alternative')}</Text>
                  </Tappable>
                  <Tappable
                    style={styles.proposalRemoveBtn}
                    onPress={() => dismissProposal(i)}
                    disabled={confirmingIndex !== null}
                  >
                    <Text style={styles.proposalRemoveText}>✕</Text>
                  </Tappable>
                </View>
              </View>
            ))}
            {proposals.length > 1 && (
              <View style={styles.proposalActions}>
                <Tappable
                  style={[styles.confirmBtn, confirmingIndex !== null && styles.btnDisabled]}
                  onPress={applyAllProposals}
                  disabled={confirmingIndex !== null}
                >
                  <Text style={styles.confirmBtnText}>
                    {confirmingIndex === -1 ? t('coach.saving') : t('coach.applyAll')}
                  </Text>
                </Tappable>
                <Tappable
                  style={styles.dismissBtn}
                  onPress={() => setProposals([])}
                >
                  <Text style={styles.dismissBtnText}>{t('coach.dismissAll')}</Text>
                </Tappable>
              </View>
            )}
          </View>
        )}

        {/* Ranked, research-backed replacement options — tap to apply (no extra message) */}
        {alternatives?.alternatives?.length > 0 && (
          <View style={styles.proposalCard}>
            <Text style={styles.proposalLabel}>
              {t('coach.alternativesFor', { name: alternatives.current_exercise || t('coach.thisExercise') })}
            </Text>
            {alternatives.alternatives.map((opt, i) => (
              <View key={i} style={[styles.altItem, i > 0 && styles.proposalItemBorder]}>
                <View style={styles.altHeader}>
                  <View style={styles.altRank}><Text style={styles.altRankText}>{i + 1}</Text></View>
                  <Text style={styles.altName}>{opt.exercise_name}</Text>
                </View>
                {opt.rationale ? <Text style={styles.proposalRationale}>{opt.rationale}</Text> : null}
                <Tappable
                  style={[styles.altUseBtn, confirmingIndex !== null && styles.btnDisabled]}
                  onPress={() => chooseAlternative(alternatives, opt)}
                  disabled={confirmingIndex !== null}
                >
                  <Text style={styles.altUseText}>{t('coach.useThis')}</Text>
                </Tappable>
              </View>
            ))}
            <Tappable style={[styles.dismissBtn, { marginTop: 4 }]} onPress={() => setAlternatives(null)}>
              <Text style={styles.dismissBtnText}>{t('coach.dismissAll')}</Text>
            </Tappable>
          </View>
        )}

        {proposalSaved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>{t('coach.saved')}</Text>
          </View>
        )}

        <Tappable
          style={[styles.askBtn, (asking || quotaExceeded) && styles.btnDisabled]}
          onPress={askQuestion}
          disabled={asking || quotaExceeded}
        >
          <Text style={styles.askBtnText}>{asking ? t('coach.thinking') : t('coach.askBtn')}</Text>
        </Tappable>
      </View>

      {/* Weekly insight — hidden mid-workout to keep that view focused */}
      {!isMidWorkout && (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('coach.weeklyInsight')}</Text>
        <Text style={styles.cardSub}>{t('coach.weeklyInsightSub')}</Text>

        {insight ? (
          <View style={styles.insightBox}>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ) : (
          <View style={styles.insightEmpty}>
            <Text style={styles.insightEmptyText}>
              {t('coach.insightEmpty')}
            </Text>
          </View>
        )}

        <Tappable
          style={[styles.generateBtn, (loading || quotaExceeded) && styles.btnDisabled]}
          onPress={generateInsight}
          disabled={loading || quotaExceeded}
        >
          <Text style={styles.generateBtnText}>
            {loading ? t('coach.analysing') : insight ? t('coach.refreshInsight') : t('coach.generateInsight')}
          </Text>
        </Tappable>
      </View>
      )}

      {/* Coach memory — durable facts the user can review and forget */}
      {!isMidWorkout && coachNotes.length > 0 && (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('coach.memoryTitle')}</Text>
        <Text style={styles.cardSub}>{t('coach.memorySub')}</Text>
        {coachNotes.map((f, i) => (
          <View key={i} style={[styles.memoryRow, i > 0 && styles.memoryRowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memoryCat}>{t(`coach.noteCat.${f.category || 'note'}`)}</Text>
              <Text style={styles.memorySummary}>{f.summary}</Text>
            </View>
            <Tappable style={styles.memoryForgetBtn} onPress={() => forgetNote(i)} hitSlop={8}>
              <Text style={styles.memoryForgetText}>{t('coach.memoryForget')}</Text>
            </Tappable>
          </View>
        ))}
      </View>
      )}

      {/* Quick question chips */}
      {!isMidWorkout && (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('coach.quickQuestions')}</Text>
        {[
          t('coach.quick.neglecting'),
          t('coach.quick.frequency'),
          t('coach.quick.prioritise'),
          t('coach.quick.recovering'),
        ].map((q, i) => (
          <Tappable
            key={i}
            style={[styles.quickChip, quotaExceeded && styles.quickChipDisabled]}
            onPress={() => { if (!quotaExceeded) setQuestion(q); }}
          >
            <Text style={styles.quickChipText}>{q}</Text>
          </Tappable>
        ))}
      </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 24, paddingTop: 24 },
  title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.textSubtle, marginTop: 4 },

  quotaCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: colors.border, marginBottom: 14 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  quotaLabel: { fontSize: 12, color: colors.textSubtle },
  quotaCount: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  quotaCountExceeded: { color: colors.danger },
  quotaBarBg: { height: 4, backgroundColor: colors.control, borderRadius: 2 },
  quotaBarFill: { height: 4, backgroundColor: colors.surfaceInverse, borderRadius: 2 },
  quotaBarWarn: { backgroundColor: colors.warning },
  quotaBarExceeded: { backgroundColor: colors.danger },
  quotaExceededText: { fontSize: 11, color: colors.danger, marginTop: 8 },

  card: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  cardSub: { fontSize: 11, color: colors.textSubtle, marginBottom: 14, lineHeight: 16 },
  exampleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  exampleChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12 },
  exampleChipText: { color: colors.textMuted, fontSize: 12 },

  insightBox: { backgroundColor: colors.surfaceInset, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: colors.border },
  insightText: { fontSize: 13, color: colors.textPrimary, lineHeight: 21 },
  insightEmpty: { backgroundColor: colors.surfaceInset, borderRadius: 12, padding: 14, marginBottom: 14 },
  insightEmptyText: { fontSize: 13, color: colors.textSubtle, lineHeight: 20 },

  generateBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  generateBtnText: { color: colors.surfaceRaised, fontSize: 14, fontWeight: '600' },

  questionInput: { backgroundColor: colors.surfaceInset, borderRadius: 12, padding: 12, color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 12, minHeight: 72, textAlignVertical: 'top', borderWidth: 0.5, borderColor: colors.border },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyDismiss: { fontSize: 15, color: colors.textSubtle, fontWeight: '600' },
  weeklyBtn: { backgroundColor: colors.control, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderStrong },
  weeklyBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // ── Conversation thread ─────────────────────────────────────────────────────
  // Reuses the app's existing vocabulary: accent green = you, surface = coach.
  // Deliberately not bubbles-with-tails — this is product UI, not a messenger.
  thread: { gap: 8, marginBottom: 14 },
  turn: { maxWidth: '88%', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  turnUser: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  turnUserText: { fontSize: 13, color: colors.textPrimary, lineHeight: 20 },
  turnCoach: { alignSelf: 'flex-start', backgroundColor: colors.surfaceInset, borderWidth: 0.5, borderColor: colors.border, borderBottomLeftRadius: 4 },
  turnCoachText: { fontSize: 13, color: colors.textPrimary, lineHeight: 21 },
  turnThinking: { fontSize: 13, color: colors.textSubtle, lineHeight: 21, fontStyle: 'italic' },
  turnError: { alignSelf: 'flex-start', backgroundColor: colors.dangerBg, borderWidth: 0.5, borderColor: '#E85D5C55', borderBottomLeftRadius: 4 },
  turnErrorText: { fontSize: 13, color: colors.danger, lineHeight: 21 },

  proposalCard: { backgroundColor: colors.surfaceInset, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  proposalItem: { paddingTop: 8 },
  proposalItemBorder: { marginTop: 10, borderTopWidth: 0.5, borderTopColor: colors.border },
  proposalScopeRow: { flexDirection: 'row', marginBottom: 8 },
  proposalScopePill: { backgroundColor: '#FFFFFF0D', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, borderWidth: 0.5, borderColor: colors.border },
  proposalScopePillSession: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  proposalScopeText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  proposalScopeTextSession: { color: colors.warning },
  proposalLabel: { fontSize: 10, color: colors.textPrimary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  proposalExercise: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  proposalDetail: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  proposalDay: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  proposalRationale: { fontSize: 12, color: colors.textSubtle, lineHeight: 18, marginBottom: 12 },
  proposalItemActions: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 4 },
  proposalApplyBtn: { flex: 1, backgroundColor: colors.surfaceInverse, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  proposalApplyText: { color: colors.surfaceRaised, fontSize: 12, fontWeight: '700' },
  proposalAltBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  proposalAltText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  proposalRemoveBtn: { width: 34, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  proposalRemoveText: { color: colors.textSubtle, fontSize: 13, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },

  altItem: { paddingTop: 10 },
  altHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  altRank: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#FFFFFF33' },
  altRankText: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  altName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  altUseBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  altUseText: { color: colors.surfaceRaised, fontSize: 12, fontWeight: '700' },

  proposalActions: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flex: 1, backgroundColor: colors.surfaceInverse, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  confirmBtnText: { color: colors.surfaceRaised, fontSize: 13, fontWeight: '600' },
  dismissBtn: { backgroundColor: colors.control, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  dismissBtnText: { color: colors.textSubtle, fontSize: 13, fontWeight: '500' },

  savedBanner: { backgroundColor: colors.successBg, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 0.5, borderColor: colors.accent },
  savedBannerText: { fontSize: 13, color: colors.accent, lineHeight: 18 },

  askBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  askBtnText: { color: colors.textOnLight, fontSize: 15, fontWeight: '600' },

  memoryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  memoryRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border },
  memoryCat: { fontSize: 10, color: colors.textSubtle, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  memorySummary: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  memoryForgetBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.dangerBg, borderRadius: 8, borderWidth: 0.5, borderColor: colors.dangerHair },
  memoryForgetText: { color: colors.danger, fontSize: 12, fontWeight: '600' },

  quickChip: { backgroundColor: colors.surfaceInset, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: colors.border },
  quickChipDisabled: { opacity: 0.4 },
  quickChipText: { fontSize: 13, color: colors.textMuted },
});
