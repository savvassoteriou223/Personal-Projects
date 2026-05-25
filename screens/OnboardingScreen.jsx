import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOAL_PARAMETERS } from './scienceEngine';
import { resolveGoalCombo, GOAL_COMBO_CALORIES } from './programGenerator';

export default function OnboardingScreen({ onComplete, onGoBack }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
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
  const [healthConditions, setHealthConditions] = useState([]);

  const scrollRef = useRef(null);
  const totalSteps = 7;
  const back = () => setStep((s) => s - 1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const handleNext = () => {
    if (step === 1) {
      const hVal = parseFloat(height);
      const wVal = parseFloat(weight);
      if (!height || isNaN(hVal) || hVal < 100 || hVal > 250) {
        Alert.alert('Invalid height', 'Please enter a height between 100 and 250 cm.');
        return;
      }
      if (!weight || isNaN(wVal) || wVal < 20 || wVal > 300) {
        Alert.alert('Invalid weight', 'Please enter a weight between 20 and 300 kg.');
        return;
      }
    }
    if (step === 2) {
      if (goals.length === 0) {
        Alert.alert('Select a goal', 'Please select at least one goal to continue.');
        return;
      }
      const twVal = parseFloat(targetWeight);
      if (!targetWeight || isNaN(twVal) || twVal < 20 || twVal > 300) {
        Alert.alert('Invalid target weight', 'Please enter a target weight between 20 and 300 kg.');
        return;
      }
    }
    if (step === 3) {
      if (!trainingExperience) {
        Alert.alert('Select your experience', 'Please select how long you have been training for this goal.');
        return;
      }
    }
    if (step === 4) {
      if (equipment.length === 0) {
        Alert.alert('Select equipment', 'Please select at least one equipment option.');
        return;
      }
    }
    if (step === 5) {
      if (supplements.length === 0 && customSupplements.length === 0) {
        Alert.alert('Select supplements', 'Please select at least one option, or tap "None" if you take no supplements.');
        return;
      }
    }
    if (step === 6) {
      if (healthConditions.length === 0) {
        Alert.alert('Health conditions', 'Please select any relevant conditions, or tap "None" if you have no injuries or conditions.');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const h = parseFloat(height);
  const w = parseFloat(weight);
  const tw = parseFloat(targetWeight);

  const bmi = h && w ? (w / ((h / 100) ** 2)).toFixed(1) : null;
  const bmiCategory = bmi
    ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese'
    : null;
  const bmiColor = bmi
    ? bmi < 18.5 ? '#BA7517' : bmi < 25 ? '#1D9E75' : bmi < 30 ? '#BA7517' : '#E24B4A'
    : null;
  const healthyLow = h ? (18.5 * ((h / 100) ** 2)).toFixed(1) : null;
  const healthyHigh = h ? (24.9 * ((h / 100) ** 2)).toFixed(1) : null;
  const weeksToGoal = w && tw ? Math.abs(Math.round((w - tw) / 0.5)) : null;

  const combo = resolveGoalCombo(goals);
  const comboCalories = GOAL_COMBO_CALORIES[combo] || GOAL_COMBO_CALORIES.maintain;
  const caloricTarget = w ? Math.round(w * 24 * comboCalories.multiplier) : null;
  const proteinTarget = w ? Math.round(w * comboCalories.proteinPerKg) : null;
  const fatTarget = caloricTarget ? Math.round((caloricTarget * 0.25) / 9) : null;
  const carbTarget = caloricTarget && proteinTarget && fatTarget
    ? Math.round((caloricTarget - proteinTarget * 4 - fatTarget * 9) / 4)
    : null;

  const toggleItem = (list, setList, item) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const addCustomSupplement = () => {
    if (customSupplement.trim()) {
      setCustomSupplements([...customSupplements, customSupplement.trim()]);
      setCustomSupplement('');
    }
  };

  const EXPERIENCE_OPTIONS = [
    { key: 'under_6m', label: 'Less than 6 months', sublabel: 'Just starting out', level: 'beginner' },
    { key: '6m_to_2y', label: '6 months – 2 years', sublabel: 'Building foundations', level: 'beginner' },
    { key: '2y_to_4y', label: '2 – 4 years', sublabel: 'Consistent practitioner', level: 'intermediate' },
    { key: 'over_4y', label: '4+ years', sublabel: 'Well experienced', level: 'advanced' },
  ];

  const GOAL_ACTIVITY_LABEL = {
    lose: 'losing fat',
    gain: 'building muscle',
    strength: 'strength training',
    aesthetics: 'lifting',
    endurance: 'endurance training',
    maintain: 'exercising regularly',
  };

  const GOALS = [
    { key: 'lose', label: 'Lose fat' },
    { key: 'gain', label: 'Build muscle' },
    { key: 'strength', label: 'Build strength' },
    { key: 'aesthetics', label: 'Aesthetics' },
    { key: 'endurance', label: 'Improve endurance' },
    { key: 'maintain', label: 'Stay healthy' },
  ];

  const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cables', 'Machines', 'Bodyweight only', 'Kettlebells', 'Resistance bands'];
  const SUPPLEMENTS = ['Whey protein', 'Creatine', 'Pre-workout', 'Multivitamin', 'Omega-3', 'Vitamin D', 'Magnesium', 'BCAAs', 'Collagen', 'None'];

  const getScheduleFeedback = () => {
    const wantsMuscle = goals.includes('gain') || goals.includes('strength') || goals.includes('aesthetics');
    const wantsEndurance = goals.includes('endurance');
    const wantsFat = goals.includes('lose');

    if (wantsMuscle) {
      if (weeklyWorkouts >= 4) {
        return {
          status: 'optimal',
          message: 'Each muscle group will be trained twice per week — the research-backed minimum for maximizing hypertrophy.',
          citation: 'Schoenfeld, Ogborn & Krieger (2016). Effects of resistance training frequency on measures of muscle hypertrophy. Sports Medicine, 46(11):1689–1697.',
          program: weeklyWorkouts === 4 ? 'Upper / Lower 4×/week' : weeklyWorkouts === 5 ? 'Hybrid 5×/week' : 'Push / Pull / Legs 6×/week',
        };
      } else if (weeklyWorkouts === 3) {
        return {
          status: 'good',
          message: 'Good starting point. Full body sessions will hit each muscle 3 times per week. Slightly less volume per muscle than optimal but effective.',
          citation: 'Schoenfeld et al. (2016): twice per week superior to once per week for hypertrophy. 3× full body meets this threshold.',
          program: 'Full Body 3×/week',
        };
      } else {
        return {
          status: 'suboptimal',
          message: '2 days is below the research minimum for optimal muscle growth. Results will come but significantly slower. Consider adding a third day if possible.',
          citation: 'Schoenfeld et al. (2016): training each muscle at least twice per week produces superior hypertrophic outcomes to once per week.',
          program: 'Full Body 2×/week',
        };
      }
    } else if (wantsEndurance && !wantsMuscle) {
      return {
        status: 'optimal',
        message: 'For endurance goals, higher rep ranges and shorter rest periods will be prioritized. Consistency matters more than frequency.',
        citation: 'ACSM Position Stand (2009): muscular endurance — higher repetitions, shorter rest intervals.',
        program: weeklyWorkouts >= 4 ? 'Upper / Lower Express' : 'Full Body Express',
      };
    } else if (wantsFat && !wantsMuscle) {
      return {
        status: 'optimal',
        message: 'For fat loss, resistance training preserves muscle while in a caloric deficit. Higher density training keeps heart rate elevated.',
        citation: 'Willis et al. (2012): resistance training preserves lean mass during caloric restriction. J Appl Physiol.',
        program: weeklyWorkouts >= 4 ? 'Upper / Lower Express' : 'Full Body Express',
      };
    }
    return {
      status: 'good',
      message: 'Your schedule will be optimized for your selected goals.',
      citation: '',
      program: weeklyWorkouts >= 4 ? 'Upper / Lower' : 'Full Body',
    };
  };

  const feedback = goals.length > 0 ? getScheduleFeedback() : null;
  const statusColors = { optimal: '#1D9E75', good: '#BA7517', suboptimal: '#E24B4A' };
  const statusLabels = { optimal: 'Optimal', good: 'Good', suboptimal: 'Suboptimal' };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.progressBg, { marginTop: insets.top + 12 }]}>
        <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
      </View>
      <Text style={styles.stepLabel}>Step {step} of {totalSteps}</Text>
      {step === 1 && (
        <Pressable onPress={onGoBack} style={{ paddingHorizontal: 24 }}>
          <Text style={{ color: '#71717A', fontSize: 15 }}>← Back</Text>
        </Pressable>
      )}

      {step === 1 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>Let's start with{'\n'}your body stats</Text>
          <Text style={styles.stepSub}>We'll calculate your BMI and healthy weight range.</Text>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="e.g. 178" placeholderTextColor="#3D3D4A" />
          <Text style={styles.label}>Current weight (kg)</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 85" placeholderTextColor="#3D3D4A" />
          {bmi && (
            <View style={styles.bmiCard}>
              <View style={styles.bmiRow}>
                <Text style={styles.bmiLabel}>Your BMI</Text>
                <Text style={[styles.bmiVal, { color: bmiColor }]}>{bmi}</Text>
                <Text style={[styles.bmiCategory, { color: bmiColor }]}>{bmiCategory}</Text>
              </View>
              <Text style={styles.bmiRange}>Healthy weight range: {healthyLow}kg – {healthyHigh}kg</Text>
            </View>
          )}
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>What are your goals?</Text>
          <Text style={styles.stepSub}>Your healthy range is {healthyLow}–{healthyHigh}kg. You're at {weight}kg.{'\n'}Select all that apply.</Text>
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
          <Text style={styles.label}>Target weight (kg)</Text>
          <TextInput style={styles.input} value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" placeholder="e.g. 75" placeholderTextColor="#3D3D4A" />
          {weeksToGoal > 0 && <Text style={styles.estimate}>At a healthy pace, you'll reach {targetWeight}kg in ~{weeksToGoal} weeks</Text>}
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>How long have you been{'\n'}{GOAL_ACTIVITY_LABEL[goals[0]] || 'training'}?</Text>
          <Text style={styles.stepSub}>This calibrates your weekly training volume. Being new to {GOAL_ACTIVITY_LABEL[goals[0]] || 'this goal'} means a different program even if you've trained before.</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {EXPERIENCE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.expCard, trainingExperience === opt.key && styles.expCardActive]}
                onPress={() => setTrainingExperience(opt.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expLabel, trainingExperience === opt.key && styles.expLabelActive]}>{opt.label}</Text>
                  <Text style={styles.expSublabel}>{opt.sublabel}</Text>
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
          <Text style={styles.stepTitle}>Your training schedule</Text>
          <Text style={styles.stepSub}>We'll build your plan around your availability.</Text>

          <Text style={styles.label}>Days per week</Text>
          <View style={styles.optionRow}>
            {[2, 3, 4, 5, 6].map((d) => (
              <Pressable key={d} style={[styles.optionBtn, weeklyWorkouts === d && styles.optionBtnActive]} onPress={() => setWeeklyWorkouts(d)}>
                <Text style={[styles.optionBtnText, weeklyWorkouts === d && styles.optionBtnTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Session length</Text>
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
              <Text style={styles.feedbackMessage}>{feedback.message}</Text>
              {feedback.citation ? <Text style={styles.feedbackCitation}>{feedback.citation}</Text> : null}
            </View>
          )}

          <Text style={styles.label}>Equipment available</Text>
          <View style={styles.tagsWrap}>
            {EQUIPMENT.map((e) => (
              <Pressable key={e} style={[styles.tag, equipment.includes(e) && styles.tagActive]} onPress={() => toggleItem(equipment, setEquipment, e)}>
                <Text style={[styles.tagText, equipment.includes(e) && styles.tagTextActive]}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === 5 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>What supplements{'\n'}do you take?</Text>
          <Text style={styles.stepSub}>We'll factor these into your nutrition targets.</Text>
          <View style={styles.tagsWrap}>
            {SUPPLEMENTS.map((s) => (
              <Pressable key={s} style={[styles.tag, supplements.includes(s) && styles.tagActive]} onPress={() => {
                if (s === 'None') { setSupplements(['None']); }
                else { setSupplements(supplements.includes(s) ? supplements.filter((x) => x !== s) : [...supplements.filter((x) => x !== 'None'), s]); }
              }}>
                <Text style={[styles.tagText, supplements.includes(s) && styles.tagTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Other supplements</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput style={[styles.input, { flex: 1 }]} value={customSupplement} onChangeText={setCustomSupplement} placeholder="e.g. Ashwagandha" placeholderTextColor="#3D3D4A" onSubmitEditing={addCustomSupplement} />
            <Pressable style={{ backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }} onPress={addCustomSupplement}>
              <Text style={{ color: '#111114', fontWeight: '600' }}>Add</Text>
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
          <Text style={styles.stepTitle}>Any injuries or{'\n'}health conditions?</Text>
          <Text style={styles.stepSub}>We'll filter out exercises that are contraindicated for your situation. Select all that apply, or tap "None".</Text>
          <View style={styles.tagsWrap}>
            {[
              { key: 'none', label: 'None' },
              // Spine
              { key: 'lower_back_disc_herniation', label: 'Lower back disc' },
              { key: 'spondylolisthesis', label: 'Spondylolisthesis' },
              { key: 'scoliosis', label: 'Scoliosis' },
              { key: 'cervical_disc_herniation', label: 'Cervical disc' },
              { key: 'sciatica', label: 'Sciatica' },
              // Shoulder
              { key: 'shoulder_impingement', label: 'Shoulder impingement' },
              { key: 'rotator_cuff_tear', label: 'Rotator cuff tear' },
              { key: 'ac_joint_injury', label: 'AC joint injury' },
              { key: 'shoulder_instability', label: 'Shoulder instability' },
              // Elbow & wrist
              { key: 'lateral_epicondylitis', label: 'Tennis elbow' },
              { key: 'medial_epicondylitis', label: 'Golfer\'s elbow' },
              { key: 'bicep_tendinopathy', label: 'Bicep tendinopathy' },
              { key: 'wrist_injury', label: 'Wrist injury' },
              { key: 'carpal_tunnel_syndrome', label: 'Carpal tunnel' },
              // Hip & knee
              { key: 'bilateral_hip_replacement', label: 'Hip replacement' },
              { key: 'hip_labral_tear', label: 'Hip labral tear' },
              { key: 'inguinal_hernia', label: 'Inguinal hernia' },
              { key: 'knee_replacement', label: 'Knee replacement' },
              { key: 'severe_knee_osteoarthritis', label: 'Knee osteoarthritis' },
              { key: 'patellofemoral_syndrome', label: 'Patellofemoral syndrome' },
              // Lower leg & foot
              { key: 'proximal_hamstring_tendinopathy', label: 'Hamstring tendinopathy' },
              { key: 'achilles_tendinopathy', label: 'Achilles tendinopathy' },
              { key: 'plantar_fasciitis', label: 'Plantar fasciitis' },
              // Other
              { key: 'osteoporosis', label: 'Osteoporosis' },
            ].map((c) => (
              <Pressable
                key={c.key}
                style={[styles.tag, healthConditions.includes(c.key) && styles.tagActive]}
                onPress={() => {
                  if (c.key === 'none') {
                    setHealthConditions(['none']);
                  } else {
                    setHealthConditions(
                      healthConditions.includes(c.key)
                        ? healthConditions.filter((x) => x !== c.key)
                        : [...healthConditions.filter((x) => x !== 'none'), c.key]
                    );
                  }
                }}
              >
                <Text style={[styles.tagText, healthConditions.includes(c.key) && styles.tagTextActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          {healthConditions.length > 0 && !healthConditions.includes('none') && (
            <View style={styles.conditionsNote}>
              <Text style={styles.conditionsNoteText}>
                Exercises contraindicated for your conditions will be automatically replaced with safer alternatives.
              </Text>
            </View>
          )}
        </View>
      )}

      {step === 7 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>Your personal plan{'\n'}is ready</Text>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Daily calorie target</Text>
            <Text style={styles.resultBig}>{caloricTarget} kcal</Text>
          </View>
          <View style={styles.macrosRow}>
            <View style={styles.macroCard}>
              <Text style={styles.macroVal}>{proteinTarget}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroVal}>{carbTarget}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroCard}>
              <Text style={styles.macroVal}>{fatTarget}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Training plan</Text>
            <Text style={styles.resultDetail}>{weeklyWorkouts} days/week · {sessionLength} min sessions</Text>
            {feedback && <Text style={[styles.resultDetail, { color: statusColors[feedback.status] }]}>{feedback.program} — {statusLabels[feedback.status]}</Text>}
            {goals.length > 0 && <Text style={styles.resultDetail}>Goals: {goals.join(', ')}</Text>}
            {trainingExperience && <Text style={styles.resultDetail}>Experience: {EXPERIENCE_OPTIONS.find(o => o.key === trainingExperience)?.label}</Text>}
            {weeksToGoal > 0 && <Text style={styles.resultDetail}>Target: {targetWeight}kg in ~{weeksToGoal} weeks</Text>}
          </View>
          {(supplements.length > 0 || customSupplements.length > 0) && !supplements.includes('None') && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Supplements noted</Text>
              <Text style={styles.resultDetail}>{[...supplements, ...customSupplements].join(', ')}</Text>
            </View>
          )}
          {healthConditions.length > 0 && !healthConditions.includes('none') && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Conditions (program filtered)</Text>
              <Text style={styles.resultDetail}>{healthConditions.join(', ').replace(/_/g, ' ')}</Text>
            </View>
          )}
          <Pressable style={styles.completeBtn} onPress={() => {
            const expOption = EXPERIENCE_OPTIONS.find(o => o.key === trainingExperience);
            onComplete && onComplete({
              height, weight, targetWeight, weeklyWorkouts, sessionLength,
              equipment, supplements: [...supplements, ...customSupplements],
              goals, caloricTarget, proteinTarget, carbTarget, fatTarget,
              trainingExperience: expOption?.level || 'beginner',
              trainingExperienceLabel: expOption?.label || '',
              health_conditions: healthConditions.includes('none') ? [] : healthConditions,
            });
          }}>
            <Text style={styles.completeBtnText}>Start training</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.navRow}>
        {step > 1 && <Pressable style={styles.backBtn} onPress={back}><Text style={styles.backBtnText}>← Back</Text></Pressable>}
        {step < totalSteps && <Pressable style={styles.nextBtn} onPress={handleNext}><Text style={styles.nextBtnText}>Next →</Text></Pressable>}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  progressBg: { height: 3, backgroundColor: '#2C2C35', marginTop: 12 },
  progressFill: { height: 3, backgroundColor: '#FFFFFF' },
  stepLabel: { fontSize: 12, color: '#71717A', padding: 24, paddingBottom: 0 },
  stepWrap: { padding: 24 },
  stepTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.8, marginBottom: 8, lineHeight: 36 },
  stepSub: { fontSize: 14, color: '#71717A', marginBottom: 32, lineHeight: 22 },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#1A1A20', borderRadius: 12, borderWidth: 0.5, borderColor: '#2C2C35', padding: 16, color: '#FFFFFF', fontSize: 16 },
  bmiCard: { marginTop: 20, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  bmiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  bmiLabel: { fontSize: 14, color: '#71717A' },
  bmiVal: { fontSize: 28, fontWeight: '700' },
  bmiCategory: { fontSize: 14, fontWeight: '600' },
  bmiRange: { fontSize: 13, color: '#71717A' },
  goalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  goalCard: { width: '48%', backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalCardActive: { borderColor: '#FFFFFF', backgroundColor: '#1C1C22' },
  goalLabel: { fontSize: 14, color: '#71717A', fontWeight: '500' },
  goalLabelActive: { color: '#E4E4E8' },
  check: { color: '#FFFFFF', fontWeight: '700' },
  estimate: { fontSize: 13, color: '#1D9E75', marginTop: 12 },
  goalCitationCard: { backgroundColor: '#111114', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#1D9E7544', marginBottom: 16 },
  goalCitationTitle: { fontSize: 10, color: '#1D9E75', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  goalCitationText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 6 },
  goalCitationSource: { fontSize: 10, color: '#71717A', fontStyle: 'italic' },
  optionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  optionBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  optionBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  optionBtnText: { color: '#71717A', fontWeight: '600' },
  optionBtnTextActive: { color: '#111114' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#1A1A20', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  tagActive: { backgroundColor: '#1C1C22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: '#FFFFFF' },
  tagText: { color: '#71717A', fontSize: 13 },
  tagTextActive: { color: '#E4E4E8', fontSize: 13 },
  expCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35' },
  expCardActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  expLabel: { fontSize: 15, fontWeight: '600', color: '#A1A1AA', marginBottom: 3 },
  expLabelActive: { color: '#FFFFFF' },
  expSublabel: { fontSize: 12, color: '#71717A' },
  feedbackCard: { marginTop: 16, backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, borderWidth: 0.5, marginBottom: 8 },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  feedbackBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  feedbackBadgeText: { fontSize: 12, fontWeight: '600' },
  feedbackProgram: { fontSize: 13, color: '#A1A1AA', fontWeight: '500' },
  feedbackMessage: { fontSize: 13, color: '#A1A1AA', lineHeight: 20, marginBottom: 10 },
  feedbackCitation: { fontSize: 11, color: '#71717A', fontStyle: 'italic', lineHeight: 16 },
  resultCard: { backgroundColor: '#1A1A20', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  resultLabel: { fontSize: 11, color: '#71717A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultBig: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
  resultDetail: { fontSize: 14, color: '#A1A1AA', marginTop: 4 },
  macrosRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroCard: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  macroVal: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  macroLabel: { fontSize: 11, color: '#71717A', marginTop: 3 },
  completeBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  completeBtnText: { color: '#111114', fontSize: 16, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginTop: 8 },
  backBtn: { paddingVertical: 12 },
  backBtnText: { color: '#71717A', fontSize: 15 },
  nextBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginLeft: 'auto' },
  nextBtnText: { color: '#111114', fontSize: 15, fontWeight: '600' },
  conditionsNote: { marginTop: 16, backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#FFFFFF1A' },
  conditionsNoteText: { fontSize: 13, color: '#E4E4E8', lineHeight: 20 },
});