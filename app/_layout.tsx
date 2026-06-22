import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { LanguageProvider } from '../contexts/LanguageContext';
import { AppThemeProvider, useAppTheme } from '../contexts/ThemeContext';

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const { colors } = useAppTheme();
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
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
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AppThemeProvider>
          <AuthProvider>
            <AuthGuard />
          </AuthProvider>
        </AppThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
