import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { supabase, getCurrentUser } from '../supabase';
import StudyChart from './StudyChart';
import MuscleMap from './MuscleMap';
import ExerciseSlideshow from './ExerciseSlideshow';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { checkReadyToProgress } from './programGenerator';
import { getExerciseGif } from './exerciseDBService';

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
    completedSets: Array.from({ length: n }, () => ({ weight: '', reps: '', done: false })),
  };
}

export default function WorkoutExecutionScreen({ workout, onFinish, onCancel }) {
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [sets, setSets] = useState(() => workout.exercises.map(exerciseToSetState));
  const [restTimer, setRestTimer] = useState(null);
  const [finishTime, setFinishTime] = useState(null);
  const [rpe, setRpe] = useState(7);
  const [finished, setFinished] = useState(false);
  const [prevWeights, setPrevWeights] = useState({});
  const [restWarning, setRestWarning] = useState(null);
  const [slideshowExercise, setSlideshowExercise] = useState(null);

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
      setSets(prev => [...prev, ...extra]);
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
  const [pageWidth, setPageWidth] = useState(SCREEN_W);
  const [gifCache, setGifCache] = useState({});
  const startTime = useRef(Date.now());
  const swipeRef = useRef(null);

  // Prefetch GIFs for all exercises so "How to" opens instantly
  useEffect(() => {
    const names = workout.exercises.map(e => e.name);
    names.forEach(name => {
      getExerciseGif(name).then(url => {
        if (!url) return;
        setGifCache(prev => ({ ...prev, [name]: url }));
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (!restTimer || restTimer <= 0) return;
    const timeout = setTimeout(() => setRestTimer(t => t - 1), 1000);
    return () => clearTimeout(timeout);
  }, [restTimer]);

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser();
      if (!user) return;

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

  const allSetsDone = (ex) => ex.completedSets.every(s => s.done);

  const totalSetsCompleted = sets.reduce((acc, ex) =>
    acc + ex.completedSets.filter(s => s.done).length, 0
  );

  const totalSets = sets.reduce((acc, ex) => acc + ex.completedSets.length, 0);

  const saveWorkout = async () => {
    const user = await getCurrentUser();
    if (!user) return;

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
            }))
        );
        if (completedSets.length > 0) {
          await supabase.from('completed_sets').insert(completedSets);
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
      }

      onFinish && onFinish();
    } catch (err) {
      console.error('saveWorkout error:', err);
      Alert.alert('Save failed', 'Could not save your workout. Please try again.');
    }
  };

  const currentEx = sets[currentExIdx];
  const progress = totalSets > 0 ? totalSetsCompleted / totalSets : 0;

  // ─── FINISH SCREEN ────────────────────────────────────────────────────────
  if (finished) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.finishScreen}>
        <Text style={styles.finishTitle}>Session complete</Text>
        <Text style={styles.finishSub}>{workout.name}</Text>

        <View style={styles.finishStats}>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal}>{formatTime(Math.floor(((finishTime ?? Date.now()) - startTime.current) / 1000))}</Text>
            <Text style={styles.finishStatLabel}>Duration</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal}>{totalSetsCompleted}</Text>
            <Text style={styles.finishStatLabel}>Sets done</Text>
          </View>
          <View style={styles.finishStat}>
            <Text style={styles.finishStatVal}>{sets.length}</Text>
            <Text style={styles.finishStatLabel}>Exercises</Text>
          </View>
        </View>

        <Text style={styles.rpeLabel}>How hard was it? (RPE {rpe}/10)</Text>
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
        <Text style={styles.rpeSub}>
          {rpe <= 5 ? 'Easy — consider increasing weight next session'
            : rpe <= 7 ? 'Good training zone'
            : rpe <= 9 ? 'High effort — solid work'
            : 'Max effort — ensure full recovery before next session'}
        </Text>

        {overloadSuggestions.length > 0 && (
          <View style={styles.overloadCard}>
            <Text style={styles.overloadTitle}>Next session targets</Text>
            {overloadSuggestions.map((s, i) => (
              <View key={i} style={styles.overloadRow}>
                <View style={[styles.overloadDot, { backgroundColor: s.type === 'increase' ? '#1D9E75' : '#534AB7' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overloadEx}>{s.name}</Text>
                  <Text style={styles.overloadSug}>{s.suggestion}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.saveBtn} onPress={saveWorkout}>
          <Text style={styles.saveBtnText}>Save workout</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ─── MAIN SCREEN ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Top bar — hidden when slideshow is open to prevent bleed-through */}
      {!slideshowExercise && (
      <View style={styles.topBar}>
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
        <Pressable style={styles.finishBtn} onPress={() => { setFinished(true); setFinishTime(Date.now()); }}>
          <Text style={styles.finishBtnText}>Finish</Text>
        </Pressable>
      </View>
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

      {/* Exercise swipe pager */}
      <ScrollView
        ref={swipeRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={e => setPageWidth(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
          setCurrentExIdx(idx);
        }}
        style={{ flex: 1 }}
      >
        {sets.map((ex, exIdx) => {
          const { primary, secondary } = getMuscles(ex);

          return (
            <ScrollView
              key={exIdx}
              style={{ width: pageWidth }}
              contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
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
                  <View style={styles.prescBox}>
                    <Text style={styles.prescVal}>{ex.early_rpe}→{ex.last_rpe}</Text>
                    <Text style={styles.prescLabel}>RPE</Text>
                  </View>
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
                {prevWeights[ex.name] && (
                  <View style={styles.prevHint}>
                    <Text style={styles.prevHintText}>
                      Last time: {prevWeights[ex.name].weight}kg
                      {prevWeights[ex.name].reps ? ` × ${prevWeights[ex.name].reps}` : ''}
                    </Text>
                  </View>
                )}
                <View style={styles.setHeaderRow}>
                  <Text style={[styles.setHeaderText, { width: 30 }]}>Set</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>kg</Text>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
                  <Text style={[styles.setHeaderText, { width: 50, textAlign: 'center' }]}>Done</Text>
                </View>
                {ex.completedSets.map((set, setIdx) => (
                  <View key={setIdx} style={[styles.setRow, set.done && styles.setRowDone]}>
                    <Text style={[styles.setNum, { width: 30 }]}>{setIdx + 1}</Text>
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
                ))}
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
                  <Text style={styles.nextExBtnText}>Next: {sets[exIdx + 1].name} →</Text>
                </Pressable>
              )}
              {allSetsDone(ex) && exIdx === sets.length - 1 && (
                <Pressable style={styles.finishAllBtn} onPress={() => { setFinished(true); setFinishTime(Date.now()); }}>
                  <Text style={styles.finishAllBtnText}>Complete workout →</Text>
                </Pressable>
              )}

              {!allSetsDone(ex) && sets.length > 1 && (
                <Text style={styles.swipeHint}>
                  {exIdx < sets.length - 1
                    ? `Swipe for ${sets[exIdx + 1]?.name?.split(' ').slice(0, 2).join(' ')} →`
                    : '← Swipe back'}
                </Text>
              )}
            </ScrollView>
          );
        })}
      </ScrollView>

      {/* ── Exercise slideshow modal ── */}
      <ExerciseSlideshow
        exercise={slideshowExercise}
        visible={!!slideshowExercise}
        gifUrl={slideshowExercise ? gifCache[slideshowExercise.name] : null}
        onClose={() => setSlideshowExercise(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  cancelBtn: { padding: 8, width: 60 },
  cancelText: { color: '#71717A', fontSize: 18 },
  dotIndicators: { flexDirection: 'row', gap: 4, marginTop: 5 },
  dotIndicator: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#2C2C35' },
  dotIndicatorActive: { backgroundColor: '#534AB7', width: 14 },
  dotIndicatorDone: { backgroundColor: '#1D9E75' },
  finishBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, width: 60, alignItems: 'center' },
  finishBtnText: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  swipeHint: { fontSize: 11, color: '#3D3D4A', textAlign: 'center', marginTop: 12 },

  progressBg: { height: 2, backgroundColor: '#2C2C35' },
  progressFill: { height: 2, backgroundColor: '#534AB7' },

  restBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1830', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#534AB7' },
  restText: { color: '#534AB7', fontSize: 15, fontWeight: '600' },
  restSkip: { color: '#71717A', fontSize: 14 },

  exCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  exNumber: { fontSize: 11, color: '#71717A', marginBottom: 3 },
  exName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  howToTag: { fontSize: 12, fontWeight: '500', color: '#534AB7' },
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

  subText: { fontSize: 11, color: '#71717A' },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 },
  subLink: { color: '#534AB7' },


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

  nextExBtn: { backgroundColor: '#1A1830', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12, borderWidth: 0.5, borderColor: '#534AB7' },
  nextExBtnText: { color: '#7F77DD', fontSize: 14, fontWeight: '600' },
  finishAllBtn: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  finishAllBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  finishScreen: { flex: 1, padding: 24, paddingTop: 80, paddingBottom: 40 },
  finishTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 6 },
  finishSub: { fontSize: 15, color: '#71717A', marginBottom: 32 },
  finishStats: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  finishStat: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  finishStatVal: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  finishStatLabel: { fontSize: 11, color: '#71717A' },
  rpeLabel: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', marginBottom: 12 },
  rpeRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  rpeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2C2C35', alignItems: 'center' },
  rpeBtnActive: { backgroundColor: '#534AB7' },
  rpeBtnText: { color: '#71717A', fontSize: 12, fontWeight: '500' },
  rpeBtnTextActive: { color: '#FFFFFF' },
  rpeSub: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 24 },
  overloadCard: { backgroundColor: '#0F1A16', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#1D9E75', marginBottom: 24 },
  overloadTitle: { fontSize: 13, fontWeight: '700', color: '#1D9E75', marginBottom: 12 },
  overloadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  overloadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  overloadEx: { fontSize: 12, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  overloadSug: { fontSize: 11, color: '#71717A', lineHeight: 16 },
  saveBtn: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  restWarningBanner: { backgroundColor: '#1A0E0E', borderBottomWidth: 0.5, borderBottomColor: '#E24B4A44', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  restWarningText: { flex: 1, fontSize: 11, color: '#E24B4A', lineHeight: 16 },
  restWarningDismiss: { fontSize: 11, color: '#71717A', fontWeight: '600' },

  prevHint: { backgroundColor: '#12121A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  prevHintText: { fontSize: 11, color: '#534AB7', fontWeight: '500' },
});