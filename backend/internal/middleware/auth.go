package middleware

import (
	"encoding/json"
	"net/http"
	"strings"

	importjwt "amestris/backend/internal/auth/jwtutil"
	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

type apiError struct {
	Error string `json:"error"`
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(apiError{Error: msg})
}

// AuthJWT: middleware de autenticación por JWT.

func AuthJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authz := r.Header.Get("Authorization")
		if authz == "" {
			writeJSONError(w, http.StatusUnauthorized, "Falta encabezado Authorization Bearer")
			return
		}

		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeJSONError(w, http.StatusUnauthorized, "Formato de Authorization inválido")
			return
		}
		token := strings.TrimSpace(parts[1])
		if token == "" {
			writeJSONError(w, http.StatusUnauthorized, "Token vacío")
			return
		}

		// Parsear y validar token
		claims, err := importjwt.ParseToken(token)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "Token inválido o expirado")
			return
		}

		// (Re)validar usuario desde la base de datos y obtener rol actualizado
		var u models.User
		if err := db.DB.First(&u, claims.UserID).Error; err != nil {
			writeJSONError(w, http.StatusUnauthorized, "Usuario no válido")
			return
		}

		// Adjuntar usuario al contexto para que otros middlewares/handlers lo lean
		r = AttachUser(r, &u)

		next.ServeHTTP(w, r)
	})
}
