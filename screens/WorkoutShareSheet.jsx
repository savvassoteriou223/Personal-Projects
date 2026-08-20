import { useRef, useState, useEffect, forwardRef } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { colors, spacing, radius, type } from '../lib/theme';
import Tappable from '../components/Tappable';
import { shareCard, shareSticker, canShareImage, SHARE_CARD_RATIO } from '../lib/shareService';
import StorySticker from './StorySticker';

// How many exercises fit before the card stops being scannable. Past six the
// rows have to shrink to fit the 4:5 frame, and a wall of 5pt text is not what
// anyone posts. The rest collapse into a "+n more" line.
const MAX_ROWS = 6;

/**
 * Everything the card draws, derived once from the live session so the card
 * itself stays a dumb renderer — it can be handed a past session from history
 * later without touching this component.
 *
 * Volume is the headline number every training app shares because it is the one
 * stat that moves for a reason: it only goes up if you added weight or reps.
 * Warm-up sets are excluded — they inflate it without meaning anything.
 */
export function buildShareStats({ workoutName, focus, sets, durationSec, streakWeeks = 0 }) {
  const rows = [];
  let volumeKg = 0;
  let setsDone = 0;
  let totalReps = 0;

  (sets || []).forEach(ex => {
    let best = null;
    (ex.completedSets || []).forEach(s => {
      if (!s.done || s.type === 'warmup') return;
      const w = parseFloat(s.weight) || 0;
      const r = parseInt(s.reps) || 0;
      setsDone++;
      totalReps += r;
      volumeKg += w * r;
      // "Best" is heaviest, with reps breaking a tie — the set someone would
      // actually name if you asked what they did on this exercise.
      if (!best || w > best.w || (w === best.w && r > best.r)) best = { w, r };
    });
    if (best) rows.push({ name: ex.name, weight: best.w, reps: best.r });
  });

  return {
    workoutName,
    focus,
    date: new Date(),
    durationMin: Math.max(1, Math.round((durationSec || 0) / 60)),
    setsDone,
    volumeKg: Math.round(volumeKg),
    totalReps,
    streakWeeks,
    rows,
  };
}

/**
 * The card that gets rasterised and posted.
 *
 * Laid out at whatever width the parent gives it and captured at a fixed pixel
 * width, so every value here is proportional to `w` rather than absolute — the
 * same card exports identically from a small phone and a tablet.
 */
