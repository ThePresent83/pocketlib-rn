package http

import (
	"encoding/json"
	"net/http"

	"backend/src/servisec"
)

func (handler *Handler) getReaderProgress(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, servisec.ErrInvalidToken)
		return
	}

	state, err := handler.reader.GetState(r.Context(), user.ID, r.PathValue("book_id"))
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, state)
}

func (handler *Handler) saveReaderProgress(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, servisec.ErrInvalidToken)
		return
	}

	var input servisec.ReaderStateInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	state, err := handler.reader.SaveState(r.Context(), user.ID, r.PathValue("book_id"), input)
	if err != nil {
		handler.writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, state)
}
