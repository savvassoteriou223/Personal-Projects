# Rename Coach + Optimize Profile — Design

**Date:** 2026-07-16
**Status:** Approved (design), pending spec review
**Scope:** Two coordinated changes to the live Helix app — (1) rename the "AI Coach" feature to "Coach" throughout the app, and (2) restructure the Profile tab's information architecture. No backend, schema, or edge-function changes.

---

## 1. Goals & success criteria

- **Rename:** No user-facing surface in the app calls the coach "AI Coach" or "your AI coach". It reads simply "Coach" / "your coach". Marketing material is intentionally excluded.
- **Profile:** The Profile tab has a single, clear navigation model. "You" (identity + setup) is separated from "your data" (analytics) and from "settings". The `ProfileScreen.jsx` file shrinks as responsibilities move out. No existing functionality is lost (injury editing, weight logging, body-comp, volume, PRs, language, account actions all still reachable).
- **No regressions:** All 24 screens still parse; `node --test lib/**/*.test.js` stays green; the flows verify in the live app (Expo web + puppeteer screenshot loop).

## 2. Non-goals (deferred to their own spec → plan cycles)

- Onboarding first-run polish (requires a throwaway account to verify live; not started here).
- New-user empty states (Nutrition macro ghosts, sparse Progress pre-data).
- Celebratory "hero moments" (workout finish, PR, week close).
- Aligning marketing docs (`MARKETING_BRIEF.md`, `MARKETING_PLAN.md`, `LANDING_PAGE_GUIDE.md`, `APP_OVERVIEW.md`) with the rename — a separate marketing decision. **Known mismatch after this change:** the app says "Coach", marketing says "AI coach".

---

## 3. Part A — Coach rename ("scrub AI")

Copy-only. No component logic changes.

### User-facing strings to change (all 7 locale files under `locales/`)
The canonical keys, per `locales/en.json`:
- `coach.title`: `"AI Coach"` → `"Coach"`
- `tagline` (Welcome): `"Science-based training, smart nutrition,\nand AI coaching in one place."` → `"…and coaching in one place."`
- `~line 204` (`.sub`, supplements/health context): `"Your AI coach uses these to give you more relevant advice…"` → `"Your coach uses these…"`
- `~line 695` (`whatTrainSub`): `"Select all that apply — helps the AI coach give relevant advice."` → `"…helps your coach give relevant advice."`
- Any other `"AI coach"` / `"AI Coach"` occurrence found by a full grep of each locale file (see task list — do a per-file sweep, not just en.json; the 6 translated files must be updated in their own language, keeping the term for "coach" and removing the "AI" qualifier).

### Hardcoded string
- `screens/PremiumPaywall.jsx:37` — `title: 'AI Coach'` → `title: 'Coach'`. Prefer routing it through `t(...)` if a suitable key exists or can be added; otherwise a literal `'Coach'` is acceptable to keep scope tight.

### Explicitly NOT changed
Code comments, SQL migration comments, `supabase/functions/ai-coach/index.ts` `SYSTEM_PROMPT` (internal model instruction), directory/function name `ai-coach`, and all marketing docs.

### Verification
Grep the app (excluding `node_modules`, `supabase/`, `*.md`, code comments) for `AI [Cc]oach` → zero user-facing hits. Screenshot the Coach tab (title reads "Coach") and the paywall (feature reads "Coach").

---

## 4. Part B — Profile restructure

### 4.1 Current state (the problem)
Under the **Profile** bottom-tab:
- `App.js` → `ProfileTabScreen` renders a top toggle **[Profile | Progress]** switching between `<ProfileScreen>` and `<ProgressScreen>`.
- `ProfileScreen` *also* has internal subtabs **[Profile | Volume | PRs]** (`activeTab` state, `screens/ProfileScreen.jsx:238`, tab row ~`:630`).

Three problems:
1. **Double tab bar** — "Profile" appears in both levels; the two systems overlap confusingly.
2. **Analytics split** — Progress (charts) is a separate toggle from Volume/PRs, though all three are "your data".
3. **Settings buried** — language, privacy policy, delete account (`ProfileScreen.jsx:1076–1096`) and sign-out (header, `:651`) live inside the long Profile scroll alongside body stats.

### 4.2 Target state (Approach A)
Single top tab bar **[ Profile | Progress ]** under the Profile bottom-tab.

**Profile view — "you":**
- Identity (avatar, name, email) + a **gear icon** in the header (opens Settings).
- Stat tiles (weight / height / BMI / streak).
- Performance insights (existing).
- Training setup: goals, equipment, injuries — **injury editing flow preserved unchanged** (`ProfileScreen.jsx:893–1051`: saved entries, phase/severity/post-op timeline).
- Quick weight log (`:1052`).
- Body-composition card (`:1073`).
- Sign-out moves OUT of the header into Settings.

