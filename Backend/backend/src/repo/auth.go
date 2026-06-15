package repo

import (
	"context"
	"errors"
	"strings"
	"time"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type AuthRepo struct {
	db sqlc.DBTX
}

func NewAuthRepo(db sqlc.DBTX) *AuthRepo {
	return &AuthRepo{db: db}
}

func (repo *AuthRepo) CreateUser(ctx context.Context, input domain.CreateUserInput) (domain.User, error) {
	groupID, err := uuidPtrOrNull(input.GroupID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.scanUser(repo.db.QueryRow(ctx, `
		INSERT INTO users (login, email, full_name, password, group_id, role)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::TEXT, login, email, full_name, password, COALESCE(group_id::TEXT, ''), NULL::TEXT, role, created_at, updated_at
	`, input.Login, input.Email, input.FullName, input.PasswordHash, groupID, string(input.Role)))
	if isUniqueViolation(err) {
		return domain.User{}, domain.ErrLoginCollision
	}
	return user, err
}

func (repo *AuthRepo) CreateUserAdmin(ctx context.Context, input domain.CreateUserAdminInput) (domain.User, error) {
	return repo.CreateUser(ctx, domain.CreateUserInput{
		Login:        input.Login,
		Email:        input.Email,
		FullName:     input.FullName,
		PasswordHash: input.PasswordHash,
		GroupID:      input.GroupID,
		Role:         input.Role,
	})
}

func (repo *AuthRepo) GetUser(ctx context.Context, userID string) (domain.User, error) {
	id, err := uuidStringOrError(userID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.scanUser(repo.db.QueryRow(ctx, userSelectSQL()+` WHERE u.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	return user, err
}

func (repo *AuthRepo) GetUserByLogin(ctx context.Context, login string) (domain.User, error) {
	login = strings.TrimSpace(login)
	user, err := repo.scanUser(repo.db.QueryRow(ctx, userSelectSQL()+`
		WHERE lower(u.login) = lower($1) OR lower(u.email) = lower($1)
	`, login))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, err
	}
	return user, err
}

func (repo *AuthRepo) ListUsers(ctx context.Context, filter domain.ListUsersFilter) ([]domain.User, error) {
	query := strings.TrimSpace(filter.Query)
	rows, err := repo.db.Query(ctx, userSelectSQL()+`
		WHERE (
			$1 = '' OR
			u.login ILIKE '%' || $1 || '%' OR
			u.email ILIKE '%' || $1 || '%' OR
			u.full_name ILIKE '%' || $1 || '%' OR
			g.name ILIKE '%' || $1 || '%'
		)
		ORDER BY u.created_at DESC, u.id DESC
		LIMIT $2 OFFSET $3
	`, query, filter.Limit, filter.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		user, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
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

	user, err := repo.scanUser(repo.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE users
			SET
				login = $2,
				email = $3,
				full_name = $4,
				password = COALESCE($5::TEXT, password),
				group_id = $6,
				role = $7,
				updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING *
		)
		SELECT updated.id::TEXT, updated.login, updated.email, updated.full_name, updated.password,
			COALESCE(updated.group_id::TEXT, ''), g.name, updated.role, updated.created_at, updated.updated_at
		FROM updated
		LEFT JOIN groups g ON g.id = updated.group_id
	`, userID, input.Login, input.Email, input.FullName, input.PasswordHash, groupID, string(input.Role)))
	if isUniqueViolation(err) {
		return domain.User{}, domain.ErrLoginCollision
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	return user, err
}

func (repo *AuthRepo) UpdateUserRole(ctx context.Context, input domain.UpdateUserRoleInput) (domain.User, error) {
	userID, err := uuidStringOrError(input.UserID)
	if err != nil {
		return domain.User{}, err
	}

	user, err := repo.scanUser(repo.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE users
			SET role = $2, updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING *
		)
		SELECT updated.id::TEXT, updated.login, updated.email, updated.full_name, updated.password,
			COALESCE(updated.group_id::TEXT, ''), g.name, updated.role, updated.created_at, updated.updated_at
		FROM updated
		LEFT JOIN groups g ON g.id = updated.group_id
	`, userID, string(input.Role)))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrNotFound
	}
	return user, err
}

func (repo *AuthRepo) DeleteUser(ctx context.Context, userID string) error {
	id, err := uuidStringOrError(userID)
	if err != nil {
		return err
	}

	tag, err := repo.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (repo *AuthRepo) scanUser(row pgx.Row) (domain.User, error) {
	return scanUserRow(row)
}

func userSelectSQL() string {
	return `
		SELECT u.id::TEXT, u.login, u.email, u.full_name, u.password,
			COALESCE(u.group_id::TEXT, ''), g.name, u.role, u.created_at, u.updated_at
		FROM users u
		LEFT JOIN groups g ON g.id = u.group_id
	`
}

type userScanner interface {
	Scan(dest ...any) error
}

func scanUserRow(row userScanner) (domain.User, error) {
	var (
		user      domain.User
		groupID   string
		groupName pgtype.Text
		role      string
		createdAt pgtype.Timestamptz
		updatedAt pgtype.Timestamptz
	)
	if err := row.Scan(
		&user.ID,
		&user.Login,
		&user.Email,
		&user.FullName,
		&user.PasswordHash,
		&groupID,
		&groupName,
		&role,
		&createdAt,
		&updatedAt,
	); err != nil {
		return domain.User{}, err
	}

	user.GroupID = stringPtrOrNil(groupID)
	user.GroupName = pgTextPtr(groupName)
	user.Role = domain.Role(role)
	user.CreatedAt = timePtr(createdAt)
	user.UpdatedAt = timePtr(updatedAt)
	return user, nil
}

func uuidPtrOrNull(value *string) (pgtype.UUID, error) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return pgtype.UUID{}, nil
	}
	var id pgtype.UUID
	if err := id.Scan(strings.TrimSpace(*value)); err != nil {
		return pgtype.UUID{}, domain.ErrInvalidID
	}
	return id, nil
}

func uuidStringOrError(value string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(strings.TrimSpace(value)); err != nil {
		return pgtype.UUID{}, domain.ErrInvalidID
	}
	return id, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
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

func int32PtrOrNull(value *int32) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *value, Valid: true}
}

func int64PtrOrNull(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *value, Valid: true}
}

func stringPtrOrNil(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func pgTextPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func pgInt4Ptr(value pgtype.Int4) *int32 {
	if !value.Valid {
		return nil
	}
	return &value.Int32
}

func pgInt8Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

