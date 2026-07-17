// ─── HELIX DESIGN TOKENS — SINGLE SOURCE OF TRUTH ────────────────────────────
// The palette was previously copy-pasted as raw hex into 14 screen files, which
// is why the text ramp drifted below WCAG contrast without anyone noticing.
// Import from here instead of hard-coding hex.
//
//   import { colors, spacing, radius, type } from '../lib/theme';
//
// Contrast ratios below are measured against the two real surfaces the text sits
// on: bg (#0F0F13) and surface (#1A1A20). WCAG AA needs 4.5:1 for body text and
// 3:1 for large text (>=18px, or >=14px bold). Every ramp step here clears 4.5:1
// on BOTH surfaces — do not add a dimmer step without checking it.

export const colors = {
  // ── Surfaces (dark by design: the app is used in a gym, often one-handed) ──
  // Ordered dark → light. Neighbouring steps sit within a few hex points; the
  // ramp reads as elevation, not as different hues. Consolidation note: before
  // this ramp existed, 30+ near-identical darks were hard-coded per screen
  // (#1C1C24, #1A1A24, #111116, #0F0F18 …). They all collapse onto a step here;
  // the sub-3-point shifts are imperceptible and were never intentional.
  bgDeep: '#0A0A10',       // immersive black — 3D viewer, full-bleed media
  bg: '#0F0F13',           // app background
  surfaceInset: '#12121A', // inputs, coach message bubbles, sunken boxes
  surfaceRaised: '#111114',// raised tiles (plan cards)
  surfaceAlt: '#15151B',   // inset panels, list rows
  surface: '#1A1A20',      // cards, modals, sheets
  surfaceElevated: '#1C1C22',// selected cards, pills, raised chips
  surfaceInverse: '#FFFFFF',// filled selected state (white chip/button); text on it = textOnLight
  control: '#2C2C35',      // input fills, secondary buttons

  // ── Borders (3-step ramp: soft recedes, strong separates) ──
  borderSoft: '#1E1E28',   // dim hairline on near-black surfaces
  border: '#2C2C35',       // default hairlines and card borders
  borderStrong: '#3D3D4A', // raised chips, active dividers
  borderActive: '#FFFFFF', // bright selection outline on a selected chip/card/button

  // ── Brand ──
  accent: '#1D9E75',       // primary action, success, current selection
  accentSoft: '#1D9E7522', // 13% accent — badge fills
  accentHair: '#1D9E7540', // 25% accent — accent borders

  // ── Info (the Coach's voice — a distinct blue so its nudges read as
  //    "assistant", not "success/warning". info passes AA on bg and infoSurface) ──
  info: '#7C9CFF',         // 7.3 / bg — coach nudge accent, icons, links
  infoSurface: '#15161F',  // coach nudge card fill
  infoBorder: '#3A3F66',   // coach nudge border

  // ── Status ── (both clear 4.5:1 as text on bg and surface)
  danger: '#E85D5C',       //  5.1 — was #E24B4A (4.40, just under AA)
  dangerSoft: '#E85D5C22', // 13% — badge/tint fills
  dangerHair: '#E85D5C44', // 27% — tint borders
  warning: '#BA7517',      //  4.7
  warningSoft: '#BA751722',// 13% — badge/tint fills
  warningHair: '#BA751540',// 25% — tint borders
  warningOnTint: '#C08B2E',// 6.0 on warningBg

  // ── Status-tinted banner surfaces (near-black with a hue cast). Status text
  //    and textPrimary/Secondary all clear AA on these — measured. ──
  dangerBg: '#1A0E0E',     // red-tinted alert/banner fill
  warningBg: '#1A1408',    // amber-tinted alert/banner fill
  successBg: '#0F1A14',    // green-tinted confirmation fill

  // ── Scrim ── modal / sheet backdrop
  scrim: '#00000099',      // 60% black behind modals

  // ── Text ramp — every step passes AA on bg AND surface ──
  // Ratios: measured vs surface #1A1A20 / bg #0F0F13
  textPrimary: '#FFFFFF',  // 17.9 / 19.7  — headings, values
  textSecondary: '#E4E4E8',// 14.0 / 15.4  — body copy
  textMuted: '#A1A1AA',    //  6.8 /  7.5  — secondary body, labels
  textSubtle: '#9494A0',   //  5.8 /  6.4  — tertiary labels, captions
  textFaint: '#8A8A94',    //  5.1 /  5.6  — legal, footnotes, disclaimers
  textPlaceholder: '#8A8A94', // placeholders need the SAME 4.5:1 as body text
  textOnAccent: '#FFFFFF',
  textOnLight: '#111114',  // text on white/filled buttons — ~17:1 there, do not
                           // "fix" it against a dark surface; it never sits on one
};

// ── Spacing scale — 4pt base. Use these, not arbitrary numbers. ──
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

// ── Radii ──
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  pill: 999,
};

// ── Type scale — fixed sizes (product UI, not fluid). ~1.15 ratio. ──
export const type = {
  display: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '700' },
  subheading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12 },
  footnote: { fontSize: 10, lineHeight: 15 },
};

// Minimum touch target (points). Anything pressable should reach this via size
// or padding + hitSlop — below it, users miss.
export const MIN_TOUCH = 44;

export default { colors, spacing, radius, type, MIN_TOUCH };
