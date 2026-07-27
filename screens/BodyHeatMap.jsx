/**
 * BodyHeatMap.jsx — anatomical recovery heat map.
 *
 * Renders the real male/female anatomy (screens/anatomyData.js) with every muscle
 * filled by its recovery status, using the SAME status→colour mapping the Today
 * screen's muscle grid uses — so the body and the list can never disagree.
 *
 * Non-muscle parts (head, hands, feet…) render in a flat body fill and are never
 * coloured. react-native-svg has no usable Gaussian blur on Android, so the "glow"
 * is a wider translucent stroke of the same colour rather than a real blur.
 *
 *   <BodyHeatMap recovery={muscleRecovery} sex="female" side="front" height={300} />
 */
import Svg, { Path, G } from 'react-native-svg';
import ANATOMY, { ANATOMY_VIEWBOX } from './anatomyData';
import { colors } from '../lib/theme';

// Mirrors RECOVERY_COLORS in TodayScreen — kept in the same order/semantics.
const STATUS_COLOR = {
  trained_today: colors.danger,
  recovering: colors.warning,
  ready: colors.accent,
  fresh: colors.accent,
};

const BODY_FILL = '#141419';
const BODY_STROKE = '#2A2A34';
// A muscle with no logged history at all reads as untrained rather than "primed
// green" — on a body, lighting up a never-trained muscle is actively misleading.
const UNTRAINED_FILL = '#1E1E26';

export default function BodyHeatMap({ recovery = {}, sex = 'male', side = 'front', height = 300, style }) {
  const key = `${sex === 'female' ? 'female' : 'male'}${side === 'back' ? 'Back' : 'Front'}`;
  const parts = ANATOMY[key] || [];
  const viewBox = ANATOMY_VIEWBOX[side === 'back' ? 'back' : 'front'];
  const width = height * 0.5; // viewBox is 724 × 1448

  return (
    <Svg width={width} height={height} viewBox={viewBox} style={style}>
      {/* Glow pass — wide translucent strokes under the solid fills. */}
      <G>
        {parts.map((part, i) => {
          if (!part.m) return null;
          const entry = recovery[part.m];
          if (!entry || entry.daysSince == null) return null;
          const c = STATUS_COLOR[entry.status] || colors.accent;
          return part.d.map((d, j) => (
            <Path key={`g${i}-${j}`} d={d} fill="none" stroke={c} strokeWidth={14} opacity={0.18} />
          ));
        })}
      </G>
      {/* Body pass */}
      <G>
        {parts.map((part, i) => {
          const entry = part.m ? recovery[part.m] : null;
          const fill = !part.m
            ? BODY_FILL
            : !entry || entry.daysSince == null
              ? UNTRAINED_FILL
              : (STATUS_COLOR[entry.status] || colors.accent);
          return part.d.map((d, j) => (
            <Path key={`b${i}-${j}`} d={d} fill={fill} stroke={BODY_STROKE} strokeWidth={1} />
          ));
        })}
      </G>
    </Svg>
  );
}
