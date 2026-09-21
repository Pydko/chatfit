import { suggestProgression, suggestWeightForTargetReps } from '@/features/progress/progression';
import { analyzeTrend, estimateWeeksToTarget } from '@/features/progress/trend';
import { VideoSection } from '@/features/videos/VideoSection';
import { fetchExerciseById, fetchExerciseHistory } from '@/features/workouts/api';
import { groupBySession, summarizeSets, summarizeWeight } from '@/features/workouts/summary';
import { MUSCLE_LABELS, type Exercise, type SetLog } from '@/types/workout';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<SetLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [ex, logs] = await Promise.all([
        fetchExerciseById(id),
        fetchExerciseHistory(id),
      ]);
      setExercise(ex);
      setHistory(logs);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sessions = useMemo(() => {
    const grouped = Array.from(groupBySession(history).entries());
    return grouped.sort((a, b) => {
      const da = new Date(a[1][0].performed_at).getTime();
      const db = new Date(b[1][0].performed_at).getTime();
      return db - da;
    });
  }, [history]);

  const best = useMemo(() => {
    const working = history.filter((h) => !h.is_warmup);
    if (working.length === 0) return null;
    return working.reduce((a, b) => (b.weight_kg > a.weight_kg ? b : a));
  }, [history]);

  // Trend analysis
  const trend = useMemo(() => {
    if (history.length < 3) return null;
    return analyzeTrend(history);
  }, [history]);

  // Progression suggestion
  const lastSession = useMemo(() => {
    if (sessions.length === 0) return [];
    return sessions[0][1]; // sets of the newest session
  }, [sessions]);

  const progression = useMemo(() => {
    if (lastSession.length === 0) return null;
    const previousSessions = sessions.slice(1, 4).map((s) => s[1]);
    return suggestProgression({
      lastSessionSets: lastSession,
      previousSessions,
      targetRepsMin: 8,
      targetRepsMax: 12,
    });
  }, [lastSession, sessions]);

  // Target weight
  const targetWeight = useMemo(() => {
    if (best && history.length > 0) {
      return suggestWeightForTargetReps(history, 6);
    }
    return null;
  }, [best, history]);

  // Weeks to target
  const weeksToTarget = useMemo(() => {
    if (!targetWeight || targetWeight <= 0) return null;
    return estimateWeeksToTarget(history, targetWeight + 5);
  }, [targetWeight, history]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: exercise?.name ?? 'Exercise' }} />
      <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {exercise && (
          <View style={s.header}>
            <Text style={s.name}>{exercise.name}</Text>
            <Text style={s.muscle}>{MUSCLE_LABELS[exercise.primary_muscle]}</Text>
          </View>
        )}

        {best && (
          <View style={s.statCard}>
            <Text style={s.statLabel}>Personal Best Set</Text>
            <Text style={s.statValue}>
              {best.weight_kg} kg x {best.reps}
            </Text>
            <Text style={s.statDate}>
              {new Date(best.performed_at).toLocaleDateString('en-US')}
            </Text>
          </View>
        )}

        {/* Trend Badge */}
        {trend && trend.direction !== 'insufficient' && (
          <View style={s.trendCard}>
            <View style={s.trendHeader}>
              {trend.direction === 'up' && (
                <>
                  <TrendingUp color="#22c55e" size={20} />
                  <Text style={[s.trendLabel, { color: '#22c55e' }]}>
                    {Math.abs(trend.changePercent).toFixed(1)}% progress
                  </Text>
                </>
              )}
              {trend.direction === 'down' && (
                <>
                  <TrendingDown color="#ef4444" size={20} />
                  <Text style={[s.trendLabel, { color: '#ef4444' }]}>
                    {Math.abs(trend.changePercent).toFixed(1)}% regression
                  </Text>
                </>
              )}
              {trend.direction === 'flat' && (
                <>
                  <Minus color="#8b5cf6" size={20} />
                  <Text style={[s.trendLabel, { color: '#8b5cf6' }]}>Stable performance</Text>
                </>
              )}
            </View>
            <Text style={s.trendSummary}>{trend.summary}</Text>
          </View>
        )}

        {/* Progression Suggestion */}
        {progression && progression.action !== 'no_data' && (
          <View style={s.suggestionCard}>
            <Text style={s.suggestionTitle}>Next Step</Text>
            <View style={s.actionRow}>
              <Text style={s.actionLabel}>
                {progression.action === 'increase_weight' && '📈 Increase Weight'}
                {progression.action === 'add_reps' && '➕ Add Reps'}
                {progression.action === 'hold' && '⏸️ Hold'}
                {progression.action === 'deload' && '⬇️ Deload'}
              </Text>
            </View>
            <Text style={s.suggestionDetail}>
              {progression.weightKg} kg x {progression.reps}
            </Text>
            <Text style={s.suggestionReason}>{progression.reason}</Text>
            <View style={s.confidenceRow}>
              <View
                style={[
                  s.confidenceBadge,
                  {
                    backgroundColor:
                      progression.confidence === 'high'
                        ? '#dbeafe'
                        : progression.confidence === 'medium'
                          ? '#fef08a'
                          : '#fee2e2',
                  },
                ]}
              >
                <Text
                  style={[
                    s.confidenceText,
                    {
                      color:
                        progression.confidence === 'high'
                          ? '#0369a1'
                          : progression.confidence === 'medium'
                            ? '#854d0e'
                            : '#991b1b',
                    },
                  ]}
                >
                  {progression.confidence === 'high' && 'High confidence'}
                  {progression.confidence === 'medium' && 'Medium confidence'}
                  {progression.confidence === 'low' && 'Low confidence'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Target Weight */}
        {targetWeight !== null && targetWeight > 0 ? (
          <View style={s.targetCard}>
            <Text style={s.targetLabel}>Target Weight (6 reps)</Text>
            <Text style={s.targetValue}>{targetWeight.toFixed(1)} kg</Text>
            {weeksToTarget?.weeks != null && weeksToTarget.weeks > 0 ? (
              <Text style={s.targetNote}>
                ~in {weeksToTarget.weeks} weeks
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Form Videos */}
        {id ? <VideoSection key={id} exerciseId={id} /> : null}

        <Text style={s.sectionTitle}>History ({sessions.length} workouts)</Text>

        {sessions.length === 0 ? (
          <Text style={s.empty}>You haven't performed this exercise yet.</Text>
        ) : (
          sessions.map(([sessionId, sets]) => (
            <View key={sessionId} style={s.sessionCard}>
              <Text style={s.sessionDate}>
                {new Date(sets[0].performed_at).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
              <Text style={s.sessionSummary}>
                {summarizeSets(sets)}  ·  {summarizeWeight(sets)}
              </Text>
              <View style={s.setList}>
                {[...sets]
                  .sort((a, b) => a.set_index - b.set_index)
                  .map((set) => (
                    <Text key={set.id} style={s.setLine}>
                      {set.set_index}. {set.weight_kg} kg x {set.reps}
                      {set.rpe ? `  RPE ${set.rpe}` : ''}
                      {set.is_warmup ? '  (warmup)' : ''}
                    </Text>
                  ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { gap: 4 },
  name: { fontSize: 24, fontWeight: '700' },
  muscle: { fontSize: 15, color: '#666' },
  statCard: { backgroundColor: '#111', borderRadius: 12, padding: 16, gap: 4 },
  statLabel: { fontSize: 13, color: '#aaa' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
  statDate: { fontSize: 13, color: '#aaa' },
  trendCard: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  trendHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trendLabel: { fontSize: 14, fontWeight: '600' },
  trendSummary: { fontSize: 13, color: '#555', lineHeight: 18 },
  suggestionCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  suggestionTitle: { fontSize: 14, fontWeight: '600', color: '#0369a1' },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  actionLabel: { fontSize: 16, fontWeight: '600' },
  suggestionDetail: { fontSize: 18, fontWeight: '700', color: '#1e40af' },
  suggestionReason: { fontSize: 13, color: '#555', lineHeight: 18 },
  confidenceRow: { flexDirection: 'row', marginTop: 4 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  confidenceText: { fontSize: 12, fontWeight: '500' },
  targetCard: {
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  targetLabel: { fontSize: 13, color: '#7c3aed' },
  targetValue: { fontSize: 20, fontWeight: '700', color: '#7c3aed' },
  targetNote: { fontSize: 12, color: '#a78bfa' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  empty: { color: '#777' },
  sessionCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 6 },
  sessionDate: { fontSize: 15, fontWeight: '600' },
  sessionSummary: { fontSize: 14, color: '#666' },
  setList: { marginTop: 6, gap: 2 },
  setLine: { fontSize: 14, color: '#444' },
});