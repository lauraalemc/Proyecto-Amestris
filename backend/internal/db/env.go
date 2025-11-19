package db

import (
	"log"
	"os"
	"strconv"
)

// LoadEnv se deja por compatibilidad
func LoadEnv() {

}

// MustGetEnv devuelve el valor o un default si está vacío.
func MustGetEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	if def == "" {
		log.Printf("⚠️  %s no está definida; usando vacío", key)
	}
	return def
}

// MustGetInt devuelve int desde env o default si no existe / no es parseable.
func MustGetInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
		log.Printf("⚠️  %s no es int válido (%q); usando %d", key, v, def)
	}
	return def
}

// Helpers específicos para Auth
func AccessTokenTTLMin() int {
	return MustGetInt("ACCESS_TOKEN_TTL_MIN", 30)
}
func RefreshTokenTTLDays() int {
	return MustGetInt("REFRESH_TOKEN_TTL_DAYS", 7)
}
func JWTRefreshSecret() string {

	return MustGetEnv("JWT_REFRESH_SECRET", "")
}
