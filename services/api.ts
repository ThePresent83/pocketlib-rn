const BASE_URL = 'https://gutendex.com/books';

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

export async function searchBooks(query: string, limit: number = 20): Promise<SearchResult[]> {
  try {
    const url = `${BASE_URL}?search=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    const results = data.results.slice(0, limit);
    return parseSearchResults(results);
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

function parseSearchResults(results: any[]): SearchResult[] {
  return results.map(item => {
    const authorObj = item.authors?.[0];
    const authorName = authorObj?.name || 'Неизвестный автор';
    const year = authorObj?.birth_year || undefined;
    
    const formats = item.formats || {};
    const coverUrl = formats['image/jpeg'] || '';
    
    return {
      ol_key: item.id.toString(),
      title: item.title || 'Без названия',
      author: authorName,
      year: year,
      isbn: '',
      cover_url: coverUrl,
      description: '',
      ia_id: '',
      gutenberg_id: item.id.toString(),
      has_fulltext: true,
      source: 'gutendex'
    };
  });
}

export async function getBookDescription(olKey: string): Promise<string> {
  return "Эта книга загружена из публичной библиотеки Project Gutenberg и находится в общественном достоянии.";
}

export async function getBookText(olKey: string): Promise<string> {
  try {
    const url = `${BASE_URL}?ids=${olKey}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch book formats');
    
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      throw new Error('Book not found');
    }
    
    const book = data.results[0];
    const formats = book.formats || {};
    
    let textUrl = formats['text/plain; charset=utf-8'] || formats['text/plain; charset=us-ascii'] || formats['text/plain'];
    
    if (!textUrl) {
      const textKeys = Object.keys(formats).filter(k => k.startsWith('text/plain'));
      if (textKeys.length > 0) {
        textUrl = formats[textKeys[0]];
      }
    }

    if (textUrl) {
      if (textUrl.startsWith('http://')) {
        textUrl = textUrl.replace('http://', 'https://');
      }
      
      const textResponse = await fetch(textUrl);
      if (textResponse.ok) {
        const fullText = await textResponse.text();
        return fullText;
      }
    }
    
    return 'К сожалению, текст этой книги недоступен в формате plain text.';
  } catch (error) {
    console.error('Error fetching book text:', error);
    return `Ошибка при подгрузке текста: ${error}`;
  }
}
