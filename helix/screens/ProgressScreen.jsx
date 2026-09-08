import {
  useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import { format, subDays, startOfWeek, differenceInDays } from 'date-fns';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';
import VolumePanel from './VolumePanel';
import PRsPanel from './PRsPanel';
import HealthPanel from './HealthPanel';
import { isHealthAvailable } from '../lib/healthService';
import { epley1RM } from '../lib/epley';

const { width: W } = Dimensions.get('window');
const PAD = 20;
const CW = W - PAD * 2;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function epley(w, r) {
  if (!w || !r || r <= 0) return 0;
  const raw = epley1RM(w, r);
  return r === 1 ? raw : Math.round(raw * 10) / 10;
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
const LEVEL_KEYS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite']; // i18n keys (progress.levels.*)
const LEVEL_COLORS = [colors.textFaint, colors.warning, colors.accent, colors.textSecondary, colors.textPrimary];

function getLevel(thresholds, val) {
  if (!thresholds || !val) return -1;
  for (let i = thresholds.length - 1; i >= 0; i--) if (val >= thresholds[i]) return i;
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

function LineChart({ points, color = colors.textPrimary, height = 130, unit = '', rawPoints }) {
  const { t } = useTranslation();
  if (!points || points.length < 2) return <Empty text={t('progress.empty.trend')} />;
  const all = [...points, ...(rawPoints || [])];
  const vals = all.map(p => p.y).filter(v => v != null && !isNaN(v));
  if (!vals.length) return <Empty text={t('progress.empty.trend')} />;
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
        <Text style={[st.heroDelta, { color: delta >= 0 ? colors.accent : colors.danger }]}>
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
          <SvgText x={4} y={height + 8} fill={colors.borderStrong} fontSize={9}>{points[0].x}</SvgText>
          <SvgText x={w - 4} y={height + 8} fill={colors.borderStrong} fontSize={9} textAnchor="end">{points[points.length - 1].x}</SvgText>
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
          <Tappable key={ex} style={[st.pill, ex === selected && st.pillActive]} onPress={() => onSelect(ex)}>
            <Text style={[st.pillTxt, ex === selected && st.pillTxtActive]}>{ex}</Text>
          </Tappable>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── BENCHMARK CARDS ─────────────────────────────────────────────────────────

function BenchmarkCards({ bests }) {
  const { t } = useTranslation();
  const matched = {};
  Object.entries(bests).forEach(([name, val]) => {
    const rule = matchBenchmark(name);
    if (!rule) return;
    if (!matched[rule.label] || val > matched[rule.label].val)
      matched[rule.label] = { val, name, rule };
  });
  const items = Object.values(matched);
  if (!items.length) return <Empty text={t('progress.empty.benchmark')} />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {items.map(({ val, name, rule }) => {
        const li = getLevel(rule.t, val);
        const lc = li >= 0 ? LEVEL_COLORS[li] : colors.textFaint;
        const next = li >= 0 && li < 4 ? rule.t[li + 1] : null;
        const pct = Math.min(val / rule.t[4], 1);
        return (
          <View key={rule.label} style={st.bmCard}>
            <View style={[st.bmBadge, { backgroundColor: lc + '22', borderColor: lc + '55' }]}>
              <Text style={[st.bmBadgeTxt, { color: lc }]}>{t(`progress.levels.${LEVEL_KEYS[li >= 0 ? li : 0]}`)}</Text>
            </View>
            <Text style={st.bmLift} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
            <Text style={st.bmVal}>{val.toFixed(0)}<Text style={st.bmUnit}> kg</Text></Text>
            <Text style={st.bmSub}>{t('progress.benchmark.est1rm')}</Text>
            <View style={st.bmBar}>
              {[1, 2, 3].map(i => <View key={i} style={[st.bmTick, { left: `${(rule.t[i] / rule.t[4]) * 100}%` }]} />)}
              <View style={[st.bmFill, { width: `${pct * 100}%`, backgroundColor: lc }]} />
            </View>
            {next && <Text style={st.bmNext}>{t('progress.benchmark.toLevel', { gap: (next - val).toFixed(0), level: t(`progress.levels.${LEVEL_KEYS[li + 1]}`) })}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── CONSISTENCY BARS ────────────────────────────────────────────────────────

function ConsistencyBars({ weeks }) {
  const { t } = useTranslation();
  if (!weeks.length) return <Empty text={t('progress.empty.noSessions')} />;
  const max = Math.max(...weeks.map(w => w.count), 1);
  return (
    <View style={{ paddingHorizontal: PAD }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 5, marginBottom: 8 }}>
        {weeks.map((w, i) => {
          const h = Math.max(4, (w.count / max) * 64);
          const color = w.count >= 4 ? colors.accent : w.count >= 3 ? colors.textPrimary : w.count >= 2 ? colors.warning : w.count >= 1 ? '#2B3A7A' : colors.surface;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ height: h, width: '100%', backgroundColor: color, borderRadius: 4 }} />
              <Text style={{ fontSize: 8, color: colors.textFaint, marginTop: 4 }}>{w.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── WEIGHT SECTION ───────────────────────────────────────────────────────────

function WeightSection({ entries, proteinAvg, proteinTarget, strengthDelta, showRecompSignal }) {
  const { t } = useTranslation();
  if (!entries || entries.length < 4) return <Empty text={t('progress.empty.weight4days')} />;

  const smoothed = sevenDayMA(entries);
  const maPoints = smoothed.map(d => ({ x: d.date.slice(5), y: d.avg }));
  const rawPoints = entries.map(d => ({ x: d.date.slice(5), y: d.weight_kg }));

  return (
    <View>
      <LineChart points={maPoints} rawPoints={rawPoints} color={colors.accent} height={120} unit=" kg" />
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: PAD, marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 18, height: 2.5, backgroundColor: colors.accent, borderRadius: 1 }} />
          <Text style={st.legendTxt}>{t('progress.weight.sevenDayAvg')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent, opacity: 0.3 }} />
          <Text style={st.legendTxt}>{t('progress.weight.daily')}</Text>
        </View>
      </View>

      {/* Recomp dual signal */}
      {showRecompSignal && strengthDelta !== null && (
        <View style={[st.signal, { marginHorizontal: PAD, marginTop: 12, borderColor: strengthDelta >= 0 ? colors.accentHair : colors.dangerHair }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
            <Ionicons
              name={strengthDelta >= 0 ? 'trending-up' : 'warning'}
              size={14}
              color={strengthDelta >= 0 ? colors.accent : colors.warning}
              style={{ marginTop: 2 }}
            />
            <Text style={[st.signalTxt, { flex: 1 }]}>
              {strengthDelta >= 0
                ? t('progress.weight.recompUp', { delta: strengthDelta.toFixed(1) })
                : t('progress.weight.recompDown', { delta: strengthDelta.toFixed(1) })}
            </Text>
          </View>
        </View>
      )}

      {/* Protein */}
      {proteinAvg !== null && (
        <View style={{ paddingHorizontal: PAD, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={st.metaLabel}>{t('progress.weight.proteinAvg')}</Text>
            <Text style={st.metaVal}>{proteinAvg}g{proteinTarget ? <Text style={st.metaSub}>{t('progress.weight.proteinTargetSuffix', { target: proteinTarget })}</Text> : null}</Text>
          </View>
          <View style={st.proBar}>
            <View style={[st.proFill, {
              width: `${Math.min((proteinAvg / (proteinTarget || 160)) * 100, 100)}%`,
              backgroundColor: proteinAvg >= (proteinTarget || 160) ? colors.accent : colors.danger,
            }]} />
          </View>
          <Text style={st.proNote}>
            {proteinAvg >= (proteinTarget || 160)
              ? t('progress.weight.proteinOk')
              : t('progress.weight.proteinLow', { n: (proteinTarget || 160) - proteinAvg })}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── ACTIONABLE VERDICTS (rule-based) ────────────────────────────────────────

function e1rmVerdict(points, ex, t) {
  if (!points || points.length < 2) return null;
  const delta = points[points.length - 1].y - points[0].y;
  const weeks = points.length;
  if (delta > 0) return t('progress.e1rm.up', { ex, delta: delta.toFixed(1), weeks });
  if (delta < 0) return t('progress.e1rm.down', { ex, delta: Math.abs(delta).toFixed(1) });
  return t('progress.e1rm.stall', { ex });
}

function e1rmColor(points) {
  if (!points || points.length < 2) return undefined;
  const delta = points[points.length - 1].y - points[0].y;
  return delta >= 0 ? colors.accent : colors.danger;
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

function weightVerdict(entries, t) {
  if (!entries || entries.length < 7) return null;
  const smoothed = sevenDayMA(entries);
  const n = smoothed.length;
  const first7 = smoothed.slice(0, Math.min(7, n));
  const last7 = smoothed.slice(-Math.min(7, n));
  const fAvg = first7.reduce((a, b) => a + b.avg, 0) / first7.length;
  const lAvg = last7.reduce((a, b) => a + b.avg, 0) / last7.length;
  const weeks = Math.max(entries.length / 7, 1);
  const rate = (lAvg - fAvg) / weeks;

  if (rate < -1.0) return t('progress.weightV.losingFast', { rate: Math.abs(rate).toFixed(2) });
  if (rate < -0.1) return t('progress.weightV.losingOptimal', { rate: Math.abs(rate).toFixed(2) });
  if (Math.abs(rate) < 0.05) return t('progress.weightV.stable');
  return t('progress.weightV.gaining', { rate: rate.toFixed(2) });
}

function weightVerdictColor(entries) {
  if (!entries || entries.length < 7) return undefined;
  const smoothed = sevenDayMA(entries);
  const n = smoothed.length;
  const first7 = smoothed.slice(0, Math.min(7, n));
  const last7 = smoothed.slice(-Math.min(7, n));
  const rate = (last7.reduce((a,b)=>a+b.avg,0)/last7.length - first7.reduce((a,b)=>a+b.avg,0)/first7.length) / Math.max(entries.length/7,1);
  if (rate < -1.0) return colors.danger;
  if (rate < -0.05) return colors.accent;
  return colors.warning;
}

function consistencyVerdict(weeks, t) {
  const recent = weeks.slice(-4);
  const avg = recent.reduce((a, w) => a + w.count, 0) / Math.max(recent.length, 1);
  if (avg >= 4) return t('progress.consistencyV.excellent', { avg: avg.toFixed(1) });
  if (avg >= 3) return t('progress.consistencyV.solid', { avg: avg.toFixed(1) });
  if (avg >= 2) return t('progress.consistencyV.schedule3', { avg: avg.toFixed(1) });
  return t('progress.consistencyV.low', { avg: avg.toFixed(1) });
}

function consistencyColor(weeks) {
  const recent = weeks.slice(-4);
  const avg = recent.reduce((a, w) => a + w.count, 0) / Math.max(recent.length, 1);
  return avg >= 3 ? colors.accent : avg >= 2 ? colors.warning : colors.danger;
}

function cardioVerdict(weeks, t) {
  const recent = weeks.slice(-4);
  const avg = recent.reduce((a, w) => a + w.count, 0) / Math.max(recent.length, 1);
  if (avg >= 4) return t('progress.cardioV.optimal', { avg: avg.toFixed(1) });
  if (avg >= 3) return t('progress.cardioV.good', { avg: avg.toFixed(1) });
  if (avg >= 2) return t('progress.cardioV.below', { avg: avg.toFixed(1) });
  return t('progress.cardioV.tooLow', { avg: avg.toFixed(1) });
}

function strengthLevelVerdict(bests, t) {
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
    if (gap < closestGap) { closestGap = gap; closestStr = t('progress.strengthLevelV', { gap: gap.toFixed(0), level: t(`progress.levels.${LEVEL_KEYS[li + 1]}`), lift: rule.label }); }
  });
  return closestStr;
}

// ─── BLOCK PROGRESS ──────────────────────────────────────────────────────────

function BlockProgressSection({ info }) {
  const { t } = useTranslation();
  if (!info) return <Empty text={t('progress.empty.blockTracking')} />;
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
          <Text style={{ fontSize: 26, fontWeight: '200', color: colors.textPrimary, letterSpacing: -0.8 }}>{t('progress.block.num', { n: blockNum })}</Text>
          <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>
            {format(new Date(info.block_start_date), 'MMM d')} → {format(endDate, 'MMM d')}
          </Text>
        </View>
        <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.border }}>
          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{t(`levels.${info.level}`, { defaultValue: info.level })}</Text>
        </View>
      </View>
      <View style={{ height: 6, backgroundColor: colors.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ width: `${Math.min(pct, 1) * 100}%`, height: 6, backgroundColor: daysLeft === 0 ? colors.accent : colors.textPrimary, borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 12, color: daysLeft === 0 ? colors.accent : colors.textFaint }}>
        {daysLeft === 0
          ? t('progress.block.complete')
          : t('progress.block.remaining', { days: daysLeft, pct: Math.round(pct * 100) })}
      </Text>
    </View>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function ChartsPanel() {
  const { t } = useTranslation();
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

  useFocusEffect(useCallback(() => { load(); }, []));

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
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
      <Text style={{ color: colors.textFaint, fontSize: 14 }}>{t('progress.loading')}</Text>
    </View>
  );

  return (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}>

        {/* ── OVERVIEW ── */}
        <Section label={t('progress.sections.overview')}>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                { key: 'sessions', val: totalSessions, label: t('progress.overview.sessions'), color: colors.textPrimary },
                { key: 'totalSets', val: totalSets, label: t('progress.overview.totalSets'), color: colors.textSecondary },
                { key: 'avgDuration', val: avgDuration ? `${avgDuration}m` : '—', label: t('progress.overview.avgDuration'), color: colors.accent },
                { key: 'streak', val: `${streak}w`, label: t('progress.overview.streak'), color: streak >= 4 ? colors.accent : streak >= 2 ? colors.warning : colors.textFaint },
              ].map(({ key, val, label, color }) => (
                <View key={key} style={st.overviewStat}>
                  <Text style={[st.overviewVal, { color }]}>{val}</Text>
                  <Text style={st.overviewLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {totalSessions === 0 && (
              <Text style={{ fontSize: 12, color: colors.textSubtle, marginTop: 10 }}>
                {t('progress.overview.empty')}
              </Text>
            )}
          </Card>
        </Section>

        {/* ── STRENGTH TREND ── */}
        {(isGain || isStrength || isAesthetics) && (
          <Section label={t('progress.sections.strengthTrend')}
            verdict={e1rmVerdict(e1rmData, selectedEx, t)}
            verdictColor={e1rmColor(e1rmData)}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <View style={{ padding: PAD, paddingBottom: 0 }}>
                <ExPills exercises={exercises} selected={selectedEx} onSelect={setSelectedEx} />
              </View>
              <LineChart points={e1rmData} color={colors.textPrimary} height={130} unit=" kg" />
              <View style={{ height: 16 }} />
            </Card>
          </Section>
        )}

        {/* ── MOST IMPROVED ── */}
        {mostImproved.length > 0 && (
          <Section label={t('progress.sections.mostImproved')}>
            <Card style={{ gap: 12 }}>
              {mostImproved.map(({ ex, first, last, gain, pct }) => (
                <View key={ex} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }} numberOfLines={1}>{ex}</Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 2 }}>{t('progress.mostImprovedRow', { first, last })}</Text>
                  </View>
                  <View style={{ backgroundColor: colors.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: colors.accentHair }}>
                    <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '700' }}>+{pct}%</Text>
                  </View>
                </View>
              ))}
            </Card>
          </Section>
        )}

        {/* ── STRENGTH BENCHMARKS ── */}
        {isStrength && (
          <Section label={t('progress.sections.strengthLevel')}
            verdict={strengthLevelVerdict(strengthBests, t)}
            verdictColor={colors.textPrimary}>
            <Card style={{ padding: 0, paddingVertical: 16 }}>
              <BenchmarkCards bests={strengthBests} />
            </Card>
          </Section>
        )}

        {/* ── BODY WEIGHT ── */}
        {(isLose || isAesthetics || weightEntries.length >= 5) && (
          <Section label={t('progress.sections.bodyWeight')}
            verdict={weightVerdict(weightEntries, t)}
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
          <Section label={t('progress.sections.fatigue')}
            verdict={(() => {
              const filled = rpeWeeks.filter(w => w.avg !== null);
              if (filled.length < 2) return null;
              const last = filled[filled.length - 1].avg;
              const prev = filled[filled.length - 2].avg;
              if (last > 8.5) return t('progress.rpe.high', { rpe: last });
              if (last > prev + 1) return t('progress.rpe.rising', { rpe: last });
              if (last < 6) return t('progress.rpe.easy', { rpe: last });
              return t('progress.rpe.optimal', { rpe: last });
            })()}
            verdictColor={(() => {
              const filled = rpeWeeks.filter(w => w.avg !== null);
              if (!filled.length) return undefined;
              const last = filled[filled.length - 1].avg;
              return last > 8.5 ? colors.danger : last > 7 ? colors.accent : colors.warning;
            })()}>
            <Card style={{ padding: 0, paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 4, paddingHorizontal: PAD }}>
                {rpeWeeks.map((w, i) => {
                  const h = w.avg ? Math.max(6, (w.avg / 10) * 64) : 0;
                  const color = w.avg > 8.5 ? colors.danger : w.avg >= 7 ? colors.accent : w.avg >= 5 ? colors.warning : colors.border;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <View style={{ height: h, width: '100%', backgroundColor: color, borderRadius: 4 }} />
                      {w.avg !== null && (
                        <Text style={{ fontSize: 8, color: colors.textFaint, marginTop: 3 }}>{w.avg}</Text>
                      )}
                      <Text style={{ fontSize: 7, color: colors.textFaint, marginTop: 1 }}>{w.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={{ fontSize: 10, color: colors.textFaint, paddingHorizontal: PAD, marginTop: 8 }}>
                {t('progress.rpe.scale')}
              </Text>
            </Card>
          </Section>
        )}

        {/* ── CARDIO (endurance) ── */}
        {isEndurance && (
          <>
            <Section label={t('progress.sections.cardioFreq')}
              verdict={cardioVerdict(cardioWeeklyCounts, t)}
              verdictColor={consistencyColor(cardioWeeklyCounts)}>
              <Card style={{ padding: 0, paddingVertical: 16 }}>
                <ConsistencyBars weeks={cardioWeeklyCounts} />
              </Card>
            </Section>
            {cardioDurations.length >= 2 && (
              <Section label={t('progress.sections.sessionDuration')}
                verdict={
                  cardioDurations[cardioDurations.length - 1].y > cardioDurations[0].y
                    ? t('progress.duration.up', { min: cardioDurations[cardioDurations.length-1].y - cardioDurations[0].y })
                    : t('progress.duration.flat')
                }>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <LineChart points={cardioDurations} color={colors.warning} height={100} unit=" min" />
                  <View style={{ height: 16 }} />
                </Card>
              </Section>
            )}
          </>
        )}

        {/* ── TRAINING BLOCK ── */}
        <Section label={t('progress.sections.trainingBlock')}>
          <Card style={{ padding: 0, paddingVertical: 16 }}>
            <BlockProgressSection info={blockInfo} />
          </Card>
        </Section>

        {/* ── CONSISTENCY ── */}
        <Section label={t('progress.sections.consistency')}
          verdict={consistencyVerdict(weeklySessionCounts, t)}
          verdictColor={consistencyColor(weeklySessionCounts)}>
          <Card style={{ padding: 0, paddingVertical: 16 }}>
            <ConsistencyBars weeks={weeklySessionCounts} />
          </Card>
        </Section>

      </ScrollView>
  );
}

// ─── PROGRESS CONTAINER ──────────────────────────────────────────────────────

const PROGRESS_TABS_ALL = ['charts', 'volume', 'prs', 'health'];

export default function ProgressScreen() {
  const { t } = useTranslation();
  const PROGRESS_TABS = isHealthAvailable() ? PROGRESS_TABS_ALL : ['charts', 'volume', 'prs'];
  const [progressTab, setProgressTab] = useState('charts');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={pst.tabRow}>
        {PROGRESS_TABS.map((key) => (
          <Tappable key={key} style={[pst.tab, progressTab === key && pst.tabActive]} onPress={() => setProgressTab(key)}>
            <Text style={[pst.tabText, progressTab === key && pst.tabTextActive]}>{t(`progress.tabs.${key}`)}</Text>
          </Tappable>
        ))}
      </View>

      {progressTab === 'charts' && <ChartsPanel />}
      {progressTab === 'volume' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <VolumePanel />
        </ScrollView>
      )}
      {progressTab === 'prs' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <PRsPanel />
        </ScrollView>
      )}
      {progressTab === 'health' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <HealthPanel />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const pst = StyleSheet.create({
  tabRow: { flexDirection: 'row', backgroundColor: colors.bg, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.textPrimary },
  tabText: { fontSize: 12, color: colors.textSubtle, fontWeight: '500' },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
});

// ─── STYLES ──────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  section: { marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '700', color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  verdict: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 10 },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: 18, borderWidth: 0.5, borderColor: colors.borderSoft, padding: PAD },
  overviewStat: { flex: 1, minWidth: '40%', backgroundColor: colors.bg, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: colors.borderSoft },
  overviewVal: { fontSize: 28, fontWeight: '200', letterSpacing: -0.5 },
  overviewLabel: { fontSize: 10, color: colors.textFaint, marginTop: 2, fontWeight: '500' },
  heroNum: { fontSize: 38, fontWeight: '200', color: colors.textPrimary, letterSpacing: -1 },
  heroUnit: { fontSize: 16, color: colors.textFaint, fontWeight: '300' },
  heroDelta: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  pill: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.border },
  pillActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderActive },
  pillTxt: { fontSize: 12, color: colors.textFaint, fontWeight: '500' },
  pillTxtActive: { color: colors.textPrimary, fontWeight: '700' },
  emptyWrap: { paddingVertical: 28, alignItems: 'center', paddingHorizontal: PAD },
  emptyTxt: { fontSize: 13, color: colors.textSubtle, textAlign: 'center', lineHeight: 20 },
  bmCard: { width: 148, backgroundColor: colors.bg, borderRadius: 16, padding: 14, borderWidth: 0.5, borderColor: colors.borderSoft },
  bmBadge: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 0.5, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 10 },
  bmBadgeTxt: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  bmLift: { fontSize: 11, color: colors.textFaint, marginBottom: 6 },
  bmVal: { fontSize: 30, fontWeight: '200', color: colors.textPrimary, letterSpacing: -0.8 },
  bmUnit: { fontSize: 14, color: colors.textFaint, fontWeight: '300' },
  bmSub: { fontSize: 10, color: colors.textFaint, marginBottom: 10 },
  bmBar: { height: 5, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden', position: 'relative', marginBottom: 8 },
  bmFill: { height: 5, borderRadius: 3, position: 'absolute', left: 0, top: 0 },
  bmTick: { position: 'absolute', top: 0, width: 1, height: 5, backgroundColor: colors.bg },
  bmNext: { fontSize: 10, color: colors.textPrimary, fontStyle: 'italic' },
  legendTxt: { fontSize: 10, color: colors.textFaint },
  signal: { borderRadius: 10, borderWidth: 0.5, padding: 10 },
  signalTxt: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  metaLabel: { fontSize: 12, color: colors.textSubtle },
  metaVal: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  metaSub: { fontWeight: '400', color: colors.textFaint },
  proBar: { height: 5, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' },
  proFill: { height: 5, borderRadius: 3 },
  proNote: { fontSize: 10, color: colors.textFaint, marginTop: 5 },
});