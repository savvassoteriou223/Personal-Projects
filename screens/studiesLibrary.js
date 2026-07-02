// ─── STUDIES LIBRARY — SINGLE SOURCE OF TRUTH FOR THE SCIENCE ────────────────
// Every evidence-based claim in the app lives here, ONCE. Exercise-card tips and
// the AI coach both read from this module — no more duplicated science blobs.
//
// Each finding is a CONCISE, CITABLE INSIGHT, not a paragraph:
//   key: {
//     insight: string   — the one-line "why" shown to users / cited by the coach
//     metric?: { this, control, method }  — optional comparison (drives StudyChart)
//     cite:   string    — short citation, e.g. 'Maeo 2022 · n=21'
//     tags:   string[]  — muscles / exercises / topics, for lookup
//   }
// RULE: keep `insight` to ONE sentence. If you need a paragraph, you're doing it wrong.

export const STUDIES = {
  // ── VOLUME ────────────────────────────────────────────────────────────────
  volume_dose: {
    insight: '10–20 sets per muscle per week is the practical sweet spot — each extra set adds ~0.24% growth with diminishing returns.',
    cite: 'Pelland & Remmert 2025 · n=2058',
    tags: ['volume', 'programming'],
  },
  volume_minimum: {
    insight: 'Below ~4 sets per muscle per week is not enough stimulus to grow.',
    cite: 'Pelland et al. 2025',
    tags: ['volume', 'programming', 'beginner'],
  },
  volume_session_cap: {
    insight: 'Past ~10–12 hard sets for one muscle in a single session, extra sets add almost nothing — spread volume across the week.',
    cite: 'Remmert & Pelland 2025',
    tags: ['volume', 'programming'],
  },
  volume_by_experience: {
    insight: 'Weekly sets per muscle scale with training age: beginners 10–12, intermediate 12–16, advanced 16–20.',
    cite: 'Baz-Valle 2022',
    tags: ['volume', 'programming', 'beginner', 'intermediate', 'advanced'],
  },

  // ── EFFORT / PROXIMITY TO FAILURE ─────────────────────────────────────────
  effort_dose: {
    insight: 'Training closer to failure drives more growth — it is a continuous dose-response, not a threshold.',
    cite: 'Robinson et al. 2024',
    tags: ['effort', 'rir', 'programming'],
  },
  effort_failure_not_required: {
    insight: 'Stopping 1–3 reps shy of failure grows as much as going to failure, with better recovery — don\'t grind every set to failure.',
    cite: 'Enes 2024 · n=18',
    tags: ['effort', 'rir', 'recovery'],
  },
  effort_by_type: {
    insight: 'Compounds: RPE 7–8 (2–3 RIR). Secondary compounds: RPE 8–9. Isolation: RPE 9–10 (0–1 RIR) — low fatigue, train near failure.',
    cite: 'Robinson 2024',
    tags: ['effort', 'rir', 'programming'],
  },

  // ── REPS / REST / FREQUENCY / OVERLOAD ────────────────────────────────────
  rep_ranges_equal: {
    insight: 'All rep ranges build similar muscle when taken close to failure — 5–12 is the practical strength/size balance, 12–20 is easier on joints.',
    cite: 'Morton 2016; Schoenfeld 2020',
    tags: ['reps', 'programming'],
  },
  rest_periods: {
    insight: 'Rest 3–5 min on heavy compounds, 2–3 min on moderate ones, 1–2 min on isolation — short rest on compounds cuts volume and growth.',
    cite: 'Schoenfeld 2016',
    tags: ['rest', 'programming'],
  },
  frequency_2x: {
    insight: 'Train each muscle at least 2×/week; beyond that, total weekly volume matters more than how it\'s split.',
    cite: 'Schoenfeld 2016/2019',
    tags: ['frequency', 'programming'],
  },
  progressive_overload: {
    insight: 'Double progression is the most sustainable driver: work a rep range, hit the top, add load, restart at the bottom.',
    cite: 'Standard practice',
    tags: ['overload', 'progression', 'programming'],
  },
  deload: {
    insight: 'Every 4–8 weeks (or when performance keeps dropping) cut volume 30–50% for a week — load can stay similar.',
    cite: 'Bell & Darragh 2025',
    tags: ['deload', 'recovery', 'programming'],
  },

  // ── CHEST (region targeting — line of pull decides the region) ────────────
  chest_regions: {
    insight: 'Flat press hits the whole pec, incline emphasises the upper (clavicular) head, decline/dips the lower head — you need both angles.',
    cite: 'EMG + hypertrophy literature',
    tags: ['chest', 'incline', 'decline'],
  },
  chest_cable_lower: {
    insight: 'Lower-chest fibres pull DOWNWARD — target them with a HIGH-to-LOW cable (cables set high, hands travel down and together).',
    cite: 'Line-of-pull principle',
    tags: ['chest', 'lower_chest', 'cable', 'fly'],
  },
  chest_cable_upper: {
    insight: 'Upper-chest fibres pull UPWARD — target them with a LOW-to-HIGH cable (cables set low, hands travel up and together).',
    cite: 'Line-of-pull principle',
    tags: ['chest', 'upper_chest', 'cable', 'fly'],
  },
  cable_constant_tension: {
    insight: 'Cables keep tension on the muscle through the whole arc, including the peak squeeze where free weights lose tension.',
    cite: 'Mechanics of cable resistance',
    tags: ['chest', 'cable', 'fly'],
  },

  // ── BACK ──────────────────────────────────────────────────────────────────
  back_two_directions: {
    insight: 'Back needs both vertical pulls (lat width) and horizontal pulls (mid-back thickness) — they\'re distinct stimuli.',
    cite: 'Programming consensus',
    tags: ['back', 'lats', 'rows', 'pulldown'],
  },
  pulldown_grip: {
    insight: 'A pronated (overhand) grip recruits the lats slightly more than supinated on pulldowns.',
    cite: 'Lusk 2010; Buonsenso 2025',
    tags: ['back', 'lats', 'pulldown'],
  },

  // ── SHOULDERS ─────────────────────────────────────────────────────────────
  delts_need_isolation: {
    insight: 'Pressing trains the front delt only — side and rear delts need dedicated isolation or they get left behind.',
    cite: 'EMG literature',
    tags: ['shoulders', 'side_delts', 'rear_delts', 'lateral_raise'],
  },

  // ── ARMS ──────────────────────────────────────────────────────────────────
  triceps_longhead_overhead: {
    insight: 'Overhead extensions grow the triceps long head far more than pushdowns — the long head only fully stretches overhead.',
    metric: { this: 'Overhead +43%', control: 'Pushdown +10%', method: 'MRI · 12 wk' },
    cite: 'Maeo 2022 · n=21',
    tags: ['triceps', 'overhead_extension', 'lengthened'],
  },
  biceps_lengthened: {
    insight: 'Training the biceps stretched (incline or behind-the-body cable curls) grows the upper arm more than short-position curls.',
    cite: 'Kassiano 2025',
    tags: ['biceps', 'incline_curl', 'lengthened'],
  },

  // ── LEGS ──────────────────────────────────────────────────────────────────
  quads_need_both: {
    insight: 'Squats build the vastus lateralis; leg extensions are needed for the rectus femoris — neither alone is complete.',
    cite: 'Kassiano 2025',
    tags: ['quads', 'squat', 'leg_extension'],
  },
  hamstrings_hinge_vs_curl: {
    insight: 'Hip hinges at long length (RDL, seated curl) build the bulk of the hamstring; Nordics bias the semitendinosus — include both.',
    cite: 'Maeo 2021',
    tags: ['hamstrings', 'rdl', 'leg_curl', 'lengthened'],
  },
  glutes_thrust_and_rdl: {
    insight: 'Hip thrusts (peak contraction) plus RDLs (lengthened) cover both ends of the glute; thrusts grow glutes similarly to squats.',
    cite: 'Neto 2023',
    tags: ['glutes', 'hip_thrust', 'rdl'],
  },
  calves_stretch: {
    insight: 'Standing calf raises with a full stretch grow the gastrocnemius 9–12%; seated raises with no stretch ≈ 0%.',
    cite: 'Calf training research',
    tags: ['calves', 'standing_calf_raise', 'lengthened'],
  },
  lengthened_principle: {
    insight: 'Loading a muscle at long (stretched) length generally beats short-length training for growth — favour stretch-biased exercises.',
    cite: 'Kassiano 2023; Maeo 2021',
    tags: ['lengthened', 'programming'],
  },

  // ── ABS / AESTHETICS ──────────────────────────────────────────────────────
  abs_direct_work: {
    insight: 'Squats and deadlifts barely train the rectus abdominis — weighted direct work (cable crunch, ab wheel) is far more effective.',
    cite: 'EMG research',
    tags: ['abs', 'core', 'cable_crunch'],
  },
  abs_visibility: {
    insight: 'Abs become visible at ~10–12% body fat in men and ~18–20% in women — diet reveals them, ab training cannot.',
    cite: 'Body-composition norms',
    tags: ['abs', 'fat_loss', 'aesthetics'],
  },
  lower_abs_myth: {
    insight: 'There is no separate "lower abs" muscle; leg raises and reverse crunches just emphasise the lower fibres of one rectus abdominis.',
    cite: 'Anatomy',
    tags: ['abs', 'aesthetics'],
  },
  v_lines: {
    insight: 'The "V-lines" are the inguinal ligament — an anatomical structure revealed by getting lean, not something you can train.',
    cite: 'Anatomy',
    tags: ['aesthetics', 'fat_loss'],
  },

  // ── NUTRITION ─────────────────────────────────────────────────────────────
  protein_intake: {
    insight: 'Aim for 1.6–2.2 g protein per kg bodyweight per day; cutting athletes go to 2.0–2.4 g/kg to hold muscle.',
    cite: 'Morton 2018',
    tags: ['protein', 'nutrition'],
  },
  protein_per_meal: {
    insight: 'The old per-meal protein cap is overturned — 100 g in one meal gave a bigger, longer anabolic response than 25 g.',
    cite: 'Trommelen 2023 · n=36',
    tags: ['protein', 'nutrition'],
  },
  protein_timing: {
    insight: 'Protein timing barely matters — pre vs post-workout is equivalent; the anabolic window is hours, not minutes.',
    cite: 'Casuso & Goossens 2025',
    tags: ['protein', 'nutrition', 'timing'],
  },
  creatine: {
    insight: 'Creatine 3–5 g/day (no loading needed) adds ~1.4 kg of fat-free mass with training.',
    cite: 'Pashayee-Khamene 2025 · 61 trials',
    tags: ['creatine', 'supplements', 'nutrition'],
  },
  caffeine: {
    insight: 'Caffeine 3–6 mg/kg, 45–60 min pre-workout, measurably improves velocity and power — bigger effect in low-habitual users.',
    cite: 'Xiao 2025 · n=230',
    tags: ['caffeine', 'supplements', 'performance'],
  },
  deficit_size: {
    insight: 'Keep fat-loss deficits to 300–500 kcal/day; bigger than ~500 risks lean-mass loss.',
    cite: 'Anyiam 2024 · n=4785',
    tags: ['fat_loss', 'nutrition', 'cut'],
  },
  surplus_size: {
    insight: 'A lean bulk needs only ~5–10% over maintenance — bigger surpluses add mostly fat.',
    cite: 'Hypertrophy nutrition consensus',
    tags: ['bulk', 'nutrition', 'gain'],
  },

  // ── RECOVERY ──────────────────────────────────────────────────────────────
  sleep: {
    insight: 'Sleep 7–9 h — restriction lowers strength, muscle quality and raises injury risk.',
    cite: 'NHANES 2024 · n=4598',
    tags: ['sleep', 'recovery'],
  },
  hrv_signal: {
    insight: 'A drop in HRV plus poor sleep signals under-recovery — train lighter or rest rather than pushing heavy.',
    cite: 'Autonomic recovery research',
    tags: ['recovery', 'hrv', 'readiness'],
  },

  // ── CARDIO / LONGEVITY ────────────────────────────────────────────────────
  zone2: {
    insight: 'Keep ~80% of cardio easy (Zone 2, 60–70% max HR) to build an aerobic base; reserve Zone 4–5 for VO2-max intervals.',
    cite: 'Endurance training consensus',
    tags: ['cardio', 'zone2', 'endurance'],
  },
  interference: {
    insight: 'Heavy cardio on the same day as legs blunts strength — separate them by 6+ hours, or do cardio after lifting.',
    cite: 'Schumann 2022',
    tags: ['cardio', 'interference', 'concurrent'],
  },
  steps_mortality: {
    insight: '~7,000 steps/day is linked to roughly 47% lower mortality vs sedentary — most of the benefit lands before 10k.',
    cite: 'Ding 2025 · 57 studies',
    tags: ['steps', 'cardio', 'health', 'longevity'],
  },
  rt_mortality: {
    insight: 'Just ~60 min of resistance training per week cuts all-cause mortality ~15% — the minimum effective dose is small.',
    cite: 'Momma 2022',
    tags: ['health', 'longevity', 'maintain'],
  },

  // ── FOREARMS / GRIP ───────────────────────────────────────────────────────
  forearm_grip: {
    insight: 'Grip is often the limiter on rows and pulls — direct wrist curls and loaded carries build forearm size and grip, and they recover fast so train them often.',
    cite: 'Forearm training consensus',
    tags: ['forearms', 'grip', 'wrist_curl', 'carry'],
  },
  forearm_balance: {
    insight: 'Balance wrist-flexor work (wrist curls) with extensor/supinator work (reverse and Zottman curls) to keep the elbows healthy and forearms developed all round.',
    cite: 'Elbow-health consensus',
    tags: ['forearms', 'reverse_curl', 'zottman', 'elbow'],
  },
};

