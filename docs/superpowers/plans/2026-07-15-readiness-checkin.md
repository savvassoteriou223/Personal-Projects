# Readiness Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask 3 taps before the first workout of the day, and use the answer to adjust *today's* session (effort + set count) — restoring the dead `'recovery'` branch of the proactive coach loop without any health permissions.

**Architecture:** All logic lives in a pure, dependency-free `lib/readiness.js` (scoring + session transform) so it is unit-testable with Node's built-in test runner. A presentational `screens/RecoveryCheckIn.jsx` sheet renders inside `WorkoutExecutionScreen` — the single funnel that all three workout entry points mount, so nothing can bypass it and it already owns the live session state. Answers persist to a new `recovery_checkins` table, which re-feeds the existing proactive-coach card and the AI coach's context.

**Tech Stack:** React Native / Expo (JS, ESM), Supabase (Postgres + RLS), i18next, `node:test` (built in — no new dependencies).

## Global Constraints

Every task's requirements implicitly include these.

- **Never adjust load/weight.** `exerciseToSetState` has no weight field; the weight input is a `placeholder` hint and the user types the value. Any load adjustment is theatre. Adjust only `last_rpe` and `target_sets`.
- **Labels are stable English for LOGIC:** `'Ready' | 'Moderate' | 'Low'` — matching `buildRecoveryStatus()` (`lib/healthService.js:287-297`) and `getProactiveCoachPrompt`'s `recoveryLabel === 'Low'` check (`screens/programGenerator.js:1613`). **Display text must be translated separately via `t()`.** Never compare a translated string in logic (this is an existing bug — see Task 5).
- **Session-only.** Never write `program_template_overrides`. The adjustment is a local transform of `sets` state and dies with the session.
- **Persistence is best-effort.** Never block starting a workout on a network call.
- **Floors:** `last_rpe` minimum 6; `target_sets` minimum 1.
- **Use `lib/theme.js` tokens** (`colors.*`, `spacing.*`, `radius.*`), never raw hex.
- **Migrations are applied manually** in the Supabase dashboard. Committing the `.sql` file does not apply it.
- **No new npm dependencies.**

---

### Task 1: Pure readiness logic + test harness

**Files:**
- Create: `lib/readiness.js`
- Create: `lib/readiness.test.js`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing (pure module, no imports).
- Produces:
  - `scoreCheckIn({ sleep, soreness, energy }) → { score: number, label: 'Ready'|'Moderate'|'Low' }`
    where `sleep ∈ 'good'|'ok'|'poor'`, `soreness ∈ 'fresh'|'normal'|'sore'`, `energy ∈ 'high'|'ok'|'low'`
  - `adjustSessionForReadiness(sets, label) → sets` — returns a NEW array; identity-returns the input when `label === 'Ready'`.
  - `READINESS_QUESTIONS` — array used by the UI to render.

- [ ] **Step 1: Write the failing test**

