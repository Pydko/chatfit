import { useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { SetForm } from '@/features/workouts/SetForm';
import { fetchSetLogs, addSetLog, deleteSetLog, fetchExercises } from '@/features/workouts/api';
import type { Exercise, SetLog } from '@/types/workout';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [logData, exData] = await Promise.all([fetchSetLogs(id), fetchExercises()]);
      setLogs(logData);
      setExercises(Object.fromEntries(exData.map((e) => [e.id, e])));
    } catch {
      Alert.alert('Hata', 'Antrenman yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
  }

  function handleDelete(logId: string) {
    Alert.alert('Seti sil', 'Bu set kaydi silinecek.', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSetLog(logId);
            setLogs((prev) => prev.filter((l) => l.id !== logId));
          } catch {
            Alert.alert('Hata', 'Set silinemedi.');
          }
        },
      },
    ]);
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
      <Stack.Screen options={{ headerShown: true, title: 'Antrenman' }} />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Pressable style={s.pickButton} onPress={() => setPickerOpen(true)}>
          <Text style={s.pickButtonText}>
            {selected ? 'Hareketi degistir' : 'Hareket sec'}
          </Text>
        </Pressable>

        {selected && (
          <SetForm exercise={selected} nextSetIndex={nextSetIndex} onSubmit={handleAddSet} />
        )}

        <Text style={s.sectionTitle}>Kaydedilen setler ({logs.length})</Text>

        {logs.length === 0 ? (
          <Text style={s.empty}>Henuz set eklemedin.</Text>
        ) : (
          logs.map((log) => (
            <Pressable key={log.id} style={s.logRow} onLongPress={() => handleDelete(log.id)}>
              <View style={{ flex: 1 }}>
                <Text style={s.logName}>
                  {exercises[log.exercise_id]?.name ?? 'Bilinmeyen hareket'}
                </Text>
                <Text style={s.logMeta}>
                  {log.weight_kg} kg x {log.reps}
                  {log.rpe ? `  RPE ${log.rpe}` : ''}
                  {log.is_warmup ? '  (isinma)' : ''}
                </Text>
              </View>
              <Text style={s.logIndex}>#{log.set_index}</Text>
            </Pressable>
          ))
        )}

        <Text style={s.hint}>Bir seti silmek icin uzun bas.</Text>
      </ScrollView>

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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  empty: { color: '#777' },
  logRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  logName: { fontSize: 15, fontWeight: '500' },
  logMeta: { fontSize: 14, color: '#666', marginTop: 2 },
  logIndex: { fontSize: 14, color: '#999' },
  hint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 8 },
});
