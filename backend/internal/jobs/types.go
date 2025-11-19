package jobs

// Nombre de la cola donde se encolarán las transmutaciones.
const QueueTransmutations = "transmutations"

// Tipo de tarea para crear una transmutación
const TaskTransmutation = "transmutations:create"

// Payload que viaja en la tarea.
type PayloadTransmutation struct {
	Title      string  `json:"title"`
	MaterialID uint    `json:"materialId"`
	Quantity   float64 `json:"quantity"` // cantidad usada
	Result     *string `json:"result,omitempty"`
}
