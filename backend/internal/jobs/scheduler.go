// backend/internal/jobs/scheduler.go
package jobs

import (
	"context"
	"log"
	"time"
)

// StartDailyJobs lanza una goroutine que ejecuta tareas diarias.
func StartDailyJobs(ctx context.Context) {
	go func() {
		// Ejecuta una vez al inicio
		runDailyChecks(ctx)

		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("⏹ Deteniendo jobs diarios")
				return
			case <-ticker.C:
				runDailyChecks(ctx)
			}
		}
	}()
}

func runDailyChecks(ctx context.Context) {
	log.Println("🕒 Ejecutando verificaciones diarias...")

	// 1) Registrar auditoría diaria
	if err := HandleDailyAudit(ctx); err != nil {
		log.Printf("❌ Error en auditoría diaria: %v", err)
	}

	// 2) Revisar misiones no cerradas de más de 7 días (ejemplo)
	RunStaleMissionsCheck(7)
}
