# Helix — Marketing Plan

A full launch campaign for a solo developer, no film crew, no on-camera talent
required. The product demos ARE the ads.

---

## 0. Core idea

Do not market "a fitness app" — that market is saturated. Market the *moment*:
- "Take a photo of your meal, get your macros in 3 seconds."
- "A coach that notices you slept badly and adjusts today's workout."

Pick ONE hero feature per piece of content. Never list features.

**Target user:** 20–35, trains 3–5x/week or wants to start, hates manual
logging. This is also exactly the TikTok/Instagram Reels demographic.

---

## 1. Positioning & assets to build first

### Landing page (one page)
A single scrollable web page whose only job is to turn a visitor into an install.
- **Hero:** app name, one-sentence pitch, a looping video of the food scan, and
  the Google Play / App Store badges.
- **3 feature blocks:** screenshot + 2 sentences each (food scan, AI coach,
  recovery-aware training).
- **Footer:** privacy policy, terms, support email.
- **Why:** social platforms only allow ONE link (in your profile bio). That link
  points here; this page routes iPhone users to the App Store and Android users
  to Google Play. It's also your credibility check when people Google the app.
- **How:** Carrd ($19/yr, simplest) or Framer (~$10/mo, prettier). Buy a domain
  (helixfit.app or similar, ~$15–30/yr from Cloudflare/Namecheap). Half a day.

### App Store Optimization (ASO) — highest ROI, and it's free
This is your store listing. It out-converts everything else because it's
permanent and multiplies every visit.
- **Title (30 chars):** include a keyword, e.g. "Helix: AI Fitness Coach"
- **Short description (80 chars):** "AI workout planner & calorie tracker. Snap a
  photo, get macros instantly."
- **Full description:** first 2–3 lines are the pitch (rest is hidden behind
  "read more"). Naturally repeat keywords 2–3x: AI fitness coach, workout
  planner, calorie tracker, macro tracker, food scanner. Don't keyword-stuff.
- **Screenshots (4–8):** the single biggest install driver. Screenshot 1 =
  food-photo → macros result (the magic moment), NOT a login screen. Put a short
  caption on each, telling one story:
  1. "Snap a photo. Get your macros."
  2. "A coach that actually knows you."
  3. "Workouts built for your body and equipment."
  4. "Trains you around your sleep and recovery."
  5. "Watch your progress compound."
  Build these in AppMockUp or Hotpot.ai (free) — upload screenshot, add a phone
  frame + caption, export.
- **Feature graphic (1024×500):** made in Canva; dark background, app icon,
  headline "Your AI Coach". Nothing else — it renders small.
- **In-app rating prompt:** use expo-store-review; call requestReview() after the
  user's ~3rd completed workout. 4.5★+ materially raises both ranking and
  conversion.

### Social accounts (1 hour)
Same handle everywhere (check availability on namechk.com). TikTok, Instagram,
YouTube (Shorts). Set TikTok + Instagram to Business/Creator accounts (free,
unlocks analytics and the bio link). Bio + app-icon avatar on all three.

---

## 2. Organic content engine (TikTok-first)

TikTok is the only platform where a zero-follower account can hit 500k views, and
fitness + AI is one of its best niches. Post the same video to Instagram Reels and
YouTube Shorts (export the clean file from the editor — don't re-download from
TikTok, the watermark tanks reach elsewhere).

**Cadence:** 1–2 posts/day. Bank ~10 videos before launch so you're never
scrambling.

**Formats that need no on-camera person:**
1. **Raw food-scan demo** — second phone films your hand pointing the app at a
   real plate; macros appear. This one format can carry the whole account.
2. **Voice-logging demo** — "I just *tell* my phone what I ate."
3. **Coach reaction** — screenshot the coach adjusting a workout after bad sleep:
   "my app knew I was under-recovered."
4. **Build-in-public** — "I'm a solo dev, I built an AI coach, here's what
   happened when 100 people used it." Dev-story content reliably over-performs.
5. **Comparison hooks** — "MyFitnessPal: 2 minutes of searching. Helix: one
   photo." (Show speed, don't disparage.)

**Rules:** hook in the first 1.5s, on-screen captions always, 7–20s length, end
with "link in bio."

**10-video starter bank** (same 3 demos, different hooks):
- Food scan × 5: "I haven't typed a calorie in 3 months" / "MyFitnessPal could
  never" / "the laziest way to track macros" / "POV: you track macros in 2026" /
  "my nutritionist hates this"
