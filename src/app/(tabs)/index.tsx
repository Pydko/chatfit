import { startSession } from '@/features/workouts/api';
import {
  addProgramDay,
  ensureActiveProgram,
  fetchDayExercises,
  fetchProgramDays,
  findTodaySessionForDay,
  renameProgramDay,
  startSessionForDay,
  type Program, type ProgramDay,
} from '@/features/workouts/programs';
import { colors } from '@/theme/colors';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pencil, Play } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function WorkoutTab() {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const prog = await ensureActiveProgram();
      setProgram(prog);

      const d = await fetchProgramDays(prog.id);
      setDays(d);
      const entries = await Promise.all(
        d.map(async (day) => [day.id, (await fetchDayExercises(day.id)).length] as const),
      );
      setCounts(Object.fromEntries(entries));
    } catch (e) {
      console.log('WORKOUT TAB ERROR:', e);
      Alert.alert('Error', 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAddDay() {
    if (!program) return;
    try {
      setBusy(true);
      await addProgramDay(program.id);
      await load();
    } catch {
      Alert.alert('Error', 'Could not add workout.');
    } finally {
      setBusy(false);
    }
  }

  // Bugun bu antrenman icin zaten bir session varsa ona devam et, yoksa yeni ac.
  async function handleStart(day: ProgramDay) {
    try {
      setBusy(true);
      const existing = await findTodaySessionForDay(day.id);
      const session = existing ?? (await startSessionForDay(day));
      router.push({ pathname: '/session/[id]', params: { id: session.id } });
    } catch {
      Alert.alert('Error', 'Could not start workout.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFreeStart() {
    try {
      setBusy(true);
      const session = await startSession();
      router.push({ pathname: '/session/[id]', params: { id: session.id } });
    } catch {
      Alert.alert('Error', 'Could not start workout.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {days.length === 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>No workouts yet</Text>
          <Text style={s.cardMeta}>
            Create a new workout below, then add your exercises to it.
          </Text>
        </View>
      )}

      {days.map((day) => (
        <DayRow
          key={day.id}
          day={day}
          exerciseCount={counts[day.id] ?? 0}
          busy={busy}
          onOpen={() => router.push({ pathname: '/program/day/[id]', params: { id: day.id } })}
          onStart={() => handleStart(day)}
          onRenamed={load}
        />
      ))}

      <Pressable style={[s.secondary, busy && s.disabled]} onPress={handleAddDay} disabled={busy}>
        <Text style={s.secondaryText}>+ New Workout</Text>
      </Pressable>

      <Pressable style={s.tertiary} onPress={handleFreeStart} disabled={busy}>
        <Text style={s.tertiaryText}>Start freestyle workout</Text>
      </Pressable>
    </ScrollView>
  );
}

function DayRow({
  day,
  exerciseCount,
  busy,
  onOpen,
  onStart,
  onRenamed,
}: {
  day: ProgramDay;
  exerciseCount: number;
  busy: boolean;
  onOpen: () => void;
  onStart: () => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(day.name);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await renameProgramDay(day.id, trimmed);
      setEditing(false);
      onRenamed();
    } catch {
      Alert.alert('Error', 'Could not rename.');
    }
  }

  if (editing) {
    return (
      <View style={s.dayCard}>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          autoFocus
          onSubmitEditing={save}
        />
        <Pressable style={s.saveButton} onPress={save}>
          <Text style={s.saveButtonText}>Save</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.dayCard}>
      <Pressable style={{ flex: 1 }} onPress={onOpen}>
        <Text style={s.dayName}>{day.name}</Text>
        <Text style={s.dayMeta}>{exerciseCount} exercises</Text>
      </Pressable>
      <Pressable onPress={onStart} disabled={busy} hitSlop={10} style={s.iconButton}>
        <Play color={colors.primary} size={18} />
      </Pressable>
      <Pressable onPress={() => setEditing(true)} hitSlop={10} style={s.iconButton}>
        <Pencil color={colors.textMuted} size={18} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { fontSize: 15, color: colors.textSecondary },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  tertiary: { padding: 12, alignItems: 'center' },
  tertiaryText: { color: colors.textSecondary, fontSize: 15 },
  disabled: { opacity: 0.5 },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  dayName: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  dayMeta: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  iconButton: { padding: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  saveButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '600' },
});