/**
 * WhySheet.jsx — the "shows its work" layer.
 *
 * Helix prescribes numbers (3 sets, 8–12 reps, RPE 8, 2:00 rest). Every other
 * training app asks you to trust them. This sheet answers "why this number?"
 * with the actual research already in the app — scienceEngine's guidelines and
 * studiesLibrary's citations. Nothing here is generated or approximated: if
 * there's no citation for a topic, the sheet says so rather than inventing one.
 *
 *   const [why, setWhy] = useState(null);
 *   <Why onPress={() => setWhy(buildWhy('reps', { value: '8–12' }))} />
 *   <WhySheet topic={why} onClose={() => setWhy(null)} />
 */
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';
import Tappable from './Tappable';
import { getStudiesByTags } from '../screens/studiesLibrary';
import { REP_RANGES, REST_PERIODS, VOLUME_GUIDELINES, EFFORT_GUIDELINES, getRPEInfo } from '../screens/scienceEngine';

// Build a topic from the app's real science data. `value` is what the user is
// actually looking at, so the explanation is about their prescription — not a
// generic encyclopedia entry.
export function buildWhy(kind, { value, muscle } = {}) {
  switch (kind) {
    case 'sets': {
      const opt = VOLUME_GUIDELINES.optimal_range;
      return {
        kind, value, title: 'Why this many sets',
        body: `Sets count per muscle per week, not per session — this exercise is one contribution toward that total. The target band is ${opt.sets_per_week} sets/week; ${VOLUME_GUIDELINES.minimum_effective.sets_per_week} is the minimum that grows anything.`,
        basis: VOLUME_GUIDELINES.research_basis,
        studies: getStudiesByTags(['volume'], 3),
      };
    }
    case 'reps': {
      // Match on the range the prescription actually sits in. An earlier version
      // allowed slop on the upper bound, which made "8–12" resolve to the 1–5
      // strength band; containment first, nearest-midpoint only as a fallback.
      const nums = (String(value).match(/\d+/g) || []).map(Number);
      const n = nums.length ? (nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0]) : 10;
      const parse = (r) => {
        const [lo, hi] = r.range.replace('+', '').split(/[–-]/).map(x => parseInt(x, 10));
        return [lo, Number.isFinite(hi) ? hi : lo + 10];
      };
      const band =
        REP_RANGES.ranges.find(r => { const [lo, hi] = parse(r); return n >= lo && n <= hi; }) ||
        REP_RANGES.ranges.reduce((best, r) => {
          const mid = (x) => { const [lo, hi] = parse(x); return (lo + hi) / 2; };
          return Math.abs(mid(r) - n) < Math.abs(mid(best) - n) ? r : best;
        }, REP_RANGES.ranges[1]);
      return {
        kind, value, title: 'Why this rep range',
        body: `${band.primary_benefit}. ${band.notes}`,
        basis: REP_RANGES.research_basis,
        studies: getStudiesByTags(['reps', 'progression', 'overload'], 2),
      };
    }
    case 'rest': {
      // Match the prescribed rest to the closest researched band rather than
      // assuming a tier — "2–3 min" should explain itself, not the heavy-compound row.
      // Use the lower bound: "2–3 min" is the moderate-compound band, not the
      // heavy one its upper bound would collide with.
      const parts = (String(value).match(/\d+/g) || []).map(Number);
      const unit = /s\b|sec/i.test(String(value)) && !/m/i.test(String(value)) ? 1 : 60;
      const secs = parts.length ? parts[0] * unit : 120;
      const bands = REST_PERIODS.by_exercise_type;
      const entry = bands.reduce((best, b) =>
        Math.abs(b.rest_seconds - secs) < Math.abs(best.rest_seconds - secs) ? b : best, bands[0]);
      return {
        kind, value, title: 'Why this rest',
        body: `${entry.type} (${entry.rest_range}). ${entry.rationale}`,
        basis: REST_PERIODS.research_basis,
        // 'rest' only — broadening to 'recovery' pulled in failure/sleep findings
        // that read as non-sequiturs under a rest heading.
        studies: getStudiesByTags(['rest'], 2),
      };
    }
    case 'rpe': {
      const last = parseFloat(String(value).split('→').pop());
      const info = getRPEInfo(Number.isFinite(last) ? last : 8);
      const tier = EFFORT_GUIDELINES.by_exercise_type.secondary_compounds;
      return {
        kind, value, title: 'Why this effort',
        body: info
          ? `RPE ${info.rpe} — ${info.label.toLowerCase()}: ${info.description}. ${tier.rationale}`
          : tier.rationale,
        basis: EFFORT_GUIDELINES.research_summary,
        studies: getStudiesByTags(['effort', 'rir'], 2),
      };
    }
    default:
      return null;
  }
}

// The affordance: a small superscript marker that reads as "there's a reason
// behind this". Deliberately quiet — it shouldn't compete with the number.
export function WhyMark() {
  return <Text style={s.mark}>?</Text>;
}

export default function WhySheet({ topic, onClose }) {
  const { t } = useTranslation();
  if (!topic) return null;
  const studies = topic.studies || [];

  return (
    <Modal visible={!!topic} animationType="fade" transparent onRequestClose={onClose}>
      <Tappable style={s.scrim} onPress={onClose} accessibilityLabel={t('common.close')}>
        <Tappable style={s.card} onPress={() => {}}>
          <View style={s.head}>
            <Text style={s.eyebrow}>{topic.title}</Text>
            {topic.value != null && <Text style={s.value}>{topic.value}</Text>}
          </View>

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            <Text style={s.body}>{topic.body}</Text>

            {studies.length > 0 ? (
              <View style={s.studies}>
                {studies.map((st, i) => (
                  <View key={st.id || i} style={[s.study, i > 0 && s.studyBorder]}>
                    <Text style={s.studyText}>{st.insight}</Text>
                    <Text style={s.cite}>{st.cite}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={s.noCite}>No direct citation for this one — it follows from the guidelines above.</Text>
            )}

            {topic.basis ? <Text style={s.basis}>{topic.basis}</Text> : null}
          </ScrollView>

          <Tappable style={s.close} onPress={onClose}>
            <Text style={s.closeText}>{t('common.close')}</Text>
          </Tappable>
        </Tappable>
      </Tappable>
    </Modal>
  );
}

const s = StyleSheet.create({
  mark: { fontSize: 8, color: colors.textFaint, fontWeight: '700' },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 0.5, borderColor: colors.border, padding: 20,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSubtle, flex: 1 },
  value: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  studies: { marginTop: 16, backgroundColor: colors.surfaceInset, borderRadius: 12, borderWidth: 0.5, borderColor: colors.border, padding: 14 },
  study: { paddingVertical: 2 },
  studyBorder: { borderTopWidth: 0.5, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 },
  studyText: { fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  cite: { fontSize: 11, color: colors.accent, fontWeight: '700', marginTop: 6 },
  noCite: { fontSize: 12, color: colors.textFaint, marginTop: 14, fontStyle: 'italic' },
  basis: { fontSize: 11, lineHeight: 16, color: colors.textFaint, marginTop: 14 },
  close: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: colors.control, borderWidth: 0.5, borderColor: colors.borderStrong },
  closeText: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
});
