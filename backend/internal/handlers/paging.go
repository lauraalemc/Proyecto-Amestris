package handlers

// listResponse: respuesta estándar de listas (sin genéricos)
type listResponse struct {
	Items    interface{} `json:"items"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Total    int64       `json:"total"`
}
