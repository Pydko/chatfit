import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

function RootNavigator() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const lastTarget = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!navState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    let target: string | null = null;

    if (!session && !inAuthGroup) target = '/(auth)/sign-in';
    else if (session && inAuthGroup) target = '/';

    if (target && lastTarget.current !== target) {
      lastTarget.current = target;
      router.replace(target as any);
    }
    if (!target) lastTarget.current = null;
  }, [session, loading, segments, router, navState?.key]);

  if (loading || !navState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}