**Progress view — "your data", unified:**
- An internal segmented control **[ Charts | Volume | PRs ]**.
  - **Charts** = current `ProgressScreen` content.
  - **Volume** = current ProfileScreen "volume" subtab body, extracted to `VolumePanel`.
  - **PRs** = current ProfileScreen "prs" subtab body, extracted to `PRsPanel`.

**Settings — new full-screen modal** (matches how `NutritionLogScreen` opens from `App.js` via `<Modal>`), reached via the Profile-header gear:
- Language picker (currently `ProfileScreen.jsx:1076`).
- Privacy policy link (`:1091`).
- Delete account (`:1094`).
- Sign out (moved from header).

### 4.3 Component boundaries (each unit: what it does / how it's used / what it depends on)
- **`VolumePanel`** (new, `screens/` or `components/`): renders the per-muscle volume analytics. Props: whatever the current volume subtab consumes (`metrics`/volume data + `profile`). No internal navigation. Depends on `volumeEngine`/existing data already computed in the parent.
- **`PRsPanel`** (new): renders personal-records analytics. Props: the current PRs subtab's data. Self-contained.
- **`SettingsScreen`** (new, opened as a Modal): props `{ visible, onClose, onSignOut, isAdmin? }`. Owns language/privacy/delete/sign-out. Depends on `i18n`, `LanguagePicker`, `supabase` (delete/sign-out handlers passed in or imported as today).
- **`ProfileScreen`** (shrinks): the "Profile" view only. Loses Volume/PRs subtab bodies and the settings blocks; gains a gear button that calls an `onOpenSettings` prop. Keeps identity, stats, setup, weight log, body-comp.
- **`ProgressScreen`** → either becomes the "Charts" panel consumed by a Progress container, or is promoted to the Progress container that hosts the `[Charts|Volume|PRs]` segmented control + the three panels. **Decision: promote `ProgressScreen` (or a thin new `ProgressTab`) to host the segmented control**, so App.js stays simple.
- **`ProfileTabScreen`** (`App.js`): the `[Profile | Progress]` container. Holds which top tab is active; renders `<ProfileScreen onOpenSettings=… />` or the Progress container. Renders the `<SettingsScreen>` modal at this level so it overlays either view.

### 4.4 Data flow
Unchanged. The same data sources (`profile`, `metrics`, volume computation, PRs query) feed the reorganized containers. Volume/PRs panels receive the data they already use, lifted to wherever the parent computes it. No new fetches, no schema changes. Watch for state currently held in `ProfileScreen` that the extracted panels need — lift it to the container or refetch within the panel, whichever keeps the panel self-contained (prefer self-contained: a panel that fetches/derives its own data is easier to place under Progress).

### 4.5 Interaction / states to preserve
- Injury multi-phase editing (list → severity → post-op timeline) must keep working identically.
- Quick weight log's saved-confirmation state (`quickWeightSaved`) preserved.
- Language change applies live (existing behavior).
- Delete account + sign out keep their confirmation flows.
- The gear button and Settings modal follow the shared `Tappable` + design-token conventions ([[design-system]]): tokens only, 44pt targets, Tappable for buttons, bare Pressable for the modal backdrop tap-catcher.

### 4.6 Risks
- Touches navigation (`App.js`), the largest screen (`ProfileScreen`, 1,436 lines), and `ProgressScreen`. Moderate blast radius.
- Extraction must not drop props/state (injury editor is the riskiest — it has the most local state).
- Mitigation: extract one panel at a time, parse-check + screenshot after each; keep the injury editor in `ProfileScreen` (don't move it) to minimize risk.

---

## 5. Verification plan
After each increment:
1. `node -e "require('@babel/core').transformFileSync(<file>, {presets:['babel-preset-expo'],configFile:false})"` on changed files.
2. `node --test lib/**/*.test.js` stays 10/10.
3. Live screenshot loop (Expo web :8081 + puppeteer, login as `helixapptest@gmail.com`):
   - Coach tab title reads "Coach"; paywall reads "Coach".
   - Profile tab: single `[Profile|Progress]` bar; gear opens Settings modal; Settings has language/privacy/delete/sign-out.
   - Progress tab: `[Charts|Volume|PRs]` segmented control, all three render.
   - Injury editing, weight log still work.

## 6. Rollout
Working-tree changes only; nothing committed/deployed by this spec's work beyond the design doc. Ship via the normal EAS build the user controls.
