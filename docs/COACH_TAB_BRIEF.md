# Coach tab — prompt

Paste everything below the line. The output is a single HTML file you open in a
browser to see the screen rendered.

---

Design and **render** the Coach tab for Helix, a science-based strength-training
app (React Native, live on Google Play, dark theme, premium feature).

**Output exactly one self-contained HTML file and nothing else.** No explanation
before it, no external CSS, no fonts, no images, no JS libraries — it must render
correctly opened straight from disk. Inline everything. Draw any icons as inline
SVG or unicode.

Render the screen inside a **390 × 844** phone frame, centred on a neutral page.
Show **three frames side by side**, all in the same HTML:

1. **Normal** — a user four weeks into a programme with one problem
2. **Empty** — brand-new user, nothing logged yet
3. **Mid-conversation** — the user has asked something and been answered

Under the frames, add a short list of your design decisions — 6 or so, one line
each, saying what you did and why. Nothing else.

## What this screen is

Not a chatbot. It is a **coach that can edit your training programme.** It can
replace exercises, change sets and reps, add or remove work — permanently or for
one session — and every change is reviewable and revertible. It remembers your
injuries, dislikes and goals. It can swap an exercise while you're mid-workout.
It runs multi-week controlled experiments on you and reports the result, including
when the result is "this made no difference for you."

Every claim it makes cites from a 74-study research library.

## Use this exact content — don't invent placeholder text

**Normal state:**
- Header: `Coach`
- Context: goal `Lose fat` · `3-week streak` · `2 sessions this week` · recovery `Moderate`
- The coach's read: **"Your back is 8 sets short this week"** — 4 of 12 sets logged
- It has already acted: added `2 × Cable row` to Thursday, with an undo
- Next session: `Push A` · 52 min · 6 exercises · 24 sets · chest, shoulders, triceps
- Weekly volume: Chest 12/15 · Back 4/12 (behind) · Legs 16/15 · Arms 7/10
- Suggested asks: `What am I neglecting?` · `Is my frequency right?` · `Am I recovering enough?`
- Quota: `94 of 100 messages left this month`

**Empty state:** no training history, no volume data, no reads. Programme exists;
first session is `Full Body A`. Decide what a coach says to someone on day one —
this state currently looks broken and that's the thing to fix.

**Mid-conversation:** user asked *"Why rows and not pulldowns?"* and the coach
answered *"You already pull vertically twice a week. Rows load the mid-back —
rhomboids and mid-traps — which nothing else in your week trains directly."*

## Design system — use these, don't invent hex

```
bg #0F0F13   surface #1A1A20   surfaceInset #12121A   surfaceElevated #1C1C22
control #2C2C35   white #FFFFFF
borderSoft #1E1E28   border #2C2C35   borderStrong #3D3D4A
accent #1D9E75   info #7C9CFF   warning #BA7517   danger #E85D5C
text #FFFFFF / #E4E4E8 / #A1A1AA / #9494A0 / #8A8A94   textOnLight #111114
```

System font stack only. Tabular numerals wherever figures align.

If you want to change the palette, do it — but say so in your decisions list and
give the reason.

## Constraints that make a design buildable

It ships in React Native, so the layout must survive translation:

- **Flexbox only.** No CSS Grid, no floats, no `position: sticky`. A pinned bottom
  bar is fine (flex column, scroll view flexing inside) — just know you're asking
  for it.
- No hover states. Touch targets ≥ 44px.
- Shadows are expensive and inconsistent across platforms — prefer borders and
  contrast for elevation.
- Ships in 8 languages; **German and Russian run ~30% longer than English**, so
  nothing may depend on a string staying short.
- Text contrast ≥ 4.5:1. No meaning carried by colour alone.

## What's wrong with the current version

1. It **reports instead of acting.** It says "your back is 8 sets short" and waits
   for you to ask it to fix that.
2. Every element is **the same bordered card** stacked vertically, so nothing has
   rank and the screen reads as filler.
3. The **conversation isn't visible** — history is kept in memory but thrown away
   on reload, on a tab that claims to remember you.
4. It's **nearly empty** for a new user.

## What I'm judging

Does it look like a coach or a dashboard. Would someone pay for this screen. Is
there one obvious thing to do within half a second. Does the empty state hold up.
Does it feel designed rather than assembled from cards.

Roughly twenty designs have already been rejected on this app. The failures were
flashy mockups that ignored the constraints, and restyles that changed padding and
were presented as redesigns. Take a position.

Don't ask clarifying questions. Make the calls and give me the file.
