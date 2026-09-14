import { Plus, Timer, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration, restProgress } from './duration';
import type { RestTimer } from './useRestTimer';

export function RestTimerBar({ timer }: { timer: RestTimer }) {
  if (!timer.running) return null;

  const progress = restProgress(timer.total, timer.remaining);

  return (
    <View style={s.wrap}>
      <View style={[s.progress, { width: `${progress * 100}%` }]} />

      <View style={s.row}>
        <Timer color="#fff" size={20} />
        <Text style={s.time}>{formatDuration(timer.remaining)}</Text>
        <Text style={s.label}>dinlenme</Text>

        <View style={s.actions}>
          <Pressable style={s.action} onPress={() => timer.addSeconds(30)} hitSlop={8}>
            <Plus color="#fff" size={16} />
            <Text style={s.actionText}>30 sn</Text>
          </Pressable>

          <Pressable style={s.action} onPress={timer.stop} hitSlop={8}>
            <X color="#fff" size={18} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#111', overflow: 'hidden' },
  progress: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: '#2563eb', opacity: 0.45,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  time: { color: '#fff', fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: '#bbb', fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});