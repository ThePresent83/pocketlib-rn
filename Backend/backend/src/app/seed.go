package app

import (
	"context"
	"embed"
	"encoding/json"
	"errors"

	"backend/src/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed catalog_seed.json
var catalogSeedFS embed.FS

type catalogSeed struct {
	Specialities        map[string]domain.LocalizedText `json:"specialities"`
	Qualifications      map[string]domain.LocalizedText `json:"qualifications"`
	Groups              []studentGroupSeed              `json:"groups"`
	ScheduleDisciplines []scheduleDisciplineSeed        `json:"scheduleDisciplines"`
}

type studentGroupSeed struct {
	Name              string `json:"name"`
	AdmissionYear     int32  `json:"admissionYear"`
	CourseYear        int32  `json:"courseYear"`
	SpecialityCode    string `json:"specialityCode"`
	QualificationCode string `json:"qualificationCode"`
}

type scheduleDisciplineSeed struct {
	Name domain.LocalizedText `json:"name"`
}

var catalogColors = []string{"#5C6BC0", "#26A69A", "#FF7043", "#7E57C2", "#42A5F5"}
var scheduleColors = []string{"#4DB6AC", "#7986CB", "#FFB74D", "#81C784", "#BA68C8", "#64B5F6"}

func seedCatalog(ctx context.Context, db *pgxpool.Pool) error {
	raw, err := catalogSeedFS.ReadFile("catalog_seed.json")
	if err != nil {
		return err
	}

	var seed catalogSeed
	if err := json.Unmarshal(raw, &seed); err != nil {
		return err
	}

	for i, item := range seed.ScheduleDisciplines {
		if _, err := upsertDiscipline(ctx, db, "", item.Name, scheduleColors[i%len(scheduleColors)]); err != nil {
			return err
		}
	}

	courseIDs := make(map[string]string)
	for i, group := range seed.Groups {
		speciality, ok := seed.Specialities[group.SpecialityCode]
		if !ok {
			continue
		}
		qualification, ok := seed.Qualifications[group.QualificationCode]
		if !ok {
			continue
		}

		disciplineID, err := upsertDiscipline(ctx, db, group.SpecialityCode, speciality, catalogColors[i%len(catalogColors)])
		if err != nil {
			return err
		}

		courseKey := disciplineID + ":" + group.QualificationCode + ":" + intKey(group.CourseYear)
		courseID := courseIDs[courseKey]
		if courseID == "" {
			courseID, err = upsertCourse(ctx, db, disciplineID, group.QualificationCode, qualification, group.CourseYear)
			if err != nil {
				return err
			}
			courseIDs[courseKey] = courseID
		}

		if err := upsertGroup(ctx, db, group.Name, courseID, group.AdmissionYear); err != nil {
			return err
		}
	}

	for _, name := range []string{"Учебник", "Лекция", "Методическое пособие", "Практика"} {
		if err := upsertCategory(ctx, db, name); err != nil {
			return err
		}
	}

	return nil
}

func upsertDiscipline(ctx context.Context, db *pgxpool.Pool, code string, name domain.LocalizedText, color string) (string, error) {
	var id string
	err := db.QueryRow(ctx, `
		SELECT id::TEXT
		FROM disciplines
		WHERE (($1 <> '' AND code = $1) OR name = $2)
		LIMIT 1
	`, code, name.RU).Scan(&id)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	if id == "" {
		err = db.QueryRow(ctx, `
			INSERT INTO disciplines (name, code, name_kk, name_en, color)
			VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), $5)
			RETURNING id::TEXT
		`, name.RU, code, name.KK, name.EN, color).Scan(&id)
		return id, err
	}

	_, err = db.Exec(ctx, `
		UPDATE disciplines
		SET name = $2, code = COALESCE(NULLIF($1, ''), code), name_kk = NULLIF($3, ''), name_en = NULLIF($4, ''), color = $5, updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
	`, code, name.RU, name.KK, name.EN, color, id)
	return id, err
}

func upsertCourse(ctx context.Context, db *pgxpool.Pool, disciplineID string, code string, name domain.LocalizedText, year int32) (string, error) {
	var id string
	err := db.QueryRow(ctx, `
		SELECT id::TEXT
		FROM courses
		WHERE discipline_id = $1 AND year = $2 AND (code = $3 OR name = $4)
		LIMIT 1
	`, disciplineID, year, code, name.RU).Scan(&id)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	if id == "" {
		err = db.QueryRow(ctx, `
			INSERT INTO courses (name, year, discipline_id, code, name_kk, name_en)
			VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''))
			RETURNING id::TEXT
		`, name.RU, year, disciplineID, code, name.KK, name.EN).Scan(&id)
		return id, err
	}

	_, err = db.Exec(ctx, `
		UPDATE courses
		SET name = $2, year = $3, code = NULLIF($4, ''), name_kk = NULLIF($5, ''), name_en = NULLIF($6, ''), updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, id, name.RU, year, code, name.KK, name.EN)
	return id, err
}

func upsertGroup(ctx context.Context, db *pgxpool.Pool, name string, courseID string, admissionYear int32) error {
	_, err := db.Exec(ctx, `
		INSERT INTO groups (name, course_id, admission_year)
		VALUES ($1, $2, $3)
		ON CONFLICT (name) DO UPDATE
		SET course_id = EXCLUDED.course_id, admission_year = EXCLUDED.admission_year, updated_at = CURRENT_TIMESTAMP
	`, name, courseID, admissionYear)
	return err
}

func upsertCategory(ctx context.Context, db *pgxpool.Pool, name string) error {
	_, err := db.Exec(ctx, `
		INSERT INTO categories (name)
		VALUES ($1)
		ON CONFLICT (name) DO NOTHING
	`, name)
	return err
}

func intKey(value int32) string {
	switch value {
	case 1:
		return "1"
	case 2:
		return "2"
	case 3:
		return "3"
	case 4:
		return "4"
	default:
		return "0"
	}
}
