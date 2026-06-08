const BASE_URL = 'https://gutendex.com/books';
const REQUEST_TIMEOUT_MS = 7000;

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

function directTextUrl(id: string | number): string {
  return `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
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
  try {
    const directResponse = await fetchWithTimeout(directTextUrl(gutenbergId));
    if (directResponse.ok) return await directResponse.text();
  } catch (error) {
    console.warn(`Direct Gutenberg text request failed for ${gutenbergId}:`, error);
  }

  try {
    const response = await fetchWithTimeout(`${BASE_URL}?ids=${encodeURIComponent(gutenbergId)}`);
    if (!response.ok) throw new Error(`Gutendex returned ${response.status}`);
    const data = await response.json();
    const formats = data.results?.[0]?.formats || {};
    const textKey = Object.keys(formats).find((key) => key.startsWith('text/plain'));
    if (!textKey) throw new Error('Plain text format is unavailable');
    const textUrl = String(formats[textKey]).replace(/^http:\/\//, 'https://');
    const textResponse = await fetchWithTimeout(textUrl);
    if (!textResponse.ok) throw new Error(`Gutenberg returned ${textResponse.status}`);
    return await textResponse.text();
  } catch (error) {
    console.error('Error fetching Gutenberg text:', error);
    return `Не удалось загрузить текст книги. Проверьте подключение к интернету и повторите попытку.\n\n${String(error)}`;
  }
}
