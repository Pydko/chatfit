import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { fetchExercises } from '@/features/workouts/api';
import {
  fetchProgramDays, fetchDayExercises, addExerciseToDay,
  removeExerciseFromDay, renameProgramDay, deleteProgramDay, fetchActiveProgram,
  type ProgramDay, type ProgramDayExercise,
} from '@/features/workouts/programs';
import type { Exercise } from '@/types/workout';

export default function ProgramDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" /></View>;
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
              onLongPress={() => handleRemove(item.id, ex?.name ?? 'Hareket')}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{ex?.name ?? 'Bilinmeyen hareket'}</Text>
                {item.target_sets && item.target_reps && (
                  <Text style={s.rowMeta}>
                    Hedef: {item.target_sets} set x {item.target_reps} tekrar
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
          <Text style={s.hint}>Cikarmak icin harekete uzun bas.</Text>
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
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, gap: 8 },
  cardTitle: { fontSize: 22, fontWeight: '700' },
  cardMeta: { fontSize: 14, color: '#666' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  empty: { color: '#777' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 14, color: '#666', marginTop: 2 },
  rowIndex: { fontSize: 14, color: '#999' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, color: '#999', textAlign: 'center' },
  danger: { color: '#c00', textAlign: 'center' },
});
