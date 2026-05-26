package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"backend/src/servisec"
	"backend/src/sqlc"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type Handler struct {
	books  *servisec.BookService
	logger *zap.Logger
}

type bookResponse struct {
	ID              string          `json:"id"`
	LegacyID        *int64          `json:"legacy_id,omitempty"`
	Title           string          `json:"title"`
	Subtitle        *string         `json:"subtitle,omitempty"`
	Author          *string         `json:"author,omitempty"`
	Year            *int32          `json:"year,omitempty"`
	Isbn            *string         `json:"isbn,omitempty"`
	Language        *string         `json:"language,omitempty"`
	Department      *string         `json:"department,omitempty"`
	DepartmentCode  *string         `json:"department_code,omitempty"`
	PublicationType *string         `json:"publication_type,omitempty"`
	PublisherPlace  *string         `json:"publisher_place,omitempty"`
	PublisherName   *string         `json:"publisher_name,omitempty"`
	Pages           *int32          `json:"pages,omitempty"`
	Price           *string         `json:"price,omitempty"`
	Quantity        *int32          `json:"quantity,omitempty"`
	Keywords        *string         `json:"keywords,omitempty"`
	Description     *string         `json:"description,omitempty"`
	LibraryName     *string         `json:"library_name,omitempty"`
	LocationName    *string         `json:"location_name,omitempty"`
	HtmlPath        *string         `json:"html_path,omitempty"`
	RawData         json.RawMessage `json:"raw_data"`
	CreatedAt       *time.Time      `json:"created_at,omitempty"`
	UpdatedAt       *time.Time      `json:"updated_at,omitempty"`
}

type fileURLResponse struct {
	URL string `json:"url"`
}

func NewHandler(books *servisec.BookService, logger *zap.Logger) *Handler {
	return &Handler{books: books, logger: logger}
}

func (handler *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.health)
	mux.HandleFunc("GET /books", handler.listBooks)
	mux.HandleFunc("POST /books", handler.createBook)
	mux.HandleFunc("PUT /books/by-legacy-id", handler.upsertBook)
	mux.HandleFunc("GET /books/{id}", handler.getBook)
	mux.HandleFunc("POST /books/{id}/file", handler.uploadBookFile)
	mux.HandleFunc("GET /books/{id}/file", handler.downloadBookFile)
	mux.HandleFunc("GET /books/{id}/file-url", handler.bookFileURL)
	return mux
}

func (handler *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (handler *Handler) createBook(w http.ResponseWriter, r *http.Request) {
	var input servisec.BookInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	book, err := handler.books.CreateBook(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toBookResponse(book))
}

func (handler *Handler) upsertBook(w http.ResponseWriter, r *http.Request) {
	var input servisec.BookInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.LegacyID == nil {
		writeError(w, http.StatusBadRequest, errors.New("legacy_id is required"))
		return
	}

	book, err := handler.books.UpsertBook(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toBookResponse(book))
}

func (handler *Handler) listBooks(w http.ResponseWriter, r *http.Request) {
	limit := parseInt32Query(r, "limit", 50)
	offset := parseInt32Query(r, "offset", 0)
	books, err := handler.books.ListBooks(r.Context(), servisec.ListBooksFilter{
		Query:  r.URL.Query().Get("q"),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	response := make([]bookResponse, 0, len(books))
	for _, book := range books {
		response = append(response, toBookResponse(book))
	}

	writeJSON(w, http.StatusOK, response)
}

func (handler *Handler) getBook(w http.ResponseWriter, r *http.Request) {
	book, err := handler.books.GetBook(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toBookResponse(book))
}

func (handler *Handler) uploadBookFile(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	defer file.Close()

	bookFile, err := handler.books.UploadBookFile(r.Context(), r.PathValue("id"), file, header)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, bookFile)
}

func (handler *Handler) downloadBookFile(w http.ResponseWriter, r *http.Request) {
	object, file, err := handler.books.DownloadBookFile(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	if object.ContentType != "" {
		w.Header().Set("Content-Type", object.ContentType)
	}
	w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(file.FileName))
	if object.SizeBytes > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(object.SizeBytes, 10))
	}

	if err := handler.books.CopyToWriter(r.Context(), object, w); err != nil {
		handler.logger.Error("failed to stream book file", zap.Error(err))
	}
}

func (handler *Handler) bookFileURL(w http.ResponseWriter, r *http.Request) {
	url, err := handler.books.BookFileURL(r.Context(), r.PathValue("id"), 15*time.Minute)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, fileURLResponse{URL: url})
}

func (handler *Handler) writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, err)
	case errors.Is(err, servisec.ErrS3Disabled):
		writeError(w, http.StatusServiceUnavailable, err)
	default:
		handler.logger.Error("request failed", zap.Error(err))
		writeError(w, http.StatusInternalServerError, err)
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func parseInt32Query(r *http.Request, name string, fallback int32) int32 {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return fallback
	}
	return int32(value)
}

func toBookResponse(book sqlc.Book) bookResponse {
	rawData := json.RawMessage(book.RawData)
	if len(rawData) == 0 {
		rawData = json.RawMessage("{}")
	}

	return bookResponse{
		ID:              uuidString(book.ID),
		LegacyID:        int64Ptr(book.LegacyID),
		Title:           book.Title,
		Subtitle:        stringPtr(book.Subtitle),
		Author:          stringPtr(book.Author),
		Year:            int32Ptr(book.Year),
		Isbn:            stringPtr(book.Isbn),
		Language:        stringPtr(book.Language),
		Department:      stringPtr(book.Department),
		DepartmentCode:  stringPtr(book.DepartmentCode),
		PublicationType: stringPtr(book.PublicationType),
		PublisherPlace:  stringPtr(book.PublisherPlace),
		PublisherName:   stringPtr(book.PublisherName),
		Pages:           int32Ptr(book.Pages),
		Price:           numericStringPtr(book.Price),
		Quantity:        int32Ptr(book.Quantity),
		Keywords:        stringPtr(book.Keywords),
		Description:     stringPtr(book.Description),
		LibraryName:     stringPtr(book.LibraryName),
		LocationName:    stringPtr(book.LocationName),
		HtmlPath:        stringPtr(book.HtmlPath),
		RawData:         rawData,
		CreatedAt:       timePtr(book.CreatedAt),
		UpdatedAt:       timePtr(book.UpdatedAt),
	}
}

func uuidString(value pgtype.UUID) string {
	driverValue, err := value.Value()
	if err != nil || driverValue == nil {
		return ""
	}
	return driverValue.(string)
}

func stringPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func int32Ptr(value pgtype.Int4) *int32 {
	if !value.Valid {
		return nil
	}
	return &value.Int32
}

func int64Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func numericStringPtr(value pgtype.Numeric) *string {
	if !value.Valid {
		return nil
	}
	driverValue, err := value.Value()
	if err != nil || driverValue == nil {
		return nil
	}
	result := driverValue.(string)
	return &result
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}
