package servisec

import (
	"context"
	"errors"
	"strings"

	"backend/src/domain"
	"backend/src/repo"
)

var (
	ErrBlankName     = errors.New("name is required")
	ErrInvalidCourse = errors.New("course is invalid")
)

type CatalogRepo interface {
	ListDisciplines(ctx context.Context) ([]domain.Discipline, error)
	CreateDiscipline(ctx context.Context, input repo.DisciplineInput) (domain.Discipline, error)
	DeleteDiscipline(ctx context.Context, id string) error
	ListCourses(ctx context.Context, disciplineID *string) ([]domain.CourseWithDiscipline, error)
	CreateCourse(ctx context.Context, input repo.CourseInput) (domain.Course, error)
	DeleteCourse(ctx context.Context, id string) error
	ListGroups(ctx context.Context, query string, limit int32, offset int32) ([]domain.StudentGroup, error)
	GetGroup(ctx context.Context, id string) (domain.StudentGroup, error)
	CreateGroup(ctx context.Context, input repo.GroupInput) (domain.StudentGroup, error)
	UpdateGroup(ctx context.Context, id string, input repo.GroupInput) (domain.StudentGroup, error)
	DeleteGroup(ctx context.Context, id string) error
	ListCategories(ctx context.Context) ([]domain.Category, error)
	CreateCategory(ctx context.Context, name string) (domain.Category, error)
	DeleteCategory(ctx context.Context, id string) error
}

type GroupInput struct {
	Name          string `json:"name"`
	CourseID      string `json:"course_id"`
	AdmissionYear *int32 `json:"admission_year"`
}

type DisciplineInput struct {
	Name   string  `json:"name"`
	Code   *string `json:"code"`
	NameKK *string `json:"name_kk"`
	NameEN *string `json:"name_en"`
	Color  string  `json:"color"`
}

type CourseInput struct {
	Name         string  `json:"name"`
	Year         int32   `json:"year"`
	DisciplineID string  `json:"discipline_id"`
	Code         *string `json:"code"`
	NameKK       *string `json:"name_kk"`
	NameEN       *string `json:"name_en"`
}

type CategoryInput struct {
	Name string `json:"name"`
}

type ListGroupsFilter struct {
	Query  string
	Limit  int32
	Offset int32
}

type GroupService struct {
	repo CatalogRepo
}

func NewGroupService(repo CatalogRepo) *GroupService {
	return &GroupService{repo: repo}
}

func (service *GroupService) ListDisciplines(ctx context.Context) ([]domain.Discipline, error) {
	return service.repo.ListDisciplines(ctx)
}

func (service *GroupService) CreateDiscipline(ctx context.Context, input DisciplineInput) (domain.Discipline, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return domain.Discipline{}, ErrBlankName
	}
	return service.repo.CreateDiscipline(ctx, repo.DisciplineInput{
		Name:   name,
		Code:   trimPtr(input.Code),
		NameKK: trimPtr(input.NameKK),
		NameEN: trimPtr(input.NameEN),
		Color:  input.Color,
	})
}

func (service *GroupService) DeleteDiscipline(ctx context.Context, id string) error {
	return service.repo.DeleteDiscipline(ctx, strings.TrimSpace(id))
}

func (service *GroupService) ListCourses(ctx context.Context, disciplineID *string) ([]domain.CourseWithDiscipline, error) {
	return service.repo.ListCourses(ctx, trimPtr(disciplineID))
}

func (service *GroupService) CreateCourse(ctx context.Context, input CourseInput) (domain.Course, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return domain.Course{}, ErrBlankName
	}
	if strings.TrimSpace(input.DisciplineID) == "" || input.Year <= 0 {
		return domain.Course{}, ErrInvalidCourse
	}
	return service.repo.CreateCourse(ctx, repo.CourseInput{
		Name:         name,
		Year:         input.Year,
		DisciplineID: strings.TrimSpace(input.DisciplineID),
		Code:         trimPtr(input.Code),
		NameKK:       trimPtr(input.NameKK),
		NameEN:       trimPtr(input.NameEN),
	})
}

func (service *GroupService) DeleteCourse(ctx context.Context, id string) error {
	return service.repo.DeleteCourse(ctx, strings.TrimSpace(id))
}

func (service *GroupService) CreateGroup(ctx context.Context, input GroupInput) (domain.StudentGroup, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return domain.StudentGroup{}, ErrBlankName
	}
	if strings.TrimSpace(input.CourseID) == "" {
		return domain.StudentGroup{}, ErrInvalidCourse
	}
	return service.repo.CreateGroup(ctx, repo.GroupInput{
		Name:          name,
		CourseID:      strings.TrimSpace(input.CourseID),
		AdmissionYear: input.AdmissionYear,
	})
}

func (service *GroupService) UpdateGroup(ctx context.Context, id string, input GroupInput) (domain.StudentGroup, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return domain.StudentGroup{}, ErrBlankName
	}
	if strings.TrimSpace(input.CourseID) == "" {
		return domain.StudentGroup{}, ErrInvalidCourse
	}
	return service.repo.UpdateGroup(ctx, strings.TrimSpace(id), repo.GroupInput{
		Name:          name,
		CourseID:      strings.TrimSpace(input.CourseID),
		AdmissionYear: input.AdmissionYear,
	})
}

func (service *GroupService) ListGroups(ctx context.Context, filter ListGroupsFilter) ([]domain.StudentGroup, error) {
	if filter.Limit <= 0 || filter.Limit > 500 {
		filter.Limit = 200
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	return service.repo.ListGroups(ctx, filter.Query, filter.Limit, filter.Offset)
}

func (service *GroupService) GetGroup(ctx context.Context, id string) (domain.StudentGroup, error) {
	return service.repo.GetGroup(ctx, strings.TrimSpace(id))
}

func (service *GroupService) DeleteGroup(ctx context.Context, id string) error {
	return service.repo.DeleteGroup(ctx, strings.TrimSpace(id))
}

func (service *GroupService) ListCategories(ctx context.Context) ([]domain.Category, error) {
	return service.repo.ListCategories(ctx)
}

func (service *GroupService) CreateCategory(ctx context.Context, input CategoryInput) (domain.Category, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return domain.Category{}, ErrBlankName
	}
	return service.repo.CreateCategory(ctx, name)
}

func (service *GroupService) DeleteCategory(ctx context.Context, id string) error {
	return service.repo.DeleteCategory(ctx, strings.TrimSpace(id))
}

func trimPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

