package app

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

const schemaSQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS groups DROP COLUMN IF EXISTS course;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'courses' AND typtype = 'e'
	) THEN
		DROP TYPE courses;
	END IF;
END $$;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'users' AND column_name = 'role' AND udt_name = 'roles'
	) THEN
		ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
		ALTER TABLE users ALTER COLUMN role TYPE TEXT USING
			CASE
				WHEN role::TEXT = 'ADMIN' THEN 'admin'
				WHEN role::TEXT = 'USER' THEN 'student'
				ELSE lower(role::TEXT)
			END;
	END IF;
END $$;

DROP TYPE IF EXISTS roles;

CREATE TABLE IF NOT EXISTS disciplines (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	code TEXT,
	name_kk TEXT,
	name_en TEXT,
	color TEXT NOT NULL DEFAULT '#5C6BC0',
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT chk_disciplines_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_disciplines_name ON disciplines (name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_disciplines_code ON disciplines (code) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS courses (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	year INTEGER NOT NULL,
	discipline_id UUID NOT NULL REFERENCES disciplines (id) ON DELETE CASCADE,
	code TEXT,
	name_kk TEXT,
	name_en TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT chk_courses_name_not_blank CHECK (btrim(name) <> ''),
	CONSTRAINT chk_courses_year CHECK (year >= 1 AND year <= 6)
);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS chk_courses_year;
ALTER TABLE courses ADD CONSTRAINT chk_courses_year CHECK (year >= 1 AND year <= 6);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_discipline_year_name ON courses (discipline_id, year, name);
CREATE INDEX IF NOT EXISTS idx_courses_discipline_id ON courses (discipline_id);

CREATE TABLE IF NOT EXISTS categories (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT chk_categories_name_not_blank CHECK (btrim(name) <> ''),
	CONSTRAINT uq_categories_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS groups (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	course_id UUID REFERENCES courses (id) ON DELETE SET NULL,
	admission_year INTEGER,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT chk_groups_name_not_blank CHECK (btrim(name) <> ''),
	CONSTRAINT uq_groups_name UNIQUE (name)
);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses (id) ON DELETE SET NULL;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS admission_year INTEGER;

CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	login TEXT NOT NULL,
	email TEXT NOT NULL,
	full_name TEXT NOT NULL,
	password TEXT NOT NULL,
	group_id UUID REFERENCES groups (id) ON DELETE SET NULL,
	role TEXT NOT NULL DEFAULT 'student',
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT chk_users_login_not_blank CHECK (btrim(login) <> ''),
	CONSTRAINT chk_users_email_not_blank CHECK (btrim(email) <> ''),
	CONSTRAINT chk_users_full_name_not_blank CHECK (btrim(full_name) <> ''),
	CONSTRAINT chk_users_password_not_blank CHECK (btrim(password) <> ''),
	CONSTRAINT chk_users_role CHECK (role IN ('student', 'teacher', 'admin'))
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ALTER COLUMN role TYPE TEXT USING lower(role::TEXT);
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'student';
UPDATE users SET email = login WHERE email IS NULL OR btrim(email) = '';
UPDATE users SET full_name = login WHERE full_name IS NULL OR btrim(full_name) = '';
UPDATE users SET role = 'admin' WHERE lower(role) = 'admin';
UPDATE users SET role = 'teacher' WHERE lower(role) = 'teacher';
UPDATE users SET role = 'student' WHERE lower(role) IN ('user', 'student') OR role IS NULL OR btrim(role) = '';
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_login ON users (login);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);

CREATE TABLE IF NOT EXISTS books (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title TEXT NOT NULL,
	author TEXT,
	year INTEGER,
	isbn TEXT,
	description TEXT,
	cover_url TEXT,
	source TEXT NOT NULL DEFAULT 'api',
	ol_key TEXT,
	ia_id TEXT,
	gutenberg_id TEXT,
	has_fulltext BOOLEAN NOT NULL DEFAULT FALSE,
	discipline_id UUID REFERENCES disciplines (id) ON DELETE SET NULL,
	course_id UUID REFERENCES courses (id) ON DELETE SET NULL,
	category_id UUID REFERENCES categories (id) ON DELETE SET NULL,
	speciality_id UUID REFERENCES disciplines (id) ON DELETE SET NULL,
	material_type TEXT,
	language TEXT,
	semester INTEGER,
	teacher TEXT,
	tags TEXT,
	version TEXT,
	access_level TEXT NOT NULL DEFAULT 'public',
	uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL,
	external_url TEXT,
	remote_id TEXT,
	content_s3_key TEXT,
	content_s3_bucket TEXT,
	cover_s3_key TEXT,
	cover_s3_bucket TEXT,
	file_name TEXT,
	file_size BIGINT,
	content_type TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT chk_books_title_not_blank CHECK (btrim(title) <> ''),
	CONSTRAINT chk_books_year CHECK (year IS NULL OR (year >= 0 AND year <= 3000)),
	CONSTRAINT chk_books_access_level CHECK (access_level IN ('public', 'students', 'teachers', 'private'))
);

ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'api';
ALTER TABLE books ADD COLUMN IF NOT EXISTS ol_key TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS ia_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS gutenberg_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS has_fulltext BOOLEAN DEFAULT FALSE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS discipline_id UUID REFERENCES disciplines (id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses (id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories (id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS speciality_id UUID REFERENCES disciplines (id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS material_type TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS semester INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS teacher TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS version TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'public';
ALTER TABLE books ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS remote_id TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS content_s3_key TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS content_s3_bucket TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_s3_key TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_s3_bucket TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE books ALTER COLUMN source SET DEFAULT 'api';
ALTER TABLE books ALTER COLUMN has_fulltext SET DEFAULT FALSE;
ALTER TABLE books ALTER COLUMN access_level SET DEFAULT 'public';
UPDATE books SET source = 'api' WHERE source IS NULL OR btrim(source) = '';
UPDATE books SET has_fulltext = FALSE WHERE has_fulltext IS NULL;
UPDATE books SET access_level = 'public' WHERE access_level IS NULL OR btrim(access_level) = '';

CREATE INDEX IF NOT EXISTS idx_books_discipline_id ON books (discipline_id);
CREATE INDEX IF NOT EXISTS idx_books_course_id ON books (course_id);
CREATE INDEX IF NOT EXISTS idx_books_category_id ON books (category_id);
CREATE INDEX IF NOT EXISTS idx_books_material_type ON books (material_type);
CREATE INDEX IF NOT EXISTS idx_books_language ON books (language);

CREATE TABLE IF NOT EXISTS reading_history (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	book_id UUID NOT NULL REFERENCES books (id) ON DELETE CASCADE,
	last_opened TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	progress INTEGER NOT NULL DEFAULT 0,
	page INTEGER NOT NULL DEFAULT 0,
	total_pages INTEGER NOT NULL DEFAULT 0,
	font_size INTEGER NOT NULL DEFAULT 16,
	bookmarks JSONB NOT NULL DEFAULT '[]'::jsonb,
	appearance JSONB NOT NULL DEFAULT '{"font_family":"serif","line_height":1.7,"page_width":760,"theme":"paper"}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT uq_reading_history_user_book UNIQUE (user_id, book_id)
);

ALTER TABLE reading_history ADD COLUMN IF NOT EXISTS font_size INTEGER NOT NULL DEFAULT 16;
ALTER TABLE reading_history ADD COLUMN IF NOT EXISTS appearance JSONB NOT NULL DEFAULT '{"font_family":"serif","line_height":1.7,"page_width":760,"theme":"paper"}'::jsonb;
`

func ensureSchema(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, schemaSQL)
	return err
}
