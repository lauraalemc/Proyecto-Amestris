package models

import (
	"encoding/json"
	"time"
)

type Audit struct {
	ID        uint            `gorm:"primaryKey" json:"id"`
	Action    string          `json:"action"`
	Entity    string          `json:"entity"`
	EntityID  uint            `json:"entityId"`
	Meta      json.RawMessage `gorm:"type:jsonb" json:"meta"`
	CreatedAt time.Time       `json:"createdAt"`
}