export const ShareCard = forwardRef(function ShareCard({ stats, width }, ref) {
  const { t } = useTranslation();
  // 1080 is the capture width; scaling off it keeps the on-screen preview an
  // exact miniature of the exported PNG instead of a rough approximation.
  const k = width / 1080;
  const px = n => Math.round(n * k);
  const shown = stats.rows.slice(0, MAX_ROWS);
  const hidden = stats.rows.length - shown.length;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width, height: width * SHARE_CARD_RATIO, padding: px(72), borderRadius: px(48) }]}
    >
      <View style={styles.cardTop}>
        <Text style={[styles.wordmark, { fontSize: px(30), letterSpacing: px(6) }]}>HELIX</Text>
        <Text style={[styles.cardDate, { fontSize: px(30) }]}>{format(stats.date, 'd MMM yyyy')}</Text>
      </View>

      <Text style={[styles.cardTitle, { fontSize: px(76), marginTop: px(56) }]} numberOfLines={2}>
        {stats.workoutName}
      </Text>
      {!!stats.focus && (
        <Text style={[styles.cardFocus, { fontSize: px(34), marginTop: px(12) }]} numberOfLines={1}>
          {stats.focus}
        </Text>
      )}

      <View style={[styles.rule, { marginTop: px(56), marginBottom: px(40) }]} />

      <View style={styles.statRow}>
        {[
          [String(stats.durationMin), t('workout.share.min', { defaultValue: 'MIN' })],
          [String(stats.setsDone), t('workout.share.sets', { defaultValue: 'SETS' })],
          // Bodyweight work logs no weight unless the user has both set a
          // bodyweight AND toggled BW mode on that exercise, so tonnage would
          // read a flat "0 KG LIFTED" on a perfectly good calisthenics session.
          // Total reps is the honest headline when nothing was loaded.
          stats.volumeKg > 0
            ? [stats.volumeKg.toLocaleString(), t('workout.share.volume', { defaultValue: 'KG LIFTED' })]
            : [stats.totalReps.toLocaleString(), t('workout.share.reps', { defaultValue: 'REPS' })],
        ].map(([val, label]) => (
          <View key={label} style={styles.stat}>
            <Text style={[styles.statVal, { fontSize: px(104) }]} numberOfLines={1} adjustsFontSizeToFit>{val}</Text>
            <Text style={[styles.statLabel, { fontSize: px(26), letterSpacing: px(2), marginTop: px(6) }]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.rule, { marginTop: px(40), marginBottom: px(36) }]} />

      <View style={{ flex: 1, gap: px(18) }}>
        {shown.map((r, i) => (
          <View key={i} style={styles.exRow}>
            <Text style={[styles.exName, { fontSize: px(34) }]} numberOfLines={1}>{r.name}</Text>
            <Text style={[styles.exSet, { fontSize: px(34) }]}>
              {r.weight > 0 ? `${r.weight} × ${r.reps}` : `× ${r.reps}`}
            </Text>
          </View>
        ))}
        {hidden > 0 && (
          <Text style={[styles.exMore, { fontSize: px(30) }]}>
            {/* `n`, not `count` — an i18next `count` option triggers plural-key
                lookup (key_one/key_few/…), which none of the 8 locales define. */}
            {t('workout.share.more', { n: hidden, defaultValue: '+{{n}} more' })}
          </Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={[styles.tagline, { fontSize: px(28) }]}>
          {t('workout.share.tagline', { defaultValue: 'Science-backed training' })}
        </Text>
        {stats.streakWeeks >= 2 && (
          <View style={[styles.streakChip, { borderRadius: px(999), paddingHorizontal: px(24), paddingVertical: px(10) }]}>
            <Text style={[styles.streakText, { fontSize: px(28) }]}>
              {t('workout.share.streak', { weeks: stats.streakWeeks, defaultValue: '{{weeks}}-week streak' })}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

/**
 * Preview-then-post, rather than firing the OS share sheet straight from a
 * button. Posting a card to a public feed is not an action to take on someone's
 * behalf sight-unseen — they get to read the numbers first and back out.
 */
export default function WorkoutShareSheet({ visible, stats, achievement, onClose }) {
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const cardRef = useRef(null);
  const stickerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [imageCapable, setImageCapable] = useState(true);
  // Story is the default. A sticker decorates a post someone was already going
  // to make; the card asks them to post an advert instead, which is a much
  // bigger favour to ask.
  const [mode, setMode] = useState('story');

  useEffect(() => {
    if (visible) canShareImage().then(setImageCapable);
  }, [visible]);

  if (!stats) return null;

  // Leave room for the modal padding and the action row beneath the card.
  const cardW = Math.min(screenW - spacing.xl * 2, 420);

  // Mirrors the card's third stat, so the text fallback never claims a tonnage
  // a bodyweight session did not have.
  const fallback = stats.volumeKg > 0
    ? t('workout.share.message', {
        name: stats.workoutName,
        mins: stats.durationMin,
        sets: stats.setsDone,
        volume: stats.volumeKg.toLocaleString(),
        defaultValue: '{{name}} — {{mins}} min, {{sets}} sets, {{volume}} kg lifted. Tracked with Helix.',
      })
    : t('workout.share.messageReps', {
        name: stats.workoutName,
        mins: stats.durationMin,
        sets: stats.setsDone,
        reps: stats.totalReps.toLocaleString(),
        defaultValue: '{{name}} — {{mins}} min, {{sets}} sets, {{reps}} reps. Tracked with Helix.',
      });

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'story') await shareSticker(stickerRef, fallback);
      else await shareCard(cardRef, fallback);
    } finally {
      setBusy(false);
    }
  };

  const modes = [
    ['story', t('workout.share.modeStory', { defaultValue: 'Story' })],
    ['card', t('workout.share.modeCard', { defaultValue: 'Card' })],
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('workout.share.title', { defaultValue: 'Share your session' })}</Text>
            <Tappable onPress={onClose} hitSlop={12} accessibilityLabel={t('common.close', { defaultValue: 'Close' })}>
              <Text style={styles.sheetClose}>✕</Text>
            </Tappable>
          </View>

          <View style={styles.modeRow}>
            {modes.map(([key, label]) => (
              <Tappable
                key={key}
                style={[styles.modeBtn, mode === key && styles.modeBtnOn]}
                onPress={() => setMode(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === key }}
              >
                <Text style={[styles.modeText, mode === key && styles.modeTextOn]}>{label}</Text>
              </Tappable>
            ))}
          </View>

          {/* Both stay mounted: captureRef needs a laid-out view, and a ref to
              something that unmounted on a tab switch captures nothing. The
              inactive one is moved off-screen rather than hidden, because
              display:none has no layout to capture either. */}
          <View style={mode === 'card' ? styles.stage : styles.offstage} pointerEvents="none">
            <ShareCard ref={cardRef} stats={stats} width={cardW} />
          </View>

          <View style={mode === 'story' ? styles.stage : styles.offstage} pointerEvents="none">
            {/* The dark plate is preview only — it is NOT captured. It stands in
                for the photo the sticker will actually sit on, so the user can
                see a transparent asset at all. */}
            <View style={[styles.stickerPlate, { width: cardW }]}>
              <StorySticker
                ref={stickerRef}
                achievement={achievement}
                best={stats.rows?.[0] ? { name: stats.rows[0].name, weight: stats.rows[0].weight, reps: stats.rows[0].reps } : null}
                focus={stats.focus || stats.workoutName}
                width={cardW - spacing.lg * 2}
              />
            </View>
            <Text style={styles.plateNote}>
              {t('workout.share.storyNote', { defaultValue: 'Transparent — it sits on top of your own photo.' })}
            </Text>
          </View>

          {/* Only shown when the image path is genuinely unavailable, so the
              user is never surprised by a plain-text post. */}
          {!imageCapable && (
            <Text style={styles.textOnlyNote}>
              {t('workout.share.textOnly', { defaultValue: 'This version can only share as text.' })}
            </Text>
          )}

          <Tappable
            style={[styles.shareBtn, busy && { opacity: 0.5 }]}
            onPress={onShare}
            disabled={busy}
            accessibilityLabel={t('workout.share.action', { defaultValue: 'Share' })}
          >
            {busy
              ? <ActivityIndicator color={colors.textOnLight} />
              : <Text style={styles.shareBtnText}>{t('workout.share.action', { defaultValue: 'Share' })}</Text>}
          </Tappable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ── The exported card ──
  // Deliberately flat: no gradient, no glow. It has to stay legible after a
  // social platform re-compresses it, and a flat dark panel survives that.
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { color: colors.textPrimary, fontWeight: '700' },
  cardDate: { color: colors.textFaint, fontWeight: '400' },
  cardTitle: { color: colors.textPrimary, fontWeight: '700', letterSpacing: -1 },
  cardFocus: { color: colors.textMuted, fontWeight: '400' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1 },
  statVal: { color: colors.textPrimary, fontWeight: '700', letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textSubtle, fontWeight: '600' },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  exName: { color: colors.textSecondary, fontWeight: '400', flex: 1 },
  exSet: { color: colors.textMuted, fontWeight: '600', fontVariant: ['tabular-nums'] },
  exMore: { color: colors.textFaint, fontWeight: '400' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagline: { color: colors.textFaint, fontWeight: '400' },
  // The only accent on the card. A streak is the one thing here that is not
  // just this session, so it is the one thing that earns colour.
  streakChip: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentHair },
  streakText: { color: colors.accent, fontWeight: '700' },

  // ── The sheet around it ──
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card,
    padding: spacing.xl, paddingBottom: spacing['2xl'],
    alignItems: 'center', gap: spacing.lg,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sheetTitle: { ...type.section, color: colors.textPrimary },
  sheetClose: { fontSize: 20, color: colors.textMuted, paddingHorizontal: spacing.sm },

  // Story / Card switch
  modeRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  modeBtn: {
    flex: 1, minHeight: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceInset,
  },
  modeBtnOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentHair },
  modeText: { ...type.body, fontWeight: '600', color: colors.textMuted },
  modeTextOn: { color: colors.accent },

  stage: { alignItems: 'center', gap: spacing.sm },
  // Off-screen rather than hidden: captureRef needs real layout, and a view
  // with display:none has none to capture.
  offstage: { position: 'absolute', left: -10000, top: 0, opacity: 0 },

  stickerPlate: {
    backgroundColor: colors.bgDeep, borderRadius: radius.card, padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  plateNote: { ...type.body, color: colors.textFaint, textAlign: 'center' },
  textOnlyNote: { ...type.body, color: colors.textFaint, textAlign: 'center' },
  shareBtn: {
    width: '100%', backgroundColor: colors.surfaceInverse, borderRadius: radius.control,
    paddingVertical: spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  shareBtnText: { ...type.lead, fontWeight: '600', color: colors.textOnLight },
});
