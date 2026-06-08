import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'ru' | 'kk' | 'en';

const translations = {
  ru: {
    home: 'Главная',
    library: 'Библиотека',
    official: 'Онлайн',
    add: 'Добавить',
    admin: 'Админ',
    profile: 'Профиль',
    language: 'Язык интерфейса',
    users: 'Пользователи',
    books: 'Книги',
    save: 'Сохранить',
    delete: 'Удалить',
    role: 'Роль',
    reader: 'Чтение',
  },
  kk: {
    home: 'Басты бет',
    library: 'Кітапхана',
    official: 'Онлайн',
    add: 'Қосу',
    admin: 'Әкімші',
    profile: 'Профиль',
    language: 'Интерфейс тілі',
    users: 'Пайдаланушылар',
    books: 'Кітаптар',
    save: 'Сақтау',
    delete: 'Жою',
    role: 'Рөл',
    reader: 'Оқу',
  },
  en: {
    home: 'Home',
    library: 'Library',
    official: 'Online',
    add: 'Add',
    admin: 'Admin',
    profile: 'Profile',
    language: 'Interface language',
    users: 'Users',
    books: 'Books',
    save: 'Save',
    delete: 'Delete',
    role: 'Role',
    reader: 'Reader',
  },
} as const;

type TranslationKey = keyof typeof translations.ru;

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ru',
  setLanguage: () => {},
  t: (key) => translations.ru[key],
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('ru');

  useEffect(() => {
    AsyncStorage.getItem('app_language').then((stored) => {
      if (stored === 'ru' || stored === 'kk' || stored === 'en') setLanguageState(stored);
    });
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage: (next: AppLanguage) => {
      setLanguageState(next);
      AsyncStorage.setItem('app_language', next);
    },
    t: (key: TranslationKey) => translations[language][key],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
