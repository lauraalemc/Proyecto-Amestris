// backend/internal/middleware/audit.go
package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

// --- util para capturar el status code ---
type writerWrapper struct {
	http.ResponseWriter
	status int
}

func (w *writerWrapper) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// --- util para IP del cliente ---
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		p := strings.Split(xff, ",")
		return strings.TrimSpace(p[0])
	}
	if xr := r.Header.Get("X-Real-IP"); xr != "" {
		return xr
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}

/*
Audit registra un evento con tu esquema:

- Action:  "HTTP"
- Entity:  r.URL.Path   (ruta golpeada)
- EntityID: 0 (si no aplica; puedes cambiarlo cuando la ruta tenga un ID claro)
- Meta: JSON con {userId, method, status, userAgent, ip, latencyMs}
*/
func Audit() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			ww := &writerWrapper{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(ww, r)

			// si AuthJWT adjuntó usuario, lo tomamos
			var userID *uint
			if u := UserFromContext(r.Context()); u != nil {
				userID = &u.ID
			}

			meta := map[string]any{
				"userId":    userID, // quedará null si no hay user
				"method":    r.Method,
				"status":    ww.status,
				"userAgent": r.UserAgent(),
				"ip":        clientIP(r),
				"latencyMs": time.Since(start).Milliseconds(),
			}
			raw, _ := json.Marshal(meta)

			a := models.Audit{
				Action:   "HTTP",
				Entity:   r.URL.Path,
				EntityID: 0,   // ajústalo si tu ruta maneja IDs (e.g., /missions/{id})
				Meta:     raw, // json.RawMessage
				// CreatedAt lo llena GORM con autoCreateTime si lo configuras; si no,
				// puedes dejar que lo ponga la BD por defecto o añadir time.Now() aquí.
			}

			// best-effort en background para no bloquear la respuesta
			go func() {
				_ = db.Get().Create(&a).Error
			}()
		})
	}
}
