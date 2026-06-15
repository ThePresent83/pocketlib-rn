import AsyncStorage from '@react-native-async-storage/async-storage';
import { EntityId } from './disciplineService';

const FAVORITES_KEY = 'pocketlib_favorite_books';
const RECENT_KEY = 'pocketlib_recent_books';
const RECENT_LIMIT = 30;

async function readIdList(key: string): Promise<EntityId[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function writeIdList(key: string, ids: EntityId[]) {
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(new Set(ids.map(String).filter(Boolean)))));
}

export async function getFavoriteBookIds(): Promise<EntityId[]> {
  return readIdList(FAVORITES_KEY);
}

export async function isFavoriteBook(bookId: EntityId): Promise<boolean> {
  const ids = await getFavoriteBookIds();
  return ids.includes(String(bookId));
}

export async function toggleFavoriteBook(bookId: EntityId): Promise<boolean> {
  const id = String(bookId);
  const ids = await getFavoriteBookIds();
  const next = ids.includes(id) ? ids.filter(item => item !== id) : [id, ...ids];
  await writeIdList(FAVORITES_KEY, next);
  return !ids.includes(id);
}

export async function getRecentBookIds(): Promise<EntityId[]> {
  return readIdList(RECENT_KEY);
}

export async function rememberRecentBook(bookId: EntityId): Promise<void> {
  const id = String(bookId);
  const current = await getRecentBookIds();
  await writeIdList(RECENT_KEY, [id, ...current.filter(item => item !== id)].slice(0, RECENT_LIMIT));
}
