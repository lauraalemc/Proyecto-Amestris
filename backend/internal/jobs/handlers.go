package jobs

import (
	"context"
	"encoding/json"
	"log"

	"amestris/backend/internal/async"
	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

// jsonOrNil convierte cualquier valor en json.RawMessage, devolviendo nil si no aplica.
func jsonOrNil(v any) json.RawMessage {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		log.Printf("warn: no se pudo serializar meta: %v", err)
		return nil
	}
	return json.RawMessage(b)
}

// HandleAuditMessage guarda un registro de auditoría a partir del payload recibido de la cola.
func HandleAuditMessage(ctx context.Context, payload async.AuditPayload) error {
	meta := jsonOrNil(payload.Meta)

	a := models.Audit{
		Action:   payload.Action,
		Entity:   payload.Entity,
		EntityID: payload.EntityID,
		Meta:     meta,
	}

	if err := db.DB.Create(&a).Error; err != nil {
		return err
	}

	log.Printf("✅ Auditoría registrada: action=%s entity=%s id=%d", a.Action, a.Entity, a.EntityID)
	return nil
}

// HandleDailyAudit crea un registro de auditoría diario (tarea programada).
func HandleDailyAudit(ctx context.Context) error {
	metaObj := map[string]any{
		"kind": "daily_check",
		"note": "Auditoría diaria ejecutada automáticamente",
	}

	meta := jsonOrNil(metaObj)

	a := models.Audit{
		Action:   "DAILY_CHECK",
		Entity:   "system",
		EntityID: 0,
		Meta:     meta,
	}

	if err := db.DB.Create(&a).Error; err != nil {
		return err
	}

	log.Printf("🕒 Auditoría diaria registrada")
	return nil
}
