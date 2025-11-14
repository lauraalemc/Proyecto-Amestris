package middleware

import "net/http"

// Lista blanca de orígenes permitidos (puedes ajustar según tu entorno)
var allowedOrigins = map[string]bool{
	"http://localhost:3000": true,
	"http://127.0.0.1:3000": true,
	"http://localhost:3001": true,
	"http://127.0.0.1:3001": true,
}

// Middleware principal de CORS (se aplica a rutas normales: GET, POST, etc.)
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else if origin == "" {
			// Si no hay Origin (por ejemplo, curl local), se permite todo
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		// Si es un preflight, responder directamente (esto evita errores en peticiones simples)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Handler global para preflight (se usa para rutas OPTIONS sin match explícito)
func Preflight(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")

	if allowedOrigins[origin] {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	} else if origin == "" {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	}

	w.Header().Set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

	w.WriteHeader(http.StatusNoContent)
}
