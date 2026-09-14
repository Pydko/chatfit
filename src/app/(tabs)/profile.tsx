import { useAuth } from '@/features/auth/AuthProvider';
import { exportAllData, fetchSettings, saveSettings } from '@/features/settings/api';
import type { UnitSystem } from '@/features/settings/units';
import { REST_PRESETS, formatDuration } from '@/features/timer/duration';
import { supabase } from '@/lib/supabase';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ChevronRight, Download } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

export default function ProfileTab() {
  const { session } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [restSeconds, setRestSeconds] = useState(90);
  const [editingName, setEditingName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await fetchSettings();
      setDisplayName(settings.displayName ?? '');
      setUnitSystem(settings.unitSystem);
      setRestSeconds(settings.defaultRestSeconds);
    } catch {
      // cevrimdisi olabilir, varsayilanlarla devam
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSaveName() {
    const trimmed = displayName.trim();
    if (!trimmed) return;

    try {
      await saveSettings({ display_name: trimmed });
      setEditingName(false);
    } catch {
      Alert.alert('Hata', 'Ad kaydedilemedi.');
    }
  }

  async function handleUnitChange(unit: UnitSystem) {
    const previous = unitSystem;
    setUnitSystem(unit);
    try {
      await saveSettings({ unit_system: unit });
    } catch {
      setUnitSystem(previous);
      Alert.alert('Hata', 'Birim degistirilemedi.');
    }
  }

  async function handleRestChange(seconds: number) {
    const previous = restSeconds;
    setRestSeconds(seconds);
    try {
      await saveSettings({ default_rest_seconds: seconds });
    } catch {
      setRestSeconds(previous);
      Alert.alert('Hata', 'Dinlenme suresi kaydedilemedi.');
    }
  }

  async function handleExport() {
    try {
      setExporting(true);

      const json = await exportAllData();
      const file = new File(Paths.cache, 'chatfit-verilerim.json');
      file.create({ overwrite: true });
      file.write(json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'ChatFit verilerini disa aktar',
        });
      } else {
        Alert.alert('Hazir', `Dosya olusturuldu: ${file.uri}`);
      }
    } catch {
      Alert.alert('Hata', 'Veriler disa aktarilamadi.');
    } finally {
      setExporting(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Hesabini sil',
      'Tum antrenman kayitlarin, notlarin ve sohbet gecmisin kalici olarak silinecek. Bu islem geri alinamaz.',
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Hesabi sil',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_own_account');
            if (error) {
              Alert.alert('Hata', 'Hesap silinemedi. Lutfen tekrar dene.');
              return;
            }
            await supabase.auth.signOut();
          },
        },
      ],
    );
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, gap: 24, paddingBottom: 48 }}>
      {/* ============ HESAP ============ */}
      <View style={s.card}>
        {editingName ? (
          <>
            <TextInput
              style={s.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Adin"
              autoFocus
              maxLength={50}
            />
            <Pressable style={s.primary} onPress={handleSaveName}>
              <Text style={s.primaryText}>Kaydet</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => setEditingName(true)}>
            <Text style={s.name}>{displayName || 'Adin yok'}</Text>
            <Text style={s.email}>{session?.user.email}</Text>
            <Text style={s.hint}>Adi degistirmek icin dokun</Text>
          </Pressable>
        )}
      </View>

      {/* ============ BIRIM ============ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Birim sistemi</Text>
        <View style={s.chipRow}>
          {(['metric', 'imperial'] as const).map((unit) => (
            <Pressable
              key={unit}
              style={[s.chip, unitSystem === unit && s.chipActive]}
              onPress={() => handleUnitChange(unit)}
            >
              <Text style={[s.chipText, unitSystem === unit && s.chipTextActive]}>
                {unit === 'metric' ? 'kg / cm' : 'lb / inch'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ============ DINLENME ============ */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Varsayilan dinlenme suresi</Text>
        <View style={s.chipRow}>
          {REST_PRESETS.map((seconds) => (
            <Pressable
              key={seconds}
              style={[s.chip, restSeconds === seconds && s.chipActive]}
              onPress={() => handleRestChange(seconds)}
            >
              <Text style={[s.chipText, restSeconds === seconds && s.chipTextActive]}>
                {formatDuration(seconds)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ============ BAGLANTILAR ============ */}
      <View style={s.section}>
        <Pressable style={s.row} onPress={() => router.push('/body')}>
          <Text style={s.rowText}>Vucut takibi</Text>
          <ChevronRight color="#bbb" size={20} />
        </Pressable>

        <Pressable style={s.row} onPress={handleExport} disabled={exporting}>
          <Text style={s.rowText}>
            {exporting ? 'Hazirlaniyor...' : 'Verilerimi disa aktar'}
          </Text>
          <Download color="#bbb" size={20} />
        </Pressable>
      </View>

      {/* ============ HESAP ISLEMLERI ============ */}
      <View style={s.section}>
        <Pressable style={s.signOut} onPress={() => supabase.auth.signOut()}>
          <Text style={s.signOutText}>Cikis yap</Text>
        </Pressable>

        <Pressable onPress={handleDeleteAccount} style={{ marginTop: 16 }}>
          <Text style={s.danger}>Hesabimi sil</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 20, gap: 10 },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 15, color: '#666', marginTop: 4 },
  hint: { fontSize: 12, color: '#999', marginTop: 8 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  rowText: { fontSize: 16 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: { borderWidth: 1, borderColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  signOutText: { fontSize: 16, fontWeight: '600' },
  danger: { color: '#c00', textAlign: 'center' },
});