import {
  deleteNote,
  fetchNoteById,
  purgeLocalNote,
  updateNote,
} from '@/features/notes/api';
import { noteSchema } from '@/features/notes/schemas';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDraft, setIsDraft] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const deletedRef = useRef(false);
  const latestRef = useRef({ title: '', body: '' });

  useEffect(() => { latestRef.current = { title, body }; }, [title, body]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchNoteById(id)
      .then((note) => {
        if (cancelled) return;
        if (!note) {
          Alert.alert('Error', 'Note not found.');
          return;
        }
        setTitle(note.title ?? '');
        setBody(note.body);
        setIsDraft(note.body.trim().length === 0);
      })
      .catch(() => Alert.alert('Error', 'Could not load note.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const save = useCallback(async () => {
    if (savingRef.current || !dirtyRef.current || !id || deletedRef.current) return;

    const parsed = noteSchema.safeParse({
      title: latestRef.current.title.trim() || null,
      body: latestRef.current.body,
    });

    if (!parsed.success) {
      // Empty notes are not saved, nor shown as error
      if (latestRef.current.body.trim().length === 0) return;
      setError(parsed.error.issues[0].message);
      setSaveState('error');
      return;
    }

    savingRef.current = true;
    dirtyRef.current = false;
    setSaveState('saving');
    setError(null);

    try {
      await updateNote(id, parsed.data);
      setIsDraft(false);
      setSaveState('saved');
    } catch {
      dirtyRef.current = true;
      setError('Could not save. Will retry when connected.');
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }, [id]);

  function onChange(next: { title?: string; body?: string }) {
    if (next.title !== undefined) setTitle(next.title);
    if (next.body !== undefined) setBody(next.body);
    dirtyRef.current = true;
    setSaveState('idle');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { save(); }, 1000);
  }

  // On exit: save pending changes, purge empty draft from local.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (deletedRef.current || !id) return;

      if (latestRef.current.body.trim().length === 0) {
        purgeLocalNote(id).catch(() => {});
      } else if (dirtyRef.current) {
        save();
      }
    };
  }, [id, save]);

  async function handleBack() {
    if (timerRef.current) clearTimeout(timerRef.current);
    await save();
    router.back();
  }

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      isDraft ? 'Discard Note' : 'Delete Note',
      isDraft
        ? 'This empty note will not be saved.'
        : 'This note will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDraft ? 'Discard' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            deletedRef.current = true;
            dirtyRef.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
            try {
              if (isDraft) {
                await purgeLocalNote(id);
              } else {
                await deleteNote(id);
              }
              router.back();
            } catch {
              deletedRef.current = false;
              Alert.alert('Error', 'Could not delete note.');
            }
          },
        },
      ],
    );
  }

  const statusText =
    saveState === 'saving' ? 'Saving...'
      : saveState === 'saved' ? 'Saved'
        : saveState === 'error' ? 'Failed to save'
          : '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable style={s.headerLeft} onPress={handleBack} hitSlop={12}>
            <ChevronLeft color="#111" size={24} />
            <Text style={s.headerBack}>Notes</Text>
          </Pressable>

          <Text style={s.headerStatus}>{statusText}</Text>

          <Pressable onPress={handleDelete} hitSlop={12} style={s.headerRight}>
            <Trash2 color="#c00" size={20} />
          </Pressable>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" /></View>
        ) : (
          <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={insets.top + 56}
          >
            <ScrollView
              contentContainerStyle={{ padding: 16, gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={s.titleInput}
                value={title}
                onChangeText={(t) => onChange({ title: t })}
                placeholder="Title (optional)"
                placeholderTextColor="#aaa"
                maxLength={120}
                returnKeyType="next"
              />

              <TextInput
                style={s.bodyInput}
                value={body}
                onChangeText={(t) => onChange({ body: t })}
                placeholder="Write your note..."
                placeholderTextColor="#aaa"
                multiline
                textAlignVertical="top"
                maxLength={20000}
              />

              <View style={s.footerRow}>
                {error ? (
                  <Text style={s.error}>{error}</Text>
                ) : (
                  <Text style={s.hint}>Changes are saved automatically.</Text>
                )}
                <Text style={s.counter}>{body.length} / 20000</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 52, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 90 },
  headerBack: { fontSize: 16, color: '#111' },
  headerStatus: { fontSize: 12, color: '#999' },
  headerRight: { minWidth: 90, alignItems: 'flex-end' },
  titleInput: {
    fontSize: 20, fontWeight: '700', color: '#111',
    borderBottomWidth: 1, borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  bodyInput: { fontSize: 16, lineHeight: 23, color: '#111', minHeight: 320, paddingVertical: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  hint: { fontSize: 12, color: '#bbb', flexShrink: 1 },
  error: { color: '#c00', fontSize: 12, flexShrink: 1 },
  counter: { fontSize: 12, color: '#bbb' },
});