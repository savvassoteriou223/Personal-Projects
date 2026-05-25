/**
 * MuscleMap.jsx — Helix Muscle Activation Diagram
 *
 * Two-panel SVG: Anterior (front) + Posterior (back)
 * Muscle regions are SVG paths. Active muscles glow in primary colour,
 * secondary muscles glow in secondary colour, inactive are dim.
 *
 * Props:
 *   primary   : string[]  — primary muscle names from movementLibrary.js
 *   secondary : string[]  — secondary muscle names
 *   size      : 'sm' | 'md' | 'lg'  (default 'md')
 *   showLabels: boolean   (default false)
 *
 * Usage:
 *   <MuscleMap
 *     primary={['Chest', 'Shoulders', 'Triceps']}
 *     secondary={['Upper chest']}
 *   />
 *
 * Muscle name → region mapping covers every name used in movementLibrary.js:
 *   'Chest', 'Upper chest', 'Lower chest', 'Anterior delts',
 *   'Shoulders', 'Side deltoids', 'Rear deltoids', 'Rear delts',
 *   'Lats', 'Traps', 'Upper trapezius', 'Upper traps',
 *   'Biceps', 'Brachialis', 'Triceps',
 *   'Quads', 'Hamstrings', 'Glutes', 'Glute medius', 'Glute minimus',
 *   'Lower back', 'Rectus abdominis', 'Obliques',
 *   'Gastrocnemius', 'Soleus', 'Calves',
 *   'External rotators', 'Levator scapulae', 'Forearms',
 *   'Brachioradialis'
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Ellipse, Circle, G, Defs, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#0A0A0C',
  bodyFill:     '#1C1C24',
  bodyStroke:   '#2A2A38',
  inactive:     '#1C1C24',
  inactiveEdge: '#2A2A38',
  primary:      '#1D9E75',   // green — primary muscle
  primaryEdge:  '#1D9E75',
  secondary:    '#BA7517',   // amber — secondary muscle
  secondaryEdge:'#BA7517',
  label:        '#8B8A9A',
  textPrimary:  '#F1F0F5',
};

// ─── Muscle → view mapping ────────────────────────────────────────────────────
// Each entry maps a muscle name to which SVG region IDs it activates
// 'ant' = anterior view region IDs, 'post' = posterior view region IDs

const MUSCLE_REGIONS = {
  // Chest
  'Chest':           { ant: ['chest_l', 'chest_r'], post: [] },
  'Upper chest':     { ant: ['upper_chest_l', 'upper_chest_r'], post: [] },
  'Lower chest':     { ant: ['lower_chest_l', 'lower_chest_r'], post: [] },

  // Shoulders / Delts
  'Shoulders':       { ant: ['front_delt_l', 'front_delt_r', 'side_delt_l', 'side_delt_r'], post: ['rear_delt_l', 'rear_delt_r'] },
  'Anterior delts':  { ant: ['front_delt_l', 'front_delt_r'], post: [] },
  'Side deltoids':   { ant: ['side_delt_l', 'side_delt_r'], post: [] },
  'Rear deltoids':   { post: ['rear_delt_l', 'rear_delt_r'], ant: [] },
  'Rear delts':      { post: ['rear_delt_l', 'rear_delt_r'], ant: [] },
  'External rotators': { post: ['rear_delt_l', 'rear_delt_r'], ant: [] },

  // Back
  'Lats':            { post: ['lat_l', 'lat_r'], ant: [] },
  'Traps':           { post: ['trap_upper_l', 'trap_upper_r', 'trap_mid_l', 'trap_mid_r'], ant: [] },
  'Upper traps':     { post: ['trap_upper_l', 'trap_upper_r'], ant: [] },
  'Upper trapezius': { post: ['trap_upper_l', 'trap_upper_r'], ant: [] },
  'Levator scapulae':{ post: ['trap_upper_l', 'trap_upper_r'], ant: [] },
  'Lower back':      { post: ['lower_back_l', 'lower_back_r'], ant: [] },

  // Arms
  'Biceps':          { ant: ['bicep_l', 'bicep_r'], post: [] },
  'Brachialis':      { ant: ['brachialis_l', 'brachialis_r'], post: [] },
  'Triceps':         { post: ['tricep_l', 'tricep_r'], ant: [] },
  'Forearms':        { ant: ['forearm_ant_l', 'forearm_ant_r'], post: ['forearm_post_l', 'forearm_post_r'] },
  'Brachioradialis': { ant: ['forearm_ant_l', 'forearm_ant_r'], post: [] },

  // Core
  'Rectus abdominis':{ ant: ['abs_upper', 'abs_lower'], post: [] },
  'Obliques':        { ant: ['oblique_l', 'oblique_r'], post: [] },

  // Legs
  'Quads':           { ant: ['quad_l', 'quad_r'], post: [] },
  'Hamstrings':      { post: ['hamstring_l', 'hamstring_r'], ant: [] },
  'Glutes':          { post: ['glute_l', 'glute_r'], ant: [] },
  'Glute medius':    { post: ['glute_med_l', 'glute_med_r'], ant: [] },
  'Glute minimus':   { post: ['glute_med_l', 'glute_med_r'], ant: [] },

  // Calves
  'Gastrocnemius':   { ant: [], post: ['gastroc_l', 'gastroc_r'] },
  'Soleus':          { ant: ['soleus_ant_l', 'soleus_ant_r'], post: ['soleus_post_l', 'soleus_post_r'] },
  'Calves':          { ant: [], post: ['gastroc_l', 'gastroc_r', 'soleus_post_l', 'soleus_post_r'] },
};

// ─── Normalise input muscle names ─────────────────────────────────────────────
function normalise(name) {
  // Strip parenthetical qualifiers: 'Anterior delts (shoulders)' → 'Anterior delts'
  return name?.trim().replace(/\s*\(.*?\)/g, '') ?? '';
}

// ─── Build active region sets ─────────────────────────────────────────────────
function buildActiveSets(primary = [], secondary = []) {
  const primAnt = new Set();
  const primPost = new Set();
  const secAnt = new Set();
  const secPost = new Set();

  primary.forEach(m => {
    const key = normalise(m);
    const r = MUSCLE_REGIONS[key];
    if (!r) return;
    r.ant?.forEach(id => primAnt.add(id));
    r.post?.forEach(id => primPost.add(id));
  });

  secondary.forEach(m => {
    const key = normalise(m);
    const r = MUSCLE_REGIONS[key];
    if (!r) return;
    r.ant?.forEach(id => { if (!primAnt.has(id)) secAnt.add(id); });
    r.post?.forEach(id => { if (!primPost.has(id)) secPost.add(id); });
  });

  return { primAnt, primPost, secAnt, secPost };
}

// ─── Size config ──────────────────────────────────────────────────────────────
const SIZES = {
  sm: { figH: 160, figW: 55,  panelGap: 16, labelSize: 8  },
  md: { figH: 220, figW: 75,  panelGap: 20, labelSize: 9  },
  lg: { figH: 300, figW: 100, panelGap: 28, labelSize: 10 },
};

// ─── Region fill helper ───────────────────────────────────────────────────────
function regionColor(id, primSet, secSet) {
  if (primSet.has(id)) return { fill: C.primary,   stroke: C.primaryEdge,   opacity: 1 };
  if (secSet.has(id))  return { fill: C.secondary,  stroke: C.secondaryEdge, opacity: 1 };
  return { fill: C.inactive, stroke: C.inactiveEdge, opacity: 1 };
}

// ─── ANTERIOR SVG ────────────────────────────────────────────────────────────
/**
 * All paths use a viewBox-relative coordinate system.
 * ViewBox: 0 0 100 240
 * Centre line: x=50
 * Symmetrical pairs use mirrored x coords.
 */
