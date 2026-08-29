import { useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { startSession, fetchSessions, fetchSetLogs } from '@/features/workouts/api';
import type { WorkoutSession } from '@/types/workout';

export default function WorkoutTab() {
  const router = useRouter();
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [setCount, setSetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const sessions = await fetchSessions(1);
      const latest = sessions[0] ?? null;

      // Bugun baslamis bir seans varsa onu aktif say
      if (latest) {
        const sameDay =
          new Date(latest.performed_at).toDateString() === new Date().toDateString();
        if (sameDay) {
          setActive(latest);
          const logs = await fetchSetLogs(latest.id);
          setSetCount(logs.length);
          return;
        }
      }
      setActive(null);
      setSetCount(0);
    } catch {
      Alert.alert('Hata', 'Veriler yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleStart() {
    try {
      setBusy(true);
      const session = await startSession();
      router.push({ pathname: '/session/[id]', params: { id: session.id } });
    } catch {
      Alert.alert('Hata', 'Antrenman baslatilamadi.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {active ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Bugunku antrenman</Text>
          <Text style={s.cardMeta}>{setCount} set kaydedildi</Text>
          <Pressable
            style={s.primary}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: active.id } })}
          >
            <Text style={s.primaryText}>Devam et</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.cardTitle}>Hazir misin?</Text>
          <Text style={s.cardMeta}>Yeni bir antrenman baslat ve setlerini kaydet.</Text>
          <Pressable style={[s.primary, busy && s.disabled]} onPress={handleStart} disabled={busy}>
            <Text style={s.primaryText}>{busy ? 'Baslatiliyor...' : 'Antrenmana basla'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  cardMeta: { fontSize: 15, color: '#555' },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
