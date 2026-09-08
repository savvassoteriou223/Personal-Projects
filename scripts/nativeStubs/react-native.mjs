// Minimal react-native stand-in so lib/ modules that branch on Platform.OS can be
// unit-tested under plain Node, and so screen components can be rendered with
// react-test-renderer without a device.
//
// Host components are plain strings: react-test-renderer treats an unknown
// string tag as a host element, which is exactly what View and Text are. That
// gives a real element tree to walk — enough to catch a crash on render, an
// undefined slipping into a Text child, or a style invariant being broken.
// It is NOT a layout engine: nothing here measures, so anything that depends on
// real geometry still needs a device. Only add what a test actually needs.
export const Platform = { OS: 'ios', select: (o) => (o.ios ?? o.default) };
export function __setPlatform(os) { Platform.OS = os; }

export const View = 'View';
export const Text = 'Text';
export const Modal = 'Modal';
export const ActivityIndicator = 'ActivityIndicator';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const TextInput = 'TextInput';
export const Image = 'Image';

export const StyleSheet = {
  create: (obj) => obj,
  flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s.flat(Infinity).filter(Boolean)) : (s || {})),
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
export function useWindowDimensions() { return { width: 390, height: 844, scale: 3, fontScale: 1 }; }

export const Share = {
  share: async () => ({ action: 'sharedAction' }),
  dismissedAction: 'dismissedAction',
  sharedAction: 'sharedAction',
};

export const NativeModules = {};

export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  addEventListener: () => ({ remove() {} }),
};

// Just enough Animated for Tappable to construct and render.
class AnimatedValue {
  constructor(v) { this._value = v; }
  setValue(v) { this._value = v; }
  interpolate() { return this; }
}
const noopAnim = () => ({ start: () => {}, stop: () => {} });
export const Animated = {
  Value: AnimatedValue,
  createAnimatedComponent: (C) => C,
  spring: noopAnim,
  timing: noopAnim,
  parallel: () => ({ start: () => {}, stop: () => {} }),
  sequence: () => ({ start: () => {}, stop: () => {} }),
  View: 'View',
  Text: 'Text',
};

export const LayoutAnimation = {
  configureNext: () => {},
  Presets: { easeInEaseOut: {} },
  create: () => ({}),
  Types: {}, Properties: {},
};

export const Alert = { alert: () => {} };
export const AppState = { addEventListener: () => ({ remove() {} }), currentState: 'active' };
export const KeyboardAvoidingView = 'KeyboardAvoidingView';

export default {
  Platform, View, Text, Modal, ActivityIndicator, Pressable, ScrollView, TextInput, Image,
  StyleSheet, Dimensions, useWindowDimensions, Share, NativeModules, AccessibilityInfo,
  Animated, LayoutAnimation, Alert, AppState, KeyboardAvoidingView,
};
