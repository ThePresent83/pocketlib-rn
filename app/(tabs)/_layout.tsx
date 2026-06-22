import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function TabLayout() {
  const { user } = useAuth();
  const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const { t } = useLanguage();
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerStyle: {
          backgroundColor: colors.header,
        },
        headerTintColor: colors.onPrimary,
        headerShown: true,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('library'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="bookshelf" size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: t('add'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="plus-box" size={24} color={color} />,
          headerShown: false,
          href: isAdminOrTeacher ? '/add' : null,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('admin'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="shield-account" size={24} color={color} />,
          headerShown: false,
          href: user?.role === 'admin' ? '/admin' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="book-cog" size={24} color={color} />,
          headerShown: false,
          href: isAdminOrTeacher ? '/settings' : null,
        }}
      />
      <Tabs.Screen
        name="gutendex"
        options={{
          title: t('gutendex'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="book-search" size={24} color={color} />,
          headerShown: false,
          href: isAdminOrTeacher ? '/gutendex' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-circle" size={24} color={color} />,
          headerShown: false,
        }}
      />
      {/* Hide old tabs if they still exist in file system */}
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
