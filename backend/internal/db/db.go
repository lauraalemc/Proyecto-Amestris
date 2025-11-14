package db

import (
	"log"
	"os"
	"time"

	"amestris/backend/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Connect abre la conexión (usa DB_DSN o un DSN local por defecto) y migra modelos.
func Connect() error {
	if DB != nil { // ya conectada
		return nil
	}

	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=admin dbname=alchemy port=5432 sslmode=disable TimeZone=America/Bogota"
	}

	// Logger de GORM moderado
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	d, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: gormLogger})
	if err != nil {
		log.Printf("❌ Error conectando a la DB: %v\n", err)
		return err
	}

	// Pool
	if sqlDB, err := d.DB(); err == nil {
		sqlDB.SetMaxOpenConns(15)
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
	}

	// Migraciones (incluye RefreshToken)
	if err := d.AutoMigrate(
		&models.User{},
		&models.Alchemist{},
		&models.Mission{},
		&models.Material{},
		&models.Transmutation{},
		&models.Audit{},
		&models.RefreshToken{}, // ⬅️ AÑADIDO
	); err != nil {
		log.Printf("❌ Error en migraciones: %v\n", err)
		return err
	}

	DB = d
	log.Println("✅ Conexión a PostgreSQL lista")
	return nil
}

// Close cierra la conexión global si existe.
func Close() {
	if DB == nil {
		return
	}
	if sqlDB, err := DB.DB(); err == nil && sqlDB != nil {
		_ = sqlDB.Close()
	}
	DB = nil
}

// Init se mantiene por compatibilidad; usa Connect() y devuelve *gorm.DB.
func Init() (*gorm.DB, error) {
	if err := Connect(); err != nil {
		return nil, err
	}
	return DB, nil
}

// Get devuelve la instancia global.
func Get() *gorm.DB {
	return DB
}
