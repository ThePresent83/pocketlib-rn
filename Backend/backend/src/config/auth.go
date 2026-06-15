package config

import "time"

type AuthConfig struct {
	JWTSecret            string
	AccessTokenTTL       time.Duration
	RefreshTokenTTL      time.Duration
	DefaultAdminLogin    string
	DefaultAdminPassword string
}

func createAuthConfig() AuthConfig {
	return AuthConfig{
		JWTSecret:            getEnvWithoutParser("AUTH_JWT_SECRET", false),
		AccessTokenTTL:       getEnv("AUTH_ACCESS_TOKEN_TTL", true, parseTimeoutWithDefault(15*time.Minute)),
		RefreshTokenTTL:      getEnv("AUTH_REFRESH_TOKEN_TTL", true, parseTimeoutWithDefault(30*24*time.Hour)),
		DefaultAdminLogin:    getEnvWithoutParser("DEFAULT_ADMIN_LOGIN", false),
		DefaultAdminPassword: getEnvWithoutParser("DEFAULT_ADMIN_PASSWORD", false),
	}
}
