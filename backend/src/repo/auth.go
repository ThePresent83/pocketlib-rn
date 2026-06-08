package repo

import (
	"context"
	"errors"
	"time"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type AuthRepo struct {
	queries *sqlc.Queries
}

func NewAuthRepo(queries *sqlc.Queries) *AuthRepo {
	return &AuthRepo{queries: queries}
}

func (repo *AuthRepo) CreateUser(ctx context.Context, input domain.CreateUserInput) (domain.User, error) {
	groupID, err := uuidPtrOrNull(input.GroupID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.queries.CreateUser(ctx, sqlc.CreateUserParams{
		Login:    input.Login,
		Password: input.PasswordHash,
		GroupID:  groupID,
		Role:     sqlc.Roles(input.Role),
	})
	if isUniqueViolation(err) {
		return domain.User{}, domain.ErrLoginCollision
	}
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		Role:         domain.Role(user.Role),
	}, err
}

func (repo *AuthRepo) CreateUserAdmin(ctx context.Context, input domain.CreateUserAdminInput) (domain.User, error) {
	groupID, err := uuidPtrOrNull(input.GroupID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.queries.CreateUserAdmin(ctx, sqlc.CreateUserAdminParams{
		Login:    input.Login,
		Password: input.PasswordHash,
		GroupID:  groupID,
		Role:     sqlc.Roles(input.Role),
	})
	if isUniqueViolation(err) {
		return domain.User{}, domain.ErrLoginCollision
	}
	return userFromCreateAdminRow(user), err
}

func (repo *AuthRepo) GetUser(ctx context.Context, userID string) (domain.User, error) {
	id, err := uuidStringOrError(userID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.queries.GetUser(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	return userFromGetRow(user), err
}

func (repo *AuthRepo) GetUserByLogin(ctx context.Context, login string) (domain.User, error) {
	user, err := repo.queries.GetUserByLogin(ctx, login)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, err
	}
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		Role:         domain.Role(user.Role),
	}, err
}

func (repo *AuthRepo) ListUsers(ctx context.Context, filter domain.ListUsersFilter) ([]domain.User, error) {
	users, err := repo.queries.ListUsers(ctx, sqlc.ListUsersParams{
		Query:  textOrNull(filter.Query),
		Limit:  filter.Limit,
		Offset: filter.Offset,
	})
	if err != nil {
		return nil, err
	}

	result := make([]domain.User, 0, len(users))
	for _, user := range users {
		result = append(result, userFromListRow(user))
	}
	return result, nil
}

func (repo *AuthRepo) UpdateUser(ctx context.Context, input domain.UpdateUserInput) (domain.User, error) {
	userID, err := uuidStringOrError(input.UserID)
	if err != nil {
		return domain.User{}, err
	}
	groupID, err := uuidPtrOrNull(input.GroupID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.queries.UpdateUser(ctx, sqlc.UpdateUserParams{
		ID:       userID,
		Login:    input.Login,
		Password: textPtrOrNull(input.PasswordHash),
		GroupID:  groupID,
		Role:     sqlc.Roles(input.Role),
	})
	if isUniqueViolation(err) {
		return domain.User{}, domain.ErrLoginCollision
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	return userFromUpdateRow(user), err
}

func (repo *AuthRepo) UpdateUserRole(ctx context.Context, input domain.UpdateUserRoleInput) (domain.User, error) {
	userID, err := uuidStringOrError(input.UserID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.queries.UpdateUserRole(ctx, sqlc.UpdateUserRoleParams{
		ID:   userID,
		Role: sqlc.Roles(input.Role),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, err
	}
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		Role:         domain.Role(user.Role),
	}, err
}

func (repo *AuthRepo) DeleteUser(ctx context.Context, userID string) error {
	id, err := uuidStringOrError(userID)
	if err != nil {
		return err
	}

	count, err := repo.queries.DeleteUser(ctx, id)
	if err != nil {
		return err
	}
	if count == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func uuidPtrOrNull(value *string) (pgtype.UUID, error) {
	if value == nil {
		return pgtype.UUID{}, nil
	}
	var id pgtype.UUID
	if err := id.Scan(*value); err != nil {
		return pgtype.UUID{}, err
	}
	return id, nil
}

func uuidStringOrError(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(value); err != nil {
		return pgtype.UUID{}, domain.ErrInvalidID
	}
	return id, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func textOrNull(value string) pgtype.Text {
	return pgtype.Text{String: value, Valid: value != ""}
}

func textPtrOrNull(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return textOrNull(*value)
}

func stringPtrOrNil(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func interfaceStringPtrOrNil(value any) *string {
	switch v := value.(type) {
	case string:
		return stringPtrOrNil(v)
	case []byte:
		return stringPtrOrNil(string(v))
	default:
		return nil
	}
}

func userFromCreateAdminRow(user sqlc.CreateUserAdminRow) domain.User {
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		GroupID:      interfaceStringPtrOrNil(user.GroupID),
		Role:         domain.Role(user.Role),
		CreatedAt:    timePtr(user.CreatedAt),
		UpdatedAt:    timePtr(user.UpdatedAt),
	}
}

func userFromGetRow(user sqlc.GetUserRow) domain.User {
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		GroupID:      interfaceStringPtrOrNil(user.GroupID),
		Role:         domain.Role(user.Role),
		CreatedAt:    timePtr(user.CreatedAt),
		UpdatedAt:    timePtr(user.UpdatedAt),
	}
}

func userFromListRow(user sqlc.ListUsersRow) domain.User {
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		GroupID:      interfaceStringPtrOrNil(user.GroupID),
		Role:         domain.Role(user.Role),
		CreatedAt:    timePtr(user.CreatedAt),
		UpdatedAt:    timePtr(user.UpdatedAt),
	}
}

func userFromUpdateRow(user sqlc.UpdateUserRow) domain.User {
	return domain.User{
		ID:           user.ID,
		Login:        user.Login,
		PasswordHash: user.Password,
		GroupID:      interfaceStringPtrOrNil(user.GroupID),
		Role:         domain.Role(user.Role),
		CreatedAt:    timePtr(user.CreatedAt),
		UpdatedAt:    timePtr(user.UpdatedAt),
	}
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}
