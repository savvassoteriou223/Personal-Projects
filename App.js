import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, Alert, Platform, Linking } from 'react-native';
import Purchases, { LOG_LEVEL } from './lib/purchases';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import NutritionScreen from './screens/NutritionScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import NutritionLogScreen from './screens/NutritionLogScreen';
import { supabase, getCurrentUser } from './supabase';
import ProgramScreen from './screens/ProgramScreen';
import TodayScreen from './screens/TodayScreen';
import ProfileScreen from './screens/ProfileScreen';
import CoachScreen from './screens/CoachScreen';
import WorkoutExecutionScreen from './screens/WorkoutExecutionScreen';
import ProgressScreen from './screens/ProgressScreen';

const Tab = createBottomTabNavigator();

const RC_KEY_IOS     = 'test_jHYThiyJlpwboJgEVGkacXEEtTp';
const RC_KEY_ANDROID = 'test_jHYThiyJlpwboJgEVGkacXEEtTp'; // replace with Android key when you add Android app in RevenueCat
const RC_ENTITLEMENT = 'Helix Pro'; // matches Entitlement identifier in RevenueCat dashboard

// ─── PREMIUM PAYWALL SCREEN ───────────────────────────────────────────────────

function PremiumPaywall({ feature, onUpgrade, onRestore }) {
  const [plan, setPlan] = useState('monthly'); // 'monthly' | 'yearly'

  const features = {
    Coach: {
      icon: '✦',
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
          <Text style={pw.icon}>{f.icon}</Text>
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
            <Text style={[pw.planPrice, plan === 'monthly' && pw.planPriceActive]}>€9.99</Text>
            <Text style={pw.planPer}>/ month</Text>
          </Pressable>
          <Pressable
            style={[pw.planCard, plan === 'yearly' && pw.planCardActive]}
            onPress={() => setPlan('yearly')}
          >
            <View style={pw.saveBadge}><Text style={pw.saveBadgeText}>SAVE 50%</Text></View>
            <Text style={[pw.planName, plan === 'yearly' && pw.planNameActive]}>Yearly</Text>
            <Text style={[pw.planPrice, plan === 'yearly' && pw.planPriceActive]}>€59.99</Text>
            <Text style={pw.planPer}>€5 / month</Text>
          </Pressable>
        </View>

        <Text style={pw.trialNote}>7-day free trial · Cancel anytime</Text>

        <Pressable style={pw.upgradeBtn} onPress={() => onUpgrade(plan)}>
          <Text style={pw.upgradeBtnText}>Start free trial</Text>
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
    backgroundColor: '#1E1A35', borderWidth: 0.5, borderColor: '#534AB7',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  icon: { fontSize: 26, color: '#A89FE8' },
  title: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  tagline: { fontSize: 15, color: '#71717A', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  bulletList: { alignSelf: 'stretch', marginBottom: 32, gap: 14 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { fontSize: 18, color: '#534AB7', lineHeight: 22, marginTop: 1 },
  bulletText: { fontSize: 14, color: '#A1A1AA', lineHeight: 22, flex: 1 },
  priceCard: {
    alignSelf: 'stretch', backgroundColor: '#13121E', borderRadius: 16,
    padding: 20, borderWidth: 0.5, borderColor: '#534AB744',
    alignItems: 'center', marginBottom: 16,
  },
  priceLabel: { fontSize: 11, fontWeight: '700', color: '#534AB7', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  price: { fontSize: 32, fontWeight: '300', color: '#FFFFFF', marginBottom: 6 },
  pricePer: { fontSize: 16, color: '#71717A' },
  priceSub: { fontSize: 12, color: '#52525B' },
  upgradeBtn: {
    alignSelf: 'stretch', backgroundColor: '#534AB7', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  upgradeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  restoreBtn: { paddingVertical: 10 },
  restoreBtnText: { fontSize: 13, color: '#3F3F50' },
  legalText: { fontSize: 10, color: '#3F3F50', textAlign: 'center', lineHeight: 15, paddingTop: 16 },
  planRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginBottom: 16 },
  planCard: { flex: 1, backgroundColor: '#13121E', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2C2C35' },
  planCardActive: { borderColor: '#534AB7', backgroundColor: '#1E1A35' },
  planName: { fontSize: 13, fontWeight: '600', color: '#71717A', marginBottom: 6 },
  planNameActive: { color: '#A89FE8' },
  planPrice: { fontSize: 22, fontWeight: '700', color: '#71717A' },
  planPriceActive: { color: '#FFFFFF' },
  planPer: { fontSize: 11, color: '#52525B', marginTop: 2 },
  saveBadge: { backgroundColor: '#1D9E7522', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 },
  saveBadgeText: { fontSize: 9, fontWeight: '700', color: '#1D9E75', letterSpacing: 0.5 },
  trialNote: { fontSize: 12, color: '#52525B', marginBottom: 16 },
});

// ─── TAB ICON ─────────────────────────────────────────────────────────────────

// SVG-based tab icons rendered as Text glyphs for RN compatibility
// In production swap these for an icon library (e.g. @expo/vector-icons)
const TAB_ICONS = {
  Today:    { active: '⊙', inactive: '○' },
  Program:  { active: '▦', inactive: '▧' },
  Coach:    { active: '✦', inactive: '✧' },
  Nutrition:{ active: '◈', inactive: '◇' },
  Profile:  { active: '◉', inactive: '◎' },
};

function TabIcon({ route, color, focused, isPremium, isLocked }) {
  const icons = TAB_ICONS[route.name] || { active: '·', inactive: '·' };
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: 16, lineHeight: 22, includeFontPadding: false }}>
        {focused ? icons.active : icons.inactive}
      </Text>
      {isLocked && (
        <View style={{
          position: 'absolute', top: -2, right: -4,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 6, color: '#fff' }}>🔒</Text>
        </View>
      )}
    </View>
  );
}

// ─── PROFILE + PROGRESS COMBINED TAB ─────────────────────────────────────────

function ProfileTabScreen({ onSignOut, isAdmin }) {
  const [view, setView] = useState('profile'); // 'profile' | 'progress'

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F13' }}>
      {/* Sub-tab switcher */}
      <View style={pt.subTabBar}>
        <Pressable
          style={[pt.subTab, view === 'profile' && pt.subTabActive]}
          onPress={() => setView('profile')}
        >
          <Text style={[pt.subTabText, view === 'profile' && pt.subTabTextActive]}>Profile</Text>
        </Pressable>
        <Pressable
          style={[pt.subTab, view === 'progress' && pt.subTabActive]}
          onPress={() => setView('progress')}
        >
          <Text style={[pt.subTabText, view === 'progress' && pt.subTabTextActive]}>Progress</Text>
        </Pressable>
      </View>

      {view === 'profile'
        ? <ProfileScreen onSignOut={onSignOut} isAdmin={isAdmin} />
        : <ProgressScreen />
      }
    </View>
  );
}

const pt = StyleSheet.create({
  subTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#0F0F13',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E1E28',
  },
  subTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#18181F',
    borderWidth: 0.5, borderColor: '#2C2C35',
  },
  subTabActive: { backgroundColor: '#1E1A35', borderColor: '#534AB7' },
  subTabText: { fontSize: 13, color: '#52525B', fontWeight: '500' },
  subTabTextActive: { color: '#A89FE8', fontWeight: '700' },
});

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [activeWorkout, setActiveWorkout] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [previewWorkout, setPreviewWorkout] = useState(null);
  const [refreshToday, setRefreshToday] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Safety net: if nothing resolves auth within 8 s, bail to welcome screen.
    const safetyTimer = setTimeout(() => {
      setScreen(prev => prev === 'loading' ? 'welcome' : prev);
    }, 8000);

    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({
      apiKey: Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID,
    });

    // Handle helix:// deep links (email confirmation callback)
    const handleDeepLink = async (url) => {
      if (!url || !url.startsWith('helix://')) return;
      // PKCE flow: helix://?code=xxx
      const codeMatch = url.match(/[?&]code=([^&#]+)/);
      if (codeMatch) {
        const { error } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
        if (error) console.warn('Deep link exchange error:', error.message);
        return;
      }
      // Implicit flow fallback: helix://#access_token=xxx&refresh_token=xxx
      const hashMatch = url.match(/#(.+)/);
      if (hashMatch) {
        const params = new URLSearchParams(hashMatch[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) console.warn('Deep link setSession error:', error.message);
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    if (Platform.OS === 'web') {
      // Read localStorage directly — instant, no network, no hang.
      // If a session key exists (even with an expired access token), show the app.
      // autoRefreshToken will refresh in the background; SIGNED_OUT fires if the
      // refresh token is also dead, and we'll route to welcome at that point.
      try {
        const stored = window.localStorage.getItem('sb-guvvzimnucttjjzmpsvp-auth-token');
        if (stored) {
          clearTimeout(safetyTimer);
          checkPremiumStatus();
          setScreen('main');
        } else {
          clearTimeout(safetyTimer);
          setScreen('welcome');
        }
      } catch {
        clearTimeout(safetyTimer);
        setScreen('welcome');
      }
    } else {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          clearTimeout(safetyTimer);
          if (session) {
            Purchases.logIn(session.user.id);
            checkPremiumStatus();
            setScreen('main');
          } else {
            setScreen('welcome');
          }
        })
        .catch(() => { clearTimeout(safetyTimer); setScreen('welcome'); });
    }

    const routeAuthedUser = async (session) => {
      Purchases.logIn(session.user.id);
      checkPremiumStatus();
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('id', session.user.id)
        .single();
      // Only send to onboarding if we KNOW the profile exists and it's not complete.
      // If the query failed (profile null), default to main — never loop into onboarding.
      if (profile && !profile.onboarding_complete) {
        setScreen('onboarding');
      } else {
        setScreen('main');
      }
    };

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        Purchases.logOut().catch(() => {});
        setScreen('welcome');
        return;
      }
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
        clearTimeout(safetyTimer);
        await routeAuthedUser(session);
      }
    });

    return () => { linkSub.remove(); clearTimeout(safetyTimer); };
  }, []);

  const checkPremiumStatus = async () => {
    const user = await getCurrentUser();
    let supabasePremium = false;
    let supabaseAdmin = false;

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium, is_admin')
        .eq('id', user.id)
        .single();
      supabaseAdmin = data?.is_admin === true;
      supabasePremium = data?.is_premium === true;
    }

    if (supabaseAdmin) {
      setIsAdmin(true);
      setIsPremium(true);
      return;
    }

    if (supabasePremium) {
      setIsPremium(true);
      return;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      setIsPremium(!!customerInfo.entitlements.active[RC_ENTITLEMENT]);
    } catch {
      // RevenueCat unreachable — already handled by supabasePremium above
    }
  };

  const handleUpgrade = async (planType = 'monthly') => {
    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages || [];
      const pkg = packages.find(p =>
        planType === 'yearly'
          ? p.packageType === 'ANNUAL'
          : p.packageType === 'MONTHLY'
      ) ?? packages[0];

      if (!pkg) {
        Alert.alert('Not available', 'Subscription not available right now. Try again later.');
        return;
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const premium = !!customerInfo.entitlements.active[RC_ENTITLEMENT];
      setIsPremium(premium);
      if (premium) {
        const user = await getCurrentUser();
        if (user) await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
      }
    }
  };

  const handleRestore = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const premium = !!customerInfo.entitlements.active[RC_ENTITLEMENT];
      setIsPremium(premium);
      if (premium) {
        Alert.alert('Restored', 'Your subscription has been restored.');
        const user = await getCurrentUser();
        if (user) await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
      } else {
        Alert.alert('Nothing to restore', 'No active subscription found for this account.');
      }
    } catch {
      Alert.alert('Restore failed', 'Could not restore purchases. Please try again.');
    }
  };

  // ── Pre-main screens ──

  if (screen === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F13', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#534AB7', fontSize: 22, fontWeight: '700', letterSpacing: 2 }}>HELIX</Text>
      </View>
    );
  }

  if (screen === 'welcome') {
    return <WelcomeScreen onGetStarted={() => setScreen('signup')} onLogin={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return <LoginScreen onLogin={() => setScreen('main')} onGoToSignup={() => setScreen('signup')} onGoBack={() => setScreen('welcome')} />;
  }

  if (screen === 'signup') {
    return <SignupScreen onSignup={() => setScreen('onboarding')} onGoToLogin={() => setScreen('login')} onGoBack={() => setScreen('welcome')} />;
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={async (data) => {
          const user = await getCurrentUser();
          if (user) {
            await supabase.from('profiles').update({
              height_cm: parseFloat(data.height),
              weight_kg: parseFloat(data.weight),
              target_weight_kg: parseFloat(data.targetWeight),
              goals: data.goals,
              weekly_workouts: data.weeklyWorkouts,
              session_length: data.sessionLength,
              equipment: data.equipment,
              supplements: data.supplements,
              caloric_target: data.caloricTarget,
              protein_target: data.proteinTarget,
              carb_target: data.carbTarget,
              fat_target: data.fatTarget,
              trainingExperience: data.trainingExperience,
              health_conditions: data.health_conditions ?? [],
              onboarding_complete: true,
            }).eq('id', user.id);
          }
          setScreen('main');
        }}
        onGoBack={() => setScreen('welcome')}
      />
    );
  }

  // ── Overlay screens (rendered over tab nav) ──

  if (activeWorkout) {
    return (
      <WorkoutExecutionScreen
        workout={typeof activeWorkout === 'object' ? activeWorkout : { name: 'Workout', exercises: [] }}
        onFinish={() => {
          setActiveWorkout(false);
          setRefreshToday(prev => prev + 1);
        }}
        onCancel={() => setActiveWorkout(false)}
      />
    );
  }

  if (previewWorkout) {
    return (
      <ProgramScreen
        previewDay={previewWorkout}
        onClose={() => setPreviewWorkout(null)}
        onStartWorkout={(workout) => {
          setPreviewWorkout(null);
          setActiveWorkout(workout || true);
        }}
      />
    );
  }

  if (showNutrition) {
    return <NutritionLogScreen onClose={() => setShowNutrition(false)} />;
  }

  // ── Main tab navigator ──

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#13121E',
            borderTopColor: '#1E1E28',
            borderTopWidth: 0.5,
            height: 70,
            paddingBottom: 12,
            paddingTop: 10,
          },
          tabBarActiveTintColor: '#A89FE8',
          tabBarInactiveTintColor: '#3D3D4A',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: 2 },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              route={route}
              color={color}
              focused={focused}
              isPremium={isPremium}
              isLocked={!isPremium && (route.name === 'Coach' || route.name === 'Nutrition')}
            />
          ),
        })}
      >
        <Tab.Screen name="Today">
          {() => (
            <TodayScreen
              key={refreshToday}
              onStartWorkout={(workout) => setActiveWorkout(workout || true)}
              onPreviewWorkout={(workout) => setPreviewWorkout(workout)}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Program">
          {() => (
            <ProgramScreen onStartWorkout={(workout) => setActiveWorkout(workout || true)} />
          )}
        </Tab.Screen>

        <Tab.Screen name="Coach">
          {() =>
            isPremium
              ? <CoachScreen />
              : <PremiumPaywall feature="Coach" onUpgrade={handleUpgrade} onRestore={handleRestore} />
          }
        </Tab.Screen>

        <Tab.Screen name="Nutrition">
          {() =>
            isPremium
              ? <NutritionScreen onOpenNutrition={() => setShowNutrition(true)} />
              : <PremiumPaywall feature="Nutrition" onUpgrade={handleUpgrade} onRestore={handleRestore} />
          }
        </Tab.Screen>

        <Tab.Screen name="Profile">
          {() => (
            <ProfileTabScreen
              onSignOut={() => supabase.auth.signOut()}
              isAdmin={isAdmin}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}