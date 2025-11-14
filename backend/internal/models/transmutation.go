package models

import "time"

type Transmutation struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Title        string    `gorm:"size:160;not null" json:"title"`
	MaterialID   uint      `json:"materialId"`
	Material     Material  `gorm:"foreignKey:MaterialID" json:"-"`
	MissionID    *uint     `json:"missionId,omitempty"`
	Mission      Mission   `gorm:"foreignKey:MissionID" json:"-"`
	QuantityUsed float64   `json:"quantityUsed"`
	Result       *string   `json:"result,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}