function AnteriorBody({ primAnt, secAnt }) {
  function rc(id) { return regionColor(id, primAnt, secAnt); }

  return (
    <Svg viewBox="0 0 100 240" width="100%" height="100%">
      {/* ── Head ── */}
      <Ellipse cx={50} cy={13} rx={9} ry={11} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.8} />

      {/* ── Neck ── */}
      <Path d="M45,23 L45,28 L55,28 L55,23 Z" fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.5} />

      {/* ── Traps (anterior visible portion) ── */}
      <Path d="M37,27 C37,26 44,25 50,25 C56,25 63,26 63,27 L65,34 C65,35 58,36 50,36 C42,36 35,35 35,34 Z"
        fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.5} />

      {/* ── Upper chest ── */}
      {['upper_chest_l','upper_chest_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M38,36 C35,36 32,38 31,41 C30,44 31,47 34,48 L50,48 L50,36 Z"
          : "M62,36 C65,36 68,38 69,41 C70,44 69,47 66,48 L50,48 L50,36 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Chest (pec major) ── */}
      {['chest_l','chest_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M50,48 L34,48 C30,48 28,51 28,55 C28,59 31,63 35,64 L50,64 Z"
          : "M50,48 L66,48 C70,48 72,51 72,55 C72,59 69,63 65,64 L50,64 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Lower chest ── */}
      {['lower_chest_l','lower_chest_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M50,64 L35,64 C31,64 29,66 30,68 L32,70 L50,70 Z"
          : "M50,64 L65,64 C69,64 71,66 70,68 L68,70 L50,70 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Front deltoid ── */}
      {['front_delt_l','front_delt_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M38,36 C35,34 29,35 27,39 C25,43 27,47 30,48 C33,49 36,47 38,44 Z"
          : "M62,36 C65,34 71,35 73,39 C75,43 73,47 70,48 C67,49 64,47 62,44 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Side deltoid ── */}
      {['side_delt_l','side_delt_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M27,39 C24,40 22,44 23,48 C24,52 27,53 29,52 L30,48 C28,46 27,43 27,39 Z"
          : "M73,39 C76,40 78,44 77,48 C76,52 73,53 71,52 L70,48 C72,46 73,43 73,39 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Biceps ── */}
      {['bicep_l','bicep_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M29,52 C26,53 23,57 23,62 C23,67 25,70 28,71 L30,71 C31,68 31,63 30,58 Z"
          : "M71,52 C74,53 77,57 77,62 C77,67 75,70 72,71 L70,71 C69,68 69,63 70,58 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Brachialis ── */}
      {['brachialis_l','brachialis_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M30,58 C28,58 26,62 26,65 C26,68 27,70 28,71 L30,71 Z"
          : "M70,58 C72,58 74,62 74,65 C74,68 73,70 72,71 L70,71 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Forearm anterior ── */}
      {['forearm_ant_l','forearm_ant_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M28,71 C26,72 23,76 23,81 C23,86 25,89 27,90 L29,90 L30,71 Z"
          : "M72,71 C74,72 77,76 77,81 C77,86 75,89 73,90 L71,90 L70,71 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Abs upper ── */}
      {(() => {
        const s = rc('abs_upper');
        return <Path d="M43,70 L57,70 L57,88 L43,88 Z" fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })()}

      {/* ── Abs lower ── */}
      {(() => {
        const s = rc('abs_lower');
        return <Path d="M43,88 L57,88 L57,105 L43,105 Z" fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })()}

      {/* ── Obliques ── */}
      {['oblique_l','oblique_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M43,70 C38,70 33,74 32,80 C31,86 33,95 36,105 L43,105 Z"
          : "M57,70 C62,70 67,74 68,80 C69,86 67,95 64,105 L57,105 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Hip / pelvis divider ── */}
      <Path d="M36,105 C36,108 43,110 50,110 C57,110 64,108 64,105 L57,105 L43,105 Z"
        fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.5} />

      {/* ── Quads ── */}
      {['quad_l','quad_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M36,110 C32,111 28,116 27,125 C26,134 28,143 32,150 C35,155 39,157 43,156 L44,110 Z"
          : "M64,110 C68,111 72,116 73,125 C74,134 72,143 68,150 C65,155 61,157 57,156 L56,110 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Knee cap ── */}
      <Ellipse cx={38} cy={158} rx={5} ry={5} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.5} />
      <Ellipse cx={62} cy={158} rx={5} ry={5} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.5} />

      {/* ── Soleus (anterior visible) ── */}
      {['soleus_ant_l','soleus_ant_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M33,163 C30,165 28,172 29,180 C30,187 33,192 36,193 L39,193 L40,163 Z"
          : "M67,163 C70,165 72,172 71,180 C70,187 67,192 64,193 L61,193 L60,163 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Shin (tibia — inactive filler) ── */}
      <Path d="M39,163 L40,193 L44,225 L45,225 L44,163 Z" fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.4} />
      <Path d="M61,163 L60,193 L56,225 L55,225 L56,163 Z" fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.4} />

      {/* ── Feet ── */}
      <Ellipse cx={43} cy={228} rx={8} ry={4} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.6} />
      <Ellipse cx={57} cy={228} rx={8} ry={4} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.6} />
    </Svg>
  );
}

// ─── POSTERIOR SVG ───────────────────────────────────────────────────────────
function PosteriorBody({ primPost, secPost }) {
  function rc(id) { return regionColor(id, primPost, secPost); }

  return (
    <Svg viewBox="0 0 100 240" width="100%" height="100%">
      {/* ── Head ── */}
      <Ellipse cx={50} cy={13} rx={9} ry={11} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.8} />

      {/* ── Neck ── */}
      <Path d="M45,23 L45,28 L55,28 L55,23 Z" fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.5} />

      {/* ── Upper traps ── */}
      {['trap_upper_l','trap_upper_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M50,25 C44,25 38,27 36,30 C34,33 35,36 38,37 L50,36 Z"
          : "M50,25 C56,25 62,27 64,30 C66,33 65,36 62,37 L50,36 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Mid traps ── */}
      {['trap_mid_l','trap_mid_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M50,36 L38,37 C34,38 32,42 33,46 L36,52 L50,52 Z"
          : "M50,36 L62,37 C66,38 68,42 67,46 L64,52 L50,52 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Rear deltoid ── */}
      {['rear_delt_l','rear_delt_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M38,37 C33,36 27,38 25,43 C23,47 25,51 28,53 C31,54 34,52 36,49 L36,52 Z"
          : "M62,37 C67,36 73,38 75,43 C77,47 75,51 72,53 C69,54 66,52 64,49 L64,52 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Lats ── */}
      {['lat_l','lat_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M36,52 L33,46 C31,42 28,46 27,52 C26,58 28,65 31,70 C34,74 38,76 41,75 L41,64 L36,52 Z"
          : "M64,52 L67,46 C69,42 72,46 73,52 C74,58 72,65 69,70 C66,74 62,76 59,75 L59,64 L64,52 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Triceps ── */}
      {['tricep_l','tricep_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M27,52 C24,53 21,57 21,63 C21,69 23,72 26,73 L28,73 L28,52 Z"
          : "M73,52 C76,53 79,57 79,63 C79,69 77,72 74,73 L72,73 L72,52 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Forearm posterior ── */}
      {['forearm_post_l','forearm_post_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M26,73 C24,74 21,78 21,84 C21,89 23,92 25,93 L27,93 L28,73 Z"
          : "M74,73 C76,74 79,78 79,84 C79,89 77,92 75,93 L73,93 L72,73 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Lower back / erectors ── */}
      {['lower_back_l','lower_back_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M50,64 L41,64 C38,65 36,72 36,80 C36,88 38,98 41,105 L50,105 Z"
          : "M50,64 L59,64 C62,65 64,72 64,80 C64,88 62,98 59,105 L50,105 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Spine fill (centre line) ── */}
      <Path d="M48,36 L52,36 L52,105 L48,105 Z" fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.3} />

      {/* ── Glute medius (upper outer glute) ── */}
      {['glute_med_l','glute_med_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M41,105 C37,105 32,108 30,113 C28,118 30,124 34,126 C37,128 41,126 43,122 L44,110 Z"
          : "M59,105 C63,105 68,108 70,113 C72,118 70,124 66,126 C63,128 59,126 57,122 L56,110 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Glutes (maximus) ── */}
      {['glute_l','glute_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M43,122 C41,126 37,128 34,126 C30,124 29,130 30,136 C31,142 35,148 40,151 C44,153 48,152 50,150 L50,110 L44,110 Z"
          : "M57,122 C59,126 63,128 66,126 C70,124 71,130 70,136 C69,142 65,148 60,151 C56,153 52,152 50,150 L50,110 L56,110 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Hamstrings ── */}
      {['hamstring_l','hamstring_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M40,151 C36,152 31,156 30,163 C29,170 31,180 34,187 C37,192 41,195 44,194 L44,151 Z"
          : "M60,151 C64,152 69,156 70,163 C71,170 69,180 66,187 C63,192 59,195 56,194 L56,151 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Knee (posterior) ── */}
      <Ellipse cx={40} cy={157} rx={5} ry={4} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.4} />
      <Ellipse cx={60} cy={157} rx={5} ry={4} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.4} />

      {/* ── Gastrocnemius ── */}
      {['gastroc_l','gastroc_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M34,162 C30,164 27,171 28,180 C29,188 33,194 37,195 C40,196 43,194 44,190 L44,162 Z"
          : "M66,162 C70,164 73,171 72,180 C71,188 67,194 63,195 C60,196 57,194 56,190 L56,162 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Soleus (posterior) ── */}
      {['soleus_post_l','soleus_post_r'].map((id, i) => {
        const s = rc(id);
        const isL = i === 0;
        const d = isL
          ? "M44,190 C43,194 40,196 37,195 C34,194 33,198 34,205 C35,210 38,215 41,217 L44,217 L44,190 Z"
          : "M56,190 C57,194 60,196 63,195 C66,194 67,198 66,205 C65,210 62,215 59,217 L56,217 L56,190 Z";
        return <Path key={id} d={d} fill={s.fill} stroke={s.stroke} strokeWidth={0.5} opacity={s.opacity} />;
      })}

      {/* ── Feet (posterior) ── */}
      <Ellipse cx={42} cy={228} rx={8} ry={4} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.6} />
      <Ellipse cx={58} cy={228} rx={8} ry={4} fill={C.bodyFill} stroke={C.bodyStroke} strokeWidth={0.6} />
    </Svg>
  );
}

// ─── Legend row ───────────────────────────────────────────────────────────────
function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MuscleMap({
  primary = [],
  secondary = [],
  size = 'md',
  showLabels = false,
  showLegend = true,
}) {
  const { figH, figW, panelGap } = SIZES[size] || SIZES.md;
  const { primAnt, primPost, secAnt, secPost } = buildActiveSets(primary, secondary);

  const hasPrimary   = primary.length > 0;
  const hasSecondary = secondary.length > 0;

  return (
    <View style={styles.container}>
      {/* Labels row */}
      {showLabels && (
        <View style={[styles.labelRow, { width: figW * 2 + panelGap }]}>
          <Text style={[styles.viewLabel, { width: figW }]}>Front</Text>
          <Text style={[styles.viewLabel, { width: figW }]}>Back</Text>
        </View>
      )}

      {/* Figures */}
      <View style={styles.figureRow}>
        <View style={{ width: figW, height: figH }}>
          <AnteriorBody primAnt={primAnt} secAnt={secAnt} />
        </View>
        <View style={{ width: panelGap }} />
        <View style={{ width: figW, height: figH }}>
          <PosteriorBody primPost={primPost} secPost={secPost} />
        </View>
      </View>

      {/* Legend */}
      {showLegend && (hasPrimary || hasSecondary) && (
        <View style={styles.legend}>
          {hasPrimary   && <LegendDot color={C.primary}   label="Primary" />}
          {hasSecondary && <LegendDot color={C.secondary} label="Secondary" />}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  viewLabel: {
    color: '#4A4A5A',
    fontSize: 9,
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    color: '#8B8A9A',
    fontSize: 11,
  },
});