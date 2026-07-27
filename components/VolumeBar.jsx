/**
 * VolumeBar.jsx — weekly volume, coloured by status rather than by length.
 *
 * The gradient stops are anchored to the muscle's real research thresholds and
 * the ramp turns back after the optimal window: red below minimum, warming to
 * green through the target, then back to red once volume becomes junk.
 *
 * That turn-back matters. A plain red→green ramp makes a long bar always end
 * green, so 20 sets against a 6–12 target — junk volume — rendered as the best
 * looking row on the screen. Colour has to agree with colorForVolume(), which
 * is the verdict the rest of the app already uses.
 *
 *   <VolumeBar done={14} target={{ min: 10, optimal_low: 10, optimal_high: 20 }} />
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

const RED = '#E5484D', ORANGE = '#E2632F', AMBER = '#DDA83F', GREEN = '#2ECC94';

let uid = 0;

// Scale runs past the junk threshold so overshoot is visible instead of pinned
// to a full bar.
function scaleMax(t, done) {
  return Math.max((t?.optimal_high || 1) * 1.7, done * 1.05, 1);
}

function rampStops(t, done) {
  const max = scaleMax(t, done);
  const junk = t.optimal_high * 1.5;
  const at = (v) => Math.max(0, Math.min(1, v / max));
  const raw = [
    [0, RED],
    [at(t.min * 0.55), ORANGE],
    [at(t.min), AMBER],
    [at(t.optimal_low), GREEN],
    [at(t.optimal_high), GREEN],
    [at((t.optimal_high + junk) / 2), AMBER],
    [at(junk * 0.92), ORANGE],
    // Fully red BY the junk threshold — not at the end of the track, or a value
    // just past junk lands mid-interpolation and still reads amber.
    [at(junk), RED],
    [1, RED],
  ];
  // SVG requires non-decreasing offsets.
  let last = -1;
  return raw.map(([o, c]) => {
    const v = Math.max(o, last + 0.0001);
    last = v;
    return [Math.min(1, v), c];
  });
}

export default function VolumeBar({ done = 0, target, height = 9, style }) {
  const [w, setW] = useState(0);
  const [gid] = useState(() => `vb${++uid}`);

  if (!target?.optimal_high) {
    return <View style={[styles.track, { height, borderRadius: height / 2 }, style]} />;
  }

  const max = scaleMax(target, done);
  const fill = done > 0 ? Math.max(height, w * Math.min(1, done / max)) : 0;
  const stops = rampStops(target, done);

  return (
    <View style={[styles.wrap, { height }, style]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2="0">
              {stops.map(([o, c], i) => <Stop key={i} offset={o} stopColor={c} />)}
            </LinearGradient>
            <LinearGradient id={`${gid}s`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.26" />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.05" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.16" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={w} height={height} rx={height / 2} fill={colors.surfaceInset} />
          {fill > 0 && (
            <>
              <Rect x="0" y="0" width={fill} height={height} rx={height / 2} fill={`url(#${gid})`} />
              {/* light top edge, shadowed bottom — gives the bar form rather than
                  leaving it a flat stripe */}
              <Rect x="0" y="0" width={fill} height={height} rx={height / 2} fill={`url(#${gid}s)`} />
            </>
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
