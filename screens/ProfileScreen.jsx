import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Dimensions, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { supabase } from '../supabase';
import { format, startOfWeek, eachDayOfInterval, endOfWeek, subWeeks } from 'date-fns';
import { MOVEMENT_PATTERNS } from './movementLibrary';
import BodyCompositionCard from './BodyCompositionCard';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 140;

const GOALS = [
  { key: 'lose', label: 'Lose fat' },
  { key: 'gain', label: 'Build muscle' },
  { key: 'strength', label: 'Build strength' },
  { key: 'aesthetics', label: 'Aesthetics' },
  { key: 'endurance', label: 'Improve endurance' },
  { key: 'maintain', label: 'Stay healthy' },
];

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs',
];

const MUSCLE_TARGETS = {
  Chest: '10–16 sets/week', Back: '10–16 sets/week',
  Shoulders: '8–12 sets/week', Biceps: '8–12 sets/week',
  Triceps: '8–12 sets/week', Quads: '10–16 sets/week',
  Hamstrings: '8–12 sets/week', Glutes: '8–12 sets/week',
  Calves: '8–14 sets/week', Abs: '6–10 sets/week',
};

// Build exercise → muscles map from movementLibrary (same as TodayScreen)
const _EXERCISE_MUSCLE_MAP = (() => {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(pattern => {
    pattern.exercises.forEach(ex => {
      map[ex.name.toLowerCase()] = pattern.muscles.map(m => m.toLowerCase());
    });
  });
  return map;
})();

function _normaliseMuscle(raw) {
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
  return null;
}

function matchesMuscle(exName, muscle) {
  const raw = _EXERCISE_MUSCLE_MAP[exName?.toLowerCase()] || [];
  const normalised = [...new Set(raw.map(_normaliseMuscle).filter(Boolean))];
  return normalised.includes(muscle.toLowerCase());
}

