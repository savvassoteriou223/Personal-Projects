import {
  useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Purchases from '../lib/purchases';
import { colors } from '../lib/theme';
import Tappable from '../components/Tappable';

// Pro paywall. Rendered by the Coach tab (App.js) and mid-workout when a free
// user taps the in-workout Coach button (WorkoutExecutionScreen).
export default function PremiumPaywall({ feature, onUpgrade, onRestore }) {
  const [plan, setPlan] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [prices, setPrices] = useState({ monthly: null, yearly: null });

  useEffect(() => {
    Purchases.getOfferings().then(offerings => {
      const pkgs = offerings.current?.availablePackages || [];
      const monthly = pkgs.find(p => p.packageType === 'MONTHLY');
      const yearly = pkgs.find(p => p.packageType === 'ANNUAL');
      setPrices({
        monthly: monthly?.product?.priceString ?? null,
        yearly: yearly?.product?.priceString ?? null,
      });
    }).catch(() => {});
  }, []);

  const handleUpgradePress = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try { await onUpgrade(plan); } finally { setUpgrading(false); }
  };

  const features = {
    Coach: {
      title: 'Coach',
      tagline: 'A coach with your full training file open',
      bullets: [
        'Proactive insights — coach flags issues before you ask',
        'Weekly narrative summary every Sunday',
        'Full training + nutrition + body context',
        'Can actually modify your program — not just talk about it',
      ],
    },
    Nutrition: {
      icon: '◈',
      title: 'Smart Nutrition',
      tagline: 'Log any meal by describing it, snapping it, or saying it',
      bullets: [
        'Describe a meal in plain words — macros calculated for you',
        'Snap a photo of your plate and log the whole thing',
        'Hands-free voice logging',
      ],
    },
    Data: {
      icon: '◫',
      title: 'Your Data',
      tagline: 'Every workout, every meal, every recovery signal — not just this week',
      bullets: [
        'Full training history — every logged set, not a 7-day window',
        'Complete nutrition log, searchable by day',
        'Recovery trends: sleep, HRV, resting heart rate over time',
        'Cardio session history alongside your lifting log',
      ],
    },
  };

  const f = features[feature] || features.Coach;

  return (
    <View style={pw.container}>
      <ScrollView contentContainerStyle={pw.scroll}>
        <View style={pw.iconWrap}>
          {f === features.Coach
            ? <FontAwesome5 name="brain" size={28} color={colors.textPrimary} solid />
            : <Text style={pw.icon}>{f.icon}</Text>}
        </View>
        <Text style={pw.title}>{f.title}</Text>
        <Text style={pw.tagline}>{f.tagline}</Text>

        {/* What Coach actually looks like — sample content, not a live user's
            data. Replaces a wall of sales bullets with the real UI so someone
            decides to start the trial having seen the product, not read about it. */}
        {feature === 'Coach' && (
          <View style={pw.previewCard}>
            <View style={pw.previewDoneRow}>
              <View style={pw.previewCheck}><FontAwesome5 name="check" size={7} color={colors.accent} /></View>
              <Text style={pw.previewDoneText}>Squat 3 → 4 sets — 3 sessions at full reps</Text>
            </View>
            <View style={pw.previewDoneRow}>
              <View style={pw.previewCheck}><FontAwesome5 name="check" size={7} color={colors.accent} /></View>
              <Text style={pw.previewDoneText}>Face pulls dropped — flat 4 weeks</Text>
            </View>
            <View style={pw.previewFocus}>
              <Text style={pw.previewFocusEyebrow}>THIS WEEK'S REAL ISSUE</Text>
              <Text style={pw.previewFocusTitle}>Bench press has plateaued</Text>
              <Text style={pw.previewFocusBody}>Stuck at 100kg for 3 weeks — and protein missed 4 of 7 days. Fix protein first; deload is the fallback.</Text>
            </View>
            <View style={pw.previewLockRow}>
              <FontAwesome5 name="lock" size={10} color={colors.textFaint} />
              <Text style={pw.previewLockText}>Sample content — this is what your Coach actually shows</Text>
            </View>
          </View>
        )}

        <View style={pw.bulletList}>
          {f.bullets.map((b, i) => (
            <View key={i} style={pw.bulletRow}>
              <Text style={pw.bulletDot}>·</Text>
              <Text style={pw.bulletText}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={pw.planRow}>
          <Tappable
            style={[pw.planCard, plan === 'monthly' && pw.planCardActive]}
            onPress={() => setPlan('monthly')}
          >
            <Text style={[pw.planName, plan === 'monthly' && pw.planNameActive]}>Monthly</Text>
            <Text style={[pw.planPrice, plan === 'monthly' && pw.planPriceActive]}>{prices.monthly ?? '—'}</Text>
            <Text style={pw.planPer}>/ month</Text>
          </Tappable>
          <Tappable
            style={[pw.planCard, plan === 'yearly' && pw.planCardActive]}
            onPress={() => setPlan('yearly')}
          >
            <View style={pw.saveBadge}><Text style={pw.saveBadgeText}>SAVE 50%</Text></View>
            <Text style={[pw.planName, plan === 'yearly' && pw.planNameActive]}>Yearly</Text>
            <Text style={[pw.planPrice, plan === 'yearly' && pw.planPriceActive]}>{prices.yearly ?? '—'}</Text>
            <Text style={pw.planPer}>/ year</Text>
          </Tappable>
        </View>

        <Text style={pw.trialNote}>7-day free trial · Cancel anytime</Text>

        <Tappable style={[pw.upgradeBtn, upgrading && { opacity: 0.6 }]} onPress={handleUpgradePress} disabled={upgrading}>
          <Text style={pw.upgradeBtnText}>{upgrading ? 'Processing...' : 'Start free trial'}</Text>
        </Tappable>

        {/* hitSlop: the row is ~33pt tall, under the 44pt minimum — and stores
            require Restore to be reachable, so it must not be fiddly to hit. */}
        <Tappable style={pw.restoreBtn} onPress={onRestore} hitSlop={12}>
          <Text style={pw.restoreBtnText}>Restore purchase</Text>
        </Tappable>

        <Text style={pw.legalText}>
          Payment will be charged to your Apple ID / Google Play account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscription in your account settings. The 7-day free trial automatically converts to a paid subscription if not cancelled before the trial ends.
        </Text>
      </ScrollView>
    </View>
  );
}

const pw = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 28, paddingTop: 72, paddingBottom: 60, alignItems: 'center' },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.surfaceElevated, borderWidth: 0.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  icon: { fontSize: 26, color: colors.textPrimary },
  title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  tagline: { fontSize: 15, color: colors.textSubtle, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  previewCard: {
    alignSelf: 'stretch', backgroundColor: colors.surfaceRaised, borderRadius: 16,
    borderWidth: 0.5, borderColor: colors.border, padding: 14, marginBottom: 24,
  },
  previewDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  previewCheck: { width: 16, height: 16, borderRadius: 5, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  previewDoneText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  previewFocus: { backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 12, marginTop: 8 },
  previewFocusEyebrow: { fontSize: 9, fontWeight: '700', color: colors.danger, letterSpacing: 0.6, marginBottom: 4 },
  previewFocusTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  previewFocusBody: { fontSize: 11.5, color: colors.textMuted, lineHeight: 17 },
  previewLockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' },
  previewLockText: { fontSize: 10, color: colors.textFaint },
  bulletList: { alignSelf: 'stretch', marginBottom: 32, gap: 14 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { fontSize: 18, color: colors.textPrimary, lineHeight: 22, marginTop: 1 },
  bulletText: { fontSize: 14, color: colors.textMuted, lineHeight: 22, flex: 1 },
  priceCard: {
    alignSelf: 'stretch', backgroundColor: colors.surfaceRaised, borderRadius: 16,
    padding: 20, borderWidth: 0.5, borderColor: '#FFFFFF1A',
    alignItems: 'center', marginBottom: 16,
  },
  priceLabel: { fontSize: 11, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  price: { fontSize: 32, fontWeight: '300', color: colors.textPrimary, marginBottom: 6 },
  pricePer: { fontSize: 16, color: colors.textSubtle },
  priceSub: { fontSize: 12, color: colors.textFaint },
  upgradeBtn: {
    alignSelf: 'stretch', backgroundColor: colors.surfaceInverse, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  upgradeBtnText: { fontSize: 16, fontWeight: '700', color: colors.surfaceRaised },
  restoreBtn: { paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: colors.textFaint },
  legalText: { fontSize: 10, color: colors.textFaint, textAlign: 'center', lineHeight: 15, paddingTop: 16 },
  planRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginBottom: 16 },
  planCard: { flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  planCardActive: { borderColor: colors.borderActive, backgroundColor: colors.surfaceElevated },
  planName: { fontSize: 13, fontWeight: '600', color: colors.textSubtle, marginBottom: 6 },
  planNameActive: { color: colors.textPrimary },
  planPrice: { fontSize: 22, fontWeight: '700', color: colors.textSubtle },
  planPriceActive: { color: colors.textPrimary },
  planPer: { fontSize: 11, color: colors.textFaint, marginTop: 2 },
  saveBadge: { backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 },
  saveBadgeText: { fontSize: 9, fontWeight: '700', color: colors.accent, letterSpacing: 0.5 },
  trialNote: { fontSize: 12, color: colors.textFaint, marginBottom: 16 },
});
