package models

import "time"

// Tabla para manejo de refresh tokens
type RefreshToken struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null;index" json:"userId"`
	TokenHash string     `gorm:"not null;size:128;uniqueIndex" json:"-"`  // hash del refresh
	JTI       string     `gorm:"not null;size:64;uniqueIndex" json:"jti"` // identificador único del refresh
	ExpiresAt time.Time  `gorm:"not null;index" json:"expiresAt"`
	RevokedAt *time.Time `gorm:"index" json:"revokedAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
}

// Nombre explícito de la tabla
func (RefreshToken) TableName() string {
	return "refresh_tokens"
}
