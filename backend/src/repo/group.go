package repo

import (
	"context"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5/pgtype"
)

type GroupRepo struct {
	queries *sqlc.Queries
}

func NewGroupRepo(queries *sqlc.Queries) *GroupRepo {
	return &GroupRepo{queries: queries}
}

func (repo *GroupRepo) CreateGroup(ctx context.Context, params sqlc.CreateGroupParams) (sqlc.Group, error) {
	group, err := repo.queries.CreateGroup(ctx, params)
	if isUniqueViolation(err) {
		return sqlc.Group{}, domain.ErrCollision
	}
	return group, err
}

func (repo *GroupRepo) GetGroup(ctx context.Context, id pgtype.UUID) (sqlc.Group, error) {
	return repo.queries.GetGroup(ctx, id)
}

func (repo *GroupRepo) ListGroups(ctx context.Context, params sqlc.ListGroupsParams) ([]sqlc.Group, error) {
	return repo.queries.ListGroups(ctx, params)
}

func (repo *GroupRepo) UpdateGroup(ctx context.Context, params sqlc.UpdateGroupParams) (sqlc.Group, error) {
	group, err := repo.queries.UpdateGroup(ctx, params)
	if isUniqueViolation(err) {
		return sqlc.Group{}, domain.ErrCollision
	}
	return group, err
}

func (repo *GroupRepo) DeleteGroup(ctx context.Context, id pgtype.UUID) error {
	count, err := repo.queries.DeleteGroup(ctx, id)
	if err != nil {
		return err
	}
	if count == 0 {
		return domain.ErrNotFound
	}
	return nil
}
