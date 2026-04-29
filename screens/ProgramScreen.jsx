import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { supabase } from '../supabase';
import { generateProgram, getRankedSplits, SPLITS } from './programGenerator';
import StudyChart from './StudyChart';

const DAYS_OPTIONS = [2, 3, 4, 5, 6];

const OPTIMALITY_COLORS = {
  optimal:    '#1D9E75',
  good:       '#BA7517',
  suboptimal: '#E24B4A',
};

const RANK_LABELS = ['Best match', '2nd option', '3rd option'];

export default function ProgramScreen({ onStartWorkout, previewDay, onClose }) {
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectingDays, setSelectingDays] = useState(false);
  const [draftDays, setDraftDays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProgram(); }, []);

  const loadProgram = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from('profiles')
      .select('weekly_workouts, session_length, goals, name, equipment, selected_split')
      .eq('id', user.id)
      .single();
    if (prof) {
      setProfile(prof);
      setDraftDays(parseInt(prof.weekly_workouts) || 3);
      setProgram(generateProgram(prof));
    }
    setLoading(false);
  };

  const saveSplitChoice = async (splitId, days) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({
      selected_split: splitId,
      weekly_workouts: days,
    }).eq('id', user.id);
    const newProfile = { ...profile, selected_split: splitId, weekly_workouts: days };
    setProfile(newProfile);
    setProgram(generateProgram(newProfile));
    setSelectingDays(false);
  };

  // ─── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (previewDay) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>{previewDay.name}</Text>
          <Pressable style={styles.startBtn} onPress={() => onStartWorkout(previewDay)}>
            <Text style={styles.startBtnText}>Start</Text>
          </Pressable>
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelectingDays(false)}>
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Choose split</Text>
          <View style={{ width: 60 }} />
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
                (!profile?.selected_split && i === 0 && draftDays === parseInt(profile?.weekly_workouts));
              const optColor = OPTIMALITY_COLORS[split.optimality] || '#534AB7';

              return (
                <View key={split.id} style={[styles.splitCard, isActive && styles.splitCardActive]}>
                  <View style={styles.splitCardTop}>
                    <View style={styles.splitCardLeft}>
                      <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#534AB722' : '#2C2C35' }]}>
                        <Text style={[styles.rankBadgeText, { color: i === 0 ? '#7F77DD' : '#71717A' }]}>
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
      </View>
    );
  }

  if (!program) return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>My Program</Text></View>
      <View style={styles.empty}><Text style={styles.emptyText}>Complete onboarding to get your program.</Text></View>
    </View>
  );

  // ─── DAY DETAIL ────────────────────────────────────────────────────────────
  if (selectedDay) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedDay(null)}>
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>{selectedDay.name}</Text>
          <Pressable style={styles.startBtn} onPress={() => {
            setSelectedDay(null);
            onStartWorkout && onStartWorkout(selectedDay);
          }}>
            <Text style={styles.startBtnText}>Start</Text>
          </Pressable>
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
            <ExerciseCard key={i} ex={ex} showCues showResearch />
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─── MAIN VIEW ─────────────────────────────────────────────────────────────
  const warnings = (program.warnings || []).filter(w => w.type !== 'volume');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <Text style={styles.title}>My Program</Text>
          <Pressable style={styles.changeSplitBtn} onPress={() => setSelectingDays(true)}>
            <Text style={styles.changeSplitBtnText}>Change split</Text>
          </Pressable>
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
                  <View key={i} style={styles.sessionSequenceItem}>
                    <View style={styles.sessionDayPill}>
                      <Text style={styles.sessionDayNum}>Day {i + 1}</Text>
                      <Text style={styles.sessionDayName} numberOfLines={1}>{day.name.split('—')[0].trim()}</Text>
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
              <Text style={styles.metaChipText}>{program.level}</Text>
            </View>
          </View>
          <View style={styles.scienceCardSmall}>
            <Text style={styles.scienceLabel}>Research basis</Text>
            <Text style={styles.scienceTextSmall}>{program.science_basis}</Text>
          </View>
          {program.honest_note && (
            <View style={styles.honestNoteCard}>
              <Text style={styles.scienceLabel}>Honest assessment</Text>
              <Text style={styles.scienceTextSmall}>{program.honest_note}</Text>
            </View>
          )}
          <Text style={styles.progressionLabel}>Progression method</Text>
          <Text style={styles.progressionText}>{program.progression}</Text>
        </View>

        {warnings.length > 0 && (
          <View style={styles.warningsSection}>
            {warnings.map((w, i) => {
              const color = w.level === 'high' ? '#E24B4A'
                : w.level === 'success' ? '#1D9E75'
                : w.level === 'medium' ? '#BA7517' : '#534AB7';
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
                  {day.tip && <Text style={styles.dayCardTip}>💡 {day.tip}</Text>}
                  <Text style={styles.dayCardCount}>{day.exercises.length} exercises</Text>
                </View>
                <Text style={styles.dayCardArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        )}


      </ScrollView>
    </View>
  );
}

// ─── EXERCISE CARD ────────────────────────────────────────────────────────────
const MUSCLE_COLORS = {
  'Chest': '#E24B4A', 'Upper chest': '#E24B4A', 'Lower chest': '#E24B4A',
  'Back': '#534AB7', 'Lats': '#534AB7', 'Traps': '#534AB7',
  'Shoulders': '#7B70D8', 'Side deltoids': '#7B70D8', 'Rear deltoids': '#7B70D8',
  'Biceps': '#1D9E75', 'Brachialis': '#1D9E75',
  'Triceps': '#BA7517',
  'Quads': '#0EA5E9', 'Hamstrings': '#0EA5E9', 'Glutes': '#0EA5E9', 'Calves': '#0EA5E9',
  'Abs': '#71717A', 'Core': '#71717A',
};

function getMuscleColor(muscles) {
  if (!muscles) return '#534AB7';
  const first = muscles.split(',')[0].trim();
  return MUSCLE_COLORS[first] || '#534AB7';
}

function ExerciseCard({ ex }) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = getMuscleColor(ex.muscles);
  return (
    <View style={[styles.exCard, { borderLeftColor: borderColor, borderLeftWidth: 3 }]}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.exHeader}>
          <Text style={styles.exName}>{ex.name}</Text>
          <View style={[styles.catBadge, ex.category?.includes('Isolation') && styles.catBadgeIso]}>
            <Text style={styles.catBadgeText}>{ex.category}</Text>
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
          <Text style={styles.expandHint}>{expanded ? 'Hide details ▲' : 'Show technique + research ▼'}</Text>
        )}
      </Pressable>
      {expanded && (
        <View style={styles.expandedSection}>
          {ex.study && <StudyChart study={ex.study} />}
          {ex.research_note && (
            <View style={styles.researchNote}>
              <Text style={styles.scienceLabel}>Why this exercise</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  backBtn: { fontSize: 15, color: '#534AB7' },
  startBtn: { backgroundColor: '#534AB7', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  startBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  changeSplitBtn: { backgroundColor: '#1A1830', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 0.5, borderColor: '#534AB7' },
  changeSplitBtnText: { color: '#7F77DD', fontSize: 13, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#71717A', fontSize: 15 },

  // Split selector
  selectorLabel: { fontSize: 13, color: '#71717A', fontWeight: '500', marginBottom: 12, marginTop: 8 },
  daysRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dayBtn: { flex: 1, backgroundColor: '#1A1A20', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2C2C35' },
  dayBtnActive: { backgroundColor: '#1A1830', borderColor: '#534AB7' },
  dayBtnText: { fontSize: 16, fontWeight: '700', color: '#71717A' },
  dayBtnTextActive: { color: '#7F77DD' },
  goalContext: { fontSize: 12, color: '#71717A', fontStyle: 'italic', marginBottom: 16 },
  splitCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: '#2C2C35' },
  splitCardActive: { borderColor: '#534AB7' },
  splitCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  splitCardLeft: { flex: 1 },
  rankBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  rankBadgeText: { fontSize: 11, fontWeight: '600' },
  splitName: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  activeCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center' },
  activeCheckText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  splitMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metaChip: { backgroundColor: '#2C2C35', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 0.5, borderColor: '#3D3D4A' },
  metaChipText: { fontSize: 12, color: '#A1A1AA' },
  whyCard: { backgroundColor: '#13121E', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#534AB722' },
  whyLabel: { fontSize: 10, color: '#534AB7', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  whyText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  honestNoteText: { fontSize: 12, color: '#71717A', lineHeight: 18, marginBottom: 12, fontStyle: 'italic' },
  splitDays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  splitDayChip: { backgroundColor: '#2C2C35', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  splitDayChipText: { fontSize: 11, color: '#A1A1AA' },
  selectSplitBtn: { backgroundColor: '#2C2C35', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  selectSplitBtnActive: { backgroundColor: '#534AB7' },
  selectSplitBtnText: { fontSize: 14, fontWeight: '600', color: '#71717A' },
  selectSplitBtnTextActive: { color: '#FFFFFF' },

  // Program card
  programCard: { marginHorizontal: 20, backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 16 },
  programName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', flex: 1, marginRight: 8 },
  programNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sessionSequence: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2 },
  sessionSequenceItem: { flexDirection: 'row', alignItems: 'center' },
  sessionDayPill: { backgroundColor: '#1A1830', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 0.5, borderColor: '#534AB7', alignItems: 'center', minWidth: 64 },
  sessionDayNum: { fontSize: 9, color: '#534AB7', fontWeight: '700', letterSpacing: 0.5 },
  sessionDayName: { fontSize: 11, color: '#FFFFFF', fontWeight: '600', marginTop: 2, maxWidth: 80 },
  restArrow: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  restArrowLine: { width: 1, height: 6, backgroundColor: '#3D3D4A' },
  restArrowLabel: { fontSize: 9, color: '#3D3D4A', fontWeight: '500', textAlign: 'center' },
  programMeta: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  scienceCard: { backgroundColor: '#13121E', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#534AB7', marginBottom: 20 },
  scienceCardSmall: { backgroundColor: '#13121E', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#2C2C35', marginBottom: 10 },
  honestNoteCard: { backgroundColor: '#13121E', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#BA7517', marginBottom: 12 },
  scienceLabel: { fontSize: 10, color: '#534AB7', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  scienceText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20 },
  scienceTextSmall: { fontSize: 12, color: '#71717A', lineHeight: 18 },
  progressionLabel: { fontSize: 11, color: '#71717A', fontWeight: '500', marginBottom: 4 },
  progressionText: { fontSize: 13, color: '#A1A1AA', lineHeight: 20 },
  focusCard: { backgroundColor: '#1A1830', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#534AB7', marginBottom: 16 },
  focusText: { fontSize: 13, color: '#7F77DD' },

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
  scheduleDayActive: { backgroundColor: '#1A1830', borderColor: '#534AB7' },
  scheduleDayText: { fontSize: 11, color: '#71717A', fontWeight: '600' },
  scheduleDayTextActive: { color: '#534AB7' },
  scheduleLabel: { fontSize: 14, color: '#A1A1AA' },

  // Day cards
  daysSection: { paddingHorizontal: 20, marginBottom: 24 },
  dayCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#2C2C35', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardOptional: { backgroundColor: '#0F0F1A', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#534AB7', borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardLeft: { flex: 1 },
  dayCardName: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  dayCardFocus: { fontSize: 12, color: '#534AB7', marginBottom: 4 },
  dayCardFocusOptional: { fontSize: 12, color: '#7B70D8', marginBottom: 4, fontStyle: 'italic' },
  dayCardTip: { fontSize: 11, color: '#BA7517', marginBottom: 4 },
  dayCardCount: { fontSize: 13, color: '#71717A' },
  dayCardArrow: { fontSize: 22, color: '#3D3D4A' },
  optionalSection: { paddingHorizontal: 20, marginBottom: 24 },
  optionalSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  optionalSectionTitle: { fontSize: 11, fontWeight: '700', color: '#534AB7', letterSpacing: 1.2 },
  optionalDivider: { flex: 1, height: 1, backgroundColor: '#534AB750' },
  optionalBadge: { backgroundColor: '#1E1A3A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#534AB7' },
  optionalBadgeText: { fontSize: 9, fontWeight: '700', color: '#534AB7', letterSpacing: 0.5 },

  // Exercise card
  exCard: { backgroundColor: '#1A1A20', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2C2C35' },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  exName: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1, marginRight: 8 },
  catBadge: { backgroundColor: '#1A1830', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  catBadgeIso: { backgroundColor: '#1A2215' },
  catBadgeText: { fontSize: 10, color: '#7F77DD', fontWeight: '500' },
  muscleText: { fontSize: 12, color: '#71717A', marginBottom: 12 },
  prescriptionRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  prescriptionBox: { flex: 1, backgroundColor: '#2C2C35', borderRadius: 8, padding: 8, alignItems: 'center' },
  prescriptionVal: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  prescriptionLabel: { fontSize: 9, color: '#71717A', marginTop: 2, textAlign: 'center' },
  rpeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  rpeBox: { flex: 1 },
  rpeBadge: { fontSize: 12, color: '#71717A', backgroundColor: '#2C2C35', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, textAlign: 'center' },
  rpeLast: { color: '#534AB7' },
  subRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8, gap: 4 },
  subLabel: { fontSize: 11, color: '#71717A', fontWeight: '500', marginTop: 2 },
  subText: { fontSize: 11, color: '#534AB7' },
  subChip: { flexDirection: 'row', backgroundColor: '#12121A', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 0.5, borderColor: '#2C2C35' },
  subChipText: { fontSize: 11, color: '#A1A1AA' },
  subChipEquip: { fontSize: 11, color: '#534AB7' },
  expandHint: { fontSize: 11, color: '#3D3D4A', marginTop: 8, textAlign: 'right' },
  expandedSection: { marginTop: 14, borderTopWidth: 0.5, borderTopColor: '#2C2C35', paddingTop: 14 },
  researchNote: { backgroundColor: '#13121E', borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: '#534AB7', marginBottom: 12 },
  researchNoteText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18 },
  cuesSection: { marginBottom: 12 },
  cueRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  cueDot: { fontSize: 12, color: '#534AB7', width: 14 },
  cueText: { fontSize: 12, color: '#A1A1AA', lineHeight: 18, flex: 1 },
});