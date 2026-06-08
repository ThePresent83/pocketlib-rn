package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"backend/src/domain"
	"backend/src/servisec"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"go.uber.org/zap"
)

type Handler struct {
	auth   *servisec.AuthService
	groups *servisec.GroupService
	books  *servisec.BookService
	logger *zap.Logger
}

type bookResponse struct {
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	Author          *string    `json:"author,omitempty"`
	Year            *int32     `json:"year,omitempty"`
	Description     *string    `json:"description,omitempty"`
	ContentS3Key    *string    `json:"content_s3_key,omitempty"`
	ContentS3Bucket *string    `json:"content_s3_bucket,omitempty"`
	CreatedAt       *time.Time `json:"created_at,omitempty"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
}

type groupResponse struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Course    sqlc.Courses `json:"course"`
	CreatedAt *time.Time   `json:"created_at,omitempty"`
	UpdatedAt *time.Time   `json:"updated_at,omitempty"`
}

type fileURLResponse struct {
	URL string `json:"url"`
}

func NewHandler(auth *servisec.AuthService, groups *servisec.GroupService, books *servisec.BookService, logger *zap.Logger) *Handler {
	return &Handler{auth: auth, groups: groups, books: books, logger: logger}
}

func (handler *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handler.health)
	mux.HandleFunc("POST /auth/register", handler.register)
	mux.HandleFunc("POST /auth/login", handler.login)
	mux.HandleFunc("POST /auth/refresh", handler.refresh)
	mux.HandleFunc("POST /auth/logout", handler.logout)
	mux.HandleFunc("GET /auth/me", handler.requireAuth(handler.me))
	mux.HandleFunc("GET /users", handler.requireAdmin(handler.listUsers))
	mux.HandleFunc("POST /users", handler.requireAdmin(handler.createUser))
	mux.HandleFunc("GET /users/{id}", handler.requireAdmin(handler.getUser))
	mux.HandleFunc("PUT /users/{id}", handler.requireAdmin(handler.updateUser))
	mux.HandleFunc("DELETE /users/{id}", handler.requireAdmin(handler.deleteUser))
	mux.HandleFunc("PATCH /users/{id}/role", handler.requireAdmin(handler.updateUserRole))
	mux.HandleFunc("GET /groups", handler.requireAdmin(handler.listGroups))
	mux.HandleFunc("POST /groups", handler.requireAdmin(handler.createGroup))
	mux.HandleFunc("GET /groups/{id}", handler.requireAdmin(handler.getGroup))
	mux.HandleFunc("PUT /groups/{id}", handler.requireAdmin(handler.updateGroup))
	mux.HandleFunc("DELETE /groups/{id}", handler.requireAdmin(handler.deleteGroup))
	mux.HandleFunc("GET /books", handler.listBooks)
	mux.HandleFunc("POST /books", handler.createBook)
	mux.HandleFunc("GET /books/{id}", handler.getBook)
	mux.HandleFunc("PUT /books/{id}", handler.updateBook)
	mux.HandleFunc("DELETE /books/{id}", handler.deleteBook)
	mux.HandleFunc("POST /books/{id}/file", handler.uploadBookFile)
	mux.HandleFunc("GET /books/{id}/file", handler.downloadBookFile)
	mux.HandleFunc("GET /books/{id}/file-url", handler.bookFileURL)
	return mux
}

func (handler *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (handler *Handler) createGroup(w http.ResponseWriter, r *http.Request) {
	var input servisec.GroupInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	group, err := handler.groups.CreateGroup(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toGroupResponse(group))
}

func (handler *Handler) updateGroup(w http.ResponseWriter, r *http.Request) {
	var input servisec.GroupInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	group, err := handler.groups.UpdateGroup(r.Context(), r.PathValue("id"), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toGroupResponse(group))
}

func (handler *Handler) listGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := handler.groups.ListGroups(r.Context(), servisec.ListGroupsFilter{
		Query:  r.URL.Query().Get("q"),
		Limit:  parseInt32Query(r, "limit", 50),
		Offset: parseInt32Query(r, "offset", 0),
	})
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	response := make([]groupResponse, 0, len(groups))
	for _, group := range groups {
		response = append(response, toGroupResponse(group))
	}

	writeJSON(w, http.StatusOK, response)
}

func (handler *Handler) getGroup(w http.ResponseWriter, r *http.Request) {
	group, err := handler.groups.GetGroup(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toGroupResponse(group))
}

func (handler *Handler) deleteGroup(w http.ResponseWriter, r *http.Request) {
	if err := handler.groups.DeleteGroup(r.Context(), r.PathValue("id")); err != nil {
		handler.writeServiceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

func (handler *Handler) updateBook(w http.ResponseWriter, r *http.Request) {
	var input servisec.BookInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	book, err := handler.books.UpdateBook(r.Context(), r.PathValue("id"), input)
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

func (handler *Handler) deleteBook(w http.ResponseWriter, r *http.Request) {
	if err := handler.books.DeleteBook(r.Context(), r.PathValue("id")); err != nil {
		handler.writeServiceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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

	book, err := handler.books.UploadBookFile(r.Context(), r.PathValue("id"), file, header)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toBookResponse(book))
}

func (handler *Handler) downloadBookFile(w http.ResponseWriter, r *http.Request) {
	bookFile, err := handler.books.DownloadBookFile(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	if bookFile.Object.ContentType != "" {
		w.Header().Set("Content-Type", bookFile.Object.ContentType)
	}
	w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(bookFile.FileName))
	if bookFile.Object.SizeBytes > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(bookFile.Object.SizeBytes, 10))
	}

	if err := handler.books.CopyToWriter(bookFile.Object, w); err != nil {
		handler.logger.Error("failed to stream book file", zap.Error(err))
	}
}

func (handler *Handler) bookFileURL(w http.ResponseWriter, r *http.Request) {
	url, err := handler.books.BookFileURL(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, fileURLResponse{URL: url})
}

func (handler *Handler) writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalidID):
		writeError(w, http.StatusBadRequest, err)
	case errors.Is(err, domain.ErrCollision):
		writeError(w, http.StatusConflict, err)
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, err)
	case errors.Is(err, servisec.ErrInvalidCourse):
		writeError(w, http.StatusBadRequest, err)
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, err)
	case errors.Is(err, servisec.ErrBookFileNotFound):
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

func toGroupResponse(group sqlc.Group) groupResponse {
	return groupResponse{
		ID:        uuidString(group.ID),
		Name:      group.Name,
		Course:    group.Course,
		CreatedAt: timePtr(group.CreatedAt),
		UpdatedAt: timePtr(group.UpdatedAt),
	}
}

func toBookResponse(book sqlc.Book) bookResponse {
	return bookResponse{
		ID:              uuidString(book.ID),
		Title:           book.Title,
		Author:          stringPtr(book.Author),
		Year:            int32Ptr(book.Year),
		Description:     stringPtr(book.Description),
		ContentS3Key:    stringPtr(book.ContentS3Key),
		ContentS3Bucket: stringPtr(book.ContentS3Bucket),
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

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}
