import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateProgram, getVolumeTargets, detectPlateaus, detectDeloadNeeded, generateDeloadWeek, isBlockComplete, getBlockLength, applyPermanentEdit, applyContraindicationFilters, normalizeEquipment, getConditionsFromInjuryProfile, applyContraindicationsToWorkout, computeDislikedExerciseIds, dislikedExerciseIdsFromNotes, getProactiveCoachPrompt, getEligibleGoalMilestones, rebalanceForCompletedOptionalDays, INJURY_BODY_PARTS } from './programGenerator';
import { buildVolumeView } from './volumeEngine';
import { maybeSendProactiveNudge } from '../lib/notificationService';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { format, isToday, isYesterday, differenceInDays, startOfWeek, subDays } from 'date-fns';
import CardioLogModal from './CardioLogModal';
import BodyHeatMap from './BodyHeatMap';
import { isHealthAuthorized, getRecoveryData } from '../lib/healthService';
import { getTodayCheckIn } from '../lib/recoveryStore';
import { Platform } from 'react-native';
import { colors } from '../lib/theme';
import { animateLayout } from '../lib/motion';
import Tappable from '../components/Tappable';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Normalise raw library muscle names → display group keys used in MUSCLE_DISPLAY
function normaliseMuscle(raw) {
  const r = raw.toLowerCase();
  if (r === 'chest' || r === 'upper chest' || r === 'lower chest') return 'chest';
  if (r === 'lats' || r === 'traps' || r === 'upper traps' ||
      r === 'upper trapezius' || r === 'levator scapulae') return 'back';
  if (r === 'shoulders' || r === 'anterior delts' || r === 'side deltoids' ||
      r === 'rear delts' || r === 'rear deltoids' || r === 'external rotators') return 'shoulders';
  if (r === 'biceps' || r === 'brachialis') return 'biceps';
  if (r === 'triceps') return 'triceps';
  if (r === 'quads') return 'quads';
  if (r === 'hamstrings') return 'hamstrings';
  if (r === 'glutes' || r === 'glute medius' || r === 'glute minimus') return 'glutes';
  if (r === 'gastrocnemius' || r === 'soleus') return 'calves';
  if (r === 'rectus abdominis' || r === 'obliques') return 'abs';
  if (r === 'forearms' || r === 'brachioradialis' || r === 'wrist flexors' || r === 'wrist extensors') return 'forearms';
  return null; // ignore: external rotators on their own, etc.
}

// Primary muscle only — for volume counting and recovery so rows don't inflate biceps etc.
const EXERCISE_PRIMARY_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(pattern => {
    const primary = normaliseMuscle(pattern.muscles[0]);
    if (primary) pattern.exercises.forEach(ex => { map[ex.name.toLowerCase()] = primary; });
  });
  return map;
})();

function getPrimaryMuscleForExercise(exerciseName, patternKey) {
  // Prefer the durable pattern_key saved with each set: it survives coach swaps
  // and display-name variants, so a set whose name isn't an exact library key
  // still attributes instead of silently registering under no muscle. Falls back
  // to the exercise name for legacy rows that predate pattern_key.
  const pattern = patternKey && MOVEMENT_PATTERNS[patternKey];
  if (pattern) return normaliseMuscle(pattern.muscles[0]);
  return EXERCISE_PRIMARY_MAP[exerciseName?.toLowerCase()] || null;
}

// Evidence-based recovery thresholds per muscle (days until ready to retrain)
// Sources: Schoenfeld et al. 2016, fiber-type composition research
const MUSCLE_RECOVERY_DAYS = {
  abs:        1, // high type 1, oxidative — recovers in ~24h
  calves:     1, // 40–50% type 1, adapted to frequent loading
  forearms:   1, // high type 1 (brachioradialis, flexors), used daily — ~24h
  biceps:     2, // ~60% type 2 but small — ~36–48h
  triceps:    2, // fast-twitch dominant, similar to chest rhythm
  shoulders:  2, // anterior ~60% type 2, posterior more type 1 — ~48h
  chest:      2, // ~65% type 2, lower fatigue resistance — ~48h
  glutes:     2, // large but tolerates frequency well — ~48h
  quads:      3, // very large, type 2 dominant, notorious DOMS — ~72h
  hamstrings: 3, // ~50% type 2, larger group, high injury risk if undertested — ~72h
  back:       3, // mixed fiber, lats/traps large complex — ~72h
};

function getRecoveryStatus(muscle, daysSince) {
  if (daysSince === null) return 'fresh';
  if (daysSince === 0) return 'trained_today';
  const threshold = MUSCLE_RECOVERY_DAYS[muscle] ?? 2;
  if (daysSince < threshold) return 'recovering';
  if (daysSince === threshold) return 'ready';
  return 'fresh';
}

const RECOVERY_COLORS = {
  fresh:         { color: colors.accent, label: 'Primed',        bg: '#1D9E7515' },
  ready:         { color: colors.accent, label: 'Ready',         bg: colors.accentSoft },
  recovering:    { color: colors.warning, label: 'Recovering',    bg: colors.warningSoft },
  trained_today: { color: colors.danger, label: 'Trained today', bg: '#E85D5C18' },
};

const MUSCLE_DISPLAY = {
  chest:      'Chest',
  back:       'Back',
  shoulders:  'Shoulders',
  biceps:     'Biceps',
  triceps:    'Triceps',
  quads:      'Quads',
  hamstrings: 'Hamstrings',
  glutes:     'Glutes',
  calves:     'Calves',
  forearms:   'Forearms',
  abs:        'Abs',
};

