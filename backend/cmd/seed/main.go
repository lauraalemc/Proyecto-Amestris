// cmd/seed/main.go
package main

import (
	"errors"
	"log"
	"os"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"amestris/backend/internal/db"
	"amestris/backend/internal/models"
)

type seedUser struct {
	Email    string
	Name     string
	Role     models.UserRole
	Password string // texto plano SOLO para el seed; se guarda como hash
}

// ===== Helpers de espera/reintentos =====

func atoiDef(s string, def int) int {
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return def
}

func waitForDB() error {
	// Configurables por env si quieres ajustar sin recompilar
	maxWaitSec := atoiDef(os.Getenv("SEED_MAX_WAIT_SEC"), 45) // tiempo total
	stepMs := atoiDef(os.Getenv("SEED_STEP_MS"), 500)         // backoff base

	deadline := time.Now().Add(time.Duration(maxWaitSec) * time.Second)
	attempt := 0
	for {
		attempt++
		if err := db.Connect(); err == nil {
			log.Printf("✅ Conexión a PostgreSQL lista (intento %d)", attempt)
			return nil
		} else {
			// Mensaje corto para no llenar logs
			log.Printf("⏳ DB aún no lista (intento %d): %v", attempt, err)
		}

		if time.Now().After(deadline) {
			return errors.New("timeout esperando a la DB")
		}
		// backoff exponencial suave
		sleep := time.Duration(stepMs*(1<<uint(min(attempt-1, 5)))) * time.Millisecond
		if sleep > 3*time.Second {
			sleep = 3 * time.Second
		}
		time.Sleep(sleep)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ===== Hash helper =====

func hash(p string) string {
	h, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("seed: error generando hash: %v", err)
	}
	return string(h)
}

func strptr(s string) *string { return &s }

func main() {
	// 1) Espera robusta a la DB (con reintentos)
	if err := waitForDB(); err != nil {
		log.Fatalf("❌ Seed: DB no lista a tiempo: %v", err)
	}
	d := db.Get()
	log.Println("🌱 Seed: iniciando…")

	// 2) Migraciones defensivas (por si el backend no las corrió antes)
	if err := d.AutoMigrate(
		&models.User{},
		&models.Alchemist{},
		&models.Mission{},
		&models.Material{},
		&models.Transmutation{},
	); err != nil {
		log.Fatalf("❌ Seed: error en migraciones: %v", err)
	}

	// 3) Usuarios a sembrar
	users := []seedUser{
		{Email: "roy@amestris.gov", Name: "Roy Mustang", Role: models.RoleSupervisor, Password: "roy123"},
		{Email: "riza@amestris.gov", Name: "Riza Hawkeye", Role: models.RoleAlchemist, Password: "riza123"},
	}

	for _, su := range users {
		var u models.User
		err := d.Where("email = ?", su.Email).First(&u).Error
		if err == nil {
			if err := d.Model(&u).Updates(map[string]any{
				"name":          su.Name,
				"role":          su.Role,
				"password_hash": hash(su.Password),
			}).Error; err != nil {
				log.Fatalf("❌ Seed: no se pudo actualizar %s: %v", su.Email, err)
			}
			log.Printf("✅ Usuario actualizado → %s (%s)", su.Email, su.Role)
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			u = models.User{
				Email:        su.Email,
				Name:         su.Name,
				Role:         su.Role,
				PasswordHash: hash(su.Password),
			}
			if err := d.Create(&u).Error; err != nil {
				log.Fatalf("❌ Seed: no se pudo crear %s: %v", su.Email, err)
			}
			log.Printf("✅ Usuario creado → %s (%s)", su.Email, su.Role)
		} else {
			log.Fatalf("❌ Seed: error consultando %s: %v", su.Email, err)
		}
	}

	// 4) Materiales
	materials := []models.Material{
		{Name: "Mercurio refinado", Quantity: 25, Unit: "kg", Rarity: strptr("RARE"), Notes: strptr("Resguardar en contenedor sellado")},
		{Name: "Hierro en lingotes", Quantity: 120, Unit: "kg", Rarity: strptr("COMMON"), Notes: strptr("Uso general de laboratorio")},
	}
	for _, m := range materials {
		var existing models.Material
		if err := d.Where("name = ?", m.Name).First(&existing).Error; err == nil {
			existing.Quantity = m.Quantity
			existing.Unit = m.Unit
			existing.Rarity = m.Rarity
			existing.Notes = m.Notes
			if err := d.Save(&existing).Error; err != nil {
				log.Fatalf("❌ Seed: actualizar material %s: %v", m.Name, err)
			}
			log.Printf("📦 Material actualizado: %s", existing.Name)
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := d.Create(&m).Error; err != nil {
				log.Fatalf("❌ Seed: crear material %s: %v", m.Name, err)
			}
			log.Printf("📦 Material creado: %s", m.Name)
		} else {
			log.Fatalf("❌ Seed: consultar material %s: %v", m.Name, err)
		}
	}

	// 5) Misiones
	missions := []models.Mission{
		{Title: "Inspección en Central City", Description: "Verificar reportes de círculos no autorizados"},
		{Title: "Ensayo de transmutación metálica", Description: "Prueba controlada de hierro → acero"},
	}
	for _, mi := range missions {
		var existing models.Mission
		if err := d.Where("title = ?", mi.Title).First(&existing).Error; err == nil {
			existing.Description = mi.Description
			if err := d.Save(&existing).Error; err != nil {
				log.Fatalf("❌ Seed: actualizar misión %s: %v", mi.Title, err)
			}
			log.Printf("🗂️  Misión actualizada: %s", existing.Title)
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := d.Create(&mi).Error; err != nil {
				log.Fatalf("❌ Seed: crear misión %s: %v", mi.Title, err)
			}
			log.Printf("🗂️  Misión creada: %s", mi.Title)
		} else {
			log.Fatalf("❌ Seed: consultar misión %s: %v", mi.Title, err)
		}
	}

	log.Println("🌿 Seed: terminado.")
}
