import { format, subDays, startOfWeek } from 'date-fns';

// Which week the Coach tab's narrative review is about.
//
// It is always the week that has ENDED, never the one in progress. The review
// text is generated once and cached for seven days, so the window it describes
// has to be one that cannot change underneath it. When it covered the CURRENT
// week, whatever was true at the moment the user tapped the button was frozen
// and shown all week — generate it on Sunday morning and "zero sessions
// completed this week" (true for about nine hours) stayed on screen through
// Saturday, contradicting the volume bars directly above it, which are
// recomputed live on every open.
//
// Weeks run Sunday–Saturday, so the week just ended becomes reviewable on
// Sunday — the cadence the paywall advertises, and what the offer copy has
// always claimed ("Your week is done").
export function reviewWindow(now = new Date()) {
  const end = startOfWeek(now, { weekStartsOn: 0 }); // this week's Sunday — exclusive
  return { start: subDays(end, 7), end };
}

// The weekly_summaries row key for the week being reviewed.
//
// `v2-` deliberately orphans every summary written before 2026-08: those were
// generated from a context that reported ZERO sets for every muscle (the Coach
// screen handed the volume engine name-only sets, which it discards as never
// performed), so re-showing one under the new week semantics would just be the
// old wrong text with a new label. Old rows stay in the table; nothing reads
// them.
export function reviewWeekKey(now = new Date()) {
  return `v2-${format(reviewWindow(now).start, 'yyyy-MM-dd')}`;
}

// True when `date` falls inside the reviewed week.
export function inReviewWindow(date, now = new Date()) {
  const { start, end } = reviewWindow(now);
  const d = date instanceof Date ? date : new Date(date);
  return d >= start && d < end;
}
