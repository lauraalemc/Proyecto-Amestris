package middleware

import (
	"context"
	"net/http"
	"strings"

	"amestris/backend/internal/models"
)

// Clave ÚNICA para guardar el usuario en el contexto.
// Debe coincidir con la que usa AuthJWT (este mismo paquete).
const userCtxKey ctxKey = "user"

// =========================
// Helpers de contexto
// =========================

func UserFromContext(ctx context.Context) *models.User {
	if v := ctx.Value(userCtxKey); v != nil {
		if u, ok := v.(*models.User); ok {
			return u
		}
	}
	return nil
}

func AttachUser(r *http.Request, u *models.User) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userCtxKey, u))
}

// =========================
// Autorización por roles
// =========================

// RequireRole: wrapper para HANDLERS (firma func(http.HandlerFunc) http.HandlerFunc).
// Útil cuando envuelves handler por handler:
//
//	api.HandleFunc("/x", RequireRole("SUPERVISOR")(miHandler)).Methods("POST")
func RequireRole(roles ...string) func(http.HandlerFunc) http.HandlerFunc {
	upper := make([]string, len(roles))
	for i, r := range roles {
		upper[i] = strings.ToUpper(strings.TrimSpace(r))
	}
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			u := UserFromContext(r.Context())
			if u == nil {
				// writeJSONError está definido en auth.go (mismo paquete)
				writeJSONError(w, http.StatusUnauthorized, "no autenticado")
				return
			}
			// u.Role es models.UserRole → conviértelo a string
			role := strings.ToUpper(string(u.Role))

			for _, allowed := range upper {
				if role == allowed {
					next(w, r)
					return
				}
			}
			writeJSONError(w, http.StatusForbidden, "sin permiso")
		}
	}
}

// RequireRoleMW: ADAPTADOR a mux.MiddlewareFunc (firma func(http.Handler) http.Handler),
// para poder usarlo con router.Use(...):
//
//	super := api.PathPrefix("").Subrouter()
//	super.Use(middleware.RequireRoleMW("SUPERVISOR"))
//	super.HandleFunc(...)
func RequireRoleMW(roles ...string) func(http.Handler) http.Handler {
	inner := RequireRole(roles...)
	return func(next http.Handler) http.Handler {
		// Adaptamos http.Handler a http.HandlerFunc para el wrapper 'inner'
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			inner(next.ServeHTTP)(w, r)
		})
	}
}
