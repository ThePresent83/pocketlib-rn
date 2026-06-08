package servisec

import (
	"context"
	"errors"
	"strings"

	"backend/src/config"
	"backend/src/domain"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid login or password")
	ErrLoginCollision     = domain.ErrLoginCollision
	ErrInvalidID          = domain.ErrInvalidID
	ErrNotFound           = domain.ErrNotFound
	ErrBlankLogin         = errors.New("login is required")
	ErrBlankPassword      = errors.New("password is required")
	ErrInvalidRole        = errors.New("invalid role")
)

type AuthRepo interface {
	CreateUser(ctx context.Context, input domain.CreateUserInput) (domain.User, error)
	CreateUserAdmin(ctx context.Context, input domain.CreateUserAdminInput) (domain.User, error)
	GetUser(ctx context.Context, userID string) (domain.User, error)
	GetUserByLogin(ctx context.Context, login string) (domain.User, error)
	ListUsers(ctx context.Context, filter domain.ListUsersFilter) ([]domain.User, error)
	UpdateUser(ctx context.Context, input domain.UpdateUserInput) (domain.User, error)
	UpdateUserRole(ctx context.Context, input domain.UpdateUserRoleInput) (domain.User, error)
	DeleteUser(ctx context.Context, userID string) error
}

type RegisterInput struct {
	Login    string  `json:"login"`
	Password string  `json:"password"`
	GroupID  *string `json:"group_id"`
}

type LoginInput struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

type AuthResult struct {
	User   SessionUser `json:"user"`
	Tokens TokenPair   `json:"tokens"`
}

type UpdateUserRoleInput struct {
	Role string `json:"role"`
}

type CreateUserAdminInput struct {
	Login    string  `json:"login"`
	Password string  `json:"password"`
	GroupID  *string `json:"group_id"`
	Role     string  `json:"role"`
}

type UpdateUserInput struct {
	Login    string  `json:"login"`
	Password *string `json:"password"`
	GroupID  *string `json:"group_id"`
	Role     string  `json:"role"`
}

type ListUsersFilter struct {
	Query  string
	Limit  int32
	Offset int32
}

type AuthService struct {
	repo               AuthRepo
	tokens             *TokenService
	defaultAdminLogin  string
	defaultAdminPasswd string
}

func NewAuthService(repo AuthRepo, tokens *TokenService, cfg config.AuthConfig) *AuthService {
	return &AuthService{
		repo:               repo,
		tokens:             tokens,
		defaultAdminLogin:  strings.TrimSpace(cfg.DefaultAdminLogin),
		defaultAdminPasswd: cfg.DefaultAdminPassword,
	}
}

func (service *AuthService) Register(ctx context.Context, input RegisterInput) (AuthResult, error) {
	login, password, err := normalizeCredentials(input.Login, input.Password)
	if err != nil {
		return AuthResult{}, err
	}

	if _, err := service.repo.GetUserByLogin(ctx, login); err == nil {
		return AuthResult{}, ErrLoginCollision
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResult{}, err
	}

	user, err := service.repo.CreateUser(ctx, domain.CreateUserInput{
		Login:        login,
		PasswordHash: string(passwordHash),
		GroupID:      input.GroupID,
		Role:         service.roleForCredentials(login, password),
	})
	if err != nil {
		return AuthResult{}, err
	}

	return service.authResult(user)
}

func (service *AuthService) Login(ctx context.Context, input LoginInput) (AuthResult, error) {
	login, password, err := normalizeCredentials(input.Login, input.Password)
	if err != nil {
		return AuthResult{}, err
	}

	user, err := service.repo.GetUserByLogin(ctx, login)
	if err != nil {
		return AuthResult{}, ErrInvalidCredentials
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return AuthResult{}, ErrInvalidCredentials
	}

	return service.authResult(user)
}

func (service *AuthService) Refresh(ctx context.Context, refreshToken string) (AuthResult, error) {
	user, err := service.tokens.ParseToken(refreshToken, TokenTypeRefresh)
	if err != nil {
		return AuthResult{}, err
	}

	storedUser, err := service.repo.GetUserByLogin(ctx, user.Login)
	if err != nil {
		return AuthResult{}, ErrInvalidToken
	}
	return service.authResult(storedUser)
}

