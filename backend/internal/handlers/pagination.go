package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type PaginatedResponse[T any] struct {
	Data   []T    `json:"data"`
	Total  int64  `json:"total"`
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
	Query  string `json:"q,omitempty"`
}

func parseLimitOffset(r *http.Request) (limit, offset int) {
	const (
		defLimit = 10
		maxLimit = 50
	)
	limit = defLimit
	offset = 0

	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			if n > maxLimit {
				n = maxLimit
			}
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	return
}

func normalizeQuery(r *http.Request) string {
	return strings.TrimSpace(r.URL.Query().Get("q"))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
