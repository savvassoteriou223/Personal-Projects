import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GOAL_PARAMETERS } from './scienceEngine';
import { resolveGoalCombo, GOAL_COMBO_CALORIES, calculateTDEE, calculateNutritionTargets } from './programGenerator';
import { supabase, getCurrentUser } from '../supabase';
import { CONDITIONS_DB, SEVERITY_OPTIONS, POST_OP_TIMELINE_OPTIONS, deriveConditionKeys, conditionSummaryLabel } from '../lib/conditionsDb';

export default function OnboardingScreen({ onComplete, onGoBack }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(3);
  const [sessionLength, setSessionLength] = useState(60);
  const [equipment, setEquipment] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [customSupplement, setCustomSupplement] = useState('');
  const [customSupplements, setCustomSupplements] = useState([]);
  const [goals, setGoals] = useState([]);
  const [trainingExperience, setTrainingExperience] = useState('');
  const [sports, setSports] = useState([]);
  // Layer 1–2: structured health condition entries
  // Each entry: { region, conditionKey, conditionLabel, severity, postOp, postOpTimeline, isVariable }
  const [healthEntries, setHealthEntries] = useState([]);
  const [noIssues, setNoIssues] = useState(false);
  // Sub-state machine for the step-6 flow
  const [h6phase, setH6phase] = useState('list'); // 'list' | 'severity' | 'post_op' | 'timeline'
  const [h6search, setH6search] = useState('');
  const [h6pending, setH6pending] = useState(null); // { region, conditionKey, conditionLabel, canBePost, alwaysPost, isVariable }

  const scrollRef = useRef(null);
  const totalSteps = 7;
  const back = () => setStep((s) => s - 1);

  // Sex + age are already collected at signup — load them here for the calorie
  // calc instead of asking again.
  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('sex, age').eq('id', user.id).single();
      if (data?.sex) setSex(data.sex);
      if (data?.age != null) setAge(String(data.age));
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const handleNext = () => {
    if (step === 1) {
      const hVal = parseFloat(height);
      const wVal = parseFloat(weight);
      if (!height || isNaN(hVal) || hVal < 100 || hVal > 250) {
        Alert.alert(t('onboarding.alerts.invalidHeightTitle'), t('onboarding.alerts.invalidHeightMsg'));
        return;
      }
      if (!weight || isNaN(wVal) || wVal < 20 || wVal > 300) {
        Alert.alert(t('onboarding.alerts.invalidWeightTitle'), t('onboarding.alerts.invalidWeightMsg'));
        return;
      }
    }
    if (step === 2) {
      if (goals.length === 0) {
        Alert.alert(t('onboarding.alerts.selectGoalTitle'), t('onboarding.alerts.selectGoalMsg'));
        return;
      }
      // Target weight is optional — blank means no specific goal weight.
      if (targetWeight) {
        const twVal = parseFloat(targetWeight);
        if (isNaN(twVal) || twVal < 30 || twVal > 300) {
          Alert.alert(t('onboarding.alerts.invalidTargetTitle'), t('onboarding.alerts.invalidTargetMsg'));
          return;
        }
      }
    }
    if (step === 3) {
      if (!trainingExperience) {
        Alert.alert(t('onboarding.alerts.selectExpTitle'), t('onboarding.alerts.selectExpMsg'));
        return;
      }
    }
    if (step === 4) {
      if (equipment.length === 0) {
        Alert.alert(t('onboarding.alerts.selectEquipTitle'), t('onboarding.alerts.selectEquipMsg'));
        return;
      }
    }
    if (step === 5) {
      if (supplements.length === 0 && customSupplements.length === 0) {
        Alert.alert(t('onboarding.alerts.selectSuppTitle'), t('onboarding.alerts.selectSuppMsg'));
        return;
      }
    }
    if (step === 6) {
      if (healthEntries.length === 0 && !noIssues) {
        Alert.alert(t('onboarding.alerts.healthTitle'), t('onboarding.alerts.healthMsg'));
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const h = parseFloat(height);
  const w = parseFloat(weight);
  const tw = parseFloat(targetWeight);

  const bmi = h && w ? (w / ((h / 100) ** 2)).toFixed(1) : null;
  const bmiCategoryKey = bmi
    ? bmi < 18.5 ? 'underweight' : bmi < 25 ? 'healthy' : bmi < 30 ? 'overweight' : 'obese'
    : null;
  const bmiCategory = bmiCategoryKey ? t(`onboarding.bmiCategory.${bmiCategoryKey}`) : null;
  const bmiColor = bmi
    ? bmi < 18.5 ? '#BA7517' : bmi < 25 ? '#1D9E75' : bmi < 30 ? '#BA7517' : '#E85D5C'
    : null;
  const healthyLow = h ? (18.5 * ((h / 100) ** 2)).toFixed(1) : null;
  const healthyHigh = h ? (24.9 * ((h / 100) ** 2)).toFixed(1) : null;
  const weeksToGoal = w && tw ? Math.abs(Math.round((w - tw) / 0.5)) : null;

  const combo = resolveGoalCombo(goals);
  const tdee = calculateTDEE(w, h, parseInt(age), sex, weeklyWorkouts);
  const focusMap = { cut: 'cut', cut_strength: 'cut', cut_endurance: 'cut', powerbuilding_cut: 'cut', athletic_cut: 'cut', muscle: 'bulk', strength: 'bulk', powerbuilding: 'bulk', hybrid_muscle: 'bulk', hybrid_strength: 'bulk', athletic_bulk: 'bulk', recomp: 'recomp', athletic_recomp: 'recomp' };
  const nutritionFocusDerived = focusMap[combo] || 'maintain';
  const nutritionTargets = calculateNutritionTargets(tdee, w, nutritionFocusDerived);
  const caloricTarget = nutritionTargets?.caloric_target ?? null;
  const proteinTarget = nutritionTargets?.protein_target ?? null;
  const fatTarget = nutritionTargets?.fat_target ?? null;
  const carbTarget = nutritionTargets?.carb_target ?? null;

  const toggleItem = (list, setList, item) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const addCustomSupplement = () => {
    if (customSupplement.trim()) {
      setCustomSupplements([...customSupplements, customSupplement.trim()]);
      setCustomSupplement('');
    }
  };

  // key + level drive logic/storage; the label/sublabel shown to the user come from i18n.
  const EXPERIENCE_OPTIONS = [
    { key: 'under_6m', level: 'beginner' },
    { key: '6m_to_2y', level: 'beginner' },
    { key: '2y_to_4y', level: 'intermediate' },
    { key: 'over_4y', level: 'advanced' },
  ];
  const expLabel = (key) => t(`onboarding.experience.${key}.label`);

  // `key` is the stored/canonical value; `label` is the translated display text.
  const GOALS = ['lose', 'gain', 'strength', 'aesthetics', 'endurance', 'maintain']
    .map(key => ({ key, label: t(`onboarding.goals.${key}`) }));

  // `value` is stored to the profile (English — normalizeEquipment matches these
  // strings); only `label` is translated for display. Do NOT translate value.
  const EQUIPMENT = [
    { value: 'Barbell',         label: t('onboarding.equipment.barbell') },
    { value: 'Dumbbells',       label: t('onboarding.equipment.dumbbells') },
    { value: 'Cables',          label: t('onboarding.equipment.cables') },
    { value: 'Machines',        label: t('onboarding.equipment.machines') },
    { value: 'Bodyweight only', label: t('onboarding.equipment.bodyweight') },
    { value: 'Pull-up bar',     label: t('onboarding.equipment.pullupBar') },
    { value: 'Kettlebells',     label: t('onboarding.equipment.kettlebells') },
    { value: 'Resistance bands',label: t('onboarding.equipment.bands') },
  ];
  // `key` and the English `label` are stored on the sport entry; display uses i18n.
  const SPORTS = [
    { key: 'swimming',     label: 'Swimming' },
    { key: 'running',      label: 'Running' },
    { key: 'cycling',      label: 'Cycling' },
    { key: 'football',     label: 'Football / Soccer' },
    { key: 'basketball',   label: 'Basketball' },
    { key: 'tennis',       label: 'Tennis / Racket sports' },
    { key: 'martial_arts', label: 'Martial arts' },
  ];
  const sportLabel = (key) => t(`onboarding.sports.${key}`);
  // `value` is stored to the profile (English — the 'None' sentinel and the AI
  // context depend on it); only `label` is translated for display.
  const SUPPLEMENTS = [
    { value: 'Whey protein', label: t('onboarding.supplements.whey') },
    { value: 'Creatine',     label: t('onboarding.supplements.creatine') },
    { value: 'Pre-workout',  label: t('onboarding.supplements.preworkout') },
    { value: 'Multivitamin', label: t('onboarding.supplements.multivitamin') },
    { value: 'Omega-3',      label: t('onboarding.supplements.omega3') },
    { value: 'Vitamin D',    label: t('onboarding.supplements.vitaminD') },
    { value: 'Magnesium',    label: t('onboarding.supplements.magnesium') },
    { value: 'BCAAs',        label: t('onboarding.supplements.bcaas') },
    { value: 'Collagen',     label: t('onboarding.supplements.collagen') },
    { value: 'None',         label: t('onboarding.supplements.none') },
  ];

  const getScheduleFeedback = () => {
    const wantsMuscle = goals.includes('gain') || goals.includes('strength') || goals.includes('aesthetics');
    const wantsEndurance = goals.includes('endurance');
    const wantsFat = goals.includes('lose');

    // messageKey resolves to translated copy at render; citation + program names
    // stay canonical English (bibliographic references and plan labels).
    if (wantsMuscle) {
      if (weeklyWorkouts >= 4) {
        return {
          status: 'optimal',
          messageKey: 'msgMuscle4',
          citation: 'Schoenfeld, Ogborn & Krieger (2016). Effects of resistance training frequency on measures of muscle hypertrophy. Sports Medicine, 46(11):1689–1697.',
          program: weeklyWorkouts === 4 ? 'Upper / Lower 4×/week' : weeklyWorkouts === 5 ? 'Hybrid 5×/week' : 'Push / Pull / Legs 6×/week',
        };
      } else if (weeklyWorkouts === 3) {
        return {
          status: 'good',
          messageKey: 'msgMuscle3',
          citation: 'Schoenfeld et al. (2016): twice per week superior to once per week for hypertrophy. 3× full body meets this threshold.',
          program: 'Full Body 3×/week',
        };
      } else {
        return {
          status: 'suboptimal',
          messageKey: 'msgMuscle2',
          citation: 'Schoenfeld et al. (2016): training each muscle at least twice per week produces superior hypertrophic outcomes to once per week.',
          program: 'Full Body 2×/week',
        };
      }
    } else if (wantsEndurance && !wantsMuscle) {
      return {
        status: 'optimal',
        messageKey: 'msgEndurance',
        citation: 'ACSM Position Stand (2009): muscular endurance — higher repetitions, shorter rest intervals.',
        program: weeklyWorkouts >= 4 ? 'Upper / Lower Express' : 'Full Body Express',
      };
    } else if (wantsFat && !wantsMuscle) {
      return {
        status: 'optimal',
        messageKey: 'msgFat',
        citation: 'Willis et al. (2012): resistance training preserves lean mass during caloric restriction. J Appl Physiol.',
        program: weeklyWorkouts >= 4 ? 'Upper / Lower Express' : 'Full Body Express',
      };
    }
    return {
      status: 'good',
      messageKey: 'msgDefault',
      citation: '',
      program: weeklyWorkouts >= 4 ? 'Upper / Lower' : 'Full Body',
    };
  };

  const feedback = goals.length > 0 ? getScheduleFeedback() : null;
  const statusColors = { optimal: '#1D9E75', good: '#BA7517', suboptimal: '#E85D5C' };
  const statusLabels = { optimal: t('onboarding.feedback.optimal'), good: t('onboarding.feedback.good'), suboptimal: t('onboarding.feedback.suboptimal') };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.progressBg, { marginTop: insets.top + 12 }]}>
        <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
      </View>
      <Text style={styles.stepLabel}>{t('onboarding.stepLabel', { step, total: totalSteps })}</Text>
      {step === 1 && (
        <Pressable onPress={onGoBack} style={{ paddingHorizontal: 24 }}>
          <Text style={{ color: '#9494A0', fontSize: 15 }}>← {t('common.back')}</Text>
        </Pressable>
      )}

      {step === 1 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>{t('onboarding.step1.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step1.sub')}</Text>

          <Text style={styles.label}>{t('onboarding.step1.height')}</Text>
          <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder={t('onboarding.step1.heightPlaceholder')} placeholderTextColor="#8A8A94" returnKeyType="next" onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)} />
          <Text style={styles.label}>{t('onboarding.step1.weight')}</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder={t('onboarding.step1.weightPlaceholder')} placeholderTextColor="#8A8A94" returnKeyType="done" onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)} />
          {bmi && (
            <View style={styles.bmiCard}>
              <View style={styles.bmiRow}>
                <Text style={styles.bmiLabel}>{t('onboarding.step1.bmi')}</Text>
                <Text style={[styles.bmiVal, { color: bmiColor }]}>{bmi}</Text>
                <Text style={[styles.bmiCategory, { color: bmiColor }]}>{bmiCategory}</Text>
              </View>
              <Text style={styles.bmiRange}>{t('onboarding.step1.bmiRange', { low: healthyLow, high: healthyHigh })}</Text>
            </View>
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>{t('onboarding.step2.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step2.sub', { low: healthyLow, high: healthyHigh, weight })}</Text>
          <View style={styles.goalsWrap}>
            {GOALS.map((g) => (
              <Pressable key={g.key} style={[styles.goalCard, goals.includes(g.key) && styles.goalCardActive]} onPress={() => toggleItem(goals, setGoals, g.key)}>
                <Text style={[styles.goalLabel, goals.includes(g.key) && styles.goalLabelActive]}>{g.label}</Text>
                {goals.includes(g.key) && <Text style={styles.check}>✓</Text>}
              </Pressable>
            ))}
          </View>
          {goals.length > 0 && (() => {
            const gp = GOAL_PARAMETERS[goals[0]];
            if (!gp) return null;
            return (
              <View style={styles.goalCitationCard}>
                <Text style={styles.goalCitationTitle}>{gp.label}</Text>
                <Text style={styles.goalCitationText}>{gp.key_finding}</Text>
                <Text style={styles.goalCitationSource}>{gp.citation}</Text>
              </View>
            );
          })()}
          <Text style={styles.label}>{t('onboarding.step2.targetWeight')}</Text>
          <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" placeholder={t('onboarding.step2.targetPlaceholder')} placeholderTextColor="#8A8A94" returnKeyType="done" onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)} />
          {weeksToGoal > 0 && <Text style={styles.estimate}>{t('onboarding.step2.estimate', { target: targetWeight, weeks: weeksToGoal })}</Text>}
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>{t('onboarding.step3.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step3.sub')}</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.expCard, trainingExperience === opt.key && styles.expCardActive]}
                onPress={() => setTrainingExperience(opt.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expLabel, trainingExperience === opt.key && styles.expLabelActive]}>{t(`onboarding.experience.${opt.key}.label`)}</Text>
                  <Text style={styles.expSublabel}>{t(`onboarding.experience.${opt.key}.sublabel`)}</Text>
                </View>
                {trainingExperience === opt.key && (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>{t('onboarding.step4.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step4.sub')}</Text>

          <Text style={styles.label}>{t('onboarding.step4.days')}</Text>
          <View style={styles.optionRow}>
            {[2, 3, 4, 5, 6].map((d) => (
              <Pressable key={d} style={[styles.optionBtn, weeklyWorkouts === d && styles.optionBtnActive]} onPress={() => setWeeklyWorkouts(d)}>
                <Text style={[styles.optionBtnText, weeklyWorkouts === d && styles.optionBtnTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('onboarding.step4.sessionLength')}</Text>
          <View style={styles.optionRow}>
            {[30, 45, 60, 90, 120].map((m) => (
              <Pressable key={m} style={[styles.optionBtn, sessionLength === m && styles.optionBtnActive]} onPress={() => setSessionLength(m)}>
                <Text style={[styles.optionBtnText, sessionLength === m && styles.optionBtnTextActive]}>{m}m</Text>
              </Pressable>
            ))}
          </View>

          {feedback && (
            <View style={[styles.feedbackCard, { borderColor: statusColors[feedback.status] }]}>
              <View style={styles.feedbackHeader}>
                <View style={[styles.feedbackBadge, { backgroundColor: statusColors[feedback.status] + '22' }]}>
                  <Text style={[styles.feedbackBadgeText, { color: statusColors[feedback.status] }]}>
                    {statusLabels[feedback.status]}
                  </Text>
                </View>
                <Text style={styles.feedbackProgram}>{feedback.program}</Text>
              </View>
              <Text style={styles.feedbackMessage}>{t(`onboarding.feedback.${feedback.messageKey}`)}</Text>
              {feedback.citation ? <Text style={styles.feedbackCitation}>{feedback.citation}</Text> : null}
            </View>
          )}

          <Text style={styles.label}>{t('onboarding.step4.equipment')}</Text>
          <View style={styles.tagsWrap}>
            {EQUIPMENT.map((e) => (
              <Pressable key={e.value} style={[styles.tag, equipment.includes(e.value) && styles.tagActive]} onPress={() => toggleItem(equipment, setEquipment, e.value)}>
                <Text style={[styles.tagText, equipment.includes(e.value) && styles.tagTextActive]}>{e.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('onboarding.step4.sports')} <Text style={{ color: '#8A8A94', fontWeight: '400' }}>{t('onboarding.optional')}</Text></Text>
          <Text style={{ fontSize: 12, color: '#9494A0', marginBottom: 12, lineHeight: 18 }}>
            {t('onboarding.step4.sportsHint')}
          </Text>
          <View style={styles.tagsWrap}>
            {SPORTS.map((s) => {
              const selected = sports.find(x => x.key === s.key);
              return (
                <Pressable
                  key={s.key}
                  style={[styles.tag, selected && styles.tagActive]}
                  onPress={() => {
                    if (selected) {
                      setSports(prev => prev.filter(x => x.key !== s.key));
                    } else {
                      setSports(prev => [...prev, { key: s.key, label: s.label, days: [] }]);
                    }
                  }}
                >
                  <Text style={[styles.tagText, selected && styles.tagTextActive]}>{sportLabel(s.key)}</Text>
                </Pressable>
              );
            })}
          </View>
          {sports.length > 0 && (
            <View style={{ marginTop: 16, gap: 14 }}>
              {sports.map((s) => (
                <View key={s.key}>
                  <Text style={{ fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8 }}>
                    {t('onboarding.step4.sportDays', { sport: sportLabel(s.key) })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((wd, i) => {
                      const short = t(`weekdaysShort.${wd}`);
                      const full = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i];
                      const active = s.days.includes(full);
                      return (
                        <Pressable
                          key={full}
                          style={[styles.dayBtn, active && styles.dayBtnActive]}
                          onPress={() => setSports(prev => prev.map(x =>
                            x.key !== s.key ? x : {
                              ...x,
                              days: active ? x.days.filter(d => d !== full) : [...x.days, full],
                            }
                          ))}
                        >
                          <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>{short}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {step === 5 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>{t('onboarding.step5.title')}</Text>
          <Text style={styles.stepSub}>{t('onboarding.step5.sub')}</Text>
          <View style={styles.tagsWrap}>
            {SUPPLEMENTS.map((s) => (
              <Pressable key={s.value} style={[styles.tag, supplements.includes(s.value) && styles.tagActive]} onPress={() => {
                if (s.value === 'None') { setSupplements(['None']); }
                else { setSupplements(supplements.includes(s.value) ? supplements.filter((x) => x !== s.value) : [...supplements.filter((x) => x !== 'None'), s.value]); }
              }}>
                <Text style={[styles.tagText, supplements.includes(s.value) && styles.tagTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{t('onboarding.step5.other')}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={customSupplement} onChangeText={setCustomSupplement} placeholder={t('onboarding.step5.otherPlaceholder')} placeholderTextColor="#8A8A94" onSubmitEditing={addCustomSupplement} />
            <Pressable style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }} onPress={addCustomSupplement}>
              <Text style={{ color: '#111114', fontWeight: '600' }}>{t('onboarding.step5.add')}</Text>
            </Pressable>
          </View>
          {customSupplements.length > 0 && (
            <View style={[styles.tagsWrap, { marginTop: 12 }]}>
              {customSupplements.map((s) => (
                <Pressable key={s} style={styles.tagActive} onPress={() => setCustomSupplements(customSupplements.filter((x) => x !== s))}>
                  <Text style={styles.tagTextActive}>{s} ×</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {step === 6 && (
        <View style={styles.stepWrap}>
          {/* ── Phase: list ─────────────────────────────────────── */}
          {h6phase === 'list' && (
            <>
              <Text style={styles.stepTitle}>{t('onboarding.step6.title')}</Text>
              <Text style={styles.stepSub}>{t('onboarding.step6.sub')}</Text>

              <Pressable
                style={[styles.noneBtn, noIssues && styles.noneBtnActive]}
                onPress={() => { setNoIssues(v => !v); setHealthEntries([]); setH6search(''); }}
              >
                <Text style={[styles.noneBtnText, noIssues && styles.noneBtnTextActive]}>
                  {noIssues ? t('onboarding.step6.noIssuesSelected') : t('onboarding.step6.noIssues')}
                </Text>
              </Pressable>

              {/* Search + condition list collapse once "no issues" is chosen so
                  the Next button is reachable without scrolling past them. */}
              {!noIssues && <TextInput
                style={[styles.input, { marginBottom: 16, marginTop: 8 }]}
                value={h6search}
                onChangeText={val => { setH6search(val); if (noIssues && val) setNoIssues(false); }}
                placeholder={t('onboarding.step6.searchPlaceholder')}
                placeholderTextColor="#8A8A94"
                clearButtonMode="while-editing"
              />}

              {/* Saved entries */}
              {healthEntries.length > 0 && (
                <View style={{ marginBottom: 16, gap: 8 }}>
                  {healthEntries.map((e, i) => (
                    <View key={i} style={styles.entryCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryRegion}>{CONDITIONS_DB[e.region]?.label}</Text>
                        <Text style={styles.entryLabel}>{conditionSummaryLabel(e)}</Text>
                      </View>
                      <Pressable onPress={() => setHealthEntries(prev => prev.filter((_, idx) => idx !== i))} style={styles.entryRemove}>
                        <Text style={styles.entryRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Condition list */}
              {!noIssues && Object.entries(CONDITIONS_DB).map(([regionKey, region]) => {
                const filtered = h6search.trim()
                  ? region.conditions.filter(c =>
                      c.label.toLowerCase().includes(h6search.toLowerCase()) ||
                      c.desc.toLowerCase().includes(h6search.toLowerCase()) ||
                      region.label.toLowerCase().includes(h6search.toLowerCase())
                    )
                  : region.conditions;
                if (filtered.length === 0) return null;
                return (
                  <View key={regionKey} style={{ marginBottom: 20 }}>
                    <Text style={styles.condRegionHeader}>{region.label}</Text>
                    {filtered.map((cond, ci) => (
                      <Pressable
                        key={cond.key}
                        style={[styles.condRow, ci < filtered.length - 1 && styles.condRowBorder]}
                        onPress={() => {
                          setNoIssues(false);
                          setH6pending({ region: regionKey, conditionKey: cond.key, conditionLabel: cond.label, canBePost: cond.canBePost, alwaysPost: cond.alwaysPost, isVariable: cond.isVariable });
                          setH6phase(cond.alwaysPost ? 'timeline' : 'severity');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.condRowLabel}>{cond.label}</Text>
                          <Text style={styles.condRowDesc}>{cond.desc}</Text>
                        </View>
                        <Text style={styles.condRowArrow}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </>
          )}

          {/* ── Phase: severity ─────────────────────────────────── */}
          {h6phase === 'severity' && h6pending && (
            <View>
              <Pressable onPress={() => setH6phase('list')} style={{ marginBottom: 20 }}>
                <Text style={{ color: '#9494A0', fontSize: 15 }}>← {t('common.back')}</Text>
              </Pressable>
              <Text style={styles.stepTitle}>{h6pending.conditionLabel}</Text>
              <Text style={styles.stepSub}>{t('onboarding.step6.severitySub')}</Text>
              <View style={{ gap: 10 }}>
                {SEVERITY_OPTIONS.map(s => (
                  <Pressable
                    key={s.key}
                    style={styles.layerOptionCard}
                    onPress={() => {
                      if (h6pending.canBePost && s.key === 'severe') {
                        setH6phase('post_op');
                      } else {
                        const entry = { region: h6pending.region, conditionKey: h6pending.conditionKey, conditionLabel: h6pending.conditionLabel, severity: s.key, postOp: false, postOpTimeline: null, isVariable: h6pending.isVariable };
                        setHealthEntries(prev => [...prev, entry]);
                        setH6phase('list');
                        setH6pending(null);
                      }
                    }}
                  >
                    <Text style={styles.layerOptionLabel}>{s.label}</Text>
                    <Text style={styles.layerOptionDesc}>{s.desc}</Text>
                  </Pressable>
                ))}
                {h6pending.canBePost && (
                  <Pressable
                    style={[styles.layerOptionCard, styles.layerOptionPostOp]}
                    onPress={() => setH6phase('post_op')}
                  >
                    <Text style={styles.layerOptionLabel}>{t('onboarding.step6.postSurgery')}</Text>
                    <Text style={styles.layerOptionDesc}>{t('onboarding.step6.postSurgeryDesc')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* ── Phase: post_op confirm ───────────────────────────── */}
          {h6phase === 'post_op' && h6pending && (
            <View>
              <Pressable onPress={() => setH6phase(h6pending.alwaysPost ? 'list' : 'severity')} style={{ marginBottom: 20 }}>
                <Text style={{ color: '#9494A0', fontSize: 15 }}>← {t('common.back')}</Text>
              </Pressable>
              <Text style={styles.stepTitle}>{t('onboarding.step6.surgeryTitle')}</Text>
              <Text style={styles.stepSub}>{h6pending.conditionLabel}</Text>
              <View style={{ gap: 10 }}>
                {POST_OP_TIMELINE_OPTIONS.map(opt => (
                  <Pressable
                    key={opt.key}
                    style={styles.layerOptionCard}
                    onPress={() => {
                      const entry = { region: h6pending.region, conditionKey: h6pending.conditionKey, conditionLabel: h6pending.conditionLabel, severity: 'severe', postOp: true, postOpTimeline: opt.key, isVariable: false };
                      setHealthEntries(prev => [...prev, entry]);
                      setH6phase('list');
                      setH6pending(null);
                    }}
                  >
                    <Text style={styles.layerOptionLabel}>{opt.label}</Text>
                    <Text style={styles.layerOptionDesc}>{opt.desc}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {healthEntries.length > 0 && h6phase === 'list' && (
            <View style={styles.conditionsNote}>
              <Text style={styles.conditionsNoteText}>
                {t('onboarding.step6.note')}
              </Text>
            </View>
          )}
        </View>
      )}

      {step === 7 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>{t('onboarding.step7.title')}</Text>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>{t('onboarding.step7.calorieTarget')}</Text>
            <Text style={styles.resultBig}>{caloricTarget ?? '—'} {t('onboarding.step7.kcal')}</Text>
            {tdee && <Text style={styles.resultDetail}>{t('onboarding.step7.maintenance', { tdee, focus: nutritionFocusDerived === 'cut' ? t('onboarding.step7.focusCut') : nutritionFocusDerived === 'bulk' ? t('onboarding.step7.focusBulk') : nutritionFocusDerived === 'recomp' ? t('onboarding.step7.focusRecomp') : t('onboarding.step7.focusMaintain') })}</Text>}
          </View>
          <View style={styles.macrosRow}>
            <View style={styles.macroCard}>
              <Text style={styles.macroVal}>{proteinTarget ?? '—'}g</Text>
              <Text style={styles.macroLabel}>{t('onboarding.step7.protein')}</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroVal}>{carbTarget ?? '—'}g</Text>
              <Text style={styles.macroLabel}>{t('onboarding.step7.carbs')}</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroVal}>{fatTarget ?? '—'}g</Text>
              <Text style={styles.macroLabel}>{t('onboarding.step7.fat')}</Text>
            </View>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>{t('onboarding.step7.trainingPlan')}</Text>
            <Text style={styles.resultDetail}>{t('onboarding.step7.schedule', { days: weeklyWorkouts, len: sessionLength })}</Text>
            {feedback && <Text style={[styles.resultDetail, { color: statusColors[feedback.status] }]}>{feedback.program} — {statusLabels[feedback.status]}</Text>}
            {goals.length > 0 && <Text style={styles.resultDetail}>{t('onboarding.step7.goalsLabel', { list: goals.map(k => t(`onboarding.goals.${k}`)).join(', ') })}</Text>}
            {trainingExperience && <Text style={styles.resultDetail}>{t('onboarding.step7.experienceLabel', { label: expLabel(trainingExperience) })}</Text>}
            {weeksToGoal > 0 && <Text style={styles.resultDetail}>{t('onboarding.step7.targetLabel', { target: targetWeight, weeks: weeksToGoal })}</Text>}
          </View>
          {(supplements.length > 0 || customSupplements.length > 0) && !supplements.includes('None') && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>{t('onboarding.step7.supplementsNoted')}</Text>
              <Text style={styles.resultDetail}>{[...supplements.map(v => { const m = SUPPLEMENTS.find(s => s.value === v); return m ? m.label : v; }), ...customSupplements].join(', ')}</Text>
            </View>
          )}
          {healthEntries.length > 0 && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>{t('onboarding.step7.conditionsFiltered')}</Text>
              {healthEntries.map((e, i) => (
                <Text key={i} style={styles.resultDetail}>{conditionSummaryLabel(e)}</Text>
              ))}
            </View>
          )}
          <Pressable style={styles.completeBtn} onPress={() => {
            const expOption = EXPERIENCE_OPTIONS.find(o => o.key === trainingExperience);
            const legacyKeys = [...new Set(healthEntries.flatMap(e => deriveConditionKeys(e)))];
            const structuredJson = healthEntries.map(e => JSON.stringify(e));
            onComplete && onComplete({
              sex, age: parseInt(age) || null,
              height, weight, targetWeight, weeklyWorkouts, sessionLength,
              equipment, supplements: [...supplements, ...customSupplements],
              goals, caloricTarget, proteinTarget, carbTarget, fatTarget,
              tdee, nutrition_focus: nutritionFocusDerived,
              trainingCaloricTarget: nutritionTargets?.training_caloric_target ?? null,
              trainingCarbTarget: nutritionTargets?.training_carb_target ?? null,
              restCaloricTarget: nutritionTargets?.rest_caloric_target ?? null,
              restCarbTarget: nutritionTargets?.rest_carb_target ?? null,
              trainingExperience: expOption?.level || 'beginner',
              trainingExperienceLabel: expOption ? expLabel(expOption.key) : '',
              health_conditions: legacyKeys,
              health_conditions_structured: structuredJson,
              sports,
            });
          }}>
            <Text style={styles.completeBtnText}>{t('onboarding.step7.start')}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.navRow}>
        {step > 1 && <Pressable style={styles.backBtn} onPress={back}><Text style={styles.backBtnText}>← {t('common.back')}</Text></Pressable>}
        {step < totalSteps && <Pressable style={styles.nextBtn} onPress={handleNext}><Text style={styles.nextBtnText}>{t('onboarding.next')} →</Text></Pressable>}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  progressBg: { height: 3, backgroundColor: '#2C2C35', marginTop: 12 },
  progressFill: { height: 3, backgroundColor: '#FFFFFF' },
  stepLabel: { fontSize: 12, color: '#9494A0', padding: 24, paddingBottom: 0 },
  stepWrap: { padding: 24 },
  stepTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.8, marginBottom: 8, lineHeight: 36 },
  stepSub: { fontSize: 14, color: '#9494A0', marginBottom: 32, lineHeight: 22 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35', padding: 16, color: '#FFFFFF', fontSize: 16 },
  bmiCard: { marginTop: 20, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  bmiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  bmiLabel: { fontSize: 14, color: '#9494A0' },
  bmiVal: { fontSize: 28, fontWeight: '700' },
  bmiCategory: { fontSize: 14, fontWeight: '600' },
  bmiRange: { fontSize: 13, color: '#9494A0' },
  goalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  goalCard: { width: '48%', backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalCardActive: { borderColor: '#FFFFFF', backgroundColor: '#1C1C22' },
  goalLabel: { fontSize: 14, color: '#9494A0', fontWeight: '500' },
  goalLabelActive: { color: '#E4E4E8' },
  check: { color: '#FFFFFF', fontWeight: '700' },
  estimate: { fontSize: 13, color: '#1D9E75', marginTop: 12 },
  goalCitationCard: { backgroundColor: '#111114', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#1D9E7544', marginBottom: 16 },
  goalCitationTitle: { fontSize: 10, color: '#1D9E75', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  goalCitationText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 6 },
  goalCitationSource: { fontSize: 10, color: '#9494A0', fontStyle: 'italic' },
  optionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  optionBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  optionBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  optionBtnText: { color: '#9494A0', fontWeight: '600' },
  optionBtnTextActive: { color: '#111114' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#1A1A20', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  tagActive: { backgroundColor: '#1C1C22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: '#FFFFFF' },
  tagText: { color: '#9494A0', fontSize: 13 },
  tagTextActive: { color: '#E4E4E8', fontSize: 13 },
  expCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  expCardActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  expLabel: { fontSize: 15, fontWeight: '600', color: '#A1A1AA', marginBottom: 3 },
  expLabelActive: { color: '#FFFFFF' },
  expSublabel: { fontSize: 12, color: '#9494A0' },
  feedbackCard: { marginTop: 16, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, marginBottom: 8 },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  feedbackBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  feedbackBadgeText: { fontSize: 12, fontWeight: '600' },
  feedbackProgram: { fontSize: 13, color: '#A1A1AA', fontWeight: '500' },
  feedbackMessage: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 10 },
  feedbackCitation: { fontSize: 11, color: '#9494A0', fontStyle: 'italic', lineHeight: 16 },
  resultCard: { backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  resultLabel: { fontSize: 11, color: '#9494A0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultBig: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  resultDetail: { fontSize: 14, color: '#A1A1AA', marginTop: 4 },
  macrosRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroCard: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  macroVal: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  macroLabel: { fontSize: 11, color: '#9494A0', marginTop: 3 },
  completeBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  completeBtnText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 8 },
  backBtn: { paddingVertical: 12 },
  backBtnText: { color: '#9494A0', fontSize: 15 },
  nextBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginLeft: 'auto' },
  nextBtnText: { color: '#111114', fontSize: 15, fontWeight: '600' },
  conditionsNote: { marginTop: 16, backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#FFFFFF1A' },
  conditionsNoteText: { fontSize: 13, color: '#E4E4E8', lineHeight: 20 },
  noneBtn: { backgroundColor: '#1A1A20', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 0.5, borderColor: '#2C2C35', alignSelf: 'flex-start', marginBottom: 8 },
  noneBtnActive: { borderColor: '#FFFFFF', backgroundColor: '#1C1C22' },
  noneBtnText: { fontSize: 14, color: '#9494A0', fontWeight: '500' },
  noneBtnTextActive: { color: '#FFFFFF' },
  // Condition list
  condRegionHeader: { fontSize: 11, color: '#9494A0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  condRow: { backgroundColor: '#1A1A20', paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  condRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#2C2C35' },
  condRowLabel: { fontSize: 14, color: '#E4E4E8', fontWeight: '500', marginBottom: 2 },
  condRowDesc: { fontSize: 12, color: '#9494A0' },
  condRowArrow: { fontSize: 20, color: '#8A8A94', marginLeft: 8 },
  // Saved entry chips
  entryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C22', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: '#FFFFFF' },
  entryRegion: { fontSize: 10, color: '#9494A0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  entryLabel: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  entryRemove: { padding: 6 },
  entryRemoveText: { color: '#9494A0', fontSize: 14 },
  // Layer option cards (severity / post-op timeline)
  dayBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  dayBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  dayBtnText: { fontSize: 11, color: '#9494A0', fontWeight: '600' },
  dayBtnTextActive: { color: '#111114' },
  layerOptionCard: { backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  layerOptionPostOp: { borderColor: '#3D3D5C' },
  layerOptionLabel: { fontSize: 15, color: '#FFFFFF', fontWeight: '600', marginBottom: 3 },
  layerOptionDesc: { fontSize: 13, color: '#9494A0' },
});