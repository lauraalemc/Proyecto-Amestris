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
		// cola en memoria (suficiente para proyecto académico)
		ch = make(chan []byte, 100)
		// DLQ (dead-letter) para mensajes que fallan tras reintentos
		chDLQ = make(chan []byte, 100)
	})
}

/* ====================== Enqueue de Auditorías (usa tipos de async/types.go) ====================== */

// Encola un payload; si el contexto se cancela, retorna nil silencioso
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
		// ok
	case <-ctx.Done():
		// cancelado; no consideramos error
	}
	return nil
}

/* ====================== Consumo simple (compat) ====================== */

// Consume mensajes; fn procesa cada uno. Devuelve canal de error si fn falla.
// (Se mantiene por compatibilidad)
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
	MaxAttempts int           // p.ej. 5
	BackoffBase time.Duration // p.ej. 500ms
	BackoffMax  time.Duration // p.ej. 30s
	Factor      float64       // p.ej. 2.0
	SendToDLQ   bool          // true → manda a DLQ tras agotar reintentos
}

// ConsumeWithRetry procesa mensajes con reintentos y backoff exponencial.
// No detiene el consumidor cuando fn falla: sigue leyendo siguientes mensajes.
// Los errores se emiten por errCh pero el loop continúa.
func ConsumeWithRetry(fn func([]byte) error, cfg RetryConfig) <-chan error {
	mu.RLock()
	c := ch
	mu.RUnlock()

	errCh := make(chan error, 100) // buffer para no bloquear

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
				// ¿más intentos?
				if attempt >= cfg.MaxAttempts {
					// DLQ opcional
					if cfg.SendToDLQ {
						select {
						case chDLQ <- msg:
						default:
							// si se llena DLQ, descartamos silenciosamente
						}
					}
					// reporta error pero no rompe el loop principal
					select {
					case errCh <- err:
					default:
					}
					break
				}
				// dormir con backoff (capped)
				sleep := backoff
				if cfg.BackoffMax > 0 && sleep > cfg.BackoffMax {
					sleep = cfg.BackoffMax
				}
				time.Sleep(sleep)
				// próximo backoff
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
