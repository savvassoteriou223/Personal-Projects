/**
 * EvidenceBand.jsx — Helix's signature control.
 *
 * A progress bar whose colour *is* the verdict. The track carries a continuous
 * red → amber → green gradient whose stops sit on the researched thresholds, so
 * a short bar reads red, a bar in the target band reads green, and one past it
 * warms back to amber — with no tick marks, labels or zone blocks. The user
 * never reads a threshold; they just see the colour they've earned.
 *
 *   <EvidenceBand value={14} min={10} low={10} high={20} />
 *
 * Drawn with react-native-svg (already a dependency) because RN has no native
 * gradient. Width comes from onLayout so the gradient can be laid out in user
 * space — with the default objectBoundingBox units it would compress into the
 * fill rather than spanning the track.
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

let uid = 0;

export default function EvidenceBand({
  value = 0,
  min = 0,
  low = 0,
  high = 0,
  height = 8,
  style,
}) {
  const [w, setW] = useState(0);
  const [gid] = useState(() => `eb${++uid}`);

  // Headroom so a value past the optimal band still sits on the track.
  const max = Math.max(high * 1.25, value * 1.08, 1);
  const at = (n) => Math.max(0, Math.min(1, n / max));
  const fillW = w * at(value);

  // Stops ride the real thresholds, so the colour ramp encodes them implicitly.
  const stops = high > 0
    ? [
        { o: 0, c: colors.danger },
        { o: Math.max(0.01, at(min || low * 0.6)), c: colors.warning },
        { o: Math.max(0.02, at(low)), c: colors.accent },
        { o: Math.max(0.03, at(high)), c: colors.accent },
        { o: 1, c: colors.warning },
      ]
    : [{ o: 0, c: colors.accent }, { o: 1, c: colors.accent }];

  return (
    <View
      style={[styles.wrap, { height }, style]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
              {stops.map((s, i) => (
                <Stop key={i} offset={s.o} stopColor={s.c} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={w} height={height} rx={height / 2} fill={colors.surfaceInset} />
          {value > 0 && (
            <Rect x="0" y="0" width={Math.max(height, fillW)} height={height} rx={height / 2} fill={`url(#${gid})`} />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', overflow: 'hidden' },
});
