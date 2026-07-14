# Helix — App Overview

Helix is an AI-powered fitness and nutrition app. It builds a personalized
training program, coaches the user day to day, and tracks nutrition from a
photo or the user's voice.

## What the app does

**AI Coach**
- A conversational coach that knows the user's profile, goals, equipment, and
  training history.
- Remembers preferences, injuries, dislikes, and goals across sessions, and lets
  the user view and delete what it remembers.
- Adjusts the user's program on request (swap exercises, change sets/reps,
  add/remove movements) with research-backed reasoning.
- When asked to change an exercise, suggests ranked, evidence-based
  alternatives in a single reply.
- Generates a weekly narrative summary of the user's training.

**Workout program generator**
- Creates personalized training splits based on experience level, goals, sex,
  and available equipment (full gym, limited equipment, or bodyweight only).
- Volume-scaled and science-backed. Handles beginners through advanced.
- Adapts to injuries and health conditions (removes contraindicated exercises).
- Progressive overload tracking — learns the user's typical weight jumps.

**Nutrition tracking**
- Snap a photo of a meal and get automatic calorie and macro estimates.
- Log food by voice (speak what you ate).
- Barcode lookup for packaged foods.
- Daily calorie and macro targets computed from the user's stats and goals.

**Recovery (Android)**
- Reads sleep duration and resting heart rate from Health Connect.
- Computes a daily Recovery status card (Ready / Moderate / Low) shown on the
  Profile screen.
- When recovery is low, advises reducing training load or resting.
- (On iPhone, also uses HealthKit heart rate variability and steps.)

**Content libraries**
- Exercise, calisthenics, and movement libraries with technique guidance.
- A studies/science library citing research behind the recommendations.

**Account & subscription**
- Free tier plus Helix Pro (monthly or yearly subscription) unlocking AI coach
  and AI nutrition features.
- Multi-language support.

## Target user
People who train 3–5x/week or want to start, who want a personalized program and
easy nutrition tracking without manual data entry.

---

## What changed in this release (v23 / versionCode 23)

This is a compliance and stability update. No user-facing features were removed.

- Streamlined Android health permissions to only the data the app actively uses
  (sleep and resting heart rate for the Recovery status card). Heart rate
  variability and step-count permissions were removed on Android as they were
  not tied to a visible feature.
- Recovery status continues to work using sleep and resting heart rate.
- Various bug fixes and stability improvements.
