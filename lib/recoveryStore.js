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
