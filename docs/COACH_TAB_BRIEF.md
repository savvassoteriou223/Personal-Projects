# Design brief — Coach tab

Paste this whole file as your prompt.

---

## What you're designing

The **Coach tab** of Helix, a science-based strength-training app for iOS and
Android (React Native / Expo). It's live on Google Play. Users pay for premium,
and the Coach is the headline premium feature — so this screen has to justify a
subscription on sight.

Redesign it. I want a **visual and structural** redesign, not a spacing pass.
Assume the current layout is wrong and start from what the screen is for.

---

## What the Coach actually does

It is **not** a general chatbot. It's a programme editor with the user's full
training history open. It can:

- **Change the user's training programme** — replace an exercise, adjust sets,
  reps or effort, add or remove an exercise. Permanently, or for one session.
  Changes are reviewed by the user before applying, and are revertible.
- **Rank replacements** — asked to change an exercise, it returns 3 ranked
  options with a research rationale each.
- **Remember the user** — dislikes, injuries, preferences, goals. Persists across
  conversations. A disliked exercise stops being programmed. The user can see and
  delete anything it remembers.
- **Work mid-workout** — it can swap the exercise the user is currently doing.
- **Write a weekly review** — a narrative summary, offered once a week.
- **Run controlled n-of-1 experiments** — it can propose a multi-week trial on the
  user (e.g. "train chest twice a week instead of once"), execute it by modifying
  the programme, and report a verdict — including "this made no difference for
  you." Requires explicit opt-in and can be ended any time.

Every answer must cite from a curated 74-study research library.

**Hard limit: 100 AI messages per month.** This matters — the UI should never
make a user feel they wasted one.

## What it knows without being asked (costs no message, no latency)

All of this is already computed on device and available to render:

| Data | Example |
|---|---|
| Weekly volume per muscle vs the user's target | "Back: 4 of 12 sets" |
| Muscle not trained recently | "Lats, 9 days" |
| Plateau detection | "Bench press, 4 weeks flat" |
| Deload due | with the research behind it |
| Lift ready to progress | "Squat — add 2.5kg" |
| Recovery check-in | Ready / Moderate / Low |
| Streak, sessions this week, bodyweight vs target | |
| The next scheduled session | name, exercises, set count, duration |
| Recent changes the coach made | so they can be undone |
| Facts it remembers about the user | |

**A pre-computed read is free. A message costs 1 of 100.** Design accordingly.

---

## What's wrong with it now

1. **It reads as a dashboard with a text field**, not a coach. It reports; it
   doesn't act. It says "your back is 8 sets short" and then waits for the user to
   ask it to fix that — an extra step that makes it feel inert.
2. **Everything is the same bordered card** on near-black, stacked vertically, so
   nothing has rank and the screen reads as filler.
3. **The conversation isn't visible.** History is kept in state and sent to the
   model, but the UI throws it away on reload — on a tab whose subtitle is
   "Remembers your training."
4. **It's mostly empty** for anyone without much logged history.

---

## Constraints — these are real, don't design around them

**React Native, not the web.**
- Flexbox only. **No CSS Grid, no floats, no `position: sticky`.**
- No hover states. Touch targets ≥ 44px.
- Shadows are expensive and render differently per platform; prefer borders and
  contrast for elevation.
- Gradients need `react-native-svg` (available, already used).
- A pinned bottom bar means a flex column with the scroll view flexing inside it,
  plus `KeyboardAvoidingView`. Doable, but say so if you rely on it.

**Design system.** `lib/theme.js` is the single source of truth. Use these tokens,
don't invent hex:

```
bg #0F0F13   surface #1A1A20   surfaceInset #12121A   surfaceElevated #1C1C22
surfaceInverse #FFFFFF   control #2C2C35
borderSoft #1E1E28   border #2C2C35   borderStrong #3D3D4A
accent #1D9E75 (+Soft 13% / +Hair 25%)   info #7C9CFF   warning #BA7517   danger #E85D5C
textPrimary #FFFFFF   textSecondary #E4E4E8   textMuted #A1A1AA
textSubtle #9494A0   textFaint #8A8A94   textOnLight #111114
```

You may propose changing the palette, but say so explicitly and give the reason.

**Other constraints:**
- Ships in **8 languages** — German and Russian run ~30% longer than English.
  Nothing may depend on a string being short.
- Dark theme only today.
- Screen is `screens/CoachScreen.jsx` (~2,300 lines) — a redesign that requires
  rewriting all of it is fine, but say so.
- **Accessibility:** text contrast ≥ 4.5:1, real touch targets, no meaning
  carried by colour alone.

---

## What I'm judging

- **Does it look like a coach or a dashboard?** The single most important thing.
- **Would someone pay for this screen?**
- **Is the hierarchy obvious in half a second** — is there one clear thing to do?
- **Does it hold up when empty** (new user, no history) and when full?
- **Does it feel designed**, rather than assembled from cards?

I've rejected roughly twenty designs on this app already. The ones that failed
were flashy mockups that ignored the constraints, or restyles that changed
padding and called it a redesign. Take a position and justify it.

---

## Deliverable

1. **A rendered mockup** — self-contained HTML at 390×844, dark, using the tokens
   above. Show the realistic state (a user mid-programme with one gap), and the
   empty state for a brand-new user.
2. **The reasoning** — 5–8 decisions, each stating what you did and why, in one
   sentence. Name what you deliberately left out.
3. **Anything that changes the data model or needs new capability**, flagged
   separately so I can cost it.

Don't ask clarifying questions. Make the calls, state your assumptions, and show
me something.
