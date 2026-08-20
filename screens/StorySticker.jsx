import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';

/**
 * The 9:16 story sticker — a transparent PNG that lands on top of the photo the
 * user was already going to post, rather than a card that asks to BE the post.
 *
 * Deliberately has no background of any kind. `captureRef` produces transparency
 * only where nothing is painted, so a single stray backgroundColor anywhere in
 * this tree turns the sticker into a black rectangle. If you add a wrapper here,
 * do not give it a fill.
 *
 * Legibility therefore rests entirely on the text shadow. The design mock used
 * three stacked shadows (tight contour, near lift, wide separation); React
 * Native supports exactly ONE per Text, so this ships the tight contour, which
 * is the layer that does most of the work — it holds the letterforms against a
 * bright photo. The dim end of the ramp is lifted to compensate: values that
 * read fine over the app's own dark surface disappear over a gym window.
 */

// The accent is lifted off the app's #1D9E75. That green is tuned for a
// near-black app surface and goes muddy over an arbitrary photo.
const ACCENT = '#2FD69C';
const INK = '#FFFFFF';
const INK_2 = 'rgba(255,255,255,0.85)';
const INK_3 = 'rgba(255,255,255,0.78)';

// One shadow, as strong as the platform allows.
const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.95)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 7,
};

/** Reference width the type is proportioned against — the exported PNG size. */
export const STICKER_CANVAS = 1080;

export const StorySticker = forwardRef(function StorySticker(
  { achievement, best, focus, handle = '@helixfitapp', percentile = null, width = 320 },
  ref,
) {
  const { t } = useTranslation();
  const px = n => Math.round((n * width) / STICKER_CANVAS);
  const a = achievement || { type: 'muscles' };

  // Every rung of the ladder resolves to the same four slots, so the sticker
  // has one layout rather than four.
  let kicker = null;
  let sub = null;
  let hero = null;
  let heroUnit = null;
  let gain = null;

  if (a.type === 'pr') {
    kicker = t('workout.share.newPr', { defaultValue: 'NEW PR' });
    sub = a.exercise;
    hero = String(a.weight);
    heroUnit = ` kg × ${a.reps}`;
    gain = t('workout.share.prGain', { kg: a.gainKg, defaultValue: '+{{kg}} kg on your best' });
  } else if (a.type === 'streak') {
    kicker = t('workout.share.unbroken', { defaultValue: 'UNBROKEN' });
    sub = t('workout.share.everyWeek', { defaultValue: 'Every week, no gaps' });
    hero = String(a.weeks);
    heroUnit = ' weeks';
  } else if (a.type === 'heaviest') {
    kicker = t('workout.share.heaviestYet', { defaultValue: 'HEAVIEST YET' });
    sub = t('workout.share.acrossSessions', { n: a.sessions, defaultValue: 'across {{n}} sessions' });
    hero = a.volumeKg.toLocaleString();
    heroUnit = ' kg';
    gain = t('workout.share.overAverage', { pct: a.overAveragePct, defaultValue: '+{{pct}}% on your average' });
  } else {
    // Nothing rare happened. The best set of the day is still worth showing,
    // and when there is no loaded set at all the block simply collapses.
    sub = best?.name || null;
    hero = best ? String(best.weight) : null;
    heroUnit = best ? ` kg × ${best.reps}` : null;
  }

  return (
    <View ref={ref} collapsable={false} style={[styles.root, { width, paddingHorizontal: px(30), paddingVertical: px(28) }]}>
      {!!focus && (
        <Text style={[styles.what, SHADOW, { fontSize: px(30), letterSpacing: px(30) * 0.16, marginBottom: px(44) }]} numberOfLines={2}>
          {focus.toUpperCase()}
        </Text>
      )}

      {!!kicker && (
        <Text style={[styles.kicker, SHADOW, { fontSize: px(34), letterSpacing: px(34) * 0.2 }]} numberOfLines={1}>
          {kicker}
        </Text>
      )}
      {!!sub && (
        <Text style={[styles.sub, SHADOW, { fontSize: px(40), marginTop: px(6) }]} numberOfLines={1}>
          {sub}
        </Text>
      )}
      {!!hero && (
        <Text style={[styles.hero, SHADOW, { fontSize: px(150), marginTop: px(6) }]} numberOfLines={1} adjustsFontSizeToFit>
          {hero}
          <Text style={[styles.heroUnit, { fontSize: px(56) }]}>{heroUnit}</Text>
        </Text>
      )}
      {!!gain && (
        <Text style={[styles.gain, SHADOW, { fontSize: px(32), marginTop: px(10) }]} numberOfLines={1}>
          {gain}
        </Text>
      )}

      {/* The comparison. Rendered only when a percentile was actually supplied
          — it can only come from a licensed or openly-licensed standards
          dataset, and an unsourced number here would be the one line on the
          sticker that is not the user's own. No source, no chip. */}
      {percentile != null && (
        <View style={[styles.chip, { marginTop: px(40), borderRadius: px(999), paddingHorizontal: px(36), paddingVertical: px(18) }]}>
          <Text style={[styles.chipText, { fontSize: px(38), letterSpacing: px(38) * 0.08 }]}>
            {t('workout.share.topPct', { pct: percentile, defaultValue: 'TOP {{pct}}%' })}
          </Text>
        </View>
      )}

      <View style={[styles.mark, { marginTop: px(48), gap: px(20) }]}>
        <Text style={[styles.markName, SHADOW, { fontSize: px(28), letterSpacing: px(28) * 0.2 }]}>HELIX</Text>
        <Text style={[styles.markHandle, SHADOW, { fontSize: px(28) }]}>{handle}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // No backgroundColor anywhere in this tree — see the note above.
  root: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  what: { color: INK_3, fontWeight: '700' },
  kicker: { color: ACCENT, fontWeight: '800' },
  sub: { color: INK_2, fontWeight: '600' },
  hero: { color: INK, fontWeight: '800', letterSpacing: -1 },
  heroUnit: { color: INK_2, fontWeight: '600', letterSpacing: 0 },
  gain: { color: ACCENT, fontWeight: '700' },
  // The chip is the one filled element, so it needs no shadow of its own.
  chip: { backgroundColor: ACCENT },
  chipText: { color: '#08150F', fontWeight: '800' },
  mark: { flexDirection: 'row', alignItems: 'baseline' },
  markName: { color: ACCENT, fontWeight: '800' },
  markHandle: { color: INK_3, fontWeight: '500' },
});

export default StorySticker;
