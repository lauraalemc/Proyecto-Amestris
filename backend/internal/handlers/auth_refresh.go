package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"gorm.io/gorm"

	"amestris/backend/internal/auth/jwtutil"
	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

/* ===================== UTILIDADES ===================== */

// genera token aleatorio en hex
func randToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// devuelve hash sha256 en hex
func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

/* ===================== ESTRUCTURAS ===================== */

type tokensOut struct {
	Access  string `json:"access"`
	Refresh string `json:"refresh"`
	JTI     string `json:"jti"`
	Exp     int64  `json:"exp"`
}

/* ===================== EMISIÓN DE TOKENS ===================== */

func issueTokens(ctx context.Context, u models.User) (tokensOut, error) {
	// 1) Access token
	access, exp, err := jwtutil.GenerateToken(u.ID, string(u.Role))
	if err != nil {
		return tokensOut{}, err
	}

	// convertir exp a int64
	var expUnix int64
	if !exp.IsZero() {
		expUnix = exp.Unix()
	}

	// 2) Refresh token + JTI
	refreshPlain, err := randToken(32)
	if err != nil {
		return tokensOut{}, err
	}
	jti, err := randToken(16)
	if err != nil {
		return tokensOut{}, err
	}

	// 3) Guardar hash en DB
	rt := models.RefreshToken{
		UserID:    u.ID,
		TokenHash: sha256Hex(refreshPlain),
		JTI:       jti,
		ExpiresAt: time.Now().Add(time.Duration(db.RefreshTokenTTLDays()) * 24 * time.Hour),
	}
	if err := db.Get().WithContext(ctx).Create(&rt).Error; err != nil {
		return tokensOut{}, err
	}

	return tokensOut{
		Access:  access,
		Refresh: refreshPlain,
		JTI:     jti,
		Exp:     expUnix,
	}, nil
}

/* ===================== ENDPOINTS ===================== */

type refreshIn struct {
	Refresh string `json:"refresh"`
	JTI     string `json:"jti"`
}

// POST /api/auth/refresh
func Refresh(w http.ResponseWriter, r *http.Request) {
	var in refreshIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Refresh == "" || in.JTI == "" {
		writeJSONError(w, http.StatusBadRequest, "json inválido o faltan campos")
		return
	}

	// Buscar el refresh token en BD
	var rt models.RefreshToken
	err := db.Get().Where("jti = ?", in.JTI).First(&rt).Error
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, "refresh inválido")
		return
	}

	// Validar expiración o revocación
	if rt.RevokedAt != nil || time.Now().After(rt.ExpiresAt) {
		writeJSONError(w, http.StatusUnauthorized, "refresh expirado o revocado")
		return
	}

	// Comparar hash
	if rt.TokenHash != sha256Hex(in.Refresh) {
		writeJSONError(w, http.StatusUnauthorized, "refresh inválido")
		return
	}

	// Buscar usuario asociado
	var u models.User
	if err := db.Get().First(&u, rt.UserID).Error; err != nil {
		writeJSONError(w, http.StatusUnauthorized, "usuario no encontrado")
		return
	}

	// Revocar actual
	now := time.Now()
	if err := db.Get().Model(&rt).Update("revoked_at", &now).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "no se pudo rotar refresh")
		return
	}

	// Emitir nuevos tokens
	tok, err := issueTokens(r.Context(), u)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "no se pudo emitir tokens")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tok)
}

/* ===================== LOGOUT ===================== */

type logoutIn struct {
	JTI string `json:"jti"`
}

// POST /api/auth/logout
func Logout(w http.ResponseWriter, r *http.Request) {
	var in logoutIn
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.JTI == "" {
		writeJSONError(w, http.StatusBadRequest, "json inválido o faltan campos")
		return
	}

	var rt models.RefreshToken
	if err := db.Get().Where("jti = ?", in.JTI).First(&rt).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			w.WriteHeader(http.StatusOK)
			return
		}
		writeJSONError(w, http.StatusInternalServerError, "error buscando token")
		return
	}

	if rt.RevokedAt == nil {
		now := time.Now()
		_ = db.Get().Model(&rt).Update("revoked_at", &now).Error
	}

	w.WriteHeader(http.StatusOK)
}
