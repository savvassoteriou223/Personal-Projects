/**
 * EvidenceBand.jsx — Helix's signature control.
 *
 * Every other training app hands you a number and asks you to trust it. Helix
 * shows the researched range and where you actually sit in it, so the evidence
 * is readable at a glance instead of buried in a paragraph nobody opens.
 *
 * The track is divided into the zones the research defines — below minimum,
 * working, optimal, diminishing — and a marker shows the user's position.
 *
 *   <EvidenceBand value={14} min={10} low={10} high={20} />
 *
 * Colour follows the app's status language: amber means "look here", accent
 * means on-target, danger means below the effective threshold. Zones are drawn
 * as low-opacity tints so the marker — the one thing you're actually reading —
 * stays the highest-contrast element on the row.
 */
import { View, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

const TINT = { under: '#E85D5C2E', working: '#BA751733', optimal: '#1D9E7547', over: '#BA751733' };

export default function EvidenceBand({
  value = 0,
  min = 0,
  low = 0,
  high = 0,
  height = 6,
  showMarker = true,
  style,
}) {
  // Headroom so a user above the optimal band still lands inside the track and
  // the "diminishing returns" zone is actually visible rather than clipped off.
  const max = Math.max(high * 1.35, value * 1.1, 1);
  const clamp = (n) => Math.max(0, Math.min(100, (n / max) * 100));
  const pct = (n) => `${clamp(n)}%`;
  const span = (a, b) => `${Math.max(0, clamp(b) - clamp(a))}%`;

  const hasZones = high > 0;
  const markerH = height + 6;

  return (
    // The marker deliberately overhangs the track, so it can't live inside the
    // clipped (rounded) track view — it's a sibling in a taller wrapper.
    <View style={[styles.wrap, { height: markerH }, style]}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        {hasZones && (
          <>
            {min > 0 && <View style={[styles.zone, { left: 0, width: pct(min), backgroundColor: TINT.under }]} />}
            {low > min && <View style={[styles.zone, { left: pct(min), width: span(min, low), backgroundColor: TINT.working }]} />}
            <View style={[styles.zone, { left: pct(low), width: span(low, high), backgroundColor: TINT.optimal }]} />
            <View style={[styles.zone, { left: pct(high), right: 0, backgroundColor: TINT.over }]} />
          </>
        )}
      </View>
      {showMarker && value > 0 && (
        <View style={[styles.marker, { left: pct(value), height: markerH }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', position: 'relative' },
  track: { width: '100%', backgroundColor: colors.surfaceInset, overflow: 'hidden', position: 'relative' },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  // 2px reads as a hairline on a 6px track but stays visible against every tint.
  marker: { position: 'absolute', top: 0, width: 2, borderRadius: 1, marginLeft: -1, backgroundColor: colors.textPrimary },
});
