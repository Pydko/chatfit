import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import {
  fetchActiveProgram, createProgram, renameProgram, deleteProgram,
  fetchProgramDays, addProgramDay, fetchDayExercises,
  type Program, type ProgramDay,
} from '@/features/workouts/programs';

export default function ProgramScreen() {
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const prog = await fetchActiveProgram();
      setProgram(prog);

      if (prog) {
        const d = await fetchProgramDays(prog.id);
        setDays(d);
        const entries = await Promise.all(
          d.map(async (day) => [day.id, (await fetchDayExercises(day.id)).length] as const),
        );
        setCounts(Object.fromEntries(entries));
      } else {
        setDays([]);
        setCounts({});
      }
    } catch {
      Alert.alert('Hata', 'Program yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleCreate() {
    try {
      setBusy(true);
      await createProgram(newName.trim() || 'Programim');
      setNewName('');
      await load();
    } catch {
      Alert.alert('Hata', 'Program olusturulamadi.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddDay() {
    if (!program) return;
    try {
      setBusy(true);
      await addProgramDay(program.id);
      await load();
    } catch {
      Alert.alert('Hata', 'Gun eklenemedi.');
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteProgram() {
    if (!program) return;
    Alert.alert('Programi sil', 'Tum gunler ve hareket listeleri silinecek.', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgram(program.id);
            await load();
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
      <Stack.Screen options={{ headerShown: true, title: 'Program' }} />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {!program ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Program olustur</Text>
            <Text style={s.cardMeta}>
              Antrenman gunlerini kendin tanimla. Adlarini istedigin gibi degistirebilirsin.
            </Text>
            <TextInput
              style={s.input}
              placeholder="Program adi (orn. Programim)"
              value={newName}
              onChangeText={setNewName}
            />
            <Pressable style={[s.primary, busy && s.disabled]} onPress={handleCreate} disabled={busy}>
              <Text style={s.primaryText}>{busy ? 'Olusturuluyor...' : 'Olustur'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ProgramHeader program={program} onRenamed={load} />

            <Text style={s.sectionTitle}>Gunler</Text>

            {days.length === 0 && (
              <Text style={s.empty}>Henuz gun eklemedin.</Text>
            )}

            {days.map((day) => (
              <Pressable
                key={day.id}
                style={s.dayCard}
                onPress={() => router.push({ pathname: '/program/day/[id]', params: { id: day.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.dayName}>{day.name}</Text>
                  <Text style={s.dayMeta}>{counts[day.id] ?? 0} hareket</Text>
                </View>
                <ChevronRight color="#bbb" size={20} />
              </Pressable>
            ))}

            <Pressable style={[s.secondary, busy && s.disabled]} onPress={handleAddDay} disabled={busy}>
              <Text style={s.secondaryText}>+ Gun ekle</Text>
            </Pressable>

            <Pressable onPress={handleDeleteProgram} style={{ marginTop: 24 }}>
              <Text style={s.danger}>Programi sil</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  );
}

function ProgramHeader({ program, onRenamed }: { program: Program; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(program.name);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await renameProgram(program.id, trimmed);
      setEditing(false);
      onRenamed();
    } catch {
      Alert.alert('Hata', 'Ad degistirilemedi.');
    }
  }

  if (editing) {
    return (
      <View style={s.card}>
        <TextInput style={s.input} value={name} onChangeText={setName} autoFocus />
        <Pressable style={s.primary} onPress={save}>
          <Text style={s.primaryText}>Kaydet</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable style={s.card} onPress={() => setEditing(true)}>
      <Text style={s.cardTitle}>{program.name}</Text>
      <Text style={s.cardMeta}>Adi degistirmek icin dokun</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, gap: 10 },
  cardTitle: { fontSize: 22, fontWeight: '700' },
  cardMeta: { fontSize: 14, color: '#666' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  empty: { color: '#777' },
  dayCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16,
  },
  dayName: { fontSize: 17, fontWeight: '600' },
  dayMeta: { fontSize: 14, color: '#666', marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  danger: { color: '#c00', textAlign: 'center' },
  disabled: { opacity: 0.5 },
});
