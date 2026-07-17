// Tappable — the app's standard pressable. Plain RN Pressable gives no feedback
// with a static `style`, so a tap on a button looks dead. This wraps Pressable
// and, on press, springs a subtle scale-down and dims — so every button, chip,
// row, and card feels alive and responsive without each screen re-inventing it.
//
//   <Tappable style={styles.startBtn} onPress={...}>…</Tappable>
//   <Tappable style={styles.cta} haptic onPress={...}>…</Tappable>   // + light haptic
//
// - `style` is a static object or array (no function form — Tappable owns the
//   pressed state now).
// - `dim` tunes pressed opacity (default 0.6). `scaleTo` tunes pressed scale.
// - `haptic` fires a light impact on press-in (native only).
// - Honors Reduce Motion: scale is skipped, the opacity dim stays as feedback.
//
// Do NOT use Tappable for modal-backdrop tap-catchers — a dimming/scaling
// backdrop flashes on every touch. Use a bare Pressable there.
import { useRef } from 'react';
import { Animated, Pressable, Platform, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const NATIVE = Platform.OS !== 'web';

// Cached Reduce-Motion preference, kept live. Read once, then track changes.
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then(v => { reduceMotion = v; }).catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => { reduceMotion = v; });

export default function Tappable({
  style, dim = 0.6, scaleTo = 0.97, haptic = false, hitSlop = 6,
  children, onPressIn, onPressOut, disabled, ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animate = (toScale, toOpacity) =>
    Animated.parallel([
      Animated.spring(scale, { toValue: reduceMotion ? 1 : toScale, useNativeDriver: NATIVE, speed: 50, bounciness: 4 }),
      Animated.timing(opacity, { toValue: toOpacity, duration: 90, useNativeDriver: NATIVE }),
    ]).start();

  const handleIn = (e) => {
    animate(scaleTo, dim);
    if (haptic && NATIVE) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressIn?.(e);
  };
  const handleOut = (e) => { animate(1, 1); onPressOut?.(e); };

  const base = Array.isArray(style) ? style : [style];

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={handleIn}
      onPressOut={handleOut}
      // Animated opacity only when enabled, so a disabled button's own dim shows through.
      style={[...base, { transform: [{ scale }] }, !disabled && { opacity }]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
