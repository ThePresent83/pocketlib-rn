package servisec

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

var ErrCoverUnavailable = errors.New("book cover is unavailable")

type generatedCover struct {
	FileName    string
	ContentType string
	Data        []byte
}

func generateBookCover(ctx context.Context, filename string, contentType string, reader io.Reader) (*generatedCover, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	mime := strings.ToLower(contentType)

	switch {
	case ext == ".pdf" || strings.Contains(mime, "pdf"):
		return generatePDFCover(ctx, filename, reader)
	case ext == ".epub" || strings.Contains(mime, "epub"):
		return generateEpubCover(filename, reader)
	default:
		return nil, ErrCoverUnavailable
	}
}

func generatePDFCover(ctx context.Context, filename string, reader io.Reader) (*generatedCover, error) {
	if _, err := exec.LookPath("pdftoppm"); err != nil {
		return nil, ErrCoverUnavailable
	}

	tempDir, err := os.MkdirTemp("", "pocketlib-cover-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	inputPath := filepath.Join(tempDir, "source.pdf")
	inputFile, err := os.Create(inputPath)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(inputFile, reader); err != nil {
		inputFile.Close()
		return nil, err
	}
	if err := inputFile.Close(); err != nil {
		return nil, err
	}

	outputPrefix := filepath.Join(tempDir, "cover")
	commandCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	cmd := exec.CommandContext(commandCtx, "pdftoppm", "-f", "1", "-l", "1", "-singlefile", "-jpeg", "-r", "110", inputPath, outputPrefix)
	if output, err := cmd.CombinedOutput(); err != nil {
		if len(output) > 0 {
			return nil, errors.New(strings.TrimSpace(string(output)))
		}
		return nil, err
	}

	data, err := os.ReadFile(outputPrefix + ".jpg")
	if err != nil {
		return nil, err
	}

	return &generatedCover{
		FileName:    coverFileName(filename, ".jpg"),
		ContentType: "image/jpeg",
		Data:        data,
	}, nil
}

func generateEpubCover(filename string, reader io.Reader) (*generatedCover, error) {
	data, err := io.ReadAll(io.LimitReader(reader, 120<<20))
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, ErrCoverUnavailable
	}

	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}

	var selected *zip.File
	for _, file := range archive.File {
		name := strings.ToLower(file.Name)
		if !isCoverImageFile(name) {
			continue
		}
		if selected == nil || strings.Contains(name, "cover") {
			selected = file
		}
		if strings.Contains(name, "cover") {
			break
		}
	}
	if selected == nil {
		return nil, ErrCoverUnavailable
	}

	file, err := selected.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()

	imageData, err := io.ReadAll(io.LimitReader(file, 20<<20))
	if err != nil {
		return nil, err
	}
	if len(imageData) == 0 {
		return nil, ErrCoverUnavailable
	}

	contentType := http.DetectContentType(imageData)
	ext := strings.ToLower(filepath.Ext(selected.Name))
	if strings.Contains(contentType, "octet-stream") {
		contentType = contentTypeForImageExtension(ext)
	}

	return &generatedCover{
		FileName:    coverFileName(filename, ext),
		ContentType: contentType,
		Data:        imageData,
	}, nil
}

func isCoverImageFile(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	default:
		return false
	}
}

func contentTypeForImageExtension(ext string) string {
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}

func coverFileName(filename string, ext string) string {
	base := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	base = strings.TrimSpace(base)
	if base == "" || base == "." {
		base = "book"
	}
	if ext == "" {
		ext = ".jpg"
	}
	return "cover-" + base + ext
}
