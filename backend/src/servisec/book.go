package servisec

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"backend/src/repo"
	"backend/src/sqlc"

	"github.com/jackc/pgx/v5/pgtype"
)

type BookService struct {
	repo    *repo.BookRepo
	storage *S3Storage
}

type BookInput struct {
	LegacyID        *int64          `json:"legacy_id"`
	Title           string          `json:"title"`
	Subtitle        *string         `json:"subtitle"`
	Author          *string         `json:"author"`
	Year            *int32          `json:"year"`
	Isbn            *string         `json:"isbn"`
	Language        *string         `json:"language"`
	Department      *string         `json:"department"`
	DepartmentCode  *string         `json:"department_code"`
	PublicationType *string         `json:"publication_type"`
	PublisherPlace  *string         `json:"publisher_place"`
	PublisherName   *string         `json:"publisher_name"`
	Pages           *int32          `json:"pages"`
	Price           *string         `json:"price"`
	Quantity        *int32          `json:"quantity"`
	Keywords        *string         `json:"keywords"`
	Description     *string         `json:"description"`
	LibraryName     *string         `json:"library_name"`
	LocationName    *string         `json:"location_name"`
	HtmlPath        *string         `json:"html_path"`
	RawData         json.RawMessage `json:"raw_data"`
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
	params, err := createBookParams(input)
	if err != nil {
		return sqlc.Book{}, err
	}
	return service.repo.CreateBook(ctx, params)
}

func (service *BookService) UpsertBook(ctx context.Context, input BookInput) (sqlc.Book, error) {
	params, err := upsertBookParams(input)
	if err != nil {
		return sqlc.Book{}, err
	}
	return service.repo.UpsertBookByLegacyID(ctx, params)
}

func (service *BookService) GetBook(ctx context.Context, id string) (sqlc.Book, error) {
	bookID, err := parseUUID(id)
	if err != nil {
		return sqlc.Book{}, err
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

func (service *BookService) UploadBookFile(ctx context.Context, bookID string, file multipart.File, header *multipart.FileHeader) (sqlc.BookFile, error) {
	id, err := parseUUID(bookID)
	if err != nil {
		return sqlc.BookFile{}, err
	}

	fileName := filepath.Base(header.Filename)
	objectKey := fmt.Sprintf("books/%s/%s", bookID, fileName)
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	object, err := service.storage.Put(ctx, objectKey, file, contentType)
	if err != nil {
		return sqlc.BookFile{}, err
	}

	return service.repo.CreateBookFile(ctx, sqlc.CreateBookFileParams{
		BookID:      id,
		Bucket:      object.Bucket,
		ObjectKey:   object.Key,
		FileName:    fileName,
		ContentType: textOrNull(contentType),
		SizeBytes:   int8OrNull(header.Size),
		Etag:        textOrNull(object.ETag),
	})
}

func (service *BookService) DownloadBookFile(ctx context.Context, bookID string) (StoredObject, sqlc.BookFile, error) {
	id, err := parseUUID(bookID)
	if err != nil {
		return StoredObject{}, sqlc.BookFile{}, err
	}

	file, err := service.repo.GetLatestBookFile(ctx, id)
	if err != nil {
		return StoredObject{}, sqlc.BookFile{}, err
	}

	object, err := service.storage.Get(ctx, file.Bucket, file.ObjectKey)
	if err != nil {
		return StoredObject{}, sqlc.BookFile{}, err
	}

	return object, file, nil
}

func (service *BookService) BookFileURL(ctx context.Context, bookID string, ttl time.Duration) (string, error) {
	id, err := parseUUID(bookID)
	if err != nil {
		return "", err
	}

	file, err := service.repo.GetLatestBookFile(ctx, id)
	if err != nil {
		return "", err
	}

	return service.storage.PresignedGetURL(ctx, file.Bucket, file.ObjectKey, ttl)
}

func (service *BookService) CopyToWriter(ctx context.Context, object StoredObject, writer io.Writer) error {
	defer object.Body.Close()
	_, err := io.Copy(writer, object.Body)
	return err
}

func createBookParams(input BookInput) (sqlc.CreateBookParams, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Без названия"
	}
	rawData := input.RawData
	if len(rawData) == 0 {
		rawData = []byte("{}")
	}
	price, err := numericOrNull(input.Price)
	if err != nil {
		return sqlc.CreateBookParams{}, err
	}

	return sqlc.CreateBookParams{
		LegacyID:        int8PtrOrNull(input.LegacyID),
		Title:           title,
		Subtitle:        textPtrOrNull(input.Subtitle),
		Author:          textPtrOrNull(input.Author),
		Year:            int4PtrOrNull(input.Year),
		Isbn:            textPtrOrNull(input.Isbn),
		Language:        textPtrOrNull(input.Language),
		Department:      textPtrOrNull(input.Department),
		DepartmentCode:  textPtrOrNull(input.DepartmentCode),
		PublicationType: textPtrOrNull(input.PublicationType),
		PublisherPlace:  textPtrOrNull(input.PublisherPlace),
		PublisherName:   textPtrOrNull(input.PublisherName),
		Pages:           int4PtrOrNull(input.Pages),
		Price:           price,
		Quantity:        int4PtrOrNull(input.Quantity),
		Keywords:        textPtrOrNull(input.Keywords),
		Description:     textPtrOrNull(input.Description),
		LibraryName:     textPtrOrNull(input.LibraryName),
		LocationName:    textPtrOrNull(input.LocationName),
		HtmlPath:        textPtrOrNull(input.HtmlPath),
		RawData:         rawData,
	}, nil
}

func upsertBookParams(input BookInput) (sqlc.UpsertBookByLegacyIDParams, error) {
	params, err := createBookParams(input)
	if err != nil {
		return sqlc.UpsertBookByLegacyIDParams{}, err
	}
	return sqlc.UpsertBookByLegacyIDParams(params), nil
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

func int8PtrOrNull(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *value, Valid: true}
}

func int8OrNull(value int64) pgtype.Int8 {
	if value <= 0 {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: value, Valid: true}
}

func numericOrNull(value *string) (pgtype.Numeric, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return pgtype.Numeric{}, nil
	}
	var numeric pgtype.Numeric
	err := numeric.Scan(strings.TrimSpace(*value))
	return numeric, err
}