Create `lib/readiness.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCheckIn, adjustSessionForReadiness } from './readiness.js';

const mkSets = () => ([
  {
    name: 'Bench press', target_sets: 3, target_reps: '8', rest: '2–3 min',
    early_rpe: 7, last_rpe: 9,
    completedSets: [
      { weight: '', reps: '', done: false, type: 'working' },
      { weight: '', reps: '', done: false, type: 'working' },
      { weight: '', reps: '', done: false, type: 'working' },
    ],
  },
]);

test('scoreCheckIn: all good is Ready', () => {
  assert.deepEqual(scoreCheckIn({ sleep: 'good', soreness: 'fresh', energy: 'high' }),
    { score: 6, label: 'Ready' });
});

test('scoreCheckIn: all poor is Low', () => {
  assert.deepEqual(scoreCheckIn({ sleep: 'poor', soreness: 'sore', energy: 'low' }),
    { score: 0, label: 'Low' });
});

test('scoreCheckIn: boundaries 5=Ready 4=Moderate 3=Moderate 2=Low', () => {
  assert.equal(scoreCheckIn({ sleep: 'good', soreness: 'fresh', energy: 'ok' }).label, 'Ready');   // 5
  assert.equal(scoreCheckIn({ sleep: 'good', soreness: 'normal', energy: 'ok' }).label, 'Moderate'); // 4
  assert.equal(scoreCheckIn({ sleep: 'ok', soreness: 'normal', energy: 'ok' }).label, 'Moderate');   // 3
  assert.equal(scoreCheckIn({ sleep: 'poor', soreness: 'normal', energy: 'low' }).label, 'Low');     // 1
});

test('scoreCheckIn: unknown answers score 0, never throw', () => {
  assert.equal(scoreCheckIn({}).label, 'Low');
  assert.equal(scoreCheckIn({ sleep: 'banana' }).score, 0);
});

test('adjustSessionForReadiness: Ready changes nothing', () => {
  const sets = mkSets();
  assert.equal(adjustSessionForReadiness(sets, 'Ready'), sets);
});

test('adjustSessionForReadiness: Moderate lowers last_rpe by 2, keeps sets', () => {
  const out = adjustSessionForReadiness(mkSets(), 'Moderate');
  assert.equal(out[0].last_rpe, 7);
  assert.equal(out[0].early_rpe, 7, 'early_rpe untouched');
  assert.equal(out[0].target_sets, 3);
  assert.equal(out[0].completedSets.length, 3);
});

test('adjustSessionForReadiness: Low lowers rpe AND drops a set', () => {
  const out = adjustSessionForReadiness(mkSets(), 'Low');
  assert.equal(out[0].last_rpe, 7);
  assert.equal(out[0].target_sets, 2);
  assert.equal(out[0].completedSets.length, 2, 'completedSets must match target_sets');
});

test('adjustSessionForReadiness: floors — rpe never below 6, sets never below 1', () => {
  const sets = mkSets();
  sets[0].last_rpe = 7;
  sets[0].target_sets = 1;
  sets[0].completedSets = [{ weight: '', reps: '', done: false, type: 'working' }];
  const out = adjustSessionForReadiness(sets, 'Low');
  assert.equal(out[0].last_rpe, 6);
  assert.equal(out[0].target_sets, 1);
  assert.equal(out[0].completedSets.length, 1);
});

test('adjustSessionForReadiness: never touches weight and does not mutate input', () => {
  const sets = mkSets();
  const out = adjustSessionForReadiness(sets, 'Low');
  assert.equal(sets[0].last_rpe, 9, 'input not mutated');
  assert.equal(sets[0].target_sets, 3, 'input not mutated');
  assert.ok(!('weight' in out[0]), 'no weight key is invented');
  for (const s of out[0].completedSets) assert.equal(s.weight, '', 'set weights untouched');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/readiness.test.js`
Expected: FAIL — `Cannot find module ... readiness.js`

- [ ] **Step 3: Write minimal implementation**

Create `lib/readiness.js`:

```js
// ─── READINESS ────────────────────────────────────────────────────────────────
// Pure scoring + session adjustment. No imports, no I/O — so it runs under
// `node --test` with no test framework and no React Native.
//
// WHY NO WEIGHT ADJUSTMENT: the app never prescribes load. exerciseToSetState
// (WorkoutExecutionScreen.jsx) has no weight field; the weight input is only a
// "last time" placeholder and the user types the number. So "drop 10%" would be
// lowering a value that does not exist, to tell someone to do something they are
// already free to do. We adjust what the app actually prescribes: effort
// (last_rpe) and volume (target_sets). That IS autoregulation — see
// `effort_failure_not_required` (Enes 2024) in studiesLibrary.js.

const SLEEP    = { good: 2, ok: 1, poor: 0 };
const SORENESS = { fresh: 2, normal: 1, sore: 0 };
const ENERGY   = { high: 2, ok: 1, low: 0 };

// Rendered by the check-in sheet. `labelKey`/`optionKeys` are i18n keys —
// the VALUES ('good' etc.) are the stable logic tokens and are never translated.
export const READINESS_QUESTIONS = [
  { id: 'sleep',    labelKey: 'readiness.q.sleep',    options: ['good', 'ok', 'poor'] },
  { id: 'soreness', labelKey: 'readiness.q.soreness', options: ['fresh', 'normal', 'sore'] },
  { id: 'energy',   labelKey: 'readiness.q.energy',   options: ['high', 'ok', 'low'] },
];

const RPE_FLOOR = 6;
const SETS_FLOOR = 1;

// Returns a STABLE English label for logic. Display must translate separately —
// getProactiveCoachPrompt compares recoveryLabel === 'Low'.
export function scoreCheckIn({ sleep, soreness, energy } = {}) {
  const score = (SLEEP[sleep] ?? 0) + (SORENESS[soreness] ?? 0) + (ENERGY[energy] ?? 0);
  const label = score >= 5 ? 'Ready' : score >= 3 ? 'Moderate' : 'Low';
  return { score, label };
}

// Returns a NEW sets array (never mutates). Identity-returns on 'Ready'.
export function adjustSessionForReadiness(sets, label) {
  if (label !== 'Moderate' && label !== 'Low') return sets;
  const dropSet = label === 'Low';
  return sets.map(ex => {
    const nextSets = dropSet ? Math.max(SETS_FLOOR, (ex.target_sets ?? 1) - 1) : ex.target_sets;
    return {
      ...ex,
      last_rpe: Math.max(RPE_FLOOR, (ex.last_rpe ?? 9) - 2),
      target_sets: nextSets,
      // completedSets length is derived from target_sets everywhere else in the
      // app, so keep them in lockstep or the UI renders a phantom row.
      completedSets: ex.completedSets.slice(0, nextSets),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/readiness.test.js`
