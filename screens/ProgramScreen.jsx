import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, getCurrentUser } from '../supabase';
import { generateProgram, getRankedSplits, SPLITS } from './programGenerator';
import { GOAL_PARAMETERS } from './scienceEngine';
import StudyChart from './StudyChart';

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const OPTIMALITY_COLORS = {
  optimal:    '#1D9E75',
  good:       '#BA7517',
  suboptimal: '#E24B4A',
};

const RANK_LABELS = ['Best match', '2nd option', '3rd option'];

export default function ProgramScreen({ onStartWorkout, previewDay, onClose }) {
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
    if (error) { Alert.alert('Save failed', 'Could not update your program. Please try again.'); return; }
    const newProfile = { ...profile, selected_split: splitId, weekly_workouts: days };
    setProfile(newProfile);
    const { data: block } = await supabase.from('program_blocks').select('block_index, block_start_date').eq('user_id', user.id).maybeSingle();
    setProgram(generateProgram(newProfile, block?.block_index || 0, block?.block_start_date || null));
    setSelectingDays(false);
  };

  // ─── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (previewDay) {
    const [previewLabel, previewSub] = previewDay.name.split(' — ');
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerNav}>
            <Pressable onPress={onClose} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← Back</Text>
            </Pressable>
            <Pressable style={styles.startBtn} onPress={() => onStartWorkout(previewDay)}>
              <Text style={styles.startBtnText}>Start</Text>
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
              <Text style={styles.backBtn}>← Back</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Choose split</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text style={styles.selectorLabel}>How many days per week?</Text>
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
              Ranked for your goals: {profile.goals.join(', ')}
            </Text>
          )}

          <Text style={styles.selectorLabel}>Recommended splits</Text>

          {rankedSplits.length === 0 ? (
            <Text style={styles.emptyText}>No splits available.</Text>
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
                        <Text style={[styles.rankBadgeText, { color: i === 0 ? '#E4E4E8' : '#71717A' }]}>
                          {RANK_LABELS[i] || `Option ${i + 1}`}
                        </Text>
                      </View>
                      <Text style={styles.splitName}>{split.name}</Text>
                    </View>
                    {isActive && (
                      <View style={styles.activeCheck}>
                        <Text style={styles.activeCheckText}>Done</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.splitMeta}>
                    <View style={[styles.metaChip, { borderColor: optColor + '44' }]}>
                      <Text style={[styles.metaChipText, { color: optColor }]}>
                        {split.optimality.charAt(0).toUpperCase() + split.optimality.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{split.days}×/week</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{split.frequency_per_muscle}× freq/muscle</Text>
                    </View>
                    <View style={styles.metaChip}>
                      <Text style={styles.metaChipText}>{split.session_time_est}</Text>
                    </View>
                  </View>

                  <View style={styles.whyCard}>
                    <Text style={styles.whyLabel}>Why this split</Text>
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
                      {isActive ? 'Current split' : 'Select this split'}
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
      <View style={styles.header}><View style={styles.headerNav}><Text style={styles.title}>My Program</Text></View></View>
      <View style={styles.empty}><Text style={styles.emptyText}>Complete onboarding to get your program.</Text></View>
    </SafeAreaView>
  );

  // ─── DAY DETAIL ────────────────────────────────────────────────────────────
  if (selectedDay) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerNav}>
            <Pressable onPress={() => setSelectedDay(null)} style={styles.backBtnWrapper}>
              <Text style={styles.backBtn}>← Back</Text>
            </Pressable>
            <Pressable style={styles.startBtn} onPress={() => {
              setSelectedDay(null);
              onStartWorkout && onStartWorkout(selectedDay);
            }}>
              <Text style={styles.startBtnText}>Start</Text>
            </Pressable>
          </View>
          {(() => { const [label, sub] = selectedDay.name.split(' — '); return (<>
            <Text style={styles.title}>{label}</Text>
            {sub && <Text style={styles.titleSub}>{sub}</Text>}
          </>); })()}
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <View style={styles.scienceCard}>
            <Text style={styles.scienceLabel}>Science basis</Text>
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
            <Text style={styles.title}>My Program</Text>
            <Pressable style={styles.changeSplitBtn} onPress={() => setSelectingDays(true)}>
              <Text style={styles.changeSplitBtnText}>Change split</Text>
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
                      <Text style={styles.sessionDayNum}>Day {i + 1}</Text>
                      <Text style={styles.sessionDayName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{day.name.split('—')[0].trim()}</Text>
                    </View>
                    {!isLast && (
                      <View style={styles.restArrow}>
                        <View style={styles.restArrowLine} />
                        <Text style={styles.restArrowLabel}>
                          {rest === 0 ? 'next day' : rest === 1 ? '1 rest' : `${rest} rest`}
                        </Text>
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
              <Text style={styles.metaChipText}>{program.days_per_week} days/week</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{program.session_time}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {program.level ? program.level.charAt(0).toUpperCase() + program.level.slice(1) : ''}
              </Text>
            </View>
          </View>

          {/* Info accordion chips */}
          {(() => {
            const primaryGoal = profile?.goals?.[0];
            const gp = primaryGoal ? GOAL_PARAMETERS[primaryGoal] : null;
            const tabs = [
              { key: 'research', label: 'Research' },
              ...(gp ? [{ key: 'goal', label: 'Your goal' }] : []),
              { key: 'progression', label: 'Progression' },
            ];
            return (
              <View style={styles.infoAccordion}>
                <View style={styles.infoTabRow}>
                  {tabs.map(t => (
                    <Pressable
                      key={t.key}
                      style={[styles.infoTab, openInfo === t.key && styles.infoTabActive]}
                      onPress={() => setOpenInfo(openInfo === t.key ? null : t.key)}
                    >
                      <Text style={[styles.infoTabText, openInfo === t.key && styles.infoTabTextActive]}>
                        {t.label} {openInfo === t.key ? '▲' : '▼'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {openInfo === 'research' && (
                  <View style={styles.infoPanel}>
                    <Text style={styles.infoPanelText}>{program.science_basis}</Text>
                    {program.honest_note ? (
                      <Text style={[styles.infoPanelText, { color: '#71717A', fontStyle: 'italic', marginTop: 8 }]}>
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
                      <View style={styles.goalParam}><Text style={styles.goalParamVal}>{gp.frequency}</Text><Text style={styles.goalParamLabel}>Frequency</Text></View>
                      <View style={styles.goalParam}><Text style={styles.goalParamVal}>{gp.rep_range}</Text><Text style={styles.goalParamLabel}>Rep range</Text></View>
                      <View style={styles.goalParam}><Text style={styles.goalParamVal}>{gp.intensity}</Text><Text style={styles.goalParamLabel}>Intensity</Text></View>
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
              const color = w.level === 'high' ? '#E24B4A'
                : w.level === 'success' ? '#1D9E75'
                : w.level === 'medium' ? '#BA7517' : '#FFFFFF';
              const label = w.level === 'success' ? 'Optimal'
                : w.level === 'high' ? 'Warning'
                : w.level === 'medium' ? 'Note' : 'Info';
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
          <Text style={styles.sectionTitle}>Workouts</Text>
          {program.days.filter(d => !d.optional).map((day, i) => (
            <Pressable key={i} style={styles.dayCard} onPress={() => setSelectedDay(day)}>
              <View style={styles.dayCardLeft}>
                <Text style={styles.dayCardName}>{day.name}</Text>
                <Text style={styles.dayCardFocus}>{day.focus}</Text>
                <Text style={styles.dayCardCount}>{day.exercises.length} exercises</Text>
              </View>
              <Text style={styles.dayCardArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        {program.days.some(d => d.optional) && (
          <View style={styles.optionalSection}>
            <View style={styles.optionalSectionHeader}>
              <View style={styles.optionalDivider} />
              <Text style={styles.optionalSectionTitle}>OPTIONAL DAY</Text>
              <View style={styles.optionalDivider} />
            </View>
            {program.days.filter(d => d.optional).map((day, i) => (
              <Pressable key={i} style={styles.dayCardOptional} onPress={() => setSelectedDay(day)}>
                <View style={styles.dayCardLeft}>
                  <Text style={styles.dayCardName}>{day.name}</Text>
                  <Text style={styles.dayCardFocusOptional}>{day.focus}</Text>
                  {day.tip && <Text style={styles.dayCardTip}>{day.tip}</Text>}
                  <Text style={styles.dayCardCount}>{day.exercises.length} exercises</Text>
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
  'Chest': '#E24B4A', 'Upper chest': '#E24B4A', 'Lower chest': '#E24B4A',
  'Back': '#FFFFFF', 'Lats': '#FFFFFF', 'Traps': '#FFFFFF',
  'Shoulders': '#A1A1AA', 'Side deltoids': '#A1A1AA', 'Rear deltoids': '#A1A1AA',
  'Biceps': '#1D9E75', 'Brachialis': '#1D9E75',
  'Triceps': '#BA7517',
  'Quads': '#0EA5E9', 'Hamstrings': '#0EA5E9', 'Glutes': '#0EA5E9', 'Calves': '#0EA5E9',
  'Abs': '#71717A', 'Core': '#71717A',
};

function getMuscleColor(muscles) {
  if (!muscles) return '#FFFFFF';
  const first = muscles.split(',')[0].trim();
  return MUSCLE_COLORS[first] || '#FFFFFF';
}

function ExerciseCard({ ex, isSimple = false }) {
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
            <Text style={styles.prescriptionLabel}>Sets</Text>
          </View>
          <View style={styles.prescriptionBox}>
            <Text style={styles.prescriptionVal}>{ex.reps}</Text>
            <Text style={styles.prescriptionLabel}>Reps</Text>
          </View>
          <View style={styles.prescriptionBox}>
            <Text style={styles.prescriptionVal}>{ex.rest}</Text>
            <Text style={styles.prescriptionLabel}>Rest</Text>
          </View>
        </View>
        <View style={styles.rpeRow}>
          <View style={styles.rpeBox}>
            <Text style={styles.rpeBadge}>Early sets RPE ~{ex.early_rpe}</Text>
          </View>
          <View style={styles.rpeBox}>
            <Text style={[styles.rpeBadge, styles.rpeLast]}>Last set RPE ~{ex.last_rpe}</Text>
          </View>
        </View>
        {(ex.sub1 || ex.sub2 || ex.sub3) && (
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Substitutes: </Text>
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
              ? 'Hide details ▲'
              : isSimple ? 'Learn why + how to do it ▼' : 'Show technique + research ▼'}
          </Text>
        )}
      </Pressable>
      {expanded && (
        <View style={styles.expandedSection}>
          {ex.study && <StudyChart study={ex.study} />}
          {ex.research_note && (
            <View style={styles.researchNote}>
              <Text style={styles.scienceLabel}>{isSimple ? 'What does this do?' : 'Why this exercise'}</Text>
              <Text style={styles.researchNoteText}>{ex.research_note}</Text>
            </View>
          )}
          {ex.cues?.length > 0 && (
            <View style={styles.cuesSection}>
              <Text style={styles.scienceLabel}>Technique cues</Text>
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
              <Text style={styles.scienceLabel}>Progression path</Text>
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
  titleSub: { fontSize: 12, color: '#52525B', marginTop: 2 },
  backBtnWrapper: { paddingVertical: 8, paddingRight: 12 },
  backBtn: { fontSize: 15, color: '#FFFFFF' },
  startBtn: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  startBtnText: { color: '#111114', fontSize: 14, fontWeight: '600' },
  changeSplitBtn: { backgroundColor: '#1C1C22', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0.5, borderColor: '#FFFFFF' },
  changeSplitBtnText: { color: '#E4E4E8', fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#71717A', fontSize: 15 },

  // Split selector
  selectorLabel: { fontSize: 13, color: '#71717A', fontWeight: '500', marginBottom: 12, marginTop: 8 },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dayBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  dayBtnActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  dayBtnText: { fontSize: 16, fontWeight: '700', color: '#71717A' },
  dayBtnTextActive: { color: '#E4E4E8' },
  goalContext: { fontSize: 12, color: '#71717A', fontStyle: 'italic', marginBottom: 16 },
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
  honestNoteText: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 12, fontStyle: 'italic' },
  splitDays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  splitDayChip: { backgroundColor: '#2C2C35', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  splitDayChipText: { fontSize: 11, color: '#A1A1AA' },
  selectSplitBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  selectSplitBtnActive: { backgroundColor: '#FFFFFF' },
  selectSplitBtnText: { fontSize: 14, fontWeight: '600', color: '#71717A' },
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
  restArrowLabel: { fontSize: 9, color: '#3D3D4A', fontWeight: '500', textAlign: 'center' },
  programMeta: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoAccordion: { marginTop: 4 },
  infoTabRow: { flexDirection: 'row', gap: 6, marginBottom: 0 },
  infoTab: { flex: 1, backgroundColor: '#12121A', borderRadius: 8, paddingVertical: 7, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  infoTabActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF44' },
  infoTabText: { fontSize: 11, color: '#52525B', fontWeight: '600' },
  infoTabTextActive: { color: '#E4E4E8' },
  infoPanel: { backgroundColor: '#12121A', borderRadius: 10, padding: 14, marginTop: 8, borderWidth: 0.5, borderColor: '#2C2C35' },
  infoPanelLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  infoPanelText: { fontSize: 12, color: '#A1A1AA', lineHeight: 19 },
  infoPanelCitation: { fontSize: 10, color: '#52525B', fontStyle: 'italic', marginTop: 6, marginBottom: 10 },
  scienceCard: { backgroundColor: '#111114', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#FFFFFF', marginBottom: 20 },
  scienceCardSmall: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 10 },
  honestNoteCard: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#BA7517', marginBottom: 12 },
  goalResearchCard: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#1D9E7544', marginBottom: 10 },
  citationText: { fontSize: 10, color: '#71717A', fontStyle: 'italic', marginTop: 6, marginBottom: 10 },
  goalParamsRow: { flexDirection: 'row', gap: 6 },
  goalParam: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 8, padding: 8, alignItems: 'center' },
  goalParamVal: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', marginBottom: 2 },
  goalParamLabel: { fontSize: 9, color: '#71717A', textAlign: 'center' },
  scienceLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  scienceText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20 },
  scienceTextSmall: { fontSize: 12, color: '#71717A', lineHeight: 18 },
  progressionLabel: { fontSize: 11, color: '#71717A', fontWeight: '500', marginBottom: 4 },
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
  warningSource: { fontSize: 10, color: '#71717A', fontStyle: 'italic' },

  // Schedule
  scheduleSection: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginBottom: 12 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  scheduleDay: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A20', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  scheduleDayActive: { backgroundColor: '#1C1C22', borderColor: '#FFFFFF' },
  scheduleDayText: { fontSize: 11, color: '#71717A', fontWeight: '600' },
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
  dayCardCount: { fontSize: 13, color: '#71717A' },
  dayCardArrow: { fontSize: 22, color: '#3D3D4A' },
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
  muscleText: { fontSize: 12, color: '#71717A', marginBottom: 12 },
  prescriptionRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  prescriptionBox: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 8, padding: 8, alignItems: 'center' },
  prescriptionVal: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  prescriptionLabel: { fontSize: 9, color: '#71717A', marginTop: 2, textAlign: 'center' },
  rpeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  rpeBox: { flex: 1 },
  rpeBadge: { fontSize: 12, color: '#71717A', backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, textAlign: 'center' },
  rpeLast: { color: '#FFFFFF' },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8, gap: 4 },
  subLabel: { fontSize: 11, color: '#71717A', fontWeight: '500', marginTop: 2 },
  subText: { fontSize: 11, color: '#FFFFFF' },
  subChip: { flexDirection: 'row', flexShrink: 1, backgroundColor: '#12121A', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 0.5, borderColor: '#2C2C35' },
  subChipText: { fontSize: 11, color: '#A1A1AA', flexShrink: 1, flexWrap: 'wrap' },
  subChipEquip: { fontSize: 11, color: '#FFFFFF', flexShrink: 0 },
  expandHint: { fontSize: 11, color: '#3D3D4A', marginTop: 8, textAlign: 'right' },
  expandedSection: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#2C2C35', paddingTop: 14 },
  researchNote: { backgroundColor: '#111114', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#FFFFFF', marginBottom: 12 },
  researchNoteText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  cuesSection: { marginBottom: 12 },
  cueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  cueDot: { fontSize: 12, color: '#FFFFFF', width: 14 },
  cueText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18, flex: 1 },
});