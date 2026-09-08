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

// ── Spacing — 4pt base, seven steps. ────────────────────────────────────────
// Measured across the app there were 27 distinct padding values in use. That is
// not a system, and the eye registers the lack of rhythm even when the mind does
// not. These are the only values; if a gap needs something between them, the
// layout is wrong, not the scale.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

// ── Radii — three. ─────────────────────────────────────────────────────────
// There were 19 in use (3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24 …). Three is
// enough to express control / container / pill, and anything past that reads as
// inconsistency rather than variety.
export const radius = {
  control: 10,   // buttons, inputs, small tiles
  card: 18,      // cards, sheets, modals
  pill: 999,
};

// ── Type — six sizes, with real jumps between them. ────────────────────────
// This is the fix that matters most. The app used 29 distinct font sizes, but
// 79% of every text style sat between 11px and 17px — so nothing was ever
// visibly more important than anything else, and the whole interface read as a
// field of labels. A ~1.35 ratio gives each step a job you can see.
//
//   meta    11  eyebrows, captions, units
//   body    13  paragraphs, list rows
//   lead    15  the sentence that matters in a block
//   section 20  section headings
//   display 28  the one thing a screen is about
//   figure  40  a number given the weight of its importance
//
// Weights are 400 / 600 / 700. Nothing else — 200, 300, 500 and 800 were all in
// use and none of them read as distinct on a phone.
export const type = {
  meta:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  body:    { fontSize: 13, fontWeight: '400', lineHeight: 19 },
  lead:    { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  section: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  figure:  { fontSize: 40, fontWeight: '700', letterSpacing: -1.4 },
};

// The allowed raw values, exported so a test can enforce them. A screen may use
// a number from these sets; anything else is drift.
export const SCALE = {
  fontSize:     [11, 13, 15, 20, 28, 40],
  borderRadius: [10, 18, 999],
  spacing:      [0, 4, 8, 12, 16, 24, 32, 48],
  fontWeight:   ['400', '600', '700'],
};

// Minimum touch target (points). Anything pressable should reach this via size
// or padding + hitSlop — below it, users miss.
export const MIN_TOUCH = 44;

export default { colors, spacing, radius, type, SCALE, MIN_TOUCH };
