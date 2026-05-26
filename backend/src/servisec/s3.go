package servisec

import (
	"context"
	"errors"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var ErrS3Disabled = errors.New("s3 is not configured")

type S3Storage struct {
	client *s3.Client
	bucket string
}

type StoredObject struct {
	Bucket      string
	Key         string
	ContentType string
	SizeBytes   int64
	ETag        string
	Body        io.ReadCloser
}

func NewS3Storage(client *s3.Client, bucket string) *S3Storage {
	return &S3Storage{client: client, bucket: bucket}
}

func (storage *S3Storage) Enabled() bool {
	return storage != nil && storage.client != nil && storage.bucket != ""
}

func (storage *S3Storage) Put(ctx context.Context, key string, body io.Reader, contentType string) (StoredObject, error) {
	if !storage.Enabled() {
		return StoredObject{}, ErrS3Disabled
	}

	output, err := storage.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(storage.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return StoredObject{}, err
	}

	etag := ""
	if output.ETag != nil {
		etag = *output.ETag
	}

	return StoredObject{
		Bucket:      storage.bucket,
		Key:         key,
		ContentType: contentType,
		ETag:        etag,
	}, nil
}

func (storage *S3Storage) Get(ctx context.Context, bucket string, key string) (StoredObject, error) {
	if !storage.Enabled() {
		return StoredObject{}, ErrS3Disabled
	}
	if bucket == "" {
		bucket = storage.bucket
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
		bucket = storage.bucket
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
