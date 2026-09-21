import { fetchExercises } from '@/features/workouts/api';
import {
  fetchDayExerciseById,
  updateDayExerciseNote,
  updateDayExerciseTargets,
  type ProgramDayExercise,
} from '@/features/workouts/programs';
import { colors } from '@/theme/colors';
import type { Exercise } from '@/types/workout';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function DayExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ProgramDayExercise | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [setsText, setSetsText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [current, catalog] = await Promise.all([fetchDayExerciseById(id), fetchExercises()]);
      setItem(current);
      setExercise(catalog.find((e) => e.id === current?.exercise_id) ?? null);
      setSetsText(current?.target_sets ? String(current.target_sets) : '');
      setRepsText(current?.target_reps ? String(current.target_reps) : '');
      setNote(current?.last_note ?? '');
    } catch {
      Alert.alert('Error', 'Could not load exercise.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSaveTargets() {
    if (!item) return;
    const sets = setsText.trim() ? parseInt(setsText, 10) : null;
    const reps = repsText.trim() ? parseInt(repsText, 10) : null;

    if ((setsText.trim() && Number.isNaN(sets)) || (repsText.trim() && Number.isNaN(reps))) {
      Alert.alert('Error', 'Sets and reps must be numbers.');
      return;
    }

    try {
      setSavingTargets(true);
      await updateDayExerciseTargets(item.id, { target_sets: sets, target_reps: reps });
      await load();
    } catch {
      Alert.alert('Error', 'Could not save target.');
    } finally {
      setSavingTargets(false);
    }
  }

  async function handleSaveNote() {
    if (!item) return;
    try {
      setSavingNote(true);
      await updateDayExerciseNote(item.id, note);
      await load();
    } catch {
      Alert.alert('Error', 'Could not save note.');
    } finally {
      setSavingNote(false);
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
    <>
      <Stack.Screen options={{ headerShown: true, title: exercise?.name ?? 'Exercise' }} />
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.cardLabel}>Target</Text>
            <View style={s.inputRow}>
              <View style={s.inputGroup}>
                <Text style={s.fieldLabel}>Sets</Text>
                <TextInput
                  style={s.input}
                  value={setsText}
                  onChangeText={setSetsText}
                  keyboardType="number-pad"
                  placeholder="e.g. 3"
                />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.fieldLabel}>Reps</Text>
                <TextInput
                  style={s.input}
                  value={repsText}
                  onChangeText={setRepsText}
                  keyboardType="number-pad"
                  placeholder="e.g. 10"
                />
              </View>
            </View>
            <Pressable
              style={[s.primary, savingTargets && s.disabled]}
              onPress={handleSaveTargets}
              disabled={savingTargets}
            >
              <Text style={s.primaryText}>{savingTargets ? 'Saving...' : 'Save Target'}</Text>
            </Pressable>
          </View>

          <View style={s.card}>
            <Text style={s.noteDate}>
              {item?.last_note_at ? formatDateTime(item.last_note_at) : 'No notes yet'}
            </Text>
            <Text style={s.cardLabel}>Last Performance Note</Text>
            <TextInput
              style={s.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Did 3 sets with 60 kg"
              multiline
              numberOfLines={4}
            />
            <Pressable
              style={[s.secondary, savingNote && s.disabled]}
              onPress={handleSaveNote}
              disabled={savingNote}
            >
              <Text style={s.secondaryText}>{savingNote ? 'Saving...' : 'Save Note'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 13, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },
  noteDate: { fontSize: 12, color: colors.textMuted },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primary: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  secondary: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, padding: 14,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});