# Rename Coach + Optimize Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove "AI" from the Coach's user-facing name, and restructure the Profile tab so identity/setup, analytics, and settings are cleanly separated.

**Architecture:** Two independent parts. Part A is a copy-only locale edit. Part B is a UI refactor of the Profile area: App.js already hosts a `[Profile | Progress]` top toggle; the work moves ProfileScreen's *internal* `data`/`prs`/`health` panels onto the Progress side (behind a segmented control), and lifts language/account/sign-out into a new Settings modal reached by a gear icon. Extract-in-place first (pure refactor, verify identical), then relocate.

**Tech Stack:** Expo SDK 56 / React Native 0.85 (new arch), React Navigation bottom-tabs, `react-i18next`, `react-native-svg`. Verification: `@babel/core` parse-check, `node --test`, and an Expo-web (`:8081`) + `puppeteer-core` screenshot loop.

## Global Constraints

- **Design system:** import colors/tokens from `lib/theme.js`; no raw hex. Buttons use `components/Tappable`; modal-backdrop tap-catchers stay bare `Pressable`. (See memory `design-system`.)
- **Locales:** 8 files — `en, de, es, fr, it, pt, ru, zh` under `locales/`. Any user-facing string change is applied to all 8, in-language.
- **Rename scope = Coach only.** Do NOT touch the 4 nutrition "AI logging" strings (`nutrition.upgrade`, `nutritionLog.premiumNote`, `nutritionLog.alerts.dailyLimitMsg`, `nutritionLog.alerts.premiumMsg`), code comments, SQL, the `ai-coach` edge function/`SYSTEM_PROMPT`, or marketing docs.
- **No backend/schema/edge changes.** Working-tree only; do not deploy.
- **Reviewer test account (web verify):** `helixapptest@gmail.com` / `HelixTest123!` (premium; bypasses paywall). Never change its password.
- **Health panel is iOS-only** (`isHealthAvailable()`; Android removed 2026-07-14) — it cannot be visually verified on web; verify it parses and preserves logic.

---

## Verification block (referenced by tasks as "VERIFY(files, screen)")

1. **Parse-check** each changed `.jsx`/`.js`:
   ```bash
   cd c:/Users/user/fitpulse && node -e "require('@babel/core').transformFileSync('<FILE>',{presets:['babel-preset-expo'],configFile:false});console.log('<FILE> OK')"
   ```
2. **Logic tests stay green:** `node --test lib/**/*.test.js` → `pass 10 / fail 0`.
3. **Screenshot** the affected screen with the driver in "Appendix: screenshot driver" (copy `_drive.mjs` into project root, edit the `FLOW` marker for the target screen, `node _drive.mjs`, then delete it). Open the PNG and confirm the described result. Metro on `:8081` rebundles on request.

---

## Task 1: Rename Coach in locales + paywall

