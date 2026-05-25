import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { initDb } from '../services/db';
import { THEME } from '../constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: THEME.colors.primary,
    primaryContainer: THEME.colors.primaryDark,
    secondary: THEME.colors.accent,
    background: THEME.colors.background,
    surface: THEME.colors.surface,
  },
};

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      // Redirect to login if not logged in and trying to access protected route
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // Redirect away from login if already logged in
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: THEME.colors.background }}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reader/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/register" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    async function setup() {
      try {
        await initDb();
        setDbInitialized(true);
      } catch (e) {
        console.error("DB Init error", e);
      }
    }
    setup();
  }, []);

  if (!dbInitialized) {
    return null; // Or a loading spinner
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PaperProvider theme={paperTheme}>
          <AuthGuard />
        </PaperProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
