import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Dimensions, Alert, KeyboardAvoidingView, Platform, Modal, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import StudyChart from './StudyChart';
import { getExerciseInsight } from './studiesLibrary';
import MuscleMap from './MuscleMap';
import ExerciseSlideshow from './ExerciseSlideshow';
import CoachScreen from './CoachScreen';
import PremiumPaywall from './PremiumPaywall';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { checkReadyToProgress } from './programGenerator';

const WORKOUT_DRAFT_KEY = '@helix_workout_draft';

const SCREEN_W = Dimensions.get('window').width;  // fallback; overridden by onLayout

// ─── Find exercise by name across all patterns ────────────────────────────────
function findExerciseByName(name) {
  const normalised = name.toLowerCase().trim();
  for (const pattern of Object.values(MOVEMENT_PATTERNS)) {
    const found = pattern.exercises.find(e => e.name.toLowerCase() === normalised);
    if (found) return { exercise: found, pattern };
  }
  return null;
}

// All library exercises grouped by primary muscle — used by the mid-workout
// "Replace exercise" picker so a lifter can swap across muscle groups on the fly.
const EXERCISE_GROUPS = (() => {
  const groups = {};
  Object.entries(MOVEMENT_PATTERNS).forEach(([key, p]) => {
    const muscle = (p.muscles && p.muscles[0]) || p.label || key;
    if (!groups[muscle]) groups[muscle] = [];
    p.exercises.forEach(ex => groups[muscle].push({ name: ex.name, patternKey: key }));
  });
  return Object.entries(groups).map(([muscle, items]) => ({ muscle, items }));
})();

// ─── Muscle extraction helper ─────────────────────────────────────────────────
// movementLibrary exercises have a 'muscles' string (legacy) or we derive from pattern
// We also accept primary/secondary arrays if passed directly on the exercise object
function getMuscles(ex) {
  // If exercise already has structured muscle arrays (from movementLibrary pattern), use them
  if (Array.isArray(ex.primaryMuscles) && ex.primaryMuscles.length > 0) {
    return { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles || [] };
  }
  // If pattern muscles were passed through (common when building from MOVEMENT_PATTERNS)
  if (Array.isArray(ex.patternMuscles) && ex.patternMuscles.length > 0) {
    return { primary: ex.patternMuscles, secondary: [] };
  }
  // Fallback: parse legacy muscles string e.g. "Chest, Shoulders, Triceps"
  if (typeof ex.muscles === 'string' && ex.muscles.length > 0) {
    const parts = ex.muscles.split(',').map(m => m.trim()).filter(Boolean);
    return { primary: parts.slice(0, 2), secondary: parts.slice(2) };
  }
  return { primary: [], secondary: [] };
}

function exerciseToSetState(ex) {
  const n = typeof ex.sets === 'number' ? ex.sets : 3;
  return {
    name: ex.name,
    pattern: ex.pattern || null,
    muscles: ex.muscles || '',
    primaryMuscles: ex.primaryMuscles || ex.patternMuscles || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    target_sets: n,
    target_reps: ex.reps || '',
    rest: ex.rest || '2–3 min',
    early_rpe: ex.early_rpe || 7,
    last_rpe: ex.last_rpe || 9,
    research_note: ex.research_note || '',
    cues: ex.cues || [],
    sub1: ex.sub1 || '',
    sub2: ex.sub2 || '',
    sub3: ex.sub3 || '',
    study: ex.study || null,
    contraindication_substitute: ex.contraindication_substitute || false,
    contraindication_note: ex.contraindication_note || null,
    completedSets: Array.from({ length: n }, () => ({ weight: '', reps: '', done: false, type: 'working' })),
  };
}

// label/sub are resolved from i18n at render (workout.simpleRpe.{key} / {key}Sub).
const SIMPLE_RPE_OPTIONS = [
  { key: 'easy', rpe: 6 },
  { key: 'solid', rpe: 8 },
  { key: 'max', rpe: 10 },
];

const SET_TYPES = ['working', 'warmup', 'drop', 'failure'];
const SET_TYPE_META = {
  warmup:  { label: 'W', color: '#BA7517' },
  drop:    { label: 'D', color: '#FFFFFF' },
  failure: { label: 'F', color: '#E85D5C' },
};

const PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];

function calculatePlates(targetKg, barKg) {
  let remaining = Math.round(((targetKg - barKg) / 2) * 1000) / 1000;
  if (remaining <= 0) return [];
  const plates = [];
  for (const plate of PLATE_SIZES) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining = Math.round((remaining - plate) * 1000) / 1000;
    }
  }
  return plates;
}