func (service *AuthService) ParseAccessToken(accessToken string) (SessionUser, error) {
	return service.tokens.ParseToken(accessToken, TokenTypeAccess)
}

func (service *AuthService) CreateUserAdmin(ctx context.Context, input CreateUserAdminInput) (domain.User, error) {
	login, password, err := normalizeCredentials(input.Login, input.Password)
	if err != nil {
		return domain.User{}, err
	}

	role := domain.RoleUser
	if strings.TrimSpace(input.Role) != "" {
		role, err = parseRole(input.Role)
		if err != nil {
			return domain.User{}, err
		}
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return domain.User{}, err
	}

	return service.repo.CreateUserAdmin(ctx, domain.CreateUserAdminInput{
		Login:        login,
		PasswordHash: string(passwordHash),
		GroupID:      input.GroupID,
		Role:         role,
	})
}

func (service *AuthService) GetUser(ctx context.Context, userID string) (domain.User, error) {
	return service.repo.GetUser(ctx, strings.TrimSpace(userID))
}

func (service *AuthService) ListUsers(ctx context.Context, filter ListUsersFilter) ([]domain.User, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 50
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	return service.repo.ListUsers(ctx, domain.ListUsersFilter(filter))
}

func (service *AuthService) UpdateUser(ctx context.Context, userID string, input UpdateUserInput) (domain.User, error) {
	login := strings.TrimSpace(input.Login)
	if login == "" {
		return domain.User{}, ErrBlankLogin
	}

	currentUser, err := service.repo.GetUser(ctx, strings.TrimSpace(userID))
	if err != nil {
		return domain.User{}, err
	}

	role := currentUser.Role
	if strings.TrimSpace(input.Role) != "" {
		role, err = parseRole(input.Role)
		if err != nil {
			return domain.User{}, err
		}
	}

	var passwordHash *string
	if input.Password != nil {
		if *input.Password == "" {
			return domain.User{}, ErrBlankPassword
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*input.Password), bcrypt.DefaultCost)
		if err != nil {
			return domain.User{}, err
		}
		hashString := string(hash)
		passwordHash = &hashString
	}

	return service.repo.UpdateUser(ctx, domain.UpdateUserInput{
		UserID:       strings.TrimSpace(userID),
		Login:        login,
		PasswordHash: passwordHash,
		GroupID:      input.GroupID,
		Role:         role,
	})
}

func (service *AuthService) UpdateUserRole(ctx context.Context, userID string, input UpdateUserRoleInput) (SessionUser, error) {
	role, err := parseRole(input.Role)
	if err != nil {
		return SessionUser{}, err
	}

	user, err := service.repo.UpdateUserRole(ctx, domain.UpdateUserRoleInput{
		UserID: strings.TrimSpace(userID),
		Role:   role,
	})
	if err != nil {
		return SessionUser{}, err
	}

	return SessionUser{ID: user.ID, Login: user.Login, Role: user.Role}, nil
}

func (service *AuthService) DeleteUser(ctx context.Context, userID string) error {
	return service.repo.DeleteUser(ctx, strings.TrimSpace(userID))
}

func (service *AuthService) roleForCredentials(login string, password string) domain.Role {
	if login == service.defaultAdminLogin && password == service.defaultAdminPasswd {
		return domain.RoleAdmin
	}
	return domain.RoleUser
}

func (service *AuthService) authResult(user domain.User) (AuthResult, error) {
	sessionUser := SessionUser{ID: user.ID, Login: user.Login, Role: user.Role}
	tokens, err := service.tokens.CreateTokenPair(sessionUser)
	if err != nil {
		return AuthResult{}, err
	}
	return AuthResult{User: sessionUser, Tokens: tokens}, nil
}

func normalizeCredentials(login string, password string) (string, string, error) {
	login = strings.TrimSpace(login)
	if login == "" {
		return "", "", ErrBlankLogin
	}
	if password == "" {
		return "", "", ErrBlankPassword
	}
	return login, password, nil
}

func parseRole(value string) (domain.Role, error) {
	switch domain.Role(strings.ToUpper(strings.TrimSpace(value))) {
	case domain.RoleUser:
		return domain.RoleUser, nil
	case domain.RoleAdmin:
		return domain.RoleAdmin, nil
	default:
		return "", ErrInvalidRole
	}
}