- Voice logging × 2: "I just tell my phone what I ate" / "logging food while
  driving home from the gym"
- Coach adjusts to sleep × 3: "my app knew I slept 4 hours" / "my coach benched
  me today" / "what recovery-based training looks like"

**Editing:** CapCut (free). Import clip → trim → Auto Captions → add a hook text
overlay for the first 2s → optional AI voiceover (ElevenLabs, free tier) → add a
trending TikTok sound at low volume → export 1080p → DISABLE the CapCut end
watermark.

---

## 3. Ads without physical people

Three tiers, cheapest first:
1. **Screen-recording ads** — the food scan and workout generation ARE the
   creative. Record in-app, caption in CapCut, AI voiceover. Top-performing format
   for utility apps.
2. **AI UGC avatars** — tools like Arcads (~$110/mo) or Creatify generate a
   realistic "person talking to camera" ad from a script. Use once you're
   spending real money on TikTok/Meta.
3. **Stock b-roll + voiceover** — free gym footage (Pexels/Pixabay) intercut with
   your app screen. Weakest, use for variety.

Make 5–10 variants per concept (same body, different hooks). Creative testing is
the entire game.

---

## 4. Paid ads (weeks 3–4+, ONLY after trial→paid data exists)

Order of deployment:
1. **Google App Campaigns** (Android's equivalent of Apple Search Ads) — feed it
   your 3 best videos + headlines; it auto-places across Play search, YouTube,
   Discover. Start $10–15/day, optimize to "install volume" first, then "in-app
   actions" (trial starts) after ~2 weeks.
2. **Apple Search Ads** (once iOS ships) — highest-intent installs; your app is
   the sponsored top result for searches like "AI calorie tracker." No creative
   needed. Start ~$500/mo.
3. **TikTok Spark Ads** — put spend behind an ALREADY-PROVEN organic video (keeps
   its likes/comments, looks native). $20–30/day, broad targeting.

Don't touch paid until RevenueCat shows your trial→paid rate, or you're buying
installs blind.

**Micro-influencer seeding (cheap, do in parallel):** gift 6-month promo codes
(Play Console → Monetize → Promo codes) to 20–50 fitness creators with 5k–50k
followers. Small creators reply; big ones don't. One good post can beat a month of
your own content.

---

## 5. Launch week

- **Product Hunt:** create the account now, warm it up by commenting for a few
  days. Prepare logo, gallery (reuse store screenshots), 30s demo, tagline, and a
  maker comment telling the solo-dev story. Launch at 12:01 AM Pacific, reply to
  every comment all day.
- **Reddit:** one genuine post per relevant sub (r/fitness30plus, r/loseit,
  r/naturalbodybuilding) as a solo dev asking for brutal feedback — NOT an ad.
  Read each sub's self-promo rules first. Also doubles as user research.

---

## 6. What to measure (the funnel)

The chain, where you lose people at each step:
> sees video → taps profile → taps bio link → store listing → installs →
> finishes onboarding → starts trial → converts to paid

- **TikTok analytics:** views → profile taps → link clicks.
- **Play Console → Statistics:** listing visitors → installs, and D1/D7 retention.
- **RevenueCat → Charts:** trial starts, trial→paid, churn.
- **A weekly spreadsheet:** one row/week of the numbers above. 15 min every
  Sunday. This IS your dashboard until you have real volume.

Key numbers for paid viability:
- **CPI** (cost per install) = spend ÷ installs.
- **LTV** (lifetime value) = avg revenue per user before churn. Ads are profitable
  only when LTV > CPI.
- **D7 retention:** if it's very low, users churn before converting — fix the app
  before scaling spend. Ads can't outrun churn.

---

## 7. Timeline & budget

- **Weeks 1–2 (pre-launch):** landing page, ASO/screenshots, bank 10 videos,
  create accounts, start posting, collect emails.
- **Weeks 3–6 (launch):** Product Hunt + Reddit, post daily, reply to everything,
  iterate on which hooks get views.
- **Weeks 7–12:** double down on the 2 formats that worked, start Google App
  Campaigns, then Spark Ads on proven winners, seed micro-influencers.

**Budget:** $0–200/mo pre-traction (tools only), then $500–1,500/mo once paid
starts. The real cost is ~1 hr/day of content.

---

## 8. Single highest-leverage move

Film the photo-scan demo, post it with five different hooks this week, and let
TikTok tell you which positioning wins BEFORE you spend a dollar on ads.
