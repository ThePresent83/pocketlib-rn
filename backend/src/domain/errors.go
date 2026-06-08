package domain

import "errors"

var ErrLoginCollision = errors.New("login already exists")
var ErrCollision = errors.New("already exists")
var ErrInvalidID = errors.New("invalid id")
var ErrNotFound = errors.New("not found")
