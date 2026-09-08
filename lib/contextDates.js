import { format } from 'date-fns';

// Dates the model can place in time.
//
// Every dated line in the coach's context used to read "Wed Aug 5" — no year,
// and nothing anywhere stating what today was. A bare calendar date is not a
// point in time to a model with a training cutoff: it cannot tell yesterday
// from eleven months ago, so it fell back to guessing, and the guess came out
// as "you haven't trained this week" printed over a chart showing that you had.

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// 'yyyy-MM-dd' (health logs, nutrition, readiness check-ins) parses as UTC
// midnight, which is the PREVIOUS day everywhere west of Greenwich — enough to
// label today's check-in "YESTERDAY". Those columns are calendar dates, not
// instants, so build them as local midnight instead.
export function toLocalDate(d) {
  if (d instanceof Date) return d;
  // new Date(null) is the epoch, not an invalid date — a null completed_at
  // would otherwise reach the prompt as "Thu Jan 1 (20677 days ago)".
  if (d === null || d === undefined || d === '') return new Date(NaN);
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  }
  return new Date(d);
}

// Whole days between `d` and `now`, by calendar day rather than elapsed hours:
// a session at 23:00 last night is 1 day ago, not 0.
export function daysAgo(d, now = new Date()) {
  return Math.round((startOfDay(now) - startOfDay(toLocalDate(d))) / 86400000);
}

// "Tue Aug 11 (YESTERDAY)" — the date, plus its distance from today spelled out.
export function relDate(d, now = new Date()) {
  const date = toLocalDate(d);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  const n = daysAgo(date, now);
  const when = n === 0 ? 'TODAY'
    : n === 1 ? 'YESTERDAY'
    : n < 0 ? `in ${-n} days`
    : `${n} days ago`;
  return `${format(date, 'EEE MMM d')} (${when})`;
}

// The anchor line. Goes FIRST in the context, before any dated data.
export function todayLine(now = new Date()) {
  return `TODAY IS ${format(now, 'EEEE, d MMMM yyyy')}. Every date below is labelled with how long ago it was — use those labels, never your own sense of the current date. A session marked TODAY or YESTERDAY was just done; do not tell the user they have not trained.`;
}
