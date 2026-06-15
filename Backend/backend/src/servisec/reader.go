package servisec

import (
	"context"
	"errors"
	"sort"

	"backend/src/domain"
	"backend/src/repo"
)

type ReaderRepo interface {
	GetReaderState(ctx context.Context, userID string, bookID string) (domain.ReaderState, error)
	UpsertReaderState(ctx context.Context, input repo.ReaderStateUpsert) (domain.ReaderState, error)
}

type ReaderService struct {
	repo ReaderRepo
}

type ReaderStateInput struct {
	Page       int32                   `json:"page"`
	TotalPages int32                   `json:"total_pages"`
	FontSize   int32                   `json:"font_size"`
	Bookmarks  []int32                 `json:"bookmarks"`
	Appearance domain.ReaderAppearance `json:"appearance"`
}

func NewReaderService(repo ReaderRepo) *ReaderService {
	return &ReaderService{repo: repo}
}

func (service *ReaderService) GetState(ctx context.Context, userID string, bookID string) (domain.ReaderState, error) {
	state, err := service.repo.GetReaderState(ctx, userID, bookID)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.ReaderState{
			UserID:     userID,
			BookID:     bookID,
			Page:       0,
			TotalPages: 0,
			FontSize:   16,
			Bookmarks:  []int32{},
			Appearance: defaultReaderAppearance(),
		}, nil
	}
	if err != nil {
		return domain.ReaderState{}, err
	}
	state = normalizeReaderState(state)
	return state, nil
}

func (service *ReaderService) SaveState(ctx context.Context, userID string, bookID string, input ReaderStateInput) (domain.ReaderState, error) {
	normalized := normalizeReaderState(domain.ReaderState{
		UserID:     userID,
		BookID:     bookID,
		Page:       input.Page,
		TotalPages: input.TotalPages,
		FontSize:   input.FontSize,
		Bookmarks:  input.Bookmarks,
		Appearance: input.Appearance,
	})

	return service.repo.UpsertReaderState(ctx, repo.ReaderStateUpsert{
		UserID:     userID,
		BookID:     bookID,
		Page:       normalized.Page,
		TotalPages: normalized.TotalPages,
		FontSize:   normalized.FontSize,
		Bookmarks:  normalized.Bookmarks,
		Appearance: normalized.Appearance,
	})
}

func normalizeReaderState(state domain.ReaderState) domain.ReaderState {
	if state.Page < 0 {
		state.Page = 0
	}
	if state.TotalPages < 0 {
		state.TotalPages = 0
	}
	if state.TotalPages > 0 && state.Page >= state.TotalPages {
		state.Page = state.TotalPages - 1
	}
	if state.FontSize <= 0 {
		state.FontSize = 16
	}
	state.Bookmarks = normalizeBookmarks(state.Bookmarks, state.TotalPages)
	state.Appearance = normalizeReaderAppearance(state.Appearance)
	return state
}

func normalizeBookmarks(bookmarks []int32, totalPages int32) []int32 {
	seen := make(map[int32]bool, len(bookmarks))
	result := make([]int32, 0, len(bookmarks))
	for _, bookmark := range bookmarks {
		if bookmark < 0 {
			continue
		}
		if totalPages > 0 && bookmark >= totalPages {
			continue
		}
		if seen[bookmark] {
			continue
		}
		seen[bookmark] = true
		result = append(result, bookmark)
	}
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}

func normalizeReaderAppearance(appearance domain.ReaderAppearance) domain.ReaderAppearance {
	defaults := defaultReaderAppearance()
	if appearance.FontFamily == "" {
		appearance.FontFamily = defaults.FontFamily
	}
	if appearance.LineHeight <= 0 {
		appearance.LineHeight = defaults.LineHeight
	}
	if appearance.PageWidth <= 0 {
		appearance.PageWidth = defaults.PageWidth
	}
	if appearance.Theme == "" {
		appearance.Theme = defaults.Theme
	}
	return appearance
}

func defaultReaderAppearance() domain.ReaderAppearance {
	return domain.ReaderAppearance{
		FontFamily: "serif",
		LineHeight: 1.7,
		PageWidth:  760,
		Theme:      "paper",
	}
}
