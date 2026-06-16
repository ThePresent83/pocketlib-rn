package servisec

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var ErrS3Disabled = errors.New("s3 is not configured")

type S3Storage struct {
	client     *s3.Client
	bucketMain string
	publicBase url.URL
}

type StoredObject struct {
	Bucket      string
	Key         string
	ContentType string
	SizeBytes   int64
	ETag        string
	Body        io.ReadCloser
}

type UploadedFile struct {
	S3Key    string `json:"s3_key"`
	S3Bucket string `json:"s3_bucket"`
}

func NewS3Storage(client *s3.Client, bucket string, publicBase url.URL) *S3Storage {
	return &S3Storage{client: client, bucketMain: bucket, publicBase: publicBase}
}

func (storage *S3Storage) Enabled() bool {
	return storage != nil && storage.client != nil && storage.bucketMain != ""
}

func (storage *S3Storage) UploadFile(ctx context.Context, filename string, sizeInBytes int64, reader io.ReadSeeker) (*UploadedFile, error) {
	if !storage.Enabled() {
		return nil, ErrS3Disabled
	}

	s3Key, err := storage.createFileKey(filename)
	if err != nil {
		return nil, err
	}

	uploadedFile := UploadedFile{
		S3Key:    s3Key,
		S3Bucket: storage.bucketMain,
	}

	_, err = storage.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(uploadedFile.S3Bucket),
		Key:           aws.String(uploadedFile.S3Key),
		Body:          reader,
		ContentLength: aws.Int64(sizeInBytes),
	})
	if err != nil {
		return nil, err
	}

	return &uploadedFile, nil
}

func (storage *S3Storage) UploadBytes(ctx context.Context, filename string, contentType string, data []byte) (*UploadedFile, error) {
	if !storage.Enabled() {
		return nil, ErrS3Disabled
	}

	s3Key, err := storage.createFileKey(filename)
	if err != nil {
		return nil, err
	}

	uploadedFile := UploadedFile{
		S3Key:    s3Key,
		S3Bucket: storage.bucketMain,
	}

	input := &s3.PutObjectInput{
		Bucket:        aws.String(uploadedFile.S3Bucket),
		Key:           aws.String(uploadedFile.S3Key),
		Body:          bytes.NewReader(data),
		ContentLength: aws.Int64(int64(len(data))),
	}
	if strings.TrimSpace(contentType) != "" {
		input.ContentType = aws.String(contentType)
	}

	_, err = storage.client.PutObject(ctx, input)
	if err != nil {
		return nil, err
	}

	return &uploadedFile, nil
}

func (storage *S3Storage) DeleteFile(ctx context.Context, s3Key string, s3Bucket string) error {
	if !storage.Enabled() {
		return ErrS3Disabled
	}
	if s3Bucket == "" {
		s3Bucket = storage.bucketMain
	}
	_, err := storage.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s3Bucket),
		Key:    aws.String(s3Key),
	})
	return err
}

func (storage *S3Storage) CreatePublicURL(s3Key string, s3Bucket string) url.URL {
	if s3Bucket == "" {
		s3Bucket = storage.bucketMain
	}
	u := storage.publicBase
	u.Path = path.Join(strings.TrimSuffix(u.Path, "/"), s3Bucket, s3Key)
	return u
}

func (storage *S3Storage) ParseS3URL(value url.URL) (string, string, error) {
	parts := strings.Split(strings.Trim(value.Path, "/"), "/")
	if len(parts) < 2 {
		return "", "", fmt.Errorf("expected at least two path segments")
	}
	return strings.Join(parts[1:], "/"), parts[0], nil
}

func (storage *S3Storage) Get(ctx context.Context, bucket string, key string) (StoredObject, error) {
	if !storage.Enabled() {
		return StoredObject{}, ErrS3Disabled
	}
	if bucket == "" {
		bucket = storage.bucketMain
	}

	output, err := storage.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return StoredObject{}, err
	}

	contentType := ""
	if output.ContentType != nil {
		contentType = *output.ContentType
	}
	etag := ""
	if output.ETag != nil {
		etag = *output.ETag
	}
	sizeBytes := int64(0)
	if output.ContentLength != nil {
		sizeBytes = *output.ContentLength
	}

	return StoredObject{
		Bucket:      bucket,
		Key:         key,
		ContentType: contentType,
		SizeBytes:   sizeBytes,
		ETag:        etag,
		Body:        output.Body,
	}, nil
}

func (storage *S3Storage) PresignedGetURL(ctx context.Context, bucket string, key string, ttl time.Duration) (string, error) {
	if !storage.Enabled() {
		return "", ErrS3Disabled
	}
	if bucket == "" {
		bucket = storage.bucketMain
	}

	presigner := s3.NewPresignClient(storage.client)
	output, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}

	return output.URL, nil
}

func (storage *S3Storage) createFileKey(filename string) (string, error) {
	var randomBytes [16]byte
	if _, err := rand.Read(randomBytes[:]); err != nil {
		return "", err
	}

	filename = filepath.Base(filename)
	filename = strings.TrimSpace(filename)
	if filename == "." || filename == "/" || filename == "" {
		filename = "file"
	}

	return hex.EncodeToString(randomBytes[:]) + "-" + filename, nil
}
