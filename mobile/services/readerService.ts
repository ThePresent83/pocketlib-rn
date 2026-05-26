import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_PREFIX = 'pocketlib_progress_';

export interface ReaderProgress {
  page: number;
  total_pages: number;
  font_size: number;
  bookmarks: number[];
}

export async function getProgress(bookKey: string): Promise<ReaderProgress> {
  try {
    const data = await AsyncStorage.getItem(PROGRESS_PREFIX + bookKey);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error getting progress:', error);
  }
  return { page: 0, total_pages: 0, font_size: 16, bookmarks: [] };
}

export async function saveProgress(bookKey: string, page: number, totalPages: number, fontSize: number): Promise<void> {
  try {
    const current = await getProgress(bookKey);
    const updated: ReaderProgress = {
      ...current,
      page,
      total_pages: totalPages,
      font_size: fontSize
    };
    await AsyncStorage.setItem(PROGRESS_PREFIX + bookKey, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

export async function toggleBookmark(bookKey: string, pageIdx: number): Promise<boolean> {
  try {
    const current = await getProgress(bookKey);
    const bookmarks = new Set(current.bookmarks || []);
    let added = false;
    
    if (bookmarks.has(pageIdx)) {
      bookmarks.delete(pageIdx);
    } else {
      bookmarks.add(pageIdx);
      added = true;
    }
    
    current.bookmarks = Array.from(bookmarks);
    await AsyncStorage.setItem(PROGRESS_PREFIX + bookKey, JSON.stringify(current));
    return added;
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    return false;
  }
}

export async function getBookmarks(bookKey: string): Promise<number[]> {
  const current = await getProgress(bookKey);
  return current.bookmarks || [];
}
