import i18n from './lib/i18n'; // initialize i18n before any screen renders
import { syncLanguageFromProfile } from './lib/i18n';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView, Alert, Platform, Linking, BackHandler } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import Purchases, { LOG_LEVEL } from './lib/purchases';
import { registerForPushNotifications, syncWorkoutReminders } from './lib/notificationService';
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
import PremiumPaywall from './screens/PremiumPaywall';
import ProgressScreen from './screens/ProgressScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import Constants from 'expo-constants';
import { checkForUpdate, openStore } from './lib/updateCheck';
import { colors } from './lib/theme';

const Tab = createBottomTabNavigator();

const RC_KEY_IOS     = process.env.EXPO_PUBLIC_RC_KEY_IOS     ?? '';
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_KEY_ANDROID ?? '';
const RC_ENTITLEMENT = 'Helix Pro'; // matches Entitlement identifier in RevenueCat dashboard

// ─── TAB ICON ─────────────────────────────────────────────────────────────────

const TAB_ICONS = {
  Today:    { active: 'home',                 inactive: 'home-outline' },
  Program:  { active: 'barbell',              inactive: 'barbell-outline' },
  Coach:    { active: 'brain',                inactive: 'brain', lib: 'fa5' },
  Nutrition:{ active: 'nutrition',            inactive: 'nutrition-outline' },
  Profile:  { active: 'person',               inactive: 'person-outline' },
};

function TabIcon({ route, color, focused, isLocked }) {
  const icons = TAB_ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };
  const isFa5 = icons.lib === 'fa5';
  const IconLib = isFa5 ? FontAwesome5 : Ionicons;
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <IconLib name={focused ? icons.active : icons.inactive} size={isFa5 ? 20 : 22} color={color} {...(isFa5 ? { solid: true } : {})} />
      {isLocked && (
        <View style={{
          position: 'absolute', top: -2, right: -4,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="lock-closed" size={8} color={colors.textOnLight} />
        </View>
      )}
    </View>
  );
}

// ─── PROFILE + PROGRESS COMBINED TAB ─────────────────────────────────────────

