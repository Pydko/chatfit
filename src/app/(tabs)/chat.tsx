import {
  createNewThread, sendMessageStream,
  type ChatMessage,
  type ChatThread
} from '@/features/chat/api';
import { chatMessageSchema } from '@/features/chat/schema';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView, Platform,
  Pressable, StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

type DisplayMessage = ChatMessage & { pending?: boolean };

export default function ChatTab() {
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useState<FlatList<DisplayMessage> | null>(null)[0];

  async function handleSend() {
    if (sending) return;
    setError(null);

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

    const userMessage: DisplayMessage = {
      id: `local-user-${Date.now()}`,
      thread_id: activeThread.id,
      user_id: activeThread.user_id,
      role: 'user',
      content: parsed.data.content,
      created_at: new Date().toISOString(),
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

    try {
      await sendMessageStream(activeThread.id, parsed.data.content, (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m)),
        );
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
      );
    } catch (e) {
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
        onContentSizeChange={(_, height) => {
          void height;
        }}
        ListEmptyComponent={
          <Text style={s.empty}>Antrenman kocuna merhaba de, sana yardimci olsun.</Text>
        }
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
            <Text style={item.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant}>
              {item.content || (item.pending ? '...' : '')}
            </Text>
          </View>
        )}
      />

      {error && <Text style={s.error}>{error}</Text>}

      <View style={s.inputRow}>
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
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  empty: { textAlign: 'center', color: '#777', marginTop: 40 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: '85%' },
  bubbleUser: { backgroundColor: '#111', alignSelf: 'flex-end' },
  bubbleAssistant: { backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
  bubbleTextUser: { color: '#fff', fontSize: 15 },
  bubbleTextAssistant: { color: '#111', fontSize: 15 },
  error: { color: '#c00', fontSize: 13, textAlign: 'center', paddingBottom: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: '#eee',
  },
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