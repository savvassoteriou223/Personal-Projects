import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import VolumeBar from '../components/VolumeBar';
import { step as areStep, acceptExperiment, abandonExperiment } from '../lib/areStore';
import { computeFatigueSignature } from '../lib/individualModel';
import { MOVEMENT_PATTERNS, getAllExercisesForPattern, getPatternLabelForExercise } from './movementLibrary';
import { keepInPatternAlternatives } from '../lib/exerciseAlternatives';
import { replacementPatternCheck, soleSlotPatterns } from '../lib/proposalPreflight';
import { isAddProposal } from '../lib/proposalRouting';
import { sanitizeProposals } from '../lib/proposalValidation';
import { formatEvidenceBase } from './studiesLibrary';
import { VOLUME_TARGETS, getVolumeTargets, generateProgram, resolveExerciseByName, normalizeEquipment, applyPermanentEdit, applyContraindicationFilters, getPatternContraindication, getConditionsFromInjuryProfile, computeDislikedExerciseIds, dislikedExerciseIdsFromNotes, rebalanceForCompletedOptionalDays, INJURY_BODY_PARTS, detectPlateaus, detectDeloadNeeded, getProactiveCoachPrompt, getEligibleGoalMilestones, checkReadyToProgress, detectRotationTrigger, getBlockLength, generateDeloadWeek } from './programGenerator';
import { expandAllConditions } from '../lib/conditionsDb';
import { computeHeadVolume } from './volumeEngine';
import { computeInsights } from './insightsEngine';
import { getRecentCheckIns, getTodayCheckIn } from '../lib/recoveryStore';
import { format, subDays, startOfWeek } from 'date-fns';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';
import Svg, { Path, Circle, Line as SvgLine } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

