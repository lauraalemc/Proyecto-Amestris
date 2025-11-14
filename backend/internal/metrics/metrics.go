package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

/*
HTTP core metrics + hooks opcionales para SSE y Workers.
- /api/metrics → promhttp.Handler()
- Instrument(next) → middleware que mide conteo, latencia y requests en vuelo
- Hooks opcionales (SSEClientInc/Dec, SSEEvent, JobProcessed) para instrumentar si quieres
*/

var (
	inFlight = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "http_in_flight_requests",
		Help: "Número de requests HTTP procesándose actualmente.",
	})

	httpRequests = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total de requests HTTP por método/ruta/estado.",
		},
		[]string{"method", "path", "status"},
	)

	httpDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duración de requests HTTP por método y ruta.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// ====== OPCIONAL: métricas de SSE y Workers ======
	sseClients = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "sse_clients",
		Help: "Clientes SSE conectados.",
	})

	sseEvents = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "sse_events_total",
			Help: "Eventos SSE enviados por tipo.",
		},
		[]string{"type"},
	)

	workerProcessed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "worker_jobs_total",
			Help: "Tareas de worker procesadas por nombre y resultado.",
		},
		[]string{"name", "result"},
	)
)

func init() {
	prometheus.MustRegister(inFlight, httpRequests, httpDuration)
	prometheus.MustRegister(sseClients, sseEvents, workerProcessed)
}

// Handler expone /api/metrics.
func Handler() http.Handler {
	return promhttp.Handler()
}

// Instrument mide conteo, latencia y requests en vuelo.
func Instrument(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		method := r.Method
		path := r.URL.Path // si usas mux, puedes normalizar la ruta aquí si quieres

		inFlight.Inc()
		defer inFlight.Dec()

		ww := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)

		elapsed := time.Since(start).Seconds()
		httpDuration.WithLabelValues(method, path).Observe(elapsed)
		httpRequests.WithLabelValues(method, path, strconv.Itoa(ww.status)).Inc()
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

/* =========================
   Hooks opcionales (SSE/Worker)
   ========================= */

// Marca +1 cliente SSE (llamar en AddClient)
func SSEClientInc() { sseClients.Inc() }

// Marca -1 cliente SSE (llamar en RemoveClient)
func SSEClientDec() { sseClients.Dec() }

// Marca 1 evento SSE emitido (llamar en Broadcast)
func SSEEvent(typ string) { sseEvents.WithLabelValues(typ).Inc() }

// Marca tarea de worker procesada (llamar en worker)
func JobProcessed(name, result string) {
	workerProcessed.WithLabelValues(name, result).Inc()
}
