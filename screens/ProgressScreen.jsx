// ProgressScreen.jsx — LiftIQ
// Goal-aware progress metrics. Every section has an ACTIONABLE verdict.
// No AI. Pure rule-based logic from the data.
//
// gain        → e1RM + volume load trend
// strength    → e1RM + benchmark level cards
// lose        → 7-day MA weight + rate + protein
// aesthetics  → e1RM + weight dual-signal
// endurance   → cardio freq + duration
// maintain    → consistency

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { supabase } from '../supabase';
import { format, subDays, startOfWeek } from 'date-fns';
import { MOVEMENT_PATTERNS } from './movementLibrary';

const { width: W } = Dimensions.get('window');
const PAD = 20;
const CW = W - PAD * 2;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function epley(w, r) {
  if (!w || !r || r <= 0) return 0;
  return r === 1 ? w : Math.round(w * (1 + r / 30) * 10) / 10;
}

function sevenDayMA(entries) {
  return entries.map((e, i) => {
    const win = entries.slice(Math.max(0, i - 6), i + 1);
    return { date: e.date, raw: e.weight_kg, avg: Math.round(win.reduce((a, b) => a + b.weight_kg, 0) / win.length * 10) / 10 };
  });
}

function buildMuscleMap() {
  const map = {};
  Object.values(MOVEMENT_PATTERNS).forEach(p =>
    p.exercises.forEach(ex => { map[ex.name.toLowerCase()] = p.muscles?.[0]?.toLowerCase(); })
  );
  return map;
}
const MUSCLE_MAP = buildMuscleMap();

// ─── BENCHMARK MATCHING (fuzzy) ───────────────────────────────────────────────

const BENCHMARK_RULES = [
  { keywords: ['bench'],                                          label: 'Bench Press',    t: [60, 80, 102, 127, 153] },
  { keywords: ['squat'],                                          label: 'Squat',          t: [70, 95, 122, 155, 190] },
  { keywords: ['deadlift'],                                       label: 'Deadlift',       t: [90, 122, 157, 198, 242] },
  { keywords: ['overhead press', 'ohp', 'military', 'shoulder press'], label: 'Overhead Press', t: [35, 47, 61, 78, 97] },
  { keywords: ['barbell row', 'bent.*over row', 'pendlay'],       label: 'Barbell Row',    t: [50, 68, 88, 113, 140] },
];

function matchBenchmark(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  for (const rule of BENCHMARK_RULES) {
    if (rule.keywords.some(k => new RegExp(k).test(n))) return rule;
  }
  return null;
}

const LEVELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'];
const LEVEL_COLORS = ['#52525B', '#BA7517', '#1D9E75', '#7F77DD', '#A89FE8'];

