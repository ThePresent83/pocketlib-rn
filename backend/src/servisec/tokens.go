package servisec

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/src/config"
	"backend/src/domain"
)

const (
	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)

var (
	ErrInvalidToken     = errors.New("invalid token")
	ErrInvalidTokenType = errors.New("invalid token type")
)

type SessionUser struct {
	ID    string      `json:"id"`
	Login string      `json:"login"`
	Role  domain.Role `json:"role"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

type TokenService struct {
	secret       []byte
	accessToken  time.Duration
	refreshToken time.Duration
}

type tokenClaims struct {
	Subject   string      `json:"sub"`
	Login     string      `json:"login"`
	Role      domain.Role `json:"role"`
	TokenType string      `json:"typ"`
	IssuedAt  int64       `json:"iat"`
	ExpiresAt int64       `json:"exp"`
}

func NewTokenService(cfg config.AuthConfig) *TokenService {
	return &TokenService{
		secret:       []byte(cfg.JWTSecret),
		accessToken:  cfg.AccessTokenTTL,
		refreshToken: cfg.RefreshTokenTTL,
	}
}

func (service *TokenService) CreateTokenPair(user SessionUser) (TokenPair, error) {
	now := time.Now()

	accessToken, err := service.createToken(user, TokenTypeAccess, now, service.accessToken)
	if err != nil {
		return TokenPair{}, err
	}
	refreshToken, err := service.createToken(user, TokenTypeRefresh, now, service.refreshToken)
	if err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(service.accessToken.Seconds()),
	}, nil
}

func (service *TokenService) ParseToken(token string, expectedType string) (SessionUser, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return SessionUser{}, ErrInvalidToken
	}

	signed := parts[0] + "." + parts[1]
	expectedSignature := service.sign(signed)
	if !hmac.Equal([]byte(parts[2]), []byte(expectedSignature)) {
		return SessionUser{}, ErrInvalidToken
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return SessionUser{}, ErrInvalidToken
	}

	var claims tokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return SessionUser{}, ErrInvalidToken
	}
	if claims.TokenType != expectedType {
		return SessionUser{}, ErrInvalidTokenType
	}
	if time.Now().Unix() >= claims.ExpiresAt {
		return SessionUser{}, ErrInvalidToken
	}

	return SessionUser{ID: claims.Subject, Login: claims.Login, Role: claims.Role}, nil
}

func (service *TokenService) createToken(user SessionUser, tokenType string, now time.Time, ttl time.Duration) (string, error) {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	claims := tokenClaims{
		Subject:   user.ID,
		Login:     user.Login,
		Role:      user.Role,
		TokenType: tokenType,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(ttl).Unix(),
	}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	signed := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	return signed + "." + service.sign(signed), nil
}

func (service *TokenService) sign(value string) string {
	mac := hmac.New(sha256.New, service.secret)
	_, _ = mac.Write([]byte(value))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func BearerToken(header string) (string, error) {
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok || strings.TrimSpace(token) == "" {
		return "", fmt.Errorf("authorization bearer token is required")
	}
	return strings.TrimSpace(token), nil
}
