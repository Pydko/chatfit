import { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchSessions } from '@/features/workouts/api';
import type { WorkoutSession } from '@/types/workout';

export default function HistoryTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setSessions(await fetchSessions(50));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>Henuz antrenman kaydin yok.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={s.list}
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          style={s.row}
          onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
        >
          <Text style={s.rowTitle}>
            {item.title ?? new Date(item.performed_at).toLocaleDateString('tr-TR')}
          </Text>
          <Text style={s.rowMeta}>
            {new Date(item.performed_at).toLocaleString('tr-TR', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { fontSize: 16, color: '#666', textAlign: 'center' },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 14, color: '#666', marginTop: 4 },
});