Expected: PASS — `# pass 8`, `# fail 0`

- [ ] **Step 5: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "node --test lib/**/*.test.js"
```

Run: `npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/readiness.js lib/readiness.test.js package.json
git commit -m "Add pure readiness scoring + session adjustment (RPE/sets, never load)"
```

---

### Task 2: Migration + persistence module

**Files:**
- Create: `supabase/migrations/add_recovery_checkins.sql`
- Create: `lib/recoveryStore.js`

**Interfaces:**
- Consumes: `scoreCheckIn` result shape from Task 1 (`{ score, label }`); `supabase` from `../supabase`.
- Produces:
  - `getTodayCheckIn() → Promise<row|null>` — row has `{ sleep, soreness, energy, score, label, skipped }`
  - `saveCheckIn({ sleep, soreness, energy, score, label, skipped, applied }) → Promise<void>` — never throws
  - `getRecentCheckIns(days = 7) → Promise<row[]>`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/add_recovery_checkins.sql`:

```sql
-- Self-reported readiness. Replaces the sensor input lost when Health Connect
-- was removed (2026-07-14) — feeds the proactive coach card and coach context.
-- A separate table (not daily_health_logs) because that table upserts on
-- (user_id, date) and is still written from HealthKit on iOS, so a check-in
-- would collide with a sensor row; it is also sensor-shaped, not categorical.
create table if not exists recovery_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep text,      -- 'good' | 'ok' | 'poor'   (null when skipped)
  soreness text,   -- 'fresh' | 'normal' | 'sore'
  energy text,     -- 'high' | 'ok' | 'low'
  score int,       -- 0-6                       (null when skipped)
  label text,      -- 'Ready' | 'Moderate' | 'Low' (stable English, not translated)
  skipped boolean not null default false,
  applied boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table recovery_checkins enable row level security;

drop policy if exists "own checkins" on recovery_checkins;
create policy "own checkins" on recovery_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Write the persistence module**

Create `lib/recoveryStore.js`:

```js
// Persistence for readiness check-ins. Every function is best-effort: a network
// failure must never block someone from starting their workout.
import { supabase, getCurrentUser } from '../supabase';

const today = () => {
  const d = new Date(); // local date, not UTC — matches TodayScreen's convention
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export async function getTodayCheckIn() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data } = await supabase
      .from('recovery_checkins')
      .select('sleep, soreness, energy, score, label, skipped')
      .eq('user_id', user.id)
      .eq('date', today())
      .maybeSingle();
    return data ?? null;
  } catch { return null; }
}

export async function saveCheckIn({ sleep = null, soreness = null, energy = null, score = null, label = null, skipped = false, applied = false }) {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    await supabase.from('recovery_checkins').upsert({
      user_id: user.id, date: today(), sleep, soreness, energy, score, label, skipped, applied,
    }, { onConflict: 'user_id,date' });
  } catch { /* best-effort: never block training */ }
}

