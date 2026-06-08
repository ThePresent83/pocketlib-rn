CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE roles AS ENUM (
    'USER',
    'ADMIN'
);

CREATE TYPE courses AS ENUM (
    'FIRST',
    'SECOND',
    'THIRD',
    'FOURTH'
);

CREATE TYPE book_read_status AS ENUM (
    'PLANNED',
    'READING',
    'FINISHED'
);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    course courses NOT NULL DEFAULT 'FIRST',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_groups_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT uq_groups_name UNIQUE (name)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login TEXT NOT NULL,
    password TEXT NOT NULL,
    group_id UUID,
    role roles NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_group_id FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE SET NULL,
    CONSTRAINT chk_users_login_not_blank CHECK (btrim(login) <> ''),
    CONSTRAINT chk_users_password_not_blank CHECK (btrim(password) <> ''),
    CONSTRAINT uq_users_login UNIQUE (login)
);

CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT,
    year INTEGER,
    description TEXT,
    content_s3_key TEXT,
    content_s3_bucket TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_books_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_books_year CHECK (year IS NULL OR (year >= 0 AND year <= 3000))
);

CREATE TABLE book_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    book_id UUID NOT NULL,
    status book_read_status NOT NULL DEFAULT 'PLANNED',
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_book_reads_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_book_reads_book_id FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
    CONSTRAINT uq_book_reads_user_book UNIQUE (user_id, book_id)
);
