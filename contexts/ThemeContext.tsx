import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AppColors, DARK_COLORS, LIGHT_COLORS } from '../constants/theme';
import { Platform } from 'react-native';

export type AppThemeMode = 'light' | 'dark';

interface AppThemeContextType {
  mode: AppThemeMode;
  isDark: boolean;
  colors: AppColors;
  setMode: (mode: AppThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'app_theme_mode';

const ThemeContext = createContext<AppThemeContextType>({
  mode: 'light',
  isDark: false,
  colors: LIGHT_COLORS,
  setMode: () => {},
  toggleTheme: () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') setModeState(stored);
    });
  }, []);

  const isDark = mode === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.header);
  }, [colors.header, mode]);

  const paperTheme = useMemo(() => {
    const base = isDark ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        onPrimary: isDark ? colors.primaryDark : colors.onPrimary,
        primaryContainer: colors.primaryDark,
        onPrimaryContainer: colors.onPrimary,
        secondary: colors.accent,
        background: colors.background,
        surface: colors.surface,
        surfaceVariant: colors.surfaceVariant,
        onSurface: colors.text,
        onSurfaceVariant: colors.textSecondary,
        outline: colors.border,
        error: colors.error,
      },
    };
  }, [colors, isDark]);

  const navigationTheme = useMemo(() => {
    const base = isDark ? NavigationDarkTheme : NavigationLightTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors, isDark]);

  const value = useMemo<AppThemeContextType>(() => ({
    mode,
    isDark,
    colors,
    setMode: (nextMode) => {
      setModeState(nextMode);
      AsyncStorage.setItem(STORAGE_KEY, nextMode);
    },
    toggleTheme: () => {
      setModeState((current) => {
        const next = current === 'dark' ? 'light' : 'dark';
        AsyncStorage.setItem(STORAGE_KEY, next);
        return next;
      });
    },
  }), [colors, isDark, mode]);

  return (
    <ThemeContext.Provider value={value}>
      <NavigationThemeProvider value={navigationTheme}>
        <PaperProvider theme={paperTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {children}
        </PaperProvider>
      </NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