export async function getRecentCheckIns(days = 7) {
  try {
    const user = await getCurrentUser();
    if (!user) return [];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const p = (n) => String(n).padStart(2, '0');
    const sinceStr = `${since.getFullYear()}-${p(since.getMonth() + 1)}-${p(since.getDate())}`;
    const { data } = await supabase
      .from('recovery_checkins')
      .select('date, sleep, soreness, energy, score, label, skipped')
      .eq('user_id', user.id)
      .gte('date', sinceStr)
      .order('date', { ascending: false });
    return data ?? [];
  } catch { return []; }
}
```

- [ ] **Step 3: Verify it parses**

Run: `node --check lib/recoveryStore.js`
Expected: no output (success).

- [ ] **Step 4: Apply the migration MANUALLY**

Open the Supabase dashboard → SQL Editor → paste the contents of `supabase/migrations/add_recovery_checkins.sql` → Run.
Verify: Table Editor shows `recovery_checkins` with RLS enabled.
**This is a human step. Committing the file does not apply it.**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/add_recovery_checkins.sql lib/recoveryStore.js
git commit -m "Add recovery_checkins table + best-effort persistence module"
```

---

### Task 3: The check-in sheet UI

**Files:**
- Create: `screens/RecoveryCheckIn.jsx`
- Modify: `locales/en.json` (add a `readiness` block)

**Interfaces:**
- Consumes: `READINESS_QUESTIONS`, `scoreCheckIn` (Task 1); `colors`, `spacing`, `radius` from `lib/theme`.
- Produces: default export `<RecoveryCheckIn visible onSkip onDone />` where
  `onDone({ answers: {sleep,soreness,energy}, score, label, applied })` fires when the user finishes.
  Purely presentational — it does no I/O and does not touch session state.

- [ ] **Step 1: Add the English copy**

In `locales/en.json`, add a top-level `"readiness"` block (i18next falls back to English for the other 7 locales until translated):

```json
"readiness": {
  "title": "How are you today?",
  "skip": "Skip",
  "continue": "Continue",
  "q": { "sleep": "Sleep", "soreness": "Soreness", "energy": "Energy" },
  "opt": {
    "good": "Good", "ok": "OK", "poor": "Poor",
    "fresh": "Fresh", "normal": "Normal", "sore": "Sore",
    "high": "High", "low": "Low"
  },
  "label": { "Ready": "Ready", "Moderate": "Moderate", "Low": "Low" },
  "adviceModerate": "Take today's working sets a bit easier — stop about 3 reps short instead of 1.",
  "adviceLow": "Rough day. Stop about 3 reps short and drop the last set of each exercise.",
  "apply": "Adjust today",
  "asPlanned": "Train as planned",
  "adjusted": "ADJUSTED FOR RECOVERY"
}
```

- [ ] **Step 2: Write the component**

Create `screens/RecoveryCheckIn.jsx`:

