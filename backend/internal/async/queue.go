package async

import (
	"context"
	"encoding/json"
	"sync"
	"time"
)

var (
	mu       sync.RWMutex
	ch       chan []byte
	chDLQ    chan []byte
	initOnce sync.Once
)

func init() {
	initOnce.Do(func() {
		// cola en memoria
		ch = make(chan []byte, 100)
		// DLQ para mensajes que fallan tras reintentos
		chDLQ = make(chan []byte, 100)
	})
}

/* ====================== Enqueue de Auditorías ====================== */

// Encola un payload
func EnqueueAudit(ctx context.Context, p AuditPayload) error {
	mu.RLock()
	c := ch
	mu.RUnlock()

	if c == nil {
		return nil
	}

	b, _ := json.Marshal(p)
	select {
	case c <- b:

	case <-ctx.Done():

	}
	return nil
}

/* ====================== Consumo simple ====================== */

// Consume mensajes; fn procesa cada uno.
func Consume(fn func([]byte) error) <-chan error {
	mu.RLock()
	c := ch
	mu.RUnlock()

	errCh := make(chan error, 1)

	go func() {
		for msg := range c {
			if err := fn(msg); err != nil {
				errCh <- err
				return
			}
		}
		close(errCh)
	}()

	return errCh
}

/* ====================== Reintentos + Backoff + DLQ ====================== */

type RetryConfig struct {
	MaxAttempts int
	BackoffBase time.Duration
	BackoffMax  time.Duration
	Factor      float64
	SendToDLQ   bool
}

// ConsumeWithRetry procesa mensajes con reintentos y backoff exponencial.
func ConsumeWithRetry(fn func([]byte) error, cfg RetryConfig) <-chan error {
	mu.RLock()
	c := ch
	mu.RUnlock()

	errCh := make(chan error, 100)

	go func() {
		for msg := range c {
			attempt := 0
			var err error
			backoff := cfg.BackoffBase
			for {
				attempt++
				err = fn(msg)
				if err == nil {
					break
				}

				if attempt >= cfg.MaxAttempts {
					// DLQ opcional
					if cfg.SendToDLQ {
						select {
						case chDLQ <- msg:
						default:

						}
					}
					// reporta error pero no rompe el loop principal
					select {
					case errCh <- err:
					default:
					}
					break
				}

				sleep := backoff
				if cfg.BackoffMax > 0 && sleep > cfg.BackoffMax {
					sleep = cfg.BackoffMax
				}
				time.Sleep(sleep)

				if cfg.Factor <= 1 {
					cfg.Factor = 2
				}
				backoff = time.Duration(float64(backoff) * cfg.Factor)
			}
		}
		close(errCh)
	}()

	return errCh
}

// DLQ devuelve el canal de solo lectura con mensajes muertos.
func DLQ() <-chan []byte {
	return chDLQ
}

// Cierra la cola (y la DLQ)
func Shutdown() {
	mu.Lock()
	if ch != nil {
		close(ch)
	}
	if chDLQ != nil {
		close(chDLQ)
	}
	ch = nil
	chDLQ = nil
	mu.Unlock()
}
