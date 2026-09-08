// ─── EPLEY 1RM ESTIMATE ─────────────────────────────────────────────────────
// 1RM ≈ weight × (1 + reps/30). Single source of truth: ProgressScreen (charts
// tab) and PRsPanel (PRs tab) used to each carry their own copy with different
// rounding, so the same lift could show two different "1RM" numbers on
// adjacent tabs of the same screen. Callers round for display as needed —
// this returns the raw, unrounded estimate.

export function epley1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
