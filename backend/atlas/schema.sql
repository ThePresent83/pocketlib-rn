CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE s3_import_status AS ENUM (
    'PENDING',
    'DONE',
    'FAILED'
);

CREATE TYPE s3_source_kind AS ENUM (
    'BOOKS_XML',
    'REGISTRY_XML',
    'BOOK_FILE'
);

CREATE TABLE books (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    legacy_id BIGINT,
    title TEXT NOT NULL,
    subtitle TEXT,
    author TEXT,
    year INTEGER,
    isbn TEXT,
    language TEXT,
    department TEXT,
    department_code TEXT,
    publication_type TEXT,
    publisher_place TEXT,
    publisher_name TEXT,
    pages INTEGER,
    price NUMERIC(12, 2),
    quantity INTEGER,
    keywords TEXT,
    description TEXT,
    library_name TEXT,
    location_name TEXT,
    html_path TEXT,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_books_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_books_year CHECK (year IS NULL OR (year >= 0 AND year <= 3000)),
    CONSTRAINT chk_books_pages CHECK (pages IS NULL OR pages >= 0),
    CONSTRAINT chk_books_quantity CHECK (quantity IS NULL OR quantity >= 0),
    CONSTRAINT chk_books_raw_data_is_object CHECK (jsonb_typeof(raw_data) = 'object'),
    CONSTRAINT uq_books_legacy_id UNIQUE (legacy_id)
);

CREATE INDEX ix_books_created_at ON books (created_at DESC);

CREATE TABLE book_files (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    content_type TEXT,
    size_bytes BIGINT,
    etag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_book_files_book_id FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
    CONSTRAINT chk_book_files_bucket_not_blank CHECK (btrim(bucket) <> ''),
    CONSTRAINT chk_book_files_object_key_not_blank CHECK (btrim(object_key) <> ''),
    CONSTRAINT chk_book_files_file_name_not_blank CHECK (btrim(file_name) <> ''),
    CONSTRAINT chk_book_files_size_bytes CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE INDEX ix_book_files_book_id ON book_files (book_id);

CREATE TABLE book_registry_receipts (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    legacy_id BIGINT NOT NULL,
    number TEXT NOT NULL,
    receipt_date DATE NOT NULL,
    quantity INTEGER NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    source_name TEXT,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_book_registry_receipts_number_not_blank CHECK (btrim(number) <> ''),
    CONSTRAINT chk_book_registry_receipts_quantity CHECK (quantity >= 0),
    CONSTRAINT chk_book_registry_receipts_amount CHECK (amount >= 0),
    CONSTRAINT chk_book_registry_receipts_raw_data_is_object CHECK (jsonb_typeof(raw_data) = 'object')
);

CREATE TABLE s3_imports (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    source_kind s3_source_kind NOT NULL,
    status s3_import_status NOT NULL DEFAULT 'PENDING',
    etag TEXT,
    size_bytes BIGINT,
    books_imported INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    CONSTRAINT chk_s3_imports_bucket_not_blank CHECK (btrim(bucket) <> ''),
    CONSTRAINT chk_s3_imports_object_key_not_blank CHECK (btrim(object_key) <> ''),
    CONSTRAINT chk_s3_imports_size_bytes CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT chk_s3_imports_books_imported CHECK (books_imported >= 0),
    CONSTRAINT chk_s3_imports_finished_at CHECK (
        (status = 'PENDING' AND finished_at IS NULL) OR
        (status <> 'PENDING' AND finished_at IS NOT NULL)
    )
);

CREATE INDEX ix_s3_imports_created_at ON s3_imports (created_at DESC);
