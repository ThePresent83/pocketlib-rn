package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"backend/src/domain"
	"backend/src/servisec"

	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

type Handler struct {
	auth   *servisec.AuthService
	groups *servisec.GroupService
	books  *servisec.BookService
	reader *servisec.ReaderService
	logger *zap.Logger
}

type fileURLResponse struct {
	URL string `json:"url"`
}

func NewHandler(auth *servisec.AuthService, groups *servisec.GroupService, books *servisec.BookService, reader *servisec.ReaderService, logger *zap.Logger) *Handler {
	return &Handler{auth: auth, groups: groups, books: books, reader: reader, logger: logger}
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

	mux.HandleFunc("GET /disciplines", handler.listDisciplines)
	mux.HandleFunc("POST /disciplines", handler.requireAdmin(handler.createDiscipline))
	mux.HandleFunc("DELETE /disciplines/{id}", handler.requireAdmin(handler.deleteDiscipline))

	mux.HandleFunc("GET /courses", handler.listCourses)
	mux.HandleFunc("POST /courses", handler.requireAdmin(handler.createCourse))
	mux.HandleFunc("DELETE /courses/{id}", handler.requireAdmin(handler.deleteCourse))

	mux.HandleFunc("GET /categories", handler.listCategories)
	mux.HandleFunc("POST /categories", handler.requireAdmin(handler.createCategory))
	mux.HandleFunc("DELETE /categories/{id}", handler.requireAdmin(handler.deleteCategory))

	mux.HandleFunc("GET /groups", handler.listGroups)
	mux.HandleFunc("POST /groups", handler.requireAdmin(handler.createGroup))
	mux.HandleFunc("GET /groups/{id}", handler.getGroup)
	mux.HandleFunc("PUT /groups/{id}", handler.requireAdmin(handler.updateGroup))
	mux.HandleFunc("DELETE /groups/{id}", handler.requireAdmin(handler.deleteGroup))

	mux.HandleFunc("GET /books", handler.listBooks)
	mux.HandleFunc("POST /books", handler.requireStaff(handler.createBook))
	mux.HandleFunc("GET /books/{id}", handler.getBook)
	mux.HandleFunc("PUT /books/{id}", handler.requireStaff(handler.updateBook))
	mux.HandleFunc("DELETE /books/{id}", handler.requireStaff(handler.deleteBook))
	mux.HandleFunc("POST /books/{id}/file", handler.requireStaff(handler.uploadBookFile))
	mux.HandleFunc("GET /books/{id}/file", handler.requireAuth(handler.downloadBookFile))
	mux.HandleFunc("GET /books/{id}/file-url", handler.requireAuth(handler.bookFileURL))

	mux.HandleFunc("GET /reader-progress/{book_id}", handler.requireAuth(handler.getReaderProgress))
	mux.HandleFunc("PUT /reader-progress/{book_id}", handler.requireAuth(handler.saveReaderProgress))

	return withCORS(mux)
}

func (handler *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (handler *Handler) listDisciplines(w http.ResponseWriter, r *http.Request) {
	items, err := handler.groups.ListDisciplines(r.Context())
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (handler *Handler) createDiscipline(w http.ResponseWriter, r *http.Request) {
	var input servisec.DisciplineInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	item, err := handler.groups.CreateDiscipline(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (handler *Handler) deleteDiscipline(w http.ResponseWriter, r *http.Request) {
	if err := handler.groups.DeleteDiscipline(r.Context(), r.PathValue("id")); err != nil {
		handler.writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) listCourses(w http.ResponseWriter, r *http.Request) {
	var disciplineID *string
	if raw := r.URL.Query().Get("discipline_id"); raw != "" {
		disciplineID = &raw
	}
	items, err := handler.groups.ListCourses(r.Context(), disciplineID)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (handler *Handler) createCourse(w http.ResponseWriter, r *http.Request) {
	var input servisec.CourseInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	item, err := handler.groups.CreateCourse(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (handler *Handler) deleteCourse(w http.ResponseWriter, r *http.Request) {
	if err := handler.groups.DeleteCourse(r.Context(), r.PathValue("id")); err != nil {
		handler.writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) listCategories(w http.ResponseWriter, r *http.Request) {
	items, err := handler.groups.ListCategories(r.Context())
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (handler *Handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var input servisec.CategoryInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	item, err := handler.groups.CreateCategory(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (handler *Handler) deleteCategory(w http.ResponseWriter, r *http.Request) {
	if err := handler.groups.DeleteCategory(r.Context(), r.PathValue("id")); err != nil {
		handler.writeServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

	writeJSON(w, http.StatusCreated, group)
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

	writeJSON(w, http.StatusOK, group)
}

func (handler *Handler) listGroups(w http.ResponseWriter, r *http.Request) {
	groups, err := handler.groups.ListGroups(r.Context(), servisec.ListGroupsFilter{
		Query:  r.URL.Query().Get("q"),
		Limit:  parseInt32Query(r, "limit", 500),
		Offset: parseInt32Query(r, "offset", 0),
	})
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, groups)
}

func (handler *Handler) getGroup(w http.ResponseWriter, r *http.Request) {
	group, err := handler.groups.GetGroup(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, group)
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
	applyUploader(&input, r)

	book, err := handler.books.CreateBook(r.Context(), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, book)
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

	writeJSON(w, http.StatusOK, book)
}

func (handler *Handler) listBooks(w http.ResponseWriter, r *http.Request) {
	books, err := handler.books.ListBooks(r.Context(), servisec.ListBooksFilter{
		Query:        r.URL.Query().Get("q"),
		DisciplineID: queryStringPtr(r, "discipline_id"),
		CourseID:     queryStringPtr(r, "course_id"),
		CategoryID:   queryStringPtr(r, "category_id"),
		MaterialType: queryStringPtr(r, "material_type"),
		Language:     queryStringPtr(r, "language"),
		Semester:     queryInt32Ptr(r, "semester"),
		Limit:        parseInt32Query(r, "limit", 50),
		Offset:       parseInt32Query(r, "offset", 0),
	})
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, books)
}

func (handler *Handler) getBook(w http.ResponseWriter, r *http.Request) {
	book, err := handler.books.GetBook(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, book)
}

func (handler *Handler) deleteBook(w http.ResponseWriter, r *http.Request) {
	if err := handler.books.DeleteBook(r.Context(), r.PathValue("id")); err != nil {
		handler.writeServiceError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) uploadBookFile(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(128 << 20); err != nil {
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

	writeJSON(w, http.StatusCreated, book)
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
	case errors.Is(err, domain.ErrNotFound), errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, err)
	case errors.Is(err, servisec.ErrInvalidCourse), errors.Is(err, servisec.ErrBlankName):
		writeError(w, http.StatusBadRequest, err)
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

func queryStringPtr(r *http.Request, name string) *string {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil
	}
	return &raw
}

func queryInt32Ptr(r *http.Request, name string) *int32 {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil
	}
	value, err := strconv.ParseInt(raw, 10, 32)
	if err != nil {
		return nil
	}
	parsed := int32(value)
	return &parsed
}

func applyUploader(input *servisec.BookInput, r *http.Request) {
	if input.UploadedBy != nil {
		return
	}
	user := UserFromContext(r.Context())
	if user == nil {
		return
	}
	uploaderID := user.ID
	input.UploadedBy = &uploaderID
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
