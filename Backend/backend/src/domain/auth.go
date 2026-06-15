package domain

import "time"

type Role string

const (
	RoleStudent Role = "student"
	RoleTeacher Role = "teacher"
	RoleAdmin   Role = "admin"
)

type User struct {
	ID           string
	Login        string
	Email        string
	FullName     string
	PasswordHash string
	GroupID      *string
	GroupName    *string
	Role         Role
	CreatedAt    *time.Time
	UpdatedAt    *time.Time
}

type CreateUserInput struct {
	Login        string
	Email        string
	FullName     string
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
	Email        string
	FullName     string
	PasswordHash string
	GroupID      *string
	Role         Role
}

type UpdateUserInput struct {
	UserID       string
	Login        string
	Email        string
	FullName     string
	PasswordHash *string
	GroupID      *string
	Role         Role
}

type ListUsersFilter struct {
	Query  string
	Limit  int32
	Offset int32
}
