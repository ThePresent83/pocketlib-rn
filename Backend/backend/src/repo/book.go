package repo

import (
	"context"
	"errors"
	"strings"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type BookRepo struct {
	db sqlc.DBTX
}

type BookFilters struct {
	Query        string
	DisciplineID *string
	CourseID     *string
	CategoryID   *string
	MaterialType *string
	Language     *string
	Semester     *int32
	Limit        int32
	Offset       int32
}

type BookUpsert struct {
	Title           string
	Author          *string
	Year            *int32
	ISBN            *string
	Description     *string
	CoverURL        *string
	Source          string
	OLKey           *string
	IAID            *string
	GutenbergID     *string
	HasFulltext     bool
	DisciplineID    *string
	CourseID        *string
	CategoryID      *string
	SpecialityID    *string
	MaterialType    *string
	Language        *string
	Semester        *int32
	Teacher         *string
	Tags            *string
	Version         *string
	AccessLevel     string
	UploadedBy      *string
	ExternalURL     *string
	RemoteID        *string
	ContentS3Key    *string
	ContentS3Bucket *string
	FileName        *string
	FileSize        *int64
	ContentType     *string
}

type BookContentFileUpdate struct {
	ID              string
	ContentS3Key    string
	ContentS3Bucket string
	FileName        string
	FileSize        int64
	ContentType     string
}

func NewBookRepo(db sqlc.DBTX) *BookRepo {
	return &BookRepo{db: db}
}

func (repo *BookRepo) CreateBook(ctx context.Context, input BookUpsert) (domain.Book, error) {
	book, err := repo.scanBook(repo.db.QueryRow(ctx, `
		INSERT INTO books (
			title, author, year, isbn, description, cover_url, source, ol_key, ia_id, gutenberg_id,
			has_fulltext, discipline_id, course_id, category_id, speciality_id, material_type,
			language, semester, teacher, tags, version, access_level, uploaded_by, external_url,
			remote_id, content_s3_key, content_s3_bucket, file_name, file_size, content_type
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16,
			$17, $18, $19, $20, $21, $22, $23, $24,
			$25, $26, $27, $28, $29, $30
		)
		RETURNING `+bookColumns(""), bookArgs(input)...))
	if isUniqueViolation(err) {
		return domain.Book{}, domain.ErrCollision
	}
	return book, err
}

func (repo *BookRepo) UpdateBook(ctx context.Context, id string, input BookUpsert) (domain.Book, error) {
	bookID, err := uuidStringOrError(id)
	if err != nil {
		return domain.Book{}, err
	}
	args := append([]any{bookID}, bookArgs(input)...)
	book, err := repo.scanBook(repo.db.QueryRow(ctx, `
		UPDATE books
		SET
			title = $2,
			author = $3,
			year = $4,
			isbn = $5,
			description = $6,
			cover_url = $7,
			source = $8,
			ol_key = $9,
			ia_id = $10,
			gutenberg_id = $11,
			has_fulltext = $12,
			discipline_id = $13,
			course_id = $14,
			category_id = $15,
			speciality_id = $16,
			material_type = $17,
			language = $18,
			semester = $19,
			teacher = $20,
			tags = $21,
			version = $22,
			access_level = $23,
			uploaded_by = $24,
			external_url = $25,
			remote_id = $26,
			content_s3_key = COALESCE($27, content_s3_key),
			content_s3_bucket = COALESCE($28, content_s3_bucket),
			file_name = COALESCE($29, file_name),
			file_size = COALESCE($30, file_size),
			content_type = COALESCE($31, content_type),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
		RETURNING `+bookColumns(""), args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Book{}, domain.ErrNotFound
	}
	if isUniqueViolation(err) {
		return domain.Book{}, domain.ErrCollision
	}
	return book, err
}

func (repo *BookRepo) GetBook(ctx context.Context, id string) (domain.Book, error) {
	bookID, err := uuidStringOrError(id)
	if err != nil {
		return domain.Book{}, err
	}
	book, err := repo.scanBook(repo.db.QueryRow(ctx, `SELECT `+bookColumns("")+` FROM books WHERE id = $1`, bookID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Book{}, domain.ErrNotFound
	}
	return book, err
}

func (repo *BookRepo) ListBooks(ctx context.Context, filter BookFilters) ([]domain.Book, error) {
	disciplineID, err := uuidPtrOrNull(filter.DisciplineID)
	if err != nil {
		return nil, err
	}
	courseID, err := uuidPtrOrNull(filter.CourseID)
	if err != nil {
		return nil, err
	}
	categoryID, err := uuidPtrOrNull(filter.CategoryID)
	if err != nil {
		return nil, err
	}

	rows, err := repo.db.Query(ctx, `
		SELECT `+bookColumns("books")+`
		FROM books
		WHERE
			($1 = '' OR title ILIKE '%' || $1 || '%' OR COALESCE(author, '') ILIKE '%' || $1 || '%' OR COALESCE(tags, '') ILIKE '%' || $1 || '%' OR COALESCE(teacher, '') ILIKE '%' || $1 || '%')
			AND ($2::UUID IS NULL OR discipline_id = $2)
			AND ($3::UUID IS NULL OR course_id = $3)
			AND ($4::UUID IS NULL OR category_id = $4)
			AND ($5 = '' OR material_type = $5)
			AND ($6 = '' OR language = $6)
			AND ($7::INTEGER IS NULL OR semester = $7)
		ORDER BY created_at DESC, id DESC
		LIMIT $8 OFFSET $9
	`,
		strings.TrimSpace(filter.Query),
		disciplineID,
		courseID,
		categoryID,
		stringValue(filter.MaterialType),
		stringValue(filter.Language),
		int32PtrOrNull(filter.Semester),
		filter.Limit,
		filter.Offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	books := make([]domain.Book, 0)
	for rows.Next() {
		book, err := scanBookRow(rows)
		if err != nil {
			return nil, err
		}
		books = append(books, book)
	}
	return books, rows.Err()
}

func (repo *BookRepo) UpdateBookContentFile(ctx context.Context, input BookContentFileUpdate) (domain.Book, error) {
	bookID, err := uuidStringOrError(input.ID)
	if err != nil {
		return domain.Book{}, err
	}
	book, err := repo.scanBook(repo.db.QueryRow(ctx, `
		UPDATE books
		SET
			content_s3_key = $2,
			content_s3_bucket = $3,
			file_name = $4,
			file_size = $5,
			content_type = $6,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
		RETURNING `+bookColumns(""),
		bookID,
		input.ContentS3Key,
		input.ContentS3Bucket,
		input.FileName,
		input.FileSize,
		input.ContentType,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Book{}, domain.ErrNotFound
	}
	return book, err
}

func (repo *BookRepo) DeleteBook(ctx context.Context, id string) error {
	bookID, err := uuidStringOrError(id)
	if err != nil {
		return err
	}
	tag, err := repo.db.Exec(ctx, `DELETE FROM books WHERE id = $1`, bookID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (repo *BookRepo) scanBook(row pgx.Row) (domain.Book, error) {
	return scanBookRow(row)
}

type bookScanner interface {
	Scan(dest ...any) error
}

func scanBookRow(row bookScanner) (domain.Book, error) {
	var (
		book            domain.Book
		author          pgtype.Text
		year            pgtype.Int4
		isbn            pgtype.Text
		description     pgtype.Text
		coverURL        pgtype.Text
		olKey           pgtype.Text
		iaID            pgtype.Text
		gutenbergID     pgtype.Text
		disciplineID    string
		courseID        string
		categoryID      string
		specialityID    string
		materialType    pgtype.Text
		language        pgtype.Text
		semester        pgtype.Int4
		teacher         pgtype.Text
		tags            pgtype.Text
		version         pgtype.Text
		uploadedBy      string
		externalURL     pgtype.Text
		remoteID        pgtype.Text
		contentS3Key    pgtype.Text
		contentS3Bucket pgtype.Text
		fileName        pgtype.Text
		fileSize        pgtype.Int8
		contentType     pgtype.Text
		createdAt       pgtype.Timestamptz
		updatedAt       pgtype.Timestamptz
	)

	if err := row.Scan(
		&book.ID,
		&book.Title,
		&author,
		&year,
		&isbn,
		&description,
		&coverURL,
		&book.Source,
		&olKey,
		&iaID,
		&gutenbergID,
		&book.HasFulltext,
		&disciplineID,
		&courseID,
		&categoryID,
		&specialityID,
		&materialType,
		&language,
		&semester,
		&teacher,
		&tags,
		&version,
		&book.AccessLevel,
		&uploadedBy,
		&externalURL,
		&remoteID,
		&contentS3Key,
		&contentS3Bucket,
		&fileName,
		&fileSize,
		&contentType,
		&createdAt,
		&updatedAt,
	); err != nil {
		return domain.Book{}, err
	}

	book.Author = pgTextPtr(author)
	book.Year = pgInt4Ptr(year)
	book.ISBN = pgTextPtr(isbn)
	book.Description = pgTextPtr(description)
	book.CoverURL = pgTextPtr(coverURL)
	book.OLKey = pgTextPtr(olKey)
	book.IAID = pgTextPtr(iaID)
	book.GutenbergID = pgTextPtr(gutenbergID)
	book.DisciplineID = stringPtrOrNil(disciplineID)
	book.CourseID = stringPtrOrNil(courseID)
	book.CategoryID = stringPtrOrNil(categoryID)
	book.SpecialityID = stringPtrOrNil(specialityID)
	book.MaterialType = pgTextPtr(materialType)
	book.Language = pgTextPtr(language)
	book.Semester = pgInt4Ptr(semester)
	book.Teacher = pgTextPtr(teacher)
	book.Tags = pgTextPtr(tags)
	book.Version = pgTextPtr(version)
	book.UploadedBy = stringPtrOrNil(uploadedBy)
	book.ExternalURL = pgTextPtr(externalURL)
	book.RemoteID = pgTextPtr(remoteID)
	book.ContentS3Key = pgTextPtr(contentS3Key)
	book.ContentS3Bucket = pgTextPtr(contentS3Bucket)
	book.FileName = pgTextPtr(fileName)
	book.FileSize = pgInt8Ptr(fileSize)
	book.ContentType = pgTextPtr(contentType)
	book.HasFile = book.ContentS3Key != nil && book.ContentS3Bucket != nil
	book.CreatedAt = timePtr(createdAt)
	book.UpdatedAt = timePtr(updatedAt)
	return book, nil
}

func bookColumns(table string) string {
	prefix := ""
	if table != "" {
		prefix = table + "."
	}
	return prefix + `id::TEXT,
		` + prefix + `title,
		` + prefix + `author,
		` + prefix + `year,
		` + prefix + `isbn,
		` + prefix + `description,
		` + prefix + `cover_url,
		` + prefix + `source,
		` + prefix + `ol_key,
		` + prefix + `ia_id,
		` + prefix + `gutenberg_id,
		` + prefix + `has_fulltext,
		COALESCE(` + prefix + `discipline_id::TEXT, ''),
		COALESCE(` + prefix + `course_id::TEXT, ''),
		COALESCE(` + prefix + `category_id::TEXT, ''),
		COALESCE(` + prefix + `speciality_id::TEXT, ''),
		` + prefix + `material_type,
		` + prefix + `language,
		` + prefix + `semester,
		` + prefix + `teacher,
		` + prefix + `tags,
		` + prefix + `version,
		` + prefix + `access_level,
		COALESCE(` + prefix + `uploaded_by::TEXT, ''),
		` + prefix + `external_url,
		` + prefix + `remote_id,
		` + prefix + `content_s3_key,
		` + prefix + `content_s3_bucket,
		` + prefix + `file_name,
		` + prefix + `file_size,
		` + prefix + `content_type,
		` + prefix + `created_at,
		` + prefix + `updated_at`
}

func bookArgs(input BookUpsert) []any {
	return []any{
		input.Title,
		textPtrOrNull(input.Author),
		int32PtrOrNull(input.Year),
		textPtrOrNull(input.ISBN),
		textPtrOrNull(input.Description),
		textPtrOrNull(input.CoverURL),
		input.Source,
		textPtrOrNull(input.OLKey),
		textPtrOrNull(input.IAID),
		textPtrOrNull(input.GutenbergID),
		input.HasFulltext,
		uuidParam(input.DisciplineID),
		uuidParam(input.CourseID),
		uuidParam(input.CategoryID),
		uuidParam(input.SpecialityID),
		textPtrOrNull(input.MaterialType),
		textPtrOrNull(input.Language),
		int32PtrOrNull(input.Semester),
		textPtrOrNull(input.Teacher),
		textPtrOrNull(input.Tags),
		textPtrOrNull(input.Version),
		input.AccessLevel,
		uuidParam(input.UploadedBy),
		textPtrOrNull(input.ExternalURL),
		textPtrOrNull(input.RemoteID),
		textPtrOrNull(input.ContentS3Key),
		textPtrOrNull(input.ContentS3Bucket),
		textPtrOrNull(input.FileName),
		int64PtrOrNull(input.FileSize),
		textPtrOrNull(input.ContentType),
	}
}

func uuidParam(value *string) pgtype.UUID {
	id, err := uuidPtrOrNull(value)
	if err != nil {
		return pgtype.UUID{}
	}
	return id
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
