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
      setError('Could not create account. Please try again.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.info}>
          Click the link we sent to activate your account, then sign in.
        </Text>
        <Link href="/sign-in" style={s.link}>Back to sign in</Link>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Sign Up</Text>

      <TextInput
        style={s.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="Password (at least 10 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
      />

      {error && <Text style={s.error}>{error}</Text>}

      <Pressable style={[s.button, busy && s.disabled]} onPress={handleSignUp} disabled={busy}>
        <Text style={s.buttonText}>{busy ? 'Creating...' : 'Create account'}</Text>
      </Pressable>

      <Link href="/sign-in" style={s.link}>Already have an account? Sign in</Link>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  info: { fontSize: 16, textAlign: 'center', color: '#444', lineHeight: 24 },
  divider: { textAlign: 'center', color: '#888' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 14, fontSize: 16 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c00' },
  link: { textAlign: 'center', marginTop: 8, color: '#555' },
});