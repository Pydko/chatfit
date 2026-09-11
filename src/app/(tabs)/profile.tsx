import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  const { session } = useAuth();
  const router = useRouter();

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

  return (
    <View style={s.container}>
      <Text style={s.title}>Giris basarili</Text>
      <Text style={s.email}>{session?.user.email}</Text>

      <Pressable style={s.secondary} onPress={() => router.push('/body')}>
        <Text style={s.secondaryText}>Vucut takibi</Text>
      </Pressable>

      <Pressable style={s.button} onPress={() => supabase.auth.signOut()}>
        <Text style={s.buttonText}>Cikis yap</Text>
      </Pressable>

      <Pressable onPress={handleDeleteAccount}>
        <Text style={s.danger}>Hesabimi sil</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  email: { fontSize: 16, color: '#555' },
  secondary: {
    borderWidth: 1, borderColor: '#111', borderRadius: 8,
    paddingHorizontal: 24, paddingVertical: 14, marginTop: 8,
  },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 14 },
  buttonText: { color: '#fff', fontWeight: '600' },
  danger: { color: '#c00', marginTop: 24 },
});