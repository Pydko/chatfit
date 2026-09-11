import {
    deleteBodyMetric,
    fetchBodyMetrics,
    fetchHeightCm,
    saveBodyMetric,
    saveHeightCm,
} from '@/features/body/api';
import {
    BMI_LABELS,
    bmiCategory,
    bodyComposition,
    calculateBmi,
    calculateFfmi,
    weeklyWeightRate,
    weightTrend,
    type WeeklyRate,
} from '@/features/body/calculations';
import { localIsoDate, validateHeight, validateMetricForm } from '@/features/body/schemas';
import type { BodyMetric } from '@/types/body';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

type DayOption = 'today' | 'yesterday';

// Ekranda gosterilen en fazla gecmis satiri (hesaplar yine tum veriyi kullanir)
const HISTORY_LIMIT = 60;

const CONFIDENCE_LABELS: Record<WeeklyRate['confidence'], string> = {
  low: 'dusuk guven',
  medium: 'orta guven',
  high: 'yuksek guven',
};

function isoForOption(option: DayOption): string {
  const d = new Date();
  if (option === 'yesterday') d.setDate(d.getDate() - 1);
  return localIsoDate(d);
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

function toInputText(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

// 'YYYY-MM-DD' yerel tarih olarak yorumlanir (new Date(iso) UTC kabul eder, kayabilir)
function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  });
}

