package servisec

import (
	"context"
	"errors"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"

	"backend/src/domain"
	"backend/src/repo"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5/pgtype"
)

type BookService struct {
	repo    *repo.BookRepo
	storage *S3Storage
}

var ErrBookFileNotFound = errors.New("book file is not uploaded")

type BookFileObject struct {
	Object   StoredObject
	FileName string
}

type BookInput struct {
	Title           string  `json:"title"`
	Author          *string `json:"author"`
	Year            *int32  `json:"year"`
	Description     *string `json:"description"`
	ContentS3Key    *string `json:"content_s3_key"`
	ContentS3Bucket *string `json:"content_s3_bucket"`
}

type ListBooksFilter struct {
	Query  string
	Limit  int32
	Offset int32
}

func NewBookService(repo *repo.BookRepo, storage *S3Storage) *BookService {
	return &BookService{repo: repo, storage: storage}
}

func (service *BookService) CreateBook(ctx context.Context, input BookInput) (sqlc.Book, error) {
	return service.repo.CreateBook(ctx, createBookParams(input))
}

func (service *BookService) UpdateBook(ctx context.Context, id string, input BookInput) (sqlc.Book, error) {
	bookID, err := parseUUID(id)
	if err != nil {
		return sqlc.Book{}, domain.ErrInvalidID
	}

	params := createBookParams(input)
	return service.repo.UpdateBook(ctx, sqlc.UpdateBookParams{
		ID:              bookID,
		Title:           params.Title,
		Author:          params.Author,
		Year:            params.Year,
		Description:     params.Description,
		ContentS3Key:    params.ContentS3Key,
		ContentS3Bucket: params.ContentS3Bucket,
	})
}

func (service *BookService) GetBook(ctx context.Context, id string) (sqlc.Book, error) {
	bookID, err := parseUUID(id)
	if err != nil {
		return sqlc.Book{}, domain.ErrInvalidID
	}
	return service.repo.GetBook(ctx, bookID)
}

func (service *BookService) ListBooks(ctx context.Context, filter ListBooksFilter) ([]sqlc.Book, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 50
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	return service.repo.ListBooks(ctx, sqlc.ListBooksParams{
		Limit:  filter.Limit,
		Offset: filter.Offset,
		Query:  textOrNull(filter.Query),
	})
}

func (service *BookService) DeleteBook(ctx context.Context, id string) error {
	bookID, err := parseUUID(id)
	if err != nil {
		return domain.ErrInvalidID
	}

	return service.repo.DeleteBook(ctx, bookID)
}

func (service *BookService) UploadBookFile(ctx context.Context, bookID string, file multipart.File, header *multipart.FileHeader) (sqlc.Book, error) {
	id, err := parseUUID(bookID)
	if err != nil {
		return sqlc.Book{}, domain.ErrInvalidID
	}

	uploadedFile, err := service.storage.UploadFile(ctx, header.Filename, header.Size, file)
	if err != nil {
		return sqlc.Book{}, err
	}

	return service.repo.UpdateBookContentFile(ctx, sqlc.UpdateBookContentFileParams{
		ID:              id,
		ContentS3Key:    textOrNull(uploadedFile.S3Key),
		ContentS3Bucket: textOrNull(uploadedFile.S3Bucket),
	})
}

func (service *BookService) DownloadBookFile(ctx context.Context, bookID string) (BookFileObject, error) {
	book, err := service.GetBook(ctx, bookID)
	if err != nil {
		return BookFileObject{}, err
	}
	if !book.ContentS3Key.Valid || !book.ContentS3Bucket.Valid {
		return BookFileObject{}, ErrBookFileNotFound
	}

	object, err := service.storage.Get(ctx, book.ContentS3Bucket.String, book.ContentS3Key.String)
	if err != nil {
		return BookFileObject{}, err
	}

	return BookFileObject{
		Object:   object,
		FileName: filepath.Base(book.ContentS3Key.String),
	}, nil
}

func (service *BookService) BookFileURL(ctx context.Context, bookID string) (string, error) {
	book, err := service.GetBook(ctx, bookID)
	if err != nil {
		return "", err
	}
	if !book.ContentS3Key.Valid || !book.ContentS3Bucket.Valid {
		return "", ErrBookFileNotFound
	}

	publicURL := service.storage.CreatePublicURL(book.ContentS3Key.String, book.ContentS3Bucket.String)
	return publicURL.String(), nil
}

func (service *BookService) CopyToWriter(object StoredObject, writer io.Writer) error {
	defer object.Body.Close()
	_, err := io.Copy(writer, object.Body)
	return err
}

func createBookParams(input BookInput) sqlc.CreateBookParams {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Без названия"
	}

	return sqlc.CreateBookParams{
		Title:           title,
		Author:          textPtrOrNull(input.Author),
		Year:            int4PtrOrNull(input.Year),
		Description:     textPtrOrNull(input.Description),
		ContentS3Key:    textPtrOrNull(input.ContentS3Key),
		ContentS3Bucket: textPtrOrNull(input.ContentS3Bucket),
	}
}

func parseUUID(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	err := id.Scan(value)
	return id, err
}

func textOrNull(value string) pgtype.Text {
	value = strings.TrimSpace(value)
	return pgtype.Text{String: value, Valid: value != ""}
}

func textPtrOrNull(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return textOrNull(*value)
}

func int4PtrOrNull(value *int32) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *value, Valid: true}
}
