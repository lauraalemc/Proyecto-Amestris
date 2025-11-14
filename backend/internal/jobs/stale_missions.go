package jobs

import (
	"log"
	"time"

	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

func RunStaleMissionsCheck(days int) {
	limit := time.Now().AddDate(0, 0, -days)

	var missions []models.Mission
	err := db.Get().
		Where("updated_at < ? AND status != ?", limit, models.MissionCompleted).
		Find(&missions).Error

	if err != nil {
		log.Printf("❌ Error revisando misiones viejas: %v", err)
		return
	}

	for _, m := range missions {
		log.Printf("⚠️ Misión vieja detectada: %d — %s (status=%s)", m.ID, m.Title, m.Status)
	}
}
