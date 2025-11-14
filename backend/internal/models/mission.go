package models

import "time"

type MissionStatus string

const (
	MissionPending    MissionStatus = "PENDING"
	MissionApproved   MissionStatus = "APPROVED"
	MissionInProgress MissionStatus = "IN_PROGRESS"
	MissionCompleted  MissionStatus = "COMPLETED"
	MissionRejected   MissionStatus = "REJECTED"
)

type Mission struct {
	ID                  uint          `json:"id" gorm:"primaryKey"`
	Title               string        `json:"title" gorm:"type:text;not null"`
	Description         string        `json:"description" gorm:"type:text"`
	Status              MissionStatus `json:"status" gorm:"type:text;default:PENDING;not null"`
	AssignedAlchemistID *uint         `json:"assignedAlchemistId" gorm:"index"`
	AssignedAlchemist   *Alchemist    `json:"assignedAlchemist" gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
	ScheduledAt         *time.Time    `json:"scheduledAt"`
	CompletedAt         *time.Time    `json:"completedAt"`
	CreatedAt           time.Time     `json:"createdAt"`
	UpdatedAt           time.Time     `json:"updatedAt"`
}