function ProfileTabScreen({ onSignOut, isAdmin, isPremium, onUpgrade, onRestore }) {
  const { t } = useTranslation();
  const [view, setView] = useState('profile'); // 'profile' | 'progress'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Sub-tab switcher */}
      <View style={pt.subTabBar}>
        <Pressable
          style={[pt.subTab, view === 'profile' && pt.subTabActive]}
          onPress={() => setView('profile')}
        >
          <Text style={[pt.subTabText, view === 'profile' && pt.subTabTextActive]}>{t('nav.profile')}</Text>
        </Pressable>
        <Pressable
          style={[pt.subTab, view === 'progress' && pt.subTabActive]}
          onPress={() => setView('progress')}
        >
          <Text style={[pt.subTabText, view === 'progress' && pt.subTabTextActive]}>{t('nav.progress')}</Text>
        </Pressable>
      </View>

      {view === 'profile'
        ? <ProfileScreen onSignOut={onSignOut} isAdmin={isAdmin} isPremium={isPremium} onUpgrade={onUpgrade} onRestore={onRestore} />
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
    backgroundColor: colors.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderSoft,
  },
  subTab: {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    alignItems: 'center', backgroundColor: colors.surfaceElevated,
    borderWidth: 0.5, borderColor: colors.border,
  },
  subTabActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderActive },
  subTabText: { fontSize: 13, color: colors.textFaint, fontWeight: '500' },
  subTabTextActive: { color: colors.textPrimary, fontWeight: '700' },
});

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [activeWorkout, setActiveWorkout] = useState(false);
  // Backgrounded workout: the session is still live (its full state is persisted
  // to AsyncStorage by WorkoutExecutionScreen and restored on remount), but we
  // render the tab navigator instead so the user can use the rest of the app. A
  // persistent resume bar brings the workout back.
  const [workoutMinimized, setWorkoutMinimized] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutritionMeal, setNutritionMeal] = useState(null);
  const [nutritionRefresh, setNutritionRefresh] = useState(0);
  const [previewWorkout, setPreviewWorkout] = useState(null);
  const [refreshToday, setRefreshToday] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [coachPrefill, setCoachPrefill] = useState(null); // question to auto-send when the Coach tab opens
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

    // Safety net: if nothing resolves auth within 15 s, bail to welcome screen.
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
      // Start each session clean — a previous user's admin/premium flags must
      // never leak into this one; the profile fetch below re-derives them.
      setIsAdmin(false);
      setIsPremium(false);
      Purchases.logIn(session.user.id);

      let profile = null, profileError = null;
      try {
        ({ data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarding_complete, is_admin, is_premium, language, weekly_workouts')
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
          // Persist the language they chose on the welcome screen (pre-signup).
          language: i18n.language?.split('-')[0] || 'en',
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


      // Apply the user's saved language so it follows them across devices.
      syncLanguageFromProfile(profile.language);

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
            // Finished-but-unsaved drafts resume too — they land on the finish
            // screen with the Save button, so the session isn't silently lost.
            if (draft.workout) {
              Alert.alert(
                'Resume workout?',
                `You have an unfinished ${draft.workout.name} session.`,
                [
                  { text: 'Discard', style: 'destructive', onPress: () => AsyncStorage.removeItem('@helix_workout_draft') },
                  { text: 'Resume', onPress: () => setActiveWorkout(draft.workout) },
                ]
              );
            }
          }
        } catch (_) {}
        setScreen('main');
        registerForPushNotifications(supabase, session.user.id).catch(() => {});
        // Reminder copy is baked in when scheduled, so a language change would
        // otherwise leave old-language reminders queued. Rebuilding on launch
        // also restores the schedule after a reinstall. Runs after
        // syncLanguageFromProfile above, so i18n.t is already in their language.
        syncWorkoutReminders({
          weeklyWorkouts: profile.weekly_workouts,
          content: { title: i18n.t('settings.reminderPushTitle'), body: i18n.t('settings.reminderPushBody') },
        }).catch(() => {});
        const version = Constants.expoConfig?.version ?? '0.0.0';
        checkForUpdate(version).then(available => { if (available) setUpdateAvailable(true); }).catch(() => {});
      } else {
        setScreen('onboarding');
      }
    };

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        signedOutAt.current = Date.now();
        setIsAdmin(false);
        setIsPremium(false);
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
        // routeAuthedUser sets the screen on every path (main or onboarding) —
        // setting 'main' eagerly here flashed the main UI for un-onboarded users.
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
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 62, fontWeight: '800', letterSpacing: 14, includeFontPadding: false }}>
            HELIX
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '500', letterSpacing: 3, textTransform: 'uppercase' }}>
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
              // sex + age are set at signup — never re-saved here so a failed load
              // can't overwrite them with blanks.
              height_cm: parseFloat(data.height),
              weight_kg: parseFloat(data.weight),
              target_weight_kg: data.targetWeight ? parseFloat(data.targetWeight) : null,
              goals: data.goals,
              weekly_workouts: data.weeklyWorkouts,
              session_length: data.sessionLength,
              equipment: data.equipment,
              supplements: data.supplements,
              caloric_target: data.caloricTarget,
              protein_target: data.proteinTarget,
              carb_target: data.carbTarget,
              fat_target: data.fatTarget,
              training_caloric_target: data.trainingCaloricTarget,
              training_carb_target: data.trainingCarbTarget,
              rest_caloric_target: data.restCaloricTarget,
              rest_carb_target: data.restCarbTarget,
              tdee: data.tdee,
              nutrition_focus: data.nutrition_focus,
              trainingExperience: data.trainingExperience,
              health_conditions: data.health_conditions ?? [],
              health_conditions_structured: data.health_conditions_structured ?? [],
              sports: data.sports ?? [],
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

    if (activeWorkout && !workoutMinimized) {
      return (
        <WorkoutExecutionScreen
          workout={typeof activeWorkout === 'object' ? activeWorkout : { name: 'Workout', exercises: [] }}
          isPremium={isPremium}
          onUpgrade={handleUpgrade}
          onRestore={handleRestore}
          onMinimize={() => setWorkoutMinimized(true)}
          onFinish={() => {
            setActiveWorkout(false);
            setWorkoutMinimized(false);
            setRefreshToday(prev => prev + 1);
          }}
          onCancel={() => { setActiveWorkout(false); setWorkoutMinimized(false); }}
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
            setWorkoutMinimized(false);
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
            animation: 'shift',
            tabBarStyle: {
              backgroundColor: colors.surfaceRaised,
              borderTopColor: colors.borderSoft,
              borderTopWidth: 0.5,
              paddingTop: 10,
              paddingBottom: (initialWindowMetrics?.insets?.bottom ?? 0) + 8,
              height: 56 + (initialWindowMetrics?.insets?.bottom ?? 0),
            },
            tabBarItemStyle: {
              paddingBottom: 0,
            },
            tabBarActiveTintColor: colors.textPrimary,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: 2 },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                route={route}
                color={color}
                focused={focused}
                // Only Coach is actually paywalled — Nutrition is free with AI logging gated inside.
                isLocked={!isPremium && route.name === 'Coach'}
              />
            ),
          })}
        >
        <Tab.Screen name="Today">
          {() => (
            <TodayScreen
              key={refreshToday}
              onStartWorkout={(workout) => { setWorkoutMinimized(false); setActiveWorkout(workout || true); }}
              onPreviewWorkout={(workout) => setPreviewWorkout(workout)}
              onAskCoach={(question) => setCoachPrefill(question)}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Program">
          {() => (
            <ProgramScreen
              onStartWorkout={(workout) => { setWorkoutMinimized(false); setActiveWorkout(workout || true); }}
              onSplitChanged={() => setRefreshToday(prev => prev + 1)}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Coach">
          {() =>
            isPremium
              ? <CoachScreen prefill={coachPrefill} onPrefillConsumed={() => setCoachPrefill(null)} />
              : <PremiumPaywall feature="Coach" onUpgrade={handleUpgrade} onRestore={handleRestore} />
          }
        </Tab.Screen>

        <Tab.Screen name="Nutrition">
          {() =>
            <NutritionScreen
                onOpenNutrition={() => setShowNutrition(true)}
                onOpenNutritionMeal={(meal) => { setNutritionMeal(meal); setShowNutrition(true); }}
                refreshKey={nutritionRefresh}
                isPremium={isPremium}
              />
          }
        </Tab.Screen>

        <Tab.Screen name="Profile">
          {() => (
            <ProfileTabScreen
              onSignOut={() => supabase.auth.signOut()}
              isAdmin={isAdmin}
              isPremium={isPremium}
              onUpgrade={handleUpgrade}
              onRestore={handleRestore}
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
      {screen === 'main' && updateAvailable && (
        <View style={updateBannerStyles.container}>
          <Text style={updateBannerStyles.text}>Update available</Text>
          <Pressable onPress={openStore} style={updateBannerStyles.btn}>
            <Text style={updateBannerStyles.btnText}>Update now →</Text>
          </Pressable>
          <Pressable onPress={() => setUpdateAvailable(false)} style={updateBannerStyles.close}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      {screen === 'main' && activeWorkout && workoutMinimized && (
        <Pressable style={resumeBarStyles.container} onPress={() => setWorkoutMinimized(false)}>
          <View style={resumeBarStyles.dot} />
          <View style={{ flex: 1 }}>
            <Text style={resumeBarStyles.title} numberOfLines={1}>
              {typeof activeWorkout === 'object' ? (activeWorkout.name || 'Workout') : 'Workout'} in progress
            </Text>
            <Text style={resumeBarStyles.sub}>Tap to resume</Text>
          </View>
          <Ionicons name="chevron-up" size={18} color={colors.textPrimary} />
        </Pressable>
      )}
      <Modal
        visible={showNutrition}
        animationType="slide"
        onRequestClose={() => { setShowNutrition(false); setNutritionMeal(null); setNutritionRefresh(k => k + 1); }}
      >
        <NutritionLogScreen
          initialMeal={nutritionMeal}
          isPremium={isPremium}
          onClose={() => { setShowNutrition(false); setNutritionMeal(null); setNutritionRefresh(k => k + 1); }}
        />
      </Modal>
    </SafeAreaProvider>
  );
}

const updateBannerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: (initialWindowMetrics?.insets?.top ?? 44) + 8,
    left: 16,
    right: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
  },
  text: { color: colors.textMuted, fontSize: 13, flex: 1 },
  btn: { marginRight: 10 },
  btnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  close: { padding: 2 },
});

// Sits directly above the tab bar (height 56 + bottom inset). Tapping anywhere
// on it restores the full workout screen — the session never stopped.
const resumeBarStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 56 + (initialWindowMetrics?.insets?.bottom ?? 0),
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 0.5,
    borderTopColor: colors.accentHair,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 998,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  sub: { color: colors.textSubtle, fontSize: 11, marginTop: 1 },
});