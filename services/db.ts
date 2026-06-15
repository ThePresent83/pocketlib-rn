import * as SQLite from 'expo-sqlite';
import {
  QUALIFICATION_LOCALIZATIONS,
  SPECIALITY_LOCALIZATIONS,
  STUDENT_GROUP_SEEDS,
} from '../constants/studentGroups';
import { SCHEDULE_DISCIPLINE_SEEDS } from '../constants/scheduleDisciplines';

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
      group_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(speciality_id) REFERENCES specialities(id) ON DELETE SET NULL,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS disciplines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(32),
      name_kk VARCHAR(256),
      name_en VARCHAR(256),
      color VARCHAR(32) DEFAULT '#5C6BC0'
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL,
      year INTEGER NOT NULL,
      discipline_id INTEGER,
      code VARCHAR(32),
      name_kk VARCHAR(256),
      name_en VARCHAR(256),
      FOREIGN KEY(discipline_id) REFERENCES disciplines(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(128) NOT NULL UNIQUE,
      course_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
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
    'external_url VARCHAR(1024)',
    'remote_id VARCHAR(128)',
    'created_at DATETIME DEFAULT CURRENT_TIMESTAMP'
  ];

  for (const col of columnsToAdd) {
    try {
      await database.runAsync(`ALTER TABLE books ADD COLUMN ${col}`);
    } catch (e) {
      // Ignore existing columns during lightweight migrations.
    }
  }

  const userColumnsToAdd = [
    'group_id INTEGER'
  ];

  for (const col of userColumnsToAdd) {
    try {
      await database.runAsync(`ALTER TABLE users ADD COLUMN ${col}`);
    } catch (e) {
      // Ignore existing columns during lightweight migrations.
    }
  }

  const disciplineColumnsToAdd = [
    'code VARCHAR(32)',
    'name_kk VARCHAR(256)',
    'name_en VARCHAR(256)'
  ];

  for (const col of disciplineColumnsToAdd) {
    try {
      await database.runAsync(`ALTER TABLE disciplines ADD COLUMN ${col}`);
    } catch (e) {
      // Ignore existing columns during lightweight migrations.
    }
  }

  const courseColumnsToAdd = [
    'code VARCHAR(32)',
    'name_kk VARCHAR(256)',
    'name_en VARCHAR(256)'
  ];

  for (const col of courseColumnsToAdd) {
    try {
      await database.runAsync(`ALTER TABLE courses ADD COLUMN ${col}`);
    } catch (e) {
      // Ignore existing columns during lightweight migrations.
    }
  }

  try {
    await database.runAsync("DELETE FROM books WHERE source = 'official' AND remote_id IS NOT NULL");
  } catch (e) {
    console.error('Error removing deprecated official books', e);
  }

  try {
    await seedCollegeCatalog(database);
    await seedScheduleDisciplines(database);
  } catch (e) {
    console.error('Error seeding college catalog', e);
  }

  // Create the default administrator for a fresh local database.
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

type IdRow = { id: number };

const CATALOG_COLORS = ['#5C6BC0', '#26A69A', '#FF7043', '#7E57C2', '#42A5F5'];
const SCHEDULE_COLORS = ['#4DB6AC', '#7986CB', '#FFB74D', '#81C784', '#BA68C8', '#64B5F6'];

async function seedCollegeCatalog(database: SQLite.SQLiteDatabase) {
  const disciplineIds = new Map<string, number>();
  const courseIds = new Map<string, number>();

  for (const seed of STUDENT_GROUP_SEEDS) {
    const speciality = SPECIALITY_LOCALIZATIONS[seed.specialityCode];
    const qualification = QUALIFICATION_LOCALIZATIONS[seed.qualificationCode];

    if (!speciality || !qualification) continue;

    let disciplineId = disciplineIds.get(seed.specialityCode);
    if (!disciplineId) {
      const color = CATALOG_COLORS[disciplineIds.size % CATALOG_COLORS.length];
      disciplineId = await upsertDiscipline(database, {
        code: seed.specialityCode,
        name: speciality.ru,
        nameKk: speciality.kk,
        nameEn: speciality.en,
        color,
      });
      disciplineIds.set(seed.specialityCode, disciplineId);
    }

    const courseKey = `${disciplineId}:${seed.courseYear}:${seed.qualificationCode}`;
    let courseId = courseIds.get(courseKey);
    if (!courseId) {
      courseId = await upsertCourse(database, {
        code: seed.qualificationCode,
        name: qualification.ru,
        nameKk: qualification.kk,
        nameEn: qualification.en,
        year: seed.courseYear,
        disciplineId,
      });
      courseIds.set(courseKey, courseId);
    }

    await database.runAsync('INSERT OR IGNORE INTO groups (name, course_id) VALUES (?, ?)', [seed.name, courseId]);
    await database.runAsync('UPDATE groups SET course_id = ? WHERE name = ?', [courseId, seed.name]);
  }
}

