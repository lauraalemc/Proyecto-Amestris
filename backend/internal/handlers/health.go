package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"amestris/backend/internal/db"
)

type healthResp struct {
	Status    string `json:"status"`
	DB        string `json:"db"`
	CheckedAt string `json:"checkedAt"`
}

func Healthz(w http.ResponseWriter, r *http.Request) {
	writeHealth(w, r, false)
}

func Readyz(w http.ResponseWriter, r *http.Request) {
	writeHealth(w, r, true)
}

func writeHealth(w http.ResponseWriter, r *http.Request, strict bool) {
	ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
	defer cancel()

	dbStatus := pingDB(ctx)

	status := "ok"
	if strict && dbStatus != "ok" {
		status = "down"
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthResp{
		Status:    status,
		DB:        dbStatus,
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func pingDB(ctx context.Context) string {
	g := db.Get()
	if g == nil {
		return "down"
	}
	sqlDB, err := g.DB()
	if err != nil || sqlDB == nil {
		return "down"
	}
	// Usa PingContext con timeout
	if err := sqlDB.PingContext(ctx); err != nil {

		if err2 := sqlDB.Ping(); err2 != nil {
			return "down"
		}
	}
	return "ok"
}

// Import silencioso para garantizar que "database/sql" esté linkeado
var _ = sql.ErrNoRows
