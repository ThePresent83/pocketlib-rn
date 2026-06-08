package repo

import (
	"context"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5/pgtype"
)

type BookRepo struct {
	queries *sqlc.Queries
}

func NewBookRepo(queries *sqlc.Queries) *BookRepo {
	return &BookRepo{queries: queries}
}

func (repo *BookRepo) CreateBook(ctx context.Context, params sqlc.CreateBookParams) (sqlc.Book, error) {
	return repo.queries.CreateBook(ctx, params)
}

func (repo *BookRepo) UpdateBook(ctx context.Context, params sqlc.UpdateBookParams) (sqlc.Book, error) {
	return repo.queries.UpdateBook(ctx, params)
}

func (repo *BookRepo) GetBook(ctx context.Context, id pgtype.UUID) (sqlc.Book, error) {
	return repo.queries.GetBook(ctx, id)
}

func (repo *BookRepo) UpdateBookContentFile(ctx context.Context, params sqlc.UpdateBookContentFileParams) (sqlc.Book, error) {
	return repo.queries.UpdateBookContentFile(ctx, params)
}

func (repo *BookRepo) ListBooks(ctx context.Context, params sqlc.ListBooksParams) ([]sqlc.Book, error) {
	return repo.queries.ListBooks(ctx, params)
}

func (repo *BookRepo) DeleteBook(ctx context.Context, id pgtype.UUID) error {
	count, err := repo.queries.DeleteBook(ctx, id)
	if err != nil {
		return err
	}
	if count == 0 {
		return domain.ErrNotFound
	}
	return nil
}
