import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './backendApi';

const PROGRESS_PREFIX = 'pocketlib_progress_';
const APPEARANCE_SUFFIX = '_appearance';

export interface ReaderProgress {
  page: number;
  total_pages: number;
  font_size: number;
  bookmarks: number[];
}

export interface ReaderAppearance {
  font_family: string;
  line_height: number;
  page_width: number;
  theme: string;
}

interface ServerReaderState extends ReaderProgress {
  book_id: string;
  appearance: ReaderAppearance;
}

const DEFAULT_PROGRESS: ReaderProgress = {
  page: 0,
  total_pages: 0,
  font_size: 16,
  bookmarks: [],
};

const DEFAULT_APPEARANCE: ReaderAppearance = {
  font_family: 'serif',
  line_height: 1.7,
  page_width: 760,
  theme: 'paper',
};

function progressKey(bookKey: string) {
  return PROGRESS_PREFIX + bookKey;
}

function appearanceKey(bookKey: string) {
  return `${progressKey(bookKey)}${APPEARANCE_SUFFIX}`;
}

function serverBookId(bookKey: string): string | null {
  return bookKey.startsWith('book:') ? bookKey.slice(5) : null;
}

function normalizeProgress(progress?: Partial<ReaderProgress>): ReaderProgress {
  return {
    ...DEFAULT_PROGRESS,
    ...(progress || {}),
    bookmarks: Array.isArray(progress?.bookmarks) ? progress.bookmarks : [],
  };
}

function normalizeAppearance(appearance?: Partial<ReaderAppearance>): ReaderAppearance {
  return {
    ...DEFAULT_APPEARANCE,
    ...(appearance || {}),
  };
}

async function readLocalProgress(bookKey: string): Promise<ReaderProgress> {
  try {
    const data = await AsyncStorage.getItem(progressKey(bookKey));
    if (data) return normalizeProgress(JSON.parse(data));
  } catch (error) {
    console.error('Error getting progress:', error);
  }
  return DEFAULT_PROGRESS;
}

async function writeLocalProgress(bookKey: string, progress: ReaderProgress) {
  await AsyncStorage.setItem(progressKey(bookKey), JSON.stringify(normalizeProgress(progress)));
}

async function readLocalAppearance(bookKey: string): Promise<ReaderAppearance> {
  try {
    const data = await AsyncStorage.getItem(appearanceKey(bookKey));
    if (data) return normalizeAppearance(JSON.parse(data));
  } catch (error) {
    console.error('Error getting reader appearance:', error);
  }
  return DEFAULT_APPEARANCE;
}

async function writeLocalAppearance(bookKey: string, appearance: ReaderAppearance) {
  await AsyncStorage.setItem(appearanceKey(bookKey), JSON.stringify(normalizeAppearance(appearance)));
}

async function fetchServerState(bookKey: string): Promise<ServerReaderState | null> {
  const bookId = serverBookId(bookKey);
  if (!bookId) return null;

  try {
    const state = await apiRequest<ServerReaderState>(`/reader-progress/${encodeURIComponent(bookId)}`);
    const progress = normalizeProgress(state);
    const appearance = normalizeAppearance(state.appearance);
    await Promise.all([
      writeLocalProgress(bookKey, progress),
      writeLocalAppearance(bookKey, appearance),
    ]);
    return { ...state, ...progress, appearance };
  } catch {
    return null;
  }
}

async function syncServerState(bookKey: string, progress: ReaderProgress, appearance?: ReaderAppearance) {
  const bookId = serverBookId(bookKey);
  if (!bookId) return;

  try {
    const currentAppearance = appearance || await readLocalAppearance(bookKey);
    await apiRequest(`/reader-progress/${encodeURIComponent(bookId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        page: progress.page,
        total_pages: progress.total_pages,
        font_size: progress.font_size,
        bookmarks: progress.bookmarks || [],
        appearance: currentAppearance,
      }),
    });
  } catch {
    // Offline reading still works; the next successful save will sync again.
  }
}

export async function getProgress(bookKey: string): Promise<ReaderProgress> {
  const local = await readLocalProgress(bookKey);
  const remote = await fetchServerState(bookKey);
  return remote ? normalizeProgress(remote) : local;
}

export async function saveProgress(bookKey: string, page: number, totalPages: number, fontSize: number): Promise<void> {
  try {
    const current = await readLocalProgress(bookKey);
    const updated = normalizeProgress({
      ...current,
      page,
      total_pages: totalPages,
      font_size: fontSize,
    });
    await writeLocalProgress(bookKey, updated);
    await syncServerState(bookKey, updated);
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

    const updated = normalizeProgress({
      ...current,
      bookmarks: Array.from(bookmarks).sort((a, b) => a - b),
    });
    await writeLocalProgress(bookKey, updated);
    await syncServerState(bookKey, updated);
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

export async function getAppearance(bookKey: string): Promise<ReaderAppearance> {
  const local = await readLocalAppearance(bookKey);
  const remote = await fetchServerState(bookKey);
  return remote?.appearance || local;
}

export async function saveAppearance(bookKey: string, appearance: ReaderAppearance): Promise<void> {
  try {
    const normalized = normalizeAppearance(appearance);
    await writeLocalAppearance(bookKey, normalized);
    await syncServerState(bookKey, await readLocalProgress(bookKey), normalized);
  } catch (error) {
    console.error('Error saving reader appearance:', error);
  }
}
