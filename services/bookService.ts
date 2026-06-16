import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getStarterBooks } from './api';
import { apiRequest, apiUrl, authHeaders } from './backendApi';
import { EntityId } from './disciplineService';

const DOWNLOADS_KEY = 'pocketlib_downloaded_books';
const webDownloadMap: DownloadMap = {};

export interface Book {
  id: EntityId;
  title: string;
  author?: string;
  year?: number;
  isbn?: string;
  description?: string;
  cover_url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  content_type?: string;
  has_file?: boolean;
  is_downloaded: boolean;
  source: string;
  ol_key?: string;
  ia_id?: string;
  gutenberg_id?: string;
  has_fulltext: boolean;
  discipline_id?: EntityId;
  course_id?: EntityId;
  category_id?: EntityId;
  speciality_id?: EntityId;
  material_type?: string;
  language?: string;
  semester?: number;
  teacher?: string;
  tags?: string;
  version?: string;
  access_level?: string;
  uploaded_by?: EntityId;
  created_at?: string;
  external_url?: string;
  remote_id?: string;
}

export interface BookFilters {
  disciplineId?: EntityId;
  courseId?: EntityId;
  categoryId?: EntityId;
  specialityId?: EntityId;
  materialType?: string;
  language?: string;
  semester?: number;
  searchQuery?: string;
  isDownloaded?: boolean;
}

interface DownloadEntry {
  file_path: string;
  file_name?: string;
  downloaded_at: string;
}

type DownloadMap = Record<string, DownloadEntry>;

type UploadableBookFile = {
  uri: string;
  name: string;
  mimeType?: string;
  webFile?: any;
};

function normalizeBook(input: any): Book {
  const book = {
    ...input,
    author: input.author || '',
    description: input.description || '',
    cover_url: normalizeCoverUrl(input),
    source: input.source || 'api',
    has_fulltext: Boolean(input.has_fulltext),
    has_file: Boolean(input.has_file || input.content_s3_key),
    is_downloaded: false,
  };
  if (!book.cover_url && shouldUseGeneratedCover(book)) {
    book.cover_url = apiUrl(`/books/${encodeURIComponent(book.id)}/cover`);
  }
  return book;
}

function normalizeCoverUrl(input: any): string {
  const coverUrl = String(input.cover_url || '').trim();
  if (!coverUrl) return '';
  if (/^(https?:|blob:|data:|file:)/i.test(coverUrl)) return coverUrl;
  if (coverUrl.startsWith('/')) return apiUrl(coverUrl);
  return coverUrl;
}

function shouldUseGeneratedCover(book: Pick<Book, 'has_file' | 'file_name' | 'file_path' | 'content_type'>) {
  if (!book.has_file) return false;
  const ext = getFileExtension(book.file_name || book.file_path);
  const contentType = (book.content_type || '').toLowerCase();
  return ext === 'pdf' || ext === 'epub' || contentType.includes('pdf') || contentType.includes('epub');
}

function getFileExtension(path?: string): string {
  return path?.split('?')[0].split('.').pop()?.toLowerCase() || '';
}

async function getDownloadMap(): Promise<DownloadMap> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setDownloadMap(map: DownloadMap) {
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(map));
}

