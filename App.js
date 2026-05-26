import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, Alert, Platform, Linking, BackHandler } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Purchases, { LOG_LEVEL } from './lib/purchases';
import { registerForPushNotifications } from './lib/notificationService';
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
import ResetPasswordScreen from './screens/ResetPasswordScreen';

const Tab = createBottomTabNavigator();

const RC_KEY_IOS     = process.env.EXPO_PUBLIC_RC_KEY_IOS     ?? '';
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_KEY_ANDROID ?? '';
const RC_ENTITLEMENT = 'Helix Pro'; // matches Entitlement identifier in RevenueCat dashboard

// ─── PREMIUM PAYWALL SCREEN ───────────────────────────────────────────────────

function PremiumPaywall({ feature, onUpgrade, onRestore }) {
  const [plan, setPlan] = useState('monthly'); // 'monthly' | 'yearly'
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgradePress = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try { await onUpgrade(plan); } finally { setUpgrading(false); }
  };

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

// ─── TAB ICON ─────────────────────────────────────────────────────────────────

const TAB_ICONS = {
  Today:    { active: 'home',                 inactive: 'home-outline' },
  Program:  { active: 'barbell',              inactive: 'barbell-outline' },
  Coach:    { active: 'sparkles',             inactive: 'sparkles-outline' },
  Nutrition:{ active: 'nutrition',            inactive: 'nutrition-outline' },
  Profile:  { active: 'person',               inactive: 'person-outline' },
};

