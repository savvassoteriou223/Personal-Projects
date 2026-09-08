// Shared layout-motion helper. Call animateLayout() in the same tick BEFORE a
// setState that changes what's on screen (expand/collapse, add/remove a row) and
// React animates the reflow instead of snapping. It animates the *change* only,
// so content is never gated behind an animation that might not fire.
//
//   onPress={() => { animateLayout(); setExpanded(v => !v); }}
//
// No-op on react-native-web; safe on iOS and Android (Fabric + legacy).
import { LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function animateLayout(duration = 220) {
  LayoutAnimation.configureNext({
    duration,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}