**Files:**
- Modify: `locales/en.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `pt.json`, `ru.json`, `zh.json`
- Modify: `screens/PremiumPaywall.jsx:37`
- Create: `lib/rename.test.js` (regression guard)

**Interfaces:** none (copy + a guard test).

Four keys change per locale. Exact before → after:

**`coach.title`**
- en `"AI Coach"`→`"Coach"` · de `"KI-Coach"`→`"Coach"` · es `"Entrenador IA"`→`"Entrenador"` · fr `"Coach IA"`→`"Coach"` · it `"Coach IA"`→`"Coach"` · pt `"Coach de IA"`→`"Coach"` · ru `"ИИ-коуч"`→`"Коуч"` · zh `"AI 教练"`→`"教练"`

**`welcome.tagline`** (drop the AI qualifier on "coaching"; keep the rest incl. the `\n`)
- en `…and AI coaching in one place.`→`…and coaching in one place.`
- de `…und KI-Coaching an einem Ort.`→`…und Coaching an einem Ort.`
- es `…y coaching con IA en un solo lugar.`→`…y coaching en un solo lugar.`
- fr `…et coaching IA en un seul endroit.`→`…et coaching en un seul endroit.`
- it `…e coaching IA in un solo posto.`→`…e coaching in un solo posto.`
- pt `…e coaching com IA em um só lugar.`→`…e coaching em um só lugar.`
- ru `…и ИИ-коучинг в одном месте.`→`…и коучинг в одном месте.`
- zh `…以及 AI 教练，尽在一处。`→`…以及教练，尽在一处。`

**`onboarding.step5.sub`** (drop AI from "your AI coach"; keep the rest of each sentence verbatim)
- en `Your AI coach uses these…`→`Your coach uses these…`
- de `Dein KI-Coach nutzt diese…`→`Dein Coach nutzt diese…`
- es `Tu entrenador con IA los usa…`→`Tu entrenador los usa…`
- fr `Votre coach IA les utilise…`→`Votre coach les utilise…`
- it `Il tuo coach IA li usa…`→`Il tuo coach li usa…`
- pt `Seu coach de IA usa isso…`→`Seu coach usa isso…`
- ru `Ваш ИИ-коуч использует их…`→`Ваш коуч использует их…`
- zh `你的 AI 教练会用这些…`→`你的教练会用这些…`

**`profile.whatTrainSub`** (drop AI from "the AI coach"; keep the rest verbatim)
- en `…helps the AI coach give relevant advice.`→`…helps your coach give relevant advice.`
- de `…hilft dem KI-Coach, relevante Tipps zu geben.`→`…hilft dem Coach, relevante Tipps zu geben.`
- es `…ayuda al coach con IA a dar consejos relevantes.`→`…ayuda al coach a dar consejos relevantes.`
- fr `…aide le coach IA à donner des conseils pertinents.`→`…aide le coach à donner des conseils pertinents.`
- it `…aiuta il coach IA a dare consigli pertinenti.`→`…aiuta il coach a dare consigli pertinenti.`
- pt `…ajuda o coach de IA a dar conselhos relevantes.`→`…ajuda o coach a dar conselhos relevantes.`
- ru `…помогает ИИ-коучу давать релевантные советы.`→`…помогает коучу давать релевантные советы.`
- zh `…帮助 AI 教练给出相关建议。`→`…帮助教练给出相关建议。`

- [ ] **Step 1: Write the guard test** (`lib/rename.test.js`)
```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LOCALES = ['en','de','es','fr','it','pt','ru','zh'];
const AI_TERMS = /AI Coach|AI coach|AI coaching|KI-Coach|KI-Coaching|Coach IA|coaching IA|Entrenador IA|coach con IA|entrenador con IA|coaching con IA|Coach de IA|coach de IA|coaching com IA|ИИ-коуч|ИИ-коучинг|AI 教练/;
const COACH_KEYS = [['coach','title'], ['welcome','tagline'], ['onboarding','step5','sub'], ['profile','whatTrainSub']];
const get = (o,p) => p.reduce((a,k)=>a&&a[k], o);

test('coach copy contains no AI qualifier in any locale', () => {
  for (const loc of LOCALES) {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname,'..','locales',loc+'.json'),'utf8'));
    for (const key of COACH_KEYS) {
      const v = get(j, key);
      if (v == null) continue;
      assert.ok(!AI_TERMS.test(v), `${loc} ${key.join('.')} still has AI term: ${v}`);
    }
  }
});
```

- [ ] **Step 2: Run it — expect FAIL** (strings not yet changed)
```bash
cd c:/Users/user/fitpulse && node --test lib/rename.test.js
```
Expected: FAIL, listing `en coach.title still has AI term: AI Coach` (and others).

- [ ] **Step 3: Apply all 4 keys × 8 locales** using the exact before→after table above. Then in `screens/PremiumPaywall.jsx:37` change `title: 'AI Coach',` → `title: 'Coach',`.

- [ ] **Step 4: Run tests — expect PASS**
```bash
cd c:/Users/user/fitpulse && node --test lib/rename.test.js && node --test lib/**/*.test.js
```
Expected: rename guard PASS; full suite `pass 11 / fail 0`.

- [ ] **Step 5: VERIFY(`screens/PremiumPaywall.jsx`, Coach tab + paywall)** — Coach tab header reads "Coach"; paywall feature reads "Coach". Also confirm each locale JSON still parses: `node -e "['en','de','es','fr','it','pt','ru','zh'].forEach(l=>JSON.parse(require('fs').readFileSync('locales/'+l+'.json','utf8')));console.log('locales OK')"`.

- [ ] **Step 6: Commit**
```bash
git add locales/ screens/PremiumPaywall.jsx lib/rename.test.js && git commit -m "Rename: drop 'AI' from Coach copy across all locales + paywall"
```

---

## Task 2: Extract `PRsPanel` (in place)

Pure refactor — the PRs body moves to its own component, still rendered by ProfileScreen's `prs` tab. No behavior change.

**Files:**
- Create: `screens/PRsPanel.jsx`
- Modify: `screens/ProfileScreen.jsx` (replace the `activeTab === 'prs'` body ~`:1179-1201` with `<PRsPanel prs={prs} />`)

**Interfaces:**
- Produces: `PRsPanel({ prs })` where `prs` is the existing array of `{ name, weight_kg, reps, orm }` (same shape ProfileScreen already computes).

- [ ] **Step 1: Create `screens/PRsPanel.jsx`** — move the JSX currently inside `activeTab === 'prs'` (the outer `<View style={{ paddingTop: 4 }}>` down to its close, ProfileScreen `:1180-1200`) verbatim into the component body. Bring the styles it uses (`card`, `cardTitle`, `empty`, `prRow`, `prRank`, `prRankText`, `prName`, `prValGroup`, `prWeight`, `prOrm`) — copy those style keys from `ProfileScreen`'s StyleSheet into a local `StyleSheet.create` in `PRsPanel.jsx`. Imports: `View, Text, StyleSheet` from `react-native`; `useTranslation` from `react-i18next`; `colors` from `../lib/theme`.
```jsx
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';