```jsx
// Pre-workout readiness sheet. Presentational only: it reports the result
// upward and never writes to the DB or mutates session state.
import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { READINESS_QUESTIONS, scoreCheckIn } from '../lib/readiness';
import { colors, spacing, radius } from '../lib/theme';

const LABEL_COLOR = { Ready: colors.accent, Moderate: colors.warning, Low: colors.danger };

export default function RecoveryCheckIn({ visible, onSkip, onDone }) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null); // { score, label } once submitted

  const allAnswered = READINESS_QUESTIONS.every(q => answers[q.id]);

  const submit = () => {
    const r = scoreCheckIn(answers);
    // 'Ready' has nothing to say — don't interrupt someone who feels fine.
    if (r.label === 'Ready') onDone({ answers, ...r, applied: false });
    else setResult(r);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.grab} />
          {!result ? (
            <>
              <Text style={s.title}>{t('readiness.title')}</Text>
              {READINESS_QUESTIONS.map(q => (
                <View key={q.id} style={s.q}>
                  <Text style={s.qLabel}>{t(q.labelKey)}</Text>
                  <View style={s.opts}>
                    {q.options.map(opt => {
                      const on = answers[q.id] === opt;
                      return (
                        <Pressable
                          key={opt}
                          style={[s.opt, on && s.optOn]}
                          hitSlop={6}
                          onPress={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                        >
                          <Text style={[s.optText, on && s.optTextOn]}>{t(`readiness.opt.${opt}`)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <View style={s.row}>
                <Pressable style={[s.btn, s.btnGhost]} onPress={onSkip} hitSlop={8}>
                  <Text style={s.btnGhostText}>{t('readiness.skip')}</Text>
                </Pressable>
                <Pressable
                  style={[s.btn, s.btnPrimary, !allAnswered && s.btnDisabled]}
                  disabled={!allAnswered}
                  onPress={submit}
                  hitSlop={8}
                >
                  <Text style={s.btnPrimaryText}>{t('readiness.continue')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={[s.title, { color: LABEL_COLOR[result.label] }]}>
                {t(`readiness.label.${result.label}`)}
              </Text>
              <Text style={s.advice}>
                {result.label === 'Low' ? t('readiness.adviceLow') : t('readiness.adviceModerate')}
              </Text>
              <View style={s.row}>
                <Pressable style={[s.btn, s.btnGhost]} hitSlop={8}
                  onPress={() => onDone({ answers, ...result, applied: false })}>
                  <Text style={s.btnGhostText}>{t('readiness.asPlanned')}</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnAccent]} hitSlop={8}
                  onPress={() => onDone({ answers, ...result, applied: true })}>
                  <Text style={s.btnPrimaryText}>{t('readiness.apply')}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['3xl'],
  },
  grab: { width: 34, height: 4, borderRadius: 2, backgroundColor: colors.control, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  q: { marginBottom: spacing.md },
  qLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
  opts: { flexDirection: 'row', gap: spacing.sm },
  opt: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  optOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optText: { fontSize: 12, color: colors.textSubtle },
  optTextOn: { color: colors.textOnAccent, fontWeight: '700' },
  advice: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center' },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.textPrimary },
  btnPrimaryText: { color: colors.textOnLight, fontSize: 14, fontWeight: '700' },
  btnAccent: { backgroundColor: colors.accent },
  btnDisabled: { opacity: 0.4 },
});
```

Note: `btnAccent` + `btnPrimaryText` renders white-on-green (`colors.textOnAccent` is also white) — acceptable contrast; `btnPrimary` is white with `textOnLight` (near-black).

- [ ] **Step 3: Verify it parses**

Run: `node -e "require('@babel/parser').parse(require('fs').readFileSync('screens/RecoveryCheckIn.jsx','utf8'),{sourceType:'module',plugins:['jsx']}); console.log('parses')"`
Expected: `parses`

- [ ] **Step 4: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('locales/en.json','utf8')); console.log('en.json valid')"`
Expected: `en.json valid`

- [ ] **Step 5: Commit**

```bash
git add screens/RecoveryCheckIn.jsx locales/en.json
git commit -m "Add readiness check-in sheet (presentational)"
```

---

### Task 4: Wire the sheet into the workout

**Files:**
- Modify: `screens/WorkoutExecutionScreen.jsx`

**Interfaces:**
- Consumes: `RecoveryCheckIn` (Task 3), `adjustSessionForReadiness` (Task 1), `getTodayCheckIn`/`saveCheckIn` (Task 2).
- Produces: nothing consumed by later tasks.

Why here: `TodayScreen` and both `ProgramScreen` paths all call `onStartWorkout` → `setActiveWorkout` → **all mount `WorkoutExecutionScreen`**. It is the single funnel (the coach paywall leak of 2026-07-14 came from gating at call sites instead), and it already owns `sets`.

- [ ] **Step 1: Add the imports**

At the top of `screens/WorkoutExecutionScreen.jsx`, alongside the existing imports:

```jsx
import RecoveryCheckIn from './RecoveryCheckIn';
import { adjustSessionForReadiness } from '../lib/readiness';
import { getTodayCheckIn, saveCheckIn } from '../lib/recoveryStore';
```

- [ ] **Step 2: Add state**

