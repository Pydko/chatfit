import { fetchExercises } from '@/features/workouts/api';
import { MUSCLE_LABELS, type Exercise } from '@/types/workout';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList, Modal,
  Pressable,
  StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
};

export function ExercisePicker({ visible, onClose, onSelect }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchExercises()
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        MUSCLE_LABELS[e.primary_muscle].toLowerCase().includes(q),
    );
  }, [exercises, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Select exercise</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={s.close}>Close</Text>
          </Pressable>
        </View>

        <TextInput
          style={s.search}
          placeholder="Search exercises..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="large" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                style={s.row}
                onPress={() => {
                  onSelect(item);
                  setQuery('');
                  onClose();
                }}
              >
                <Text style={s.rowName}>{item.name}</Text>
                <Text style={s.rowMeta}>{MUSCLE_LABELS[item.primary_muscle]}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={s.empty}>No results found.</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  close: { fontSize: 16, color: '#555' },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  empty: { textAlign: 'center', color: '#777', marginTop: 32 },
});