function TabIcon({ route, color, focused, isLocked }) {
  const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={color} />
      {isLocked && (
        <View style={{
          position: 'absolute', top: -2, right: -4,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="lock-closed" size={8} color="#fff" />
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
  subTabActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  subTabText: { fontSize: 13, color: '#52525B', fontWeight: '500' },
  subTabTextActive: { color: '#FFFFFF', fontWeight: '700' },
});

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [activeWorkout, setActiveWorkout] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutritionMeal, setNutritionMeal] = useState(null);
  const [nutritionRefresh, setNutritionRefresh] = useState(0);
  const [previewWorkout, setPreviewWorkout] = useState(null);
  const [refreshToday, setRefreshToday] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const recoveryPending = useRef(false);
  const signedOutAt = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'login' || screen === 'signup') { setScreen('welcome'); return true; }
      if (screen === 'reset_password') { setScreen('main'); return true; }
      if (screen === 'onboarding') { setScreen('welcome'); return true; }
      if (previewWorkout) { setPreviewWorkout(null); return true; }
      if (activeWorkout) {
        Alert.alert(
          'Cancel workout?',
          'Your progress will not be saved.',
          [
            { text: 'Keep going', style: 'cancel' },
            { text: 'Cancel workout', style: 'destructive', onPress: () => setActiveWorkout(false) },
          ]
        );
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen, activeWorkout, previewWorkout]);

  useEffect(() => {
    fetch('https://guvvzimnucttjjzmpsvp.supabase.co/auth/v1/').catch(() => {});

    // Safety net: if nothing resolves auth within 8 s, bail to welcome screen.
    const safetyTimer = setTimeout(() => {
      setScreen(prev => prev === 'loading' ? 'welcome' : prev);
    }, 15000);

    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({
      apiKey: Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID,
    });

    // Handle helix:// deep links (email confirmation callback)
    const handleDeepLink = async (url) => {
      if (!url) return;
      const isRecovery = url.includes('reset-password') || url.includes('type=recovery');
      // PKCE flow: ?code=xxx
      const codeMatch = url.match(/[?&]code=([^&#]+)/);
      if (codeMatch) {
        if (isRecovery) recoveryPending.current = true;
        const { error } = await supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
        if (error) console.warn('Deep link exchange error:', error.message);
        return;
      }
      // Implicit flow: #access_token=xxx&refresh_token=xxx
      const hashMatch = url.match(/#(.+)/);
      if (hashMatch) {
        const params = new URLSearchParams(hashMatch[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          if (isRecovery || params.get('type') === 'recovery') recoveryPending.current = true;
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) console.warn('Deep link setSession error:', error.message);
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    if (Platform.OS === 'web') {
      try {
        const stored = window.localStorage.getItem('sb-guvvzimnucttjjzmpsvp-auth-token');
        clearTimeout(safetyTimer);
        if (stored) {
          checkPremiumStatus();
          setScreen('main');
        } else {
          setScreen('welcome');
        }
      } catch {
        clearTimeout(safetyTimer);
        setScreen('welcome');
      }
    }

    const routeAuthedUser = async (session) => {
      Purchases.logIn(session.user.id);

      let profile = null, profileError = null;
      try {
        ({ data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_complete, is_admin, is_premium')
          .eq('id', session.user.id)
          .single());
      } catch {
        // Network/timeout — session is valid so go to main, premium loads lazily
        clearTimeout(safetyTimer);
        setScreen('main');
        Purchases.getCustomerInfo().then(ci => {
          if (ci.entitlements.active[RC_ENTITLEMENT]) setIsPremium(true);
        }).catch(() => {});
        return;
      }

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn('routeAuthedUser profile error:', profileError.code, profileError.message);
      }

      if (!profile) {
        // Genuinely no profile yet — create one and send to onboarding.
        const meta = session.user.user_metadata || {};
        const { data: newProfile } = await supabase.from('profiles').insert({
          id: session.user.id,
          email: session.user.email,
          name: meta.name || null,
          age: meta.age || null,
          sex: meta.sex || null,
        }).select('onboarding_complete, is_admin, is_premium').single();

        if (newProfile) {
          if (newProfile.is_admin) { setIsAdmin(true); setIsPremium(true); }
          else if (newProfile.is_premium) { setIsPremium(true); }
          setScreen('onboarding');
        } else {
          setScreen('main');
        }
        return;
      }


      if (profile.is_admin) { setIsAdmin(true); setIsPremium(true); }
      else {
        // Check admin_emails — beta user added via admin panel but profile not yet updated
        const { data: betaEntry } = await supabase
          .from('admin_emails')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle();
        if (betaEntry || profile.is_premium) { setIsPremium(true); }
        else {
          // Supabase not showing premium — check RC in background (new device install,
          // or subscription purchased before Supabase synced).
          Purchases.getCustomerInfo().then(ci => {
            if (ci.entitlements.active[RC_ENTITLEMENT]) {
              setIsPremium(true);
              supabase.from('profiles').update({ is_premium: true }).eq('id', session.user.id)
                .then(({ error }) => { if (error) console.warn('Premium sync failed:', error.message); });
            }
          }).catch(e => console.warn('RC customer info failed:', e.message));
        }
      }

      if (profile.onboarding_complete) {
        try {
          const raw = await AsyncStorage.getItem('@helix_workout_draft');
          if (raw) {
            const draft = JSON.parse(raw);
            if (draft.workout && !draft.finished) setActiveWorkout(draft.workout);
          }
        } catch (_) {}
        setScreen('main');
        registerForPushNotifications(supabase, session.user.id).catch(() => {});
      } else {
        setScreen('onboarding');
      }
    };

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        signedOutAt.current = Date.now();
        Purchases.logOut().catch(() => {});
        setScreen('welcome');
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(safetyTimer);
        setScreen('reset_password');
        return;
      }
      if (event === 'INITIAL_SESSION') {
        clearTimeout(safetyTimer);
        if (session) {
          routeAuthedUser(session);
        } else {
          setScreen('welcome');
        }
        return;
      }
      if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        if (Date.now() - signedOutAt.current < 1000) return;
        if (recoveryPending.current) {
          recoveryPending.current = false;
          clearTimeout(safetyTimer);
          setScreen('reset_password');
          return;
        }
        clearTimeout(safetyTimer);
        if (event === 'SIGNED_IN') setScreen('main');
        routeAuthedUser(session);
      }
      // TOKEN_REFRESHED: background refresh — intentionally not re-routed.
    });

    return () => { linkSub.remove(); clearTimeout(safetyTimer); };
  }, []);

  const checkPremiumStatus = async () => {
    const user = await getCurrentUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium, is_admin')
      .eq('id', user.id)
      .single();

    if (error) console.warn('checkPremiumStatus error:', error.message, error.code);
    if (!data) return;

    if (data.is_admin) { setIsAdmin(true); setIsPremium(true); return; }
    if (data.is_premium) { setIsPremium(true); return; }

    // Profile loaded and Supabase says not-premium — try RevenueCat.
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      setIsPremium(!!customerInfo.entitlements.active[RC_ENTITLEMENT]);
    } catch {}
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

  // ── Derive which screen to render ──

  const renderContent = () => {
    if (screen === 'loading') {
      return (
        <View style={{ flex: 1, backgroundColor: '#0F0F13', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 62, fontWeight: '800', letterSpacing: 14, includeFontPadding: false }}>
            HELIX
          </Text>
          <Text style={{ color: '#A1A1AA', fontSize: 13, fontWeight: '500', letterSpacing: 3, textTransform: 'uppercase' }}>
            Built on evidence
          </Text>
        </View>
      );
    }

    if (screen === 'welcome') {
      return <WelcomeScreen onGetStarted={() => setScreen('signup')} onLogin={() => setScreen('login')} />;
    }

    if (screen === 'login') {
      return <LoginScreen onLogin={() => setScreen('main')} onGoToSignup={() => setScreen('signup')} onGoBack={() => setScreen('welcome')} onRecovery={(active = true) => { recoveryPending.current = active; }} />;
    }

    if (screen === 'signup') {
      return <SignupScreen onSignup={() => setScreen('onboarding')} onGoToLogin={() => setScreen('login')} onGoBack={() => setScreen('welcome')} />;
    }

    if (screen === 'reset_password') {
      return <ResetPasswordScreen onDone={() => setScreen('main')} />;
    }

    if (screen === 'onboarding') {
      return (
        <OnboardingScreen
          onComplete={async (data) => {
            const user = await getCurrentUser();
            if (!user) { setScreen('welcome'); return; }
            const { error } = await supabase.from('profiles').update({
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
            if (error) {
              Alert.alert('Could not save', 'Your profile could not be saved. Check your connection and try again.');
              return;
            }
            setScreen('main');
          }}
          onGoBack={() => setScreen('welcome')}
        />
      );
    }

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
          onSplitChanged={() => setRefreshToday(prev => prev + 1)}
        />
      );
    }

    // ── Main tab navigator ──
    return (
      <NavigationContainer>
        <Tab.Navigator
          safeAreaInsets={{ bottom: 0 }}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#111114',
              borderTopColor: '#1E1E28',
              borderTopWidth: 0.5,
              paddingTop: 10,
              paddingBottom: (initialWindowMetrics?.insets?.bottom ?? 0) + 8,
              height: 56 + (initialWindowMetrics?.insets?.bottom ?? 0),
            },
            tabBarItemStyle: {
              paddingBottom: 0,
            },
            tabBarActiveTintColor: '#FFFFFF',
            tabBarInactiveTintColor: '#3D3D4A',
            tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: 2 },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                route={route}
                color={color}
                focused={focused}
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
            <ProgramScreen
              onStartWorkout={(workout) => setActiveWorkout(workout || true)}
              onSplitChanged={() => setRefreshToday(prev => prev + 1)}
            />
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
              ? <NutritionScreen
                    onOpenNutrition={() => setShowNutrition(true)}
                    onOpenNutritionMeal={(meal) => { setNutritionMeal(meal); setShowNutrition(true); }}
                    refreshKey={nutritionRefresh}
                  />
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
  };

  return (
    <SafeAreaProvider>
      {renderContent()}
      <Modal
        visible={showNutrition}
        animationType="slide"
        onRequestClose={() => { setShowNutrition(false); setNutritionMeal(null); setNutritionRefresh(k => k + 1); }}
      >
        <NutritionLogScreen
          initialMeal={nutritionMeal}
          onClose={() => { setShowNutrition(false); setNutritionMeal(null); setNutritionRefresh(k => k + 1); }}
        />
      </Modal>
    </SafeAreaProvider>
  );
}