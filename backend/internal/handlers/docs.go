package handlers

import (
	"net/http"
	"path/filepath"
)

var docsDir = "docs" // dentro del contenedor es /app/docs

// SwaggerUI sirve el HTML de swagger y el YAML en /docs/openapi.yaml
func SwaggerUI(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/docs", "/docs/":
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(swaggerIndexHTML))
		return
	case "/docs/openapi.yaml":
		w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
		http.ServeFile(w, r, filepath.Join(docsDir, "openapi.yaml"))
		return
	default:
		http.NotFound(w, r)
		return
	}
}

const swaggerIndexHTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Amestris API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>`
