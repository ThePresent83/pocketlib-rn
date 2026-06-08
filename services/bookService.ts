import { getDb } from './db';
import { getPopularBooks } from './api';
import { getOfficialBooks, runOfficialFilter } from './bkApiService';

export interface Book {
  id: number;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  description?: string;
  cover_url?: string;
  file_path?: string;
  is_downloaded: boolean;
  source: string;
  ol_key?: string;
  ia_id?: string;
  gutenberg_id?: string;
  has_fulltext: boolean;
  discipline_id?: number;
  course_id?: number;
  category_id?: number;
  speciality_id?: number;
  material_type?: string;
  language?: string;
  semester?: number;
  teacher?: string;
  tags?: string;
  version?: string;
  access_level?: string;
  uploaded_by?: number;
  created_at?: string;
  external_url?: string;
  remote_id?: string;
}

export interface BookFilters {
  disciplineId?: number;
  courseId?: number;
  categoryId?: number;
  specialityId?: number;
  materialType?: string;
  language?: string;
  semester?: number;
  searchQuery?: string;
  isDownloaded?: boolean;
}

export async function getAllBooks(filters: BookFilters = {}): Promise<Book[]> {
  const db = await getDb();
  let query = 'SELECT * FROM books WHERE 1=1';
  const params: any[] = [];

  if (filters.disciplineId) {
    query += ' AND discipline_id = ?';
    params.push(filters.disciplineId);
  }
  if (filters.courseId) {
    query += ' AND course_id = ?';
    params.push(filters.courseId);
  }
  if (filters.categoryId) {
    query += ' AND category_id = ?';
    params.push(filters.categoryId);
  }
  if (filters.specialityId) {
    query += ' AND speciality_id = ?';
    params.push(filters.specialityId);
  }
  if (filters.materialType) {
    query += ' AND material_type = ?';
    params.push(filters.materialType);
  }
  if (filters.language) {
    query += ' AND language = ?';
    params.push(filters.language);
  }
  if (filters.semester) {
    query += ' AND semester = ?';
    params.push(filters.semester);
  }
  if (filters.isDownloaded !== undefined) {
    query += ' AND is_downloaded = ?';
    params.push(filters.isDownloaded ? 1 : 0);
  }
  if (filters.searchQuery) {
    query += ' AND (title LIKE ? OR author LIKE ? OR tags LIKE ? OR teacher LIKE ?)';
    const like = `%${filters.searchQuery}%`;
    params.push(like, like, like, like);
  }
  
  query += ' ORDER BY id DESC';
  
  const result = await db.getAllAsync(query, params);
  return result as Book[];
}

export async function getBookById(id: number): Promise<Book | null> {
  const db = await getDb();
  const result = await db.getFirstAsync('SELECT * FROM books WHERE id = ?', [id]);
  return result as Book | null;
}

export async function addBook(data: Partial<Book>): Promise<Book | null> {
  const db = await getDb();
  try {
    const result = await db.runAsync(`
      INSERT INTO books (
        title, author, year, isbn, description, cover_url, file_path, 
        is_downloaded, source, ol_key, ia_id, gutenberg_id, has_fulltext,
        discipline_id, course_id, category_id, speciality_id, material_type,
        language, semester, teacher, tags, version, access_level, uploaded_by,
        external_url, remote_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.title || 'Без названия',
      data.author || '',
      data.year || null,
      data.isbn || null,
      data.description || '',
      data.cover_url || '',
      data.file_path || null,
      data.is_downloaded ? 1 : 0,
      data.source || 'api',
      data.ol_key || null,
      data.ia_id || null,
      data.gutenberg_id || null,
      data.has_fulltext ? 1 : 0,
      data.discipline_id || null,
      data.course_id || null,
      data.category_id || null,
      data.speciality_id || null,
      data.material_type || null,
      data.language || null,
      data.semester || null,
      data.teacher || null,
      data.tags || null,
      data.version || null,
      data.access_level || 'public',
      data.uploaded_by || null,
      data.external_url || null,
      data.remote_id || null
    ]);
    
    return await getBookById(result.lastInsertRowId);
  } catch (error) {
    console.error('Error adding book:', error);
    return null;
  }
}

export async function syncOfficialBooks(): Promise<number> {
  const db = await getDb();
  await runOfficialFilter();
  const remoteBooks = await getOfficialBooks();

  for (const book of remoteBooks) {
    const externalUrl = book.externalLinks?.[0]?.url || book.officialSourceUrl || '';
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM books WHERE source = ? AND remote_id = ?',
      ['official', book.id]
    );
    const values = [
      book.title,
      book.author || '',
      Number(book.year) || null,
      book.publisher ? `${book.publisher}. Официальная электронная версия.` : 'Официальная электронная версия.',
      'official',
      book.language || null,
      externalUrl,
      book.id,
    ];

    if (existing) {
      await db.runAsync(
        'UPDATE books SET title = ?, author = ?, year = ?, description = ?, source = ?, language = ?, external_url = ?, remote_id = ? WHERE id = ?',
        [...values, existing.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO books (
          title, author, year, description, source, language, external_url, remote_id,
          material_type, access_level, has_fulltext, is_downloaded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'textbook', 'public', 0, 0)`,
        values
      );
    }
  }

  return remoteBooks.length;
}

export async function syncGutenbergBooks(limit: number = 40): Promise<number> {
  const db = await getDb();
  const remoteBooks = await getPopularBooks(limit);

  // Official publisher links stay in the dedicated online section. The main
  // bookshelf is reserved for files that can be read inside the application.
  await db.runAsync("DELETE FROM books WHERE source = 'official' AND remote_id IS NOT NULL");

  for (const book of remoteBooks) {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM books WHERE source = ? AND gutenberg_id = ?',
      ['gutenberg', book.gutenberg_id]
    );
    const values = [
      book.title,
      book.author,
      book.description,
      book.cover_url,
      book.ol_key,
      book.gutenberg_id,
      book.source,
    ];

    if (existing) {
      await db.runAsync(
        `UPDATE books
         SET title = ?, author = ?, description = ?, cover_url = ?, ol_key = ?,
             gutenberg_id = ?, source = ?, has_fulltext = 1, external_url = NULL
         WHERE id = ?`,
        [...values, existing.id]
      );
    } else {
      await db.runAsync(
        `INSERT INTO books (
          title, author, description, cover_url, ol_key, gutenberg_id, source,
          material_type, language, access_level, has_fulltext, is_downloaded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'book', 'en', 'public', 1, 0)`,
        values
      );
    }
  }

  return remoteBooks.length;
}

export async function updateBook(id: number, updates: Partial<Book>): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    params.push(value);
  }

  if (setClauses.length === 0) return;

  params.push(id);
  await db.runAsync(`UPDATE books SET ${setClauses.join(', ')} WHERE id = ?`, params);
}

export async function deleteBook(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM books WHERE id = ?', [id]);
}

export async function assignDiscipline(bookId: number, disciplineId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE books SET discipline_id = ? WHERE id = ?', [disciplineId, bookId]);
}