export default function WorkoutExecutionScreen({ workout, onFinish, onCancel, isPremium, onUpgrade, onRestore }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isSimple = workout.trainingExperience === 'beginner';
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [sets, setSets] = useState(() => workout.exercises.map(exerciseToSetState));
  const [restTimer, setRestTimer] = useState(null);
  const [finishTime, setFinishTime] = useState(null);
  const [rpe, setRpe] = useState(7);
  const [finished, setFinished] = useState(false);
  const [prevWeights, setPrevWeights] = useState({});
  const [restWarning, setRestWarning] = useState(null);
  const [slideshowExercise, setSlideshowExercise] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false); // free users tapping Coach mid-workout

  // ─── Restore workout draft from AsyncStorage (survives app backgrounding) ─
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft.workoutId || !workout.id || draft.workoutId !== workout.id) return; // stale draft from a different workout day

        draftCompletions.current = {};
        draft.completions.forEach(c => { draftCompletions.current[c.name] = c.completedSets; });

        setSets(prev => prev.map((ex, i) => {
          // Restore any exercise swap that happened before the app closed
          let base = ex;
          const savedName = draft.exerciseNames?.[i];
          if (savedName && savedName !== ex.name) {
            const result = findExerciseByName(savedName);
            if (result) {
              const { exercise: newEx, pattern } = result;
              base = {
                ...ex,
                name: newEx.name,
                primaryMuscles: pattern?.muscles ?? [],
                secondaryMuscles: [],
                target_sets: newEx.sets ?? ex.target_sets,
                target_reps: newEx.reps ?? ex.target_reps,
                rest: newEx.rest ?? ex.rest,
                early_rpe: newEx.early_rpe ?? ex.early_rpe,
                last_rpe: newEx.last_rpe ?? ex.last_rpe,
                research_note: newEx.research_note ?? '',
                cues: newEx.cues ?? [],
                study: newEx.study ?? null,
                completedSets: Array.from(
                  { length: newEx.sets ?? ex.target_sets },
                  () => ({ weight: '', reps: '', done: false })
                ),
              };
            }
          }
          // Then restore completed sets
          const saved = draftCompletions.current[base.name];
          return saved ? { ...base, completedSets: saved } : base;
        }));

        if (typeof draft.currentExIdx === 'number') setCurrentExIdx(draft.currentExIdx);
        if (typeof draft.rpe === 'number') setRpe(draft.rpe);
        if (draft.startTime) startTime.current = draft.startTime;
        if (draft.finished) { setFinished(true); setFinishTime(draft.finishTime || Date.now()); }
      } catch (_) {}
    })();
  }, []);

  // ─── Auto-save workout draft to AsyncStorage on every meaningful change ───
  useEffect(() => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(latestDraftRef.current));
      } catch (_) {}
    }, 300);
    return () => clearTimeout(draftTimer.current);
  }, [sets, currentExIdx, rpe, finished, finishTime]);

  // ─── Flush draft immediately when app goes to background ─────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        clearTimeout(draftTimer.current);
        // Flush finished-but-unsaved sessions too — otherwise tapping Finish,
        // backgrounding, and getting killed loses the whole workout.
        if (latestDraftRef.current) {
          try {
            await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(latestDraftRef.current));
          } catch (_) {}
        }
      }
    });
    return () => sub.remove();
  }, []);

  // ─── Load AI coach additions for this day ────────────────────────────────
  useEffect(() => {
    if (!workout.id) return;
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const { data: additions } = await supabase
        .from('program_additions')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_id', workout.id)
        .order('created_at', { ascending: true });
      if (!additions?.length) return;
      const extra = additions.map(a => {
        const found = findExerciseByName(a.exercise_name);
        const ex = found?.exercise || {};
        const pattern = found?.pattern;
        const n = a.sets;
        return {
          ...exerciseToSetState({
            name: a.exercise_name,
            muscles: ex.muscles || pattern?.muscles?.join(', ') || '',
            primaryMuscles: ex.primaryMuscles || pattern?.muscles || [],
            secondaryMuscles: ex.secondaryMuscles || [],
            sets: n,
            reps: a.reps,
            rest: a.rest,
            early_rpe: ex.early_rpe,
            last_rpe: ex.last_rpe,
            research_note: ex.research_note || '',
            cues: ex.cues || [],
            sub1: ex.sub1 || '',
            sub2: ex.sub2 || '',
            sub3: ex.sub3 || '',
            study: ex.study || null,
          }),
        };
      });
      setSets(prev => {
        const existingNames = new Set(prev.map(e => e.name));
        const newExtras = extra
          .filter(e => !existingNames.has(e.name))
          .map(e => {
            const savedSets = draftCompletions.current?.[e.name];
            return savedSets ? { ...e, completedSets: savedSets } : e;
          });
        return newExtras.length ? [...prev, ...newExtras] : prev;
      });
    })();
  }, []);

  // ─── Swap alternative in for current exercise ─────────────────────────────
  const swapExercise = (exIdx, altName, subIdx) => {
    // Warn if the chosen exercise is already in today's workout — replacing would
    // give the user the same movement twice.
    const dup = sets.some((e, i) =>
      i !== exIdx && e.name?.toLowerCase().trim() === altName?.toLowerCase().trim()
    );
    if (dup) {
      Alert.alert(
        t('workout.alerts.dupTitle'),
        t('workout.alerts.dupMsg', { name: altName }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('workout.alerts.doItAnyway'), onPress: () => confirmSwapClearingSets(exIdx, altName, subIdx) },
        ]
      );
      return;
    }
    confirmSwapClearingSets(exIdx, altName, subIdx);
  };

  const confirmSwapClearingSets = (exIdx, altName, subIdx) => {
    const hasDoneSets = sets[exIdx]?.completedSets.some(s => s.done);
    if (hasDoneSets) {
      Alert.alert(
        t('workout.alerts.replaceTitle'),
        t('workout.alerts.replaceMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('workout.alerts.replace'), style: 'destructive', onPress: () => doSwap(exIdx, altName, subIdx) },
        ]
      );
      return;
    }
    doSwap(exIdx, altName, subIdx);
  };

  const doSwap = (exIdx, altName, subIdx) => {
    const result = findExerciseByName(altName);
    if (!result) return;
    const { exercise: newEx, pattern } = result;

    setSets(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const subs = { sub1: ex.sub1, sub2: ex.sub2, sub3: ex.sub3 };
      if (subIdx === 0) subs.sub1 = ex.name;
      else if (subIdx === 1) subs.sub2 = ex.name;
      else if (subIdx === 2) subs.sub3 = ex.name;
      // Sets and reps belong to the SLOT (its role/volume in your program), not
      // to the exercise — a quad main is 4 sets whether it's a leg press or a
      // hack squat. Preserve the slot's prescription so a swap changes only the
      // movement, not the volume. (Matches how permanent edits regenerate too.)
      const keepSets = ex.target_sets;
      return {
        ...ex,
        name: newEx.name,
        primaryMuscles: pattern.muscles ?? [],
        secondaryMuscles: [],
        target_sets: keepSets,
        target_reps: ex.target_reps,
        rest: newEx.rest ?? ex.rest,
        early_rpe: ex.early_rpe,
        last_rpe: ex.last_rpe,
        research_note: newEx.research_note ?? '',
        cues: newEx.cues ?? [],
        study: newEx.study ?? null,
        ...subs,
        completedSets: Array.from(
          { length: keepSets },
          () => ({ weight: '', reps: '', done: false })
        ),
      };
    }));
  };
  // ─── Apply an AI coach edit to the in-progress workout immediately ────────
  // Without this the override only lands in supabase, so the change would not
  // show until the workout is closed and reopened.
  const applyCoachEdit = (p) => {
    if (!p || p.day_id !== workout.id) return;
    const editType = p.edit_type || 'replace_exercise';

    if (editType === 'add_exercise' || p.type === 'add_exercise') {
      const found = findExerciseByName(p.exercise_name || '');
      const ex = found?.exercise || {};
      const pattern = found?.pattern;
      const newEx = exerciseToSetState({
        name: p.exercise_name,
        muscles: ex.muscles || pattern?.muscles?.join(', ') || '',
        primaryMuscles: ex.primaryMuscles || pattern?.muscles || [],
        secondaryMuscles: ex.secondaryMuscles || [],
        sets: p.sets || 3,
        reps: p.reps || '10–15',
        rest: p.rest || '90 sec',
        early_rpe: ex.early_rpe,
        last_rpe: ex.last_rpe,
        research_note: ex.research_note || '',
        cues: ex.cues || [],
        sub1: ex.sub1 || '',
        sub2: ex.sub2 || '',
        sub3: ex.sub3 || '',
        study: ex.study || null,
      });
      setSets(prev => prev.some(e => e.name === newEx.name) ? prev : [...prev, newEx]);
      return;
    }

    const inRange = (i) => i >= 0 && i < sets.length;
    let idx = p.exercise_index ?? -1;

    if (editType === 'remove_exercise') {
      if (!inRange(idx)) return; // removing the wrong slot would be destructive
      setSets(prev => prev.filter((_, i) => i !== idx));
      setCurrentExIdx(i => Math.max(0, Math.min(i, sets.length - 2)));
      return;
    }

    // Replace / sets-reps changes: if the model handed back a program index that
    // doesn't line up with the live session (common on a "now & future" edit),
    // fall back to the exercise the user is currently on — so "replace this"
    // always changes what's in front of them, now, for both scope options.
    if (!inRange(idx)) idx = currentExIdx;
    if (!inRange(idx)) return;

    if (editType === 'replace_exercise' && p.exercise_name) {
      doSwap(idx, p.exercise_name, -1);
    }

    if (p.sets || p.reps) {
      setSets(prev => prev.map((ex, i) => {
        if (i !== idx) return ex;
        const n = typeof p.sets === 'number' ? p.sets : ex.target_sets;
        const completedSets = ex.completedSets.slice(0, n);
        while (completedSets.length < n) completedSets.push({ weight: '', reps: '', done: false, type: 'working' });
        return { ...ex, target_sets: n, target_reps: p.reps || ex.target_reps, completedSets };
      }));
    }
  };

  const [overloadSuggestions, setOverloadSuggestions] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [pageWidth, setPageWidth] = useState(SCREEN_W);
  const [userBodyWeight, setUserBodyWeight] = useState(null);
  const [bwMode, setBwMode] = useState({});
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [replaceIdx, setReplaceIdx] = useState(null);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [replaceMuscleFilter, setReplaceMuscleFilter] = useState(null);
  const [plateTarget, setPlateTarget] = useState('');
  const [barWeight, setBarWeight] = useState(20);
  const startTime = useRef(Date.now());
  const swipeRef = useRef(null);
  const draftCompletions = useRef(null); // { exerciseName -> completedSets[] } restored from AsyncStorage
  const draftTimer = useRef(null);
  const latestDraftRef = useRef(null); // always-current draft — read by AppState flush

  // Always-current snapshot — updated synchronously every render so AppState flush has fresh data
  latestDraftRef.current = {
    workoutId: workout.id,
    workout,
    exerciseNames: sets.map(ex => ex.name),
    completions: sets.map(ex => ({ name: ex.name, completedSets: ex.completedSets })),
    currentExIdx,
    rpe,
    finished,
    finishTime,
    startTime: startTime.current,
  };

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [finished]);

  useEffect(() => {
    if (!restTimer || restTimer <= 0) return;
    const timeout = setTimeout(() => setRestTimer(sec => sec - 1), 1000);
    return () => clearTimeout(timeout);
  }, [restTimer]);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: prof } = await supabase.from('profiles').select('weight_kg').eq('id', user.id).single();
      if (prof?.weight_kg) setUserBodyWeight(prof.weight_kg);

      const exNames = sets.map(s => s.name);

      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, completed_at, name')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(30);

      if (sessions?.length) {
        const ids = sessions.map(s => s.id);
        const { data: prevSets } = await supabase
          .from('completed_sets')
          .select('exercise_name, weight_kg, reps, session_id')
          .in('session_id', ids)
          .in('exercise_name', exNames)
          .not('weight_kg', 'is', null);

        if (prevSets?.length) {
          const sessionDateMap = {};
          sessions.forEach(s => { sessionDateMap[s.id] = s.completed_at; });

          const sortedSets = [...prevSets].sort((a, b) =>
            new Date(sessionDateMap[b.session_id]) - new Date(sessionDateMap[a.session_id])
          );

          const prev = {};
          sortedSets.forEach(s => {
            if (!prev[s.exercise_name]) {
              prev[s.exercise_name] = { weight: s.weight_kg, reps: s.reps };
            }
          });
          setPrevWeights(prev);
        }

        const today = new Date();
        const lastSession = sessions.find(s => {
          const d = new Date(s.completed_at);
          const daysDiff = (today - d) / (1000 * 60 * 60 * 24);
          return daysDiff > 0.1 && daysDiff < 1;
        });

        if (lastSession) {
          const { data: lastSets } = await supabase
            .from('completed_sets')
            .select('exercise_name')
            .eq('session_id', lastSession.id);

          if (lastSets?.length) {
            const lastMuscles = new Set(lastSets.map(s => s.exercise_name.toLowerCase()));
            const todayMuscles = exNames.map(n => n.toLowerCase());
            const overlap = todayMuscles.find(n => lastMuscles.has(n));
            if (overlap) {
              const hrs = Math.round((today - new Date(lastSession.completed_at)) / (1000 * 60 * 60));
              setRestWarning({ sessionName: lastSession.name, hoursAgo: hrs });
            }
          }
        }
      }
    };
    load();
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const parseRestSeconds = (restStr) => {
    if (!restStr) return 120;
    if (restStr.includes('3–5') || restStr.includes('4–5')) return 240;
    if (restStr.includes('3–4') || restStr.includes('3')) return 180;
    if (restStr.includes('2–3') || restStr.includes('2')) return 120;
    if (restStr.includes('1–2') || restStr.includes('1')) return 90;
    return 120;
  };

  const tickSet = (exIdx, setIdx) => {
    const wasAlreadyDone = sets[exIdx].completedSets[setIdx].done;
    setSets(prev => prev.map((ex, i) =>
      i === exIdx ? {
        ...ex,
        completedSets: ex.completedSets.map((s, j) =>
          j === setIdx ? { ...s, done: !s.done } : s
        ),
      } : ex
    ));
    if (!wasAlreadyDone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const restSeconds = parseRestSeconds(sets[exIdx].rest);
      setRestTimer(restSeconds);
    }
  };

  const updateWeight = (exIdx, setIdx, val) => {
    setSets(prev => prev.map((ex, i) =>
      i === exIdx ? {
        ...ex,
        completedSets: ex.completedSets.map((s, j) =>
          j === setIdx ? { ...s, weight: val } : s
        ),
      } : ex
    ));
  };

  const updateReps = (exIdx, setIdx, val) => {
    setSets(prev => prev.map((ex, i) =>
      i === exIdx ? {
        ...ex,
        completedSets: ex.completedSets.map((s, j) =>
          j === setIdx ? { ...s, reps: val } : s
        ),
      } : ex
    ));
  };

  const cycleSetType = (exIdx, setIdx) => {
    setSets(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex,
      completedSets: ex.completedSets.map((s, j) => {
        if (j !== setIdx) return s;
        const next = SET_TYPES[(SET_TYPES.indexOf(s.type || 'working') + 1) % SET_TYPES.length];
        return { ...s, type: next };
      }),
    }));
  };

  const toggleBwMode = (exIdx) => {
    setBwMode(prev => {
      const next = !prev[exIdx];
      if (next && userBodyWeight) {
        setSets(prevSets => prevSets.map((ex, i) => i !== exIdx ? ex : {
          ...ex,
          completedSets: ex.completedSets.map(s =>
            s.done ? s : { ...s, weight: String(userBodyWeight) }
          ),
        }));
      }
      return { ...prev, [exIdx]: next };
    });
  };

  const allSetsDone = (ex) => ex.completedSets.every(s => s.done);

  const totalSetsCompleted = sets.reduce((acc, ex) =>
    acc + ex.completedSets.filter(s => s.done).length, 0
  );

  const totalSets = sets.reduce((acc, ex) => acc + ex.completedSets.length, 0);

  const saveWorkout = async () => {
    if (saving) return;
    const user = await getCurrentUser();
    if (!user) return;
    setSaving(true);

    try {
      const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          name: workout.name,
          started_at: new Date(startTime.current).toISOString(),
          completed_at: new Date().toISOString(),
          duration_min: Math.round(((finishTime ?? Date.now()) - startTime.current) / 60000),
          perceived_exertion: rpe,
        })
        .select()
        .single();

      if (error) throw error;

      if (session) {
        // Save completed sets (include user_id for direct history queries)
        const now = new Date().toISOString();
        // Keep the original set index — filtering first renumbered sets when one
        // in the middle was skipped (set 3 was saved as set_number 2).
        const completedSets = sets.flatMap((ex) =>
          ex.completedSets
            .map((s, setIdx) => ({ s, setIdx }))
            .filter(({ s }) => s.done)
            .map(({ s, setIdx }) => ({
              session_id: session.id,
              user_id: user.id,
              exercise_name: ex.name,
              pattern_key: ex.pattern || null,
              set_number: setIdx + 1,
              reps: parseInt(s.reps) || null,
              weight_kg: parseFloat(s.weight) || null,
              set_type: s.type || 'working',
              completed_at: now,
            }))
        );
        if (completedSets.length > 0) {
          const { error: setsError } = await supabase.from('completed_sets').insert(completedSets);
          if (setsError) throw setsError;
        }

        // Record skipped exercises
        const skippedExercises = sets.filter(ex =>
          ex.completedSets.every(s => !s.done)
        );
        if (skippedExercises.length > 0) {
          await supabase.from('exercise_skips').insert(
            skippedExercises.map(ex => ({
              user_id: user.id,
              session_id: session.id,
              exercise_name: ex.name,
              pattern_key: ex.pattern || null,
            }))
          );
        }

        // Progressive overload suggestions using the research-backed double-progression model
        const { data: recentSets } = await supabase
          .from('completed_sets')
          .select('exercise_name, weight_kg, reps, completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(200);

        const suggestions = sets.map(ex => {
          const doneSets = ex.completedSets.filter(s => s.done);
          if (!doneSets.length) return null;
          const result = checkReadyToProgress(recentSets || [], ex.name, ex.reps || ex.target_reps);
          if (result.status === 'insufficient_data') return null;
          return { name: ex.name, suggestion: result.note, type: result.status };
        }).filter(Boolean);

        setOverloadSuggestions(suggestions);

        // Clean up one-time session_swap overrides for this day now that the workout is saved.
        await supabase
          .from('program_template_overrides')
          .delete()
          .eq('user_id', user.id)
          .eq('day_id', workout.id)
          .eq('is_session_swap', true);
      }

      await AsyncStorage.removeItem(WORKOUT_DRAFT_KEY);
      onFinish && onFinish();
    } catch (err) {
      console.error('saveWorkout error:', err);
      setSaving(false);
      Alert.alert(t('workout.alerts.saveFailTitle'), t('workout.alerts.saveFailMsg'));
    }
  };

  const currentEx = sets[currentExIdx];
  const progress = totalSets > 0 ? totalSetsCompleted / totalSets : 0;

  // ─── FINISH SCREEN ────────────────────────────────────────────────────────
  if (finished) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.finishScreen, { paddingTop: insets.top + 24 }]}>
        <Pressable onPress={() => setFinished(false)} style={styles.finishBackBtn}>
          <Text style={styles.finishBackText}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.finishTitle}>{t('workout.finish.title')}</Text>
        <Text style={styles.finishSub}>{workout.name}</Text>

        <View style={styles.finishStats}>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal} numberOfLines={1} adjustsFontSizeToFit>{formatTime(Math.floor(((finishTime ?? Date.now()) - startTime.current) / 1000))}</Text>
            <Text style={styles.finishStatLabel}>{t('workout.finish.duration')}</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal} numberOfLines={1} adjustsFontSizeToFit>{totalSetsCompleted}</Text>
            <Text style={styles.finishStatLabel}>{t('workout.finish.setsDone')}</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal} numberOfLines={1} adjustsFontSizeToFit>{sets.length}</Text>
            <Text style={styles.finishStatLabel}>{t('workout.finish.exercises')}</Text>
          </View>
        </View>

        <Text style={styles.rpeLabel}>
          {isSimple ? t('workout.finish.howFeel') : t('workout.finish.howHard', { rpe })}
        </Text>
        {isSimple ? (
          <View style={styles.simpleRpeRow}>
            {SIMPLE_RPE_OPTIONS.map(opt => (
              <Pressable
                key={opt.rpe}
                style={[styles.simpleRpeBtn, rpe === opt.rpe && styles.simpleRpeBtnActive]}
                onPress={() => setRpe(opt.rpe)}
              >
                <Text style={[styles.simpleRpeBtnText, rpe === opt.rpe && styles.simpleRpeBtnTextActive]}>{t(`workout.simpleRpe.${opt.key}`)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.rpeRow}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <Pressable
                key={n}
                style={[styles.rpeBtn, rpe === n && styles.rpeBtnActive]}
                onPress={() => setRpe(n)}
              >
                <Text style={[styles.rpeBtnText, rpe === n && styles.rpeBtnTextActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.rpeSub}>
          {isSimple
            ? (() => { const o = SIMPLE_RPE_OPTIONS.find(o => o.rpe === rpe); return o ? t(`workout.simpleRpe.${o.key}Sub`) : t('workout.finish.tapToRate'); })()
            : rpe <= 5 ? t('workout.finish.rpeEasy')
              : rpe <= 7 ? t('workout.finish.rpeGood')
              : rpe <= 9 ? t('workout.finish.rpeHigh')
              : t('workout.finish.rpeMax')}
        </Text>

        {overloadSuggestions.length > 0 && (
          <View style={styles.overloadCard}>
            <Text style={styles.overloadTitle}>{t('workout.finish.nextTargets')}</Text>
            {overloadSuggestions.map((s, i) => (
              <View key={i} style={styles.overloadRow}>
                <View style={[styles.overloadDot, { backgroundColor: s.type === 'increase' ? '#1D9E75' : '#FFFFFF' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overloadEx}>{s.name}</Text>
                  <Text style={styles.overloadSug}>{s.suggestion}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={saveWorkout} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? t('workout.finish.saving') : t('workout.finish.save')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ─── MAIN SCREEN ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Top bar — hidden when slideshow is open to prevent bleed-through */}
      {!slideshowExercise && (
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => {
          if (totalSetsCompleted > 0) {
            Alert.alert(
              t('workout.alerts.cancelTitle'),
              t('workout.alerts.cancelMsg'),
              [
                { text: t('workout.alerts.keepGoing'), style: 'cancel' },
                { text: t('common.cancel'), style: 'destructive', onPress: onCancel },
              ]
            );
          } else {
            onCancel();
          }
        }} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>✕</Text>
        </Pressable>
        <View style={styles.dotIndicators}>
          {sets.map((ex, i) => (
            <Pressable
              key={i}
              onPress={() => {
                swipeRef.current?.scrollTo({ x: i * pageWidth, animated: true });
                setCurrentExIdx(i);
              }}
              hitSlop={8}
            >
              <View style={[
                styles.dotIndicator,
                i === currentExIdx && styles.dotIndicatorActive,
                allSetsDone(ex) && styles.dotIndicatorDone,
              ]} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable style={styles.coachTopBtn} onPress={() => isPremium ? setShowCoach(true) : setShowPaywall(true)} hitSlop={8}>
            <Text style={styles.coachTopBtnText}>{t('workout.coach')}</Text>
          </Pressable>
          <Pressable style={styles.finishBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFinished(true); setFinishTime(Date.now()); }}>
            <Text style={styles.finishBtnText} numberOfLines={1}>{t('workout.finishBtn')}</Text>
          </Pressable>
        </View>
      </View>
      )}

      {/* Elapsed timer */}
      {!slideshowExercise && (
        <Text style={styles.elapsedTimer}>{formatTime(elapsed)}</Text>
      )}

      {/* Progress bar */}
      {!slideshowExercise && (
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      )}

      {/* Rest day warning */}
      {restWarning && (
        <View style={styles.restWarningBanner}>
          <Text style={styles.restWarningText}>
            {t('workout.restWarning', { session: restWarning.sessionName, hours: restWarning.hoursAgo })}
          </Text>
          <Pressable onPress={() => setRestWarning(null)}>
            <Text style={styles.restWarningDismiss}>{t('workout.dismiss')}</Text>
          </Pressable>
        </View>
      )}

      {/* Rest timer */}
      {restTimer > 0 && (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>{t('workout.restTimer', { time: formatTime(restTimer) })}</Text>
          <Pressable onPress={() => setRestTimer(0)}>
            <Text style={styles.restSkip}>{t('workout.skip')}</Text>
          </Pressable>
        </View>
      )}

      {/* Exercise swipe pager — KeyboardAvoidingView shrinks content when keyboard opens */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView
        ref={swipeRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={e => setPageWidth(e.nativeEvent.layout.width)}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
          if (idx !== currentExIdx) setCurrentExIdx(idx);
        }}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {sets.map((ex, exIdx) => {
          const { primary, secondary } = getMuscles(ex);

          return (
            <ScrollView
              key={exIdx}
              style={{ width: pageWidth }}
              contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
              automaticallyAdjustKeyboardInsets={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* Exercise header */}
              <View style={styles.exCard}>
                <View style={styles.exCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exNumber}>{t('workout.exNumber', { n: exIdx + 1, total: sets.length })}</Text>
                    <Pressable onPress={() => setSlideshowExercise(ex)}>
                      <Text style={styles.exName}>{ex.name} <Text style={styles.howToTag}>{t('workout.howTo')}</Text></Text>
                    </Pressable>
                    {(primary.length > 0 || secondary.length > 0) && (
                      <View style={styles.muscleTagRow}>
                        {primary.map((m, i) => (
                          <View key={`p${i}`} style={styles.muscleTagPrimary}>
                            <Text style={styles.muscleTagPrimaryText}>{m}</Text>
                          </View>
                        ))}
                        {secondary.slice(0, 2).map((m, i) => (
                          <View key={`s${i}`} style={styles.muscleTagSecondary}>
                            <Text style={styles.muscleTagSecondaryText}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  {allSetsDone(ex) && (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneBadgeText}>{t('common.done')}</Text>
                    </View>
                  )}
                </View>



                {/* Contraindication banners */}
                {ex.contraindication_substitute && (
                  <View style={styles.contraBanner}>
                    <Text style={styles.contraBannerText}>
                      {t('workout.contraSub')}
                    </Text>
                  </View>
                )}
                {!ex.contraindication_substitute && ex.contraindication_note && (
                  <View style={[styles.contraBanner, styles.contraBannerSoft]}>
                    <Text style={[styles.contraBannerText, styles.contraBannerSoftText]}>
                      {ex.contraindication_note}
                    </Text>
                  </View>
                )}

                {/* Prescription */}
                <View style={styles.prescRow}>
                  <View style={styles.prescBox}>
                    <Text style={styles.prescVal}>{ex.target_sets}</Text>
                    <Text style={styles.prescLabel}>{t('workout.presc.sets')}</Text>
                  </View>
                  <View style={styles.prescBox}>
                    <Text style={styles.prescVal}>{ex.target_reps}</Text>
                    <Text style={styles.prescLabel}>{t('workout.presc.reps')}</Text>
                  </View>
                  <View style={styles.prescBox}>
                    <Text style={styles.prescVal}>{ex.rest}</Text>
                    <Text style={styles.prescLabel}>{t('workout.presc.rest')}</Text>
                  </View>
                  {isSimple ? (
                    <View style={[styles.prescBox, { flex: 1.5 }]}>
                      <Text style={[styles.prescVal, { fontSize: 11 }]}>{t('workout.presc.lastSetHard')}</Text>
                      <Text style={styles.prescLabel}>{t('workout.presc.effort')}</Text>
                    </View>
                  ) : (
                    <View style={styles.prescBox}>
                      <Text style={styles.prescVal}>{ex.early_rpe}→{ex.last_rpe}</Text>
                      <Text style={styles.prescLabel}>{t('workout.presc.rpe')}</Text>
                    </View>
                  )}
                </View>

                {/* Subs — tap to swap in as current exercise */}
                {(ex.sub1 || ex.sub2 || ex.sub3) && (
                  <View style={styles.subRow}>
                    <Text style={styles.subText}>{t('workout.swap')}</Text>
                    {[ex.sub1, ex.sub2, ex.sub3].map((sub, slotIdx) => sub ? (
                      <Pressable key={slotIdx} onPress={() => swapExercise(exIdx, sub, slotIdx)}>
                        <Text style={styles.subLink}>{sub}{slotIdx < 2 && (ex.sub2 || ex.sub3) ? ' · ' : ''}</Text>
                      </Pressable>
                    ) : null)}
                  </View>
                )}

                {/* Replace with any exercise (cross-muscle) */}
                <Pressable
                  style={styles.replaceBtn}
                  hitSlop={8}
                  onPress={() => {
                    setReplaceSearch('');
                    setReplaceMuscleFilter(sets[exIdx]?.primaryMuscles?.[0] || null);
                    setReplaceIdx(exIdx);
                  }}
                >
                  <Text style={styles.replaceBtnText}>{t('workout.replaceExercise')}</Text>
                </Pressable>

                {/* Key insight — concise evidence-based "why" */}
                {(() => {
                  const insight = getExerciseInsight(ex);
                  return insight ? (
                    <View style={{ backgroundColor: '#1D9E7514', borderRadius: 10, borderWidth: 1, borderColor: '#1D9E7540', borderLeftWidth: 3, borderLeftColor: '#1D9E75', padding: 12, marginTop: 8 }}>
                      <Text style={{ color: '#F1F0F5', fontSize: 13, lineHeight: 19, fontWeight: '500' }}>{insight.insight}</Text>
                      {insight.metric && <Text style={{ color: '#1D9E75', fontSize: 11.5, fontWeight: '700', marginTop: 6 }}>{insight.metric.this} vs {insight.metric.control} · {insight.metric.method}</Text>}
                      <Text style={{ color: '#8A8A94', fontSize: 11, marginTop: 6 }}>{insight.cite}</Text>
                    </View>
                  ) : null;
                })()}

                {/* Study chart */}
                {ex.study && <StudyChart study={ex.study} />}

              </View>

              {/* Sets */}
              <View style={styles.setsCard}>
                {/* Card toolbar */}
                <View style={styles.setsToolbar}>
                  <Text style={styles.setsCardTitle}>{t('workout.setsTitle')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {userBodyWeight && (
                      <Pressable
                        style={[styles.setsToolbarChip, bwMode[exIdx] && styles.setsToolbarChipActive]}
                        onPress={() => toggleBwMode(exIdx)}
                      >
                        <Text style={[styles.setsToolbarChipText, bwMode[exIdx] && styles.setsToolbarChipTextActive]}>{t('workout.bw')}</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.setsToolbarChip}
                      onPress={() => { setPlateTarget(''); setShowPlateCalc(true); }}
                    >
                      <Text style={styles.setsToolbarChipText}>{t('workout.plates')}</Text>
                    </Pressable>
                  </View>
                </View>

                {prevWeights[ex.name] && (
                  <View style={styles.prevHint}>
                    <Text style={styles.prevHintText}>
                      {prevWeights[ex.name].reps
                        ? t('workout.lastTimeReps', { weight: prevWeights[ex.name].weight, reps: prevWeights[ex.name].reps })
                        : t('workout.lastTime', { weight: prevWeights[ex.name].weight })}
                    </Text>
                  </View>
                )}

                <View style={styles.setHeaderRow}>
                  <View style={{ width: 28 }} />
                  <Text style={[styles.setHeaderText, { width: 22 }]}>{t('workout.setHeader.set')}</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>{t('workout.setHeader.kg')}</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>{t('workout.setHeader.reps')}</Text>
                  <Text style={[styles.setHeaderText, { width: 50, textAlign: 'center' }]}>{t('workout.setHeader.done')}</Text>
                </View>

                {ex.completedSets.map((set, setIdx) => {
                  const typeMeta = SET_TYPE_META[set.type];
                  return (
                    <View key={setIdx} style={[styles.setRow, set.done && styles.setRowDone]}>
                      <Pressable style={styles.setTypeBtn} onPress={() => cycleSetType(exIdx, setIdx)}>
                        {typeMeta
                          ? <Text style={[styles.setTypeBtnText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
                          : <Text style={styles.setTypeBtnDot}>·</Text>
                        }
                      </Pressable>
                      <Text style={[styles.setNum, { width: 22 }]}>{setIdx + 1}</Text>
                      <TextInput
                        style={[styles.weightInput, { flex: 1 }]}
                        value={set.weight}
                        onChangeText={v => updateWeight(exIdx, setIdx, v)}
                        keyboardType="decimal-pad"
                        placeholder={prevWeights[ex.name]?.weight?.toString() || '—'}
                        placeholderTextColor="#8A8A94"
                        editable={!set.done}
                      />
                      <TextInput
                        style={[styles.weightInput, { flex: 1, marginLeft: 6 }]}
                        value={set.reps}
                        onChangeText={v => updateReps(exIdx, setIdx, v)}
                        keyboardType="number-pad"
                        placeholder={prevWeights[ex.name]?.reps?.toString() || '—'}
                        placeholderTextColor="#8A8A94"
                        editable={!set.done}
                      />
                      <Pressable
                        style={[styles.tickBtn, set.done && styles.tickBtnDone, { width: 50 }]}
                        onPress={() => tickSet(exIdx, setIdx)}
                      >
                        <Text style={[styles.tickText, set.done && styles.tickTextDone]}>✓</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* Next / Finish */}
              {allSetsDone(ex) && exIdx < sets.length - 1 && (
                <Pressable
                  style={styles.nextExBtn}
                  onPress={() => {
                    swipeRef.current?.scrollTo({ x: (exIdx + 1) * pageWidth, animated: true });
                    setCurrentExIdx(exIdx + 1);
                  }}
                >
                  <View style={styles.nextExLeft}>
                    <Text style={styles.nextExLabel}>{t('workout.nextUp')}</Text>
                    <Text style={styles.nextExName} numberOfLines={1}>{sets[exIdx + 1].name}</Text>
                  </View>
                  <Text style={styles.nextExArrow}>›</Text>
                </Pressable>
              )}
              {allSetsDone(ex) && exIdx === sets.length - 1 && (
                <Pressable style={styles.finishAllBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFinished(true); setFinishTime(Date.now()); }}>
                  <Text style={styles.finishAllBtnText}>{t('workout.completeWorkout')}</Text>
                </Pressable>
              )}

              {!allSetsDone(ex) && sets.length > 1 && exIdx < sets.length - 1 && (
                <View style={styles.swipeHint}>
                  <Text style={styles.swipeHintLabel}>{t('workout.upNext')}</Text>
                  <Text style={styles.swipeHintName} numberOfLines={1}>{sets[exIdx + 1].name}</Text>
                </View>
              )}
            </ScrollView>
          );
        })}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Plate calculator modal ── */}
      <Modal visible={showPlateCalc} transparent animationType="slide" onRequestClose={() => setShowPlateCalc(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.plateOverlay} onPress={() => setShowPlateCalc(false)}>
          <Pressable style={styles.plateCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.plateTitle}>{t('workout.plate.title')}</Text>

            <View style={styles.plateBarRow}>
              <Text style={styles.plateBarLabel}>{t('workout.plate.barWeight')}</Text>
              {[15, 20].map(w => (
                <Pressable
                  key={w}
                  style={[styles.plateBarBtn, barWeight === w && styles.plateBarBtnActive]}
                  onPress={() => setBarWeight(w)}
                >
                  <Text style={[styles.plateBarBtnText, barWeight === w && styles.plateBarBtnTextActive]}>{t('workout.plate.barKg', { w })}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.plateInput}
              value={plateTarget}
              onChangeText={setPlateTarget}
              keyboardType="decimal-pad"
              placeholder={t('workout.plate.targetPlaceholder')}
              placeholderTextColor="#8A8A94"
              autoFocus
            />

            {(() => {
              const target = parseFloat(plateTarget);
              if (!plateTarget || isNaN(target)) return null;
              if (target <= barWeight) return (
                <Text style={styles.plateNote}>{t('workout.plate.barOnlyNote')}</Text>
              );
              const plates = calculatePlates(target, barWeight);
              const achieved = barWeight + plates.reduce((a, b) => a + b, 0) * 2;
              return (
                <View style={styles.plateResult}>
                  <Text style={styles.plateResultLabel}>{t('workout.plate.eachSide')}</Text>
                  {plates.length === 0
                    ? <Text style={styles.plateNote}>{t('workout.plate.barOnly')}</Text>
                    : (
                      <View style={styles.plateChipsRow}>
                        {plates.map((p, i) => (
                          <View key={i} style={styles.plateChip}>
                            <Text style={styles.plateChipText}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    )
                  }
                  <Text style={styles.plateAchieved}>
                    {achieved !== target
                      ? t('workout.plate.totalClosest', { achieved, target })
                      : t('workout.plate.total', { achieved })}
                  </Text>
                </View>
              );
            })()}

            <Pressable style={styles.plateCloseBtn} onPress={() => setShowPlateCalc(false)}>
              <Text style={styles.plateCloseBtnText}>{t('common.close')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Replace-exercise picker (cross-muscle, mid-workout) ── */}
      <Modal visible={replaceIdx !== null} transparent animationType="slide" onRequestClose={() => setReplaceIdx(null)}>
        <Pressable style={styles.plateOverlay} onPress={() => setReplaceIdx(null)}>
          <Pressable style={styles.replaceCard} onPress={e => e.stopPropagation()}>
            {replaceIdx !== null && (() => {
              const cur = sets[replaceIdx];
              const curMuscle = cur?.primaryMuscles?.[0] || '';
              const nSets = cur?.completedSets?.length || cur?.target_sets || 0;
              const q = replaceSearch.trim().toLowerCase();
              // A search query matches across every muscle group; a tag narrows to
              // one group. Drop groups that end up empty so the list stays tight.
              const visibleGroups = EXERCISE_GROUPS
                .filter(g => !replaceMuscleFilter || g.muscle === replaceMuscleFilter)
                .map(g => ({ ...g, items: q ? g.items.filter(it => it.name.toLowerCase().includes(q)) : g.items }))
                .filter(g => g.items.length);
              return (
                <>
                  <Text style={styles.plateTitle}>{t('workout.replaceModal.title', { name: cur?.name })}</Text>
                  <Text style={styles.replaceNote}>
                    {t('workout.replaceModal.note', { muscle: curMuscle || t('workout.replaceModal.thisMuscle'), count: nSets })}
                  </Text>
                  <TextInput
                    style={styles.replaceSearch}
                    placeholder={t('workout.replaceModal.searchPlaceholder')}
                    placeholderTextColor="#9494A0"
                    value={replaceSearch}
                    onChangeText={setReplaceSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.replaceTagRow}
                    contentContainerStyle={{ gap: 8, paddingRight: 24 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Pressable
                      style={[styles.replaceTag, !replaceMuscleFilter && styles.replaceTagActive]}
                      onPress={() => setReplaceMuscleFilter(null)}
                    >
                      <Text style={[styles.replaceTagText, !replaceMuscleFilter && styles.replaceTagTextActive]}>
                        {t('workout.replaceModal.all')}
                      </Text>
                    </Pressable>
                    {EXERCISE_GROUPS.map(g => (
                      <Pressable
                        key={g.muscle}
                        style={[styles.replaceTag, replaceMuscleFilter === g.muscle && styles.replaceTagActive]}
                        onPress={() => setReplaceMuscleFilter(g.muscle)}
                      >
                        <Text style={[styles.replaceTagText, replaceMuscleFilter === g.muscle && styles.replaceTagTextActive]}>
                          {g.muscle}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
                    {visibleGroups.length === 0 ? (
                      <Text style={styles.replaceNote}>{t('workout.replaceModal.noResults')}</Text>
                    ) : visibleGroups.map(g => (
                      <View key={g.muscle} style={{ marginBottom: 12 }}>
                        <Text style={[styles.replaceGroupHdr, g.muscle === curMuscle && styles.replaceGroupHdrActive]}>
                          {g.muscle}{g.muscle === curMuscle ? t('workout.replaceModal.current') : ''}
                        </Text>
                        {g.items.map(it => (
                          <Pressable
                            key={it.name}
                            style={styles.replaceRow}
                            onPress={() => { const idx = replaceIdx; setReplaceIdx(null); swapExercise(idx, it.name, -1); }}
                          >
                            <Text style={styles.replaceRowText}>{it.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                  <Pressable style={styles.plateCloseBtn} onPress={() => setReplaceIdx(null)}>
                    <Text style={styles.plateCloseBtnText}>{t('common.cancel')}</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Exercise slideshow modal ── */}
      <ExerciseSlideshow
        exercise={slideshowExercise}
        visible={!!slideshowExercise}
        onClose={() => setSlideshowExercise(null)}
      />

      {/* ── Coach modal — full AI Coach, same as the Coach tab ── */}
      <Modal visible={showCoach} animationType="slide" onRequestClose={() => setShowCoach(false)}>
        <View style={{ flex: 1, backgroundColor: '#0F0F13' }}>
          <CoachScreen
            onClose={() => setShowCoach(false)}
            onProposalApplied={applyCoachEdit}
            workoutContext={(() => {
              const ex = sets[currentExIdx];
              return [
                `Session: ${workout.name} (day_id: ${workout.id})`,
                `Exercises in this live session — use THESE [index] numbers and this day_id for any change to this session:`,
                ...sets.map((e, i) => `  [${i}] ${e.name} (${e.target_sets}×${e.target_reps})`),
                `Current exercise: ${ex?.name} (${ex?.target_sets}×${ex?.target_reps}, rest ${ex?.rest})`,
                `Sets done on this exercise: ${ex?.completedSets?.filter(s => s.done).length}/${ex?.completedSets?.length}`,
                `Session progress: ${totalSetsCompleted}/${totalSets} total sets`,
              ].join('\n');
            })()}
          />
        </View>
      </Modal>

      {/* ── Upsell paywall — free users tapping Coach mid-workout ── */}
      <Modal visible={showPaywall} animationType="slide" onRequestClose={() => setShowPaywall(false)}>
        <View style={{ flex: 1, backgroundColor: '#0F0F13' }}>
          <Pressable style={styles.paywallClose} onPress={() => setShowPaywall(false)} hitSlop={12}>
            <Text style={styles.paywallCloseText}>{t('common.close')}</Text>
          </Pressable>
          <PremiumPaywall
            feature="Coach"
            onUpgrade={async (plan) => { await onUpgrade?.(plan); setShowPaywall(false); }}
            onRestore={async () => { await onRestore?.(); setShowPaywall(false); }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  elapsedTimer: { textAlign: 'center', fontSize: 11, color: '#8A8A94', letterSpacing: 0.5, paddingVertical: 4 },
  cancelBtn: { padding: 8, width: 60 },
  cancelText: { color: '#9494A0', fontSize: 18 },
  dotIndicators: { flexDirection: 'row', gap: 4, marginTop: 5 },
  dotIndicator: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2C2C35' },
  dotIndicatorActive: { backgroundColor: '#FFFFFF', width: 14 },
  dotIndicatorDone: { backgroundColor: '#1D9E75' },
  finishBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 68, alignItems: 'center' },
  finishBtnText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  swipeHint: { marginTop: 10, marginBottom: 4, paddingHorizontal: 4 },
  swipeHintLabel: { fontSize: 9, color: '#8A8A94', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  swipeHintName: { fontSize: 13, color: '#8A8A94', fontWeight: '500' },

  progressBg: { height: 2, backgroundColor: '#2C2C35' },
  progressFill: { height: 2, backgroundColor: '#FFFFFF' },

  restBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C22', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#3D3D4A' },
  restText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  restSkip: { color: '#9494A0', fontSize: 14 },

  exCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  exNumber: { fontSize: 11, color: '#9494A0', marginBottom: 3 },
  exName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  howToTag: { fontSize: 12, fontWeight: '500', color: '#FFFFFF' },
  muscleTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  muscleTagPrimary: { backgroundColor: '#1D9E7522', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: '#1D9E7555' },
  muscleTagPrimaryText: { fontSize: 11, color: '#1D9E75', fontWeight: '600' },
  muscleTagSecondary: { backgroundColor: '#2C2C35', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  muscleTagSecondaryText: { fontSize: 11, color: '#9494A0', fontWeight: '500' },
  doneBadge: { backgroundColor: '#1A201C', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 0.5, borderColor: '#1D9E75' },
  doneBadgeText: { fontSize: 12, color: '#1D9E75', fontWeight: '600' },

  // ── Muscle map ──
  muscleMapWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: '#12121A',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },

  prescRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  prescBox: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 8, padding: 8, alignItems: 'center' },
  prescVal: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  prescLabel: { fontSize: 9, color: '#9494A0', marginTop: 2, textAlign: 'center' },

  contraBanner: { backgroundColor: '#1C1A0F', borderRadius: 8, borderWidth: 0.5, borderColor: '#BA7517', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  contraBannerText: { fontSize: 12, color: '#BA7517', lineHeight: 16 },
  contraBannerSoft: { backgroundColor: '#1A1610', borderColor: '#7A5010' },
  contraBannerSoftText: { color: '#C08B2E' },

  subText: { fontSize: 11, color: '#9494A0' },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  subLink: { color: '#A1A1AA', textDecorationLine: 'underline' },
  replaceBtn: { alignSelf: 'flex-start', marginBottom: 10, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2C2C35', backgroundColor: '#15151B' },
  replaceBtnText: { color: '#1D9E75', fontSize: 13, fontWeight: '600' },
  replaceCard: { backgroundColor: '#1A1A20', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 0.5, borderColor: '#2C2C35' },
  replaceNote: { color: '#A1A1AA', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  replaceSearch: { backgroundColor: '#15151B', borderWidth: 1, borderColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#FFFFFF', fontSize: 15, marginBottom: 12 },
  replaceTagRow: { marginBottom: 14, flexGrow: 0 },
  replaceTag: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2C2C35', backgroundColor: '#15151B' },
  replaceTagActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  replaceTagText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  replaceTagTextActive: { color: '#FFFFFF' },
  replaceGroupHdr: { color: '#9494A0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  replaceGroupHdrActive: { color: '#1D9E75' },
  replaceRow: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#15151B', marginBottom: 5 },
  replaceRowText: { color: '#FFFFFF', fontSize: 15 },


  setsCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  setHeaderRow: { flexDirection: 'row', marginBottom: 8 },
  setHeaderText: { fontSize: 11, color: '#9494A0' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  setRowDone: { opacity: 0.5 },
  setNum: { fontSize: 14, color: '#9494A0', textAlign: 'center' },
  weightInput: { backgroundColor: '#2C2C35', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, color: '#FFFFFF', fontSize: 15, textAlign: 'center' },
  tickBtn: { height: 40, borderRadius: 8, backgroundColor: '#2C2C35', alignItems: 'center', justifyContent: 'center' },
  tickBtnDone: { backgroundColor: '#1D9E75' },
  tickText: { color: '#9494A0', fontSize: 18 },
  tickTextDone: { color: '#FFFFFF', fontWeight: '700' },

  nextExBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  nextExLeft: { flex: 1 },
  nextExLabel: { fontSize: 10, color: '#8A8A94', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  nextExName: { fontSize: 15, color: '#E4E4E8', fontWeight: '600' },
  nextExArrow: { fontSize: 28, color: '#8A8A94', fontWeight: '300', lineHeight: 32 },
  finishAllBtn: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  finishAllBtnText: { color: '#111114', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },

  finishScreen: { flex: 1, padding: 24, paddingTop: 24, paddingBottom: 40 },
  finishBackBtn: { marginBottom: 16 },
  finishBackText: { color: '#9494A0', fontSize: 14 },
  finishTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 },
  finishSub: { fontSize: 15, color: '#9494A0', marginBottom: 32 },
  finishStats: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  finishStat: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  finishStatVal: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  finishStatLabel: { fontSize: 11, color: '#9494A0' },
  rpeLabel: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', marginBottom: 12 },
  rpeRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  rpeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2C2C35', alignItems: 'center' },
  rpeBtnActive: { backgroundColor: '#FFFFFF' },
  rpeBtnText: { color: '#9494A0', fontSize: 12, fontWeight: '500' },
  rpeBtnTextActive: { color: '#111114' },
  rpeSub: { fontSize: 12, color: '#9494A0', lineHeight: 18, marginBottom: 24 },
  simpleRpeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  simpleRpeBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#2C2C35', alignItems: 'center' },
  simpleRpeBtnActive: { backgroundColor: '#FFFFFF' },
  simpleRpeBtnText: { color: '#9494A0', fontSize: 15, fontWeight: '600' },
  simpleRpeBtnTextActive: { color: '#111114' },
  overloadCard: { backgroundColor: '#0F1A16', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#1D9E75', marginBottom: 24 },
  overloadTitle: { fontSize: 13, fontWeight: '700', color: '#1D9E75', marginBottom: 12 },
  overloadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  overloadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  overloadEx: { fontSize: 12, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  overloadSug: { fontSize: 11, color: '#9494A0', lineHeight: 16 },
  saveBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#111114', fontSize: 16, fontWeight: '600' },

  restWarningBanner: { backgroundColor: '#1A0E0E', borderBottomWidth: 0.5, borderBottomColor: '#E85D5C44', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  restWarningText: { flex: 1, fontSize: 11, color: '#E85D5C', lineHeight: 16 },
  restWarningDismiss: { fontSize: 11, color: '#9494A0', fontWeight: '600' },

  prevHint: { backgroundColor: '#12121A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  prevHintText: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },

  // Sets toolbar (BW + Plates)
  setsToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  setsCardTitle: { fontSize: 11, fontWeight: '700', color: '#8A8A94', letterSpacing: 0.8, textTransform: 'uppercase' },
  setsToolbarChip: { backgroundColor: '#2C2C35', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: '#3D3D4A' },
  setsToolbarChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  setsToolbarChipText: { fontSize: 11, fontWeight: '700', color: '#9494A0' },
  setsToolbarChipTextActive: { color: '#111114' },

  // Set type tap button
  setTypeBtn: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  setTypeBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  setTypeBtnDot: { fontSize: 16, color: '#2C2C35' },

  // Coach top button
  coachTopBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  coachTopBtnText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },

  // Coach modal
  paywallClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, paddingVertical: 6, paddingHorizontal: 10 },
  paywallCloseText: { color: '#9494A0', fontSize: 15, fontWeight: '600' },
  coachOverlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  coachCard: { backgroundColor: '#1A1A20', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, borderTopWidth: 0.5, borderTopColor: '#2C2C35', gap: 12 },
  coachHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coachTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  coachClose: { fontSize: 14, color: '#9494A0', fontWeight: '500' },
  coachSub: { fontSize: 12, color: '#8A8A94', marginTop: -6 },
  coachAnswerWrap: { maxHeight: 160, backgroundColor: '#12121A', borderRadius: 10, padding: 12 },
  coachAnswerText: { fontSize: 14, color: '#E4E4E8', lineHeight: 21 },
  coachInput: { backgroundColor: '#2C2C35', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 14, minHeight: 56, textAlignVertical: 'top' },
  coachSendBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  coachSendBtnText: { color: '#111114', fontSize: 15, fontWeight: '600' },

  // Plate calculator
  plateOverlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  plateCard: { backgroundColor: '#1A1A20', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 0.5, borderColor: '#2C2C35' },
  plateTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  plateBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  plateBarLabel: { fontSize: 12, color: '#9494A0', flex: 1 },
  plateBarBtn: { backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  plateBarBtnActive: { backgroundColor: '#FFFFFF' },
  plateBarBtnText: { fontSize: 13, fontWeight: '600', color: '#9494A0' },
  plateBarBtnTextActive: { color: '#111114' },
  plateInput: { backgroundColor: '#2C2C35', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  plateNote: { fontSize: 13, color: '#9494A0', textAlign: 'center', marginBottom: 16 },
  plateResult: { marginBottom: 20 },
  plateResultLabel: { fontSize: 10, fontWeight: '700', color: '#8A8A94', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  plateChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  plateChip: { backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: '#FFFFFF33' },
  plateChipText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  plateAchieved: { fontSize: 12, color: '#9494A0' },
  plateCloseBtn: { backgroundColor: '#2C2C35', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  plateCloseBtnText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
});