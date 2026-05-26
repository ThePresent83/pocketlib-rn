import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, getUserById } from '../services/userService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (userData: User) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const storedUserId = await AsyncStorage.getItem('user_id');
        if (storedUserId) {
          const u = await getUserById(Number(storedUserId));
          if (u) {
            setUser(u);
          } else {
            await AsyncStorage.removeItem('user_id');
          }
        }
      } catch (e) {
        console.error('Error loading user session', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const signIn = async (userData: User) => {
    setUser(userData);
    await AsyncStorage.setItem('user_id', userData.id.toString());
  };

  const signOut = async () => {
    setUser(null);
    await AsyncStorage.removeItem('user_id');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
