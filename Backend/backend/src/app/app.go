package app

import (
	"context"
	"net/http"

	"backend/src/config"
	bookhttp "backend/src/http"
	"backend/src/repo"
	"backend/src/servisec"

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
	if err := ensureSchema(ctx, db); err != nil {
		return err
	}
	if err := seedCatalog(ctx, db); err != nil {
		return err
	}

	var s3Client *s3.Client
	if cfg.S3.Enabled() {
		s3Client, err = cfg.S3.CreateClient(ctx, logger)
		if err != nil {
			return err
		}
	}

	authRepo := repo.NewAuthRepo(db)
	tokenService := servisec.NewTokenService(cfg.Auth)
	authService := servisec.NewAuthService(authRepo, tokenService, cfg.Auth)
	if err := authService.EnsureDefaultAdmin(ctx); err != nil {
		return err
	}
	groupRepo := repo.NewGroupRepo(db)
	groupService := servisec.NewGroupService(groupRepo)
	bookRepo := repo.NewBookRepo(db)
	bookService := servisec.NewBookService(bookRepo, servisec.NewS3Storage(s3Client, cfg.S3.BucketMain, cfg.S3.Endpoint))
	readerRepo := repo.NewReaderRepo(db)
	readerService := servisec.NewReaderService(readerRepo)
	handler := bookhttp.NewHandler(authService, groupService, bookService, readerService, logger)

	server := &http.Server{
		Addr:    cfg.Server.Addr(),
		Handler: handler.Routes(),
	}

	logger.Info("starting http server", zap.String("addr", cfg.Server.Addr()))
	return server.ListenAndServe()
}
