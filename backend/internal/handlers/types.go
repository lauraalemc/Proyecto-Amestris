package handlers

// ListResponse: respuesta estándar para listas paginadas
type ListResponse[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

type apiError struct {
	Error string `json:"error"`
}
