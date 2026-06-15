package repo

import (
	"context"
	"errors"
	"strings"

	"backend/src/domain"
	sqlc "backend/src/sqlc/generated"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type GroupRepo struct {
	db sqlc.DBTX
}

type DisciplineInput struct {
	Name   string
	Code   *string
	NameKK *string
	NameEN *string
	Color  string
}

type CourseInput struct {
	Name         string
	Year         int32
	DisciplineID string
	Code         *string
	NameKK       *string
	NameEN       *string
}

type GroupInput struct {
	Name          string
	CourseID      string
	AdmissionYear *int32
}

func NewGroupRepo(db sqlc.DBTX) *GroupRepo {
	return &GroupRepo{db: db}
}

func (repo *GroupRepo) ListDisciplines(ctx context.Context) ([]domain.Discipline, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT id::TEXT, name, code, name_kk, name_en, color, created_at, updated_at
		FROM disciplines
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.Discipline, 0)
	for rows.Next() {
		item, err := scanDiscipline(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (repo *GroupRepo) CreateDiscipline(ctx context.Context, input DisciplineInput) (domain.Discipline, error) {
	color := strings.TrimSpace(input.Color)
	if color == "" {
		color = "#5C6BC0"
	}
	item, err := scanDiscipline(repo.db.QueryRow(ctx, `
		INSERT INTO disciplines (name, code, name_kk, name_en, color)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (name) DO UPDATE
		SET code = EXCLUDED.code, name_kk = EXCLUDED.name_kk, name_en = EXCLUDED.name_en, color = EXCLUDED.color, updated_at = CURRENT_TIMESTAMP
		RETURNING id::TEXT, name, code, name_kk, name_en, color, created_at, updated_at
	`, input.Name, textPtrOrNull(input.Code), textPtrOrNull(input.NameKK), textPtrOrNull(input.NameEN), color))
	if isUniqueViolation(err) {
		return domain.Discipline{}, domain.ErrCollision
	}
	return item, err
}

func (repo *GroupRepo) DeleteDiscipline(ctx context.Context, id string) error {
	return repo.deleteByID(ctx, "disciplines", id)
}

func (repo *GroupRepo) ListCourses(ctx context.Context, disciplineID *string) ([]domain.CourseWithDiscipline, error) {
	parsedDisciplineID, err := uuidPtrOrNull(disciplineID)
	if err != nil {
		return nil, err
	}

	rows, err := repo.db.Query(ctx, `
		SELECT
			c.id::TEXT, c.name, c.year, c.discipline_id::TEXT, c.code, c.name_kk, c.name_en, c.created_at, c.updated_at,
			d.name, d.code, d.name_kk, d.name_en, d.color
		FROM courses c
		LEFT JOIN disciplines d ON d.id = c.discipline_id
		WHERE ($1::UUID IS NULL OR c.discipline_id = $1)
		ORDER BY d.name, c.year, c.name
	`, parsedDisciplineID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.CourseWithDiscipline, 0)
	for rows.Next() {
		item, err := scanCourseWithDiscipline(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (repo *GroupRepo) CreateCourse(ctx context.Context, input CourseInput) (domain.Course, error) {
	disciplineID, err := uuidStringOrError(input.DisciplineID)
	if err != nil {
		return domain.Course{}, err
	}
	item, err := scanCourse(repo.db.QueryRow(ctx, `
		INSERT INTO courses (name, year, discipline_id, code, name_kk, name_en)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (discipline_id, year, name) DO UPDATE
		SET code = EXCLUDED.code, name_kk = EXCLUDED.name_kk, name_en = EXCLUDED.name_en, updated_at = CURRENT_TIMESTAMP
		RETURNING id::TEXT, name, year, discipline_id::TEXT, code, name_kk, name_en, created_at, updated_at
	`, input.Name, input.Year, disciplineID, textPtrOrNull(input.Code), textPtrOrNull(input.NameKK), textPtrOrNull(input.NameEN)))
	if isUniqueViolation(err) {
		return domain.Course{}, domain.ErrCollision
	}
	return item, err
}

func (repo *GroupRepo) DeleteCourse(ctx context.Context, id string) error {
	return repo.deleteByID(ctx, "courses", id)
}

func (repo *GroupRepo) ListGroups(ctx context.Context, query string, limit int32, offset int32) ([]domain.StudentGroup, error) {
	rows, err := repo.db.Query(ctx, `
		SELECT
			g.id::TEXT, g.name, COALESCE(g.course_id::TEXT, ''), g.admission_year, g.created_at, g.updated_at,
			c.code, c.name, c.name_kk, c.name_en, c.year, COALESCE(c.discipline_id::TEXT, ''),
			d.code, d.name, d.name_kk, d.name_en, d.color
		FROM groups g
		LEFT JOIN courses c ON c.id = g.course_id
		LEFT JOIN disciplines d ON d.id = c.discipline_id
		WHERE ($1 = '' OR g.name ILIKE '%' || $1 || '%' OR c.name ILIKE '%' || $1 || '%' OR d.name ILIKE '%' || $1 || '%')
		ORDER BY g.name
		LIMIT $2 OFFSET $3
	`, strings.TrimSpace(query), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.StudentGroup, 0)
	for rows.Next() {
		item, err := scanStudentGroup(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (repo *GroupRepo) GetGroup(ctx context.Context, id string) (domain.StudentGroup, error) {
	groupID, err := uuidStringOrError(id)
	if err != nil {
		return domain.StudentGroup{}, err
	}
	item, err := scanStudentGroup(repo.db.QueryRow(ctx, `
		SELECT
			g.id::TEXT, g.name, COALESCE(g.course_id::TEXT, ''), g.admission_year, g.created_at, g.updated_at,
			c.code, c.name, c.name_kk, c.name_en, c.year, COALESCE(c.discipline_id::TEXT, ''),
			d.code, d.name, d.name_kk, d.name_en, d.color
		FROM groups g
		LEFT JOIN courses c ON c.id = g.course_id
		LEFT JOIN disciplines d ON d.id = c.discipline_id
		WHERE g.id = $1
	`, groupID))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.StudentGroup{}, domain.ErrNotFound
	}
	return item, err
}

func (repo *GroupRepo) CreateGroup(ctx context.Context, input GroupInput) (domain.StudentGroup, error) {
	courseID, err := uuidStringOrError(input.CourseID)
	if err != nil {
		return domain.StudentGroup{}, err
	}
	groupID, err := scanStudentGroup(repo.db.QueryRow(ctx, `
		WITH upserted AS (
			INSERT INTO groups (name, course_id, admission_year)
			VALUES ($1, $2, $3)
			ON CONFLICT (name) DO UPDATE
			SET course_id = EXCLUDED.course_id, admission_year = EXCLUDED.admission_year, updated_at = CURRENT_TIMESTAMP
			RETURNING *
		)
		SELECT
			upserted.id::TEXT, upserted.name, COALESCE(upserted.course_id::TEXT, ''), upserted.admission_year, upserted.created_at, upserted.updated_at,
			c.code, c.name, c.name_kk, c.name_en, c.year, COALESCE(c.discipline_id::TEXT, ''),
			d.code, d.name, d.name_kk, d.name_en, d.color
		FROM upserted
		LEFT JOIN courses c ON c.id = upserted.course_id
		LEFT JOIN disciplines d ON d.id = c.discipline_id
	`, input.Name, courseID, int32PtrOrNull(input.AdmissionYear)))
	if isUniqueViolation(err) {
		return domain.StudentGroup{}, domain.ErrCollision
	}
	return groupID, err
}

func (repo *GroupRepo) UpdateGroup(ctx context.Context, id string, input GroupInput) (domain.StudentGroup, error) {
	groupID, err := uuidStringOrError(id)
	if err != nil {
		return domain.StudentGroup{}, err
	}
	courseID, err := uuidStringOrError(input.CourseID)
	if err != nil {
		return domain.StudentGroup{}, err
	}
	item, err := scanStudentGroup(repo.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE groups
			SET name = $2, course_id = $3, admission_year = $4, updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING *
		)
		SELECT
			updated.id::TEXT, updated.name, COALESCE(updated.course_id::TEXT, ''), updated.admission_year, updated.created_at, updated.updated_at,
			c.code, c.name, c.name_kk, c.name_en, c.year, COALESCE(c.discipline_id::TEXT, ''),
			d.code, d.name, d.name_kk, d.name_en, d.color
		FROM updated
		LEFT JOIN courses c ON c.id = updated.course_id
		LEFT JOIN disciplines d ON d.id = c.discipline_id
	`, groupID, input.Name, courseID, int32PtrOrNull(input.AdmissionYear)))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.StudentGroup{}, domain.ErrNotFound
	}
	if isUniqueViolation(err) {
		return domain.StudentGroup{}, domain.ErrCollision
	}
	return item, err
}

func (repo *GroupRepo) DeleteGroup(ctx context.Context, id string) error {
	return repo.deleteByID(ctx, "groups", id)
}

func (repo *GroupRepo) ListCategories(ctx context.Context) ([]domain.Category, error) {
	rows, err := repo.db.Query(ctx, `SELECT id::TEXT, name, created_at, updated_at FROM categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.Category, 0)
	for rows.Next() {
		item, err := scanCategory(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (repo *GroupRepo) CreateCategory(ctx context.Context, name string) (domain.Category, error) {
	item, err := scanCategory(repo.db.QueryRow(ctx, `
		INSERT INTO categories (name)
		VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
		RETURNING id::TEXT, name, created_at, updated_at
	`, strings.TrimSpace(name)))
	if isUniqueViolation(err) {
		return domain.Category{}, domain.ErrCollision
	}
	return item, err
}

func (repo *GroupRepo) DeleteCategory(ctx context.Context, id string) error {
	return repo.deleteByID(ctx, "categories", id)
}

func (repo *GroupRepo) deleteByID(ctx context.Context, table string, id string) error {
	parsedID, err := uuidStringOrError(id)
	if err != nil {
		return err
	}
	tag, err := repo.db.Exec(ctx, `DELETE FROM `+table+` WHERE id = $1`, parsedID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

type catalogScanner interface {
	Scan(dest ...any) error
}

func scanDiscipline(row catalogScanner) (domain.Discipline, error) {
	var item domain.Discipline
	var code, nameKK, nameEN pgtype.Text
	var createdAt, updatedAt pgtype.Timestamptz
	if err := row.Scan(&item.ID, &item.Name, &code, &nameKK, &nameEN, &item.Color, &createdAt, &updatedAt); err != nil {
		return domain.Discipline{}, err
	}
	item.Code = pgTextPtr(code)
	item.NameKK = pgTextPtr(nameKK)
	item.NameEN = pgTextPtr(nameEN)
	item.CreatedAt = timePtr(createdAt)
	item.UpdatedAt = timePtr(updatedAt)
	return item, nil
}

func scanCourse(row catalogScanner) (domain.Course, error) {
	var item domain.Course
	var code, nameKK, nameEN pgtype.Text
	var createdAt, updatedAt pgtype.Timestamptz
	if err := row.Scan(&item.ID, &item.Name, &item.Year, &item.DisciplineID, &code, &nameKK, &nameEN, &createdAt, &updatedAt); err != nil {
		return domain.Course{}, err
	}
	item.Code = pgTextPtr(code)
	item.NameKK = pgTextPtr(nameKK)
	item.NameEN = pgTextPtr(nameEN)
	item.CreatedAt = timePtr(createdAt)
	item.UpdatedAt = timePtr(updatedAt)
	return item, nil
}

func scanCourseWithDiscipline(row catalogScanner) (domain.CourseWithDiscipline, error) {
	var item domain.CourseWithDiscipline
	var code, nameKK, nameEN pgtype.Text
	var disciplineName, disciplineCode, disciplineNameKK, disciplineNameEN, disciplineColor pgtype.Text
	var createdAt, updatedAt pgtype.Timestamptz
	if err := row.Scan(
		&item.ID,
		&item.Name,
		&item.Year,
		&item.DisciplineID,
		&code,
		&nameKK,
		&nameEN,
		&createdAt,
		&updatedAt,
		&disciplineName,
		&disciplineCode,
		&disciplineNameKK,
		&disciplineNameEN,
		&disciplineColor,
	); err != nil {
		return domain.CourseWithDiscipline{}, err
	}
	item.Code = pgTextPtr(code)
	item.NameKK = pgTextPtr(nameKK)
	item.NameEN = pgTextPtr(nameEN)
	item.CreatedAt = timePtr(createdAt)
	item.UpdatedAt = timePtr(updatedAt)
	item.DisciplineName = pgTextPtr(disciplineName)
	item.DisciplineCode = pgTextPtr(disciplineCode)
	item.DisciplineNameKK = pgTextPtr(disciplineNameKK)
	item.DisciplineNameEN = pgTextPtr(disciplineNameEN)
	item.DisciplineColor = pgTextPtr(disciplineColor)
	return item, nil
}

func scanStudentGroup(row catalogScanner) (domain.StudentGroup, error) {
	var item domain.StudentGroup
	var admissionYear, courseYear pgtype.Int4
	var createdAt, updatedAt pgtype.Timestamptz
	var courseCode, courseName, courseNameKK, courseNameEN pgtype.Text
	var disciplineID string
	var disciplineCode, disciplineName, disciplineNameKK, disciplineNameEN, disciplineColor pgtype.Text
	if err := row.Scan(
		&item.ID,
		&item.Name,
		&item.CourseID,
		&admissionYear,
		&createdAt,
		&updatedAt,
		&courseCode,
		&courseName,
		&courseNameKK,
		&courseNameEN,
		&courseYear,
		&disciplineID,
		&disciplineCode,
		&disciplineName,
		&disciplineNameKK,
		&disciplineNameEN,
		&disciplineColor,
	); err != nil {
		return domain.StudentGroup{}, err
	}
	item.AdmissionYear = pgInt4Ptr(admissionYear)
	item.CreatedAt = timePtr(createdAt)
	item.UpdatedAt = timePtr(updatedAt)
	item.CourseCode = pgTextPtr(courseCode)
	item.CourseName = pgTextPtr(courseName)
	item.CourseNameKK = pgTextPtr(courseNameKK)
	item.CourseNameEN = pgTextPtr(courseNameEN)
	item.CourseYear = pgInt4Ptr(courseYear)
	item.DisciplineID = stringPtrOrNil(disciplineID)
	item.DisciplineCode = pgTextPtr(disciplineCode)
	item.DisciplineName = pgTextPtr(disciplineName)
	item.DisciplineNameKK = pgTextPtr(disciplineNameKK)
	item.DisciplineNameEN = pgTextPtr(disciplineNameEN)
	item.DisciplineColor = pgTextPtr(disciplineColor)
	return item, nil
}

func scanCategory(row catalogScanner) (domain.Category, error) {
	var item domain.Category
	var createdAt, updatedAt pgtype.Timestamptz
	if err := row.Scan(&item.ID, &item.Name, &createdAt, &updatedAt); err != nil {
		return domain.Category{}, err
	}
	item.CreatedAt = timePtr(createdAt)
	item.UpdatedAt = timePtr(updatedAt)
	return item, nil
}

