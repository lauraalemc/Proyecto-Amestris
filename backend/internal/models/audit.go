package models

import (
	"encoding/json"
	"time"
)

type Audit struct {
	ID        uint            `gorm:"primaryKey" json:"id"`
	Action    string          `json:"action"`   // p.ej. "CREATE", "DELETE", "QUEUE_PUSH"
	Entity    string          `json:"entity"`   // p.ej. "material", "mission", "transmutation"
	EntityID  uint            `json:"entityId"` // id afectado (0 si no aplica)
	Meta      json.RawMessage `gorm:"type:jsonb" json:"meta"`
	CreatedAt time.Time       `json:"createdAt"`
}
