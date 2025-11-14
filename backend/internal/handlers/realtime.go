// backend/internal/handlers/realtime.go
package handlers

import (
	"net/http"

	"amestris/backend/internal/realtime"
)

// GET /api/realtime/sse
func RealtimeSSE(w http.ResponseWriter, r *http.Request) {
	// 🔓 CORS básico para dev (Next en localhost:3000)
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")

	// Por si algún proxy/cliente manda OPTIONS antes (no suele pasar con SSE,
	// pero así no molesta nada)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// 👉 Pasamos al broker SSE real
	realtime.GlobalBroker().HandlerSSE(w, r)
}
