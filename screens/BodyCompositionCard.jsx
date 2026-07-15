import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { analyseBodyComposition } from './BodyCompositionEngine';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 48; // card padding
const CHART_H = 140;
const PAD = { top: 16, bottom: 28, left: 36, right: 12 };

// ─── MINI LINE CHART ─────────────────────────────────────────────────────────

function WeightChart({ movingAvgs, targetWeight }) {
  const { t } = useTranslation();
  if (!movingAvgs || movingAvgs.length < 2) return null;

  const allRaw = movingAvgs.map(m => m.raw);
  const allAvg = movingAvgs.map(m => m.avg7);
  const allVals = [...allRaw, ...allAvg, targetWeight].filter(Boolean);

  const minVal = Math.min(...allVals) - 0.5;
  const maxVal = Math.max(...allVals) + 0.5;
  const range = maxVal - minVal || 1;

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const xScale = i => PAD.left + (i / (movingAvgs.length - 1)) * plotW;
  const yScale = v => PAD.top + plotH - ((v - minVal) / range) * plotH;

  // Build SVG path for moving average line
  const avgPath = movingAvgs
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(m.avg7).toFixed(1)}`)
    .join(' ');

  // Gradient area under avg line
  const areaPath = [
    `M ${xScale(0).toFixed(1)} ${yScale(movingAvgs[0].avg7).toFixed(1)}`,
    ...movingAvgs.slice(1).map((m, i) => `L ${xScale(i + 1).toFixed(1)} ${yScale(m.avg7).toFixed(1)}`),
    `L ${xScale(movingAvgs.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)}`,
    `L ${xScale(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)}`,
    'Z',
  ].join(' ');

  // Target weight line y position
  const targetY = targetWeight ? yScale(targetWeight) : null;

  // X-axis labels — show first, middle, last date
  const labelIndices = [0, Math.floor(movingAvgs.length / 2), movingAvgs.length - 1];
  const formatDate = d => {
    const date = new Date(d);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  // Y-axis labels
  const yTicks = [minVal + range * 0.1, minVal + range * 0.5, minVal + range * 0.9].map(v => Math.round(v * 10) / 10);

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.25" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Gradient area */}
      <Path d={areaPath} fill="url(#avgGrad)" />

      {/* Raw weight dots */}
      {movingAvgs.map((m, i) => (
        <Circle
          key={`dot-${i}`}
          cx={xScale(i)}
          cy={yScale(m.raw)}
          r={2}
          fill="#3D3D4A"
        />
      ))}

      {/* Target weight dashed line */}
      {targetY && (
        <Line
          x1={PAD.left}
          y1={targetY}
          x2={CHART_W - PAD.right}
          y2={targetY}
          stroke="#1D9E75"
          strokeWidth={1}
          strokeDasharray="4,3"
          opacity={0.6}
        />
      )}
      {targetY && (
        <SvgText
          x={CHART_W - PAD.right - 2}
          y={targetY - 4}
          fontSize={8}
          fill="#1D9E75"
          textAnchor="end"
          opacity={0.8}
        >
          {t('cards.bodyComp.targetSvg')}
        </SvgText>
      )}

      {/* Moving average line */}
      <Path d={avgPath} stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Latest point */}
      <Circle
        cx={xScale(movingAvgs.length - 1)}
        cy={yScale(movingAvgs[movingAvgs.length - 1].avg7)}
        r={4}
        fill="#FFFFFF"
      />

      {/* Y-axis labels */}
      {yTicks.map((tick, i) => (
        <SvgText
          key={`ytick-${i}`}
          x={PAD.left - 4}
          y={yScale(tick) + 3}
          fontSize={8}
          fill="#8A8A94"
          textAnchor="end"
        >
          {tick}
        </SvgText>
      ))}

      {/* X-axis labels */}
      {labelIndices.map(i => (
        <SvgText
          key={`xlabel-${i}`}
          x={xScale(i)}
          y={CHART_H - 4}
          fontSize={8}
          fill="#8A8A94"
          textAnchor="middle"
        >
          {formatDate(movingAvgs[i].date)}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── MAIN CARD ────────────────────────────────────────────────────────────────

export default function BodyCompositionCard({ metrics = [], profile = {} }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const analysis = useMemo(() => analyseBodyComposition(metrics, profile), [metrics, profile]);

  if (!analysis || analysis.dataPoints < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('cards.bodyComp.title')}</Text>
        <Text style={styles.emptyText}>
          {t('cards.bodyComp.empty')}
        </Text>
      </View>
    );
  }

  const { movingAvgs, currentAvg, weeklyRate, trend, pace, projection, waterSpike, muscleLossRisk, excessFatRisk, stalled } = analysis;
  const targetWeight = profile.target_weight_kg;

  const trendLabel = trend === 'cutting' ? t('cards.bodyComp.cutting') : trend === 'gaining' ? t('cards.bodyComp.building') : t('cards.bodyComp.maintaining');
  const trendColor = trend === 'cutting' ? '#FFFFFF' : trend === 'gaining' ? '#1D9E75' : '#9494A0';

  const rateStr = weeklyRate !== null
    ? t('cards.bodyComp.ratePerWeek', { rate: `${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)}` })
    : t('cards.bodyComp.calculating');

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.cardTitle}>{t('cards.bodyComp.title')}</Text>
          <View style={styles.trendRow}>
            <View style={[styles.trendBadge, { borderColor: trendColor + '44' }]}>
              <Text style={[styles.trendLabel, { color: trendColor }]}>{trendLabel}</Text>
            </View>
            <Text style={styles.rateText}>{rateStr}</Text>
          </View>
        </View>
        <View style={styles.currentWeightWrap}>
          <Text style={styles.currentWeight}>{currentAvg}</Text>
          <Text style={styles.currentWeightUnit}>kg avg</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartWrap}>
        <WeightChart movingAvgs={movingAvgs} targetWeight={targetWeight} />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3D3D4A' }]} />
          <Text style={styles.legendText}>{t('cards.bodyComp.dailyWeight')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFFFFF' }]} />
          <Text style={styles.legendText}>{t('cards.bodyComp.sevenDayAverage')}</Text>
        </View>
        {targetWeight && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#1D9E75' }]} />
            <Text style={styles.legendText}>{t('cards.bodyComp.target')}</Text>
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{currentAvg} kg</Text>
          <Text style={styles.statLabel}>{t('cards.bodyComp.avg7')}</Text>
        </View>
        {targetWeight && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.abs(currentAvg - targetWeight).toFixed(1)} kg</Text>
            <Text style={styles.statLabel}>{t('cards.bodyComp.toTarget')}</Text>
          </View>
        )}
        {projection && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{projection.weeks}w</Text>
            <Text style={styles.statLabel}>{projection.targetDate}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Text style={styles.statValue}>{analysis.dataPoints}</Text>
          <Text style={styles.statLabel}>{t('cards.bodyComp.weighIns')}</Text>
        </View>
      </View>

      {/* Pace feedback */}
      {pace && (
        <View style={[styles.paceCard, { borderColor: pace.color + '44' }]}>
          <View style={styles.paceHeader}>
            <View style={[styles.paceDot, { backgroundColor: pace.color }]} />
            <Text style={[styles.paceLabel, { color: pace.color }]}>{pace.label}</Text>
          </View>
          <Text style={styles.paceMessage}>{pace.message}</Text>
        </View>
      )}

      {/* Projection */}
      {projection && (
        <View style={styles.projectionCard}>
          <Text style={styles.projectionText}>
            {t('cards.bodyComp.projection', { target: targetWeight, weeks: projection.weeks, date: projection.targetDate })}
          </Text>
          <Text style={styles.projectionDisclaimer}>
            {t('cards.bodyComp.projectionDisclaimer')}
          </Text>
        </View>
      )}

      {/* Alerts */}
      {waterSpike && (
        <View style={styles.alertCard}>
          <Ionicons name="water" size={18} color="#1D9E75" style={styles.alertIcon} />
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>{t('cards.bodyComp.alerts.waterTitle')}</Text>
            <Text style={styles.alertBody}>
              {t('cards.bodyComp.alerts.waterBody')}
            </Text>
          </View>
        </View>
      )}

      {muscleLossRisk && (
        <View style={[styles.alertCard, styles.alertCardRed]}>
          <Ionicons name="warning" size={18} color="#E85D5C" style={styles.alertIcon} />
          <View style={styles.alertText}>
            <Text style={[styles.alertTitle, styles.alertTitleRed]}>{t('cards.bodyComp.alerts.muscleLossTitle')}</Text>
            <Text style={styles.alertBody}>
              {t('cards.bodyComp.alerts.muscleLossBody')}
            </Text>
          </View>
        </View>
      )}

      {excessFatRisk && (
        <View style={[styles.alertCard, styles.alertCardAmber]}>
          <Ionicons name="trending-up" size={18} color="#BA7517" style={styles.alertIcon} />
          <View style={styles.alertText}>
            <Text style={[styles.alertTitle, styles.alertTitleAmber]}>{t('cards.bodyComp.alerts.gainFastTitle')}</Text>
            <Text style={styles.alertBody}>
              {t('cards.bodyComp.alerts.gainFastBody')}
            </Text>
          </View>
        </View>
      )}

      {stalled && (
        <View style={[styles.alertCard, styles.alertCardAmber]}>
          <Ionicons name="pause-circle" size={18} color="#BA7517" style={styles.alertIcon} />
          <View style={styles.alertText}>
            <Text style={[styles.alertTitle, styles.alertTitleAmber]}>{t('cards.bodyComp.alerts.stalledTitle')}</Text>
            <Text style={styles.alertBody}>
              {t('cards.bodyComp.alerts.stalledBody')}
            </Text>
          </View>
        </View>
      )}

      {/* Science footer */}
      <Text style={styles.scienceFooter}>
        7-day moving average · Pace thresholds: CDC/ACSM consensus, Helms et al., Ribeiro study · Menstrual cycle: Kanellakis et al. (2023)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111114',
    borderRadius: 18,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#2C2C35',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendBadge: {
    borderRadius: 6, borderWidth: 0.5,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  trendLabel: { fontSize: 11, fontWeight: '700' },
  rateText: { fontSize: 12, color: '#9494A0', fontWeight: '500' },
  currentWeightWrap: { alignItems: 'flex-end' },
  currentWeight: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1 },
  currentWeightUnit: { fontSize: 10, color: '#9494A0', marginTop: -2 },

  chartWrap: { marginBottom: 8 },

  legend: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: '#8A8A94' },

  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    backgroundColor: '#0F0F18',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#2C2C35',
  },
  statValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  statLabel: { fontSize: 9, color: '#8A8A94', textAlign: 'center' },

  paceCard: {
    borderRadius: 12, borderWidth: 0.5,
    padding: 12, marginBottom: 10,
    backgroundColor: '#0F0F18',
  },
  paceHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  paceDot: { width: 8, height: 8, borderRadius: 4 },
  paceLabel: { fontSize: 12, fontWeight: '700' },
  paceMessage: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },

  projectionCard: {
    backgroundColor: '#0F1A12',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#1D9E7533',
    padding: 12,
    marginBottom: 10,
  },
  projectionText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 6 },
  projectionHighlight: { color: '#1D9E75', fontWeight: '700' },
  projectionDisclaimer: { fontSize: 10, color: '#8A8A94', fontStyle: 'italic' },

  alertCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#1A1820',
    borderRadius: 12, borderWidth: 0.5, borderColor: '#FFFFFF1A',
    padding: 12, marginBottom: 8,
  },
  alertCardRed: { backgroundColor: '#1A0E0E', borderColor: '#E85D5C44' },
  alertCardAmber: { backgroundColor: '#1A1208', borderColor: '#BA751744' },
  alertIcon: { marginTop: 1 },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  alertTitleRed: { color: '#E85D5C' },
  alertTitleAmber: { color: '#BA7517' },
  alertBody: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },

  emptyText: { fontSize: 13, color: '#9494A0', lineHeight: 20 },
  scienceFooter: { fontSize: 9, color: '#8A8A94', marginTop: 12, fontStyle: 'italic', lineHeight: 14 },
});
