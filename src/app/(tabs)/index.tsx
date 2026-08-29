import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { startSession, fetchSessions, fetchSetLogs, fetchExercises } from '@/features/workouts/api';
import {
  fetchActiveProgram, suggestNextDay, startSessionForDay, fetchDayExercises,
  type Program, type ProgramDay,
} from '@/features/workouts/programs';
import type { WorkoutSession, Exercise } from '@/types/workout';

export default function WorkoutTab() {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [nextDay, setNextDay] = useState<ProgramDay | null>(null);
  const [dayExercises, setDayExercises] = useState<string[]>([]);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [setCount, setSetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const sessions = await fetchSessions(1);
      const latest = sessions[0] ?? null;
      const sameDay =
        latest && new Date(latest.performed_at).toDateString() === new Date().toDateString();

      if (sameDay && latest) {
        setActive(latest);
        setSetCount((await fetchSetLogs(latest.id)).length);
      } else {
        setActive(null);
        setSetCount(0);
      }

      const prog = await fetchActiveProgram();
      setProgram(prog);
      setNextDay(null);
      setDayExercises([]);

      if (prog) {
        const day = await suggestNextDay(prog.id);
        setNextDay(day);

        if (day) {
          const [items, catalog] = await Promise.all([
            fetchDayExercises(day.id),
            fetchExercises(),
          ]);
          const byId = new Map(catalog.map((e: Exercise) => [e.id, e.name]));
          setDayExercises(
            items.map((i) => {
              const name = byId.get(i.exercise_id) ?? 'Hareket';
              return i.target_sets && i.target_reps
                ? `${name}  ${i.target_sets}x${i.target_reps}`
                : name;
            }),
          );
        }
      }
    } catch (e) {
      console.log('WORKOUT TAB ERROR:', e);
      Alert.alert('Hata', 'Veriler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleStart(day?: ProgramDay | null) {
    try {
      setBusy(true);
      const session = day ? await startSessionForDay(day) : await startSession();
      router.push({ pathname: '/session/[id]', params: { id: session.id } });
    } catch {
      Alert.alert('Hata', 'Antrenman baslatilamadi.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {active && (
        <View style={s.card}>
          <Text style={s.cardLabel}>Devam eden antrenman</Text>
          <Text style={s.cardTitle}>{active.title ?? 'Antrenman'}</Text>
          <Text style={s.cardMeta}>{setCount} set kaydedildi</Text>
          <Pressable
            style={s.primary}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: active.id } })}
          >
            <Text style={s.primaryText}>Devam et</Text>
          </Pressable>
        </View>
      )}

      {!active && program && nextDay && (
        <View style={s.card}>
          <Text style={s.cardLabel}>Siradaki gun</Text>
          <Text style={s.cardTitle}>{nextDay.name}</Text>

          {dayExercises.length > 0 ? (
            <View style={s.exerciseList}>
              {dayExercises.map((line, i) => (
                <Text key={i} style={s.exerciseLine}>{line}</Text>
              ))}
            </View>
          ) : (
            <Text style={s.cardMeta}>Bu gune henuz hareket eklemedin.</Text>
          )}

          <Pressable style={[s.primary, busy && s.disabled]} onPress={() => handleStart(nextDay)} disabled={busy}>
            <Text style={s.primaryText}>
              {busy ? 'Baslatiliyor...' : `${nextDay.name} gunune basla`}
            </Text>
          </Pressable>
        </View>
      )}

      {!active && program && !nextDay && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{program.name}</Text>
          <Text style={s.cardMeta}>Programina henuz gun eklemedin.</Text>
        </View>
      )}

      {!active && !program && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Henuz programin yok</Text>
          <Text style={s.cardMeta}>
            Kendi antrenman gunlerini olustur, uygulama siradaki gunu otomatik takip etsin.
          </Text>
        </View>
      )}

      <Pressable style={s.secondary} onPress={() => router.push('/program')}>
        <Text style={s.secondaryText}>
          {program ? 'Programi duzenle' : 'Program olustur'}
        </Text>
      </Pressable>

      {!active && (
        <Pressable style={s.tertiary} onPress={() => handleStart(null)} disabled={busy}>
          <Text style={s.tertiaryText}>Programsiz antrenman baslat</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, gap: 10 },
  cardLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTitle: { fontSize: 24, fontWeight: '700' },
  cardMeta: { fontSize: 15, color: '#555' },
  exerciseList: { gap: 4, marginVertical: 4 },
  exerciseLine: { fontSize: 15, color: '#333' },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  tertiary: { padding: 12, alignItems: 'center' },
  tertiaryText: { color: '#555', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
