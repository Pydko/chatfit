import { credentialsSchema } from '@/features/auth/schemas';
import { supabase } from '@/lib/supabase';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSignUp() {
    setError(null);
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: 'chatfit://auth/callback' },
    });
    setBusy(false);

    if (authError) {
      // GECICI TESHIS LOGU - test bitince sil
      console.log('SIGNUP ERROR:', authError.status, authError.message);
      setError('Kayit olusturulamadi. Lutfen tekrar dene.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={s.container}>
        <Text style={s.title}>E-postani kontrol et</Text>
        <Text style={s.info}>
          Hesabini aktiflestirmek icin gonderdigimiz baglantiya tikla, sonra giris yap.
        </Text>
        <Link href="/sign-in" style={s.link}>Giris ekranina don</Link>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Kaydol</Text>

      <TextInput
        style={s.input}
        placeholder="E-posta"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="Sifre (en az 10 karakter)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, busy && s.disabled]} onPress={handleSignUp} disabled={busy}>
        <Text style={s.buttonText}>{busy ? 'Olusturuluyor...' : 'Hesap olustur'}</Text>
      </Pressable>

      <Link href="/sign-in" style={s.link}>Zaten hesabin var mi? Giris yap</Link>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  info: { fontSize: 16, textAlign: 'center', color: '#444', lineHeight: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00' },
  link: { textAlign: 'center', marginTop: 8, color: '#555' },
});