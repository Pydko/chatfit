import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { fetchExerciseHistory, fetchExerciseById } from '@/features/workouts/api';
import { groupBySession, summarizeSets, summarizeWeight } from '@/features/workouts/summary';
import { MUSCLE_LABELS, type Exercise, type SetLog } from '@/types/workout';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [ex, logs] = await Promise.all([
        fetchExerciseById(id),
        fetchExerciseHistory(id),
      ]);
      setExercise(ex);
      setHistory(logs);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sessions = useMemo(() => {
    const grouped = Array.from(groupBySession(history).entries());
    return grouped.sort((a, b) => {
      const da = new Date(a[1][0].performed_at).getTime();
      const db = new Date(b[1][0].performed_at).getTime();
      return db - da;
    });
  }, [history]);

  const best = useMemo(() => {
    const working = history.filter((h) => !h.is_warmup);
    if (working.length === 0) return null;
    return working.reduce((a, b) => (b.weight_kg > a.weight_kg ? b : a));
  }, [history]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: exercise?.name ?? 'Hareket' }} />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {exercise && (
          <View style={s.header}>
            <Text style={s.name}>{exercise.name}</Text>
            <Text style={s.muscle}>{MUSCLE_LABELS[exercise.primary_muscle]}</Text>
          </View>
        )}

        {best && (
          <View style={s.statCard}>
            <Text style={s.statLabel}>En agir set</Text>
            <Text style={s.statValue}>
              {best.weight_kg} kg x {best.reps}
            </Text>
            <Text style={s.statDate}>
              {new Date(best.performed_at).toLocaleDateString('tr-TR')}
            </Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Gecmis ({sessions.length} antrenman)</Text>

        {sessions.length === 0 ? (
          <Text style={s.empty}>Bu hareketi henuz calismadin.</Text>
        ) : (
          sessions.map(([sessionId, sets]) => (
            <View key={sessionId} style={s.sessionCard}>
              <Text style={s.sessionDate}>
                {new Date(sets[0].performed_at).toLocaleDateString('tr-TR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
              <Text style={s.sessionSummary}>
                {summarizeSets(sets)}  ·  {summarizeWeight(sets)}
              </Text>
              <View style={s.setList}>
                {sets
                  .sort((a, b) => a.set_index - b.set_index)
                  .map((set) => (
                    <Text key={set.id} style={s.setLine}>
                      {set.set_index}. {set.weight_kg} kg x {set.reps}
                      {set.rpe ? `  RPE ${set.rpe}` : ''}
                      {set.is_warmup ? '  (isinma)' : ''}
                    </Text>
                  ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { gap: 4 },
  name: { fontSize: 24, fontWeight: '700' },
  muscle: { fontSize: 15, color: '#666' },
  statCard: { backgroundColor: '#111', borderRadius: 12, padding: 16, gap: 4 },
  statLabel: { fontSize: 13, color: '#aaa' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  statDate: { fontSize: 13, color: '#aaa' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  empty: { color: '#777' },
  sessionCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 6 },
  sessionDate: { fontSize: 15, fontWeight: '600' },
  sessionSummary: { fontSize: 14, color: '#666' },
  setList: { marginTop: 6, gap: 2 },
  setLine: { fontSize: 14, color: '#444' },
});
