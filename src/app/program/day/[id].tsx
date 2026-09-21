import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { fetchExercises } from '@/features/workouts/api';
import {
  addExerciseToDay,
  deleteProgramDay, fetchActiveProgram,
  fetchDayExercises,
  fetchProgramDays,
  removeExerciseFromDay, renameProgramDay,
  type ProgramDay, type ProgramDayExercise,
} from '@/features/workouts/programs';
import { colors } from '@/theme/colors';
import type { Exercise } from '@/types/workout';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

export default function ProgramDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [items, setItems] = useState<ProgramDayExercise[]>([]);
  const [catalog, setCatalog] = useState<Record<string, Exercise>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const prog = await fetchActiveProgram();
      if (!prog) return;

      const days = await fetchProgramDays(prog.id);
      const current = days.find((d) => d.id === id) ?? null;
      setDay(current);
      setName(current?.name ?? '');

      const [list, ex] = await Promise.all([fetchDayExercises(id), fetchExercises()]);
      setItems(list);
      setCatalog(Object.fromEntries(ex.map((e) => [e.id, e])));
    } catch {
      Alert.alert('Error', 'Could not load day.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSaveName() {
    if (!day || !name.trim()) return;
    try {
      await renameProgramDay(day.id, name.trim());
      setEditingName(false);
      await load();
    } catch {
      Alert.alert('Error', 'Could not rename.');
    }
  }

  async function handleAddExercise(exercise: Exercise) {
    if (!id) return;
    try {
      await addExerciseToDay({
        program_day_id: id,
        exercise_id: exercise.id,
        target_sets: 3,
        target_reps: 10,
      });
      await load();
    } catch {
      Alert.alert('Error', 'Could not add exercise.');
    }
  }

  function handleRemove(itemId: string, exerciseName: string) {
    Alert.alert(exerciseName, 'This exercise will be removed from the day.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeExerciseFromDay(itemId);
            await load();
          } catch {
            Alert.alert('Error', 'Could not remove.');
          }
        },
      },
    ]);
  }

  function handleDeleteDay() {
    if (!day) return;
    Alert.alert('Delete Day', `${day.name} and all its exercises will be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgramDay(day.id);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not delete.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: day?.name ?? 'Day' }} />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {editingName ? (
          <View style={s.card}>
            <TextInput style={s.input} value={name} onChangeText={setName} autoFocus />
            <Pressable style={s.primary} onPress={handleSaveName}>
              <Text style={s.primaryText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.card} onPress={() => setEditingName(true)}>
            <Text style={s.cardTitle}>{day?.name}</Text>
            <Text style={s.cardMeta}>Tap to change name (e.g. Push, Pull, Legs)</Text>
          </Pressable>
        )}

        <Text style={s.sectionTitle}>Exercises</Text>

        {items.length === 0 && <Text style={s.empty}>No exercises added yet.</Text>}

        {items.map((item) => {
          const ex = catalog[item.exercise_id];
          return (
            <Pressable
              key={item.id}
              style={s.row}
              onPress={() =>
                router.push({ pathname: '/program/day-exercise/[id]', params: { id: item.id } })
              }
              onLongPress={() => handleRemove(item.id, ex?.name ?? 'Exercise')}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{ex?.name ?? 'Unknown exercise'}</Text>
                {item.target_sets && item.target_reps && (
                  <Text style={s.rowMeta}>
                    Target: {item.target_sets} sets x {item.target_reps} reps
                  </Text>
                )}
                {item.last_note && (
                  <Text style={s.rowNote} numberOfLines={1}>
                    Note: {item.last_note}
                  </Text>
                )}
              </View>
              <Text style={s.rowIndex}>{item.position}</Text>
            </Pressable>
          );
        })}

        <Pressable style={s.secondary} onPress={() => setPickerOpen(true)}>
          <Text style={s.secondaryText}>+ Add exercise</Text>
        </Pressable>

        {items.length > 0 && (
          <Text style={s.hint}>Tap to edit/add notes, long press to remove.</Text>
        )}

        <Pressable onPress={handleDeleteDay} style={{ marginTop: 24 }}>
          <Text style={s.danger}>Delete this day</Text>
        </Pressable>
      </ScrollView>

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddExercise}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: 14, color: colors.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, color: colors.textPrimary },
  empty: { color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowName: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  rowMeta: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  rowNote: { fontSize: 13, color: colors.primary, marginTop: 2, fontStyle: 'italic' },
  rowIndex: { fontSize: 14, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  primary: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  secondary: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, padding: 14,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  danger: { color: colors.danger, textAlign: 'center' },
});