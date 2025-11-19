package async

import "encoding/json"

// Enum de acciones
type AuditAction string

const (
	ActionCreate AuditAction = "CREATE"
	ActionUpdate AuditAction = "UPDATE"
	ActionDelete AuditAction = "DELETE"
)

// Mensaje de auditoría
type AuditPayload struct {
	Action   string          `json:"action"`
	Entity   string          `json:"entity"`
	EntityID uint            `json:"entityId"`
	Meta     json.RawMessage `json:"meta"`
}