export default function BodyScreen() {
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [day, setDay] = useState<DayOption>('today');
  const dayRef = useRef<DayOption>('today');
  const [weightText, setWeightText] = useState('');
  const [bodyFatText, setBodyFatText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingHeight, setEditingHeight] = useState(false);
  const [heightText, setHeightText] = useState('');
  const [heightError, setHeightError] = useState<string | null>(null);

  // Secilen gunde olcum varsa formu onunla doldur.
  // Upsert bos alani null yazdigi icin bu, mevcut degerin kazara silinmesini onler.
  const fillForm = useCallback((option: DayOption, list: BodyMetric[]) => {
    const existing = list.find((m) => m.measured_on === isoForOption(option));
    setWeightText(toInputText(existing?.weight_kg ?? null));
    setBodyFatText(toInputText(existing?.body_fat_pct ?? null));
    setFormError(null);
  }, []);

  const load = useCallback(
    async (showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        const [list, height] = await Promise.all([fetchBodyMetrics(), fetchHeightCm()]);
        setMetrics(list);
        setHeightCm(height);
        fillForm(dayRef.current, list);
      } catch (e) {
        console.log('BODY LOAD ERROR:', e);
        Alert.alert('Hata', 'Olcumler yuklenemedi.');
      } finally {
        setLoading(false);
      }
    },
    [fillForm],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const summary = useMemo(() => {
    const points = weightTrend(metrics);
    const latest = points.length > 0 ? points[points.length - 1] : null;
    const rate = weeklyWeightRate(metrics);
    const bmi = latest && heightCm ? calculateBmi(latest.weightKg, heightCm) : null;

    // Kompozisyon icin ayni gun hem kilo hem yag orani olan en son olcum
    const withFat =
      [...metrics].reverse().find((m) => m.weight_kg !== null && m.body_fat_pct !== null) ?? null;
    const composition = withFat
      ? bodyComposition(withFat.weight_kg!, withFat.body_fat_pct!)
      : null;
    const ffmi =
      composition && heightCm ? calculateFfmi(composition.leanMassKg, heightCm) : null;

    const trendByDate = new Map(points.map((p) => [p.date, p.trendKg]));
    const history = [...metrics].reverse().slice(0, HISTORY_LIMIT);

    return { latest, rate, bmi, withFat, composition, ffmi, trendByDate, history };
  }, [metrics, heightCm]);

  function selectDay(option: DayOption) {
    dayRef.current = option;
    setDay(option);
    fillForm(option, metrics);
  }

  async function handleSave() {
    const result = validateMetricForm(
      { measuredOn: isoForOption(day), weightText, bodyFatText },
      localIsoDate(),
    );
    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    try {
      setSaving(true);
      setFormError(null);
      await saveBodyMetric(result.data);
      await load(false);
    } catch (e) {
      console.log('BODY SAVE ERROR:', e);
      setFormError('Kaydedilemedi. Internet baglantini kontrol et.');
    } finally {
      setSaving(false);
    }
  }

  function startEditHeight() {
    setHeightText(toInputText(heightCm));
    setHeightError(null);
    setEditingHeight(true);
  }

  async function handleSaveHeight() {
    const result = validateHeight(heightText);
    if (!result.ok) {
      setHeightError(result.error);
      return;
    }

    try {
      await saveHeightCm(result.data);
      setHeightCm(result.data);
      setEditingHeight(false);
      setHeightError(null);
    } catch (e) {
      console.log('HEIGHT SAVE ERROR:', e);
      setHeightError('Boy kaydedilemedi.');
    }
  }

  function handleDelete(metric: BodyMetric) {
    Alert.alert(formatDay(metric.measured_on), 'Bu olcum silinecek.', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBodyMetric(metric.id);
            await load(false);
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Vucut takibi' }} />
        <View style={s.center}><ActivityIndicator size="large" /></View>
      </>
    );
  }

  const { latest, rate, bmi, withFat, composition, ffmi, trendByDate, history } = summary;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Vucut takibi' }} />
      <ScrollView
        style={s.container}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============ OLCUM GIRISI ============ */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Olcum ekle</Text>

          <View style={s.chipRow}>
            {(['today', 'yesterday'] as const).map((option) => (
              <Pressable
                key={option}
                style={[s.chip, day === option && s.chipActive]}
                onPress={() => selectDay(option)}
              >
                <Text style={[s.chipText, day === option && s.chipTextActive]}>
                  {option === 'today' ? 'Bugun' : 'Dun'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={s.inputRow}>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Kilo (kg)</Text>
              <TextInput
                style={s.input}
                value={weightText}
                onChangeText={setWeightText}
                placeholder="80,5"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
                maxLength={6}
              />
            </View>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Yag orani (%)</Text>
              <TextInput
                style={s.input}
                value={bodyFatText}
                onChangeText={setBodyFatText}
                placeholder="Istege bagli"
                placeholderTextColor="#aaa"
                keyboardType="decimal-pad"
                maxLength={4}
              />
            </View>
          </View>

          {formError && <Text style={s.error}>{formError}</Text>}

          <Pressable
            style={[s.primary, saving && s.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.primaryText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
          </Pressable>
        </View>

        {/* ============ OZET ============ */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Ozet</Text>

          {latest ? (
            <>
              <View style={s.statRow}>
                <View style={s.stat}>
                  <Text style={s.statValue}>{fmt(latest.weightKg)} kg</Text>
                  <Text style={s.statLabel}>Son olcum</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statValue}>{fmt(latest.trendKg)} kg</Text>
                  <Text style={s.statLabel}>Trend</Text>
                </View>
              </View>

              <Text style={s.cardMeta}>
                {rate
                  ? `Haftalik degisim: ${rate.kgPerWeek > 0 ? '+' : ''}${fmt(rate.kgPerWeek, 2)} kg (${CONFIDENCE_LABELS[rate.confidence]}, ${rate.entries} olcum)`
                  : 'Haftalik degisim icin son 4 haftada, en az 1 haftaya yayilmis 4 olcum gerekli.'}
              </Text>

              <Text style={s.hint}>
                Trend, gunluk su ve tuz dalgalanmalarini yumusatir. Ilerlemeyi tek olcume degil trende gore degerlendir.
              </Text>
            </>
          ) : (
            <Text style={s.cardMeta}>Henuz kilo olcumun yok. Ilk olcumunu yukaridan ekle.</Text>
          )}
        </View>

        {/* ============ BOY + INDEKSLER ============ */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Vucut indeksleri</Text>

          {heightCm !== null && !editingHeight ? (
            <Pressable style={s.heightRow} onPress={startEditHeight}>
              <Text style={s.cardMeta}>Boy: {toInputText(heightCm)} cm</Text>
              <Text style={s.link}>Degistir</Text>
            </Pressable>
          ) : (
            <>
              <Text style={s.cardMeta}>BMI ve FFMI hesabi icin boyunu gir.</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={heightText}
                  onChangeText={setHeightText}
                  placeholder="175"
                  placeholderTextColor="#aaa"
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <Pressable style={s.smallButton} onPress={handleSaveHeight}>
                  <Text style={s.primaryText}>Kaydet</Text>
                </Pressable>
              </View>
              {heightError && <Text style={s.error}>{heightError}</Text>}
              {heightCm !== null && (
                <Pressable onPress={() => setEditingHeight(false)}>
                  <Text style={s.link}>Vazgec</Text>
                </Pressable>
              )}
            </>
          )}

          {bmi !== null && (
            <View style={s.indexBlock}>
              <Text style={s.statValue}>BMI {fmt(bmi)}</Text>
              <Text style={s.cardMeta}>{BMI_LABELS[bmiCategory(bmi)]}</Text>
              <Text style={s.hint}>
                BMI kas kutlesini ayirt etmez; kasli kisilerde oldugundan yuksek cikabilir.
              </Text>
            </View>
          )}

          {composition && withFat ? (
            <View style={s.indexBlock}>
              <Text style={s.cardMeta}>
                Yagsiz kutle {fmt(composition.leanMassKg)} kg  ·  Yag kutlesi {fmt(composition.fatMassKg)} kg
              </Text>
              {ffmi && (
                <Text style={s.cardMeta}>
                  FFMI {fmt(ffmi.ffmi)} (boya gore duzeltilmis {fmt(ffmi.normalized)})
                </Text>
              )}
              <Text style={s.hint}>
                {formatDay(withFat.measured_on)} tarihli olcume gore. Tartilarin yag orani tahmini birkac puan sapabilir.
              </Text>
            </View>
          ) : (
            latest && (
              <Text style={s.hint}>Yag orani girersen yagsiz kutle ve FFMI de hesaplanir.</Text>
            )
          )}
        </View>

        {/* ============ GECMIS ============ */}
        {history.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Gecmis</Text>

            {history.map((m) => {
              const trend = trendByDate.get(m.measured_on);
              return (
                <Pressable key={m.id} style={s.row} onLongPress={() => handleDelete(m)}>
                  <Text style={s.rowDate}>{formatDay(m.measured_on)}</Text>
                  <View style={s.rowValues}>
                    {m.weight_kg !== null && (
                      <Text style={s.rowWeight}>{fmt(m.weight_kg)} kg</Text>
                    )}
                    {trend !== undefined && <Text style={s.rowMeta}>trend {fmt(trend)}</Text>}
                    {m.body_fat_pct !== null && (
                      <Text style={s.rowMeta}>%{fmt(m.body_fat_pct)} yag</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}

            <Text style={[s.hint, { marginTop: 8 }]}>Silmek icin olcume uzun bas.</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 10 },
  cardLabel: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardMeta: { fontSize: 15, color: '#444' },
  hint: { fontSize: 12, color: '#999', lineHeight: 17 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  inputGroup: { flex: 1, gap: 4 },
  inputLabel: { fontSize: 13, color: '#666' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  primary: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  smallButton: { backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 13 },
  disabled: { opacity: 0.5 },
  error: { color: '#c00', fontSize: 13 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111' },
  statLabel: { fontSize: 13, color: '#888', marginTop: 2 },
  heightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 14, color: '#555', textDecorationLine: 'underline' },
  indexBlock: { gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  rowDate: { fontSize: 15, color: '#111' },
  rowValues: { alignItems: 'flex-end', gap: 2 },
  rowWeight: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12, color: '#888' },
});