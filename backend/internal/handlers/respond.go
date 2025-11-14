package handlers

import (
	"encoding/json"
	"net/http"
)

// Respuesta JSON con UTF-8 garantizado
func WriteJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Respuesta de error JSON unificada
func WriteError(w http.ResponseWriter, status int, msg string) {
	type errResp struct {
		Error string `json:"error"`
	}
	WriteJSON(w, status, errResp{Error: msg})
}
