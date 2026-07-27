/**
 * EvidenceBand.jsx — Helix's signature control.
 *
 * Every other training app hands you a number and asks you to trust it. Helix
 * shows where that number sits against the researched target.
 *
 *   <EvidenceBand value={14} min={10} low={10} high={20} />
 *
 * Design: a normal progress fill — instantly readable, familiar — coloured by
 * status, with hairline notches marking the researched target boundaries. An
 * earlier version tinted the whole track into four coloured zones; it turned
 * every row into a muddy stripe and read as a broken progress bar. The fill
 * carries the value, the notches carry the target, and nothing competes.
 */
import { View, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

// Status of a value against its researched range — the same language the rest
// of the app uses: danger below the effective minimum, warning outside the
// optimal band, accent inside it.
export function bandStatus(value, min, low, high) {
  if (!value) return 'empty';
  if (min > 0 && value < min) return 'under';
  if (high > 0 && value > high) return 'over';
  if (low > 0 && value < low) return 'working';
  return 'optimal';
}

const FILL = {
  under: colors.danger,
  working: colors.warning,
  optimal: colors.accent,
  over: colors.warning,
  empty: 'transparent',
};

export default function EvidenceBand({
  value = 0,
  min = 0,
  low = 0,
  high = 0,
  height = 8,
  style,
}) {
  // Headroom so someone past the optimal band still lands on the track and the
  // upper notch stays visible rather than pinned to the edge.
  const max = Math.max(high * 1.25, value * 1.08, 1);
  const pct = (n) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  const status = bandStatus(value, min, low, high);

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      {value > 0 && (
        <View style={[styles.fill, { width: pct(value), backgroundColor: FILL[status], borderRadius: height / 2 }]} />
      )}
      {/* Target boundaries — hairlines, not zones. */}
      {low > 0 && <View style={[styles.notch, { left: pct(low) }]} />}
      {high > low && <View style={[styles.notch, { left: pct(high) }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, backgroundColor: colors.surfaceInset, overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  // Sits above the fill so the target stays readable even when the bar passes it.
  notch: { position: 'absolute', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75, backgroundColor: '#FFFFFF55' },
});
