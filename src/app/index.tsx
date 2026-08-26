import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const { session } = useAuth();

  return (
    <View style={s.container}>
      <Text style={s.title}>Giris basarili</Text>
      <Text style={s.email}>{session?.user.email}</Text>

      <Pressable style={s.button} onPress={() => supabase.auth.signOut()}>
        <Text style={s.buttonText}>Cikis yap</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  email: { fontSize: 16, color: '#555' },
  button: { backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 14 },
  buttonText: { color: '#fff', fontWeight: '600' },
});