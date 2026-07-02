// Health conditions database — ordered simple to severe within each region.
// Each condition entry:
//   key         — internal identifier
//   label       — plain English name shown to user
//   desc        — one-line explanation of what it is
//   canBePost   — whether surgery is a possible severity for this condition
//   alwaysPost  — condition IS the surgery (e.g. knee replacement)
//   isVariable  — condition fluctuates day-to-day (triggers pre-workout check-in Layer 3)

export const CONDITIONS_DB = {
  knee: {
    label: 'Knee',
    conditions: [
      { key: 'knee_stiffness',      label: 'General stiffness or aching',       desc: 'Tightness or dull ache, no specific injury',          canBePost: false, isVariable: true  },
      { key: 'knee_runners',        label: "Runner's knee",                      desc: 'Pain around or behind the kneecap',                   canBePost: false, isVariable: true  },
      { key: 'knee_meniscus',       label: 'Meniscus issue',                     desc: 'Cartilage that cushions the knee joint',              canBePost: true,  isVariable: true  },
      { key: 'knee_ligament',       label: 'Ligament injury (ACL / MCL / PCL)', desc: 'Torn or damaged knee ligament',                       canBePost: true,  isVariable: false },
      { key: 'knee_osteoarthritis', label: 'Osteoarthritis',                     desc: 'Joint wear — bone-on-bone grinding',                  canBePost: false, isVariable: true  },
      { key: 'knee_replacement',    label: 'Knee replacement surgery',           desc: 'Full or partial joint replacement',                   canBePost: true,  alwaysPost: true, isVariable: false },
    ],
  },
  shoulder: {
    label: 'Shoulder',
    conditions: [
      { key: 'shoulder_pain',        label: 'General shoulder pain',             desc: 'Aching or discomfort, no specific diagnosis',         canBePost: false, isVariable: true  },
      { key: 'shoulder_impingement', label: 'Impingement',                       desc: 'Pinching on overhead or pressing movements',          canBePost: false, isVariable: true  },
      { key: 'shoulder_ac',          label: 'AC joint injury',                   desc: 'Top of shoulder where collarbone meets',              canBePost: false, isVariable: true  },
      { key: 'shoulder_rotator',     label: 'Rotator cuff issue',                desc: 'Tear or strain in the rotator cuff tendons',          canBePost: true,  isVariable: true  },
      { key: 'shoulder_labrum',      label: 'Labrum tear (SLAP / Bankart)',       desc: 'Cartilage ring around the shoulder socket',           canBePost: true,  isVariable: false },
      { key: 'shoulder_instability', label: 'Instability / dislocations',        desc: 'Shoulder that slips out or feels unstable',           canBePost: true,  isVariable: true  },
    ],
  },
  lower_back: {
    label: 'Lower back',
    conditions: [
      { key: 'lower_back_pain',     label: 'General lower back pain',            desc: 'Aching or stiffness in the lumbar area',             canBePost: false, isVariable: true  },
      { key: 'lower_back_sciatica', label: 'Sciatica',                           desc: 'Shooting pain down one leg from the lower back',     canBePost: false, isVariable: true  },
      { key: 'lower_back_disc',     label: 'Disc herniation or bulge',           desc: 'Spinal disc pressing on a nerve',                    canBePost: true,  isVariable: true  },
      { key: 'lower_back_spondylo', label: 'Spondylolisthesis',                  desc: 'Vertebra slipped forward over another',              canBePost: true,  isVariable: false },
      { key: 'lower_back_fusion',   label: 'Spinal fusion surgery',              desc: 'Two or more vertebrae surgically fused',             canBePost: true,  alwaysPost: true, isVariable: false },
    ],
  },
  neck: {
    label: 'Neck',
    conditions: [
      { key: 'neck_pain', label: 'General neck pain',        desc: 'Stiffness or discomfort in the cervical area',    canBePost: false, isVariable: true  },
      { key: 'neck_disc', label: 'Cervical disc herniation', desc: 'Disc in the neck pressing on a nerve',            canBePost: true,  isVariable: true  },
    ],
  },
  hip: {
    label: 'Hip',
    conditions: [
      { key: 'hip_pain',        label: 'General hip pain',           desc: 'Aching in the hip joint or surrounding area',        canBePost: false, isVariable: true  },
      { key: 'hip_impingement', label: 'Hip impingement (FAI)',       desc: 'Bone-on-bone pinching in the hip joint',              canBePost: false, isVariable: true  },
      { key: 'hip_labrum',      label: 'Labrum tear',                 desc: 'Cartilage ring around the hip socket',               canBePost: true,  isVariable: false },
      { key: 'hip_replacement', label: 'Hip replacement surgery',     desc: 'Full or partial hip joint replacement',              canBePost: true,  alwaysPost: true, isVariable: false },
    ],
  },
  elbow: {
    label: 'Elbow',
    conditions: [
      { key: 'elbow_tennis', label: 'Tennis elbow',          desc: 'Pain on the outer elbow (lateral epicondylitis)',     canBePost: false, isVariable: true  },
      { key: 'elbow_golfers', label: "Golfer's elbow",        desc: 'Pain on the inner elbow (medial epicondylitis)',      canBePost: false, isVariable: true  },
      { key: 'elbow_bicep',  label: 'Bicep tendon issue',    desc: 'Pain at the front of the elbow where bicep attaches', canBePost: true,  isVariable: true  },
    ],
  },
  wrist: {
    label: 'Wrist',
    conditions: [
      { key: 'wrist_pain',   label: 'Wrist pain or weakness', desc: 'General pain or instability in the wrist',            canBePost: false, isVariable: true  },
      { key: 'wrist_carpal', label: 'Carpal tunnel syndrome', desc: 'Numbness or tingling from nerve compression',          canBePost: true,  isVariable: true  },
    ],
  },
  upper_back: {
    label: 'Upper back',
    conditions: [
      { key: 'upper_back_pain', label: 'Upper back pain', desc: 'Aching or tightness between the shoulder blades',       canBePost: false, isVariable: true  },
      { key: 'scoliosis',       label: 'Scoliosis',        desc: 'Sideways curvature of the spine',                      canBePost: true,  isVariable: false },
    ],
  },
  hamstring: {
    label: 'Hamstring',
    conditions: [
      { key: 'hamstring_strain', label: 'Hamstring strain',       desc: 'Pulled or strained hamstring muscle',              canBePost: false, isVariable: true  },
      { key: 'hamstring_tendon', label: 'Hamstring tendinopathy', desc: 'Pain at the top of the hamstring attachment',      canBePost: false, isVariable: true  },
    ],
  },
  ankle: {
    label: 'Ankle / Foot',
    conditions: [
      { key: 'ankle_sprain', label: 'Ankle sprain',          desc: 'Rolled ankle — ligament stretch or tear',             canBePost: false, isVariable: true  },
      { key: 'achilles',     label: 'Achilles tendon issue', desc: 'Pain at the back of the heel',                        canBePost: true,  isVariable: true  },
      { key: 'plantar',      label: 'Plantar fasciitis',     desc: 'Pain along the underside of the heel',                canBePost: false, isVariable: true  },
    ],
  },
  shin: {
    label: 'Shin',
    conditions: [
      { key: 'shin_splints', label: 'Shin splints', desc: 'Pain along the shin bone during or after exercise',           canBePost: false, isVariable: true  },
    ],
  },
  groin: {
    label: 'Groin',
    conditions: [
      { key: 'groin_strain', label: 'Groin strain',     desc: 'Pulled inner thigh or adductor muscle',                   canBePost: false, isVariable: true  },
      { key: 'groin_hernia', label: 'Inguinal hernia',  desc: 'Tissue pushing through a weak spot in the lower abdomen', canBePost: true,  isVariable: false },
    ],
  },
};