function getLevel(t, val) {
  if (!t || !val) return -1;
  for (let i = t.length - 1; i >= 0; i--) if (val >= t[i]) return i;
  return -1;
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────

function Card({ children, style }) {
  return <View style={[st.card, style]}>{children}</View>;
}

function Section({ label, verdict, verdictColor, children }) {
  return (
    <View style={st.section}>
      <Text style={st.label}>{label}</Text>
      {verdict ? <Text style={[st.verdict, verdictColor && { color: verdictColor }]}>{verdict}</Text> : null}
      {children}
    </View>
  );
}

function Empty({ text }) {
  return <View style={st.emptyWrap}><Text style={st.emptyTxt}>{text}</Text></View>;
}

// ─── LINE CHART ───────────────────────────────────────────────────────────────

function LineChart({ points, color = '#534AB7', height = 130, unit = '', rawPoints }) {
  if (!points || points.length < 2) return <Empty text="Log more sessions to see this trend" />;
  const all = [...points, ...(rawPoints || [])];
  const vals = all.map(p => p.y).filter(v => v != null && !isNaN(v));
  if (!vals.length) return <Empty text="Log more sessions to see this trend" />;
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const w = CW;
  const toX = (i, len) => (i / Math.max(len - 1, 1)) * w;
  const toY = v => height - ((v - min) / range) * (height - 18) + 9;

  const svgPts = points.map((p, i) => ({ x: toX(i, points.length), y: toY(p.y) }));
  let path = `M${svgPts[0].x.toFixed(1)},${svgPts[0].y.toFixed(1)}`;
  for (let i = 1; i < svgPts.length; i++) {
    const p = svgPts[i - 1], c = svgPts[i];
    const cp1x = p.x + (c.x - p.x) * 0.4, cp2x = c.x - (c.x - p.x) * 0.4;
    path += ` C${cp1x.toFixed(1)},${p.y.toFixed(1)} ${cp2x.toFixed(1)},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  const area = `${path} L${svgPts[svgPts.length - 1].x},${height + 9} L0,${height + 9} Z`;
  const last = svgPts[svgPts.length - 1];
  const delta = points[points.length - 1].y - points[0].y;
  const rawSvg = (rawPoints || []).map((p, i) => ({ x: toX(i, rawPoints.length), y: toY(p.y) }));

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: PAD, marginBottom: 10 }}>
        <Text style={st.heroNum}>{points[points.length - 1].y.toFixed(points[points.length - 1].y % 1 === 0 ? 0 : 1)}<Text style={st.heroUnit}>{unit}</Text></Text>
        <Text style={[st.heroDelta, { color: delta >= 0 ? '#1D9E75' : '#E24B4A' }]}>
          {delta >= 0 ? '+' : ''}{delta.toFixed(delta % 1 === 0 ? 0 : 1)}{unit}
        </Text>
      </View>
      <View style={{ height: height + 9, width: w }}>
        <svg width={w} height={height + 9} viewBox={`0 0 ${w} ${height + 9}`}>
          <defs>
            <linearGradient id={`g${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#g${color.slice(1)})`} />
          {rawSvg.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} fillOpacity="0.2" />)}
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last.x} cy={last.y} r="5" fill={color} />
          <circle cx={last.x} cy={last.y} r="10" fill={color} fillOpacity="0.15" />
          <text x="4" y={height + 8} fill="#3F3F50" fontSize="9">{points[0].x}</text>
          <text x={w - 4} y={height + 8} fill="#3F3F50" fontSize="9" textAnchor="end">{points[points.length - 1].x}</text>
        </svg>
      </View>
    </View>
  );
}

// ─── EXERCISE PILLS ───────────────────────────────────────────────────────────

