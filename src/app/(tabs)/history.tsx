import { fetchStatsData } from '@/features/stats/api';
import {
  buildWeeklyStats,
  formatVolume,
  summarizeSessions,
  type SessionStat,
  type WeeklyStats,
} from '@/features/stats/summary';
import { fetchSessions } from '@/features/workouts/api';
import type { WorkoutSession } from '@/types/workout';
import { useFocusEffect, useRouter } from 'expo-router';
import { Flame, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function HistoryTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [stats, setStats] = useState<Map<string, SessionStat>>(new Map());
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const [list, data] = await Promise.all([fetchSessions(50), fetchStatsData(28)]);

      setSessions(list);
      setStats(summarizeSessions(data.sets));
      setWeekly(
        data.sessions.length > 0 || data.sets.length > 0
          ? buildWeeklyStats(data.sets, data.sessions)
          : null,
      );
    } catch {
      setSessions([]);
      setStats(new Map());
      setWeekly(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const header = useMemo(() => {
    if (!weekly) return null;
    return <WeeklySummary stats={weekly} />;
  }, [weekly]);

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
      ListHeaderComponent={header}
      renderItem={({ item }) => {
        const stat = stats.get(item.id);
        return (
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
            {stat && (
              <Text style={s.rowStat}>
                {stat.exerciseCount} hareket  ·  {stat.setCount} set  ·  {formatVolume(stat.volumeKg)}
              </Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

function WeeklySummary({ stats }: { stats: WeeklyStats }) {
  const { current, volumeChangePct, weekStreak } = stats;
  const up = volumeChangePct !== null && volumeChangePct >= 0;

  return (
    <View style={s.summary}>
      <View style={s.summaryHead}>
        <Text style={s.summaryLabel}>Son 7 gun</Text>
        {weekStreak > 0 && (
          <View style={s.streak}>
            <Flame color="#d97706" size={16} />
            <Text style={s.streakText}>{weekStreak} hafta seri</Text>
          </View>
        )}
      </View>

      <View style={s.metricRow}>
        <Metric value={String(current.sessions)} label="antrenman" />
        <Metric value={String(current.sets)} label="set" />
        <Metric value={formatVolume(current.volumeKg)} label="hacim" />
      </View>

      {volumeChangePct !== null && (
        <View style={s.changeRow}>
          {up ? (
            <TrendingUp color="#16a34a" size={16} />
          ) : (
            <TrendingDown color="#dc2626" size={16} />
          )}
          <Text style={[s.changeText, { color: up ? '#16a34a' : '#dc2626' }]}>
            Onceki haftaya gore {up ? '+' : ''}{volumeChangePct}% hacim
          </Text>
        </View>
      )}

      {current.sessions === 0 && (
        <Text style={s.summaryHint}>Bu hafta henuz antrenman yapmadin.</Text>
      )}
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  empty: { fontSize: 16, color: '#666', textAlign: 'center' },

  summary: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, margin: 16, gap: 12 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontSize: 13, fontWeight: '600', color: '#d97706' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { flex: 1, gap: 2 },
  metricValue: { fontSize: 22, fontWeight: '700' },
  metricLabel: { fontSize: 13, color: '#666' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeText: { fontSize: 14, fontWeight: '500' },
  summaryHint: { fontSize: 14, color: '#777' },

  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 14, color: '#666', marginTop: 4 },
  rowStat: { fontSize: 13, color: '#888', marginTop: 6 },
});