// Real per-session trend chart for the focus card — same est-1RM series
// plateauTrend carries, same react-native-svg pattern already used by
// BodyCompositionCard/VolumePanel elsewhere in the app. Flat data draws a
// flat line; it isn't decoration, it's what actually happened.
function PlateauChart({ points }) {
  if (!points || points.length < 2) return null;
  const W = 280, H = 56, padX = 4, padY = 10;
  const vals = points.map(p => p.est1rm);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max - min) || 1;
  const plotW = W - padX * 2, plotH = H - padY * 2;
  const x = i => padX + (i / (points.length - 1)) * plotW;
  const y = v => padY + plotH - ((v - min) / range) * plotH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.est1rm).toFixed(1)}`).join(' ');
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ marginBottom: 10 }}>
      <SvgLine x1={padX} y1={y(points[0].est1rm)} x2={W - padX} y2={y(points[0].est1rm)} stroke={colors.textFaint} strokeWidth="1" strokeDasharray="3,4" opacity={0.5} />
      <Path d={path} fill="none" stroke={colors.danger} strokeWidth="2" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={x(i)} cy={y(p.est1rm)} r={i === points.length - 1 ? 4 : 2.5} fill={colors.danger} />
      ))}
    </Svg>
  );
}

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
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  // Seconds the current question has been in flight. Most replies land in
  // 2-8s, but a multi-day sweep ("no barbell for two weeks") legitimately
  // takes ~35s because the coach rewrites every affected slot on every day.
  // A single frozen "Thinking..." for that long reads as a hang, so the label
  // below advances through what is actually happening.
  const [askElapsed, setAskElapsed] = useState(0);
  // `answer` is now ERROR-ONLY. Successful replies live in conversationHistory and
  // are rendered as the thread — previously only the newest answer was ever drawn,
  // so asking a follow-up silently erased the conversation the coach still
  // remembered and referred back to.
  const [answer, setAnswer] = useState(null);
  // The question in flight. conversationHistory isn't updated until the reply
  // lands, so without this the user's own message vanishes while they wait.
  const [pendingQuestion, setPendingQuestion] = useState(null);
  // Gates the answer panel: conversationHistory is reloaded from coach_memory on
  // every open (so the coach still has full context), but that used to also make
  // an old exchange from days ago pop up looking like something new. This only
  // flips true once the user actually asks something THIS session.
  const [hasAskedThisSession, setHasAskedThisSession] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [confirmingIndex, setConfirmingIndex] = useState(null);
  const [proposalSaved, setProposalSaved] = useState(false);
  const [alternatives, setAlternatives] = useState(null);
  const [userData, setUserData] = useState(null);
  const [focusDismissed, setFocusDismissed] = useState(false); // local-only, resets next load — "not now", not permanent
  const [undoing, setUndoing] = useState(false);
  const [quota, setQuota] = useState({ used: 0, remaining: MONTHLY_QUOTA });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState(null);
  // Adaptive Response Engine — one step of the closed loop, run on load.
  // Holds { action, experiment, experimentRow, evaluation, blocked }.
  const [are, setAre] = useState(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyOffered, setWeeklyOffered] = useState(false); // review is due, not yet generated
  const weeklyReviewChecked = useRef(false);
  const scrollRef = useRef(null);
  const askCardY = useRef(0); // captured via onLayout — real scroll target, not a guess

  // Follow the newest turn — but only once the user has actually asked something
  // this session. conversationHistory is reloaded from coach_memory on open (so the
  // coach keeps context), and without this guard that cold load would fire a
  // scrollToEnd and dump the user at the bottom, past the focus card, onto an empty
  // answer panel. Timeout lets the new turn lay out before we measure — scrolling on
  // the same tick lands short of the actual end.
  // Scroll to the reply ONCE, when it arrives — keyed on the number of
  // completed turns only. It used to also depend on `asking` and
  // `pendingQuestion`, which change at the start AND end of every request, so
  // the view yanked itself downward the instant you hit send, before there was
  // anything new to look at. Nothing has been rendered at that point; the jump
  // just steals the position you were reading from.
  useEffect(() => {
    if (!hasAskedThisSession) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(id);
  }, [conversationHistory.length, hasAskedThisSession]);

  // Drives the staged "thinking" label. Resets to 0 whenever a request ends so
  // the next question starts from the first stage rather than the last one.
  useEffect(() => {
    if (!asking) { setAskElapsed(0); return; }
    const startedAt = Date.now();
    const id = setInterval(() => setAskElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [asking]);

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
    setHasAskedThisSession(false);
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

    const [{ data: profile }, { data: sessions }, { data: cardioSessions }, { data: healthLogs }, { data: nutritionLogs }, { data: bodyMetrics }, { data: streakSessions }, { data: insightSessions }, { data: insightNutrition }, { data: insightHealth }, recoveryCheckIns] = await Promise.all([
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
      // Manually logged (Profile's "Log today's weight"), not automatic — no
      // guaranteed daily density, so this stays a list of whatever was actually
      // logged, not an assumed-continuous trend.
      supabase.from('body_metrics')
        .select('date, weight_kg')
        .eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), 30), 'yyyy-MM-dd'))
        .order('date', { ascending: false }),
      // Wider, single-column window just for the streak calc — the main
      // `sessions` query above is capped at 20 rows for prompt size, which
      // would silently truncate a longer real streak.
      supabase.from('workout_sessions')
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', subDays(new Date(), 180).toISOString())
        .order('completed_at', { ascending: false }),
      // 60-day windows for computeInsights() — the same performance-correlation
      // engine ProfileScreen's "What's driving your training" already runs.
      // Separate from the queries above since those are scoped to 7/20 rows
      // for different purposes; insights needs real history to find a signal.
      supabase.from('workout_sessions')
        .select('id, completed_at, perceived_exertion, session_type')
        .eq('user_id', user.id)
        .gte('completed_at', subDays(new Date(), 60).toISOString()),
      supabase.from('nutrition_logs')
        .select('date, protein_g, calories')
        .eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), 60), 'yyyy-MM-dd')),
      supabase.from('daily_health_logs')
        .select('date, sleep_hours, hrv_ms')
        .eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), 60), 'yyyy-MM-dd')),
      getRecentCheckIns(7),
    ]);

    // Same transform ProfileScreen does before calling computeInsights — kept
    // identical so the two surfaces can't produce different findings from the
    // same underlying data.
    const insightNutByDate = {};
    (insightNutrition || []).forEach(l => {
      if (!insightNutByDate[l.date]) insightNutByDate[l.date] = { protein: 0, calories: 0 };
      insightNutByDate[l.date].protein += l.protein_g || 0;
      insightNutByDate[l.date].calories += l.calories || 0;
    });
    const insightHealthByDate = {};
    (insightHealth || []).forEach(l => { insightHealthByDate[l.date] = { sleep_hours: l.sleep_hours, hrv_ms: l.hrv_ms }; });
    const insights = computeInsights({
      sessions: (insightSessions || []).filter(s => !s.session_type || s.session_type === 'strength'),
      nutritionByDate: insightNutByDate,
      healthByDate: insightHealthByDate,
      targets: { protein_target: profile?.protein_target, caloric_target: profile?.caloric_target },
    });

    // Same algorithm as ProfileScreen's streak stat — consecutive weeks with
    // at least 1 session. Kept in sync deliberately: if this ever needs to
    // change, change it in both places or Coach and Profile will disagree.
    let streak = 0;
    if (streakSessions?.length) {
      const weekSet = new Set(streakSessions.map(s => {
        const weekStart = startOfWeek(new Date(s.completed_at), { weekStartsOn: 1 });
        return weekStart.toISOString().split('T')[0];
      }));
      const sortedWeeks = [...weekSet].sort().reverse();
      let checkDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      for (const wk of sortedWeeks) {
        const wkDate = new Date(wk);
        const diff = Math.round((checkDate - wkDate) / (1000 * 60 * 60 * 24 * 7));
        if (diff <= 1) { streak++; checkDate = wkDate; } else break;
      }
    }

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
    // Same detectors TodayScreen runs — reusing them here (not re-deriving
    // plateau/deload logic independently) is what keeps Coach from ever
    // contradicting what the user already sees on Today.
    let plateaus = [];
    let plateauTrend = [];
    let deloadSuggestion = null;
    let fatigueSignature = null;
    let recentSetsForProgress = []; // hoisted out of the block below — needed later for readyToProgress
    // Every logged set with its session date attached — the shape the Individual
    // Response Model reads. completed_sets carries no date of its own, so the
    // session's completed_at is joined on here rather than in a second query.
    let modelSets = [];

    if (sessions?.length) {
      const ids = sessions.map(s => s.id);
      const { data: sets } = await supabase.from('completed_sets')
        .select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);

      if (sets?.length) {
        const sevenDaysAgo = subDays(new Date(), 7);
        const sessionDateMap = {};
        sessions.forEach(s => { sessionDateMap[s.id] = new Date(s.completed_at); });

        modelSets = sets
          .filter(x => sessionDateMap[x.session_id])
          .map(x => ({
            exercise_name: x.exercise_name,
            weight_kg: x.weight_kg,
            reps: x.reps,
            completed_at: sessionDateMap[x.session_id].toISOString(),
          }));

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

        // Mirror TodayScreen: last 30 days, RPE pulled from the session's
        // perceived_exertion (no per-set RPE is logged).
        const thirtyDaysAgo = subDays(new Date(), 30);
        const sessionRpeMap = {};
        sessions.forEach(s => { sessionRpeMap[s.id] = s.perceived_exertion; });
        const setsWithDates = sets.map(s => ({
          ...s,
          completed_at: sessionDateMap[s.session_id]?.toISOString(),
          rpe: sessionRpeMap[s.session_id] ?? null,
        })).filter(s => s.completed_at && new Date(s.completed_at) >= thirtyDaysAgo);
        const sessions30d = sessions.filter(s => new Date(s.completed_at) >= thirtyDaysAgo);

        plateaus = detectPlateaus(setsWithDates, profile);
        deloadSuggestion = detectDeloadNeeded(sessions30d, setsWithDates, profile);
        recentSetsForProgress = setsWithDates;

        // Objective, wearable-free readiness: fits each lift's trend on its
        // OLDER sessions, predicts the recent ones, and measures how far actual
        // performance fell below that prediction. This is complementary to
        // deloadSuggestion's RPE-based signal above (self-reported effort) —
        // this one needs no self-report at all, just logged weight×reps, and it
        // was computed by individualModel.js for the Adaptive Response Engine
        // but never actually read by anything until now.
        fatigueSignature = computeFatigueSignature(modelSets);

        // Real per-session trend for the plateaued exercise — same Epley 1RM
        // estimate and per-session max that detectPlateaus computes internally,
        // just exposed as a series instead of only the final stall verdict.
        // This is real data (recentSetsForProgress), not a decorative chart.
        if (plateaus[0]?.exercise) {
          const byDate = {};
          setsWithDates
            .filter(s => s.exercise_name === plateaus[0].exercise && s.weight_kg && s.reps)
            .forEach(s => {
              const day = new Date(s.completed_at).toDateString();
              const est1rm = s.reps === 1 ? s.weight_kg : s.weight_kg * (1 + s.reps / 30);
              if (!byDate[day] || est1rm > byDate[day]) byDate[day] = est1rm;
            });
          plateauTrend = Object.entries(byDate)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .slice(-6)
            .map(([date, est1rm]) => ({ date, est1rm: Math.round(est1rm) }));
        }
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
    let recentChanges = [];
    let changeEffectiveness = null;
    let activeConditions = [];
    if (program) {
      const { data: overrides } = await supabase
        .from('program_template_overrides')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (overrides?.length) {
        const equipment = normalizeEquipment(profile.equipment || []);
        const currentSplit = profile.selected_split ?? null;
        overrides.forEach(o => {
          // Day ids are reused across DIFFERENT splits ('upper_a' exists on both
          // Upper/Lower 4x and 6x, with different exercises on it). A row with a
          // split_id that doesn't match the split the user is on NOW belongs to a
          // different program shape entirely — applying it here would land on
          // whatever exercise happens to share the old slot signature, not the
          // one the user actually edited. Skip it outright.
          if (o.split_id != null && o.split_id !== currentSplit) return;

          // Mirror TodayScreen exactly: resolve by slot_id so the program the coach
          // reasons about is the SAME one the user sees. Applying by raw
          // exercise_index here would mis-target once a slot has shifted position
          // between generations (injury/equipment/level change, a whole pattern
          // going disliked) — and then the index the model is given diverges from
          // reality and proposals miss. Heal legacy rows to slot identity too.
          let healSlotId = null;
          if (!o.slot_id) {
            const day = program.days?.find(d => d.id === o.day_id);
            healSlotId = day?.exercises?.[o.exercise_index]?.slotId ?? null;
          }
          program = applyPermanentEdit(program, {
            type: o.edit_type,
            dayId: o.day_id,
            slotId: o.slot_id ?? healSlotId ?? undefined,
            exerciseIndex: o.exercise_index,
            patternKey: o.pattern_key,
            preferExerciseId: o.exercise_id,
            sets: o.sets,
            reps: o.reps,
            rpe: o.rpe,
          }, equipment);
          if (!o.slot_id && healSlotId) {
            supabase.from('program_template_overrides')
              .update({ slot_id: healSlotId })
              .eq('id', o.id)
              .then(() => {}, () => {});
          }
          // Legacy row, no split recorded at all: it resolved against a slot in
          // the CURRENT program above, so stamp it with the current split — the
          // closest honest guess available, and it stops this row from being an
          // open question on every future read.
          if (o.split_id == null && currentSplit) {
            supabase.from('program_template_overrides')
              .update({ split_id: currentSplit })
              .eq('id', o.id)
              .then(() => {}, () => {});
          }
        });

        // A readable log of what Coach itself has already changed — without this,
        // any "I already did X" the coach says is fabricated, not remembered.
        // Resolved against the final program state, so names reflect what's
        // actually in the slot now rather than a stale pre-edit label.
        // id carried alongside the display text so the done-strip's Undo can
        // delete this exact override row — not just re-word what happened.
        recentChanges = overrides.slice(-10).reverse().map(o => {
          const day = program.days?.find(d => d.id === o.day_id);
          const dayName = day?.name?.split('—')[0].trim() || o.day_id;
          const when = o.created_at ? format(new Date(o.created_at), 'MMM d') : 'unknown date';
          const resolved = o.exercise_id ? MOVEMENT_PATTERNS[o.pattern_key]?.exercises.find(e => e.id === o.exercise_id) : null;
          const slotEx = day?.exercises?.find(e => e.slotId === o.slot_id) || day?.exercises?.[o.exercise_index];
          const exName = resolved?.name || slotEx?.name || 'an exercise';
          let text;
          switch (o.edit_type) {
            case 'replace_exercise': text = `${when}: swapped in ${exName} (${dayName})`; break;
            case 'remove_exercise': text = `${when}: removed ${exName} (${dayName})`; break;
            case 'adjust_sets': text = `${when}: changed ${exName} to ${o.sets} sets (${dayName})`; break;
            case 'adjust_reps': text = `${when}: changed ${exName} to ${o.reps} reps (${dayName})`; break;
            case 'adjust_rpe': text = `${when}: changed ${exName} target RPE to ${o.rpe} (${dayName})`; break;
            default: text = `${when}: updated ${exName} (${dayName})`; break;
          }
          return { text, id: o.id };
        });

        // Did Coach's own last set-count change actually hold? Real check, not
        // a restated fact — looks at completed_sets logged after the edit for
        // the same exercise. Only claims "holding" with evidence (2+ sessions
        // since); otherwise it stays quiet rather than guessing.
        const lastSetsEdit = [...overrides].reverse().find(o => o.edit_type === 'adjust_sets' && o.created_at);
        if (lastSetsEdit) {
          const day = program.days?.find(d => d.id === lastSetsEdit.day_id);
          const resolved = lastSetsEdit.exercise_id ? MOVEMENT_PATTERNS[lastSetsEdit.pattern_key]?.exercises.find(e => e.id === lastSetsEdit.exercise_id) : null;
          const slotEx = day?.exercises?.find(e => e.slotId === lastSetsEdit.slot_id) || day?.exercises?.[lastSetsEdit.exercise_index];
          const exName = resolved?.name || slotEx?.name;
          const editDate = new Date(lastSetsEdit.created_at);
          const sessionsSince = new Set(
            recentSetsForProgress
              .filter(s => s.exercise_name === exName && new Date(s.completed_at) > editDate)
              .map(s => s.completed_at.slice(0, 10))
          ).size;
          if (exName && sessionsSince >= 2) {
            changeEffectiveness = `${exName} moved to ${lastSetsEdit.sets} sets ${format(editDate, 'MMM d')} — sets have stayed clean since, that change is holding.`;
          }
        }
      }
      const baselineInjuryConditions = getConditionsFromInjuryProfile(profile.injury_profile || []);
      const mergedConditions = [...new Set([...(profile.health_conditions || []), ...baselineInjuryConditions])];
      activeConditions = mergedConditions;
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

    // checkReadyToProgress already exists and is real — it just only ever
    // fired once, mid-set, during a live workout (WorkoutExecutionScreen).
    // This is the first place it's aggregated across the whole program and
    // surfaced proactively instead of being easy to miss.
    let readyToProgress = [];
    if (program?.days && recentSetsForProgress.length) {
      const seen = new Set();
      for (const day of program.days) {
        for (const ex of (day.exercises || [])) {
          if (!ex?.name || seen.has(ex.name)) continue;
          seen.add(ex.name);
          const result = checkReadyToProgress(recentSetsForProgress, ex.name, ex.reps);
          if (result.status === 'increase_weight') {
            readyToProgress.push(`${ex.name} ready for more weight — ${result.note}`);
          }
          if (readyToProgress.length >= 2) break;
        }
        if (readyToProgress.length >= 2) break;
      }
    }

    // checkProgramVolume was tried here and removed — it lowercases raw
    // muscle strings ('Lats', 'Rhomboids', 'Rear delts') and compares them
    // directly against VOLUME_TARGETS keys ('back', 'side_delts'), which
    // never match without the same head-aggregation headVol/weeklyVolume do
    // elsewhere in this file. Verified empirically: it reported 0 sets for
    // back and side delts on a normal, unconstrained, fully-equipped program.
    // Real bug, not real signal — do not re-add without fixing the function
    // itself first (aggregate by DELT_HEADS/CHEST_HEADS/BACK_HEADS the same
    // way volumeLines above does, not a raw per-muscle-string lowercase).

    // detectRotationTrigger — combines block-end, plateau, and skip-pattern
    // signals into one prioritized rotation call per exercise. Real detector,
    // never called anywhere in the app before this either.
    let rotationDue = null;
    if (program?.days && recentSetsForProgress.length) {
      for (const day of program.days) {
        if (rotationDue) break;
        for (const ex of (day.exercises || [])) {
          if (!ex?.name) continue;
          const trigger = detectRotationTrigger(ex.name, recentSetsForProgress, recentSessions, blockStartDate, profile?.trainingExperience || 'beginner');
          if (trigger.trigger !== 'none') {
            rotationDue = `${ex.name} — ${trigger.reason}`;
            break;
          }
        }
      }
    }

    // The exact same call TodayScreen makes to decide what to push as a
    // notification. Without this, a user who taps that notification and opens
    // Coach to follow up finds a coach that has no idea what it just told them.
    const lastSessionDate = recentSessions[0]?.completed_at ? new Date(recentSessions[0].completed_at) : null;
    const daysSinceLastSession = lastSessionDate
      ? Math.floor((Date.now() - lastSessionDate.getTime()) / 86400000)
      : null;
    const todayCheckIn = await getTodayCheckIn().catch(() => null);
    const recoveryLabel = todayCheckIn?.skipped ? null : (todayCheckIn?.label ?? null);

    // Read-only mirror of TodayScreen's milestone check — Coach must never
    // contradict what the notification already told the user, but only
    // TodayScreen (the surface that actually shows the nudge) marks one shown.
    let goalMilestone = null;
    if (profile?.goals?.length) {
      const goalStartedAt = await AsyncStorage.getItem('goalStartedAt');
      if (goalStartedAt) {
        const weeksSinceGoalStart = Math.floor((Date.now() - new Date(goalStartedAt).getTime()) / (7 * 86400000));
        const eligible = getEligibleGoalMilestones(profile.goals, weeksSinceGoalStart, profile.weight_kg, profile.target_weight_kg);
        if (eligible.length) {
          const shownRaw = await AsyncStorage.getItem('shownMilestoneIds');
          const shown = shownRaw ? JSON.parse(shownRaw) : [];
          goalMilestone = eligible.find(m => !shown.includes(m.id)) || null;
        }
      }
    }

    const proactivePrompt = getProactiveCoachPrompt({
      daysSinceLastSession,
      weeklyWorkoutsTarget: profile?.weekly_workouts || 3,
      deload: deloadSuggestion,
      plateaus,
      recoveryLabel,
      goalMilestone,
    });

    // Neglected major muscle — a regression signal, not a "you stopped" one.
    // Only fires when the user IS actively training (trained in the last 3 days),
    // for a major group that (a) their program actually targets and (b) they HAVE
    // trained inside the 30-day window but not in 8+ days. Requiring a prior
    // last-trained date means we flag a group that slipped, never one a new user
    // simply hasn't cycled to yet — a factual gap, not a guess. This is the safe,
    // always-checkable read that keeps the focus card populated between the rarer
    // plateau/deload/correlation triggers.
    const MAJOR_GROUPS = { chest: 'Chest', back: 'Back', quads: 'Quads', hamstrings: 'Hamstrings', shoulders: 'Shoulders' };
    let neglectedMuscle = null;
    if (recentSetsForProgress.length && daysSinceLastSession != null && daysSinceLastSession <= 3) {
      const programGroups = new Set();
      (program?.days || []).forEach(day => (day.exercises || []).forEach(ex => {
        const g = getPrimaryMuscle(ex.name);
        if (g && MAJOR_GROUPS[g]) programGroups.add(g);
      }));
      const lastTrained = {};
      recentSetsForProgress.forEach(s => {
        const g = getPrimaryMuscle(s.exercise_name);
        if (!g || !MAJOR_GROUPS[g] || !programGroups.has(g)) return;
        const d = new Date(s.completed_at);
        if (!lastTrained[g] || d > lastTrained[g]) lastTrained[g] = d;
      });
      let worst = null;
      Object.entries(lastTrained).forEach(([g, last]) => {
        const gapDays = Math.floor((Date.now() - last.getTime()) / 86400000);
        if (gapDays >= 8 && (!worst || gapDays > worst.gapDays)) worst = { group: g, label: MAJOR_GROUPS[g], gapDays };
      });
      if (worst) neglectedMuscle = worst;
    }

    const data = { profile, weeklyVolume, headVol, prs, recentSessions, program, blockIndex, blockStartDate, cardioSessions: cardioSessions || [], healthLogs: healthLogs || [], nutritionLogs: nutritionLogs || [], bodyMetrics: bodyMetrics || [], recoveryCheckIns: recoveryCheckIns || [], recentChanges, changeEffectiveness, readyToProgress, rotationDue, activeConditions, plateaus, plateauTrend, deloadSuggestion, fatigueSignature, dislikedIds, streak, insights, proactivePrompt, neglectedMuscle };
    setUserData(data);

    // ── Adaptive Response Engine ────────────────────────────────────────────
    // One step of the closed loop, off the critical path: it must never block
    // or break the Coach screen, so it runs detached and swallows its own
    // errors. The engine decides whether there is anything worth testing; the
    // guardrail inside areStore keeps it silent until there is enough history
    // to model this person honestly, rather than inventing a finding.
    (async () => {
      try {
        const weeksOfHistory = recentSessions.length
          ? Math.max(1, Math.round((Date.now() - new Date(recentSessions[recentSessions.length - 1].completed_at)) / 6048e5))
          : 0;
        const result = await areStep(user.id, {
          sets: modelSets,
          program,
          profile,
          weeklyVolume,
          weeksOfHistory,
        });
        setAre(result);
      } catch (e) {
        // A missing table (migration not applied yet) lands here and stays
        // invisible to the user, which is the correct failure mode for an
        // opt-in research loop.
        setAre(null);
      }
    })();

    return data;
  };

  const buildContext = (data) => {
    const { profile, headVol = {}, prs, recentSessions, program, cardioSessions, healthLogs, nutritionLogs = [], bodyMetrics = [], recoveryCheckIns = [], recentChanges = [], activeConditions = [], plateaus = [], deloadSuggestion = null, fatigueSignature = null, dislikedIds = [], streak = 0, insights = [], proactivePrompt = null, rotationDue = null } = data;
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

    // Patterns with exactly one slot in the whole program: replacing that slot
    // out-of-group (or removing it) deletes the region's training entirely.
    // The model must see that stake on the exact line it is about to touch.
    const solePatterns = program ? soleSlotPatterns(program.days) : new Set();
    const programLines = program
      ? program.days.map(day =>
          `  ${day.id} — ${day.name}${day.optional ? ' (optional day — only done when the user chooses to)' : ''}:\n${day.exercises.map((ex, idx) => {
            // Pattern label, not muscles: the muscle tag collapsed regions
            // (lower/upper/mid chest all read as plain "chest"), which is how a
            // decline slot ended up being offered flat-bench replacements. The
            // label names the AVAILABLE EXERCISES group the slot belongs to.
            // Muscles remain the fallback for names that aren't in the library.
            const patternLabel = getPatternLabelForExercise(ex.name);
            const muscles = getMuscles(ex.name);
            const tag = patternLabel
              ? ` [${patternLabel}]`
              : muscles.length ? ` [${muscles.join('/')}]` : '';
            const patternKey = resolveExerciseByName(ex.name)?.patternKey;
            const sole = patternKey && solePatterns.has(patternKey)
              ? ' — SOLE slot for this group in the program' : '';
            // Equipment the slot actually needs, machine-readable. Exercise
            // names don't reliably encode it ("Incline bench row (wide grip)"
            // is a barbell movement and reads like it isn't), and an
            // equipment sweep that misses a slot leaves the user with an
            // exercise they can't perform. With this tag the edge function
            // can compute the affected set from the program itself instead of
            // trusting the model to spot every one by name.
            const equip = (ex.equipment_required || []).join('+');
            const equipTag = equip ? ` {equip:${equip}}` : '';
            // Same idea as the equipment tag, for the other two things a
            // multi-slot sweep is ever keyed on: the movement pattern (an
            // injury rules out a pattern, not an exercise) and the exercise
            // itself (a dislike). With all three machine-readable, the edge
            // function can derive the full affected set for any sweep rather
            // than trusting the model to have spotted every instance.
            const patKey = ex.pattern || patternKey;
            const patTag = patKey ? ` {pat:${patKey}}` : '';
            return `    [${idx}] ${ex.name}${tag} (${ex.sets ?? 3}×${ex.reps || '8–12'}, rest ${ex.rest || '2 min'})${equipTag}${patTag}${sole}`;
          }).join('\n')}`
        ).join('\n')
      : '  Program not available';

    // Same day[0] simplification the "Next Up" card uses elsewhere — without
    // an explicit anchor, "the workout" / "today's workout" with no day named
    // is ambiguous to the model and it addresses the whole program instead of
    // one session (caught via live scenario testing).
    const nextSessionLine = program?.days?.[0]
      ? `Next scheduled session: ${program.days[0].name.split('—')[0].trim()} (day_id: ${program.days[0].id}) — this is what "the workout" / "today's workout" means when the user names no specific day.`
      : 'Next scheduled session: not available';

    // How the days are actually spaced — without this, Coach can't reason
    // about fatigue relative to the program's own built-in recovery structure
    // (e.g. "you have 0 rest days between Upper A and Lower A").
    const restBetweenLine = program?.rest_between?.length
      ? program.days.filter(d => !d.optional).map((day, i, arr) => {
          if (i === arr.length - 1) return null;
          const rest = program.rest_between[i] || 0;
          return `${day.name.split('—')[0].trim()} → ${rest === 0 ? 'no rest day' : `${rest} rest day(s)`} → ${arr[i + 1].name.split('—')[0].trim()}`;
        }).filter(Boolean).join('; ')
      : 'not available';

    // The coach's menu of REAL exercises (equipment-filtered). Without this it
    // invents exercise names (e.g. a nonexistent "Cable fly (low to high)") and
    // gets their muscle targeting wrong. The library names encode the region, so
    // forcing the model to copy from here also fixes wrong-region picks.
    const menuEquipment = normalizeEquipment(profile?.equipment || []);
    // Structural safety, not just a prompt instruction: hard-blocked patterns
    // (e.g. overhead pressing with a shoulder injury) never appear in the menu
    // at all, so Coach can't propose them even if it ignores the SAFETY note
    // below. Soft-blocked patterns stay in, flagged inline, since they're
    // usable with modification rather than off-limits.
    const expandedConditions = expandAllConditions(activeConditions);
    const excludedPatternLines = [];
    const libraryLines = Object.entries(MOVEMENT_PATTERNS).map(([key, pat]) => {
      const block = expandedConditions.length ? getPatternContraindication(key, expandedConditions) : null;
      if (block?.hard) {
        excludedPatternLines.push(`  ${pat.label} — excluded, contraindicated with a condition on file`);
        return null;
      }
      const exs = (getAllExercisesForPattern(key, menuEquipment) || []).map(e => e.name);
      if (!exs.length) return null;
      return block ? `  ${pat.label} [caution — condition on file]: ${exs.join(', ')}` : `  ${pat.label}: ${exs.join(', ')}`;
    }).filter(Boolean).join('\n');

    // Physiologically possible ranges. A live probe of the coach produced the
    // reply "your sleep data has logging errors (91h and 16h entries aren't
    // usable)" — the model was being handed a 91-hour night and spending its
    // answer explaining that the app's own data was broken. Nothing outside
    // these bounds is a measurement; it is a sync artefact or a bad write, and
    // it should never reach the model at all.
    const SANE = {
      sleep_hours: [2, 14],
      hrv_ms: [10, 200],
      resting_hr: [30, 120],
      steps: [0, 100000],
    };
    const sane = (field, v) => {
      const r = SANE[field];
      return typeof v === 'number' && Number.isFinite(v) && v >= r[0] && v <= r[1] ? v : null;
    };
    const cleanLogs = (healthLogs || [])
      .map(l => ({
        date: l.date,
        sleep_hours: sane('sleep_hours', l.sleep_hours),
        hrv_ms: sane('hrv_ms', l.hrv_ms),
        resting_hr: sane('resting_hr', l.resting_hr),
        steps: sane('steps', l.steps),
      }))
      // A row whose every value was rejected carries nothing but a date.
      .filter(l => l.sleep_hours || l.hrv_ms || l.resting_hr || l.steps);

    const healthLines = cleanLogs.length
      ? (() => {
          const healthLogs = cleanLogs;
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
      : null;

    // Send the heading only when there is something under it. Android Health
    // Connect was removed outright after the Play policy rejection, so on the
    // only shipped platform healthLines is ALWAYS null — and a section headed
    // "Recovery data" containing "no data connected" still invites the model to
    // discuss sleep and HRV, which is exactly what it did. Absent beats empty.
    const healthBlock = healthLines ? `Recovery data (last 7 days):\n${healthLines}\n\n` : '';

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

    // Which specific days sports/cardio actually land on — without this, Coach
    // can't reason about scheduling (e.g. "don't squat the day before your run")
    // even though it already knows sports exist via activityTypes.
    const sportsLine = (profile?.sports || []).length
      ? profile.sports.map(s => `${s.label || s.key}${(s.days || []).length ? ` (${s.days.join(', ')})` : ' (no days set)'}`).join('; ')
      : 'none';

    // dislikedIds silently keeps these exercises out of the generated program
    // below — stated explicitly so Coach can explain an absence if asked, same
    // reasoning as the injuries block.
    const dislikedNames = dislikedIds.length
      ? dislikedIds.map(id => {
          for (const pattern of Object.values(MOVEMENT_PATTERNS)) {
            const ex = pattern.exercises.find(e => e.id === id);
            if (ex) return ex.name;
          }
          return null;
        }).filter(Boolean).join(', ')
      : 'none';

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
      ? `  Strategy: ${profile?.nutrition_focus || 'not set'} (this is WHY the targets are what they are — a cutting user under target is a problem, a bulking user under target may not be)\n` +
        `  Daily target: ${nutTargets.calories} kcal · ${nutTargets.protein}g protein · ${nutTargets.carbs}g carbs · ${nutTargets.fat}g fat\n` +
        (nutAvg
          ? `  Logged average over last ${nutDays.length} day(s): ${nutAvg.calories} kcal · ${nutAvg.protein}g protein · ${nutAvg.carbs}g carbs · ${nutAvg.fat}g fat`
          : `  No food logged in the last 7 days`)
      : '  No calorie/macro targets set yet';

    // Manually logged (Profile's "Log today's weight") — never assume daily
    // density. State exactly how many entries exist in the window so the model
    // doesn't imply a smooth trend from 2 sparse data points.
    const bodyweightBlock = bodyMetrics.length
      ? (() => {
          const sorted = [...bodyMetrics].sort((a, b) => new Date(a.date) - new Date(b.date));
          const first = sorted[0], last = sorted[sorted.length - 1];
          const delta = Math.round((last.weight_kg - first.weight_kg) * 10) / 10;
          const trend = sorted.length >= 3
            ? `  ${first.date}: ${first.weight_kg}kg → ${last.date}: ${last.weight_kg}kg (${delta >= 0 ? '+' : ''}${delta}kg over ${sorted.length} logged entries)`
            : `  Only ${sorted.length} entry(ies) in the last 30 days — not enough to call a trend`;
          return trend;
        })()
      : '  No weigh-ins logged in the last 30 days';

    // Injuries/conditions are already used to silently filter contraindicated
    // exercises out of the program below — without stating them explicitly here,
    // the coach can benefit from that filtering but can never explain it (e.g.
    // "why no overhead press?" has no answer without this).
    const injuryLines = (profile?.injury_profile || []).length
      ? profile.injury_profile.map(i => {
          const bp = INJURY_BODY_PARTS.find(b => b.key === i.body_part);
          return `${bp?.label || i.body_part} (${i.severity})`;
        }).join(', ')
      : 'none reported';
    const conditionsLine = activeConditions.length ? activeConditions.join(', ') : 'none';

    // If this is set, the app already pushed this exact thing to the user as a
    // notification today (same function, same priority order TodayScreen uses).
    // If they're asking about it, you already raised it — don't act surprised.
    const proactiveLine = proactivePrompt
      ? `You already proactively flagged this to the user today (as a notification): "${proactivePrompt.title} — ${proactivePrompt.body}"\n\n`
      : '';

    return `${proactiveLine}User profile:
