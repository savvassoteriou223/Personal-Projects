import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { supabase, getCurrentUser } from '../supabase';
import { format, subDays, startOfWeek, differenceInDays } from 'date-fns';

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



const BLOCK_WEEKS = { beginner: 7, intermediate: 5, advanced: 4 };

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
const LEVEL_COLORS = ['#52525B', '#BA7517', '#1D9E75', '#E4E4E8', '#FFFFFF'];

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

function LineChart({ points, color = '#FFFFFF', height = 130, unit = '', rawPoints }) {
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
        <Svg width={w} height={height + 9} viewBox={`0 0 ${w} ${height + 9}`}>
          <Defs>
            <LinearGradient id={`g${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={area} fill={`url(#g${color.replace('#', '')})`} />
          {rawSvg.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} fillOpacity={0.2} />)}
          <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={last.x} cy={last.y} r={5} fill={color} />
          <Circle cx={last.x} cy={last.y} r={10} fill={color} fillOpacity={0.15} />
          <SvgText x={4} y={height + 8} fill="#3F3F50" fontSize={9}>{points[0].x}</SvgText>
          <SvgText x={w - 4} y={height + 8} fill="#3F3F50" fontSize={9} textAnchor="end">{points[points.length - 1].x}</SvgText>
        </Svg>
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
            <Text style={st.bmLift} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
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
          const color = w.count >= 4 ? '#1D9E75' : w.count >= 3 ? '#FFFFFF' : w.count >= 2 ? '#BA7517' : w.count >= 1 ? '#2B3A7A' : '#1A1A20';
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
            <Ionicons
              name={strengthDelta >= 0 ? 'trending-up' : 'warning'}
              size={14}
              color={strengthDelta >= 0 ? '#1D9E75' : '#BA7517'}
              style={{ marginTop: 2 }}
            />
            <Text style={[st.signalTxt, { flex: 1 }]}>
              {strengthDelta >= 0
                ? `Strength up +${strengthDelta.toFixed(1)}kg while weight dropping — recomp working`
                : `Strength dropping ${strengthDelta.toFixed(1)}kg — increase protein or slow the cut`}
            </Text>
          </View>
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

// ─── BLOCK PROGRESS ──────────────────────────────────────────────────────────

function BlockProgressSection({ info }) {
  if (!info) return <Empty text="Start your first workout to begin block tracking" />;
  const totalDays = (BLOCK_WEEKS[info.level] || 5) * 7;
  const daysIn = Math.min(differenceInDays(new Date(), new Date(info.block_start_date)), totalDays);
  const daysLeft = Math.max(totalDays - daysIn, 0);
  const pct = daysIn / totalDays;
  const blockNum = (info.block_index || 0) + 1;
  const endDate = new Date(new Date(info.block_start_date).getTime() + totalDays * 86400000);
  return (
    <View style={{ paddingHorizontal: PAD }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View>
          <Text style={{ fontSize: 26, fontWeight: '200', color: '#FFFFFF', letterSpacing: -0.8 }}>Block {blockNum}</Text>
          <Text style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>
            {format(new Date(info.block_start_date), 'MMM d')} → {format(endDate, 'MMM d')}
          </Text>
        </View>
        <View style={{ backgroundColor: '#1C1C22', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 0.5, borderColor: '#FFFFFF' }}>
          <Text style={{ fontSize: 11, color: '#E4E4E8', fontWeight: '600', textTransform: 'capitalize' }}>{info.level}</Text>
        </View>
      </View>
      <View style={{ height: 6, backgroundColor: '#1A1A20', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ width: `${Math.min(pct, 1) * 100}%`, height: 6, backgroundColor: daysLeft === 0 ? '#1D9E75' : '#FFFFFF', borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 12, color: daysLeft === 0 ? '#1D9E75' : '#52525B' }}>
        {daysLeft === 0
          ? 'Block complete — new exercises load next session'
          : `${daysLeft} days remaining · ${Math.round(pct * 100)}% complete`}
      </Text>
    </View>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);

  const [exercises, setExercises] = useState([]);
  const [selectedEx, setSelectedEx] = useState('');
  const [e1rmByEx, setE1rmByEx] = useState({});
  const [strengthBests, setStrengthBests] = useState({});
  const [weightEntries, setWeightEntries] = useState([]);
  const [proteinAvg, setProteinAvg] = useState(null);
  const [proteinTarget, setProteinTarget] = useState(null);
  const [weeklySessionCounts, setWeeklySessionCounts] = useState([]);
  const [cardioWeeklyCounts, setCardioWeeklyCounts] = useState([]);
  const [cardioDurations, setCardioDurations] = useState([]);
  const [blockInfo, setBlockInfo] = useState(null);
  // Overview stats
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalSets, setTotalSets] = useState(0);
  const [avgDuration, setAvgDuration] = useState(null);
  const [streak, setStreak] = useState(0);
  // RPE trend
  const [rpeWeeks, setRpeWeeks] = useState([]);
  // Most improved
  const [mostImproved, setMostImproved] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles').select('goals, protein_target').eq('id', user.id).single();
      setGoals(profile?.goals || []);
      setProteinTarget(profile?.protein_target || null);

      const since = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      const { data: sessions } = await supabase
        .from('workout_sessions').select('id, started_at, name, duration_min, perceived_exertion')
        .eq('user_id', user.id).gte('started_at', since).order('started_at', { ascending: true });

      const allSess = sessions || [];
      setTotalSessions(allSess.length);

      // Streak — consecutive weeks with at least 1 session
      const weekSet = new Set(allSess.map(s => {
        const ws = startOfWeek(new Date(s.started_at), { weekStartsOn: 1 });
        return ws.toISOString().split('T')[0];
      }));
      const sortedWeeks = [...weekSet].sort().reverse();
      let streakCount = 0;
      let checkDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      for (const wk of sortedWeeks) {
        const wkDate = new Date(wk);
        const diff = Math.round((checkDate - wkDate) / (1000 * 60 * 60 * 24 * 7));
        if (diff <= 1) { streakCount++; checkDate = wkDate; } else break;
      }
      setStreak(streakCount);

      const withDuration = allSess.filter(s => s.duration_min > 0);
      if (withDuration.length) {
        setAvgDuration(Math.round(withDuration.reduce((a, s) => a + s.duration_min, 0) / withDuration.length));
      }

      // RPE per week — last 8 weeks
      const rpeArr = [];
      for (let i = 7; i >= 0; i--) {
        const ws = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
        const we = new Date(ws); we.setDate(we.getDate() + 7);
        const week = allSess.filter(s => { const d = new Date(s.started_at); return d >= ws && d < we && s.perceived_exertion; });
        const avg = week.length ? Math.round(week.reduce((a, s) => a + s.perceived_exertion, 0) / week.length * 10) / 10 : null;
        rpeArr.push({ label: format(ws, 'M/d'), avg, count: week.length });
      }
      setRpeWeeks(rpeArr);

      const ids = allSess.map(s => s.id);
      let sets = [];
      if (ids.length) {
        const { data } = await supabase
          .from('completed_sets').select('exercise_name, weight_kg, reps, session_id').in('session_id', ids);
        sets = data || [];
      }
      setTotalSets(sets.length);

      const sessionMap = {};
      allSess.forEach(s => { sessionMap[s.id] = s; });

      // e1RM per exercise
      const exNames = [...new Set(sets.map(s => s.exercise_name).filter(Boolean))];
      setExercises(exNames);
      const def = exNames.find(n => /bench|squat|deadlift/i.test(n)) || exNames[0] || '';
      setSelectedEx(def);

      const byEx = {}, bests = {};
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

      // Most improved — biggest % e1RM gain, exercises with 3+ data points
      const improved = Object.entries(byEx)
        .filter(([, pts]) => pts.length >= 3)
        .map(([ex, pts]) => {
          const first = pts[0].y, last = pts[pts.length - 1].y;
          const gain = last - first;
          const pct = first > 0 ? (gain / first) * 100 : 0;
          return { ex, first: first.toFixed(1), last: last.toFixed(1), gain: gain.toFixed(1), pct: pct.toFixed(0) };
        })
        .filter(x => parseFloat(x.gain) > 0)
        .sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct))
        .slice(0, 5);
      setMostImproved(improved);

      // Weekly session counts — 8 weeks
      const buildWeekly = (filter) => {
        const arr = [];
        for (let i = 7; i >= 0; i--) {
          const ws = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
          const we = new Date(ws); we.setDate(we.getDate() + 7);
          const count = allSess.filter(s => {
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

      const durPts = allSess
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

      // Block progress
      const { data: block } = await supabase
        .from('program_blocks')
        .select('block_index, block_start_date, level')
        .eq('user_id', user.id)
        .maybeSingle();
      setBlockInfo(block || null);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F13' }} edges={['top']}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#52525B', fontSize: 14 }}>Loading…</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F13' }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}>

        {/* ── OVERVIEW ── */}
        <Section label="Overview">
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                { val: totalSessions, label: 'Sessions', color: '#FFFFFF' },
                { val: totalSets, label: 'Total sets', color: '#E4E4E8' },
                { val: avgDuration ? `${avgDuration}m` : '—', label: 'Avg duration', color: '#1D9E75' },
                { val: `${streak}w`, label: 'Streak', color: streak >= 4 ? '#1D9E75' : streak >= 2 ? '#BA7517' : '#52525B' },
              ].map(({ val, label, color }) => (
                <View key={label} style={st.overviewStat}>
                  <Text style={[st.overviewVal, { color }]}>{val}</Text>
                  <Text style={st.overviewLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {totalSessions === 0 && (
              <Text style={{ fontSize: 12, color: '#71717A', marginTop: 10 }}>
                Complete your first workout to start tracking progress.
              </Text>
            )}
          </Card>
        </Section>

        {/* ── STRENGTH TREND ── */}
        {(isGain || isStrength || isAesthetics) && (
          <Section label="Strength Trend · estimated 1RM"
            verdict={e1rmVerdict(e1rmData, selectedEx)}
            verdictColor={e1rmColor(e1rmData)}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ padding: PAD, paddingBottom: 0 }}>
                <ExPills exercises={exercises} selected={selectedEx} onSelect={setSelectedEx} />
              </View>
              <LineChart points={e1rmData} color="#FFFFFF" height={130} unit=" kg" />
              <View style={{ height: 16 }} />
            </Card>
          </Section>
        )}

        {/* ── MOST IMPROVED ── */}
        {mostImproved.length > 0 && (
          <Section label="Most Improved · last 90 days">
            <Card style={{ gap: 12 }}>
              {mostImproved.map(({ ex, first, last, gain, pct }) => (
                <View key={ex} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#E4E4E8', fontWeight: '500' }} numberOfLines={1}>{ex}</Text>
                    <Text style={{ fontSize: 11, color: '#52525B', marginTop: 2 }}>{first}kg → {last}kg est. 1RM</Text>
                  </View>
                  <View style={{ backgroundColor: '#1D9E7522', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#1D9E7544' }}>
                    <Text style={{ fontSize: 13, color: '#1D9E75', fontWeight: '700' }}>+{pct}%</Text>
                  </View>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* ── STRENGTH BENCHMARKS ── */}
        {isStrength && (
          <Section label="Strength Level"
            verdict={strengthLevelVerdict(strengthBests)}
            verdictColor="#FFFFFF">
            <Card style={{ padding: 0, paddingVertical: 16 }}>
              <BenchmarkCards bests={strengthBests} />
            </Card>
          </Section>
        )}

        {/* ── BODY WEIGHT ── */}
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

        {/* ── RPE TREND ── */}
        {rpeWeeks.some(w => w.avg !== null) && (
          <Section label="Fatigue · avg RPE per week"
            verdict={(() => {
              const filled = rpeWeeks.filter(w => w.avg !== null);
              if (filled.length < 2) return null;
              const last = filled[filled.length - 1].avg;
              const prev = filled[filled.length - 2].avg;
              if (last > 8.5) return `RPE ${last} this week — high fatigue. Consider a deload or lighter session.`;
              if (last > prev + 1) return `RPE rising to ${last} — fatigue accumulating. Watch recovery.`;
              if (last < 6) return `RPE ${last} — sessions feel easy. Push harder or increase load.`;
              return `RPE ${last} — in the optimal training zone. Keep this intensity.`;
            })()}
            verdictColor={(() => {
              const filled = rpeWeeks.filter(w => w.avg !== null);
              if (!filled.length) return undefined;
              const last = filled[filled.length - 1].avg;
              return last > 8.5 ? '#E24B4A' : last > 7 ? '#1D9E75' : '#BA7517';
            })()}>
            <Card style={{ padding: 0, paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4, paddingHorizontal: PAD }}>
                {rpeWeeks.map((w, i) => {
                  const h = w.avg ? Math.max(6, (w.avg / 10) * 64) : 0;
                  const color = w.avg > 8.5 ? '#E24B4A' : w.avg >= 7 ? '#1D9E75' : w.avg >= 5 ? '#BA7517' : '#2C2C35';
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <View style={{ height: h, width: '100%', backgroundColor: color, borderRadius: 4 }} />
                      {w.avg !== null && (
                        <Text style={{ fontSize: 8, color: '#52525B', marginTop: 3 }}>{w.avg}</Text>
                      )}
                      <Text style={{ fontSize: 7, color: '#3F3F50', marginTop: 1 }}>{w.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={{ fontSize: 10, color: '#52525B', paddingHorizontal: PAD, marginTop: 8 }}>
                Scale 1–10 · Rate of Perceived Exertion logged per session
              </Text>
            </Card>
          </Section>
        )}

        {/* ── CARDIO (endurance) ── */}
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

        {/* ── TRAINING BLOCK ── */}
        <Section label="Training Block">
          <Card style={{ padding: 0, paddingVertical: 16 }}>
            <BlockProgressSection info={blockInfo} />
          </Card>
        </Section>

        {/* ── CONSISTENCY ── */}
        <Section label="Training Consistency"
          verdict={consistencyVerdict(weeklySessionCounts)}
          verdictColor={consistencyColor(weeklySessionCounts)}>
          <Card style={{ padding: 0, paddingVertical: 16 }}>
            <ConsistencyBars weeks={weeklySessionCounts} />
          </Card>
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  section: { marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '700', color: '#52525B', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  verdict: { fontSize: 13, color: '#A1A1AA', lineHeight: 19, marginBottom: 10 },
  card: { backgroundColor: '#111114', borderRadius: 18, borderWidth: 0.5, borderColor: '#1E1E28', padding: PAD },
  overviewStat: { flex: 1, minWidth: '40%', backgroundColor: '#0F0F18', borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: '#1E1E28' },
  overviewVal: { fontSize: 28, fontWeight: '200', letterSpacing: -0.5 },
  overviewLabel: { fontSize: 10, color: '#52525B', marginTop: 2, fontWeight: '500' },
  heroNum: { fontSize: 38, fontWeight: '200', color: '#FFFFFF', letterSpacing: -1 },
  heroUnit: { fontSize: 16, color: '#52525B', fontWeight: '300' },
  heroDelta: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  pill: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0F0F18', borderWidth: 0.5, borderColor: '#2C2C35' },
  pillActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  pillTxt: { fontSize: 12, color: '#52525B', fontWeight: '500' },
  pillTxtActive: { color: '#FFFFFF', fontWeight: '700' },
  emptyWrap: { paddingVertical: 28, alignItems: 'center', paddingHorizontal: PAD },
  emptyTxt: { fontSize: 13, color: '#71717A', textAlign: 'center', lineHeight: 20 },
  bmCard: { width: 148, backgroundColor: '#0F0F18', borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: '#1E1E28' },
  bmBadge: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 0.5, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 10 },
  bmBadgeTxt: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bmLift: { fontSize: 11, color: '#52525B', marginBottom: 6 },
  bmVal: { fontSize: 30, fontWeight: '200', color: '#FFFFFF', letterSpacing: -0.8 },
  bmUnit: { fontSize: 14, color: '#52525B', fontWeight: '300' },
  bmSub: { fontSize: 10, color: '#52525B', marginBottom: 10 },
  bmBar: { height: 5, backgroundColor: '#1A1A20', borderRadius: 3, overflow: 'hidden', position: 'relative', marginBottom: 8 },
  bmFill: { height: 5, borderRadius: 3, position: 'absolute', left: 0, top: 0 },
  bmTick: { position: 'absolute', top: 0, width: 1, height: 5, backgroundColor: '#0F0F13' },
  bmNext: { fontSize: 10, color: '#FFFFFF', fontStyle: 'italic' },
  legendTxt: { fontSize: 10, color: '#52525B' },
  signal: { borderRadius: 10, borderWidth: 0.5, padding: 10 },
  signalTxt: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  metaLabel: { fontSize: 12, color: '#71717A' },
  metaVal: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  metaSub: { fontWeight: '400', color: '#52525B' },
  proBar: { height: 5, backgroundColor: '#1A1A20', borderRadius: 3, overflow: 'hidden' },
  proFill: { height: 5, borderRadius: 3 },
  proNote: { fontSize: 10, color: '#52525B', marginTop: 5 },
});