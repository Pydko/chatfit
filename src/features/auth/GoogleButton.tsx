import { supabase } from '@/lib/supabase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

export function GoogleButton() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });
  }, []);

  async function handlePress() {
    try {
      setBusy(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken;
      if (!idToken) throw new Error('Google authentication could not be completed.');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
    } catch (e: any) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) return;
      console.log('GOOGLE ERROR:', e?.code, e?.message);
      Alert.alert('Sign in failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable style={[s.button, busy && s.disabled]} onPress={handlePress} disabled={busy}>
      <Text style={s.text}>Continue with Google</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  disabled: { opacity: 0.5 },
  text: { fontSize: 16, fontWeight: '600', color: '#111' },
});