export default function PRsPanel({ prs }) {
  const { t } = useTranslation();
  return (
    <View style={{ paddingTop: 4 }}>
      {/* …moved JSX (the card with t('profile.personalRecords'…) and the prs.map)… */}
    </View>
  );
}

const styles = StyleSheet.create({ /* …the 10 pr* / card / empty keys, copied verbatim… */ });
```

- [ ] **Step 2: Wire it in ProfileScreen** — replace the `prs` tab body with:
```jsx
{activeTab === 'prs' && <PRsPanel prs={prs} />}
```
Add `import PRsPanel from './PRsPanel';` near the other screen imports. Remove the now-dead pr* style keys from ProfileScreen's StyleSheet.

- [ ] **Step 3: VERIFY(`screens/PRsPanel.jsx`,`screens/ProfileScreen.jsx`; Profile→PRs tab)** — parse both; `node --test` 10/10; screenshot Profile, tap "PRs", confirm the PRs list renders identically (rank badges, names, weights).

- [ ] **Step 4: Commit**
```bash
git add screens/PRsPanel.jsx screens/ProfileScreen.jsx && git commit -m "Extract PRsPanel from ProfileScreen (no behavior change)"
```

---

## Task 3: Extract `VolumePanel` (in place, self-contained state)

The `data` (Volume) panel owns real state. Make the component self-contained so it can later drop into Progress unchanged.

**Files:**
- Create: `screens/VolumePanel.jsx`
- Modify: `screens/ProfileScreen.jsx` (replace `activeTab === 'data'` body ~`:1105-1177` with `<VolumePanel sessions={...} trainingExperience={trainingExperience} />`; remove the state/helpers that moved)

**Interfaces:**
- Produces: `VolumePanel({ sessions, trainingExperience })` — owns internally: `selectedMuscle`, `showMuscleDropdown`, `weekOffset`, `chartWidth`; derives `weeklyVolumeData`, `totalSets`, `weekLabel` from `sessions` + `weekOffset` (move the derivation currently in ProfileScreen). Depends on `MuscleVolumeChart`, `MUSCLE_GROUPS`, `getMuscleTarget`, `animateLayout`, `colors`, i18n.
- Consumes (from ProfileScreen): `sessions` = the raw workout-session/volume source ProfileScreen currently uses to compute `weeklyVolumeData`; `trainingExperience` = the profile field already in scope.

- [ ] **Step 1: Identify the moving parts** in `ProfileScreen.jsx` — grep and note every identifier the `data` body reads: `selectedMuscle, showMuscleDropdown, weekOffset, weekLabel, weeklyVolumeData, chartWidth, totalSets, MUSCLE_GROUPS, MuscleVolumeChart, getMuscleTarget, trainingExperience, setChartWidth, setSelectedMuscle, setShowMuscleDropdown, setWeekOffset`. Trace where `weeklyVolumeData`/`totalSets`/`weekLabel` are computed (the `useMemo`/derivation near the top of the component) — those move too.

- [ ] **Step 2: Create `screens/VolumePanel.jsx`** — own the 4 state hooks; move the derivation of `weeklyVolumeData`, `totalSets`, `weekLabel` (recompute from `sessions` + `weekOffset` + `selectedMuscle`); move the JSX verbatim (the two `styles.card` blocks: controls+chart, and day-breakdown). Copy the style keys it uses (`dataControlRow, muscleDropdownBtn, muscleDropdownText, dropdownArrow, weekNav, weekNavBtn, weekNavArrow, weekNavLabel, dropdownList, dropdownItem, dropdownItemActive, dropdownItemText, dropdownItemTextActive, chartTitleRow, chartTitle, totalBadge, totalBadgeEmpty, totalBadgeText, targetNote, targetNoteText, card, cardTitle, dayBreakRow, dayBreakLabel, dayBreakBar, dayBreakFill, dayBreakSets`) into a local StyleSheet. Imports: `useState` ; `View, Text, StyleSheet, TextInput?` (only what's used) from react-native; `useTranslation`; `colors` from `../lib/theme`; `animateLayout` from `../lib/motion`; `MuscleVolumeChart`, `MUSCLE_GROUPS`, `getMuscleTarget` from their current source modules (copy the exact import paths ProfileScreen uses).

- [ ] **Step 3: Wire it in ProfileScreen** — replace the `data` body with `{activeTab === 'data' && <VolumePanel sessions={sessions} trainingExperience={trainingExperience} />}`. Delete the now-unused state hooks and derivations from ProfileScreen ONLY if nothing else in ProfileScreen references them (grep each identifier first; `weekLabel`/`weekOffset` may also be read by the header region `:620` — if so, keep them in ProfileScreen and pass down, or leave a copy). Add `import VolumePanel from './VolumePanel';`.

- [ ] **Step 4: VERIFY(`screens/VolumePanel.jsx`,`screens/ProfileScreen.jsx`; Profile→Volume tab)** — parse both; `node --test` 10/10; screenshot Profile→"Volume": muscle dropdown, week nav (`‹ This week ›`), the volume chart, day-breakdown bars all render and the dropdown still toggles.

- [ ] **Step 5: Commit**
```bash
git add screens/VolumePanel.jsx screens/ProfileScreen.jsx && git commit -m "Extract self-contained VolumePanel from ProfileScreen"
```

---

## Task 4: Extract `HealthPanel` (in place, iOS-only)

**Files:**
- Create: `screens/HealthPanel.jsx`
- Modify: `screens/ProfileScreen.jsx` (replace `activeTab === 'health'` body ~`:1204`→end-of-block with `<HealthPanel …/>`)

**Interfaces:**
- Produces: `HealthPanel({ healthAuthorized, onConnect, healthMetrics })` — props are whatever the current health body reads (`healthAuthorized`, the connect handler, any health metrics/state). Grep the `activeTab === 'health'` block for every identifier and lift them to props; keep the panel presentational.

- [ ] **Step 1: Grep the health block** for identifiers it reads (`isHealthAvailable`, `healthAuthorized`, `Platform`, connect handler, metrics). List them as props.
- [ ] **Step 2: Create `screens/HealthPanel.jsx`** — move JSX + used style keys verbatim; `isHealthAvailable`/`Platform` import directly from their sources.
- [ ] **Step 3: Wire in ProfileScreen** — `{activeTab === 'health' && <HealthPanel {...healthProps} />}`. Add import; remove dead styles/state that moved.
- [ ] **Step 4: VERIFY(`screens/HealthPanel.jsx`,`screens/ProfileScreen.jsx`; Profile tab)** — parse both; `node --test` 10/10. NOTE: cannot screenshot the Health panel on web (iOS-only); confirm the Profile tab still renders and the other tabs unaffected. Confirm no console error re: undefined health identifiers.
- [ ] **Step 5: Commit**
```bash
git add screens/HealthPanel.jsx screens/ProfileScreen.jsx && git commit -m "Extract HealthPanel from ProfileScreen (iOS-only)"
```

---

## Task 5: `SettingsScreen` modal + gear icon; strip settings from Profile

**Files:**
- Create: `screens/SettingsScreen.jsx`
- Modify: `screens/ProfileScreen.jsx` (add gear button to header; remove sign-out from header `:651`; remove Language card `:1076-1087` and Account section `:1089-1096`; render `<SettingsScreen …/>`)

**Interfaces:**
- Produces: `SettingsScreen({ visible, onClose, onSignOut })` — full-screen `<Modal animationType="slide">`. Contains: Language row (opens the existing `LanguagePicker`), Privacy-policy link, Delete-account button, Sign-out button. Backdrop/close via a bare `Pressable` or a header "Done"/back per the app's modal pattern (match `NutritionLogScreen`'s header).
- Consumes: `deleteAccount` + `signOut` handlers — move `deleteAccount` logic into SettingsScreen or pass as prop; `onSignOut` is the existing prop threaded from App.js.

- [ ] **Step 1: Create `screens/SettingsScreen.jsx`** — a `<Modal visible={visible} animationType="slide" onRequestClose={onClose}>` with a `SafeAreaView`, a header row (title `t('settings.title')` + a "Done" `Tappable` calling `onClose`), then: the Language card (move JSX + `LanguagePicker` usage + `langOpen` state from ProfileScreen `:1076-1087`), the Privacy link (`:1091-1093`), the Delete-account button (`:1094-1096` + its `deleteAccount` handler), and a Sign-out `Tappable` calling `onSignOut`. Use tokens + `Tappable`. Add locale key `settings.title` = "Settings" (+ 7 translations: de "Einstellungen", es "Ajustes", fr "Réglages", it "Impostazioni", pt "Definições", ru "Настройки", zh "设置").
- [ ] **Step 2: Add the gear to ProfileScreen header** — in the header's right group (`:645-652`), replace the inline `signOut` Tappable with a gear:
```jsx
<Tappable onPress={() => setShowSettings(true)} style={styles.gearBtn} hitSlop={8}>
  <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