// Severities available per condition.
// alwaysPost conditions skip the severity picker and go straight to post-op timeline.
export const SEVERITY_OPTIONS = [
  { key: 'mild',     label: 'Mild',     desc: 'Present but I train around it' },
  { key: 'moderate', label: 'Moderate', desc: 'Affects certain exercises' },
  { key: 'severe',   label: 'Severe',   desc: 'Major restriction or constant pain' },
];

export const POST_OP_TIMELINE_OPTIONS = [
  { key: 'under_3m', label: 'Under 3 months',  desc: 'Recent — still in recovery' },
  { key: '3_12m',    label: '3 – 12 months',   desc: 'Recovering, some restrictions remain' },
  { key: 'over_1y',  label: 'Over 1 year',     desc: 'Mostly recovered, residual limitations' },
];

// Maps a structured condition entry to the legacy condition keys
// used by the program generator's CONTRAINDICATION_MAP.
// entry = { conditionKey, severity, postOp, postOpTimeline }
export function deriveConditionKeys(entry) {
  const { conditionKey, severity, postOp, postOpTimeline } = entry;

  const postKey = postOp
    ? (postOpTimeline === 'under_3m' ? 'post_early' : postOpTimeline === '3_12m' ? 'post_mid' : 'post_late')
    : null;
  const lookupKey = postKey || severity || 'mild';

  const MAP = {
    // ── Knee ──────────────────────────────────────────────────────────────────
    knee_stiffness: {
      mild:     [],
      moderate: ['patellofemoral_syndrome'],
    },
    knee_runners: {
      mild:     ['patellofemoral_syndrome'],
      moderate: ['patellofemoral_syndrome'],
      severe:   ['patellofemoral_syndrome', 'severe_knee_osteoarthritis'],
    },
    knee_meniscus: {
      mild:       ['patellofemoral_syndrome'],
      moderate:   ['patellofemoral_syndrome', 'severe_knee_osteoarthritis'],
      severe:     ['severe_knee_osteoarthritis'],
      post_early: ['knee_replacement', 'severe_knee_osteoarthritis'],
      post_mid:   ['severe_knee_osteoarthritis'],
      post_late:  ['patellofemoral_syndrome'],
    },
    knee_ligament: {
      moderate:   ['patellofemoral_syndrome', 'severe_knee_osteoarthritis'],
      severe:     ['severe_knee_osteoarthritis'],
      post_early: ['knee_replacement', 'severe_knee_osteoarthritis'],
      post_mid:   ['severe_knee_osteoarthritis'],
      post_late:  ['patellofemoral_syndrome'],
    },
    knee_osteoarthritis: {
      mild:     ['patellofemoral_syndrome'],
      moderate: ['patellofemoral_syndrome', 'severe_knee_osteoarthritis'],
      severe:   ['knee_replacement', 'severe_knee_osteoarthritis'],
    },
    knee_replacement: {
      post_early: ['knee_replacement', 'severe_knee_osteoarthritis'],
      post_mid:   ['knee_replacement', 'severe_knee_osteoarthritis'],
      post_late:  ['severe_knee_osteoarthritis'],
    },

    // ── Shoulder ──────────────────────────────────────────────────────────────
    shoulder_pain: {
      mild:     ['shoulder_impingement'],
      moderate: ['shoulder_impingement'],
      severe:   ['shoulder_impingement', 'ac_joint_injury'],
    },
    shoulder_impingement: {
      mild:     ['shoulder_impingement'],
      moderate: ['shoulder_impingement'],
      severe:   ['shoulder_impingement', 'ac_joint_injury'],
    },
    shoulder_ac: {
      mild:     ['ac_joint_injury'],
      moderate: ['ac_joint_injury', 'shoulder_impingement'],
      severe:   ['ac_joint_injury', 'shoulder_impingement'],
    },
    shoulder_rotator: {
      mild:       ['shoulder_impingement'],
      moderate:   ['shoulder_impingement', 'rotator_cuff_tear'],
      severe:     ['rotator_cuff_tear', 'shoulder_impingement'],
      post_early: ['rotator_cuff_tear', 'shoulder_impingement', 'shoulder_instability'],
      post_mid:   ['rotator_cuff_tear', 'shoulder_impingement'],
      post_late:  ['shoulder_impingement'],
    },
    shoulder_labrum: {
      moderate:   ['shoulder_instability', 'shoulder_impingement'],
      severe:     ['shoulder_instability', 'rotator_cuff_tear'],
      post_early: ['shoulder_instability', 'rotator_cuff_tear', 'shoulder_impingement'],
      post_mid:   ['shoulder_instability', 'shoulder_impingement'],
      post_late:  ['shoulder_impingement'],
    },
    shoulder_instability: {
      mild:       ['shoulder_instability'],
      moderate:   ['shoulder_instability', 'shoulder_impingement'],
      severe:     ['shoulder_instability', 'rotator_cuff_tear'],
      post_early: ['shoulder_instability', 'rotator_cuff_tear', 'shoulder_impingement'],
      post_mid:   ['shoulder_instability', 'shoulder_impingement'],
      post_late:  ['shoulder_instability'],
    },

    // ── Lower back ────────────────────────────────────────────────────────────
    lower_back_pain: {
      mild:     [],
      moderate: ['sciatica'],
      severe:   ['lower_back_disc_herniation'],
    },
    lower_back_sciatica: {
      mild:     ['sciatica'],
      moderate: ['sciatica', 'lower_back_disc_herniation'],
      severe:   ['lower_back_disc_herniation', 'spondylolisthesis'],
    },
    lower_back_disc: {
      mild:       ['sciatica'],
      moderate:   ['lower_back_disc_herniation'],
      severe:     ['lower_back_disc_herniation', 'spondylolisthesis'],
      post_early: ['lower_back_disc_herniation', 'spondylolisthesis'],
      post_mid:   ['lower_back_disc_herniation'],
      post_late:  ['sciatica'],
    },
    lower_back_spondylo: {
      mild:     ['sciatica'],
      moderate: ['lower_back_disc_herniation', 'spondylolisthesis'],
      severe:   ['lower_back_disc_herniation', 'spondylolisthesis'],
    },
    lower_back_fusion: {
      post_early: ['lower_back_disc_herniation', 'spondylolisthesis'],
      post_mid:   ['lower_back_disc_herniation'],
      post_late:  ['sciatica'],
    },

    // ── Hip ───────────────────────────────────────────────────────────────────
    hip_pain:        { mild: [], moderate: ['hip_labral_tear'], severe: ['hip_labral_tear'] },
    hip_impingement: { mild: [], moderate: ['hip_labral_tear'], severe: ['hip_labral_tear'] },
    hip_labrum: {
      moderate:   ['hip_labral_tear'],
      severe:     ['hip_labral_tear'],
      post_early: ['bilateral_hip_replacement', 'hip_labral_tear'],
      post_mid:   ['hip_labral_tear'],
      post_late:  [],
    },
    hip_replacement: {
      post_early: ['bilateral_hip_replacement'],
      post_mid:   ['bilateral_hip_replacement'],
      post_late:  ['hip_labral_tear'],
    },

    // ── Elbow ─────────────────────────────────────────────────────────────────
    elbow_tennis:  { mild: ['lateral_epicondylitis'], moderate: ['lateral_epicondylitis'], severe: ['lateral_epicondylitis', 'medial_epicondylitis'] },
    elbow_golfers: { mild: ['medial_epicondylitis'],  moderate: ['medial_epicondylitis'],  severe: ['lateral_epicondylitis', 'medial_epicondylitis'] },
    elbow_bicep:   { mild: ['bicep_tendinopathy'],    moderate: ['bicep_tendinopathy'],    severe: ['bicep_tendinopathy'], post_early: ['bicep_tendinopathy'], post_mid: ['bicep_tendinopathy'], post_late: [] },

    // ── Wrist ─────────────────────────────────────────────────────────────────
    wrist_pain:   { mild: ['wrist_injury'], moderate: ['wrist_injury'], severe: ['wrist_injury', 'carpal_tunnel_syndrome'] },
    wrist_carpal: { mild: ['carpal_tunnel_syndrome'], moderate: ['wrist_injury', 'carpal_tunnel_syndrome'], severe: ['wrist_injury', 'carpal_tunnel_syndrome'], post_early: ['wrist_injury', 'carpal_tunnel_syndrome'], post_mid: ['carpal_tunnel_syndrome'], post_late: [] },

    // ── Other (minimal program impact — captured for AI coach context) ─────────
    upper_back_pain:   { mild: [], moderate: [], severe: [] },
    scoliosis:         { mild: [], moderate: ['sciatica'], severe: ['lower_back_disc_herniation'] },
    neck_pain:         { mild: [], moderate: [], severe: [] },
    neck_disc:         { mild: ['cervical_disc_herniation'], moderate: ['cervical_disc_herniation'], severe: ['cervical_disc_herniation'], post_early: ['cervical_disc_herniation'], post_mid: ['cervical_disc_herniation'], post_late: [] },
    hamstring_strain:  { mild: [], moderate: ['proximal_hamstring_tendinopathy'], severe: ['proximal_hamstring_tendinopathy'] },
    hamstring_tendon:  { mild: ['proximal_hamstring_tendinopathy'], moderate: ['proximal_hamstring_tendinopathy'], severe: ['proximal_hamstring_tendinopathy'] },
    ankle_sprain:      { mild: [], moderate: ['achilles_tendinopathy'], severe: ['achilles_tendinopathy'] },
    achilles:          { mild: ['achilles_tendinopathy'], moderate: ['achilles_tendinopathy'], severe: ['achilles_tendinopathy'], post_early: ['achilles_tendinopathy'], post_mid: ['achilles_tendinopathy'], post_late: [] },
    plantar:           { mild: ['plantar_fasciitis'], moderate: ['plantar_fasciitis'], severe: ['plantar_fasciitis'] },
    shin_splints:      { mild: [], moderate: [], severe: [] },
    groin_strain:      { mild: [], moderate: ['inguinal_hernia'], severe: ['inguinal_hernia'] },
    groin_hernia:      { mild: ['inguinal_hernia'], moderate: ['inguinal_hernia'], severe: ['inguinal_hernia'], post_early: ['inguinal_hernia'], post_mid: ['inguinal_hernia'], post_late: [] },
  };

  const condMap = MAP[conditionKey];
  if (!condMap) return [];
  return [...new Set(condMap[lookupKey] || condMap[severity] || [])];
}

// Returns a human-readable summary label for a stored entry.
export function conditionSummaryLabel(entry) {
  const region = CONDITIONS_DB[entry.region];
  const cond = region?.conditions.find(c => c.key === entry.conditionKey);
  if (!cond) return entry.conditionKey;
  const parts = [cond.label];
  if (entry.postOp) {
    const tl = POST_OP_TIMELINE_OPTIONS.find(t => t.key === entry.postOpTimeline);
    parts.push(`post-op ${tl?.label?.toLowerCase() || ''}`);
  } else if (entry.severity) {
    parts.push(entry.severity);
  }
  return parts.join(' — ');
}

// Expands an array of stored condition entries (either structured objects
// stored as JSON strings, new-format region_severity strings, or legacy keys)
// into the flat array of program generator keys.
export function expandAllConditions(rawConditions) {
  const keys = [];
  for (const raw of rawConditions) {
    if (!raw || raw === 'none') continue;
    // Try structured JSON
    try {
      const parsed = JSON.parse(raw);
      if (parsed.conditionKey) {
        keys.push(...deriveConditionKeys(parsed));
        continue;
      }
    } catch (_) {}
    // Already a legacy key — pass through
    keys.push(raw);
  }
  return [...new Set(keys)];
}
