package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"amestris/backend/internal/db"
	"amestris/backend/internal/handlers"
	"amestris/backend/internal/metrics"
	"amestris/backend/internal/middleware"

	"amestris/backend/internal/jobs"
	"amestris/backend/internal/queue"

	"github.com/gorilla/mux"
	"github.com/hibiken/asynq"
)

func mountPublic(r *mux.Router) {
	// Health + Swagger
	r.HandleFunc("/api/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"backend"}`))
	}).Methods(http.MethodGet)
	r.PathPrefix("/docs").HandlerFunc(handlers.SwaggerUI)

	// AUTH público
	r.HandleFunc("/api/auth/register", handlers.Register).Methods(http.MethodPost)
	r.HandleFunc("/api/auth/login", handlers.Login).Methods(http.MethodPost)

	// Auditorías públicas
	r.HandleFunc("/api/audits", handlers.AuditsList).Methods(http.MethodGet)

	// Verificación de token
	r.HandleFunc("/api/auth/me", handlers.Me).Methods(http.MethodGet)
}

func mountProtected(api *mux.Router) {
	// JWT requerido y auditoría aplicada
	api.Use(middleware.AuthJWT)
	api.Use(middleware.Audit())

	// ====== Rutas para AMBOS ROLES ======

	// Materials
	api.HandleFunc("/materials", handlers.MaterialsList).Methods(http.MethodGet)

	// Missions
	api.HandleFunc("/missions", handlers.ListMissions).Methods(http.MethodGet)
	api.HandleFunc("/missions/{id}", handlers.GetMission).Methods(http.MethodGet)

	// Transmutations
	api.HandleFunc("/transmutations", handlers.TransmutationsList).Methods(http.MethodGet)
	api.HandleFunc("/transmutations", handlers.TransmutationsCreate).Methods(http.MethodPost)
	api.HandleFunc("/transmutations/{id}", handlers.TransmutationsUpdate).Methods(http.MethodPut) // <—
	api.HandleFunc("/transmutations/{id}", handlers.TransmutationsDelete).Methods(http.MethodDelete)

	// Encolar una transmutación
	api.HandleFunc("/transmutations/queue", func(w http.ResponseWriter, r *http.Request) {
		type inPayload struct {
			Title      string  `json:"title"`
			MaterialID uint    `json:"materialId"`
			Quantity   float64 `json:"quantity"`
			Result     string  `json:"result"`
		}
		var in inPayload
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil || strings.TrimSpace(in.Title) == "" {
			in = inPayload{Title: "Cola demo", MaterialID: 1, Quantity: 2, Result: "Lingote"}
		}
		var res *string
		if s := strings.TrimSpace(in.Result); s != "" {
			res = &s
		}

		p := jobs.PayloadTransmutation{
			Title:      in.Title,
			MaterialID: in.MaterialID,
			Quantity:   in.Quantity,
			Result:     res,
		}
		raw, _ := json.Marshal(p)
		task := asynq.NewTask(jobs.TaskTransmutation, raw, asynq.MaxRetry(3), asynq.Timeout(30*time.Second))

		info, err := queue.Client.Enqueue(task)
		if err != nil {
			http.Error(w, "no se pudo encolar tarea: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"taskId":          info.ID,
			"queue":           info.Queue,
			"state":           info.State.String(),
			"next_process_at": info.NextProcessAt,
		})
	}).Methods(http.MethodPost)

	// ====== SOLO SUPERVISOR ======
	super := api.PathPrefix("").Subrouter()
	super.Use(middleware.RequireRoleMW("SUPERVISOR"))

	// Alchemists
	super.HandleFunc("/alchemists", handlers.ListAlchemists).Methods(http.MethodGet)
	super.HandleFunc("/alchemists", handlers.CreateAlchemist).Methods(http.MethodPost)
	super.HandleFunc("/alchemists/{id}", handlers.GetAlchemist).Methods(http.MethodGet)
	super.HandleFunc("/alchemists/{id}", handlers.UpdateAlchemist).Methods(http.MethodPut)
	super.HandleFunc("/alchemists/{id}", handlers.DeleteAlchemist).Methods(http.MethodDelete)

	// Materials
	super.HandleFunc("/materials", handlers.MaterialsCreate).Methods(http.MethodPost)
	super.HandleFunc("/materials/{id}", handlers.MaterialsUpdate).Methods(http.MethodPut)
	super.HandleFunc("/materials/{id}", handlers.MaterialsDelete).Methods(http.MethodDelete)

	// Missions
	super.HandleFunc("/missions", handlers.CreateMission).Methods(http.MethodPost)
	super.HandleFunc("/missions/{id}", handlers.UpdateMission).Methods(http.MethodPut)
	super.HandleFunc("/missions/{id}", handlers.DeleteMission).Methods(http.MethodDelete)
}

func main() {
	// DB
	if err := db.Connect(); err != nil {
		log.Fatalf("❌ Error conectando a la DB: %v", err)
	}

	// Cola
	queue.Setup()
	defer queue.Close()

	// Router raíz + CORS
	r := mux.NewRouter()
	r.Use(middleware.CORS)
	r.PathPrefix("/").Methods(http.MethodOptions).HandlerFunc(middleware.Preflight)

	// Global middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RateLimit)
	r.Use(middleware.LogJSON)
	r.Use(metrics.Instrument)

	// Health / metrics
	r.HandleFunc("/api/healthz", handlers.Healthz).Methods(http.MethodGet)
	r.HandleFunc("/api/readyz", handlers.Readyz).Methods(http.MethodGet)
	r.Handle("/api/metrics", metrics.Handler()).Methods(http.MethodGet)

	// Público
	mountPublic(r)

	// Protegido
	api := r.PathPrefix("/api").Subrouter()
	mountProtected(api)

	// SSE
	r.HandleFunc("/realtime/sse", handlers.RealtimeSSE).Methods(http.MethodGet)
	r.HandleFunc("/api/realtime/sse", handlers.RealtimeSSE).Methods(http.MethodGet)

	// Auth extra
	r.HandleFunc("/auth/refresh", handlers.Refresh).Methods(http.MethodPost)
	r.HandleFunc("/auth/logout", handlers.Logout).Methods(http.MethodPost)

	// ===== Compat API v1 =====
	r.HandleFunc("/api/v1/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"backend"}`))
	}).Methods(http.MethodGet)

	r.PathPrefix("/api/v1/docs").HandlerFunc(handlers.SwaggerUI)
	r.HandleFunc("/api/v1/auth/register", handlers.Register).Methods(http.MethodPost)
	r.HandleFunc("/api/v1/auth/login", handlers.Login).Methods(http.MethodPost)
	r.HandleFunc("/api/v1/audits", handlers.AuditsList).Methods(http.MethodGet)
	r.HandleFunc("/api/v1/auth/me", handlers.Me).Methods(http.MethodGet)

	apiV1 := r.PathPrefix("/api/v1").Subrouter()
	mountProtected(apiV1)

	// Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Backend escuchando en http://localhost:%s", port)
	log.Printf("📘 Swagger disponible en http://localhost:%s/docs", port)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("❌ Servidor: %v", err)
	}
}
