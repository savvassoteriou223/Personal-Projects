// exercise3DData.js
// Joint positions: [x, y, z]  — Y up, X left/right, Z toward viewer
// Figure ≈ 1.8 units tall.  Auto-scales to canvas.
// Standing exercises use default rotY ≈ 0.5 (slight 3/4 front view).
// Horizontal exercises (bench, pushup, hipthrust) use rotY = π/2 (pure side view).

const KEYS = [
  'head','neck','torsoT','torsoB',
  'shL','shR','elbL','elbR','wriL','wriR',
  'hipL','hipR','kneL','kneR','ankL','ankR',
];

function J(head,neck,torsoT,torsoB,shL,shR,elbL,elbR,wriL,wriR,hipL,hipR,kneL,kneR,ankL,ankR) {
  return {head,neck,torsoT,torsoB,shL,shR,elbL,elbR,wriL,wriR,hipL,hipR,kneL,kneR,ankL,ankR};
}

// ─── UPRIGHT STANDING BASE ────────────────────────────────────────────────────
const STAND = J(
  [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
  [-0.30,1.45,0],[0.30,1.45,0],
  [-0.32,1.12,0],[0.32,1.12,0],
  [-0.30,0.74,0],[0.30,0.74,0],
  [-0.18,0.88,0],[0.18,0.88,0],
  [-0.18,0.46,0],[0.18,0.46,0],
  [-0.18,0.04,0],[0.18,0.04,0],
);

// ─── EXERCISE POSES ──────────────────────────────────────────────────────────
const POSES = {

  // ── SQUAT ──────────────────────────────────────────────────────────────────
  // Viewed from slight 3/4 front. Feet slightly wider than hips.
  squat: [
    {
      phase: 'Set up',
      cue: 'Bar on upper traps, brace your core, feet shoulder-width',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.54,1.38,0.10],[0.54,1.38,0.10],   // arms wide on bar
        [-0.70,1.40,0.12],[0.70,1.40,0.12],
        [-0.20,0.88,0],[0.20,0.88,0],
        [-0.20,0.46,0],[0.20,0.46,0],
        [-0.22,0.04,0],[0.22,0.04,0],
      ),
    },
    {
      phase: 'Break parallel',
      cue: 'Hip crease below knee, chest up, knees tracking toes',
      joints: J(
        // Torso leans forward ~50°, hips below knee height
        [0,1.16,0.28],[0,1.00,0.24],[0,0.84,0.16],[0,0.48,0.04],
        [-0.30,0.90,0.16],[0.30,0.90,0.16],
        [-0.54,0.84,0.26],[0.54,0.84,0.26],
        [-0.70,0.86,0.28],[0.70,0.86,0.28],
        [-0.26,0.36,0.04],[0.26,0.36,0.04],   // hips LOW (below knee)
        [-0.30,0.40,0.38],[0.30,0.40,0.38],   // knees FORWARD, higher than hips
        [-0.26,0.04,0.24],[0.26,0.04,0.24],   // feet flat, slightly forward
      ),
    },
    {
      phase: 'Drive through',
      cue: 'Push the floor away, keep bar path vertical over mid-foot',
      joints: J(
        [0,1.48,0.12],[0,1.30,0.10],[0,1.12,0.06],[0,0.72,0.01],
        [-0.30,1.20,0.06],[0.30,1.20,0.06],
        [-0.54,1.12,0.16],[0.54,1.12,0.16],
        [-0.70,1.14,0.18],[0.70,1.14,0.18],
        [-0.22,0.62,0.02],[0.22,0.62,0.02],
        [-0.26,0.46,0.24],[0.26,0.46,0.24],
        [-0.24,0.04,0.14],[0.24,0.04,0.14],
      ),
    },
  ],

  // ── DEADLIFT ───────────────────────────────────────────────────────────────
  deadlift: [
    {
      phase: 'Wedge in',
      cue: 'Bar over mid-foot, lats tight, shoulders just ahead of bar',
      joints: J(
        // ~45° back angle, hips high, shoulders over bar
        [0,1.54,0.34],[0,1.38,0.30],[0,1.18,0.20],[0,0.90,0.06],
        [-0.28,1.24,0.22],[0.28,1.24,0.22],
        [-0.26,0.96,0.20],[0.26,0.96,0.20],   // arms hanging straight
        [-0.22,0.52,0.16],[0.22,0.52,0.16],   // wrists near bar
        [-0.18,0.86,0],[0.18,0.86,0],
        [-0.20,0.50,0.26],[0.20,0.50,0.26],   // knees bent, pushed forward
        [-0.20,0.04,0.14],[0.20,0.04,0.14],
      ),
    },
    {
      phase: 'Bar off floor',
      cue: 'Legs drive, back angle holds, bar stays against shins',
      joints: J(
        [0,1.66,0.18],[0,1.50,0.15],[0,1.28,0.10],[0,0.94,0.02],
        [-0.28,1.34,0.12],[0.28,1.34,0.12],
        [-0.26,1.04,0.10],[0.26,1.04,0.10],
        [-0.22,0.62,0.06],[0.22,0.62,0.06],
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.20,0.50,0.18],[0.20,0.50,0.18],
        [-0.20,0.04,0.10],[0.20,0.04,0.10],
      ),
    },
    {
      phase: 'Lockout',
      cue: 'Hips through, stand tall — no hyper-extension',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.32,1.10,0],[0.32,1.10,0],
        [-0.28,0.72,0],[0.28,0.72,0],         // arms hanging, bar at hip
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
  ],

  // ── OVERHEAD PRESS ─────────────────────────────────────────────────────────
  ohp: [
    {
      phase: 'Front rack',
      cue: 'Bar at clavicle, elbows in front, core tight',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.30,1.28,0.20],[0.30,1.28,0.20],   // elbows in front
        [-0.22,1.50,0.14],[0.22,1.50,0.14],   // bar at clavicle
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
    {
      phase: 'Bar clears head',
      cue: 'Head moves back to let bar pass, then push head through',
      joints: J(
        [0,1.72,-0.06],[0,1.52,-0.04],[0,1.35,0],[0,0.95,0],  // head back
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.32,1.70,0.02],[0.32,1.70,0.02],   // elbows driving up
        [-0.26,1.92,0.00],[0.26,1.92,0.00],   // bar at forehead height
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
    {
      phase: 'Overhead lockout',
      cue: 'Arms straight, bar over hips and heels, shrug traps',
      joints: J(
        [0,1.72,0.02],[0,1.52,0.01],[0,1.35,0],[0,0.95,0],
        [-0.26,1.48,0],[0.26,1.48,0],
        [-0.20,1.92,-0.01],[0.20,1.92,-0.01],
        [-0.16,2.14,-0.01],[0.16,2.14,-0.01], // fully overhead
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
  ],

  // ── BENCH PRESS — side view (rotY = π/2) ───────────────────────────────────
  // Z = body length axis. Positive Z = head end. Negative Z = feet end.
  // In side view: -Z maps to screen right, so head appears on the left.
  bench: [
    {
      phase: 'Setup',
      cue: 'Retract and depress scapulae, 5 points of contact, feet flat',
      joints: J(
        [0,0.60,0.80],[0,0.56,0.64],[0,0.54,0.44],[0,0.52,0.04],
        [-0.28,0.54,0.44],[0.28,0.54,0.44],
        [-0.30,1.02,0.40],[0.30,1.02,0.40],   // arms extended upward
        [-0.28,1.32,0.38],[0.28,1.32,0.38],   // bar at lockout above chest
        [-0.18,0.50,-0.08],[0.18,0.50,-0.08],
        [-0.18,0.50,-0.46],[0.18,0.50,-0.46], // knees bent, on bench
        [-0.18,0.04,-0.58],[0.18,0.04,-0.58], // feet flat on floor
      ),
    },
    {
      phase: 'Lower to chest',
      cue: 'Elbows at 45–75°, bar touches lower chest, wrists stacked',
      joints: J(
        [0,0.60,0.80],[0,0.56,0.64],[0,0.54,0.44],[0,0.52,0.04],
        [-0.28,0.54,0.44],[0.28,0.54,0.44],
        [-0.46,0.70,0.54],[0.46,0.70,0.54],   // elbows flared out and forward
        [-0.28,0.56,0.44],[0.28,0.56,0.44],   // bar at lower chest level
        [-0.18,0.50,-0.08],[0.18,0.50,-0.08],
        [-0.18,0.50,-0.46],[0.18,0.50,-0.46],
        [-0.18,0.04,-0.58],[0.18,0.04,-0.58],
      ),
    },
    {
      phase: 'Press in arc',
      cue: 'Drive bar up and slightly back — J-curve path',
      joints: J(
        [0,0.60,0.80],[0,0.56,0.64],[0,0.54,0.44],[0,0.52,0.04],
        [-0.28,0.54,0.44],[0.28,0.54,0.44],
        [-0.36,0.86,0.44],[0.36,0.86,0.44],   // elbows partway extended
        [-0.28,1.04,0.42],[0.28,1.04,0.42],   // bar halfway up
        [-0.18,0.50,-0.08],[0.18,0.50,-0.08],
        [-0.18,0.50,-0.46],[0.18,0.50,-0.46],
        [-0.18,0.04,-0.58],[0.18,0.04,-0.58],
      ),
    },
  ],

  // ── BENT-OVER ROW ──────────────────────────────────────────────────────────
  row: [
    {
      phase: 'Hinge and brace',
      cue: '45° torso, soft knees, arms hang straight below shoulders',
      joints: J(
        [0,1.42,0.32],[0,1.26,0.28],[0,1.06,0.20],[0,0.86,0.06],
        [-0.28,1.12,0.22],[0.28,1.12,0.22],
        [-0.28,0.84,0.24],[0.28,0.84,0.24],   // arms hanging straight down
        [-0.24,0.50,0.26],[0.24,0.50,0.26],   // wrists near bar level
        [-0.18,0.84,0.02],[0.18,0.84,0.02],
        [-0.18,0.50,0.14],[0.18,0.50,0.14],   // soft knee bend
        [-0.18,0.04,0.10],[0.18,0.04,0.10],
      ),
    },
    {
      phase: 'Pull to lower chest',
      cue: 'Drive elbows back and up, bar touches lower sternum',
      joints: J(
        [0,1.42,0.32],[0,1.26,0.28],[0,1.06,0.20],[0,0.86,0.06],
        [-0.28,1.12,0.22],[0.28,1.12,0.22],
        [-0.46,1.04,0.00],[0.46,1.04,0.00],   // elbows driven BACK past torso
        [-0.28,1.00,0.18],[0.28,1.00,0.18],   // bar at lower chest
        [-0.18,0.84,0.02],[0.18,0.84,0.02],
        [-0.18,0.50,0.14],[0.18,0.50,0.14],
        [-0.18,0.04,0.10],[0.18,0.04,0.10],
      ),
    },
    {
      phase: 'Peak squeeze',
      cue: 'Retract scapulae fully — hold 1 second at the top',
      joints: J(
        [0,1.42,0.32],[0,1.26,0.28],[0,1.06,0.20],[0,0.86,0.06],
        [-0.32,1.12,0.20],[0.32,1.12,0.20],   // shoulders pulled back
        [-0.50,1.06,-0.04],[0.50,1.06,-0.04], // elbows fully behind torso
        [-0.30,1.02,0.14],[0.30,1.02,0.14],
        [-0.18,0.84,0.02],[0.18,0.84,0.02],
        [-0.18,0.50,0.14],[0.18,0.50,0.14],
        [-0.18,0.04,0.10],[0.18,0.04,0.10],
      ),
    },
  ],

  // ── PULL-UP ────────────────────────────────────────────────────────────────
  pullup: [
    {
      phase: 'Dead hang',
      cue: 'Full arm extension, actively depress scapulae before pulling',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.28,1.76,0.01],[0.28,1.76,0.01],   // arms reaching up to bar
        [-0.22,2.05,0],[0.22,2.05,0],          // hands on bar
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.16,0.46,0],[0.16,0.46,0],
        [-0.16,0.04,0],[0.16,0.04,0],
      ),
    },
    {
      phase: 'Elbows to pockets',
      cue: 'Think "elbows to back pockets" — lat-driven pull',
      joints: J(
        [0,2.10,0],[0,1.90,0],[0,1.70,0],[0,1.30,0],
        [-0.30,1.80,0],[0.30,1.80,0],
        [-0.48,2.00,0.06],[0.48,2.00,0.06],   // elbows wide and coming down
        [-0.22,2.05,0],[0.22,2.05,0],          // hands still on bar
        [-0.18,1.22,0],[0.18,1.22,0],
        [-0.16,0.80,0],[0.16,0.80,0],
        [-0.16,0.38,0],[0.16,0.38,0],
      ),
    },
    {
      phase: 'Chin over bar',
      cue: 'Chest to bar — control the descent for max stimulus',
      joints: J(
        [0,2.50,0],[0,2.30,0],[0,2.10,0],[0,1.70,0],
        [-0.30,2.20,0],[0.30,2.20,0],
        [-0.54,2.08,-0.10],[0.54,2.08,-0.10], // elbows wide and back
        [-0.22,2.05,0],[0.22,2.05,0],          // hands on bar
        [-0.18,1.62,0],[0.18,1.62,0],
        [-0.16,1.20,0],[0.16,1.20,0],
        [-0.16,0.78,0],[0.16,0.78,0],
      ),
    },
  ],

  // ── ROMANIAN DEADLIFT ──────────────────────────────────────────────────────
  rdl: [
    {
      phase: 'Hip hinge',
      cue: 'Push hips back, slight knee bend, bar close to legs',
      joints: J(
        [0,1.56,0.30],[0,1.40,0.26],[0,1.20,0.18],[0,0.92,0.04],
        [-0.28,1.26,0.20],[0.28,1.26,0.20],
        [-0.26,0.98,0.20],[0.26,0.98,0.20],   // arms hanging
        [-0.22,0.68,0.16],[0.22,0.68,0.16],   // bar near hips
        [-0.18,0.86,0],[0.18,0.86,0],
        [-0.18,0.48,0.12],[0.18,0.48,0.12],   // slight knee bend
        [-0.18,0.04,0.08],[0.18,0.04,0.08],
      ),
    },
    {
      phase: 'Hamstring stretch',
      cue: 'Bar at mid-shin, feel hamstring load — back stays flat',
      joints: J(
        [0,1.20,0.46],[0,1.04,0.42],[0,0.84,0.30],[0,0.60,0.10],
        [-0.28,0.90,0.32],[0.28,0.90,0.32],
        [-0.24,0.64,0.30],[0.24,0.64,0.30],
        [-0.20,0.34,0.26],[0.20,0.34,0.26],   // bar at mid-shin
        [-0.18,0.58,0],[0.18,0.58,0],
        [-0.18,0.50,0.10],[0.18,0.50,0.10],   // minimal knee bend
        [-0.18,0.04,0.08],[0.18,0.04,0.08],
      ),
    },
    {
      phase: 'Hip extension',
      cue: 'Drive hips forward to standing — squeeze glutes at top',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.32,1.10,0],[0.32,1.10,0],
        [-0.28,0.72,0],[0.28,0.72,0],
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
  ],

  // ── BICEP CURL ─────────────────────────────────────────────────────────────
  curl: [
    {
      phase: 'Start — supinate grip',
      cue: 'Palms forward, elbows pinned to sides, stand tall',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.32,1.12,0.02],[0.32,1.12,0.02],   // elbows tucked at sides
        [-0.32,0.72,0.02],[0.32,0.72,0.02],   // arms hanging down
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
    {
      phase: '90° — forearms parallel',
      cue: 'Elbows stay tucked and stationary — only forearms move',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.32,1.12,0.02],[0.32,1.12,0.02],   // elbows still pinned
        [-0.32,1.12,0.34],[0.32,1.12,0.34],   // forearms pointing FORWARD (parallel to floor)
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
    {
      phase: 'Peak contraction',
      cue: 'Squeeze hard at the top — control the negative on the way down',
      joints: J(
        [0,1.75,0],[0,1.55,0],[0,1.35,0],[0,0.95,0],
        [-0.30,1.45,0],[0.30,1.45,0],
        [-0.32,1.12,0.02],[0.32,1.12,0.02],   // elbows still pinned
        [-0.30,1.42,0.22],[0.30,1.42,0.22],   // forearms curled high
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.18,0.46,0],[0.18,0.46,0],
        [-0.18,0.04,0],[0.18,0.04,0],
      ),
    },
  ],

  // ── LUNGE ──────────────────────────────────────────────────────────────────
  // Left leg forward, right leg back
  lunge: [
    {
      phase: 'Step forward',
      cue: 'Large stride, front shin stays vertical over ankle',
      joints: J(
        [0,1.72,0.06],[0,1.52,0.05],[0,1.32,0.03],[0,0.92,0.01],
        [-0.30,1.42,0.03],[0.30,1.42,0.03],
        [-0.34,1.08,0.03],[0.34,1.08,0.03],
        [-0.34,0.72,0.03],[0.34,0.72,0.03],
        [-0.15,0.88,0.04],[0.15,0.88,0.01],
        [-0.16,0.52,0.40],[0.16,0.50,-0.24],  // front knee forward, back knee back
        [-0.16,0.04,0.54],[0.16,0.04,-0.30],  // front foot forward, back foot back
      ),
    },
    {
      phase: 'Bottom — back knee near floor',
      cue: 'Front knee over toe, torso upright, back hip extends',
      joints: J(
        [0,1.50,0.10],[0,1.32,0.09],[0,1.12,0.06],[0,0.72,0.02],
        [-0.30,1.22,0.06],[0.30,1.22,0.06],
        [-0.34,0.88,0.06],[0.34,0.88,0.06],
        [-0.34,0.52,0.06],[0.34,0.52,0.06],
        [-0.15,0.66,0.06],[0.15,0.64,0.00],
        [-0.16,0.58,0.52],[0.16,0.08,-0.42],  // front knee above front foot, back knee near floor
        [-0.16,0.04,0.54],[0.16,0.04,-0.42],
      ),
    },
    {
      phase: 'Drive up',
      cue: 'Push through front heel to return — hip extensors drive',
      joints: J(
        [0,1.66,0.06],[0,1.48,0.05],[0,1.28,0.03],[0,0.88,0.01],
        [-0.30,1.38,0.03],[0.30,1.38,0.03],
        [-0.34,1.04,0.03],[0.34,1.04,0.03],
        [-0.34,0.68,0.03],[0.34,0.68,0.03],
        [-0.15,0.82,0.03],[0.15,0.80,0.00],
        [-0.16,0.50,0.26],[0.16,0.38,-0.18],
        [-0.16,0.04,0.34],[0.16,0.04,-0.22],
      ),
    },
  ],

  // ── HIP THRUST — side view (rotY = π/2) ────────────────────────────────────
  // Upper back on bench (high Y, negative Z). Feet flat on floor (low Y, positive Z).
  hipthrust: [
    {
      phase: 'Setup',
      cue: 'Upper back on bench edge, bar at hip crease, feet flat',
      joints: J(
        [0,1.10,-0.38],[0,0.98,-0.28],[0,0.86,-0.14],[0,0.60,0.08],
        [-0.28,0.90,-0.16],[0.28,0.90,-0.16],
        [-0.32,0.62,-0.14],[0.32,0.62,-0.14],
        [-0.30,0.36,-0.08],[0.30,0.36,-0.08],
        [-0.18,0.52,0.12],[0.18,0.52,0.12],   // hips low
        [-0.20,0.50,0.46],[0.20,0.50,0.46],   // knees bent
        [-0.20,0.04,0.52],[0.20,0.04,0.52],   // feet flat
      ),
    },
    {
      phase: 'Bottom',
      cue: 'Hips lowered, hamstrings loaded, maintain bar contact',
      joints: J(
        [0,0.92,-0.44],[0,0.82,-0.34],[0,0.70,-0.16],[0,0.38,0.06],
        [-0.28,0.74,-0.20],[0.28,0.74,-0.20],
        [-0.32,0.46,-0.16],[0.32,0.46,-0.16],
        [-0.30,0.20,-0.10],[0.30,0.20,-0.10],
        [-0.18,0.32,0.10],[0.18,0.32,0.10],
        [-0.20,0.36,0.48],[0.20,0.36,0.48],
        [-0.20,0.04,0.52],[0.20,0.04,0.52],
      ),
    },
    {
      phase: 'Lockout',
      cue: 'Full hip extension — squeeze glutes hard, hold 1 second',
      joints: J(
        [0,1.24,-0.34],[0,1.12,-0.26],[0,1.00,-0.10],[0,0.82,0.12],
        [-0.28,1.04,-0.14],[0.28,1.04,-0.14],
        [-0.32,0.78,-0.12],[0.32,0.78,-0.12],
        [-0.30,0.52,-0.06],[0.30,0.52,-0.06],
        [-0.18,0.76,0.18],[0.18,0.76,0.18],   // hips HIGH
        [-0.20,0.46,0.46],[0.20,0.46,0.46],
        [-0.20,0.04,0.50],[0.20,0.04,0.50],
      ),
    },
  ],

  // ── DIP ────────────────────────────────────────────────────────────────────
  dip: [
    {
      phase: 'Top — arms straight',
      cue: 'Support yourself between bars, slight forward lean for chest',
      joints: J(
        [0,1.76,0.02],[0,1.56,0.01],[0,1.36,0],[0,0.96,0],
        [-0.38,1.44,0],[0.38,1.44,0],
        [-0.44,1.12,0],[0.44,1.12,0],         // arms fully extended down
        [-0.42,0.76,0],[0.42,0.76,0],          // hands on bars
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.16,0.50,0.06],[0.16,0.50,0.06],   // legs hanging
        [-0.16,0.12,0.10],[0.16,0.12,0.10],
      ),
    },
    {
      phase: 'Lower — upper arm parallel',
      cue: 'Elbows flare slightly, lean torso forward, feel chest stretch',
      joints: J(
        [0,1.44,0.10],[0,1.26,0.09],[0,1.06,0.06],[0,0.66,0.01],
        [-0.38,1.14,0.06],[0.38,1.14,0.06],
        [-0.54,0.96,-0.02],[0.54,0.96,-0.02], // elbows back and wide
        [-0.42,0.76,0],[0.42,0.76,0],          // hands still on bars
        [-0.18,0.58,0],[0.18,0.58,0],
        [-0.16,0.22,0.06],[0.16,0.22,0.06],
        [-0.16,-0.08,0.10],[0.16,-0.08,0.10],
      ),
    },
    {
      phase: 'Press to lockout',
      cue: 'Drive through palms to full arm extension',
      joints: J(
        [0,1.76,0.02],[0,1.56,0.01],[0,1.36,0],[0,0.96,0],
        [-0.38,1.44,0],[0.38,1.44,0],
        [-0.44,1.12,0],[0.44,1.12,0],
        [-0.42,0.76,0],[0.42,0.76,0],
        [-0.18,0.88,0],[0.18,0.88,0],
        [-0.16,0.50,0.06],[0.16,0.50,0.06],
        [-0.16,0.12,0.10],[0.16,0.12,0.10],
      ),
    },
  ],

  // ── PUSH-UP — side view (rotY = π/2) ───────────────────────────────────────
  // Body horizontal. Z = body axis. Head at positive Z, feet at negative Z.
  // Arms are vertical (shoulder → elbow → wrist all at same Z, Y decreases).
  pushup: [
    {
      phase: 'Top — plank position',
      cue: 'Straight line head to heels, hands below shoulders',
      joints: J(
        [0,0.52,0.80],[0,0.48,0.64],[0,0.52,0.44],[0,0.50,0.02],
        [-0.28,0.52,0.44],[0.28,0.52,0.44],
        [-0.28,0.28,0.44],[0.28,0.28,0.44],   // arms straight down
        [-0.26,0.04,0.44],[0.26,0.04,0.44],   // hands on floor
        [-0.16,0.50,-0.10],[0.16,0.50,-0.10],
        [-0.16,0.48,-0.52],[0.16,0.48,-0.52],
        [-0.16,0.04,-0.80],[0.16,0.04,-0.80], // toes on floor
      ),
    },
    {
      phase: 'Lower — chest near floor',
      cue: 'Elbows at 45°, chest touches floor — full range of motion',
      joints: J(
        [0,0.28,0.80],[0,0.24,0.64],[0,0.20,0.44],[0,0.18,0.02],
        [-0.28,0.22,0.44],[0.28,0.22,0.44],
        [-0.44,0.36,0.36],[0.44,0.36,0.36],   // elbows flared at 45°
        [-0.26,0.04,0.44],[0.26,0.04,0.44],   // hands on floor
        [-0.16,0.20,-0.10],[0.16,0.20,-0.10],
        [-0.16,0.18,-0.52],[0.16,0.18,-0.52],
        [-0.16,0.04,-0.80],[0.16,0.04,-0.80],
      ),
    },
    {
      phase: 'Press to lockout',
      cue: 'Push the floor away — protract scapulae at the top',
      joints: J(
        [0,0.52,0.80],[0,0.48,0.64],[0,0.52,0.44],[0,0.50,0.02],
        [-0.28,0.52,0.44],[0.28,0.52,0.44],
        [-0.28,0.28,0.44],[0.28,0.28,0.44],
        [-0.26,0.04,0.44],[0.26,0.04,0.44],
        [-0.16,0.50,-0.10],[0.16,0.50,-0.10],
        [-0.16,0.48,-0.52],[0.16,0.48,-0.52],
        [-0.16,0.04,-0.80],[0.16,0.04,-0.80],
      ),
    },
  ],

  // ── LAT PULLDOWN ───────────────────────────────────────────────────────────
  // Seated. Hips/knees at ~90°, legs forward.
  latpulldown: [
    {
      phase: 'Arms extended',
      cue: 'Wide grip, lean back slightly, feel lats stretch at top',
      joints: J(
        [0,1.72,-0.02],[0,1.52,-0.01],[0,1.32,0],[0,0.92,0],
        [-0.30,1.42,0],[0.30,1.42,0],
        [-0.54,1.78,0.03],[0.54,1.78,0.03],   // arms wide up to bar
        [-0.62,2.04,0.01],[0.62,2.04,0.01],
        [-0.18,0.44,0],[0.18,0.44,0],          // seated (hips low)
        [-0.18,0.44,0.34],[0.18,0.44,0.34],   // knees bent forward
        [-0.18,0.04,0.36],[0.18,0.04,0.36],
      ),
    },
    {
      phase: 'Halfway — elbows driving down',
      cue: 'Lead with elbows pulling to pockets, not with hands',
      joints: J(
        [0,1.68,-0.04],[0,1.50,-0.03],[0,1.30,0],[0,0.90,0],
        [-0.30,1.40,0],[0.30,1.40,0],
        [-0.50,1.62,-0.02],[0.50,1.62,-0.02], // elbows driving down
        [-0.62,2.04,0.01],[0.62,2.04,0.01],   // hands still on bar
        [-0.18,0.44,0],[0.18,0.44,0],
        [-0.18,0.44,0.34],[0.18,0.44,0.34],
        [-0.18,0.04,0.36],[0.18,0.04,0.36],
      ),
    },
    {
      phase: 'Bar to upper chest',
      cue: 'Elbows behind body, scapulae depressed — squeeze for 1 sec',
      joints: J(
        [0,1.65,-0.06],[0,1.48,-0.05],[0,1.28,0],[0,0.88,0],
        [-0.30,1.38,0],[0.30,1.38,0],
        [-0.52,1.44,-0.08],[0.52,1.44,-0.08], // elbows behind body
        [-0.32,1.46,0.08],[0.32,1.46,0.08],   // bar at upper chest
        [-0.18,0.44,0],[0.18,0.44,0],
        [-0.18,0.44,0.34],[0.18,0.44,0.34],
        [-0.18,0.04,0.36],[0.18,0.04,0.36],
      ),
    },
  ],

  // ── DEFAULT (fallback) ─────────────────────────────────────────────────────
  default: [
    { phase: 'Starting position', cue: 'Neutral spine, shoulders packed, core braced', joints: STAND },
    { phase: 'Working position',  cue: 'Control the movement — slow eccentric, explosive concentric', joints: STAND },
    { phase: 'Full range',        cue: 'Complete the full range of motion for maximum muscle stimulus', joints: STAND },
  ],
};

