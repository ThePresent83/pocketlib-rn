import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';

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
          title: 'Главная',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Библиотека',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="bookshelf" size={24} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Добавить',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="plus-box" size={24} color={color} />,
          headerShown: false,
          href: isAdminOrTeacher ? '/add' : null,
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