Next to `const [showCoach, setShowCoach] = useState(false);`:

```jsx
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [readinessLabel, setReadinessLabel] = useState(null); // 'Moderate' | 'Low' once applied
```

- [ ] **Step 3: Ask once per day**

Add this effect (after the existing state declarations):

```jsx
  // Readiness check-in — first workout of the day only. Best-effort: if the
  // lookup fails we simply don't ask rather than blocking the workout.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await getTodayCheckIn();
      if (!cancelled && !existing) setShowCheckIn(true);
    })();
    return () => { cancelled = true; };
  }, []);
```

- [ ] **Step 4: Render the sheet**

Just before the closing `</View>` of the component's return (next to the paywall Modal added on 2026-07-14):

```jsx
      {/* Readiness check-in — first workout of the day */}
      <RecoveryCheckIn
        visible={showCheckIn}
        onSkip={() => {
          setShowCheckIn(false);
          saveCheckIn({ skipped: true });
        }}
        onDone={({ answers, score, label, applied }) => {
          setShowCheckIn(false);
          saveCheckIn({ ...answers, score, label, applied });
          if (applied) {
            setSets(prev => adjustSessionForReadiness(prev, label));
            setReadinessLabel(label);
          }
        }}
      />
```

- [ ] **Step 5: Show the badge**

Find the workout header (the element rendering `workout.name`) and add beneath it:

```jsx
      {readinessLabel && (
        <Text style={styles.readinessBadge}>{t('readiness.adjusted')}</Text>
      )}
```

Add to the `StyleSheet.create` block:

```jsx
  readinessBadge: {
    alignSelf: 'flex-start', fontSize: 9, fontWeight: '700', color: '#BA7517',
    backgroundColor: '#BA751522', borderWidth: 1, borderColor: '#BA751540',
    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
```

- [ ] **Step 6: Verify it parses**

Run: `node -e "require('@babel/parser').parse(require('fs').readFileSync('screens/WorkoutExecutionScreen.jsx','utf8'),{sourceType:'module',plugins:['jsx']}); console.log('parses')"`
Expected: `parses`

- [ ] **Step 7: Manual test**

Start the app (`npx expo start`). On a fresh account:
1. Start a workout → sheet appears.
2. Tap **Skip** → workout starts unchanged. Leave and restart the workout → **sheet does NOT reappear** (row exists).
3. New account → answer all worst options → `Low` → **Adjust today** → set rows drop from 3 to 2, badge shows.
4. Answer all best → `Ready` → no suggestion, workout starts immediately.

- [ ] **Step 8: Commit**

```bash
git add screens/WorkoutExecutionScreen.jsx
git commit -m "Show readiness check-in on the first workout of the day"
```

---

### Task 5: Restore the loop (proactive card + coach context) and fix the i18n label bug

**Files:**
- Modify: `screens/TodayScreen.jsx`
- Modify: `screens/CoachScreen.jsx`

**Interfaces:**
- Consumes: `getTodayCheckIn`, `getRecentCheckIns` (Task 2).
- Produces: nothing.

**Pre-existing bug this fixes:** `TodayScreen` builds `readiness.label` from `t('today.readiness.low')` (line ~509) and passes it as `recoveryLabel` into `getProactiveCoachPrompt`, which tests `recoveryLabel === 'Low'`. In German that string is `'Niedrig'`, Spanish `'Bajo'`, French `'Faible'` — **so the recovery nudge has only ever fired in English.** The fix is to pass a stable, untranslated label for logic.

- [ ] **Step 1: Feed the check-in into the proactive card**

In `screens/TodayScreen.jsx`, add the import:

```jsx
import { getTodayCheckIn } from '../lib/recoveryStore';
```

Add state next to `const [readiness, setReadiness] = useState(null);`:

```jsx
  const [checkInLabel, setCheckInLabel] = useState(null); // stable 'Ready'|'Moderate'|'Low'
```

Load it (place next to the other data loading, inside the existing effect that loads screen data):

```jsx
      const todayCheckIn = await getTodayCheckIn();
      setCheckInLabel(todayCheckIn?.skipped ? null : (todayCheckIn?.label ?? null));
```

