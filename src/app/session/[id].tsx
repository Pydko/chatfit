import { SyncBanner } from '@/components/SyncBanner';
import { fetchSettings } from '@/features/settings/api';
import { RestTimerBar } from '@/features/timer/RestTimerBar';
import { formatDuration, REST_PRESETS, suggestRestSeconds } from '@/features/timer/duration';
import { useRestTimer } from '@/features/timer/useRestTimer';
import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { SetForm } from '@/features/workouts/SetForm';
import {
  addSetLog, deleteSetLog, fetchExercises,
  fetchSetLogs,
  type LocalSetLog,
} from '@/features/workouts/api';
import { groupByExercise, summarizeSets, summarizeWeight } from '@/features/workouts/summary';
import type { Exercise } from '@/types/workout';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [logs, setLogs] = useState<LocalSetLog[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [defaultRest, setDefaultRest] = useState(90);
  const timer = useRestTimer();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [logData, exData, settings] = await Promise.all([
        fetchSetLogs(id),
        fetchExercises(),
        fetchSettings(),
      ]);
      setLogs(logData);
      setExercises(Object.fromEntries(exData.map((e) => [e.id, e])));
      setDefaultRest(settings.defaultRestSeconds);
    } catch {
      Alert.alert('Error', 'Could not load workout.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const grouped = useMemo(() => Array.from(groupByExercise(logs).entries()), [logs]);

  const nextSetIndex = selected
    ? logs.filter((l) => l.exercise_id === selected.id).length + 1
    : 1;

  async function handleAddSet(input: {
    weight_kg: number;
    reps: number;
    rpe: number | null;
    is_warmup: boolean;
  }) {
    if (!id || !selected) return;
    const created = await addSetLog({
      session_id: id,
      exercise_id: selected.id,
      set_index: nextSetIndex,
      ...input,
    });
    setLogs((prev) => [...prev, created]);

    // Start rest timer automatically after logging a set
    timer.start(suggestRestSeconds(input, defaultRest));
  }

  function handleDeleteExercise(exerciseId: string, sets: LocalSetLog[]) {
    Alert.alert(
      exercises[exerciseId]?.name ?? 'Exercise',
      `${sets.length} set records will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(sets.map((s) => deleteSetLog(s.id)));
              setLogs((prev) => prev.filter((l) => l.exercise_id !== exerciseId));
            } catch {
              Alert.alert('Error', 'Could not delete.');
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Workout' }} />
      <SyncBanner />
      <ScrollView
        style={s.container}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
      >
        <Pressable style={s.pickButton} onPress={() => setPickerOpen(true)}>
          <Text style={s.pickButtonText}>
            {selected ? 'Add another exercise' : 'Select exercise'}
          </Text>
        </Pressable>

        {selected && (
          <SetForm exercise={selected} nextSetIndex={nextSetIndex} onSubmit={handleAddSet} />
        )}

        {!timer.running && logs.length > 0 && (
          <View style={s.restRow}>
            <Text style={s.restLabel}>Start rest timer</Text>
            <View style={s.restChips}>
              {REST_PRESETS.map((seconds) => (
                <Pressable
                  key={seconds}
                  style={s.restChip}
                  onPress={() => timer.start(seconds)}
                >
                  <Text style={s.restChipText}>{formatDuration(seconds)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {grouped.length > 0 && <Text style={s.sectionTitle}>This workout</Text>}

        {grouped.map(([exerciseId, sets]) => {
          const hasPending = sets.some((set) => set.is_pending);
          return (
            <Pressable
              key={exerciseId}
              style={s.card}
              onPress={() =>
                router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } })
              }
              onLongPress={() => handleDeleteExercise(exerciseId, sets)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>
                  {exercises[exerciseId]?.name ?? 'Unknown exercise'}
                </Text>
                <Text style={s.cardSummary}>
                  {summarizeSets(sets)}  ·  {summarizeWeight(sets)}
                </Text>
                {hasPending && <Text style={s.pending}>Pending sync</Text>}
              </View>
              <ChevronRight color="#bbb" size={20} />
            </Pressable>
          );
        })}

        {grouped.length === 0 && <Text style={s.empty}>No sets added yet.</Text>}

        {grouped.length > 0 && (
          <Text style={s.hint}>Tap for details, long press to delete.</Text>
        )}
      </ScrollView>

      <RestTimerBar timer={timer} />

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setSelected}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickButton: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  pickButtonText: { fontSize: 16, fontWeight: '600' },
  restRow: { gap: 8 },
  restLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  restChips: { flexDirection: 'row', gap: 8 },
  restChip: {
    flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff',
  },
  restChipText: { fontSize: 15, fontWeight: '600', color: '#333' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  empty: { color: '#777' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16,
  },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardSummary: { fontSize: 14, color: '#666', marginTop: 4 },
  pending: { fontSize: 12, color: '#8a6d1f', marginTop: 4 },
  hint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 8 },
});