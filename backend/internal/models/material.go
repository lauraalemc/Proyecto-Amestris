package models

import "time"

type Material struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:120;not null" json:"name"`
	Quantity  float64   `json:"quantity"` // permite decimales
	Unit      string    `gorm:"size:20;not null" json:"unit"`
	Rarity    *string   `json:"rarity,omitempty"`
	Notes     *string   `json:"notes,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
