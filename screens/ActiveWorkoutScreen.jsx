// ActiveWorkoutScreen.jsx — LiftIQ (upgraded)
import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal,
} from 'react-native';
import { supabase } from '../supabase';
import { EXERCISES, EXERCISE_CATEGORIES } from './exerciseLibrary';
import ExerciseDetailSheet from './ExerciseDetailSheet';
import { format, subDays } from 'date-fns';
import ExerciseImageSlideshow from './ExerciseImageSlideshow';
import Exercise3DModal from './Exercise3DModal';

// ─── PLATE CALCULATOR ─────────────────────────────────────────────────────────

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const BAR_KG = 20;

function calcPlates(totalKg) {
  let rem = (totalKg - BAR_KG) / 2;
  if (rem < 0) return [];
  const result = [];
  for (const p of PLATES_KG) {
    const n = Math.floor(rem / p);
    if (n > 0) { result.push({ kg: p, count: n }); rem -= n * p; }
  }
  return result;
}

function PlateCalculator({ weight, onClose }) {
  const total = parseFloat(weight) || 0;
  const plates = total >= BAR_KG ? calcPlates(total) : [];

  return (
    <View style={pc.container}>
      <View style={pc.inner}>
        <Text style={pc.title}>Plate Calculator</Text>
        <Text style={pc.target}>{total || '—'} kg total</Text>

        {total < BAR_KG && total > 0 ? (
          <Text style={pc.note}>Below bar weight (20 kg)</Text>
        ) : plates.length > 0 ? (
          <>
            <Text style={pc.barNote}>20 kg bar + each side:</Text>
            <View style={pc.plateRow}>
              {plates.map((p, i) => (
                <View key={i} style={[pc.plateBadge, { backgroundColor: plateColor(p.kg) }]}>
                  <Text style={pc.plateKg}>{p.kg}</Text>
                  <Text style={pc.plateCount}>×{p.count}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={pc.note}>Enter a weight above</Text>
        )}

        <Pressable style={pc.closeBtn} onPress={onClose}>
          <Text style={pc.closeBtnText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function plateColor(kg) {
  if (kg >= 25) return '#E24B4A';
  if (kg >= 20) return '#2B5BE0';
  if (kg >= 15) return '#BA7517';
  if (kg >= 10) return '#1D9E75';
  if (kg >= 5)  return '#7F77DD';
  return '#3D3D4A';
}

const pc = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  inner: { backgroundColor: '#13121E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  title: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  target: { fontSize: 28, fontWeight: '300', color: '#A89FE8', marginBottom: 16 },
  barNote: { fontSize: 12, color: '#71717A', marginBottom: 10 },
  plateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  plateBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', minWidth: 60 },
  plateKg: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  plateCount: { fontSize: 11, color: '#FFFFFF99', marginTop: 2 },
  note: { fontSize: 13, color: '#52525B', marginBottom: 20 },
  closeBtn: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

// ─── PREVIOUS SESSION REFERENCE ROW ───────────────────────────────────────────

function PrevSessionRow({ sessions }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <View style={ps.container}>
      <Text style={ps.label}>Previous</Text>
      {sessions.map((sess, i) => (
        <View key={i} style={ps.chip}>
          <Text style={ps.chipDate}>{sess.date}</Text>
          <Text style={ps.chipVal}>{sess.weight}kg×{sess.reps}</Text>
        </View>
      ))}
    </View>
  );
}

const ps = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  label: { fontSize: 10, color: '#3F3F50', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 2 },
  chip: { backgroundColor: '#1A1A20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 0.5, borderColor: '#2C2C35' },
  chipDate: { fontSize: 9, color: '#3F3F50' },
  chipVal: { fontSize: 11, color: '#A1A1AA', fontWeight: '600' },
});

// ─── REST TIMER RING ──────────────────────────────────────────────────────────

function RestRing({ seconds, total, onSkip }) {
  const progress = total > 0 ? seconds / total : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const strokeDash = circ * progress;

  return (
    <Pressable onPress={onSkip} style={rr.container}>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx={35} cy={35} r={r} fill="none" stroke="#1E1E28" strokeWidth={4} />
        <circle
          cx={35} cy={35} r={r}
          fill="none"
          stroke="#534AB7"
          strokeWidth={4}
          strokeDasharray={`${strokeDash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 35 35)"
        />
        <text x={35} y={40} textAnchor="middle" fill="#FFFFFF" fontSize={14} fontWeight="700">{seconds}s</text>
      </svg>
      <Text style={rr.skip}>tap to skip</Text>
    </Pressable>
  );
}

const rr = StyleSheet.create({
  container: { alignItems: 'center' },
  skip: { fontSize: 9, color: '#3F3F50', marginTop: 2 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen({ onFinish, onCancel, preloadedWorkout }) {
  const [exercises, setExercises] = useState(() => {
    if (!preloadedWorkout?.exercises?.length) return [];
    return preloadedWorkout.exercises.map(ex => ({
      name: ex.name,
      muscles: ex.muscles || '',
      reps_target: ex.reps || '',
      rest_target: ex.rest || 90,
      early_rpe: ex.early_rpe || 7,
      last_rpe: ex.last_rpe || 9,
      research_note: ex.research_note || '',
      cues: ex.cues || [],
      sub1: ex.sub1 || '',
      sub2: ex.sub2 || '',
      rpe: 7,
      sets: Array.from({ length: typeof ex.sets === 'number' ? ex.sets : 3 }, () => ({
        reps: '',
        weight: '',
        done: false,
      })),
    }));
  });

  const [history, setHistory] = useState({});
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [exCategory, setExCategory] = useState('All');
  const [restTimer, setRestTimer] = useState(null);
  const [restTotal, setRestTotal] = useState(90);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [plateCalcWeight, setPlateCalcWeight] = useState(null);
  const [formViewExercise, setFormViewExercise] = useState(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const since = format(subDays(new Date(), 60), 'yyyy-MM-dd');
      const { data: sets } = await supabase
        .from('completed_sets')
        .select('exercise_name, weight_kg, reps, set_number, workout_sessions(started_at)')
        .eq('workout_sessions.user_id', user.id)
        .gte('workout_sessions.started_at', since)
        .order('workout_sessions(started_at)', { ascending: false });

      if (!sets) return;

      const byExercise = {};
      sets.forEach(s => {
        const name = s.exercise_name;
        const date = s.workout_sessions?.started_at
          ? format(new Date(s.workout_sessions.started_at), 'MMM d')
          : null;
        if (!date) return;
        if (!byExercise[name]) byExercise[name] = {};
        if (!byExercise[name][date]) byExercise[name][date] = [];
        byExercise[name][date].push({ set_number: s.set_number, weight: s.weight_kg, reps: s.reps });
      });

      const histMap = {};
      Object.entries(byExercise).forEach(([name, dateMap]) => {
        const sessions = Object.entries(dateMap)
          .sort(([a], [b]) => new Date(b) - new Date(a))
          .slice(0, 3)
          .map(([date, sets]) => ({
            date,
            weight: Math.max(...sets.map(s => s.weight || 0)).toString(),
            reps: sets.find(s => s.weight === Math.max(...sets.map(s2 => s2.weight || 0)))?.reps?.toString() || '',
            sets: sets.sort((a, b) => a.set_number - b.set_number),
          }));
        histMap[name] = sessions;
      });

      setHistory(histMap);

      setExercises(prev => prev.map(ex => {
        const exHistory = histMap[ex.name];
        if (!exHistory || !exHistory.length) return ex;
        const lastSession = exHistory[0];
        return {
          ...ex,
          sets: ex.sets.map((set, i) => {
            const ref = lastSession.sets[i];
            return ref ? { ...set, weight: ref.weight?.toString() || '', reps: ref.reps?.toString() || '' } : set;
          }),
        };
      }));
    } catch (e) {
      console.error('loadHistory error:', e);
    }
  };

  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const timeout = setTimeout(() => setRestTimer(t => t - 1), 1000);
    return () => clearTimeout(timeout);
  }, [restTimer]);

  const addExercise = (name) => {
    const exHistory = history[name];
    const lastSets = exHistory?.[0]?.sets || [];
    setExercises(prev => [...prev, {
      name,
      rpe: 7,
      sets: lastSets.length
        ? lastSets.map(s => ({ reps: s.reps?.toString() || '', weight: s.weight?.toString() || '', done: false }))
        : [{ reps: '', weight: '', done: false }],
    }]);
    setShowAddExercise(false);
    setExSearch('');
    setExCategory('All');
  };

  const addSet = (exIdx) => {
    setExercises(prev => prev.map((e, i) => {
      if (i !== exIdx) return e;
      const lastSet = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, { reps: lastSet?.reps || '', weight: lastSet?.weight || '', done: false }] };
    }));
  };

  const updateSet = (exIdx, setIdx, field, val) => {
    setExercises(prev => prev.map((e, i) =>
      i === exIdx ? {
        ...e,
        sets: e.sets.map((s, j) => j === setIdx ? { ...s, [field]: val } : s)
      } : e
    ));
  };

  const toggleSet = (exIdx, setIdx) => {
    const ex = exercises[exIdx];
    const restSecs = parseInt(ex?.rest_target) || 90;
    setExercises(prev => prev.map((e, i) =>
      i === exIdx ? {
        ...e,
        sets: e.sets.map((s, j) => j === setIdx ? { ...s, done: !s.done } : s)
      } : e
    ));
    setRestTotal(restSecs);
    setRestTimer(restSecs);
  };

  const updateExerciseRpe = (exIdx, val) => {
    setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, rpe: val } : e));
  };

  const removeExercise = (exIdx) => {
    setExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const finishWorkout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const avgRpe = exercises.length
      ? Math.round(exercises.reduce((a, e) => a + (e.rpe || 7), 0) / exercises.length)
      : 7;

    const { data: session, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        name: preloadedWorkout?.name || 'Workout',
        started_at: new Date(startTime.current).toISOString(),
        completed_at: new Date().toISOString(),
        duration_min: Math.round((Date.now() - startTime.current) / 60000),
        perceived_exertion: avgRpe,
      })
      .select()
      .single();

    if (!error && session) {
      const sets = exercises.flatMap((e) =>
        e.sets.filter(s => s.done).map((s, si) => ({
          session_id: session.id,
          exercise_name: e.name,
          set_number: si + 1,
          reps: parseInt(s.reps) || null,
          weight_kg: parseFloat(s.weight) || null,
        }))
      );
      if (sets.length > 0) {
        await supabase.from('completed_sets').insert(sets);
      }
    }

    onFinish && onFinish();
  };

  const filteredExercises = EXERCISES.filter(ex =>
    (exCategory === 'All' || ex.category === exCategory) &&
    (exSearch === '' || ex.name.toLowerCase().includes(exSearch.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishBtnText}>Finish</Text>
        </Pressable>
      </View>

      {/* Rest timer */}
      {restTimer !== null && restTimer > 0 && (
        <View style={styles.restBanner}>
          <Text style={styles.restLabel}>Rest</Text>
          <RestRing seconds={restTimer} total={restTotal} onSkip={() => setRestTimer(0)} />
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        {preloadedWorkout?.name && (
          <Text style={styles.workoutName}>{preloadedWorkout.name}</Text>
        )}

        {exercises.map((ex, exIdx) => {
          const exHistory = history[ex.name] || [];
          const doneCount = ex.sets.filter(s => s.done).length;
          const totalSets = ex.sets.length;

          return (
            <View key={exIdx} style={styles.exCard}>
              {/* Exercise header */}
              <View style={styles.exHeader}>
                <Pressable onPress={() => setSelectedExercise(ex.name)} style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  {ex.muscles ? <Text style={styles.exMuscles}>{ex.muscles}</Text> : null}
                </Pressable>
                <View style={styles.exHeaderRight}>
                  <Text style={styles.setProgress}>{doneCount}/{totalSets}</Text>
                  <Pressable
                    style={styles.formBtn}
                    onPress={() => setFormViewExercise(ex.name)}
                    hitSlop={8}
                  >
                    <Text style={styles.formBtnText}>3D</Text>
                  </Pressable>
                  <Pressable onPress={() => removeExercise(exIdx)}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              </View>

              {/* ✅ Exercise images — start & end position */}
              <ExerciseImageSlideshow
                exerciseName={ex.name}
                style={styles.slideshow}
              />

              {/* Previous 3 sessions reference */}
              <PrevSessionRow sessions={exHistory} />

              {/* Set column headers */}
              <View style={styles.setHeaderRow}>
                <Text style={[styles.setHeaderText, { width: 28 }]}>#</Text>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.setHeaderText, { flex: 1 }]}>kg</Text>
                  <Text style={styles.setHeaderSep} />
                </View>
                <Text style={[styles.setHeaderText, { flex: 1 }]}>Reps</Text>
                <Text style={[styles.setHeaderText, { width: 44, textAlign: 'center' }]}>✓</Text>
              </View>

              {/* Sets */}
              {ex.sets.map((set, setIdx) => (
                <View key={setIdx} style={[styles.setRow, set.done && styles.setRowDone]}>
                  <Text style={[styles.setNum, { width: 28 }]}>{setIdx + 1}</Text>

                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TextInput
                      style={[styles.setInput, { flex: 1 }]}
                      value={set.weight}
                      onChangeText={v => updateSet(exIdx, setIdx, 'weight', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor="#3D3D4A"
                      editable={!set.done}
                    />
                    <Pressable
                      onPress={() => setPlateCalcWeight(set.weight || '0')}
                      style={styles.plateBtn}
                    >
                      <Text style={styles.plateBtnText}>⊞</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={[styles.setInput, { flex: 1 }]}
                    value={set.reps}
                    onChangeText={v => updateSet(exIdx, setIdx, 'reps', v)}
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor="#3D3D4A"
                    editable={!set.done}
                  />

                  <Pressable
                    style={[styles.doneBtn, set.done && styles.doneBtnActive, { width: 44 }]}
                    onPress={() => toggleSet(exIdx, setIdx)}
                  >
                    <Text style={[styles.doneBtnText, set.done && styles.doneBtnTextActive]}>✓</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                <Text style={styles.addSetText}>+ Add set</Text>
              </Pressable>

              {/* Per-exercise RPE */}
              <View style={styles.rpeRow}>
                <Text style={styles.rpeLabel}>RPE</Text>
                {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v => (
                  <Pressable
                    key={v}
                    style={[styles.rpeChip, ex.rpe === v && styles.rpeChipActive]}
                    onPress={() => updateExerciseRpe(exIdx, v)}
                  >
                    <Text style={[styles.rpeChipText, ex.rpe === v && styles.rpeChipTextActive]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        {/* Add exercise */}
        {showAddExercise ? (
          <View style={styles.exPickerCard}>
            <Text style={styles.exPickerTitle}>Add exercise</Text>
            <TextInput
              style={styles.exSearchInput}
              value={exSearch}
              onChangeText={setExSearch}
              placeholder="Search exercises…"
              placeholderTextColor="#3D3D4A"
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['All', ...EXERCISE_CATEGORIES].map(cat => (
                  <Pressable
                    key={cat}
                    style={[styles.catChip, exCategory === cat && styles.catChipActive]}
                    onPress={() => setExCategory(cat)}
                  >
                    <Text style={[styles.catChipText, exCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <ScrollView style={{ maxHeight: 240 }}>
              {filteredExercises.map(ex => (
                <Pressable key={ex.name} style={styles.exListItem} onPress={() => addExercise(ex.name)}>
                  <Text style={styles.exListName}>{ex.name}</Text>
                  {history[ex.name]?.[0] && (
                    <Text style={styles.exListLast}>Last: {history[ex.name][0].weight}kg×{history[ex.name][0].reps}</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.cancelPickerBtn} onPress={() => setShowAddExercise(false)}>
              <Text style={styles.cancelPickerText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addExBtn} onPress={() => setShowAddExercise(true)}>
            <Text style={styles.addExText}>+ Add exercise</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Plate Calculator Modal */}
      {plateCalcWeight !== null && (
        <Modal transparent animationType="slide">
          <PlateCalculator weight={plateCalcWeight} onClose={() => setPlateCalcWeight(null)} />
        </Modal>
      )}

      {/* Exercise detail sheet */}
      {selectedExercise && (
        <ExerciseDetailSheet
          exerciseName={selectedExercise}
          onClose={() => setSelectedExercise(null)}
        />
      )}

      {/* 3D form viewer */}
      {formViewExercise && (
        <Exercise3DModal
          exerciseName={formViewExercise}
          onClose={() => setFormViewExercise(null)}
        />
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E1E28',
  },
  cancelBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  cancelText: { fontSize: 15, color: '#71717A' },
  finishBtn: { backgroundColor: '#534AB7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  finishBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  restBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#13121E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C35',
  },
  restLabel: { fontSize: 13, color: '#71717A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  workoutName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#534AB7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },

  exCard: {
    backgroundColor: '#13121E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
    marginBottom: 12,
  },
  exHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  exName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  exMuscles: { fontSize: 11, color: '#52525B' },
  exHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  formBtn: {
    backgroundColor: '#1E1A35',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: '#534AB744',
  },
  formBtnText: { fontSize: 11, fontWeight: '700', color: '#7F77DD', letterSpacing: 0.5 },
  setProgress: { fontSize: 12, color: '#534AB7', fontWeight: '700' },
  removeText: { fontSize: 14, color: '#3D3D4A', paddingLeft: 4 },

  // Slideshow spacing
  slideshow: { marginBottom: 12 },

  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  setHeaderText: { fontSize: 10, color: '#3F3F50', textTransform: 'uppercase', letterSpacing: 0.5 },
  setHeaderSep: { width: 28 },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    borderRadius: 10,
    paddingVertical: 2,
  },
  setRowDone: { opacity: 0.5 },
  setNum: { fontSize: 13, color: '#52525B', fontWeight: '600' },

  setInput: {
    backgroundColor: '#1A1A20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },

  plateBtn: {
    width: 28,
    height: 36,
    backgroundColor: '#1E1A35',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#534AB744',
  },
  plateBtnText: { fontSize: 14, color: '#7F77DD' },

  doneBtn: {
    backgroundColor: '#1A1A20',
    borderRadius: 8,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },
  doneBtnActive: { backgroundColor: '#534AB7', borderColor: '#534AB7' },
  doneBtnText: { fontSize: 16, color: '#3F3F50' },
  doneBtnTextActive: { color: '#FFFFFF' },

  addSetBtn: { marginTop: 4, paddingVertical: 8, alignItems: 'center' },
  addSetText: { fontSize: 13, color: '#534AB7', fontWeight: '600' },

  rpeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  rpeLabel: { fontSize: 10, color: '#3F3F50', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 },
  rpeChip: {
    backgroundColor: '#18181F',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },
  rpeChipActive: { backgroundColor: '#1E1A35', borderColor: '#534AB7' },
  rpeChipText: { fontSize: 11, color: '#52525B', fontWeight: '600' },
  rpeChipTextActive: { color: '#A89FE8' },

  addExBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2C2C35',
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addExText: { fontSize: 14, color: '#534AB7', fontWeight: '600' },

  exPickerCard: {
    backgroundColor: '#13121E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },
  exPickerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  exSearchInput: {
    backgroundColor: '#1A1A20',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },
  catChip: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
    backgroundColor: '#18181F',
  },
  catChipActive: { backgroundColor: '#1E1A35', borderColor: '#534AB7' },
  catChipText: { fontSize: 12, color: '#71717A' },
  catChipTextActive: { color: '#A89FE8', fontWeight: '600' },

  exListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E1E28',
  },
  exListName: { fontSize: 14, color: '#E4E4E7' },
  exListLast: { fontSize: 11, color: '#534AB7', fontWeight: '600' },

  cancelPickerBtn: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  cancelPickerText: { fontSize: 14, color: '#71717A' },
});