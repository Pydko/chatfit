import { GoogleButton } from '@/features/auth/GoogleButton';
import { credentialsSchema } from '@/features/auth/schemas';
import { supabase } from '@/lib/supabase';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
      setError('Invalid email or password.');
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>ChatFit</Text>

      <GoogleButton />
      <Text style={s.divider}>or</Text>

      <TextInput
        style={s.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, busy && s.disabled]} onPress={handleSignIn} disabled={busy}>
        <Text style={s.buttonText}>{busy ? 'Signing in...' : 'Sign In'}</Text>
      </Pressable>

      <Link href="/sign-up" style={s.link}>Don't have an account? Sign up</Link>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  divider: { textAlign: 'center', color: '#888' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00' },
  link: { textAlign: 'center', marginTop: 8, color: '#555' },
});