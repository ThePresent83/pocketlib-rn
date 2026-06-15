package domain

import "time"

type ReaderAppearance struct {
	FontFamily string  `json:"font_family"`
	LineHeight float64 `json:"line_height"`
	PageWidth  int32   `json:"page_width"`
	Theme      string  `json:"theme"`
}

type ReaderState struct {
	UserID     string           `json:"user_id"`
	BookID     string           `json:"book_id"`
	Page       int32            `json:"page"`
	TotalPages int32            `json:"total_pages"`
	FontSize   int32            `json:"font_size"`
	Bookmarks  []int32          `json:"bookmarks"`
	Appearance ReaderAppearance `json:"appearance"`
	UpdatedAt  *time.Time       `json:"updated_at,omitempty"`
}
