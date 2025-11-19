package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"amestris/backend/internal/auth/jwtutil"
	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

/* ---------- Error helper local ---------- */

type authErr struct {
	Error  string            `json:"error"`
	Fields map[string]string `json:"fields,omitempty"`
}

func writeJSONError(w http.ResponseWriter, status int, msg string, fields ...map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	var f map[string]string
	if len(fields) > 0 {
		f = fields[0]
	}
	_ = json.NewEncoder(w).Encode(authErr{Error: msg, Fields: f})
}

/* ---------- DTOs ---------- */

type authUserDTO struct {
	ID    uint            `json:"id"`
	Name  string          `json:"name"`
	Email string          `json:"email"`
	Role  models.UserRole `json:"role"`
}

func toAuthUserDTO(u models.User) authUserDTO {
	return authUserDTO{
		ID:    u.ID,
		Name:  u.Name,
		Email: u.Email,
		Role:  u.Role,
	}
}

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

/* POST /api/auth/register */

type registerReq struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type authResp struct {
	Token   string      `json:"token"`
	User    authUserDTO `json:"user"`
	Access  string      `json:"access"`
	Refresh string      `json:"refresh"`
	JTI     string      `json:"jti"`
	Exp     int64       `json:"exp"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	var in registerReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSONError(w, http.StatusBadRequest, "json inválido")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Role = strings.ToUpper(strings.TrimSpace(in.Role))

	// Validación campos
	fields := map[string]string{}
	if in.Name == "" {
		fields["name"] = "requerido"
	}
	if in.Email == "" || !emailRe.MatchString(in.Email) {
		fields["email"] = "email inválido"
	}
	if len(in.Password) < 6 {
		fields["password"] = "mínimo 6 caracteres"
	}
	if len(fields) > 0 {
		writeJSONError(w, http.StatusUnprocessableEntity, "validación", fields)
		return
	}

	role := models.RoleAlchemist
	if in.Role == string(models.RoleSupervisor) {
		role = models.RoleSupervisor
	}

	// ¿Email ya existe?
	var exists models.User
	if err := db.Get().Where("email = ?", in.Email).First(&exists).Error; err == nil {
		writeJSONError(w, http.StatusConflict, "email ya registrado")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		writeJSONError(w, http.StatusInternalServerError, "error consultando email")
		return
	}

	// Hash de contraseña
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "no se pudo hashear contraseña")
		return
	}

	u := models.User{
		Name:         in.Name,
		Email:        in.Email,
		Role:         role,
		PasswordHash: string(hash),
	}
	if err := db.Get().Create(&u).Error; err != nil {
		writeJSONError(w, http.StatusInternalServerError, "no se pudo crear usuario")
		return
	}

	tok, err := issueTokens(r.Context(), u)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "no se pudo generar tokens")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(authResp{
		Token:   tok.Access,
		User:    toAuthUserDTO(u),
		Access:  tok.Access,
		Refresh: tok.Refresh,
		JTI:     tok.JTI,
		Exp:     tok.Exp,
	})

}

/* POST /api/auth/login  */

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(w http.ResponseWriter, r *http.Request) {
	var in loginReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSONError(w, http.StatusBadRequest, "json inválido")
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))

	// Validación
	fields := map[string]string{}
	if in.Email == "" || !emailRe.MatchString(in.Email) {
		fields["email"] = "email inválido"
	}
	if in.Password == "" {
		fields["password"] = "requerido"
	}
	if len(fields) > 0 {
		writeJSONError(w, http.StatusUnprocessableEntity, "validación", fields)
		return
	}

	var u models.User
	if err := db.Get().Where("email = ?", in.Email).First(&u).Error; err != nil {

		writeJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)); err != nil {
		writeJSONError(w, http.StatusUnauthorized, "credenciales inválidas")
		return
	}

	tok, err := issueTokens(r.Context(), u)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "no se pudo generar tokens")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(authResp{
		Token:   tok.Access,
		User:    toAuthUserDTO(u),
		Access:  tok.Access,
		Refresh: tok.Refresh,
		JTI:     tok.JTI,
		Exp:     tok.Exp,
	})

}

/* GET /api/auth/me */

func Me(w http.ResponseWriter, r *http.Request) {
	authz := r.Header.Get("Authorization")
	if !strings.HasPrefix(strings.ToLower(authz), "bearer ") {
		writeJSONError(w, http.StatusUnauthorized, "token requerido")
		return
	}
	raw := strings.TrimSpace(authz[len("Bearer "):])

	claims, err := jwtutil.ParseToken(raw)
	if err != nil {
		writeJSONError(w, http.StatusUnauthorized, "token inválido")
		return
	}

	var u models.User
	if err := db.Get().First(&u, claims.UserID).Error; err != nil {
		writeJSONError(w, http.StatusUnauthorized, "usuario no encontrado")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(toAuthUserDTO(u))
}
