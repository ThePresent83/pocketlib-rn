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
)

type BookRepo interface {
	CreateBook(ctx context.Context, input repo.BookUpsert) (domain.Book, error)
	UpdateBook(ctx context.Context, id string, input repo.BookUpsert) (domain.Book, error)
	GetBook(ctx context.Context, id string) (domain.Book, error)
	UpdateBookContentFile(ctx context.Context, input repo.BookContentFileUpdate) (domain.Book, error)
	ListBooks(ctx context.Context, filter repo.BookFilters) ([]domain.Book, error)
	DeleteBook(ctx context.Context, id string) error
}

type BookService struct {
	repo    BookRepo
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
	ISBN            *string `json:"isbn"`
	Description     *string `json:"description"`
	CoverURL        *string `json:"cover_url"`
	Source          *string `json:"source"`
	OLKey           *string `json:"ol_key"`
	IAID            *string `json:"ia_id"`
	GutenbergID     *string `json:"gutenberg_id"`
	HasFulltext     bool    `json:"has_fulltext"`
	DisciplineID    *string `json:"discipline_id"`
	CourseID        *string `json:"course_id"`
	CategoryID      *string `json:"category_id"`
	SpecialityID    *string `json:"speciality_id"`
	MaterialType    *string `json:"material_type"`
	Language        *string `json:"language"`
	Semester        *int32  `json:"semester"`
	Teacher         *string `json:"teacher"`
	Tags            *string `json:"tags"`
	Version         *string `json:"version"`
	AccessLevel     *string `json:"access_level"`
	UploadedBy      *string `json:"uploaded_by"`
	ExternalURL     *string `json:"external_url"`
	RemoteID        *string `json:"remote_id"`
	ContentS3Key    *string `json:"content_s3_key"`
	ContentS3Bucket *string `json:"content_s3_bucket"`
	FileName        *string `json:"file_name"`
	FileSize        *int64  `json:"file_size"`
	ContentType     *string `json:"content_type"`
}

type ListBooksFilter struct {
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

func NewBookService(repo BookRepo, storage *S3Storage) *BookService {
	return &BookService{repo: repo, storage: storage}
}

func (service *BookService) CreateBook(ctx context.Context, input BookInput) (domain.Book, error) {
	return service.repo.CreateBook(ctx, createBookParams(input))
}

func (service *BookService) UpdateBook(ctx context.Context, id string, input BookInput) (domain.Book, error) {
	return service.repo.UpdateBook(ctx, strings.TrimSpace(id), createBookParams(input))
}

func (service *BookService) GetBook(ctx context.Context, id string) (domain.Book, error) {
	return service.repo.GetBook(ctx, strings.TrimSpace(id))
}

func (service *BookService) ListBooks(ctx context.Context, filter ListBooksFilter) ([]domain.Book, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 50
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	return service.repo.ListBooks(ctx, repo.BookFilters{
		Query:        filter.Query,
		DisciplineID: trimPtr(filter.DisciplineID),
		CourseID:     trimPtr(filter.CourseID),
		CategoryID:   trimPtr(filter.CategoryID),
		MaterialType: trimPtr(filter.MaterialType),
		Language:     trimPtr(filter.Language),
		Semester:     filter.Semester,
		Limit:        filter.Limit,
		Offset:       filter.Offset,
	})
}

func (service *BookService) DeleteBook(ctx context.Context, id string) error {
	return service.repo.DeleteBook(ctx, strings.TrimSpace(id))
}

func (service *BookService) UploadBookFile(ctx context.Context, bookID string, file multipart.File, header *multipart.FileHeader) (domain.Book, error) {
	if service.storage == nil {
		return domain.Book{}, ErrS3Disabled
	}
	uploadedFile, err := service.storage.UploadFile(ctx, header.Filename, header.Size, file)
	if err != nil {
		return domain.Book{}, err
	}

	return service.repo.UpdateBookContentFile(ctx, repo.BookContentFileUpdate{
		ID:              strings.TrimSpace(bookID),
		ContentS3Key:    uploadedFile.S3Key,
		ContentS3Bucket: uploadedFile.S3Bucket,
		FileName:        header.Filename,
		FileSize:        header.Size,
		ContentType:     header.Header.Get("Content-Type"),
	})
}

func (service *BookService) DownloadBookFile(ctx context.Context, bookID string) (BookFileObject, error) {
	book, err := service.GetBook(ctx, bookID)
	if err != nil {
		return BookFileObject{}, err
	}
	if book.ContentS3Key == nil || book.ContentS3Bucket == nil {
		return BookFileObject{}, ErrBookFileNotFound
	}

	object, err := service.storage.Get(ctx, *book.ContentS3Bucket, *book.ContentS3Key)
	if err != nil {
		return BookFileObject{}, err
	}

	fileName := filepath.Base(*book.ContentS3Key)
	if book.FileName != nil {
		fileName = *book.FileName
	}

	return BookFileObject{
		Object:   object,
		FileName: fileName,
	}, nil
}

func (service *BookService) BookFileURL(ctx context.Context, bookID string) (string, error) {
	book, err := service.GetBook(ctx, bookID)
	if err != nil {
		return "", err
	}
	if book.ContentS3Key == nil || book.ContentS3Bucket == nil {
		return "", ErrBookFileNotFound
	}

	publicURL := service.storage.CreatePublicURL(*book.ContentS3Key, *book.ContentS3Bucket)
	return publicURL.String(), nil
}

func (service *BookService) CopyToWriter(object StoredObject, writer io.Writer) error {
	defer object.Body.Close()
	_, err := io.Copy(writer, object.Body)
	return err
}

func createBookParams(input BookInput) repo.BookUpsert {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = "Без названия"
	}

	source := "api"
	if input.Source != nil && strings.TrimSpace(*input.Source) != "" {
		source = strings.TrimSpace(*input.Source)
	}
	accessLevel := "public"
	if input.AccessLevel != nil && strings.TrimSpace(*input.AccessLevel) != "" {
		accessLevel = strings.TrimSpace(*input.AccessLevel)
	}

	return repo.BookUpsert{
		Title:           title,
		Author:          trimPtr(input.Author),
		Year:            input.Year,
		ISBN:            trimPtr(input.ISBN),
		Description:     trimPtr(input.Description),
		CoverURL:        trimPtr(input.CoverURL),
		Source:          source,
		OLKey:           trimPtr(input.OLKey),
		IAID:            trimPtr(input.IAID),
		GutenbergID:     trimPtr(input.GutenbergID),
		HasFulltext:     input.HasFulltext,
		DisciplineID:    trimPtr(input.DisciplineID),
		CourseID:        trimPtr(input.CourseID),
		CategoryID:      trimPtr(input.CategoryID),
		SpecialityID:    trimPtr(input.SpecialityID),
		MaterialType:    trimPtr(input.MaterialType),
		Language:        trimPtr(input.Language),
		Semester:        input.Semester,
		Teacher:         trimPtr(input.Teacher),
		Tags:            trimPtr(input.Tags),
		Version:         trimPtr(input.Version),
		AccessLevel:     accessLevel,
		UploadedBy:      trimPtr(input.UploadedBy),
		ExternalURL:     trimPtr(input.ExternalURL),
		RemoteID:        trimPtr(input.RemoteID),
		ContentS3Key:    trimPtr(input.ContentS3Key),
		ContentS3Bucket: trimPtr(input.ContentS3Bucket),
		FileName:        trimPtr(input.FileName),
		FileSize:        input.FileSize,
		ContentType:     trimPtr(input.ContentType),
	}
}

