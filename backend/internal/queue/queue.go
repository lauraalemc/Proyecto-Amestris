package queue

import (
	"log"
	"os"

	"github.com/hibiken/asynq"
)

var Client *asynq.Client
var Server *asynq.Server

// Setup inicializa cliente y servidor de tareas Redis.
func Setup() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	Client = asynq.NewClient(asynq.RedisClientOpt{Addr: redisAddr})
}

// StartServer inicia el worker (llamado desde cmd/worker/main.go)
func StartServer(handler *asynq.ServeMux) {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	Server = asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 5,
			Queues: map[string]int{
				"default": 1,
			},
		},
	)
	if err := Server.Run(handler); err != nil {
		log.Fatalf("❌ Worker: %v", err)
	}
}

// Close libera recursos.
func Close() {
	if Client != nil {
		_ = Client.Close()
	}
}