async function seedScheduleDisciplines(database: SQLite.SQLiteDatabase) {
  for (let i = 0; i < SCHEDULE_DISCIPLINE_SEEDS.length; i += 1) {
    const seed = SCHEDULE_DISCIPLINE_SEEDS[i];
    await upsertNamedDiscipline(database, {
      name: seed.name.ru,
      nameKk: seed.name.kk,
      nameEn: seed.name.en,
      color: SCHEDULE_COLORS[i % SCHEDULE_COLORS.length],
    });
  }
}

async function upsertDiscipline(
  database: SQLite.SQLiteDatabase,
  data: { code: string; name: string; nameKk: string; nameEn: string; color: string }
) {
  const existing = await database.getFirstAsync<IdRow>(
    'SELECT id FROM disciplines WHERE code = ? OR name = ? LIMIT 1',
    [data.code, data.name]
  );

  if (existing) {
    await database.runAsync(
      'UPDATE disciplines SET code = ?, name = ?, name_kk = ?, name_en = ? WHERE id = ?',
      [data.code, data.name, data.nameKk, data.nameEn, existing.id]
    );
    return existing.id;
  }

  const result = await database.runAsync(
    'INSERT INTO disciplines (name, color, code, name_kk, name_en) VALUES (?, ?, ?, ?, ?)',
    [data.name, data.color, data.code, data.nameKk, data.nameEn]
  );
  return result.lastInsertRowId;
}

async function upsertNamedDiscipline(
  database: SQLite.SQLiteDatabase,
  data: { name: string; nameKk: string; nameEn: string; color: string }
) {
  const existing = await database.getFirstAsync<IdRow>(
    'SELECT id FROM disciplines WHERE name = ? LIMIT 1',
    [data.name]
  );

  if (existing) {
    await database.runAsync(
      'UPDATE disciplines SET name_kk = ?, name_en = ? WHERE id = ?',
      [data.nameKk, data.nameEn, existing.id]
    );
    return existing.id;
  }

  const result = await database.runAsync(
    'INSERT INTO disciplines (name, color, name_kk, name_en) VALUES (?, ?, ?, ?)',
    [data.name, data.color, data.nameKk, data.nameEn]
  );
  return result.lastInsertRowId;
}

async function upsertCourse(
  database: SQLite.SQLiteDatabase,
  data: {
    code: string;
    name: string;
    nameKk: string;
    nameEn: string;
    year: number;
    disciplineId: number;
  }
) {
  const existing = await database.getFirstAsync<IdRow>(
    `SELECT id
     FROM courses
     WHERE discipline_id = ? AND year = ? AND (code = ? OR name = ?)
     LIMIT 1`,
    [data.disciplineId, data.year, data.code, data.name]
  );

  if (existing) {
    await database.runAsync(
      'UPDATE courses SET code = ?, name = ?, name_kk = ?, name_en = ?, discipline_id = ?, year = ? WHERE id = ?',
      [data.code, data.name, data.nameKk, data.nameEn, data.disciplineId, data.year, existing.id]
    );
    return existing.id;
  }

  const result = await database.runAsync(
    'INSERT INTO courses (name, year, discipline_id, code, name_kk, name_en) VALUES (?, ?, ?, ?, ?, ?)',
    [data.name, data.year, data.disciplineId, data.code, data.nameKk, data.nameEn]
  );
  return result.lastInsertRowId;
}
