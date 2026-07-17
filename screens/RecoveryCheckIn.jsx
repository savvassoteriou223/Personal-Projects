// Pre-workout readiness sheet. Presentational only: it reports the result
// upward and never writes to the DB or mutates session state.
import {
  useState } from 'react';
import { View, Text, Modal, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { READINESS_QUESTIONS, scoreCheckIn } from '../lib/readiness';
import { colors, spacing, radius } from '../lib/theme';
import Tappable from '../components/Tappable';

const LABEL_COLOR = { Ready: colors.accent, Moderate: colors.warning, Low: colors.danger };

export default function RecoveryCheckIn({ visible, onSkip, onDone }) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null); // { score, label } once submitted

  const allAnswered = READINESS_QUESTIONS.every(q => answers[q.id]);

  const submit = () => {
    const r = scoreCheckIn(answers);
    // 'Ready' has nothing to say — don't interrupt someone who feels fine.
    if (r.label === 'Ready') onDone({ answers, ...r, applied: false });
    else setResult(r);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.grab} />
          {!result ? (
            <>
              <Text style={s.title}>{t('readiness.title')}</Text>
              {READINESS_QUESTIONS.map(q => (
                <View key={q.id} style={s.q}>
                  <Text style={s.qLabel}>{t(q.labelKey)}</Text>
                  <View style={s.opts}>
                    {q.options.map(opt => {
                      const on = answers[q.id] === opt;
                      return (
                        <Tappable
                          key={opt}
                          style={[s.opt, on && s.optOn]}
                          hitSlop={6}
                          onPress={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                        >
                          <Text style={[s.optText, on && s.optTextOn]}>{t(`readiness.opt.${opt}`)}</Text>
                        </Tappable>
                      );
                    })}
                  </View>
                </View>
              ))}
              <View style={s.row}>
                <Tappable style={[s.btn, s.btnGhost]} onPress={onSkip} hitSlop={8}>
                  <Text style={s.btnGhostText}>{t('readiness.skip')}</Text>
                </Tappable>
                <Tappable
                  style={[s.btn, s.btnPrimary, !allAnswered && s.btnDisabled]}
                  disabled={!allAnswered}
                  onPress={submit}
                  hitSlop={8}
                >
                  <Text style={s.btnPrimaryText}>{t('readiness.continue')}</Text>
                </Tappable>
              </View>
            </>
          ) : (
            <>
              <Text style={[s.title, { color: LABEL_COLOR[result.label] }]}>
                {t(`readiness.label.${result.label}`)}
              </Text>
              <Text style={s.advice}>
                {result.label === 'Low' ? t('readiness.adviceLow') : t('readiness.adviceModerate')}
              </Text>
              <View style={s.row}>
                <Tappable style={[s.btn, s.btnGhost]} hitSlop={8}
                  onPress={() => onDone({ answers, ...result, applied: false })}>
                  <Text style={s.btnGhostText}>{t('readiness.asPlanned')}</Text>
                </Tappable>
                <Tappable style={[s.btn, s.btnAccent]} hitSlop={8}
                  onPress={() => onDone({ answers, ...result, applied: true })}>
                  <Text style={s.btnPrimaryText}>{t('readiness.apply')}</Text>
                </Tappable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['3xl'],
  },
  grab: { width: 34, height: 4, borderRadius: 2, backgroundColor: colors.control, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  q: { marginBottom: spacing.md },
  qLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
  opts: { flexDirection: 'row', gap: spacing.sm },
  opt: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  optOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optText: { fontSize: 12, color: colors.textSubtle },
  optTextOn: { color: colors.textOnAccent, fontWeight: '700' },
  advice: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: 14, borderRadius: radius.lg, alignItems: 'center' },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.textPrimary },
  btnPrimaryText: { color: colors.textOnLight, fontSize: 14, fontWeight: '700' },
  btnAccent: { backgroundColor: colors.accent },
  btnDisabled: { opacity: 0.4 },
});
