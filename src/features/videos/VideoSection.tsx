import {
  searchVideosForExercise,
  VideoLimitError,
  youtubeWatchUrl,
  type VideoLang,
  type VideoResult,
} from '@/features/videos/api';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { PlayCircle } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  exerciseId: string;
};

const LANGS: { value: VideoLang; label: string }[] = [
  { value: 'tr', label: 'TR' },
  { value: 'en', label: 'EN' },
];

export function VideoSection({ exerciseId }: Props) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<VideoLang>('tr');
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [stale, setStale] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLimit, setIsLimit] = useState(false);

  // Prevent fast language switches from overwriting new responses with old ones
  const requestId = useRef(0);

  async function load(nextLang: VideoLang) {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    setIsLimit(false);

    try {
      const data = await searchVideosForExercise(exerciseId, nextLang);
      if (current !== requestId.current) return;
      setVideos(data.results);
      setStale(data.stale);
      setRemaining(data.remaining ?? null);
    } catch (e) {
      if (current !== requestId.current) return;
      setVideos([]);
      setStale(false);
      setRemaining(null);
      setIsLimit(e instanceof VideoLimitError);
      setError(e instanceof Error ? e.message : 'Could not fetch videos.');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    load(lang);
  }

  function handleLang(next: VideoLang) {
    if (next === lang) return;
    setLang(next);
    load(next);
  }

  async function openVideo(video: VideoResult) {
    try {
      await WebBrowser.openBrowserAsync(youtubeWatchUrl(video.videoId));
    } catch (e) {
      console.log('VIDEO OPEN ERROR:', e);
      Alert.alert('Error', 'Could not open video.');
    }
  }

  // Quota friendly: videos are only searched when requested by the user
  if (!open) {
    return (
      <Pressable style={s.openButton} onPress={handleOpen}>
        <PlayCircle color="#111" size={20} />
        <Text style={s.openButtonText}>Show form videos</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.title}>Form videos</Text>
        <View style={s.langRow}>
          {LANGS.map((l) => (
            <Pressable
              key={l.value}
              style={[s.langChip, lang === l.value && s.langChipActive]}
              onPress={() => handleLang(l.value)}
              disabled={loading}
            >
              <Text style={[s.langText, lang === l.value && s.langTextActive]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && <ActivityIndicator style={s.loader} />}

      {!loading && error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
          {!isLimit && (
            <Pressable onPress={() => load(lang)}>
              <Text style={s.retry}>Try again</Text>
            </Pressable>
          )}
        </View>
      )}

      {!loading && !error && videos.length === 0 && (
        <Text style={s.empty}>No videos found for this exercise.</Text>
      )}

      {!loading && stale && videos.length > 0 && (
        <Text style={s.notice}>Could not fetch latest results, showing previous results.</Text>
      )}

      {!loading &&
        videos.map((video) => (
          <Pressable key={video.videoId} style={s.row} onPress={() => openVideo(video)}>
            {video.thumbnail ? (
              <Image
                source={{ uri: video.thumbnail }}
                style={s.thumb}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[s.thumb, s.thumbPlaceholder]} />
            )}
            <View style={s.info}>
              <Text style={s.videoTitle} numberOfLines={2}>
                {video.title}
              </Text>
              <Text style={s.channel} numberOfLines={1}>
                {video.channel}
              </Text>
            </View>
          </Pressable>
        ))}

      {!loading && remaining !== null && (
        <Text style={s.remaining}>Remaining new searches today: {remaining}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 12,
    padding: 14,
  },
  openButtonText: { fontSize: 15, fontWeight: '600' },
  container: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700' },
  langRow: { flexDirection: 'row', gap: 6 },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  langChipActive: { backgroundColor: '#111', borderColor: '#111' },
  langText: { fontSize: 12, fontWeight: '600', color: '#555' },
  langTextActive: { color: '#fff' },
  loader: { marginVertical: 16 },
  errorBox: { gap: 6, paddingVertical: 4 },
  errorText: { fontSize: 13, color: '#c00' },
  retry: { fontSize: 13, fontWeight: '600', color: '#0369a1' },
  empty: { fontSize: 13, color: '#777' },
  notice: { fontSize: 12, color: '#8a6d1f' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: { width: 120, height: 68, borderRadius: 8, backgroundColor: '#ddd' },
  thumbPlaceholder: { backgroundColor: '#ddd' },
  info: { flex: 1, gap: 2 },
  videoTitle: { fontSize: 14, fontWeight: '500', color: '#111' },
  channel: { fontSize: 12, color: '#777' },
  remaining: { fontSize: 11, color: '#999', textAlign: 'right' },
});