async function ensureMaterialDirectory(bookId: EntityId): Promise<string> {
  const dir = `${FileSystem.documentDirectory}materials/${bookId}/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function rememberDownloadedBook(book: Book, filePath: string, fileName: string): Promise<Book> {
  if (Platform.OS === 'web') {
    webDownloadMap[book.id] = {
      file_path: filePath,
      file_name: fileName,
      downloaded_at: new Date().toISOString(),
    };
    return {
      ...book,
      file_path: filePath,
      file_name: fileName,
      is_downloaded: true,
    };
  }

  const downloads = await getDownloadMap();
  downloads[book.id] = {
    file_path: filePath,
    file_name: fileName,
    downloaded_at: new Date().toISOString(),
  };
  await setDownloadMap(downloads);

  return {
    ...book,
    file_path: filePath,
    file_name: fileName,
    is_downloaded: true,
  };
}

async function withDownloadState(book: Book): Promise<Book> {
  if (Platform.OS === 'web') {
    const webEntry = webDownloadMap[book.id];
    return webEntry?.file_path
      ? {
          ...book,
          file_path: webEntry.file_path,
          file_name: webEntry.file_name || book.file_name,
          is_downloaded: true,
        }
      : book;
  }

  const downloads = await getDownloadMap();
  const entry = downloads[book.id];
  if (!entry?.file_path) return book;

  let info: { exists: boolean };
  try {
    info = await FileSystem.getInfoAsync(entry.file_path);
  } catch {
    delete downloads[book.id];
    await setDownloadMap(downloads);
    return book;
  }

  if (!info.exists) {
    delete downloads[book.id];
    await setDownloadMap(downloads);
    return book;
  }

  return {
    ...book,
    file_path: entry.file_path,
    file_name: entry.file_name || book.file_name,
    is_downloaded: true,
  };
}

async function withDownloads(books: Book[], downloadedOnly?: boolean): Promise<Book[]> {
  const hydrated = await Promise.all(books.map(withDownloadState));
  return downloadedOnly ? hydrated.filter((book) => book.is_downloaded) : hydrated;
}

function buildQuery(filters: BookFilters) {
  const params: string[] = [];
  const add = (key: string, value?: string | number) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  };
  add('q', filters.searchQuery);
  add('discipline_id', filters.disciplineId);
  add('course_id', filters.courseId);
  add('category_id', filters.categoryId);
  add('material_type', filters.materialType);
  add('language', filters.language);
  add('semester', filters.semester);
  add('limit', 100);
  return params.length ? `?${params.join('&')}` : '';
}

export async function getAllBooks(filters: BookFilters = {}): Promise<Book[]> {
  const result = await apiRequest<any[]>(`/books${buildQuery(filters)}`, {}, false);
  return withDownloads(result.map(normalizeBook), filters.isDownloaded);
}

export async function getBookById(id: EntityId): Promise<Book | null> {
  try {
    const result = await apiRequest<any>(`/books/${encodeURIComponent(id)}`, {}, false);
    return withDownloadState(normalizeBook(result));
  } catch {
    return null;
  }
}

export async function addBook(data: Partial<Book>): Promise<Book | null> {
  try {
    const result = await apiRequest<any>('/books', {
      method: 'POST',
      body: JSON.stringify(toServerBookInput(data)),
    });
    return withDownloadState(normalizeBook(result));
  } catch (error) {
    console.error('Error adding book:', error);
    return null;
  }
}

export async function uploadBookFile(bookId: EntityId, file: UploadableBookFile): Promise<Book | null> {
  const uploadAsync = (FileSystem as any).uploadAsync as undefined | ((url: string, fileUri: string, options: any) => Promise<any>);
  const uploadType = (FileSystem as any).FileSystemUploadType?.MULTIPART ?? 1;
  const mimeType = file.mimeType || mimeForFileName(file.name);
  let result: any;

  await apiRequest('/auth/me');

  if (Platform.OS === 'web') {
    result = await uploadBookFileWithFetch(bookId, file, mimeType);
  } else if (uploadAsync && file.uri && !/^https?:\/\//i.test(file.uri)) {
    const response = await uploadAsync(apiUrl(`/books/${encodeURIComponent(bookId)}/file`), file.uri, {
      httpMethod: 'POST',
      uploadType,
      fieldName: 'file',
      mimeType,
      headers: await authHeaders(),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(parseUploadError(response.body, response.status));
    }

    result = response.body ? JSON.parse(response.body) : null;
  } else {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: mimeType,
    } as any);

    result = await apiRequest<any>(`/books/${encodeURIComponent(bookId)}/file`, {
      method: 'POST',
      body: formData,
    });
  }

  const uploadedBook = normalizeBook(result);
  return cacheUploadedBookFile(uploadedBook, file);
}

export async function downloadBookFile(book: Book): Promise<Book> {
  if (!book.has_file) {
    throw new Error('missing_server_file');
  }

  if (Platform.OS === 'web') {
    return downloadBookFileWeb(book);
  }

  const dir = await ensureMaterialDirectory(book.id);

  const fileName = sanitizeFileName(book.file_name || `${book.title}.${extensionFromBook(book) || 'bin'}`);
  const destination = `${dir}${fileName}`;
  await apiRequest('/auth/me');
  const result = await FileSystem.downloadAsync(
    apiUrl(`/books/${encodeURIComponent(book.id)}/file`),
    destination,
    { headers: await authHeaders() }
  );

  return rememberDownloadedBook(book, result.uri, fileName);
}

export async function removeDownloadedBook(bookId: EntityId): Promise<void> {
  if (Platform.OS === 'web') {
    const entry = webDownloadMap[bookId];
    if (entry?.file_path?.startsWith('blob:')) {
      URL.revokeObjectURL(entry.file_path);
    }
    delete webDownloadMap[bookId];
    return;
  }

  const downloads = await getDownloadMap();
  const entry = downloads[bookId];
  if (entry?.file_path) {
    await FileSystem.deleteAsync(entry.file_path, { idempotent: true });
  }
  delete downloads[bookId];
  await setDownloadMap(downloads);
}

export async function syncGutenbergBooks(): Promise<number> {
  const [existingBooks, starterBooks] = await Promise.all([
    getAllBooks(),
    Promise.resolve(getStarterBooks(20)),
  ]);
  const existingIds = new Set(existingBooks.map(book => book.gutenberg_id).filter(Boolean));
  let added = 0;

  for (const item of starterBooks) {
    if (existingIds.has(item.gutenberg_id)) continue;
    const created = await addBook({
      title: item.title,
      author: item.author,
      year: item.year,
      isbn: item.isbn,
      cover_url: item.cover_url,
      ol_key: item.ol_key,
      ia_id: item.ia_id,
      gutenberg_id: item.gutenberg_id,
      has_fulltext: item.has_fulltext,
      source: item.source,
      external_url: `https://www.gutenberg.org/ebooks/${item.gutenberg_id}`,
      is_downloaded: false,
    });
    if (created) {
      existingIds.add(item.gutenberg_id);
      added += 1;
    }
  }

  return added;
}

