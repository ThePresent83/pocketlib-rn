import { apiTextRequest } from './backendApi';

const BASE_URL = 'https://gutendex.com/books';
const REQUEST_TIMEOUT_MS = 12000;
const TEXT_REQUEST_TIMEOUT_MS = 20000;

export interface SearchResult {
  ol_key: string;
  title: string;
  author: string;
  year?: number;
  isbn: string;
  cover_url: string;
  description: string;
  ia_id: string;
  gutenberg_id: string;
  has_fulltext: boolean;
  source: string;
}

interface StarterBook {
  id: number;
  title: string;
  author: string;
}

const STARTER_BOOKS: StarterBook[] = [
  { id: 84, title: 'Frankenstein; Or, The Modern Prometheus', author: 'Mary Wollstonecraft Shelley' },
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' },
  { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' },
  { id: 2701, title: 'Moby Dick; Or, The Whale', author: 'Herman Melville' },
  { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' },
  { id: 76, title: 'Adventures of Huckleberry Finn', author: 'Mark Twain' },
  { id: 5200, title: 'Metamorphosis', author: 'Franz Kafka' },
  { id: 1232, title: 'The Prince', author: 'Niccolo Machiavelli' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoyevsky' },
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift' },
  { id: 219, title: 'Heart of Darkness', author: 'Joseph Conrad' },
  { id: 844, title: 'The Importance of Being Earnest', author: 'Oscar Wilde' },
  { id: 1260, title: 'Jane Eyre: An Autobiography', author: 'Charlotte Bronte' },
  { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
  { id: 43, title: 'The Strange Case of Dr. Jekyll and Mr. Hyde', author: 'Robert Louis Stevenson' },
  { id: 1184, title: 'The Count of Monte Cristo', author: 'Alexandre Dumas' },
  { id: 2814, title: 'Dubliners', author: 'James Joyce' },
];

function coverUrl(id: string | number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

function directTextUrls(id: string | number): string[] {
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  ];
}

async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function describeNetworkError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function normalizeGutenbergTextUrl(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

function selectPlainTextUrl(formats: Record<string, string>): string {
  const keys = Object.keys(formats);
  const textKey = keys.find((key) => key.toLowerCase().startsWith('text/plain; charset=utf-8'))
    || keys.find((key) => key.toLowerCase().startsWith('text/plain'))
    || '';
  return textKey ? normalizeGutenbergTextUrl(String(formats[textKey])) : '';
}

async function fetchTextFromUrl(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, TEXT_REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const text = await response.text();
  if (!text.trim()) throw new Error(`${url} returned empty text`);
  return text;
}

async function fetchBackendGutenbergText(gutenbergId: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEXT_REQUEST_TIMEOUT_MS);
  try {
    const text = await apiTextRequest(`/gutenberg/${encodeURIComponent(gutenbergId)}/text`, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    if (!text.trim()) throw new Error('Backend returned empty text');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function starterBookToResult(book: StarterBook): SearchResult {
  return {
    ol_key: book.id.toString(),
    title: book.title,
    author: book.author,
    isbn: '',
    cover_url: coverUrl(book.id),
    description: 'Public domain book from Project Gutenberg. Full text is available in the built-in reader.',
    ia_id: '',
    gutenberg_id: book.id.toString(),
    has_fulltext: true,
    source: 'gutenberg',
  };
}

function parseSearchResults(results: any[]): SearchResult[] {
  return results
    .map((item) => {
      const id = item.id?.toString();
      if (!id) return null;
      const formats = item.formats || {};
      const hasPlainText = Object.keys(formats).some((key) => key.startsWith('text/plain'));
      if (!hasPlainText) return null;

      return {
        ol_key: id,
        title: item.title || 'Untitled',
        author: item.authors?.[0]?.name || 'Unknown author',
        isbn: '',
        cover_url: formats['image/jpeg'] || coverUrl(id),
        description: 'Public domain book from Project Gutenberg. Full text is available in the built-in reader.',
        ia_id: '',
        gutenberg_id: id,
        has_fulltext: true,
        source: 'gutenberg',
      };
    })
    .filter(Boolean) as SearchResult[];
}

function mergeUniqueBooks(...groups: SearchResult[][]): SearchResult[] {
  const books = new Map<string, SearchResult>();
  for (const group of groups) {
    for (const book of group) books.set(book.gutenberg_id, book);
  }
  return [...books.values()];
}

export function getStarterBooks(limit: number = STARTER_BOOKS.length): SearchResult[] {
  return STARTER_BOOKS.slice(0, limit).map(starterBookToResult);
}

export async function getPopularBooks(limit: number = 40): Promise<SearchResult[]> {
  return getStarterBooks(limit);
}

export async function searchBooks(query: string, limit: number = 20): Promise<SearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const fallback = getStarterBooks().filter((book) =>
    `${book.title} ${book.author}`.toLowerCase().includes(normalizedQuery)
  );

  try {
    const response = await fetchWithTimeout(`${BASE_URL}?search=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Gutendex returned ${response.status}`);
    const data = await response.json();
    return mergeUniqueBooks(parseSearchResults(data.results || []), fallback).slice(0, limit);
  } catch (error) {
    console.warn('Gutendex search is unavailable, using bundled Gutenberg starter books:', error);
    return fallback.slice(0, limit);
  }
}

export async function getBookDescription(): Promise<string> {
  return 'Книга из легальной открытой библиотеки Project Gutenberg. Полный текст доступен во встроенном ридере.';
}

export async function getBookText(gutenbergId: string): Promise<string> {
  const errors: string[] = [];

  try {
    return await fetchBackendGutenbergText(gutenbergId);
  } catch (error) {
    errors.push(`Backend: ${describeNetworkError(error)}`);
  }

  for (const url of directTextUrls(gutenbergId)) {
    try {
      return await fetchTextFromUrl(url);
    } catch (error) {
      errors.push(describeNetworkError(error));
    }
  }

  try {
    const response = await fetchWithTimeout(`${BASE_URL}?ids=${encodeURIComponent(gutenbergId)}`);
    if (!response.ok) throw new Error(`Gutendex returned ${response.status}`);
    const data = await response.json();
    const formats = data.results?.[0]?.formats || {};
    const textUrl = selectPlainTextUrl(formats);
    if (!textUrl) throw new Error('Plain text format is unavailable');
    return await fetchTextFromUrl(textUrl);
  } catch (error) {
    errors.push(`Gutendex: ${describeNetworkError(error)}`);
  }

  const message = `Gutenberg text is unavailable for ${gutenbergId}. ${errors.slice(0, 5).join(' | ')}`;
  console.warn(message);
  throw new Error(message);
}