function ExPills({ exercises, selected, onSelect }) {
  if (!exercises.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingRight: 4 }}>
        {exercises.slice(0, 12).map(ex => (
          <Pressable key={ex} style={[st.pill, ex === selected && st.pillActive]} onPress={() => onSelect(ex)}>
            <Text style={[st.pillTxt, ex === selected && st.pillTxtActive]}>{ex}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── BENCHMARK CARDS ─────────────────────────────────────────────────────────

function BenchmarkCards({ bests }) {
  const matched = {};
  Object.entries(bests).forEach(([name, val]) => {
    const rule = matchBenchmark(name);
    if (!rule) return;
    if (!matched[rule.label] || val > matched[rule.label].val)
      matched[rule.label] = { val, name, rule };
  });
  const items = Object.values(matched);
  if (!items.length) return <Empty text="Log Bench Press, Squat or Deadlift to see your strength level" />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {items.map(({ val, name, rule }) => {
        const li = getLevel(rule.t, val);
        const lc = li >= 0 ? LEVEL_COLORS[li] : '#52525B';
        const next = li >= 0 && li < 4 ? rule.t[li + 1] : null;
        const pct = Math.min(val / rule.t[4], 1);
        return (
          <View key={rule.label} style={st.bmCard}>
            <View style={[st.bmBadge, { backgroundColor: lc + '22', borderColor: lc + '55' }]}>
              <Text style={[st.bmBadgeTxt, { color: lc }]}>{li >= 0 ? LEVELS[li] : 'Beginner'}</Text>
            </View>
            <Text style={st.bmLift} numberOfLines={1}>{name}</Text>
            <Text style={st.bmVal}>{val.toFixed(0)}<Text style={st.bmUnit}> kg</Text></Text>
            <Text style={st.bmSub}>est. 1RM</Text>
            <View style={st.bmBar}>
              {[1, 2, 3].map(i => <View key={i} style={[st.bmTick, { left: `${(rule.t[i] / rule.t[4]) * 100}%` }]} />)}
              <View style={[st.bmFill, { width: `${pct * 100}%`, backgroundColor: lc }]} />
            </View>
            {next && <Text style={st.bmNext}>{(next - val).toFixed(0)}kg to {LEVELS[li + 1]}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── CONSISTENCY BARS ────────────────────────────────────────────────────────

function ConsistencyBars({ weeks }) {
  if (!weeks.length) return <Empty text="No sessions logged yet" />;
  const max = Math.max(...weeks.map(w => w.count), 1);
  return (
    <View style={{ paddingHorizontal: PAD }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 5, marginBottom: 8 }}>
        {weeks.map((w, i) => {
          const h = Math.max(4, (w.count / max) * 64);
          const color = w.count >= 4 ? '#1D9E75' : w.count >= 3 ? '#534AB7' : w.count >= 2 ? '#BA7517' : w.count >= 1 ? '#2B3A7A' : '#1A1A20';
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ height: h, width: '100%', backgroundColor: color, borderRadius: 4 }} />
              <Text style={{ fontSize: 8, color: '#3F3F50', marginTop: 4 }}>{w.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── WEIGHT SECTION ───────────────────────────────────────────────────────────

function WeightSection({ entries, proteinAvg, proteinTarget, strengthDelta, showRecompSignal }) {
  if (!entries || entries.length < 4) return <Empty text="Log body weight for at least 4 days" />;

  const smoothed = sevenDayMA(entries);
  const maPoints = smoothed.map(d => ({ x: d.date.slice(5), y: d.avg }));
  const rawPoints = entries.map(d => ({ x: d.date.slice(5), y: d.weight_kg }));

  return (
    <View>
      <LineChart points={maPoints} rawPoints={rawPoints} color="#1D9E75" height={120} unit=" kg" />
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: PAD, marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 18, height: 2.5, backgroundColor: '#1D9E75', borderRadius: 1 }} />
          <Text style={st.legendTxt}>7-day avg</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#1D9E75', opacity: 0.3 }} />
          <Text style={st.legendTxt}>Daily</Text>
        </View>
      </View>

      {/* Recomp dual signal */}
      {showRecompSignal && strengthDelta !== null && (
        <View style={[st.signal, { marginHorizontal: PAD, marginTop: 12, borderColor: strengthDelta >= 0 ? '#1D9E7444' : '#E24B4A44' }]}>
          <Text style={st.signalTxt}>
            {strengthDelta >= 0
              ? `💪 Strength up +${strengthDelta.toFixed(1)}kg while weight dropping — recomp working`
              : `⚠ Strength dropping ${strengthDelta.toFixed(1)}kg — increase protein or slow the cut`}
          </Text>
        </View>
      )}

      {/* Protein */}
      {proteinAvg !== null && (
        <View style={{ paddingHorizontal: PAD, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={st.metaLabel}>Protein · 7-day avg</Text>
            <Text style={st.metaVal}>{proteinAvg}g{proteinTarget ? <Text style={st.metaSub}>/{proteinTarget}g target</Text> : null}</Text>
          </View>
          <View style={st.proBar}>
            <View style={[st.proFill, {
              width: `${Math.min((proteinAvg / (proteinTarget || 160)) * 100, 100)}%`,
              backgroundColor: proteinAvg >= (proteinTarget || 160) ? '#1D9E75' : '#E24B4A',
            }]} />
          </View>
          <Text style={st.proNote}>
            {proteinAvg >= (proteinTarget || 160)
              ? '✓ Lean mass preservation secured'
              : `${(proteinTarget || 160) - proteinAvg}g below target — muscle loss risk`}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── ACTIONABLE VERDICTS (rule-based) ────────────────────────────────────────

function e1rmVerdict(points, ex) {
  if (!points || points.length < 2) return null;
  const delta = points[points.length - 1].y - points[0].y;
  const weeks = points.length;
  const ratePerWeek = delta / Math.max(weeks, 1);
  if (delta > 0) return `Add weight next ${ex} session — ${delta.toFixed(1)}kg gained over ${weeks} sessions.`;
  if (delta < 0) return `${ex} is down ${Math.abs(delta).toFixed(1)}kg — check sleep, calories, or reduce fatigue.`;
  return `${ex} stalled. Try adding 1 rep per set before adding weight.`;
}

function e1rmColor(points) {
  if (!points || points.length < 2) return undefined;
  const delta = points[points.length - 1].y - points[0].y;
  return delta >= 0 ? '#1D9E75' : '#E24B4A';
}

function volumeVerdict(points) {
  if (!points || points.length < 2) return null;
  const last = points[points.length - 1].y;
  const prev = points[points.length - 2].y;
  const pct = prev > 0 ? Math.round((last - prev) / prev * 100) : 0;
  if (pct >= 10) return `Volume up ${pct}% — keep progressive overload going next session.`;
  if (pct <= -15) return `Volume dropped ${Math.abs(pct)}% — if not a planned deload, increase sets next session.`;
  return `Volume steady. Add 1 set to a lagging muscle group next session.`;
}

function weightVerdict(entries) {
  if (!entries || entries.length < 7) return null;
  const smoothed = sevenDayMA(entries);
  const n = smoothed.length;
  const first7 = smoothed.slice(0, Math.min(7, n));
  const last7 = smoothed.slice(-Math.min(7, n));
  const fAvg = first7.reduce((a, b) => a + b.avg, 0) / first7.length;
  const lAvg = last7.reduce((a, b) => a + b.avg, 0) / last7.length;
  const weeks = Math.max(entries.length / 7, 1);
  const rate = (lAvg - fAvg) / weeks;

  if (rate < -1.0) return `Losing ${Math.abs(rate).toFixed(2)}kg/week — too fast. Eat 200–300 more calories to protect muscle.`;
  if (rate < -0.1) return `Losing ${Math.abs(rate).toFixed(2)}kg/week — optimal range. Keep this deficit.`;
  if (Math.abs(rate) < 0.05) return `Weight stable. Reduce calories by 200/day or add one cardio session to restart fat loss.`;
  return `Gaining ${rate.toFixed(2)}kg/week. Check if this is intentional bulk — if not, reduce calories.`;
}

function weightVerdictColor(entries) {
  if (!entries || entries.length < 7) return undefined;
  const smoothed = sevenDayMA(entries);
  const n = smoothed.length;
  const first7 = smoothed.slice(0, Math.min(7, n));
  const last7 = smoothed.slice(-Math.min(7, n));
  const rate = (last7.reduce((a,b)=>a+b.avg,0)/last7.length - first7.reduce((a,b)=>a+b.avg,0)/first7.length) / Math.max(entries.length/7,1);
  if (rate < -1.0) return '#E24B4A';
  if (rate < -0.05) return '#1D9E75';
  return '#BA7517';
}

function consistencyVerdict(weeks) {
  const recent = weeks.slice(-4);
  const avg = recent.reduce((a, w) => a + w.count, 0) / Math.max(recent.length, 1);
  if (avg >= 4) return `${avg.toFixed(1)} sessions/week — excellent. Maintain this frequency.`;
  if (avg >= 3) return `${avg.toFixed(1)} sessions/week — solid. Add one session to accelerate progress.`;
  if (avg >= 2) return `${avg.toFixed(1)} sessions/week — schedule a 3rd session this week.`;
  return `${avg.toFixed(1)} sessions/week — consistency is your #1 problem right now. Book 3 sessions this week.`;
}

function consistencyColor(weeks) {
  const recent = weeks.slice(-4);
  const avg = recent.reduce((a, w) => a + w.count, 0) / Math.max(recent.length, 1);
  return avg >= 3 ? '#1D9E75' : avg >= 2 ? '#BA7517' : '#E24B4A';
}

function cardioVerdict(weeks) {
  const recent = weeks.slice(-4);
  const avg = recent.reduce((a, w) => a + w.count, 0) / Math.max(recent.length, 1);
  if (avg >= 4) return `${avg.toFixed(1)} sessions/week — in the optimal VO₂max range. Maintain.`;
  if (avg >= 3) return `${avg.toFixed(1)} sessions/week — good. Add 1 more to maximise cardiorespiratory adaptation.`;
  if (avg >= 2) return `${avg.toFixed(1)} sessions/week — below optimal. Schedule a 3rd cardio session this week.`;
  return `${avg.toFixed(1)} sessions/week — too low for endurance gains. Target 3–5 sessions/week minimum.`;
}

function strengthLevelVerdict(bests) {
  const matched = {};
  Object.entries(bests).forEach(([name, val]) => {
    const rule = matchBenchmark(name);
    if (!rule) return;
    if (!matched[rule.label] || val > matched[rule.label].val)
      matched[rule.label] = { val, rule };
  });
  const items = Object.values(matched);
  if (!items.length) return null;
  // Find the closest to next level
  let closestGap = Infinity, closestStr = null;
  items.forEach(({ val, rule }) => {
    const li = getLevel(rule.t, val);
    if (li < 0 || li >= 4) return;
    const gap = rule.t[li + 1] - val;
    if (gap < closestGap) { closestGap = gap; closestStr = `${gap.toFixed(0)}kg from ${LEVELS[li + 1]} on ${rule.label} — focus here.`; }
  });
  return closestStr;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);

  const [exercises, setExercises] = useState([]);
  const [selectedEx, setSelectedEx] = useState('');
  const [e1rmByEx, setE1rmByEx] = useState({});
  const [strengthBests, setStrengthBests] = useState({});
  const [volumeLoadPoints, setVolumeLoadPoints] = useState([]);
  const [weightEntries, setWeightEntries] = useState([]);
  const [proteinAvg, setProteinAvg] = useState(null);
  const [proteinTarget, setProteinTarget] = useState(null);
  const [weeklySessionCounts, setWeeklySessionCounts] = useState([]);
  const [cardioWeeklyCounts, setCardioWeeklyCounts] = useState([]);
  const [cardioDurations, setCardioDurations] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles').select('goals, protein_target').eq('id', user.id).single();
      setGoals(profile?.goals || []);
      setProteinTarget(profile?.protein_target || null);

      const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      const { data: sessions } = await supabase
        .from('workout_sessions').select('id, started_at, name, duration_min')
        .eq('user_id', user.id).gte('started_at', since).order('started_at', { ascending: true });

      const ids = (sessions || []).map(s => s.id);
      let sets = [];
      if (ids.length) {
        const { data } = await supabase
          .from('completed_sets').select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);
        sets = data || [];
      }
      const sessionMap = {};
      (sessions || []).forEach(s => { sessionMap[s.id] = s; });

      // e1RM + volume load
      const exNames = [...new Set(sets.map(s => s.exercise_name).filter(Boolean))];
      setExercises(exNames);
      const def = exNames.find(n => /bench|squat|deadlift/i.test(n)) || exNames[0] || '';
      setSelectedEx(def);

      const byEx = {}, bests = {};
      const sessVol = {};
      sets.forEach(s => {
        if (s.weight_kg && s.reps) sessVol[s.session_id] = (sessVol[s.session_id] || 0) + s.weight_kg * s.reps;
      });

      exNames.forEach(ex => {
        const byDate = {};
        sets.filter(s => s.exercise_name === ex && s.weight_kg && s.reps).forEach(s => {
          const sess = sessionMap[s.session_id]; if (!sess) return;
          const dk = format(new Date(sess.started_at), 'MMM d');
          const er = epley(s.weight_kg, s.reps);
          if (!byDate[dk] || byDate[dk] < er) byDate[dk] = er;
        });
        const pts = Object.entries(byDate).map(([x, y]) => ({ x, y }));
        if (pts.length) byEx[ex] = pts;
        const best = Math.max(...Object.values(byDate), 0);
        if (best > 0) bests[ex] = best;
      });
      setE1rmByEx(byEx);
      setStrengthBests(bests);

      const volPts = (sessions || []).filter(s => sessVol[s.id]).map(s => ({
        x: format(new Date(s.started_at), 'MMM d'),
        y: Math.round(sessVol[s.id]),
      }));
      setVolumeLoadPoints(volPts);

      // Weekly counts — 8 weeks
      const buildWeekly = (filter) => {
        const arr = [];
        for (let i = 7; i >= 0; i--) {
          const ws = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
          const we = new Date(ws); we.setDate(we.getDate() + 7);
          const count = (sessions || []).filter(s => {
            const d = new Date(s.started_at);
            return d >= ws && d < we && (!filter || filter(s));
          }).length;
          arr.push({ label: format(ws, 'M/d'), count });
        }
        return arr;
      };
      setWeeklySessionCounts(buildWeekly(null));
      const cardioKw = /run|cardio|bike|cycle|swim|row|hiit|treadmill|elliptical/i;
      setCardioWeeklyCounts(buildWeekly(s => cardioKw.test(s.name || '')));

      const durPts = (sessions || [])
        .filter(s => cardioKw.test(s.name || '') && s.duration_min > 0)
        .map(s => ({ x: format(new Date(s.started_at), 'MMM d'), y: s.duration_min }));
      setCardioDurations(durPts);

      // Body weight
      const { data: metrics } = await supabase
        .from('body_metrics').select('date, weight_kg').eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), 60), 'yyyy-MM-dd')).order('date', { ascending: true });
      setWeightEntries(metrics || []);

      // Protein
      const { data: nutr } = await supabase
        .from('nutrition_logs').select('protein_g, date').eq('user_id', user.id)
        .gte('date', format(subDays(new Date(), 7), 'yyyy-MM-dd'));
      if (nutr?.length) {
        const dm = {};
        nutr.forEach(n => { dm[n.date] = (dm[n.date] || 0) + (n.protein_g || 0); });
        const days = Object.keys(dm).length;
        setProteinAvg(days ? Math.round(Object.values(dm).reduce((a, b) => a + b, 0) / days) : null);
      }
    } catch (e) { console.error('ProgressScreen:', e); }
    finally { setLoading(false); }
  };

  const has = k => Array.isArray(k) ? k.some(x => goals.includes(x)) : goals.includes(k);
  const isGain      = has('gain') || !goals.length;
  const isStrength  = has('strength') || !goals.length;
  const isLose      = has('lose');
  const isAesthetics = has('aesthetics');
  const isEndurance = has('endurance');
  const isMaintain  = has('maintain') || (!isLose && !isEndurance && !goals.length);

  const e1rmData = e1rmByEx[selectedEx] || [];
  const strengthDelta = e1rmData.length >= 2 ? e1rmData[e1rmData.length - 1].y - e1rmData[0].y : null;

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0F0F13', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#3F3F50', fontSize: 14 }}>Loading…</Text>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0F0F13' }}
      contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}>

      {/* e1RM — gain / strength / aesthetics */}
      {(isGain || isStrength || isAesthetics) && (
        <Section label="Strength Trend · e1RM"
          verdict={e1rmVerdict(e1rmData, selectedEx)}
          verdictColor={e1rmColor(e1rmData)}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ padding: PAD, paddingBottom: 0 }}>
              <ExPills exercises={exercises} selected={selectedEx} onSelect={setSelectedEx} />
            </View>
            <LineChart points={e1rmData} color="#534AB7" height={130} unit=" kg" />
            <View style={{ height: 16 }} />
          </Card>
        </Section>
      )}

      {/* Strength level benchmarks */}
      {isStrength && (
        <Section label="Strength Level"
          verdict={strengthLevelVerdict(strengthBests)}
          verdictColor="#A89FE8">
          <Card style={{ padding: 0, paddingVertical: 16 }}>
            <BenchmarkCards bests={strengthBests} />
          </Card>
        </Section>
      )}

      {/* Volume load — gain */}
      {isGain && (
        <Section label="Volume Load · kg × reps per session"
          verdict={volumeVerdict(volumeLoadPoints)}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <LineChart points={volumeLoadPoints} color="#7F77DD" height={110} unit=" kg" />
            <View style={{ height: 16 }} />
          </Card>
        </Section>
      )}

      {/* Weight trend — lose / aesthetics / anyone with weight data */}
      {(isLose || isAesthetics || weightEntries.length >= 5) && (
        <Section label="Body Weight · 7-day average"
          verdict={weightVerdict(weightEntries)}
          verdictColor={weightVerdictColor(weightEntries)}>
          <Card style={{ padding: 0, overflow: 'hidden', paddingVertical: 16 }}>
            <WeightSection
              entries={weightEntries}
              proteinAvg={proteinAvg}
              proteinTarget={proteinTarget}
              strengthDelta={strengthDelta}
              showRecompSignal={isAesthetics}
            />
          </Card>
        </Section>
      )}

      {/* Cardio — endurance */}
      {isEndurance && (
        <>
          <Section label="Cardio Frequency"
            verdict={cardioVerdict(cardioWeeklyCounts)}
            verdictColor={consistencyColor(cardioWeeklyCounts)}>
            <Card style={{ padding: 0, paddingVertical: 16 }}>
              <ConsistencyBars weeks={cardioWeeklyCounts} />
            </Card>
          </Section>
          {cardioDurations.length >= 2 && (
            <Section label="Session Duration"
              verdict={
                cardioDurations[cardioDurations.length - 1].y > cardioDurations[0].y
                  ? `Duration up ${cardioDurations[cardioDurations.length-1].y - cardioDurations[0].y}min since start — aerobic capacity improving.`
                  : `Duration flat. Push 5min longer per session to drive VO₂max gains.`
              }>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <LineChart points={cardioDurations} color="#BA7517" height={100} unit=" min" />
                <View style={{ height: 16 }} />
              </Card>
            </Section>
          )}
        </>
      )}

      {/* Consistency — all goals */}
      {(isMaintain || isGain || isStrength || isLose || isAesthetics) && (
        <Section label="Training Consistency"
          verdict={consistencyVerdict(weeklySessionCounts)}
          verdictColor={consistencyColor(weeklySessionCounts)}>
          <Card style={{ padding: 0, paddingVertical: 16 }}>
            <ConsistencyBars weeks={weeklySessionCounts} />
          </Card>
        </Section>
      )}

    </ScrollView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  section: { marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '700', color: '#3F3F50', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  verdict: { fontSize: 13, color: '#A1A1AA', lineHeight: 19, marginBottom: 10 },
  card: { backgroundColor: '#13121E', borderRadius: 18, borderWidth: 0.5, borderColor: '#1E1E28', padding: PAD },
  heroNum: { fontSize: 38, fontWeight: '200', color: '#FFFFFF', letterSpacing: -1 },
  heroUnit: { fontSize: 16, color: '#52525B', fontWeight: '300' },
  heroDelta: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  pill: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0F0F18', borderWidth: 0.5, borderColor: '#2C2C35' },
  pillActive: { backgroundColor: '#1E1A35', borderColor: '#534AB7' },
  pillTxt: { fontSize: 12, color: '#52525B', fontWeight: '500' },
  pillTxtActive: { color: '#A89FE8', fontWeight: '700' },
  emptyWrap: { paddingVertical: 28, alignItems: 'center', paddingHorizontal: PAD },
  emptyTxt: { fontSize: 13, color: '#3F3F50', fontStyle: 'italic', textAlign: 'center' },
  bmCard: { width: 148, backgroundColor: '#0F0F18', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#1E1E28' },
  bmBadge: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 0.5, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 10 },
  bmBadgeTxt: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bmLift: { fontSize: 11, color: '#52525B', marginBottom: 6 },
  bmVal: { fontSize: 30, fontWeight: '200', color: '#FFFFFF', letterSpacing: -0.8 },
  bmUnit: { fontSize: 14, color: '#52525B', fontWeight: '300' },
  bmSub: { fontSize: 10, color: '#3F3F50', marginBottom: 10 },
  bmBar: { height: 5, backgroundColor: '#1A1A20', borderRadius: 3, overflow: 'hidden', position: 'relative', marginBottom: 8 },
  bmFill: { height: 5, borderRadius: 3, position: 'absolute', left: 0, top: 0 },
  bmTick: { position: 'absolute', top: 0, width: 1, height: 5, backgroundColor: '#0F0F13' },
  bmNext: { fontSize: 10, color: '#534AB7', fontStyle: 'italic' },
  legendTxt: { fontSize: 10, color: '#52525B' },
  signal: { borderRadius: 10, borderWidth: 0.5, padding: 10 },
  signalTxt: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  metaLabel: { fontSize: 12, color: '#71717A' },
  metaVal: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  metaSub: { fontWeight: '400', color: '#52525B' },
  proBar: { height: 5, backgroundColor: '#1A1A20', borderRadius: 3, overflow: 'hidden' },
  proFill: { height: 5, borderRadius: 3 },
  proNote: { fontSize: 10, color: '#3F3F50', marginTop: 5 },
});