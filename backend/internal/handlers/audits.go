package handlers

import (
	"encoding/json"
	"net/http"

	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

func AuditsList(w http.ResponseWriter, r *http.Request) {
	var audits []models.Audit
	if err := db.Get().Order("id DESC").Limit(100).Find(&audits).Error; err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		WriteError(w, http.StatusInternalServerError, "no se pudieron obtener auditorías")

		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(audits)
}
