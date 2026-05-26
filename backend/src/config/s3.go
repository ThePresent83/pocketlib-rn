package config

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
)

type S3TLSConfig struct {
	Cert string
	Key  string
}

type S3Config struct {
	Endpoint     url.URL
	Region       string
	AccessKey    string
	SecretKey    string
	BucketMain   string
	TLS          *S3TLSConfig
	PhysicalAddr *string
}

var dial = &net.Dialer{
	Timeout:   30 * time.Second,
	KeepAlive: 30 * time.Second,
}

type DialContext = func(ctx context.Context, network string, _ string) (net.Conn, error)

func createDialContext(physicalAddr *string) DialContext {
	return func(
		ctx context.Context,
		network string,
		addr string,
	) (net.Conn, error) {
		finalAddr := addr
		if physicalAddr != nil {
			finalAddr = *physicalAddr
		}
		return dial.Dial(network, finalAddr)
	}
}

func (config *S3Config) CreateClient(
	ctx context.Context, logger *zap.Logger,
) (*s3.Client, error) {
	conf := aws.NewConfig()
	var tlsConfig *tls.Config = nil
	if config.TLS != nil {
		cert, err := tls.X509KeyPair(
			[]byte(config.TLS.Cert), []byte(config.TLS.Key),
		)
		if err != nil {
			return nil, err
		}
		tlsConfig = &tls.Config{
			Certificates:       []tls.Certificate{cert},
			InsecureSkipVerify: true,
		}
	}
	conf.HTTPClient = &http.Client{
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           createDialContext(config.PhysicalAddr),
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig:       tlsConfig,
		},
	}
	conf.Region = config.Region
	conf.BaseEndpoint = aws.String(config.Endpoint.String())
	conf.Credentials = credentials.NewStaticCredentialsProvider(
		config.AccessKey, config.SecretKey, "",
	)
	logger.Info("Creating s3 client")
	s3Client := s3.NewFromConfig(*conf, func(o *s3.Options) {
		o.UsePathStyle = true
		o.RetryMaxAttempts = 1
	})
	logger.Info("Created s3 client")
	_, err := s3Client.GetBucketAcl(ctx, &s3.GetBucketAclInput{
		Bucket: &config.BucketMain,
	})
	logger.Info("Got test response from s3", zap.Error(err))
	if err != nil {
		return nil, err
	}
	return s3Client, nil
}

func createS3Config() S3Config {
	useTLS := getEnv("S3_USE_TLS", true, parseBoolWithDefault(false))
	var tlsConfig *S3TLSConfig = nil
	if useTLS {
		tlsConfig = &S3TLSConfig{
			Cert: getEnvWithoutParser("S3_TLS_CERT", false),
			Key:  getEnvWithoutParser("S3_TLS_KEY", false),
		}
	}
	addrEnv := getEnvWithoutParser("S3_PHYSICAL_ADDR", true)
	var physicalAddr *string = nil
	if addrEnv != "" {
		physicalAddr = &addrEnv
	}
	return S3Config{
		Endpoint:     getEnv("S3_ENDPOINT", true, parseURLWithDefault("")),
		Region:       getEnvWithoutParser("S3_REGION", true),
		AccessKey:    getEnvWithoutParser("S3_ACCESS_KEY", true),
		SecretKey:    getEnvWithoutParser("S3_SECRET_KEY", true),
		BucketMain:   getEnvWithoutParser("S3_BUCKET_MAIN", true),
		TLS:          tlsConfig,
		PhysicalAddr: physicalAddr,
	}
}

func (config S3Config) Enabled() bool {
	return config.Endpoint.String() != "" &&
		config.Region != "" &&
		config.AccessKey != "" &&
		config.SecretKey != "" &&
		config.BucketMain != ""
}
