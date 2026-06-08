package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"backend/src/domain"
	"backend/src/servisec"

	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

type contextUserKey struct{}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type userResponse struct {
	ID        string      `json:"id"`
	Login     string      `json:"login"`
	GroupID   *string     `json:"group_id,omitempty"`
	Role      domain.Role `json:"role"`
	CreatedAt *time.Time  `json:"created_at,omitempty"`
	UpdatedAt *time.Time  `json:"updated_at,omitempty"`
}

func (handler *Handler) register(w http.ResponseWriter, r *http.Request) {
	var input servisec.RegisterInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	result, err := handler.auth.Register(r.Context(), input)
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, result)
}

func (handler *Handler) login(w http.ResponseWriter, r *http.Request) {
	var input servisec.LoginInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	result, err := handler.auth.Login(r.Context(), input)
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (handler *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var input refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	result, err := handler.auth.Refresh(r.Context(), input.RefreshToken)
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (handler *Handler) logout(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (handler *Handler) me(w http.ResponseWriter, r *http.Request) {
	user := UserFromContext(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, servisec.ErrInvalidToken)
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (handler *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	var input servisec.CreateUserAdminInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	user, err := handler.auth.CreateUserAdmin(r.Context(), input)
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, toUserResponse(user))
}

func (handler *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	users, err := handler.auth.ListUsers(r.Context(), servisec.ListUsersFilter{
		Query:  r.URL.Query().Get("q"),
		Limit:  parseInt32Query(r, "limit", 50),
		Offset: parseInt32Query(r, "offset", 0),
	})
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	response := make([]userResponse, 0, len(users))
	for _, user := range users {
		response = append(response, toUserResponse(user))
	}
	writeJSON(w, http.StatusOK, response)
}

func (handler *Handler) getUser(w http.ResponseWriter, r *http.Request) {
	user, err := handler.auth.GetUser(r.Context(), r.PathValue("id"))
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toUserResponse(user))
}

func (handler *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	var input servisec.UpdateUserInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	user, err := handler.auth.UpdateUser(r.Context(), r.PathValue("id"), input)
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, toUserResponse(user))
}

func (handler *Handler) deleteUser(w http.ResponseWriter, r *http.Request) {
	if err := handler.auth.DeleteUser(r.Context(), r.PathValue("id")); err != nil {
		handler.writeAuthError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (handler *Handler) updateUserRole(w http.ResponseWriter, r *http.Request) {
	var input servisec.UpdateUserRoleInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	user, err := handler.auth.UpdateUserRole(r.Context(), r.PathValue("id"), input)
	if err != nil {
		handler.writeAuthError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (handler *Handler) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := servisec.BearerToken(r.Header.Get("Authorization"))
		if err != nil {
			writeError(w, http.StatusUnauthorized, err)
			return
		}

		user, err := handler.auth.ParseAccessToken(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err)
			return
		}

		next(w, r.WithContext(context.WithValue(r.Context(), contextUserKey{}, user)))
	}
}

func (handler *Handler) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return handler.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		if user == nil {
			writeError(w, http.StatusUnauthorized, servisec.ErrInvalidToken)
			return
		}
		if user.Role != domain.RoleAdmin {
			writeError(w, http.StatusForbidden, fmt.Errorf("admin role is required"))
			return
		}

		next(w, r)
	})
}

func UserFromContext(ctx context.Context) *servisec.SessionUser {
	user, ok := ctx.Value(contextUserKey{}).(servisec.SessionUser)
	if !ok {
		return nil
	}
	return &user
}

func (handler *Handler) writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, servisec.ErrBlankLogin), errors.Is(err, servisec.ErrBlankPassword), errors.Is(err, servisec.ErrInvalidID):
		writeError(w, http.StatusBadRequest, err)
	case errors.Is(err, servisec.ErrInvalidRole):
		writeError(w, http.StatusBadRequest, err)
	case errors.Is(err, servisec.ErrLoginCollision):
		writeError(w, http.StatusConflict, err)
	case errors.Is(err, servisec.ErrInvalidCredentials), errors.Is(err, servisec.ErrInvalidToken), errors.Is(err, servisec.ErrInvalidTokenType):
		writeError(w, http.StatusUnauthorized, err)
	case errors.Is(err, servisec.ErrNotFound):
		writeError(w, http.StatusNotFound, err)
	case errors.Is(err, pgx.ErrNoRows):
		writeError(w, http.StatusNotFound, err)
	default:
		handler.logger.Error("auth request failed", zap.Error(err))
		writeError(w, http.StatusInternalServerError, err)
	}
}

func toUserResponse(user domain.User) userResponse {
	return userResponse{
		ID:        user.ID,
		Login:     user.Login,
		GroupID:   user.GroupID,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}
}