export default function TodayScreen({ onStartWorkout, onPreviewWorkout, onAskCoach }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [program, setProgram] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [tomorrowWorkout, setTomorrowWorkout] = useState(null);
  const [muscleRecovery, setMuscleRecovery] = useState({});
  const [weeklyVolume, setWeeklyVolume] = useState({});
  const [weekVolumeSets, setWeekVolumeSets] = useState([]); // raw working sets, last 7 days, for the head-level engine
  const [showVolumeDetail, setShowVolumeDetail] = useState(false);
  // Recovery detail sheet — the Today card stays compact; the body map and the
  // full muscle grid live behind it so recovery doesn't dominate the screen.
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState('body');

  // buildVolumeView walks every working set from the last 7 days and rebuilds
  // the per-head tree. It used to run inline in JSX, so it recomputed on every
  // render — including unrelated state changes like opening a modal.
  const volumeView = useMemo(
    () => buildVolumeView(weekVolumeSets, profile?.trainingExperience || 'beginner'),
    [weekVolumeSets, profile?.trainingExperience],
  );
  const [lastSession, setLastSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [plateaus, setPlateaus] = useState([]);
  const [deloadSuggestion, setDeloadSuggestion] = useState(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [sessionMuscles, setSessionMuscles] = useState([]);
  const [blockData, setBlockData] = useState(null);
  const [blockJustRotated, setBlockJustRotated] = useState(false);
  const [showCardioLog, setShowCardioLog] = useState(false);
  const [recentCardio, setRecentCardio] = useState([]);
  const [readiness, setReadiness] = useState(null); // { status, label, color, advice, hrv, sleep, rhr, vsBaseline }
  const [checkInLabel, setCheckInLabel] = useState(null); // stable 'Ready'|'Moderate'|'Low'
  const [injuryCheckIn, setInjuryCheckIn] = useState(null); // { workout, answers } when modal is open
  const [proactivePrompt, setProactivePrompt] = useState(null); // coach's proactive check-in for today

  const todayName = DAYS[new Date().getDay()];
  const tomorrowName = DAYS[(new Date().getDay() + 1) % 7];
  const lastLoadedAt = useRef(0);


  const openSessionDetail = async () => {
    if (!lastSession) return;
    const { data: sets } = await supabase
      .from('completed_sets')
      .select('exercise_name, pattern_key')
      .eq('session_id', lastSession.id);

    const muscleCounts = {};
    (sets || []).forEach(s => {
      const primary = getPrimaryMuscleForExercise(s.exercise_name, s.pattern_key);
      if (primary) muscleCounts[primary] = (muscleCounts[primary] || 0) + 1;
    });
    const sorted = Object.entries(muscleCounts)
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
    setSessionMuscles(sorted);
    setShowSessionDetail(true);
  };

  useFocusEffect(useCallback(() => {
    if (Date.now() - lastLoadedAt.current < 30000) return;
    lastLoadedAt.current = Date.now();
    const safetyTimer = setTimeout(() => setLoading(false), 5000);
    loadData().finally(() => clearTimeout(safetyTimer));
  }, []));

  // Proactive coach: once data is loaded, pick the single most important thing a
  // trainer would raise today and (rate-limited) send it as a notification.
  useEffect(() => {
    if (loading) return;
    (async () => {
      const daysSinceLastSession = lastSession?.created_at
        ? Math.floor((Date.now() - new Date(lastSession.created_at).getTime()) / 86400000)
        : null;

      // Goal checkpoint (8/12/16-week reviews, target-weight-reached) — lowest
      // priority of the nudges, only surfaces once nothing more urgent is going
      // on. No `goal_set_at` column exists, so goalStartedAt is tracked locally
      // and stamped fresh whenever ProfileScreen detects goals[] actually changed.
      let goalMilestone = null;
      if (profile?.goals?.length) {
        let goalStartedAt = await AsyncStorage.getItem('goalStartedAt');
        if (!goalStartedAt) {
          goalStartedAt = new Date().toISOString();
          await AsyncStorage.setItem('goalStartedAt', goalStartedAt);
        }
        const weeksSinceGoalStart = Math.floor((Date.now() - new Date(goalStartedAt).getTime()) / (7 * 86400000));
        const eligible = getEligibleGoalMilestones(profile.goals, weeksSinceGoalStart, profile.weight_kg, profile.target_weight_kg);
        if (eligible.length) {
          const shownRaw = await AsyncStorage.getItem('shownMilestoneIds');
          const shown = shownRaw ? JSON.parse(shownRaw) : [];
          goalMilestone = eligible.find(m => !shown.includes(m.id)) || null;
        }
      }

      const prompt = getProactiveCoachPrompt({
        daysSinceLastSession,
        weeklyWorkoutsTarget: profile?.weekly_workouts || 3,
        deload: deloadSuggestion,
        plateaus,
        // Stable English label for LOGIC — getProactiveCoachPrompt compares
        // recoveryLabel === 'Low'. readiness.label is translated (t('today.readiness.low')),
        // so passing it meant the recovery nudge only ever fired in English.
        // Prefer today's self-reported check-in; fall back to sensor readiness (iOS).
        recoveryLabel: checkInLabel ?? readiness?.stableLabel ?? null,
        goalMilestone,
      });
      setProactivePrompt(prompt);
      if (prompt) {
        maybeSendProactiveNudge(prompt);
        // Only burn the milestone once it actually won the slot — a
        // higher-priority nudge that day must not silently consume it.
        if (goalMilestone && prompt.key === `milestone_${goalMilestone.id}`) {
          const shownRaw = await AsyncStorage.getItem('shownMilestoneIds');
          const shown = shownRaw ? JSON.parse(shownRaw) : [];
          await AsyncStorage.setItem('shownMilestoneIds', JSON.stringify([...shown, goalMilestone.id]));
        }
      }
    })();
  }, [loading, lastSession, deloadSuggestion, plateaus, readiness, checkInLabel, profile]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) { setLoading(false); return; }

      // Self-reported readiness check-in (best-effort; never throws). A skipped
      // check-in carries no signal, so it must not produce a stable label.
      // Independent of the profile fetch, so both go out at once rather than
      // costing two serial round-trips on the first screen the user sees.
      const [todayCheckIn, { data: prof }] = await Promise.all([
        getTodayCheckIn(),
        supabase
          .from('profiles')
          .select('id, name, sex, trainingExperience, equipment, weekly_workouts, goals, selected_split, health_conditions, injury_profile, coach_notes, weight_kg, target_weight_kg')
          .eq('id', user.id)
          .single(),
      ]);
      setCheckInLabel(todayCheckIn?.skipped ? null : (todayCheckIn?.label ?? null));

      if (prof) {
        setProfile(prof);

        // ── Load or create the user's current training block ──────────────
        let block = null;
        const { data: existingBlock } = await supabase
          .from('program_blocks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingBlock) {
          block = existingBlock;

          // Check if this block is complete — if so, advance to the next block.
          // Only show the rotation banner if the DB write succeeds; if it fails,
          // keep the existing block so the check retries on the next load.
          if (isBlockComplete(block.block_start_date, prof.trainingExperience || 'beginner')) {
            const nextIndex = block.block_index + 1;
            const { data: updatedBlocks } = await supabase
              .from('program_blocks')
              .update({
                block_index: nextIndex,
                block_start_date: new Date().toISOString(),
                level: prof.trainingExperience || 'beginner',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', user.id)
              .select();
            const updatedBlock = updatedBlocks?.[0] || null;
            if (updatedBlock) {
              block = updatedBlock;
              setBlockJustRotated(true);
            }
            // If updatedBlock is null the write failed — keep old block,
            // skip the banner, and let the next app load retry.
          }
        } else {
          // First time — create block record
          const { data: newBlock } = await supabase
            .from('program_blocks')
            .insert({
              user_id: user.id,
              block_index: 0,
              block_start_date: new Date().toISOString(),
              split_id: null,
              level: prof.trainingExperience || 'beginner',
            })
            .select()
            .single();
          block = newBlock || { block_index: 0, block_start_date: new Date().toISOString() };
        }

        setBlockData(block);

        // Skip/swap learning: exercises skipped 3+ times in the last 90 days are
        // treated as disliked and dropped from the generated program.
        const skipsSince = new Date();
        skipsSince.setDate(skipsSince.getDate() - 90);
        // Skips and coach overrides both depend only on the user, so they're
        // fetched together; the program is generated from the first while the
        // second is already in hand.
        const [{ data: skipRows }, { data: overrides }] = await Promise.all([
          supabase
            .from('exercise_skips')
            .select('exercise_name')
            .eq('user_id', user.id)
            .gte('skipped_at', skipsSince.toISOString()),
          supabase
            .from('program_template_overrides')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
        ]);
        const dislikedIds = [...new Set([
          ...computeDislikedExerciseIds(skipRows || []),
          ...dislikedExerciseIdsFromNotes(prof.coach_notes || []),
        ])];

        let prog = generateProgram(prof, block.block_index, block.block_start_date, { dislikedIds });

        // Apply any permanent AI coach edits on top of the generated program

        if (overrides?.length) {
          const equipment = normalizeEquipment(prof.equipment || []);
          overrides.forEach(o => {
            // Legacy rows (written before slot ids) have no slot_id and still
            // resolve by position. Resolve the slot BEFORE applying the edit so we
            // can heal the row: the pre-edit array is the one its index refers to.
            let healSlotId = null;
            if (!o.slot_id) {
              const day = prog.days?.find(d => d.id === o.day_id);
              healSlotId = day?.exercises?.[o.exercise_index]?.slotId ?? null;
            }
            prog = applyPermanentEdit(prog, {
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
            // Best-effort heal: upgrade the row to slot identity so it stops
            // depending on position. Never block rendering on it.
            if (!o.slot_id && healSlotId) {
              supabase.from('program_template_overrides')
                .update({ slot_id: healSlotId })
                .eq('id', o.id)
                .then(() => {}, () => {});
            }
          });
        }

        // Merge baseline injury conditions (always-on body parts) with any explicit health conditions
        const baselineInjuryConditions = getConditionsFromInjuryProfile(prof.injury_profile || []);
        const mergedConditions = [...new Set([...(prof.health_conditions || []), ...baselineInjuryConditions])];
        prog = applyContraindicationFilters(prog, { ...prof, health_conditions: mergedConditions });

        // ── Completion-based schedule ──────────────────────────────────────
        // Rest days are still weekday-driven (today is a rest day if this split
        // assigns no slot to this weekday). But the WORKOUT shown is the next one
        // DUE in the rotation based on what you've actually completed — a missed
        // workout is never skipped; it stays "due" until you do it. Completing any
        // workout (even out of order) advances the rotation from there.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); // local midnight — avoids UTC offset bug

        // Recent sessions, newest first: finds the last completed rotation workout
        // (the "due" pointer) and whether one was completed today.
        const { data: recentSessions } = await supabase
          .from('workout_sessions')
          .select('name, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(30);

        // Volume rebalance: if an optional specialisation day (e.g. Shoulders Day)
        // was actually completed in the last 7 days, trim the now-redundant
        // isolation sets it duplicates from the main days so the weekly total for
        // those heads doesn't overshoot. Done before setProgram so both the
        // overview and the served workout reflect the rebalanced volume.
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const completedThisWeek = (recentSessions || [])
          .filter(s => new Date(s.completed_at) >= weekAgo)
          .map(s => s.name);
        prog = rebalanceForCompletedOptionalDays(prog, completedThisWeek);

        setProgram(prog);

        const isTrainingDayToday = prog.schedule.indexOf(todayName) !== -1;
        const rotation = prog.days || [];
        const rotationNames = rotation.map(d => d.name?.toLowerCase().trim());

        const completedTodayNames = new Set(
          (recentSessions || [])
            .filter(s => new Date(s.completed_at) >= todayStart)
            .map(s => s.name?.toLowerCase().trim())
        );

        // Due = the workout AFTER the most recently completed one (before today).
        let dueIndex = 0;
        if (rotation.length) {
          const lastPrior = (recentSessions || []).find(s =>
            new Date(s.completed_at) < todayStart &&
            rotationNames.includes(s.name?.toLowerCase().trim())
          );
          if (lastPrior) {
            const lastIdx = rotationNames.indexOf(lastPrior.name.toLowerCase().trim());
            dueIndex = (lastIdx + 1) % rotation.length;
          }
        }
        const dueWorkout = rotation.length ? rotation[dueIndex] : null;
        const dueDoneToday = !!dueWorkout && completedTodayNames.has(dueWorkout.name?.toLowerCase().trim());

        // Show the due workout on a training day (it waits, never auto-skips) or if
        // it was already done today; show rest (null) on a rest day. Unconditional
        // set so a rest day clears any stale workout from a previous load.
        const todayWk = (isTrainingDayToday || dueDoneToday) ? dueWorkout : null;
        setTodayWorkout(todayWk);
        setTodayCompleted(dueDoneToday);

        // Next up: after today's workout it's the following rotation slot; on a rest
        // day the next thing to do is the still-pending due workout.
        const nextAfterDue = rotation.length ? rotation[(dueIndex + 1) % rotation.length] : null;
        setTomorrowWorkout(todayWk ? nextAfterDue : dueWorkout);
      }

      // Load last 30 days of sessions + sets — plateau/deload analysis needs the
      // full 30-day window; recovery and weekly volume filter their own ranges.
      const historyStart = new Date();
      historyStart.setDate(historyStart.getDate() - 30);

      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, created_at, completed_at, name, duration_min, perceived_exertion')
        .eq('user_id', user.id)
        .gte('created_at', historyStart.toISOString())
        .order('created_at', { ascending: false });

      if (sessions?.length > 0) {
        // Last session
        setLastSession(sessions[0]);

        // Get all sets from these sessions
        const sessionIds = sessions.map(s => s.id);
        const { data: sets } = await supabase
          .from('completed_sets')
          .select('exercise_name, pattern_key, session_id, created_at, weight_kg, reps')
          .in('session_id', sessionIds);

        if (!sets?.length) {
          // No sets logged — all muscles fresh
          const recovery = {};
          Object.keys(MUSCLE_DISPLAY).forEach(muscle => {
            recovery[muscle] = { daysSince: null, status: 'fresh', lastDate: null };
          });
          setMuscleRecovery(recovery);
        } else {
          // Map session_id → created_at
          const sessionDateMap = {};
          sessions.forEach(s => { sessionDateMap[s.id] = new Date(s.created_at); });

          // Calculate last trained date per muscle — primary muscle only, so a
          // shoulders day (OHP secondaries: triceps/upper chest) doesn't reset
          // the recovery clock for chest and triceps. A single light accessory
          // (e.g. 3 sets of shrugs → back) isn't enough stimulus to count either:
          // a muscle only lights up if the session gave it ≥2 exercises or ≥5 sets.
          const perSessionMuscle = {}; // session_id -> muscle -> { count, exercises }
          sets.forEach(set => {
            const muscle = getPrimaryMuscleForExercise(set.exercise_name, set.pattern_key);
            if (!muscle) return;
            const muscles = (perSessionMuscle[set.session_id] ??= {});
            const entry = (muscles[muscle] ??= { count: 0, exercises: new Set() });
            entry.count += 1;
            entry.exercises.add(set.exercise_name.toLowerCase());
          });
          const lastTrainedPerMuscle = {};
          Object.entries(perSessionMuscle).forEach(([sessionId, muscles]) => {
            const sessionDate = sessionDateMap[sessionId];
            if (!sessionDate) return;
            Object.entries(muscles).forEach(([muscle, entry]) => {
              if (entry.exercises.size < 2 && entry.count < 5) return;
              if (!lastTrainedPerMuscle[muscle] || sessionDate > lastTrainedPerMuscle[muscle]) {
                lastTrainedPerMuscle[muscle] = sessionDate;
              }
            });
          });

          // Calculate recovery status
          const recovery = {};
          const today = new Date();
          Object.keys(MUSCLE_DISPLAY).forEach(muscle => {
            const lastDate = lastTrainedPerMuscle[muscle];
            const daysSince = lastDate ? differenceInDays(today, lastDate) : null;
            recovery[muscle] = {
              daysSince,
              status: getRecoveryStatus(muscle, daysSince),
              lastDate,
            };
          });
          setMuscleRecovery(recovery);

          // Calculate weekly volume (rolling 7 days from today)
          const sevenDaysAgo = subDays(new Date(), 7);
          const weekSets = sets.filter(set => {
            const sessionDate = sessionDateMap[set.session_id];
            return sessionDate && sessionDate >= sevenDaysAgo;
          });

          const volume = {};
          weekSets.forEach(set => {
            const primary = getPrimaryMuscleForExercise(set.exercise_name);
            if (primary) volume[primary] = (volume[primary] || 0) + 1;
          });
          setWeeklyVolume(volume);
          // Raw sets feed the head-level engine (direct + indirect per muscle head).
          setWeekVolumeSets(weekSets.map(s => ({ exercise_name: s.exercise_name })));

          // ── Plateau and deload detection ─────────────────────────────────
          // Pull last 30 days of sets for plateau analysis
          const thirtyDaysAgo = subDays(new Date(), 30);
          const sessionRpeMap = {};
          sessions.forEach(s => { sessionRpeMap[s.id] = s.perceived_exertion; });
          const setsWithDates = sets.map(s => ({
            ...s,
            completed_at: sessionDateMap[s.session_id]?.toISOString(),
            // Per-set RPE isn't logged — use the session's perceived exertion,
            // which is what the deload autoregulation averages per session anyway.
            rpe: sessionRpeMap[s.session_id] ?? null,
          })).filter(s => s.completed_at && new Date(s.completed_at) >= thirtyDaysAgo);

          const detectedPlateaus = detectPlateaus(setsWithDates, prof);
          setPlateaus(detectedPlateaus);

          const deload = detectDeloadNeeded(sessions, setsWithDates, prof);
          setDeloadSuggestion(deload);
        }
      }

      // ── Health log upsert + readiness ────────────────────────────────────
      if (user) {
        const authorized = await isHealthAuthorized();
        if (authorized) {
          const health = await getRecoveryData();
          if (health.sleep !== null || health.hrv !== null || health.rhr !== null) {
            const today = format(new Date(), 'yyyy-MM-dd'); // local date, not UTC
            const source = Platform.OS === 'ios' ? 'healthkit' : 'health_connect';
            await supabase.from('daily_health_logs').upsert({
              user_id: user.id,
              date: today,
              sleep_hours: health.sleep,
              hrv_ms: health.hrv,
              resting_hr: health.rhr,
              steps: health.steps,
              source,
            }, { onConflict: 'user_id,date' });

            // HRV baseline from last 14 days (excluding today)
            const { data: recentLogs } = await supabase
              .from('daily_health_logs')
              .select('hrv_ms, sleep_hours, date')
              .eq('user_id', user.id)
              .not('hrv_ms', 'is', null)
              .order('date', { ascending: false })
              .limit(15);

            // Baseline excludes today's log explicitly — slice(1) wrongly dropped
            // yesterday whenever today's row was missing from the HRV-filtered list.
            const priorLogs = (recentLogs || []).filter(r => r.date !== today);
            const baseline = priorLogs.length >= 3
              ? Math.round(priorLogs.reduce((s, r) => s + r.hrv_ms, 0) / priorLogs.length)
              : null;

            const todayHrv = health.hrv;
            let status = health.status;

            // Override with HRV-vs-baseline when we have enough data
            if (baseline && todayHrv) {
              const ratio = todayHrv / baseline;
              const vsBaseline = Math.round((ratio - 1) * 100);
              if (ratio >= 0.9) status = { label: t('today.readiness.ready'), stableLabel: 'Ready', color: colors.accent, advice: null };
              else if (ratio >= 0.75) status = { label: t('today.readiness.moderate'), stableLabel: 'Moderate', color: colors.warning, advice: t('today.readiness.adviceModerate') };
              else status = { label: t('today.readiness.low'), stableLabel: 'Low', color: colors.danger, advice: t('today.readiness.adviceLow') };

              setReadiness({ ...status, hrv: todayHrv, sleep: health.sleep, rhr: health.rhr, vsBaseline, baseline });
            } else if (status) {
              // status here is health.status from buildRecoveryStatus() (lib/healthService.js),
              // which now sets stableLabel alongside label. Fall back to status.label (already
              // stable English there) in case stableLabel is ever absent — the LOGIC label must
              // never end up being the translated display label.
              setReadiness({ ...status, stableLabel: status.stableLabel ?? status.label, hrv: todayHrv, sleep: health.sleep, rhr: health.rhr, vsBaseline: null, baseline: null });
            }
          }
        }
      }

      // Load recent cardio sessions
      if (user) {
        const { data: cardioSessions } = await supabase
          .from('workout_sessions')
          .select('id, name, session_type, duration_min, distance_km, cardio_subtype, completed_at')
          .eq('user_id', user.id)
          .neq('session_type', 'strength')
          .order('completed_at', { ascending: false })
          .limit(5);
        if (cardioSessions?.length) setRecentCardio(cardioSessions);
      }

      setLoading(false);
    } catch (err) {
      console.error('TodayScreen error:', err);
      setLoading(false);
    }
  };

  // Start a workout — if the user has injuries, run the pre-workout check-in first
  const beginWorkout = (workout) => {
    const w = { ...workout, trainingExperience: profile?.trainingExperience };
    const injuries = profile?.injury_profile || [];
    if (injuries.length === 0) {
      onStartWorkout && onStartWorkout(w);
      return;
    }
    // Default each body part to its baseline tier (always → usual, sometimes → good)
    const answers = {};
    injuries.forEach(i => { answers[i.body_part] = i.severity === 'always' ? 'usual' : 'good'; });
    setInjuryCheckIn({ workout: w, answers });
  };

  const confirmInjuryCheckIn = () => {
    const { workout, answers } = injuryCheckIn;
    const todayConditions = getConditionsFromInjuryProfile(profile?.injury_profile || [], answers);
    const filtered = applyContraindicationsToWorkout(
      workout,
      todayConditions,
      normalizeEquipment(profile?.equipment || [])
    );
    setInjuryCheckIn(null);
    onStartWorkout && onStartWorkout(filtered);
  };

  if (loading) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
      <ActivityIndicator size="large" color={colors.textPrimary} />
    </SafeAreaView>
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('today.greetingMorning');
    if (h < 17) return t('today.greetingAfternoon');
    return t('today.greetingEvening');
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}</Text>
        <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMM d')}</Text>
      </View>

      {/* Block rotation banner */}
      {blockJustRotated && (
        <View style={styles.blockBanner}>
          <Text style={styles.blockBannerTitle}>{t('today.block.newTitle')}</Text>
          <Text style={styles.blockBannerSub}>
            {t('today.block.newSub')}
          </Text>
        </View>
      )}

      {/* Block progress pill */}
      {blockData && !blockJustRotated && (
        <View style={styles.blockPill}>
          <Text style={styles.blockPillText}>
            {t('today.block.pill', { block: blockData.block_index + 1, week: Math.max(1, Math.ceil((Date.now() - new Date(blockData.block_start_date).getTime()) / (7 * 86400000))), total: getBlockLength(profile?.trainingExperience || 'beginner') })}
          </Text>
        </View>
      )}

      {/* Recovery readiness */}
      {readiness && (
        <View style={[styles.readinessCard, { borderColor: readiness.color + '44', backgroundColor: readiness.color + '10' }]}>
          <View style={styles.readinessRow}>
            <View style={[styles.readinessDot, { backgroundColor: readiness.color }]} />
            <Text style={[styles.readinessLabel, { color: readiness.color }]}>{readiness.label}</Text>
            <View style={styles.readinessStats}>
              {readiness.sleep !== null && <Text style={styles.readinessStat}>{t('today.readiness.sleepStat', { hours: readiness.sleep })}</Text>}
              {readiness.hrv !== null && (
                <Text style={styles.readinessStat}>
                  {t('today.readiness.hrvStat', { ms: readiness.hrv })}{readiness.vsBaseline !== null ? t('today.readiness.baselineSuffix', { sign: readiness.vsBaseline > 0 ? '+' : '', pct: readiness.vsBaseline }) : ''}
                </Text>
              )}
              {readiness.rhr !== null && <Text style={styles.readinessStat}>{t('today.readiness.rhrStat', { bpm: readiness.rhr })}</Text>}
            </View>
          </View>
          {readiness.advice && <Text style={[styles.readinessAdvice, { color: readiness.color }]}>{readiness.advice}</Text>}
        </View>
      )}

      {/* Today's session or rest day */}
      {todayWorkout ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sessionLabel}>{t('today.session.todayLabel')}</Text>
          <Text style={styles.sessionName}>{todayWorkout.name}</Text>
          <Text style={styles.sessionFocus}>{todayWorkout.focus}</Text>
          <View style={styles.sessionMeta}>
            <View style={styles.sessionMetaChip}>
              <Text style={styles.sessionMetaText}>{t('today.session.exercises', { count: todayWorkout.exercises?.length || 0 })}</Text>
            </View>
            <View style={styles.sessionMetaChip}>
              <Text style={styles.sessionMetaText}>{t('today.session.sets', { count: todayWorkout.exercises?.reduce((s,e)=>s+e.sets,0) || 0 })}</Text>
            </View>
          </View>
          {/* Exercise preview */}
          <View style={styles.exercisePreview}>
            {(todayWorkout.exercises || []).slice(0, 4).map((ex, i) => (
              <View key={i} style={styles.exPreviewRow}>
                <View style={styles.exPreviewDot} />
                <Text style={styles.exPreviewName}>{ex.name}</Text>
                <Text style={styles.exPreviewDetail}>{ex.sets}×{ex.reps}</Text>
              </View>
            ))}
            {(todayWorkout.exercises?.length || 0) > 4 && (
              <Text style={styles.moreText}>{t('today.session.more', { count: todayWorkout.exercises.length - 4 })}</Text>
            )}
          </View>
          {todayCompleted ? (
            <>
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>{t('today.session.completed')}</Text>
              </View>
              {tomorrowWorkout && (
                <Tappable style={styles.startBtn} onPress={() => beginWorkout(tomorrowWorkout)}>
                  <Text style={styles.startBtnText}>{t('today.session.nextUp', { name: tomorrowWorkout.name.split('—')[0].trim() })}</Text>
                </Tappable>
              )}
            </>
          ) : (
            <Tappable style={styles.startBtn} onPress={() => beginWorkout(todayWorkout)}>
              <Text style={styles.startBtnText}>{t('today.session.start')}</Text>
            </Tappable>
          )}
        </View>
      ) : (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>{t('today.rest.title')}</Text>
          <Text style={styles.restSub}>{t('today.rest.sub')}</Text>
          {tomorrowWorkout && (
            <Tappable style={styles.startBtn} onPress={() => beginWorkout(tomorrowWorkout)}>
              <Text style={styles.startBtnText}>{t('today.session.nextUp', { name: tomorrowWorkout.name.split('—')[0].trim() })}</Text>
            </Tappable>
          )}
        </View>
      )}

      {/* Cardio log */}
      <View style={styles.section}>
        <View style={styles.cardioHeader}>
          <View>
            <Text style={styles.sectionTitle}>{t('today.cardio.title')}</Text>
            {recentCardio.length > 0 && (
              <Text style={styles.sectionSub}>{t('today.cardio.lastSessions', { count: recentCardio.length })}</Text>
            )}
          </View>
          <Tappable style={styles.cardioLogBtn} onPress={() => setShowCardioLog(true)}>
            <Text style={styles.cardioLogBtnText}>{t('today.cardio.log')}</Text>
          </Tappable>
        </View>

        {recentCardio.length === 0 ? (
          <View style={styles.cardioEmpty}>
            <Text style={styles.cardioEmptyText}>{t('today.cardio.empty')}</Text>
          </View>
        ) : (
          recentCardio.map(s => {
            const typeLabel = t(`today.cardio.${s.session_type}`, { defaultValue: s.session_type });
            const distStr = s.distance_km
              ? s.session_type === 'swim'
                ? `${Math.round(s.distance_km * 1000)}m`
                : `${s.distance_km}km`
              : null;
            const pace = s.distance_km && s.duration_min && s.session_type !== 'swim'
              ? (s.duration_min / s.distance_km).toFixed(1) + ' min/km'
              : null;
            const sub = [s.cardio_subtype, distStr, pace].filter(Boolean).join(' · ');
            const dayLabel = isToday(new Date(s.completed_at)) ? t('dates.today')
              : isYesterday(new Date(s.completed_at)) ? t('dates.yesterday')
              : format(new Date(s.completed_at), 'MMM d');
            return (
              <View key={s.id} style={styles.cardioRow}>
                <View style={styles.cardioRowLeft}>
                  <Text style={styles.cardioRowType}>{typeLabel}</Text>
                  {sub ? <Text style={styles.cardioRowSub}>{sub}</Text> : null}
                </View>
                <View style={styles.cardioRowRight}>
                  <Text style={styles.cardioRowDur}>{t('today.cardio.minutes', { count: s.duration_min })}</Text>
                  <Text style={styles.cardioRowDate}>{dayLabel}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Muscle recovery — compact on Today. The body map and the full muscle
          grid live in the detail sheet so this stays roughly the footprint of
          the old chip grid instead of taking over the screen. */}
      <View style={styles.section}>
        {(() => {
          const keys = Object.keys(MUSCLE_DISPLAY);
          const counts = keys.reduce((acc, m) => {
            const status = muscleRecovery[m]?.status || 'fresh';
            if (status === 'trained_today' || status === 'recovering') acc.recovering += 1;
            else acc.ready += 1;
            return acc;
          }, { ready: 0, recovering: 0 });
          return (
            <Tappable
              style={styles.recoveryCard}
              onPress={() => { setRecoveryTab('body'); setShowRecovery(true); }}
              accessibilityLabel={t('today.recovery.title')}
            >
              <BodyHeatMap recovery={muscleRecovery} sex={profile?.sex} side="front" height={130} />
              <View style={styles.recoveryInfo}>
                <View style={styles.recoveryTopRow}>
                  <Text style={styles.recoveryTitle}>{t('today.recovery.title')}</Text>
                  <Text style={styles.recoveryMore}>{t('today.recovery.details')} ›</Text>
                </View>
                <Text style={styles.recoverySub}>{t('today.recovery.sub')}</Text>
                <View style={styles.recoveryPills}>
                  <View style={[styles.recoveryPill, { backgroundColor: colors.accentSoft, borderColor: colors.accentHair }]}>
                    <Text style={[styles.recoveryPillText, { color: colors.accent }]}>
                      {t('today.recovery.readyCount', { count: counts.ready })}
                    </Text>
                  </View>
                  {counts.recovering > 0 && (
                    <View style={[styles.recoveryPill, { backgroundColor: colors.warningSoft, borderColor: colors.warningHair }]}>
                      <Text style={[styles.recoveryPillText, { color: colors.warning }]}>
                        {t('today.recovery.recoveringCount', { count: counts.recovering })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Tappable>
          );
        })()}
      </View>

      {/* Recovery detail — Body (anatomy, front + back) / Muscles (the same grid
          the app has always used, unchanged). */}
      <Modal visible={showRecovery} animationType="slide" onRequestClose={() => setShowRecovery(false)}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.recoveryHeader}>
            <Text style={styles.recoveryHeaderTitle}>{t('today.recovery.title')}</Text>
            <Tappable onPress={() => setShowRecovery(false)} hitSlop={12}>
              <Text style={styles.recoveryDone}>{t('common.done')}</Text>
            </Tappable>
          </View>

          <View style={styles.recoveryTabs}>
            {['body', 'muscles'].map(tab => (
              <Tappable
                key={tab}
                style={[styles.recoveryTab, recoveryTab === tab && styles.recoveryTabActive]}
                onPress={() => setRecoveryTab(tab)}
                accessibilityState={{ selected: recoveryTab === tab }}
              >
                <Text style={[styles.recoveryTabText, recoveryTab === tab && styles.recoveryTabTextActive]}>
                  {t(tab === 'body' ? 'today.recovery.tabBody' : 'today.recovery.tabMuscles')}
                </Text>
              </Tappable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {recoveryTab === 'body' ? (
              <View style={styles.recoveryBodies}>
                <BodyHeatMap recovery={muscleRecovery} sex={profile?.sex} side="front" height={330} />
                <BodyHeatMap recovery={muscleRecovery} sex={profile?.sex} side="back" height={330} />
              </View>
            ) : (
              <View style={styles.muscleGrid}>
                {Object.keys(MUSCLE_DISPLAY).map((muscle) => {
                  const r = muscleRecovery[muscle];
                  const status = r?.status || 'fresh';
                  const rc = RECOVERY_COLORS[status];
                  return (
                    <View key={muscle} style={[styles.muscleChip, { backgroundColor: rc.bg, borderColor: rc.color + '44' }]}>
                      <Text style={[styles.muscleChipName, { color: rc.color }]}>{t(`today.muscles.${muscle}`)}</Text>
                      <Text style={[styles.muscleChipStatus, { color: rc.color }]}>
                        {status === 'trained_today' ? t('dates.today')
                          : r?.daysSince == null ? t('today.recovery.never')
                          : t('today.recovery.daysAgo', { count: r.daysSince })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Weekly volume */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('today.volume.title')}</Text>
        <Text style={styles.sectionSub}>{t('today.volume.sub')}</Text>

        {/* Legend */}
        <View style={styles.volumeLegend}>
          <View style={styles.volumeLegendItem}>
            <View style={[styles.volumeLegendDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.volumeLegendLabel}>{t('today.volume.belowMin')}</Text>
          </View>
          <View style={styles.volumeLegendItem}>
            <View style={[styles.volumeLegendDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.volumeLegendLabel}>{t('today.volume.belowOpt')}</Text>
          </View>
          <View style={styles.volumeLegendItem}>
            <View style={[styles.volumeLegendDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.volumeLegendLabel}>{t('today.volume.inRange')}</Text>
          </View>
        </View>

        {/* Simple ↔ per-head detail toggle */}
        <Tappable
          onPress={() => { animateLayout(); setShowVolumeDetail(v => !v); }}
          style={styles.volumeDetailToggle}
          accessibilityState={{ expanded: showVolumeDetail }}
        >
          <Text style={styles.volumeDetailToggleText}>
            {showVolumeDetail
              ? t('today.volume.hideDetail', { defaultValue: 'Hide per-head detail' })
              : t('today.volume.showDetail', { defaultValue: 'Show per-head detail' })}
          </Text>
        </Tappable>

        {(() => {
          const tier = profile?.trainingExperience || 'beginner';
          const view = volumeView;
          const fmt = (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

          // Junk-volume callout: any group/head whose DIRECT volume is >1.5× optimal.
          const junk = [];
          view.forEach(g => {
            if (g.split) {
              g.heads.forEach(h => {
                if (h.target && h.direct > h.target.optimal_high * 1.5)
                  junk.push({ label: t(`today.heads.${h.key}`, { defaultValue: h.key }), count: h.direct });
              });
            } else if (g.target && g.done > g.target.optimal_high * 1.5) {
              junk.push({ label: t(`today.muscles.${g.key}`, { defaultValue: g.key }), count: g.done });
            }
          });

          const Bar = ({ done, target, color }) => {
            const high = target?.optimal_high || Math.max(done, 1);
            const fillPct = Math.min(done / high, 1) * 100;
            return (
              <View style={styles.volumeBarTrack}>
                <View style={[styles.volumeBarFill, { width: `${fillPct}%`, backgroundColor: color }]} />
              </View>
            );
          };

          const targetLabel = (tgt) =>
            t('today.volume.target', { min: tgt.min, low: tgt.optimal_low, high: tgt.optimal_high });

          return (
            <>
              {view.map(g => {
                const label = t(`today.muscles.${g.key}`, { defaultValue: g.key });
                return (
                  <View key={g.key} style={showVolumeDetail ? styles.volumeGroupBlock : null}>
                    <View style={styles.volumeRow}>
                      <View style={styles.volumeNameCol}>
                        <Text style={styles.volumeMuscleName}>{label}</Text>
                        {!!g.target && <Text style={styles.volumeTargetLabel}>{targetLabel(g.target)}</Text>}
                      </View>
                      <Bar done={g.done} target={g.target} color={g.color} />
                      <Text style={[styles.volumeCount, { color: g.color }]}>{fmt(g.done)}</Text>
                    </View>

                    {showVolumeDetail && g.heads.map(h => {
                      const headLabel = t(`today.heads.${h.key}`, { defaultValue: h.key });
                      const subParts = [];
                      subParts.push(h.target ? targetLabel(h.target) : t('today.volume.fromCompounds', { defaultValue: 'from compounds' }));
                      if (h.indirect > 0) subParts.push(t('today.volume.indirect', { n: fmt(h.indirect), defaultValue: `+${fmt(h.indirect)} indirect` }));
                      return (
                        <View key={h.key} style={styles.volumeHeadRow}>
                          <View style={styles.volumeNameCol}>
                            <Text style={styles.volumeHeadName}>{headLabel}</Text>
                            <Text style={styles.volumeTargetLabel}>{subParts.join(' · ')}</Text>
                          </View>
                          {h.target ? <Bar done={h.direct} target={h.target} color={h.color} /> : <View style={styles.volumeBarTrack} />}
                          <Text style={[styles.volumeCount, { color: h.target ? h.color : colors.textSubtle }]}>{fmt(h.direct)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {junk.length > 0 && (
                <View style={styles.junkWarning}>
                  <View style={styles.junkWarningHeader}>
                    <Ionicons name="warning" size={12} color={colors.danger} style={{ marginTop: 1 }} accessibilityElementsHidden importantForAccessibility="no" />
                    <Text style={styles.junkWarningTitle}>{t('today.volume.junkTitle')}</Text>
                  </View>
                  <Text style={styles.junkWarningText}>
                    {t('today.volume.junkText', { muscles: junk.map(m => t('today.volume.junkMuscle', { label: m.label, count: m.count })).join(', ') })}
                  </Text>
                </View>
              )}
            </>
          );
        })()}
      </View>

      {/* Deload suggestion */}
      {deloadSuggestion && (
        <View style={styles.section}>
          <View style={styles.deloadCard}>
            {/* Header */}
            <View style={styles.deloadHeader}>
              <View style={styles.deloadIconWrap}>
                <Ionicons
                  name={deloadSuggestion.trigger === 'autoreg' ? 'flash' : 'refresh'}
                  size={20}
                  color={colors.textPrimary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
              <View style={styles.deloadHeaderText}>
                <Text style={styles.deloadTitle}>{deloadSuggestion.headline}</Text>
                <Text style={styles.deloadTrigger}>
                  {deloadSuggestion.trigger === 'autoreg' ? t('today.deload.fatigueDetected') : t('today.deload.weeksTraining', { weeks: deloadSuggestion.weeksTraining })}
                </Text>
              </View>
            </View>

            {/* Reason */}
            <Text style={styles.deloadReason}>{deloadSuggestion.reason}</Text>

            {/* Main message */}
            <Text style={styles.deloadMessage}>{deloadSuggestion.message}</Text>

            {/* Stats row */}
            <View style={styles.deloadStats}>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>
                  {Math.round(deloadSuggestion.volumeReduction * 100)}%
                </Text>
                <Text style={styles.deloadStatLabel}>{t('today.deload.setsCut')}</Text>
              </View>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>
                  {deloadSuggestion.keepIntensity ? t('today.deload.same') : '−20%'}
                </Text>
                <Text style={styles.deloadStatLabel}>{t('today.deload.weight')}</Text>
              </View>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>{t('today.deload.durationDays')}</Text>
                <Text style={styles.deloadStatLabel}>{t('today.deload.duration')}</Text>
              </View>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>3–4</Text>
                <Text style={styles.deloadStatLabel}>{t('today.deload.rirTarget')}</Text>
              </View>
            </View>

            {/* Diet note (fat loss users only) */}
            {deloadSuggestion.dietNote && (
              <View style={styles.deloadDietNote}>
                <Text style={styles.deloadDietNoteText}>{deloadSuggestion.dietNote}</Text>
              </View>
            )}

            {/* Instructions */}
            <Text style={styles.deloadInstructionsTitle}>{t('today.deload.thisWeek')}</Text>
            {deloadSuggestion.instructions.map((instruction, i) => (
              <View key={i} style={styles.deloadInstruction}>
                <Text style={styles.deloadInstructionNum}>{i + 1}</Text>
                <Text style={styles.deloadInstructionText}>{instruction}</Text>
              </View>
            ))}

            {/* Science */}
            <Text style={styles.deloadScience}>{deloadSuggestion.science}</Text>
          </View>
        </View>
      )}

      {/* Proactive coach check-in — the trainer raises the most important thing
          today; tapping opens the Coach with the question already sent. */}
      {proactivePrompt && (
        <View style={styles.section}>
          <Tappable
            style={styles.coachNudgeCard}
            onPress={() => {
              onAskCoach?.(proactivePrompt.ask);
              navigation.navigate('Coach');
            }}
          >
            <View style={styles.coachNudgeHeader}>
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.info} style={{ marginTop: 1 }} accessibilityElementsHidden importantForAccessibility="no" />
              <Text style={styles.coachNudgeTitle}>{proactivePrompt.title}</Text>
            </View>
            <Text style={styles.coachNudgeBody}>{proactivePrompt.body}</Text>
            <Text style={styles.coachNudgeHint}>{t('today.proactive.tapToAsk')}</Text>
          </Tappable>
        </View>
      )}

      {/* Plateau alerts */}
      {plateaus.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('today.plateau.title')}</Text>
          {plateaus.map((p, i) => (
            <View key={i} style={[styles.plateauCard, p.type === 'confirmed' && styles.plateauCardConfirmed]}>
              <View style={styles.plateauHeader}>
                <Ionicons
                  name={p.type === 'confirmed' ? 'remove-circle' : 'warning'}
                  size={18}
                  color={p.type === 'confirmed' ? colors.danger : colors.warning}
                  style={{ marginTop: 1 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <View style={styles.plateauHeaderText}>
                  <Text style={styles.plateauExercise}>{p.exercise}</Text>
                  <Text style={styles.plateauDays}>{t('today.plateau.progress', { days: p.days, rm: p.est1rm })}</Text>
                </View>
              </View>
              <Text style={styles.plateauMessage}>{p.message}</Text>
              <Text style={styles.plateauFixTitle}>{t('today.plateau.whatToDo')}</Text>
              {p.interventions.map((intervention, j) => (
                <Text key={j} style={styles.plateauIntervention}>· {intervention}</Text>
              ))}
              <Text style={styles.plateauScience}>{p.science}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Last session */}
      {lastSession && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('today.lastSession.title')}</Text>
          <Tappable style={styles.lastSessionCard} onPress={openSessionDetail}>
            <View style={styles.lastSessionLeft}>
              <Text style={styles.lastSessionName}>{lastSession.name}</Text>
              <Text style={styles.lastSessionDate}>
                {isToday(new Date(lastSession.created_at)) ? t('dates.today')
                  : isYesterday(new Date(lastSession.created_at)) ? t('dates.yesterday')
                  : format(new Date(lastSession.created_at), 'EEE, MMM d')}
              </Text>
            </View>
            <View style={styles.lastSessionRight}>
              {lastSession.duration_min > 0 && (
                <Text style={styles.lastSessionStat}>{t('today.lastSession.minutes', { count: lastSession.duration_min })}</Text>
              )}
              {lastSession.perceived_exertion && (
                <Text style={styles.lastSessionRpe}>{t('today.lastSession.rpe', { value: lastSession.perceived_exertion })}</Text>
              )}
            </View>
          </Tappable>
        </View>
      )}

      {/* Session muscle breakdown modal */}
      <Modal visible={showSessionDetail} transparent animationType="slide" onRequestClose={() => setShowSessionDetail(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSessionDetail(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{lastSession?.name}</Text>
            <Text style={styles.modalSub}>
              {lastSession && (isToday(new Date(lastSession.created_at)) ? t('dates.today')
                : isYesterday(new Date(lastSession.created_at)) ? t('dates.yesterday')
                : format(new Date(lastSession.created_at), 'EEE, MMM d'))}
              {lastSession?.duration_min > 0 ? `  ·  ${t('today.modal.minutes', { count: lastSession.duration_min })}` : ''}
              {lastSession?.perceived_exertion ? `  ·  ${t('today.modal.rpe', { value: lastSession.perceived_exertion })}` : ''}
            </Text>

            <Text style={styles.modalSectionLabel}>{t('today.modal.setsPerMuscle')}</Text>
            {sessionMuscles.length === 0 ? (
              <Text style={styles.modalEmpty}>{t('today.modal.noData')}</Text>
            ) : (
              (() => {
                const max = sessionMuscles[0]?.sets || 1;
                return sessionMuscles.map(({ muscle, sets }) => (
                  <View key={muscle} style={styles.muscleRow}>
                    <Text style={styles.muscleLabel}>{t(`today.muscles.${muscle}`, { defaultValue: MUSCLE_DISPLAY[muscle] || muscle })}</Text>
                    <View style={styles.muscleBarBg}>
                      <View style={[styles.muscleBarFill, { width: `${(sets / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.muscleCount}>{sets}</Text>
                  </View>
                ));
              })()
            )}

            <Tappable style={styles.modalClose} onPress={() => setShowSessionDetail(false)}>
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
            </Tappable>
          </Pressable>
        </Pressable>
      </Modal>

      <CardioLogModal
        visible={showCardioLog}
        onClose={() => setShowCardioLog(false)}
        onSaved={() => {
          lastLoadedAt.current = 0;
          loadData();
        }}
      />

      {/* Pre-workout injury check-in */}
      <Modal visible={!!injuryCheckIn} transparent animationType="slide" onRequestClose={() => setInjuryCheckIn(null)}>
        <Pressable style={styles.checkInOverlay} onPress={() => setInjuryCheckIn(null)}>
          <Pressable style={styles.checkInCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.checkInTitle}>{t('today.checkIn.title')}</Text>
            <Text style={styles.checkInSub}>{t('today.checkIn.sub')}</Text>

            {(profile?.injury_profile || []).map(injury => {
              const bp = INJURY_BODY_PARTS.find(b => b.key === injury.body_part);
              const answer = injuryCheckIn?.answers[injury.body_part];
              return (
                <View key={injury.body_part} style={styles.checkInRow}>
                  <Text style={styles.checkInBodyPart}>{bp?.label || injury.body_part}</Text>
                  <View style={styles.checkInOptions}>
                    {[['good', t('today.checkIn.good')], ['usual', t('today.checkIn.usual')], ['flare', t('today.checkIn.flare')]].map(([val, label]) => (
                      <Tappable
                        key={val}
                        style={[styles.checkInOpt, answer === val && styles.checkInOptActive]}
                        onPress={() => setInjuryCheckIn(s => ({ ...s, answers: { ...s.answers, [injury.body_part]: val } }))}
                        accessibilityState={{ selected: answer === val }}
                      >
                        <Text style={[styles.checkInOptText, answer === val && styles.checkInOptTextActive]}>{label}</Text>
                      </Tappable>
                    ))}
                  </View>
                </View>
              );
            })}

            <Tappable style={styles.checkInStartBtn} onPress={confirmInjuryCheckIn}>
              <Text style={styles.checkInStartText}>{t('today.checkIn.start')}</Text>
            </Tappable>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: { padding: 24, paddingTop: 20, paddingBottom: 8 },
  greeting: { fontSize: 34, fontWeight: '800', color: colors.textPrimary, letterSpacing: -1.2, lineHeight: 38 },
  dateText: { fontSize: 13, color: colors.textMuted, marginTop: 6, fontWeight: '600', letterSpacing: 0.2, textTransform: 'uppercase' },
  checkInOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  checkInCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 0.5, borderTopColor: colors.border },
  checkInTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  checkInSub: { fontSize: 13, color: colors.textSubtle, marginBottom: 20, lineHeight: 19 },
  checkInRow: { marginBottom: 16 },
  checkInBodyPart: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  checkInOptions: { flexDirection: 'row', gap: 8 },
  checkInOpt: { flex: 1, backgroundColor: colors.control, borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderStrong },
  checkInOptActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.borderActive },
  checkInOptText: { fontSize: 13, fontWeight: '600', color: colors.textSubtle },
  checkInOptTextActive: { color: colors.surfaceRaised },
  checkInStartBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  checkInStartText: { color: colors.surfaceRaised, fontSize: 15, fontWeight: '600' },

  readinessCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 14, borderWidth: 0.5 },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessLabel: { fontSize: 13, fontWeight: '700' },
  readinessStats: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', flex: 1 },
  readinessStat: { fontSize: 11, color: colors.textSubtle },
  readinessAdvice: { fontSize: 12, marginTop: 8, lineHeight: 18 },

  blockBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.accentSoft, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.accent },
  blockBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.accent, marginBottom: 3 },
  blockBannerSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  blockPill: { marginHorizontal: 16, marginBottom: 12, alignSelf: 'flex-start', backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 0.5, borderColor: colors.border },
  blockPillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },

  // Today's session
  sessionCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 0.5, borderColor: colors.border, marginBottom: 16 },
  sessionLabel: { fontSize: 10, color: colors.textSubtle, fontWeight: '700', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  sessionName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4, letterSpacing: -0.4 },
  sessionFocus: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  sessionMeta: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sessionMetaChip: { backgroundColor: colors.surfaceInset, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.border },
  sessionMetaText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sessionCount: { fontSize: 12, color: colors.textSubtle },
  startBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  startBtnText: { color: colors.surfaceRaised, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  completedBadge: { backgroundColor: colors.accentSoft, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: colors.accentHair },
  completedBadgeText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  exercisePreview: { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  exPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exPreviewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.surfaceInverse },
  exPreviewName: { fontSize: 13, color: colors.textPrimary, flex: 1 },
  exPreviewDetail: { fontSize: 12, color: colors.textSubtle },
  moreText: { fontSize: 12, color: colors.textSubtle, paddingLeft: 13 },

  // Rest day
  restCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginBottom: 24 },
  restTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  restSub: { fontSize: 13, color: colors.textSubtle, lineHeight: 20, marginBottom: 14 },
  tomorrowBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tomorrowBtnText: { color: colors.surfaceRaised, fontSize: 13, fontWeight: '500' },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  sectionSub: { fontSize: 11, color: colors.textSubtle, marginBottom: 14 },

  // Cardio section
  cardioHeader:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  cardioLogBtn:       { backgroundColor: colors.control, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0.5, borderColor: colors.borderStrong },
  cardioLogBtnText:   { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cardioEmpty:        { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: colors.border },
  cardioEmptyText:    { fontSize: 13, color: colors.textFaint, lineHeight: 19 },
  cardioRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: colors.border },
  cardioRowLeft:      { flex: 1 },
  cardioRowType:      { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  cardioRowSub:       { fontSize: 11, color: colors.textSubtle },
  cardioRowRight:     { alignItems: 'flex-end' },
  cardioRowDur:       { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  cardioRowDate:      { fontSize: 11, color: colors.textFaint },

  // Muscle recovery grid
  // ── Recovery: compact Today card + detail sheet ──
  recoveryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 0.5, borderColor: colors.border,
  },
  recoveryInfo: { flex: 1, minWidth: 0 },
  recoveryTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  recoveryTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  recoveryMore: { fontSize: 11.5, color: colors.textSubtle, fontWeight: '600' },
  recoverySub: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 6 },
  recoveryPills: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  recoveryPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 0.5 },
  recoveryPillText: { fontSize: 10.5, fontWeight: '700' },
  recoveryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
  },
  recoveryHeaderTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.4 },
  recoveryDone: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  recoveryTabs: {
    flexDirection: 'row', gap: 4, marginHorizontal: 20, padding: 4,
    backgroundColor: colors.surfaceAlt, borderRadius: 14, borderWidth: 0.5, borderColor: colors.border,
  },
  recoveryTab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  recoveryTabActive: { backgroundColor: colors.surfaceInverse },
  recoveryTabText: { fontSize: 13, fontWeight: '700', color: colors.textSubtle },
  recoveryTabTextActive: { color: colors.textOnLight },
  recoveryBodies: { flexDirection: 'row', justifyContent: 'center', gap: 10 },

  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0.5, minWidth: '30%', flex: 1 },
  muscleChipName: { fontSize: 12, fontWeight: '600' },
  muscleChipStatus: { fontSize: 11, marginTop: 2 },

  // Weekly volume bars
  volumeLegend: { flexDirection: 'row', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
  volumeLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  volumeLegendDot: { width: 7, height: 7, borderRadius: 4 },
  volumeLegendLabel: { fontSize: 10, color: colors.textSubtle },
  volumeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  volumeNameCol: { width: 100 },
  volumeMuscleName: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  volumeTargetLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  volumeBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.control },
  volumeBarFill: { height: 6, borderRadius: 3 },
  volumeCount: { fontSize: 11, fontWeight: '700', width: 36, textAlign: 'right' },
  volumeDetailToggle: { alignSelf: 'flex-start', marginBottom: 14, paddingVertical: 4, paddingHorizontal: 0 },
  volumeDetailToggleText: { fontSize: 12, fontWeight: '600', color: colors.accent },
  volumeGroupBlock: { marginBottom: 10, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: colors.borderSoft },
  volumeHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 14, gap: 10 },
  volumeHeadName: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  junkWarning: { marginTop: 10, backgroundColor: colors.dangerBg, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: colors.dangerHair },
  junkWarningHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  junkWarningTitle: { fontSize: 12, fontWeight: '700', color: colors.danger },
  junkWarningText: { fontSize: 11, color: colors.textMuted, lineHeight: 17 },

  // Deload card
  deloadCard: { backgroundColor: colors.surfaceRaised, borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: '#FFFFFF66' },
  deloadHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  deloadIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  deloadHeaderText: { flex: 1 },
  deloadTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  deloadTrigger: { fontSize: 11, color: colors.textPrimary, fontWeight: '600' },
  deloadReason: { fontSize: 12, color: colors.textSubtle, lineHeight: 18, marginBottom: 10, fontStyle: 'italic' },
  deloadMessage: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 14 },
  deloadStats: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  deloadStat: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  deloadStatValue: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  deloadStatLabel: { fontSize: 9, color: colors.textFaint, textAlign: 'center' },
  deloadDietNote: { backgroundColor: colors.successBg, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: '#1D9E7533', marginBottom: 12 },
  deloadDietNoteText: { fontSize: 12, color: colors.accent, lineHeight: 18 },
  deloadInstructionsTitle: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  deloadInstruction: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  deloadInstructionNum: { fontSize: 11, fontWeight: '700', color: colors.textPrimary, width: 16, marginTop: 1 },
  deloadInstructionText: { fontSize: 12, color: colors.textMuted, lineHeight: 19, flex: 1 },
  deloadScience: { fontSize: 9, color: colors.textFaint, marginTop: 12, fontStyle: 'italic', lineHeight: 14 },

  // Plateau cards
  plateauCard: { backgroundColor: colors.warningBg, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#BA751744', marginBottom: 10 },
  plateauCardConfirmed: { backgroundColor: colors.dangerBg, borderColor: colors.dangerHair },
  plateauHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  plateauHeaderText: { flex: 1 },
  plateauExercise: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  plateauDays: { fontSize: 11, color: colors.textSubtle },
  plateauMessage: { fontSize: 12, color: colors.textMuted, lineHeight: 19, marginBottom: 12 },
  plateauFixTitle: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  plateauIntervention: { fontSize: 12, color: colors.textMuted, lineHeight: 19, marginBottom: 3, paddingLeft: 4 },
  plateauScience: { fontSize: 9, color: colors.textFaint, marginTop: 10, fontStyle: 'italic', lineHeight: 14 },

  // Last session
  coachNudgeCard: { backgroundColor: colors.infoSurface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.infoBorder },
  coachNudgeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  coachNudgeTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  coachNudgeBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  coachNudgeHint: { fontSize: 12, color: colors.info, fontWeight: '600', marginTop: 8 },
  lastSessionCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastSessionLeft: { flex: 1, paddingRight: 10 },
  lastSessionName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 3 },
  lastSessionDate: { fontSize: 12, color: colors.textSubtle },
  lastSessionRight: { alignItems: 'flex-end', gap: 3 },
  lastSessionStat: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  lastSessionRpe: { fontSize: 11, color: colors.textSubtle },

  // Session detail modal
  modalOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, borderTopWidth: 0.5, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  modalSub: { fontSize: 12, color: colors.textSubtle, marginBottom: 20 },
  modalSectionLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  modalEmpty: { fontSize: 13, color: colors.textSubtle, marginBottom: 20 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  muscleLabel: { fontSize: 13, color: colors.textMuted, width: 80 },
  muscleBarBg: { flex: 1, height: 6, backgroundColor: colors.control, borderRadius: 3, overflow: 'hidden' },
  muscleBarFill: { height: 6, backgroundColor: colors.surfaceInverse, borderRadius: 3 },
  muscleCount: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, width: 24, textAlign: 'right' },
  modalClose: { marginTop: 20, backgroundColor: colors.control, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCloseText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});