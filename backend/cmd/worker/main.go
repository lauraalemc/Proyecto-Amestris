package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"amestris/backend/internal/async"
	"amestris/backend/internal/db"
	"amestris/backend/internal/jobs"
	"amestris/backend/internal/metrics"
	"amestris/backend/internal/models"
)

// helpers env con defaults
func getInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getDur(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return time.Duration(n) * time.Millisecond
		}
	}
	return def
}

func getBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if v == "1" || v == "true" || v == "TRUE" {
			return true
		}
		if v == "0" || v == "false" || v == "FALSE" {
			return false
		}
	}
	return def
}

// Lee un intervalo en segundos desde env
func getDurSec(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return time.Duration(n) * time.Second
		}
	}
	return def
}

func main() {
	// 1) Conectar DB
	if _, err := db.Init(); err != nil {
		log.Fatalf("DB init error: %v", err)
	}
	defer db.Close()

	// 2) Señal de finalización
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 3) Config reintentos
	cfg := async.RetryConfig{
		MaxAttempts: getInt("JOB_MAX_ATTEMPTS", 5),
		BackoffBase: getDur("JOB_BACKOFF_MS", 500*time.Millisecond),
		BackoffMax:  getDur("JOB_BACKOFF_MAX_MS", 30_000*time.Millisecond),
		Factor:      2.0,
		SendToDLQ:   getBool("JOB_DLQ_ENABLED", true),
	}
	log.Printf("worker retry cfg: attempts=%d base=%v max=%v factor=%.1f dlq=%v",
		cfg.MaxAttempts, cfg.BackoffBase, cfg.BackoffMax, cfg.Factor, cfg.SendToDLQ)

	// 4) Consumidor de la cola de auditoría con reintentos
	errCh := async.ConsumeWithRetry(func(b []byte) error {
		var p async.AuditPayload
		if err := json.Unmarshal(b, &p); err != nil {
			log.Printf("decode error: %v", err)
			metrics.JobProcessed("audit_insert", "decode_error")
			return err
		}
		a := models.Audit{
			Action:   string(p.Action),
			Entity:   p.Entity,
			EntityID: p.EntityID,
			Meta:     (p.Meta),
		}
		if err := db.Get().Create(&a).Error; err != nil {
			log.Printf("audit save error: %v", err)
			metrics.JobProcessed("audit_insert", "db_error")
			return err
		}
		log.Printf("✅ Auditoría registrada: action=%s entity=%s id=%d", a.Action, a.Entity, a.EntityID)
		metrics.JobProcessed("audit_insert", "ok")
		return nil
	}, cfg)

	// 5) Observa DLQ (opcional: solo loguea)
	go func() {
		for msg := range async.DLQ() {
			log.Printf("💀 DLQ: %s", string(msg))
			metrics.JobProcessed("audit_insert", "dlq")
		}
	}()

	// 6) Verificación de inventario y misiones, y auditoría diaria
	startVerificationLoop(ctx)

	// 7) Esperar señal o errores
	for {
		select {
		case <-ctx.Done():
			async.Shutdown()
			return
		case err := <-errCh:
			if err != nil {

				log.Printf("worker error (reportado por errCh): %v", err)
			} else {

				return
			}
		}
	}
}

func startVerificationLoop(ctx context.Context) {
	// Intervalo en segundos
	interval := getDurSec("VERIFY_INTERVAL_SEC", 24*time.Hour)
	lowStockThreshold := getInt("MATERIAL_LOW_STOCK_THRESHOLD", 5)
	staleDays := getInt("MISSION_STALE_DAYS", 30)

	log.Printf("verification loop: interval=%v lowStockThreshold=%d staleDays=%d",
		interval, lowStockThreshold, staleDays)

	ticker := time.NewTicker(interval)

	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				log.Println("verification loop: contexto cancelado, saliendo")
				return
			case <-ticker.C:
				if err := runDailyVerification(ctx, lowStockThreshold, staleDays); err != nil {
					log.Printf("verification error: %v", err)
					metrics.JobProcessed("daily_verification", "error")
				} else {
					metrics.JobProcessed("daily_verification", "ok")
				}
			}
		}
	}()
}

func runDailyVerification(ctx context.Context, lowStockThreshold int, staleDays int) error {
	d := db.Get()

	// 1) Auditoría diaria
	if err := jobs.HandleDailyAudit(ctx); err != nil {
		log.Printf("daily audit error: %v", err)

	}

	// 2) Materiales con stock bajo
	var low []models.Material
	if err := d.Where("quantity < ?", lowStockThreshold).Find(&low).Error; err != nil {
		return err
	}

	if len(low) == 0 {
		log.Printf("✅ Verificación stock: ningún material por debajo de %d", lowStockThreshold)
	} else {
		for _, m := range low {
			log.Printf("⚠️  Stock bajo: material id=%d name=%q qty=%.2f %s (umbral=%d)",
				m.ID, m.Name, m.Quantity, m.Unit, lowStockThreshold)
		}
	}

	// 3) Misiones estancadas
	jobs.RunStaleMissionsCheck(staleDays)

	return nil
}