// Compact evidence base for the AI coach context — every insight + citation,
// grouped, so the coach grounds answers in THIS instead of its own knowledge.
export function formatEvidenceBase() {
  return Object.values(STUDIES)
    .map(s => `  - ${s.insight} (${s.cite})`)
    .join('\n');
}

// Findings matching ANY of the given tags — used by exercise-card tips (phase 2)
// and to surface the most relevant studies for a given exercise/muscle.
export function getStudiesByTags(tags = [], limit = 0) {
  if (!tags.length) return [];
  const wanted = new Set(tags.map(t => String(t).toLowerCase()));
  const hits = Object.entries(STUDIES)
    .filter(([, s]) => (s.tags || []).some(t => wanted.has(t.toLowerCase())))
    .map(([id, s]) => ({ id, ...s }));
  return limit > 0 ? hits.slice(0, limit) : hits;
}

// The single most relevant finding for an exercise. Matched in two passes so a
// secondary muscle can never hijack the tip (e.g. the triceps worked by a bench
// press must not turn it into a triceps tip):
//   1. NAME rules — region-specific, only fire on unambiguous name cues.
//   2. PRIMARY-muscle fallback — the first listed muscle only.
// Returns { id, ...finding } or null. No per-exercise tagging required.
const NAME_RULES = [
  [/overhead.*(extension|tricep)|skull ?crusher|french press|katana/, 'triceps_longhead_overhead'],
  [/lower chest|crossover|\bdecline (barbell|dumbbell|machine|press)|high.?to.?low/, 'chest_cable_lower'],
  [/(incline|low.?to.?high).*(cable|fly)/, 'chest_cable_upper'],
  [/(incline|behind|drag).*curl/, 'biceps_lengthened'],
  [/standing calf|calf raise|calves/, 'calves_stretch'],
  [/hip thrust|glute bridge|kickback|hip extension/, 'glutes_thrust_and_rdl'],
  [/romanian|\brdl\b|stiff.?leg|good ?morning/, 'hamstrings_hinge_vs_curl'],
  [/leg extension/, 'quads_need_both'],
  [/lateral raise|rear delt|face pull|reverse (cable )?fl(y|ye)|y raise/, 'delts_need_isolation'],
  [/cable crunch|ab wheel|crunch|leg raise|sit-?up|hanging knee/, 'abs_direct_work'],
  [/pulldown|pull-?up|chin-?up|\brow\b/, 'back_two_directions'],
  [/reverse curl|zottman|reverse wrist/, 'forearm_balance'],
  [/wrist curl|farmer|carry|grip/, 'forearm_grip'],
];
const MUSCLE_RULES = [
  [/tricep/, 'triceps_longhead_overhead'],
  [/bicep|brachialis/, 'biceps_lengthened'],
  [/quad/, 'quads_need_both'],
  [/hamstring/, 'hamstrings_hinge_vs_curl'],
  [/glute/, 'glutes_thrust_and_rdl'],
  [/calf|calves|gastroc|soleus/, 'calves_stretch'],
  [/delt|shoulder|trap/, 'delts_need_isolation'],
  [/lat|back/, 'back_two_directions'],
  [/ab|core|oblique/, 'abs_direct_work'],
  [/forearm|grip|wrist|brachioradialis/, 'forearm_grip'],
  [/chest|pec/, 'chest_regions'],
];
export function getExerciseInsight(exercise) {
  const name = (exercise?.name || '').toLowerCase();
  for (const [re, id] of NAME_RULES) {
    if (re.test(name) && STUDIES[id]) return { id, ...STUDIES[id] };
  }
  const primary = (exercise?.primaryMuscles?.[0]
    || (exercise?.muscles || '').split(/[,/]/)[0] || '').toLowerCase().trim();
  for (const [re, id] of MUSCLE_RULES) {
    if (re.test(primary) && STUDIES[id]) return { id, ...STUDIES[id] };
  }
  return null;
}