</Tappable>
```
Add `const [showSettings, setShowSettings] = useState(false);`, ensure `Ionicons` is imported, add a `gearBtn` style, and render `<SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} onSignOut={onSignOut} />` near the AdminScreen modal. Keep the admin button as-is.
- [ ] **Step 3: Remove moved blocks** — delete the Language card, Account section, and header sign-out from ProfileScreen; remove now-dead styles (`langRow, langRowRight, langRowValue, accountSection, privacyLink, deleteAccountBtn, deleteAccountText, signOut`) and the `langOpen` state (moved to Settings).
- [ ] **Step 4: VERIFY(`screens/SettingsScreen.jsx`,`screens/ProfileScreen.jsx`; Profile tab + Settings)** — parse both; `node --test` 10/10; screenshot Profile (gear visible in header, no sign-out link, no Language/Account cards in scroll), tap gear → Settings modal shows Language / Privacy / Delete / Sign out.
- [ ] **Step 5: Commit**
```bash
git add screens/SettingsScreen.jsx screens/ProfileScreen.jsx locales/ && git commit -m "Add SettingsScreen modal + gear; move language/account/sign-out out of Profile scroll"
```

---

## Task 6: Move Volume/PRs/Health into Progress; ProfileScreen loses its tab bar

Final relocation. ProgressScreen becomes the Progress container with a segmented control; ProfileScreen drops its internal tabs.

**Files:**
- Modify: `screens/ProgressScreen.jsx` (wrap current body as the "Charts" panel; add `[Charts | Volume | PRs | Health*]` segmented control hosting the extracted panels)
- Modify: `screens/ProfileScreen.jsx` (remove `TABS`, the tab bar `:627-635`, and `activeTab` state; render only the `profile` content; pass the data VolumePanel needs down from here IF ProfileScreen owns `sessions`/`prs` — otherwise ProgressScreen fetches them)
- Modify: `App.js` (`ProfileTabScreen` labels → i18n; no structural change — it already toggles `[Profile | Progress]`)

**Interfaces:**
- `ProgressScreen` renders an internal segmented control; state `progressTab: 'charts'|'volume'|'prs'|'health'`. It sources `sessions`/`prs`/health data itself (move the fetch/derivation that fed those panels out of ProfileScreen into ProgressScreen, OR into each self-contained panel — prefer per-panel self-contained fetching so ProgressScreen stays a thin host).

- [ ] **Step 1: Make panels source their own data.** If `VolumePanel`/`PRsPanel` currently receive `sessions`/`prs` from ProfileScreen, move that fetch into each panel (a `useEffect` + `useState` querying the same source ProfileScreen used — copy the query). Verify each still renders inside ProfileScreen. Commit this sub-change first ("Make Volume/PRs panels self-fetch").
- [ ] **Step 2: Build the Progress container** in `ProgressScreen.jsx` — extract the current ProgressScreen JSX into a local `ChartsPanel()` (or inline as the `'charts'` case), add:
```jsx
const PROGRESS_TABS = isHealthAvailable() ? ['charts','volume','prs','health'] : ['charts','volume','prs'];
const [progressTab, setProgressTab] = useState('charts');
// segmented control row (reuse the tabRow/tab/tabActive styles pattern), labels t(`progress.tabs.${k}`)
// body: charts -> existing; volume -> <VolumePanel/>; prs -> <PRsPanel/>; health -> <HealthPanel/>
```
Add locale `progress.tabs` = `{ charts: "Charts", volume: "Volume", prs: "PRs", health: "Health" }` (+7 translations; reuse the `profile.tabs` translations for volume/prs/health, add "Charts": de "Diagramme", es "Gráficas", fr "Courbes", it "Grafici", pt "Gráficos", ru "Графики", zh "图表").
- [ ] **Step 3: Strip ProfileScreen tabs** — remove `TABS`, the `<View style={styles.tabRow}>…</View>` bar (`:627-635`), `activeTab`/`setActiveTab`, and the `data`/`prs`/`health` conditional blocks (now in Progress). ProfileScreen renders only the `profile` content (identity, stats, setup, weight log, body-comp) + the gear/Settings. Remove dead `tab*` styles.
- [ ] **Step 4: i18n the App.js labels** — in `App.js` `ProfileTabScreen`, replace hardcoded `"Profile"`/`"Progress"` with `t('nav.profile')`/`t('nav.progress')`; add those keys (en "Profile"/"Progress" +7). Import `useTranslation` if not already there.
- [ ] **Step 5: VERIFY(`screens/ProgressScreen.jsx`,`screens/ProfileScreen.jsx`,`App.js`; Profile + Progress)** — parse all three; `node --test` 10/10; screenshots:
  - Profile tab: single top `[Profile | Progress]` bar (from App.js), NO second tab bar inside; content = identity/stats/setup/weight/body-comp + gear.
  - Progress tab: `[Charts | Volume | PRs]` segmented control; each renders (Charts chart, Volume dropdown+bars, PRs list).
- [ ] **Step 6: Commit**
```bash
git add screens/ProgressScreen.jsx screens/ProfileScreen.jsx App.js locales/ && git commit -m "Unify analytics under Progress; ProfileScreen drops internal tab bar"
```

---

## Task 7: Full regression sweep

- [ ] **Step 1: Parse every screen** — `node` loop over `screens/*.jsx` + `App.js` with babel (see design-system memory for the snippet). Expect ALL PARSE OK.
- [ ] **Step 2: `node --test lib/**/*.test.js`** → `pass 11 / fail 0` (10 existing + rename guard).
- [ ] **Step 3: Screenshot loop over all 5 bottom tabs + Program drill-down** — confirm no regressions from the Profile/nav changes; Coach reads "Coach".
- [ ] **Step 4: Grep guard** — `grep -rInE "AI [Cc]oach|AI coaching" locales screens App.js` → only the 4 nutrition "AI logging" strings may remain (in `nutritionLog`/`nutrition`), zero coach hits.
- [ ] **Step 5: Final commit** (if any cleanup) and update memory `design-system` with the new Profile IA + the SettingsScreen/VolumePanel/PRsPanel/HealthPanel components.

---

## Self-review notes (author)
- **Spec coverage:** rename (Task 1) ✓; Profile/Progress split (Tasks 5-6) ✓; Settings modal (Task 5) ✓; VolumePanel/PRsPanel extraction (Tasks 2-3) ✓; injury editor stays in ProfileScreen (never moved) ✓; verification model (parse + node --test + screenshots) ✓. Added HealthPanel (Task 4) — spec said `[Charts|Volume|PRs]` but code has an iOS-only Health tab that must go somewhere; folded into Progress as a conditional 4th segment.
- **Deviation from spec:** spec labeled the analytics tabs "Volume/PRs"; the code's tab keys are `data`(=Volume)/`prs`/`health`. Plan uses the real keys. App.js already had the `[Profile|Progress]` toggle, so that part is label-i18n only, not new construction.
- **Ordering rationale:** extract-in-place (Tasks 2-4) before relocation (Task 6) so each extraction is a verifiable no-op, isolating risk from the navigation change.

## Appendix: screenshot driver
Copy the `drive.mjs` pattern from the scratchpad (documented in memory `design-system`) into project root as `_drive.mjs`, set its post-login `FLOW` to navigate to the target tab/screen, `node _drive.mjs`, read the PNG, then `rm _drive.mjs`. Login: `helixapptest@gmail.com` / `HelixTest123!`. Metro must be running (`npx expo start --web --port 8081`).