export async function updateBook(id: EntityId, updates: Partial<Book>): Promise<void> {
  const current = await getBookById(id);
  if (!current) return;
  await apiRequest(`/books/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(toServerBookInput({ ...current, ...updates })),
  });
}

export async function deleteBook(id: EntityId): Promise<void> {
  await apiRequest(`/books/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await removeDownloadedBook(id);
}

export async function assignDiscipline(bookId: EntityId, disciplineId: EntityId): Promise<void> {
  await updateBook(bookId, { discipline_id: disciplineId });
}

function toServerBookInput(data: Partial<Book>) {
  return {
    title: data.title,
    author: data.author,
    year: data.year,
    isbn: data.isbn,
    description: data.description,
    cover_url: data.cover_url,
    source: data.source || 'api',
    ol_key: data.ol_key,
    ia_id: data.ia_id,
    gutenberg_id: data.gutenberg_id,
    has_fulltext: Boolean(data.has_fulltext),
    discipline_id: data.discipline_id,
    course_id: data.course_id,
    category_id: data.category_id,
    speciality_id: data.speciality_id,
    material_type: data.material_type,
    language: data.language,
    semester: data.semester,
    teacher: data.teacher,
    tags: data.tags,
    version: data.version,
    access_level: data.access_level || 'public',
    uploaded_by: data.uploaded_by,
    external_url: data.external_url,
    remote_id: data.remote_id,
    file_name: data.file_name,
    file_size: data.file_size,
    content_type: data.content_type,
  };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 180);
}

async function cacheUploadedBookFile(book: Book, file: UploadableBookFile): Promise<Book> {
  const fileName = sanitizeFileName(book.file_name || file.name || `${book.title}.${extensionFromBook(book) || 'bin'}`);

  if (Platform.OS === 'web') {
    let objectUrl = file.uri;
    if (file.webFile && typeof URL !== 'undefined') {
      objectUrl = URL.createObjectURL(file.webFile);
    }
    return rememberDownloadedBook(book, objectUrl, fileName);
  }

  try {
    const dir = await ensureMaterialDirectory(book.id);
    const destination = `${dir}${fileName}`;
    if (file.uri !== destination) {
      await FileSystem.copyAsync({ from: file.uri, to: destination });
    }
    return rememberDownloadedBook(book, destination, fileName);
  } catch (error) {
    console.warn('Could not cache uploaded book locally:', error);
    return withDownloadState(book);
  }
}

async function uploadBookFileWithFetch(bookId: EntityId, file: UploadableBookFile, mimeType: string) {
  const formData = new FormData();

  if (file.webFile) {
    formData.append('file', file.webFile, file.name);
  } else {
    const fileResponse = await fetch(file.uri);
    const blob = await fileResponse.blob();
    formData.append('file', blob, file.name);
  }

  const response = await fetch(apiUrl(`/books/${encodeURIComponent(bookId)}/file`), {
    method: 'POST',
    headers: await authHeaders(),
    body: formData,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(parseUploadError(body, response.status));
  }

  return body ? JSON.parse(body) : null;
}

async function downloadBookFileWeb(book: Book): Promise<Book> {
  const response = await fetch(apiUrl(`/books/${encodeURIComponent(book.id)}/file`), {
    headers: await authHeaders(),
  });
  const body = await response.blob();
  if (!response.ok) {
    throw new Error(parseUploadError(await body.text(), response.status));
  }

  const fileName = sanitizeFileName(book.file_name || `${book.title}.${extensionFromBook(book) || 'bin'}`);
  const objectUrl = URL.createObjectURL(new Blob([body], { type: book.content_type || mimeForFileName(fileName) }));
  return rememberDownloadedBook(book, objectUrl, fileName);
}

function parseUploadError(body: string | undefined, status: number) {
  if (body) {
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) return parsed.error;
    } catch {}
  }
  return `Backend returned ${status}`;
}

function extensionFromBook(book: Book) {
  return (book.file_name || book.external_url || '').split('?')[0].split('.').pop()?.toLowerCase() || '';
}

function mimeForFileName(fileName: string) {
  const ext = fileName.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'epub') return 'application/epub+zip';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}
