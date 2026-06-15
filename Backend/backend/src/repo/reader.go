package repo

import (
	"context"
	"encoding/json"
	"errors"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type ReaderRepo struct {
	db sqlc.DBTX
}

type ReaderStateUpsert struct {
	UserID     string
	BookID     string
	Page       int32
	TotalPages int32
	FontSize   int32
	Bookmarks  []int32
	Appearance domain.ReaderAppearance
}

func NewReaderRepo(db sqlc.DBTX) *ReaderRepo {
	return &ReaderRepo{db: db}
}

func (repo *ReaderRepo) GetReaderState(ctx context.Context, userID string, bookID string) (domain.ReaderState, error) {
	parsedUserID, parsedBookID, err := parseReaderIDs(userID, bookID)
	if err != nil {
		return domain.ReaderState{}, err
	}

	state, err := scanReaderState(repo.db.QueryRow(ctx, `
		SELECT
			user_id::TEXT,
			book_id::TEXT,
			page,
			total_pages,
			font_size,
			bookmarks,
			appearance,
			updated_at
		FROM reading_history
		WHERE user_id = $1 AND book_id = $2
	`, parsedUserID, parsedBookID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ReaderState{}, domain.ErrNotFound
	}
	return state, err
}

func (repo *ReaderRepo) UpsertReaderState(ctx context.Context, input ReaderStateUpsert) (domain.ReaderState, error) {
	parsedUserID, parsedBookID, err := parseReaderIDs(input.UserID, input.BookID)
	if err != nil {
		return domain.ReaderState{}, err
	}

	bookmarksJSON, err := json.Marshal(input.Bookmarks)
	if err != nil {
		return domain.ReaderState{}, err
	}
	appearanceJSON, err := json.Marshal(input.Appearance)
	if err != nil {
		return domain.ReaderState{}, err
	}

	return scanReaderState(repo.db.QueryRow(ctx, `
		INSERT INTO reading_history (
			user_id,
			book_id,
			progress,
			page,
			total_pages,
			font_size,
			bookmarks,
			appearance,
			last_opened
		) VALUES (
			$1,
			$2,
			CASE WHEN $4 > 0 THEN LEAST(100, GREATEST(0, ROUND(($3::NUMERIC + 1) * 100 / $4)::INTEGER)) ELSE 0 END,
			$3,
			$4,
			$5,
			$6::jsonb,
			$7::jsonb,
			CURRENT_TIMESTAMP
		)
		ON CONFLICT (user_id, book_id) DO UPDATE
		SET
			progress = EXCLUDED.progress,
			page = EXCLUDED.page,
			total_pages = EXCLUDED.total_pages,
			font_size = EXCLUDED.font_size,
			bookmarks = EXCLUDED.bookmarks,
			appearance = EXCLUDED.appearance,
			last_opened = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		RETURNING
			user_id::TEXT,
			book_id::TEXT,
			page,
			total_pages,
			font_size,
			bookmarks,
			appearance,
			updated_at
	`, parsedUserID, parsedBookID, input.Page, input.TotalPages, input.FontSize, string(bookmarksJSON), string(appearanceJSON)))
}

func parseReaderIDs(userID string, bookID string) (pgtype.UUID, pgtype.UUID, error) {
	parsedUserID, err := uuidStringOrError(userID)
	if err != nil {
		return pgtype.UUID{}, pgtype.UUID{}, err
	}
	parsedBookID, err := uuidStringOrError(bookID)
	if err != nil {
		return pgtype.UUID{}, pgtype.UUID{}, err
	}
	return parsedUserID, parsedBookID, nil
}

func scanReaderState(row pgx.Row) (domain.ReaderState, error) {
	var (
		state          domain.ReaderState
		bookmarksJSON  []byte
		appearanceJSON []byte
		updatedAt      pgtype.Timestamptz
	)

	if err := row.Scan(
		&state.UserID,
		&state.BookID,
		&state.Page,
		&state.TotalPages,
		&state.FontSize,
		&bookmarksJSON,
		&appearanceJSON,
		&updatedAt,
	); err != nil {
		return domain.ReaderState{}, err
	}

	if len(bookmarksJSON) > 0 {
		_ = json.Unmarshal(bookmarksJSON, &state.Bookmarks)
	}
	if len(appearanceJSON) > 0 {
		_ = json.Unmarshal(appearanceJSON, &state.Appearance)
	}
	state.UpdatedAt = timePtr(updatedAt)
	return state, nil
}
