import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Dimensions, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { supabase, getCurrentUser } from '../supabase';
import StudyChart from './StudyChart';
import MuscleMap from './MuscleMap';
import ExerciseSlideshow from './ExerciseSlideshow';
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

const SIMPLE_RPE_OPTIONS = [
  { label: 'Easy', rpe: 6, sub: 'Had plenty left in the tank' },
  { label: 'Solid', rpe: 8, sub: 'Challenging but controlled' },
  { label: 'Max', rpe: 10, sub: 'Gave everything — full recovery needed' },
];

const SET_TYPES = ['working', 'warmup', 'drop', 'failure'];
const SET_TYPE_META = {
  warmup:  { label: 'W', color: '#BA7517' },
  drop:    { label: 'D', color: '#FFFFFF' },
  failure: { label: 'F', color: '#E24B4A' },
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

export default function WorkoutExecutionScreen({ workout, onFinish, onCancel }) {
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

        setSets(prev => prev.map(ex => {
          const saved = draftCompletions.current[ex.name];
          return saved ? { ...ex, completedSets: saved } : ex;
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
        const draft = {
          workoutId: workout.id,
          workout,
          completions: sets.map(ex => ({ name: ex.name, completedSets: ex.completedSets })),
          currentExIdx,
          rpe,
          finished,
          finishTime,
          startTime: startTime.current,
        };
        await AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft));
      } catch (_) {}
    }, 500);
    return () => clearTimeout(draftTimer.current);
  }, [sets, currentExIdx, rpe, finished, finishTime]);

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
    const hasDoneSets = sets[exIdx]?.completedSets.some(s => s.done);
    if (hasDoneSets) {
      Alert.alert(
        'Replace exercise?',
        'You\'ve already logged sets for this exercise. Swapping will clear them.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: () => doSwap(exIdx, altName, subIdx) },
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
      return {
        ...ex,
        name: newEx.name,
        primaryMuscles: pattern.muscles ?? [],
        secondaryMuscles: [],
        target_sets: newEx.sets ?? ex.target_sets,
        target_reps: newEx.reps ?? ex.target_reps,
        rest: newEx.rest ?? ex.rest,
        early_rpe: ex.early_rpe,
        last_rpe: ex.last_rpe,
        research_note: newEx.research_note ?? '',
        cues: newEx.cues ?? [],
        study: newEx.study ?? null,
        ...subs,
        completedSets: Array.from(
          { length: newEx.sets ?? ex.target_sets },
          () => ({ weight: '', reps: '', done: false })
        ),
      };
    }));
  };
  const [overloadSuggestions, setOverloadSuggestions] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [pageWidth, setPageWidth] = useState(SCREEN_W);
  const [userBodyWeight, setUserBodyWeight] = useState(null);
  const [bwMode, setBwMode] = useState({});
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [plateTarget, setPlateTarget] = useState('');
  const [barWeight, setBarWeight] = useState(20);
  const startTime = useRef(Date.now());
  const swipeRef = useRef(null);
  const draftCompletions = useRef(null); // { exerciseName -> completedSets[] } restored from AsyncStorage
  const draftTimer = useRef(null);

  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [finished]);

  useEffect(() => {
    if (!restTimer || restTimer <= 0) return;
    const timeout = setTimeout(() => setRestTimer(t => t - 1), 1000);
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
        const completedSets = sets.flatMap((ex) =>
          ex.completedSets
            .filter(s => s.done)
            .map((s, setIdx) => ({
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
      Alert.alert('Save failed', 'Could not save your workout. Please try again.');
    }
  };

  const currentEx = sets[currentExIdx];
  const progress = totalSets > 0 ? totalSetsCompleted / totalSets : 0;

  // ─── FINISH SCREEN ────────────────────────────────────────────────────────
  if (finished) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.finishScreen, { paddingTop: insets.top + 24 }]}>
        <Pressable onPress={() => setFinished(false)} style={styles.finishBackBtn}>
          <Text style={styles.finishBackText}>← Back</Text>
        </Pressable>
        <Text style={styles.finishTitle}>Session complete</Text>
        <Text style={styles.finishSub}>{workout.name}</Text>

        <View style={styles.finishStats}>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal} numberOfLines={1} adjustsFontSizeToFit>{formatTime(Math.floor(((finishTime ?? Date.now()) - startTime.current) / 1000))}</Text>
            <Text style={styles.finishStatLabel}>Duration</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal} numberOfLines={1} adjustsFontSizeToFit>{totalSetsCompleted}</Text>
            <Text style={styles.finishStatLabel}>Sets done</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal} numberOfLines={1} adjustsFontSizeToFit>{sets.length}</Text>
            <Text style={styles.finishStatLabel}>Exercises</Text>
          </View>
        </View>

        <Text style={styles.rpeLabel}>
          {isSimple ? 'How did that feel?' : `How hard was it? (RPE ${rpe}/10)`}
        </Text>
        {isSimple ? (
          <View style={styles.simpleRpeRow}>
            {SIMPLE_RPE_OPTIONS.map(opt => (
              <Pressable
                key={opt.rpe}
                style={[styles.simpleRpeBtn, rpe === opt.rpe && styles.simpleRpeBtnActive]}
                onPress={() => setRpe(opt.rpe)}
              >
                <Text style={[styles.simpleRpeBtnText, rpe === opt.rpe && styles.simpleRpeBtnTextActive]}>{opt.label}</Text>
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
            ? (SIMPLE_RPE_OPTIONS.find(o => o.rpe === rpe)?.sub || 'Tap to rate your session')
            : rpe <= 5 ? 'Easy — consider increasing weight next session'
              : rpe <= 7 ? 'Good training zone'
              : rpe <= 9 ? 'High effort — solid work'
              : 'Max effort — ensure full recovery before next session'}
        </Text>

        {overloadSuggestions.length > 0 && (
          <View style={styles.overloadCard}>
            <Text style={styles.overloadTitle}>Next session targets</Text>
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
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save workout'}</Text>
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
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
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
        <Pressable style={styles.finishBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFinished(true); setFinishTime(Date.now()); }}>
          <Text style={styles.finishBtnText} numberOfLines={1}>Finish</Text>
        </Pressable>
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
            ! You trained {restWarning.sessionName} {restWarning.hoursAgo}h ago. Training overlapping muscles this soon may limit recovery.
          </Text>
          <Pressable onPress={() => setRestWarning(null)}>
            <Text style={styles.restWarningDismiss}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* Rest timer */}
      {restTimer > 0 && (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>Rest · {formatTime(restTimer)}</Text>
          <Pressable onPress={() => setRestTimer(0)}>
            <Text style={styles.restSkip}>Skip</Text>
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
                    <Text style={styles.exNumber}>{exIdx + 1} of {sets.length}</Text>
                    <Pressable onPress={() => setSlideshowExercise(ex)}>
                      <Text style={styles.exName}>{ex.name} <Text style={styles.howToTag}>▶ How to</Text></Text>
                    </Pressable>
                  </View>
                  {allSetsDone(ex) && (
                    <View style={styles.doneBadge}>
                      <Text style={styles.doneBadgeText}>Done</Text>
                    </View>
                  )}
                </View>



                {/* Contraindication banners */}
                {ex.contraindication_substitute && (
                  <View style={styles.contraBanner}>
                    <Text style={styles.contraBannerText}>
                      Substituted for your health conditions
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
                    <Text style={styles.prescLabel}>Sets</Text>
                  </View>
                  <View style={styles.prescBox}>
                    <Text style={styles.prescVal}>{ex.target_reps}</Text>
                    <Text style={styles.prescLabel}>Reps</Text>
                  </View>
                  <View style={styles.prescBox}>
                    <Text style={styles.prescVal}>{ex.rest}</Text>
                    <Text style={styles.prescLabel}>Rest</Text>
                  </View>
                  {isSimple ? (
                    <View style={[styles.prescBox, { flex: 1.5 }]}>
                      <Text style={[styles.prescVal, { fontSize: 11 }]}>Last set hard</Text>
                      <Text style={styles.prescLabel}>Effort</Text>
                    </View>
                  ) : (
                    <View style={styles.prescBox}>
                      <Text style={styles.prescVal}>{ex.early_rpe}→{ex.last_rpe}</Text>
                      <Text style={styles.prescLabel}>RPE</Text>
                    </View>
                  )}
                </View>

                {/* Subs — tap to swap in as current exercise */}
                {(ex.sub1 || ex.sub2 || ex.sub3) && (
                  <View style={styles.subRow}>
                    <Text style={styles.subText}>Swap: </Text>
                    {[ex.sub1, ex.sub2, ex.sub3].map((sub, slotIdx) => sub ? (
                      <Pressable key={slotIdx} onPress={() => swapExercise(exIdx, sub, slotIdx)}>
                        <Text style={styles.subLink}>{sub}{slotIdx < 2 && (ex.sub2 || ex.sub3) ? ' · ' : ''}</Text>
                      </Pressable>
                    ) : null)}
                  </View>
                )}

                {/* Study chart */}
                {ex.study && <StudyChart study={ex.study} />}

              </View>

              {/* Sets */}
              <View style={styles.setsCard}>
                {/* Card toolbar */}
                <View style={styles.setsToolbar}>
                  <Text style={styles.setsCardTitle}>Sets</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {userBodyWeight && (
                      <Pressable
                        style={[styles.setsToolbarChip, bwMode[exIdx] && styles.setsToolbarChipActive]}
                        onPress={() => toggleBwMode(exIdx)}
                      >
                        <Text style={[styles.setsToolbarChipText, bwMode[exIdx] && styles.setsToolbarChipTextActive]}>BW</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.setsToolbarChip}
                      onPress={() => { setPlateTarget(''); setShowPlateCalc(true); }}
                    >
                      <Text style={styles.setsToolbarChipText}>Plates</Text>
                    </Pressable>
                  </View>
                </View>

                {prevWeights[ex.name] && (
                  <View style={styles.prevHint}>
                    <Text style={styles.prevHintText}>
                      Last time: {prevWeights[ex.name].weight}kg
                      {prevWeights[ex.name].reps ? ` × ${prevWeights[ex.name].reps}` : ''}
                    </Text>
                  </View>
                )}

                <View style={styles.setHeaderRow}>
                  <View style={{ width: 28 }} />
                  <Text style={[styles.setHeaderText, { width: 22 }]}>Set</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>kg</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
                  <Text style={[styles.setHeaderText, { width: 50, textAlign: 'center' }]}>Done</Text>
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
                        placeholderTextColor="#3D3D4A"
                        editable={!set.done}
                      />
                      <TextInput
                        style={[styles.weightInput, { flex: 1, marginLeft: 6 }]}
                        value={set.reps}
                        onChangeText={v => updateReps(exIdx, setIdx, v)}
                        keyboardType="number-pad"
                        placeholder={prevWeights[ex.name]?.reps?.toString() || '—'}
                        placeholderTextColor="#3D3D4A"
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
                    <Text style={styles.nextExLabel}>Next up</Text>
                    <Text style={styles.nextExName} numberOfLines={1}>{sets[exIdx + 1].name}</Text>
                  </View>
                  <Text style={styles.nextExArrow}>›</Text>
                </Pressable>
              )}
              {allSetsDone(ex) && exIdx === sets.length - 1 && (
                <Pressable style={styles.finishAllBtn} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setFinished(true); setFinishTime(Date.now()); }}>
                  <Text style={styles.finishAllBtnText}>Complete workout</Text>
                </Pressable>
              )}

              {!allSetsDone(ex) && sets.length > 1 && exIdx < sets.length - 1 && (
                <View style={styles.swipeHint}>
                  <Text style={styles.swipeHintLabel}>Up next</Text>
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
        <Pressable style={styles.plateOverlay} onPress={() => setShowPlateCalc(false)}>
          <Pressable style={styles.plateCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.plateTitle}>Plate calculator</Text>

            <View style={styles.plateBarRow}>
              <Text style={styles.plateBarLabel}>Bar weight</Text>
              {[15, 20].map(w => (
                <Pressable
                  key={w}
                  style={[styles.plateBarBtn, barWeight === w && styles.plateBarBtnActive]}
                  onPress={() => setBarWeight(w)}
                >
                  <Text style={[styles.plateBarBtnText, barWeight === w && styles.plateBarBtnTextActive]}>{w} kg</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.plateInput}
              value={plateTarget}
              onChangeText={setPlateTarget}
              keyboardType="decimal-pad"
              placeholder="Target weight (kg)"
              placeholderTextColor="#3D3D4A"
              autoFocus
            />

            {(() => {
              const target = parseFloat(plateTarget);
              if (!plateTarget || isNaN(target)) return null;
              if (target <= barWeight) return (
                <Text style={styles.plateNote}>Use the bar only — no plates needed.</Text>
              );
              const plates = calculatePlates(target, barWeight);
              const achieved = barWeight + plates.reduce((a, b) => a + b, 0) * 2;
              return (
                <View style={styles.plateResult}>
                  <Text style={styles.plateResultLabel}>Each side</Text>
                  {plates.length === 0
                    ? <Text style={styles.plateNote}>Bar only</Text>
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
                    Total: {achieved} kg{achieved !== target ? ` (closest to ${target} kg)` : ''}
                  </Text>
                </View>
              );
            })()}

            <Pressable style={styles.plateCloseBtn} onPress={() => setShowPlateCalc(false)}>
              <Text style={styles.plateCloseBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Exercise slideshow modal ── */}
      <ExerciseSlideshow
        exercise={slideshowExercise}
        visible={!!slideshowExercise}
        onClose={() => setSlideshowExercise(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  elapsedTimer: { textAlign: 'center', fontSize: 11, color: '#3D3D4A', letterSpacing: 0.5, paddingVertical: 4 },
  cancelBtn: { padding: 8, width: 60 },
  cancelText: { color: '#71717A', fontSize: 18 },
  dotIndicators: { flexDirection: 'row', gap: 4, marginTop: 5 },
  dotIndicator: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2C2C35' },
  dotIndicatorActive: { backgroundColor: '#FFFFFF', width: 14 },
  dotIndicatorDone: { backgroundColor: '#1D9E75' },
  finishBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 68, alignItems: 'center' },
  finishBtnText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  swipeHint: { marginTop: 10, marginBottom: 4, paddingHorizontal: 4 },
  swipeHintLabel: { fontSize: 9, color: '#3D3D4A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  swipeHintName: { fontSize: 13, color: '#3D3D4A', fontWeight: '500' },

  progressBg: { height: 2, backgroundColor: '#2C2C35' },
  progressFill: { height: 2, backgroundColor: '#FFFFFF' },

  restBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C22', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#3D3D4A' },
  restText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  restSkip: { color: '#71717A', fontSize: 14 },

  exCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  exNumber: { fontSize: 11, color: '#71717A', marginBottom: 3 },
  exName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  howToTag: { fontSize: 12, fontWeight: '500', color: '#FFFFFF' },
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
  prescLabel: { fontSize: 9, color: '#71717A', marginTop: 2, textAlign: 'center' },

  contraBanner: { backgroundColor: '#1C1A0F', borderRadius: 8, borderWidth: 0.5, borderColor: '#BA7517', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  contraBannerText: { fontSize: 12, color: '#BA7517', lineHeight: 16 },
  contraBannerSoft: { backgroundColor: '#1A1610', borderColor: '#7A5010' },
  contraBannerSoftText: { color: '#8A6520' },

  subText: { fontSize: 11, color: '#71717A' },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  subLink: { color: '#A1A1AA', textDecorationLine: 'underline' },


  setsCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  setHeaderRow: { flexDirection: 'row', marginBottom: 8 },
  setHeaderText: { fontSize: 11, color: '#71717A' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  setRowDone: { opacity: 0.5 },
  setNum: { fontSize: 14, color: '#71717A', textAlign: 'center' },
  weightInput: { backgroundColor: '#2C2C35', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, color: '#FFFFFF', fontSize: 15, textAlign: 'center' },
  tickBtn: { height: 40, borderRadius: 8, backgroundColor: '#2C2C35', alignItems: 'center', justifyContent: 'center' },
  tickBtnDone: { backgroundColor: '#1D9E75' },
  tickText: { color: '#71717A', fontSize: 18 },
  tickTextDone: { color: '#FFFFFF', fontWeight: '700' },

  nextExBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  nextExLeft: { flex: 1 },
  nextExLabel: { fontSize: 10, color: '#52525B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  nextExName: { fontSize: 15, color: '#E4E4E8', fontWeight: '600' },
  nextExArrow: { fontSize: 28, color: '#3D3D4A', fontWeight: '300', lineHeight: 32 },
  finishAllBtn: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  finishAllBtnText: { color: '#111114', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },

  finishScreen: { flex: 1, padding: 24, paddingTop: 24, paddingBottom: 40 },
  finishBackBtn: { marginBottom: 16 },
  finishBackText: { color: '#71717A', fontSize: 14 },
  finishTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 },
  finishSub: { fontSize: 15, color: '#71717A', marginBottom: 32 },
  finishStats: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  finishStat: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  finishStatVal: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  finishStatLabel: { fontSize: 11, color: '#71717A' },
  rpeLabel: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', marginBottom: 12 },
  rpeRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  rpeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2C2C35', alignItems: 'center' },
  rpeBtnActive: { backgroundColor: '#FFFFFF' },
  rpeBtnText: { color: '#71717A', fontSize: 12, fontWeight: '500' },
  rpeBtnTextActive: { color: '#111114' },
  rpeSub: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 24 },
  simpleRpeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  simpleRpeBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#2C2C35', alignItems: 'center' },
  simpleRpeBtnActive: { backgroundColor: '#FFFFFF' },
  simpleRpeBtnText: { color: '#71717A', fontSize: 15, fontWeight: '600' },
  simpleRpeBtnTextActive: { color: '#111114' },
  overloadCard: { backgroundColor: '#0F1A16', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#1D9E75', marginBottom: 24 },
  overloadTitle: { fontSize: 13, fontWeight: '700', color: '#1D9E75', marginBottom: 12 },
  overloadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  overloadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  overloadEx: { fontSize: 12, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  overloadSug: { fontSize: 11, color: '#71717A', lineHeight: 16 },
  saveBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#111114', fontSize: 16, fontWeight: '600' },

  restWarningBanner: { backgroundColor: '#1A0E0E', borderBottomWidth: 0.5, borderBottomColor: '#E24B4A44', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  restWarningText: { flex: 1, fontSize: 11, color: '#E24B4A', lineHeight: 16 },
  restWarningDismiss: { fontSize: 11, color: '#71717A', fontWeight: '600' },

  prevHint: { backgroundColor: '#12121A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  prevHintText: { fontSize: 11, color: '#FFFFFF', fontWeight: '500' },

  // Sets toolbar (BW + Plates)
  setsToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  setsCardTitle: { fontSize: 11, fontWeight: '700', color: '#52525B', letterSpacing: 0.8, textTransform: 'uppercase' },
  setsToolbarChip: { backgroundColor: '#2C2C35', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: '#3D3D4A' },
  setsToolbarChipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  setsToolbarChipText: { fontSize: 11, fontWeight: '700', color: '#71717A' },
  setsToolbarChipTextActive: { color: '#111114' },

  // Set type tap button
  setTypeBtn: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  setTypeBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  setTypeBtnDot: { fontSize: 16, color: '#2C2C35' },

  // Plate calculator
  plateOverlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  plateCard: { backgroundColor: '#1A1A20', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 0.5, borderColor: '#2C2C35' },
  plateTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  plateBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  plateBarLabel: { fontSize: 12, color: '#71717A', flex: 1 },
  plateBarBtn: { backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  plateBarBtnActive: { backgroundColor: '#FFFFFF' },
  plateBarBtnText: { fontSize: 13, fontWeight: '600', color: '#71717A' },
  plateBarBtnTextActive: { color: '#111114' },
  plateInput: { backgroundColor: '#2C2C35', borderRadius: 10, padding: 14, color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 20, textAlign: 'center' },
  plateNote: { fontSize: 13, color: '#71717A', textAlign: 'center', marginBottom: 16 },
  plateResult: { marginBottom: 20 },
  plateResultLabel: { fontSize: 10, fontWeight: '700', color: '#52525B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  plateChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  plateChip: { backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: '#FFFFFF33' },
  plateChipText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  plateAchieved: { fontSize: 12, color: '#71717A' },
  plateCloseBtn: { backgroundColor: '#2C2C35', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  plateCloseBtnText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
});