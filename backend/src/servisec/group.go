package servisec

import (
	"context"
	"errors"
	"strings"

	"backend/src/domain"
	"backend/src/repo"
	sqlc "backend/src/sqlc/generated"
)

type GroupService struct {
	repo *repo.GroupRepo
}

var ErrInvalidCourse = errors.New("invalid course")

type GroupInput struct {
	Name   string `json:"name"`
	Course string `json:"course"`
}

type ListGroupsFilter struct {
	Query  string
	Limit  int32
	Offset int32
}

func NewGroupService(repo *repo.GroupRepo) *GroupService {
	return &GroupService{repo: repo}
}

func (service *GroupService) CreateGroup(ctx context.Context, input GroupInput) (sqlc.Group, error) {
	params, err := createGroupParams(input)
	if err != nil {
		return sqlc.Group{}, err
	}
	return service.repo.CreateGroup(ctx, params)
}

func (service *GroupService) GetGroup(ctx context.Context, id string) (sqlc.Group, error) {
	groupID, err := parseUUID(id)
	if err != nil {
		return sqlc.Group{}, domain.ErrInvalidID
	}
	return service.repo.GetGroup(ctx, groupID)
}

func (service *GroupService) ListGroups(ctx context.Context, filter ListGroupsFilter) ([]sqlc.Group, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 50
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	return service.repo.ListGroups(ctx, sqlc.ListGroupsParams{
		Query:  textOrNull(filter.Query),
		Limit:  filter.Limit,
		Offset: filter.Offset,
	})
}

func (service *GroupService) UpdateGroup(ctx context.Context, id string, input GroupInput) (sqlc.Group, error) {
	groupID, err := parseUUID(id)
	if err != nil {
		return sqlc.Group{}, domain.ErrInvalidID
	}

	params, err := createGroupParams(input)
	if err != nil {
		return sqlc.Group{}, err
	}
	return service.repo.UpdateGroup(ctx, sqlc.UpdateGroupParams{
		ID:     groupID,
		Name:   params.Name,
		Course: params.Course,
	})
}

func (service *GroupService) DeleteGroup(ctx context.Context, id string) error {
	groupID, err := parseUUID(id)
	if err != nil {
		return domain.ErrInvalidID
	}
	return service.repo.DeleteGroup(ctx, groupID)
}

func createGroupParams(input GroupInput) (sqlc.CreateGroupParams, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "Без названия"
	}

	course, err := parseCourse(input.Course)
	if err != nil {
		return sqlc.CreateGroupParams{}, err
	}

	return sqlc.CreateGroupParams{
		Name:   name,
		Course: course,
	}, nil
}

func parseCourse(value string) (sqlc.Courses, error) {
	switch sqlc.Courses(strings.ToUpper(strings.TrimSpace(value))) {
	case "", sqlc.CoursesFIRST:
		return sqlc.CoursesFIRST, nil
	case sqlc.CoursesSECOND:
		return sqlc.CoursesSECOND, nil
	case sqlc.CoursesTHIRD:
		return sqlc.CoursesTHIRD, nil
	case sqlc.CoursesFOURTH:
		return sqlc.CoursesFOURTH, nil
	default:
		return "", ErrInvalidCourse
	}
}
