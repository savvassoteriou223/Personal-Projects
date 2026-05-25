import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, getCurrentUser } from '../supabase';
import { generateProgram, getVolumeTargets, detectPlateaus, detectDeloadNeeded, generateDeloadWeek, isBlockComplete, getBlockLength, applyPermanentEdit, applyContraindicationFilters, normalizeEquipment } from './programGenerator';
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
  if (r === 'forearms' || r === 'brachioradialis' || r === 'wrist flexors' || r === 'wrist extensors') return 'forearms';
  return null; // ignore: external rotators on their own, etc.
}

function getMusclesForExercise(exerciseName) {
  const raw = EXERCISE_MUSCLE_MAP[exerciseName?.toLowerCase()] || [];
  const keys = [...new Set(raw.map(normaliseMuscle).filter(Boolean))];
  return keys;
}

// Primary muscle only — for volume counting so rows don't inflate biceps etc.
const EXERCISE_PRIMARY_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(pattern => {
    const primary = normaliseMuscle(pattern.muscles[0]);
    if (primary) pattern.exercises.forEach(ex => { map[ex.name.toLowerCase()] = primary; });
  });
  return map;
})();

function getPrimaryMuscleForExercise(exerciseName) {
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
  fresh:         { color: '#1D9E75', label: 'Primed',        bg: '#1D9E7515' },
  ready:         { color: '#1D9E75', label: 'Ready',         bg: '#1D9E7522' },
  recovering:    { color: '#BA7517', label: 'Recovering',    bg: '#BA751722' },
  trained_today: { color: '#E24B4A', label: 'Trained today', bg: '#E24B4A18' },
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

export default function TodayScreen({ onStartWorkout, onPreviewWorkout }) {
  const [program, setProgram] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayCompleted, setTodayCompleted] = useState(false);
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
  const [blockData, setBlockData] = useState(null);
  const [blockJustRotated, setBlockJustRotated] = useState(false);

  const todayName = DAYS[new Date().getDay()];
  const tomorrowName = DAYS[(new Date().getDay() + 1) % 7];
  const lastLoadedAt = useRef(0);


  const openSessionDetail = async () => {
    if (!lastSession) return;
    const { data: sets } = await supabase
      .from('completed_sets')
      .select('exercise_name')
      .eq('session_id', lastSession.id);

    const muscleCounts = {};
    (sets || []).forEach(s => {
      const primary = getPrimaryMuscleForExercise(s.exercise_name);
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

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) { setLoading(false); return; }

      // Load profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, name, trainingExperience, equipment')
        .eq('id', user.id)
        .single();

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

        let prog = generateProgram(prof, block.block_index, block.block_start_date);

        // Apply any permanent AI coach edits on top of the generated program
        const { data: overrides } = await supabase
          .from('program_template_overrides')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (overrides?.length) {
          const equipment = normalizeEquipment(prof.equipment || []);
          overrides.forEach(o => {
            prog = applyPermanentEdit(prog, {
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

        prog = applyContraindicationFilters(prog, prof);

        setProgram(prog);

        // Today's workout
        const todayIdx = prog.schedule.indexOf(todayName);
        const todayWk = todayIdx !== -1 ? prog.days[todayIdx] : null;
        if (todayWk) setTodayWorkout(todayWk);

        // Tomorrow's workout — calculated after sessions load below
        // so we can skip workouts already completed today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0); // local midnight — avoids UTC offset bug

        const { data: recentSessions } = await supabase
          .from('workout_sessions')
          .select('name, completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', todayStart.toISOString())
          .order('completed_at', { ascending: false });

        // Names of workouts already done today
        const completedTodayNames = new Set(
          (recentSessions || []).map(s => s.name?.toLowerCase().trim())
        );

        setTodayCompleted(!!todayWk && completedTodayNames.has(todayWk.name?.toLowerCase().trim()));

        // Find the next scheduled workout day (always show it so the button is never missing)
        let foundTomorrow = null;
        for (let offset = 1; offset <= 7; offset++) {
          const checkDay = DAYS[(new Date().getDay() + offset) % 7];
          const checkIdx = prog.schedule.indexOf(checkDay);
          if (checkIdx !== -1 && prog.days[checkIdx]) {
            foundTomorrow = prog.days[checkIdx];
            break;
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
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </SafeAreaView>
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
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
          <Text style={styles.blockBannerTitle}>New block started</Text>
          <Text style={styles.blockBannerSub}>
            Your exercises have rotated to keep your body adapting. Same movements, fresh stimulus.
          </Text>
        </View>
      )}

      {/* Block progress pill */}
      {blockData && !blockJustRotated && (
        <View style={styles.blockPill}>
          <Text style={styles.blockPillText}>
            Block {blockData.block_index + 1} · Week {Math.max(1, Math.ceil((Date.now() - new Date(blockData.block_start_date).getTime()) / (7 * 86400000)))} of {getBlockLength(profile?.trainingExperience || 'beginner')}
          </Text>
        </View>
      )}

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
          {todayCompleted ? (
            <>
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>✓ Completed today</Text>
              </View>
              {tomorrowWorkout && (
                <Pressable style={styles.startBtn} onPress={() => onStartWorkout && onStartWorkout({ ...tomorrowWorkout, trainingExperience: profile?.trainingExperience })}>
                  <Text style={styles.startBtnText}>Next up · {tomorrowWorkout.name.split('—')[0].trim()}</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Pressable style={styles.startBtn} onPress={() => onStartWorkout && onStartWorkout({ ...todayWorkout, trainingExperience: profile?.trainingExperience })}>
              <Text style={styles.startBtnText}>Start Workout</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>Rest day</Text>
          <Text style={styles.restSub}>Recovery is when your muscles actually grow. Prioritize sleep and protein today.</Text>
          {tomorrowWorkout && (
            <Pressable style={styles.startBtn} onPress={() => onStartWorkout && onStartWorkout({ ...tomorrowWorkout, trainingExperience: profile?.trainingExperience })}>
              <Text style={styles.startBtnText}>Next up · {tomorrowWorkout.name.split('—')[0].trim()}</Text>
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
                    : r?.daysSince == null ? 'Never'
                    : `${r?.daysSince}d ago`}
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
          const volumeTargets = getVolumeTargets(profile?.trainingExperience);
          const junkMuscles = [];
          const rows = Object.entries(MUSCLE_DISPLAY).map(([muscle, label]) => {
            const done = weeklyVolume[muscle] || 0;
            const target = volumeTargets[muscle];
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
            const statusText = `${done}`;
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
                <View style={styles.volumeBarTrack}>
                  <View style={[styles.volumeBarFill, { width: `${fillPct}%`, backgroundColor: fillColor }]} />
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
                  <View style={styles.junkWarningHeader}>
                    <Ionicons name="warning" size={12} color="#E24B4A" style={{ marginTop: 1 }} />
                    <Text style={styles.junkWarningTitle}>Junk volume</Text>
                  </View>
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
                <Ionicons
                  name={deloadSuggestion.trigger === 'autoreg' ? 'flash' : 'refresh'}
                  size={20}
                  color="#FFFFFF"
                />
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
                <Text style={styles.deloadDietNoteText}>{deloadSuggestion.dietNote}</Text>
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
                <Ionicons
                  name={p.type === 'confirmed' ? 'remove-circle' : 'warning'}
                  size={18}
                  color={p.type === 'confirmed' ? '#E24B4A' : '#BA7517'}
                  style={{ marginTop: 1 }}
                />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },

  header: { padding: 24, paddingTop: 16 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  dateText: { fontSize: 13, color: '#71717A', marginTop: 2 },
  blockBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1D9E7522', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#1D9E75' },
  blockBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1D9E75', marginBottom: 3 },
  blockBannerSub: { fontSize: 12, color: '#A1A1AA', lineHeight: 17 },
  blockPill: { marginHorizontal: 16, marginBottom: 12, alignSelf: 'flex-start', backgroundColor: '#1C1C22', borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 0.5, borderColor: '#FFFFFF' },
  blockPillText: { fontSize: 11, color: '#E4E4E8', fontWeight: '500' },

  // Today's session
  sessionCard: { marginHorizontal: 20, backgroundColor: '#1C1C22', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#FFFFFF', marginBottom: 24 },
  sessionLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  sessionName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.3 },
  sessionFocus: { fontSize: 13, color: '#E4E4E8', marginBottom: 12 },
  sessionMeta: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sessionMetaChip: { backgroundColor: '#12121A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#2C2C35' },
  sessionMetaText: { fontSize: 12, color: '#A1A1AA', fontWeight: '500' },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sessionCount: { fontSize: 12, color: '#71717A' },
  startBtn: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  startBtnText: { color: '#111114', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  completedBadge: { backgroundColor: '#1D9E7522', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: '#1D9E7544' },
  completedBadgeText: { color: '#1D9E75', fontSize: 15, fontWeight: '700' },
  exercisePreview: { borderTopWidth: 0.5, borderTopColor: '#2C2C35', paddingTop: 12, gap: 8 },
  exPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exPreviewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  exPreviewName: { fontSize: 13, color: '#FFFFFF', flex: 1 },
  exPreviewDetail: { fontSize: 12, color: '#71717A' },
  moreText: { fontSize: 12, color: '#71717A', paddingLeft: 13 },

  // Rest day
  restCard: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 24 },
  restTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  restSub: { fontSize: 13, color: '#71717A', lineHeight: 20, marginBottom: 14 },
  tomorrowBtn: { borderWidth: 0.5, borderColor: '#FFFFFF', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tomorrowBtnText: { color: '#111114', fontSize: 13, fontWeight: '500' },

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
  volumeNameCol: { width: 100 },
  volumeMuscleName: { fontSize: 12, color: '#E4E4E7', fontWeight: '500' },
  volumeTargetLabel: { fontSize: 10, color: '#A1A1AA', marginTop: 2 },
  volumeBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#2C2C35' },
  volumeBarFill: { height: 6, borderRadius: 3 },
  volumeCount: { fontSize: 11, fontWeight: '700', width: 36, textAlign: 'right' },
  junkWarning: { marginTop: 10, backgroundColor: '#1A0E0E', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: '#E24B4A44' },
  junkWarningHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  junkWarningTitle: { fontSize: 12, fontWeight: '700', color: '#E24B4A' },
  junkWarningText: { fontSize: 11, color: '#A1A1AA', lineHeight: 17 },

  // Deload card
  deloadCard: { backgroundColor: '#111114', borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: '#FFFFFF66' },
  deloadHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  deloadIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1C1C22', alignItems: 'center', justifyContent: 'center' },
  deloadHeaderText: { flex: 1 },
  deloadTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  deloadTrigger: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  deloadReason: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 10, fontStyle: 'italic' },
  deloadMessage: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 14 },
  deloadStats: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  deloadStat: { flex: 1, backgroundColor: '#0F0F18', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  deloadStatValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  deloadStatLabel: { fontSize: 9, color: '#52525B', textAlign: 'center' },
  deloadDietNote: { backgroundColor: '#0F1A12', borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: '#1D9E7533', marginBottom: 12 },
  deloadDietNoteText: { fontSize: 12, color: '#1D9E75', lineHeight: 18 },
  deloadInstructionsTitle: { fontSize: 11, fontWeight: '700', color: '#E4E4E7', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  deloadInstruction: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  deloadInstructionNum: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', width: 16, marginTop: 1 },
  deloadInstructionText: { fontSize: 12, color: '#A1A1AA', lineHeight: 19, flex: 1 },
  deloadScience: { fontSize: 9, color: '#3F3F50', marginTop: 12, fontStyle: 'italic', lineHeight: 14 },

  // Plateau cards
  plateauCard: { backgroundColor: '#1A1510', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#BA751744', marginBottom: 10 },
  plateauCardConfirmed: { backgroundColor: '#1A0E0E', borderColor: '#E24B4A44' },
  plateauHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  plateauHeaderText: { flex: 1 },
  plateauExercise: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  plateauDays: { fontSize: 11, color: '#71717A' },
  plateauMessage: { fontSize: 12, color: '#A1A1AA', lineHeight: 19, marginBottom: 12 },
  plateauFixTitle: { fontSize: 11, fontWeight: '700', color: '#E4E4E7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  plateauIntervention: { fontSize: 12, color: '#A1A1AA', lineHeight: 19, marginBottom: 3, paddingLeft: 4 },
  plateauScience: { fontSize: 9, color: '#3F3F50', marginTop: 10, fontStyle: 'italic', lineHeight: 14 },

  // Last session
  lastSessionCard: { backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastSessionLeft: { flex: 1, paddingRight: 10 },
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
  muscleBarFill: { height: 6, backgroundColor: '#FFFFFF', borderRadius: 3 },
  muscleCount: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', width: 24, textAlign: 'right' },
  modalClose: { marginTop: 20, backgroundColor: '#2C2C35', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modalCloseText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
});