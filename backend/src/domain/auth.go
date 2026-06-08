package domain

import "time"

type Role string

const (
	RoleUser  Role = "USER"
	RoleAdmin Role = "ADMIN"
)

type User struct {
	ID           string
	Login        string
	PasswordHash string
	GroupID      *string
	Role         Role
	CreatedAt    *time.Time
	UpdatedAt    *time.Time
}

type CreateUserInput struct {
	Login        string
	PasswordHash string
	GroupID      *string
	Role         Role
}

type UpdateUserRoleInput struct {
	UserID string
	Role   Role
}

type CreateUserAdminInput struct {
	Login        string
	PasswordHash string
	GroupID      *string
	Role         Role
}

type UpdateUserInput struct {
	UserID       string
	Login        string
	PasswordHash *string
	GroupID      *string
	Role         Role
}

type ListUsersFilter struct {
	Query  string
	Limit  int32
	Offset int32
}
