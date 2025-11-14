// backend/internal/jobs/transmutation_job.go
package jobs

import (
	"context"
	"encoding/json"
	"log"

	"amestris/backend/internal/db"
	"amestris/backend/internal/metrics"
	"amestris/backend/internal/models"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Importante: TaskTransmutation y PayloadTransmutation
// YA están definidos en jobs/types.go. Aquí solo los usamos.

// HandleTransmutationTask procesa una tarea de transmutación
// en segundo plano usando Asynq. Se asume que la tarea fue
// encolada con el tipo TaskTransmutation y payload PayloadTransmutation.
func HandleTransmutationTask(ctx context.Context, t *asynq.Task) error {
	var p PayloadTransmutation
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		log.Printf("asynq transmutation: decode error: %v", err)
		metrics.JobProcessed("transmutation_process", "decode_error")
		return err
	}

	err := db.Get().Transaction(func(tx *gorm.DB) error {
		var m models.Material
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&m, p.MaterialID).Error; err != nil {
			return err
		}

		// Validar stock
		if m.Quantity < p.Quantity {
			return gorm.ErrInvalidData
		}

		// Descontar stock
		m.Quantity -= p.Quantity
		if err := tx.Save(&m).Error; err != nil {
			return err
		}

		// Crear transmutation básica
		tm := models.Transmutation{
			Title:        p.Title,
			MaterialID:   p.MaterialID,
			QuantityUsed: p.Quantity,
			Result:       p.Result,
		}
		if err := tx.Create(&tm).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if err == gorm.ErrInvalidData {
			log.Printf("asynq transmutation: stock insuficiente (material=%d)", p.MaterialID)
			metrics.JobProcessed("transmutation_process", "stock_insuficiente")
		} else {
			log.Printf("asynq transmutation: db error: %v", err)
			metrics.JobProcessed("transmutation_process", "db_error")
		}
		return err
	}

	metrics.JobProcessed("transmutation_process", "ok")
	return nil
}
