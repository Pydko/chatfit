import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from 'react-native';
import { setLogSchema } from '@/features/workouts/schemas';
import { fetchLastSetsForExercise } from '@/features/workouts/api';
import type { Exercise, SetLog } from '@/types/workout';

type Props = {
  exercise: Exercise;
  nextSetIndex: number;
  onSubmit: (input: {
    weight_kg: number;
    reps: number;
    rpe: number | null;
    is_warmup: boolean;
  }) => Promise<void>;
};

export function SetForm({ exercise, nextSetIndex, onSubmit }: Props) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [isWarmup, setIsWarmup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSets, setLastSets] = useState<SetLog[]>([]);

  useEffect(() => {
    fetchLastSetsForExercise(exercise.id, 3)
      .then(setLastSets)
      .catch(() => setLastSets([]));
  }, [exercise.id]);

  async function handleAdd() {
    setError(null);
    const parsed = setLogSchema.safeParse({
      weight_kg: Number(weight.replace(',', '.')),
      reps: Number(reps),
      rpe: rpe ? Number(rpe.replace(',', '.')) : null,
      is_warmup: isWarmup,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    try {
      setBusy(true);
      await onSubmit({
        weight_kg: parsed.data.weight_kg,
        reps: parsed.data.reps,
        rpe: parsed.data.rpe ?? null,
        is_warmup: parsed.data.is_warmup ?? false,
      });
      setReps('');
      setRpe('');
    } catch {
      setError('Set kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.exerciseName}>{exercise.name}</Text>

      {lastSets.length > 0 && (
        <Text style={s.lastSets}>
          Son: {lastSets.map((l) => `${l.weight_kg}kg x ${l.reps}`).join('  ')}
        </Text>
      )}

      <View style={s.inputRow}>
        <View style={s.inputGroup}>
          <Text style={s.label}>Agirlik (kg)</Text>
          <TextInput
            style={s.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.label}>Tekrar</Text>
          <TextInput
            style={s.input}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
          />
        </View>
        <View style={s.inputGroup}>
          <Text style={s.label}>RPE</Text>
          <TextInput
            style={s.input}
            value={rpe}
            onChangeText={setRpe}
            keyboardType="decimal-pad"
            placeholder="-"
          />
        </View>
      </View>

      <View style={s.warmupRow}>
        <Text style={s.label}>Isinma seti</Text>
        <Switch value={isWarmup} onValueChange={setIsWarmup} />
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, busy && s.disabled]} onPress={handleAdd} disabled={busy}>
        <Text style={s.buttonText}>
          {busy ? 'Kaydediliyor...' : `${nextSetIndex}. seti ekle`}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 12 },
  exerciseName: { fontSize: 18, fontWeight: '700' },
  lastSets: { fontSize: 13, color: '#666' },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1, gap: 4 },
  label: { fontSize: 13, color: '#555' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  warmupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00', fontSize: 14 },
});
