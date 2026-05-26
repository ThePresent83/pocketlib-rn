package repo

import (
	"context"

	"backend/src/sqlc"

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

func (repo *BookRepo) UpsertBookByLegacyID(ctx context.Context, params sqlc.UpsertBookByLegacyIDParams) (sqlc.Book, error) {
	return repo.queries.UpsertBookByLegacyID(ctx, params)
}

func (repo *BookRepo) GetBook(ctx context.Context, id pgtype.UUID) (sqlc.Book, error) {
	return repo.queries.GetBook(ctx, id)
}

func (repo *BookRepo) ListBooks(ctx context.Context, params sqlc.ListBooksParams) ([]sqlc.Book, error) {
	return repo.queries.ListBooks(ctx, params)
}

func (repo *BookRepo) CreateBookFile(ctx context.Context, params sqlc.CreateBookFileParams) (sqlc.BookFile, error) {
	return repo.queries.CreateBookFile(ctx, params)
}

func (repo *BookRepo) GetLatestBookFile(ctx context.Context, bookID pgtype.UUID) (sqlc.BookFile, error) {
	return repo.queries.GetLatestBookFile(ctx, bookID)
}

func (repo *BookRepo) ListBookFiles(ctx context.Context, bookID pgtype.UUID) ([]sqlc.BookFile, error) {
	return repo.queries.ListBookFiles(ctx, bookID)
}
