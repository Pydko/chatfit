import { fetchBodyMetrics, fetchHeightCm } from '@/features/body/api';
import { buildBodySummary, type BodySummary } from '@/features/body/summary';
import {
  createNewThread, sendMessageStream,
  type ChatMessage,
  type ChatThread,
} from '@/features/chat/api';
import { chatMessageSchema } from '@/features/chat/schema';
import { NotePicker } from '@/features/notes/NotePicker';
import type { LocalNote } from '@/features/notes/api';
import { Paperclip, Scale, Send, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

type DisplayMessage = ChatMessage & {
  pending?: boolean;
  noteLabels?: string[];
  withBody?: boolean;
};

export default function ChatTab() {
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [attached, setAttached] = useState<LocalNote[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sendBody, setSendBody] = useState(false);

  function removeAttached(id: string) {
    setAttached((prev) => prev.filter((n) => n.id !== id));
  }

  async function handleSend() {
    if (sending) return;
    setError(null);
    setInfo(null);

    const parsed = chatMessageSchema.safeParse({ content: input });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSending(true);

    let activeThread = thread;
    if (!activeThread) {
      try {
        activeThread = await createNewThread();
        setThread(activeThread);
      } catch {
        setError('Sohbet baslatilamadi. Tekrar dene.');
        setSending(false);
        return;
      }
    }

    const sentNotes = attached;
    const noteIds = sentNotes.map((n) => n.id);
    const withBody = sendBody;

    const userMessage: DisplayMessage = {
      id: `local-user-${Date.now()}`,
      thread_id: activeThread.id,
      user_id: activeThread.user_id,
      role: 'user',
      content: parsed.data.content,
      created_at: new Date().toISOString(),
      noteLabels: sentNotes.map((n) => n.title || 'Basliksiz not'),
      withBody,
    };

    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMessage: DisplayMessage = {
      id: assistantId,
      thread_id: activeThread.id,
      user_id: activeThread.user_id,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setAttached([]);
    setSendBody(false);

    let pendingText = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = () => {
      flushTimer = null;
      if (!pendingText) return;
      const chunk = pendingText;
      pendingText = '';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
      );
    };

    // Vucut verisi yalnizca kullanici acikca istediginde gonderilir.
    // Hesaplar burada degil, test edilmis calculations.ts'te yapilir;
    // sunucuya sadece sayilar gider.
    let bodySummary: BodySummary | null = null;
    if (withBody) {
      try {
        const [metrics, height] = await Promise.all([fetchBodyMetrics(), fetchHeightCm()]);
        bodySummary = buildBodySummary(metrics, height);
      } catch (e) {
        console.log('BODY CONTEXT ERROR:', e);
      }
    }

    try {
      const result = await sendMessageStream(
        activeThread.id,
        parsed.data.content,
        (token) => {
          pendingText += token;
          if (!flushTimer) flushTimer = setTimeout(flushPending, 60);
        },
        noteIds,
        bodySummary,
      );
      if (flushTimer) clearTimeout(flushTimer);
      flushPending();
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
      );

      // Baglam eksik kaldiysa sessiz kalmayalim: kullanici notunun veya
      // olcumlerinin okundugunu sanip yanlis cevaba guvenmesin.
      if (noteIds.length > 0 && result.noteCount < noteIds.length) {
        setInfo(
          result.noteCount === 0
            ? 'Notlarin henuz sunucuya gonderilmemis, bu mesajda okunamadi.'
            : `${noteIds.length} nottan ${result.noteCount} tanesi okunabildi.`,
        );
      } else if (withBody && !result.bodyContext) {
        setInfo('Vucut olcumu bulunamadi. Profil > Vucut takibi ekranindan olcum ekleyebilirsin.');
      } else if (result.noteTruncated) {
        setInfo('Notlarin uzun oldugu icin bir kismi kirpildi.');
      }
    } catch (e) {
      if (flushTimer) clearTimeout(flushTimer);
      setError(e instanceof Error ? e.message : 'Mesaj gonderilemedi. Tekrar dene.');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <Text style={s.empty}>
            Antrenman kocuna merhaba de. Notlarindan birini veya vucut olcumlerini ekleyerek de sorabilirsin.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={item.role === 'user' ? s.alignEnd : s.alignStart}>
            {item.noteLabels && item.noteLabels.length > 0 && (
              <Text style={s.attachedNote}>
                {item.noteLabels.length} not eklendi: {item.noteLabels.join(', ')}
              </Text>
            )}
            {item.withBody && <Text style={s.attachedNote}>Vucut olcumleri eklendi</Text>}
            <View style={[s.bubble, item.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
              <Text style={item.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant}>
                {item.content || (item.pending ? '...' : '')}
              </Text>
            </View>
          </View>
        )}
      />

      {attached.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipRow}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}
        >
          {attached.map((n) => (
            <View key={n.id} style={s.chip}>
              <Text style={s.chipText} numberOfLines={1}>{n.title || 'Basliksiz not'}</Text>
              <Pressable onPress={() => removeAttached(n.id)} hitSlop={8}>
                <X color="#555" size={14} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {error && <Text style={s.error}>{error}</Text>}
      {info && <Text style={s.info}>{info}</Text>}

      <View style={s.inputRow}>
        <Pressable
          style={s.attachButton}
          onPress={() => setPickerOpen(true)}
          disabled={sending}
          hitSlop={8}
        >
          <Paperclip color="#555" size={20} />
        </Pressable>

        <Pressable
          style={[s.attachButton, sendBody && s.attachButtonActive]}
          onPress={() => setSendBody((v) => !v)}
          disabled={sending}
          hitSlop={8}
        >
          <Scale color={sendBody ? '#fff' : '#555'} size={20} />
        </Pressable>

        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Bir sey yaz..."
          multiline
          editable={!sending}
        />
        <Pressable
          style={[s.sendButton, (sending || !input.trim()) && s.disabled]}
          onPress={handleSend}
          disabled={sending || !input.trim()}
        >
          <Send color="#fff" size={20} />
        </Pressable>
      </View>

      <NotePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={setAttached}
        initialSelectedIds={attached.map((n) => n.id)}
        maxSelection={3}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  empty: { textAlign: 'center', color: '#777', marginTop: 40, paddingHorizontal: 24, lineHeight: 22 },
  alignEnd: { alignSelf: 'flex-end', maxWidth: '85%', alignItems: 'flex-end' },
  alignStart: { alignSelf: 'flex-start', maxWidth: '85%' },
  bubble: { borderRadius: 14, padding: 12 },
  bubbleUser: { backgroundColor: '#111' },
  bubbleAssistant: { backgroundColor: '#f0f0f0' },
  bubbleTextUser: { color: '#fff', fontSize: 15 },
  bubbleTextAssistant: { color: '#111', fontSize: 15 },
  attachedNote: { fontSize: 11, color: '#888', marginBottom: 4 },
  chipRow: { maxHeight: 44, paddingVertical: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eee', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 180,
  },
  chipText: { fontSize: 13, color: '#333', flexShrink: 1 },
  error: { color: '#c00', fontSize: 13, textAlign: 'center', paddingBottom: 4 },
  info: { color: '#8a6d1f', fontSize: 12, textAlign: 'center', paddingBottom: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: '#eee',
  },
  attachButton: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#ddd',
  },
  attachButtonActive: { backgroundColor: '#111', borderColor: '#111' },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#111', borderRadius: 20, width: 42, height: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});