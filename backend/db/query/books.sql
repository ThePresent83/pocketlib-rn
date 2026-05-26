-- name: CreateBook :one
INSERT INTO books (
    legacy_id,
    title,
    subtitle,
    author,
    year,
    isbn,
    language,
    department,
    department_code,
    publication_type,
    publisher_place,
    publisher_name,
    pages,
    price,
    quantity,
    keywords,
    description,
    library_name,
    location_name,
    html_path,
    raw_data
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
)
RETURNING *;

-- name: UpsertBookByLegacyID :one
INSERT INTO books (
    legacy_id,
    title,
    subtitle,
    author,
    year,
    isbn,
    language,
    department,
    department_code,
    publication_type,
    publisher_place,
    publisher_name,
    pages,
    price,
    quantity,
    keywords,
    description,
    library_name,
    location_name,
    html_path,
    raw_data
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
)
ON CONFLICT (legacy_id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    author = EXCLUDED.author,
    year = EXCLUDED.year,
    isbn = EXCLUDED.isbn,
    language = EXCLUDED.language,
    department = EXCLUDED.department,
    department_code = EXCLUDED.department_code,
    publication_type = EXCLUDED.publication_type,
    publisher_place = EXCLUDED.publisher_place,
    publisher_name = EXCLUDED.publisher_name,
    pages = EXCLUDED.pages,
    price = EXCLUDED.price,
    quantity = EXCLUDED.quantity,
    keywords = EXCLUDED.keywords,
    description = EXCLUDED.description,
    library_name = EXCLUDED.library_name,
    location_name = EXCLUDED.location_name,
    html_path = EXCLUDED.html_path,
    raw_data = EXCLUDED.raw_data,
    updated_at = CURRENT_TIMESTAMP
RETURNING *;

-- name: GetBook :one
SELECT *
FROM books
WHERE id = $1;

-- name: ListBooks :many
SELECT *
FROM books
WHERE
    (
        sqlc.narg('query')::TEXT IS NULL OR
        title ILIKE '%' || sqlc.narg('query')::TEXT || '%' OR
        author ILIKE '%' || sqlc.narg('query')::TEXT || '%' OR
        isbn ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    )
ORDER BY created_at DESC, id DESC
LIMIT $1 OFFSET $2;

-- name: CreateBookFile :one
INSERT INTO book_files (
    book_id,
    bucket,
    object_key,
    file_name,
    content_type,
    size_bytes,
    etag
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
)
RETURNING *;

-- name: GetLatestBookFile :one
SELECT *
FROM book_files
WHERE book_id = $1
ORDER BY created_at DESC
LIMIT 1;

-- name: ListBookFiles :many
SELECT *
FROM book_files
WHERE book_id = $1
ORDER BY created_at DESC;

-- name: CreateS3Import :one
INSERT INTO s3_imports (
    bucket,
    object_key,
    source_kind,
    status,
    etag,
    size_bytes
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: FinishS3Import :one
UPDATE s3_imports
SET
    status = $2,
    books_imported = $3,
    error_message = $4,
    finished_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING *;
