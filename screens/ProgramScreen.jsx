import {
  useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import { generateProgram, getRankedSplits, SPLITS, compactWorkout, COMPACT_COMPOUND_PATTERNS } from './programGenerator';
import { plannedVolumeFloor } from './volumeEngine';
import { GOAL_PARAMETERS } from './scienceEngine';
import StudyChart from './StudyChart';
import { getExerciseInsight } from './studiesLibrary';
import { getExerciseGif } from './exerciseDBService';
import { colors } from '../lib/theme';
import { animateLayout } from '../lib/motion';
import Tappable from '../components/Tappable';
import ExerciseGifThumb from './ExerciseGifThumb';
import { syncWorkoutReminders } from '../lib/notificationService';
import { Ionicons } from '@expo/vector-icons';
import PremiumPaywall from './PremiumPaywall';

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const OPTIMALITY_COLORS = {
  optimal:    colors.accent,
  good:       colors.warning,
  suboptimal: colors.danger,
};

const RANK_KEYS = ['rankBest', 'rank2', 'rank3'];

export default function ProgramScreen({ onStartWorkout, onSplitChanged, previewDay, onClose, isPremium, onUpgrade, onRestore }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectingDays, setSelectingDays] = useState(false);
  const [draftDays, setDraftDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openInfo, setOpenInfo] = useState(null); // 'research' | 'goal' | 'progression'
  const [showPaywall, setShowPaywall] = useState(false);
  // Compact mode for the day you are looking at. Same deal as on Today: it is a
  // decision about one session, so it is never persisted, and it resets whenever
  // you back out to the day list — a trim left switched on would quietly halve
  // every workout you started from this screen.
  const [compactMode, setCompactMode] = useState(false);

  // Shared with the Today screen so a day trims to the same sets from either
  // entry point. Measures the whole program, hence keyed on program + profile
  // rather than on the selected day.
  const plannedVolume = useMemo(
    () => plannedVolumeFloor(program, profile),
    [program, profile?.trainingExperience, profile?.sex],
  );
  // Optional days are excluded, exactly as `compactProgram` excludes them: they
  // are already the extra you do if you have time, so "trim the extra to its
  // minimum" is not a decision worth a control.
  const compactSelectedDay = useMemo(
    () => (selectedDay && !selectedDay.optional ? compactWorkout(selectedDay, plannedVolume) : null),
    [selectedDay, plannedVolume],
  );
  // What the list renders and what Start launches.
  const servedDay = compactMode && compactSelectedDay ? compactSelectedDay : selectedDay;
  // Duration, not minutes saved — "do I have time for this?" is the question the
  // toggle exists to answer. A compound set costs ~3 min with its longer rest,
  // isolation ~2, the same pricing the Today screen uses.
  const dayMins = useMemo(() => {
    const mins = d => (d?.exercises || []).reduce(
      (n, e) => n + e.sets * (COMPACT_COMPOUND_PATTERNS.has(e.pattern) ? 3 : 2), 0);
    return { full: mins(selectedDay), compact: mins(compactSelectedDay) };
  }, [selectedDay, compactSelectedDay]);

  useFocusEffect(useCallback(() => { loadProgram(); }, []));

  const loadProgram = async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    const [{ data: prof }, { data: block }] = await Promise.all([
      supabase.from('profiles').select('weekly_workouts, session_length, goals, name, equipment, selected_split, trainingExperience, sex').eq('id', user.id).single(),
      supabase.from('program_blocks').select('block_index, block_start_date').eq('user_id', user.id).maybeSingle(),
    ]);
    if (prof) {
      setProfile(prof);
      setDraftDays(parseInt(prof.weekly_workouts) || 3);
      setProgram(generateProgram(prof, block?.block_index || 0, block?.block_start_date || null));
    }
    setLoading(false);
  };

  const saveSplitChoice = async (splitId, days) => {
    const user = await getCurrentUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      selected_split: splitId,
      weekly_workouts: days,
    }).eq('id', user.id);
    if (error) { Alert.alert(t('program.saveFailTitle'), t('program.saveFailMsg')); return; }
    const newProfile = { ...profile, selected_split: splitId, weekly_workouts: days };
    setProfile(newProfile);
    const { data: block } = await supabase.from('program_blocks').select('block_index, block_start_date').eq('user_id', user.id).maybeSingle();
    setProgram(generateProgram(newProfile, block?.block_index || 0, block?.block_start_date || null));
    setSelectingDays(false);
    // Changing the split can change days-per-week, so the reminder weekdays move too.
    syncWorkoutReminders({
      weeklyWorkouts: days,
      content: { title: t('settings.reminderPushTitle'), body: t('settings.reminderPushBody') },
    });
    onSplitChanged && onSplitChanged();
  };

  // ─── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (previewDay) {
    const [previewLabel, previewSub] = previewDay.name.split(' — ');
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerNav}>
            <Tappable onPress={onClose} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← {t('common.back')}</Text>
            </Tappable>
            <Tappable style={styles.startBtn} onPress={() => onStartWorkout({ ...previewDay, trainingExperience: profile?.trainingExperience })}>
              <Text style={styles.startBtnText}>{t('program.start')}</Text>
            </Tappable>
          </View>
          <Text style={styles.title}>{previewLabel}</Text>
          {previewSub && <Text style={styles.titleSub}>{previewSub}</Text>}
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {previewDay.exercises.map((ex, i) => (
            <ExerciseCard key={i} ex={ex} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (loading) return <View style={styles.container} />;

  // ─── SPLIT SELECTOR ────────────────────────────────────────────────────────
  if (selectingDays) {
    const rankedSplits = getRankedSplits(draftDays, profile?.goals || [], profile?.trainingExperience);

    // Free users get the split the generator would have picked for them anyway —
    // rank 1 for their days and goals — so the program is never wrong, only
    // un-overridable. Days-per-week stays free for the same reason: it decides
    // which split FITS, and charging for fit would hand someone a program that
    // does not match the week they told us they have.
    //
    // A split already saved stays selectable whatever its rank. Someone who
    // picked one before this gate existed keeps it; the gate applies to
    // changing your mind, not to what you already run.
    const splitLocked = (split, i) =>
      !isPremium && i !== 0 && profile?.selected_split !== split.id;

    if (showPaywall) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerNav}>
              <Tappable onPress={() => setShowPaywall(false)} style={styles.backBtnWrapper}>
                <Text style={styles.backBtn}>← {t('common.back')}</Text>
              </Tappable>
            </View>
          </View>
          <PremiumPaywall feature="Program" onUpgrade={onUpgrade} onRestore={onRestore} />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerNav}>
            <Tappable onPress={() => setSelectingDays(false)} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← {t('common.back')}</Text>
            </Tappable>
          </View>
          <Text style={styles.title}>{t('program.chooseSplit')}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text style={styles.selectorLabel}>{t('program.daysQuestion')}</Text>
          <View style={styles.daysRow}>
            {DAYS_OPTIONS.map(d => (
              <Tappable
                key={d}
                style={[styles.dayBtn, draftDays === d && styles.dayBtnActive]}
                onPress={() => setDraftDays(d)}
                accessibilityState={{ selected: draftDays === d }}
              >
                <Text style={[styles.dayBtnText, draftDays === d && styles.dayBtnTextActive]}>{d}</Text>
              </Tappable>
            ))}
          </View>

          {profile?.goals?.length > 0 && (
            <Text style={styles.goalContext}>
              {t('program.rankedForGoals', { goals: profile.goals.map(g => t(`onboarding.goals.${g}`, { defaultValue: g })).join(', ') })}
            </Text>
          )}

          <Text style={styles.selectorLabel}>{t('program.recommendedSplits')}</Text>

          {rankedSplits.length === 0 ? (
            <Text style={styles.emptyText}>{t('program.noSplits')}</Text>
          ) : (
            rankedSplits.map((split, i) => {
              const isActive = profile?.selected_split === split.id ||
                (!profile?.selected_split && i === 0 && draftDays === (parseInt(profile?.weekly_workouts) || 3));
              const optColor = OPTIMALITY_COLORS[split.optimality] || colors.textPrimary;
              const locked = splitLocked(split, i);

              return (
                <View key={split.id} style={[styles.splitCard, isActive && styles.splitCardActive]}>
                  <View style={styles.splitCardTop}>
                    <View style={styles.splitCardLeft}>
                      <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#FFFFFF0D' : colors.border }]}>
                        <Text style={[styles.rankBadgeText, { color: i === 0 ? colors.textSecondary : colors.textSubtle }]}>
                          {RANK_KEYS[i] ? t(`program.${RANK_KEYS[i]}`) : t('program.rankN', { n: i + 1 })}
                        </Text>
                      </View>
                      <Text style={styles.splitName}>{split.name}</Text>
                    </View>
                    {isActive ? (
                      <View style={styles.activeCheck}>
                        <Text style={styles.activeCheckText}>{t('common.done')}</Text>
                      </View>
                    ) : locked ? (
                      <View style={styles.lockChip}>
                        <Ionicons name="lock-closed" size={9} color={colors.textOnLight} />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.splitMeta}>
                    <View style={[styles.metaChip, { borderColor: optColor + '44' }]}>
                      <Text style={[styles.metaChipText, { color: optColor }]}>
                        {t(`onboarding.feedback.${split.optimality}`, { defaultValue: split.optimality })}
                      </Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{t('program.perWeek', { days: split.days })}</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{t('program.freqPerMuscle', { freq: split.frequency_per_muscle })}</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{split.session_time_est}</Text>
                    </View>
                  </View>

                  <View style={styles.whyCard}>
                    <Text style={styles.whyLabel}>{t('program.whyThisSplit')}</Text>
                    <Text style={styles.whyText}>{split.rank_why}</Text>
                  </View>

                  {/* Only set when the user's experience level has outgrown
                      this split — a measurable limit, not a style preference,
                      so it sits above the general note rather than inside it. */}
                  {split.caution && (
                    <View style={styles.cautionBox}>
                      <Text style={styles.cautionText}>{split.caution}</Text>
                    </View>
                  )}

                  <Text style={styles.honestNoteText}>{split.honest_note}</Text>

                  <View style={styles.splitDays}>
                    {split.day_structure.map((d, j) => (
                      <View key={j} style={styles.splitDayChip}>
                        <Text style={styles.splitDayChipText}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  <Tappable
                    style={[styles.selectSplitBtn, isActive && styles.selectSplitBtnActive]}
                    onPress={() => locked ? setShowPaywall(true) : saveSplitChoice(split.id, draftDays)}
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={locked ? t('program.unlockSplit') : undefined}
                  >
                    <Text style={[styles.selectSplitBtnText, isActive && styles.selectSplitBtnTextActive]}>
                      {isActive ? t('program.currentSplit')
                        : locked ? t('program.unlockSplit')
                        : t('program.selectSplit')}
                    </Text>
                  </Tappable>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!program) return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><View style={styles.headerNav}><Text style={styles.title}>{t('program.myProgram')}</Text></View></View>
      <View style={styles.empty}><Text style={styles.emptyText}>{t('program.completeOnboarding')}</Text></View>
    </SafeAreaView>
  );

  // ─── DAY DETAIL ────────────────────────────────────────────────────────────
  if (selectedDay) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerNav}>
            <Tappable onPress={() => { setSelectedDay(null); setCompactMode(false); }} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← {t('common.back')}</Text>
            </Tappable>
            <Tappable style={styles.startBtn} onPress={() => {
              setSelectedDay(null);
              setCompactMode(false);
              onStartWorkout && onStartWorkout({ ...servedDay, trainingExperience: profile?.trainingExperience });
            }}>
              <Text style={styles.startBtnText}>{t('program.start')}</Text>
            </Tappable>
          </View>
          {(() => { const [label, sub] = selectedDay.name.split(' — '); return (<>
            <Text style={styles.title}>{label}</Text>
            {sub && <Text style={styles.titleSub}>{sub}</Text>}
          </>); })()}
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Compact toggle. Sits above the day so the set counts below it visibly
              change when it flips — the trim is the point, and a toggle parked at
              the bottom of a long list would hide its own effect. Same copy and
              behaviour as Today's, because it is the same decision. */}
          {compactSelectedDay && (
          <Tappable
            style={[styles.compactToggle, compactMode && styles.compactToggleOn]}
            onPress={() => { animateLayout(); setCompactMode(v => !v); }}
            accessibilityRole="switch"
            accessibilityState={{ checked: compactMode }}
            accessibilityLabel={t('today.compact.a11y', { defaultValue: 'Compact mode — trim this session' })}
          >
            <View style={styles.compactToggleText}>
              <Text style={[styles.compactTitle, compactMode && styles.compactTitleOn]}>
                {t('today.compact.on', { defaultValue: 'Compact mode' })}
              </Text>
              <Text style={styles.compactSub}>
                {compactMode
                  ? t('today.compact.subOn', { defaultValue: 'Same exercises, fewer sets. Keep the weight and push the last set of each.' })
                  : t('today.compact.subOff', { defaultValue: 'Short on time? Cut to the minimum that still counts toward your week.' })}
              </Text>
            </View>
            {dayMins.compact > 0 && (
              <View style={[styles.compactBadge, compactMode && styles.compactBadgeOn]}>
                <Text style={[styles.compactBadgeText, compactMode && styles.compactBadgeTextOn]}>
                  {t('today.compact.duration', {
                    mins: compactMode ? dayMins.compact : dayMins.full,
                    defaultValue: '~{{mins}} min',
                  })}
                </Text>
              </View>
            )}
          </Tappable>
          )}

          <View style={styles.scienceCard}>
            <Text style={styles.scienceLabel}>{t('program.scienceBasis')}</Text>
            <Text style={styles.scienceText}>{program.science_basis}</Text>
          </View>
          {servedDay.focus && (
            <View style={styles.focusCard}>
              <Text style={styles.focusText}>{servedDay.focus}</Text>
            </View>
          )}
          {servedDay.exercises.map((ex, i) => (
            <ExerciseCard key={i} ex={ex} isSimple={profile?.trainingExperience === 'beginner'} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── MAIN VIEW ─────────────────────────────────────────────────────────────
  const warnings = (program.warnings || []).filter(w => w.type !== 'volume');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <View style={styles.headerNav}>
            <Text style={styles.title}>{t('program.myProgram')}</Text>
            <Tappable style={styles.changeSplitBtn} onPress={() => setSelectingDays(true)}>
              <Text style={styles.changeSplitBtnText}>{t('program.changeSplit')}</Text>
            </Tappable>
          </View>
        </View>

        <View style={styles.programCard}>
          {/* Session sequence with rest intervals */}
          <View style={styles.programNameRow}>
            <Text style={styles.programName}>{program.name}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={styles.sessionSequence}>
              {program.days.filter(d => !d.optional).map((day, i) => {
                const rest = program.rest_between?.[i];
                const isLast = i === program.days.filter(d => !d.optional).length - 1;
                return (
                  <View key={day.id || day.name} style={styles.sessionSequenceItem}>
                    <View style={styles.sessionDayPill}>
                      <Text style={styles.sessionDayNum}>{t('program.dayNum', { n: i + 1 })}</Text>
                      <Text style={styles.sessionDayName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{day.name.split('—')[0].trim()}</Text>
                    </View>
                    {!isLast && (
                      <View style={styles.restArrow}>
                        <View style={styles.restArrowLine} />
                        {rest > 0 && (
                          <Text style={styles.restArrowLabel}>
                            {t('program.restCount', { count: rest })}
                          </Text>
                        )}
                        <View style={styles.restArrowLine} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.programMeta}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{t('program.daysPerWeek', { days: program.days_per_week })}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{program.session_time}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {program.level ? t(`levels.${program.level}`, { defaultValue: program.level }) : ''}
              </Text>
            </View>
          </View>

          {/* Info accordion chips */}
          {(() => {
            const primaryGoal = profile?.goals?.[0];
            const gp = primaryGoal ? GOAL_PARAMETERS[primaryGoal] : null;
            const tabs = [
              { key: 'research', label: t('program.tabs.research') },
              ...(gp ? [{ key: 'goal', label: t('program.tabs.goal') }] : []),
              { key: 'progression', label: t('program.tabs.progression') },
            ];
            return (
              <View style={styles.infoAccordion}>
                <View style={styles.infoTabRow}>
                  {tabs.map(tab => (
                    <Tappable
                      key={tab.key}
                      style={[styles.infoTab, openInfo === tab.key && styles.infoTabActive]}
                      onPress={() => setOpenInfo(openInfo === tab.key ? null : tab.key)}
                      accessibilityState={{ selected: openInfo === tab.key }}
                    >
                      <Text style={[styles.infoTabText, openInfo === tab.key && styles.infoTabTextActive]}>
                        {tab.label} {openInfo === tab.key ? '▲' : '▼'}
                      </Text>
                    </Tappable>
                  ))}
                </View>

                {openInfo === 'research' && (
                  <View style={styles.infoPanel}>
                    <Text style={styles.infoPanelText}>{program.science_basis}</Text>
                    {program.honest_note ? (
                      <Text style={[styles.infoPanelText, { color: colors.textSubtle, fontStyle: 'italic', marginTop: 8 }]}>
                        {program.honest_note}
                      </Text>
                    ) : null}
                  </View>
                )}

                {openInfo === 'goal' && gp && (
                  <View style={styles.infoPanel}>
                    <Text style={styles.infoPanelLabel}>{gp.label}</Text>
                    <Text style={styles.infoPanelText}>{gp.key_finding}</Text>
                    <Text style={styles.infoPanelCitation}>{gp.citation}</Text>
                    <View style={styles.goalParamsRow}>
                      <View style={styles.goalParam}><Text style={styles.goalParamVal}>{gp.frequency}</Text><Text style={styles.goalParamLabel}>{t('program.goalParams.frequency')}</Text></View>
                      <View style={styles.goalParam}><Text style={styles.goalParamVal}>{gp.rep_range}</Text><Text style={styles.goalParamLabel}>{t('program.goalParams.repRange')}</Text></View>
                      <View style={styles.goalParam}><Text style={styles.goalParamVal}>{gp.intensity}</Text><Text style={styles.goalParamLabel}>{t('program.goalParams.intensity')}</Text></View>
                    </View>
                  </View>
                )}

                {openInfo === 'progression' && (
                  <View style={styles.infoPanel}>
                    <Text style={styles.infoPanelText}>{program.progression}</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </View>

        {warnings.length > 0 && (
          <View style={styles.warningsSection}>
            {warnings.map((w, i) => {
              const color = w.level === 'high' ? colors.danger
                : w.level === 'success' ? colors.accent
                : w.level === 'medium' ? colors.warning : colors.textPrimary;
              const label = w.level === 'success' ? t('program.warnings.optimal')
                : w.level === 'high' ? t('program.warnings.warning')
                : w.level === 'medium' ? t('program.warnings.note') : t('program.warnings.info');
              return (
                <View key={i} style={[styles.warningCard, { borderColor: color }]}>
                  <View style={styles.warningHeader}>
                    <View style={[styles.warningBadge, { backgroundColor: color + '22' }]}>
                      <Text style={[styles.warningBadgeText, { color }]}>{label}</Text>
                    </View>
                    <Text style={styles.warningTitle}>{w.title}</Text>
                  </View>
                  <Text style={styles.warningMessage}>{w.message}</Text>
                  {w.source ? <Text style={styles.warningSource}>{w.source}</Text> : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.daysSection}>
          <Text style={styles.sectionTitle}>{t('program.workouts')}</Text>
          {program.days.filter(d => !d.optional).map((day, i) => (
            <Tappable key={i} style={styles.dayCard} onPress={() => setSelectedDay(day)}>
              <View style={styles.dayCardLeft}>
                <Text style={styles.dayCardName}>{day.name}</Text>
                <Text style={styles.dayCardFocus}>{day.focus}</Text>
                <Text style={styles.dayCardCount}>{t('program.exercises', { count: day.exercises.length })}</Text>
              </View>
              <Text style={styles.dayCardArrow} accessibilityElementsHidden importantForAccessibility="no">›</Text>
            </Tappable>
          ))}
        </View>

        {program.days.some(d => d.optional) && (
          <View style={styles.optionalSection}>
            <View style={styles.optionalSectionHeader}>
              <View style={styles.optionalDivider} />
              <Text style={styles.optionalSectionTitle}>{t('program.optionalDay')}</Text>
              <View style={styles.optionalDivider} />
            </View>
            {program.days.filter(d => d.optional).map((day, i) => (
              <Tappable key={i} style={styles.dayCardOptional} onPress={() => setSelectedDay(day)}>
                <View style={styles.dayCardLeft}>
                  <Text style={styles.dayCardName}>{day.name}</Text>
                  <Text style={styles.dayCardFocusOptional}>{day.focus}</Text>
                  {day.tip && <Text style={styles.dayCardTip}>{day.tip}</Text>}
                  <Text style={styles.dayCardCount}>{t('program.exercises', { count: day.exercises.length })}</Text>
                </View>
                <Text style={styles.dayCardArrow} accessibilityElementsHidden importantForAccessibility="no">›</Text>
              </Tappable>
            ))}
          </View>
        )}


      </ScrollView>
    </SafeAreaView>
  );
}

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────
const MUSCLE_COLORS = {
  'Chest': colors.danger, 'Upper chest': colors.danger, 'Lower chest': colors.danger,
  'Back': colors.textPrimary, 'Lats': colors.textPrimary, 'Traps': colors.textPrimary,
  'Shoulders': colors.textMuted, 'Side deltoids': colors.textMuted, 'Rear deltoids': colors.textMuted,
  'Biceps': colors.accent, 'Brachialis': colors.accent,
  'Triceps': colors.warning,
  'Quads': colors.textMuted, 'Hamstrings': colors.textMuted, 'Glutes': colors.textMuted, 'Calves': colors.textMuted,
  'Abs': colors.textSubtle, 'Core': colors.textSubtle,
};

function getMuscleColor(muscles) {
  if (!muscles) return colors.textPrimary;
  const first = muscles.split(',')[0].trim();
  return MUSCLE_COLORS[first] || colors.textPrimary;
}

function ExerciseCard({ ex, isSimple = false }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // This screen lists every exercise in the whole program at once — fetch the
  // gif only once a row is actually opened, not for all of them up front.
  const [gifUrl, setGifUrl] = useState(null);
  useEffect(() => {
    let live = true;
    if (expanded && ex.name) {
      getExerciseGif(ex.name).then(url => { if (live) setGifUrl(url); });
    }
    return () => { live = false; };
  }, [expanded, ex.name]);
  const borderColor = getMuscleColor(ex.muscles);
  return (
    <View style={styles.exCard}>
      <Tappable onPress={() => { animateLayout(); setExpanded(!expanded); }} accessibilityState={{ expanded }}>
        <View style={styles.exHeader}>
          <View style={styles.exTitleWrap}>
            <View style={[styles.muscleDot, { backgroundColor: borderColor }]} />
            {/* Preview without having to expand the row first. The larger gif
                still sits inside the expanded section for anyone reading the
                technique notes; this is so the list is scannable by shape. */}
            <ExerciseGifThumb name={ex.name} size={38} />
            <Text style={styles.exName}>{ex.name}</Text>
          </View>
          <View style={[styles.catBadge, ex.category?.includes('Isolation') && styles.catBadgeIso]}>
            <Text style={styles.catBadgeText} numberOfLines={1}>{ex.category}</Text>
          </View>
        </View>
        <Text style={styles.muscleText}>{ex.muscles}</Text>
        <View style={styles.prescriptionRow}>
          <View style={styles.prescriptionBox}>
            <Text style={styles.prescriptionVal}>{ex.sets}</Text>
            <Text style={styles.prescriptionLabel}>{t('program.sets')}</Text>
          </View>
          <View style={styles.prescriptionBox}>
            <Text style={styles.prescriptionVal}>{ex.reps}</Text>
            <Text style={styles.prescriptionLabel}>{t('program.reps')}</Text>
          </View>
          <View style={styles.prescriptionBox}>
            <Text style={styles.prescriptionVal}>{ex.rest}</Text>
            <Text style={styles.prescriptionLabel}>{t('program.restLabel')}</Text>
          </View>
        </View>
        <View style={styles.rpeRow}>
          <View style={styles.rpeBox}>
            <Text style={styles.rpeBadge}>{t('program.earlyRpe', { rpe: ex.early_rpe })}</Text>
          </View>
          <View style={styles.rpeBox}>
            <Text style={[styles.rpeBadge, styles.rpeLast]}>{t('program.lastRpe', { rpe: ex.last_rpe })}</Text>
          </View>
        </View>
        {(ex.sub1 || ex.sub2 || ex.sub3) && (
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>{t('program.substitutes')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 }}>
              {[
                { name: ex.sub1, equip: ex.sub1_equipment },
                { name: ex.sub2, equip: ex.sub2_equipment },
                { name: ex.sub3, equip: null },
              ].filter(s => s.name).map((s, i) => (
                <View key={i} style={styles.subChip}>
                  <Text style={styles.subChipText}>{s.name}</Text>
                  {s.equip && <Text style={styles.subChipEquip}> · {s.equip}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}
        {(ex.research_note || ex.cues?.length > 0) && (
          <Text style={styles.expandHint}>
            {expanded
              ? t('program.hideDetails')
              : isSimple ? t('program.learnSimple') : t('program.showTechnique')}
          </Text>
        )}
      </Tappable>
      {expanded && (
        <View style={styles.expandedSection}>
          {gifUrl && (
            <View style={styles.gifSection}>
              <Image source={{ uri: gifUrl }} style={styles.gif} contentFit="contain" autoplay />
            </View>
          )}
          {(() => {
            const insight = getExerciseInsight(ex);
            return insight ? (
              <View style={{ backgroundColor: colors.accentSoft, borderRadius: 10, borderWidth: 1, borderColor: colors.accentHair, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 13.5, lineHeight: 20, fontWeight: '500' }}>{insight.insight}</Text>
                {insight.metric && <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 6 }}>{insight.metric.this} vs {insight.metric.control} · {insight.metric.method}</Text>}
                <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 6 }}>{insight.cite}</Text>
              </View>
            ) : null;
          })()}
          {ex.study && <StudyChart study={ex.study} />}
          {ex.research_note && (
            <View style={styles.researchNote}>
              <Text style={styles.scienceLabel}>{isSimple ? t('program.whatDoesThisDo') : t('program.whyExercise')}</Text>
              <Text style={styles.researchNoteText}>{ex.research_note}</Text>
            </View>
          )}
          {ex.cues?.length > 0 && (
            <View style={styles.cuesSection}>
              <Text style={styles.scienceLabel}>{t('program.techniqueCues')}</Text>
              {ex.cues.map((cue, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={styles.cueDot}>•</Text>
                  <Text style={styles.cueText}>{cue}</Text>
                </View>
              ))}
            </View>
          )}
          {ex.progression_path?.length > 0 && (
            <View style={styles.cuesSection}>
              <Text style={styles.scienceLabel}>{t('program.progressionPath')}</Text>
              {ex.progression_path.map((step, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={styles.cueDot}>{i + 1}.</Text>
                  <Text style={styles.cueText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 20, paddingTop: 16 },
  headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, minHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  titleSub: { fontSize: 12, color: colors.textFaint, marginTop: 2 },
  backBtnWrapper: { paddingVertical: 8, paddingRight: 12 },
  backBtn: { fontSize: 15, color: colors.textPrimary },
  startBtn: { backgroundColor: colors.surfaceInverse, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  startBtnText: { color: colors.surfaceRaised, fontSize: 14, fontWeight: '600' },
  changeSplitBtn: { backgroundColor: colors.surfaceElevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0.5, borderColor: colors.border },
  changeSplitBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textSubtle, fontSize: 15 },

  // Split selector
  selectorLabel: { fontSize: 13, color: colors.textSubtle, fontWeight: '500', marginBottom: 12, marginTop: 8 },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dayBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  dayBtnActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderActive },
  dayBtnText: { fontSize: 16, fontWeight: '700', color: colors.textSubtle },
  dayBtnTextActive: { color: colors.textSecondary },
  goalContext: { fontSize: 12, color: colors.textSubtle, fontStyle: 'italic', marginBottom: 16 },
  splitCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: colors.border },
  splitCardActive: { borderColor: '#FFFFFF55' },
  splitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  splitCardLeft: { flex: 1 },
  rankBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  rankBadgeText: { fontSize: 11, fontWeight: '600' },
  splitName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  activeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceInverse, alignItems: 'center', justifyContent: 'center' },
  activeCheckText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  // Same footprint as activeCheck so the card header does not shift between a
  // selected, locked and plain split.
  lockChip: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  splitMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metaChip: { backgroundColor: colors.control, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: colors.borderStrong },
  metaChipText: { fontSize: 12, color: colors.textMuted },
  whyCard: { backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#FFFFFF0D' },
  whyLabel: { fontSize: 10, color: colors.textPrimary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  whyText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  honestNoteText: { fontSize: 12, color: colors.textSubtle, lineHeight: 18, marginBottom: 12, fontStyle: 'italic' },
  cautionBox: {
    backgroundColor: colors.warningSoft ?? 'rgba(227,162,61,0.12)',
    borderWidth: 0.5, borderColor: colors.warning,
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  cautionText: { fontSize: 12, color: colors.warning, lineHeight: 18 },
  splitDays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  splitDayChip: { backgroundColor: colors.control, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  splitDayChipText: { fontSize: 11, color: colors.textMuted },
  selectSplitBtn: { backgroundColor: colors.control, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  selectSplitBtnActive: { backgroundColor: colors.surfaceInverse },
  selectSplitBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSubtle },
  selectSplitBtnTextActive: { color: colors.surfaceRaised },

  // Program card
  programCard: { marginHorizontal: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: colors.border, marginBottom: 16 },
  programName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  programNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sessionSequence: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  sessionSequenceItem: { flexDirection: 'row', alignItems: 'center' },
  sessionDayPill: { backgroundColor: colors.surfaceElevated, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', minWidth: 64 },
  sessionDayNum: { fontSize: 9, color: colors.textPrimary, fontWeight: '700', letterSpacing: 0.5 },
  sessionDayName: { fontSize: 11, color: colors.textPrimary, fontWeight: '600', marginTop: 2, maxWidth: 80 },
  restArrow: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  restArrowLine: { width: 1, height: 6, backgroundColor: colors.borderStrong },
  restArrowLabel: { fontSize: 9, color: colors.textFaint, fontWeight: '500', textAlign: 'center' },
  programMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoAccordion: { marginTop: 4 },
  infoTabRow: { flexDirection: 'row', gap: 6, marginBottom: 0 },
  infoTab: { flex: 1, backgroundColor: colors.surfaceInset, borderRadius: 8, paddingVertical: 7, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  infoTabActive: { backgroundColor: colors.surfaceElevated, borderColor: '#FFFFFF44' },
  infoTabText: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  infoTabTextActive: { color: colors.textSecondary },
  infoPanel: { backgroundColor: colors.surfaceInset, borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 0.5, borderColor: colors.border },
  infoPanelLabel: { fontSize: 10, color: colors.textPrimary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  infoPanelText: { fontSize: 12, color: colors.textMuted, lineHeight: 19 },
  infoPanelCitation: { fontSize: 10, color: colors.textFaint, fontStyle: 'italic', marginTop: 6, marginBottom: 10 },
  scienceCard: { backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: colors.border, marginBottom: 20 },
  scienceCardSmall: { backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.border, marginBottom: 10 },
  honestNoteCard: { backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.warning, marginBottom: 12 },
  goalResearchCard: { backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.accentHair, marginBottom: 10 },
  citationText: { fontSize: 10, color: colors.textSubtle, fontStyle: 'italic', marginTop: 6, marginBottom: 10 },
  goalParamsRow: { flexDirection: 'row', gap: 6 },
  goalParam: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8, alignItems: 'center' },
  goalParamVal: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, textAlign: 'center', marginBottom: 2 },
  goalParamLabel: { fontSize: 9, color: colors.textSubtle, textAlign: 'center' },
  scienceLabel: { fontSize: 10, color: colors.textPrimary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  scienceText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  scienceTextSmall: { fontSize: 12, color: colors.textSubtle, lineHeight: 18 },
  progressionLabel: { fontSize: 11, color: colors.textSubtle, fontWeight: '500', marginBottom: 4 },
  progressionText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  focusCard: { backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.border, marginBottom: 16 },
  focusText: { fontSize: 13, color: colors.textSecondary },

  // Compact mode toggle. Deliberately identical to the Today screen's — it is
  // the same control on the same decision, and two visual treatments would read
  // as two different features.
  compactToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
    backgroundColor: colors.surfaceInset, borderRadius: 10, padding: 12,
    borderWidth: 0.5, borderColor: colors.border,
  },
  compactToggleOn: { backgroundColor: colors.accentSoft, borderColor: colors.accentHair },
  compactToggleText: { flex: 1, gap: 2 },
  compactTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  compactTitleOn: { color: colors.accent },
  compactSub: { fontSize: 13, lineHeight: 19, color: colors.textSubtle },
  compactBadge: {
    backgroundColor: colors.surfaceRaised, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.5, borderColor: colors.border,
  },
  compactBadgeOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  compactBadgeText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  compactBadgeTextOn: { color: colors.surfaceRaised },

  // Warnings
  warningsSection: { paddingHorizontal: 20, marginBottom: 8 },
  warningCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 0.5, marginBottom: 10 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  warningBadgeText: { fontSize: 11, fontWeight: '600' },
  warningTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  warningMessage: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 6 },
  warningSource: { fontSize: 10, color: colors.textSubtle, fontStyle: 'italic' },

  // Schedule
  scheduleSection: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  scheduleDay: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: colors.border },
  scheduleDayActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderActive },
  scheduleDayText: { fontSize: 11, color: colors.textSubtle, fontWeight: '600' },
  scheduleDayTextActive: { color: colors.textPrimary },
  scheduleLabel: { fontSize: 14, color: colors.textMuted },

  // Day cards
  daysSection: { paddingHorizontal: 20, marginBottom: 24 },
  dayCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardOptional: { backgroundColor: colors.bg, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardLeft: { flex: 1 },
  dayCardName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  dayCardFocus: { fontSize: 12, color: colors.textPrimary, marginBottom: 4 },
  dayCardFocusOptional: { fontSize: 12, color: colors.textMuted, marginBottom: 4, fontStyle: 'italic' },
  dayCardTip: { fontSize: 11, color: colors.warning, marginBottom: 4 },
  dayCardCount: { fontSize: 13, color: colors.textSubtle },
  dayCardArrow: { fontSize: 22, color: colors.textFaint },
  optionalSection: { paddingHorizontal: 20, marginBottom: 24 },
  optionalSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  optionalSectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1.2 },
  optionalDivider: { flex: 1, height: 1, backgroundColor: '#FFFFFF22' },
  optionalBadge: { backgroundColor: '#1E1A3A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.border },
  optionalBadgeText: { fontSize: 9, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.5 },

  // Exercise card
  exCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  exTitleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 8 },
  muscleDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  exName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  catBadge: { backgroundColor: colors.surfaceElevated, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 1, maxWidth: '60%' },
  catBadgeIso: { backgroundColor: colors.successBg },
  catBadgeText: { fontSize: 10, color: colors.textSecondary, fontWeight: '500' },
  muscleText: { fontSize: 12, color: colors.textSubtle, marginBottom: 12 },
  prescriptionRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  prescriptionBox: { flex: 1, backgroundColor: colors.control, borderRadius: 8, padding: 8, alignItems: 'center' },
  prescriptionVal: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  prescriptionLabel: { fontSize: 9, color: colors.textSubtle, marginTop: 2, textAlign: 'center' },
  rpeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  rpeBox: { flex: 1 },
  rpeBadge: { fontSize: 12, color: colors.textSubtle, backgroundColor: colors.control, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, textAlign: 'center' },
  rpeLast: { color: colors.textPrimary },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8, gap: 4 },
  subLabel: { fontSize: 11, color: colors.textSubtle, fontWeight: '500', marginTop: 2 },
  subText: { fontSize: 11, color: colors.textPrimary },
  subChip: { flexDirection: 'row', flexShrink: 1, backgroundColor: colors.surfaceInset, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 0.5, borderColor: colors.border },
  subChipText: { fontSize: 11, color: colors.textMuted, flexShrink: 1, flexWrap: 'wrap' },
  subChipEquip: { fontSize: 11, color: colors.textPrimary, flexShrink: 0 },
  expandHint: { fontSize: 11, color: colors.textFaint, marginTop: 8, textAlign: 'right' },
  expandedSection: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 14 },
  gifSection: { borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceRaised, borderWidth: 0.5, borderColor: colors.border, marginBottom: 12 },
  gif: { width: '100%', aspectRatio: 1 },
  researchNote: { backgroundColor: colors.surfaceRaised, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: colors.border, marginBottom: 12 },
  researchNoteText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  cuesSection: { marginBottom: 12 },
  cueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  cueDot: { fontSize: 12, color: colors.textPrimary, width: 14 },
  cueText: { fontSize: 12, color: colors.textMuted, lineHeight: 18, flex: 1 },
});