import { credentialsSchema } from '@/features/auth/schemas';
import { supabase } from '@/lib/supabase';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';


console.log('ENV CHECK:',
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 15),
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length
);



export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);

    if (authError) {
      console.log('SIGNIN ERROR:', authError.status, authError.message);
      setError('E-posta veya sifre hatali.');
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>ChatFit</Text>

      <TextInput
        style={s.input}
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={s.input}
        placeholder="Sifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, busy && s.disabled]} onPress={handleSignIn} disabled={busy}>
        <Text style={s.buttonText}>{busy ? 'Giris yapiliyor...' : 'Giris yap'}</Text>
      </Pressable>

      <Link href="/(auth)/sign-up" style={s.link}>
        Hesabin yok mu? Kaydol
      </Link>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00' },
  link: { textAlign: 'center', marginTop: 8, color: '#555' },
});