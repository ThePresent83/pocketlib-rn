-- name: CreateUser :one
INSERT INTO users (
    login,
    password,
    group_id,
    role
) VALUES (
    sqlc.arg('login'),
    sqlc.arg('password'),
    sqlc.narg('group_id')::UUID,
    sqlc.arg('role')::roles
)
RETURNING id::TEXT, login, password, role::TEXT;

-- name: CreateUserAdmin :one
INSERT INTO users (
    login,
    password,
    group_id,
    role
) VALUES (
    sqlc.arg('login'),
    sqlc.arg('password'),
    sqlc.narg('group_id')::UUID,
    sqlc.arg('role')::roles
)
RETURNING id::TEXT, login, password, COALESCE(group_id::TEXT, '') AS group_id, role::TEXT, created_at, updated_at;

-- name: GetUser :one
SELECT id::TEXT, login, password, COALESCE(group_id::TEXT, '') AS group_id, role::TEXT, created_at, updated_at
FROM users
WHERE id = sqlc.arg('id');

-- name: GetUserByLogin :one
SELECT id::TEXT, login, password, role::TEXT
FROM users
WHERE login = sqlc.arg('login');

-- name: ListUsers :many
SELECT id::TEXT, login, password, COALESCE(group_id::TEXT, '') AS group_id, role::TEXT, created_at, updated_at
FROM users
WHERE
    (
        sqlc.narg('query')::TEXT IS NULL OR
        login ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: UpdateUser :one
UPDATE users
SET
    login = sqlc.arg('login'),
    password = COALESCE(sqlc.narg('password')::TEXT, password),
    group_id = sqlc.narg('group_id')::UUID,
    role = sqlc.arg('role')::roles,
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
RETURNING id::TEXT, login, password, COALESCE(group_id::TEXT, '') AS group_id, role::TEXT, created_at, updated_at;

-- name: UpdateUserRole :one
UPDATE users
SET
    role = sqlc.arg('role')::roles,
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
RETURNING id::TEXT, login, password, role::TEXT;

-- name: DeleteUser :execrows
DELETE FROM users
WHERE id = sqlc.arg('id');

-- name: CreateGroup :one
INSERT INTO groups (
    name,
    course
) VALUES (
    sqlc.arg('name'),
    sqlc.arg('course')::courses
)
RETURNING *;

-- name: GetGroup :one
SELECT *
FROM groups
WHERE id = sqlc.arg('id');

-- name: ListGroups :many
SELECT *
FROM groups
WHERE
    (
        sqlc.narg('query')::TEXT IS NULL OR
        name ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: UpdateGroup :one
UPDATE groups
SET
    name = sqlc.arg('name'),
    course = sqlc.arg('course')::courses,
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: DeleteGroup :execrows
DELETE FROM groups
WHERE id = sqlc.arg('id');

-- name: CreateBook :one
INSERT INTO books (
    title,
    author,
    year,
    description,
    content_s3_key,
    content_s3_bucket
) VALUES (
    sqlc.arg('title'),
    sqlc.narg('author')::TEXT,
    sqlc.narg('year')::INTEGER,
    sqlc.narg('description')::TEXT,
    sqlc.narg('content_s3_key')::TEXT,
    sqlc.narg('content_s3_bucket')::TEXT
)
RETURNING *;

-- name: GetBook :one
SELECT *
FROM books
WHERE id = sqlc.arg('id');

-- name: UpdateBook :one
UPDATE books
SET
    title = sqlc.arg('title'),
    author = sqlc.narg('author')::TEXT,
    year = sqlc.narg('year')::INTEGER,
    description = sqlc.narg('description')::TEXT,
    content_s3_key = sqlc.narg('content_s3_key')::TEXT,
    content_s3_bucket = sqlc.narg('content_s3_bucket')::TEXT,
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: UpdateBookContentFile :one
UPDATE books
SET
    content_s3_key = sqlc.arg('content_s3_key'),
    content_s3_bucket = sqlc.arg('content_s3_bucket'),
    updated_at = CURRENT_TIMESTAMP
WHERE id = sqlc.arg('id')
RETURNING *;

-- name: ListBooks :many
SELECT *
FROM books
WHERE
    (
        sqlc.narg('query')::TEXT IS NULL OR
        title ILIKE '%' || sqlc.narg('query')::TEXT || '%' OR
        author ILIKE '%' || sqlc.narg('query')::TEXT || '%'
    )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('limit') OFFSET sqlc.arg('offset');

-- name: DeleteBook :execrows
DELETE FROM books
WHERE id = sqlc.arg('id');
