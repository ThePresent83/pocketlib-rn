import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function TabLayout() {
  const { user } = useAuth();
  const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: THEME.colors.primary,
        tabBarInactiveTintColor: '#9e9e9e',
        headerStyle: {
          backgroundColor: THEME.colors.primary,
        },
        headerTintColor: '#fff',
        headerShown: true,
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
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
        name="official"
        options={{
          title: t('official'),
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="certificate-outline" size={24} color={color} />,
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
        name="gutendex"
        options={{
          title: 'Мировая база',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="earth" size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account-circle" size={24} color={color} />,
          headerShown: false,
        }}
      />
      {/* Hide old tabs if they still exist in file system */}
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
