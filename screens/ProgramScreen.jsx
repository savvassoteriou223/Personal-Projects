import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { supabase, getCurrentUser } from '../supabase';
import { generateProgram, getRankedSplits, SPLITS } from './programGenerator';
import { GOAL_PARAMETERS } from './scienceEngine';
import StudyChart from './StudyChart';
import { getExerciseInsight } from './studiesLibrary';

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const OPTIMALITY_COLORS = {
  optimal:    '#1D9E75',
  good:       '#BA7517',
  suboptimal: '#E85D5C',
};

const RANK_KEYS = ['rankBest', 'rank2', 'rank3'];

export default function ProgramScreen({ onStartWorkout, onSplitChanged, previewDay, onClose }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectingDays, setSelectingDays] = useState(false);
  const [draftDays, setDraftDays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openInfo, setOpenInfo] = useState(null); // 'research' | 'goal' | 'progression'

  useFocusEffect(useCallback(() => { loadProgram(); }, []));

  const loadProgram = async () => {
    const user = await getCurrentUser();
    if (!user) { setLoading(false); return; }
    const [{ data: prof }, { data: block }] = await Promise.all([
      supabase.from('profiles').select('weekly_workouts, session_length, goals, name, equipment, selected_split, trainingExperience').eq('id', user.id).single(),
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
    onSplitChanged && onSplitChanged();
  };

  // ─── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (previewDay) {
    const [previewLabel, previewSub] = previewDay.name.split(' — ');
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerNav}>
            <Pressable onPress={onClose} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← {t('common.back')}</Text>
            </Pressable>
            <Pressable style={styles.startBtn} onPress={() => onStartWorkout({ ...previewDay, trainingExperience: profile?.trainingExperience })}>
              <Text style={styles.startBtnText}>{t('program.start')}</Text>
            </Pressable>
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
    const rankedSplits = getRankedSplits(draftDays, profile?.goals || []);

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerNav}>
            <Pressable onPress={() => setSelectingDays(false)} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← {t('common.back')}</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>{t('program.chooseSplit')}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text style={styles.selectorLabel}>{t('program.daysQuestion')}</Text>
          <View style={styles.daysRow}>
            {DAYS_OPTIONS.map(d => (
              <Pressable
                key={d}
                style={[styles.dayBtn, draftDays === d && styles.dayBtnActive]}
                onPress={() => setDraftDays(d)}
              >
                <Text style={[styles.dayBtnText, draftDays === d && styles.dayBtnTextActive]}>{d}</Text>
              </Pressable>
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
              const optColor = OPTIMALITY_COLORS[split.optimality] || '#FFFFFF';

              return (
                <View key={split.id} style={[styles.splitCard, isActive && styles.splitCardActive]}>
                  <View style={styles.splitCardTop}>
                    <View style={styles.splitCardLeft}>
                      <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#FFFFFF0D' : '#2C2C35' }]}>
                        <Text style={[styles.rankBadgeText, { color: i === 0 ? '#E4E4E8' : '#9494A0' }]}>
                          {RANK_KEYS[i] ? t(`program.${RANK_KEYS[i]}`) : t('program.rankN', { n: i + 1 })}
                        </Text>
                      </View>
                      <Text style={styles.splitName}>{split.name}</Text>
                    </View>
                    {isActive && (
                      <View style={styles.activeCheck}>
                        <Text style={styles.activeCheckText}>{t('common.done')}</Text>
                      </View>
                    )}
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

                  <Text style={styles.honestNoteText}>{split.honest_note}</Text>

                  <View style={styles.splitDays}>
                    {split.day_structure.map((d, j) => (
                      <View key={j} style={styles.splitDayChip}>
                        <Text style={styles.splitDayChipText}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    style={[styles.selectSplitBtn, isActive && styles.selectSplitBtnActive]}
                    onPress={() => saveSplitChoice(split.id, draftDays)}
                  >
                    <Text style={[styles.selectSplitBtnText, isActive && styles.selectSplitBtnTextActive]}>
                      {isActive ? t('program.currentSplit') : t('program.selectSplit')}
                    </Text>
                  </Pressable>
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
            <Pressable onPress={() => setSelectedDay(null)} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← {t('common.back')}</Text>
            </Pressable>
            <Pressable style={styles.startBtn} onPress={() => {
              setSelectedDay(null);
              onStartWorkout && onStartWorkout({ ...selectedDay, trainingExperience: profile?.trainingExperience });
            }}>
              <Text style={styles.startBtnText}>{t('program.start')}</Text>
            </Pressable>
          </View>
          {(() => { const [label, sub] = selectedDay.name.split(' — '); return (<>
            <Text style={styles.title}>{label}</Text>
            {sub && <Text style={styles.titleSub}>{sub}</Text>}
          </>); })()}
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <View style={styles.scienceCard}>
            <Text style={styles.scienceLabel}>{t('program.scienceBasis')}</Text>
            <Text style={styles.scienceText}>{program.science_basis}</Text>
          </View>
          {selectedDay.focus && (
            <View style={styles.focusCard}>
              <Text style={styles.focusText}>{selectedDay.focus}</Text>
            </View>
          )}
          {selectedDay.exercises.map((ex, i) => (
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
            <Pressable style={styles.changeSplitBtn} onPress={() => setSelectingDays(true)}>
              <Text style={styles.changeSplitBtnText}>{t('program.changeSplit')}</Text>
            </Pressable>
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
                    <Pressable
                      key={tab.key}
                      style={[styles.infoTab, openInfo === tab.key && styles.infoTabActive]}
                      onPress={() => setOpenInfo(openInfo === tab.key ? null : tab.key)}
                    >
                      <Text style={[styles.infoTabText, openInfo === tab.key && styles.infoTabTextActive]}>
                        {tab.label} {openInfo === tab.key ? '▲' : '▼'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {openInfo === 'research' && (
                  <View style={styles.infoPanel}>
                    <Text style={styles.infoPanelText}>{program.science_basis}</Text>
                    {program.honest_note ? (
                      <Text style={[styles.infoPanelText, { color: '#9494A0', fontStyle: 'italic', marginTop: 8 }]}>
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
              const color = w.level === 'high' ? '#E85D5C'
                : w.level === 'success' ? '#1D9E75'
                : w.level === 'medium' ? '#BA7517' : '#FFFFFF';
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
            <Pressable key={i} style={styles.dayCard} onPress={() => setSelectedDay(day)}>
              <View style={styles.dayCardLeft}>
                <Text style={styles.dayCardName}>{day.name}</Text>
                <Text style={styles.dayCardFocus}>{day.focus}</Text>
                <Text style={styles.dayCardCount}>{t('program.exercises', { count: day.exercises.length })}</Text>
              </View>
              <Text style={styles.dayCardArrow}>›</Text>
            </Pressable>
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
              <Pressable key={i} style={styles.dayCardOptional} onPress={() => setSelectedDay(day)}>
                <View style={styles.dayCardLeft}>
                  <Text style={styles.dayCardName}>{day.name}</Text>
                  <Text style={styles.dayCardFocusOptional}>{day.focus}</Text>
                  {day.tip && <Text style={styles.dayCardTip}>{day.tip}</Text>}
                  <Text style={styles.dayCardCount}>{t('program.exercises', { count: day.exercises.length })}</Text>
                </View>
                <Text style={styles.dayCardArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}


      </ScrollView>
    </SafeAreaView>
  );
}

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────
const MUSCLE_COLORS = {
  'Chest': '#E85D5C', 'Upper chest': '#E85D5C', 'Lower chest': '#E85D5C',
  'Back': '#FFFFFF', 'Lats': '#FFFFFF', 'Traps': '#FFFFFF',
  'Shoulders': '#A1A1AA', 'Side deltoids': '#A1A1AA', 'Rear deltoids': '#A1A1AA',
  'Biceps': '#1D9E75', 'Brachialis': '#1D9E75',
  'Triceps': '#BA7517',
  'Quads': '#A1A1AA', 'Hamstrings': '#A1A1AA', 'Glutes': '#A1A1AA', 'Calves': '#A1A1AA',
  'Abs': '#9494A0', 'Core': '#9494A0',
};

function getMuscleColor(muscles) {
  if (!muscles) return '#FFFFFF';
  const first = muscles.split(',')[0].trim();
  return MUSCLE_COLORS[first] || '#FFFFFF';
}

function ExerciseCard({ ex, isSimple = false }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const borderColor = getMuscleColor(ex.muscles);
  return (
    <View style={[styles.exCard, { borderLeftColor: borderColor, borderLeftWidth: 3 }]}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.exHeader}>
          <Text style={styles.exName}>{ex.name}</Text>
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
      </Pressable>
      {expanded && (
        <View style={styles.expandedSection}>
          {(() => {
            const insight = getExerciseInsight(ex);
            return insight ? (
              <View style={{ backgroundColor: '#1D9E7514', borderRadius: 10, borderWidth: 1, borderColor: '#1D9E7540', borderLeftWidth: 3, borderLeftColor: '#1D9E75', padding: 12, marginBottom: 12 }}>
                <Text style={{ color: '#F1F0F5', fontSize: 13.5, lineHeight: 20, fontWeight: '500' }}>{insight.insight}</Text>
                {insight.metric && <Text style={{ color: '#1D9E75', fontSize: 12, fontWeight: '700', marginTop: 6 }}>{insight.metric.this} vs {insight.metric.control} · {insight.metric.method}</Text>}
                <Text style={{ color: '#8A8A94', fontSize: 11, marginTop: 6 }}>{insight.cite}</Text>
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
  container: { flex: 1, backgroundColor: '#0F0F13' },
  header: { padding: 20, paddingTop: 16 },
  headerNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, minHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  titleSub: { fontSize: 12, color: '#8A8A94', marginTop: 2 },
  backBtnWrapper: { paddingVertical: 8, paddingRight: 12 },
  backBtn: { fontSize: 15, color: '#FFFFFF' },
  startBtn: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  startBtnText: { color: '#111114', fontSize: 14, fontWeight: '600' },
  changeSplitBtn: { backgroundColor: '#1C1C22', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0.5, borderColor: '#FFFFFF' },
  changeSplitBtnText: { color: '#E4E4E8', fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9494A0', fontSize: 15 },

  // Split selector
  selectorLabel: { fontSize: 13, color: '#9494A0', fontWeight: '500', marginBottom: 12, marginTop: 8 },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dayBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  dayBtnActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  dayBtnText: { fontSize: 16, fontWeight: '700', color: '#9494A0' },
  dayBtnTextActive: { color: '#E4E4E8' },
  goalContext: { fontSize: 12, color: '#9494A0', fontStyle: 'italic', marginBottom: 16 },
  splitCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: '#2C2C35' },
  splitCardActive: { borderColor: '#FFFFFF55' },
  splitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  splitCardLeft: { flex: 1 },
  rankBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  rankBadgeText: { fontSize: 11, fontWeight: '600' },
  splitName: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  activeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  activeCheckText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  splitMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metaChip: { backgroundColor: '#2C2C35', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: '#3D3D4A' },
  metaChipText: { fontSize: 12, color: '#A1A1AA' },
  whyCard: { backgroundColor: '#111114', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#FFFFFF0D' },
  whyLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  whyText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  honestNoteText: { fontSize: 12, color: '#9494A0', lineHeight: 18, marginBottom: 12, fontStyle: 'italic' },
  splitDays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  splitDayChip: { backgroundColor: '#2C2C35', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  splitDayChipText: { fontSize: 11, color: '#A1A1AA' },
  selectSplitBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  selectSplitBtnActive: { backgroundColor: '#FFFFFF' },
  selectSplitBtnText: { fontSize: 14, fontWeight: '600', color: '#9494A0' },
  selectSplitBtnTextActive: { color: '#111114' },

  // Program card
  programCard: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 16 },
  programName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1, marginRight: 8 },
  programNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sessionSequence: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  sessionSequenceItem: { flexDirection: 'row', alignItems: 'center' },
  sessionDayPill: { backgroundColor: '#1C1C22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 0.5, borderColor: '#FFFFFF', alignItems: 'center', minWidth: 64 },
  sessionDayNum: { fontSize: 9, color: '#FFFFFF', fontWeight: '700', letterSpacing: 0.5 },
  sessionDayName: { fontSize: 11, color: '#FFFFFF', fontWeight: '600', marginTop: 2, maxWidth: 80 },
  restArrow: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  restArrowLine: { width: 1, height: 6, backgroundColor: '#3D3D4A' },
  restArrowLabel: { fontSize: 9, color: '#8A8A94', fontWeight: '500', textAlign: 'center' },
  programMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoAccordion: { marginTop: 4 },
  infoTabRow: { flexDirection: 'row', gap: 6, marginBottom: 0 },
  infoTab: { flex: 1, backgroundColor: '#12121A', borderRadius: 8, paddingVertical: 7, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  infoTabActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF44' },
  infoTabText: { fontSize: 11, color: '#8A8A94', fontWeight: '600' },
  infoTabTextActive: { color: '#E4E4E8' },
  infoPanel: { backgroundColor: '#12121A', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  infoPanelLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  infoPanelText: { fontSize: 12, color: '#A1A1AA', lineHeight: 19 },
  infoPanelCitation: { fontSize: 10, color: '#8A8A94', fontStyle: 'italic', marginTop: 6, marginBottom: 10 },
  scienceCard: { backgroundColor: '#111114', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#FFFFFF', marginBottom: 20 },
  scienceCardSmall: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 10 },
  honestNoteCard: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#BA7517', marginBottom: 12 },
  goalResearchCard: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#1D9E7544', marginBottom: 10 },
  citationText: { fontSize: 10, color: '#9494A0', fontStyle: 'italic', marginTop: 6, marginBottom: 10 },
  goalParamsRow: { flexDirection: 'row', gap: 6 },
  goalParam: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 8, padding: 8, alignItems: 'center' },
  goalParamVal: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', marginBottom: 2 },
  goalParamLabel: { fontSize: 9, color: '#9494A0', textAlign: 'center' },
  scienceLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  scienceText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20 },
  scienceTextSmall: { fontSize: 12, color: '#9494A0', lineHeight: 18 },
  progressionLabel: { fontSize: 11, color: '#9494A0', fontWeight: '500', marginBottom: 4 },
  progressionText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20 },
  focusCard: { backgroundColor: '#1C1C22', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#FFFFFF', marginBottom: 16 },
  focusText: { fontSize: 13, color: '#E4E4E8' },

  // Warnings
  warningsSection: { paddingHorizontal: 20, marginBottom: 8 },
  warningCard: { backgroundColor: '#1A1A20', borderRadius: 12, padding: 14, borderWidth: 0.5, marginBottom: 10 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  warningBadgeText: { fontSize: 11, fontWeight: '600' },
  warningTitle: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  warningMessage: { fontSize: 12, color: '#A1A1AA', lineHeight: 18, marginBottom: 6 },
  warningSource: { fontSize: 10, color: '#9494A0', fontStyle: 'italic' },

  // Schedule
  scheduleSection: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  scheduleDay: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A20', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  scheduleDayActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  scheduleDayText: { fontSize: 11, color: '#9494A0', fontWeight: '600' },
  scheduleDayTextActive: { color: '#FFFFFF' },
  scheduleLabel: { fontSize: 14, color: '#A1A1AA' },

  // Day cards
  daysSection: { paddingHorizontal: 20, marginBottom: 24 },
  dayCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardOptional: { backgroundColor: '#0F0F1A', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#FFFFFF', borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardLeft: { flex: 1 },
  dayCardName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  dayCardFocus: { fontSize: 12, color: '#FFFFFF', marginBottom: 4 },
  dayCardFocusOptional: { fontSize: 12, color: '#A1A1AA', marginBottom: 4, fontStyle: 'italic' },
  dayCardTip: { fontSize: 11, color: '#BA7517', marginBottom: 4 },
  dayCardCount: { fontSize: 13, color: '#9494A0' },
  dayCardArrow: { fontSize: 22, color: '#8A8A94' },
  optionalSection: { paddingHorizontal: 20, marginBottom: 24 },
  optionalSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  optionalSectionTitle: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1.2 },
  optionalDivider: { flex: 1, height: 1, backgroundColor: '#FFFFFF22' },
  optionalBadge: { backgroundColor: '#1E1A3A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  optionalBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },

  // Exercise card
  exCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  exName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1, marginRight: 8 },
  catBadge: { backgroundColor: '#1C1C22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 1, maxWidth: '60%' },
  catBadgeIso: { backgroundColor: '#1A2215' },
  catBadgeText: { fontSize: 10, color: '#E4E4E8', fontWeight: '500' },
  muscleText: { fontSize: 12, color: '#9494A0', marginBottom: 12 },
  prescriptionRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  prescriptionBox: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 8, padding: 8, alignItems: 'center' },
  prescriptionVal: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  prescriptionLabel: { fontSize: 9, color: '#9494A0', marginTop: 2, textAlign: 'center' },
  rpeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  rpeBox: { flex: 1 },
  rpeBadge: { fontSize: 12, color: '#9494A0', backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, textAlign: 'center' },
  rpeLast: { color: '#FFFFFF' },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8, gap: 4 },
  subLabel: { fontSize: 11, color: '#9494A0', fontWeight: '500', marginTop: 2 },
  subText: { fontSize: 11, color: '#FFFFFF' },
  subChip: { flexDirection: 'row', flexShrink: 1, backgroundColor: '#12121A', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 0.5, borderColor: '#2C2C35' },
  subChipText: { fontSize: 11, color: '#A1A1AA', flexShrink: 1, flexWrap: 'wrap' },
  subChipEquip: { fontSize: 11, color: '#FFFFFF', flexShrink: 0 },
  expandHint: { fontSize: 11, color: '#8A8A94', marginTop: 8, textAlign: 'right' },
  expandedSection: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#2C2C35', paddingTop: 14 },
  researchNote: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#FFFFFF', marginBottom: 12 },
  researchNoteText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  cuesSection: { marginBottom: 12 },
  cueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  cueDot: { fontSize: 12, color: '#FFFFFF', width: 14 },
  cueText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18, flex: 1 },
});