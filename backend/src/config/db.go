package config

type DBConfig struct {
	URL string
}

func createDBConfig() DBConfig {
	return DBConfig{
		URL: getEnvWithoutParser("POSTGRES_URL", false),
	}
}
