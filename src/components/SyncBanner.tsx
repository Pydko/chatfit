import { subscribeSync } from '@/lib/sync';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function SyncBanner() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    return subscribeSync((state) => {
      setPending(state.pending);
      setSyncing(state.syncing);
    });
  }, []);

  if (pending === 0) return null;

  return (
    <View style={s.banner}>
      {syncing ? <RefreshCw color="#8a6d1f" size={16} /> : <CloudOff color="#8a6d1f" size={16} />}
      <Text style={s.text}>
        {syncing
          ? `Syncing ${pending} record(s)...`
          : `${pending} record(s) pending sync`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fdf3d3', paddingHorizontal: 16, paddingVertical: 10,
  },
  text: { fontSize: 14, color: '#8a6d1f', flex: 1 },
});