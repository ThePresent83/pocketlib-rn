import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('pocketlib.db');
  }
  return db;
}

export async function initDb() {
  const database = await getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS specialities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(256) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name VARCHAR(256) NOT NULL,
      email VARCHAR(256) NOT NULL UNIQUE,
      password VARCHAR(256) NOT NULL,
      role VARCHAR(32) DEFAULT 'student',
      speciality_id INTEGER,
      course_id INTEGER,
      group_name VARCHAR(64),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(speciality_id) REFERENCES specialities(id) ON DELETE SET NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS disciplines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL,
      color VARCHAR(32) DEFAULT '#5C6BC0'
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL,
      year INTEGER NOT NULL,
      discipline_id INTEGER,
      FOREIGN KEY(discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(512) NOT NULL,
      author VARCHAR(256) DEFAULT '',
      year INTEGER,
      isbn VARCHAR(20),
      description TEXT DEFAULT '',
      cover_url VARCHAR(512) DEFAULT '',
      file_path VARCHAR(512),
      is_downloaded BOOLEAN DEFAULT 0,
      source VARCHAR(32) DEFAULT 'api',
      ol_key VARCHAR(64),
      ia_id VARCHAR(128),
      gutenberg_id VARCHAR(32),
      has_fulltext BOOLEAN DEFAULT 0,
      discipline_id INTEGER,
      course_id INTEGER,
      FOREIGN KEY(discipline_id) REFERENCES disciplines(id) ON DELETE SET NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reading_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      last_opened DATETIME DEFAULT CURRENT_TIMESTAMP,
      progress INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS search_cache (
      query VARCHAR(256) PRIMARY KEY,
      results_json TEXT NOT NULL,
      timestamp FLOAT NOT NULL
    );
  `);

  const columnsToAdd = [
    'category_id INTEGER',
    'speciality_id INTEGER',
    'material_type VARCHAR(64)',
    'language VARCHAR(16)',
    'semester INTEGER',
    'teacher VARCHAR(256)',
    'tags VARCHAR(512)',
    'version VARCHAR(32)',
    'access_level VARCHAR(32) DEFAULT "public"',
    'uploaded_by INTEGER',
    'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
  ];

  for (const col of columnsToAdd) {
    try {
      await database.runAsync(`ALTER TABLE books ADD COLUMN ${col}`);
    } catch (e) {
      // Игнорируем ошибку, если колонка уже существует
    }
  }

  // Создадим пользователя-администратора по умолчанию, если таблица users пуста
  try {
    const adminExists = await database.getFirstAsync('SELECT id FROM users WHERE email = ?', ['admin@university.edu']);
    if (!adminExists) {
      await database.runAsync(
        'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Администратор Библиотеки', 'admin@university.edu', 'admin123', 'admin']
      );
    }
  } catch (e) {
    console.error('Error creating default admin', e);
  }
}

