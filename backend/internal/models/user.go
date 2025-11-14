// internal/models/user.go
package models

import "time"

type UserRole string

const (
	RoleAlchemist  UserRole = "ALCHEMIST"
	RoleSupervisor UserRole = "SUPERVISOR"
)

type User struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	Name         string    `json:"name" gorm:"type:text;not null"`
	Email        string    `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash string    `json:"-" gorm:"column:password_hash;not null"`
	Role         UserRole  `json:"role" gorm:"type:text;not null;default:ALCHEMIST"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
