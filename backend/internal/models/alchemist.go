package models

import "time"

type Alchemist struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"type:text;not null"`
	Rank      string    `json:"rank" gorm:"type:text;not null;default:Apprentice"`
	Specialty string    `json:"specialty" gorm:"type:text"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}
