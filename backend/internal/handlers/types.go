package handlers

// ListResponse es la respuesta estándar para listas paginadas.
// Déjala definida UNA sola vez en el paquete handlers.
type ListResponse[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

type apiError struct {
	Error string `json:"error"`
}
