import { fetchNotes, notePreview, type LocalNote } from '@/features/notes/api';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList, Pressable, StyleSheet,
    Text, TextInput,
    View,
} from 'react-native';

export default function NotesTab() {
  const router = useRouter();
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setNotes(await fetchNotes());
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => (n.title ?? '').toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [notes, query]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <TextInput
        style={s.search}
        placeholder="Notlarda ara..."
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={s.empty}>
            {notes.length === 0
              ? 'Henuz notun yok. Antrenman notlarini buraya yaz, kocla paylas.'
              : 'Sonuc bulunamadi.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={s.row}
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
          >
            <Text style={s.rowTitle}>{item.title || 'Basliksiz not'}</Text>
            <Text style={s.rowPreview} numberOfLines={2}>{notePreview(item.body)}</Text>
            <Text style={s.rowMeta}>
              {new Date(item.updated_at).toLocaleString('tr-TR', {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
              })}
              {item.is_pending ? '  ·  Gonderilmeyi bekliyor' : ''}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        style={s.fab}
        onPress={() => router.push({ pathname: '/note/[id]', params: { id: 'new' } })}
      >
        <Plus color="#fff" size={24} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  search: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, margin: 16, marginBottom: 8,
  },
  empty: { textAlign: 'center', color: '#777', marginTop: 48, paddingHorizontal: 32, lineHeight: 22 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowPreview: { fontSize: 14, color: '#555', marginTop: 4, lineHeight: 19 },
  rowMeta: { fontSize: 12, color: '#999', marginTop: 6 },
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    backgroundColor: '#111', width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
});