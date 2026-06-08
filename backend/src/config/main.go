package config

type Config struct {
	Server serverConfig
	DB     DBConfig
	S3     S3Config
	Auth   AuthConfig
}

func CreateConfig() Config {
	return Config{
		Server: createServerConfig(),
		DB:     createDBConfig(),
		S3:     createS3Config(),
		Auth:   createAuthConfig(),
	}
}