- [ ] **Step 2: Pass the STABLE label, not the translated one**

Find (line ~167):

```jsx
      recoveryLabel: readiness?.label,
```

Replace with:

```jsx
      // Stable English label for LOGIC — getProactiveCoachPrompt compares
      // recoveryLabel === 'Low'. readiness.label is translated (t('today.readiness.low')),
      // so passing it meant the recovery nudge only ever fired in English.
      // Prefer today's self-reported check-in; fall back to sensor readiness (iOS).
      recoveryLabel: checkInLabel ?? readiness?.stableLabel ?? null,
```

Add `checkInLabel` to that effect's dependency array (it currently ends `[loading, lastSession, deloadSuggestion, plateaus, readiness, profile]`):

```jsx
  }, [loading, lastSession, deloadSuggestion, plateaus, readiness, checkInLabel, profile]);
```

- [ ] **Step 3: Give sensor readiness a stable label too**

In the same file, at the block that builds `status` from the ratio (~line 507), add a `stableLabel` alongside the translated one:

```jsx
              if (ratio >= 0.9) status = { label: t('today.readiness.ready'), stableLabel: 'Ready', color: '#1D9E75', advice: null };
              else if (ratio >= 0.75) status = { label: t('today.readiness.moderate'), stableLabel: 'Moderate', color: '#BA7517', advice: t('today.readiness.adviceModerate') };
              else status = { label: t('today.readiness.low'), stableLabel: 'Low', color: '#E85D5C', advice: t('today.readiness.adviceLow') };
```

`label` stays translated for display; `stableLabel` is for logic only.

- [ ] **Step 4: Feed check-ins into the coach's context**

In `screens/CoachScreen.jsx`, add the import:

```jsx
import { getRecentCheckIns } from '../lib/recoveryStore';
```

In `loadUserData`, after the existing `Promise.all`, add:

```jsx
    const recoveryCheckIns = await getRecentCheckIns(7);
```

Add it to the `data` object (which currently ends `..., nutritionLogs: nutritionLogs || [] }`):

```jsx
      recoveryCheckIns: recoveryCheckIns || [],
```

In `buildContext`, add `recoveryCheckIns = []` to the destructure, and build the lines:

```jsx
    const checkInLines = recoveryCheckIns.length
      ? recoveryCheckIns
          .filter(c => !c.skipped)
          .map(c => `  ${c.date}: ${c.label} (sleep ${c.sleep}, soreness ${c.soreness}, energy ${c.energy})`)
          .join('\n') || '  Check-ins skipped'
      : '  No readiness check-ins yet';
```

Then in the returned template, extend the recovery section:

```
Recovery data (last 7 days):
${healthLines}

Self-reported readiness (last 7 days):
${checkInLines}
```

- [ ] **Step 5: Verify both parse**

Run:
```bash
node -e "const p=require('@babel/parser'),f=require('fs');for(const x of ['screens/TodayScreen.jsx','screens/CoachScreen.jsx'])p.parse(f.readFileSync(x,'utf8'),{sourceType:'module',plugins:['jsx']});console.log('both parse')"
```
Expected: `both parse`

- [ ] **Step 6: Manual test**

1. Complete a check-in with all-worst answers → `Low`.
2. Go to Today → the proactive card shows **"Recovery is low today"**.
3. Tap it → the coach opens with the question pre-filled and answers using your actual readiness.
4. Switch the app language to German → the card still fires (proving the i18n bug is fixed).

- [ ] **Step 7: Commit**

```bash
git add screens/TodayScreen.jsx screens/CoachScreen.jsx
git commit -m "Feed readiness check-ins to the proactive card and coach; fix translated-label logic bug"
```

---

## Notes

- **The migration is a human step** (Task 2, Step 4). Nothing works until it is applied in the dashboard.
- **The other 7 locales** (`de`, `es`, `fr`, `it`, `pt`, `ru`, `zh`) will fall back to English for the `readiness.*` keys until translated. Acceptable for launch; add them when convenient.
- **`type: 'working'`** is intentionally preserved by `slice()` in `adjustSessionForReadiness`; note the existing rebuild at `WorkoutExecutionScreen.jsx:169` omits it — do not copy that pattern.
