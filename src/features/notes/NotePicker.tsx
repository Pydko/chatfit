import { fetchNotes, notePreview, type LocalNote } from '@/features/notes/api';
import { Check } from 'lucide-react-native';
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
  onConfirm: (notes: LocalNote[]) => void;
  initialSelectedIds?: string[];
  maxSelection?: number;
};

export function NotePicker({
  visible, onClose, onConfirm, initialSelectedIds = [], maxSelection = 3,
}: Props) {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);

  useEffect(() => {
    if (!visible) return;
    setSelected(initialSelectedIds);
    setLoading(true);
    fetchNotes()
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        (n.title ?? '').toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q),
    );
  }, [notes, query]);

  function toggle(note: LocalNote) {
    if (note.is_pending) return; // Not yet on server, cannot be sent as context
    setSelected((prev) =>
      prev.includes(note.id)
        ? prev.filter((id) => id !== note.id)
        : prev.length >= maxSelection
          ? prev
          : [...prev, note.id],
    );
  }

  function confirm() {
    onConfirm(notes.filter((n) => selected.includes(n.id)));
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Select Notes</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={s.close}>Close</Text>
          </Pressable>
        </View>

        <TextInput
          style={s.search}
          placeholder="Search notes..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />

        <Text style={s.hint}>
          You can add up to {maxSelection} notes. Selected note contents will be sent to the coach.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} size="large" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = selected.includes(item.id);
              return (
                <Pressable
                  style={[s.row, item.is_pending && s.rowDisabled]}
                  onPress={() => toggle(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{item.title || 'Untitled note'}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {notePreview(item.body, 60)}
                    </Text>
                    {item.is_pending && (
                      <Text style={s.pending}>Not synchronized - connection required first</Text>
                    )}
                  </View>
                  {isSelected && <Check color="#111" size={20} />}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={s.empty}>No notes found.</Text>}
          />
        )}

        <Pressable
          style={[s.primary, selected.length === 0 && s.disabled]}
          onPress={confirm}
          disabled={selected.length === 0}
        >
          <Text style={s.primaryText}>
            {selected.length > 0 ? `Add ${selected.length} note(s)` : 'Select notes'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  close: { fontSize: 16, color: '#555' },
  search: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  hint: { fontSize: 12, color: '#999', marginTop: 8, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  rowDisabled: { opacity: 0.45 },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  pending: { fontSize: 12, color: '#8a6d1f', marginTop: 4 },
  empty: { textAlign: 'center', color: '#777', marginTop: 32 },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});