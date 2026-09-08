import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

const COLORS = {
  purple: { bar: colors.textPrimary, val: colors.textSecondary, bg: colors.surfaceRaised, border: colors.border },
  teal:   { bar: colors.accent, val: colors.accent, bg: colors.successBg, border: colors.border },
  amber:  { bar: colors.warning, val: colors.warning, bg: colors.warningBg, border: colors.border },
  gray:   { bar: colors.textPrimary, val: colors.textSecondary, bg: colors.surfaceRaised, border: colors.border },
};

const MAX_HEIGHT = 80;
const COL_WIDTH = 60;

export default function StudyChart({ study }) {
  if (!study) return null;

  const c = COLORS[study.color] || COLORS.gray;
  const thisHeight = (study.this_pct / 100) * MAX_HEIGHT;
  const controlHeight = (study.control_pct / 100) * MAX_HEIGHT;

  return (
    <View style={[styles.container, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{study.title}</Text>
        <Text style={styles.meta}>n={study.n} · {study.method}</Text>
      </View>

      <View style={styles.chartArea}>
        <View style={styles.col}>
          <Text style={[styles.colVal, { color: c.val }]}>{study.this_val}</Text>
          <View style={styles.barArea}>
            <View style={[styles.colBar, { height: thisHeight, backgroundColor: c.bar }]} />
          </View>
          <Text style={styles.colLabel}>{study.this_label}</Text>
        </View>

        <View style={styles.col}>
          <Text style={styles.colValControl}>{study.control_val}</Text>
          <View style={styles.barArea}>
            <View style={[styles.colBar, { height: controlHeight, backgroundColor: colors.borderStrong }]} />
          </View>
          <Text style={styles.colLabel}>{study.control_label}</Text>
        </View>
      </View>

      <View style={styles.baseline} />
      <Text style={styles.cite}>{study.cite}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, borderWidth: 0.5, padding: 12, marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 11, fontWeight: '500', color: colors.textMuted, flex: 1 },
  meta: { fontSize: 10, color: colors.textFaint },
  chartArea: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  col: { width: COL_WIDTH, alignItems: 'center' },
  colVal: { fontSize: 14, fontWeight: '600', height: 24, textAlignVertical: 'bottom', textAlign: 'center' },
  colValControl: { fontSize: 14, fontWeight: '600', color: colors.textSubtle, height: 24, textAlignVertical: 'bottom', textAlign: 'center' },
  barArea: { width: COL_WIDTH, height: MAX_HEIGHT, justifyContent: 'flex-end' },
  colBar: { width: COL_WIDTH, borderRadius: 4 },
  colLabel: { fontSize: 10, color: colors.textSubtle, marginTop: 6, textAlign: 'center', lineHeight: 14 },
  baseline: { height: 0.5, backgroundColor: colors.control, marginTop: 8, marginBottom: 8 },
  cite: { fontSize: 10, color: colors.textFaint },
});