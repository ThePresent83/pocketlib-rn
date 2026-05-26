package config

type serverConfig struct {
	Port int
}

func createServerConfig() serverConfig {
	return serverConfig{
		Port: getEnv("PORT", true, parseIntWithDefault(8080)),
	}
}

func (config serverConfig) Addr() string {
	return ":" + intToString(config.Port)
}
