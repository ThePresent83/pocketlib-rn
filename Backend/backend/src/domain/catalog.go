package domain

import "time"

type LocalizedText struct {
	RU string `json:"ru"`
	KK string `json:"kk"`
	EN string `json:"en"`
}

type Discipline struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Code      *string    `json:"code,omitempty"`
	NameKK    *string    `json:"name_kk,omitempty"`
	NameEN    *string    `json:"name_en,omitempty"`
	Color     string     `json:"color"`
	CreatedAt *time.Time `json:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

type Course struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Year         int32      `json:"year"`
	DisciplineID string     `json:"discipline_id"`
	Code         *string    `json:"code,omitempty"`
	NameKK       *string    `json:"name_kk,omitempty"`
	NameEN       *string    `json:"name_en,omitempty"`
	CreatedAt    *time.Time `json:"created_at,omitempty"`
	UpdatedAt    *time.Time `json:"updated_at,omitempty"`
}

type CourseWithDiscipline struct {
	Course
	DisciplineName  *string `json:"discipline_name,omitempty"`
	DisciplineCode  *string `json:"discipline_code,omitempty"`
	DisciplineNameKK *string `json:"discipline_name_kk,omitempty"`
	DisciplineNameEN *string `json:"discipline_name_en,omitempty"`
	DisciplineColor  *string `json:"discipline_color,omitempty"`
}

type StudentGroup struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	CourseID         string     `json:"course_id"`
	AdmissionYear    *int32     `json:"admission_year,omitempty"`
	CourseCode       *string    `json:"course_code,omitempty"`
	CourseName       *string    `json:"course_name,omitempty"`
	CourseNameKK     *string    `json:"course_name_kk,omitempty"`
	CourseNameEN     *string    `json:"course_name_en,omitempty"`
	CourseYear       *int32     `json:"course_year,omitempty"`
	DisciplineID     *string    `json:"discipline_id,omitempty"`
	DisciplineCode   *string    `json:"discipline_code,omitempty"`
	DisciplineName   *string    `json:"discipline_name,omitempty"`
	DisciplineNameKK *string    `json:"discipline_name_kk,omitempty"`
	DisciplineNameEN *string    `json:"discipline_name_en,omitempty"`
	DisciplineColor  *string    `json:"discipline_color,omitempty"`
	CreatedAt        *time.Time `json:"created_at,omitempty"`
	UpdatedAt        *time.Time `json:"updated_at,omitempty"`
}

type Category struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	CreatedAt *time.Time `json:"created_at,omitempty"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

type Book struct {
	ID              string     `json:"id"`
	Title           string     `json:"title"`
	Author          *string    `json:"author,omitempty"`
	Year            *int32     `json:"year,omitempty"`
	ISBN            *string    `json:"isbn,omitempty"`
	Description     *string    `json:"description,omitempty"`
	CoverURL        *string    `json:"cover_url,omitempty"`
	Source          string     `json:"source"`
	OLKey           *string    `json:"ol_key,omitempty"`
	IAID            *string    `json:"ia_id,omitempty"`
	GutenbergID     *string    `json:"gutenberg_id,omitempty"`
	HasFulltext     bool       `json:"has_fulltext"`
	DisciplineID    *string    `json:"discipline_id,omitempty"`
	CourseID        *string    `json:"course_id,omitempty"`
	CategoryID      *string    `json:"category_id,omitempty"`
	SpecialityID    *string    `json:"speciality_id,omitempty"`
	MaterialType    *string    `json:"material_type,omitempty"`
	Language        *string    `json:"language,omitempty"`
	Semester        *int32     `json:"semester,omitempty"`
	Teacher         *string    `json:"teacher,omitempty"`
	Tags            *string    `json:"tags,omitempty"`
	Version         *string    `json:"version,omitempty"`
	AccessLevel     string     `json:"access_level"`
	UploadedBy      *string    `json:"uploaded_by,omitempty"`
	ExternalURL     *string    `json:"external_url,omitempty"`
	RemoteID        *string    `json:"remote_id,omitempty"`
	ContentS3Key    *string    `json:"content_s3_key,omitempty"`
	ContentS3Bucket *string    `json:"content_s3_bucket,omitempty"`
	FileName        *string    `json:"file_name,omitempty"`
	FileSize        *int64     `json:"file_size,omitempty"`
	ContentType     *string    `json:"content_type,omitempty"`
	HasFile         bool       `json:"has_file"`
	CreatedAt       *time.Time `json:"created_at,omitempty"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
}