- Name: ${profile?.name || 'unknown'}
- Experience: ${exp}
- Goal: ${(profile?.goals || []).join(', ') || 'not set'}
- Activities: ${activityTypes}
- Sports schedule: ${sportsLine}
- Equipment available: ${(profile?.equipment || []).join(', ') || 'none set'}
- Supplements: ${(profile?.supplements || []).filter(s => s !== 'None').join(', ') || 'none'}
- Training: ${profile?.weekly_workouts} days/week, ${profile?.session_length} min sessions
- Current streak: ${streak} consecutive week${streak === 1 ? '' : 's'} trained
- Weight: ${profile?.weight_kg}kg${profile?.target_weight_kg ? ` (target ${profile.target_weight_kg}kg)` : ''}, Height: ${profile?.height_cm}cm
- Exercises excluded from the program (disliked/repeatedly skipped): ${dislikedNames}
- Injuries: ${injuryLines}
- Active conditions (already filtered out of the program below): ${conditionsLine}
${memoryBlock}
Current program: ${program?.name || 'unknown'} (split ID: ${profile?.selected_split || 'unknown'})
Days and exercises ("SOLE slot" = the program's only work for that group; losing
that slot means the user stops training that region at all):
${programLines}

${nextSessionLine}

Rest days between sessions (the program's own built-in spacing):
  ${restBetweenLine}

Changes you (the coach) already made to this program — do not re-propose these,
and you can truthfully reference having already done them:
${recentChanges.length ? recentChanges.map(c => `  - ${c.text}`).join('\n') : '  None yet'}

AVAILABLE EXERCISES (equipment-filtered; patterns hard-contraindicated by the
conditions on file are already removed below — you cannot propose them because
they are not in this list). When you propose adding or replacing an exercise,
the exercise_name MUST be copied EXACTLY from this list — never invent, rename,
or paraphrase an exercise. The name already encodes the target region (e.g.
"Cable crossover (lower chest)"), so pick the one that matches the user's
request. If nothing here fits, say so instead of proposing.

The list is grouped by movement pattern, and each exercise in the program above
is tagged with the group it belongs to. A REPLACEMENT MUST COME FROM THE SAME
GROUP as the exercise being replaced — that group is the training slot, and
leaving it silently deletes the region the program allocated sets to. "Chest —
Decline / Lower Chest", "Chest — Incline Push (Upper Chest)" and "Chest —
Horizontal Push" are three DIFFERENT slots, not interchangeable bench variants.
Only cross groups if the user explicitly asks for a different movement (or
every option in the group is excluded), and say so in your reply when you do:
${libraryLines}
${excludedPatternLines.length ? `\nPatterns removed from the list above (contraindicated, no safe substitute to mention):\n${excludedPatternLines.join('\n')}\n` : ''}
SAFETY — some patterns above are marked "[caution — condition on file]": they are
still usable but need modification (reduced range, different grip, lighter load,
etc). Before proposing one of those, state the modification, matching the reason
implied by the condition on file. This applies even when the user explicitly
asks for that exercise by name — explain the caution rather than refusing outright,
since these are soft, not hard, restrictions.

EVIDENCE BASE — the app's curated findings. This is your source of truth: cite and
stay consistent with these, and do NOT contradict them or invent science beyond
them. If something isn't covered here, say it's outside the app's evidence base
rather than guessing:
${formatEvidenceBase()}

This week's volume — last 7 days (sets per muscle):
${volumeLines}
${rotationDue ? `\nRotation due (block-end / plateau / skip-pattern trigger): ${rotationDue}\n` : ''}
Personal records:
${prLines}

Plateau detection (same detector Today shows — stay consistent with it, never
contradict a plateau or its absence):
${plateaus.length ? plateaus.map(p => `  - ${p.exercise}: ${p.type === 'confirmed' ? 'confirmed' : 'early'} plateau, ${p.days} days without progress (est. 1RM ${p.est1rm}kg)`).join('\n') : '  None detected'}

Deload status (same detector Today shows):
${deloadSuggestion
  ? `  Recommended — ${deloadSuggestion.headline} (${deloadSuggestion.trigger === 'autoreg' ? 'fatigue-triggered' : `${deloadSuggestion.weeksTraining} weeks of consistent training`}). ${Math.round(deloadSuggestion.volumeReduction * 100)}% fewer sets suggested this week.`
  : '  Not currently suggested'}

Objective readiness (fits each lift's own trend on older sessions, compares recent
sessions against that prediction — needs no self-report, just logged weight×reps.
Different signal from deload status above, which is RPE-based):
${fatigueSignature?.label
  ? `  ${fatigueSignature.label === 'fatigued' ? 'Fatigued' : fatigueSignature.label === 'moderate' ? 'Moderately fatigued' : 'Fresh'} — recent performance is ${fatigueSignature.deviationPct}% ${fatigueSignature.deviationPct < 0 ? 'below' : 'above'} this user's own trajectory across ${fatigueSignature.lifts} lift(s).`
  : '  Not enough history yet to call this'}

Performance correlations (same engine ProfileScreen's insights card uses —
sleep/nutrition patterns found against actual session RPE, not generic advice):
${insights.length ? insights.map(i => `  - ${i}`).join('\n') : '  Not enough history yet to correlate'}

Recent strength sessions:
${sessionLines}

Recent cardio sessions:
${cardioLines}

${healthBlock}Self-reported readiness (last 7 days):
${checkInLines}

Nutrition — targets vs recent intake:
${nutritionBlock}

Bodyweight (last 30 days, manually logged — may be sparse):
${bodyweightBlock}${workoutContext ? `\n\nCurrent live workout (user is training right now):\n${workoutContext}` : ''}`;
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
    const isAdd = isAddProposal(p);
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
      // The coach must know what it is replacing. A replacement that leaves
      // the slot's movement pattern is either the model misreading the slot —
      // the decline-press bug — or a deliberate, stated decision. Rule 7b makes
      // the model declare deliberate crossings in pattern_change_reason; an
      // undeclared crossing is rejected here rather than trusted. Names outside
      // the library return known:false and are not judged.
      if ((p.edit_type || 'replace_exercise') === 'replace_exercise' && p.exercise_name) {
        const check = replacementPatternCheck(target.name, p.exercise_name);
        if (check.known && check.crosses && !p.pattern_change_reason) return false;
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
    if (isAdd) {
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
        // Same day-id-reuse-across-splits issue as program_template_overrides.
        split_id: userData?.profile?.selected_split ?? null,
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
        // Different splits reuse the same day ids ('upper_a' exists in both
        // Upper/Lower 4x and 6x, with different exercises on it) — without this,
        // an edit made on one split silently reapplies on a same-named day after
        // switching splits, landing on whatever exercise happens to share the
        // old slot signature. Scoping to the split it was actually made on is
        // what makes that no longer possible.
        split_id: userData?.profile?.selected_split ?? null,
      }));
    }
    // Return the ENRICHED proposal on success (it carries the resolved slot_id),
    // false on failure. Callers need the slot_id so the mid-workout live apply
    // (onProposalApplied -> applyCoachEdit) targets the right slot, not just the
    // stored override. Truthiness is preserved: an object is truthy, false falsy.
    return err ? false : p;
  };

  const doApply = async (index, sessionOnly) => {
    if (confirmingIndex !== null) return;
    setConfirmingIndex(index);
    const saved = await saveProposal(proposals[index], sessionOnly);
    setConfirmingIndex(null);
    if (saved) {
      const remaining = proposals.filter((_, i) => i !== index);
      setProposals(remaining);
      if (remaining.length === 0) setProposalSaved(true);
      loadUserData(); // refresh so the coach's program context reflects the change
      if (onProposalApplied) {
        // Pass the canonical library name so the host can match it exactly.
        // `saved` (not proposals[index]) carries the resolved slot_id.
        const p = saved;
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
    if (isAddProposal(p)) {
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

  // Turns a real deload recommendation into real, reviewable proposals routed
  // through the exact same apply pipeline as any AI-driven edit — nothing is
  // written until the user taps Apply/Apply All on the proposal cards below.
  // deloadSuggestion already carries the exact shape generateDeloadWeek expects
  // (it's spread straight from DELOAD_RESEARCH.byGoal). generateDeloadWeek
  // FILTERS optional exercises before mapping, so deloaded days can be shorter
  // than the original — matching must be done by exercise name, never by index,
  // or a dropped exercise earlier in the day would misalign every proposal after it.
  const buildDeloadProposals = () => {
    const program = userData?.program;
    const deload = userData?.deloadSuggestion;
    if (!program?.days || !deload) return [];
    const deloaded = generateDeloadWeek(program, deload);
    if (!deloaded) return [];
    const built = [];
    program.days.forEach((day, dayIdx) => {
      const deloadDay = deloaded.days[dayIdx];
      const deloadByName = new Map((deloadDay?.exercises || []).map(e => [e.name, e]));
      const dayName = day.name?.split('—')[0].trim();
      (day.exercises || []).forEach((ex, exIdx) => {
        if (!ex?.name) return;
        const deloadEx = deloadByName.get(ex.name);
        const rationale = t('coach.deloadRationale', { label: deload.label });
        if (!deloadEx) {
          built.push({ type: 'remove_exercise', edit_type: 'remove_exercise', day_id: day.id, day_name: dayName, exercise_index: exIdx, current_exercise: ex.name, exercise_name: ex.name, rationale });
        } else if (deloadEx.sets !== ex.sets) {
          built.push({ type: 'adjust_sets', edit_type: 'adjust_sets', day_id: day.id, day_name: dayName, exercise_index: exIdx, current_exercise: ex.name, exercise_name: ex.name, sets: deloadEx.sets, rationale });
        }
      });
    });
    return built;
  };

  // ── Executing an experiment (spec §6) ──────────────────────────────────────
  // Accepting a trial has to actually change training, or the arms are
  // identical and the verdict is meaningless. Arm B is expressed as ordinary
  // program proposals and routed through the same review-and-apply pipeline as
  // every other coach edit, so the user sees exactly what the experiment will
  // do before it does it, and can revert it like anything else.
  const buildExperimentProposals = (protocol) => {
    const program = userData?.program;
    if (!program?.days || !protocol) return [];
    const built = [];
    const rationale = t('coach.areRationale', { variable: protocol.variable });

    if (protocol.type === 'frequency') {
      // Arm B trains the lift one more day per week. Put it on a day that does
      // not already contain it — adding a second copy to the same session is a
      // volume change, not a frequency change, and would confound the trial.
      const lift = protocol.target;
      const host = program.days.find(d => !(d.exercises || []).some(e => e.name === lift));
      if (!host) return [];
      const template = program.days
        .flatMap(d => d.exercises || [])
        .find(e => e.name === lift);
      built.push({
        type: 'add_exercise', edit_type: 'add_exercise',
        day_id: host.id, day_name: host.name?.split('\u2014')[0].trim(),
        exercise_index: (host.exercises || []).length,
        exercise_name: lift,
        pattern_key: template?.pattern,
        sets: template?.sets || 3,
        reps: template?.reps,
        rationale,
      });
      return built;
    }

    if (protocol.type === 'volume') {
      // Arm B adds roughly six weekly sets to the muscle, spread over the days
      // that already train it rather than piled onto one session — past about
      // ten hard sets for a muscle in a single session the extra adds almost
      // nothing (volume_session_cap in the studies library).
      const muscle = protocol.muscle;
      const slots = [];
      program.days.forEach((day) => {
        (day.exercises || []).forEach((ex, idx) => {
          const primary = _PRIMARY_MUSCLE_MAP[String(ex.name || '').toLowerCase()];
          if (primary === muscle) slots.push({ day, ex, idx });
        });
      });
      if (!slots.length) return [];
      let remaining = 6;
      for (let i = 0; remaining > 0 && i < slots.length * 3; i++) {
        const slot = slots[i % slots.length];
        slot.added = (slot.added || 0) + 1;
        remaining--;
      }
      for (const slot of slots) {
        if (!slot.added) continue;
        built.push({
          type: 'permanent_edit', edit_type: 'adjust_sets',
          day_id: slot.day.id, day_name: slot.day.name?.split('\u2014')[0].trim(),
          exercise_index: slot.idx,
          current_exercise: slot.ex.name, exercise_name: slot.ex.name,
          sets: (slot.ex.sets || 3) + slot.added,
          rationale,
        });
      }
      return built;
    }
    return [];
  };

  const applyDeloadProposals = () => {
    const built = buildDeloadProposals();
    if (!built.length) {
      Alert.alert(t('coach.deloadNothingTitle'), t('coach.deloadNothingMsg'));
      return;
    }
    setProposals(built);
    // Scroll to the Ask card's real position — the proposal review cards render
    // inside it, below everything else on screen.
    scrollRef.current?.scrollTo({ y: Math.max(0, askCardY.current - 16), animated: true });
  };

  // computeFatigueSignature flags one thing: recent performance sitting below
  // this user's own trajectory. Unlike a deload (a full week, every day, RPE
  // triggered), this is lighter-touch and scoped to a single session — the
  // next one up — since the signal itself is about right now, not an
  // accumulated 6-week block. Trims toward the low end of DELOAD_RESEARCH's
  // "low recovery need" bracket (25–45%) rather than reusing the deload's own
  // 50%, since a single off session warrants less than a full deload does.
  const buildFatigueProposals = () => {
    const program = userData?.program;
    const day = program?.days?.[0]; // same simplification nextUp already uses
    if (!day?.exercises?.length) return [];
    const dayName = day.name?.split('—')[0].trim();
    const pct = Math.abs(userData?.fatigueSignature?.deviationPct || 0);
    const rationale = t('coach.fatigueRationale', { pct });
    const built = [];
    day.exercises.forEach((ex, exIdx) => {
      if (!ex?.name || !ex.sets || ex.sets < 2) return;
      const reduced = Math.max(1, Math.round(ex.sets * 0.7));
      if (reduced === ex.sets) return;
      built.push({
        type: 'adjust_sets', edit_type: 'adjust_sets', day_id: day.id, day_name: dayName,
        exercise_index: exIdx, current_exercise: ex.name, exercise_name: ex.name,
        sets: reduced, rationale,
      });
    });
    return built;
  };

  const applyFatigueProposals = () => {
    const built = buildFatigueProposals();
    if (!built.length) {
      Alert.alert(t('coach.fatigueNothingTitle'), t('coach.fatigueNothingMsg'));
      return;
    }
    setProposals(built);
    scrollRef.current?.scrollTo({ y: Math.max(0, askCardY.current - 16), animated: true });
  };

  // Real delete of the exact override row shown as the top done-strip item —
  // not a re-word, not a local-only toggle. Refetches afterward so the
  // program, done-strip, and AI context all immediately reflect the reversal.
  const undoLastChange = async () => {
    const mostRecent = userData?.recentChanges?.[0];
    if (!mostRecent?.id || undoing) return;
    setUndoing(true);
    const { error } = await supabase.from('program_template_overrides').delete().eq('id', mostRecent.id);
    setUndoing(false);
    if (error) { Alert.alert(t('coach.alerts.cantApplyTitle'), t('coach.undoFailedMsg')); return; }
    loadUserData();
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
    const saved = await saveProposal(p, sessionOnly);
    if (!saved) { Alert.alert(t('coach.alerts.cantApplyTitle'), t('coach.alerts.cantApplyMsg')); return; }
    // Remove just the applied slot, not the whole list — a multi-slot reply
    // ("change both my curls") shows one card per slot, and applying one
    // shouldn't dismiss the other still-pending one.
    setAlternatives(prev => {
      const rest = (prev || []).filter(a => !(a.day_id === slot.day_id && a.exercise_index === slot.exercise_index));
      return rest.length ? rest : null;
    });
    setProposalSaved(true);
    loadUserData();
    if (onProposalApplied) {
      let exerciseName = option.exercise_name;
      const resolved = resolveExerciseByName(option.exercise_name);
      if (resolved) {
        const ex = MOVEMENT_PATTERNS[resolved.patternKey]?.exercises.find(e => e.id === resolved.exerciseId);
        if (ex) exerciseName = ex.name;
      }
      // `saved` carries the resolved slot_id so the mid-workout apply hits the right slot.
      onProposalApplied({ ...saved, exercise_name: exerciseName });
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
    setHasAskedThisSession(true);
    setPendingQuestion(currentQuestion); // show the user's turn immediately
    const data = userData || await loadUserData();

    // loadUserData() returns undefined on an auth hiccup (session refresh mid-use,
    // a dropped fetch). Sending the question anyway used to fall back to an empty
    // context string — the coach would answer with zero knowledge of the user's
    // program while its edit tools stayed active, able to apply a change to a
    // hallucinated exercise slot. Fail the turn instead and let the user retry.
    if (!data) {
      setPendingQuestion(null);
      setAnswer(t('coach.failedConnect'));
      setAsking(false);
      return;
    }

    const newHistory = [
      ...conversationHistory,
      { role: 'user', content: currentQuestion },
    ];

    try {
      // Cap the history sent to the model to bound token cost — memory can grow
      // long over weeks. The full thread still lives in state/DB.
      const result = await callCoach(newHistory.slice(-20), buildContext(data));
      const answerText = result?.text || t('coach.noAnswer');
      if (result?.proposals?.length) {
        // Malformed or duplicate proposals must never become an "Apply" card —
        // see lib/proposalValidation.js for why (and its tests for the exact
        // shapes the live model has produced). The edge function filters these
        // too; keeping the client check independent means a version skew
        // between the two can't reopen the hole.
        const validProposals = sanitizeProposals(result.proposals);
        if (validProposals.length) setProposals(validProposals);
      }
      // alternatives is a LIST now, one entry per slot — rule 12 explicitly
      // allows multiple slots changing in one reply ("change both my curls,
      // you pick"), and the server used to keep only the first one. Filter
      // each entry through keepInPatternAlternatives independently; a slot
      // with no offered alternatives left after filtering is dropped rather
      // than shown as an empty card.
      const altList = (result?.alternatives || [])
        .map(a => keepInPatternAlternatives(a, data?.profile?.equipment))
        .filter(a => a?.alternatives?.length);
      if (altList.length) setAlternatives(altList);
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
      // A time trim. Stored as a flag the Today screen reads, NOT as a proposal:
      // proposals rewrite the saved program and wait for Apply, whereas this is
      // one session's worth of "I'm in a rush" and has to expire on its own.
      // Dated so tomorrow starts from the full program again — a trim left on by
      // accident would quietly halve someone's training for weeks.
      if (result?.compact?.scope) {
        AsyncStorage.setItem('compact_request', JSON.stringify({
          scope: result.compact.scope,
          reason: result.compact.reason || null,
          date: new Date().toISOString().slice(0, 10),
        })).catch(() => {});
      }
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
      const ok = await saveProposal(p, isAddProposal(p) ? false : sessionOnly);
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
    if (isAddProposal(p)) return t('coach.addExercise');
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

      {/* ── Memory-chip strip — a real snapshot of what Coach already knows,
          not a new memory store. Sourced from health_conditions_structured
          (already saved by ProfileScreen), coachNotes (preference-category),
          and profile.goals. Up to 3 — hidden entirely if none exist. */}
      {!isMidWorkout && (() => {
        const chips = [];
        (userData?.profile?.health_conditions_structured || []).forEach(raw => {
          if (chips.length >= 3) return;
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.conditionLabel) chips.push(`${parsed.conditionLabel} sensitivity`);
          } catch { /* malformed row — skip, don't crash the screen over it */ }
        });
        coachNotes.filter(n => n.category === 'preference').forEach(n => {
          if (chips.length < 3 && n.summary) chips.push(n.summary);
        });
        if (chips.length < 3 && userData?.profile?.goals?.[0]) {
          chips.push(t('coach.goalChip', { goal: t(`onboarding.goals.${userData.profile.goals[0]}`, { defaultValue: userData.profile.goals[0] }) }));
        }
        if (!chips.length) return null;
        return (
          <View style={styles.memoryStrip}>
            {chips.map((c, i) => (
              <View key={i} style={styles.memoryChip}>
                <View style={styles.memoryChipDot} />
                <Text style={styles.memoryChipText}>{c}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      {/* ── Vitals row — bold, prominent, real stats at a glance: sessions +
          streak (already computed) plus bodyweight-vs-target when both a
          target and a real weigh-in exist. Same bold treatment as the rest
          of the header stats, not a faint caption easy to miss. */}
      {!isMidWorkout && (() => {
        const sessionsThisWeek = (userData?.recentSessions || [])
          .filter(s => new Date(s.completed_at) >= subDays(new Date(), 7)).length;
        const streak = userData?.streak || 0;
        let bwPart = null;
        if (userData?.profile?.target_weight_kg && userData?.bodyMetrics?.length > 0) {
          const sorted = [...userData.bodyMetrics].sort((a, b) => new Date(b.date) - new Date(a.date));
          const latest = sorted[0];
          if (latest?.weight_kg) {
            const target = userData.profile.target_weight_kg;
            const diff = +(latest.weight_kg - target).toFixed(1);
            if (diff !== 0) {
              const direction = diff > 0 ? t('coach.bodyweightAbove', { n: Math.abs(diff) }) : t('coach.bodyweightBelow', { n: Math.abs(diff) });
              bwPart = t('coach.bodyweightLine', { weight: latest.weight_kg, target, direction });
            }
          }
        }
        if (!sessionsThisWeek && !streak && !bwPart) return null;
        return (
          <View style={styles.vitalsRow}>
            <Text style={styles.vitalsText}>
              {sessionsThisWeek || streak
                ? <Text>{t('coach.weekStat', { count: sessionsThisWeek, streak })}</Text>
                : null}
              {bwPart ? <Text>{(sessionsThisWeek || streak) ? ' · ' : ''}{bwPart}</Text> : null}
            </Text>
          </View>
        );
      })()}

      {/* ── Proof of work — costs zero AI messages. recentChanges is real
          (program_template_overrides), proactivePrompt is the same
          recovery→deload→plateau→missed-session→milestone chain the
          home-screen notification uses, insights come from computeInsights.
          Nothing here is model-generated. */}
      {!isMidWorkout && !focusDismissed && (() => {
        const recentChanges = userData?.recentChanges || [];
        const proactivePrompt = userData?.proactivePrompt || null;
        const insights = userData?.insights || [];
        const changeEffectiveness = userData?.changeEffectiveness || null;
        const readyToProgress = userData?.readyToProgress || [];
        const neglectedMuscle = userData?.neglectedMuscle || null;
        // Focus card fallback chain — most time-sensitive first. proactivePrompt
        // is a trigger (deload/plateau/missed/recovery/milestone); below it come
        // the always-checkable data reads so the card is populated far more often
        // than the old proactive-or-correlation-only path (which was usually
        // empty). Each read is factual — a real gap, a real correlation, a real
        // progression — never a manufactured "insight".
        // Furthest below its weekly minimum, measured the same way the volume
        // rows are: primary mover only, against this lifter's tier.
        const targets = getVolumeTargets(userData?.profile?.trainingExperience, userData?.profile?.sex);
        const biggestGap = (() => {
          let worst = null;
          for (const [muscle, tgt] of Object.entries(targets || {})) {
            if (!tgt?.min) continue;
            const done = userData?.weeklyVolume?.[muscle] || 0;
            const short = tgt.min - done;
            if (short <= 1) continue;
            if (!worst || short > worst.short) {
              worst = { muscle, short, done, min: tgt.min, label: t(`today.muscles.${muscle}`, { defaultValue: muscle }) };
            }
          }
          return worst;
        })();

        // Last resort: name the next session and what it actually trains, so the
        // card still carries a read on a week with nothing logged at all.
        const nextUp = (() => {
          const day = userData?.program?.days?.[0];
          if (!day?.exercises?.length) return null;
          const sets = day.exercises.reduce((n, ex) => n + (ex.sets || 0), 0);
          const seen = [];
          for (const ex of day.exercises) {
            const m = _PRIMARY_MUSCLE_MAP[String(ex.name || '').toLowerCase()];
            const label = m && t(`today.muscles.${m}`, { defaultValue: m });
            if (label && !seen.includes(label)) seen.push(label);
          }
          if (!seen.length) return null;
          return { name: day.name.split('\u2014')[0].trim(), muscles: seen.slice(0, 3).join(', ').toLowerCase(), sets };
        })();

        // ── Adaptive Response Engine ──────────────────────────────────────
        // Ranked LAST, not first. A concluded trial is stronger evidence than a
        // population rule, but "would you like to run a six-week experiment" is
        // not what someone opening this tab needs above a deload they are due, a
        // plateau they are in, or a muscle they are eight sets short on. Those
        // are about today; an experiment offer can wait for a quiet screen.
        const areItem = (() => {
          if (!are || are.blocked) return null;
          const p = are.experiment || are.experimentRow?.protocol_json;
          if (are.action === 'propose' && p) {
            return {
              eyebrow: t('coach.areEyebrowProposed'),
              eyebrowColor: colors.info,
              title: t('coach.areProposeTitle', { variable: p.variable }),
              body: t('coach.areProposeBody', { metric: p.metric, weeks: (p.weeksPerArm || 3) * 2 }),
              are: 'propose',
            };
          }
          if (are.action === 'continue' && p) {
            return {
              eyebrow: t('coach.areEyebrowRunning'),
              eyebrowColor: colors.info,
              title: t('coach.areRunningTitle', { variable: p.variable }),
              body: t('coach.areRunningBody'),
              are: 'running',
            };
          }
          if (are.action === 'conclude' && are.evaluation) {
            const v = are.evaluation.verdict;
            return {
              eyebrow: t('coach.areEyebrowResult'),
              eyebrowColor: v === 'keep' ? colors.accent : colors.textMuted,
              title: t(`coach.areVerdict.${v}`, { variable: p?.variable || '' }),
              // "No detectable effect" is a real finding, not a failure — it
              // rules a variable out for this person permanently.
              body: t('coach.areVerdictBody'),
              are: 'conclude',
            };
          }
          return null;
        })();

        // Objective, wearable-free readiness (individualModel.computeFatigueSignature):
        // fits each lift's own trend on OLDER sessions, predicts the recent ones, and
        // flags when actual performance has fallen meaningfully below that prediction.
        // Ranked below an explicit proactive prompt and a concrete volume gap (those are
        // more actionable), but above generic weekly insights — "you're underperforming
        // your own trajectory" is a stronger, more specific signal than a correlation.
        const fatigueItem = (userData?.fatigueSignature?.label === 'fatigued')
          ? { eyebrow: t('coach.focusEyebrowFatigue'), eyebrowColor: colors.warning,
              title: t('coach.fatigueTitle'),
              body: t('coach.fatigueBody', { pct: Math.abs(userData.fatigueSignature.deviationPct) }),
              fatigueAction: true }
          : null;

        const focusItem = (proactivePrompt
          ? { eyebrow: t('coach.focusEyebrowToday'), title: proactivePrompt.title, body: proactivePrompt.body }
          : neglectedMuscle
            ? { eyebrow: t('coach.focusEyebrowGap'), eyebrowColor: colors.warning, title: t('coach.neglectTitle', { muscle: neglectedMuscle.label, days: neglectedMuscle.gapDays }), body: t('coach.neglectBody', { muscle: neglectedMuscle.label.toLowerCase() }) }
            : fatigueItem
            ? fatigueItem
            : insights.length > 0
              ? { eyebrow: t('coach.focusEyebrowWeek'), title: insights[0], body: null }
              : readyToProgress.length > 0
                ? { eyebrow: t('coach.focusEyebrowProgress'), eyebrowColor: colors.accent, title: readyToProgress[0], body: null, promotedProgress: true }
                // Every link above needs training history. Without one the chain
                // ended at null and the whole block returned nothing, so a new or
                // returning lifter opened Coach to an input box and a one-word
                // recovery chip — a screen that waits to be asked instead of
                // saying anything. These two read the data that exists from day
                // one: the week's volume against target, and failing that, the
                // session that is next.
                : (biggestGap
                  ? { eyebrow: t('coach.focusEyebrowGap'), eyebrowColor: colors.warning,
                      title: t('coach.gapTitle', { muscle: biggestGap.label, n: biggestGap.short }),
                      body: t('coach.gapBody', { muscle: biggestGap.label.toLowerCase(), done: biggestGap.done, min: biggestGap.min }) }
                  : nextUp
                    ? { eyebrow: t('coach.focusEyebrowNext'),
                        title: t('coach.nextTitle', { day: nextUp.name }),
                        body: t('coach.nextBody', { muscles: nextUp.muscles, sets: nextUp.sets }) }
                    : areItem));
        // Structured signal tiles for the bento grid — each a real detector,
        // rendered as a short label + value. Only the ones with data appear.
        const recovery = (userData?.recoveryCheckIns || []).find(c => !c.skipped)?.label || null;
        const weeklySets = Object.values(userData?.weeklyVolume || {}).reduce((a, b) => a + (b || 0), 0);
        const plateauEx = userData?.plateaus?.[0]?.exercise || null;
        const signals = [];
        if (readyToProgress.length) signals.push({ k: t('coach.sigProgression'), v: t('coach.sigReady', { n: readyToProgress.length }) });
        if (plateauEx) signals.push({ k: t('coach.sigPlateau'), v: plateauEx, amber: true });
        if (recovery) signals.push({ k: t('coach.sigRecovery'), v: recovery });
        if (weeklySets > 0) signals.push({ k: t('coach.sigWeek'), v: t('coach.sigSets', { n: weeklySets }) });
        if (!recentChanges.length && !focusItem && !signals.length) return null;

        return (
          <View style={styles.bentoWrap}>
            {/* Priority-read hero tile — the single most important read, from the
                same fallback chain as before (proactive → gap → correlation →
                progression). White is reserved for the one action. */}
            {focusItem && (() => {
              const plateauTrend = proactivePrompt?.key === 'plateau' ? (userData?.plateauTrend || []) : [];
              const trendChange = plateauTrend.length >= 2 ? plateauTrend[plateauTrend.length - 1].est1rm - plateauTrend[0].est1rm : null;
              return (
              <View style={styles.heroTile}>
                <View style={styles.tileKRow}>
                  <View style={[styles.tileDot, focusItem.eyebrowColor === colors.warning && { backgroundColor: colors.warning }]} />
                  <Text style={styles.tileK}>{focusItem.eyebrow}</Text>
                </View>
                <Text style={styles.heroTitle}>{focusItem.title}</Text>
                <PlateauChart points={plateauTrend} />
                {trendChange !== null && (
                  <Text style={styles.focusChartLabel}>{trendChange > 0 ? '+' : ''}{trendChange}kg over {plateauTrend.length} sessions</Text>
                )}
                {focusItem.body ? <Text style={styles.heroBody}>{focusItem.body}</Text> : null}
                <View style={styles.heroActions}>
                  {proactivePrompt?.key === 'deload' && (
                    <Tappable style={styles.heroBtnPrimary} onPress={applyDeloadProposals}>
                      <Text style={styles.heroBtnPrimaryText}>{t('coach.applyDeload')}</Text>
                    </Tappable>
                  )}
                  {/* Objective readiness, not a deload — one session, not a full week,
                      and it's a review-and-apply proposal like every other edit, never
                      automatic. Only offered when there's a real next-up day to lighten. */}
                  {focusItem?.fatigueAction && nextUp && (
                    <Tappable style={styles.heroBtnPrimary} onPress={applyFatigueProposals}>
                      <Text style={styles.heroBtnPrimaryText}>{t('coach.applyFatigue')}</Text>
                    </Tappable>
                  )}
                  {/* An experiment never starts on its own — §11 of the spec makes
                      opt-in explicit, and the escape hatch permanent. Ending a
                      trial abandons it rather than concluding it, because a
                      half-run comparison is not evidence about this person. */}
                  {focusItem.are === 'propose' && are?.experimentRow?.id && (
                    <Tappable style={styles.heroBtnPrimary} onPress={async () => {
                      const protocol = are.experiment || are.experimentRow?.protocol_json;
                      const built = buildExperimentProposals(protocol);
                      if (!built.length) {
                        // Nothing in the current program can carry arm B, so the
                        // trial cannot run. Better to say so than to start a
                        // trial whose arms are identical.
                        Alert.alert(t('coach.areCannotRunTitle'), t('coach.areCannotRunMsg'));
                        return;
                      }
                      await acceptExperiment(are.experimentRow.id);
                      setAre(a => (a ? { ...a, action: 'continue' } : a));
                      setProposals(built);
                      scrollRef.current?.scrollTo({ y: Math.max(0, askCardY.current - 16), animated: true });
                    }}>
                      <Text style={styles.heroBtnPrimaryText}>{t('coach.areStart')}</Text>
                    </Tappable>
                  )}
                  {focusItem.are === 'running' && are?.experimentRow?.id && (
                    <Tappable style={styles.heroBtnGhost} onPress={async () => {
                      await abandonExperiment(are.experimentRow.id);
                      setAre(null);
                    }}>
                      <Text style={styles.heroBtnGhostText}>{t('coach.areStop')}</Text>
                    </Tappable>
                  )}
                  <Tappable onPress={() => setFocusDismissed(true)} hitSlop={10}>
                    <Text style={styles.heroDismissLink}>{t('coach.dismissToday')}</Text>
                  </Tappable>
                </View>
              </View>
              );
            })()}

            {/* Signal tiles. Rendered as a chip row rather than a grid of cards:
                a single signal ("Recovery · Moderate") took a full-width card for
                two words, and everything it pushed down was the ask box — the
                primary control of the screen, which was landing more than half a
                fold from the top. */}
            {signals.length > 0 && (
              <View style={styles.signalRow}>
                {signals.map((s, i) => (
                  <View key={i} style={styles.signalChip}>
                    <Text style={styles.signalK}>{s.k}</Text>
                    <Text style={[styles.signalV, s.amber && { color: colors.warning }]} numberOfLines={1}>{s.v}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent changes — the retrospective changelog, demoted to the bottom. */}
            {recentChanges.length > 0 && (
              <View style={styles.doneStrip}>
                <Text style={styles.doneStripEyebrow}>{t('coach.recentChanges')}</Text>
                {recentChanges.slice(0, 8).map((c, i) => {
                  // Split "changed Squat to 4 sets (Lower A)" into a bold main
                  // clause and a muted trailing day-name — real string, just
                  // formatted in two tones instead of one flat sentence.
                  const match = c.text.match(/^(.*)\s(\([^)]+\))$/);
                  return (
                    <View key={c.id ?? i} style={[styles.doneRow, i > 0 && styles.doneRowBorder]}>
                      <View style={styles.doneCheck}><Text style={styles.doneCheckMark}>✓</Text></View>
                      <Text style={styles.doneText}>
                        {match ? match[1] : c.text}
                        {match ? <Text style={styles.doneTextMuted}>  {match[2]}</Text> : null}
                      </Text>
                    </View>
                  );
                })}
                {recentChanges[0]?.id && (
                  <Tappable onPress={undoLastChange} disabled={undoing} hitSlop={8} style={{ marginTop: 8 }}>
                    <Text style={styles.undoBtnText}>{undoing ? t('coach.undoing') : t('coach.undo')}</Text>
                  </Tappable>
                )}
              </View>
            )}
          </View>
        );
      })()}

      {/* Ask a question. This used to render FIRST, on the reasoning that asking
          is the primary action. That is what made the tab read as a search box:
          the screen opened with an empty field and a list of canned prompts, so
          the coach appeared to know nothing until you interrogated it. The read
          above now leads — it is derived from this lifter's own data and costs no
          AI message — and the input follows as the way to act on it. */}
      <View style={styles.card} onLayout={(e) => { askCardY.current = e.nativeEvent.layout.y; }}>


        {/* ── Latest answer ──────────────────────────────────────────────────
            conversationHistory is still kept in full in state and sent to the
            model (and persisted to coach_memory) so the coach keeps its
            memory — but the screen shows only the exchange in progress, not a
            growing chat log. */}
        {(() => {
          const lastUserTurn = pendingQuestion
            ? { content: pendingQuestion }
            : [...conversationHistory].reverse().find(t => t.role === 'user');
          const lastAssistantTurn = !pendingQuestion
            ? [...conversationHistory].reverse().find(t => t.role === 'assistant')
            : null;
          if (!hasAskedThisSession || (!lastUserTurn && !asking && !answer)) return null;
          return (
            <View style={styles.answerPanel}>
              {lastUserTurn && <Text style={styles.answerQuestion}>{lastUserTurn.content}</Text>}
              {asking ? (
                <Text style={styles.turnThinking}>
                  {askElapsed >= 15 ? t('coach.thinkingDays')
                    : askElapsed >= 6 ? t('coach.thinkingProgram')
                    : t('coach.thinking')}
                </Text>
              ) : answer ? (
                <Text style={styles.turnErrorText}>{answer}</Text>
              ) : lastAssistantTurn ? (
                <Text style={styles.turnCoachText}>{lastAssistantTurn.content}</Text>
              ) : null}
            </View>
          );
        })()}

        <View style={styles.askInputRow}>
          <TextInput
            style={[styles.questionInput, quotaExceeded && { opacity: 0.4 }]}
            value={quotaExceeded ? '' : question}
            onChangeText={setQuestion}
            placeholder={quotaExceeded ? t('coach.limitPlaceholder') : t('coach.inputPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            editable={!quotaExceeded}
          />
          <Tappable
            style={[styles.askBtn, (asking || quotaExceeded) && styles.btnDisabled]}
            onPress={askQuestion}
            disabled={asking || quotaExceeded}
            accessibilityLabel={t('coach.askBtn')}
          >
            {asking
              ? <ActivityIndicator size="small" color={colors.textOnLight} />
              : <Ionicons name="arrow-up" size={18} color={colors.textOnLight} />}
          </Tappable>
        </View>

        {/* Proposal confirmation card */}
        {proposals.length > 0 && (
          <View style={styles.proposalCard}>
            <Text style={styles.proposalLabel}>
              {proposals.length === 1
                ? (isAddProposal(proposals[0]) ? t('coach.proposesAdding') : t('coach.proposesChanging'))
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
                    accessibilityLabel={t('common.close')}
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

        {/* Ranked, research-backed replacement options — tap to apply (no extra
            message). alternatives is a LIST: rule 12 allows the coach to change
            multiple slots in one reply ("change both my curls, you pick"), so
            this renders one card per slot rather than assuming there's only
            ever one. */}
        {alternatives?.map((alt, gi) => alt?.alternatives?.length > 0 && (
          <View key={`${alt.day_id}-${alt.exercise_index}-${gi}`} style={styles.proposalCard}>
            <Text style={styles.proposalLabel}>
              {t('coach.alternativesFor', { name: alt.current_exercise || t('coach.thisExercise') })}
            </Text>
            {alt.alternatives.map((opt, i) => (
              <View key={i} style={[styles.altItem, i > 0 && styles.proposalItemBorder]}>
                <View style={styles.altHeader}>
                  <View style={styles.altRank}><Text style={styles.altRankText}>{i + 1}</Text></View>
                  <Text style={styles.altName}>{opt.exercise_name}</Text>
                </View>
                {opt.rationale ? <Text style={styles.proposalRationale}>{opt.rationale}</Text> : null}
                <Tappable
                  style={[styles.altUseBtn, confirmingIndex !== null && styles.btnDisabled]}
                  onPress={() => chooseAlternative(alt, opt)}
                  disabled={confirmingIndex !== null}
                >
                  <Text style={styles.altUseText}>{t('coach.useThis')}</Text>
                </Tappable>
              </View>
            ))}
            <Tappable
              style={[styles.dismissBtn, { marginTop: 4 }]}
              onPress={() => setAlternatives(prev => {
                const rest = (prev || []).filter(a => !(a.day_id === alt.day_id && a.exercise_index === alt.exercise_index));
                return rest.length ? rest : null;
              })}
            >
              <Text style={styles.dismissBtnText}>{t(alternatives.length > 1 ? 'coach.dismissThese' : 'coach.dismissAll')}</Text>
            </Tappable>
          </View>
        ))}

        {proposalSaved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>{t('coach.saved')}</Text>
          </View>
        )}

        {/* Quick questions are the only "pick a canned prompt" mechanism on
            this card — a second, separate set of example chips used to sit
            above the input doing the same job, which was the actual
            redundancy, not the color. */}
        {!isMidWorkout && (
          <View style={styles.quickSection}>
            <View style={styles.quickChips}>
              {[
                t('coach.quick.neglecting'),
                t('coach.quick.frequency'),
                t('coach.quick.prioritise'),
                t('coach.quick.recovering'),
              ].map((q, i) => (
                <Tappable
                  key={i}
                  style={[styles.quickChip2, (quotaExceeded || asking) && styles.quickChipDisabled]}
                  disabled={quotaExceeded || asking}
                  onPress={() => askQuestion(q)}
                >
                  <Text style={styles.quickChip2Text}>{q}</Text>
                </Tappable>
              ))}
            </View>
          </View>
        )}
      </View>


      {/* Weekly narrative review — auto-generated once per week, hidden mid-workout.
          Full accent-hair border (not a side-stripe), same restrained technique
          as everywhere else accent shows up on this screen — marks this as the
          week's real payoff moment, distinct from the plain utility cards below. */}
      {!isMidWorkout && (
        <View style={[styles.card, styles.cardBoxed, styles.weeklyReviewCard]}>
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
            <>
              {/* The week, as bars against each muscle's own research target.
                  Reading "you hit 12 of 15 chest sets" in a sentence is slower
                  than seeing the bar, and the app already computed the number. */}
              {(() => {
                const targets = getVolumeTargets(userData?.profile?.trainingExperience, userData?.profile?.sex);
                const rows = Object.entries(userData?.weeklyVolume || {})
                  .map(([muscle, done]) => ({
                    muscle, done,
                    target: targets?.[muscle] || null,
                    label: t(`today.muscles.${muscle}`, { defaultValue: muscle }),
                  }))
                  .filter(r => r.target)
                  // Worst first: the point of the review is what to fix.
                  .sort((a, b) => (a.done / a.target.min) - (b.done / b.target.min))
                  .slice(0, 6);
                if (!rows.length) return null;
                return (
                  <View style={styles.weekChart}>
                    {rows.map(r => (
                      <View key={r.muscle} style={styles.weekRow}>
                        <Text style={styles.weekRowName} numberOfLines={1}>{r.label}</Text>
                        <VolumeBar done={r.done} target={r.target} height={7} />
                        <Text style={[styles.weekRowVal, r.done < r.target.min && styles.weekRowValLow]}>
                          {r.done}/{r.target.min}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
              <View style={[styles.insightBox, { marginTop: 14, marginBottom: 0 }]}>
                <Text style={styles.insightText}>{weeklySummary}</Text>
              </View>
            </>
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

      {/* Coach memory — durable facts the user can review and forget */}
      {!isMidWorkout && coachNotes.length > 0 && (
      <View style={[styles.card, styles.cardBoxed]}>
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
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 11.5, color: colors.textSubtle, marginTop: 2 },

  memoryStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 20, marginTop: 4, marginBottom: 2 },
  memoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceInset, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11, borderWidth: 0.5, borderColor: colors.border },
  memoryChipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  memoryChipText: { fontSize: 11, color: colors.textSecondary },

  vitalsRow: { marginHorizontal: 20, marginTop: 8, marginBottom: 2 },
  vitalsText: { fontSize: 12.5, fontWeight: '600', color: colors.textSecondary, lineHeight: 17 },

  doneStrip: { marginHorizontal: 20, marginTop: 12, backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: colors.accentHair, marginBottom: 12 },
  doneStripEyebrow: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  doneRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border, marginTop: 2, paddingTop: 8 },
  doneCheck: { width: 16, height: 16, borderRadius: 5, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  doneCheckMark: { fontSize: 9, fontWeight: '700', color: colors.accent },
  doneText: { fontSize: 12.5, color: colors.textSecondary, flex: 1 },
  doneTextMuted: { fontSize: 11, color: colors.textFaint },
  undoBtnText: { fontSize: 11, fontWeight: '600', color: colors.textFaint, textDecorationLine: 'underline' },

  focusCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginBottom: 12 },
  focusEyebrow: { fontSize: 10, fontWeight: '700', color: colors.danger, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' },
  focusTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.2 },
  focusChartLabel: { fontSize: 10.5, fontWeight: '700', color: colors.danger, textAlign: 'right', marginTop: -6, marginBottom: 10 },
  focusBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 14 },
  focusActions: { flexDirection: 'row', gap: 8 },
  focusBtn: { flex: 1, backgroundColor: colors.control, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderStrong },
  focusBtnText: { fontSize: 12.5, fontWeight: '600', color: colors.textPrimary },
  focusBtnPrimary: { backgroundColor: colors.surfaceInverse, borderWidth: 0 },
  focusBtnPrimaryText: { fontSize: 12.5, fontWeight: '600', color: colors.textOnLight },

  fragmentList: { marginHorizontal: 20, paddingHorizontal: 2, marginBottom: 14 },
  fragmentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  fragmentRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border },
  fragmentDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textFaint, marginTop: 6 },
  fragmentText: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, flex: 1 },

  // ── Bento reads: a priority-read hero tile + a 2-up grid of signal tiles ──
  bentoWrap: { marginHorizontal: 20, marginBottom: 2 },
  heroTile: { paddingHorizontal: 0, paddingTop: 2, paddingBottom: 16, marginBottom: 0 },
  tileKRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  tileDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  tileK: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSubtle },
  heroTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 27, marginBottom: 7 },
  heroBody: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20, marginBottom: 10 },
  heroActions: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 2 },
  heroDismissLink: { fontSize: 12.5, fontWeight: '600', color: colors.textSubtle, paddingVertical: 2 },
  heroBtnPrimary: { backgroundColor: colors.surfaceInverse, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  heroBtnPrimaryText: { fontSize: 12.5, fontWeight: '700', color: colors.textOnLight },
  heroBtnGhost: { borderWidth: 0.5, borderColor: colors.borderStrong, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  heroBtnGhostText: { fontSize: 12.5, fontWeight: '600', color: colors.textPrimary },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  signalChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    backgroundColor: colors.surface, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 11,
    borderWidth: 0.5, borderColor: colors.border,
  },
  signalK: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSubtle },
  signalV: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary },
  tile: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 0.5, borderColor: colors.border, flexGrow: 1, flexBasis: '47%', minWidth: 0 },
  tileV: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary, marginTop: 3, letterSpacing: -0.2 },

  card: { marginHorizontal: 20, marginBottom: 18 },
  cardBoxed: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  cardSub: { fontSize: 11, color: colors.textSubtle, marginBottom: 14, lineHeight: 16 },
  askHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  insightBox: { backgroundColor: colors.surfaceInset, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: colors.border },
  insightText: { fontSize: 13, color: colors.textPrimary, lineHeight: 21 },

  askInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 18,
    borderWidth: 1, borderColor: colors.borderStrong,
    paddingLeft: 18, paddingRight: 8, paddingVertical: 11, marginBottom: 12,
  },
  questionInput: { flex: 1, color: colors.textPrimary, fontSize: 15, maxHeight: 100, paddingVertical: 8 },
  weekChart: { marginTop: 12, gap: 8 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekRowName: { width: 74, fontSize: 11, color: colors.textMuted },
  weekRowVal: { width: 46, fontSize: 11, color: colors.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },
  weekRowValLow: { color: colors.warning, fontWeight: '700' },
  weeklyReviewCard: { borderColor: colors.accentHair, backgroundColor: colors.surfaceElevated },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyDismiss: { fontSize: 15, color: colors.textSubtle, fontWeight: '600' },
  // Accent-tinted, not the flat gray "control" treatment other secondary
  // buttons use — generating the week's review is a real payoff action, not
  // a neutral utility one, and it was reading as disabled next to Ask's
  // white pill. Same accent language the done-strip/focus card already use
  // for "this is something worth doing," not a new color introduced here.
  weeklyBtn: { backgroundColor: colors.accentSoft, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 0.5, borderColor: colors.accentHair },
  weeklyBtnText: { color: colors.accent, fontSize: 14, fontWeight: '700' },

  // ── Latest answer (no persistent chat log — just the exchange in progress) ──
  answerPanel: { backgroundColor: colors.surfaceInset, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: colors.border },
  answerQuestion: { fontSize: 12, color: colors.textSubtle, fontWeight: '600', marginBottom: 8 },
  turnCoachText: { fontSize: 13, color: colors.textPrimary, lineHeight: 21 },
  turnThinking: { fontSize: 13, color: colors.textSubtle, lineHeight: 21, fontStyle: 'italic' },
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

  askBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  memoryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  memoryRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border },
  memoryCat: { fontSize: 10, color: colors.textSubtle, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  memorySummary: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  memoryForgetBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.dangerBg, borderRadius: 8, borderWidth: 0.5, borderColor: colors.dangerHair },
  memoryForgetText: { color: colors.danger, fontSize: 12, fontWeight: '600' },

  quickChipDisabled: { opacity: 0.4 },
  quickSection: { marginTop: 2 },
  quickSectionTitle: { fontSize: 11, fontWeight: '600', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  quickChip2: {
    backgroundColor: colors.surfaceInset, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 13,
    borderWidth: 0.5, borderColor: colors.border,
  },
  quickChip2Text: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500' },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  quickRowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border },
  quickRowText: { flex: 1, fontSize: 13, color: colors.textSecondary },
  quickRowArrow: { fontSize: 13, color: colors.textSubtle, fontWeight: '600', marginLeft: 8 },
});
