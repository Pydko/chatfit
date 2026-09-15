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
      Alert.alert('Hata', 'Gun yuklenemedi.');
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
      Alert.alert('Hata', 'Ad degistirilemedi.');
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
      Alert.alert('Hata', 'Hareket eklenemedi.');
    }
  }

  function handleRemove(itemId: string, exerciseName: string) {
    Alert.alert(exerciseName, 'Bu hareket gunden cikarilacak.', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Cikar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeExerciseFromDay(itemId);
            await load();
          } catch {
            Alert.alert('Hata', 'Cikarilamadi.');
          }
        },
      },
    ]);
  }

  function handleDeleteDay() {
    if (!day) return;
    Alert.alert('Gunu sil', `${day.name} ve icindeki hareketler silinecek.`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgramDay(day.id);
            router.back();
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
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
      <Stack.Screen options={{ headerShown: true, title: day?.name ?? 'Gun' }} />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {editingName ? (
          <View style={s.card}>
            <TextInput style={s.input} value={name} onChangeText={setName} autoFocus />
            <Pressable style={s.primary} onPress={handleSaveName}>
              <Text style={s.primaryText}>Kaydet</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.card} onPress={() => setEditingName(true)}>
            <Text style={s.cardTitle}>{day?.name}</Text>
            <Text style={s.cardMeta}>Adi degistirmek icin dokun (orn. Push, Pull, Bacak)</Text>
          </Pressable>
        )}

        <Text style={s.sectionTitle}>Hareketler</Text>

        {items.length === 0 && <Text style={s.empty}>Henuz hareket eklemedin.</Text>}

        {items.map((item) => {
          const ex = catalog[item.exercise_id];
          return (
            <Pressable
              key={item.id}
              style={s.row}
              onPress={() =>
                router.push({ pathname: '/program/day-exercise/[id]', params: { id: item.id } })
              }
              onLongPress={() => handleRemove(item.id, ex?.name ?? 'Hareket')}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{ex?.name ?? 'Bilinmeyen hareket'}</Text>
                {item.target_sets && item.target_reps && (
                  <Text style={s.rowMeta}>
                    Hedef: {item.target_sets} set x {item.target_reps} tekrar
                  </Text>
                )}
                {item.last_note && (
                  <Text style={s.rowNote} numberOfLines={1}>
                    Not: {item.last_note}
                  </Text>
                )}
              </View>
              <Text style={s.rowIndex}>{item.position}</Text>
            </Pressable>
          );
        })}

        <Pressable style={s.secondary} onPress={() => setPickerOpen(true)}>
          <Text style={s.secondaryText}>+ Hareket ekle</Text>
        </Pressable>

        {items.length > 0 && (
          <Text style={s.hint}>Duzenlemek/not eklemek icin dokun, cikarmak icin uzun bas.</Text>
        )}

        <Pressable onPress={handleDeleteDay} style={{ marginTop: 24 }}>
          <Text style={s.danger}>Bu gunu sil</Text>
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