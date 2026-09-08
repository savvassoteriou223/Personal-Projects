// Helix Insights Engine
// Correlates nutrition + recovery data with training performance (session RPE).
// Pure functions, no API calls. Needs enough history to surface anything.
//
// The signal we use is perceived_exertion (RPE) per session — lower RPE for the
// same work means the session felt easier, i.e. better readiness/fuelling.

function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Local-time date keys — nutrition/health logs are stored under the user's
// local day, so matching with UTC dates misattributed evening sessions.
const pad = (n) => String(n).padStart(2, '0');
const localDate = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const dayKey = (d) => localDate(new Date(d));
const prevKey = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - 1);
  return localDate(x);
};

// sessions:        [{ completed_at, perceived_exertion }]   (strength only)
// nutritionByDate: { 'YYYY-MM-DD': { protein, calories } }
// healthByDate:    { 'YYYY-MM-DD': { sleep_hours, hrv_ms } }
// targets:         { protein_target, caloric_target }
export function computeInsights({ sessions = [], nutritionByDate = {}, healthByDate = {}, targets = {} }) {
  const insights = [];
  const rated = sessions.filter(s => s.perceived_exertion && s.completed_at);
  if (rated.length < 6) return insights; // not enough signal yet

  // ── Protein (prior day) vs session effort ──
  if (targets.protein_target > 0) {
    const hit = [], miss = [];
    rated.forEach(s => {
      const n = nutritionByDate[prevKey(s.completed_at)];
      if (!n || !n.protein) return;
      (n.protein >= targets.protein_target * 0.9 ? hit : miss).push(s.perceived_exertion);
    });
    if (hit.length >= 3 && miss.length >= 3) {
      const dh = avg(hit), dm = avg(miss);
      if (dm - dh >= 0.5) {
        insights.push(`On days you hit your protein target, sessions feel easier — average effort ${dh.toFixed(1)}/10 vs ${dm.toFixed(1)}/10 when you fall short.`);
      }
    }
  }

  // ── Sleep (night before) vs session effort ──
  const slept = [], tired = [];
  rated.forEach(s => {
    const h = healthByDate[dayKey(s.completed_at)];
    if (!h || h.sleep_hours == null) return;
    (h.sleep_hours >= 7 ? slept : tired).push(s.perceived_exertion);
  });
  if (slept.length >= 3 && tired.length >= 3) {
    const ds = avg(slept), dt = avg(tired);
    if (dt - ds >= 0.5) {
      insights.push(`After 7+ hours sleep your sessions average ${ds.toFixed(1)}/10 effort, vs ${dt.toFixed(1)}/10 on less. Sleep is moving the needle.`);
    }
  }

  // ── HRV (vs personal baseline) vs session effort ──
  const hrvVals = rated.map(s => healthByDate[dayKey(s.completed_at)]?.hrv_ms).filter(Boolean);
  if (hrvVals.length >= 6) {
    const baseline = avg(hrvVals);
    const high = [], low = [];
    rated.forEach(s => {
      const h = healthByDate[dayKey(s.completed_at)];
      if (!h?.hrv_ms) return;
      (h.hrv_ms >= baseline ? high : low).push(s.perceived_exertion);
    });
    if (high.length >= 3 && low.length >= 3) {
      const dhi = avg(high), dlo = avg(low);
      if (dlo - dhi >= 0.5) {
        insights.push(`When your HRV is above your ${Math.round(baseline)}ms baseline, training feels easier (${dhi.toFixed(1)} vs ${dlo.toFixed(1)}/10). Low-HRV days are worth a lighter session.`);
      }
    }
  }

  return insights.slice(0, 3);
}