function MuscleVolumeChart({ data, width }) {
  if (!data || data.length === 0 || !width || width <= 0) return null;

  const max = Math.max(...data.map(d => d.sets), 1);
  // Round max up to nearest nice number for clean grid
  const niceMax = max <= 3 ? 4 : max <= 6 ? 8 : max <= 10 ? 12 : max <= 15 ? 16 : Math.ceil(max / 5) * 5;

  const padL = 28;  // y-axis labels
  const padR = 4;
  const padT = 28;  // room for value labels above dots
  const padB = 22;  // day labels
  const svgW = width;
  const svgH = 160;
  const W = svgW - padL - padR;
  const H = svgH - padT - padB;

  const pts = data.map((d, i) => ({
    x: padL + (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W),
    y: padT + H - (d.sets / niceMax) * H,
    sets: d.sets,
    label: d.label,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length-1].x.toFixed(1)} ${padT + H} L ${pts[0].x.toFixed(1)} ${padT + H} Z`;

  // Nice grid values: 0, 25%, 50%, 75%, 100% of niceMax
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    val: Math.round(niceMax * pct),
    y: padT + H - pct * H,
  }));

  return (
    <Svg width={svgW} height={svgH}>
      {/* Y axis line */}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + H} stroke="#3D3D4A" strokeWidth="1" />
      {/* X axis line */}
      <Line x1={padL} y1={padT + H} x2={svgW - padR} y2={padT + H} stroke="#3D3D4A" strokeWidth="1" />

      {/* Grid lines + Y labels */}
      {gridLines.map(({ val, y }, i) => (
        <React.Fragment key={i}>
          {/* Horizontal grid */}
          <Line
            x1={padL} y1={y} x2={svgW - padR} y2={y}
            stroke={i === 0 ? '#3D3D4A' : '#2C2C35'}
            strokeWidth={i === 0 ? 1 : 0.5}
            strokeDasharray={i === 0 ? undefined : '3,4'}
          />
          {/* Y label — right-aligned next to y-axis */}
          <SvgText
            x={padL - 5} y={y + 4}
            fontSize="9" fill={i === 0 ? '#71717A' : '#3D3D4A'}
            textAnchor="end" fontWeight={i === 0 ? 'normal' : 'normal'}
          >{val}</SvgText>
          {/* Tick mark on Y axis */}
          <Line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="#3D3D4A" strokeWidth="1" />
        </React.Fragment>
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill="#534AB7" fillOpacity="0.08" />

      {/* Line */}
      <Path d={linePath} fill="none" stroke="#534AB7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots + value labels + day labels */}
      {pts.map((p, i) => (
        <React.Fragment key={i}>
          {/* Tick on X axis */}
          <Line x1={p.x} y1={padT + H} x2={p.x} y2={padT + H + 4} stroke="#3D3D4A" strokeWidth="1" />

          {/* Day label below x-axis */}
          <SvgText x={p.x} y={svgH - 4} fontSize="10" fill="#71717A" textAnchor="middle">{p.label}</SvgText>

          {/* Dot */}
          <Circle
            cx={p.x} cy={p.y} r="5"
            fill={p.sets > 0 ? '#534AB7' : '#1A1A20'}
            stroke={p.sets > 0 ? '#7B70D8' : '#2C2C35'}
            strokeWidth="2"
          />

          {/* Value label — always above dot, clamped inside SVG */}
          {p.sets > 0 && (
            <SvgText
              x={p.x}
              y={Math.max(14, p.y - 8)}
              fontSize="11" fill="#7B70D8" fontWeight="bold" textAnchor="middle"
            >{p.sets}</SvgText>
          )}
        </React.Fragment>
      ))}
    </Svg>
  );
}

export default function ProfileScreen({ onSignOut }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [prs, setPrs] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState('3');
  const [sessionLength, setSessionLength] = useState('60');
  const [loading, setLoading] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState('Chest');
  const [showMuscleDropdown, setShowMuscleDropdown] = useState(false);
  const [weeklyVolumeData, setWeeklyVolumeData] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [allSets, setAllSets] = useState([]);
  const [chartWidth, setChartWidth] = useState(SCREEN_W - 72);
  const [streak, setStreak] = useState(0);
  // Quick body weight log
  const [quickWeight, setQuickWeight] = useState('');
  const [quickWeightSaved, setQuickWeightSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const baseDate = subWeeks(new Date(), weekOffset);
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
    const data = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const count = allSets.filter(s => {
        if (!s.completed_at) return false;
        return format(new Date(s.completed_at), 'yyyy-MM-dd') === dayStr &&
          matchesMuscle(s.exercise_name, selectedMuscle);
      }).length;
      return { label: format(day, 'EEE'), sets: count };
    });
    setWeeklyVolumeData(data);
  }, [selectedMuscle, weekOffset, allSets]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) {
      setProfile(prof);
      setName(prof.name || '');
      setWeight(prof.weight_kg?.toString() || '');
      setHeight(prof.height_cm?.toString() || '');
      setTargetWeight(prof.target_weight_kg?.toString() || '');
      setSelectedGoals(prof.goals || []);
      setWeeklyWorkouts(prof.weekly_workouts?.toString() || '3');
      setSessionLength(prof.session_length?.toString() || '60');
    }

    const { data: sessionData } = await supabase
      .from('workout_sessions')
      .select('id, completed_at, name, duration_min, perceived_exertion')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (sessionData?.length > 0) {
      setSessions(sessionData);

      // Streak — consecutive weeks where at least 1 session occurred
      const weekSet = new Set(sessionData.map(s => {
        const d = new Date(s.completed_at);
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        return weekStart.toISOString().split('T')[0];
      }));
      const sortedWeeks = [...weekSet].sort().reverse();
      let streakCount = 0;
      let checkDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      for (const wk of sortedWeeks) {
        const wkDate = new Date(wk);
        const diff = Math.round((checkDate - wkDate) / (1000 * 60 * 60 * 24 * 7));
        if (diff <= 1) { streakCount++; checkDate = wkDate; }
        else break;
      }
      setStreak(streakCount);

      const ids = sessionData.map(s => s.id);
      const { data: sets } = await supabase.from('completed_sets')
        .select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);

      if (sets?.length > 0) {
        const prMap = {};
        sets.filter(s => s.weight_kg).forEach(s => {
          if (!prMap[s.exercise_name] || s.weight_kg > prMap[s.exercise_name].weight_kg) prMap[s.exercise_name] = s;
        });
        setPrs(Object.entries(prMap).map(([n, s]) => ({
          name: n, weight_kg: s.weight_kg, reps: s.reps,
          // Epley 1RM estimate
          orm: s.reps && s.reps > 1 ? Math.round(s.weight_kg * (1 + s.reps / 30)) : s.weight_kg,
        })).sort((a,b) => b.weight_kg - a.weight_kg));

        const dateMap = {};
        sessionData.forEach(s => { dateMap[s.id] = s.completed_at; });
        setAllSets(sets.map(s => ({ ...s, completed_at: dateMap[s.session_id] })));
      }
    }

    const { data: bm } = await supabase.from('body_metrics').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(90);
    if (bm) setMetrics(bm);
    setLoading(false);
  };

  const logQuickWeight = async () => {
    const val = parseFloat(quickWeight);
    if (!quickWeight || isNaN(val) || val <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('body_metrics').insert({
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      weight_kg: val,
    });
    setQuickWeightSaved(true);
    setQuickWeight('');
    setTimeout(() => setQuickWeightSaved(false), 2000);
    loadData();
  };

  const saveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({ name, weight_kg: parseFloat(weight)||null, height_cm: parseFloat(height)||null, target_weight_kg: (parseFloat(targetWeight) > 0 ? parseFloat(targetWeight) : null), goals: selectedGoals, weekly_workouts: parseInt(weeklyWorkouts)||3, session_length: parseInt(sessionLength)||60 }).eq('id', user.id);
    setProfile(p => ({ ...p, name, weight_kg: parseFloat(weight), height_cm: parseFloat(height), target_weight_kg: parseFloat(targetWeight), goals: selectedGoals, weekly_workouts: parseInt(weeklyWorkouts), session_length: parseInt(sessionLength) }));
    setEditing(false);
  };

  const toggleGoal = k => setSelectedGoals(p => p.includes(k) ? p.filter(g => g !== k) : [...p, k]);
  const signOut = async () => { await supabase.auth.signOut(); onSignOut?.(); };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account, all workouts, nutrition logs, and progress data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const { error } = await supabase.functions.invoke('delete-account', {});
            if (error) {
              Alert.alert('Error', 'Could not delete account. Please try again or contact support.');
              return;
            }
            await supabase.auth.signOut();
            onSignOut?.();
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.container} />;

  const h = parseFloat(editing ? height : profile?.height_cm);
  const w = parseFloat(editing ? weight : profile?.weight_kg);
  const bmi = h && w ? (w / ((h/100)**2)).toFixed(1) : null;
  const bmiColor = bmi ? (bmi < 18.5 ? '#BA7517' : bmi < 25 ? '#1D9E75' : bmi < 30 ? '#BA7517' : '#E24B4A') : null;
  const totalSets = weeklyVolumeData.reduce((s, d) => s + d.sets, 0);
  const weekLabel = weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Last week' : `${weekOffset}w ago`;

  return (
    <View style={styles.container}>
      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.name || 'No name'}</Text>
            <Text style={styles.profileEmail}>{profile?.email || ''}</Text>
          </View>
          <Pressable onPress={signOut}><Text style={styles.signOut}>Sign out</Text></Pressable>
        </View>
        <View style={styles.statsRow}>
          {[
            { val: profile?.weight_kg || '—', label: 'kg' },
            { val: profile?.height_cm || '—', label: 'cm' },
            { val: bmi || '—', label: 'BMI', color: bmiColor },
            { val: `${streak}w`, label: 'Streak' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={[styles.statVal, s.color && { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.tabRow}>
          {[['profile', 'Profile'], ['data', 'Volume'], ['history', 'History'], ['prs', 'PRs']].map(([key, label]) => (
            <Pressable key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ─── PROFILE TAB ─── */}
      {activeTab === 'profile' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>My profile</Text>
              {!editing
                ? <Pressable onPress={() => setEditing(true)}><Text style={styles.editBtn}>Edit</Text></Pressable>
                : <View style={{ flexDirection: 'row' }}>
                    <Pressable onPress={() => setEditing(false)} style={{ marginRight: 16 }}><Text style={styles.cancelBtn}>Cancel</Text></Pressable>
                    <Pressable onPress={saveProfile}><Text style={styles.saveBtn}>Save</Text></Pressable>
                  </View>
              }
            </View>
            {editing ? (
              <>
                {[['Name', name, setName, 'default'], ['Weight (kg)', weight, setWeight, 'decimal-pad'], ['Height (cm)', height, setHeight, 'decimal-pad'], ['Target weight (kg)', targetWeight, setTargetWeight, 'decimal-pad']].map(([label, val, setter, kb]) => (
                  <View key={label}>
                    <Text style={styles.inputLabel}>{label}</Text>
                    <TextInput style={styles.input} value={val} onChangeText={setter} keyboardType={kb} placeholderTextColor="#3D3D4A" />
                  </View>
                ))}
                <Text style={styles.inputLabel}>Days per week</Text>
                <View style={styles.optionRow}>
                  {[2,3,4,5,6].map(d => (
                    <Pressable key={d} style={[styles.optionBtn, parseInt(weeklyWorkouts)===d && styles.optionBtnActive]} onPress={() => setWeeklyWorkouts(d.toString())}>
                      <Text style={[styles.optionBtnText, parseInt(weeklyWorkouts)===d && styles.optionBtnTextActive]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Session length</Text>
                <View style={styles.optionRow}>
                  {[30,45,60,90,120].map(m => (
                    <Pressable key={m} style={[styles.optionBtn, parseInt(sessionLength)===m && styles.optionBtnActive]} onPress={() => setSessionLength(m.toString())}>
                      <Text style={[styles.optionBtnText, parseInt(sessionLength)===m && styles.optionBtnTextActive]}>{m}m</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Goals</Text>
                <View style={styles.goalsWrap}>
                  {GOALS.map(g => (
                    <Pressable key={g.key} style={[styles.goalChip, selectedGoals.includes(g.key) && styles.goalChipActive]} onPress={() => toggleGoal(g.key)}>
                      <Text style={[styles.goalChipText, selectedGoals.includes(g.key) && styles.goalChipTextActive]}>{g.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.profileField}>Name: <Text style={styles.profileFieldVal}>{profile?.name}</Text></Text>
                <Text style={styles.profileField}>Weight: <Text style={styles.profileFieldVal}>{profile?.weight_kg} kg</Text></Text>
                <Text style={styles.profileField}>Height: <Text style={styles.profileFieldVal}>{profile?.height_cm} cm</Text></Text>
                <Text style={styles.profileField}>Target: <Text style={styles.profileFieldVal}>{profile?.target_weight_kg} kg</Text></Text>
                <Text style={styles.profileField}>Training: <Text style={styles.profileFieldVal}>{profile?.weekly_workouts}×/week · {profile?.session_length} min</Text></Text>
                <View style={[styles.goalsWrap, { marginTop: 8 }]}>
                  {(profile?.goals || []).map(g => (
                    <View key={g} style={styles.goalChipActive}><Text style={styles.goalChipTextActive}>{GOALS.find(x=>x.key===g)?.label||g}</Text></View>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Quick weight log */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Log today's weight</Text>
            <View style={styles.quickWeightRow}>
              <TextInput
                style={styles.quickWeightInput}
                value={quickWeight}
                onChangeText={setQuickWeight}
                placeholder="kg — fasted, same time daily"
                placeholderTextColor="#3D3D4A"
                keyboardType="decimal-pad"
              />
              <Pressable style={[styles.quickWeightBtn, quickWeightSaved && { backgroundColor: '#1D9E75' }]} onPress={logQuickWeight}>
                <Text style={styles.quickWeightBtnText}>{quickWeightSaved ? '✓ Saved' : 'Log'}</Text>
              </Pressable>
            </View>
            <Text style={styles.quickWeightTip}>
              Weigh yourself every morning after waking, before eating. Same conditions each day gives the most accurate trend.
            </Text>
          </View>

          {/* Body composition trend card */}
          <BodyCompositionCard metrics={metrics} profile={profile} />

          {/* Account actions */}
          <View style={styles.accountSection}>
            <Pressable style={styles.deleteAccountBtn} onPress={deleteAccount}>
              <Text style={styles.deleteAccountText}>Delete account</Text>
            </Pressable>
            <Text style={styles.deleteAccountSub}>
              Permanently removes all your data. Cannot be undone.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ─── DATA TAB ─── */}
      {activeTab === 'data' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}>
          <View style={styles.card}>
            {/* Controls row */}
            <View style={styles.dataControlRow}>
              <Pressable style={styles.muscleDropdownBtn} onPress={() => setShowMuscleDropdown(v => !v)}>
                <Text style={styles.muscleDropdownText}>{selectedMuscle}</Text>
                <Text style={styles.dropdownArrow}>{showMuscleDropdown ? '▲' : '▼'}</Text>
              </Pressable>
              <View style={styles.weekNav}>
                <Pressable onPress={() => setWeekOffset(v => v+1)} style={styles.weekNavBtn}>
                  <Text style={styles.weekNavArrow}>‹</Text>
                </Pressable>
                <Text style={styles.weekNavLabel}>{weekLabel}</Text>
                <Pressable onPress={() => setWeekOffset(v => Math.max(0,v-1))} style={[styles.weekNavBtn, weekOffset===0&&{opacity:0.3}]} disabled={weekOffset===0}>
                  <Text style={styles.weekNavArrow}>›</Text>
                </Pressable>
              </View>
            </View>

            {showMuscleDropdown && (
              <View style={styles.dropdownList}>
                {MUSCLE_GROUPS.map(m => (
                  <Pressable key={m} style={[styles.dropdownItem, selectedMuscle===m&&styles.dropdownItemActive]} onPress={() => { setSelectedMuscle(m); setShowMuscleDropdown(false); }}>
                    <Text style={[styles.dropdownItemText, selectedMuscle===m&&styles.dropdownItemTextActive]}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.chartTitleRow}>
              <Text style={styles.chartTitle}>{selectedMuscle} · {weekLabel}</Text>
              <View style={[styles.totalBadge, totalSets === 0 && styles.totalBadgeEmpty]}>
                <Text style={[styles.totalBadgeText, totalSets === 0 && { color: '#71717A' }]}>
                  {totalSets} sets
                </Text>
              </View>
            </View>

            <View
              style={{ width: '100%' }}
              onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
            >
              <MuscleVolumeChart data={weeklyVolumeData} width={chartWidth} />
            </View>

            <View style={styles.targetNote}>
              <Text style={styles.targetNoteText}>Target: {MUSCLE_TARGETS[selectedMuscle]} · Schoenfeld et al. (2017)</Text>
            </View>
          </View>

          {/* Day breakdown bars */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Day breakdown</Text>
            {weeklyVolumeData.map((d, i) => {
              const maxSets = Math.max(...weeklyVolumeData.map(x => x.sets), 1);
              return (
                <View key={i} style={styles.dayBreakRow}>
                  <Text style={styles.dayBreakLabel}>{d.label}</Text>
                  <View style={styles.dayBreakBar}>
                    <View style={[styles.dayBreakFill, { width: `${(d.sets/maxSets)*100}%` }]} />
                  </View>
                  <Text style={[styles.dayBreakSets, d.sets===0&&{color:'#3D3D4A'}]}>{d.sets > 0 ? `${d.sets}s` : '—'}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 'history' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{sessions.length} sessions logged</Text>
            {sessions.length === 0
              ? <Text style={styles.empty}>No sessions yet — complete a workout to see history.</Text>
              : sessions.map((s, i) => (
                <View key={s.id} style={styles.historyRow}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyName}>{s.name}</Text>
                    <Text style={styles.historyDate}>{format(new Date(s.completed_at), 'EEE, MMM d · yyyy')}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    {s.duration_min > 0 && <Text style={styles.historyDuration}>{s.duration_min}m</Text>}
                    {s.perceived_exertion && (
                      <View style={[styles.rpeTag, { backgroundColor: s.perceived_exertion >= 8 ? '#E24B4A22' : '#534AB722' }]}>
                        <Text style={[styles.rpeTagText, { color: s.perceived_exertion >= 8 ? '#E24B4A' : '#534AB7' }]}>
                          RPE {s.perceived_exertion}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            }
          </View>
        </ScrollView>
      )}

      {/* ─── PRs TAB ─── */}
      {activeTab === 'prs' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 4 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal records — {prs.length} exercises</Text>
            {prs.length === 0
              ? <Text style={styles.empty}>No PRs yet — complete workouts to start tracking.</Text>
              : prs.map((pr, i) => (
                <View key={i} style={styles.prRow}>
                  <View style={[styles.prRank, i < 3 && { backgroundColor: i===0?'#BA7517':i===1?'#71717A':'#7B4B2A' }]}>
                    <Text style={styles.prRankText}>{i+1}</Text>
                  </View>
                  <Text style={styles.prName} numberOfLines={1}>{pr.name}</Text>
                  <View style={styles.prValGroup}>
                    <Text style={styles.prWeight}>{pr.weight_kg}kg × {pr.reps || '—'}</Text>
                    {pr.orm && pr.reps > 1 && (
                      <Text style={styles.prOrm}>~{pr.orm}kg 1RM</Text>
                    )}
                  </View>
                </View>
              ))
            }
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { backgroundColor: '#0F0F13', paddingHorizontal: 20, paddingTop: 52 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19, fontWeight: '700', color: '#FFF' },
  profileName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  profileEmail: { fontSize: 12, color: '#71717A', marginTop: 1 },
  signOut: { fontSize: 12, color: '#71717A' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  statVal: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 9, color: '#71717A', marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: -20, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#534AB7' },
  tabText: { fontSize: 12, color: '#71717A', fontWeight: '500' },
  tabTextActive: { color: '#534AB7', fontWeight: '700' },
  card: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginTop: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  editBtn: { fontSize: 13, color: '#534AB7', fontWeight: '500' },
  cancelBtn: { fontSize: 13, color: '#71717A' },
  saveBtn: { fontSize: 13, color: '#1D9E75', fontWeight: '600' },
  inputLabel: { fontSize: 11, color: '#71717A', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#2C2C35', borderRadius: 8, padding: 11, color: '#FFF', fontSize: 14 },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  optionBtn: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  optionBtnActive: { backgroundColor: '#534AB7' },
  optionBtnText: { color: '#71717A', fontSize: 13, fontWeight: '500' },
  optionBtnTextActive: { color: '#FFF' },
  profileField: { fontSize: 13, color: '#71717A', marginBottom: 5 },
  profileFieldVal: { color: '#FFF', fontWeight: '500' },
  goalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { backgroundColor: '#12121A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: '#2C2C35' },
  goalChipActive: { backgroundColor: '#1A1830', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: '#534AB7' },
  goalChipText: { fontSize: 12, color: '#71717A' },
  goalChipTextActive: { fontSize: 12, color: '#7F77DD' },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  metricDate: { fontSize: 12, color: '#71717A', width: 45 },
  metricVal: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  metricSub: { fontSize: 12, color: '#71717A' },
  empty: { fontSize: 13, color: '#71717A' },
  dataControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  muscleDropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2C2C35', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  muscleDropdownText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  dropdownArrow: { fontSize: 9, color: '#71717A' },
  dropdownList: { backgroundColor: '#2C2C35', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14 },
  dropdownItemActive: { backgroundColor: '#1A1830' },
  dropdownItemText: { fontSize: 13, color: '#A1A1AA' },
  dropdownItemTextActive: { color: '#534AB7', fontWeight: '600' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weekNavBtn: { padding: 6 },
  weekNavArrow: { fontSize: 22, color: '#534AB7', fontWeight: '700', lineHeight: 24 },
  weekNavLabel: { fontSize: 11, color: '#71717A', minWidth: 75, textAlign: 'center' },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  chartTitle: { fontSize: 12, color: '#71717A' },
  totalBadge: { backgroundColor: '#1A1830', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#534AB7' },
  totalBadgeEmpty: { borderColor: '#2C2C35', backgroundColor: '#12121A' },
  totalBadgeText: { fontSize: 12, color: '#534AB7', fontWeight: '700' },
  targetNote: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2C2C35' },
  targetNoteText: { fontSize: 11, color: '#71717A', fontStyle: 'italic' },
  dayBreakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  dayBreakLabel: { fontSize: 12, color: '#71717A', width: 30, fontWeight: '500' },
  dayBreakBar: { flex: 1, height: 6, backgroundColor: '#2C2C35', borderRadius: 3, overflow: 'hidden' },
  dayBreakFill: { height: '100%', backgroundColor: '#534AB7', borderRadius: 3 },
  dayBreakSets: { fontSize: 12, color: '#534AB7', fontWeight: '600', width: 22, textAlign: 'right' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  prRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A1830', alignItems: 'center', justifyContent: 'center' },
  prRankText: { fontSize: 10, fontWeight: '700', color: '#534AB7' },
  prName: { fontSize: 13, color: '#FFF', flex: 1 },
  prValGroup: { alignItems: 'flex-end' },
  prWeight: { fontSize: 14, fontWeight: '700', color: '#534AB7' },
  prReps: { fontSize: 12, color: '#71717A' },
  prOrm: { fontSize: 10, color: '#71717A', marginTop: 1 },
  // History tab
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#2C2C35', gap: 10 },
  historyLeft: { flex: 1 },
  historyName: { fontSize: 13, fontWeight: '600', color: '#FFF', marginBottom: 2 },
  historyDate: { fontSize: 11, color: '#71717A' },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyDuration: { fontSize: 12, fontWeight: '600', color: '#A1A1AA' },
  rpeTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  rpeTagText: { fontSize: 10, fontWeight: '600' },
  // Quick weight log
  quickWeightRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickWeightInput: { flex: 1, backgroundColor: '#12121A', borderRadius: 10, padding: 11, color: '#FFF', fontSize: 14, borderWidth: 0.5, borderColor: '#2C2C35' },
  quickWeightBtn: { backgroundColor: '#534AB7', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  quickWeightBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  quickWeightTip: { fontSize: 11, color: '#52525B', lineHeight: 16 },
  accountSection: { paddingHorizontal: 20, paddingBottom: 16, alignItems: 'center' },
  deleteAccountBtn: { paddingVertical: 10 },
  deleteAccountText: { fontSize: 13, color: '#E24B4A', fontWeight: '500' },
  deleteAccountSub: { fontSize: 11, color: '#3F3F50', textAlign: 'center', marginTop: 4 },
});