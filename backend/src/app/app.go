package app

import (
	"context"
	"net/http"

	"backend/src/config"
	bookhttp "backend/src/http"
	"backend/src/repo"
	"backend/src/servisec"
	"backend/src/sqlc"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

func Run(ctx context.Context) error {
	logger, err := zap.NewDevelopment()
	if err != nil {
		return err
	}
	defer logger.Sync()

	cfg := config.CreateConfig()

	db, err := pgxpool.New(ctx, cfg.DB.URL)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		return err
	}

	var s3Client *s3.Client
	if cfg.S3.Enabled() {
		s3Client, err = cfg.S3.CreateClient(ctx, logger)
		if err != nil {
			return err
		}
	}

	queries := sqlc.New(db)
	bookRepo := repo.NewBookRepo(queries)
	bookService := servisec.NewBookService(bookRepo, servisec.NewS3Storage(s3Client, cfg.S3.BucketMain))
	handler := bookhttp.NewHandler(bookService, logger)

	server := &http.Server{
		Addr:    cfg.Server.Addr(),
		Handler: handler.Routes(),
	}

	logger.Info("starting http server", zap.String("addr", cfg.Server.Addr()))
	return server.ListenAndServe()
}
