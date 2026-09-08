/**
 * VolumeBar.jsx — weekly volume against the muscle's research target.
 *
 * Three parts, each carrying one fact:
 *   track        how far the scale runs (to 1.7x optimal_high, so overshoot is
 *                visible instead of pinned to a full bar)
 *   optimal band where the target window sits on that scale
 *   fill         how much you have done, in ONE colour: the verdict from
 *                colorForVolume(), the same one the rest of the app uses
 *
 * It used to paint the fill with a red→orange→amber→green→amber→orange→red
 * gradient anchored to the thresholds. The thresholds were right but the
 * rendering was not: every bar showed four colours at once, so the status had
 * to be read off the tip while the eye saw a smear, and a gloss overlay on top
 * made it a bevelled stripe. The window is a property of the TRACK, not of the
 * fill — marking it there frees the fill to state the verdict plainly.
 *
 *   <VolumeBar done={14} target={{ min: 10, optimal_low: 10, optimal_high: 20 }} color="#2ECC94" />
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

// Scale runs past the junk threshold so overshoot is visible instead of pinned
// to a full bar.
function scaleMax(t, done) {
  return Math.max((t?.optimal_high || 1) * 1.7, done * 1.05, 1);
}

export default function VolumeBar({ done = 0, target, color, height = 8, style }) {
  const [w, setW] = useState(0);

  if (!target?.optimal_high) {
    return <View style={[styles.track, { height, borderRadius: height / 2 }, style]} />;
  }

  const max = scaleMax(target, done);
  const at = v => Math.max(0, Math.min(1, v / max));
  const r = height / 2;

  // A sliver of fill still reads as a value; without the floor, 1 set against a
  // 20-set target rounds to an invisible bar and looks like nothing was logged.
  const fill = done > 0 ? Math.max(height, w * at(done)) : 0;
  const bandX = w * at(target.optimal_low);
  const bandW = Math.max(1, w * at(target.optimal_high) - bandX);

  return (
    <View style={[styles.wrap, { height }, style]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Rect x={0} y={0} width={w} height={height} rx={r} fill={colors.surfaceInset} />
          {/* Target window. Square ends on purpose — it marks two exact set
              counts, and rounding them would blur where the window starts. */}
          <Rect x={bandX} y={0} width={bandW} height={height} fill={colors.control} />
          {fill > 0 && (
            <Rect x={0} y={0} width={fill} height={height} rx={r} fill={color || colors.accent} />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  track: { flex: 1, backgroundColor: colors.surfaceInset },
});
