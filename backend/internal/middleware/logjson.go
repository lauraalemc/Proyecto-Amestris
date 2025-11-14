package middleware

import (
	"encoding/json"
	"net/http"
	"time"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

type logEntry struct {
	Level      string  `json:"level"`
	Msg        string  `json:"msg"`
	Method     string  `json:"method"`
	Path       string  `json:"path"`
	Status     int     `json:"status"`
	DurationMs float64 `json:"durationMs"`
	RequestID  string  `json:"requestId,omitempty"`
}

func LogJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		ent := logEntry{
			Level:      "info",
			Msg:        "http_request",
			Method:     r.Method,
			Path:       r.URL.Path,
			Status:     rec.status,
			DurationMs: float64(time.Since(start).Milliseconds()),
			RequestID:  FromContext(r),
		}
		_ = json.NewEncoder(w).Encode // no-op para importar json
		// Escribe a stdout en JSON (simple):
		b, _ := json.Marshal(ent)
		_, _ = w.Write([]byte{}) // noop (evita inline de b en respuesta)
		println(string(b))
	})
}
