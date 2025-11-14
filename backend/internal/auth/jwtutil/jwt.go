package jwtutil

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID uint   `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// lee secreto de JWT
func secret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		// valor por defecto (solo dev). En prod, siempre por env.
		s = "change_me_dev_secret"
	}
	return []byte(s)
}

// duración del token, en horas (por env: JWT_EXPIRES_HOURS, default 12h)
func ttl() time.Duration {
	h := os.Getenv("JWT_EXPIRES_HOURS")
	if h == "" {
		return 12 * time.Hour
	}
	n, err := strconv.Atoi(h)
	if err != nil || n <= 0 {
		return 12 * time.Hour
	}
	return time.Duration(n) * time.Hour
}

// GenerateToken crea un JWT con uid y role, y devuelve el token y su expiración
func GenerateToken(userID uint, role string) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(ttl())

	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret())
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

// ParseToken valida el JWT y retorna las Claims
func ParseToken(tokenStr string) (*Claims, error) {
	if tokenStr == "" {
		return nil, errors.New("token vacío")
	}
	tkn, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return secret(), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := tkn.Claims.(*Claims)
	if !ok || !tkn.Valid {
		return nil, errors.New("token inválido")
	}
	return claims, nil
}
