import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Purchases from '../lib/purchases';

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
      title: 'AI Coach',
      tagline: 'A coach with your full training file open',
      bullets: [
        'Proactive insights — coach flags issues before you ask',
        'Weekly narrative summary every Sunday',
        'Full training + nutrition + body context',
        'Can actually modify your program and calorie target',
      ],
    },
    Nutrition: {
      icon: '◈',
      title: 'Smart Nutrition',
      tagline: 'Adaptive targets that respond to your training',
      bullets: [
        'Calories auto-adjust based on weekly training volume',
        'Training day vs rest day macro splits',
        'Medical condition filters (IBS, PCOS, celiac, CKD)',
        '54 micronutrients tracked with deficiency alerts',
      ],
    },
  };

  const f = features[feature] || features.Coach;

  return (
    <View style={pw.container}>
      <ScrollView contentContainerStyle={pw.scroll}>
        <View style={pw.iconWrap}>
          {f === features.Coach
            ? <FontAwesome5 name="brain" size={28} color="#FFFFFF" solid />
            : <Text style={pw.icon}>{f.icon}</Text>}
        </View>
        <Text style={pw.title}>{f.title}</Text>
        <Text style={pw.tagline}>{f.tagline}</Text>

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
          <Pressable
            style={[pw.planCard, plan === 'monthly' && pw.planCardActive]}
            onPress={() => setPlan('monthly')}
          >
            <Text style={[pw.planName, plan === 'monthly' && pw.planNameActive]}>Monthly</Text>
            <Text style={[pw.planPrice, plan === 'monthly' && pw.planPriceActive]}>{prices.monthly ?? '—'}</Text>
            <Text style={pw.planPer}>/ month</Text>
          </Pressable>
          <Pressable
            style={[pw.planCard, plan === 'yearly' && pw.planCardActive]}
            onPress={() => setPlan('yearly')}
          >
            <View style={pw.saveBadge}><Text style={pw.saveBadgeText}>SAVE 50%</Text></View>
            <Text style={[pw.planName, plan === 'yearly' && pw.planNameActive]}>Yearly</Text>
            <Text style={[pw.planPrice, plan === 'yearly' && pw.planPriceActive]}>{prices.yearly ?? '—'}</Text>
            <Text style={pw.planPer}>/ year</Text>
          </Pressable>
        </View>

        <Text style={pw.trialNote}>7-day free trial · Cancel anytime</Text>

        <Pressable style={[pw.upgradeBtn, upgrading && { opacity: 0.6 }]} onPress={handleUpgradePress} disabled={upgrading}>
          <Text style={pw.upgradeBtnText}>{upgrading ? 'Processing...' : 'Start free trial'}</Text>
        </Pressable>

        <Pressable style={pw.restoreBtn} onPress={onRestore}>
          <Text style={pw.restoreBtnText}>Restore purchase</Text>
        </Pressable>

        <Text style={pw.legalText}>
          Payment will be charged to your Apple ID / Google Play account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. You can manage and cancel your subscription in your account settings. The 7-day free trial automatically converts to a paid subscription if not cancelled before the trial ends.
        </Text>
      </ScrollView>
    </View>
  );
}

const pw = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  scroll: { paddingHorizontal: 28, paddingTop: 72, paddingBottom: 60, alignItems: 'center' },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#1C1C22', borderWidth: 0.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  icon: { fontSize: 26, color: '#FFFFFF' },
  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  tagline: { fontSize: 15, color: '#71717A', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  bulletList: { alignSelf: 'stretch', marginBottom: 32, gap: 14 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { fontSize: 18, color: '#FFFFFF', lineHeight: 22, marginTop: 1 },
  bulletText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22, flex: 1 },
  priceCard: {
    alignSelf: 'stretch', backgroundColor: '#111114', borderRadius: 16,
    padding: 20, borderWidth: 0.5, borderColor: '#FFFFFF1A',
    alignItems: 'center', marginBottom: 16,
  },
  priceLabel: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  price: { fontSize: 32, fontWeight: '300', color: '#FFFFFF', marginBottom: 6 },
  pricePer: { fontSize: 16, color: '#71717A' },
  priceSub: { fontSize: 12, color: '#52525B' },
  upgradeBtn: {
    alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  upgradeBtnText: { fontSize: 16, fontWeight: '700', color: '#111114' },
  restoreBtn: { paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: '#3F3F50' },
  legalText: { fontSize: 10, color: '#3F3F50', textAlign: 'center', lineHeight: 15, paddingTop: 16 },
  planRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginBottom: 16 },
  planCard: { flex: 1, backgroundColor: '#111114', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2C2C35' },
  planCardActive: { borderColor: '#FFFFFF', backgroundColor: '#1C1C22' },
  planName: { fontSize: 13, fontWeight: '600', color: '#71717A', marginBottom: 6 },
  planNameActive: { color: '#FFFFFF' },
  planPrice: { fontSize: 22, fontWeight: '700', color: '#71717A' },
  planPriceActive: { color: '#FFFFFF' },
  planPer: { fontSize: 11, color: '#52525B', marginTop: 2 },
  saveBadge: { backgroundColor: '#1D9E7522', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 },
  saveBadgeText: { fontSize: 9, fontWeight: '700', color: '#1D9E75', letterSpacing: 0.5 },
  trialNote: { fontSize: 12, color: '#52525B', marginBottom: 16 },
});