// ─── MATCHER ─────────────────────────────────────────────────────────────────

const SIDE_VIEW = Math.PI / 2;

export function getExercise3DData(name) {
  if (!name) return null;
  const n = name.toLowerCase();

  if (n.includes('romanian') || n.includes(' rdl') || (n.includes('rdl') && !n.includes('deadlift'))) return { slides: POSES.rdl };
  if (n.includes('hip thrust') || n.includes('glute bridge') || n.includes('hip bridge')) return { slides: POSES.hipthrust, viewAngle: SIDE_VIEW };
  if (n.includes('squat')) return { slides: POSES.squat };
  if (n.includes('deadlift')) return { slides: POSES.deadlift };
  if (n.includes('overhead press') || n.includes('military press') || n.includes('ohp') || n.includes('shoulder press')) return { slides: POSES.ohp };
  if (n.includes('bench press') || (n.includes('bench') && !n.includes('row'))) return { slides: POSES.bench, viewAngle: SIDE_VIEW };
  if (n.includes('chin-up') || n.includes('chin up') || n.includes('chinup') || n.includes('pull-up') || n.includes('pull up') || n.includes('pullup')) return { slides: POSES.pullup };
  if (n.includes('lat pulldown') || n.includes('pulldown') || n.includes('pull down')) return { slides: POSES.latpulldown };
  if (n.includes('row')) return { slides: POSES.row };
  if (n.includes('lunge')) return { slides: POSES.lunge };
  if (n.includes('push-up') || n.includes('pushup') || n.includes('push up')) return { slides: POSES.pushup, viewAngle: SIDE_VIEW };
  if (n.includes('dip')) return { slides: POSES.dip };
  if (n.includes('curl') || n.includes('bicep')) return { slides: POSES.curl };
  if (n.includes('press')) return { slides: POSES.ohp };
  if (n.includes('hinge') || n.includes('good morning')) return { slides: POSES.rdl };

  return { slides: POSES.default };
}
