import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { generateProgram, VOLUME_TARGETS, detectPlateaus, detectDeloadNeeded, generateDeloadWeek } from './programGenerator';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import { format, isToday, isYesterday, differenceInDays, startOfWeek, subDays } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Build exercise → raw muscles map from movementLibrary
function buildExerciseMuscleMap() {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(pattern => {
    pattern.exercises.forEach(ex => {
      map[ex.name.toLowerCase()] = pattern.muscles.map(m => m.toLowerCase());
    });
  });
  return map;
}

const EXERCISE_MUSCLE_MAP = buildExerciseMuscleMap();

// Normalise raw library muscle names → display group keys used in MUSCLE_DISPLAY
function normaliseMuscle(raw) {
  const r = raw.toLowerCase();
  if (r === 'chest' || r === 'upper chest' || r === 'lower chest') return 'chest';
  if (r === 'lats' || r === 'lower back' || r === 'traps' || r === 'upper traps' ||
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
  return null; // ignore: external rotators on their own, etc.
}

function getMusclesForExercise(exerciseName) {
  const raw = EXERCISE_MUSCLE_MAP[exerciseName?.toLowerCase()] || [];
  // Map to display keys, deduplicate, drop nulls
  const keys = [...new Set(raw.map(normaliseMuscle).filter(Boolean))];
  return keys;
}

function getRecoveryStatus(daysSince) {
  if (daysSince === null) return 'fresh';      // never trained
  if (daysSince === 0) return 'trained_today'; // trained today
  if (daysSince === 1) return 'recovering';    // 1 day ago
  if (daysSince <= 2) return 'ready';          // 2 days ago
  return 'fresh';                               // 3+ days
}

const RECOVERY_COLORS = {
  fresh:         { color: '#7F77DD', label: 'Primed',        bg: '#534AB722' },
  ready:         { color: '#1D9E75', label: 'Ready',         bg: '#1D9E7522' },
  recovering:    { color: '#BA7517', label: 'Recovering',    bg: '#BA751722' },
  trained_today: { color: '#534AB7', label: 'Trained today', bg: '#534AB722' },
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
  abs:        'Abs',
};

export default function TodayScreen({ onStartWorkout, onPreviewWorkout }) {
  const [program, setProgram] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [tomorrowWorkout, setTomorrowWorkout] = useState(null);
  const [muscleRecovery, setMuscleRecovery] = useState({});
  const [weeklyVolume, setWeeklyVolume] = useState({});
  const [lastSession, setLastSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [plateaus, setPlateaus] = useState([]);
  const [deloadSuggestion, setDeloadSuggestion] = useState(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [sessionMuscles, setSessionMuscles] = useState([]);

  const todayName = DAYS[new Date().getDay()];
  const tomorrowName = DAYS[(new Date().getDay() + 1) % 7];

  const openSessionDetail = async () => {
    if (!lastSession) return;
    const { data: sets } = await supabase
      .from('completed_sets')
      .select('exercise_name')
      .eq('session_id', lastSession.id);

    const muscleCounts = {};
    (sets || []).forEach(s => {
      getMusclesForExercise(s.exercise_name).forEach(m => {
        muscleCounts[m] = (muscleCounts[m] || 0) + 1;
      });
    });
    const sorted = Object.entries(muscleCounts)
      .map(([muscle, sets]) => ({ muscle, sets }))
      .sort((a, b) => b.sets - a.sets);
    setSessionMuscles(sorted);
    setShowSessionDetail(true);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (prof) {
        setProfile(prof);
        const prog = generateProgram(prof);
        setProgram(prog);

        // Today's workout
        const todayIdx = prog.schedule.indexOf(todayName);
        if (todayIdx !== -1 && prog.days[todayIdx]) {
          setTodayWorkout(prog.days[todayIdx]);
        }

        // Tomorrow's workout — calculated after sessions load below
        // so we can skip workouts already completed today
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const { data: recentSessions } = await supabase
          .from('workout_sessions')
          .select('name, completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', new Date(todayStr).toISOString())
          .order('completed_at', { ascending: false });

        // Names of workouts already done today
        const completedTodayNames = new Set(
          (recentSessions || []).map(s => s.name?.toLowerCase().trim())
        );

        // Walk through upcoming days (tomorrow, day after, etc.) and find
        // the first scheduled workout that hasn't been done today
        let foundTomorrow = null;
        for (let offset = 1; offset <= 7; offset++) {
          const checkDay = DAYS[(new Date().getDay() + offset) % 7];
          const checkIdx = prog.schedule.indexOf(checkDay);
          if (checkIdx !== -1 && prog.days[checkIdx]) {
            const candidate = prog.days[checkIdx];
            if (!completedTodayNames.has(candidate.name?.toLowerCase().trim())) {
              foundTomorrow = candidate;
              break;
            }
          }
        }
        setTomorrowWorkout(foundTomorrow);
      }

      // Load last 14 days of sessions + sets
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, created_at, name, duration_min, perceived_exertion')
        .eq('user_id', user.id)
        .gte('created_at', twoWeeksAgo.toISOString())
        .order('created_at', { ascending: false });

      if (sessions?.length > 0) {
        // Last session
        setLastSession(sessions[0]);

        // Get all sets from these sessions
        const sessionIds = sessions.map(s => s.id);
        const { data: sets } = await supabase
          .from('completed_sets')
          .select('exercise_name, session_id, created_at')
          .in('session_id', sessionIds);

        if (sets?.length > 0) {
          // Map session_id → created_at
          const sessionDateMap = {};
          sessions.forEach(s => { sessionDateMap[s.id] = new Date(s.created_at); });

          // Calculate last trained date per muscle
          const lastTrainedPerMuscle = {};
          sets.forEach(set => {
            const muscles = getMusclesForExercise(set.exercise_name);
            const sessionDate = sessionDateMap[set.session_id];
            if (!sessionDate) return;
            muscles.forEach(muscle => {
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
              status: getRecoveryStatus(daysSince),
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
            const muscles = getMusclesForExercise(set.exercise_name);
            muscles.forEach(muscle => {
              volume[muscle] = (volume[muscle] || 0) + 1;
            });
          });
          setWeeklyVolume(volume);

          // ── Plateau and deload detection ─────────────────────────────────
          // Pull last 30 days of sets for plateau analysis
          const thirtyDaysAgo = subDays(new Date(), 30);
          const setsWithDates = sets.map(s => ({
            ...s,
            completed_at: sessionDateMap[s.session_id]?.toISOString(),
          })).filter(s => s.completed_at && new Date(s.completed_at) >= thirtyDaysAgo);

          const detectedPlateaus = detectPlateaus(setsWithDates, prof);
          setPlateaus(detectedPlateaus);

          const deload = detectDeloadNeeded(sessions, setsWithDates, prof);
          setDeloadSuggestion(deload);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('TodayScreen error:', err);
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#534AB7" />
    </View>
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}</Text>
        <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMM d')}</Text>
      </View>

      {/* Today's session or rest day */}
      {todayWorkout ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sessionLabel}>TODAY'S SESSION</Text>
          <Text style={styles.sessionName}>{todayWorkout.name}</Text>
          <Text style={styles.sessionFocus}>{todayWorkout.focus}</Text>
          <View style={styles.sessionMeta}>
            <View style={styles.sessionMetaChip}>
              <Text style={styles.sessionMetaText}>{todayWorkout.exercises?.length || 0} exercises</Text>
            </View>
            <View style={styles.sessionMetaChip}>
              <Text style={styles.sessionMetaText}>{todayWorkout.exercises?.reduce((s,e)=>s+e.sets,0) || 0} sets</Text>
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
              <Text style={styles.moreText}>+{todayWorkout.exercises.length - 4} more exercises</Text>
            )}
          </View>
          <Pressable style={styles.startBtn} onPress={() => onStartWorkout && onStartWorkout(todayWorkout)}>
            <Text style={styles.startBtnText}>Start Workout →</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>Rest day</Text>
          <Text style={styles.restSub}>Recovery is when your muscles actually grow. Prioritize sleep and protein today.</Text>
          {tomorrowWorkout && (
            <Pressable style={styles.tomorrowBtn} onPress={() => onPreviewWorkout && onPreviewWorkout(tomorrowWorkout)}>
              <Text style={styles.tomorrowBtnText}>Up next: {tomorrowWorkout.name} →</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Muscle recovery */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Muscle recovery</Text>
        <Text style={styles.sectionSub}>Based on your recent training history</Text>
        <View style={styles.muscleGrid}>
          {Object.entries(MUSCLE_DISPLAY).map(([muscle, label]) => {
            const r = muscleRecovery[muscle];
            const status = r?.status || 'fresh';
            const rc = RECOVERY_COLORS[status];
            return (
              <View key={muscle} style={[styles.muscleChip, { backgroundColor: rc.bg, borderColor: rc.color + '44' }]}>
                <Text style={[styles.muscleChipName, { color: rc.color }]}>{label}</Text>
                <Text style={[styles.muscleChipStatus, { color: rc.color }]}>
                  {status === 'trained_today' ? 'Today'
                    : r?.daysSince === 1 ? '1d ago'
                    : r?.daysSince === 2 ? '2d ago'
                    : r?.daysSince === null ? 'Never'
                    : `${r.daysSince}d ago`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Weekly volume */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This week's volume</Text>
        <Text style={styles.sectionSub}>Sets per muscle — last 7 days</Text>

        {/* Legend */}
        <View style={styles.volumeLegend}>
          <View style={styles.volumeLegendItem}>
            <View style={[styles.volumeLegendDot, { backgroundColor: '#E24B4A' }]} />
            <Text style={styles.volumeLegendLabel}>Below minimum</Text>
          </View>
          <View style={styles.volumeLegendItem}>
            <View style={[styles.volumeLegendDot, { backgroundColor: '#BA7517' }]} />
            <Text style={styles.volumeLegendLabel}>Below optimal</Text>
          </View>
          <View style={styles.volumeLegendItem}>
            <View style={[styles.volumeLegendDot, { backgroundColor: '#1D9E75' }]} />
            <Text style={styles.volumeLegendLabel}>In range</Text>
          </View>
        </View>

        {(() => {
          const junkMuscles = [];
          const rows = Object.entries(MUSCLE_DISPLAY).map(([muscle, label]) => {
            const done = weeklyVolume[muscle] || 0;
            const target = VOLUME_TARGETS[muscle];
            if (!target) return null;
            const junkThreshold = Math.round(target.optimal_high * 1.5);
            const isJunk = done > junkThreshold;
            const isOver = done > target.optimal_high;
            if (isJunk) junkMuscles.push({ label, done, junkThreshold });

            // Bar scale: full width = optimal_high. Min marker at (min/optimal_high)%
            const minMarkerPct = (target.min / target.optimal_high) * 100;
            const fillPct = Math.min(done / target.optimal_high, 1) * 100;
            const overflowPct = isOver
              ? Math.min((done - target.optimal_high) / (junkThreshold - target.optimal_high), 1) * 28
              : 0;

            const fillColor = isJunk ? '#E24B4A'
              : isOver ? '#BA7517'
              : done < target.min ? '#E24B4A'
              : done < target.optimal_low ? '#BA7517'
              : '#1D9E75';

            // Status label shown to right of bar
            const statusText = isJunk ? `${done} ⚠` : `${done}`;
            const statusSub = isJunk ? 'Too much'
              : isOver ? `${done}/${target.optimal_high} ↑`
              : done === 0 ? `0 — aim ${target.min}+`
              : done < target.min ? `${done}/${target.min} min`
              : done < target.optimal_low ? `${done}/${target.optimal_high} opt`
              : `${done}/${target.optimal_high}`;

            return (
              <View key={muscle} style={styles.volumeRow}>
                {/* Muscle name + min/opt labels */}
                <View style={styles.volumeNameCol}>
                  <Text style={styles.volumeMuscleName}>{label}</Text>
                  <Text style={styles.volumeTargetLabel}>
                    Min {target.min} · Opt {target.optimal_low}–{target.optimal_high}
                  </Text>
                </View>

                {/* Bar */}
                <View style={{ flex: 1, position: 'relative' }}>
                  <View style={styles.volumeBarBg}>
                    {/* Main fill */}
                    <View style={[styles.volumeBarFill, { width: `${fillPct}%`, backgroundColor: fillColor }]} />
                    {/* Overflow past optimal */}
                    {isOver && (
                      <View style={[
                        styles.volumeBarOverflow,
                        { width: `${overflowPct}%`, backgroundColor: isJunk ? '#E24B4A55' : '#BA751755' }
                      ]} />
                    )}
                    {/* Minimum threshold tick mark */}
                    <View style={[styles.volumeMinTick, { left: `${minMarkerPct}%` }]} />
                  </View>
                </View>

                {/* Count */}
                <Text style={[styles.volumeCount, { color: fillColor }]}>{statusText}</Text>
              </View>
            );
          });

          return (
            <>
              {rows}
              {junkMuscles.length > 0 && (
                <View style={styles.junkWarning}>
                  <Text style={styles.junkWarningTitle}>⚠ Junk volume</Text>
                  <Text style={styles.junkWarningText}>
                    {junkMuscles.map(m => `${m.label} (${m.done} sets)`).join(', ')} — past the ceiling where extra sets stop building muscle and increase injury risk. Spread that effort to lagging muscles instead.
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
                <Text style={styles.deloadIcon}>
                  {deloadSuggestion.trigger === 'autoreg' ? '⚡' : '🔄'}
                </Text>
              </View>
              <View style={styles.deloadHeaderText}>
                <Text style={styles.deloadTitle}>{deloadSuggestion.headline}</Text>
                <Text style={styles.deloadTrigger}>
                  {deloadSuggestion.trigger === 'autoreg' ? 'Fatigue detected' : `${deloadSuggestion.weeksTraining} weeks of consistent training`}
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
                <Text style={styles.deloadStatLabel}>Sets cut</Text>
              </View>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>
                  {deloadSuggestion.keepIntensity ? 'Same' : '−20%'}
                </Text>
                <Text style={styles.deloadStatLabel}>Weight</Text>
              </View>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>7 days</Text>
                <Text style={styles.deloadStatLabel}>Duration</Text>
              </View>
              <View style={styles.deloadStat}>
                <Text style={styles.deloadStatValue}>3–4</Text>
                <Text style={styles.deloadStatLabel}>RIR target</Text>
              </View>
            </View>

            {/* Diet note (fat loss users only) */}
            {deloadSuggestion.dietNote && (
              <View style={styles.deloadDietNote}>
                <Text style={styles.deloadDietNoteText}>🥗 {deloadSuggestion.dietNote}</Text>
              </View>
            )}

            {/* Instructions */}
            <Text style={styles.deloadInstructionsTitle}>This week:</Text>
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

      {/* Plateau alerts */}
      {plateaus.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plateau detected</Text>
          {plateaus.map((p, i) => (
            <View key={i} style={[styles.plateauCard, p.type === 'confirmed' && styles.plateauCardConfirmed]}>
              <View style={styles.plateauHeader}>
                <Text style={styles.plateauIcon}>{p.type === 'confirmed' ? '🛑' : '⚠️'}</Text>
                <View style={styles.plateauHeaderText}>
                  <Text style={styles.plateauExercise}>{p.exercise}</Text>
                  <Text style={styles.plateauDays}>{p.days} days without progress · Est. 1RM: {p.est1rm}kg</Text>
                </View>
              </View>
              <Text style={styles.plateauMessage}>{p.message}</Text>
              <Text style={styles.plateauFixTitle}>What to do:</Text>
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
          <Text style={styles.sectionTitle}>Last session</Text>
          <Pressable style={styles.lastSessionCard} onPress={openSessionDetail}>
            <View style={styles.lastSessionLeft}>
              <Text style={styles.lastSessionName}>{lastSession.name}</Text>
              <Text style={styles.lastSessionDate}>
                {isToday(new Date(lastSession.created_at)) ? 'Today'
                  : isYesterday(new Date(lastSession.created_at)) ? 'Yesterday'
                  : format(new Date(lastSession.created_at), 'EEE, MMM d')}
              </Text>
            </View>
            <View style={styles.lastSessionRight}>
              {lastSession.duration_min > 0 && (
                <Text style={styles.lastSessionStat}>{lastSession.duration_min} min</Text>
              )}
              {lastSession.perceived_exertion && (
                <Text style={styles.lastSessionRpe}>RPE {lastSession.perceived_exertion}</Text>
              )}
            </View>
          </Pressable>
        </View>
      )}

      {/* Session muscle breakdown modal */}
      <Modal visible={showSessionDetail} transparent animationType="slide" onRequestClose={() => setShowSessionDetail(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSessionDetail(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{lastSession?.name}</Text>
            <Text style={styles.modalSub}>
              {lastSession && (isToday(new Date(lastSession.created_at)) ? 'Today'
                : isYesterday(new Date(lastSession.created_at)) ? 'Yesterday'
                : format(new Date(lastSession.created_at), 'EEE, MMM d'))}
              {lastSession?.duration_min > 0 ? `  ·  ${lastSession.duration_min} min` : ''}
              {lastSession?.perceived_exertion ? `  ·  RPE ${lastSession.perceived_exertion}` : ''}
            </Text>

            <Text style={styles.modalSectionLabel}>SETS PER MUSCLE</Text>
            {sessionMuscles.length === 0 ? (
              <Text style={styles.modalEmpty}>No set data found.</Text>
            ) : (
              (() => {
                const max = sessionMuscles[0]?.sets || 1;
                return sessionMuscles.map(({ muscle, sets }) => (
                  <View key={muscle} style={styles.muscleRow}>
                    <Text style={styles.muscleLabel}>{MUSCLE_DISPLAY[muscle] || muscle}</Text>
                    <View style={styles.muscleBarBg}>
                      <View style={[styles.muscleBarFill, { width: `${(sets / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.muscleCount}>{sets}</Text>
                  </View>
                ));
              })()
            )}

            <Pressable style={styles.modalClose} onPress={() => setShowSessionDetail(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },

  header: { padding: 24, paddingTop: 56 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  dateText: { fontSize: 13, color: '#71717A', marginTop: 2 },

  // Today's session
  sessionCard: { marginHorizontal: 20, backgroundColor: '#1A1830', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#534AB7', marginBottom: 24 },
  sessionLabel: { fontSize: 10, color: '#534AB7', fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  sessionName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.3 },
  sessionFocus: { fontSize: 13, color: '#7F77DD', marginBottom: 12 },
  sessionMeta: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sessionMetaChip: { backgroundColor: '#12121A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#2C2C35' },
  sessionMetaText: { fontSize: 12, color: '#A1A1AA', fontWeight: '500' },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sessionCount: { fontSize: 12, color: '#71717A' },
  startBtn: { backgroundColor: '#534AB7', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  exercisePreview: { borderTopWidth: 0.5, borderTopColor: '#2C2C35', paddingTop: 12, gap: 8 },
  exPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exPreviewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#534AB7' },
  exPreviewName: { fontSize: 13, color: '#FFFFFF', flex: 1 },
  exPreviewDetail: { fontSize: 12, color: '#71717A' },
  moreText: { fontSize: 12, color: '#71717A', paddingLeft: 13 },

  // Rest day
  restCard: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 24 },
  restTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  restSub: { fontSize: 13, color: '#71717A', lineHeight: 20, marginBottom: 14 },
  tomorrowBtn: { borderWidth: 0.5, borderColor: '#534AB7', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tomorrowBtnText: { color: '#534AB7', fontSize: 13, fontWeight: '500' },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4 },
  sectionSub: { fontSize: 11, color: '#71717A', marginBottom: 14 },

  // Muscle recovery grid
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 0.5, minWidth: '30%', flex: 1 },
  muscleChipName: { fontSize: 12, fontWeight: '600' },
  muscleChipStatus: { fontSize: 11, marginTop: 2 },

  // Weekly volume bars
  volumeLegend: { flexDirection: 'row', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
  volumeLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  volumeLegendDot: { width: 7, height: 7, borderRadius: 4 },
  volumeLegendLabel: { fontSize: 10, color: '#71717A' },
  volumeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  volumeNameCol: { width: 76 },
  volumeMuscleName: { fontSize: 12, color: '#E4E4E7', fontWeight: '500' },
  volumeTargetLabel: { fontSize: 10, color: '#A1A1AA', marginTop: 2 },
  volumeBarBg: { flex: 1, height: 7, backgroundColor: '#2C2C35', borderRadius: 4, overflow: 'visible', position: 'relative' },
  volumeBarFill: { height: 7, borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  volumeBarOverflow: { position: 'absolute', right: 0, top: 0, height: 7, borderRadius: 4 },
  volumeMinTick: { position: 'absolute', top: -2, width: 1.5, height: 11, backgroundColor: '#3F3F50', borderRadius: 1 },
  volumeCount: { fontSize: 11, fontWeight: '700', width: 36, textAlign: 'right' },
  junkWarning: { marginTop: 10, backgroundColor: '#1A0E0E', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: '#E24B4A44' },
  junkWarningTitle: { fontSize: 12, fontWeight: '700', color: '#E24B4A', marginBottom: 5 },
  junkWarningText: { fontSize: 11, color: '#A1A1AA', lineHeight: 17 },

  // Deload card
  deloadCard: { backgroundColor: '#13121E', borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: '#534AB766' },
  deloadHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  deloadIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1E1A35', alignItems: 'center', justifyContent: 'center' },
  deloadIcon: { fontSize: 20 },
  deloadHeaderText: { flex: 1 },
  deloadTitle: { fontSize: 16, fontWeight: '700', color: '#C4B8FF', marginBottom: 2 },
  deloadTrigger: { fontSize: 11, color: '#534AB7', fontWeight: '600' },
  deloadReason: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 10, fontStyle: 'italic' },
  deloadMessage: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 14 },
  deloadStats: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  deloadStat: { flex: 1, backgroundColor: '#0F0F18', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  deloadStatValue: { fontSize: 14, fontWeight: '700', color: '#A89FE8', marginBottom: 2 },
  deloadStatLabel: { fontSize: 9, color: '#52525B', textAlign: 'center' },
  deloadDietNote: { backgroundColor: '#0F1A12', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: '#1D9E7533', marginBottom: 12 },
  deloadDietNoteText: { fontSize: 12, color: '#1D9E75', lineHeight: 18 },
  deloadInstructionsTitle: { fontSize: 11, fontWeight: '700', color: '#E4E4E7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  deloadInstruction: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  deloadInstructionNum: { fontSize: 11, fontWeight: '700', color: '#534AB7', width: 16, marginTop: 1 },
  deloadInstructionText: { fontSize: 12, color: '#A1A1AA', lineHeight: 19, flex: 1 },
  deloadScience: { fontSize: 9, color: '#3F3F50', marginTop: 12, fontStyle: 'italic', lineHeight: 14 },

  // Plateau cards
  plateauCard: { backgroundColor: '#1A1510', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#BA751744', marginBottom: 10 },
  plateauCardConfirmed: { backgroundColor: '#1A0E0E', borderColor: '#E24B4A44' },
  plateauHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  plateauIcon: { fontSize: 18, marginTop: 1 },
  plateauHeaderText: { flex: 1 },
  plateauExercise: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  plateauDays: { fontSize: 11, color: '#71717A' },
  plateauMessage: { fontSize: 12, color: '#A1A1AA', lineHeight: 19, marginBottom: 12 },
  plateauFixTitle: { fontSize: 11, fontWeight: '700', color: '#E4E4E7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  plateauIntervention: { fontSize: 12, color: '#A1A1AA', lineHeight: 19, marginBottom: 3, paddingLeft: 4 },
  plateauScience: { fontSize: 9, color: '#3F3F50', marginTop: 10, fontStyle: 'italic', lineHeight: 14 },

  // Last session
  lastSessionCard: { backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastSessionLeft: {},
  lastSessionName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  lastSessionDate: { fontSize: 12, color: '#71717A' },
  lastSessionRight: { alignItems: 'flex-end', gap: 3 },
  lastSessionStat: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  lastSessionRpe: { fontSize: 11, color: '#71717A' },

  // Session detail modal
  modalOverlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#1A1A20', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, borderTopWidth: 0.5, borderColor: '#2C2C35' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  modalSub: { fontSize: 12, color: '#71717A', marginBottom: 20 },
  modalSectionLabel: { fontSize: 10, fontWeight: '700', color: '#52525B', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  modalEmpty: { fontSize: 13, color: '#71717A', marginBottom: 20 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  muscleLabel: { fontSize: 13, color: '#A1A1AA', width: 80 },
  muscleBarBg: { flex: 1, height: 6, backgroundColor: '#2C2C35', borderRadius: 3, overflow: 'hidden' },
  muscleBarFill: { height: 6, backgroundColor: '#534AB7', borderRadius: 3 },
  muscleCount: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', width: 24, textAlign: 'right' },
  modalClose: { marginTop: 20, backgroundColor: '#2C2C35', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCloseText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
});