package realtime

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"amestris/backend/internal/metrics"
)

type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Broker struct {
	mu       sync.RWMutex
	clients  map[int]chan Event
	lastID   int
	shutdown chan struct{}
}

func NewBroker() *Broker {
	return &Broker{
		clients:  make(map[int]chan Event),
		shutdown: make(chan struct{}),
	}
}

func (b *Broker) AddClient() (int, chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.lastID++
	id := b.lastID
	ch := make(chan Event, 16)
	b.clients[id] = ch

	// Métrica: +1 cliente SSE
	metrics.SSEClientInc()

	return id, ch
}

func (b *Broker) RemoveClient(id int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if ch, ok := b.clients[id]; ok {
		close(ch)
		delete(b.clients, id)

		// Métrica: -1 cliente SSE
		metrics.SSEClientDec()
	}
}

func (b *Broker) Broadcast(ev Event) {
	// Métrica: contamos el evento por tipo
	metrics.SSEEvent(ev.Type)

	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.clients {
		select {
		case ch <- ev:
		default:
		}
	}
}

func (b *Broker) Shutdown() {
	close(b.shutdown)
	b.mu.Lock()
	for id, ch := range b.clients {
		close(ch)
		delete(b.clients, id)
	}
	b.mu.Unlock()
}

func writeSSE(w http.ResponseWriter, ev Event) error {
	w.Write([]byte("event: " + ev.Type + "\n"))
	payload, _ := json.Marshal(ev.Data)
	w.Write([]byte("data: " + string(payload) + "\n\n"))
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	return nil
}

func (b *Broker) HandlerSSE(w http.ResponseWriter, r *http.Request) {
	log.Println("⚡ Nueva conexión SSE desde", r.RemoteAddr)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	id, ch := b.AddClient()
	defer b.RemoveClient(id)

	ctx := r.Context()
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	_ = writeSSE(w, Event{Type: "hello", Data: map[string]any{"client": id}})

	for {
		select {
		case <-ctx.Done():
			return
		case <-b.shutdown:
			return
		case <-ticker.C:
			_ = writeSSE(w, Event{Type: "ping", Data: time.Now().Unix()})
		case ev := <-ch:
			if err := writeSSE(w, ev); err != nil {
				log.Printf("sse write error: %v", err)
				return
			}
		}
	}
}

var (
	broker     *Broker
	brokerOnce sync.Once
)

func GlobalBroker() *Broker {
	brokerOnce.Do(func() { broker = NewBroker() })
	return broker
}

func Publish(ctx context.Context, evType string, data interface{}) {
	GlobalBroker().Broadcast(Event{Type: evType, Data: data})
}
